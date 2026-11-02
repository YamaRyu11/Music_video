import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, AudioLines, Check, CheckCircle2, CircleHelp,
  FileAudio, FolderOpen, HardDrive, Headphones, LoaderCircle, Maximize2, Monitor, Pause, Play,
  Search, Smartphone, Upload, Volume2, X } from 'lucide-react';
import { defaultSettings, defaultBitmapSettings, dimensions, formatTime, MAX_DURATION, MAX_FILE_BYTES, MAX_BITMAP_BYTES,
  type Analysis, type AudioAsset, type BitmapAsset, type ExportProgress, type LayerTarget, type VisualSettings } from './shared';
import { hitTestText, renderScene } from './visuals/render';
import { styles, styleCategories, type StyleCategory } from './visuals/catalog';
import { Customizer, type CustomizerTab } from './components/Customizer';
import { LayerToolbar } from './components/LayerToolbar';
import { version } from '../package.json';
import { STYLE_DRAG_TYPE } from './visuals/style-drag';
import { StyleArt } from './components/StyleArt';
import { RangeInput } from './components/Slider';
import { decodeBitmap, type DecodedBitmap } from './visuals/bitmap';

function Waveform({ peaks, progress }: { peaks?: number[]; progress: number }) {
  return <div className="waveform" aria-hidden="true">{Array.from({ length: 90 }, (_, i) => {
    const height = peaks ? Math.max(6, peaks[i * 2] * 100) : 10 + Math.sin(i * 1.7) ** 2 * 24;
    return <i key={i} className={i / 90 <= progress ? 'passed' : ''} style={{ height: `${height}%` }} />;
  })}</div>;
}

