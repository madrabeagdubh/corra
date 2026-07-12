// PerspectiveGroundRenderer.js  (v9.0 — modular split; companion modules in ./pgr/)
// Location: js/game/effects/perspectiveGroundRenderer.js
//
// ── Architecture ─────────────────────────────────────────────────────────────
// This file is the CORE RENDERER only. It handles:
//   • Two-canvas DOM setup (pgr-ground z:2, pgr-objects z:3, pgr-light z:4)
//   • Perspective projection math (_rowToScreenY, _scaleAtRow, _colToScreenX)
//   • Ground tile rendering (layer 0 trapezoid warping, water animation, tinting)
//   • Layer 1 billboard rendering (trees, encounter flags, exit markers)
//   • Layer 2/3 elevated tile rendering (reads this._elev set by ElevationRenderer)
//   • Building image billboards (set via setBuildings, drawn per anchor row)
//   • Player and boat rendering (_drawPlayerAnimated)
//   • Tree trunk rendering (set via setForestEffects, drawn per anchor row --
//     see v8.4 note below)
//
// ── v8.4: tree trunks drawn inline, on _gCtx, alongside cliffs ───────────────
// Trunks used to be drawn entirely by ForestEffects on its own separate
// always-on-top canvas (z:5), which meant trees could never be occluded by
// nearer terrain, and the player could never stand in front of a tree --
// that canvas always won regardless of true relative depth. Cliffs never had
// this problem because they're drawn on THIS renderer's own _gCtx (z:2),
// below the player's _oCtx (z:3) -- so the player always correctly draws
// over a cliff, and _gCtx's own per-row draw order (far-to-near) already
// gives correct hill-vs-cliff occlusion.
//
// setForestEffects() lets a scene hand PGR a reference to its ForestEffects
// instance. PGR then queries forestEffects.getTrunksForRow(tileRow) inside
// its own per-row loop (same place buildings are drawn) and calls
// forestEffects.drawTrunk(this._gCtx, trunk, this, playerTileRow) for each --
// trees now inherit the exact same occlusion mechanism cliffs already have,
// for free. ForestEffects itself no longer draws trunks or owns their
// canvas; it only bakes shapes and exposes them for PGR to draw.
//
// ── v9.0: file split ─────────────────────────────────────────────────────────
// The renderer is split across ./pgr/ modules (plain functions taking the
// PGR instance as first arg; all state stays on the instance):
//   pgr/pgrShared.js       — GID tables + pure helpers (hashes, mirror, hsl)
//   pgr/pgrSky.js          — sky/mountain/light DOM, parallax, palette
//   pgr/pgrTileCache.js    — tileset load, tile/tint/avg-colour caches
//   pgr/pgrBuildings.js    — building billboards (box/decal/billboard)
//   pgr/pgrCliffFaces.js   — cliff + elevated-terrain faces
//   pgr/pgrNorthPreview.js — north-neighbour preview rows
//   pgr/pgrWaterBanks.js   — river/lake bank + corner-cap faces
//   pgr/pgrPlayerBoat.js   — player, boat, and weapon rendering
// Every extracted method keeps a one-line delegate on this class, so
// external callers (scenes, boatSystem, elevationRenderer, forestEffects)
// need no changes. Projection math + draw primitives stay HERE: they are
// the hottest code and everything calls them through the instance.
//
// ── Related modules ───────────────────────────────────────────────────────────
//   js/game/systems/elevationRenderer.js  — builds this._elev, draws cliff faces
//   js/game/systems/playerRenderer.js     — utilities for enemy/NPC rendering
//   js/game/effects/forestEffects.js      — bakes trunk shapes, drawTrunk()/getTrunksForRow()
//   js/game/systems/PGR_ARCHITECTURE.md   — full integration guide
//
// ── Elevation ─────────────────────────────────────────────────────────────────
// Elevation data (this._elev) is set externally by ElevationRenderer.
// ElevationRenderer.update(mapData) must be called BEFORE pgr.update() each frame.
// Maps without ElevationRenderer render flat — zero overhead.
//
// ── Buildings ─────────────────────────────────────────────────────────────────
// Scene calls pgr.setBuildings(mapData.buildings || []) after mapData is set.
// Each entry: { key, src, x, y, fw, fh, door, overscale? }
//
// ── Phaser canvas ─────────────────────────────────────────────────────────────
// Phaser canvas sits at z-index:10 — UI, joystick, inventory all unaffected.
// Player's Phaser sprite is hidden; PGR owns all player rendering.

import { TintManager } from './tintManager.js'
import { GID_CATEGORIES_GROUND, OAK_STAMP_GIDS, BOG_STAMP_GIDS,
         WITHERED_STAMP_GIDS, tmHashPGR, mirrorIndex, hslToRgb } from './pgr/pgrShared.js'
import * as PGRSky from './pgr/pgrSky.js'
import * as PGRTiles from './pgr/pgrTileCache.js'
import * as PGRBuildings from './pgr/pgrBuildings.js'
import * as PGRCliffs from './pgr/pgrCliffFaces.js'
import * as PGRPreview from './pgr/pgrNorthPreview.js'
import * as PGRBanks from './pgr/pgrWaterBanks.js'
import * as PGRPlayer from './pgr/pgrPlayerBoat.js'

export default class PerspectiveGroundRenderer {

  static DEBUG_RECTS   = false
  static _tintIdSeq   = 0

  static CAMERA_ROW_OFFSET    = 14.0
  static PLAYER_DIST_TILES    = 1.2
  static FOCAL_LENGTH         = 12.0
  static HEIGHT_MULTIPLIER    = 1.2
  static PLAYER_SCALE         = 0.7

  static LIGHT_RADIUS   = 0.45
  static LIGHT_DARKNESS = 0
  static LIGHT_COLOR    = 'rgba(255, 240, 180, 0.18)'
  static TILES_ACROSS   = 3.8
  static HORIZON_Y_FRAC = 0.28
  static TW         = 24
  static TH         = 24
  static MG         = 24
  static SHEET_COLS = 54
  static TILESET_URL = '/assets/oryx/oryx_16bit_fantasy_world_trans.png'

  static EDGE_EXTEND = 6

  // LOD (level-of-detail) cutoff: once a row is shorter than
  // this many screen pixels TALL, ground quads are drawn as SOLID COLOUR
  // fills (average tile colour blended with the tile's tint -- see
  // _lodFillQuad) instead of textured trapezoids. At these sizes the
  // texture is genuinely invisible (a 24px source squeezed into 1-4px),
  // but the textured path still costs two clipped affine draws plus a
  // composite tint pass PER TILE -- and these are exactly the rows where
  // perspective explodes the column count into the hundreds (halfCols =
  // (sw/2)/scale). The phantom-edge and north-preview extensions made
  // those rows do real draw work where they used to `continue`, which
  // is what made this cutoff necessary. Tunable by eye: raise it and
  // more of the distance becomes flat colour (faster), lower it and
  // texture persists further back (slower).
  static LOD_MIN_ROW_PX = 6

  // How many rows into the north neighbour's territory to render as a
  // fading preview (see _drawNorthPreviewRow). First-guess value bumped
  // up 2-3x after playtesting -- cost is bounded and cheap regardless
  // (rows beyond the fade threshold exit before any column work happens,
  // and preview tiles are plain flat trapezoids with none of the cliff/
  // water/elevation branching the main renderer does), so there's room
  // to tune this further by eye without much performance concern.
  static NORTH_PREVIEW_DEPTH = 45

  // Atmospheric haze target for the north preview -- ground tiles blend
  // toward this pale, cool, desaturated tone as they approach the
  // horizon line on screen (see NORTH_FADE_BAND_FRAC below), rather than
  // just fading to transparent, which is what "distance" actually looks
  // like.
  static NORTH_HAZE_H = 205
  static NORTH_HAZE_S = 18
  static NORTH_HAZE_L = 74

  // Fraction of the ground's own screen height (sh - horizonPx) used as
  // the fade band, measured from the horizon line downward. Screen-space,
  // not world-depth -- see _drawNorthPreviewRow's own note on why that
  // distinction matters (perspective compresses distant world-rows into
  // a shrinking band of screen pixels, so a world-depth-based fade still
  // reads as an abrupt cutoff on screen).
  static NORTH_FADE_BAND_FRAC = 0.4

  static CLIFF_GIDS      = new Set([740])
  static CLIFF_FACE_GID  = 740
  static CLIFF_HEIGHT    = 1.0
  static ELEVATED_GIDS   = new Set([839, 840])

  constructor(scene) {
    this.scene           = scene
    this._player         = null
    this._playerCanvas   = null
    this._playerFrameKey = null
    this._encounterFlags = []
    this._buildings      = []
    this._forestEffects  = null
    this._northNeighbor  = null
    this._boatActive      = false
    this._boatDrifting    = false
    this._boatCanvas      = null
    this._boatSinkOverride = 0
    this._boatScreenX     = null
    this._boatScreenY     = null
    this.tintManager = new TintManager()

    this._elev      = null
    this._elevMapId = null

    this._heightMapSrc = null
    this._hmW          = 0
    this._hmH          = 0

    if (this._resizeHandler) { window.removeEventListener('resize', this._resizeHandler); document.removeEventListener('fullscreenchange', this._resizeHandler); document.removeEventListener('webkitfullscreenchange', this._resizeHandler); this._resizeHandler = null }
    ;['pgr-ground','pgr-objects','pgr-light','pgr-sky','pgr-sky-img','pgr-mountain-img','pgr-fog'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.parentNode?.removeChild(el)
    })

    const phaserCanvas   = scene.game.canvas
    this._sw             = phaserCanvas.width
    this._sh             = phaserCanvas.height
    this.tileDisplaySize = 48

    this._tilesetImg = null
    this._tileCache  = new Map()
    this._ready      = false
    this._gcR        = null

    this._flatGids = new Set()
    PGRTiles.loadCatalogue(this)
    PGRTiles.initTileset(this)

    const container = phaserCanvas.parentNode

    phaserCanvas.style.position   = 'absolute'
    phaserCanvas.style.top        = '0'
    phaserCanvas.style.left       = '0'
    phaserCanvas.style.zIndex     = '10'
    phaserCanvas.style.background = 'transparent'

