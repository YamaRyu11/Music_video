export type StyleId = 'orbit' | 'spectrum' | 'particles';
export type Aspect = 'landscape' | 'portrait';

export interface VisualSettings {
  style: StyleId;
  aspect: Aspect;
  color: string;
  intensity: number;
  smoothing: number;
  title: string;
  artist: string;
}

export const defaultSettings: VisualSettings = {
  style: 'orbit', aspect: 'landscape', color: '#b8f36b',
  intensity: 1, smoothing: 0.5, title: '', artist: '',
};
export const ANALYSIS_FPS = 60;
export const BAND_COUNT = 48;
export const FEATURE_STRIDE = BAND_COUNT + 4;
export const MAX_FILE_BYTES = 250 * 1024 * 1024;
export const MAX_DURATION = 600;
export const OUTPUT_FPS = 30;

// Per frame: loudness, bass, treble, onset, then 48 logarithmic bands.
export interface Analysis {
  duration: number;
  fps: number;
  data: Float32Array;
  peaks: number[];
}
export interface AudioAsset {
  id: string;
  name: string;
  bytes: Uint8Array;
}
export interface ExportSpec { assetId: string; analysis: Analysis; settings: VisualSettings }
export type ExportProgress =
  | { state: 'rendering'; progress: number }
  | { state: 'encoding'; progress: number }
  | { state: 'complete'; path: string }
  | { state: 'cancelled' }
  | { state: 'error'; message: string };

export interface DesktopBridge {
  chooseAudio(): Promise<AudioAsset | null>;
  loadDemo(): Promise<AudioAsset>;
  importDrop(file: File): Promise<AudioAsset>;
  releaseAudio(id: string): Promise<void>;
  startExport(spec: ExportSpec): Promise<boolean>;
  cancelExport(): Promise<void>;
  onExportProgress(fn: (event: ExportProgress) => void): () => void;
  revealOutput(): Promise<void>;
  onRenderStart(fn: (spec: ExportSpec & { jobId: string }) => void): () => void;
  renderReady(): void;
  writeFrame(jobId: string, index: number, bytes: ArrayBuffer): Promise<boolean>;
  finishRender(jobId: string): Promise<void>;
  failRender(jobId: string, message: string): void;
}
declare global { interface Window { studio?: DesktopBridge } }

export function dimensions(aspect: Aspect): [number, number] {
  return aspect === 'portrait' ? [1080, 1920] : [1920, 1080];
}
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
