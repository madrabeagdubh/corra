// skyeLook.js
// Location: js/game/scenes/locations/skye/skyeLook.js
//
// Looking at things, the island's way: stand by one and a ? shows on the moonTile; tap it and the words
// come up as a caption (no dialogue, no blur, nothing locked, no hiding of the hoop). Step away and come
// back, or wait for the caption to go, and it can be looked at again.
//
// A scene calls checkLook(this, opts) from checkProximityInteractions, with this._spent = {} and
// this._caption (a SkyeCaption) made in create. Zones are the map's 'examine' objects (and any a scene
// adds to this.interactables with a 'type' of its own, named in opts.types).
//
// opts: types    zone types that can be looked at (default ['examine'])
//       range    how near, in px (64)       again   how far away it must go to be looked at anew (110)
//       hold     ms the caption stays, and so how long before the same thing can be looked at again (4400)
//       icon     (id) => a canvas for the moonTile (default: the glyph for the id in LOOK_KINDS, else a ?)
//       onLook   (id, zone) => true to say the scene handled it (no caption)

import Phaser from 'phaser'
import { GameState } from '../../../systems/gameState.js'

// What each thing looked at is shown as on the moonTile: a small glyph (cream, dark-edged), a ? only when
// there is none. Scenes need not name them: checkLook picks by the zone's id.
export const LOOK_KINDS = {
  clothes: 'clothes', fire: 'fire', wood: 'wood', window: 'window', bed: 'bed', table: 'table', chest: 'chest', door: 'door',
  tigh: 'house', balla: 'wall', cnoic: 'hills', sceacha: 'bush', gairdin: 'flower', carbad: 'chariot', cosan: 'path',
}
// Each glyph is the game's own graphic for the thing (its painted texture, a box shown as top over front), cut out
// with a dark edge; a ? where the game has no picture of it.
const DIR = '/assets/tigh/'
const RECIPES = {
  fire:    { parts: [{ n: 'hearthFront' }] },
  table:   { box: ['tableFront', 'tableTop'] },
  bed:     { box: ['bedFront', 'bedTopEmpty'] },
  chest:   { box: ['seatFront', 'seatTopEmpty'] },
  wood:    { box: ['woodFront', 'woodTop'] },
  window:  { parts: [{ n: 'back8', sx: 100, sy: 15, sw: 24, sh: 26 }] },
  clothes: { parts: [{ n: 'prop_clothes' }] },
  door:    { parts: [{ n: 'outDoor' }] },
  house:   { parts: [{ n: 'outHouse' }] },
  wall:    { parts: [{ n: 'outWallFront0' }] },
  bush:    { parts: [{ n: 'outBush0' }] },
  chariot: { parts: [{ n: 'outChariot' }] },
}
const IMGS = {}
const picture = (n) => {
  if (!IMGS[n]) { const im = new Image(); im.src = DIR + n + '.png'; IMGS[n] = im }
  return IMGS[n]
}
for (const r of Object.values(RECIPES)) for (const n of (r.box || r.parts.map(o => o.n))) picture(n)         // loaded long before anyone stands near
const READY = (im) => im.complete && im.naturalWidth > 0
const CACHE = {}

function questionMark() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = 'bold 52px Georgia, serif'; g.lineWidth = 5; g.strokeStyle = '#1a1008'; g.strokeText('?', 32, 34)
  g.fillStyle = '#f0d98a'; g.fillText('?', 32, 34)
  return c
}

export function lookIcon(kind) {
  const r = RECIPES[kind]
  if (!r) return questionMark()
  if (CACHE[kind]) return CACHE[kind]
  // the picture in its own pixels
  const nat = document.createElement('canvas'), n = nat.getContext('2d')
  if (r.box) {
    const [fr, tp] = [picture(r.box[0]), picture(r.box[1])]
    if (!READY(fr) || !READY(tp)) return questionMark()
    const th = Math.max(4, Math.round(tp.naturalHeight * 0.45))
    nat.width = fr.naturalWidth; nat.height = th + fr.naturalHeight
    n.imageSmoothingEnabled = false
    n.drawImage(tp, 0, 0, nat.width, th); n.drawImage(fr, 0, th)
  } else {
    const o = r.parts[0], im = picture(o.n)
    if (!READY(im)) return questionMark()
    const sx = o.sx ?? 0, sy = o.sy ?? 0, sw = o.sw ?? im.naturalWidth, sh = o.sh ?? im.naturalHeight
    nat.width = sw; nat.height = sh
    n.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh)
  }
  // fitted to the badge, with a dark edge all round
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false
  const k = Math.min(54 / nat.width, 54 / nat.height), w = Math.round(nat.width * k), h = Math.round(nat.height * k)
  const dx = Math.round((64 - w) / 2), dy = Math.round((64 - h) / 2)
  const sil = document.createElement('canvas'); sil.width = w; sil.height = h
  const sg = sil.getContext('2d'); sg.imageSmoothingEnabled = false
  sg.drawImage(nat, 0, 0, w, h); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#1a1008'; sg.fillRect(0, 0, w, h)
  for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]]) g.drawImage(sil, dx + ox, dy + oy)
  g.drawImage(nat, dx, dy, w, h)
  CACHE[kind] = c
  return c
}

export function checkLook(scene, opts = {}) {
  const { types = ['examine'], range = 64, again = 110, hold = 4400, icon = (id) => lookIcon(LOOK_KINDS[id] || 'look'), onLook } = opts
  const panel = scene._encounterPanel
  if (!panel || !scene.player || !scene._spent) return
  const px = scene.player.logicalX, py = scene.player.logicalY
  let near = null, best = range
  for (const z of scene.interactables || []) {
    const t = z.getData?.('type'), id = z.getData?.('id')
    if (!types.includes(t)) continue
    const d = Phaser.Math.Distance.Between(px, py, z.getData('logicalX') ?? z.x, z.getData('logicalY') ?? z.y)
    if (d > again) scene._spent[id] = false                // stepped away: it can be looked at again
    if (scene._spent[id]) continue
    if (d < best) { best = d; near = z }
  }
  const mine = panel._card?.id?.startsWith('look:')
  if (!near) { if (mine) panel.clearNotify(); return }
  if (panel._card && !mine) return
  const id = near.getData('id'), text = near.getData('text') || {}
  scene._flagInRange = true
  if (panel._card?.id === 'look:' + id && panel._badgeVisible) return
  delete panel._openPanel                                   // whatever a door once hung on the badge is not for a look
  panel.notify({
    id: 'look:' + id,
    visual: { glyph: icon(id) },
    onActivate: () => {
      scene._spent[id] = true
      scene.time.delayedCall(hold + 300, () => { if (scene._spent) scene._spent[id] = false })     // and again, once the words have gone
      if (onLook?.(id, near)) return
      scene._caption?.show(text.ga || text.irish || '', text.en || text.english || '', hold)
      const note = near.getData('note'); if (note) { try { GameState.addNote(note) } catch (_) {} }
    },
  }, null)
}
