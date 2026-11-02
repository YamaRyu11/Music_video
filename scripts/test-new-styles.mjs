import { openInspector } from './inspector.mjs';
import { _electron as electron, expect } from '@playwright/test';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

// Exercise every added style through the actual UI, IPC, render window and encoder.
const experimental = process.argv.includes('--experimental');
const wireframes = process.argv.includes('--wireframes');
const generative = process.argv.includes('--generative');
const newStyles = experimental ? ['waterfall','phosphor','radar','metaballs','fractal','torus-knot','cells','crystal'] : generative ? ['flowfield', 'chladni', 'moire', 'helix'] : wireframes ? ['terrain', 'wire-tube', 'wire-orb', 'wire-city']
  : ['laser', 'bloom', 'stars', 'ink', 'kaleidoscope', 'contours', 'glitch', 'lissajous', 'rain', 'typography'];
const mode = experimental ? 'experimental' : generative ? 'generative' : wireframes ? 'wireframes' : 'new-styles';
const temporary = await mkdtemp(path.join(os.tmpdir(), wireframes ? 'musicvideo-wireframes-' : 'musicvideo-new-styles-'));
const diagnostics = path.resolve(experimental ? '.cache/experimental-export-tests' : generative ? '.cache/generative-export-tests' : wireframes ? '.cache/wireframe-export-tests' : '.cache/new-style-export-tests');
const platform = process.platform === 'win32' ? 'win32-x64/ffmpeg.exe' : 'linux-x64/ffmpeg';
const ffmpeg = path.resolve(`node_modules/@ffmpeg-installer/${platform}`);
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const startedAt = new Date().toISOString();
const metrics = [];
const pageErrors = [];
let app, success = false;

