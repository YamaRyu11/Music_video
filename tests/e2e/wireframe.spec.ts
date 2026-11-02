import { test, expect, type Page } from '@playwright/test';
import { styles } from '../../src/visuals/catalog';

const wireStyles = styles.filter(style => style.category === 'wireframe');

async function canvasPixels(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return page.locator('.preview-column canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
}

async function expectWindowFits(page: Page) {
  const overflow = await page.evaluate(() => {
    const e = document.scrollingElement!;
    return { width: e.scrollWidth - e.clientWidth, height: e.scrollHeight - e.clientHeight, x: scrollX, y: scrollY };
  });
  expect(overflow).toEqual({ width: 0, height: 0, x: 0, y: 0 });
  await expect(page.locator('.export-button')).toBeInViewport({ ratio: 1 });
}

test('the wireframe worlds retain distinct proportional previews and reproduce a seeked frame', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 900, height: 640 });
  await page.goto('/');
  await page.getByRole('button', { name: 'サンプル音源で試す' }).click();
  await expect(page.locator('.drop-zone strong')).toContainText('Midnight Bloom.wav');
  await page.getByRole('combobox', { name: 'スタイルカテゴリ', exact: true }).selectOption('wireframe');
  await expect(page.locator('.sidebar .style-card')).toHaveCount(wireStyles.length);

  for (const aspect of ['landscape', 'portrait'] as const) {
    await page.getByRole('button', { name: aspect === 'portrait' ? '縦 9:16' : '横 16:9', exact: true }).click();
    const frames: string[] = [];
    for (const style of wireStyles) {
      const card = page.locator('.sidebar .style-card').filter({ hasText: style.title });
      await card.click();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.preview-top')).toContainText(style.title);
      await page.getByRole('slider', { name: '再生位置', exact: true }).fill('2.5');
      const original = await canvasPixels(page);
      await page.getByRole('slider', { name: '再生位置', exact: true }).fill('6');
      const advanced = await canvasPixels(page);
      expect(advanced, `${style.title} should advance through its world`).not.toBe(original);
      await page.getByRole('slider', { name: '再生位置', exact: true }).fill('2.5');
      expect(await canvasPixels(page), `${style.title} should not depend on rendering history`).toBe(original);
      frames.push(original);
      const canvas = await page.locator('.preview-column canvas').boundingBox();
      expect(canvas!.width / canvas!.height).toBeCloseTo(aspect === 'portrait' ? 9 / 16 : 16 / 9, 2);
      await expectWindowFits(page);
    }
    expect(new Set(frames).size, `${aspect} needs distinct wireframe worlds`).toBe(wireStyles.length);
  }
  expect(errors).toEqual([]);
});

test('all wireframe styles work in both composition slots and support drag assignment', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 900, height: 640 });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'スタイルカテゴリ', exact: true }).selectOption('wireframe');
  await expect(page.getByRole('banner').getByRole('region', { name: 'レイヤー合成', exact: true })).toBeVisible();
  const base = page.getByRole('combobox', { name: 'ベースのスタイル', exact: true });
  const overlay = page.getByRole('combobox', { name: '重ねるスタイル', exact: true });
  for (let i = 0; i < wireStyles.length; i++) {
    await base.selectOption(wireStyles[i].id);
    await overlay.selectOption(wireStyles[(i + 1) % wireStyles.length].id);
    await canvasPixels(page);
  }
  await page.locator('.sidebar .style-card').filter({ hasText: 'Wireframe Metropolis' }).dragTo(page.locator('[data-layer-slot="02"]'));
  await expect(overlay).toHaveValue('wire-city');
  await page.locator('.sidebar .style-card').filter({ hasText: 'Wireframe Journey' }).dragTo(page.locator('[data-layer-slot="01"]'));
  await expect(base).toHaveValue('terrain');
  await expect(overlay).toHaveValue('wire-city');
  await expect(page.locator('.drag-overlay')).toHaveCount(0);
  await expectWindowFits(page);
  expect(errors).toEqual([]);
});

