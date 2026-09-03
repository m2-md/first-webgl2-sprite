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
      data[i + 0] = on ? 124 : 34; // R
      data[i + 1] = on ? 58 : 197; // G
      data[i + 2] = on ? 237 : 246; // B
      data[i + 3] = 255; // A (tam opak)
    }
  }
  return { data, size };
}

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
    0, // mipmap seviyesi (taban için 0)
    gl.RGBA, // GPU'daki iç format
    size,
    size,
    0, // border — spec gereği her zaman 0
    gl.RGBA, // kaynak verinin formatı
    gl.UNSIGNED_BYTE, // her kanal bir byte
    data,
  );

  // Sprite pikselleri keskin görünsün: yumuşatma yok
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}
