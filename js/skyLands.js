// skyLands.js -- other places to stand under the champion sky, instead of the bull's back (for trying them side by side).
//
// Each paints the near land over the far mountains and hills that starSky has already drawn, by moonlight, to a canvas
// context. Each leads the eye up to the sight (PX, PY) with something that points there -- horns, blades, a broken arch,
// a stair -- and puts the druid and the queen somewhere to stand. Each returns:
//   tips   points that glint (the ends of horns and blades)
//   tipRGB the glint's colour
//   box    the part of the screen the land covers that the sky's names should keep out of
//   glow   where the chosen champion's stars stream down to
//
//   import { LANDS } from './skyLands.js'
//   const res = LANDS.henge(x, { W, H, PX, PY, S, rnd, tone, druid, queen, hill })

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────
const bez = (P0, P1, P2, P3) => (u) => { const v = 1 - u; return [0, 1].map(j => v * v * v * P0[j] + 3 * v * v * u * P1[j] + 3 * v * u * u * P2[j] + u * u * u * P3[j]) }
const mix = (a, b) => (k) => { k = Math.max(0, Math.min(1, k)); return `rgb(${a.map((v, j) => v + (b[j] - v) * k | 0).join(',')})` }
const BONE = mix([14, 15, 26], [206, 204, 224])                              // the elves' pale stone, by moonlight
const SEAM = (a) => `rgba(150,235,225,${a})`                                  // and the light in its seams
function poly(x, pts) { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath() }
// a tapering band along a curve (a horn, a blade), each piece shaded by how it faces the moon (up and to the left)
function band(x, P, wAt, shade, { n = 44, ribs = 0, seam = 0 } = {}) {
  const pts = Array.from({ length: n + 1 }, (_, i) => P(i / n)), mid = []
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l
    const wa = wAt(i / n) / 2, wb = wAt((i + 1) / n) / 2
    const q = [[ax + nx * wa, ay + ny * wa], [bx + nx * wb, by + ny * wb], [bx - nx * wb, by - ny * wb], [ax - nx * wa, ay - ny * wa]]
    const lf = nx * -0.5 + ny * -0.85, gr = x.createLinearGradient(q[0][0], q[0][1], q[3][0], q[3][1])
    gr.addColorStop(0, shade(0.18 + 0.6 * lf)); gr.addColorStop(0.5, shade(0.24)); gr.addColorStop(1, shade(0.14 - 0.6 * lf))
    poly(x, q); x.fillStyle = gr; x.fill(); x.strokeStyle = gr; x.lineWidth = 0.6; x.stroke()
    if (ribs && i % ribs === 2 && i < n - 5) { x.strokeStyle = 'rgba(6,8,14,0.5)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(q[0][0], q[0][1]); x.lineTo(q[3][0], q[3][1]); x.stroke() }
    mid.push([(ax + bx) / 2, (ay + by) / 2])
  }
  if (seam) {                                                          // a line of light down the middle
    x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = SEAM(seam); x.lineWidth = 1; x.shadowColor = SEAM(0.8); x.shadowBlur = 5
    x.beginPath(); mid.slice(2, -3).forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); x.restore()
  }
  return pts
}
// a standing stone, rough-topped, lit from the left
function slab(x, rnd, tone, X, Y, w, h, { lean = (rnd() - 0.5) * w * 0.4, k = 0.42 } = {}) {
  const q = [[X - w / 2, Y], [X - w * 0.46 + lean * 0.8, Y - h * (0.86 + rnd() * 0.08)], [X - w * 0.1 + lean, Y - h], [X + w * 0.2 + lean, Y - h * (0.95 + rnd() * 0.05)], [X + w * 0.46 + lean, Y - h * (0.84 + rnd() * 0.08)], [X + w / 2, Y]]
  poly(x, q)
  const sg = x.createLinearGradient(X - w / 2, 0, X + w / 2, 0); sg.addColorStop(0, tone(k)); sg.addColorStop(0.45, tone(k * 0.5)); sg.addColorStop(1, tone(0.06))
  x.fillStyle = sg; x.fill(); x.strokeStyle = 'rgba(2,3,6,0.6)'; x.lineWidth = 1; x.stroke()
  x.strokeStyle = 'rgba(175,185,220,0.2)'; x.beginPath(); x.moveTo(q[1][0], q[1][1]); x.lineTo(q[2][0], q[2][1]); x.lineTo(q[3][0], q[3][1]); x.stroke()
  return q
}
// a dressed block (a pier, a lintel, a step): a lit face, and a darker top or side if asked
function block(x, tone, pts, k = 0.3) {
  poly(x, pts); const xs = pts.map(p => p[0])
  const sg = x.createLinearGradient(Math.min(...xs), 0, Math.max(...xs), 0); sg.addColorStop(0, tone(k)); sg.addColorStop(1, tone(k * 0.35))
  x.fillStyle = sg; x.fill(); x.strokeStyle = 'rgba(2,3,6,0.55)'; x.lineWidth = 1; x.stroke()
}
// grass, finer far off, longer near; a few flowers
function grass(x, rnd, H, n, topOf, X0 = 0, X1 = 1e4) {
  for (let k = 0; k < n; k++) {
    const X = X0 + rnd() * Math.min(X1 - X0, 3000), t0 = topOf(X); if (t0 >= H) continue
    const Y = t0 + Math.pow(rnd(), 1.3) * (H - t0), u = Math.max(0, (Y - H * 0.74) / (H * 0.26)), hg = 3 + u * 12 + rnd() * 4
    x.strokeStyle = `rgba(${36 + rnd() * 26 | 0},${56 + rnd() * 26 | 0},${52 + rnd() * 18 | 0},${(0.5 + u * 0.4).toFixed(2)})`; x.lineWidth = 0.6 + u * 0.7
    x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + 1, Y - hg * 0.6, X + (rnd() - 0.4) * hg * 0.5, Y - hg); x.stroke()
    if (rnd() < 0.07) { x.fillStyle = rnd() < 0.5 ? 'rgba(235,230,210,0.75)' : 'rgba(225,190,215,0.65)'; x.beginPath(); x.arc(X, Y - hg, 0.7 + u, 0, Math.PI * 2); x.fill() }
  }
}
// ground: a filled curve to the foot of the screen
function ground(x, W, H, topOf, fill) {
  x.beginPath(); x.moveTo(-2, H + 2); for (let i = 0; i <= 64; i++) { const X = -2 + (W + 4) * i / 64; x.lineTo(X, Math.min(H + 2, topOf(X))) }
  x.lineTo(W + 2, H + 2); x.closePath(); x.fillStyle = fill; x.fill(); x.strokeStyle = 'rgba(170,180,215,0.16)'; x.lineWidth = 1; x.stroke()
}
// the druid and the queen, small and dark against the night, where they stand
function figures(x, c, at) {
  const fh = c.H * 0.075
  ;[[c.queen, at[0]], [c.druid, at[1]]].forEach(([im, [X, Y, sc = 1]]) => {
    if (!im || !im.complete || !im.naturalWidth) return
    const h = fh * sc, w = h * im.naturalWidth / im.naturalHeight
    x.save(); x.imageSmoothingEnabled = false; x.filter = 'brightness(0.5) saturate(0.6)'; x.drawImage(im, X - w / 2, Y - h, w, h); x.restore()
  })
}
const mist = (x, W, H, y0, y1, a = 0.12) => { const m = x.createLinearGradient(0, y0, 0, y1); m.addColorStop(0, 'rgba(130,145,195,0)'); m.addColorStop(0.5, `rgba(130,145,195,${a})`); m.addColorStop(1, 'rgba(130,145,195,0)'); x.fillStyle = m; x.fillRect(0, y0, W, y1 - y0) }
const GOLD_TIP = '255,236,190', SEAM_TIP = '190,255,245'

