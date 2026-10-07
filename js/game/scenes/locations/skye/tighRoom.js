// tighRoom.js
// Location: js/game/scenes/locations/skye/tighRoom.js
//
// Conall's cabin, painted in code: no image files. A fixed camera looks north into one small
// room, a cut-away (the south wall is the near edge, with the door in it). Drawn at 150 x 312
// "room pixels" and scaled up with nearest-neighbour filtering by the scene, so it sits with
// the game's small pixel sprites. Simple shapes, flat colours, Romanesque lines: no brickwork.
//
//   y   0 -  20   the foot of the thatch, and the tie beam
//   y  20 -  84   the back wall: whitewashed limestone; in the middle the chimney breast with
//                 its round-arched hearth (the arch's crown is just off the top of the screen);
//                 on one side a round-headed window, on the other a shelf and the firewood
//   y  84 - 276   the floor: the game's clay tiles (as in the village hall)
//   y 276 - 312   the south wall (the game's wall tile), the door in it
//
// paintRoom() returns canvases (the static room, the window curtain closed and drawn back, the
// blanket over the sleeper, the door, the props, and the light layers). The scene
// (tighConaill.js) animates them. To change the look: the palette is just below; each piece
// of the room is one small function.

export const RW = 150
export const RH = 312

const FLOOR_TOP = 84, FLOOR_BOTTOM = 276
// where things are, in room pixels (the scene puts the characters by these)
export const SPOT = {
  bed:    { x: 8,   y: 150, w: 62, h: 40 },
  head:   { x: 22,  y: 171 },               // where the sleeper's head rests
  hearth: { x: 55,  y: 4,   w: 40, h: 80 }, // the opening: a round arch, its crown at the top
  fire:   { x: 75,  y: 80 },                // the fire's base, centre
  cauldron: { x: 75, y: 56 },
  window: { x: 108, y: 34,  w: 28, h: 36 },
  chair:  { x: 112, y: 112, w: 22, h: 30 },
  table:  { x: 88,  y: 214, w: 44, h: 22 },
  wood:   { x: 12,  y: 58 },
  door:   { x: 57,  y: FLOOR_BOTTOM, w: 36, h: 36 },
  floorTop: FLOOR_TOP, floorBottom: FLOOR_BOTTOM,
}

// ── palette ────────────────────────────────────────────────────────────────
const P = {
  ink: '#150e09',
  thD: '#2b1c0d', thM: '#52371a', thL: '#7d5a2c', thH: '#a8803f',
  tbD: '#2a1a0e', tbM: '#4a301a', tbL: '#6b4627', tbH: '#8b6238',
  plD: '#a8a396', plM: '#c9c5b8', plL: '#e2dfd3', plH: '#f1eee4',   // limestone
  stD: '#37332f', stM: '#58524b', stL: '#7d7466', stH: '#a09580',
  eaD: '#35241a', eaM: '#523a26', eaL: '#6c4d31', eaH: '#87653e',
  sD: '#8a6a2c', sM: '#b8933f', sL: '#d6b45a', sH: '#ecd185',
  clothG: '#3e5a38', clothGL: '#587a4d', clothR: '#7f3426', clothRL: '#a14a36',
  wool: '#cbbf9f', woolD: '#9e9378', linen: '#d9cfae', linenD: '#b3a681',
  iron: '#1c1a1a', ironL: '#46423f',
  sky: '#cfe0d6', skyH: '#f2f1d4', hill: '#7d9a5a', hillD: '#5c7a45',
}

// ── tiny tools ──────────────────────────────────────────────────────────────
const _c = {}
const col = (h) => _c[h] || (_c[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)])
const mix = (a, b, t) => { const A = typeof a === 'string' ? col(a) : a, B = typeof b === 'string' ? col(b) : b; return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t] }
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
const bay = (x, y) => (BAY[y & 3][x & 3] + 0.5) / 16

class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4) }
  set(x, y, c, a = 255) {
    x = Math.floor(x); y = Math.floor(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const C = typeof c === 'string' ? col(c) : c, i = (y * this.w + x) * 4
    this.d[i] = C[0]; this.d[i + 1] = C[1]; this.d[i + 2] = C[2]; this.d[i + 3] = a
  }
  get(x, y) { const i = (Math.floor(y) * this.w + Math.floor(x)) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]] }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c) }
  // multiply what is there (a shadow, a bit of light): f is a number, or [r, g, b]
  mul(x, y, f) {
    x = Math.floor(x); y = Math.floor(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4, F = typeof f === 'number' ? [f, f, f] : f
    if (!this.d[i + 3]) return
    this.d[i] *= F[0]; this.d[i + 1] *= F[1]; this.d[i + 2] *= F[2]
  }
  mulRect(x, y, w, h, f) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.mul(x + i, y + j, f) }
  // fill a rect where fn(x, y) gives a colour (or null to leave it)
  fill(x, y, w, h, fn) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = fn(x + i, y + j, i, j); if (c) this.set(x + i, y + j, c) } }
  // a vertical dithered gradient between two colours
  vgrad(x, y, w, h, a, b) { this.fill(x, y, w, h, (px, py, i, j) => { const t = j / Math.max(1, h - 1); return mix(a, b, Math.min(1, Math.max(0, t + (bay(px, py) - 0.5) * 0.35))) }) }
  canvas() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h
    c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0)
    return c
  }
}

const tone = (c, f) => { const C = typeof c === 'string' ? col(c) : c; return [C[0] * f, C[1] * f, C[2] * f] }

// ── the pieces ──────────────────────────────────────────────────────────────

// The foot of the thatch (flat and dark) and the tie beam across the room.
function thatchAndBeam(b) {
  b.fill(2, 0, 146, 14, (x, y) => tone(((y >> 1) & 1) ? P.thM : '#46301a', 0.85 + 0.15 * hash(x >> 2, y >> 1, 3)))
  b.mulRect(2, 0, 146, 4, 0.7)
  b.rect(2, 14, 146, 6, P.tbM); b.rect(2, 14, 146, 1, P.tbH); b.rect(2, 19, 146, 1, P.tbD)
  b.mulRect(2, 20, 146, 3, 0.85)
}

// The back wall: whitewashed limestone. Plain: a pale wash with a faint grey grain.
function backWall(b) {
  const top = 20, bot = FLOOR_TOP
  b.fill(4, top, 142, bot - top, (x, y) => {
    const n = hash(x >> 2, y >> 2, 11), f = hash(x, y, 12)
    let c = mix(P.plM, P.plL, 0.35 + n * 0.55)
    if (f < 0.04) c = mix(c, P.plD, 0.5)               // the odd grey fleck
    return tone(c, 1 - 0.18 * Math.max(0, 1 - (y - top) / 14))   // a little shade under the beam
  })
  // a skirting board along the foot of the wall
  b.rect(4, bot - 4, 142, 4, P.tbM); b.rect(4, bot - 4, 142, 1, P.tbH); b.rect(4, bot - 1, 142, 1, P.tbD)
  // the corner posts
  for (const x of [4, 142]) { b.rect(x, 20, 4, bot - 20, P.tbM); b.rect(x, 20, 1, bot - 20, P.tbL); b.rect(x + 3, 20, 1, bot - 20, P.tbD) }
}

// The chimney breast and its hearth: a plain block of limestone with a round-arched opening
// (the crown of the arch just off the top of the screen), the inside blackened, a small fire.
function hearth(b) {
  const { x: hx, y: hy, w: hw } = SPOT.hearth
  const bx0 = hx - 11, bx1 = hx + hw + 11                  // the breast, a little wider than the arch
  const cx = hx + hw / 2, r = hw / 2, spring = hy + r      // the arch springs here
  b.fill(bx0, 0, bx1 - bx0, FLOOR_TOP - 4, (x, y) => {
    const n = hash(x >> 2, y >> 2, 31)
    const edge = Math.min(x - bx0, bx1 - 1 - x)
    return tone(mix(P.plL, P.plH, 0.3 + n * 0.5), edge < 2 ? 0.86 : 1)
  })
  b.rect(bx0, 0, 1, FLOOR_TOP - 4, P.plD); b.rect(bx1 - 1, 0, 1, FLOOR_TOP - 4, P.plD)
  // the opening, and a plain archivolt (one band, a shade deeper than the wall) round it
  const inside = (x, y) => {
    if (x < hx || x >= hx + hw || y < hy) return false
    if (y >= spring) return true
    const dx = x + 0.5 - cx; return dx * dx + (y - spring) ** 2 <= r * r
  }
  const band = (x, y) => {
    if (inside(x, y)) return false
    for (let k = 1; k <= 3; k++) if (inside(x - k, y) || inside(x + k, y) || inside(x, y + k)) return true
    return false
  }
  for (let y = 0; y < FLOOR_TOP - 4; y++) for (let x = bx0; x < bx1; x++) {
    if (inside(x, y)) {
      // blackened: soot, a little lighter low down where the fire lights it
      const t = Math.max(0, (y - 40) / 40)
      b.set(x, y, mix('#0a0706', '#2b1810', t * t * 0.9 + (bay(x, y) - 0.5) * 0.05))
    } else if (band(x, y)) b.set(x, y, mix(P.plD, P.plM, 0.5))
  }
  // soot up the face of the breast above the arch's shoulders
  // a plain slab for a hearthstone, and a plain sill under the opening
  b.rect(hx - 8, FLOOR_TOP - 4, hw + 16, 6, '#8d887c'); b.rect(hx - 8, FLOOR_TOP - 4, hw + 16, 1, '#b8b3a4'); b.rect(hx - 8, FLOOR_TOP + 1, hw + 16, 1, '#5f5b52')
  // the fire's bed: ash and two logs (the flames themselves are particles)
  b.rect(hx + 8, FLOOR_TOP - 6, hw - 16, 3, '#1d1511')
  b.rect(hx + 10, FLOOR_TOP - 8, 20, 4, '#3a2412'); b.rect(hx + 10, FLOOR_TOP - 8, 20, 1, '#5c3a1e')
  b.rect(hx + 16, FLOOR_TOP - 11, 16, 3, '#46281a'); b.rect(hx + 16, FLOOR_TOP - 11, 16, 1, '#6a4020')
  for (let i = 0; i < 8; i++) b.set(hx + 12 + Math.floor(hash(i, 1, 40) * 22), FLOOR_TOP - 7 + Math.floor(hash(i, 2, 40) * 3), hash(i, 3, 40) < 0.5 ? '#ff7a22' : '#ffb347')
  // a chain from the crown of the arch, and a cauldron
  const { x: kx, y: ky } = SPOT.cauldron
  for (let y = 0; y < ky - 4; y += 2) b.set(kx, y, P.ironL)
  for (let y = 0; y < 12; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 4) / 8) ** 2)) * 8)
    for (let x = -half; x <= half; x++) b.set(kx + x, ky + y - 4, mix(P.iron, P.ironL, (x + half) / (half * 2 + 1) * 0.5))
  }
  b.rect(kx - 8, ky - 4, 17, 2, P.ironL); b.rect(kx - 6, ky - 3, 13, 1, '#6a3b1a')
}

