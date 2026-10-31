import { describe, expect, it } from 'vitest';
import { analyzeAudio, sampleFeatures, spectrum } from '../src/audio/analysis';
import { FEATURE_STRIDE } from '../src/shared';

const rate = 44100;
function tone(hz: number, seconds = 1, volume = 0.5) {
  return Float32Array.from({ length: Math.floor(rate * seconds) }, (_, i) => volume * Math.sin(2 * Math.PI * hz * i / rate));
}

describe('offline audio analysis', () => {
  it('locates the actual sinusoidal frequency with the FFT', () => {
    const values = Float32Array.from({ length: 2048 }, (_, i) => Math.sin(2 * Math.PI * 64 * i / 2048));
    const bins = spectrum(values);
    expect(bins.indexOf(Math.max(...bins))).toBe(64);
    expect(bins[64]).toBeCloseTo(1, 5);
  });
  it('keeps silence silent, including onsets and frequency bands', () => {
    const result = analyzeAudio([new Float32Array(rate)], rate);
    expect(result.duration).toBe(1);
    expect(result.data.length).toBe(60 * FEATURE_STRIDE);
    expect(result.data.every(v => v === 0)).toBe(true);
  });
  it('distinguishes bass from treble', () => {
    const low = sampleFeatures(analyzeAudio([tone(90)], rate), .5, 0);
    const high = sampleFeatures(analyzeAudio([tone(7000)], rate), .5, 0);
    expect(low.bass).toBeGreaterThan(low.treble * 3);
    expect(high.treble).toBeGreaterThan(high.bass * 3);
  });
  it('retains level changes and detects the onset after silence', () => {
    const pcm = tone(120, 2, .05);
    for (let i = rate; i < pcm.length; i++) pcm[i] *= 9;
    const result = analyzeAudio([pcm], rate);
    const quiet = sampleFeatures(result, .5, 0), loud = sampleFeatures(result, 1.5, 0);
    expect(loud.level).toBeGreaterThan(quiet.level * 5);
    const onset = Math.max(...Array.from({ length: 7 }, (_, i) => result.data[(60 - 3 + i) * FEATURE_STRIDE + 3]));
    expect(onset).toBeGreaterThan(.5);
    expect(sampleFeatures(result, 1.7, 0).attack).toBeLessThan(.1);
  });
  it('does not cancel out phase-inverted stereo audio', () => {
    const left = tone(220), right = Float32Array.from(left, v => -v);
    const result = sampleFeatures(analyzeAudio([left, right], rate), .5, .5);
    expect(result.level).toBeGreaterThan(.9);
    expect(Math.max(...result.bands)).toBeGreaterThan(.8);
  });
  it('samples deterministically and clamps timeline ends', () => {
    const result = analyzeAudio([tone(440)], rate);
    expect(sampleFeatures(result, .3, .5)).toEqual(sampleFeatures(result, .3, .5));
    expect(Number.isFinite(sampleFeatures(result, 1000, 1).level)).toBe(true);
    expect(Number.isFinite(sampleFeatures(result, -1, 1).bass)).toBe(true);
  });
});
