import { createProgram } from "./gl";
import {
  createBatchShaders,
  generateSpriteAtlas,
  buildBatchBuffer,
  FLOATS_PER_QUAD,
  VERTEX_STRIDE_FLOATS,
} from "./batch";
import type { SpriteInstance } from "./batch";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const gl = canvas.getContext("webgl2");

if (!gl) {
  document.body.innerHTML = "<p style='color:white;padding:20px'>WebGL2 not supported 😢</p>";
  throw new Error("Could not acquire WebGL2 context");
}

// 1. Enable Alpha Blending
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// 2. Compile Batch Shader Program
const { vertexShader, fragmentShader } = createBatchShaders();
const program = createProgram(gl, vertexShader, fragmentShader);
gl.useProgram(program);

const aClip = gl.getAttribLocation(program, "a_clip");
const aUv = gl.getAttribLocation(program, "a_uv");
const aAlpha = gl.getAttribLocation(program, "a_alpha");
const uTexture = gl.getUniformLocation(program, "u_texture");

// 3. Buffer Configuration (supports up to 25,000 sprites)
const MAX_SPRITES = 25000;
const MAX_FLOATS = MAX_SPRITES * FLOATS_PER_QUAD;
const cpuBuffer = new Float32Array(MAX_FLOATS);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, cpuBuffer.byteLength, gl.DYNAMIC_DRAW);

const FLOAT = Float32Array.BYTES_PER_ELEMENT;
const STRIDE = VERTEX_STRIDE_FLOATS * FLOAT; // 20 byte

gl.enableVertexAttribArray(aClip);
gl.vertexAttribPointer(aClip, 2, gl.FLOAT, false, STRIDE, 0);

gl.enableVertexAttribArray(aUv);
gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, STRIDE, 2 * FLOAT);

gl.enableVertexAttribArray(aAlpha);
gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, STRIDE, 4 * FLOAT);

// 4. Create Spritesheet Atlas texture
const { canvas: atlasCanvas, regions } = generateSpriteAtlas(512);

let currentTexture = gl.createTexture()!;
const initTexture = (source: HTMLCanvasElement | HTMLImageElement) => {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, currentTexture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // Load Y axis right side up
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(uTexture, 0);
};

initTexture(atlasCanvas);

// Load Default Artistic Image
const defaultArtisticImg = new Image();
defaultArtisticImg.onload = () => {
  if (!isCustomTexture) {
    initTexture(defaultArtisticImg);
  }
};
defaultArtisticImg.src = "/artistic_atlas.jpg";

// 5. Canvas Resizing
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

// 6. Create Sprite Instances
let targetSpriteCount = 2500;
let isCustomTexture = false;
let customAspect = 1;
const sprites: SpriteInstance[] = [];

const spawnSprite = (): SpriteInstance => {
  const reg = regions[Math.floor(Math.random() * regions.length)];
  const baseSize = 24 + Math.random() * 40;
  const w = isCustomTexture ? baseSize * customAspect : baseSize;
  const h = baseSize;

  return {
    x: Math.random() * (canvas.width || 800),
    y: Math.random() * (canvas.height || 600),
    w,
    h,
    rotation: isCustomTexture ? 0 : Math.random() * Math.PI * 2,
    uvMin: isCustomTexture ? { x: 0, y: 0 } : reg.uvMin,
    uvMax: isCustomTexture ? { x: 1, y: 1 } : reg.uvMax,
    alpha: 0.8 + Math.random() * 0.2,
    vx: (Math.random() - 0.5) * 150,
    vy: (Math.random() - 0.5) * 150,
    vRot: isCustomTexture ? 0.2 : (Math.random() - 0.5) * 3,
  };
};

const syncSpriteCount = () => {
  while (sprites.length < targetSpriteCount) {
    sprites.push(spawnSprite());
  }
  if (sprites.length > targetSpriteCount) {
    sprites.length = targetSpriteCount;
  }

  // If 1 sprite, center on screen and display large
  if (targetSpriteCount === 1 && sprites.length > 0) {
    const s = sprites[0];
    const cw = canvas.width || 800;
    const ch = canvas.height || 600;
    const targetH = ch * 0.6;
    s.h = targetH;
    s.w = isCustomTexture ? targetH * customAspect : targetH;
    s.x = cw / 2;
    s.y = ch / 2;
    s.vx = 0;
    s.vy = 0;
    s.rotation = 0;
    s.vRot = 0;
    s.alpha = 1.0;
  }
};
syncSpriteCount();

