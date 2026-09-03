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

  const tl = corner(x, y); // sol üst
  const tr = corner(x + w, y); // sağ üst
  const bl = corner(x, y + h); // sol alt
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
