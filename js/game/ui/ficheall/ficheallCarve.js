// ficheallCarve.js
//
// The board on Fergus's table, seen in perspective (ficheallTable.js draws it): its pieces as carved stone figures, its
// squares, the frieze cut along its edge, the wren that sits on the pieces, and whoever sits across from you. All
// painted in canvas once (no images), then drawn upright and scaled in the view.
//
// Design units: 100 to a square. A piece stands with the foot of its plinth at 0,0, up is -y. The plinth (and the
// castle's top) are painted as the board is seen: a level circle seen PITCH from above.

export const PITCH = 42 * Math.PI / 180
export const FLAT = Math.sin(PITCH)

//   h: from the plinth's foot to the top (design units)   perch: where the wren may sit   motif: cut round the plinth
export const KINDS = {
  ri:       { h: 166, stone: 'pale', ga: 'Rí',           en: 'The king',  perch: [0, -164],  motif: 'sun' },
  laoch:    { h: 126, stone: 'pale', ga: 'Laoch',        en: 'A warrior', perch: [0, -114],  motif: 'tri' },
  ceith:    { h: 126, stone: 'dark', ga: 'Ceithearnach', en: 'A kern',    perch: [0, -114],  motif: 'crow' },
  caislean: { h: 128, stone: 'dark', ga: 'Caisleán',     en: 'A castle',  perch: [-11, -93], motif: 'zig' },
  ridire:   { h: 138, stone: 'dark', ga: 'Ridire',       en: 'A knight',  perch: [-12, -125], motif: 'tri' },
  draoi:    { h: 146, stone: 'dark', ga: 'Draoi',        en: 'A druid',   perch: [2, -142],  motif: 'leaf' },
  banrion:  { h: 164, stone: 'dark', ga: 'Banríon',      en: 'A queen',   perch: [0, -139],  motif: 'spiral' },
}

const STONE = {
  pale: { rgb: [226, 216, 194], lo: 0.44, hi: 1.1 },          // limestone
  dark: { rgb: [80, 84, 92], lo: 0.4, hi: 1.75 },             // basalt
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 } }
const hash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0 }

// a path from points: [x, y] a line to it; ['q', cx, cy, x, y] a curve; ['c', ...6] a cubic
function poly(pts, close = true) {
  const p = new Path2D()
  pts.forEach((q, i) => {
    if (q[0] === 'q') p.quadraticCurveTo(q[1], q[2], q[3], q[4])
    else if (q[0] === 'c') p.bezierCurveTo(q[1], q[2], q[3], q[4], q[5], q[6])
    else if (i === 0) p.moveTo(q[0], q[1])
    else p.lineTo(q[0], q[1])
  })
  if (close) p.closePath()
  return p
}
const line = (pts) => poly(pts, false)
const circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p }
const oval = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p }
// the side of a drum (a short upright cylinder) of radius r from y0 (its foot's centre) up to y1
function drum(r, y0, y1) {
  const p = new Path2D(), ry = r * FLAT
  p.moveTo(-r, y1); p.lineTo(-r, y0); p.ellipse(0, y0, r, ry, 0, Math.PI, 0, true); p.lineTo(r, y1); p.ellipse(0, y1, r, ry, 0, 0, Math.PI, false); p.closePath()
  return p
}

// ── the carver: fills in stone, lit from the left (the fire), cuts lines ────────────────────────────────────
function carver(g, stoneName) {
  const S = STONE[stoneName]
  const col = (f, a = 1) => { const v = S.lo + (S.hi - S.lo) * f; return `rgba(${S.rgb.map(c => clamp(Math.round(c * v), 0, 255)).join(',')},${a})` }
  const gilt = []
  return {
    g, col, stone: stoneName, gilt,
    // a part, lit from the left: f0 at x0, f1 at x1 (round: brightest a third of the way in, as a curved surface)
    part(path, x0, x1, f0 = 0.95, f1 = 0.3, round = false) {
      g.save(); g.globalCompositeOperation = 'source-atop'; g.translate(1.6, 1.1); g.fillStyle = 'rgba(8,6,4,0.26)'; g.fill(path); g.restore()
      const gr = g.createLinearGradient(x0, 0, x1, 0)
      if (round) { gr.addColorStop(0, col(f0 * 0.78)); gr.addColorStop(0.3, col(f0)); gr.addColorStop(1, col(f1)) }
      else { gr.addColorStop(0, col(f0)); gr.addColorStop(1, col(f1)) }
      g.fillStyle = gr; g.fill(path)
      g.strokeStyle = 'rgba(16,12,8,0.5)'; g.lineWidth = 0.8; g.lineJoin = 'round'; g.stroke(path)
    },
    flat(path, f, a = 1) { g.fillStyle = col(f, a); g.fill(path) },
    // a cut line: dark in the groove, a catch of light along its lower edge
    groove(path, w = 0.9, a = 0.6) {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round'
      g.strokeStyle = `rgba(14,10,6,${a})`; g.lineWidth = w; g.stroke(path)
      g.translate(0.4, 0.55); g.strokeStyle = `rgba(255,246,226,${a * (stoneName === 'pale' ? 0.5 : 0.3)})`; g.lineWidth = w * 0.55; g.stroke(path)
      g.restore()
    },
    hole(path, a = 0.9) { g.fillStyle = `rgba(10,7,4,${a})`; g.fill(path) },
    gild(path) { gilt.push(path) },
  }
}

// ── small carvings: round the plinths, on the shields ─────────────────────────────────────────────────────
function spiralArm(cx, cy, R, a0, turns = 1.1, n = 22) {
  const pts = []
  for (let i = 0; i <= n; i++) { const t = i / n, r = R * (0.12 + 0.88 * t), a = a0 + turns * Math.PI * 2 * (1 - t); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a) * 0.98]) }
  return line(pts)
}
function triskele(C, cx, cy, R, w) { for (let j = 0; j < 3; j++) C.groove(spiralArm(cx, cy, R, j * Math.PI * 2 / 3, 0.9), w) }
function motif(C, kind, cx, cy, s) {
  const w = Math.max(0.35, s * 0.11)
  if (kind === 'sun') { C.groove(circle(cx, cy, s * 0.32), w); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; C.groove(line([[cx + Math.cos(a) * s * 0.42, cy + Math.sin(a) * s * 0.42], [cx + Math.cos(a) * s * 0.62, cy + Math.sin(a) * s * 0.62]]), w) } }
  else if (kind === 'tri') triskele(C, cx, cy, s * 0.55, w)
  else if (kind === 'spiral') { C.groove(spiralArm(cx - s * 0.32, cy, s * 0.34, 0, 1.2), w); C.groove(spiralArm(cx + s * 0.32, cy, s * 0.34, Math.PI, 1.2), w) }
  else if (kind === 'crow') {                              // a crow, wings up
    C.groove(line([[cx - s * 0.6, cy - s * 0.35], [cx - s * 0.2, cy], [cx, cy - s * 0.05], [cx + s * 0.2, cy], [cx + s * 0.6, cy - s * 0.35]]), w)
    C.groove(line([[cx - s * 0.12, cy + s * 0.05], [cx, cy + s * 0.4], [cx + s * 0.12, cy + s * 0.05]]), w)
  } else if (kind === 'leaf') {                            // an oak leaf
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12, y = cy - s * 0.5 + t * s, wv = s * (0.18 + 0.1 * Math.sin(t * Math.PI * 5)) * Math.sin(t * Math.PI); pts.push([cx - wv, y]) }
    for (let i = 12; i >= 0; i--) { const t = i / 12, y = cy - s * 0.5 + t * s, wv = s * (0.18 + 0.1 * Math.sin(t * Math.PI * 5)) * Math.sin(t * Math.PI); pts.push([cx + wv, y]) }
    C.groove(poly(pts), w); C.groove(line([[cx, cy - s * 0.45], [cx, cy + s * 0.6]]), w * 0.8)
  }
}

