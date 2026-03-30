import Meyda from 'meyda';

// ─── Audio decode ─────────────────────────────────────────────────────────────
async function decodeAudio(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    return await audioCtx.decodeAudioData(arrayBuffer);
  } catch {
    throw new Error('Could not decode this audio file. Try MP3, WAV, FLAC, AAC, or M4A.');
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

  // ── 3. Build chromagram via Meyda ───────────────────────────────────────────
  const FFT_SIZE = 4096;
  const HOP      = FFT_SIZE >> 1; // 50% overlap — doubles frame count for short sounds

  Meyda.bufferSize = FFT_SIZE;
  Meyda.sampleRate = sampleRate;

  const chroma = new Float64Array(12);
  for (let start = 0; start + FFT_SIZE <= analyseLength; start += HOP) {
    const frame = mono.slice(start, start + FFT_SIZE);
    const frameChroma = Meyda.extract('chroma', frame);
    if (frameChroma) {
      for (let i = 0; i < 12; i++) chroma[i] += frameChroma[i];
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
