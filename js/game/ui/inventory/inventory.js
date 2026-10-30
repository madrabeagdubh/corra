// inventory/inventory.js
//
// Slot layout. The first five indices keep the meanings older code relies on
// (getItem(0) is the weapon hand, getItem(2) the armour):
//
//   0  rightHand  deasóg      1  leftHand  ciotóg      2  armor  corp
//   3  head       ceann       4  neck      muineál
//   5-24          the pack (the brat): 5 wide, 4 deep, index = 5 + row*5 + col
//   25 finger     méar
//
// Most things take one cell of the pack. Long things (h: 2 -- bows, swords)
// stand two cells tall: the item is kept at its top cell and the cell below is
// left null but covered (anchorAt() tells which item covers a cell).
// Nothing rotates. That is the whole puzzle: short and tall, packed by hand.

export const PACK_START = 5
export const PACK_COLS  = 5
export const PACK_ROWS  = 4
export const PACK_END   = PACK_START + PACK_COLS * PACK_ROWS     // 25, exclusive
export const EQUIP_SLOTS = { rightHand: 0, leftHand: 1, armor: 2, head: 3, neck: 4, finger: 25 }

const heightOf = (item) => (item?.h === 2 ? 2 : 1)

export default class Inventory {
  constructor() {
    this.cols = PACK_COLS
    this.rows = PACK_ROWS
    // accessory1/2 are the old names of the head and neck slots
    this.equipSlots = { ...EQUIP_SLOTS, accessory1: 3, accessory2: 4 }
    this.totalSlots = 26
    this.inventoryStartIndex = PACK_START
    this.slots = new Array(this.totalSlots).fill(null)
  }

  // ── Geometry ────────────────────────────────────────────────────────────────

  static heightOf(item) { return heightOf(item) }
  isPackIndex(i)  { return i >= PACK_START && i < PACK_END }
  isEquipIndex(i) { return Object.values(EQUIP_SLOTS).includes(i) }
  equipNameOf(i)  { return Object.keys(EQUIP_SLOTS).find(k => EQUIP_SLOTS[k] === i) || null }
  packIndex(row, col) { return PACK_START + row * PACK_COLS + col }
  packCell(i) { const k = i - PACK_START; return { row: Math.floor(k / PACK_COLS), col: k % PACK_COLS } }

  // The index holding the item that covers cell i (itself, or a tall item above), or -1.
  anchorAt(i) {
    if (!this.isPackIndex(i)) return this.slots[i] ? i : -1
    if (this.slots[i]) return i
    const up = i - PACK_COLS
    if (up >= PACK_START && heightOf(this.slots[up]) === 2) return up
    return -1
  }

  cellsFor(item, i) { return heightOf(item) === 2 ? [i, i + PACK_COLS] : [i] }

  // Could item sit with its top at pack cell i? Items whose anchors are in
  // `ignore` count as already lifted out.
  canPlace(item, i, ignore = []) {
    if (!this.isPackIndex(i)) return false
    for (const c of this.cellsFor(item, i)) {
      if (!this.isPackIndex(c)) return false
      const a = this.anchorAt(c)
      if (a !== -1 && !ignore.includes(a)) return false
    }
    return true
  }

  findSpotFor(item, ignore = []) {
    for (let i = PACK_START; i < PACK_END; i++) if (this.canPlace(item, i, ignore)) return i
    return -1
  }

  // ── Basic access (older code uses these directly) ───────────────────────────

  getItem(index) {
    if (index < 0 || index >= this.totalSlots) return null
    return this.slots[index]
  }

  // A tall item set where it won't fit goes to the first place it does.
  setItem(index, item) {
    if (index < 0 || index >= this.totalSlots) return false
    if (item && this.isPackIndex(index) && !this.canPlace(item, index, [index])) {
      const spot = this.findSpotFor(item)
      if (spot !== -1) index = spot
    }
    this.slots[index] = item
    return true
  }

  // First pack cell free for a one-cell item.
  findEmptyInventorySlot() {
    return this.findSpotFor({ h: 1 })
  }

  // Into the pack: a stackable item tops up stacks already there first.
  // Returns the index it went to, or false when there is no room.
  addItem(item, preferIndex = -1) {
    if (!item) return false
    if (item.stackable) {
      for (let i = PACK_START; i < PACK_END; i++) {
        const s = this.slots[i]
        if (!s || s === item || s.id !== item.id || !s.stackable) continue
        const room = (s.maxStack || 1) - (s.quantity || 1)
        if (room <= 0) continue
        const moved = Math.min(room, item.quantity || 1)
        s.quantity = (s.quantity || 1) + moved
        item.quantity = (item.quantity || 1) - moved
        if (item.quantity <= 0) return i
      }
    }
    const spot = (preferIndex !== -1 && this.canPlace(item, preferIndex)) ? preferIndex : this.findSpotFor(item)
    if (spot === -1) {
      console.warn('Inventory full!')
      return false
    }
    this.slots[spot] = item
    return spot
  }

  removeItem(index) {
    const at = this.isPackIndex(index) ? this.anchorAt(index) : index
    if (at < 0) return null
    const item = this.slots[at]
    this.slots[at] = null
    return item
  }

  // One from a stack (a drink, an arrow); the slot empties with the last.
  removeOne(index) {
    const at = this.isPackIndex(index) ? this.anchorAt(index) : index
    const item = this.slots[at]
    if (!item) return null
    if (item.stackable && (item.quantity || 1) > 1) item.quantity -= 1
    else this.slots[at] = null
    return item
  }

  // ── Moving things about ─────────────────────────────────────────────────────

