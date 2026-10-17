// farShips.js
// Location: js/game/effects/farShips.js
//
// A few sailing ships on the open water of a vista map (skye_farraige_w: the sea north of the machaire),
// hinting at the kingdom across the water. They are drawn with the same projection as the ground, so
// they foreshorten and parallax with it, and hazed toward the horizon with distance. Each ship is a
// birlinn: a low clinker hull with a raised stem and stern, one mast and a square sail of undyed wool
// with a dark stripe. They sail very slowly along their row, bob on the swell, and turn at the ends.
//
//   new FarShips({ ships: [[x, row, heading], ...] })    x, row: LOCAL tiles in the vista; heading +1 east / -1 west
//   ships.draw(ctx, pgr)        from the scene's drawFarHost(ctx, pgr)  (the ground canvas, after the vista tiles)

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`
const HAZE = [188, 196, 193]
const SEA_LVL = 1.3                       // the vista's sea surface sits this far below the land (skye_gen)

export default class FarShips {
  constructor(opts = {}) {
    this.range = opts.range ?? [6, 30]                       // the stretch of water they sail: local columns
    this.ships = (opts.ships ?? []).map(([x, row, dir], i) => ({ x, row, dir, ph: i * 2.1, v: 0.06 + 0.02 * i, size: 0.25, kind: i % 3 }))
    this.t = 0
    this.last = performance.now()
  }

  draw(ctx, pgr) {
    const nb = pgr?._northNeighbor
    if (!nb || !pgr._cameraReady?.()) return
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now
    this.t += dt
    const [x0, x1] = this.range
    for (const s of this.ships) {
      s.x += s.dir * s.v * dt
      if (s.x > x1) { s.x = x1; s.dir = -1 } else if (s.x < x0) { s.x = x0; s.dir = 1 }
      const wr = s.row + 0.5 - nb.height                    // world row of the ship
      const y0 = pgr._rowToScreenY(wr)
      if (y0 === null) continue
      const sc = pgr._scaleAtRow(wr)
      if (sc < 0.5) continue
      const bob = Math.sin(this.t * 1.1 + s.ph) * 0.07, roll = Math.sin(this.t * 0.8 + s.ph * 1.7) * 0.05
      const px = pgr._colToScreenX(s.x - (nb.columnOffset ?? 0), wr)
      const py = y0 + SEA_LVL * sc + bob * sc
      if (px < -sc * 4 || px > pgr._sw + sc * 4 || py < -sc * 4 || py > pgr._sh + sc * 4) continue
      // farther rows, foggier
      const fog = Math.max(0.3, Math.min(0.6, 0.45 + (-s.row) * 0.01))
      this._ship(ctx, px, py, sc * s.size, s.dir, roll, fog, s.kind)
    }
  }

  // three builds: a big striped-sail birlinn, a small plain-sailed boat with a dark sail, a long ship with a banded sail
  static KINDS = [
    { len: 1, sw: 1, sh: 1, wool: [226, 214, 182], band: [128, 56, 40], cross: true, oars: 7 },
    { len: 0.75, sw: 0.8, sh: 0.8, wool: [150, 120, 84], band: [96, 74, 52], cross: false, oars: 4 },
    { len: 1.25, sw: 1.15, sh: 0.9, wool: [214, 206, 188], band: [52, 62, 84], cross: true, oars: 9 },
  ]

  _ship(ctx, x, y, u, dir, roll, fog, kind = 0) {
    const K = FarShips.KINDS[kind] || FarShips.KINDS[0]
    const c = (rgbv, k = fog) => rgb(mix(rgbv, HAZE, k))
    const hull = c([46, 33, 24]), plank = c([88, 64, 42]), wool = c(K.wool, fog * 0.8), band = c(K.band), mast = c([38, 28, 20]), rope = c([70, 58, 46], fog + 0.1)
    ctx.save()
    ctx.translate(x, y); ctx.rotate(roll); ctx.scale(dir * u * K.len * K.sw, u * K.sh)
    // a thin wake on the water
    ctx.fillStyle = `rgba(238,243,238,${0.3 * (1 - fog)})`
    ctx.fillRect(-1.9, 0.44, 3.8, 0.05); ctx.fillRect(-1.2, 0.54, 2.2, 0.04)
    // oars, a few, dipping
    ctx.strokeStyle = mast; ctx.lineWidth = 0.035
    const half = (K.oars - 1) / 2
    for (let i = -half; i <= half; i++) { const ox = i * 0.34 * 6 / K.oars * 1.15, sw = Math.sin(this.t * 2 + i) * 0.05; ctx.beginPath(); ctx.moveTo(ox, 0.1); ctx.lineTo(ox - 0.2 + sw, 0.6); ctx.stroke() }
    // the hull: a long clinker boat, low amidships, stem and stern swept up, a dragon-less prow with a little post
    ctx.fillStyle = hull
    ctx.beginPath()
    ctx.moveTo(-1.55, -0.6); ctx.quadraticCurveTo(-1.3, 0.2, -0.8, 0.42)
    ctx.lineTo(0.85, 0.42); ctx.quadraticCurveTo(1.35, 0.26, 1.65, -0.66)
    ctx.lineTo(1.55, -0.66); ctx.quadraticCurveTo(1.25, -0.14, 0.9, -0.1)
    ctx.lineTo(-0.9, -0.1); ctx.quadraticCurveTo(-1.3, -0.14, -1.45, -0.6)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = plank                                         // two strakes and a gunwale line
    ctx.fillRect(-0.95, -0.1, 1.9, 0.05); ctx.fillRect(-1.0, 0.1, 2.0, 0.04); ctx.fillRect(-0.85, 0.26, 1.7, 0.03)
    ctx.fillStyle = hull; ctx.fillRect(1.55, -0.78, 0.07, 0.16)   // stem post
    // mast, yard and stays
    ctx.fillStyle = mast
    ctx.fillRect(-0.04, -2.15, 0.08, 2.05)
    ctx.fillRect(-0.7, -2.02, 1.4, 0.07)
    ctx.strokeStyle = rope; ctx.lineWidth = 0.025
    ctx.beginPath(); ctx.moveTo(0, -2.12); ctx.lineTo(1.5, -0.62); ctx.moveTo(0, -2.12); ctx.lineTo(-1.4, -0.58); ctx.stroke()
    // the square sail, bellied, with a dark stripe and a cross of reefing bands
    ctx.fillStyle = wool
    ctx.beginPath()
    ctx.moveTo(-0.66, -1.95); ctx.lineTo(0.66, -1.95)
    ctx.quadraticCurveTo(0.9, -1.25, 0.6, -0.5); ctx.lineTo(-0.6, -0.5)
    ctx.quadraticCurveTo(-0.82, -1.25, -0.66, -1.95)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = band
    if (K.cross) ctx.fillRect(-0.1, -1.95, 0.2, 1.45)
    else { ctx.fillRect(-0.7, -0.8, 1.4, 0.1); ctx.fillRect(-0.7, -1.3, 1.4, 0.06) }
    if (K.cross) ctx.fillRect(-0.74, -1.28, 1.48, 0.07)
    ctx.restore()
  }
}
