# first-webgl2-sprite

<!-- LINKS:BEGIN — üretildi: scripts/sync-repo-links.py · elle düzenleme -->
**▶ [Live demo](https://m2-md.github.io/first-webgl2-sprite/)** · [Source](https://github.com/m2-md/first-webgl2-sprite)
<!-- LINKS:END -->

A minimal WebGL2 example that leaves behind the comfort of Canvas2D's `drawImage`
and talks to the GPU in its native language — clip space. Shader compilation, a
procedural texture (a checkerboard), a textured quad and the first WebGL2 sprite
spinning on screen. The first stone on the road to batching, which packs thousands
of sprites into a single draw call.

Article: `articles/first-webgl2-sprite/article.md`

## What's in here

| File | Contents |
|---|---|
| `src/shaders.ts` | The `VERTEX_SHADER` + `FRAGMENT_SHADER` GLSL constants (`#version 300 es` on the first line) |
| `src/gl.ts` | `compileShader` / `createProgram` — checked with `COMPILE_STATUS` / `LINK_STATUS` |
| `src/texture.ts` | `makeCheckerboard` (pure) + `createTexture` (`texImage2D`, `NEAREST`) |
| `src/space.ts` | `pixelToClip` + `spriteQuad` — pure clip-space math (tested) |
| `src/main.ts` | Demo: WebGL2 context, VAO, interleaved buffer, `requestAnimationFrame` loop |
| `src/batch.ts` | `buildBatchBuffer` + `generateSpriteAtlas` — 30 floats per quad, one draw call |
| `src/advanced.ts` + `advanced.html` | Batched demo: alpha blending, PNG atlas, many sprites |
| `src/bench-cli.ts` | Node bench: `pixelToClip` accuracy + `spriteQuad` throughput |
| `test/space.test.ts` | vitest: coordinate math (NO WebGL calls) |
| `test/batch.test.ts` | vitest: batch buffer layout + atlas UV regions |

## Setup

```bash
npm install
```

## Running

```bash
npm run dev      # Vite dev server — watch the checkerboard square spin in the browser
npm run build    # tsc + vite build (dist/)
npm test         # vitest — 10 pure-math tests
npm run bench    # coordinate math bench in Node
```

> `npm run dev` is required: the demo is served by Vite's module server. If you open
> `index.html` with `file://` the modules won't load and the screen stays blank.

## Expected output

### `npm test`

```
 ✓ test/batch.test.ts (3 tests)
 ✓ test/space.test.ts (7 tests)
 Test Files  2 passed (2)
      Tests  10 passed (10)
```

3 tests for `pixelToClip` (center / top-left / bottom-right y-flip), 4 tests for
`spriteQuad` (24 floats, full-canvas corners/UVs, zero-angle equality, rotation
preserves the center), and 3 tests for the batch path (30 floats per sprite,
multiple sprites written sequentially, an 8x8 atlas with 64 UV regions).

### `npm run bench`

```
== pixelToClip accuracy ==
  center       (400,300) -> clip(0.000, 0.000)  expected(0, 0)  OK
  top-left     (0,0) -> clip(-1.000, 1.000)  expected(-1, 1)  OK
  bottom-right (800,600) -> clip(1.000, -1.000)  expected(1, -1)  OK
  top-right    (800,0) -> clip(1.000, 1.000)  expected(1, 1)  OK
  bottom-left  (0,600) -> clip(-1.000, -1.000)  expected(-1, -1)  OK
  result: ALL CORRECT

== spriteQuad throughput ==
  2,000,000 quads in 620.0 ms
  3.2 M quad/s  (310.0 ns/quad)
  checksum: 57442.3876 (optimization barrier)
```

(The numbers vary from machine to machine.)

### `npm run dev`

On a dark navy background (`clearColor 0.06, 0.07, 0.12`), a square with a crisp
`NEAREST`-filtered checkerboard pattern travelling in a circular orbit around the
center of the screen while spinning on its own axis. The sprite is not upside down
(the y-flip is correct) and it rotates about its center.

## Note: why don't the tests call WebGL?

In a headless `vitest` (Node) environment there is no `WebGL2RenderingContext`, no
`canvas`, no GPU. The part where mistakes are made most often is the coordinate math
anyway — `pixelToClip` and `spriteQuad` were deliberately kept pure (numbers in,
numbers out) and tested deterministically. That the GPU draws the correct pixels is
verified by eye in the browser.

## License

MIT