export function App() {
  const [settings, setSettings] = useState<VisualSettings>(defaultSettings);
  const [selectedLayer, setSelectedLayer] = useState<LayerTarget>('base');
  const [activeTab, setActiveTab] = useState<CustomizerTab>('color');
  const [textTarget, setTextTarget] = useState<'titleDesign' | 'artistDesign'>('titleDesign');
  const selectLayer = (layer: LayerTarget) => { setSelectedLayer(layer); setActiveTab('color'); };
  const editText = (target: 'titleDesign' | 'artistDesign') => { setTextTarget(target); setActiveTab('text'); };
  const [analysis, setAnalysis] = useState<Analysis>();
  const [asset, setAsset] = useState<{ id?: string; name: string; url: string }>();
  const [bitmap, setBitmap] = useState<{ id?: string; name: string; source: DecodedBitmap }>();
  const [bitmapBusy, setBitmapBusy] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [drag, setDrag] = useState(false);
  const [draggingStyle, setDraggingStyle] = useState(false);
  const [category, setCategory] = useState<StyleCategory>('all');
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportProgress>();
  const [help, setHelp] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null), preview = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null), input = useRef<HTMLInputElement>(null), bitmapInput = useRef<HTMLInputElement>(null);
  const analyzer = useRef<Worker | null>(null), generation = useRef(0);
  const currentAsset = useRef(asset); currentAsset.current = asset;
  const busyRef = useRef(false);
  const bitmapBusyRef = useRef(false), choosingBitmap = useRef(false);
  const update = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => setSettings(s => ({ ...s, [key]: value }));

  const loadAudio = useCallback(async (file: File, desktopAsset?: AudioAsset) => {
    if (busyRef.current) return;
    if (!/\.(wav|mp3)$/i.test(file.name)) { setError('WAV または MP3 ファイルを選んでください。'); return; }
    if (file.size > MAX_FILE_BYTES) { setError('音源は250 MB以下のファイルを選んでください。'); return; }
    busyRef.current = true; const token = ++generation.current;
    setError(''); setBusy(0); setPlaying(false); audio.current?.pause();
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      if (decoded.duration > MAX_DURATION) throw new Error('初版では10分以内の音源に対応しています。');
      const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i).slice());
      const worker = new Worker(new URL('./audio/analysis.worker.ts', import.meta.url), { type: 'module' });
      analyzer.current = worker;
      const result = await new Promise<Analysis>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<{ progress?: number; result?: Analysis; error?: string }>) => {
          if (event.data.error) reject(new Error(event.data.error));
          else if (event.data.result) resolve(event.data.result);
          else if (event.data.progress !== undefined) setBusy(event.data.progress);
        };
        worker.onerror = () => reject(new Error('解析処理を実行できませんでした。'));
        worker.postMessage({ channels, sampleRate: decoded.sampleRate }, channels.map(c => c.buffer));
      });
      worker.terminate(); analyzer.current = null;
      if (token !== generation.current) return;
      const old = currentAsset.current;
      if (old) { URL.revokeObjectURL(old.url); if (old.id) void window.studio?.releaseAudio(old.id); }
      setAnalysis(result); setAsset({ id: desktopAsset?.id, name: file.name, url: URL.createObjectURL(file) });
      setTime(0); setExportStatus(undefined);
      setSettings(s => ({ ...s, title: file.name.replace(/\.(wav|mp3)$/i, '').replace(/[-_]/g, ' ').slice(0, 100) }));
    } catch (err) {
      setError(err instanceof Error && !/decode|encoding/i.test(err.message) ? err.message : '音声を読み込めませんでした。ファイルが破損していないか確認してください。');
      if (desktopAsset) void window.studio?.releaseAudio(desktopAsset.id);
    } finally { await context?.close(); analyzer.current?.terminate(); analyzer.current = null; setBusy(null); busyRef.current = false; }
  }, []);

  async function importDesktop(value: AudioAsset | null) {
    if (value) await loadAudio(new File([Uint8Array.from(value.bytes)], value.name), value);
  }
  const loadBitmap = useCallback(async (file: File, desktopAsset?: BitmapAsset) => {
    if (bitmapBusyRef.current) { if (desktopAsset) void window.studio?.releaseBitmap(desktopAsset.id); return; }
    if (!/\.(png|jpe?g|webp|bmp)$/i.test(file.name) || file.size > MAX_BITMAP_BYTES || !file.size) {
      setError('背景画像は25 MB以下のPNG / JPEG / WebP / BMPを選んでください。');
      if (desktopAsset) void window.studio?.releaseBitmap(desktopAsset.id);
      return;
    }
    bitmapBusyRef.current = true; setBitmapBusy(true); setError('');
    try {
      const ext = file.name.split('.').at(-1)?.toLowerCase();
      const mime = desktopAsset?.mime || file.type || (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`);
      const source = await decodeBitmap(new Uint8Array(await file.arrayBuffer()), mime);
      setSettings(s => ({ ...s, bitmap: structuredClone(defaultBitmapSettings) }));
      setBitmap({ id: desktopAsset?.id, name: file.name, source }); setActiveTab('bitmap'); setExportStatus(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '背景画像を読み込めませんでした。');
      if (desktopAsset) void window.studio?.releaseBitmap(desktopAsset.id);
    } finally { bitmapBusyRef.current = false; setBitmapBusy(false); }
  }, []);
  async function importDesktopBitmap(value: BitmapAsset | null) {
    if (value) await loadBitmap(new File([Uint8Array.from(value.bytes)], value.name, { type: value.mime }), value);
  }
  async function chooseBitmap() {
    if (bitmapBusyRef.current || choosingBitmap.current || exporting) return;
    if (!window.studio) { bitmapInput.current?.click(); return; }
    choosingBitmap.current = true;
    try { await importDesktopBitmap(await window.studio.chooseBitmap()); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { choosingBitmap.current = false; }
  }
  async function chooseAudio() {
    if (busyRef.current || exporting) return;
    if (window.studio) { try { await importDesktop(await window.studio.chooseAudio()); } catch (e) { setError(String(e)); } }
    else input.current?.click();
  }
  async function loadDemo() {
    if (busyRef.current || exporting) return;
    try {
      if (window.studio) await importDesktop(await window.studio.loadDemo());
      else { const res = await fetch('./demo.wav'); if (!res.ok) throw new Error('サンプル音源を読み込めませんでした。'); await loadAudio(new File([await res.blob()], 'Midnight Bloom.wav')); }
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  useEffect(() => {
    return window.studio?.onExportProgress(event => {
      setExportStatus(event);
      if (['complete', 'cancelled', 'error'].includes(event.state)) setExporting(false);
    });
  }, []);
  useEffect(() => () => { generation.current++; analyzer.current?.terminate(); if (currentAsset.current) URL.revokeObjectURL(currentAsset.current.url); }, []);
  useEffect(() => () => {
    bitmap?.source.image.close(); if (bitmap?.id) void window.studio?.releaseBitmap(bitmap.id);
  }, [bitmap]);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const c = canvas.current, a = audio.current;
      if (c) {
        const ctx = c.getContext('2d', { alpha: false });
        const [w, h] = dimensions(settings.aspect);
        const targetWidth = settings.aspect === 'portrait' ? 432 : 960;
        const targetHeight = Math.round(targetWidth * h / w);
        if (c.width !== targetWidth || c.height !== targetHeight) { c.width = targetWidth; c.height = targetHeight; }
        if (ctx) renderScene(ctx, c.width, c.height, a && asset ? a.currentTime : 0, settings, analysis, bitmap?.source);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analysis, settings, asset, bitmap]);

  async function togglePlay() {
    if (!audio.current || !asset) return;
    if (playing) audio.current.pause();
    else {
      if (audio.current.ended) audio.current.currentTime = 0;
      try { await audio.current.play(); } catch { setError('再生を開始できませんでした。音源を選び直してください。'); }
    }
  }
  function seek(value: number) { if (audio.current) { audio.current.currentTime = value; setTime(value); } }
  async function startExport() {
    if (!window.studio || !asset?.id || !analysis || exporting) return;
    audio.current?.pause(); setError(''); setExporting(true); setExportStatus(undefined);
    try {
      const started = await window.studio.startExport({ assetId: asset.id, analysis, settings, bitmapId: bitmap?.id });
      if (!started) setExporting(false);
    } catch (err) { setExporting(false); setError(err instanceof Error ? err.message : String(err)); }
  }
  const duration = analysis?.duration ?? 0;
  const selected = styles.find(s => s.id === settings.style)!;
  const selectedStyle = selectedLayer === 'base' ? settings.style : settings.overlay.style;
  const visibleStyles = styles.filter(s => (category === 'all' || s.category === category)
    && `${s.title} ${s.subtitle}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const locked = exporting || busy !== null || bitmapBusy;
  const progress = exportStatus && 'progress' in exportStatus ? exportStatus.progress : 0;

  return <div className="app-shell" onDragOver={e => {
    if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); if (!locked) setDrag(true); }
  }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }}
    onDrop={async e => {
      e.preventDefault(); setDrag(false); if (locked || !e.dataTransfer.types.includes('Files')) return;
      const file = e.dataTransfer.files[0]; if (!file) return;
      try {
        if (/\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
          if (window.studio) await importDesktopBitmap(await window.studio.importBitmapDrop(file)); else await loadBitmap(file);
        } else if (window.studio) await importDesktop(await window.studio.importDrop(file)); else await loadAudio(file);
      }
      catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    }}>
    <input className="sr-only" ref={input} type="file" accept=".wav,.mp3,audio/wav,audio/mpeg"
      onChange={e => { const file = e.target.files?.[0]; if (file) void loadAudio(file); e.target.value = ''; }} aria-label="音源ファイル" />
    <input className="sr-only" ref={bitmapInput} type="file" accept=".png,.jpg,.jpeg,.webp,.bmp,image/png,image/jpeg,image/webp,image/bmp"
      disabled={locked} onChange={e => { const file = e.target.files?.[0]; if (file) void loadBitmap(file); e.target.value = ''; }} aria-label="背景画像ファイル" />
    <audio ref={audio} src={asset?.url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)} onTimeUpdate={() => setTime(audio.current?.currentTime ?? 0)} />
    <header className="topbar">
      <div className="brand-row"><a className="brand" href="#" aria-label="Music Video Studio"><span className="brand-symbol"><AudioLines size={22} /></span><span>Music Video <b>Studio</b></span><span className="version">BETA</span></a>
        <div className="top-actions"><div className="aspect-switch" aria-label="動画の向き"><button disabled={exporting} aria-pressed={settings.aspect === 'landscape'} className={settings.aspect === 'landscape' ? 'active' : ''} onClick={() => update('aspect', 'landscape')}><Monitor size={14} />横 16:9</button><button disabled={exporting} aria-pressed={settings.aspect === 'portrait'} className={settings.aspect === 'portrait' ? 'active' : ''} onClick={() => update('aspect', 'portrait')}><Smartphone size={14} />縦 9:16</button></div><button className="icon-button help-button" onClick={() => setHelp(!help)} aria-label="使い方"><CircleHelp size={18} /></button></div>
      </div>
      <LayerToolbar settings={settings} onChange={setSettings} selectedLayer={activeTab === 'color' ? selectedLayer : undefined} onSelectLayer={selectLayer}
        bitmapSelected={activeTab === 'bitmap'} textSelected={activeTab === 'text'} textTarget={textTarget} onEditText={editText}
        disabled={exporting} draggingStyle={draggingStyle} bitmapBusy={bitmapBusy}
        bitmapAsset={bitmap ? { name: bitmap.name, width: bitmap.source.width, height: bitmap.source.height } : undefined}
        onChooseBitmap={chooseBitmap} onEditBitmap={() => setActiveTab('bitmap')} onRemoveBitmap={() => setBitmap(undefined)} />
    </header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-heading"><span className="eyebrow">YOUR WORKSPACE</span><span className="project-dot" /></div>
        <h1>音楽を、映像に。</h1><p className="intro">あなたの音に、動きと色を。</p>
        <section className="audio-section">
          <h2><span className="step">01</span>音源を追加</h2>
          <button className={`drop-zone ${asset ? 'has-audio' : ''}`} onClick={chooseAudio} disabled={locked}>
            <span className="upload-icon">{busy !== null ? <LoaderCircle className="spin" size={22} /> : asset ? <FileAudio size={23} /> : <Upload size={22} />}</span>
            <strong>{busy !== null ? `音を解析しています… ${Math.round(busy * 100)}%` : asset ? asset.name : '音源をドロップ'}</strong>
            <span>{asset ? `${formatTime(duration)} · クリックして変更` : 'またはクリックしてファイルを選択'}</span>
            <small>WAV / MP3 · 最大250 MB・10分</small>
          </button>
          {!asset && busy === null && <button className="demo-link" onClick={loadDemo} disabled={locked}><Headphones size={14} />サンプル音源で試す<ArrowRight size={13} /></button>}
        </section>
        <section className="styles-section">
          <h2><span className="step">02</span>スタイルを選ぶ<span className="section-count" aria-label="表示スタイル数">{visibleStyles.length === styles.length ? styles.length : `${visibleStyles.length}/${styles.length}`} STYLES</span></h2>
          <div className="style-library-controls">
            <select aria-label="スタイルカテゴリ" value={category} onChange={e => setCategory(e.target.value as StyleCategory)}>{styleCategories.map(c => <option key={c.id} value={c.id}>{c.label}{c.id === 'all' ? `（${styles.length}）` : ''}</option>)}</select>
            <label className="style-search"><Search size={12} /><input aria-label="スタイルを検索" placeholder="スタイルを検索" value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="検索をクリア" onClick={() => setQuery('')}><X size={12} /></button>}</label>
          </div>
          <p className="style-drag-hint">レイヤー{selectedLayer === 'base' ? '01' : '02'}に適用 · 01 / 02 へドラッグもできます</p>
          <div className="style-list">{visibleStyles.map(s => <button key={s.id} className={`style-card ${selectedStyle === s.id ? 'selected' : ''}`}
            aria-label={`${s.title} ${s.subtitle}`}
            draggable={!exporting} title={`${s.title} · ${s.subtitle} · 01 / 02 へドラッグ`}
            onDragStart={e => {
              if (exporting) { e.preventDefault(); return; }
              e.dataTransfer.setData(STYLE_DRAG_TYPE, s.id); e.dataTransfer.effectAllowed = 'copy';
              setDraggingStyle(true);
            }} onDragEnd={() => setDraggingStyle(false)}
            disabled={exporting} aria-pressed={selectedStyle === s.id} onClick={() => { selectLayer(selectedLayer); setSettings(current => selectedLayer === 'base'
              ? { ...current, style: s.id } : { ...current, overlay: { ...current.overlay, style: s.id } }); }}>
            <StyleArt kind={s.className} /><span className="style-info"><strong>{s.title}</strong><small>{s.subtitle}</small></span>
            <span className="style-check">{selectedStyle === s.id && <Check size={12} />}</span>
          </button>)}</div>
          {!visibleStyles.length && <p className="style-empty" role="status">一致するスタイルがありません</p>}
        </section>
        <div className="sidebar-bottom"><HardDrive size={15} /><div><strong>ローカルで完結</strong><span>音源は外部へ送信されません</span></div></div>
      </aside>

      <main className={`main-content ${settings.aspect}`}>
        {(error || exportStatus?.state === 'error') && <div className="error-message" role="alert"><span>{error || (exportStatus?.state === 'error' ? exportStatus.message : '')}</span><button aria-label="エラーを閉じる" onClick={() => { setError(''); setExportStatus(undefined); }}><X size={16} /></button></div>}
        <div className="editor-grid">
        <section className="preview-column" aria-label="映像プレビューと再生">
        <div className={`preview-stage ${settings.aspect}`} ref={preview}>
          <canvas ref={canvas} onClick={e => {
            if (exporting) return; const c = e.currentTarget, bounds = c.getBoundingClientRect();
            const target = hitTestText(c.getContext('2d')!, c.width, c.height, audio.current?.currentTime ?? 0, settings, analysis, (e.clientX - bounds.left) * c.width / bounds.width, (e.clientY - bounds.top) * c.height / bounds.height);
            if (target) editText(target);
          }} aria-label={`${selected.title} の映像プレビュー`} />
          <div className="preview-top"><span><span className="status-dot" />{selected.title}</span><span>{settings.aspect === 'portrait' ? '1080 × 1920' : '1920 × 1080'}</span></div>
          <button className="fullscreen icon-button" title="プレビューを全画面表示" aria-label="プレビューを全画面表示" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void preview.current?.requestFullscreen(); }}><Maximize2 size={17} /></button>
        </div>
        <div className="transport">
          <button className="play-button" onClick={togglePlay} disabled={!asset || locked} aria-label={playing ? '一時停止' : '再生'}>{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button>
          <span className="time-current">{formatTime(time)}</span>
          <div className="timeline"><Waveform peaks={analysis?.peaks} progress={duration ? time / duration : 0} /><RangeInput aria-label="再生位置" min={0} max={duration || 1} step={.01} value={Math.min(time, duration)} disabled={!asset || locked} onValueChange={seek} /></div>
          <span className="time-total">{formatTime(duration)}</span><Volume2 className="volume-icon" size={17} />
        </div>
        </section>

        <Customizer settings={settings} onChange={setSettings} selectedLayer={selectedLayer} activeTab={activeTab} textTarget={textTarget} disabled={exporting}
          bitmapAsset={bitmap ? { name: bitmap.name, width: bitmap.source.width, height: bitmap.source.height } : undefined}
          bitmapBusy={bitmapBusy} onChooseBitmap={chooseBitmap} onRemoveBitmap={() => setBitmap(undefined)} />
        </div>

        <div className="export-dock">
        <section className="export-panel">
          <div className="export-format"><span className="export-icon"><ArrowDownToLine size={20} /></span><div><h3>この音を、一本の映像に。</h3><p>MP4 <span>·</span> H.264 / AAC <span>·</span> フルHD / 30fps</p></div></div>
          <button className="export-button" onClick={startExport} disabled={!asset?.id || !analysis || locked || !window.studio}>{exporting ? <LoaderCircle size={17} className="spin" /> : <ArrowDownToLine size={17} />}{exporting ? '書き出し中…' : '動画を書き出す'}{!exporting && <ArrowRight size={17} />}</button>
        </section>
        {!window.studio && <p className="browser-note"><Monitor size={13} />ブラウザではプレビューをお試しいただけます。MP4出力はデスクトップ版で利用できます。</p>}
        {exporting && <div className="export-progress" role="status"><div><span>{exportStatus?.state === 'encoding' ? '音声と映像をまとめています…' : `映像を生成しています… ${Math.round(progress * 100)}%`}</span><button onClick={() => void window.studio?.cancelExport()}>キャンセル<X size={13} /></button></div><progress max="1" value={progress} /></div>}
        {exportStatus?.state === 'complete' && <div className="success-message" role="status"><CheckCircle2 size={18} /><span>動画を書き出しました。</span><button onClick={() => void window.studio?.revealOutput()}>保存先を開く<FolderOpen size={14} /></button></div>}
        {exportStatus?.state === 'cancelled' && <p className="cancel-message" role="status">書き出しをキャンセルしました。</p>}
        </div>
        <footer><span>CREATED BY YOU. POWERED BY SOUND.</span><span>Music Video Studio <span className="footer-version">v{version}</span></span></footer>
      </main>
    </div>
    {drag && <div className="drag-overlay"><div><Upload size={40} /><h2>音源・背景画像をここにドロップ</h2><p>WAV / MP3 / PNG / JPEG / WebP / BMP</p></div></div>}
    {help && <div className="modal-scrim" onClick={() => setHelp(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}>
      <button className="icon-button modal-close" onClick={() => setHelp(false)} aria-label="閉じる"><X size={19} /></button><span className="eyebrow">QUICK START</span><h2 id="help-title">音から、あなただけの映像を。</h2>
      <ol><li>WAV / MP3 をドロップ、またはサンプル音源を選択。</li>
        <li>ヘッダーの01 / 02で編集するレイヤーを選択。左の{styles.length}種類のスタイルを選ぶか、01 / 02へドラッグします。</li>
        <li>各レイヤーのメイン・サブカラーや02の合成方法・不透明度はヘッダーで、「カラー・動き」では反応や線の太さも調整できます。</li>
        <li>00に背景画像を追加。「背景ビットマップ」で配置・トリミング・エフェクトを調整します。</li>
        <li>プレビューの文字、または03のタイトル／アーティストを選んで文字をデザイン。再生して確認し、MP4を書き出します。</li></ol>
      <p>低音は大きな動き、高音は細かな変化、アタックは瞬間的な輝きに。音源はPC内で処理されます。</p><p>Shiftを押しながらスライダーをドラッグすると、10倍細かく調整できます。音源は250 MB・10分まで、出力は30fpsです。</p>
      <button className="primary-button" onClick={() => setHelp(false)}>つくりはじめる<ArrowRight size={16} /></button></section></div>}
  </div>;
}