// ── the lands ────────────────────────────────────────────────────────────────────────────────────────
export const LANDS = {
  // HENGE: a ring of stones on a rise; across it, the two tallest stand either side of the sight, their tops worked into
  // horns that curve in toward each other and point up to it
  henge(x, c) {
    const { W, H, PX, S, rnd, tone } = c, cx = PX, cy = H * 0.84, rx = W * 0.62, ry = H * 0.075
    const floor = (X) => cy - ry * Math.sqrt(Math.max(0, 1 - Math.pow((X - cx) / (rx * 1.15), 2))) - 4
    ground(x, W, H, floor, tone(0.15))
    const stones = []
    for (let i = 0; i < 24; i++) {
      const th = Math.PI * 2 * i / 24 + 0.07, cs = Math.cos(th), sn = Math.sin(th)
      if (sn < 0 && Math.abs(cs) < 0.82) continue                       // (the near side open: we stand in the gap)
      if (sn > 0.93) continue                                             // (the far middle: the horned pair stand there)
      const X = cx + rx * cs, Y = cy - ry * sn, sc = 0.55 + 1.9 * Math.pow((1 - sn) / 2, 2)
      stones.push({ X, Y, w: S * 0.7 * sc, h: S * (1.4 + rnd() * 0.6) * sc })
    }
    stones.sort((a, b) => a.Y - b.Y)
    const tips = [], horned = []
    for (const sx of [-1, 1]) {
      const X = PX + sx * S * 1.45, Y = cy - ry * 0.97, h = S * 2.4, top = Y - h
      horned.push({ X, Y, sx, top })
    }
    for (const s of stones.filter(s => s.Y < cy - ry * 0.6)) slab(x, rnd, tone, s.X, s.Y, s.w, s.h)
    for (const { X, Y, sx, top } of horned) {                                 // the horned stones
      block(x, tone, [[X - S * 0.42, Y], [X - S * 0.36, top + S * 0.3], [X + S * 0.36, top + S * 0.3], [X + S * 0.42, Y]], sx < 0 ? 0.4 : 0.22)
      const P = bez([X, top + S * 0.45], [X - sx * S * 0.95, top - S * 0.55], [X - sx * S * 0.1, top - S * 1.9], [PX + sx * S * 0.45, top - S * 1.95])
      const pts = band(x, P, (u) => S * 0.7 * Math.pow(1 - u, 0.85) + S * 0.04, tone, { ribs: 5 })
      tips.push(pts[pts.length - 1])
    }
    for (const s of stones.filter(s => s.Y >= cy - ry * 0.6)) slab(x, rnd, tone, s.X, s.Y, s.w, s.h)
    grass(x, rnd, H, 380, floor)
    mist(x, W, H, H * 0.74, H * 0.8)
    figures(x, c, [[PX - W * 0.22, H * 0.93], [PX + W * 0.22, H * 0.93]])
    return { tips, tipRGB: GOLD_TIP, box: [PX - S * 3.2, Math.min(...tips.map(t => t[1])) - 6, PX + S * 3.2, H], glow: [PX, horned[0].top - S * 1.2] }
  },

  // TRILITHON: one great trilithon on the ridge, a pair of stone horns set on its lintel, rising and turning in to the
  // sight; lesser stones of a broken ring along the ridge; a fallen lintel in the grass near us
  trilithon(x, c) {
    const { W, H, PX, S, rnd, tone } = c
    const top = (X) => H * 0.795 + H * 0.085 * Math.pow((X - PX) / (W * 0.6), 2) + H * 0.004 * Math.sin(X * 0.07)
    for (const fx of [-0.42, -0.3, 0.33, 0.44]) { const X = PX + W * fx, Y = top(X) - 2, sc = 0.7 + Math.abs(fx) * 0.8; slab(x, rnd, tone, X, Y, S * 0.6 * sc, S * 1.3 * sc) }
    ground(x, W, H, top, tone(0.13))
    const base = top(PX) + 2, ut = base - S * 3.0, lt = ut - S * 0.55
    for (const sx of [-1, 1]) block(x, tone, [[PX + sx * S * 1.95, base], [PX + sx * S * 1.85, ut], [PX + sx * S * 1.1, ut], [PX + sx * S * 1.05, base]], sx < 0 ? 0.42 : 0.2)
    block(x, tone, [[PX - S * 2.35, ut + 2], [PX - S * 2.3, lt], [PX + S * 2.3, lt + 1], [PX + S * 2.35, ut + 2]], 0.36)
    x.strokeStyle = 'rgba(175,185,220,0.25)'; x.beginPath(); x.moveTo(PX - S * 2.3, lt); x.lineTo(PX + S * 2.3, lt + 1); x.stroke()
    const tips = []
    for (const sx of [-1, 1]) {
      const P = bez([PX + sx * S * 0.35, lt + S * 0.1], [PX + sx * S * 2.6, lt - S * 0.15], [PX + sx * S * 2.4, lt - S * 1.75], [PX + sx * S * 1.05, lt - S * 2.15])
      const pts = band(x, P, (u) => S * 0.62 * Math.pow(1 - u, 0.8) * (1 + 0.18 * Math.sin(u * Math.PI)) + S * 0.035, tone, { ribs: 5 })
      tips.push(pts[pts.length - 1])
    }
    x.beginPath(); x.ellipse(PX, lt - S * 0.05, S * 0.48, S * 0.34, 0, Math.PI, 0); x.closePath(); x.fillStyle = tone(0.3); x.fill(); x.strokeStyle = 'rgba(2,3,6,0.6)'; x.stroke()   // (the boss between the horns)
    grass(x, rnd, H, 420, top)
    block(x, tone, [[PX - W * 0.36, H * 0.95], [PX - W * 0.33, H * 0.9], [PX - W * 0.08, H * 0.915], [PX - W * 0.1, H * 0.97]], 0.32)      // (a fallen lintel)
    grass(x, rnd, H, 60, () => H * 0.94, PX - W * 0.37, PX - W * 0.08)
    mist(x, W, H, H * 0.76, H * 0.83)
    figures(x, c, [[PX - W * 0.3, H * 0.9], [PX + W * 0.27, H * 0.92]])
    return { tips, tipRGB: GOLD_TIP, box: [PX - S * 2.8, Math.min(...tips.map(t => t[1])) - 6, PX + S * 2.8, H], glow: [PX, lt - S * 0.6] }
  },

  // HORNED CAIRN: a court tomb, as in the north and west of Ireland: we stand in its forecourt, a crescent of stones whose
  // horns reach out round us, rising toward the tall portal stones at the mouth of the gallery; the long cairn behind
  horned_cairn(x, c) {
    const { W, H, PX, S, rnd, tone } = c
    const back = H * 0.8
    // the cairn: a long low mound of piled stones behind the portal
    x.beginPath(); x.moveTo(PX - S * 4.4, back + 2)
    x.bezierCurveTo(PX - S * 3.6, back - S * 1.6, PX - S * 1.4, back - S * 2.0, PX, back - S * 2.05)
    x.bezierCurveTo(PX + S * 1.4, back - S * 2.0, PX + S * 3.6, back - S * 1.6, PX + S * 4.4, back + 2); x.closePath()
    const cg = x.createLinearGradient(PX - S * 4, 0, PX + S * 4, 0); cg.addColorStop(0, tone(0.26)); cg.addColorStop(1, tone(0.07)); x.fillStyle = cg; x.fill()
    x.save(); x.clip(); for (let k = 0; k < 140; k++) { const X = PX + (rnd() - 0.5) * S * 8.6, Y = back - rnd() * S * 2.1; x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0,0.3' : '170,180,215,0.12'})`; x.beginPath(); x.ellipse(X, Y, S * (0.12 + rnd() * 0.14), S * (0.07 + rnd() * 0.07), rnd() - 0.5, 0, Math.PI * 2); x.fill() }; x.restore()
    const floor = (X) => back + H * 0.05 * Math.pow((X - PX) / (W * 0.5), 2)
    ground(x, W, H, floor, tone(0.12))
    // the portal: two tall stones leaning a little in, a lintel, the dark of the gallery between
    const pt = back - S * 2.7
    x.fillStyle = '#020306'; x.fillRect(PX - S * 0.55, pt + S * 0.5, S * 1.1, back - pt - S * 0.5)
    const tips = []
    for (const sx of [-1, 1]) {
      const X = PX + sx * S * 0.95
      const q = [[X - S * 0.38, back + 3], [X - S * 0.32 - sx * S * 0.08, pt + S * 0.2], [X - sx * S * 0.2, pt - S * 0.55], [X + S * 0.3 - sx * S * 0.1, pt + S * 0.1], [X + S * 0.38, back + 3]]
      poly(x, q); const sg = x.createLinearGradient(X - S * 0.4, 0, X + S * 0.4, 0); sg.addColorStop(0, tone(sx < 0 ? 0.44 : 0.3)); sg.addColorStop(1, tone(0.06)); x.fillStyle = sg; x.fill(); x.strokeStyle = 'rgba(2,3,6,0.6)'; x.stroke()
      tips.push(q[2])
    }
    block(x, tone, [[PX - S * 0.7, pt + S * 0.55], [PX - S * 0.66, pt + S * 0.15], [PX + S * 0.66, pt + S * 0.18], [PX + S * 0.7, pt + S * 0.58]], 0.34)
    // the forecourt: a crescent of stones, out from the portal and round toward us, lower and nearer as they go
    const arm = []
    for (const sx of [-1, 1]) for (let i = 1; i <= 7; i++) {
      const s = i / 7, X = PX + sx * (S * 1.5 + W * 0.56 * Math.pow(s, 1.25)), Y = back + H * 0.19 * s * s + 2, sc = 0.75 + 1.7 * s * s
      arm.push({ X, Y, w: S * 0.5 * sc, h: S * (2.0 - 1.15 * s) * sc * (0.85 + rnd() * 0.3) })
    }
    arm.sort((a, b) => a.Y - b.Y).forEach(s => slab(x, rnd, tone, s.X, s.Y, s.w, s.h))
    grass(x, rnd, H, 360, floor)
    mist(x, W, H, H * 0.76, H * 0.81, 0.1)
    figures(x, c, [[PX - W * 0.17, H * 0.95], [PX + W * 0.17, H * 0.95]])
    return { tips, tipRGB: GOLD_TIP, box: [PX - S * 4.4, pt - S * 0.7, PX + S * 4.4, H], glow: [PX, pt - S * 0.4] }
  },

  // BROKEN ARCH: the great arch of a fallen church door, its crown gone, the two broken halves reaching toward each other
  // under the sight; chevrons on its face as on the old Irish Romanesque doors; its fallen stones in the grass
  broken_arch(x, c) {
    const { W, H, PX, S, rnd, tone } = c
    const gnd = (X) => H * 0.86 + H * 0.05 * Math.pow((X - PX) / (W * 0.55), 2) + H * 0.006 * Math.sin(X * 0.05)
    const R = S * 3.0, T = S * 0.62, ac = H * 0.715
    // the walls either side, low and broken
    for (const sx of [-1, 1]) {
      const pts = [[PX + sx * (R + T * 0.5), H]], n = 14
      for (let i = 0; i <= n; i++) { const X = PX + sx * (R + T * 0.5 + (W * 0.6) * i / n); pts.push([X, ac + S * 0.2 + (rnd() * S * 1.2) + i * S * 0.05]) }
      pts.push([PX + sx * W, H]); block(x, tone, pts, sx < 0 ? 0.26 : 0.12)
      x.save(); poly(x, pts); x.clip(); x.strokeStyle = 'rgba(2,3,6,0.4)'; x.lineWidth = 0.8
      for (let r = 0; r < 9; r++) { const Y = ac + S * 0.6 + r * S * 0.36; x.beginPath(); x.moveTo(PX + sx * R, Y); x.lineTo(PX + sx * W, Y); x.stroke(); for (let k = 0; k < 9; k++) { const X = PX + sx * (R + T + (k + (r % 2) * 0.5) * S * 0.7); x.beginPath(); x.moveTo(X, Y); x.lineTo(X, Y + S * 0.36); x.stroke() } }
      x.restore()
    }
    // the piers
    for (const sx of [-1, 1]) block(x, tone, [[PX + sx * (R - T * 0.65), H], [PX + sx * (R - T * 0.6), ac], [PX + sx * (R + T * 0.6), ac], [PX + sx * (R + T * 0.65), H]], sx < 0 ? 0.42 : 0.2)
    // the two halves of the arch, broken off short of the crown, their ends ragged; voussoirs; chevrons on the face
    const tips = []
    for (const [sx, reach] of [[-1, 1.08], [1, 0.9]]) {
      const a0 = sx < 0 ? Math.PI : 0, a1 = sx < 0 ? Math.PI + reach : -reach, steps = 30
      const at = (a, r) => [PX + Math.cos(a) * r, ac + Math.sin(a) * r]
      const outer = [], inner = []
      for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * i / steps; outer.push(at(a, R + T / 2)); inner.push(at(a, R - T / 2)) }
      const ragged = [at(a1 + (sx < 0 ? -0.05 : 0.05), R + T / 2 - S * 0.1), at(a1 + (sx < 0 ? 0.03 : -0.03), R), at(a1 + (sx < 0 ? -0.02 : 0.04), R - T / 2)]
      const shape = [...outer, ...ragged, ...inner.reverse()]
      block(x, tone, shape, sx < 0 ? 0.4 : 0.24)
      x.save(); poly(x, shape); x.clip()
      x.strokeStyle = 'rgba(2,3,6,0.55)'; x.lineWidth = 1
      for (let a = a0; sx < 0 ? a < a1 : a > a1; a += (a1 - a0) / 9) { const [p, q] = [at(a, R - T / 2), at(a, R + T / 2)]; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke() }
      x.strokeStyle = 'rgba(190,200,235,0.3)'; x.beginPath()
      for (let i = 0, a = a0; i <= 26; i++, a += (a1 - a0) / 26) { const p = at(a, R + (i % 2 ? T * 0.28 : -T * 0.05)); i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]) }
      x.stroke(); x.restore()
      tips.push(at(a1, R + T / 2))
      // ivy hanging from the break
      x.strokeStyle = 'rgba(30,52,44,0.85)'; x.lineWidth = 1
      const [bx, by] = at(a1, R); let px = bx, py = by
      x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 9; k++) { px += (rnd() - 0.5) * 4; py += S * 0.22; x.lineTo(px, py) } x.stroke()
      for (let k = 0; k < 14; k++) { x.fillStyle = `rgba(${30 + rnd() * 20 | 0},${52 + rnd() * 24 | 0},${44 + rnd() * 10 | 0},0.9)`; x.beginPath(); x.arc(bx + (rnd() - 0.5) * 8, by + rnd() * S * 1.8, 1.2 + rnd() * 1.2, 0, Math.PI * 2); x.fill() }
    }
    ground(x, W, H, gnd, tone(0.12))
    for (let k = 0; k < 6; k++) { const X = PX + (rnd() - 0.5) * W * 0.8, Y = gnd(X) + S * 0.2 + rnd() * S * 1.5, w = S * (0.4 + rnd() * 0.3), a = rnd() - 0.5; x.save(); x.translate(X, Y); x.rotate(a); block(x, tone, [[-w / 2, 0], [-w * 0.4, -w * 0.55], [w * 0.4, -w * 0.6], [w / 2, 0]], 0.3); x.restore() }
    grass(x, rnd, H, 380, gnd)
    mist(x, W, H, H * 0.78, H * 0.86, 0.1)
    figures(x, c, [[PX - W * 0.2, H * 0.95], [PX + W * 0.2, H * 0.95]])
    return { tips, tipRGB: GOLD_TIP, box: [0, Math.min(...tips.map(t => t[1])) - 6, W, H], glow: [PX, ac - R] }
  },

  // CLOISTER: two rows of slender columns running away to a broken doorway under the sight, some still carrying their
  // arches, most broken off; flagstones with grass in the joints
  cloister(x, c) {
    const { W, H, PX, S, rnd, tone } = c
    const VY = H * 0.75, near = H * 1.02, D = (k) => 1 / (1 + k * 0.62)
    const yAt = (d) => VY + (near - VY) * d, xAt = (sx, d) => PX + sx * W * 0.5 * d
    // the floor between, flagstones running away
    x.beginPath(); x.moveTo(xAt(-1, 1) - W * 0.2, H); x.lineTo(xAt(-1, D(9)), yAt(D(9))); x.lineTo(xAt(1, D(9)), yAt(D(9))); x.lineTo(xAt(1, 1) + W * 0.2, H); x.closePath()
    const fg = x.createLinearGradient(0, VY, 0, H); fg.addColorStop(0, tone(0.18)); fg.addColorStop(1, tone(0.08)); x.fillStyle = fg; x.fill()
    x.save(); x.clip(); x.strokeStyle = 'rgba(2,3,6,0.45)'; x.lineWidth = 0.8
    for (let k = 0; k < 18; k++) { const d = D(k * 0.5), Y = yAt(d); x.beginPath(); x.moveTo(0, Y); x.lineTo(W, Y); x.stroke() }
    for (let j = -4; j <= 4; j++) { x.beginPath(); x.moveTo(PX + j * W * 0.12, H); x.lineTo(PX + j * W * 0.12 * D(9), yAt(D(9))); x.stroke() }
    x.restore()
    // the doorway at the far end: a gable stub with a small round-headed door, dark
    const dd = D(8.5), dY = yAt(dd), dw = W * 0.5 * dd * 1.1, dh = S * 2.4
    block(x, tone, [[PX - dw, dY], [PX - dw, dY - dh * 0.9], [PX - dw * 0.4, dY - dh * 1.25], [PX + dw * 0.1, dY - dh * 1.05], [PX + dw * 0.6, dY - dh * 1.15], [PX + dw, dY - dh * 0.7], [PX + dw, dY]], 0.28)
    x.fillStyle = '#020306'; x.beginPath(); x.moveTo(PX - dw * 0.3, dY); x.lineTo(PX - dw * 0.3, dY - dh * 0.45); x.arc(PX, dY - dh * 0.45, dw * 0.3, Math.PI, 0); x.lineTo(PX + dw * 0.3, dY); x.closePath(); x.fill()
    // the columns, far ones first; some joined by their arches, most broken
    const tips = [], cols = []
    for (let k = 8; k >= 0; k--) for (const sx of [-1, 1]) {
      const d = D(k), X = xAt(sx, d), Y = yAt(d), full = H * 0.36 * d, keep = [1, 2, 5, 6].includes(k) ? 1 : 0.35 + rnd() * 0.55
      cols.push({ k, sx, d, X, Y, h: full * keep, full, w: Math.max(2, W * 0.045 * d) })
    }
    for (const q of cols) {
      const { X, Y, h, w, sx, d } = q
      block(x, tone, [[X - w * 0.6, Y], [X - w * 0.6, Y - w * 0.5], [X + w * 0.6, Y - w * 0.5], [X + w * 0.6, Y]], 0.3)   // (base)
      const top = Y - h, broken = h < q.full
      block(x, tone, broken ? [[X - w / 2, Y - w * 0.5], [X - w / 2, top + w * 0.15], [X + w * 0.1, top - w * 0.2], [X + w / 2, top + w * 0.3], [X + w / 2, Y - w * 0.5]]
        : [[X - w / 2, Y - w * 0.5], [X - w / 2, top], [X + w / 2, top], [X + w / 2, Y - w * 0.5]], sx < 0 ? 0.4 : 0.22)
      if (!broken) {                                                 // a capital, and the arch to the next column on
        block(x, tone, [[X - w, top], [X - w * 0.7, top - w * 0.6], [X + w * 0.7, top - w * 0.6], [X + w, top]], 0.34)
        const nx = cols.find(o => o.sx === sx && o.k === q.k + 1)
        if (nx && nx.h >= nx.full) {
          const x1 = nx.X, y1 = nx.Y - nx.full - nx.w * 0.6, x0 = X, y0 = top - w * 0.6, mx = (x0 + x1) / 2, rise = Math.abs(x1 - x0) * 0.5
          x.strokeStyle = sx < 0 ? tone(0.36) : tone(0.2); x.lineWidth = Math.max(2, w * 0.7); x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(mx, Math.min(y0, y1) - rise, x1, y1); x.stroke()
          x.strokeStyle = 'rgba(2,3,6,0.5)'; x.lineWidth = 0.8; x.stroke()
        }
        if (q.k === 1) tips.push([X, top - w * 0.6])
      }
    }
    grass(x, rnd, H, 160, (X) => { const d = Math.abs(X - PX) / (W * 0.5); return d < 0.98 ? yAt(Math.max(D(9), d)) : H }, 0, W)
    mist(x, W, H, H * 0.72, H * 0.79, 0.1)
    figures(x, c, [[PX - W * 0.14, H * 0.96], [PX + W * 0.14, H * 0.96]])
    return { tips, tipRGB: GOLD_TIP, box: [PX - W * 0.18, H * 0.6, PX + W * 0.18, H], glow: [PX, dY - dh * 1.4] }
  },

  // STAIR: a broad ruined stair climbing away from us toward the sight, its balustrade broken, its last flight fallen
  // away, a few steps still hanging on in the air beyond the break
  stair(x, c) {
    const { W, H, PX, S, rnd, tone } = c
    const hl = (X) => H * 0.83 + H * 0.04 * Math.sin(X * 0.012 + 1)
    ground(x, W, H, hl, tone(0.11))
    grass(x, rnd, H, 200, hl)
    const yA = (s) => H * 1.0 - H * 0.36 * Math.pow(s, 0.8), wA = (s) => W * 0.46 * (1 - 0.8 * Math.pow(s, 0.65))
    // the arches under the far flight, carrying it
    const s0 = 0.45
    for (let k = 0; k < 3; k++) { const s = s0 + k * 0.12, X = PX, Y = yA(s), w = wA(s); x.fillStyle = tone(0.08); x.fillRect(X - w * 0.95, Y, w * 1.9, H * 0.86 - Y) }
    const N = 18, tips = []
    for (let i = N - 1; i >= 0; i--) {
      const s = i / N, s2 = (i + 1) / N
      if (s > 0.72 && s < 0.8) continue                                  // (the break)
      const lift = s >= 0.8 ? (rnd() - 0.5) * S * 0.25 : 0, tilt = s >= 0.8 ? (rnd() - 0.5) * 0.12 : 0
      if (s >= 0.8 && i % 2) continue                                    // (only some of the far steps left)
      const y0 = yA(s) + lift, y1 = yA(s2) + lift, w0 = wA(s), w1 = wA(s2), rh = (y0 - y1) * 0.55
      x.save(); x.translate(PX, y0); x.rotate(tilt); x.translate(-PX, -y0)
      block(x, tone, [[PX - w1, y1 + rh], [PX - w1, y1], [PX + w1, y1], [PX + w1, y1 + rh]], 0.2)                                     // tread (seen from below: the top, darker)
      block(x, tone, [[PX - w0, y0], [PX - w1, y1 + rh], [PX + w1, y1 + rh], [PX + w0, y0]], 0.42)                                    // riser, lit
      x.strokeStyle = 'rgba(175,185,220,0.22)'; x.beginPath(); x.moveTo(PX - w1, y1 + rh); x.lineTo(PX + w1, y1 + rh); x.stroke()
      x.restore()
      if (s >= 0.8 && !tips.length) tips.push([PX, y1])
    }
    // the balustrade either side: posts, the rail mostly gone
    for (const sx of [-1, 1]) for (let i = 0; i < 13; i++) {
      const s = i / N; if (s > 0.7) break
      const X = PX + sx * wA(s) * 1.02, Y = yA(s), h = S * 1.1 * (1 - 0.75 * s) * (i % 3 ? 1 : 0.4 + rnd() * 0.5), w = Math.max(2, S * 0.28 * (1 - 0.78 * s))
      block(x, tone, [[X - w / 2, Y], [X - w / 2, Y - h], [X + w / 2, Y - h * 0.94], [X + w / 2, Y]], sx < 0 ? 0.4 : 0.2)
    }
    const top = tips[0] || [PX, yA(0.95)]
    figures(x, c, [[PX - W * 0.3, H * 0.95], [PX + W * 0.3, H * 0.95]])
    return { tips, tipRGB: GOLD_TIP, box: [PX - W * 0.47, top[1] - 6, PX + W * 0.47, H], glow: [top[0], top[1] - S * 0.6] }
  },

  // ELVEN GATE: on a curved terrace of pale stone, a gate of two great blades sweeping up and in, their points almost
  // meeting under the sight, light in their seams; a slender city of spires far off on the mountains
  elf_gate(x, c) {
    const { W, H, PX, S, rnd } = c
    spires(x, c, 9)
    const terr = (X) => H * 0.8 + H * 0.07 * Math.pow((X - PX) / (W * 0.55), 2)
    ground(x, W, H, terr, BONE(0.16))
    x.save(); x.beginPath(); x.moveTo(-2, H + 2); for (let i = 0; i <= 64; i++) { const X = -2 + (W + 4) * i / 64; x.lineTo(X, terr(X)) } x.lineTo(W + 2, H + 2); x.closePath(); x.clip()
    x.strokeStyle = 'rgba(200,205,235,0.12)'; x.lineWidth = 1
    for (let k = 1; k < 7; k++) { x.beginPath(); x.ellipse(PX, H * 0.8 + k * k * H * 0.008, W * (0.2 + k * 0.16), H * (0.012 + k * 0.012), 0, 0, Math.PI); x.stroke() }    // (the terrace's inlaid rings)
    x.restore()
    const tips = []
    for (const sx of [-1, 1]) {
      const B = [PX + sx * S * 2.7, H * 0.805]
      // a lesser fin inside each blade
      band(x, bez([B[0] - sx * S * 0.3, B[1] - S * 0.2], [B[0] + sx * S * 0.9, B[1] - S * 1.6], [B[0] - sx * S * 0.2, B[1] - S * 3.0], [PX + sx * S * 1.2, B[1] - S * 3.1]), (u) => S * 0.32 * Math.pow(1 - u, 0.9) + 1, BONE, { seam: 0.35 })
      const P = bez(B, [B[0] + sx * S * 1.6, B[1] - S * 2.6], [B[0] + sx * S * 0.2, B[1] - S * 6.2], [PX + sx * S * 0.38, H * 0.535])
      const pts = band(x, P, (u) => S * 0.95 * Math.pow(1 - u, 1.1) * (1 + 0.35 * Math.sin(u * Math.PI)) + 1, BONE, { n: 60, seam: 0.6 })
      tips.push(pts[pts.length - 1])
      const gp = pts[22], gg = x.createRadialGradient(gp[0], gp[1], 0, gp[0], gp[1], S * 0.4)                                     // a gem in the blade
      gg.addColorStop(0, SEAM(0.9)); gg.addColorStop(1, SEAM(0)); x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = gg; x.beginPath(); x.arc(gp[0], gp[1], S * 0.4, 0, Math.PI * 2); x.fill(); x.restore()
    }
    // the balustrade near us: a flowing rail on slender balusters
    rail(x, c, (X) => H * 0.93 + H * 0.05 * Math.pow((X - PX) / (W * 0.5), 2))
    figures(x, c, [[PX - W * 0.13, H * 0.88], [PX + W * 0.13, H * 0.88]])
    return { tips, tipRGB: SEAM_TIP, box: [PX - S * 4.5, H * 0.56, PX + S * 4.5, H], glow: [PX, H * 0.52] }
  },

  // ELVEN PROW: we stand on the deck of a white ship running over the sea; its prow sweeps up ahead of us into a crescent
  // under the sight, and two sail-vanes rise either side, curving in
  elf_prow(x, c) {
    const { W, H, PX, S, rnd } = c
    // the sea instead of the near hills: dark water to the far shore, the moon's light broken on it
    const sea = H * 0.765, sg = x.createLinearGradient(0, sea, 0, H); sg.addColorStop(0, '#16203a'); sg.addColorStop(1, '#050812')
    x.fillStyle = sg; x.fillRect(0, sea, W, H - sea)
    for (let k = 0; k < 160; k++) { const Y = sea + Math.pow(rnd(), 1.6) * (H - sea), u = (Y - sea) / (H - sea), X = rnd() * W, l = 3 + u * 22; x.strokeStyle = `rgba(170,185,230,${(0.08 + 0.18 * (1 - u)).toFixed(2)})`; x.lineWidth = 0.6 + u; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + l, Y); x.stroke() }
    // the deck, running away to the prow
    const tip = [PX, H * 0.775], deck = [[-W * 0.08, H + 2], [PX - S * 0.35, tip[1]], [PX + S * 0.35, tip[1]], [W * 1.08, H + 2]]
    poly(x, deck); const dg = x.createLinearGradient(0, tip[1], 0, H); dg.addColorStop(0, BONE(0.3)); dg.addColorStop(1, BONE(0.12)); x.fillStyle = dg; x.fill()
    x.save(); poly(x, deck); x.clip(); x.strokeStyle = 'rgba(10,12,22,0.35)'; x.lineWidth = 0.8
    for (let j = -7; j <= 7; j++) { x.beginPath(); x.moveTo(PX + j * W * 0.08, H); x.lineTo(PX + j * S * 0.04, tip[1]); x.stroke() }
    x.restore()
    for (const sx of [-1, 1]) band(x, bez([PX + sx * W * 0.62, H + 4], [PX + sx * W * 0.4, H * 0.86], [PX + sx * S * 1.2, H * 0.77], [PX + sx * S * 0.2, tip[1] - 2]), (u) => S * 0.9 * (1 - u) + 2, BONE, { n: 40, seam: 0.4 })   // (the gunwales)
    // the prow: up from the deck's point in a swan's neck, curling forward into a crescent
    const tips = []
    const neck = band(x, bez([PX, tip[1] + 2], [PX - S * 0.15, tip[1] - S * 1.2], [PX + S * 0.8, tip[1] - S * 1.9], [PX + S * 0.2, tip[1] - S * 2.4]), (u) => S * 0.55 * (1 - u * 0.6), BONE, { n: 40, seam: 0.5 })
    const top = neck[neck.length - 1]
    for (const sx of [-1, 1]) { const pts = band(x, bez(top, [top[0] + sx * S * 0.6, top[1] - S * 0.05], [top[0] + sx * S * 0.85, top[1] - S * 0.7], [top[0] + sx * S * 0.45, top[1] - S * 1.0]), (u) => S * 0.3 * (1 - u) + 1, BONE, { n: 24, seam: 0.5 }); tips.push(pts[pts.length - 1]) }
    // the sail-vanes, out from the deck and up, curving in
    for (const sx of [-1, 1]) {
      const B = [PX + sx * S * 2.2, H * 0.84]
      const pts = band(x, bez(B, [B[0] + sx * S * 1.6, B[1] - S * 3.0], [B[0] + sx * S * 0.6, B[1] - S * 6.6], [PX + sx * S * 1.35, H * 0.5]), (u) => S * 1.25 * Math.pow(1 - u, 1.2) * (0.6 + 0.6 * Math.sin(u * Math.PI)) + 1, BONE, { n: 56, seam: 0.45 })
      tips.push(pts[pts.length - 1])
    }
    figures(x, c, [[PX - W * 0.2, H * 0.93], [PX + W * 0.2, H * 0.93]])
    return { tips, tipRGB: SEAM_TIP, box: [PX - S * 4.2, H * 0.52, PX + S * 4.2, H], glow: [PX, top[1] - S * 1.2] }
  },

  // ELVEN SPIRES: a crescent balcony high on an elven tower; two slender spires rise either side of us, their crowns
  // turned in like blades toward the sight; the city's spires far below and away on the mountains
  elf_spires(x, c) {
    const { W, H, PX, S, rnd } = c
    spires(x, c, 16)
    const tips = []
    for (const sx of [-1, 1]) {
      const X = PX + sx * W * 0.36, top = H * 0.6
      // the shaft, tapering a little as it rises, ringed now and then
      const sh = [[X - S * 0.42, H + 2], [X - S * 0.22, top + S * 1.2], [X + S * 0.22, top + S * 1.2], [X + S * 0.42, H + 2]]
      poly(x, sh); const gr = x.createLinearGradient(X - S * 0.42, 0, X + S * 0.42, 0); gr.addColorStop(0, BONE(sx < 0 ? 0.5 : 0.36)); gr.addColorStop(0.5, BONE(0.22)); gr.addColorStop(1, BONE(0.08)); x.fillStyle = gr; x.fill()
      x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = SEAM(0.35); x.lineWidth = 1; x.beginPath(); x.moveTo(X, H); x.lineTo(X, top + S * 1.3); x.stroke(); x.restore()
      for (const v of [0.25, 0.5, 0.7]) { const Y = top + S * 1.2 + (H - top) * v, w = S * (0.25 + 0.2 * v) + 3; x.fillStyle = BONE(0.3); x.fillRect(X - w, Y, w * 2, 2.5) }
      // its crown: a blade from the shaft's top sweeping out, then in and up toward the sight
      const P = bez([X, top + S * 1.3], [X + sx * S * 0.8, top + S * 0.1], [X - sx * S * 0.2, top - S * 1.2], [PX + sx * S * 1.4, top - S * 1.3])
      const pts = band(x, P, (u) => S * 0.6 * Math.pow(1 - u, 1.0) * (1 + 0.5 * Math.sin(u * Math.PI)) + 1, BONE, { n: 50, seam: 0.55 })
      tips.push(pts[pts.length - 1])
      band(x, bez([X, top + S * 1.3], [X - sx * S * 0.5, top + S * 0.5], [X - sx * S * 0.1, top - S * 0.6], [X + sx * S * 0.15, top - S * 1.1]), (u) => S * 0.22 * (1 - u) + 1, BONE, { n: 20, seam: 0.4 })
    }
    // the balcony: a curved floor and a flowing rail
    const fl = (X) => H * 0.86 + H * 0.06 * Math.pow((X - PX) / (W * 0.5), 2)
    ground(x, W, H, fl, BONE(0.14))
    rail(x, c, (X) => H * 0.85 + H * 0.06 * Math.pow((X - PX) / (W * 0.5), 2), true)
    figures(x, c, [[PX - W * 0.16, H * 0.95], [PX + W * 0.16, H * 0.95]])
    return { tips, tipRGB: SEAM_TIP, box: [0, H * 0.56, W, H], glow: [PX, H * 0.52] }
  },
}

