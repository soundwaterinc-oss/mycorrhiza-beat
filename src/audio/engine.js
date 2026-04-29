// Per-track output buses allow Dub Send routing in App.jsx
// Returns { kick, snare, hat, perc, outs }
export function createEngine(ctx) {
  const outs = {
    kick:  ctx.createGain(),
    snare: ctx.createGain(),
    hat:   ctx.createGain(),
    perc:  ctx.createGain(),
  };

  const mkPan = (p, track) => {
    const n = ctx.createStereoPanner();
    n.pan.value = p ?? 0;
    n.connect(outs[track]);
    return n;
  };

  const kick = (t, v, m = {}) => {
    const sr = ctx.sampleRate, dur = 0.032, len = Math.ceil(sr * dur);
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
      d[i] = Math.sin((i / sr) * 38 * 2 * Math.PI) * Math.exp(-i / (sr * 0.018));
    d[0] = v; d[1] = v * 0.85;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    const g = ctx.createGain(), pan = mkPan(m.pan, 'kick');
    g.gain.setValueAtTime(v * 1.65, t);
    g.gain.setValueAtTime(v * 1.65, t + dur - 0.002);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(lp); lp.connect(g); g.connect(pan);
    src.start(t); src.stop(t + dur + 0.001);

    const cb = ctx.createBuffer(1, Math.ceil(sr * 0.0004), sr), cd = cb.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1;
    const cs = ctx.createBufferSource(); cs.buffer = cb;
    const cg = ctx.createGain(), cp = mkPan(m.pan, 'kick');
    cg.gain.setValueAtTime(v * 0.6, t);
    cs.connect(cg); cg.connect(cp);
    cs.start(t); cs.stop(t + 0.001);
  };

  const snare = (t, v, m = {}) => {
    const len = 0.04 + Math.random() * 0.05;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const ns = ctx.createBufferSource(); ns.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = m.filter ?? 2200; bp.Q.value = 0.9;
    const g = ctx.createGain(), pan = mkPan(m.pan, 'snare');
    g.gain.setValueAtTime(v * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    ns.connect(bp); bp.connect(g); g.connect(pan);
    ns.start(t); ns.stop(t + len);
  };

  const hat = (t, v, m = {}) => {
    const len = 0.006 + Math.random() * 0.018;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass';
    hp.frequency.value = m.filter ?? 9500;
    const g = ctx.createGain(), pan = mkPan(m.pan, 'hat');
    g.gain.setValueAtTime(v * 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    ns.connect(hp); hp.connect(g); g.connect(pan);
    ns.start(t); ns.stop(t + len);
  };

  const perc = (t, v, m = {}) => {
    const detune = m.detune ?? 0;
    const normD  = (detune + 100) / 200;
    const dur    = 0.008 + (1 - normD) * 0.055;
    const len    = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.exp(-i / (len * 0.4));
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const cutoff = 300 + normD * 9700;
    const filt = ctx.createBiquadFilter();
    filt.type = normD > 0.5 ? 'highpass' : 'bandpass';
    filt.frequency.value = cutoff; filt.Q.value = 1.5;
    const g = ctx.createGain(), pan = mkPan(m.pan, 'perc');
    g.gain.setValueAtTime(v * 0.55, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(pan);
    src.start(t); src.stop(t + dur + 0.001);
  };

  return { kick, snare, hat, perc, outs };
}
