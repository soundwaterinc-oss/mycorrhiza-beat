import { STEPS, TRACKS, SW, SG } from '../constants.js';

// Sequencer — DOM-direct step updates via seqCellRef callback
// Dub Send buttons: HOLD (pointerdown/up) or LATCH (click toggle)
export function Sequencer({
  pat, setPat, bpm,
  seqRef, onCellMount,
  dubActive, dubMode, setDubMode,
  killActive,
  onDubPointerDown, onDubPointerUp, onDubPointerLeave, onDubClick,
  onKillClick,
}) {
  const beatMarks = Array.from({ length: STEPS / 8 }, (_, i) => i * 8);

  return (
    <div style={{ borderTop: '1px solid #001800', padding: '6px 0 10px', background: '#000205' }}>

      {/* Beat marks ruler */}
      <div style={{ marginLeft: 54, width: STEPS * (SW + SG), height: 9, position: 'relative', marginBottom: 3 }}>
        {beatMarks.map(i => (
          <div key={i} style={{
            position: 'absolute', left: i * (SW + SG),
            fontSize: 6, color: i % 32 === 0 ? '#005500' : '#002200', lineHeight: 1,
          }}>
            {i % 32 === 0 ? '|' : '·'}
          </div>
        ))}
      </div>

      {/* HOLD/LATCH toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, paddingLeft: 6 }}>
        <div style={{ fontSize: 6, color: '#003300', letterSpacing: '.1em' }}>DUB</div>
        <button
          onClick={() => setDubMode(m => m === 'hold' ? 'latch' : 'hold')}
          style={{
            background: 'transparent', border: '1px solid #002200', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 6, color: '#003300', padding: '1px 5px', letterSpacing: '.1em',
          }}
        >
          {dubMode === 'hold' ? 'HOLD' : 'LATCH'}
        </button>
      </div>

      {/* Track rows */}
      <div ref={seqRef} style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ width: 54 + STEPS * (SW + SG), flexShrink: 0 }}>
          {TRACKS.map(({ key, color, h }) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 0,
              marginBottom: key === 'kick' ? 5 : 2,
            }}>
              {/* Track controls */}
              <div style={{ width: 54, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2, paddingRight: 4 }}>
                {/* DUB button */}
                <button
                  onPointerDown={() => onDubPointerDown(key)}
                  onPointerUp={() => onDubPointerUp(key)}
                  onPointerLeave={() => onDubPointerLeave(key)}
                  onClick={() => onDubClick(key)}
                  style={{
                    width: 22, height: h + 4,
                    background: dubActive[key] ? color + '33' : 'transparent',
                    border: `1px solid ${dubActive[key] ? color : '#002200'}`,
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 5,
                    color: dubActive[key] ? color : '#003300',
                    letterSpacing: '.05em', padding: 0,
                    boxShadow: dubActive[key] ? `0 0 8px ${color}` : 'none',
                    transition: 'all 0.05s',
                  }}
                >
                  DUB
                </button>

                {/* KILL button */}
                <button
                  onClick={() => onKillClick(key)}
                  style={{
                    width: 22, height: h + 4,
                    background: killActive[key] ? '#ff003c22' : 'transparent',
                    border: `1px solid ${killActive[key] ? '#ff003c' : '#002200'}`,
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 5,
                    color: killActive[key] ? '#ff003c' : '#003300',
                    letterSpacing: '.05em', padding: 0,
                    transition: 'all 0.05s',
                  }}
                >
                  KILL
                </button>
              </div>

              {/* Step cells */}
              <div style={{ display: 'flex', gap: SG + 'px' }}>
                {pat[key].map((vel, i) => {
                  const on = vel > 0;
                  const hex = on ? Math.round(vel * 180 + 60).toString(16).padStart(2, '0') : '';
                  return (
                    <div
                      key={i}
                      ref={el => { if (el) onCellMount(`${key}_${i}`, el); }}
                      onClick={() => setPat(p => {
                        const t = [...p[key]]; t[i] = t[i] ? 0 : 0.8;
                        return { ...p, [key]: t };
                      })}
                      style={{
                        width: SW, height: h, flexShrink: 0, cursor: 'pointer',
                        background: on
                          ? (key === 'kick' ? color : color + hex)
                          : i % 4 === 0 ? '#0a1a12' : 'transparent',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mini velocity histogram */}
      <div style={{
        marginLeft: 54, width: STEPS * (SW + SG), height: 18,
        display: 'flex', gap: SG + 'px', alignItems: 'flex-end', marginTop: 4,
      }}>
        {Array.from({ length: STEPS }, (_, i) => {
          const k = pat.kick[i], s = pat.snare[i], h = pat.hat[i], p = pat.perc[i];
          const col = k > 0 ? '#00ff41' : s > 0 ? '#ff003c' : h > 0 ? '#00ffff' : p > 0 ? '#ff6a00' : 'transparent';
          const hh = Math.min(18, Math.round((k + s * 0.7 + h * 0.4 + p * 0.45) * 10));
          return (
            <div key={i} style={{
              width: SW, height: hh || 1, flexShrink: 0,
              background: col, opacity: k > 0 ? 1 : 0.65,
            }} />
          );
        })}
      </div>

      <div style={{ marginLeft: 54, marginTop: 4, fontSize: 7, color: '#002a00', letterSpacing: '.2em' }}>
        ANGLE-VERTEX·Y→MOD · {STEPS}ST · {(STEPS / 8 / (bpm / 60)).toFixed(1)}S/LOOP
      </div>
    </div>
  );
}
