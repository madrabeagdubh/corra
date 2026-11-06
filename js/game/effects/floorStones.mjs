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
    return { e0, w, m: Math.max(6, Math.round(per / (w * 1.3))), off: h2(n, 5) }
  })
  return { E, info }
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
  const u = ((t + Math.PI) / (2 * Math.PI) + I.off) * I.m
  return { n, j: ((Math.floor(u) % I.m) + I.m) % I.m }
}

// a stone's extent: g from ga to gb, the angle from t0 to t1
export function cellGeom(A, n, j, co = courses(A)) {
  const I = co.info[n], ga = A.g0 + I.e0
  return { n, j, ga, gb: ga + I.w, t0: (j / I.m - I.off) * 2 * Math.PI - Math.PI, t1: ((j + 1) / I.m - I.off) * 2 * Math.PI - Math.PI, m: I.m }
}

// the outline of a stone, as points (x, y) going round: the inner arc, then the outer back
export function cellOutline(A, n, j, co = courses(A), per = 5) {
  const G = cellGeom(A, n, j, co), ns = Math.max(3, Math.ceil((G.t1 - G.t0) * (A.rx + A.ry) / 2 * per / 2)), out = []
  for (let i = 0; i <= ns; i++) out.push(ptAt(A, G.ga, G.t0 + (G.t1 - G.t0) * i / ns))
  for (let i = ns; i >= 0; i--) out.push(ptAt(A, G.gb, G.t0 + (G.t1 - G.t0) * i / ns))
  return out
}
