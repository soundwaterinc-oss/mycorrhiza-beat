import { BANDS } from '../constants.js';

function Slider({ label, bio, color, value, min, max, step, onChange, accentColor }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, marginBottom: 1 }}>
        <span style={{ color: color ?? '#00ff41' }}>{label}</span>
        {bio && <span style={{ color: '#003300', fontSize: 6 }}>{bio}</span>}
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', accentColor: accentColor ?? color ?? '#00ff41' }} />
    </div>
  );
}

export function RightPanel({
  maps, setMaps,
  bpm, setBpm,
  sens, setSens, showT, setShowT,
  imgUrl,
  fxParams, setFxParam, fxOn, toggleFx,
  dlyParams, setDlyParam, dlyOn, setDlyOn,
  rdEnabled, setRdEnabled, rdParams, setRdParams,
  rdGen, rescanEvery, setRescanEvery,
  playing, togglePlay, doScan,
  onClear, log, svgUrl,
  sendLevel, setSendLevel,
  oscUrl, setOscUrl, oscConnected, onOscConnect,
  onSavePreset,
}) {
  return (
    <div style={{
      width: 158, borderLeft: '1px solid #001800', background: '#000305',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      overflowY: 'auto', maxHeight: 'calc(100vh - 34px)',
    }}>

      {/* Band map */}
      <div style={{ borderBottom: '1px solid #001800', padding: '7px 10px' }}>
        <div style={{ fontSize: 7, color: '#003300', letterSpacing: '.12em', marginBottom: 4 }}>IMAGE → TRACK</div>
        {BANDS.map(b => (
          <div key={b.track} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <div style={{ width: 2, height: 18, background: b.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 8, color: b.color }}>{b.track.toUpperCase()}</div>
              <div style={{ fontSize: 6, color: '#003300' }}>{(b.y0 * 100) | 0}–{(b.y1 * 100) | 0}% top</div>
            </div>
          </div>
        ))}
        {svgUrl && <div style={{ fontSize: 6, color: '#005500', marginTop: 4 }}>✓ SVG overlay</div>}
      </div>

      {/* Y→Mod routing */}
      <div style={{ borderBottom: '1px solid #001800', padding: '7px 10px' }}>
        <div style={{ fontSize: 7, color: '#003300', letterSpacing: '.12em', marginBottom: 4 }}>Y → MOD</div>
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr', gap: '2px 2px', fontSize: 7 }}>
          <div />
          {['PAN', 'FILT', 'TUNE'].map(p => (
            <div key={p} style={{ textAlign: 'center', color: '#003300' }}>{p}</div>
          ))}
          {BANDS.map(b => [
            <div key={`l-${b.track}`} style={{ color: b.color, fontSize: 7, alignSelf: 'center' }}>
              {b.track.slice(0, 3).toUpperCase()}
            </div>,
            ...['pan', 'filter', 'detune'].map(k => (
              <button key={k}
                onClick={() => setMaps(m => ({ ...m, [b.track]: { ...m[b.track], [k]: !m[b.track][k] } }))}
                style={{
                  padding: '3px 0', fontSize: 8, border: '1px solid', cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: maps[b.track][k] ? b.color : 'transparent',
                  borderColor: maps[b.track][k] ? b.color : '#002200',
                  color: maps[b.track][k] ? '#000' : '#003300',
                }}>
                {maps[b.track][k] ? '●' : '○'}
              </button>
            )),
          ])}
        </div>
        <div style={{ fontSize: 6, color: '#002500', marginTop: 4, lineHeight: 1.6 }}>
          top→btm: L→R / hi→lo / +→−100¢
        </div>
      </div>

      {/* BPM */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #001800' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 3 }}>
          <span style={{ color: '#003300', letterSpacing: '.1em' }}>BPM</span>
          <span style={{ color: '#00ff41', fontSize: 13 }}>{bpm}</span>
        </div>
        <input type="range" min={80} max={200} value={bpm}
          onChange={e => setBpm(+e.target.value)} style={{ width: '100%' }} />
      </div>

      {/* Sensitivity */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #001800' }}>
        <button className="btn" onClick={() => setShowT(v => !v)}
          style={{ width: '100%', color: '#004400', borderColor: '#002200', padding: '4px 0', marginBottom: showT ? 4 : 0 }}>
          ANGLE {showT ? '▲' : '▼'}
        </button>
        {showT && (
          <>
            <div style={{ fontSize: 6, color: '#004400', marginBottom: 5, lineHeight: 1.6 }}>
              0 = 全鳴り (any bend)<br />1 = corners only
            </div>
            {BANDS.map((b, i) => (
              <div key={b.track} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, marginBottom: 1 }}>
                  <span style={{ color: b.color }}>{b.track.slice(0, 3).toUpperCase()}</span>
                  <span style={{ color: '#003300' }}>{sens[i].toFixed(2)}</span>
                </div>
                <input type="range" min={0} max={1} step={0.01} value={sens[i]}
                  onChange={async e => {
                    const n = [...sens]; n[i] = +e.target.value; setSens(n);
                    if (imgUrl) await doScan(imgUrl, n);
                  }}
                  style={{ width: '100%', accentColor: b.color }} />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Generative Evolution */}
      <div style={{ borderBottom: '1px solid #001800', padding: '7px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <div style={{ fontSize: 7, color: '#003300', letterSpacing: '.12em' }}>EVOLVE</div>
          <button className="btn" onClick={() => setRdEnabled(v => !v)}
            style={{ padding: '2px 7px', fontSize: 7,
              color: rdEnabled ? '#00ffff' : '#003300',
              borderColor: rdEnabled ? '#00ffff' : '#002200' }}>
            {rdEnabled ? '▶ ON' : 'OFF'}
          </button>
        </div>
        {rdEnabled && (
          <>
            <div style={{ fontSize: 6, color: '#004400', marginBottom: 5, lineHeight: 1.7 }}>
              GEN {rdGen} · beat updates every {rescanEvery}
            </div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
              {[
                { label: 'HYPHAE', F: 0.037, k: 0.060 },
                { label: 'SPORES', F: 0.025, k: 0.055 },
                { label: 'GROWTH', F: 0.014, k: 0.054 },
              ].map(p => (
                <button key={p.label} className="btn"
                  onClick={() => setRdParams(prev => ({ ...prev, F: p.F, k: p.k }))}
                  style={{
                    flex: 1, padding: '3px 2px', fontSize: 6, letterSpacing: '.05em',
                    color: Math.abs(rdParams.F - p.F) < 0.001 ? '#000' : '#003300',
                    background: Math.abs(rdParams.F - p.F) < 0.001 ? '#00ffff' : 'transparent',
                    borderColor: Math.abs(rdParams.F - p.F) < 0.001 ? '#00ffff' : '#002200',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
            <Slider label="BLEND" color="#00ffff" value={rdParams.blend} min={0} max={1} step={0.01}
              bio={`photo ${(rdParams.blend * 100) | 0}%`}
              onChange={v => setRdParams(p => ({ ...p, blend: v }))} />
            <Slider label="SPEED" color="#00ffff" value={rdParams.spf} min={1} max={12} step={1}
              bio={`${rdParams.spf} steps/f`}
              onChange={v => setRdParams(p => ({ ...p, spf: v }))} />
            <Slider label="RESCAN" color="#00ffff" value={rescanEvery} min={10} max={120} step={5}
              bio={`every ${rescanEvery} gen`}
              onChange={v => setRescanEvery(v)} />
          </>
        )}
      </div>

      {/* Mycorrhiza Delay */}
      <div style={{ borderBottom: '1px solid #001800', padding: '7px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <div style={{ fontSize: 7, color: '#003300', letterSpacing: '.12em' }}>MYCO DELAY</div>
          <button className="btn" onClick={() => setDlyOn(v => !v)}
            style={{ padding: '2px 7px', fontSize: 7,
              color: dlyOn ? '#ff6a00' : '#003300',
              borderColor: dlyOn ? '#ff6a00' : '#002200' }}>
            {dlyOn ? 'ON' : 'OFF'}
          </button>
        </div>
        {[
          { key: 'mix',         label: 'MIX',     bio: 'wet mix'            },
          { key: 'path',        label: 'PATH',    bio: 'hyphal length 5-20cm' },
          { key: 'anastomosis', label: 'FEEDBACK',bio: 'tip fusion loops'   },
          { key: 'growthRate',  label: 'GROWTH',  bio: 'extension rate Hz'  },
        ].map(({ key, label, bio }) => (
          <Slider key={key} label={label} bio={bio} color="#ff6a00"
            value={dlyParams[key]} min={0} max={1} step={0.01}
            onChange={v => setDlyParam(key, v)} />
        ))}
      </div>

      {/* Hyphal Scatter Reverb */}
      <div style={{ borderBottom: '1px solid #001800', padding: '7px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <div style={{ fontSize: 7, color: '#003300', letterSpacing: '.12em' }}>HYPHAL REVERB</div>
          <button className="btn" onClick={toggleFx}
            style={{ padding: '2px 7px', fontSize: 7,
              color: fxOn ? '#00ff41' : '#003300',
              borderColor: fxOn ? '#00ff41' : '#002200' }}>
            {fxOn ? 'ON' : 'OFF'}
          </button>
        </div>
        {[
          { key: 'character',   label: 'CHARACTER', bio: 'spring↔long'    },
          { key: 'mix',         label: 'MIX',       bio: 'colonization 42%' },
          { key: 'age',         label: 'AGE',        bio: 'FD 1.1→1.8'    },
          { key: 'moisture',    label: 'MOISTURE',   bio: 'soil H₂O'      },
          { key: 'density',     label: 'DENSITY',    bio: 'hyphal length'  },
          { key: 'anastomosis', label: 'ANASTOM',    bio: 'tip fusion 0-35%' },
          { key: 'resonance',   label: 'RESONANCE',  bio: 'hypha elastic'  },
        ].map(({ key, label, bio }) => (
          <Slider key={key} label={label} bio={bio} color="#00ff41"
            value={fxParams[key]} min={0} max={1} step={0.01}
            onChange={v => setFxParam(key, v)} />
        ))}
      </div>

      {/* Dub Send Level */}
      <div style={{ borderBottom: '1px solid #001800', padding: '7px 10px' }}>
        <div style={{ fontSize: 7, color: '#003300', letterSpacing: '.12em', marginBottom: 5 }}>DUB SEND LEVEL</div>
        {['kick', 'snare', 'hat', 'perc'].map((t, i) => {
          const col = ['#00ff41', '#ff003c', '#00ffff', '#ff6a00'][i];
          return (
            <Slider key={t} label={t.toUpperCase()} color={col}
              value={sendLevel[t]} min={0} max={1} step={0.01}
              onChange={v => setSendLevel(s => ({ ...s, [t]: v }))} />
          );
        })}
      </div>

      {/* OSC / WebSocket */}
      <div style={{ borderBottom: '1px solid #001800', padding: '7px 10px' }}>
        <div style={{ fontSize: 7, color: '#003300', letterSpacing: '.12em', marginBottom: 5 }}>M4L OSC</div>
        <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
          <input
            type="text" value={oscUrl}
            onChange={e => setOscUrl(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: '1px solid #002200',
              color: '#00ff41', fontFamily: 'inherit', fontSize: 7, padding: '2px 4px',
            }}
          />
          <button className="btn" onClick={onOscConnect}
            style={{
              padding: '2px 5px', fontSize: 7,
              color: oscConnected ? '#00ff41' : '#003300',
              borderColor: oscConnected ? '#00ff41' : '#002200',
            }}>
            {oscConnected ? '●' : '○'}
          </button>
        </div>
        {oscConnected && <div style={{ fontSize: 6, color: '#004400' }}>CONNECTED</div>}
      </div>

      {/* Buttons */}
      <div style={{ padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button className="btn" onClick={togglePlay}
          style={{ color: playing ? '#ff003c' : '#00ffff', borderColor: playing ? '#330000' : '#003333' }}>
          {playing ? '■ STOP' : '▶ PLAY'}
        </button>
        <button className="btn" disabled={!imgUrl} onClick={() => doScan(imgUrl, sens)}
          style={{ color: '#00ff41', borderColor: '#002200' }}>RESCAN</button>
        <button className="btn" onClick={onSavePreset}
          style={{ color: '#ff6a00', borderColor: '#331100' }}>SHARE</button>
        <button className="btn" onClick={onClear}
          style={{ color: '#003300', borderColor: '#001800' }}>CLR</button>
      </div>
      {log && <div style={{ padding: '0 10px 8px', fontSize: 8, color: '#005500', letterSpacing: '.08em' }}>{log}</div>}
    </div>
  );
}
