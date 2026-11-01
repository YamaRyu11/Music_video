import { describe, expect, it } from 'vitest';
import { FEATURE_STRIDE, type Analysis } from '../src/shared';
import { buildTerrainTrack, getTerrainTrack, moodAtDistance, travelAt } from '../src/visuals/terrain-track';

function track(kind: 'silence' | 'low' | 'high' | 'rhythmic', seconds = 3): Analysis {
  const data = new Float32Array(Math.ceil(seconds * 60) * FEATURE_STRIDE);
  for (let frame = 0; frame < data.length / FEATURE_STRIDE; frame++) {
    const o = frame * FEATURE_STRIDE;
    if (kind === 'silence') continue;
    data[o] = .5;
    data[o + 1] = kind === 'low' ? .85 : .15;
    data[o + 2] = kind === 'high' ? .85 : .15;
    data[o + 3] = kind === 'rhythmic' && frame % 30 < 3 ? .9 : 0;
    for (let band = 0; band < 48; band++) data[o + 4 + band] = kind === 'low' ? (band < 18 ? .85 : .05)
      : kind === 'high' ? (band >= 18 ? .8 : .05) : .35;
  }
  return { duration: seconds, fps: 60, data, peaks: [] };
}

describe('track-pinned wireframe world', () => {
  it('derives the same world from the same audio regardless of object identity', () => {
    const a = buildTerrainTrack(track('low')), b = buildTerrainTrack(track('low'));
    expect(a).toEqual(b);
    expect(a.seed).not.toBe(buildTerrainTrack(track('high')).seed);
    expect(a.timbre).toBeLessThan(buildTerrainTrack(track('high')).timbre);
  });
  it('drives opposite hills independently from low and upper frequency bands', () => {
    const low = buildTerrainTrack(track('low')), high = buildTerrainTrack(track('high'));
    const a = moodAtDistance(low, travelAt(low, 1)), b = moodAtDistance(high, travelAt(high, 1));
    expect(a.left).toBeGreaterThan(a.right * 3);
    expect(b.right).toBeGreaterThan(b.left * 3);
  });
  it('retains rhythm and earlier timbre even when the current sound matches', () => {
    const a = track('low'), b = track('high');
    const matching = track('silence');
    a.data.set(matching.data.subarray(120 * FEATURE_STRIDE), 120 * FEATURE_STRIDE);
    b.data.set(matching.data.subarray(120 * FEATURE_STRIDE), 120 * FEATURE_STRIDE);
    expect(a.data.subarray(150 * FEATURE_STRIDE)).toEqual(b.data.subarray(150 * FEATURE_STRIDE));
    expect(buildTerrainTrack(a).seed).not.toBe(buildTerrainTrack(b).seed);
    const rhythmicAudio = track('rhythmic');
    const noOnsets = { ...rhythmicAudio, data: rhythmicAudio.data.slice() };
    for (let frame = 0; frame < noOnsets.data.length / FEATURE_STRIDE; frame++) noOnsets.data[frame * FEATURE_STRIDE + 3] = 0;
    const rhythm = buildTerrainTrack(rhythmicAudio);
    expect(Math.max(...rhythm.rhythm)).toBeGreaterThan(.8);
    expect(travelAt(rhythm, 2)).toBeGreaterThan(travelAt(buildTerrainTrack(noOnsets), 2));
  });
  it('has continuous forward travel and stable world samples after seeking', () => {
    const value = buildTerrainTrack(track('rhythmic'));
    for (let i = 1; i < value.travel.length; i++) expect(value.travel[i]).toBeGreaterThan(value.travel[i - 1]);
    expect(travelAt(value, 1 + 1e-5) - travelAt(value, 1)).toBeLessThan(.001);
    const sample = moodAtDistance(value, 8.2);
    travelAt(value, 100); moodAtDistance(value, 1200);
    expect(moodAtDistance(value, 8.2)).toEqual(sample);
    expect(Number.isFinite(travelAt(value, 100))).toBe(true);
    expect(Object.values(moodAtDistance(value, -1)).every(Number.isFinite)).toBe(true);
  });
  it('caches immutable analysis and supports silence, short sounds and previews', () => {
    const audio = track('silence', 1 / 60);
    expect(getTerrainTrack(audio)).toBe(getTerrainTrack(audio));
    expect(getTerrainTrack().travel.length).toBeGreaterThan(1);
    const value = buildTerrainTrack(audio);
    expect(value.left.every(n => n === 0)).toBe(true);
    expect(value.right.every(n => n === 0)).toBe(true);
    expect(Number.isFinite(travelAt(value, 1))).toBe(true);
  });
});
