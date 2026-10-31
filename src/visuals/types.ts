import type { Features } from '../audio/analysis';
import type { VisualSettings } from '../shared';

export type StyleRenderer = (ctx: CanvasRenderingContext2D, width: number, height: number,
  time: number, features: Features, settings: VisualSettings) => void;
