// backView.js
// Location: js/game/effects/backView.js
//
// A champion seen from behind, generated from their front-facing sprite.
// First made for the return crossing (seaWorld.js); PGR uses it to show the
// player's back whenever they face away from the camera.
//
//   makeBackView(imageData) -> { width, height, data, head, bald }
//   backViewCanvas(canvas)  -> a new canvas holding the back view

// Generated back view, v2 -- works from the HEAD BLOCK, not skin colour.
// Small pixel sprites draw the head as a little block above the shoulders:
//   * find it: the top rows, down to where the opaque width jumps (shoulders)
//   * hair / hood / helmet = the colour of its top row; if that differs from
//     the face, the whole head becomes it (from behind, you see the hair);
//     if it's the same (bald), the head stays skin, features smoothed away
//   * small bright front details on the torso (buckles, brooches) take the
//     colour around them
//   * mirror left-right
export function makeBackView({ width: w, height: h, data: d }) {
  const out = new Uint8ClampedArray(d)
  const I = (x, y) => (y * w + x) * 4
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[I(x, y) + 3] > 20
  const col = (x, y) => [d[I(x, y)], d[I(x, y) + 1], d[I(x, y) + 2]]
  const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b
  const same = (a, b, tol = 26) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < tol * 3
  const rowSpan = y => { let a = -1, b = -1; for (let x = 0; x < w; x++) if (opaque(x, y)) { if (a < 0) a = x; b = x } return a < 0 ? null : [a, b] }
  // the head: from the first opaque row down to where the width jumps
  let top = 0; while (top < h && !rowSpan(top)) top++
  if (top >= h) return { width: w, height: h, data: out }
  const headW0 = rowSpan(top)[1] - rowSpan(top)[0] + 1
  let bottom = top
  // The head ends where the shoulders begin: the width jumps. A bare champion's shoulders are barely wider
  // than his head (a shirt, no armour), so the jump is small, and if it is missed the whole body is taken for
  // head and painted hair-colour. So: a small jump will do, and a head is no taller than it is wide (+25%).
  const headMaxH = Math.round(headW0 * 1.25)
  for (let y = top + 1; y < h && y - top <= headMaxH; y++) { const s = rowSpan(y); if (!s) break; if (s[1] - s[0] + 1 > Math.max(headW0 + 3, headW0 * 1.25)) break; bottom = y }
  const hs = rowSpan(top), mid = Math.round((hs[0] + hs[1]) / 2)
  // hair = commonest colour on the top row(s); face = commonest colour in the head's lower half
  const commonest = (y0, y1) => { const m = new Map()
    for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) if (opaque(x, y)) { const c = col(x, y); if (lum(c) < 18) continue; const k = c.join(); m.set(k, (m.get(k) || 0) + 1) }
    let best = null, n = 0; for (const [k, v] of m) if (v > n) { n = v; best = k.split(',').map(Number) } return best }
  const hair = commonest(top, top + Math.max(0, Math.floor((bottom - top) * 0.25)))
  const face = commonest(top + Math.ceil((bottom - top) / 2), bottom)
  const bald = !hair || !face || same(hair, face)
  const fill = bald ? face : hair
  for (let y = top; y <= bottom; y++) for (let x = 0; x < w; x++) {
    if (!opaque(x, y)) continue
    const c = col(x, y)
    if (lum(c) < 18 && (x === rowSpan(y)[0] || x === rowSpan(y)[1])) continue    // keep the outline
    const i = I(x, y); out[i] = fill[0]; out[i + 1] = fill[1]; out[i + 2] = fill[2]
  }
  // torso: small bright details take the colour around them
  for (let y = bottom + 1; y < h; y++) for (let x = 1; x < w - 1; x++) {
    if (!opaque(x, y)) continue
    const c = col(x, y), around = [col(x - 1, y), col(x + 1, y), col(x, y - 1), col(x, y + 1)].filter((_, k) => opaque([x - 1, x + 1, x, x][k], [y, y, y - 1, y + 1][k]))
    const sat = Math.max(...c) - Math.min(...c)
    if (around.length >= 3 && sat > 90 && around.filter(a => !same(a, c)).length >= 3) {
      const a = around.find(a => !same(a, c)); const i = I(x, y); out[i] = a[0]; out[i + 1] = a[1]; out[i + 2] = a[2]
    }
  }
  // mirror
  const m = new Uint8ClampedArray(out.length)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = I(x, y), b = I(w - 1 - x, y); for (let c = 0; c < 4; c++) m[a + c] = out[b + c] }
  return { width: w, height: h, data: m, head: [top, bottom], bald }
}

// Convenience: a back-view copy of a sprite canvas.
export function backViewCanvas(src) {
  const c = document.createElement('canvas')
  c.width = src.width; c.height = src.height
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  g.drawImage(src, 0, 0)
  const id = g.getImageData(0, 0, c.width, c.height)
  id.data.set(makeBackView(id).data)
  g.putImageData(id, 0, 0)
  return c
}
