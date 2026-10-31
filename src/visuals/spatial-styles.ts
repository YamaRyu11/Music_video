import type { StyleId } from '../shared';
import { alpha, noise, TAU } from './math';
import type { StyleRenderer } from './types';

/** A receding floor of laser lines, with audio-driven ripples in its surface. */
const laser: StyleRenderer = (ctx, w, h, t, f, s) => {
  const unit = Math.min(w, h), cx = w / 2, horizon = h * 0.32;
  const depth = unit * 0.42, halfWidth = w * 0.62;
  const point = (x: number, z: number) => {
    const perspective = z * z;
    const ripple = Math.sin(x * 4 + z * 10 - t * 1.3) * unit * 0.017
      * perspective * (0.12 + f.bass * s.intensity);
    return { x: cx + x * halfWidth * perspective, y: horizon + depth * perspective + ripple };
  };
  // Moving depth rows establish travel without keeping any frame history.
  for (let row = 0; row < 18; row++) {
    const z = (row / 18 + t * 0.055) % 1;
    ctx.beginPath();
    for (let i = 0; i <= 56; i++) {
      const p = point(-1 + i / 28, z);
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.strokeStyle = alpha(row % 3 ? s.color : s.secondaryColor, 0.12 + z * 0.65);
    ctx.lineWidth = 0.7 + z * 1.5; ctx.stroke();
  }
  for (let column = -10; column <= 10; column++) {
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const p = point(column / 10, i / 30);
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.strokeStyle = alpha(column % 2 ? s.color : s.secondaryColor, 0.22 + f.level * 0.24);
    ctx.lineWidth = 1.2; ctx.stroke();
  }
  const radius = unit * (0.025 + f.attack * 0.014 * s.intensity);
  const flare = ctx.createRadialGradient(cx, horizon, 0, cx, horizon, radius * 3);
  flare.addColorStop(0, alpha(s.secondaryColor, 0.35 + s.glow * 0.3));
  flare.addColorStop(1, alpha(s.color, 0));
  ctx.fillStyle = flare; ctx.fillRect(cx - radius * 3, horizon - radius * 3, radius * 6, radius * 6);
};

/** Individual translucent petals open with their corresponding spectral bands. */
const bloom: StyleRenderer = (ctx, w, h, t, f, s) => {
  const unit = Math.min(w, h), petals = 14;
  ctx.translate(w / 2, h * 0.46);
  ctx.rotate(t * 0.055);
  for (let ring = 1; ring >= 0; ring--) {
    for (let petal = 0; petal < petals; petal++) {
      const band = f.bands[(petal * 3 + ring * 11) % 48];
      const length = unit * (0.23 + band * 0.075 * s.intensity) * (ring ? 0.72 : 1);
      const spread = unit * (0.038 + f.bass * 0.02 * s.intensity + band * 0.015 * s.intensity);
      const root = unit * (0.035 + f.bass * 0.014 * s.intensity);
      ctx.save(); ctx.rotate(petal / petals * TAU + ring * Math.PI / petals);
      ctx.beginPath(); ctx.moveTo(root, 0);
      ctx.bezierCurveTo(length * 0.36, -spread, length * 0.9, -spread, length, 0);
      ctx.bezierCurveTo(length * 0.9, spread, length * 0.36, spread, root, 0);
      const gradient = ctx.createLinearGradient(root, 0, length, 0);
      gradient.addColorStop(0, alpha(s.color, 0.04));
      gradient.addColorStop(0.55, alpha(ring ? s.secondaryColor : s.color, 0.14 + s.glow * 0.12));
      gradient.addColorStop(1, alpha(s.secondaryColor, 0.03));
      ctx.fillStyle = gradient; ctx.fill();
      ctx.strokeStyle = alpha(ring ? s.secondaryColor : s.color, 0.35 + band * 0.45);
      ctx.lineWidth = ring ? 1 : 1.6; ctx.stroke(); ctx.restore();
    }
  }
  for (let i = 0; i < 42; i++) {
    const angle = i * 2.399963229728653;
    const radius = unit * 0.007 * Math.sqrt(i) * (1 + f.attack * 0.15 * s.intensity);
    ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, unit * 0.0018, 0, TAU);
    ctx.fillStyle = alpha(i % 3 ? s.color : s.secondaryColor, 0.45 + f.treble * 0.4); ctx.fill();
  }
};

