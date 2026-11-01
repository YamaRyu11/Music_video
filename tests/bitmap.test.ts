import { afterEach, describe, expect, it, vi } from 'vitest';
import { bitmapGeometry, decodeBitmap } from '../src/visuals/bitmap';
import { defaultBitmapSettings, MAX_BITMAP_BYTES, type BitmapSettings } from '../src/shared';

const settings = (patch: Partial<BitmapSettings> = {}): BitmapSettings => ({ ...defaultBitmapSettings,
  crop: { ...defaultBitmapSettings.crop }, ...patch });
const image = (width: number, height: number) => ({ width, height, close: vi.fn() });
afterEach(() => vi.unstubAllGlobals());

describe('background bitmap geometry', () => {
  it('covers a Full HD frame or preserves transparent letterboxing with contain', () => {
    const cover = bitmapGeometry(400, 200, 1920, 1080, settings());
    expect(cover.destination).toEqual({ centerX: 960, centerY: 540, width: 2160, height: 1080 });
    const contain = bitmapGeometry(400, 200, 1920, 1080, settings({ fit: 'contain' }));
    expect(contain.destination).toEqual({ centerX: 960, centerY: 540, width: 1920, height: 960 });
  });
  it('crops the source before fitting rather than trimming the already fitted frame', () => {
    const cropped = bitmapGeometry(400, 200, 1920, 1080, settings({ crop: { left: .25, right: .25, top: 0, bottom: 0 } }));
    expect(cropped.source).toEqual({ x: 100, y: 0, width: 200, height: 200 });
    expect(cropped.destination.width).toBe(1920);
    expect(cropped.destination.height).toBe(1920);
  });
  it('scales around the image center, pans by half a frame and converts rotation to radians', () => {
    const transformed = bitmapGeometry(400, 200, 1920, 1080, settings({ fit: 'contain', scale: .5, x: 1, y: -1, rotation: 90 }));
    expect(transformed.destination).toEqual({ centerX: 1920, centerY: 0, width: 960, height: 480 });
    expect(transformed.rotation).toBeCloseTo(Math.PI / 2);
  });
  it('keeps blur strength and position proportional between preview and Full HD output', () => {
    const value = settings({ blur: 80, x: .25, y: -.5 });
    const preview = bitmapGeometry(1200, 800, 960, 540, value);
    const output = bitmapGeometry(1200, 800, 1920, 1080, value);
    expect(preview.blurPixels).toBe(40); expect(output.blurPixels).toBe(80);
    expect(output.destination.centerX).toBe(preview.destination.centerX * 2);
    expect(output.destination.centerY).toBe(preview.destination.centerY * 2);
    expect(bitmapGeometry(1200, 800, 432, 768, value).blurPixels).toBe(32);
  });
  it('allows extreme valid crop but rejects a vanishing source or invalid controls', () => {
    expect(bitmapGeometry(1000, 1000, 1920, 1080, settings({ crop: { left: .6, right: .35, top: .95, bottom: 0 } })).source.width).toBeCloseTo(50);
    expect(() => bitmapGeometry(1000, 1000, 1920, 1080, settings({ crop: { left: .5, right: .5, top: 0, bottom: 0 } }))).toThrow();
    expect(() => bitmapGeometry(0, 1000, 1920, 1080, settings())).toThrow();
    expect(() => bitmapGeometry(1000, 1000, 1920, 1080, settings({ scale: 0 }))).toThrow();
    expect(() => bitmapGeometry(1000, 1000, 1920, 1080, settings({ rotation: Infinity }))).toThrow();
  });
});

describe('bitmap decoding and resource limits', () => {
  it('retains a decoded small image until its caller releases it', async () => {
    const decoded = image(1600, 900), create = vi.fn().mockResolvedValue(decoded);
    vi.stubGlobal('createImageBitmap', create);
    const result = await decodeBitmap(new Uint8Array([1, 2, 3]), 'image/png');
    expect(result).toEqual({ image: decoded, width: 1600, height: 900 });
    expect(decoded.close).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
  });
  it('retains at most a 4096px side and closes the original after successful resize', async () => {
    const original = image(10000, 3000), resized = image(4096, 1229);
    const create = vi.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(resized);
    vi.stubGlobal('createImageBitmap', create);
    const result = await decodeBitmap(new Uint8Array([1]), 'image/jpeg');
    expect(result).toEqual({ image: resized, width: 4096, height: 1229 });
    expect(create.mock.calls[1][1]).toMatchObject({ resizeWidth: 4096, resizeHeight: 1229, resizeQuality: 'high' });
    expect(original.close).toHaveBeenCalledOnce(); expect(resized.close).not.toHaveBeenCalled();
  });
  it('rejects large files or unsupported types before allocating a decoded bitmap', async () => {
    const create = vi.fn(); vi.stubGlobal('createImageBitmap', create);
    await expect(decodeBitmap(new Uint8Array(MAX_BITMAP_BYTES + 1), 'image/png')).rejects.toThrow('25 MB');
    await expect(decodeBitmap(new Uint8Array([1]), 'image/svg+xml')).rejects.toThrow('PNG');
    await expect(decodeBitmap(new Uint8Array(), 'image/png')).rejects.toThrow('空');
    expect(create).not.toHaveBeenCalled();
  });
  it('closes images exceeding the decoded pixel/side limits or with an empty extent', async () => {
    for (const extent of [[10000, 4000], [16385, 1], [0, 100]]) {
      const invalid = image(extent[0], extent[1]); vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(invalid));
      await expect(decodeBitmap(new Uint8Array([1]), 'image/webp')).rejects.toThrow('32メガピクセル');
      expect(invalid.close).toHaveBeenCalledOnce();
    }
  });
  it('closes the original if resizing fails, and closes an invalid resized result', async () => {
    const original = image(5000, 4000);
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValueOnce(original).mockRejectedValueOnce(new Error('decoder error')));
    await expect(decodeBitmap(new Uint8Array([1]), 'image/bmp')).rejects.toThrow('縮小');
    expect(original.close).toHaveBeenCalledOnce();
    const next = image(5000, 4000), empty = image(0, 0);
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValueOnce(next).mockResolvedValueOnce(empty));
    await expect(decodeBitmap(new Uint8Array([1]), 'image/bmp')).rejects.toThrow('縮小');
    expect(next.close).toHaveBeenCalledOnce(); expect(empty.close).toHaveBeenCalledOnce();
  });
  it('reports malformed image bytes as a readable decode error', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('encoding failed')));
    await expect(decodeBitmap(new Uint8Array([1]), 'image/png')).rejects.toThrow('画像を読み込めません');
  });
});