// a city of slender spires, far off along the mountains, a light at each top
function spires(x, c, n) {
  const { W, H, rnd } = c
  for (let k = 0; k < n; k++) {
    const X = W * (0.04 + 0.92 * rnd()), base = H * 0.77, h = H * (0.03 + rnd() * 0.07), w = 1.5 + rnd() * 2
    x.fillStyle = `rgba(150,160,200,${(0.25 + rnd() * 0.2).toFixed(2)})`
    x.beginPath(); x.moveTo(X - w, base); x.lineTo(X - w * 0.3, base - h); x.quadraticCurveTo(X + w * 1.5, base - h - 5, X + w * 0.6, base - h - 9); x.lineTo(X + w * 0.3, base - h); x.lineTo(X + w, base); x.closePath(); x.fill()
    x.fillStyle = SEAM(0.7); x.fillRect(X + w * 0.5, base - h - 9, 1.4, 1.4)
  }
}
// a balustrade in the elves' manner: a rail curving with the floor, slender waisted balusters
function rail(x, c, at, high) {
  const { W, H, S } = c, rh = S * (high ? 0.75 : 0.55)
  for (let X = -4; X <= W + 4; X += S * 0.42) {
    const Y = at(X), b = 2 + Math.abs(X - c.PX) / W * 2.5
    x.fillStyle = BONE(0.3); x.beginPath(); x.moveTo(X - b, Y); x.quadraticCurveTo(X - b * 0.2, Y - rh / 2, X - b, Y - rh); x.lineTo(X + b, Y - rh); x.quadraticCurveTo(X + b * 0.2, Y - rh / 2, X + b, Y); x.closePath(); x.fill()
  }
  x.strokeStyle = BONE(0.45); x.lineWidth = 3.5; x.beginPath()
  for (let i = 0; i <= 48; i++) { const X = -4 + (W + 8) * i / 48, Y = at(X) - rh; i ? x.lineTo(X, Y) : x.moveTo(X, Y) } x.stroke()
  x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = SEAM(0.3); x.lineWidth = 1; x.stroke(); x.restore()
}

