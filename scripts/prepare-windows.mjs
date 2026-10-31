import { mkdir, readFile, copyFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { x as extract } from 'tar';

const packageName = '@ffmpeg-installer/win32-x64';
const destination = '.cache/windows-ffmpeg';
await mkdir(destination, { recursive: true });
try {
  await access('node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');
  for (const file of ['ffmpeg.exe', 'package.json', 'README.md', 'LICENSE']) {
    try { await copyFile(`node_modules/${packageName}/${file}`, `${destination}/${file}`); }
    catch (error) { if (file === 'ffmpeg.exe' || file === 'package.json') throw error; }
  }
} catch {
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  const dependency = lock.packages[`node_modules/${packageName}`];
  if (!dependency?.integrity?.startsWith('sha512-')) throw new Error('Missing trusted lockfile integrity for Windows FFmpeg');
  const npmCLI = process.env.npm_execpath;
  if (!npmCLI) throw new Error('Run this script through npm run dist:win');
  const output = execFileSync(process.execPath, [npmCLI, 'pack', `${packageName}@${dependency.version}`, '--json', '--pack-destination', '.cache'], { encoding: 'utf8' });
  const packed = JSON.parse(output)[0];
  const archive = path.join('.cache', packed.filename);
  const hash = `sha512-${createHash('sha512').update(await readFile(archive)).digest('base64')}`;
  if (hash !== dependency.integrity) throw new Error('Windows FFmpeg package integrity mismatch');
  await extract({ file: archive, cwd: destination, strip: 1, filter: entry => /^package\/(ffmpeg\.exe|LICENSE|README\.md|package\.json)$/.test(entry) });
}
const header = await readFile(`${destination}/ffmpeg.exe`);
if (header[0] !== 0x4d || header[1] !== 0x5a) throw new Error('FFmpeg is not a Windows executable');
console.log('Windows x64 FFmpeg prepared (lockfile integrity verified on cross-build).');
