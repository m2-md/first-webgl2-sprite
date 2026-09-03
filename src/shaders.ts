// GLSL shader kaynakları. DİKKAT: `#version 300 es` her ikisinde de
// template literal'in İLK karakteri olmak zorunda — backtick'ten hemen
// sonra satır başı OLURSA WebGL2 "300 es" modunu tanımaz.

export const VERTEX_SHADER = `#version 300 es
in vec2 a_clip;   // clip-space konumu (-1..1), CPU'dan gelir
in vec2 a_uv;     // doku koordinatı (0..1), CPU'dan gelir
out vec2 v_uv;    // fragment shader'a geçireceğimiz UV

void main() {
  v_uv = a_uv;                          // UV'yi olduğu gibi aktar
  gl_Position = vec4(a_clip, 0.0, 1.0); // köşenin nihai konumu
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision mediump float;      // float hassasiyeti (mobil için zorunlu)
in vec2 v_uv;                 // vertex shader'dan gelen UV
uniform sampler2D u_texture;  // bağladığımız doku
out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_uv); // UV'deki dokudan rengi oku
}
`;
