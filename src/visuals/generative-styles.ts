import type { StyleId } from '../shared';
import { alpha, noise, TAU } from './math';
import type { StyleRenderer } from './types';

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));
// A logarithmic gain keeps 1000% expressive without turning geometry unbounded.
const drive = (value: number) => Math.log1p(Number.isFinite(value) ? clamp(value, 0, 10) : 0) / Math.LN2;

/** Streamlines integrated through a smooth, slowly evolving curl-like field. */
const flowfield: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const unit = Math.min(w, h), gain = drive(s.intensity);
  const seed = (context?.track?.seed ?? 3817) / 65536;
  const timbre = context?.track?.timbre ?? .5;
  const phase = t * .15 + seed * .03 + f.attack * gain * .1;
  const bend = 1.5 + timbre * .65 + f.treble * gain * .12;
  const step = .037 + f.level * gain * .003;
  const gradient = ctx.createLinearGradient(w * .13, h * .25, w * .87, h * .65);
  gradient.addColorStop(0, alpha(s.color, .36 + s.glow * .2));
  gradient.addColorStop(1, alpha(s.secondaryColor, .36 + s.glow * .2));
  ctx.strokeStyle = gradient; ctx.lineWidth = (unit * .00125) * s.lineWidth; ctx.lineCap = 'round';
  for (let stream = 0; stream < 36; stream++) {
    let x = (noise(stream + seed + 13) * 2 - 1) * 1.13;
    let y = (noise(stream + seed + 203) * 2 - 1) * .95;
    x += Math.sin(t * .07 + stream) * .06;
    ctx.beginPath();
    for (let point = 0; point < 48; point++) {
      const px = w / 2 + x * w * .34, py = h * .44 + y * unit * .3;
      if (point) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      const shared = x * .9 + y * 1.7 + phase * .6;
      const dx = Math.cos(y * bend + phase) + .55 * Math.cos(shared) - y * .24;
      const dy = Math.sin(x * bend - phase) - .55 * Math.cos(shared) + x * .24;
      const length = Math.max(.08, Math.hypot(dx, dy));
      x += dx / length * step; y += dy / length * step;
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2 + x * w * .34, h * .44 + y * unit * .3, unit * .0018, 0, TAU);
    ctx.fillStyle = alpha(stream % 3 ? s.color : s.secondaryColor, .4 + s.glow * .25); ctx.fill();
  }
};

/** Sand-like dots projected toward nodal lines of an analytic standing-wave field. */
const chladni: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const unit = Math.min(w, h), gain = drive(s.intensity);
  const seed = context?.track?.seed ?? 6283;
  const m = 2 + seed % 3, n = m + 2 + Math.floor(seed / 11) % 2;
  const a = m * Math.PI, b = n * Math.PI;
  const half = unit * (.295 + clamp(f.bass * gain, 0, 3.5) * .007);
  const coherence = .65 + clamp(f.level * gain, 0, 2) * .13;
  const wobble = .003 + f.treble * gain * .0016;
  ctx.translate(w / 2, h * .45);
  ctx.rotate(Math.sin(t * .07) * .07 + f.attack * gain * .008);
  for (let group = 0; group < 2; group++) {
    ctx.beginPath();
    for (let dot = 0; dot < 1100; dot++) {
      if ((dot % 3 === 0 ? 1 : 0) !== group) continue;
      let x = noise(dot + seed / 65536 + 83) * 2 - 1;
      let y = noise(dot + seed / 65536 + 407) * 2 - 1;
      x += Math.sin(t * .3 + dot * .1) * wobble;
      y += Math.cos(t * .23 + dot * .13) * wobble;
      for (let iteration = 0; iteration < 4; iteration++) {
        const ax = a * x, bx = b * x, ay = a * y, by = b * y;
        const ca = Math.cos(ax), cb = Math.cos(bx), cya = Math.cos(ay), cyb = Math.cos(by);
        const value = ca * cyb - cb * cya;
        const dx = -a * Math.sin(ax) * cyb + b * Math.sin(bx) * cya;
        const dy = -b * ca * Math.sin(by) + a * cb * Math.sin(ay);
        const correction = value / Math.max(.05, dx * dx + dy * dy) * coherence;
        x = clamp(x - clamp(dx * correction, -.12, .12), -1, 1);
        y = clamp(y - clamp(dy * correction, -.12, .12), -1, 1);
      }
      const radius = unit * (.0008 + noise(dot + 99) * .0008) * (1 + f.treble * gain * .12);
      const px = x * half, py = y * half;
      ctx.moveTo(px + radius, py); ctx.arc(px, py, radius, 0, TAU);
    }
    ctx.fillStyle = alpha(group ? s.secondaryColor : s.color, .58 + s.glow * .28); ctx.fill();
  }
  ctx.beginPath(); ctx.roundRect(-half * 1.04, -half * 1.04, half * 2.08, half * 2.08, unit * .012);
  ctx.strokeStyle = alpha(s.secondaryColor, .1 + s.glow * .07); ctx.lineWidth = (unit * .0008) * s.lineWidth; ctx.stroke();
};