function plinth(C, k) {
  const g = C.g, rx = 34, ry = rx * FLAT, top = -9
  C.part(drum(rx, 0, top), -rx, rx, 0.78, 0.2, true)
  const tp = oval(0, top, rx, ry), gr = g.createLinearGradient(-rx, top - ry, rx, top + ry)
  gr.addColorStop(0, C.col(0.98)); gr.addColorStop(1, C.col(0.5))
  g.fillStyle = gr; g.fill(tp); g.strokeStyle = 'rgba(16,12,8,0.6)'; g.lineWidth = 1; g.stroke(tp)
  C.groove(oval(0, top, rx * 0.84, ry * 0.84), 0.55, 0.4)
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; C.groove(circle(Math.cos(a) * rx * 0.92, top + Math.sin(a) * ry * 0.92, 0.5), 0.45, 0.35) }
  // round the side: the piece's own sign, three times
  const m = KINDS[k].motif
  if (m === 'zig') {
    const pts = []; for (let i = 0; i <= 16; i++) { const x = -rx * 0.9 + i * rx * 1.8 / 16, e = ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)); pts.push([x, (i % 2 ? top + 2 : -2) * 0.5 + e + (i % 2 ? 1.4 : -1.4)]) }
    C.groove(line(pts), 0.6)
  } else for (const x of [-21, 0, 21]) { const e = ry * Math.sqrt(1 - (x / rx) ** 2); motif(C, m, x, top / 2 + e, 6.2 * (1 - Math.abs(x) / 70)) }
}

// ── the figures ────────────────────────────────────────────────────────────────────────────────────────────
function face(C, x, y, s = 1, beard = false) {
  for (const sx of [-1, 1]) {
    C.hole(oval(x + sx * 3.4 * s, y, 1.7 * s, 0.9 * s), 0.8)
    C.groove(line([[x + sx * 1.6 * s, y - 2.6 * s], [x + sx * 5.2 * s, y - 2.2 * s]]), 0.55 * s, 0.45)
  }
  C.groove(line([[x, y - 0.6 * s], [x + 0.7 * s, y + 4.6 * s], [x - 0.6 * s, y + 5 * s]]), 0.55 * s, 0.5)
  if (!beard) C.groove(line([[x - 2.4 * s, y + 7.6 * s], [x + 2.4 * s, y + 7.6 * s]]), 0.6 * s, 0.6)
}

function warrior(C) {
  const g = C.g
  C.part(poly([[-11, -6], [-3, -6], [-4, -36], [-10, -36]]), -11, -3, 0.85, 0.4)                       // legs
  C.part(poly([[3, -6], [11, -6], [10, -36], [4, -36]]), 3, 11, 0.6, 0.28)
  C.part(oval(-7, -6, 5.2, 3), -12, -2, 0.8, 0.35); C.part(oval(7, -6, 5.2, 3), 2, 12, 0.6, 0.3)       // boots
  const tunic = poly([[-18, -30], ['q', 0, -24, 18, -30], [13, -60], [-13, -60]])
  C.part(tunic, -18, 18, 0.95, 0.32)
  for (const [a, b] of [[[-9, -31], [-6, -57]], [[0, -27.5], [0, -57]], [[9, -31], [6, -57]]]) C.groove(line([a, b]), 0.7, 0.45)
  C.part(poly([[-13, -60], [13, -60], [17, -84], ['q', 0, -90, -17, -84]]), -17, 17, 0.95, 0.32)        // the body
  C.part(poly([[-13.6, -57.5], [13.6, -57.5], [13.2, -63], [-13.2, -63]]), -14, 14, 0.62, 0.22)       // belt
  C.part(oval(2, -60.2, 2.6, 2.2), -1, 5, 1, 0.5)
  C.part(poly([[-4, -86], [4, -86], [4, -92], [-4, -92]]), -4, 4, 0.75, 0.4)                           // neck
  // the sword arm, the blade held upright before it, the hand on the grip
  C.part(poly([[11, -85], [18, -87], [25, -66], [26, -56], [19, -55], [16, -66]]), 11, 26, 0.75, 0.3)
  C.part(poly([[19.6, -61], [24.4, -61], [24, -118], [22, -125], [20, -118]]), 19.6, 24.4, 1.15, 0.55)
  C.groove(line([[22, -64], [22, -114]]), 0.6, 0.4)
  C.part(poly([[13.5, -62.5], [30.5, -62.5], [30.5, -58.8], [13.5, -58.8]]), 13.5, 30.5, 0.9, 0.35)
  C.part(circle(22, -54.5, 4.6), 17.5, 26.5, 0.95, 0.35, true)
  C.part(circle(22, -47.6, 2.8), 19, 25, 1, 0.4, true)
  // the head, the helm over it (cheek guards, a nasal), the face between
  C.part(circle(0, -100, 10), -10, 10, 1, 0.35, true)
  face(C, 0, -99.5, 0.95)
  const helm = new Path2D()
  helm.moveTo(-11.5, -93.5); helm.lineTo(-11.5, -101); helm.arc(0, -101, 11.5, Math.PI, 0); helm.lineTo(11.5, -93.5); helm.lineTo(8.4, -93.5); helm.lineTo(8.4, -102.2); helm.lineTo(-8.4, -102.2); helm.lineTo(-8.4, -93.5); helm.closePath()
  C.part(helm, -11.5, 11.5, 1.05, 0.3, true)
  C.part(poly([[-1.3, -102.2], [1.3, -102.2], [1.1, -95.5], [-1.1, -95.5]]), -1.3, 1.3, 1, 0.5)
  C.groove(line([[-11, -103.5], ['q', 0, -106, 11, -103.5]]), 0.6, 0.5)
  for (let i = -4; i <= 4; i++) C.groove(circle(i * 2.4, -104.6 - Math.cos(i / 4) * 0.6, 0.35), 0.4, 0.5)
  C.groove(line([[0, -112.4], ['q', -3.5, -108, -2.5, -104.5]]), 0.7, 0.5)
  C.part(circle(0, -112.6, 1.7), -1.7, 1.7, 1, 0.4)
  // the shield on the other arm: a rim, a boss, a triskele cut round it
  const sc = [-10, -62]
  C.part(circle(sc[0], sc[1], 21), -31, 11, 1.02, 0.3, true)
  C.groove(circle(sc[0], sc[1], 18.4), 0.8, 0.5)
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; C.groove(circle(sc[0] + Math.cos(a) * 19.8, sc[1] + Math.sin(a) * 19.8, 0.45), 0.5, 0.45) }
  triskele(C, sc[0], sc[1], 15.5, 0.7)
  C.part(circle(sc[0], sc[1], 6), sc[0] - 6, sc[0] + 6, 1.1, 0.32, true)
  C.groove(circle(sc[0] - 1.6, sc[1] - 1.8, 1.4), 0.5, 0.3)
}

