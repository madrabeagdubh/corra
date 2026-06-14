// PerspectiveGroundRenderer.js  (v8.3 — modular elevation + building billboards)
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
//
// ── Related modules ───────────────────────────────────────────────────────────
//   js/game/systems/elevationRenderer.js  — builds this._elev, draws cliff faces
//   js/game/systems/playerRenderer.js     — utilities for enemy/NPC rendering
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

// Fast deterministic hash for tile position — used to pick tint variant index
function _tmHashPGR(tx, ty) {
  let h = (tx * 374761393 + ty * 1103515245) | 0
  h = Math.imul((h ^ (h >>> 16)), 0x45d9f3b)
  h = Math.imul((h ^ (h >>> 16)), 0x45d9f3b)
  return (h ^ (h >>> 16)) >>> 0
}

// Ground GIDs that receive height+slope shading — mirrors TintManager's ground Set.
// Kept here to avoid importing TintManager internals into the hot render loop.
const GID_CATEGORIES_GROUND = new Set([
  732, 733, 735, 839, 840, 841, 842, 843, 844, 845, 846, 847, 848,
  849, 850, 851, 852, 853, 854, 855, 856, 857, 858, 859, 860, 861,
  862, 863, 893, 894, 895, 896, 897, 898, 899, 900, 901, 902, 903,
  904, 905, 906, 907, 908, 909, 910,
  1379, 1380, 1381, 1382, 1383, 1384, 1385, 1386, 1387, 1388,
  1389, 1390, 1391, 1392, 1393, 1394, 1395, 1396, 1397, 1398,
  1399, 1400, 1401, 1402, 1403, 1433, 1434, 1435, 1436, 1437,
  1438, 1439, 1440, 1441, 1442, 1443, 1444, 1445, 1446, 1447,
  1448, 1449, 1450,
  1254, 1255, 1256, 1257, 1258, 1259,
  1308, 1309, 1310, 1311, 1312, 1313,
])

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

  static DEBUG_RECTS   = false
  static _tintIdSeq   = 0    // incremented to give each img canvas a unique ID for bake cache

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
    this._boatActive      = false
    this._boatDrifting    = false
    this._boatCanvas      = null
    this._boatSinkOverride = 0
    this._boatScreenX     = null
    this._boatScreenY     = null
    this.tintManager = new TintManager()

    this._elev      = null
    this._elevMapId = null

    // Height map state
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
      }, 150)
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

    const easedX = fracX < 0.5
      ? 2 * fracX * fracX
      : 1 - Math.pow(-2 * fracX + 2, 2) / 2

    const mtnPx = baseX + (easedX - 0.5) * 8
    const mtnPy = baseY
    this._mountainImg.style.objectPosition = mtnPx.toFixed(2) + '% ' + mtnPy.toFixed(2) + '%'

    if (this._skyImg && this._skyImg.src) {
      this._skyParallaxX = (easedX - 0.5) * 3
    }
  }

  _extractPaletteFromImage(imgEl) {
    try {
      const c   = document.createElement('canvas')
      c.width   = 64
      c.height  = 64
      const ctx = c.getContext('2d')
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

  /**
   * Pre-bake tinted canvases for all billboard GIDs found in the map's
   * layer 1. Call once after map data is set (e.g. from the scene after
   * setPlayer). Spreads the canvas creation over a requestIdleCallback
   * so it doesn't spike the first frame.
   */
  prewarmBillboardTints(mapData) {
    if (!mapData?.layers?.[1]) return
    this._bakedTintCache = new Map()
    const layer1  = mapData.layers[1]
    const mapH    = layer1.length
    const mapW    = layer1[0]?.length ?? 0

    // Collect unique billboard GIDs
    const gids = new Set()
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const g = layer1[y][x]
        if (g && (OAK_STAMP_GIDS.has(g) || BOG_STAMP_GIDS.has(g) ||
                  WITHERED_STAMP_GIDS.has(g) || this._flatGids.has(g))) {
          gids.add(g)
        }
      }
    }

    if (gids.size === 0) return

    // Bake ~8 tint variants per GID using a spread of tile positions
    // that cover the hash range. Done via idle callback to avoid frame spike.
    // 8 sample positions spread across the tile hash range — each produces
    // a visibly different tint. Stored as variant index 0-7 in the cache.
    const samplePositions = [
      [3,3],[7,5],[11,9],[15,13],[19,7],[23,17],[27,11],[31,21]
    ]
    const gidArr = [...gids]
    let gi = 0

    const bakeNext = () => {
      if (gi >= gidArr.length) {
        console.log(`[PGR] billboard tint prewarm done — ${this._bakedTintCache.size} variants for ${gidArr.length} GIDs`)
        return
      }
      const gid = gidArr[gi++]
      const img = this._getTileCanvas(gid)
      if (img) {
        samplePositions.forEach(([tx, ty], vi) => {
          const tint = this.tintManager.getTint(gid, tx, ty)
          if (tint) this._getBakedTintCanvas(img, tint, tint.alpha, vi)
        })
      }
      // Yield between GIDs to avoid blocking
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(bakeNext, { timeout: 500 })
      } else {
        setTimeout(bakeNext, 0)
      }
    }

    // Wait for tileset to be ready before baking
    if (this._ready) {
      bakeNext()
    } else {
      const orig = this._tilesetImg
      const check = setInterval(() => {
        if (this._ready) { clearInterval(check); bakeNext() }
      }, 50)
    }
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

  setBuildings(list) {
    this._buildings = []
    for (const b of (list || [])) {
      const entry = {
        ...b,
        anchorRow:    b.y + b.fh - 1,
        centerColInt: Math.floor(b.x + b.fw / 2),
        canvas:       null,
      }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const c   = document.createElement('canvas')
        c.width   = img.width
        c.height  = img.height
        const ctx = c.getContext('2d')
        ctx.imageSmoothingEnabled = false
        ctx.filter = 'saturate(70%)'
        ctx.drawImage(img, 0, 0)
        ctx.filter = 'none'
        entry.canvas   = c
        this._lastCamX = null
      }
      img.onerror = e => console.error('[PGR] building image failed:', b.src, e)
      img.src = '/' + b.src.replace(/^\//, '')
      this._buildings.push(entry)
    }
    console.log('[PGR] buildings registered:', this._buildings.length)
  }

  registerCustomTile(gid, url) {
    this._tileCache.set(gid, null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c   = document.createElement('canvas')
      c.width   = img.width
      c.height  = img.height
      const ctx = c.getContext('2d')
      ctx.imageSmoothingEnabled = false
      ctx.filter = 'saturate(60%)'
      ctx.drawImage(img, 0, 0)
      ctx.filter = 'none'
      this._tileCache.set(gid, c)
      this._lastCamX = null
      console.log(`[PGR] custom tile ${gid} ready — ${img.width}x${img.height} from ${url}`)
    }
    img.onerror = e => console.error(`[PGR] custom tile ${gid} failed: ${url}`, e)
    img.src = url
  }

  _drawBuilding(ctx, b, horizonPx, sw) {
    const frontRow   = b.anchorRow + 1
    const yBase      = this._rowToScreenY(frontRow)
    if (yBase === null || yBase < horizonPx) return
    const os         = b.overscale ?? 1.2
    const cxTile     = b.x + b.fw / 2
    const scaleFront = this._scaleAtRow(frontRow)
    if (!(scaleFront > 0)) return
    const wFront     = b.fw * scaleFront * os
    const cxFront    = this._colToScreenX(cxTile, frontRow)
    if (cxFront + wFront < -sw || cxFront - wFront > sw * 2) return

    const mode = b.mode ?? 'box'
    let boundary = null
    ctx.globalAlpha = 1.0

    if (mode === 'decal') {
      boundary = this._drawBuildingDecal(ctx, b, cxTile, frontRow, os, horizonPx)
    } else if (mode === 'billboard') {
      const hB = wFront * (b.canvas.height / b.canvas.width)
      ctx.drawImage(b.canvas,
        Math.round(cxFront - wFront / 2), Math.round(yBase - hB),
        Math.round(wFront), Math.round(hB))
      boundary = [
        { x: cxFront - wFront / 2, y: yBase - hB },
        { x: cxFront + wFront / 2, y: yBase - hB },
        { x: cxFront + wFront / 2, y: yBase },
        { x: cxFront - wFront / 2, y: yBase },
      ]
    } else {
      boundary = this._drawBuildingBox(ctx, b, cxTile, cxFront, wFront, yBase, scaleFront)
    }

    if (boundary && boundary.length) {
      const bTint = this.tintManager.getTint(b.tintGid ?? 197, b.x, b.y)
      if (bTint) {
        ctx.save()
        ctx.globalCompositeOperation = 'source-atop'
        ctx.globalAlpha = (bTint.alpha ?? 0.45) * 0.8
        ctx.fillStyle = `hsl(${bTint.h},${bTint.s}%,${bTint.l}%)`
        ctx.beginPath()
        ctx.moveTo(boundary[0].x, boundary[0].y)
        for (let i = 1; i < boundary.length; i++) ctx.lineTo(boundary[i].x, boundary[i].y)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
    }
  }

  _drawBuildingBox(ctx, b, cxTile, cxFront, wFront, yBase, scaleFront) {
    const img   = b.canvas
    const iw    = img.width, ih = img.height
    const split = Math.min(0.85, Math.max(0.05, b.roofSplit ?? 0.45))
    const wallSrcY    = ih * split
    const wallSrcH    = ih - wallSrcY
    const wallScreenH = wFront * (wallSrcH / iw)
    const yWallTop    = yBase - wallScreenH

    const backRow = b.y
    let yBack     = this._rowToScreenY(backRow)
    let scaleBack = this._scaleAtRow(backRow)
    if (yBack === null || !(scaleBack > 0)) { yBack = yWallTop; scaleBack = scaleFront }
    const hTiles    = wallScreenH / scaleFront
    const wBack     = b.fw * scaleBack * (b.overscale ?? 1.2)
    const cxBack    = this._colToScreenX(cxTile, backRow)
    const yRoofBack = yBack - hTiles * scaleBack

    ctx.drawImage(img, 0, wallSrcY, iw, wallSrcH,
      Math.round(cxFront - wFront / 2), Math.round(yWallTop),
      Math.round(wFront), Math.round(wallScreenH))

    const TL = { x: cxBack  - wBack  / 2, y: yRoofBack }
    const TR = { x: cxBack  + wBack  / 2, y: yRoofBack }
    const BL = { x: cxFront - wFront / 2, y: yWallTop }
    const BR = { x: cxFront + wFront / 2, y: yWallTop }
    this._drawAffineTriangle(ctx, img,
      { u: 0, v: 0 }, { u: iw, v: 0 }, { u: iw, v: wallSrcY }, TL, TR, BR)
    this._drawAffineTriangle(ctx, img,
      { u: 0, v: 0 }, { u: iw, v: wallSrcY }, { u: 0, v: wallSrcY }, TL, BR, BL)

    return [
      { x: cxFront - wFront / 2, y: yBase },
      { x: cxFront + wFront / 2, y: yBase },
      BR, TR, TL, BL,
    ]
  }

  _drawBuildingDecal(ctx, b, cxTile, frontRow, os, horizonPx) {
    const img        = b.canvas
    const iw         = img.width, ih = img.height
    const widthTiles = b.fw * os
    const depthTiles = widthTiles * (ih / iw)
    const STRIPS     = 10
    let prev = null
    for (let i = 0; i <= STRIPS; i++) {
      const f   = i / STRIPS
      const row = frontRow - depthTiles * (1 - f)
      const y   = this._rowToScreenY(row)
      const s   = this._scaleAtRow(row)
      const cx  = this._colToScreenX(cxTile, row)
      const cur = (y === null || !(s > 0)) ? null
        : { y, cx, w: widthTiles * s, v: ih * f }
      if (prev && cur && cur.y > horizonPx - 4) {
        const TL = { x: prev.cx - prev.w / 2, y: prev.y }
        const TR = { x: prev.cx + prev.w / 2, y: prev.y }
        const BL = { x: cur.cx  - cur.w  / 2, y: cur.y }
        const BR = { x: cur.cx  + cur.w  / 2, y: cur.y }
        this._drawAffineTriangle(ctx, img,
          { u: 0, v: prev.v }, { u: iw, v: prev.v }, { u: iw, v: cur.v }, TL, TR, BR)
        this._drawAffineTriangle(ctx, img,
          { u: 0, v: prev.v }, { u: iw, v: cur.v }, { u: 0, v: cur.v }, TL, BR, BL)
      }
      prev = cur
    }
    const backRowD = frontRow - depthTiles
    const yF = this._rowToScreenY(frontRow), sF = this._scaleAtRow(frontRow)
    const yK = this._rowToScreenY(backRowD), sK = this._scaleAtRow(backRowD)
    if (yF === null || yK === null) return null
    const cxF = this._colToScreenX(cxTile, frontRow)
    const cxK = this._colToScreenX(cxTile, backRowD)
    return [
      { x: cxK - widthTiles * sK / 2, y: yK },
      { x: cxK + widthTiles * sK / 2, y: yK },
      { x: cxF + widthTiles * sF / 2, y: yF },
      { x: cxF - widthTiles * sF / 2, y: yF },
    ]
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

  // ── Height map helpers ────────────────────────────────────────────────────

  /**
   * Height (in tile-heights) at vertex (col, row).
   * Vertex (c, r) is the TOP-LEFT corner of tile (c, r) and is shared by
   * the four tiles that meet at that corner — so adjacent tiles share values
   * and there are never seams.
   * Returns 0 when no height map is loaded or vertex is out of bounds.
   */
  _drawBankSide(ctx, xTop, xBot, yTop, yBot, alpha) {
    if (yBot - yTop < 2) return
    ctx.save()
    ctx.globalAlpha = alpha * 0.50
    try {
      const _g = ctx.createLinearGradient(0, yTop, 0, yBot)
      _g.addColorStop(0,    'rgba(42, 30, 14, 0.92)')
      _g.addColorStop(0.4,  'rgba(60, 44, 20, 0.75)')
      _g.addColorStop(1,    'rgba(48, 34, 16, 0.30)')
      ctx.fillStyle = _g
    } catch(e) { ctx.fillStyle = 'rgba(50, 35, 15, 0.55)' }
    ctx.beginPath()
    ctx.moveTo(xTop, yTop)
    ctx.lineTo(xBot, yTop)
    ctx.lineTo(xBot, yBot)
    ctx.lineTo(xTop, yBot)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  _vertexH(col, row) {
    const hm = this._heightMapSrc
    if (!hm) return 0
    if (col < 0 || row < 0 || col >= this._hmW || row >= this._hmH) return 0
    return hm[row][col] ?? 0
  }

  /**
   * Average height at the centre of tile (col, row) — mean of four corners.
   * Used to lift billboards (trees, player, flags) so they sit on terrain.
   */
  _tileHeightAt(col, row) {
    if (!this._heightMapSrc) return 0
    return (this._vertexH(col,   row  )
          + this._vertexH(col+1, row  )
          + this._vertexH(col,   row+1)
          + this._vertexH(col+1, row+1)) * 0.25
  }

  // ─────────────────────────────────────────────────────────────────────────

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
    ctx.drawImage(img, Math.round(screenX - scaledW / 2), Math.round(screenY - scaledH), Math.round(scaledW), Math.round(scaledH))
  }

  _drawBillboardTinted(ctx, img, screenX, screenY, scaledTileW, heightMult, tintHSL, tintAlpha, tileCol = 0, tileRow = 0) {
    const hm      = heightMult ?? PerspectiveGroundRenderer.HEIGHT_MULTIPLIER
    const scaledW = scaledTileW
    const scaledH = scaledTileW * hm
    const dx      = screenX - scaledW / 2
    const dy      = screenY - scaledH
    // Pick one of 8 pre-baked variants by tile position — stable per tile,
    // varies across the map so neighbouring trees look different.
    const _vi    = _tmHashPGR(tileCol, tileRow) & 7
    const tinted = this._getBakedTintCanvas(img, tintHSL, tintAlpha ?? 0.38, _vi)
    ctx.drawImage(tinted ?? img, dx, dy, scaledW, scaledH)
  }

  /**
   * Return a pre-baked tinted copy of img at variantIndex (0-7).
   * source-atop on an isolated canvas correctly clips tint to opaque
   * pixels only — no bleed into transparent areas.
   * Created once per (img × variant), then cached forever.
   */
  _getBakedTintCanvas(img, tintHSL, alpha, variantIndex = 0) {
    if (!this._bakedTintCache) this._bakedTintCache = new Map()
    const id  = img.__tintId ?? (img.__tintId = ++PerspectiveGroundRenderer._tintIdSeq)
    const key = `${id}_${variantIndex}`
    if (this._bakedTintCache.has(key)) return this._bakedTintCache.get(key)

    const { h, s, l } = tintHSL
    const w = img.width, he = img.height
    const tc   = document.createElement('canvas')
    tc.width   = w; tc.height = he
    const tCtx = tc.getContext('2d')
    tCtx.imageSmoothingEnabled = false
    // Draw sprite — source-atop then clips tint to its opaque pixels only.
    // This canvas is isolated so there is nothing underneath to bleed into.
    tCtx.drawImage(img, 0, 0)
    tCtx.globalCompositeOperation = 'source-atop'
    tCtx.globalAlpha = alpha
    tCtx.fillStyle   = `hsl(${h},${s}%,${l}%)`
    tCtx.fillRect(0, 0, w, he)
    this._bakedTintCache.set(key, tc)
    return tc
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

  _elevationY(worldRow, elevation) {
    const baseY = this._rowToScreenY(worldRow)
    if (!elevation || baseY === null) return baseY
    const pxPerTile = this._scaleAtRow(worldRow)
    return baseY - elevation * pxPerTile
  }

  _drawNorthCliffFace(ctx, col, row, elev, tileAlpha, yTopClamped, yBotClamped) {
    const scaledW = this._scaleAtRow(row + 1)
    const tileH   = scaledW * elev

    const capBot = yTopClamped
    const capTop = yTopClamped - tileH

    const horizonPx = this._horizonPx()
    if (capBot < horizonPx) return

    const xTL = this._colToScreenX(col,     row)
    const xTR = this._colToScreenX(col + 1, row)
    const xBL = this._colToScreenX(col,     row + 1)
    const xBR = this._colToScreenX(col + 1, row + 1)

    ctx.globalAlpha = tileAlpha
    this._drawTrapezoidTinted(ctx, 839,
      { x: xTL, y: capTop }, { x: xTR, y: capTop },
      { x: xBL, y: capBot }, { x: xBR, y: capBot },
      null)
    ctx.globalAlpha = 1.0

    const faceTop = capBot
    const faceBot = yBotClamped
    if (faceBot <= faceTop) return

    const screenX = this._colToScreenX(col + 0.5, row + 1)
    ctx.save()
    ctx.globalAlpha = tileAlpha * 0.88
    ctx.fillStyle = '#2a4020'
    ctx.fillRect(
      Math.round(screenX - scaledW / 2),
      Math.round(faceTop),
      Math.round(scaledW),
      Math.round(faceBot - faceTop))
    ctx.restore()
  }

  _drawElevatedFace(ctx, col, row, elev, gid, tileAlpha, yBotHint) {
    const yBot = this._rowToScreenY(row + 1) ?? yBotHint
    if (yBot === null) return
    const tileH = this._scaleAtRow(row + 1) || this._scaleAtRow(row)
    const yTop  = yBot - tileH * elev
    if (yTop >= yBot) return

    const xBL = this._colToScreenX(col,     row + 1)
    const xBR = this._colToScreenX(col + 1, row + 1)
    const xTL = xBL
    const xTR = xBR

    ctx.globalAlpha = tileAlpha
    this._drawTrapezoidTinted(ctx, gid,
      { x: xTL, y: yTop }, { x: xTR, y: yTop },
      { x: xBL, y: yBot }, { x: xBR, y: yBot },
      null)
    ctx.globalAlpha = 1.0
  }

  _drawElevatedSideFace(ctx, edgeCol, row, elev, gid, tileAlpha) {
    const yFront = this._rowToScreenY(row + 1)
    if (yFront === null) return
    const sFront = this._scaleAtRow(row + 1)
    if (!(sFront > 0)) return

    const yBack  = this._rowToScreenY(row)
    const sBack  = this._scaleAtRow(row)

    const xFront = this._colToScreenX(edgeCol, row + 1)
    const xBack  = this._colToScreenX(edgeCol, row)

    const yFrontTop = yFront - elev * sFront
    const yBackTop  = yBack  !== null ? yBack  - elev * sBack : yFrontTop

    const tint = this.tintManager.getTint(gid, edgeCol, row)
    const sideColor = tint
      ? `hsl(${tint.h},${Math.round(tint.s * 0.55)}%,${Math.max(tint.l - 18, 4)}%)`
      : 'rgb(52, 38, 28)'

    ctx.save()
    ctx.globalAlpha = tileAlpha * 0.85
    ctx.fillStyle = sideColor
    ctx.beginPath()
    ctx.moveTo(xBack,  yBackTop)
    ctx.lineTo(xFront, yFrontTop)
    ctx.lineTo(xFront, yFront)
    if (yBack !== null) ctx.lineTo(xBack, yBack)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(20,14,8,0.45)'
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.restore()
  }

  _drawCliffSide(ctx, col, row, elev, neighbourRow, sideDir, tileAlpha) {
    const edgeCol  = sideDir > 0 ? col + 1 : col
    const yBotA    = this._rowToScreenY(row + 1)
    const tileHA   = this._scaleAtRow(row + 1)
    const yTopA    = yBotA !== null ? yBotA - tileHA * elev : null

    const yBotB    = this._rowToScreenY(neighbourRow + 1)
    const tileHB   = this._scaleAtRow(neighbourRow + 1)
    const yTopB    = yBotB !== null ? yBotB - tileHB * elev : null

    if (yTopA === null || yBotA === null || yTopB === null || yBotB === null) return
    if (yBotA <= yTopA || yBotB <= yTopB) return

    const xA = this._colToScreenX(edgeCol, row + 1)
    const xB = this._colToScreenX(edgeCol, neighbourRow + 1)

    ctx.save()
    ctx.globalAlpha = tileAlpha * 0.85
    ctx.fillStyle = 'rgb(60, 42, 28)'
    ctx.beginPath()
    ctx.moveTo(xB, yTopB)
    ctx.lineTo(xB, yBotB)
    ctx.lineTo(xA, yBotA)
    ctx.lineTo(xA, yTopA)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(30,20,10,0.6)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  _drawCliffFace(ctx, col, row, elev, tileAlpha) {
    const yBot = this._rowToScreenY(row + 1)
    if (yBot === null) return

    const tileScreenH = this._scaleAtRow(row + 1)
    const yTop        = yBot - tileScreenH * elev

    if (yTop >= yBot) return

    const xBL = this._colToScreenX(col,     row + 1)
    const xBR = this._colToScreenX(col + 1, row + 1)
    const xTL = xBL
    const xTR = xBR

    ctx.globalAlpha = tileAlpha
    this._drawTrapezoidTinted(ctx,
      PerspectiveGroundRenderer.CLIFF_FACE_GID,
      { x: xTL, y: yTop }, { x: xTR, y: yTop },
      { x: xBL, y: yBot }, { x: xBR, y: yBot },
      null)
    ctx.globalAlpha = 1.0
  }

  // ─────────────────────────────────────────────────────────────────────────

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

    // ── Height map cache ─────────────────────────────────────────────────────
    if (this.scene.mapData?.heightMap !== this._heightMapSrc) {
      this._heightMapSrc = this.scene.mapData?.heightMap ?? null
      this._hmW = (this.scene.mapData?.width  ?? 0) + 1
      this._hmH = (this.scene.mapData?.height ?? 0) + 1
    }

    // ── Elevation map ────────────────────────────────────────────────────────
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

    const fillGid  = layer0[mapH - 1]?.[Math.floor(mapW / 2)] ?? 733
    const fillTint = this.tintManager.getTint(fillGid, 0, 0)

    const gcR = this._gcR ?? this._groundColour ?? '#2a3a1a'

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

    const groundGrad = this._gCtx.createLinearGradient(0, horizonPx, 0, horizonPx + 160)
    groundGrad.addColorStop(0, 'rgba(30,24,18,0)')
    groundGrad.addColorStop(1, gcR)
    this._gCtx.fillStyle = groundGrad
    this._gCtx.fillRect(0, horizonPx, sw, 160)
    this._gCtx.fillStyle = gcR
    this._gCtx.fillRect(0, horizonPx + 160, sw, sh - horizonPx - 160)
    if (this.scene?.getMapKey?.()?.includes('sea') || this.scene?.getMapKey?.()?.includes('d3')) {
      this._gCtx.fillStyle = '#2a3f5a'
      this._gCtx.fillRect(0, sh - 40, sw, 40)
    }

    // South-edge fill: cover any gap between the last rendered tile row and
    // the screen bottom with the map's southernmost tile colour.
    // Compute where the last map row projects to screen Y and fill below it.
    const _lastRowScreenY = this._rowToScreenY(mapH)
    if (_lastRowScreenY !== null && _lastRowScreenY < sh) {
      // Use fill tint colour derived from the south edge tile
      this._gCtx.fillStyle = gcR
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

    const tileRowEnd   = Math.min(Math.floor(camRow) - 1, mapH - 1 + EX * 3)
    const tileRowStart = Math.max(0, Math.floor(camRow - FL * 8))

    const p = this._player
    let playerTileRow = -1
    let playerScreenX = sw / 2
    let playerScreenY = sh / 2
    let playerDrawn   = false

    if (p) {
      const snapX = this._boatActive
        ? p.logicalX
        : Math.floor(p.logicalX / this.tileDisplaySize) * this.tileDisplaySize + this.tileDisplaySize * 0.5
      const snapY = this._boatActive
        ? p.logicalY
        : Math.floor(p.logicalY / this.tileDisplaySize) * this.tileDisplaySize + this.tileDisplaySize * 0.5
      const proj     = this._projectLogical(snapX, snapY)
      if (proj) {
        // Use target tile for terrain lift so the lift is stable during a step
        // and matches where the player is heading, not the mid-lerp logicalY.
        const _ptCol     = Math.floor((p.targetX ?? p.logicalX) / this.tileDisplaySize)
        const _ptRow     = Math.floor((p.targetY ?? p.logicalY) / this.tileDisplaySize)
        const _ptGid     = this.scene.mapData?.layers?.[0]?.[_ptRow]?.[_ptCol] ?? 0
        const _ptIsWater = _ptGid === 1625 || _ptGid === 1679 || _ptGid === 731
        const _pHt       = _ptIsWater ? 0
          : (this._vertexH(_ptCol, _ptRow + 1) + this._vertexH(_ptCol + 1, _ptRow + 1)) * 0.5
        // playerScreenY stays at the LOGICAL projected Y so painter-order
        // (tileRow === playerTileRow) and the highlight square stay correct.
        // Terrain lift is stored separately and applied only at draw time.
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
    const _deferredBanks  = []       // riverbank earth faces

    for (let tileRow = tileRowStart; tileRow <= tileRowEnd; tileRow++) {

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

      const colStart = Math.floor(camCol - halfCols) - EX
      const colEnd   = Math.ceil(camCol + halfCols)  + EX

      const rowInMap = tileRow >= 0 && tileRow < mapH

      for (let tileCol = colStart; tileCol <= colEnd; tileCol++) {

        const xTL = this._colToScreenX(tileCol,     tileRow)
        const xTR = this._colToScreenX(tileCol + 1, tileRow)
        if (xTR < -10 || xTL > sw + 10) continue

        const colInMap = tileCol >= 0 && tileCol < mapW
        const inMap    = rowInMap && colInMap

        if (!inMap) continue

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
            // Ground tiles: use height+slope shading when height map is active.
            // Vertex heights are already computed below for corner Y offsets —
            // read them here so getGroundTint gets the same values.
            let tint0
            if (!inMap) {
              tint0 = fillTint
            } else if (this._heightMapSrc && GID_CATEGORIES_GROUND.has(gid0)) {
              const _h00 = this._vertexH(tileCol,     tileRow    )
              const _h10 = this._vertexH(tileCol + 1, tileRow    )
              const _h01 = this._vertexH(tileCol,     tileRow + 1)
              const _h11 = this._vertexH(tileCol + 1, tileRow + 1)
              tint0 = this.tintManager.getGroundTint(gid0, tileCol, tileRow, _h00, _h10, _h01, _h11)
            } else {
              tint0 = this.tintManager.getTint(gid0, tileCol, tileRow)
            }

            // ── Per-vertex height offsets ──────────────────────────────────
            // Each corner is lifted independently using its shared vertex height.
            // Top corners use back-edge scale (tileRow), bottom use front-edge (tileRow+1).
            // Layered on top of any existing tileElev offset.
            const _sTop = this._scaleAtRow(tileRow)
            const _sBot = this._scaleAtRow(tileRow + 1)
            const _elevDeltaTop = tileElev > 0 ? (yTopElev - yTopClamped) : 0

            // Water and shore tiles are always flat — zero height on all corners.
            // This prevents river hills and keeps water at the terrain baseline.
            const _isGroundWater = _rawGid0 === 1625 || _rawGid0 === 1679 || _rawGid0 === 731
            const _yTL = _isGroundWater ? yTopClamped + _elevDeltaTop : yTopClamped + _elevDeltaTop - this._vertexH(tileCol,     tileRow    ) * _sTop
            const _yTR = _isGroundWater ? yTopClamped + _elevDeltaTop : yTopClamped + _elevDeltaTop - this._vertexH(tileCol + 1, tileRow    ) * _sTop
            const _yBL = _isGroundWater ? yBotClamped                 : yBotClamped                 - this._vertexH(tileCol,     tileRow + 1) * _sBot
            const _yBR = _isGroundWater ? yBotClamped                 : yBotClamped                 - this._vertexH(tileCol + 1, tileRow + 1) * _sBot

            // ── South bank north face (inline, before tile) ───────────────
            // If water is immediately to the north (tileRow-1), the raised
            // terrain has a visible drop from its top edge down to water level.
            // Draw it here so the tile surface paints over any lower overlap.
            if (!_isGroundWater && inMap) {
              const _northGid = layer0[tileRow - 1]?.[tileCol] ?? 0
              const _northIsWater = _northGid === 1625 || _northGid === 1679 || _northGid === 731
              if (_northIsWater) {
                // Water row Y is yTopClamped (the back edge of this tile = front of water tile)
                // Tile top corners are _yTL/_yTR — they're lifted above yTopClamped by terrain
                const _nbGap = Math.max(_yTL, _yTR) - yTopClamped
                if (_nbGap > 3) {
                  this._gCtx.save()
                  this._gCtx.globalAlpha = tileAlpha * 0.75
                  try {
                    const _nbg = this._gCtx.createLinearGradient(0, yTopClamped, 0, Math.max(_yTL, _yTR))
                    _nbg.addColorStop(0,   'rgba(38, 28, 12, 0.85)')
                    _nbg.addColorStop(0.5, 'rgba(58, 42, 18, 0.80)')
                    _nbg.addColorStop(1,   'rgba(68, 50, 22, 0.70)')
                    this._gCtx.fillStyle = _nbg
                  } catch(e) { this._gCtx.fillStyle = 'rgba(52, 38, 16, 0.75)' }
                  this._gCtx.beginPath()
                  this._gCtx.moveTo(xTL, yTopClamped)
                  this._gCtx.lineTo(xTR, yTopClamped)
                  this._gCtx.lineTo(xTR, _yTR)
                  this._gCtx.lineTo(xTL, _yTL)
                  this._gCtx.closePath()
                  this._gCtx.fill()
                  this._gCtx.restore()
                }
              }
            }

            this._drawTrapezoidTinted(this._gCtx, gid0,
              {x: xTL, y: _yTL}, {x: xTR, y: _yTR},
              {x: xBL, y: _yBL}, {x: xBR, y: _yBR},
              tint0)

            // ── Cliff face ─────────────────────────────────────────────────
            const _hasSouthFace = inMap && tileElev > 0 && southElev < tileElev
              && yBotClamped >= horizonPx + 30
              && !(layer3?.[tileRow]?.[tileCol])

            // Riverbank: ground tile bordering water to south — collect for earth face
            const _southGid = inMap ? (layer0[tileRow + 1]?.[tileCol] ?? 0) : 0
            const _southIsWater = _southGid === 1625 || _southGid === 1679 || _southGid === 731
            if (inMap && _southIsWater && !_isGroundWater && yBotClamped >= horizonPx + 4) {
              const _bxBL = this._colToScreenX(tileCol,     tileRow + 1)
              const _bxBR = this._colToScreenX(tileCol + 1, tileRow + 1)
              const _bYWater = this._rowToScreenY(tileRow + 2) ?? yBotClamped
              // Only draw bank if ground bottom edge is meaningfully above water row
              const _bankGap = _bYWater - Math.min(_yBL, _yBR)
              if (_bankGap > 4) {
                _deferredBanks.push({
                  col: tileCol, row: tileRow,
                  yBL: _yBL, yBR: _yBR,
                  yWater: _bYWater,
                  xBL: _bxBL, xBR: _bxBR,
                  alpha: tileAlpha, side: false,
                })
              }
            }

            // East side face: water to east at same row (north bank) → deferred
            const _eastGid  = inMap ? (layer0[tileRow    ]?.[tileCol + 1] ?? 0) : 0
            const _eastIsWater  = _eastGid  === 1625 || _eastGid  === 1679 || _eastGid  === 731
            if (inMap && _eastIsWater && !_isGroundWater && yBotClamped >= horizonPx + 4) {
              const _eX0 = this._colToScreenX(tileCol + 1, tileRow + 1)
              const _eYWater = this._rowToScreenY(tileRow + 2) ?? yBotClamped
              if (_eYWater - _yBR > 4) {
                _deferredBanks.push({ side: true,
                  xSL: _eX0, xSR: _eX0, ySL: _yBR, ySR: _yBR,
                  yWater: _eYWater, alpha: tileAlpha })
              }
            }
            // East side face: water at row above (south bank) → draw inline before tile surface
            const _eastGidN = inMap ? (layer0[tileRow - 1]?.[tileCol + 1] ?? 0) : 0
            const _eastNIsWater = _eastGidN === 1625 || _eastGidN === 1679 || _eastGidN === 731
            if (inMap && _eastNIsWater && !_eastIsWater && !_isGroundWater && yBotClamped >= horizonPx + 4) {
              // South bank east face: draw only the gap BELOW the tile bottom edge.
              // Tile surface will paint over anything above yBotClamped naturally.
              const _eX0 = this._colToScreenX(tileCol + 1, tileRow + 1)
              const _eYWater = this._rowToScreenY(tileRow + 2) ?? yBotClamped
              if (_eYWater - _yBR > 4) {
                this._drawBankSide(this._gCtx, _eX0, _eX0, _yBR, _eYWater, tileAlpha)
              }
            }

            // West side face: water to west at same row (north bank) → deferred
            const _westGid  = inMap ? (layer0[tileRow    ]?.[tileCol - 1] ?? 0) : 0
            const _westIsWater  = _westGid  === 1625 || _westGid  === 1679 || _westGid  === 731
            if (inMap && _westIsWater && !_isGroundWater && yBotClamped >= horizonPx + 4) {
              const _wX0 = this._colToScreenX(tileCol, tileRow + 1)
              const _wYWater = this._rowToScreenY(tileRow + 2) ?? yBotClamped
              if (_wYWater - _yBL > 4) {
                _deferredBanks.push({ side: true,
                  xSL: _wX0, xSR: _wX0, ySL: _yBL, ySR: _yBL,
                  yWater: _wYWater, alpha: tileAlpha })
              }
            }
            // West side face: water at row above (south bank) → draw inline before tile surface
            const _westGidN = inMap ? (layer0[tileRow - 1]?.[tileCol - 1] ?? 0) : 0
            const _westNIsWater = _westGidN === 1625 || _westGidN === 1679 || _westGidN === 731
            if (inMap && _westNIsWater && !_westIsWater && !_isGroundWater && yBotClamped >= horizonPx + 4) {
              const _wX0 = this._colToScreenX(tileCol, tileRow + 1)
              const _wYWater = this._rowToScreenY(tileRow + 2) ?? yBotClamped
              if (_wYWater - _yBL > 4) {
                this._drawBankSide(this._gCtx, _wX0, _wX0, _yBL, _wYWater, tileAlpha)
              }
            }
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

        // Object tile — elevation-aware Y for layer 1
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
                // Billboard Y lifted by terrain height at this tile.
                // Clamp to zero on water/shore — negative valley heights must not sink trees.
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
              // Flat layer-1 tile — use same per-vertex Y as layer-0 so
              // shore/edge tiles stay glued to the terrain they overlay.
              const xBL1 = this._colToScreenX(tileCol,     tileRow + 1)
              const xBR1 = this._colToScreenX(tileCol + 1, tileRow + 1)
              const _l1sTop = this._scaleAtRow(tileRow)
              const _l1sBot = this._scaleAtRow(tileRow + 1)
              const _l1elevDelta = _l1Elev > 0 ? (_l1YTop - yTopClamped) : 0
              const _l1GidIsWater = (layer0[tileRow]?.[tileCol] ?? 0) === 1625
                || (layer0[tileRow]?.[tileCol] ?? 0) === 1679
                || (layer0[tileRow]?.[tileCol] ?? 0) === 731
              // Water/shore layer-1 tiles always flat — no terrain warping on water
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

        // Layer 2 — elevated flat caps
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

        // Layer 3 — south plateau elevated grass + connector
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

        // Encounter flags
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

      // Buildings
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

    // ── Deferred cliff faces + sides ─────────────────────────────────────────
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

    // ── Riverbank earth faces ────────────────────────────────────────────────
    // Drawn at low opacity so water tiles render dominant over the bank face.
    // The bank acts as a depth hint — visible at the turf edge, ghosted below.
    for (const bk of _deferredBanks) {
      const { yBL, yBR, yWater, xBL, xBR, xSL, xSR, ySL, ySR, alpha, side } = bk
      if (side) {
        // East/west side face of a land tile protruding beside water
        const yBot = yWater
        if (yBot <= Math.min(ySL, ySR) + 1) continue
        this._gCtx.save()
        this._gCtx.globalAlpha = alpha * 0.40
        try {
          const _sg = this._gCtx.createLinearGradient(0, Math.min(ySL, ySR), 0, yBot)
          _sg.addColorStop(0,   'rgba(45, 32, 14, 0.90)')
          _sg.addColorStop(0.5, 'rgba(62, 44, 20, 0.75)')
          _sg.addColorStop(1,   'rgba(48, 34, 16, 0.40)')
          this._gCtx.fillStyle = _sg
        } catch(e) { this._gCtx.fillStyle = 'rgba(50, 35, 15, 0.55)' }
        this._gCtx.beginPath()
        this._gCtx.moveTo(xSL, ySL)
        this._gCtx.lineTo(xSR, ySR)
        this._gCtx.lineTo(xSR, yBot)
        this._gCtx.lineTo(xSL, yBot)
        this._gCtx.closePath()
        this._gCtx.fill()
        this._gCtx.restore()
      } else {
        // South-facing bank face
        const yBot = yWater
        if (yBot <= yBL + 1 && yBot <= yBR + 1) continue
        this._gCtx.save()
        // Ghost alpha — water will overdraw the lower portion naturally
        this._gCtx.globalAlpha = alpha * 0.60
        const yTop = Math.min(yBL, yBR)
        try {
          const _bg = this._gCtx.createLinearGradient(0, yTop, 0, yBot)
          _bg.addColorStop(0,    'rgba(42, 30, 14, 0.95)')  // dark turf edge
          _bg.addColorStop(0.25, 'rgba(58, 42, 18, 0.80)')  // upper soil
          _bg.addColorStop(0.60, 'rgba(65, 48, 22, 0.55)')  // mid — water starts to show
          _bg.addColorStop(1,    'rgba(50, 36, 16, 0.20)')  // near-transparent at waterline
          this._gCtx.fillStyle = _bg
        } catch(e) {
          this._gCtx.fillStyle = 'rgba(52, 36, 16, 0.60)'
        }
        this._gCtx.beginPath()
        this._gCtx.moveTo(xBL, yBL)
        this._gCtx.lineTo(xBR, yBR)
        this._gCtx.lineTo(xBR, yBot)
        this._gCtx.lineTo(xBL, yBot)
        this._gCtx.closePath()
        this._gCtx.fill()
        // Turf-edge stroke — full opacity, just at the very top
        this._gCtx.globalAlpha = alpha * 0.70
        this._gCtx.strokeStyle = 'rgba(30, 22, 8, 0.85)'
        this._gCtx.lineWidth = 1.5
        this._gCtx.beginPath()
        this._gCtx.moveTo(xBL, yBL); this._gCtx.lineTo(xBR, yBR)
        this._gCtx.stroke()
        this._gCtx.restore()
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

    // Player tile highlight
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

      // Highlight — same four per-vertex Y as the ground tile it sits on,
      // so it warps with the terrain and stays flush underfoot on hills.
      const ts      = this.tileDisplaySize
      const hlTileX = Math.floor(_hlLX / ts)
      const hlTileY = Math.floor(_hlLY / ts)
      const _hlBaseT = this._rowToScreenY(hlTileY)
      const _hlBaseB = this._rowToScreenY(hlTileY + 1)
      if (_hlBaseT !== null && _hlBaseB !== null) {
        const _hlSTop = this._scaleAtRow(hlTileY)
        const _hlSBot = this._scaleAtRow(hlTileY + 1)
        // Four screen corners matching the ground tile exactly
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

    this.scene?.onPGRDrawComplete?.(this._oCtx)
    this.scene?.onPGRDrawComplete?.(this._oCtx)
    this._oCtx.restore()
    this._gCtx.restore()
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
      this._boatSinkOverride = 0.32
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

    const boatVX = this._boatActive ? (this.scene?.boatSystem?._vx ?? 0) : 0
    const boatVY = this._boatActive ? (this.scene?.boatSystem?._vy ?? 0) : 0
    const boatSpd = Math.hypot(boatVX, boatVY)

    const curTileX = p ? Math.floor(p.logicalX / this.tileDisplaySize) : 0
    const curTileY = p ? Math.floor(p.logicalY / this.tileDisplaySize) : 0
    const dvx = curTileX - (this._prevTileX ?? curTileX)
    const dvy = curTileY - (this._prevTileY ?? curTileY)
    const stepped = dvx !== 0 || dvy !== 0
    this._prevTileX = curTileX
    this._prevTileY = curTileY

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
      const joystickActive = (this.scene?.joystick?.force ?? 0) > 10
      const strokeRate = Math.min(boatSpd / 80, 1.0) * 0.025
      if (joystickActive && boatSpd > 8) {
        this._strokeT = Math.min(1.0, (this._strokeT ?? 0) + strokeRate)
        if (this._strokeT >= 1.0) this._strokeT = 0
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

    const strokeT = this._strokeT ?? 0
    let rowLean = 0, rowBob = 0, boatTilt = 0
    if (this._boatActive) {
      if (strokeT < 0.15) {
        const k = strokeT / 0.15
        rowLean = -0.07 * k
        rowBob  = scaledTileW * 0.01 * k
      } else if (strokeT < 0.6) {
        const k = (strokeT - 0.15) / 0.45
        rowLean = -0.07 + 0.16 * k
        rowBob  = scaledTileW * 0.01 - scaledTileW * 0.02 * Math.sin(k * Math.PI)
        boatTilt = -0.04 * Math.sin(k * Math.PI)
      } else if (strokeT < 0.8) {
        const k = (strokeT - 0.6) / 0.2
        rowLean = 0.09 - 0.03 * k
        rowBob  = -scaledTileW * 0.008
      } else {
        const k = (strokeT - 0.8) / 0.2
        rowLean = 0.06 - 0.06 * k
        rowBob  = -scaledTileW * 0.008 * (1 - k)
      }
    }

    if (this._boatActive) {
  const waveRenderer = this.scene._waveRenderer
  if (waveRenderer) {
    this._wobblePhase = waveRenderer.wavePhaseAtPlayer
    const waveTargetAmp = waveRenderer.waveAmpAtPlayer / (scaledTileW || 1) * 0.10
    const boatTargetAmp = boatSpd > 8
      ? 0.04 + Math.min(boatSpd / 120, 0.10)
      : 0.012
    const targetAmp = Math.max(boatTargetAmp, waveTargetAmp)
    this._wobbleAmp = this._wobbleAmp ?? 0.012
    this._wobbleAmp += (targetAmp - this._wobbleAmp) * 0.04
        const rideT   = waveRenderer.waveRideT ?? 0
        const rideAmp = waveRenderer.waveRideAmp ?? 0
        this._waveRideOffset = this._waveRideOffset ?? 0
        this._waveRideOffset += (rideT * rideAmp * 0.85 - this._waveRideOffset) * 0.06
      } else {
        this._waveRideOffset = 0
    const wobbleFreq = 1.8 + boatSpd * 0.04
    this._wobblePhase = ((this._wobblePhase ?? 0) + wobbleFreq * 0.016) % (Math.PI * 2)
    const targetAmp = boatSpd > 8
      ? 0.04 + Math.min(boatSpd / 120, 0.10)
      : 0.012
    this._wobbleAmp = this._wobbleAmp ?? 0.012
    this._wobbleAmp += (targetAmp - this._wobbleAmp) * 0.04
  }
} else {
      this._wobblePhase = 0
      this._wobbleAmp   = 0
    }

    const wobbleRoll = this._boatActive
      ? Math.sin(this._wobblePhase) * (this._wobbleAmp ?? 0)
      : 0

    const idleBob = this._boatActive
      ? -Math.abs(Math.sin((this._wobblePhase ?? 0) + Math.PI * 0.5)) * scaledTileW * (this._wobbleAmp ?? 0) * 0.8
      : 0

    const velTiltX  = this._boatActive ? boatVX * 0.00025 : 0
    const velTiltY  = this._boatActive ? boatVY * 0.00018 : 0

    const prevVX    = this._prevBoatVX ?? boatVX
    const accelX    = boatVX - prevVX
    this._prevBoatVX = boatVX
    const accelTilt = this._boatActive ? -accelX * 0.005 : 0

    const totalBob  = rowBob + idleBob
    const totalLean = rowLean + wobbleRoll + velTiltX + accelTilt

    if ((this._boatActive || this._boatDrifting) && this._boatCanvas) {
      if (this._boatDrifting) {
        const _dTS = this.tileDisplaySize
        const _dTX = Math.floor((this._boatWorldX ?? 0) / _dTS)
        const _dTY = Math.floor((this._boatWorldY ?? 0) / _dTS)
        const _dGid = this.scene.mapData?.layers?.[0]?.[_dTY]?.[_dTX] ?? 0
        const _dShore = new Set([1472,1473,1474,1526,1528,1580,1581,1582,1635,1636,1689,1690,1742,1743,1796,1797,1852,1906,1958,1959,1960,2012,2013,731])
        const _dWater = new Set([1625,1679])
        const driftPxPerFrame = (_dShore.has(_dGid) || (!_dWater.has(_dGid) && _dGid !== 0)) ? 0 : (this._boatDriftSpeed ?? 18) / 60
        this._boatWorldX = (this._boatWorldX ?? 0) + driftPxPerFrame

        const driftProj = this._projectLogical(this._boatWorldX, this._boatWorldY ?? screenY, true)
        if (!driftProj) return

        const driftScreenX = driftProj.screenX
        const driftScreenY = driftProj.screenY
        const driftScale   = driftProj.scale * this.tileDisplaySize
        const bc    = this._boatCanvas
        const boatW = Math.round(driftScale * 1.6 * ps)
        const boatH = Math.round(boatW * (bc.height / bc.width))
        ctx.save()
        ctx.globalAlpha = 1.0
        ctx.drawImage(bc, Math.round(driftScreenX - boatW / 2), Math.round(driftScreenY - boatH * 0.8), boatW, boatH)
        ctx.restore()
      } else {
        if (this._boatScreenX == null) {
          this._boatScreenX = screenX
          this._boatScreenY = screenY
        } else {
          const lerpSpeed = 0.25
          this._boatScreenX += (screenX - this._boatScreenX) * lerpSpeed
          this._boatScreenY += (screenY - this._boatScreenY) * lerpSpeed
        }
        this._boatLastScreenX = this._boatScreenX
        this._boatLastScreenY = this._boatScreenY
        const bx    = this._boatActive ? (this._boatScreenX ?? screenX) : screenX
        const by    = this._boatActive ? (this._boatScreenY ?? screenY) : screenY
        const bc    = this._boatCanvas
        const boatW = Math.round(scaledTileW * 1.6 * ps)
        const boatH = Math.round(boatW * (bc.height / bc.width))
        const boatTop = by - boatH * 0.6
        const _boatRock = wobbleRoll + velTiltX + accelTilt
        const _boatPitch = velTiltY
        if (Math.abs(_boatRock) > 0.001 || Math.abs(_boatPitch) > 0.001 || this._facingLeft !== undefined) {
          ctx.save()
          ctx.translate(Math.round(bx), Math.round(by + totalBob))
          ctx.rotate(_boatRock)
          ctx.transform(1, _boatPitch * 0.3, 0, 1, 0, 0)
          if (!this._facingLeft) ctx.scale(-1, 1)
          ctx.drawImage(bc, -Math.round(boatW / 2), Math.round(boatTop - by - totalBob), boatW, boatH)
          ctx.restore()
        } else {
          ctx.drawImage(bc, Math.round(bx - boatW / 2), Math.round(boatTop + totalBob), boatW, boatH)
        }
      }
    }

    const _playerFacing = this._boatActive ? !this._facingLeft : this._facingLeft
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
        if (this._boatActive) ctx.rotate(totalLean * (this._facingLeft ? -1 : 1))
      } else {
        const inWater2 = !this._boatActive && (p?.terrainSinkOffset ?? 0) > 5
        const nsBounce = (this._boatActive || inWater2) ? 0 : arc * scaledTileW * 0.07
        ctx.transform(
          1.0 * (this._facingLeft ? -1 : 1), 0,
          0, 1.0 + ((this._boatActive || inWater2) ? 0 : arc * 0.04),
          0, -nsBounce
        )
        const _sink0ns = this._boatActive
          ? H * (this._boatSinkOverride ?? 0)
          : Math.min(H * 1.1, (p?.terrainSinkOffset ?? 0) * scaledTileW / 48)
        const _cropH0ns = H - _sink0ns
        ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH0ns / H), -W/2, -H + _sink0ns, W, _cropH0ns)
        ctx.restore()
        return
      }

      ctx.transform(scaleX * (_playerFacing ?? this._facingLeft ? -1 : 1), lean, 0, scaleY, sway, -bounce)
    } else {
      const breathScale = 1.0 + Math.sin(t * 1.1) * 0.014
      const shift       = Math.sin(t * 0.6) * scaledTileW * 0.018

	          const watch       = Math.sin(t * 2.1 + 0.5) * scaledTileW * 0.007
      ctx.transform(
        breathScale * ((_playerFacing ?? this._facingLeft) ? -1 : 1), 0,
        0, breathScale,
        shift, watch
      )
    }

    const sinkFrac = this._boatActive ? (this._boatSinkOverride ?? 0) : 0
    const _sinkRaw = (p?.terrainSinkOffset ?? 0)
    const _sink = this._boatActive ? H * sinkFrac : Math.min(H * 1.1, _sinkRaw * scaledTileW / 48)
    const _cropH   = H - _sink
    ctx.drawImage(img, 0, 0, img.width, img.height * (_cropH / H), -W/2, -H + _sink, W, _cropH)
    ctx.restore()
  }

}