// ── the courts: a ring of stones round us like a cloister, open to the sky; across it, the two stones either side of the
// far gap stand twice as tall as the rest, leaning in a little, the sight between and above them, as a henge is laid out
// on a star's rising; sometimes a mound beyond. One plan, many manners: from gothic to the old Irish, the elves' and the
// dwarfs', and the conjurers'. Each manner gives its post, its arch (or none), its floor, and a mound if it has one
const RUNE = (a) => `rgba(255,140,60,${a})`, ARC = (a) => `rgba(175,145,255,${a})`
function glowDot(x, X, Y, r, col) { const g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, col(0.9)); g.addColorStop(1, col(0)); x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); x.fill(); x.restore() }
function runes(x, rnd, X, Y, w, h, col, n = 3) {               // a few glowing marks down a stone
  x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = col(0.75); x.shadowColor = col(0.9); x.shadowBlur = 4; x.lineWidth = Math.max(0.8, w * 0.06)
  for (let k = 0; k < n; k++) { const cx = X + (rnd() - 0.5) * w * 0.3, cy = Y - h * (0.3 + 0.5 * k / n), s = w * 0.16; x.beginPath(); x.moveTo(cx, cy - s); x.lineTo(cx, cy + s); x.moveTo(cx, cy - s * 0.3); x.lineTo(cx + (rnd() < 0.5 ? s : -s) * 0.8, cy - s * (rnd() < 0.5 ? 1 : -0.2)); x.stroke() }
  x.restore()
}
function court(x, c, st) {
  const { W, H, PX, S, rnd, tone } = c
  const cy = H * 0.865, rx = W * 0.52, ry = H * 0.1, N = 16
  if (st.mound) st.mound(x, c)
  const floorTop = (X) => { const u = (X - PX) / rx; return Math.abs(u) < 1 ? cy - ry * Math.sqrt(1 - u * u) : cy }
  ground(x, W, H, floorTop, st.floor ? st.floor(0.16) : tone(0.14))
  st.floorDeco?.(x, c, { cy, rx, ry, floorTop })
  // the posts round the ring (the far middle left open for the astrolabe), the arches between them, the astrolabe: all
  // drawn far to near
  const posts = {}, items = []
  for (let i = 0; i < N; i++) {
    const th = Math.PI / 2 + Math.PI / N + i * 2 * Math.PI / N, cs = Math.cos(th), sn = Math.sin(th)
    if (sn < -0.2 && Math.abs(cs) < 0.75) continue
    const sight = i === 0 || i === N - 1                                // (the two either side of the far gap)
    const sc = 0.5 + 1.7 * Math.pow((1 - sn) / 2, 1.5), ah = S * st.hk * sc * (0.94 + rnd() * 0.12), p = { i, X: PX + rx * cs, Y: cy - ry * sn, sc, ah, h: sight ? ah * 2.1 : ah, w: S * st.wk * sc * (sight ? 1.15 : 1), left: cs < 0, sight }
    if (sight) p.lean = (cs < 0 ? 1 : -1) * p.w * 0.35
    posts[i] = p; items.push({ d: p.Y, draw: () => st.post(x, c, p) })
  }
  if (st.arch) for (let i = 0; i < N; i++) {
    const a = posts[i], b = posts[(i + 1) % N]
    if (a && b && !(i === N - 1)) items.push({ d: Math.max(a.Y, b.Y) + 0.5, draw: () => st.arch(x, c, a, b) })
  }
  const base = [PX, cy - ry * 0.45]
  if (st.centre) items.push({ d: base[1], draw: () => st.centre(x, c, base) })
  items.sort((p, q) => p.d - q.d).forEach(it => it.draw())
  const sp = [posts[0], posts[N - 1]], tips = sp.map(p => [p.X + (p.lean || 0) * 1.2, p.Y - p.h])
  grass(x, rnd, H, st.grass ?? 200, (X) => Math.max(floorTop(X), H * 0.8))
  mist(x, W, H, H * 0.74, H * 0.8, 0.1)
  figures(x, c, [[PX - W * 0.2, H * 0.97], [PX + W * 0.2, H * 0.97]])
  return { tips, tipRGB: st.tipRGB || GOLD_TIP, box: [0, Math.min(H * 0.62, ...tips.map(t => t[1] - 6)), W, H], glow: [PX, (tips[0][1] + tips[1][1]) / 2 - S * 0.5] }
}
// posts
const P_SLAB = (x, c, p) => slab(x, c.rnd, c.tone, p.X, p.Y, p.w, p.h, { k: p.left ? 0.44 : 0.26, ...(p.lean ? { lean: p.lean } : {}) })
function P_COLUMN(x, c, p, { pinnacle = false, cushion = false } = {}) {
  const { X, Y, w, h } = p, t = c.tone
  block(x, t, [[X - w * 0.75, Y], [X - w * 0.75, Y - w * 0.5], [X + w * 0.75, Y - w * 0.5], [X + w * 0.75, Y]], p.left ? 0.36 : 0.2)
  block(x, t, [[X - w / 2, Y - w * 0.5], [X - w / 2, Y - h + w * 0.6], [X + w / 2, Y - h + w * 0.6], [X + w / 2, Y - w * 0.5]], p.left ? 0.42 : 0.22)
  x.strokeStyle = 'rgba(2,3,6,0.45)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(X - w * 0.18, Y - w * 0.5); x.lineTo(X - w * 0.18, Y - h + w * 0.6); x.moveTo(X + w * 0.18, Y - w * 0.5); x.lineTo(X + w * 0.18, Y - h + w * 0.6); x.stroke()
  if (cushion) { x.beginPath(); x.moveTo(X - w * 0.8, Y - h); x.lineTo(X + w * 0.8, Y - h); x.quadraticCurveTo(X + w * 0.7, Y - h + w * 0.7, X, Y - h + w * 0.7); x.quadraticCurveTo(X - w * 0.7, Y - h + w * 0.7, X - w * 0.8, Y - h); x.fillStyle = t(p.left ? 0.38 : 0.2); x.fill(); x.strokeStyle = 'rgba(2,3,6,0.5)'; x.stroke() }
  else block(x, t, [[X - w * 0.8, Y - h + w * 0.6], [X - w * 0.7, Y - h], [X + w * 0.7, Y - h], [X + w * 0.8, Y - h + w * 0.6]], p.left ? 0.38 : 0.2)
  if (pinnacle) block(x, t, [[X - w * 0.3, Y - h], [X, Y - h - w * 2.2], [X + w * 0.3, Y - h]], p.left ? 0.4 : 0.22)
}
// arches
const tops = (a, b) => [[a.X, a.Y - a.ah], [b.X, b.Y - b.ah]]          // (the arcade springs at the common height, the sighting stones rising on above it)
function A_LINTEL(x, c, a, b) {
  const [[x0, y0], [x1, y1]] = tops(a, b), t = c.S * 0.34 * (a.sc + b.sc) / 2, o = (x1 - x0) * 0.08
  block(x, c.tone, [[x0 - o, y0 + 2], [x0 - o, y0 - t], [x1 + o, y1 - t], [x1 + o, y1 + 2]], a.left ? 0.38 : 0.2)
  x.strokeStyle = 'rgba(175,185,220,0.2)'; x.lineWidth = 1; x.beginPath(); x.moveTo(x0 - o, y0 - t); x.lineTo(x1 + o, y1 - t); x.stroke()
}
function curveArch(x, c, a, b, apex, { chevron = false, col, lw } = {}) {
  const [[x0, y0], [x1, y1]] = tops(a, b), w = lw ?? c.S * 0.3 * (a.sc + b.sc) / 2, mx = (x0 + x1) / 2, span = Math.hypot(x1 - x0, y1 - y0)
  x.strokeStyle = col || c.tone(a.left ? 0.36 : 0.2); x.lineWidth = w; x.lineCap = 'butt'
  x.beginPath(); x.moveTo(x0, y0); apex(x, x0, y0, x1, y1, mx, span); x.stroke()
  x.strokeStyle = 'rgba(2,3,6,0.4)'; x.lineWidth = 0.8; x.stroke()
  if (chevron) { x.save(); x.setLineDash([2, 3]); x.strokeStyle = 'rgba(200,210,240,0.35)'; x.lineWidth = w * 0.4; x.beginPath(); x.moveTo(x0, y0); apex(x, x0, y0, x1, y1, mx, span); x.stroke(); x.restore() }
}
const ROUND = (x, x0, y0, x1, y1, mx, span) => x.quadraticCurveTo(mx, Math.min(y0, y1) - span * 0.75, x1, y1)
const POINTED = (x, x0, y0, x1, y1, mx, span) => { const ay = Math.min(y0, y1) - span * 0.95; x.quadraticCurveTo(x0, ay + span * 0.35, mx, ay); x.quadraticCurveTo(x1, ay + span * 0.35, x1, y1) }
const OGEE = (x, x0, y0, x1, y1, mx, span) => { const ay = Math.min(y0, y1) - span * 1.5; x.bezierCurveTo(x0, y0 - span * 0.7, mx - span * 0.05, ay + span * 0.6, mx, ay); x.bezierCurveTo(mx + span * 0.05, ay + span * 0.6, x1, y1 - span * 0.7, x1, y1) }

