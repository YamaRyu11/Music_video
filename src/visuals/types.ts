import type { Features } from '../audio/analysis';
import type { VisualSettings } from '../shared';
import type { TerrainTrack } from './terrain-track';

export interface StyleRenderContext { track?: TerrainTrack }

export type StyleRenderer = (ctx: CanvasRenderingContext2D, width: number, height: number,
  time: number, features: Features, settings: VisualSettings, context?: StyleRenderContext) => void;