function king(C) {
  C.part(poly([[-19, -112], [19, -112], [31, -12], ['q', 0, -4, -31, -12]]), -31, 31, 0.7, 0.16)         // cloak behind
  const robe = poly([[-25, -10], ['q', 0, -4, 25, -10], [16, -84], [18, -112], [-18, -112], [-16, -84]])
  C.part(robe, -25, 25, 1, 0.36)
  for (const [x0, x1] of [[-15, -9], [-6.5, -4], [6.5, 4], [15, 9]]) C.groove(line([[x0, -11], ['q', x0 * 0.9, -46, x1, -80]]), 0.75, 0.45)
  C.part(poly([[-16.4, -82], [16.4, -82], [16.6, -88], [-16.6, -88]]), -17, 17, 0.6, 0.22)             // belt
  for (const s of [-1, 1]) C.part(poly([[s * 18, -110], [s * 12, -113], [s * 3.5, -87], [s * 9, -80]]), s < 0 ? -18 : 3, s < 0 ? -3 : 18, s < 0 ? 0.9 : 0.6, 0.3)
  // the sword, point down, the hands crossed on its pommel
  C.part(poly([[-3, -76], [3, -76], [2.4, -20], [0, -12], [-2.4, -20]]), -3, 3, 1.15, 0.5)
  C.groove(line([[0, -74], [0, -24]]), 0.55, 0.4)
  C.part(poly([[-12.5, -79.5], [12.5, -79.5], [12.5, -75.6], [-12.5, -75.6]]), -12.5, 12.5, 0.95, 0.35)
  C.part(circle(0, -93, 3.6), -3.6, 3.6, 1, 0.4, true)
  C.part(poly([[-9, -88], ['q', -9.5, -81, -4, -80], [5, -80], ['q', 9.5, -81, 9, -88], ['q', 0, -91.5, -9, -88]]), -9.5, 9.5, 1, 0.36)
  for (const x of [-5.4, -2.2, 1, 4.2]) C.groove(line([[x, -87.6], [x + 0.6, -81.4]]), 0.5, 0.5)
  // the brooch on his shoulder
  const br = new Path2D(); br.arc(-12, -104, 3.6, 0.55, Math.PI * 2 - 0.55); C.groove(br, 1.2, 0.7); C.gild(oval(-12, -104, 4.3, 4.3))
  C.groove(line([[-17, -100], [-8, -107.5]]), 0.7, 0.6)
  // the torc, the head, the beard
  C.part(poly([[-5, -112], [5, -112], [5, -118], [-5, -118]]), -5, 5, 0.75, 0.4)
  const torc = new Path2D(); torc.ellipse(0, -112, 7.5, 3, 0, 0.1, Math.PI - 0.1); C.groove(torc, 1.6, 0.6)
  C.part(circle(0, -125, 11), -11, 11, 1, 0.35, true)
  face(C, 0, -127, 1, true)
  const beard = poly([[-10, -121], ['q', -9.5, -108, 0, -100.5], ['q', 9.5, -108, 10, -121], ['q', 0, -115.5, -10, -121]])
  C.part(beard, -10, 10, 1, 0.42)
  for (const x of [-5, -1.5, 2, 5.5]) C.groove(line([[x, -117], ['q', x * 0.7 + 1, -110, x * 0.4, -104]]), 0.5, 0.45)
  C.groove(line([[-5, -118.6], ['q', 0, -120.6, 5, -118.6]]), 0.7, 0.55)
  for (const s of [-1, 1]) C.part(poly([[s * 10.5, -131], [s * 12.4, -126], [s * 11.6, -116], [s * 9, -120]]), -12, 12, 0.85, 0.35)   // hair
  // the crown, its middle point carrying a sun
  const crown = new Path2D()
  crown.moveTo(-11.5, -131); crown.lineTo(11.5, -131); crown.lineTo(11, -137.5); crown.lineTo(-11, -137.5); crown.closePath()
  for (const x of [-10, -5, 0, 5, 10]) { crown.moveTo(x - 2.6, -137); crown.lineTo(x, -137 - (x ? 9 : 14)); crown.lineTo(x + 2.6, -137); crown.closePath() }
  C.part(crown, -11.5, 11.5, 1, 0.4); C.gild(crown)
  const sun = circle(0, -157, 6.6); C.part(sun, -6.6, 6.6, 1.05, 0.45, true); C.gild(sun)
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; C.groove(line([[Math.cos(a) * 2.4, -157 + Math.sin(a) * 2.4], [Math.cos(a) * 5.4, -157 + Math.sin(a) * 5.4]]), 0.5, 0.5) }
}

function druid(C) {
  const robe = poly([[-22, -9], ['q', 0, -3, 22, -9], [15, -100], ['q', 0, -106, -15, -100]])
  C.part(robe, -22, 22, 0.95, 0.3)
  for (const [x0, x1] of [[-14, -8], [-5, -3], [5, 3], [13, 8]]) C.groove(line([[x0, -10], ['q', x0 * 0.85, -50, x1, -90]]), 0.75, 0.45)
  // the hood, a deep shadow in it, the beard out of the shadow
  const hood = poly([[-17, -96], [-16.5, -118], ['q', -13, -134, 2, -142], ['q', 12, -133, 16.5, -118], [17, -96], ['q', 0, -90, -17, -96]])
  C.part(hood, -17, 17, 0.95, 0.28, true)
  C.groove(line([[2, -141], ['q', -6, -128, -9, -106]]), 0.6, 0.4)
  const g = C.g, fo = oval(0, -114, 8.2, 10.8), gr = g.createRadialGradient(-1, -112, 1, 0, -114, 11)
  gr.addColorStop(0, 'rgba(26,20,16,1)'); gr.addColorStop(1, 'rgba(6,4,3,1)'); g.fillStyle = gr; g.fill(fo)
  g.strokeStyle = 'rgba(255,240,220,0.12)'; g.lineWidth = 0.6; g.stroke(line([[-0.2, -117], [0.6, -111]]))
  for (const sx of [-1, 1]) { g.fillStyle = 'rgba(255,214,160,0.28)'; g.fill(circle(sx * 3, -116.2, 0.55)) }
  const beard = poly([[-7, -108], ['q', -9.5, -90, 0, -72], ['q', 9.5, -90, 7, -108], ['q', 0, -104.5, -7, -108]])
  C.part(beard, -9.5, 9.5, 1, 0.42)
  for (const x of [-4.5, -1.5, 1.5, 4.5]) C.groove(line([[x, -105], ['q', x + 1.6, -96, x * 0.5, -78]]), 0.5, 0.45)
  // the cord at his waist
  C.groove(line([[-15, -66], ['q', 0, -62, 15, -66]]), 1.5, 0.6)
  C.groove(line([[-4, -64.4], ['q', -6, -56, -5, -46]]), 1.1, 0.55); C.groove(line([[-3, -64.2], ['q', -1, -56, -2.4, -48]]), 1.1, 0.55)
  // the staff, forked at the top like a young oak, and the hand on it
  C.part(poly([[23, -8], [27, -8], [26.6, -128], [23.4, -128]]), 23, 27, 0.95, 0.35)
  for (const y of [-40, -71, -106]) C.groove(line([[23.3, y], [26.7, y - 1.4]]), 0.5, 0.4)
  C.part(poly([[23.6, -127], [17.4, -142.6], [20, -144], [26, -130]]), 17, 26, 0.95, 0.4)
  C.part(poly([[25.4, -128.5], [31.6, -141.4], [29.4, -143], [24, -131.5]]), 24, 32, 0.8, 0.35)
  for (const [x, y, a] of [[15.6, -143, -0.6], [33.6, -141, 0.6]]) {
    const lf = new Path2D(); for (let i = 0; i <= 14; i++) { const t = i / 14 * Math.PI * 2, r = 3.4 + 0.9 * Math.cos(t * 3); lf.lineTo(x + Math.cos(t + a) * r * 0.62, y + Math.sin(t + a) * r) } lf.closePath()
    C.part(lf, x - 3, x + 3, 0.95, 0.4)
  }
  C.part(oval(25, -133.8, 1.9, 2.5), 23, 27, 1, 0.45, true)
  C.part(poly([[11.5, -98], [17.5, -96.5], [28.6, -83], [24, -76], [16.5, -85]]), 11.5, 28.6, 0.75, 0.28)
  C.part(oval(25.2, -82, 4.6, 5.2), 20.6, 29.8, 0.95, 0.35, true)
}

