import { useMemo } from 'react';
import { BANDS, STEPS, yToMod } from '../constants.js';

export function ScanViz({ scanY, yMod, pat, maps, W, H, scanProgress }) {
  if (!W || !H) return null;
  const reveal = scanProgress ?? 1;
  const revealStep = Math.floor(reveal * STEPS);
  const elems = [];

  BANDS.forEach(b => {
    const t = b.track, col = b.color;
    const sy = scanY?.[t], ym = yMod?.[t];
    if (!sy || sy.length < STEPS) return;

    // Scan path — only draw up to revealed step
    const pts = sy.slice(0, revealStep + 1).map((yf, x) =>
      `${(((x + 0.5) / STEPS) * W).toFixed(1)},${(yf * H).toFixed(1)}`
    ).join(' ');
    if (pts) elems.push(
      <polyline key={`path-${t}`} points={pts}
        fill="none" stroke={col} strokeWidth="1.5" strokeOpacity="0.55"
        vectorEffect="non-scaling-stroke" />
    );

    // Hit dots
    pat[t].forEach((vel, x) => {
      if (vel < 0.05 || x > revealStep) return;
      const px = ((x + 0.5) / STEPS) * W;
      const py = sy[x] * H;
      const r  = 3.5 + vel * 7;
      const mod = yToMod(ym?.[x] ?? 0.5, maps[t]);

      elems.push(
        <circle key={`h2-${t}-${x}`} cx={px.toFixed(1)} cy={py.toFixed(1)}
          r={(r * 2.8).toFixed(1)} fill={col}
          fillOpacity={(vel * 0.08).toFixed(3)} vectorEffect="non-scaling-stroke" />
      );
      elems.push(
        <circle key={`h1-${t}-${x}`} cx={px.toFixed(1)} cy={py.toFixed(1)}
          r={(r * 1.7).toFixed(1)} fill={col}
          fillOpacity={(vel * 0.18).toFixed(3)} vectorEffect="non-scaling-stroke" />
      );
      elems.push(
        <circle key={`ring-${t}-${x}`} cx={px.toFixed(1)} cy={py.toFixed(1)}
          r={(r * 1.15).toFixed(1)} fill="none" stroke={col}
          strokeWidth="0.8" strokeOpacity={(vel * 0.55).toFixed(2)}
          vectorEffect="non-scaling-stroke" />
      );
      elems.push(
        <circle key={`dot-${t}-${x}`} cx={px.toFixed(1)} cy={py.toFixed(1)}
          r={r.toFixed(1)} fill={col}
          fillOpacity={Math.max(0.65, vel).toFixed(2)} vectorEffect="non-scaling-stroke" />
      );
      if (maps[t].pan) {
        const px2 = px + mod.pan * 20;
        elems.push(
          <line key={`pan-${t}-${x}`}
            x1={px.toFixed(1)} y1={(py + r + 3).toFixed(1)}
            x2={px2.toFixed(1)} y2={(py + r + 3).toFixed(1)}
            stroke={col} strokeWidth="1.5" strokeOpacity="0.45"
            vectorEffect="non-scaling-stroke" />
        );
      }
    });

    elems.push(
      <text key={`lb-${t}`} x={4} y={b.y0 * H + 11}
        fill={col} fillOpacity="0.55" fontSize="9"
        fontFamily="'Share Tech Mono',monospace" letterSpacing="2">
        {t.toUpperCase()}
      </text>
    );
    elems.push(
      <line key={`bd-${t}`} x1={0} y1={b.y0 * H} x2={W} y2={b.y0 * H}
        stroke={col} strokeWidth="0.4" strokeOpacity="0.15"
        strokeDasharray="2 7" vectorEffect="non-scaling-stroke" />
    );
  });

  // Scan cursor (during animation)
  if (reveal < 1) {
    const cx = ((revealStep + 0.5) / STEPS) * W;
    elems.push(
      <line key="cursor-g" x1={cx} y1={0} x2={cx} y2={H}
        stroke="#fff" strokeWidth="6" strokeOpacity="0.08" vectorEffect="non-scaling-stroke" />
    );
    elems.push(
      <line key="cursor" x1={cx} y1={0} x2={cx} y2={H}
        stroke="#fff" strokeWidth="1" strokeOpacity="0.7" vectorEffect="non-scaling-stroke" />
    );
  }

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
      opacity: 0.78, pointerEvents: 'none' }}
      viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {elems}
    </svg>
  );
}

// Memoized when fully revealed; live during scan animation
export function ScanVizMemo({ scanY, yMod, pat, maps, W, H, scanProgress }) {
  const animating = scanProgress < 1;
  const memo = useMemo(
    () => <ScanViz scanY={scanY} yMod={yMod} pat={pat} maps={maps} W={W} H={H} scanProgress={1} />,
    [scanY, yMod, pat, maps, W, H]
  );
  if (animating) return <ScanViz scanY={scanY} yMod={yMod} pat={pat} maps={maps} W={W} H={H} scanProgress={scanProgress} />;
  return memo;
}
