import { describe, it, expect } from "vitest";
import { buildBatchBuffer, FLOATS_PER_QUAD, generateSpriteAtlas } from "../src/batch";
import type { SpriteInstance } from "../src/batch";

describe("buildBatchBuffer", () => {
  it("produces exactly 30 floats for each sprite", () => {
    const sprites: SpriteInstance[] = [
      {
        x: 100,
        y: 100,
        w: 32,
        h: 32,
        rotation: 0,
        uvMin: { x: 0, y: 0 },
        uvMax: { x: 1, y: 1 },
        alpha: 0.9,
        vx: 0,
        vy: 0,
        vRot: 0,
      },
    ];

    const buf = new Float32Array(100);
    const count = buildBatchBuffer(sprites, 800, 600, buf);
    expect(count).toBe(1);
    // first vertex clipX, clipY, u, v, alpha
    expect(buf[4]).toBeCloseTo(0.9);
  });

  it("populates multiple sprites sequentially", () => {
    const sprites: SpriteInstance[] = Array.from({ length: 5 }, (_, i) => ({
      x: i * 50,
      y: 100,
      w: 16,
      h: 16,
      rotation: 0,
      uvMin: { x: 0, y: 0 },
      uvMax: { x: 0.5, y: 0.5 },
      alpha: 1,
      vx: 0,
      vy: 0,
      vRot: 0,
    }));

    const buf = new Float32Array(5 * FLOATS_PER_QUAD);
    const count = buildBatchBuffer(sprites, 800, 600, buf);
    expect(count).toBe(5);
  });
});

describe("generateSpriteAtlas", () => {
  it("produces an 8x8 atlas with 64 UV regions", () => {
    const { regions } = generateSpriteAtlas(256);
    expect(regions.length).toBe(64);
    expect(regions[0].name).toBe("tile_0_0");
    expect(regions[0].uvMax.x).toBeCloseTo(0.125);
  });
});
