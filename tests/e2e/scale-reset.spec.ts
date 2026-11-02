import {openSection} from './inspector';
import {test,expect} from '@playwright/test';

test('current non-square ratio locks independently per layer and double-click restores scale',async({page})=>{
 await page.goto('/');await openSection(page,'サイズ・位置');
 const x=page.getByRole('slider',{name:'スタイルの横拡大率',exact:true}),y=page.getByRole('slider',{name:'スタイルの縦拡大率',exact:true}),lock=page.getByRole('button',{name:'縦横比をロック',exact:true});
 await x.fill('1.5');await y.fill('0.8');await lock.click();
 await expect(x).toHaveValue('1.5');await expect(y).toHaveValue('0.8');
 await x.fill('3');expect(Number(await y.inputValue())).toBeCloseTo(1.6,3);
 // Actual pointer and keyboard edits retain the starting ratio.
 const box=(await x.boundingBox())!;await page.keyboard.down('Shift');await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');
 expect(Number(await x.inputValue())/Number(await y.inputValue())).toBeCloseTo(1.875,3);
 await y.focus();await page.keyboard.press('Shift+ArrowRight');expect(Number(await x.inputValue())/Number(await y.inputValue())).toBeCloseTo(1.875,3);
 await page.getByRole('button',{name:'レイヤー02を編集',exact:true}).click();await openSection(page,'サイズ・位置');
 await expect(lock).toHaveAttribute('aria-pressed','false');await expect(x).toHaveValue('1');await x.fill('0.6');
 await page.getByRole('button',{name:'レイヤー01を編集',exact:true}).click();await openSection(page,'サイズ・位置');await expect(lock).toHaveAttribute('aria-pressed','true');
 await y.dblclick();await expect(x).toHaveValue('1');await expect(y).toHaveValue('1');await expect(lock).toHaveAttribute('aria-pressed','true');
 await lock.click();await x.fill('2');await y.fill('0.4');await x.dblclick();await expect(x).toHaveValue('1');await expect(y).toHaveValue('0.4');
 await page.getByRole('button',{name:'レイヤー02を編集',exact:true}).click();await openSection(page,'サイズ・位置');await expect(x).toHaveValue('0.6');
});

test('each style and text slider double-clicks to its own default',async({page})=>{
 await page.setViewportSize({width:900,height:640});await page.goto('/');
 for(const layer of ['01','02']){
  await page.getByRole('button',{name:`レイヤー${layer}を編集`,exact:true}).click();await openSection(page,'サイズ・位置');
  const defaults:Record<string,number>={'レイヤーの不透明度':layer==='01'?1:.5,'明るさ':1,'彩度':1,'光の広がり':.5,'音への反応':1,'動きの滑らかさ':.5,'線の太さ':1,'スタイルの横拡大率':1,'スタイルの縦拡大率':1,'スタイルの横位置':0,'スタイルの縦位置':0};
  // The empty overlay intentionally disables only its line-width control.
  if(layer==='02')await page.getByRole('combobox',{name:'重ねるスタイル',exact:true}).selectOption('wave');
  for(const [name,value] of Object.entries(defaults)){
   const slider=page.getByRole('slider',{name,exact:true});await slider.fill(await slider.getAttribute('max') as string);await slider.dblclick();expect(Number(await slider.inputValue()),`${layer} ${name}`).toBe(value);
  }
 }
 for(const [name,size,y] of [['タイトルを編集',42,.79],['アーティストを編集',22,.835]] as const){
  await page.getByRole('button',{name,exact:true}).click();
  for(const [label,value] of [['文字サイズ',size],['文字の縦位置',y]] as const){const slider=page.getByRole('slider',{name:label,exact:true});await slider.fill(await slider.getAttribute('max') as string);await slider.dblclick();expect(Number(await slider.inputValue())).toBe(value);}
 }
 expect(await page.evaluate(()=>{const e=document.scrollingElement!;return [e.scrollHeight-e.clientHeight,e.scrollWidth-e.clientWidth]})).toEqual([0,0]);
});

test('color sliders restore their opening values and seek resets to the beginning',async({page})=>{
 await page.goto('/');await page.getByLabel('レイヤー01のメインカラー',{exact:true}).click();
 const dialog=page.getByRole('dialog'),sliders=dialog.getByRole('slider');
 const initial=await sliders.evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value));
 for(let i=0;i<3;i++){await sliders.nth(i).fill(i===0?'180':'20');await sliders.nth(i).dblclick();expect(Number(await sliders.nth(i).inputValue())).toBeCloseTo(Number(initial[i]),5);}
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'サンプル音源で試す'}).click();
 const seek=page.getByRole('slider',{name:'再生位置',exact:true});await expect(seek).toBeEnabled();await seek.fill('3');await seek.dblclick();await expect(seek).toHaveValue('0');
});

test('bitmap sliders reset independently, including dynamically bounded crop sliders',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'背景ビットマップを編集',exact:true}).click();
 // Enable the controls using a real dropped bitmap, without depending on native dialogs.
 await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#abcdef';ctx.fillRect(0,0,64,64);
  const data=Uint8Array.from(atob(canvas.toDataURL().split(',')[1]),c=>c.charCodeAt(0));
  const transfer=new DataTransfer();transfer.items.add(new File([data],'reset-test.png',{type:'image/png'}));document.querySelector('.bitmap-panel')!.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));
 });
 const defaults:Record<string,number>={'画像の拡大率':1,'画像の回転':0,'画像の横位置':0,'画像の縦位置':0,'左の切り抜き':0,'右の切り抜き':0,'上の切り抜き':0,'下の切り抜き':0,'ガウスぼかし':0,'画像の不透明度':1,'画像の彩度':1,'画像の明るさ':1};
 for(const [name,value] of Object.entries(defaults)){
  await page.getByRole('button',{name:name.includes('切り抜き')?'トリミング':['ガウスぼかし','画像の不透明度','画像の彩度','画像の明るさ'].includes(name)?'エフェクト':'配置',exact:true}).click();
  const slider=page.getByRole('slider',{name,exact:true});await expect(slider).toBeEnabled();await slider.fill(await slider.getAttribute('max') as string);await slider.dblclick();expect(Number(await slider.inputValue()),name).toBe(value);}
});
