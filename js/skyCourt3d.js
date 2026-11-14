// skyCourt3d.js -- the court under the champion sky, built in the round, after Tobar Segais (the escape's antechamber,
// hewnExtras.js): the moonwell in the middle on two steps and a broad carved rim, the floor paved round it in rings of
// flags, five channels cut out from it to the edge, and round all a ring of dressed stones under carved lintels; the
// druid and the queen on the top step, either side, leaning in over the water; grass beyond. Everything is placed in metres on a flat ground and seen through a
// camera, so the camera can move: walk to the well, bow its head over it, and go down into the water (starSky.js's dive).
//
// The camera: { x, y, z } in metres (y up, z ahead, the well's centre at x 0, z ZP), its pitch (radians, positive
// looking down), and hy, the screen row it looks through (a shifted lens: at rest the horizon sits low on the screen, so
// most of the screen is sky; looking straight down it moves to the middle). f is the sky's focal length, so the ground
// and the sky are seen with the same lens.
//
// The well is seen rounder than the geometry says (ROUND), the moon tile being as much a sign as a thing: the ground
// round it is drawn as though seen from higher, the most at the well and less and less out to LENS_OUT, so the steps and
// the flags round it agree with it. The cheat only ever makes the well rounder than it truly looks, so it lets go of
// itself, smoothly, as the camera comes over the well and the truth catches up with it.
//
// The well's water is drawn by the caller (starSky.js drawPool: the moon tile laid in the rim, the water in it); this
// module says where, as an ellipse.
//
//   import { createCourt } from './skyCourt3d.js'
//   const court = createCourt({ W, H, f, PX, dpr, druid, queen, tone })
//   court.draw(g, cam, now, (cx, cy, rx, ry) => drawPool(cx, cy, rx, ry, ...))
//   court.wellOnScreen(cam) -> { cx, cy, rx, ry }

const EYE = 1.7            // eye height, metres
const ZP = 6.5             // the well's centre, metres ahead (the same on every screen: the horizon is placed to suit)
const RING_R = 9.6         // the ring of stones, round the well (so none comes near the camera, at rest or walking in)
const N_STONES = 16
const R_TILE = 1.12        // the moon tile's whole disc (its own dark rim and gold ring included), metres
const STEPS = [            // round the tile, from the inside: the carved rim, then two steps down to the floor
  { r0: R_TILE, r1: 1.46, h: 0.40, n: 18, tone: 0.34, carved: true },
  { r0: 1.46, r1: 1.78, h: 0.27, n: 22, tone: 0.27 },
  { r0: 1.78, r1: 2.10, h: 0.14, n: 26, tone: 0.22 },
]
const WATER_Y = STEPS[0].h // the tile's face, where the camera goes into the water
const ROUND = 0.66         // how round the well is seen (ry:rx), at the least
const LENS_IN = 2.3, LENS_OUT = 7.2   // the cheat: whole within LENS_IN of the well, gone by LENS_OUT
const CHANNELS = [Math.PI / 2, Math.PI / 4, Math.PI * 3 / 4, 0, Math.PI]   // five ways out from the well (away, the diagonals, the sides)
const CH_W = 0.3           // a channel's width
const FIG_H = 1.75         // the druid's and the queen's height (their pictures' full height: druid.png and queen.png)
const FIG_AT = 0.42        // where they stand on the top step: how far round behind the well from the sides (radians)
const FIG_TURN = 0.45      // how far each is turned from facing us toward the well (radians)
const FIG_LEAN = 0.2       // how far they lean in, peering (radians)
const NEAR = 0.9           // nearer than this (metres, along the view), a stone is not drawn: the camera is past it
const ZN = 0.08            // the near plane: the floor is cut here, so nothing behind the eye is ever drawn

const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u) }

