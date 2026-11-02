import { sampleFeatures } from '../audio/analysis';
import { alpha, noise, TAU } from './math';
import type { StyleRenderer } from './types';
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const drive = (x: number) => Math.log1p(clamp(x, 0, 10)) / Math.LN2;
/** A real, sampled spectrum history, rather than accumulated canvas frames. */
const waterfall: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), gain = drive(s.intensity), rows = 28;
  ctx.lineWidth = u * .0018 * s.lineWidth;
  for (let row = rows - 1; row >= 0; row--) {
    const age = row * .075, past = context?.analysis ? sampleFeatures(context.analysis, Math.max(0, t - age), s.smoothing) : f;
    const depth = 1 - row / rows, span = w * (.19 + depth * .25), center = w * .5 + (row / rows - .5) * u * .13;
    const y = h * .25 + depth * h * .43;
    ctx.strokeStyle = alpha(row % 4 === 0 ? s.secondaryColor : s.color, .14 + depth * .6);
    ctx.beginPath();
    for (let b = 0; b < 48; b++) {
      const x = center + (b / 47 - .5) * span * 2;
      const v = past.bands[b] * gain;
      const py = y - Math.log1p(v) * u * (.028 + depth * .065);
      if (b === 0)
        ctx.moveTo(x, py);
      else
        ctx.lineTo(x, py);
    }
    ctx.stroke();
  }
};
/** MilkDrop-like echo geometry reconstructed from audio history for reliable seeks. */
const phosphor: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), gain = drive(s.intensity);
  ctx.lineWidth = u * .002 * s.lineWidth;
  for (let echo = 17; echo >= 0; echo--) {
    const age = echo * .06, past = context?.analysis ? sampleFeatures(context.analysis, Math.max(0, t - age), s.smoothing) : f;
    const phase = t * .28 - age * .7, radius = u * (.19 + echo * .009 + past.bass * gain * .018);
    ctx.strokeStyle = alpha(echo % 3 === 0 ? s.secondaryColor : s.color, (1 - echo / 20) * (.22 + s.glow * .3));
    ctx.beginPath();
    for (let i = 0; i <= 192; i++) {
      const a = i / 192 * TAU, band = past.bands[Math.floor(i / 192 * 47)];
      const r = radius * (1 + Math.sin(a * 5 + phase) * .06 + band * gain * .2 + past.attack * gain * .025 * Math.sin(a * 11));
      const x = w * .5 + Math.cos(a + phase) * r, y = h * .45 + Math.sin(a + phase) * r * .8;
      if (i === 0)
        ctx.moveTo(x, y);
      else
        ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
};
const radar: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), gain = drive(s.intensity), r = u * .35, cx = w * .5, cy = h * .45, angle = t * .8;
  ctx.lineWidth = u * .002 * s.lineWidth;
  for (let ring = 1; ring <= 5; ring++) {
    ctx.strokeStyle = alpha(s.color, .12 + f.bass * gain * .025);
    ctx.beginPath();
    ctx.arc(cx, cy, r * ring / 5, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * .1, cy + Math.sin(a) * r * .1);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  for (let tail = 0; tail < 24; tail++) {
    const a = angle - tail * .025;
    ctx.strokeStyle = alpha(s.secondaryColor, (1 - tail / 24) * (.18 + f.level * gain * .14));
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  const seed = context?.track?.seed ?? 34;
  for (let i = 0; i < 38; i++) {
    const a = noise(i + seed) * TAU, d = (.18 + noise(i + seed + 100) * .78) * r;
    const elapsed = ((angle - a) % TAU + TAU) % TAU, energy = f.bands[i % 48] * gain;
    const visibility = Math.exp(-elapsed * 1.3) * (.2 + clamp(energy) * .8);
    ctx.fillStyle = alpha(i % 3 ? s.color : s.secondaryColor, visibility);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, u * (.002 + clamp(energy) * .004), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = alpha(s.secondaryColor, visibility * .65);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, u * (.008 + f.attack * gain * .009), 0, TAU);
    ctx.stroke();
  }
};
/** Marching squares over a bounded inverse-distance field. */
const metaballs: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), gain = drive(s.intensity), cols = 66, rows = 46;
  const sources = Array.from({ length: 6 }, (_, i) => ({ x: Math.sin(t * (.19 + i * .017) + i * 2.1) * .62, y: Math.cos(t * (.23 + i * .013) + i * 1.7) * .55, power: .045 + f.bands[i * 7] * gain * .035 }));
  const field = new Float32Array((cols + 1) * (rows + 1));
  for (let y = 0; y <= rows; y++)
    for (let x = 0; x <= cols; x++) {
      const px = x / cols * 2 - 1, py = y / rows * 2 - 1;
      field[y * (cols + 1) + x] = sources.reduce((sum, p) => sum + p.power / (.022 + (px - p.x) ** 2 + (py - p.y) ** 2), 0);
    }
  ctx.lineWidth = u * .0018 * s.lineWidth;
  for (const [index, level] of [1, 1.5, 2.2, 3.2].entries()) {
    ctx.strokeStyle = alpha(index % 2 ? s.secondaryColor : s.color, .3 + index * .12);
    ctx.beginPath();
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const pts = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], values = pts.map(([px, py]) => field[py * (cols + 1) + px]);
        const intersections: number[][] = [];
        for (let e = 0; e < 4; e++) {
          const n = (e + 1) % 4;
          if ((values[e] >= level) === (values[n] >= level))
            continue;
          const k = (level - values[e]) / (values[n] - values[e]);
          intersections.push([w * .5 + ((pts[e][0] + (pts[n][0] - pts[e][0]) * k) / cols - .5) * u * .85, h * .45 + ((pts[e][1] + (pts[n][1] - pts[e][1]) * k) / rows - .5) * u * .72]);
        }
        // The saddle case uses a fixed edge order, so topology remains deterministic.
        for (let i = 0; i + 1 < intersections.length; i += 2) {
          ctx.moveTo(intersections[i][0], intersections[i][1]);
          ctx.lineTo(intersections[i + 1][0], intersections[i + 1][1]);
        }
      }
    ctx.stroke();
  }
};
const fractal: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), gain = drive(s.intensity), seed = context?.track?.seed ?? 12;
  const branch = (x: number, y: number, a: number, len: number, depth: number, index: number) => {
    const bend = Math.sin(t * .4 + index * .73) * .045 + f.bands[(index + depth * 5) % 48] * gain * .05;
    const nx = x + Math.cos(a + bend) * len, ny = y + Math.sin(a + bend) * len;
    ctx.strokeStyle = alpha(depth > 3 ? s.color : s.secondaryColor, .32 + depth * .065);
    ctx.lineWidth = u * .00085 * (.6 + depth * .45) * s.lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    if (depth === 0) {
      ctx.fillStyle = alpha(s.secondaryColor, .35 + f.treble * gain * .1);
      ctx.beginPath();
      ctx.arc(nx, ny, u * .0025, 0, TAU);
      ctx.fill();
      return;
    }
    const angle = .35 + noise(seed + index) * .21 + f.attack * gain * .045;
    branch(nx, ny, a - angle, len * .71, depth - 1, index * 2 + 1);
    branch(nx, ny, a + angle, len * .71, depth - 1, index * 2 + 2);
  };
  branch(w * .5, h * .79, -Math.PI / 2, u * (.16 + f.bass * gain * .015), 7, 1);
};
type Point3 = {
  x: number;
  y: number;
  z: number;
};
function rotate(p: Point3, t: number): Point3 {
  const x = p.x * Math.cos(t) + p.z * Math.sin(t), z = -p.x * Math.sin(t) + p.z * Math.cos(t);
  return { x, y: p.y * Math.cos(.45) - z * Math.sin(.45), z: p.y * Math.sin(.45) + z * Math.cos(.45) };
}
const torusKnot: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), gain = drive(s.intensity), count = 180;
  const curve = (a: number): Point3 => { const r = 1 + .35 * Math.cos(3 * a); return { x: r * Math.cos(2 * a), y: r * Math.sin(2 * a), z: .35 * Math.sin(3 * a) }; };
  const rings = Array.from({ length: count }, (_, i) => {
    const a = i / count * TAU, p = curve(a), next = curve(a + .001), tangent = { x: next.x - p.x, y: next.y - p.y, z: next.z - p.z };
    const len = Math.hypot(tangent.x, tangent.y), normal = { x: -tangent.y / len, y: tangent.x / len, z: 0 };
    const norm = Math.hypot(tangent.x, tangent.y, tangent.z), binormal = { x: -tangent.z * normal.y / norm, y: tangent.z * normal.x / norm, z: (tangent.x * normal.y - tangent.y * normal.x) / norm };
    const radius = .055 + f.bands[Math.floor(i / count * 47)] * gain * .035;
    return Array.from({ length: 6 }, (_, j) => { const b = j / 6 * TAU; return rotate({ x: p.x + radius * (Math.cos(b) * normal.x + Math.sin(b) * binormal.x), y: p.y + radius * (Math.cos(b) * normal.y + Math.sin(b) * binormal.y), z: p.z + radius * Math.sin(b) * binormal.z }, t * .21); });
  });
  const project = (p: Point3) => { const perspective = 3.8 / (3.8 + p.z); return [w * .5 + p.x * u * .24 * perspective, h * .45 + p.y * u * .24 * perspective]; };
  ctx.lineWidth = u * .0018 * s.lineWidth;
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => rings[b][0].z - rings[a][0].z);
  for (const i of order) {
    ctx.strokeStyle = alpha(i % 4 ? s.color : s.secondaryColor, clamp(.55 - rings[i][0].z * .17, .16, .9));
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const a = project(rings[i][j]), b = project(rings[(i + 1) % count][j]);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      if (i % 4 === 0) {
        const c = project(rings[i][(j + 1) % 6]);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(c[0], c[1]);
      }
    }
    ctx.stroke();
  }
};
/** Voronoi cells clipped against pairwise perpendicular bisectors. */
const cells: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), gain = drive(s.intensity), seed = context?.track?.seed ?? 17;
  const points = Array.from({ length: 32 }, (_, i) => ({ x: (noise(seed + i) * .92 + .04) * w + Math.sin(t * .22 + i) * u * (.025 + f.bass * gain * .007), y: h * .45 + (noise(seed + i + 79) - .5) * u * .74 + Math.cos(t * .19 + i) * u * .035 }));
  ctx.lineWidth = u * .002 * s.lineWidth;
  points.forEach((p, i) => {
    let polygon = [[w * .07, h * .45 - u * .4], [w * .93, h * .45 - u * .4], [w * .93, h * .45 + u * .4], [w * .07, h * .45 + u * .4]];
    for (const q of points) {
      if (p === q || !polygon.length)
        continue;
      const nx = q.x - p.x, ny = q.y - p.y, limit = (q.x * q.x + q.y * q.y - p.x * p.x - p.y * p.y) / 2;
      const clipped: number[][] = [];
      for (let k = 0; k < polygon.length; k++) {
        const a = polygon[k], b = polygon[(k + 1) % polygon.length], da = a[0] * nx + a[1] * ny - limit, db = b[0] * nx + b[1] * ny - limit;
        if (da <= 0)
          clipped.push(a);
        if ((da <= 0) !== (db <= 0)) {
          const r = da / (da - db);
          clipped.push([a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]);
        }
      }
      polygon = clipped;
    }
    if (polygon.length < 3)
      return;
    const energy = clamp(f.bands[i % 48] * gain, 0, 3), shrink = .87 + Math.min(.08, energy * .04);
    ctx.beginPath();
    polygon.forEach(([x, y], j) => { const px = p.x + (x - p.x) * shrink, py = p.y + (y - p.y) * shrink; if (j === 0)
      ctx.moveTo(px, py);
    else
      ctx.lineTo(px, py); });
    ctx.closePath();
    const color = i % 3 ? s.color : s.secondaryColor;
    ctx.fillStyle = alpha(color, .025 + energy * .045);
    ctx.strokeStyle = alpha(color, .3 + Math.min(.5, energy * .18));
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = alpha(s.secondaryColor, .35 + Math.min(.6, energy * .25));
    ctx.beginPath();
    ctx.arc(p.x, p.y, u * (.0017 + energy * .001), 0, TAU);
    ctx.fill();
  });
};
const crystal: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), gain = drive(s.intensity), seed = context?.track?.seed ?? 9;
  const objects = Array.from({ length: 24 }, (_, i) => {
    const a = noise(seed + i) * TAU, r = .2 + noise(seed + i + 40) * .8;
    return { i, center: rotate({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: (noise(seed + i + 80) - .5) * 1.3 }, t * .13) };
  }).sort((a, b) => b.center.z - a.center.z);
  ctx.lineWidth = u * .002 * s.lineWidth;
  for (const { i, center } of objects) {
    const energy = f.bands[i * 2] * gain, length = .11 + noise(seed + i + 12) * .19 + energy * .06, radius = .035 + energy * .009;
    const vertices = [{ x: 0, y: -length, z: 0 }, { x: 0, y: length * .7, z: 0 }, ...Array.from({ length: 4 }, (_, j) => ({ x: Math.cos(j / 4 * TAU) * radius, y: 0, z: Math.sin(j / 4 * TAU) * radius }))].map(p => {
      const q = rotate(p, t * .37 + i);
      const z = q.z + center.z, perspective = 3.5 / (3.5 + z);
      return { x: w * .5 + (center.x + q.x) * u * .35 * perspective, y: h * .45 + (center.y + q.y) * u * .35 * perspective, z };
    });
    const faces = Array.from({ length: 8 }, (_, j) => [j % 2, 2 + Math.floor(j / 2), 2 + (Math.floor(j / 2) + 1) % 4]).sort((a, b) => b.reduce((v, k) => v + vertices[k].z, 0) - a.reduce((v, k) => v + vertices[k].z, 0));
    for (const [index, face] of faces.entries()) {
      const color = (i + index) % 3 ? s.color : s.secondaryColor;
      ctx.beginPath();
      face.forEach((k, j) => { const p = vertices[k]; if (j === 0)
        ctx.moveTo(p.x, p.y);
      else
        ctx.lineTo(p.x, p.y); });
      ctx.closePath();
      ctx.fillStyle = alpha(color, .025 + index * .008 + clamp(energy) * .06);
      ctx.strokeStyle = alpha(color, clamp(.42 - center.z * .15 + energy * .07, .15, .9));
      ctx.fill();
      ctx.stroke();
    }
  }
};
export const experimentalRenderers: Record<'waterfall' | 'phosphor' | 'radar' | 'metaballs' | 'fractal' | 'torus-knot' | 'cells' | 'crystal', StyleRenderer> = { waterfall, phosphor, radar, metaballs, fractal, 'torus-knot': torusKnot, cells, crystal };
