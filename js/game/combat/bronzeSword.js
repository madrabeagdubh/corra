// bronzeSword.js
// Location: js/game/combat/bronzeSword.js
//
// The bronze sword of the east crypts (scenes/locations/cave/otherside1.js): the first blade of yours that cuts.
//
//   BRONZE_ID, BRONZE_NOTE      the item, and the GameState note that it has been taken
//   prepareBronze(scene)        makes its art (once) and registers it, so the pack, the hand and the fight can draw it
//
// The art is a PLACEHOLDER: the Oryx short sword with its grey turned to bronze, kept in the item sheet's cache under
// BRONZE_GID, so everything that draws an item by its itemGid (the inventory, the weapon in hand, the sword in a fight)
// finds it without knowing it is not in the sheet. The item's definition is added to ITEM_DEFS here.

import { ITEM_DEFS } from '../ui/inventory/itemDefinitions.js'

export const BRONZE_ID = 'bronze_sword'
export const BRONZE_NOTE = 'got_bronze_sword'
export const BRONZE_GID = 9401
const BASE_GID = 2493                     // the sheet's second short sword: grey blade, brown hilt

ITEM_DEFS[BRONZE_ID] = {
  id: BRONZE_ID,
  spriteKey: 'item_' + BRONZE_ID,
  itemGid: BRONZE_GID,
  type: 'weapon',
  subtype: 'sword',
  nameEn: 'Bronze sword',
  nameGa: 'Claíomh cré-umha',
  descEn: 'A bronze blade, green with age. Unlike the practice sword, it will cut.',
  descGa: 'Lann chré-umha, glas le haois. Murab ionann agus an claíomh cleachtaidh, gearrfaidh sí.',
  stats: { attack: 3 },
  equipSlot: 'rightHand',
  allowedSlots: [0],
  actions: ['equip', 'drop'],
  color: 0xB87333,
}

export function prepareBronze(scene) {
  const sheet = scene.itemSheet
  if (!sheet?.isReady) return
  if (!sheet._cache.has(BRONZE_GID)) {
    const src = sheet.getCanvas(BASE_GID)
    if (!src) return
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0)
    const im = g.getImageData(0, 0, c.width, c.height), d = im.data
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue
      const r = d[i], gr = d[i + 1], b = d[i + 2]
      if (Math.max(r, gr, b) - Math.min(r, gr, b) > 40) continue          // the hilt keeps its brown
      const l = (r + gr + b) / 765                                        // the grey becomes bronze, light for light
      const k = 0.35 + 0.95 * l
      d[i] = Math.min(255, 205 * k); d[i + 1] = Math.min(255, 130 * k); d[i + 2] = Math.min(255, 55 * k)
    }
    g.putImageData(im, 0, 0)
    sheet._cache.set(BRONZE_GID, c)
  }
  const key = ITEM_DEFS[BRONZE_ID].spriteKey
  if (!scene.textures.exists(key)) {
    const c = document.createElement('canvas'); c.width = c.height = 32
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(sheet.getCanvas(BRONZE_GID), 0, 0, 32, 32)
    scene.textures.addCanvas(key, c)
  }
}
