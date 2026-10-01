// faicheGrounds.js
// Location: js/game/scenes/locations/skye/faicheGrounds.js
//
// The practice green's furniture, drawn by hand until there's art:
//
//   the ring     a lime circle round the worn ground where drills and bouts
//                happen (a PGR structure: flat on the ground, by row)
//   the dais     the teacher's platform, dressed in planks: a deck on top,
//                boarded faces over its slopes, steps at the front (also a
//                structure; the heights and the solid edges are the map's)
//   racks        wooden swords standing in a rack, either side of the way
//                in from the west
//   dummies      straw-stuffed posts along the east side; they rock when hit
//   banners      on poles round the ring, stirring in the wind
//
// Racks, dummies and banners are PGR figures that draw themselves
// (flag.draw), so they sort with the player and the students by row: walk
// behind a rack and it's in front of you. Their tiles are solid
// (mapData.blockMask, from skye_gen.mjs).
//
//   const g = new FaicheGrounds(scene, scene.mapData.faiche)
//   pgr.setStructures(g)              the ring's line, the dais
//   pgr.setEncounterFlags([...flags, ...g.flags])
//   g.hitDummy(i)                     set one rocking
//   g.takeSword(i)                    one fewer in rack i (false if empty)
//   g.marker = [c, r] | null          a place marked on the ground (yours, in a drill)
//   g.rackIcon(i)                     a small picture of rack i (for the moon's badge)

const LIME = 'rgba(232,228,206,0.55)'
const PLANK = '#6e5237', PLANK2 = '#64492f', SEAM = '#3d2c1e', FACE = '#4e3826', FACE_DK = '#3a2a1c'
const WOOD = '#7a5636', WOOD_DK = '#4e3522', WOOD_LT = '#9b7448'
const STRAW = '#c9a95e', STRAW_DK = '#9c7f3e', SACK = '#b39b72'
// banner cloths: saffron, madder red, woad blue, a green -- muted, like old dye
const CLOTHS = [['#c98f2e', '#7d561a'], ['#9c3b2e', '#5e2219'], ['#3d5a86', '#22344f'], ['#4f7a45', '#2d4a28']]

export default class FaicheGrounds {
  constructor(scene, layout = {}) {
    this.scene = scene
    this.L = layout
    this.t0 = performance.now()
    this.racks = (layout.racks || []).map(([x, y]) => ({ x, y, swords: 5 }))
    this.marker = null
    this.dummies = (layout.dummies || []).map(([x, y]) => ({ x, y, hitAt: -1e9, dir: 1 }))
    this.flags = [
      ...this.racks.map((r, i) => ({ tileX: r.x, tileY: r.y, visual: {}, offset: [0, 0], prop: 'rack', draw: (c, x, y, w) => this._rack(c, x, y, w, this.racks[i]) })),
      ...this.dummies.map((d, i) => ({ tileX: d.x, tileY: d.y, visual: {}, offset: [0, 0], prop: 'dummy', draw: (c, x, y, w) => this._dummy(c, x, y, w, this.dummies[i]) })),
      ...(layout.banners || []).map(([bx, by], i) => ({ tileX: bx, tileY: by, visual: {}, offset: [0, 0], prop: 'banner', draw: (c, x, y, w) => this._banner(c, x, y, w, i) })),
    ]
  }

  hitDummy(i, dir = 1) { const d = this.dummies[i]; if (d) { d.hitAt = performance.now(); d.dir = dir } }
  takeSword(i) { const r = this.racks[i]; if (!r || r.swords <= 0) return false; r.swords--; return true }
  returnSword(i) { const r = this.racks[i]; if (r) r.swords = Math.min(5, r.swords + 1) }

  // ── the ring's line and the dais (PGR structure provider) ────────────────
  getEntriesForRow(row) {
    const out = [], g = this.L.ring, d = this.L.dais
    if (g && row >= Math.floor(g.cy - g.r) && row <= Math.floor(g.cy + g.r)) out.push({ draw: (ctx, pgr) => this._ringRow(ctx, pgr, row) })
    if (d && row >= d.y0 && row <= d.y1 + 1) out.push({ draw: (ctx, pgr) => this._daisRow(ctx, pgr, row) })
    if (this.marker && row === this.marker[1]) out.push({ draw: (ctx, pgr) => this._markerTile(ctx, pgr) })
    return out
  }

