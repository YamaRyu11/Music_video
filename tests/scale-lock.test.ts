import { describe, it, expect } from 'vitest';
import { linkedScale, scaleLimits } from '../src/visuals/scale-lock';
describe('linked non-square style scales', () => {
  it('keeps the current ratio when either axis changes', () => {
    const s = { scaleX: 1.5, scaleY: .8, scaleLocked: true };
    expect(linkedScale(s, 'scaleX', 3)).toEqual({ scaleX: 3, scaleY: 1.6 });
    expect(linkedScale(s, 'scaleY', 1.6)).toEqual({ scaleX: 3, scaleY: 1.6 });
  });
  it('stops both axes at the upper and lower bounds without changing ratio', () => {
    const s = { scaleX: 2, scaleY: .5, scaleLocked: true };
    expect(linkedScale(s, 'scaleY', 5)).toEqual({ scaleX: 5, scaleY: 1.25 });
    const tiny = linkedScale(s, 'scaleX', .1);
    expect(tiny.scaleX).toBeCloseTo(.4);
    expect(tiny.scaleY).toBeCloseTo(.1);
    expect(scaleLimits(s, 'scaleX')).toEqual({ min: .4, max: 5 });
    expect(scaleLimits({ scaleX: 5, scaleY: .1, scaleLocked: true }, 'scaleY')).toEqual({ min: .1, max: .1 });
  });
  it('does not accumulate ratio drift across repeated adjustments', () => {
    let s = { scaleX: 1.333, scaleY: .777, scaleLocked: true };
    const ratio = s.scaleX / s.scaleY;
    for (let i = 0; i < 400; i++) {
      s = { ...s, ...linkedScale(s, i % 2 ? 'scaleY' : 'scaleX', .2 + (i % 47) / 10) };
      expect(s.scaleX / s.scaleY).toBeCloseTo(ratio, 12);
    }
  });
  it('changes only the chosen axis when unlocked', () => {
    expect(linkedScale({ scaleX: 1.5, scaleY: .8, scaleLocked: false }, 'scaleX', 3)).toEqual({ scaleX: 3 });
  });
});
