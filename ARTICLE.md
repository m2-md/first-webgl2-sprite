# Tercümanı Kovmak: İlk WebGL2 Sprite'ın, Shader'lar ve Canvas2D'den Clip-Space'e

*Canvas2D'nin `drawImage` konforunu bırakıp GPU'nun ana diliyle — clip-space — konuşuyoruz: shader derleme, prosedürel bir doku, dokulu bir quad (textured quad) ve ekrana ilk WebGL2 sprite'ı. Binlerce sprite'ı tek draw call'a paketleyen batching'e giden yolun ilk taşı.*

*Tahmini okuma süresi: 15 dakika*

---

Bu seri boyunca ekrana hep aynı şekilde çizdik: `ctx.drawImage(sprite, x, y)`. Bir satır, ve görüntü karşımızda. Fizik motorunda topları, kiremit oyununda blokları, hep bu tek satırla bastık. Hiç sorgulamadık — çünkü sorgulamaya gerek yoktu. Çalışıyordu.

Geçen gün o satırın altına baktım ve tuhaf bir soru takıldı kafama: o pikselleri ekrana kim koyuyor?

Cevap bir tercüman.

Canvas2D, sizinle ekranın arasında oturan kibar bir tercümandır. Siz kendi dilinizde konuşursunuz — "şu görüntüyü 100, 50 koordinatına çiz" — o da bunu, asıl işi yapan donanımın, yani GPU'nun (grafik işlemci) anlayacağı dile çevirir. Konforlu. Hızlı. Çoğu gün ihtiyacınız olan tek şey. Ama tercümanla konuştuğunuz sürece GPU'nun kendi dilini hiç duymazsınız.

Bu yazıda tercümanı kovuyoruz. GPU'yla doğrudan, onun ana dilinde konuşacağız. O dilin adı **clip-space**, alfabesi de `-1` ile `+1` arasında sıkışmış tuhaf bir koordinat sistemi. Korkutucu duruyor, biliyorum. Ama sonunda elimizde tek bir şey olacak: ekranda dönen, dokulu bir kare. Serinin ilk WebGL2 sprite'ı.

Yol şöyle: önce Canvas2D'nin zihin modelini ve tam olarak nerede bittiğini konuşacağız. Sonra minimal bir WebGL2 context alıp clip-space'i tanıyacağız. Ardından iki küçük shader yazıp bir doku üretecek, dokulu quad'ı çizecek ve piksel düşüncemizi clip-space'e çeviren bir cep sözlüğü kuracağız. En sonda da o sözlüğün saf matematiğini test edeceğiz. Kod baştan sona gerçek TypeScript + WebGL2 — sözde kod yok.

### Canvas2D Zihin Modeli (ve Nerede Bittiği)

Önce hakkını verelim: `ctx.drawImage` muhteşem bir soyutlama. Zihin modeli çocuk kadar basit. Bir tuval var, sol üst köşesi `(0, 0)`, sağ aşağı `(genişlik, yükseklik)`. Piksel cinsinden düşünürsünüz. "Sprite'ı 100, 50'ye koy" dersiniz, sprite oraya gider. Canvas2D'den WebGL'e giden yolun ilk dersi bu modeli sevmek, ikinci dersi de sınırını görmek.

Peki bu tercüman ne zaman ayak bağı olur?

İki durumda. Birincisi ölçek. Her `drawImage` çağrısı tercümana yeni bir talimat vermektir; on bin sprite, on bin ayrı talimat, ve tercüman her birini tek tek CPU'da işler. Bir önceki hesabı gördük: çizim tarafı genellikle rahattır, ama on binlerce çağrıya çıkınca o rahatlık biter. İkincisi kontrol. Her pikseli tek tek nasıl boyayacağınıza karışamazsınız — dalgalanma, ışık, renk karışımı gibi efektler tercümanın menüsünde yoksa yapamazsınız.

WebGL2 bu iki duvarı da yıkar, çünkü tercümanı aradan çıkarıp işi doğrudan GPU'ya verir. GPU binlerce pikseli aynı anda, paralel boyar; ne çizeceğini de siz shader adı verilen küçük programlarla piksel piksel tarif edersiniz. Bedeli şu: artık piksel dilinde konuşamazsınız. GPU'nun dilini öğrenmeniz gerekir.

