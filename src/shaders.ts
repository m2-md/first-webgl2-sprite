// GLSL shader sources. NOTE: `#version 300 es` must be the FIRST characters
// in both template literals — if there is a newline immediately after the
// backtick, WebGL2 will not recognize "300 es" mode.

export const VERTEX_SHADER = `#version 300 es
in vec2 a_clip;   // clip-space position (-1..1), comes from CPU
in vec2 a_uv;     // texture coordinates (0..1), comes from CPU
out vec2 v_uv;    // UV passed to fragment shader

void main() {
  v_uv = a_uv;                          // pass UV directly
  gl_Position = vec4(a_clip, 0.0, 1.0); // final vertex position
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision mediump float;      // float precision (required for mobile)
in vec2 v_uv;                 // UV from vertex shader
uniform sampler2D u_texture;  // bound texture
out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_uv); // read color from texture at UV
}
`;
