import { _electron as electron, expect } from '@playwright/test';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'musicvideo-bitmap-'));
const diagnostics = path.resolve('.cache/bitmap-export-tests');
const platform = process.platform === 'win32' ? 'win32-x64/ffmpeg.exe' : 'linux-x64/ffmpeg';
const ffmpeg = path.resolve(`node_modules/@ffmpeg-installer/${platform}`);
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const startedAt = new Date().toISOString(), exports = [], pageErrors = [];
let app, page, success = false, failure;
await mkdir(diagnostics, { recursive: true });

/** Measure reproducible side strips, outside the spectrum bars and foreground text. */
function backgroundStats(rgb, width, height) {
  let r = 0, g = 0, b = 0, luma = 0, squares = 0, spread = 0, red = 0, count = 0;
  for (const [left, right] of [[.02, .07], [.93, .98]]) {
    for (let y = Math.floor(height * .1); y < Math.floor(height * .68); y++) {
      for (let x = Math.floor(width * left); x < Math.floor(width * right); x++) {
        const index = (y * width + x) * 3, cr = rgb[index], cg = rgb[index + 1], cb = rgb[index + 2];
        const level = cr * .2126 + cg * .7152 + cb * .0722;
        r += cr; g += cg; b += cb; luma += level; squares += level * level;
        spread += Math.max(cr, cg, cb) - Math.min(cr, cg, cb);
        if (cr > cb + 45 && cr > cg + 45) red++;
        count++;
      }
    }
  }
  assert.ok(count > 0);
  const meanLuma = luma / count;
  return { rgb: [r / count, g / count, b / count], meanLuma,
    lumaStd: Math.sqrt(Math.max(0, squares / count - meanLuma ** 2)), meanSpread: spread / count, redFraction: red / count };
}

