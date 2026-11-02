import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { clamp, hexToRgb, rgbToHex, rgbToHsb, hsbToRgb, type HSB, type RGB } from '../colors/color';
import { RangeInput } from './Slider';
import { Popup } from './Popup';

function DragNumber({ label, value, max, onChange, decimals = 0 }: { label: string; value: number; max: number; onChange: (value: number)=>void; decimals?: number }) {
  const drag = useRef<{id:number;y:number;value:number;active:boolean}|null>(null);
  const end = (e: PointerEvent<HTMLInputElement>) => { if(drag.current?.id === e.pointerId) { drag.current=null; if(e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } };
  return <input type="number" aria-label={label} min={0} max={max} step={decimals ? .1 : 1} value={Number(value.toFixed(decimals))}
    onChange={e => { if(e.target.value !== '') onChange(clamp(Number(e.target.value),0,max)); }}
    onPointerDown={e => { if(e.button!==0) return; drag.current={id:e.pointerId,y:e.clientY,value,active:false};e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={e => { const d=drag.current;if(!d||d.id!==e.pointerId)return; const dy=d.y-e.clientY;if(!d.active && Math.abs(dy)<3)return;d.active=true;e.preventDefault();d.value=clamp(d.value+dy*(e.shiftKey?.1:1),0,max);d.y=e.clientY;onChange(Number(d.value.toFixed(decimals))); }}
    onPointerUp={end} onPointerCancel={end} onLostPointerCapture={()=>{drag.current=null;}} title="数値を入力、または上下にドラッグ。Shiftで微調整" />;
}
function ColorEditor({ label, value, onChange, onClose }: { label:string; value:string; onChange:(hex:string)=>void;onClose:()=>void }) {
  const [hsb,setHsb]=useState(()=>rgbToHsb(hexToRgb(value))), [hex,setHex]=useState(value);
  const emitted=useRef(value);
  useEffect(()=>{setHex(value);if(value!==emitted.current){setHsb(rgbToHsb(hexToRgb(value)));emitted.current=value;}},[value]);
  const rgb=hexToRgb(value);
  const emitHsb=(next:HSB)=>{setHsb(next);const color=rgbToHex(hsbToRgb(next));emitted.current=color;setHex(color);onChange(color);};
  const emitRgb=(next:RGB)=>{const color=rgbToHex(next), converted=rgbToHsb(hexToRgb(color));setHsb({...converted,h:converted.s===0?hsb.h:converted.h});emitted.current=color;setHex(color);onChange(color);};
  const channels=[{id:'h' as const,label:'色相 H',max:360,unit:'°',gradient:'linear-gradient(to right,red,#ff0,lime,cyan,blue,magenta,red)'},
    {id:'s' as const,label:'彩度 S',max:100,unit:'%',gradient:`linear-gradient(to right,${rgbToHex(hsbToRgb({...hsb,s:0}))},${rgbToHex(hsbToRgb({...hsb,s:100}))})`},
    {id:'b' as const,label:'明度 B',max:100,unit:'%',gradient:`linear-gradient(to right,#000,${rgbToHex(hsbToRgb({...hsb,b:100}))})`}];
  return <Popup title={`${label}の色を編集`} onClose={onClose} className="color-editor">
    <div className="color-editor-preview" style={{background:value}} aria-label={`選択色 ${value}`} />
    <label className="hex-field">HEX<input aria-label="HEX" value={hex} spellCheck={false} onChange={e=>{const next=e.target.value;setHex(next);if(/^#[\da-f]{6}$/i.test(next)){emitted.current=next.toLowerCase();setHsb(rgbToHsb(hexToRgb(next)));onChange(next.toLowerCase());}}} onBlur={()=>setHex(value)} /></label>
    <div className="rgb-fields">{(['r','g','b'] as const).map((id,i)=><label key={id}><span>{['R（赤）','G（緑）','B（青）'][i]}</span><DragNumber label={['R（赤）','G（緑）','B（青）'][i]} value={rgb[id]} max={255} onChange={v=>emitRgb({...rgb,[id]:v})}/></label>)}</div>
    <p className="color-editor-note">数値は直接入力・上下ドラッグで変更できます。Shiftで10倍細かく調整。</p>
    {channels.map(c=><div className="hsb-channel" key={c.id}><label><span>{c.label}</span><DragNumber label={`${c.label}の数値`} value={hsb[c.id]} max={c.max} decimals={1} onChange={v=>emitHsb({...hsb,[c.id]:v})}/><span>{c.unit}</span></label>
      <div className="hsb-track" style={{background:c.gradient}}><RangeInput aria-label={c.label} min={0} max={c.max} step={.1} value={hsb[c.id]} onValueChange={v=>emitHsb({...hsb,[c.id]:v})}/></div></div>)}
    <p className="color-editor-note">HSB：H＝色相、S＝彩度、B＝明度。設定はプレビューへ即時反映されます。</p>
    <button className="color-editor-done" onClick={onClose}>完了</button>
  </Popup>;
}
export function ColorInput({ label, value, onChange, disabled=false, onOpen }: { label:string;value:string;onChange:(hex:string)=>void;disabled?:boolean;onOpen?:()=>void }) {
  const [open,setOpen]=useState(false);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  return <><input type="color" aria-label={label} value={value} disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
    onChange={e=>onChange(e.target.value)} onClick={e=>{e.preventDefault();if(!disabled){onOpen?.();setOpen(true);}}}
    onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!disabled){onOpen?.();setOpen(true);}}}} />
    {open&&!disabled&&<ColorEditor label={label} value={value} onChange={onChange} onClose={()=>setOpen(false)}/>}</>;
}
