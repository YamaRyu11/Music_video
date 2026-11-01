import { MAX_BITMAP_BYTES, MAX_BITMAP_PIXELS, type BitmapSettings } from '../shared';

export interface DecodedBitmap { image: ImageBitmap; width: number; height: number }
export interface BitmapGeometry {
  source: { x: number; y: number; width: number; height: number };
  destination: { centerX: number; centerY: number; width: number; height: number };
  rotation: number;
  blurPixels: number;
}

const MAX_DECODED_SIDE = 16384;
const RETAINED_SIDE = 4096;
const supportedMime = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/x-ms-bmp']);

/** Decode once per imported asset; keep a bounded-size bitmap for preview and export. */
export async function decodeBitmap(bytes: Uint8Array, mime: string): Promise<DecodedBitmap> {
  if (!bytes.length) throw new Error('画像ファイルが空です。');
  if (bytes.length > MAX_BITMAP_BYTES) throw new Error('背景画像は25 MB以下のファイルを選んでください。');
  if (!supportedMime.has(mime.toLowerCase())) throw new Error('PNG / JPEG / WebP / BMP の画像を選んでください。');
  let original: ImageBitmap;
  try {
    // Copy into an ArrayBuffer-backed view: callers may supply a SharedArrayBuffer view.
    original = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: mime }));
  } catch { throw new Error('画像を読み込めませんでした。ファイルが破損していないか確認してください。'); }
  const { width, height } = original;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
    || width > MAX_DECODED_SIDE || height > MAX_DECODED_SIDE || width * height > MAX_BITMAP_PIXELS) {
    original.close();
    throw new Error('背景画像は32メガピクセル以下、各辺16384 px以下の画像を選んでください。');
  }
  const factor = Math.min(1, RETAINED_SIDE / Math.max(width, height));
  if (factor === 1) return { image: original, width, height };
  let resized: ImageBitmap;
  try {
    resized = await createImageBitmap(original, {
      resizeWidth: Math.max(1, Math.round(width * factor)),
      resizeHeight: Math.max(1, Math.round(height * factor)), resizeQuality: 'high',
    });
  } catch { throw new Error('画像を縮小できませんでした。別の画像をお試しください。'); }
  finally { original.close(); }
  if (!Number.isFinite(resized.width) || !Number.isFinite(resized.height) || resized.width <= 0 || resized.height <= 0
    || Math.max(resized.width, resized.height) > RETAINED_SIDE) {
    resized.close(); throw new Error('画像を縮小できませんでした。別の画像をお試しください。');
  }
  return { image: resized, width: resized.width, height: resized.height };
}

const between = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;

/** Crop fractions precede fitting; x/y move the center by half the output frame. */
export function bitmapGeometry(sourceWidth: number, sourceHeight: number, width: number, height: number,
  settings: BitmapSettings): BitmapGeometry {
  const crop = settings.crop;
  if (![sourceWidth, sourceHeight, width, height].every(value => Number.isFinite(value) && value > 0)
    || !['cover', 'contain'].includes(settings.fit) || !between(settings.scale, .1, 5)
    || !between(settings.x, -1, 1) || !between(settings.y, -1, 1) || !between(settings.rotation, -180, 180)
    || !between(settings.opacity, 0, 1) || !between(settings.blur, 0, 80)
    || !between(settings.saturation, 0, 2) || !between(settings.brightness, 0, 2)
    || !crop || ![crop.left, crop.right, crop.top, crop.bottom].every(value => between(value, 0, .95))
    || crop.left + crop.right > .95 + 1e-9 || crop.top + crop.bottom > .95 + 1e-9) {
    throw new Error('背景画像のサイズまたは調整値が正しくありません。');
  }
  const source = { x: sourceWidth * crop.left, y: sourceHeight * crop.top,
    width: sourceWidth * (1 - crop.left - crop.right), height: sourceHeight * (1 - crop.top - crop.bottom) };
  const fit = settings.fit === 'cover' ? Math.max(width / source.width, height / source.height)
    : Math.min(width / source.width, height / source.height);
  return { source,
    destination: { centerX: width * .5 * (1 + settings.x), centerY: height * .5 * (1 + settings.y),
      width: source.width * fit * settings.scale, height: source.height * fit * settings.scale },
    rotation: settings.rotation * Math.PI / 180,
    blurPixels: settings.blur * width / (width < height ? 1080 : 1920) };
}