test('terrain worlds depend on the song history and timbre even when the current features and travel match', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const renderPath = '/src/visuals/render.ts', trackPath = '/src/visuals/terrain-track.ts';
    const sharedPath = '/src/shared.ts', analysisPath = '/src/audio/analysis.ts';
    const { renderScene } = await import(renderPath) as typeof import('../../src/visuals/render');
    const { buildTerrainTrack, travelAt } = await import(trackPath) as typeof import('../../src/visuals/terrain-track');
    const { defaultSettings, FEATURE_STRIDE } = await import(sharedPath) as typeof import('../../src/shared');
    const { sampleFeatures } = await import(analysisPath) as typeof import('../../src/audio/analysis');
    const fixture = (history: 'low' | 'high') => {
      const data = new Float32Array(480 * FEATURE_STRIDE);
      for (let frame = 0; frame < 480; frame++) {
        const at = frame * FEATURE_STRIDE, inHistory = frame < 180;
        // Equal loudness and zero onsets make both tracks travel the same distance.
        data[at] = .5; data[at + 1] = inHistory ? history === 'low' ? .85 : .12 : .4;
        data[at + 2] = inHistory ? history === 'high' ? .85 : .12 : .4;
        for (let band = 0; band < 48; band++) data[at + 4 + band] = !inHistory ? .35
          : history === 'low' ? band < 18 ? .85 : .08 : band >= 18 ? .85 : .08;
      }
      return { duration: 8, fps: 60, data, peaks: [] };
    };
    const lowHistory = fixture('low'), highHistory = fixture('high');
    const lowTrack = buildTerrainTrack(lowHistory), highTrack = buildTerrainTrack(highHistory);
    const settings = structuredClone(defaultSettings); settings.style = 'terrain'; settings.title = ''; settings.artist = ''; settings.glow = 0;
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    renderScene(ctx, 640, 360, 4.5, settings, lowHistory); const lowWorld = canvas.toDataURL();
    renderScene(ctx, 640, 360, 4.5, settings, highHistory); const highWorld = canvas.toDataURL();
    renderScene(ctx, 640, 360, 6.5, settings, highHistory);
    renderScene(ctx, 640, 360, 4.5, settings, lowHistory); const repeated = canvas.toDataURL();
    return {
      currentLow: sampleFeatures(lowHistory, 4.5, settings.smoothing), currentHigh: sampleFeatures(highHistory, 4.5, settings.smoothing),
      travelLow: travelAt(lowTrack, 4.5), travelHigh: travelAt(highTrack, 4.5),
      seedLow: lowTrack.seed, seedHigh: highTrack.seed, timbreLow: lowTrack.timbre, timbreHigh: highTrack.timbre,
      lowWorld, highWorld, repeated,
    };
  });
  expect(result.currentLow).toEqual(result.currentHigh);
  expect(result.travelLow).toBeCloseTo(result.travelHigh, 6);
  expect(result.seedLow).not.toBe(result.seedHigh);
  expect(result.timbreLow).toBeLessThan(result.timbreHigh);
  expect(result.lowWorld, 'the world should not be just a fixed terrain scaled by the current RMS').not.toBe(result.highWorld);
  expect(result.repeated).toBe(result.lowWorld);
});