// A round-headed window, set deep in the limestone: a plain splay, two bars. Curtain is separate.
function windowPane(b, win = SPOT.window) {
  const { x, y, w, h } = win
  const r = w / 2, cx = x + r
  const shape = (px, py, grow) => {
    if (py < y - grow || py >= y + h + grow || px < x - grow || px >= x + w + grow) return false
    if (py >= y + r) return true
    const dx = px + 0.5 - cx; return dx * dx + (py - (y + r)) ** 2 <= (r + grow) ** 2
  }
  for (let py = y - 4; py < y + h + 4; py++) for (let px = x - 4; px < x + w + 4; px++) {
    if (shape(px, py, 0)) {
      const t = (py - y) / h
      b.set(px, py, t > 0.66 ? mix(P.hill, P.hillD, (t - 0.66) * 2.6) : mix(P.skyH, P.sky, t / 0.66))
    } else if (shape(px, py, 4)) b.set(px, py, shape(px, py, 2) ? P.plH : P.plL)
  }
  // two bars
  b.rect(x + w / 2 - 1, y, 2, h, '#4a4a40'); b.rect(x, y + h * 0.45, w, 2, '#4a4a40')
  // a plain sill
  b.rect(x - 5, y + h + 2, w + 10, 3, P.plD); b.rect(x - 5, y + h + 2, w + 10, 1, P.plH)
}

// The curtain: closed (hangs across the window) or drawn back (gathered to one side).
function curtain(open, win = SPOT.window, cw = RW, ch = RH) {
  const { x, y, w, h } = win
  const gw = w > 20 ? 12 : 5                                   // how wide the drawn-back curtain bunches
  const b = new Buf(cw, ch)
  const x0 = x - 5, x1 = x + w + 5, rodY = y - 5
  b.rect(x0 - 2, rodY, x1 - x0 + 4, 2, P.tbL); b.rect(x0 - 2, rodY, x1 - x0 + 4, 1, P.tbH)
  b.rect(x0 - 3, rodY - 1, 3, 4, P.tbD); b.rect(x1 + 2, rodY - 1, 3, 4, P.tbD)
  const drape = (xa, xb, len) => {
    for (let px = xa; px < xb; px++) {
      const fold = Math.sin((px - xa) * 0.9) * 0.5 + 0.5
      const edge = Math.min(px - xa, xb - px - 1)
      for (let py = rodY + 2; py < rodY + 2 + len; py++) {
        const t = (py - rodY) / len
        let c = mix(P.linenD, P.linen, 0.25 + fold * 0.6)
        c = tone(c, 0.82 + 0.18 * (1 - t) - (edge < 1 ? 0.18 : 0))
        if (py > rodY + len - 5 && py < rodY + len - 2) c = mix(c, P.clothR, 0.55)
        b.set(px, py, c)
      }
    }
  }
  if (!open) {
    drape(x0, x1, h + 12)
    b.fill(x + 1, y + 1, w - 2, h - 2, (px, py) => { const c = b.get(px, py); return [Math.min(255, c[0] * 1.12 + 10), Math.min(255, c[1] * 1.1 + 8), Math.min(255, c[2] * 1.02)] })
  } else {
    drape(x1 - gw, x1, h + 12)
    b.rect(x1 - gw, y + h * 0.45, gw, 2, P.clothR)
    b.mulRect(x1 - gw, y + h * 0.45 + 2, 2, h * 0.4, 0.85)
  }
  return b.canvas()
}

// A plain shelf to the left of the hearth: a jug, two bowls, a loaf.
function shelf(b, x = 12, y = 44) {
  const w = 32
  b.rect(x, y, w, 3, P.tbL); b.rect(x, y, w, 1, P.tbH); b.rect(x, y + 3, w, 1, P.tbD)
  b.rect(x + 3, y + 4, 2, 4, P.tbD); b.rect(x + w - 5, y + 4, 2, 4, P.tbD)
  b.fill(x + 4, y - 11, 8, 11, (px, py, i, j) => { const e = i - 3.5; return Math.abs(e) <= (j < 3 ? 2 + j * 0.6 : 3.6) ? mix('#9b5a32', '#6a3a1e', (i / 8)) : null })
  b.rect(x + 6, y - 13, 4, 2, '#7a4526'); b.rect(x + 11, y - 9, 2, 5, '#6a3a1e')
  for (let k = 0; k < 2; k++) { b.rect(x + 16, y - 3 - k * 3, 9, 3, k % 2 ? '#a68a5a' : '#8b6a3e'); b.rect(x + 16, y - 3 - k * 3, 9, 1, '#c8aa78') }
  b.fill(x + 26, y - 6, 6, 6, (px, py, i, j) => { const e = (i - 3) / 3.4, f = (j - 5) / 5.4; return e * e + f * f < 1 ? mix('#c28a40', '#8a5a26', j / 6) : null })
}

// The floor: the game's own clay tiles (the same as the village hall's floor, gids 112 of the
// Oryx world sheet), plain, on a canvas that goes under everything else.
const SHEET = { MG: 24, TW: 24, COLS: 54 }
function tileAt(ctx, img, gid, dx, dy, scale = 1) {
  const i = gid - 1, c = i % SHEET.COLS, r = Math.floor(i / SHEET.COLS)
  ctx.drawImage(img, SHEET.MG + c * SHEET.TW, SHEET.MG + r * SHEET.TW, SHEET.TW, SHEET.TW, dx, dy, SHEET.TW * scale, SHEET.TW * scale)
}
function floorCanvas(img) {
  const c = document.createElement('canvas'); c.width = RW; c.height = RH
  const x = c.getContext('2d')
  x.imageSmoothingEnabled = false
  x.fillStyle = '#2a2418'; x.fillRect(0, 0, RW, RH)
  if (img) {
    x.save(); x.filter = 'saturate(90%) brightness(1.55)'
    for (let r = 0; r * 24 < FLOOR_BOTTOM - FLOOR_TOP + 24; r++) for (let q = 0; q < 7; q++) tileAt(x, img, 112, 4 + q * 24 - 12, FLOOR_TOP + r * 24)
    x.restore()
  }
  const sh = (x0, y0, x1, y1, a0, a1, vertical) => {
    const g = vertical ? x.createLinearGradient(0, y0, 0, y1) : x.createLinearGradient(x0, 0, x1, 0)
    g.addColorStop(0, `rgba(0,0,0,${a0})`); g.addColorStop(1, `rgba(0,0,0,${a1})`)
    x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0)
  }
  sh(0, FLOOR_TOP, 0, FLOOR_TOP + 12, 0.5, 0, true)
  sh(4, 0, 16, 0, 0.4, 0, false); sh(134, 0, 146, 0, 0, 0.4, false)
  return c
}

// A box-bed: a plain frame, a pale ticking mattress, a stuffed pillow at the head (left).
function bed(b) {
  const { x, y, w, h } = SPOT.bed
  b.rect(x - 2, y - 2, w + 4, h + 4, P.tbD)
  b.rect(x - 2, y - 2, w + 4, 2, P.tbL); b.rect(x - 2, y + h, w + 4, 2, P.tbM)
  b.rect(x - 2, y + h + 2, w + 4, 3, P.tbD)
  b.fill(x, y, w, h, (px, py, i, j) => (j % 8 === 0 ? '#a89c78' : '#b6aa86'))      // ticking: pale, a faint stripe
  b.fill(x + 2, y + 9, 14, 22, (px, py, i, j) => {
    const e = ((i - 6.5) / 7.2) ** 2 + ((j - 10.5) / 11.4) ** 2
    if (e > 1) return null
    return mix(P.linen, P.linenD, Math.min(1, e * 0.9 + (j > 15 ? 0.2 : 0)))
  })
}
function blanket() {
  const { x, y, w, h } = SPOT.bed
  const b = new Buf(RW, RH)
  const bx = x + 31, bw = w - 31, by = y + 2, bh = h - 4
  b.fill(bx, by, bw, bh, (px, py, i, j) => {
    const stripe = (i % 14) < 2 || (j % 20) < 2
    const sag = 1 - 0.14 * Math.max(0, 1 - Math.abs(j - bh / 2) / (bh / 2))
    return tone(stripe ? P.clothR : P.clothG, sag * (i < 4 ? 1.1 : 1))
  })
  b.rect(bx, by, bw, 1, P.clothGL); b.rect(bx, by + bh - 1, bw, 1, '#2d4228')
  b.rect(bx, by, 2, bh, P.clothGL)
  return b.canvas()
}