function queen(C) {
  C.part(poly([[-16, -108], [16, -108], [29, -12], ['q', 0, -5, -29, -12]]), -29, 29, 0.68, 0.16)          // cloak behind
  C.part(poly([[-25, -10], ['q', 0, -3, 25, -10], [11, -80], [-11, -80]]), -25, 25, 0.98, 0.32)            // the gown
  for (const [x0, x1] of [[-17, -8], [-7, -3], [6, 3], [16, 8]]) C.groove(line([[x0, -11], ['q', x0 * 0.6, -50, x1, -78]]), 0.75, 0.45)
  C.part(poly([[-11.6, -78], [11.6, -78], [11.3, -83], [-11.3, -83]]), -12, 12, 0.6, 0.22)
  C.part(poly([[-11, -82], [11, -82], [14, -106], ['q', 0, -110, -14, -106]]), -14, 14, 0.95, 0.32)     // bodice
  // her spear, and the arm that holds it
  C.part(poly([[-27, -9], [-24, -9], [-24.3, -146], [-26.7, -146]]), -27, -24, 0.95, 0.35)
  const head = poly([[-25.5, -162], [-22, -153], [-23.4, -146], [-27.6, -146], [-29, -153]]); C.part(head, -29, -22, 1.1, 0.45)
  C.groove(line([[-25.5, -160], [-25.5, -148]]), 0.45, 0.45)
  C.part(poly([[-12, -105], [-16, -103], [-27.5, -93], [-23.5, -86], [-14, -95]]), -27.5, -12, 0.92, 0.38)
  C.part(oval(-25.5, -90, 4.4, 5), -30, -21, 1, 0.38, true)
  C.part(oval(8, -79, 4.4, 3.6), 3.6, 12.4, 0.8, 0.32, true)                                           // her other hand at the girdle
  // a brooch at her shoulder
  const br = new Path2D(); br.arc(9, -100, 3.5, 0.55, Math.PI * 2 - 0.55); C.groove(br, 1.2, 0.7); C.gild(oval(9, -100, 4.2, 4.2))
  C.groove(line([[5, -96], [13, -104.5]]), 0.7, 0.6)
  // the head, the hair braided down over her shoulders, a slender crown
  C.part(poly([[-4.2, -106], [4.2, -106], [4.2, -112], [-4.2, -112]]), -4.2, 4.2, 0.75, 0.4)
  C.part(poly([[-10.4, -124], ['q', -13, -112, -11.6, -100], [-8.6, -100], ['q', -9, -112, -7, -120]]), -13, -7, 0.85, 0.35)
  C.part(poly([[10.4, -124], ['q', 13, -112, 11.6, -100], [8.6, -100], ['q', 9, -112, 7, -120]]), 7, 13, 0.7, 0.3)
  for (const s of [-1, 1]) { C.part(poly([[s * 9, -108], [s * 13, -108], [s * 12.6, -82], [s * 9.4, -82]]), s < 0 ? -13 : 9, s < 0 ? -9 : 13, s < 0 ? 0.9 : 0.62, 0.3); for (let y = -106; y < -84; y += 3.2) C.groove(line([[s * 9.2, y], [s * 12.8, y + 1.8]]), 0.5, 0.5) }
  C.part(circle(0, -119, 9.6), -9.6, 9.6, 1, 0.35, true)
  face(C, 0, -120, 0.9)
  C.part(poly([[-9.6, -122], ['q', -9, -131, 0, -130.5], ['q', 9, -131, 9.6, -122], ['q', 4, -126, 0, -125.5], ['q', -4, -126, -9.6, -122]]), -9.6, 9.6, 0.9, 0.35)
  const crown = new Path2D()
  crown.moveTo(-9.4, -127); crown.lineTo(9.4, -127); crown.lineTo(9, -131); crown.lineTo(-9, -131); crown.closePath()
  for (const x of [-8, -4, 0, 4, 8]) { crown.moveTo(x - 1.3, -130.8); crown.lineTo(x, -130.8 - (x ? 4.6 : 6.4)); crown.lineTo(x + 1.3, -130.8); crown.closePath(); crown.moveTo(x + 1.5, -130.8 - (x ? 5.6 : 7.4)); crown.arc(x, -130.8 - (x ? 5.6 : 7.4), 1.5, 0, Math.PI * 2) }
  C.part(crown, -9.4, 9.4, 1, 0.4); C.gild(crown)
}

