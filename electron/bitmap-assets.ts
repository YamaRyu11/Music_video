import { readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { MAX_BITMAP_BYTES, type BitmapAsset } from '../src/shared';

export async function readBitmapAsset(filePath: string): Promise<BitmapAsset> {
  if (typeof filePath !== 'string' || !/\.(png|jpe?g|webp|bmp)$/i.test(filePath)) throw new Error('PNG / JPEG / WebP / BMP の画像を選んでください。');
  const info = await stat(filePath);
  if (!info.isFile() || !info.size || info.size > MAX_BITMAP_BYTES) throw new Error('背景画像は25 MB以下のファイルを選んでください。');
  const bytes = await readFile(filePath);
  if (!bytes.length || bytes.length > MAX_BITMAP_BYTES) throw new Error('背景画像は25 MB以下のファイルを選んでください。');
  let mime = '';
  if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') mime = 'image/png';
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = 'image/jpeg';
  else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') mime = 'image/webp';
  else if (bytes.toString('ascii', 0, 2) === 'BM') mime = 'image/bmp';
  if (!mime) throw new Error('有効なビットマップ画像ではありません。');
  return { id: randomUUID(), name: path.basename(filePath), bytes: new Uint8Array(bytes), mime };
}
