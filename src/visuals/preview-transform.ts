import type { VisualSettings } from '../shared';
import { linkedScale } from './scale-lock';
export type PreviewTarget = 'base' | 'overlay' | 'bitmap' | 'titleDesign' | 'artistDesign';
export interface GestureDelta {
  dx: number;
  dy: number;
  button: number;
  shift: boolean;
  axis?: 'x' | 'y';
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** dx/dy are fractions of the displayed canvas, independent of its resolution. */
export function transformed(s: VisualSettings, target: PreviewTarget, d: GestureDelta): VisualSettings {
  const layer = target === 'base' ? s : s[target];
  let patch: Record<string, number>;
  const text = target === 'titleDesign' || target === 'artistDesign';
  if (d.button === 0) {
    const dx = d.shift && d.axis === 'y' ? 0 : d.dx, dy = d.shift && d.axis === 'x' ? 0 : d.dy;
    patch = { x: clamp(layer.x + dx * 2, -1, 1), y: clamp(layer.y + dy * (text ? 1 : 2), text ? .08 : -1, text ? .92 : 1) };
  }
  else {
    const factor = Math.exp(clamp(d.dx - d.dy, -5, 5));
    if (text)
      patch = { size: clamp(s[target].size * factor, 14, 160) };
    else if (target === 'bitmap')
      patch = { scale: clamp(s.bitmap.scale * factor, .1, 5) };
    else {
      const controls = target === 'base' ? s : s.overlay;
      if (d.shift || controls.scaleLocked)
        patch = linkedScale({ ...controls, scaleLocked: true }, 'scaleX', controls.scaleX * factor) as Record<string, number>;
      else
        patch = { scaleX: clamp(controls.scaleX * Math.exp(clamp(d.dx * 2, -5, 5)), .1, 5), scaleY: clamp(controls.scaleY * Math.exp(clamp(-d.dy * 2, -5, 5)), .1, 5) };
    }
  }
  return target === 'base' ? { ...s, ...patch } : { ...s, [target]: { ...s[target], ...patch } };
}
export function applyTransform(current: VisualSettings, source: VisualSettings, target: PreviewTarget): VisualSettings {
  const fields = target === 'bitmap' ? ['x', 'y', 'scale'] : target === 'titleDesign' || target === 'artistDesign' ? ['x', 'y', 'size'] : ['x', 'y', 'scaleX', 'scaleY'];
  const from = target === 'base' ? source : source[target];
  const values = Object.fromEntries(fields.map(k => [k, Reflect.get(from, k)]));
  return target === 'base' ? { ...current, ...values } : { ...current, [target]: { ...current[target], ...values } };
}
