import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Bold, Check, Image, Italic, Layers2, Palette, RotateCcw, Settings2, Type } from 'lucide-react';
import { defaultBitmapSettings, defaultLayerControls, defaultSettings, MAX_INTENSITY, MAX_SMOOTHING,
  type LayerControls, type LayerTarget, type TextDesign, type VisualSettings } from '../shared';
import { lineWidthHelp, styles, supportsLineWidth } from '../visuals/catalog';
import { droppedStyle, isStyleDrag } from '../visuals/style-drag';
import type { StyleId } from '../shared';
import { Slider } from './Slider';
import { BitmapPanel } from './BitmapPanel';

const colors = ['#b8f36b', '#67e8d0', '#79acff', '#c79cff', '#ff95b5', '#ffbe73'];
const palettes = [
  { name: 'Moss', primary: '#b8f36b', secondary: '#67e8d0' },
  { name: 'Ocean', primary: '#67e8d0', secondary: '#79acff' },
  { name: 'Violet', primary: '#c79cff', secondary: '#ff95b5' },
  { name: 'Sunset', primary: '#ffbe73', secondary: '#ff6a94' },
];
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  return <label className="color-field"><span>{label}</span><span className="color-field-value"><input type="color" aria-label={label} value={value} onChange={e => onChange(e.target.value)} /><code>{value.toUpperCase()}</code></span></label>;
}

function LayerSlot({ slot, selected, disabled, draggingStyle, onSelect, onStyle, children }: {
  slot: '01' | '02'; selected: boolean; disabled: boolean; draggingStyle: boolean;
  onSelect: () => void; onStyle: (style: StyleId) => void; children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  useEffect(() => { if (!draggingStyle || disabled) setHover(false); }, [draggingStyle, disabled]);
  return <div data-layer-slot={slot} role="group" aria-label={`レイヤー ${slot}`}
    className={`layer-order ${selected ? 'selected' : ''} ${hover ? 'drop-target' : ''}`}
    onClick={() => { if (!disabled) onSelect(); }} onDragOver={e => {
      if (disabled || !isStyleDrag(e.dataTransfer)) return;
      e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setHover(true);
    }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(false); }}
    onDrop={e => {
      setHover(false); if (!isStyleDrag(e.dataTransfer)) return;
      e.preventDefault(); e.stopPropagation(); if (disabled) return;
      const style = droppedStyle(e.dataTransfer); if (style) { onSelect(); onStyle(style); }
    }}>
    <button className="layer-edit-button" disabled={disabled} aria-label={`レイヤー${slot}を編集`} aria-pressed={selected} onClick={e => { e.stopPropagation(); onSelect(); }}>
      <span className="layer-number">{slot}</span><span>{selected ? '編集中' : '編集'}</span>
    </button><div className="layer-slot-content">{children}<small>左のスタイルをここへドロップ</small></div>
  </div>;
}

