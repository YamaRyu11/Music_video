import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import './generate-demo.mjs';

export async function buildDesktop() {
  await mkdir('desktop-dist', { recursive: true });
  for (const name of ['main', 'preload']) {
    await build({ entryPoints: [`electron/${name}.ts`], outfile: `desktop-dist/${name}.cjs`, bundle: true,
      platform: 'node', target: 'node22', format: 'cjs', external: ['electron'], sourcemap: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit' });
  await buildDesktop();
}
