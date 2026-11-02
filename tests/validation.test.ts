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
      value.settings.overlay = { ...value.settings.overlay, style: 'wave', color: '#ff95b5', opacity: .65, blend: 'screen' };
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
  it('accepts independent overlay controls and both stroke-width limits', () => {
    const value = spec(); value.settings.lineWidth = .1;
    Object.assign(value.settings.overlay, { style: 'wave', color: '#ff245f', secondaryColor: '#79acff',
      brightness: .5, saturation: 0, glow: 0, intensity: 10, smoothing: 2, lineWidth: 5 });
    expect(() => validateExport(value)).not.toThrow();
    value.settings.lineWidth = 5; value.settings.overlay.lineWidth = .1;
    expect(() => validateExport(value)).not.toThrow();
  });
  it('rejects malformed controls in either graphics layer, including hidden overlays', () => {
    const invalid = { secondaryColor: 'external(url)', brightness: 0, saturation: 2.01, glow: Infinity,
      intensity: 10.01, smoothing: 2.01, lineWidth: 0 };
    for (const target of ['base', 'overlay'] as const) for (const [key, bad] of Object.entries(invalid)) {
      const value = spec(); const layer = target === 'base' ? value.settings : value.settings.overlay;
      Object.assign(layer, { [key]: bad });
      expect(() => validateExport(value)).toThrow();
    }
    for (const lineWidth of [NaN, Infinity, -.1, 5.01]) {
      const value = spec(); value.settings.overlay.lineWidth = lineWidth;
      expect(() => validateExport(value)).toThrow();
    }
  });
  it('validates base blend and opacity at the export boundary', () => {
    for (const opacity of [NaN, Infinity, -0.1, 1.1]) {
      const value=spec(); value.settings.opacity=opacity; expect(()=>validateExport(value)).toThrow();
    }
    const bad=spec(); bad.settings.blend='copy' as never; expect(()=>validateExport(bad)).toThrow();
    const valid=spec(); valid.settings.opacity=0;valid.settings.blend='multiply';expect(()=>validateExport(valid)).not.toThrow();
  });

  it('accepts independent transforms and rejects unsafe transforms in either layer', () => {
    const value=spec();Object.assign(value.settings,{scaleX:.1,scaleY:5,scaleLocked:true,x:-1,y:1});
    Object.assign(value.settings.overlay,{scaleX:5,scaleY:.1,scaleLocked:true,x:1,y:-1});
    expect(()=>validateExport(value)).not.toThrow();
    for(const target of ['base','overlay']) for(const [key,v] of Object.entries({scaleX:0,scaleY:Infinity,x:1.1,y:NaN,scaleLocked:'true'})) {
      const bad=spec();Object.assign(target==='base'?bad.settings:bad.settings.overlay,{[key]:v});expect(()=>validateExport(bad)).toThrow();
    }
  });

  it('accepts independent glow settings and rejects malformed values in both layers',()=>{
    const valid=spec();Object.assign(valid.settings,{lineGlowEnabled:true,lineGlowStrength:3,lineGlowDistance:160});
    Object.assign(valid.settings.overlay,{lineGlowEnabled:false,lineGlowStrength:0,lineGlowDistance:0});expect(()=>validateExport(valid)).not.toThrow();
    for(const target of ['base','overlay']) for(const invalid of [{lineGlowEnabled:'true'},{lineGlowStrength:3.01},{lineGlowStrength:NaN},{lineGlowDistance:-1},{lineGlowDistance:Infinity},{lineGlowDistance:160.1}]){
      const bad=spec();Object.assign(target==='base'?bad.settings:bad.settings.overlay,invalid);expect(()=>validateExport(bad)).toThrow();
    }
  });

  it('accepts independent Gaussian blur/backdrops and rejects malformed controls in either layer',()=>{
    const valid=spec();valid.settings.blur=80;valid.settings.fillBackground=true;valid.settings.overlay.blur=0;valid.settings.overlay.fillBackground=false;expect(()=>validateExport(valid)).not.toThrow();
    for(const target of ['base','overlay'])for(const invalid of [{blur:-1},{blur:80.1},{blur:Infinity},{blur:NaN},{fillBackground:'true'}]){
      const bad=spec();Object.assign(target==='base'?bad.settings:bad.settings.overlay,invalid);expect(()=>validateExport(bad)).toThrow();
    }
  });

  it('validates export options and horizontal text positions',()=>{
    const valid=spec();valid.encoding={mode:'bitrate',crf:20,videoBitrate:8,audioBitrate:320,preset:'medium'};valid.settings.titleDesign.x=.3;expect(()=>validateExport(valid)).not.toThrow();
    const bad=spec();bad.encoding={...valid.encoding,preset:'evil' as never};expect(()=>validateExport(bad)).toThrow();
    const text=spec();text.settings.artistDesign.x=Infinity;expect(()=>validateExport(text)).toThrow();
  });

});
