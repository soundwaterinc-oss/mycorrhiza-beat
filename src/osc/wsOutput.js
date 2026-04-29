// WebSocket output for M4L/Max OSC bridge
// Real UDP transmission is handled by a separate Node.js bridge process
let ws = null;
let _url = 'ws://localhost:8080';
let _connected = false;

export function getWsUrl() { return _url; }
export function isConnected() { return _connected; }

export function connectWs(url) {
  if (url) _url = url;
  if (ws && ws.readyState < 2) ws.close();
  try {
    ws = new WebSocket(_url);
    ws.onopen  = () => { _connected = true;  console.log('[OSC] connected'); };
    ws.onerror = ()  => { _connected = false; };
    ws.onclose = ()  => { _connected = false; };
  } catch (e) {
    console.warn('[OSC] WebSocket connect failed', e);
  }
}

export function disconnectWs() {
  if (ws) { ws.close(); ws = null; }
  _connected = false;
}

// Send per-step data to M4L bridge
// step:      0–127
// bpm:       number
// hits:      { kick, snare, hat, perc }  velocity or 0
// yMod:      { kick, snare, hat, perc }  0–1
// fxParams:  { age, moisture, density, anastomosis, resonance, character }
// dlyParams: { mix, path, anastomosis, growthRate }
export function sendStep(step, bpm, hits, yMod, fxParams, dlyParams) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ step, bpm, hits, yMod, fxParams, dlyParams }));
}
