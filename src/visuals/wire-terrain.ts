import { alpha } from './math';
import { getTerrainTrack, moodAtDistance, travelAt, type TerrainTrack } from './terrain-track';
import type { StyleRenderer } from './types';

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (lo: number, hi: number, value: number) => {
  const t = clamp((value - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash(seed: number, index: number, channel: number): number {
  let value = Math.imul((index | 0) ^ seed, 0x45d9f3b) ^ Math.imul(channel, 0x27d4eb2d);
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}

/** Smooth one-dimensional world noise; its phase never depends on the camera. */
function worldNoise(track: TerrainTrack, distance: number, channel: number): number {
  const index = Math.floor(distance), part = distance - index;
  return lerp(hash(track.seed, index, channel), hash(track.seed, index + 1, channel), part * part * (3 - 2 * part));
}

/** World-space center of the winding valley, also used by the camera path. */
export function terrainValleyCenter(worldZ: number, track: TerrainTrack): number {
  const timbre = clamp(track.timbre, 0, 1);
  const phase = hash(track.seed, 0, 11) * Math.PI * 2;
  return Math.sin(worldZ * (0.018 + timbre * 0.008) + phase) * (1.5 + timbre * 0.7)
    + Math.sin(worldZ * 0.007 + phase * 2.3) * 2.2;
}

function valleyFloor(worldZ: number, track: TerrainTrack): number {
  return Math.sin(worldZ * 0.033 + hash(track.seed, 0, 19) * 6.28) * 0.085;
}

function valleyHalfWidth(worldZ: number, track: TerrainTrack): number {
  return 1.65 + worldNoise(track, worldZ * 0.015, 23) * 0.35;
}

/**
 * Fixed world elevation. Left and right mountain ranges use their respective
 * track envelopes; visiting the same x/z always gives exactly the same height.
 */
export function terrainElevation(x: number, worldZ: number, track: TerrainTrack, intensity: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(worldZ) || !Number.isFinite(intensity)) return 0;
  const amount = clamp(intensity, 0, 2), timbre = clamp(track.timbre, 0, 1);
  const local = x - terrainValleyCenter(worldZ, track), side = local < 0 ? -1 : 1;
  const distance = Math.abs(local), channel = side < 0 ? 31 : 47;
  const width = valleyHalfWidth(worldZ, track);
  const rise = smoothstep(width, width + 3.1, distance);
  const mood = moodAtDistance(track, worldZ);
  const envelope = side < 0 ? mood.left : mood.right;
  const wavelength = 0.023 + timbre * 0.024;
  const long = worldNoise(track, worldZ * wavelength, channel);
  const detail = worldNoise(track, worldZ * (0.085 + timbre * 0.035), channel + 1);
  // Long ridges meander through world space instead of forming concentric waves.
  const ridgeDistance = 7.8 + long * 6.5;
  const ridge = Math.exp(-(((distance - ridgeDistance) / (5.6 - timbre * 1.3)) ** 2));
  const outer = Math.exp(-(((distance - 24 - long * 3) / 10) ** 2));
  const ridgeProfile = 0.56 + long * 0.9 + detail * (0.18 + timbre * 0.28);
  const peak = ridge * ridgeProfile * (3.4 + envelope * amount * 5.4);
  const distantRange = outer * (1.7 + worldNoise(track, worldZ * wavelength * 0.7, channel + 2) * 2.6
    + envelope * amount * 1.6);
  const edge = ridge * mood.rhythm * amount * (0.4 + detail * 1.2);
  return valleyFloor(worldZ, track) + rise * (0.3 + peak + distantRange + edge);
}

interface ProjectedPoint { x: number; y: number; depth: number }
const OFFSETS = [-34, -27, -21, -16, -12, -9, -6.8, -5.1, -3.8, -2.7, -1.8, -.9,
  0, .9, 1.8, 2.7, 3.8, 5.1, 6.8, 9, 12, 16, 21, 27, 34];
const ROWS = 28;
const ROW_SPACING = 4.2;
const NEAR = 1.4;

/** A forward camera journey through a song-seeded, world-anchored wire valley. */
export const terrain: StyleRenderer = (ctx, w, h, time, features, settings, context) => {
  const track = context?.track ?? getTerrainTrack();
  const unit = Math.min(w, h), cameraZ = travelAt(track, Math.max(0, time));
  const cameraX = terrainValleyCenter(cameraZ, track);
  const cameraY = valleyFloor(cameraZ, track) + 2.25;
  const lookAhead = 9;
  const yaw = Math.atan2(terrainValleyCenter(cameraZ + lookAhead, track) - cameraX, lookAhead);
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const focal = unit * 0.97, horizon = h * 0.385;
  const firstRow = Math.ceil((cameraZ + NEAR) / ROW_SPACING);
  const far = ROW_SPACING * ROWS;
  const project = (x: number, elevation: number, z: number): ProjectedPoint => {
    const dx = x - cameraX, dz = z - cameraZ;
    const depth = dx * sin + dz * cos;
    const safeDepth = Math.max(NEAR, depth);
    return { x: w / 2 + (dx * cos - dz * sin) * focal / safeDepth,
      y: horizon + (cameraY - elevation) * focal / safeDepth, depth };
  };
  const rows = Array.from({ length: ROWS }, (_, row) => {
    const worldZ = (firstRow + row) * ROW_SPACING;
    const center = terrainValleyCenter(worldZ, track);
    return { worldZ, points: OFFSETS.map(offset => project(center + offset,
      terrainElevation(center + offset, worldZ, track, settings.intensity), worldZ)) };
  });
  // Explicit clipping also bounds near-plane lines that project beyond the frame.
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const path = (points: ProjectedPoint[]) => {
    let started = false;
    ctx.beginPath();
    for (const point of points) {
      if (point.depth < NEAR) { started = false; continue; }
      if (!started) { ctx.moveTo(point.x, point.y); started = true; }
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  };
  // Draw the distant rows first so the close ranges have a crisp silhouette.
  for (let row = rows.length - 1; row >= 0; row--) {
    const distance = rows[row].worldZ - cameraZ;
    const fade = (1 - clamp(distance / far, 0, 1)) ** 0.72;
    ctx.lineWidth = 0.65 + fade * 0.75;
    ctx.strokeStyle = alpha(settings.color, (0.12 + fade * 0.58) * (0.8 + settings.glow * 0.25));
    path(rows[row].points.slice(0, 13));
    ctx.strokeStyle = alpha(settings.secondaryColor, (0.12 + fade * 0.58) * (0.8 + settings.glow * 0.25));
    path(rows[row].points.slice(12));
  }
  // Longitudinal wires emphasize travel through the fixed ridges and road.
  for (let column = 0; column < OFFSETS.length; column++) {
    const color = OFFSETS[column] < 0 ? settings.color : settings.secondaryColor;
    const road = Math.abs(OFFSETS[column]) < 2;
    ctx.strokeStyle = alpha(color, road ? 0.18 : 0.28 + settings.glow * 0.12);
    ctx.lineWidth = road ? 0.75 : 0.9;
    path(rows.map(row => row.points[column]));
  }
  // Two thin world-fixed verge lines make the open center legible as a route.
  for (const side of [-1, 1]) {
    const points = rows.map(row => {
      const x = terrainValleyCenter(row.worldZ, track) + side * valleyHalfWidth(row.worldZ, track);
      return project(x, valleyFloor(row.worldZ, track) + 0.025, row.worldZ);
    });
    ctx.strokeStyle = alpha(side < 0 ? settings.color : settings.secondaryColor,
      0.5 + features.level * settings.intensity * 0.16);
    ctx.lineWidth = 1.35; path(points);
  }
};
