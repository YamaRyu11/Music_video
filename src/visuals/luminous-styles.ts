import type { StyleRenderer } from './types';
import { TAU, alpha, noise } from './math';
const gain = (v: number) => Math.log1p(Math.max(0, Math.min(10, v))) / Math.LN2;
const bounded = (v: number) => Math.max(0, Math.min(3, v));

const rose: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = gain(s.intensity), petals = 4 + (context?.track?.seed ?? 3) % 5;
  ctx.lineWidth = u * .0016 * s.lineWidth;
  for (let layer = 0; layer < 9; layer++) {
    ctx.strokeStyle = alpha(layer % 2 ? s.color : s.secondaryColor, .25 + layer * .055);
    ctx.beginPath();
    for (let i = 0; i <= 420; i++) {
      const a = i / 420 * TAU;
      const band = f.bands[Math.floor(i / 420 * 47)];
      const r = u * (.095 + layer * .018) * (1 + .48 * Math.cos(petals * a + t * .21 + layer * .2))
        * (1 + bounded(band * g) * .08 + f.bass * g * .035);
      const phase = a + t * .06 + f.attack * g * .018;
      const x = w / 2 + Math.cos(phase) * r, y = h * .45 + Math.sin(phase) * r;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
  }
};

const pendulum: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = gain(s.intensity), rows = 27;
  ctx.lineWidth = u * .0016 * s.lineWidth;
  for (let i = 0; i < rows; i++) {
    const depth = i / (rows - 1), band = f.bands[Math.floor(depth * 47)];
    const length = u * (.26 + depth * .22), pivotX = w * (.17 + depth * .66), pivotY = h * .22;
    const swing = Math.sin(t * (1.05 + i * .027) + i * .075) * (.32 + bounded(band * g) * .12);
    const x = pivotX + Math.sin(swing) * length, y = pivotY + Math.cos(swing) * length;
    ctx.strokeStyle = alpha(i % 3 ? s.color : s.secondaryColor, .3 + depth * .35);
    ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(x, y); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, u * (.006 + bounded(f.bass * g) * .003), 0, TAU); ctx.stroke();
    ctx.fillStyle = alpha(s.secondaryColor, .2 + bounded(band * g) * .1); ctx.fill();
  }
};

const gyroid: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = gain(s.intensity), n = 13, seed = (context?.track?.seed ?? 7) % 30;
  const angle = t * .13, c = Math.cos(angle), sn = Math.sin(angle);
  const vertices: { x: number; y: number; z: number; value: number }[] = [];
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const px = (x / (n - 1) - .5) * 4.4, py = (y / (n - 1) - .5) * 4.4, pz = (z / (n - 1) - .5) * 4.4;
    const phase = t * .11 + seed * .1, frequency = 1.65 + f.treble * g * .12;
    const value = Math.sin(px * frequency + phase) * Math.cos(py * frequency)
      + Math.sin(py * frequency) * Math.cos(pz * frequency + phase) + Math.sin(pz * frequency) * Math.cos(px * frequency);
    const rx = px * c + pz * sn, rz = -px * sn + pz * c;
    const ry = py * .94 - rz * .34, dz = py * .34 + rz * .94, perspective = 7 / (7 + dz);
    vertices.push({ x: w * .5 + rx * u * .115 * perspective, y: h * .45 + ry * u * .115 * perspective, z: dz, value });
  }
  ctx.lineWidth = u * .00135 * s.lineWidth;
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const index = (z * n + y) * n + x, p = vertices[index];
    if (Math.abs(p.value) > .5 + f.bass * g * .07) continue;
    ctx.strokeStyle = alpha((x + y) % 3 ? s.color : s.secondaryColor, Math.max(.12, .5 - p.z * .065));
    ctx.beginPath();
    for (const [valid, next] of [[x + 1 < n, index + 1], [y + 1 < n, index + n], [z + 1 < n, index + n * n]] as const) {
      if (!valid) continue;
      const q = vertices[next];
      if (Math.abs(q.value) > .6 + f.bass * g * .07) continue;
      ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  }
};

const braid: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = gain(s.intensity);
  ctx.lineWidth = u * .002 * s.lineWidth;
  for (let strand = 0; strand < 12; strand++) {
    const phase = strand * TAU / 12;
    ctx.strokeStyle = alpha(strand % 2 ? s.color : s.secondaryColor, .3 + strand / 30);
    ctx.beginPath();
    for (let i = 0; i <= 180; i++) {
      const k = i / 180, a = k * TAU * 2.5 - t * .32 + phase;
      const envelope = Math.sin(k * Math.PI) ** .6;
      const band = f.bands[Math.min(47, Math.floor(k * 48))];
      const x = w * (.08 + k * .84), y = h * .45 + Math.sin(a) * u * (.16 + band * g * .06) * envelope
        + Math.cos(a * 2 - phase) * u * (.025 + f.attack * g * .009);
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
};

/** Analytic scope traces from the analyzed bands; no claim of raw PCM phase. */
const oscilloscope: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = gain(s.intensity), left = w * .09, right = w * .91, top = h * .45 - u * .28;
  ctx.strokeStyle = alpha(s.secondaryColor, .13); ctx.lineWidth = u * .0008 * s.lineWidth;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) { const x = left + (right - left) * i / 10; ctx.moveTo(x, top); ctx.lineTo(x, top + u * .56); }
  for (let i = 0; i <= 6; i++) { const y = top + u * .56 * i / 6; ctx.moveTo(left, y); ctx.lineTo(right, y); }
  ctx.stroke();
  for (let trace = 0; trace < 3; trace++) {
    ctx.strokeStyle = alpha(trace === 1 ? s.secondaryColor : s.color, trace === 0 ? .9 : .48);
    ctx.lineWidth = u * (trace === 0 ? .0022 : .0012) * s.lineWidth; ctx.beginPath();
    for (let i = 0; i <= 380; i++) {
      const x = i / 380, a = x * TAU, base = h * .45 + (trace - 1) * u * .12;
      let value = 0;
      for (let harmonic = 1; harmonic <= 10; harmonic++) {
        const band = f.bands[(harmonic * 4 + trace * 3) % 48];
        value += Math.sin(a * harmonic * (trace + 1) + t * .35 + harmonic * .7) * band / (harmonic ** .85);
      }
      const py = base + value * u * .055 * g + Math.sin(a * 2 + t * .2) * u * .008;
      if (!i) ctx.moveTo(left + x * (right - left), py); else ctx.lineTo(left + x * (right - left), py);
    }
    ctx.stroke();
  }
};

