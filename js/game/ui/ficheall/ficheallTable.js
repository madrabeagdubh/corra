// ficheallTable.js
//
// The board on Fergus's table, seen in perspective, full screen: openTable({ scene, onClose }), from the look at the
// table in his house (tighFhearghais.js). Fergus isn't there; the game on it is half played. Nothing here keeps
// rules: a piece can be lifted, looked at, and set down anywhere, and stays where it was left (on the hero, in
// GameState's place-layouts, under 'ficheall_table'). The game against him, with its rules and his play, is
// ficheall.js, for when he sits across from you (the opponent option here draws him there).
//
// It is seen as a great board would be from far off, through a long lens: the squares hardly narrow as they go back,
// there is air between you and the far rows, and what is small (the cattle raid cut along its edge, the wren, the
// lichen, the faces) only shows when you close in.
//
//   tap a piece           lift it (it hangs over its square)
//   tap it again          bring it close and look at it; tap again to put it back in the air
//   tap a square          set it down there (or anywhere on the table beside the board)
//   tap another piece     set the one you hold back where it was, and take that one up
//   pinch, or the wheel   close in or draw back
//   drag (one finger or two)  look about
//
// No words on it but a piece's name when you look at it (the English under it as the moon allows). The pieces and the
// stone are painted by ficheallCarve.js, once, the first time the board is opened.

import { PITCH, KINDS, paintPiece, paintSquare, paintFrieze, paintWren, paintOpponent } from './ficheallCarve.js'
import { GameState } from '../../systems/gameState.js'
import { GameSettings } from '../../settings/gameSettings.js'
import { FONTS } from '../../systems/gameTypography.js'
import { SoundBoard } from '../../systems/soundBoard.js'

const SAVE_KEY = 'ficheall_table'

const DIST = 40                 // the camera stands this far (squares) from what it looks at: far off, a long lens
const ZMAX = 9, ZMIN = 0.9      // how far you may close in, and draw back
const LIFT = 1.0                // a piece held hangs this far above the board
const LO = 100, HI = 420        // the pieces painted at these many pixels to the square
const cp = Math.cos(PITCH), sp = Math.sin(PITCH)

// How Fergus left it: a battle at its height. The king's men have locked shields in a ring round him, just north of the
// well; the host has closed on the ring from the south and the west, two deep, its line broken only by the well, the
// queen behind the angle of it, a druid behind each face, castles out on the flanks. A horseman has broken into the
// ring on its south-east side, where one of the king's men has fallen, and another is coming after him; the way to
// the north-east gate is still open. The dead stand beside the board: the host's in a row on the west, the king's
// man on the east. [kind, file, rank] on the board; beside it, [kind, x, y] (the board runs 0..9 each way)
const SQ = (k, f, r) => [k, f + 0.5, r + 0.5]
const LAYOUT = [
  SQ('ri', 5, 6),                                                                         // the king (the wren sits on him)
  SQ('laoch', 4, 7), SQ('laoch', 5, 7), SQ('laoch', 6, 7), SQ('laoch', 4, 6), SQ('laoch', 6, 6), SQ('laoch', 4, 5), SQ('laoch', 5, 5),   // the ring
  SQ('ridire', 6, 5), SQ('ridire', 7, 4),                                                 // in at the breach, and after it
  SQ('ceith', 3, 7), SQ('ceith', 3, 6), SQ('ceith', 3, 5), SQ('ceith', 3, 4), SQ('ceith', 5, 4),   // the host's front, against the shields
  SQ('ceith', 2, 6), SQ('ceith', 2, 5), SQ('ceith', 5, 3),                                // its second rank
  SQ('banrion', 2, 3), SQ('draoi', 1, 6), SQ('draoi', 4, 2),                              // the queen at the angle, her druids
  SQ('caislean', 1, 8), SQ('caislean', 7, 2),                                             // a castle on each flank
  SQ('ceith', 1, 2), SQ('ceith', 3, 1),                                                   // stragglers coming up
  ['ceith', -1.25, 1.2], ['ceith', -1.25, 2.25], ['ridire', -1.25, 3.3], ['ceith', -1.25, 4.35],   // the host's dead
  ['laoch', 10.25, 5.4],                                                                  // and the king's man who fell at the breach
]
// the side of the table you stand at: which way you look (degrees from north, toward the east)
const SIDES = { south: 0, west: 90, north: 180, east: 270 }
// where the hearth is from the table, on the board's own axes (east, north): the fire lights the pieces from there
const FIRE = (() => { const x = -3, y = 2.5, l = Math.hypot(x, y); return [x / l, y / l] })()

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
const hash2 = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h ^= h >>> 13; return (h >>> 0) / 4294967296 }

const CSS = `
#ft-root { position: fixed; inset: 0; z-index: 1000010; background: #0a0807; touch-action: none; user-select: none; -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent; opacity: 0; transition: opacity .35s ease; }
#ft-root.on { opacity: 1; }
#ft-root canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 0; transition: opacity .4s ease; }
#ft-root .ft-x { position: absolute; top: max(10px, env(safe-area-inset-top)); right: 10px; width: 44px; height: 44px; border-radius: 10px;
  border: 1px solid rgba(236,230,216,.22); background: rgba(10,8,7,.35); color: #ece6d8; display: flex; align-items: center; justify-content: center; }
#ft-root .ft-x svg { width: 22px; height: 22px; }
`

