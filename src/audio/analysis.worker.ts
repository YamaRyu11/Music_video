import { analyzeAudio } from './analysis';

self.onmessage = (event: MessageEvent<{ channels: Float32Array[]; sampleRate: number }>) => {
  try {
    const result = analyzeAudio(event.data.channels, event.data.sampleRate, progress => self.postMessage({ progress }));
    self.postMessage({ result }, { transfer: [result.data.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '音声解析に失敗しました。' });
  }
};
