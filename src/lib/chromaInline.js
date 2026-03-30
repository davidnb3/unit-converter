// ─── Inline chroma extraction — zero-dependency Meyda equivalent ──────────────
//
// Ports the exact pipeline Meyda v5 uses for the 'chroma' feature:
//   Hanning window → Cooley-Tukey FFT → amplitude spectrum
//   → Gaussian-weighted chroma filter bank → per-frame normalised chroma
//
// Drop-in replacement for Meyda.extract('chroma', frame).
// The exported buildChromaInline() returns the same Float64Array(12) that
// keyDetector.js accumulates, so the rest of the pipeline is unchanged.

// ─── Cooley-Tukey radix-2 FFT ─────────────────────────────────────────────────
// Returns { real, imag } — same shape as fftjs (which Meyda uses internally).
function fft(signal) {
  const n  = signal.length;
  const re = new Float64Array(signal); // copy
  const im = new Float64Array(n);

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cRe = 1, cIm = 0;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j],       uIm = im[i + j];
        const vRe = re[i+j+half]*cRe - im[i+j+half]*cIm;
        const vIm = re[i+j+half]*cIm + im[i+j+half]*cRe;
        re[i+j]       = uRe + vRe;  im[i+j]       = uIm + vIm;
        re[i+j+half]  = uRe - vRe;  im[i+j+half]  = uIm - vIm;
        const nCRe = cRe*wRe - cIm*wIm;
        cIm = cRe*wIm + cIm*wRe;
        cRe = nCRe;
      }
    }
  }
  return { real: re, imag: im };
}

// ─── Hanning window ────────────────────────────────────────────────────────────
function hanningWindow(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
  return w;
}

// ─── Chroma filter bank helpers ────────────────────────────────────────────────
// Direct port of Meyda's utilities.ts: hzToOctaves, normalizeByColumn,
// and createChromaFilterBank (with identical default parameters).

function hzToOctaves(freq, A440 = 440) {
  return Math.log2((16 * freq) / A440);
}

function normalizeByColumn(weights) {
  const numBins = weights[0].length;
  const colNorms = new Array(numBins).fill(0);
  for (const row of weights) row.forEach((v, j) => { colNorms[j] += v * v; });
  colNorms.forEach((v, j) => { colNorms[j] = Math.sqrt(v) || 1; });
  return weights.map(row => row.map((v, j) => v / colNorms[j]));
}

function createChromaFilterBank(sampleRate, bufferSize, A440 = 440, centerOctave = 5, octaveWidth = 2) {
  const numFilters    = 12;
  const numOutputBins = Math.floor(bufferSize / 2) + 1;
  const halfNumFilters = Math.round(numFilters / 2);

  // Log-frequency position of each FFT bin, expressed in chroma-bin units
  const frequencyBins = new Array(bufferSize).fill(0).map(
    (_, i) => numFilters * hzToOctaves((sampleRate * i) / bufferSize, A440)
  );
  // DC bin: 1.5 chroma-bins below bin 1 (Meyda convention)
  frequencyBins[0] = frequencyBins[1] - 1.5 * numFilters;

  // Width of each FFT bin in chroma-bin units (clamped to ≥1)
  const binWidthBins = frequencyBins
    .slice(1)
    .map((v, i) => Math.max(v - frequencyBins[i], 1))
    .concat([1]);

  // Gaussian-weighted distances from each FFT bin to each chroma centre
  let weights = new Array(numFilters).fill(null).map((_, i) => {
    const filterPeaks = frequencyBins.map(frq =>
      ((10 * numFilters + halfNumFilters + frq - i) % numFilters) - halfNumFilters
    );
    return filterPeaks.map((peak, j) =>
      Math.exp(-0.5 * Math.pow((2 * peak) / binWidthBins[j], 2))
    );
  });

  weights = normalizeByColumn(weights);

  // Octave Gaussian: de-emphasise very low and very high octaves
  if (octaveWidth) {
    const octaveWeights = frequencyBins.map(v =>
      Math.exp(-0.5 * Math.pow((v / numFilters - centerOctave) / octaveWidth, 2))
    );
    weights = weights.map(row => row.map((v, j) => v * octaveWeights[j]));
  }

  // Rotate by 3 so that index 0 = C  (Meyda's baseC = true)
  weights = [...weights.slice(3), ...weights.slice(0, 3)];

  return weights.map(row => row.slice(0, numOutputBins));
}

// Cache filter banks so they're only computed once per (sampleRate, fftSize) pair
const filterBankCache = new Map();

// ─── Public API ────────────────────────────────────────────────────────────────
/**
 * Build an accumulated chromagram from a mono PCM buffer.
 *
 * Replicates exactly what keyDetector.js does with Meyda.extract('chroma'):
 * processes overlapping frames, normalises each frame to [0,1], accumulates.
 *
 * @param {Float32Array} mono          Mono PCM samples
 * @param {number}       sampleRate
 * @param {number}       analyseLength Number of samples to analyse
 * @param {number}       [fftSize=4096]
 * @returns {Float64Array}             12-bin chroma vector (C … B), unnormalised sum
 */
export function buildChromaInline(mono, sampleRate, analyseLength, fftSize = 4096) {
  const hop = fftSize >> 1;
  const numOutputBins = Math.floor(fftSize / 2) + 1;

  const cacheKey = `${sampleRate}:${fftSize}`;
  if (!filterBankCache.has(cacheKey)) {
    filterBankCache.set(cacheKey, createChromaFilterBank(sampleRate, fftSize));
  }
  const filterBank = filterBankCache.get(cacheKey);

  const hann  = hanningWindow(fftSize);
  const chroma = new Float64Array(12);

  for (let start = 0; start + fftSize <= analyseLength; start += hop) {
    // Window the frame
    const windowed = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) windowed[i] = mono[start + i] * hann[i];

    // FFT → amplitude spectrum (first half only)
    const { real, imag } = fft(windowed);
    const ampSpectrum = new Float32Array(numOutputBins);
    for (let i = 0; i < numOutputBins; i++) {
      ampSpectrum[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }

    // Dot-product with each chroma filter row
    const frameChroma = filterBank.map(row =>
      ampSpectrum.reduce((acc, v, j) => acc + v * row[j], 0)
    );

    // Per-frame normalise to [0, 1] — mirrors Meyda's chroma.ts output
    const maxVal = Math.max(...frameChroma);
    if (maxVal > 0) {
      for (let i = 0; i < 12; i++) chroma[i] += frameChroma[i] / maxVal;
    }
  }

  return chroma;
}
