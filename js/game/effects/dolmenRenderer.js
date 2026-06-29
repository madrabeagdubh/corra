// dolmenRenderer.js
// Location: js/game/effects/dolmenRenderer.js
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Renders the lagoon map's dolmen -- a single, bespoke, hero-scale
// megalith (multiple leaning support stones + one tilted capstone), NOT
// a repeated procedural obstacle type. Kept as its own module rather than
// folded into UndergrowthRenderer's KINDS system, since that system is
// built for many similar small repeated things (rocks/roots/brambles)
// derived live from wallMask -- this is one specific, hand-composed
// object with its own fixed position and shape data.
//
// ── Why a new "leaning box" primitive ────────────────────────────────────────
// Every box drawn so far (UndergrowthRenderer's rocks/roots/brambles) is
// a perfectly vertical, axis-aligned prism -- top face directly above
// the base, same footprint top and bottom. A real dolmen needs stones
// that visibly LEAN (top face horizontally offset from the base) to read
// as ancient/settled rather than a tidy modern structure. This module
// generalizes the box-drawing technique with a lean offset applied to
// the top face's projected position, plus an independent capstone slab
// that can tilt (its own top/bottom faces non-parallel to the ground)
// rather than just being raised straight up.
//
// ── Composition data ──────────────────────────────────────────────────────────
// STONES and CAPSTONE below encode one specific hand-designed
// arrangement (irregular triangle of 3 support stones, asymmetric
// capstone overhang) -- agreed via a top-down/side concept sketch before
// writing this renderer. All position/size values are in TILE units,
// relative to a single anchor point (the dolmen's centre tile in the
// lagoon map), not derived from wallMask or any procedural placement.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   import DolmenRenderer from '../../effects/dolmenRenderer.js'
//   this.dolmen = new DolmenRenderer(this, ctx, { anchorX: 12, anchorY: 10 })
//   // each frame, alongside forestEffects/undergrowth updates:
//   this.dolmen.update(pgr, sw, sh)

const STONES = [
  // x, y: offset from anchor, in tiles. footprint: base radius, tiles.
  // height: vertical extent, tiles. leanX/leanY: how far the TOP shifts
  // sideways relative to the base, in tiles -- 0 = perfectly vertical.
  // Values pushed noticeably further than a first concept sketch, which
  // rendered too subtly to read as "leaning" at normal viewing scale --
  // confirmed visually via a flat side-view mockup before this was built
  // for real: small lean offsets just looked like straight pillars.
  { name: 'stoneA', x: -1.3, y: -0.4, footprint: 0.9,  height: 3.4, leanX:  0.65, leanY:  0.2,
    colorTop: 'rgba(92,88,80,0.95)', colorFace: 'rgba(56,52,46,0.95)', colorSide: 'rgba(40,37,32,0.95)' },
  { name: 'stoneB', x: -0.5, y:  0.9, footprint: 0.85, height: 3.1, leanX: -0.35, leanY:  0.55,
    colorTop: 'rgba(86,82,75,0.95)', colorFace: 'rgba(52,48,43,0.95)', colorSide: 'rgba(37,34,30,0.95)' },
  { name: 'stoneC', x:  1.6, y:  0.2, footprint: 0.6,  height: 2.5, leanX: -0.85, leanY: -0.25,
    colorTop: 'rgba(98,94,86,0.95)', colorFace: 'rgba(60,56,50,0.95)', colorSide: 'rgba(43,40,35,0.95)' },
]

const CAPSTONE = {
  // Centre roughly above the stones' centroid, shifted toward the
  // closer A/B pair -- asymmetric overhang toward stoneC's side
  // suggests settling/shifting over time rather than original level
  // construction.
  x: -0.3, y: 0.2,
  width: 4.6, depth: 2.8, thickness: 0.65,
  restHeight: 2.9,    // height of the capstone's underside above ground
  tiltX: 0.5,         // tilt of the slab's own top surface, tile-units of rise across its width
  tiltY: -0.25,
  colorTop:  'rgba(104,99,90,0.95)',
  colorFace: 'rgba(62,58,52,0.95)',
  colorSide: 'rgba(46,43,38,0.95)',
}

export default class DolmenRenderer {

  // anchorX/anchorY: the dolmen's centre point, in TILE coordinates on
  // the owning map (e.g. the lagoon's island/stepping-stone destination
  // tile). ctx: shared 2D canvas context, same sharing pattern as
  // UndergrowthRenderer (pass ForestEffects' own ctx to avoid a second
  // DOM canvas layer).
  constructor(scene, ctx, { anchorX, anchorY }) {
    this.scene = scene
    this._ctx  = ctx
    this._anchorX = anchorX
    this._anchorY = anchorY
    console.log('[DolmenRenderer] constructed at tile', anchorX, anchorY, '--', STONES.length, 'stones + 1 capstone')
  }

