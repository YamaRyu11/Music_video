import {it,expect} from 'vitest';
import {defaultSettings} from '../src/shared';
import {applyTransform,transformed} from '../src/visuals/preview-transform';
it('moves only the selected target and locks movement to the chosen axis',()=>{
 const s=structuredClone(defaultSettings),d={dx:.2,dy:.1,button:0,shift:true,axis:'x' as const};
 const n=transformed(s,'overlay',d);expect(n.overlay.x).toBe(.4);expect(n.overlay.y).toBe(0);expect(n.x).toBe(0);
 const text=transformed(s,'titleDesign',{...d,shift:false});expect(text.titleDesign.x).toBe(.4);expect(text.titleDesign.y).toBeCloseTo(.89);expect(text.artistDesign).toEqual(s.artistDesign);
});
it('preserves a non-square ratio and bounds during Shift or locked scaling',()=>{
 const s=structuredClone(defaultSettings);s.scaleX=1.5;s.scaleY=.8;
 const n=transformed(s,'base',{dx:.3,dy:-.1,button:2,shift:true});expect(n.scaleX/n.scaleY).toBeCloseTo(1.875,12);
 s.scaleLocked=true;const max=transformed(s,'base',{dx:5,dy:-5,button:2,shift:false});expect(max.scaleX).toBe(5);expect(max.scaleX/max.scaleY).toBeCloseTo(1.875,12);
 const free=transformed({...s,scaleLocked:false},'base',{dx:.3,dy:0,button:2,shift:false});expect(free.scaleY).toBe(.8);expect(free.scaleX).toBeGreaterThan(1.5);
});
it('scales bitmap and text and applies only transform fields over newer settings',()=>{
 const s=structuredClone(defaultSettings),d={dx:.4,dy:0,button:2,shift:false};
 expect(transformed(s,'bitmap',d).bitmap.scale).toBeGreaterThan(1);expect(transformed(s,'titleDesign',d).titleDesign.size).toBeGreaterThan(42);
 const moved=transformed(s,'base',{...d,button:0});const newer={...s,color:'#ff0000'};expect(applyTransform(newer,moved,'base').color).toBe('#ff0000');expect(applyTransform(newer,moved,'base').x).toBe(.8);
});