await mkdir(diagnostics, { recursive: true });
try {
  const source = path.join(temporary, '新スタイル検証音源.wav');
  execFileSync(ffmpeg, ['-v', 'error', '-i', path.resolve('dist/demo.wav'), '-t', '1', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', source]);

  const args = ['.'];
  // This switch is only available to isolated Linux CI, not the packaged app.
  if (process.platform === 'linux' && process.env.STUDIO_TEST_NO_SANDBOX === '1') args.unshift('--no-sandbox', '--disable-gpu');
  app = await electron.launch({ args, timeout: 30_000 });
  app.on('window', window => window.on('pageerror', error => pageErrors.push(error.message)));
  const page = await app.firstWindow();
  page.on('pageerror', error => pageErrors.push(error.message));
  await expect(page.locator('h1')).toHaveText('音楽を、映像に。');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, source);
  await page.locator('.drop-zone').click();
  await expect(page.locator('.drop-zone strong')).toHaveText('新スタイル検証音源.wav', { timeout: 30_000 });
  await expect(page.locator('.time-total')).toHaveText('0:01');
  await expect(page.locator('.export-button')).toBeEnabled();

  await page.getByRole('button', { name: 'Ocean', exact: true }).click();
  if (generative || experimental) {
    await page.getByRole('slider', { name: '音への反応', exact: true }).fill('10');
    await page.getByRole('slider', { name: '動きの滑らかさ', exact: true }).fill('2');
  }
  await openInspector(page, 'テキスト');
  await page.getByPlaceholder('曲名を入力（任意）').fill('NEW STYLE TEST');
  await page.getByPlaceholder('アーティスト名を入力（任意）').fill(experimental ? '新8スタイル・合成検証' : generative ? '新4スタイル・合成検証' : wireframes ? 'ワイヤーフレーム・合成検証' : '新10スタイル・合成検証');
  await page.getByRole('slider', { name: '文字サイズ', exact: true }).fill('70');
  await page.getByLabel('文字色', { exact: true }).fill('#ff245f');
  await page.getByRole('button', { name: '太字', exact: true }).click();
  await page.evaluate(() => {
    window.newStyleExportEvents = [];
    window.studio.onExportProgress(event => window.newStyleExportEvents.push(event));
  });

  for (let index = 0; index < newStyles.length; index++) {
    const style = newStyles[index], overlay = newStyles[(index + 3) % newStyles.length];
    const aspect = index % 2 === 0 ? 'landscape' : 'portrait';
    const width = aspect === 'portrait' ? 1080 : 1920, height = aspect === 'portrait' ? 1920 : 1080;
    const output = path.join(temporary, `${String(index + 1).padStart(2, '0')}-${style}-${aspect}.mp4`);
    const decoded = path.join(diagnostics, `${style}-${aspect}-last-frame.png`);
    await page.getByRole('button', { name: aspect === 'portrait' ? '縦 9:16' : '横 16:9' }).click();
    await expect(page.getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'ベースのスタイル', exact: true }).selectOption(style);
    await page.getByRole('combobox', { name: '重ねるスタイル', exact: true }).selectOption(overlay);
    await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('0.35');
    await page.getByRole('combobox', { name: '合成方法', exact: true }).selectOption('screen');
    await expect(page.getByRole('combobox', { name: 'ベースのスタイル', exact: true })).toHaveValue(style);
    await expect(page.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue(overlay);
    await expect(page.locator('.export-button')).toBeInViewport({ ratio: 1 });
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, output);

    // The event list is reset before each export, so a previous success cannot pass this run.
    await page.evaluate(() => { window.newStyleExportEvents = []; });
    const begun = Date.now();
    await page.locator('.export-button').click();
    await page.waitForFunction(() => window.newStyleExportEvents.some(event => ['complete', 'error', 'cancelled'].includes(event.state)), undefined, { timeout: 180_000 });
    const result = await page.evaluate(() => window.newStyleExportEvents.findLast(event => ['complete', 'error', 'cancelled'].includes(event.state)));
    assert.equal(result.state, 'complete', `${style}: ${result.message || result.state}`);
    assert.equal(result.path, output, `${style}: completion must belong to this output`);
    await expect(page.locator('.success-message')).toContainText('動画を書き出しました');

    const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output], { encoding: 'utf8' }));
    const video = probe.streams.find(stream => stream.codec_type === 'video');
    const audio = probe.streams.find(stream => stream.codec_type === 'audio');
    assert.ok(video && audio, `${style}: audio and video streams are required`);
    assert.equal(video.codec_name, 'h264'); assert.equal(audio.codec_name, 'aac');
    assert.equal(video.width, width); assert.equal(video.height, height);
    assert.equal(video.pix_fmt, 'yuv420p'); assert.equal(video.r_frame_rate, '30/1');
    assert.equal(video.nb_frames, '30');
    assert.ok(Math.abs(Number(probe.format.duration) - 1) < 0.08, `${style}: unexpected duration ${probe.format.duration}`);
    // Select the last frame by index instead of seeking to a rounded timestamp.
    execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', output, '-vf', 'select=eq(n\\,29)', '-vsync', '0', '-frames:v', '1', '-threads', '1', decoded]);
    const png = await readFile(decoded);
    assert.ok(png.length > 1000, `${style}: last frame must decode to an image`);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    metrics.push({ style, overlay, opacity: .35, aspect, width, height, videoCodec: video.codec_name,
      audioCodec: audio.codec_name, frames: Number(video.nb_frames), fps: video.r_frame_rate,
      duration: Number(probe.format.duration), elapsedMs: Date.now() - begun, decodedBytes: png.length });
    console.log(`PASS: ${style} + ${overlay} (${aspect}) ${width}x${height}, H.264/AAC, 30 frames / 1 second; last frame decoded`);
  }
  assert.equal(metrics.length, newStyles.length);
  assert.deepEqual(pageErrors, []);
  success = true;
  console.log(`PASS: all ${newStyles.length} ${wireframes ? 'wireframe' : 'added'} styles exported with another tested style as overlay.`);
} finally {
  try { if (app) await app.close(); }
  finally {
    await rm(temporary, { recursive: true, force: true });
    await writeFile(path.join(diagnostics, 'metrics.json'), JSON.stringify({ startedAt, mode, success, pageErrors, exports: metrics }, null, 2) + '\n');
  }
}
