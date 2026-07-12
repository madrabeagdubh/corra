// pgrTileCache.js — tileset loading + tile/tint/avg-colour canvas caches
// Location: js/game/effects/pgr/pgrTileCache.js
//
// Split out of perspectiveGroundRenderer.js. Module pattern: plain
// functions taking the PGR instance as their first argument, reading
// and writing its fields directly -- all state stays on the instance,
// so behaviour is identical to the pre-split code and PGR.destroy()
// works untouched. Class statics are reached via pgr.constructor.

import { OAK_STAMP_GIDS, BOG_STAMP_GIDS, WITHERED_STAMP_GIDS } from './pgrShared.js'

// Kicks off the async tileset image load (or fakes readiness in
// DEBUG_RECTS mode). Was inline in the PGR constructor.
export function initTileset(pgr) {
  if (pgr.constructor.DEBUG_RECTS) {
    pgr._ready = true
    return
  }
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    pgr._tilesetImg = img
    pgr._ready      = true
    pgr._lastCamX   = null
    pgr._lastCamY   = null
    console.log('[PGR v8] tileset ready -', img.width, 'x', img.height)
  }
  img.onerror = e => console.error('[PGR v8] tileset load failed', e)
  img.src = pgr.constructor.TILESET_URL
}

export function loadCatalogue(pgr) {
    try {
      const catalogue = pgr.scene.cache.json.get('oryxCatalogue')
      if (!catalogue) {
        console.warn('[PGR] oryxCatalogue not in cache -- all layer 1 tiles will be flat')
        return
      }
      let billboardCount = 0
      for (const [gidStr, entry] of Object.entries(catalogue)) {
        if (entry?.flat === false) {
          pgr._flatGids.add(parseInt(gidStr))
          billboardCount++
        }
      }
      console.log(`[PGR] catalogue loaded - ${billboardCount} billboard GIDs, ${Object.keys(catalogue).length - billboardCount} flat GIDs`)
    } catch(e) {
      console.warn('[PGR] catalogue load failed:', e.message)
    }
  }

export function srcRect(pgr, gid) {
    const idx = gid - 1
    const col = idx % pgr.constructor.SHEET_COLS
    const row = Math.floor(idx / pgr.constructor.SHEET_COLS)
    const { MG, TW, TH } = pgr.constructor
    return { sx: MG + col * TW, sy: MG + row * TH, sw: TW, sh: TH }
  }

export function getTileCanvas(pgr, gid) {
    if (pgr._tileCache.has(gid)) return pgr._tileCache.get(gid)
    if (!pgr._tilesetImg) return null
    const { sx, sy, sw, sh } = srcRect(pgr, gid)
    const tc   = document.createElement('canvas')
    tc.width   = sw; tc.height = sh
    const tCtx = tc.getContext('2d')
    tCtx.imageSmoothingEnabled = false
    tCtx.filter = 'saturate(60%)'
    tCtx.drawImage(pgr._tilesetImg, sx, sy, sw, sh, 0, 0, sw, sh)
    tCtx.filter = 'none'
    pgr._tileCache.set(gid, tc)
    return tc
  }

  // True only if this GID's computed source rectangle actually falls
  // within the real, loaded Oryx tileset image. Some GIDs (e.g. building
  // footprint codes stamped into a village map's own layer0, like
  // b0's BLDG_THATCH1/BLDG_WALL1 etc.) are numerically far outside the
  // tileset's real bounds -- they're meant to be intercepted by a
  // completely separate system (setBuildings/customTiles), never drawn
  // via this texture lookup at all. _getTileCanvas doesn't validate this
  // itself (drawImage with an out-of-bounds source rect just silently
  // produces a blank/transparent result, no error) -- used by the
  // phantom-tile and north-preview paths to skip such GIDs gracefully
  // instead of attempting a draw that quietly does nothing, which looked
  // like a gap in the rendered ground.
export function isValidTilesetGid(pgr, gid) {
    if (!pgr._tilesetImg) return false
    const { sy, sh } = srcRect(pgr, gid)
    return (sy + sh) <= pgr._tilesetImg.height
  }

  // Average RGB of a tile's own pixels (transparent pixels skipped),
  // computed via getImageData ONCE per GID and cached forever. Used by
  // the LOD fill path -- see LOD_MIN_ROW_PX. Deliberately does NOT
  // cache a null result: _getTileCanvas can legitimately return null
  // while a registerCustomTile image is still loading, and caching that
  // would lock the GID out of ever getting a real colour.
