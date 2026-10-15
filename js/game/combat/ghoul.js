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
// The sprite is a PLACEHOLDER, drawn here in canvas: a hunched grey figure with long arms and green eyes.

import { BASE } from './melee.js'
import { stats } from './enemies.js'

export const GHOUL_GID = 9301

export const GHOUL = {
  ...BASE, ...stats({ health: 3, attack: 6, defense: 2, speed: 4, stamina: 4 }),
  style: 'rusher', aggressor: true, salutes: false, noShove: true, swordGid: 2495,
  windMs: 360, strikeMs: 100, recoverMs: 560, followWind: 260, combo: 2,
  parryBase: 0, parryReel0: 0, parryReelStep: 0, parryMax: 0, restMin: 80, restMax: 300,
  stamCut: 1, stamStep: 0.25, stamRegen: 0.9, blownMs: 2200, staggerMs: 300,
}

// 40 x 48: the figure's box is 1 wide to 1.2 tall
function draw() {
  const c = document.createElement('canvas'); c.width = 40; c.height = 48
  const g = c.getContext('2d')
  const blob = (x, y, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill() }
  // legs, bent
  blob(15, 42, 4, 6, '#2c3028', 0.2); blob(26, 42, 4, 6, '#2c3028', -0.2)
  // hunched body
  blob(20, 29, 10, 13, '#3d4338', 0.1)
  blob(19, 24, 8, 9, '#4a5242', 0.1)
  // long arms, hanging low, hands open
  g.strokeStyle = '#3d4338'; g.lineWidth = 4; g.lineCap = 'round'
  g.beginPath(); g.moveTo(11, 22); g.quadraticCurveTo(4, 32, 6, 42); g.stroke()
  g.beginPath(); g.moveTo(29, 22); g.quadraticCurveTo(37, 31, 34, 42); g.stroke()
  g.strokeStyle = '#6b715f'; g.lineWidth = 1.4
  for (const [x, y] of [[6, 42], [34, 42]]) for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + i * 2.5, y + 4); g.stroke() }
  // the head, low between the shoulders
  blob(20, 13, 8, 8.5, '#7c8270')
  blob(20, 14, 6.5, 6.5, '#14170f')                    // the hollow of the face
  // teeth
  g.fillStyle = '#d8d6c4'
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(15.5 + i * 2.3, 18); g.lineTo(16.7 + i * 2.3, 21); g.lineTo(17.9 + i * 2.3, 18); g.fill() }
  // the eyes
  g.fillStyle = '#9dffa0'
  g.beginPath(); g.arc(16.5, 12.5, 1.9, 0, 7); g.arc(23.5, 12.5, 1.9, 0, 7); g.fill()
  return c
}

export function registerGhoul(pgr) {
  try { pgr?.registerCustomTile?.(GHOUL_GID, draw().toDataURL('image/png')) } catch (e) { console.warn('[ghoul] no sprite:', e.message) }
}
