import { openInspector } from './inspector';
import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const additions = [
  {id:'superformula',title:'Superformula Sculpture'},
  {id:'string-art',title:'String Canopy'},
  {id:'fireflies',title:'Firefly Grove'},
  {id:'circuit',title:'Circuit Pulse'},
  {id:'gravity-well',title:'Gravity Well'},
  {id:'stained-glass',title:'Stained Glass'},
  {id:'paper-fan',title:'Folding Fan'},
  {id:'bubbles',title:'Bubble Chamber'},
];

async function canvasPixels(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return page.locator('.preview-column canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
}

test('field foregrounds are distinct, audio-reactive, reproducible and numerically safe at maximum controls', async ({ page }) => {
  await page.goto('/');
  const { results, gallery } = await page.evaluate(async entries => {
    const renderPath = '/src/visuals/render.ts', sharedPath = '/src/shared.ts';
    const { renderScene } = await import(renderPath) as typeof import('../../src/visuals/render');
    const { defaultSettings, FEATURE_STRIDE } = await import(sharedPath) as typeof import('../../src/shared');
    const audio = (loud: boolean) => {
      const data = new Float32Array(180 * FEATURE_STRIDE);
      if (loud) for (let frame = 0; frame < 180; frame++) {
        const offset = frame * FEATURE_STRIDE;
        data[offset] = .75; data[offset + 1] = .8; data[offset + 3] = .9;
        // Treble stays at zero and glow below is disabled: ambient dots and glow
        // are identical, so changed pixels must come from the foreground.
        for (let band = 0; band < 48; band++) data[offset + 4 + band] = .2 + Math.sin(band * .47) ** 2 * .6;
      }
      return { duration: 3, fps: 60, data, peaks: [] };
    };
    const quiet = audio(false), loud = audio(true);
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { alpha: false })!;
    const pixels = () => context.getImageData(0, 0, canvas.width, canvas.height).data;
    const fingerprint = (values: Uint8ClampedArray) => {
      let hash = 2166136261;
      for (const value of values) hash = Math.imul(hash ^ value, 16777619);
      return hash >>> 0;
    };
    // Canvas may silently ignore invalid geometry. Trap numeric arguments to
    // exercise the real renderer rather than merely looking for page errors.
    const prototype = CanvasRenderingContext2D.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    const methods = ['moveTo', 'lineTo', 'arc', 'ellipse', 'bezierCurveTo', 'quadraticCurveTo', 'rect', 'roundRect',
      'translate', 'rotate', 'scale', 'transform', 'setTransform', 'fillRect', 'clearRect', 'createLinearGradient', 'createRadialGradient'];
    const originals = new Map<string, (...args: unknown[]) => unknown>();
    let numericCalls = 0;
    const results: { id: string; aspect: string; quiet: number; loud: number; repeated: number; changed: number;
      maximum: number; repeatedMaximum: number; zero: number }[] = [];
    try {
      for (const name of methods) {
        const original = prototype[name]; originals.set(name, original);
        prototype[name] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
          for (const value of args) if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${name}: non-finite geometry`);
          if (name === 'arc' && Number(args[2]) < 0) throw new Error('Negative arc radius');
          numericCalls++;
          return original.apply(this, args);
        };
      }
      for (const aspect of ['landscape', 'portrait'] as const) {
        canvas.width = aspect === 'landscape' ? 640 : 360; canvas.height = aspect === 'landscape' ? 360 : 640;
        for (const entry of entries) {
          const settings = structuredClone(defaultSettings); settings.style = entry.id as typeof settings.style;
          settings.aspect = aspect; settings.glow = 0; settings.lineGlowEnabled = true; settings.lineGlowStrength = 3; settings.lineGlowDistance = 80; settings.title = ''; settings.artist = '';
          renderScene(context, canvas.width, canvas.height, 1.25, settings, quiet); const quietPixels = pixels();
          renderScene(context, canvas.width, canvas.height, 1.25, settings, loud); const loudPixels = pixels();
          let changed = 0;
          for (let i = 0; i < quietPixels.length; i += 4) {
            if (quietPixels[i] !== loudPixels[i] || quietPixels[i + 1] !== loudPixels[i + 1] || quietPixels[i + 2] !== loudPixels[i + 2]) changed++;
          }
          renderScene(context, canvas.width, canvas.height, 2.1, settings, loud);
          renderScene(context, canvas.width, canvas.height, 1.25, settings, quiet); const repeated = fingerprint(pixels());
          settings.intensity = 0; settings.smoothing = 2;
          renderScene(context, canvas.width, canvas.height, 1.25, settings, loud); const zero = fingerprint(pixels());
          settings.intensity = 10;
          renderScene(context, canvas.width, canvas.height, 1.25, settings, loud); const maximum = fingerprint(pixels());
          renderScene(context, canvas.width, canvas.height, 2.75, settings, loud);
          renderScene(context, canvas.width, canvas.height, 1.25, settings, loud); const repeatedMaximum = fingerprint(pixels());
          results.push({ id: entry.id, aspect, quiet: fingerprint(quietPixels), loud: fingerprint(loudPixels), repeated,
            changed, maximum, repeatedMaximum, zero });
        }
      }
    } finally { for (const [name, original] of originals) prototype[name] = original; }
    if (numericCalls < 1000) throw new Error('Geometry guards did not exercise the renderers');

    const gallery = document.createElement('canvas'); gallery.width = 640; gallery.height = 720;
    const galleryContext = gallery.getContext('2d')!;
    canvas.width = 320; canvas.height = 180;
    entries.forEach((entry, i) => {
      const settings = structuredClone(defaultSettings); settings.style = entry.id as typeof settings.style;
      settings.color = '#67e8d0'; settings.secondaryColor = '#c79cff'; settings.title = ''; settings.artist = '';
      renderScene(context, 320, 180, 1.25, settings, loud);
      const x = i % 2 * 320, y = Math.floor(i / 2) * 180;
      galleryContext.drawImage(canvas, x, y);
      galleryContext.fillStyle = '#080d13d9'; galleryContext.fillRect(x, y + 158, 320, 22);
      galleryContext.fillStyle = '#e5eee3'; galleryContext.font = '12px sans-serif';
      galleryContext.fillText(entry.title, x + 10, y + 174);
    });
    return { results, gallery: gallery.toDataURL().split(',')[1] };
  }, additions);
  for (const result of results) {
    expect(result.changed, `${result.id} ${result.aspect}: foreground must respond to sound`).toBeGreaterThan(50);
    expect(result.repeated, `${result.id}: seeking back must reproduce pixels`).toBe(result.quiet);
    expect(result.repeatedMaximum, `${result.id}: maximum settings must remain deterministic`).toBe(result.maximum);
    expect(result.maximum, `${result.id}: 1000% must visibly differ from zero response`).not.toBe(result.zero);
  }
  for (const aspect of ['landscape', 'portrait']) {
    expect(new Set(results.filter(r => r.aspect === aspect).map(r => r.loud)).size, `${aspect}: eight distinct styles`).toBe(8);
  }
  await mkdir('.cache', { recursive: true });
  await writeFile('.cache/field-gallery.png', Buffer.from(gallery, 'base64'));
});

test('all eight field styles can be searched and assigned to either layer at 1000% response', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 900, height: 640 });
  await page.goto('/');
  await page.getByRole('button', { name: 'サンプル音源で試す' }).click();
  await expect(page.locator('.drop-zone strong')).toContainText('Midnight Bloom.wav');
  await page.getByRole('slider', { name: '再生位置', exact: true }).fill('1.25');
  await page.getByRole('slider', { name: '音への反応', exact: true }).fill('10');
  await page.getByRole('slider', { name: '動きの滑らかさ', exact: true }).fill('2');
  await expect(page.getByRole('slider', { name: '音への反応', exact: true })).toHaveValue('10');
  await expect(page.getByRole('slider', { name: '動きの滑らかさ', exact: true })).toHaveValue('2');
  await expect(page.getByRole('banner').getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
  const base = page.getByRole('combobox', { name: 'ベースのスタイル', exact: true });
  const overlay = page.getByRole('combobox', { name: '重ねるスタイル', exact: true });
  await overlay.selectOption(additions[0].id);
  await openInspector(page, 'カラー・動き');
  await page.getByRole('slider', { name: '音への反応', exact: true }).fill('10');
  await page.getByRole('slider', { name: '動きの滑らかさ', exact: true }).fill('2');
  await expect(page.getByRole('banner').getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
  const frames: string[] = [];
  for (let i = 0; i < additions.length; i++) {
    const style = additions[i], second = additions[(i + 1) % additions.length];
    await page.getByRole('button', { name: 'レイヤー01を編集', exact: true }).click();
    await page.getByPlaceholder('スタイルを検索').fill(style.title);
    const card = page.locator('.sidebar .style-card');
    await expect(card).toHaveCount(1); await card.click();
    await expect(base).toHaveValue(style.id);
    await base.selectOption(style.id); await overlay.selectOption(second.id);
    await expect(overlay).toHaveValue(second.id);
    frames.push(await canvasPixels(page));
  }
  expect(new Set(frames).size).toBe(8);
  expect(await page.evaluate(() => {
    const e = document.scrollingElement!; return [e.scrollWidth - e.clientWidth, e.scrollHeight - e.clientHeight, scrollX, scrollY];
  })).toEqual([0, 0, 0, 0]);
  await expect(page.locator('.export-button')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.drag-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});