export function getTileAvgColor(pgr, gid) {
    if (!pgr._avgColorCache) pgr._avgColorCache = new Map()
    if (pgr._avgColorCache.has(gid)) return pgr._avgColorCache.get(gid)
    const img = getTileCanvas(pgr, gid)
    if (!img) return null
    let avg = null
    try {
      const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data
      let r = 0, g = 0, b = 0, n = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 10) continue
        r += d[i]; g += d[i + 1]; b += d[i + 2]
        n++
      }
      if (n > 0) avg = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
    } catch (e) { /* tainted canvas etc. -- caller falls back to textured draw */ }
    pgr._avgColorCache.set(gid, avg)
    return avg
  }

export function getBakedTintCanvas(pgr, img, tintHSL, alpha, variantIndex = 0) {
    if (!pgr._bakedTintCache) pgr._bakedTintCache = new Map()
    const id  = img.__tintId ?? (img.__tintId = ++pgr.constructor._tintIdSeq)
    const key = `${id}_${variantIndex}`
    if (pgr._bakedTintCache.has(key)) return pgr._bakedTintCache.get(key)

    const { h, s, l } = tintHSL
    const w = img.width, he = img.height
    const tc   = document.createElement('canvas')
    tc.width   = w; tc.height = he
    const tCtx = tc.getContext('2d')
    tCtx.imageSmoothingEnabled = false
    tCtx.drawImage(img, 0, 0)
    tCtx.globalCompositeOperation = 'source-atop'
    tCtx.globalAlpha = alpha
    tCtx.fillStyle   = `hsl(${h},${s}%,${l}%)`
    tCtx.fillRect(0, 0, w, he)
    pgr._bakedTintCache.set(key, tc)
    return tc
  }

export function registerCustomTile(pgr, gid, url) {
    pgr._tileCache.set(gid, null)
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
      pgr._tileCache.set(gid, c)
      pgr._lastCamX = null
      console.log(`[PGR] custom tile ${gid} ready — ${img.width}x${img.height} from ${url}`)
    }
    img.onerror = e => console.error(`[PGR] custom tile ${gid} failed: ${url}`, e)
    img.src = url
  }

export function prewarmBillboardTints(pgr, mapData) {
    if (!mapData?.layers?.[1]) return
    pgr._bakedTintCache = new Map()
    const layer1  = mapData.layers[1]
    const mapH    = layer1.length
    const mapW    = layer1[0]?.length ?? 0

    const gids = new Set()
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const g = layer1[y][x]
        if (g && (OAK_STAMP_GIDS.has(g) || BOG_STAMP_GIDS.has(g) ||
                  WITHERED_STAMP_GIDS.has(g) || pgr._flatGids.has(g))) {
          gids.add(g)
        }
      }
    }

    if (gids.size === 0) return

    const samplePositions = [
      [3,3],[7,5],[11,9],[15,13],[19,7],[23,17],[27,11],[31,21]
    ]
    const gidArr = [...gids]
    let gi = 0

    const bakeNext = () => {
      if (gi >= gidArr.length) {
        console.log(`[PGR] billboard tint prewarm done — ${pgr._bakedTintCache.size} variants for ${gidArr.length} GIDs`)
        return
      }
      const gid = gidArr[gi++]
      const img = getTileCanvas(pgr, gid)
      if (img) {
        samplePositions.forEach(([tx, ty], vi) => {
          const tint = pgr.tintManager.getTint(gid, tx, ty)
          if (tint) getBakedTintCanvas(pgr, img, tint, tint.alpha, vi)
        })
      }
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(bakeNext, { timeout: 500 })
      } else {
        setTimeout(bakeNext, 0)
      }
    }

    if (pgr._ready) {
      bakeNext()
    } else {
      const orig = pgr._tilesetImg
      const check = setInterval(() => {
        if (pgr._ready) { clearInterval(check); bakeNext() }
      }, 50)
    }
  }