// The chair (the clothes on it are a prop).
function chair(b) {
  const { x, y, w } = SPOT.chair
  b.rect(x + 1, y + 28, 2, 8, P.tbD); b.rect(x + w - 3, y + 28, 2, 8, P.tbD)
  b.rect(x + 1, y + 6, 2, 22, P.tbM); b.rect(x + w - 3, y + 6, 2, 22, P.tbM)
  b.rect(x + 1, y + 8, w - 2, 3, P.tbL); b.rect(x + 1, y + 8, w - 2, 1, P.tbH)
  b.rect(x + 1, y + 14, w - 2, 3, P.tbM)
  b.rect(x - 1, y + 20, w + 2, 9, P.tbL); b.rect(x - 1, y + 20, w + 2, 1, P.tbH); b.rect(x - 1, y + 28, w + 2, 2, P.tbD)
}

// The table, bare (what is on it is in PROPS); two stools.
function table(b) {
  const { x, y, w, h } = SPOT.table
  b.mulRect(x - 2, y + h + 6, w + 6, 4, 0.7)
  for (const lx of [x + 2, x + w - 5]) { b.rect(lx, y + h, 3, 9, P.tbD); b.rect(lx, y + h, 1, 9, P.tbM) }
  b.rect(x, y + h - 2, w, 4, P.tbM); b.rect(x, y + h + 1, w, 1, P.tbD)
  b.rect(x, y, w, h - 2, P.tbL); b.rect(x, y, w, 1, P.tbH)
  b.rect(x, y + 10, w, 1, P.tbM)
  for (const sx of [x - 8, x + w + 1]) {
    b.rect(sx, y + 4, 8, 7, P.tbL); b.rect(sx, y + 4, 8, 1, P.tbH); b.rect(sx, y + 11, 8, 2, P.tbD)
    b.rect(sx + 1, y + 13, 2, 5, P.tbD); b.rect(sx + 5, y + 13, 2, 5, P.tbD)
  }
}

// A stack of firewood against the wall left of the hearth, ends toward us: big, plain rounds.
function woodPile(b, fx = SPOT.wood.x, fy = SPOT.wood.y) {
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - (r === 2 ? 0 : 0); c++) {
    const sz = 8, cx = fx + c * 8 + (r % 2) * 4, cy = fy + r * 8
    if (cx + sz > fx + 38) continue
    const dark = hash(c, r, 88) < 0.4
    b.fill(cx, cy, sz, sz, (px, py, i, j) => {
      const m = (sz - 1) / 2, e = ((i - m) / (m + 0.5)) ** 2 + ((j - m) / (m + 0.5)) ** 2
      if (e > 1) return null
      return e > 0.7 ? '#4a301a' : e < 0.12 ? '#7a4f26' : (dark ? '#9a6a38' : '#c8975c')
    })
  }
  b.mulRect(fx, fy + 24, 34, 3, 0.7)
}

// The south wall: the near edge of the cut-away. The game's clay wall tile (120) either side
// of the door; the door itself is separate (closed 137 / open 138), so Conall can open it.
function southWall(ctx, img) {
  const { x: dx, y: top, w: dw, h: dh } = SPOT.door
  ctx.save(); ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#1d1a14'; ctx.fillRect(0, top, RW, dh)
  ctx.filter = 'saturate(80%) brightness(0.8)'
  for (let x = 4 - 6; x < RW; x += 36) tileAt(ctx, img, 120, x, top, 1.5)
  ctx.filter = 'none'
  const g = ctx.createLinearGradient(0, top, 0, top + dh)
  g.addColorStop(0, 'rgba(0,0,0,0.0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = g; ctx.fillRect(0, top, RW, dh)
  ctx.restore()
}
function doorCanvas(img, gid, daylight) {
  const c = document.createElement('canvas'); c.width = SPOT.door.w; c.height = SPOT.door.h
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false
  if (daylight) {                                           // the open doorway: day beyond it
    const g = x.createLinearGradient(0, 0, 0, c.height)
    g.addColorStop(0, '#e9f0c8'); g.addColorStop(0.2, '#b9cf84'); g.addColorStop(1, '#7c9a52')
    x.fillStyle = g; x.fillRect(5, 6, c.width - 10, c.height - 6)
  }
  x.filter = 'saturate(75%) brightness(1.1)'
  tileAt(x, img, gid, 0, 0, 1.5)
  return c
}


// the edges: a dark timber at the left and right
function frame(b) {
  for (let y = 0; y < RH; y++) for (const x of [0, 1, 2, 3, 146, 147, 148, 149]) {
    const k = x < 4 ? x : 149 - x
    b.set(x, y, tone(P.tbM, 0.5 + k * 0.1))
  }
}

// ── light: smooth (drawn larger than the room, scaled down by the scene) ─────
const LS = 3
function radial(w, h, cx, cy, r, stops, fill = null) {
  const c = document.createElement('canvas'); c.width = w * LS; c.height = h * LS
  const x = c.getContext('2d')
  if (fill) { x.fillStyle = fill; x.fillRect(0, 0, c.width, c.height) }
  const g = x.createRadialGradient(cx * LS, cy * LS, 0, cx * LS, cy * LS, r * LS)
  for (const [t, col] of stops) g.addColorStop(t, col)
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height)
  return c
}

// the darkness the room sits in (multiplied over the painting): light where the fire is
function darkness() {
  const c = document.createElement('canvas'); c.width = RW * LS; c.height = RH * LS
  const x = c.getContext('2d')
  x.fillStyle = '#80789a'; x.fillRect(0, 0, c.width, c.height)
  x.globalCompositeOperation = 'lighter'
  const spot = (cx, cy, rx, ry, a) => {
    x.save(); x.translate(cx * LS, cy * LS); x.scale(1, ry / rx)
    const g = x.createRadialGradient(0, 0, 0, 0, 0, rx * LS)
    g.addColorStop(0, `rgba(255,214,160,${a})`); g.addColorStop(0.5, `rgba(200,150,100,${a * 0.45})`); g.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = g; x.fillRect(-rx * LS, -rx * LS, rx * 2 * LS, rx * 2 * LS); x.restore()
  }
  spot(75, 112, 110, 130, 0.95)        // the hearth
  spot(75, 40, 34, 40, 0.5)            // the arch above it
  spot(75, 276, 26, 16, 0.25)          // a little spill from the open door
  return c
}
// the window's beam and the daylight (added over the painting once the curtain opens):
// a soft patch of sun on the floor, the window's bars throwing their shadows across it
function daylight() {
  const { x, y, w, h } = SPOT.window
  const c = document.createElement('canvas'); c.width = RW * LS; c.height = RH * LS
  const g = c.getContext('2d')
  g.scale(LS, LS)
  g.filter = 'blur(2.5px)'
  // the patch on the floor: from under the window, thrown forward (toward us) and to the left
  const top = SPOT.floorTop + 2, bot = top + 78
  const grad = g.createLinearGradient(0, top, 0, bot)
  grad.addColorStop(0, 'rgba(255,240,190,0.62)'); grad.addColorStop(0.6, 'rgba(255,232,170,0.4)'); grad.addColorStop(1, 'rgba(255,226,160,0)')
  g.fillStyle = grad
  g.beginPath(); g.moveTo(x - 2, top); g.lineTo(x + w + 2, top); g.lineTo(x + w - 40, bot); g.lineTo(x - 52, bot); g.closePath(); g.fill()
  // the window bars: dark stripes across the patch, along the same slant
  g.globalCompositeOperation = 'destination-out'
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.6
  for (let i = 1; i < 4; i++) {
    const fx = x + (w / 4) * i
    g.beginPath(); g.moveTo(fx, top); g.lineTo(fx - 50, bot); g.stroke()
  }
  g.beginPath(); g.moveTo(x - 20, top + 30); g.lineTo(x + w - 8, top + 30); g.stroke()
  g.globalCompositeOperation = 'source-over'
  // the window itself glows, and the wall under it takes a wash of light
  g.filter = 'blur(4px)'
  const gl = g.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 38)
  gl.addColorStop(0, 'rgba(255,250,220,0.5)'); gl.addColorStop(1, 'rgba(255,250,220,0)')
  g.fillStyle = gl; g.fillRect(x - 40, y - 40, w + 80, h + 100)
  return c
}
function fireGlow() {
  return radial(RW, RH, 75, 86, 64, [[0, 'rgba(255,150,60,0.55)'], [0.35, 'rgba(255,110,40,0.25)'], [1, 'rgba(255,90,30,0)']])
}
function vignette() {
  const c = document.createElement('canvas'); c.width = RW * LS; c.height = RH * LS
  const x = c.getContext('2d')
  const g = x.createRadialGradient(75 * LS, 170 * LS, 50 * LS, 75 * LS, 170 * LS, 200 * LS)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)')
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height)
  return c
}

