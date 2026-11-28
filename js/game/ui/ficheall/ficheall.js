// ficheall.js
//
// The board game on Fergus's table, full screen over the room. Open it with openFicheall({ scene, onClose }).
//
// You play the king's side: get the king from the well (the centre square) to one of the four corner gates, his
// eight swordsmen round him, before the host takes him or dawn comes. Each host beaten opens the next, harder one;
// which are beaten is kept on the hero (GameState notes ficheall_won_1 ... _7; in the browser if there is no hero).
// Over everything but the screen-turning guard: the moonTile and the brooch are under it while it is open.
//
// No words on it, as nowhere in the game: the shapes, the dots and the rings say what can be done.
//   tap one of yours: the dots are where it can go (a ring round an enemy it can take); tap a dot to go
//   tap one of the host's: its dots, in red, are where it could go
//   a dashed red ring round the king: he is open to capture now
// The rules are ficheallEngine.js; the figures are ficheallPieces.js.

import { T, RULES, setup, genMoves, make, result, think, hasMoves, legalFrom, kingThreatened, G9 } from './ficheallEngine.js'
import { el, drawPiece, pieceIcon } from './ficheallPieces.js'
import { GameState } from '../../systems/gameState.js'

const ROOT_ID = 'ficheall-root'
const CX = 200, CY = 200, CELL = 40, X0 = CX - 4.5 * CELL, Y0 = CY - 4.5 * CELL
const LEVEL = { ms: 900, maxDepth: 10, noise: 20 }        // the host's thinking: under a second a move

// The hosts, easiest first (by the AI playing both sides, sixteen games each, the king won 16, 16, 10, 9, 7, 6, 2).
// Each is one side's line-up (the same on all four sides) or four lists, one per side; [file, rank, piece] on the
// south side, turned for the others. C is a footman (one square any way), as the swordsmen.
export const HOSTS = [
  [[4, 0, 'N']],                                                                                  // four knights
  [[3, 0, 'N'], [5, 0, 'B']],                                                                     // knights and bishops
  [[4, 0, 'R']],                                                                                  // four rooks
  [[[4, 0, 'Q'], [4, 1, 'C']], [[3, 0, 'N'], [5, 0, 'B']], [[4, 0, 'R'], [4, 1, 'C']], [[3, 0, 'B'], [5, 0, 'N']]],   // a queen's band
  [[[4, 0, 'R'], [4, 1, 'C']], [[4, 0, 'R']], [[4, 0, 'R'], [4, 1, 'C']], [[4, 0, 'R']]],          // rooks and footmen
  [[[4, 0, 'R'], [4, 1, 'C']], [[3, 0, 'N'], [5, 0, 'B'], [4, 1, 'C']], [[4, 0, 'R'], [4, 1, 'C']], [[3, 0, 'B'], [5, 0, 'N'], [4, 1, 'C']]],   // a mixed band
  [[4, 0, 'Q']],                                                                                  // four queens
]
function counts(host) {
  const sides = Array.isArray(host[0][0]) ? host : [host, host, host, host], n = {}
  for (const list of sides) for (const [, , t] of list) n[t] = (n[t] || 0) + 1
  return n
}

// ── what is won ───────────────────────────────────────────────────────────────
const LS_KEY = 'ficheall.won'
function wonCount() {
  if (GameState._state) { let n = 0; while (n < HOSTS.length && GameState.hasNote('ficheall_won_' + (n + 1))) n++; return n }
  try { return Number(localStorage.getItem(LS_KEY)) || 0 } catch (_) { return 0 }
}
function markWon(k) {                                       // k: the host's number, from 1
  if (GameState._state) { try { GameState.addNote('ficheall_won_' + k) } catch (_) {} return }
  try { if (k > (Number(localStorage.getItem(LS_KEY)) || 0)) localStorage.setItem(LS_KEY, k) } catch (_) {}
}

