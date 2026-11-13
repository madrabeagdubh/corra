// starSky.js -- the host in the sky: choosing a champion by turning the night sky.
//
// Thousands of stars, and among them 300 small constellations, one for each champion, their names set by them as on a star
// chart. We stand on the back of a great stone bull looking where he looks; the finger wheels the sky (drag; flick and it
// coasts). The constellation at the sight, above his horns, is lit: its name rises high in the sky in starlight with the
// champion dancing over it, and its name stands gold by its stars too.
//
// The opening: the moon hangs big and dark in an empty night, waiting for a touch. Any touch wakes it: it flares, the harp
// runs up, and the game's name strikes in gold, its English coming up under it as the moon fills (hold the moon and it
// fills slowly; swipe it, right or up for more). The sky can be turned at once (anywhere off the moon). The name fades
// (after a while, or as soon as the sky is turned) as the moon shrinks up and aside into the sky, one body among the stars,
// which the sky can be turned away from, and the land comes up. Below, where
// the moon tile always sits, a small pool: it ripples while the sky turns, and when it stops it settles on the moon's
// reflection, whether the moon is overhead or not. Either moon, swiped or held, sets the English. Touch the pool to take
// the champion at the sight: its ripples settle on that champion's sign, and we go down into the water.
//
// The music is a session the sky steers: a steady pulse, the tune of the champion at the sight
// on the harp with a low left hand under it, whole at rest, thinner and ringing as the sky turns with a wind rising, each new tune coming in
// at a bar line and taken up where it was left.
//
// Each champion's constellation is made once from its name and is always the same: it is the champion's sign
// (championSign() gives it, for drawing elsewhere).
//
//   import { initStarSky } from './starSky.js'
//   const sky = initStarSky({ champions, onChoose: (champion, sign) => { ... } })      // (opening: false to start at the sky)
//   sky.destroy()

import { allTunes } from './game/systems/music/allTunes.js'
import { parseAbcToNotes } from './game/systems/music/abcToPhrase.js'
import { FONTS } from './game/systems/gameTypography.js'
import { hopMsForTuneKey } from './game/effects/championDance.js'
import { getTuneKeyForChampion } from './game/systems/music/championTuneMapping.js'
import { LANDS } from './skyLands.js'
import { paintSkyGradient } from './game/systems/nightPalette.js'

const FOV = 62 * Math.PI / 180          // across the screen
const N_BG = 7000                       // faint stars between the constellations, clustered by a noise over the sky
const N_BAND = 3600                     // and more of them, crowded along a band across the sky
const N_DUST = 260                      // soft glows where the stars are thickest
const N_MYST = 90                       // the sky's own constellations, not anyone's: faint lines among the faint stars
const GOLD = '#e9c46a'
const STAR = '#f1eeff', STAR_GLOW = '#b9b0ff'                 // names: bright cold starlight, a touch of lavender
const GA = 'Aonchlo, Urchlo, Georgia, serif'               // the Irish
const EN = FONTS.english                                    // the English, as everywhere else in the game
const MOON_DIR = [0.29987, 0.54975, 0.77965]                   // the moon's place in the sky (see the room left for it)
const MOON_ROOM = 0.36                                       // the radius of the empty cap round it (radians)
const LINE_R = 0.6                                          // how far from the sight the champions' lines still show (radians)
// the sky's tune: each constellation that comes to the sight plays its next note
const POC = `X: 1
T: An Poc Ar Buile
R: march
M: 4/4
L: 1/8
K: Dmaj
Add3 ddd dd3|cd e3 dcAAd3|
def3 edc AA3|GAAAG EFGE|
FDD2 CDE2|FDDD EFGE|
FDD2 A,DD2|d5 d2 c5|AGE2 FD4`

// ── numbers ──────────────────────────────────────────────────────────────────────────────────────
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const mul = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]
const tmul = (M, v) => [M[0] * v[0] + M[3] * v[1] + M[6] * v[2], M[1] * v[0] + M[4] * v[1] + M[7] * v[2], M[2] * v[0] + M[5] * v[1] + M[8] * v[2]]   // (by the transpose: back from the eye to the sky)
const mmul = (A, B) => { const C = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return C }
function axisAngle(ax, a) {
  const [x, y, z] = norm(ax), c = Math.cos(a), s = Math.sin(a), t = 1 - c
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c]
}
function orthonormal(M) {   // keep the rotation a rotation after many small turns
  let a = norm([M[0], M[3], M[6]]), b = [M[1], M[4], M[7]]
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; b = norm([b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]])
  const c = cross(a, b)
  return [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]]
}

// ── a smooth noise over the sky (value noise in 3D, a few octaves), for where the stars crowd ──────────────────────
function noise3(seed) {
  const H = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 974634) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296 }
  const sm = (t) => t * t * (3 - 2 * t)
  const one = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi)
    const l = (a, b, t) => a + (b - a) * t
    return l(l(l(H(xi, yi, zi), H(xi + 1, yi, zi), xf), l(H(xi, yi + 1, zi), H(xi + 1, yi + 1, zi), xf), yf),
             l(l(H(xi, yi, zi + 1), H(xi + 1, yi, zi + 1), xf), l(H(xi, yi + 1, zi + 1), H(xi + 1, yi + 1, zi + 1), xf), yf), zf)
  }
  return (v) => { let s = 0, a = 0.5, f = 2.2, n = 0; for (let o = 0; o < 4; o++) { s += a * one(v[0] * f + 11, v[1] * f + 7, v[2] * f + 3); n += a; a *= 0.5; f *= 2.1 } return s / n }
}

// ── the sign: each champion's little constellation, from its name ───────────────────────────────
// 3 to 6 stars on a crooked walk, sometimes a branch or a closing line. In radians on the sky, centred.
export function championSign(champion) {
  const rnd = mulberry(hashStr(champion.nameGa || champion.id || 'x'))
  const n = 3 + Math.floor(rnd() * 4), pts = [[0, 0]], edges = []
  let a = rnd() * Math.PI * 2
  for (let i = 1; i < n; i++) {
    const L = 0.044 + rnd() * 0.04, p = pts[i - 1]
    let q, tries = 0
    do { a += (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 1.1); q = [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L]; tries++ }
    while (tries < 8 && pts.some(o => Math.hypot(o[0] - q[0], o[1] - q[1]) < 0.034))
    pts.push(q); edges.push([i - 1, i])
  }
  const k = rnd()
  if (n >= 4 && k < 0.22) edges.push([n - 1, 1])                                       // closes on itself
  else if (n >= 4 && k < 0.45) { const p = pts[1], b = a + 2.2; pts.push([p[0] + Math.cos(b) * 0.05, p[1] + Math.sin(b) * 0.05]); edges.push([1, pts.length - 1]) }   // a branch
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return { pts: pts.map(p => [p[0] - cx, p[1] - cy]), edges, mags: pts.map(() => 0.65 + rnd() * 0.35) }
}

// ── what kind of champion: from the stats, in Irish ──────────────────────────────────────────────
// [stat, adjective, the adjective after an- / after banlaoch (lenited), English]
const TRAITS = [
  ['health', 'crua', 'an-chrua', 'chrua', 'hardy'],
  ['attack', 'fíochmhar', 'an-fhíochmhar', 'fhíochmhar', 'fierce'],
  ['defense', 'daingean', 'an-daingean', 'dhaingean', 'steadfast'],
  ['speed', 'gasta', 'an-ghasta', 'ghasta', 'quick'],
  ['magic', 'draíochtúil', 'an-draíochtúil', 'dhraíochtúil', 'magical'],
  ['luck', 'ámharach', 'an-ámharach', 'ámharach', 'lucky'],
]
function describe(ch) {
  const st = ch.stats || {}, fem = (ch.pronouns?.ga?.subject || 'sé') === 'sí'
  const ranked = TRAITS.map(t => [t, st[t[0]] ?? 0]).sort((a, b) => b[1] - a[1])
  const top = ranked[0][0]
  const epithet = { ga: fem ? `Banlaoch ${top[3]}` : `Laoch ${top[1]}`, en: `A ${top[4]} ${fem ? 'heroine' : 'hero'}` }
  const pr = fem ? ['Tá sí', 'She is'] : ['Tá sé', 'He is']
  const lines = ranked.slice(0, 3).filter(([, v]) => v >= 5).map(([t, v]) => v >= 8
    ? { ga: `${pr[0]} ${t[2]}.`, en: `${pr[1]} very ${t[4]}.` }
    : { ga: `${pr[0]} ${t[1]}.`, en: `${pr[1]} ${t[4]}.` })
  return { epithet, lines, fem }
}

