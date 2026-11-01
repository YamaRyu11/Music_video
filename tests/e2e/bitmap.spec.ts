import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 900, height: 640 } });

async function openBitmapPanel(page: Page) {
  await page.goto('/');
  // Neutral graphics keep pixel measurements about the bitmap, not the accent palette.
  await page.getByLabel('カスタムカラー', { exact: true }).fill('#ffffff');
  await page.getByLabel('サブカラー', { exact: true }).fill('#ffffff');
  await page.getByLabel('背景色', { exact: true }).fill('#000000');
  await page.getByRole('slider', { name: '光の広がり', exact: true }).fill('0');
  await page.getByRole('tab', { name: 'レイヤー合成', exact: true }).click();
  await page.getByRole('tab', { name: '背景ビットマップ', exact: true }).click();
}

async function nextFrame(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function canvasPixels(page: Page) {
  await nextFrame(page);
  return page.locator('.preview-column canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
}

async function stats(page: Page) {
  await nextFrame(page);
  return page.locator('.preview-column canvas').evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let red = 0, blue = 0, green = 0, magenta = 0, chroma = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 110 && r > g * 1.55 && r > b * 1.3) red++;
      if (b > 110 && b > r * 1.4 && b > g * 1.3) blue++;
      if (g > 180 && b < 100 && g > r + 20) green++;
      if (r > 180 && b > 180 && g < 100) magenta++;
      chroma += Math.max(r, g, b) - Math.min(r, g, b);
    }
    let detail = 0, mean = 0, samples = 0;
    // Top-left area avoids the central visualizer and lower title.
    for (let y = Math.floor(canvas.height * .06); y < canvas.height * .22; y++) {
      for (let x = Math.floor(canvas.width * .06); x < canvas.width * .3; x++) {
        const at = (y * canvas.width + x) * 4;
        detail += Math.abs(data[at] - data[at + 4]); mean += data[at]; samples++;
      }
    }
    return { red, blue, green, magenta, chroma: chroma / (data.length / 4), detail: detail / samples, mean: mean / samples };
  });
}

async function fixture(page: Page, kind: 'split' | 'checker' | 'transparent' | 'red' = 'split', mime = 'image/png') {
  const encoded = await page.evaluate(({ kind, mime }) => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 100;
    const ctx = canvas.getContext('2d')!;
    if (kind === 'split') {
      ctx.fillStyle = '#e51e33'; ctx.fillRect(0, 0, 200, 100);
      ctx.fillStyle = '#184dff'; ctx.fillRect(200, 0, 200, 100);
      for (let y = 24; y < 76; y += 4) for (let x = 160; x < 240; x += 4) {
        ctx.fillStyle = ((x + y) / 4) % 2 ? '#ffffff' : '#151515'; ctx.fillRect(x, y, 4, 4);
      }
    } else if (kind === 'checker') {
      for (let y = 0; y < 100; y += 4) for (let x = 0; x < 400; x += 4) {
        ctx.fillStyle = ((x + y) / 4) % 2 ? '#ffffff' : '#000000'; ctx.fillRect(x, y, 4, 4);
      }
    } else if (kind === 'transparent') {
      ctx.fillStyle = '#e51e33'; ctx.fillRect(170, 30, 60, 40);
    } else {
      ctx.fillStyle = '#d00000'; ctx.fillRect(0, 0, 400, 100);
    }
    return canvas.toDataURL(mime, .95).split(',')[1];
  }, { kind, mime });
  return Buffer.from(encoded, 'base64');
}

function bmpFixture() {
  const width = 64, height = 32, stride = Math.ceil(width * 3 / 4) * 4;
  const bytes = Buffer.alloc(54 + stride * height);
  bytes.write('BM'); bytes.writeUInt32LE(bytes.length, 2); bytes.writeUInt32LE(54, 10);
  bytes.writeUInt32LE(40, 14); bytes.writeInt32LE(width, 18); bytes.writeInt32LE(height, 22);
  bytes.writeUInt16LE(1, 26); bytes.writeUInt16LE(24, 28); bytes.writeUInt32LE(stride * height, 34);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = 54 + y * stride + x * 3;
    bytes[at] = x < width / 2 ? 30 : 240; bytes[at + 1] = x < width / 2 ? 30 : 70; bytes[at + 2] = x < width / 2 ? 230 : 30;
  }
  return bytes;
}

async function load(page: Page, bytes: Buffer, name: string, mime = 'image/png') {
  await page.getByLabel('背景画像ファイル', { exact: true }).setInputFiles({ name, mimeType: mime, buffer: bytes });
  await expect(page.locator('.bitmap-source-info strong')).toHaveText(name);
  await nextFrame(page);
}

async function expectWindowFits(page: Page) {
  expect(await page.evaluate(() => {
    const e = document.scrollingElement!;
    return [e.scrollWidth - e.clientWidth, e.scrollHeight - e.clientHeight, scrollX, scrollY];
  })).toEqual([0, 0, 0, 0]);
  await expect(page.locator('.export-button')).toBeInViewport({ ratio: 1 });
}