O dil clip-space. Ona geçmeden önce konuşacak birini bulalım.

### Minimal Bir WebGL2 Context

Canvas2D'de `canvas.getContext("2d")` derdik. WebGL2'de tek kelime değişir — ama o kelimenin arkasında bambaşka bir dünya var. Her WebGL2 macerası da bu tek kelimeyle başlar:

```ts
// src/main.ts
const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const gl = canvas.getContext("webgl2");

if (!gl) {
  document.body.innerHTML =
    "<p>Bu tarayıcı WebGL2 desteklemiyor. Canvas2D'ye düşmek gerek 😢</p>";
  throw new Error("WebGL2 context alınamadı");
}
```

Şu `if (!gl)` kontrolünü lütfen atlamayın. `getContext("2d")` neredeyse her zaman bir context döndürür; `getContext("webgl2")` ise donanım, sürücü ya da tarayıcı elvermezse `null` döndürür. Feature-detect (özellik tespiti) yapmadan devam ederseniz, kullanıcının bir kısmı bomboş ekranla karşılaşır. Ciddi bir uygulamada burada Canvas2D'ye düşen bir yedek yol (fallback) bırakırsınız — bizim demoda dürüst bir hata mesajı yeterli.

Elimizde `gl` varsa, tercümanı kovduk demektir. Şimdi GPU'yla baş başayız. İlk cümlemiz basit olsun: ekranı temizleyelim.

```ts
// src/main.ts — çizim döngüsü içinde her karede koşar
gl.clearColor(0.06, 0.07, 0.12, 1); // koyu lacivert (RGBA, 0..1 arası)
gl.clear(gl.COLOR_BUFFER_BIT);
```

Dikkat: renk `0..255` değil, `0..1` arasında. Bu ufak detay bile GPU'nun farklı düşündüğünün ilk işareti. Onun dünyasında her şey `0` ile `1` (ya da `-1` ile `+1`) arasında normalize edilmiş sayılardır. Piksel yok, byte yok. Oran var.

### Clip Space: WebGL'in Koordinat Sistemi

İşte yolculuğun kalbi. Clip-space kavramını oturttuğunuz an, WebGL'in yarısı çözülür.

Canvas2D'de koordinat sistemi piksele bağlıydı: sol üst `(0, 0)`, y aşağı doğru artar, sağ alt köşe `(genişlik, yükseklik)`. GPU bunu umursamaz. GPU her şeyi **clip-space** denen sabit bir kutu içinde görür:

- Yatayda (x): sol kenar `-1`, sağ kenar `+1`.
- Dikeyde (y): alt kenar `-1`, üst kenar `+1`.
- Merkez: `(0, 0)`.

Ekranınız 800 piksel de olsa 4000 piksel de olsa GPU için görünür alan hep bu `-1..+1` karesidir. Piksel yok. Sadece oran.

İki tane sinsi tuzak var, ikisini de ilk denememde yedim.

Birincisi: y ekseni ters. Canvas2D'de y aşağı doğru artardı; clip-space'te y **yukarı** doğru artar. Yani ekranın tepesi `+1`, dibi `-1`. Bunu unutursanız sprite'ınız baş aşağı doğar. (Benim ilk karem tam olarak öyle doğdu; dama deseni simetrik olduğu için fark etmem yarım saatimi aldı.)

İkincisi: merkez ortada. Piksel dünyasında "başlangıç" sol üst köşeydi; clip-space'te başlangıç ekranın tam ortası. Sol üst köşe artık `(-1, +1)`.

Bir pikseli clip-space'e çevirmek bu yüzden iki adımlık bir iştir: önce `0..1` aralığına normalize et, sonra `-1..+1` aralığına yay — ve y için işareti çevir. Bu dönüşümü birazdan saf bir fonksiyona koyacağız; şimdilik zihin modeli net olsun yeter: **piksel dilinden clip diline geçiyoruz.**

Peki GPU bu clip-space koordinatlarını nereden alacak? Ondan tarif etmemizi bekliyor. Shader'lar tam da bunun için var.

### Vertex ve Fragment Shader'ları

