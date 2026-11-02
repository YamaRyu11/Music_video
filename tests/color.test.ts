import { expect, it } from 'vitest';
import { hexToRgb, rgbToHex, rgbToHsb, hsbToRgb } from '../src/colors/color';
import { palettes, backgrounds } from '../src/colors/presets';
it('converts actual HSV/HSB primary colors, black, white and the hue endpoint',()=>{
  expect(hsbToRgb({h:0,s:100,b:100})).toEqual({r:255,g:0,b:0});
  expect(hsbToRgb({h:120,s:100,b:100})).toEqual({r:0,g:255,b:0});
  expect(hsbToRgb({h:240,s:100,b:100})).toEqual({r:0,g:0,b:255});
  expect(hsbToRgb({h:360,s:100,b:100})).toEqual({r:255,g:0,b:0});
  expect(hsbToRgb({h:120,s:0,b:100})).toEqual({r:255,g:255,b:255});
  expect(hsbToRgb({h:120,s:100,b:0})).toEqual({r:0,g:0,b:0});
  expect(rgbToHsb({r:0,g:0,b:0})).toEqual({h:0,s:0,b:0});
});
it('round-trips RGB values without color drift',()=>{
 for(const hex of ['#79acff','#c79cff','#8aab7b','#121c39','#ffffff','#000000','#818181','#012345']) {
   expect(rgbToHex(hsbToRgb(rgbToHsb(hexToRgb(hex))))).toBe(hex);
 }
});
it('offers uniquely named valid two-color palettes and background tones',()=>{
 expect(palettes).toHaveLength(48);expect(backgrounds).toHaveLength(32);
 expect(new Set(palettes.map(p=>p.name)).size).toBe(48);
 expect(new Set(backgrounds.map(p=>p.name)).size).toBe(32);
 for(const p of palettes){expect(p.label).toBeTruthy();expect(p.description).toBeTruthy();expect(p.primary).toMatch(/^#[\da-f]{6}$/);expect(p.secondary).toMatch(/^#[\da-f]{6}$/);}
 for(const p of backgrounds)expect(p.color).toMatch(/^#[\da-f]{6}$/);
});
