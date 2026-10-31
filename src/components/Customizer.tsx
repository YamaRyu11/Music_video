import { useState, type Dispatch, type SetStateAction } from 'react';
import { Bold, Check, Italic, Layers2, Palette, RotateCcw, Settings2, Type } from 'lucide-react';
import { defaultSettings, type TextDesign, type VisualSettings } from '../shared';
import { styles } from '../visuals/catalog';

const colors = ['#b8f36b', '#67e8d0', '#79acff', '#c79cff', '#ff95b5', '#ffbe73'];
const palettes = [
  { name: 'Moss', primary: '#b8f36b', secondary: '#67e8d0', background: '#080d13' },
  { name: 'Ocean', primary: '#67e8d0', secondary: '#79acff', background: '#07131e' },
  { name: 'Violet', primary: '#c79cff', secondary: '#ff95b5', background: '#140c21' },
  { name: 'Sunset', primary: '#ffbe73', secondary: '#ff6a94', background: '#201015' },
];
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  return <label className="color-field"><span>{label}</span><span className="color-field-value"><input type="color" aria-label={label} value={value} onChange={e => onChange(e.target.value)} /><code>{value.toUpperCase()}</code></span></label>;
}
function Slider({ label, value, min, max, step = .05, suffix = '%', scale = 100, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; scale?: number; onChange: (value: number) => void;
}) {
  return <label className="design-slider"><span>{label}<output>{Math.round(value * scale)}{suffix}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></label>;
}

export function Customizer({ settings, onChange, disabled }: {
  settings: VisualSettings; onChange: Dispatch<SetStateAction<VisualSettings>>; disabled: boolean;
}) {
  const [tab, setTab] = useState<'color' | 'layers' | 'text'>('color');
  const [target, setTarget] = useState<'titleDesign' | 'artistDesign'>('titleDesign');
  const update = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => onChange(s => ({ ...s, [key]: value }));
  const updateLayer = <K extends keyof VisualSettings['overlay']>(key: K, value: VisualSettings['overlay'][K]) => onChange(s => ({ ...s, overlay: { ...s.overlay, [key]: value } }));
  const updateText = <K extends keyof TextDesign>(key: K, value: TextDesign[K]) => onChange(s => ({ ...s, [target]: { ...s[target], [key]: value } }));
  const text = settings[target];
  const layerEnabled = settings.overlay.style !== 'none';

  return <section className="adjust-panel">
    <div className="panel-title"><h2><Settings2 size={16} />映像をカスタマイズ</h2><button className="reset-button" disabled={disabled} aria-label="カスタマイズをリセット" title="色・合成・文字デザインを初期値に戻す"
      onClick={() => onChange(s => ({ ...defaultSettings, style: s.style, aspect: s.aspect, title: s.title, artist: s.artist }))}><RotateCcw size={13} />リセット</button></div>
    <div className="design-tabs" role="tablist" aria-label="カスタマイズ項目">{[
      { id: 'color' as const, label: 'カラー・動き', icon: Palette },
      { id: 'layers' as const, label: 'レイヤー合成', icon: Layers2 },
      { id: 'text' as const, label: 'テキスト', icon: Type },
    ].map(t => <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)}><t.icon size={14} />{t.label}</button>)}</div>

    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      <fieldset disabled={disabled} className="design-fields">
        {tab === 'color' && <>
          <div className="palette-presets">{palettes.map(p => <button key={p.name} className="palette-preset" onClick={() => onChange(s => ({ ...s, color: p.primary, secondaryColor: p.secondary, backgroundColor: p.background }))}>
            <span style={{ background: `linear-gradient(120deg, ${p.primary}, ${p.secondary})` }} />{p.name}</button>)}</div>
          <div className="color-control"><label>メインカラー</label><div className="swatches">{colors.map(c => <button key={c} title={c} aria-label={`カラー ${c}`} aria-pressed={settings.color === c} className={`swatch ${settings.color === c ? 'chosen' : ''}`} style={{ backgroundColor: c }} onClick={() => update('color', c)}>{settings.color === c && <Check size={13} />}</button>)}<label className="custom-color" title="カスタムカラー"><span>＋</span><input aria-label="カスタムカラー" type="color" value={settings.color} onChange={e => update('color', e.target.value)} /></label></div></div>
          <div className="design-grid color-detail"><ColorField label="サブカラー" value={settings.secondaryColor} onChange={v => update('secondaryColor', v)} /><ColorField label="背景色" value={settings.backgroundColor} onChange={v => update('backgroundColor', v)} /></div>
          <div className="design-grid three-columns">
            <Slider label="明るさ" value={settings.brightness} min={.5} max={1.5} onChange={v => update('brightness', v)} />
            <Slider label="彩度" value={settings.saturation} min={0} max={2} onChange={v => update('saturation', v)} />
            <Slider label="光の広がり" value={settings.glow} min={0} max={1} onChange={v => update('glow', v)} />
          </div>
          <div className="design-grid separated">
            <Slider label="音への反応" value={settings.intensity} min={0} max={2} onChange={v => update('intensity', v)} />
            <Slider label="動きの滑らかさ" value={settings.smoothing} min={0} max={1} onChange={v => update('smoothing', v)} />
          </div>
        </>}

        {tab === 'layers' && <>
          <div className="layer-order"><span className="layer-number">01</span><div><strong>ベース映像</strong><small>{styles.find(s => s.id === settings.style)?.title} · 左のスタイルで変更</small></div></div>
          <div className={`layer-order ${layerEnabled ? 'layer-active' : ''}`}><span className="layer-number">02</span><label>重ねるスタイル<select aria-label="重ねるスタイル" value={settings.overlay.style} onChange={e => updateLayer('style', e.target.value as VisualSettings['overlay']['style'])}><option value="none">なし（合成しない）</option>{styles.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label></div>
          <fieldset disabled={!layerEnabled} className="design-grid overlay-options">
            <ColorField label="レイヤーの色" value={settings.overlay.color} onChange={v => updateLayer('color', v)} />
            <label>合成方法<select aria-label="合成方法" value={settings.overlay.blend} onChange={e => updateLayer('blend', e.target.value as VisualSettings['overlay']['blend'])}><option value="source-over">通常</option><option value="screen">スクリーン</option><option value="lighter">加算（発光）</option><option value="multiply">乗算</option></select></label>
            <div className="full-row"><Slider label="レイヤーの不透明度" value={settings.overlay.opacity} min={0} max={1} onChange={v => updateLayer('opacity', v)} /><p className="field-note">0%で非表示、100%ではっきり重なります。テキストは合成後に表示されます。</p></div>
          </fieldset>
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
