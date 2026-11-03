import type { StyleRenderer } from './types';
import { TAU, alpha, noise } from './math';
const drive = (v: number) => Math.log1p(Math.max(0, Math.min(10, v))) / Math.LN2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
type Point = {
  x: number;
  y: number;
  z: number;
};
function project(p: Point, w: number, h: number, t: number) {
  const a = t * .13, x = p.x * Math.cos(a) + p.z * Math.sin(a), z = -p.x * Math.sin(a) + p.z * Math.cos(a), y = p.y * .94 - z * .34, depth = p.y * .34 + z * .94, k = 4.8 / (4.8 + depth);
  return [w * .5 + x * Math.min(w, h) * .25 * k, h * .45 + y * Math.min(w, h) * .25 * k];
}
const superformula: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const g = drive(s.intensity), u = Math.min(w, h), seed = context?.track?.seed ?? 8, m = 3 + seed % 6;
  const radius = (a: number, n: number) => clamp((Math.abs(Math.cos(m * a / 4)) ** n + Math.abs(Math.sin(m * a / 4)) ** n + .0001) ** (-1 / (.8 + f.bass * g * .13)), .4, 1.2);
  const point = (a: number, b: number) => { const r = radius(a, 2.4 + f.treble * g * .35), q = radius(b, 2.4 + f.level * g * .2); return project({ x: r * q * Math.cos(b) * Math.cos(a), y: q * Math.sin(b), z: r * q * Math.cos(b) * Math.sin(a) }, w, h, t); };
  ctx.lineWidth = u * .0016 * s.lineWidth;
  for (let ring = 1; ring < 22; ring++) {
    const b = (ring / 22 - .5) * Math.PI;
    ctx.strokeStyle = alpha(ring % 3 ? s.color : s.secondaryColor, .3 + ring / 70);
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const p = point(i / 120 * TAU, b);
      if (!i)
        ctx.moveTo(p[0], p[1]);
      else
        ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
  for (let line = 0; line < 30; line++) {
    const a = line / 30 * TAU;
    ctx.strokeStyle = alpha(s.secondaryColor, .26);
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const p = point(a, (i / 64 - .5) * Math.PI);
      if (!i)
        ctx.moveTo(p[0], p[1]);
      else
        ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
};
const stringArt: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = drive(s.intensity), length = u * (.31 + f.bass * g * .012), phase = t * .045;
  ctx.lineWidth = u * .0015 * s.lineWidth;
  ctx.save();
  ctx.translate(w * .5, h * .45);
  ctx.rotate(phase);
  for (let side = 0; side < 6; side++) {
    const a = side / 6 * TAU, b = (side + 1) / 6 * TAU;
    for (let i = 0; i < 44; i++) {
      const k = (i + 1) / 45, band = f.bands[(side * 7 + i) % 48] * g, bend = .7 + band * .045;
      ctx.strokeStyle = alpha(side % 2 ? s.color : s.secondaryColor, .16 + k * .38);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * length * k, Math.sin(a) * length * k);
      ctx.lineTo(Math.cos(b) * length * (1 - k), Math.sin(b) * length * (1 - k) * bend);
      ctx.stroke();
    }
  }
  ctx.restore();
};
const fireflies: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = drive(s.intensity), seed = context?.track?.seed ?? 81;
  const points = Array.from({ length: 150 }, (_, i) => ({ x: w * (.08 + noise(seed + i) * .84) + Math.sin(t * .23 + i) * u * .025, y: h * .45 + (noise(seed + i + 200) - .5) * u * .66 + Math.cos(t * .17 + i * 1.3) * u * .025, brightness: .3 + Math.sin(t * (.45 + noise(i) * .3) + i) ** 2 * .5, band: f.bands[i % 48] * g }));
  ctx.lineWidth = u * .0012 * s.lineWidth;
  points.forEach((p, i) => {
    for (let j = i + 1; j < points.length; j++) {
      const q = points[j], distance = Math.hypot(p.x - q.x, p.y - q.y);
      if (distance > u * .067)
        continue;
      ctx.strokeStyle = alpha(i % 3 ? s.color : s.secondaryColor, (1 - distance / (u * .067)) * (.18 + p.band * .055));
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    ctx.fillStyle = alpha(i % 3 ? s.color : s.secondaryColor, p.brightness + Math.min(.3, p.band * .09));
    ctx.beginPath();
    ctx.arc(p.x, p.y, u * (.0017 + Math.min(3, p.band) * .0011), 0, TAU);
    ctx.fill();
    if (i % 5 === 0) {
      ctx.strokeStyle = alpha(s.secondaryColor, p.brightness * .25);
      ctx.beginPath();
      ctx.arc(p.x, p.y, u * (.006 + p.band * .002), 0, TAU);
      ctx.stroke();
    }
  });
};
const circuit: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = drive(s.intensity), seed = context?.track?.seed ?? 23;
  ctx.lineWidth = u * .0017 * s.lineWidth;
  ctx.lineJoin = 'round';
  for (let line = 0; line < 36; line++) {
    const x0 = w * (.08 + noise(seed + line) * .3), x1 = w * (.62 + noise(seed + line + 60) * .3), y0 = h * .45 + (noise(seed + line + 121) - .5) * u * .65;
    const y1 = h * .45 + (noise(seed + line + 177) - .5) * u * .65, mx = w * (.42 + noise(seed + line + 235) * .16), band = f.bands[line % 48] * g;
    const points = [[x0, y0], [mx, y0], [mx, y1], [x1, y1]];
    ctx.strokeStyle = alpha(line % 3 ? s.color : s.secondaryColor, .22 + band * .055);
    ctx.beginPath();
    points.forEach(([x, y], i) => { if (!i)
      ctx.moveTo(x, y);
    else
      ctx.lineTo(x, y); });
    ctx.stroke();
    const lengths = [Math.abs(mx - x0), Math.abs(y1 - y0), Math.abs(x1 - mx)], total = lengths.reduce((a, b) => a + b, 0);
    let distance = ((t * (.06 + noise(line) * .06) + noise(line + 77)) % 1) * total;
    for (let segment = 0; segment < 3; segment++) {
      if (distance > lengths[segment]) {
        distance -= lengths[segment];
        continue;
      }
      const k = distance / Math.max(.001, lengths[segment]), p = points[segment], q = points[segment + 1];
      ctx.fillStyle = alpha(s.secondaryColor, .65 + Math.min(.3, band * .09));
      ctx.beginPath();
      ctx.arc(p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, u * (.002 + band * .0007), 0, TAU);
      ctx.fill();
      break;
    }
    for (const p of [points[0], points[3]]) {
      ctx.strokeStyle = alpha(s.color, .45);
      ctx.beginPath();
      ctx.arc(p[0], p[1], u * (.003 + band * .0006), 0, TAU);
      ctx.stroke();
    }
  }
};
const gravityWell: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = drive(s.intensity), count = 33;
  const point = (x: number, z: number) => {
    const r = Math.hypot(x, z), depth = (.25 + f.bass * g * .12) * Math.exp(-r * r * 2.8), k = 3.8 / (3.8 + z);
    return [w * .5 + x * u * .31 * k, h * .43 + (z * .13 + depth * .58) * u * k];
  };
  ctx.lineWidth = u * .0014 * s.lineWidth;
  for (let axis = 0; axis < 2; axis++)
    for (let line = 0; line < count; line++) {
      ctx.strokeStyle = alpha(axis ? s.color : s.secondaryColor, .26 + line / count * .25);
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const a = (line / (count - 1) - .5) * 2.7, b = (i / (count - 1) - .5) * 2.7, p = point(axis ? b : a, axis ? a : b);
        if (!i)
          ctx.moveTo(p[0], p[1]);
        else
          ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
    }
  for (let i = 0; i < 38; i++) {
    const a = noise(i + 8) * TAU + t * (.15 + noise(i + 91) * .2), r = .12 + noise(i + 39) * 1.05, p = point(Math.cos(a) * r, Math.sin(a) * r);
    ctx.fillStyle = alpha(s.secondaryColor, .55 + f.bands[i % 48] * g * .1);
    ctx.beginPath();
    ctx.arc(p[0], p[1], u * .002, 0, TAU);
    ctx.fill();
  }
};
const stainedGlass: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = drive(s.intensity), count = 16;
  ctx.lineWidth = u * .002 * s.lineWidth;
  for (let ring = 0; ring < 5; ring++)
    for (let sector = 0; sector < count; sector++) {
      const a = sector / count * TAU + t * .025, b = (sector + 1) / count * TAU + t * .025, inner = u * ring * .063, outer = u * (ring + 1) * .063, mid = (a + b) / 2;
      const band = f.bands[(sector + ring * 7) % 48] * g, color = (ring + sector) % 3 ? s.color : s.secondaryColor;
      const points = [[Math.cos(a) * inner, Math.sin(a) * inner], [Math.cos(a) * outer, Math.sin(a) * outer], [Math.cos(mid) * outer * 1.035, Math.sin(mid) * outer * 1.035], [Math.cos(b) * outer, Math.sin(b) * outer], [Math.cos(b) * inner, Math.sin(b) * inner]];
      ctx.beginPath();
      points.forEach(([x, y], i) => { if (!i)
        ctx.moveTo(w * .5 + x, h * .45 + y);
      else
        ctx.lineTo(w * .5 + x, h * .45 + y); });
      ctx.closePath();
      ctx.fillStyle = alpha(color, .04 + band * .095);
      ctx.fill();
      ctx.strokeStyle = alpha(color, .38 + band * .09);
      ctx.stroke();
    }
};
const paperFan: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = drive(s.intensity), openness = .8 + f.bass * g * .15 + Math.sin(t * .35) * .07, cx = w * .5, cy = h * .65, radius = u * .4;
  ctx.lineWidth = u * .0018 * s.lineWidth;
  for (let fold = 0; fold < 36; fold++) {
    const a = -Math.PI / 2 - openness + fold / 36 * openness * 2, b = -Math.PI / 2 - openness + (fold + 1) / 36 * openness * 2, band = f.bands[fold % 48] * g;
    const r1 = radius * (fold % 2 ? .92 : 1), r2 = radius * (fold % 2 ? 1 : .92);
    const points = [[cx, cy], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], [cx + Math.cos(b) * r2, cy + Math.sin(b) * r2]];
    const color = fold % 3 ? s.color : s.secondaryColor;
    ctx.beginPath();
    points.forEach(([x, y], i) => { if (!i)
      ctx.moveTo(x, y);
    else
      ctx.lineTo(x, y); });
    ctx.closePath();
    ctx.fillStyle = alpha(color, .035 + band * .05);
    ctx.fill();
    ctx.strokeStyle = alpha(color, .3 + band * .08);
    ctx.stroke();
  }
};
const bubbles: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = drive(s.intensity), seed = context?.track?.seed ?? 5;
  ctx.lineWidth = u * .0016 * s.lineWidth;
  for (let i = 0; i < 30; i++) {
    const band = f.bands[i % 48] * g, r = u * (.017 + noise(seed + i + 55) * .035 + band * .004), phase = (noise(seed + i) + t * (.018 + noise(i + 200) * .018)) % 1;
    const x = w * (.1 + noise(seed + i + 98) * .8) + Math.sin(t * .2 + i) * u * .022, y = h * (.94 - phase * .88);
    const color = i % 3 ? s.color : s.secondaryColor, gradient = ctx.createRadialGradient(x - r * .25, y - r * .3, r * .04, x, y, r);
    gradient.addColorStop(0, alpha(color, .015));
    gradient.addColorStop(.78, alpha(color, .025 + band * .015));
    gradient.addColorStop(1, alpha(s.secondaryColor, .09 + band * .02));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = alpha(color, .35 + band * .1);
    ctx.stroke();
    ctx.strokeStyle = alpha(s.secondaryColor, .55);
    ctx.beginPath();
    ctx.arc(x, y, r * .77, -Math.PI * .85, -Math.PI * .47);
    ctx.stroke();
  }
};
export const fieldRenderers: Record<'superformula' | 'string-art' | 'fireflies' | 'circuit' | 'gravity-well' | 'stained-glass' | 'paper-fan' | 'bubbles', StyleRenderer> = { superformula, 'string-art': stringArt, fireflies, circuit, 'gravity-well': gravityWell, 'stained-glass': stainedGlass, 'paper-fan': paperFan, bubbles };
