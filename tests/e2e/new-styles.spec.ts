import { test, expect, type Page } from '@playwright/test';
import { styles, styleCategories } from '../../src/visuals/catalog';
const librarySize = styles.length;

const additions = [
  { id: 'laser', title: 'Laser Grid' },
  { id: 'bloom', title: 'Radial Bloom' },
  { id: 'stars', title: 'Star Drive' },
  { id: 'ink', title: 'Liquid Ink' },
  { id: 'kaleidoscope', title: 'Prism Kaleidoscope' },
  { id: 'contours', title: 'Contour Landscape' },
  { id: 'glitch', title: 'Glitch Blocks' },
  { id: 'lissajous', title: 'Lissajous' },
  { id: 'rain', title: 'Light Rain' },
  { id: 'typography', title: 'Reactive Typography' },
];

async function canvasPixels(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return page.locator('.preview-column canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
}

async function expectWindowFits(page: Page) {
  const size = await page.evaluate(() => {
    const e = document.scrollingElement!;
    return { width: e.scrollWidth - e.clientWidth, height: e.scrollHeight - e.clientHeight, x: scrollX, y: scrollY };
  });
  expect(size).toEqual({ width: 0, height: 0, x: 0, y: 0 });
  await expect(page.locator('.export-button')).toBeInViewport({ ratio: 1 });
}

test('all registered styles remain searchable and filterable in the compact library', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 640 });
  await page.goto('/');
  const cards = page.locator('.sidebar .style-card');
  const search = page.getByPlaceholder('スタイルを検索');
  const category = page.getByRole('combobox', { name: 'スタイルカテゴリ', exact: true });
  await expect(cards).toHaveCount(librarySize);
  for (const style of additions) {
    await search.fill(style.title);
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText(style.title);
    await expectWindowFits(page);
  }
  await search.fill('no-such-style-000');
  await expect(cards).toHaveCount(0);
  await search.clear();
  await expect(cards).toHaveCount(librarySize);

  const categorized = new Set<string>();
  for (const value of styleCategories.filter(c => c.id !== 'all').map(c => c.id)) {
    await category.selectOption(value);
    const count = await cards.count();
    expect(count, `${value} should filter the library`).toBeGreaterThan(0);
    expect(count).toBeLessThan(librarySize);
    for (const name of await cards.evaluateAll(elements => elements.map(e => e.getAttribute('aria-label')!))) categorized.add(name);
    await expectWindowFits(page);
  }
  expect(categorized.size).toBe(librarySize);
  await category.selectOption('all');
  await expect(cards).toHaveCount(librarySize);
});

test('each additional style renders a distinct repeatable preview in both orientations', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'サンプル音源で試す' }).click();
  await expect(page.locator('.drop-zone strong')).toContainText('Midnight Bloom.wav');
  await page.getByRole('slider', { name: '再生位置', exact: true }).fill('2');
  for (const aspect of ['横 16:9', '縦 9:16']) {
    await page.getByRole('button', { name: aspect, exact: true }).click();
    const frames: string[] = [];
    for (const style of additions) {
      await page.getByPlaceholder('スタイルを検索').fill(style.title);
      const card = page.locator('.sidebar .style-card');
      await expect(card).toHaveCount(1);
      await card.click();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.preview-top')).toContainText(style.title);
      const frame = await canvasPixels(page);
      expect(frame).toMatch(/^data:image\/png;base64,/);
      expect(await canvasPixels(page), `${style.title} should reproduce a paused frame`).toBe(frame);
      frames.push(frame);
    }
    expect(new Set(frames).size, `${aspect}: all ten styles need different imagery`).toBe(10);
    await expectWindowFits(page);
  }
  expect(errors).toEqual([]);
});

test('the typography library entry can be dragged into either layer and every new style is offered for both layers', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 900, height: 640 });
  await page.goto('/');
  await page.getByRole('tab', { name: 'レイヤー合成', exact: true }).click();
  const base = page.getByRole('combobox', { name: 'ベースのスタイル', exact: true });
  const overlay = page.getByRole('combobox', { name: '重ねるスタイル', exact: true });
  const baseIds = await base.locator('option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value));
  const overlayIds = await overlay.locator('option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value));
  for (const style of additions) {
    expect(baseIds).toContain(style.id); expect(overlayIds).toContain(style.id);
    await base.selectOption(style.id);
    await overlay.selectOption(style.id);
    await canvasPixels(page);
  }
  await overlay.selectOption('none');
  await base.selectOption('orbit');
  const last = page.locator('.sidebar .style-card').filter({ hasText: 'Reactive Typography' });
  await last.scrollIntoViewIfNeeded();
  await last.dragTo(page.locator('[data-layer-slot="02"]'));
  await expect(base).toHaveValue('orbit');
  await expect(overlay).toHaveValue('typography');
  await last.scrollIntoViewIfNeeded();
  await last.dragTo(page.locator('[data-layer-slot="01"]'));
  await expect(base).toHaveValue('typography');
  await expect(overlay).toHaveValue('typography');
  await expect(page.locator('.drag-overlay')).toHaveCount(0);
  await expectWindowFits(page);
  expect(errors).toEqual([]);
});

test('new foregrounds respond to audio features and reproduce the same frame after seeking', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async ids => {
    const renderPath = '/src/visuals/render.ts', sharedPath = '/src/shared.ts';
    const { renderScene } = await import(renderPath) as typeof import('../../src/visuals/render');
    const { defaultSettings, FEATURE_STRIDE } = await import(sharedPath) as typeof import('../../src/shared');
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const context = canvas.getContext('2d', { alpha: false })!;
    const audio = (loud: boolean) => {
      const data = new Float32Array(180 * FEATURE_STRIDE);
      if (loud) for (let frame = 0; frame < 180; frame++) {
        const at = frame * FEATURE_STRIDE;
        data[at] = .75; data[at + 1] = .8; data[at + 3] = .9;
        // Leave treble at zero so the ambient star opacity is identical to silence.
        for (let band = 0; band < 48; band++) data[at + 4 + band] = .2 + Math.sin(band * .47) ** 2 * .6;
      }
      return { duration: 3, fps: 60, data, peaks: [] };
    };
    const quiet = audio(false), loud = audio(true);
    const pixels = () => {
      // FNV-1a over actual RGBA pixels avoids transporting dozens of PNGs to the runner.
      let hash = 2166136261;
      for (const value of context.getImageData(0, 0, canvas.width, canvas.height).data) hash = Math.imul(hash ^ value, 16777619);
      return hash >>> 0;
    };
    return ids.map(id => {
      const settings = structuredClone(defaultSettings);
      settings.style = id as typeof settings.style;
      settings.title = 'Sound in motion';
      // Glow zero makes the ambient background independent of bass/level as well.
      settings.glow = 0;
      renderScene(context, 640, 360, 1.25, settings, quiet); const a = pixels();
      renderScene(context, 640, 360, 1.25, settings, loud); const b = pixels();
      renderScene(context, 640, 360, 2.1, settings, loud);
      renderScene(context, 640, 360, 1.25, settings, quiet); const repeated = pixels();
      return { id, quiet: a, loud: b, repeated };
    });
  }, additions.map(style => style.id));
  for (const result of results) {
    expect(result.loud, `${result.id} foreground should react to audio`).not.toBe(result.quiet);
    expect(result.repeated, `${result.id} should not depend on previous frames`).toBe(result.quiet);
  }
  expect(new Set(results.map(result => result.loud)).size).toBe(10);
});
