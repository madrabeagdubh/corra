// ficheallEngine.js
//
// The rules and the AI of the board game on Fergus's table (ficheall.js draws it). A 9x9 board: the centre square
// is the well, where the king starts and is safe; the four corners are the gates, and he wins by reaching one. His
// eight swordsmen and he step one square any way. The host moves first, its pieces as in chess (footmen step one
// square any way); a piece takes by landing on an enemy, and the host wins by landing on the king. Squares are
// i = file + 9 * rank, rank 0 at the bottom. A move is from * 128 + to.
export const T = { K: 1, S: 2, R: 3, B: 4, Q: 5, N: 6, W: 7, C: 8 }
const DEF = new Set([1, 2])
const N9 = 9, NSQ = 81, WELL = 40, WIN = 100000, INF = 1e9
const fx = i => i % 9, ry = i => (i / 9) | 0, inB = (f, r) => f >= 0 && f < 9 && r >= 0 && r < 9, idx = (f, r) => f + 9 * r
const isGate = new Uint8Array(NSQ); for (const g of [0, 8, 72, 80]) isGate[g] = 1
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]
const ray = (i, [dx, dy]) => { const o = []; let f = fx(i) + dx, r = ry(i) + dy; while (inB(f, r)) { o.push(idx(f, r)); f += dx; r += dy } return o }
const step = (i, dirs) => dirs.map(([dx, dy]) => [fx(i) + dx, ry(i) + dy]).filter(([f, r]) => inB(f, r)).map(([f, r]) => idx(f, r))
const OR = [], DR = [], K8 = [], K4 = [], NJ = []
for (let i = 0; i < NSQ; i++) { OR[i] = ORTH.map(d => ray(i, d)); DR[i] = DIAG.map(d => ray(i, d)); K8[i] = step(i, [...ORTH, ...DIAG]); K4[i] = step(i, ORTH); NJ[i] = step(i, KN) }
export const VAL = { 2: 260, 3: 500, 4: 320, 5: 900, 6: 310, 7: 120, 8: 260 }
export const RULES = { dawn: 120 }                       // plies: sixty moves each, then dawn and the host holds the field

export function setup(host, squad = 'ring8') {
  const b = new Int8Array(NSQ)
  b[WELL] = T.K
  const ring = squad === 'ring8' ? K8[WELL] : squad === 'cross4' ? K4[WELL] : K8[WELL].filter(j => !K4[WELL].includes(j))
  for (const j of ring) b[j] = T.S
  // host: list of [f, r, type] on the south side, rotated to all four sides
  // host is either one side's list (repeated on all four sides) or four lists, one per side
  const sides = Array.isArray(host[0][0]) ? host : [host, host, host, host]
  sides.forEach((list, q) => { for (const [f, r, t] of list) { let x = f, y = r; for (let k = 0; k < q; k++) [x, y] = [8 - y, x]; b[idx(x, y)] = T[t] } })
  return { b, side: 0, ks: WELL, kt: 0 }
}
const isDef = t => t === 1 || t === 2
const mine = (t, side) => t !== 0 && (side === 1 ? isDef(t) : !isDef(t))
function land(b, j, side, king) {
  if (j === WELL) return king && !b[j] ? 1 : 0
  if (isGate[j] && !king) return 0
  const t = b[j]; if (!t) return 1
  return mine(t, side) ? 0 : 2
}
export function genMoves(S, out) {
  const b = S.b, side = S.side; let n = 0
  for (let i = 0; i < NSQ; i++) {
    const t = b[i]; if (!mine(t, side)) continue
    const king = t === 1
    if (t === 1 || t === 2 || t === 8) { for (const j of K8[i]) if (land(b, j, side, king)) out[n++] = i * 128 + j }
    else if (t === 7) { for (const j of K4[i]) if (land(b, j, side, false)) out[n++] = i * 128 + j }
    else if (t === 6) { for (const j of NJ[i]) if (land(b, j, side, false)) out[n++] = i * 128 + j }
    else {
      const rays = t === 3 ? OR[i] : t === 4 ? DR[i] : [...OR[i], ...DR[i]]
      for (const rr of rays) for (const j of rr) { if (j === WELL || isGate[j]) break; const l = land(b, j, side, false); if (l) out[n++] = i * 128 + j; if (b[j]) break }
    }
  }
  return n
}
export function make(S, mv, caps) {
  const from = (mv / 128) | 0, to = mv % 128, b = S.b, t = b[from]; let c = 0
  if (b[to]) { caps.push(to * 16 + b[to]); if (b[to] === 1) S.kt = 1; c = 1 }
  b[to] = t; b[from] = 0; if (t === 1) S.ks = to
  S.side ^= 1; return c
}
export function unmake(S, mv, c, caps) {
  S.side ^= 1; S.kt = 0
  const from = (mv / 128) | 0, to = mv % 128, b = S.b, t = b[to]
  b[from] = t; b[to] = 0; if (t === 1) S.ks = from
  for (let k = 0; k < c; k++) { const v = caps.pop(); b[(v / 16) | 0] = v % 16 }
}
export function result(S) { if (isGate[S.ks]) return 'king'; if (S.kt) return 'host'; return null }

