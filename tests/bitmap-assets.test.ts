import { it, expect } from 'vitest';
import { mkdtemp, writeFile, truncate, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readBitmapAsset } from '../electron/bitmap-assets';
import { MAX_BITMAP_BYTES } from '../src/shared';

it('imports bounded local bitmap bytes and rejects renamed non-bitmaps and oversized files', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'studio-bitmaps-'));
  try {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN9sAAAAASUVORK5CYII=', 'base64');
    const valid = path.join(temporary, '背景.png'); await writeFile(valid, png);
    const asset = await readBitmapAsset(valid);
    expect(asset.name).toBe('背景.png'); expect(asset.mime).toBe('image/png');
    expect(Buffer.from(asset.bytes)).toEqual(png); expect(asset.id).toBeTruthy();
    const fake = path.join(temporary, 'fake.png'); await writeFile(fake, '<svg><script>external()</script></svg>');
    await expect(readBitmapAsset(fake)).rejects.toThrow('有効なビットマップ');
    const wrong = path.join(temporary, 'wrong.svg'); await writeFile(wrong, png);
    await expect(readBitmapAsset(wrong)).rejects.toThrow('PNG');
    const huge = path.join(temporary, 'huge.png'); await writeFile(huge, png); await truncate(huge, MAX_BITMAP_BYTES + 1);
    await expect(readBitmapAsset(huge)).rejects.toThrow('25 MB');
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
