import type { StyleRenderer } from './types';
import { TAU, alpha, noise } from './math';
const gain = (v: number) => Math.log1p(Math.max(0, Math.min(10, v))) / Math.LN2;
type Point = {
  x: number;
  y: number;
  z: number;
};
function project(p: Point, w: number, h: number, t: number) {
  const a = t * .12, x = p.x * Math.cos(a) + p.z * Math.sin(a), z = -p.x * Math.sin(a) + p.z * Math.cos(a);
  const y = p.y * .9 - z * .435, depth = p.y * .435 + z * .9, scale = 4 / (4 + depth);
  return [w * .5 + x * Math.min(w, h) * .29 * scale, h * .45 + y * Math.min(w, h) * .29 * scale];
}
const mobius: StyleRenderer = (ctx, w, h, t, f, s) => {
  const g = gain(s.intensity), u = Math.min(w, h);
  ctx.lineWidth = u * .0014 * s.lineWidth;
  for (let band = 0; band < 13; band++) {
    const v = (band / 12 - .5) * (.65 + f.bass * g * .06);
    ctx.strokeStyle = alpha(band % 3 ? s.color : s.secondaryColor, .26 + band * .035);
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const a = i / 240 * TAU, r = 1 + v * Math.cos(a / 2), p = project({ x: r * Math.cos(a), y: v * Math.sin(a / 2), z: r * Math.sin(a) }, w, h, t);
      if (!i)
        ctx.moveTo(p[0], p[1]);
      else
        ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * TAU, span = .32 + f.bands[i % 48] * g * .055;
    ctx.strokeStyle = alpha(s.secondaryColor, .28);
    ctx.beginPath();
    for (const [j, v] of [-span, span].entries()) {
      const r = 1 + v * Math.cos(a / 2), p = project({ x: r * Math.cos(a), y: v * Math.sin(a / 2), z: r * Math.sin(a) }, w, h, t);
      if (!j)
        ctx.moveTo(p[0], p[1]);
      else
        ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
};
const magnetic: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = gain(s.intensity), distance = .28 + f.bass * g * .02, phase = t * .12;
  const poles = [{ x: Math.cos(phase) * distance, y: Math.sin(phase) * distance, q: 1 }, { x: -Math.cos(phase) * distance, y: -Math.sin(phase) * distance, q: -1 }];
  ctx.lineWidth = u * .00135 * s.lineWidth;
  for (let stream = 0; stream < 48; stream++) {
    const a = stream / 48 * TAU;
    let x = poles[0].x + Math.cos(a) * .035, y = poles[0].y + Math.sin(a) * .035;
    ctx.strokeStyle = alpha(stream % 3 ? s.color : s.secondaryColor, .3 + stream / 160);
    ctx.beginPath();
    for (let step = 0; step < 140; step++) {
      const px = w * .5 + x * u * .8, py = h * .45 + y * u * .8;
      if (!step)
        ctx.moveTo(px, py);
      else
        ctx.lineTo(px, py);
      let dx = 0, dy = 0;
      for (const p of poles) {
        const d = Math.max(.002, (x - p.x) ** 2 + (y - p.y) ** 2), force = p.q / (d * Math.sqrt(d));
        dx += (x - p.x) * force;
        dy += (y - p.y) * force;
      }
      const bend = f.treble * g * .06;
      dx += Math.sin(y * 8 + t * .2) * bend;
      dy += Math.cos(x * 7 - t * .2) * bend;
      const len = Math.max(.001, Math.hypot(dx, dy));
      x += dx / len * .012;
      y += dy / len * .012;
      if (Math.hypot(x - poles[1].x, y - poles[1].y) < .025 || Math.abs(x) > 1.1 || Math.abs(y) > .7)
        break;
    }
    ctx.stroke();
  }
};
const eclipse: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = gain(s.intensity), cx = w * .5, cy = h * .45, r = u * (.2 + f.bass * g * .01);
  ctx.lineWidth = u * .0015 * s.lineWidth;
  for (let ring = 0; ring < 8; ring++) {
    ctx.strokeStyle = alpha(ring % 3 ? s.color : s.secondaryColor, .62 - ring * .055);
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const a = i / 240 * TAU, band = f.bands[Math.floor(i / 240 * 47)] * g;
      const radius = r + ring * u * .006 + u * (Math.sin(a * 13 + t * .3) ** 2 * .008 + band * .006) * ring / 8;
      const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius;
      if (!i)
        ctx.moveTo(x, y);
      else
        ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * TAU + t * .025, length = u * (.01 + f.bands[i % 48] * g * .024 + Math.sin(i * 1.7 + t * .3) ** 2 * .03);
    ctx.strokeStyle = alpha(i % 4 ? s.color : s.secondaryColor, .23 + f.attack * g * .05);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 1.09, cy + Math.sin(a) * r * 1.09);
    ctx.lineTo(cx + Math.cos(a) * (r + length), cy + Math.sin(a) * (r + length));
    ctx.stroke();
  }
};
const hourglass: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = gain(s.intensity), seed = context?.track?.seed ?? 11;
  ctx.lineWidth = u * .0012 * s.lineWidth;
  for (let stream = 0; stream < 28; stream++) {
    ctx.strokeStyle = alpha(stream % 3 ? s.color : s.secondaryColor, .25 + stream / 100);
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const y = i / 100 * 1.7 - .85, r = .055 + Math.abs(y) * (.55 + f.bass * g * .035), a = stream / 28 * TAU + y * 3.7 - t * .3;
      const p = project({ x: Math.cos(a) * r, y, z: Math.sin(a) * r }, w, h, t * .3);
      if (!i)
        ctx.moveTo(p[0], p[1]);
      else
        ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 160; i++) {
    const phase = (noise(seed + i) + t * .085) % 1, y = .85 - phase * 1.7, r = (.05 + Math.abs(y) * .53) * noise(i + 53), a = noise(i + 17) * TAU + t * .22;
    const p = project({ x: Math.cos(a) * r, y, z: Math.sin(a) * r }, w, h, t * .3);
    ctx.fillStyle = alpha(i % 3 ? s.color : s.secondaryColor, .3 + f.bands[i % 48] * g * .12);
    ctx.beginPath();
    ctx.arc(p[0], p[1], u * .0015, 0, TAU);
    ctx.fill();
  }
};
const gears: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = gain(s.intensity);
  for (const [index, [ox, oy, r, teeth]] of [[-.17, -.06, .18, 24], [.12, .075, .14, 18], [.22, -.137, .095, 12]].entries()) {
    const cx = w * .5 + ox * u, cy = h * .45 + oy * u, angle = t * .12 * (24 / teeth) * (index % 2 ? -1 : 1), radius = r * u * (1 + f.bass * g * .018);
    ctx.lineWidth = u * .0018 * s.lineWidth;
    ctx.strokeStyle = alpha(index % 2 ? s.secondaryColor : s.color, .68);
    ctx.beginPath();
    for (let i = 0; i <= teeth * 4; i++) {
      const a = i / (teeth * 4) * TAU + angle, rr = radius * (i % 4 === 1 || i % 4 === 2 ? 1 : .9), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (!i)
        ctx.moveTo(x, y);
      else
        ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * .66, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * .22, 0, TAU);
    ctx.stroke();
    for (let spoke = 0; spoke < 6; spoke++) {
      const a = spoke / 6 * TAU + angle;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * radius * .22, cy + Math.sin(a) * radius * .22);
      ctx.lineTo(cx + Math.cos(a) * radius * .66, cy + Math.sin(a) * radius * .66);
      ctx.stroke();
    }
  }
};
const comets: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = gain(s.intensity), seed = context?.track?.seed ?? 77;
  ctx.lineWidth = u * .0023 * s.lineWidth;
  for (let comet = 0; comet < 18; comet++) {
    const phase = noise(seed + comet) * TAU, speed = .08 + noise(comet + 57) * .12, radius = u * (.11 + noise(comet + 83) * .26), band = f.bands[comet * 2] * g;
    for (let tail = 0; tail < 22; tail++) {
      const point = (age: number) => { const a = (t - age) * speed + phase; return [w * .5 + Math.cos(a) * radius, h * .45 + Math.sin(a * 1.4 + phase) * radius * .65]; };
      const a = point(tail * .055), b = point((tail + 1) * .055);
      ctx.strokeStyle = alpha(comet % 3 ? s.color : s.secondaryColor, (1 - tail / 22) * (.45 + band * .15));
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    const head = t * speed + phase;
    ctx.fillStyle = alpha(comet % 3 ? s.color : s.secondaryColor, .8);
    ctx.beginPath(); ctx.arc(w * .5 + Math.cos(head) * radius, h * .45 + Math.sin(head * 1.4 + phase) * radius * .65, u * (.0024 + Math.min(3, band) * .0007), 0, TAU); ctx.fill();
  }
};
const lightning: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = gain(s.intensity), seed = context?.track?.seed ?? 19;
  const path = (x1: number, y1: number, x2: number, y2: number, depth: number, id: number, amount: number) => {
    if (depth === 0) {
      ctx.lineTo(x2, y2);
      return;
    }
    const offset = (noise(seed + id) * 2 - 1) * amount * (.8 + Math.sin(t * .7 + id) * .2), mx = (x1 + x2) / 2 + offset, my = (y1 + y2) / 2 + offset * .3;
    path(x1, y1, mx, my, depth - 1, id * 2 + 1, amount * .55);
    path(mx, my, x2, y2, depth - 1, id * 2 + 2, amount * .55);
  };
  ctx.lineWidth = u * .002 * s.lineWidth;
  for (let bolt = 0; bolt < 7; bolt++) {
    const x = w * (.18 + bolt * .105), top = h * .2, bottom = h * .67, spread = u * (.025 + f.attack * g * .018 + f.bands[bolt * 6] * g * .009);
    ctx.strokeStyle = alpha(bolt % 2 ? s.color : s.secondaryColor, .28 + f.level * g * .08);
    ctx.beginPath();
    ctx.moveTo(x, top);
    path(x, top, x + Math.sin(t * .2 + bolt) * u * .08, bottom, 7, bolt + 1, spread);
    ctx.stroke();
  }
};
const shell: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = gain(s.intensity);
  ctx.lineWidth = u * .0013 * s.lineWidth;
  const rings = Array.from({ length: 95 }, (_, i) => {
    const a = i / 94 * TAU * 2.3, r = .075 * Math.exp(a * .16), center = { x: Math.cos(a) * r * .8, y: Math.sin(a) * r * .8, z: (i / 94 - .5) * .45 };
    return Array.from({ length: 18 }, (_, j) => { const b = j / 18 * TAU, size = r * (.27 + f.bands[i % 48] * g * .018); return project({ x: center.x + Math.cos(a) * Math.cos(b) * size, y: center.y + Math.sin(a) * Math.cos(b) * size, z: center.z + Math.sin(b) * size }, w, h, t); });
  });
  for (let i = 0; i < rings.length; i++) {
    ctx.strokeStyle = alpha(i % 4 ? s.color : s.secondaryColor, .2 + i / rings.length * .52);
    ctx.beginPath();
    rings[i].forEach((p, j) => { if (!j)
      ctx.moveTo(p[0], p[1]);
    else
      ctx.lineTo(p[0], p[1]); });
    ctx.closePath();
    ctx.stroke();
    if (i)
      for (let j = 0; j < 18; j += 3) {
        ctx.strokeStyle = alpha(s.secondaryColor, .22);
        ctx.beginPath();
        ctx.moveTo(rings[i - 1][j][0], rings[i - 1][j][1]);
        ctx.lineTo(rings[i][j][0], rings[i][j][1]);
        ctx.stroke();
      }
  }
};
export const kineticExtraRenderers: Record<'mobius' | 'magnetic' | 'eclipse' | 'hourglass' | 'gears' | 'comets' | 'lightning' | 'shell', StyleRenderer> = { mobius, magnetic, eclipse, hourglass, gears, comets, lightning, shell };
