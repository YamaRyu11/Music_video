import { FEATURE_STRIDE, MAX_DURATION, MAX_INTENSITY, MAX_SMOOTHING, MIN_LINE_WIDTH, MAX_LINE_WIDTH, STYLE_IDS, type BitmapSettings, type ExportSpec, type TextDesign, type LayerControls } from '../src/shared';

const hex = (value: unknown) => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value);
const range = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
function validLayer(s: LayerControls) {
  return s && range(s.opacity, 0, 1) && ['source-over', 'screen', 'lighter', 'multiply'].includes(s.blend) && hex(s.color) && hex(s.secondaryColor)
    && range(s.brightness, .5, 1.5) && range(s.saturation, 0, 2) && range(s.glow, 0, 1)
    && range(s.intensity, 0, MAX_INTENSITY) && range(s.smoothing, 0, MAX_SMOOTHING)
    && range(s.lineWidth, MIN_LINE_WIDTH, MAX_LINE_WIDTH);
}
function validText(t: TextDesign) {
  return t && range(t.size, 14, 160) && hex(t.color) && ['sans', 'serif', 'mono', 'meiryo'].includes(t.font)
    && [400, 700].includes(t.weight) && typeof t.italic === 'boolean' && typeof t.shadow === 'boolean'
    && typeof t.visible === 'boolean' && ['left', 'center', 'right'].includes(t.align) && range(t.y, 0.08, 0.92);
}
function validBitmap(b: BitmapSettings) {
  return b && typeof b.enabled === 'boolean' && ['cover', 'contain'].includes(b.fit)
    && range(b.scale, .1, 5) && range(b.x, -1, 1) && range(b.y, -1, 1) && range(b.rotation, -180, 180)
    && range(b.opacity, 0, 1) && range(b.blur, 0, 80) && range(b.saturation, 0, 2) && range(b.brightness, 0, 2)
    && b.crop && ['left', 'right', 'top', 'bottom'].every(k => range(b.crop[k as keyof typeof b.crop], 0, .95))
    && b.crop.left + b.crop.right <= .95 + 1e-9 && b.crop.top + b.crop.bottom <= .95 + 1e-9;
}

/** Reject malformed IPC payloads before spawning a process or allocating frames. */
export function validateExport(spec: ExportSpec): void {
  if (!spec || typeof spec.assetId !== 'string') throw new Error('音源を選び直してください。');
  if (spec.bitmapId !== undefined && (typeof spec.bitmapId !== 'string' || spec.bitmapId.length > 128)) throw new Error('背景画像を読み込み直してください。');
  const s = spec.settings, a = spec.analysis;
  if (!s || !STYLE_IDS.includes(s.style) || !['portrait', 'landscape'].includes(s.aspect)
    || !validLayer(s) || !hex(s.backgroundColor)
    || !validLayer(s.overlay) || !['none', ...STYLE_IDS].includes(s.overlay.style)
    || !range(s.overlay.opacity, 0, 1) || !['source-over', 'screen', 'lighter', 'multiply'].includes(s.overlay.blend)
    || !validText(s.titleDesign) || !validText(s.artistDesign) || !validBitmap(s.bitmap)
    || typeof s.title !== 'string' || s.title.length > 100 || typeof s.artist !== 'string' || s.artist.length > 100) {
    throw new Error('映像設定を確認してください。');
  }
  if (!a || !Number.isFinite(a.duration) || a.duration <= 0 || a.duration > MAX_DURATION || a.fps !== 60
    || !(a.data instanceof Float32Array) || a.data.length !== Math.ceil(a.duration * a.fps) * FEATURE_STRIDE
    || !a.data.every(v => Number.isFinite(v) && v >= 0 && v <= 1)) {
    throw new Error('音声解析データが正しくありません。音源を読み込み直してください。');
  }
}
