// Saf koordinat matematiği bench'i (Node, WebGL yok).
// 1) pixelToClip'i bilinen giriş→çıkış çiftleriyle doğrular.
// 2) spriteQuad üretim hızını (köşe dönüşümü) ölçer.

import { pixelToClip, spriteQuad } from "./space";

interface Case {
  label: string;
  px: number;
  py: number;
  w: number;
  h: number;
  ex: number;
  ey: number;
}

const cases: Case[] = [
  { label: "merkez", px: 400, py: 300, w: 800, h: 600, ex: 0, ey: 0 },
  { label: "sol-üst", px: 0, py: 0, w: 800, h: 600, ex: -1, ey: 1 },
  { label: "sağ-alt", px: 800, py: 600, w: 800, h: 600, ex: 1, ey: -1 },
  { label: "sağ-üst", px: 800, py: 0, w: 800, h: 600, ex: 1, ey: 1 },
  { label: "sol-alt", px: 0, py: 600, w: 800, h: 600, ex: -1, ey: -1 },
];

console.log("== pixelToClip doğruluk ==");
let allOk = true;
for (const c of cases) {
  const p = pixelToClip(c.px, c.py, c.w, c.h);
  const ok = Math.abs(p.x - c.ex) < 1e-9 && Math.abs(p.y - c.ey) < 1e-9;
  allOk &&= ok;
  console.log(
    `  ${c.label.padEnd(8)} (${c.px},${c.py}) -> clip(${p.x.toFixed(3)}, ${p.y.toFixed(3)})  beklenen(${c.ex}, ${c.ey})  ${ok ? "OK" : "HATA"}`,
  );
}
console.log(`  sonuç: ${allOk ? "HEPSİ DOĞRU" : "HATALI"}`);

console.log("\n== spriteQuad throughput ==");
const N = 2_000_000;
// Isınma
let checksum = 0;
for (let i = 0; i < 50_000; i++) {
  const q = spriteQuad(100, 50, 96, 96, 800, 600, i * 0.001);
  checksum += q[0];
}

const start = performance.now();
for (let i = 0; i < N; i++) {
  const q = spriteQuad(100, 50, 96, 96, 800, 600, i * 0.0001);
  checksum += q[0] + q[21];
}
const ms = performance.now() - start;
const perSec = (N / ms) * 1000;

console.log(`  ${N.toLocaleString("tr-TR")} quad ${ms.toFixed(1)} ms`);
console.log(
  `  ${(perSec / 1e6).toFixed(2)} M quad/s  (${((ms / N) * 1e6).toFixed(1)} ns/quad)`,
);
console.log(`  checksum: ${checksum.toFixed(4)} (optimizasyon engeli)`);

if (!allOk) process.exit(1);
