import { useRef, useEffect, useState } from 'react';

// ── WebGL Gray-Scott Reaction-Diffusion ──────────────────────────────────────
// du/dt = Du·∇²u − u·v² + F·(1−u)
// dv/dt = Dv·∇²v + u·v² − (F+k)·v
// Du=0.16, Dv=0.08 — ping-pong framebuffer at source image resolution

const VERT = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const SIM_FRAG = `
  precision highp float;
  uniform sampler2D u_state;
  uniform vec2 u_res;
  uniform float u_F;
  uniform float u_k;
  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    vec2 px = 1.0 / u_res;
    vec2 c = texture2D(u_state, uv).rg;
    vec2 n = texture2D(u_state, uv + vec2(0.0,  px.y)).rg;
    vec2 s = texture2D(u_state, uv - vec2(0.0,  px.y)).rg;
    vec2 e = texture2D(u_state, uv + vec2(px.x,  0.0)).rg;
    vec2 w = texture2D(u_state, uv - vec2(px.x,  0.0)).rg;
    float u = c.r; float v = c.g;
    float Lu = n.r + s.r + e.r + w.r - 4.0 * u;
    float Lv = n.g + s.g + e.g + w.g - 4.0 * v;
    float uvv = u * v * v;
    float nu = clamp(u + 0.16 * Lu - uvv + u_F * (1.0 - u), 0.0, 1.0);
    float nv = clamp(v + 0.08 * Lv + uvv - (u_F + u_k) * v, 0.0, 1.0);
    gl_FragColor = vec4(nu, nv, 0.0, 1.0);
  }
`;

const DRAW_FRAG = `
  precision highp float;
  uniform sampler2D u_state;
  uniform sampler2D u_orig;
  uniform vec2 u_res;
  uniform float u_blend;
  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    vec2 st = texture2D(u_state, uv).rg;
    vec4 orig = texture2D(u_orig, uv);
    float u = st.r; float v = st.g;
    vec4 rd = vec4(u * 0.549, v, (1.0 - u) * 0.353 + v * 0.392, 1.0);
    gl_FragColor = mix(rd, orig, u_blend);
  }
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function link(gl, vs, fs) {
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

function makeTex(gl, W, H, data) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, data ?? null);
  return tex;
}

function makeFBO(gl, tex) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fb;
}

function initGL(canvas, imageData, W, H) {
  const gl = canvas.getContext('webgl');
  if (!gl) return null;

  const vert = compile(gl, gl.VERTEX_SHADER, VERT);
  const simProg  = link(gl, vert, compile(gl, gl.FRAGMENT_SHADER, SIM_FRAG));
  const drawProg = link(gl, vert, compile(gl, gl.FRAGMENT_SHADER, DRAW_FRAG));

  // Fullscreen quad
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  // Seed state from image: bright hyphae → activator v, dark soil → inhibitor u
  const N = W * H;
  const seed = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const l = (imageData[i*4]*0.299 + imageData[i*4+1]*0.587 + imageData[i*4+2]*0.114) / 255;
    const u = 0.5 + (1-l)*0.45 + (Math.random()-0.5)*0.025;
    const v = l*0.28 + (Math.random() < 0.004 ? Math.random()*0.5 : 0);
    seed[i*4]   = Math.min(255, u * 255);
    seed[i*4+1] = Math.min(255, v * 255);
    seed[i*4+2] = 0;
    seed[i*4+3] = 255;
  }

  // Ping-pong textures + framebuffers
  const texA = makeTex(gl, W, H, seed);
  const texB = makeTex(gl, W, H, null);
  const fboA = makeFBO(gl, texA);
  const fboB = makeFBO(gl, texB);

  // Original image texture (for blending)
  const origTex = makeTex(gl, W, H, imageData);

  let ping = { tex: texA, fbo: fboA };
  let pong = { tex: texB, fbo: fboB };

  function setupQuad(prog) {
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  function step(F, k, stepsPerFrame) {
    setupQuad(simProg);
    gl.uniform2f(gl.getUniformLocation(simProg, 'u_res'), W, H);
    gl.uniform1f(gl.getUniformLocation(simProg, 'u_F'), F);
    gl.uniform1f(gl.getUniformLocation(simProg, 'u_k'), k);

    for (let s = 0; s < stepsPerFrame; s++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, pong.fbo);
      gl.viewport(0, 0, W, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ping.tex);
      gl.uniform1i(gl.getUniformLocation(simProg, 'u_state'), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const tmp = ping; ping = pong; pong = tmp;
    }
  }

  function draw(blend, displayCanvas) {
    setupQuad(drawProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, displayCanvas.width, displayCanvas.height);
    gl.uniform2f(gl.getUniformLocation(drawProg, 'u_res'), displayCanvas.width, displayCanvas.height);
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_blend'), blend);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ping.tex);
    gl.uniform1i(gl.getUniformLocation(drawProg, 'u_state'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, origTex);
    gl.uniform1i(gl.getUniformLocation(drawProg, 'u_orig'), 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function readPixels() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, ping.fbo);
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return px;
  }

  return { step, draw, readPixels, gl };
}

export function useGenerativeRD(srcUrl, enabled, rdP) {
  const glRef    = useRef(null);  // WebGL context object
  const canvasRef = useRef(null); // offscreen GL canvas (simulation target)
  const dispRef  = useRef(null);  // visible display canvas (DOM-attached)
  const rafRef   = useRef(null);
  const pRef     = useRef(rdP);
  const imgDimRef = useRef({ W: 0, H: 0, data: null });
  const [gen, setGen] = useState(0);

  useEffect(() => { pRef.current = rdP; }, [rdP]);

  useEffect(() => {
    if (!enabled || !srcUrl) {
      cancelAnimationFrame(rafRef.current);
      glRef.current = null;
      return;
    }

    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth  || img.width  || 800;
      const H = img.naturalHeight || img.height || 400;

      // Extract image pixel data at native resolution
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      const cx = tmp.getContext('2d');
      cx.drawImage(img, 0, 0);
      const imageData = cx.getImageData(0, 0, W, H).data;
      imgDimRef.current = { W, H, data: new Uint8Array(imageData) };

      // Create offscreen WebGL canvas at image resolution
      const glCanvas = document.createElement('canvas');
      glCanvas.width = W; glCanvas.height = H;
      canvasRef.current = glCanvas;

      try {
        glRef.current = initGL(glCanvas, imgDimRef.current.data, W, H);
      } catch (e) {
        console.warn('[RD] WebGL init failed, falling back to CPU', e);
        glRef.current = null;
        return;
      }

      let frameCount = 0;
      const loop = () => {
        const gl = glRef.current;
        if (!gl) return;
        const { F, k, spf, blend } = pRef.current;

        gl.step(F, k, spf);
        frameCount++;

        if (dispRef.current) {
          gl.draw(blend, dispRef.current);
        }

        setGen(g => g + 1);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    };
    img.src = srcUrl;

    return () => {
      cancelAnimationFrame(rafRef.current);
      glRef.current = null;
    };
  }, [enabled, srcUrl]);

  // Capture current RD state as data URL for re-scanning
  const getDataUrl = () => {
    if (!dispRef.current) return null;
    return dispRef.current.toDataURL('image/jpeg', 0.85);
  };

  return { dispRef, gen, getDataUrl };
}