  // your place in the line: a lime square on the ground, breathing gently
  _markerTile(ctx, pgr) {
    const [c, r] = this.marker, i = 0.14
    const pts = [[c + i, r + i], [c + 1 - i, r + i], [c + 1 - i, r + 1 - i], [c + i, r + 1 - i]].map(([x, y]) => this._gp(pgr, x, y))
    if (pts.some(p => !p)) return
    const a = 0.45 + 0.3 * Math.sin(performance.now() / 380)
    ctx.save()
    ctx.strokeStyle = `rgba(232,228,206,${a.toFixed(3)})`; ctx.lineWidth = Math.max(1.5, pgr._scaleAtRow(r + 0.5) * 0.05)
    ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.closePath(); ctx.stroke()
    ctx.restore()
  }

  rackIcon(i) {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const g = c.getContext('2d')
    this._rack(g, 32, 58, 56, this.racks[i] || { swords: 5 })
    return c
  }

  // a point on screen: (col, row) at height h (tile units)
  _pt(pgr, col, row, h) {
    const y = pgr._rowToScreenY(row)
    if (y == null) return null
    return [pgr._colToScreenX(col, row), y - h * pgr._scaleAtRow(row)]
  }
  _quad(ctx, pts, fill) {
    if (pts.some(p => !p)) return false
    ctx.fillStyle = fill
    ctx.beginPath(); ctx.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]); ctx.closePath(); ctx.fill()
    return true
  }

  // One row of the dais: its side faces and deck, the boarded front, or the steps.
  _daisRow(ctx, pgr, row) {
    const d = this.L.dais, [sc] = this.L.stair || [-1], h = d.h
    const vh = (c, r) => pgr._vertexH(c, r)
    const P = (c, r, z) => this._pt(pgr, c, r, z)
    const sw = Math.max(1, pgr._scaleAtRow(row + 1) * 0.02)
    ctx.save()
    ctx.strokeStyle = SEAM; ctx.lineWidth = sw
    if (row <= d.y1) {
      // the sides: boards over the slope, darker, the light falling from the south
      for (const [edge, out] of [[d.x0, d.x0 - 1], [d.x1 + 1, d.x1 + 2]]) {
        const q = [P(edge, row, h), P(edge, row + 1, h), P(out, row + 1, vh(out, row + 1)), P(out, row, vh(out, row))]
        if (this._quad(ctx, q, FACE_DK)) {
          ctx.beginPath()
          for (const f of [0.33, 0.66]) {
            const a = P(edge + (out - edge) * f, row, h * (1 - f)), b = P(edge + (out - edge) * f, row + 1, h * (1 - f))
            if (a && b) { ctx.moveTo(...a); ctx.lineTo(...b) }
          }
          ctx.stroke()
        }
      }
      // the deck: planks running across, a seam every third of a tile, butt joints staggered
      const q = [P(d.x0, row, h), P(d.x1 + 1, row, h), P(d.x1 + 1, row + 1, h), P(d.x0, row + 1, h)]
      if (this._quad(ctx, q, row % 2 ? PLANK : PLANK2)) {
        ctx.beginPath()
        for (const f of [1 / 3, 2 / 3, 1]) {
          const a = P(d.x0, row + f, h), b = P(d.x1 + 1, row + f, h)
          if (a && b) { ctx.moveTo(...a); ctx.lineTo(...b) }
        }
        for (let k = 0; k < 3; k++) for (let c = d.x0 + 1 + ((row * 3 + k) % 3); c <= d.x1; c += 3) {
          const a = P(c + 0.5, row + k / 3, h), b = P(c + 0.5, row + (k + 1) / 3, h)
          if (a && b) { ctx.moveTo(...a); ctx.lineTo(...b) }
        }
        ctx.stroke()
      }
    } else {
      // the front: upright boards over the slope, a beam along the top, and posts
      for (let c = d.x0 - 1; c <= d.x1 + 1; c++) {
        if (c === sc) continue
        const q = [P(c, row, vh(c, row)), P(c + 1, row, vh(c + 1, row)), P(c + 1, row + 1, vh(c + 1, row + 1)), P(c, row + 1, vh(c, row + 1))]
        if (!this._quad(ctx, q, FACE)) continue
        ctx.beginPath()
        for (const f of [0.25, 0.5, 0.75]) {
          const a = P(c + f, row, vh(c, row) + (vh(c + 1, row) - vh(c, row)) * f), b = P(c + f, row + 1, vh(c, row + 1) + (vh(c + 1, row + 1) - vh(c, row + 1)) * f)
          if (a && b) { ctx.moveTo(...a); ctx.lineTo(...b) }
        }
        ctx.stroke()
      }
      // the beam: the deck's edge, seen from the front
      const a = P(d.x0, row, h), b = P(d.x1 + 1, row, h)
      if (a && b) { ctx.fillStyle = FACE_DK; ctx.fillRect(a[0], a[1] - sw, b[0] - a[0], Math.max(2, sw * 3.5)) }
      // the steps, down the stair tile: three treads
      const N = 3
      for (let i = 0; sc >= 0 && i < N; i++) {
        const z = h * (1 - (i + 1) / N), ra = row + i / N, rb = row + (i + 1) / N
        // riser: from the tread above down to this one
        this._quad(ctx, [P(sc, ra, z + h / N), P(sc + 1, ra, z + h / N), P(sc + 1, ra, z), P(sc, ra, z)], FACE_DK)
        // tread
        this._quad(ctx, [P(sc, ra, z), P(sc + 1, ra, z), P(sc + 1, rb, z), P(sc, rb, z)], i % 2 ? PLANK : PLANK2)
      }
    }
    ctx.restore()
  }

  // A ground point (col, row) on screen, lifted by the terrain.
  _gp(pgr, col, row) {
    const y = pgr._rowToScreenY(row)
    if (y == null) return null
    const lift = pgr._vertexH(Math.round(col), Math.round(row)) * pgr._scaleAtRow(row)
    return [pgr._colToScreenX(col, row), y - lift]
  }

  // The part of the ring's line whose ground lies in this row: the circle
  // sampled finely, each little chord drawn on the row its middle falls in.
  _ringRow(ctx, pgr, row) {
    const g = this.L.ring, r = g.r - 0.12               // just inside the worn edge
    const sc = pgr._scaleAtRow(row + 0.5)
    if (sc < 2) return
    const N = 96, pt = i => { const a = (i / N) * Math.PI * 2; return [g.cx + Math.cos(a) * r, g.cy + Math.sin(a) * r] }
    ctx.save()
    ctx.strokeStyle = LIME; ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(1, sc * 0.05)
    ctx.beginPath()
    for (let i = 0; i < N; i++) {
      const a = pt(i), b = pt(i + 1)
      if (Math.floor((a[1] + b[1]) / 2) !== row) continue
      const pa = this._gp(pgr, a[0], a[1]), pb = this._gp(pgr, b[0], b[1])
      if (pa && pb) { ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]) }
    }
    ctx.stroke()
    ctx.restore()
  }

  // ── props (flag.draw: foot at x, y; w = a tile's width on screen) ────────
  _shadow(ctx, x, y, rw, rh = 0.2) {
    ctx.fillStyle = 'rgba(10,14,10,0.28)'
    ctx.beginPath(); ctx.ellipse(x, y, rw, rw * rh, 0, 0, Math.PI * 2); ctx.fill()
  }

  // A rack: two posts, two rails, wooden swords standing in it, points up.
  _rack(ctx, x, y, w, rack) {
    if (w < 3) return
    const h = w * 0.95, half = w * 0.5
    this._shadow(ctx, x, y, w * 0.6)
    ctx.save()
    // swords first, so the front rail crosses them
    for (let i = 0; i < 5; i++) {
      if (i >= rack.swords) continue
      const sx = x - half * 0.72 + (i + 0.5) * (half * 1.44 / 5)
      const lean = (i - 2) * 0.03
      this._woodenSword(ctx, sx, y - h * 0.05, w * 0.95, lean)
    }
    // posts
    ctx.fillStyle = WOOD_DK
    const pw = Math.max(1.5, w * 0.07)
    for (const px of [x - half * 0.85, x + half * 0.85 - pw]) ctx.fillRect(px, y - h * 0.75, pw, h * 0.75)
    // rails: a low one at the hilts, a higher one that holds the blades
    ctx.fillStyle = WOOD
    ctx.fillRect(x - half * 0.92, y - h * 0.62, half * 1.84, Math.max(1.5, w * 0.06))
    ctx.fillStyle = WOOD_LT
    ctx.fillRect(x - half * 0.92, y - h * 0.3, half * 1.84, Math.max(1.5, w * 0.06))
    ctx.restore()
  }

  // a practice sword standing on its pommel: grip, guard, blade
  _woodenSword(ctx, x, y, len, lean = 0) {
    ctx.save()
    ctx.translate(x, y); ctx.rotate(lean)
    const bw = Math.max(1.5, len * 0.07)
    ctx.fillStyle = WOOD_DK; ctx.fillRect(-bw * 0.4, -len * 0.22, bw * 0.8, len * 0.22)          // grip
    ctx.fillStyle = WOOD; ctx.fillRect(-bw * 1.6, -len * 0.26, bw * 3.2, Math.max(1, len * 0.04))   // guard
    ctx.fillStyle = '#b08a5a'
    ctx.beginPath()
    ctx.moveTo(-bw / 2, -len * 0.26); ctx.lineTo(-bw / 2, -len * 0.92); ctx.lineTo(0, -len); ctx.lineTo(bw / 2, -len * 0.92); ctx.lineTo(bw / 2, -len * 0.26)
    ctx.closePath(); ctx.fill()
    ctx.restore()
  }

  // A dummy: a post, a crosspiece for arms, a straw body bound with cord, a
  // sack for a head. Hit, it rocks on its post and settles.
  _dummy(ctx, x, y, w, d) {
    if (w < 3) return
    const h = w * 1.25
    this._shadow(ctx, x, y, w * 0.4)
    const el = (performance.now() - d.hitAt) / 1000
    const rock = el < 1.6 ? Math.sin(el * 14) * Math.exp(-el * 3.2) * 0.35 * d.dir : 0
    ctx.save()
    ctx.translate(x, y); ctx.rotate(rock); ctx.translate(-x, -y)
    ctx.fillStyle = WOOD_DK
    ctx.fillRect(x - w * 0.04, y - h * 0.72, w * 0.08, h * 0.72)                               // post
    ctx.fillStyle = WOOD
    ctx.fillRect(x - w * 0.42, y - h * 0.68, w * 0.84, Math.max(1.5, w * 0.06))                // arms
    // straw body
    ctx.fillStyle = STRAW
    ctx.beginPath(); ctx.ellipse(x, y - h * 0.52, w * 0.2, h * 0.22, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = STRAW_DK; ctx.lineWidth = Math.max(1, w * 0.02)
    for (const k of [-0.1, 0.05]) {                                                          // binding
      ctx.beginPath(); ctx.moveTo(x - w * 0.19, y - h * (0.52 + k)); ctx.lineTo(x + w * 0.19, y - h * (0.52 + k)); ctx.stroke()
    }
    // straw ends poking out
    for (let i = 0; i < 5; i++) {
      const a = -0.6 + i * 0.3
      ctx.beginPath(); ctx.moveTo(x + Math.sin(a) * w * 0.1, y - h * 0.32); ctx.lineTo(x + Math.sin(a) * w * 0.18, y - h * 0.27); ctx.stroke()
    }
    // sack head
    ctx.fillStyle = SACK
    ctx.beginPath(); ctx.arc(x, y - h * 0.86, w * 0.13, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = STRAW_DK
    ctx.beginPath(); ctx.moveTo(x - w * 0.1, y - h * 0.77); ctx.lineTo(x + w * 0.1, y - h * 0.77); ctx.stroke()
    ctx.restore()
  }

  // A banner on a tall pole: a crossbar, the cloth hanging from it with a
  // forked tail, rippling a little.
  _banner(ctx, x, y, w, i) {
    if (w < 3) return
    const [cloth, dark] = CLOTHS[i % CLOTHS.length]
    const t = (performance.now() - this.t0) / 1000
    const H = w * 2.6, cw = w * 0.5, ch = w * 0.95
    this._shadow(ctx, x, y, w * 0.18)
    ctx.save()
    ctx.fillStyle = WOOD_DK
    ctx.fillRect(x - Math.max(1, w * 0.025), y - H, Math.max(2, w * 0.05), H)                 // pole
    ctx.fillStyle = WOOD
    ctx.fillRect(x - cw * 0.1, y - H * 0.97, cw * 1.2, Math.max(1.5, w * 0.035))            // crossbar
    // the cloth: a column of strips, each pushed sideways by a travelling wave
    const top = y - H * 0.95, N = 10
    const sway = k => Math.sin(t * 2.1 + i * 1.7 - k * 2.4) * w * 0.05 * k
    ctx.fillStyle = cloth
    ctx.beginPath()
    ctx.moveTo(x, top)
    for (let s = 0; s <= N; s++) { const k = s / N; ctx.lineTo(x + cw + sway(k), top + ch * k) }
    // forked tail
    ctx.lineTo(x + cw * 0.5 + sway(1.1), top + ch * 0.85)
    ctx.lineTo(x + sway(1), top + ch)
    for (let s = N; s >= 0; s--) { const k = s / N; ctx.lineTo(x + sway(k) * 0.6, top + ch * k) }
    ctx.closePath(); ctx.fill()
    // a border and a ring device, in the darker dye
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, w * 0.03)
    ctx.stroke()
    const mx = x + cw * 0.5 + sway(0.4) * 0.8, my = top + ch * 0.38
    ctx.beginPath(); ctx.arc(mx, my, cw * 0.22, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(mx, my - cw * 0.22); ctx.lineTo(mx, my + cw * 0.22); ctx.stroke()
    ctx.restore()
  }
}