Shader, GPU üzerinde çalışan minik bir programdır. GLSL adında C'ye benzeyen bir dille yazılır. Bir sprite çizmek için ikisine ihtiyacınız var, ve ikisi bir üretim hattının iki istasyonu gibi çalışır.

Birincisi **vertex shader** (köşe shader'ı). Her köşe (vertex) için bir kez çalışır ve tek bir soruya cevap verir: bu köşe clip-space'te nerede duracak? Bir dörtgeni iki üçgenle çizeceğimiz için altı köşemiz olacak, shader altı kez koşacak.

```glsl
#version 300 es
in vec2 a_clip;   // clip-space konumu (-1..1), CPU'dan gelir
in vec2 a_uv;     // doku koordinatı (0..1), CPU'dan gelir
out vec2 v_uv;    // fragment shader'a geçireceğimiz UV

void main() {
  v_uv = a_uv;                          // UV'yi olduğu gibi aktar
  gl_Position = vec4(a_clip, 0.0, 1.0); // köşenin nihai konumu
}
```

İkincisi **fragment shader** (parça shader'ı). Sprite'ın kapladığı her piksel için bir kez çalışır ve şu soruya cevap verir: bu piksel hangi renk olacak? Bir sprite'ın bütün estetiği burada, bu birkaç satırda yaşar. Bizimki mütevazı: dokudan ilgili rengi okuyup basıyor.

```glsl
#version 300 es
precision mediump float;      // float hassasiyeti (mobil için zorunlu)
in vec2 v_uv;                 // vertex shader'dan gelen UV
uniform sampler2D u_texture;  // bağladığımız doku
out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_uv); // UV'deki dokudan rengi oku
}
```

Aralarındaki köprüye dikkat: vertex shader `v_uv`'yi `out` olarak yazıyor, fragment shader onu `in` olarak okuyor. Arada GPU sihir yapar — üç köşenin UV değerini üçgenin içindeki her piksel için pürüzsüzce karıştırır (interpolation, ara değerleme). Yani siz sadece dört köşenin doku koordinatını verirsiniz, GPU aradaki binlerce pikseli kendisi doldurur.

Şimdi bir uyarı. Yıllarımı yiyen o hatayı sizden uzak tutayım: `#version 300 es` satırı, shader kaynağının **birinci** satırı olmak zorunda. Bir tane bile boşluk ya da satır başı önüne geçerse WebGL2, "300 es" modunu tanımaz ve size hiçbir şey anlatmayan bir derleme hatası verir. TypeScript'te template literal yazarken içgüdüsel olarak backtick'ten sonra alt satıra geçeriz — sakın geçmeyin:

```ts
// KARŞI ÖRNEK — bu blok projede YOK; src/shaders.ts sadece DOĞRU biçimi kullanır
// YANLIŞ: ilk karakter bir satır başı, shader derlenmez
const bad = `
#version 300 es
...`;

// DOĞRU: sürüm etiketi tam da ilk satır
const VERTEX_SHADER = `#version 300 es
in vec2 a_clip;
...`;
```

GLSL metnini yazmak bir şey; onu GPU'nun anlayacağı çalıştırılabilir bir programa çevirmek başka. Bunu bir yardımcıya devredelim ki bir daha düşünmeyelim.

```ts
// src/gl.ts
export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("gl.createShader null döndürdü");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  // Derleme başarısızsa GPU sessizce kara ekran verir; hatayı biz yakalayalım
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader derlenemedi:\n${log}`);
  }
  return shader;
}
```

Bu `getShaderParameter` kontrolü bir lüks değil, cankurtaran. WebGL derleme hatasında istisna fırlatmaz — sessizce hiçbir şey çizmez. Bu kontrolü koymazsanız, hatayı ekrandaki boşluktan tahmin etmeye çalışırsınız. Koyarsanız, GPU size tam olarak hangi satırda ne olduğunu söyler.

İki shader'ı birbirine bağlayıp tek bir programa dönüştüren de linkleme (linking) adımıdır:

```ts
// src/gl.ts (devamı)
export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) throw new Error("gl.createProgram null döndürdü");

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  // Link bittiğinde shader nesneleri artık serbest bırakılabilir
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program linklenemedi:\n${log}`);
  }
  return program;
}
```