// ── the scene ─────────────────────────────────────────────────────────────────────────────────────
export function initStarSky({ champions, englishOpacity = 0.5, onChoose = () => {}, parent = document.body, tune = POC, stand = 'bull', opening = true, title = null, onWake = () => {} } = {}) {
  const host = champions.filter(c => c && c.nameGa)
  const N = host.length

  // where the constellations sit: spread over the whole sky, a little jittered; who sits where shuffled once. The moon has
  // its own place among them (MOON_DIR), and a cap of sky round it (MOON_ROOM, radians) is left empty, so the risen moon
  // never sits on a constellation or its name
  const rndP = mulberry(7), order = host.map((_, i) => i)
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rndP() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  const slots = []
  for (let T = N; slots.length < N; T++) {                              // (as many even places as it takes for N outside the cap)
    slots.length = 0
    for (let k = 0; k < T; k++) {
      const y = 1 - 2 * (k + 0.5) / T, r = Math.sqrt(1 - y * y), ph = k * Math.PI * (3 - Math.sqrt(5))
      const v = [Math.cos(ph) * r, y, Math.sin(ph) * r]
      if (v[0] * MOON_DIR[0] + v[1] * MOON_DIR[1] + v[2] * MOON_DIR[2] < Math.cos(MOON_ROOM)) slots.push(v)
    }
  }
  const cons = order.map((ci, k) => {
    const c = norm(slots[k].map(v => v + (rndP() - 0.5) * 0.03))
    const e1 = norm(cross(Math.abs(c[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], c)), e2 = cross(c, e1)
    const sign = championSign(host[ci])
    const stars = sign.pts.map(([u, v]) => norm([c[0] + e1[0] * u + e2[0] * v, c[1] + e1[1] * u + e2[1] * v, c[2] + e1[2] * u + e2[2] * v]))
    return { ch: host[ci], c, stars, sign, lit: 0 }
  })
  // the stars: thick where the noise is high, thin where it is low; and a band; and soft glows where they crowd
  const rndB = mulberry(11), bg = [], nz = noise3(5)
  const star = (v, m) => bg.push({ v, m: 0.48 + m * 0.52, s: 0.9 + m * 1.6, tw: rndB() * 6.28, tf: 0.5 + rndB() * 2.6 })
  const onSphere = () => { const z = rndB() * 2 - 1, t = rndB() * Math.PI * 2, r = Math.sqrt(1 - z * z); return [Math.cos(t) * r, z, Math.sin(t) * r] }
  for (let n = 0; n < N_BG;) { const v = onSphere(), d = nz(v); if (rndB() < Math.pow(Math.max(0, d - 0.25) / 0.5, 2.2) + 0.08) { star(v, Math.pow(rndB(), 3)); n++ } }
  const BN = norm([0.35, 0.8, 0.48]), B1 = norm(cross(BN, [0, 0, 1])), B2 = cross(BN, B1)
  for (let i = 0; i < N_BAND; i++) {
    const t = rndB() * Math.PI * 2, off = (rndB() + rndB() + rndB() - 1.5) * 0.16 * (0.6 + nz([Math.cos(t), Math.sin(t), 0.3]))
    star(norm([B1[0] * Math.cos(t) + B2[0] * Math.sin(t) + BN[0] * off, B1[1] * Math.cos(t) + B2[1] * Math.sin(t) + BN[1] * off, B1[2] * Math.cos(t) + B2[2] * Math.sin(t) + BN[2] * off]), Math.pow(rndB(), 4) * 0.8)
  }
  const dust = []
  for (let n = 0; n < N_DUST;) { const v = onSphere(), d = nz(v); if (d > 0.55 && rndB() < 0.5) { dust.push({ v, a: (d - 0.55) * 0.5, r: 0.06 + rndB() * 0.1, hue: rndB() }); n++ } }
  const myst = []
  for (let i = 0; i < N_MYST; i++) {
    const c = norm([rndB() * 2 - 1, rndB() * 2 - 1, rndB() * 2 - 1]), e1 = norm(cross(Math.abs(c[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], c)), e2 = cross(c, e1)
    const n = 4 + Math.floor(rndB() * 5), pts = [], edges = []; let u = 0, v = 0, a = rndB() * 6.28
    if (c[0] * MOON_DIR[0] + c[1] * MOON_DIR[1] + c[2] * MOON_DIR[2] > Math.cos(MOON_ROOM)) continue   // (none in the moon's room either)
    for (let j = 0; j < n; j++) { pts.push(norm([c[0] + e1[0] * u + e2[0] * v, c[1] + e1[1] * u + e2[1] * v, c[2] + e1[2] * u + e2[2] * v])); if (j) edges.push([j - 1, j]); a += (rndB() - 0.5) * 2.4; const L = 0.05 + rndB() * 0.07; u += Math.cos(a) * L; v += Math.sin(a) * L }
    if (rndB() < 0.3) edges.push([n - 1, Math.floor(n / 2)])
    myst.push({ pts, edges, m: pts.map(() => 0.4 + rndB() * 0.4) })
  }
  const BUCKETS = 12
  const dustSprite = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(150,170,230,0.5)'); gr.addColorStop(1, 'rgba(150,170,230,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c })()

  // the canvas, and the button below
  try { for (const fnt of ['48px IrishPenny', '24px Aonchlo', '24px Urchlo']) document.fonts?.load(fnt) } catch (e) { }   // (the canvas only draws with a font once it is loaded)
  const cv = document.createElement('canvas'); let g = cv.getContext('2d')        // (let: the dive draws aside, to a second canvas, for a moment)
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;touch-action:none;z-index:50;background:#02040b'
  parent.appendChild(cv)
  // the moon and the pool (see the top). `stage`: dark (waiting for a touch), title (the name up), rise (the name fading,
  // the moon shrinking up and aside, the land coming up), browse (the sky), dive (into the pool), under (in the water)
  const TITLE = title || { ga: ['Tóraíocht', 'na Féinne'], en: 'FENIAN QUEST' }
  let stage = opening ? 'dark' : 'browse', wakeT = 0, lastMoonT = 0, fadeT = 0, tiltT = 0, tiltDone = opening ? 1e-9 : 1, tiltLast = 0, flareT = -1e9, riseRot = null
  const RISE_TO = [0.22, 0.17], RISE_SHRINK = 0.55                     // (where the moon rises to, as fractions of the screen; how small it ends)
  if (opening) englishOpacity = 0
  let mdir = null, mR = 0, mdrag = null, poolShift = 0, calm = 1, dive = null, under = false
  const ripples = []
  const setPhase = (v) => { englishOpacity = Math.max(0, Math.min(1, v)) }
  // the champions themselves, from their sheet, to dance over the name
  const sheet = new Image(); let atlas = null
  sheet.src = 'assets/champions/champions-with-kit.png'
  fetch('assets/champions/champions0.json').then(r => r.json()).then(d => { atlas = d.textures?.[0]?.frames || null }).catch(() => {})
  const sprites = new Map()
  const spriteOf = (ch) => {
    if (sprites.has(ch)) return sprites.get(ch)
    if (!atlas || !sheet.complete || !sheet.naturalWidth || !ch.spriteKey) return null
    const fn = ch.spriteKey.endsWith('.png') ? ch.spriteKey : ch.spriteKey + '.png', fd = atlas.find(f => f.filename === fn)
    let c = null
    if (fd) { c = document.createElement('canvas'); c.width = fd.frame.w; c.height = fd.frame.h; c.getContext('2d').drawImage(sheet, fd.frame.x, fd.frame.y, fd.frame.w, fd.frame.h, 0, 0, fd.frame.w, fd.frame.h) }
    let hop = 600; try { hop = hopMsForTuneKey(getTuneKeyForChampion(ch)) } catch (e) { }
    const v = c && { c, hop }; sprites.set(ch, v); return v
  }
  const druid = new Image(), queen = new Image()
  druid.src = 'assets/nightscape/druid.png'; queen.src = 'assets/nightscape/queen.png'

  let W = 0, H = 0, DPR = 1, f = 1, PX = 0, PY = 0, L = {}, land = null
  function layout() {
    DPR = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0)
    f = (W / 2) / Math.tan(FOV / 2)
    const rr = Math.min(W * 0.09, H * 0.045)                        // the bull's head: far off, so not large
    const water = H * 0.84                                           // (below this the land covers the sky: no stars drawn)
    const tri = (v) => 1 - Math.abs(((v % 1) + 1) % 1 - 0.5) * 2
    const mtn = (x) => H * 0.765 - H * 0.055 * Math.pow(tri(x / W * 1.9 + 0.12), 1.6) - H * 0.03 * Math.pow(tri(x / W * 4.3 + 0.4), 2) - H * 0.006 * Math.sin(x * 0.07)
    const headY = H * 0.705                                          // the back of his skull, over the mountains
    PX = W / 2; PY = H * 0.5                                         // the sight: up where his horns lead the eye
    L = { rr, water, mtn, headY, tipY: headY - rr * 2.5, bull: [PX - rr * 3.7, headY - rr * 2.8, PX + rr * 3.7, H] }
    land = null                                                      // (the land is drawn once, to a canvas, then reused)
  }
  layout(); window.addEventListener('resize', layout)
  const moonR = () => Math.round(Math.min(W * 0.3, H * 0.18))
  const tileR = () => Math.max(24, Math.round(Math.min(W, H) * 0.055))
  // the pool: where the moon tile sits in the game (its centre STATUS_H + JOY_R = 102px up), wider than the tile and flat
  const pool = () => { const rx = Math.max(40, tileR() * 1.7); return { cx: PX, cy: H - 102 + landOff(), rx, ry: rx * 0.8 } }   // (nearly round: the moon tile, laid in the ground)
  const landOff = () => (1 - tiltDone) * H * 0.55
  const moonAt = () => mdir ? proj(mdir) : null

  let R = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  const toward = (c) => { const ax = cross(c, [0, 0, 1]), an = Math.acos(Math.max(-1, Math.min(1, c[2]))); return Math.hypot(...ax) > 1e-9 ? axisAngle(ax, an) : null }
  { const T = toward(opening ? MOON_DIR : cons[Math.floor(Math.random() * N)].c); if (T) R = T }   // (opening: the moon dead ahead)
  mdir = MOON_DIR
  const proj = (v) => { const c = mul(R, v); if (c[2] < 0.12) return null; return [PX + f * c[0] / c[2], PY - f * c[1] / c[2], c[2]] }

  // the finger: drag to wheel the sky; flick it and it coasts a long way, slowing gently (heavy: see FLICK, VMAX)
  // the sky is heavy: a flick adds only a part of the finger's speed to the sky's own, so it takes swipe on swipe to wind
  // it up, toward a top speed it can't pass; a swipe against its turning slows it; the finger drags it with a little lag
  const FLICK = 0.3, VMAX = 1.3, LAG = 70                            // (the share of a flick kept; top speed, px/ms; drag lag, ms)
  let drag = null, vx = 0, vy = 0, lastT = 0, actx = null, seek = -1, carry = [0, 0], pend = [0, 0]
  const turn = (dx, dy) => { R = mmul(mmul(axisAngle([1, 0, 0], dy / f), axisAngle([0, 1, 0], dx / f)), R) }
  // the sound wakes with a touch. A phone only lets it start on the touch's lifting (touchend, pointerup), not its first
  // press, and puts it back to sleep when the page is left; so every touch, and every return to the page, wakes it again
  function audio() {
    try {
      if (!actx) { actx = window.sharedAudioContext || new (window.AudioContext || window.webkitAudioContext)(); window.sharedAudioContext = actx }
      if (actx.state !== 'running') actx.resume?.().catch(() => {})
    } catch (e) { actx = null }
    return actx
  }
  const wakeAudio = () => audio()
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, wakeAudio, true)
  const onVis = () => { if (!document.hidden && actx) audio() }
  document.addEventListener('visibilitychange', onVis)
  // a finger on the moon or on the pool works them, not the sky: swipe for the phase (right or up for more), hold to fill
  function grabMoon(e) {
    if (stage === 'dive' || stage === 'under') return true                            // (nothing to touch now)
    const x = e.clientX, y = e.clientY
    let what = null
    if (stage === 'dark') what = 'moon'
    else if (stage === 'title') { const mp = moonAt(); if (mp && Math.hypot(x - mp[0], y - mp[1]) < mR * 1.1) what = 'moon' }
    else {
      const P = pool(), mp = moonAt()
      if (tiltDone > 0.6 && Math.pow((x - P.cx) / (P.rx * 1.45), 2) + Math.pow((y - P.cy) / (P.ry * 1.55), 2) < 1) what = 'pool'
      else if (mp && Math.hypot(x - mp[0], y - mp[1]) < mR * 1.05) what = 'moon'
    }
    if (!what) { if (stage === 'title') rise(); return false }          // (the sky dragged: the name goes and the land comes up now)
    if (stage === 'dark') wakeMoon()
    mdrag = { what, x, y, t: performance.now(), ph: englishOpacity, moved: false }
    try { cv.setPointerCapture(e.pointerId) } catch (er) { }
    lastMoonT = performance.now()
    return true
  }
  function moveMoon(e) {
    const dx = e.clientX - mdrag.x, dy = e.clientY - mdrag.y, dist = Math.hypot(dx, dy)
    if (mdrag.what === 'moon' && stage !== 'title' && stage !== 'dark') {           // (the risen moon is part of the sky:
      if (dist > 10 && performance.now() - mdrag.t < 260) {                         //  a swipe from it turns the sky; held, it fills)
        mdrag = null; drag = { x: e.clientX, y: e.clientY, t: performance.now() }; carry = [vx, vy]; vx = vy = 0; seek = -1; pend[0] += dx; pend[1] += dy
      }
      return
    }
    if (dist > 10) mdrag.moved = true
    if (!mdrag.moved) return
    const sgn = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : Math.sign(-dy), range = mdrag.what === 'pool' ? 150 : Math.max(150, mR * 1.4)
    setPhase(mdrag.ph + dist * sgn / range); lastMoonT = performance.now()
  }
  function endMoon(e) {
    const m = mdrag; mdrag = null
    if (!m.moved && performance.now() - m.t < 280) { if (m.what === 'pool') choose(e.clientX, e.clientY); else flareT = performance.now() }
  }
  function rise() {                                                     // the name fades, the moon shrinks up and aside, the land comes up
    if (stage !== 'title') return
    stage = 'rise'; fadeT = tiltT = performance.now()
    // where the sky will end: turned so the moon is at RISE_TO, then on a little so that the champion nearest the sight is
    // at it (else the sky would ease on to them afterwards); the moon ends near RISE_TO, in its room
    const fromTo = (a, b) => { const ax = cross(a, b), l = Math.hypot(...ax); return l > 1e-9 ? axisAngle(ax, Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])))) : [1, 0, 0, 0, 1, 0, 0, 0, 1] }
    const b = norm([(RISE_TO[0] * W - PX) / f, -(RISE_TO[1] * H - PY) / f, 1])
    let Rf = mmul(fromTo(mul(R, mdir), b), R), best = 0, bz = -2
    for (let i = 0; i < N; i++) { const z = mul(Rf, cons[i].c)[2]; if (z > bz) { bz = z; best = i } }
    Rf = mmul(fromTo(mul(Rf, cons[best].c), [0, 0, 1]), Rf)
    const Q = mmul(Rf, [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]), ang = Math.acos(Math.max(-1, Math.min(1, (Q[0] + Q[4] + Q[8] - 1) / 2)))
    const ax = [Q[7] - Q[5], Q[2] - Q[6], Q[3] - Q[1]], l = Math.hypot(...ax)
    riseRot = l > 1e-9 && ang > 1e-6 ? { ax: ax.map(v => v / l), ang, m0: mdir, m1: tmul(Rf, b) } : { ax: [1, 0, 0], ang: 0, m0: mdir, m1: tmul(Rf, b) }
  }
  function wakeMoon() {                                                   // the first touch: the moon flares, the harp runs up, the name strikes
    stage = 'title'; wakeT = performance.now(); flareT = wakeT; setPhase(Math.max(englishOpacity, 0.22))
    audio(); if (actx) { music.start(actx); music.flourish() }
    try { navigator.vibrate?.([10, 30, 18]) } catch (e) { }
    try { onWake() } catch (e) { }
  }
  cv.addEventListener('pointerdown', (e) => { audio(); if (grabMoon(e)) return; cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, t: performance.now() }; carry = [vx, vy]; vx = vy = 0; seek = -1 })
  cv.addEventListener('pointermove', (e) => {
    if (mdrag) { moveMoon(e); return }
    if (!drag) return
    const now = performance.now(), dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(1, now - drag.t)
    pend[0] += dx; pend[1] += dy; vx = vx * 0.6 + (dx / dt) * 0.4; vy = vy * 0.6 + (dy / dt) * 0.4
    drag = { x: e.clientX, y: e.clientY, t: now }
  })
  let downAt = null
  cv.addEventListener('pointerdown', (e) => { downAt = mdrag || stage === 'dive' || stage === 'under' ? null : { x: e.clientX, y: e.clientY } })
  const up = (e) => {
    if (mdrag) { endMoon(e); return }
    if (drag && performance.now() - drag.t > 90) { vx = 0; vy = 0 }                                // (held still: caught)
    else if (drag) {                                                                              // (a flick: wound into the sky's own turning)
      let nx = carry[0] + vx * FLICK, ny = carry[1] + vy * FLICK; const m = Math.hypot(nx, ny)
      if (m > 1e-6) { const c = VMAX * Math.tanh(m / VMAX) / m; nx *= c; ny *= c }
      vx = nx; vy = ny
    }
    if (downAt && e && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8) {               // a touch on a name in the sky: bring it to the sight
      const hit = labels.find(q => Math.abs(e.clientX - q.x) < q.w / 2 + 8 && Math.abs(e.clientY - q.y) < q.h)
      if (hit) { seek = hit.i; vx = vy = 0 }
    }
    drag = null; downAt = null
  }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { drag = null; downAt = null; mdrag = null })

  // ── the music: a session the sky steers. A steady pulse that never changes; the tune is the tune of whichever champion
  // is at the sight, on the harp, played with the lilt of its kind (reels a touch swung, hornpipes more, jigs leaning on the
  // first of each three) and leaning on the beat; with the harper's left hand under it: a low note on each beat that counts
  // (the root of the tune's key, or the other chord's note when the melody leans away from home). At rest the tune plays
  // whole and the strings are damped as usual. While the sky turns the tune is pared to its bones, as a player would: the
  // weak notes go first, then the off-beats, leaving the beats, fewer the faster it turns; the bass keeps the bar going,
  // and the strings are let ring so the notes run into each other. A new champion's tune comes in only at a bar line, as
  // in a set; and each tune remembers where it left off
  const EIGHTH = 0.19                                                 // seconds to the quaver, of a reel or a jig
  // each kind of tune at its own pace (as a multiple of that quaver): slides and polkas lively, hornpipes, waltzes and
  // barndances easier; steady within a tune, changing at the bar line with the tune
  const PACE = { reel: 1, jig: 1, 'slip jig': 1.05, slide: 0.85, polka: 0.85, hornpipe: 1.3, barndance: 1.25, march: 1.15, waltz: 1.35 }
  const WIND = 0.06                                                  // the wind at its loudest (fast turning)
  const BASS_VEL = 0.3                                                // the left hand on the downbeat (the other beats softer)
  // the lilt of each kind of tune: in simple time, the share of each crotchet the first quaver takes (0.5 is even);
  // in compound time, the lengths of the three quavers of each beat
  const LILT = { reel: 0.53, hornpipe: 0.6, barndance: 0.6, polka: 0.54, march: 0.52, waltz: 0.52, jig: [1.1, 0.9, 1.0], 'slip jig': [1.1, 0.9, 1.0], slide: [1.08, 0.94, 0.98] }
  const music = (() => {
    const cache = new Map(), mem = new Map()
    let ctx = null, next = 0, cur = null, pending = null, density = 0, vel = 0.3, ring = 0, quiet = false, out = null, sounding = [], wind = null, lastW = 0
    const frac = (s) => { const m = (s || '').trim().match(/^(\d+)\s*\/\s*(\d+)/); return m ? +m[1] / +m[2] : 1 }
    const ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
    const durOf = (n) => Number.isFinite(n.duration) && n.duration > 0 ? n.duration : 1        // (in quavers, whatever the L:)
    function tuneFor(ch) {
      if (cache.has(ch)) return cache.get(ch)
      let t = null
      try {
        const key = getTuneKeyForChampion(ch), d = allTunes[key], abc = typeof d === 'string' ? d : d?.abc
        const notes = abc ? parseAbcToNotes(abc).filter(n => Number.isFinite(n.midi)) : []
        if (notes.length) {
          const Mt = abc.match(/^M:\s*(.+)$/m)?.[1] || '4/4', num = +(Mt.match(/^\s*(\d+)/)?.[1] || 4)
          const B = frac(Mt) * 8, compound = num % 3 === 0 && num >= 6, bl = compound ? 3 : 2     // the bar and the beat, in quavers
          const K = (abc.match(/^K:\s*(.+)$/m)?.[1] || 'D').trim(), r = ROOTS[K[0].toUpperCase()] ?? 2, acc = K[1] === '#' ? 1 : K[1] === 'b' ? -1 : 0
          const pc = (r + acc + 12) % 12, major = !/^.[#b]?\s*(m(?!aj)|min|dor|mix|aeo)/i.test(K)
          const kind = (abc.match(/^R:\s*(.+)$/m)?.[1] || '').trim().toLowerCase()
            || { 6: 'jig', 9: 'slip jig', 12: 'slide', 2: 'polka', 3: 'waltz' }[num] || 'reel'
          const lilt = LILT[kind] ?? (compound ? LILT.jig : 0.52)
          // where each note falls in its bar: the parser's place in the written bar; the opening pickup set at the end of
          // its bar; and a short bar that completes the short bar before it (a part's last bar, the next part's pickup) as one
          const bars = []
          for (const n of notes) { const b = bars[bars.length - 1]; if (!b || b.ix !== n.barIndex) bars.push({ ix: n.barIndex, ns: [n] }); else b.ns.push(n) }
          let prevShort = null
          bars.forEach((b, k) => {
            const last = b.ns[b.ns.length - 1], len = (last.posInBar ?? 0) + durOf(last), short = len < B - 1e-3
            let off = 0
            if (k === 0 && short) off = B - len
            else if (prevShort && Math.abs(prevShort + len - B) < 1e-3) off = prevShort
            for (const n of b.ns) n.mp = off + (n.posInBar ?? 0)
            prevShort = short && k > 0 && off === 0 ? len : null
          })
          // how strong each place in the bar is, and how far the lilt moves a note there off the even grid (in quavers)
          const devAt = (m) => {
            const x = ((m % bl) + bl) % bl
            if (compound) { const [a, b2, c] = lilt; return (x < 1 ? x * a : x < 2 ? a + (x - 1) * b2 : a + b2 + (x - 2) * c) - x }
            const s2 = lilt * 2; return (x < 1 ? x * s2 : s2 + (x - 1) * (2 - s2)) - x
          }
          for (const n of notes) {
            const m = n.mp, x = ((m % bl) + bl) % bl, on = (q) => Math.abs(x - q) < 1e-3
            let w = m < 1e-3 ? 1 : Math.abs(m - B / 2) < 1e-3 && !compound && B === 8 ? 0.85 : on(0) ? 0.8
              : compound ? (on(2) ? 0.45 : on(1) ? 0.3 : 0.2) : on(1) ? 0.45 : 0.2
            n.w = Math.min(1, w + Math.max(0, Math.min(0.2, (durOf(n) - 1) * 0.1)))     // (a long note counts for a bit more)
            n.dv = devAt(m)
          }
          // the beats the left hand plays: the downbeat; and the half bar in common time, each dotted crotchet in jigs
          const beats = compound ? Array.from({ length: Math.round(B / 3) }, (_, i) => i * 3) : B === 8 ? [0, 4] : [0]
          // the home note low (G2 up to F#3); and the other chord: the fifth below in a major key, the whole tone below in
          // the modes and minor (D and C, A minor and G, as players do), with the melody notes that call for it
          const root = 43 + ((pc - 7 + 12) % 12)
          const other = major ? { m: root - 5, pcs: [2, 5, 11] } : { m: root - 2, pcs: [2, 5, 10] }
          t = { notes, beats, pc, root, other, i: 0, e: EIGHTH * (PACE[kind] ?? 1) }
        }
      } catch (e) { t = null }
      cache.set(ch, t); return t
    }
    // a harp string (Karplus-Strong, as the harp's own): `ring` lets it sound on, as an undamped string does
    function pluck(midi, v, when, rg) {
      try {
        const sr = ctx.sampleRate, freq = 440 * Math.pow(2, (midi - 69) / 12), secs = 1.1 + v * 1.4 + rg * 2.4
        const tot = Math.floor(sr * secs), buf = ctx.createBuffer(1, tot, sr), o = buf.getChannelData(0)
        const NkF = sr / freq, Nk = Math.max(8, Math.floor(NkF)), fr = NkF - Nk, len = Nk + 1, dl = new Float32Array(len)
        for (let i = 0; i < len; i++) dl[i] = (Math.random() * 2 - 1) * 0.5 * (1 - Math.cos(2 * Math.PI * i / len)) * v
        const decay = 0.988 + v * 0.009 + rg * (0.9985 - 0.988 - v * 0.009)
        let p = 0
        for (let n = 0; n < tot; n++) { const a = (p + 1) % len, b = (p + 2) % len, s = (dl[p] + dl[a] + fr * (dl[b] - dl[a])) * 0.5 * decay; o[n] = s; dl[p] = s; p = a }
        for (let n = Math.max(0, tot - 2400); n < tot; n++) o[n] *= (tot - n) / 2400                 // (no click at the end)
        const src = ctx.createBufferSource(), gn = ctx.createGain()
        src.buffer = buf; gn.gain.value = 0.16 + v * 0.30; src.connect(gn); gn.connect(out); src.start(when)
        sounding.push({ gn, from: when, to: when + secs })
      } catch (e) { }
    }
    function bassFor(t, n) {                                          // the left hand's note, from the melody note it falls under
      const deg = ((n.midi - t.pc) % 12 + 12) % 12
      return t.other.pcs.includes(deg) ? t.other.m : t.root
    }
    return {
      start(c) {
        if (ctx || !c) return; ctx = c; next = ctx.currentTime + 0.15
        out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination)
        // the wind: a soft rush of noise that swells and brightens as the sky turns (the ages going by), still at rest
        try {
          const sr = ctx.sampleRate, buf = ctx.createBuffer(1, sr * 4, sr), o = buf.getChannelData(0)
          let b = 0; for (let n = 0; n < o.length; n++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; o[n] = b * 3.5 }   // (brown noise)
          for (let n = 0; n < 2000; n++) { const k = n / 2000; o[n] = o[n] * k + o[o.length - 2000 + n] * (1 - k) }         // (no seam in the loop)
          const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain()
          src.buffer = buf; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.6; g.gain.value = 0
          src.connect(bp); bp.connect(g); g.connect(out); src.start()
          wind = { bp, g }
        } catch (e) { wind = null }
      },
      want(ch) { pending = ch },
      flourish() {                                                    // (the moon's waking: a run up the harp in D, the bass under it)
        if (!ctx || !out) return; const t0 = ctx.currentTime + 0.04
        ;[50, 54, 57, 62, 66, 69, 74, 78, 81].forEach((m, i) => pluck(m, 0.3 + i * 0.02, t0 + i * 0.055, 0.6))
        pluck(38, 0.42, t0, 0.5); pluck(45, 0.3, t0 + 0.22, 0.5)
      },
      set(d, v, rg = 0, w = 0) {
        density = d; vel = v; ring = rg
        if (wind && ctx && Math.abs(w - lastW) > 0.02) { lastW = w; wind.g.gain.setTargetAtTime(WIND * w, ctx.currentTime, w > 0.05 ? 0.15 : 0.5); wind.bp.frequency.setTargetAtTime(300 + 1100 * w, ctx.currentTime, 0.2) }
      },
      hush(on) { quiet = on; if (out && ctx) out.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, 0.3) },
      pump() {
        if (!ctx) return
        if (next < ctx.currentTime - 0.25) next = ctx.currentTime + 0.05            // (after a pause: pick up from now)
        let guard = 0
        while (next < ctx.currentTime + 0.12 && guard++ < 16) {
          // at a bar line, the next tune of the set, taken up where it was left
          if (pending && (!cur || (cur.ch !== pending && cur.t.notes[cur.t.i].mp < 1e-3))) {
            const t = tuneFor(pending)
            if (t) {
              if (cur) mem.set(cur.ch, cur.t.i); t.i = mem.get(pending) ?? 0; cur = { ch: pending, t }
              // the last tune's strings damped as the new one comes in, so they don't blur into its first bar
              for (const q of sounding) if (q.from < next && q.to > next) { try { q.gn.gain.setTargetAtTime(0, next, 0.04) } catch (e) { } }
            }
            else if (!cur) { next += EIGHTH; continue }
          }
          if (!cur) { next += EIGHTH; continue }
          const t = cur.t, n = t.notes[t.i], dur = durOf(n), E = t.e
          if (sounding.length > 40) sounding = sounding.filter(q => q.to > ctx.currentTime)
          if (!quiet) {
            // pared to the bones while the sky turns: only the notes strong enough for how fast it turns
            if (density >= 1 || n.w >= 1 - density) pluck(n.midi, vel * (0.78 + 0.32 * n.w + (Math.random() - 0.5) * 0.06), next + n.dv * E, ring)
            // the left hand: every beat this note covers, whether or not the melody note itself was played; at rest, only
            // the downbeat (the tune whole carries the rest), while turning every beat, to keep the bar going
            for (const b of t.beats) if (b >= n.mp - 1e-3 && b < n.mp + dur - 1e-3 && (b < 1e-3 || density < 1)) {
              pluck(bassFor(t, n), b < 1e-3 ? BASS_VEL : BASS_VEL * 0.6, next + (b - n.mp) * E, ring * 0.5)
            }
          }
          next += dur * E
          t.i = (t.i + 1) % t.notes.length
        }
      },
    }
  })()

  // the name: one at a time, large, in an arc over the horns. It comes up as the sky slows, faint while it turns fast,
  // brighter and steadier as it comes to rest. When the sky moves on, its letters rise, drift apart and twinkle away
  let ringA = 0, wndA = 0, fdt = 16, focus = -1, held = 0, chosen = null, raf = 0, tick = 0, nameA = 0, arrival = null, meteor = null, nextMeteor = performance.now() + 4000
  const flecks = []                                                    // (the letters going up into the sky)
  // the choice: a touch on the pool when a champion rests at the sight. Its ripples spread and calm, and in the water is
  // that champion's sign; then down into the water
  const choose = (x, y) => {
    if (focus < 0 || chosen || dive || !(lastSettled && held > 250)) return
    const k = cons[focus], P = pool(), now = performance.now(); chosen = { k, t: now }
    dive = { t: now, k, x0: P.cx, y0: P.cy, rx0: P.rx, ry0: P.ry }; stage = 'dive'
    for (let i = 0; i < 3; i++) ripples.push({ u: (x - P.cx) / P.rx, v: (y - P.cy) / P.ry, t: now + i * 240, a: 1 })
    try { navigator.vibrate?.([12, 40, 24]) } catch (e) { }
  }
  let lastSettled = false
  const ARC = () => ({ cx: PX, cy: H * 0.33 + L.rr * 12.5, rad: L.rr * 12.5, fs: Math.round(Math.min(48, W / 8.2)) })
  const LABEL_R = 0.7                                                 // how far from the sight the constellations' own names show (radians)
  let labels = []                                                      // (where they were drawn, for touching)
  function nameLetters(str) {                                         // where each letter of a name sits on the arc
    const { cx, cy, rad, fs } = ARC()
    g.save(); g.font = `${fs}px ${GA}`
    const sp = fs * 0.22, ws = [...str].map(c => g.measureText(c).width + sp); g.restore()
    const tot = ws.reduce((x, y) => x + y, 0) - sp; let ang = -Math.PI / 2 - tot / rad / 2
    return [...str].map((c, i) => { const m = ang + (ws[i] - sp) / 2 / rad; ang += ws[i] / rad; return { c, x: cx + Math.cos(m) * rad, y: cy + Math.sin(m) * rad, rot: m + Math.PI / 2, fs } })
  }
  // when the sky moves on, the name rises and fades, its letters spreading apart along a widening arc
  const shortMeaning = (s) => { if (!s) return ''; const m = s.split(/[;(.,]/)[0].trim(); return m.length <= 24 && !/^there |^see |^m\d/i.test(m) ? m : '' }
  function arcLine(str, rad, font, col, a) {                            // a line of small text on the big name's arc, centred
    if (a < 0.01) return
    const { cx, cy } = ARC()
    g.save(); g.font = font; g.fillStyle = col; g.globalAlpha = Math.min(1, a); g.textAlign = 'center'; g.textBaseline = 'middle'
    const ws = [...str].map(c => g.measureText(c).width + 1), tot = ws.reduce((x, y) => x + y, 0) - 1; let ang = -Math.PI / 2 - tot / rad / 2
    ;[...str].forEach((c, i) => { const m = ang + (ws[i] - 1) / 2 / rad; g.save(); g.translate(cx + Math.cos(m) * rad, cy + Math.sin(m) * rad); g.rotate(m + Math.PI / 2); g.fillText(c, 0, 0); g.restore(); ang += ws[i] / rad })
    g.restore()
  }
  function scatter(k, a) {
    if (a < 0.04) return
    if (flecks.length > 5) flecks.shift()
    const { cx, cy, rad, fs } = ARC()
    flecks.push({ ls: nameLetters(k.ch.nameGa).map(q => ({ c: q.c, m: Math.atan2(q.y - cy, q.x - cx) })), cx, cy, rad, fs, a0: a, age: 0 })
  }

  function frame(now) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(50, now - (lastT || now)); lastT = now
    // the opening's stages: the name up a while (longer while the moon is being played with), then fading; the tilt
    if (stage === 'title' && !mdrag && now > Math.max(wakeT + 6000, lastMoonT + 3500)) rise()
    if (tiltT && tiltDone < 1) {                                         // the rise: the sky turns, carrying the moon up and aside
      const u = Math.min(1, (now - tiltT) / 2800), e = u * u * (3 - 2 * u)
      if (riseRot) R = mmul(axisAngle(riseRot.ax, riseRot.ang * (e - tiltLast)), R)
      tiltLast = e; tiltDone = Math.max(1e-9, e)
      if (u >= 1) { tiltDone = 1; stage = 'browse'; held = 0 }
    }
    if (mdrag && !mdrag.moved && now - mdrag.t > 260) { setPhase(englishOpacity + dt / 2600); lastMoonT = now }   // (held: filling)
    mR = moonR() * (1 - (1 - RISE_SHRINK) * (opening ? tiltDone : 1))
    if (drag && now - drag.t > 90) { vx = 0; vy = 0; carry = [0, 0] }    // (a finger held still: the sky is at rest under it)
    if (pend[0] || pend[1]) {                                            // (the sky following the finger, a little behind)
      const k = 1 - Math.exp(-dt / LAG), mx = VMAX * 1.6 * dt
      let ax = pend[0] * k, ay = pend[1] * k; const m = Math.hypot(ax, ay); if (m > mx) { ax *= mx / m; ay *= mx / m }
      turn(ax, ay); pend[0] -= ax; pend[1] -= ay; if (Math.abs(pend[0]) + Math.abs(pend[1]) < 0.05) pend = [0, 0]
    }
    let spd = Math.hypot(vx, vy)
    if (drag) spd = Math.min(spd, VMAX * 1.6)
    if (!drag) {
      if (spd > 0.03) { turn(vx * dt, vy * dt); const k = Math.exp(-dt / 2000); vx *= k; vy *= k }
      else {
        vx = vy = 0; spd = 0
        const tgt = stage === 'browse' ? (seek >= 0 ? seek : focus) : -1
        if (tgt >= 0) {
          const c = mul(R, cons[tgt].c), ax = cross(c, [0, 0, 1]), an = Math.acos(Math.max(-1, Math.min(1, c[2])))
          if (an > 1e-4 && Math.hypot(...ax) > 1e-9) R = mmul(axisAngle(ax, an * (1 - Math.exp(-dt / 320))), R)
          if (seek >= 0 && an < 0.01) seek = -1
        }
      }
    }
    if (++tick % 60 === 0) R = orthonormal(R)
    let best = -1, bz = -2
    for (let i = 0; i < N; i++) { const z = mul(R, cons[i].c)[2]; if (z > bz) { bz = z; best = i } }
    const dist = Math.acos(Math.min(1, bz)), moving = (drag && spd > 0.02) || spd > 0.03 || seek >= 0
    if (best !== focus) {
      if (focus >= 0 && nameA > 0.6) scatter(cons[focus], nameA)
      focus = best; held = 0; nameA = 0
      music.want(cons[best].ch)
    }
    const settled = !moving && dist < (drag ? 0.1 : 0.05)                 // (under a held finger, near enough is enough)
    if (settled) {
      if (held === 0 && stage === 'browse') {                          // a champion arrives: its stars flare
        try { navigator.vibrate?.(8) } catch (e) { }
        arrival = { t: now, i: focus }
      }
      held += dt
    } else if (moving) held = 0
    // the music follows: whole at rest, thinner as the sky turns (more notes the faster), quieter and ringing while it turns
    if (actx) music.start(actx)
    ringA += ((settled ? 0 : Math.min(1, 0.4 + spd)) - ringA) * (1 - Math.exp(-dt / (settled ? 500 : 150)))   // (let ring while turning)
    wndA += ((settled ? 0 : Math.min(1, spd * 0.75)) - wndA) * (1 - Math.exp(-dt / 220)); const wnd = wndA
    if (settled) music.set(1, 0.34, ringA, 0); else music.set(Math.min(0.9, 0.22 + 0.6 * Math.min(1, spd / 1.0)), 0.2 + 0.06 * Math.min(1, spd), ringA, wnd)
    if (tiltT || stage === 'browse') music.pump()
    // the pool: rippling while the sky turns, its reflected stars drifting with it; calm again when it rests
    poolShift += vx * dt / Math.max(1, W) * 0.8
    if (!settled && Math.random() < spd * dt / 260) ripples.push({ u: (Math.random() - 0.5) * 1.3, v: (Math.random() - 0.5) * 1.1, t: now, a: 0.55 })
    calm += ((settled ? 1 : 0) - calm) * (1 - Math.exp(-dt / (settled ? 900 : 200)))
    for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t > 2200) ripples.splice(i, 1)
    // how much of the name shows: little while the sky runs, all of it at rest
    const vis = (settled ? 1 : Math.pow(Math.max(0, 1 - spd / 0.45), 2) * Math.max(0, 1 - dist / 0.1) * 0.8) * (stage === 'browse' ? 1 : 0)     // (as the sky slows, and whenever it rests; not before the sky is shown)
    if (chosen) nameA *= Math.exp(-dt / 250)                            // (the choice takes the name and the dancer away)
    else nameA += (vis - nameA) * (1 - Math.exp(-dt / (vis > nameA ? 180 : 120)))
    // each constellation's light eases toward how near it is to the sight
    const ease = 1 - Math.exp(-dt / 300)
    for (let i = 0; i < N; i++) {
      const k = cons[i], d = Math.acos(Math.min(1, mul(R, k.c)[2])), p = Math.max(0, 1 - d / LINE_R)
      k.d = d
      const tg = (i === focus ? 0.6 + 0.4 * nameA : p * p * (3 - 2 * p) * 0.36) * tiltDone
      k.lit += (tg - k.lit) * ease
    }
    for (const q of flecks) q.age += dt
    for (let i = flecks.length - 1; i >= 0; i--) if (flecks[i].age > 1700) flecks.splice(i, 1)
    if (now > nextMeteor && !chosen) {                                 // now and then a slow meteor
      const sx = Math.random() < 0.5 ? -1 : 1
      // (laid among the stars, not on the screen: from a point and toward another, both turned back into the sky's own frame)
      const x0 = W * (0.2 + Math.random() * 0.6), y0 = H * (0.05 + Math.random() * 0.25), dx = sx * (0.6 + Math.random() * 0.4), dy = 0.35 + Math.random() * 0.25
      const toSky = (x, y) => tmul(R, norm([(x - PX) / f, -(y - PY) / f, 1]))
      meteor = { t: now, a: toSky(x0, y0), b: toSky(x0 + dx * W * 0.35, y0 + dy * W * 0.35), tail: 0.3, dur: 900 + Math.random() * 500 }
      nextMeteor = now + 7000 + Math.random() * 9000
    }
    fdt = dt; draw(now, settled)
    lastSettled = settled
  }

  function draw(now, settled) {
    const t = now / 1000
    if (stage === 'under') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); drawDive(now); return }
    const wl = L.water + (1 - tiltDone) * (H - L.water + 4)              // (the stars go down to the land; before it rises, to the foot)
    const starA = stage === 'dark' ? 0.35 : Math.min(1, 0.35 + (now - wakeT) / 2400)
    paintSkyGradient(g, W, H)                                            // (one night: nightPalette.js SKY)
    g.save(); g.globalAlpha = starA
    g.save(); g.globalCompositeOperation = 'lighter'
    for (const d of dust) { const p = proj(d.v); if (!p || p[1] > wl) continue; const r = f * d.r / p[2]; g.globalAlpha = d.a * starA; g.drawImage(dustSprite, p[0] - r, p[1] - r, r * 2, r * 2) }
    g.restore()
    const bk = Array.from({ length: BUCKETS }, () => [])
    for (const s of bg) {
      const p = proj(s.v); if (!p || p[0] < -2 || p[0] > W + 2 || p[1] < -2 || p[1] > wl + 2) continue
      const a = Math.min(1, s.m * (0.65 + 0.35 * Math.sin(t * s.tf + s.tw)))
      bk[Math.min(BUCKETS - 1, Math.floor(a * BUCKETS))].push(p[0] - s.s / 2, p[1] - s.s / 2, s.s)
    }
    bk.forEach((arr, b) => { if (!arr.length) return; g.fillStyle = `rgba(225,232,255,${((b + 0.5) / BUCKETS).toFixed(3)})`; for (let i = 0; i < arr.length; i += 3) g.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 2]) })
    g.save(); g.lineWidth = 0.7
    for (const m of myst) {
      const P = m.pts.map(proj)
      P.forEach((p, j) => { if (p && p[1] < wl) { g.fillStyle = `rgba(215,225,250,${m.m[j].toFixed(3)})`; g.fillRect(p[0] - 1, p[1] - 1, 2, 2) } })
      g.strokeStyle = 'rgba(150,170,215,0.05)'; g.beginPath()
      for (const [a, b] of m.edges) { const pa = P[a], pb = P[b]; if (pa && pb) { g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]) } }
      g.stroke()
    }
    g.restore()
    for (let i = 0; i < N; i++) {
      const k = cons[i], pc = proj(k.c); if (!pc) continue
      const P = k.stars.map(proj), lit = k.lit, la = 0.025 + 0.9 * lit
      g.save(); g.strokeStyle = `rgba(232,214,165,${la.toFixed(3)})`; g.lineWidth = 0.7 + lit * 1.1
      if (lit > 0.6) { g.shadowColor = GOLD; g.shadowBlur = (lit - 0.6) * 12 }
      g.beginPath(); for (const [a, b] of k.sign.edges) { const pa = P[a], pb = P[b]; if (pa && pb) { g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]) } }
      g.stroke(); g.restore()
      P.forEach((p, j) => {
        if (!p || p[1] > wl) return
        const a = Math.min(1, (0.78 + 0.3 * lit) * k.sign.mags[j] * (0.92 + 0.08 * Math.sin(t * 1.3 + j + i))), r = 1.4 + lit * 1.1
        g.fillStyle = `rgba(244,246,255,${a.toFixed(3)})`; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill()
        if (arrival && arrival.i === i) {                               // (flaring as it arrives)
          const u = (now - arrival.t) / 700
          if (u < 1) { const fr = 4 + 16 * Math.sin(Math.min(1, u * 2.2) * Math.PI / 2), fa = (1 - u) * 0.75, fg = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], fr); fg.addColorStop(0, `rgba(255,244,215,${fa.toFixed(3)})`); fg.addColorStop(1, 'rgba(255,244,215,0)'); g.fillStyle = fg; g.beginPath(); g.arc(p[0], p[1], fr, 0, Math.PI * 2); g.fill() }
        }
      })
    }
    g.restore()
    drawMoon(now)
    if (meteor) {
      const u = (now - meteor.t) / meteor.dur
      if (u >= 1) meteor = null
      else {
        const e = u * u * (3 - 2 * u), at = (k) => proj(norm(meteor.a.map((v, j) => v + (meteor.b[j] - v) * k)))
        const hp = at(e), tp = at(Math.max(0, e - meteor.tail)), a = Math.sin(u * Math.PI) * 0.8
        if (hp && tp) {
        const [hx, hy] = hp, [tx, ty] = tp
        const mg = g.createLinearGradient(tx, ty, hx, hy); mg.addColorStop(0, 'rgba(230,235,255,0)'); mg.addColorStop(1, `rgba(240,244,255,${a.toFixed(3)})`)
        g.save(); g.strokeStyle = mg; g.lineWidth = 1.3; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke(); g.restore()
        }
      }
    }
    drawLand(t, settled)
    // names gone by, rising and fading, their letters spreading apart along a widening arc
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'
    for (const q of flecks) {
      const u = q.age / 1700, e = 1 - Math.pow(1 - u, 2), a = q.a0 * Math.pow(1 - u, 2.4) * 0.5, rad = q.rad + e * L.rr * 4
      if (a < 0.01) continue
      g.font = `${q.fs}px ${GA}`; g.fillStyle = STAR; g.shadowColor = STAR_GLOW; g.shadowBlur = 8
      for (const l of q.ls) {
        const m = -Math.PI / 2 + (l.m + Math.PI / 2) * (q.rad / rad) * (1 + e * 1.1)
        g.save(); g.translate(q.cx + Math.cos(m) * rad, q.cy + Math.sin(m) * rad); g.rotate(m + Math.PI / 2); g.globalAlpha = a; g.fillText(l.c, 0, 0); g.restore()
      }
    }
    g.restore()
    // the constellations' own names, as on a chart: each along an arc that bows round its stars, at its angle; brighter the
    // nearer the sight. The one at the sight has its name in its place too, tinted gold. A name once showing keeps its place
    // (and its side of its stars) until it leaves; a new one only comes where there is room; they come and go slowly
    labels = []
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'
    const lfs = Math.round(Math.max(13, Math.min(17, W / 25)))
    g.font = `${lfs}px ${GA}`
    const LS = 1.5
    const ss = (a, b, v) => { const u = Math.max(0, Math.min(1, (v - a) / (b - a))); return u * u * (3 - 2 * u) }
    const box = (t) => ({ x: (t[0] + t[2]) / 2, y: (t[1] + t[3]) / 2, a: 0, hw: (t[2] - t[0]) / 2, hh: (t[3] - t[1]) / 2 })
    const hits = (A, B) => {
      for (const ang of [A.a, A.a + Math.PI / 2, B.a, B.a + Math.PI / 2]) {
        const ux = Math.cos(ang), uy = Math.sin(ang), pr = (R) => Math.abs(Math.cos(R.a) * ux + Math.sin(R.a) * uy) * R.hw + Math.abs(-Math.sin(R.a) * ux + Math.cos(R.a) * uy) * R.hh
        if (Math.abs((B.x - A.x) * ux + (B.y - A.y) * uy) > pr(A) + pr(B)) return false
      }
      return true
    }
    const placed = [box(L.bull)]
    { const mp = moonAt(); if (mp) placed.push({ x: mp[0], y: mp[1], a: 0, hw: mR * 1.05, hh: mR * 1.05 }) }   // (nor on the moon)
    if (focus >= 0 && nameA > 0.2) for (const q of nameLetters(cons[focus].ch.nameGa)) placed.push({ x: q.x, y: q.y, a: q.rot, hw: q.fs * 0.5, hh: q.fs * 0.62 })
    { const { cy, rad, fs } = ARC(), hh = Math.min(H * 0.22, 230); placed.push(box([PX - hh * 0.45, cy - rad - fs * 0.5 - hh * 1.1, PX + hh * 0.45, cy - rad - fs * 0.4])) }   // (nor over the dancer)
    if (focus >= 0 && nameA > 0.2) { const { cy, rad, fs } = ARC(); placed.push(box([PX - W * 0.3, cy - rad + fs * 0.5, PX + W * 0.3, cy - rad + fs * 1.4])) }
    let fbox = null
    if (focus >= 0) { const P = cons[focus].stars.map(proj).filter(Boolean); if (P.length) { const xs = P.map(p => p[0]), ys = P.map(p => p[1]); fbox = box([Math.min(...xs) - 10, Math.min(...ys) - 10, Math.max(...xs) + 10, Math.max(...ys) + 10]) } }
    const cand = []
    for (let i = 0; i < N; i++) {
      const k = cons[i]
      const lim = k.shown ? LABEL_R + 0.05 : LABEL_R
      if (k.d === undefined || k.d > lim) { k.la = 0; k.shown = false; k.since = 0; continue }
      const P = k.stars.map(proj); if (P.some(p => !p)) { k.la = 0; k.shown = false; k.since = 0; continue }
      const a = Math.min(1, 1.1 * (1 - ss(0.25, lim, k.d)))                   // (fading to nothing at the edge, so none pops)
      const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cy = P.reduce((s, p) => s + p[1], 0) / P.length
      let sxx = 0, syy = 0, sxy = 0; for (const p of P) { const dx = p[0] - cx, dy = p[1] - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy }
      let ang = 0.5 * Math.atan2(2 * sxy, sxx - syy); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI
      ang = Math.max(-0.75, Math.min(0.75, ang))
      if (k.ang !== undefined && k.shown) { let da = ang - k.ang; ang = k.ang + da * 0.2 }                 // (a shown name turns slowly with its stars)
      k.ang = ang
      const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux
      let mn = 0, mx = 0; for (const p of P) { const t = (p[0] - cx) * nx + (p[1] - cy) * ny; mn = Math.max(mn, t); mx = Math.max(mx, -t) }
      const w = [...k.ch.nameGa].reduce((s, ch) => s + g.measureText(ch).width + LS, -LS)
      const pos = [[cx + nx * (mn + lfs * 0.85), cy + ny * (mn + lfs * 0.85)], [cx - nx * (mx + lfs * 0.85), cy - ny * (mx + lfs * 0.85)]]
      cand.push({ i, k, a: a * tiltDone, pos, ang, nx, ny, w, own: i === focus, pr: i === focus ? 1e9 : k.shown ? 1e6 - k.since : -k.d })
    }
    cand.sort((p, q) => q.pr - p.pr)
    const ezIn = 1 - Math.exp(-fdt / 300), ezOut = 1 - Math.exp(-fdt / 140)
    for (const c of cand) {
      const sides = c.k.shown ? [c.k.side ?? 0] : [0, 1]
      let free = false, at = null
      for (const sd of sides) {
        const [tx, ty] = c.pos[sd]
        if (ty > L.mtn(tx) - lfs * 0.7 || tx < -c.w / 2 || tx > W + c.w / 2) continue
        const r = { x: tx, y: ty, a: c.ang, hw: c.w / 2 + 4, hh: lfs / 2 + 3 }
        const others = c.own ? placed : fbox ? [...placed, fbox] : placed
        if (!others.some(t => hits(r, t))) { placed.push(r); at = [tx, ty]; c.k.side = sd; free = true; break }
      }
      if (free && !c.k.shown) c.k.since = (c.k.since || 0) || performance.now()
      c.k.shown = free
      c.k.lp = at || c.pos[c.k.side ?? 0]                                // (a name going out goes with its stars, not left behind)
      c.k.la = (c.k.la || 0) + ((free ? c.a : 0) - (c.k.la || 0)) * (free ? ezIn : ezOut)
      if (c.k.la < 0.02) continue
      const [lx, ly] = c.k.lp, below = !(c.k.side), Rc = Math.max(c.w * 1.2, 60), dir = below ? 1 : -1
      const ox = lx - dir * c.nx * Rc, oy = ly - dir * c.ny * Rc, f0 = Math.atan2(ly - oy, lx - ox)
      g.save(); g.globalAlpha = Math.min(1, c.k.la * (c.own ? 1 : 1)); g.fillStyle = c.own ? '#f2d58c' : STAR; g.shadowColor = c.own ? GOLD : STAR_GLOW; g.shadowBlur = c.own ? 6 : 4
      let pp = -c.w / 2
      for (const ch of c.k.ch.nameGa) {
        const cw = g.measureText(ch).width, m = pp + cw / 2, fi = below ? f0 - m / Rc : f0 + m / Rc
        g.save(); g.translate(ox + Math.cos(fi) * Rc, oy + Math.sin(fi) * Rc); g.rotate(below ? fi - Math.PI / 2 : fi + Math.PI / 2); g.fillText(ch, 0, 0); g.restore()
        pp += cw + LS
      }
      g.restore()
      if (free) labels.push({ i: c.i, x: lx, y: ly, w: c.w, h: lfs })
    }
    g.restore()
    // the name at the sight, large, in its arc
    if (focus >= 0 && nameA > 0.01) {
      g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'
      for (const q of nameLetters(cons[focus].ch.nameGa)) {
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.globalAlpha = Math.min(1, nameA); g.font = `${q.fs}px ${GA}`; g.fillStyle = STAR
        g.lineWidth = 3; g.strokeStyle = 'rgba(4,6,18,0.55)'; g.lineJoin = 'round'; g.strokeText(q.c, 0, 0)                 // (a dark edge: legible over the moon)
        g.shadowColor = STAR_GLOW; g.shadowBlur = settled ? 18 : 8; g.fillText(q.c, 0, 0); g.restore()
      }
      g.restore()
      // what the name means, small, under it, in English: as faint as the moon allows
      const mean = shortMeaning(cons[focus].ch.nameEn)
      if (mean) arcLine(mean, ARC().rad - ARC().fs * 1.05, `${Math.round(Math.max(15, Math.min(18, W / 23)))}px ${EN}`, '#e2dccb', Math.min(1, nameA) * englishOpacity)
      // and the champion over it, dancing: a hop to each beat of their own tune, turning on each landing. As it arrives it
      // rises out of its stars to its place
      const sp = spriteOf(cons[focus].ch)
      if (sp) {
        const { cy, rad, fs } = ARC(), base = cy - rad - fs * 0.5, hh = Math.min(H * 0.22, 230), ww = hh * sp.c.width / sp.c.height
        const beats = now / sp.hop, hi = Math.floor(beats), arc = Math.sin(Math.PI * (beats - hi)), face = hi & 1 ? -1 : 1
        let ox = PX, oy = base, sc = 1
        if (arrival && arrival.i === focus) {
          const u = Math.min(1, (now - arrival.t) / 520), e = 1 - Math.pow(1 - u, 3), P = cons[focus].stars.map(proj).filter(Boolean)
          if (P.length && u < 1) { const sx = P.reduce((s, p) => s + p[0], 0) / P.length, sy = P.reduce((s, p) => s + p[1], 0) / P.length; ox = sx + (PX - sx) * e; oy = sy + (base - sy) * e; sc = 0.25 + 0.75 * e }
        }
        g.save(); g.globalAlpha = Math.min(1, nameA) * (chosen ? Math.max(0, 1 - (now - chosen.t) / 400) : 1); g.imageSmoothingEnabled = false
        g.translate(ox, oy - hh * 0.07 * arc * sc); g.scale(sc, sc); g.rotate(0.05 * face * arc); g.scale(face * (1 - 0.1 * arc), 1 + 0.15 * arc)
        g.shadowColor = STAR_GLOW; g.shadowBlur = 14; g.drawImage(sp.c, -ww / 2, -hh, ww, hh); g.restore()
      }
    }
    // the game's name, over the waking moon: the Irish in gold, struck; the English beneath it as the moon allows
    const titleA = stage === 'title' ? Math.min(1, (now - wakeT) / 350) : stage === 'rise' ? Math.max(0, 1 - (now - fadeT) / 1500) : 0
    if (titleA > 0.01) {
      // (above the moon: the foot of the screen is the saved heroes' and, until fullscreen is granted, the fog's)
      const mp = moonAt() || [PX, PY], fs = Math.round(Math.min(56, W / 6.4)), blockH = fs * 1.05 * (TITLE.ga.length - 1) + fs * 0.95 + fs * 0.4
      const ty = mp[1] - mR - Math.min(60, H * 0.06) - blockH + fs * 0.5
      const strike = Math.max(0, 1 - (now - wakeT) / 450), sc = 1 + 0.25 * strike * strike
      g.save(); g.translate(PX, ty); g.scale(sc, sc); g.textAlign = 'center'; g.textBaseline = 'middle'
      g.font = `${fs}px IrishPenny, ${GA}`; g.fillStyle = GOLD; g.shadowColor = GOLD; g.shadowBlur = 16 + 40 * strike; g.globalAlpha = titleA
      TITLE.ga.forEach((l, i) => g.fillText(l, 0, i * fs * 1.05))       // (IrishPenny: the heavy uncial, struck rather than written)
      g.restore()
      const ea = titleA * englishOpacity
      if (ea > 0.01) {
        const efs = Math.round(fs * 0.4), ey = ty + fs * 1.05 * (TITLE.ga.length - 1) + fs * 0.95, sp = efs * 0.35
        g.save(); g.font = `${efs}px ${EN}`; g.fillStyle = '#e2dccb'; g.globalAlpha = ea; g.textBaseline = 'middle'; g.textAlign = 'left'
        const ws = [...TITLE.en].map(c => g.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1)
        let xx = PX - tot / 2; [...TITLE.en].forEach((c, i) => { g.fillText(c, xx, ey); xx += ws[i] + sp })
        g.restore()
      }
    }
    if (dive) drawDive(now)
  }

  // ── the moon among the stars, as the moon tile draws it (lit from the right, waxing), large; with a few seas
  function moonDisc(x, y, r, ph, boost = 0) {
    const gm = 1.6 + boost * 1.4, ga = Math.min(1, 0.14 + ph * 0.14 + boost * 0.45)
    const grd = g.createRadialGradient(x, y, r * 0.4, x, y, r * gm); grd.addColorStop(0, `rgba(180,170,255,${ga.toFixed(3)})`); grd.addColorStop(1, 'rgba(200,220,255,0)')
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r * gm, 0, Math.PI * 2); g.fill()
    const rr = r * 0.92
    g.fillStyle = 'rgb(8,4,30)'; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill()
    if (ph > 0.005) {
      g.save(); g.beginPath()
      if (ph >= 0.99) g.arc(x, y, rr, 0, Math.PI * 2)
      else { const tx = rr * Math.cos(ph * Math.PI); g.arc(x, y, rr, -Math.PI / 2, Math.PI / 2); g.ellipse(x, y, Math.abs(tx), rr, 0, Math.PI / 2, -Math.PI / 2, tx > 0) }
      g.fillStyle = `rgb(${160 + ph * 20 | 0},${170 + ph * 20 | 0},${225 + ph * 25 | 0})`; g.fill(); g.clip()
      for (const [mx, my, mr, a] of [[0.2, -0.3, 1.0, 0.2], [-0.3, 0.1, 0.7, 0.16], [0.4, 0.35, 0.6, 0.14], [-0.05, 0.45, 0.45, 0.1], [0.5, -0.05, 0.35, 0.12]]) {
        g.fillStyle = `rgba(130,122,190,${(a * Math.min(1, ph * 2)).toFixed(3)})`; g.beginPath(); g.arc(x + mx * r * 0.7, y + my * r * 0.7, mr * r * 0.2, 0, Math.PI * 2); g.fill()
      }
      g.restore()
    }
    g.strokeStyle = `rgba(180,160,255,${Math.min(1, 0.2 + ph * 0.3 + boost * 0.4).toFixed(3)})`; g.lineWidth = Math.max(1, r / 60); g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke()
  }
  function drawMoon(now) {
    const mp = moonAt(); if (!mp) return
    const t = now / 1000, fl = Math.max(0, 1 - (now - flareT) / 900)
    const boost = (stage === 'dark' ? 0.12 + 0.12 * Math.sin(t * 1.6) : 0) + fl * fl * 1.1 + (mdrag && mdrag.what === 'moon' ? 0.15 : 0)
    const { cy: acy, rad } = ARC(), beneath = mp[1] + mR > acy - rad - H * 0.25 && mp[1] - mR < acy - rad + H * 0.05 && Math.abs(mp[0] - PX) < mR + W * 0.35
    g.save(); g.globalAlpha = beneath ? 1 - 0.4 * Math.min(1, nameA) : 1                 // (veiled a little while a name stands over it)
    moonDisc(mp[0], mp[1], mR, englishOpacity, boost)
    g.restore()
    if (fl > 0 && now - wakeT < 1200) {                                 // (the waking: a ring of light going out from it)
      const u = 1 - fl, rr = mR * (1 + u * 1.6)
      g.save(); g.strokeStyle = `rgba(225,220,255,${(0.55 * fl).toFixed(3)})`; g.lineWidth = 2 + 6 * fl; g.beginPath(); g.arc(mp[0], mp[1], rr, 0, Math.PI * 2); g.stroke(); g.restore()
    }
  }
  // ── the pool: the moon tile itself, laid in the ground (its own dark stone rim and gold ring), the water inside it; the
  // stars in it drifting as the sky turns, and, when the sky is still, the sign of the champion at the sight; ripples.
  // Drawn at any size, for the dive
  const TILE = new Image(); TILE.src = 'assets/ciorcal-glass-bg.png'
  const TILE_IN = 0.78                                                  // (the water's edge, as a share of the tile's radius: inside the gold)
  const PSTARS = Array.from({ length: 700 }, (_, i) => { const r = mulberry(900 + i * 7); const a = r() * Math.PI * 2, d = Math.sqrt(r()); return { u: Math.cos(a) * d, v: Math.sin(a) * d, m: 0.25 + r() * 0.75, tw: r() * 6 } })
  function drawPool(cx, cy, rx, ry, now, o = {}) {
    const t = now / 1000
    if (TILE.complete && TILE.naturalWidth) g.drawImage(TILE, cx - rx / TILE_IN, cy - ry / TILE_IN, 2 * rx / TILE_IN, 2 * ry / TILE_IN)
    else { const kw = Math.max(3, rx / 10); g.save(); g.strokeStyle = 'rgba(30,32,40,1)'; g.lineWidth = kw * 2; g.beginPath(); g.ellipse(cx, cy, rx + kw, ry + kw, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = 'rgba(233,196,106,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy, rx + 1, ry + 1, 0, 0, Math.PI * 2); g.stroke(); g.restore() }
    g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip()
    const wg = g.createLinearGradient(0, cy - ry, 0, cy + ry); wg.addColorStop(0, '#0c1634'); wg.addColorStop(1, '#03060f'); g.fillStyle = wg; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)
    if (o.full > 0) { g.save(); g.globalAlpha = o.full; paintSkyGradient(g, W, H); g.restore() }   // (deep in, the water is the night itself)
    const z = Math.max(1, Math.min(1.8, rx / 220)), nS = Math.min(PSTARS.length, Math.round(60 + rx * 1.2))
    for (let si = 0; si < nS; si++) { const s2 = PSTARS[si]
      const u = ((s2.u + poolShift + 1) % 2 + 2) % 2 - 1, X = cx + u * rx, Y = cy + s2.v * ry, a = s2.m * (0.6 + 0.4 * Math.sin(t * 1.7 + s2.tw))
      g.fillStyle = `rgba(225,232,255,${a.toFixed(3)})`; g.fillRect(X - z / 2, Y - z / 2, z, z)
    }
    if (o.sign && o.signA > 0.01) {                                     // (a champion's sign, in the water)
      const P = o.sign.pts, ext = Math.max(0.05, ...P.map(p => Math.hypot(p[0], p[1]))), sc = Math.min(rx * 0.5, W * 0.3) / ext, at = (p) => [cx + p[0] * sc, cy - p[1] * sc * (ry / rx)]
      g.save(); g.globalAlpha = o.signA; g.strokeStyle = 'rgba(242,213,140,0.9)'; g.lineWidth = Math.max(1, rx / 110); g.shadowColor = GOLD; g.shadowBlur = Math.max(4, rx / 30)
      g.beginPath(); for (const [i, j] of o.sign.edges) { const a = at(P[i]), b = at(P[j]); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]) } g.stroke()
      g.fillStyle = 'rgba(255,250,235,1)'; for (const p of P) { const q = at(p); g.beginPath(); g.arc(q[0], q[1], Math.max(1.4, rx / 90), 0, Math.PI * 2); g.fill() }
      g.restore()
    }
    for (const r of ripples) {
      const age = (now - r.t) / 1000; if (age < 0 || age > 2.2) continue
      const R = 0.08 + age * 0.55, a = (1 - age / 2.2) * 0.5 * r.a
      g.strokeStyle = `rgba(200,210,245,${a.toFixed(3)})`; g.lineWidth = Math.max(0.8, rx / 90); g.beginPath(); g.ellipse(cx + r.u * rx, cy + r.v * ry, R * rx, R * ry, 0, 0, Math.PI * 2); g.stroke()
    }
    g.restore()
  }
  // the dive: the ripples calm on the sign (1.3s); then down into the water, the pool growing and rounding as we come to
  // look straight down into it, the night closing round it (1.7s); then a wave through the water, and we are in it
  const oc = document.createElement('canvas'), ocx = oc.getContext('2d')
  function drawDive(now) {
    const ms = now - dive.t, Rf = Math.hypot(W, H) * 0.62
    if (ms < 3000) {
      const zu = Math.max(0, Math.min(1, (ms - 1300) / 1700)), ze = zu * zu * (3 - 2 * zu)
      if (ze > 0) { g.save(); g.globalAlpha = ze; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.restore() }
      const cx = dive.x0 + (PX - dive.x0) * ze, cy = dive.y0 + (H / 2 - dive.y0) * ze, rx = dive.rx0 + (Rf - dive.rx0) * ze, asp = dive.ry0 / dive.rx0
      drawPool(cx, cy, rx, rx * (asp + (1 - asp) * ze), now, { sign: dive.k.sign, signA: 1, full: ze })
      return
    }
    // (in the water: drawn whole to a canvas aside, then laid back a strip at a time, each pushed by the passing wave)
    const u = Math.min(1, (ms - 3000) / 1100)
    if (oc.width !== Math.round(W * DPR) || oc.height !== Math.round(H * DPR)) { oc.width = Math.round(W * DPR); oc.height = Math.round(H * DPR) }
    const keep = g; g = ocx; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H)
    drawPool(PX, H / 2, Rf, Rf, now, { sign: dive.k.sign, signA: 1, full: 1 }); g = keep
    const A = u < 1 ? 22 * Math.sin(u * Math.PI) : 0
    if (A > 0.3) for (let y = 0; y < H; y += 3) g.drawImage(oc, 0, y * DPR, oc.width, 3 * DPR, A * Math.sin(y * 0.045 - ms * 0.012), y, W, 3)
    else g.drawImage(oc, 0, 0, W, H)
    if (u >= 1 && !under) { under = true; stage = 'under'; try { onChoose(dive.k.ch, dive.k.sign) } catch (e) { } }
  }

  // ── the land: we stand on the bull's back, looking where he looks. His back runs away from us, a ridge of standing stones
  // along his spine to the hump of his shoulders; beyond it his neck rises and his head, seen from behind, lifted a little to
  // the sky, sits over the far mountains; his horns sweep out and up, leading the eye to the sight. Hills nearer, mountains
  // further, paler in the haze, a few lights among them; the druid and the queen on his back with us
  function drawLand(t, settled) {
    if (!land) land = paintLand()
    const off = landOff(); if (off >= H) return
    g.save(); g.translate(0, off)
    g.drawImage(land, 0, 0, W, H)
    ;(L.tips || []).forEach(([tx, ty], j) => {
      const gl = 0.5 + 0.5 * Math.sin(t * 1.6 + j * 2.1), rgb = L.tipRGB || '255,236,190'
      const tg = g.createRadialGradient(tx, ty, 0, tx, ty, 6); tg.addColorStop(0, `rgba(${rgb},${(0.45 + 0.35 * gl).toFixed(3)})`); tg.addColorStop(1, `rgba(${rgb},0)`)
      g.fillStyle = tg; g.beginPath(); g.arc(tx, ty, 6, 0, Math.PI * 2); g.fill()
    })
    g.restore()
    if (!dive) { const P = pool(); drawPool(P.cx, P.cy, P.rx, P.ry, t * 1000, { sign: focus >= 0 ? cons[focus].sign : null, signA: calm * (stage === 'browse' ? 1 : 0) }) }
  }
  // a horn's centre line, base (u 0) to point (u 1): out from his poll, wide, then up, the points turned toward the sight
  const hornPath = (sx) => {
    const S = L.rr, hy = L.headY
    const P0 = [PX + sx * S * 0.7, hy + S * 0.15], P1 = [PX + sx * S * 3.3, hy + S * 0.35], P2 = [PX + sx * S * 3.2, hy - S * 1.9], P3 = [PX + sx * S * 1.55, L.tipY]
    return (u) => { const v = 1 - u; return [v * v * v * P0[0] + 3 * v * v * u * P1[0] + 3 * v * u * u * P2[0] + u * u * u * P3[0], v * v * v * P0[1] + 3 * v * v * u * P1[1] + 3 * v * u * u * P2[1] + u * u * u * P3[1]] }
  }
  function paintLand() {
    const c = document.createElement('canvas'); c.width = Math.round(W * DPR); c.height = Math.round(H * DPR)
    const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0)
    const S = L.rr, hy = L.headY, rnd = mulberry(21)
    const tone = (k) => { const a = [5, 7, 13], b = [96, 106, 138]; k = Math.max(0, Math.min(1, k)); return `rgb(${a.map((v, j) => v + (b[j] - v) * k | 0).join(',')})` }
    // the mountains, far and pale in the haze, snow on the high ones; then a nearer ridge of hills, darker, a few lights
    x.fillStyle = '#1e2846'; x.beginPath(); x.moveTo(0, H)
    for (let i = 0; i <= 96; i++) { const X = W * i / 96; x.lineTo(X, L.mtn(X)) }
    x.lineTo(W, H); x.closePath(); x.fill()
    x.save(); x.clip(); x.strokeStyle = 'rgba(200,210,240,0.18)'; x.lineWidth = 1
    for (let i = 0; i <= 96; i++) { const X = W * i / 96, Y = L.mtn(X); if (Y < H * 0.73) { x.beginPath(); x.moveTo(X, Y + 1); x.lineTo(X + (rnd() - 0.5) * 4, Y + 3 + rnd() * 5); x.stroke() } }
    const hz = x.createLinearGradient(0, H * 0.68, 0, H * 0.8); hz.addColorStop(0, 'rgba(120,140,190,0)'); hz.addColorStop(1, 'rgba(120,140,190,0.18)'); x.fillStyle = hz; x.fillRect(0, H * 0.66, W, H * 0.16)
    x.restore()
    const hill = (X) => H * 0.8 - H * 0.022 * (0.5 + 0.5 * Math.sin(X * 0.009 + 0.4)) - H * 0.008 * Math.sin(X * 0.031 + 1)
    x.fillStyle = '#10172b'; x.beginPath(); x.moveTo(0, H)
    for (let i = 0; i <= 48; i++) { const X = W * i / 48; x.lineTo(X, hill(X)) }
    x.lineTo(W, H); x.closePath(); x.fill()
    for (const fx of [0.05, 0.12, 0.2, 0.78, 0.86, 0.93]) { const X = W * fx; x.fillStyle = 'rgba(255,200,130,0.55)'; x.fillRect(X, hill(X) + 3 + rnd() * 6, 1.6, 1.6) }
    // (somewhere else to stand than the bull, to try: see skyLands.js)
    if (stand !== 'bull' && LANDS[stand]) {
      const r = LANDS[stand](x, { W, H, PX, PY, S, rnd, tone, druid, queen, hill })
      L.tips = r.tips; L.tipRGB = r.tipRGB; L.bull = r.box; L.glow = r.glow
      return c
    }
    L.tips = [hornPath(-1)(1), hornPath(1)(1)]; L.tipRGB = null; L.glow = null
    // the horns, behind his head
    for (const sx of [-1, 1]) {
      const hp = hornPath(sx), n = 48, pts = Array.from({ length: n + 1 }, (_, i) => hp(i / n))
      const wAt = (u) => S * 0.62 * Math.pow(1 - u, 0.8) * (1 + 0.18 * Math.sin(u * Math.PI)) + S * 0.035
      for (let i = 0; i < n; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l
        const wa = wAt(i / n) / 2, wb = wAt((i + 1) / n) / 2
        const q = [[ax + nx * wa, ay + ny * wa], [bx + nx * wb, by + ny * wb], [bx - nx * wb, by - ny * wb], [ax - nx * wa, ay - ny * wa]]
        const lf = nx * -0.5 + ny * -0.85, gr = x.createLinearGradient(ax + nx * wa, ay + ny * wa, ax - nx * wa, ay - ny * wa)
        const hm = (k) => { const a = [6, 8, 15], bb = [110, 122, 156]; return `rgb(${a.map((v, j) => v + (bb[j] - v) * k | 0).join(',')})` }
        gr.addColorStop(0, hm(Math.max(0, 0.15 + 0.6 * lf))); gr.addColorStop(0.5, hm(0.2)); gr.addColorStop(1, hm(Math.max(0, 0.12 - 0.6 * lf)))
        x.beginPath(); q.forEach((p, j) => (j ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); x.fillStyle = gr; x.fill(); x.strokeStyle = gr; x.lineWidth = 0.6; x.stroke()
        if (i % 5 === 2 && i < n - 5) { x.strokeStyle = 'rgba(8,10,16,0.5)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(q[0][0], q[0][1]); x.lineTo(q[3][0], q[3][1]); x.stroke() }
        if (i > n * 0.7) { x.strokeStyle = 'rgba(233,196,106,0.7)'; x.lineWidth = 1; x.beginPath(); x.moveTo((q[0][0] + q[3][0]) / 2, (q[0][1] + q[3][1]) / 2); x.lineTo((q[1][0] + q[2][0]) / 2, (q[1][1] + q[2][1]) / 2); x.stroke() }
      }
    }
    // his ears, out under the horns
    for (const sx of [-1, 1]) {
      x.beginPath(); x.moveTo(PX + sx * S * 0.8, hy + S * 0.45); x.quadraticCurveTo(PX + sx * S * 1.4, hy + S * 0.3, PX + sx * S * 1.85, hy + S * 0.62)
      x.quadraticCurveTo(PX + sx * S * 1.35, hy + S * 0.85, PX + sx * S * 0.85, hy + S * 0.8); x.closePath()
      x.fillStyle = tone(sx < 0 ? 0.26 : 0.08); x.fill(); x.strokeStyle = 'rgba(2,3,6,0.6)'; x.lineWidth = 1; x.stroke()
    }
    // his head from behind, lifted a little: the round of his muzzle just showing beyond the back of his skull; the poll
    // between the horns; the thick neck down from it to the hump of his shoulders
    const neck = new Path2D()
    neck.moveTo(PX - S * 3.6, H * 0.82); neck.bezierCurveTo(PX - S * 2.2, hy + S * 1.5, PX - S * 1.05, hy + S * 1.1, PX - S * 0.9, hy + S * 0.3)
    neck.bezierCurveTo(PX - S * 0.85, hy - S * 0.35, PX - S * 0.4, hy - S * 0.65, PX, hy - S * 0.68)
    neck.bezierCurveTo(PX + S * 0.4, hy - S * 0.65, PX + S * 0.85, hy - S * 0.35, PX + S * 0.9, hy + S * 0.3)
    neck.bezierCurveTo(PX + S * 1.05, hy + S * 1.1, PX + S * 2.2, hy + S * 1.5, PX + S * 3.6, H * 0.82); neck.closePath()
    x.beginPath(); x.ellipse(PX, hy - S * 0.7, S * 0.5, S * 0.3, 0, Math.PI, 0); x.closePath(); x.fillStyle = tone(0.2); x.fill()      // the muzzle, beyond
    const ng = x.createLinearGradient(PX - S, 0, PX + S, 0); ng.addColorStop(0, tone(0.36)); ng.addColorStop(0.5, tone(0.18)); ng.addColorStop(1, tone(0.05))
    x.fillStyle = ng; x.fill(neck); x.strokeStyle = 'rgba(170,180,215,0.22)'; x.lineWidth = 1; x.stroke(neck)
    x.save(); x.clip(neck); x.strokeStyle = 'rgba(2,3,7,0.7)'; x.lineWidth = 1.1
    for (const [v, b2] of [[0.25, 0.1], [0.95, -0.06], [1.7, 0.08]]) { x.beginPath(); x.moveTo(PX - S * 1.2, hy + S * v); x.quadraticCurveTo(PX, hy + S * (v + b2 - 0.15), PX + S * 1.2, hy + S * v); x.stroke() }
    x.beginPath(); x.moveTo(PX - S * 0.1, hy + S * 0.25); x.lineTo(PX - S * 0.05, hy + S * 0.95); x.moveTo(PX + S * 0.3, hy + S * 0.95); x.lineTo(PX + S * 0.35, hy + S * 1.7); x.stroke()
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.ellipse(PX, hy - S * 0.3, S * 0.75, S * 0.12, 0, 0, Math.PI * 2); x.fill()            // the forelock ridge at his poll
    x.restore()
    // his back: from the hump of his shoulders out and down to us, filling the foot of the screen; his flanks falling away
    const top = (X) => { const u = (X - PX) / (W * 0.62); return H * 0.79 + H * 0.12 * u * u + H * 0.004 * Math.sin(X * 0.08) }
    const back = new Path2D(); back.moveTo(-2, H + 2)
    for (let i = 0; i <= 60; i++) { const X = -2 + (W + 4) * i / 60; back.lineTo(X, Math.min(H, top(X))) }
    back.lineTo(W + 2, H + 2); back.closePath()
    const bgr = x.createLinearGradient(0, H * 0.76, 0, H); bgr.addColorStop(0, tone(0.2)); bgr.addColorStop(1, tone(0.05))
    x.fillStyle = bgr; x.fill(back); x.strokeStyle = 'rgba(170,180,215,0.2)'; x.lineWidth = 1; x.stroke(back)
    x.save(); x.clip(back)
    const side = x.createLinearGradient(0, 0, W, 0); side.addColorStop(0, 'rgba(130,145,190,0.08)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,0.35)'); x.fillStyle = side; x.fillRect(0, H * 0.7, W, H * 0.3)
    // grass over him, finer far off, longer near; flowers in it
    for (let k = 0; k < 420; k++) {
      const X = rnd() * W, Y = top(X) + Math.pow(rnd(), 1.3) * (H - top(X)), u = (Y - H * 0.76) / (H * 0.24), hgt = 3 + u * 12 + rnd() * 4
      x.strokeStyle = `rgba(${36 + rnd() * 26 | 0},${56 + rnd() * 26 | 0},${52 + rnd() * 18 | 0},${(0.5 + u * 0.4).toFixed(2)})`; x.lineWidth = 0.6 + u * 0.7
      x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + 1, Y - hgt * 0.6, X + (rnd() - 0.4) * hgt * 0.5, Y - hgt); x.stroke()
      if (rnd() < 0.08) { x.fillStyle = rnd() < 0.5 ? 'rgba(235,230,210,0.75)' : 'rgba(225,190,215,0.65)'; x.beginPath(); x.arc(X, Y - hgt, 0.7 + u, 0, Math.PI * 2); x.fill() }
    }
    // the ridge of standing stones along his spine, running from near us away to his shoulders, smaller as they go
    for (let k = 9; k >= 0; k--) {
      const u = k / 9, Y = H * 0.8 + (H * 1.02 - H * 0.8) * Math.pow(1 - u, 1.6), sc = 0.25 + 1.8 * Math.pow(1 - u, 1.7), X = PX + (k % 2 ? 1 : -1) * S * 0.12 * sc
      const w = S * 0.32 * sc * (0.8 + rnd() * 0.4), h = S * 0.85 * sc * (0.75 + rnd() * 0.5), lean = (rnd() - 0.5) * w * 0.4
      const q = [[X - w / 2, Y], [X - w * 0.42 + lean, Y - h * 0.92], [X + lean * 1.2, Y - h], [X + w * 0.44 + lean, Y - h * 0.88], [X + w / 2, Y]]
      x.beginPath(); q.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath()
      const sg = x.createLinearGradient(X - w / 2, 0, X + w / 2, 0); sg.addColorStop(0, tone(0.42)); sg.addColorStop(0.45, tone(0.2)); sg.addColorStop(1, tone(0.06))
      x.fillStyle = sg; x.fill(); x.strokeStyle = 'rgba(2,3,6,0.6)'; x.lineWidth = 1; x.stroke()
      x.strokeStyle = 'rgba(175,185,220,0.18)'; x.beginPath(); x.moveTo(q[1][0], q[1][1]); x.lineTo(q[2][0], q[2][1]); x.stroke()
    }
    x.restore()
    // the druid and the queen on his back, near, either side of the stones, looking out with us
    const fh = H * 0.075
    for (const [im, X] of [[queen, PX - W * 0.27], [druid, PX + W * 0.27]]) {
      if (!im.complete || !im.naturalWidth) continue
      const w = fh * im.naturalWidth / im.naturalHeight, Y = top(X) + H * 0.1
      x.save(); x.imageSmoothingEnabled = false; x.filter = 'brightness(0.5) saturate(0.6)'; x.drawImage(im, X - w / 2, Y - fh, w, fh); x.restore()
      if (im === druid) L.staff = [X + w * 0.36, Y - fh * 0.98]; else L.hand = [X + w * 0.1, Y - fh * 1.08]
    }
    // moonlight: a rim along the left of his neck and head; mist where his back meets the hills
    x.save(); x.strokeStyle = 'rgba(190,200,235,0.35)'; x.lineWidth = 1.4; x.beginPath()
    x.moveTo(PX - S * 2.4, hy + S * 1.6); x.bezierCurveTo(PX - S * 1.2, hy + S * 1.1, PX - S * 0.95, hy + S * 0.9, PX - S * 0.9, hy + S * 0.3); x.bezierCurveTo(PX - S * 0.85, hy - S * 0.35, PX - S * 0.4, hy - S * 0.65, PX - S * 0.05, hy - S * 0.68); x.stroke(); x.restore()
    const ms = x.createLinearGradient(0, H * 0.76, 0, H * 0.83); ms.addColorStop(0, 'rgba(130,145,195,0)'); ms.addColorStop(0.5, 'rgba(130,145,195,0.12)'); ms.addColorStop(1, 'rgba(130,145,195,0)')
    x.fillStyle = ms; x.fillRect(0, H * 0.76, W, H * 0.07)
    return c
  }
  // (the druid and queen may load after the land is painted: paint it again then)
  for (const im of [druid, queen]) im.addEventListener('load', () => { land = null })

  raf = requestAnimationFrame(frame)
  let gone = false
  const api = {
    destroy() {
      if (gone) return; gone = true
      cancelAnimationFrame(raf); window.removeEventListener('resize', layout); cv.remove(); music.hush(true)
      for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.removeEventListener(ev, wakeAudio, true)
      document.removeEventListener('visibilitychange', onVis)
    },
    setEnglishOpacity(v) { englishOpacity = v },
    englishOpacity() { return englishOpacity },
    // where the moon is, as { cx, cy, d } in px (heroSlots.js sets a saved hero's face on it)
    moonGeometry() { const mp = moonAt() || [PX, PY]; return { cx: mp[0], cy: mp[1], d: mR * 2 * 0.92 } },
    // from in the water to whatever has come up underneath: the sky fades out over `ms`, its music with it, and goes
    handOver(ms = 1400) {
      if (gone) return
      music.hush(true); cv.style.pointerEvents = 'none'; cv.style.transition = `opacity ${ms}ms ease`
      requestAnimationFrame(() => { cv.style.opacity = '0' })
      setTimeout(() => api.destroy(), ms + 100)
    },
  }
  return api
}
