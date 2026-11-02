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
  { id: 'flowfield', title: 'Flow Field', subtitle: '音色が織る、渦巻く流線', className: 'art-flowfield', category: 'organic' },
  { id: 'chladni', title: 'Chladni Sand', subtitle: '音の節に集まる、光の砂紋', className: 'art-chladni', category: 'geometry' },
  { id: 'moire', title: 'Moire Weave', subtitle: '重なる線がつくる、干渉の織物', className: 'art-moire', category: 'geometry' },
  { id: 'helix', title: 'Ribbon Helix', subtitle: '音でほどける、立体の二重らせん', className: 'art-helix', category: 'space' },
  { id: 'waterfall', title: 'Spectral Waterfall', subtitle: '周波数の履歴を流れる、音の地層', className: 'art-waterfall', category: 'space' },
  { id: 'phosphor', title: 'Phosphor Echo', subtitle: '音の記憶が広がる、光の残像', className: 'art-phosphor', category: 'glow' },
  { id: 'radar', title: 'Radar Pulse', subtitle: '周波数を探る、光のレーダー', className: 'art-radar', category: 'minimal' },
  { id: 'metaballs', title: 'Metaball Field', subtitle: '音で溶け合う、液体の等高線', className: 'art-metaballs', category: 'organic' },
  { id: 'fractal', title: 'Fractal Canopy', subtitle: 'リズムで枝を広げる、光の樹木', className: 'art-fractal', category: 'organic' },
  { id: 'torus-knot', title: 'Torus Knot', subtitle: '周波数で膨らむ、立体の結び目', className: 'art-torus-knot', category: 'wireframe' },
  { id: 'cells', title: 'Cellular Bloom', subtitle: '音色で呼吸する、細胞のモザイク', className: 'art-cells', category: 'geometry' },
  { id: 'crystal', title: 'Crystal Shards', subtitle: '音にきらめく、浮遊する結晶', className: 'art-crystal', category: 'space' },
  {id:'rose', title:'Harmonic Rose', subtitle:'音色で咲く、幾重もの調和曲線', className:'art-rose', category:'geometry'},
  {id:'pendulum', title:'Pendulum Choir', subtitle:'周波数で揺れ幅が変わる、振り子の合唱', className:'art-pendulum', category:'minimal'},
  {id:'gyroid', title:'Gyroid Lattice', subtitle:'音で表情を変える、立体の迷宮格子', className:'art-gyroid', category:'wireframe'},
  {id:'braid', title:'Spectral Braid', subtitle:'周波数を編み込む、光の組み紐', className:'art-braid', category:'geometry'},
  {id:'oscilloscope', title:'Harmonic Scope', subtitle:'音域から合成する、三段の光の波形', className:'art-oscilloscope', category:'minimal'},
  {id:'sonar', title:'Sonar Rings', subtitle:'音と波打ち、奥へ広がる水面の輪', className:'art-sonar', category:'space'},
  {id:'ribbons', title:'Woven Ribbons', subtitle:'音色でほぐれる、ふた色の織物', className:'art-ribbons', category:'organic'},
  {id:'orrery', title:'Orbital Orrery', subtitle:'音で膨らむ天体が巡る、立体の天球儀', className:'art-orrery', category:'space'},
  {id:'jellyfish',title:'Jellyfish Ballet',subtitle:'低音で呼吸し、音色で触手が揺れるクラゲ',className:'art-jellyfish',category:'organic'},
  {id:'ripple-grid',title:'Interference Pool',subtitle:'二つの波が干渉する、立体の水面メッシュ',className:'art-ripple-grid',category:'wireframe'},
  {id:'fibonacci',title:'Fibonacci Spiral',subtitle:'黄金角の光点と螺旋が、音にひらく',className:'art-fibonacci',category:'geometry'},
  {id:'sigils',title:'Astral Sigils',subtitle:'音色で構造が変わる、回転する幾何学の紋章',className:'art-sigils',category:'geometry'},
  {id:'origami',title:'Origami Flight',subtitle:'周波数で翼を折り、漂う光の群れ',className:'art-origami',category:'space'},
  {id:'ribbon-sphere',title:'Ribbon Planet',subtitle:'音にねじれ、球面を包む光のリボン',className:'art-ribbon-sphere',category:'space'},
  {id:'sundial',title:'Sunburst Dial',subtitle:'周波数を刻む、光の目盛りと回転針',className:'art-sundial',category:'minimal'},
  {id:'hexwave',title:'Hexwave Array',subtitle:'音で浮き沈みする、六角形の波',className:'art-hexwave',category:'geometry'},
  {id:'mobius',title:'Mobius Ribbon',subtitle:'音で幅を変える、ひとひねりの立体リボン',className:'art-mobius',category:'wireframe'},
  {id:'magnetic',title:'Magnetic Lines',subtitle:'音で極が呼吸する、流れる磁力線',className:'art-magnetic',category:'organic'},
  {id:'eclipse',title:'Eclipse Corona',subtitle:'周波数に揺らめく、日食の光冠',className:'art-eclipse',category:'glow'},
  {id:'hourglass',title:'Vortex Hourglass',subtitle:'音で広がり、光の砂が巡る砂時計',className:'art-hourglass',category:'space'},
  {id:'gears',title:'Harmonic Gears',subtitle:'低音で呼吸し、かみ合って回る歯車',className:'art-gears',category:'geometry'},
  {id:'comets',title:'Comet Trails',subtitle:'音域ごとに輝く、曲線を巡る彗星',className:'art-comets',category:'glow'},
  {id:'lightning',title:'Arc Lightning',subtitle:'音で枝の揺れが変わる、光の放電',className:'art-lightning',category:'glow'},
  {id:'shell',title:'Nautilus Shell',subtitle:'周波数でふくらむ、螺旋の立体貝殻',className:'art-shell',category:'wireframe'},
];

export function supportsLineWidth(style: StyleId | 'none'): boolean {
  return style !== 'none' && style !== 'glitch';
}

export function lineWidthHelp(style: StyleId | 'none'): string {
  if (style === 'spectrum') return '棒の幅を保ち、基準線の太さを調整します。';
  if (style === 'chladni') return '砂粒のサイズを保ち、外枠の太さを調整します。';
  if (style === 'ink') return 'インクの輪郭線の太さを調整します。';
  if (style === 'helix') return 'リボンの縁と連結線の太さを調整します。';
  if (style === 'typography') return '装飾線の太さを調整します。文字はテキストタブで編集できます。';
  return 'スタイルの線部分に適用されます。';
}
