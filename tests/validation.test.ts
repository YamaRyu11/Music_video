import { describe, expect, it } from 'vitest';
import { validateExport } from '../electron/validation';
import { defaultSettings, FEATURE_STRIDE, STYLE_IDS, type ExportSpec } from '../src/shared';

function spec(): ExportSpec {
  return { assetId: 'test', settings: structuredClone(defaultSettings), analysis: { duration: 1, fps: 60, data: new Float32Array(60 * FEATURE_STRIDE), peaks: [] } };
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
  it('accepts every style with independently styled text and a valid overlay', () => {
    for (const style of STYLE_IDS) {
      const value = spec(); value.settings.style = style;
      value.settings.overlay = { style: 'wave', color: '#ff95b5', opacity: .65, blend: 'screen' };
      value.settings.titleDesign = { ...value.settings.titleDesign, font: 'serif', size: 96, italic: true, weight: 700 };
      expect(() => validateExport(value)).not.toThrow();
    }
  });
  it('rejects untrusted fonts, invalid blend modes and out-of-range visual controls', () => {
    const cases: ((value: ExportSpec) => void)[] = [
      v => { v.settings.titleDesign.size = 0; },
      v => { v.settings.artistDesign.y = NaN; },
      v => { v.settings.titleDesign.font = 'url(external)' as never; },
      v => { v.settings.overlay.blend = 'copy' as never; },
      v => { v.settings.overlay.opacity = 1.5; },
      v => { v.settings.overlay.style = 'unknown' as never; },
      v => { v.settings.secondaryColor = 'red'; },
      v => { v.settings.backgroundColor = 'transparent'; },
      v => { v.settings.brightness = Infinity; },
      v => { v.settings.saturation = -1; },
      v => { v.settings.glow = 2; },
    ];
    for (const mutate of cases) { const value = spec(); mutate(value); expect(() => validateExport(value)).toThrow(); }
  });
  it('accepts 1000% response, 200% smoothing and a transformed bitmap', () => {
    const value = spec(); value.settings.intensity = 10; value.settings.smoothing = 2;
    value.bitmapId = 'imported-local-image';
    value.settings.bitmap = { enabled: true, fit: 'contain', scale: 5, x: -1, y: 1, rotation: 180,
      crop: { left: .5, right: .45, top: .2, bottom: .3 }, opacity: .4, blur: 80, saturation: 0, brightness: 2 };
    expect(() => validateExport(value)).not.toThrow();
  });
  it('rejects invalid bitmap geometry, filters and expanded range overflow', () => {
    const cases: ((value: ExportSpec) => void)[] = [
      v => { v.settings.intensity = 10.01; }, v => { v.settings.smoothing = 2.01; },
      v => { v.settings.bitmap.crop.left = .6; v.settings.bitmap.crop.right = .4; },
      v => { v.settings.bitmap.crop.top = -.01; }, v => { v.settings.bitmap.blur = 81; },
      v => { v.settings.bitmap.scale = 0; }, v => { v.settings.bitmap.brightness = NaN; },
      v => { v.settings.bitmap.fit = 'external-url' as never; }, v => { v.settings.bitmap.opacity = 2; },
      v => { v.bitmapId = {} as never; },
    ];
    for (const mutate of cases) { const value = spec(); mutate(value); expect(() => validateExport(value)).toThrow(); }
  });
});
