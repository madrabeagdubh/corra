// forestEffects.js
// Location: js/game/effects/forestEffects.js
//
// ── Purpose ───────────────────────────────────────────────────────────────────
// Forest-interior-specific atmosphere, kept OUT of PerspectiveGroundRenderer
// (which is already large) per the same pattern as distantRain.js,
// stormOverlay.js, starfield.js etc. -- standalone effect modules that a
// scene opts into explicitly.
//
// ── What this does ────────────────────────────────────────────────────────────
// Renders a canopy texture as a DOM canvas layered ABOVE PGR's own canvases,
// with a soft circular cutout ("hole") centred on the player's screen
// position each frame. The canopy can be as visually dense/imposing as we
// want without ever blocking the gameplay space around the player --
// floor, paths, trunks stay visible through the cutout.
//
// This is the inverse of PGR's existing _lightDiv mechanism (which darkens
// outward from the player via a radial gradient). Here we ERASE outward
// from the player via globalCompositeOperation = 'destination-out', cut
// into a canopy texture/fill rather than into raw darkness.
//
// ── What this does NOT do ─────────────────────────────────────────────────────
//   • Does not touch PerspectiveGroundRenderer source at all
//   • Does not know about tile GIDs, walls, or collision
//   • Does not manage its own update loop -- the owning scene calls update()
//     once per frame, same as it already does for perspectiveGround.update()
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   import ForestEffects from '../../effects/forestEffects.js'
//   // after this.perspectiveGround exists (i.e. after drawTilemap()):
//   this.forestEffects = new ForestEffects(this)
//   // each frame, after perspectiveGround.update():
//   this.forestEffects.update()
//   // in shutdown():
//   if (this.forestEffects) { this.forestEffects.destroy(); this.forestEffects = null }

export default class ForestEffects {

  // Soft cutout radius as a fraction of screen diagonal. Previous value
  // (0.32) was far too large on a tall portrait screen -- with the player
  // sitting low on screen, only the circle's upper arc was visible at all,
  // which is exactly the "floating circle in the sky" symptom seen in
  // testing. Shrunk substantially so the whole circle fits around the
  // player with room to spare.
  static HOLE_RADIUS_FRAC = 0.11

  // How much of the hole's radius is fully transparent vs. fading out.
  // 0 = fades from centre; closer to 1 = mostly solid hole with a thin
  // soft edge. Soft circle per current direction -> keep this fairly low.
  static HOLE_INNER_FRAC = 0.15

  // Canopy fill -- placeholder mottled texture (baked once, tiled via
  // ctx.fillStyle = pattern). Swap for real canopy art later; this just
  // proves the layering/cutout mechanic with something foliage-ish rather
  // than a flat color block.
  static CANOPY_BASE_COLOR  = 'rgba(10, 26, 12, 1)'
  static CANOPY_MOTTLE_DARK = 'rgba(4, 14, 6, 0.55)'
  static CANOPY_MOTTLE_LIGHT= 'rgba(34, 58, 24, 0.35)'
  static CANOPY_TILE_SIZE   = 128   // px, pattern repeat size

  // ── Floor tint for wall cells ──────────────────────────────────────────────
  // Without this, the ground is one unbroken grass rectangle regardless of
  // the wall mask -- trunks alone don't read as "negative space" if the
  // floor underneath doesn't change too. Dark wash painted over wall-cell
  // floor positions, projected the same way trunks are.
  static WALL_FLOOR_TINT = 'rgba(6, 10, 5, 0.78)'

  // Trunks are derived LIVE from scene.mapData.wallMask in the constructor
  // (see _bakeTrunkShapesFromMask) rather than a hardcoded position list.
  // Only wall cells bordering at least one open floor cell get a trunk --
  // see _bakeTrunkShapesFromMask for why.

  static TRUNK_BASE_HEIGHT_TILES = 1.6   // was 3.2 -- shorter so trunks block less view
  static TRUNK_BASE_WIDTH_TILES  = 0.45  // slightly slimmer