export function createCourt({ W, H, f, PX, dpr = 1, druid, queen, tone }) {
  // the horizon's row at rest: wherever puts the well where the moon tile sits in the game (its centre 102px up)
  const HY = (H - 102) - EYE * f / ZP
  const rnd = mulberry(31)
  // the stones: round the well, each facing it, dressed square, each its own size; lintels from stone to stone
  const stones = []
  for (let i = 0; i < N_STONES; i++) {
    const a = (i + 0.5) / N_STONES * Math.PI * 2 + Math.PI / 2       // (a gap dead ahead, beyond the well, for the sight)
    const x = Math.cos(a) * RING_R, z = ZP + Math.sin(a) * RING_R
    const n = [-Math.cos(a), 0, -Math.sin(a)], t = [n[2], 0, -n[0]]
    const h = 2.7 + rnd() * 0.3, w = 1.2 + rnd() * 0.2
    const prof = [[-0.5, 0], [-0.47, 0.97], [-0.43, 1], [0.43, 1], [0.47, 0.97], [0.5, 0]]
    stones.push({ i, x, z, n, t, h, w, d: 0.6 + rnd() * 0.1, prof, lean: (rnd() - 0.5) * 0.03 })
  }
  // the grass: tufts beyond the paving, a few flowers
  const tufts = []
  for (let k = 0; k < 420; k++) {
    const r = RING_R - 0.4 + rnd() * 4, a = rnd() * Math.PI * 2, x = Math.cos(a) * r, z = ZP + Math.sin(a) * r
    tufts.push({ x, z, h: 0.12 + rnd() * 0.3, lean: (rnd() - 0.4) * 0.15, c: [36 + rnd() * 26 | 0, 56 + rnd() * 26 | 0, 52 + rnd() * 18 | 0], fl: rnd() < 0.07 ? (rnd() < 0.5 ? '235,230,210' : '225,190,215') : null })
  }
  // the floor: rings of flags from the foot of the steps out to the stones, each flag its own shade
  const flags = []
  { let r0 = STEPS[STEPS.length - 1].r1
    while (r0 < RING_R - 0.5) {
      const r1 = Math.min(RING_R - 0.5, r0 + 0.8 + rnd() * 0.15), n = Math.max(8, Math.round(Math.PI * (r0 + r1) / (1.05 + rnd() * 0.2))), off = rnd()
      for (let j = 0; j < n; j++) flags.push({ r0, r1, a0: (j + off) / n * Math.PI * 2, a1: (j + 1 + off) / n * Math.PI * 2, k: (rnd() - 0.5) * 0.05 })
      r0 = r1
    }
  }
  // starlight on the channels' water, here and there
  const glints = []
  for (const a of CHANNELS) for (let k = 0; k < 9; k++) { const r = STEPS[2].r1 + rnd() * (RING_R + 1 - STEPS[2].r1), s = (rnd() - 0.5) * CH_W * 0.6; glints.push({ x: Math.cos(a) * r - Math.sin(a) * s, z: ZP + Math.sin(a) * r + Math.cos(a) * s, ph: rnd() * 6, m: 0.4 + rnd() * 0.6 }) }
  // the druid and the queen on the top step, either side of the well and a little round behind it, each a picture on a
  // rectangle standing in the court: turned toward the well and leaning in over it, so they are seen as things in the
  // place as the camera moves. Their pictures face right, so the queen stands on the left; the druid, on the right, is
  // turned the other way. Drawn once each, darkened and cut to what is in them
  const dark = (im) => {
    if (!im || !im.complete || !im.naturalWidth) return null
    const W0 = im.naturalWidth, H0 = im.naturalHeight, c = document.createElement('canvas'); c.width = W0; c.height = H0
    const x = c.getContext('2d'); x.filter = 'brightness(0.5) saturate(0.6)'; x.drawImage(im, 0, 0)
    const d = x.getImageData(0, 0, W0, H0).data; let x0 = W0, x1 = 0, y0 = H0
    for (let y = 0; y < H0; y++) for (let k = 0; k < W0; k++) if (d[(y * W0 + k) * 4 + 3] > 8) { if (k < x0) x0 = k; if (k > x1) x1 = k; if (y < y0) y0 = y }
    if (x1 < x0) return null
    const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = H0 - y0; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height)
    const m = FIG_H / H0                                               // (metres to the picture's pixel, the whole picture FIG_H tall)
    return { c: o, l: (x0 - W0 / 2) * m, r: (x1 + 1 - W0 / 2) * m, h: (H0 - y0) * m }   // (across from the picture's middle, which stands on the foot)
  }
  const FIG_R = (STEPS[1].r0 + STEPS[1].r1) / 2, FIG_Y = STEPS[1].h
  const figs = [-1, 1].map(side => {
    const a = Math.PI / 2 - side * (Math.PI / 2 - FIG_AT), x = Math.cos(a) * FIG_R, z = ZP + Math.sin(a) * FIG_R
    const ux = -side * Math.cos(FIG_TURN), uz = Math.sin(FIG_TURN)        // (the picture's rightward: toward the well, and turned in)
    const ix = -Math.cos(a), iz = -Math.sin(a)                            // (in, toward the well's middle)
    return { im: side < 0 ? queen : druid, x, z, u: [ux, uz], v: [ix * Math.sin(FIG_LEAN), Math.cos(FIG_LEAN), iz * Math.sin(FIG_LEAN)], c: null }
  })

  // into the camera's frame: [x, y, depth]
  function toCam([X, Y, Z], cam) {
    const dx = X - cam.x, dy = Y - cam.y, dz = Z - cam.z, cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch)
    return [dx, dy * cp + dz * sp, dz * cp - dy * sp]
  }
  // to the screen, true: [sx, sy, depth] or null behind the camera
  function project(v, cam) {
    const c = toCam(v, cam); if (c[2] < 0.05) return null
    return [PX + f * c[0] / c[2], cam.hy - f * c[1] / c[2], c[2]]
  }
  // the lens round the well (see the top): where the well's centre falls, and how much rounder it is seen than it is
  function lensOf(cam) {
    const near = project([0, 0, ZP - R_TILE], cam), far = project([0, 0, ZP + R_TILE], cam), side = project([R_TILE, 0, ZP], cam), c = project([0, 0, ZP], cam)
    if (!near || !far || !side || !c) return { K: 1, cy: 0, rx: 0, ryT: 0, c }
    const rx = Math.abs(side[0] - c[0]), ryT = Math.abs(near[1] - far[1]) / 2
    return { K: rx > 0 && ryT > 0 ? Math.max(1, ROUND * rx / ryT) : 1, cy: (near[1] + far[1]) / 2, rx, ryT, c }
  }
  let lens = { K: 1, cy: 0 }
  // to the screen as the court is seen: a point's foot on the ground is moved toward or away from the well's row by the
  // lens, and the point keeps its own height above its foot
  function P(v, cam) {
    const p = project(v, cam); if (!p || lens.K === 1) return p
    const r = Math.hypot(v[0], v[2] - ZP), k = 1 + (lens.K - 1) * (1 - smooth(LENS_IN, LENS_OUT, r)); if (k === 1) return p
    const ft = v[1] ? project([v[0], 0, v[2]], cam) : p; if (!ft) return p
    return [p[0], lens.cy + (ft[1] - lens.cy) * k + (p[1] - ft[1]), p[2]]
  }
  // a polygon on (or near) the ground, cut at the near plane so a flag under the eye is never thrown across the screen
  function groundPath(g, pts, cam) {
    const cs = pts.map(v => toCam(v, cam)), out = []
    for (let i = 0; i < pts.length; i++) {
      const a = cs[i], b = cs[(i + 1) % pts.length], A = pts[i], B = pts[(i + 1) % pts.length]
      if (a[2] >= ZN) out.push(A)
      if ((a[2] >= ZN) !== (b[2] >= ZN)) { const u = (ZN - a[2]) / (b[2] - a[2]); out.push([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u]) }
    }
    if (out.length < 3) return false
    g.beginPath()
    for (let i = 0; i < out.length; i++) { const p = P(out[i], cam); if (!p) return false; i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]) }
    g.closePath(); return true
  }
  const ringPt = (r, a, y = 0) => [Math.cos(a) * r, y, ZP + Math.sin(a) * r]
  const arcPts = (r, a0, a1, y, m) => Array.from({ length: m + 1 }, (_, i) => ringPt(r, a0 + (a1 - a0) * i / m, y))

  // the well as an ellipse on the screen, as the court is seen (the tile's face, at the top of the rim)
  function wellOnScreen(cam, r = R_TILE) {
    lens = lensOf(cam)
    const c = lens.c, top = project([0, WATER_Y, ZP], cam); if (!c || !top || !lens.rx) return null
    const s = r / R_TILE
    return { cx: c[0], cy: lens.cy - (c[1] - top[1]), rx: lens.rx * s, ry: Math.max(lens.ryT, lens.rx * ROUND) * s, depth: c[2] }
  }

  // ── the still parts (the floor; the well's steps and rim) are drawn to canvases aside, and redrawn only when the
  // camera moves
  const layer = () => { const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); return { c, x: c.getContext('2d'), key: '' } }
  const floorL = layer(), wellL = layer()
  const keyOf = (cam) => [cam.x, cam.y, cam.z, cam.pitch, cam.hy].map(v => v.toFixed(4)).join()
  function cached(L, cam, paint) {
    const k = keyOf(cam)
    if (L.key !== k) { L.key = k; L.x.setTransform(1, 0, 0, 1, 0, 0); L.x.clearRect(0, 0, L.c.width, L.c.height); L.x.setTransform(dpr, 0, 0, dpr, 0, 0); paint(L.x) }
    return L.c
  }

  function draw(g, cam, now, drawWell) {
    const t = now / 1000, hz = cam.hy - f * Math.tan(cam.pitch)          // where the horizon falls, looking down by pitch
    const wl = wellOnScreen(cam)                                         // (also sets the lens for this frame)
    g.drawImage(cached(floorL, cam, (x) => paintFloor(x, cam, hz)), 0, 0, W, H)
    // starlight on the channels
    for (const q of glints) { const p = P([q.x, 0.01, q.z], cam); if (!p || p[1] < hz) continue; const a = q.m * (0.35 + 0.65 * Math.max(0, Math.sin(t * 1.3 + q.ph))) * Math.min(1, 9 / p[2]); if (a < 0.05) continue; g.fillStyle = `rgba(225,232,255,${a.toFixed(3)})`; const z = Math.max(1, 2.2 * Math.min(1, 6 / p[2])); g.fillRect(p[0] - z / 2, p[1] - z / 4, z, z / 2) }
    // everything standing, far to near
    const items = []
    for (const s of stones) { const p = project([s.x, 0, s.z], cam); if (p) items.push({ d: p[2], draw: () => drawStone(g, s, cam) }) }
    for (let i = 0; i < N_STONES - 1; i++) {                              // (none over the gap beyond the well)
      const a = stones[i], b = stones[i + 1]
      const p = project([(a.x + b.x) / 2, 0, (a.z + b.z) / 2], cam); if (p) items.push({ d: p[2] - 0.01, draw: () => drawLintel(g, a, b, cam) })
    }
    for (const u of tufts) { const p = project([u.x, 0, u.z], cam); if (p && p[0] > -20 && p[0] < W + 20 && p[1] < H + 30) items.push({ d: p[2], draw: () => drawTuft(g, u, p, cam, t) }) }
    items.sort((p, q) => q.d - p.d).forEach(it => it.draw())
    // the well: its steps and rim, then the tile and the water in it, then the two beside it
    g.drawImage(cached(wellL, cam, (x) => paintWell(x, cam)), 0, 0, W, H)
    if (wl) drawWell(wl.cx, wl.cy, wl.rx * 0.78, wl.ry * 0.78)
    figs.map(fg => ({ fg, p: project([fg.x, FIG_Y, fg.z], cam) })).filter(o => o.p).sort((a, b) => b.p[2] - a.p[2]).forEach(o => drawFig(g, o.fg, cam))
    // moonlit mist low along the ground
    if (hz > 0 && hz < H) { const m = g.createLinearGradient(0, hz - H * 0.04, 0, hz + H * 0.05); m.addColorStop(0, 'rgba(130,145,195,0)'); m.addColorStop(0.5, 'rgba(130,145,195,0.1)'); m.addColorStop(1, 'rgba(130,145,195,0)'); g.fillStyle = m; g.fillRect(0, hz - H * 0.04, W, H * 0.09) }
  }

  // the ground to the horizon; the flags; the channels cut through them
  function paintFloor(g, cam, hz) {
    const top = Math.max(-2, Math.min(H + 2, hz))
    if (top < H) { const gg = g.createLinearGradient(0, top, 0, H); gg.addColorStop(0, tone(0.14)); gg.addColorStop(1, tone(0.06)); g.fillStyle = gg; g.fillRect(0, top, W, H - top + 2) }
    g.lineJoin = 'round'
    for (const fl of flags) {
      const m = Math.max(2, Math.round((fl.a1 - fl.a0) * fl.r1 / 0.35))
      if (!groundPath(g, [...arcPts(fl.r0, fl.a0, fl.a1, 0, m), ...arcPts(fl.r1, fl.a1, fl.a0, 0, m)], cam)) continue
      const rm = (fl.r0 + fl.r1) / 2, lit = 0.15 + 0.07 * Math.exp(-(rm - 2) / 2.5) + fl.k        // (lighter toward the well)
      g.fillStyle = tone(lit); g.fill(); g.strokeStyle = 'rgba(2,3,6,0.55)'; g.lineWidth = 1; g.stroke()
    }
    // the channels: cut out from the foot of the steps, under the stones, into the grass; the water dark in them, a
    // little below the floor, the far bank catching the light
    const r0 = STEPS[2].r1 - 0.05, r1 = RING_R + 3
    for (const a of CHANNELS) {
      const c = Math.cos(a), s = Math.sin(a), e = CH_W / 2, Q = (r, w) => [c * r - s * w, 0, ZP + s * r + c * w]
      const L = [], R = []; for (let k = 0; k <= 12; k++) { const r = r0 + (r1 - r0) * k / 12; L.push(Q(r, -e)); R.push(Q(r, e)) }
      if (!groundPath(g, [...L, ...R.reverse()], cam)) continue
      g.fillStyle = 'rgb(3,6,15)'; g.fill()
      g.strokeStyle = 'rgba(175,185,220,0.16)'; g.lineWidth = 1; g.stroke()
    }
  }
  // the well's two steps and its rim, from the outside in: each a ring of blocks, the top of each lit along its edge, the
  // riser of each shown where it faces us; the rim carved, as Tobar Segais's is, with a running line round it and a
  // chevron or a turn of the spiral on each block
  function paintWell(g, cam) {
    g.lineJoin = 'round'; g.lineCap = 'round'
    for (let si = STEPS.length - 1; si >= 0; si--) {
      const S = STEPS[si], hb = STEPS[si + 1]?.h ?? 0, off = si * 0.37
      for (let j = 0; j < S.n; j++) {
        const a0 = (j + off) / S.n * Math.PI * 2, a1 = (j + 1 + off) / S.n * Math.PI * 2, am = (a0 + a1) / 2, m = 3
        const jit = ((j * 37 + si * 11) % 7 - 3) * 0.008
        // the riser, where its face is toward the camera
        const mid = ringPt(S.r1, am), nrm = [Math.cos(am), 0, Math.sin(am)]
        if ((cam.x - mid[0]) * nrm[0] + (cam.z - mid[2]) * nrm[2] > 0 && groundPath(g, [...arcPts(S.r1, a0, a1, S.h, m), ...arcPts(S.r1, a1, a0, hb, m)], cam)) {
          g.fillStyle = tone(S.tone * 0.42 + jit); g.fill(); g.strokeStyle = 'rgba(2,3,6,0.5)'; g.lineWidth = 1; g.stroke()
        }
        // the top
        if (!groundPath(g, [...arcPts(S.r0, a0, a1, S.h, m), ...arcPts(S.r1, a1, a0, S.h, m)], cam)) continue
        g.fillStyle = tone(S.tone + jit); g.fill(); g.strokeStyle = 'rgba(2,3,6,0.55)'; g.lineWidth = 1; g.stroke()
        line(g, arcPts(S.r1, a0, a1, S.h, m), cam, 'rgba(190,200,235,0.22)', 1.2)              // (the lit nosing)
        if (S.carved) {
          const rc = (S.r0 + S.r1) / 2
          line(g, arcPts(rc, a0, a1, S.h, m), cam, 'rgba(2,3,6,0.6)', 1)
          const ro = rc + (S.r1 - S.r0) * 0.22, c = P(ringPt(ro, am, S.h), cam), lp = P(ringPt(ro, am - 0.09, S.h), cam), rp = P(ringPt(ro, am + 0.09, S.h), cam)
          if (c && lp && rp) {
            const sz = Math.hypot(rp[0] - lp[0], rp[1] - lp[1]) / 2; g.strokeStyle = 'rgba(2,3,6,0.6)'; g.lineWidth = 1; g.beginPath()
            if (j % 2) { const up = Math.max(1.5, sz * 0.45); g.moveTo(lp[0], lp[1]); g.lineTo(c[0], c[1] - up); g.lineTo(rp[0], rp[1]) }
            else g.ellipse(c[0], c[1], sz * 0.4, Math.max(1, sz * 0.4 * ROUND), 0, 0, Math.PI * 1.6)
            g.stroke()
          }
        }
      }
    }
  }
  function line(g, pts, cam, style, w) {
    g.beginPath(); let on = false
    for (const v of pts) { const p = P(v, cam); if (!p || p[2] < ZN) { on = false; continue } on ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); on = true }
    g.strokeStyle = style; g.lineWidth = w; g.stroke()
  }

  function drawStone(g, s, cam) {
    const corner = (u, v, back) => { const o = back ? -s.d : 0; return project([s.x + s.t[0] * u * s.w + s.n[0] * o + s.lean * v * s.h, v * s.h, s.z + s.t[2] * u * s.w + s.n[2] * o], cam) }
    const front = s.prof.map(([u, v]) => corner(u, v, false)), back = s.prof.map(([u, v]) => corner(u, v, true))
    if (front.some(p => !p || p[2] < NEAR) || back.some(p => !p || p[2] < NEAR)) return   // (a stone right by the camera: gone by)
    // the back face first (its edges show as the stone's thickness), then the face toward the well
    poly(g, back); g.fillStyle = tone(0.05); g.fill()
    for (let k = 0; k < front.length - 1; k++) { poly(g, [front[k], front[k + 1], back[k + 1], back[k]]); g.fillStyle = tone(0.09); g.fill() }
    poly(g, front)
    const xs = front.map(p => p[0]), sg = g.createLinearGradient(Math.min(...xs), 0, Math.max(...xs), 0)
    const lit = 0.36 + 0.12 * Math.max(-1, Math.min(1, -s.n[0]))      // (the moon is up to the left)
    sg.addColorStop(0, tone(lit)); sg.addColorStop(0.45, tone(lit * 0.5)); sg.addColorStop(1, tone(0.06))
    g.fillStyle = sg; g.fill(); g.strokeStyle = 'rgba(2,3,6,0.6)'; g.lineWidth = 1; g.stroke()
    g.strokeStyle = 'rgba(175,185,220,0.2)'; g.beginPath(); g.moveTo(front[1][0], front[1][1]); g.lineTo(front[2][0], front[2][1]); g.lineTo(front[3][0], front[3][1]); g.stroke()
    // the impost: a band cut across the face under the lintel, as on the antechamber's columns
    for (const v of [0.84, 0.88]) { const a = corner(-0.48, v, false), b = corner(0.48, v, false); if (a && b) { g.strokeStyle = 'rgba(2,3,6,0.5)'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke() } }
  }
  function drawLintel(g, a, b, cam) {
    const h0 = Math.min(a.h, b.h) - 0.08, h1 = h0 + 0.55, o = 0.32
    const Pt = (u, y, off) => project([a.x + (b.x - a.x) * u + (a.n[0] + b.n[0]) / 2 * off, y, a.z + (b.z - a.z) * u + (a.n[2] + b.n[2]) / 2 * off], cam)
    const q = [Pt(0, h0, o), Pt(1, h0, o), Pt(1, h1, o), Pt(0, h1, o)], top = [Pt(0, h1, o), Pt(1, h1, o), Pt(1, h1, -o), Pt(0, h1, -o)]
    if (q.some(p => !p || p[2] < NEAR) || top.some(p => !p || p[2] < NEAR)) return
    poly(g, top); g.fillStyle = tone(0.12); g.fill()
    poly(g, q); g.fillStyle = tone(0.3); g.fill(); g.strokeStyle = 'rgba(2,3,6,0.55)'; g.lineWidth = 1; g.stroke()
    g.strokeStyle = 'rgba(175,185,220,0.18)'; g.beginPath(); g.moveTo(q[3][0], q[3][1]); g.lineTo(q[2][0], q[2][1]); g.stroke()
    // carved as the antechamber's doors are: a fillet above and below, and a chevron running between them
    const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(3, Math.round(len / 0.32)), ya = h0 + 0.13, yb = h1 - 0.13
    g.strokeStyle = 'rgba(2,3,6,0.5)'; g.beginPath()
    for (const y of [h0 + 0.07, h1 - 0.07]) { const p0 = Pt(0.03, y, o), p1 = Pt(0.97, y, o); if (p0 && p1) { g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]) } }
    let on = false
    for (let k = 0; k <= n; k++) { const p = Pt(0.03 + 0.94 * k / n, k % 2 ? ya : yb, o); if (!p) { on = false; continue } on ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); on = true }
    g.stroke()
  }
  // a figure: its picture laid on its rectangle (the rectangle's top-left, top-right and bottom-left corners, as the court
  // is seen; near enough to the truth for something this narrow), and not at all once the camera is in among them
  function drawFig(g, fg, cam) {
    if (!fg.c) fg.c = dark(fg.im); if (!fg.c) return
    const F = fg.c, at = (s, t) => [fg.x + fg.u[0] * s + fg.v[0] * t, FIG_Y + fg.v[1] * t, fg.z + fg.u[1] * s + fg.v[2] * t]
    const corners = [at(F.l, F.h), at(F.r, F.h), at(F.l, 0), at(F.r, 0)]
    if (corners.some(v => { const c = toCam(v, cam); return c[2] < 0.6 })) return
    const [TL, TR, BL] = corners.map(v => P(v, cam)); if (!TL || !TR || !BL) return
    const cw = F.c.width, ch = F.c.height
    g.save(); g.imageSmoothingEnabled = false
    g.transform((TR[0] - TL[0]) / cw, (TR[1] - TL[1]) / cw, (BL[0] - TL[0]) / ch, (BL[1] - TL[1]) / ch, TL[0], TL[1])
    g.drawImage(F.c, 0, 0); g.restore()
  }
  function drawTuft(g, u, p, cam, t) {
    const tp = project([u.x + u.lean * u.h, u.h, u.z], cam); if (!tp) return
    const near = Math.min(1, 6 / p[2])
    g.strokeStyle = `rgba(${u.c[0]},${u.c[1]},${u.c[2]},${(0.5 + 0.4 * near).toFixed(2)})`; g.lineWidth = Math.max(0.6, 1.4 * near)
    const sw = Math.sin(t * 0.8 + u.x) * 0.3 * (tp[1] - p[1]) * 0.1
    g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(p[0] + 1, (p[1] + tp[1]) / 2, tp[0] + sw, tp[1]); g.stroke()
    if (u.fl) { g.fillStyle = `rgba(${u.fl},0.75)`; g.beginPath(); g.arc(tp[0] + sw, tp[1], Math.max(0.7, 1.6 * near), 0, Math.PI * 2); g.fill() }
  }
  const poly = (g, pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath() }

  return { ZP, EYE, HY, R_TILE, WATER_Y, project, wellOnScreen, draw }
}
