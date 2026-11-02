import {_electron as electron,expect} from '@playwright/test';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const temporary=await mkdtemp(path.join(os.tmpdir(),'musicvideo-line-glow-'));
const diagnostics=path.resolve('.cache/line-glow-export-tests');await mkdir(diagnostics,{recursive:true});
const ffmpeg=path.resolve(`node_modules/@ffmpeg-installer/${process.platform==='win32'?'win32-x64/ffmpeg.exe':'linux-x64/ffmpeg'}`);
const cases=[{name:'off',enabled:false,strength:3,distance:96},{name:'normal',enabled:true,strength:1,distance:24},{name:'strong',enabled:true,strength:3,distance:24},{name:'wide',enabled:true,strength:3,distance:96},{name:'portrait-wide',enabled:true,strength:3,distance:160,aspect:'portrait'}];
const metrics=[];let app,success=false;
try{
 const audio=path.join(temporary,'glow-test.wav');execFileSync(ffmpeg,['-v','error','-i',path.resolve('dist/demo.wav'),'-t','1',audio]);
 app=await electron.launch({args:process.platform==='linux'&&process.env.STUDIO_TEST_NO_SANDBOX==='1'?['--no-sandbox','--disable-gpu','.']:['.'],timeout:30000});
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({dialog},filePath)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filePath]});},audio);
 await page.locator('.drop-zone').click();await expect(page.locator('.drop-zone strong')).toHaveText('glow-test.wav');await expect(page.locator('.export-button')).toBeEnabled();
 await page.getByRole('combobox',{name:'ベースのスタイル',exact:true}).selectOption('wave');
 await page.getByLabel('レイヤー01のメインカラー',{exact:true}).fill('#33ccff');await page.getByLabel('サブカラー',{exact:true}).fill('#33ccff');await page.getByLabel('背景色',{exact:true}).fill('#000000');
 await page.getByRole('slider',{name:'光の広がり',exact:true}).fill('0');await page.getByRole('slider',{name:'音への反応',exact:true}).fill('0');
 await page.getByRole('button',{name:'タイトルを編集',exact:true}).click();await page.getByPlaceholder('曲名を入力（任意）').fill('');await page.getByPlaceholder('アーティスト名を入力（任意）').fill('');await page.getByRole('button',{name:'レイヤー01を編集',exact:true}).click();
 await page.evaluate(()=>{window.glowEvents=[];window.studio.onExportProgress(e=>window.glowEvents.push(e));});
 for(const c of cases){
  await page.getByRole('button',{name:c.aspect==='portrait'?'縦 9:16':'横 16:9',exact:true}).click();
  const enabled=page.getByRole('checkbox',{name:'線のグローを有効にする',exact:true});await enabled.check();
  await page.getByRole('slider',{name:'線のグローの強さ',exact:true}).fill(String(c.strength));await page.getByRole('slider',{name:'線のグローの距離',exact:true}).fill(String(c.distance));await enabled.setChecked(c.enabled);
  await page.getByRole('slider',{name:'再生位置',exact:true}).fill('0');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const preview=await page.locator('.preview-stage canvas').evaluate(canvas=>{const ctx=canvas.getContext('2d'),d=ctx.getImageData(0,0,canvas.width,canvas.height).data;let energy=0,area=0;for(let p=0;p<d.length;p+=4){energy+=d[p+2];if(d[p+2]>8)area++;}return{energy,area,width:canvas.width,height:canvas.height};});
  const output=path.join(temporary,`${c.name}.mp4`),frame=path.join(diagnostics,`${c.name}.png`);
  await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},output);
  await page.evaluate(()=>{window.glowEvents=[];});await page.locator('.export-button').click();
  await page.waitForFunction(()=>window.glowEvents.some(e=>['complete','error','cancelled'].includes(e.state)),undefined,{timeout:180000});
  const result=await page.evaluate(()=>window.glowEvents.findLast(e=>['complete','error','cancelled'].includes(e.state)));assert.equal(result.state,'complete',result.message);assert.equal(result.path,output);
  const probe=JSON.parse(execFileSync(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_streams','-of','json',output],{encoding:'utf8'}));const video=probe.streams.find(s=>s.codec_type==='video');assert.equal(video.codec_name,'h264');assert.equal(video.width,c.aspect==='portrait'?1080:1920);assert.equal(video.height,c.aspect==='portrait'?1920:1080);assert.equal(video.nb_frames,'30');assert.equal(video.r_frame_rate,'30/1');assert.equal(probe.streams.find(s=>s.codec_type==='audio').codec_name,'aac');
  execFileSync(ffmpeg,['-v','error','-y','-i',output,'-frames:v','1','-threads','1',frame]);
  const encoded=(await readFile(frame)).toString('base64');
  const decoded=await page.evaluate(async({encoded,width,height})=>{const image=new Image();image.src=`data:image/png;base64,${encoded}`;await image.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,width,height);const d=ctx.getImageData(0,0,width,height).data;let energy=0,area=0;for(let p=0;p<d.length;p+=4){energy+=d[p+2];if(d[p+2]>8)area++;}return{energy,area};},{encoded,...preview});
  const delta=Math.abs(preview.energy-decoded.energy)/preview.energy;assert.ok(delta<.15,`${c.name}: preview and MP4 energy differ by ${delta}`);
  metrics.push({...c,preview,decoded,delta});console.log(`PASS: ${c.name} FullHD H.264/AAC 30 frames; bloom energy matches preview (${(delta*100).toFixed(1)}% difference)`);
 }
 const byName=Object.fromEntries(metrics.map(m=>[m.name,m]));assert.ok(byName.normal.decoded.energy>byName.off.decoded.energy*1.05);assert.ok(byName.strong.decoded.energy>byName.normal.decoded.energy*1.1);assert.ok(byName.wide.decoded.area>byName.strong.decoded.area*1.1);assert.deepEqual(errors,[]);success=true;
 console.log('PASS: exported line bloom strength and spatial falloff visibly change; off remains crisp.');
}finally{try{if(app)await app.close();}finally{await rm(temporary,{recursive:true,force:true});await writeFile(path.join(diagnostics,'metrics.json'),JSON.stringify({success,exports:metrics},null,2)+'\n');}}
