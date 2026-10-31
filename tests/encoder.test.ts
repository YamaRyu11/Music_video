import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createEncoder } from '../electron/encoder';

// Real H.264/AAC encoding, not an assertion about the command string.
it('encodes frames and audio to a probeable full-HD H.264/AAC MP4', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'musicvideo-test-'));
  try {
    const platform = process.platform === 'win32' ? 'win32-x64/ffmpeg.exe' : 'linux-x64/ffmpeg';
    const ffmpeg = process.env.TEST_FFMPEG ?? path.resolve(`node_modules/@ffmpeg-installer/${platform}`);
    const audio = path.join(dir, '音源.wav'), frame = path.join(dir, 'frame.jpg'), output = path.join(dir, 'output.mp4');
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=1', audio]);
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x294f30:s=1920x1080', '-frames:v', '1', '-threads', '1', frame]);
    const jpeg = await readFile(frame);
    const encoder = createEncoder(ffmpeg, audio, output, 1, 'landscape');
    for (let i = 0; i < 30; i++) await encoder.write(jpeg);
    await encoder.finish();
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output], { encoding: 'utf8' }));
    const video = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
    const sound = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'audio');
    expect(video.codec_name).toBe('h264'); expect(video.width).toBe(1920); expect(video.height).toBe(1080);
    expect(video.pix_fmt).toBe('yuv420p'); expect(video.nb_frames).toBe('30'); expect(video.r_frame_rate).toBe('30/1');
    expect(sound.codec_name).toBe('aac'); expect(Number(probe.format.duration)).toBeCloseTo(1, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 30_000);