  // Canopy occupies the top portion of the screen only -- NOT the whole
  // screen. Earlier versions filled the entire canvas and relied on the
  // player-centred cutout circle alone to "feel" restrained, which the user
  // correctly identified as still reading as fullscreen (because it WAS --
  // the fill genuinely covered every pixel; only a small circle around the
  // player was ever cleared). This fraction is how much of the screen
  // height the canopy band occupies, anchored to the top.
  static CANOPY_BAND_FRAC = 0.34

  // How much of the band's bottom edge fades to transparent, as a fraction
  // of the band's own height -- avoids a hard horizontal seam where canopy
  // ends and open view begins.
  static CANOPY_BAND_FADE_FRAC = 0.4

  // ── Species presets ────────────────────────────────────────────────────────
  // Irish native trees with genuinely distinct silhouettes, expressed via
  // stroke-drawing parameters rather than sprite art. Each trunk picks one
  // species deterministically (seeded by position) so the look is varied
  // but stable across reloads.
  static SPECIES = {
    oak: {
      // thick, gnarled, dark -- the original look, kept as baseline
      colorDark: 'rgba(18, 14, 10, 0.95)',
      colorRim:  'rgba(58, 48, 30, 0.55)',
      stemCountMin: 2, stemCountMax: 4,
      widthMul: 1.0, curveMul: 1.0, branchChance: 0.55,
    },
    birch: {
      // pale bark, thin, often multi-stemmed, straighter than oak
      colorDark: 'rgba(168, 160, 142, 0.92)',
      colorRim:  'rgba(80, 72, 58, 0.6)',
      stemCountMin: 2, stemCountMax: 3,
      widthMul: 0.55, curveMul: 0.4, branchChance: 0.3,
    },
    rowan: {
      // slender, medium brown, gentle curve, rounder branching
      colorDark: 'rgba(58, 40, 26, 0.92)',
      colorRim:  'rgba(110, 84, 50, 0.5)',
      stemCountMin: 1, stemCountMax: 2,
      widthMul: 0.7, curveMul: 0.8, branchChance: 0.5,
    },
    yew: {
      // very dark, dense, twisted, reads as a mass rather than distinct stems
      colorDark: 'rgba(10, 12, 8, 0.97)',
      colorRim:  'rgba(30, 36, 22, 0.4)',
      stemCountMin: 3, stemCountMax: 5,
      widthMul: 1.15, curveMul: 1.3, branchChance: 0.2,
    },
    hazel: {
      // many thin stems fanning from one base, no dominant trunk
      colorDark: 'rgba(54, 42, 28, 0.9)',
      colorRim:  'rgba(96, 78, 48, 0.45)',
      stemCountMin: 4, stemCountMax: 6,
      widthMul: 0.35, curveMul: 0.7, branchChance: 0.15,
    },
  }
  static SPECIES_KEYS = Object.keys(ForestEffects.SPECIES)

  // South-of-player trunk fade: trunks between the player and the camera
  // (higher tile row than the player) are faded, not erased, so the player
  // is never lost behind a tree without making that tree disappear
  // outright. Replaces an earlier approach (PLAYER_CLEAR_RADIUS_PX +
  // _punchHole) that fully erased trunks near the player regardless of
  // which side of the player they were on.
  static SOUTH_FADE_RANGE_TILES = 2.5   // how many tiles south of the player are affected
  static SOUTH_FADE_MIN_ALPHA   = 0.35  // opacity of the trunk closest to the player

  // Toggle for isolating trunks during tuning -- set false to see trunks
  // against open floor/sky with no canopy texture or cutout drawn at all.
  static CANOPY_ENABLED = true

  constructor(scene) {
    this.scene = scene
    this._sw = scene.game.canvas.width
    this._sh = scene.game.canvas.height

    const container = scene.game.canvas.parentNode
    this._canvas = document.createElement('canvas')
    this._canvas.id = 'forest-canopy'
    this._canvas.width  = this._sw
    this._canvas.height = this._sh
    this._canvas.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      // PGR's canvases sit at z 2/3/4 (ground/objects/light). Canopy needs
      // to render above all of them so the cutout reveals PGR's gameplay
      // layers beneath it, not the other way round.
      'z-index:5', 'pointer-events:none',
      'image-rendering:pixelated', 'image-rendering:crisp-edges',
    ].join(';')
    container.appendChild(this._canvas)
    this._ctx = this._canvas.getContext('2d')
    this._ctx.imageSmoothingEnabled = false

