// steepFaceRenderer.js
// Location: js/game/effects/steepFaceRenderer.js
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Draws grey stone texture over unclimbable, CAMERA-FACING slope tiles,
// without touching PerspectiveGroundRenderer's own draw loop.
//
// ── v12: phantom-mirrored columns now patched too ────────────────────────────
// Every height/steepness lookup here used pgr._tileHeightAt/_vertexH with
// the raw tile column -- both silently return 0 for any out-of-range
// coordinate (confirmed in their own implementations). That meant any
// column west of the true map edge (tx < 0), which PGR's OWN phantom-
// tile system mirrors real ground data into for visual continuity, read
// as flat ground here regardless of the real cliff it was supposed to
// be a continuation of -- so the exact "hollow steep terrain" bug this
// renderer exists to patch went right on happening there, just with no
// patch reaching it. Confirmed via screenshot: a real visible gap in an
// otherwise-continuous cliff, exactly at the phantom boundary.
// Fixed by mirroring the column (via the SAME mirrorIndex the core
// renderer's own phantom-tile system uses) before any height lookup,
// while still using the RAW (possibly negative) column for screen
// projection -- projection math doesn't care about map bounds, only
// real-world distance from the camera, so it needs the true position,
// not the mirrored one.
// Scoped to the WEST margin specifically (PHANTOM_WEST_MARGIN below) --
// that's the reported case; east/south already get real cliff geometry
// suppressed there by _phantomOceanOnly on maps that use it, so there's
// no comparable steep phantom terrain on those edges to patch.
//
// ── v11: fullscreen-toggle fix + occlusion scan removed ──────────────────────
// 1. Canvas sizing now mirrors PGR's OWN ground canvas (#pgr-ground) --
//    both backbuffer size AND CSS style size, checked every frame --
//    instead of the Phaser game canvas. Our draw coordinates come from
//    PGR's projection math, which lives in the ground canvas's
//    coordinate space; on fullscreen toggle PGR resizes its canvases
//    (including devicePixelRatio handling) while the Phaser canvas
//    follows different rules, and the mismatch left this overlay
//    scaled/offset from the terrain (cliff faces visibly detached from
//    their hills after entering fullscreen -- the long-standing
//    fullscreen-drift bug, now explained). The old window resize
//    listener is removed; the per-frame mirror covers it.
// 2. The seenMaxHeight per-column occlusion scan is REMOVED entirely.
//    Testing confirmed back-face culling alone (v10) prevents the
//    original bleed-through the scan was built for, and the scan itself
//    caused a real bug: it suppressed genuinely visible south-facing
//    cliff faces whenever ANY terrain further south in the same column
//    was taller than the face's lower portion -- a static mask can't be
//    correct for a viewer who moves (a face hidden from the south is in
//    plain sight from the hilltop). Camera-facing + steep is now the
//    whole test.
//
// ── v10: back-face culling ────────────────────────────────────────────────────
// Only tiles whose north edge is higher than their south edge (a
// south-facing slope, toward the camera -- the camera direction is
// fixed south-to-north in this projection) are drawn. Far-side slopes
// face away and are covered by the plateau in PGR's own painter-ordered
// render; drawing them here was what caused rock to bleed over hilltops
// ("hollow hills").
//
// KNOWN LIMITATION: a cliff face oriented purely east/west (no
// north-south gradient across its tiles) won't be detected as
// camera-facing and won't get rock texture. Irrelevant for radial
// hills; revisit if a map has long north-south-running walls.
//
// ── Why an overlay, not a PGR core edit ──────────────────────────────────────
// Editing PGR's shared per-tile draw loop would touch code every scene
// depends on. This module redraws only qualifying tiles' trapezoids
// (using PGR's own projection helpers, called but never modified) on
// top, leaving PGR untouched.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   import SteepFaceRenderer from '../../effects/steepFaceRenderer.js'
//   this.steepFaces = new SteepFaceRenderer(this)
//   // each frame, from onPGRDrawComplete():
//   this.steepFaces.update()
//   // in shutdown():
//   if (this.steepFaces) { this.steepFaces.destroy(); this.steepFaces = null }

import { mirrorIndex } from './pgr/pgrShared.js'

export default class SteepFaceRenderer {

