import { BANDS } from '../constants.js';

// Scan image → { result, yMod, scanY }
// result[track][step] = velocity (0 or 0.25–1.0)
// yMod[track][step]   = 0-1 (band-relative Y) → pan/filter/detune
// scanY[track][step]  = 0-1 (image-wide Y) → SVG path drawing
//
// Trigger fires at inflection points (corners) of luminance center-of-mass trace.
// sensitivity=0 → angle threshold=0 → fires everywhere (全鳴り)
// sensitivity=1 → only sharp corners fire
export function scanImage(dataUrl, steps, sensitivities) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const W = steps, H = 256;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const cx = c.getContext('2d');
      cx.filter = 'contrast(1.5) brightness(1.05)';
      cx.drawImage(img, 0, 0, W, H);
      const px = cx.getImageData(0, 0, W, H).data;
      const lum = (x, y) => {
        const i = (y * W + x) * 4;
        return (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
      };

      const result = { kick: [], snare: [], hat: [], perc: [] };
      const yMod   = { kick: [], snare: [], hat: [], perc: [] };
      const scanY  = { kick: [], snare: [], hat: [], perc: [] };

      BANDS.forEach((b, bi) => {
        const r0 = b.y0 * H | 0, r1 = b.y1 * H | 0, bH = r1 - r0;

        // Pass 1: luminance average + center-of-mass Y per column
        const lumAvg = new Float32Array(W);
        const comYs  = new Float32Array(W);
        for (let x = 0; x < W; x++) {
          let sL = 0, sLY = 0;
          for (let y = r0; y < r1; y++) { const l = lum(x, y); sL += l; sLY += l * y; }
          lumAvg[x] = sL / bH;
          comYs[x]  = sL > 0 ? sLY / sL : (r0 + r1) / 2;
        }

        // Pass 2: smooth Y trace (radius-3 box filter) before angle detection
        const smooth = new Float32Array(W);
        const R = 3;
        for (let x = 0; x < W; x++) {
          let sum = 0, n = 0;
          for (let d = -R; d <= R; d++) {
            const xi = x + d;
            if (xi >= 0 && xi < W) { sum += comYs[xi]; n++; }
          }
          smooth[x] = sum / n;
        }

        // Pass 3: angle at each vertex (between vectors prev→cur and cur→next)
        const angles = new Float32Array(W);
        const stepX = 1 / W;
        for (let x = 1; x < W - 1; x++) {
          const dy1 = smooth[x]     - smooth[x - 1];
          const dy2 = smooth[x + 1] - smooth[x];
          const dot  = stepX * stepX + dy1 * dy2;
          const mag  = Math.sqrt(stepX * stepX + dy1 * dy1) * Math.sqrt(stepX * stepX + dy2 * dy2);
          const cosA = mag > 0 ? Math.max(-1, Math.min(1, dot / mag)) : 1;
          angles[x]  = Math.acos(cosA);
        }
        angles[0] = angles[1]; angles[W - 1] = angles[W - 2];

        // Pass 4: threshold + velocity
        // sens=0 → thresh=0 → fires on any bend (全鳴り)
        // sens=1 → thresh=π×0.45 → only near-reversal corners
        const thresh = sensitivities[bi] * Math.PI * 0.45;

        for (let x = 0; x < W; x++) {
          const ang = angles[x];
          if (ang > thresh) {
            const angNorm = Math.min(1, ang / (Math.PI * 0.5));
            const vel = angNorm * lumAvg[x] * b.scale * 1.4;
            result[b.track].push(Math.max(0.25, Math.min(1, vel)));
          } else {
            result[b.track].push(0);
          }
          yMod[b.track].push((smooth[x] - r0) / bH);
          scanY[b.track].push(smooth[x] / H);
        }
      });

      resolve({ result, yMod, scanY });
    };
    img.src = dataUrl;
  });
}
