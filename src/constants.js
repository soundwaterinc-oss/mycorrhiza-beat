export const STEPS = 128;
export const SW = 4;
export const SG = 1;

export const BANDS = [
  { track: 'perc',  color: '#ff6a00', y0: 0,    y1: 0.25, scale: 0.65 },
  { track: 'hat',   color: '#00ffff', y0: 0.25, y1: 0.5,  scale: 0.70 },
  { track: 'snare', color: '#ff003c', y0: 0.5,  y1: 0.75, scale: 0.85 },
  { track: 'kick',  color: '#00ff41', y0: 0.75, y1: 1,    scale: 1.0  },
];

export const TRACKS = [
  { key: 'kick',  color: '#00ff41', h: 18 },
  { key: 'snare', color: '#ff003c', h: 7  },
  { key: 'hat',   color: '#00ffff', h: 4  },
  { key: 'perc',  color: '#ff6a00', h: 3  },
];

export const TRACK_KEYS = ['kick', 'snare', 'hat', 'perc'];

export const blank  = () => ({ kick: Array(STEPS).fill(0), snare: Array(STEPS).fill(0), hat: Array(STEPS).fill(0), perc: Array(STEPS).fill(0) });
export const blankY = () => ({ kick: Array(STEPS).fill(0.5), snare: Array(STEPS).fill(0.5), hat: Array(STEPS).fill(0.5), perc: Array(STEPS).fill(0.5) });

export const DEF_SENS = [0.55, 0.50, 0.55, 0.65];

export const DEF_MAPS = {
  kick:  { pan: true,  filter: false, detune: false },
  snare: { pan: true,  filter: true,  detune: false },
  hat:   { pan: true,  filter: true,  detune: false },
  perc:  { pan: true,  filter: false, detune: true  },
};

export const yToMod = (y, maps) => ({
  pan:    maps.pan    ? (y * 2 - 1) * 0.85         : 0,
  filter: maps.filter ? Math.pow(10, 3 + (1 - y))  : undefined,
  detune: maps.detune ? (1 - y) * 200 - 100        : undefined,
});
