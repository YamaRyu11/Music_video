import {useEffect,useRef,type PointerEvent,type Dispatch,type SetStateAction} from 'react';
import type {VisualSettings} from '../shared';
import {applyTransform,transformed,type PreviewTarget} from '../visuals/preview-transform';
interface Drag {id:number;button:number;originX:number;originY:number;anchorX:number;anchorY:number;width:number;height:number;shift:boolean;axis?:'x'|'y';moved:boolean;initial:VisualSettings;anchor:VisualSettings;current:VisualSettings;target:PreviewTarget;canvas:HTMLCanvasElement}
export function usePreviewGestures(settings:VisualSettings,onChange:Dispatch<SetStateAction<VisualSettings>>,target:PreviewTarget|undefined,disabled:boolean){
 const drag=useRef<Drag|null>(null),suppress=useRef(false),current=useRef(settings);current.current=settings;
 const finish=(rollback=false)=>{
  const d=drag.current;if(!d)return;drag.current=null;suppress.current=d.moved;
  if(rollback)onChange(s=>applyTransform(s,d.initial,d.target));
  if(d.canvas.hasPointerCapture(d.id))d.canvas.releasePointerCapture(d.id);
 };
 useEffect(()=>{finish();},[target,disabled,settings.aspect]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&drag.current){e.preventDefault();finish(true);}};
  const blur=()=>finish();window.addEventListener('keydown',key);window.addEventListener('blur',blur);window.addEventListener('resize',blur);
  return()=>{window.removeEventListener('keydown',key);window.removeEventListener('blur',blur);window.removeEventListener('resize',blur);};
 },[]);
 return {
  onPointerDown:(e:PointerEvent<HTMLCanvasElement>)=>{
   suppress.current=false;if(disabled||!target||![0,2].includes(e.button))return;
   const canvas=e.currentTarget,b=canvas.getBoundingClientRect();if(!b.width||!b.height)return;
   e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
   drag.current={id:e.pointerId,button:e.button,originX:e.clientX,originY:e.clientY,anchorX:e.clientX,anchorY:e.clientY,width:b.width,height:b.height,shift:e.shiftKey,moved:false,initial:current.current,anchor:current.current,current:current.current,target,canvas};
  },
  onPointerMove:(e:PointerEvent<HTMLCanvasElement>)=>{
   const d=drag.current;if(!d||d.id!==e.pointerId)return;e.preventDefault();
   if(!d.moved&&Math.hypot(e.clientX-d.originX,e.clientY-d.originY)<3)return;d.moved=true;
   if(d.shift!==e.shiftKey){d.shift=e.shiftKey;d.anchor=d.current;d.anchorX=e.clientX;d.anchorY=e.clientY;d.axis=undefined;}
   const dx=e.clientX-d.anchorX,dy=e.clientY-d.anchorY;
   if(d.shift&&d.button===0&&!d.axis&&Math.hypot(dx,dy)>=2)d.axis=Math.abs(dx)>=Math.abs(dy)?'x':'y';
   // While deciding an axis, retain the current position rather than drifting.
   if(d.shift&&d.button===0&&!d.axis)return;
   d.current=transformed(d.anchor,d.target,{dx:dx/d.width,dy:dy/d.height,button:d.button,shift:d.shift,axis:d.axis});
   onChange(s=>applyTransform(s,d.current,d.target));
  },
  onPointerUp:(e:PointerEvent<HTMLCanvasElement>)=>{if(drag.current?.id===e.pointerId)finish();},
  onPointerCancel:()=>finish(true),onLostPointerCapture:()=>finish(),
  onContextMenu:(e:React.MouseEvent<HTMLCanvasElement>)=>{if(target)e.preventDefault();},
  consumeClick:()=>{const result=suppress.current;suppress.current=false;return result;},
 };
}