Aynı savunmacı desen: linkten sonra da bir kontrol. İki yardımcı, iki hata kapısı, ve bir daha shader derlemeyi hiç düşünmeyeceğimiz bir hayat. Kullanımı tek satır:

```ts
// src/main.ts
const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
gl.useProgram(program);
```

Programımız hazır. Ama fragment shader bir dokudan renk okuyor — daha ortada doku yok. Onu üretelim.

### Bir Doku Yüklemek

Sprite dediğimiz şey bir görüntüdür; GPU dünyasında görüntünün adı **texture** (doku). Çoğu tutorial burada bir `.png` indirtir. Biz indirmeyeceğiz — harici bir dosyaya bağımlı olmadan, dokuyu kodla üreteceğiz. Hem daha öğretici, hem repo daha temiz.

Dokumuz klasik bir dama tahtası olsun. Bir `Uint8Array` içine piksel piksel RGBA değerleri yazacağız; her piksel dört byte (kırmızı, yeşil, mavi, alfa). Bu fonksiyon tamamen saf — hiçbir tarayıcı API'sine dokunmaz, dokuyu GPU'ya yüklemeden önceki CPU tarafını gösterir:

```ts
// src/texture.ts
export function makeCheckerboard(
  size = 64,
  cells = 8,
): { data: Uint8Array; size: number } {
  const data = new Uint8Array(size * size * 4); // her piksel 4 byte: RGBA
  const cellPx = size / cells;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cellPx);
      const cy = Math.floor(y / cellPx);
      const on = (cx + cy) % 2 === 0; // satranç deseni

      const i = (y * size + x) * 4;
      data[i + 0] = on ? 124 : 34;  // R
      data[i + 1] = on ? 58 : 197;  // G
      data[i + 2] = on ? 237 : 246; // B
      data[i + 3] = 255;            // A (tam opak)
    }
  }
  return { data, size };
}
```

Bu ham byte dizisini GPU belleğine yüklemek `gl.texImage2D`'nin işi. İmzası uzun ve ilk bakışta korkutucu; ama her argümanın bir mantığı var:

```ts
// src/texture.ts (devamı)
export function createTexture(
  gl: WebGL2RenderingContext,
  data: Uint8Array,
  size: number,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("gl.createTexture null döndürdü");

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,                  // mipmap seviyesi (taban için 0)
    gl.RGBA,            // GPU'daki iç format
    size,
    size,
    0,                  // border — spec gereği her zaman 0
    gl.RGBA,            // kaynak verinin formatı
    gl.UNSIGNED_BYTE,   // her kanal bir byte
    data,
  );

  // Sprite pikselleri keskin görünsün: yumuşatma yok
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}
```

`NEAREST` filtresini bilinçli seçtim: dama karelerinin kenarları bulanıklaşmadan, retro bir pikselli görünümle kalsın. `LINEAR` deseydik GPU komşu texel'leri karıştırıp kenarları yumuşatırdı — piksel-art sprite'lar için genelde istemeyeceğiniz şey.

Bir de şu UV meselesi kaldı. Vertex shader'da geçen `a_uv`, dokunun neresinden örnek alınacağını söyler. UV koordinatları da clip-space gibi normalize edilmiştir: `(0, 0)` dokunun bir köşesi, `(1, 1)` çapraz köşesi. Dokunun boyutu 64 piksel de olsa 512 piksel de olsa UV hep `0..1`. Sprite'ın dört köşesine `(0,0)`, `(1,0)`, `(0,1)`, `(1,1)` UV'lerini verdiğimizde, GPU dokuyu dörtgene gererek yapıştırır. Bir posteri çerçeveye germek gibi.

Doku hazır, program hazır. Sıra dörtgeni çizmekte.

### Sprite'ı Çizmek

Bir sprite ekranda bir dörtgendir. GPU ise dörtgen çizmeyi bilmez — sadece üçgen çizer. O yüzden dörtgenimizi iki üçgene böleriz: köşeleri paylaşan, birlikte bir kare oluşturan iki üçgen. Toplam altı köşe.

Her köşe için iki bilgi taşıyacağız: clip-space konumu (iki float) ve UV koordinatı (iki float). Bu dört sayıyı köşe başına yan yana dizeceğiz — buna interleaved (iç içe geçmiş) buffer denir. GPU tek bir bellek bloğundan hem konumu hem UV'yi okur.

