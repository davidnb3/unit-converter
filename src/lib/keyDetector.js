// ─── AIFF parser ──────────────────────────────────────────────────────────────
// Chrome and Firefox cannot decode AIFF via decodeAudioData (Safari-only).
// AIFF is a simple container for big-endian PCM, so we parse it ourselves.
// Supports 16-bit, 24-bit, and 32-bit uncompressed AIFF and AIFC ('NONE'/'sowt').

function readFourCC(view, off) {
  return String.fromCharCode(
    view.getUint8(off), view.getUint8(off + 1),
    view.getUint8(off + 2), view.getUint8(off + 3)
  );
}

// Apple's 80-bit extended precision float, used for AIFF sample rate
function read80BitFloat(view, off) {
  const exp = (view.getUint16(off, false) & 0x7FFF) - 16383;
  const hi  = view.getUint32(off + 2, false);
  const lo  = view.getUint32(off + 6, false);
  return (hi * 2 ** -31 + lo * 2 ** -63) * 2 ** exp;
}

function looksLikeAiff(buffer) {
  if (buffer.byteLength < 12) return false;
  const v = new DataView(buffer);
  return readFourCC(v, 0) === 'FORM' &&
    (readFourCC(v, 8) === 'AIFF' || readFourCC(v, 8) === 'AIFC');
}

function parseAiff(buffer) {
  const view     = new DataView(buffer);
  const formType = readFourCC(view, 8);

  let numChannels = 0, numFrames = 0, bitDepth = 0, sampleRate = 0;
  let littleEndian = false;
  let ssndStart = -1;

  let off = 12;
  while (off + 8 <= buffer.byteLength) {
    const id   = readFourCC(view, off);
    const size = view.getUint32(off + 4, false);
    const data = off + 8;

    if (id === 'COMM') {
      numChannels = view.getInt16(data, false);
      numFrames   = view.getUint32(data + 2, false);
      bitDepth    = view.getInt16(data + 6, false);
      sampleRate  = read80BitFloat(view, data + 8);

      if (formType === 'AIFC') {
        const codec = readFourCC(view, data + 18);
        if (codec === 'sowt') {
          littleEndian = true; // Logic Pro little-endian variant
        } else if (codec !== 'NONE' && codec !== 'raw ') {
          throw new Error('Compressed AIFF is not supported. Re-export as uncompressed AIFF.');
        }
      }
    } else if (id === 'SSND') {
      const blockOff = view.getUint32(data, false);
      ssndStart = data + 8 + blockOff;
    }

    off = data + size + (size & 1); // chunks are padded to even byte boundary
  }

  if (ssndStart < 0 || numChannels === 0) throw new Error('Invalid or unsupported AIFF file.');

  const bps      = Math.ceil(bitDepth / 8); // bytes per sample
  const channels = Array.from({ length: numChannels }, () => new Float32Array(numFrames));

  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const pos = ssndStart + (frame * numChannels + ch) * bps;
      let value = 0;

      if (bps === 2) {
        value = view.getInt16(pos, littleEndian) / 32768;
      } else if (bps === 3) {
        const b0 = view.getUint8(pos), b1 = view.getUint8(pos + 1), b2 = view.getUint8(pos + 2);
        let raw = littleEndian ? (b0 | (b1 << 8) | (b2 << 16)) : ((b0 << 16) | (b1 << 8) | b2);
        if (raw & 0x800000) raw -= 0x1000000;
        value = raw / 8388608;
      } else if (bps === 4) {
        value = view.getInt32(pos, littleEndian) / 2147483648;
      }

      channels[ch][frame] = value;
    }
  }

  return {
    sampleRate,
    numberOfChannels: numChannels,
    length: numFrames,
    getChannelData: (ch) => channels[ch],
  };
}

// ─── Audio decode (native + AIFF fallback) ────────────────────────────────────
async function decodeAudio(file) {
  const arrayBuffer = await file.arrayBuffer();

  if (looksLikeAiff(arrayBuffer)) {
    return parseAiff(arrayBuffer);
  }

  const audioCtx = new AudioContext();
  try {
    return await audioCtx.decodeAudioData(arrayBuffer);
  } catch {
    throw new Error('Could not decode this audio file. Try MP3, WAV, FLAC, AIFF, or OGG.');
  } finally {
    audioCtx.close();
  }
}

// ─── Aarden-Essen key profiles (Aarden, 2003) ─────────────────────────────────
// Index 0 = root degree, 3 = minor 3rd, 4 = major 3rd, etc.
// Krumhansl-Schmuckler distinguishes major/minor 3rd with only a ~2× ratio.
// Aarden-Essen gives a ~105× ratio, making mode detection far more reliable
// for pop and electronic music.
const MAJOR_PROFILE = [17.7661, 0.145624, 14.9265, 0.160788, 19.8049, 11.3587, 0.291248, 22.062, 0.145624, 8.15494, 0.232998, 4.95122];
const MINOR_PROFILE = [18.2648, 0.737619, 14.0499, 16.8599, 0.702494, 14.4362, 0.702494, 18.6161, 4.56621, 1.93186, 7.37619, 1.75623];

