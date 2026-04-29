// Hyphal Scatter Reverb — fractal delay tap model
// FD = 1.62 (Glomus intraradices mature mycelium fractal dimension)
// Taps: 72ms × FD^n = 72ms, 117ms, 189ms, 306ms
// Anastomosis feedback: tip-tip fusion probability ~0.18
export function createFX(ctx, finalDst) {
  const FD_DEFAULT = 1.62;
  const BASE_TAP   = 0.072; // 72ms = shortest soil micro-pore reflection

  const input  = ctx.createGain(); input.gain.value = 1;
  const dryOut = ctx.createGain(); dryOut.gain.value = 0.6;
  const wetOut = ctx.createGain(); wetOut.gain.value = 0.5;
  input.connect(dryOut);
  dryOut.connect(finalDst);
  wetOut.connect(finalDst);

  // Soil absorption: organic matter damps high freq
  const soilLP = ctx.createBiquadFilter();
  soilLP.type = 'lowpass'; soilLP.frequency.value = 4000; soilLP.Q.value = 0.5;

  // 4 fractal tap delays: t × FD^n
  const taps = Array.from({ length: 4 }, (_, n) => {
    const d = ctx.createDelay(2.0);
    d.delayTime.value = BASE_TAP * Math.pow(FD_DEFAULT, n);
    const g = ctx.createGain();
    g.gain.value = 0.42 * Math.pow(0.62, n);
    return { d, g };
  });

  // Anastomosis feedback loop: tip-tip fusion probability ~0.18
  const anastGain = ctx.createGain(); anastGain.gain.value = 0.18;

  taps.forEach(({ d, g }) => {
    input.connect(d);
    d.connect(soilLP);
    soilLP.connect(g);
    g.connect(wetOut);
    g.connect(anastGain);
  });
  anastGain.connect(taps[1].d); // feedback re-enters second tap

  // Hypha resonance: narrow bandpass at 800Hz (fibrous elastic medium)
  const hyphaRes = ctx.createBiquadFilter();
  hyphaRes.type = 'peaking'; hyphaRes.frequency.value = 800;
  hyphaRes.Q.value = 4; hyphaRes.gain.value = 3;
  wetOut.connect(hyphaRes); hyphaRes.connect(finalDst);

  const set = (node, param, val, ramp = 0.05) =>
    node[param].setTargetAtTime(val, ctx.currentTime, ramp);

  const charRes = ctx.createBiquadFilter();
  charRes.type = 'peaking'; charRes.frequency.value = 1800; charRes.Q.value = 3; charRes.gain.value = 0;

  return {
    input,
    setCharacter: v => {
      const spf = 1 - v;
      taps.forEach(({ d }, n) =>
        d.delayTime.setTargetAtTime(
          (BASE_TAP * 0.25 + v * BASE_TAP * 0.75) * Math.pow(FD_DEFAULT, n),
          ctx.currentTime, 0.2));
      charRes.gain.value = spf * 6;
      charRes.frequency.value = 1800 + spf * 500;
      anastGain.gain.setTargetAtTime(spf * 0.55 + v * 0.18, ctx.currentTime, 0.1);
      soilLP.frequency.setTargetAtTime(3000 + spf * 6000, ctx.currentTime, 0.1);
    },
    setAge: v => {
      const fd = 1.1 + v * 0.7;
      taps.forEach(({ d }, n) =>
        set(d, 'delayTime', BASE_TAP * Math.pow(fd, n), 0.15));
    },
    setMoisture: v => {
      set(soilLP, 'frequency', 8000 - v * 7400);
      soilLP.Q.value = 0.3 + v * 2;
    },
    setDensity:    v => taps.forEach(({ g }, i) => set(g, 'gain', v * 0.55 * Math.pow(0.62, i))),
    setAnastomosis: v => set(anastGain, 'gain', v * 0.35),
    setResonance:  v => { hyphaRes.gain.value = v * 8 - 2; },
    setMix:        v => { dryOut.gain.value = 1 - v * 0.7; wetOut.gain.value = v; },
  };
}