Bu altı köşelik diziyi birazdan saf bir fonksiyonla üreteceğiz. Önce onu GPU'ya bağlama iskeletini kuralım. WebGL2'nin güzel bir yeniliği burada devreye girer: VAO (Vertex Array Object), yani tüm attribute ayarlarını tek bir nesnede toplayıp saklama imkânı.

```ts
// src/main.ts (devamı)
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
```

`vertexAttribPointer`'ın son iki argümanı — `STRIDE` ve offset — interleaved buffer'ın anahtarıdır. GPU'ya diyorsunuz ki: "her köşe 16 byte (`STRIDE`); `a_clip`'i baştan oku, `a_uv`'yi 8 byte içeriden oku." Bir tabloda satırlar (köşeler) ve sütunlar (konum, UV) var; siz sadece sütunun nereden başladığını gösteriyorsunuz.

Dokuyu da bir texture unit'e (doku birimi) bağlayıp shader'a hangi birimi kullanacağını söyleyelim:

```ts
// src/main.ts (devamı)
const { data, size } = makeCheckerboard(64, 8);
const texture = createTexture(gl, data, size);

gl.activeTexture(gl.TEXTURE0);          // 0 numaralı birim
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.uniform1i(uTexture, 0);              // sampler'a "0'ı kullan" de
```

Ve nihayet çizim. Buffer'a altı köşeyi yükleyip tek bir `drawArrays` çağrısı yapıyoruz. İlk WebGL2 sprite'ımızın koda döküldüğü an tam burası:

```ts
// src/main.ts — çizimin özü (aşağıdaki frame döngüsünde bu hâliyle koşar)
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

gl.clearColor(0.06, 0.07, 0.12, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.drawArrays(gl.TRIANGLES, 0, 6); // 6 köşe = 2 üçgen = 1 dörtgen = 1 sprite
```

Tek draw call. On bin `drawImage` yerine bir `drawArrays`. Şimdilik bir sprite çiziyoruz, ama tohum burada: aynı buffer'a altı yerine altmış bin köşe koyabilseydik, on bin sprite yine tek draw call olurdu. Serinin bir sonraki yazısında (10.000 sprite batching) tam olarak bunu yapacağız. Bugünkü işimiz o tek sprite'ı sağlam kurmak.

Bir eksik kaldı: `vertices` dizisini nasıl üreteceğiz? İşte tercümanı kovarken kaybettiğimiz konforu geri kazandığımız yer burası.

### Piksel-Uzayı Yardımcısı

Tercümanı kovduk, ama piksel dilinde düşünmeyi bırakmak istemiyoruz. "Sprite ekranın ortasında, 96 piksel genişliğinde olsun" demek, "sprite'ın sol üst köşesi clip-space'te -0.12 olsun" demekten çok daha insanca. Sprite çizimini uzun vadede sürdürülebilir kılan şey de bu: piksel düşüncesi ile clip-space arasında bir cep sözlüğü taşımak.

O sözlük tek bir saf fonksiyon. Bir piksel noktasını alır, clip-space karşılığını döndürür — clip-space bölümünde konuştuğumuz iki adımın kod hâli:

```ts
// src/space.ts
export interface Vec2 {
  x: number;
  y: number;
}

// Piksel konumu → clip-space (-1..1). y ekseni terslenir.
export function pixelToClip(
  px: number,
  py: number,
  canvasW: number,
  canvasH: number,
): Vec2 {
  return {
    x: (px / canvasW) * 2 - 1, // 0..1 → -1..1
    y: 1 - (py / canvasH) * 2, // 0..1 → +1..-1 (y ters!)
  };
}
```

Şu `1 - ...` satırı, bölümün başında baş aşağı doğan sprite'ımın ilacı. y'yi düz çevirseydik dünya ters dönerdi; `1`'den çıkararak Canvas2D'nin "y aşağı" dünyasını clip-space'in "y yukarı" dünyasına köprülüyoruz.

