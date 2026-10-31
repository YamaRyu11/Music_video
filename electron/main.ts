import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import { readFile, stat, rename, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createEncoder } from './encoder';
import { validateExport } from './validation';
import { MAX_FILE_BYTES, OUTPUT_FPS, type ExportProgress, type ExportSpec } from '../src/shared';

// Portable ZIP builds keep preferences/cache next to the executable, not in AppData.
if (app.isPackaged) app.setPath('userData', path.join(path.dirname(process.execPath), 'data'));
const devURL = !app.isPackaged ? process.env.STUDIO_DEV_URL : undefined;
let mainWindow: BrowserWindow | undefined;
const assets = new Map<string, { path: string; name: string }>();
let lastOutput: string | undefined;
let choosingOutput = false;
interface Job {
  id: string; spec: ExportSpec; window: BrowserWindow; output: string; temporary: string;
  encoder: ReturnType<typeof createEncoder>; frame: number; finishing: boolean;
  timeout?: ReturnType<typeof setTimeout>;
}
let job: Job | undefined;

function assertUI(event: IpcMainInvokeEvent) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Invalid sender');
}
function notify(progress: ExportProgress) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('export:progress', progress);
}
function ffmpegPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'tools', 'ffmpeg.exe');
  const platform = process.platform === 'win32' ? 'win32-x64' : 'linux-x64';
  return path.join(app.getAppPath(), 'node_modules', '@ffmpeg-installer', platform, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
}
async function loadAsset(filePath: string) {
  if (typeof filePath !== 'string' || !/\.(wav|mp3)$/i.test(filePath)) throw new Error('WAV または MP3 ファイルを選んでください。');
  const info = await stat(filePath);
  if (!info.isFile() || info.size > MAX_FILE_BYTES || !info.size) throw new Error('音源は250 MB以下の有効なファイルを選んでください。');
  const id = randomUUID(), name = path.basename(filePath);
  const bytes = await readFile(filePath); assets.set(id, { path: filePath, name });
  return { id, name, bytes: new Uint8Array(bytes) };
}
function lockWindow(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
}
function loadWindow(window: BrowserWindow, render = false) {
  if (devURL) return window.loadURL(`${devURL}${render ? '?render=1' : ''}`);
  return window.loadFile(path.join(__dirname, '../dist/index.html'), render ? { query: { render: '1' } } : undefined);
}
function resetTimeout(active: Job) {
  clearTimeout(active.timeout);
  active.timeout = setTimeout(() => void stopJob(active, { state: 'error', message: '描画処理が応答しませんでした。もう一度お試しください。' }), 90_000);
}
async function stopJob(active: Job, result: ExportProgress) {
  if (job !== active) return;
  job = undefined; clearTimeout(active.timeout);
  active.encoder.cancel();
  if (!active.window.isDestroyed()) active.window.destroy();
  await active.encoder.done.catch(() => {});
  await rm(active.temporary, { force: true }).catch(() => {});
  notify(result);
}

ipcMain.handle('audio:choose', async event => {
  assertUI(event);
  const result = await dialog.showOpenDialog(mainWindow!, { title: '音源を選ぶ', properties: ['openFile'], filters: [{ name: '音声ファイル', extensions: ['wav', 'mp3'] }] });
  return result.canceled ? null : loadAsset(result.filePaths[0]);
});
ipcMain.handle('audio:demo', event => { assertUI(event); return loadAsset(path.join(app.getAppPath(), devURL ? 'public' : 'dist', 'demo.wav')); });
ipcMain.handle('audio:drop', (event, filePath: string) => { assertUI(event); return loadAsset(filePath); });
ipcMain.handle('audio:release', (event, id: string) => { assertUI(event); if (job?.spec.assetId !== id) assets.delete(id); });

