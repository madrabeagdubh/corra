// faicheCastleShadow.js
// Location: js/game/scenes/locations/skye/faicheCastleShadow.js
//
// A foreshadowing: the crenellated shadow of the castle (Dún Scáith, still unseen) lies across the south
// of the green -- a long crenellated wall-top and a tower at the west end. It is soft and translucent,
// as under cloud: faint penumbra rings, a slow drift of cloud-light over it, nothing else casting shadow.
//
//   const sh = new CastleShadow()         // scene create
//   sh.draw(ctx, pgr)                     // scene onPGRDrawComplete (world-anchored through PGR)
//
// Shapes are in tile coordinates [col, row] (the faiche is 36 x 36).

const TAU = Math.PI * 2

// The silhouette of the castle's north face, walking east to west: a long curtain wall with small, close
// crenels; two plain square turrets standing a little proud of it; and at the west end a tower whose top is
// corbelled out wider than its shaft, with a plain vertical west face. Rows grow southward; the wall's foot
// is off the south of the picture.
const WALL = 27.2, WALL_TIP = 26.3                          // wall: notch row, merlon tip row
function build() {
  const M = 0.8, G = 0.6                                     // merlon width, gap
  const TUR = 24.6, TUR_TIP = 23.7                           // turrets
  const TOWER = 21.0, CORBEL = 19.6, TOWER_TIP = 18.7        // tower shaft top, corbel top (notches), merlon tips
  const pts = [[200, WALL]]
  let cur = 200
  const crenels = (to, notch, tip, m = M, g = G) => {
    while (cur - m > to + 0.05) {
      pts.push([cur, tip], [cur - m, tip], [cur - m, notch]); cur -= m
      if (cur - g > to + 0.05) { pts.push([cur - g, notch]); cur -= g } else break
    }
    pts.push([to, notch]); cur = to
  }
  const turret = (a, b) => {
    crenels(a, WALL, WALL_TIP)
    pts.push([a, TUR]); crenels(b, TUR, TUR_TIP)
    pts.push([b, WALL]); cur = b
  }
  turret(46, 42.5)
  turret(30, 26.5)
  const TR = 13.5, TL = 4.5, OUT = 0.8
  crenels(TR, WALL, WALL_TIP)
  pts.push([TR, TOWER], [TR + OUT, TOWER], [TR + OUT, CORBEL])
  crenels(TL - OUT, CORBEL, TOWER_TIP, 0.9, 0.65)
  pts.push([TL - OUT, TOWER], [TL, TOWER], [TL, 40])
  return pts
}

export default class CastleShadow {
  constructor(opts = {}) {
    this.alpha = opts.alpha ?? 0.4
    this.lean = opts.lean ?? 0                 // columns of westward lean per row of height
    this.color = opts.color ?? '#14221c'
    this.north = opts.north ?? 4.5               // how far the whole shape is shifted north (rows)
    this.poly = build()
    this.t = 0
  }

  _project(pgr, poly, sh) {
    return poly.map(([c, r]) => {
      const rr = r - this.north
      const y = pgr._rowToScreenY(rr), sc = pgr._scaleAtRow(rr)
      return [pgr._colToScreenX(c, rr), y === null ? sh + 300 : y, sc]
    })
  }

  // fill a polygon with a soft penumbra: the same shape again and again, a little fatter and fainter each
  // time. Softer than it is sharp: it's a cloudy day.
  _paint(ctx, pts, tile, alpha, rings = 7) {
    for (let k = rings; k >= 0; k--) {
      ctx.globalAlpha = alpha / (rings * 0.55)
      ctx.lineWidth = k * tile * 0.16
      ctx.beginPath()
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.fill()
      if (k) ctx.stroke()
    }
  }

  draw(ctx, pgr, dt = 1 / 60) {
    if (!pgr || !ctx) return
    this.t += dt
    const sh = pgr._sh ?? 1000
    // cloud-light: the shadow strengthens and thins very slowly, as the sun comes and goes
    const cloud = 0.82 + 0.18 * Math.sin(this.t * 0.18) * Math.sin(this.t * 0.07 + 1)
    const pts = this._project(pgr, this.poly, sh)
    if (pts.every(p => p[1] > sh + 200)) return
    // The south edge is closed in screen space, well below the screen and past both sides, so it can
    // never fall short of the bottom (whatever the camera, or a resize). The west face runs straight down.
    const tile = pts[0][2]
    pts.push([pts[pts.length - 1][0], sh + 600, tile], [pts[0][0], sh + 600, tile])
    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = ctx.strokeStyle = this.color
    ctx.lineJoin = 'round'
    this._paint(ctx, pts, tile, this.alpha * cloud)
    ctx.restore()
  }
}
