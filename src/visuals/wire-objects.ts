import type { StyleId } from '../shared';
import type { StyleRenderer } from './types';
import { alpha, noise, TAU } from './math';
import { getTerrainTrack, moodAtDistance, travelAt } from './terrain-track';

interface Point3 { x: number; y: number; z: number }
interface Point2 { x: number; y: number }
interface Projection { width: number; height: number; centerX: number; centerY: number; focal: number; near: number }
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));

/** Clip before projection, then clip the screen segment so coordinates stay bounded. */
function segment(a: Point3, b: Point3, camera: Projection): [Point2, Point2] | null {
  if (a.z < camera.near && b.z < camera.near) return null;
  let first = a, last = b;
  if (a.z < camera.near || b.z < camera.near) {
    const ratio = (camera.near - a.z) / (b.z - a.z);
    const crossing = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio, z: camera.near };
    if (a.z < camera.near) first = crossing; else last = crossing;
  }
  const x0 = camera.centerX + first.x * camera.focal / first.z;
  const y0 = camera.centerY + first.y * camera.focal / first.z;
  const x1 = camera.centerX + last.x * camera.focal / last.z;
  const y1 = camera.centerY + last.y * camera.focal / last.z;
  if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
  const dx = x1 - x0, dy = y1 - y0;
  let start = 0, end = 1;
  const bounds = [[-dx, x0], [dx, camera.width - x0], [-dy, y0], [dy, camera.height - y0]];
  for (const [direction, distance] of bounds) {
    if (Math.abs(direction) < 1e-8) { if (distance < 0) return null; continue; }
    const ratio = distance / direction;
    if (direction < 0) start = Math.max(start, ratio); else end = Math.min(end, ratio);
    if (start > end) return null;
  }
  return [{ x: x0 + dx * start, y: y0 + dy * start }, { x: x0 + dx * end, y: y0 + dy * end }];
}

function pathSegment(ctx: CanvasRenderingContext2D, a: Point3, b: Point3, camera: Projection): boolean {
  const points = segment(a, b, camera);
  if (!points) return false;
  ctx.moveTo(points[0].x, points[0].y); ctx.lineTo(points[1].x, points[1].y);
  return true;
}

/** A continuous cylindrical mesh, viewed from inside while the camera travels forward. */
const tube: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const track = context?.track ?? getTerrainTrack();
  const unit = Math.min(w, h), cameraDistance = travelAt(track, t) * 0.85;
  const seed = (track.seed % 65521) * 0.013, spacing = 2.1;
  const firstRing = Math.floor(cameraDistance / spacing), rings = 22, sectors = 24;
  const camera: Projection = { width: w, height: h, centerX: w / 2, centerY: h * 0.44, focal: unit * 0.92, near: 1.1 };
  const centerAt = (distance: number) => ({ x: Math.sin(distance * 0.085 + seed) * 0.62, y: Math.cos(distance * 0.065 + seed * 0.7) * 0.48 });
  const cameraCenter = centerAt(cameraDistance);
  const roll = Math.sin(t * 0.065 + seed) * 0.04;
  const points: Point3[][] = [];
  for (let ring = 0; ring < rings; ring++) {
    const worldZ = (firstRing + ring) * spacing;
    const mood = moodAtDistance(track, worldZ / 0.85);
    const center = centerAt(worldZ);
    const twist = worldZ * (0.08 + track.timbre * 0.055) + seed + roll;
    const radius = 4.15 + track.timbre * 0.6 + mood.left * s.intensity * 0.45;
    points.push(Array.from({ length: sectors }, (_, sector) => {
      const angle = sector / sectors * TAU + twist;
      const ripple = Math.sin(sector / sectors * TAU * 3 + worldZ * 0.16 + seed) * mood.right * s.intensity * 0.22;
      return { x: center.x - cameraCenter.x + Math.cos(angle) * (radius + ripple),
        y: center.y - cameraCenter.y + Math.sin(angle) * (radius + ripple), z: worldZ - cameraDistance };
    }));
  }
  // Distant rings first. Their unchanging world distance avoids frame-dependent drift.
  for (let ring = rings - 1; ring >= 0; ring--) {
    const z = points[ring][0].z;
    if (z < camera.near) continue;
    const depth = clamp(1 - z / (spacing * rings));
    const entrance = clamp((z - camera.near) / 1.8);
    ctx.strokeStyle = alpha((firstRing + ring) % 4 ? s.color : s.secondaryColor,
      entrance * (0.08 + depth * 0.48 + f.attack * s.intensity * 0.07) * (0.8 + s.glow * 0.4));
    ctx.lineWidth = (unit / 1080 * (0.55 + depth * 1.4)) * s.lineWidth;
    ctx.beginPath();
    for (let sector = 0; sector < sectors; sector++) pathSegment(ctx, points[ring][sector], points[ring][(sector + 1) % sectors], camera);
    ctx.stroke();
  }
  // Longitudinal ribs make the depth a surface instead of a stack of flat rings.
  for (let band = 0; band < 4; band++) {
    ctx.beginPath();
    for (let sector = band; sector < sectors; sector += 4) {
      for (let ring = 0; ring < rings - 1; ring++) pathSegment(ctx, points[ring][sector], points[ring + 1][sector], camera);
    }
    ctx.strokeStyle = alpha(band % 2 ? s.secondaryColor : s.color, 0.17 + s.glow * 0.1 + f.treble * s.intensity * 0.08);
    ctx.lineWidth = (unit * 0.0008) * s.lineWidth; ctx.stroke();
  }
};

