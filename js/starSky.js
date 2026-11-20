// starSky.js -- the host in the sky: choosing a champion by turning the night sky.
//
// Thousands of stars, and among them 300 small constellations, one for each champion, their names set by them as on a star
// chart. We stand on the back of a great stone bull looking where he looks; the finger wheels the sky (drag; flick and it
// coasts). The constellation at the sight, above his horns, is lit: its name rises high in the sky in starlight with the
// champion dancing over it, and its name stands gold by its stars too.
//
// The opening: the moon hangs big and dark in an empty night under the game's name in gold, waiting for a touch. Any touch
// wakes it: it flares, the harp runs up, it glides to nearly half, and the English of the name bangs in under the Irish
// (and after that comes and goes as the moon fills and empties: hold the moon and it fills; swipe it and the light
// follows the finger, round and round, as the ogham dial's did). The sky can be turned at once (a real drag, off the
// moon). The name fades
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
import { ornamentPlan, tunePitchClasses } from './game/systems/music/abcOrnaments.js'
import { FONTS, TYPE } from './game/systems/gameTypography.js'
import { paintScene } from './skyIsland.js'                              // the far land: Tír na nÓg across the western sea
import { hopMsForTuneKey } from './game/effects/championDance.js'
import { getTuneKeyForChampion } from './game/systems/music/championTuneMapping.js'
import { LANDS } from './skyLands.js'
import { englishAlpha, englishPhaseFromAlpha } from './game/settings/gameSettings.js'   // [enCurve]
import { createCourt } from './skyCourt3d.js'
import { paintSkyGradient } from './game/systems/nightPalette.js'
import { drawMoonFace } from './game/ui/moonFace.js'
import { createIntroDrone } from './game/systems/music/introDrone.js'

