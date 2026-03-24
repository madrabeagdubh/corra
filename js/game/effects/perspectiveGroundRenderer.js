// PerspectiveGroundRenderer.js
//
// Renders layer 0 of a bog map with a perspective-warped ground plane.
// Layer 1+ (trees, objects) remain as normal Phaser images — use
// perspectiveProject() to reposition and rescale them each frame.
//
// ── Integration in BogLocationScene ──────────────────────────────────────────
//
//  1. Import at top:
//       import PerspectiveGroundRenderer from '../../systems/PerspectiveGroundRenderer.js'
//
//  2. In drawTilemap(), wrap the layer 0 flood-fill + layer 0 tile loop in a
//     flag so we can suppress it when perspective mode is on:
//
//       if (li === 0 && !this.usePerspective) {
//         // ... existing flood fill ...
//       }
//       // In the per-tile loop:
//       if (li === 0 && this.usePerspective) continue
//
//  3. At the END of create(), after drawTilemap() and initializeLocation():
//
//       this.usePerspective = true   // set BEFORE drawTilemap() call (see step 2)
//       this.perspectiveGround = new PerspectiveGroundRenderer(this)
//
//  4. In update(), before super.update():
//       if (this.perspectiveGround) this.perspectiveGround.update()
//
//  To toggle off and compare: set this.usePerspective = false, remove the
//  perspectiveGround instantiation, and the normal flat tilemap returns.
//
// ─────────────────────────────────────────────────────────────────────────────

export default class PerspectiveGroundRenderer {

  // ── Perspective tuning constants ──────────────────────────────────────────
  //
  //  HORIZON_FRAC   : where the horizon sits on screen  (0 = top, 1 = bottom)
  //  MIN_SCALE      : how squished the farthest visible row is  (0.1 = dramatic)
  //  VIEW_TILES     : how many tile-rows are visible between horizon and player
  //  CULL_PAD       : extra tile radius to render beyond screen edge
  //
  static HORIZON_FRAC = 0.22
  static MIN_SCALE    = 0.15
  static VIEW_TILES   = 14
  static CULL_PAD     = 4

  constructor(scene) {
    this.scene = scene

    // Pull constants from the scene — same values BogLocationScene uses
    this.TW    = 24           // native tile width  (px)
    this.TH    = 24           // native tile height (px)
    this.MG    = 24           // tileset margin     (px) — critical!
    this.COLS  = 54           // tileset sheet columns
    this.SCALE = 2            // display scale factor
    this.tileDisplaySize = this.TW * this.SCALE   // 48px

    this._sw = scene.scale.width
    this._sh = scene.scale.height

    // RenderTexture fixed to screen — layer 0 gets stamped here each frame
    this.rt = scene.add.renderTexture(0, 0, this._sw, this._sh)
      .setOrigin(0, 0)
      .setDepth(-2)           // behind layer 0 images (depth 0) and layer 1 (depth 1)
      .setScrollFactor(0)

    // Ensure all GIDs in layer 0 have frames registered on 'oryxTiles'
    // (BogLocationScene's ensureFrame() is lazy — we pre-warm it here so
    //  stamps don't fail on first render)
    this._ensureAllFrames()

    // Track camera position so we skip re-render when nothing has moved
    this._lastCamX = null
    this._lastCamY = null

    console.log('[PerspectiveGroundRenderer] initialised')
  }

  // ── Frame registration ────────────────────────────────────────────────────

  // Mirrors BogLocationScene.ensureFrame() exactly — safe to call repeatedly
  _ensureFrame(gid) {
    const tex = this.scene.textures.get('oryxTiles')
    const key = `oryx_${gid}`
    if (!tex.has(key)) {
      const idx = gid - 1
      tex.add(
        key, 0,
        this.MG + (idx % this.COLS) * this.TW,
        this.MG + Math.floor(idx / this.COLS) * this.TH,
        this.TW, this.TH
      )
    }
    return key
  }

  _ensureAllFrames() {
    const layer0 = this.scene.mapData?.layers?.[0]
    if (!layer0) return
    for (const row of layer0) {
      for (const gid of row) {
        if (gid) this._ensureFrame(gid)
      }
    }
    // Also ensure the grass base tile
    this._ensureFrame(732)
  }

  // ── Core projection ───────────────────────────────────────────────────────
  //
  // perspectiveProject(worldTileX, worldTileY)
  //
  // Converts a world-space tile coordinate into a screen position and scale,
  // using a perspective projection centred on the camera.
  //
  // Returns { screenX, screenY, scale } or null if the tile is at/behind
  // the horizon (not visible).
  //
  // This method is PUBLIC — overlay sprites (trees, NPCs, player) should call
  // it each frame to update their position and setScale().

