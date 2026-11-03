import {test,expect,type Page} from '@playwright/test';
async function drag(page:Page,button:'left'|'right',dx:number,dy:number,shift=false){
 const box=(await page.locator('.preview-stage canvas').boundingBox())!,x=box.x+box.width*.45,y=box.y+box.height*.45;
 if(shift)await page.keyboard.down('Shift');await page.mouse.move(x,y);await page.mouse.down({button});await page.mouse.move(x+box.width*dx,y+box.height*dy,{steps:10});await page.mouse.up({button});if(shift)await page.keyboard.up('Shift');
}
async function openSize(page:Page){const section=page.locator('details').filter({has:page.locator('summary').filter({hasText:'サイズ・位置'})});if(await section.getAttribute('open')===null)await section.locator('summary').click();}
test('preview drags update sliders, constrain axes/ratio, respect locks and Escape, and remain independent',async({page})=>{
 await page.goto('/');await openSize(page);
 const x=page.getByRole('slider',{name:'スタイルの横位置',exact:true}),y=page.getByRole('slider',{name:'スタイルの縦位置',exact:true}),sx=page.getByRole('slider',{name:'スタイルの横拡大率',exact:true}),sy=page.getByRole('slider',{name:'スタイルの縦拡大率',exact:true});
 await drag(page,'left',.1,.05);expect(Number(await x.inputValue())).toBeCloseTo(.2,2);expect(Number(await y.inputValue())).toBeCloseTo(.1,2);
 await drag(page,'left',.12,.04,true);expect(Number(await y.inputValue())).toBeCloseTo(.1,2);
 await sx.fill('1.5');await sy.fill('0.8');await drag(page,'right',.12,-.08,true);expect(Number(await sx.inputValue())/Number(await sy.inputValue())).toBeCloseTo(1.875,5);
 const beforeY=Number(await sy.inputValue());await drag(page,'right',.08,0);expect(Number(await sy.inputValue())).toBeCloseTo(beforeY,5);
 await page.getByRole('button',{name:'縦横比をロック',exact:true}).click();const ratio=Number(await sx.inputValue())/Number(await sy.inputValue());await drag(page,'right',.08,-.04);expect(Number(await sx.inputValue())/Number(await sy.inputValue())).toBeCloseTo(ratio,5);
 const before=await x.inputValue(),box=(await page.locator('.preview-stage canvas').boundingBox())!;await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.4);await page.keyboard.press('Escape');await page.mouse.up();await expect(x).toHaveValue(before);
 await page.getByRole('button',{name:'レイヤー02を編集',exact:true}).click();await openSize(page);await expect(x).toHaveValue('0');await drag(page,'left',0,.1);expect(Number(await y.inputValue())).toBeCloseTo(.2,2);
 await page.getByRole('button',{name:'レイヤー01を編集',exact:true}).click();await expect(x).toHaveValue(before);
});
test('text preview gestures update horizontal position and font size while background color is inert',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'タイトルを編集',exact:true}).click();await page.getByPlaceholder('曲名を入力（任意）').fill('DRAG TITLE');
 await drag(page,'left',.1,-.03);expect(Number(await page.getByRole('slider',{name:'文字の横位置',exact:true}).inputValue())).toBeCloseTo(.2,2);
 const size=page.getByRole('slider',{name:'文字サイズ',exact:true});await drag(page,'right',.12,-.08,true);expect(Number(await size.inputValue())).toBeGreaterThan(42);
 await page.getByRole('button',{name:'背景色を編集',exact:true}).click();await expect(page.locator('.preview-stage canvas')).toHaveAttribute('data-transformable','false');
});
test('all inspector sections start closed on both cards and retain independent values and open states',async({page})=>{
 await page.setViewportSize({width:900,height:640});await page.goto('/');const section=(name:string)=>page.locator('details').filter({has:page.locator('summary').filter({hasText:name})});
 for(const card of ['01','02']){await page.getByRole('button',{name:`レイヤー${card}を編集`,exact:true}).click();for(const title of ['カラー設定','エフェクト','サイズ・位置'])await expect(section(title)).not.toHaveAttribute('open','');}
 await page.getByRole('button',{name:'レイヤー01を編集',exact:true}).click();await section('カラー設定').locator('summary').click();await section('エフェクト').locator('summary').click();await page.getByRole('slider',{name:'映像のガウスぼかし',exact:true}).fill('12');await section('エフェクト').locator('summary').click();
 await expect(page.getByRole('slider',{name:'映像のガウスぼかし',exact:true})).not.toBeVisible();
 await page.getByRole('button',{name:'レイヤー02を編集',exact:true}).click();await expect(section('カラー設定')).not.toHaveAttribute('open','');await expect(section('エフェクト')).not.toHaveAttribute('open','');
 await page.getByRole('button',{name:'レイヤー01を編集',exact:true}).click();await expect(section('カラー設定')).toHaveAttribute('open','');await expect(section('エフェクト')).not.toHaveAttribute('open','');await section('エフェクト').locator('summary').click();await expect(page.getByRole('slider',{name:'映像のガウスぼかし',exact:true})).toHaveValue('12');
 await expect(page.locator('.export-button')).toBeInViewport({ratio:1});
});
test('export dialog presets, advanced settings, cancel and session persistence work in browser',async({page})=>{
 await page.setViewportSize({width:900,height:640});await page.goto('/');await page.getByRole('button',{name:'書き出し設定を開く',exact:true}).click();const dialog=page.getByRole('dialog',{name:'書き出し設定',exact:true});
 await dialog.getByRole('button',{name:'高品質',exact:true}).click();await expect(dialog.getByRole('slider',{name:'映像のCRF',exact:true})).toHaveValue('17');await dialog.getByRole('button',{name:'設定を保存',exact:true}).click();
 await page.getByRole('button',{name:'書き出し設定を開く',exact:true}).click();await expect(dialog.getByRole('slider',{name:'映像のCRF',exact:true})).toHaveValue('17');await dialog.getByRole('combobox',{name:'映像の圧縮方式',exact:true}).selectOption('bitrate');await dialog.getByRole('slider',{name:'映像のビットレート',exact:true}).fill('8');await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();
 await page.getByRole('button',{name:'書き出し設定を開く',exact:true}).click();await expect(dialog.getByRole('combobox',{name:'映像の圧縮方式',exact:true})).toHaveValue('quality');await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>{const e=document.scrollingElement!;return[e.scrollWidth-e.clientWidth,e.scrollHeight-e.clientHeight]})).toEqual([0,0]);
});