/** Two slightly misaligned, warped line sheets produce a moving moiré weave. */
const moire: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const unit = Math.min(w, h), gain = drive(s.intensity);
  const seedPhase = noise((context?.track?.seed ?? 9973) / 65536) * TAU;
  const halfWidth = unit * .385, halfHeight = unit * .31;
  ctx.translate(w / 2, h * .45); ctx.rotate(-.045);
  ctx.beginPath(); ctx.roundRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2, unit * .025); ctx.clip();
  ctx.globalCompositeOperation = 'screen'; ctx.lineWidth = (unit * .0011) * s.lineWidth;
  for (let sheet = 0; sheet < 2; sheet++) {
    ctx.save();
    const angle = sheet ? .12 + Math.sin(t * .18 + seedPhase) * .055 + f.attack * gain * .035 : -.105;
    ctx.rotate(angle);
    ctx.beginPath();
    const spread = unit * .96 * (sheet ? 1.035 + f.treble * gain * .002 : 1);
    for (let line = 0; line < 50; line++) {
      const base = (line / 49 - .5) * spread;
      for (let point = 0; point < 18; point++) {
        const y = (point / 17 - .5) * unit * .96;
        const bend = Math.sin(y / unit * 7 + line * .09 + t * .16 + sheet * 1.3 + seedPhase)
          * unit * (.018 + f.bass * gain * .004);
        const x = base + bend;
        if (point) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
    }
    ctx.strokeStyle = alpha(sheet ? s.secondaryColor : s.color, .42 + s.glow * .18); ctx.stroke();
    ctx.restore();
  }
};

interface RibbonPoint { x: number; y: number; z: number; width: number; nx: number; ny: number }

/** Depth-sorted strips turn two sine curves into a pair of twisting 3D ribbons. */
const helix: StyleRenderer = (ctx, w, h, t, f, s, context) => {
  const unit = Math.min(w, h), gain = drive(s.intensity), vertical = h > w;
  const seedPhase = noise((context?.track?.seed ?? 1597) / 65536) * TAU;
  const length = vertical ? h * .235 : w * .34;
  const radius = unit * (.09 + f.bass * gain * .012);
  const turns = 1.45 + f.treble * gain * .15;
  const phase = t * .5 + seedPhase + f.attack * gain * .06;
  const strips: RibbonPoint[][] = [];
  for (let strand = 0; strand < 2; strand++) {
    const points: RibbonPoint[] = [];
    for (let i = 0; i <= 80; i++) {
      const u = i / 40 - 1, theta = u * TAU * turns + phase + strand * Math.PI;
      const z = Math.cos(theta), perspective = 1 / (1 - z * .17);
      const axis = u * length * perspective, cross = Math.sin(theta) * radius * perspective;
      points.push({ x: w / 2 + (vertical ? cross : axis), y: h * .45 + (vertical ? axis : cross), z,
        width: unit * (.0075 + f.level * gain * .002) * (1 + z * .28) * perspective, nx: 0, ny: 0 });
    }
    for (let i = 0; i < points.length; i++) {
      const first = points[Math.max(0, i - 1)], last = points[Math.min(points.length - 1, i + 1)];
      const dx = last.x - first.x, dy = last.y - first.y, size = Math.max(.001, Math.hypot(dx, dy));
      points[i].nx = -dy / size; points[i].ny = dx / size;
    }
    strips.push(points);
  }
  ctx.lineWidth = (unit * .0008) * s.lineWidth; ctx.strokeStyle = alpha(s.secondaryColor, .13 + s.glow * .07);
  ctx.beginPath();
  for (let i = 0; i <= 80; i += 4) { ctx.moveTo(strips[0][i].x, strips[0][i].y); ctx.lineTo(strips[1][i].x, strips[1][i].y); }
  ctx.stroke();
  const segments = strips.flatMap((points, strand) => points.slice(0, -1).map((p, i) => ({
    p, q: points[i + 1], strand, depth: (p.z + points[i + 1].z) / 2,
  }))).sort((a, b) => a.depth - b.depth);
  for (const { p, q, strand, depth } of segments) {
    const color = strand ? s.secondaryColor : s.color;
    const near = (depth + 1) / 2;
    ctx.beginPath();
    ctx.moveTo(p.x + p.nx * p.width, p.y + p.ny * p.width);
    ctx.lineTo(q.x + q.nx * q.width, q.y + q.ny * q.width);
    ctx.lineTo(q.x - q.nx * q.width, q.y - q.ny * q.width);
    ctx.lineTo(p.x - p.nx * p.width, p.y - p.ny * p.width); ctx.closePath();
    ctx.fillStyle = alpha(color, .2 + near * .45 + s.glow * .1); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x + p.nx * p.width, p.y + p.ny * p.width);
    ctx.lineTo(q.x + q.nx * q.width, q.y + q.ny * q.width);
    ctx.moveTo(p.x - p.nx * p.width, p.y - p.ny * p.width);
    ctx.lineTo(q.x - q.nx * q.width, q.y - q.ny * q.width);
    ctx.strokeStyle = alpha(color, .3 + near * .45); ctx.stroke();
  }
};

export const generativeRenderers: Pick<Record<StyleId, StyleRenderer>,
  'flowfield' | 'chladni' | 'moire' | 'helix'> = { flowfield, chladni, moire, helix };