  // Try a set of placements all at once; nothing changes unless all fit.
  _transact(removals, placements) {
    const saved = this.slots.slice()
    for (const r of removals) if (r >= 0) this.slots[r] = null
    for (const [item, where] of placements) {
      let at = where
      if (typeof where === 'function') at = where(item)
      if (at === -1 || at == null) { this.slots = saved; return false }
      if (this.isPackIndex(at) && !this.canPlace(item, at)) { this.slots = saved; return false }
      if (!this.isPackIndex(at) && this.slots[at]) { this.slots = saved; return false }
      this.slots[at] = item
    }
    return true
  }

  // A tall item dropped with the finger on its lower half lands one row up.
  _landingFor(item, cell, ignore) {
    if (this.canPlace(item, cell, ignore)) return cell
    if (heightOf(item) === 2 && this.canPlace(item, cell - PACK_COLS, ignore)) return cell - PACK_COLS
    return -1
  }

  // Pack to pack. `cell` is the cell under the finger. Same stackables merge;
  // otherwise the item lands there, or swaps with what is there.
  moveItem(from, cell) {
    from = this.anchorAt(from)
    const item = this.slots[from]
    if (!item || !this.isPackIndex(cell)) return false
    const there = this.anchorAt(cell)
    if (there === from) return true

    if (there !== -1) {
      const other = this.slots[there]
      if (other.stackable && other.id === item.id) {
        const room = (other.maxStack || 1) - (other.quantity || 1)
        if (room <= 0) return false
        const moved = Math.min(room, item.quantity || 1)
        other.quantity += moved
        item.quantity -= moved
        if (item.quantity <= 0) this.slots[from] = null
        return true
      }
      // swap: the moved item takes the other's place, the other takes the vacated one
      return this._transact([from, there], [[item, there], [other, (o) => this.canPlace(o, from) ? from : this.findSpotFor(o)]])
        || this._transact([from, there], [[item, this._landingFor(item, cell, [from, there])], [other, (o) => this.findSpotFor(o)]])
    }
    const land = this._landingFor(item, cell, [from])
    if (land === -1) return false
    return this._transact([from], [[item, land]])
  }

  // Put `item` on in `slotName`. It comes from pack index `fromIndex`, or from
  // outside the pack (the ground) when fromIndex is -1. Whatever it displaces
  // goes into the pack: where it came from if it fits, else anywhere.
  equipFrom(item, slotName, fromIndex = -1) {
    const e = EQUIP_SLOTS[slotName]
    if (e === undefined || !item || item.equipSlot !== slotName) return false
    const displaced = []
    const removals = [fromIndex, e]
    if (this.slots[e] && this.slots[e] !== item) displaced.push(this.slots[e])
    // a two-handed thing fills both hands
    if (item.twoHanded && this.slots[EQUIP_SLOTS.leftHand]) {
      displaced.push(this.slots[EQUIP_SLOTS.leftHand]); removals.push(EQUIP_SLOTS.leftHand)
    }
    if (slotName === 'leftHand' && this.slots[EQUIP_SLOTS.rightHand]?.twoHanded) {
      displaced.push(this.slots[EQUIP_SLOTS.rightHand]); removals.push(EQUIP_SLOTS.rightHand)
    }
    const placements = [[item, e]]
    displaced.forEach((d, n) => {
      placements.push([d, (o) => (n === 0 && fromIndex !== -1 && this.isPackIndex(fromIndex) && this.canPlace(o, fromIndex)) ? fromIndex : this.findSpotFor(o)])
    })
    return this._transact(removals, placements)
  }

  equipItem(inventorySlotIndex, equipSlotName) {
    const from = this.isPackIndex(inventorySlotIndex) ? this.anchorAt(inventorySlotIndex) : inventorySlotIndex
    const item = this.slots[from]
    if (!item) {
      console.warn('No item in slot', inventorySlotIndex)
      return false
    }
    return this.equipFrom(item, equipSlotName, from)
  }

  // Take off what is in slotName, into pack cell toCell if given and it fits.
  unequipItem(equipSlotName, toCell = -1) {
    const e = EQUIP_SLOTS[equipSlotName] ?? this.equipSlots[equipSlotName]
    if (e === undefined) {
      console.warn('Invalid equipment slot:', equipSlotName)
      return false
    }
    const item = this.slots[e]
    if (!item) return false
    const land = toCell !== -1 ? this._landingFor(item, toCell, [e]) : -1
    return this._transact([e], [[item, land !== -1 ? land : (o) => this.findSpotFor(o)]])
  }

  isEquipped(equipSlotName) {
    const i = this.equipSlots[equipSlotName]
    return this.slots[i] !== null && this.slots[i] !== undefined
  }

  getEquippedItem(equipSlotName) {
    const i = this.equipSlots[equipSlotName]
    return this.slots[i] || null
  }

  getEquippedItems() {
    const equipped = {}
    for (const [slotName, index] of Object.entries(EQUIP_SLOTS)) equipped[slotName] = this.slots[index]
    return equipped
  }

  // Calculate total stats from equipped items
  calculateEquippedStats(slotsOverride = null) {
    const stats = { defense: 0, attack: 0, health: 0, speed: 0 }
    const equipped = slotsOverride || this.getEquippedItems()
    for (const item of Object.values(equipped)) {
      if (item && item.stats) {
        for (const [stat, value] of Object.entries(item.stats)) {
          if (stat === 'healAmount' || stat === 'range') continue
          stats[stat] = (stats[stat] || 0) + value
        }
      }
    }
    return stats
  }
}
