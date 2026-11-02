export interface RGB { r: number; g: number; b: number }
export interface HSB { h: number; s: number; b: number }
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
export function hexToRgb(hex: string): RGB {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '000000';
  return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
}
export function rgbToHex(rgb: RGB): string {
  return '#' + [rgb.r, rgb.g, rgb.b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
export function rgbToHsb(rgb: RGB): HSB {
  const r = clamp(rgb.r,0,255)/255, g = clamp(rgb.g,0,255)/255, b = clamp(rgb.b,0,255)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
  let h = d === 0 ? 0 : max === r ? ((g-b)/d)%6 : max === g ? (b-r)/d+2 : (r-g)/d+4;
  h = (h*60+360)%360;
  return { h, s: max === 0 ? 0 : d/max*100, b: max*100 };
}
export function hsbToRgb(hsb: HSB): RGB {
  const h = ((clamp(hsb.h,0,360)%360)+360)%360/60, s = clamp(hsb.s,0,100)/100, v = clamp(hsb.b,0,100)/100;
  const c=v*s, x=c*(1-Math.abs(h%2-1)), m=v-c;
  const a = h<1 ? [c,x,0] : h<2 ? [x,c,0] : h<3 ? [0,c,x] : h<4 ? [0,x,c] : h<5 ? [x,0,c] : [c,0,x];
  return { r: Math.round((a[0]+m)*255), g: Math.round((a[1]+m)*255), b: Math.round((a[2]+m)*255) };
}