test('mountain sides react independently and world heights stay pinned while the camera moves', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const renderPath = '/src/visuals/render.ts', trackPath = '/src/visuals/terrain-track.ts';
    const terrainPath = '/src/visuals/wire-terrain.ts', sharedPath = '/src/shared.ts';
    const { renderScene } = await import(renderPath) as typeof import('../../src/visuals/render');
    const { getTerrainTrack, travelAt } = await import(trackPath) as typeof import('../../src/visuals/terrain-track');
    const { terrainElevation, terrainValleyCenter } = await import(terrainPath) as typeof import('../../src/visuals/wire-terrain');
    const { defaultSettings, FEATURE_STRIDE } = await import(sharedPath) as typeof import('../../src/shared');
    const data = new Float32Array(480 * FEATURE_STRIDE);
    for (let frame = 0; frame < 480; frame++) {
      const at = frame * FEATURE_STRIDE; data[at] = .5; data[at + 1] = .4; data[at + 2] = .4;
      for (let b = 0; b < 48; b++) data[at + 4 + b] = .35;
    }
    const analysis = { duration: 8, fps: 60, data, peaks: [] };
    const track = getTerrainTrack(analysis);
    // Keep world seed, timbre and camera path constant to isolate left/right audio envelopes.
    const make = (left: number, right: number) => ({ ...track,
      left: new Float32Array(track.left.length).fill(left), right: new Float32Array(track.right.length).fill(right),
      rhythm: new Float32Array(track.rhythm.length),
    });
    const neutral = make(0, 0), leftOnly = make(1, 0), rightOnly = make(0, 1);
    const sides = [12, 28, 42].map(z => {
      const x = terrainValleyCenter(z, track);
      const heights = (value: typeof track, intensity = 1) => [
        terrainElevation(x - 10, z, value, intensity), terrainElevation(x + 10, z, value, intensity),
      ];
      return { neutral: heights(neutral), leftOnly: heights(leftOnly), rightOnly: heights(rightOnly),
        neutralZero: heights(neutral, 0), leftZero: heights(leftOnly, 0), rightZero: heights(rightOnly, 0) };
    });
    const worldZ = travelAt(track, 4) + 28;
    const worldX = terrainValleyCenter(worldZ, track);
    const pinned = () => [-15, -10, 0, 10, 15].map(offset => terrainElevation(worldX + offset, worldZ, track, 1));
    const before = pinned();
    const settings = structuredClone(defaultSettings); settings.style = 'terrain';
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const context = canvas.getContext('2d', { alpha: false })!;
    for (const time of [0, 5.5, 2, 7.5]) renderScene(context, 640, 360, time, settings, analysis);
    return { sides, before, after: pinned() };
  });
  for (const side of result.sides) {
    expect(side.leftOnly[0]).toBeGreaterThan(side.neutral[0] + .25);
    expect(side.leftOnly[1]).toBe(side.neutral[1]);
    expect(side.rightOnly[1]).toBeGreaterThan(side.neutral[1] + .25);
    expect(side.rightOnly[0]).toBe(side.neutral[0]);
    expect(side.leftZero).toEqual(side.neutralZero); expect(side.rightZero).toEqual(side.neutralZero);
  }
  expect(result.before.every(Number.isFinite)).toBe(true);
  expect(result.after).toEqual(result.before);
});

test('wireframe drawing stays finite for silence, spectral extremes and both orientations', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async ids => {
    const renderPath = '/src/visuals/render.ts', sharedPath = '/src/shared.ts';
    const { renderScene } = await import(renderPath) as typeof import('../../src/visuals/render');
    const { defaultSettings, FEATURE_STRIDE } = await import(sharedPath) as typeof import('../../src/shared');
    const proto = CanvasRenderingContext2D.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    const originals = new Map<string, (...args: unknown[]) => unknown>();
    let calls = 0;
    for (const method of ['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'ellipse', 'translate', 'rotate', 'scale', 'fillRect', 'strokeRect', 'createLinearGradient', 'createRadialGradient']) {
      const original = proto[method]; originals.set(method, original);
      proto[method] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        for (const value of args) if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${method} received ${String(value)}`);
        calls++; return original.apply(this, args);
      };
    }
    let frames = 0;
    const canvas = document.createElement('canvas');
    try {
      for (const style of ids) for (const aspect of ['landscape', 'portrait'] as const) for (const intensity of [0, 1, 2]) for (const mode of ['quiet', 'low', 'high', 'rhythmic']) {
        const data = new Float32Array(180 * FEATURE_STRIDE);
        for (let f = 0; f < 180; f++) if (mode !== 'quiet') {
          const at = f * FEATURE_STRIDE;
          data[at] = 1; data[at + 1] = mode === 'low' ? 1 : .1; data[at + 2] = mode === 'high' ? 1 : .1;
          data[at + 3] = mode === 'rhythmic' && f % 15 < 2 ? 1 : 0;
          for (let b = 0; b < 48; b++) data[at + 4 + b] = mode === 'low' ? b < 18 ? 1 : 0 : mode === 'high' ? b >= 18 ? 1 : 0 : .5;
        }
        const width = aspect === 'portrait' ? 360 : 640, height = aspect === 'portrait' ? 640 : 360;
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        const settings = structuredClone(defaultSettings); settings.style = style as typeof settings.style; settings.aspect = aspect; settings.intensity = intensity;
        renderScene(canvas.getContext('2d', { alpha: false })!, canvas.width, canvas.height, 1.25, settings, { duration: 3, fps: 60, data, peaks: [] });
        frames++;
      }
    } finally { for (const [method, original] of originals) proto[method] = original; }
    return { frames, calls };
  }, wireStyles.map(s => s.id));
  expect(result.frames).toBe(wireStyles.length * 2 * 3 * 4);
  expect(result.calls).toBeGreaterThan(1000);
});
