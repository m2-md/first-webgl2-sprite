import { describe, it, expect } from "vitest";
import { pixelToClip, spriteQuad } from "../src/space";

describe("pixelToClip", () => {
  it("canvas'ın merkezi clip-space'in sıfır noktasıdır", () => {
    const p = pixelToClip(400, 300, 800, 600);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it("sol üst köşe (-1, +1)'e gider", () => {
    const p = pixelToClip(0, 0, 800, 600);
    expect(p.x).toBeCloseTo(-1);
    expect(p.y).toBeCloseTo(1);
  });

  it("sağ alt köşe (+1, -1)'e gider — y ekseni ters", () => {
    const p = pixelToClip(800, 600, 800, 600);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(-1);
  });
});

describe("spriteQuad", () => {
  it("6 köşe × 4 bileşen = 24 float üretir", () => {
    const q = spriteQuad(0, 0, 100, 100, 800, 600);
    expect(q.length).toBe(24);
  });

  it("tüm canvas'ı kaplayan sprite tam clip köşelerine oturur", () => {
    const q = spriteQuad(0, 0, 800, 600, 800, 600);
    // İlk köşe = sol üst: clip (-1, +1), UV (0, 0)
    expect(q[0]).toBeCloseTo(-1); // clipX
    expect(q[1]).toBeCloseTo(1); // clipY
    expect(q[2]).toBeCloseTo(0); // u
    expect(q[3]).toBeCloseTo(0); // v
  });

  it("0 açılı dönüş, dönüşsüz quad ile birebir aynıdır", () => {
    const a = spriteQuad(100, 50, 96, 96, 800, 600, 0);
    const b = spriteQuad(100, 50, 96, 96, 800, 600);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("dönüş, sprite merkezini yerinde tutar (her açıda)", () => {
    const x = 300,
      y = 250,
      w = 200,
      h = 100,
      cw = 800,
      ch = 600;
    const expected = pixelToClip(x + w / 2, y + h / 2, cw, ch);

    for (const angle of [0, 0.4, Math.PI / 2, 2.1]) {
      const q = spriteQuad(x, y, w, h, cw, ch, angle);
      // Dört benzersiz köşe: TL(0,1), BL(4,5), TR(8,9), BR(20,21)
      const cxClip = (q[0] + q[4] + q[8] + q[20]) / 4;
      const cyClip = (q[1] + q[5] + q[9] + q[21]) / 4;
      expect(cxClip).toBeCloseTo(expected.x);
      expect(cyClip).toBeCloseTo(expected.y);
    }
  });
});