// ── things the player can pick up, use, or be handed ───────────────────────────
// Not part of the painted background: each is its own little sprite, with an id, so the
// script (and later the inventory) can find it, move it, take it. `at` is the top-left, in
// room pixels. `stand` is where something standing at it would stand (for reach and so on).
const T = SPOT.table, CH = SPOT.chair
export const PROPS = {
  stew:    { label: { ga: 'Stobhach', en: 'Stew' },           at: [T.x + 5,  T.y + 5],  size: [11, 7] },
  bread:   { label: { ga: 'Builín',   en: 'Bread' },          at: [T.x + 20, T.y + 7],  size: [12, 7] },
  cup:     { label: { ga: 'Cupán',    en: 'A cup' },          at: [T.x + 33, T.y + 5],  size: [5, 6] },
  candle:  { label: { ga: 'Coinneal', en: 'A candle' },       at: [T.x + 37, T.y + 7],  size: [6, 9] },
  clothes: { label: { ga: 'Do chuid éadaigh', en: 'Your clothes' }, at: [CH.x, CH.y + 12], size: [18, 14] },
  boots:   { label: { ga: 'Buataisí', en: 'Your boots' },     at: [CH.x - 5, CH.y + 29], size: [CH.w + 10, 9] },
}
const paintProp = {
  stew(b) {
    b.fill(0, 0, 11, 7, (px, py, i, j) => { const e = ((i - 5) / 5.6) ** 2 + ((j - 3) / 3.4) ** 2; return e > 1 ? null : e > 0.62 ? '#7a5a34' : '#8a4a22' })
    b.rect(3, 1, 3, 1, '#b9783a')
  },
  bread(b) {
    b.fill(0, 0, 12, 7, (px, py, i, j) => { const e = ((i - 6) / 6.4) ** 2 + ((j - 3) / 3.6) ** 2; return e > 1 ? null : mix('#d49a4c', '#8e5c28', j / 7) })
    b.rect(3, 1, 2, 1, '#f0c27a'); b.rect(7, 2, 2, 1, '#f0c27a')
  },
  cup(b) { b.rect(0, 0, 5, 6, '#8a6a3a'); b.rect(0, 0, 5, 1, '#b08a52'); b.rect(1, 1, 3, 1, '#4a3220'); b.rect(0, 5, 5, 1, '#5a4224') },
  candle(b) { b.rect(0, 7, 6, 2, '#46423f'); b.rect(2, 3, 2, 5, '#e8dcb4'); b.rect(2, 3, 2, 1, '#fff4c8') },
  // laid out on the chest: a cloak folded underneath, trousers, a tunic with its sleeves out, a belt, a pair of boots
  clothes(b) {
    b.fill(0, 6, 18, 8, (px, py, i, j) => tone(j < 2 ? '#7d8ba0' : '#5d6b80', 0.92 + hash(px, py, 82) * 0.14))     // the cloak, folded
    b.rect(0, 6, 18, 1, '#a3b0c4'); b.rect(0, 13, 18, 1, '#44505f'); b.rect(6, 7, 1, 6, '#4a5668')
    b.fill(10, 0, 7, 10, (px, py, i, j) => tone(i === 3 && j > 4 ? '#3c2814' : '#6e4c2e', 0.9 + hash(px, py, 83) * 0.2))   // trousers
    b.fill(2, 1, 9, 9, (px, py, i, j) => tone('#ddd3b2', 0.92 + hash(px, py, 84) * 0.12 - (j > 7 ? 0.1 : 0)))    // the tunic
    b.rect(0, 3, 3, 4, '#cfc4a2'); b.rect(0, 3, 3, 1, '#ece4c8'); b.rect(0, 6, 3, 1, '#a89e80')                    // its sleeves
    b.rect(8, 3, 3, 3, '#cfc4a2')
    b.rect(5, 1, 3, 1, '#3a2a20'); b.rect(2, 7, 9, 1, '#4a3220'); b.set(6, 7, '#8a7a4a')                           // neck, belt, buckle
    b.rect(12, 11, 3, 3, '#3e2a1b'); b.rect(15, 11, 3, 3, '#4a331f'); b.rect(12, 11, 6, 1, '#6a4a30')               // boots
  },
  boots(b) {
    for (const bx of [0, CH.w + 4]) { b.rect(bx, 4, 6, 5, '#3e2a1b'); b.rect(bx, 4, 6, 1, '#6a4a30'); b.rect(bx + 1, 0, 4, 4, '#4a331f') }
  },
}
function propCanvases() {
  const out = {}
  for (const [id, p] of Object.entries(PROPS)) {
    const b = new Buf(p.size[0], p.size[1]); paintProp[id](b); out[id] = b.canvas()
  }
  return out
}


// ── all of it ───────────────────────────────────────────────────────────────
// img: the Oryx world sheet (an <img> or canvas), for the floor, the south wall and the door.
export function paintRoom(img) {
  const b = new Buf(RW, RH)
  thatchAndBeam(b)
  backWall(b)
  hearth(b)
  windowPane(b)
  shelf(b)
  woodPile(b)
  bed(b)
  chair(b)
  table(b)
  frame(b)

  const base = floorCanvas(img)
  base.getContext('2d').drawImage(b.canvas(), 0, 0)
  if (img) southWall(base.getContext('2d'), img)

  return {
    base,
    door: img ? { closed: doorCanvas(img, 137, false), open: doorCanvas(img, 138, true) } : null,
    curtainClosed: curtain(false),
    curtainOpen: curtain(true),
    blanket: blanket(),
    props: propCanvases(),
    dark: darkness(),
    day: daylight(),
    glow: fireGlow(),
    vignette: vignette(),
    LS,
  }
}


// ── the same pieces, one transparent image each ─────────────────────────────
// For the official map (skye_tigh_ceann), where the perspective ground draws them as billboards.
// Each box is cut on the floor's 24px tile rows, so the base of the image sits on a tile edge
// (the floor's cells are 16..136 across and 84..276 down: see SPOT.floorTop).
export const PARTS = {
  wall:    { box: [4, 0, 148, 84],    paint: (b) => { thatchAndBeam(b); backWall(b); hearth(b); windowPane(b); shelf(b); woodPile(b) } },
  bed:     { box: [6, 148, 74, 204],  paint: (b) => bed(b) },
  chair:   { box: [108, 108, 140, 156], paint: (b) => chair(b) },
  table:   { box: [76, 208, 144, 252],  paint: (b) => table(b) },
}
// painted in the wall's own box so they register exactly over it
export const WALL_BOX = PARTS.wall.box

function crop(src, [x0, y0, x1, y1]) {
  const c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0
  c.getContext('2d').drawImage(src, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0)
  return c
}
export function paintParts(img) {
  const out = {}
  for (const [id, p] of Object.entries(PARTS)) { const b = new Buf(RW, RH); p.paint(b); out[id] = crop(b.canvas(), p.box) }
  out.curtainClosed = crop(curtain(false), [16, 0, 136, 84])
  out.curtainOpen = crop(curtain(true), [16, 0, 136, 84])
  out.blanket = crop(blanket(), PARTS.bed.box)
  const sw = document.createElement('canvas'); sw.width = RW; sw.height = RH
  if (img) southWall(sw.getContext('2d'), img)
  out.south = crop(sw, [4, 276, 148, 300])
  if (img) { out.doorClosed = doorCanvas(img, 137, false); out.doorOpen = doorCanvas(img, 138, true) }
  for (const [id, c] of Object.entries(propCanvases())) out['prop_' + id] = c
  return out
}


