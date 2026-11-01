export const STYLE_IDS = ['orbit', 'spectrum', 'particles', 'wave', 'tunnel', 'aurora',
  'laser', 'bloom', 'stars', 'ink', 'kaleidoscope', 'contours', 'glitch', 'lissajous', 'rain', 'typography',
  'terrain', 'wire-tube', 'wire-orb', 'wire-city'] as const;
export type StyleId = typeof STYLE_IDS[number];
export type Aspect = 'landscape' | 'portrait';
export type FontId = 'sans' | 'serif' | 'mono' | 'meiryo';
export type BlendMode = 'source-over' | 'screen' | 'lighter' | 'multiply';
export interface TextDesign {
  size: number;
  color: string;
  font: FontId;
  weight: 400 | 700;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  y: number;
  shadow: boolean;
  visible: boolean;
}
export const fontFamilies: Record<FontId, string> = {
  sans: '"Segoe UI", "Yu Gothic", "Noto Sans", sans-serif',
  serif: '"Yu Mincho", "Noto Serif", Georgia, serif',
  mono: 'Consolas, "Noto Sans Mono", monospace',
  meiryo: 'Meiryo, "Noto Sans", sans-serif',
};

export interface VisualSettings {
  style: StyleId;
  aspect: Aspect;
  color: string;
  secondaryColor: string;
  backgroundColor: string;
  brightness: number;
  saturation: number;
  glow: number;
  overlay: { style: StyleId | 'none'; color: string; opacity: number; blend: BlendMode };
  intensity: number;
  smoothing: number;
  title: string;
  artist: string;
  titleDesign: TextDesign;
  artistDesign: TextDesign;
}

const baseText: TextDesign = { size: 42, color: '#f1f5ee', font: 'sans', weight: 400,
  italic: false, align: 'center', y: 0.79, shadow: true, visible: true };
export const defaultSettings: VisualSettings = {
  style: 'orbit', aspect: 'landscape', color: '#b8f36b',
  secondaryColor: '#67e8d0', backgroundColor: '#080d13', brightness: 1, saturation: 1, glow: 0.5,
  overlay: { style: 'none', color: '#c79cff', opacity: 0.5, blend: 'screen' },
  intensity: 1, smoothing: 0.5, title: '', artist: '',
  titleDesign: { ...baseText },
  artistDesign: { ...baseText, size: 22, color: '#8c9b99', y: 0.835 },
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
