import { pixelToClip } from "./space";
import type { Vec2 } from "./space";

export interface SpriteInstance {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  uvMin: Vec2; // [u0, v0]
  uvMax: Vec2; // [u1, v1]
  alpha: number;
  vx: number;
  vy: number;
  vRot: number;
}

export interface AtlasRegion {
  name: string;
  uvMin: Vec2;
  uvMax: Vec2;
}

// 5 float per vertex: clipX, clipY, u, v, alpha
export const VERTEX_STRIDE_FLOATS = 5;
export const FLOATS_PER_QUAD = 6 * VERTEX_STRIDE_FLOATS; // 30 floats per quad

export function createBatchShaders() {
  const vertexShader = `#version 300 es
in vec2 a_clip;
in vec2 a_uv;
in float a_alpha;

out vec2 v_uv;
out float v_alpha;

void main() {
  v_uv = a_uv;
  v_alpha = a_alpha;
  gl_Position = vec4(a_clip, 0.0, 1.0);
}
`;

  const fragmentShader = `#version 300 es
precision mediump float;

in vec2 v_uv;
in float v_alpha;

uniform sampler2D u_texture;
out vec4 outColor;

void main() {
  vec4 texColor = texture(u_texture, v_uv);
  outColor = vec4(texColor.rgb, texColor.a * v_alpha);
}
`;

  return { vertexShader, fragmentShader };
}

export function getAtlasRegions(): AtlasRegion[] {
  const regions: AtlasRegion[] = [];
  const cols = 8;
  const rows = 8;
  const stepX = 1 / cols;
  const stepY = 1 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      regions.push({
        name: `tile_${r}_${c}`,
        uvMin: { x: c * stepX, y: r * stepY },
        uvMax: { x: (c + 1) * stepX, y: (r + 1) * stepY },
      });
    }
  }
  return regions;
}

/**
 * Şeffaf alpha kanallı bir Spritesheet / Atlas oluşturan yardımcı fonksiyon.
 */
