import type { LayerControls } from '../shared';

interface Capture { canvas: HTMLCanvasElement; mask: CanvasRenderingContext2D; halo: HTMLCanvasElement; blur: CanvasRenderingContext2D }
const captures = new WeakMap<CanvasRenderingContext2D, Capture>();
// Mirror only paths and stroke drawing. Fills, bitmaps, ambient light and text
// are never used as bloom sources. Geometry is evaluated just once per frame.
const mirroredMethods = new Set<PropertyKey>([
  'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo',
  'quadraticCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'clip',
  'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
  'setLineDash', 'stroke', 'strokeRect', 'strokeText',
]);
const mirroredProperties = new Set<PropertyKey>([
  'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset',
  'globalAlpha', 'globalCompositeOperation', 'font', 'textAlign', 'textBaseline', 'direction',
]);

/** One reusable stroke mask per graphics layer; no history between frames. */
export function captureLineGlow(ctx: CanvasRenderingContext2D, s: LayerControls, outputHeight: number) {
  if (!s.lineGlowEnabled || s.lineGlowStrength <= 0 || s.lineGlowDistance <= 0) return { ctx, finish: () => {} };
  let capture = captures.get(ctx);
  if (!capture) {
    const canvas = ctx.canvas.ownerDocument.createElement('canvas');
    const halo = ctx.canvas.ownerDocument.createElement('canvas');
    capture = { canvas, mask: canvas.getContext('2d')!, halo, blur: halo.getContext('2d')! }; captures.set(ctx, capture);
  }
  const { canvas, mask, halo, blur } = capture;
  if (canvas.width !== ctx.canvas.width || canvas.height !== ctx.canvas.height) {
    canvas.width = halo.width = ctx.canvas.width; canvas.height = halo.height = ctx.canvas.height;
  }
  mask.resetTransform(); mask.clearRect(0, 0, canvas.width, canvas.height);
  mask.globalAlpha = 1; mask.globalCompositeOperation = 'source-over';
  mask.filter = 'none'; mask.shadowBlur = 0; mask.shadowColor = 'transparent';
  mask.setTransform(ctx.getTransform()); mask.setLineDash(ctx.getLineDash());
  for (const key of mirroredProperties) Reflect.set(mask, key, Reflect.get(ctx, key, ctx), mask);
  const methods = new Map<PropertyKey, (...args: unknown[]) => unknown>();
  const proxy = new Proxy(ctx, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (methods.has(key)) return methods.get(key);
      const method = !mirroredMethods.has(key) ? value.bind(target) : (...args: unknown[]) => {
        const result = value.apply(target, args);
        const mirrored = Reflect.get(mask, key, mask);
        mirrored.apply(mask, args); return result;
      };
      methods.set(key, method); return method;
    },
    set(target, key, value) {
      if (mirroredProperties.has(key)) Reflect.set(mask, key, value, mask);
      return Reflect.set(target, key, value, target);
    },
  });
  return { ctx: proxy, finish: () => {
    // Distance is approximately three Gaussian standard deviations, in output
    // pixels. Scale the blur by the actual preview size, not its CSS dimensions.
    const sigma = s.lineGlowDistance / 3 * canvas.height / outputHeight;
    ctx.save(); ctx.resetTransform(); ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.filter = 'none';
    for (const [spread, weight] of [[1, .8], [1 / 3, .65]]) {
      // Blur once per distance, then reuse it for all intensity passes.
      blur.clearRect(0, 0, halo.width, halo.height);
      blur.filter = `blur(${sigma * spread}px)`;
      blur.drawImage(canvas, 0, 0);
      // Canvas globalAlpha cannot exceed one. Multiple passes keep 300% real.
      for (let pass = 0; pass < Math.ceil(s.lineGlowStrength); pass++) {
        ctx.globalAlpha = Math.min(1, s.lineGlowStrength - pass) * weight;
        ctx.drawImage(halo, 0, 0);
      }
    }
    ctx.restore();
  } };
}
