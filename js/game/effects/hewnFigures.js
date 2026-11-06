// hewnFigures.js
// Location: js/game/effects/hewnFigures.js
//
// Figures among hewn rock (effects/hewnRock.js). PGR draws the figures of a fight (its encounter flags: the foes, their
// swords, your afterimages) on its own canvas, over all the ground -- and hewn rock is drawn on the ground canvas after
// PGR, so a foe would show through a wall, and stand at the height of the floor you're on rather than his own. These
// draw them again, in the rock's own row order and at the height of the tile each one stands on.
//
//   const figs = new HewnFigures(scene, hewn)    after the HewnRock exists
//   figs.update()                               every frame, before PGR draws: takes over any new figure
//   figs.destroy()
//
//   const cave = new HewnCave(hewn)             what effects/watchers.js asks of a cave (caveWalls.js), from hewn rock:
//                                               the eyes are drawn in their row (cave.rows), lit by its light
//
// A figure taken over keeps its own draw (flag.draw, or its picture, flag.visual.gid); PGR is given one that draws
// nothing. Flat ones (lying on the ground) are left to PGR.

export class HewnFigures {
  constructor(scene, hewn) {
    this.scene = scene; this.h = hewn
    this._hook = (ctx, r) => this._row(ctx, r)
    hewn.rowHooks.push(this._hook)
  }

  update() {
    const pgr = this.scene.perspectiveGround
    for (const f of pgr?._encounterFlags || []) {
      if (f._hewn || f.visual?.flat) continue
      f._hewn = true
      const own = f.draw
      f._hewnDraw = own || ((ctx, x, y, w, g) => { const cv = f.visual?.gid != null ? g._getTileCanvas(f.visual.gid) : null; if (cv) g._drawBillboard(ctx, cv, x, y, w, 1.2) })
      f.draw = () => {}
    }
  }

  // a figure stands in the row of its tile; its foot at the middle of the tile, at that tile's height
  _row(ctx, r) {
    const pgr = this.scene.perspectiveGround, h = this.h
    const flags = pgr?._encounterFlags
    if (!flags?.length) return
    for (const f of flags) {
      if (!f._hewn || f.hidden || f.tileY !== r) continue
      const x = f.tileX + 0.5 + (f.offset?.[0] || 0), y = f.tileY + 0.5 + (f.offset?.[1] || 0)
      const z = h.walkZ(f.tileX, f.tileY) ?? h.pz ?? 0
      const pt = h._P(x, y, z)
      const w = h._k(y)
      if (!pt || !w) continue
      ctx.save()
      if (f.pose) pgr._applyPose(ctx, pt.x, pt.y, f.pose, w)
      try { f._hewnDraw(ctx, pt.x, pt.y, w, pgr) } catch (e) { if (!this._err) { this._err = true; console.error('[hewnFigures]', e) } }
      ctx.restore()
    }
  }

  destroy() {
    const i = this.h?.rowHooks?.indexOf(this._hook)
    if (i >= 0) this.h.rowHooks.splice(i, 1)
  }
}

export class HewnCave {
  constructor(hewn) {
    this.h = hewn
    this.H = hewn.H
    this.rows = Array.from({ length: hewn.H }, () => [])
    this._hook = (ctx, r) => { for (const it of this.rows[r] || []) it.draw(ctx, hewn.pgr) }
    hewn.rowHooks.push(this._hook)
  }
  get px() { return this.h.px }
  get py() { return this.h.py }
  _z(x, y) { return this.h.walkZ(Math.floor(x), Math.floor(y)) ?? this.h.surfZ(Math.floor(x), Math.floor(y)) ?? 0 }
  isRock(c, r) { return this.h.walkZ(c, r) == null }
  blocks() { return false }
  // how lit a point is, 0..1: the light at the height of a face there
  brightSmooth(x, y) {
    const h = this.h, L = h.lightAt(x, y, this._z(x, y) + 0.8, h._i(Math.floor(x), Math.floor(y)))
    return (L[0] + L[1] + L[2]) / 3
  }
  // can the light you carry see the point? (eyes a man's height above the floor there)
  _ray(ax, ay, bx, by, tc, tr) {
    const h = this.h
    return h._ray(ax, ay, h.tz ?? this._z(ax, ay) + 1.1, bx, by, this._z(bx, by) + 1.0, tc, tr)
  }
  // the screen point of (x, y) at z above the floor there
  _G(pgr, x, y, z) { return this.h.cam ? this.h._P(x, y, this._z(x, y) + z) : null }
  update() {}
  destroy() { const i = this.h?.rowHooks?.indexOf(this._hook); if (i >= 0) this.h.rowHooks.splice(i, 1) }
}