    this._groundCanvas = this._makeCanvas(container, 'pgr-ground',  2)
    this._objectCanvas = this._makeCanvas(container, 'pgr-objects', 3)
    this._gCtx         = this._groundCanvas.getContext('2d')
    this._oCtx         = this._objectCanvas.getContext('2d')
    this._gCtx.imageSmoothingEnabled = false
    this._oCtx.imageSmoothingEnabled = false

    this._skyDiv = null
    this._skyImg = null
    PGRSky.initSky(this, container)
    PGRSky.initLight(this, container)

    this._lastCamX    = null
    this._lastCamY    = null
    this._lastCamZoom = null
    this._debugged    = false

    console.log('[PGR v8] constructed -', this._sw, 'x', this._sh)
    setTimeout(() => {
      const all = document.querySelectorAll('[id^=pgr-]')
      console.log('[PGR v8] DOM pgr elements after construct:', [...all].map(e => e.id + '@z' + e.style.zIndex))
    }, 500)
  }

  _makeCanvas(container, id, zIndex) {
    const c = document.createElement('canvas')
    c.width  = this._sw
    c.height = this._sh
    c.id     = id
    c.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      `z-index:${zIndex}`, 'pointer-events:none',
      'image-rendering:pixelated', 'image-rendering:crisp-edges',
    ].join(';')
    container.appendChild(c)
    return c
  }

  // ── Sky / mountain / light: implementation lives in pgr/pgrSky.js ──
  // Thin delegates kept so scene-facing call sites (pgr.setSkyImage(...)
  // etc.) are untouched by the split.
  setSkyImage(url, position = 'center top') { PGRSky.setSkyImage(this, url, position) }
  setMountainImage(url, position) { PGRSky.setMountainImage(this, url, position) }
  updateMountainParallax(px, py, mapW, mapH) { PGRSky.updateMountainParallax(this, px, py, mapW, mapH) }

  setMood(mood) {
    this.tintManager.setMood(mood)
    this._gcR      = null
    this._lastCamX = null
  }

  setLighting({ darkness, radius, groundColour } = {}) {
    if (darkness     != null) this._lightDarkness = darkness
    if (radius       != null) this._lightRadius   = radius
    if (groundColour != null) this._groundColour  = groundColour
  }

  setPlayer(player) {
    this._player = player
    if (player.sprite)     player.sprite.setVisible(false)
    if (player.bowOverlay) player.bowOverlay.setVisible(false)
    console.log('[PGR v8] player registered')
  }

  // Wires a scene's ForestEffects instance in so PGR can draw trunks
  // directly onto its own _gCtx from inside the per-row loop below (see
  // v8.4 header note). Call once, after both PGR and ForestEffects exist
  // (typically right after `this.forestEffects = new ForestEffects(...)`
  // in PerspectiveScene.create()). Pass null/undefined to unregister
  // (e.g. on scene shutdown, though destroying PGR itself already stops
  // any further update() calls).
  setForestEffects(forestEffects) {
    this._forestEffects = forestEffects || null
  }

  // North-direction map preview (see _drawNorthPreviewRow below). Scene
  // calls this after fetching the north neighbour's raw map JSON --
  // purely ground GIDs + heightmap, not its NPCs/objects/content. Pass
  // null/undefined to clear (e.g. if the current map has no north exit,
  // or the fetch failed) -- the renderer already falls back gracefully
  // to its existing flat-fill behaviour with no neighbour set.
  setNorthNeighbor(data) {
    this._northNeighbor = data || null
  }


  prewarmBillboardTints(mapData) { PGRTiles.prewarmBillboardTints(this, mapData) }

  setPlayerScale(mult, scale) {
    this._playerHeightMult = mult ?? 1.8
    if (scale != null) this._playerScale = scale
    this._playerFrameKey   = null
  }

  invalidatePlayerCanvas() {
    this._playerFrameKey = null
  }

  forceRedraw() {
    this._lastCamX = null
  }

  setEncounterFlags(flags) {
    this._encounterFlags = flags || []
  }

  setExitMarkers(markers) {
    this._exitMarkers  = markers || []
    this._exitEdges    = new Set(markers.map(m => m.dir))
    this._exitArrowCanvases = {}
    for (const { dir } of markers) {
      if (this._exitArrowCanvases[dir]) continue
      const size = 24
      const c    = document.createElement('canvas')
      c.width = size; c.height = size
      const ctx = c.getContext('2d')
      ctx.strokeStyle = 'rgba(180,255,220,0.95)'
      ctx.fillStyle   = 'rgba(180,255,220,0.4)'
      ctx.lineWidth   = 2.5
      const m = size / 2, s = size * 0.32
      ctx.beginPath()
      if (dir === 'west') {
        ctx.moveTo(m+s, m-s); ctx.lineTo(m-s, m); ctx.lineTo(m+s, m+s)
      } else if (dir === 'east') {
        ctx.moveTo(m-s, m-s); ctx.lineTo(m+s, m); ctx.lineTo(m-s, m+s)
      } else if (dir === 'north') {
        ctx.moveTo(m-s, m+s); ctx.lineTo(m, m-s); ctx.lineTo(m+s, m+s)
      } else {
        ctx.moveTo(m-s, m-s); ctx.lineTo(m, m+s); ctx.lineTo(m+s, m-s)
      }
      ctx.stroke()
      ctx.globalAlpha = 0.4
      ctx.fill()
      this._exitArrowCanvases[dir] = c
    }
    this._exitPulseT = 0
  }

  clearEncounterFlag(tileX, tileY) {
    if (!this._encounterFlags) return
    this._encounterFlags = this._encounterFlags.filter(
      f => !(f.tileX === tileX && f.tileY === tileY)
    )
  }

  // Building rendering lives in pgr/pgrBuildings.js.
  setBuildings(list) { PGRBuildings.setBuildings(this, list) }

  registerCustomTile(gid, url) { PGRTiles.registerCustomTile(this, gid, url) }

  _drawBuilding(ctx, b, horizonPx, sw) { PGRBuildings.drawBuilding(this, ctx, b, horizonPx, sw) }




  _refreshPlayerCanvas() {
    if (!this._player?.sprite) return
    const sprite   = this._player.sprite
    const texKey   = sprite.texture?.key
    const frameKey = sprite.frame?.name ?? this._player.currentFrameName
    const cacheKey = `${texKey}::${frameKey}`
    if (cacheKey === this._playerFrameKey && this._playerCanvas) return
    try {
      const tex = this.scene.textures.get(texKey)
      if (!tex || tex.key === '__MISSING') {
        console.warn('[PGR v8] player texture not found:', texKey); return
      }
      const frame = tex.get(frameKey)
      if (!frame) {
        console.warn('[PGR v8] player frame not found:', frameKey); return
      }
      const src = tex.getSourceImage()
      const { cutX, cutY, cutWidth, cutHeight } = frame
      const tc   = document.createElement('canvas')
      tc.width   = cutWidth
      tc.height  = cutHeight
      const tCtx = tc.getContext('2d')
      tCtx.imageSmoothingEnabled = false
      tCtx.drawImage(src, cutX, cutY, cutWidth, cutHeight, 0, 0, cutWidth, cutHeight)
      this._playerCanvas   = tc
      this._playerFrameKey = cacheKey
      console.log('[PGR v8] player canvas refreshed -', cacheKey, cutWidth, 'x', cutHeight)
    } catch(e) {
      console.warn('[PGR v8] could not build player canvas:', e.message)
      this._playerCanvas = null
    }
  }

  _zoom()      { return this.scene.cameras?.main?.zoom || 1 }
  _cameraReady() { return !!(this.scene.cameras?.main) }
 


