import { openInspector } from './inspector.mjs';
import { _electron as electron, expect } from '@playwright/test';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'musicvideo-layers-'));
const diagnostics = path.resolve('.cache/layer-export-tests');
const platform = process.platform === 'win32' ? 'win32-x64/ffmpeg.exe' : 'linux-x64/ffmpeg';
const ffmpeg = path.resolve(`node_modules/@ffmpeg-installer/${platform}`), ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const startedAt = new Date().toISOString(), results = [], pageErrors = [];
let app, page, success = false, failure;
await mkdir(diagnostics, { recursive: true });

const base = { scaleX:1, scaleY:1, x:0, y:0, color: '#000000', secondaryColor: '#000000', brightness: .5, saturation: 0,
  glow: 0, intensity: .2, smoothing: .15, lineWidth: 1.25 };
const blue = { scaleX:1, scaleY:1, x:0, y:0, color: '#2589ff', secondaryColor: '#2589ff', brightness: 1.25, saturation: 1.2,
  glow: 0, intensity: 1.4, smoothing: .8 };
const red = { scaleX:1, scaleY:1, x:0, y:0, color: '#ff3828', secondaryColor: '#ff3828', brightness: .8, saturation: 1.4,
  glow: 0, intensity: 1.4, smoothing: .8 };
const cases = [
  { name: 'blue-thin', aspect: 'landscape', hue: 'blue', controls: { ...blue, lineWidth: .2 } },
  { name: 'blue-thick', aspect: 'landscape', hue: 'blue', controls: { ...blue, lineWidth: 4 } },
  { name: 'red-thick', aspect: 'portrait', hue: 'red', controls: { ...red, lineWidth: 4, scaleX:.65, scaleY:1.2, x:.15, y:-.1 } },
  { name: 'gray-reactive', aspect: 'portrait', hue: 'gray', controls: { ...red, brightness: 1.5,
    saturation: 0, glow: .15, intensity: 10, smoothing: 2, lineWidth: 2 } },
];
const sliders = { brightness: '明るさ', saturation: '彩度', glow: '光の広がり', intensity: '音への反応',
  smoothing: '動きの滑らかさ', lineWidth: '線の太さ', scaleX: 'スタイルの横拡大率', scaleY: 'スタイルの縦拡大率', x: 'スタイルの横位置', y: 'スタイルの縦位置' };