  update(pgr, sw, sh) {
    if (!pgr) return
    const ctx = this._ctx

    for (const stone of STONES) {
      this._drawLeaningStone(pgr, ctx, stone, sw, sh)
    }
    this._drawCapstone(pgr, ctx, CAPSTONE, sw, sh)
  }

  // Bilinear terrain height lookup at a fractional tile position --
  // identical technique to UndergrowthRenderer's terrainH helper, kept
  // local here rather than imported/shared since this module has no
  // other dependency on UndergrowthRenderer and duplicating one small
  // helper seemed preferable to creating a cross-module coupling for it.
  _terrainHeight(pgr, px, py) {
    const x0i = Math.floor(px), y0i = Math.floor(py)
    const fx = px - x0i, fy = py - y0i
    const h00 = pgr._vertexH?.(x0i,     y0i)     ?? 0
    const h10 = pgr._vertexH?.(x0i + 1, y0i)     ?? 0
    const h01 = pgr._vertexH?.(x0i,     y0i + 1) ?? 0
    const h11 = pgr._vertexH?.(x0i + 1, y0i + 1) ?? 0
    return h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy)
         + h01 * (1 - fx) * fy       + h11 * fx * fy
  }

  // Draws one leaning stone: base footprint projected at ground level
  // (terrain-height-adjusted), top footprint projected at the SAME tile
  // position PLUS the lean offset (so the top sits at a different world
  // position than the base, not just higher up) -- this is what produces
  // a genuine lean rather than a vertical pillar. Drawn as a simplified
  // 3-face box (top + front + one side, matching UndergrowthRenderer's
  // simplification rationale -- the camera never sees the unlit far/back
  // faces from this fixed viewing angle).
  _drawLeaningStone(pgr, ctx, stone, sw, sh) {
    const ax = this._anchorX + stone.x
    const ay = this._anchorY + stone.y
    const half = stone.footprint

    // Base footprint corners (tile space).
    const bx0 = ax - half, bx1 = ax + half
    const by0 = ay - half, by1 = ay + half

    const baseTL = this._projectGround(pgr, bx0, by0)
    const baseTR = this._projectGround(pgr, bx1, by0)
    const baseBL = this._projectGround(pgr, bx0, by1)
    const baseBR = this._projectGround(pgr, bx1, by1)
    if (!baseTL || !baseTR || !baseBL || !baseBR) return

    const safeSw = sw ?? 99999, safeSh = sh ?? 99999
    const xs = [baseTL.x, baseTR.x, baseBL.x, baseBR.x]
    const ys = [baseTL.y, baseTR.y, baseBL.y, baseBR.y]
    if (Math.max(...xs) < -300 || Math.min(...xs) > safeSw + 300) return
    if (Math.max(...ys) < -300 || Math.min(...ys) > safeSh + 300) return

    // Top footprint: SAME shape, projected at (ax+leanX, ay+leanY)
    // instead of (ax, ay) -- this is the lean. Height offset still
    // applies on top of this shifted position.
    const tax = ax + stone.leanX, tay = ay + stone.leanY
    const tx0 = tax - half * 0.75, tx1 = tax + half * 0.75   // slight taper: top narrower than base
    const ty0 = tay - half * 0.75, ty1 = tay + half * 0.75

    const topGroundTL = this._projectGround(pgr, tx0, ty0)
    const topGroundTR = this._projectGround(pgr, tx1, ty0)
    const topGroundBL = this._projectGround(pgr, tx0, ty1)
    const topGroundBR = this._projectGround(pgr, tx1, ty1)
    if (!topGroundTL || !topGroundTR || !topGroundBL || !topGroundBR) return

    const sTop = pgr._scaleAtRow?.(ty0) ?? 0
    const sBot = pgr._scaleAtRow?.(ty1) ?? 0
    const topTL = { x: topGroundTL.x, y: topGroundTL.y - stone.height * sTop }
    const topTR = { x: topGroundTR.x, y: topGroundTR.y - stone.height * sTop }
    const topBL = { x: topGroundBL.x, y: topGroundBL.y - stone.height * sBot }
    const topBR = { x: topGroundBR.x, y: topGroundBR.y - stone.height * sBot }

    // West + east + front faces connect BASE corners to the (leaned,
    // tapered) TOP corners -- since top and base no longer share the
    // same x/y, these faces are naturally non-rectangular trapezoids,
    // which is correct/desired (a leaning stone's side face IS slanted).
    // NOTE: an east face was MISSING from the first version of this
    // method -- only west+front+top were drawn, leaving a genuinely
    // empty gap wherever the camera angle exposed the east side (visible
    // in testing on the smaller, more off-centre stone). Same class of
    // bug already fixed once in UndergrowthRenderer's boxes; same fix
    // applied here.
    this._fillQuad(ctx, topTL, topBL, baseBL, baseTL, stone.colorSide)   // west
    this._fillQuad(ctx, topTR, topBR, baseBR, baseTR, stone.colorSide)   // east
    this._fillQuad(ctx, topBL, topBR, baseBR, baseBL, stone.colorFace)   // front (south)
    this._fillQuad(ctx, topTL, topTR, topBR, topBL, stone.colorTop)      // top
  }

  // Draws the capstone as a tilted slab: its underside sits at
  // restHeight above ground, its own top surface rises by tiltX/tiltY
  // across its width/depth (NOT parallel to the ground) -- giving a
  // visibly uneven, settled appearance rather than a level table-top.
  _drawCapstone(pgr, ctx, cap, sw, sh) {
    const ax = this._anchorX + cap.x
    const ay = this._anchorY + cap.y
    const hw = cap.width / 2, hd = cap.depth / 2

    const x0 = ax - hw, x1 = ax + hw
    const y0 = ay - hd, y1 = ay + hd

    const gTL = this._projectGround(pgr, x0, y0)
    const gTR = this._projectGround(pgr, x1, y0)
    const gBL = this._projectGround(pgr, x0, y1)
    const gBR = this._projectGround(pgr, x1, y1)
    if (!gTL || !gTR || !gBL || !gBR) return

    const safeSw = sw ?? 99999, safeSh = sh ?? 99999
    const xs = [gTL.x, gTR.x, gBL.x, gBR.x]
    const ys = [gTL.y, gTR.y, gBL.y, gBR.y]
    if (Math.max(...xs) < -300 || Math.min(...xs) > safeSw + 300) return
    if (Math.max(...ys) < -300 || Math.min(...ys) > safeSh + 300) return

    const sTop = pgr._scaleAtRow?.(y0) ?? 0
    const sBot = pgr._scaleAtRow?.(y1) ?? 0

    // Underside corners -- flat at restHeight (the capstone rests ON
    // the leaning stones at roughly this height; underside itself stays
    // level since that's where it contacts the supports).
    const underTL = { x: gTL.x, y: gTL.y - cap.restHeight * sTop }
    const underTR = { x: gTR.x, y: gTR.y - cap.restHeight * sTop }
    const underBL = { x: gBL.x, y: gBL.y - cap.restHeight * sBot }
    const underBR = { x: gBR.x, y: gBR.y - cap.restHeight * sBot }

    // Top surface -- thickness PLUS tiltX/tiltY applied per-corner, so
    // the slab is visibly thicker/higher on one side than the other.
    const topH_TL = cap.restHeight + cap.thickness - cap.tiltX * 0.5 - cap.tiltY * 0.5
    const topH_TR = cap.restHeight + cap.thickness + cap.tiltX * 0.5 - cap.tiltY * 0.5
    const topH_BL = cap.restHeight + cap.thickness - cap.tiltX * 0.5 + cap.tiltY * 0.5
    const topH_BR = cap.restHeight + cap.thickness + cap.tiltX * 0.5 + cap.tiltY * 0.5

    const topTL = { x: gTL.x, y: gTL.y - topH_TL * sTop }
    const topTR = { x: gTR.x, y: gTR.y - topH_TR * sTop }
    const topBL = { x: gBL.x, y: gBL.y - topH_BL * sBot }
    const topBR = { x: gBR.x, y: gBR.y - topH_BR * sBot }

    // Underside (visible from below if camera angle allows -- usually
    // not, but cheap insurance), west/east edge faces (the slab's own
    // thickness, visible from an angled view of a wide flat capstone --
    // missing from a first version, same class of gap as the stones'
    // missing east face), front face, top face.
    this._fillQuad(ctx, underTL, underTR, underBR, underBL, cap.colorSide)
    this._fillQuad(ctx, topTL, underTL, underBL, topBL, cap.colorSide)   // west edge
    this._fillQuad(ctx, topTR, underTR, underBR, topBR, cap.colorSide)   // east edge
    this._fillQuad(ctx, underBL, underBR, topBR, topBL, cap.colorFace)
    this._fillQuad(ctx, topTL, topTR, topBR, topBL, cap.colorTop)
  }

  // Projects a tile-space ground point, adjusted for terrain height
  // (heightMap), same approach UndergrowthRenderer uses for obstacle
  // bases -- so the dolmen sits correctly on the lagoon's undulating/
  // sunken terrain rather than floating at flat height.
  _projectGround(pgr, tileX, tileY) {
    const y = pgr._rowToScreenY?.(tileY)
    if (y == null) return null
    const x = pgr._colToScreenX?.(tileX, tileY)
    if (x == null) return null
    const scale = pgr._scaleAtRow?.(tileY) ?? 0
    const h = this._terrainHeight(pgr, tileX, tileY)
    return { x, y: y - h * scale }
  }

  _fillQuad(ctx, p1, p2, p3, p4, fillStyle) {
    ctx.fillStyle = fillStyle
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.lineTo(p3.x, p3.y)
    ctx.lineTo(p4.x, p4.y)
    ctx.closePath()
    ctx.fill()
  }

  destroy() {
    this._ctx = null
  }
}

