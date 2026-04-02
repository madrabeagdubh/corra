// CreatureSheetHelper.js
// Slices tiles from oryx_16bit_fantasy_creatures_trans.png
//
// Sheet geometry: 480×648, TW=TH=24, MG=24, COLS=20
// GID_OFFSET=1966 (GID 1987 = first visible creature, row1 col1)
//
// Preload in scene:
//   this.load.image('oryxCreatures', '/assets/oryx/oryx_16bit_fantasy_creatures_trans.png')

export default class CreatureSheetHelper {

  static TW          = 24
  static TH          = 24
  static MG          = 24
  static COLS        = 20
  static GID_OFFSET  = 1765
  static TEXTURE_KEY = 'oryxCreatures'

  constructor(scene) {
    this._scene = scene
    this._cache = new Map()
    this._img   = null
    this._ready = false

    const tex = scene.textures.get(CreatureSheetHelper.TEXTURE_KEY)
    if (!tex || tex.key === '__MISSING') {
      console.warn('[CreatureSheetHelper] oryxCreatures not loaded')
      return
    }
    this._img   = tex.getSourceImage()
    this._ready = true
    console.log('[CreatureSheetHelper] ready —', this._img.width, 'x', this._img.height)
  }

  get isReady() { return this._ready }

  getCanvas(gid) {
    if (!this._ready || !gid) return null
    if (this._cache.has(gid)) return this._cache.get(gid)

    const { sx, sy } = this._srcRect(gid)
    const { TW, TH } = CreatureSheetHelper

    const tc  = document.createElement('canvas')
    tc.width  = TW
    tc.height = TH
    const ctx = tc.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this._img, sx, sy, TW, TH, 0, 0, TW, TH)

    this._cache.set(gid, tc)
    return tc
  }

  _srcRect(gid) {
    const { TW, TH, MG, COLS, GID_OFFSET } = CreatureSheetHelper
    const local = gid - GID_OFFSET - 1  // 0-indexed
    const col   = local % COLS
    const row   = Math.floor(local / COLS)
    return {
      sx: MG + col * TW,
      sy: MG + row * TH,
    }
  }

  clear() { this._cache.clear() }
}