  perspectiveProject(worldTileX, worldTileY) {
    const cam  = this.scene.cameras.main
    const sw   = this._sw
    const sh   = this._sh
    const ts   = this.tileDisplaySize   // 48

    // Camera centre in world-pixel space
    const camCX = cam.scrollX + sw / 2
    const camCY = cam.scrollY + sh / 2

    // Tile centre in world-pixel space
    const worldPX = worldTileX * ts + ts / 2
    const worldPY = worldTileY * ts + ts / 2

    // Offset from camera centre, in tiles
    // Negative dy = north of camera (toward horizon)
    // Positive dy = south of camera (toward player's feet)
    const dxTiles = (worldPX - camCX) / ts
    const dyTiles = (worldPY - camCY) / ts

    // "depth" = how far in front of the horizon this tile is.
    // We define VIEW_TILES rows in front of the horizon as the visible range.
    // The player sits at dyTiles ≈ 0 (camera follows player).
    // The horizon is VIEW_TILES/2 rows north of the player.
    const VD = PerspectiveGroundRenderer.VIEW_TILES

    // depth > 0  → tile is visible (between horizon and below)
    // depth ≤ 0  → tile is at/behind horizon
    const depth = VD / 2 - dyTiles

    if (depth <= 0) return null

    // Perspective t: 0 at horizon, 1 at max depth (well south of player)
    // We clamp to 1 so tiles behind the player don't get huge
    const t = Math.min(depth / VD, 1.0)

    // Non-linear (1/z) mapping — makes near tiles take more screen space
    // than far tiles, which is correct perspective behaviour.
    // perspT = 0 at horizon, 1 at player's feet
    const perspT = 1 - 1 / (t * 6 + 1)    // tweak the '6' to adjust compression

    // Horizon line Y on screen
    const horizonY = sh * PerspectiveGroundRenderer.HORIZON_FRAC

    // Screen Y: tiles near horizon cluster at horizonY; near tiles spread toward sh
    const groundH  = sh - horizonY
    const screenY  = horizonY + perspT * groundH

    // Scale: minScale at horizon, 1.0 at bottom
    const minS  = PerspectiveGroundRenderer.MIN_SCALE
    const scale = minS + perspT * (1 - minS)

    // Screen X: horizontal offset from screen centre, compressed by scale
    const screenX = sw / 2 + dxTiles * ts * scale

    return { screenX, screenY, scale }
  }

  // ── Per-frame render ──────────────────────────────────────────────────────

  update() {
    const cam = this.scene.cameras.main

    // Skip re-render if camera hasn't moved
    if (cam.scrollX === this._lastCamX && cam.scrollY === this._lastCamY) return
    this._lastCamX = cam.scrollX
    this._lastCamY = cam.scrollY

    this.rt.clear()

    const mapData = this.scene.mapData
    if (!mapData?.layers?.[0]) return

    const layer0 = mapData.layers[0]
    const mapH   = layer0.length
    const mapW   = layer0[0].length
    const ts     = this.tileDisplaySize   // 48
    const cam0   = this.scene.cameras.main

    // Tile-space centre of camera
    const camTX = (cam0.scrollX + this._sw / 2) / ts
    const camTY = (cam0.scrollY + this._sh / 2) / ts

    // Cull radius — only process tiles near the camera
    const pad = PerspectiveGroundRenderer.CULL_PAD +
                Math.ceil(PerspectiveGroundRenderer.VIEW_TILES / 2) + 4

    const x0 = Math.max(0, Math.floor(camTX - pad))
    const x1 = Math.min(mapW - 1, Math.ceil(camTX + pad))
    const y0 = Math.max(0, Math.floor(camTY - pad))
    const y1 = Math.min(mapH - 1, Math.ceil(camTY + pad))

    // ── Base grass flood fill ─────────────────────────────────────────────
    // Stamp grass for every tile position in the visible range so there are
    // no gaps between perspective tiles (same role as the flat flood fill)
    const grassFrame = `oryx_732`
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const proj = this.perspectiveProject(tx, ty)
        if (!proj) continue
        const drawSize = this.TW * proj.scale * this.SCALE
        this.rt.stamp('oryxTiles', grassFrame, proj.screenX, proj.screenY, {
          scaleX:  drawSize / this.TW,
          scaleY:  drawSize / this.TH,
          originX: 0.5,
          originY: 0.5,
        })
      }
    }

    // ── Layer 0 tiles (back-to-front so near tiles overdraw far tiles) ────
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const gid = layer0[ty]?.[tx]
        if (!gid) continue

        const proj = this.perspectiveProject(tx, ty)
        if (!proj) continue

        const frame    = this._ensureFrame(gid)
        const drawSize = this.TW * proj.scale * this.SCALE

        this.rt.stamp('oryxTiles', frame, proj.screenX, proj.screenY, {
          scaleX:  drawSize / this.TW,
          scaleY:  drawSize / this.TH,
          originX: 0.5,
          originY: 0.5,
        })
      }
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    if (this.rt) { this.rt.destroy(); this.rt = null }
  }
}

