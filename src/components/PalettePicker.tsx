import { useState } from 'react';
import { Check, Palette as PaletteIcon } from 'lucide-react';
import { palettes, backgrounds, type Palette } from '../colors/presets';
import { Popup } from './Popup';
export function PalettePicker({ primary, secondary, onChoose, disabled=false }: { primary:string;secondary:string;onChoose:(p:Palette)=>void;disabled?:boolean }) {
  const [open,setOpen]=useState(false),[filter,setFilter]=useState('すべて'),[query,setQuery]=useState('');
  const chosen=palettes.find(p=>p.primary===primary&&p.secondary===secondary);
  const select=(p:Palette)=>{onChoose(p);setOpen(false);};
  return <><div className="palette-presets compact-palettes">{palettes.slice(0,3).map(p=><button key={p.name} aria-label={p.name} className="palette-preset" disabled={disabled} onClick={()=>select(p)}><span style={{background:`linear-gradient(120deg,${p.primary},${p.secondary})`}}/>{p.name}</button>)}
    <button className="palette-more" disabled={disabled} aria-label="配色プリセットを選ぶ" aria-haspopup="dialog" onClick={()=>setOpen(true)}><PaletteIcon size={12}/>全{palettes.length}配色</button></div>
    <p className="selected-palette-name">配色：{chosen ? `${chosen.name} · ${chosen.label}` : 'カスタム'}</p>
    {open&&!disabled&&<Popup title="配色プリセット" onClose={()=>setOpen(false)} className="palette-browser">
      <p className="color-editor-note">名前と説明から選べます。選択中レイヤーのメイン／サブの2色だけを変更します。</p>
      <div className="palette-browser-tools"><label>種類<select aria-label="配色の種類" value={filter} onChange={e=>setFilter(e.target.value)}>{['すべて',...new Set(palettes.map(p=>p.group))].map(g=><option key={g}>{g}</option>)}</select></label><input aria-label="配色プリセットを検索" placeholder="名前・説明で検索" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <div className="palette-options">{palettes.filter(p=>(filter==='すべて'||p.group===filter)&&`${p.name} ${p.label} ${p.description}`.toLowerCase().includes(query.toLowerCase())).map(p=><button key={p.name} aria-label={p.name} aria-pressed={chosen===p} className="palette-option" onClick={()=>select(p)}>
        <div className="palette-pair"><span style={{background:p.primary}}>メイン</span><span style={{background:p.secondary}}>サブ</span></div><strong>{p.name}{chosen===p&&<Check size={13}/>}</strong><span>{p.label}</span><small>{p.description}</small>
      </button>)}</div>
    </Popup>}
  </>;
}
export function BackgroundPresets({ color,onChoose,disabled=false }: {color:string;onChoose:(color:string)=>void;disabled?:boolean}) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState('');
  const chosen=backgrounds.find(p=>p.color===color);
  return <><button className="background-preset-trigger" disabled={disabled} aria-label="背景色プリセットを選ぶ" onClick={()=>setOpen(true)}><PaletteIcon size={15}/>背景色プリセット · 全{backgrounds.length}色</button><p className="selected-palette-name">{chosen?`${chosen.name} · ${chosen.label}：${chosen.description}`:'カスタム背景色'}</p>
    {open&&!disabled&&<Popup title="背景色プリセット" onClose={()=>setOpen(false)} className="palette-browser">
      <p className="color-editor-note">暗い背景は明るい線を、明るい背景は暗い線を見せやすくします。</p><input className="background-search" aria-label="背景色プリセットを検索" placeholder="名前・説明で検索" value={query} onChange={e=>setQuery(e.target.value)}/>
      <div className="palette-options">{backgrounds.filter(p=>`${p.name} ${p.label} ${p.description}`.toLowerCase().includes(query.toLowerCase())).map(p=><button key={p.name} aria-label={p.name} aria-pressed={color===p.color} className="palette-option" onClick={()=>{onChoose(p.color);setOpen(false);}}><div className="background-swatch" style={{background:p.color}}/><strong>{p.name}{color===p.color&&<Check size={13}/>}</strong><span>{p.label}</span><small>{p.description}</small></button>)}</div>
    </Popup>}
  </>;
}