function castle(C) {
  const r0 = 26, r1 = 23, yb = -9, yt = -86, F = FLAT
  const body = new Path2D(); body.moveTo(-r0, yb); body.lineTo(-r1, yt); body.lineTo(r1, yt); body.lineTo(r0, yb); body.ellipse(0, yb, r0, r0 * F, 0, 0, Math.PI, false); body.closePath()
  C.part(body, -r0, r0, 0.95, 0.26, true)
  // its courses of stone, and the joints between them, staggered
  const R = rng(hash('castle'))
  for (let y = yb - 8, i = 0; y > yt + 2; y -= 8.5, i++) {
    const r = r0 + (r1 - r0) * (yb - y) / (yb - yt), c = new Path2D(); c.ellipse(0, y, r, r * F, 0, 0.08, Math.PI - 0.08); C.groove(c, 0.55, 0.45)
    for (let k = 0; k < 6; k++) { const a = 0.25 + (k + (i % 2) * 0.5) * 0.48, x = r * Math.cos(a), yy = y + r * F * Math.sin(a); if (a < Math.PI - 0.1) C.groove(line([[x, yy], [x, yy + 8.2]]), 0.45, 0.35 + 0.15 * R()) }
  }
  const door = new Path2D(); door.moveTo(-6.4, yb + r0 * F - 0.4); door.lineTo(-6.4, -12); door.arc(0, -12, 6.4, Math.PI, 0); door.lineTo(6.4, yb + r0 * F - 0.4); door.closePath()
  C.hole(door, 0.92); C.groove(door, 1, 0.5)
  C.hole(poly([[-1.5, -58], [1.5, -58], [1.5, -43], [-1.5, -43]]), 0.85)
  for (const s of [-1, 1]) C.hole(poly([[s * 15, -62], [s * 16, -62], [s * 16, -50], [s * 15, -50]]), 0.75)
  // the corbelled band, the parapet, its merlons (the far ones first, the walk inside, then the near ones)
  C.part(drum(25.6, yt, yt - 5), -25.6, 25.6, 0.85, 0.22, true)
  for (let k = 0; k < 13; k++) { const a = 0.12 + k * (Math.PI - 0.24) / 12; C.hole(poly([[25.6 * Math.cos(a) - 1, yt + 25.6 * F * Math.sin(a) - 0.2], [25.6 * Math.cos(a) + 1, yt + 25.6 * F * Math.sin(a) - 0.2], [25.6 * Math.cos(a) + 1, yt + 25.6 * F * Math.sin(a) + 2.6], [25.6 * Math.cos(a) - 1, yt + 25.6 * F * Math.sin(a) + 2.6]]), 0.5) }
  const yp = -100, rp = 26
  const merlon = (a) => { const x = rp * Math.cos(a), y = yp + rp * F * Math.sin(a); return poly([[x - 3.2, y], [x + 3.2, y], [x + 3.2, y - 8], [x - 3.2, y - 8]]) }
  for (const a of [Math.PI * 1.18, Math.PI * 1.39, Math.PI * 1.61, Math.PI * 1.82]) C.part(merlon(a), rp * Math.cos(a) - 3.2, rp * Math.cos(a) + 3.2, 0.7, 0.3)
  const tp = oval(0, yp, rp, rp * F); C.flat(tp, 0.82)
  const walk = oval(0, yp + 0.8, rp - 5, (rp - 5) * F), g = C.g, gr = g.createLinearGradient(0, yp - 15, 0, yp + 15)
  gr.addColorStop(0, C.col(0.16)); gr.addColorStop(1, C.col(0.42)); g.fillStyle = gr; g.fill(walk); C.groove(walk, 0.8, 0.5)
  C.part(drum(rp, yt - 5, yp), -rp, rp, 0.9, 0.25, true)
  for (const a of [0.18, 0.62, Math.PI / 2 + 0.38, Math.PI - 0.62, Math.PI - 0.18].sort((p, q) => Math.sin(p) - Math.sin(q))) C.part(merlon(a), rp * Math.cos(a) - 3.2, rp * Math.cos(a) + 3.2, 0.98, 0.3)
}

function knight(C) {
  const p = new Path2D()
  p.moveTo(-15, -9)
  p.bezierCurveTo(-19, -30, -18, -50, -14, -64)       // the front of the neck
  p.bezierCurveTo(-16, -70, -22, -74, -30, -78)       // the throat to the jaw
  p.bezierCurveTo(-38, -81, -44, -84, -46, -89)       // the jaw to the chin
  p.bezierCurveTo(-48, -94, -47, -99, -44, -102)      // the muzzle
  p.bezierCurveTo(-38, -108, -30, -114, -23, -119)    // the nose to the brow
  p.lineTo(-19.5, -122); p.lineTo(-17.5, -136); p.lineTo(-12.5, -124.5); p.lineTo(-8.5, -133.5); p.lineTo(-4, -121.5)   // the ears
  p.bezierCurveTo(4, -116, 12, -100, 16, -84)         // the crest
  p.bezierCurveTo(20, -64, 23, -36, 22, -9)
  p.quadraticCurveTo(3, -2, -15, -9); p.closePath()
  C.part(p, -48, 23, 1.02, 0.24)
  // the mane along the crest, its locks
  const mane = poly([[-4, -121.5], ['c', 4, -116, 12, -100, 16, -84], ['c', 20, -64, 23, -36, 22, -12], [26.4, -14], [24.6, -28], [27.4, -40], [24.4, -52], [26.2, -66], [22.4, -78], [23, -92], [17.8, -102], [16.4, -112], [9, -117], [5, -123]])
  C.part(mane, 10, 28, 0.62, 0.2)
  for (let i = 0; i < 9; i++) { const t = i / 9, y = -118 + t * 104, x = 4 + 18 * Math.sin(t * 1.7); C.groove(line([[x, y], ['q', x + 4, y + 4, x + 6.5, y + 10]]), 0.55, 0.5) }
  C.groove(line([[-14.5, -123], ['q', -16, -117, -20, -114]]), 0.6, 0.5)
  // the eye, the nostril, the mouth, the round of the jaw
  C.hole(oval(-24.5, -104, 3.2, 1.9, -0.35), 0.85); C.groove(line([[-29, -106.6], ['q', -25, -109.4, -20.6, -106.6]]), 0.6, 0.5)
  C.groove(oval(-42.2, -95.5, 2.3, 1.5, -0.4), 0.7, 0.6)
  C.groove(line([[-46.2, -89.4], ['q', -42, -87.6, -37.6, -88.4]]), 0.6, 0.55)
  const jaw = new Path2D(); jaw.arc(-21, -92, 11, 0.25, 2.5); C.groove(jaw, 0.7, 0.45)
  // the bridle
  C.groove(line([[-40, -101.5], ['q', -37, -95, -38.2, -86.8]]), 1.3, 0.55)
  C.groove(line([[-16.6, -118], ['q', -22, -104, -36.5, -88.6]]), 1.3, 0.55)
  C.groove(circle(-37.8, -87.6, 2.3), 0.8, 0.6)
}

const FIGS = { ri: king, laoch: warrior, ceith: warrior, caislean: castle, ridire: knight, draoi: druid, banrion: queen }