Bu tek noktayı dört köşeye ve iki üçgene genişleten bir kat daha var. Sprite'ı piksel cinsinden tarif ederiz — sol üst köşe `(x, y)`, genişlik `w`, yükseklik `h` — ve fonksiyon bize doğrudan GPU'ya yükleyeceğimiz interleaved diziyi verir. Üstüne bir de dönüş açısı ekleyelim ki demo canlansın; köşeleri clip-space'e çevirmeden önce sprite'ın merkezi etrafında döndürürüz:

```ts
// src/space.ts (devamı)
function rotateAround(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angle: number,
): Vec2 {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

// Piksel-uzaydaki bir sprite'ı 6 köşelik interleaved clip+UV dizisine çevirir.
// Dönüş: [clipX, clipY, u, v] × 6  →  Float32Array(24)
export function spriteQuad(
  x: number,
  y: number,
  w: number,
  h: number,
  canvasW: number,
  canvasH: number,
  angle = 0,
): Float32Array {
  const cx = x + w / 2; // sprite merkezi (piksel)
  const cy = y + h / 2;

  // Köşeyi önce merkez etrafında döndür, sonra clip-space'e çevir
  const corner = (px: number, py: number): Vec2 => {
    const r = rotateAround(px, py, cx, cy, angle);
    return pixelToClip(r.x, r.y, canvasW, canvasH);
  };

  const tl = corner(x, y);         // sol üst
  const tr = corner(x + w, y);     // sağ üst
  const bl = corner(x, y + h);     // sol alt
  const br = corner(x + w, y + h); // sağ alt

  // İki üçgen: (TL, BL, TR) ve (TR, BL, BR). Her satır: clipX, clipY, u, v
  return new Float32Array([
    tl.x, tl.y, 0, 0,
    bl.x, bl.y, 0, 1,
    tr.x, tr.y, 1, 0,

    tr.x, tr.y, 1, 0,
    bl.x, bl.y, 0, 1,
    br.x, br.y, 1, 1,
  ]);
}
```

Bir çizim döngüsü kurup her karede sprite'ı ekranın ortasında dolaştıralım ve kendi ekseninde çevirelim. `dt` ile hız yönetimini fizik yazısında konuşmuştuk; burada zamanı doğrudan açıya ve konuma bağlıyoruz:

```ts
// src/main.ts — çizim döngüsü (HUD'un FPS sayacını güncelleyen satırlar kısaltıldı)
const SPRITE = 96; // piksel

const frame = (now: number) => {
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
```

Ve ekranda dönen, dokulu bir dama karesi. Serinin ilk WebGL2 sprite'ı. `spriteQuad` sayesinde kodun tamamı hâlâ piksel cinsinden konuşuyor — clip-space matematiği tek bir fonksiyonun içine hapsedildi. Tercümanı kovduk ama cebimizde kendi sözlüğümüz var.

Bu sözlüğün bir güzelliği daha var: içinde tek bir WebGL çağrısı yok. Sadece matematik. Ve matematik test edilir.

### Test Edilebileni Test Etmek

WebGL2 kodunun büyük kısmını Node üzerinde test edemezsiniz. WebGL'i test etmeye kalkan çoğu kişinin çarptığı duvar bu: headless bir vitest ortamında ne `WebGL2RenderingContext` var, ne `canvas`, ne GPU. Bir `gl.drawArrays`'i birim testinde çağıramazsınız.

Ama iyi haber şu: kodun *en çok hata yapılan* kısmı zaten WebGL değil — koordinat matematiği. Baş aşağı sprite, yanlış yere oturan quad, ters UV... hepsi `pixelToClip` ve `spriteQuad` içinde yaşar. Ve bu iki fonksiyonu bilinçli olarak saf tuttuk: girdi sayı, çıktı sayı, arada hiçbir tarayıcı API'si yok. Bu da onları deterministik olarak test edilebilir kılar.

Sınırları çivileyerek başlayalım:

```ts
// test/space.test.ts
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
```

Üçüncü test, saatlerimi yiyen y-flip bug'ının bir daha geri dönmesini imkânsız kılar. Bir gün refactor sırasında `1 - ...`'i düz `...`'e çevirirsem, bu test kırmızıya döner ve bana "dünyayı yine ters çevirdin" der.

Quad üreticisini de test edelim — biçim, hizalama ve dönüşün merkezi koruması:

