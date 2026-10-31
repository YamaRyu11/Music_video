import type { StyleId } from '../shared';

export const styles: { id: StyleId; title: string; subtitle: string; className: string }[] = [
  { id: 'orbit', title: 'Neon Orbit', subtitle: '低音に揺れる、光のリング', className: 'art-orbit' },
  { id: 'spectrum', title: 'Spectrum', subtitle: '音の輪郭を、グラフィックに', className: 'art-spectrum' },
  { id: 'particles', title: 'Particle Flow', subtitle: '音とともに、粒子が踊る', className: 'art-particles' },
  { id: 'wave', title: 'Silk Wave', subtitle: '音が織りなす、しなやかな波', className: 'art-wave' },
  { id: 'tunnel', title: 'Pulse Tunnel', subtitle: 'ビートと進む、光の奥行き', className: 'art-tunnel' },
  { id: 'aurora', title: 'Aurora', subtitle: '空間を漂う、ふた色の光', className: 'art-aurora' },
];
