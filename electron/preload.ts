import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { type DesktopBridge, type ExportProgress, type RenderSpec } from '../src/shared';

const bridge: DesktopBridge = {
  chooseAudio: () => ipcRenderer.invoke('audio:choose'),
  loadDemo: () => ipcRenderer.invoke('audio:demo'),
  importDrop: file => ipcRenderer.invoke('audio:drop', webUtils.getPathForFile(file)),
  releaseAudio: id => ipcRenderer.invoke('audio:release', id),
  chooseBitmap: () => ipcRenderer.invoke('bitmap:choose'),
  importBitmapDrop: file => ipcRenderer.invoke('bitmap:drop', webUtils.getPathForFile(file)),
  releaseBitmap: id => ipcRenderer.invoke('bitmap:release', id),
  startExport: spec => ipcRenderer.invoke('export:start', spec),
  cancelExport: () => ipcRenderer.invoke('export:cancel'),
  onExportProgress: fn => {
    const listener = (_: unknown, event: ExportProgress) => fn(event);
    ipcRenderer.on('export:progress', listener);
    return () => ipcRenderer.removeListener('export:progress', listener);
  },
  revealOutput: () => ipcRenderer.invoke('export:reveal'),
  onRenderStart: fn => {
    const listener = (_: unknown, spec: RenderSpec) => fn(spec);
    ipcRenderer.on('render:start', listener);
    return () => ipcRenderer.removeListener('render:start', listener);
  },
  renderReady: () => ipcRenderer.send('render:ready'),
  writeFrame: (jobId, index, bytes) => ipcRenderer.invoke('render:frame', jobId, index, bytes),
  finishRender: jobId => ipcRenderer.invoke('render:finish', jobId),
  failRender: (jobId, message) => ipcRenderer.send('render:error', jobId, message),
};
contextBridge.exposeInMainWorld('studio', bridge);
