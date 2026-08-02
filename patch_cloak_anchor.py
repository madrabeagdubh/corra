#!/usr/bin/env python3
"""
patch_cloak_anchor.py -- Corra: cloak sits on the shoulder, behind her.

TWO PROBLEMS, ONE CAUSE
The cloak was drawn from onPGRDrawComplete, which fires AFTER PGR has laid
down every billboard, and which has to re-derive the NPC's screen position
by hand. So the cloak (a) drew in front of her instead of behind, and (b)
landed off-target, because "offset in billboard widths from the projected
tile centre" is not the same as "her shoulder".

FIX
PGR now calls an optional scene hook immediately BEFORE it draws each
encounter-flag billboard:

    scene.onPGRBeforeFlag(ctx, flag, rect)

where rect is the exact destination rectangle of the sprite about to be
drawn -- { x, y, w, h } in canvas pixels, top-left origin. Anything drawn in
that hook is painted first and therefore sits behind the figure, and can be
positioned against her real bounding box rather than a guess.

NpcCloak gains drawAtRect(ctx, rect), which places the cloak as a fraction
of the figure's own box: shoulderX/shoulderY are 0..1 across the sprite, so
0.5/0.28 means "centre, a little below the top of the head" -- i.e. the
shoulders -- and stays correct at every distance as the billboard scales.

ALSO: encounter flags now honour visual.yOffset, a nudge in billboard
heights, for a figure that should stand a little higher or lower than the
tile's south edge puts them.

Run from the repo root:  python3 patch_cloak_anchor.py
Idempotent; aborts without writing if expected text is missing.
"""
import io, os, sys

ROOT = os.getcwd()
def read(p):
    with io.open(os.path.join(ROOT, p), encoding='utf-8') as f: return f.read()
def write(p, s):
    with io.open(os.path.join(ROOT, p), 'w', encoding='utf-8') as f: f.write(s)

def sub_once(src, old, new, label, sentinel=None):
    if sentinel is None:
        added = [ln for ln in new.split('\n') if ln.strip() and ln not in old]
        sentinel = max(added, key=len) if added else None
    if sentinel and sentinel in src:
        print('  = already applied: %s' % label); return src
    if old not in src:
        print('  ! NOT FOUND: %s\n    aborting, nothing written' % label); sys.exit(1)
    if src.count(old) != 1:
        print('  ! AMBIGUOUS (%d matches): %s' % (src.count(old), label)); sys.exit(1)
    print('  + %s' % label)
    return src.replace(old, new, 1)

# ---------------------------------------------------------------------- PGR
P = 'js/game/effects/perspectiveGroundRenderer.js'
src = read(P)
print(P)
OLD = """                const _fLift = _fH * this._scaleAtRow(flag.tileY + 1)
                this._oCtx.globalAlpha = tileAlpha
                this._drawBillboard(this._oCtx, canvas,
                  proj.screenX, proj.screenY - _fLift,
                  proj.scale * this.tileDisplaySize, 1.2)
                this._oCtx.globalAlpha = 1.0"""
NEW = """                const _fLift = _fH * this._scaleAtRow(flag.tileY + 1)
                // visual.yOffset nudges a figure up (negative) or down, in
                // billboard heights, for when the tile's south edge is not
                // quite where they should be standing.
                const _fW    = proj.scale * this.tileDisplaySize
                const _fH2   = _fW * 1.2
                const _fNudge = (flag.visual.yOffset || 0) * _fH2
                const _fX    = proj.screenX
                const _fY    = proj.screenY - _fLift + _fNudge

                this._oCtx.globalAlpha = tileAlpha
                // Hook fired BEFORE the figure is drawn, so anything painted
                // here sits behind her -- cloaks, shadows, held items. The
                // rect is the sprite's exact destination box, so callers can
                // anchor to the body rather than guess from the tile centre.
                this.scene?.onPGRBeforeFlag?.(this._oCtx, flag, {
                  x: _fX - _fW / 2, y: _fY - _fH2, w: _fW, h: _fH2,
                })
                this._drawBillboard(this._oCtx, canvas, _fX, _fY, _fW, 1.2)
                this._oCtx.globalAlpha = 1.0"""
src = sub_once(src, OLD, NEW, 'onPGRBeforeFlag hook + visual.yOffset')
write(P, src)