// 7. User Controls (UI Events)
const slider = document.querySelector<HTMLInputElement>("#sprite-slider")!;
const countLabel = document.querySelector<HTMLElement>("#count-label")!;
const spriteCountVal = document.querySelector<HTMLElement>("#sprite-count-val")!;
const blendToggle = document.querySelector<HTMLInputElement>("#blend-toggle")!;
const blendStatusVal = document.querySelector<HTMLElement>("#blend-status-val")!;
const textureTypeVal = document.querySelector<HTMLElement>("#texture-type-val")!;
const pngUpload = document.querySelector<HTMLInputElement>("#png-upload")!;
const resetAtlasBtn = document.querySelector<HTMLButtonElement>("#reset-atlas-btn")!;
const fpsVal = document.querySelector<HTMLElement>("#fps-val")!;

slider?.addEventListener("input", () => {
  targetSpriteCount = parseInt(slider.value, 10);
  if (countLabel) countLabel.textContent = targetSpriteCount.toString();
  if (spriteCountVal) spriteCountVal.textContent = targetSpriteCount.toLocaleString();
  syncSpriteCount();
});

blendToggle?.addEventListener("change", () => {
  if (blendToggle.checked) {
    gl.enable(gl.BLEND);
    if (blendStatusVal) {
      blendStatusVal.textContent = "ON";
      blendStatusVal.classList.add("highlight");
    }
  } else {
    gl.disable(gl.BLEND);
    if (blendStatusVal) {
      blendStatusVal.textContent = "OFF";
      blendStatusVal.classList.remove("highlight");
    }
  }
});

pngUpload?.addEventListener("change", (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;
    if (!dataUrl) return;

    const img = new Image();
    img.onload = () => {
      initTexture(img);
      isCustomTexture = true;
      customAspect = img.width / img.height;

      if (textureTypeVal) {
        textureTypeVal.textContent = `Loaded: ${img.width}x${img.height}`;
      }
      if (resetAtlasBtn) {
        resetAtlasBtn.style.display = "block";
      }

      // Update sprites to new texture aspect ratio and UVs
      for (const s of sprites) {
        s.uvMin = { x: 0, y: 0 };
        s.uvMax = { x: 1, y: 1 };
        s.w = s.h * customAspect;
      }
      syncSpriteCount();
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
});

resetAtlasBtn?.addEventListener("click", () => {
  if (defaultArtisticImg.complete) {
    initTexture(defaultArtisticImg);
  } else {
    initTexture(atlasCanvas);
  }
  isCustomTexture = false;
  customAspect = 1;
  if (textureTypeVal) textureTypeVal.textContent = "Artistic Atlas (8x8 Grid)";
  if (resetAtlasBtn) resetAtlasBtn.style.display = "none";
  if (pngUpload) pngUpload.value = "";

  for (let i = 0; i < sprites.length; i++) {
    const reg = regions[i % regions.length];
    sprites[i].uvMin = reg.uvMin;
    sprites[i].uvMax = reg.uvMax;
    sprites[i].w = 24 + Math.random() * 40;
    sprites[i].h = sprites[i].w;
  }
  syncSpriteCount();
});

// 8. Render Loop
let lastTime = performance.now();
let frameCount = 0;

const frame = (now: number) => {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  frameCount++;

  if (now - lastTime >= 500) {
    if (fpsVal) fpsVal.textContent = Math.round((frameCount * 1000) / (now - lastTime)).toString();
    frameCount = 0;
    lastTime = now;
  }

  // Motion update (Physics & Edge Bouncing)
  const cw = canvas.width;
  const ch = canvas.height;
  for (let i = 0; i < sprites.length; i++) {
    const s = sprites[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.rotation += s.vRot * dt;

    if (s.x < 0) { s.x = 0; s.vx *= -1; }
    if (s.x > cw) { s.x = cw; s.vx *= -1; }
    if (s.y < 0) { s.y = 0; s.vy *= -1; }
    if (s.y > ch) { s.y = ch; s.vy *= -1; }
  }

  // Populate CPU buffer
  const renderedCount = buildBatchBuffer(sprites, cw, ch, cpuBuffer);
  const floatCount = renderedCount * FLOATS_PER_QUAD;

  // Update GPU Buffer (single SubData transfer)
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, cpuBuffer.subarray(0, floatCount));

  // Clear and render with a single Draw Call!
  gl.clearColor(0.05, 0.06, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.drawArrays(gl.TRIANGLES, 0, renderedCount * 6);

  requestAnimationFrame(frame);
};

requestAnimationFrame(frame);
