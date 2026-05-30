 // PerspectiveGroundRenderer.js  (v8)
//
// Two-canvas architecture:
//   pgr-ground   z-index:1  -- layer 0 ground tiles (trapezoid-warped)
//   pgr-objects  z-index:2  -- layer 1 tiles as upright billboards + player
//   pgr-light    z-index:3  -- radial gradient lighting overlay (DOM div)
//
// Phaser canvas sits at z-index:10 -- UI, joystick, inventory all unaffected.
// Player's Phaser sprite is hidden; PGR owns all player rendering.
//
// Encounter flags are rendered as billboards or flat tiles by the PGR.
// Proximity detection uses logicalX/Y pixel coords in BaseLocationScene.
// Register flags via setEncounterFlags(). Clear via clearEncounterFlag().

import { TintManager } from './tintManager.js'

function _tileHash(tx, ty) {
  let h = (tx * 374761393 + ty * 1103515245) | 0
  h = Math.imul((h ^ (h >>> 16)), 0x45d9f3b)
  h = Math.imul((h ^ (h >>> 16)), 0x45d9f3b)
  return ((h ^ (h >>> 16)) & 0xffff) / 0xffff
}

const BOG_TREE_GIDS      = new Set([208])
const WITHERED_TREE_GIDS = new Set([209])

const OAK_TOP_GIDS      = new Set([260, 261, 262])
const OAK_MID_GIDS      = new Set([314, 315, 316, 422, 423, 424])
const OAK_BOT_GIDS      = new Set([368, 369, 370, 476, 477, 478])

const BOG_STAMP_TOP_GIDS = new Set([263, 264, 265])
const BOG_STAMP_MID_GIDS = new Set([317, 318, 319, 425, 426, 427])
const BOG_STAMP_BOT_GIDS = new Set([371, 372, 373, 479, 480, 481])

const WITHERED_TOP_GIDS  = new Set([266, 267, 268])
const WITHERED_MID_GIDS  = new Set([320, 321, 322, 428, 429, 430])
const WITHERED_BOT_GIDS  = new Set([374, 375, 376, 482, 483, 484])

const OAK_STAMP_GIDS = new Set([
  ...OAK_TOP_GIDS, ...OAK_MID_GIDS, ...OAK_BOT_GIDS
])
const BOG_STAMP_GIDS = new Set([
  ...BOG_STAMP_TOP_GIDS, ...BOG_STAMP_MID_GIDS, ...BOG_STAMP_BOT_GIDS
])
const WITHERED_STAMP_GIDS = new Set([
  ...WITHERED_TOP_GIDS, ...WITHERED_MID_GIDS, ...WITHERED_BOT_GIDS
])

// -------------------------------------------------------------------------

export default class PerspectiveGroundRenderer {

  static DEBUG_RECTS = false

  // Preset: "subtle 3d outdoor" -- good for bog/forest maps
  static CAMERA_ROW_OFFSET    = 14.0
  static PLAYER_DIST_TILES    = 1.2
  static FOCAL_LENGTH         = 12.0
  static HEIGHT_MULTIPLIER    = 1.2
  static PLAYER_SCALE         = 0.7  // default; override per-instance via setPlayerScale  // default; override per-instance via setPlayerScale

  static LIGHT_RADIUS   = 0.45
  static LIGHT_DARKNESS = 0
  static LIGHT_COLOR    = 'rgba(255, 240, 180, 0.18)'
static TILES_ACROSS      = 3.8
static HORIZON_Y_FRAC    = 0.28
  static TW         = 24
  static TH         = 24
  static MG         = 24
  static SHEET_COLS = 54
  static TILESET_URL = '/assets/oryx/oryx_16bit_fantasy_world_trans.png'

  // How many rows/cols beyond the map edge to render fill tiles
  static EDGE_EXTEND = 6

  constructor(scene) {
    this.scene           = scene
    this._player         = null
    this._playerCanvas   = null
    this._playerFrameKey = null
    this._encounterFlags = []
    this._boatActive      = false
    this._boatDrifting    = false
    this._boatCanvas      = null
    this._boatSinkOverride = 0
    this._boatScreenX     = null
    this._boatScreenY     = null
    this.tintManager = new TintManager()

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
    this._loadCatalogue()

    if (PerspectiveGroundRenderer.DEBUG_RECTS) {
      this._ready = true
    } else {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        this._tilesetImg = img
        this._ready      = true
        this._lastCamX   = null
        this._lastCamY   = null
        console.log('[PGR v8] tileset ready -', img.width, 'x', img.height)
      }
      img.onerror = e => console.error('[PGR v8] tileset load failed', e)
      img.src = PerspectiveGroundRenderer.TILESET_URL
    }

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
    this._buildSkyImage(container)