export function Customizer({ settings, onChange, selectedLayer, onSelectLayer, disabled, draggingStyle = false, bitmapAsset, bitmapBusy, onChooseBitmap, onRemoveBitmap }: {
  settings: VisualSettings; onChange: Dispatch<SetStateAction<VisualSettings>>; selectedLayer: LayerTarget;
  onSelectLayer: (layer: LayerTarget) => void; disabled: boolean; draggingStyle?: boolean;
  bitmapAsset?: { name: string; width: number; height: number }; bitmapBusy: boolean; onChooseBitmap: () => void; onRemoveBitmap: () => void;
}) {
  const [tab, setTab] = useState<'color' | 'layers' | 'text'>('color');
  const [layerPage, setLayerPage] = useState<'styles' | 'bitmap'>('styles');
  const [target, setTarget] = useState<'titleDesign' | 'artistDesign'>('titleDesign');
  useEffect(() => { if (draggingStyle) { setTab('layers'); setLayerPage('styles'); } }, [draggingStyle]);
  const update = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => onChange(s => ({ ...s, [key]: value }));
  const updateLayer = <K extends keyof VisualSettings['overlay']>(key: K, value: VisualSettings['overlay'][K]) => onChange(s => ({ ...s, overlay: { ...s.overlay, [key]: value } }));
  const updateControls = (values: Partial<LayerControls>) => onChange(s => selectedLayer === 'base'
    ? { ...s, ...values } : { ...s, overlay: { ...s.overlay, ...values } });
  const updateText = <K extends keyof TextDesign>(key: K, value: TextDesign[K]) => onChange(s => ({ ...s, [target]: { ...s[target], [key]: value } }));
  const text = settings[target];
  const layerEnabled = settings.overlay.style !== 'none';
  const controls = selectedLayer === 'base' ? settings : settings.overlay;
  const layerNumber = selectedLayer === 'base' ? '01' : '02';
  const targetStyle = styles.find(s => s.id === controls.style);
  const lineWidthEnabled = supportsLineWidth(controls.style);
  const editingBitmap = tab === 'layers' && layerPage === 'bitmap';
  const reset = () => {
    if (editingBitmap) update('bitmap', { ...defaultBitmapSettings, crop: { ...defaultBitmapSettings.crop } });
    else if (tab === 'text') update(target, { ...defaultSettings[target] });
    else {
      const defaults = selectedLayer === 'base' ? defaultLayerControls : defaultSettings.overlay;
      updateControls({ color: defaults.color, secondaryColor: defaults.secondaryColor, brightness: defaults.brightness,
        saturation: defaults.saturation, glow: defaults.glow, intensity: defaults.intensity,
        smoothing: defaults.smoothing, lineWidth: defaults.lineWidth });
    }
  };

  return <section className="adjust-panel">
    <div className="panel-title"><h2><Settings2 size={16} />映像をカスタマイズ</h2><button className="reset-button" disabled={disabled} aria-label="カスタマイズをリセット"
      title={editingBitmap ? '背景画像の設定を初期値に戻す' : tab === 'text'
        ? `${target === 'titleDesign' ? 'タイトル' : 'アーティスト'}のデザインを初期値に戻す`
        : `レイヤー${layerNumber}の色・動きを初期値に戻す`} onClick={reset}><RotateCcw size={13} />リセット</button></div>
    <div className="design-tabs" role="tablist" aria-label="カスタマイズ項目">{[
      { id: 'color' as const, label: 'カラー・動き', icon: Palette },
      { id: 'layers' as const, label: 'レイヤー合成', icon: Layers2 },
      { id: 'text' as const, label: 'テキスト', icon: Type },
    ].map(t => <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)}><t.icon size={14} />{t.label}</button>)}</div>

    <div key={`${tab}-${tab === 'layers' ? layerPage : ''}`} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      <fieldset disabled={disabled} className="design-fields">
        {tab === 'color' && <>
          <div className="layer-edit-target"><strong>レイヤー{layerNumber}を編集中</strong><span>{targetStyle?.title ?? 'スタイル未設定'}</span></div>
          <div className="palette-presets">{palettes.map(p => <button key={p.name} className="palette-preset" onClick={() => updateControls({ color: p.primary, secondaryColor: p.secondary })}>
            <span style={{ background: `linear-gradient(120deg, ${p.primary}, ${p.secondary})` }} />{p.name}</button>)}</div>
          <div className="color-control"><label>メインカラー</label><div className="swatches">{colors.map(c => <button key={c} title={c} aria-label={`カラー ${c}`} aria-pressed={controls.color === c} className={`swatch ${controls.color === c ? 'chosen' : ''}`} style={{ backgroundColor: c }} onClick={() => updateControls({ color: c })}>{controls.color === c && <Check size={13} />}</button>)}<label className="custom-color" title="カスタムカラー"><span>＋</span><input aria-label="カスタムカラー" type="color" value={controls.color} onChange={e => updateControls({ color: e.target.value })} /></label></div></div>
          <div className="design-grid color-detail"><ColorField label="サブカラー" value={controls.secondaryColor} onChange={v => updateControls({ secondaryColor: v })} /><ColorField label="背景色" value={settings.backgroundColor} onChange={v => update('backgroundColor', v)} /></div>
          <p className="field-note common-background-note">背景色はレイヤー共通です。</p>
          <div className="design-grid three-columns">
            <Slider label="明るさ" value={controls.brightness} min={.5} max={1.5} onChange={v => updateControls({ brightness: v })} />
            <Slider label="彩度" value={controls.saturation} min={0} max={2} onChange={v => updateControls({ saturation: v })} />
            <Slider label="光の広がり" value={controls.glow} min={0} max={1} onChange={v => updateControls({ glow: v })} />
          </div>
          <div className="design-grid separated">
            <Slider label="音への反応" value={controls.intensity} min={0} max={MAX_INTENSITY} onChange={v => updateControls({ intensity: v })} />
            <Slider label="動きの滑らかさ" value={controls.smoothing} min={0} max={MAX_SMOOTHING} onChange={v => updateControls({ smoothing: v })} />
          </div>
          <fieldset disabled={!lineWidthEnabled} className="line-width-control"><Slider label="線の太さ" value={controls.lineWidth} min={.1} max={5} step={.05} onChange={v => updateControls({ lineWidth: v })} /></fieldset>
          <p className="field-note">{lineWidthEnabled ? lineWidthHelp(controls.style) : controls.style === 'none'
            ? 'スタイルを選ぶと、対応する線の太さを調整できます。' : '面で構成するスタイルのため、線の太さは適用されません。'}</p>
          <p className="field-note">Shiftを押しながらドラッグすると、細かく調整できます。</p>
        </>}

        {tab === 'layers' && <>
          <div className="layer-subtabs" role="tablist" aria-label="レイヤーの種類">
            <button role="tab" aria-selected={layerPage === 'styles'} onClick={() => setLayerPage('styles')}>スタイル合成</button>
            <button role="tab" aria-selected={layerPage === 'bitmap'} onClick={() => setLayerPage('bitmap')}>背景ビットマップ</button>
          </div>
          {layerPage === 'bitmap' ? <BitmapPanel settings={settings.bitmap} onChange={value => update('bitmap', value)}
            asset={bitmapAsset} busy={bitmapBusy} disabled={disabled} onChoose={onChooseBitmap} onRemove={onRemoveBitmap} /> : <>
          <button className="bitmap-layer-summary" onClick={() => setLayerPage('bitmap')}><span className="layer-number">00</span><Image size={15} /><span><strong>背景ビットマップ</strong><small>{bitmapAsset?.name || '画像を追加して背景に配置'}</small></span></button>
          <LayerSlot slot="01" selected={selectedLayer === 'base'} disabled={disabled} draggingStyle={draggingStyle} onSelect={() => onSelectLayer('base')} onStyle={style => update('style', style)}><label>ベース映像<select aria-label="ベースのスタイル" value={settings.style} onChange={e => { onSelectLayer('base'); update('style', e.target.value as StyleId); }}>{styles.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label></LayerSlot>
          <LayerSlot slot="02" selected={selectedLayer === 'overlay'} disabled={disabled} draggingStyle={draggingStyle} onSelect={() => onSelectLayer('overlay')} onStyle={style => updateLayer('style', style)}><label>重ねるスタイル<select aria-label="重ねるスタイル" value={settings.overlay.style} onChange={e => { onSelectLayer('overlay'); updateLayer('style', e.target.value as VisualSettings['overlay']['style']); }}><option value="none">なし（合成しない）</option>{styles.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label></LayerSlot>
          <fieldset disabled={!layerEnabled} className="design-grid overlay-options">
            <ColorField label="レイヤーの色" value={settings.overlay.color} onChange={v => updateLayer('color', v)} />
            <label>合成方法<select aria-label="合成方法" value={settings.overlay.blend} onChange={e => updateLayer('blend', e.target.value as VisualSettings['overlay']['blend'])}><option value="source-over">通常</option><option value="screen">スクリーン</option><option value="lighter">加算（発光）</option><option value="multiply">乗算</option></select></label>
            <div className="full-row"><Slider label="レイヤーの不透明度" value={settings.overlay.opacity} min={0} max={1} onChange={v => updateLayer('opacity', v)} /><p className="field-note">0%で非表示、100%ではっきり重なります。テキストは合成後に表示されます。</p></div>
          </fieldset>
          </>}
        </>}

        {tab === 'text' && <>
          <div className="text-grid text-inputs"><label>タイトル<input placeholder="曲名を入力（任意）" maxLength={100} value={settings.title} onChange={e => update('title', e.target.value)} /></label><label>アーティスト<input placeholder="アーティスト名を入力（任意）" maxLength={100} value={settings.artist} onChange={e => update('artist', e.target.value)} /></label></div>
          <div className="text-target" aria-label="編集するテキスト"><button aria-label="タイトルを編集" aria-pressed={target === 'titleDesign'} onClick={() => setTarget('titleDesign')}>タイトルのデザイン</button><button aria-label="アーティストを編集" aria-pressed={target === 'artistDesign'} onClick={() => setTarget('artistDesign')}>アーティストのデザイン</button></div>
          <div className="design-grid text-design">
            <label>フォント<select aria-label="フォント" value={text.font} onChange={e => updateText('font', e.target.value as TextDesign['font'])}><option value="sans">ゴシック / Segoe UI・游ゴシック</option><option value="serif">明朝 / 游明朝</option><option value="mono">等幅 / Consolas</option><option value="meiryo">メイリオ</option></select></label>
            <ColorField label="文字色" value={text.color} onChange={v => updateText('color', v)} />
            <Slider label="文字サイズ" value={text.size} min={14} max={160} step={1} suffix=" px" scale={1} onChange={v => updateText('size', v)} />
            <div className="font-toggles"><button aria-label="太字" aria-pressed={text.weight === 700} onClick={() => updateText('weight', text.weight === 700 ? 400 : 700)}><Bold size={15} />太字</button><button aria-label="斜体" aria-pressed={text.italic} onClick={() => updateText('italic', !text.italic)}><Italic size={15} />斜体</button></div>
            <label>文字揃え<select aria-label="文字揃え" value={text.align} onChange={e => updateText('align', e.target.value as TextDesign['align'])}><option value="left">左揃え</option><option value="center">中央揃え</option><option value="right">右揃え</option></select></label>
            <Slider label="文字の縦位置" value={text.y} min={.08} max={.92} step={.01} onChange={v => updateText('y', v)} />
          </div>
          <div className="text-checks"><label><input type="checkbox" checked={text.visible} onChange={e => updateText('visible', e.target.checked)} />テキストを表示</label><label><input type="checkbox" checked={text.shadow} onChange={e => updateText('shadow', e.target.checked)} />影をつける</label></div>
          <p className="field-note">サイズは出力動画でのpxです。フォントがPCにない場合は代替フォントを使用します。</p>
        </>}
      </fieldset>
    </div>
  </section>;
}
