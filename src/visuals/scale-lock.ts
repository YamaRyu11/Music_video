import type { LayerControls } from '../shared';
type Scale = Pick<LayerControls, 'scaleX' | 'scaleY' | 'scaleLocked'>;
type Axis = 'scaleX' | 'scaleY';
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** Both axes stop together at the limits, preserving even extreme non-square ratios. */
export function scaleLimits(s: Scale, axis: Axis) {
  if (!s.scaleLocked)
    return { min: .1, max: 5 };
  const factorMin = Math.max(.1 / s.scaleX, .1 / s.scaleY), factorMax = Math.min(5 / s.scaleX, 5 / s.scaleY);
  return { min: clamp(s[axis] * factorMin, .1, 5), max: clamp(s[axis] * factorMax, .1, 5) };
}
export function linkedScale(s: Scale, axis: Axis, value: number): Partial<Scale> {
  if (!s.scaleLocked)
    return { [axis]: clamp(value, .1, 5) };
  const limits = scaleLimits(s, axis), factor = clamp(value, limits.min, limits.max) / s[axis];
  return { scaleX: clamp(s.scaleX * factor, .1, 5), scaleY: clamp(s.scaleY * factor, .1, 5) };
}
