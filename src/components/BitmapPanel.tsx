import { useState } from 'react';
import { Crop, ImagePlus, LoaderCircle, Move, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { defaultBitmapSettings, type BitmapSettings } from '../shared';
import { Slider } from './Slider';

export interface BitmapPanelProps {
  settings: BitmapSettings;
  onChange: (next: BitmapSettings) => void;
  asset?: { name: string; width: number; height: number };
  busy?: boolean;
  disabled: boolean;
  onChoose: () => void;
  onRemove: () => void;
}

type EditTab = 'layout' | 'crop' | 'effects';
type CropEdge = keyof BitmapSettings['crop'];
const opposite: Record<CropEdge, CropEdge> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };

export function BitmapPanel({ settings, onChange, asset, busy = false, disabled, onChoose, onRemove }: BitmapPanelProps) {
  const [tab, setTab] = useState<EditTab>('layout');
  const locked = disabled || busy;
  const canEdit = !!asset && !locked;
  const update = <K extends keyof BitmapSettings>(key: K, value: BitmapSettings[K]) => onChange({ ...settings, [key]: value });
  const cropMax = (edge: CropEdge) => Math.max(0, Number((.95 - settings.crop[opposite[edge]]).toFixed(6)));
  const updateCrop = (edge: CropEdge, value: number) => onChange({ ...settings,
    crop: { ...settings.crop, [edge]: Math.max(0, Math.min(cropMax(edge), value)) } });
  const reset = () => onChange({ ...defaultBitmapSettings, crop: { ...defaultBitmapSettings.crop } });

  return <section className="bitmap-panel" aria-label="背景ビットマップの編集">
    <div className="bitmap-source">
      <span className="bitmap-source-icon">{busy ? <LoaderCircle size={18} className="spin" /> : <ImagePlus size={18} />}</span>
      <div className="bitmap-source-info"><strong title={asset?.name}>{busy ? '画像を読み込んでいます…' : asset?.name || '背景画像なし'}</strong>
        <small>{asset ? `${asset.width.toLocaleString()} × ${asset.height.toLocaleString()} px` : '写真やイラストを背景に追加'}</small></div>
      <button className="bitmap-remove" type="button" aria-label="背景画像を削除" title="背景画像を削除" disabled={!asset || locked} onClick={onRemove}><Trash2 size={14} /></button>
    </div>
    <button className="bitmap-choose" type="button" disabled={locked} onClick={onChoose}><ImagePlus size={14} />背景画像を選ぶ</button>
    <p className="bitmap-format-note">PNG / JPEG / WebP / BMP · 25 MBまで</p>

    <div className="bitmap-edit-toolbar">
      <label className="bitmap-enabled"><input type="checkbox" checked={settings.enabled} disabled={!canEdit} onChange={e => update('enabled', e.target.checked)} />背景画像を表示</label>
      <button className="bitmap-reset" type="button" aria-label="背景画像をリセット" title="背景画像をリセット" disabled={!canEdit} onClick={reset}><RotateCcw size={12} />リセット</button>
    </div>
    <div className="bitmap-edit-tabs" role="group" aria-label="背景画像の編集項目">
      {[
        { id: 'layout' as const, label: '配置', icon: Move },
        { id: 'crop' as const, label: 'トリミング', icon: Crop },
        { id: 'effects' as const, label: 'エフェクト', icon: SlidersHorizontal },
      ].map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} disabled={disabled} onClick={() => setTab(item.id)}><item.icon size={13} />{item.label}</button>)}
    </div>

    <fieldset className="bitmap-controls" disabled={!canEdit}>
      {tab === 'layout' && <>
        <label className="bitmap-fit">画像の収め方<select aria-label="画像の収め方" value={settings.fit} onChange={e => update('fit', e.target.value as BitmapSettings['fit'])}><option value="cover">画面を埋める</option><option value="contain">画像全体を収める</option></select></label>
        <div className="bitmap-control-grid">
          <Slider label="画像の拡大率" defaultValue={1} value={settings.scale} min={.1} max={5} step={.01} onChange={value => update('scale', value)} />
          <Slider label="画像の回転" defaultValue={0} value={settings.rotation} min={-180} max={180} step={1} suffix="°" scale={1} onChange={value => update('rotation', value)} />
          <Slider label="画像の横位置" defaultValue={0} value={settings.x} min={-1} max={1} step={.01} onChange={value => update('x', value)} />
          <Slider label="画像の縦位置" defaultValue={0} value={settings.y} min={-1} max={1} step={.01} onChange={value => update('y', value)} />
        </div>
        <p className="bitmap-edit-note">拡大率と位置で、見せたい範囲を調整できます。</p>
      </>}

      {tab === 'crop' && <>
        <div className="bitmap-control-grid">
          <Slider label="左の切り抜き" defaultValue={0} value={settings.crop.left} min={0} max={cropMax('left')} step={.01} onChange={value => updateCrop('left', value)} />
          <Slider label="右の切り抜き" defaultValue={0} value={settings.crop.right} min={0} max={cropMax('right')} step={.01} onChange={value => updateCrop('right', value)} />
          <Slider label="上の切り抜き" defaultValue={0} value={settings.crop.top} min={0} max={cropMax('top')} step={.01} onChange={value => updateCrop('top', value)} />
          <Slider label="下の切り抜き" defaultValue={0} value={settings.crop.bottom} min={0} max={cropMax('bottom')} step={.01} onChange={value => updateCrop('bottom', value)} />
        </div>
        <p className="bitmap-edit-note">画像の各辺から切り抜く量を指定します。元の画像はそのまま残ります。</p>
      </>}

      {tab === 'effects' && <>
        <div className="bitmap-control-grid">
          <Slider label="ガウスぼかし" defaultValue={0} value={settings.blur} min={0} max={80} step={1} suffix=" px" scale={1} onChange={value => update('blur', value)} />
          <Slider label="画像の不透明度" defaultValue={1} value={settings.opacity} min={0} max={1} step={.01} onChange={value => update('opacity', value)} />
          <Slider label="画像の彩度" defaultValue={1} value={settings.saturation} min={0} max={2} step={.01} onChange={value => update('saturation', value)} />
          <Slider label="画像の明るさ" defaultValue={1} value={settings.brightness} min={0} max={2} step={.01} onChange={value => update('brightness', value)} />
        </div>
        <p className="bitmap-edit-note">背景画像だけに適用されます。音に反応する映像と文字は重ねて表示されます。</p>
      </>}
    </fieldset>
    <p className="bitmap-fine-note">Shiftを押しながらスライダーをドラッグすると微調整できます。</p>
  </section>;
}
