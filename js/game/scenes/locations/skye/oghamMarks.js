// oghamMarks.js
// Location: js/game/scenes/locations/skye/oghamMarks.js
//
// Six rough-hewn standing stones at the cladach (the garden's kind), each carved with one word in ogham. The upper three stand on the second terrace, where anyone who
// has climbed from the jetty will see them: what the warriors say they are.
// The lower three stand on the quay, which the sea covers until the training
// is done: what they stand on.
//
//     NEART (strength)   MISNEACH (courage)   FEARG (fury)       the terrace; courage
//                        raised, behind the stair, the others flank it
//     CINEÁLTAS (kindness)  TRÓCAIRE (compassion)  FOIGHNE (patience)   the quay, under them
//
// Ogham is cut up the edge of a stone and read from the bottom, so the
// letters here start at the foot and climb: a stem up the face, strokes to
// the right of it, to the left, across it, or notches on it.
//
// A PGR structure provider (see harbourWall.js for the pattern). Each word is
// baked once into a small pixel canvas and mapped onto the stone's face with
// PGR's affine helper, so it foreshortens with the ground.
//
// Reading them: walk up to one and its ogham appears over the moon, on a clear
// ground (the moon's phases still show, and swipes pass through). Tap and the
// word comes up as a caption (the scene does that: skyeCladach.js); the icon
// then goes until you step away.

// at = the tile the stone stands on. Keep in sync with skye_gen.mjs (OGHAM_STONES).
export const WORDS = [
  // the terrace, left to right: Strength, Fury ... and Courage, raised and further back
  { id: 'neart',     text: 'neart',     ga: 'Neart',     en: 'Strength',   on: 'upper', at: [11, 23] },
  { id: 'misneach',  text: 'misneach',  ga: 'Misneach',  en: 'Courage',    on: 'upper', at: [19, 17] },
  { id: 'fearg',     text: 'fearg',     ga: 'Fearg',     en: 'Fury',       on: 'upper', at: [25, 23] },
  // the quay (under the sea at high tide), each below its pair
  { id: 'cinealtas', text: 'cinealtas', ga: 'Cineáltas', en: 'Kindness',   on: 'lower', at: [11, 27] },
  { id: 'trocaire',  text: 'trocaire',  ga: 'Trócaire',  en: 'Compassion', on: 'lower', at: [14, 27] },
  { id: 'foighne',   text: 'foighne',   ga: 'Foighne',   en: 'Patience',   on: 'lower', at: [25, 27] },
]

// ── the script ──────────────────────────────────────────────────────────────
// Groups of five along a stem: strokes below, strokes above, strokes
// crossing, notches on it. Each letter is [group, count].
const LETTER = {}
;[['B', 'blfsn'], ['H', 'hdtcq'], ['M', 'mg?zr'], ['A', 'aouei']].forEach(([g, s]) =>
  [...s].forEach((ch, i) => { LETTER[ch] = [g, i + 1] }))

const CELL = 22, HGT = 56, STEM = HGT / 2, STEP = 4
const CELLS = 9                       // every stone is the same height: room for the longest word

// Bake a word along a horizontal stem (start at the left), cut dark then worn pale.
function bakeHorizontal(text, cells = CELLS) {
  const c = document.createElement('canvas')
  c.width = cells * CELL + CELL; c.height = HGT
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.lineCap = 'butt'
  const marks = [[2, STEM, c.width - 2, STEM, 3]]                       // the stem
  ;[...text].forEach((ch, i) => {
    const L = LETTER[ch]; if (!L) return
    const [g, k] = L, cx = CELL / 2 + i * CELL + CELL / 2
    const x0 = cx - ((k - 1) * STEP) / 2
    for (let j = 0; j < k; j++) {
      const x = Math.round(x0 + j * STEP)
      if (g === 'B') marks.push([x, STEM, x, STEM + 22, 2])
      if (g === 'H') marks.push([x, STEM - 22, x, STEM, 2])
      if (g === 'M') marks.push([x - 5, STEM + 20, x + 5, STEM - 20, 2])
      if (g === 'A') marks.push([x, STEM - 9, x, STEM + 9, 3])
    }
  })
  const pass = (grow, col) => {
    ctx.strokeStyle = col
    for (const [x0, y0, x1, y1, w] of marks) {
      ctx.lineWidth = w + grow
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
    }
  }
  pass(1, '#15120e')
  pass(0, '#cfc7b0')
  return c
}

// ...then stand it up: the start at the foot, strokes below the stem to the right.
function bakeWord(text, cells = CELLS) {
  const h = bakeHorizontal(text, cells)
  const c = document.createElement('canvas')
  c.width = h.height; c.height = h.width
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.translate(0, c.height); ctx.rotate(-Math.PI / 2)
  ctx.drawImage(h, 0, 0)
  return c
}