# ----------------------------------------------------------------- npcCloak
P = 'js/game/effects/npcCloak.js'
src = read(P)
print(P)
OLD = """  /** Call from onPGRDrawComplete(ctx). */
  draw(ctx) {
    if (!this._ready || !ctx) return
    const pgr = this.scene.perspectiveGround
    if (!pgr) return
"""
NEW = """  /**
   * Preferred entry point: call from onPGRBeforeFlag(ctx, flag, rect), which
   * fires just before PGR draws the figure. Two advantages over draw():
   * the cloak lands behind her rather than over her, and `rect` is her real
   * bounding box, so the anchor is her shoulder rather than a guess offset
   * from the tile centre -- and it stays correct as she scales with
   * distance.
   */
  drawAtRect(ctx, rect) {
    if (!this._ready || !ctx || !rect) return
    const { rotation, scaleX, scaleY } = this._advance()

    // shoulderX / shoulderY are fractions of the figure's own box.
    const x = rect.x + rect.w * this.shoulderX
    const y = rect.y + rect.h * this.shoulderY
    const w = rect.w * this.scale

    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.translate(x, y)
    ctx.rotate(rotation)
    ctx.scale(scaleX, scaleY)
    ctx.imageSmoothingEnabled = false
    // Hung from the top-centre of the cloak, so it swings from the shoulders
    // rather than pivoting about its middle.
    ctx.drawImage(this._img, -w / 2, 0, w, w * (this._img.height / this._img.width))
    ctx.restore()
  }

  /** Advance the animation and return this frame's transform. */
  _advance() {
    const now = performance.now()
    const dt  = Math.min(0.1, (now - this._last) / 1000)
    this._last = now
    this._t   += dt

    this._gustAt -= dt
    if (this._gustAt <= 0) { this._gustAt = 5; this._gust = 1e-4 }
    if (this._gust > 0) {
      this._gust += dt * 1.1
      if (this._gust >= 2) this._gust = 0
    }
    const gust = this._gust > 0 ? Math.sin(Math.min(this._gust, 2) * Math.PI / 2) : 0

    const windStrength = Math.max(0.4, Math.min(1, Math.abs(this.wind.x) / 15))
    return {
      rotation: -0.12 * windStrength
              + Math.sin(this._t * 1.1) * 0.05
              + gust * -0.08,
      scaleX: (1 + Math.sin(this._t * 0.9) * 0.1) * (1 + gust * 0.25),
      scaleY:  1 + Math.sin(this._t * 1.3 + 1) * 0.04,
    }
  }

  /** Legacy path: derives position itself, and draws OVER the figure. */
  draw(ctx) {
    if (!this._ready || !ctx) return
    const pgr = this.scene.perspectiveGround
    if (!pgr) return
"""
# Explicit sentinel: the auto-picked one matched a pre-existing comment line
# and silently skipped this step.
src = sub_once(src, OLD, NEW, 'drawAtRect + shared _advance', sentinel='drawAtRect(ctx, rect)')

OLD = """    this.offsetX  = opts.offsetX ?? -0.28
    this.offsetY  = opts.offsetY ?? -0.55"""
NEW = """    this.offsetX  = opts.offsetX ?? -0.28
    this.offsetY  = opts.offsetY ?? -0.55
    // Anchor as a fraction of the figure's own bounding box. 0.5 = centred
    // horizontally; 0.28 = a little below the top of the head, i.e. the
    // shoulders. Scale-independent, so it holds at any distance.
    this.shoulderX = opts.shoulderX ?? 0.5
    this.shoulderY = opts.shoulderY ?? 0.28"""
src = sub_once(src, OLD, NEW, 'shoulder anchor options')
write(P, src)

# -------------------------------------------------------------------- d3Sea
P = 'js/game/scenes/locations/bog/d3Sea.js'
src = read(P)
print(P)
OLD = """      offsetX: -0.28,
      offsetY: -0.55,
      scale:    0.85,"""
NEW = """      shoulderX: 0.5,     // centred on her
      shoulderY: 0.30,    // shoulder height, as a fraction of her sprite
      scale:     0.80,    // cloak width relative to her width"""
src = sub_once(src, OLD, NEW, 'cloak anchored to the shoulder')

OLD = """  onPGRDrawComplete(ctx) {
    if (this.steepFaces) this.steepFaces.update()
    // Drawn after the ground pass so it sits over the terrain, and behind
    // nothing -- PGR has already laid down her billboard by this point, so
    // the cloak reads as being in front of her. Swap the two if it should
    // hang behind: that needs a hook inside PGR's per-row loop instead.
    this.muireannCloak?.draw(ctx)
  }"""
NEW = """  onPGRDrawComplete(ctx) {
    if (this.steepFaces) this.steepFaces.update()
  }

  /**
   * Fired by PGR immediately before it draws an encounter-flag billboard, so
   * whatever is painted here ends up BEHIND the figure. `rect` is the
   * sprite's exact destination box.
   */
  onPGRBeforeFlag(ctx, flag, rect) {
    if (flag?.visual?.gid === MUIREANN_GID) this.muireannCloak?.drawAtRect(ctx, rect)
  }"""
src = sub_once(src, OLD, NEW, 'draw the cloak behind her via the new hook')
write(P, src)

print('\nDone.')
