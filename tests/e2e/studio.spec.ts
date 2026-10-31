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
  await page.getByPlaceholder('アーティスト名を入力（任意）').fill('サンプルアーティスト');
  await expect(page.getByRole('button', { name: '動画を書き出す' })).toBeDisabled();
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
