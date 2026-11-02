import { test, expect, type Page } from '@playwright/test';

const motionLabels = ['明るさ', '彩度', '光の広がり', '音への反応', '動きの滑らかさ', '線の太さ'];
const edit = (page: Page, slot: '01' | '02') => page.getByRole('button', { name: `レイヤー${slot}を編集`, exact: true });
async function layers(page: Page) { await expect(page.getByRole('banner').getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible(); }
async function controls(page: Page, slot: '01' | '02') {
  await layers(page); await edit(page, slot).click();
  await page.getByRole('tab', { name: 'カラー・動き', exact: true }).click();
}
async function snapshot(page: Page) {
  return {
    main: await page.getByLabel('カスタムカラー', { exact: true }).inputValue(),
    secondary: await page.getByLabel('サブカラー', { exact: true }).inputValue(),
    values: await Promise.all(motionLabels.map(name => page.getByRole('slider', { name, exact: true }).inputValue())),
  };
}
async function pixels(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return page.locator('.preview-stage canvas').evaluate(c => (c as HTMLCanvasElement).toDataURL());
}
async function chooseLibrary(page: Page, title: string) {
  await page.getByRole('combobox', { name: 'スタイルカテゴリ', exact: true }).selectOption('all');
  await page.getByRole('textbox', { name: 'スタイルを検索', exact: true }).fill('');
  await page.locator('.sidebar .style-card').filter({ hasText: title }).click();
}

test('layer cards support keyboard selection, none, and matching library selection', async ({ page }) => {
  await page.goto('/'); await layers(page);
  await expect(edit(page, '01')).toHaveAttribute('aria-pressed', 'true');
  await edit(page, '02').focus(); await page.keyboard.press('Enter');
  await expect(edit(page, '02')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sidebar .style-card[aria-pressed="true"]')).toHaveCount(0);
  await chooseLibrary(page, 'Silk Wave');
  await expect(page.getByRole('combobox', { name: 'ベースのスタイル', exact: true })).toHaveValue('orbit');
  await expect(page.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue('wave');
  await expect(page.locator('.sidebar .style-card[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('.sidebar .style-card').filter({ hasText: 'Silk Wave' })).toHaveAttribute('aria-pressed', 'true');
  await edit(page, '01').focus(); await page.keyboard.press('Space');
  await expect(edit(page, '01')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sidebar .style-card').filter({ hasText: 'Neon Orbit' })).toHaveAttribute('aria-pressed', 'true');
  await edit(page, '02').click();
  await page.getByRole('combobox', { name: '重ねるスタイル', exact: true }).selectOption('none');
  await page.getByRole('tab', { name: 'テキスト', exact: true }).click();
  await layers(page);
  await expect(edit(page, '02')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sidebar .style-card[aria-pressed="true"]')).toHaveCount(0);
});

test('layer controls, palettes, global background and reset retain their own scope', async ({ page }) => {
  await page.goto('/'); await controls(page, '01');
  await page.getByLabel('カスタムカラー', { exact: true }).fill('#ff8844');
  await page.getByLabel('サブカラー', { exact: true }).fill('#44ff88');
  for (const [i, value] of ['0.75', '0.5', '0.25', '3.2', '1.25', '2.3'].entries()) await page.getByRole('slider', { name: motionLabels[i], exact: true }).fill(value);
  await page.getByLabel('背景色', { exact: true }).fill('#010203');
  const base = await snapshot(page);
  await layers(page); await edit(page, '02').click(); await chooseLibrary(page, 'Silk Wave');
  await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('0.65');
  await page.getByRole('combobox', { name: '合成方法', exact: true }).selectOption('lighter');
  await page.getByRole('tab', { name: 'カラー・動き', exact: true }).click();
  const overlayDefaults = await snapshot(page);
  await page.getByLabel('カスタムカラー', { exact: true }).fill('#12abef');
  await page.getByLabel('サブカラー', { exact: true }).fill('#abcdef');
  for (const [i, value] of ['1.25', '1.8', '0.8', '6', '1.7', '4.4'].entries()) await page.getByRole('slider', { name: motionLabels[i], exact: true }).fill(value);
  await page.getByRole('button', { name: 'Ocean', exact: true }).click();
  const overlay = await snapshot(page);
  expect(overlay.main).toBe('#67e8d0'); expect(overlay.secondary).toBe('#79acff');
  await expect(page.getByLabel('背景色', { exact: true })).toHaveValue('#010203');
  await controls(page, '01'); expect(await snapshot(page)).toEqual(base);
  await controls(page, '02'); expect(await snapshot(page)).toEqual(overlay);
  await layers(page);
  await page.getByRole('combobox', { name: '重ねるスタイル', exact: true }).selectOption('none');
  await chooseLibrary(page, 'Silk Wave');
  await page.getByRole('tab', { name: 'カラー・動き', exact: true }).click();
  expect(await snapshot(page)).toEqual(overlay);
  await page.getByRole('tab', { name: 'テキスト', exact: true }).click();
  await page.getByPlaceholder('曲名を入力（任意）').fill('Keep this title');
  await page.getByRole('tab', { name: 'カラー・動き', exact: true }).click();
  await page.getByRole('button', { name: 'カスタマイズをリセット', exact: true }).click();
  expect(await snapshot(page)).toEqual(overlayDefaults);
  await expect(page.getByLabel('背景色', { exact: true })).toHaveValue('#010203');
  await layers(page);
  await expect(page.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue('wave');
  await expect(page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true })).toHaveValue('0.65');
  await expect(page.getByRole('combobox', { name: '合成方法', exact: true })).toHaveValue('lighter');
  await controls(page, '01'); expect(await snapshot(page)).toEqual(base);
  await page.getByRole('tab', { name: 'テキスト', exact: true }).click();
  await expect(page.getByPlaceholder('曲名を入力（任意）')).toHaveValue('Keep this title');
});

test('overlay color, motion, smoothing, grade and stroke width affect pixels without leaking into base', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.getByRole('button', { name: 'サンプル音源で試す', exact: true }).click();
  await expect(page.locator('.drop-zone strong')).toContainText('Midnight Bloom.wav');
  await page.getByRole('slider', { name: '再生位置', exact: true }).fill('2');
  await layers(page); await edit(page, '02').click(); await chooseLibrary(page, 'Silk Wave');
  await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('0');
  const baseImage = await pixels(page);
  await page.getByRole('tab', { name: 'カラー・動き', exact: true }).click();
  await page.getByRole('slider', { name: '明るさ', exact: true }).fill('0.5');
  await page.getByRole('slider', { name: '彩度', exact: true }).fill('0');
  await page.getByRole('slider', { name: '音への反応', exact: true }).fill('4');
  expect(await pixels(page)).toBe(baseImage);
  await layers(page); await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('1');
  await page.getByRole('tab', { name: 'カラー・動き', exact: true }).click();
  const dim = await pixels(page);
  await page.getByRole('slider', { name: '明るさ', exact: true }).fill('1.5');
  expect(await pixels(page)).not.toBe(dim);
  await page.getByRole('slider', { name: '彩度', exact: true }).fill('1');
  const beforeColor = await pixels(page);
  await page.getByLabel('カスタムカラー', { exact: true }).fill('#ff245f');
  expect(await pixels(page)).not.toBe(beforeColor);
  await page.getByRole('slider', { name: '音への反応', exact: true }).fill('0.5');
  const lowReaction = await pixels(page);
  await page.getByRole('slider', { name: '音への反応', exact: true }).fill('4');
  expect(await pixels(page)).not.toBe(lowReaction);
  await page.getByRole('slider', { name: '動きの滑らかさ', exact: true }).fill('0');
  const sharp = await pixels(page);
  await page.getByRole('slider', { name: '動きの滑らかさ', exact: true }).fill('2');
  expect(await pixels(page)).not.toBe(sharp);
  await page.getByRole('slider', { name: '線の太さ', exact: true }).fill('0.2');
  const thin = await pixels(page);
  await page.getByRole('slider', { name: '線の太さ', exact: true }).fill('4');
  expect(await pixels(page)).not.toBe(thin);
  const composite = await pixels(page);
  await controls(page, '01'); expect(await pixels(page)).toBe(composite);
  await expect(page.getByRole('slider', { name: '明るさ', exact: true })).toHaveValue('1');
  await expect(page.getByRole('slider', { name: '音への反応', exact: true })).toHaveValue('1');
  await expect(page.getByRole('slider', { name: '線の太さ', exact: true })).toHaveValue('1');
  expect(errors).toEqual([]);
});

test('drops select the destination layer while cancelling a drag preserves the editing target', async ({ page }) => {
  await page.goto('/'); await layers(page);
  await page.locator('.sidebar .style-card').filter({ hasText: 'Silk Wave' }).dragTo(page.locator('[data-layer-slot="02"]'));
  await expect(edit(page, '02')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'ベースのスタイル', exact: true })).toHaveValue('orbit');
  await expect(page.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue('wave');
  await expect(page.locator('.sidebar .style-card').filter({ hasText: 'Silk Wave' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.sidebar .style-card').filter({ hasText: 'Pulse Tunnel' }).dragTo(page.locator('[data-layer-slot="01"]'));
  await expect(edit(page, '01')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'ベースのスタイル', exact: true })).toHaveValue('tunnel');
  await expect(page.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue('wave');
  await edit(page, '01').click();
  const sourceCard = page.locator('.sidebar .style-card').filter({ hasText: 'Pulse Tunnel' });
  await sourceCard.scrollIntoViewIfNeeded();
  const source = (await sourceCard.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
  try {
    await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2 + 12, { steps: 5 });
    const target = page.locator('[data-layer-slot="02"]'), box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
    await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2 + 2);
    await expect(target).toHaveClass(/drop-target/);
    await page.keyboard.press('Escape');
  } finally { await page.mouse.up(); }
  await expect(edit(page, '01')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: '重ねるスタイル', exact: true })).toHaveValue('wave');
  await expect(page.locator('.drop-target')).toHaveCount(0);
  await expect(page.locator('.drag-overlay')).toHaveCount(0);
});

test('selected-layer stroke width supports Shift precision without global scrolling on a small window', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 640 });
  await page.goto('/'); await layers(page); await edit(page, '02').click(); await chooseLibrary(page, 'Silk Wave');
  await page.getByRole('tab', { name: 'カラー・動き', exact: true }).click();
  const width = page.getByRole('slider', { name: '線の太さ', exact: true });
  await expect(width).toHaveAttribute('min', '0.1'); await expect(width).toHaveAttribute('max', '5');
  await width.focus(); await page.keyboard.press('Home'); await expect(width).toHaveValue('0.1');
  await page.keyboard.press('Shift+ArrowRight'); await expect(width).toHaveValue('0.105');
  await expect(width.locator('..').locator('output')).toHaveText('10.5%');
  await page.keyboard.press('End'); await expect(width).toHaveValue('5');
  await controls(page, '01'); await expect(page.getByRole('slider', { name: '線の太さ', exact: true })).toHaveValue('1');
  await controls(page, '02'); await expect(page.getByRole('slider', { name: '線の太さ', exact: true })).toHaveValue('5');
  const size = await page.evaluate(() => ({ scroll: document.scrollingElement!.scrollHeight, height: document.scrollingElement!.clientHeight, y: window.scrollY }));
  expect(size.scroll).toBeLessThanOrEqual(size.height + 1); expect(size.y).toBe(0);
  await expect(page.locator('.export-button')).toBeInViewport({ ratio: 1 });
});
