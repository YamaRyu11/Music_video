import { STYLE_IDS, type StyleId } from '../shared';

export const STYLE_DRAG_TYPE = 'application/x-music-video-style';

export function isStyleDrag(transfer: DataTransfer): boolean {
  return transfer.types.includes(STYLE_DRAG_TYPE);
}

export function droppedStyle(transfer: DataTransfer): StyleId | null {
  if (!isStyleDrag(transfer)) return null;
  const value = transfer.getData(STYLE_DRAG_TYPE);
  return STYLE_IDS.includes(value as StyleId) ? value as StyleId : null;
}
