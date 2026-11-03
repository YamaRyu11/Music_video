import {expandLayerControls} from './inspector';
import { test, expect } from '@playwright/test';

test('stroke bloom changes strength and falloff, preserves fills/text and leaves zero/off byte-identical', async ({page})=>{
 await page.goto('/');await expandLayerControls(page);
 const values=await page.evaluate(async()=>{
  const glowPath='/src/visuals/line-glow.ts',sharedPath='/src/shared.ts';
  const {captureLineGlow}=await import(glowPath) as typeof import('../../src/visuals/line-glow');
  const {defaultLayerControls}=await import(sharedPath) as typeof import('../../src/shared');
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d')!;
  function draw(enabled:boolean,strength:number,distance:number){
   ctx.resetTransform();ctx.fillStyle='#000000';ctx.fillRect(0,0,512,256);
   const glow=captureLineGlow(ctx,{...defaultLayerControls,lineGlowEnabled:enabled,lineGlowStrength:strength,lineGlowDistance:distance},256),p=glow.ctx;
   p.save();p.translate(20,0);p.strokeStyle='#ffffff';p.lineWidth=4;p.beginPath();p.moveTo(60,40);p.lineTo(60,216);p.stroke();
   p.fillStyle='#00ff00';p.fillRect(280,80,40,100);p.font='24px sans-serif';p.fillStyle='#ff0080';p.fillText('TITLE',350,130);p.restore();glow.finish();
   const d=ctx.getImageData(0,0,512,256).data;
   const sample=(x:number,y:number)=>Array.from(d.slice((y*512+x)*4,(y*512+x)*4+3));
   let energy=0;for(let y=60;y<196;y++)for(let x=4;x<160;x++)if(Math.abs(x-80)>4)energy+=d[(y*512+x)*4];
   return{pixels:canvas.toDataURL(),energy,near:sample(88,128)[0],far:sample(100,128)[0],fillBorder:sample(298,120),textBorder:sample(367,100)};
  }
  const off=draw(false,3,72),zero=draw(true,0,72),distanceZero=draw(true,3,0),normal=draw(true,1,24),strong=draw(true,3,24),wide=draw(true,3,72),narrow=draw(true,3,12),again=draw(false,3,72);
  return {off,zero,distanceZero,normal,strong,wide,narrow,again};
 });
 expect(values.zero.pixels).toBe(values.off.pixels);expect(values.distanceZero.pixels).toBe(values.off.pixels);expect(values.again.pixels).toBe(values.off.pixels);
 expect(values.normal.energy).toBeGreaterThan(1000);expect(values.strong.energy).toBeGreaterThan(values.normal.energy*1.6);
 expect(values.wide.far).toBeGreaterThan(values.narrow.far+3);
 expect(values.wide.fillBorder).toEqual(values.off.fillBorder);expect(values.wide.textBorder).toEqual(values.off.textBorder);
});

test('line glow stays independent per layer, retains values when off, supports reset and small portrait layout',async({page})=>{
 await page.setViewportSize({width:900,height:640});await page.goto('/');await expandLayerControls(page);
 const enabled=page.getByRole('checkbox',{name:'線のグローを有効にする',exact:true}),strength=page.getByRole('slider',{name:'線のグローの強さ',exact:true}),distance=page.getByRole('slider',{name:'線のグローの距離',exact:true});
 await expect(enabled).not.toBeChecked();await expect(strength).toBeDisabled();await enabled.check();await strength.fill('2.5');await distance.fill('72');
 await page.getByRole('button',{name:'レイヤー02を編集',exact:true}).click();await page.getByRole('combobox',{name:'重ねるスタイル',exact:true}).selectOption('wave');
 await expect(enabled).not.toBeChecked();await enabled.check();await strength.fill('0.5');await distance.fill('12');await enabled.uncheck();await expect(strength).toBeDisabled();await enabled.check();await expect(strength).toHaveValue('0.5');await expect(distance).toHaveValue('12');
 await page.getByRole('button',{name:'レイヤー01を編集',exact:true}).click();await expect(enabled).toBeChecked();await expect(strength).toHaveValue('2.5');await expect(distance).toHaveValue('72');
 await strength.dblclick();await distance.dblclick();await expect(strength).toHaveValue('1');await expect(distance).toHaveValue('24');
 await page.getByRole('button',{name:'縦 9:16',exact:true}).click();await expect(page.locator('.export-button')).toBeInViewport({ratio:1});
 expect(await page.evaluate(()=>{const e=document.scrollingElement!;return[e.scrollWidth-e.clientWidth,e.scrollHeight-e.clientHeight]})).toEqual([0,0]);
 await page.getByRole('button',{name:'カスタマイズをリセット',exact:true}).click();await expect(enabled).not.toBeChecked();
 await page.getByRole('button',{name:'レイヤー02を編集',exact:true}).click();await expect(enabled).toBeChecked();await expect(strength).toHaveValue('0.5');
 await page.getByRole('combobox',{name:'重ねるスタイル',exact:true}).selectOption('glitch');await expect(enabled).toBeDisabled();
});

test('bloom remains local to its own transformed graphics layer and not the background',async({page})=>{
 await page.goto('/');await expandLayerControls(page);
 const results=await page.evaluate(async()=>{
  const renderPath='/src/visuals/render.ts',sharedPath='/src/shared.ts';
  const {renderScene}=await import(renderPath) as typeof import('../../src/visuals/render');
  const {defaultSettings}=await import(sharedPath) as typeof import('../../src/shared');
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d')!;
  const s=structuredClone(defaultSettings);s.style='wave';s.glow=0;s.intensity=0;s.backgroundColor='#202020';s.color='#000000';s.secondaryColor='#000000';s.title='GLOW TEST';s.titleDesign.shadow=false;s.titleDesign.color='#ff0080';
  Object.assign(s.overlay,{style:'rose',color:'#0088ff',secondaryColor:'#0088ff',opacity:.7,scaleX:.5,scaleY:.8,x:.4,y:-.1,lineGlowStrength:3,lineGlowDistance:72});
  const draw=()=>{renderScene(ctx,640,360,1.3,s);return ctx.getImageData(0,0,640,360).data;};
  const off=draw();s.overlay.lineGlowEnabled=true;const on=draw();
  let changed=0,textChanged=0,leftChanged=0;for(let y=0;y<360;y++)for(let x=0;x<640;x++){const p=(y*640+x)*4;if(off[p]!==on[p]||off[p+1]!==on[p+1]||off[p+2]!==on[p+2]){changed++;if(y>275)textChanged++;if(x<80)leftChanged++;}}
  s.overlay.opacity=0;const hiddenGlow=draw();s.overlay.lineGlowEnabled=false;const hiddenOff=draw();
  s.overlay.opacity=.7;s.overlay.lineGlowEnabled=true;s.overlay.blend='multiply';const multiply=draw();
  return{changed,textChanged,leftChanged,hiddenEqual:hiddenGlow.every((v,i)=>v===hiddenOff[i]),multiplyDifferent:multiply.some((v,i)=>v!==on[i])};
 });
 expect(results.changed).toBeGreaterThan(500);expect(results.textChanged).toBe(0);expect(results.leftChanged).toBe(0);expect(results.hiddenEqual).toBe(true);expect(results.multiplyDifferent).toBe(true);
});