function attacked(b, s) {                       // is square s attacked by the host?
  for (const j of K8[s]) if (b[j] === 8) return true
  for (const j of K4[s]) if (b[j] === 7) return true
  for (const j of NJ[s]) if (b[j] === 6) return true
  for (const rr of OR[s]) for (const j of rr) { if (j === WELL) break; const t = b[j]; if (t) { if (t === 3 || t === 5) return true; break } }
  for (const rr of DR[s]) for (const j of rr) { if (j === WELL) break; const t = b[j]; if (t) { if (t === 4 || t === 5) return true; break } }
  return false
}
const dist = new Int8Array(NSQ), q = new Int8Array(NSQ)
function race(b, ks) {
  dist.fill(-1); let h = 0, t = 0; q[t++] = ks; dist[ks] = 0; let best = 99
  while (h < t) { const u = q[h++]; for (const v of K8[u]) { if (dist[v] >= 0 || (b[v] && !isDef(b[v]))) continue; dist[v] = dist[u] + 1; if (isGate[v]) { if (dist[v] < best) best = dist[v]; continue } q[t++] = v } }
  return best
}
function evaluate(S) {
  const b = S.b; let e = 0, esc = 0
  for (let i = 0; i < NSQ; i++) { const t = b[i]; if (t > 1) e += isDef(t) ? -VAL[t] : VAL[t] }
  if (S.ks !== WELL) for (const j of K8[S.ks]) if (b[j] === 2) esc++
  e -= esc * 18
  const d = race(b, S.ks)
  if (d >= 99) e += 220; else { e -= (12 - Math.min(d, 12)) * 32; if (d === 1) e -= S.side === 1 ? 800 : 200 }
  if (S.ks !== WELL && attacked(b, S.ks)) e += S.side === 0 ? 1500 : 150
  return e
}
const MAXPLY = 32, MOVES = Array.from({ length: MAXPLY + 1 }, () => new Int32Array(400)), SC = Array.from({ length: MAXPLY + 1 }, () => new Int32Array(400))
const KILL = new Int32Array((MAXPLY + 1) * 2), caps = []
let nodes = 0, deadline = 0, abort = false
function ord(S, mv, ply) { const to = mv % 128, t = S.b[(mv / 128) | 0]; let s = 0; if (mv === KILL[ply * 2] || mv === KILL[ply * 2 + 1]) s += 400; if (S.b[to]) s += S.b[to] === 1 ? 1e6 : 2000 + VAL[S.b[to]]; if (t === 1 && isGate[to]) s += 2e6; return s }
function negamax(S, depth, alpha, beta, ply) {
  if ((++nodes & 1023) === 0 && performance.now() > deadline) abort = true
  if (abort) return 0
  if (isGate[S.ks]) return S.side === 1 ? WIN - ply : -(WIN - ply)
  if (S.kt) return -(WIN - ply)
  if (depth <= 0 || ply >= MAXPLY) return (S.side === 0 ? 1 : -1) * evaluate(S)
  const mv = MOVES[ply], sc = SC[ply], n = genMoves(S, mv)
  if (!n) return -(WIN - ply)
  for (let k = 0; k < n; k++) sc[k] = ord(S, mv[k], ply)
  let best = -INF
  for (let k = 0; k < n; k++) {
    let bi = k; for (let j = k + 1; j < n; j++) if (sc[j] > sc[bi]) bi = j
    const m = mv[bi]; mv[bi] = mv[k]; mv[k] = m; const s0 = sc[bi]; sc[bi] = sc[k]; sc[k] = s0
    const c = make(S, m, caps); const v = -negamax(S, depth - 1, -beta, -alpha, ply + 1); unmake(S, m, c, caps)
    if (abort) return 0
    if (v > best) best = v
    if (v > alpha) { alpha = v; if (alpha >= beta) { if (m !== KILL[ply * 2]) { KILL[ply * 2 + 1] = KILL[ply * 2]; KILL[ply * 2] = m } break } }
  }
  return best
}
export function think(S0, level) {
  const S = { b: new Int8Array(S0.b), side: S0.side, ks: S0.ks, kt: 0 }, root = new Int32Array(400), n = genMoves(S, root)
  if (!n) return null
  for (let k = 0; k < n; k++) { const to = root[k] % 128; if ((S.b[(root[k] / 128) | 0] === 1 && isGate[to]) || S.b[to] === 1) return { move: root[k], depth: 0 } }
  KILL.fill(0); nodes = 0; abort = false; deadline = performance.now() + level.ms
  let order = Array.from(root.slice(0, n)), best = order[0], reached = 0
  const noise = new Map(order.map(m => [m, level.noise ? (Math.random() - 0.5) * level.noise : 0]))
  for (let depth = 1; depth <= level.maxDepth; depth++) {
    let alpha = -INF, ib = null, is = -INF; const sc = []
    for (const m of order) { const c = make(S, m, caps); let v = -negamax(S, depth - 1, -INF, -alpha, 1); unmake(S, m, c, caps); if (abort) break; v += noise.get(m); sc.push([m, v]); if (v > is) { is = v; ib = m } if (v > alpha) alpha = v }
    if (abort) break
    best = ib; reached = depth; sc.sort((a, b) => b[1] - a[1]); order = sc.map(x => x[0])
    if (Math.abs(is) > WIN - 100) break
  }
  return { move: best, depth: reached, nodes }
}
export function hasMoves(S) { return genMoves(S, new Int32Array(400)) > 0 }

export function legalFrom(S, from) {
  const out = new Int32Array(400), n = genMoves(S, out), res = []
  for (let k = 0; k < n; k++) if (((out[k] / 128) | 0) === from) res.push(out[k] % 128)
  return res
}
export function kingThreatened(S) { return S.ks !== WELL && attacked(S.b, S.ks) }
export const G9 = { WELL, isGate, isDef }
