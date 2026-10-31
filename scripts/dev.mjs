import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { buildDesktop } from './build.mjs';
import electron from 'electron';

await buildDesktop();
const server = await createServer(); await server.listen();
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, STUDIO_DEV_URL: 'http://127.0.0.1:5173' } });
async function close() { child.kill(); await server.close(); }
child.on('exit', async code => { await server.close(); process.exitCode = code ?? 0; });
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());
