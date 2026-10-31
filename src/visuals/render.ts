import { sampleFeatures, type Features } from '../audio/analysis';
import { type Analysis, type VisualSettings } from '../shared';

const TAU = Math.PI * 2;
const noise = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const alpha = (hex: string, a: number) => `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;

function ambient(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, f: Features, color: string) {
  ctx.fillStyle = '#080d13'; ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.65);
  glow.addColorStop(0, alpha(color, 0.09 + f.bass * 0.08)); glow.addColorStop(0.5, '#111b20'); glow.addColorStop(1, '#080d13');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 65; i++) {
    const x = ((noise(i + 1) * width + Math.sin(time * 0.08 + i) * 24) % width + width) % width;
    const y = ((noise(i + 201) * height - time * (3 + noise(i + 4) * 9)) % height + height) % height;
    ctx.fillStyle = alpha(color, 0.08 + noise(i) * 0.25 + f.treble * 0.1);
    ctx.beginPath(); ctx.arc(x, y, 0.6 + noise(i + 20) * 1.4, 0, TAU); ctx.fill();
  }
}

function orbit(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, f: Features, s: VisualSettings) {
  const cx = w / 2, cy = h * 0.46, unit = Math.min(w, h);
  const r = unit * (0.22 + f.bass * 0.045 * s.intensity);
  ctx.save(); ctx.translate(cx, cy);
  for (let ring = 0; ring < 3; ring++) {
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const angle = i / 240 * TAU;
      const band = f.bands[Math.floor((i / 240 * 2 % 1) * f.bands.length)];
      const offset = (band * 0.042 * s.intensity + Math.sin(angle * 5 + t * 0.55 + ring) * 0.004) * unit;
      const radius = r + ring * unit * 0.013 + offset;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.strokeStyle = alpha(s.color, 0.8 - ring * 0.22);
    ctx.lineWidth = ring ? 1.1 : 2.4;
    ctx.shadowColor = s.color; ctx.shadowBlur = ring ? 6 : 18 + f.attack * 22 * s.intensity; ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * TAU + t * 0.035;
    const inner = r + unit * 0.067;
    const length = unit * (0.004 + f.bands[i % 48] * 0.036 * s.intensity);
    ctx.strokeStyle = alpha(s.color, 0.18 + f.level * 0.35); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * (inner + length), Math.sin(a) * (inner + length)); ctx.stroke();
  }
  ctx.restore();
}

function spectrum(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, f: Features, s: VisualSettings) {
  const gap = Math.min(w, h) * 0.007, area = w * 0.78, bar = (area - gap * 47) / 48;
  const baseline = h * 0.59, unit = Math.min(w, h);
  for (let i = 0; i < 48; i++) {
    const value = f.bands[i], size = unit * (0.006 + value * 0.3 * s.intensity);
    const x = w * 0.11 + i * (bar + gap);
    const g = ctx.createLinearGradient(0, baseline - size, 0, baseline);
    g.addColorStop(0, s.color); g.addColorStop(1, alpha(s.color, 0.22));
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, baseline - size, bar, size, Math.min(bar / 2, 4)); ctx.fill();
    ctx.fillStyle = alpha(s.color, 0.07 + f.attack * 0.1);
    ctx.fillRect(x, baseline + unit * 0.013, bar, size * 0.2);
  }
  ctx.strokeStyle = alpha(s.color, 0.15); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w * 0.1, baseline); ctx.lineTo(w * 0.9, baseline); ctx.stroke();
}

function particles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, f: Features, s: VisualSettings) {
  const unit = Math.min(w, h), cx = w / 2, cy = h * 0.46;
  for (let i = 0; i < 230; i++) {
    const phase = noise(i + 50), angle = noise(i + 99) * TAU + t * (0.035 + noise(i) * 0.09);
    const wave = Math.sin(t * 0.6 + phase * TAU) * unit * 0.035;
    const band = f.bands[i % 48];
    const radius = unit * (0.08 + phase * 0.32 + f.bass * 0.08 * s.intensity + f.attack * noise(i + 4) * 0.07 * s.intensity) + wave;
    const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius * 0.86;
    const size = (0.8 + noise(i + 3) * 2.5 + band * s.intensity * 3.5) * unit / 1080;
    ctx.fillStyle = alpha(s.color, 0.18 + band * 0.7);
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.4, size), 0, TAU); ctx.fill();
    if (i % 3 === 0) {
      ctx.strokeStyle = alpha(s.color, 0.08 + band * 0.18); ctx.lineWidth = unit / 1080;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x - Math.sin(angle) * (5 + f.level * 16 * s.intensity), y + Math.cos(angle) * 8); ctx.stroke();
    }
  }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, size: number, maxWidth: number, weight: number): string {
  ctx.font = `${weight} ${size}px "Segoe UI", "Noto Sans", sans-serif`;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length && ctx.measureText(clipped + '…').width > maxWidth) clipped = clipped.slice(0, -1);
  return clipped + '…';
}

/** Stateless seeded drawing: any frame is reproducible during seeking/export. */
export function renderScene(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  settings: VisualSettings, analysis?: Analysis) {
  const features = analysis ? sampleFeatures(analysis, time, settings.smoothing) : {
    level: 0.35, bass: 0.3, treble: 0.2, attack: 0,
    bands: Array.from({ length: 48 }, (_, i) => 0.15 + Math.sin(i * 0.4) ** 2 * 0.22),
  };
  ctx.save();
  // Draw in full-HD coordinates even when preview resolution is reduced.
  const w = settings.aspect === 'portrait' ? 1080 : 1920, h = settings.aspect === 'portrait' ? 1920 : 1080;
  ctx.scale(width / w, height / h);
  ambient(ctx, w, h, time, features, settings.color);
  if (settings.style === 'orbit') orbit(ctx, w, h, time, features, settings);
  else if (settings.style === 'spectrum') spectrum(ctx, w, h, time, features, settings);
  else particles(ctx, w, h, time, features, settings);
  const unit = Math.min(w, h);
  ctx.textAlign = 'center'; ctx.fillStyle = '#f1f5ee';
  ctx.fillText(fitText(ctx, settings.title, unit * 0.038, w * 0.82, 500), w / 2, h * 0.79);
  ctx.fillStyle = '#8c9b99';
  ctx.fillText(fitText(ctx, settings.artist, unit * 0.019, w * 0.82, 400), w / 2, h * 0.835);
  ctx.restore();
}
