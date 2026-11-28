// ficheallPieces.js
//
// The men on Fergus's board, drawn as little standing figures in SVG (side on, in a 40 x 40 box round 0,0, the
// plinth's foot at y = 14). The king's side in cream and bronze, the king in gold; the host in black and iron. A
// piece's shape says how it moves: the king's swordsmen and the host's footmen are the same figure, as they move
// alike (one square any way); the host's rooks, bishops, knights and queens are the chess shapes.

import { T } from './ficheallEngine.js'

const SVGNS = 'http://www.w3.org/2000/svg'
export function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag)
  for (const k in attrs) e.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(e)
  return e
}

const FOOT = 'M-11 14 L11 14 L11 10.5 Q10 9 8 8.5'
const FOOT_L = 'Q-10 9 -11 10.5 Z'
const SHAPES = {
  rook: { d: FOOT + ' L7 -4 L10 -6 L10 -14 L6.2 -14 L6.2 -10.5 L2.1 -10.5 L2.1 -14 L-2.1 -14 L-2.1 -10.5 L-6.2 -10.5 L-6.2 -14 L-10 -14 L-10 -6 L-7 -4 L-8 8.5 ' + FOOT_L,
          lines: ['M-7 -4 L7 -4', 'M-8.4 6.5 L8.4 6.5'] },
  bishop: { d: FOOT + ' Q5.5 6 5 1.5 L8 0 L8 -2.2 L4.2 -3.2 C9.5 -7.5 6.5 -13.5 0 -17.5 C-6.5 -13.5 -9.5 -7.5 -4.2 -3.2 L-8 -2.2 L-8 0 L-5 1.5 Q-5.5 6 -8 8.5 ' + FOOT_L,
            lines: ['M1.2 -13 L4.6 -7.6', 'M-8 -1.1 L8 -1.1'], dots: [[0, -19.2, 2.2]] },
  // the king's crown has a single sun-disc on its middle point (not a cross, and not the queen's five balls)
  king: { d: FOOT + ' Q6.5 6 6 1.5 L9 0 L9 -2.2 L6 -3.2 L10 -14.5 L4.6 -8.6 L0 -17.5 L-4.6 -8.6 L-10 -14.5 L-6 -3.2 L-9 -2.2 L-9 0 L-6 1.5 Q-6.5 6 -8 8.5 ' + FOOT_L,
          lines: ['M-9 -1.1 L9 -1.1', 'M-6.4 -3.2 L6.4 -3.2'], dots: [[0, -20, 2.9]] },
  queen: { d: FOOT + ' Q6.5 6 6 1.5 L9 0 L9 -2.2 L6 -3.2 L10.5 -13 L7.3 -8 L5 -15.5 L2.6 -8.4 L0 -17 L-2.6 -8.4 L-5 -15.5 L-7.3 -8 L-10.5 -13 L-6 -3.2 L-9 -2.2 L-9 0 L-6 1.5 Q-6.5 6 -8 8.5 ' + FOOT_L,
           lines: ['M-9 -1.1 L9 -1.1', 'M-6.4 -3.2 L6.4 -3.2'], dots: [[10.5, -13.9, 1.6], [5, -16.4, 1.6], [0, -18, 1.7], [-5, -16.4, 1.6], [-10.5, -13.9, 1.6]] },
  knight: { d: FOOT + ' C8.6 2 9.6 -5.5 5.4 -11 L5.8 -16.2 L2 -12.8 C-1.5 -13.2 -6 -10.6 -8.6 -5.6 L-11.2 -0.6 C-11.6 1.6 -9.4 3.2 -7.4 1.6 L-3.2 -1.4 C-3.4 2.2 -5.4 5.2 -8 8.5 ' + FOOT_L,
            lines: ['M5.2 -8 C3 -3 4 2 6.6 6'], eye: [-3, -7.6, 1.3] },
}
// fill, outline, detail
const INK = { gold: ['#e2bb4d', '#6f500e', '#8f6a17'], dark: ['#2e3135', '#0d0e10', '#8c939b'] }

