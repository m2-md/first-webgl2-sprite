export function makeCheckerboard(
  size = 64,
  cells = 8,
): { data: Uint8Array; size: number } {
  const data = new Uint8Array(size * size * 4); // 4 bytes per pixel: RGBA
  const cellPx = size / cells;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cellPx);
      const cy = Math.floor(y / cellPx);
      const on = (cx + cy) % 2 === 0; // checkerboard pattern

      const i = (y * size + x) * 4;
      data[i + 0] = on ? 124 : 34; // R
      data[i + 1] = on ? 58 : 197; // G
      data[i + 2] = on ? 237 : 246; // B
      data[i + 3] = 255; // A (fully opaque)
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
  if (!texture) throw new Error("gl.createTexture returned null");

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // mipmap level (0 for base)
    gl.RGBA, // internal format on GPU
    size,
    size,
    0, // border — always 0 per spec
    gl.RGBA, // format of source data
    gl.UNSIGNED_BYTE, // one byte per channel
    data,
  );

  // Keep sprite pixels crisp: no smoothing
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}
