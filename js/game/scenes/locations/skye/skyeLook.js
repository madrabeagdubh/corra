// skyeLook.js
// Location: js/game/scenes/locations/skye/skyeLook.js
//
// Looking at things, the island's way: stand by one and its glyph shows on the moonTile (an eye where it has none); tap it and the words
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
//       icon     (id) => a canvas for the moonTile (default: the glyph for the id in LOOK_KINDS, else an eye)
//       onLook   (id, zone) => true to say the scene handled it (no caption)

import Phaser from 'phaser'
import { GameState } from '../../../systems/gameState.js'

// What each thing looked at is shown as on the moonTile: a small glyph (cream, dark-edged), an eye only when
// there is none. Scenes need not name them: checkLook picks by the zone's id.
export const LOOK_KINDS = {
  clothes: 'clothes', fire: 'fire', wood: 'wood', window: 'window', bed: 'bed', table: 'table', chest: 'chest', door: 'door', ficheall: 'board',
  tigh: 'house', balla: 'wall', cnoic: 'hills', sceacha: 'bush', gairdin: 'flower', carbad: 'chariot', cosan: 'path',
}
// Each glyph is the game's own graphic for the thing (its painted texture, a box shown as top over front), cut out
// with a dark edge; the fire and the window are drawn (the room's own pictures are wide and flat and do not
// sit in the round tile); an eye where there is no picture of it.
const DIR = '/assets/tigh/'
const RECIPES = {
  table:   { box: ['tableFront', 'tableTop'] },
  bed:     { box: ['bedFront', 'bedTopEmpty'] },
  chest:   { box: ['seatFront', 'seatTopEmpty'] },
  wood:    { box: ['woodFront', 'woodTop'] },
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

// the glyphs are 64 x 64, dark-edged, in the moonTile's round: drawn with one outline helper
const INK_EDGE = '#1a1008'
function glyph(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round'
  draw(g); return c
}
const edge = (g, w = 5) => { g.lineWidth = w; g.strokeStyle = INK_EDGE; g.stroke() }

// an eye: for whatever has no picture of its own
function eye() {
  return glyph(g => {
    g.beginPath(); g.moveTo(6, 32); g.quadraticCurveTo(32, 6, 58, 32); g.quadraticCurveTo(32, 58, 6, 32); g.closePath()
    edge(g, 6); g.fillStyle = '#f6efd6'; g.fill()
    g.beginPath(); g.arc(32, 32, 12, 0, Math.PI * 2); g.fillStyle = '#c8923a'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK_EDGE; g.stroke()
    g.beginPath(); g.arc(32, 32, 5.5, 0, Math.PI * 2); g.fillStyle = INK_EDGE; g.fill()
    g.beginPath(); g.arc(28.5, 28.5, 2.4, 0, Math.PI * 2); g.fillStyle = '#fff8e0'; g.fill()
  })
}
// a fire: a flame with a lick of inner flame, over two crossed logs
function fire() {
  return glyph(g => {
    g.beginPath(); g.moveTo(10, 50); g.lineTo(54, 58); g.moveTo(54, 50); g.lineTo(10, 58)       // the logs
    g.lineWidth = 11; g.strokeStyle = INK_EDGE; g.stroke(); g.lineWidth = 6; g.strokeStyle = '#8a5a30'; g.stroke()
    g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(40, 16, 54, 26, 50, 42); g.bezierCurveTo(48, 52, 40, 54, 32, 54)
    g.bezierCurveTo(24, 54, 16, 52, 14, 42); g.bezierCurveTo(12, 32, 22, 28, 24, 16); g.bezierCurveTo(28, 20, 30, 14, 32, 4); g.closePath()
    edge(g, 5); g.fillStyle = '#f2a640'; g.fill()
    g.beginPath(); g.moveTo(32, 24); g.bezierCurveTo(37, 31, 43, 36, 41, 44); g.bezierCurveTo(40, 50, 36, 51, 32, 51)
    g.bezierCurveTo(28, 51, 24, 50, 23, 44); g.bezierCurveTo(22, 38, 29, 34, 32, 24); g.closePath(); g.fillStyle = '#fff0b8'; g.fill()
  })
}
// a window: a small arched casement, four panes, the night in it
function window_() {
  return glyph(g => {
    g.beginPath(); g.moveTo(14, 58); g.lineTo(14, 26); g.arc(32, 26, 18, Math.PI, 0); g.lineTo(50, 58); g.closePath()
    edge(g, 6); g.fillStyle = '#8a5a30'; g.fill()
    g.beginPath(); g.moveTo(19, 54); g.lineTo(19, 26); g.arc(32, 26, 13, Math.PI, 0); g.lineTo(45, 54); g.closePath()
    g.fillStyle = '#d8e6ea'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = INK_EDGE; g.stroke()
    g.beginPath(); g.moveTo(32, 13); g.lineTo(32, 54); g.moveTo(19, 36); g.lineTo(45, 36)
    g.lineWidth = 4; g.strokeStyle = INK_EDGE; g.stroke(); g.lineWidth = 2; g.strokeStyle = '#8a5a30'; g.stroke()
    g.beginPath(); g.moveTo(22, 22); g.lineTo(27, 17); g.lineWidth = 2.5; g.strokeStyle = '#ffffff'; g.stroke()            // a glint on the glass
  })
}
// a board: nine by nine, the king gold in the middle, a dark piece at each side
function board() {
  return glyph(g => {
    g.beginPath(); g.rect(7, 7, 50, 50); edge(g, 6); g.fillStyle = '#5a3c20'; g.fill()
    for (let r = 0; r < 9; r++) for (let f = 0; f < 9; f++) { g.fillStyle = (f + r) % 2 ? '#e2d8bc' : '#a8966e'; g.fillRect(9.5 + f * 5, 9.5 + r * 5, 5, 5) }
    const man = (x, y, fill, rad) => { g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = INK_EDGE; g.stroke() }
    for (const [x, y] of [[32, 14.5], [14.5, 32], [49.5, 32], [32, 49.5]]) man(x, y, '#2e3135', 3.6)
    man(32, 32, '#e2bb4d', 5)
  })
}
const DRAWN = { fire, window: window_, board }

export function lookIcon(kind) {
  if (DRAWN[kind]) return CACHE[kind] || (CACHE[kind] = DRAWN[kind]())
  const r = RECIPES[kind]
  if (!r) return CACHE.eye || (CACHE.eye = eye())
  if (CACHE[kind]) return CACHE[kind]
  // the picture in its own pixels
  const nat = document.createElement('canvas'), n = nat.getContext('2d')
  if (r.box) {
    const [fr, tp] = [picture(r.box[0]), picture(r.box[1])]
    if (!READY(fr) || !READY(tp)) return eye()
    const th = Math.max(4, Math.round(tp.naturalHeight * 0.45))
    nat.width = fr.naturalWidth; nat.height = th + fr.naturalHeight
    n.imageSmoothingEnabled = false
    n.drawImage(tp, 0, 0, nat.width, th); n.drawImage(fr, 0, th)
  } else {
    const o = r.parts[0], im = picture(o.n)
    if (!READY(im)) return eye()
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
  let near = null, best = Infinity
  for (const z of scene.interactables || []) {
    const t = z.getData?.('type'), id = z.getData?.('id')
    if (!types.includes(t)) continue
    const d = Phaser.Math.Distance.Between(px, py, z.getData('logicalX') ?? z.x, z.getData('logicalY') ?? z.y)
    if (d > again) scene._spent[id] = false                // stepped away: it can be looked at again
    if (scene._spent[id]) continue
    const zr = z.getData?.('range') ?? range                 // a zone may ask to be looked at from nearer
    if (d < best && d <= zr) { best = d; near = z }
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
