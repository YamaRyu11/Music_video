import {useState} from 'react';
import {Popup} from './Popup';
import {Slider} from './Slider';
import {defaultEncoding,encodingPresets,estimatedMegabytes,type EncodingSettings} from '../export/settings';
export function ExportDialog({value,duration,desktop,exportNow,onClose,onConfirm}:{value:EncodingSettings;duration:number;desktop:boolean;exportNow:boolean;onClose:()=>void;onConfirm:(s:EncodingSettings)=>void}) {
 const [draft,setDraft]=useState(value);
 const update=<K extends keyof EncodingSettings>(key:K,value:EncodingSettings[K])=>setDraft(s=>({...s,[key]:value}));
 const estimate=estimatedMegabytes(draft,duration);
 return <Popup title="書き出し設定" onClose={onClose} className="export-settings-dialog">
  <p className="field-note">MP4 · H.264 / AAC · フルHD / 30fps</p>
  <div className="encoding-presets">{encodingPresets.map(p=><button key={p.name} aria-pressed={JSON.stringify(p.settings)===JSON.stringify(draft)} onClick={()=>setDraft({...p.settings})}>{p.name}</button>)}</div>
  <label className="encoding-select">映像の圧縮方式<select aria-label="映像の圧縮方式" value={draft.mode} onChange={e=>update('mode',e.target.value as EncodingSettings['mode'])}><option value="quality">画質優先（CRF）</option><option value="bitrate">平均ビットレート指定</option></select></label>
  {draft.mode==='quality'?<><Slider label="映像のCRF" value={draft.crf} defaultValue={defaultEncoding.crf} min={14} max={30} step={1} scale={1} suffix="" onChange={v=>update('crf',v)}/><p className="field-note">小さい値ほど高画質・大容量です。動きや細かな線の量で容量が変わります。</p></>:<><Slider label="映像のビットレート" value={draft.videoBitrate} defaultValue={defaultEncoding.videoBitrate} min={1} max={50} step={.5} scale={1} suffix=" Mbps" onChange={v=>update('videoBitrate',v)}/><p className="field-note">{duration>0?<>音声込みで約{estimate?.toFixed(1)} MBの目安です。実際の容量は変動します。</>:'音源を選ぶと、音声込みの容量の目安を表示します。'}</p></>}
  <label className="encoding-select">音声の音質<select aria-label="音声のビットレート" value={draft.audioBitrate} onChange={e=>update('audioBitrate',Number(e.target.value) as EncodingSettings['audioBitrate'])}>{[128,192,256,320].map(v=><option key={v} value={v}>AAC {v} kbps</option>)}</select></label>
  <label className="encoding-select">圧縮の処理速度<select aria-label="圧縮の処理速度" value={draft.preset} onChange={e=>update('preset',e.target.value as EncodingSettings['preset'])}><option value="veryfast">高速</option><option value="fast">速い（標準）</option><option value="medium">標準速度</option><option value="slow">時間をかけて圧縮</option></select></label>
  <p className="field-note">画質優先では、時間をかけるほど同程度の画質で小さくできる傾向があります。</p>
  {!desktop&&<p className="field-note">ブラウザでは設定を保存できます。MP4出力はデスクトップ版で利用できます。</p>}
  <div className="encoding-actions"><button onClick={onClose}>キャンセル</button><button className="primary-button" onClick={()=>onConfirm(draft)}>{exportNow?'この設定で書き出す':'設定を保存'}</button></div>
 </Popup>;
}