const CSS = `
#${ROOT_ID} { position: fixed; inset: 0; z-index: 1000010; background: #121315; color: #ece6d8; display: flex; flex-direction: column;
  align-items: center; overflow-y: auto; touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
  opacity: 0; transition: opacity .2s ease; padding: max(10px, env(safe-area-inset-top)) 8px 16px; box-sizing: border-box; }
#${ROOT_ID}.on { opacity: 1; }
#${ROOT_ID} .fx-top { width: 100%; max-width: 460px; display: flex; justify-content: flex-end; }
#${ROOT_ID} button { background: transparent; border: 1px solid #3a3d40; border-radius: 10px; color: #ece6d8; min-width: 44px; min-height: 44px; display: inline-flex;
  align-items: center; justify-content: center; padding: 0 8px; cursor: pointer; }
#${ROOT_ID} button:active { transform: scale(.97); }
#${ROOT_ID} button svg { width: 22px; height: 22px; }
#${ROOT_ID} .fx-board { width: min(100%, 460px, 64vh); height: auto; display: block; margin: 4px 0 6px; }
#${ROOT_ID} .frame { fill: #4a4337; stroke: #6d675a; stroke-width: 1.2; }
#${ROOT_ID} .cell { cursor: pointer; stroke: #2a2620; stroke-width: .5; }
#${ROOT_ID} .cell.lt { fill: #ddd5c0; } #${ROOT_ID} .cell.dk { fill: #aea48a; }
#${ROOT_ID} .cell.gate.lt { fill: #e6cf8e; } #${ROOT_ID} .cell.gate.dk { fill: #cdb26c; }
#${ROOT_ID} .cell.wellcell { fill: #8f8670; }
#${ROOT_ID} .gatemark { fill: none; stroke: #7a5a12; stroke-width: 1.3; stroke-dasharray: 3 2.2; }
#${ROOT_ID} .well { fill: #1f4e72; stroke: #9cc3df; stroke-width: 1.2; }
#${ROOT_ID} .lastmv { fill: rgba(240, 196, 70, .3); }
#${ROOT_ID} .selring { fill: rgba(245, 215, 110, .28); stroke: #f5d76e; stroke-width: 2.2; }
#${ROOT_ID} .peekring { fill: rgba(224, 69, 42, .2); stroke: #e0452a; stroke-width: 2.2; }
#${ROOT_ID} .dot { fill: rgba(25, 25, 25, .5); } #${ROOT_ID} .dot.win { fill: #f5d76e; stroke: #7a5a12; stroke-width: 1.2; }
#${ROOT_ID} .dot.take { fill: none; stroke: #c4462e; stroke-width: 2.4; }
#${ROOT_ID} .dot.foe { fill: rgba(196, 70, 46, .78); } #${ROOT_ID} .dot.take.foe { fill: none; stroke: #e0452a; stroke-width: 2.1; stroke-dasharray: 3 2.4; }
#${ROOT_ID} .threat { fill: none; stroke: #e0452a; stroke-width: 2.4; stroke-dasharray: 4 3; }
#${ROOT_ID} .pc { transition: transform .3s ease, opacity .4s ease; }
#${ROOT_ID} .pc.gone { opacity: 0; }
#${ROOT_ID} .end-win { fill: rgba(245, 215, 110, .22); } #${ROOT_ID} .end-lose { fill: rgba(120, 20, 10, .28); }
#${ROOT_ID} .glow { fill: none; stroke: #f5d76e; stroke-width: 3; }
#${ROOT_ID} .fx-dawn { width: min(100%, 460px, 64vh); display: flex; align-items: center; gap: 8px; margin: 0 0 10px; }
#${ROOT_ID} .fx-dawn .track { flex: 1; height: 6px; border-radius: 3px; background: #2b2d30; overflow: hidden; }
#${ROOT_ID} .fx-dawn .fill { height: 100%; background: linear-gradient(90deg, #1f3550, #6a5a8a 70%, #d9a05a); transition: width .3s ease; }
#${ROOT_ID} .fx-dawn svg { width: 18px; height: 18px; flex: none; }
#${ROOT_ID} .fx-row { display: flex; gap: 10px; margin: 0 0 12px; }
#${ROOT_ID} .fx-hosts { width: min(100%, 460px); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
#${ROOT_ID} .host { justify-content: flex-start; gap: 6px; flex-wrap: wrap; padding: 4px 8px; min-height: 40px; position: relative; }
#${ROOT_ID} .host.sel { background: #34383c; border-color: #8f6a17; }
#${ROOT_ID} .host:disabled { opacity: .3; cursor: default; }
#${ROOT_ID} .host.won::after { content: ''; position: absolute; right: 6px; top: 6px; width: 7px; height: 7px; border-radius: 50%; background: #e2bb4d; }
#${ROOT_ID} .host.next { animation: fxPulse 1.4s ease-in-out infinite; }
@keyframes fxPulse { 50% { border-color: #e2bb4d; box-shadow: 0 0 0 2px rgba(226, 187, 77, .35); } }
#${ROOT_ID} .cnt { display: inline-flex; align-items: center; font-size: 13px; color: #d6d0c1; }
#${ROOT_ID} .cnt svg { width: 15px; height: 19px; background: #d9d1bc; border-radius: 4px; margin-right: 2px; }
`
const ICON = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  again: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#d9a05a"/><g stroke="#d9a05a" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M15 3a9 9 0 1 0 6 15.5A8 8 0 0 1 15 3z" fill="#9cb0c8"/></svg>',
}

