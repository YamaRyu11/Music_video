import type { StyleRenderer } from './types';
import { TAU, alpha, noise } from './math';
const drive = (value: number) => Math.log1p(Math.max(0, Math.min(10, value))) / Math.LN2;
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

const jellyfish: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = drive(s.intensity), seed = context?.track?.seed ?? 17;
  for (let creature = 0; creature < 3; creature++) {
    const size = u * (creature === 0 ? .19 : .11), phase = t * .7 + creature * 2.1;
    const cx = w * (.5 + (creature === 1 ? -.25 : creature === 2 ? .25 : 0)) + Math.sin(t * .18 + creature) * u * .035;
    const cy = h * (.32 + creature * .045) + Math.sin(phase) * u * .035;
    const pulse = 1 + f.bass * g * .09 + Math.sin(phase) * .05;
    ctx.lineWidth = u * .0015 * s.lineWidth;
    for (let rib = 0; rib < 11; rib++) {
      const a = rib / 10 * Math.PI, width = Math.cos(a) * size * pulse;
      ctx.strokeStyle = alpha(rib % 2 ? s.color : s.secondaryColor, .24 + Math.sin(a) * .46);
      ctx.beginPath(); ctx.moveTo(cx + width, cy);
      ctx.bezierCurveTo(cx + width * .8, cy - size * .8, cx - width * .8, cy - size * .8, cx - width, cy); ctx.stroke();
    }
    ctx.strokeStyle = alpha(s.secondaryColor, .65); ctx.beginPath(); ctx.ellipse(cx, cy, size * pulse, size * .16, 0, 0, TAU); ctx.stroke();
    for (let strand = 0; strand < 18; strand++) {
      const band = f.bands[(strand * 2 + creature * 7) % 48] * g;
      const length = size * (1.2 + noise(seed + strand) * .8 + band * .08);
      ctx.strokeStyle = alpha(strand % 3 ? s.color : s.secondaryColor, .25 + noise(strand + 31) * .3); ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const k = i / 40, x = cx + (strand / 17 - .5) * size * 1.55 + Math.sin(k * 8 - t * .8 + strand) * size * k * (.13 + band * .04);
        const y = cy + k * length;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
};

const rippleGrid: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = drive(s.intensity), count = 35;
  const project = (x: number, z: number) => {
    const d1 = Math.hypot(x + .65, z - .25), d2 = Math.hypot(x - .65, z + .25);
    const wave = Math.sin(d1 * 8 - t * 1.7) * Math.exp(-d1 * .4) * (.055 + f.bass * g * .045)
      + Math.sin(d2 * 11 - t * 1.4) * Math.exp(-d2 * .5) * (.035 + f.treble * g * .04);
    const depth = 3.8 / (3.8 + z);
    return [w / 2 + x * u * .3 * depth, h * .45 + (z * .17 - wave) * u * depth];
  };
  ctx.lineWidth = u * .0013 * s.lineWidth;
  for (let axis = 0; axis < 2; axis++) for (let line = 0; line < count; line++) {
    ctx.strokeStyle = alpha(axis ? s.secondaryColor : s.color, .2 + line / count * .35); ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const a = (line / (count - 1) - .5) * 3.1, b = (i / (count - 1) - .5) * 3.1;
      const p = project(axis ? b : a, axis ? a : b);
      if (!i) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
};

const fibonacci: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = drive(s.intensity), golden = Math.PI * (3 - Math.sqrt(5));
  const seed = (context?.track?.seed ?? 0) % 29;
  const points = Array.from({ length: 480 }, (_, i) => {
    const band = f.bands[i % 48] * g, r = Math.sqrt((i + 1) / 480) * u * (.33 + f.bass * g * .012);
    const a = i * golden + t * .09 + seed * .1 + band * .025;
    return { x: w / 2 + Math.cos(a) * r, y: h * .45 + Math.sin(a) * r, band };
  });
  ctx.lineWidth = u * .0009 * s.lineWidth;
  points.forEach((p, i) => {
    if (i >= 34) {
      const q = points[i - 34]; ctx.strokeStyle = alpha(i % 3 ? s.color : s.secondaryColor, .12 + p.band * .04);
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.fillStyle = alpha(i % 3 ? s.color : s.secondaryColor, .3 + p.band * .15);
    ctx.beginPath(); ctx.arc(p.x, p.y, u * (.0012 + clamp(p.band, 0, 3) * .0008), 0, TAU); ctx.fill();
  });
};

const sigils: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = drive(s.intensity), seed = context?.track?.seed ?? 15;
  ctx.lineWidth = u * .0016 * s.lineWidth;
  for (let ring = 0; ring < 5; ring++) {
    const r = u * (.08 + ring * .058) * (1 + f.bass * g * .025), sides = 5 + (seed + ring) % 6;
    const phase = t * .07 * (ring % 2 ? -1 : 1) + ring * .6 + f.attack * g * .015;
    ctx.strokeStyle = alpha(ring % 2 ? s.color : s.secondaryColor, .36 + ring * .08);
    ctx.beginPath(); ctx.arc(w / 2, h * .45, r, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * TAU + phase, x = w / 2 + Math.cos(a) * r, y = h * .45 + Math.sin(a) * r;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      const inner = a + Math.PI / sides;
      ctx.lineTo(w / 2 + Math.cos(inner) * r * .5, h * .45 + Math.sin(inner) * r * .5);
    }
    ctx.closePath(); ctx.stroke();
  }
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * TAU + t * .025, r = u * .345, length = u * (.008 + f.bands[i] * g * .012);
    ctx.strokeStyle = alpha(i % 4 ? s.color : s.secondaryColor, .5); ctx.beginPath();
    ctx.moveTo(w / 2 + Math.cos(a) * r, h * .45 + Math.sin(a) * r);
    ctx.lineTo(w / 2 + Math.cos(a) * (r + length), h * .45 + Math.sin(a) * (r + length)); ctx.stroke();
  }
};