    this._lightDiv = document.createElement('div')
    this._lightDiv.id = 'pgr-light'
    this._lightDiv.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      `width:${this._sw}px`, `height:${this._sh}px`,
      'z-index:4', 'pointer-events:none',
    ].join(';')
    container.appendChild(this._lightDiv)

    this._lastCamX    = null
    this._lastCamY    = null
    this._lastCamZoom = null
    this._debugged    = false

    console.log('[PGR v8] constructed -', this._sw, 'x', this._sh)
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

  _buildSkyImage(container) {
    const sw = this._sw
    const sh = this._sh
    const img = document.createElement('img')
    img.id  = 'pgr-sky-img'
    img.src = ''
    img.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      `width:${sw}px`, `height:${Math.floor(sh * 0.85)}px`,
      'z-index:0', 'pointer-events:none',
      'object-fit:cover', 'object-position:center top',
      'opacity:0',
    ].join(';')
    container.appendChild(img)
    this._skyImg = img

    const mtn = document.createElement('img')
    mtn.id  = 'pgr-mountain-img'
    mtn.src = ''
    const mtnH = Math.floor(sh * (PerspectiveGroundRenderer.HORIZON_Y_FRAC + 0.10))
    mtn.style.cssText = [
      'position:absolute', 'left:0',
      'width:100%',
      'height:' + (PerspectiveGroundRenderer.HORIZON_Y_FRAC * 100).toFixed(2) + '%',
      'top:0',
      'z-index:0', 'pointer-events:none',
      'object-fit:none', 'object-position:50% 100%',
      'opacity:0',
    ].join(';')
    container.appendChild(mtn)
    this._mountainImg = mtn

    // Resize handler for fullscreen changes
    this._resizeHandler = () => {
      setTimeout(() => {
      const canvas = this.scene?.game?.canvas
      if (!canvas) return
      const nw = canvas.clientWidth || canvas.width
      const nh = canvas.clientHeight || canvas.height
      if (nw === this._sw && nh === this._sh) return
      this._sw = nw; this._sh = nh
      const newSkyH   = Math.floor(nh * 0.85)
      const horizonPx = Math.floor(nh * PerspectiveGroundRenderer.HORIZON_Y_FRAC)
      const newMtnH   = horizonPx
      const newMtnTop = horizonPx - Math.floor(newMtnH * 0.35)
      if (this._skyImg) {
        this._skyImg.style.width  = nw + 'px'
        this._skyImg.style.height = newSkyH + 'px'
      }
      if (this._mountainImg) {
        this._mountainImg.style.width  = nw + 'px'
        this._mountainImg.style.height = newMtnH + 'px'
        this._mountainImg.style.top    = newMtnTop + 'px'
      }
      }, 150) // wait for canvas to resize
    }
    window.addEventListener('resize', this._resizeHandler)
    document.addEventListener('fullscreenchange', this._resizeHandler)
    document.addEventListener('webkitfullscreenchange', this._resizeHandler)
  }

  setSkyImage(url, position = 'center top') {
    if (!this._skyImg) return
    if (url) {
      if (this._skyImg.src !== url) {
        this._skyImg.onload = () => this._extractPaletteFromImage(this._skyImg)
        this._skyImg.src = url
      }
      this._skyImg.style.opacity        = '1'
      this._skyImg.style.objectPosition = position
    } else {
      this._skyImg.src           = ''
      this._skyImg.style.opacity = '0'
      this.tintManager.setMood('default')
      this._gcR = null
    }
  }

  setMountainImage(url, position) {
    if (!this._mountainImg) return
    position = position || '50% 100%'
    if (url) {
      if (!this._mountainImg.src.endsWith(url.replace(/^.*\//, ''))) this._mountainImg.src = url
      this._mountainImg.style.opacity = '1'
      this._mountainImg.style.objectPosition = position
    } else {
      this._mountainImg.src = ''
      this._mountainImg.style.opacity = '0'
    }
  }

  updateMountainParallax(playerLogicalX, playerLogicalY, mapWidth, mapHeight) {
    if (!this._mountainImg || !this._mountainImg.src) return
    const baseX = this._mountainBaseX !== undefined ? this._mountainBaseX : 50
    const baseY = this._mountainBaseY !== undefined ? this._mountainBaseY : 100
    const ts    = this._tileSize || 48
    const fracX = mapWidth  > 0 ? playerLogicalX / (mapWidth  * ts) : 0.5
    const fracY = mapHeight > 0 ? playerLogicalY / (mapHeight * ts) : 0.5

    // Ease out at edges (smooth deceleration near 0 and 1)
    const easedX = fracX < 0.5
      ? 2 * fracX * fracX
      : 1 - Math.pow(-2 * fracX + 2, 2) / 2

    const mtnPx = baseX + (easedX - 0.5) * 8
    const mtnPy = baseY
    this._mountainImg.style.objectPosition = mtnPx.toFixed(2) + '% ' + mtnPy.toFixed(2) + '%'

    // Cloud subtle parallax — less than mountains
    if (this._skyImg && this._skyImg.src) {
      // Sky drift handled by cloudDrift in update() — store parallax offset only
      this._skyParallaxX = (easedX - 0.5) * 3
    }
  }

  _extractPaletteFromImage(imgEl) {
    try {
      const c   = document.createElement('canvas')
      c.width   = 64
      c.height  = 64
      const ctx = c.getContext('2d')
      // Sample from bottom 40% of image to get hill/earth colours
      // rather than the dominant sky/cloud colours
      const imgH = imgEl.naturalHeight || imgEl.height || 1
      const imgW = imgEl.naturalWidth  || imgEl.width  || 1
      const srcY = Math.floor(imgH * 0.60)
      const srcH = Math.floor(imgH * 0.40)
      ctx.drawImage(imgEl, 0, srcY, imgW, srcH, 0, 0, 64, 64)

      const sky    = this._avgPixels(ctx.getImageData(0, 0,  64, 20))
      const mid    = this._avgPixels(ctx.getImageData(0, 20, 64, 22))
      const ground = this._avgPixels(ctx.getImageData(0, 42, 64, 22))

      console.log('[PGR] palette sampled -- sky:', sky, 'mid:', mid, 'ground:', ground)

      this.tintManager.setPaletteFromRGB({ sky, mid, ground })

      const gt = this.tintManager.getTint(733, 0, 0)
      if (gt) {
        this._gcR = `hsl(${gt.h},${Math.round(gt.s * 0.7)}%,${Math.max(gt.l - 8, 8)}%)`
      }

      this._lastCamX = null
    } catch(e) {
      console.warn('[PGR] palette extraction failed:', e.message)
    }
  }

  _avgPixels(imageData) {
    const d = imageData.data
    let r = 0, g = 0, b = 0, count = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 10) continue
      r += d[i]; g += d[i+1]; b += d[i+2]
      count++
    }
    if (count === 0) return { r: 128, g: 128, b: 128 }
    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count),
    }
  }

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
    // Build a set of exit edges for quick tile lookup: 'north','south','east','west'
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

  _loadCatalogue() {
    try {
      const catalogue = this.scene.cache.json.get('oryxCatalogue')
      if (!catalogue) {
        console.warn('[PGR] oryxCatalogue not in cache -- all layer 1 tiles will be flat')
        return
      }
      let billboardCount = 0
      for (const [gidStr, entry] of Object.entries(catalogue)) {
        if (entry?.flat === false) {
          this._flatGids.add(parseInt(gidStr))
          billboardCount++
        }
      }
      console.log(`[PGR] catalogue loaded - ${billboardCount} billboard GIDs, ${Object.keys(catalogue).length - billboardCount} flat GIDs`)
    } catch(e) {
      console.warn('[PGR] catalogue load failed:', e.message)
    }
  }

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
  _horizonPx() { return Math.floor(this._sh * PerspectiveGroundRenderer.HORIZON_Y_FRAC) }
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

  // Inverse of _rowToScreenY -- converts screen Y back to world row
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

  _srcRect(gid) {
    const idx = gid - 1
    const col = idx % PerspectiveGroundRenderer.SHEET_COLS
    const row = Math.floor(idx / PerspectiveGroundRenderer.SHEET_COLS)
    const { MG, TW, TH } = PerspectiveGroundRenderer
    return { sx: MG + col * TW, sy: MG + row * TH, sw: TW, sh: TH }
  }

  _getTileCanvas(gid) {
    if (this._tileCache.has(gid)) return this._tileCache.get(gid)
    if (!this._tilesetImg) return null
    const { sx, sy, sw, sh } = this._srcRect(gid)
    const tc   = document.createElement('canvas')
    tc.width   = sw; tc.height = sh
    const tCtx = tc.getContext('2d')
    tCtx.imageSmoothingEnabled = false
    tCtx.filter = 'saturate(60%)'
    tCtx.drawImage(this._tilesetImg, sx, sy, sw, sh, 0, 0, sw, sh)
    tCtx.filter = 'none'
    this._tileCache.set(gid, tc)
    return tc
  }

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
    const BLEED = 1.75
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
    // screenY is tile bottom -- draw upward so feet are grounded
    ctx.drawImage(img, Math.round(screenX - scaledW / 2), Math.round(screenY - scaledH), Math.round(scaledW), Math.round(scaledH))
  }

  _drawBillboardTinted(ctx, img, screenX, screenY, scaledTileW, heightMult, tintHSL, tintAlpha) {
    const hm      = heightMult ?? PerspectiveGroundRenderer.HEIGHT_MULTIPLIER
    const scaledW = scaledTileW
    const scaledH = scaledTileW * hm
    const dx      = screenX - scaledW / 2
    const dy      = screenY - scaledH
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(img, dx, dy, scaledW, scaledH)
    const { h, s, l } = tintHSL
    ctx.globalCompositeOperation = 'source-atop'
    ctx.globalAlpha = tintAlpha ?? 0.38
    ctx.fillStyle   = `hsl(${h},${s}%,${l}%)`
    ctx.fillRect(dx, dy, scaledW, scaledH)
    ctx.restore()
  }

  _updateLight(playerScreenX, playerScreenY) {
    const sw        = this._sw
    const sh        = this._sh
    const horizonPx = this._horizonPx()
    const groundH   = sh - horizonPx
    const radius    = Math.sqrt(sw * sw + sh * sh) * (this._lightRadius ?? PerspectiveGroundRenderer.LIGHT_RADIUS)
    const dark      = this._lightDarkness ?? PerspectiveGroundRenderer.LIGHT_DARKNESS
    const glow      = PerspectiveGroundRenderer.LIGHT_COLOR
    const relativePlayerY = playerScreenY - horizonPx
    this._lightDiv.style.top    = `${horizonPx}px`
    this._lightDiv.style.height = `${groundH}px`
    this._lightDiv.style.background = [
      `radial-gradient(ellipse ${radius.toFixed(1)}px ${(radius * 0.6).toFixed(1)}px`,
      ` at ${playerScreenX.toFixed(1)}px ${relativePlayerY.toFixed(1)}px,`,
      ` ${glow} 0%, transparent 35%, rgba(0,0,0,${dark}) 100%)`
    ].join('')
  }

  update(fov) {
    if (!this._ready) return
    if (!this._cameraReady()) return
    // Sync dimensions with actual canvas in case of fullscreen change
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
    // Cloud drift — slow sine wave back and forth
    this._cloudDrift = ((this._cloudDrift ?? 0) + 0.0004) % (Math.PI * 2)
    if (this._skyImg && this._skyImg.src) {
      const driftX = 50 + Math.sin(this._cloudDrift) * 12 + (this._skyParallaxX ?? 0)
      const currentPos = this._skyImg.style.objectPosition || '50% 50%'
      const currentY = currentPos.split(' ')[1] || '50%'
      this._skyImg.style.objectPosition = driftX.toFixed(3) + '% ' + currentY
    }
    if (this._mountainImg && this._mountainImg.src) {
      const p  = this.scene.player
      const md = this.scene.mapData
      if (p && md) this.updateMountainParallax(p.logicalX, p.logicalY, md.width, md.height)
      // Anchor mountain bottom to horizon every frame
      const _horizPx = this._horizonPx()
      if (!this._mtnLogTimer || Date.now() - this._mtnLogTimer > 2000) { this._mtnLogTimer = Date.now(); }
      const _mtnH    = Math.floor(_horizPx * 3.0)
      const _mtnTop  = Math.floor(_horizPx * 0.55)
      this._mountainImg.style.height = _mtnH + 'px'
      this._mountainImg.style.top    = _mtnTop + 'px'
      this._mountainImg.style.width  = this._sw + 'px'
      if (this._skyImg) {
        this._skyImg.style.height = Math.floor(this._sh * 0.85) + 'px'
        this._skyImg.style.width  = this._sw + 'px'
      }
    }

    const cam  = this.scene.cameras.main
    const zoom = this._zoom()

    const bowAiming = this.scene.bowMechanics?.isAiming ?? false
    const now = Date.now()
    if (this._player && !this._player.isMoving && this._lastMoveTime) {
      // Allow idle animation to run for 8s after stopping, then freeze
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

    this._refreshPlayerCanvas()
    this.playerScreenX = null
    this.playerScreenY = null
    this.playerScreenX = null
    this.playerScreenY = null

    const sw        = this._sw
    const sh        = this._sh
    const FL        = PerspectiveGroundRenderer.FOCAL_LENGTH
    const horizonPx = this._horizonPx()
    const EX        = PerspectiveGroundRenderer.EDGE_EXTEND

    const layer0 = this.scene.mapData?.layers?.[0]
    const layer1 = this.scene.mapData?.layers?.[1] ?? null
    if (!layer0) return

    const mapH   = layer0.length
    const mapW   = layer0[0].length
    const camRow = this._perspCamRow()
    const camCol = this._perspCamCol()

    const fillGid  = layer0[mapH - 1]?.[Math.floor(mapW / 2)] ?? 733
    const fillTint = this.tintManager.getTint(fillGid, 0, 0)

    const gcR = this._gcR ?? this._groundColour ?? '#2a3a1a'

    this._gCtx.clearRect(0, horizonPx, sw, sh - horizonPx)
    // Clip ground fill to map horizontal extent
    const bottomRow  = Math.min(Math.floor(camRow) - 1, mapH - 1)
    const leftX      = this._colToScreenX(0,    bottomRow + 1)
    const rightX     = this._colToScreenX(mapW, bottomRow + 1)
    const clipLeft   = Math.max(0,  leftX)
    const clipRight  = Math.min(sw, rightX)
    const clipW      = Math.max(0,  clipRight - clipLeft)

    const groundGrad = this._gCtx.createLinearGradient(0, horizonPx, 0, horizonPx + 160)
    groundGrad.addColorStop(0, 'rgba(30,24,18,0)')
    groundGrad.addColorStop(1, gcR)
    this._gCtx.fillStyle = groundGrad
    this._gCtx.fillRect(0, horizonPx, sw, 160)
    this._gCtx.fillStyle = gcR
    this._gCtx.fillRect(0, horizonPx + 160, sw, sh - horizonPx - 160)

    // No background fill -- ground canvas is transparent outside map tiles

    this._oCtx.clearRect(0, 0, sw, sh)

    const tileRowEnd   = Math.min(Math.floor(camRow) - 1, mapH - 1 + EX)
    const tileRowStart = Math.max(0, Math.floor(camRow - FL * 8))

    const p = this._player
    let playerTileRow = -1
    let playerScreenX = sw / 2
    let playerScreenY = sh / 2
    let playerDrawn   = false

    if (p) {
      const snapX    = Math.floor(p.logicalX / this.tileDisplaySize) * this.tileDisplaySize + this.tileDisplaySize * 0.5
      const snapY    = Math.floor(p.logicalY / this.tileDisplaySize) * this.tileDisplaySize + this.tileDisplaySize * 0.5
      const proj     = this._projectLogical(snapX, snapY)
      if (proj) {
        playerScreenX = proj.screenX
        playerScreenY = proj.screenY   // tile bottom -- aligns with boat and highlight
        playerTileRow = Math.floor(p.logicalY / this.tileDisplaySize)
        this.playerScreenX = playerScreenX
        this.playerScreenY = playerScreenY

      }
    }

    let groundCount = 0, objectCount = 0

    for (let tileRow = tileRowStart; tileRow <= tileRowEnd; tileRow++) {

      const yTop = this._rowToScreenY(tileRow)
      const yBot = this._rowToScreenY(tileRow + 1)



if (yBot === null) continue
if (yTop !== null && yTop > sh + 100) continue
if (yBot < horizonPx - this.tileDisplaySize * 3) continue

const yTopClamped = (yTop === null || yTop < horizonPx - this.tileDisplaySize) ? horizonPx - this.tileDisplaySize : yTop
const yBotClamped = Math.min(sh + 100, yBot)
if (yBotClamped <= yTopClamped) continue

// Fade rows as they approach the horizon -- prevents pop-in flicker
const distFromHorizon = yBotClamped - horizonPx
const horizonFade     = distFromHorizon < 60 ? Math.max(0, distFromHorizon / 60) : 1.0
         // Fade rows as they approach the horizon -- prevents pop-in flicker

      const scaleNear = this._scaleAtRow(tileRow + 1)
      const halfCols  = scaleNear > 0.001 ? (sw / 2) / scaleNear + 1 : mapW

      const colStart = Math.floor(camCol - halfCols) - EX
      const colEnd   = Math.ceil(camCol + halfCols)  + EX

      const rowInMap = tileRow >= 0 && tileRow < mapH

      for (let tileCol = colStart; tileCol <= colEnd; tileCol++) {

        // Early cull -- skip tiles off screen horizontally
        const xTL = this._colToScreenX(tileCol,     tileRow)
        const xTR = this._colToScreenX(tileCol + 1, tileRow)
        if (xTR < -10 || xTL > sw + 10) continue

        const colInMap = tileCol >= 0 && tileCol < mapW
        const inMap    = rowInMap && colInMap

        // Don't render outside map bounds
        if (!inMap) continue

        const edgeDist  = Math.min(tileRow, tileCol, mapH - 1 - tileRow, mapW - 1 - tileCol)
        const edgeAlpha = edgeDist === 0 ? 0.85
                        : edgeDist === 1 ? 0.92
                        : edgeDist === 2 ? 0.97
                        : 1.0

        if (fov && fov.isHidden(tileCol, tileRow)) continue

        const tileAlpha = edgeAlpha * horizonFade

        const _rawGid0 = layer0[tileRow]?.[tileCol] ?? 0
        // Animate water tiles to give river flow effect
        // Wave travels east (positive col direction)
        const _isWater = _rawGid0 === 1625 || _rawGid0 === 1679
        const gid0 = _isWater
          ? (((Math.floor(this._waterPhase + tileCol * 0.7 - tileRow * 0.3)) & 1) ? 1625 : 1679)
          : _rawGid0

        if (gid0) {
          const xBL = this._colToScreenX(tileCol,     tileRow + 1)
          const xBR = this._colToScreenX(tileCol + 1, tileRow + 1)
          this._gCtx.globalAlpha = tileAlpha
          if (PerspectiveGroundRenderer.DEBUG_RECTS) {
            const colors = ['rgba(255,0,0,0.5)','rgba(0,200,0,0.5)',
                            'rgba(0,100,255,0.5)','rgba(255,200,0,0.5)']
            this._gCtx.fillStyle = colors[tileRow % colors.length]
            this._gCtx.beginPath()
            this._gCtx.moveTo(xTL, yTopClamped); this._gCtx.lineTo(xTR, yTopClamped)
            this._gCtx.lineTo(xBR, yBotClamped); this._gCtx.lineTo(xBL, yBotClamped)
            this._gCtx.closePath(); this._gCtx.fill()
          } else {
            const tint0 = inMap
              ? this.tintManager.getTint(gid0, tileCol, tileRow)
              : fillTint
            this._drawTrapezoidTinted(this._gCtx, gid0,
              {x: xTL, y: yTopClamped}, {x: xTR, y: yTopClamped},
              {x: xBL, y: yBotClamped}, {x: xBR, y: yBotClamped},
              tint0)
            // Exit edge strip overlay
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
                this._gCtx.moveTo(xTL, yTopClamped)
                this._gCtx.lineTo(xTR, yTopClamped)
                this._gCtx.lineTo(xBR, yBotClamped)
                this._gCtx.lineTo(xBL, yBotClamped)
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
          this._lastPlayerScale = this._playerScale ?? PerspectiveGroundRenderer.PLAYER_SCALE
          const aimAngle    = this.scene.bowMechanics?.isAiming
            ? this.scene.bowMechanics._currentAimAngle ?? null
            : null
          // Tile highlight drawn separately after all tiles
          const _drawX = playerScreenX
          const _drawY = playerScreenY
          this._drawWeaponOverlay(_drawX, _drawY, scaledTileW, aimAngle)
          this._drawPlayerAnimated(this._oCtx, this._playerCanvas,
            _drawX, _drawY, scaledTileW, playerHM)
          playerDrawn = true
        }

        // Object tile -- only for in-map tiles
        if (inMap && layer1) {
          const gid1 = layer1[tileRow]?.[tileCol]
          if (gid1) {
            const tint1       = this.tintManager.getTint(gid1, tileCol, tileRow)
            const isStamp     = OAK_STAMP_GIDS.has(gid1) || BOG_STAMP_GIDS.has(gid1) || WITHERED_STAMP_GIDS.has(gid1)
            const isBillboard = this._flatGids.has(gid1)

            if (isStamp || isBillboard) {
              const screenX     = this._colToScreenX(tileCol + 0.5, tileRow + 1)
              const screenY     = this._rowToScreenY(tileRow + 1)
              const scaledTileW = this._scaleAtRow(tileRow + 1)
              if (screenY !== null &&
                  screenY >= horizonPx &&
                  screenY <= sh + this.tileDisplaySize * 2) {
                this._oCtx.globalAlpha = tileAlpha
                if (tint1) {
                  this._drawBillboardTinted(this._oCtx, this._getTileCanvas(gid1),
                    screenX, screenY, scaledTileW,
                    PerspectiveGroundRenderer.HEIGHT_MULTIPLIER,
                    tint1, tint1.alpha)
                } else {
                  this._drawBillboard(this._oCtx, this._getTileCanvas(gid1),
                    screenX, screenY, scaledTileW)
                }
                this._oCtx.globalAlpha = 1.0
              }
            } else {
              const xBL = this._colToScreenX(tileCol,     tileRow + 1)
              const xBR = this._colToScreenX(tileCol + 1, tileRow + 1)
              this._gCtx.globalAlpha = tileAlpha
              this._drawTrapezoidTinted(this._gCtx, gid1,
                {x: xTL, y: yTopClamped}, {x: xTR, y: yTopClamped},
                {x: xBL, y: yBotClamped}, {x: xBR, y: yBotClamped},
                tint1)
              this._gCtx.globalAlpha = 1.0
            }
            objectCount++
          }
        }

        // Exit markers
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

        // Encounter flags -- only for in-map tiles
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

      if (!playerDrawn && tileRow === playerTileRow && this._playerCanvas && p) {
        const scaledTileW = this._scaleAtRow(playerTileRow + 1)
        const playerHM2   = (this._playerHeightMult ?? 1.8) * PerspectiveGroundRenderer.PLAYER_SCALE
        const _drawX2 = playerScreenX
        const _drawY2 = playerScreenY
        this._drawWeaponOverlay(_drawX2, _drawY2, scaledTileW, null)
        this._drawPlayerAnimated(this._oCtx, this._playerCanvas,
          _drawX2, _drawY2, scaledTileW, playerHM2)
        playerDrawn = true
      }

    } // tileRow

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

    // Player tile highlight -- always locked to current player/boat position
    if (p) {
      // Highlight follows lerped boat screen position when active
      // so it stays glued to the hull rather than snapping ahead
      let _hlLX = p.logicalX
      let _hlLY = p.logicalY
      if (this._boatActive && this._boatScreenX != null) {
        // Unproject lerped screen position back to logical tile
        const _ts   = this.tileDisplaySize
        const _bRow = this._screenYToWorldRow(this._boatScreenY)
        if (_bRow != null) {
          const _bCol = (this._boatScreenX - this._sw / 2) / this._scaleAtRow(_bRow) + this._perspCamCol()
          _hlLX = _bCol * _ts
          _hlLY = (_bRow - 1) * _ts
        }
      }

      // Project current tile to screen as perspective quad
      const ts      = this.tileDisplaySize
      const hlTileX = Math.floor(_hlLX / ts)
      const hlTileY = Math.floor(_hlLY / ts)
      // Use hlTileY+1 (bottom row) for all X coords to match player/boat projection
      const hxTL = this._colToScreenX(hlTileX,     hlTileY + 1)
      const hxTR = this._colToScreenX(hlTileX + 1, hlTileY + 1)
      const hxBL = this._colToScreenX(hlTileX,     hlTileY + 1)
      const hxBR = this._colToScreenX(hlTileX + 1, hlTileY + 1)
      const hyT  = this._rowToScreenY(hlTileY)
      const hyB  = this._rowToScreenY(hlTileY + 1)
      if (hyT !== null && hyB !== null) {
        this._gCtx.save()
        this._gCtx.globalAlpha = 0.28
        this._gCtx.fillStyle = 'rgba(255,255,180,1)'
        this._gCtx.beginPath()
        this._gCtx.moveTo(hxTL, hyT); this._gCtx.lineTo(hxTR, hyT)
        this._gCtx.lineTo(hxBR, hyB); this._gCtx.lineTo(hxBL, hyB)
        this._gCtx.closePath(); this._gCtx.fill()
        this._gCtx.restore()
      }
    }

    this._updateLight(playerScreenX, playerScreenY)

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

  loadBoatImage(imgElement) {
    const c   = document.createElement('canvas')
    c.width   = imgElement.naturalWidth  || imgElement.width
    c.height  = imgElement.naturalHeight || imgElement.height
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(imgElement, 0, 0)
    this._boatCanvas = c
    console.log('[PGR] boat canvas ready -', c.width, 'x', c.height)
  }

  setBoatActive(active) {
    this._boatActive  = !!active
    this._boatScreenX = null
    this._boatScreenY = null
    if (active) {
      this._boatSinkOverride = 0.32   // player sits higher -- waist at gunwale
    } else {
      this._boatSinkOverride = 0
    }
    this._playerFrameKey = null
  }

  _drawWeaponOverlay(playerScreenX, playerScreenY, scaledTileW, aimAngle) {
    const inv = this.scene.player?.inventory
    if (!inv) return
    const item = inv.getEquippedItem?.('rightHand')
    if (!item) return
    try {
      let itemImg = null
      if (item.itemGid && this.scene.itemSheet?.isReady) {
        itemImg = this.scene.itemSheet.getCanvas(item.itemGid)
      } else if (item.spriteKey) {
        const itemTex = this.scene.textures.get(item.spriteKey)
        if (itemTex && itemTex.key !== '__MISSING') {
          itemImg = itemTex.getSourceImage()
        }
      }
      if (!itemImg?.width) return
      const ctx  = this._oCtx
      const ps   = PerspectiveGroundRenderer.PLAYER_SCALE ?? 1.0
      const iw   = scaledTileW * 0.9 * ps
      const ih   = iw * (itemImg.height / itemImg.width)
      const REST_ANGLE    = (345 * Math.PI) / 180
      const angle         = aimAngle != null ? aimAngle + (Math.PI / 2) + (135 * Math.PI / 180) : REST_ANGLE
      const ps2  = PerspectiveGroundRenderer.PLAYER_SCALE ?? 1.0
      const spriteCentreY = playerScreenY - scaledTileW * 1.8 * ps2 * 0.5
      const offsetX       = scaledTileW * 0.12
      ctx.save()
      ctx.translate(playerScreenX + offsetX, spriteCentreY)
      ctx.rotate(angle)
      ctx.globalAlpha = 0.95
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(itemImg, -iw / 2, -ih / 2, iw, ih)
      ctx.globalAlpha = 1.0
      ctx.restore()
    } catch(e) {
      // non-fatal
    }
  }


  _drawPlayerAnimated(ctx, img, screenX, screenY, scaledTileW, heightMult) {
    if (!img) return
    const t   = this._animT || 0
    const p   = this._player
    const ps  = PerspectiveGroundRenderer.PLAYER_SCALE ?? 1.0
    const hm  = (heightMult ?? 1.8) * ps
    const W   = Math.round(scaledTileW * ps)
    const H   = Math.round(scaledTileW * hm)


    // ── Stroke/facing driven by velocity when in boat, tile steps otherwise ──
    const boatVX = this._boatActive ? (this.scene?.boatSystem?._vx ?? 0) : 0
    const boatVY = this._boatActive ? (this.scene?.boatSystem?._vy ?? 0) : 0
    const boatSpd = Math.hypot(boatVX, boatVY)

    // Tile-step tracking for land movement
    const curTileX = p ? Math.floor(p.logicalX / this.tileDisplaySize) : 0
    const curTileY = p ? Math.floor(p.logicalY / this.tileDisplaySize) : 0
    const dvx = curTileX - (this._prevTileX ?? curTileX)
    const dvy = curTileY - (this._prevTileY ?? curTileY)
    const stepped = dvx !== 0 || dvy !== 0
    this._prevTileX = curTileX
    this._prevTileY = curTileY

    // Facing: velocity when in boat, tile step otherwise
    if (this._boatActive) {
      if (boatVX < -4)      this._facingLeft = true
      else if (boatVX > 4)  this._facingLeft = false
    } else {
      if (dvx < 0)      this._facingLeft = true
      else if (dvx > 0) this._facingLeft = false
    }

    if (!this._boatActive && stepped) {
      this._moveDir = Math.abs(dvx) > 0 ? 'ew' : 'ns'
      this._nextSwaySign = dvx !== 0 ? (dvx > 0 ? 1 : -1) : (this._swaySign ?? 1)
      const st = this._stepT ?? 1
      if (st > 0.85 || st === 0) {
        this._stepT    = 0
        this._swaySign = this._nextSwaySign
      }
    }

    const moving = this._boatActive ? boatSpd > 8 : (p?.isMoving ?? false)

    if (this._boatActive) {
      // Stroke advances with speed, retreats when still
      // Stroke only animates when player is actively rowing (joystick force)
      // Pure current drift keeps strokeT at 0 for smooth glide
      const joystickActive = (this.scene?.joystick?.force ?? 0) > 10
      const strokeRate = Math.min(boatSpd / 80, 1.0) * 0.025
      if (joystickActive && boatSpd > 8) {
        this._strokeT = Math.min(1.0, (this._strokeT ?? 0) + strokeRate)
        if (this._strokeT >= 1.0) this._strokeT = 0  // loop stroke
      } else {
        this._strokeT = Math.max(0, (this._strokeT ?? 0) - 0.015)
      }
    } else if (moving) {
      this._stepT = (this._stepT || 0) + 0.09
      if (this._stepT >= 1.0) {
        this._stepT    = 0
        this._swaySign = this._nextSwaySign ?? this._swaySign ?? 1
      }
    }

    // Currach stroke shape:
    // 0.0-0.15  catch    -- lean forward, reach
    // 0.15-0.6  drive    -- powerful pull back, body opens
    // 0.6-0.8   finish   -- lean back, maximum extension
    // 0.8-1.0   recovery -- return forward
    const strokeT = this._strokeT ?? 0
    let rowLean = 0, rowBob = 0, boatTilt = 0
    if (this._boatActive) {
      if (strokeT < 0.15) {
        // Catch: lean forward
        const k = strokeT / 0.15
        rowLean = -0.07 * k
        rowBob  = scaledTileW * 0.01 * k
      } else if (strokeT < 0.6) {
        // Drive: pull back
        const k = (strokeT - 0.15) / 0.45
        rowLean = -0.07 + 0.16 * k
        rowBob  = scaledTileW * 0.01 - scaledTileW * 0.02 * Math.sin(k * Math.PI)
        boatTilt = -0.04 * Math.sin(k * Math.PI)
      } else if (strokeT < 0.8) {
        // Finish: lean back
        const k = (strokeT - 0.6) / 0.2
        rowLean = 0.09 - 0.03 * k
        rowBob  = -scaledTileW * 0.008
      } else {
        // Recovery
        const k = (strokeT - 0.8) / 0.2
        rowLean = 0.06 - 0.06 * k
        rowBob  = -scaledTileW * 0.008 * (1 - k)
      }
    }

    // ── Boat instability system ──────────────────────────────────────────────
    if (this._boatActive) {
      // _wobblePhase drives the see-saw oscillation
      // Frequency and amplitude both scale with speed
      const wobbleFreq = 1.8 + boatSpd * 0.04   // faster rocking at speed
      this._wobblePhase = ((this._wobblePhase ?? 0) + wobbleFreq * 0.016) % (Math.PI * 2)

      // Target amplitude: big when moving, tiny when still
      const targetAmp = boatSpd > 8
        ? 0.04 + Math.min(boatSpd / 120, 0.10)   // up to ~0.14 rad at full speed
        : 0.012                                    // gentle idle
      // Smooth amplitude transitions
      this._wobbleAmp = this._wobbleAmp ?? 0.012
      this._wobbleAmp += (targetAmp - this._wobbleAmp) * 0.04
    } else {
      this._wobblePhase = 0
      this._wobbleAmp   = 0
    }

    const wobbleRoll = this._boatActive
      ? Math.sin(this._wobblePhase) * (this._wobbleAmp ?? 0)
      : 0

    // Bob: follows wobble phase offset by 90deg (roll and bob in sync)
    // Player bob follows boat rock -- always lifts, never sinks below hull
    // Use abs so player rises on both sides of the roll, never drops through gunwale
    const idleBob = this._boatActive
      ? -Math.abs(Math.sin((this._wobblePhase ?? 0) + Math.PI * 0.5)) * scaledTileW * (this._wobbleAmp ?? 0) * 0.8
      : 0

    // Velocity-driven lean: tip into the direction of travel
    const velTiltX  = this._boatActive ? boatVX * 0.00025 : 0
    const velTiltY  = this._boatActive ? boatVY * 0.00018 : 0

    // Acceleration tilt: boat tips back on surge
    const prevVX    = this._prevBoatVX ?? boatVX
    const accelX    = boatVX - prevVX
    this._prevBoatVX = boatVX
    const accelTilt = this._boatActive ? -accelX * 0.005 : 0

    const idleRock  = wobbleRoll   // wobble IS the rock now
    const chopAmt   = 0            // absorbed into wobble bob

    const totalBob  = rowBob + idleBob
    const totalLean = rowLean + wobbleRoll + velTiltX + accelTilt

    // ── BOAT: draw hull below player, crop player legs ─────────────────
    if ((this._boatActive || this._boatDrifting) && this._boatCanvas) {
      if (this._boatDrifting) {
        // Advance world position eastward at drift speed
        const _dTS = this.tileDisplaySize
        const _dTX = Math.floor((this._boatWorldX ?? 0) / _dTS)
        const _dTY = Math.floor((this._boatWorldY ?? 0) / _dTS)
        const _dGid = this.scene.mapData?.layers?.[0]?.[_dTY]?.[_dTX] ?? 0
        const _dShore = new Set([1472,1473,1474,1526,1528,1580,1581,1582,1635,1636,1689,1690,1742,1743,1796,1797,1852,1906,1958,1959,1960,2012,2013,731])
        const _dWater = new Set([1625,1679])
        const driftPxPerFrame = (_dShore.has(_dGid) || (!_dWater.has(_dGid) && _dGid !== 0)) ? 0 : (this._boatDriftSpeed ?? 18) / 60
        this._boatWorldX = (this._boatWorldX ?? 0) + driftPxPerFrame

        // Project world position to screen each frame -- camera-stable
        const driftProj = this._projectLogical(this._boatWorldX, this._boatWorldY ?? screenY, true)
        if (!driftProj) return   // off screen, skip draw

        const driftScreenX = driftProj.screenX
        const driftScreenY = driftProj.screenY
        // Use drift projection scale for boat size -- stays perspective-correct
        const driftScale   = driftProj.scale * this.tileDisplaySize
        const bc    = this._boatCanvas
        const boatW = Math.round(driftScale * 1.6 * ps)
        const boatH = Math.round(boatW * (bc.height / bc.width))
        ctx.save()
        ctx.globalAlpha = 1.0
        ctx.drawImage(bc, Math.round(driftScreenX - boatW / 2), Math.round(driftScreenY - boatH * 0.8), boatW, boatH)
        ctx.restore()
      } else {
        // Lerp boat toward player position for smooth momentum feel
        if (this._boatScreenX == null) {
          this._boatScreenX = screenX
          this._boatScreenY = screenY
        } else {
          const lerpSpeed = 0.25
          this._boatScreenX += (screenX - this._boatScreenX) * lerpSpeed
          this._boatScreenY += (screenY - this._boatScreenY) * lerpSpeed
        }
        // Always persist last known position so drift can use it after deactivation
        this._boatLastScreenX = this._boatScreenX
        this._boatLastScreenY = this._boatScreenY
        const bx    = this._boatActive ? (this._boatScreenX ?? screenX) : screenX
        const by    = this._boatActive ? (this._boatScreenY ?? screenY) : screenY
        const bc    = this._boatCanvas
        const boatW = Math.round(scaledTileW * 1.6 * ps)
        const boatH = Math.round(boatW * (bc.height / bc.width))
        // Boat drawn centred on tile bottom (same Y reference as highlight)
        // boatH * 0.6 puts the waterline at roughly 60% down the boat image
        const boatTop = by - boatH * 0.6
        // Full tilt: idle rock + velocity lean + acceleration tip
        const _boatRock = idleRock + velTiltX + accelTilt
        const _boatPitch = velTiltY  // bow dips on north/south movement
        if (Math.abs(_boatRock) > 0.001 || Math.abs(_boatPitch) > 0.001) {
          ctx.save()
          ctx.translate(Math.round(bx), Math.round(by + totalBob))
          ctx.rotate(_boatRock)
          // Pitch: skew Y slightly for bow-up/bow-down feel
          ctx.transform(1, _boatPitch * 0.3, 0, 1, 0, 0)
          ctx.drawImage(bc, -Math.round(boatW / 2), Math.round(boatTop - by - totalBob), boatW, boatH)
          ctx.restore()
        } else {
          ctx.drawImage(bc, Math.round(bx - boatW / 2), Math.round(boatTop + totalBob), boatW, boatH)
        }
      }
    }


    ctx.save()
    ctx.translate(screenX, screenY + (this._boatActive ? totalBob : idleBob))

    if (moving) {
      const st     = this._stepT ?? 0
      const arc    = Math.sin(st * Math.PI)
      const inWater = !this._boatActive && (p?.terrainSinkOffset ?? 0) > 5
      const bounce = (this._boatActive || inWater) ? 0 : arc * scaledTileW * 0.18
      const scaleY = 1.0 + ((this._boatActive || inWater) ? 0 : arc * 0.09)
      const scaleX = 1.0 - ((this._boatActive || inWater) ? 0 : arc * 0.04)
      const dir    = this._moveDir ?? 'ew'

      let sway = 0, lean = 0
      if (dir === 'ew') {
        sway = (this._boatActive || inWater) ? 0 : (this._swaySign ?? 1) * arc * scaledTileW * 0.055
        lean = this._boatActive ? 0 : (inWater ? 0 : arc * 0.05 * (this._facingLeft ? 1 : -1))
        // Boat: apply lean as rotation not skew
        if (this._boatActive) ctx.rotate(totalLean * (this._facingLeft ? -1 : 1))
      } else {
        const inWater2 = !this._boatActive && (p?.terrainSinkOffset ?? 0) > 5
        const nsBounce = (this._boatActive || inWater2) ? 0 : arc * scaledTileW * 0.07
        ctx.transform(
          1.0 * (this._facingLeft ? -1 : 1), 0,
          0, 1.0 + ((this._boatActive || inWater2) ? 0 : arc * 0.04),
          0, -nsBounce
        )
        // Crop: use boat override when in boat, terrain sink otherwise
        const _sink0ns = this._boatActive
          ? H * (this._boatSinkOverride ?? 0)
          : Math.min(H * 1.1, (p?.terrainSinkOffset ?? 0) * scaledTileW / 48)
        const _cropH0ns = H - _sink0ns
        ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH0ns / H), -W/2, -H + _sink0ns, W, _cropH0ns)
        ctx.restore()
        return
      }

      ctx.transform(scaleX * (this._facingLeft ? -1 : 1), lean, 0, scaleY, sway, -bounce)
    } else {
      const breathScale = 1.0 + Math.sin(t * 1.1) * 0.014
      const shift       = Math.sin(t * 0.6) * scaledTileW * 0.018
      const watch       = Math.sin(t * 2.1 + 0.5) * scaledTileW * 0.007
      ctx.transform(
        breathScale * (this._facingLeft ? -1 : 1), 0,
        0, breathScale,
        shift, watch
      )
    }

    // Crop: hide legs behind boat hull
    const sinkFrac = this._boatActive ? (this._boatSinkOverride ?? 0) : 0
    const _sinkRaw = (p?.terrainSinkOffset ?? 0)
    const _sink = this._boatActive ? H * sinkFrac : Math.min(H * 1.1, _sinkRaw * scaledTileW / 48)
    const _cropH   = H - _sink
    ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH / H), -W/2, -H + _sink, W, _cropH)
    ctx.restore()
  }

}

