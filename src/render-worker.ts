import { dimensions, OUTPUT_FPS } from './shared';
import { renderScene } from './visuals/render';
import { decodeBitmap, type DecodedBitmap } from './visuals/bitmap';

export function startRenderWorker() {
  const bridge = window.studio;
  if (!bridge) return;
  bridge.onRenderStart(async ({ jobId, settings, analysis, bitmapAsset }) => {
    let bitmap: DecodedBitmap | undefined;
    try {
      if (bitmapAsset && settings.bitmap.enabled) bitmap = await decodeBitmap(bitmapAsset.bytes, bitmapAsset.mime);
      const [width, height] = dimensions(settings.aspect);
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('描画エンジンを開始できませんでした。');
      const count = Math.ceil(analysis.duration * OUTPUT_FPS);
      for (let frame = 0; frame < count; frame++) {
        renderScene(ctx, width, height, frame / OUTPUT_FPS, settings, analysis, bitmap);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('フレーム生成に失敗しました。')), 'image/jpeg', 0.97));
        if (!await bridge.writeFrame(jobId, frame, await blob.arrayBuffer())) return;
      }
      await bridge.finishRender(jobId);
    } catch (error) { bridge.failRender(jobId, error instanceof Error ? error.message : '映像の生成に失敗しました。'); }
    finally { bitmap?.image.close(); }
  });
  bridge.renderReady();
}
