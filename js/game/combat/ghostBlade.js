// ghostBlade.js
// Location: js/game/combat/ghostBlade.js
//
// The ghost's sword, in the escape from the underworld (scenes/locations/cave/escape.js): a long steel blade, the
// one Uathach draws at the end of the tournament (the item sheet's 2496), cold light coming off it. It is the dead
// champion's own, not the descendant's: `transient`, so it is never kept in the pack (ui/inventory/inventoryStore.js)
// and nothing of it follows into the living game.
//
//   GHOST_BLADE_ID                 the item's id ('ghost_blade')
//   prepareGhostBlade(scene)       its pack picture, once the item sheet is ready (true when done)
//   drawGhostBladeLight(ctx, r, w, t)   the light off it: a haze down the blade, motes, and now and then a sheen
//                                  up the steel to a star at the tip. r: { grip, tip } as swordRig's drawHeldSword
//                                  gives it; w: the figure's width in pixels; t: seconds
//
// PGR calls scene.onHeldSword(ctx, r, w, item) after it draws the sword in your hand (effects/pgr/pgrPlayerBoat.js).

import { ITEM_DEFS } from '../ui/inventory/itemDefinitions.js'

export const GHOST_BLADE_ID = 'ghost_blade'
const GID = 2496                                  // the long steel sword (Uathach's live blade)

ITEM_DEFS[GHOST_BLADE_ID] = {
  id: GHOST_BLADE_ID,
  spriteKey: 'item_' + GHOST_BLADE_ID,
  itemGid: GID,
  type: 'weapon',
  subtype: 'sword',
  nameEn: 'The ghost’s blade',
  nameGa: '[Gaeilge le teacht]',
  h: 2,
  defGa: '[Gaeilge le teacht]',
  defEn: 'the ghost’s blade',
  descEn: '[PLACEHOLDER] The sword you carried in life. It came with you.',
  descGa: '[Gaeilge le teacht]',
  stats: { attack: 6 },
  edged: true,
  transient: true,                                // never kept: it is the dead champion's, not yours
  equipSlot: 'rightHand',
  allowedSlots: [0],
  actions: ['equip'],
  color: 0xBFD8FF,
}

export function prepareGhostBlade(scene) {
  const key = 'item_' + GHOST_BLADE_ID
  if (scene.textures.exists(key)) return true
  const sheet = scene.itemSheet
  const src = sheet?.isReady ? sheet.getCanvas?.(GID) : null
  if (!src) return false
  const c = document.createElement('canvas'); c.width = c.height = 32
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, 32, 32)
  scene.textures.addCanvas(key, c)
  return true
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const hash = (n) => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0 }

export function drawGhostBladeLight(ctx, r, w, t) {
  if (!r?.grip || !r?.tip) return
  const [gx, gy] = r.grip, [tx, ty] = r.tip
  const L = Math.hypot(tx - gx, ty - gy)
  if (L < 2) return
  const ux = (tx - gx) / L, uy = (ty - gy) / L
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  // a cold haze along the steel, breathing
  const br = 0.75 + 0.25 * Math.sin(t * 2.1)
  ctx.strokeStyle = `rgba(140,190,255,${(0.16 * br).toFixed(3)})`; ctx.lineWidth = Math.max(3, w * 0.16)
  ctx.beginPath(); ctx.moveTo(gx + ux * L * 0.18, gy + uy * L * 0.18); ctx.lineTo(tx, ty); ctx.stroke()
  ctx.strokeStyle = `rgba(200,230,255,${(0.22 * br).toFixed(3)})`; ctx.lineWidth = Math.max(1.5, w * 0.05)
  ctx.beginPath(); ctx.moveTo(gx + ux * L * 0.22, gy + uy * L * 0.22); ctx.lineTo(tx, ty); ctx.stroke()
  // motes coming off the blade and drifting up, each from its own place on the steel
  for (let q = 0; q < 9; q++) {
    const h = hash(q * 7919 + 13), sp = 0.45 + (h & 255) / 255 * 0.5
    const ph = (t * sp + (h >>> 8 & 1023) / 1023) % 1
    const along = 0.25 + ((h >>> 18) & 255) / 255 * 0.75
    const x = gx + (tx - gx) * along + Math.sin(t * 2 + q) * w * 0.04
    const y = gy + (ty - gy) * along - ph * w * 0.55
    const a = Math.sin(Math.PI * ph) * 0.85, s = Math.max(1, w * 0.028)
    ctx.fillStyle = `rgba(215,238,255,${a.toFixed(3)})`
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s)
  }
  // now and then a sheen runs up the steel and the tip flares (as a live blade's does when it is drawn)
  const k = (t % 2.8) / 0.7
  if (k < 1) {
    const sw = clamp01(k / 0.45), a = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55
    const hx = gx + (tx - gx) * sw, hy = gy + (ty - gy) * sw, s0 = Math.max(0, sw - 0.3)
    ctx.strokeStyle = `rgba(235,246,255,${(0.8 * a).toFixed(3)})`; ctx.lineWidth = Math.max(2, w * 0.045)
    ctx.beginPath(); ctx.moveTo(gx + (tx - gx) * s0, gy + (ty - gy) * s0); ctx.lineTo(hx, hy); ctx.stroke()
    const f = clamp01((k - 0.35) / 0.65), fa = Math.sin(Math.PI * f), R = w * (0.22 + 0.4 * fa)
    if (fa > 0.01) {
      const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, R)
      g.addColorStop(0, `rgba(255,255,255,${(0.9 * fa).toFixed(3)})`); g.addColorStop(0.35, `rgba(190,225,255,${(0.45 * fa).toFixed(3)})`); g.addColorStop(1, 'rgba(150,200,255,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty, R, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = `rgba(255,255,255,${fa.toFixed(3)})`
      for (const [ang, len] of [[0, 1.4], [Math.PI / 2, 1.0], [Math.PI / 4, 0.5], [-Math.PI / 4, 0.5]]) {
        const l = R * len, th = Math.max(1.1, w * 0.016)
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(-l, 0); ctx.lineTo(0, th); ctx.lineTo(l, 0); ctx.lineTo(0, -th); ctx.closePath(); ctx.fill(); ctx.restore()
      }
    }
  }
  ctx.restore()
}