  static STONE_TILE_SIZE = 96
  static FALLBACK_CLIMB_THRESHOLD = 0.6
  // Minimum north-over-south edge height difference for a tile to count
  // as camera-facing -- filters out effectively-flat tiles.
  static FACING_EPSILON = 0.01
  // How many columns west of the true map edge to patch -- see v12
  // header note. Bumped way up from an initial guess of 10: rows near
  // the horizon (like the north bank, sitting at rows 0-5) are exactly
  // where perspective compression means the CORE renderer's own phantom
  // system needs far more columns of coverage than a near/player-row
  // view would -- 10 wasn't enough there, leaving a real gap further
  // out than the patch reached (confirmed via screenshot). Cost is
  // cheap regardless (bounded per-frame column scan, same reasoning PGR
  // itself uses for its own EDGE_EXTEND/horizon column counts), so
  // erring generously large costs little.
  static PHANTOM_WEST_MARGIN = 80

  constructor(scene) {
    this.scene = scene
    this._sw = scene.game.canvas.width
    this._sh = scene.game.canvas.height

    const container = scene.game.canvas.parentNode
    this._canvas = document.createElement('canvas')
    this._canvas.id = 'steep-face-overlay'
    this._canvas.width  = this._sw
    this._canvas.height = this._sh
    this._canvas.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      'z-index:2', 'pointer-events:none',
      'image-rendering:pixelated', 'image-rendering:crisp-edges',
    ].join(';')
    container.appendChild(this._canvas)
    this._ctx = this._canvas.getContext('2d')
    this._ctx.imageSmoothingEnabled = false

    this._stoneTexture = this._bakeStoneTexture()

    this._frontFaceMask = null
    this._maskHeightMapRef = null