export function generateSpriteAtlas(size = 512): {
  canvas: HTMLCanvasElement;
  regions: AtlasRegion[];
} {
  if (typeof document === "undefined") {
    return { canvas: null as any, regions: getAtlasRegions() };
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, size, size);

  // 2x2 grid = 4 sprite tipi
  const half = size / 2;

  // 1. Yıldız (Sol Üst)
  ctx.save();
  ctx.translate(half / 2, half / 2);
  const grad1 = ctx.createRadialGradient(0, 0, 10, 0, 0, half / 2 - 10);
  grad1.addColorStop(0, "rgba(255, 230, 100, 1)");
  grad1.addColorStop(0.5, "rgba(255, 180, 0, 0.8)");
  grad1.addColorStop(1, "rgba(255, 140, 0, 0)");
  ctx.fillStyle = grad1;
  ctx.beginPath();
  ctx.arc(0, 0, half / 2 - 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Mavi Mücevher (Sağ Üst)
  ctx.save();
  ctx.translate(half + half / 2, half / 2);
  const grad2 = ctx.createRadialGradient(0, 0, 10, 0, 0, half / 2 - 10);
  grad2.addColorStop(0, "rgba(0, 240, 255, 1)");
  grad2.addColorStop(0.6, "rgba(0, 100, 255, 0.7)");
  grad2.addColorStop(1, "rgba(0, 50, 200, 0)");
  ctx.fillStyle = grad2;
  ctx.beginPath();
  ctx.arc(0, 0, half / 2 - 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. Kırmızı Alev / Enerji (Sol Alt)
  ctx.save();
  ctx.translate(half / 2, half + half / 2);
  const grad3 = ctx.createRadialGradient(0, 0, 10, 0, 0, half / 2 - 10);
  grad3.addColorStop(0, "rgba(255, 80, 120, 1)");
  grad3.addColorStop(0.5, "rgba(220, 20, 60, 0.8)");
  grad3.addColorStop(1, "rgba(150, 0, 40, 0)");
  ctx.fillStyle = grad3;
  ctx.beginPath();
  ctx.arc(0, 0, half / 2 - 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Yeşil Küre (Sağ Alt)
  ctx.save();
  ctx.translate(half + half / 2, half + half / 2);
  const grad4 = ctx.createRadialGradient(0, 0, 10, 0, 0, half / 2 - 10);
  grad4.addColorStop(0, "rgba(50, 255, 150, 1)");
  grad4.addColorStop(0.6, "rgba(10, 180, 90, 0.7)");
  grad4.addColorStop(1, "rgba(0, 100, 40, 0)");
  ctx.fillStyle = grad4;
  ctx.beginPath();
  ctx.arc(0, 0, half / 2 - 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return { canvas, regions: getAtlasRegions() };
}

/**
 * CPU üzerindeki tüm sprite nesnelerini tek bir Float32Array içinde 
 * 6 köşe × 5 float olarak toplar.
 */
export function buildBatchBuffer(
  sprites: SpriteInstance[],
  canvasW: number,
  canvasH: number,
  outputBuffer: Float32Array,
): number {
  let offset = 0;
  const count = Math.min(sprites.length, Math.floor(outputBuffer.length / FLOATS_PER_QUAD));

  for (let i = 0; i < count; i++) {
    const s = sprites[i];
    const w2 = s.w / 2;
    const h2 = s.h / 2;

    const cos = Math.cos(s.rotation);
    const sin = Math.sin(s.rotation);

    // Sprite merkez etrafındaki yerel köşeler (-w2..w2, -h2..h2)
    // Sol-üst, sağ-üst, sol-alt, sağ-alt
    const lx1 = -w2, ly1 = -h2;
    const lx2 = w2,  ly2 = -h2;
    const lx3 = -w2, ly3 = h2;
    const lx4 = w2,  ly4 = h2;

    // Dönüş ve dünya piksel konumu
    const px1 = s.x + (lx1 * cos - ly1 * sin);
    const py1 = s.y + (lx1 * sin + ly1 * cos);

    const px2 = s.x + (lx2 * cos - ly2 * sin);
    const py2 = s.y + (lx2 * sin + ly2 * cos);

    const px3 = s.x + (lx3 * cos - ly3 * sin);
    const py3 = s.y + (lx3 * sin + ly3 * cos);

    const px4 = s.x + (lx4 * cos - ly4 * sin);
    const py4 = s.y + (lx4 * sin + ly4 * cos);

    // Clip Space dönüşümü
    const c1 = pixelToClip(px1, py1, canvasW, canvasH);
    const c2 = pixelToClip(px2, py2, canvasW, canvasH);
    const c3 = pixelToClip(px3, py3, canvasW, canvasH);
    const c4 = pixelToClip(px4, py4, canvasW, canvasH);

    const u0 = s.uvMin.x, v0 = s.uvMin.y;
    const u1 = s.uvMax.x, v1 = s.uvMax.y;
    const a = s.alpha;

    // 2 Üçgen: (c1, c3, c2) ve (c2, c3, c4)
    // Üçgen 1: Sol Üst, Sol Alt, Sağ Üst
    outputBuffer[offset++] = c1.x; outputBuffer[offset++] = c1.y; outputBuffer[offset++] = u0; outputBuffer[offset++] = v0; outputBuffer[offset++] = a;
    outputBuffer[offset++] = c3.x; outputBuffer[offset++] = c3.y; outputBuffer[offset++] = u0; outputBuffer[offset++] = v1; outputBuffer[offset++] = a;
    outputBuffer[offset++] = c2.x; outputBuffer[offset++] = c2.y; outputBuffer[offset++] = u1; outputBuffer[offset++] = v0; outputBuffer[offset++] = a;

    // Üçgen 2: Sağ Üst, Sol Alt, Sağ Alt
    outputBuffer[offset++] = c2.x; outputBuffer[offset++] = c2.y; outputBuffer[offset++] = u1; outputBuffer[offset++] = v0; outputBuffer[offset++] = a;
    outputBuffer[offset++] = c3.x; outputBuffer[offset++] = c3.y; outputBuffer[offset++] = u0; outputBuffer[offset++] = v1; outputBuffer[offset++] = a;
    outputBuffer[offset++] = c4.x; outputBuffer[offset++] = c4.y; outputBuffer[offset++] = u1; outputBuffer[offset++] = v1; outputBuffer[offset++] = a;
  }

  return count;
}
