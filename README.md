# first-webgl2-sprite

Canvas2D'nin `drawImage` konforunu bırakıp GPU'nun ana diliyle — clip-space —
konuşan minimal bir WebGL2 örneği. Shader derleme, prosedürel bir doku (dama
tahtası), dokulu bir quad ve ekranda dönen ilk WebGL2 sprite'ı. Binlerce sprite'ı
tek draw call'a paketleyen batching'e giden yolun ilk taşı.

Makale: `articles/first-webgl2-sprite/article.md`

## Ne var burada

| Dosya | İçerik |
|---|---|
| `src/shaders.ts` | `VERTEX_SHADER` + `FRAGMENT_SHADER` GLSL sabitleri (`#version 300 es` ilk satır) |
| `src/gl.ts` | `compileShader` / `createProgram` — `COMPILE_STATUS` / `LINK_STATUS` kontrollü |
| `src/texture.ts` | `makeCheckerboard` (saf) + `createTexture` (`texImage2D`, `NEAREST`) |
| `src/space.ts` | `pixelToClip` + `spriteQuad` — saf clip-space matematiği (test edilir) |
| `src/main.ts` | Demo: WebGL2 context, VAO, interleaved buffer, `requestAnimationFrame` döngüsü |
| `src/bench-cli.ts` | Node bench: `pixelToClip` doğruluk + `spriteQuad` throughput |
| `test/space.test.ts` | vitest: koordinat matematiği (WebGL çağrısı YOK) |

## Kurulum

```bash
npm install
```

## Çalıştırma

```bash
npm run dev      # Vite dev server — tarayıcıda dönen dama karesini izle
npm run build    # tsc --noEmit + vite build (dist/)
npm test         # vitest — 7 saf matematik testi
npm run bench    # Node'da koordinat matematiği bench'i
```

> `npm run dev` şart: demo Vite modül sunucusuyla açılır. `index.html`'i `file://`
> ile açarsanız modüller yüklenmez, ekran boş kalır.

## Beklenen çıktı

### `npm test`

```
 ✓ test/space.test.ts (7 tests)
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

3 test `pixelToClip` (merkez / sol-üst / sağ-alt y-flip), 4 test `spriteQuad`
(24 float, tam-canvas köşe/UV, 0-açı eşitliği, dönüş merkezi korur).

### `npm run bench`

```
== pixelToClip doğruluk ==
  merkez   (400,300) -> clip(0.000, 0.000)  beklenen(0, 0)  OK
  sol-üst  (0,0) -> clip(-1.000, 1.000)  beklenen(-1, 1)  OK
  sağ-alt  (800,600) -> clip(1.000, -1.000)  beklenen(1, -1)  OK
  sağ-üst  (800,0) -> clip(1.000, 1.000)  beklenen(1, 1)  OK
  sol-alt  (0,600) -> clip(-1.000, -1.000)  beklenen(-1, -1)  OK
  sonuç: HEPSİ DOĞRU

== spriteQuad throughput ==
  2.000.000 quad ~620 ms
  ~3.2 M quad/s  (~310 ns/quad)
```

(Sayılar makineye göre değişir.)

### `npm run dev`

Koyu lacivert zeminde (`clearColor 0.06, 0.07, 0.12`), ekran merkezinde dairesel
yörüngede dolaşan ve kendi ekseninde dönen, `NEAREST` filtreli keskin dama deseni
bir kare. Sprite baş aşağı değil (y-flip doğru) ve merkezinde döner.

## Not: neden testler WebGL çağırmıyor?

Headless `vitest` (Node) ortamında `WebGL2RenderingContext`, `canvas`, GPU yoktur.
En çok hata yapılan kısım zaten koordinat matematiği — `pixelToClip` ve `spriteQuad`
bilinçli olarak saf tutuldu (girdi sayı, çıktı sayı) ve deterministik test edildi.
GPU'nun doğru pikselleri çizdiği tarayıcıda gözle doğrulanır.

## Lisans

MIT
