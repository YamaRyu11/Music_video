import type { LayerControls } from '../shared';

const plates = new WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>();
/** Grade/blur the graphics first, then put the shared color behind them. This
 * keeps the backdrop opaque at frame edges even with Gaussian blur enabled. */
export function compositeLayer(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement,
  s: LayerControls, outputHeight: number, backgroundColor: string) {
  const blur = s.blur > 0 ? ` blur(${s.blur * source.height / outputHeight}px)` : '';
  let filter = `saturate(${s.saturation}) brightness(${s.brightness})${blur}`;
  let image = source;
  if (s.fillBackground) {
    let plate = plates.get(ctx);
    if (!plate) { plate = ctx.canvas.ownerDocument.createElement('canvas'); plates.set(ctx, plate); }
    if (plate.width !== source.width || plate.height !== source.height) { plate.width = source.width; plate.height = source.height; }
    const target = plate.getContext('2d')!;
    target.clearRect(0, 0, plate.width, plate.height);
    target.save(); target.filter = filter; target.drawImage(source, 0, 0); target.restore();
    target.save(); target.globalCompositeOperation = 'destination-over';
    target.fillStyle = backgroundColor; target.fillRect(0, 0, plate.width, plate.height); target.restore();
    image = plate; filter = 'none';
  }
  // Apply opacity once to the complete layer, including its backdrop.
  ctx.save(); ctx.filter = filter; ctx.globalAlpha = s.opacity; ctx.globalCompositeOperation = s.blend;
  ctx.drawImage(image, 0, 0); ctx.restore();
}