const sonar: StyleRenderer = (ctx, w, h, t, f, s) => {
  const u = Math.min(w, h), g = gain(s.intensity);
  ctx.lineWidth = u * .0016 * s.lineWidth;
  for (let ring = 0; ring < 18; ring++) {
    const phase = (t * .12 + ring / 18) % 1, r = u * (.035 + phase * .53);
    const y = h * .43 + phase * u * .12;
    ctx.strokeStyle = alpha(ring % 3 ? s.color : s.secondaryColor, (1 - phase) * (.5 + f.bass * g * .12));
    ctx.beginPath();
    for (let i = 0; i <= 144; i++) {
      const a = i / 144 * TAU, band = f.bands[Math.floor(i / 144 * 47)];
      const radius = r + Math.sin(a * 8 + t * .7 + ring) * band * g * u * .01;
      const x = w * .5 + Math.cos(a) * radius, py = y + Math.sin(a) * radius * .38;
      if (!i) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.closePath(); ctx.stroke();
  }
};

const ribbons: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = gain(s.intensity), seed = context?.track?.seed ?? 31;
  for (let ribbon = 0; ribbon < 7; ribbon++) {
    const phase = noise(seed + ribbon) * TAU, yBase = h * .45 + (ribbon - 3) * u * .065;
    ctx.lineWidth = u * .0014 * s.lineWidth;
    for (let thread = 0; thread < 8; thread++) {
      ctx.strokeStyle = alpha(ribbon % 2 ? s.color : s.secondaryColor, .18 + Math.sin(thread / 7 * Math.PI) * .45);
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const k = i / 120, a = k * TAU * (1.2 + ribbon * .11) + t * .24 + phase;
        const energy = f.bands[(ribbon * 6 + Math.floor(k * 6)) % 48] * g;
        const envelope = Math.sin(k * Math.PI);
        const x = w * (.07 + k * .86), y = yBase + Math.sin(a) * u * (.055 + energy * .017) * envelope
          + Math.cos(a + thread * .12) * (thread - 3.5) * u * (.005 + f.attack * g * .001);
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
};

const orrery: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const u = Math.min(w, h), g = gain(s.intensity), seed = context?.track?.seed ?? 6;
  const project = (x: number, y: number, z: number) => {
    const angle = t * .045, rx = x * Math.cos(angle) + z * Math.sin(angle), rz = -x * Math.sin(angle) + z * Math.cos(angle);
    const ry = y * .55 - rz * .83, depth = y * .83 + rz * .55, p = 4 / (4 + depth);
    return [w * .5 + rx * u * .32 * p, h * .45 + ry * u * .32 * p];
  };
  ctx.lineWidth = u * .0015 * s.lineWidth;
  for (let orbit = 0; orbit < 8; orbit++) {
    const r = .17 + orbit * .115, tilt = noise(seed + orbit) * .8 - .4;
    ctx.strokeStyle = alpha(orbit % 2 ? s.color : s.secondaryColor, .3 + orbit * .04); ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = i / 120 * TAU, p = project(Math.cos(a) * r, Math.sin(a) * r * tilt, Math.sin(a) * r);
      if (!i) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath(); ctx.stroke();
    const a = t * (.35 + orbit * .08) + orbit * 2.399, p = project(Math.cos(a) * r, Math.sin(a) * r * tilt, Math.sin(a) * r);
    const size = u * (.005 + bounded(f.bands[orbit * 6] * g) * .006);
    ctx.strokeStyle = alpha(s.secondaryColor, .85); ctx.fillStyle = alpha(s.color, .2 + f.bass * g * .05);
    ctx.beginPath(); ctx.arc(p[0], p[1], size, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.strokeStyle = alpha(s.color, .8); ctx.beginPath(); ctx.arc(w / 2, h * .45, u * (.023 + f.bass * g * .008), 0, TAU); ctx.stroke();
};

export const luminousRenderers: Record<'rose' | 'pendulum' | 'gyroid' | 'braid' | 'oscilloscope' | 'sonar' | 'ribbons' | 'orrery', StyleRenderer> = {
  rose, pendulum, gyroid, braid, oscilloscope, sonar, ribbons, orrery,
};
