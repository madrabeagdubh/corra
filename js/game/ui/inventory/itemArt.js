// itemArt.js
// Location: js/game/ui/inventory/itemArt.js
//
// Small pictures for items that have none on the item sheet, drawn once on a 16 px canvas in the sheet's own manner
// (an item definition's `art`; inventoryView.js asks for it when there's no itemGid picture or texture).

const made = new Map()

const ART = {
  // a hazelnut: the brown shell, rounder at the bottom, its pale scar on top, a little light on one side
  hazelnut() {
    const c = document.createElement('canvas'); c.width = c.height = 16
    const g = c.getContext('2d')
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1) }
    const rows = [[6, 9], [5, 10], [4, 11], [4, 11], [3, 12], [3, 12], [3, 12], [3, 12], [4, 11], [4, 11], [5, 10], [6, 9]]
    rows.forEach(([a, b], i) => { for (let x = a; x <= b; x++) px(x, i + 3, '#8a5a2b') })
    rows.forEach(([a, b], i) => { px(a, i + 3, '#5e3a18'); px(b, i + 3, '#5e3a18') })
    for (let x = 6; x <= 9; x++) px(x, 14, '#5e3a18')
    for (let x = 5; x <= 10; x++) { px(x, 3, '#d8c49a'); px(x, 4, x > 5 && x < 10 ? '#c4ab7c' : '#8a5a2b') }      // the scar where it sat in its husk
    px(7, 2, '#5e3a18'); px(8, 2, '#5e3a18')                                                                    // the tip
    for (const [x, y] of [[5, 7], [5, 8], [6, 6], [5, 9]]) px(x, y, '#b07a3a')                                   // the light on it
    for (const [x, y] of [[10, 10], [9, 12], [10, 11]]) px(x, y, '#6e4420')
    return c
  },
}

export function itemArt(name) {
  if (!ART[name]) return null
  if (!made.has(name)) made.set(name, ART[name]())
  return made.get(name)
}