    this._resizeHandler = () => {
      const canvas = scene.game.canvas
      this._sw = canvas.width
      this._sh = canvas.height
      this._canvas.width  = this._sw
      this._canvas.height = this._sh
    }
    window.addEventListener('resize', this._resizeHandler)

    this._canopyPattern = this._bakeCanopyPattern()
    this._trunks = this._bakeTrunkShapesFromMask()

    console.log('[ForestEffects] constructed -', this._sw, 'x', this._sh, '-', this._trunks.length, 'trunk clusters')
  }

  // Derives trunk anchor positions LIVE from scene.mapData.wallMask --
  // only wall cells that border at least one OPEN floor cell are even
  // considered (interior wall cells, buried deep inside a wall mass, are
  // skipped entirely) -- AND of those, only a fraction (TRUNK_KEEP_CHANCE)
  // actually get a trunk, chosen deterministically per-cell so it's stable
  // across reloads. This second thinning pass exists because even
  // boundary-only placement put several trunk clusters in the player's
  // immediate view inside tight corridors/pockets (confirmed directly: the
  // area right around testForest's spawn point is a narrow pocket with
  // walls on most sides, and EVERY bordering wall cell there was getting
  // a trunk, which made it impossible to see whether you were moving at
  // all). Thinning further makes any given view less crowded everywhere,
  // not just at spawn.
  static TRUNK_KEEP_CHANCE = 0.45

  _bakeTrunkShapesFromMask() {
    const mask = this.scene.mapData?.wallMask
    if (!mask) {
      console.warn('[ForestEffects] no mapData.wallMask found -- no trunks will render')
      return []
    }
    const mapH = mask.length
    const mapW = mask[0]?.length ?? 0
    const isWall = (x, y) => (y >= 0 && y < mapH && x >= 0 && x < mapW) ? mask[y][x] === 1 : true

    // Deterministic per-cell hash -> [0,1) value, used as a keep/skip
    // threshold so thinning is stable across reloads (same cells always
    // keep or skip) without needing to store extra state.
    const cellKeepValue = (x, y) => {
      let h = (x * 374761393 + y * 668265263) | 0
      h = Math.imul(h ^ (h >>> 13), 1274126177)
      h = (h ^ (h >>> 16)) >>> 0
      return h / 0xffffffff
    }

    const positions = []
    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        if (!isWall(tx, ty)) continue
        const bordersOpen =
          !isWall(tx + 1, ty) || !isWall(tx - 1, ty) ||
          !isWall(tx, ty + 1) || !isWall(tx, ty - 1)
        if (!bordersOpen) continue
        if (cellKeepValue(tx, ty) > ForestEffects.TRUNK_KEEP_CHANCE) continue
        positions.push([tx + 0.5, ty + 0.5])
      }
    }
    return positions.map(([tx, ty]) => this._buildTrunkShape(tx, ty))
  }

  // Builds one trunk's seeded stroke cluster. Each trunk first picks a
  // species deterministically (seeded by position), then draws stem count,
  // curve, and branch chance from that species' preset -- so birch reads
  // visibly different from yew, not just randomly-varied oak.
  _buildTrunkShape(tx, ty) {
      let seed = Math.floor(tx * 7919 + ty * 104729) & 0x7fffffff
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }

      const speciesKey = ForestEffects.SPECIES_KEYS[
        Math.floor(rand() * ForestEffects.SPECIES_KEYS.length)
      ]
      const species = ForestEffects.SPECIES[speciesKey]

      const strokeCount = species.stemCountMin +
        Math.floor(rand() * (species.stemCountMax - species.stemCountMin + 1))
      const strokes = []
      for (let i = 0; i < strokeCount; i++) {
        // Horizontal offset from the anchor, in trunk-width units, so
        // strokes form a loose cluster rather than overlapping exactly.
        const xOffset  = (rand() - 0.5) * 1.4
        const curve    = (rand() - 0.5) * 0.5 * species.curveMul   // bend amount
        const heightMul = 0.82 + rand() * 0.36   // vary height per stroke
        const widthMul  = (0.7 + rand() * 0.6) * species.widthMul  // vary width per stroke
        const hasBranch = rand() < species.branchChance
        const branchAt  = 0.45 + rand() * 0.35   // fraction up the trunk
        const branchAng = (rand() - 0.5) * 1.1   // radians, off-vertical
        const branchLen = 0.5 + rand() * 0.6     // trunk-width units
        strokes.push({ xOffset, curve, heightMul, widthMul, hasBranch, branchAt, branchAng, branchLen })
      }
      return { tx, ty, species, strokes }
  }

  // Bakes a repeatable mottled texture once into an offscreen canvas, then
  // wraps it as a CanvasPattern so painting it each frame is one fillRect
  // rather than redrawing noise every frame. Simple deterministic blob noise
  // -- not meant to be final art, just enough visual texture to read as
  // foliage rather than a flat color.
