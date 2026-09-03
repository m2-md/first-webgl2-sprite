import { describe, it, expect } from "vitest";
import { pixelToClip, spriteQuad } from "../src/space";

describe("pixelToClip", () => {
  it("canvas center is the zero point of clip space", () => {
    const p = pixelToClip(400, 300, 800, 600);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it("top-left corner maps to (-1, +1)", () => {
    const p = pixelToClip(0, 0, 800, 600);
    expect(p.x).toBeCloseTo(-1);
    expect(p.y).toBeCloseTo(1);
  });

  it("bottom-right corner maps to (+1, -1) — y axis is inverted", () => {
    const p = pixelToClip(800, 600, 800, 600);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(-1);
  });
});

describe("spriteQuad", () => {
  it("produces 24 floats for 6 vertices × 4 components", () => {
    const q = spriteQuad(0, 0, 100, 100, 800, 600);
    expect(q.length).toBe(24);
  });

  it("sprite covering the full canvas fits exact clip corners", () => {
    const q = spriteQuad(0, 0, 800, 600, 800, 600);
    // First vertex = top-left: clip (-1, +1), UV (0, 0)
    expect(q[0]).toBeCloseTo(-1); // clipX
    expect(q[1]).toBeCloseTo(1); // clipY
    expect(q[2]).toBeCloseTo(0); // u
    expect(q[3]).toBeCloseTo(0); // v
  });

  it("rotation with 0 angle is identical to non-rotated quad", () => {
    const a = spriteQuad(100, 50, 96, 96, 800, 600, 0);
    const b = spriteQuad(100, 50, 96, 96, 800, 600);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("rotation preserves sprite center position at any angle", () => {
    const x = 300,
      y = 250,
      w = 200,
      h = 100,
      cw = 800,
      ch = 600;
    const expected = pixelToClip(x + w / 2, y + h / 2, cw, ch);

    for (const angle of [0, 0.4, Math.PI / 2, 2.1]) {
      const q = spriteQuad(x, y, w, h, cw, ch, angle);
      // four unique vertices: TL(0,1), BL(4,5), TR(8,9), BR(20,21)
      const cxClip = (q[0] + q[4] + q[8] + q[20]) / 4;
      const cyClip = (q[1] + q[5] + q[9] + q[21]) / 4;
      expect(cxClip).toBeCloseTo(expected.x);
      expect(cyClip).toBeCloseTo(expected.y);
    }
  });
});