// ── the room as solids (perspective): wall planes and furniture as boxes ────
// One tile is 24px here too. Faces are painted flat; the ground renderer lays them in perspective.
function planks(b, w, h, base = P.tbL, dark = P.tbD, light = P.tbH, vertical = false) {
  b.fill(0, 0, w, h, (x, y) => {
    const k = vertical ? x : y
    return k % 6 === 0 ? dark : (k % 6 === 1 ? light : tone(base, 0.92 + 0.12 * hash(x >> 1, y >> 1, 21)))
  })
}
// the slanted corner planes: the same plaster, a little darker (they turn away from the light)
function sideWallCanvasSized(w, shade) {
  const src = sideWallCanvas(), c = document.createElement('canvas'); c.width = w; c.height = src.height
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false
  g.drawImage(src, 0, 0, src.width, src.height, 0, 0, w, src.height)
  g.fillStyle = `rgba(0,0,0,${1 - shade})`; g.fillRect(0, 0, w, src.height)
  return c
}
const CEIL = 60                                           // a low cottage ceiling: 2.5 tiles (thatch foot 12px, tie beam 5px)
function sideWallCanvas() {            // 7.25 tiles deep (the cut corners take the rest), back (u = 0) to front; 3.5 tiles high
  const w = 174, h = CEIL, b = new Buf(w, h)
  b.fill(0, 0, w, h, (x, y) => {
    const n = hash(x >> 2, y >> 2, 11), f = hash(x, y, 12)
    let c = mix(P.plM, P.plL, 0.35 + n * 0.55)
    if (f < 0.04) c = mix(c, P.plD, 0.5)
    return tone(c, 0.9 - 0.12 * (x / w))                       // a little darker toward us
  })
  b.fill(0, 0, w, 12, (x, y) => tone(((y >> 1) & 1) ? P.thM : '#46301a', 0.85 + 0.15 * hash(x >> 2, y >> 1, 3)))   // the thatch's foot
  b.rect(0, 12, w, 5, P.tbM); b.rect(0, 12, w, 1, P.tbH); b.rect(0, 16, w, 1, P.tbD)                               // the tie beam
  b.rect(0, h - 4, w, 4, P.tbM); b.rect(0, h - 4, w, 1, P.tbH); b.rect(0, h - 1, w, 1, P.tbD)                       // skirting
  return b.canvas()
}
function boxCanvas(w, h, paint) { const b = new Buf(w, h); paint(b); return b.canvas() }
function withProps(c, list) {
  const cx = c.getContext('2d'), pc = propCanvases()
  for (const [id, x, y] of list) cx.drawImage(pc[id], x, y)
  return c
}
export function paintSolids() {
  const o = {}
  o.sideWall = sideWallCanvas()
  o.cornerWall = sideWallCanvasSized(18, 0.82)
  o.voidBack = boxCanvas(16, 8, (b) => b.rect(0, 0, 16, 8, '#05050a'))      // the dark beyond the back wall
  o.backWall = crop(boxCanvasFrom(PARTS.wall.paint), [16, 0, 136, 84])
  // bed: 1 x 2 tiles (lengthwise along the west wall), 0.55 high (13px). Head (pillow) at the north end; a plain
  // blanket, red and green, over the rest.
  const bedBase = (b) => b.fill(0, 0, 24, 48, (x, y) => (y % 6 === 0 ? '#a89c78' : '#b6aa86'))
  const pillow = (b, dent = 0) => b.fill(2, 1, 20, 15, (x, y, i, j) => { const e = ((i - 9.5) / 10.2) ** 2 + ((j - 7) / 7.8) ** 2; return e > 1 ? null : mix(P.linen, P.linenD, Math.min(1, e * 0.9 + (((i - 9.5) / 5) ** 2 + ((j - 7) / 4) ** 2 < 1 ? dent : 0))) })
  const blanket = (b, y0) => b.fill(0, y0, 24, 48 - y0, (x, y, i, j) => { const st = (i % 14) < 2 || (j % 20) < 2; return tone(st ? P.clothR : P.clothG, 0.95) })
  o.bedTop = boxCanvas(24, 48, (b) => { bedBase(b); pillow(b); blanket(b, 16); b.rect(0, 16, 24, 1, P.clothGL) })
  // the same bed with the sleeper in it: a round head on the pillow (red hair, face turned up, eyes shut), the
  // shoulders and a long body under the blanket, a shadow along the near edge: plainly someone is in it
  o.bedTopSleeping = boxCanvas(24, 48, (b) => {
    bedBase(b); pillow(b)
    blanket(b, 15)
    b.fill(1, 14, 22, 33, (x, y, i, j) => { const body = Math.abs(i - 11) < 9.5 - j * 0.07; return body ? tone(((i % 14) < 2 || (j % 20) < 2) ? P.clothR : P.clothG, 1.22 - 0.1 * Math.sin(j * 0.5)) : null })   // the long body
    b.fill(2, 13, 20, 7, (x, y, i, j) => { const e = ((i - 10) / 10.5) ** 2 + ((j - 3.5) / 4.2) ** 2; return e > 1 ? null : tone(P.clothG, 1.32) })   // the shoulders
    b.fill(5, 2, 14, 14, (x, y, i, j) => { const e = ((i - 7) / 7.2) ** 2 + ((j - 7) / 7.2) ** 2; if (e > 1) return null; if (e > 0.8) return '#6a2c0f'; return j < 5 ? '#b4501f' : '#e6b992' })   // the head
    b.rect(8, 9, 2, 1, '#3a2a20'); b.rect(13, 9, 2, 1, '#3a2a20')                  // closed eyes
    b.rect(0, 15, 24, 1, P.clothGL); b.mulRect(21, 0, 3, 48, 0.82)                  // a shadow along the near edge
  })
  // got up: the blanket thrown back off the pillow, the pillow dented
  o.bedTopEmpty = boxCanvas(24, 48, (b) => {
    bedBase(b); pillow(b, 0.55)
    b.fill(0, 28, 24, 20, (x, y, i, j) => { const st = (i % 14) < 2 || (j % 20) < 2; return tone(st ? P.clothR : P.clothG, 0.95 + 0.15 * Math.sin(i * 0.8)) })
    b.fill(2, 20, 20, 9, (x, y, i, j) => (Math.abs(j - 4) + Math.abs(i - 11) * 0.35 < 7 + Math.sin(i) * 1.5 ? tone(P.clothG, 1.1 + 0.15 * Math.sin(i * 1.1)) : null))   // the fold
  })
  o.bedFront = boxCanvas(24, 13, (b) => { planks(b, 24, 13); b.rect(0, 0, 24, 1, P.tbH) })
  o.bedSide = boxCanvas(48, 13, (b) => { planks(b, 48, 13); b.rect(0, 0, 48, 1, P.tbH) })
  // table: 2 x 1 tiles, 0.9 high (22px). What is on it is painted on its top.
  o.tableTop = withProps(boxCanvas(48, 24, (b) => { planks(b, 48, 24, P.tbL, P.tbM, P.tbH, true) }), [['stew', 4, 7], ['bread', 19, 8], ['cup', 33, 6], ['candle', 40, 5]])
  o.tableFront = boxCanvas(48, 22, (b) => {
    b.rect(3, 4, 42, 18, '#241a10')
    b.rect(0, 0, 48, 4, P.tbL); b.rect(0, 0, 48, 1, P.tbH); b.rect(0, 3, 48, 1, P.tbD)
    for (const x of [2, 43]) { b.rect(x, 4, 3, 18, P.tbM); b.rect(x, 4, 1, 18, P.tbL) }
  })
  o.tableSide = boxCanvas(24, 22, (b) => { b.rect(3, 4, 18, 18, '#241a10'); b.rect(0, 0, 24, 4, P.tbL); b.rect(0, 0, 24, 1, P.tbH); b.rect(0, 3, 24, 1, P.tbD); b.rect(2, 4, 3, 18, P.tbM); b.rect(19, 4, 3, 18, P.tbM) })
  // chair: a seat (0.7 x 0.7, 0.5 high) with the clothes on it, and a thin back
  // the clothes chest at the foot of the bed: a low box (0.9 x 0.8 tiles, 0.46 high) with the clothes laid on its lid
  const chestFace = (w, h) => boxCanvas(w, h, (b) => { planks(b, w, h, P.tbM, P.tbD, P.tbL); b.rect(0, 0, w, 1, P.tbH); b.rect(3, 0, 2, h, P.iron); b.rect(w - 5, 0, 2, h, P.iron); b.rect(w / 2 - 1, 3, 3, 3, P.ironL) })
  o.seatTop = withProps(boxCanvas(22, 19, (b) => { planks(b, 22, 19, P.tbL, P.tbM, P.tbH); b.rect(3, 0, 2, 19, P.iron); b.rect(17, 0, 2, 19, P.iron) }), [['clothes', 2, 3]])
  o.seatTopEmpty = boxCanvas(22, 19, (b) => { planks(b, 22, 19, P.tbL, P.tbM, P.tbH); b.rect(3, 0, 2, 19, P.iron); b.rect(17, 0, 2, 19, P.iron) })
  o.seatFront = chestFace(22, 11)
  o.seatSide = chestFace(19, 11)
  // ── v7: the woodpile, the sleeper's blanket, and a door tall enough for a man ──
  // the woodpile (0.7 x 0.6 tiles, 0.8 high): the log ENDS face us, bark along the top and the side
  const logEnds = (w, h) => boxCanvas(w, h, (b) => {
    b.rect(0, 0, w, h, '#241608')
    for (let r = 0; r * 6 < h; r++) for (let c = 0; c * 6 < w; c++) {
      const cx = c * 6 + (r % 2) * 3 - (r % 2 ? 0 : 0), dark = hash(c, r, 88) < 0.4
      if (cx + 6 > w + 2) continue
      b.fill(cx, r * 6, 6, 6, (px, py, i, j) => {
        const e = ((i - 2.5) / 3) ** 2 + ((j - 2.5) / 3) ** 2
        if (e > 1) return null
        return e > 0.7 ? '#4a301a' : e < 0.12 ? '#7a4f26' : (dark ? '#9a6a38' : '#c8975c')
      })
    }
  })
  const bark = (w, h, horiz) => boxCanvas(w, h, (b) => b.fill(0, 0, w, h, (x, y) => {
    const k = horiz ? y : x, n = Math.floor(k / 3), edge = (k % 3) === 2
    return tone(mix('#6a4426', '#8a5c30', hash(n, 5, 71)), edge ? 0.62 : 0.85 + 0.2 * hash(x, y, 72))
  }))
  o.woodFront = logEnds(17, 19)
  o.woodTop = bark(17, 14, false)
  o.woodSide = bark(14, 19, true)
  // the sleeper: a head on the pillow (a stand-in painted here; the scene paints the real hero sprite over it)
  // and four blanket steps over him (shoulders, hips, knees, feet): red and green, as the bed's own blanket
  const stripe = (w, h, k) => boxCanvas(w, h, (b) => b.fill(0, 0, w, h, (x, y) => tone(((x % 12) < 2 || (y % 14) < 2) ? P.clothR : P.clothG, k)))
  o.sleepBlanketTop = stripe(20, 14, 1.12)
  o.sleepBlanketFront = stripe(20, 8, 0.8)
  o.sleepBlanketSide = stripe(14, 8, 0.7)
  // the head faces the foot of the bed (propped on the pillow): its front is the face (the scene paints the real sprite's head over this), its top and sides hair
  o.sleepHeadTop = boxCanvas(14, 13, (b) => b.fill(0, 0, 14, 13, (x, y) => tone('#b4501f', 0.85 + 0.25 * hash(x, y, 61))))
  o.sleepHeadFront = boxCanvas(14, 14, (b) => {
    b.fill(0, 0, 14, 14, (x, y) => (y < 4 || x < 1 || x > 12 ? tone('#b4501f', 0.9) : '#e6b992'))
    b.rect(3, 8, 3, 1, '#3a2a20'); b.rect(9, 8, 3, 1, '#3a2a20'); b.rect(6, 11, 3, 1, '#b8705a')
  })
  o.sleepHeadSide = boxCanvas(12, 14, (b) => b.fill(0, 0, 12, 14, (x, y) => tone('#9a4218', 0.85 + 0.25 * hash(x, y, 62))))
  // his feet, bare, under the end of the blanket
  o.sleepFootFront = boxCanvas(5, 6, (b) => b.rect(0, 0, 5, 6, '#d9a982'))
  o.sleepFootTop = boxCanvas(5, 4, (b) => { b.rect(0, 0, 5, 4, '#e6b992'); b.rect(0, 0, 5, 1, '#c08662') })
  o.sleepFootSide = boxCanvas(4, 6, (b) => b.rect(0, 0, 4, 6, '#b87a58'))
  return o
}

function boxCanvasFrom(paint) { const b = new Buf(RW, RH); paint(b); return b.canvas() }


