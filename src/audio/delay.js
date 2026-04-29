// Mycorrhiza Delay — AMF hyphal network model
// Tap times: 120ms / 247ms / 491ms (non-integer ratio → organic texture)
// Anastomosis feedback: tip fusion probability 0.1–0.65
// Growth rate LFO: rhythmic hyphal extension 0.05–0.3 Hz
export function createMycorrhizaDelay(ctx, dst) {
  const input = ctx.createGain();
  const dry   = ctx.createGain(); dry.gain.value = 0.7;
  const wet   = ctx.createGain(); wet.gain.value = 0.45;
  input.connect(dry); dry.connect(dst); wet.connect(dst);

  const tapDefs = [
    { t: 0.120, g: 0.52 }, // primary extension path
    { t: 0.247, g: 0.33 }, // secondary branch (×2.06 — not exact double)
    { t: 0.491, g: 0.18 }, // network traversal (×4.09)
  ];
  const taps = tapDefs.map(({ t, g }) => {
    const d = ctx.createDelay(2.0); d.delayTime.value = t;
    const gn = ctx.createGain(); gn.gain.value = g;
    // HPF: hyphae transmit mid-high freq better than low
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 550;
    input.connect(d); d.connect(hp); hp.connect(gn); gn.connect(wet);
    return { d, gn };
  });

  // Anastomosis feedback: primary tap → HPF → feedback → back to primary
  const fbGain = ctx.createGain(); fbGain.gain.value = 0.38;
  const fbHP   = ctx.createBiquadFilter(); fbHP.type = 'highpass'; fbHP.frequency.value = 900;
  taps[0].d.connect(fbHP); fbHP.connect(fbGain); fbGain.connect(taps[0].d);

  // Growth rate LFO: rhythmic hyphal extension pulses 0.05–0.3 Hz → ±7ms wobble
  const lfo  = ctx.createOscillator(); lfo.frequency.value = 0.09; lfo.type = 'sine';
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.007;
  lfo.connect(lfoG); lfoG.connect(taps[0].d.delayTime); lfo.start();

  return {
    input,
    setMix:         v => { dry.gain.value = 1 - v * 0.75; wet.gain.value = v * 0.9; },
    setPath:        v => {
      const scale = 0.4 + v * 1.6;
      tapDefs.forEach(({ t }, i) =>
        taps[i].d.delayTime.setTargetAtTime(t * scale, ctx.currentTime, 0.1));
    },
    setAnastomosis: v => fbGain.gain.setTargetAtTime(v * 0.65, ctx.currentTime, 0.05),
    setGrowthRate:  v => lfo.frequency.setValueAtTime(0.02 + v * 0.4, ctx.currentTime),
    setDamping:     v => { fbHP.frequency.setTargetAtTime(300 + (1 - v) * 1200, ctx.currentTime, 0.05); },
  };
}
