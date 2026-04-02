// ItemSheetHelper.js
//
// Slices and caches tiles from oryx_16bit_fantasy_items_trans.png.
// Same geometry as the world sheet: 24×24 tiles, 24px margin, 54 columns.
//
// Usage:
//   const helper = new ItemSheetHelper(phaserScene)
//   const canvas = helper.getCanvas(2482)  // BOW
//   ctx.drawImage(canvas, x, y, w, h)
//
// Preload in scene:
//   this.load.image('oryxItems', '/assets/oryx/oryx_16bit_fantasy_items_trans.png')

import { TILES } from '../../../../data/oryx-tiles.js'

export { TILES }  // re-export for convenience

export default class ItemSheetHelper {

  static TEXTURE_KEY = 'oryxItems'
static TW        = 16
static TH        = 16
static MG        = 16
static COLS      = 24   // items sheet is 384px wide = 15 columns
static GID_OFFSET = 2275  // items sheet starts after world sheet
  constructor(scene) {
    this._scene  = scene
    this._cache  = new Map()
    this._img    = null
    this._ready  = false

    const tex = scene.textures.get(ItemSheetHelper.TEXTURE_KEY)
    if (!tex || tex.key === '__MISSING') {
      console.warn('[ItemSheetHelper] oryxItems texture not loaded — call preload first')
      return
    }
    this._img   = tex.getSourceImage()
    this._ready = true
    console.log('[ItemSheetHelper] ready —', this._img.width, 'x', this._img.height)
  }

  get isReady() { return this._ready }

  // ── Get a canvas slice for a GID ─────────────────────────────────────────

  getCanvas(gid) {
    if (!this._ready || !gid) return null
    if (this._cache.has(gid)) return this._cache.get(gid)

    const { sx, sy } = this._srcRect(gid)
    const { TW, TH } = ItemSheetHelper

    const tc   = document.createElement('canvas')
    tc.width   = TW
    tc.height  = TH
    const ctx  = tc.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this._img, sx, sy, TW, TH, 0, 0, TW, TH)

    this._cache.set(gid, tc)
    return tc
  }

  // Convenience: get canvas by TILES constant name
  getByName(name) {
    const gid = TILES[name]
    if (gid == null) {
      console.warn('[ItemSheetHelper] unknown tile name:', name)
      return null
    }
    return this.getCanvas(gid)
  }

  // ── Source rect ───────────────────────────────────────────────────────────
_srcRect(gid) {
  const { TW, TH, MG, COLS, GID_OFFSET } = ItemSheetHelper
  const localGid = gid - GID_OFFSET  // convert absolute to local
  const idx = localGid - 1
  const col = idx % COLS
  const row = Math.floor(idx / COLS)
  return {
    sx: MG + col * TW,
    sy: MG + row * TH,
  }
}  // ── Draw directly to a canvas context ────────────────────────────────────

  drawToCtx(ctx, gid, dx, dy, dw, dh) {
    const canvas = this.getCanvas(gid)
    if (!canvas) return
    ctx.drawImage(canvas, dx, dy, dw ?? ItemSheetHelper.TW, dh ?? ItemSheetHelper.TH)
  }

  clear() {
    this._cache.clear()
  }
}

