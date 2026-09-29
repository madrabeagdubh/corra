// celticKnot.js
// Location: js/game/effects/celticKnot.js
//
// A generator of Celtic knotwork, by the traditional construction behind
// the Book of Kells: take a grid, put a CROSSING on the middle of every grid
// edge, and let strands weave around the grid points, passing straight
// through each crossing. Take some edges away (the old "breaks") and plain
// plaitwork turns into knots; take them away symmetrically and the knot is
// balanced. Along every strand, crossings alternate over / under -- true
// interlace. (Formally: the strands are the medial graph of the grid graph,
// traced straight-ahead; planar medial graphs are always alternating.)
//
//   const knot = generateKnot({ cols: 4, rows: 3, breaks: 0.3, seed: 7 })
//
// ORGANIC MODE -- a modern reading of the old method: the construction does
// not need a grid, only a network of points. jitter / warp move the points
// off the lattice (stones in a stream, not squares); symmetric: false lets
// breaks fall anywhere. Same rules, so the weave is still true -- but the
// knot is asymmetric and alive, closer to La Tene than to Kells.
//   generateKnot({ cols: 16, rows: 60, breaks: 0.25, jitter: 0.3, warp: 0.4,
//                  symmetric: false, seed })
//
// SHAPES -- mask(x, y) -> false leaves a grid point out, so knotwork grows
// inside any outline (a wedge, a shield, a drawn shape); the strands close
// round the edge by themselves.
//   knot.strands  -> [{ points: [[x, y], ...], under: [bool, ...], closed: true }]
//   knot.width, knot.height  (grid units; the grid spans 0..cols-1, 0..rows-1)
//
// `under[i]` marks points that lie where this strand passes UNDER another:
// leave them undrawn (or draw them dimmed) and the weave appears. Points are
// evenly spaced along each strand, so drawing a prefix of them "traces" it.
//
// Reusable anywhere: the dawn crossing traces knots in its wake; ogham
// stones, borders, omens could use the same.

