import { openInspector } from './inspector.mjs';
import { _electron as electron, expect } from '@playwright/test';
import { mkdir, mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'musicvideo-desktop-'));
let app;
try {
  const args = ['.'];
  // Only for isolated Linux CI; packaged apps keep the Chromium sandbox enabled.
  if (process.platform === 'linux' && process.env.STUDIO_TEST_NO_SANDBOX === '1') args.unshift('--no-sandbox', '--disable-gpu');
  app = await electron.launch({ args, timeout: 30_000 });
  const page = await app.firstWindow();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await expect(page.locator('h1')).toHaveText('音楽を、映像に。');
  await page.getByRole('button', { name: 'サンプル音源で試す' }).click();
  await expect(page.locator('.drop-zone strong')).toHaveText('demo.wav', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: '動画を書き出す' })).toBeEnabled();
  await page.getByRole('button', { name: 'Ocean', exact: true }).click();
  await expect(page.getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
  await page.locator('.sidebar .style-card').filter({ hasText: 'Aurora' }).dragTo(page.locator('[data-layer-slot="01"]'));
  await page.locator('.sidebar .style-card').filter({ hasText: 'Particle Flow' }).dragTo(page.locator('[data-layer-slot="02"]'));
  await expect(page.getByRole('combobox', { name: 'ベースのスタイル', exact: true })).toHaveValue('aurora');
  await expect(page.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue('particles');
  await page.getByRole('slider', { name: 'レイヤーの不透明度' }).fill('0.6');
  await page.getByLabel('レイヤー02のメインカラー', { exact: true }).fill('#79acff');
  await openInspector(page, 'テキスト');
  await page.getByPlaceholder('曲名を入力（任意）').fill('TEST TYPOGRAPHY');
  await page.getByPlaceholder('アーティスト名を入力（任意）').fill('テストアーティスト');
  await page.getByRole('slider', { name: '文字サイズ', exact: true }).fill('90');
  await page.getByLabel('文字色', { exact: true }).fill('#ff245f');
  await page.getByRole('combobox', { name: 'フォント', exact: true }).selectOption('serif');
  await page.getByRole('button', { name: '太字', exact: true }).click();
  await page.getByRole('button', { name: '斜体', exact: true }).click();
  await mkdir('.cache/desktop-test-results', { recursive: true });
  await page.screenshot({ path: '.cache/desktop-test-results/desktop-studio.png', fullPage: true });
  for (const aspect of ['landscape', 'portrait']) {
    const outputPath = path.join(temporary, `日本語-${aspect}.mp4`);
    await app.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: output }); }, outputPath);
    if (aspect === 'portrait') {
      const mp3 = path.join(temporary, '日本語音源.mp3');
      const ffmpeg = path.resolve(process.platform === 'win32' ? 'node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe' : 'node_modules/@ffmpeg-installer/linux-x64/ffmpeg');
      execFileSync(ffmpeg, ['-v', 'error', '-i', path.resolve('dist/demo.wav'), '-c:a', 'libmp3lame', '-q:a', '2', mp3]);
      await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, mp3);
      await page.locator('.drop-zone').click();
      await expect(page.locator('.drop-zone strong')).toHaveText('日本語音源.mp3', { timeout: 30_000 });
      await page.getByRole('button', { name: '縦 9:16' }).click();
      await expect(page.getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
      await page.locator('.sidebar .style-card').filter({ hasText: 'Pulse Tunnel' }).dragTo(page.locator('[data-layer-slot="01"]'));
      await page.locator('.sidebar .style-card').filter({ hasText: 'Silk Wave' }).dragTo(page.locator('[data-layer-slot="02"]'));
      await page.getByRole('combobox', { name: '合成方法' }).selectOption('lighter');
      await openInspector(page, 'テキスト');
      // Importing a new audio source replaces its title, but retains the typography.
      await page.getByPlaceholder('曲名を入力（任意）').fill('TEST TYPOGRAPHY');
    }
    await expect(page.locator('.export-button')).toBeInViewport({ ratio: 1 });
    assert.equal(await page.evaluate(() => document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight), false);
    await page.getByRole('button', { name: '動画を書き出す' }).click();
    await expect(page.locator('.success-message')).toContainText('動画を書き出しました', { timeout: 180_000 });
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', outputPath], { encoding: 'utf8' }));
    const video = probe.streams.find(s => s.codec_type === 'video'), audio = probe.streams.find(s => s.codec_type === 'audio');
    assert.equal(video.codec_name, 'h264'); assert.equal(audio.codec_name, 'aac');
    assert.equal(video.width, aspect === 'portrait' ? 1080 : 1920);
    assert.equal(video.height, aspect === 'portrait' ? 1920 : 1080);
    assert.equal(video.nb_frames, '240'); assert.equal(video.r_frame_rate, '30/1'); assert.equal(video.pix_fmt, 'yuv420p');
    assert.ok(Math.abs(Number(probe.format.duration) - 8) < .1);
    // Decode a frame as additional evidence that the output is playable.
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '2', '-i', outputPath, '-frames:v', '1', '-threads', '1', path.join('.cache/desktop-test-results', `export-${aspect}.png`)]);
    // Pink is used only by the edited title; confirm its chosen color/size reached the MP4.
    const rgb = execFileSync('ffmpeg', ['-v', 'error', '-ss', '2', '-i', outputPath, '-frames:v', '1', '-vf', 'crop=iw:160:0:trunc(ih*0.79)-80', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-threads', '1', 'pipe:1'], { maxBuffer: 1920 * 160 * 3 + 1024 });
    let pink = 0;
    for (let p = 0; p < rgb.length; p += 3) if (rgb[p] > 190 && rgb[p + 1] < 120 && rgb[p + 2] > 35 && rgb[p + 2] < 180) pink++;
    assert.ok(pink > 1000, `Edited title is missing from exported frame (${pink} matching pixels)`);
    console.log(`PASS: ${aspect} (${aspect === 'portrait' ? 'MP3' : 'WAV'} input) H.264/AAC, ${video.width}x${video.height}, 30fps, 240 frames, 8 seconds`);
    console.log(`PASS: composite with edited 90px bold italic title (${pink} pink title pixels)`);
  }
  const protectedOutput = path.join(temporary, 'keep-existing.mp4');
  await writeFile(protectedOutput, 'existing output stays intact');
  await app.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: output }); }, protectedOutput);
  await page.getByRole('button', { name: '動画を書き出す' }).click();
  await expect(page.getByRole('button', { name: 'キャンセル', exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'キャンセル', exact: false }).click();
  await expect(page.locator('.cancel-message')).toContainText('キャンセルしました');
  assert.equal(await readFile(protectedOutput, 'utf8'), 'existing output stays intact');
  assert.equal((await readdir(temporary)).filter(n => n.startsWith('.musicvideo-')).length, 0);
  console.log('PASS: cancellation cleans partial files and preserves existing output');
  assert.deepEqual(pageErrors, []);
} finally {
  if (app) await app.close();
  await rm(temporary, { recursive: true, force: true });
}
