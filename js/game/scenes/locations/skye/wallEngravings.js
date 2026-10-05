// wallEngravings.js
// Location: js/game/scenes/locations/skye/wallEngravings.js
//
// Six words cut into the face of the harbour wall at the cladach, in Aonchlo,
// the old Irish letter. Three on the top riser, which anyone climbing from the
// jetty sees from the second terrace: what the warriors say they are. Three on
// the foot riser, which the sea covers until the training is done: what they
// stand on.
//
//     NEART (strength)   MISNEACH (courage)   FEARG (fury)       row 22, the top riser
//     CINEÁLTAS (kindness)  TRÓCAIRE (compassion)  FOIGHNE (patience)   row 26, the foot riser
//
// A PGR structure provider (see harbourWall.js for the pattern). Each word is
// baked once into a small canvas and laid along the face tile by tile with
// PGR's affine helper, so it follows the wall's perspective. It is drawn after
// the wall and the tide, so it sits on top of both.
//
// Reading them: stand below one (on the terrace or the quay) and a chisel
// appears over the moon, on a clear ground (the moon's phases still show, and
// swipes pass through). Tap and the word comes up as a caption (the scene does
// that: skyeCladach.js); the icon then goes until you step away.
//
// Keep the rows and columns clear of the stair gaps (skye_gen.mjs: GAPS) and,
// for the foot riser, of the jetty's columns (18-19).

// row  = the riser the word is cut into
// from = its first column; span = how many columns it runs across
export const WORDS = [
  // the top riser, left to right: Strength, Courage (by the stair), Fury
  { id: 'neart',     ga: 'Neart',     en: 'Strength',   on: 'upper', row: 22, from: 9,  span: 3 },
  { id: 'misneach',  ga: 'Misneach',  en: 'Courage',    on: 'upper', row: 22, from: 18, span: 4 },
  { id: 'fearg',     ga: 'Fearg',     en: 'Fury',       on: 'upper', row: 22, from: 25, span: 3 },
  // the foot riser (under the sea at high tide)
  { id: 'cinealtas', ga: 'Cineáltas', en: 'Kindness',   on: 'lower', row: 26, from: 3,  span: 4 },
  { id: 'trocaire',  ga: 'Trócaire',  en: 'Compassion', on: 'lower', row: 26, from: 9,  span: 4 },
  { id: 'foighne',   ga: 'Foighne',   en: 'Patience',   on: 'lower', row: 26, from: 22, span: 3 },
]

/** Is this wall tile cut with a word? (harbourWall.js keeps its ironwork off them.) */
export function isEngraved(col, row) {
  return WORDS.some(w => w.row === row && col >= w.from && col < w.from + w.span)
}

// ── baking ──────────────────────────────────────────────────────────────────
const PX = 80          // texture pixels per tile of wall, across
const TH = 60          // texture height: the band of the face the words fill
const SIZE = 50        // the letters, before fitting
// Where the band sits on the face (0 = its top edge, 1 = its foot). A riser is a 45-degree
// slope, a tile across and about 1.41 up it, so 0.52 of it is 0.74 of a tile: TH / PX, and
// the letters come out the shape they were drawn.
const V0 = 0.24, V1 = 0.76

// Opaque colours, so the two triangles that overlap along a tile's diagonal
// (PGR bleeds each one outward) don't stack into a visible stripe.
const CUT = '#17140f'
const LIP = '#9a958a'