export function openFicheall({ scene = null, onClose = null } = {}) {
  if (document.getElementById(ROOT_ID)) return null
  if (!document.getElementById(ROOT_ID + '-style')) { const s = document.createElement('style'); s.id = ROOT_ID + '-style'; s.textContent = CSS; document.head.appendChild(s) }
  const root = document.createElement('div'); root.id = ROOT_ID; document.body.appendChild(root)
  const div = (cls, parent = root) => { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d }
  const btn = (icon, label, parent) => { const b = document.createElement('button'); b.innerHTML = icon; b.setAttribute('aria-label', label); parent.appendChild(b); return b }

  const top = div('fx-top'), bClose = btn(ICON.close, 'Close', top)
  const svg = el('svg', { viewBox: '0 0 400 400', class: 'fx-board', role: 'img', 'aria-label': 'The board' }, root)
  const dawn = div('fx-dawn'); dawn.insertAdjacentHTML('beforeend', ICON.moon); const track = div('track', dawn), fill = div('fill', track); dawn.insertAdjacentHTML('beforeend', ICON.sun)
  const row = div('fx-row'), bUndo = btn(ICON.undo, 'Undo', row), bAgain = btn(ICON.again, 'Start again', row)
  const hostsBox = div('fx-hosts')

  // ── the board ───────────────────────────────────────────────────────────────
  const fileOf = i => i % 9, rankOf = i => (i / 9) | 0
  const cellXY = i => [X0 + fileOf(i) * CELL, Y0 + (8 - rankOf(i)) * CELL]
  const centreOf = i => { const [x, y] = cellXY(i); return [x + CELL / 2, y + CELL / 2] }
  const gCells = el('g', {}, svg), gMarks = el('g', { 'pointer-events': 'none' }, svg), gHi = el('g', { 'pointer-events': 'none' }, svg)
  const gDots = el('g', { 'pointer-events': 'none' }, svg), gPieces = el('g', { 'pointer-events': 'none' }, svg), gEnd = el('g', { 'pointer-events': 'none' }, svg)
  el('rect', { x: X0 - 6, y: Y0 - 6, width: 9 * CELL + 12, height: 9 * CELL + 12, rx: 6, class: 'frame' }, gCells)
  for (let i = 0; i < 81; i++) {
    const [x, y] = cellXY(i), light = (fileOf(i) + rankOf(i)) % 2 === 1
    el('rect', { x, y, width: CELL, height: CELL, class: 'cell ' + (light ? 'lt' : 'dk') + (G9.isGate[i] ? ' gate' : '') + (i === G9.WELL ? ' wellcell' : ''), 'data-i': i }, gCells)
    if (G9.isGate[i]) el('rect', { x: x + 5, y: y + 5, width: CELL - 10, height: CELL - 10, class: 'gatemark' }, gMarks)
  }
  { const [x, y] = centreOf(G9.WELL); el('circle', { cx: x, cy: y, r: 15, class: 'well' }, gMarks) }

  // ── the game ────────────────────────────────────────────────────────────────
  let G, pid, nextId = 1, history, seen, rung = Math.min(wonCount(), HOSTS.length - 1), sel = -1, targets = [], peek = -1, peekTargets = []
  let last = null, over = null, busy = false, closed = false, timer = null
  const pieceEls = new Map()

  function newGame() {
    G = setup(HOSTS[rung]); pid = new Int32Array(81)
    for (let i = 0; i < 81; i++) if (G.b[i]) pid[i] = nextId++
    history = []; seen = new Map(); sel = -1; targets = []; peek = -1; peekTargets = []; last = null; over = null
    for (const e of pieceEls.values()) e.remove(); pieceEls.clear()
    bump(); render(true); drawHosts(); maybeHost()
  }
  const key = () => G.b.join('') + G.side
  function bump() { const k = key(); seen.set(k, (seen.get(k) || 0) + 1); return seen.get(k) }
  function play(mv) {
    history.push({ b: new Int8Array(G.b), side: G.side, ks: G.ks, pid: new Int32Array(pid), last, seen: new Map(seen) })
    const from = (mv / 128) | 0, to = mv % 128, caps = []
    make(G, mv, caps)
    for (const v of caps) pid[(v / 16) | 0] = 0
    pid[to] = pid[from]; pid[from] = 0
    last = { from, to }; sel = -1; targets = []; peek = -1; peekTargets = []
    over = result(G) || (!hasMoves(G) ? (G.side === 0 ? 'king' : 'host') : null)
           || (bump() >= 3 ? 'host' : null) || (history.length >= RULES.dawn ? 'host' : null)
    if (over === 'king') markWon(rung + 1)
    render(false); if (over) drawHosts()
    maybeHost()
  }
  function maybeHost() {
    if (over || G.side === 1 || closed) return
    busy = true
    timer = setTimeout(() => { timer = null; if (closed) return; const r = think(G, LEVEL); busy = false; if (r && !closed) play(r.move) }, 80)
  }
  function undo() {
    if (busy || !history.length) return
    let h = history.pop(); while (h.side !== 1 && history.length) h = history.pop()
    if (h.side !== 1) { newGame(); return }
    G.b.set(h.b); G.side = h.side; G.ks = h.ks; G.kt = 0; pid = h.pid; last = h.last; seen = h.seen; over = null
    sel = -1; targets = []; peek = -1; peekTargets = []; render(true); drawHosts()
  }

  // ── drawing ─────────────────────────────────────────────────────────────────
  function pieceEl(id, type) {
    let g = pieceEls.get(id); if (g) return g
    g = el('g', { class: 'pc' }, gPieces)
    drawPiece(el('g', { transform: type === T.K ? 'translate(0 -4) scale(1.08)' : 'translate(0 -3.5)' }, g), type)
    pieceEls.set(id, g); return g
  }
  function place(g, i, instant) {
    const [x, y] = centreOf(i)
    if (instant) { g.style.transition = 'none'; g.style.transform = `translate(${x}px, ${y}px)`; g.getBoundingClientRect(); g.style.transition = '' }
    else g.style.transform = `translate(${x}px, ${y}px)`
  }
  function dots(list, foe) {
    for (const t of list) {
      const [x, y] = centreOf(t)
      if (G.b[t]) el('circle', { cx: x, cy: y, r: 17.5, class: 'dot take' + (foe ? ' foe' : '') }, gDots)
      else el('circle', { cx: x, cy: y, r: G9.isGate[t] ? 7 : 5, class: 'dot' + (foe ? ' foe' : G9.isGate[t] ? ' win' : '') }, gDots)
    }
  }
  function render(instant) {
    const alive = new Set()
    for (let i = 0; i < 81; i++) if (G.b[i]) { const id = pid[i]; alive.add(id); const g = pieceEl(id, G.b[i]); g.classList.remove('gone'); place(g, i, instant || !g.dataset.placed); g.dataset.placed = 1 }
    for (const [id, g] of pieceEls) if (!alive.has(id)) { g.classList.add('gone'); setTimeout(() => { if (g.classList.contains('gone') && pieceEls.get(id) === g) { g.remove(); pieceEls.delete(id) } }, 450) }
    gHi.textContent = ''; gDots.textContent = ''; gEnd.textContent = ''
    if (last) for (const s of [last.from, last.to]) { const [x, y] = cellXY(s); el('rect', { x, y, width: CELL, height: CELL, class: 'lastmv' }, gHi) }
    if (sel >= 0) { const [x, y] = centreOf(sel); el('circle', { cx: x, cy: y, r: 18, class: 'selring' }, gHi); dots(targets, false) }
    if (peek >= 0 && G.b[peek]) { const [x, y] = centreOf(peek); el('circle', { cx: x, cy: y, r: 18, class: 'peekring' }, gHi); dots(peekTargets, true) }
    if (!over && kingThreatened(G)) { const [x, y] = centreOf(G.ks); el('circle', { cx: x, cy: y, r: 20.5, class: 'threat' }, gHi) }
    if (over) {                                             // the end, said in light: gold over the gate he went through, or a shadow over the board
      el('rect', { x: X0, y: Y0, width: 9 * CELL, height: 9 * CELL, class: over === 'king' ? 'end-win' : 'end-lose' }, gEnd)
      if (over === 'king') { const [x, y] = centreOf(G.ks); el('circle', { cx: x, cy: y, r: 22, class: 'glow' }, gEnd) }
    }
    fill.style.width = Math.max(0, 100 * (1 - history.length / RULES.dawn)) + '%'
  }
  function drawHosts() {
    const won = wonCount()
    hostsBox.textContent = ''
    HOSTS.forEach((h, k) => {
      const b = document.createElement('button')
      b.className = 'host' + (k === rung ? ' sel' : '') + (k < won ? ' won' : '') + (over === 'king' && k === won && k !== rung && k < HOSTS.length ? ' next' : '')
      b.disabled = k > won || busy
      b.setAttribute('aria-label', 'Host ' + (k + 1))
      for (const [t, c] of Object.entries(counts(h))) { const s = document.createElement('span'); s.className = 'cnt'; s.appendChild(pieceIcon(T[t])); s.appendChild(document.createTextNode(c)); b.appendChild(s) }
      b.onclick = () => { if (busy) return; rung = k; newGame() }
      hostsBox.appendChild(b)
    })
  }

  // ── taps ────────────────────────────────────────────────────────────────────
  const reachOf = i => legalFrom({ b: G.b, side: G9.isDef(G.b[i]) ? 1 : 0, ks: G.ks, kt: 0 }, i)
  svg.addEventListener('click', ev => {
    if (busy) return
    const t = ev.target.closest('[data-i]'), i = t ? +t.dataset.i : -1
    const myTurn = !over && G.side === 1
    if (myTurn && sel >= 0 && targets.includes(i)) { play(sel * 128 + i); return }
    const p = i >= 0 ? G.b[i] : 0, mine = p && G9.isDef(p)
    if (mine && myTurn) { peek = -1; peekTargets = []; if (i !== sel) { sel = i; targets = legalFrom(G, i) } else { sel = -1; targets = [] } }
    else if (p && !mine) { sel = -1; targets = []; if (i !== peek) { peek = i; peekTargets = reachOf(i) } else { peek = -1; peekTargets = [] } }
    else { sel = -1; targets = []; peek = -1; peekTargets = [] }
    render(false)
  })
  bUndo.onclick = undo
  bAgain.onclick = () => { if (!busy) newGame() }

  // ── open and close ──────────────────────────────────────────────────────────
  function close() {
    if (closed) return
    closed = true; if (timer) clearTimeout(timer)
    root.classList.remove('on')
    setTimeout(() => root.remove(), 200)
    if (scene) { scene._ficheallOpen = false; scene.events?.off?.('shutdown', close); scene.joystick?.showDirections?.() }
    onClose?.()
  }
  bClose.onclick = close
  if (scene) { scene._ficheallOpen = true; scene.joystick?.hideDirections?.(); scene.events?.once?.('shutdown', close) }
  newGame()
  requestAnimationFrame(() => root.classList.add('on'))
  return { close }
}