async function stylesPanel() {
  await expect(page.getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
  await openInspector(page, 'カラー・動き');
}
async function editLayer(number) {
  await stylesPanel();
  await page.getByRole('button', { name: `レイヤー${number}を編集`, exact: true }).click();
  await expect(page.getByRole('button', { name: `レイヤー${number}を編集`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await openInspector(page, 'カラー・動き');
  await expect(page.locator('.layer-edit-target')).toContainText(`レイヤー${number}を編集中`);
  if (await page.locator('.style-transform-controls').getAttribute('open') === null) await page.getByText('サイズ・位置', { exact: true }).click();
}
async function setControls(value) {
  await page.getByLabel('カスタムカラー', { exact: true }).fill(value.color);
  await page.getByLabel('サブカラー', { exact: true }).fill(value.secondaryColor);
  for (const [key, label] of Object.entries(sliders)) await page.getByRole('slider', { name: label, exact: true }).fill(String(value[key]));
}
async function expectControls(value) {
  await expect(page.getByLabel('カスタムカラー', { exact: true })).toHaveValue(value.color);
  await expect(page.getByLabel('サブカラー', { exact: true })).toHaveValue(value.secondaryColor);
  for (const [key, label] of Object.entries(sliders)) await expect(page.getByRole('slider', { name: label, exact: true })).toHaveValue(String(value[key]));
}

/** Integrate the complete wave region and its vertical energy profile, excluding text. */
function frameStats(rgb, width, height) {
  const bins = new Array(24).fill(0);
  const y0 = Math.floor(height * .06), y1 = Math.floor(height * .7);
  let pixels = 0, bright = 0, blueCount = 0, redCount = 0, blueEnergy = 0, redEnergy = 0;
  let signal = 0, brightSpread = 0;
  for (let y = y0; y < y1; y++) for (let x = Math.floor(width * .06); x < Math.floor(width * .94); x++) {
    const p = (y * width + x) * 3, r = rgb[p], g = rgb[p + 1], b = rgb[p + 2];
    const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b);
    const blueAmount = Math.max(0, b - Math.max(r, g)), redAmount = Math.max(0, r - Math.max(g, b));
    blueEnergy += blueAmount; redEnergy += redAmount;
    if (maximum > 20) {
      bright++; brightSpread += maximum - minimum;
      if (b > r + 15 && b > g + 15) blueCount++;
      if (r > g + 15 && r > b + 15) redCount++;
    }
    signal += maximum; bins[Math.min(23, Math.floor((y - y0) / (y1 - y0) * 24))] += maximum;
    pixels++;
  }
  let pink = 0;
  for (let y = Math.floor(height * .73); y < Math.floor(height * .85); y++) for (let x = Math.floor(width * .1); x < Math.floor(width * .9); x++) {
    const p = (y * width + x) * 3;
    if (rgb[p] > 180 && rgb[p + 1] < 110 && rgb[p + 2] > 50 && rgb[p + 2] < 180) pink++;
  }
  return { blueCount, redCount, blueFraction: blueCount / pixels, redFraction: redCount / pixels,
    blueEnergy: blueEnergy / pixels, redEnergy: redEnergy / pixels, meanSignal: signal / pixels,
    brightFraction: bright / pixels, brightMeanSpread: bright ? brightSpread / bright : 0,
    rowProfile: bins.map(value => signal ? value / signal : 0), pinkPixels: pink };
}
function decodeRGB(file, width, height, last = false) {
  const args = ['-v', 'error', '-i', file];
  if (last) args.push('-vf', 'select=eq(n\\,29)', '-vsync', '0');
  args.push('-frames:v', '1', '-threads', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1');
  const rgb = execFileSync(ffmpeg, args, { maxBuffer: width * height * 3 + 1024 });
  assert.equal(rgb.length, width * height * 3); return rgb;
}
async function previewFrame(name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const snapshot = await page.locator('.preview-column canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height, png: canvas.toDataURL('image/png') }));
  const file = path.join(diagnostics, `${name}-preview.png`), png = Buffer.from(snapshot.png.split(',')[1], 'base64');
  await writeFile(file, png);
  return { stats: frameStats(decodeRGB(file, snapshot.width, snapshot.height), snapshot.width, snapshot.height),
    digest: createHash('sha256').update(png).digest('hex') };
}
const profileDistance = (a, b) => a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0);

try {
  const audio = path.join(temporary, 'レイヤー別調整の検証音源.wav');
  execFileSync(ffmpeg, ['-v', 'error', '-i', path.resolve('dist/demo.wav'), '-t', '1', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', audio]);
  const args = ['.'];
  if (process.platform === 'linux' && process.env.STUDIO_TEST_NO_SANDBOX === '1') args.unshift('--no-sandbox', '--disable-gpu');
  app = await electron.launch({ args, timeout: 30_000 });
  app.on('window', window => window.on('pageerror', error => pageErrors.push(error.message)));
  page = await app.firstWindow(); page.on('pageerror', error => pageErrors.push(error.message));
  await expect(page.locator('h1')).toHaveText('音楽を、映像に。');
  await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, audio);
  await page.locator('.drop-zone').click();
  await expect(page.locator('.drop-zone strong')).toHaveText('レイヤー別調整の検証音源.wav', { timeout: 30_000 });
  await expect(page.locator('.time-total')).toHaveText('0:01');
  await editLayer('01');
  await page.locator('.sidebar .style-card').filter({ hasText: 'Spectrum' }).click();
  await setControls(base); await expectControls(base);
  await page.getByLabel('背景色', { exact: true }).fill('#000000');
  await editLayer('02');
  await page.locator('.sidebar .style-card').filter({ hasText: 'Silk Wave' }).click();
  await stylesPanel();
  await expect(page.getByRole('combobox', { name: 'ベースのスタイル', exact: true })).toHaveValue('spectrum');
  await expect(page.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue('wave');
  await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('1');
  await page.getByRole('combobox', { name: '合成方法', exact: true }).selectOption('screen');
  await openInspector(page, 'テキスト');
  await page.getByPlaceholder('曲名を入力（任意）').fill('LAYER TEST');
  await page.getByPlaceholder('アーティスト名を入力（任意）').fill('01 / 02 · 独立した色と動き');
  await page.getByRole('slider', { name: '文字サイズ', exact: true }).fill('70');
  await page.getByLabel('文字色', { exact: true }).fill('#ff245f');
  await page.getByRole('button', { name: '太字', exact: true }).click();
  await page.getByRole('slider', { name: '再生位置', exact: true }).fill('0.967');
  await page.evaluate(() => {
    window.layerExportEvents = [];
    window.studio.onExportProgress(event => window.layerExportEvents.push(event));
  });

  for (const value of cases) {
    const width = value.aspect === 'portrait' ? 1080 : 1920, height = value.aspect === 'portrait' ? 1920 : 1080;
    await page.getByRole('button', { name: value.aspect === 'portrait' ? '縦 9:16' : '横 16:9' }).click();
    await editLayer('02'); await setControls(value.controls); await expectControls(value.controls);
    // Selecting and modifying 02 must leave all eight controls on 01 intact.
    await editLayer('01'); await expectControls(base);
    await expect(page.getByLabel('背景色', { exact: true })).toHaveValue('#000000');
    await editLayer('02'); await expectControls(value.controls);
    const preview = await previewFrame(value.name);
    let unreactive;
    if (value.controls.intensity === 10) {
      await page.getByRole('slider', { name: '音への反応', exact: true }).fill('0');
      await page.getByRole('slider', { name: '動きの滑らかさ', exact: true }).fill('0');
      unreactive = await previewFrame('gray-unreactive');
      assert.notEqual(unreactive.digest, preview.digest, 'Per-layer reaction/smoothing must change the rendered wave');
      assert.ok(profileDistance(unreactive.stats.rowProfile, preview.stats.rowProfile) > .35, 'High reaction must visibly change wave distribution');
      await page.getByRole('slider', { name: '音への反応', exact: true }).fill('10');
      await page.getByRole('slider', { name: '動きの滑らかさ', exact: true }).fill('2');
      await expectControls(value.controls);
      assert.equal((await previewFrame(`${value.name}-restored`)).digest, preview.digest, 'Restored settings must reproduce the same frame');
    }
    const output = path.join(temporary, `${value.name}.mp4`), decoded = path.join(diagnostics, `${value.name}-last-frame.png`);
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, output);
    await page.evaluate(() => { window.layerExportEvents = []; });
    const begun = Date.now();
    await expect(page.locator('.export-button')).toBeInViewport({ ratio: 1 });
    await page.locator('.export-button').click();
    await page.getByRole('button',{name:'この設定で書き出す',exact:true}).click();
    const mixHeader = page.getByRole('region', { name: 'レイヤー合成', exact: true });
    await expect(mixHeader).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'レイヤー01を編集', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'レイヤー02を編集', exact: true })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'ベースのスタイル', exact: true })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: '合成方法', exact: true })).toBeDisabled();
    await expect(page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true })).toBeDisabled();
    await page.waitForFunction(() => window.layerExportEvents.some(event => ['complete', 'error', 'cancelled'].includes(event.state)), undefined, { timeout: 180_000 });
    const event = await page.evaluate(() => window.layerExportEvents.findLast(value => ['complete', 'error', 'cancelled'].includes(value.state)));
    assert.equal(event.state, 'complete', event.message || event.state); assert.equal(event.path, output);
    await expect(mixHeader).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'レイヤー02を編集', exact: true })).toBeEnabled();
    const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output], { encoding: 'utf8' }));
    const video = probe.streams.find(stream => stream.codec_type === 'video'), sound = probe.streams.find(stream => stream.codec_type === 'audio');
    assert.ok(video && sound); assert.equal(video.codec_name, 'h264'); assert.equal(sound.codec_name, 'aac');
    assert.equal(video.width, width); assert.equal(video.height, height); assert.equal(video.pix_fmt, 'yuv420p');
    assert.equal(video.nb_frames, '30'); assert.equal(video.r_frame_rate, '30/1'); assert.ok(Math.abs(Number(probe.format.duration) - 1) < .08);
    execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', output, '-vf', 'select=eq(n\\,29)', '-vsync', '0', '-frames:v', '1', '-threads', '1', decoded]);
    const png = await readFile(decoded); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const exported = frameStats(decodeRGB(output, width, height, true), width, height);
    const distance = profileDistance(preview.stats.rowProfile, exported.rowProfile);
    assert.ok(distance < .4, `${value.name}: preview/export spatial profile differs (${distance})`);
    if (value.hue === 'gray') {
      assert.ok(exported.brightFraction > .001 && exported.brightMeanSpread < 10, '02 grayscale grade must reach the MP4 without hiding its wave');
      assert.ok(profileDistance(unreactive.stats.rowProfile, exported.rowProfile) > .35, 'MP4 must contain the high-reaction wave, not the unreactive shape');
    } else {
      const energy = `${value.hue}Energy`, opposite = value.hue === 'blue' ? 'redEnergy' : 'blueEnergy';
      const ratio = exported[energy] / Math.max(.000001, preview.stats[energy]);
      assert.ok(exported[energy] > .02 && exported[energy] > exported[opposite] * 5, `${value.name}: wrong overlay color in MP4`);
      assert.ok(ratio > .35 && ratio < 2.8, `${value.name}: preview/export colored energy differs (${ratio})`);
    }
    assert.ok(exported.pinkPixels > 400, 'Foreground text must retain its pink color despite independent layer grades');
    results.push({ name: value.name, aspect: value.aspect, width, height, controls: value.controls, base,
      frames: 30, fps: '30/1', duration: Number(probe.format.duration), elapsedMs: Date.now() - begun,
      preview: preview.stats, exported, profileDistance: distance, unreactive: unreactive?.stats });
    console.log(`PASS: ${value.name} ${width}x${height}, H.264/AAC, 30 frames / 1 second; layer controls and preview/export pixels match`);
  }
  const thin = results.find(value => value.name === 'blue-thin').exported;
  const thick = results.find(value => value.name === 'blue-thick').exported;
  assert.ok(thick.blueEnergy > thin.blueEnergy * 4, 'Thicker 02 lines must increase integrated blue color in the encoded video');
  assert.ok(thick.blueFraction > thin.blueFraction * 3, 'Thicker 02 lines must occupy more colored pixels in the encoded video');
  assert.equal(results.length, cases.length); assert.deepEqual(pageErrors, []); success = true;
  console.log(`PASS: independent layer settings preserved; 0.2x → 4x line width increases MP4 blue energy ${(thick.blueEnergy / thin.blueEnergy).toFixed(2)}x`);
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  if (page) await page.screenshot({ path: path.join(diagnostics, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  try { if (app) await app.close(); }
  finally {
    await rm(temporary, { recursive: true, force: true });
    await writeFile(path.join(diagnostics, 'metrics.json'), JSON.stringify({ startedAt, success, failure, pageErrors, results }, null, 2) + '\n');
  }
}