// ── what is painted once, the first time the board is opened ─────────────────────────────────────────────
let ART = null
function art() {
  if (ART) return ART
  const SPR = {}, MASK = {}, FOG = {}
  const fogOf = (spr) => { const c = document.createElement('canvas'); c.width = spr.c.width; c.height = spr.c.height; const g = c.getContext('2d'); g.drawImage(spr.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgb(150,148,150)'; g.fillRect(0, 0, c.width, c.height); return c }
  for (const k of Object.keys(KINDS)) {
    const lo = paintPiece(k, LO), hi = paintPiece(k, HI)
    SPR[k] = { lo, hi }; FOG[k] = { lo: fogOf(lo), hi: fogOf(hi) }
    const d = lo.c.getContext('2d').getImageData(0, 0, lo.c.width, lo.c.height).data, m = new Uint8Array(lo.c.width * lo.c.height)
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3]
    MASK[k] = m
  }
  const TEX = { lo: {}, hi: {} }
  for (const t of ['lt', 'dk', 'gate', 'well']) for (let v = 0; v < (t === 'lt' || t === 'dk' ? 6 : 1); v++) { TEX.lo[t + v] = paintSquare(t, v, 48); TEX.hi[t + v] = paintSquare(t, v, 200) }
  ART = { SPR, MASK, FOG, TEX, FRIEZE: { lo: paintFrieze(100), hi: paintFrieze(400) }, WREN: [paintWren(1400, 0), paintWren(1400, 1)], OPP: null }
  return ART
}

export function openTable({ scene = null, onClose = null, parent = document.body, opponent = false, side = 'south' } = {}) {
  if (document.getElementById('ft-root')) return null
  // the way you look (h, along the board) and your right hand (r); the fire on your left or your right. With the
  // fire on the right the pieces are drawn mirrored, so their lit side is toward it.
  const yaw = (SIDES[side] ?? 0) * Math.PI / 180, R6 = (v) => Math.round(v * 1e6) / 1e6
  const hx = R6(Math.sin(yaw)), hy = R6(Math.cos(yaw)), RX = R6(Math.cos(yaw)), RY = R6(-Math.sin(yaw))
  const fireSide = FIRE[0] * RX + FIRE[1] * RY > 0 ? 1 : -1, mx = fireSide > 0 ? -1 : 1
  if (!document.getElementById('ft-style')) { const s = document.createElement('style'); s.id = 'ft-style'; s.textContent = CSS; document.head.appendChild(s) }
  const root = document.createElement('div'); root.id = 'ft-root'; parent.appendChild(root)
  const cv = document.createElement('canvas'); root.appendChild(cv)
  const ctx = cv.getContext('2d')
  const bx = document.createElement('button'); bx.className = 'ft-x'; bx.setAttribute('aria-label', 'Close')
  bx.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  root.appendChild(bx)

  // the painting takes a moment the first time: the dark comes up first, the board after it
  let A = null, SPR, MASK, FOG, TEX, FRIEZE, WREN
  const ready = () => { A = art(); ({ SPR, MASK, FOG, TEX, FRIEZE, WREN } = A); cv.style.opacity = '1' }

  // ── the camera: a long lens looking along h and down at (tx, ty); zoom narrows the lens (F) ───────────────
  const cam = { tx: 4.5, ty: 4.5, F: 1, F0: 1, cx: 0, cy: 0, z: 1 }
  let W = 0, H = 0, dpr = 1
  function proj(x, y, z) {
    const vx = x - (cam.tx - DIST * cp * hx), vy = y - (cam.ty - DIST * cp * hy), vz = z - DIST * sp
    const along = vx * hx + vy * hy, zc = along * cp - vz * sp, yc = along * sp + vz * cp, xc = vx * RX + vy * RY
    if (zc < 0.5) return null
    const k = cam.F / zc
    return { x: cam.cx + xc * k, y: cam.cy - yc * k, k }
  }
  function unproject(sx, sy) {
    const a = (sx - cam.cx) / cam.F, b = -(sy - cam.cy) / cam.F, f = b * sp + cp
    const dx = a * RX + f * hx, dy = a * RY + f * hy, dz = b * cp - sp
    if (dz >= -1e-6) return null
    const t = (DIST * sp) / -dz
    return { x: cam.tx - DIST * cp * hx + t * dx, y: cam.ty - DIST * cp * hy + t * dy }
  }
  const depth = (x, y) => (x - 4.5) * hx + (y - 4.5) * hy                // how far back from the board's middle, as you look
  const local = (u, v) => [4.5 + u * RX + v * hx, 4.5 + u * RY + v * hy]   // across (to your right) and back, from its middle
  function fit() {
    W = innerWidth; H = innerHeight; dpr = Math.min(2.5, devicePixelRatio || 1)
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
    cam.cx = W / 2; cam.cy = H * 0.6
    const save = { tx: cam.tx, ty: cam.ty }; cam.tx = 4.5; cam.ty = 4.5; cam.F = 1
    const pts = [[...local(0, 4.7), 1.7]]
    for (const x of [-0.7, 9.7]) for (const y of [-0.7, 9.7]) pts.push([x, y, 0], [x, y, -0.35])
    for (const y of [0.8, 4.8]) pts.push([-1.75, y, 0], [10.75, y, 0])
    let F = Infinity
    for (const [x, y, z] of pts) {
      const p = proj(x, y, z), nx = p.x - cam.cx, ny = p.y - cam.cy
      if (nx) F = Math.min(F, (W * 0.47) / Math.abs(nx))
      if (ny > 0) F = Math.min(F, (H * 0.95 - cam.cy) / ny)
      else if (ny < 0) F = Math.min(F, (cam.cy - H * 0.2) / -ny)
    }
    cam.F0 = F; cam.F = F * cam.z; cam.tx = save.tx; cam.ty = save.ty
  }
  function clampView() {
    cam.z = clamp(cam.z, ZMIN, ZMAX); cam.F = cam.F0 * cam.z
    const room = 0.4 + 6.2 * (1 - 1 / cam.z)
    cam.tx = clamp(cam.tx, 4.5 - room, 4.5 + room); cam.ty = clamp(cam.ty, 4.5 - room, 4.5 + room)
  }

  // ── the pieces ────────────────────────────────────────────────────────────────────────────────────────────
  const pieces = LAYOUT.map(([kind, x, y], i) => ({ id: i, kind, x, y, z: 0, anim: null }))
  const saved = GameState._state ? GameState.getEncounterLayout(SAVE_KEY) : null
  const tag = (P) => P.id + ':' + P.kind                  // a piece is known by its place in the set-up and its kind
  if (Array.isArray(saved)) for (const s of saved) { const P = pieces.find(Q => tag(Q) === s.id); if (P && Number.isFinite(s.x) && Number.isFinite(s.y)) { P.x = s.x; P.y = s.y } }
  const keep = () => { if (GameState._state) GameState.setEncounterLayout(SAVE_KEY, pieces.map(P => ({ id: tag(P), x: +P.x.toFixed(3), y: +P.y.toFixed(3) }))) }
  let held = null, looking = null
  const onBoard = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 9
  function posOf(P, now) {
    if (P.anim) {
      const A = P.anim, u = clamp((now - A.t0) / A.dur, 0, 1), e = ease(u)
      const p = { x: A.fx + (A.tx - A.fx) * e, y: A.fy + (A.ty - A.fy) * e, z: A.fz + (A.tz - A.fz) * e + A.arc * Math.sin(Math.PI * u) }
      if (u >= 1) { P.anim = null; P.z = A.tz; A.done?.() }
      return p
    }
    return { x: P.x, y: P.y, z: P === held ? LIFT + 0.03 * Math.sin(now / 420) : 0 }
  }
  function lift(P) {
    held = P; P.anim = { fx: P.x, fy: P.y, fz: 0, tx: P.x, ty: P.y, tz: LIFT, arc: 0, t0: performance.now(), dur: 240 }
    sound('lift'); if (wren.on === P) wrenFlyOff()
  }
  function setDown(P, x, y) {
    const now = performance.now(), from = posOf(P, now), d = Math.hypot(x - from.x, y - from.y)
    P.anim = { fx: from.x, fy: from.y, fz: from.z, tx: x, ty: y, tz: 0, arc: Math.min(0.9, 0.15 + d * 0.12), t0: now, dur: 260 + Math.min(420, d * 60), done: () => sound('tock') }
    P.x = x; P.y = y; if (held === P) held = null
    keep()
  }
  // where a piece set down at x, y goes: the middle of an empty square, or a clear place on the table beside the board
  function placeFor(P, x, y) {
    const others = pieces.filter(Q => Q !== P)
    if (onBoard(x, y)) {
      const sx = Math.floor(x) + 0.5, sy = Math.floor(y) + 0.5
      return others.some(Q => Math.abs(Q.x - sx) < 0.1 && Math.abs(Q.y - sy) < 0.1) ? null : { x: sx, y: sy }
    }
    const onTable = (a, b) => a > -3.2 && a < 12.2 && b > -3.2 && b < 12.2 && !(a > -0.6 && a < 9.6 && b > -0.6 && b < 9.6)
    if (!onTable(x, y)) return null
    for (let ring = 0; ring < 12; ring++) for (let k = 0; k < (ring ? 8 : 1); k++) {   // the nearest clear place to where you tapped
      const a = x + Math.cos(k * Math.PI / 4) * ring * 0.16, b = y + Math.sin(k * Math.PI / 4) * ring * 0.16
      if (onTable(a, b) && !others.some(Q => Math.hypot(Q.x - a, Q.y - b) < 0.78)) return { x: a, y: b }
    }
    return null
  }

  // ── the wren: it sits on one piece a while, flits to another; it leaves a piece that is lifted ───────────
  const wren = { on: pieces[0], from: null, to: null, t0: 0, until: 0, flick: 0, face: mx }
  const perchOf = (P, now) => { const q = posOf(P, now), p = proj(q.x, q.y, q.z); if (!p) return null; const [dx, dy] = KINDS[P.kind].perch; return { x: p.x + mx * dx * p.k / 100, y: p.y + dy * p.k / 100, k: p.k } }
  function wrenFlyOff(now = performance.now()) {
    const choices = pieces.filter(Q => Q !== held && Q !== wren.on && !Q.anim)
    const to = choices[(Math.random() * choices.length) | 0]; if (!to) return
    wren.from = wren.on; wren.to = to; wren.on = null; wren.t0 = now
  }

  // ── the mist: low banks drifting east across the board; thicker the further off, and the closer you look ──
  const mist = Array.from({ length: 11 }, (_, i) => ({ x: -3 + 15 * hash2(i, 1), y: -1 + 11.5 * hash2(i, 2), w: 2.2 + 2.6 * hash2(i, 3), sp: 0.05 + 0.07 * hash2(i, 4), ph: 6.28 * hash2(i, 5) }))
  const wisps = Array.from({ length: 4 }, (_, i) => ({ x: hash2(i, 7), y: 0.15 + 0.7 * hash2(i, 8), s: 0.6 + 0.6 * hash2(i, 9), sp: 0.006 + 0.008 * hash2(i, 10) }))

  // ── sound: a soft knock of stone on wood, a lift ──────────────────────────────────────────────────────────
  let AC = null
  function sound(kind) {
    try {
      AC = AC || SoundBoard.ctx?.(scene) || new (window.AudioContext || window.webkitAudioContext)()
      const t = AC.currentTime, n = AC.createBuffer(1, AC.sampleRate * 0.12, AC.sampleRate), d = n.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, kind === 'tock' ? 6 : 2)
      const src = AC.createBufferSource(); src.buffer = n
      const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = kind === 'tock' ? 1100 : 2600; bp.Q.value = kind === 'tock' ? 1.3 : 0.7
      const gn = AC.createGain(); gn.gain.setValueAtTime(kind === 'tock' ? 0.5 : 0.08, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
      src.connect(bp).connect(gn).connect(AC.destination); src.start(t)
      if (kind === 'tock') {
        const o = AC.createOscillator(), og = AC.createGain(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.1)
        og.gain.setValueAtTime(0.35, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.13); o.connect(og).connect(AC.destination); o.start(t); o.stop(t + 0.14)
      }
    } catch (_) {}
  }

  // ── drawing ───────────────────────────────────────────────────────────────────────────────────────────────
  const poly = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath() }
  const quad = (x0, y0, x1, y1, z) => [proj(x0, y0, z), proj(x1, y0, z), proj(x1, y1, z), proj(x0, y1, z)]
  const pline = (pts, z = 0) => { ctx.beginPath(); pts.forEach(([x, y], i) => { const p = proj(x, y, z); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y) }) }
  let flick = 1

  function drawTable(now) {
    const T = quad(-7, -5.5, 16, 14.5, -0.35); poly(T)
    const gr = ctx.createLinearGradient(0, H * 0.3, 0, H); gr.addColorStop(0, '#1d150e'); gr.addColorStop(1, '#3b2b1d'); ctx.fillStyle = gr; ctx.fill()
    const k = proj(4.5, 4.5, 0).k
    for (let y = -5.5, i = 0; y < 14.5; y += 0.92, i++) {              // the planks, their seams, their grain
      const s0 = proj(-7, y, -0.35), s1 = proj(16, y, -0.35)
      ctx.strokeStyle = 'rgba(8,5,3,0.75)'; ctx.lineWidth = Math.max(0.6, k * 0.03); ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke()
      if (k * dpr > 50) for (let j = 0; j < 4; j++) {
        const yy = y + 0.15 + 0.62 * hash2(i, j), pts = []
        for (let x = -7; x <= 16; x += 1.5) pts.push([x, yy + 0.04 * Math.sin(x * 0.9 + i * 3 + j)])
        pline(pts, -0.35); ctx.strokeStyle = `rgba(${hash2(i, j + 9) < 0.5 ? '12,8,5' : '110,84,58'},0.25)`; ctx.lineWidth = Math.max(0.5, k * 0.012); ctx.stroke()
      }
    }
    const [e0, e1] = [[[-7, -5.5], [16, -5.5]], [[-7, 14.5], [16, 14.5]], [[-7, -5.5], [-7, 14.5]], [[16, -5.5], [16, 14.5]]]   // its near edge, worn
      .sort((p, q) => depth((p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2) - depth((q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2))[0].map(([x, y]) => proj(x, y, -0.35))
    ctx.strokeStyle = 'rgba(190,140,90,0.28)'; ctx.lineWidth = Math.max(1, k * 0.05); ctx.beginPath(); ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.stroke()
    poly(quad(-0.85, -0.9, 9.85, 9.8, -0.35)); ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fill()   // the board's shadow on it
  }

  function drawBoard(now) {
    const mid = proj(4.5, 4.5, 0), k = mid.k, kd = k * dpr
    // the slab's near face, the cattle raid cut along it
    const [a0, a1] = [local(-4.95, -4.95), local(4.95, -4.95)], fc = [proj(...a0, 0), proj(...a1, 0), proj(...a0, -0.3), proj(...a1, -0.3)]
    const fx0 = Math.min(...fc.map(p => p.x)), fx1 = Math.max(...fc.map(p => p.x)), fy0 = Math.min(...fc.map(p => p.y)), fy1 = Math.max(...fc.map(p => p.y))
    ctx.drawImage(kd > 110 ? FRIEZE.hi : FRIEZE.lo, fx0, fy0, fx1 - fx0, fy1 - fy0)
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0)
    // the frame, a running scroll cut along it
    poly(quad(-0.45, -0.45, 9.45, 9.45, 0)); ctx.fillStyle = '#8a7d63'; ctx.fill()
    ctx.strokeStyle = 'rgba(255,240,210,0.25)'; ctx.lineWidth = Math.max(0.6, k * 0.02); ctx.stroke()
    if (kd > 90) {
      ctx.strokeStyle = 'rgba(40,30,18,0.55)'; ctx.lineWidth = Math.max(0.5, k * 0.012)
      const scroll = (u0, along, across, flip) => {
        const pts = []
        for (let i = 0; i <= 16; i++) { const t = i / 16, a = t * Math.PI * 2.2, r = 0.16 * (1 - t * 0.75); pts.push([u0 + 0.5 + Math.cos(a) * r * flip, Math.sin(a) * r]) }
        pline(pts.map(([u, v]) => along(u, v)))
        ctx.stroke()
      }
      for (let i = -0.45, n = 0; i < 9.4; i += 1, n++) {
        scroll(i, (u, v) => [u, -0.225 + v * 0.9], 0, n % 2 ? 1 : -1)
        scroll(i, (u, v) => [u, 9.225 + v * 0.9], 0, n % 2 ? -1 : 1)
        scroll(i, (u, v) => [-0.225 + v * 0.9, u], 0, n % 2 ? 1 : -1)
        scroll(i, (u, v) => [9.225 + v * 0.9, u], 0, n % 2 ? -1 : 1)
      }
    }
    // the squares
    const tex = kd > 70 ? TEX.hi : TEX.lo
    for (let r = 8; r >= 0; r--) for (let f = 0; f < 9; f++) {
      const gate = (f === 0 || f === 8) && (r === 0 || r === 8), well = f === 4 && r === 4
      const t = gate ? 'gate0' : well ? 'well0' : ((f + r) % 2 ? 'lt' : 'dk') + ((hash2(f, r) * 6) | 0)
      const c = [proj(f, r, 0), proj(f + 1, r, 0), proj(f + 1, r + 1, 0), proj(f, r + 1, 0)].sort((p, q) => p.y - q.y)
      const top = (c[0].y + c[1].y) / 2, bot = (c[2].y + c[3].y) / 2
      const left = (Math.min(c[0].x, c[1].x) + Math.min(c[2].x, c[3].x)) / 2, right = (Math.max(c[0].x, c[1].x) + Math.max(c[2].x, c[3].x)) / 2
      ctx.drawImage(tex[t], left, top, right - left, bot - top)
    }
    ctx.strokeStyle = 'rgba(36,28,18,0.6)'
    for (let i = 0; i <= 9; i++) {
      const a = proj(i, 0, 0), b = proj(i, 9, 0), c = proj(0, i, 0), d = proj(9, i, 0)
      ctx.lineWidth = Math.max(0.5, a.k * 0.02); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      ctx.lineWidth = Math.max(0.5, c.k * 0.02); ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke()
    }
    if (kd > 150) for (let i = 1; i < 9; i++) for (let j = 1; j < 9; j++) if (hash2(i + 40, j) < 0.3) {   // moss where the joints meet
      for (let m = 0; m < 4; m++) { const p = proj(i + (hash2(i, j + m) - 0.5) * 0.08, j + (hash2(j, i + m) - 0.5) * 0.06, 0); ctx.fillStyle = `rgba(${60 + m * 8},${92 + m * 6},44,0.8)`; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.k * 0.018, p.k * 0.018 * sp, 0, 0, 6.283); ctx.fill() }
    }
    // the well: dark water, the fire caught on it, a ring now and then
    const w = proj(4.5, 4.5, 0), rx = 0.36 * w.k, ry = rx * sp
    let gr = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, rx); gr.addColorStop(0, '#0e1a22'); gr.addColorStop(1, '#05090c')
    ctx.save(); ctx.translate(w.x, w.y); ctx.scale(1, sp); ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.283); ctx.restore(); ctx.fillStyle = gr; ctx.fill()
    ctx.strokeStyle = 'rgba(30,22,14,0.8)'; ctx.lineWidth = Math.max(0.8, w.k * 0.03); ctx.stroke()
    ctx.save(); ctx.translate(w.x, w.y); ctx.scale(1, sp); ctx.beginPath(); ctx.arc(0, 0, rx * 0.86, fireSide < 0 ? Math.PI * 1.05 : Math.PI * 1.55, fireSide < 0 ? Math.PI * 1.45 : Math.PI * 1.95); ctx.restore()
    ctx.strokeStyle = `rgba(255,170,90,${0.35 * flick})`; ctx.lineWidth = Math.max(0.6, w.k * 0.02); ctx.stroke()
    const ring = (now / 4200) % 1
    if (kd > 80) { ctx.save(); ctx.translate(w.x - fireSide * rx * 0.2, w.y - ry * 0.1); ctx.scale(1, sp); ctx.beginPath(); ctx.arc(0, 0, rx * 0.7 * ring, 0, 6.283); ctx.restore(); ctx.strokeStyle = `rgba(160,190,210,${0.3 * (1 - ring)})`; ctx.lineWidth = Math.max(0.5, w.k * 0.008); ctx.stroke() }
  }

  function shadowOf(P, q) {
    const s = 0.3 + 0.05 * flick, p = proj(q.x - FIRE[0] * s, q.y - FIRE[1] * s, 0); if (!p) return
    const h = KINDS[P.kind].h / 130, z = Math.min(0.9, q.z), rx = (0.36 + 0.28 * h) * p.k * (1 - z * 0.4), ry = 0.26 * p.k * sp
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, ry / rx)
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, `rgba(0,0,0,${0.42 - z * 0.3})`); gr.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.283); ctx.fill(); ctx.restore()
  }
  function drawPiece(P, q, tilt = 0) {
    const p = proj(q.x, q.y, q.z); if (!p) return
    const hi = p.k * dpr > 150, spr = hi ? SPR[P.kind].hi : SPR[P.kind].lo, sc = p.k / spr.res
    const top = p.y - spr.fy * sc, w = spr.c.width * sc, h = spr.c.height * sc
    ctx.save(); ctx.translate(p.x, top)
    if (tilt) {                                         // held from above, it swings a little: turn it about its top
      ctx.rotate(tilt); ctx.scale(mx, 1)
      ctx.shadowColor = 'rgba(255,190,110,0.55)'; ctx.shadowBlur = 0.25 * p.k
      ctx.drawImage(spr.c, -spr.fx * sc, 0, w, h); ctx.restore(); return
    }
    ctx.scale(mx, 1)
    ctx.drawImage(spr.c, -spr.fx * sc, 0, w, h)
    const haze = smooth(-2, 5.5, depth(q.x, q.y)) * 0.26
    if (haze > 0.01) { ctx.globalAlpha = haze; ctx.drawImage(hi ? FOG[P.kind].hi : FOG[P.kind].lo, -spr.fx * sc, 0, w, h) }
    ctx.restore()
  }
  function drawWren(now) {
    let at, face = wren.face, flying = false
    if (wren.on) at = perchOf(wren.on, now)
    else if (wren.to) {
      const a = perchOf(wren.from, now), b = perchOf(wren.to, now), u = clamp((now - wren.t0) / 900, 0, 1)
      if (!a || !b) return
      at = { x: a.x + (b.x - a.x) * ease(u), y: a.y + (b.y - a.y) * ease(u) - Math.sin(Math.PI * u) * 0.7 * b.k, k: b.k }
      face = b.x > a.x ? -1 : 1; flying = u < 1
      if (u >= 1) { wren.on = wren.to; wren.to = null; wren.face = face; wren.until = now + 6000 + Math.random() * 10000 }
    }
    if (!at) return
    const img = WREN[(now % 2600 < 260 || flying) ? 1 : 0], w = 0.18 * at.k, h = w * img.height / img.width
    if (w < 1.2) return
    ctx.save(); ctx.translate(at.x, at.y); ctx.scale(face, 1)
    if (flying) ctx.rotate(-0.25)
    ctx.drawImage(img, -w / 2, -h * 15.8 / 16, w, h); ctx.restore()
  }
  function drawMist(m, now) {
    const p = proj(m.x, m.y, 0.22); if (!p) return
    const zf = smooth(1.2, 3.2, cam.z), a = (0.1 + 0.34 * zf) * (0.5 + 0.5 * clamp((depth(m.x, m.y) + 4.5) / 10, 0, 1)) * (0.7 + 0.3 * Math.sin(now / 3100 + m.ph))
    const rx = m.w * p.k / 2, ry = rx * 0.3
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, ry / rx)
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, `rgba(196,198,204,${a})`); gr.addColorStop(0.6, `rgba(190,192,200,${a * 0.45})`); gr.addColorStop(1, 'rgba(190,192,200,0)')
    ctx.fillStyle = gr; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore()
  }

  function drawOpponent() {
    if (!opponent) return
    A.OPP = A.OPP || paintOpponent(60)
    const p = proj(...local(0, 8.9), -0.35), w = 15 * p.k, h = 13 * p.k
    ctx.drawImage(A.OPP, p.x - w / 2, p.y - h, w, h)
  }

  function frame(now) {
    if (closed) return
    requestAnimationFrame(frame)
    if (!A) return
    const dt = Math.min(0.05, (now - (frame.last || now)) / 1000); frame.last = now
    flick = 0.88 + 0.08 * Math.sin(now / 130) * Math.sin(now / 370 + 1) + 0.04 * Math.sin(now / 53)
    for (const m of mist) { m.x += m.sp * dt; if (m.x > 13) m.x = -4 }
    for (const s of wisps) { s.x += s.sp * dt; if (s.x > 1.4) s.x = -0.4 }
    if (wren.on && now > wren.until && wren.until) wrenFlyOff(now)
    if (!wren.until) wren.until = now + 4000

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0a0807'; ctx.fillRect(0, 0, W, H)
    const hX = fireSide < 0 ? -0.2 * W : 1.2 * W, hY = 0.12 * H, hg = ctx.createRadialGradient(hX, hY, 0, hX, hY, Math.max(W, H) * 0.9)
    hg.addColorStop(0, `rgba(255,130,50,${0.2 * flick})`); hg.addColorStop(1, 'rgba(255,130,50,0)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H)
    drawTable(now)
    drawOpponent()
    drawBoard(now)
    // the pieces and the mist, far to near; the one in your hand last
    const items = []
    for (const P of pieces) if (P !== held || P.anim) { const q = posOf(P, now); items.push({ d: depth(q.x, q.y) - (P.anim ? 0.01 : 0), P, q }) }
    for (const P of pieces) if (P !== held) shadowOf(P, items.find(i => i.P === P).q)
    for (const m of mist) items.push({ d: depth(m.x, m.y), m })
    items.sort((a, b) => b.d - a.d)
    for (const it of items) {
      if (it.m) drawMist(it.m, now)
      else { drawPiece(it.P, it.q); if (wren.on === it.P) drawWren(now) }
    }
    if (held && !held.anim) {
      const q = posOf(held, now), o = proj(q.x, q.y, 0), rr = 0.42 * o.k
      ctx.save(); ctx.translate(o.x, o.y); ctx.scale(1, sp); ctx.beginPath(); ctx.arc(0, 0, rr, 0, 6.283); ctx.restore()
      ctx.strokeStyle = `rgba(245,200,110,${0.45 + 0.15 * Math.sin(now / 300)})`; ctx.lineWidth = Math.max(1, o.k * 0.03); ctx.stroke()
      shadowOf(held, { x: q.x, y: q.y, z: Math.min(0.9, q.z) }); drawPiece(held, q, 0.05 * Math.sin(now / 520)); if (wren.on === held) drawWren(now)
    }
    if (!wren.on) drawWren(now)
    // close in, and the air between shows: wisps go by
    const wz = smooth(1.8, 5, cam.z)
    if (wz > 0.01) for (const s of wisps) {
      const x = s.x * W, y = s.y * H, r = s.s * Math.max(W, H) * 0.6
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(200,200,206,${0.16 * wz})`); gr.addColorStop(1, 'rgba(200,200,206,0)')
      ctx.save(); ctx.translate(x, y); ctx.scale(1.8, 0.5); ctx.translate(-x, -y); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore()
    }
    // the fire's light from the west, the dark to the east and round about
    let gr = fireSide < 0 ? ctx.createLinearGradient(0, 0, W, 0) : ctx.createLinearGradient(W, 0, 0, 0)
    gr.addColorStop(0, `rgba(255,150,70,${0.12 * flick})`); gr.addColorStop(0.45, 'rgba(255,150,70,0)'); gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.34 - 0.1 * (flick - 0.88)})`)
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)
    const c = proj(4.5, 4.5, 0), R = Math.max(W, H)
    gr = ctx.createRadialGradient(c.x + fireSide * W * 0.08, c.y, R * 0.18, c.x, c.y, R * 0.85); gr.addColorStop(0, 'rgba(6,4,3,0)'); gr.addColorStop(1, 'rgba(6,4,3,0.82)')
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)
    if (looking) drawLook(now)
  }

  // ── looking at a piece: brought close, by the fire, its name ──────────────────────────────────────────────
  function look(P) {
    const K = KINDS[P.kind], res = Math.round(clamp(0.66 * H * dpr / ((K.h + 31) / 100), 200, 900) / 20) * 20, key = P.kind + ':' + res
    A.LOOK = A.LOOK || {}; A.LOOK[key] = A.LOOK[key] || paintPiece(P.kind, res)      // kept: the second look is quick
    looking = { P, t0: performance.now(), spr: A.LOOK[key], out: 0 }
  }
  function drawLook(now) {
    const L = looking, u = L.out ? 1 - clamp((now - L.out) / 220, 0, 1) : clamp((now - L.t0) / 260, 0, 1)
    if (L.out && u <= 0) { looking = null; return }
    ctx.fillStyle = `rgba(8,6,4,${0.82 * u})`; ctx.fillRect(0, 0, W, H)
    const s = L.spr, sc = (0.66 * H) / s.c.height * (0.94 + 0.06 * ease(u)), w = s.c.width * sc, h = s.c.height * sc
    ctx.save(); ctx.globalAlpha = u
    ctx.translate(W / 2, H * 0.84); ctx.rotate(0.012 * Math.sin(now / 1700)); ctx.scale(mx, 1)
    ctx.drawImage(s.c, -s.fx * sc, -s.fy * sc, w, h)
    ctx.restore()
    const gX = fireSide < 0 ? W * 0.1 : W * 0.9, gl = ctx.createRadialGradient(gX, H * 0.55, 0, gX, H * 0.55, H * 0.6)
    gl.addColorStop(0, `rgba(255,150,70,${0.16 * flick * u})`); gl.addColorStop(1, 'rgba(255,150,70,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H)
    const K = KINDS[L.P.kind]
    ctx.globalAlpha = u; ctx.textAlign = 'center'
    ctx.fillStyle = '#efe6d2'; ctx.font = `${Math.round(Math.min(W, H) * 0.09)}px ${FONTS.irish}`; ctx.fillText(K.ga, W / 2, H * 0.13)
    const en = GameSettings.englishOpacity ?? 0.15
    if (en > 0.01) { ctx.globalAlpha = u * en; ctx.fillStyle = '#efe6d2'; ctx.font = `${Math.round(Math.min(W, H) * 0.038)}px ${FONTS.english}`; ctx.fillText(K.en, W / 2, H * 0.13 + Math.min(W, H) * 0.068) }
    ctx.globalAlpha = 1
  }

  // ── touch ─────────────────────────────────────────────────────────────────────────────────────────────────
  function pieceAt(sx, sy, now) {
    const order = pieces.filter(P => P !== held && !P.anim).sort((a, b) => depth(a.x, a.y) - depth(b.x, b.y))
    for (const P of order) {
      const p = proj(P.x, P.y, 0), spr = SPR[P.kind].lo, sc = p.k / spr.res
      const lx = Math.floor(mx * (sx - p.x) / sc + spr.fx), ly = Math.floor((sy - p.y) / sc + spr.fy)
      if (lx >= 0 && ly >= 0 && lx < spr.c.width && ly < spr.c.height && MASK[P.kind][ly * spr.c.width + lx] > 30) return P
    }
    const w = unproject(sx, sy)
    if (w && onBoard(w.x, w.y)) return order.find(P => Math.floor(P.x) === Math.floor(w.x) && Math.floor(P.y) === Math.floor(w.y)) || null
    return null
  }
  function hitsHeld(sx, sy, now) {
    if (!held) return false
    const q = posOf(held, now), p = proj(q.x, q.y, q.z), spr = SPR[held.kind].lo, sc = p.k / spr.res
    const lx = (sx - p.x) / sc + spr.fx, ly = (sy - p.y) / sc + spr.fy
    return lx >= -10 && ly >= -10 && lx < spr.c.width + 10 && ly < spr.c.height + 10
  }
  function tap(sx, sy) {
    if (!A) return
    const now = performance.now()
    if (looking) { if (!looking.out) looking.out = now; return }
    if (held) {
      if (hitsHeld(sx, sy, now)) { look(held); return }
      const P = pieceAt(sx, sy, now)
      if (P) { setDown(held, held.x, held.y); lift(P); return }
      const w = unproject(sx, sy); if (!w) return
      const at = placeFor(held, w.x, w.y); if (at) setDown(held, at.x, at.y)
      return
    }
    const P = pieceAt(sx, sy, now); if (P) lift(P)
  }

  const pts = new Map(); let gest = null
  const mid = () => { const a = [...pts.values()]; return { x: a.reduce((s, p) => s + p.x, 0) / a.length, y: a.reduce((s, p) => s + p.y, 0) / a.length, d: a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0 } }
  // keep the board point that was under (mx, my) there
  function hold(wpt, mx, my) { for (let i = 0; i < 3; i++) { const now = unproject(mx, my); if (!now) return; cam.tx += wpt.x - now.x; cam.ty += wpt.y - now.y } }
  function begin() {
    const m = mid(); gest = { n: pts.size, z0: cam.z, d0: m.d, w: unproject(m.x, m.y), x0: m.x, y0: m.y, moved: false, t0: performance.now() }
  }
  cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId) } catch (_) {} pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); begin() })
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !gest) return
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const m = mid()
    if (!gest.moved && Math.hypot(m.x - gest.x0, m.y - gest.y0) < 8 && !(pts.size > 1 && Math.abs(m.d - gest.d0) > 8)) return
    gest.moved = true
    if (looking) return
    if (pts.size > 1 && gest.d0 > 0) { cam.z = gest.z0 * m.d / gest.d0; clampView() }
    if (gest.w) hold(gest.w, m.x, m.y)
    clampView()
  })
  const end = e => {
    if (!pts.has(e.pointerId)) return
    pts.delete(e.pointerId)
    if (gest && !gest.moved && gest.n === 1 && pts.size === 0 && performance.now() - gest.t0 < 600) tap(e.clientX, e.clientY)
    if (pts.size) { begin(); gest.moved = true } else gest = null      // a finger left of a pinch is not a tap
  }
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end)
  cv.addEventListener('wheel', e => {
    e.preventDefault(); if (looking) return
    const w = unproject(e.clientX, e.clientY); cam.z *= Math.exp(-e.deltaY * 0.0015); clampView(); if (w) hold(w, e.clientX, e.clientY); clampView()
  }, { passive: false })

  // ── open, close ───────────────────────────────────────────────────────────────────────────────────────────
  let closed = false
  const onResize = () => fit()
  addEventListener('resize', onResize)
  function close() {
    if (closed) return
    closed = true; removeEventListener('resize', onResize)
    root.classList.remove('on'); setTimeout(() => root.remove(), 350)
    if (scene) { scene._ficheallOpen = false; scene.events?.off?.('shutdown', close); scene.joystick?.showDirections?.() }
    onClose?.()
  }
  bx.onclick = close
  if (scene) { scene._ficheallOpen = true; scene.joystick?.hideDirections?.(); scene.events?.once?.('shutdown', close) }
  fit(); requestAnimationFrame(() => root.classList.add('on'))
  setTimeout(() => { if (closed) return; ready(); requestAnimationFrame(frame) }, ART ? 0 : 140)
  return { close, setOpponent(v) { opponent = !!v }, get opponent() { return opponent }, side, _view: { proj, pieces, cam, get held() { return held }, get looking() { return looking } } }
}