function shape(p, name, ink) {
  const S = SHAPES[name], [f, o, l] = INK[ink]
  el('path', { d: S.d, fill: f, stroke: o, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, p)
  for (const L of S.lines || []) el('path', { d: L, fill: 'none', stroke: l, 'stroke-width': name === 'bishop' ? 1.8 : 1.2, 'stroke-linecap': 'round' }, p)
  for (const [x, y, r] of S.dots || []) el('circle', { cx: x, cy: y, r, fill: f, stroke: o, 'stroke-width': 1.2 }, p)
  if (S.eye) el('circle', { cx: S.eye[0], cy: S.eye[1], r: S.eye[2], fill: o }, p)
}

// a swordsman: a helm, a round shield with a boss, a sword held upright
const SWORD = {
  body: 'M-11 14 L11 14 L11 11 L8 11 L6 -2.5 Q3.5 -4.5 0 -4.5 Q-3.5 -4.5 -6 -2.5 L-8 11 L-11 11 Z',
  head: [0, -9, 4.2],
  helm: 'M-4.6 -9.2 Q-4.4 -14.6 0 -14.8 Q4.4 -14.6 4.6 -9.2 L3.2 -9.2 L3.2 -11 L-3.2 -11 L-3.2 -9.2 Z',
  blade: 'M7.4 -19.5 L8.6 -17.4 L8.6 0.2 L6.2 0.2 L6.2 -17.4 Z',
  guard: 'M3.8 0.8 L11 0.8', grip: 'M7.4 0.8 L7.4 4.6', pommel: [7.4, 5.6, 1.3],
  shield: [-2, 3.2, 7.6], boss: [-2, 3.2, 2.1],
}
const SWORD_INK = {
  cream: { body: '#eee6cf', line: '#5a4b2c', face: '#eee6cf', helm: '#9a7a3e', fit: '#4a3a1c', pommel: '#c9a24a', shield: '#b98c4a', rim: '#e0c58a', boss: '#e2bb4d' },
  dark: { body: '#2e3135', line: '#0d0e10', face: '#9da2a8', helm: '#5d6166', fit: '#15171a', pommel: '#8c939b', shield: '#4b3d2e', rim: '#8c939b', boss: '#b8bec5' },
}
function swordsman(p, ink) {
  const S = SWORD, c = SWORD_INK[ink]
  el('path', { d: S.blade, fill: '#d4d8dc', stroke: '#3a3d40', 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, p)
  el('path', { d: S.body, fill: c.body, stroke: c.line, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, p)
  el('circle', { cx: S.head[0], cy: S.head[1], r: S.head[2], fill: c.face, stroke: c.line, 'stroke-width': 1.3 }, p)
  el('path', { d: S.helm, fill: c.helm, stroke: c.fit, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, p)
  el('path', { d: S.guard, stroke: c.fit, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, p)
  el('path', { d: S.grip, stroke: c.fit, 'stroke-width': 1.8, 'stroke-linecap': 'round' }, p)
  el('circle', { cx: S.pommel[0], cy: S.pommel[1], r: S.pommel[2], fill: c.pommel, stroke: c.fit, 'stroke-width': 0.8 }, p)
  el('circle', { cx: S.shield[0], cy: S.shield[1], r: S.shield[2], fill: c.shield, stroke: c.fit, 'stroke-width': 1.4 }, p)
  el('circle', { cx: S.shield[0], cy: S.shield[1], r: S.shield[2] - 2.2, fill: 'none', stroke: c.rim, 'stroke-width': 0.9 }, p)
  el('circle', { cx: S.boss[0], cy: S.boss[1], r: S.boss[2], fill: c.boss, stroke: c.fit, 'stroke-width': 0.9 }, p)
}

// one piece, into an SVG group (with its shadow on the board, unless asked not to)
export function drawPiece(p, type, shadow = true) {
  if (shadow) el('ellipse', { cx: 0, cy: 14.5, rx: 12, ry: 3.2, fill: 'rgba(0,0,0,.38)' }, p)
  if (type === T.S) swordsman(p, 'cream')
  else if (type === T.C) swordsman(p, 'dark')
  else if (type === T.K) shape(p, 'king', 'gold')
  else shape(p, { [T.R]: 'rook', [T.B]: 'bishop', [T.Q]: 'queen', [T.N]: 'knight' }[type], 'dark')
}
// a piece on its own, as a small picture (the hosts' list)
export function pieceIcon(type) {
  const s = document.createElementNS(SVGNS, 'svg')
  s.setAttribute('viewBox', '-15 -22 30 38')
  drawPiece(s, type, false)
  return s
}