    console.log('[SteepFaceRenderer] constructed -', this._sw, 'x', this._sh)
  }

  _bakeStoneTexture() {
    const size = SteepFaceRenderer.STONE_TILE_SIZE
    const tile = document.createElement('canvas')
    tile.width = size
    tile.height = size
    const c = tile.getContext('2d')

    c.fillStyle = 'rgba(120, 118, 112, 1)'
    c.fillRect(0, 0, size, size)

    let seed = 5151
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

    const blobPass = (count, minR, maxR, dark, light) => {
      for (let i = 0; i < count; i++) {
        const cx = rand() * size, cy = rand() * size
        const r  = minR + rand() * (maxR - minR)
        c.fillStyle = rand() < 0.5 ? dark : light
        c.beginPath()
        c.arc(cx, cy, r, 0, Math.PI * 2)
        c.fill()
      }
    }
    blobPass(9,  10, 22, 'rgba(84, 82, 78, 0.4)',  'rgba(158, 154, 146, 0.28)')
    blobPass(14, 4,  12, 'rgba(70, 68, 64, 0.35)', 'rgba(170, 166, 158, 0.22)')

    c.strokeStyle = 'rgba(40, 38, 34, 0.45)'
    c.lineWidth = 1
    for (let i = 0; i < 8; i++) {
      let x = rand() * size, y = rand() * size
      c.beginPath()
      c.moveTo(x, y)
      const segs = 3 + Math.floor(rand() * 3)
      for (let s = 0; s < segs; s++) {
        x += (rand() - 0.5) * 18
        y += (rand() - 0.5) * 18
        c.lineTo(x, y)
      }
      c.stroke()
    }

    return tile
  }

  _getClimbThreshold() {
    return this.scene?.constructor?.CLIMB_MAX_STEP ?? SteepFaceRenderer.FALLBACK_CLIMB_THRESHOLD
  }

  // Deliberately LOWER than the collision threshold above, and used ONLY
  // for "does this tile qualify for stone texture" -- never for
  // gameplay collision, which keeps using _getClimbThreshold() unchanged
  // everywhere else. A smoothly-generated height field can have narrow
  // local dips where steepness briefly drops just under the collision
  // threshold even while flanked by clearly-qualifying steep neighbours
  // on both sides -- confirmed directly: a real, isolated 3-column dip
  // (steepness 0.53-0.58 against a 0.6 threshold) produced a visible
  // "hole" of missing stone in an otherwise continuous cliff. Lowering
  // the VISUAL bar closes gaps like that without loosening what the
  // player can actually walk up.
  _getVisualSteepnessThreshold() {
    return this._getClimbThreshold() * 0.7
  }

  // Checks all EIGHT neighbours (cardinal + diagonal) -- matches
  // isSlopeBlocked's own collision relationship, movement being
  // 8-directional. tx/ty may be OUT OF [0,mapW)/[0,mapH) range (phantom
  // columns/rows) -- mirrored before every height lookup (see v12 header
  // note) so phantom coordinates read the real cliff data they're a
  // continuation of, rather than silently reading as flat (0).
  _tileSteepness(pgr, tx, ty, mapW, mapH) {
    const mtx = mirrorIndex(tx, mapW)
    const thisH = pgr._tileHeightAt(mtx, ty)
    let maxDiff = 0
    const neighbours = [
      [tx, ty - 1], [tx, ty + 1], [tx - 1, ty], [tx + 1, ty],
      [tx - 1, ty - 1], [tx + 1, ty - 1], [tx - 1, ty + 1], [tx + 1, ty + 1],
    ]
    for (const [nx, ny] of neighbours) {
      if (ny < 0 || ny >= mapH) continue
      const mnx = mirrorIndex(nx, mapW)
      const diff = Math.abs(thisH - pgr._tileHeightAt(mnx, ny))
      if (diff > maxDiff) maxDiff = diff
    }
    return maxDiff
  }

  // Camera-facing test: the camera looks south-to-north in this
  // projection, so a visible slope is one whose NORTH edge is higher
  // than its SOUTH edge. Far-side (north-descending) slopes face away
  // and are covered by nearer terrain in PGR's own render. tx mirrored
  // before lookup, same reasoning as _tileSteepness above.
  _facesCamera(pgr, tx, ty, mapW) {
    const mtx = mirrorIndex(tx, mapW)
    const northEdge = (pgr._vertexH(mtx, ty)     + pgr._vertexH(mtx + 1, ty))     / 2
    const southEdge = (pgr._vertexH(mtx, ty + 1) + pgr._vertexH(mtx + 1, ty + 1)) / 2
    return northEdge - southEdge > SteepFaceRenderer.FACING_EPSILON
  }

  // Steep + camera-facing is the whole test -- see v11 header for why
  // the old per-column occlusion scan was removed.
  _getFrontFaceMask(pgr, mapW, mapH) {
    const hm = pgr._heightMapSrc
    if (this._frontFaceMask && this._maskHeightMapRef === hm) return this._frontFaceMask

    const climbThreshold = this._getClimbThreshold()
    const visualThreshold = this._getVisualSteepnessThreshold()
    const mask = []
    for (let ty = 0; ty < mapH; ty++) mask.push(new Uint8Array(mapW))

    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        const steepness = this._tileSteepness(pgr, tx, ty, mapW, mapH)
        if (steepness > visualThreshold && this._facesCamera(pgr, tx, ty, mapW)) {
          mask[ty][tx] = 1
        }
      }
    }

    this._frontFaceMask = mask
    this._maskHeightMapRef = hm
    console.log('[SteepFaceRenderer] front-face mask (re)computed -- climb threshold:', climbThreshold)
    return mask
  }

  // Draws one qualifying tile's stone trapezoid + darken overlay. tx is
  // the RAW (possibly negative, for phantom columns) world column used
  // for screen projection; mtx is its MIRRORED equivalent used for
  // height lookups. Factored out of update()'s main loop so the
  // phantom-column pass (_drawPhantomWestFaces) can reuse it without
  // duplicating the drawing math.
  _drawFaceTile(pgr, ctx, tx, mtx, ty, horizonPx, sw, sh, climbThreshold, mapW, mapH) {
    const h00 = pgr._vertexH(mtx,     ty)
    const h10 = pgr._vertexH(mtx + 1, ty)
    const h01 = pgr._vertexH(mtx,     ty + 1)
    const h11 = pgr._vertexH(mtx + 1, ty + 1)

    const yTopRaw = pgr._rowToScreenY(ty)
    const yBotRaw = pgr._rowToScreenY(ty + 1)
    if (yBotRaw == null) return
    const yTopClamped = (yTopRaw == null || yTopRaw < horizonPx) ? horizonPx : yTopRaw
    const yBotClamped = Math.min(sh + 50, yBotRaw)
    if (yBotClamped <= yTopClamped) return

    const xTL = pgr._colToScreenX(tx,     ty)
    const xTR = pgr._colToScreenX(tx + 1, ty)
    const xBL = pgr._colToScreenX(tx,     ty + 1)
    const xBR = pgr._colToScreenX(tx + 1, ty + 1)
    if (xTL == null) return
    if (Math.max(xTL, xTR, xBL, xBR) < -20) return
    if (Math.min(xTL, xTR, xBL, xBR) > sw + 20) return

    const sTop = pgr._scaleAtRow(ty)
    const sBot = pgr._scaleAtRow(ty + 1)
    const yTL = yTopClamped - h00 * sTop
    const yTR = yTopClamped - h10 * sTop
    const yBL = yBotClamped - h01 * sBot
    const yBR = yBotClamped - h11 * sBot

    const W = SteepFaceRenderer.STONE_TILE_SIZE
    const H = SteepFaceRenderer.STONE_TILE_SIZE

    pgr._drawAffineTriangle(ctx, this._stoneTexture,
      { u: 0, v: 0 }, { u: W, v: 0 }, { u: W, v: H },
      { x: xTL, y: yTL }, { x: xTR, y: yTR }, { x: xBR, y: yBR })
    pgr._drawAffineTriangle(ctx, this._stoneTexture,
      { u: 0, v: 0 }, { u: W, v: H }, { u: 0, v: H },
      { x: xTL, y: yTL }, { x: xBR, y: yBR }, { x: xBL, y: yBL })

    const steepness = this._tileSteepness(pgr, tx, ty, mapW, mapH)
    const darkenT = Math.min(1, (steepness - climbThreshold) / (climbThreshold * 1.5 || 1))
    if (darkenT > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(xTL, yTL); ctx.lineTo(xTR, yTR); ctx.lineTo(xBR, yBR); ctx.lineTo(xBL, yBL)
      ctx.closePath()
      ctx.clip()
      ctx.fillStyle = `rgba(20, 18, 16, ${(darkenT * 0.35).toFixed(3)})`
      ctx.fillRect(
        Math.min(xTL, xBL) - 4, Math.min(yTL, yTR) - 4,
        Math.max(xTR, xBR) - Math.min(xTL, xBL) + 8,
        Math.max(yBL, yBR) - Math.min(yTL, yTR) + 8
      )
      ctx.restore()
    }
  }

  // Phantom-west pass: same qualifying test (steep + camera-facing) as
  // the main mask, computed fresh per-tile rather than cached (a small,
  // bounded margin -- not worth a second mask structure with negative
  // indices). See v12 header note for why this exists at all.
  _drawPhantomWestFaces(pgr, ctx, mapW, mapH, horizonPx, sw, sh, climbThreshold, rowStart, rowEnd) {
    const margin = SteepFaceRenderer.PHANTOM_WEST_MARGIN
    const visualThreshold = this._getVisualSteepnessThreshold()
    for (let ty = rowStart; ty <= rowEnd; ty++) {
      for (let tx = -margin; tx < 0; tx++) {
        const mtx = mirrorIndex(tx, mapW)
        if (!(this._tileSteepness(pgr, tx, ty, mapW, mapH) > visualThreshold && this._facesCamera(pgr, tx, ty, mapW))) continue
        this._drawFaceTile(pgr, ctx, tx, mtx, ty, horizonPx, sw, sh, climbThreshold, mapW, mapH)
      }
    }
  }

  update() {
    const pgr = this.scene.perspectiveGround
    if (!pgr?._heightMapSrc) return

    // Mirror PGR's own ground canvas exactly -- backbuffer size AND CSS
    // size -- rather than the Phaser game canvas. Our draw coordinates
    // come from PGR's projection math, which lives in the ground
    // canvas's coordinate space; on fullscreen toggle PGR resizes its
    // canvases (including devicePixelRatio handling) while the Phaser
    // canvas follows different rules, and the mismatch left this
    // overlay scaled/offset from the terrain.
    const groundCanvas = document.getElementById('pgr-ground')
    if (groundCanvas) {
      if (groundCanvas.width !== this._sw || groundCanvas.height !== this._sh) {
        this._sw = groundCanvas.width
        this._sh = groundCanvas.height
        this._canvas.width  = this._sw
        this._canvas.height = this._sh
      }
      if (this._canvas.style.width  !== groundCanvas.style.width ||
          this._canvas.style.height !== groundCanvas.style.height) {
        this._canvas.style.width  = groundCanvas.style.width
        this._canvas.style.height = groundCanvas.style.height
      }
    }

    const sw = this._sw, sh = this._sh
    const ctx = this._ctx
    ctx.clearRect(0, 0, sw, sh)

    const mapData = this.scene.mapData
    const mapW = mapData?.width ?? 0
    const mapH = mapData?.height ?? 0
    if (!mapW || !mapH) return

    const mask = this._getFrontFaceMask(pgr, mapW, mapH)
    const climbThreshold = this._getClimbThreshold()

    const horizonPx = pgr._horizonPx?.() ?? 0
    const camRow = pgr._perspCamRow?.() ?? mapH
    const rowStart = Math.max(0, Math.floor(camRow - 40))
    const rowEnd   = Math.min(mapH - 1, Math.floor(camRow) - 1)

    for (let ty = rowStart; ty <= rowEnd; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        if (!mask[ty][tx]) continue
        this._drawFaceTile(pgr, ctx, tx, tx, ty, horizonPx, sw, sh, climbThreshold, mapW, mapH)
      }
    }

    this._drawPhantomWestFaces(pgr, ctx, mapW, mapH, horizonPx, sw, sh, climbThreshold, rowStart, rowEnd)
  }

  destroy() {
    if (this._canvas?.parentNode) this._canvas.parentNode.removeChild(this._canvas)
    this._canvas = null
    this._ctx = null
  }
}