// weather the carving: grain, lichen, grime at the foot, moss round the plinth, the fire's warmth on the left side
function weather(C, k, top) {
  const g = C.g, R = rng(hash(k)), pale = C.stone === 'pale'
  g.save(); g.globalCompositeOperation = 'source-atop'
  for (let i = 0; i < 2600; i++) {
    const x = -55 + 110 * R(), y = top + (25 - top) * R(), d = R() < 0.55
    g.fillStyle = d ? `rgba(18,14,10,${0.05 + 0.1 * R()})` : `rgba(255,250,236,${pale ? 0.05 + 0.08 * R() : 0.03 + 0.05 * R()})`
    g.fillRect(x, y, 0.45 + R() * 1.1, 0.45 + R() * 1.1)
  }
  const lich = pale ? ['rgba(168,166,112,0.32)', 'rgba(186,146,88,0.26)', 'rgba(150,160,122,0.3)'] : ['rgba(196,200,188,0.26)', 'rgba(160,176,142,0.22)', 'rgba(190,160,104,0.2)']
  for (let c = 0; c < 7; c++) {
    const cx = -34 + 68 * R(), cy = top * (0.08 + 0.85 * R()), col = lich[c % lich.length], n = 10 + (R() * 16 | 0)
    g.fillStyle = col
    for (let i = 0; i < n; i++) { const a = R() * 6.283, r = Math.pow(R(), 0.6) * 3.6; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 0.25 + R() * 0.7, 0, 6.283); g.fill() }
  }
  const gr = g.createLinearGradient(0, -46, 0, 24); gr.addColorStop(0, 'rgba(10,8,6,0)'); gr.addColorStop(1, 'rgba(10,8,6,0.4)')
  g.fillStyle = gr; g.fillRect(-60, -46, 120, 72)
  const rim = g.createLinearGradient(-50, 0, -6, 0); rim.addColorStop(0, 'rgba(255,176,96,0.26)'); rim.addColorStop(1, 'rgba(255,176,96,0)')
  g.fillStyle = rim; g.fillRect(-60, top, 60, 90 - top)
  for (let i = 0; i < 26; i++) {                         // moss in the angle of the plinth
    const a = 0.15 + R() * (Math.PI - 0.3), front = R() < 0.6, rx = 34, ry = rx * FLAT
    const x = Math.cos(a) * rx * (front ? 0.98 : 0.86), y = (front ? 0 : -9) + Math.sin(a) * ry * (front ? 0.98 : 0.86)
    g.fillStyle = `rgba(${52 + R() * 22 | 0},${70 + R() * 22 | 0},${38 + R() * 12 | 0},${0.45 + 0.25 * R()})`
    for (let j = 0; j < 6; j++) { g.beginPath(); g.arc(x + (R() - 0.5) * 3.4, y + (R() - 0.5) * 1.4, 0.3 + R() * 0.5, 0, 6.283); g.fill() }
  }
  g.restore()
  // gold leaf where it was laid, worn through in places
  for (const path of C.gilt) {
    g.save(); g.clip(path)
    const gg = g.createLinearGradient(-14, top, 14, top + 60); gg.addColorStop(0, 'rgba(250,222,128,0.92)'); gg.addColorStop(0.5, 'rgba(214,166,58,0.9)'); gg.addColorStop(1, 'rgba(140,96,24,0.9)')
    g.fillStyle = gg; g.fillRect(-60, top - 10, 120, 200)
    for (let i = 0; i < 160; i++) { g.fillStyle = C.col(0.3 + 0.5 * R(), 0.55); g.fillRect(-30 + 60 * R(), top + (100 * R()), 0.6 + R() * 1.2, 0.6 + R()) }
    g.restore()
    g.strokeStyle = 'rgba(40,24,6,0.7)'; g.lineWidth = 0.8; g.stroke(path)
  }
}

// a piece, painted at `res` pixels to the square: { c (the canvas), fx, fy (its foot in it), res }
export function paintPiece(k, res) {
  const K = KINDS[k], s = res / 100, top = -(K.h + 6)
  const c = document.createElement('canvas'); c.width = Math.ceil(110 * s); c.height = Math.ceil((K.h + 31) * s)
  const g = c.getContext('2d'), fx = c.width / 2, fy = (K.h + 6) * s
  g.setTransform(s, 0, 0, s, fx, fy)
  const C = carver(g, K.stone)
  plinth(C, k); FIGS[k](C); weather(C, k, top)
  return { c, fx, fy, res }
}

// ── the board's own stone: a square of it, `px` across ─────────────────────────────────────────────────────
const SQ_RGB = { lt: [222, 213, 192], dk: [170, 158, 130], gate: [224, 198, 136], well: [116, 110, 98] }
export function paintSquare(type, variant, px) {
  const c = document.createElement('canvas'); c.width = c.height = px
  const g = c.getContext('2d'), R = rng(hash(type + variant)), [r0, g0, b0] = SQ_RGB[type], s = px / 100
  const v = 0.95 + 0.1 * R()
  g.fillStyle = `rgb(${r0 * v | 0},${g0 * v | 0},${b0 * v | 0})`; g.fillRect(0, 0, px, px)
  g.setTransform(s, 0, 0, s, 0, 0)
  for (let i = 0; i < 7; i++) {                           // weathering: broad stains
    const x = R() * 100, y = R() * 100, r = 12 + R() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r), d = R() < 0.6
    gr.addColorStop(0, d ? 'rgba(60,48,30,0.1)' : 'rgba(255,250,235,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 100, 100)
  }
  const worn = g.createRadialGradient(50, 50, 5, 50, 50, 50); worn.addColorStop(0, 'rgba(255,250,236,0.12)'); worn.addColorStop(1, 'rgba(255,250,236,0)')
  g.fillStyle = worn; g.fillRect(0, 0, 100, 100)
  for (let i = 0; i < 900; i++) { const d = R() < 0.55; g.fillStyle = d ? `rgba(30,22,12,${0.06 + 0.09 * R()})` : `rgba(255,252,240,${0.05 + 0.08 * R()})`; g.fillRect(R() * 100, R() * 100, 0.5 + R() * 1.3, 0.5 + R() * 1.3) }
  if (R() < 0.45) {                                       // a hairline crack
    let x = R() < 0.5 ? 0 : 100 * R(), y = x === 0 ? 100 * R() : 0, a = x === 0 ? (R() - 0.5) * 0.8 : Math.PI / 2 + (R() - 0.5) * 0.8
    g.beginPath(); g.moveTo(x, y)
    for (let i = 0; i < 14; i++) { a += (R() - 0.5) * 0.7; x += Math.cos(a) * 5; y += Math.sin(a) * 5; g.lineTo(x, y) }
    g.strokeStyle = 'rgba(30,22,14,0.5)'; g.lineWidth = 0.7; g.stroke()
  }
  // a bevel: the edges near the fire catch it, the far ones are in shadow
  const bev = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h) }
  bev(0, 0, 100, 2.2, 'rgba(255,248,230,0.22)'); bev(0, 0, 2.2, 100, 'rgba(255,248,230,0.18)')
  bev(0, 97.8, 100, 2.2, 'rgba(20,14,8,0.25)'); bev(97.8, 0, 2.2, 100, 'rgba(20,14,8,0.22)')
  if (type === 'gate') {                                  // a gateway cut in it: two posts and a lintel, a border round
    g.strokeStyle = 'rgba(96,66,16,0.75)'; g.lineWidth = 1.6; g.strokeRect(12, 12, 76, 76)
    g.strokeStyle = 'rgba(255,240,200,0.35)'; g.lineWidth = 0.8; g.strokeRect(12.8, 12.8, 76, 76)
    g.fillStyle = 'rgba(96,66,16,0.6)'; g.fillRect(36, 34, 5, 34); g.fillRect(59, 34, 5, 34); g.fillRect(31, 28, 38, 6)
    g.fillStyle = 'rgba(40,26,8,0.55)'; g.fillRect(41, 34, 18, 34)
  }
  if (R() < 0.35 && type !== 'gate') {                    // moss in a corner
    const cx = R() < 0.5 ? 2 : 98, cy = R() < 0.5 ? 2 : 98
    for (let i = 0; i < 30; i++) { const a = R() * 6.283, r = R() * 7; g.fillStyle = `rgba(${60 + R() * 30 | 0},${88 + R() * 30 | 0},${42 + R() * 14 | 0},0.7)`; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.5 + R() * 1.1, 0, 6.283); g.fill() }
  }
  return c
}

