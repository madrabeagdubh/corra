// shoreProps.js
// Location: js/game/scenes/locations/skye/shoreProps.js
//
// The jetty and the moored boat on Skye's shore, drawn through PGR's
// per-row structure hook (pgr.setStructures) so they interleave with
// everything else by row: the deck covers the water behind it, the boat
// at the jetty head sits in front of the deck's far end, and the player
// (on PGR's always-on-top player canvas) walks over the planks.
//
// mapData.jetty = { x0, x1, y0, y1, deckH }   tiles; deckH in height units
// mapData.boat  = { x, y, width }             tile coords (fractional ok),
//                                             width in tiles
//
// The jetty's tiles are walkable grass in layer 0 (the deck hides them),
// with heightMap vertices at deckH so the player stands ON the planks.

const PLANK  = '#6e5237'
const PLANK2 = '#5c4430'
const SEAM   = '#3d2c1e'
const POST   = '#2e2117'

export default class ShoreProps {
  constructor(scene, { jetty, boat, boatKey = 'boat' }) {
    this.scene = scene
    this.jetty = jetty || null
    this.boat  = boat  || null
    this.boatKey = boatKey
    this._t0 = performance.now()
  }

  getEntriesForRow(row) {
    const out = []
    const j = this.jetty
    if (j && row >= j.y0 && row <= j.y1) out.push({ draw: (ctx, pgr) => this._drawJettyRow(ctx, pgr, row) })
    if (this.boat && row === Math.floor(this.boat.y)) out.push({ draw: (ctx, pgr) => this._drawBoat(ctx, pgr) })
    return out
  }

  // One tile-row of deck: posts down to the water at the row's south
  // edge, then the planks on top, then a dark fascia along the front.
  _drawJettyRow(ctx, pgr, row) {
    const j = this.jetty
    const deckH = j.deckH
    const yAt  = (r) => pgr._rowToScreenY(r)
    const lift = (r) => j.deckH * pgr._scaleAtRow(r)
    const yT = yAt(row), yB = yAt(row + 1)
    if (yT == null || yB == null) return
    const L = (r) => pgr._colToScreenX(j.x0, r)
    const R = (r) => pgr._colToScreenX(j.x1 + 1, r)
    const s = pgr._scaleAtRow(row + 1)

    // posts: at both edges of the row's south boundary, standing in the sea
    // (j.seaH: its level, which rises with the tide) and a little below it
    const sea = (j.seaH || 0)
    const post = (deckH - sea) * s + s * 0.3
    ctx.fillStyle = POST
    const pw = Math.max(2, s * 0.09)
    for (const x of [L(row + 1) + pw * 0.3, R(row + 1) - pw * 1.3]) {
      ctx.fillRect(x, yB - lift(row + 1), pw, post)
    }

    // deck
    const tl = [L(row), yT - lift(row)], tr = [R(row), yT - lift(row)]
    const br = [R(row + 1), yB - lift(row + 1)], bl = [L(row + 1), yB - lift(row + 1)]
    ctx.fillStyle = (row % 2) ? PLANK : PLANK2
    ctx.beginPath()
    ctx.moveTo(...tl); ctx.lineTo(...tr); ctx.lineTo(...br); ctx.lineTo(...bl)
    ctx.closePath(); ctx.fill()

    // plank seams across the jetty, three planks per tile
    ctx.strokeStyle = SEAM
    ctx.lineWidth = Math.max(1, s * 0.02)
    ctx.beginPath()
    for (const f of [1 / 3, 2 / 3, 1]) {
      const r = row + f
      const y = yAt(r) - lift(r)
      ctx.moveTo(L(r), y); ctx.lineTo(R(r), y)
    }
    ctx.stroke()

    // fascia: the deck's thickness, seen from the front, on the last row
    if (row === j.y1) {
      ctx.fillStyle = POST
      ctx.fillRect(bl[0], bl[1], br[0] - bl[0], Math.max(2, s * 0.07))
      // and, below it, the piled front of the head, down into the water
      const face = (deckH - sea) * s + s * 0.3
      ctx.fillStyle = PLANK2
      ctx.fillRect(bl[0], bl[1] + Math.max(2, s * 0.07), br[0] - bl[0], face)
      ctx.fillStyle = 'rgba(20,14,9,0.45)'
      for (let k = 1; k < 4; k++) ctx.fillRect(bl[0] + (br[0] - bl[0]) * k / 4, bl[1], Math.max(1, s * 0.02), face)
    }
  }

  // The boat, side-on across the jetty head, bobbing.
  _drawBoat(ctx, pgr) {
    const b = this.boat
    const tex = this.scene.textures?.get(this.boatKey)
    const img = tex?.getSourceImage?.()
    if (!img || !img.width) return
    const y0 = pgr._rowToScreenY(b.y)
    if (y0 == null) return
    const s = pgr._scaleAtRow(b.y)
    const t = (performance.now() - this._t0) / 1000
    const w = b.width * s
    const h = w * img.height / img.width
    const x = pgr._colToScreenX(b.x, b.y)
    const bob = Math.sin(t * 1.3) * s * 0.035
    ctx.save()
    ctx.translate(x, y0 + bob - (b.lift || 0) * pgr._scaleAtRow(b.y))   // rides the tide
    ctx.rotate(Math.sin(t * 0.9 + 1) * 0.025)
    ctx.imageSmoothingEnabled = false
    // sits IN the water: a third of the hull below the line
    ctx.drawImage(img, -w / 2, -h * 0.72, w, h)
    ctx.restore()
  }
}
