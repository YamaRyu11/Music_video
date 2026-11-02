import { useEffect, useState, type Dispatch, type DragEvent, type SetStateAction } from 'react';
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import type { LayerControls, LayerTarget, StyleId, VisualSettings } from '../shared';
import { ColorInput } from './ColorInput';
import { styles } from '../visuals/catalog';
import { droppedStyle, isStyleDrag } from '../visuals/style-drag';


function LayerCard({ slot, selected, style, controls, disabled, draggingStyle, onSelect, onStyle, onColors }: {
  slot: '01' | '02'; selected: boolean; style: StyleId | 'none'; controls: LayerControls;
  disabled: boolean; draggingStyle: boolean; onSelect: () => void;
  onStyle: (style: StyleId | 'none') => void; onColors: (colors: Partial<Pick<LayerControls, 'color' | 'secondaryColor'>>) => void;
}) {
  const [hover, setHover] = useState(false);
  useEffect(() => { if (!draggingStyle || disabled) setHover(false); }, [draggingStyle, disabled]);
  const acceptStyleDrag = (event: DragEvent<HTMLDivElement>) => {
    if (disabled || !isStyleDrag(event.dataTransfer)) return;
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; setHover(true);
  };
  return <div role="group" aria-label={`レイヤー ${slot}`} data-layer-slot={slot}
    className={`header-layer-card header-style-card ${selected ? 'selected' : ''} ${hover ? 'drop-target' : ''}`}
    onClick={() => { if (!disabled) onSelect(); }}
    onDragEnter={acceptStyleDrag} onDragOver={acceptStyleDrag}
    onDragLeave={event => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      // Native controls may omit relatedTarget while the pointer is still in this card.
      if (event.clientX >= bounds.left && event.clientX < bounds.right
        && event.clientY >= bounds.top && event.clientY < bounds.bottom) return;
      setHover(false);
    }}
    onDrop={event => {
      setHover(false); if (!isStyleDrag(event.dataTransfer)) return;
      event.preventDefault(); event.stopPropagation(); if (disabled) return;
      const dropped = droppedStyle(event.dataTransfer);
      if (dropped) { onSelect(); onStyle(dropped); }
    }}>
    <div className="header-layer-top">
      <button className="header-layer-edit layer-number" aria-label={`レイヤー${slot}を編集`} aria-pressed={selected}
        title={`レイヤー${slot}を編集`} disabled={disabled} onClick={event => { event.stopPropagation(); onSelect(); }}>{slot}</button>
      <select aria-label={slot === '01' ? 'ベースのスタイル' : '重ねるスタイル'} value={style} disabled={disabled}
        onChange={event => { onSelect(); onStyle(event.target.value as StyleId | 'none'); }}>
        {slot === '02' && <option value="none">なし（合成しない）</option>}
        {styles.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
    </div>
    <div className="header-layer-bottom"><span>{slot === '01' ? 'ベース' : '重ねる映像'}</span>
      <div className="header-layer-colors">
        <label><span>メイン</span><ColorInput label={`レイヤー${slot}のメインカラー`} value={controls.color} disabled={disabled} onOpen={onSelect}
          onChange={v => { onSelect(); onColors({ color: v }); }} /></label>
        <label><span>サブ</span><ColorInput label={`レイヤー${slot}のサブカラー`} value={controls.secondaryColor} disabled={disabled} onOpen={onSelect}
          onChange={v => { onSelect(); onColors({ secondaryColor: v }); }} /></label>
      </div>
    </div>
  </div>;
}

