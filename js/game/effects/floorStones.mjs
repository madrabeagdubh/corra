// floorStones.mjs
// Location: js/game/effects/floorStones.mjs
//
// The stones of the hand-laid floor (hewnExtras.js paintFloorArt), as geometry: which stone lies under a point, and its
// outline -- a piece of a ring round the dais, between two radial joints. Pure (no canvas), so the map generator can use
// it to choose stones to raise, and the renderer to draw them. A stone is { n, j }: course n out from the dais, stone j
// in it. Its corners are ptAt(A, g, t): g how far out (the ellipses (rx + g, ry + g)), t the angle round.

export const h2 = (a, b = 0) => { let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296 }
export const WIDS = [1.0, 0.9, 1.1, 1.0, 0.94, 1.06, 1.0, 1.1, 0.9, 1.0]

// A = hewn.floorArt { cx, cy, rx, ry, g0 }: the courses -- E the offsets where each begins, and for each its width, how many stones go round it and where the first begins
export function courses(A) {
  const { rx, ry, g0 } = A
  const E = [0]; while (E[E.length - 1] < 34) E.push(E[E.length - 1] + WIDS[(E.length - 1) % WIDS.length])
  const info = E.slice(0, -1).map((e0, n) => {
    const w = E[n + 1] - e0, gm = g0 + e0 + w / 2, a = rx + gm, c = ry + gm, per = Math.PI * (3 * (a + c) - Math.sqrt((3 * a + c) * (a + 3 * c)))
    const m = Math.max(6, Math.round(per / (w * 1.3))), I = { e0, w, m, len: per / m, off: h2(n, 5) }
    if (A.spokes && A.spokes.length) {                     // spokes: every course has a joint on each of these angles, the stones between shared out evenly
      const S = [...A.spokes].sort((a, b) => a - b), TAU = 2 * Math.PI
      let j0 = 0; I.sec = S.map((a0, i) => { const da = (i + 1 < S.length ? S[i + 1] : S[0] + TAU) - a0, ms = Math.max(1, Math.round(per * da / TAU / (w * 1.3))), sec = { a0, da, m: ms, j0, len: per * da / TAU / ms }; j0 += ms; return sec })
      I.m = j0
    }
    return I
  })
  return { E, info }
}
// which stone of a course an angle t falls in, and how far across it (fu, 0..1); and a stone's angles
export function stoneU(I, t) {
  if (!I.sec) { const u = ((t + Math.PI) / (2 * Math.PI) + I.off) * I.m, j = Math.floor(u); return { j: ((j % I.m) + I.m) % I.m, fu: u - j, len: I.len } }
  const TAU = 2 * Math.PI
  for (const S of I.sec) { let d = t - S.a0; d -= Math.floor(d / TAU) * TAU; if (d < S.da) { const u = d / S.da * S.m, j = Math.min(S.m - 1, Math.floor(u)); return { j: S.j0 + j, fu: u - j, len: S.len } } }
  const S = I.sec[0]; return { j: 0, fu: 0, len: S.len }
}
export function stoneSpan(I, j) {
  if (!I.sec) return [(j / I.m - I.off) * 2 * Math.PI - Math.PI, ((j + 1) / I.m - I.off) * 2 * Math.PI - Math.PI]
  const S = I.sec.find(q => j >= q.j0 && j < q.j0 + q.m) || I.sec[0], t0 = S.a0 + (j - S.j0) / S.m * S.da
  return [t0, t0 + S.da / S.m]
}

export const ptAt = (A, g, t) => ({ x: A.cx + (A.rx + g) * Math.cos(t), y: A.cy + (A.ry + g) * Math.sin(t) })

// the stone under a point (null inside the dais's own steps)
export function cellAt(A, x, y, co = courses(A)) {
  const dx = x - A.cx, dy = y - A.cy
  let g = Math.max(0, Math.hypot(dx, dy) - (A.rx + A.ry) / 2)
  for (let it = 0; it < 12; it++) { const a = A.rx + g, c = A.ry + g, f = dx * dx / (a * a) + dy * dy / (c * c) - 1; g += f / (2 * (dx * dx / (a * a * a) + dy * dy / (c * c * c)) + 1e-9) }
  const q = g - A.g0
  if (q < 0) return null
  let n = 0; while (n < co.info.length - 1 && co.E[n + 1] <= q) n++
  const I = co.info[n], t = Math.atan2(dy / (A.ry + g), dx / (A.rx + g))
  return { n, j: stoneU(I, t).j }
}

// a stone's extent: g from ga to gb, the angle from t0 to t1
export function cellGeom(A, n, j, co = courses(A)) {
  const I = co.info[n], ga = A.g0 + I.e0, [t0, t1] = stoneSpan(I, j)
  return { n, j, ga, gb: ga + I.w, t0, t1, m: I.m }
}

// the outline of a stone, as points (x, y) going round: the inner arc, then the outer back
export function cellOutline(A, n, j, co = courses(A), per = 5) {
  const G = cellGeom(A, n, j, co), ns = Math.max(3, Math.ceil((G.t1 - G.t0) * (A.rx + A.ry) / 2 * per / 2)), out = []
  for (let i = 0; i <= ns; i++) out.push(ptAt(A, G.ga, G.t0 + (G.t1 - G.t0) * i / ns))
  for (let i = ns; i >= 0; i--) out.push(ptAt(A, G.gb, G.t0 + (G.t1 - G.t0) * i / ns))
  return out
}