```ts
// test/space.test.ts (devamı)
describe("spriteQuad", () => {
  it("6 köşe × 4 bileşen = 24 float üretir", () => {
    const q = spriteQuad(0, 0, 100, 100, 800, 600);
    expect(q.length).toBe(24);
  });

  it("tüm canvas'ı kaplayan sprite tam clip köşelerine oturur", () => {
    const q = spriteQuad(0, 0, 800, 600, 800, 600);
    // İlk köşe = sol üst: clip (-1, +1), UV (0, 0)
    expect(q[0]).toBeCloseTo(-1); // clipX
    expect(q[1]).toBeCloseTo(1);  // clipY
    expect(q[2]).toBeCloseTo(0);  // u
    expect(q[3]).toBeCloseTo(0);  // v
  });

  it("0 açılı dönüş, dönüşsüz quad ile birebir aynıdır", () => {
    const a = spriteQuad(100, 50, 96, 96, 800, 600, 0);
    const b = spriteQuad(100, 50, 96, 96, 800, 600);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("dönüş, sprite merkezini yerinde tutar (her açıda)", () => {
    const x = 300, y = 250, w = 200, h = 100, cw = 800, ch = 600;
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
```

Son test benim en sevdiğim, çünkü bir geometri gerçeğini doğruluyor: bir kareyi merkezi etrafında döndürürseniz, dört köşenin ağırlık merkezi kımıldamaz. Hangi açıda olursa olsun. Bu testi geçen bir `spriteQuad`, ekranda sprite'ı asla "kayarak dönen" bir şeye çevirmez — merkezinde döner, olması gerektiği gibi.

Sınır: GPU'nun gerçekten doğru pikselleri çizdiğini bu testler kanıtlamaz. Onun için tarayıcıda gözle bakmak gerekir. Ama beni gece uykumdan eden hataların hepsi matematikteydi, GPU'da değil. Test edilebileni test et, kalanına göz at — dürüst bölüşüm bu.

### Özetle:

1. Canvas2D bir tercümandır: siz piksel konuşursunuz, o GPU diline çevirir. WebGL2 tercümanı çıkarır, siz GPU'nun ana diliyle konuşursunuz.
2. `getContext("webgl2")` `null` dönebilir — feature-detect şart, ciddi projede Canvas2D fallback bırak.
3. GPU'nun dili clip-space: `-1..+1` arası, merkez ortada, ve y **yukarı** artar (Canvas2D'nin tersi).
4. İki shader gerekir: vertex (köşe nerede?) ve fragment (piksel hangi renk?). `#version 300 es` mutlaka birinci satır olacak.
5. Shader derleme/link adımlarını `COMPILE_STATUS` / `LINK_STATUS` ile kontrol et — WebGL hatada sessizce kara ekran verir.
6. Doku harici dosya gerektirmez; `Uint8Array` + `texImage2D` ile prosedürel üretilir. UV'ler `0..1`.
7. Sprite = 2 üçgen = 6 köşe; interleaved buffer + tek `drawArrays`. Bir sprite'ın tek draw call'u, on bin sprite'ın batching'ine giden yolun ilk taşı.
8. Piksel düşüncesini clip-space'e çeviren `pixelToClip` / `spriteQuad`'ı saf tut — böylece kodun geri kalanı piksel konuşmaya devam eder ve matematiği Node'da test edebilirsin.

Kodun tamamı — shader yardımcıları, prosedürel doku, quad üreticisi, canlı demo ve testler — GitHub'da; README'deki komutlarla `npm test` diyip koordinat matematiğini yeşile boyayabilir, `npm run dev` diyip dönen dama karesini kendi ekranınızda izleyebilirsiniz.

Bu yazıyı yazarken fark ettiğim şey şu oldu: `drawImage`'in kolaylığı, arkasındaki bütün mekanizmayı görünmez kılıyordu — ve görünmez şeyi optimize edemezsiniz. Tercümanı kovmak ilk başta konfordan vazgeçmek gibi geldi. Sonra anladım ki asıl kazandığım şey, o tek satırın altında ne olduğunu artık *bilmek*. Bir sonraki adım, bu tek sprite'ı çoğaltmak: binlerce dokulu quad'ı tek bir buffer'a paketleyip GPU'ya tek seferde göndermek. Batching'in kapısı buradan açılıyor. ⚙️🧠
