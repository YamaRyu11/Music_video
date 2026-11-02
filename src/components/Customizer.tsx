import { type Dispatch, type SetStateAction } from 'react';
import { Bold, Check, Italic, RotateCcw, Settings2 } from 'lucide-react';
import { defaultBitmapSettings, defaultLayerControls, defaultSettings, MAX_INTENSITY, MAX_SMOOTHING,
  type LayerControls, type LayerTarget, type TextDesign, type TextTarget, type VisualSettings } from '../shared';
import { lineWidthHelp, styles, supportsLineWidth } from '../visuals/catalog';
import { Slider } from './Slider';
import { BitmapPanel } from './BitmapPanel';
import { ColorInput } from './ColorInput';
import { PalettePicker, BackgroundPresets } from './PalettePicker';

const colors = ['#b8f36b', '#67e8d0', '#79acff', '#c79cff', '#ff95b5', '#ffbe73'];
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  return <label className="color-field"><span>{label}</span><span className="color-field-value"><ColorInput label={label} value={value} onChange={onChange} /><code>{value.toUpperCase()}</code></span></label>;
}

export type CustomizerTab = 'color' | 'bitmap' | 'text' | 'background';

export function Customizer({ settings, onChange, selectedLayer, activeTab: tab, textTarget: target, disabled, bitmapAsset, bitmapBusy, onChooseBitmap, onRemoveBitmap }: {
  settings: VisualSettings; onChange: Dispatch<SetStateAction<VisualSettings>>; selectedLayer: LayerTarget;
  activeTab: CustomizerTab; textTarget: TextTarget; disabled: boolean;
  bitmapAsset?: { name: string; width: number; height: number }; bitmapBusy: boolean; onChooseBitmap: () => void; onRemoveBitmap: () => void;
}) {
  const update = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => onChange(s => ({ ...s, [key]: value }));
  const updateControls = (values: Partial<LayerControls>) => onChange(s => selectedLayer === 'base'
    ? { ...s, ...values } : { ...s, overlay: { ...s.overlay, ...values } });
  const updateText = <K extends keyof TextDesign>(key: K, value: TextDesign[K]) => onChange(s => ({ ...s, [target]: { ...s[target], [key]: value } }));
  const text = settings[target];
  const controls = selectedLayer === 'base' ? settings : settings.overlay;
  const layerNumber = selectedLayer === 'base' ? '01' : '02';
  const targetStyle = styles.find(s => s.id === controls.style);
  const lineWidthEnabled = supportsLineWidth(controls.style);
  const editingBitmap = tab === 'bitmap';
  const reset = () => {
    if (tab === 'background') update('backgroundColor', defaultSettings.backgroundColor);
    else if (editingBitmap) update('bitmap', { ...defaultBitmapSettings, crop: { ...defaultBitmapSettings.crop } });
    else if (tab === 'text') update(target, { ...defaultSettings[target] });
    else {
      const defaults = selectedLayer === 'base' ? defaultLayerControls : defaultSettings.overlay;
      updateControls({ color: defaults.color, secondaryColor: defaults.secondaryColor, brightness: defaults.brightness,
        saturation: defaults.saturation, glow: defaults.glow, intensity: defaults.intensity,
        smoothing: defaults.smoothing, lineWidth: defaults.lineWidth, scaleX: defaults.scaleX, scaleY: defaults.scaleY, x: defaults.x, y: defaults.y });
    }
  };

  return <section className="adjust-panel">
    <div className="panel-title"><h2><Settings2 size={16} />{tab === 'background' ? '背景色' : tab === 'bitmap' ? '背景ビットマップ' : tab === 'text' ? 'テキスト' : 'カラー・動き'}</h2><button className="reset-button" disabled={disabled} aria-label="カスタマイズをリセット"
      title={tab === 'background' ? '共通背景色を初期値に戻す' : editingBitmap ? '背景画像の設定を初期値に戻す' : tab === 'text'
        ? `${target === 'titleDesign' ? 'タイトル' : 'アーティスト'}のデザインを初期値に戻す`
        : `レイヤー${layerNumber}の色・動きを初期値に戻す`} onClick={reset}><RotateCcw size={13} />リセット</button></div>
    <div key={`${tab}-${tab === 'color' ? selectedLayer : target}`} role="region" aria-label={tab === 'background' ? '背景色の設定' : tab === 'bitmap' ? '背景ビットマップの設定' : tab === 'text' ? 'テキストの設定' : 'カラー・動きの設定'} className="inspector-content">
      <fieldset disabled={disabled} className="design-fields">
        {tab === 'color' && <>
          <div className="layer-edit-target"><strong>レイヤー{layerNumber}を編集中</strong><span>{targetStyle?.title ?? 'スタイル未設定'}</span></div>
          <PalettePicker primary={controls.color} secondary={controls.secondaryColor} disabled={disabled} onChoose={p => updateControls({color:p.primary,secondaryColor:p.secondary})}/>
          <div className="color-control"><label>メインカラー</label><div className="swatches">{colors.map(c => <button key={c} title={c} aria-label={`カラー ${c}`} aria-pressed={controls.color === c} className={`swatch ${controls.color === c ? 'chosen' : ''}`} style={{ backgroundColor: c }} onClick={() => updateControls({ color: c })}>{controls.color === c && <Check size={13} />}</button>)}<label className="custom-color" title="カスタムカラー"><span>＋</span><ColorInput label="カスタムカラー" value={controls.color} disabled={disabled} onChange={v => updateControls({ color: v })} /></label></div></div>
          <div className="design-grid color-detail"><ColorField label="サブカラー" value={controls.secondaryColor} onChange={v => updateControls({ secondaryColor: v })} /></div>
          <div className="inspector-blend-controls design-grid"><label>合成方法<select aria-label="合成方法" value={controls.blend} onChange={e => updateControls({ blend: e.target.value as LayerControls['blend'] })}><option value="source-over">通常</option><option value="screen">スクリーン</option><option value="lighter">加算（発光）</option><option value="multiply">乗算</option></select></label><Slider label="レイヤーの不透明度" value={controls.opacity} min={0} max={1} onChange={v => updateControls({ opacity: v })} /></div>
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
          <details className="style-transform-controls"><summary>サイズ・位置</summary><div className="design-grid">
            <Slider label="スタイルの横拡大率" value={controls.scaleX} min={.1} max={5} step={.01} onChange={v=>updateControls({scaleX:v})}/>
            <Slider label="スタイルの縦拡大率" value={controls.scaleY} min={.1} max={5} step={.01} onChange={v=>updateControls({scaleY:v})}/>
            <Slider label="スタイルの横位置" value={controls.x} min={-1} max={1} step={.01} onChange={v=>updateControls({x:v})}/>
            <Slider label="スタイルの縦位置" value={controls.y} min={-1} max={1} step={.01} onChange={v=>updateControls({y:v})}/>
          </div><p className="field-note">選択した映像の図形を調整します。背景画像・文字はそのままです。</p></details>
          <p className="field-note">Shiftを押しながらドラッグすると、細かく調整できます。</p>
        </>}

        {tab === 'background' && <>
          <p className="field-note">すべてのレイヤーに共通する、最も奥の背景色です。</p>
          <BackgroundPresets color={settings.backgroundColor} disabled={disabled} onChoose={v=>update('backgroundColor',v)}/>
          <ColorField label="共通背景色" value={settings.backgroundColor} onChange={v=>update('backgroundColor',v)}/>
        </>}
        {tab === 'bitmap' && <BitmapPanel settings={settings.bitmap} onChange={value => update('bitmap', value)}
          asset={bitmapAsset} busy={bitmapBusy} disabled={disabled} onChoose={onChooseBitmap} onRemove={onRemoveBitmap} />}

        {tab === 'text' && <>
          <div className="text-grid text-inputs"><label>タイトル<input placeholder="曲名を入力（任意）" maxLength={100} value={settings.title} onChange={e => update('title', e.target.value)} /></label><label>アーティスト<input placeholder="アーティスト名を入力（任意）" maxLength={100} value={settings.artist} onChange={e => update('artist', e.target.value)} /></label></div>
          <div className="layer-edit-target"><strong>{target === 'titleDesign' ? 'タイトル' : 'アーティスト'}を編集中</strong></div>
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
