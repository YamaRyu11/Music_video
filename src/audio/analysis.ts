import { ANALYSIS_FPS, BAND_COUNT, FEATURE_STRIDE, MAX_SMOOTHING, type Analysis } from '../shared';

const FFT_SIZE = 2048;
const clamp = (x: number) => Math.max(0, Math.min(1, x));

/** In-place radix-2 FFT. Returns calibrated positive-frequency magnitudes. */
export function spectrum(samples: Float32Array): Float32Array {
  const n = samples.length;
  if (n < 2 || (n & (n - 1)) !== 0) throw new Error('FFT size must be a power of two');
  const re = Float64Array.from(samples);
  const im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const theta = -2 * Math.PI / len;
    for (let start = 0; start < n; start += len) {
      for (let j = 0; j < len / 2; j++) {
        const c = Math.cos(theta * j), s = Math.sin(theta * j);
        const a = start + j, b = a + len / 2;
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
  return Float32Array.from({ length: n / 2 }, (_, i) => Math.hypot(re[i], im[i]) * 2 / n);
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  values.sort((a, b) => a - b);
  return values[Math.min(values.length - 1, Math.floor(values.length * p))];
}

/** Offline, centered windows keep preview and exported frames on the same clock. */
export function analyzeAudio(channels: Float32Array[], sampleRate: number, onProgress?: (n: number) => void): Analysis {
  if (!channels.length || !channels[0].length || sampleRate < 8000) throw new Error('音声データを解析できませんでした。');
  const length = channels[0].length, duration = length / sampleRate;
  const count = Math.ceil(duration * ANALYSIS_FPS);
  const data = new Float32Array(count * FEATURE_STRIDE);
  const window = Float32Array.from({ length: FFT_SIZE }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
  const chunk = new Float32Array(FFT_SIZE);
  const previous = new Float32Array(FFT_SIZE / 2);
  const levels: number[] = [], attacks: number[] = [], bands: number[] = [];
  // RMS across channels avoids cancelling out-of-phase stereo signals.
  for (let frame = 0; frame < count; frame++) {
    const center = Math.floor(frame * sampleRate / ANALYSIS_FPS);
    const mag = new Float32Array(FFT_SIZE / 2);
    let sum = 0;
    for (const channel of channels) {
      for (let i = 0; i < FFT_SIZE; i++) {
        const v = channel[center + i - FFT_SIZE / 2] ?? 0;
        sum += v * v;
        chunk[i] = v * window[i];
      }
      const channelMag = spectrum(chunk);
      for (let i = 0; i < mag.length; i++) mag[i] += channelMag[i] / channels.length;
    }
    const offset = frame * FEATURE_STRIDE;
    const level = Math.sqrt(sum / (FFT_SIZE * channels.length));
    data[offset] = level; levels.push(level);
    let flux = 0;
    for (let i = 1; i < mag.length; i++) {
      flux += Math.max(0, mag[i] - previous[i]);
      previous[i] = mag[i];
    }
    data[offset + 3] = flux; attacks.push(flux);
    for (let band = 0; band < BAND_COUNT; band++) {
      const lo = 40 * (Math.min(16000, sampleRate / 2) / 40) ** (band / BAND_COUNT);
      const hi = 40 * (Math.min(16000, sampleRate / 2) / 40) ** ((band + 1) / BAND_COUNT);
      const first = Math.max(1, Math.floor(lo * FFT_SIZE / sampleRate));
      const last = Math.min(mag.length - 1, Math.max(first, Math.floor(hi * FFT_SIZE / sampleRate)));
      let energy = 0;
      for (let bin = first; bin <= last; bin++) energy += mag[bin] ** 2;
      const value = Math.sqrt(energy / (last - first + 1));
      data[offset + 4 + band] = value;
      if (frame % 4 === 0) bands.push(value);
    }
    if (frame % 60 === 0) onProgress?.(frame / count);
  }
  const levelRef = Math.max(0.02, percentile(levels, 0.95));
  const bandRef = Math.max(0.01, percentile(bands, 0.98));
  const attackRef = Math.max(0.03, percentile(attacks, 0.98));
  for (let frame = 0; frame < count; frame++) {
    const o = frame * FEATURE_STRIDE;
    data[o] = clamp(data[o] / levelRef);
    data[o + 3] = clamp(data[o + 3] / attackRef);
    let bass = 0, treble = 0;
    for (let b = 0; b < BAND_COUNT; b++) {
      const value = clamp(Math.sqrt(data[o + 4 + b] / bandRef));
      data[o + 4 + b] = value;
      if (b < 16) bass += value / 16;
      if (b >= 32) treble += value / 16;
    }
    data[o + 1] = bass; data[o + 2] = treble;
  }
  const peaks = Array.from({ length: 180 }, (_, i) => {
    const start = Math.floor(i * count / 180), end = Math.max(start + 1, Math.floor((i + 1) * count / 180));
    let peak = 0;
    for (let f = start; f < Math.min(end, count); f++) peak = Math.max(peak, data[f * FEATURE_STRIDE]);
    return peak;
  });
  onProgress?.(1);
  return { duration, fps: ANALYSIS_FPS, data, peaks };
}

export interface Features { level: number; bass: number; treble: number; attack: number; bands: number[] }
export function sampleFeatures(analysis: Analysis, seconds: number, smoothing: number): Features {
  const count = analysis.data.length / FEATURE_STRIDE;
  const position = Math.max(0, Math.min(count - 1, seconds * analysis.fps));
  const index = Math.floor(position), frac = position - index;
  const values = new Float64Array(FEATURE_STRIDE);
  const history = Math.round(2 + Math.max(0, Math.min(MAX_SMOOTHING, smoothing)) * 18);
  let total = 0;
  for (let back = 0; back <= history; back++) {
    const weight = Math.exp(-back / Math.max(1, history / 3)); total += weight;
    const a = Math.max(0, index - back) * FEATURE_STRIDE;
    const b = Math.min(count - 1, Math.max(0, index - back + 1)) * FEATURE_STRIDE;
    for (let k = 0; k < FEATURE_STRIDE; k++) values[k] += (analysis.data[a + k] * (1 - frac) + analysis.data[b + k] * frac) * weight;
  }
  return { level: values[0] / total, bass: values[1] / total, treble: values[2] / total,
    attack: values[3] / total, bands: Array.from(values.slice(4), v => v / total) };
}
