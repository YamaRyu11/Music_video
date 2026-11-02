import { test, expect, type Page } from '@playwright/test';

const composition = (page: Page) => page.getByRole('banner').getByRole('region', { name: 'レイヤー合成', exact: true });
const tabs = ['カラー・動き', '背景ビットマップ', 'テキスト'];
async function fits(page: Page) {
  const overflow = await page.evaluate(() => {
    const e = document.scrollingElement!;
    return [e.scrollWidth - e.clientWidth, e.scrollHeight - e.clientHeight, scrollX, scrollY];
  });
  expect(overflow).toEqual([0, 0, 0, 0]);
  await expect(composition(page)).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.export-button')).toBeInViewport({ ratio: 1 });
}

for (const viewport of [{ width: 900, height: 640 }, { width: 1440, height: 900 }]) {
  test(`composition remains in the header across every editor tab at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.goto('/');
    const header = composition(page);
    for (const aspect of ['landscape', 'portrait']) {
      await page.getByRole('button', { name: aspect === 'portrait' ? '縦 9:16' : '横 16:9', exact: true }).click();
      if (viewport.width === 900 && aspect === 'landscape') {
        await page.getByLabel('音源ファイル', { exact: true }).setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not audio') });
        await expect(page.getByRole('alert').first()).toBeVisible();
      }
      for (const name of tabs) {
        await page.getByRole('tab', { name, exact: true }).click();
        if (viewport.width === 900 && aspect === 'landscape' && name === '背景ビットマップ') {
          await page.getByLabel('背景画像ファイル', { exact: true }).setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
          await expect(page.getByRole('alert').first()).toBeVisible();
        }
        await expect(header.getByRole('button', { name: '背景ビットマップを編集', exact: true })).toBeInViewport({ ratio: 1 });
        await expect(header.getByRole('button', { name: 'レイヤー01を編集', exact: true })).toBeInViewport({ ratio: 1 });
        await expect(header.getByRole('button', { name: 'レイヤー02を編集', exact: true })).toBeInViewport({ ratio: 1 });
        await expect(header.getByRole('combobox', { name: 'ベースのスタイル', exact: true })).toBeVisible();
        await expect(header.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toBeVisible();
        await expect(header.getByRole('combobox', { name: '合成方法', exact: true })).toBeVisible();
        await expect(header.getByRole('slider', { name: 'レイヤーの不透明度', exact: true })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'レイヤー合成', exact: true })).toHaveCount(0);
        await expect(page.getByRole('tab', { name: 'スタイル合成', exact: true })).toHaveCount(0);
        await expect(page.getByLabel('レイヤーの色', { exact: true })).toHaveCount(0);
        const box = (await page.locator('.preview-stage canvas').boundingBox())!;
        expect(box.width).toBeGreaterThan(30); expect(box.height).toBeGreaterThan(30);
        expect(box.width / box.height).toBeCloseTo(aspect === 'portrait' ? 9 / 16 : 16 / 9, 2);
        await fits(page);
      }
    }
  });
}

test('header colors and selected-layer colors edit the same values without ambiguous labels', async ({ page }) => {
  await page.goto('/');
  const header = composition(page);
  for (const layer of ['01', '02']) for (const color of ['メインカラー', 'サブカラー']) {
    await expect(page.getByLabel(`レイヤー${layer}の${color}`, { exact: true })).toHaveCount(1);
  }
  const main1 = header.getByLabel('レイヤー01のメインカラー', { exact: true });
  const sub1 = header.getByLabel('レイヤー01のサブカラー', { exact: true });
  const main2 = header.getByLabel('レイヤー02のメインカラー', { exact: true });
  const sub2 = header.getByLabel('レイヤー02のサブカラー', { exact: true });
  const baseColors = [await main1.inputValue(), await sub1.inputValue()];
  await header.getByRole('combobox', { name: '重ねるスタイル', exact: true }).selectOption('wave');
  await header.getByRole('button', { name: 'レイヤー02を編集', exact: true }).click();
  await main2.fill('#ee2244');
  await expect(page.getByLabel('カスタムカラー', { exact: true })).toHaveValue('#ee2244');
  await page.getByLabel('カスタムカラー', { exact: true }).fill('#22cc88');
  await expect(main2).toHaveValue('#22cc88');
  await sub2.fill('#3377aa');
  await expect(page.getByLabel('サブカラー', { exact: true })).toHaveValue('#3377aa');
  await page.getByLabel('サブカラー', { exact: true }).fill('#abcdef');
  await expect(sub2).toHaveValue('#abcdef');
  expect([await main1.inputValue(), await sub1.inputValue()]).toEqual(baseColors);
  await header.getByRole('button', { name: 'レイヤー01を編集', exact: true }).click();
  await expect(page.getByLabel('カスタムカラー', { exact: true })).toHaveValue(baseColors[0]);
  await expect(page.getByLabel('サブカラー', { exact: true })).toHaveValue(baseColors[1]);
  await page.getByRole('tab', { name: 'テキスト', exact: true }).click();
  await main2.fill('#aa33ff');
  await expect(page.getByRole('tab', { name: 'テキスト', exact: true })).toHaveAttribute('aria-selected', 'true');
  await header.getByRole('button', { name: 'レイヤー02を編集', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'テキスト', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'カラー・動き', exact: true }).click();
  await expect(page.getByLabel('カスタムカラー', { exact: true })).toHaveValue('#aa33ff');
  await expect(page.getByLabel('サブカラー', { exact: true })).toHaveValue('#abcdef');
});

test('header background editing and picking share one bitmap while style drops keep the current tab', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 640 }); await page.goto('/');
  const header = composition(page);
  await header.getByRole('button', { name: '背景ビットマップを編集', exact: true }).click();
  await expect(page.getByRole('tab', { name: '背景ビットマップ', exact: true })).toHaveAttribute('aria-selected', 'true');
  const encoded = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 24;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#5577bb'; ctx.fillRect(0, 0, 32, 24);
    return c.toDataURL().split(',')[1];
  });
  await expect(page.getByRole('button', { name: '背景画像を追加・変更', exact: true })).toHaveCount(1);
  await expect(page.getByLabel('背景画像ファイル', { exact: true })).toHaveCount(1);
  const chosen = page.waitForEvent('filechooser');
  await header.getByRole('button', { name: '背景画像を追加・変更', exact: true }).click();
  await (await chosen).setFiles({ name: 'header-background.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') });
  await expect(page.locator('.bitmap-source-info strong')).toHaveText('header-background.png');
  await page.locator('.sidebar .style-card').filter({ hasText: 'Silk Wave' }).dragTo(header.locator('[data-layer-slot="02"]'));
  await expect(page.getByRole('tab', { name: '背景ビットマップ', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(header.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue('wave');
  await expect(header.getByRole('button', { name: 'レイヤー02を編集', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.sidebar .style-card').filter({ hasText: 'Pulse Tunnel' }).dragTo(header.locator('[data-layer-slot="01"]'));
  await expect(page.getByRole('tab', { name: '背景ビットマップ', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(header.getByRole('combobox', { name: 'ベースのスタイル', exact: true })).toHaveValue('tunnel');
  await expect(header.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue('wave');
  await expect(page.locator('.bitmap-source-info strong')).toHaveText('header-background.png');
  await fits(page);
});