function hash(x, y, s = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export default class OghamMarks {
  constructor(scene) {
    this.scene = scene
    this.tex = {}
    this.icon = {}
    this.byRow = new Map()
    for (const w of WORDS) {
      this.tex[w.id] = bakeWord(w.text)
      this.icon[w.id] = bakeWord(w.text.slice(0, 3), 3)        // the first letters, for the moon (it is small)
      const r = w.at[1]
      if (!this.byRow.has(r)) this.byRow.set(r, [])
      this.byRow.get(r).push(w)
    }
  }

  /** At high tide the quay (and so the lower stones) is under the sea. */
  isShown(w) { return w.on === 'upper' || this.scene.mapData?.tide?.state !== 'high' }

  getEntriesForRow(row) {
    const ws = this.byRow.get(row)
    if (!ws) return []
    return [{ draw: (ctx, pgr) => { for (const w of ws) if (this.isShown(w)) this._stone(ctx, pgr, w) } }]
  }

  // A rough-hewn standing stone, like the garden's (standingStones.js): a tall,
  // tapering, slightly leaning slab with a rounded crown, lichen and a crack.
  // The word is cut up its face from the foot.
  _stone(ctx, pgr, w) {
    const [col, row] = w.at
    const y0 = pgr._rowToScreenY(row + 0.6)
    if (y0 == null) return
    const s = pgr._scaleAtRow(row + 0.6)
    if (s < 3) return
    const foot = y0 - pgr._tileHeightAt(col, row) * s
    const x = pgr._colToScreenX(col + 0.5, row + 0.6)
    const lerp = (a, b, t) => a + (b - a) * t
    const wd = s * (0.74 + hash(col, row) * 0.08)
    const h = s * (2.5 + hash(col, row, 1) * 0.2)
    const lean = (hash(col, row, 2) - 0.5) * wd * 0.35
    const top = wd * (0.7 + hash(col, row, 3) * 0.12)
    // the two edges, foot to crown (the crown's rim is where they end)
    const L = t => ({ x: lerp(x - wd / 2, x - top / 2 + lean, t), y: foot - h * t })
    const R = t => ({ x: lerp(x + wd / 2, x + top / 2 + lean, t), y: foot - h * t })

    ctx.save()
    // shadow on the ground
    ctx.fillStyle = 'rgba(10,14,10,0.30)'
    ctx.beginPath(); ctx.ellipse(x + wd * 0.35, foot, wd * 0.9, wd * 0.2, 0, 0, Math.PI * 2); ctx.fill()
    // the slab
    const path = () => {
      ctx.beginPath()
      ctx.moveTo(x - wd / 2, foot)
      ctx.lineTo(x - top / 2 + lean, foot - h)
      ctx.quadraticCurveTo(x + lean, foot - h - wd * 0.28, x + top / 2 + lean, foot - h)
      ctx.lineTo(x + wd / 2, foot)
      ctx.closePath()
    }
    const g = ctx.createLinearGradient(x - wd / 2, 0, x + wd / 2, 0)
    g.addColorStop(0, '#8a877f'); g.addColorStop(0.55, '#6d6a64'); g.addColorStop(1, '#4e4c48')
    ctx.fillStyle = g; path(); ctx.fill()
    // the ogham, cut up the face: a quad inside the slab, mapped with PGR's affine helper
    const lo = 0.04, hi = 0.9, ul = 0.14, ur = 0.86
    const at = (u, v) => { const l = L(v), r = R(v); return { x: lerp(l.x, r.x, u), y: lerp(l.y, r.y, u) } }
    const a = at(ul, lo), b = at(ur, lo), c = at(ur, hi), d = at(ul, hi)
    const img = this.tex[w.id], W = img.width, H = img.height
    ctx.save(); path(); ctx.clip()
    ctx.globalAlpha = 0.97
    pgr._drawAffineTriangle(ctx, img, { u: 0, v: H }, { u: W, v: H }, { u: W, v: 0 }, a, b, c)
    pgr._drawAffineTriangle(ctx, img, { u: 0, v: H }, { u: W, v: 0 }, { u: 0, v: 0 }, a, c, d)
    ctx.restore()
    // weather: lichen and a crack
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = hash(col, row, 10 + i) < 0.5 ? 'rgba(176,184,110,0.5)' : 'rgba(210,205,170,0.4)'
      const t = 0.06 + hash(col, row, 20 + i) * 0.8
      const l = L(t), r = R(t)
      ctx.beginPath(); ctx.ellipse(lerp(l.x, r.x, hash(col, row, 30 + i)), l.y, wd * 0.09, wd * 0.06, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.strokeStyle = 'rgba(40,38,34,0.6)'; ctx.lineWidth = Math.max(1, s * 0.012)
    ctx.beginPath(); ctx.moveTo(x + lean * 0.9, foot - h * 0.97)
    ctx.lineTo(x + lean * 0.7 + wd * 0.05, foot - h * 0.8); ctx.lineTo(x + lean * 0.6 - wd * 0.03, foot - h * 0.72); ctx.stroke()
    ctx.restore()
  }
}