interface ProcessedBitmap { image: ImageBitmap; key: string; canvas: HTMLCanvasElement }
const cache = new WeakMap<DecodedBitmap, ProcessedBitmap>();

function canvasFor(ctx: CanvasRenderingContext2D, width: number, height: number): HTMLCanvasElement {
  const canvas = ctx.canvas.ownerDocument.createElement('canvas');
  canvas.width = width; canvas.height = height; return canvas;
}

/** Extend cropped edge pixels before blurring; never sample an opaque black border. */
function paintPaddedImage(ctx: CanvasRenderingContext2D, source: DecodedBitmap, geometry: BitmapGeometry, padding: number) {
  const a = geometry.source, b = geometry.destination;
  const left = -b.width / 2, top = -b.height / 2;
  const ew = Math.min(1, a.width), eh = Math.min(1, a.height);
  ctx.drawImage(source.image, a.x, a.y, a.width, a.height, left, top, b.width, b.height);
  if (!padding) return;
  ctx.drawImage(source.image, a.x, a.y, ew, a.height, left - padding, top, padding, b.height);
  ctx.drawImage(source.image, a.x + a.width - ew, a.y, ew, a.height, left + b.width, top, padding, b.height);
  ctx.drawImage(source.image, a.x, a.y, a.width, eh, left, top - padding, b.width, padding);
  ctx.drawImage(source.image, a.x, a.y + a.height - eh, a.width, eh, left, top + b.height, b.width, padding);
  for (const right of [false, true]) for (const bottom of [false, true]) {
    ctx.drawImage(source.image, right ? a.x + a.width - ew : a.x, bottom ? a.y + a.height - eh : a.y, ew, eh,
      right ? left + b.width : left - padding, bottom ? top + b.height : top - padding, padding, padding);
  }
}

function processedBitmap(ctx: CanvasRenderingContext2D, width: number, height: number, source: DecodedBitmap,
  settings: BitmapSettings): HTMLCanvasElement {
  // Opacity and visibility are cheap draw-time controls; they do not invalidate filters.
  const key = JSON.stringify([width, height, source.width, source.height, settings.fit, settings.scale, settings.x, settings.y,
    settings.rotation, settings.crop.left, settings.crop.right, settings.crop.top, settings.crop.bottom,
    settings.blur, settings.saturation, settings.brightness]);
  const previous = cache.get(source);
  if (previous?.key === key && previous.image === source.image) return previous.canvas;
  const geometry = bitmapGeometry(source.width, source.height, width, height, settings);
  const padding = geometry.blurPixels ? Math.ceil(geometry.blurPixels * 3) + 2 : 0;
  const work = canvasFor(ctx, width + padding * 2, height + padding * 2);
  const workCtx = work.getContext('2d')!;
  workCtx.imageSmoothingEnabled = true; workCtx.imageSmoothingQuality = 'high';
  workCtx.translate(geometry.destination.centerX + padding, geometry.destination.centerY + padding);
  workCtx.rotate(geometry.rotation);
  paintPaddedImage(workCtx, source, geometry, padding);
  const output = canvasFor(ctx, width, height), outputCtx = output.getContext('2d')!;
  // Keep the original image extent: contain mode retains its transparent letterboxing.
  outputCtx.save(); outputCtx.translate(geometry.destination.centerX, geometry.destination.centerY);
  outputCtx.rotate(geometry.rotation); outputCtx.beginPath();
  outputCtx.rect(-geometry.destination.width / 2, -geometry.destination.height / 2, geometry.destination.width, geometry.destination.height);
  outputCtx.clip(); outputCtx.setTransform(1, 0, 0, 1, 0, 0);
  outputCtx.filter = `blur(${geometry.blurPixels}px) saturate(${settings.saturation}) brightness(${settings.brightness})`;
  outputCtx.drawImage(work, -padding, -padding); outputCtx.restore();
  cache.set(source, { image: source.image, key, canvas: output });
  return output;
}

/** Draw the cached transparent layer in actual canvas pixels, without leaking state. */
export function drawBitmap(ctx: CanvasRenderingContext2D, width: number, height: number,
  source: DecodedBitmap, settings: BitmapSettings): void {
  if (!settings.enabled || settings.opacity <= 0 || width <= 0 || height <= 0) return;
  const image = processedBitmap(ctx, width, height, source, settings);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha *= settings.opacity;
  ctx.drawImage(image, 0, 0); ctx.restore();
}
