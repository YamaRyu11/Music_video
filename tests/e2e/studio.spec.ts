import { openInspector } from './inspector';
import { test, expect } from '@playwright/test';
import path from 'node:path';

test('sample analysis, playback, seeking, styles and portrait preview work', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '音楽を、映像に。' })).toBeVisible();
  await page.getByRole('button', { name: 'サンプル音源で試す' }).click();
  await expect(page.locator('.drop-zone strong')).toContainText('Midnight Bloom.wav');
  await expect(page.locator('.time-total')).toHaveText('0:08');
  await page.getByRole('button', { name: '再生', exact: true }).click();
  await expect(page.getByRole('button', { name: '一時停止' })).toBeVisible();
  await expect(page.locator('.time-current')).not.toHaveText('0:00');
  await page.getByRole('button', { name: '一時停止' }).click();
  await page.getByRole('slider', { name: '再生位置' }).fill('4');
  await expect(page.locator('.time-current')).toHaveText('0:04');
  const canvas = page.locator('canvas'); const before = await canvas.screenshot();
  // Paused frames must not accumulate brightness or depend on preview frame count.
  await page.waitForTimeout(300);
  expect(Buffer.compare(before, await canvas.screenshot())).toBe(0);
  await page.getByRole('button', { name: /Spectrum 音の輪郭/ }).click();
  await expect(page.getByRole('button', { name: /Spectrum 音の輪郭/ })).toHaveAttribute('aria-pressed', 'true');
  expect(Buffer.compare(before, await canvas.screenshot())).not.toBe(0);
  await page.getByRole('button', { name: /Particle Flow/ }).click();
  await page.getByRole('button', { name: '縦 9:16' }).click();
  await expect(page.locator('.preview-top')).toContainText('1080 × 1920');
  await expect(canvas).toHaveAttribute('width', '432');
  await expect(canvas).toHaveAttribute('height', '768');
  await openInspector(page, 'テキスト');
  await page.getByPlaceholder('アーティスト名を入力（任意）').fill('サンプルアーティスト');
  await expect(page.getByRole('button', { name: '動画を書き出す' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('new styles, grading, layer blending and independent typography change the actual preview', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'サンプル音源で試す' }).click();
  await expect(page.locator('.drop-zone strong')).toContainText('Midnight Bloom.wav');
  await page.getByRole('slider', { name: '再生位置' }).fill('2');
  const image = async () => {
    // Compare the rendered canvas pixels, independent of page scrolling/viewport sampling.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    return Buffer.from(await page.locator('canvas').evaluate(c => (c as HTMLCanvasElement).toDataURL()));
  };
  const frames = [];
  for (const name of ['Silk Wave', 'Pulse Tunnel', 'Aurora']) {
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveAttribute('aria-pressed', 'true');
    frames.push((await image()).toString('base64'));
  }
  expect(new Set(frames).size).toBe(3);
  const aurora = await image();
  await page.getByRole('button', { name: 'Violet', exact: true }).click();
  expect(Buffer.compare(aurora, await image())).not.toBe(0);
  await page.getByRole('slider', { name: '彩度', exact: true }).fill('0');
  const gray = await image();
  await page.getByRole('slider', { name: '彩度', exact: true }).fill('1');
  expect(Buffer.compare(gray, await image())).not.toBe(0);
  const base = await image();
  await expect(page.getByRole('banner').getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: '重ねるスタイル' }).selectOption('spectrum');
  await page.getByRole('slider', { name: 'レイヤーの不透明度' }).fill('0');
  expect(Buffer.compare(base, await image())).toBe(0);
  await page.getByRole('slider', { name: 'レイヤーの不透明度' }).fill('0.8');
  const screen = await image(); expect(Buffer.compare(base, screen)).not.toBe(0);
  await page.getByRole('combobox', { name: '合成方法' }).selectOption('multiply');
  expect(Buffer.compare(screen, await image())).not.toBe(0);
  await page.getByRole('combobox', { name: '重ねるスタイル' }).selectOption('none');
  expect(Buffer.compare(base, await image())).toBe(0);

  await openInspector(page, 'テキスト');
  await page.getByPlaceholder('曲名を入力（任意）').fill('夜の音楽 — Midnight');
  await page.getByPlaceholder('アーティスト名を入力（任意）').fill('Artist');
  const plainText = await image();
  await page.getByRole('slider', { name: '文字サイズ', exact: true }).fill('90');
  await page.getByRole('combobox', { name: 'フォント', exact: true }).selectOption('serif');
  await page.getByLabel('文字色', { exact: true }).fill('#ff95b5');
  await page.getByRole('button', { name: '太字', exact: true }).click();
  await page.getByRole('button', { name: '斜体', exact: true }).click();
  expect(Buffer.compare(plainText, await image())).not.toBe(0);
  await page.getByRole('button', { name: 'アーティストを編集' }).click();
  await expect(page.getByRole('slider', { name: '文字サイズ', exact: true })).toHaveValue('22');
  await page.getByRole('slider', { name: '文字サイズ', exact: true }).fill('36');
  await page.getByRole('button', { name: 'タイトルを編集' }).click();
  await expect(page.getByRole('slider', { name: '文字サイズ', exact: true })).toHaveValue('90');
  await expect(page.getByRole('button', { name: '太字', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const visible = await image();
  await page.getByRole('checkbox', { name: 'テキストを表示' }).uncheck();
  expect(Buffer.compare(visible, await image())).not.toBe(0);
  await page.getByRole('button', { name: 'カスタマイズをリセット' }).click();
  await expect(page.getByRole('banner').getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '重ねるスタイル' })).toHaveValue('none');
  await openInspector(page, 'テキスト');
  await expect(page.getByRole('slider', { name: '文字サイズ', exact: true })).toHaveValue('42');
  await expect(page.getByPlaceholder('曲名を入力（任意）')).toHaveValue('夜の音楽 — Midnight');
  expect(errors).toEqual([]);
});

test('imports a WAV file and rejects a non-audio file without losing the source', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('音源ファイル').setInputFiles(path.resolve('public/demo.wav'));
  await expect(page.locator('.drop-zone strong')).toHaveText('demo.wav');
  await page.getByLabel('音源ファイル').setInputFiles({ name: 'wrong.txt', mimeType: 'text/plain', buffer: Buffer.from('no audio') });
  await expect(page.getByRole('alert')).toContainText('WAV または MP3');
  await expect(page.locator('.drop-zone strong')).toHaveText('demo.wav');
});