export function LayerToolbar({ settings, onChange, selectedLayer, onSelectLayer, disabled, draggingStyle,
  bitmapAsset, bitmapBusy, onChooseBitmap, onEditBitmap, onRemoveBitmap, backgroundSelected, onEditBackground, bitmapSelected, textSelected, textTarget, onEditText }: {
  settings: VisualSettings; onChange: Dispatch<SetStateAction<VisualSettings>>;
  selectedLayer?: LayerTarget; onSelectLayer: (layer: LayerTarget) => void;
  disabled: boolean; draggingStyle: boolean; bitmapAsset?: { name: string; width: number; height: number };
  backgroundSelected: boolean; onEditBackground:()=>void;
  bitmapSelected: boolean; textSelected: boolean; textTarget: 'titleDesign' | 'artistDesign'; onEditText: (target: 'titleDesign' | 'artistDesign') => void;
  bitmapBusy: boolean; onChooseBitmap: () => void; onEditBitmap: () => void; onRemoveBitmap: () => void;
}) {
  const updateOverlay = <K extends keyof VisualSettings['overlay']>(key: K, value: VisualSettings['overlay'][K]) =>
    onChange(current => ({ ...current, overlay: { ...current.overlay, [key]: value } }));
  const imageLocked = disabled || bitmapBusy;
  return <section className="layer-toolbar" aria-label="レイヤー合成">
    <div className={`header-layer-card shared-background ${backgroundSelected ? 'selected' : ''}`} onClick={()=>{if(!disabled)onEditBackground();}}>
      <button aria-label="背景色を編集" aria-pressed={backgroundSelected} disabled={disabled} onClick={onEditBackground}>背景色</button>
      <ColorInput label="背景色" value={settings.backgroundColor} disabled={disabled} onOpen={onEditBackground} onChange={v=>onChange(s=>({...s,backgroundColor:v}))}/>
    </div>
    <div className={`header-layer-card header-bitmap-card ${bitmapSelected ? 'selected' : ''}`} onClick={() => { if (!disabled) onEditBitmap(); }}>
      <div className="header-layer-top"><span className="layer-number">00</span>
        <button className="header-bitmap-edit" aria-label="背景ビットマップを編集" aria-pressed={bitmapSelected} disabled={disabled} onClick={onEditBitmap}
          title={bitmapAsset ? `${bitmapAsset.name} · ${bitmapAsset.width} × ${bitmapAsset.height} px` : '背景ビットマップを編集'}>
          <strong>背景ビットマップ</strong><small>{bitmapBusy ? '読み込み中…' : bitmapAsset?.name || '画像なし'}</small>
        </button>
      </div>
      <div className="header-bitmap-actions">
        <button aria-label="背景画像を追加・変更" title="背景画像を追加・変更" disabled={imageLocked} onClick={onChooseBitmap}>
          {bitmapBusy ? <LoaderCircle className="spin" size={13} /> : <ImagePlus size={13} />}<span>{bitmapAsset ? '画像を変更' : '画像を追加'}</span>
        </button>
        <label><input type="checkbox" aria-label="背景レイヤーを表示" checked={settings.bitmap.enabled} disabled={!bitmapAsset || imageLocked}
          onChange={event => onChange(current => ({ ...current, bitmap: { ...current.bitmap, enabled: event.target.checked } }))} />表示</label>
        <button className="header-bitmap-remove" aria-label="背景レイヤーを削除" title="背景レイヤーを削除" disabled={!bitmapAsset || imageLocked} onClick={onRemoveBitmap}><Trash2 size={13} /></button>
      </div>
    </div>
    <LayerCard slot="01" selected={selectedLayer === 'base'} style={settings.style} controls={settings} disabled={disabled} draggingStyle={draggingStyle}
      onSelect={() => onSelectLayer('base')} onStyle={style => { if (style !== 'none') onChange(current => ({ ...current, style })); }}
      onColors={colors => onChange(current => ({ ...current, ...colors }))} />
    <LayerCard slot="02" selected={selectedLayer === 'overlay'} style={settings.overlay.style} controls={settings.overlay} disabled={disabled} draggingStyle={draggingStyle}
      onSelect={() => onSelectLayer('overlay')} onStyle={style => updateOverlay('style', style)}
      onColors={colors => onChange(current => ({ ...current, overlay: { ...current.overlay, ...colors } }))} />
    <div className={`header-layer-card header-text-card ${textSelected ? 'selected' : ''}`} onClick={e => { if (!disabled && !(e.target as HTMLElement).closest('button')) onEditText(textTarget); }}>
      <strong>03 テキスト</strong><div><button disabled={disabled} aria-label="タイトルを編集" aria-pressed={textSelected && textTarget === 'titleDesign'} onClick={() => onEditText('titleDesign')}>タイトル</button><button disabled={disabled} aria-label="アーティストを編集" aria-pressed={textSelected && textTarget === 'artistDesign'} onClick={() => onEditText('artistDesign')}>アーティスト</button></div>
    </div>
  </section>;
}