_horizonPx() {
    return Math.floor(this._sh * (this._horizonYFrac ?? PerspectiveGroundRenderer.HORIZON_Y_FRAC))
  }



 _groundH()   { return this._sh - this._horizonPx() }

  _pxPerTileAtPlayer() {
    return (this._sw * this._zoom()) / PerspectiveGroundRenderer.TILES_ACROSS
  }

  _perspCamRow() {
    if (!this._cameraReady()) return 0
    const c = this.scene.cameras.main, zoom = this._zoom()
    return (c.scrollY + this._sh / (2 * zoom)) / this.tileDisplaySize
         + (this._cameraRowOffset ?? PerspectiveGroundRenderer.CAMERA_ROW_OFFSET)
  }

  _perspCamCol() {
    if (!this._cameraReady()) return 0
    const c = this.scene.cameras.main, zoom = this._zoom()
    return (c.scrollX + this._sw / (2 * zoom)) / this.tileDisplaySize
  }

  _screenYToWorldRow(screenY) {
    const horizonPx = this._horizonPx()
    const groundH   = this._groundH()
    const FL        = PerspectiveGroundRenderer.FOCAL_LENGTH
    const denom     = screenY - horizonPx
    if (denom <= 0) return null
    const d = FL * groundH / denom - FL
    return this._perspCamRow() - d
  }

  _rowToScreenY(worldRow) {
    const d = this._perspCamRow() - worldRow
    if (d <= 0) return null
    const FL = PerspectiveGroundRenderer.FOCAL_LENGTH
    return this._horizonPx() + this._groundH() * FL / (FL + d)
  }

  _scaleAtRow(worldRow) {
    const d = this._perspCamRow() - worldRow
    if (d <= 0) return 0
    const FL = PerspectiveGroundRenderer.FOCAL_LENGTH
    const PD = PerspectiveGroundRenderer.PLAYER_DIST_TILES
    return this._pxPerTileAtPlayer() * (FL + PD) / (FL + d)
  }

  _colToScreenX(worldCol, worldRow) {
    return this._sw / 2 + (worldCol - this._perspCamCol()) * this._scaleAtRow(worldRow)
  }


  _vertexH(col, row) {
    const hm = this._heightMapSrc
    if (!hm) return 0
    if (col < 0 || row < 0 || col >= this._hmW || row >= this._hmH) return 0
    return hm[row][col] ?? 0
  }

  _tileHeightAt(col, row) {
    if (!this._heightMapSrc) return 0
    return (this._vertexH(col,   row  )
          + this._vertexH(col+1, row  )
          + this._vertexH(col,   row+1)
          + this._vertexH(col+1, row+1)) * 0.25
  }

  perspectiveProject(worldTileX, worldTileY) {
    const screenY = this._rowToScreenY(worldTileY + 1)
    if (screenY === null || screenY < this._horizonPx() || screenY > this._sh + this.tileDisplaySize) return null
    const scale   = this._scaleAtRow(worldTileY + 1) / this.tileDisplaySize
    const screenX = this._colToScreenX(worldTileX + 0.5, worldTileY + 1)
    return { screenX, screenY, scale }
  }

  _projectLogical(logicalPixelX, logicalPixelY, allowOffscreen=false) {
    const ts         = this.tileDisplaySize
    const worldTileX = logicalPixelX / ts - 0.5
    const worldTileY = logicalPixelY / ts - 0.5
    if (allowOffscreen) {
      const screenY = this._rowToScreenY(worldTileY + 1)
      if (screenY === null || screenY < this._horizonPx()) return null
      const scale   = this._scaleAtRow(worldTileY + 1) / this.tileDisplaySize
      const screenX = this._colToScreenX(worldTileX + 0.5, worldTileY + 1)
      return { screenX, screenY, scale }
    }
    return this.perspectiveProject(worldTileX, worldTileY)
  }

  applyPerspective(sprite, worldPixelX, worldPixelY, tileSize, baseDisplaySize) {
    const proj = this._projectLogical(worldPixelX, worldPixelY)
    if (!proj) { sprite.setVisible(false); return false }
    const cam  = this.scene.cameras.main
    const zoom = this._zoom()
    sprite.setPosition(proj.screenX / zoom + cam.scrollX, proj.screenY / zoom + cam.scrollY)
    const displayPx = Math.round(proj.scale * (baseDisplaySize ?? tileSize * 2) / zoom)
    sprite.setDisplaySize(displayPx, displayPx)
    sprite.setVisible(true)
    return true
  }

  // Tileset + tile/tint caches live in pgr/pgrTileCache.js.
  _srcRect(gid) { return PGRTiles.srcRect(this, gid) }

  _getTileCanvas(gid) { return PGRTiles.getTileCanvas(this, gid) }

  _getTileAvgColor(gid) { return PGRTiles.getTileAvgColor(this, gid) }

  // LOD replacement for _drawTrapezoidTinted: one flat path-fill in the
  // tile's average colour with its tint pre-blended in arithmetic (no
  // clip, no setTransform, no composite pass -- the three expensive
  // parts of the textured path). Only ever called for rows narrower
  // than LOD_MIN_ROW_PX, where the texture couldn't be seen anyway.
  // Returns false (without drawing) if the average colour isn't
  // available yet, so the caller can fall back to the textured draw:
  //   if (!lodRow || !this._lodFillQuad(...)) this._drawTrapezoidTinted(...)
  _lodFillQuad(ctx, gid, tint, alpha, tl, tr, bl, br) {
    const avg = this._getTileAvgColor(gid)
    if (!avg) return false
    let r = avg.r, g = avg.g, b = avg.b
    if (tint) {
      const ta  = Math.min(1, tint.alpha ?? 0.45)
      const rgb = hslToRgb(tint.h, tint.s, tint.l)
      r += (rgb[0] - r) * ta
      g += (rgb[1] - g) * ta
      b += (rgb[2] - b) * ta
    }
    this._profLod = (this._profLod ?? 0) + 1
    ctx.globalAlpha = alpha
    ctx.fillStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'
    ctx.beginPath()
    ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y)
    ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y)
    ctx.closePath(); ctx.fill()
    ctx.globalAlpha = 1.0
    return true
  }

  _isValidTilesetGid(gid) { return PGRTiles.isValidTilesetGid(this, gid) }

  _drawAffineTriangle(ctx, img, t0, t1, t2, p0, p1, p2) {
    const { u: u0, v: v0 } = t0, { u: u1, v: v1 } = t1, { u: u2, v: v2 } = t2
    const det = u0*(v1-v2) - u1*(v0-v2) + u2*(v0-v1)
    if (Math.abs(det) < 0.00001) return
    const a = (p0.x*(v1-v2) + p1.x*(v2-v0) + p2.x*(v0-v1)) / det
    const c = (p0.x*(u2-u1) + p1.x*(u0-u2) + p2.x*(u1-u0)) / det
    const e =  p0.x - a*u0 - c*v0
    const b = (p0.y*(v1-v2) + p1.y*(v2-v0) + p2.y*(v0-v1)) / det
    const d = (p0.y*(u2-u1) + p1.y*(u0-u2) + p2.y*(u1-u0)) / det
    const f =  p0.y - b*u0 - d*v0
    // BLEED: how far each triangle's own clip boundary expands outward
    // from its centroid, so adjacent tiles' expanded regions overlap
    // slightly rather than leaving a hairline gap between them (visible
    // as thin lines revealing whatever's drawn UNDER this same canvas --
    // e.g. the base ground-fill -- at tile boundaries, worse at some
    // zoom levels/tile sizes than others). Bumped up from 1.75 as a
    // direct test of whether the existing seam is simply not quite wide
    // enough, rather than a deeper coordinate-mismatch issue.
    const BLEED = 3
    const cx    = (p0.x + p1.x + p2.x) / 3
    const cy    = (p0.y + p1.y + p2.y) / 3
    const expand = (p) => ({
      x: p.x + (p.x - cx < 0 ? -BLEED : BLEED),
      y: p.y + (p.y - cy < 0 ? -BLEED : BLEED),
    })
    const e0 = expand(p0), e1 = expand(p1), e2 = expand(p2)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y)
    ctx.closePath(); ctx.clip()
    ctx.setTransform(a, b, c, d, e, f)
    ctx.drawImage(img, 0, 0)
    ctx.restore()
  }

  _drawTrapezoidTinted(ctx, gid, tl, tr, bl, br, tint) {
    this._profTex = (this._profTex ?? 0) + 1
    const img = this._getTileCanvas(gid)
    if (!img) return
    const W = img.width, H = img.height
    this._drawAffineTriangle(ctx, img, {u:0,v:0},{u:W,v:0},{u:W,v:H}, tl, tr, br)
    this._drawAffineTriangle(ctx, img, {u:0,v:0},{u:W,v:H},{u:0,v:H}, tl, br, bl)
    if (tint) {
      const { h, s, l, alpha } = tint
      ctx.save()
      ctx.globalCompositeOperation = 'source-atop'
      ctx.globalAlpha = alpha ?? 0.45
      ctx.fillStyle   = `hsl(${h},${s}%,${l}%)`
      ctx.beginPath()
      ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y)
      ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y)
      ctx.closePath(); ctx.fill()
      ctx.restore()
    }
  }

  _drawTrapezoid(ctx, gid, tl, tr, bl, br) {
    this._drawTrapezoidTinted(ctx, gid, tl, tr, bl, br, null)
  }

  _drawBillboard(ctx, img, screenX, screenY, scaledTileW, heightMult) {
    const hm      = heightMult ?? PerspectiveGroundRenderer.HEIGHT_MULTIPLIER
    const scaledW = scaledTileW
    const scaledH = scaledTileW * hm
    ctx.drawImage(img, Math.round(screenX - scaledW / 2), Math.round(screenY - scaledH), Math.round(scaledW), Math.round(scaledH))
  }

  _drawBillboardTinted(ctx, img, screenX, screenY, scaledTileW, heightMult, tintHSL, tintAlpha, tileCol = 0, tileRow = 0) {
    const hm      = heightMult ?? PerspectiveGroundRenderer.HEIGHT_MULTIPLIER
    const scaledW = scaledTileW
    const scaledH = scaledTileW * hm
    const dx      = screenX - scaledW / 2
    const dy      = screenY - scaledH
    const _vi    = tmHashPGR(tileCol, tileRow) & 7
    const tinted = this._getBakedTintCanvas(img, tintHSL, tintAlpha ?? 0.38, _vi)
    ctx.drawImage(tinted ?? img, dx, dy, scaledW, scaledH)
  }

  _getBakedTintCanvas(img, tintHSL, alpha, variantIndex = 0) { return PGRTiles.getBakedTintCanvas(this, img, tintHSL, alpha, variantIndex) }

  _elevationY(worldRow, elevation) {
    const baseY = this._rowToScreenY(worldRow)
    if (!elevation || baseY === null) return baseY
    const pxPerTile = this._scaleAtRow(worldRow)
    return baseY - elevation * pxPerTile
  }

  // Cliff/elevation faces live in pgr/pgrCliffFaces.js. All five keep
  // delegates here because ElevationRenderer (external) may call them.
  _drawNorthCliffFace(ctx, col, row, elev, tileAlpha, yTopClamped, yBotClamped) { PGRCliffs.drawNorthCliffFace(this, ctx, col, row, elev, tileAlpha, yTopClamped, yBotClamped) }

  _drawElevatedFace(ctx, col, row, elev, gid, tileAlpha, yBotHint) { PGRCliffs.drawElevatedFace(this, ctx, col, row, elev, gid, tileAlpha, yBotHint) }

  _drawElevatedSideFace(ctx, edgeCol, row, elev, gid, tileAlpha) { PGRCliffs.drawElevatedSideFace(this, ctx, edgeCol, row, elev, gid, tileAlpha) }

  _drawCliffSide(ctx, col, row, elev, neighbourRow, sideDir, tileAlpha) { PGRCliffs.drawCliffSide(this, ctx, col, row, elev, neighbourRow, sideDir, tileAlpha) }

  _drawCliffFace(ctx, col, row, elev, tileAlpha) { PGRCliffs.drawCliffFace(this, ctx, col, row, elev, tileAlpha) }

  // North-neighbour preview lives in pgr/pgrNorthPreview.js.
  _drawNorthPreviewRow(tileRow, camCol, sw, horizonPx, playerTileRow) { PGRPreview.drawNorthPreviewRow(this, tileRow, camCol, sw, horizonPx, playerTileRow) }

  update(fov) {
    if (!this._ready) return
    if (!this._cameraReady()) return
    const _canvas = this.scene.game.canvas
    const _newSw = _canvas.width, _newSh = _canvas.height
    if (_newSh !== this._sh) console.log('[PGR resize] sh:', this._sh, '->', _newSh)
    if (_newSw !== this._sw || _newSh !== this._sh) {
      this._boatScreenX = null
      this._boatScreenY = null
      this._hlX = null
      this._hlY = null
    }
    this._sw = _newSw
    this._sh = _newSh
    this._waterPhase = ((this._waterPhase ?? 0) + 0.018) % 256
    PGRSky.updateSkyAnimation(this)

    const cam  = this.scene.cameras.main
    const zoom = this._zoom()


const bowAiming = this.scene.bowMechanics?.isAiming ?? false
const now = Date.now()
// Skip redraw when idle (player stationary, camera/zoom unchanged, 8s+
// since last movement) -- a battery-saving optimization. BUT: this
// early-return previously fired regardless of whether anything else in
// the scene needed continuous per-frame animation (water tile phase,
// fire particles, canopy sway, etc.) -- those all silently froze
// whenever the player stood still for 8+ seconds, confirmed across
// multiple unrelated systems. hasContinuousAnimation() lets a scene opt
// out of the skip when it has animation that must keep running
// regardless of player/camera movement; defaults to false (preserving
// the original battery-saving behaviour) for scenes that don't define it.
const hasContinuousAnim = this.scene?.hasContinuousAnimation?.() ?? false
if (this._player && !this._player.isMoving && this._lastMoveTime && !hasContinuousAnim) {
  if (now - this._lastMoveTime > 8000) {
    if (cam.scrollX === this._lastCamX &&
        cam.scrollY === this._lastCamY &&
        zoom        === this._lastCamZoom &&
        !bowAiming) return
  }
}


    if (this._player?.isMoving) this._lastMoveTime = now

    this._lastCamX    = cam.scrollX
    this._lastCamY    = cam.scrollY
    this._lastCamZoom = zoom

    // Frame profiler start -- placed AFTER the idle-skip early return
    // above so cheap skipped frames don't drag the average down and
    // hide the true cost of a real redraw. Reported every ~3s at the
    // end of update().
    const _profT0 = performance.now()
    this._profTex = 0
    this._profLod = 0

    this._refreshPlayerCanvas()
    this.playerScreenX = null
    this.playerScreenY = null

    const sw        = this._sw
    const sh        = this._sh
    const FL        = PerspectiveGroundRenderer.FOCAL_LENGTH
    const horizonPx = this._horizonPx()
    const EX        = PerspectiveGroundRenderer.EDGE_EXTEND

    const layer0 = this.scene.mapData?.layers?.[0]
    const layer1 = this.scene.mapData?.layers?.[1] ?? null
    const layer2 = this.scene.mapData?.layers?.[2] ?? null
    const layer3 = this.scene.mapData?.layers?.[3] ?? null
    const layer4 = this.scene.mapData?.layers?.[4] ?? null
    if (!layer0) return

    if (this.scene.mapData?.heightMap !== this._heightMapSrc) {
      this._heightMapSrc = this.scene.mapData?.heightMap ?? null
      this._hmW = (this.scene.mapData?.width  ?? 0) + 1
      this._hmH = (this.scene.mapData?.height ?? 0) + 1
    }

    if (!this._elev && this.scene.mapData?.hasCliffs) {
      if (!this._elevWarnedOnce) {
        this._elevWarnedOnce = true
        console.warn('[PGR] hasCliffs map but no ElevationRenderer found. ' +
          'Add: this.elevationRenderer = new ElevationRenderer(this.perspectiveGround, config) ' +
          'and call this.elevationRenderer.update(this.mapData) before perspectiveGround.update().')
      }
    }

    const mapH   = layer0.length
    const mapW   = layer0[0].length
    const camRow = this._perspCamRow()
    const camCol = this._perspCamCol()

    // Computed here (earlier than previously) so the base-fill below can
    // clip its own top edge to match -- see that fill's own note.
    const tileRowEnd   = Math.min(Math.floor(camRow) - 1, mapH - 1 + EX * 3)
    const _northPreviewFloor = this._northNeighbor ? -PerspectiveGroundRenderer.NORTH_PREVIEW_DEPTH : 0
    const tileRowStart = Math.max(_northPreviewFloor, Math.floor(camRow - FL * 8))

    // Sample the PLAYER's own current tile for the fill colour, not a
    // fixed map corner -- the player is standing on it, so it's
    // guaranteed to be typical, walkable ground. A fixed corner sample
    // (the old approach) could land on water, forest-floor, or any
    // other atypical tile depending on the specific map, producing a
    // fill colour that visibly clashed with the actual ground shown
    // everywhere else on screen (confirmed: a dark teal/olive band,
    // matching a water-tile tint, on a map where the corner cell
    // happened to be water).
    const _playerCol = this.scene.player
      ? Math.floor(this.scene.player.logicalX / this.tileDisplaySize) : null
    const _playerRow = this.scene.player
      ? Math.floor(this.scene.player.logicalY / this.tileDisplaySize) : null
    const fillGid  = (_playerRow != null && layer0[_playerRow]?.[_playerCol])
      || layer0[mapH - 1]?.[Math.floor(mapW / 2)] || 733
    const fillTint = this.tintManager.getTint(fillGid, 0, 0)

    this._gCtx.clearRect(0, 0, sw, sh)
    if (!this._domChecked) {
      this._domChecked = true
      const allPgr = document.querySelectorAll('[id^=pgr-ground]')
      if (allPgr.length > 1) {
        console.warn('[PGR v8] WARNING: ' + allPgr.length + ' pgr-ground canvases in DOM — stale HMR canvas detected!')
        allPgr.forEach((el, i) => console.warn('  [' + i + ']', el.id, 'z:' + el.style.zIndex, el === this._groundCanvas ? '← THIS INSTANCE' : '← STALE'))
      } else {
        console.log('[PGR v8] DOM check OK — single pgr-ground canvas')
      }
    }
    const bottomRow  = Math.min(Math.floor(camRow) - 1, mapH - 1)
    const leftX      = this._colToScreenX(0,    bottomRow + 1)
    const rightX     = this._colToScreenX(mapW, bottomRow + 1)
    const clipLeft   = Math.max(0,  leftX)
    const clipRight  = Math.min(sw, rightX)
    const clipW      = Math.max(0,  clipRight - clipLeft)

    // Flat fill across the WHOLE ground area, using the CURRENT map's
    // own actual ground tint. Drawn ONCE, before any tile, across the
    // full width -- this is what masks the many small seams between
    // adjacent perspective-warped tiles (see _drawAffineTriangle's
    // BLEED constant, which reduces but doesn't fully eliminate them).
    // Deliberately NOT a gradient toward any sky-derived colour any
    // more: this fill only ever shows through TINY seams BETWEEN two
    // ground tiles that are both otherwise rendering correctly -- it
    // never represents "the true edge of the world," so there's no
    // reason for it to ever look like sky. An earlier version gradiented
    // toward this._gcR (sky-derived) across the fill's full height,
    // which read as a stark dark bar cutting across the screen --
    // _gcR was computed for a totally different, narrow original
    // purpose (a subtle 160px transition band) and is deliberately dark
    // by design, so stretching it across a much taller area made that
    // darkness far more visually prominent than intended.
    const _nearH = fillTint?.h ?? 100
    const _nearS = fillTint?.s ?? 25
    const _nearL = fillTint?.l ?? 30
    const _nearColor = `hsl(${_nearH},${_nearS}%,${_nearL}%)`

    // Top edge clipped to wherever the tile-rendering loop (below) ACTUALLY
    // begins this frame (tileRowStart's own screen position), not the
    // fixed true-horizon line. A finite map's northernmost row can only
    // ever approach the true horizon asymptotically -- it reaches it
    // exactly only when a north-preview is successfully extending
    // content that far. Anywhere that isn't the case (no working north-
    // neighbour for this scene, fetch failed, etc.), tiles stop well
    // short of horizonPx, and filling all the way up to horizonPx
    // regardless exposed this fill as a big flat rectangle sitting
    // above the tiles -- confirmed via screenshot. Using
    // Math.max(horizonPx, ...) means this only ever pulls the fill's
    // top edge DOWN to match the tiles (never past horizonPx itself),
    // so it stays a no-op whenever a preview already reaches that far.
    const _fillTopY = Math.max(horizonPx, this._rowToScreenY(tileRowStart) ?? horizonPx)
    this._gCtx.fillStyle = _nearColor
    this._gCtx.fillRect(0, _fillTopY, sw, sh - _fillTopY)
    if (this.scene?.getMapKey?.()?.includes('sea') || this.scene?.getMapKey?.()?.includes('d3')) {
      this._gCtx.fillStyle = '#2a3f5a'
      this._gCtx.fillRect(0, sh - 40, sw, 40)
    }

    const _lastRowScreenY = this._rowToScreenY(mapH)
    if (_lastRowScreenY !== null && _lastRowScreenY < sh) {
      this._gCtx.fillStyle = _nearColor
      this._gCtx.fillRect(0, Math.max(horizonPx, Math.floor(_lastRowScreenY)), sw,
        sh - Math.max(horizonPx, Math.floor(_lastRowScreenY)))
    }

    this._oCtx.clearRect(0, 0, sw, sh)
    if (!this._debugged) console.log('[PGR v8] frame: horizonPx=' + horizonPx + ' sw=' + sw + ' sh=' + sh + ' hasCliffs=' + !!(this.scene.mapData?.hasCliffs) + ' elevActive=' + !!(this._elev))
    this._oCtx.save()
    this._oCtx.beginPath()
    this._oCtx.rect(0, horizonPx, sw, sh - horizonPx)
    this._oCtx.clip()
    this._gCtx.save()
    this._gCtx.beginPath()
    this._gCtx.rect(0, horizonPx, sw, sh - horizonPx)
    this._gCtx.clip()

    const p = this._player
    let playerTileRow = -1
    let playerScreenX = sw / 2
    let playerScreenY = sh / 2
    let playerDrawn   = false

    if (p) {
     
const proj  = this._projectLogical(p.logicalX, p.logicalY)


	    if (proj) {
        const _ptCol     = Math.floor((p.targetX ?? p.logicalX) / this.tileDisplaySize)
        const _ptRow     = Math.floor((p.targetY ?? p.logicalY) / this.tileDisplaySize)
        const _ptGid     = this.scene.mapData?.layers?.[0]?.[_ptRow]?.[_ptCol] ?? 0
        const _ptIsWater = _ptGid === 1625 || _ptGid === 1679 || _ptGid === 731
        const _pHt       = _ptIsWater ? 0
          : (this._vertexH(_ptCol, _ptRow + 1) + this._vertexH(_ptCol + 1, _ptRow + 1)) * 0.5
        playerScreenX = proj.screenX
        playerScreenY = proj.screenY
        this._playerTerrainLift = _pHt * this._scaleAtRow(_ptRow + 1)
        playerTileRow = _ptRow
        this.playerScreenX = playerScreenX
        this.playerScreenY = playerScreenY - this._playerTerrainLift
      }
    }

    let groundCount = 0, objectCount = 0
    const _deferredCliffs = []

    for (let tileRow = tileRowStart; tileRow <= tileRowEnd; tileRow++) {

      // North-preview rows (beyond the current map's own row 0) go
      // through a dedicated, much simpler path -- see _drawNorthPreviewRow's
      // own header note for why this isn't woven into the logic below.
      if (tileRow < 0) {
        this._drawNorthPreviewRow(tileRow, camCol, sw, horizonPx, playerTileRow)
        continue
      }

      const yTop = this._rowToScreenY(tileRow)
      const yBot = this._rowToScreenY(tileRow + 1)

      if (yBot === null) continue
      if (yTop !== null && yTop > sh + 100) continue
      if (yBot < horizonPx - this.tileDisplaySize * 3) continue

      const yTopClamped = (yTop === null || yTop < horizonPx - this.tileDisplaySize) ? horizonPx - this.tileDisplaySize : yTop
      const yBotClamped = Math.min(sh + 100, yBot)
      if (yBotClamped <= yTopClamped) continue

      const distFromHorizon = yBotClamped - horizonPx
      const horizonFade     = distFromHorizon < 60 ? Math.max(0, distFromHorizon / 60) : 1.0

      const scaleNear = this._scaleAtRow(tileRow + 1)
      const halfCols  = scaleNear > 0.001 ? (sw / 2) / scaleNear + 1 : mapW

      // Whole-row LOD decision -- see LOD_MIN_ROW_PX. Rows this far
      // back are exactly the ones whose column counts explode, so this
      // is where the flat-fill path pays for itself.
      const lodRow = yTop === null || (yBot - yTop) < PerspectiveGroundRenderer.LOD_MIN_ROW_PX

      const colStart = Math.floor(camCol - halfCols) - EX
      const colEnd   = Math.ceil(camCol + halfCols)  + EX

      const rowInMap = tileRow >= 0 && tileRow < mapH

      for (let tileCol = colStart; tileCol <= colEnd; tileCol++) {

        const xTL = this._colToScreenX(tileCol,     tileRow)
        const xTR = this._colToScreenX(tileCol + 1, tileRow)
        if (xTR < -10 || xTL > sw + 10) continue

        const colInMap = tileCol >= 0 && tileCol < mapW
        const inMap    = rowInMap && colInMap

        if (!inMap) {
          // Phantom tiles: mirror-reflect the map's OWN real ground data
          // into the region beyond its edge (columns run out east/west
          // of a valid row -- the oblique-angle cutoff; or rows run out
          // south of the map), rather than inventing a synthetic
          // colour. Mirroring (not straight wrap-repeat) guarantees the
          // seam at the REAL edge is continuous -- the first phantom
          // column/row exactly re-shows the last real one, then
          // reflects inward -- since a plain repeat would reintroduce a
          // hard seam wherever the map's own far edges don't happen to
          // match. Uses the SAME textured trapezoid draw real tiles
          // use, at the REAL (unmirrored) screen position, so the
          // shape stays perspective-correct and the texture/height/
          // tint are genuine, not synthesized.
          //
          // Scope: ground only for now -- not cliffs, water-bank
          // dithering, buildings, or encounter flags (duplicating those
          // would be actively confusing, not just visually flat), and
          // not trees (individual trunks are keyed to real tile
          // coordinates in a way that needs its own transform to
          // duplicate correctly -- a natural next step, not attempted
          // here).
          const isPhantomCol = rowInMap && !colInMap
          const isPhantomRow = !rowInMap && colInMap && tileRow >= mapH
          if (isPhantomCol || isPhantomRow) {
            // Skip the expensive part (tint lookup + textured draw)
            // when this row is ALREADY faded to near-invisibility
            // (horizonFade, computed once per row above) -- the base
            // background fill drawn before this loop already shows
            // through correctly in that case, so there's nothing lost
            // visually. NOT a hard distance cap: an earlier version
            // capped mirrored coverage to a fixed tile margin, which
            // directly reintroduced a visible gap wherever a row's
            // required column range exceeded that margin (confirmed --
            // perspective genuinely needs more columns near the
            // horizon, that's not wasted work to be capped away).
            if (horizonFade < 0.03) { continue }

            const mCol = isPhantomCol ? mirrorIndex(tileCol, mapW) : tileCol
            const mRow = isPhantomRow ? mirrorIndex(tileRow, mapH) : tileRow

            const mGidRaw = layer0[mRow]?.[mCol] ?? 0
            if (mGidRaw && this._isValidTilesetGid(mGidRaw)) {
              const _isWaterM = mGidRaw === 1625 || mGidRaw === 1679
              const mGid = _isWaterM
                ? (((Math.floor(this._waterPhase + mCol * 0.7 - mRow * 0.3)) & 1) ? 1625 : 1679)
                : mGidRaw

              let mTint
              if (this._heightMapSrc && GID_CATEGORIES_GROUND.has(mGid)) {
                const _h00 = this._vertexH(mCol,     mRow)
                const _h10 = this._vertexH(mCol + 1, mRow)
                const _h01 = this._vertexH(mCol,     mRow + 1)
                const _h11 = this._vertexH(mCol + 1, mRow + 1)
                const _pdM = this.scene.mapData?.pathDist?.[mRow]?.[mCol] ?? null
                mTint = this.tintManager.getGroundTint(mGid, mCol, mRow, _h00, _h10, _h01, _h11, _pdM)
              } else {
                mTint = this.tintManager.getTint(mGid, mCol, mRow)
              }

              // Elevation offset comes from the MIRRORED tile's own
              // real height (so hills/contours genuinely repeat),
              // applied at the REAL (unmirrored) screen corners --
              // EXCEPT for water, which the real-tile path (below,
              // `_isGroundWater`) deliberately renders FLAT regardless
              // of the heightmap, so it doesn't ripple with terrain
              // contours. This phantom path was missing that same
              // check: it applied the height offset to water GIDs too,
              // so the moment a river/lake tile crossed from the last
              // real column into its mirrored phantom column, water
              // jumped from flat to height-offset -- a visible step
              // fixed exactly at the map edge in world space. Mirroring
              // itself was already correct (mirrorIndex(-1, n) = 0, so
              // the phantom column's GID and tint exactly match the
              // real edge column) -- only the water flatness rule
              // wasn't carried over.
              const _isPhantomWater = mGidRaw === 1625 || mGidRaw === 1679 || mGidRaw === 731
              const _sTop = this._scaleAtRow(tileRow)
              const _sBot = this._scaleAtRow(tileRow + 1)
              const _hL0 = _isPhantomWater ? 0 : this._vertexH(mCol,     mRow)
              const _hR0 = _isPhantomWater ? 0 : this._vertexH(mCol + 1, mRow)
              const _hL1 = _isPhantomWater ? 0 : this._vertexH(mCol,     mRow + 1)
              const _hR1 = _isPhantomWater ? 0 : this._vertexH(mCol + 1, mRow + 1)
              const _pxBL = this._colToScreenX(tileCol,     tileRow + 1)
              const _pxBR = this._colToScreenX(tileCol + 1, tileRow + 1)

              const _pTL = { x: xTL,   y: yTopClamped - _hL0 * _sTop }
              const _pTR = { x: xTR,   y: yTopClamped - _hR0 * _sTop }
              const _pBL = { x: _pxBL, y: yBotClamped - _hL1 * _sBot }
              const _pBR = { x: _pxBR, y: yBotClamped - _hR1 * _sBot }
              this._gCtx.globalAlpha = horizonFade
              // LOD: phantom tiles are the single biggest contributor to
              // the distant-row column explosion (they fill everything
              // beyond the map edge), so the flat-fill path matters most
              // here. Falls back to the textured draw if the average
              // colour isn't ready yet.
              if (!lodRow || !this._lodFillQuad(this._gCtx, mGid, mTint, horizonFade, _pTL, _pTR, _pBL, _pBR)) {
                this._drawTrapezoidTinted(this._gCtx, mGid, _pTL, _pTR, _pBL, _pBR, mTint)
              }
              this._gCtx.globalAlpha = 1.0
            }
          }
          continue
        }

        const edgeDist  = Math.min(tileRow, tileCol, mapH - 1 - tileRow, mapW - 1 - tileCol)
        const edgeAlpha = edgeDist === 0 ? 0.85
                        : edgeDist === 1 ? 0.92
                        : edgeDist === 2 ? 0.97
                        : 1.0

        if (fov && fov.isHidden(tileCol, tileRow)) continue

        const tileAlpha = edgeAlpha * horizonFade

        const _rawGid0 = layer0[tileRow]?.[tileCol] ?? 0
        const _isWater = _rawGid0 === 1625 || _rawGid0 === 1679
        const gid0 = _isWater
          ? (((Math.floor(this._waterPhase + tileCol * 0.7 - tileRow * 0.3)) & 1) ? 1625 : 1679)
          : _rawGid0

        if (gid0) {
          const tileElev  = this._elev?.[tileRow]?.[tileCol]  ?? 0
          const southElev = (tileRow + 1 < mapH)
            ? (this._elev?.[tileRow + 1]?.[tileCol] ?? 0)
            : 0

          let yTopElev = yTopClamped
          if (tileElev > 0) {
            const raw = this._elevationY(tileRow, tileElev)
            yTopElev  = (raw === null || raw < horizonPx - this.tileDisplaySize)
              ? horizonPx - this.tileDisplaySize
              : Math.min(sh + 100, raw)
          }

          const xBL = this._colToScreenX(tileCol,     tileRow + 1)
          const xBR = this._colToScreenX(tileCol + 1, tileRow + 1)
          this._gCtx.globalAlpha = tileAlpha

          if (PerspectiveGroundRenderer.DEBUG_RECTS) {
            const colors = ['rgba(255,0,0,0.5)','rgba(0,200,0,0.5)',
                            'rgba(0,100,255,0.5)','rgba(255,200,0,0.5)']
            this._gCtx.fillStyle = colors[tileRow % colors.length]
            this._gCtx.beginPath()
            this._gCtx.moveTo(xTL, yTopElev); this._gCtx.lineTo(xTR, yTopElev)
            this._gCtx.lineTo(xBR, yBotClamped); this._gCtx.lineTo(xBL, yBotClamped)
            this._gCtx.closePath(); this._gCtx.fill()
          } else {
            let tint0
            if (!inMap) {
              tint0 = fillTint
            } else if (this._heightMapSrc && GID_CATEGORIES_GROUND.has(gid0)) {
              const _h00 = this._vertexH(tileCol,     tileRow    )
              const _h10 = this._vertexH(tileCol + 1, tileRow    )
              const _h01 = this._vertexH(tileCol,     tileRow + 1)
              const _h11 = this._vertexH(tileCol + 1, tileRow + 1)
              const _pd  = this.scene.mapData?.pathDist?.[tileRow]?.[tileCol] ?? null
              tint0 = this.tintManager.getGroundTint(gid0, tileCol, tileRow, _h00, _h10, _h01, _h11, _pd)
            } else {
              tint0 = this.tintManager.getTint(gid0, tileCol, tileRow)
            }

            const _sTop = this._scaleAtRow(tileRow)
            const _sBot = this._scaleAtRow(tileRow + 1)
            const _elevDeltaTop = tileElev > 0 ? (yTopElev - yTopClamped) : 0

            const _isGroundWater = _rawGid0 === 1625 || _rawGid0 === 1679 || _rawGid0 === 731
            const _yTL = _isGroundWater ? yTopClamped + _elevDeltaTop : yTopClamped + _elevDeltaTop - this._vertexH(tileCol,     tileRow    ) * _sTop
            const _yTR = _isGroundWater ? yTopClamped + _elevDeltaTop : yTopClamped + _elevDeltaTop - this._vertexH(tileCol + 1, tileRow    ) * _sTop
            const _yBL = _isGroundWater ? yBotClamped                 : yBotClamped                 - this._vertexH(tileCol,     tileRow + 1) * _sBot
            const _yBR = _isGroundWater ? yBotClamped                 : yBotClamped                 - this._vertexH(tileCol + 1, tileRow + 1) * _sBot

            PGRBanks.drawNorthWaterFace(this, this._gCtx, layer0, tileCol, tileRow,
              tileAlpha, yTopClamped, xTL, xTR, _yTL, _yTR, _isGroundWater)

            const _qTL = { x: xTL, y: _yTL }, _qTR = { x: xTR, y: _yTR }
            const _qBL = { x: xBL, y: _yBL }, _qBR = { x: xBR, y: _yBR }
            // LOD: same corner coords either way, so terrain contours
            // and elevation offsets are preserved -- only the interior
            // texture (invisible at this size) is replaced.
            if (!lodRow || !this._lodFillQuad(this._gCtx, gid0, tint0, tileAlpha, _qTL, _qTR, _qBL, _qBR)) {
              this._drawTrapezoidTinted(this._gCtx, gid0, _qTL, _qTR, _qBL, _qBR, tint0)
            }

            const _hasSouthFace = inMap && tileElev > 0 && southElev < tileElev
              && yBotClamped >= horizonPx + 30
              && !(layer3?.[tileRow]?.[tileCol])

            PGRBanks.drawWaterBanks(this, this._gCtx, layer0, tileCol, tileRow,
              tileAlpha, horizonPx, yBotClamped, _yTL, _yTR, _yBL, _yBR, _isGroundWater)

            if (_hasSouthFace) {
              const _isCliffEdge = PerspectiveGroundRenderer.CLIFF_GIDS.has(
                this.scene.mapData?.layers?.[1]?.[tileRow]?.[tileCol] ?? 0)
              _deferredCliffs.push({
                col: tileCol, row: tileRow, elev: tileElev, alpha: tileAlpha,
                gid: gid0, yBot: yBotClamped,
                isCliff: _isCliffEdge
              })
            }

            const _eastElev = (tileCol + 1 < mapW)
              ? (this._elev?.[tileRow]?.[tileCol + 1] ?? 0) : 0
            if (inMap && tileElev > 0 && _eastElev < tileElev
                && yBotClamped >= horizonPx + 30) {
              _deferredCliffs.push({
                col: tileCol, row: tileRow, elev: tileElev, alpha: tileAlpha,
                gid: gid0, yBot: yBotClamped, isCliff: false, faceDir: 'east'
              })
            }

            const _westElev = (tileCol - 1 >= 0)
              ? (this._elev?.[tileRow]?.[tileCol - 1] ?? 0) : 0
            if (inMap && tileElev > 0 && _westElev < tileElev
                && yBotClamped >= horizonPx + 30) {
              _deferredCliffs.push({
                col: tileCol, row: tileRow, elev: tileElev, alpha: tileAlpha,
                gid: gid0, yBot: yBotClamped, isCliff: false, faceDir: 'west'
              })
            }

            if (inMap && this._exitEdges?.size) {
              const onExit = (
                (this._exitEdges.has('west')  && tileCol === 0) ||
                (this._exitEdges.has('east')  && tileCol === mapW - 1) ||
                (this._exitEdges.has('north') && tileRow === 0) ||
                (this._exitEdges.has('south') && tileRow === mapH - 1)
              )
              if (onExit) {
                this._gCtx.save()
                this._gCtx.globalAlpha = 0.22 + 0.10 * Math.sin((this._exitPulseT||0) * 1.5 + tileCol + tileRow)
                this._gCtx.fillStyle = 'rgba(160,255,200,1)'
                this._gCtx.beginPath()
                this._gCtx.moveTo(xTL, _yTL)
                this._gCtx.lineTo(xTR, _yTR)
                this._gCtx.lineTo(xBR, _yBR)
                this._gCtx.lineTo(xBL, _yBL)
                this._gCtx.closePath()
                this._gCtx.fill()
                this._gCtx.restore()
              }
            }
          }
          this._gCtx.globalAlpha = 1.0
          groundCount++
        }

        // Player
        if (!playerDrawn && tileRow === playerTileRow && this._playerCanvas && p) {
          const scaledTileW = this._scaleAtRow(playerTileRow + 1)
          const playerHM    = (this._playerHeightMult ?? 1.8) * (this._playerScale ?? PerspectiveGroundRenderer.PLAYER_SCALE)
          this.playerSpriteH = scaledTileW * playerHM
          this._lastPlayerScale = this._playerScale ?? PerspectiveGroundRenderer.PLAYER_SCALE
          const aimAngle    = this.scene.bowMechanics?.isAiming
            ? this.scene.bowMechanics._currentAimAngle ?? null
            : null
          const _drawX = playerScreenX
          const _waveOff = this._boatActive ? (this._waveRideOffset ?? 0) : 0
          const _drawY = playerScreenY - (this._playerTerrainLift ?? 0) - _waveOff
          const _capsizeAngle = (this._boatActive && this.scene?._capsized)
            ? ((this._capsizeFlip ?? 0) * Math.PI) : 0
          this._drawWeaponOverlay(_drawX, _drawY, scaledTileW, aimAngle)
          if (_capsizeAngle > 0.01) {
            this._oCtx.save()
            this._oCtx.translate(_drawX, _drawY)
            this._oCtx.rotate(_capsizeAngle)
            this._oCtx.translate(-_drawX, -_drawY)
          }
          this._drawPlayerAnimated(this._oCtx, this._playerCanvas,
            _drawX, _drawY, scaledTileW, playerHM)
          if (_capsizeAngle > 0.01) this._oCtx.restore()
          playerDrawn = true
        }

        const _l1Elev   = (inMap && this._elev) ? (this._elev[tileRow]?.[tileCol] ?? 0) : 0
        let _l1YTop = yTopClamped, _l1YBot = yBotClamped
        if (_l1Elev > 0) {
          const _shoreY     = this._rowToScreenY(tileRow + 1)
          const _tileH      = this._scaleAtRow(tileRow + 1)
          const _cliffTop   = (_shoreY !== null) ? _shoreY - _tileH * _l1Elev : null
          const _cliffBot   = _shoreY
          _l1YTop = (_cliffTop !== null) ? Math.max(horizonPx, _cliffTop) : yTopClamped
          _l1YBot = (_cliffBot !== null) ? Math.min(sh + 100, _cliffBot) : yBotClamped
        }
        if (inMap && layer1) {
          const gid1 = layer1[tileRow]?.[tileCol]
          if (gid1) {
            const isStamp     = OAK_STAMP_GIDS.has(gid1) || BOG_STAMP_GIDS.has(gid1) || WITHERED_STAMP_GIDS.has(gid1)
            const isBillboard = this._flatGids.has(gid1)

            if (isStamp || isBillboard) {
              const screenX     = this._colToScreenX(tileCol + 0.5, tileRow + 1)
              const scaledTileW = this._scaleAtRow(tileRow + 1)
              const isCliffFace = PerspectiveGroundRenderer.CLIFF_GIDS.has(gid1)
              if (isCliffFace && _l1Elev > 0) {
                // already drawn by cliff system
              } else {
                const _rawBillY = this._rowToScreenY(tileRow + 1)
                const _bhScale  = this._scaleAtRow(tileRow + 1)
                const _bGid0    = layer0[tileRow]?.[tileCol] ?? 0
                const _bIsWater = _bGid0 === 1625 || _bGid0 === 1679 || _bGid0 === 731
                const _bHt      = _bIsWater ? 0 : this._tileHeightAt(tileCol, tileRow)
                const screenY   = _rawBillY !== null
                  ? _rawBillY - _bHt * _bhScale
                  : null
                if (screenY !== null &&
                    screenY >= horizonPx &&
                    screenY <= sh + this.tileDisplaySize * 2) {
                  this._oCtx.globalAlpha = tileAlpha
                  const img1 = this._getTileCanvas(gid1)
                  if (img1) {
                    const _tint1 = this.tintManager.getTint(gid1, tileCol, tileRow)
                    if (_tint1) {
                      this._drawBillboardTinted(this._oCtx, img1,
                        screenX, screenY, scaledTileW,
                        PerspectiveGroundRenderer.HEIGHT_MULTIPLIER,
                        _tint1, _tint1.alpha, tileCol, tileRow)
                    } else {
                      this._drawBillboard(this._oCtx, img1, screenX, screenY, scaledTileW)
                    }
                  }
                  this._oCtx.globalAlpha = 1.0
                }
              }
            } else {
              const xBL1 = this._colToScreenX(tileCol,     tileRow + 1)
              const xBR1 = this._colToScreenX(tileCol + 1, tileRow + 1)
              const _l1sTop = this._scaleAtRow(tileRow)
              const _l1sBot = this._scaleAtRow(tileRow + 1)
              const _l1elevDelta = _l1Elev > 0 ? (_l1YTop - yTopClamped) : 0
              const _l1GidIsWater = (layer0[tileRow]?.[tileCol] ?? 0) === 1625
                || (layer0[tileRow]?.[tileCol] ?? 0) === 1679
                || (layer0[tileRow]?.[tileCol] ?? 0) === 731
              const _l1TL = _l1GidIsWater ? yTopClamped + _l1elevDelta : yTopClamped + _l1elevDelta - this._vertexH(tileCol,     tileRow    ) * _l1sTop
              const _l1TR = _l1GidIsWater ? yTopClamped + _l1elevDelta : yTopClamped + _l1elevDelta - this._vertexH(tileCol + 1, tileRow    ) * _l1sTop
              const _l1BL = _l1GidIsWater ? yBotClamped                : yBotClamped                - this._vertexH(tileCol,     tileRow + 1) * _l1sBot
              const _l1BR = _l1GidIsWater ? yBotClamped                : yBotClamped                - this._vertexH(tileCol + 1, tileRow + 1) * _l1sBot
                           const tint1 = this.tintManager.getTint(gid1, tileCol, tileRow)
              this._gCtx.globalAlpha = tileAlpha
              this._drawTrapezoidTinted(this._gCtx, gid1,
                {x: xTL,  y: _l1TL}, {x: xTR,  y: _l1TR},
                {x: xBL1, y: _l1BL}, {x: xBR1, y: _l1BR},
                tint1)
              this._gCtx.globalAlpha = 1.0
            }
            objectCount++
          }
        }

        if (inMap && this._exitMarkers?.length) {
          for (const marker of this._exitMarkers) {
            if (marker.tileX !== tileCol || marker.tileY !== tileRow) continue
            const arrowCanvas = this._exitArrowCanvases?.[marker.dir]
            if (!arrowCanvas) continue
            const proj = this._projectLogical(
              (marker.tileX + 0.5) * this.tileDisplaySize,
              (marker.tileY + 0.5) * this.tileDisplaySize
            )
            if (!proj) continue
            const pulse = 0.5 + 0.5 * Math.sin((this._exitPulseT || 0) + marker.tileX)
            this._oCtx.globalAlpha = 0.6 + pulse * 0.4
            this._drawBillboard(this._oCtx, arrowCanvas,
              proj.screenX, proj.screenY,
              proj.scale * this.tileDisplaySize * 1.2, 1.4)
            this._oCtx.globalAlpha = 1.0
          }
        }

        if (inMap && layer2) {
          const gid2 = layer2[tileRow]?.[tileCol]
          if (gid2 && yBotClamped >= horizonPx + 30
              && _l1YTop >= horizonPx && _l1YBot > _l1YTop) {
            const tint2   = this.tintManager.getTint(gid2, tileCol, tileRow)
            const xBL2    = this._colToScreenX(tileCol,     tileRow + 1)
            const xBR2    = this._colToScreenX(tileCol + 1, tileRow + 1)
            this._gCtx.globalAlpha = tileAlpha
            this._drawTrapezoidTinted(this._gCtx, gid2,
              {x: xTL,  y: _l1YTop}, {x: xTR,  y: _l1YTop},
              {x: xBL2, y: _l1YBot}, {x: xBR2, y: _l1YBot},
              tint2)
            this._gCtx.globalAlpha = 1.0
          }
        }

        if (inMap && layer3) {
          const gid3 = layer3[tileRow]?.[tileCol]
          if (gid3 && yBotClamped >= horizonPx + 30) {
            const scaledW3 = this._scaleAtRow(tileRow + 1)
            const tileH3   = scaledW3 * PerspectiveGroundRenderer.CLIFF_HEIGHT
            const eTop     = yTopClamped - tileH3
            const eBot     = yBotClamped - tileH3
            if (eBot >= horizonPx && eTop < eBot) {
              const tint3 = this.tintManager.getTint(gid3, tileCol, tileRow)
              const xTL3 = this._colToScreenX(tileCol,     tileRow)
              const xTR3 = this._colToScreenX(tileCol + 1, tileRow)
              const xBL3 = this._colToScreenX(tileCol,     tileRow + 1)
              const xBR3 = this._colToScreenX(tileCol + 1, tileRow + 1)
              this._oCtx.globalAlpha = tileAlpha
              this._drawTrapezoidTinted(this._oCtx, gid3,
                {x: xTL3 - 1, y: eTop}, {x: xTR3 + 1, y: eTop},
                {x: xBL3 - 1, y: eBot}, {x: xBR3 + 1, y: eBot},
                tint3)
              if (yBotClamped > eBot) {
                const cx3  = this._colToScreenX(tileCol + 0.5, tileRow + 1)
                const dx3  = Math.round(cx3 - scaledW3 / 2) - 1
                const dy3  = Math.round(eBot)
                const dw3  = Math.round(scaledW3) + 2
                const dh3  = Math.round(yBotClamped - eBot) + 1
                const img3 = this._getTileCanvas(gid3)
                if (img3) {
                  this._oCtx.drawImage(img3, dx3, dy3, dw3, dh3)
                  if (tint3) {
                    const { h, s, l, alpha } = tint3
                    this._oCtx.save()
                    this._oCtx.globalCompositeOperation = 'source-atop'
                    this._oCtx.globalAlpha = (alpha ?? 0.45) + 0.2
                    this._oCtx.fillStyle = `hsl(${h},${Math.round(s * 0.7)}%,${Math.max(l - 10, 5)}%)`
                    this._oCtx.fillRect(dx3, dy3, dw3, dh3)
                    this._oCtx.restore()
                  }
                }
              }
              const hasLeft3  = !!(layer3[tileRow]?.[tileCol - 1])
              const hasRight3 = !!(layer3[tileRow]?.[tileCol + 1])

              const sideColor = tint3
                ? `hsl(${tint3.h},${Math.round(tint3.s * 0.6)}%,${Math.max(tint3.l - 15, 5)}%)`
                : '#2a4020'

              const tileCenterX = this._colToScreenX(tileCol + 0.5, tileRow + 1)
              const screenCenter = this._sw / 2

              if (!hasRight3 && tileCenterX < screenCenter) {
                this._oCtx.save()
                this._oCtx.globalAlpha = tileAlpha * 0.88
                this._oCtx.fillStyle = sideColor
                this._oCtx.beginPath()
                this._oCtx.moveTo(xTR3, eTop)
                this._oCtx.lineTo(xBR3, eBot)
                this._oCtx.lineTo(xBR3, yBotClamped)
                this._oCtx.lineTo(xTR3, yTopClamped)
                this._oCtx.closePath()
                this._oCtx.fill()
                this._oCtx.restore()
              }

              if (!hasLeft3 && tileCenterX > screenCenter) {
                this._oCtx.save()
                this._oCtx.globalAlpha = tileAlpha * 0.88
                this._oCtx.fillStyle = sideColor
                this._oCtx.beginPath()
                this._oCtx.moveTo(xTL3, eTop)
                this._oCtx.lineTo(xBL3, eBot)
                this._oCtx.lineTo(xBL3, yBotClamped)
                this._oCtx.lineTo(xTL3, yTopClamped)
                this._oCtx.closePath()
                this._oCtx.fill()
                this._oCtx.restore()
              }

              this._oCtx.globalAlpha = 1.0
            }
          }
        }

        if (inMap && this._encounterFlags?.length) {
          for (const flag of this._encounterFlags) {
            if (flag.tileX !== tileCol || flag.tileY !== tileRow) continue
            if (!flag.visual?.gid) continue
            if (flag.visual.flat) {
              const xBL = this._colToScreenX(tileCol,     tileRow + 1)
              const xBR = this._colToScreenX(tileCol + 1, tileRow + 1)
              this._gCtx.globalAlpha = tileAlpha
              this._drawTrapezoid(this._gCtx, flag.visual.gid,
                {x: xTL, y: yTopClamped}, {x: xTR, y: yTopClamped},
                {x: xBL, y: yBotClamped}, {x: xBR, y: yBotClamped})
              this._gCtx.globalAlpha = 1.0
            } else {
              const proj = this._projectLogical(
                (flag.tileX + 0.5) * this.tileDisplaySize,
                (flag.tileY + 0.5) * this.tileDisplaySize
              )
              if (!proj) continue
              const canvas = this._getTileCanvas(flag.visual.gid)
              if (canvas) {
                this._oCtx.globalAlpha = tileAlpha
                this._drawBillboard(this._oCtx, canvas,
                  proj.screenX, proj.screenY,
                  proj.scale * this.tileDisplaySize, 1.2)
                this._oCtx.globalAlpha = 1.0
              }
            }
          }
        }

      } // tileCol

      // Tree trunks anchored to THIS row -- drawn on _gCtx (same canvas as
      // cliffs/elevated terrain), so they inherit correct occlusion for
      // free: nearer rows processed later in this loop naturally cover
      // farther trunks, and the player (always on the separate, higher-
      // z _oCtx) always draws over any trunk regardless of row. See the
      // v8.4 header note for why this replaces ForestEffects' old
      // always-on-top overlay canvas.
      if (this._forestEffects) {
        const rowTrunks = this._forestEffects.getTrunksForRow(tileRow)
        for (const trunk of rowTrunks) {
          this._forestEffects.drawTrunk(this._gCtx, trunk, this, playerTileRow)
        }
      }

      if (this._buildings?.length) {
        for (const b of this._buildings) {
          if (b.anchorRow !== tileRow || !b.canvas) continue
          if (fov && fov.isHidden(b.centerColInt, b.anchorRow)) continue
          this._drawBuilding(this._oCtx, b, horizonPx, sw)
        }
      }

      if (!playerDrawn && tileRow === playerTileRow && this._playerCanvas && p) {
        const scaledTileW = this._scaleAtRow(playerTileRow + 1)
        const playerHM2   = (this._playerHeightMult ?? 1.8) * PerspectiveGroundRenderer.PLAYER_SCALE
        const _drawX2 = playerScreenX
        const _waveOff2 = this._boatActive ? (this._waveRideOffset ?? 0) : 0
        const _drawY2 = playerScreenY - (this._playerTerrainLift ?? 0) - _waveOff2
        this._drawWeaponOverlay(_drawX2, _drawY2, scaledTileW, null)
        const _ca2 = (this._boatActive && this.scene?._capsized)
          ? ((this._capsizeFlip ?? 0) * Math.PI) : 0
        if (_ca2 > 0.01) {
          this._oCtx.save()
          this._oCtx.translate(_drawX2, _drawY2)
          this._oCtx.rotate(_ca2)
          this._oCtx.translate(-_drawX2, -_drawY2)
        }
        this._drawPlayerAnimated(this._oCtx, this._playerCanvas,
          _drawX2, _drawY2, scaledTileW, playerHM2)
        if (_ca2 > 0.01) this._oCtx.restore()
        playerDrawn = true
      }

    } // tileRow

    // Deferred cliff faces + sides
    const _cliffSet = new Map()
    for (const cf of _deferredCliffs) _cliffSet.set(`${cf.col},${cf.row}`, cf)

    for (const cf of _deferredCliffs) {
      if (cf.faceDir === 'east') {
        this._drawElevatedSideFace(this._gCtx, cf.col + 1, cf.row, cf.elev, cf.gid, cf.alpha)
      } else if (cf.faceDir === 'west') {
        this._drawElevatedSideFace(this._gCtx, cf.col, cf.row, cf.elev, cf.gid, cf.alpha)
      } else if (cf.isCliff) {
        this._drawCliffFace(this._gCtx, cf.col, cf.row, cf.elev, cf.alpha)
      } else {
        this._drawElevatedFace(this._gCtx, cf.col, cf.row, cf.elev, cf.gid, cf.alpha, cf.yBot)
      }

      if (!cf.faceDir) {
        const eastNeighbour = _cliffSet.get(`${cf.col + 1},${cf.row - 1}`)
        if (eastNeighbour) {
          this._drawCliffSide(this._gCtx, cf.col, cf.row, cf.elev,
            eastNeighbour.row, +1, cf.alpha)
        }
        const westNeighbour = _cliffSet.get(`${cf.col - 1},${cf.row - 1}`)
        if (westNeighbour) {
          this._drawCliffSide(this._gCtx, cf.col, cf.row, cf.elev,
            westNeighbour.row, -1, cf.alpha)
        }
      }
    }

    if (!playerDrawn && this._playerCanvas && p) {
      const proj = this._projectLogical(p.logicalX, p.logicalY)
      if (proj) {
        const scaledTileW = this._scaleAtRow(playerTileRow + 1)
        this._drawBillboard(this._oCtx, this._playerCanvas,
          proj.screenX, proj.screenY, scaledTileW, 1.8)
      }
    }

    this._animT = ((this._animT || 0) + 0.016) % (Math.PI * 200)
    if (this._exitMarkers?.length) this._exitPulseT = (this._exitPulseT || 0) + 0.04

    if (p) {
      let _hlLX = p.logicalX
      let _hlLY = p.logicalY
      if (this._boatActive && this._boatScreenX != null) {
        const _ts   = this.tileDisplaySize
        const _bRow = this._screenYToWorldRow(this._boatScreenY)
        if (_bRow != null) {
          const _bCol = (this._boatScreenX - this._sw / 2) / this._scaleAtRow(_bRow) + this._perspCamCol()
          _hlLX = _bCol * _ts
          _hlLY = (_bRow - 1) * _ts
        }
      }

      const ts      = this.tileDisplaySize
      const hlTileX = Math.floor(_hlLX / ts)
      const hlTileY = Math.floor(_hlLY / ts)
      const _hlBaseT = this._rowToScreenY(hlTileY)
      const _hlBaseB = this._rowToScreenY(hlTileY + 1)
      if (_hlBaseT !== null && _hlBaseB !== null) {
        const _hlSTop = this._scaleAtRow(hlTileY)
        const _hlSBot = this._scaleAtRow(hlTileY + 1)
        const hxTL = this._colToScreenX(hlTileX,     hlTileY)
        const hxTR = this._colToScreenX(hlTileX + 1, hlTileY)
        const hxBL = this._colToScreenX(hlTileX,     hlTileY + 1)
        const hxBR = this._colToScreenX(hlTileX + 1, hlTileY + 1)
        const _hlYTL = _hlBaseT - this._vertexH(hlTileX,     hlTileY    ) * _hlSTop
        const _hlYTR = _hlBaseT - this._vertexH(hlTileX + 1, hlTileY    ) * _hlSTop
        const _hlYBL = _hlBaseB - this._vertexH(hlTileX,     hlTileY + 1) * _hlSBot
        const _hlYBR = _hlBaseB - this._vertexH(hlTileX + 1, hlTileY + 1) * _hlSBot
        this._gCtx.save()
        this._gCtx.globalAlpha = 0.28
        this._gCtx.fillStyle = 'rgba(255,255,180,1)'
        this._gCtx.beginPath()
        this._gCtx.moveTo(hxTL, _hlYTL); this._gCtx.lineTo(hxTR, _hlYTR)
        this._gCtx.lineTo(hxBR, _hlYBR); this._gCtx.lineTo(hxBL, _hlYBL)
        this._gCtx.closePath(); this._gCtx.fill()
        this._gCtx.restore()
      }
    }

    // NOTE: this was accidentally called TWICE here previously -- every
    // scene's post-draw hook (NPCs, overlays, whatever it draws) ran
    // double per frame. Single call is the correct behaviour; if
    // anything now looks fainter, it was relying on being drawn twice.
    this.scene?.onPGRDrawComplete?.(this._oCtx)
    this._oCtx.restore()
    this._gCtx.restore()
    PGRSky.updateLight(this, playerScreenX, playerScreenY)

    // Frame profiler report -- rolling stats since the last log, printed
    // every ~3s. "tex" is textured trapezoid draws (the expensive
    // clip+transform path -- watch this number), "lod" is flat-colour
    // LOD fills (cheap). Together they show how much work the frame is
    // doing and where the LOD cutoff is landing; budget on a 60fps
    // phone is ~16ms total per frame, and PGR shares that with Phaser
    // and everything else, so an avg above ~8-10ms here is the lag.
    {
      const _dt = performance.now() - _profT0
      this._profSum = (this._profSum ?? 0) + _dt
      this._profN   = (this._profN ?? 0) + 1
      if (_dt > (this._profMax ?? 0)) this._profMax = _dt
      const _nowMs = performance.now()
      if (!this._profLastLog) this._profLastLog = _nowMs
      if (_nowMs - this._profLastLog > 3000) {
        console.log('[PGR prof] avg ' + (this._profSum / this._profN).toFixed(1) +
          'ms  max ' + this._profMax.toFixed(1) +
          'ms  (' + this._profN + ' frames) | last frame: tex ' + this._profTex +
          '  lod ' + this._profLod +
          '  ground ' + groundCount + '  obj ' + objectCount)
        this._profSum = 0
        this._profN = 0
        this._profMax = 0
        this._profLastLog = _nowMs
      }
    }

    if (!this._debugged) {
      this._debugged = true
      console.log('[PGR v8] first frame -',
        'zoom:', zoom.toFixed(2),
        'perspCamRow:', camRow.toFixed(2),
        'tileRows:', tileRowStart, '->', tileRowEnd,
        'ground:', groundCount, 'objects:', objectCount
      )
    }
  }

  // Player/boat/weapon rendering lives in pgr/pgrPlayerBoat.js.
  loadBoatImage(imgElement) { PGRPlayer.loadBoatImage(this, imgElement) }