const FOV = 62 * Math.PI / 180          // across the screen
const N_BG = 7000                       // faint stars between the constellations, clustered by a noise over the sky
const N_BAND = 3600                     // and more of them, crowded along a band across the sky
const N_DUST = 260                      // soft glows where the stars are thickest
const N_MYST = 90                       // the sky's own constellations, not anyone's: faint lines among the faint stars
const GOLD = '#e9c46a'
const STAR = '#f1eeff', STAR_GLOW = '#b9b0ff'                 // names: bright cold starlight, a touch of lavender
const GA = 'Aonchlo, Urchlo, Georgia, serif'               // the Irish (the title's)
const NAME_FONT = 'Urchlo, Aonchlo, Georgia, serif'         // the champions' names in the sky: the game's own Irish face, clear at any size
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
export function initStarSky({ champions, englishOpacity = 0.5, onChoose = () => {}, parent = document.body, tune = POC, stand = 'bull', opening = true, title = null, onWake = () => {}, onReady = () => {} } = {}) {
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
  try { for (const fnt of ['48px IrishPenny', '24px Aonchlo', '24px Urchlo', '48px RussoOne', '48px UncialAntiqua', '48px Aonchlo']) document.fonts?.load(fnt) } catch (e) { }   // (the canvas only draws with a font once it is loaded)
  const cv = document.createElement('canvas'); let g = cv.getContext('2d')        // (let: the dive draws aside, to a second canvas, for a moment)
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;touch-action:none;z-index:50;background:#02040b'
  parent.appendChild(cv)
  const TILT = false                                                   // (the tilt-shift: the near court softened, as in the ogham dial; false to drop it)
  let tiltEl = null
  if (TILT) { tiltEl = document.createElement('div'); tiltEl.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:24%;z-index:51;pointer-events:none;backdrop-filter:blur(3.5px);-webkit-backdrop-filter:blur(3.5px);-webkit-mask-image:linear-gradient(to top,#000 0,#000 40%,transparent 100%);mask-image:linear-gradient(to top,#000 0,#000 40%,transparent 100%)'; parent.appendChild(tiltEl) }
  // the moon and the pool (see the top). `stage`: dark (waiting for a touch), title (the name up), rise (the name fading,
  // the moon shrinking up and aside, the land coming up), browse (the sky), dive (into the pool), under (in the water)
  const TITLE = title || { ga: ['Fiannaíocht'], en: 'FENIAN QUEST' }
  let stage = opening ? 'dark' : 'browse', wakeT = 0, lastMoonT = 0, fadeT = 0, tiltT = 0, tiltDone = opening ? 1e-9 : 1, tiltLast = 0, flareT = -1e9, riseRot = null
  const RISE_TO = [0.22, 0.17], RISE_SHRINK = 0.55                     // (where the moon rises to, as fractions of the screen; how small it ends)
  if (opening) englishOpacity = 0
  let mdir = null, mR = 0, mdrag = null, parS = 0, parW = 0, parV = 0, calm = 1, dive = null, under = false, underT = 0, pendingHand = null, diveTold = false, handStart = null
  const ripples = []
  const PP = new Float32Array(1400 * 4); let ppn = 0                     // (the sky's stars about the sight, as drawn this frame: x, y, brightness, size; the pool mirrors them)
  const capt = (x, y, a, s) => { if (ppn < 1400 && (x - PX) * (x - PX) + (y - PY) * (y - PY) < W * W * 0.25) { const q = ppn++ * 4; PP[q] = x; PP[q + 1] = y; PP[q + 2] = a; PP[q + 3] = s } }
  // the moon's phase as the ogham dial's moon had it: unbounded, so one drag goes on round, light to dark to light. The
  // first half of each turn waxes, lit from the side the finger comes from, the second wanes; the terminator is tilted,
  // and the light follows the finger across it. englishOpacity is the lit share
  const cyc = (r) => ((r % 2) + 2) % 2, MOON_TILT = -35 * Math.PI / 180, ADV = [Math.cos(MOON_TILT), Math.sin(MOON_TILT)]
  let moonRaw = englishPhaseFromAlpha(englishOpacity); englishOpacity = moonRaw   // [enCurve] the API speaks in opacity (lit^2); in here englishOpacity is the lit share
  const setRaw = (r) => { moonRaw = r; const c = cyc(r); englishOpacity = c <= 1 ? c : 2 - c }
  // the champions themselves, from their sheet, to dance over the name
  const sheet = new Image(); let atlas = null
  sheet.src = 'assets/champions/champions0.png'
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
  const TONE = (k) => { const a = [4, 7, 16], b = [78, 100, 156]; k = Math.max(0, Math.min(1, k)); return `rgb(${a.map((v, j) => v + (b[j] - v) * k | 0).join(',')})` }
  let court = null
  const cam = { x: 0, y: 1.7, z: 0, pitch: 0, hy: 0 }                 // (the court's camera; see skyCourt3d.js)
  let skyPitch = 0, RS = null                                           // (the sky seen by that camera, bowed with it in the dive)
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
    const mtn0 = mtn                                                 // (until the land is painted: its own skyline replaces this, L.sky)
    const headY = H * 0.705                                          // the back of his skull, over the mountains
    PX = W / 2; PY = H * 0.5                                         // the sight: up where his horns lead the eye
    L = { rr, water, mtn: (X) => (L.sky ? L.sky(X) : mtn0(X)), headY, tipY: headY - rr * 2.5, bull: [PX - rr * 3.7, headY - rr * 2.8, PX + rr * 3.7, H] }
    land = null                                                      // (the land is drawn once, to a canvas, then reused)
    // the court in the round (stand 'court3d'): the land a camera can move through; the painted land is then only the far
    // mountains and hills
    court = stand === 'court3d' ? createCourt({ W, H, f, PX, dpr: DPR, druid, queen, tone: TONE }) : null
    if (court) { L.water = court.HY + 6; cam.hy = court.HY }
  }
  // a change of size (going fullscreen, notably) clears the canvas: draw again at once, with the frame before laid over
  // the new one and dissolving into it, so there is neither a blank nor a jump
  let snap = null
  function onResize() {
    try { if (W && H && cv.width) { const c = snap?.c || document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0); snap = { c, t: performance.now(), w: W, h: H } } } catch (e) { snap = null }
    layout()
    try { const now = performance.now(); draw(now, lastSettled); veil(now) } catch (e) { }
  }
  function veil(now) {
    if (!snap) return
    const u = (now - snap.t) / 500; if (u >= 1) { snap = null; return }
    g.save(); g.globalAlpha = 1 - u * u * (3 - 2 * u); g.drawImage(snap.c, (W - snap.w) / 2, (H - snap.h) / 2, snap.w, snap.h); g.restore()
  }
  layout(); window.addEventListener('resize', onResize)
  const moonR = () => Math.round(Math.min(W * 0.3, H * 0.18))
  const tileR = () => Math.max(24, Math.round(Math.min(W, H) * 0.055))
  // the pool: where the moon tile sits in the game (its centre STATUS_H + JOY_R = 102px up), wider than the tile and flat
  const pool = () => {
    if (court) { const w = court.wellOnScreen(cam); return w ? { cx: w.cx, cy: w.cy, rx: w.rx * TILE_IN, ry: w.ry * TILE_IN } : { cx: PX, cy: H * 2, rx: 1, ry: 1 } }
    const rx = Math.max(40, tileR() * 1.7); return { cx: PX, cy: H - 102 + landOff(), rx, ry: rx * 0.8 }
  }   // (nearly round: the moon tile, laid in the ground)
  const landOff = () => court ? 0 : (1 - tiltDone) * H * 0.55
  const moonAt = () => mdir ? proj(mdir) : null

  let R = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  const toward = (c) => { const ax = cross(c, [0, 0, 1]), an = Math.acos(Math.max(-1, Math.min(1, c[2]))); return Math.hypot(...ax) > 1e-9 ? axisAngle(ax, an) : null }
  { const T = toward(opening ? MOON_DIR : cons[Math.floor(Math.random() * N)].c); if (T) R = T }   // (opening: the moon dead ahead)
  mdir = MOON_DIR
  const proj = (v) => { const c = mul(RS || R, v); if (c[2] < 0.12) return null; return [PX + f * c[0] / c[2], PY - f * c[1] / c[2], c[2]] }

  // the finger: drag to wheel the sky; flick it and it coasts a long way, slowing gently (heavy: see FLICK, VMAX)
  // the sky is heavy: a flick adds only a part of the finger's speed to the sky's own, so it takes swipe on swipe to wind
  // it up, toward a top speed it can't pass; a swipe against its turning slows it; the finger drags it with a little lag
  const FLICK = 0.3, VMAX = 1.3, LAG = 70                            // (the share of a flick kept; top speed, px/ms; drag lag, ms)
  let drag = null, vx = 0, vy = 0, lastT = 0, actx = null, seek = -1, carry = [0, 0], pend = [0, 0]
  // parallax: the sky's wheeling slides the land, near layers more than far, and the court's camera with it (metres per pixel of slide)
  const PAR_MAX = 0.45, PAR_M = 0.3
  const parSlide = () => PAR_MAX * W * Math.tanh(parS / (PAR_MAX * Math.max(1, W)))
  const parCx = () => PAR_M / (PAR_MAX * Math.max(1, W))
  // (reversed: the court, nearest, hardly moves; the far land moves most, wrapping round; the sky, farthest, wheels freely)
  const LIT = 0.5                                                      // (the strength of the live lights, glints, reflections and waves: 1 as made)
  const PAR_K = { far: 0.55, mid: 0.38, arch: 0.25, boats: 0.38 }, PAR_KV = { far: 1, mid: 0.65, arch: 0.4, boats: 0.65 }
  const parVert = () => { const m = 0.07 * H; return m * Math.tanh(parV / Math.max(1, m)) }
  const turn = (dx, dy) => { if (court) { parS += dx * 0.4; parW += dx; parV += dy * 0.5 }; R = mmul(mmul(axisAngle([1, 0, 0], dy / f), axisAngle([0, 1, 0], dx / f)), R) }
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
    else if (stage === 'title') { const mp = moonAt(); if (mp && Math.hypot(x - mp[0], y - mp[1]) < mR * 1.25) what = 'moon' }
    else {
      const P = pool(), mp = moonAt()
      if (tiltDone > 0.6 && Math.pow((x - P.cx) / (P.rx * 1.45), 2) + Math.pow((y - P.cy) / (P.ry * 1.55), 2) < 1) what = 'pool'
      else if (mp && Math.hypot(x - mp[0], y - mp[1]) < Math.max(mR * 1.35, 30)) what = 'moon'
    }
    if (!what) return false                                             // (the sky: dragged far enough, it takes the name away; see pointermove)
    if (stage === 'dark') wakeMoon()
    mdrag = { what, x, y, t: performance.now(), ph: moonRaw, moved: false }
    try { cv.setPointerCapture(e.pointerId) } catch (er) { }
    lastMoonT = performance.now()
    return true
  }
  function moveMoon(e) {
    const dx = e.clientX - mdrag.x, dy = e.clientY - mdrag.y, dist = Math.hypot(dx, dy)
    if (!mdrag.moved) {
      if (dist <= 10) return
      // moving now: the phase goes on from wherever it is (a tap's glide may have taken it on), from here
      mdrag.moved = true; wakeFill = null; mdrag.ph = moonRaw; mdrag.x = e.clientX; mdrag.y = e.clientY; return
    }
    setRaw(mdrag.ph + (dx * ADV[0] + dy * ADV[1]) / (W * 0.8)); lastMoonT = performance.now()   // (the light goes the way the finger goes)
  }
  function endMoon(e) {
    const m = mdrag; mdrag = null
    if (!m.moved && performance.now() - m.t < 280) { if (m.what === 'pool') choose(e.clientX, e.clientY); else { flareT = performance.now(); tapFill() } }
  }
  // the ogham dial's drone: an open fifth (in D, with the waking run) from the first touch, swelling while the name is up
  // and as the moon is filled; let go, blooming, as the land comes up and the harp takes the tune
  let drone = null, droneT = 0
  function droneOn() { try { if (!drone && actx) { drone = createIntroDrone(actx, actx.destination, { transpose: 2 }); drone.begin() } } catch (e) { drone = null } }
  function rise() {                                                     // the name fades, the moon shrinks up and aside, the land comes up
    if (stage !== 'title') return
    try { drone?.release() } catch (e) { }
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
  // a tap on the moon brings it up to four fifths, gliding, on the side it is on (unless it is brighter already)
  const TAP_FILL = 0.8                                  // [fill80] a touch waxes the moon to four fifths lit
  let wakeFill = null, riseHold = 0
  const onFsChange = () => { if (wakeFill && wakeFill.pend && wakeFill.fs == null) wakeFill.fs = performance.now() }
  document.addEventListener('fullscreenchange', onFsChange); document.addEventListener('webkitfullscreenchange', onFsChange)
  function tapFill() {
    if (englishOpacity >= TAP_FILL) return
    const c = cyc(moonRaw), base = moonRaw - c
    // [wakeWait] the first touch also takes the game fullscreen, which blacks the screen out for a moment: the moon waits for the
    // black to come and go (or for 1.6 s, if there is none), so the waxing is seen
    // [wakeWait2] Android blacks the screen while it resizes into fullscreen (the browser's own black, not ours). So the moon waits for the
    // 'fullscreenchange' event plus a beat for the black to clear (or 1 s, if none comes), and the auto-rise is held back so there is time to read.
    const noBlack = !!(document.fullscreenElement || document.webkitFullscreenElement) || !(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)
    const now0 = performance.now()
    wakeFill = { a: moonRaw, b: c <= 1 ? base + TAP_FILL : base + 2 - TAP_FILL, t: noBlack ? now0 : 0, pend: !noBlack, w: now0, fs: null }
    if (noBlack) riseHold = now0 + 1100 + 5000
  }
  function wakeMoon() {                                                   // the first touch: the moon flares, the harp runs up, the name strikes
    stage = 'title'; wakeT = performance.now(); flareT = wakeT; tapFill()
    audio(); if (actx) { music.start(actx); music.flourish(); droneOn() }
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
    if (stage === 'title' && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 28) rise()   // (a real drag of the sky, not a slip of the finger)
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
          // the triplets the tune writes ((3Bcd): even among themselves, from their lilted start to their lilted end
          const tg = new Map(); for (const n of notes) if (n.tupletGroupId != null) { const q = tg.get(n.tupletGroupId); q ? q.push(n) : tg.set(n.tupletGroupId, [n]) }
          for (const q of tg.values()) { const a = q[0].mp, b = q[q.length - 1].mp + durOf(q[q.length - 1]), L0 = a + devAt(a), L1 = b + devAt(b); q.forEach((n, k) => { n.dv = L0 + (L1 - L0) * k / q.length - n.mp }) }
          // the ornaments it marks (~ rolls, {} grace notes), as the notes a harper plays for them (abcOrnaments.js): when,
          // in quavers from the note's place, in the lilt
          const tpc = tunePitchClasses(notes)
          for (const n of notes) {
            const pl = ornamentPlan(n, tpc); if (!pl) continue
            n.orn = pl.map(q => {
              let at
              if (q.trip) { const [s0, k, sp] = q.trip, a = n.mp + s0, b = a + sp, L0 = a + devAt(a), L1 = b + devAt(b); at = L0 + (L1 - L0) * k / 3 }
              else at = q.o < 0 ? n.mp + n.dv + q.o : n.mp + q.o + devAt(n.mp + q.o)
              return { o: at - n.mp, m: q.m, v: q.v }
            })
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
            const vv = vel * (0.78 + 0.32 * n.w + (Math.random() - 0.5) * 0.06)
            if (density >= 1 && n.orn) for (const q of n.orn) pluck(q.m, vv * q.v, Math.max(ctx.currentTime, next + q.o * E), ring)   // (at rest, ornamented)
            else if (density >= 1 || n.w >= 1 - density) pluck(n.midi, vv, next + n.dv * E, ring)
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
  let calmOk = false, calmN = 0                                          // (the sky is ready when it has held a steady frame rate for a moment: the title's animation waits for that, not for the first dropped frames)
  let ringA = 0, wndA = 0, fdt = 16, focus = -1, held = 0, chosen = null, raf = 0, tick = 0, nameA = 0, arrival = null, arrived = -1, meteor = null, nextMeteor = performance.now() + 4000
  const flecks = []                                                    // (the letters going up into the sky)
  // the choice: a touch on the pool when a champion rests at the sight. Its ripples spread and calm, and in the water is
  // that champion's sign; then down into the water
  const choose = (x, y) => {
    if (focus < 0 || chosen || dive || !(lastSettled && held > 250)) return
    const k = cons[focus], P = pool(), now = performance.now(); chosen = { k, t: now }
    dive = { t: now, k, x0: P.cx, y0: P.cy, rx0: P.rx, ry0: P.ry, sign: lastSign }; stage = 'dive'
    for (let i = 0; i < 3; i++) ripples.push({ u: (x - P.cx) / P.rx, v: (y - P.cy) / P.ry, t: now + i * 240, a: 1 })
    try { navigator.vibrate?.([12, 40, 24]) } catch (e) { }
  }
  let lastSettled = false, lastSign = null
  const ARC = () => ({ cx: PX, cy: H * 0.28 + L.rr * 12.5, rad: L.rr * 12.5, fs: Math.round(Math.min(48, W / 8.2)) })
  const LABEL_R = 0.7                                                 // how far from the sight the constellations' own names show (radians)
  let labels = []                                                      // (where they were drawn, for touching)
  function nameLetters(str) {                                         // where each letter of a name sits on the arc; the size shrinks until even the longest name fits the screen
    const { cx, cy, rad, fs: fs0 } = ARC()
    let fs = fs0, sp = 0, ws = [], tot = 0
    g.save()
    for (let n = 0; n < 40; n++) {
      g.font = `${fs}px ${NAME_FONT}`; sp = fs * 0.22; ws = [...str].map(c => g.measureText(c).width + sp); tot = ws.reduce((x, y) => x + y, 0) - sp
      if (rad * Math.sin(Math.min(Math.PI / 2, tot / rad / 2)) + fs * 0.6 <= W * 0.46 || fs <= 14) break
      fs = Math.max(14, fs * 0.96)
    }
    g.restore()
    let ang = -Math.PI / 2 - tot / rad / 2
    return [...str].map((c, i) => { const m = ang + (ws[i] - sp) / 2 / rad; ang += ws[i] / rad; return { c, x: cx + Math.cos(m) * rad, y: cy + Math.sin(m) * rad, rot: m + Math.PI / 2, fs } })
  }
  // when the sky moves on, the name rises and fades, its letters spreading apart along a widening arc
  // [meanings] the title shows the whole English name-meaning; the manual \n breaks in the data are just wraps (long ones wrap to two lines below)
  const shortMeaning = (s) => (s ? s.replace(/\s*\n\s*/g, ' ').trim() : '')
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
    const nl = nameLetters(k.ch.nameGa)
    flecks.push({ ls: nl.map(q => ({ c: q.c, m: Math.atan2(q.y - cy, q.x - cx) })), cx, cy, rad, fs: nl[0]?.fs || fs, a0: a, age: 0 })
  }

  function frame(now) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(50, now - (lastT || now)); lastT = now
    // the opening's stages: the name up a while (longer while the moon is being played with), then fading; the tilt
    if (stage === 'title' && !mdrag && now > Math.max(wakeT + 6000, lastMoonT + 3500, riseHold)) rise()
    if (tiltT && tiltDone < 1) {                                         // the rise: the sky turns, carrying the moon up and aside
      const u = Math.min(1, (now - tiltT) / 2800), e = u * u * (3 - 2 * u)
      if (riseRot) R = mmul(axisAngle(riseRot.ax, riseRot.ang * (e - tiltLast)), R)
      tiltLast = e; tiltDone = Math.max(1e-9, e)
      if (u >= 1) { tiltDone = 1; stage = 'browse'; held = 0; if (!drag) { vx = 0.17 * (Math.random() < 0.5 ? -1 : 1); vy = 0 } }   // (it does not stop dead: the sky carries on, past a few of the champions, and slows to rest on its own, so a first-time player sees it move)
    }
    if (wakeFill && wakeFill.pend && ((wakeFill.fs != null && now - wakeFill.fs > 300) || now - wakeFill.w > 1000)) { wakeFill.pend = false; wakeFill.t = now; riseHold = now + 1100 + 5000 }
    if (wakeFill && !wakeFill.pend) { const u = Math.min(1, (now - wakeFill.t) / 1100); setRaw(wakeFill.a + (wakeFill.b - wakeFill.a) * (u * u * (3 - 2 * u))); lastMoonT = now; if (u >= 1) wakeFill = null }
    if (mdrag && !mdrag.moved && now - mdrag.t > 260) {                  // (held: filling, back toward the nearest full)
      wakeFill = null
      const tg = 2 * Math.round((moonRaw - 1) / 2) + 1, st = dt / 2600; setRaw(Math.abs(tg - moonRaw) <= st ? tg : moonRaw + Math.sign(tg - moonRaw) * st); lastMoonT = now
    }
    if (drone && stage === 'title' && now - droneT > 250) { droneT = now; drone.progress(Math.min(1, (now - wakeT) / 7000 * 0.75 + englishOpacity * 0.35)) }
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
      focus = best; held = 0; nameA = 0; arrived = -1
      music.want(cons[best].ch)
    }
    const settled = !moving && dist < (drag ? 0.1 : 0.05)                 // (under a held finger, near enough is enough)
    if (settled) {
      if (held === 0 && stage === 'browse' && arrived !== focus) {     // a champion arrives: its stars flare (once each time the
        try { navigator.vibrate?.(8) } catch (e) { }                    //  sight comes to it, however a slow finger stops and starts)
        arrival = { t: now, i: focus }; arrived = focus
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
    parV *= Math.exp(-dt / 2500)
    parS *= Math.exp(-dt / 4500)                                      // (the land eases back to its resting place when the sky is still)
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
    // the court's camera: at rest, or (opening) looking up from the land at first; in the dive, on its way into the well;
    // the sky seen through it, bowed with it
    if (court) {
      if (dive) diveCam(now - dive.t)
      else { cam.x = -parSlide() * parCx(); cam.z = 0; cam.y = court.EYE; cam.hy = court.HY; cam.pitch = opening ? -0.75 * (1 - tiltDone) : 0 }
      skyPitch = Math.max(0, cam.pitch); const c = Math.cos(skyPitch), sn = Math.sin(skyPitch)
      RS = skyPitch > 1e-4 ? mmul([1, 0, 0, 0, c, sn, 0, -sn, c], R) : null
      if (pendingHand && stage === 'under' && now - underT > 700) { const m = pendingHand; pendingHand = null; api.handOver(m) }
    }
    if (!calmOk) { calmN = dt < 34 ? calmN + 1 : 0; if (calmN >= 24 || now - bornT > 4500) { calmOk = true; try { onReady() } catch (e) { } } }
    fdt = dt; draw(now, settled); veil(now)
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
    ppn = 0
    const bk = Array.from({ length: BUCKETS }, () => [])
    for (const s of bg) {
      const p = proj(s.v); if (!p || p[0] < -2 || p[0] > W + 2 || p[1] < -2 || p[1] > wl + 2) continue
      const a = Math.min(1, s.m * (0.65 + 0.35 * Math.sin(t * s.tf + s.tw)))
      capt(p[0], p[1], a, s.s)
      bk[Math.min(BUCKETS - 1, Math.floor(a * BUCKETS))].push(p[0] - s.s / 2, p[1] - s.s / 2, s.s)
    }
    bk.forEach((arr, b) => { if (!arr.length) return; g.fillStyle = `rgba(225,232,255,${((b + 0.5) / BUCKETS).toFixed(3)})`; for (let i = 0; i < arr.length; i += 3) g.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 2]) })
    g.save(); g.lineWidth = 0.7
    for (const m of myst) {
      const P = m.pts.map(proj)
      P.forEach((p, j) => { if (p && p[1] < wl) { g.fillStyle = `rgba(215,225,250,${m.m[j].toFixed(3)})`; g.fillRect(p[0] - 1, p[1] - 1, 2, 2); capt(p[0], p[1], m.m[j], 2) } })
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
        g.fillStyle = `rgba(244,246,255,${a.toFixed(3)})`; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill(); capt(p[0], p[1], a, r * 1.3)
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
      g.font = `${q.fs}px ${NAME_FONT}`; g.fillStyle = STAR; g.shadowColor = STAR_GLOW; g.shadowBlur = 8
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
    const lfs = Math.round(Math.max(15, Math.min(22, W / 18)))
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
    if (focus >= 0 && nameA > 0.2) { const { cy, rad, fs } = ARC(); placed.push(box([PX - W * 0.45, cy - rad + fs * 0.5, PX + W * 0.45, cy - rad + fs * 0.5 + 100])) }
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
      cand.push({ i, k, a: a * tiltDone * (dive ? 0 : 1), pos, ang, nx, ny, w, own: i === focus, pr: i === focus ? 1e9 : k.shown ? 1e6 - k.since : -k.d })
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
    drawLand(t, settled)                                                 // (the land, the stones and the fog over the names: they are in the sky)
    // the name at the sight, large, in its arc
    if (focus >= 0 && nameA > 0.01) {
      g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'
      for (const q of nameLetters(cons[focus].ch.nameGa)) {
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.globalAlpha = Math.min(1, nameA); g.font = `${q.fs}px ${NAME_FONT}`; g.fillStyle = STAR
        g.lineWidth = 3; g.strokeStyle = 'rgba(4,6,18,0.55)'; g.lineJoin = 'round'; g.strokeText(q.c, 0, 0)                 // (a dark edge: legible over the moon)
        g.shadowColor = STAR_GLOW; g.shadowBlur = settled ? 18 : 8; g.fillText(q.c, 0, 0); g.restore()
      }
      g.restore()
      // what the name means, small, under it, in English: as faint as the moon allows
      const mean = shortMeaning(cons[focus].ch.nameEn)
      if (mean) {                                                                                // (straight, at dialogue size)
        const A = ARC(), want = TYPE.domBodyEn.sizePx || 27, maxW = W * 0.9, al = Math.min(1, nameA) * englishAlpha(englishOpacity)
        g.save(); let es = want, lines = [mean]
        g.font = `${es}px ${EN}`
        if (g.measureText(mean).width > maxW) {                                                  // too wide: break at a space into two lines, shrinking only if even that is too wide
          const ws = mean.split(' ')
          if (ws.length > 1) { let best = null; for (let i = 1; i < ws.length; i++) { const l = [ws.slice(0, i).join(' '), ws.slice(i).join(' ')], w = Math.max(...l.map(t => g.measureText(t).width)); if (!best || w < best.w) best = { l, w } } lines = best.l }
          for (; es > 16; es--) { g.font = `${es}px ${EN}`; if (Math.max(...lines.map(t => g.measureText(t).width)) <= maxW) break }
        }
        const wid = Math.max(...lines.map(t => g.measureText(t).width)), drop = A.rad - Math.sqrt(Math.max(0, A.rad * A.rad - (wid / 2) * (wid / 2)))
        const y0 = A.cy - A.rad + A.fs * 0.55 + es * 0.85 + drop
        { const sw = wid / 2 + 46, sh = lines.length * es * 0.6 + 40, cyy = y0 + (lines.length - 1) * es * 0.6                 // (a soft dark scrim behind the English: no edge)
          g.save(); g.globalAlpha = Math.min(1, nameA) * Math.min(1, englishAlpha(englishOpacity) * 3) * 0.95; g.translate(PX, cyy); g.scale(1, sh / sw); const sg = g.createRadialGradient(0, 0, 0, 0, 0, sw); sg.addColorStop(0, 'rgba(3,5,16,0.8)'); sg.addColorStop(0.6, 'rgba(3,5,16,0.5)'); sg.addColorStop(1, 'rgba(3,5,16,0)'); g.fillStyle = sg; g.fillRect(-sw, -sw, 2 * sw, 2 * sw); g.restore() }
        g.globalAlpha = al; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = 'rgba(4,6,18,0.55)'; g.fillStyle = '#e2dccb'
        lines.forEach((t, i) => { const y = y0 + i * es * 1.2; g.strokeText(t, PX, y); g.fillText(t, PX, y) })
        g.restore() }
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
    // the game's name, over the moon: the Irish in gold from the first, waiting with the dark moon; the English beneath it
    // only as the moon allows, and its first coming a bang (see enBang)
    const titleA = stage === 'dark' || stage === 'title' ? 1 : stage === 'rise' ? Math.max(0, 1 - (now - fadeT) / 1500) : 0
    if (titleA > 0.01) {
      // (above the moon: the foot of the screen is the saved heroes' and, until fullscreen is granted, the fog's)
      const mp = moonAt() || [PX, PY], fs = Math.round(Math.min(56, W / 6.4)), blockH = fs * 1.05 * (TITLE.ga.length - 1) + fs * 0.95 + fs * 0.4 + fs * 0.15
      const ty = mp[1] - mR - Math.min(60, H * 0.06) - blockH + fs * 0.5
      let gaOk
      if (titleA < 0.99) {                                               // fading: the whole title drawn at full strength aside, then laid down at one alpha
        const k = W + '|' + H + '|' + DPR
        if (!gaGroup || gaGroup.k !== k) { const [c, x] = gaCanvas(W, H); gaGroup = { k, c, x } }
        const keep = g; g = gaGroup.x; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H)
        try { gaOk = drawGaTitle(now, fs, ty, 1) } finally { g = keep }
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = titleA; g.drawImage(gaGroup.c, 0, 0); g.restore()
      } else gaOk = drawGaTitle(now, fs, ty, titleA)
      if (!gaOk && now - bornT > 4000) {    // (nothing is drawn until the arcade name is ready; if its font never loads, plain gold after four seconds)
        g.save(); g.translate(PX, ty); g.textAlign = 'center'; g.textBaseline = 'middle'
        g.font = `${fs}px ${GA_FONT}, ${GA}`; g.fillStyle = GOLD; g.shadowColor = GOLD; g.shadowBlur = 16; g.globalAlpha = titleA * (stage === 'dark' ? Math.min(1, (now - bornT) / 1500) : 1)
        TITLE.ga.forEach((l, i) => g.fillText(l, 0, i * fs * 1.05))
        g.restore()
      }
      const ea = titleA * enOf(englishOpacity)
      if (ea > 0.01 || (bang && now - bang.t < 1800)) {
        const efs = Math.round(fs * 0.4), ey = gaLay ? gaLay.yS + gaLay.fs * 1.1 : ty + fs * 1.05 * (TITLE.ga.length - 1) + fs * 0.95 + fs * 0.15, ex = gaLay ? PX + gaLay.cx : PX; let sp = efs * 0.35
        g.save(); g.font = `${efs}px ${EN}`; g.textBaseline = 'middle'; g.textAlign = 'left'
        const ws = [...TITLE.en].map(c => g.measureText(c).width), sumw = ws.reduce((a, b) => a + b, 0)
        if (gaLay) sp = Math.max(efs * 0.2, Math.min(efs * 0.9, (gaLay.w * 0.96 - sumw) / (ws.length - 1)))   // (spaced to the width of the Irish beside the stem, so it sits under it)
        const tot = sumw + sp * (ws.length - 1)
        if (!bang && stage === 'title' && ea > 0.01) enBang(now, ex, ey, tot, efs)
        // the kick: it swells, flares white and shakes, and settles (the ogham dial's revealBang, drawn)
        const u = bang ? (now - bang.t) / 900 : 1, env = u < 0.18 ? u / 0.18 : u < 1 ? Math.pow(1 - (u - 0.18) / 0.82, 2) : 0
        const shake = u > 0.18 && u < 1 ? 9 * Math.sin((u - 0.18) * Math.PI * 7) * (1 - u) : 0, sc = 1 + 0.38 * env
        g.translate(ex + shake, ey); g.scale(sc, sc)
        const draw = () => { let xx = -tot / 2; [...TITLE.en].forEach((c, i) => { g.fillText(c, xx, 0); xx += ws[i] + sp }) }
        g.globalAlpha = Math.max(ea, env); g.fillStyle = '#e2dccb'
        if (env > 0.01) { g.shadowColor = 'rgba(255,246,210,0.95)'; g.shadowBlur = 22 * env }
        draw()
        if (env > 0.01) { g.globalAlpha = env * 0.8; g.fillStyle = '#fffbe8'; g.shadowColor = 'rgba(190,220,255,0.8)'; g.shadowBlur = 48 * env; draw() }
        g.restore()
      }
    }
    if (bang) drawSparks(now)
    if (dive) drawDive(now)
  }
  // THE IRISH NAME. A huge F comes first, in a flash of light: Uncial Antiqua's own F, but with its crossbar cut out and its
  // stem stretched far down the screen to a symmetrical point, in a pale cool metal. The other letters (Aonchlo) shoot out of
  // the stem one by one, and last a Celtic spear is thrown in from the right and pierces the stem: its long gold head, down to the
  // first band, is the F's missing crossbar; its smooth wooden shaft runs on beneath the rest of the name as its underline to the
  // pommel, a green ribbon trimmed with gold drifting from the band. All drawn in code (letters baked once to sprites). Nothing at all is drawn
  // until every sprite is ready, so the plain font never shows; if a font never loads, the plain name appears after four seconds.
  const GA_FONT = 'Aonchlo', GA_FFONT = 'UncialAntiqua', GA_BIG = 3.2, GA_BEAT = 250, GA_LAUNCH = 1050, GA_STAG = 100, GA_FLIGHT = 340, GA_THRUST = 480, GA_GLINT = 3600
  let gaGl = null, gaLay = null, gaT0 = null, gaSettle = null, gaLand = [], gaParts = [], gaTwT = 0
  const gaOutBack = (u) => { u = Math.max(0, Math.min(1, u)); const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2) }
  const gaOutCubic = (u) => 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3)
  // THE METAL. While the name is being struck it is iridescent: a pastel rainbow scrolling across the letters, in a different hue each time
  // the game loads. When the spear lands it settles to a bright martial bronze with a faint touch of that rainbow still drifting through it.
  const GA_GLOW = '255,226,196'
  const GA_BRONZE = [[0, '#fff1cc'], [0.22, '#ffd584'], [0.5, '#e8a043'], [0.78, '#b4702a'], [1, '#6c3d14']]
  const GA_IRIBASE = [[0, '#ffffff'], [0.22, '#f6f3ff'], [0.5, '#dcd8f6'], [0.78, '#bcb9e6'], [1, '#9c9bd2']]
  const GA_HUE0 = Math.random() * 360
  let gaM = 0, gaScroll = 0, gaLastN = 0, gaStrip = null, gaPat = null
  const gaRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const gaStops = (m) => GA_BRONZE.map(([k, bz], i) => { const a = gaRGB(GA_IRIBASE[i][1]), c = gaRGB(bz); return [k, `rgb(${Math.round(a[0] + (c[0] - a[0]) * m)},${Math.round(a[1] + (c[1] - a[1]) * m)},${Math.round(a[2] + (c[2] - a[2]) * m)})`] })
  const gaGrad = (x, y0, y1) => { const gr = x.createLinearGradient(0, y0, 0, y1); for (const [k, col] of gaStops(gaM)) gr.addColorStop(k, col); return gr }
  const gaPeriod = () => W * 1.1
  function gaOverlay(x, x0, y0, w, h, Lw) {                // the rainbow, as a translucent layer over what was just filled
    if (!gaStrip) { const c = document.createElement('canvas'); c.width = 256; c.height = 8; const q = c.getContext('2d'), gr = q.createLinearGradient(0, 0, 256, 0); for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, `hsl(${(GA_HUE0 + i * 60) % 360},100%,68%)`); q.fillStyle = gr; q.fillRect(0, 0, 256, 8); gaStrip = c }
    const pt = gaPat || (gaPat = x.createPattern(gaStrip, 'repeat')); pt.setTransform(new DOMMatrix([gaPeriod() / 256, 0, 0, 1, gaScroll - Lw, 0]))
    x.save(); x.globalAlpha = 0.95 * (1 - gaM); x.fillStyle = pt; x.fillRect(x0, y0, w, h); x.restore()
  }
  function gaFill(q, Lw) {                                 // a glyph's metal, made fresh each frame: gradient, rainbow, then cut to the letter's shape
    const bk = q.bk || (q.bk = {}), key = Math.round(Lw)
    if (bk[key]) return bk[key]                                                   // (settled: made once and kept; the same letter twice in the word has its own copy at each place)
    const tx = q.tmp[1]
    tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, q.cw, q.chh)
    tx.fillStyle = gaGrad(tx, q.gy0, q.gy1); tx.fillRect(0, 0, q.cw, q.chh)
    gaOverlay(tx, 0, 0, q.cw, q.chh, Lw)
    tx.globalCompositeOperation = 'destination-in'; tx.drawImage(q.sil, 0, 0, q.cw, q.chh); tx.globalCompositeOperation = 'source-over'
    if (gaM >= 1) {
      if (q.detail) { bk[key] = q.tmp[0]; q.tmp = gaCanvas(1, 1); return bk[key] }                      // (the F is used once: its working canvas is let go)
      const [kc, kx] = gaCanvas(q.cw, q.chh); kx.drawImage(q.tmp[0], 0, 0, q.cw, q.chh); bk[key] = kc; return kc
    }   // (and the working canvas let go: it is not wanted again, so the rainbow stops moving)
    return q.tmp[0]
  }
  let gaGroup = null                                                    // (the spare canvas the fading title is drawn to)
  function gaCanvas(cw, chh) { const c = document.createElement('canvas'); c.width = Math.ceil(cw * DPR); c.height = Math.ceil(chh * DPR); const x = c.getContext('2d'); x.scale(DPR, DPR); return [c, x] }
  function gaGlyph(s, fs) {
    const key = fs + '|' + DPR
    if (!gaGl || gaGl.key !== key) gaGl = { key, m: new Map(), bigF: null, shaft: null, back: null }
    let o = gaGl.m.get(s); if (o) return o
    if (!document.fonts?.check(`${fs}px ${GA_FONT}`)) return null
    const font = `${fs}px ${GA_FONT}`, t = document.createElement('canvas').getContext('2d'); t.font = font
    const w = t.measureText(s).width, pad = Math.ceil(fs * 0.5), cw = Math.ceil(w + pad * 2), chh = Math.ceil(fs * 1.5 + pad * 2), cx = cw / 2, bl = Math.ceil(pad + fs * 1.05)
    const mk = () => { const [c, x] = gaCanvas(cw, chh); x.font = font; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; return [c, x] }
    const [c, x] = mk(), depth = Math.max(3, Math.round(fs * 0.1))
    x.fillStyle = '#0a1020'
    for (let k = depth; k > 0; k--) x.fillText(s, cx + k * 0.5, bl + k)                                  // (the extrusion, down and a little right)
    x.shadowColor = `rgba(${GA_GLOW},0.9)`; x.shadowBlur = fs * 0.28; x.fillStyle = '#887'; x.fillText(s, cx, bl); x.shadowBlur = 0   // (the glow; the metal is laid over it each frame)
    const [sc, sx] = mk(); sx.fillStyle = '#fff'; sx.fillText(s, cx, bl)                                  // (the white form: the metal's mask, and the flashes and glints)
    o = { c, sil: sc, tmp: gaCanvas(cw, chh), gy0: bl - fs * 0.8, gy1: bl + fs * 0.08, w, cw, chh, bl }; gaGl.m.set(s, o); return o
  }
  // the F, drawn in code: a stem that ends in a dagger point, topped by a leaf-shaped finial, a hooked arm and a small serif. No crossbar:
  // the spear's head is that. Measurements are fractions of S, the F's size; the stem is stretched down the screen.
  function gaBigF(S) {
    if (gaGl.bigF) return gaGl.bigF
    // The F is one line: a serpent's head, its neck arching over and coming down as the stem, which tapers evenly to a point (no shoulder).
    // A fan of dots, shrinking, follows the arch. Designed on a grid of 0.0102 S per unit, stem centre at 0.2 S.
    const pad = Math.ceil(S * 0.38), cw = Math.ceil(1.45 * S + pad * 2), chh = Math.ceil(2.25 * S + pad * 2), ox = pad, top = pad
    const k = 0.0102, X = (sx) => ox + 0.2 * S + (sx - 30) * k * S, Yv = (sy) => top + (-0.26 + (sy - 10) * 0.0085) * S, Y = (v) => top + v * S, yTip = Y(2.05), xc = ox + 0.2 * S
    const [M, m] = gaCanvas(cw, chh); m.fillStyle = '#fff'
    const cr = (a, b2, c, d, t) => 0.5 * (2 * b2 + (-a + c) * t + (2 * a - 5 * b2 + 4 * c - d) * t * t + (-a + 3 * b2 - 3 * c + d) * t * t * t)
    const ribbon = (pts) => {                                         // a line of varying width through points [x, y, width] (canvas px), as a filled shape
      const P = (q) => pts[Math.max(0, Math.min(pts.length - 1, q))], sm = [], L = [], R = []
      for (let q = 0; q < pts.length - 1; q++) for (let t = 0; t < 1; t += 0.1) sm.push([0, 1, 2].map(d => cr(P(q - 1)[d], P(q)[d], P(q + 1)[d], P(q + 2)[d], t)))
      sm.push(pts[pts.length - 1])
      sm.forEach((q, n) => { const a = sm[Math.max(0, n - 1)], c = sm[Math.min(sm.length - 1, n + 1)], dx = c[0] - a[0], dy = c[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d; L.push([q[0] + nx * q[2] / 2, q[1] + ny * q[2] / 2]); R.push([q[0] - nx * q[2] / 2, q[1] - ny * q[2] / 2]) })
      m.beginPath(); L.forEach((q, n) => n ? m.lineTo(q[0], q[1]) : m.moveTo(q[0], q[1])); for (let n = R.length - 1; n >= 0; n--) m.lineTo(R[n][0], R[n][1]); m.closePath(); m.fill()
    }
    const wS = (sw) => sw * k * S, W0 = 0.153 * S
    const body = [[xc, yTip, 0.004 * S]]; for (const v of [1.6, 1.15, 0.7, 0.25]) body.push([xc, Y(v), W0 * (2.05 - v) / 1.8])
    for (const [sx, sy, sw] of [[31, 46, 15], [42, 24, 13], [62, 12, 11.5], [80, 17, 10.5], [92, 30, 9.5], [98, 44, 9], [104, 50, 7.5]]) body.push([X(sx), Yv(sy), wS(sw)])
    ribbon(body)
    m.beginPath(); [[98, 42], [108, 38], [120, 40], [128, 46], [126, 50], [116, 54], [104, 54]].forEach(([sx, sy], n) => n ? m.lineTo(X(sx), Yv(sy)) : m.moveTo(X(sx), Yv(sy))); m.closePath(); m.fill()   // (the head)
    ribbon([[X(126), Yv(48), wS(1.6)], [X(134), Yv(46), wS(1.4)], [X(140), Yv(41), wS(1.2)]]); ribbon([[X(134), Yv(46), wS(1.2)], [X(140), Yv(50), wS(1)]])      // (the forked tongue)
    for (const [sx, sy, r] of [[14, 40, 4], [18, 26, 3.6], [28, 14, 3.2], [42, 6, 2.8], [58, 2, 2.4], [75, 3, 2.1], [90, 10, 1.8], [100, 22, 1.5]]) { m.beginPath(); m.arc(X(sx), Yv(sy), r * k * S, 0, 6.2832); m.fill() }   // (the dots)
    m.globalCompositeOperation = 'destination-out'; m.beginPath(); m.arc(X(110), Yv(44), 2 * k * S, 0, 6.2832); m.fill(); m.globalCompositeOperation = 'source-over'   // (the eye)
    const hw = W0 * (2.05 - 0.4475) / 1.8 / 2, xl = xc - hw, xr = xc + hw
    // under the metal: the extruded shadow and the glow
    const [c, x] = gaCanvas(cw, chh), tint = (col) => { const [tc, tx] = gaCanvas(cw, chh); tx.drawImage(M, 0, 0, cw, chh); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = col; tx.fillRect(0, 0, cw, chh); return tc }
    const depth = 0, dark = tint('#0c1428'), glow = tint(`rgba(${GA_GLOW},0.85)`)
    for (let k = depth; k > 0; k--) x.drawImage(dark, k * 0.5, k, cw, chh)
    x.save(); x.shadowColor = `rgba(${GA_GLOW},0.85)`; x.shadowBlur = S * 0.1; x.drawImage(glow, 0, 0, cw, chh); x.restore()
    for (let a = 0; a < 16; a++) x.drawImage(dark, Math.cos(a * 0.3927) * 1.5, Math.sin(a * 0.3927) * 1.5, cw, chh)
    // over the metal: bevels, so it reads as a forged blade (light on the left, shade on the right, a ridge down the point, a groove where the point begins)
    const [dc] = gaCanvas(cw, chh)
    return (gaGl.bigF = { c, sil: M, detail: dc, tmp: gaCanvas(cw, chh), gy0: top - 0.3 * S, gy1: yTip, cw, chh, ox, top, S, barY: top + 0.4475 * S, left: ox, stemL: xl, stemR: xr, armR: ox + 0.9 * S })
  }
  function gaShaft(len, sh) {
    const key = Math.round(len) + '|' + sh.toFixed(1) + '|' + DPR
    if (gaGl.shaft && gaGl.shaft.key === key) return gaGl.shaft.c
    const [c, x] = gaCanvas(len, sh), gr = x.createLinearGradient(0, 0, 0, sh)
    for (const [k, col] of [[0, '#d9a766'], [0.3, '#a97236'], [0.7, '#7b4e22'], [1, '#4a2e14']]) gr.addColorStop(k, col)
    x.fillStyle = gr; x.fillRect(0, 0, len, sh)
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let k = 0; k < Math.round(sh * 3.5); k++) {                     // grain: long thin wandering streaks, dark and light
      const y0 = rnd() * sh, a = 0.1 + rnd() * 0.22, ph = rnd() * 6, fr = 0.02 + rnd() * 0.04
      x.strokeStyle = rnd() < 0.62 ? `rgba(40,20,5,${a})` : `rgba(255,222,165,${a * 0.8})`; x.lineWidth = 0.4 + rnd() * 0.7; x.beginPath(); x.moveTo(0, y0)
      for (let xx = 0; xx <= len; xx += 10) x.lineTo(xx, y0 + Math.sin(xx * fr + ph) * sh * 0.07 + (rnd() - 0.5) * 0.3)
      x.stroke()
    }
    for (let k = 0; k < 3; k++) { const kx = (0.15 + rnd() * 0.7) * len, ky = (0.25 + rnd() * 0.5) * sh; x.strokeStyle = 'rgba(35,16,4,0.5)'; x.lineWidth = 0.8; x.beginPath(); x.ellipse(kx, ky, sh * 0.5, sh * 0.2, 0, 0, 6.2832); x.stroke(); x.beginPath(); x.ellipse(kx, ky, sh * 0.25, sh * 0.1, 0, 0, 6.2832); x.stroke() }
    x.fillStyle = 'rgba(255,240,200,0.45)'; x.fillRect(0, 0, len, Math.max(1, sh * 0.12))   // (a highlight along the top, shade along the bottom)
    const sg = x.createLinearGradient(0, sh * 0.6, 0, sh); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.35)'); x.fillStyle = sg; x.fillRect(0, sh * 0.6, len, sh * 0.4)
    gaGl.shaft = { key, c }; return c
  }
  // the spear, pointing left: a long head (the F's crossbar) from the point down to the first band, then a wooden shaft to the pommel
  function gaSpear(now, tipX, bandX, endX, y, u, S, sh) {
    const Lh = bandX - tipX, w = S * 0.075, wc = S * 0.045, tsec = now / 1000
    g.save(); g.lineJoin = 'round'
    // the wooden shaft (grained, with knots), and the pommel: engraved rings on a cap, then a shaded ball
    g.drawImage(gaShaft(endX - bandX, sh), bandX, y - sh / 2, endX - bandX, sh)
    g.strokeStyle = 'rgba(30,14,4,0.8)'; g.lineWidth = 1; g.strokeRect(bandX, y - sh / 2, endX - bandX, sh)
    g.fillStyle = gaGrad(g, y - sh * 0.95, y + sh * 0.95); g.strokeStyle = '#0c1428'; g.lineWidth = 1.2
    g.fillRect(endX - u * 0.3, y - sh * 0.95, u * 0.3, sh * 1.9); gaOverlay(g, endX - u * 0.3, y - sh * 0.95, u * 0.3, sh * 1.9, 0); g.strokeRect(endX - u * 0.3, y - sh * 0.95, u * 0.3, sh * 1.9)
    g.strokeStyle = 'rgba(40,20,5,0.55)'; g.lineWidth = 1; for (const k of [0.07, 0.15, 0.23]) { g.beginPath(); g.moveTo(endX - u * k, y - sh * 0.95); g.lineTo(endX - u * k, y + sh * 0.95); g.stroke() }
    const br = sh * 1.25, bx = endX + sh * 0.5, st = gaStops(gaM), bg = g.createRadialGradient(bx - br * 0.35, y - br * 0.35, br * 0.08, bx, y, br)
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.3, st[1][1]); bg.addColorStop(0.65, st[3][1]); bg.addColorStop(1, st[4][1])
    g.fillStyle = bg; g.beginPath(); g.arc(bx, y, br, 0, 6.2832); g.fill()
    g.save(); g.beginPath(); g.arc(bx, y, br, 0, 6.2832); g.clip(); gaOverlay(g, bx - br, y - br, br * 2, br * 2, 0); g.restore()
    g.strokeStyle = '#0c1428'; g.lineWidth = 1.2; g.beginPath(); g.arc(bx, y, br, 0, 6.2832); g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(bx - br * 0.35, y - br * 0.38, br * 0.16, 0, 6.2832); g.fill()
    // the head: a long leaf, tip at the left, down to the band
    const head = new Path2D()
    head.moveTo(tipX, y); head.bezierCurveTo(tipX + Lh * 0.28, y - w * 0.8, tipX + Lh * 0.55, y - w * 1.05, tipX + Lh * 0.8, y - w); head.lineTo(bandX, y - wc); head.lineTo(bandX, y + wc); head.lineTo(tipX + Lh * 0.8, y + w); head.bezierCurveTo(tipX + Lh * 0.55, y + w * 1.05, tipX + Lh * 0.28, y + w * 0.8, tipX, y); head.closePath()
    g.save(); g.shadowColor = `rgba(${GA_GLOW},0.7)`; g.shadowBlur = S * 0.05; g.fillStyle = gaGrad(g, y - w, y + w); g.fill(head); g.restore()
    g.save(); g.clip(head); gaOverlay(g, tipX, y - w * 1.2, Lh, w * 2.4, 0); g.restore()
    g.strokeStyle = '#0c1428'; g.lineWidth = 1.5; g.stroke(head)
    const bx0 = bandX - S * 0.01, bw = S * 0.07, bh = wc * 2.9                                                  // (the first band)
    g.fillStyle = gaGrad(g, y - wc * 1.45, y + wc * 1.45); g.fillRect(bx0, y - wc * 1.45, bw, bh); gaOverlay(g, bx0, y - wc * 1.45, bw, bh, 0)
    g.strokeStyle = '#0c1428'; g.lineWidth = 1.5; g.strokeRect(bx0, y - wc * 1.45, bw, bh)
    // the ribbon: green, trimmed and patterned in gold, its fixed edge exactly the height of the band and flush to the band's far edge, then
    // hanging lower as it streams off along the shaft on the breeze. Each section is shaded by how far it has turned.
    {
      const x0 = bandX + S * 0.06, RL = u * 3.6, wd0 = wc * 1.45, n = 36, top = [], bot = [], mid = []
      for (let i = 0; i <= n; i++) {
        const s = i / n, gust = 0.8 + 0.2 * Math.sin(tsec * 0.7), tw = 0.35 + 0.65 * Math.abs(Math.cos(tsec * 1.8 - s * 4.5)), env = Math.min(1, s * 4)
        const wd = wd0 * (1 - s * 0.3) * (1 - env + env * tw), yy = y + s * u * 0.2 + Math.sin(tsec * 2.6 - s * 6) * u * 0.2 * Math.pow(s, 0.85) * gust, xx = x0 + s * RL
        top.push([xx, yy - wd]); bot.push([xx, yy + wd]); mid.push([xx, yy, wd, 0.5 + 0.5 * Math.cos(tsec * 1.8 - s * 4.5 + 0.8)])
      }
      const col = (s, f) => `rgb(${Math.round((24 - 14 * s) * f)},${Math.round((112 - 46 * s) * f)},${Math.round((68 - 32 * s) * f)})`
      const body = new Path2D()
      for (let i = 0; i < n; i++) {
        const q = new Path2D(), last = i === n - 1
        q.moveTo(top[i][0], top[i][1]); q.lineTo(top[i + 1][0], top[i + 1][1])
        if (last) q.lineTo(mid[n][0] - u * 0.3, mid[n][1])
        q.lineTo(bot[i + 1][0], bot[i + 1][1]); q.lineTo(bot[i][0], bot[i][1]); q.closePath(); body.addPath(q)
        g.fillStyle = g.strokeStyle = col(i / n, 0.7 + 0.5 * mid[i][3]); g.lineWidth = 0.8; g.fill(q); g.stroke(q)
      }
      g.save(); g.clip(body)                                             // (light along the top, shade along the bottom, like cloth)
      const vg = g.createLinearGradient(0, y - wd0, 0, y - wd0 + wd0 * 4); vg.addColorStop(0, 'rgba(255,255,255,0.28)'); vg.addColorStop(0.5, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(0,20,10,0.35)')
      g.fillStyle = vg; g.fillRect(x0, y - u, RL + u, u * 3); g.restore()
      g.strokeStyle = '#e9d99a'; g.lineWidth = 1.4; g.beginPath(); top.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); g.beginPath(); bot.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke()
      g.beginPath(); g.moveTo(top[0][0], top[0][1]); g.lineTo(bot[0][0], bot[0][1]); g.stroke()
      g.fillStyle = '#f6e7b0'                                            // (the gold pattern: a row of diamonds, narrowing as the ribbon turns)
      for (const i of [5, 12, 19, 26]) { const [px, py, wd] = mid[i], d = wd * 0.5; if (d < 1) continue; g.beginPath(); g.moveTo(px, py - d); g.lineTo(px + d * 0.8, py); g.lineTo(px, py + d); g.lineTo(px - d * 0.8, py); g.closePath(); g.fill() }
    }
    g.restore()
  }
  function drawGaTitle(now, fs0, ty, alpha) {
    const word = [...TITLE.ga[0]], n = word.length - 1
    g.font = `100px ${GA_FONT}`
    const wR = word.slice(1).reduce((a, ch) => a + g.measureText(ch).width / 100, 0)
    const fs = Math.floor(Math.min(fs0, W * 0.9 / (0.5125 * GA_BIG + 0.11 * GA_BIG + wR + 0.02 * (n - 1)))), S = Math.round(fs * GA_BIG)   // (shrunk to fit the screen)
    const gl = word.slice(1).map(ch => gaGlyph(ch, fs)); if (gl.some(q => !q)) return false
    const F = gaBigF(S); if (!F) return false
    const tr = fs * 0.02, startX0 = 0.5125 * S, tot = startX0 + gl.reduce((a, q) => a + q.w, 0) + tr * (n - 1), left = -(tot + 0.11 * S) / 2 + 0.11 * S   // (the spear's point stands out 0.11 S to the left of the F)
    const sh = S * 0.062, yS = ty + fs0 * 0.35 + fs * 0.3, base = yS - sh / 2 - fs * 0.1, fx = left - F.left, fy = yS - F.barY, stemCx = fx + (F.stemL + F.stemR) / 2
    gaLay = { cx: left + startX0 + (tot - startX0) / 2, w: tot - startX0, yS, fs }
    if (!calmOk) return true                                             // (the name's animation begins once the sky is running smoothly)
    if (gaT0 === null) gaT0 = now
    const tt = now - gaT0, tImpact = GA_LAUNCH + (n - 1) * GA_STAG + GA_FLIGHT - 150 + GA_THRUST
    gaSettle = gaT0 + tImpact
    if (tt < GA_BEAT) return true
    const lastT = tt - tImpact, tm = lastT > 0 ? Math.min(1, lastT / 900) : 0
    gaM = tm * tm * (3 - 2 * tm)                                         // (0: iridescent; 1: settled to bronze)
    if (gaM < 1) gaScroll += Math.min(60, gaLastN ? now - gaLastN : 16) * gaPeriod() / (6000 + 14000 * gaM); gaLastN = now
    const shake = lastT > 0 && lastT < 380 ? 8 * (1 - lastT / 380) * Math.sin(lastT / 380 * 38) : 0
    const glintP = lastT > 600 ? ((tt - tImpact - 600) % GA_GLINT) / 900 : 9, hit = lastT > 0 ? Math.max(0, 1 - lastT / 320) : 0
    const fk = lastT > 0 ? -S * 0.03 * Math.exp(-lastT / 150) * Math.sin(lastT / 38) : 0     // (the F is knocked back a little when the spear goes in, and rings)
    const pos = [], light = (cb) => { g.save(); try { g.globalCompositeOperation = 'lighter'; cb() } finally { g.restore() } }   // (restored even if a draw throws: a leaked 'lighter' washes out everything after it)
    g.save(); g.translate(PX + shake, shake * 0.5)
    // a soft dark backing under the word, so the fine letters hold against the sky
    {
      const bw = tot - startX0 + fs * 0.8, bh = fs * 1.5, k = gaGl.back && gaGl.back.key === bw + '|' + bh ? gaGl.back : (gaGl.back = (() => { const pd = Math.ceil(fs * 0.9), [c, x] = gaCanvas(bw + pd * 2, bh + pd * 2); x.shadowColor = 'rgba(2,5,16,0.8)'; x.shadowBlur = fs * 0.7 * DPR; x.shadowOffsetX = 3000 * DPR; x.fillStyle = '#000'; x.fillRect(pd + fs * 0.3 - 3000, pd + fs * 0.25, bw - fs * 0.6, bh - fs * 0.5);   /* (only the soft shadow lands; the rectangle itself is off to the side) */ return { key: bw + '|' + bh, c, pd, w: bw + pd * 2, h: bh + pd * 2 } })())
      g.save(); g.globalAlpha = alpha * Math.min(1, Math.max(0, (tt - GA_LAUNCH + 200) / 500)); g.drawImage(k.c, left + startX0 - fs * 0.4 - k.pd, base - fs * 1.0 - k.pd, k.w, k.h); g.restore()
    }
    // the letters leave the stem one by one (drawn first, so they come out from behind the F)
    let xx = left + startX0, pulse = 0
    for (let m = 1; m <= n; m++) {
      const q = gl[m - 1], lx = xx + q.w / 2; xx += q.w + tr
      const t = tt - (GA_LAUNCH + (m - 1) * GA_STAG), u = Math.max(0, Math.min(1, t / GA_FLIGHT)); if (t >= 0) pulse = Math.max(pulse, Math.exp(-t / 140))
      if (t < 0) continue
      if (u >= 1 && !gaLand[m]) { gaLand[m] = now; for (let i = 0; i < 6; i++) gaParts.push({ x: lx, y: base + fs * 0.05, vx: (Math.random() - 0.5) * 260, vy: -80 - Math.random() * 200, t0: now, dur: 400 + Math.random() * 400, sz: 2 + Math.random() * 3 }) }
      const e = gaOutCubic(u), px = stemCx + (lx - stemCx) * e, tl = Math.max(0, t - GA_FLIGHT), sq = Math.exp(-tl / 90) * Math.cos(tl / 40) * 0.2, s0 = 0.2 + 0.8 * Math.min(1.12, gaOutBack(u))
      if (u < 1) light(() => { const gr = g.createLinearGradient(stemCx, 0, px, 0); gr.addColorStop(0, 'rgba(210,235,255,0)'); gr.addColorStop(1, `rgba(235,248,255,${(0.7 * (1 - u) * alpha).toFixed(3)})`); g.fillStyle = gr; g.fillRect(stemCx, base - fs * 0.3, px - stemCx, fs * 0.06) })
      g.save(); g.translate(px, base); g.scale((1 + sq * 0.6) * s0, (1 - sq) * s0); g.globalAlpha = alpha * Math.min(1, u * 6); g.drawImage(q.c, -q.cw / 2, -q.bl, q.cw, q.chh); g.drawImage(gaFill(q, lx - q.cw / 2), -q.cw / 2, -q.bl, q.cw, q.chh)
      const fl = u >= 1 ? Math.max(0, 1 - tl / 260) * 0.9 : 0, gl2 = Math.pow(Math.max(0, 1 - Math.abs((lx - left) / tot - (-0.2 + 1.4 * glintP)) / 0.14), 2) * 0.8
      if (fl + gl2 + hit > 0.01) { g.globalAlpha = alpha * Math.min(1, fl + gl2 + hit); g.drawImage(q.sil, -q.cw / 2, -q.bl, q.cw, q.chh) }
      g.restore(); if (u >= 1) pos.push([lx, base - fs * 0.3, q.w])
    }
    // the F: the stem runs down the screen as it appears, with a flash
    const uF = (tt - GA_BEAT) / 500
    if (uF >= 0) {
      const wipe = gaOutCubic(uF * 1.15), hf = Math.max(pulse * 0.4, uF < 0.35 ? 1 - uF / 0.35 : 0, hit, Math.pow(Math.max(0, 1 - Math.abs(-0.2 + 1.4 * glintP) / 0.14), 2) * 0.8)
      g.save(); g.beginPath(); g.rect(fx + fk - 4, fy, F.cw + 8, F.chh * wipe); g.clip()
      g.globalAlpha = alpha * Math.min(1, uF * 6); g.drawImage(F.c, fx + fk, fy, F.cw, F.chh); g.drawImage(gaFill(F, fx), fx + fk, fy, F.cw, F.chh); g.drawImage(F.detail, fx + fk, fy, F.cw, F.chh)
      if (hf > 0.01) { g.globalAlpha = alpha * Math.min(1, hf); g.drawImage(F.sil, fx + fk, fy, F.cw, F.chh) }
      g.restore(); pos.push([stemCx, fy + F.chh * 0.55, S * 0.1])
    }
    if (uF >= 0 && uF < 1) light(() => {                                  // the flash: one soft burst of light at the head of the F, and a wash across the screen
      const e = gaOutCubic(uF), fade = Math.pow(1 - uF, 1.5), cx = fx + (F.left + F.armR) / 2, cy = fy + F.top + S * 0.1, r = S * (0.4 + 1.6 * e)
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, `rgba(255,255,255,${(fade * alpha).toFixed(3)})`); rg.addColorStop(0.4, `rgba(215,238,255,${(0.5 * fade * alpha).toFixed(3)})`); rg.addColorStop(1, 'rgba(200,228,255,0)')
      g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fill()
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(240,250,255,${(0.22 * Math.max(0, 1 - uF * 3) * alpha).toFixed(3)})`; g.fillRect(0, 0, W * 4, H * 4)
    })
    // the spear, thrown in from the right: it pierces the stem, quivers, and stays
    const tS = tt - (tImpact - GA_THRUST), unit = fs * 0.9
    if (tS > 0) {
      const u = Math.min(1, tS / GA_THRUST), e = Math.pow(u, 1.5), off = (W * 0.95) * (1 - e), drop = Math.pow(1 - e, 1.6)   // (it arrives fast and hits: no easing down to a soft stop; it comes in on a falling line, nose a little low)
      const tipX = fx + F.stemL - S * 0.2, bandX = fx + F.ox + 0.4325 * S, endX = left + tot - fs * 0.05
      const wob = lastT > 0 ? 0.06 * Math.exp(-lastT / 260) * Math.cos(lastT / 44) : -0.11 * drop
      g.save(); g.translate(tipX + off, yS - S * 0.2 * drop); g.rotate(wob); g.translate(-tipX, -yS); g.globalAlpha = alpha * Math.min(1, u * 10); gaSpear(now, tipX, bandX, endX, yS, unit, S, sh); g.restore()
      if (u > 0.5) {                                                      // the point passes through: the stem is drawn again over the head where they cross, with a dark seam where it goes in
        g.save(); g.beginPath(); g.rect(fx + fk + F.stemL, yS - S * 0.2, F.stemR - F.stemL, S * 0.4); g.clip(); g.globalAlpha = alpha; g.drawImage(gaFill(F, fx), fx + fk, fy, F.cw, F.chh); g.drawImage(F.detail, fx + fk, fy, F.cw, F.chh); g.restore()
      }
      if (u < 1) light(() => { g.fillStyle = `rgba(235,248,255,${(0.5 * (1 - u) * alpha).toFixed(3)})`; for (let i = 0; i < 5; i++) { const ly = yS + (i - 2) * sh * 1.1, ln = unit * (3 + (i % 3) * 1.6) * (1 - u * 0.6); g.fillRect(endX + off + unit * 0.8, ly, ln, 1.6) } })
      if (lastT > 0 && lastT < 420) light(() => {                         // the impact: one soft flare where the point goes through
        const d = 1 - lastT / 420, r = unit * 1.6 * d + 1, cx = stemCx, rg = g.createRadialGradient(cx, yS, 0, cx, yS, r)
        rg.addColorStop(0, `rgba(255,255,255,${(d * alpha).toFixed(3)})`); rg.addColorStop(1, 'rgba(200,228,255,0)'); g.fillStyle = rg; g.beginPath(); g.arc(cx, yS, r, 0, 6.2832); g.fill()
      })
    }
    // sparks from the landings, and stars twinkling on the letters once it has settled
    if (lastT > 300 && pos.length && now - gaTwT > 240) { gaTwT = now; const q = pos[Math.floor(Math.random() * pos.length)]; gaParts.push({ x: q[0] + (Math.random() - 0.5) * q[2] * 0.8, y: q[1] + (Math.random() - 0.5) * fs * 0.8, t0: now, dur: 650, tw: fs * (0.14 + Math.random() * 0.16) }) }
    light(() => {
      gaParts = gaParts.filter(q => now - q.t0 < q.dur)
      for (const q of gaParts) {
        const u = Math.max(0, Math.min(1, (now - q.t0) / q.dur))        // (a redraw on a resize can be stamped later than the next frame, so u must be held to 0..1)
        if (q.tw) {
          const r = q.tw * Math.sin(Math.PI * u), k = r * 0.16; g.globalAlpha = alpha
          g.fillStyle = 'rgba(240,250,255,0.95)'; g.beginPath(); g.moveTo(q.x, q.y - r); g.lineTo(q.x + k, q.y - k); g.lineTo(q.x + r, q.y); g.lineTo(q.x + k, q.y + k); g.lineTo(q.x, q.y + r); g.lineTo(q.x - k, q.y + k); g.lineTo(q.x - r, q.y); g.lineTo(q.x - k, q.y - k); g.closePath(); g.fill()
          g.globalAlpha = alpha * 0.3; g.beginPath(); g.arc(q.x, q.y, r * 0.5, 0, 6.2832); g.fill()
        } else {
          const d = (now - q.t0) / 1000; g.globalAlpha = alpha * (1 - u); g.fillStyle = '#e8f4ff'
          g.fillRect(q.x + q.vx * d - q.sz / 2, q.y + q.vy * d + 450 * d * d - q.sz / 2, q.sz, q.sz)
        }
      }
    })
    g.restore()
    return true
  }
  // the English's share of the light: none for a dark moon or a sliver, all of it by nearly half (a tap's worth)
  const enOf = (p) => englishAlpha(p)
  // THE BANG: the English arrives, the first time the moon lets it -- as the ogham dial had it: the line kicks, a spray of
  // sparks leaves it, a bell rings over a low note (in D here, with the harp's waking run), and a phone buzzes
  let bang = null
  const bornT = performance.now()
  function enBang(now, cx, cy, w, h) {
    const sparks = []
    for (let i = 0; i < 24; i++) sparks.push({ x: cx - w / 2 + Math.random() * w, y: cy - h / 2 + Math.random() * h, a: Math.random() * Math.PI * 2, d: 36 + Math.random() * 90, dur: 700 + Math.random() * 700, dl: Math.random() * 160, sz: 3 + Math.random() * 5, c: Math.random() < 0.5 ? '255,233,168' : '191,224,255' })
    bang = { t: now, sparks }
    try { navigator.vibrate?.([18, 30, 46]) } catch (e) { }
    const ac = audio(); if (!ac) return
    const k = Math.pow(2, 2 / 12)
    for (const [f, gn, d, dl] of [[130.81, 0.10, 1.6, 0], [1046.5, 0.075, 2.2, 0.02], [1568.0, 0.055, 2.4, 0.06], [2093.0, 0.04, 2.6, 0.10], [2637.0, 0.028, 2.8, 0.15]]) {
      try {
        const o = ac.createOscillator(), gg = ac.createGain(), t0 = ac.currentTime + 0.02 + dl
        o.type = 'sine'; o.frequency.value = f * k; gg.gain.setValueAtTime(0, t0); gg.gain.linearRampToValueAtTime(gn, t0 + 0.008); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d)
        o.connect(gg); gg.connect(ac.destination); o.start(t0); o.stop(t0 + d + 0.05)
      } catch (e) { }
    }
  }
  function drawSparks(now) {
    let live = false
    for (const p of bang.sparks) {
      const u = (now - bang.t - p.dl) / p.dur; if (u < 0 || u >= 1) { if (u < 0) live = true; continue }
      live = true
      const a = u < 0.35 ? u / 0.35 : 1, b = u < 0.35 ? 0 : (u - 0.35) / 0.65
      const f = u < 0.35 ? 0.6 * a : 0.6 + 0.4 * b, yo = u < 0.35 ? -12 * a : -12 + 30 * b, s2 = u < 0.35 ? 0.4 + 0.9 * a : 1.3 - 1.1 * b, al = u < 0.35 ? 1 : 1 - b
      const x = p.x + Math.cos(p.a) * p.d * f, y = p.y + Math.sin(p.a) * p.d * f + yo, r = p.sz * s2
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 1.6); gr.addColorStop(0, `rgba(255,251,232,${al.toFixed(3)})`); gr.addColorStop(0.45, `rgba(${p.c},${(al * 0.9).toFixed(3)})`); gr.addColorStop(1, `rgba(${p.c},0)`)
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 1.6, 0, Math.PI * 2); g.fill()
    }
    if (!live && now - bang.t > 3000) bang.sparks = []
  }

  // ── the moon among the stars, as the moon tile draws it (lit from the right, waxing), large; with a few seas
  function moonDisc(x, y, r, ph, boost = 0) {
    const gm = 1.6 + boost * 1.4, ga = Math.min(1, 0.14 + ph * 0.14 + boost * 0.45)
    const grd = g.createRadialGradient(x, y, r * 0.4, x, y, r * gm); grd.addColorStop(0, `rgba(180,170,255,${ga.toFixed(3)})`); grd.addColorStop(1, 'rgba(200,220,255,0)')
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r * gm, 0, Math.PI * 2); g.fill()
    const rr = r * 0.92
    g.fillStyle = 'rgb(8,4,30)'; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill()
    if (drawMoonFace(g, x, y, rr, ph, cyc(moonRaw) <= 1, MOON_TILT)) { }                              // (the moon's own face, moonFace.js)
    else if (ph > 0.005) {                                                // (until it has loaded: a drawn one)
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
    const hint = moonHint(now)
    const boost = (stage === 'dark' ? 0.12 + 0.12 * Math.sin(t * 1.6) : 0) + hint.br * hint.on * 0.4 + fl * fl * 1.1 + (mdrag && mdrag.what === 'moon' ? 0.15 : 0)
    const { cy: acy, rad } = ARC(), beneath = mp[1] + mR > acy - rad - H * 0.25 && mp[1] - mR < acy - rad + H * 0.05 && Math.abs(mp[0] - PX) < mR + W * 0.35
    g.save(); g.globalAlpha = beneath ? 1 - 0.4 * Math.min(1, nameA) : 1                 // (veiled a little while a name stands over it)
    moonDisc(mp[0], mp[1], mR, englishOpacity, boost)
    g.restore()
    if (hint.on) drawHintRing(hint, mp)
    if (fl > 0 && now - wakeT < 1200) {                                 // (the waking: a ring of light going out from it)
      const u = 1 - fl, rr = mR * (1 + u * 1.6)
      g.save(); g.strokeStyle = `rgba(225,220,255,${(0.55 * fl).toFixed(3)})`; g.lineWidth = 2 + 6 * fl; g.beginPath(); g.arc(mp[0], mp[1], rr, 0, Math.PI * 2); g.stroke(); g.restore()
    }
  }
  // THE INVITATION, wordless: once the name has landed and a beat has passed, and until the first touch, the dark moon wears
  // a pale border that breathes, and on each breath a ring leaves it and fades
  const HINT_BREATH = 1800
  function moonHint(now) {
    if (stage !== 'dark') return { on: 0, br: 0, c: 0 }
    const t0 = gaSettle === null ? Infinity : gaSettle + 1500
    if (now < t0) return { on: 0, br: 0, c: 0 }
    const c = now - t0
    return { on: Math.min(1, c / 700), br: 0.5 - 0.5 * Math.cos(c / HINT_BREATH * Math.PI * 2), c }
  }
  function drawHintRing(h, mp) {
    g.save(); g.lineJoin = 'round'
    const r0 = mR * 1.045
    g.strokeStyle = `rgba(228,230,255,${((0.22 + 0.55 * h.br) * h.on).toFixed(3)})`; g.lineWidth = 2 + 2.5 * h.br; g.shadowColor = 'rgba(190,200,255,0.9)'; g.shadowBlur = 16 * h.br * h.on
    g.beginPath(); g.arc(mp[0], mp[1], r0, 0, Math.PI * 2); g.stroke()
    const u = (h.c % HINT_BREATH) / HINT_BREATH
    g.shadowBlur = 0; g.strokeStyle = `rgba(228,230,255,${(0.45 * (1 - u) * (1 - u) * h.on).toFixed(3)})`; g.lineWidth = 2
    g.beginPath(); g.arc(mp[0], mp[1], r0 + mR * 0.5 * u, 0, Math.PI * 2); g.stroke()
    g.restore()
  }
  // ── the pool: the moon tile itself, laid in the ground (its own dark stone rim and gold ring), the water inside it; the
  // stars in it drifting as the sky turns, and, when the sky is still, the sign of the champion at the sight; ripples.
  // Drawn at any size, for the dive
  const TILE = new Image(); TILE.src = 'assets/ciorcal-glass-bg.png'
  let tileC = null                                                      // (the tile, tinted toward the night's blue, once)
  const tileTint = () => { if (!tileC) { const c = document.createElement('canvas'); c.width = TILE.naturalWidth; c.height = TILE.naturalHeight; const q = c.getContext('2d'); q.drawImage(TILE, 0, 0); q.globalCompositeOperation = 'source-atop'; q.fillStyle = 'rgba(28,52,120,0.3)'; q.fillRect(0, 0, c.width, c.height); tileC = c } return tileC }
  const TILE_IN = 0.78                                                  // (the water's edge, as a share of the tile's radius: inside the gold)
  const PSTARS = Array.from({ length: 700 }, (_, i) => { const r = mulberry(900 + i * 7); const a = r() * Math.PI * 2, d = Math.sqrt(r()); return { u: Math.cos(a) * d, v: Math.sin(a) * d, m: 0.25 + r() * 0.75, tw: r() * 6 } })
  const PSB = [0, 1, 2, 3].map(b => PSTARS.filter(q => Math.min(3, Math.floor(q.m * 4)) === b))
  let busyT = 0                                                         // (when the pool was last in use or not pressable: the 8 s are counted from it)
  const POOL_ZOOM = 1.5, POOL_DIM = 0.85                                // (the reflection larger than the sky's own, and a little dimmer)
  let poolSc = 0, poolT = 0                                             // (how many pool-widths a sky-pixel is: eased, so no jump from hero to hero)
  const bendP = (u, v, s, now) => {                                    // the water gone convex: stars flung out the more the farther from the middle, billowing, none to be followed (s: 0 in focus, 1 lost)
    if (s < 0.002) return [u, v]
    const r = Math.hypot(u, v) + 1e-6, th = Math.atan2(v, u)
    const k = 1 + s * 2.6 * (0.35 + r), r2 = r * k * (1 + 0.25 * s * Math.sin(th * 2 - now * 0.003)), th2 = th + 0.5 * s * (0.9 * Math.sin(r * 5 - now * 0.0035) + 0.5 * Math.sin(th * 3 + now * 0.0023))
    return [r2 * Math.cos(th2), r2 * Math.sin(th2)]
  }
  const ripWarp = (u, v, now) => {                                      // how the ripples bend the water at (u, v) (the pool's own units): a ring of push and pull, with a skew
    let du = 0, dv = 0
    for (const r of ripples) {
      const age = (now - r.t) / 1000; if (age < 0 || age > 2.2) continue
      const dx = u - r.u, dy = v - r.v, d = Math.hypot(dx, dy) || 1e-3, e = d - (0.08 + age * 0.55)
      if (e > 0.3 || e < -0.45) continue
      const A = 0.07 * (1 - age / 2.2) * r.a * Math.exp(-e * e * 14) * Math.sin(e * 24)
      du += (dx / d) * A + (-dy / d) * A * 0.45; dv += (dy / d) * A + (dx / d) * A * 0.45
    }
    return [du, dv]
  }
  function drawPool(cx, cy, rx, ry, now, o = {}) {
    const t = now / 1000
    if (TILE.complete && TILE.naturalWidth) g.drawImage(tileTint(), cx - rx / TILE_IN, cy - ry / TILE_IN, 2 * rx / TILE_IN, 2 * ry / TILE_IN)
    else { const kw = Math.max(3, rx / 10); g.save(); g.strokeStyle = 'rgba(30,32,40,1)'; g.lineWidth = kw * 2; g.beginPath(); g.ellipse(cx, cy, rx + kw, ry + kw, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = 'rgba(233,196,106,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy, rx + 1, ry + 1, 0, 0, Math.PI * 2); g.stroke(); g.restore() }
    g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip()
    const wg = g.createLinearGradient(0, cy - ry, 0, cy + ry); wg.addColorStop(0, '#0c1634'); wg.addColorStop(1, '#03060f'); g.fillStyle = wg; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)
    if (o.full > 0) { g.save(); g.globalAlpha = o.full; paintSkyGradient(g, W, H); g.restore() }   // (deep in, the water is the night itself)
    const z = Math.max(1, Math.min(1.8, rx / 220)), nS = Math.min(PSTARS.length, Math.round(60 + rx * 1.2)), sw = o.swirl
    const bs = 1 - calm, sg = o.sign && o.sign.c ? o.sign : null, kx = sg ? sg.c[0] - PX : 0, ky = sg ? sg.c[1] - PY : 0
    if (!sw) {                                                          // (the scale: the hero's sign fills the water; else a patch of sky round the sight)
      let tsc = rx * 0.5 / (W * 0.12)
      if (sg) { const ext = Math.max(1, ...sg.pts.map(p => Math.hypot(p[0] + kx, p[1] + ky))); tsc = POOL_ZOOM * Math.min(rx * 0.5, W * 0.3) / ext }
      poolSc = poolSc ? poolSc + (tsc - poolSc) * (1 - Math.exp(-Math.min(100, Math.max(0, now - poolT)) / 250)) : tsc; poolT = now
    }
    const refl = (dx, dy, k = 1) => {                                   // a sky offset from the sight (screen px, y down) into the water, upside down, bent
      const b = bendP(dx * poolSc / rx, -dy * poolSc / rx, bs * k, now), wp = ripples.length ? ripWarp(b[0], b[1], now) : [0, 0]
      return [cx + (b[0] + wp[0]) * rx, cy + (b[1] + wp[1]) * ry]
    }
    if (sw) {                                                           // (whirling: the stars round the middle, drawn out along their way)
      g.lineCap = 'round'
      for (let si = 0; si < nS; si++) { const s2 = PSTARS[si], d = Math.hypot(s2.u, s2.v)
        const th = Math.atan2(s2.v, s2.u) + sw.ang * (0.7 + 0.5 * (1 - d)), tr = Math.max(0.02, Math.min(0.5, sw.w * 0.05 * (0.5 + s2.m)))
        g.strokeStyle = `rgba(225,232,255,${(s2.m * 0.8).toFixed(3)})`; g.lineWidth = z * (0.8 + s2.m * 0.6); g.beginPath()
        for (let q = 0; q <= 3; q++) { const u = th + tr * q / 3, X = cx + Math.cos(u) * d * rx, Y = cy + Math.sin(u) * d * ry; q ? g.lineTo(X, Y) : g.moveTo(X, Y) }
        g.stroke()
      }
      g.lineCap = 'butt'
      for (let q = 0; q < 3; q++) {                                     // (ripples going out from the middle)
        const age = ((sw.a + q * 0.6) % 1.8) / 1.8
        g.strokeStyle = `rgba(200,210,245,${(0.35 * (1 - age) * Math.min(1, sw.a / 0.6)).toFixed(3)})`; g.lineWidth = Math.max(1, rx / 120); g.beginPath(); g.ellipse(cx, cy, Math.max(0.5, rx * age), Math.max(0.5, ry * age), 0, 0, Math.PI * 2); g.stroke()
      }
    } else {                                                            // (the sky itself, mirrored: each star as drawn about the sight; streaked while the water is bent, sharp when it is still)
      g.lineCap = 'round'; g.strokeStyle = 'rgb(225,232,255)'; g.fillStyle = 'rgb(225,232,255)'
      for (let i = 0; i < ppn; i++) {
        const dx = PP[i * 4] - PX, dy = PP[i * 4 + 1] - PY, u = dx * poolSc / rx, v = -dy * poolSc / rx
        if (bs < 0.03 && u * u + v * v * (rx * rx) / (ry * ry) > 1.3) continue
        const q1 = refl(dx, dy), a = PP[i * 4 + 2] * (1 - 0.45 * bs) * POOL_DIM, sz = Math.max(z * 0.9, Math.min(2.4, PP[i * 4 + 3] * Math.sqrt(poolSc)))
        g.globalAlpha = Math.min(1, a)
        if (bs > 0.04) { const q0 = refl(dx, dy, 0.7); g.lineWidth = sz; g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.stroke() }
        else g.fillRect(q1[0] - sz / 2, q1[1] - sz / 2, sz, sz)
      }
      g.globalAlpha = 1
    }
    if (o.sign && o.signA > 0.01) {                                     // (a champion's sign, in the water)
      // (sign.screen: offsets as seen on the screen, y down, which the water turns upside down; else the sign's own, y up)
      const P = o.sign.pts, ext = Math.max(o.sign.screen ? 1 : 0.05, ...P.map(p => Math.hypot(p[0], p[1]))), sc = sw || !sg ? Math.min(rx * 0.5, W * 0.3) / ext : poolSc
      const ca = Math.cos(sw ? sw.ang : 0), sa = Math.sin(sw ? sw.ang : 0)    // (whirled with the water)
      const at = (p) => { if (!sw && sg) return refl(p[0] + kx, p[1] + ky); const x = p[0] * ca + p[1] * sa, y = -p[0] * sa + p[1] * ca; return [cx + x * sc, cy - y * sc * (ry / rx)] }
      g.save(); g.globalAlpha = o.signA * POOL_DIM; g.strokeStyle = 'rgba(242,213,140,0.9)'; g.lineWidth = Math.max(1, rx / 110); g.shadowColor = GOLD; g.shadowBlur = Math.max(4, rx / 30)
      g.beginPath(); for (const [i, j] of o.sign.edges) { let q = at(P[i]); g.moveTo(q[0], q[1]); for (let k = 1; k <= 7; k++) { q = at([P[i][0] + (P[j][0] - P[i][0]) * k / 7, P[i][1] + (P[j][1] - P[i][1]) * k / 7]); g.lineTo(q[0], q[1]) } } g.stroke()
      g.fillStyle = 'rgba(255,250,235,1)'; for (const p of P) { const q = at(p); g.beginPath(); g.arc(q[0], q[1], Math.max(1.4, rx / 90), 0, Math.PI * 2); g.fill() }
      g.restore()
    }
    if (o.sign && o.signA > 0.9 && calm > 0.98 && stage === 'browse' && !dive) {   // (a hero at rest: the pool can be pressed. After 8 s untouched, one slow ring goes out, and again every 8 s)
      const age = ((now - busyT - 8000) % 8000) / 1000
      if (now - busyT >= 8000 && age < 2.4) {
        const R = 0.08 + age * 0.5, a = (1 - age / 2.4) * 0.5
        g.strokeStyle = `rgba(215,222,250,${a.toFixed(3)})`; g.lineWidth = Math.max(0.8, rx / 90); g.beginPath(); g.ellipse(cx, cy, R * rx, R * ry, 0, 0, Math.PI * 2); g.stroke()
      }
    } else busyT = now
    g.restore()
  }
  // the dive: the ripples calm on the sign (1.3s); then down into the water, the pool growing and rounding as we come to
  // look straight down into it, the night closing round it (1.7s); then a wave through the water, and we are in it
  const oc = document.createElement('canvas'), ocx = oc.getContext('2d')
  // the dive, with the court in the round: the camera walks to the well and bows over it, rising a little to see it all
  // (2s); goes down into the water (0.7s), the scene below told to come up as it does; then, in the water, the stars and
  // the moon whirl round, ripples closing over, until that scene is up and the sky fades into it (handOver)
  const WALK = 2000, DROP = 700
  function diveCam(ms) {
    const u = Math.min(1, ms / WALK), e = u * u * (3 - 2 * u), d = Math.max(0, Math.min(1, (ms - WALK) / DROP)), de = d * d
    if (dive.cx0 === undefined) dive.cx0 = cam.x
    cam.x = dive.cx0 * (1 - e); cam.z = court.ZP * e
    cam.pitch = e * Math.PI / 2 * 0.999
    cam.y = court.EYE + (2.4 - court.EYE) * e - (2.4 - court.WATER_Y - 0.06) * de
    cam.hy = court.HY + (H / 2 - court.HY) * e
  }
  function drawDive3d(now) {
    const ms = now - dive.t
    if (ms > WALK + DROP && stage !== 'under') { stage = 'under'; underT = now; under = true }
    if (stage === 'under') {
      drawSwirl(now)
      if (!diveTold && now - underT > 150) { diveTold = true; setTimeout(() => { try { onChoose(dive.k.ch, dive.k.sign) } catch (e) { } }, 0) }   // (the next scene is a whole new game to build: after the whirl is up, not during the drop)
    }
  }
  // in the water: the night all round, its stars whirling the way the sky turns (against the clock), the moon carried
  // round with them, ripples going out
  const SPIN = 2.4, SPIN_UP = 1.6                                      // (the whirl's speed, rad/s; how long it takes to get up to it)
  function swirlAt(now) { const a = Math.max(0, (now - dive.t) / 1000); return { a, ang: -SPIN * (a < SPIN_UP ? a * a / (2 * SPIN_UP) : SPIN_UP / 2 + (a - SPIN_UP)), w: SPIN * Math.min(1, a / SPIN_UP) } }
  function drawSwirl(now) {
    const R0 = Math.hypot(W, H) / 2, cx = W / 2, cy = H / 2, { a, ang, w } = swirlAt(now)
    paintSkyGradient(g, W, H); g.fillStyle = 'rgba(2,4,12,0.3)'; g.fillRect(0, 0, W, H)
    g.lineCap = 'round'
    PSB.forEach((arr, b) => {                                         // (the stars in four strokes by brightness, not 700)
      g.strokeStyle = `rgba(225,232,255,${((b + 0.5) / 4 * 0.8).toFixed(3)})`; g.lineWidth = 1 + (b + 0.5) / 4; g.beginPath()
      for (const s2 of arr) { const r = Math.hypot(s2.u, s2.v) * R0, th = Math.atan2(s2.v, s2.u) + ang * (0.7 + 0.5 * (1 - r / R0)), tr = Math.min(0.5, w * 0.05 * (0.5 + s2.m)), rr = Math.max(1, r); g.moveTo(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr); g.arc(cx, cy, rr, th, th + tr) }
      g.stroke()
    })
    for (let k = 0; k < 3; k++) {
      const age = ((a + k * 0.6) % 1.8) / 1.8, r = R0 * age
      g.strokeStyle = `rgba(200,210,245,${(0.35 * (1 - age)).toFixed(3)})`; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke()
    }
    g.lineCap = 'butt'
  }
  function drawDive(now) {
    if (court) return drawDive3d(now)
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
  // the things that move on the far land: fire, smoke, lamps and windows, birds, the beast's eye
  function drawShade(l, x0, P, shift) {                              // the water darker under the island, which gives it weight
    const [ix, iw] = l.isl, hz = H * 0.70 + l.dy + shift + l.vy, rx = iw * 0.8, ry = H * 0.05
    for (let n = 0; n < 2; n++) {
      const X = x0 + n * P + ix + iw / 2; if (X + rx < 0 || X - rx > W) continue
      g.save(); g.translate(X, hz + ry * 0.3); g.scale(1, ry / rx)
      const sg = g.createRadialGradient(0, 0, 0, 0, 0, rx); sg.addColorStop(0, 'rgba(2,4,14,0.5)'); sg.addColorStop(0.6, 'rgba(2,4,14,0.25)'); sg.addColorStop(1, 'rgba(2,4,14,0)')
      g.fillStyle = sg; g.fillRect(-rx, 0, 2 * rx, rx); g.restore()
    }
  }
  function drawBoats(l, x0, P, shift, t) {                            // the boats layer cut at the gaps between boats; each piece rocks in its own time about its waterline
    const gs = l.groups, k = l.c.width / P, cuts = [0]
    for (let i = 0; i + 1 < gs.length; i++) cuts.push((gs[i].last + gs[i + 1].X) / 2)
    cuts.push(P)
    for (let n = 0; n < 2; n++) for (let i = 0; i < gs.length; i++) {
      const a = cuts[i], b = cuts[i + 1], dx = x0 + n * P + a; if (dx > W || dx + (b - a) < 0) continue
      const ph = gs[i].X * 0.013 + i * 1.7, bob = Math.sin(t * 0.85 + ph) * 0.9, rot = Math.sin(t * 0.62 + ph * 1.3) * 0.012
      const cx = x0 + n * P + gs[i].X, cy = gs[i].Y + l.dy + shift + l.vy
      g.save(); g.translate(cx, cy); g.rotate(rot); g.translate(-cx, -cy + bob)
      const b0 = l.band[0], b1 = l.band[1]; if (b1 > b0) g.drawImage(l.c, a * k, b0, (b - a) * k, b1 - b0, dx, shift + l.vy + b0 / DPR, b - a, (b1 - b0) / DPR); g.restore()
    }
  }
  function drawReflect(l, x0, P, shift, t) {                          // each lamp and fire again in the water, a short streak of bands that sway
    const hz = H * 0.70 + l.dy + shift + l.vy
    g.save(); g.globalCompositeOperation = 'lighter'
    for (const it of l.anim || []) {
      if (it.kind !== 'lamp' && it.kind !== 'fire') continue
      const fire = it.kind === 'fire', y1 = it.Y + l.dy + shift + l.vy, ys = y1 > hz ? y1 + 3 : hz + (hz - y1) * 0.4 + 2
      for (let n = 0; n < 2; n++) {
        const X = it.X + x0 + n * P; if (X < -20 || X > W + 20) continue
        for (let i = 0; i < 6; i++) {
          const a = (fire ? 0.2 : 0.13) * (1 - i / 6.5) * (0.8 + 0.2 * Math.sin(t * 1.7 + (it.ph || 0) + i)), sw = Math.sin(t * 1.1 + i * 0.9 + X * 0.1) * (0.7 + i * 0.35), w = (fire ? 3 : 2.2) * (1 + i * 0.28)
          g.fillStyle = `rgba(240,190,130,${a.toFixed(3)})`; g.fillRect(X + sw - w / 2, ys + i * 2.3, w, 1.3)
        }
      }
    }
    g.restore()
  }
  function drawSea(l, shift, t) {
    const fx = land.fx; if (!fx) return
    const hz = H * 0.70 + l.dy + shift + l.vy, P2 = 2 * W          // (the far layer's horizon, as it stands)
    const mp = moonAt()                                               // the moonlight on the water: under the moon, while it is up; gone when it is not
    if (mp) {
      const ma = Math.max(0, Math.min(1, (hz - mp[1]) / (H * 0.22))) * Math.max(0, Math.min(1, (W * 0.75 - Math.abs(mp[0] - W / 2)) / (W * 0.25)))
      if (ma > 0.01) {
        const gx = mp[0] - fx.gw / 2
        g.save(); g.globalCompositeOperation = 'lighter'
        g.globalAlpha = ma * LIT * 1.3 * (0.5 + 0.5 * Math.sin(t * 0.8)); g.drawImage(fx.glint[0], gx, hz + 1, fx.gw, fx.gh)
        g.globalAlpha = ma * LIT * 1.3 * (0.5 + 0.5 * Math.sin(t * 0.8 + 2.1)); g.drawImage(fx.glint[1], gx, hz + 1, fx.gw, fx.gh); g.restore()
      }
    }
    for (const w of fx.waves) {                                       // three tiles of small waves, each drifting and sliding at its own depth
      const off = w.k * parW + t * w.sp, x1 = (((off % W) + W) % W) - W, y = hz + w.yo * H - l.vy * (1 - w.kv)
      g.save(); g.globalAlpha = LIT * (0.8 + 0.2 * Math.sin(t * w.w + w.ph))
      for (let n = 0; n < 2; n++) g.drawImage(w.c, x1 + n * W, y, W, w.h)
      g.restore()
    }
  }
  function drawAnim(l, x0, P, shift, t) {
    for (const it of l.anim || []) {
      if (it.kind === 'flock') {
        const cyc = (t + it.ph) % it.period; if (cyc > it.dur) continue
        const u = cyc / it.dur, al = Math.pow(Math.sin(Math.PI * u), 0.8) * 0.55
        g.save(); g.strokeStyle = `rgba(205,210,232,${al.toFixed(3)})`; g.fillStyle = g.strokeStyle; g.lineWidth = 0.6; g.lineCap = 'round'
        for (let n = 0; n < 2; n++) {
          const lx = it.cx + it.dir * (u - 0.5) * it.travel + x0 + n * P, ly = it.cy + Math.sin(u * 3.1) * 3 + l.dy + shift + l.vy
          for (let k = 0; k < it.n; k++) {
            const rank = Math.ceil(k / 2), side = k % 2 ? 1 : -1, bx = lx - it.dir * rank * 5.5, by = ly + (k ? side * rank * 2.6 : 0)
            if (bx < -10 || bx > W + 10) continue
            const fl = Math.sin(t * 5.2 + k * 1.7), d = it.dir
            g.beginPath(); g.ellipse(bx, by, 1.3, 0.55, 0, 0, 6.283); g.fill()                           // (the body, side-on)
            g.beginPath(); g.moveTo(bx - d * 0.2, by - 0.2); g.lineTo(bx - d * 1.2, by - 2.4 * fl - 0.4); g.stroke()   // (the wings, up and down)
            g.beginPath(); g.moveTo(bx + d * 0.1, by - 0.1); g.lineTo(bx - d * 0.4, by - 2.1 * Math.sin(t * 5.2 + k * 1.7 + 0.8) - 0.3); g.stroke()
          }
        }
        g.restore(); continue
      }
      for (let n = 0; n < 2; n++) {
        const X = it.X + x0 + n * P, Y = it.Y + l.dy + shift + l.vy
        if (X < -30 || X > W + 30) continue
        if (it.kind === 'smoke') {
          const s = it.s || 1; g.save()
          for (let q = 0; q < 6; q++) { const ph = ((t / 8 + q / 6 + it.X * 0.013) % 1), a = 0.2 * (1 - ph) * Math.min(1, ph * 8)
            g.fillStyle = `rgba(185,185,225,${a.toFixed(3)})`; g.beginPath(); g.arc(X + (ph * 7 + Math.sin(ph * 5 + q) * 1.6) * s, Y - ph * 17 * s, (1 + ph * 3.4) * s, 0, 6.283); g.fill() }
          g.restore()
        } else {
          g.save(); g.globalCompositeOperation = 'lighter'
          if (it.kind === 'fire') {
            const f = 0.64 + 0.2 * Math.sin(t * 1.3 + X) + 0.1 * Math.sin(t * 2.1 + X * 2)
            const gr = g.createRadialGradient(X, Y, 0, X, Y, 11 * (0.85 + 0.3 * f)); gr.addColorStop(0, `rgba(235,170,110,${(0.28 * f).toFixed(3)})`); gr.addColorStop(1, 'rgba(235,170,110,0)'); g.fillStyle = gr; g.fillRect(X - 14, Y - 14, 28, 28)
            const hh = 2.4 * (0.8 + 0.5 * f), sw = Math.sin(t * 1.1 + X) * 0.5; g.fillStyle = 'rgba(240,205,140,0.6)'
            g.beginPath(); g.moveTo(X - 1.5, Y + 1); g.quadraticCurveTo(X - 0.8 + sw, Y - hh * 0.6, X + sw, Y - hh); g.quadraticCurveTo(X + 1 + sw, Y - hh * 0.5, X + 1.5, Y + 1); g.fill()
          } else if (it.kind === 'lamp') {
            const a = it.flick ? 0.12 + 0.3 * Math.max(0, Math.sin(t * (0.9 + (it.ph % 5) * 0.25) + it.ph * 2.1)) : 0.28 + 0.14 * Math.sin(t * 2.3 + X * 0.3), r = it.r
            const gr = g.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, `rgba(240,205,145,${(a * 0.75).toFixed(3)})`); gr.addColorStop(1, 'rgba(240,205,145,0)'); g.fillStyle = gr; g.fillRect(X - r, Y - r, r * 2, r * 2)
          } else if (it.kind === 'eye') {
            const a = 0.14 + 0.1 * Math.sin(t * 0.6 + X), r = it.r || 7
            const gr = g.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, `rgba(225,200,140,${a.toFixed(3)})`); gr.addColorStop(1, 'rgba(225,200,140,0)'); g.fillStyle = gr; g.fillRect(X - r, Y - r, r * 2, r * 2)
          }
          g.restore()
        }
      }
    }
  }
  const bandOf = (c) => {                                              // the rows of a layer that have anything on them (once, when it is made), with a margin
    const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data; let y0 = h, y1 = -1
    for (let y = 0; y < h; y++) { const r = y * w * 4; for (let x = 3; x < w * 4; x += 8) if (d[r + x] > 2) { if (y < y0) y0 = y; y1 = y; break } }
    const m = Math.ceil(6 * DPR); return y1 < y0 ? [0, 0] : [Math.max(0, y0 - m), Math.min(h, y1 + m)]
  }
  const fogImg = new Image(); fogImg.src = 'assets/fog01.png'; fogImg.addEventListener('load', () => { land = null })
  function drawLand(t, settled) {
    if (!land) land = paintLand()
    if (court) {
      const hz = cam.hy - f * Math.tan(cam.pitch), shift = hz - court.HY
      if (shift < H && shift > -H * 1.05) {                           // (not once the camera has gone down past the far land)
        const ve = dive ? Math.max(0, 1 - (t * 1000 - dive.t) / 600) : 1, pv = parVert() * ve
        land.layers.forEach((l, li) => {
          const P = l.c.width / DPR; l.off = l.k * parW; l.vy = l.kv * pv
          const x0 = (((l.off % P) + P) % P) - P
          if (l.name === 'mid') drawShade(l, x0, P, shift)
          if (l.groups) drawBoats(l, x0, P, shift, t)
          else { const b0 = l.band[0], b1 = l.band[1]; if (b1 > b0) for (let n = 0; n < 2; n++) g.drawImage(l.c, 0, b0, l.c.width, b1 - b0, x0 + n * P, shift + l.vy + b0 / DPR, P, (b1 - b0) / DPR) }
          if (li === 0) drawSea(l, shift, t)                              // (the waves and the glints on the water, under the far fog)
          g.save(); g.globalAlpha = LIT; drawAnim(l, x0, P, shift, t)
          if (l.name === 'mid' || l.name === 'boats') drawReflect(l, x0, P, shift, t)
          g.restore()
          for (const f of [].concat(land.fogs[li] || [])) {              // (banks of fog drifting before each layer, thicker toward us)
            { const off = f.k * parW + t * f.sp, fx = (((off % P) + P) % P) - P, fy = court.HY - 2 - H * 0.10 + shift - f.h * 0.55 + f.yo * H + pv * f.kv
            g.save(); g.globalAlpha = f.amp ? f.a + f.amp * Math.cos(t * f.w) : f.a; for (let n = 0; n < 2; n++) g.drawImage(f.c, fx + n * P, fy, P, f.h); g.restore() } }
        })
      }   // (the far land rides the horizon, each layer sliding its own way)
      const k = focus >= 0 ? cons[focus] : null, sp = k && !dive ? k.stars.map(proj) : null
      let sign = null
      if (k && sp && sp.every(Boolean)) { const mx = sp.reduce((a, p) => a + p[0], 0) / sp.length, my = sp.reduce((a, p) => a + p[1], 0) / sp.length; sign = { pts: sp.map(p => [p[0] - mx, p[1] - my]), edges: k.sign.edges, screen: true, c: [mx, my] }; lastSign = sign }
      const now = t * 1000, o = dive ? { sign: dive.sign, signA: Math.max(0, 1 - (now - dive.t) / 1600), swirl: swirlAt(now) } : { sign, signA: calm * (stage === 'browse' ? 1 : 0) }
      court.draw(g, cam, now, (cx, cy, rx, ry) => drawPool(cx, cy, rx, ry, now, o))
      return
    }
    const off = landOff(); if (off >= H) return
    g.save(); g.translate(0, off)
    g.drawImage(land, 0, 0, W, H)
    ;(L.tips || []).forEach(([tx, ty], j) => {
      const gl = 0.5 + 0.5 * Math.sin(t * 1.6 + j * 2.1), rgb = L.tipRGB || '255,236,190'
      const tg = g.createRadialGradient(tx, ty, 0, tx, ty, 6); tg.addColorStop(0, `rgba(${rgb},${(0.45 + 0.35 * gl).toFixed(3)})`); tg.addColorStop(1, `rgba(${rgb},0)`)
      g.fillStyle = tg; g.beginPath(); g.arc(tx, ty, 6, 0, Math.PI * 2); g.fill()
    })
    g.restore()
    if (!dive) {
      // the sign in the water as the sky shows it, turned as it is turned up there, mirrored by the water
      const P = pool(), k = focus >= 0 ? cons[focus] : null, sp = k ? k.stars.map(proj) : null
      let sign = null
      if (k && sp.every(Boolean)) { const mx = sp.reduce((a, p) => a + p[0], 0) / sp.length, my = sp.reduce((a, p) => a + p[1], 0) / sp.length; sign = { pts: sp.map(p => [p[0] - mx, p[1] - my]), edges: k.sign.edges, screen: true, c: [mx, my] } }
      drawPool(P.cx, P.cy, P.rx, P.ry, t * 1000, { sign, signA: calm * (stage === 'browse' ? 1 : 0) })
    }
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
    // ── the far land and the near (skyIsland.js): drawn for a horizon at the court's own, or 70% when we stand on the bull
    if (court) {                                                     // (the court is drawn live: skyCourt3d.js; the far land in three layers, wider than the screen)
      const skyRGB = (() => { const c0 = document.createElement('canvas'); c0.width = 1; c0.height = Math.max(2, Math.round(H)); const q = c0.getContext('2d'); paintSkyGradient(q, 1, c0.height)
        const d = q.getImageData(0, Math.max(0, Math.min(c0.height - 1, Math.round(court.HY - 2 - H * 0.10))), 1, 1).data; return [d[0], d[1], d[2]] })()
      const OBS = 0.8                                              // (how far the land dissolves into the sky: 0 none, 1 wholly; step back from here)
      const sk3 = (d) => `rgb(${skyRGB.map(v => Math.min(255, v + d)).join(',')})`   // (the sky's own colour, a little lifted: for haze and fog)
      const layers = ['far', 'mid', 'boats', 'arch'].map(layer => {
        const c2 = document.createElement('canvas'); c2.width = Math.round(W * 2 * DPR); c2.height = Math.round(H * DPR)
        const x2 = c2.getContext('2d'); x2.setTransform(DPR, 0, 0, DPR, 0, 0)
        const sc = paintScene(x2, { W, H, HZ: court.HY - 2 - H * 0.10, near: false, layer, skyRGB })
        // the palette: muted well down, the stars first (pixel by pixel, once, here)
        if (layer !== 'far') { const id = x2.getImageData(0, 0, c2.width, c2.height), d = id.data, keep = 0.4, dim = 0.9
          for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; d[i] = (l + (d[i] - l) * keep) * dim; d[i + 1] = (l + (d[i + 1] - l) * keep) * dim; d[i + 2] = (l + (d[i + 2] - l) * keep) * dim
            d[i] += (skyRGB[0] - d[i]) * OBS; d[i + 1] += (skyRGB[1] - d[i + 1]) * OBS; d[i + 2] += (skyRGB[2] - d[i + 2]) * OBS }
          x2.putImageData(id, 0, 0) }
        // distance: each layer is hazed toward the violet of the horizon, the farther the more (only where it has paint)
        const hzY = court.HY - 2 - H * 0.10, ha = { far: 0, mid: 0.5, arch: 0.28, boats: 0.4 }[layer]
        x2.save(); x2.globalCompositeOperation = 'source-atop'
        const hg = x2.createLinearGradient(0, hzY - H * 0.17, 0, hzY + H * 0.12); hg.addColorStop(0, sk3(12).replace('rgb', 'rgba').replace(')', ',0)')); hg.addColorStop(0.58, sk3(12).replace('rgb', 'rgba').replace(')', `,${ha})`)); hg.addColorStop(1, sk3(12).replace('rgb', 'rgba').replace(')', `,${ha * 0.35})`))
        x2.fillStyle = hg; x2.fillRect(0, 0, W * 2, H); x2.restore()
        let groups = null                                              // (the boats close together bob as one, so no seam cuts a sail)
        if (layer === 'boats') { groups = []; for (const b of sc.anim.boats.filter(it => it.kind === 'boat').sort((p, q) => p.X - q.X)) { const gp = groups[groups.length - 1]; if (gp && b.X - gp.xs[gp.xs.length - 1] < W * 0.2) { gp.xs.push(b.X); gp.ys.push(b.Y) } else groups.push({ xs: [b.X], ys: [b.Y] }) }
          groups.forEach(gp => { gp.X = gp.xs[0]; gp.Y = gp.ys.reduce((a, v) => a + v, 0) / gp.ys.length; gp.last = gp.xs[gp.xs.length - 1] }) }
        return { c: c2, k: PAR_K[layer], kv: PAR_KV[layer], off: 0, vy: 0, sk: sc.sky[layer], anim: sc.anim[layer], dy: sc.dy, groups, name: layer, isl: sc.isl, band: bandOf(c2) }
      })
      L.sky = (X) => Math.min(...layers.map(l => { const P = 2 * W; return l.sk((((X - l.off) % P) + P) % P) + l.vy }))   // (the skyline as the layers now stand)
      L.tips = []; L.tipRGB = null; L.bull = [0, H * 0.7, W, H]; L.glow = null
      const fogMake = (hh, flipV, tint, shift, sym) => {                    // (fog01.png, mirrored so that it joins; tinted to the night; faded away at top and bottom)
        const c3 = document.createElement('canvas'), w3 = Math.round(W * 2), h3 = Math.round(hh); c3.width = w3; c3.height = h3
        const x3 = c3.getContext('2d')
        if (fogImg.complete && fogImg.naturalWidth) {
          const half = (dx, mir) => { x3.save(); x3.translate(dx + (mir ? w3 / 2 : 0), flipV ? h3 : 0); x3.scale(mir ? -1 : 1, flipV ? -1 : 1); x3.drawImage(fogImg, 0, 0, w3 / 2, h3); x3.restore() }
          half(0, false); half(w3 / 2, true); x3.drawImage(c3, 0, 0)        // (twice over: denser)
          if (shift) { const t3 = document.createElement('canvas'); t3.width = w3; t3.height = h3; const q = t3.getContext('2d'); q.drawImage(c3, -shift, 0); q.drawImage(c3, w3 - shift, 0); x3.clearRect(0, 0, w3, h3); x3.drawImage(t3, 0, 0) }
          x3.globalCompositeOperation = 'source-atop'; x3.fillStyle = tint; x3.fillRect(0, 0, w3, h3)
          x3.globalCompositeOperation = 'destination-in'; const mk = x3.createLinearGradient(0, 0, 0, h3)
          if (sym) { mk.addColorStop(0, 'rgba(0,0,0,0)'); mk.addColorStop(0.5, 'rgba(0,0,0,1)'); mk.addColorStop(1, 'rgba(0,0,0,0)') } else { mk.addColorStop(0, 'rgba(0,0,0,0)'); mk.addColorStop(0.3, 'rgba(0,0,0,1)'); mk.addColorStop(0.55, 'rgba(0,0,0,0.8)'); mk.addColorStop(1, 'rgba(0,0,0,0)') } x3.fillStyle = mk; x3.fillRect(0, 0, w3, h3)
        }
        return c3
      }
      const fogs = [                                                  // (veil on the horizon, then out at sea; over the island; (the boats: none); low among the stones, and a tall one behind the henge fading up to the horizon)
        [{ c: fogMake(H * 0.20, true, sk3(16), 150, true), h: H * 0.20, a: 0.8, k: PAR_K.far * 0.6, sp: 1.5, yo: 0.01, kv: 1 },
         { c: fogMake(H * 0.36, true, sk3(14), 0), h: H * 0.36, a: 0.95, amp: 0.05, w: 0.11, k: PAR_K.far * 0.9, sp: 2.5, yo: 0.07, kv: 1 }],
        { c: fogMake(H * 0.26, false, sk3(12), 500), h: H * 0.26, a: 0.7, amp: 0.15, w: 0.08, k: PAR_K.mid * 0.9, sp: 4, yo: 0.06, kv: 0.7 },
        null,
        [{ c: fogMake(H * 0.34, false, sk3(10), 700), h: H * 0.34, a: 0.6, amp: 0.1, w: 0.07, k: PAR_K.arch * 0.4, sp: 3, yo: 0.2, kv: 0.3 },
         { c: fogMake(H * 0.22, false, sk3(8), 300), h: H * 0.22, a: 0.7, k: PAR_K.arch * 0.5, sp: 5, yo: 0.12, kv: 0.3 }]]
      const fx = (() => {                                              // the sea's baked tiles (see drawSea)
        const R = mulberry(77), mk = (w, h) => { const q = document.createElement('canvas'); q.width = Math.round(w * DPR); q.height = Math.round(h * DPR); const z = q.getContext('2d'); z.setTransform(DPR, 0, 0, DPR, 0, 0); return [q, z] }
        const gw = W * 0.4, gh = H * 0.125, glint = [0, 1].map(() => { const [q, z] = mk(gw, gh)
          for (let i = 0; i < 150; i++) { const u = Math.pow(R(), 1.3), y = 1 + u * gh * 0.95, sp = W * (0.05 + u * 0.25), xx = gw / 2 + (R() - 0.5) * sp, w = 2 + R() * 16 * (0.4 + u)
            z.fillStyle = `rgba(${185 + R() * 30 | 0},${200 + R() * 30 | 0},255,${0.07 + R() * 0.18 * (1 - u * 0.5)})`; z.fillRect(xx - w / 2, y, w, 0.8 + u * 0.5) }
          return q })
        const mkW = (yo, hh, n, wmin, wmax, al, k, sp, kv, ph) => { const [q, z] = mk(W, hh); z.lineCap = 'round'
          for (let i = 0; i < n; i++) { const y = 1 + R() * (hh - 3), u = y / hh, w = wmin + (wmax - wmin) * (0.3 + 0.7 * u) * (0.5 + R() * 0.7), xx = R() * W
            z.strokeStyle = `rgba(${150 + R() * 60 | 0},${160 + R() * 50 | 0},230,${al * (0.5 + R() * 0.7)})`; z.lineWidth = 0.5 + u * 0.7
            for (const o of [-W, 0, W]) { z.beginPath(); z.moveTo(xx + o, y); z.quadraticCurveTo(xx + o + w / 2, y - 0.9 - u, xx + o + w, y); z.stroke() } }
          return { c: q, h: hh, yo, k, sp, kv, w: 0.5, ph } }
        return { glint, gw, gh, waves: [mkW(0.012, H * 0.05, 70, 3, 10, 0.16, PAR_K.far * 0.9, 1.2, 1, 0), mkW(0.05, H * 0.06, 52, 8, 22, 0.17, PAR_K.mid * 0.9, 2.5, 0.65, 2), mkW(0.105, H * 0.075, 36, 14, 40, 0.18, PAR_K.arch * 0.9, 4.5, 0.4, 4)] }
      })()
      return { layers, fogs, fx }
    }
    const sc = paintScene(x, { W, H, HZ: H * 0.70, near: true })
    L.sky = sc.skyline
    const hill = sc.hill
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
      cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); cv.remove(); tiltEl?.remove(); music.hush(true); try { drone?.stop() } catch (e) { }
      for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.removeEventListener(ev, wakeAudio, true)
      document.removeEventListener('visibilitychange', onVis)
    },
    setEnglishOpacity(v) { setRaw(englishPhaseFromAlpha(v)) },
    englishOpacity() { return englishAlpha(englishOpacity) },
    // where the moon is, as { cx, cy, d } in px (heroSlots.js sets a saved hero's face on it)
    moonGeometry() { const mp = moonAt() || [PX, PY]; return { cx: mp[0], cy: mp[1], d: mR * 2 * 0.92 } },
    // from in the water to whatever has come up underneath: the sky fades out over `ms`, its music with it, and goes
    handOver(ms = 1400, onStart = null) {
      if (gone) return
      if (onStart) handStart = onStart
      if (court && (stage !== 'under' || performance.now() - underT < 700)) { pendingHand = ms; return }   // (not before we are in the water)
      try { handStart?.() } catch (e) { } handStart = null
      music.hush(true); cv.style.pointerEvents = 'none'; cv.style.transition = `opacity ${ms}ms ease`
      requestAnimationFrame(() => { cv.style.opacity = '0' })
      setTimeout(() => api.destroy(), ms + 100)
    },
  }
  return api
}
