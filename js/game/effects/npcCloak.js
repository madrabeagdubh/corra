/**
 * npcCloak.js -- a billowing cloak for an NPC drawn as a PGR billboard.
 *
 * Ported from the bow tutorial's Scáthach cape (commit 50ccc32). That
 * version was a Phaser image at fixed screen coordinates; this one draws
 * into PGR's object canvas so it tracks a billboard whose screen position
 * is recomputed every frame from the perspective projection and the
 * heightMap, and so it sorts correctly against the terrain.
 *
 * Usage, from a scene that already implements onPGRDrawComplete:
 *
 *   import NpcCloak from '../../../effects/npcCloak.js'
 *   // in create():
 *   this.muireannCloak = new NpcCloak(this, {
 *     tileX: 13, tileY: 1,
 *     texture: '/assets/cape.png',
 *     offsetX: -0.28,   // in billboard widths, negative = behind/left
 *     offsetY: -0.55,   // negative = up towards the shoulders
 *     wind: { x: -15, y: 5 },
 *   })
 *   // in onPGRDrawComplete(ctx):
 *   this.muireannCloak?.draw(ctx)
 *   // in shutdown():
 *   this.muireannCloak?.destroy(); this.muireannCloak = null
 */
export default class NpcCloak {

  constructor(scene, opts = {}) {
    this.scene    = scene
    this.tileX    = opts.tileX ?? 0
    this.tileY    = opts.tileY ?? 0
    this.offsetX  = opts.offsetX ?? -0.28
    this.offsetY  = opts.offsetY ?? -0.55
    // Anchor as a fraction of the figure's own bounding box. 0.5 = centred
    // horizontally; 0.28 = a little below the top of the head, i.e. the
    // shoulders. Scale-independent, so it holds at any distance.
    this.shoulderX = opts.shoulderX ?? 0.5
    this.shoulderY = opts.shoulderY ?? 0.28

    // Size as a fraction of HER box, not the image's aspect ratio. The
    // source is stretched to fit, so a placeholder with an odd aspect is
    // wrong in colour only, and real art drops in without re-tuning.
    this.widthFrac  = opts.widthFrac  ?? 0.80
    this.heightFrac = opts.heightFrac ?? 0.55

    // Pivot within the cloak itself: 0.5/0 = top centre, so it swings from
    // the shoulders rather than about its middle or a corner.
    this.pivotX = opts.pivotX ?? 0.5
    this.pivotY = opts.pivotY ?? 0.0

    this.debugAnchor = !!opts.debugAnchor
    this.scale    = opts.scale   ?? 0.85      // relative to the billboard
    this.wind     = opts.wind    || { x: -15, y: 5 }
    this.alpha    = opts.alpha   ?? 1

    this._t       = 0
    this._gust    = 0                          // 0..1, eased, drives the gust
    this._gustAt  = 5                          // seconds until the next gust
    this._img     = null
    this._ready   = false
    this._last    = performance.now()

    const img = new Image()
    img.onload  = () => { this._img = img; this._ready = true }
    img.onerror = () => console.error('[NpcCloak] failed to load', opts.texture)
    img.src = opts.texture || '/assets/cape.png'
  }

  /**
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

    // Anchor: where on HER the cloak hangs from.
    const x = rect.x + rect.w * this.shoulderX
    const y = rect.y + rect.h * this.shoulderY

    // Size: fractions of her box. Aspect of the source image is ignored on
    // purpose -- see the constructor note.
    const w = rect.w * this.widthFrac
    const h = rect.h * this.heightFrac

    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.translate(x, y)
    ctx.rotate(rotation)
    ctx.scale(scaleX, scaleY)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this._img, -w * this.pivotX, -h * this.pivotY, w, h)
    ctx.restore()

    if (this.debugAnchor) {
      ctx.save()
      ctx.strokeStyle = 'rgba(0,255,255,0.9)'; ctx.lineWidth = 1
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)      // her box
      ctx.beginPath()
      ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y)
      ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5)
      ctx.strokeStyle = 'rgba(255,0,255,0.95)'
      ctx.stroke()                                        // the anchor point
      ctx.restore()
    }
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

    // --- advance animation ------------------------------------------------
    const now = performance.now()
    const dt  = Math.min(0.1, (now - this._last) / 1000)   // clamp after a stall
    this._last = now
    this._t   += dt

    // Occasional gust: a slow swell and release, the canvas equivalent of
    // the original's yoyo tween.
    this._gustAt -= dt
    if (this._gustAt <= 0) { this._gustAt = 5; this._gust = 1e-4 }
    if (this._gust > 0) {
      this._gust += dt * 1.1
      if (this._gust >= 2) this._gust = 0            // 0..2 == out and back
    }
    const gust = this._gust > 0 ? Math.sin(Math.min(this._gust, 2) * Math.PI / 2) : 0

    // --- where is she on screen this frame? -------------------------------
    // Mirrors the billboard maths in PGR exactly: project the tile centre,
    // then lift by the terrain height sampled at the tile's SOUTH edge.
    const ts   = pgr.tileDisplaySize
    const proj = pgr._projectLogical((this.tileX + 0.5) * ts, (this.tileY + 0.5) * ts)
    if (!proj) return

    const gid = this.scene.mapData?.layers?.[0]?.[this.tileY]?.[this.tileX] ?? 0
    const wet = gid === 1625 || gid === 1679 || gid === 731
    const h   = wet ? 0
      : (pgr._vertexH(this.tileX, this.tileY + 1)
       + pgr._vertexH(this.tileX + 1, this.tileY + 1)) * 0.5
    const lift = h * pgr._scaleAtRow(this.tileY + 1)

    const size = proj.scale * ts
    if (!(size > 1)) return                          // too far to bother

    // --- the original's motion, preserved ---------------------------------
    const windStrength = Math.max(0.4, Math.min(1, Math.abs(this.wind.x) / 15))
    const rotation = -0.12 * windStrength
                   + Math.sin(this._t * 1.1) * 0.05
                   + gust * -0.08
    // NOTE: the original lost this assignment -- the line read
    //   1 + Math.sin(this.capeTime * 0.9) * 0.1;
    // with no `scaleX =`, so the horizontal billow never ran. Restored.
    const scaleX = (1 + Math.sin(this._t * 0.9) * 0.1) * (1 + gust * 0.25)
    const scaleY =  1 + Math.sin(this._t * 1.3 + 1) * 0.04

    const w = size * this.scale
    const x = proj.screenX + this.offsetX * size
    const y = proj.screenY - lift + this.offsetY * size

    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.translate(x, y)
    ctx.rotate(rotation)
    ctx.scale(scaleX, scaleY)
    ctx.imageSmoothingEnabled = false
    // Origin at the top-left, as in the original (setOrigin(0, 0)) -- the
    // cloak hangs from the shoulder rather than pivoting about its middle.
    ctx.drawImage(this._img, 0, 0, w, w * (this._img.height / this._img.width))
    ctx.restore()
  }

  destroy() { this._img = null; this._ready = false }
}