/** Seeded radial star flight. Loudness and onsets stretch the visible light trails. */
const stars: StyleRenderer = (ctx, w, h, t, f, s) => {
  const unit = Math.min(w, h), cx = w / 2, cy = h * 0.46;
  const extent = Math.hypot(w * 0.54, h * 0.48);
  for (let i = 0; i < 190; i++) {
    const phase = (noise(i + 401) + t * (0.075 + noise(i + 93) * 0.025)) % 1;
    const angle = noise(i + 77) * TAU;
    const radius = phase ** 2.5 * extent;
    const brightness = Math.sin(phase * Math.PI) * (0.35 + phase * 0.6);
    const trail = unit * (0.001 + phase ** 3 * (0.018 + f.level * 0.05 * s.intensity + f.attack * 0.12 * s.intensity));
    const inner = Math.max(0, radius - trail);
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.strokeStyle = alpha(i % 4 ? s.color : s.secondaryColor, brightness);
    ctx.lineWidth = unit * (0.0008 + phase * 0.0014); ctx.lineCap = 'round'; ctx.stroke();
  }
  const r = unit * (0.025 + f.bass * 0.012 * s.intensity);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
  glow.addColorStop(0, alpha(s.secondaryColor, 0.14 + s.glow * 0.2));
  glow.addColorStop(1, alpha(s.color, 0));
  ctx.fillStyle = glow; ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
};

/** Mirrored wedges of cut-glass shapes, forming an eight-fold kaleidoscope. */
const kaleidoscope: StyleRenderer = (ctx, w, h, t, f, s) => {
  const unit = Math.min(w, h), sectors = 8, sector = TAU / sectors;
  ctx.translate(w / 2, h * 0.46);
  ctx.rotate(t * 0.065 + f.attack * 0.07 * s.intensity);
  for (let wedge = 0; wedge < sectors; wedge++) {
    for (const reflection of [-1, 1]) {
      ctx.save(); ctx.rotate(wedge * sector); ctx.scale(1, reflection);
      for (let shard = 0; shard < 6; shard++) {
        const band = f.bands[(shard * 7 + wedge * 2) % 48];
        const radius = unit * (0.07 + shard * 0.042) * (1 + f.bass * 0.1 * s.intensity);
        const angle = sector * (0.12 + Math.sin(t * 0.23 + shard * 0.7) * 0.055);
        const long = unit * (0.035 + band * 0.026 * s.intensity);
        const wide = unit * (0.01 + f.treble * 0.01 * s.intensity);
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        ctx.beginPath(); ctx.moveTo(x - long, y);
        ctx.lineTo(x, y - wide); ctx.lineTo(x + long, y);
        ctx.lineTo(x, y + wide); ctx.closePath();
        ctx.fillStyle = alpha(shard % 2 ? s.color : s.secondaryColor, 0.09 + band * 0.14 + s.glow * 0.06); ctx.fill();
        ctx.strokeStyle = alpha(shard % 2 ? s.secondaryColor : s.color, 0.35 + band * 0.5);
        ctx.lineWidth = 1.1; ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const angle = i / 16 * TAU, radius = unit * (i % 2 ? 0.025 : 0.046) * (1 + f.level * 0.16 * s.intensity);
    if (i) ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.strokeStyle = alpha(s.secondaryColor, 0.65); ctx.lineWidth = 1.5; ctx.stroke();
};

/** A wire contour field of gently travelling hills, raised by the bass bands. */
const contours: StyleRenderer = (ctx, w, h, t, f, s) => {
  const unit = Math.min(w, h);
  const point = (x: number, z: number) => {
    const hillA = Math.exp(-((x + 0.3 - Math.sin(t * 0.12) * 0.1) ** 2 / 0.13 + (z - 0.53) ** 2 / 0.2));
    const hillB = Math.exp(-((x - 0.4) ** 2 / 0.065 + (z - 0.32) ** 2 / 0.12));
    const band = f.bands[Math.min(47, Math.floor((x + 1) * 23.5))];
    const ripple = Math.sin(x * 9 + z * 5 - t * 0.45) * 0.035 * (0.3 + band * s.intensity);
    const lift = unit * (0.11 + f.bass * 0.065 * s.intensity);
    return { x: w / 2 + x * w * 0.41 * (0.7 + z * 0.3),
      y: h * 0.34 + z * unit * 0.3 - (hillA + hillB * 0.7 + ripple) * lift };
  };
  for (let row = 0; row < 24; row++) {
    const z = row / 23;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const p = point(-1 + i / 32, z);
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.strokeStyle = alpha(row % 4 ? s.color : s.secondaryColor, 0.14 + z * 0.56 + f.level * 0.08);
    ctx.lineWidth = 0.8 + z * 0.8; ctx.stroke();
  }
  for (let column = 0; column < 7; column++) {
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const p = point(-0.9 + column * 0.3, i / 30);
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.strokeStyle = alpha(s.secondaryColor, 0.08 + s.glow * 0.09); ctx.lineWidth = 0.8; ctx.stroke();
  }
};

export const spatialRenderers: Pick<Record<StyleId, StyleRenderer>,
  'laser' | 'bloom' | 'stars' | 'kaleidoscope' | 'contours'> = {
  laser, bloom, stars, kaleidoscope, contours,
};
