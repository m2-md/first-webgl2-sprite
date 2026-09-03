// Pure coordinate math benchmark (Node, no WebGL).
// 1) Validates pixelToClip with known input-output pairs.
// 2) Measures spriteQuad throughput (vertex transform).

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
  { label: "center", px: 400, py: 300, w: 800, h: 600, ex: 0, ey: 0 },
  { label: "top-left", px: 0, py: 0, w: 800, h: 600, ex: -1, ey: 1 },
  { label: "bottom-right", px: 800, py: 600, w: 800, h: 600, ex: 1, ey: -1 },
  { label: "top-right", px: 800, py: 0, w: 800, h: 600, ex: 1, ey: 1 },
  { label: "bottom-left", px: 0, py: 600, w: 800, h: 600, ex: -1, ey: -1 },
];

console.log("== pixelToClip accuracy ==");
let allOk = true;
for (const c of cases) {
  const p = pixelToClip(c.px, c.py, c.w, c.h);
  const ok = Math.abs(p.x - c.ex) < 1e-9 && Math.abs(p.y - c.ey) < 1e-9;
  allOk &&= ok;
  console.log(
    `  ${c.label.padEnd(12)} (${c.px},${c.py}) -> clip(${p.x.toFixed(3)}, ${p.y.toFixed(3)})  expected(${c.ex}, ${c.ey})  ${ok ? "OK" : "ERROR"}`,
  );
}
console.log(`  result: ${allOk ? "ALL CORRECT" : "FAILED"}`);

console.log("\n== spriteQuad throughput ==");
const N = 2_000_000;
// Warmup
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

console.log(`  ${N.toLocaleString("en-US")} quads in ${ms.toFixed(1)} ms`);
console.log(
  `  ${(perSec / 1e6).toFixed(2)} M quad/s  (${((ms / N) * 1e6).toFixed(1)} ns/quad)`,
);
console.log(`  checksum: ${checksum.toFixed(4)} (optimization barrier)`);

if (!allOk) process.exit(1);
