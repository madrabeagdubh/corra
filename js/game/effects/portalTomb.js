// portalTomb.js -- a small portal tomb: two crooked uprights, a tilted lintel across them, and a crooked
// black doorway between, not much bigger than a person. A PGR structure provider (pgr.setStructures),
// drawn on the ground canvas in its own row's pass, so trees and ground in nearer rows paint over it.
//
//   new PortalTomb(scene, { x: 28, y: 10 })      x, y: the doorway tile (the way in)

function hash(x, y, s = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const STONE = ['#8a877f', '#6d6a64', '#4e4c48']

export default class PortalTomb {
  constructor(scene, { x, y }) {
    this.scene = scene
    this.x = x; this.y = y
  }

  // the flat stones laid on the way up: [column offset from the doorway, row offset (tiles, downhill), width]
  static STEPS = [[-0.45, 1.75, 1.15], [0.35, 3.3, 0.95]]

  getEntriesForRow(row) {
    const out = []
    if (row === this.y) out.push({ draw: (ctx, pgr) => this._draw(ctx, pgr) })
    PortalTomb.STEPS.forEach(([du, dr, w], i) => {
      if (Math.floor(this.y + dr) === row) out.push({ draw: (ctx, pgr) => this._flat(ctx, pgr, du, this.y + dr, w, i) })
    })
    return out
  }

  // a rough flat slab lying on the ground, green with moss
  _flat(ctx, pgr, du, rf, w, k) {
    const s = pgr._scaleAtRow(rf), y0 = pgr._rowToScreenY(rf)
    if (y0 == null || !(s > 3)) return
    const col = this.x + 0.5 + du
    const cx = pgr._colToScreenX(col, rf), cy = y0 - pgr._tileHeightAt(Math.floor(col), Math.floor(rf)) * s
    const d = 0.2 * s, hw = w * 0.5 * s
    const ring = []
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, j = 0.8 + hash(k + 300, i) * 0.4
      ring.push([cx + Math.cos(a) * hw * j, cy + Math.sin(a) * d * j])
    }
    const c = [cx, cy - 0.05 * s]
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length]
      const f = (0.85 + hash(k + 310, i) * 0.14) * (a[1] > cy ? 0.8 : 1)       // the near edge turns down, darker
      ctx.fillStyle = ctx.strokeStyle = `rgb(${Math.round(118 * f)},${Math.round(116 * f)},${Math.round(106 * f)})`
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill(); ctx.stroke()
    }
    const px = Math.max(1, Math.round(s * 0.05))
    const greens = ['#4a6a32', '#5c7c3a', '#6f8f48', '#3b5729']
    for (let i = 0; i < 46; i++) {
      const u = (hash(k + 320, i) - 0.5) * 2, v = (hash(k + 330, i) - 0.5) * 2
      if (u * u + v * v > 0.9) continue
      ctx.fillStyle = greens[(hash(k + 340, i) * 4) | 0]
      ctx.fillRect(Math.round(cx + u * hw * 0.92), Math.round(cy + v * d * 0.9), px * (1 + ((hash(k + 350, i) * 3) | 0)), px)
    }
  }

  _draw(ctx, pgr) {
    const row = this.y, rf = row + 0.62
    const y0 = pgr._rowToScreenY(rf)
    const s = pgr._scaleAtRow(rf)
    if (y0 == null || !(s > 3)) return
    const mid = this.x + 0.5
    const sx = (u) => pgr._colToScreenX(mid + u, rf)
    const fy = (u) => y0 - pgr._tileHeightAt(Math.floor(mid + u), row) * s
    const fy0 = fy(0), cx = sx(0)

    // Flat-faceted stone, the way the ground is drawn: a few flat-coloured triangles, light from the
    // upper left, no outlines. (x: tile offset from the doorway, h: height in tiles, w: width in tiles)
    const stone = (u, w, h, k, lift = 0, tint = 1, moss = 4) => {
      const bx = sx(u), by = fy(u) + 0.12 * s - lift * s
      const j = (i) => 0.8 + hash(k, i) * 0.4
      const ring = [
        [-0.5 * w * j(1), 0], [-0.5 * w * j(2), -h * 0.55], [-0.3 * w * j(3), -h * j(4) * 0.98],
        [0.2 * w * j(5), -h * j(6)], [0.5 * w * j(7), -h * 0.6], [0.5 * w * j(8), 0]
      ].map(([x, y]) => [bx + x * s, by + y * s])
      const c = [bx + (hash(k, 9) - 0.5) * w * 0.3 * s, by - h * (0.45 + hash(k, 10) * 0.15) * s]
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]
        const mx = (a[0] + b[0]) / 2 - c[0], my = (a[1] + b[1]) / 2 - c[1]
        const L = Math.hypot(mx, my) || 1
        let f = 0.9 + (-mx / L) * 0.18 + (-my / L) * 0.2          // faces turned up and left are lighter
        f = f * (0.94 + hash(k, 20 + i) * 0.12) * tint
        const r = Math.round(124 * f), g = Math.round(121 * f), bl = Math.round(112 * f)
        ctx.fillStyle = ctx.strokeStyle = `rgb(${r},${g},${bl})`
        ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill(); ctx.stroke()
      }
      // moss and lichen in blocky flecks, as the plants are: heaviest on the top and low down
      const px = Math.max(1, Math.round(s * 0.05))
      const greens = ['#4a6a32', '#5c7c3a', '#6f8f48', '#3b5729']
      for (let i = 0; i < moss; i++) {
        const top = hash(k, 40 + i) < 0.55
        const t = top ? 0.7 + hash(k, 60 + i) * 0.3 : hash(k, 60 + i) * 0.35       // fraction of the way up
        ctx.fillStyle = hash(k, 80 + i) < 0.12 ? 'rgba(176,184,120,0.6)' : greens[(hash(k, 90 + i) * 4) | 0]
        const mxp = bx + (hash(k, 50 + i) - 0.5) * w * s * 0.95, myp = by - h * s * t
        ctx.fillRect(Math.round(mxp), Math.round(myp), px * (1 + ((hash(k, 70 + i) * 3) | 0)), px)
      }
    }

    // the passage: a crooked black rectangle in the mound's face
    const dpts = [[-0.36, 0.05], [0.4, 0.0], [0.37, -1.1], [0.02, -1.18], [-0.4, -1.04]].map(([x, y]) => [cx + x * s, fy0 + y * s])
    const dg = ctx.createLinearGradient(0, fy0 - 1.2 * s, 0, fy0)
    dg.addColorStop(0, '#000'); dg.addColorStop(1, 'rgba(6,7,9,0.96)')
    ctx.fillStyle = dg
    ctx.beginPath(); dpts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill()

    // the portal stones: one tall, one a little shorter, and the lintel jammed across
    stone(-0.64, 0.56, 1.48, 201, 0, 1.04, 44)
    stone(0.66, 0.52, 1.28, 202, 0, 1.0, 40)
    stone(0.0, 1.9, 0.42, 203, 1.2, 1.06, 60)
  }
}
