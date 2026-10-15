// ghoul.js
// Location: js/game/combat/ghoul.js
//
// The ghouls of the otherside: damned troglodytes, alive or dead, nobody can say. No discipline, no guard: they
// run at you with whatever they hold (stones, sticks, bare hands, teeth) and tire themselves out doing it.
//
//   GHOUL           the fight's numbers, a preset for MeleeBout ({ F: GHOUL }), the same kind as Garbhán's
//   GHOUL_GID       the PGR figure id the bout draws
//   registerGhoul(pgr)   makes the placeholder sprite and registers it under GHOUL_GID
//
// A ghoul's fight is not lethal: beaten, you wake where you started (otherside1.js). The weapon drawn is the
// Oryx knife (swordGid) until there is a ghoul's own stick or stone.
// The sprite is a PLACEHOLDER, drawn here in canvas: a slender black figure, green eyes, white teeth.

import { BASE } from './melee.js'
import { stats } from './enemies.js'

export const GHOUL_GID = 9301

export const GHOUL = {
  ...BASE, ...stats({ health: 3, attack: 6, defense: 2, speed: 4, stamina: 4 }),
  stepMs: 380,                        // they lurch: one tile in 380 ms (speed 4 gave 190, nearly as fast as you)
  edged: true, dice: [1, 6, 0],        // live blades (melee.js): a cut is 1d6 hearts owed, and a deep one opens a wound
  style: 'rusher', aggressor: true, salutes: false, noShove: true, swordGid: 2495,
  windMs: 360, strikeMs: 100, recoverMs: 560, followWind: 260, combo: 2,
  parryBase: 0, parryReel0: 0, parryReelStep: 0, parryMax: 0, restMin: 80, restMax: 300,
  stamCut: 1, stamStep: 0.25, stamRegen: 0.9, blownMs: 2200, staggerMs: 300,
  flow: true, drainMs: 6000,          // bullet time plays out down here, and costs a quarter of the breath it does on Skye (meleeBout.js FOCUS)
}

// 40 x 48: the figure's box is 1 wide to 1.2 tall. A slender, gaunt black figure (the "Brainsss..." dead of 1985): all
// black but for its eyes and teeth, a hunch to its shoulders, arms that hang to the knee and long fingers. The eyes stay
// where otherside1.js draws their glow: (16.5, 12.5) and (23.5, 12.5). Its blade is the foe's sword the bout draws.
function draw() {
  const c = document.createElement('canvas'); c.width = 40; c.height = 48
  const g = c.getContext('2d')
  const blob = (x, y, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill() }
  const limb = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke() }
  const BLACK = '#0a0a0c', DARK = '#17171c', RIM = '#2a2a32'
  // legs: thin, knees bent
  limb([[18, 34], [16.5, 41], [17, 46.5]], 2.6, BLACK); limb([[22, 34], [23.5, 41], [23, 46.5]], 2.6, BLACK)
  limb([[17, 46.5], [14.5, 47]], 1.6, BLACK); limb([[23, 46.5], [25.5, 47]], 1.6, BLACK)
  // arms, hanging long, a little forward; the fingers are long
  limb([[16, 22], [12, 30], [13, 38]], 2.2, BLACK); limb([[24, 22], [28, 30], [27, 38]], 2.2, BLACK)
  g.strokeStyle = '#3b3b42'; g.lineWidth = 0.9; g.lineCap = 'round'
  for (const [x, y, d] of [[13, 38, -1], [27, 38, 1]]) for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + d * 0.8 + i * 1.8, y + 5.5); g.stroke() }
  // the trunk: narrow, hunched, ribs just showing
  g.fillStyle = BLACK; g.beginPath(); g.moveTo(15, 21); g.lineTo(25, 21); g.lineTo(23.5, 35); g.lineTo(16.5, 35); g.closePath(); g.fill()
  blob(20, 21.5, 6, 3, BLACK)                                      // the shoulders
  g.strokeStyle = DARK; g.lineWidth = 0.8
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(17, 24.5 + i * 2.4); g.lineTo(23, 24.5 + i * 2.4); g.stroke() }
  g.strokeStyle = RIM; g.lineWidth = 0.7; g.beginPath(); g.moveTo(20, 22); g.lineTo(20, 34); g.stroke()
  // the head: small, a skull with a rim of light along the brow
  blob(20, 13, 6.2, 7.2, BLACK)
  g.strokeStyle = RIM; g.lineWidth = 0.8; g.beginPath(); g.ellipse(20, 13, 6.2, 7.2, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke()
  blob(16.5, 12.5, 2.6, 2.4, '#000'); blob(23.5, 12.5, 2.6, 2.4, '#000')          // the sockets
  // the mouth, open, and the teeth
  g.fillStyle = '#000'; g.beginPath(); g.ellipse(20, 18.2, 3.8, 2.4, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#e8e6d4'
  for (let i = 0; i < 5; i++) { const x = 16.6 + i * 1.7; g.beginPath(); g.moveTo(x - 0.8, 16.4); g.lineTo(x + 0.8, 16.4); g.lineTo(x, 19); g.fill() }
  for (let i = 0; i < 4; i++) { const x = 17.4 + i * 1.7; g.beginPath(); g.moveTo(x - 0.7, 20.5); g.lineTo(x + 0.7, 20.5); g.lineTo(x, 18.6); g.fill() }
  // the eyes
  g.fillStyle = '#b4ffae'
  g.beginPath(); g.arc(16.5, 12.5, 1.5, 0, 7); g.arc(23.5, 12.5, 1.5, 0, 7); g.fill()
  return c
}

export function registerGhoul(pgr) {
  try { pgr?.registerCustomTile?.(GHOUL_GID, draw().toDataURL('image/png')) } catch (e) { console.warn('[ghoul] no sprite:', e.message) }
}
