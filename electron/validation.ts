import { FEATURE_STRIDE, MAX_DURATION, type ExportSpec } from '../src/shared';

/** Reject malformed IPC payloads before spawning a process or allocating frames. */
export function validateExport(spec: ExportSpec): void {
  if (!spec || typeof spec.assetId !== 'string') throw new Error('音源を選び直してください。');
  const s = spec.settings, a = spec.analysis;
  if (!s || !['orbit', 'spectrum', 'particles'].includes(s.style) || !['portrait', 'landscape'].includes(s.aspect)
    || !/^#[a-f\d]{6}$/i.test(s.color) || !Number.isFinite(s.intensity) || s.intensity < 0 || s.intensity > 2
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
