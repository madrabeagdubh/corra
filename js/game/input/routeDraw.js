// routeDraw.js
// Location: js/game/input/routeDraw.js
//
// Drawing a route with a finger, ported from the Practice Yard. Drag across
// the ground and the player walks the line, tile by tile. Rest the finger on
// a tile half a second or more while drawing and they'll wait there (a gold
// ring with the seconds). A tap still walks to the tapped tile as before;
// only a drag (14 px or more) draws.
//
// The route begins wherever the finger began: the player first walks to it
// (pathfinder), shown as a dim line. In a fight there's no walking off to a
// distant start: a line drawn more than two tiles from you is taken as a
// SHAPE, laid down from your own tile -- so you can draw near your thumb,
// where the tiles are big and your finger isn't over the player. While you
// draw, the shape is shown at your feet (gold), the line you drew faintly.
//
//   const rd = new RouteDraw(scene)
//   rd.begin(x, y); rd.move(x, y); rd.end(cancelled) -> true if it was a drag
//   rd.draw(ctx)      from PGR, after the frame (perspectiveGroundRenderer)
//
// Steps go to Player.setPath() as { dx, dy }, and waits as { wait: ms }.

import PathFinder from '../systems/pathFinder.js'

const DRAG_PX = 14
const sign = v => (v > 0) - (v < 0)
const dwellMs = ms => ms < 500 ? 0 : Math.min(8000, Math.round(ms / 500) * 500)

export default class RouteDraw {
  constructor(scene) {
    this.scene = scene
    this.p0 = null          // where the finger went down
    this.trail = null       // [[c, r, waitMs], ...] while drawing
    this.trailAt = 0
    this.route = null       // the committed route, for drawing: [[c, r, waitMs], ...]
    this.lead = null        // the walk to its start: [[c, r], ...]
    this.reject = null
  }

  get ts() { return this.scene.tileSize }
  playerTile() { const p = this.scene.player; return [Math.floor(p.logicalX / this.ts), Math.floor(p.logicalY / this.ts)] }
  inFight() { return !!this.scene._melee?.melee?.combat }
  tileAt(x, y) { const t = PathFinder.screenToTile(x, y, this.scene.perspectiveGround, this.ts); return t ? [t.tx, t.ty] : null }

  begin(x, y) { this.p0 = { x, y }; this.trail = null }
  move(x, y) {
    if (!this.p0) return
    if (!this.trail) {
      if (Math.hypot(x - this.p0.x, y - this.p0.y) < DRAG_PX) return
      this.trail = []
      this._add(this.p0.x, this.p0.y)
    }
    this._add(x, y)
  }
  _add(x, y) {
    const t = this.tileAt(x, y)
    if (!t) return
    const last = this.trail[this.trail.length - 1], now = performance.now()
    if (!last) { this.trailAt = now; this.trail.push([t[0], t[1], 0]); return }
    if (last[0] === t[0] && last[1] === t[1]) return
    last[2] = dwellMs(now - this.trailAt)                  // the finger rested there: a wait
    let [c, r] = last
    while (c !== t[0] || r !== t[1]) { c += sign(t[0] - c); r += sign(t[1] - r); this.trail.push([c, r, 0]) }
    this.trailAt = now
  }
  // returns true if this press was a drag (a route), false if it was a tap
  end(cancelled = false) {
    const list = this.trail
    this.p0 = null; this.trail = null
    if (!list) return false
    if (cancelled || list.length < 2) return true
    list[list.length - 1][2] = dwellMs(performance.now() - this.trailAt)
    this._commit(list)
    return true
  }
  startTooFar(list) {
    const [pc, pr] = this.playerTile()
    return this.inFight() && Math.max(Math.abs(list[0][0] - pc), Math.abs(list[0][1] - pr)) > 2
  }
  // the same shape, laid down from your own tile (waits kept)
  shifted(list) {
    const [pc, pr] = this.playerTile(), dx = pc - list[0][0], dy = pr - list[0][1]
    return list.map(([c, r, w]) => [c + dx, r + dy, w])
  }

