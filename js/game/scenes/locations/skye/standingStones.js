// standingStones.js
// Location: js/game/scenes/locations/skye/standingStones.js
//
// Weathered standing stones: tall, slightly leaning, lichen-flecked slabs
// that have stood through a few thousand winters. A PGR structure provider
// (combine with others via combineStructures in harbourWall.js), drawn on
// the ground canvas in row order, standing on the terrain.
//
//   new StandingStones(scene, [[x, y], ...])

function hash(x, y, s = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export default class StandingStones {
  constructor(scene, stones) {
    this.byRow = new Map()
    for (const [x, y] of stones || []) {
      if (!this.byRow.has(y)) this.byRow.set(y, [])
      this.byRow.get(y).push(x)
    }
  }

  getEntriesForRow(row) {
    const cols = this.byRow.get(row)
    return cols ? [{ draw: (ctx, pgr) => cols.forEach(c => this._stone(ctx, pgr, c, row)) }] : []
  }

  _stone(ctx, pgr, col, row) {
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
  }
}
