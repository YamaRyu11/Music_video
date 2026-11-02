import {_electron as electron,expect} from '@playwright/test';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const temporary=await mkdtemp(path.join(os.tmpdir(),'musicvideo-export-options-'));
const diagnostics=path.resolve('.cache/export-options-tests');await mkdir(diagnostics,{recursive:true});
const ffmpeg=path.resolve(`node_modules/@ffmpeg-installer/${process.platform==='win32'?'win32-x64/ffmpeg.exe':'linux-x64/ffmpeg'}`);
const cases=[{name:'light',preset:'軽量',crf:25,aspect:'landscape'},{name:'high',preset:'高品質',crf:17,aspect:'portrait'},{name:'bitrate',preset:'標準',bitrate:8,aspect:'landscape'},{name:'fractional',preset:'標準',crf:20.5,aspect:'landscape'}];
let app,success=false;const results=[];
try{
 const audio=path.join(temporary,'options.wav');execFileSync(ffmpeg,['-v','error','-i',path.resolve('dist/demo.wav'),'-t','1',audio]);
 app=await electron.launch({args:process.platform==='linux'&&process.env.STUDIO_TEST_NO_SANDBOX==='1'?['--no-sandbox','--disable-gpu','.']:['.'],timeout:30000});const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({dialog},filePath)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filePath]});},audio);await page.locator('.drop-zone').click();await expect(page.locator('.drop-zone strong')).toHaveText('options.wav');await expect(page.locator('.export-button')).toBeEnabled();
 await page.getByRole('button',{name:'タイトルを編集',exact:true}).click();await page.getByPlaceholder('曲名を入力（任意）').fill('POSITION');await page.getByPlaceholder('アーティスト名を入力（任意）').fill('');await page.getByLabel('文字色',{exact:true}).fill('#ffffff');await page.getByRole('slider',{name:'文字サイズ',exact:true}).fill('70');
 const box=await page.locator('.preview-stage canvas').boundingBox(),x=box.x+box.width*.4,y=box.y+box.height*.4;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+box.width*.15,y,{steps:10});await page.mouse.up();expect(Number(await page.getByRole('slider',{name:'文字の横位置',exact:true}).inputValue())).toBeCloseTo(.3,2);
 await page.evaluate(()=>{window.optionEvents=[];window.studio.onExportProgress(e=>window.optionEvents.push(e));});
 for(const c of cases){
  const output=path.join(temporary,`${c.name}.mp4`),image=path.join(diagnostics,`${c.name}.png`);await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},output);
  await page.getByRole('button',{name:c.aspect==='portrait'?'縦 9:16':'横 16:9',exact:true}).click();await page.evaluate(()=>{window.optionEvents=[];});await page.locator('.export-button').click();const dialog=page.getByRole('dialog',{name:'書き出し設定',exact:true});await dialog.getByRole('button',{name:c.preset,exact:true}).click();
  if(c.crf===20.5)await dialog.getByRole('slider',{name:'映像のCRF',exact:true}).fill('20.5');
  if(c.bitrate){await dialog.getByRole('combobox',{name:'映像の圧縮方式',exact:true}).selectOption('bitrate');await dialog.getByRole('slider',{name:'映像のビットレート',exact:true}).fill(String(c.bitrate));await dialog.getByRole('combobox',{name:'音声のビットレート',exact:true}).selectOption('192');}
  await dialog.getByRole('button',{name:'この設定で書き出す',exact:true}).click();await page.waitForFunction(()=>window.optionEvents.some(e=>['complete','error','cancelled'].includes(e.state)),undefined,{timeout:180000});const result=await page.evaluate(()=>window.optionEvents.findLast(e=>['complete','error','cancelled'].includes(e.state)));assert.equal(result.state,'complete',result.message);
  const bytes=await readFile(output),metadata=bytes.toString('latin1');assert.ok(c.bitrate?/\brc=abr\b/.test(metadata)&&metadata.includes('bitrate=8000'):metadata.includes(`crf=${Number(c.crf).toFixed(1)}`),`${c.name}: actual x264 settings were not encoded`);
  const probe=JSON.parse(execFileSync(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_streams','-of','json',output],{encoding:'utf8'})),v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');assert.equal(v.codec_name,'h264');assert.equal(a.codec_name,'aac');assert.equal(v.width,c.aspect==='portrait'?1080:1920);assert.equal(v.height,c.aspect==='portrait'?1920:1080);assert.equal(v.nb_frames,'30');
  execFileSync(ffmpeg,['-v','error','-y','-i',output,'-frames:v','1','-threads','1',image]);const png=(await readFile(image)).toString('base64');const title=await page.evaluate(async encoded=>{const image=new Image();image.src=`data:image/png;base64,${encoded}`;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const d=ctx.getImageData(0,0,canvas.width,canvas.height).data;let count=0,sumX=0;for(let y=Math.floor(canvas.height*.72);y<canvas.height*.86;y++)for(let x=0;x<canvas.width;x++){const p=(y*canvas.width+x)*4;if(d[p]>215&&d[p+1]>215&&d[p+2]>215){count++;sumX+=x;}}return{count,x:sumX/count/canvas.width};},png);assert.ok(title.count>100);assert.ok(Math.abs(title.x-.65)<.03,`${c.name}: dragged text position missing (${title.x})`);
  results.push({...c,bytes:bytes.length,audioBitrate:a.bit_rate,title});console.log(`PASS: ${c.name} FullHD H.264/AAC; actual ${c.bitrate?'ABR 8Mbps':`CRF ${c.crf}`} verified in x264 metadata; dragged title x=${title.x.toFixed(3)}`);
 }
 assert.deepEqual(errors,[]);success=true;
}finally{try{if(app)await app.close();}finally{await rm(temporary,{recursive:true,force:true});await writeFile(path.join(diagnostics,'metrics.json'),JSON.stringify({success,exports:results},null,2)+'\n');}}