// Bakes a repeatable mottled texture once into an offscreen canvas, then
// wraps it as a CanvasPattern. Aiming for "primordial Atlantic rainforest"
// density/variety: not one uniform green, but overlapping passes in
// different hues (deep black-green, warm brown-green, mossy yellow-green)
// at different blob sizes, so the canopy reads as mixed species and uneven
// density rather than a flat single-color mass.
_bakeCanopyPattern() {
  const size = ForestEffects.CANOPY_TILE_SIZE
  const tile = document.createElement('canvas')
  tile.width = size
  tile.height = size
  const tctx = tile.getContext('2d')

  tctx.fillStyle = ForestEffects.CANOPY_BASE_COLOR
  tctx.fillRect(0, 0, size, size)

  let seed = 1337
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  const blobPass = (color, count, minR, maxR) => {
    tctx.fillStyle = color
    for (let i = 0; i < count; i++) {
      const x = rand() * size
      const y = rand() * size
      const r = minR + rand() * (maxR - minR)
      tctx.beginPath()
      tctx.arc(x, y, r, 0, Math.PI * 2)
      tctx.fill()
    }
  }

  // Large dark masses first -- the "deep canopy" base variation, bigger
  // and sparser than before so it suggests broad foliage clumps rather
  // than fine grain.
  blobPass('rgba(3, 10, 4, 0.65)',   10, 18, 34)
  blobPass('rgba(14, 22, 10, 0.5)',  14, 12, 26)

  // Mid-size warmer/cooler variation -- suggests mixed species (oak vs
  // yew vs birch canopy) rather than one tree repeated.
  blobPass('rgba(40, 36, 18, 0.4)',  16, 8, 16)   // warm brown-green
  blobPass('rgba(20, 46, 24, 0.4)',  16, 8, 16)   // cooler moss-green

  // Fine mottle, denser and more numerous than before for texture at
  // close range.
  blobPass(ForestEffects.CANOPY_MOTTLE_DARK,  30, 5, 12)
  blobPass(ForestEffects.CANOPY_MOTTLE_LIGHT, 22, 3, 9)

  // Sparse small bright flecks -- hints of gap-glow/light catching leaf
  // edges, without implying an actual light source yet. Few and small so
  // it reads as texture, not as designed light beams.
  blobPass('rgba(120, 130, 70, 0.22)', 6, 2, 5)

  return this._ctx.createPattern(tile, 'repeat')
} 

  // ── Per-frame update ───────────────────────────────────────────────────────
  // Call AFTER perspectiveGround.update() so playerScreenX/Y are current for
  // this frame (PGR sets these as plain properties during its own update()).


