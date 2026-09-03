import { VERTEX_SHADER, FRAGMENT_SHADER } from "./shaders";
import { createProgram } from "./gl";
import { makeCheckerboard, createTexture } from "./texture";
import { spriteQuad } from "./space";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const gl = canvas.getContext("webgl2");

if (!gl) {
  document.body.innerHTML =
    "<p>Bu tarayıcı WebGL2 desteklemiyor. Canvas2D'ye düşmek gerek 😢</p>";
  throw new Error("WebGL2 context alınamadı");
}

const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
gl.useProgram(program);

// attribute ve uniform konumlarını programdan sor
const aClip = gl.getAttribLocation(program, "a_clip");
const aUv = gl.getAttribLocation(program, "a_uv");
const uTexture = gl.getUniformLocation(program, "u_texture");

// VAO: attribute yapılandırmasını hatırlayan nesne
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

const FLOAT = Float32Array.BYTES_PER_ELEMENT;
const STRIDE = 4 * FLOAT; // köşe başına 4 float: clipX, clipY, u, v

// a_clip: her köşenin ilk 2 float'ı
gl.enableVertexAttribArray(aClip);
gl.vertexAttribPointer(aClip, 2, gl.FLOAT, false, STRIDE, 0);

// a_uv: her köşenin sonraki 2 float'ı (2 float ötelenmiş)
gl.enableVertexAttribArray(aUv);
gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, STRIDE, 2 * FLOAT);

const { data, size } = makeCheckerboard(64, 8);
const texture = createTexture(gl, data, size);

gl.activeTexture(gl.TEXTURE0); // 0 numaralı birim
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.uniform1i(uTexture, 0); // sampler'a "0'ı kullan" de

// Canvas'ı ekrana göre boyutla (devicePixelRatio, en fazla 2x)
const resize = () => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
};
window.addEventListener("resize", resize);
resize();

const SPRITE = 96; // piksel

const fpsEl = document.querySelector<HTMLElement>("#fps-val");
let lastTime = performance.now();
let frameCount = 0;

const frame = (now: number) => {
  frameCount++;
  if (now - lastTime >= 500) {
    if (fpsEl) fpsEl.textContent = Math.round((frameCount * 1000) / (now - lastTime)).toString();
    frameCount = 0;
    lastTime = now;
  }

  const t = now / 1000;

  // Ekran merkezinde dairesel yörünge
  const orbit = Math.min(canvas.width, canvas.height) * 0.25;
  const x = canvas.width / 2 - SPRITE / 2 + Math.cos(t) * orbit;
  const y = canvas.height / 2 - SPRITE / 2 + Math.sin(t) * orbit;

  // Piksel düşüncesi → clip-space; sözlüğümüz her karede çalışıyor
  const verts = spriteQuad(x, y, SPRITE, SPRITE, canvas.width, canvas.height, t);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);

  gl.clearColor(0.06, 0.07, 0.12, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