test('bitmap placement and crop change the actual image while the compact workspace stays in the window', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await openBitmapPanel(page);
  const original = await canvasPixels(page);
  await load(page, await fixture(page), 'split.png');
  const full = await canvasPixels(page); expect(full).not.toBe(original);
  const uncut = await stats(page); expect(uncut.red).toBeGreaterThan(10000); expect(uncut.blue).toBeGreaterThan(10000);
  await page.getByRole('button', { name: '配置', exact: true }).click();
  for (const [label, value] of [['画像の拡大率', '1.8'], ['画像の横位置', '0.35'], ['画像の縦位置', '-0.25'], ['画像の回転', '35']]) {
    const before = await canvasPixels(page);
    await page.getByRole('slider', { name: label, exact: true }).fill(value);
    expect(await canvasPixels(page), `${label} should affect the bitmap`).not.toBe(before);
  }
  await page.getByRole('button', { name: '背景画像をリセット', exact: true }).click();
  expect(await canvasPixels(page)).toBe(full);
  await page.getByRole('button', { name: 'トリミング', exact: true }).click();
  await page.getByRole('slider', { name: '左の切り抜き', exact: true }).fill('0.45');
  const leftCut = await stats(page);
  expect(leftCut.red).toBeLessThan(uncut.red * .6); expect(leftCut.blue).toBeGreaterThan(leftCut.red * 2);
  await page.getByRole('button', { name: '背景画像をリセット', exact: true }).click();
  await page.getByRole('slider', { name: '右の切り抜き', exact: true }).fill('0.45');
  const rightCut = await stats(page);
  expect(rightCut.blue).toBeLessThan(uncut.blue * .6); expect(rightCut.red).toBeGreaterThan(rightCut.blue * 2);
  // The opposite crop already limits this native range to .5; End exercises that limit.
  await page.getByRole('slider', { name: '左の切り抜き', exact: true }).focus();
  await page.getByRole('slider', { name: '左の切り抜き', exact: true }).press('End');
  const left = Number(await page.getByRole('slider', { name: '左の切り抜き', exact: true }).inputValue());
  const right = Number(await page.getByRole('slider', { name: '右の切り抜き', exact: true }).inputValue());
  expect(left + right).toBeLessThanOrEqual(.950001);
  await page.getByRole('button', { name: '背景画像をリセット', exact: true }).click();
  await page.getByRole('slider', { name: '上の切り抜き', exact: true }).fill('0.2');
  const topCut = await canvasPixels(page); expect(topCut).not.toBe(full);
  await page.getByRole('slider', { name: '下の切り抜き', exact: true }).fill('0.2');
  expect(await canvasPixels(page)).not.toBe(topCut);
  await expectWindowFits(page);
  await page.getByRole('button', { name: '背景画像をリセット', exact: true }).click();
  await page.getByRole('button', { name: '縦 9:16', exact: true }).click();
  await page.getByRole('button', { name: '配置', exact: true }).click();
  const covered = await stats(page);
  await page.getByRole('combobox', { name: '画像の収め方', exact: true }).selectOption('contain');
  const contained = await stats(page);
  expect(contained.red + contained.blue).toBeLessThan((covered.red + covered.blue) * .4);
  await expectWindowFits(page);
  expect(errors).toEqual([]);
});

test('bitmap blur, saturation, brightness and opacity have measurable image effects', async ({ page }) => {
  await openBitmapPanel(page);
  const withoutImage = await canvasPixels(page);
  await load(page, await fixture(page, 'checker'), 'checker.png');
  await page.getByRole('button', { name: 'エフェクト', exact: true }).click();
  const sharp = await stats(page);
  await page.getByRole('slider', { name: 'ガウスぼかし', exact: true }).fill('30');
  const soft = await stats(page);
  expect(soft.detail).toBeLessThan(sharp.detail * .65);
  await page.getByRole('button', { name: '背景画像をリセット', exact: true }).click();
  await load(page, await fixture(page), 'colors.png');
  const color = await stats(page); expect(color.chroma).toBeGreaterThan(50);
  await page.getByRole('slider', { name: '画像の彩度', exact: true }).fill('0');
  expect((await stats(page)).chroma).toBeLessThan(color.chroma * .1);
  await page.getByRole('slider', { name: '画像の彩度', exact: true }).fill('1');
  const bright = await stats(page);
  await page.getByRole('slider', { name: '画像の明るさ', exact: true }).fill('0');
  expect((await stats(page)).mean).toBeLessThan(bright.mean * .05 + 1);
  await page.getByRole('button', { name: '背景画像をリセット', exact: true }).click();
  await page.getByRole('slider', { name: '画像の不透明度', exact: true }).fill('0');
  expect(await canvasPixels(page)).toBe(withoutImage);
  await expectWindowFits(page);
});