// ── the wider cabin (8 tiles across): a back wall 192px wide, a small raised hearth, a tall door ──
const BW = 144, BH = CEIL
// A small alcove hearth set into the wall, its floor raised off the ground on a plinth. The breast stops
// well short of the rafters; the opening is a round-headed recess in two steps, blackened inside.
function hearth8(b) {
  const bx0 = 68, bx1 = 112, top = 26, cx = 90, r = 11, crown = 38, spring = crown + r, sill = 66
  b.fill(bx0, top, bx1 - bx0, BH - top - 2, (x, y) => {
    const n = hash(x >> 2, y >> 2, 31), edge = Math.min(x - bx0, bx1 - 1 - x)
    return tone(mix(P.plL, P.plH, 0.3 + n * 0.5), edge < 2 ? 0.86 : 1)
  })
  b.rect(bx0, top, bx1 - bx0, 3, P.plD); b.rect(bx0 - 2, top - 1, bx1 - bx0 + 4, 3, mix(P.plD, P.plM, 0.4))   // a plain cap
  const inside = (x, y, g) => {
    const hw = 11 + g
    if (x < cx - hw || x >= cx + hw || y < crown - g || y >= sill) return false
    if (y >= spring) return true
    const dx = x + 0.5 - cx; return dx * dx + (y - spring) ** 2 <= (r + g) ** 2
  }
  for (let y = top; y < sill + 1; y++) for (let x = bx0; x < bx1; x++) {
    if (inside(x, y, 0)) { const t = Math.max(0, (y - 44) / 22); b.set(x, y, mix('#0a0706', '#2b1810', t * t * 0.9 + (bay(x, y) - 0.5) * 0.05)) }
    else if (inside(x, y, 2)) b.set(x, y, mix(P.plD, P.plM, 0.45))          // the inner step
    else if (inside(x, y, 5)) b.set(x, y, mix(P.plM, P.plL, 0.3))           // the outer step
  }
  // the raised hearthstone, and a lower step under it
  b.rect(cx - 17, sill, 34, 3, '#8d887c'); b.rect(cx - 17, sill, 34, 1, '#b8b3a4'); b.rect(cx - 17, sill + 2, 34, 1, '#5f5b52')
  b.rect(cx - 20, sill + 3, 40, 3, '#7d786d'); b.rect(cx - 20, sill + 3, 40, 1, '#a39e90'); b.rect(cx - 20, sill + 5, 40, 1, '#4f4b43')
  b.mulRect(cx - 20, sill + 6, 40, 3, 0.8)
  // ash, two logs and a few embers on the hearthstone
  b.rect(cx - 9, sill - 2, 18, 2, '#1d1511')
  b.rect(cx - 9, sill - 5, 16, 3, '#3a2412'); b.rect(cx - 9, sill - 5, 16, 1, '#5c3a1e')
  b.rect(cx - 5, sill - 7, 11, 2, '#46281a'); b.rect(cx - 5, sill - 7, 11, 1, '#6a4020')
  for (let i = 0; i < 6; i++) b.set(cx - 7 + Math.floor(hash(i, 1, 40) * 14), sill - 4 + Math.floor(hash(i, 2, 40) * 2), hash(i, 3, 40) < 0.5 ? '#ff7a22' : '#ffb347')
  // a chain from the crown, and a small cauldron
  for (let y = crown; y < crown + 12; y += 2) b.set(cx, y, P.ironL)
  for (let y = 0; y < 8; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 3) / 5) ** 2)) * 6)
    for (let x = -half; x <= half; x++) b.set(cx + x, crown + 12 + y - 3, mix(P.iron, P.ironL, (x + half) / (half * 2 + 1) * 0.5))
  }
  b.rect(cx - 6, crown + 9, 13, 2, P.ironL)
}
function wallBase8(b) {
  b.fill(0, 0, BW, 12, (x, y) => tone(((y >> 1) & 1) ? P.thM : '#46301a', 0.85 + 0.15 * hash(x >> 2, y >> 1, 3)))
  b.mulRect(0, 0, BW, 4, 0.7)
  b.rect(0, 12, BW, 5, P.tbM); b.rect(0, 12, BW, 1, P.tbH); b.rect(0, 16, BW, 1, P.tbD)
  b.fill(0, 17, BW, BH - 17, (x, y) => {
    const n = hash(x >> 2, y >> 2, 11), f = hash(x, y, 12)
    let c = mix(P.plM, P.plL, 0.35 + n * 0.55)
    if (f < 0.04) c = mix(c, P.plD, 0.5)
    return tone(c, 1 - 0.18 * Math.max(0, 1 - (y - 17) / 14))
  })
  b.mulRect(0, 17, BW, 3, 0.85)
  b.rect(0, BH - 4, BW, 4, P.tbM); b.rect(0, BH - 4, BW, 1, P.tbH); b.rect(0, BH - 1, BW, 1, P.tbD)
}
function blit(dst, src, sx, sy, sw, sh, dx, dy) { dst.getContext('2d').drawImage(src, sx, sy, sw, sh, dx, dy, sw, sh) }
// the three canvases, each BW x BH and registering exactly: wall (with hearth, shelf, woodpile, window), curtain shut, curtain drawn back
// the small cabin: 5 tiles across (120px). The hearth stands in the middle (a solid, below); a shelf and the
// woodpile on its left; on its right a window no bigger than a face, high up, with its curtain.
export const WIN = { x: 106, y: 19, w: 12, h: 16 }
export function paintBack8() {
  const b = new Buf(BW, BH); wallBase8(b)
  shelf(b, 20, 31)                                      // a shelf beside the hearth (the woodpile under it is a solid)
  windowPane(b, WIN)
  const wall = b.canvas()
  const mk = (open) => curtain(open, WIN, BW, BH)
  return { wall, curtainClosed: mk(false), curtainOpen: mk(true) }
}
export function paintCabin8() {
  const o = paintBack8()
  return { back8: o.wall, curtain8Closed: o.curtainClosed, curtain8Open: o.curtainOpen, ...paintHearthSolids() }
}


// ── the hearth as a solid: a chimney breast standing out from the wall, with two low steps up to it ──
// Front 44 x 62 (1.83 x 2.58 tiles, up to the tie beam); the opening's sill is 12px (half a tile) off the floor.
function slab(w, h, base = P.stM, light = P.stH, dark = P.stD) {
  const b = new Buf(w, h)
  b.fill(0, 0, w, h, (x, y) => tone(mix(base, light, 0.25 + 0.5 * hash(x >> 2, y >> 2, 61)), 0.92 + 0.12 * hash(x, y, 62)))
  b.rect(0, 0, w, 1, light); b.rect(0, h - 1, w, 1, dark)
  for (let x = 14; x < w; x += 16) b.rect(x, 0, 1, h, dark)
  return b.canvas()
}
function paintHearthSolids() {
  // 44 x 44 (1.83 x 1.83 tiles: up to the tie beam); the opening is a round-headed recess, 26px (a tile and a bit)
  // high, its sill 12px (half a tile) off the floor.
  const W = 44, H = 44, cx = 22, r = 9, crown = 5, spring = crown + r, sill = 32
  const f = new Buf(W, H)
  f.fill(0, 0, W, H, (x, y) => { const n = hash(x >> 2, y >> 2, 31), e = Math.min(x, W - 1 - x); return tone(mix(P.plL, P.plH, 0.3 + n * 0.5), e < 2 ? 0.86 : 1) })
  const inside = (x, y, g) => {
    const hw = r + g
    if (x < cx - hw || x >= cx + hw || y < crown - g || y >= sill) return false
    if (y >= spring) return true
    const dx = x + 0.5 - cx; return dx * dx + (y - spring) ** 2 <= (r + g) ** 2
  }
  for (let y = 0; y < sill + 1; y++) for (let x = 0; x < W; x++) {
    if (inside(x, y, 0)) { const t = Math.max(0, (y - 12) / 20); f.set(x, y, mix('#0a0706', '#2b1810', t * t * 0.9 + (bay(x, y) - 0.5) * 0.05)) }
    else if (inside(x, y, 2)) f.set(x, y, mix(P.plD, P.plM, 0.45))
    else if (inside(x, y, 4)) f.set(x, y, mix(P.plM, P.plL, 0.3))
  }
  // soot staining on the face above the crown
  for (let y = 0; y < crown; y++) for (let x = cx - 8; x <= cx + 8; x++) {
    const k = (1 - y / crown) * (1 - Math.abs(x - cx) / 9) * 0.5
    if (k > 0.04) f.mul(x, y, 1 - k * (0.7 + 0.3 * hash(x, y, 71)))
  }
  f.rect(0, 0, W, 2, P.plD)                                              // the cap
  f.rect(cx - 12, sill, 24, 2, '#8d887c'); f.rect(cx - 12, sill, 24, 1, '#b8b3a4')                          // the lip of the hearthstone
  f.rect(cx - 8, sill - 2, 16, 2, '#1d1511')                                                              // ash, logs, embers
  f.rect(cx - 8, sill - 5, 14, 3, '#3a2412'); f.rect(cx - 8, sill - 5, 14, 1, '#5c3a1e')
  f.rect(cx - 4, sill - 7, 10, 2, '#46281a'); f.rect(cx - 4, sill - 7, 10, 1, '#6a4020')
  for (let i = 0; i < 6; i++) f.set(cx - 6 + Math.floor(hash(i, 1, 40) * 12), sill - 4 + Math.floor(hash(i, 2, 40) * 2), hash(i, 3, 40) < 0.5 ? '#ff7a22' : '#ffb347')
  for (let y = crown; y < crown + 7; y += 2) f.set(cx, y, P.ironL)                                         // chain and cauldron
  for (let y = 0; y < 8; y++) { const half = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 3) / 5) ** 2)) * 6); for (let x = -half; x <= half; x++) f.set(cx + x, crown + 7 + y - 3, mix(P.iron, P.ironL, (x + half) / (half * 2 + 1) * 0.5)) }
  f.rect(cx - 6, crown + 4, 13, 2, P.ironL)
  const sd = new Buf(12, H)
  sd.fill(0, 0, 12, H, (x, y) => tone(mix(P.plM, P.plL, 0.3 + 0.4 * hash(x >> 2, y >> 2, 33)), 0.78))
  sd.rect(0, 0, 12, 2, P.plD)
  return { hearthFront: f.canvas(), hearthSide: sd.canvas(), slabTop: slab(64, 14), slabFront: slab(64, 5), slabSide: slab(14, 5) }
}


