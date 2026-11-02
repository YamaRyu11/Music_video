import {test,expect} from '@playwright/test';

test('normal 100% preserves source alpha, while a filled backdrop covers the lower frame even at blur edges',async({page})=>{
 await page.goto('/');
 const r=await page.evaluate(async()=>{
  const path='/src/visuals/layer-composite.ts',shared='/src/shared.ts';
  const {compositeLayer}=await import(path) as typeof import('../../src/visuals/layer-composite');
  const {defaultLayerControls}=await import(shared) as typeof import('../../src/shared');
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=144;const ctx=canvas.getContext('2d')!;
  const source=document.createElement('canvas');source.width=256;source.height=144;const p=source.getContext('2d')!;
  p.fillStyle='rgba(0,0,255,0.25)';p.fillRect(96,40,64,64);
  const settings={...defaultLayerControls};
  const draw=(under:string)=>{ctx.fillStyle=under;ctx.fillRect(0,0,256,144);compositeLayer(ctx,source,settings,144,'#102030');return ctx.getImageData(0,0,256,144).data;};
  const sample=(d:Uint8ClampedArray,x:number,y:number)=>Array.from(d.slice((y*256+x)*4,(y*256+x)*4+3));
  const a=draw('#ff0000'),b=draw('#00ff00');
  settings.fillBackground=true;settings.blur=40;const opaqueA=draw('#ff0000'),opaqueB=draw('#00ff00');
  settings.opacity=.5;const faded=draw('#ff0000');
  settings.fillBackground=false;settings.opacity=1;settings.blur=0;const sharp=draw('#000000');settings.blur=20;const blurred=draw('#000000');
  return{transparentDifferent:a.some((v,i)=>v!==b[i]),center:sample(a,128,72),opaqueEqual:opaqueA.every((v,i)=>v===opaqueB[i]),corner:sample(opaqueA,0,0),fadedCorner:sample(faded,0,0),sharpOutside:sample(sharp,85,72)[2],blurredOutside:sample(blurred,85,72)[2],sharpCenter:sample(sharp,128,72)[2],blurredCenter:sample(blurred,128,72)[2]};
 });
 expect(r.transparentDifferent).toBe(true);expect(r.center[0]).toBeGreaterThan(180);expect(r.center[2]).toBeGreaterThan(55);
 expect(r.opaqueEqual).toBe(true);expect(r.corner).toEqual([16,32,48]);expect(r.fadedCorner[0]).toBeGreaterThan(130);expect(r.fadedCorner[0]).toBeLessThan(140);
 expect(r.blurredOutside).toBeGreaterThan(r.sharpOutside);expect(r.blurredCenter).toBeLessThan(r.sharpCenter);
});

test('rendered overlay backdrop hides base, opacity reveals it, and graphics blur leaves bitmap and text intact',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const path='/src/visuals/render.ts',shared='/src/shared.ts';const {renderScene}=await import(path) as typeof import('../../src/visuals/render');const {defaultSettings}=await import(shared) as typeof import('../../src/shared');
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d')!;
  const settings=structuredClone(defaultSettings);Object.assign(settings,{style:'wave',color:'#ff0000',secondaryColor:'#ff0000',glow:0,intensity:0,title:'BLUR TEST',artist:''});settings.titleDesign.shadow=false;settings.titleDesign.color='#ff0080';
  Object.assign(settings.overlay,{style:'sigils',opacity:1,blend:'source-over',fillBackground:true,blur:24,glow:0,color:'#00aaff',secondaryColor:'#00aaff',scaleX:.65,scaleY:.65,y:-.2});
  const draw=()=>{renderScene(ctx,640,360,1.25,settings);return ctx.getImageData(0,0,640,360).data;};
  const opaqueRed=draw();settings.color='#00ff00';settings.secondaryColor='#00ff00';const opaqueGreen=draw();
  settings.overlay.opacity=.5;const fadedGreen=draw();settings.color='#ff0000';settings.secondaryColor='#ff0000';const fadedRed=draw();
  settings.overlay.fillBackground=false;settings.overlay.opacity=1;settings.opacity=0;settings.overlay.blur=0;const sharp=draw();settings.overlay.blur=40;const blurred=draw();
  let changes=0,textChanges=0;for(let y=0;y<360;y++)for(let x=0;x<640;x++){const i=(y*640+x)*4;if(sharp[i]!==blurred[i]||sharp[i+1]!==blurred[i+1]||sharp[i+2]!==blurred[i+2]){changes++;if(y>270)textChanges++;}}
  // A transparent graphics layer cannot blur or recolor the bitmap behind it.
  const imageCanvas=document.createElement('canvas');imageCanvas.width=640;imageCanvas.height=360;const imageCtx=imageCanvas.getContext('2d')!;imageCtx.fillStyle='#884422';imageCtx.fillRect(0,0,640,360);const image=await createImageBitmap(imageCanvas);
  settings.overlay.opacity=0;settings.blur=0;renderScene(ctx,640,360,1.25,settings,undefined,{image,width:640,height:360});const bitmapSharp=canvas.toDataURL();settings.blur=80;settings.overlay.blur=80;renderScene(ctx,640,360,1.25,settings,undefined,{image,width:640,height:360});const bitmapBlur=canvas.toDataURL();image.close();
  return{opaqueEqual:opaqueRed.every((v,i)=>v===opaqueGreen[i]),fadedDifferent:fadedRed.some((v,i)=>v!==fadedGreen[i]),changes,textChanges,bitmapEqual:bitmapSharp===bitmapBlur};
 });
 expect(result.opaqueEqual).toBe(true);expect(result.fadedDifferent).toBe(true);expect(result.changes).toBeGreaterThan(500);expect(result.textChanges).toBe(0);expect(result.bitmapEqual).toBe(true);
});

test('layer blur and filled backgrounds are independent, resettable, and keep the small portrait workspace usable',async({page})=>{
 await page.setViewportSize({width:900,height:640});await page.goto('/');
 const blur=page.getByRole('slider',{name:'映像のガウスぼかし',exact:true}),fill=page.getByRole('checkbox',{name:'レイヤーの背景を塗る',exact:true});
 await expect(blur).toHaveValue('0');await expect(fill).not.toBeChecked();await blur.fill('24');await fill.check();
 await page.getByRole('button',{name:'レイヤー02を編集',exact:true}).click();await expect(blur).toHaveValue('0');await expect(fill).not.toBeChecked();await blur.fill('8');
 await page.getByRole('button',{name:'レイヤー01を編集',exact:true}).click();await expect(blur).toHaveValue('24');await expect(fill).toBeChecked();await blur.dblclick();await expect(blur).toHaveValue('0');await blur.fill('40');
 await page.getByRole('button',{name:'縦 9:16',exact:true}).click();await expect(page.locator('.export-button')).toBeInViewport({ratio:1});
 expect(await page.evaluate(()=>{const e=document.scrollingElement!;return[e.scrollWidth-e.clientWidth,e.scrollHeight-e.clientHeight]})).toEqual([0,0]);
 await page.getByRole('button',{name:'カスタマイズをリセット',exact:true}).click();await expect(blur).toHaveValue('0');await expect(fill).not.toBeChecked();
 await page.getByRole('button',{name:'レイヤー02を編集',exact:true}).click();await expect(blur).toHaveValue('8');
});