function rng(seed) {
  let s = seed >>> 0 || 1
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export function generateKnot({ cols = 4, rows = 3, breaks = 0.3, seed = 1, step = 0.06, gap = 0.16,
                               jitter = 0, warp = 0, symmetric = true, mask = null } = {}) {
  const inside = (x, y) => !mask || mask(x, y)
  const rand = rng(seed)
  // where each grid point actually sits (organic mode moves it)
  const posCache = new Map()
  const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28]
  const P = (x, y) => {
    const k = `${x},${y}`
    if (!posCache.has(k)) {
      const r = rng(seed * 7919 + x * 131 + y * 977)
      const edge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1
      const j = edge ? jitter * 0.3 : jitter
      posCache.set(k, [x + (r() - 0.5) * 2 * j + warp * Math.sin(y * 0.45 + ph[0]) * 0.8,
                       y + (r() - 0.5) * 2 * j + warp * Math.sin(x * 0.6 + ph[1]) * 0.5 + warp * Math.sin((x + y) * 0.3 + ph[2]) * 0.4])
    }
    return posCache.get(k)
  }
  // ── the grid graph, with symmetric breaks ─────────────────────────────────
  const key = (x, y) => `${x},${y}`
  const edges = []                                   // { a:[x,y], b:[x,y] }
  const has = new Set()
  const addEdge = (a, b) => { const k = [key(...a), key(...b)].sort().join('|'); if (!has.has(k)) { has.add(k); edges.push({ a, b }) } }
  const cut = new Set()
  // decide breaks on the left half, mirror them to the right (and top/bottom)
  const mirror = ([x, y]) => [cols - 1 - x, y]
  const vmirror = ([x, y]) => [x, rows - 1 - y]
  const edgeKey = (a, b) => [key(...a), key(...b)].sort().join('|')
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const b = [x + dx, y + dy]
      if (b[0] >= cols || b[1] >= rows) continue
      const a = [x, y]
      // only interior edges may break, so the knot keeps its outline
      const interior = !(dy === 0 && (y === 0 || y === rows - 1)) && !(dx === 0 && (x === 0 || x === cols - 1))
      const k = edgeKey(a, b)
      if (!interior || cut.has(k)) continue
      if (!symmetric) { if (rand() < breaks) cut.add(k); continue }
      if (x + dx <= (cols - 1) / 2 + 0.01 && y + dy <= (rows - 1) / 2 + 0.01 && rand() < breaks) {
        for (const [p, q] of [[a, b], [mirror(a), mirror(b)], [vmirror(a), vmirror(b)], [vmirror(mirror(a)), vmirror(mirror(b))]]) cut.add(edgeKey(p, q))
      }
    }
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!inside(x, y)) continue
    if (x + 1 < cols && inside(x + 1, y) && !cut.has(edgeKey([x, y], [x + 1, y]))) addEdge([x, y], [x + 1, y])
    if (y + 1 < rows && inside(x, y + 1) && !cut.has(edgeKey([x, y], [x, y + 1]))) addEdge([x, y], [x, y + 1])
  }

  // ── around each grid point, its edges in angular order ────────────────────
  const around = new Map()                           // vertex key -> [{ e, ang }]
  edges.forEach((e, i) => {
    for (const [v, w] of [[e.a, e.b], [e.b, e.a]]) {
      const k = key(...v)
      if (!around.has(k)) around.set(k, [])
      const pv = P(...v), pw = P(...w)
      around.get(k).push({ e: i, ang: Math.atan2(pw[1] - pv[1], pw[0] - pv[0]), v, w })
    }
  })
  for (const list of around.values()) list.sort((p, q) => p.ang - q.ang)
  const mid = e => { const a = P(...edges[e].a), b = P(...edges[e].b); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }

  // Tracing. A state (e, v, side) means: at the crossing on edge e, leaving
  // toward grid point v, turning round it counter-clockwise (+1) or
  // clockwise (-1). Round v we reach the neighbouring edge f; we arrive at
  // f's crossing on the opposite side, and pass STRAIGHT THROUGH it to f's
  // far end, keeping that side. So each step: side flips, and we move on.
  // A strand passes each crossing with side +1 or -1; the +1 strand is
  // OVER. Because side flips at every step, over/under alternates along
  // every strand -- true interlace, everywhere.
  const neighbour = (vk, e, side) => {
    const list = around.get(vk), i = list.findIndex(o => o.e === e)
    return list[(i + side + list.length) % list.length]
  }
  const endOf = (e, v) => (edges[e].a[0] === v[0] && edges[e].a[1] === v[1]) ? 'a' : 'b'
  const other = end => end === 'a' ? 'b' : 'a'
  const used = new Set()
  const sk = (e, end, side) => `${e}|${end}|${side}`
  const paths = []
  for (let e0 = 0; e0 < edges.length; e0++) for (const end0 of ['a', 'b']) for (const side0 of [1, -1]) {
    if (used.has(sk(e0, end0, side0))) continue
    const path = []
    let e = e0, end = end0, side = side0
    for (let guard = 0; guard < 5000; guard++) {
      if (used.has(sk(e, end, side))) break
      used.add(sk(e, end, side))
      const v = edges[e][end], vk = key(...v)
      const nb = neighbour(vk, e, side)
      path.push({ e, over: side === 1, v, from: e, to: nb.e, side })
      // the same medial edge walked the other way, so it isn't traced twice
      const fEnd = endOf(nb.e, v)
      used.add(sk(nb.e, fEnd, -side))
      e = nb.e; end = other(fEnd); side = -side
    }
    if (path.length) paths.push(path)
  }

  // ── the curve between two crossings round a grid point ─────────────────────
  // Straight diagonals where the turn is a right angle (plaitwork); round
  // arcs at the border (a straight angle), bigger loops at outer corners and
  // right round a dead end.
  const unit = (v, e) => { const o = edges[e], w = (o.a[0] === v[0] && o.a[1] === v[1]) ? o.b : o.a
    const pv = P(...v), pw = P(...w), dx = pw[0] - pv[0], dy = pw[1] - pv[1], m = Math.hypot(dx, dy)
    return [dx / m, dy / m, m] }
  function segment(v, e1, e2, side) {
    // walk round v from e1 to e2 in the direction `side`
    const u1 = unit(v, e1), u2 = unit(v, e2)
    const perp = ([x, y]) => side === 1 ? [-y, x] : [y, -x]      // toward the sweep
    const norm = ([x, y]) => { const m = Math.hypot(x, y) || 1; return [x / m, y / m] }
    let a1 = Math.atan2(u1[1], u1[0]), a2 = Math.atan2(u2[1], u2[0])
    let sweep = side === 1 ? a2 - a1 : a1 - a2
    while (sweep <= 1e-6) sweep += Math.PI * 2
    const pv = P(...v)
    const m1 = [pv[0] + u1[0] * u1[2] * 0.5, pv[1] + u1[1] * u1[2] * 0.5]
    const m2 = [pv[0] + u2[0] * u2[2] * 0.5, pv[1] + u2[1] * u2[2] * 0.5]
    const p1 = perp(u1), p2 = perp(u2)
    const d1 = norm([p1[0] - u1[0], p1[1] - u1[1]])                 // leaving m1, diagonally
    const d2 = norm([p2[0] + u2[0], p2[1] + u2[1]])                 // arriving at m2, diagonally
    const L = 0.2355 * Math.pow(sweep / (Math.PI / 2), 1.15) * (u1[2] + u2[2]) / 2
    const c1 = [m1[0] + d1[0] * L, m1[1] + d1[1] * L], c2 = [m2[0] - d2[0] * L, m2[1] - d2[1] * L]
    const n = Math.max(6, Math.round(10 * sweep / (Math.PI / 2)))
    const pts = []
    for (let k = 0; k < n; k++) {
      const t = k / n, u = 1 - t
      pts.push([u*u*u*m1[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t*t*t*m2[0],
                u*u*u*m1[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t*t*t*m2[1]])
    }
    return pts
  }

  // ── curves, sampled evenly, with over / under ─────────────────────────────
  // Under-passes are marked by arc length along the strand, so even a huge
  // organic field stays quick to build.
  const out = []
  for (const path of paths) {
    const raw = [], xs = []                        // xs: raw index of each crossing, and over/under
    for (const st of path) {
      xs.push({ i: raw.length, over: st.over })
      raw.push(...segment(st.v, st.from, st.to, st.side))
    }
    raw.push(raw[0])
    const cum = [0]
    for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]))
    const total = cum[cum.length - 1]
    const even = []
    for (let sA = 0, i = 1; sA < total; sA += step) {
      while (i < cum.length - 1 && cum[i] < sA) i++
      const k = (sA - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1)
      even.push([raw[i - 1][0] + (raw[i][0] - raw[i - 1][0]) * k, raw[i - 1][1] + (raw[i][1] - raw[i - 1][1]) * k])
    }
    const under = new Array(even.length).fill(false)
    for (const c of xs) {
      if (c.over) continue
      const sC = cum[c.i], lo = Math.max(0, Math.floor((sC - gap) / step)), hi = Math.min(even.length - 1, Math.ceil((sC + gap) / step))
      for (let j = lo; j <= hi; j++) under[j] = true
      if (sC - gap < 0) for (let j = Math.floor((total + sC - gap) / step); j < even.length; j++) under[j] = true
    }
    out.push({ points: even, under, closed: true })
  }
  return { strands: out, width: cols - 1, height: rows - 1 }
}