// ── the frieze cut along the board's near edge: a cattle raid, going east ─────────────────────────────────
// `res` pixels to the square; the band is 10.2 squares long and 0.3 high (design: 1020 by 30, the ground at 25)
export function paintFrieze(res) {
  const s = res / 100, W = 1020, H = 30
  const c = document.createElement('canvas'); c.width = Math.ceil(W * s); c.height = Math.ceil(H * s)
  const g = c.getContext('2d'); g.setTransform(s, 0, 0, s, 0, 0)
  const R = rng(hash('frieze'))
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#6f6553'); bg.addColorStop(0.5, '#857a64'); bg.addColorStop(1, '#5d5444')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  for (let i = 0; i < 3000; i++) { g.fillStyle = R() < 0.5 ? 'rgba(20,14,8,0.12)' : 'rgba(255,248,230,0.08)'; g.fillRect(R() * W, R() * H, 0.4 + R() * 0.8, 0.4 + R() * 0.8) }
  // the procession: drawn once in shadow, once in the stone of the relief
  const figs = []
  const seq = ['oak', 'hound', 'warrior', 'warrior', 'bull', 'herder', 'cow', 'cow', 'warrior', 'chariot', 'hound', 'warrior', 'dolmen', 'warrior', 'cow', 'herder', 'hound', 'chariot', 'warrior', 'warrior', 'oak']
  const WID = { oak: 22, hound: 16, warrior: 11, bull: 30, herder: 11, cow: 22, chariot: 40, dolmen: 22 }
  let x = 6; for (let i = 0; x < W - 10; i++) { const f = seq[i % seq.length]; figs.push([f, x + WID[f] / 2]); x += WID[f] + 3 + R() * 4 }
  const draw = (fill) => {
    g.fillStyle = fill; g.strokeStyle = fill; g.lineCap = 'round'; g.lineJoin = 'round'
    const L = (pts, w) => { g.lineWidth = w; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke() }
    const O = (px, py, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(px, py, rx, ry, rot, 0, 6.283); g.fill() }
    for (const [f, cx] of figs) {
      if (f === 'warrior' || f === 'herder') {
        L([[cx - 1.6, 25], [cx - 0.4, 18.6]], 1.3); L([[cx + 1.8, 25], [cx + 0.6, 18.6]], 1.3)
        g.beginPath(); g.moveTo(cx - 2.6, 19.4); g.lineTo(cx + 2.6, 19.4); g.lineTo(cx + 1.8, 12); g.lineTo(cx - 1.8, 12); g.fill()
        O(cx, 9.6, 1.9, 2.1)
        if (f === 'warrior') { L([[cx + 3.6, 25], [cx + 5.2, 4.6]], 0.8); O(cx - 1.8, 15.2, 3.3, 3.3); L([[cx + 1.6, 13], [cx + 4.4, 14.6]], 1) }
        else { L([[cx + 1.6, 13], [cx + 4.6, 16]], 1); L([[cx + 4.6, 10], [cx + 6, 25]], 0.7) }
      } else if (f === 'bull' || f === 'cow') {
        const k = f === 'bull' ? 1.25 : 1, by = 25 - 9.6 * k
        O(cx, by, 9 * k, 4.4 * k)
        for (const dx of [-6.4, -3.6, 4, 6.6]) L([[cx + dx * k, by + 2], [cx + dx * k + (dx < 0 ? -0.4 : 0.4), 25]], 1.6 * k)
        O(cx - 10.4 * k, by - 2.2 * k, 3.1 * k, 2.4 * k, 0.4); L([[cx - 9 * k, by - 3.8 * k], [cx - 8 * k, by - 7.4 * k]], 0.8 * k)
        L([[cx - 11.6 * k, by - 3.6 * k], [cx - 13.4 * k, by - 7 * k]], 0.8 * k)
        L([[cx + 8.6 * k, by - 1], [cx + 11 * k, by + 4.6 * k]], 0.7)
      } else if (f === 'hound') {
        O(cx, 17.6, 5.2, 2)
        L([[cx - 3.6, 18.4], [cx - 8, 22.6], [cx - 9.4, 25]], 1); L([[cx + 3.6, 18.4], [cx + 7.4, 23], [cx + 9.4, 24.6]], 1)
        O(cx - 6.6, 15.6, 2.4, 1.5, -0.3); L([[cx - 6, 14.4], [cx - 5, 12.4]], 0.7); L([[cx + 4.8, 17], [cx + 8.6, 13.8]], 0.7)
      } else if (f === 'chariot') {
        for (const [hx, hy] of [[cx - 12, 16.4], [cx - 9, 17.4]]) {
          O(hx, hy, 6.4, 2.9); O(hx - 7, hy - 3.6, 2.4, 1.6, -0.6); L([[hx - 5, hy - 1.6], [hx - 6.4, hy - 3]], 1.6)
          L([[hx - 4, hy + 1.6], [hx - 8.6, hy + 5], [hx - 10, hy + 7.8]], 0.9); L([[hx + 4, hy + 1.6], [hx + 7.6, hy + 6.2], [hx + 9.6, hy + 7.6]], 0.9)
        }
        g.lineWidth = 0.9; g.beginPath(); g.arc(cx + 6, 20, 5, 0, 6.283); g.stroke()
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; L([[cx + 6 + Math.cos(a) * 5, 20 + Math.sin(a) * 5], [cx + 6 - Math.cos(a) * 5, 20 - Math.sin(a) * 5]], 0.5) }
        g.fillRect(cx - 1, 13.6, 13, 2.2); L([[cx - 1, 14.6], [cx - 8, 15.4]], 0.8)
        for (const dx of [2.4, 7.6]) { O(cx + dx, 7.6, 1.6, 1.8); g.beginPath(); g.moveTo(cx + dx - 2, 13.6); g.lineTo(cx + dx + 2, 13.6); g.lineTo(cx + dx + 1.4, 9.2); g.lineTo(cx + dx - 1.4, 9.2); g.fill() }
        L([[cx + 9, 11], [cx + 13, 2.6]], 0.7)
      } else if (f === 'oak') {
        L([[cx, 25], [cx + 0.6, 12]], 2.4); L([[cx + 0.4, 15], [cx - 4, 10]], 1); L([[cx + 0.4, 14], [cx + 5, 9.6]], 1)
        for (const [dx, dy, r] of [[0, 6.6, 5.6], [-5.6, 9, 4.2], [5.8, 8.6, 4.4], [-2.6, 4.4, 3.6], [3.4, 4, 3.4]]) O(cx + dx, dy, r, r * 0.82)
      } else if (f === 'dolmen') {
        g.fillRect(cx - 7, 13, 3.6, 12); g.fillRect(cx + 3.6, 14, 3.6, 11)
        g.beginPath(); g.moveTo(cx - 10, 13.4); g.lineTo(cx + 9.6, 10.6); g.lineTo(cx + 10, 13.6); g.lineTo(cx - 9.6, 15.6); g.fill()
      }
    }
  }
  g.save(); g.translate(0.9, 0.9); draw('rgba(28,22,14,0.75)'); g.restore()
  draw('#b7ac92')
  g.save(); g.translate(-0.35, -0.35); g.globalAlpha = 0.25; draw('#fff6dc'); g.restore()
  // a twisted rope above and below
  for (const y0 of [0, 26]) {
    g.fillStyle = '#7a6f5a'; g.fillRect(0, y0, W, 4)
    g.strokeStyle = 'rgba(28,20,12,0.6)'; g.lineWidth = 0.7
    for (let xx = 0; xx < W; xx += 2.4) { g.beginPath(); g.moveTo(xx, y0 + 3.6); g.lineTo(xx + 2.2, y0 + 0.4); g.stroke() }
    g.fillStyle = 'rgba(255,246,222,0.18)'; g.fillRect(0, y0, W, 0.6)
  }
  return c
}