/** A rotating latitude/longitude sphere with band-driven surface displacement. */
const orb: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const track = context?.track ?? getTerrainTrack();
  const unit = Math.min(w, h), seed = (track.seed % 65521) * 0.013;
  const yaw = t * 0.15 + seed, tilt = 0.46 + Math.sin(t * 0.08 + seed) * 0.12;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw), cosX = Math.cos(tilt), sinX = Math.sin(tilt);
  const camera: Projection = { width: w, height: h, centerX: w / 2, centerY: h * 0.44, focal: unit * 0.98, near: 1.1 };
  const lobes = 3 + Math.round(track.timbre * 4);
  const point = (longitude: number, latitude: number): Point3 => {
    const bandPosition = ((longitude / TAU + seed * 0.05) % 1 + 1) % 1 * 48;
    const i = Math.floor(bandPosition), fraction = bandPosition - i;
    const level = (f.bands[i % 48] ?? 0) * (1 - fraction) + (f.bands[(i + 1) % 48] ?? 0) * fraction;
    const ripple = Math.sin(longitude * lobes + latitude * 2 + seed) * f.treble * 0.04;
    const radius = 1 + (level * 0.14 + ripple + f.bass * 0.035) * s.intensity;
    const x = Math.cos(latitude) * Math.cos(longitude) * radius;
    const y = Math.sin(latitude) * radius;
    const z = Math.cos(latitude) * Math.sin(longitude) * radius;
    const rotatedX = x * cosY + z * sinY, rotatedZ = -x * sinY + z * cosY;
    return { x: rotatedX, y: y * cosX - rotatedZ * sinX, z: 3.9 + y * sinX + rotatedZ * cosX };
  };
  const draw = (a: Point3, b: Point3, secondary: boolean) => {
    const front = clamp((4.9 - (a.z + b.z) / 2) / 2);
    ctx.strokeStyle = alpha(secondary ? s.secondaryColor : s.color,
      0.08 + front ** 1.5 * (0.46 + f.level * s.intensity * 0.12 + s.glow * 0.1));
    ctx.lineWidth = (unit / 1080 * (0.6 + front * 0.95)) * s.lineWidth;
    ctx.beginPath(); if (pathSegment(ctx, a, b, camera)) ctx.stroke();
  };
  for (let latitude = 1; latitude < 12; latitude++) {
    const phi = -Math.PI / 2 + latitude / 12 * Math.PI;
    for (let step = 0; step < 36; step++) draw(point(step / 36 * TAU, phi), point((step + 1) / 36 * TAU, phi), latitude % 3 === 0);
  }
  for (let longitude = 0; longitude < 16; longitude++) {
    const theta = longitude / 16 * TAU;
    for (let step = 0; step < 20; step++) draw(point(theta, -Math.PI / 2 + step / 20 * Math.PI), point(theta, -Math.PI / 2 + (step + 1) / 20 * Math.PI), longitude % 4 === 0);
  }
};