// ── Per-frame update ───────────────────────────────────────────────────────
// Call AFTER perspectiveGround.update() so playerScreenX/Y are current for
// this frame (PGR sets these as plain properties during its own update()).
update() {





  const pgr = this.scene.perspectiveGround
  if (!pgr) return

  // Re-read every frame, exactly like PGR does -- don't trust cached
  // dimensions, since fullscreen/orientation changes don't reliably
  // fire a `resize` event on mobile.
  const canvas = this.scene.game.canvas
  if (canvas.width !== this._sw || canvas.height !== this._sh) {
    this._sw = canvas.width
    this._sh = canvas.height
    this._canvas.width  = this._sw
    this._canvas.height = this._sh
  }

  const sw = this._sw, sh = this._sh
  const ctx = this._ctx
// TEMP DEBUG -- remove once fullscreen scale mismatch is confirmed/fixed
if (!this._loggedScaleOnce || this._lastLoggedFS !== document.fullscreenElement) {
  this._loggedScaleOnce = true
  this._lastLoggedFS = document.fullscreenElement
  const rect = canvas.getBoundingClientRect()
  console.log('[ForestEffects DEBUG]',
    'fullscreen:', !!document.fullscreenElement,
    '| backbuffer:', canvas.width, 'x', canvas.height,
    '| CSS rect:', rect.width.toFixed(1), 'x', rect.height.toFixed(1),
    '| devicePixelRatio:', window.devicePixelRatio,
    '| forestCanvas backbuffer:', this._canvas.width, 'x', this._canvas.height,
    '| forestCanvas CSS rect:', this._canvas.getBoundingClientRect().width.toFixed(1),
    'x', this._canvas.getBoundingClientRect().height.toFixed(1)
  )
}
  // Fall back to screen centre if PGR hasn't projected a player position
  // yet (e.g. very first frame before player exists).
  const px = pgr.playerScreenX ?? sw / 2
  const py = pgr.playerScreenY ?? sh / 2

  ctx.clearRect(0, 0, sw, sh)

  // Player's tile row, needed to determine which trunks sit "south" of
  // the player (i.e. between the player and the camera -- the camera
  // looks toward decreasing row values, so a trunk at a higher row than
  // the player is the one that would visually block them).
  const p = this.scene.player
  const ts = pgr.tileDisplaySize ?? 48
  const playerTileY = Math.floor((p?.targetY ?? p?.logicalY ?? 0) / ts)

  // 0a) Tint wall-cell floor positions dark, so the ground itself shows
  // the maze shape -- not just trunks floating with no relationship to
  // what's actually walkable beneath them.
  this._drawWallFloorTint(pgr)

  // 0a-debug) Paint exit tiles bright red -- DEBUG AID, not final art.
  // Added because the real exit tiles were genuinely hard to locate
  // visually in the maze (dense trunks + small map made it easy to miss
  // a 3-tile-wide opening). Remove once exits are easy to find by eye
  // through other means (signage, lighter floor colour, etc).
  this._drawExitMarkers(pgr)

  // 0b) Draw trunks, standing on/above that tinted ground. Trunks south
  // of the player (between player and camera) are faded -- not erased --
  // so we never lose track of where the player is, without making those
  // trees disappear outright. Trunks north of the player (behind them,
  // from the camera's POV) draw at full opacity since they're not
  // blocking anything.
  this._drawTrunks(pgr, playerTileY)

  if (!ForestEffects.CANOPY_ENABLED) return

  // 1) Paint the canopy texture, restricted to a band at the TOP of the
  // screen only, fading to transparent at the band's bottom edge.


// 1) Paint the canopy texture, restricted to a band at the TOP of the
  // screen only, fading to transparent at the band's bottom edge. A
  // vertical brightness gradient is layered on top -- darkest at the
  // very top (deepest into the foliage mass), lightening toward the
  // bottom seam (closer to the gap where canopy gives way to open view)
  // -- so the band reads as "looking up into canopy" rather than a flat
  // dark slab sitting on the screen.
  const bandH = sh * ForestEffects.CANOPY_BAND_FRAC
  const fadeH = bandH * ForestEffects.CANOPY_BAND_FADE_FRAC
  const solidH = bandH - fadeH

  ctx.globalCompositeOperation = 'source-over'
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, sw, bandH)
  ctx.clip()

  // Base texture fill across the whole band.
  ctx.fillStyle = this._canopyPattern ?? ForestEffects.CANOPY_BASE_COLOR
  ctx.fillRect(0, 0, sw, bandH)

  // Vertical brightening wash -- multiply-style lightening toward the
  // bottom, via a 'lighten'-ish additive overlay. Using a soft white-green
  // gradient with 'overlay'-like behaviour approximated by low-alpha
  // source-over, since canvas2d's blend modes are inconsistent across
  // mobile browsers -- alpha-blended fill is the safe cross-platform bet.
  const brightenGrad = ctx.createLinearGradient(0, 0, 0, bandH)
  brightenGrad.addColorStop(0,   'rgba(40, 60, 30, 0)')     // top: no lightening
  brightenGrad.addColorStop(0.6, 'rgba(60, 80, 40, 0.12)')  // mid: starting to lighten
  brightenGrad.addColorStop(1,   'rgba(90, 110, 60, 0.32)') // bottom seam: brightest
  ctx.fillStyle = brightenGrad
  ctx.fillRect(0, 0, sw, bandH)

  // Re-apply the existing bottom-edge fade-to-transparent, unchanged.
  if (fadeH > 0) {
    const fadeGrad = ctx.createLinearGradient(0, solidH, 0, bandH)
    fadeGrad.addColorStop(0, 'rgba(0,0,0,1)')
    fadeGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalCompositeOperation = 'destination-in'
    // destination-in needs full coverage at the unmasked stops, so paint
    // solid black (alpha channel only matters) -- same approach as before,
    // just scoped to the fade strip.
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, solidH, sw, fadeH)
    ctx.clip()
    ctx.fillStyle = fadeGrad
    ctx.fillRect(0, 0, sw, bandH)
    ctx.restore()
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.restore()
  // 2) Cut a soft circular hole through the canopy band, centred on the
  // player. Only matters where the band actually is (top of screen) --
  // if the player is lower on screen, much of this circle has nothing
  // to erase, which is fine and cheap.
  const radius = Math.sqrt(sw * sw + sh * sh) * ForestEffects.HOLE_RADIUS_FRAC
  this._punchHole(px, py, radius, ForestEffects.HOLE_INNER_FRAC)
}

  // Shared soft-circle erase: punches a hole through whatever has already
  // been drawn to this._ctx, centred at (cx, cy), fully transparent within
  // innerStopFrac of the radius, fading to no effect at the radius edge.
  _punchHole(cx, cy, radius, innerStopFrac) {
    const ctx = this._ctx
    ctx.globalCompositeOperation = 'destination-out'
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    grad.addColorStop(0,             'rgba(0,0,0,1)')
    grad.addColorStop(innerStopFrac, 'rgba(0,0,0,1)')
    grad.addColorStop(1,             'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  // DEBUG AID: paints every tile listed in scene.mapData.exits[*].tiles
  // bright red, using the same verified clamped-projection math as
  // _drawWallFloorTint (see that method's comment for why the clamping
  // matters). Purely to make exit tiles impossible to miss while testing
  // navigation -- not meant to ship as final art.
  _drawExitMarkers(pgr) {
    const exits = this.scene.mapData?.exits
    if (!exits) return
    const ctx = this._ctx
    const horizonPx = pgr._horizonPx?.() ?? 0
    const tileDisplaySize = pgr.tileDisplaySize ?? 48
    const sh = this._sh

    for (const exitData of Object.values(exits)) {
      if (!exitData?.tiles) continue
      for (const [tx, ty] of exitData.tiles) {
        const yTopRaw = pgr._rowToScreenY?.(ty)
        const yBotRaw = pgr._rowToScreenY?.(ty + 1)
        if (yBotRaw == null) continue

        const yTopClamped = (yTopRaw == null || yTopRaw < horizonPx - tileDisplaySize)
          ? horizonPx - tileDisplaySize
          : yTopRaw
        const yBotClamped = Math.min(sh + 100, yBotRaw)
        if (yBotClamped <= yTopClamped) continue
        if (yBotClamped < -50 || yTopClamped > sh + 50) continue

        const xTL = pgr._colToScreenX?.(tx,     ty)
        const xTR = pgr._colToScreenX?.(tx + 1, ty)
        const xBL = pgr._colToScreenX?.(tx,     ty + 1)
        const xBR = pgr._colToScreenX?.(tx + 1, ty + 1)
        if (xTL == null) continue
        if (Math.max(xTL, xTR, xBL, xBR) < -50) continue
        if (Math.min(xTL, xTR, xBL, xBR) > this._sw + 50) continue

        ctx.fillStyle = 'rgba(255, 20, 20, 0.85)'
        ctx.beginPath()
        ctx.moveTo(xTL, yTopClamped)
        ctx.lineTo(xTR, yTopClamped)
        ctx.lineTo(xBR, yBotClamped)
        ctx.lineTo(xBL, yBotClamped)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  // Reads scene.mapData.wallMask directly and paints a dark quad over each
  // wall cell's ground position, projected the same way PGR projects its
  // own floor tiles. This is what makes the floor itself show
  // corridor-vs-wall, rather than relying on trunks alone.
  //
  // IMPORTANT: must replicate PGR's exact yTopClamped/yBotClamped formula,
  // not just call _rowToScreenY raw. Traced through PGR's update() ground-
  // tile block directly: with no heightMap present (testForest has none),
  // PGR's per-vertex height contribution is zero, so the ONLY remaining
  // difference between PGR's corners and a naive reimplementation is this
  // clamping -- which only engages near the horizon and bottom screen edge.
  // That's exactly where the visible seam showed up in testing. Confirmed
  // by reading PGR's source line-by-line rather than guessing.
  _drawWallFloorTint(pgr) {
    const mask = this.scene.mapData?.wallMask
    if (!mask) return
    const ctx = this._ctx
    const mapH = mask.length
    const mapW = mask[0]?.length ?? 0

    const horizonPx = pgr._horizonPx?.() ?? 0
    const tileDisplaySize = pgr.tileDisplaySize ?? 48
    const sh = this._sh

    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        if (mask[ty][tx] !== 1) continue

        const yTopRaw = pgr._rowToScreenY?.(ty)
        const yBotRaw = pgr._rowToScreenY?.(ty + 1)
        if (yBotRaw == null) continue   // PGR itself skips the tile entirely if yBot is null

        // PGR's exact clamp formula (see update()'s ground-tile block):
        const yTopClamped = (yTopRaw == null || yTopRaw < horizonPx - tileDisplaySize)
          ? horizonPx - tileDisplaySize
          : yTopRaw
        const yBotClamped = Math.min(sh + 100, yBotRaw)
        if (yBotClamped <= yTopClamped) continue   // PGR also skips degenerate tiles

        if (yBotClamped < -50 || yTopClamped > sh + 50) continue

        const xTL = pgr._colToScreenX?.(tx,     ty)
        const xTR = pgr._colToScreenX?.(tx + 1, ty)
        const xBL = pgr._colToScreenX?.(tx,     ty + 1)
        const xBR = pgr._colToScreenX?.(tx + 1, ty + 1)
        if (xTL == null) continue
        if (Math.max(xTL, xTR, xBL, xBR) < -50) continue
        if (Math.min(xTL, xTR, xBL, xBR) > this._sw + 50) continue

        ctx.fillStyle = ForestEffects.WALL_FLOOR_TINT
        ctx.beginPath()
        ctx.moveTo(xTL, yTopClamped)
        ctx.lineTo(xTR, yTopClamped)
        ctx.lineTo(xBR, yBotClamped)
        ctx.lineTo(xBL, yBotClamped)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  // Projects each trunk's world-tile anchor through PGR's own perspective
  // math (same functions PGR uses internally for billboards) so trunks
  // scale and move correctly as the player walks, then draws a cluster of
  // curved tapering strokes with optional branch stubs. Trunks "south" of
  // the player (trunk.ty > playerTileY -- i.e. between the player and the
  // camera, since the camera looks toward decreasing row) are faded so the
  // player is never lost behind them, without erasing the tree outright.
  _drawTrunks(pgr, playerTileY) {
    const ctx = this._ctx
    const fadeRangeTiles = ForestEffects.SOUTH_FADE_RANGE_TILES
    const minAlpha = ForestEffects.SOUTH_FADE_MIN_ALPHA

    for (const trunk of this._trunks) {
      // Anchor row+1 convention matches PGR's own billboard projection
      // (perspectiveProject uses worldTileY + 1 as the foot of the tile).
      const screenY = pgr._rowToScreenY?.(trunk.ty + 1)
      const scale   = pgr._scaleAtRow?.(trunk.ty + 1)
      if (screenY == null || !(scale > 0)) continue   // behind camera / offscreen

      const screenX = pgr._colToScreenX?.(trunk.tx + 0.5, trunk.ty + 1)
      if (screenX == null) continue

      // Skip trunks far outside the visible screen -- cheap cull.
      if (screenX < -100 || screenX > this._sw + 100) continue
      if (screenY < -100 || screenY > this._sh + 100) continue

      // South-of-player fade: only trunks BETWEEN the player and the
      // camera (higher row number = closer to camera in this projection)
      // get faded. Trunks north of the player (further from camera than
      // the player, i.e. "behind" them) draw at full opacity -- they were
      // never blocking the view of the player in the first place.
      let alpha = 1.0
      const southDist = trunk.ty - playerTileY
      if (southDist > 0 && southDist < fadeRangeTiles) {
        // Closer to the player (smaller southDist) -> more faded, since
        // that's the tree most directly between camera and player.
        const t = 1 - southDist / fadeRangeTiles
        alpha = 1 - t * (1 - minAlpha)
      }
      ctx.globalAlpha = alpha

      // scale is PGR's "pixels per tile" at this row -- multiply tile-unit
      // constants directly to get pixel dimensions at the correct depth.
      const widthPx  = ForestEffects.TRUNK_BASE_WIDTH_TILES  * scale
      const heightPx = ForestEffects.TRUNK_BASE_HEIGHT_TILES * scale

      for (const s of trunk.strokes) {
        const w = widthPx * s.widthMul
        const h = heightPx * s.heightMul
        const baseX = screenX + s.xOffset * widthPx
        const baseY = screenY
        const topX  = baseX + s.curve * w * 3
        const topY  = baseY - h
        const midX  = (baseX + topX) / 2 + s.curve * w * 1.5
        const midY  = (baseY + topY) / 2

        // Tapering organic stroke: draw as a filled path with a curved
        // centreline, wide at base, narrow at top, rather than a straight
        // rectangle -- this is what keeps it from reading as "a pole."
        ctx.fillStyle = trunk.species.colorDark
        ctx.beginPath()
        ctx.moveTo(baseX - w / 2, baseY)
        ctx.quadraticCurveTo(midX - w / 4, midY, topX - w / 8, topY)
        ctx.lineTo(topX + w / 8, topY)
        ctx.quadraticCurveTo(midX + w / 4, midY, baseX + w / 2, baseY)
        ctx.closePath()
        ctx.fill()

        // Cheap rim-light: thin offset stroke along one side, fakes
        // directional light without real shading.
        ctx.strokeStyle = trunk.species.colorRim
        ctx.lineWidth = Math.max(1, w * 0.12)
        ctx.beginPath()
        ctx.moveTo(baseX - w / 2, baseY)
        ctx.quadraticCurveTo(midX - w / 4, midY, topX - w / 8, topY)
        ctx.stroke()

        // Branch stub, on a subset of strokes.
        if (s.hasBranch) {
          const branchBaseX = baseX + (topX - baseX) * s.branchAt
          const branchBaseY = baseY + (topY - baseY) * s.branchAt
          const branchEndX  = branchBaseX + Math.sin(s.branchAng) * w * 3 * s.branchLen
          const branchEndY  = branchBaseY - Math.cos(s.branchAng) * w * 2 * s.branchLen
          ctx.strokeStyle = trunk.species.colorDark
          ctx.lineWidth = Math.max(1, w * 0.35)
          ctx.beginPath()
          ctx.moveTo(branchBaseX, branchBaseY)
          ctx.lineTo(branchEndX, branchEndY)
          ctx.stroke()
        }
      }
    }
    ctx.globalAlpha = 1.0
  }

  destroy() {
    console.log('[ForestEffects] destroy() called -- canvas present:', !!this._canvas,
      'has parent:', !!this._canvas?.parentNode)
    window.removeEventListener('resize', this._resizeHandler)
    if (this._canvas?.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas)
      console.log('[ForestEffects] canvas removed from DOM')
    } else {
      console.warn('[ForestEffects] destroy() ran but canvas had no parent -- already removed, or never attached?')
    }
    this._canvas = null
    this._ctx = null
  }
}