test('transparent PNG, visibility, invalid replacement and removal preserve the expected background', async ({ page }) => {
  await openBitmapPanel(page);
  const baseline = await canvasPixels(page);
  const corners = async () => page.locator('.preview-column canvas').evaluate(element => {
    const c = element as HTMLCanvasElement, ctx = c.getContext('2d')!;
    return [[.05, .05], [.95, .05], [.05, .95], [.95, .95]].map(([x, y]) => Array.from(ctx.getImageData(Math.floor(c.width * x), Math.floor(c.height * y), 1, 1).data));
  });
  const originalCorners = await corners();
  await load(page, await fixture(page, 'transparent'), 'transparent.png');
  const withImage = await canvasPixels(page); expect(withImage).not.toBe(baseline);
  expect(await corners()).toEqual(originalCorners);
  await page.getByRole('checkbox', { name: '背景画像を表示', exact: true }).uncheck();
  expect(await canvasPixels(page)).toBe(baseline);
  await page.getByRole('checkbox', { name: '背景画像を表示', exact: true }).check();
  expect(await canvasPixels(page)).toBe(withImage);
  await page.getByLabel('背景画像ファイル', { exact: true }).setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a valid PNG') });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.bitmap-source-info strong')).toHaveText('transparent.png');
  expect(await canvasPixels(page)).toBe(withImage);
  await page.getByRole('button', { name: '背景画像を削除', exact: true }).click();
  expect(await canvasPixels(page)).toBe(baseline);
  await expect(page.locator('.bitmap-source-info strong')).toHaveText('背景画像なし');
  await expect(page.getByRole('button', { name: '背景画像を削除', exact: true })).toBeDisabled();
  const transparent = await fixture(page, 'transparent');
  for (const brightness of ['0.5', '1.5']) {
    await page.getByRole('tab', { name: 'カラー・動き', exact: true }).click();
    await page.getByLabel('背景色', { exact: true }).fill('#804020');
    await page.getByRole('slider', { name: '彩度', exact: true }).fill('0');
    await page.getByRole('slider', { name: '明るさ', exact: true }).fill(brightness);
    await nextFrame(page);
    const gradedCorners = await corners();
    await page.getByRole('tab', { name: 'レイヤー合成', exact: true }).click();
    await page.getByRole('tab', { name: '背景ビットマップ', exact: true }).click();
    await load(page, transparent, 'transparent-grade.png');
    expect(await corners(), `transparent areas should retain background grading at brightness ${brightness}`).toEqual(gradedCorners);
    await page.getByRole('button', { name: 'エフェクト', exact: true }).click();
    await page.getByRole('slider', { name: '画像の不透明度', exact: true }).fill('0.001');
    await nextFrame(page);
    expect(await corners()).toEqual(gradedCorners);
    await page.getByRole('button', { name: '背景画像を削除', exact: true }).click();
  }
  await expectWindowFits(page);
});

test('PNG, JPEG, WebP and BMP decode into the bitmap layer', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await openBitmapPanel(page);
  for (const [name, mime] of [['sample.png', 'image/png'], ['sample.jpeg', 'image/jpeg'], ['sample.webp', 'image/webp']]) {
    await load(page, await fixture(page, 'split', mime), name, mime);
    const pixels = await stats(page);
    expect(pixels.red, name).toBeGreaterThan(10000); expect(pixels.blue, name).toBeGreaterThan(10000);
  }
  await load(page, bmpFixture(), 'sample.bmp', 'image/bmp');
  const bmp = await stats(page); expect(bmp.red).toBeGreaterThan(10000); expect(bmp.blue).toBeGreaterThan(10000);
  expect(errors).toEqual([]);
});

test('the bitmap stays behind visual styles, composition and editable text', async ({ page }) => {
  await openBitmapPanel(page);
  await load(page, await fixture(page, 'red'), 'red.png');
  await page.getByRole('tab', { name: 'スタイル合成', exact: true }).click();
  await page.getByRole('combobox', { name: '重ねるスタイル', exact: true }).selectOption('spectrum');
  await page.getByLabel('レイヤーの色', { exact: true }).fill('#00ff00');
  await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('1');
  await page.getByRole('tab', { name: 'テキスト', exact: true }).click();
  await page.getByPlaceholder('曲名を入力（任意）').fill('TEXT LAYER');
  await page.getByRole('slider', { name: '文字サイズ', exact: true }).fill('80');
  await page.getByLabel('文字色', { exact: true }).fill('#ff00ff');
  const combined = await stats(page);
  expect(combined.red).toBeGreaterThan(100000); expect(combined.green).toBeGreaterThan(100); expect(combined.magenta).toBeGreaterThan(100);
  await page.getByRole('tab', { name: 'レイヤー合成', exact: true }).click();
  await page.getByRole('tab', { name: '背景ビットマップ', exact: true }).click();
  await page.getByRole('checkbox', { name: '背景画像を表示', exact: true }).uncheck();
  const hidden = await stats(page);
  expect(hidden.red).toBeLessThan(combined.red * .1); expect(hidden.green).toBeGreaterThan(100); expect(hidden.magenta).toBeGreaterThan(100);
  await expectWindowFits(page);
});
