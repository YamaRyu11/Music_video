import type { StyleId } from '../shared';
import type { StyleRenderer } from './types';
import { alpha, noise, TAU } from './math';

const fraction = (value: number) => value - Math.floor(value);

/** Overlapping, translucent ink lobes; all shapes are evaluated at the requested time. */
const ink: StyleRenderer = (ctx, w, h, t, f, s) => {
  const unit = Math.min(w, h), cx = w / 2, cy = h * 0.44;
  for (let lobe = 0; lobe < 8; lobe++) {
    const seed = lobe + 41, phase = noise(seed) * TAU;
    const band = f.bands[(lobe * 5 + 3) % f.bands.length] ?? 0;
    const drift = t * (0.065 + noise(seed + 2) * 0.045);
    const spread = unit * (0.08 + f.bass * 0.035 * s.intensity);
    const x = cx + Math.cos(phase + drift) * spread;
    const y = cy + Math.sin(phase * 1.7 + drift * 0.8) * spread * 1.2;
    const radius = unit * (0.12 + noise(seed + 5) * 0.065 + band * 0.025 * s.intensity);
    const primary = lobe % 2 === 0 ? s.color : s.secondaryColor;
    const secondary = lobe % 2 === 0 ? s.secondaryColor : s.color;
    ctx.beginPath();
    for (let step = 0; step <= 72; step++) {
      const angle = step / 72 * TAU;
      const undulation = Math.sin(angle * 3 + phase + t * 0.28) * 0.12
        + Math.cos(angle * 5 - phase * 1.4 - t * 0.19) * (0.04 + f.treble * 0.06 * s.intensity)
        + Math.sin(angle * 2 + t * 0.12) * f.attack * 0.08 * s.intensity;
      const r = radius * (1 + undulation);
      const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
      if (step === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const gradient = ctx.createRadialGradient(x - radius * 0.28, y - radius * 0.3, radius * 0.05, x, y, radius * 1.3);
    gradient.addColorStop(0, alpha(primary, 0.07 + s.glow * 0.07));
    gradient.addColorStop(0.58, alpha(secondary, 0.045 + f.level * 0.07 * s.intensity));
    gradient.addColorStop(0.9, alpha(primary, 0.12 + s.glow * 0.12));
    gradient.addColorStop(1, alpha(secondary, 0.015));
    ctx.fillStyle = gradient; ctx.fill();
    ctx.strokeStyle = alpha(primary, 0.14 + band * 0.23 * s.intensity);
    ctx.lineWidth = (unit * 0.0012) * s.lineWidth; ctx.stroke();
  }
};

/** Sparse digital fragments whose displacement is strongest on spectral onsets. */
const glitch: StyleRenderer = (ctx, w, h, t, f, s) => {
  const unit = Math.min(w, h), width = w * 0.76, height = unit * 0.4;
  const left = (w - width) / 2, top = h * 0.44 - height / 2;
  const columns = 24, rows = 9, cw = width / columns, ch = height / rows;
  const clock = Math.floor(t * 7), displacement = f.attack * s.intensity;
  for (let row = 0; row < rows; row++) {
    const rowShift = (noise(row + clock * 0.17 + 52) - 0.5) * unit * displacement * 0.12;
    for (let column = 0; column < columns; column++) {
      const seed = row * columns + column + 300;
      const band = f.bands[column * 2] ?? 0;
      if (noise(seed) < 0.2 + row % 2 * 0.08) continue;
      const flicker = noise(seed + clock * 13.1);
      const offset = flicker > 0.64 ? (flicker - 0.5) * unit * displacement * 0.1 : 0;
      const x = left + column * cw + rowShift + offset;
      const y = top + row * ch + Math.sin(t * 0.2 + column * 0.31) * unit * band * 0.008 * s.intensity;
      const bw = cw * (0.3 + noise(seed + 5) * 0.62);
      const bh = ch * (0.1 + noise(seed + 8) * 0.45 + band * 0.2 * s.intensity);
      const color = (row + column) % 4 === 0 ? s.secondaryColor : s.color;
      ctx.fillStyle = alpha(color, 0.1 + noise(seed + 6) * 0.18 + band * 0.45 * s.intensity);
      ctx.fillRect(x, y + (ch - bh) / 2, bw, Math.max(1, bh));
      if (flicker > 0.78 && displacement > 0.08) {
        ctx.fillStyle = alpha(s.secondaryColor, displacement * 0.34);
        ctx.fillRect(x - displacement * unit * 0.015, y, bw * 1.3, Math.max(1, unit * 0.002));
      }
    }
  }
  // A few scan fragments connect the block field without filling the background.
  for (let line = 0; line < 5; line++) {
    const seed = line + 901;
    const y = top + noise(seed) * height;
    const length = width * (0.04 + noise(seed + 2) * 0.18 + displacement * 0.08);
    ctx.fillStyle = alpha(line % 2 ? s.color : s.secondaryColor, 0.14 + displacement * 0.22);
    ctx.fillRect(left + noise(seed + 6) * (width - length), y, length, Math.max(1, unit * 0.001));
  }
};

/** A feature-driven Lissajous design, rather than a claim to display raw PCM phase. */
const lissajous: StyleRenderer = (ctx, w, h, t, f, s) => {
  const unit = Math.min(w, h), cx = w / 2, cy = h * 0.44;
  const radius = unit * (0.26 + f.level * s.intensity * 0.035);
  const phase = t * 0.19 + f.bass * 0.7 * s.intensity;
  ctx.strokeStyle = alpha(s.secondaryColor, 0.07); ctx.lineWidth = (1) * s.lineWidth;
  ctx.beginPath(); ctx.moveTo(cx - radius * 1.14, cy); ctx.lineTo(cx + radius * 1.14, cy);
  ctx.moveTo(cx, cy - radius * 1.14); ctx.lineTo(cx, cy + radius * 1.14); ctx.stroke();
  for (let trace = 0; trace < 3; trace++) {
    const offset = (trace - 1) * (0.028 + f.attack * s.intensity * 0.025);
    ctx.beginPath();
    for (let step = 0; step <= 480; step++) {
      const a = step / 480 * TAU;
      const harmonic = f.treble * s.intensity * 0.08;
      const x = cx + (Math.sin(a * 3 + phase + offset) + Math.sin(a * 7 - phase) * harmonic) * radius;
      const y = cy + (Math.sin(a * 2 + offset) + Math.cos(a * 5 + phase) * harmonic) * radius * 0.88;
      if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    if (trace === 1 && s.glow > 0) {
      ctx.strokeStyle = alpha(s.color, s.glow * 0.1); ctx.lineWidth = (unit * 0.007) * s.lineWidth; ctx.stroke();
    }
    ctx.strokeStyle = alpha(trace === 1 ? s.color : s.secondaryColor, trace === 1 ? 0.85 : 0.3 + f.treble * 0.12 * s.intensity);
    ctx.lineWidth = (unit * (trace === 1 ? 0.0017 : 0.001)) * s.lineWidth; ctx.stroke();
  }
};

/** Fast high-frequency rain and low-frequency ripples share a stable seeded clock. */
const rain: StyleRenderer = (ctx, w, h, t, f, s) => {
  const unit = Math.min(w, h), floor = h * 0.66;
  const density = Math.min(1, 0.3 + f.treble * s.intensity * 0.65);
  for (let drop = 0; drop < 132; drop++) {
    const seed = drop + 1200;
    if (noise(seed + 30) > density) continue;
    const position = fraction(t * (0.24 + noise(seed + 6) * 0.25) + noise(seed + 2));
    const x = w * (0.07 + noise(seed) * 0.86);
    const y = h * 0.1 + position * (floor - h * 0.1);
    const length = unit * (0.008 + noise(seed + 9) * 0.014 + f.treble * s.intensity * 0.018);
    const opacity = Math.sin(position * Math.PI) * (0.16 + noise(seed + 4) * 0.38 + f.level * s.intensity * 0.2);
    ctx.strokeStyle = alpha(drop % 4 ? s.color : s.secondaryColor, opacity);
    ctx.lineWidth = (unit * (0.0007 + noise(seed + 7) * 0.001)) * s.lineWidth;
    ctx.beginPath(); ctx.moveTo(x - length * 0.11, y - length); ctx.lineTo(x, y); ctx.stroke();
    if (s.glow > 0.4) {
      ctx.fillStyle = alpha(s.color, opacity * 0.8);
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, unit * 0.001), 0, TAU); ctx.fill();
    }
  }
  for (let ripple = 0; ripple < 10; ripple++) {
    const seed = ripple + 1700, phase = fraction(t * 0.47 + noise(seed + 2));
    const x = w * (0.14 + noise(seed) * 0.72);
    const y = floor + (noise(seed + 3) - 0.5) * unit * 0.04;
    const radius = unit * (0.012 + phase * (0.06 + f.bass * s.intensity * 0.045));
    ctx.strokeStyle = alpha(ripple % 2 ? s.color : s.secondaryColor, (1 - phase) * (0.08 + f.bass * s.intensity * 0.3));
    ctx.lineWidth = (unit * 0.0012) * s.lineWidth;
    ctx.beginPath(); ctx.ellipse(x, y, radius, radius * 0.18, 0, 0, TAU); ctx.stroke();
  }
};

export const organicRenderers: Pick<Record<StyleId, StyleRenderer>, 'ink' | 'glitch' | 'lissajous' | 'rain'> = {
  ink, glitch, lissajous, rain,
};
