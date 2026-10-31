import { sampleFeatures, type Features } from '../audio/analysis';
import { fontFamilies, type Analysis, type VisualSettings, type StyleId, type TextDesign } from '../shared';

const TAU = Math.PI * 2;
const noise = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const alpha = (hex: string, a: number) => `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;

function ambient(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, f: Features, s: VisualSettings) {
  const color = s.color;
  ctx.fillStyle = s.backgroundColor; ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.65);
  glow.addColorStop(0, alpha(color, (0.09 + f.bass * 0.08) * s.glow * 2)); glow.addColorStop(0.6, alpha(s.secondaryColor, s.glow * 0.035)); glow.addColorStop(1, alpha(color, 0));
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
    ctx.closePath(); ctx.strokeStyle = alpha(ring === 1 ? s.secondaryColor : s.color, 0.8 - ring * 0.22);
    ctx.lineWidth = ring ? 1.1 : 2.4;
    ctx.shadowColor = s.color; ctx.shadowBlur = (ring ? 6 : 18 + f.attack * 22 * s.intensity) * s.glow * 2; ctx.stroke();
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
    g.addColorStop(0, s.color); g.addColorStop(1, alpha(s.secondaryColor, 0.32));
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
    ctx.fillStyle = alpha(i % 3 ? s.color : s.secondaryColor, 0.18 + band * 0.7);
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.4, size), 0, TAU); ctx.fill();
    if (i % 3 === 0) {
      ctx.strokeStyle = alpha(s.color, 0.08 + band * 0.18); ctx.lineWidth = unit / 1080;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x - Math.sin(angle) * (5 + f.level * 16 * s.intensity), y + Math.cos(angle) * 8); ctx.stroke();
    }
  }
}

function wave(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, f: Features, s: VisualSettings) {
  const unit = Math.min(w, h);
  for (let layer = 5; layer >= 0; layer--) {
    ctx.beginPath();
    for (let i = 0; i <= 180; i++) {
      const u = i / 180, band = f.bands[Math.min(47, Math.floor(u * 48))];
      const amplitude = unit * (0.015 + (f.level * 0.09 + band * 0.1) * s.intensity);
      const envelope = Math.sin(u * Math.PI) ** 0.8;
      const y = h * 0.46 + Math.sin(u * TAU * 1.8 - t * 0.7 + layer * 0.35) * amplitude * envelope
        + Math.cos(u * TAU * 4 + t * 0.4 + layer * 0.2) * amplitude * 0.28 * envelope + (layer - 2.5) * unit * 0.016;
      if (!i) ctx.moveTo(w * 0.08 + u * w * 0.84, y); else ctx.lineTo(w * 0.08 + u * w * 0.84, y);
    }
    ctx.strokeStyle = alpha(layer % 2 ? s.secondaryColor : s.color, 0.25 + (5 - layer) * 0.1);
    ctx.lineWidth = layer === 0 ? 3 : 1.5; ctx.shadowColor = s.color;
    ctx.shadowBlur = s.glow * (8 + f.attack * 20 * s.intensity); ctx.stroke();
  }
}

function tunnel(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, f: Features, s: VisualSettings) {
  const unit = Math.min(w, h);
  ctx.translate(w / 2, h * 0.46);
  for (let i = 0; i < 14; i++) {
    const phase = (i / 14 + t * 0.055) % 1;
    const radius = unit * (0.025 + phase ** 1.8 * 0.43) * (1 + f.bass * 0.1 * s.intensity);
    ctx.save(); ctx.rotate(t * 0.055 + phase * 0.55 + f.attack * 0.08 * s.intensity);
    ctx.strokeStyle = alpha(i % 2 ? s.secondaryColor : s.color, Math.sin(phase * Math.PI) * (0.35 + f.level * 0.4));
    ctx.lineWidth = 1 + phase * 2; ctx.shadowColor = s.color; ctx.shadowBlur = s.glow * 12;
    ctx.beginPath(); ctx.roundRect(-radius, -radius, radius * 2, radius * 2, radius * 0.16); ctx.stroke(); ctx.restore();
  }
}

function aurora(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, f: Features, s: VisualSettings) {
  const unit = Math.min(w, h);
  for (let ribbon = 0; ribbon < 5; ribbon++) {
    const points = Array.from({ length: 101 }, (_, i) => {
      const u = i / 100, band = f.bands[Math.min(47, Math.floor(u * 48))];
      const y = h * 0.46 + Math.sin(u * Math.PI * 1.7 + t * 0.22 + ribbon * 0.45) * unit * (0.08 + f.bass * 0.08 * s.intensity)
        + Math.sin(u * TAU * 2.5 - t * 0.35) * unit * (0.018 + band * 0.055 * s.intensity);
      return { x: u * w, y, spread: unit * (0.035 + f.level * 0.03 * s.intensity) * Math.sin(u * Math.PI) };
    });
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y - p.spread) : ctx.moveTo(p.x, p.y - p.spread));
    [...points].reverse().forEach(p => ctx.lineTo(p.x, p.y + p.spread)); ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, alpha(s.color, 0)); gradient.addColorStop(0.3, alpha(s.color, 0.1 + s.glow * 0.09));
    gradient.addColorStop(0.7, alpha(s.secondaryColor, 0.17)); gradient.addColorStop(1, alpha(s.secondaryColor, 0));
    ctx.fillStyle = gradient; ctx.fill();
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = alpha(ribbon % 2 ? s.secondaryColor : s.color, 0.2 + f.treble * 0.3 * s.intensity);
    ctx.lineWidth = 1.5; ctx.stroke();
  }
}

const styleRenderers: Record<StyleId, typeof orbit> = { orbit, spectrum, particles, wave, tunnel, aurora };
function drawStyle(ctx: CanvasRenderingContext2D, style: StyleId, w: number, h: number, t: number, f: Features, s: VisualSettings) {
  ctx.save(); styleRenderers[style](ctx, w, h, t, f, s); ctx.restore();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length && ctx.measureText(chars.join('') + '…').width > maxWidth) chars.pop();
  return chars.join('') + '…';
}

function drawText(ctx: CanvasRenderingContext2D, text: string, d: TextDesign, w: number, h: number) {
  if (!d.visible || !text) return;
  ctx.save(); ctx.font = `${d.italic ? 'italic ' : ''}${d.weight} ${d.size}px ${fontFamilies[d.font]}`;
  ctx.textAlign = d.align; ctx.textBaseline = 'middle'; ctx.fillStyle = d.color;
  if (d.shadow) { ctx.shadowColor = '#000000cc'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; }
  const x = d.align === 'left' ? w * 0.08 : d.align === 'right' ? w * 0.92 : w / 2;
  ctx.fillText(fitText(ctx, text, w * 0.84), x, h * d.y); ctx.restore();
}

interface Surfaces { scene: HTMLCanvasElement; layer: HTMLCanvasElement }
const surfaceCache = new WeakMap<CanvasRenderingContext2D, Surfaces>();
function surfaces(ctx: CanvasRenderingContext2D, width: number, height: number) {
  let value = surfaceCache.get(ctx);
  if (!value) {
    value = { scene: ctx.canvas.ownerDocument.createElement('canvas'), layer: ctx.canvas.ownerDocument.createElement('canvas') };
    surfaceCache.set(ctx, value);
  }
  for (const c of [value.scene, value.layer]) if (c.width !== width || c.height !== height) { c.width = width; c.height = height; }
  return value;
}

/** Stateless seeded drawing: any frame is reproducible during seeking/export. */
export function renderScene(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  settings: VisualSettings, analysis?: Analysis) {
  const features = analysis ? sampleFeatures(analysis, time, settings.smoothing) : {
    level: 0.35, bass: 0.3, treble: 0.2, attack: 0,
    bands: Array.from({ length: 48 }, (_, i) => 0.15 + Math.sin(i * 0.4) ** 2 * 0.22),
  };
  // Composite the graphics before grading. Text keeps its independently chosen color.
  const w = settings.aspect === 'portrait' ? 1080 : 1920, h = settings.aspect === 'portrait' ? 1920 : 1080;
  const { scene, layer } = surfaces(ctx, width, height);
  const sceneCtx = scene.getContext('2d', { alpha: false })!, layerCtx = layer.getContext('2d')!;
  sceneCtx.save(); sceneCtx.scale(width / w, height / h);
  ambient(sceneCtx, w, h, time, features, settings);
  drawStyle(sceneCtx, settings.style, w, h, time, features, settings);
  if (settings.overlay.style !== 'none' && settings.overlay.opacity > 0) {
    layerCtx.clearRect(0, 0, width, height);
    layerCtx.save(); layerCtx.scale(width / w, height / h);
    drawStyle(layerCtx, settings.overlay.style, w, h, time, features, { ...settings, color: settings.overlay.color });
    layerCtx.restore();
    sceneCtx.globalCompositeOperation = settings.overlay.blend;
    sceneCtx.globalAlpha = settings.overlay.opacity;
    sceneCtx.drawImage(layer, 0, 0, w, h);
  }
  sceneCtx.restore();
  ctx.save(); ctx.fillStyle = settings.backgroundColor; ctx.fillRect(0, 0, width, height);
  ctx.filter = `saturate(${settings.saturation}) brightness(${settings.brightness})`;
  ctx.drawImage(scene, 0, 0); ctx.filter = 'none';
  ctx.scale(width / w, height / h);
  drawText(ctx, settings.title, settings.titleDesign, w, h);
  drawText(ctx, settings.artist, settings.artistDesign, w, h);
  ctx.restore();
}
