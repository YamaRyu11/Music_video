function NewStyleArt({ kind }: { kind: string }) {
  return <svg viewBox="0 0 64 48" fill="none" stroke="#b8f36b" strokeWidth="1" aria-hidden="true">
    {kind === 'art-laser' && <>{[-24, 0, 16, 32, 48, 64, 88].map(x => <path key={x} d={`M32 10L${x} 48`} opacity=".7" />)}{[18, 24, 33, 45].map(y => <path key={y} d={`M0 ${y}H64`} opacity=".5" />)}</>}
    {kind === 'art-bloom' && Array.from({ length: 8 }, (_, i) => <ellipse key={i} cx="32" cy="16" rx="6" ry="13" transform={`rotate(${i * 45} 32 24)`} opacity=".6" />)}
    {kind === 'art-stars' && Array.from({ length: 15 }, (_, i) => { const a = i * 2.399, r = 8 + i % 5 * 4; return <path key={i} d={`M${32 + Math.cos(a) * r} ${24 + Math.sin(a) * r}l${Math.cos(a) * 6} ${Math.sin(a) * 6}`} opacity={.3 + i % 4 * .15} />; })}
    {kind === 'art-ink' && <><path d="M12 9C26 0 28 15 43 10S66 28 48 38S22 42 14 29S0 18 12 9Z" fill="#b8f36b" fillOpacity=".35" strokeOpacity=".65" /><path d="M21 13C39 0 50 24 37 35S10 28 21 13Z" fill="#67e8d0" fillOpacity=".3" /></>}
    {kind === 'art-kaleidoscope' && Array.from({ length: 8 }, (_, i) => <path key={i} d="M32 24L37 5L49 16Z" transform={`rotate(${i * 45} 32 24)`} fill={i % 2 ? '#67e8d0' : '#b8f36b'} fillOpacity=".15" opacity=".7" />)}
    {kind === 'art-contours' && Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx={29 + i * 1.1} cy="24" rx={5 + i * 4} ry={3 + i * 3} transform="rotate(-18 32 24)" opacity={.9 - i * .11} />)}
    {kind === 'art-glitch' && Array.from({ length: 8 }, (_, i) => <rect key={i} x={8 + i % 3 * 8} y={6 + i * 4.6} width={13 + i * 3 % 23} height="3" fill={i % 3 ? '#b8f36b' : '#67e8d0'} fillOpacity={.25 + i % 4 * .2} stroke="none" />)}
    {kind === 'art-lissajous' && <polyline points={Array.from({ length: 160 }, (_, i) => `${32 + Math.sin(i / 159 * Math.PI * 6 + .5) * 24},${24 + Math.sin(i / 159 * Math.PI * 4) * 17}`).join(' ')} opacity=".8" />}
    {kind === 'art-rain' && <>{Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${6 + i * 5.8} ${4 + i * 11 % 26}v${5 + i % 3 * 2}`} opacity=".6" />)}<ellipse cx="32" cy="38" rx="18" ry="5" opacity=".5" /></>}
    {kind === 'art-typography' && <text x="32" y="33" textAnchor="middle" stroke="none" fill="#b8f36b" fontFamily="Georgia, serif" fontWeight="bold" fontSize="30">Aa</text>}
    {kind === 'art-terrain' && <>{[0, 1, 2, 3, 4].map(i => <path key={i} d={`M0 ${22 + i * 5}L9 ${7 + i * 5}L20 ${20 + i * 4}L29 ${37 + i * 2}L36 ${37 + i * 2}L47 ${15 + i * 5}L57 ${8 + i * 5}L64 ${23 + i * 5}`} opacity={.8 - i * .1} />)}{[7, 20, 32, 47, 57].map(x => <path key={x} d={`M${x} 16L${32 + (x - 32) * 1.7} 48`} opacity=".35" />)}</>}
    {kind === 'art-wire-tube' && <>{[0, 1, 2, 3].map(i => <ellipse key={i} cx="32" cy="24" rx={5 + i * 7} ry={4 + i * 5} transform={`rotate(${i * 12} 32 24)`} opacity={.9 - i * .15} />)}{Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${32 + Math.cos(i * Math.PI / 4) * 5} ${24 + Math.sin(i * Math.PI / 4) * 4}L${32 + Math.cos(i * Math.PI / 4 + .3) * 31} ${24 + Math.sin(i * Math.PI / 4 + .3) * 24}`} opacity=".4" />)}</>}
    {kind === 'art-wire-orb' && <><ellipse cx="32" cy="24" rx="22" ry="20" />{[8, 15].map(r => <ellipse key={r} cx="32" cy="24" rx={r} ry="20" opacity=".6" />)}{[13, 24, 35].map(y => <ellipse key={y} cx="32" cy={y} rx={y === 24 ? 22 : 18} ry="4" opacity=".6" />)}</>}
    {kind === 'art-wire-city' && <>{[3, 16, 42, 54].map((x, i) => <g key={x} opacity=".75"><path d={`M${x} 43V${13 + i % 2 * 8}l7 -5V38Z`} /><path d={`M${x + 7} ${8 + i % 2 * 8}l5 5V43l-5 -5M${x} ${13 + i % 2 * 8}l5 4 7 -4M${x + 5} ${17 + i % 2 * 8}V48`} /></g>)}<path d="M30 22L23 48M35 22L42 48" opacity=".4" /></>}
    {kind === 'art-flowfield' && Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${4 + i * 3} 43C${50 + i} ${34 - i * 3} ${5 + i * 2} ${12 + i} ${53 - i} 5`} opacity=".65" />)}
    {kind === 'art-chladni' && Array.from({ length: 70 }, (_, i) => <circle key={i} cx={32 + Math.cos(i * 1.7) * (5 + i % 14)} cy={24 + Math.sin(i * 3.4) * (5 + i % 14)} r=".65" fill="#b8f36b" stroke="none" />)}
    {kind === 'art-moire' && <>{Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${8 + i * 5} 4l-5 40M${2 + i * 5} 5l16 38`} opacity=".45" />)}</>}
    {kind === 'art-helix' && <>{[0, 1].map(p => <polyline key={p} points={Array.from({ length: 60 }, (_, i) => `${4 + i / 59 * 56},${24 + Math.sin(i / 59 * Math.PI * 4 + p * Math.PI) * 13}`).join(' ')} opacity=".8" />)}{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${5 + i * 4.8} ${24 + Math.sin(i / 11 * Math.PI * 4) * 13}V${24 - Math.sin(i / 11 * Math.PI * 4) * 13}`} opacity=".3" />)}</>}
  </svg>;
}

export function StyleArt({ kind }: { kind: string }) {
  const original = ['art-orbit', 'art-wave', 'art-tunnel', 'art-aurora', 'art-spectrum', 'art-particles'].includes(kind);
  return <div className={`style-art ${kind}`} aria-hidden="true">{!original ? <NewStyleArt kind={kind} />
    : ['art-orbit', 'art-wave', 'art-tunnel', 'art-aurora'].includes(kind) ? <><i /><i /><i /></> : kind === 'art-spectrum'
      ? Array.from({ length: 24 }, (_, i) => <i key={i} style={{ height: `${15 + Math.sin(i * .63) ** 2 * 62}%` }} />)
      : Array.from({ length: 35 }, (_, i) => <i key={i} style={{ left: `${10 + (i * 37 % 83)}%`, top: `${12 + (i * 23 % 78)}%`, opacity: .25 + i % 6 / 8 }} />)}
  </div>;
}
