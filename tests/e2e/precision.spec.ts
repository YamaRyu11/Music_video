import { test, expect, type Locator, type Page } from '@playwright/test';

async function number(slider: Locator) { return Number(await slider.inputValue()); }
async function moveDrag(page: Page, slider: Locator, shift: boolean) {
  await slider.fill('5');
  const box = await slider.boundingBox();
  expect(box).not.toBeNull();
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  const start = await number(slider);
  await page.mouse.move(box!.x + box!.width * .7, box!.y + box!.height / 2, { steps: 10 });
  const end = await number(slider);
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  return { start, end, delta: end - start };
}

test('Shift dragging moves ten times more precisely and does not jump on first press', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: '音への反応', exact: true });
  const normal = await moveDrag(page, slider, false);
  const fine = await moveDrag(page, slider, true);
  expect(normal.delta).toBeGreaterThan(1.8);
  expect(fine.start).toBe(5);
  expect(fine.delta).toBeGreaterThan(.18);
  expect(normal.delta / fine.delta).toBeCloseTo(10, 1);

  await slider.fill('3.125');
  const box = (await slider.boundingBox())!;
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + box.width * .85, box.y + box.height / 2);
  await page.keyboard.up('Shift');
  await expect(slider).toHaveValue('3.125');
  await expect(slider.locator('..').locator('output')).toHaveText('312.5%');
});

test('pressing or releasing Shift during a drag preserves the current value', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: '音への反応', exact: true });
  await slider.fill('5');
  const box = (await slider.boundingBox())!, y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .6, y, { steps: 5 });
  const beforeShift = await number(slider);
  await page.keyboard.down('Shift');
  expect(await number(slider)).toBe(beforeShift);
  await page.mouse.move(box.x + box.width * .7, y, { steps: 5 });
  const afterFineMove = await number(slider);
  expect(afterFineMove - beforeShift).toBeCloseTo(.1, 2);
  await page.keyboard.up('Shift');
  expect(await number(slider)).toBe(afterFineMove);
  await page.mouse.move(box.x + box.width * .8, y, { steps: 5 });
  expect(await number(slider) - afterFineMove).toBeCloseTo(1, 1);
  await page.mouse.up();
});

test('range limits, keyboard precision and both expanded maximums are usable', async ({ page }) => {
  await page.goto('/');
  const intensity = page.getByRole('slider', { name: '音への反応', exact: true });
  const smoothing = page.getByRole('slider', { name: '動きの滑らかさ', exact: true });
  await expect(intensity).toHaveAttribute('max', '10');
  await expect(smoothing).toHaveAttribute('max', '2');
  await intensity.fill('1'); await intensity.focus();
  await page.keyboard.press('ArrowRight');
  await expect(intensity).toHaveValue('1.05');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(intensity).toHaveValue('1.055');
  await expect(intensity.locator('..').locator('output')).toHaveText('105.5%');
  await page.keyboard.press('End'); await expect(intensity).toHaveValue('10');
  await page.keyboard.press('ArrowRight'); await expect(intensity).toHaveValue('10');
  await page.keyboard.press('Home'); await expect(intensity).toHaveValue('0');
  await page.keyboard.press('Shift+ArrowLeft'); await expect(intensity).toHaveValue('0');
  await smoothing.fill('2');
  await expect(smoothing.locator('..').locator('output')).toHaveText('200%');
  await intensity.fill('10');
  const canvas = page.locator('.preview-stage canvas');
  expect(await canvas.evaluate(c => (c as HTMLCanvasElement).toDataURL().length)).toBeGreaterThan(1000);
});

test('disabled fieldsets ignore pointer edits and cancellation releases dragging', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: '音への反応', exact: true });
  await slider.fill('5');
  await slider.evaluate(element => { element.closest('fieldset')!.disabled = true; });
  await slider.dispatchEvent('pointerdown', { pointerId: 23, pointerType: 'mouse', clientX: 300, clientY: 200, button: 0 });
  await slider.dispatchEvent('pointermove', { pointerId: 23, pointerType: 'mouse', clientX: 800, clientY: 200, buttons: 1 });
  await expect(slider).toHaveValue('5');
  await slider.evaluate(element => { element.closest('fieldset')!.disabled = false; });
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await slider.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
  const cancelled = await number(slider);
  await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2);
  expect(await number(slider)).toBe(cancelled);
  await page.mouse.up();
});

test('smoothing at 200 percent includes a longer audio history than 100 percent', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const analysisModule = '/src/audio/analysis.ts', sharedModule = '/src/shared.ts';
    const { sampleFeatures } = await import(analysisModule);
    const { FEATURE_STRIDE } = await import(sharedModule);
    const data = new Float32Array(120 * FEATURE_STRIDE);
    data.fill(1, 30 * FEATURE_STRIDE, 31 * FEATURE_STRIDE);
    const analysis = { duration: 2, fps: 60, data, peaks: [] };
    return { normal: sampleFeatures(analysis, .85, 1).level, extended: sampleFeatures(analysis, .85, 2).level };
  });
  expect(result.normal).toBe(0);
  expect(result.extended).toBeGreaterThan(.005);
});