// Display-friendly names for each pitch class
const KEY_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

// Camelot wheel codes for pitch classes 0-11
const CAMELOT_MAJOR = ['8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B'];
const CAMELOT_MINOR = ['5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A', '8A', '3A', '10A'];

// ─── Cooley-Tukey radix-2 FFT (in-place, complex) ─────────────────────────────
function fft(re, im) {
  const n = re.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    const half = len >> 1;

    for (let i = 0; i < n; i += len) {
      let cRe = 1, cIm = 0;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * cRe - im[i + j + half] * cIm;
        const vIm = re[i + j + half] * cIm + im[i + j + half] * cRe;

        re[i + j]        = uRe + vRe;
        im[i + j]        = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;

        const nextCRe = cRe * wRe - cIm * wIm;
        cIm = cRe * wIm + cIm * wRe;
        cRe = nextCRe;
      }
    }
  }
}

// ─── Pearson correlation between two equal-length arrays ─────────────────────
function pearson(a, b) {
  const n = a.length;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i]; }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num  += da * db;
    denA += da * da;
    denB += db * db;
  }
  return num / (Math.sqrt(denA * denB) || 1);
}

// ─── Public API ────────────────────────────────────────────────────────────────
/**
 * Detects the musical key of the given audio File.
 * @param {File} file  Any audio file supported by the browser (MP3, WAV, FLAC…)
 * @returns {Promise<{ key: string, mode: string, camelot: string }>}
 */
export async function detectKey(file) {
  // ── 1. Decode audio to PCM ──────────────────────────────────────────────────
  const audioBuffer  = await decodeAudio(file);
  const sampleRate   = audioBuffer.sampleRate;
  const numChannels  = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;

  // ── 2. Mix down to mono ─────────────────────────────────────────────────────
  const mono = new Float32Array(totalSamples);
  for (let c = 0; c < numChannels; c++) {
    const ch = audioBuffer.getChannelData(c);
    for (let i = 0; i < totalSamples; i++) mono[i] += ch[i] / numChannels;
  }

  // Limit analysis to the first 90 seconds to keep it responsive
  const analyseLength = Math.min(totalSamples, sampleRate * 90);

  // ── 3. Build chromagram via STFT ────────────────────────────────────────────
  const FFT_SIZE = 4096;
  const HOP      = FFT_SIZE >> 1; // 50% overlap — doubles frame count for short sounds

  // Pre-compute Hann window
  const hann = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
  }

  const re    = new Float64Array(FFT_SIZE);
  const im    = new Float64Array(FFT_SIZE);
  const chroma = new Float64Array(12);
  const freqPerBin = sampleRate / FFT_SIZE;

  for (let start = 0; start + FFT_SIZE <= analyseLength; start += HOP) {
    // Apply Hann window
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = mono[start + i] * hann[i];
      im[i] = 0;
    }

    fft(re, im);

    // Accumulate magnitude into 12 pitch-class bins.
    // Lower bound 65 Hz (≈ C2): below this each FFT bin spans >2 semitones,
    // making pitch-class assignment unreliable and amplifying low-freq noise.
    for (let k = 1; k < FFT_SIZE >> 1; k++) {
      const freq = k * freqPerBin;
      if (freq < 65 || freq > 4200) continue;

      // Map frequency → MIDI note → pitch class
      const midi = 12 * Math.log2(freq / 440) + 69;
      const pc   = ((Math.round(midi) % 12) + 12) % 12;
      const mag  = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      chroma[pc] += mag;
    }
  }

  // ── 4. Normalise chromagram ─────────────────────────────────────────────────
  const chromaMax = Math.max(...chroma);
  if (chromaMax === 0) throw new Error('The audio appears to be silent.');
  const chromaNorm = Array.from(chroma, v => v / chromaMax);

  // ── 5. Correlate against 24 Aarden-Essen profiles ──────────────────────────
  let bestCorr = -Infinity;
  let bestPc   = 0;
  let bestMode = 'major';

  for (let pc = 0; pc < 12; pc++) {
    // Rotate profiles so that their root aligns with pitch class `pc`
    const majorProfile = Array.from({ length: 12 }, (_, i) => MAJOR_PROFILE[(i - pc + 12) % 12]);
    const minorProfile = Array.from({ length: 12 }, (_, i) => MINOR_PROFILE[(i - pc + 12) % 12]);

    const corrMajor = pearson(chromaNorm, majorProfile);
    const corrMinor = pearson(chromaNorm, minorProfile);

    if (corrMajor > bestCorr) { bestCorr = corrMajor; bestPc = pc; bestMode = 'major'; }
    if (corrMinor > bestCorr) { bestCorr = corrMinor; bestPc = pc; bestMode = 'minor'; }
  }

  // ── 6. Map to display values ────────────────────────────────────────────────
  const key     = KEY_NAMES[bestPc];
  const camelot = bestMode === 'major' ? CAMELOT_MAJOR[bestPc] : CAMELOT_MINOR[bestPc];

  return { key, mode: bestMode, camelot };
}
