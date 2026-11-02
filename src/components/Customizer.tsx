import {InspectorSection} from './InspectorSection';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Bold, Check, Italic, LockKeyhole, UnlockKeyhole, RotateCcw, Settings2 } from 'lucide-react';
import { defaultBitmapSettings, defaultLayerControls, defaultSettings, MAX_INTENSITY, MAX_SMOOTHING,
  type LayerControls, type LayerTarget, type TextDesign, type TextTarget, type VisualSettings } from '../shared';
import { lineWidthHelp, styles, supportsLineWidth } from '../visuals/catalog';
import { linkedScale, scaleLimits } from '../visuals/scale-lock';
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
  const [sections,setSections]=useState<Record<string,boolean>>({});
  const sectionKey=`${tab}-${tab==='color'?selectedLayer:target}`;
  const section=(name:string,initial:boolean)=>({open:sections[`${sectionKey}-${name}`]??initial,onChange:(open:boolean)=>setSections(s=>({...s,[`${sectionKey}-${name}`]:open}))});
  const update = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => onChange(s => ({ ...s, [key]: value }));
  const updateControls = (values: Partial<LayerControls>) => onChange(s => selectedLayer === 'base'
    ? { ...s, ...values } : { ...s, overlay: { ...s.overlay, ...values } });
  const updateText = <K extends keyof TextDesign>(key: K, value: TextDesign[K]) => onChange(s => ({ ...s, [target]: { ...s[target], [key]: value } }));
  const text = settings[target];
  const controls = selectedLayer === 'base' ? settings : settings.overlay;
  const defaults = selectedLayer === 'base' ? defaultLayerControls : defaultSettings.overlay;
  const resize = (axis: 'scaleX' | 'scaleY', value: number) => onChange(s => {
    const layer = selectedLayer === 'base' ? s : s.overlay;
    const next = linkedScale(layer, axis, value);
    return selectedLayer === 'base' ? {...s, ...next} : {...s, overlay:{...s.overlay, ...next}};
  });
  const resetScale = (axis: 'scaleX' | 'scaleY') => updateControls(controls.scaleLocked ? {scaleX:1,scaleY:1} : {[axis]:1});
  const layerNumber = selectedLayer === 'base' ? '01' : '02';
  const targetStyle = styles.find(s => s.id === controls.style);
  const lineWidthEnabled = supportsLineWidth(controls.style);
  const editingBitmap = tab === 'bitmap';
  const reset = () => {
    if (tab === 'background') update('backgroundColor', defaultSettings.backgroundColor);
    else if (editingBitmap) update('bitmap', { ...defaultBitmapSettings, crop: { ...defaultBitmapSettings.crop } });
    else if (tab === 'text') update(target, { ...defaultSettings[target] });
    else {
      updateControls({ color: defaults.color, secondaryColor: defaults.secondaryColor, brightness: defaults.brightness,
        saturation: defaults.saturation, glow: defaults.glow, intensity: defaults.intensity,
        blur: defaults.blur, fillBackground: defaults.fillBackground, lineGlowEnabled: defaults.lineGlowEnabled, lineGlowStrength: defaults.lineGlowStrength, lineGlowDistance: defaults.lineGlowDistance,
        smoothing: defaults.smoothing, lineWidth: defaults.lineWidth, scaleX: defaults.scaleX, scaleY: defaults.scaleY, scaleLocked: false, x: defaults.x, y: defaults.y });
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
          <InspectorSection title="カラー設定" {...section('color',true)}>
          <PalettePicker primary={controls.color} secondary={controls.secondaryColor} disabled={disabled} onChoose={p => updateControls({color:p.primary,secondaryColor:p.secondary})}/>
          <div className="color-control"><label>メインカラー</label><div className="swatches">{colors.map(c => <button key={c} title={c} aria-label={`カラー ${c}`} aria-pressed={controls.color === c} className={`swatch ${controls.color === c ? 'chosen' : ''}`} style={{ backgroundColor: c }} onClick={() => updateControls({ color: c })}>{controls.color === c && <Check size={13} />}</button>)}<label className="custom-color" title="カスタムカラー"><span>＋</span><ColorInput label="カスタムカラー" value={controls.color} disabled={disabled} onChange={v => updateControls({ color: v })} /></label></div></div>
          <div className="design-grid color-detail"><ColorField label="サブカラー" value={controls.secondaryColor} onChange={v => updateControls({ secondaryColor: v })} /></div>
          <div className="design-grid">
            <Slider label="明るさ" defaultValue={defaults.brightness} value={controls.brightness} min={.5} max={1.5} onChange={v => updateControls({ brightness: v })} />
            <Slider label="彩度" defaultValue={defaults.saturation} value={controls.saturation} min={0} max={2} onChange={v => updateControls({ saturation: v })} />

          </div>
          </InspectorSection>
          <div className="inspector-blend-controls design-grid"><label>合成方法<select aria-label="合成方法" value={controls.blend} onChange={e => updateControls({ blend: e.target.value as LayerControls['blend'] })}><option value="source-over">通常</option><option value="screen">スクリーン</option><option value="lighter">加算（発光）</option><option value="multiply">乗算</option></select></label><Slider label="レイヤーの不透明度" defaultValue={defaults.opacity} value={controls.opacity} min={0} max={1} onChange={v => updateControls({ opacity: v })} /></div>
          <label className="layer-background-toggle"><input type="checkbox" checked={controls.fillBackground} onChange={e=>updateControls({fillBackground:e.target.checked})}/>レイヤーの背景を塗る</label>
          <p className="field-note">{controls.fillBackground ? '共通背景色で透明部分を塗ります。通常・不透明度100%で下のレイヤーを隠します。' : '透明部分と図形の半透明を保ちます。不透明度100%でも下のレイヤーが透けます。'}</p>
          <div className="design-grid separated">
            <Slider label="音への反応" defaultValue={defaults.intensity} value={controls.intensity} min={0} max={MAX_INTENSITY} onChange={v => updateControls({ intensity: v })} />
            <Slider label="動きの滑らかさ" defaultValue={defaults.smoothing} value={controls.smoothing} min={0} max={MAX_SMOOTHING} onChange={v => updateControls({ smoothing: v })} />
          </div>
          <fieldset disabled={!lineWidthEnabled} className="line-width-control"><Slider label="線の太さ" defaultValue={defaults.lineWidth} value={controls.lineWidth} min={.1} max={5} step={.05} onChange={v => updateControls({ lineWidth: v })} /></fieldset>
          <p className="field-note">{lineWidthEnabled ? lineWidthHelp(controls.style) : controls.style === 'none'
            ? 'スタイルを選ぶと、対応する線の太さを調整できます。' : '面で構成するスタイルのため、線の太さは適用されません。'}</p>
          <InspectorSection title="エフェクト" {...section('effects',true)}>
            <Slider label="光の広がり" defaultValue={defaults.glow} value={controls.glow} min={0} max={1} onChange={v => updateControls({ glow: v })} />
          <Slider label="映像のガウスぼかし" defaultValue={defaults.blur} value={controls.blur} min={0} max={80} step={1} scale={1} suffix=" px" onChange={v=>updateControls({blur:v})}/>
          <p className="field-note">選択した映像だけをぼかします。単位は出力動画のpxです。</p>
          <fieldset className="line-glow-controls" disabled={!lineWidthEnabled}>
            <label className="line-glow-toggle"><input type="checkbox" checked={controls.lineGlowEnabled} onChange={e=>updateControls({lineGlowEnabled:e.target.checked})}/>線のグローを有効にする</label>
            <fieldset disabled={!controls.lineGlowEnabled} className="design-grid">
              <Slider label="線のグローの強さ" defaultValue={defaults.lineGlowStrength} value={controls.lineGlowStrength} min={0} max={3} step={.01} onChange={v=>updateControls({lineGlowStrength:v})}/>
              <Slider label="線のグローの距離" defaultValue={defaults.lineGlowDistance} value={controls.lineGlowDistance} min={0} max={160} step={1} scale={1} suffix=" px" onChange={v=>updateControls({lineGlowDistance:v})}/>
            </fieldset>
            <p className="field-note">線に沿う光です。距離は光がほぼ消えるまでの目安（出力動画のpx）。背景・文字にはかかりません。</p>
          </fieldset>
          </InspectorSection>
          <InspectorSection title="サイズ・位置" className="style-transform-controls" {...section('transform',false)}><div className="scale-lock-row"><button className="scale-lock-button" aria-label="縦横比をロック" aria-pressed={controls.scaleLocked} onClick={()=>updateControls({scaleLocked:!controls.scaleLocked})} title="現在の横・縦の比率を固定">{controls.scaleLocked ? <LockKeyhole size={15}/> : <UnlockKeyhole size={15}/>}縦横比{controls.scaleLocked ? '固定中' : 'を固定'}</button><span>{(controls.scaleX/controls.scaleY).toFixed(2)} : 1</span></div><div className="design-grid">
            <Slider label="スタイルの横拡大率" defaultValue={1} onReset={()=>resetScale('scaleX')} value={controls.scaleX} min={scaleLimits(controls,'scaleX').min} max={scaleLimits(controls,'scaleX').max} step={.01} onChange={v=>resize('scaleX',v)}/>
            <Slider label="スタイルの縦拡大率" defaultValue={1} onReset={()=>resetScale('scaleY')} value={controls.scaleY} min={scaleLimits(controls,'scaleY').min} max={scaleLimits(controls,'scaleY').max} step={.01} onChange={v=>resize('scaleY',v)}/>
            <Slider label="スタイルの横位置" defaultValue={0} value={controls.x} min={-1} max={1} step={.01} onChange={v=>updateControls({x:v})}/>
            <Slider label="スタイルの縦位置" defaultValue={0} value={controls.y} min={-1} max={1} step={.01} onChange={v=>updateControls({y:v})}/>
          </div><p className="field-note">選択した映像の図形を調整します。背景画像・文字はそのままです。</p></InspectorSection>
          <p className="field-note">Shift＋ドラッグで微調整、ダブルクリックで初期値。ロック中の拡大率は縦横とも100%に戻ります。</p>
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
            <Slider label="文字サイズ" defaultValue={defaultSettings[target].size} value={text.size} min={14} max={160} step={1} suffix=" px" scale={1} onChange={v => updateText('size', v)} />
            <div className="font-toggles"><button aria-label="太字" aria-pressed={text.weight === 700} onClick={() => updateText('weight', text.weight === 700 ? 400 : 700)}><Bold size={15} />太字</button><button aria-label="斜体" aria-pressed={text.italic} onClick={() => updateText('italic', !text.italic)}><Italic size={15} />斜体</button></div>
            <label>文字揃え<select aria-label="文字揃え" value={text.align} onChange={e => updateText('align', e.target.value as TextDesign['align'])}><option value="left">左揃え</option><option value="center">中央揃え</option><option value="right">右揃え</option></select></label>
            <Slider label="文字の横位置" defaultValue={0} value={text.x} min={-1} max={1} step={.01} onChange={v=>updateText('x',v)}/>
            <Slider label="文字の縦位置" defaultValue={defaultSettings[target].y} value={text.y} min={.08} max={.92} step={.01} onChange={v => updateText('y', v)} />
          </div>
          <div className="text-checks"><label><input type="checkbox" checked={text.visible} onChange={e => updateText('visible', e.target.checked)} />テキストを表示</label><label><input type="checkbox" checked={text.shadow} onChange={e => updateText('shadow', e.target.checked)} />影をつける</label></div>
          <p className="field-note">サイズは出力動画でのpxです。フォントがPCにない場合は代替フォントを使用します。</p>
        </>}
      </fieldset>
    </div>
  </section>;
}
