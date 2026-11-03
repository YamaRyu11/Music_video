import type { EncodingSettings } from './export/settings';
export const STYLE_IDS = ['orbit', 'spectrum', 'particles', 'wave', 'tunnel', 'aurora',
  'laser', 'bloom', 'stars', 'ink', 'kaleidoscope', 'contours', 'glitch', 'lissajous', 'rain', 'typography',
  'terrain', 'wire-tube', 'wire-orb', 'wire-city', 'flowfield', 'chladni', 'moire', 'helix',
  'waterfall', 'phosphor', 'radar', 'metaballs', 'fractal', 'torus-knot', 'cells', 'crystal',
  'rose', 'pendulum', 'gyroid', 'braid', 'oscilloscope', 'sonar', 'ribbons', 'orrery',
  'jellyfish', 'ripple-grid', 'fibonacci', 'sigils', 'origami', 'ribbon-sphere', 'sundial', 'hexwave',
  'mobius', 'magnetic', 'eclipse', 'hourglass', 'gears', 'comets', 'lightning', 'shell',
  'superformula', 'string-art', 'fireflies', 'circuit', 'gravity-well', 'stained-glass', 'paper-fan', 'bubbles'] as const;
export type StyleId = typeof STYLE_IDS[number];
export type Aspect = 'landscape' | 'portrait';
export type FontId = 'sans' | 'serif' | 'mono' | 'meiryo';
export type BlendMode = 'source-over' | 'screen' | 'lighter' | 'multiply';
export type LayerTarget = 'base' | 'overlay';
export const MAX_INTENSITY = 10;
export const MAX_SMOOTHING = 2;
export const MIN_LINE_WIDTH = .1;
export const MAX_LINE_WIDTH = 5;
export const MAX_BITMAP_BYTES = 25 * 1024 * 1024;
export const MAX_BITMAP_PIXELS = 32_000_000;
export interface BitmapSettings {
  enabled: boolean;
  fit: 'cover' | 'contain';
  scale: number;
  x: number;
  y: number;
  rotation: number;
  crop: { left: number; right: number; top: number; bottom: number };
  opacity: number;
  blur: number;
  saturation: number;
  brightness: number;
}
export const defaultBitmapSettings: BitmapSettings = {
  enabled: true, fit: 'cover', scale: 1, x: 0, y: 0, rotation: 0,
  crop: { left: 0, right: 0, top: 0, bottom: 0 }, opacity: 1, blur: 0, saturation: 1, brightness: 1,
};
export interface BitmapAsset { id: string; name: string; bytes: Uint8Array; mime: string }
export interface TextDesign {
  size: number;
  color: string;
  font: FontId;
  weight: 400 | 700;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  x: number;
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

export type TextTarget = 'titleDesign' | 'artistDesign';
export interface LayerControls {
  opacity: number;
  blend: BlendMode;
  color: string;
  secondaryColor: string;
  brightness: number;
  saturation: number;
  glow: number;
  intensity: number;
  smoothing: number;
  lineWidth: number;
  blur: number;
  fillBackground: boolean;
  lineGlowEnabled: boolean;
  lineGlowStrength: number;
  lineGlowDistance: number;
  scaleX: number;
  scaleY: number;
  scaleLocked: boolean;
  x: number;
  y: number;
}
export const defaultLayerControls: LayerControls = {
  opacity: 1, blend: 'source-over', color: '#b8f36b', secondaryColor: '#67e8d0', brightness: 1, saturation: 1,
  blur: 0, fillBackground: false, lineGlowEnabled: false, lineGlowStrength: 1, lineGlowDistance: 24,
  glow: .5, intensity: 1, smoothing: .5, lineWidth: 1, scaleX: 1, scaleY: 1, scaleLocked: false, x: 0, y: 0,
};
export interface VisualSettings extends LayerControls {
  style: StyleId;
  aspect: Aspect;
  backgroundColor: string;
  overlay: LayerControls & { style: StyleId | 'none'; opacity: number; blend: BlendMode };
  title: string;
  artist: string;
  titleDesign: TextDesign;
  artistDesign: TextDesign;
  bitmap: BitmapSettings;
}

const baseText: TextDesign = { size: 42, color: '#f1f5ee', font: 'sans', weight: 400,
  italic: false, align: 'center', x: 0, y: 0.79, shadow: true, visible: true };
export const defaultSettings: VisualSettings = {
  ...defaultLayerControls,
  style: 'orbit', aspect: 'landscape', backgroundColor: '#080d13',
  overlay: { ...defaultLayerControls, style: 'none', color: '#c79cff', opacity: 0.5, blend: 'screen' },
  title: '', artist: '',
  titleDesign: { ...baseText },
  artistDesign: { ...baseText, size: 22, color: '#8c9b99', y: 0.835 },
  bitmap: { ...defaultBitmapSettings, crop: { ...defaultBitmapSettings.crop } },
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
export interface ExportSpec { assetId: string; analysis: Analysis; settings: VisualSettings; bitmapId?: string; encoding?: EncodingSettings }
export interface RenderSpec extends ExportSpec { jobId: string; bitmapAsset?: BitmapAsset }
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
  chooseBitmap(): Promise<BitmapAsset | null>;
  importBitmapDrop(file: File): Promise<BitmapAsset>;
  releaseBitmap(id: string): Promise<void>;
  startExport(spec: ExportSpec): Promise<boolean>;
  cancelExport(): Promise<void>;
  onExportProgress(fn: (event: ExportProgress) => void): () => void;
  revealOutput(): Promise<void>;
  onRenderStart(fn: (spec: RenderSpec) => void): () => void;
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