destroy() {
    console.log('[PGR v8] destroy() called')

    window.removeEventListener('resize', this._resizeHandler)
    document.removeEventListener('fullscreenchange', this._resizeHandler)
    document.removeEventListener('webkitfullscreenchange', this._resizeHandler)
    this._resizeHandler = null

    if (this._groundCanvas?.parentNode) this._groundCanvas.parentNode.removeChild(this._groundCanvas)
    if (this._objectCanvas?.parentNode) this._objectCanvas.parentNode.removeChild(this._objectCanvas)
    this._groundCanvas = null
    this._objectCanvas = null
    this._gCtx = null
    this._oCtx = null

    if (this._lightDiv?.parentNode) this._lightDiv.parentNode.removeChild(this._lightDiv)
    this._lightDiv = null

    if (this._skyImg?.parentNode) this._skyImg.parentNode.removeChild(this._skyImg)
    if (this._mountainImg?.parentNode) this._mountainImg.parentNode.removeChild(this._mountainImg)
    this._skyImg = null
    this._mountainImg = null

    this._tileCache?.clear()
    this._bakedTintCache?.clear()
    this._tilesetImg = null
    this._player = null
    this._playerCanvas = null
    this._buildings = []
    this._encounterFlags = []
    this._boatCanvas = null
    this._forestEffects = null

    this._destroyed = true

    console.log('[PGR v8] destroy() complete -- DOM elements removed')
  }
  setBoatActive(active) { PGRPlayer.setBoatActive(this, active) }

  _drawWeaponOverlay(playerScreenX, playerScreenY, scaledTileW, aimAngle) { PGRPlayer.drawWeaponOverlay(this, playerScreenX, playerScreenY, scaledTileW, aimAngle) }

  _drawPlayerAnimated(ctx, img, screenX, screenY, scaledTileW, heightMult) { PGRPlayer.drawPlayerAnimated(this, ctx, img, screenX, screenY, scaledTileW, heightMult) }

}