function rgbFrame(file, width, height, lastFrame = false) {
  const args = ['-v', 'error', '-i', file];
  if (lastFrame) args.push('-vf', 'select=eq(n\\,29)', '-vsync', '0');
  args.push('-frames:v', '1', '-threads', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1');
  const rgb = execFileSync(ffmpeg, args, { maxBuffer: width * height * 3 + 1024 });
  assert.equal(rgb.length, width * height * 3);
  return rgb;
}

async function previewStats(name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const snapshot = await page.locator('.preview-column canvas').evaluate(canvas => ({
    width: canvas.width, height: canvas.height, png: canvas.toDataURL('image/png'),
  }));
  const file = path.join(diagnostics, `${name}-preview.png`);
  await writeFile(file, Buffer.from(snapshot.png.split(',')[1], 'base64'));
  return backgroundStats(rgbFrame(file, snapshot.width, snapshot.height), snapshot.width, snapshot.height);
}

async function bitmapPanel() {
  await page.getByRole('button', { name: '背景ビットマップを編集', exact: true }).click();
  await expect(page.getByRole('tab', { name: '背景ビットマップ', exact: true })).toHaveAttribute('aria-selected', 'true');
}

try {
  const audio = path.join(temporary, '背景画像検証の音源.wav'), bitmap = path.join(temporary, '赤青ストライプ背景.png');
  execFileSync(ffmpeg, ['-v', 'error', '-i', path.resolve('dist/demo.wav'), '-t', '1', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', audio]);
  const args = ['.'];
  if (process.platform === 'linux' && process.env.STUDIO_TEST_NO_SANDBOX === '1') args.unshift('--no-sandbox', '--disable-gpu');
  app = await electron.launch({ args, timeout: 30_000 });
  app.on('window', window => window.on('pageerror', error => pageErrors.push(error.message)));
  page = await app.firstWindow(); page.on('pageerror', error => pageErrors.push(error.message));
  await expect(page.locator('h1')).toHaveText('音楽を、映像に。');

  // Original fixture: solid red on the left; alternating blue brightness on the right.
  // The blue stripes make Gaussian blur measurable without relying on random pixels.
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e52b2b'; ctx.fillRect(0, 0, 320, 360);
    for (let y = 0; y < 360; y += 12) {
      ctx.fillStyle = (y / 12) % 2 ? '#70a4ff' : '#2055d8'; ctx.fillRect(320, y, 320, 12);
    }
    return canvas.toDataURL('image/png');
  });
  await writeFile(bitmap, Buffer.from(fixture.split(',')[1], 'base64'));
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, audio);
  await page.locator('.drop-zone').click();
  await expect(page.locator('.drop-zone strong')).toHaveText('背景画像検証の音源.wav', { timeout: 30_000 });
  await expect(page.locator('.time-total')).toHaveText('0:01');
  await page.getByRole('button', { name: 'Ocean', exact: true }).click();
  await page.getByRole('slider', { name: '光の広がり', exact: true }).fill('0');
  await page.getByRole('slider', { name: '音への反応', exact: true }).fill('10');
  await page.getByRole('slider', { name: '動きの滑らかさ', exact: true }).fill('2');
  await expect(page.getByRole('slider', { name: '音への反応', exact: true })).toHaveValue('10');
  await expect(page.getByRole('slider', { name: '動きの滑らかさ', exact: true })).toHaveValue('2');
  await expect(page.getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'ベースのスタイル', exact: true }).selectOption('spectrum');
  await page.getByRole('combobox', { name: '重ねるスタイル', exact: true }).selectOption('none');
  await page.getByRole('tab', { name: 'テキスト', exact: true }).click();
  await page.getByPlaceholder('曲名を入力（任意）').fill('BITMAP TEST');
  await page.getByPlaceholder('アーティスト名を入力（任意）').fill('背景と映像・文字の合成検証');
  await page.getByRole('slider', { name: '文字サイズ', exact: true }).fill('70');
  await page.getByLabel('文字色', { exact: true }).fill('#ff245f');
  await page.getByRole('button', { name: '太字', exact: true }).click();
  await bitmapPanel();
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, bitmap);
  await page.getByRole('button', { name: '背景画像を選ぶ', exact: true }).click();
  await expect(page.locator('.bitmap-source-info strong')).toHaveText('赤青ストライプ背景.png', { timeout: 30_000 });
  await expect(page.getByRole('checkbox', { name: '背景画像を表示', exact: true })).toBeChecked();
  await page.getByRole('slider', { name: '再生位置', exact: true }).fill('0.967');
  await page.evaluate(() => {
    window.bitmapExportEvents = [];
    window.studio.onExportProgress(event => window.bitmapExportEvents.push(event));
  });

  const cases = [
    { name: 'cropped-blue', aspect: 'landscape', left: .5, top: 0, bottom: 0, blur: 6, saturation: 1, brightness: 1.1 },
    { name: 'blurred-gray', aspect: 'portrait', left: .55, top: .06, bottom: .04, blur: 80, saturation: 0, brightness: .65 },
  ];
  for (const value of cases) {
    const width = value.aspect === 'portrait' ? 1080 : 1920, height = value.aspect === 'portrait' ? 1920 : 1080;
    await page.getByRole('button', { name: value.aspect === 'portrait' ? '縦 9:16' : '横 16:9' }).click();
    await bitmapPanel();
    await page.getByRole('button', { name: 'トリミング', exact: true }).click();
    await page.getByRole('slider', { name: '左の切り抜き', exact: true }).fill(String(value.left));
    await page.getByRole('slider', { name: '右の切り抜き', exact: true }).fill('0');
    await page.getByRole('slider', { name: '上の切り抜き', exact: true }).fill(String(value.top));
    await page.getByRole('slider', { name: '下の切り抜き', exact: true }).fill(String(value.bottom));
    await page.getByRole('button', { name: 'エフェクト', exact: true }).click();
    await page.getByRole('slider', { name: '画像の彩度', exact: true }).fill(String(value.saturation));
    let baseline;
    if (!value.saturation) {
      await page.getByRole('slider', { name: 'ガウスぼかし', exact: true }).fill('0');
      await page.getByRole('slider', { name: '画像の明るさ', exact: true }).fill('1');
      baseline = await previewStats('gray-before-blur');
      assert.ok(baseline.lumaStd > 15, `Striped fixture must have measurable contrast: ${baseline.lumaStd}`);
    }
    await page.getByRole('slider', { name: 'ガウスぼかし', exact: true }).fill(String(value.blur));
    await page.getByRole('slider', { name: '画像の明るさ', exact: true }).fill(String(value.brightness));
    const preview = await previewStats(value.name);
    if (baseline) {
      assert.ok(preview.meanSpread < 8, `Bitmap saturation zero must produce gray (${preview.meanSpread})`);
      assert.ok(preview.lumaStd < baseline.lumaStd * .55, 'Gaussian blur must reduce stripe contrast, beyond the brightness change');
      assert.ok(preview.meanLuma < baseline.meanLuma * .8 && preview.meanLuma > baseline.meanLuma * .4, 'Bitmap brightness must reduce average luminance without hiding it');
    } else {
      assert.ok(preview.rgb[2] - preview.rgb[0] > 80, 'Cropping the left half must retain the blue half');
      assert.ok(preview.redFraction < .005, 'Cropped-out red pixels must not remain in the background');
    }

    const output = path.join(temporary, `${value.name}.mp4`), decoded = path.join(diagnostics, `${value.name}-last-frame.png`);
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, output);
    await page.evaluate(() => { window.bitmapExportEvents = []; });
    await page.locator('.export-button').click();
    await expect(page.getByRole('region', { name: 'レイヤー合成', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '背景ビットマップを編集', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '背景画像を追加・変更', exact: true })).toBeDisabled();
    await page.waitForFunction(() => window.bitmapExportEvents.some(event => ['complete', 'error', 'cancelled'].includes(event.state)), undefined, { timeout: 180_000 });
    const result = await page.evaluate(() => window.bitmapExportEvents.findLast(event => ['complete', 'error', 'cancelled'].includes(event.state)));
    assert.equal(result.state, 'complete', result.message || result.state); assert.equal(result.path, output);
    const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output], { encoding: 'utf8' }));
    const video = probe.streams.find(stream => stream.codec_type === 'video'), sound = probe.streams.find(stream => stream.codec_type === 'audio');
    assert.equal(video.codec_name, 'h264'); assert.equal(sound.codec_name, 'aac');
    assert.equal(video.width, width); assert.equal(video.height, height); assert.equal(video.pix_fmt, 'yuv420p');
    assert.equal(video.nb_frames, '30'); assert.equal(video.r_frame_rate, '30/1');
    assert.ok(Math.abs(Number(probe.format.duration) - 1) < .08);
    execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', output, '-vf', 'select=eq(n\\,29)', '-vsync', '0', '-frames:v', '1', '-threads', '1', decoded]);
    const png = await readFile(decoded); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const rgb = rgbFrame(output, width, height, true), exported = backgroundStats(rgb, width, height);
    for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(preview.rgb[channel] - exported.rgb[channel]) < 10,
      `${value.name}: preview/export background channel ${channel} differs (${preview.rgb[channel]} / ${exported.rgb[channel]})`);
    if (baseline) {
      assert.ok(exported.meanSpread < 8, 'Hidden render must also apply zero saturation to the bitmap');
      assert.ok(exported.lumaStd < baseline.lumaStd * .55, 'Hidden render must also apply Gaussian blur');
      assert.ok(exported.meanLuma > 20 && exported.meanLuma < baseline.meanLuma * .8, 'Hidden render must retain the dimmed bitmap');
    } else {
      assert.ok(exported.rgb[2] - exported.rgb[0] > 80 && exported.redFraction < .005, 'Hidden render must receive and crop the original bitmap bytes');
    }
    let pink = 0;
    for (let y = Math.floor(height * .73); y < Math.floor(height * .85); y++) for (let x = Math.floor(width * .1); x < Math.floor(width * .9); x++) {
      const p = (y * width + x) * 3;
      if (rgb[p] > 180 && rgb[p + 1] < 110 && rgb[p + 2] > 45 && rgb[p + 2] < 180) pink++;
    }
    assert.ok(pink > 400, 'Foreground pink text must retain its color above the bitmap effects');
    exports.push({ ...value, width, height, frames: 30, fps: '30/1', duration: Number(probe.format.duration),
      preview, exported, baseline, pinkPixels: pink, intensity: 10, smoothing: 2 });
    console.log(`PASS: ${value.name} (${value.aspect}) FullHD H.264/AAC, 30 frames / 1 second; bitmap pixels match preview, pink text retained`);
  }
  assert.equal(exports.length, 2); assert.deepEqual(pageErrors, []); success = true;
  console.log('PASS: original bitmap transfer, crop, Gaussian blur, saturation, brightness and 1000% reaction / 200% smoothing exports.');
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  if (page) await page.screenshot({ path: path.join(diagnostics, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  try { if (app) await app.close(); }
  finally {
    await rm(temporary, { recursive: true, force: true });
    await writeFile(path.join(diagnostics, 'metrics.json'), JSON.stringify({ startedAt, success, failure, pageErrors, exports }, null, 2) + '\n');
  }
}
