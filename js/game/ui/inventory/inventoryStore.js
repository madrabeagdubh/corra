// js/game/ui/inventory/inventoryStore.js
//
// The pack follows the hero from map to map, and across sessions: what is in
// each slot is kept in GameState (per hero) and put back when a scene begins.
//
//   saveInventory(inv)        on closing the pack, after any change in it, on
//                             leaving a scene, and when the page is hidden
//   restoreInventory(player)  as a scene begins, once GameState is loaded
//
// Kept: [slot index, item id, quantity] per item. An item's definition supplies
// the rest, so a changed definition (a new description, a stat) takes effect on
// load. A `transient` item (the currach) is never kept: it belongs to the moment.
// A hero with nothing saved yet keeps the pack the scene gave them.

import { ITEM_DEFS, createItem } from './itemDefinitions.js'
import '../../combat/bronzeSword.js'          // registers the bronze sword's definition before a saved one is made
import { GameState } from '../../systems/gameState.js'
import { PACK_START, PACK_END } from './inventory.js'

const isKept = (it) => it && it.id && ITEM_DEFS[it.id] && !it.transient && !ITEM_DEFS[it.id].transient

export function saveInventory(inv) {
  if (!inv?.slots) return
  const slots = []
  inv.slots.forEach((it, i) => { if (isKept(it)) slots.push([i, it.id, it.quantity || 1]) })
  GameState.setInventory({ v: 1, slots })
}

export function restoreInventory(player) {
  const inv = player?.inventory
  const saved = GameState.getInventory()
  if (!inv || !saved?.slots) return false
  // anything of the moment already in the pack (the currach while afloat) stays
  const keep = inv.slots.filter(it => it && !isKept(it))
  inv.slots.fill(null)
  for (const [i, id, q] of saved.slots) {
    if (!ITEM_DEFS[id]) { console.warn('[inventory] saved item no longer defined:', id); continue }
    const item = createItem(id, q)
    const inPack = i >= PACK_START && i < PACK_END
    if (inPack ? inv.canPlace(item, i) : (i >= 0 && i < inv.totalSlots && !inv.slots[i])) inv.slots[i] = item
    else inv.addItem(item)
  }
  for (const it of keep) inv.addItem(it)
  player.updateStatsFromEquipment?.()
  return true
}