// ── outside: the cottage seen from the front, and the tumbledown wall ──────────────────────
// (tighAmuigh.js; exported by the same tool as the rest, as outHouse, outWallFront, outWallTop, outWallSide)
const stoneFill = (b, x, y, w, h, s = 1, light = 1) => b.fill(x, y, w, h, (px, py, i, j) => {
  const row = Math.floor(j / 5), off = (row % 2) * 4 + Math.floor(hash(row, s, 5) * 6), bx = Math.floor((i + off) / 9)
  const edge = ((i + off) % 9 === 0) || (j % 5 === 0)
  return tone(mix(P.stL, P.stH, hash(bx, row, s) * 0.8), (edge ? 0.6 : 0.9 + 0.2 * hash(px, py, s + 1)) * light)
})
const blob = (b, cx, cy, rx, ry, fn) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (e <= 1) { const c = fn(x, y, e); if (c) b.set(x, y, c) } } }

// ── the garden outside ───────────────────────────────────────────────────────
// Dry-stone walls (rough fieldstones, no mortar, moss over everything), a thatched cottage, bushes, flagstones.
const GREY = ['#8a867d', '#77736b', '#9a948a', '#6b675f', '#a39c8e', '#7e776b', '#8d8574']
const MOSS = ['#46692c', '#5b8236', '#7aa044', '#3a5a26']
const clamp01 = (v) => Math.max(0, Math.min(1, v))

// one rounded stone: centre (cx, cy), half sizes (rx, ry), lit from the upper left, mossy on its top
function rock(b, cx, cy, rx, ry, seed, mossy) {
  const n = 2.2 + hash(seed, 1, 70) * 1.2
  const base = mix(GREY[Math.floor(hash(seed, 2, 70) * GREY.length)], '#8a7f6a', hash(seed, 3, 70) * 0.3)
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry
    const e = Math.abs(nx) ** n + Math.abs(ny) ** n
    if (e > 1) continue
    let f = 0.92 - 0.28 * (nx * 0.55 + ny * 0.85) + 0.12 * (hash(x, y, seed) - 0.5)
    if (e > 0.7) f *= 0.8                                                    // the rounded edge turns away
    let c = tone(base, f)
    if (hash(x >> 1, y >> 1, seed + 5) < 0.06) c = mix(c, '#c9c2a8', 0.45)  // lichen
    if (mossy && ny < -0.1 + (hash(x, y, seed + 9) - 0.5) * 0.9 && hash(x, y, seed + 11) < mossy) c = mix(c, MOSS[Math.floor(hash(x >> 1, y, seed + 12) * MOSS.length)], 0.75)
    b.set(x, y, c)
  }
}

// a face of rubble: rows of unlike stones, the gaps between them black
function rubble(b, w, h, seed, mossy, dark = 1) {
  b.fill(0, 0, w, h, () => '#26231f')
  let y = -2, row = 0
  while (y < h) {
    const rh = 6 + Math.floor(hash(row, seed, 71) * 5)
    let x = -Math.floor(hash(row, seed, 72) * 9), k = 0
    while (x < w) {
      const sw = 7 + Math.floor(hash(k, row + seed * 7, 73) * 9), sh = rh - Math.floor(hash(k, row + seed * 5, 74) * 3)
      rock(b, x + sw / 2, y + rh - sh / 2 - 0.5 + (hash(k, row, 75) - 0.5) * 1.5, sw / 2 - 0.4, sh / 2 + 0.3, seed * 131 + row * 17 + k, mossy)
      x += sw; k++
    }
    y += rh - 1; row++
  }
  if (dark !== 1) b.mulRect(0, 0, w, h, dark)
}

function mossTop(w, h, seed) {
  const b = new Buf(w, h)
  b.fill(0, 0, w, h, (x, y) => tone(mix('#3f6228', '#7aa044', hash(x >> 1, y >> 1, seed) * 0.9), 0.85 + 0.3 * hash(x, y, seed + 1)))
  for (let i = 0; i < 5; i++) rock(b, 3 + hash(i, seed, 77) * (w - 6), 3 + hash(i, seed, 78) * (h - 6), 3 + hash(i, seed, 79) * 3, 2.5 + hash(i, seed, 80) * 2.5, seed * 13 + i, 0.3)
  for (let i = 0; i < 14; i++) b.set(hash(i, seed, 81) * w, hash(i, seed, 82) * h, ['#e8d870', '#f4efe6', '#9fc06a'][i % 3])
  return b.canvas()
}

// a bush, dense and leafy; kind: 0 plain, 1 hawthorn blossom, 2 gorse, 3 bramble
function bush(seed, kind) {
  const W = 44, H = 34, b = new Buf(W, H), cs = []
  const n = 5 + Math.floor(hash(seed, 1, 90) * 3)
  for (let i = 0; i < n; i++) cs.push([8 + hash(i, seed, 91) * (W - 16), 12 + hash(i, seed, 92) * (H - 22), 7 + hash(i, seed, 93) * 6])
  for (let y = 0; y < H - 2; y++) for (let x = 0; x < W; x++) {
    let v = 0; for (const [cx, cy, r] of cs) v = Math.max(v, 1 - Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.05) / r)
    if (v <= 0) continue
    const t = clamp01(0.2 + (1 - y / H) * 0.5 + (hash(x >> 1, y >> 1, seed + 3) - 0.5) * 0.5 + v * 0.15)
    let c = mix('#1a4a10', '#8fc43a', t)
    const k = hash(x, y, seed + 4)
    if (k < 0.1) c = mix(c, '#b4d062', 0.6); else if (k < 0.2) c = tone(c, 0.7)
    if (y > H - 9) c = tone(c, 0.78)
    b.set(x, y, c)
    if (v > 0.12 && y < H - 7 && kind && hash(x, y, seed + 6) < 0.07) {
      const fc = kind === 1 ? '#f6f2e6' : kind === 2 ? '#f2d23a' : (hash(x, y, seed + 7) < 0.5 ? '#d6789a' : '#3a1f3a')
      b.set(x, y, fc); if (kind !== 3) b.set(x + 1, y, fc)
    }
  }
  for (let x = 7; x < W - 7; x++) b.set(x, H - 2, [18, 28, 10], 130)
  return b.canvas()
}

