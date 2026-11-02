import { openInspector } from './inspector';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function expectDocumentFits(page: Page) {
  const size = await page.evaluate(() => {
    const element = document.scrollingElement!;
    return {
      width: element.scrollWidth, height: element.scrollHeight,
      availableWidth: element.clientWidth, availableHeight: element.clientHeight,
      x: window.scrollX, y: window.scrollY,
    };
  });
  expect(size.width).toBeLessThanOrEqual(size.availableWidth + 1);
  expect(size.height).toBeLessThanOrEqual(size.availableHeight + 1);
  expect(size.x).toBe(0);
  expect(size.y).toBe(0);
}

for (const viewport of [{ width: 900, height: 640 }, { width: 900, height: 740 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test(`workspace fits ${viewport.width}×${viewport.height} with proportional preview and visible export`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (const aspect of ['landscape', 'portrait'] as const) {
      await page.getByRole('button', { name: aspect === 'portrait' ? '縦 9:16' : '横 16:9' }).click();
      const canvas = page.locator('.preview-column canvas');
      await expect(canvas).toBeVisible();
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(50);
      expect(box!.height).toBeGreaterThan(50);
      expect(box!.width / box!.height).toBeCloseTo(aspect === 'portrait' ? 9 / 16 : 16 / 9, 2);

      if (aspect === 'portrait') {
        const preview = await page.locator('.preview-column').boundingBox();
        const settings = await page.locator('.adjust-panel').boundingBox();
        expect(preview).not.toBeNull(); expect(settings).not.toBeNull();
        expect(settings!.x).toBeGreaterThanOrEqual(preview!.x + preview!.width - 1);
      }

      for (const name of ['カラー・動き', '背景ビットマップ', 'テキスト']) {
        await openInspector(page, name);
        await expectDocumentFits(page);
        await expect(page.locator('.export-button')).toBeInViewport({ ratio: 1 });
        await expect(canvas).toBeInViewport({ ratio: 1 });
      }
    }
  });
}

test('style cards can be dropped independently into both composition slots', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('banner').getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
  const base = page.getByRole('combobox', { name: 'ベースのスタイル', exact: true });
  const overlay = page.getByRole('combobox', { name: '重ねるスタイル', exact: true });

  // Record even transient audio-upload overlays while a style is dragged.
  await page.evaluate(() => {
    const observed: boolean[] = [];
    (window as unknown as { audioDragOverlays: boolean[] }).audioDragOverlays = observed;
    new MutationObserver(() => {
      if (document.querySelector('.drag-overlay')) observed.push(true);
    }).observe(document.body, { childList: true, subtree: true });
  });

  await page.locator('.sidebar .style-card').filter({ hasText: 'Silk Wave' }).dragTo(page.locator('[data-layer-slot="01"]'));
  await expect(base).toHaveValue('wave');
  await expect(overlay).toHaveValue('none');
  await page.locator('.sidebar .style-card').filter({ hasText: 'Pulse Tunnel' }).dragTo(page.locator('[data-layer-slot="02"]'));
  await expect(base).toHaveValue('wave');
  await expect(overlay).toHaveValue('tunnel');

  await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('0');
  await page.locator('.sidebar .style-card').filter({ hasText: 'Neon Orbit' }).dragTo(page.locator('[data-layer-slot="02"]'));
  await expect(base).toHaveValue('wave');
  await expect(overlay).toHaveValue('orbit');
  await expect(page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true })).toHaveValue('0');
  expect(await page.evaluate(() => (window as unknown as { audioDragOverlays: boolean[] }).audioDragOverlays)).toEqual([]);
  await expect(page.locator('.drag-overlay')).toHaveCount(0);
  await expectDocumentFits(page);
});

test('dropping a style selects the color inspector and the destination layer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openInspector(page, 'テキスト');
  const source = page.locator('.sidebar .style-card').filter({ hasText: 'Pulse Tunnel' });
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  expect(from).not.toBeNull();
  await page.evaluate(() => {
    const observed: boolean[] = [];
    (window as unknown as { audioDragOverlays: boolean[] }).audioDragOverlays = observed;
    new MutationObserver(() => {
      if (document.querySelector('.drag-overlay')) observed.push(true);
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(from!.x + from!.width / 2 + 20, from!.y + from!.height / 2 + 15, { steps: 5 });
    await expect(page.getByRole('region', { name: 'テキストの設定', exact: true })).toBeVisible();
    const to = await page.locator('[data-layer-slot="02"]').boundingBox();
    expect(to).not.toBeNull();
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 10 });
    // Chromium dispatches dragover after pointer movement has entered the target.
    await page.mouse.move(to!.x + to!.width / 2 + 2, to!.y + to!.height / 2 + 2);
  } finally { await page.mouse.up(); }
  await expect(page.getByRole('combobox', { name: 'ベースのスタイル', exact: true })).toHaveValue('orbit');
  await expect(page.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue('tunnel');
  await expect(page.getByRole('region', { name: 'カラー・動きの設定', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { audioDragOverlays: boolean[] }).audioDragOverlays)).toEqual([]);
  await expect(page.locator('.drag-overlay')).toHaveCount(0);
});

test('Escape cancels a style drag and clears the drop target highlight', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const source = page.locator('.sidebar .style-card').filter({ hasText: 'Silk Wave' });
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  expect(from).not.toBeNull();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(from!.x + from!.width / 2 + 20, from!.y + from!.height / 2 + 15, { steps: 5 });
    await expect(page.getByRole('region', { name: 'カラー・動きの設定', exact: true })).toBeVisible();
    const target = page.locator('[data-layer-slot="02"]');
    const to = await target.boundingBox();
    expect(to).not.toBeNull();
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 10 });
    await page.mouse.move(to!.x + to!.width / 2 + 2, to!.y + to!.height / 2 + 2);
    await expect(target).toHaveClass(/drop-target/);
    await page.keyboard.press('Escape');
  } finally { await page.mouse.up(); }
  await expect(page.locator('.drop-target')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'ベースのスタイル', exact: true })).toHaveValue('orbit');
  await expect(page.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue('none');
  await expect(page.getByRole('region', { name: 'カラー・動きの設定', exact: true })).toBeVisible();
  await expect(page.locator('.drag-overlay')).toHaveCount(0);
});

test('dropping an audio file over a layer imports the audio without changing either style', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('banner').getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
  const base = page.getByRole('combobox', { name: 'ベースのスタイル', exact: true });
  const overlay = page.getByRole('combobox', { name: '重ねるスタイル', exact: true });
  await base.selectOption('wave');
  await overlay.selectOption('tunnel');
  const bytes = (await readFile(path.resolve('public/demo.wav'))).toString('base64');
  const transfer = await page.evaluateHandle(encoded => {
    const data = new DataTransfer();
    const values = Uint8Array.from(atob(encoded), value => value.charCodeAt(0));
    data.items.add(new File([values], 'dropped.wav', { type: 'audio/wav' }));
    return data;
  }, bytes);
  try {
    await page.locator('[data-layer-slot="02"]').dispatchEvent('dragover', { dataTransfer: transfer });
    await expect(page.locator('.drag-overlay')).toBeVisible();
    await page.locator('[data-layer-slot="02"]').dispatchEvent('drop', { dataTransfer: transfer });
    await expect(page.locator('.drop-zone strong')).toHaveText('dropped.wav');
    await expect(base).toHaveValue('wave');
    await expect(overlay).toHaveValue('tunnel');
    await expect(page.locator('.drag-overlay')).toHaveCount(0);
  } finally { await transfer.dispose(); }
});
