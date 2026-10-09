// standingStones.js
// Location: js/game/scenes/locations/skye/standingStones.js
//
// Weathered standing stones: tall, slightly leaning, lichen-flecked slabs
// that have stood through a few thousand winters. A PGR structure provider
// (combine with others via combineStructures in harbourWall.js), drawn on
// the ground canvas in row order, standing on the terrain.
//
//   new StandingStones(scene, [[x, y, style], ...])
//
// style (optional): 0 the garden's weathered slab; 1 the same, furred with moss; 2 a shattered
// stone -- a broken stump with its pieces lying round it, moss and ivy over all (the loch island's).

function hash(x, y, s = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export default class StandingStones {
  constructor(scene, stones) {
    this.byRow = new Map()
    for (const [x, y, style] of stones || []) {
      if (!this.byRow.has(y)) this.byRow.set(y, [])
      this.byRow.get(y).push([x, style | 0])
    }
  }

  getEntriesForRow(row) {
    const cols = this.byRow.get(row)
    return cols ? [{ draw: (ctx, pgr) => cols.forEach(([c, st]) => st === 2 ? this._ruin(ctx, pgr, c, row) : this._stone(ctx, pgr, c, row, st)) }] : []
  }

  _stone(ctx, pgr, col, row, style = 0) {
    const y0 = pgr._rowToScreenY(row + 0.6)
    if (y0 == null) return
    const s = pgr._scaleAtRow(row + 0.6)
    if (s < 3) return
    const lift = pgr._tileHeightAt(col, row) * s
    const x = pgr._colToScreenX(col + 0.5, row + 0.6)
    const foot = y0 - lift
    const w = s * (0.34 + hash(col, row) * 0.12)
    const h = s * (1.25 + hash(col, row, 1) * 0.5)
    const lean = (hash(col, row, 2) - 0.5) * w * 0.5
    const top = w * (0.55 + hash(col, row, 3) * 0.3)
    // shadow on the grass
    ctx.fillStyle = 'rgba(10,14,10,0.28)'
    ctx.beginPath(); ctx.ellipse(x + w * 0.35, foot, w * 0.9, w * 0.22, 0, 0, Math.PI * 2); ctx.fill()
    // the slab: a tapering, leaning quad with a rounded crown
    const path = () => {
      ctx.beginPath()
      ctx.moveTo(x - w / 2, foot)
      ctx.lineTo(x - top / 2 + lean, foot - h)
      ctx.quadraticCurveTo(x + lean, foot - h - w * 0.25, x + top / 2 + lean, foot - h)
      ctx.lineTo(x + w / 2, foot)
      ctx.closePath()
    }
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
    g.addColorStop(0, '#8a877f'); g.addColorStop(0.55, '#6d6a64'); g.addColorStop(1, '#4e4c48')
    ctx.fillStyle = g; path(); ctx.fill()
    // weather: lichen and a crack
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = hash(col, row, 10 + i) < 0.5 ? 'rgba(176,184,110,0.55)' : 'rgba(210,205,170,0.45)'
      const ly = foot - h * (0.15 + hash(col, row, 20 + i) * 0.75)
      const lx = x + lean * ((foot - ly) / h) + (hash(col, row, 30 + i) - 0.5) * w * 0.6
      ctx.beginPath(); ctx.ellipse(lx, ly, w * 0.1, w * 0.07, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.strokeStyle = 'rgba(40,38,34,0.7)'; ctx.lineWidth = Math.max(1, s * 0.012)
    ctx.beginPath(); ctx.moveTo(x + lean * 0.8, foot - h * 0.85)
    ctx.lineTo(x + lean * 0.6 + w * 0.05, foot - h * 0.55); ctx.lineTo(x + lean * 0.4 - w * 0.04, foot - h * 0.35); ctx.stroke()
    if (style === 1) this._moss(ctx, x, foot, w, h, col, row, 0.55)
  }

  // moss furring a slab from the foot up to `reach` of its height, and a cap of it on the crown
  _moss(ctx, x, foot, w, h, col, row, reach) {
    for (let i = 0; i < 9; i++) {
      const f = hash(col, row, 60 + i) * reach
      const mx = x + (hash(col, row, 70 + i) - 0.5) * w * 0.8
      ctx.fillStyle = hash(col, row, 80 + i) < 0.5 ? 'rgba(78,104,50,0.8)' : 'rgba(104,126,60,0.72)'
      ctx.beginPath(); ctx.ellipse(mx, foot - h * f, w * (0.14 + hash(col, row, 90 + i) * 0.14), h * 0.07, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = 'rgba(70,96,46,0.85)'
    ctx.beginPath(); ctx.ellipse(x, foot - h * 0.02, w * 0.62, h * 0.07, 0, 0, Math.PI * 2); ctx.fill()
  }

  // A shattered stone: a stump with a jagged top, two fallen pieces, moss and ivy over everything.
  _ruin(ctx, pgr, col, row) {
    const y0 = pgr._rowToScreenY(row + 0.6)
    if (y0 == null) return
    const s = pgr._scaleAtRow(row + 0.6)
    if (s < 3) return
    const x = pgr._colToScreenX(col + 0.5, row + 0.6)
    const foot = y0 - pgr._tileHeightAt(col, row) * s
    const w = s * 0.5, h = s * (0.62 + hash(col, row, 1) * 0.12)
    const H = (i) => hash(col, row, 100 + i)
    // shadow
    ctx.fillStyle = 'rgba(10,14,10,0.3)'
    ctx.beginPath(); ctx.ellipse(x + w * 0.2, foot, w * 1.5, w * 0.3, 0, 0, Math.PI * 2); ctx.fill()
    // fallen pieces, behind and in front: low slabs lying at a slant
    const piece = (px, pw, ph, tilt, k) => {
      const g = ctx.createLinearGradient(px, foot - ph, px, foot)
      g.addColorStop(0, '#84817a'); g.addColorStop(1, '#4e4c48')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(px - pw / 2, foot)
      ctx.lineTo(px - pw / 2 + tilt, foot - ph)
      ctx.lineTo(px + pw * (0.1 + H(k) * 0.2), foot - ph * (1 + H(k + 1) * 0.25))
      ctx.lineTo(px + pw / 2, foot - ph * 0.4)
      ctx.lineTo(px + pw / 2, foot)
      ctx.closePath(); ctx.fill()
      this._moss(ctx, px, foot, pw, ph, col + k, row, 0.9)
    }
    piece(x - w * 1.25, w * 1.1, h * 0.34, w * 0.1, 1)
    piece(x + w * 1.0, w * 0.8, h * 0.26, -w * 0.08, 5)
    // the stump: a slab with a jagged, broken top
    const top = [-0.5, -0.46, -0.3, -0.18, 0.02, 0.2, 0.36, 0.5]
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
    g.addColorStop(0, '#8a877f'); g.addColorStop(0.55, '#6d6a64'); g.addColorStop(1, '#4e4c48')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.moveTo(x - w * 0.5, foot)
    top.forEach((tx, i) => ctx.lineTo(x + tx * w, foot - h * (0.7 + H(10 + i) * 0.3) * (i === 0 || i === top.length - 1 ? 0.6 : 1)))
    ctx.lineTo(x + w * 0.5, foot); ctx.closePath(); ctx.fill()
    // the break: a pale scar across the top
    ctx.strokeStyle = 'rgba(214,208,190,0.4)'; ctx.lineWidth = Math.max(1, s * 0.015)
    ctx.beginPath(); ctx.moveTo(x - w * 0.3, foot - h * 0.86); ctx.lineTo(x - w * 0.05, foot - h * 0.97); ctx.lineTo(x + w * 0.22, foot - h * 0.84); ctx.stroke()
    this._moss(ctx, x, foot, w, h, col, row, 0.8)
    // ivy: a few dark runners up the stump, with leaves
    for (let i = 0; i < 3; i++) {
      const ix = x + (H(30 + i) - 0.5) * w * 0.8
      ctx.strokeStyle = 'rgba(40,66,34,0.9)'; ctx.lineWidth = Math.max(1, s * 0.02)
      ctx.beginPath(); ctx.moveTo(ix, foot)
      ctx.quadraticCurveTo(ix + w * (H(40 + i) - 0.5) * 0.5, foot - h * 0.4, ix + w * (H(50 + i) - 0.5) * 0.3, foot - h * (0.6 + H(60 + i) * 0.3)); ctx.stroke()
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k % 2 ? 'rgba(52,92,44,0.95)' : 'rgba(76,118,52,0.95)'
        ctx.beginPath(); ctx.ellipse(ix + (H(70 + i * 5 + k) - 0.5) * w * 0.35, foot - h * (0.1 + k * 0.17), w * 0.07, w * 0.045, H(80 + k) * 3, 0, Math.PI * 2); ctx.fill()
      }
    }
  }
}
