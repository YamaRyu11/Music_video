import { describe, expect, it } from 'vitest';
import { validateExport } from '../electron/validation';
import { defaultSettings, FEATURE_STRIDE, type ExportSpec } from '../src/shared';

function spec(): ExportSpec {
  return { assetId: 'test', settings: { ...defaultSettings }, analysis: { duration: 1, fps: 60, data: new Float32Array(60 * FEATURE_STRIDE), peaks: [] } };
}
describe('export IPC boundary', () => {
  it('accepts a valid analyzed timeline', () => expect(() => validateExport(spec())).not.toThrow());
  it('rejects invalid settings and corrupt/missing frames', () => {
    const invalid = spec(); invalid.settings.intensity = Infinity;
    expect(() => validateExport(invalid)).toThrow();
    const corrupt = spec(); corrupt.analysis.data[20] = NaN;
    expect(() => validateExport(corrupt)).toThrow();
    const short = spec(); short.analysis.duration = 2;
    expect(() => validateExport(short)).toThrow();
  });
  it('rejects oversized duration and unsafe color input', () => {
    const long = spec(); long.analysis.duration = 601;
    expect(() => validateExport(long)).toThrow();
    const color = spec(); color.settings.color = 'red; background: url(...)';
    expect(() => validateExport(color)).toThrow();
  });
});