  _commit(list) {
    const sc = this.scene, ts = this.ts
    if (this.startTooFar(list)) list = this.shifted(list)
    const blocked = (c, r) => sc.isColliding(c * ts + ts / 2, r * ts + ts / 2) || !!sc.isOccupied?.(c * ts + ts / 2, r * ts + ts / 2)
    // the line stops at the first tile you can't stand on
    const route = []
    for (const e of list) { if (blocked(e[0], e[1])) break; route.push(e) }
    if (!route.length) return
    // walk to where it begins
    const [pc, pr] = this.playerTile()
    const steps = []
    let lead = [[pc, pr]]
    if (route[0][0] !== pc || route[0][1] !== pr) {
      const path = sc.pathFinder?.findPath?.(pc, pr, route[0][0], route[0][1]) || []
      if (!path.length) return
      let c = pc, r = pr
      for (const s of path) { steps.push({ dx: s.dx, dy: s.dy }); c += s.dx; r += s.dy; lead.push([c, r]) }
    }
    if (route[0][2] > 0) steps.push({ dx: 0, dy: 0, wait: route[0][2] })
    for (let i = 1; i < route.length; i++) {
      steps.push({ dx: route[i][0] - route[i - 1][0], dy: route[i][1] - route[i - 1][1] })
      if (route[i][2] > 0) steps.push({ dx: 0, dy: 0, wait: route[i][2] })
    }
    sc.player.setPath(steps)
    this.route = route.map(e => [...e])
    this.lead = lead.length > 1 ? lead : null
    sc._flashTargetTile?.(route[route.length - 1][0], route[route.length - 1][1])
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  _ground(col, row) {
    const g = this.scene.perspectiveGround
    const y0 = g._rowToScreenY(row)
    if (y0 == null) return null
    return [g._colToScreenX(col, row), y0 - g._vertexH(Math.round(col), Math.round(row)) * g._scaleAtRow(row)]
  }
  _line(ctx, tiles, col, w, dash) {
    const pts = tiles.map(([c, r]) => this._ground(c + 0.5, r + 0.5)).filter(Boolean)
    if (pts.length < 2) return
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([])
  }
  _waits(ctx, tiles) {
    ctx.font = 'bold 12px "Courier Prime", monospace'; ctx.textAlign = 'center'
    for (const [c, r, w] of tiles) {
      if (!(w > 0)) continue
      const p = this._ground(c + 0.5, r + 0.5); if (!p) continue
      const rad = Math.max(8, this.scene.perspectiveGround._scaleAtRow(r + 0.5) * 0.3)
      ctx.beginPath(); ctx.ellipse(p[0], p[1], rad, rad * 0.55, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(20,16,8,0.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(245,208,96,0.9)'; ctx.lineWidth = 2; ctx.stroke()
      ctx.fillStyle = '#f5d060'; ctx.fillText((w / 1000) + 's', p[0], p[1] + 4)
    }
  }
  draw(ctx) {
    const sc = this.scene
    if (!sc.perspectiveGround || !sc.player) return
    const gold = 'rgba(245,208,96,0.75)', red = 'rgba(255,90,70,0.85)', dim = 'rgba(245,208,96,0.35)'
    ctx.save()
    if (this.trail?.length) {
      // while drawing: the wait under the resting finger grows
      this.trail[this.trail.length - 1][2] = dwellMs(performance.now() - this.trailAt)
      const pt = this.playerTile(), t0 = this.trail[0]
      if (this.startTooFar(this.trail)) {                    // a shape: shown where you'll walk it
        const sh = this.shifted(this.trail)
        this._line(ctx, this.trail, dim, 2, [1, 5])
        this._line(ctx, sh, gold, 3, [2, 6])
        this._waits(ctx, sh)
      } else {
        if (t0[0] !== pt[0] || t0[1] !== pt[1]) this._line(ctx, [pt, t0], dim, 2, [1, 5])
        this._line(ctx, this.trail, gold, 3, [2, 6])
        this._waits(ctx, this.trail)
      }
    } else if (this.route) {
      // the route still ahead: drop what's been walked, forget it when it's done or dropped
      const p = sc.player, pt = this.playerTile()
      if (!p.pathQueue?.length && !p.isMoving) { this.route = this.lead = null }
      else {
        if (this.lead) { const i = this.lead.findIndex(([c, r]) => c === pt[0] && r === pt[1]); if (i >= 0) this.lead = this.lead.slice(i); if (this.lead.length < 2) this.lead = null }
        if (!this.lead) { const i = this.route.findIndex(([c, r]) => c === pt[0] && r === pt[1]); if (i > 0) this.route = this.route.slice(i) }
        if (this.lead) this._line(ctx, this.lead, dim, 2, [1, 5])
        this._line(ctx, this.route, gold, 3, [2, 6])
        this._waits(ctx, this.route)
        // standing out a wait: a ring round your feet runs down
        if (p._waitUntil > performance.now()) {
          const q = this._ground(pt[0] + 0.5, pt[1] + 0.5), k = (p._waitUntil - performance.now()) / Math.max(1, p._waitUntil - p._waitStart)
          if (q) { const rad = sc.perspectiveGround._scaleAtRow(pt[1] + 0.5) * 0.45
            ctx.beginPath(); ctx.ellipse(q[0], q[1], rad, rad * 0.45, 0, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * k)
            ctx.strokeStyle = 'rgba(245,208,96,0.9)'; ctx.lineWidth = 3; ctx.stroke() }
        }
      }
    }
    if (this.reject) {
      const a = 1 - (performance.now() - this.reject.t) / 700
      if (a <= 0) this.reject = null
      else {
        this._line(ctx, this.reject.list, `rgba(255,90,70,${a})`, 3, [2, 6])
        const W = ctx.canvas.width
        ctx.fillStyle = `rgba(255,120,100,${a})`; ctx.font = 'bold 14px "Courier Prime", monospace'; ctx.textAlign = 'center'
        ctx.fillText('start beside you', W / 2, ctx.canvas.height * 0.45)
      }
    }
    ctx.restore()
  }
}