const origami: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = drive(s.intensity), seed = context?.track?.seed ?? 42;
  const flock = Array.from({ length: 32 }, (_, i) => ({ i, z: noise(seed + i + 79) } )).sort((a, b) => b.z - a.z);
  ctx.lineWidth = u * .0015 * s.lineWidth;
  for (const { i, z } of flock) {
    const clock = t * (.024 + noise(i + seed + 2) * .025), phase = noise(seed + i);
    const x = ((phase + clock) % 1 * 1.2 - .1) * w;
    const y = h * .45 + (noise(seed + i + 35) - .5) * u * .65 + Math.sin(t * .3 + i) * u * .03;
    const size = u * (.018 + (1 - z) * .02), band = f.bands[i % 48] * g;
    const fold = Math.sin(t * (1 + noise(i) * .6) + i * 2.3) * (.35 + band * .14);
    const points = [[x + size * 1.2, y], [x - size * .3, y - size * (.6 + fold)], [x - size, y + size * .1], [x - size * .3, y + size * (.6 - fold)]];
    const color = i % 3 ? s.color : s.secondaryColor;
    ctx.beginPath(); points.forEach(([px, py], j) => { if (!j) ctx.moveTo(px, py); else ctx.lineTo(px, py); }); ctx.closePath();
    ctx.fillStyle = alpha(color, .06 + band * .025); ctx.fill(); ctx.strokeStyle = alpha(color, .35 + (1 - z) * .35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); ctx.lineTo(points[2][0], points[2][1]); ctx.stroke();
  }
};

const ribbonSphere: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = drive(s.intensity), tilt = .5;
  ctx.lineWidth = u * .0015 * s.lineWidth;
  for (let ribbon = 0; ribbon < 28; ribbon++) {
    ctx.strokeStyle = alpha(ribbon % 3 ? s.color : s.secondaryColor, .25 + ribbon / 80); ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const latitude = -Math.PI / 2 + i / 100 * Math.PI, band = f.bands[(ribbon + Math.floor(i / 5)) % 48] * g;
      const a = ribbon / 28 * TAU + latitude * (1.1 + f.treble * g * .16) + t * .18;
      const r = u * (.28 + band * .009), x = Math.cos(latitude) * Math.cos(a) * r;
      const y = Math.sin(latitude) * r, z = Math.cos(latitude) * Math.sin(a) * r;
      const py = y * Math.cos(tilt) - z * Math.sin(tilt), depth = y * Math.sin(tilt) + z * Math.cos(tilt), p = u / (u + depth);
      const px = w / 2 + x * p, sy = h * .45 + py * p;
      if (!i) ctx.moveTo(px, sy); else ctx.lineTo(px, sy);
    }
    ctx.stroke();
  }
};

const sundial: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = drive(s.intensity), cx = w / 2, cy = h * .45;
  ctx.lineWidth = u * .0015 * s.lineWidth;
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * TAU + t * .025, band = f.bands[i % 48] * g, inner = u * (.21 + (i % 4 ? 0 : -.015));
    const outer = inner + u * (.015 + band * .035);
    ctx.strokeStyle = alpha(i % 4 ? s.color : s.secondaryColor, .35 + band * .12); ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner); ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer); ctx.stroke();
  }
  for (let ring = 0; ring < 4; ring++) {
    ctx.strokeStyle = alpha(ring % 2 ? s.secondaryColor : s.color, .4); ctx.beginPath(); ctx.arc(cx, cy, u * (.14 + ring * .055), t * .08 + ring, t * .08 + ring + Math.PI * (1.2 + f.bass * g * .1)); ctx.stroke();
  }
  ctx.strokeStyle = alpha(s.secondaryColor, .85); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(t * .45) * u * .18, cy + Math.sin(t * .45) * u * .18); ctx.stroke();
};

const hexwave: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = drive(s.intensity), tiles: { x: number; y: number; lift: number; band: number }[] = [];
  const size = u * .025;
  for (let row = 0; row < 11; row++) for (let col = 0; col < 17; col++) {
    const x = (col - 8 + row % 2 * .5) * size * 1.74, z = (row - 5) * size * 1.5;
    const band = f.bands[(col * 2 + row * 3) % 48] * g;
    const lift = size * (Math.sin(Math.hypot(x, z) / size * .6 - t * 1.1) * .45 + band * .65);
    tiles.push({ x, y: z, lift, band });
  }
  tiles.sort((a, b) => a.y - b.y); ctx.lineWidth = u * .0013 * s.lineWidth;
  for (const tile of tiles) {
    const cx = w / 2 + tile.x, cy = h * .47 + tile.y * .48 - tile.lift;
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const a = j / 6 * TAU + Math.PI / 6, x = cx + Math.cos(a) * size * .91, y = cy + Math.sin(a) * size * .44;
      if (!j) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); const color = tile.band > .7 ? s.secondaryColor : s.color;
    ctx.fillStyle = alpha(color, .025 + tile.band * .025); ctx.fill(); ctx.strokeStyle = alpha(color, .25 + tile.band * .12); ctx.stroke();
  }
};

export const kineticRenderers: Record<'jellyfish' | 'ripple-grid' | 'fibonacci' | 'sigils' | 'origami' | 'ribbon-sphere' | 'sundial' | 'hexwave', StyleRenderer> = {
  jellyfish, 'ripple-grid': rippleGrid, fibonacci, sigils, origami, 'ribbon-sphere': ribbonSphere, sundial, hexwave,
};
