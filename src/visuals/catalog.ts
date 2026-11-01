import type { StyleId } from '../shared';

export const styleCategories = [
  { id: 'all', label: 'すべて' }, { id: 'minimal', label: 'ミニマル' },
  { id: 'glow', label: '発光' }, { id: 'geometry', label: '幾何学' },
  { id: 'organic', label: '有機的' }, { id: 'space', label: '空間' },
  { id: 'typography', label: 'タイポグラフィ' },
  { id: 'wireframe', label: 'ワイヤーフレーム' },
] as const;
export type StyleCategory = typeof styleCategories[number]['id'];
export interface StyleDefinition { id: StyleId; title: string; subtitle: string; className: string; category: Exclude<StyleCategory, 'all'> }

export const styles: StyleDefinition[] = [
  { id: 'orbit', title: 'Neon Orbit', subtitle: '低音に揺れる、光のリング', className: 'art-orbit', category: 'glow' },
  { id: 'spectrum', title: 'Spectrum', subtitle: '音の輪郭を、グラフィックに', className: 'art-spectrum', category: 'minimal' },
  { id: 'particles', title: 'Particle Flow', subtitle: '音とともに、粒子が踊る', className: 'art-particles', category: 'organic' },
  { id: 'wave', title: 'Silk Wave', subtitle: '音が織りなす、しなやかな波', className: 'art-wave', category: 'minimal' },
  { id: 'tunnel', title: 'Pulse Tunnel', subtitle: 'ビートと進む、光の奥行き', className: 'art-tunnel', category: 'space' },
  { id: 'aurora', title: 'Aurora', subtitle: '空間を漂う、ふた色の光', className: 'art-aurora', category: 'organic' },
  { id: 'laser', title: 'Laser Grid', subtitle: '低音に波打つ、遠近の格子', className: 'art-laser', category: 'space' },
  { id: 'bloom', title: 'Radial Bloom', subtitle: '周波数でひらく、光の花', className: 'art-bloom', category: 'geometry' },
  { id: 'stars', title: 'Star Drive', subtitle: '音と加速する、星の旅', className: 'art-stars', category: 'space' },
  { id: 'ink', title: 'Liquid Ink', subtitle: '音が溶け合う、流れるインク', className: 'art-ink', category: 'organic' },
  { id: 'kaleidoscope', title: 'Prism Kaleidoscope', subtitle: 'ビートで変わる、万華鏡', className: 'art-kaleidoscope', category: 'geometry' },
  { id: 'contours', title: 'Contour Landscape', subtitle: '音に隆起する、等高線の風景', className: 'art-contours', category: 'space' },
  { id: 'glitch', title: 'Glitch Blocks', subtitle: 'アタックで弾ける、色の断片', className: 'art-glitch', category: 'geometry' },
  { id: 'lissajous', title: 'Lissajous', subtitle: '音が描く、複雑な線の軌跡', className: 'art-lissajous', category: 'minimal' },
  { id: 'rain', title: 'Light Rain', subtitle: '高音の雨、低音の波紋', className: 'art-rain', category: 'glow' },
  { id: 'typography', title: 'Reactive Typography', subtitle: '曲名そのものが、音と動く', className: 'art-typography', category: 'typography' },
  { id: 'terrain', title: 'Wireframe Journey', subtitle: '曲ごとに変わる、左右の山を旅する', className: 'art-terrain', category: 'wireframe' },
  { id: 'wire-tube', title: 'Warp Tunnel', subtitle: '音でねじれる、立体メッシュの筒', className: 'art-wire-tube', category: 'wireframe' },
  { id: 'wire-orb', title: 'Resonant Orb', subtitle: '音色が浮き上がる、回転する球体', className: 'art-wire-orb', category: 'wireframe' },
  { id: 'wire-city', title: 'Wireframe Metropolis', subtitle: '音と進む、ワイヤー都市の道', className: 'art-wire-city', category: 'wireframe' },
];
