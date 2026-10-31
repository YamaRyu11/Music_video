import { spawn } from 'node:child_process';
import { OUTPUT_FPS, type Aspect, dimensions } from '../src/shared';

export function encoderArguments(audioPath: string, outputPath: string, duration: number, aspect: Aspect) {
  const [width, height] = dimensions(aspect);
  return ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(OUTPUT_FPS), '-vcodec', 'mjpeg', '-i', 'pipe:0',
    '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0',
    '-vf', `scale=${width}:${height}:flags=lanczos`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-threads', '4', '-c:a', 'aac', '-b:a', '192k', '-t', String(duration),
    '-movflags', '+faststart', '-f', 'mp4', outputPath];
}

export function createEncoder(executable: string, audioPath: string, outputPath: string, duration: number, aspect: Aspect) {
  const process = spawn(executable, encoderArguments(audioPath, outputPath, duration, aspect), { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '', aborted = false;
  process.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-8000); });
  // The process's error/close event owns the final failure, including broken pipes.
  process.stdin.on('error', () => {});
  const done = new Promise<void>((resolve, reject) => {
    process.on('error', error => reject(new Error(`FFmpegを起動できませんでした: ${error.message}`)));
    process.on('close', code => {
      if (code === 0 && !aborted) resolve();
      else reject(new Error(aborted ? 'cancelled' : `FFmpegでの変換に失敗しました。${stderr.trim() ? `\n${stderr.trim()}` : ''}`));
    });
  });
  // A missing executable may fail before the first frame arrives.
  void done.catch(() => {});
  return {
    done,
    write(bytes: Uint8Array): Promise<void> {
      return new Promise((resolve, reject) => {
        if (aborted || process.stdin.destroyed) { reject(new Error('エンコーダーが停止しました。')); return; }
        process.stdin.write(bytes, error => error ? reject(error) : resolve());
      });
    },
    async finish() { process.stdin.end(); await done; },
    cancel() { aborted = true; process.stdin.destroy(); process.kill('SIGTERM'); },
  };
}