test('bitmap preview gestures update its placement and uniform scale controls',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'背景ビットマップを編集',exact:true}).click();
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=32;const p=c.getContext('2d')!;p.fillStyle='#ff0080';p.fillRect(0,0,64,32);return c.toDataURL().split(',')[1];});
 await page.getByLabel('背景画像ファイル',{exact:true}).setInputFiles({name:'drag.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 const x=page.getByRole('slider',{name:'画像の横位置',exact:true}),scale=page.getByRole('slider',{name:'画像の拡大率',exact:true});await expect(x).toBeEnabled();await drag(page,'left',.1,0);expect(Number(await x.inputValue())).toBeCloseTo(.2,2);await drag(page,'right',.1,-.1,true);expect(Number(await scale.inputValue())).toBeGreaterThan(1);
});

test('CRF Shift precision retains decimal quality values',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'書き出し設定を開く',exact:true}).click();const slider=page.getByRole('slider',{name:'映像のCRF',exact:true});await slider.focus();await page.keyboard.press('Shift+ArrowRight');await expect(slider).toHaveValue('20.1');await page.getByRole('button',{name:'設定を保存',exact:true}).click();await page.getByRole('button',{name:'書き出し設定を開く',exact:true}).click();await expect(slider).toHaveValue('20.1');
});
