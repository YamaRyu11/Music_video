import { FEATURE_STRIDE, MAX_DURATION, STYLE_IDS, type ExportSpec, type TextDesign } from '../src/shared';

const hex = (value: unknown) => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value);
const range = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
function validText(t: TextDesign) {
  return t && range(t.size, 14, 160) && hex(t.color) && ['sans', 'serif', 'mono', 'meiryo'].includes(t.font)
    && [400, 700].includes(t.weight) && typeof t.italic === 'boolean' && typeof t.shadow === 'boolean'
    && typeof t.visible === 'boolean' && ['left', 'center', 'right'].includes(t.align) && range(t.y, 0.08, 0.92);
}

/** Reject malformed IPC payloads before spawning a process or allocating frames. */
export function validateExport(spec: ExportSpec): void {
  if (!spec || typeof spec.assetId !== 'string') throw new Error('音源を選び直してください。');
  const s = spec.settings, a = spec.analysis;
  if (!s || !STYLE_IDS.includes(s.style) || !['portrait', 'landscape'].includes(s.aspect)
    || !hex(s.color) || !hex(s.secondaryColor) || !hex(s.backgroundColor)
    || !range(s.brightness, 0.5, 1.5) || !range(s.saturation, 0, 2) || !range(s.glow, 0, 1)
    || !s.overlay || !['none', ...STYLE_IDS].includes(s.overlay.style) || !hex(s.overlay.color)
    || !range(s.overlay.opacity, 0, 1) || !['source-over', 'screen', 'lighter', 'multiply'].includes(s.overlay.blend)
    || !validText(s.titleDesign) || !validText(s.artistDesign)
    || !Number.isFinite(s.intensity) || s.intensity < 0 || s.intensity > 2
    || !Number.isFinite(s.smoothing) || s.smoothing < 0 || s.smoothing > 1
    || typeof s.title !== 'string' || s.title.length > 100 || typeof s.artist !== 'string' || s.artist.length > 100) {
    throw new Error('映像設定を確認してください。');
  }
  if (!a || !Number.isFinite(a.duration) || a.duration <= 0 || a.duration > MAX_DURATION || a.fps !== 60
    || !(a.data instanceof Float32Array) || a.data.length !== Math.ceil(a.duration * a.fps) * FEATURE_STRIDE
    || !a.data.every(v => Number.isFinite(v) && v >= 0 && v <= 1)) {
    throw new Error('音声解析データが正しくありません。音源を読み込み直してください。');
  }
}