function hash(x, y, s = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Aonchlo is loaded by the page's CSS; wait for it before baking, or the words come out in a fallback face. */
export async function fontReady() {
  try {
    await Promise.race([document.fonts.load(`${SIZE}px Aonchlo`), new Promise(r => setTimeout(r, 2000))])
  } catch (e) { /* bake with what there is */ }
}

// A word, cut: a dark groove with a pale lip on its lower right, and the odd
// chip of weather taken out of it.
export function bakeWord(w) {
  const W = w.span * PX
  const c = document.createElement('canvas')
  c.width = W; c.height = TH
  const ctx = c.getContext('2d')
  const face = s => `${s}px Aonchlo, serif`
  let size = SIZE
  ctx.font = face(size)
  let m = ctx.measureText(w.ga)
  const tall = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
  size *= Math.min(1, (W * 0.88) / m.width, (TH * 0.86) / tall)
  ctx.font = face(size)
  m = ctx.measureText(w.ga)
  const x = (W - m.width) / 2
  const y = (TH - (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent)) / 2 + m.actualBoundingBoxAscent

  // Aonchlo is a fine line: thicken it so it reads as a chiselled groove.
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(2, size * 0.075)
  const pass = (dx, dy, col) => {
    ctx.fillStyle = ctx.strokeStyle = col
    ctx.strokeText(w.ga, x + dx, y + dy)
    ctx.fillText(w.ga, x + dx, y + dy)
  }
  pass(1.5, 1.5, LIP)
  pass(0, 0, CUT)

  // weather: chips out of the cut, and out of the lip
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  const chips = Math.round(W * TH / 70)
  for (let i = 0; i < chips; i++) {
    ctx.fillRect(Math.floor(hash(i, W, 1) * W), Math.floor(hash(i, TH, 2) * TH), 1 + (hash(i, 3, 3) > 0.75 ? 1 : 0), 1)
  }
  return c
}

// (ctx.roundRect is missing from older phones' browsers)
function rrect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// The moon's icon for an engraving: a mason's chisel, edge down and to the
// left, with chips flying off the stone. One for all six words.
export function bakeChisel() {
  const S = 96
  const c = document.createElement('canvas')
  c.width = S; c.height = S
  const ctx = c.getContext('2d')
  const STEEL = '#bcc4cc', EDGE = '#8a929b', PALE = '#d9d0b6', MID = '#8f8a80', DARK = '#15120e', HAFT = '#b59a6a'

  const body = (grow, fill) => {
    ctx.fillStyle = fill; ctx.strokeStyle = fill
    ctx.lineWidth = grow * 2; ctx.lineJoin = 'round'
    ctx.beginPath(); rrect(ctx, -9 - grow, -46 - grow, 18 + grow * 2, 34 + grow * 2, 5); ctx.fill()              // the haft
    ctx.beginPath(); ctx.rect(-8 - grow, -12 - grow, 16 + grow * 2, 6 + grow * 2); ctx.fill()                     // the collar
    ctx.beginPath()
    ctx.moveTo(-6 - grow, -6); ctx.lineTo(6 + grow, -6); ctx.lineTo(9 + grow, 26); ctx.lineTo(-9 - grow, 26)      // the blade, flaring
    ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(-9 - grow, 26); ctx.lineTo(9 + grow, 26); ctx.lineTo(9 + grow, 35 + grow); ctx.lineTo(-9 - grow, 31 + grow)
    ctx.closePath(); ctx.fill()                                                                                   // the bevelled edge
    if (grow) ctx.stroke()
  }

  ctx.save()
  ctx.translate(54, 38); ctx.rotate(Math.PI / 5)
  body(2.5, DARK)                                  // outline
  body(0, STEEL)
  ctx.fillStyle = HAFT; ctx.beginPath(); rrect(ctx, -9, -46, 18, 34, 5); ctx.fill()
  ctx.fillStyle = PALE; ctx.fillRect(-5, -42, 3, 26)                              // light along the haft
  ctx.fillStyle = MID; ctx.fillRect(-8, -12, 16, 6)
  ctx.fillStyle = EDGE
  ctx.beginPath(); ctx.moveTo(-9, 26); ctx.lineTo(9, 26); ctx.lineTo(9, 35); ctx.lineTo(-9, 31); ctx.closePath(); ctx.fill()
  ctx.restore()

  // chips flying from the point (it lands at about 33, 69), and the groove it has cut
  ctx.lineCap = 'round'
  const stroke = (pts, col, w) => {
    ctx.strokeStyle = col; ctx.lineWidth = w
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3]); ctx.stroke()
  }
  for (const p of [[26, 64, 14, 56], [24, 72, 10, 72], [28, 79, 18, 90]]) { stroke(p, DARK, 5); stroke(p, PALE, 2.5) }
  stroke([8, 86, 40, 86], DARK, 6); stroke([8, 86, 40, 86], MID, 3)
  return c
}

// ── the provider ────────────────────────────────────────────────────────────
export default class WallEngravings {
  /**
   * @param wall  the HarbourWall: it knows the face's projected quads
   */
  constructor(scene, wall) {
    this.scene = scene
    this.wall = wall
    this.tex = {}
    this.byRow = new Map()
    const chisel = bakeChisel()
    this.icon = {}
    for (const w of WORDS) {
      this.tex[w.id] = bakeWord(w)
      this.icon[w.id] = chisel
      if (!this.byRow.has(w.row)) this.byRow.set(w.row, [])
      this.byRow.get(w.row).push(w)
    }
  }

  /** At high tide the foot of the wall (and so the lower words) is under the sea. */
  isShown(w) { return w.on === 'upper' || this.scene.mapData?.tide?.state !== 'high' }

  /**
   * How far a point (in tiles) is from the word, or Infinity. The words face
   * south, so they can only be read from below them.
   */
  distance(w, px, py) {
    if (py < w.row + 1) return Infinity
    const dx = Math.max(w.from - px, 0, px - (w.from + w.span))
    return Math.hypot(dx, py - (w.row + 0.5))
  }

  getEntriesForRow(row) {
    const ws = this.byRow.get(row)
    if (!ws) return []
    return [{ draw: (ctx, pgr) => { for (const w of ws) if (this.isShown(w)) this._engrave(ctx, pgr, w) } }]
  }

  // The word, slice by slice along the face, each slice on its tile's projected quad.
  _engrave(ctx, pgr, w) {
    const s = pgr._scaleAtRow(w.row + 1)
    if (s == null || s < 3) return
    const img = this.tex[w.id], H = img.height, slice = img.width / w.span
    for (let i = 0; i < w.span; i++) {
      const q = this.wall._quad(pgr, w.from + i, w.row)
      if (!q) continue
      const a = this.wall._at(q, 0, V0), b = this.wall._at(q, 1, V0)
      const c = this.wall._at(q, 1, V1), d = this.wall._at(q, 0, V1)
      const u0 = i * slice, u1 = u0 + slice
      pgr._drawAffineTriangle(ctx, img, { u: u0, v: 0 }, { u: u1, v: 0 }, { u: u1, v: H }, a, b, c)
      pgr._drawAffineTriangle(ctx, img, { u: u0, v: 0 }, { u: u1, v: H }, { u: u0, v: H }, a, c, d)
    }
  }
}