ipcMain.handle('export:start', async (event, spec: ExportSpec) => {
  assertUI(event); validateExport(spec);
  if (job || choosingOutput) throw new Error('別の動画を書き出しています。');
  const source = assets.get(spec.assetId); if (!source) throw new Error('音源を読み込み直してください。');
  choosingOutput = true;
  try {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '動画の保存先を選ぶ', defaultPath: `${source.name.replace(/\.(wav|mp3)$/i, '')}-${spec.settings.aspect === 'portrait' ? 'vertical' : 'horizontal'}.mp4`,
      filters: [{ name: 'MP4動画', extensions: ['mp4'] }], properties: ['showOverwriteConfirmation'],
    });
    if (result.canceled || !result.filePath) return false;
    const output = /\.mp4$/i.test(result.filePath) ? result.filePath : `${result.filePath}.mp4`;
    if (path.resolve(output).toLowerCase() === path.resolve(source.path).toLowerCase()) throw new Error('音源とは別の保存先を選んでください。');
    const temporary = path.join(path.dirname(output), `.musicvideo-${randomUUID()}.mp4`);
    const renderer = new BrowserWindow({ show: false, width: 1920, height: 1080,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
    });
    lockWindow(renderer);
    const active: Job = { id: randomUUID(), spec, window: renderer, output, temporary,
      encoder: createEncoder(ffmpegPath(), source.path, temporary, spec.analysis.duration, spec.settings.aspect), frame: 0, finishing: false };
    job = active; resetTimeout(active);
    void active.encoder.done.catch(error => { if (job === active) void stopJob(active, { state: 'error', message: String(error.message) }); });
    renderer.webContents.on('render-process-gone', () => void stopJob(active, { state: 'error', message: '描画プロセスが停止しました。' }));
    renderer.on('closed', () => { if (job === active) void stopJob(active, { state: 'error', message: '描画ウィンドウが終了しました。' }); });
    notify({ state: 'rendering', progress: 0 });
    void loadWindow(renderer, true).catch(error => void stopJob(active, { state: 'error', message: `描画画面を読み込めませんでした: ${String(error)}` }));
    return true;
  } finally { choosingOutput = false; }
});
ipcMain.on('render:ready', event => {
  if (job && event.sender === job.window.webContents && event.senderFrame === job.window.webContents.mainFrame) job.window.webContents.send('render:start', { ...job.spec, jobId: job.id });
});
ipcMain.handle('render:frame', async (event, id: string, index: number, bytes: ArrayBuffer) => {
  const active = job;
  if (!active || id !== active.id || event.sender !== active.window.webContents || event.senderFrame !== active.window.webContents.mainFrame) return false;
  try {
    if (active.finishing || index !== active.frame || index >= Math.ceil(active.spec.analysis.duration * OUTPUT_FPS)
      || !(bytes instanceof ArrayBuffer) || bytes.byteLength > 16 * 1024 * 1024) throw new Error('動画フレームの順序またはサイズが正しくありません。');
    await active.encoder.write(new Uint8Array(bytes));
    if (job !== active) return false;
    active.frame++; resetTimeout(active);
    if (active.frame % 3 === 0) notify({ state: 'rendering', progress: active.frame / Math.ceil(active.spec.analysis.duration * OUTPUT_FPS) });
    return true;
  } catch (error) { await stopJob(active, { state: 'error', message: error instanceof Error ? error.message : String(error) }); return false; }
});
ipcMain.handle('render:finish', async (event, id: string) => {
  const active = job;
  if (!active || id !== active.id || event.sender !== active.window.webContents || event.senderFrame !== active.window.webContents.mainFrame || active.finishing) return;
  try {
    if (active.frame !== Math.ceil(active.spec.analysis.duration * OUTPUT_FPS)) throw new Error('一部の動画フレームが生成されませんでした。');
    active.finishing = true; resetTimeout(active); notify({ state: 'encoding', progress: 1 });
    await active.encoder.finish(); if (job !== active) return;
    // Cancellation is no longer accepted while atomically committing the completed file.
    clearTimeout(active.timeout); job = undefined;
    try { await rename(active.temporary, active.output); }
    catch (error) {
      await rm(active.temporary, { force: true }).catch(() => {});
      notify({ state: 'error', message: `動画を保存できませんでした。保存先の空き容量・権限を確認してください。${String(error)}` });
      active.window.destroy(); return;
    }
    lastOutput = active.output; active.window.destroy(); notify({ state: 'complete', path: active.output });
  } catch (error) { await stopJob(active, { state: 'error', message: error instanceof Error ? error.message : String(error) }); }
});
ipcMain.on('render:error', (event, id: string, message: string) => {
  if (job && id === job.id && event.sender === job.window.webContents && event.senderFrame === job.window.webContents.mainFrame) void stopJob(job, { state: 'error', message: String(message).slice(0, 1000) });
});
ipcMain.handle('export:cancel', async event => { assertUI(event); if (job) await stopJob(job, { state: 'cancelled' }); });
ipcMain.handle('export:reveal', event => { assertUI(event); if (lastOutput) shell.showItemInFolder(lastOutput); });

app.whenReady().then(async () => {
  await mkdir(app.getPath('userData'), { recursive: true });
  mainWindow = new BrowserWindow({ title: 'Music Video Studio', width: 1340, height: 1020, minWidth: 900, minHeight: 740,
    backgroundColor: '#101115', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.removeMenu(); lockWindow(mainWindow);
  mainWindow.on('close', event => {
    if (job) {
      event.preventDefault();
      const active = job;
      const response = dialog.showMessageBoxSync(mainWindow!, { type: 'question', title: '書き出し中です', message: '書き出しをキャンセルして終了しますか？', buttons: ['続ける', '終了する'], defaultId: 0, cancelId: 0 });
      if (response === 1) void stopJob(active, { state: 'cancelled' }).then(() => mainWindow?.close());
    }
  });
  await loadWindow(mainWindow);
});
app.on('window-all-closed', () => app.quit());