/** Stationary city blocks in world coordinates; only the distance-derived camera moves. */
const city: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const track = context?.track ?? getTerrainTrack();
  const unit = Math.min(w, h), distance = travelAt(track, t);
  const seed = (track.seed % 65521) * 0.013, spacing = 4.9, road = 3.15, far = 72;
  const cameraX = Math.sin(distance * 0.025 + seed) * 0.22;
  const camera: Projection = { width: w, height: h, centerX: w / 2, centerY: h * 0.4, focal: unit * 0.96, near: 1.35 };
  const cameraHeight = 1.6;
  const world = (x: number, y: number, z: number): Point3 => ({ x: x - cameraX, y: cameraHeight - y, z: z - distance });
  const first = Math.floor(distance / spacing) - 1;
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  // Draw far rows before near rows; building dimensions depend on their world row, never t.
  for (let row = first + 15; row >= first; row--) {
    for (const side of [-1, 1]) for (let lane = 0; lane < 2; lane++) {
      const key = seed + row * 131 + lane * 37 + side * 17;
      const z = row * spacing + noise(key + 3) * 0.65;
      const mood = moodAtDistance(track, Math.max(0, z));
      const amplitude = side < 0 ? mood.left : mood.right;
      const width = 1.2 + noise(key + 8) * 1.35, depth = 2.4 + noise(key + 11) * 1.5;
      const height = 1.2 + noise(key + 5) * 2.6 + amplitude * (3.5 + track.timbre * 3.5) * s.intensity + mood.rhythm * 0.8;
      const x = side * (road + lane * 3.5 + width / 2 + noise(key + 2) * 0.35);
      const points = [world(x - width / 2, 0, z), world(x + width / 2, 0, z),
        world(x + width / 2, 0, z + depth), world(x - width / 2, 0, z + depth),
        world(x - width / 2, height, z), world(x + width / 2, height, z),
        world(x + width / 2, height, z + depth), world(x - width / 2, height, z + depth)];
      const visibleDepth = z + depth / 2 - distance;
      if (visibleDepth > far || z + depth - distance < camera.near) continue;
      const fade = clamp(1 - Math.max(camera.near, visibleDepth) / far) ** 1.2;
      ctx.strokeStyle = alpha(lane ? s.secondaryColor : s.color, fade * (0.25 + s.glow * 0.18 + f.level * s.intensity * 0.09));
      ctx.lineWidth = (unit / 1080 * (0.65 + fade * 0.7)) * s.lineWidth;
      ctx.beginPath(); for (const [a, b] of edges) pathSegment(ctx, points[a], points[b], camera); ctx.stroke();
      // A small number of horizontal facade floors adds readable architecture at close range.
      if (visibleDepth < 35) {
        ctx.strokeStyle = alpha(lane ? s.color : s.secondaryColor, fade * 0.13);
        ctx.lineWidth = (unit * 0.0006) * s.lineWidth; ctx.beginPath();
        for (let floor = 1; floor <= 3; floor++) {
          const y = height * floor / 4;
          pathSegment(ctx, world(x - width / 2, y, z), world(x + width / 2, y, z), camera);
        }
        ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = alpha(s.secondaryColor, 0.27 + s.glow * 0.12); ctx.lineWidth = (unit * 0.001) * s.lineWidth;
  ctx.beginPath();
  for (const side of [-1, 1]) pathSegment(ctx, world(side * road, 0, distance + camera.near), world(side * road, 0, distance + far), camera);
  ctx.stroke();
  ctx.beginPath();
  const firstMark = Math.floor(distance / 4);
  for (let mark = firstMark; mark < firstMark + 18; mark++) {
    const z = mark * 4;
    pathSegment(ctx, world(0, 0, z), world(0, 0, z + 1.6), camera);
  }
  ctx.strokeStyle = alpha(s.color, 0.16 + f.bass * s.intensity * 0.08); ctx.lineWidth = (unit * 0.0013) * s.lineWidth; ctx.stroke();
};

export const wireObjectRenderers: Pick<Record<StyleId, StyleRenderer>, 'wire-tube' | 'wire-orb' | 'wire-city'> = {
  'wire-tube': tube, 'wire-orb': orb, 'wire-city': city,
};
