import {expandLayerControls} from './inspector.mjs';
import {_electron as electron,expect} from '@playwright/test';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const temporary=await mkdtemp(path.join(os.tmpdir(),'musicvideo-layer-effects-'));
const diagnostics=path.resolve('.cache/layer-effects-export-tests');await mkdir(diagnostics,{recursive:true});
const ffmpeg=path.resolve(`node_modules/@ffmpeg-installer/${process.platform==='win32'?'win32-x64/ffmpeg.exe':'linux-x64/ffmpeg'}`);
const cases=[{name:'transparent-sharp',blur:0,fill:false},{name:'transparent-blur',blur:12,fill:false},{name:'filled-blur',blur:12,fill:true},{name:'portrait-filled',blur:80,fill:true,aspect:'portrait'}];
const metrics=[];let app,success=false;
try{
 const audio=path.join(temporary,'layer-effects-test.wav');execFileSync(ffmpeg,['-v','error','-i',path.resolve('dist/demo.wav'),'-t','1',audio]);
 app=await electron.launch({args:process.platform==='linux'&&process.env.STUDIO_TEST_NO_SANDBOX==='1'?['--no-sandbox','--disable-gpu','.']:['.'],timeout:30000});
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({dialog},filePath)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filePath]});},audio);
 await page.locator('.drop-zone').click();await expect(page.locator('.drop-zone strong')).toHaveText('layer-effects-test.wav');await expect(page.locator('.export-button')).toBeEnabled();
 await page.getByRole('combobox',{name:'ベースのスタイル',exact:true}).selectOption('wave');
 await page.getByLabel('レイヤー01のメインカラー',{exact:true}).fill('#ff2020');await page.getByLabel('サブカラー',{exact:true}).fill('#ff2020');await page.getByLabel('背景色',{exact:true}).fill('#101820');
 await page.getByRole('slider',{name:'光の広がり',exact:true}).fill('0');await page.getByRole('slider',{name:'音への反応',exact:true}).fill('0');
 await page.getByRole('button',{name:'タイトルを編集',exact:true}).click();await page.getByPlaceholder('曲名を入力（任意）').fill('CLEAR TEXT');await page.getByPlaceholder('アーティスト名を入力（任意）').fill('');await page.getByRole('button',{name:'レイヤー01を編集',exact:true}).click();
 await page.getByRole('combobox',{name:'重ねるスタイル',exact:true}).selectOption('sigils');
 await page.getByLabel('レイヤー02のメインカラー',{exact:true}).fill('#2080ff');await page.getByLabel('サブカラー',{exact:true}).fill('#2080ff');
 await page.getByRole('slider',{name:'光の広がり',exact:true}).fill('0');await page.getByRole('slider',{name:'音への反応',exact:true}).fill('0');
 await page.getByRole('slider',{name:'レイヤーの不透明度',exact:true}).fill('1');await page.getByRole('combobox',{name:'合成方法',exact:true}).selectOption('source-over');
 await page.evaluate(()=>{window.glowEvents=[];window.studio.onExportProgress(e=>window.glowEvents.push(e));});
 for(const c of cases){
  await page.getByRole('button',{name:c.aspect==='portrait'?'縦 9:16':'横 16:9',exact:true}).click();
  await page.getByRole('slider',{name:'映像のガウスぼかし',exact:true}).fill(String(c.blur));await page.getByRole('checkbox',{name:'レイヤーの背景を塗る',exact:true}).setChecked(c.fill);
  await page.getByRole('slider',{name:'再生位置',exact:true}).fill('0');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const preview=await page.locator('.preview-stage canvas').evaluate(canvas=>{const ctx=canvas.getContext('2d'),d=ctx.getImageData(0,0,canvas.width,canvas.height).data;let energy=0,area=0,redPixels=0,bluePeak=0;for(let p=0;p<d.length;p+=4){energy+=d[p+2];if(d[p+2]>8)area++;if(d[p]>40&&d[p]>d[p+1]*1.5&&d[p]>d[p+2]*1.5)redPixels++;if(p<d.length*.7)bluePeak=Math.max(bluePeak,d[p+2]);}return{energy,area,redPixels,bluePeak,width:canvas.width,height:canvas.height};});
  const output=path.join(temporary,`${c.name}.mp4`),frame=path.join(diagnostics,`${c.name}.png`);
  await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},output);
  await page.evaluate(()=>{window.glowEvents=[];});await page.locator('.export-button').click();
    await page.getByRole('button',{name:'この設定で書き出す',exact:true}).click();
  await page.waitForFunction(()=>window.glowEvents.some(e=>['complete','error','cancelled'].includes(e.state)),undefined,{timeout:180000});
  const result=await page.evaluate(()=>window.glowEvents.findLast(e=>['complete','error','cancelled'].includes(e.state)));assert.equal(result.state,'complete',result.message);assert.equal(result.path,output);
  const probe=JSON.parse(execFileSync(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_streams','-of','json',output],{encoding:'utf8'}));const video=probe.streams.find(s=>s.codec_type==='video');assert.equal(video.codec_name,'h264');assert.equal(video.width,c.aspect==='portrait'?1080:1920);assert.equal(video.height,c.aspect==='portrait'?1920:1080);assert.equal(video.nb_frames,'30');assert.equal(video.r_frame_rate,'30/1');assert.equal(probe.streams.find(s=>s.codec_type==='audio').codec_name,'aac');
  execFileSync(ffmpeg,['-v','error','-y','-i',output,'-frames:v','1','-threads','1',frame]);
  const encoded=(await readFile(frame)).toString('base64');
  const decoded=await page.evaluate(async({encoded,width,height})=>{const image=new Image();image.src=`data:image/png;base64,${encoded}`;await image.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,width,height);const d=ctx.getImageData(0,0,width,height).data;let energy=0,area=0,redPixels=0,bluePeak=0;for(let p=0;p<d.length;p+=4){energy+=d[p+2];if(d[p+2]>8)area++;if(d[p]>40&&d[p]>d[p+1]*1.5&&d[p]>d[p+2]*1.5)redPixels++;if(p<d.length*.7)bluePeak=Math.max(bluePeak,d[p+2]);}return{energy,area,redPixels,bluePeak};},{encoded,...preview});
  const delta=Math.abs(preview.energy-decoded.energy)/preview.energy;assert.ok(delta<.15,`${c.name}: preview and MP4 energy differ by ${delta}`);
  metrics.push({...c,preview,decoded,delta});console.log(`PASS: ${c.name} FullHD H.264/AAC 30 frames; graphics energy matches preview (${(delta*100).toFixed(1)}% difference)`);
 }
 const byName=Object.fromEntries(metrics.map(m=>[m.name,m]));assert.ok(byName['transparent-sharp'].decoded.redPixels>30);assert.ok(byName['filled-blur'].decoded.redPixels<byName['transparent-sharp'].decoded.redPixels*.03);assert.ok(byName['transparent-sharp'].decoded.bluePeak>byName['transparent-blur'].decoded.bluePeak+20);assert.deepEqual(errors,[]);success=true;
 console.log('PASS: filled normal/100% overlay hides the red base, and Gaussian blur softens graphics in the actual MP4.');
}finally{try{if(app)await app.close();}finally{await rm(temporary,{recursive:true,force:true});await writeFile(path.join(diagnostics,'metrics.json'),JSON.stringify({success,exports:metrics},null,2)+'\n');}}
