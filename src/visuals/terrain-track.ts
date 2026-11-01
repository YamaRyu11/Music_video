import { FEATURE_STRIDE, type Analysis } from '../shared';

/** Track-derived world coordinates. Terrain is pinned to distance, not frame count. */
export interface TerrainTrack {
  seed: number;
  timbre: number;
  duration: number;
  rate: number;
  travel: Float32Array;
  left: Float32Array;
  right: Float32Array;
  rhythm: Float32Array;
}
export interface TerrainMood { left: number; right: number; rhythm: number }
const RATE = 12;
const cache = new WeakMap<Analysis, TerrainTrack>();
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function buildTerrainTrack(analysis: Analysis): TerrainTrack {
  const frames = analysis.data.length / FEATURE_STRIDE;
  const count = Math.max(2, Math.ceil(analysis.duration * RATE) + 1);
  const travel = new Float32Array(count), left = new Float32Array(count);
  const right = new Float32Array(count), rhythm = new Float32Array(count);
  let seed = 2166136261, spectralWeight = 0, spectralTotal = 0;
  // Quantized audio features make the same decoded music produce the same world.
  for (let frame = 0; frame < frames; frame++) {
    const offset = frame * FEATURE_STRIDE;
    for (let k = 0; k < FEATURE_STRIDE; k++) {
      const value = analysis.data[offset + k];
      seed = Math.imul(seed ^ Math.round(value * 255), 16777619);
      if (k >= 4) { spectralWeight += value * (k - 4) / 47; spectralTotal += value; }
    }
  }
  for (let i = 0; i < count; i++) {
    const first = Math.min(frames - 1, Math.floor(i * analysis.fps / RATE));
    const last = Math.min(frames, Math.max(first + 1, Math.floor((i + 1) * analysis.fps / RATE)));
    let low = 0, high = 0, bass = 0, treble = 0, level = 0, onset = 0;
    for (let frame = first; frame < last; frame++) {
      const offset = frame * FEATURE_STRIDE;
      level += analysis.data[offset]; bass += analysis.data[offset + 1]; treble += analysis.data[offset + 2];
      onset = Math.max(onset, analysis.data[offset + 3]);
      for (let band = 0; band < 18; band++) low += analysis.data[offset + 4 + band] / 18;
      for (let band = 18; band < 42; band++) high += analysis.data[offset + 4 + band] / 24;
    }
    const n = last - first;
    const l = clamp((low * .72 + bass * .28) / n);
    const r = clamp((high * .68 + treble * .22 + level * .1) / n);
    left[i] = i ? lerp(left[i - 1], l, .2) : l;
    right[i] = i ? lerp(right[i - 1], r, .2) : r;
    rhythm[i] = i ? Math.max(onset, rhythm[i - 1] * .73) : onset;
    if (i) travel[i] = travel[i - 1] + (4.5 + level / n * .8 + rhythm[i] * 1.2) / RATE;
  }
  return { seed: seed >>> 0, timbre: spectralTotal ? spectralWeight / spectralTotal : .5,
    duration: analysis.duration, rate: RATE, travel, left, right, rhythm };
}

const fallback: TerrainTrack = {
  seed: 2083, timbre: .45, duration: 120, rate: RATE,
  travel: Float32Array.from({ length: 1441 }, (_, i) => i * 4.8 / RATE),
  left: new Float32Array(1441).fill(.35), right: new Float32Array(1441).fill(.46), rhythm: new Float32Array(1441),
};

export function getTerrainTrack(analysis?: Analysis): TerrainTrack {
  if (!analysis) return fallback;
  let value = cache.get(analysis);
  if (!value) { value = buildTerrainTrack(analysis); cache.set(analysis, value); }
  return value;
}

/** Continuous camera travel; never integrate animation frames during rendering. */
export function travelAt(track: TerrainTrack, seconds: number): number {
  const t = Math.max(0, seconds) * track.rate, index = Math.floor(t), last = track.travel.length - 1;
  if (index >= last) {
    const speed = (track.travel[last] - track.travel[last - 1]) * track.rate;
    return track.travel[last] + (t - last) / track.rate * speed;
  }
  return lerp(track.travel[index], track.travel[index + 1], t - index);
}

/** The mood at a world point stays fixed as the camera approaches and passes it. */
export function moodAtDistance(track: TerrainTrack, distance: number): TerrainMood {
  const last = track.travel.length - 1;
  let lo = 0, hi = last;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1;
    if (track.travel[mid] <= distance) lo = mid; else hi = mid;
  }
  const fraction = clamp((distance - track.travel[lo]) / Math.max(.001, track.travel[hi] - track.travel[lo]));
  return { left: lerp(track.left[lo], track.left[hi], fraction),
    right: lerp(track.right[lo], track.right[hi], fraction), rhythm: lerp(track.rhythm[lo], track.rhythm[hi], fraction) };
}