const MANNERS = {
  // GOTHIC: an arcade of pointed arches on clustered columns, pinnacles; flagstones
  gothic: {
    hk: 2.5, wk: 0.32, post: (x, c, p) => P_COLUMN(x, c, p, { pinnacle: true }),
    arch: (x, c, a, b) => {
      curveArch(x, c, a, b, POINTED)
      const [[x0, y0], [x1, y1]] = tops(a, b), span = Math.hypot(x1 - x0, y1 - y0)
      if (span > 14) { x.strokeStyle = 'rgba(160,170,205,0.3)'; x.lineWidth = 1; x.beginPath(); x.arc((x0 + x1) / 2, Math.min(y0, y1) - span * 0.38, span * 0.16, 0, Math.PI * 2); x.stroke() }
    },
    floorDeco: flagstones,
  },
  // ROMANESQUE: round arches with chevrons on squat columns with cushion capitals, as on the old Irish church doors
  romanesque: {
    hk: 1.9, wk: 0.42, post: (x, c, p) => P_COLUMN(x, c, p, { cushion: true }),
    arch: (x, c, a, b) => curveArch(x, c, a, b, ROUND, { chevron: true }),
    floorDeco: flagstones,
  },
  // MEGALITHIC: a ring of trilithons, lintels running round from stone to stone; a grassy mound beyond
  megalith: {
    hk: 2.1, wk: 0.62, post: P_SLAB, arch: A_LINTEL, mound: (x, c) => mound(x, c, false), grass: 320,
  },
  // BRÚ: the Great Circle of standing stones round a passage mound, its face white with quartz, the dark doorway and the
  // roof-box over it; the kerbstones spiralled
  bru: {
    hk: 2.0, wk: 0.6, post: P_SLAB, mound: (x, c) => mound(x, c, true), grass: 320,
  },
  // HIGH ELVES (after the Warhammer old world): a ring of slender white columns under tall ogee arches, gold at their
  // points; a pale floor inlaid with rings
  high_elf: {
    hk: 3.0, wk: 0.22, floor: (k) => BONE(k * 0.55), tipRGB: SEAM_TIP,
    post: (x, c, p) => {
      const { X, Y, w, h } = p
      band(x, bez([X, Y], [X - w * 0.1, Y - h * 0.4], [X + w * 0.1 + (p.lean || 0) * 0.5, Y - h * 0.7], [X + (p.lean || 0) * 1.2, Y - h]), (u) => w * (1.1 - 0.4 * Math.sin(u * Math.PI)), BONE, { n: 16, seam: 0.3 })
      glowDot(x, X + (p.lean || 0) * 1.2, Y - h, w * 0.9, (a) => `rgba(240,210,130,${a})`)
    },
    arch: (x, c, a, b) => curveArch(x, c, a, b, OGEE, { col: BONE(a.left ? 0.42 : 0.28), lw: c.S * 0.16 * (a.sc + b.sc) / 2 }),
    floorDeco: (x, c, g) => { x.save(); x.strokeStyle = 'rgba(220,215,240,0.18)'; for (let k = 1; k < 5; k++) { x.beginPath(); x.ellipse(c.PX, g.cy, g.rx * k / 5, g.ry * k / 5, 0, 0, Math.PI * 2); x.stroke() } x.restore() },
  },
  // DWARFS (after the Warhammer old world): squat square piers under flat lintels on stepped corbels, runes smouldering
  // in them
  dwarf: {
    hk: 1.5, wk: 0.8, tipRGB: '255,190,120',
    post: (x, c, p) => {
      const { X, Y, w, h } = p
      block(x, c.tone, [[X - w / 2, Y], [X - w / 2, Y - h * 0.85], [X - w * 0.35, Y - h], [X + w * 0.35, Y - h], [X + w / 2, Y - h * 0.85], [X + w / 2, Y]], p.left ? 0.36 : 0.18)
      runes(x, c.rnd, X, Y, w, h, RUNE, 2)
    },
    arch: (x, c, a, b) => {
      const [[x0, y0], [x1, y1]] = tops(a, b), t = c.S * 0.42 * (a.sc + b.sc) / 2, st = (x1 - x0) * 0.12
      block(x, c.tone, [[x0, y0], [x0 + st, y0 + t * 0.5], [x1 - st, y1 + t * 0.5], [x1, y1], [x1 + st * 0.3, y1 - t], [x0 - st * 0.3, y0 - t]], a.left ? 0.34 : 0.18)
      if (Math.abs(x1 - x0) > 20) runes(x, c.rnd, (x0 + x1) / 2, Math.min(y0, y1) + t * 0.3, t * 1.6, t * 1.4, RUNE, 1)
    },
    floorDeco: flagstones,
  },
  // CONJURERS (after Dungeons & Dragons): the ring's stones and lintels float a little off the ground, runes alight in
  // them; a circle of power traced in light on the floor
  arcane: {
    hk: 1.9, wk: 0.55, tipRGB: '200,180,255',
    post: (x, c, p) => {
      const lift = p.h * 0.14
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.ellipse(p.X, p.Y, p.w * 0.6, p.w * 0.12, 0, 0, Math.PI * 2); x.fill()
      slab(x, c.rnd, c.tone, p.X, p.Y - lift, p.w, p.h - lift, { k: p.left ? 0.44 : 0.26, ...(p.lean ? { lean: p.lean } : {}) }); runes(x, c.rnd, p.X, p.Y - lift, p.w, p.h - lift, ARC, 3)
    },
    arch: (x, c, a, b) => { x.save(); x.translate(0, -c.S * 0.25 * (a.sc + b.sc) / 2); A_LINTEL(x, c, a, b); x.restore() },
    floorDeco: (x, c, g) => {
      x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = ARC(0.4); x.shadowColor = ARC(0.8); x.shadowBlur = 6; x.lineWidth = 1.2
      const ox = c.PX, oy = g.cy - g.ry * 0.2
      for (const k of [0.42, 0.52]) { x.beginPath(); x.ellipse(ox, oy, g.rx * k, g.ry * k, 0, 0, Math.PI * 2); x.stroke() }
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); x.beginPath(); x.moveTo(ox + ca * g.rx * 0.42, oy + sa * g.ry * 0.42); x.lineTo(ox + ca * g.rx * 0.52, oy + sa * g.ry * 0.52); x.stroke()
        const mx = ox + ca * g.rx * 0.47, my = oy + sa * g.ry * 0.47; x.beginPath(); x.arc(mx, my, 1.4, 0, Math.PI * 2); x.stroke() }
      x.restore()
    },
  },
  // MOONWELL (after Dungeons & Dragons): a ring of rough trilithons hung with ivy; at the heart a round pool holding the
  // stars
  moonwell: {
    hk: 2.1, wk: 0.6, post: P_SLAB, grass: 380,
    arch: (x, c, a, b) => { A_LINTEL(x, c, a, b); ivy(x, c, a, b) },
    centre: (x, c, [X, Y]) => {
      const { S, tone, rnd } = c, py = Y + S * 0.2
      x.beginPath(); x.ellipse(X, py, S * 2.4, S * 0.42, 0, 0, Math.PI * 2); x.fillStyle = '#050a1c'; x.fill(); x.strokeStyle = tone(0.3); x.lineWidth = 3; x.stroke()
      x.save(); x.clip(); for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(230,235,255,${(0.3 + rnd() * 0.6).toFixed(2)})`; x.fillRect(X + (rnd() - 0.5) * S * 4.6, py + (rnd() - 0.5) * S * 0.8, 1.2, 1.2) } x.restore()
      glowDot(x, X, py, S * 1.2, (a) => `rgba(170,190,255,${a * 0.5})`)
    },
  },
}
function flagstones(x, c, g) {
  x.save(); x.beginPath(); x.ellipse(c.PX, g.cy, g.rx, g.ry, 0, 0, Math.PI * 2); x.rect(0, g.cy, c.W, c.H); x.clip()
  x.strokeStyle = 'rgba(2,3,6,0.35)'; x.lineWidth = 0.8
  for (let k = 1; k < 6; k++) { x.beginPath(); x.ellipse(c.PX, g.cy, g.rx * k / 5.5, g.ry * k / 5.5, 0, 0, Math.PI * 2); x.stroke() }
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; x.beginPath(); x.moveTo(c.PX + Math.cos(a) * g.rx * 0.18, g.cy + Math.sin(a) * g.ry * 0.18); x.lineTo(c.PX + Math.cos(a) * g.rx * 2, g.cy + Math.sin(a) * g.ry * 2); x.stroke() }
  x.restore()
}
function spiral(x, X, Y, r, turns = 2.5) {
  x.strokeStyle = 'rgba(2,3,6,0.6)'; x.lineWidth = Math.max(1, r * 0.14); x.beginPath()
  for (let k = 0; k <= 60; k++) { const u = k / 60, a = u * turns * Math.PI * 2, rr = r * u; k ? x.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr) : x.moveTo(X, Y) } x.stroke()
}
function mound(x, c, bru) {                                   // a grassy mound beyond the ring; Brú's with its white face
  const { W, H, PX, S, rnd, tone } = c, base = H * 0.77, top = base - S * (bru ? 2.4 : 2.0), hw = W * 0.5
  x.beginPath(); x.moveTo(PX - hw, base); x.bezierCurveTo(PX - hw * 0.7, top, PX + hw * 0.7, top, PX + hw, base); x.closePath()
  const g = x.createLinearGradient(PX - hw, 0, PX + hw, 0); g.addColorStop(0, tone(0.24)); g.addColorStop(1, tone(0.08)); x.fillStyle = g; x.fill()
  if (!bru) return
  const fy = (X) => { const u = (X - PX) / hw; return base - (base - top) * 0.62 * (1 - u * u) }
  x.beginPath(); x.moveTo(PX - hw * 0.62, base); for (let i = 0; i <= 30; i++) { const X = PX - hw * 0.62 + hw * 1.24 * i / 30; x.lineTo(X, fy(X)) } x.lineTo(PX + hw * 0.62, base); x.closePath()
  x.fillStyle = 'rgb(118,124,150)'; x.fill()                                                                    // (the quartz face)
  x.save(); x.clip(); for (let k = 0; k < 90; k++) { x.fillStyle = rnd() < 0.5 ? 'rgba(220,225,245,0.35)' : 'rgba(30,34,50,0.35)'; x.fillRect(PX + (rnd() - 0.5) * hw * 1.3, base - rnd() * S * 1.6, 2, 2) } x.restore()
  x.fillStyle = '#020306'; x.fillRect(PX - S * 0.22, base - S * 0.75, S * 0.44, S * 0.75); x.fillRect(PX - S * 0.18, base - S * 1.05, S * 0.36, S * 0.16)   // (the door, the roof-box)
  for (let k = -7; k <= 7; k++) { if (!k) continue; const X = PX + k * hw * 0.1, w = hw * 0.09; block(x, tone, [[X - w / 2, base + 2], [X - w / 2, base - S * 0.35], [X + w / 2, base - S * 0.38], [X + w / 2, base + 2]], 0.32); if (k % 3 === 0) spiral(x, X, base - S * 0.17, S * 0.13, 2) }
}
function ivy(x, c, a, b) {
  const [[x0, y0], [x1, y1]] = tops(a, b), { rnd, S } = c, n = 3 + rnd() * 5 | 0
  for (let k = 0; k < n; k++) { const u = rnd(), X = x0 + (x1 - x0) * u, Y = y0 + (y1 - y0) * u, l = S * (0.3 + rnd() * 1.0) * a.sc; x.strokeStyle = 'rgba(30,54,44,0.85)'; x.lineWidth = 1; x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + (rnd() - 0.5) * 6, Y + l / 2, X + (rnd() - 0.5) * 4, Y + l); x.stroke(); x.fillStyle = 'rgba(36,66,50,0.9)'; for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(X + (rnd() - 0.5) * 5, Y + rnd() * l, 1 + rnd(), 0, Math.PI * 2); x.fill() } }
}
for (const [k, st] of Object.entries(MANNERS)) LANDS['court_' + k] = (x, c) => court(x, c, st)