// the cottage: a thatched whitewashed front. withDoor: a painted door; without: an opening for the Oryx door (a sprite)
function paintHouse(withDoor) {
  const O = 26, W = 168, H = 122 + O, h = new Buf(W, H), Y = (y) => y + O
  // the chimney: in the middle of the ridge, behind the thatch (inside, the hearth is in the middle of the back wall)
  // limestone, plain, the finish of the hearth indoors: no bricks, a slab for a cap, soot above, the right side in shade
  h.fill(76, 6, 16, Y(40) - 6, (x, y) => tone(mix(P.plL, P.plH, 0.3 + hash(x >> 2, y >> 2, 31) * 0.5), x < 78 ? 0.86 : x > 89 ? 0.78 : 1))
  h.rect(74, 3, 20, 4, P.plD); h.rect(74, 3, 20, 1, P.plM)
  h.rect(79, 0, 3, 3, '#6a5a4c'); h.rect(86, 0, 3, 3, '#6a5a4c')
  for (let y = 7; y < 20; y++) for (let x = 77; x < 91; x++) h.mul(x, y, 1 - 0.32 * (1 - (y - 7) / 13) * (0.6 + 0.4 * hash(x, y, 71)))
  // whitewashed walls on a stone footing
  h.fill(14, Y(58), 140, 62, (x, y) => tone(mix('#ebe5d3', '#cdc6ae', hash(x >> 1, y >> 1, 3) * 0.6), 0.95 + 0.08 * hash(x, y, 4)))
  stoneFill(h, 14, Y(108), 140, 12, 9, 0.8)
  h.mulRect(14, Y(58), 140, 8, 0.7)                                   // under the eaves
  for (let x = 14; x < 154; x++) if (hash(x >> 1, 7, 52) < 0.3) { const len = 4 + Math.floor(hash(x, 8, 52) * 18); for (let j = 0; j < len; j++) h.mul(x, Y(66) + j, 0.94 - 0.03 * (j / len)) }   // damp streaks
  // the thatch: a deep, shaggy hat
  const lft = (y) => 46 - (y - 6) * (46 / 60), rgt = (y) => 122 + (y - 6) * (46 / 60)
  for (let y = 6; y <= 69; y++) for (let x = 0; x < W; x++) {
    if (x < lft(y) || x > rgt(y)) continue
    if (y > 62 && y > 62 + Math.floor(hash(x >> 1, 0, 9) * 8)) continue          // ragged eaves
    const course = Math.floor(y / 4), n = hash(x >> 1, course, 11), streak = hash(x >> 2, y >> 3, 12)
    let c = mix(P.thL, P.thH, 0.25 + n * 0.55 + (streak - 0.5) * 0.3)
    c = tone(c, 0.82 + 0.3 * hash(x, y, 13) - ((y % 4) === 3 ? 0.18 : 0) + (y - 6) * 0.0012)
    h.set(x, Y(y), c)
  }
  h.mulRect(0, Y(60), W, 10, 0.78)
  for (const [cx, cy, rx, ry] of [[30, 48, 14, 6], [128, 40, 12, 5], [84, 26, 10, 4], [60, 58, 9, 4], [104, 52, 8, 4]]) blob(h, cx, Y(cy), rx, ry, (x, y, e) => (hash(x, y, 14) < 0.75 - e * 0.5 ? tone(mix('#5d7a3a', '#7d9a4a', hash(x, y, 15)), 0.85 + 0.2 * hash(x, y, 16)) : null))   // moss
  h.rect(44, Y(4), 80, 5, '#3d2a14'); h.rect(44, Y(4), 80, 1, '#6a4a22')                // the ridge capping
  for (let x = 48; x < 122; x += 6) h.rect(x, Y(2), 1, 5, '#2b1c0d')                    // crossed spars
  // the door: in the middle, as the hearth is
  const dc = 84
  if (withDoor) {
    const dx0 = dc - 13, dx1 = dc + 13, dy0 = Y(76)
    h.fill(dx0 - 2, dy0 - 3, dx1 - dx0 + 4, 47, (x, y, i, j) => { const inA = j >= 14 || ((x - dc) / 15) ** 2 + ((y - (dy0 + 11)) / 14) ** 2 <= 1; return inA ? tone(P.stM, 0.9 + 0.2 * hash(x, y, 17)) : null })
    h.fill(dx0, dy0, dx1 - dx0, 44, (x, y, i, j) => { const inA = j >= 12 || ((x - dc) / 13) ** 2 + ((y - (dy0 + 12)) / 12) ** 2 <= 1; return inA ? tone(((i % 5) === 0) ? P.sM : P.sL, 0.78 + 0.18 * hash(x, y >> 2, 18)) : null })
    h.rect(dx0, dy0 + 14, dx1 - dx0, 3, P.iron); h.rect(dx0, dy0 + 32, dx1 - dx0, 3, P.iron)
  } else {
    h.rect(dc - 21, Y(122) - 42, 42, 42, '#2e2418')                                       // the dark reveal the door sits in
    stoneFill(h, dc - 25, Y(122) - 49, 50, 6, 11)                                         // a lintel
  }
  stoneFill(h, dc - 25, Y(120), 50, 2 + 0, 21, 0.95)
  stoneFill(h, dc - 24, Y(117), 48, 5, 21, 0.95)                                          // the step
  // a rain barrel
  h.fill(5, Y(94), 17, 26, (x, y, i, j) => { const e = Math.abs(i - 8) / 8.6; return e > 1 - (j < 3 || j > 22 ? 0.12 : 0) ? null : tone(P.tbL, 1 - e * 0.35 + 0.08 * hash(x, y, 40)) })
  for (const y of [98, 107, 115]) h.rect(5, Y(y), 17, 2, P.iron)
  // ivy and weeds, climbing
  for (let i = 0; i < 300; i++) {
    const side = hash(i, 1, 50) < 0.5 ? 0 : 1, base = side ? 150 : 16, spread = side ? 14 : 24
    const x = Math.floor(base + (hash(i, 2, 50) - 0.5) * spread * 2), y = 118 - Math.floor(Math.pow(hash(i, 3, 50), 1.6) * 54)
    if (x < 14 || x > 153 || (x > 60 && x < 108 && y > 70)) continue
    h.set(x, Y(y), hash(i, 4, 50) < 0.5 ? '#4f7a36' : '#6f9a46')
  }
  for (let x = 14; x < 154; x++) if (hash(x, 5, 51) < 0.35 && !(x > 58 && x < 110)) { const hh = 1 + Math.floor(hash(x, 6, 51) * 4); h.rect(x, Y(120) - hh, 1, hh, hash(x, 7, 51) < 0.7 ? '#4a7a3a' : '#e8d870') }
  return h.canvas()
}


// a chariot, long broken and overgrown: one wheel, a wicker body, a snapped pole; ivy, moss, grass and flowers have it
function paintChariot() {
  const W = 80, H = 56, GY = 52, b = new Buf(W, H)
  const wc = [34, 36], R = 17
  for (let y = 0; y < GY; y++) for (let x = 0; x < W; x++) {                                            // the wheel
    const dx = x + 0.5 - wc[0], dy = y + 0.5 - wc[1], d = Math.hypot(dx, dy)
    if (d > R) continue
    if (d >= R - 3) b.set(x, y, tone(P.tbL, (dx + dy < 0 ? 1.1 : 0.78) + 0.1 * hash(x, y, 120)))
    else if (d < 4) b.set(x, y, tone(P.tbD, 0.9))
    else { const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI / 4), fr = Math.min(a % 1, 1 - (a % 1)); if (fr * (Math.PI / 4) * d < 1.2 && !(Math.floor(a) === 5 && d > 9)) b.set(x, y, tone(P.tbM, 0.9 + 0.2 * hash(x, y, 121))) }   // a spoke gone
  }
  const poly = [[22, 15], [55, 10], [63, 17], [59, 30], [25, 33]]
  const inPoly = (x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c } return c }
  for (let y = 8; y < 36; y++) for (let x = 20; x < 66; x++) {                                          // the wicker body
    if (!inPoly(x + 0.5, y + 0.5)) continue
    const weave = ((x + (y >> 1)) >> 1) & 1
    b.set(x, y, tone(mix('#7d5a2c', '#b08c4e', weave ? 0.7 : 0.25), 0.85 + 0.25 * hash(x, y, 122)))
  }
  for (let x = 22; x < 63; x++) { const top = Math.round(15 - (x - 22) * 5 / 33 + (x > 55 ? (x - 55) * 0.9 : 0)); b.rect(x, top, 1, 2, '#4a301a') }   // the rim
  for (let t = 0; t < 22; t++) b.rect(59 + t * 0.85, 24 + t * 0.78, 3, 3, tone(P.tbM, 0.9 + 0.2 * hash(t, 1, 123)))      // the pole, to the ground
  b.rect(77, 41, 2, 2, '#d8bc8a'); b.rect(78, 44, 2, 1, '#d8bc8a')                                         // its snapped end
  for (let i = 0; i < 260; i++) {                                                                       // ivy and moss over everything
    const x = 8 + Math.floor(hash(i, 1, 124) * 66), y = 6 + Math.floor(Math.pow(hash(i, 2, 124), 0.8) * 46)
    const [r, g, bl, a] = b.get(x, y)
    if (a < 255 && hash(i, 3, 124) > 0.2) continue
    if (hash(i, 6, 124) > (y < 30 ? 0.75 : 0.45)) continue
    b.set(x, y, hash(i, 4, 124) < 0.5 ? '#4f7a36' : hash(i, 5, 124) < 0.5 ? '#6f9a46' : '#355a26')
  }
  for (let k = 0; k < 7; k++) { const x0 = 24 + k * 6 + Math.floor(hash(k, 1, 125) * 3), len = 6 + Math.floor(hash(k, 2, 125) * 12); for (let j = 0; j < len; j++) b.set(x0 + Math.round(Math.sin(j * 0.7 + k) * 1.5), 30 + j, hash(j, k, 126) < 0.7 ? '#4f7a36' : '#6f9a46') }   // vines trailing down
  for (let x = 4; x < 76; x++) if (hash(x, 7, 127) < 0.55) { const hh = 2 + Math.floor(hash(x, 8, 127) * 5); for (let j = 0; j < hh; j++) b.set(x, GY - j + 1, hash(x, j, 128) < 0.6 ? '#4a7a3a' : '#6f9a46') }       // grass
  for (let i = 0; i < 14; i++) { const x = 6 + Math.floor(hash(i, 1, 129) * 68), y = hash(i, 4, 129) < 0.5 ? GY - 4 - Math.floor(hash(i, 2, 129) * 4) : 12 + Math.floor(hash(i, 2, 129) * 30), c = ['#f0cf5a', '#f4efe6', '#b06ac0', '#e8788c'][Math.floor(hash(i, 3, 129) * 4)]; b.rect(x, y, 2, 2, c) }
  return b.canvas()
}

export function paintOutside(img) {
  const o = {}
  o.outHouse = paintHouse(false)
  o.outHouseFar = paintHouse(true)
  o.outChariot = paintChariot()
  if (img) {
    for (const [gid, key] of [[137, 'outDoor'], [138, 'outDoorOpen']]) {
      const c = document.createElement('canvas'); c.width = 48; c.height = 48
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.filter = 'saturate(75%) brightness(1.1)'
      if (gid === 138) {                                                            // open: the hearth-lit room beyond
        const g = x.createLinearGradient(0, 8, 0, 48); g.addColorStop(0, '#ffe3a0'); g.addColorStop(0.5, '#e8a04a'); g.addColorStop(1, '#8a4a1c')
        x.fillStyle = g; x.fillRect(9, 8, 30, 40)
      }
      tileAt(x, img, gid, 0, 0, 2)
      o[key] = c
    }
  }
  for (let v = 0; v < 3; v++) {
    const wf = new Buf(32, 32); rubble(wf, 32, 32, 3 + v * 5, 0.32)
    for (let x = 0; x < 32; x++) { const d = Math.floor(hash(x >> 1, v, 76) * 4); for (let y = 0; y < d; y++) wf.set(x, y, [0, 0, 0], 0) }       // a ragged top: stones standing proud
    o['outWallFront' + v] = wf.canvas()
    const ws = new Buf(32, 32); rubble(ws, 32, 32, 40 + v * 7, 0.28, 0.8)
    for (let x = 0; x < 32; x++) { const d = Math.floor(hash(x >> 1, v, 77) * 4); for (let y = 0; y < d; y++) ws.set(x, y, [0, 0, 0], 0) }
    o['outWallSide' + v] = ws.canvas()
    o['outWallTop' + v] = mossTop(32, 32, 60 + v * 9)
  }
  for (let v = 0; v < 4; v++) o['outBush' + v] = bush(100 + v * 7, v)
  const rk = new Buf(24, 24); rock(rk, 12, 12.5, 11.5, 10.5, 223, 0.55); o.outRock = rk.canvas()
  return o
}
