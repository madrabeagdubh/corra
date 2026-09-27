// lochStones.js
// Location: js/game/scenes/locations/skye/lochStones.js
//
// Stepping stones on the loch: flat, rounded, wet-rimmed, each with a faint
// ring on the water. Everything here is flat on purpose -- things that
// stick up (posts, gorse) are hard to read in this camera; stones in water
// read at a glance.
//
// A PGR structure provider (pgr.setStructures), drawn on the ground
// canvas after each row, so nearer rows paint over farther ones.
// mapData.stones = [[x, y], ...] or [[x, y, colour], ...]
//   colour: 'ban' | 'dubh' | 'dearg' | 'glas' | 'lar' (the ráth's inlay)
// opts.water = false  -- no ring on the water (stones set in grass)
// opts.isLit(x, y)    -- true: a warm lit stone (a kata's walked path)
// opts.isEcho(x, y)   -- true: a faint lingering glow (a figure that stays)
// opts.colourAt(x, y) -- a colour to override everything (or null)

function hash(x, y, s = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const TOPS = ['#7d786f', '#8a857b', '#726d65']
// The ráth's night board: slate blue-greys, the sun wheel only in value and
// the faintest hue, so lit stars read like stars on a night floor. (The
// colour NAMES stay, for place calls: dearg is still the reddish one.)
const INLAY = { ban: '#5c6270', dubh: '#2c313b', dearg: '#574349', glas: '#434f55', lar: '#8a8e98' }

export default class LochStones {
  constructor(scene, stones, opts = {}) {
    this.water = opts.water !== false
    this.isLit = opts.isLit || null
    this.isEcho = opts.isEcho || null
    this.colourAt = opts.colourAt || null
    this.byRow = new Map()
    this.colour = new Map()
    for (const [x, y, c] of stones || []) {
      if (!this.byRow.has(y)) this.byRow.set(y, [])
      this.byRow.get(y).push(x)
      if (c) this.colour.set(`${x},${y}`, INLAY[c])
    }
  }

  getEntriesForRow(row) {
    const cols = this.byRow.get(row)
    if (!cols) return []
    return [{ draw: (ctx, pgr) => { for (const c of cols) this._stone(ctx, pgr, c, row) } }]
  }

  _stone(ctx, pgr, col, row) {
    const yT = pgr._rowToScreenY(row), yB = pgr._rowToScreenY(row + 1)
    if (yT == null || yB == null) return
    const sT = pgr._scaleAtRow(row), sB = pgr._scaleAtRow(row + 1)
    if (sB < 2) return
    const lift = (c, r, s) => pgr._vertexH(c, r) * s
    const tl = { x: pgr._colToScreenX(col, row),         y: yT - lift(col, row, sT) }
    const tr = { x: pgr._colToScreenX(col + 1, row),     y: yT - lift(col + 1, row, sT) }
    const bl = { x: pgr._colToScreenX(col, row + 1),     y: yB - lift(col, row + 1, sB) }
    const br = { x: pgr._colToScreenX(col + 1, row + 1), y: yB - lift(col + 1, row + 1, sB) }
    const cx = (tl.x + tr.x + bl.x + br.x) / 4
    const cy = (tl.y + tr.y + bl.y + br.y) / 4 + (bl.y - tl.y) * 0.05
    const rx = ((tr.x - tl.x) + (br.x - bl.x)) / 2 * 0.43
    const ry = (bl.y - tl.y) * 0.4
    const thick = Math.max(1.5, ry * 0.35)

    // ring on the water
    if (this.water) {
    ctx.strokeStyle = 'rgba(220,235,242,0.22)'
    ctx.lineWidth = Math.max(1, sB * 0.02)
    ctx.beginPath(); ctx.ellipse(cx, cy + thick * 0.8, rx * 1.25, ry * 1.25, 0, 0, Math.PI * 2); ctx.stroke()
    }

    // irregular outline, shared by the wet side and the dry top
    const pts = []
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const k = 0.82 + hash(col, row, i) * 0.22
      pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k])
    }
    const path = (dy) => {
      ctx.beginPath()
      pts.forEach(([x, y], i) => i ? ctx.lineTo(cx + x, cy + y + dy) : ctx.moveTo(cx + x, cy + y + dy))
      ctx.closePath()
    }
    ctx.fillStyle = '#34322e'; path(thick); ctx.fill()                  // wet side
    const lit = this.isLit?.(col, row)
    ctx.fillStyle = this.colourAt?.(col, row)
      || (lit ? '#f0d27a'
        : this.isEcho?.(col, row) ? '#b3a978'
        : (this.colour.get(`${col},${row}`) || TOPS[Math.floor(hash(col, row, 20) * TOPS.length)]))
    path(0); ctx.fill()                                                // top
    ctx.fillStyle = 'rgba(255,255,255,0.12)'                           // dry highlight
    ctx.beginPath(); ctx.ellipse(cx - rx * 0.2, cy - ry * 0.25, rx * 0.45, ry * 0.3, 0, 0, Math.PI * 2); ctx.fill()
    if (hash(col, row, 30) < 0.4) {                                    // a crust of lichen
      ctx.fillStyle = 'rgba(160,168,96,0.5)'
      ctx.beginPath(); ctx.ellipse(cx + rx * 0.3, cy + ry * 0.1, rx * 0.18, ry * 0.14, 0, 0, Math.PI * 2); ctx.fill()
    }
  }
}
