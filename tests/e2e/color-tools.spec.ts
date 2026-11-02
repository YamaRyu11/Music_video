import {openSection} from './inspector';
import { test, expect } from '@playwright/test';

test('named pair presets are searchable and scoped to the selected layer',async({page})=>{
 await page.setViewportSize({width:900,height:640});await page.goto('/');
 await page.getByRole('button',{name:'レイヤー02を編集',exact:true}).click();
 await page.getByRole('button',{name:'配色プリセットを選ぶ',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'配色プリセット',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog.locator('.palette-option')).toHaveCount(48);
 await dialog.getByLabel('配色プリセットを検索',{exact:true}).fill('青とオレンジ');
 await expect(dialog.locator('.palette-option')).toHaveCount(1);
 await dialog.getByRole('button',{name:'Blue Orange',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.getByLabel('レイヤー02のメインカラー',{exact:true})).toHaveValue('#78b9ef');
 await expect(page.getByLabel('レイヤー02のサブカラー',{exact:true})).toHaveValue('#ffd192');
 await expect(page.getByLabel('レイヤー01のメインカラー',{exact:true})).toHaveValue('#b8f36b');
 await expect(page.getByLabel('背景色',{exact:true})).toHaveValue('#080d13');
 expect(await page.evaluate(()=>{const e=document.scrollingElement!;return [e.scrollHeight-e.clientHeight,e.scrollWidth-e.clientWidth]})).toEqual([0,0]);
});

test('background card selects named shared background presets without changing style colors',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'背景色を編集',exact:true}).click();
 await expect(page.getByRole('region',{name:'背景色の設定',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'背景色プリセットを選ぶ',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'背景色プリセット',exact:true});await expect(dialog.locator('.palette-option')).toHaveCount(32);
 await dialog.getByRole('button',{name:'Ivory',exact:true}).click();
 await expect(page.getByLabel('背景色',{exact:true})).toHaveValue('#f8f4e9');
 await expect(page.getByLabel('共通背景色',{exact:true})).toHaveValue('#f8f4e9');
 await expect(page.getByLabel('レイヤー01のメインカラー',{exact:true})).toHaveValue('#b8f36b');
 await page.getByRole('button',{name:'カスタマイズをリセット',exact:true}).click();
 await expect(page.getByLabel('背景色',{exact:true})).toHaveValue('#080d13');
});

test('custom color popup synchronizes RGB, HSB and HEX, and supports vertical numeric dragging',async({page})=>{
 await page.goto('/');await page.getByLabel('レイヤー01のメインカラー',{exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'レイヤー01のメインカラーの色を編集',exact:true});await expect(dialog).toBeVisible();
 await dialog.getByLabel('HEX',{exact:true}).fill('#ff0000');
 await expect(dialog.getByLabel('R（赤）',{exact:true})).toHaveValue('255');
 await expect(dialog.getByRole('slider',{name:'彩度 S',exact:true})).toHaveValue('100');
 await dialog.getByRole('slider',{name:'色相 H',exact:true}).fill('120');
 await expect(dialog.getByLabel('HEX',{exact:true})).toHaveValue('#00ff00');
 await dialog.getByRole('slider',{name:'彩度 S',exact:true}).fill('0');
 await expect(dialog.getByLabel('HEX',{exact:true})).toHaveValue('#ffffff');
 await dialog.getByRole('slider',{name:'明度 B',exact:true}).fill('50');
 await expect(dialog.getByLabel('HEX',{exact:true})).toHaveValue('#808080');
 await dialog.getByRole('slider',{name:'色相 H',exact:true}).fill('240');
 await dialog.getByRole('slider',{name:'彩度 S',exact:true}).fill('100');
 await expect(dialog.getByLabel('HEX',{exact:true})).toHaveValue('#000080');
 await dialog.getByLabel('HEX',{exact:true}).fill('#808080');
 await dialog.getByLabel('R（赤）',{exact:true}).fill('100');
 const field=dialog.getByLabel('R（赤）',{exact:true}), box=(await field.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2-20,{steps:5});await page.mouse.up();
 await expect(field).toHaveValue('120');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+10,{steps:5});await page.mouse.up();
 await expect(field).toHaveValue('110');
 await page.keyboard.down('Shift');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2-20,{steps:5});await page.mouse.up();await page.keyboard.up('Shift');
 await expect(field).toHaveValue('112');
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await expect(page.getByLabel('レイヤー01のメインカラー',{exact:true})).toHaveValue('#708080');
 await expect(page.getByLabel('カスタムカラー',{exact:true})).toHaveValue('#708080');
});

test('style transforms affect only their own geometry and retain independent settings',async({page})=>{
 await page.goto('/');await page.getByRole('combobox',{name:'ベースのスタイル',exact:true}).selectOption('wave');
 await page.getByLabel('レイヤー01のメインカラー',{exact:true}).fill('#ffffff');await page.getByLabel('サブカラー',{exact:true}).fill('#ffffff');
 await page.getByRole('slider',{name:'光の広がり',exact:true}).fill('0');
 const measure=async()=>{await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));return page.locator('canvas').evaluate(c=>{const ctx=(c as HTMLCanvasElement).getContext('2d')!,w=(c as HTMLCanvasElement).width,h=(c as HTMLCanvasElement).height,d=ctx.getImageData(0,0,w,h).data;let minX=w,maxX=0,minY=h,maxY=0,n=0,sum=0;for(let y=0;y<h*.72;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;if(d[p]>110&&d[p+1]>110&&d[p+2]>110){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);n++;sum+=x;}}return {width:maxX-minX,height:maxY-minY,cx:sum/n/w};});};
 const initial=await measure();
 await openSection(page,'サイズ・位置');
 await page.getByRole('slider',{name:'スタイルの横拡大率',exact:true}).fill('0.5');
 await page.getByRole('slider',{name:'スタイルの縦拡大率',exact:true}).fill('0.5');
 const small=await measure();expect(small.width).toBeLessThan(initial.width*.65);expect(small.height).toBeLessThan(initial.height*.7);
 await page.getByRole('slider',{name:'スタイルの横位置',exact:true}).fill('0.4');expect((await measure()).cx).toBeGreaterThan(small.cx+.15);
 await page.getByRole('button',{name:'レイヤー02を編集',exact:true}).click();await openSection(page,'サイズ・位置');
 await expect(page.getByRole('slider',{name:'スタイルの横拡大率',exact:true})).toHaveValue('1');
 await page.getByRole('button',{name:'レイヤー01を編集',exact:true}).click();await openSection(page,'サイズ・位置');
 await expect(page.getByRole('slider',{name:'スタイルの横位置',exact:true})).toHaveValue('0.4');
 await page.getByRole('button',{name:'カスタマイズをリセット',exact:true}).click();
 await expect(page.getByRole('slider',{name:'スタイルの横拡大率',exact:true})).toHaveValue('1');
});
