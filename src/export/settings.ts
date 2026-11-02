export interface EncodingSettings {
  mode: 'quality' | 'bitrate';
  crf: number;
  videoBitrate: number;
  audioBitrate: 128 | 192 | 256 | 320;
  preset: 'veryfast' | 'fast' | 'medium' | 'slow';
}
export const defaultEncoding: EncodingSettings = { mode: 'quality', crf: 20, videoBitrate: 12, audioBitrate: 256, preset: 'fast' };
export const encodingPresets: {
  name: string;
  settings: EncodingSettings;
}[] = [
  { name: '軽量', settings: { ...defaultEncoding, crf: 25, audioBitrate: 128, preset: 'veryfast' } },
  { name: '標準', settings: { ...defaultEncoding } },
  { name: '高品質', settings: { ...defaultEncoding, crf: 17, audioBitrate: 320, preset: 'medium' } },
];
export function validEncoding(value: unknown): value is EncodingSettings {
  if (!value || typeof value !== 'object')
    return false;
  const s = value as EncodingSettings;
  return ['quality', 'bitrate'].includes(s.mode) && Number.isFinite(s.crf) && s.crf >= 14 && s.crf <= 30
    && Number.isFinite(s.videoBitrate) && s.videoBitrate >= 1 && s.videoBitrate <= 50
    && [128, 192, 256, 320].includes(s.audioBitrate) && ['veryfast', 'fast', 'medium', 'slow'].includes(s.preset);
}
export function estimatedMegabytes(s: EncodingSettings, duration: number) {
  return s.mode === 'bitrate' ? (s.videoBitrate * 1000000 + s.audioBitrate * 1000) * duration / 8 / 1024 ** 2 : undefined;
}