// ── the wren, rí na n-éan: a canvas `res` pixels to the square (it is an eighth of one long), facing west ───
export function paintWren(res, pose = 0) {
  const s = res / 100, c = document.createElement('canvas'); c.width = Math.ceil(18 * s); c.height = Math.ceil(16 * s)
  const g = c.getContext('2d'); g.setTransform(s, 0, 0, s, 9 * s, 12 * s)
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 0.35; g.lineCap = 'round'
  g.beginPath(); g.moveTo(-0.6, 1.8); g.lineTo(-0.9, 3.8); g.moveTo(0.8, 1.8); g.lineTo(0.9, 3.8); g.stroke()     // legs
  const tail = pose ? -1.1 : -0.75                         // the tail cocked up, flicked higher now and then
  g.save(); g.translate(2.6, -1); g.rotate(tail - 0.35); g.fillStyle = '#6e4a2c'; g.beginPath(); g.ellipse(1.7, 0, 2, 0.62, 0, 0, 6.283); g.fill()
  g.strokeStyle = 'rgba(40,24,12,0.6)'; g.lineWidth = 0.2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(1 + i * 0.9, -0.5); g.lineTo(1 + i * 0.9, 0.5); g.stroke() } g.restore()
  const body = g.createRadialGradient(-0.8, -1.2, 0.3, 0, 0, 4); body.addColorStop(0, '#b0814f'); body.addColorStop(1, '#6e4a2a')
  g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 3.2, 2.6, -0.1, 0, 6.283); g.fill()
  g.fillStyle = '#d6b78c'; g.beginPath(); g.ellipse(-0.6, 1.1, 2.2, 1.3, 0, 0, 6.283); g.fill()   // its pale breast
  g.strokeStyle = 'rgba(46,28,14,0.75)'; g.lineWidth = 0.3; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0.4 + i * 0.8, -1.4); g.lineTo(0.9 + i * 0.8, 0.6); g.stroke() }
  const hx = pose ? -2.7 : -3, hy = -2.1
  g.fillStyle = '#86603b'; g.beginPath(); g.arc(hx, hy, 1.7, 0, 6.283); g.fill()
  g.strokeStyle = '#e8d7b6'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(hx - 1.2, hy - 0.7); g.lineTo(hx + 1, hy - 0.9); g.stroke()
  g.fillStyle = '#120c06'; g.beginPath(); g.arc(hx - 0.6, hy - 0.2, 0.32, 0, 6.283); g.fill()
  g.strokeStyle = '#2a1c0e'; g.lineWidth = 0.42; g.beginPath(); g.moveTo(hx - 1.5, hy + 0.1); g.lineTo(hx - 3, hy + (pose ? -0.2 : 0.4)); g.stroke()
  return c
}

// ── across the table: head and shoulders, looming, lit from the left by the fire. `res` pixels to the square;
// 15 squares wide, 13 high; the foot of it is cut off by the table's edge ───────────────────────────────────
export function paintOpponent(res) {
  const s = res / 100, W = 1500, H = 1300, c = document.createElement('canvas'); c.width = Math.ceil(W * s); c.height = Math.ceil(H * s)
  const g = c.getContext('2d'); g.setTransform(s, 0, 0, s, W / 2 * s, H * s)
  const R = rng(hash('opponent'))
  const body = poly([[-720, 0], ['q', -712, -500, -430, -600], ['q', -250, -660, -150, -700], [150, -700], ['q', 250, -660, 430, -600], ['q', 712, -500, 720, 0]])
  const neck = poly([[-95, -680], [95, -680], [90, -790], [-90, -790]])
  const head = oval(0, -930, 150, 182)
  const hair = poly([[-158, -950], ['q', -176, -1128, 0, -1124], ['q', 180, -1128, 160, -940], ['q', 150, -1030, 0, -1040], ['q', -140, -1030, -158, -950]])
  const beard = poly([[-140, -890], ['q', -150, -720, -30, -672], [0, -664], [30, -672], ['q', 150, -720, 140, -890], ['q', 80, -830, 0, -846], ['q', -80, -830, -140, -890]])
  const sil = new Path2D(); for (const p of [body, neck, head, hair, beard]) sil.addPath(p)
  // the whole of him dark, then the fire along his west side: lit, then the same shape a little east of it dark again
  g.save(); g.clip(sil)
  g.fillStyle = '#d98a46'; g.fillRect(-W / 2, -H, W, H)
  g.translate(16, 4); g.fillStyle = '#17120e'; g.fill(sil); g.translate(-16, -4)
  const gr = g.createLinearGradient(-720, 0, 720, 0); gr.addColorStop(0, 'rgba(60,40,26,0.55)'); gr.addColorStop(0.4, 'rgba(23,18,14,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)')
  g.fillStyle = gr; g.fillRect(-W / 2, -H, W, H)
  for (let i = 0; i < 7000; i++) { const x = -720 + 1440 * R(), y = -1130 * R(); g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(120,96,70,0.05)'; g.fillRect(x, y, 3 + R() * 5, 1.5 + R() * 3) }
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill(hair); g.fill(beard)
  for (let i = 0; i < 120; i++) { const x = -130 + 260 * R(), y = -880 + 200 * R(); g.strokeStyle = 'rgba(80,58,40,0.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 16, y + 24 + 24 * R()); g.stroke() }
  for (const [x0, y0, x1, y1] of [[-430, -580, -320, -40], [-200, -650, -130, -60], [400, -580, 310, -50]]) { g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 12; g.stroke(line([[x0, y0], ['q', (x0 + x1) / 2 + 30, (y0 + y1) / 2, x1, y1]])) }
  g.restore()
  // a brooch at his shoulder, a penannular ring and its pin, catching the fire
  const bx = -330, by = -500
  g.strokeStyle = '#b8892e'; g.lineWidth = 10; g.beginPath(); g.arc(bx, by, 40, 0.75, Math.PI * 2 - 0.75); g.stroke()
  for (const a of [0.75, -0.75]) { g.fillStyle = '#c99a3a'; g.beginPath(); g.arc(bx + Math.cos(a) * 40, by + Math.sin(a) * 40, 9, 0, 6.283); g.fill() }
  g.strokeStyle = 'rgba(255,226,150,0.75)'; g.lineWidth = 3; g.beginPath(); g.arc(bx - 3, by - 3, 40, 2.3, 3.7); g.stroke()
  g.strokeStyle = '#8a6418'; g.lineWidth = 6; g.beginPath(); g.moveTo(bx - 70, by + 60); g.lineTo(bx + 46, by - 48); g.stroke()
  // the eyes, catching the light under his brows
  for (const sx of [-1, 1]) { const ex = sx * 58, ey = -942, eg = g.createRadialGradient(ex, ey, 0, ex, ey, 13); eg.addColorStop(0, 'rgba(255,214,150,0.85)'); eg.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = eg; g.beginPath(); g.arc(ex, ey, 13, 0, 6.283); g.fill() }
  // fading into the dark at the foot, where the table hides it
  g.globalCompositeOperation = 'destination-out'
  const f = g.createLinearGradient(0, -260, 0, 0); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = f; g.fillRect(-W / 2, -260, W, 262)
  return c
}
