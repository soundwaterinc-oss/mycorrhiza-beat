import { useState, useRef, useEffect, useCallback } from 'react';
import { createEngine }           from './audio/engine.js';
import { createMycorrhizaDelay }  from './audio/delay.js';
import { createFX }               from './audio/reverb.js';
import { scanImage }              from './scan/pixelScan.js';
import { useGenerativeRD }        from './viz/rdSim.js';
import { HeroImage }              from './components/HeroImage.jsx';
import { RightPanel }             from './components/RightPanel.jsx';
import { Sequencer }              from './components/Sequencer.jsx';
import { sendStep, connectWs, disconnectWs, getWsUrl, isConnected } from './osc/wsOutput.js';
import { savePreset, loadPreset } from './utils/preset.js';
import {
  STEPS, TRACKS, TRACK_KEYS, BANDS,
  blank, blankY, DEF_SENS, DEF_MAPS, yToMod,
} from './constants.js';

export default function App() {
  // ── Pattern state ──
  const [pat, setPat]     = useState(blank());
  const [yMod, setYMod]   = useState(blankY());
  const [scanY, setScanY] = useState(blankY());
  const [maps, setMaps]   = useState(DEF_MAPS);

  // ── Transport ──
  const [playing, setPlay] = useState(false);
  const [bpm, setBpm]      = useState(132);

  // ── Image ──
  const [imgPreview, setImgPreview] = useState(null);
  const [imgUrl, setImgUrl]         = useState(null);
  const [svgUrl, setSvgUrl]         = useState(null);
  const [imgSize, setImgSize]       = useState({ w: 1, h: 1 });
  const [scanProg, setScanProg]     = useState(1);
  const [log, setLog]               = useState('');

  // ── Scanner ──
  const [sens, setSens]   = useState(DEF_SENS);
  const [showT, setShowT] = useState(false);

  // ── FX ──
  const [fxParams, setFxParams] = useState({ age: 0.75, moisture: 0.4, density: 0.65, anastomosis: 0.5, resonance: 0.4, mix: 0.42, character: 0.7 });
  const [fxOn, setFxOn]         = useState(true);
  const [dlyParams, setDlyParams] = useState({ mix: 0.35, path: 0.5, anastomosis: 0.38, growthRate: 0.3 });
  const [dlyOn, setDlyOn]        = useState(true);

  // ── Generative RD ──
  const [rdEnabled, setRdEnabled]     = useState(false);
  const [rdParams, setRdParams]       = useState({ F: 0.037, k: 0.060, spf: 5, blend: 0.35 });
  const [rescanEvery, setRescanEvery] = useState(40);

  // ── Dub Send ──
  const [dubMode, setDubMode]     = useState('hold');
  const [dubActive, setDubActive] = useState({ kick: false, snare: false, hat: false, perc: false });
  const [killActive, setKillActive] = useState({ kick: false, snare: false, hat: false, perc: false });
  const [sendLevel, setSendLevel] = useState({ kick: 0.8, snare: 0.8, hat: 0.8, perc: 0.8 });

  // ── OSC ──
  const [oscUrl, setOscUrl]         = useState('ws://localhost:8080');
  const [oscConnected, setOscConn]  = useState(false);

  // ── Audio refs ──
  const ctxRef       = useRef(null);
  const engRef       = useRef(null);
  const fxRef        = useRef(null);
  const dlyRef       = useRef(null);
  const dryGainsRef  = useRef({});   // per-track kill gates
  const sendGainsRef = useRef({});   // per-track dub send
  const fxParamsRef  = useRef(fxParams);
  const dlyParamsRef = useRef(dlyParams);
  const sendLevelRef = useRef(sendLevel);

  // ── Scheduler refs (DOM-direct, zero React re-renders) ──
  const tmrRef  = useRef(null);
  const stpRef  = useRef(0);
  const nxtRef  = useRef(0);
  const patRef  = useRef(pat);
  const yRef    = useRef(yMod);
  const bpmRef  = useRef(bpm);
  const mapsRef = useRef(maps);

  // ── DOM refs ──
  const seqRef     = useRef(null);
  const imgRef     = useRef(null);
  const imgFileRef = useRef(null);
  const svgFileRef = useRef(null);
  const phRef      = useRef(null);
  const phGRef     = useRef(null);
  const stepNumRef = useRef(null);
  const seqRefs    = useRef({});
  const prevStep   = useRef(-1);

  // Keep refs in sync with state
  useEffect(() => { patRef.current  = pat;  }, [pat]);
  useEffect(() => { yRef.current    = yMod; }, [yMod]);
  useEffect(() => { bpmRef.current  = bpm;  }, [bpm]);
  useEffect(() => { mapsRef.current = maps; }, [maps]);
  useEffect(() => { fxParamsRef.current  = fxParams;  }, [fxParams]);
  useEffect(() => { dlyParamsRef.current = dlyParams;  }, [dlyParams]);
  useEffect(() => { sendLevelRef.current = sendLevel;  }, [sendLevel]);

  // ── Generative RD ──
  const { dispRef: rdDispRef, gen: rdGen, getDataUrl: rdGetUrl } =
    useGenerativeRD(rdEnabled ? imgUrl : null, rdEnabled, rdParams);

  // Auto-rescan when RD evolves enough
  useEffect(() => {
    if (!rdEnabled || rdGen === 0 || rdGen % rescanEvery !== 0) return;
    const url = rdGetUrl();
    if (url) doScan(url, sens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rdGen]);

  // Track image size for SVG overlay
  useEffect(() => {
    if (!imgRef.current || !imgPreview) return;
    const ro = new ResizeObserver(() => {
      const r = imgRef.current?.getBoundingClientRect();
      if (r) setImgSize({ w: r.width, h: r.height });
    });
    ro.observe(imgRef.current);
    return () => ro.disconnect();
  }, [imgPreview]);

  // Load preset from URL on mount
  useEffect(() => {
    const p = loadPreset();
    if (!p) return;
    if (p.bpm)       setBpm(p.bpm);
    if (p.fxParams)  setFxParams(p.fxParams);
    if (p.dlyParams) setDlyParams(p.dlyParams);
    if (p.rdParams)  setRdParams(p.rdParams);
    if (p.sens)      setSens(p.sens);
    if (p.maps)      setMaps(p.maps);
  }, []);

  // ── Audio chain setup ──
  // Routing: engine.outs[t] → dryGain[t] → ctx.destination (dry, always)
  //          engine.outs[t] → sendGain[t] → delay → reverb → ctx.destination
  const buildAudio = async () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ctx;

    const fx  = createFX(ctx, ctx.destination);
    const dly = createMycorrhizaDelay(ctx, fx.input);
    fxRef.current  = fx;
    dlyRef.current = dly;

    const eng = createEngine(ctx);
    engRef.current = eng;

    const dryGains = {}, sendGains = {};
    TRACK_KEYS.forEach(t => {
      dryGains[t]  = ctx.createGain(); dryGains[t].gain.value  = 1;
      sendGains[t] = ctx.createGain(); sendGains[t].gain.value = 0;
      eng.outs[t].connect(dryGains[t]);
      eng.outs[t].connect(sendGains[t]);
      dryGains[t].connect(ctx.destination);
      sendGains[t].connect(dly.input);
    });
    dryGainsRef.current  = dryGains;
    sendGainsRef.current = sendGains;

    // Apply current params
    const fp = fxParamsRef.current;
    fx.setAge(fp.age); fx.setMoisture(fp.moisture); fx.setDensity(fp.density);
    fx.setAnastomosis(fp.anastomosis); fx.setResonance(fp.resonance);
    fx.setMix(fxOn ? fp.mix : 0); fx.setCharacter(fp.character);

    const dp = dlyParamsRef.current;
    dly.setMix(dlyOn ? dp.mix : 0); dly.setPath(dp.path);
    dly.setAnastomosis(dp.anastomosis); dly.setGrowthRate(dp.growthRate);

    return ctx;
  };

  // ── Scheduler — DOM-direct, zero React re-renders per step ──
  const schedule = useCallback(() => {
    const ctx = ctxRef.current, eng = engRef.current;
    if (!ctx || !eng) return;
    const sps = 60 / bpmRef.current / 8;

    while (nxtRef.current < ctx.currentTime + 0.1) {
      const s = stpRef.current, p = patRef.current, t = nxtRef.current;
      const ym = yRef.current, m = mapsRef.current;
      const gM = tr => yToMod(ym[tr]?.[s] ?? 0.5, m[tr]);

      if (p.kick[s])  eng.kick(t,  p.kick[s],  gM('kick'));
      if (p.snare[s]) eng.snare(t, p.snare[s], gM('snare'));
      if (p.hat[s])   eng.hat(t,   p.hat[s],   gM('hat'));
      if (p.perc[s])  eng.perc(t,  p.perc[s],  gM('perc'));

      // OSC out
      if (isConnected()) {
        const hits = {};
        TRACK_KEYS.forEach(tk => { hits[tk] = p[tk][s] ?? 0; });
        const ymOut = {};
        TRACK_KEYS.forEach(tk => { ymOut[tk] = ym[tk]?.[s] ?? 0.5; });
        sendStep(s, bpmRef.current, hits, ymOut, fxParamsRef.current, dlyParamsRef.current);
      }

      const delay = Math.max(0, (t - ctx.currentTime) * 1000);
      ((ss) => setTimeout(() => {
        const pct = ((ss + 0.5) / STEPS) * 100;
        if (phRef.current)   { phRef.current.setAttribute('x1', `${pct}%`);  phRef.current.setAttribute('x2', `${pct}%`); }
        if (phGRef.current)  { phGRef.current.setAttribute('x1', `${pct}%`); phGRef.current.setAttribute('x2', `${pct}%`); }
        if (stepNumRef.current)
          stepNumRef.current.textContent = `▶ ${String(ss + 1).padStart(3, '0')}/${STEPS} · ${bpmRef.current}BPM`;

        const prev = prevStep.current;
        if (prev >= 0) TRACKS.forEach(({ key, color }) => {
          const el = seqRefs.current[`${key}_${prev}`]; if (!el) return;
          const v = patRef.current[key][prev];
          el.style.background = v > 0
            ? (key === 'kick' ? color : color + Math.round(v * 180 + 60).toString(16).padStart(2, '0'))
            : prev % 4 === 0 ? '#0a1a12' : 'transparent';
          el.style.boxShadow = 'none';
        });
        TRACKS.forEach(({ key, color }) => {
          const el = seqRefs.current[`${key}_${ss}`]; if (!el) return;
          const v = patRef.current[key][ss];
          el.style.background = v > 0 ? (key === 'kick' ? '#fff' : color + 'ee') : '#001a0f';
          if (key === 'kick' && v > 0) el.style.boxShadow = `0 0 5px ${color}`;
        });
        prevStep.current = ss;
        if (seqRef.current)
          seqRef.current.scrollLeft = Math.max(0, ss * 5 - seqRef.current.clientWidth / 2);
      }, delay))(s);

      stpRef.current = (s + 1) % STEPS;
      nxtRef.current += sps;
    }
    tmrRef.current = setTimeout(schedule, 15);
  }, []);

  const togglePlay = async () => {
    if (playing) {
      clearTimeout(tmrRef.current); setPlay(false);
      if (phRef.current)  { phRef.current.setAttribute('x1', '-10%');  phRef.current.setAttribute('x2', '-10%'); }
      if (phGRef.current) { phGRef.current.setAttribute('x1', '-10%'); phGRef.current.setAttribute('x2', '-10%'); }
      if (stepNumRef.current) stepNumRef.current.textContent = '';
      return;
    }
    if (!ctxRef.current) await buildAudio();
    if (ctxRef.current.state === 'suspended') await ctxRef.current.resume();
    stpRef.current = 0; nxtRef.current = ctxRef.current.currentTime + 0.04;
    schedule(); setPlay(true);
  };

  // ── Scanner ──
  const doScan = async (url, sn) => {
    setLog('SCANNING...');
    setScanProg(0);
    const { result, yMod: ym, scanY: sy } = await scanImage(url, STEPS, sn);
    setPat(result); setYMod(ym); setScanY(sy);
    const steps = 40, interval = 800 / steps;
    for (let i = 1; i <= steps; i++) {
      await new Promise(r => setTimeout(r, interval));
      setScanProg(i / steps);
    }
    const hits = BANDS.map(b => result[b.track].filter(v => v > 0).length);
    setLog(`K:${hits[3]} S:${hits[2]} H:${hits[1]} P:${hits[0]}`);
  };

  // ── FX helpers ──
  const setFxParam = (key, val) => {
    const next = { ...fxParamsRef.current, [key]: val };
    fxParamsRef.current = next; setFxParams(next);
    const fx = fxRef.current; if (!fx) return;
    if (key === 'age')         fx.setAge(val);
    if (key === 'moisture')    fx.setMoisture(val);
    if (key === 'density')     fx.setDensity(val);
    if (key === 'anastomosis') fx.setAnastomosis(val);
    if (key === 'resonance')   fx.setResonance(val);
    if (key === 'mix')         fx.setMix(fxOn ? val : 0);
    if (key === 'character')   fx.setCharacter(val);
  };
  const toggleFx = () => {
    const next = !fxOn; setFxOn(next);
    if (fxRef.current) fxRef.current.setMix(next ? fxParamsRef.current.mix : 0);
  };

  const setDlyParam = (key, val) => {
    const next = { ...dlyParamsRef.current, [key]: val };
    dlyParamsRef.current = next; setDlyParams(next);
    const d = dlyRef.current; if (!d) return;
    if (key === 'mix')         d.setMix(dlyOn ? val : 0);
    if (key === 'path')        d.setPath(val);
    if (key === 'anastomosis') d.setAnastomosis(val);
    if (key === 'growthRate')  d.setGrowthRate(val);
  };

  useEffect(() => {
    if (dlyRef.current) dlyRef.current.setMix(dlyOn ? dlyParamsRef.current.mix : 0);
  }, [dlyOn]);

  // ── Dub Send ──
  const dubPointerDown = (track) => {
    if (dubMode !== 'hold') return;
    const ctx = ctxRef.current;
    const t = ctx?.currentTime ?? 0;
    sendGainsRef.current[track]?.gain.setTargetAtTime(sendLevelRef.current[track], t, 0.005);
    setDubActive(d => ({ ...d, [track]: true }));
  };
  const dubPointerUp = (track) => {
    if (dubMode !== 'hold') return;
    const ctx = ctxRef.current;
    const t = ctx?.currentTime ?? 0;
    sendGainsRef.current[track]?.gain.setTargetAtTime(0, t, 0.02);
    setDubActive(d => ({ ...d, [track]: false }));
  };
  const dubClick = (track) => {
    if (dubMode !== 'latch') return;
    const next = !dubActive[track];
    const ctx = ctxRef.current;
    const t = ctx?.currentTime ?? 0;
    sendGainsRef.current[track]?.gain.setTargetAtTime(
      next ? sendLevelRef.current[track] : 0, t, next ? 0.005 : 0.02
    );
    setDubActive(d => ({ ...d, [track]: next }));
  };
  const killClick = (track) => {
    const next = !killActive[track];
    const ctx = ctxRef.current;
    const t = ctx?.currentTime ?? 0;
    dryGainsRef.current[track]?.gain.setTargetAtTime(next ? 0 : 1, t, 0.005);
    setKillActive(k => ({ ...k, [track]: next }));
  };

  // ── Image handling (via ref callbacks to avoid re-render loop) ──
  useEffect(() => {
    if (!imgFileRef.current) return;
    imgFileRef.current._onLoad = async (url) => {
      const img = new Image();
      img.onload = async () => {
        const MAX = 1400, sc = Math.min(1, MAX / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = img.width * sc | 0; cv.height = img.height * sc | 0;
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const resized = cv.toDataURL('image/jpeg', 0.88);
        setImgPreview(resized); setImgUrl(resized);
        await doScan(resized, sens);
      };
      img.src = url;
    };
  });

  useEffect(() => {
    if (!svgFileRef.current) return;
    svgFileRef.current._onLoad = (file) => {
      if (svgUrl) URL.revokeObjectURL(svgUrl);
      setSvgUrl(URL.createObjectURL(file));
      setLog('SVG overlay loaded');
    };
  });

  // ── OSC ──
  const handleOscConnect = () => {
    if (oscConnected) {
      disconnectWs();
      setOscConn(false);
    } else {
      connectWs(oscUrl);
      setTimeout(() => setOscConn(isConnected()), 500);
    }
  };

  // ── Preset ──
  const handleSavePreset = () => {
    savePreset({ bpm, fxParams, dlyParams, rdParams, sens, maps });
    setLog('URL copied — share to restore params');
  };

  const handleCellMount = useCallback((id, el) => {
    seqRefs.current[id] = el;
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#000305', color: '#00ff41',
      fontFamily: "'Share Tech Mono','Courier New',monospace" }}>
      <div className="scn" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 14px 6px', borderBottom: '1px solid #001800' }}>
        <h1 className="gt" style={{ margin: 0, fontSize: 12, fontWeight: 400, letterSpacing: '.35em' }}>
          MYCORRHIZA::BEAT
        </h1>
        <span style={{ fontSize: 7, color: '#002800', letterSpacing: '.1em' }}>
          PIXEL→BEAT · Y→PAN/FILTER/PITCH
        </span>
        <span ref={stepNumRef} style={{
          marginLeft: 'auto', fontSize: 9, color: '#00ff41',
          letterSpacing: '.1em', minWidth: 160, textAlign: 'right',
        }} />
      </div>

      <div style={{ display: 'flex' }}>
        <HeroImage
          imgPreview={imgPreview}
          imgUrl={imgUrl}
          svgUrl={svgUrl}
          rdEnabled={rdEnabled}
          rdDispRef={rdDispRef}
          imgSize={imgSize}
          scanY={scanY}
          yMod={yMod}
          pat={pat}
          maps={maps}
          scanProg={scanProg}
          phRef={phRef}
          phGRef={phGRef}
          imgRef={imgRef}
          imgFileRef={imgFileRef}
          svgFileRef={svgFileRef}
          onImgLoad={() => {
            const r = imgRef.current?.getBoundingClientRect();
            if (r) setImgSize({ w: r.width, h: r.height });
          }}
        />

        <RightPanel
          maps={maps} setMaps={setMaps}
          bpm={bpm} setBpm={setBpm}
          sens={sens} setSens={setSens} showT={showT} setShowT={setShowT}
          imgUrl={imgUrl}
          fxParams={fxParams} setFxParam={setFxParam} fxOn={fxOn} toggleFx={toggleFx}
          dlyParams={dlyParams} setDlyParam={setDlyParam} dlyOn={dlyOn} setDlyOn={setDlyOn}
          rdEnabled={rdEnabled} setRdEnabled={setRdEnabled}
          rdParams={rdParams} setRdParams={setRdParams}
          rdGen={rdGen} rescanEvery={rescanEvery} setRescanEvery={setRescanEvery}
          playing={playing} togglePlay={togglePlay}
          doScan={doScan}
          onClear={() => { setPat(blank()); setYMod(blankY()); setScanY(blankY()); setLog(''); }}
          log={log} svgUrl={svgUrl}
          sendLevel={sendLevel} setSendLevel={setSendLevel}
          oscUrl={oscUrl} setOscUrl={setOscUrl}
          oscConnected={oscConnected} onOscConnect={handleOscConnect}
          onSavePreset={handleSavePreset}
        />
      </div>

      <Sequencer
        pat={pat} setPat={setPat} bpm={bpm}
        seqRef={seqRef}
        onCellMount={handleCellMount}
        dubActive={dubActive}
        dubMode={dubMode} setDubMode={setDubMode}
        killActive={killActive}
        onDubPointerDown={dubPointerDown}
        onDubPointerUp={dubPointerUp}
        onDubPointerLeave={dubPointerUp}
        onDubClick={dubClick}
        onKillClick={killClick}
      />
    </div>
  );
}
