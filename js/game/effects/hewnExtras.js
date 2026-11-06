// hewnExtras.js
// Location: js/game/effects/hewnExtras.js
//
// Materials and set pieces for hewnRock.js -- what the underworld mockups were drawn with.
//
// Materials (mapData.hewn.mat, one character a tile): r hewn rock (the default), c rough cave rock,
// m masonry (flagstones underfoot, coursed blocks in the faces), b basalt, w wood, d drystone, o standing
// slabs (the Brú's, some pecked with spirals). g on water: a green glow.
// Set pieces (props, by type): torch, shaft (light from above), mite (stalagmite, or a stake), box (a chest,
// a basin, a table, a tomb), sprite (from the world sheet), arch, mob (a creature from the oryx creature
// sheet: c, r its column and row; ghost, glow, float), ogham, spiral, eyes, eye (a great eye in a wall),
// cauldron, candles, mist; and over several rows, roots, fish, streak (light lying along a floor).
// Hex columns (mapData.hewn.hex). Drips on lips. Screen grades (applyGrade, at the bottom).
// The maps: tools/map-editor/generators/underworld_mocks_gen.mjs.

import { statueCanvas } from './statues.js'
import { h2, WIDS, courses, cellGeom, ptAt, cellAt } from './floorStones.mjs'
import { seeded, wrapNoise, hash, makeFloorAtlas, makeRockTexture, makeBlockTexture } from './caveWalls.js'

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// ── textures ──────────────────────────────────────────────────────────────────
// Dressed flagstones in the old overgrown way: warm grey slabs, dark joints, a lit lip on each stone's upper left,
// moss creeping out of the joints and in patches, here and there a yellow flower (after the look of a ruin in the
// open: stone, then green on it). Seamless every way.
export function makeFlagstones(n, px, seed) {
  const S = n * px, c = document.createElement('canvas'); c.width = c.height = S
  const x = c.getContext('2d'), rnd = seeded(seed), nz = wrapNoise(rnd, n * 3, n * 3), mz = wrapNoise(rnd, n * 2, n * 2), fz = wrapNoise(rnd, n * 6, n * 6)
  const joint = new Uint8Array(S * S)                 // 1 where a joint is, 2 where a stone's lit lip is
  x.fillStyle = '#2c2a28'; x.fillRect(0, 0, S, S)
  let y = 0
  while (y < S) {
    let h = Math.round(px * (0.7 + rnd() * 0.7)); if (S - y - h < px * 0.5) h = S - y
    let xx = -Math.round(rnd() * px)
    while (xx < S) {
      const w = Math.round(px * (0.8 + rnd() * 1.0))
      const t = 0.9 + rnd() * 0.28, warm = rnd() * 8
      for (const ox of [-S, 0, S]) {
        const g = x.createLinearGradient(0, y, 0, y + h)
        g.addColorStop(0, `rgb(${(150 + warm) * t | 0},${(144 + warm * 0.6) * t | 0},${132 * t | 0})`); g.addColorStop(1, `rgb(${(122 + warm) * t | 0},${(117 + warm * 0.6) * t | 0},${107 * t | 0})`)
        x.fillStyle = g; x.fillRect(xx + ox + 1, y + 1, w - 2, h - 2)
        x.fillStyle = 'rgba(255,248,230,0.22)'; x.fillRect(xx + ox + 1, y + 1, w - 2, 1); x.fillRect(xx + ox + 1, y + 1, 1, h - 2)       // the lit lip
        x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(xx + ox + 1, y + h - 2, w - 2, 1); x.fillRect(xx + ox + w - 2, y + 1, 1, h - 2)    // and the shadowed one
      }
      for (let i = 0; i < w; i++) for (const j of [0, h - 1]) { const X = ((xx + i) % S + S) % S, Y = (y + j) % S; joint[Y * S + X] = 1 }
      for (let j = 0; j < h; j++) for (const i of [0, w - 1]) { const X = ((xx + i) % S + S) % S, Y = (y + j) % S; joint[Y * S + X] = 1 }
      xx += w
    }
    y += h
  }
  const img = x.getImageData(0, 0, S, S), d = img.data
  // how near a joint each pixel is (0..2 px), for the moss to creep from
  const near = new Uint8Array(S * S)
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    let m = 0
    for (let dj = -2; dj <= 2 && !m; dj++) for (let di = -2; di <= 2; di++) if (joint[((j + dj + S) % S) * S + (i + di + S) % S] === 1) { m = Math.max(m, 3 - Math.max(Math.abs(di), Math.abs(dj))); break }
    near[j * S + i] = m
  }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const o = (j * S + i) * 4, u = i / S, v = j / S
    const k = 0.9 + 0.22 * nz(u, v) + (rnd() - 0.5) * 0.1
    d[o] *= k; d[o + 1] *= k; d[o + 2] *= k
    const mo = mz(u, v) * 0.85 + near[j * S + i] * 0.14 + (fz(u, v) - 0.5) * 0.25
    if (mo > 0.72) {
      const a = Math.min(0.9, (mo - 0.72) * 3.2), l = 0.75 + 0.5 * fz(u * 1.7, v * 1.7) + ((i + j) % 5 === 0 ? 0.18 : 0)
      d[o] = d[o] * (1 - a) + 62 * l * a; d[o + 1] = d[o + 1] * (1 - a) + 112 * l * a; d[o + 2] = d[o + 2] * (1 - a) + 38 * l * a
    }
  }
  x.putImageData(img, 0, 0)
  for (let q = 0; q < n * n * 2; q++) {                // flowers, a pixel or two
    const fx = rnd() * S | 0, fy = rnd() * S | 0
    if (mz(fx / S, fy / S) < 0.6) continue
    x.fillStyle = rnd() < 0.8 ? '#e6c83c' : '#f2ecd8'; x.fillRect(fx, fy, 2, 1); x.fillRect(fx, fy - 1, 1, 3)
  }
  return c
}

// moss on a wall's face: patches, thicker along the lower edge, a pale fleck here and there (c: the face canvas)
export function mossify(c, seed, amount = 1) {
  const w = c.width, h = c.height, x = c.getContext('2d'), rnd = seeded(seed), mz = wrapNoise(rnd, 7, 5), fz = wrapNoise(rnd, 24, 16)
  const img = x.getImageData(0, 0, w, h), d = img.data
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = i / w, v = j / h, mo = (mz(u, v) * 0.8 + (fz(u, v) - 0.5) * 0.3 + v * 0.25) * amount
    if (mo < 0.72) continue
    const o = (j * w + i) * 4, a = Math.min(0.85, (mo - 0.72) * 4), l = 0.7 + 0.6 * fz(u * 2, v * 2)
    d[o] = d[o] * (1 - a) + 58 * l * a; d[o + 1] = d[o + 1] * (1 - a) + 104 * l * a; d[o + 2] = d[o + 2] * (1 - a) + 36 * l * a
  }
  x.putImageData(img, 0, 0)
  return c
}

export function makeBasaltFloor(n, px, seed) {
  const S = n * px, c = document.createElement('canvas'); c.width = c.height = S
  const x = c.getContext('2d'), rnd = seeded(seed), nz = wrapNoise(rnd, n * 2, n * 2)
  const img = x.createImageData(S, S)
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const k = 0.75 + 0.3 * nz(i / S, j / S) + (rnd() - 0.5) * 0.1, o = (j * S + i) * 4
    img.data[o] = 58 * k; img.data[o + 1] = 60 * k; img.data[o + 2] = 64 * k; img.data[o + 3] = 255
  }
  x.putImageData(img, 0, 0)
  // a net of hexagonal joints
  const r = px * 0.62, dx = r * 1.5, dy = r * Math.sqrt(3)
  x.strokeStyle = 'rgba(12,12,14,0.8)'; x.lineWidth = 1.6
  for (let col = -1; col * dx < S + dx; col++) for (let row = -1; row * dy < S + dy; row++) {
    const cx = col * dx, cy = row * dy + (col % 2 ? dy / 2 : 0)
    x.beginPath()
    for (let q = 0; q <= 6; q++) { const a = q * Math.PI / 3, px2 = cx + r * Math.cos(a) + (rnd() - 0.5) * 2, py2 = cy + r * Math.sin(a) + (rnd() - 0.5) * 2; q ? x.lineTo(px2, py2) : x.moveTo(px2, py2) }
    x.stroke()
  }
  return c
}

export function makePlanks(n, px, seed, vertical = false) {
  const S = n * px, c = document.createElement('canvas'); c.width = c.height = S
  const x = c.getContext('2d'), rnd = seeded(seed)
  const bw = px / 3
  for (let q = 0; q * bw < S; q++) {
    const t = 0.75 + rnd() * 0.35
    x.fillStyle = `rgb(${96 * t | 0},${66 * t | 0},${40 * t | 0})`
    if (vertical) x.fillRect(q * bw, 0, bw - 1, S); else x.fillRect(0, q * bw, S, bw - 1)
    x.strokeStyle = 'rgba(40,24,12,0.35)'; x.lineWidth = 1
    for (let g = 0; g < 4; g++) {
      const o = q * bw + 2 + rnd() * (bw - 4)
      x.beginPath(); if (vertical) { x.moveTo(o, 0); x.lineTo(o + (rnd() - 0.5) * 3, S) } else { x.moveTo(0, o); x.lineTo(S, o + (rnd() - 0.5) * 3) } x.stroke()
    }
    x.fillStyle = 'rgba(10,6,2,0.8)'
    if (vertical) x.fillRect(q * bw + bw - 1, 0, 1, S); else x.fillRect(0, q * bw + bw - 1, S, 1)
  }
  return c
}

export function makeBasaltFace(w, h, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d'), rnd = seeded(seed), nz = wrapNoise(rnd, 6, 6)
  let u = 0
  while (u < w) {
    let cw = 18 + rnd() * 22; if (w - u - cw < 12) cw = w - u
    const t = 0.7 + rnd() * 0.4
    const g = x.createLinearGradient(u, 0, u + cw, 0)
    g.addColorStop(0, `rgb(${70 * t | 0},${72 * t | 0},${78 * t | 0})`); g.addColorStop(0.5, `rgb(${56 * t | 0},${58 * t | 0},${62 * t | 0})`); g.addColorStop(1, `rgb(${34 * t | 0},${35 * t | 0},${38 * t | 0})`)
    x.fillStyle = g; x.fillRect(u, 0, cw, h)
    x.fillStyle = 'rgba(8,8,10,0.85)'; x.fillRect(u + cw - 1.5, 0, 1.5, h)
    for (let v = rnd() * 60; v < h; v += 40 + rnd() * 70) { x.fillStyle = 'rgba(10,10,12,0.7)'; x.fillRect(u, v, cw, 1.2) }
    u += cw
  }
  const img = x.getImageData(0, 0, w, h), d = img.data
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = 0.85 + 0.3 * nz(i / w, j / h), o = (j * w + i) * 4; d[o] *= k; d[o + 1] *= k; d[o + 2] *= k }
  x.putImageData(img, 0, 0)
  return c
}

// what each material puts underfoot and in its faces; tops of its walls; side faces' flat colour
export function makeMaterials(ATLAS, TP, FACE_PX, hewnFloor, hewnFace) {
  return {
    r: { floor: hewnFloor, face: hewnFace, top: [40, 39, 42], side: [76, 74, 76] },
    c: { floor: makeFloorAtlas(ATLAS, TP, 13, false), face: makeRockTexture(FACE_PX * 4, FACE_PX * 2, [86, 82, 78], 3), top: [34, 32, 32], side: [70, 66, 62] },
    m: { floor: makeFlagstones(ATLAS, TP, 5), face: mossify(makeBlockTexture(FACE_PX * 4, 160, 7), 3, 0.95), top: [118, 112, 100], side: [104, 100, 92] },
    b: { floor: makeBasaltFloor(ATLAS, TP, 6), face: makeBasaltFace(FACE_PX * 4, FACE_PX * 4, 9), top: [44, 46, 50], side: [52, 54, 58] },
    w: { floor: makePlanks(ATLAS, TP, 4), face: makePlanks(4, FACE_PX, 8, true), top: [70, 50, 32], side: [70, 50, 32] },
    d: { floor: makeFloorAtlas(ATLAS, TP, 17, false), face: makeDrystone(FACE_PX * 4, FACE_PX * 2, 23), top: [46, 44, 40], side: [72, 68, 60] },
    o: { floor: makeFloorAtlas(ATLAS, TP, 19, false), face: makeOrthostats(FACE_PX * 4, FACE_PX * 2, 29), top: [40, 40, 38], side: [70, 70, 66] },
  }
}

// ── set pieces ────────────────────────────────────────────────────────────────
// a torch in a bracket on a wall: the flame breathes; its light is one of the map's lights
export function drawTorch(h, ctx, p) {
  const at = h._P(p.x, p.y, p.z), base = h._P(p.x, p.y, p.z - 0.45)
  if (!at || !base) return
  const k = h._k(p.y), t = h.t + p.n * 1.7
  ctx.save()
  ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = Math.max(2, k * 0.06)
  ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(at.x, at.y + k * 0.05); ctx.stroke()
  ctx.globalCompositeOperation = 'lighter'
  const glow = ctx.createRadialGradient(at.x, at.y - k * 0.1, 0, at.x, at.y - k * 0.1, k * 0.9)
  glow.addColorStop(0, 'rgba(255,170,80,0.45)'); glow.addColorStop(1, 'rgba(255,120,40,0)')
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(at.x, at.y - k * 0.1, k * 0.9, 0, Math.PI * 2); ctx.fill()
  const fl = 1 + 0.15 * Math.sin(t * 9) + 0.1 * Math.sin(t * 23)
  ctx.fillStyle = 'rgba(255,150,50,0.85)'
  ctx.beginPath(); ctx.ellipse(at.x, at.y - k * 0.12 * fl, k * 0.07, k * 0.16 * fl, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,240,190,0.95)'
  ctx.beginPath(); ctx.ellipse(at.x, at.y - k * 0.07, k * 0.035, k * 0.08 * fl, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// a shaft of light from far above, onto the floor at (x, y, z0): a pale cone, a pool where it lands, dust in it
export function drawShaft(h, ctx, p) {
  const z1 = p.z1 ?? p.z0 + 14, w = p.w ?? 1.2, w0 = w * 0.55
  const a = h._P(p.x - w0, p.y, z1), b = h._P(p.x + w0, p.y, z1), c = h._P(p.x + w, p.y, p.z0), d = h._P(p.x - w, p.y, p.z0)
  if (!a || !b || !c || !d) return
  const col = p.rgb || [230, 240, 200]
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  const g = ctx.createLinearGradient(0, a.y, 0, d.y)
  g.addColorStop(0, `rgba(${col},0.0)`); g.addColorStop(0.25, `rgba(${col},0.10)`); g.addColorStop(1, `rgba(${col},0.22)`)
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill()
  const m = h._P(p.x, p.y, p.z0), k = h._k(p.y)
  const pool = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, w * k * 1.3)
  pool.addColorStop(0, `rgba(${col},0.35)`); pool.addColorStop(1, `rgba(${col},0)`)
  ctx.fillStyle = pool; ctx.beginPath(); ctx.ellipse(m.x, m.y, w * k * 1.3, w * k * 0.6, 0, 0, Math.PI * 2); ctx.fill()
  for (let q = 0; q < 40; q++) {
    const hh = hash(q * 7919 + p.n * 31)
    const u = ((hh & 1023) / 1023 - 0.5) * 2, zz = p.z0 + (((hh >> 10) & 1023) / 1023 * (z1 - p.z0) * 0.6 + h.t * 0.15) % ((z1 - p.z0) * 0.6)
    const ww = w0 + (w - w0) * (1 - (zz - p.z0) / (z1 - p.z0))
    const pt = h._P(p.x + u * ww * 0.8, p.y, zz)
    if (!pt) continue
    ctx.fillStyle = `rgba(${col},${(0.25 + 0.5 * ((hh >> 20) & 15) / 15).toFixed(2)})`
    ctx.fillRect(pt.x, pt.y, 1.5, 1.5)
  }
  ctx.restore()
}

// a stalagmite (or, down: true, a stalactite hanging from z): a rough cone, lit on the side toward the light
export function drawMite(h, ctx, p) {
  const k = h._k(p.y)
  if (!k) return
  const zb = p.z, zt = p.down ? p.z - p.h : p.z + p.h
  const L = h.lightAt(p.x, p.y + 0.3, (zb + zt) / 2, h._i(Math.floor(p.x), Math.floor(p.y + 0.6)))
  const tone = p.tone || [96, 90, 84]
  const sx = (h.hash ? 0 : 0) + ((hash(p.n * 131) & 255) / 255 - 0.5) * p.r * 0.6
  const A = h._P(p.x - p.r, p.y, zb), B = h._P(p.x + p.r, p.y, zb), T = h._P(p.x + sx, p.y, zt), M = h._P(p.x + sx * 0.4, p.y, zb)
  if (!A || !B || !T || !M) return
  const lit = (f) => `rgb(${clamp01(L[0] * f) * tone[0] | 0},${clamp01(L[1] * f) * tone[1] | 0},${clamp01(L[2] * f) * tone[2] | 0})`
  ctx.fillStyle = lit(1.25); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo((A.x + T.x) / 2 - k * p.r * 0.15, (A.y + T.y) / 2, T.x, T.y); ctx.lineTo(M.x, M.y); ctx.closePath(); ctx.fill()
  ctx.fillStyle = lit(0.7); ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.quadraticCurveTo((B.x + T.x) / 2 + k * p.r * 0.15, (B.y + T.y) / 2, T.x, T.y); ctx.lineTo(M.x, M.y); ctx.closePath(); ctx.fill()
}

// a box: a chest, a table, an altar, a crate (x, y its middle; w across, d deep, h tall)
export function drawBox(h, ctx, p) {
  const { x, y, z } = p, w = p.w ?? 0.6, d = p.d ?? 0.4, ht = p.h ?? 0.4
  const x0 = x - w / 2, x1 = x + w / 2, y0 = y - d / 2, y1 = y + d / 2
  const L = h.lightAt(x, y1 + 0.05, z + ht / 2, h._i(Math.floor(x), Math.floor(y1 + 0.1)))
  const col = p.col || [110, 76, 44]
  const f = (m) => `rgb(${clamp01(L[0] * m) * col[0] | 0},${clamp01(L[1] * m) * col[1] | 0},${clamp01(L[2] * m) * col[2] | 0})`
  const P = (a, b, c) => h._P(a, b, c)
  const quad = (pts, style) => { if (pts.some(q => !q)) return; ctx.fillStyle = style; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const q of pts) ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.fill() }
  const camX = h.cam.col
  if (camX > x1) quad([P(x1, y0, z + ht), P(x1, y1, z + ht), P(x1, y1, z), P(x1, y0, z)], f(0.75))
  if (camX < x0) quad([P(x0, y0, z + ht), P(x0, y1, z + ht), P(x0, y1, z), P(x0, y0, z)], f(0.75))
  quad([P(x0, y1, z + ht), P(x1, y1, z + ht), P(x1, y1, z), P(x0, y1, z)], f(1.0))
  quad([P(x0, y0, z + ht), P(x1, y0, z + ht), P(x1, y1, z + ht), P(x0, y1, z + ht)], f(1.35))
  if (p.kind === 'basin') {
    const m = P(x, y, z + ht), k = h._k(y)
    if (m) { ctx.fillStyle = p.inner || 'rgba(14,12,10,0.85)'; ctx.beginPath(); ctx.ellipse(m.x, m.y, k * w * 0.36, k * d * 0.3, 0, 0, Math.PI * 2); ctx.fill() }
  }
  if (p.kind === 'chest') {
    const band = (t) => quad([P(x0, y1, z + ht * t), P(x1, y1, z + ht * t), P(x1, y1, z + ht * t - 0.05), P(x0, y1, z + ht * t - 0.05)], `rgba(20,16,12,0.8)`)
    band(0.95); band(0.55); band(0.2)
    const lk = P(x, y1, z + ht * 0.6)
    if (lk) {
      const b = Math.max(L[0], L[1], L[2]), k = h._k(y1)
      ctx.fillStyle = `rgb(${220 * clamp01(b * 1.5) | 0},${180 * clamp01(b * 1.5) | 0},${70 * clamp01(b * 1.5) | 0})`; ctx.fillRect(lk.x - k * 0.04, lk.y - k * 0.03, k * 0.08, k * 0.07)
    }
  }
}

// a pillar of dry stone: rough slabs laid one on another, each a little off the one under it, narrowing as it goes up and
// a broad stone on top (x, y its foot's middle; z its foot; h about how tall; w about how wide; seed which stones)
const PAT = new Map()
export function drawPillar(h, ctx, p) {
  if (!p._s) {
    const R = (i) => hash(i * 7919 + (p.seed || 1) * 104729) / 4294967296 - 0.5, ht = p.h ?? 2.6, w = p.w ?? 1.1, out = []
    let z = p.z || 0, i = 0
    while (z < ht + (p.z || 0) - 0.2) {
      const f = (z - (p.z || 0)) / ht, top = z + 0.36 > ht + (p.z || 0) - 0.2
      const sw = top ? w * 1.02 : w * (1 - f * 0.22) + R(i) * 0.22, sd = top ? w * 0.9 : w * 0.82 * (1 - f * 0.2) + R(i + 50) * 0.16
      const sh = top ? 0.34 : (p.big ? 0.4 + (R(i + 90) + 0.5) * 0.16 : 0.26 + (R(i + 90) + 0.5) * 0.2)
      const co = p.cb && z > (p.cz ?? 99) ? (out.filter(o => o.z > p.cz).length + 1) * (p.cstep ?? 0.17) : 0          // corbelled: each course out over the way
      const jg = p.big ? 0.4 : 1
      out.push({ x: p.x + R(i + 130) * (co ? 0.08 : 0.24) * jg + (co ? p.cb[0] * co : 0), y: p.y + R(i + 170) * (co ? 0.06 : 0.14) * jg + (co ? p.cb[1] * co : 0), z, w: sw, d: sd, h: sh, t: 0.84 + R(i + 210) * 0.32, j: top ? -1 : 0.3 + (R(i + 250) + 0.5) * 0.4, t2: 0.84 + R(i + 290) * 0.32 }); z += sh; i++
    }
    p._s = out
  }
  const col = p.tex ? (p.tint || [235, 240, 255]) : (p.col || [104, 110, 122]), camX = h.cam.col
  const P = (a, b, c) => h._P(a, b, c)
  // (p.tex: each face cut from the floor's own picture, a piece of it as big as the face, then lit and shaded)
  const TPx = h.base ? h.base.width / h.W : 32, FA = h.floorArt?.rect
  let src = null
  const quad = (pts, style) => {
    if (pts.some(q => !q)) return
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const q of pts) ctx.lineTo(q.x, q.y); ctx.closePath()
    if (!src || !p.tex || !h.base) { ctx.fillStyle = style; ctx.fill(); return }
    ctx.save(); ctx.clip()
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const q of pts) { a = Math.min(a, q.x); b = Math.min(b, q.y); c = Math.max(c, q.x); d = Math.max(d, q.y) }
    const key = src.join(',')
    if (!PAT.has(key)) { const cv = document.createElement('canvas'); cv.width = Math.max(1, src[2] | 0); cv.height = Math.max(1, src[3] | 0); cv.getContext('2d').drawImage(h.base, src[0], src[1], src[2], src[3], 0, 0, cv.width, cv.height); PAT.set(key, ctx.createPattern(cv, 'repeat')) }
    const pt = PAT.get(key), ks = h._k(p.y) / TPx
    if (pt.setTransform) pt.setTransform(new DOMMatrix([ks, 0, 0, ks, pts[0].x, pts[0].y]))
    ctx.fillStyle = pt; ctx.fillRect(a, b, c - a, d - b)
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = style; ctx.fillRect(a, b, c - a, d - b)
    ctx.restore()
  }
  const lw = Math.max(1, h._k(p.y) * 0.012)
  let si = 0
  const cut = h._pRow != null && p.y > h._pRow + 1 ? (h.pz ?? 0) + 0.9 : Infinity        // between you and the eye: cut down, as the rock is
  for (const s of p._s) {
    if (s.z >= cut) break
    if (p.tex && FA) {                                                 // where in the floor's picture this slab's face comes from
      const u = hash(si * 131 + (p.seed || 1) * 977) / 4294967296, v = hash(si * 733 + (p.seed || 1) * 31) / 4294967296
      const A = h.floorArt, an = u * Math.PI * 2, rr = A.rx + A.g0 + 2 + v * 5          // (out in the floor's rings, between the pool and the walls)
      src = [Math.max(FA[0] + 1, Math.min(FA[2] - 2, A.cx + Math.cos(an) * rr)) * TPx, Math.max(FA[1] + 1, Math.min(FA[3] - 2, A.cy + Math.sin(an) * rr * 0.8)) * TPx, Math.max(0.3, s.w) * TPx, Math.max(0.2, s.h) * TPx * 1.4]
    }
    si++
    const x0 = s.x - s.w / 2, x1 = s.x + s.w / 2, y0 = s.y - s.d / 2, y1 = s.y + s.d / 2, zt = s.z + s.h
    const L = h.lightAt(s.x, y1 + 0.1, s.z + s.h / 2, -1), f = (m) => `rgb(${clamp01(L[0] * m * s.t) * col[0] | 0},${clamp01(L[1] * m * s.t) * col[1] | 0},${clamp01(L[2] * m * s.t) * col[2] | 0})`
    if (camX > x1) quad([P(x1, y0, zt), P(x1, y1, zt), P(x1, y1, s.z), P(x1, y0, s.z)], f(0.62))
    if (camX < x0) quad([P(x0, y0, zt), P(x0, y1, zt), P(x0, y1, s.z), P(x0, y0, s.z)], f(0.62))
    quad([P(x0, y1, zt), P(x1, y1, zt), P(x1, y1, s.z), P(x0, y1, s.z)], f(0.9))
    if (s.j > 0) {                                                       // two stones in the course, the joint between them
      const xj = x0 + s.w * s.j, g = (m) => f(m * s.t2 / s.t)
      quad([P(xj, y1, zt), P(x1, y1, zt), P(x1, y1, s.z), P(xj, y1, s.z)], g(0.9))
      const u = P(xj, y1, zt), v = P(xj, y1, s.z)
      if (u && v) { ctx.strokeStyle = 'rgba(6,8,12,0.6)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y); ctx.stroke() }
    }
    quad([P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt)], f(1.2))
    const a = P(x0, y1, s.z), b = P(x1, y1, s.z)                       // the seam under it
    if (a && b) { ctx.strokeStyle = 'rgba(6,8,12,0.7)'; ctx.lineWidth = lw * 1.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
    const c = P(x0, y1, zt), d = P(x1, y1, zt)                          // and the worn edge of its top
    if (c && d) { ctx.strokeStyle = 'rgba(225,232,245,0.14)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke() }
  }
}

// { type: 'doorway', x, y (the face it is cut in, looking south), z (its sill), w, h }: a door into the dark under the
// floor. Its mouth corbelled to a point (the jambs' slabs go over its edges); inside, steps going on down, fainter and
// fainter; in its head the teeth of a portcullis, raised.
export function drawDoorway(h, ctx, p) {
  const { x, y, z } = p, w = p.w ?? 1.5, ht = p.h ?? 2.5, k = h._k(y); if (!k) return
  const pts = [[x - w / 2, z], [x - w / 2, z + ht * 0.55]]
  for (let i = 1; i <= 4; i++) pts.push([x - w / 2 + i * w * 0.11, z + ht * 0.55 + i * ht * 0.11])
  pts.push([x, z + ht])
  for (let i = 4; i >= 1; i--) pts.push([x + w / 2 - i * w * 0.11, z + ht * 0.55 + i * ht * 0.11])
  pts.push([x + w / 2, z + ht * 0.55], [x + w / 2, z])
  const S = pts.map(([a, b]) => h._P(a, y, b)); if (S.some(q => !q)) return
  ctx.save(); ctx.beginPath(); S.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath()
  ctx.fillStyle = '#010102'; ctx.fill(); ctx.clip()
  // the steps inside: each further in and lower, narrower, dimmer
  const L = h.lightAt(x, y + 0.6, z + 0.5, -1), v = Math.max(0.15, Math.max(L[0], L[1], L[2]))
  for (let i = 0; i < 6; i++) {
    const yy = y - 0.18 - i * 0.32, zz = z - i * 0.26, a = h._P(x - w / 2 + 0.08, yy, zz), b = h._P(x + w / 2 - 0.08, yy, zz)
    if (!a || !b) continue
    const al = 0.5 * v * Math.pow(0.62, i)
    ctx.strokeStyle = `rgba(150,160,180,${al.toFixed(3)})`; ctx.lineWidth = Math.max(1, k * 0.02); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    const c = h._P(x - w / 2 + 0.08, yy, zz - 0.26), d = h._P(x + w / 2 - 0.08, yy, zz - 0.26)
    if (c && d) { ctx.fillStyle = `rgba(40,44,52,${(al * 0.9).toFixed(3)})`; ctx.fillRect(Math.min(a.x, c.x), a.y, Math.abs(b.x - a.x), Math.max(1, c.y - a.y)) }
  }
  // the portcullis, drawn up into the head: its bars and their points hanging into the opening
  const bars = 7, zb = z + ht * 0.66
  ctx.lineCap = 'butt'
  for (let i = 0; i < bars; i++) {
    const bx = x - w / 2 + w * (i + 0.5) / bars, top = h._P(bx, y + 0.02, z + ht), bot = h._P(bx, y + 0.02, zb - (i % 2) * 0.06)
    if (!top || !bot) continue
    ctx.strokeStyle = `rgb(${26 + 30 * v | 0},${24 + 28 * v | 0},${24 + 26 * v | 0})`; ctx.lineWidth = Math.max(1.5, k * 0.05); ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke()
    const tip = h._P(bx, y + 0.02, zb - (i % 2) * 0.06 - 0.16)
    if (tip) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(bot.x - k * 0.035, bot.y); ctx.lineTo(bot.x + k * 0.035, bot.y); ctx.lineTo(tip.x, tip.y); ctx.closePath(); ctx.fill() }
    ctx.strokeStyle = `rgba(200,205,215,${(0.12 * v).toFixed(3)})`; ctx.lineWidth = Math.max(1, k * 0.012); ctx.beginPath(); ctx.moveTo(top.x - k * 0.015, top.y); ctx.lineTo(bot.x - k * 0.015, bot.y); ctx.stroke()
  }
  for (const zz of [zb + 0.12, zb + 0.55]) { const a = h._P(x - w / 2, y + 0.02, zz), b = h._P(x + w / 2, y + 0.02, zz); if (a && b) { ctx.strokeStyle = `rgb(${24 + 26 * v | 0},${22 + 24 * v | 0},${22 + 22 * v | 0})`; ctx.lineWidth = Math.max(1.5, k * 0.04); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() } }
  ctx.restore()
}

// A sprite lit to a brightness: made once per frame of the sheet and step of light, then kept. (A canvas
// filter per draw is far too slow on a busy screen: a hall of folk went from 36 ms to 9 without it.)
const LIT = new Map(), IDS = new WeakMap()
let nextId = 0
export function litSprite(img, sx, sy, sw, sh, b, ghost = false, alpha = 0.55, tone = null) {
  const step = ghost ? -1 : Math.max(1, Math.min(14, Math.round(Math.min(1.4, b * 1.5) * 10)))
  if (!IDS.has(img)) IDS.set(img, ++nextId)
  const key = `${IDS.get(img)}|${sx},${sy},${sw},${sh}|${step}|${ghost ? alpha : ''}|${tone || ''}`
  let c = LIT.get(key)
  if (c) return c
  c = document.createElement('canvas'); c.width = sw; c.height = sh
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false
  x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  const d = x.getImageData(0, 0, sw, sh), a = d.data
  for (let o = 0; o < a.length; o += 4) {
    if (ghost) {
      const g = (a[o] * 0.3 + a[o + 1] * 0.59 + a[o + 2] * 0.11)
      for (let q = 0; q < 3; q++) a[o + q] = Math.min(255, (a[o + q] * 0.3 + g * 0.7) * 1.5)
      a[o + 3] = a[o + 3] * alpha
    } else if (tone) {                      // carved: the figure in stone of this colour, its shapes kept by their lightness
      const g = (a[o] * 0.3 + a[o + 1] * 0.59 + a[o + 2] * 0.11) / 255, v = (0.35 + 0.9 * g) * step / 10
      for (let q = 0; q < 3; q++) a[o + q] = Math.min(255, tone[q] * v)
    } else for (let q = 0; q < 3; q++) a[o + q] = Math.min(255, a[o + q] * step / 10)
  }
  x.putImageData(d, 0, 0)
  LIT.set(key, c)
  return c
}

// a sprite from the world sheet (a chest, a throne, a weapons rack, a coffin...), standing up
export function drawSprite(h, ctx, p) {
  const sc = h.scene, tex = sc.textures?.get('oryxTiles')
  if (!tex || tex.key === '__MISSING') return
  const img = tex.getSourceImage(), C = h.pgr.constructor
  const idx = p.gid - 1, col = idx % C.SHEET_COLS, row = Math.floor(idx / C.SHEET_COLS)
  const at = h._P(p.x, p.y, p.z)
  if (!at) return
  const k = h._k(p.y), s = k * (p.s ?? 0.9)
  const L = h.lightAt(p.x, p.y + 0.1, p.z + 0.4, h._i(Math.floor(p.x), Math.floor(p.y + 0.2)))
  const b = Math.max(L[0], L[1], L[2])
  if (b < 0.02) return
  ctx.save(); ctx.imageSmoothingEnabled = false
  ctx.drawImage(litSprite(img, C.MG + col * C.TW, C.MG + row * C.TH, C.TW, C.TH, b), at.x - s / 2, at.y - s, s, s)
  ctx.restore()
}

// a masonry arch across a passage, on the line y between x0 and x1: piers, a round head, voussoirs
export function drawArch(h, ctx, p) {
  const { x0, x1, y, z0 } = p, zs = p.zs ?? z0 + 1.6, zt = p.zt ?? zs + 1.4, pier = p.pier ?? 0.35
  const k = h._k(y)
  if (!k) return
  const P = (a, c) => h._P(a, y, c)
  const ox0 = x0 + pier, ox1 = x1 - pier, cx = (ox0 + ox1) / 2, rad = (ox1 - ox0) / 2
  const pts = [P(x0, zt), P(x1, zt), P(x1, z0), P(ox1, z0), P(ox1, zs)]
  for (let q = 0; q <= 16; q++) { const a = Math.PI * q / 16; pts.push(P(cx + rad * Math.cos(a), zs + rad * Math.sin(a) * 0.95)) }
  pts.push(P(ox0, zs), P(ox0, z0), P(x0, z0))
  if (pts.some(q => !q)) return
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const q of pts) ctx.lineTo(q.x, q.y); ctx.closePath() }
  ctx.save()
  path(); ctx.clip()
  const pat = h._pattern(ctx, 'm'), s = k / h.FACE_PX
  pat.setTransform?.(new DOMMatrix([s, 0, 0, s, h.cam.sw / 2 - h.cam.col * k, h._Y(y, 0)]))
  ctx.fillStyle = pat; ctx.fillRect(0, 0, h.cam.sw, h.cam.sh)
  const oc = h._i(Math.floor(cx), Math.floor(y + 0.1))
  const Lb = h.lightAt(cx, y + 0.05, z0 + 0.3, oc), Lt = h.lightAt(cx, y + 0.05, zt, oc)
  const gr = ctx.createLinearGradient(0, P(cx, z0).y, 0, P(cx, zt).y)
  gr.addColorStop(0, h._rgb(Lb)); gr.addColorStop(1, h._rgb(Lt))
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gr; ctx.fillRect(0, 0, h.cam.sw, h.cam.sh)
  ctx.globalCompositeOperation = 'source-over'
  // voussoirs: joints radiating from the arch's middle, and the ring's outer line
  ctx.strokeStyle = 'rgba(8,6,4,0.7)'; ctx.lineWidth = Math.max(1, k * 0.015)
  for (let q = 1; q < 9; q++) {
    const a = Math.PI * q / 9, i0 = P(cx + rad * Math.cos(a), zs + rad * Math.sin(a) * 0.95), i1 = P(cx + (rad + 0.4) * Math.cos(a), zs + (rad + 0.4) * Math.sin(a) * 0.95)
    ctx.beginPath(); ctx.moveTo(i0.x, i0.y); ctx.lineTo(i1.x, i1.y); ctx.stroke()
  }
  ctx.beginPath()
  for (let q = 0; q <= 16; q++) { const a = Math.PI * q / 16, pt = P(cx + (rad + 0.4) * Math.cos(a), zs + (rad + 0.4) * Math.sin(a) * 0.95); q ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y) }
  ctx.stroke()
  ctx.restore()
  h._polys.push({ pts: [pts[0], pts[1], pts[2], pts[pts.length - 1]], r: Math.floor(y), walk: false })
}

// a hexagonal column (Clochán na bhFómhórach): top at z, down to base; faces toward the camera, then its top
export function drawHex(h, ctx, c) {
  const r = c.r ?? 0.5, zt = c.z, zb = c.base ?? zt - 4
  const V = []
  for (let q = 0; q < 6; q++) { const a = q * Math.PI / 3 + (c.rot ?? 0); V.push([c.x + r * Math.cos(a), c.y + r * Math.sin(a) * 1.0]) }
  const eye = [h.cam.col, h.cam.row + h.cam.FL]
  const faces = []
  for (let q = 0; q < 6; q++) {
    const A = V[q], B = V[(q + 1) % 6], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2
    const nx = mx - c.x, ny = my - c.y
    if ((eye[0] - mx) * nx + (eye[1] - my) * ny <= 0) continue
    faces.push({ A, B, mx, my, nx, ny, d: Math.hypot(eye[0] - mx, eye[1] - my) })
  }
  faces.sort((a, b) => b.d - a.d)
  const tone = c.tone || [64, 66, 72]
  for (const f of faces) {
    const pa = h._P(f.A[0], f.A[1], zt), pb = h._P(f.B[0], f.B[1], zt), pc = h._P(f.B[0], f.B[1], zb), pd = h._P(f.A[0], f.A[1], zb)
    if (!pa || !pb || !pc || !pd) continue
    const n = Math.hypot(f.nx, f.ny), key = 0.7 + 0.3 * ((-f.nx * 0.5 + f.ny * 0.85) / n)
    const oc = h._i(Math.floor(f.mx + f.nx * 0.3), Math.floor(f.my + f.ny * 0.3))
    const Lt = h.lightAt(f.mx, f.my, zt - 0.2, oc), Lb = h.lightAt(f.mx, f.my, Math.max(zb, zt - 2.5), oc)
    const g = ctx.createLinearGradient(0, pa.y, 0, Math.max(pd.y, pa.y + 1))
    const col = (L) => `rgb(${clamp01(L[0] * key) * tone[0] * 1.2 | 0},${clamp01(L[1] * key) * tone[1] * 1.2 | 0},${clamp01(L[2] * key) * tone[2] * 1.2 | 0})`
    g.addColorStop(0, col(Lt)); g.addColorStop(1, col(Lb))
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.lineTo(pc.x, pc.y); ctx.lineTo(pd.x, pd.y); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = 'rgba(6,6,8,0.7)'; ctx.lineWidth = 1; ctx.stroke()
    if (c.lichen) {
      const hh = hash(Math.round(f.mx * 97) + Math.round(f.my * 131))
      for (let q = 0; q < 5; q++) {
        const t = ((hh >> (q * 3)) & 7) / 7, zz = zt - 0.1 - ((hh >> (q * 5 + 2)) & 7) / 7 * 0.8
        const pt = h._P(f.A[0] + (f.B[0] - f.A[0]) * t, f.A[1] + (f.B[1] - f.A[1]) * t, zz)
        if (!pt) continue
        const b = Math.max(Lt[0], Lt[1])
        ctx.fillStyle = `rgba(${200 * b | 0},${160 * b | 0},${40 * b | 0},0.75)`
        ctx.beginPath(); ctx.ellipse(pt.x, pt.y, h._k(f.my) * 0.06, h._k(f.my) * 0.04, 0, 0, Math.PI * 2); ctx.fill()
      }
    }
  }
  const top = V.map(([x, y]) => h._P(x, y, zt))
  if (top.some(q => !q)) return
  const oc = h._i(Math.floor(c.x), Math.floor(c.y))
  const L = h.lightAt(c.x, c.y, zt + 0.1, oc)
  const nn = (hash(Math.round(c.x * 31) * 7 + Math.round(c.y * 17)) & 255) / 255
  ctx.fillStyle = `rgb(${clamp01(L[0] * 1.15) * tone[0] * (0.95 + 0.25 * nn) | 0},${clamp01(L[1] * 1.15) * tone[1] * (0.95 + 0.25 * nn) | 0},${clamp01(L[2] * 1.15) * tone[2] * (0.95 + 0.25 * nn) | 0})`
  ctx.beginPath(); ctx.moveTo(top[0].x, top[0].y); for (const q of top) ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(10,10,12,0.8)'; ctx.lineWidth = 1; ctx.stroke()
  if (c.pool) {
    const m = h._P(c.x, c.y, zt), k = h._k(c.y)
    ctx.fillStyle = `rgba(${40 + 60 * L[0] | 0},${50 + 70 * L[1] | 0},${55 + 80 * L[2] | 0},0.9)`
    ctx.beginPath(); ctx.ellipse(m.x, m.y, k * r * 0.45, k * r * 0.25, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = `rgba(255,255,255,${(0.25 * Math.max(L[0], L[1], L[2])).toFixed(2)})`
    ctx.beginPath(); ctx.ellipse(m.x - k * r * 0.12, m.y - k * r * 0.07, k * r * 0.15, k * r * 0.05, 0, 0, Math.PI * 2); ctx.fill()
  }
  h._polys.push({ pts: [top[0], top[1], top[3], top[4]], r: Math.floor(c.y), walk: false })
}

// stone dripping from a lip into the void: tapering strands hanging under the edge, catching the light
export function drawDrips(h, ctx, c, r, zt, x0, x1) {
  const k = h._k(r + 1)
  if (!k) return
  const L = h.lightAt(c + 0.5, r + 1.05, zt - 0.3, h._i(c, r + 1))
  const b = Math.max(L[0], L[1], L[2])
  if (b < 0.02) return
  for (let q = 0; q < 7; q++) {
    const hh = hash(c * 7919 + r * 104729 + q * 31)
    const u = c + (q + 0.2 + ((hh & 255) / 255) * 0.6) / 7, len = 0.3 + ((hh >> 8) & 255) / 255 * 1.6, wd = 0.05 + ((hh >> 16) & 15) / 15 * 0.07
    const a = h._P(u - wd, r + 1.01, zt), bb = h._P(u + wd, r + 1.01, zt), t = h._P(u, r + 1.01, zt - len)
    if (!a || !bb || !t) continue
    const g = ctx.createLinearGradient(0, a.y, 0, t.y)
    g.addColorStop(0, `rgba(${110 * L[0] | 0},${105 * L[1] | 0},${100 * L[2] | 0},1)`); g.addColorStop(1, `rgba(${40 * L[0] | 0},${38 * L[1] | 0},${36 * L[2] | 0},0)`)
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bb.x, bb.y); ctx.lineTo(t.x, t.y); ctx.closePath(); ctx.fill()
  }
}

// ── second round: the Otherworld set ──────────────────────────────────────────
// drystone (d): thin flat stones laid in rough courses, dark gaps between
export function makeDrystone(w, h, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d'), rnd = seeded(seed)
  x.fillStyle = '#0c0b0a'; x.fillRect(0, 0, w, h)
  let y = h
  while (y > 0) {
    const ch = 7 + rnd() * 9; y -= ch
    let u = -rnd() * 30
    while (u < w) {
      const sw = 14 + rnd() * 34, tone = 0.7 + rnd() * 0.45
      const r0 = 92 * tone, g0 = 86 * tone, b0 = 76 * tone
      for (const off of [-w, 0, w]) {
        x.fillStyle = `rgb(${r0 | 0},${g0 | 0},${b0 | 0})`
        x.beginPath(); x.ellipse(u + off + sw / 2, y + ch / 2, sw / 2 - 1, ch / 2 - 0.8, (rnd() - 0.5) * 0.08, 0, Math.PI * 2); x.fill()
        x.fillStyle = 'rgba(255,250,235,0.08)'; x.fillRect(u + off + 3, y + 1.5, sw - 6, 1.2)
      }
      u += sw + 1 + rnd() * 2
    }
  }
  return c
}

// orthostats (o): big upright slabs side by side, some pecked with spirals and lozenges
export function makeOrthostats(w, h, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d'), rnd = seeded(seed)
  x.fillStyle = '#0a0908'; x.fillRect(0, 0, w, h)
  let u = 0
  while (u < w) {
    const sw = Math.min(w - u, 46 + rnd() * 40), tone = 0.75 + rnd() * 0.35
    const g = x.createLinearGradient(u, 0, u + sw, 0)
    g.addColorStop(0, `rgb(${70 * tone | 0},${70 * tone | 0},${66 * tone | 0})`); g.addColorStop(0.5, `rgb(${98 * tone | 0},${96 * tone | 0},${90 * tone | 0})`); g.addColorStop(1, `rgb(${64 * tone | 0},${62 * tone | 0},${60 * tone | 0})`)
    x.fillStyle = g
    x.beginPath(); x.moveTo(u + 2, h); x.lineTo(u + 3 + rnd() * 4, 6 + rnd() * 14); x.lineTo(u + sw - 4 - rnd() * 4, 4 + rnd() * 14); x.lineTo(u + sw - 2, h); x.closePath(); x.fill()
    for (let q = 0; q < sw * h / 60; q++) { x.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(200,200,190,0.06)'; x.fillRect(u + rnd() * sw, rnd() * h, 1 + rnd() * 2, 1) }
    if (rnd() < 0.45) {
      // pecked decoration: a spiral, or a band of lozenges
      x.strokeStyle = 'rgba(190,185,170,0.32)'; x.lineWidth = 1.6; x.setLineDash([2, 1.5])
      const cx = u + sw / 2, cy = h * (0.3 + rnd() * 0.3)
      if (rnd() < 0.6) { x.beginPath(); for (let a = 0; a < Math.PI * 7; a += 0.2) { const rr = 1 + a * 1.2; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) } x.stroke() }
      else { x.beginPath(); for (let q = 0; q < 3; q++) { const yy = cy + q * 14; x.moveTo(cx - 12, yy); x.lineTo(cx, yy - 7); x.lineTo(cx + 12, yy); x.lineTo(cx, yy + 7); x.closePath() } x.stroke() }
      x.setLineDash([])
    }
    u += sw
  }
  return c
}

// the oryx creatures: someone (or something) standing there, two frames of breathing.
// c, r: column and row on the sheet; s: size (tiles); ghost: pale and see-through; glow: a halo;
// stone: [r, g, b] -- a statue: carved in stone of that colour, still (no breathing), lit as stone is
let CREATURES = null
function creatures() {
  if (!CREATURES) { CREATURES = new Image(); CREATURES.src = '/assets/oryx/oryx_16bit_fantasy_creatures_trans.png' }
  return CREATURES.complete && CREATURES.naturalWidth ? CREATURES : null
}
creatures()
export function drawMob(h, ctx, p) {
  const img = creatures(); if (!img) return
  const at = h._P(p.x, p.y, p.z); if (!at) return
  const k = h._k(p.y), s = k * (p.s ?? 0.85)
  const L = h.lightAt(p.x, p.y + 0.1, p.z + 0.5, h._i(Math.floor(p.x), Math.floor(p.y + 0.2)))
  let b = Math.max(L[0], L[1], L[2])
  if (p.ghost) b = Math.max(b, 0.7)
  if (b < 0.03) return
  const fr = Math.floor(h.t * (p.rate ?? 1.6) + (p.n % 7) * 0.37) % 2
  const bob = p.float != null ? Math.sin(h.t * 1.3 + p.n) * k * 0.08 - k * p.float : 0
  ctx.save(); ctx.imageSmoothingEnabled = false
  if (p.glow) {
    ctx.globalCompositeOperation = 'lighter'
    const R = s * (p.float != null ? 1.1 : 0.7), A = p.float != null ? 0.35 : 0.14
    const gg = ctx.createRadialGradient(at.x, at.y - s * 0.5 + bob, 0, at.x, at.y - s * 0.5 + bob, R)
    gg.addColorStop(0, `rgba(${p.glow},${A})`); gg.addColorStop(1, `rgba(${p.glow},0)`)
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(at.x, at.y - s * 0.5 + bob, R, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }
  if (!p.ghost && p.float == null) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(at.x, at.y, s * 0.3, s * 0.08, 0, 0, Math.PI * 2); ctx.fill()
  }
  if (p.flip) { ctx.translate(at.x, 0); ctx.scale(-1, 1); ctx.translate(-at.x, 0) }
  ctx.drawImage(litSprite(img, 24 + p.c * 24, 24 + (p.stone ? p.r : p.r + fr) * 24, 24, 24, b, !!p.ghost, p.alpha ?? 0.55, p.stone || null), at.x - s / 2, at.y - s + bob, s, s)
  ctx.restore()
}

// ogham on a stone: a stem (the stone's edge) and its notches, cut into the face that looks south (plane y).
// Vertical from z0 up to z1 at x, or horiz (along a lintel) from x0 to x1 at z. glow: lit from within.
export function drawOgham(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  const L = h.lightAt(p.horiz ? (p.x0 + p.x1) / 2 : p.x, p.y + 0.05, p.horiz ? p.z : (p.z0 + p.z1) / 2, h._i(Math.floor(p.x ?? p.x0), Math.floor(p.y + 0.1)))
  const b = Math.max(L[0], L[1], L[2])
  const col = p.glow ? `rgba(${p.glow},${(0.6 + 0.3 * Math.sin(h.t * 1.7 + p.n)).toFixed(2)})` : `rgba(${215 * clamp01(b * 1.3) | 0},${205 * clamp01(b * 1.3) | 0},${180 * clamp01(b * 1.3) | 0},0.85)`
  if (!p.glow && b < 0.05) return
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, k * 0.022); ctx.lineCap = 'round'
  if (p.glow) { ctx.shadowColor = `rgb(${p.glow})`; ctx.shadowBlur = k * 0.15 }
  const len = p.horiz ? p.x1 - p.x0 : p.z1 - p.z0
  const at = (u, off) => p.horiz ? h._P(p.x0 + u, p.y, p.z + off) : h._P(p.x + off, p.y, p.z0 + u)
  const a0 = at(0, 0), a1 = at(len, 0)
  if (!a0 || !a1) { ctx.restore(); return }
  ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke()
  // letters: groups of one to five notches -- to one side, the other, across, or slanting
  let u = 0.12, q = 0
  while (u < len - 0.1) {
    const hh = hash(p.n * 977 + q * 131 + 7), kind = hh & 3, cnt = 1 + ((hh >> 2) % 5), sp = 0.055
    for (let m = 0; m < cnt && u < len - 0.05; m++, u += sp) {
      const w = 0.1
      const [o0, o1, sk] = kind === 0 ? [0, w, 0] : kind === 1 ? [-w, 0, 0] : kind === 2 ? [-w, w, 0] : [-w, w, 0.06]
      const e0 = at(u - sk, o0), e1 = at(u + sk, o1)
      if (!e0 || !e1) continue
      ctx.beginPath(); ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.stroke()
    }
    u += 0.09; q++
  }
  ctx.restore()
}

// a spiral (or the triple spiral, tri: true) pecked into the face that looks south (plane y), round (x, z), radius rad
export function drawSpiral(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  const L = h.lightAt(p.x, p.y + 0.05, p.z, h._i(Math.floor(p.x), Math.floor(p.y + 0.1)))
  const b = Math.max(L[0], L[1], L[2])
  if (!p.glow && b < 0.04) return
  ctx.save(); ctx.lineWidth = Math.max(1, k * 0.03); ctx.lineCap = 'round'
  ctx.strokeStyle = p.glow ? `rgba(${p.glow},${(0.55 + 0.25 * Math.sin(h.t * 0.9)).toFixed(2)})` : `rgba(${210 * clamp01(b * 1.3) | 0},${200 * clamp01(b * 1.3) | 0},${175 * clamp01(b * 1.3) | 0},0.8)`
  if (p.glow) { ctx.shadowColor = `rgb(${p.glow})`; ctx.shadowBlur = k * 0.2 }
  ctx.setLineDash([k * 0.03, k * 0.02])
  const one = (cx, cz, rad, rot, dir) => {
    ctx.beginPath()
    for (let a = 0; a <= Math.PI * 6; a += 0.15) {
      const rr = rad * (1 - a / (Math.PI * 6)), aa = rot + dir * a
      const pt = h._P(cx + Math.cos(aa) * rr, p.y, cz + Math.sin(aa) * rr)
      if (pt) a ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)
    }
    ctx.stroke()
  }
  const rad = p.rad ?? 0.4
  if (p.tri) for (let q = 0; q < 3; q++) { const a = Math.PI / 2 + q * Math.PI * 2 / 3; one(p.x + Math.cos(a) * rad, p.z + Math.sin(a) * rad, rad * 0.95, a + Math.PI, 1) }
  else one(p.x, p.z, rad, 0, 1)
  ctx.restore()
}

// eyes in the dark: pairs that shine, blink, go out and come back, scattered over the face plane y,
// from x0 to x1 and z0 to z1 (or one pair at x, z). rgb their colour
export function drawEyes(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  const n = p.count ?? 1, col = p.rgb || [170, 255, 120]
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  for (let q = 0; q < n; q++) {
    const hh = hash(p.n * 7919 + q * 104729)
    const x = n > 1 ? p.x0 + ((hh & 1023) / 1023) * (p.x1 - p.x0) : p.x
    const z = n > 1 ? p.z0 + (((hh >> 10) & 1023) / 1023) * (p.z1 - p.z0) : p.z
    const ph = h.t * (0.15 + ((hh >> 20) & 15) / 60) + (hh & 255) / 40
    const on = Math.sin(ph * Math.PI * 2)
    if (on < -0.2) continue
    const blink = (Math.sin(h.t * 3 + q * 2.3) > 0.97) ? 0.15 : 1
    const a = h._P(x, p.y, z); if (!a) continue
    const sep = k * (p.sep ?? 0.12), r = Math.max(1.4, k * 0.035), al = Math.min(1, on + 0.2)
    const hg = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, sep * 1.6)
    hg.addColorStop(0, `rgba(${col},${(0.22 * al).toFixed(2)})`); hg.addColorStop(1, `rgba(${col},0)`)
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(a.x, a.y, sep * 1.6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = `rgba(${col},${(0.95 * al).toFixed(2)})`
    for (const sx of [-sep / 2, sep / 2]) { ctx.beginPath(); ctx.ellipse(a.x + sx, a.y, r * 1.3, r * blink, 0, 0, Math.PI * 2); ctx.fill() }
  }
  ctx.restore()
}

// roots hanging from the roof over x0..x1, y0..y1, from z down (len up to dz), swaying; nuts on some (nuts: true)
export function drawRoots(h, ctx, p) {
  const n = p.count ?? 40
  ctx.save()
  for (let q = 0; q < n; q++) {
    const hh = hash(p.n * 31 + q * 7919)
    const x = p.x0 + ((hh & 1023) / 1023) * (p.x1 - p.x0), y = p.y0 + (((hh >> 10) & 1023) / 1023) * (p.y1 - p.y0)
    if (Math.floor(y) !== p.row) continue
    // shorter toward the edges of the patch (a canopy, longest in the middle), unless p.even
    const ex = Math.hypot((x - (p.x0 + p.x1) / 2) / ((p.x1 - p.x0) / 2 || 1), (y - (p.y0 + p.y1) / 2) / ((p.y1 - p.y0) / 2 || 1))
    const shape = p.even ? 1 : 1 - 0.62 * Math.min(1, ex * ex)
    const len = p.dz * (0.35 + ((hh >> 20) & 255) / 255 * 0.65) * shape, k = h._k(y)
    const L = h.lightAt(x, y, p.z - len, h._i(Math.floor(x), Math.floor(y)))
    const b = Math.max(L[0], L[1], L[2]); if (b < 0.03) continue
    const sw = Math.sin(h.t * 0.7 + q) * 0.06
    ctx.strokeStyle = `rgb(${clamp01(L[0] * 1.2) * 110 | 0},${clamp01(L[1] * 1.2) * 84 | 0},${clamp01(L[2] * 1.2) * 56 | 0})`
    ctx.lineWidth = Math.max(1, k * 0.035 * (1 + (hh & 3) / 3))
    // the line of it, top to bottom; its top fades into the dark it comes out of (unless p.hard): drawn in three
    // pieces, faint, half, whole
    const pts = []
    for (let s = 0; s <= 8; s++) {
      const t = s / 8, pt = h._P(x + Math.sin(t * 5 + q) * 0.06 + sw * t * t, y, p.z - len * t)
      if (pt) pts.push(pt)
    }
    if (pts.length < 2) continue
    const parts = p.hard ? [[0, 8, 1]] : [[0, 2, 0.12], [2, 4, 0.5], [4, 8, 1]]
    for (const [i0, i1, al] of parts) {
      if (i1 >= pts.length) continue
      ctx.globalAlpha = al
      ctx.beginPath(); ctx.moveTo(pts[i0].x, pts[i0].y)
      for (let i = i0 + 1; i <= Math.min(i1, pts.length - 1); i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    if (p.nuts && (hh & 3) === 0) {
      const pt = h._P(x + sw, y, p.z - len)
      if (pt) { ctx.fillStyle = `rgb(${clamp01(b * 1.4) * 230 | 0},${clamp01(b * 1.4) * 170 | 0},${clamp01(b * 1.4) * 60 | 0})`; ctx.beginPath(); ctx.arc(pt.x, pt.y + k * 0.03, Math.max(1.5, k * 0.04), 0, Math.PI * 2); ctx.fill() }
    }
  }
  ctx.restore()
}

// mist lying over x0..x1 at height z in the row it's drawn in: slow soft billows
export function drawMist(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  const col = p.rgb || [200, 210, 220], n = p.count ?? 6
  ctx.save(); ctx.globalCompositeOperation = 'screen'
  for (let q = 0; q < n; q++) {
    const hh = hash(p.n * 131 + q * 977)
    if (p.pulse) {                                                    // a breath: rising out of the dark now and then, thinning away
      const u = ((h.t + (p.ph || 0) * p.pulse / 6 + q * 1.3) / p.pulse) % 1, b = Math.sin(Math.PI * Math.min(1, u * 1.6)) ** 2
      if (b < 0.02) continue
      const x = (p.x0 + p.x1) / 2 + (((hh & 1023) / 1023) - 0.5) * (p.x1 - p.x0) * 0.6, a = h._P(x, p.y + 0.5, p.z + u * 1.2); if (!a) continue
      const rx = k * (0.7 + u * 0.9), g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, rx)
      g.addColorStop(0, `rgba(${col},${((p.a ?? 0.12) * b).toFixed(3)})`); g.addColorStop(1, `rgba(${col},0)`)
      ctx.fillStyle = g; ctx.save(); ctx.translate(a.x, a.y); ctx.scale(1, 0.45); ctx.translate(-a.x, -a.y)
      ctx.beginPath(); ctx.arc(a.x, a.y, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      continue
    }
    const x = p.x0 + (((hh & 1023) / 1023) * (p.x1 - p.x0) + h.t * (0.08 + (hh >> 12 & 7) / 60)) % (p.x1 - p.x0)
    const a = h._P(x, p.y + 0.5, p.z + 0.15); if (!a) continue
    const rx = k * (0.9 + ((hh >> 16) & 7) / 7), ry = rx * 0.32
    const g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, rx)
    g.addColorStop(0, `rgba(${col},${(p.a ?? 0.12).toFixed(2)})`); g.addColorStop(1, `rgba(${col},0)`)
    ctx.fillStyle = g; ctx.save(); ctx.translate(a.x, a.y); ctx.scale(1, ry / rx); ctx.translate(-a.x, -a.y)
    ctx.beginPath(); ctx.arc(a.x, a.y, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
  ctx.restore()
}

// fish in a pool round (x, y) radius rad at z: a silver-pink back that turns in the water; now and then a flash
export function drawFish(h, ctx, p) {
  const n = p.count ?? 3
  ctx.save()
  for (let q = 0; q < n; q++) {
    // each fish lives in rounds of its own length: mostly down in the dark, unseen; once a round it rises somewhere,
    // its nose breaks the surface (a ring spreads, and a nut floating there is gone), and it sinks away again
    const per = 11 + q * 3.7, T = h.t + q * 4.1, round = Math.floor(T / per), u = (T % per) / per
    const hh = hash(round * 7919 + q * 104729 + (p.n || 0) * 31)
    const ang = ((hh & 1023) / 1023) * Math.PI * 2, rr = p.rad * (0.15 + 0.7 * (((hh >> 10) & 1023) / 1023))
    const sx = p.x + Math.cos(ang) * rr, sy = p.y + Math.sin(ang) * rr * (p.ry ? p.ry / p.rad : 0.9)
    const UP = 0.55, TOP = 0.66, DOWN = 0.8
    let depth = 1                                            // 1: deep (unseen), 0: at the surface
    if (u >= UP && u < TOP) depth = 1 - (u - UP) / (TOP - UP)
    else if (u >= TOP && u < TOP + 0.03) depth = 0
    else if (u >= TOP + 0.03 && u < DOWN) depth = (u - TOP - 0.03) / (DOWN - TOP - 0.03)
    const dir = ang + Math.PI / 2 + (q % 2 ? Math.PI : 0)
    const drift = (1 - depth) * 0.5
    const x = sx - Math.cos(dir) * drift * 0.6, y = sy - Math.sin(dir) * drift * 0.6
    if (Math.floor(y) === p.row && depth < 0.98) {
      const vis = Math.pow(1 - depth, 1.4)
      const at = h._P(x, y, p.z - 0.05 - depth * 0.9), k = h._k(y)
      if (at) {
        ctx.save(); ctx.translate(at.x, at.y); ctx.scale(1, 0.45); ctx.rotate(Math.atan2(Math.sin(dir), Math.cos(dir)))
        const fc = p.rgb || [222, 220, 212]
        ctx.fillStyle = `rgba(${fc},${(0.9 * vis).toFixed(3)})`
        ctx.beginPath(); ctx.ellipse(0, 0, k * 0.24, k * 0.065, 0, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.moveTo(-k * 0.22, 0); ctx.lineTo(-k * 0.33, -k * 0.065); ctx.lineTo(-k * 0.33, k * 0.065); ctx.closePath(); ctx.fill()
        ctx.restore()
      }
    }
    // the ring where its nose broke the surface, spreading for a while after
    const br = (u - TOP) * per / 2.4
    if (br >= 0 && br < 1 && Math.floor(sy) === p.row) {
      const c0 = h._P(sx, sy, p.z), c1 = h._P(sx + 1, sy, p.z), c2 = h._P(sx, sy + 1, p.z)
      if (c0 && c1 && c2) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        for (const [lag, al] of [[0, 0.75], [0.22, 0.4]]) {
          const b2 = br - lag; if (b2 <= 0) continue
          const rad = 0.06 + 0.7 * b2, a = (1 - b2) * al
          ctx.strokeStyle = `rgba(225,235,245,${a.toFixed(3)})`; ctx.lineWidth = Math.max(1, h._k(sy) * 0.016)
          ctx.beginPath(); ctx.ellipse(c0.x, c0.y, Math.abs(c1.x - c0.x) * rad, Math.abs(c2.y - c0.y) * rad, 0, 0, Math.PI * 2); ctx.stroke()
        }
        ctx.restore()
      }
    }
    // a hazelnut floating where it will come up, until it does
    if (p.nuts && u > 0.15 && u < TOP && Math.floor(sy) === p.row) {
      const pt = h._P(sx + Math.sin(h.t * 0.4 + q) * 0.05, sy, p.z), k = h._k(sy)
      if (pt) { ctx.fillStyle = 'rgba(205,150,60,0.9)'; ctx.beginPath(); ctx.ellipse(pt.x, pt.y, Math.max(1.5, k * 0.045), Math.max(1, k * 0.03), 0, 0, Math.PI * 2); ctx.fill() }
    }
  }
  ctx.restore()
}

// a great eye in the wall that looks south (plane y), round (x, z): lids w across, open a fraction that breathes
export function drawEye(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  const w = p.w ?? 4, open = Math.max(0.04, (p.open ?? 0.3) + 0.06 * Math.sin(h.t * 0.6))
  const P = (u, v) => h._P(p.x + u, p.y, p.z + v)
  const c = P(0, 0); if (!c) return
  const W = k * w / 2, Hh = k * w * 0.32
  h._eyeOpen = open
  ctx.save()
  // the socket: a dark bulge of stone
  const sk = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, W * 1.25)
  sk.addColorStop(0, 'rgba(0,0,0,0.85)'); sk.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = sk; ctx.beginPath(); ctx.ellipse(c.x, c.y, W * 1.25, Hh * 1.4, 0, 0, Math.PI * 2); ctx.fill()
  // the eye itself, between the lids
  ctx.beginPath(); ctx.moveTo(c.x - W, c.y)
  ctx.quadraticCurveTo(c.x, c.y - Hh * 2 * open, c.x + W, c.y); ctx.quadraticCurveTo(c.x, c.y + Hh * 2 * open, c.x - W, c.y); ctx.closePath()
  ctx.save(); ctx.clip()
  const ball = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, W)
  ball.addColorStop(0, 'rgb(255,230,160)'); ball.addColorStop(0.18, 'rgb(255,90,30)'); ball.addColorStop(0.34, 'rgb(150,10,10)'); ball.addColorStop(0.36, 'rgb(40,6,6)'); ball.addColorStop(1, 'rgb(90,40,30)')
  ctx.fillStyle = ball; ctx.fillRect(c.x - W, c.y - Hh, W * 2, Hh * 2)
  ctx.fillStyle = 'rgb(10,0,0)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, W * 0.05, Hh * 0.9, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // lids: heavy, wrinkled
  ctx.strokeStyle = 'rgba(30,22,20,0.9)'; ctx.lineWidth = Math.max(2, k * 0.08)
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(c.x - W, c.y); ctx.quadraticCurveTo(c.x, c.y + s * Hh * 2 * open, c.x + W, c.y); ctx.stroke() }
  ctx.strokeStyle = 'rgba(20,14,12,0.6)'; ctx.lineWidth = Math.max(1, k * 0.03)
  for (let q = 1; q <= 3; q++) { ctx.beginPath(); ctx.moveTo(c.x - W * (1 - q * 0.12), c.y - Hh * 0.2); ctx.quadraticCurveTo(c.x, c.y - Hh * 2 * open - q * k * 0.18, c.x + W * (1 - q * 0.12), c.y - Hh * 0.2); ctx.stroke() }
  // its glare
  ctx.globalCompositeOperation = 'lighter'
  const gl = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, W * 1.6)
  gl.addColorStop(0, `rgba(255,60,20,${(0.35 * open / 0.3).toFixed(2)})`); gl.addColorStop(1, 'rgba(255,30,10,0)')
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(c.x, c.y, W * 1.6, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// a light lying along the floor (a sunbeam down a passage, an eye's gaze): x0..x1, y0..y1 at z, in the row drawn
export function drawStreak(h, ctx, p) {
  const r = p.row, ya = Math.max(p.y0, r), yb = Math.min(p.y1, r + 1)
  if (yb <= ya) return
  const a = h._P(p.x0, ya, p.z), b = h._P(p.x1, ya, p.z), c = h._P(p.x1, yb, p.z), d = h._P(p.x0, yb, p.z)
  if (!a || !b || !c || !d) return
  const fl = p.flicker ? 0.8 + 0.2 * Math.sin(h.t * 4 + r) : 1
  const t0 = (ya - p.y0) / (p.y1 - p.y0), t1 = (yb - p.y0) / (p.y1 - p.y0)
  const al = (t) => (p.a ?? 0.4) * fl * (p.fade === 'north' ? 1 - t * 0.6 : p.fade === 'south' ? 0.4 + t * 0.6 : 1)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  const g = ctx.createLinearGradient(0, a.y, 0, d.y)
  g.addColorStop(0, `rgba(${p.rgb},${al(t0).toFixed(3)})`); g.addColorStop(1, `rgba(${p.rgb},${al(t1).toFixed(3)})`)
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill()
  ctx.restore()
}

// a cauldron at (x, y, z): a black-iron belly, a rim, steam rising; a fire under it if fire: true
export function drawCauldron(h, ctx, p) {
  const k = h._k(p.y), at = h._P(p.x, p.y, p.z); if (!at) return
  const r = (p.r ?? 0.45) * k
  const L = h.lightAt(p.x, p.y + 0.4, p.z + 0.4, h._i(Math.floor(p.x), Math.floor(p.y + 0.5)))
  const b = Math.max(L[0], L[1], L[2])
  ctx.save()
  const body = ctx.createRadialGradient(at.x - r * 0.3, at.y - r * 0.9, 0, at.x, at.y - r * 0.6, r * 1.2)
  body.addColorStop(0, `rgb(${70 * clamp01(b * 1.3) + 20 | 0},${60 * clamp01(b * 1.2) + 18 | 0},${50 * clamp01(b) + 16 | 0})`); body.addColorStop(1, 'rgb(10,9,8)')
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(at.x, at.y - r * 0.6, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgb(16,14,12)'; ctx.beginPath(); ctx.ellipse(at.x, at.y - r * 1.2, r * 0.82, r * 0.22, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = p.brew ? `rgba(${p.brew},0.9)` : 'rgba(150,120,70,0.9)'; ctx.beginPath(); ctx.ellipse(at.x, at.y - r * 1.18, r * 0.7, r * 0.16, 0, 0, Math.PI * 2); ctx.fill()
  ctx.globalCompositeOperation = 'screen'
  for (let q = 0; q < 7; q++) {
    const t = ((h.t * 0.3 + q / 7) % 1), sx = Math.sin(h.t + q * 2) * r * 0.4 * t
    ctx.fillStyle = `rgba(220,220,210,${(0.18 * (1 - t)).toFixed(3)})`
    ctx.beginPath(); ctx.arc(at.x + sx, at.y - r * 1.2 - t * k * 1.4, r * (0.25 + t * 0.5), 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

// candles: a cluster of n at (x, y, z), spread w; little flames
export function drawCandles(h, ctx, p) {
  const n = p.count ?? 5
  ctx.save()
  for (let q = 0; q < n; q++) {
    const hh = hash(p.n * 31 + q * 17)
    const x = p.x + (((hh & 255) / 255) - 0.5) * (p.w ?? 0.6), y = p.y + ((((hh >> 8) & 255) / 255) - 0.5) * 0.25
    const ht = 0.12 + ((hh >> 16) & 15) / 15 * 0.22
    const a = h._P(x, y, p.z), t = h._P(x, y, p.z + ht), k = h._k(y)
    if (!a || !t) continue
    ctx.fillStyle = 'rgb(225,215,185)'; ctx.fillRect(t.x - k * 0.018, t.y, k * 0.036, a.y - t.y)
    const fl = 1 + 0.2 * Math.sin(h.t * 11 + q * 3)
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = 'rgba(255,190,90,0.25)'; ctx.beginPath(); ctx.arc(t.x, t.y - k * 0.04, k * 0.12, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,230,160,0.95)'; ctx.beginPath(); ctx.ellipse(t.x, t.y - k * 0.035 * fl, k * 0.014, k * 0.035 * fl, 0, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.restore()
}

// ── screen grades ─────────────────────────────────────────────────────────────
// The picture drawn again in big pixels, and (with a palette) in a few colours, dithered: a dream, the
// Immortal's teal, an etching, a malevolent place. hw.grade = { palette, px, strength, source, follow }:
//   palette  'teal' | 'ember' | 'etch' | null (just big pixels: cheap, no reading back of pixels)
//   px       how big a pixel is, in screen points (3)
//   strength 0..1 how much of it shows everywhere (1)
//   source   { x, y, r }: it grows to full strength as you come within r tiles of (x, y)
//   follow   'eye': and it breathes with the great eye's lid (drawEye)
const PALETTES = {
  teal: [[0, 0, 0], [10, 26, 30], [18, 52, 58], [30, 88, 92], [60, 130, 128], [110, 170, 160], [170, 200, 180], [230, 225, 200],
    [120, 70, 40], [200, 120, 60], [250, 190, 110], [60, 40, 40], [40, 44, 60], [80, 84, 96], [140, 140, 150], [255, 255, 255]],
  ember: [[0, 0, 0], [18, 6, 6], [40, 10, 8], [72, 14, 10], [112, 22, 12], [160, 36, 16], [210, 64, 22], [250, 110, 36],
    [255, 170, 80], [255, 225, 160], [28, 22, 24], [56, 46, 46], [92, 82, 78], [140, 128, 118], [24, 30, 44], [60, 70, 96]],
}
const ETCH = [[26, 22, 18], [74, 66, 54], [140, 130, 112], [201, 190, 166], [239, 230, 210]]
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5)

export function gradeStrength(h, g) {
  let s = g.strength ?? 1
  if (g.source) {
    const p = h.scene.player, ts = h.scene.tileSize
    if (p) {
      const d = Math.hypot(p.logicalX / ts - g.source.x, p.logicalY / ts - g.source.y)
      s = Math.max(s, 1 - d / g.source.r)
    }
  }
  if (g.follow === 'eye' && h._eyeOpen != null) s *= Math.min(1, 0.35 + h._eyeOpen * 2.6)
  return Math.max(0, Math.min(1, s))
}

export function applyGrade(h, canvas, g, strength) {
  if (!canvas || strength <= 0.02) return
  const W = canvas.width, H = canvas.height
  const scale = W / (h.cam.sw || W), px = Math.max(1, (g.px ?? 3) * scale)
  const w = Math.max(1, Math.ceil(W / px)), ht = Math.max(1, Math.ceil(H / px))
  const key = canvas === h.xc ? '_gradeX' : '_gradeG'
  let s = h[key]
  if (!s || s.width !== w || s.height !== ht) { s = h[key] = document.createElement('canvas'); s.width = w; s.height = ht }
  const sc = s.getContext('2d', { willReadFrequently: !!g.palette })
  sc.clearRect(0, 0, w, ht); sc.imageSmoothingEnabled = true
  sc.drawImage(canvas, 0, 0, w, ht)
  if (g.palette) {
    const img = sc.getImageData(0, 0, w, ht), d = img.data
    const pal = PALETTES[g.palette], spread = g.palette === 'etch' ? 0.25 : 48
    for (let y = 0; y < ht; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      if (d[o + 3] < 8) continue
      if (d[o] + d[o + 1] + d[o + 2] < 14) { const c = pal ? pal[0] : ETCH[0]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; continue }
      const b = BAYER[(y & 3) * 4 + (x & 3)]
      if (!pal) {
        // etching: one warm ink, by brightness, in five steps
        const L = (0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2]) / 255
        const q = ETCH[Math.max(0, Math.min(4, Math.round(L * 4 * 1.2 + b * 1.4)))]
        d[o] = q[0]; d[o + 1] = q[1]; d[o + 2] = q[2]
        continue
      }
      const r = d[o] + b * spread, gg = d[o + 1] + b * spread, bb = d[o + 2] + b * spread
      let best = 0, bd = 1e9
      for (let n = 0; n < pal.length; n++) {
        const c = pal[n], dr = r - c[0], dg = gg - c[1], db = bb - c[2], e = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11
        if (e < bd) { bd = e; best = n }
      }
      const c = pal[best]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]
    }
    sc.putImageData(img, 0, 0)
  }
  const ctx = canvas.getContext('2d')
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false
  if (strength >= 0.98) { ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1 } else ctx.globalAlpha = strength
  ctx.drawImage(s, 0, 0, w, ht, 0, 0, w * px, ht * px)
  ctx.restore()
}


// ── the escape's antechamber (tools/map-editor/generators/escape_gen.mjs) ─────────────────────────────

// steps, crafted: the front edge of every step from row y0 to y1, x0..x1, caught by the light (a pale line along its
// nose, a dark one under it). Over several rows (MULTI in hewnRock.js): each row's slice is its own step.
export function drawSteps(h, ctx, p) {
  const r = p.row
  const za = h.walkZ(Math.floor(p.x0 + 0.5), r), zb = h.walkZ(Math.floor(p.x0 + 0.5), r + 1)
  if (za == null || zb == null || za <= zb + 0.02) return
  const a = h._P(p.x0, r + 1, za), b = h._P(p.x1, r + 1, za), c = h._P(p.x0, r + 1, za - 0.05), d = h._P(p.x1, r + 1, za - 0.05)
  if (!a || !b || !c || !d) return
  const L = h.lightAt((p.x0 + p.x1) / 2, r + 1.02, za, h._i(Math.floor((p.x0 + p.x1) / 2), r + 1))
  const v = Math.max(L[0], L[1], L[2]); if (v < 0.03) return
  const k = h._k(r + 1)
  ctx.save(); ctx.lineCap = 'butt'
  ctx.strokeStyle = `rgba(${clamp01(L[0] * 1.5) * 235 | 0},${clamp01(L[1] * 1.5) * 228 | 0},${clamp01(L[2] * 1.5) * 210 | 0},0.85)`
  ctx.lineWidth = Math.max(1, k * 0.028); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = Math.max(1, k * 0.04)
  ctx.beginPath(); ctx.moveTo(c.x, c.y + k * 0.02); ctx.lineTo(d.x, d.y + k * 0.02); ctx.stroke()
  ctx.restore()
}

// an iron grille in the plane y, x0..x1, z0..z1: bars, and two rails across (water goes under a gate through it)
export function drawGrille(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  const L = h.lightAt((p.x0 + p.x1) / 2, p.y + 0.2, (p.z0 + p.z1) / 2, h._i(Math.floor((p.x0 + p.x1) / 2), Math.floor(p.y)))
  const v = Math.max(0.12, Math.max(L[0], L[1], L[2]))
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.55)'                     // the dark of the culvert behind the bars
  const q0 = h._P(p.x0, p.y, p.z0), q1 = h._P(p.x1, p.y, p.z1); if (q0 && q1) ctx.fillRect(q0.x, q1.y, q1.x - q0.x, q0.y - q1.y)
  ctx.strokeStyle = `rgb(${46 * v + 20 | 0},${44 * v + 19 | 0},${42 * v + 18 | 0})`; ctx.lineWidth = Math.max(1.5, k * 0.045); ctx.lineCap = 'round'
  const n = Math.max(3, Math.round((p.x1 - p.x0) * 5))
  for (let i = 0; i <= n; i++) {
    const x = p.x0 + (p.x1 - p.x0) * i / n, a = h._P(x, p.y, p.z0), b = h._P(x, p.y, p.z1)
    if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
  }
  for (const z of [p.z0 + (p.z1 - p.z0) * 0.3, p.z1 - 0.05]) {
    const a = h._P(p.x0, p.y, z), b = h._P(p.x1, p.y, z)
    if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
  }
  ctx.restore()
}

// a sigil cut into a wall that looks south (plane y), centred (x, z), r its half-size, glowing rgb:
//   'mound'  a burial mound and its dark door, the sun's three rays over it      (Tech Duinn)
//   'spiral' three spirals joined                                                (the hollow hills)
//   'eye'    an eye, half-lidded                                                 (the Fomorian edge)
//   'wave'   three waves one over another                                        (Tethra's court)
export function drawSigil(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  const c = h._P(p.x, p.y, p.z); if (!c) return
  const R = (p.r ?? 0.7) * k, col = p.rgb || [230, 220, 190]
  const br = 0.7 + 0.3 * Math.sin(h.t * 1.1 + (p.n || 0))
  ctx.save()
  ctx.translate(c.x, c.y); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (p.plane === 'x') ctx.scale(0.22 * (p.flip ? -1 : 1), 1)      // on a wall seen side-on (east or west): squeezed to a sliver
  // cut first, dark; then the light in the cut
  const pass = (style, w, blur) => {
    ctx.strokeStyle = style; ctx.lineWidth = w; ctx.shadowBlur = blur; ctx.shadowColor = `rgba(${col},0.9)`
    ctx.beginPath(); SIGILS[p.kind]?.(ctx, R, h.t); ctx.stroke()
  }
  pass('rgba(0,0,0,0.6)', Math.max(2.5, R * 0.16), 0)
  ctx.globalCompositeOperation = 'lighter'
  pass(`rgba(${col},${(0.75 * br).toFixed(3)})`, Math.max(1.2, R * 0.07), R * 0.35)
  ctx.restore()
}
export const SIGILS = {
  mound(ctx, R) {
    ctx.moveTo(-R, R * 0.45); ctx.quadraticCurveTo(0, -R * 0.75, R, R * 0.45); ctx.lineTo(-R, R * 0.45)
    ctx.moveTo(-R * 0.18, R * 0.45); ctx.lineTo(-R * 0.18, R * 0.12); ctx.lineTo(R * 0.18, R * 0.12); ctx.lineTo(R * 0.18, R * 0.45)
    for (const a of [-0.5, 0, 0.5]) { const ux = Math.sin(a), uy = -Math.cos(a); ctx.moveTo(ux * R * 0.62, -R * 0.22 + uy * R * 0.25); ctx.lineTo(ux * R * 0.95, -R * 0.22 + uy * R * 0.62) }
  },
  spiral(ctx, R) {
    const one = (cx, cy, rr, rot) => { for (let t = 0; t <= 1.001; t += 0.04) { const a = rot + t * Math.PI * 4, q = rr * (0.12 + 0.88 * t); const x = cx + Math.cos(a) * q, y = cy + Math.sin(a) * q; t ? ctx.lineTo(x, y) : ctx.moveTo(x, y) } }
    one(-R * 0.48, R * 0.28, R * 0.45, 0); one(R * 0.48, R * 0.28, R * 0.45, Math.PI); one(0, -R * 0.5, R * 0.45, Math.PI / 2)
  },
  eye(ctx, R, t) {
    const o = 0.32 + 0.06 * Math.sin(t * 0.5)
    ctx.moveTo(-R, 0); ctx.quadraticCurveTo(0, -R * o * 2.2, R, 0); ctx.quadraticCurveTo(0, R * o * 2.2, -R, 0)
    ctx.moveTo(R * 0.24, 0); ctx.arc(0, 0, R * 0.24, 0, Math.PI * 2)
  },
  wave(ctx, R) {
    for (const yy of [-0.45, 0, 0.45]) {
      ctx.moveTo(-R, yy * R)
      for (let i = 0; i < 3; i++) { const x0 = -R + i * R * 2 / 3; ctx.bezierCurveTo(x0 + R * 0.12, yy * R - R * 0.32, x0 + R * 0.45, yy * R - R * 0.32, x0 + R * 2 / 3, yy * R) }
    }
  },
}


// ── smooth water over the tile grid ─────────────────────────────────────────────────────────────────
// The tiles are square; a river or a pool is not. These are painted over the floor (whose tiles under them can't be
// walked on: the map's `block`), in the row each part of them is in, just after that row's floor (hewnRock draws
// props with `under` before the faces and the slabs, so walls and bridges go over them).

// a polygon [{x, y, z}] cut to the band of rows y0..y1 (both ends kept), z carried along
function clipBand(poly, y0, y1) {
  const cut = (pts, keep, lim) => {
    const out = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ka = keep(a), kb = keep(b)
      if (ka) out.push(a)
      if (ka !== kb) { const t = (lim - a.y) / (b.y - a.y); out.push({ x: a.x + (b.x - a.x) * t, y: lim, z: a.z + (b.z - a.z) * t }) }
    }
    return out
  }
  return cut(cut(poly, (p) => p.y >= y0, y0), (p) => p.y <= y1, y1)
}
function fillWorld(h, ctx, poly, style) {
  if (poly.length < 3) return
  ctx.beginPath()
  for (let i = 0; i < poly.length; i++) { const q = h._P(poly[i].x, poly[i].y, poly[i].z); if (!q) return; i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y) }
  ctx.closePath(); ctx.fillStyle = style; ctx.fill()
}
// a ribbon round the line pts [[x, y, z]], w wide (a number, or one width per point): its outline
function ribbon(pts, w, k = 1) {
  const L = [], R = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl
    const hw = (Array.isArray(w) ? w[i] : w) * k / 2
    L.push({ x: pts[i][0] - ty * hw, y: pts[i][1] + tx * hw, z: pts[i][2] })
    R.push({ x: pts[i][0] + ty * hw, y: pts[i][1] - tx * hw, z: pts[i][2] })
  }
  return L.concat(R.reverse())
}
const bandRows = (poly) => { let a = Infinity, b = -Infinity; for (const q of poly) { a = Math.min(a, q.y); b = Math.max(b, q.y) } return [Math.floor(a), Math.floor(b)] }

// the lit floor picture as a pattern, laid over a polygon at height z: one mapping for the whole piece (found round
// (x0, y0)), so that a stone or a stream's coping runs on from row to row with no seam between them
function floorPattern(h, ctx, x0, y0, z) {
  if (h._litPatT !== h.t || h._litPatCtx !== ctx) { h._litPat = ctx.createPattern(h.litCv, 'no-repeat'); h._litPatT = h.t; h._litPatCtx = ctx }
  const TPX = h.litCv.width / h.W, a0 = h._P(x0, y0, z), a1 = h._P(x0 + 1, y0, z), a2 = h._P(x0, y0 + 1, z)
  if (!a0 || !a1 || !a2) return null
  const m = [(a1.x - a0.x) / TPX, (a1.y - a0.y) / TPX, (a2.x - a0.x) / TPX, (a2.y - a0.y) / TPX, 0, 0]
  m[4] = a0.x - m[0] * x0 * TPX - m[2] * y0 * TPX; m[5] = a0.y - m[1] * x0 * TPX - m[3] * y0 * TPX
  h._litPat.setTransform?.(new DOMMatrix(m))
  return h._litPat
}
const EPS = 0.16                                     // opaque pieces overlap the next row's by this much: no hairline between them (inner layers by more than outer, so an outer one's soft edge is under the inner)
// a closed line round a ring of world points, only those stretches that reach this row's slice (the rest is clipped away anyway)
const ringPath = (h, ctx, poly, r) => {
  let pen = false
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    if ((a.y < r - 0.4 && b.y < r - 0.4) || (a.y > r + 1.4 && b.y > r + 1.4)) { pen = false; continue }
    const A = h._P(a.x, a.y, a.z), B = h._P(b.x, b.y, b.z); if (!A || !B) { pen = false; continue }
    if (!pen) ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); pen = true
  }
}
const worldPath = (h, ctx, poly) => { let ok = false; poly.forEach((q, i) => { const s = h._P(q.x, q.y, q.z); if (s) { i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); ok = true } }); ctx.closePath(); return ok }

// A river: { type: 'river', pts: [[x, y, z]...] its middle line (dense, smooth), w: width (or one per point) }:
// a coping of dressed stone along each bank, a wet dark lip inside it, the water black and deeper black down its
// middle, and on it the current -- pale flecks drifting downstream, from pts[0] to the end -- and a few stars of light.
export function riverRows(p) {
  if (!p._poly) { p._poly = ribbon(p.pts, p.w); p._edge = ribbon(p.pts, p.w, 1.5); p._lip = ribbon(p.pts, p.w, 1.2); p._deep = ribbon(p.pts, p.w, 0.5)
    let L = 0; p._len = [0]; for (let i = 1; i < p.pts.length; i++) { L += Math.hypot(p.pts[i][0] - p.pts[i - 1][0], p.pts[i][1] - p.pts[i - 1][1]); p._len.push(L) } }
  return bandRows(p._edge)
}
export function drawRiver(h, ctx, p) {
  riverRows(p)
  const r = p.row, mid = p.pts[Math.floor(p.pts.length / 2)]
  const L = h.lightAt(mid[0], r + 0.5, mid[2] + 0.3, h._i(Math.floor(mid[0]), r))
  const lit = Math.min(1, (L[0] + L[1] + L[2]) / 3 * 1.5)
  const band = (poly, e) => clipBand(poly, r - e, r + 1 + e)
  ctx.save()
  const pat = floorPattern(h, ctx, mid[0], mid[1], 0.05)
  if (pat) { ctx.beginPath(); worldPath(h, ctx, band(p._edge, 0.02).map(q => ({ ...q, z: 0.05 }))); ctx.fillStyle = pat; ctx.fill() }
  ctx.beginPath(); worldPath(h, ctx, band(p._lip, 0.1).map(q => ({ ...q, z: 0.02 }))); ctx.fillStyle = `rgb(${14 + 26 * lit | 0},${18 + 30 * lit | 0},${22 + 34 * lit | 0})`; ctx.fill()
  ctx.beginPath(); worldPath(h, ctx, band(p._poly, 0.2)); ctx.fillStyle = `rgb(${5 + 10 * lit | 0},${8 + 14 * lit | 0},${14 + 24 * lit | 0})`; ctx.fill()
  ctx.beginPath(); worldPath(h, ctx, band(p._deep, 0.3)); ctx.fillStyle = `rgb(${3 + 4 * lit | 0},${5 + 7 * lit | 0},${9 + 12 * lit | 0})`; ctx.fill()
  // the current: flecks drifting down it (which way it runs is how you find the way)
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'
  const Lt = p._len[p._len.length - 1], at = (d) => {
    let i = 1; while (i < p._len.length - 1 && p._len[i] < d) i++
    const t = (d - p._len[i - 1]) / ((p._len[i] - p._len[i - 1]) || 1), a = p.pts[i - 1], b = p.pts[i]
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, b[0] - a[0], b[1] - a[1]]
  }
  const n = Math.max(2, Math.round(Lt * 1.3))
  for (let q = 0; q < n; q++) {
    const hh = hash(q * 977 + (p.n || 0) * 13), off = (((hh & 255) / 255) - 0.5) * 0.55
    const d = ((h.t * (p.speed ?? 0.55) + q * Lt / n + ((hh >> 8) & 255) / 255) % Lt)
    const [x, y, z, dx, dy] = at(d)
    const tl = Math.hypot(dx, dy) || 1, nx = -dy / tl, ny = dx / tl
    const fx = x + nx * off * (Array.isArray(p.w) ? 1 : p.w) * 0.5, fy = y + ny * off * (Array.isArray(p.w) ? 1 : p.w) * 0.5
    if (Math.floor(fy) !== r) continue
    const a0 = h._P(fx, fy, z + 0.01), a1 = h._P(fx + dx / tl * 0.22, fy + dy / tl * 0.22, z + 0.01)
    if (!a0 || !a1) continue
    const fade = Math.sin(Math.PI * Math.min(1, d / 1.5, (Lt - d) / 1.5))
    ctx.strokeStyle = `rgba(200,220,240,${(0.22 * fade * (0.5 + lit)).toFixed(3)})`; ctx.lineWidth = Math.max(1, h._k(fy) * 0.018)
    ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke()
  }
  for (let q = 0; q < Math.round(Lt * 0.7); q++) {
    const hh = hash(q * 31337 + (p.n || 0) * 7), tw = Math.sin(h.t * (0.5 + (hh % 7) * 0.13) + (hh & 255)) ** 18
    if (tw < 0.05) continue
    const [x, y, z, dx, dy] = at(((hh >> 8) & 1023) / 1023 * Lt)
    const tl = Math.hypot(dx, dy) || 1, off = ((((hh >> 18) & 255) / 255) - 0.5) * 0.7
    const sx = x - dy / tl * off, sy = y + dx / tl * off
    if (Math.floor(sy) !== r) continue
    const pt = h._P(sx, sy, z + 0.01); if (!pt) continue
    const s = Math.max(1, h._k(sy) * 0.03) * (0.6 + tw)
    ctx.fillStyle = `rgba(255,255,255,${(0.75 * tw).toFixed(3)})`; ctx.fillRect(pt.x - s / 2, pt.y - s / 2, s, s)
  }
  ctx.restore()
}

// ── the salmon ───────────────────────────────────────────────────────────────────────────────────────────────
// Each fish lives in rounds, mostly out of sight in the dark. In its round it comes up out of the deep in a long lazy
// curve, slows, lifts its nose through the surface where a nut floats (rings spread), then with a flick of the tail
// turns and goes down again. Its body is a chain of sixteen links following the path it swam, with a wave running down
// them; each is drawn with the pale flank over the dark back and the darker belly under, fins, eyes, the tail's fork,
// all seen through the water: the deeper, the darker, until the dark has it.
const PATHS = new Map()
const smooth01 = (t) => t * t * (3 - 2 * t)
function spline(P, n) {
  const out = [], segs = P.length - 1
  for (let i = 0; i <= n; i++) {
    const f = i / n * segs, k = Math.min(segs - 1, Math.floor(f)), t = f - k, t2 = t * t, t3 = t2 * t
    const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)]
    out.push([0, 1, 2].map(a => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)))
  }
  return out
}
function fishPath(p, q, round) {
  const key = (p.n || 0) + ':' + q + ':' + round
  let F = PATHS.get(key); if (F) return F
  if (PATHS.size > 60) PATHS.clear()
  const R = (k) => (hash(round * 7919 + q * 104729 + k * 977 + (p.n || 0) * 31) & 0xffff) / 65535
  const a0 = R(0) * Math.PI * 2, dir = R(9) < 0.5 ? 1 : -1, rt = 0.18 + 0.4 * R(1)
  const at = (rad, da, depth) => { const a = a0 + dir * da; return [p.x + Math.cos(a) * p.rx * rad, p.y + Math.sin(a) * p.ry * rad, -depth] }
  const K = [at(0.9, -0.7, 6.2), at(0.82, 0.0, 4.5), at(0.68, 0.7, 2.8), at(rt + 0.14, 1.4, 0.9), at(rt, 1.65, 0.0), at(rt - 0.1, 1.9, 0.5), at(0.6, 2.6, 1.8), at(0.8, 3.5, 3.9), at(0.92, 4.5, 6.2)]
  const N = 220, pts = spline(K, N), len = [0], tm = [0]
  const iT = Math.round(4 / 8 * N)
  for (let i = 1; i <= N; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]))
  const sT = len[iT], V = 0.85
  for (let i = 1; i <= N; i++) { const s = (len[i] + len[i - 1]) / 2, v = V * (1 - 0.6 * Math.exp(-(((s - sT) / 1.1) ** 2))); tm.push(tm[i - 1] + (len[i] - len[i - 1]) / v) }
  F = { pts, len, tm, L: len[N], D: tm[N], iT, sT, tT: tm[iT] }
  PATHS.set(key, F); return F
}
function atS(F, s) {
  s = Math.max(0, Math.min(F.L, s))
  let lo = 0, hi = F.len.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (F.len[m] <= s) lo = m; else hi = m }
  const t = (s - F.len[lo]) / ((F.len[hi] - F.len[lo]) || 1), a = F.pts[lo], b = F.pts[hi]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, b[0] - a[0], b[1] - a[1]]
}
function sAtTime(F, u) {
  if (u <= 0) return 0; if (u >= F.D) return F.L
  let lo = 0, hi = F.tm.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (F.tm[m] <= u) lo = m; else hi = m }
  return F.len[lo] + (F.len[hi] - F.len[lo]) * ((u - F.tm[lo]) / ((F.tm[hi] - F.tm[lo]) || 1))
}
const dimAt = (depth) => 0.1 + 0.9 * Math.pow(Math.max(0, 1 - depth / 7), 1.5)
const mixc = (a, b, t) => `rgb(${a[0] + (b[0] - a[0]) * t | 0},${a[1] + (b[1] - a[1]) * t | 0},${a[2] + (b[2] - a[2]) * t | 0})`

// one frame's fish: lists of screen shapes, made once per frame and drawn through each row's slice of the water
function fishFrame(h, p, surf) {
  if (p._ff && p._ff.t === h.t) return p._ff
  const out = { t: h.t, fish: [], rings: [], nuts: [], falls: [] }
  // you, bumping the pool's edge (hewnRock.bump): a ring or two out from where you pressed
  for (const b of h.bumps || []) { const a = h.t - b.t0; if (a >= 0 && a < 4.5) out.rings.push({ x: b.x, y: b.y, b: a / 4.5, w: 1, two: true, R: 2.0 }) }
  const n = p.fish?.count ?? 3, NB = 16
  for (let q = 0; q < n; q++) {
    const DELAY = 7, per = 44 + q * 9, T = h.t - DELAY + q * 7.3
    if (T < 0) continue
    const round = Math.floor(T / per), u = T - round * per
    const F = fishPath(p, q, round)
    const tTouch = round * per + F.tT - q * 7.3 + DELAY, age = h.t - tTouch
    const nose = F.pts[F.iT]
    if (p.fish?.nuts) {                                           // a nut drops from the roots a while before the fish comes for it
      const uL = Math.max(0.8, F.tT - 7), tFall = round * per - q * 7.3 + DELAY + uL - h.t        // seconds until it lands (negative: it has)
      if (tFall > 0 && tFall < 1.0) out.falls.push({ x: nose[0], y: nose[1], z: surf + 7 * (tFall ** 2) })
      else if (tFall <= 0 && u < F.tT) {
        const s = h._P(nose[0] + Math.sin(h.t * 0.4 + q) * 0.04, nose[1], surf); if (s) out.nuts.push(s)
        if (-tFall < 7.0) out.rings.push({ x: nose[0], y: nose[1], b: -tFall / 7.0, w: 0.8 })        // the splash
      }
    }
    for (const [lag, life, w0] of [[0, 7.5, 1]]) {                                                 // the nose
      const a = age - lag; if (a < 0 || a > life) continue
      const c = lag > 0.9 ? F.pts[Math.min(F.pts.length - 1, F.iT + 14)] : nose
      out.rings.push({ x: c[0], y: c[1], b: a / life, w: w0, two: true })
    }
    if (u > F.D + 1.5) continue
    const BODY = 2.1 + 0.15 * q, seg = BODY / NB, sHead = sAtTime(F, u)
    const bump = Math.exp(-2 * (((u - F.tT - 0.9) / 0.9) ** 2)), amp = 0.1 * (BODY / 1.5) * (1 + 1.7 * bump)
    const ph = 2 * Math.PI * (0.6 * u + 1.4 * 0.9 * Math.sqrt(Math.PI / 8) * Math.tanh(1.7 * ((u - F.tT - 0.9) / 0.9)))
    const sp = []
    let nx0 = 1, ny0 = 0
    for (let i = 0; i <= NB; i++) {
      const f = i / NB, [x, y, z, dx, dy] = atS(F, sHead - i * seg), tl = Math.hypot(dx, dy)
      if (tl > 1e-4) { nx0 = -dy / tl; ny0 = dx / tl }
      const off = amp * (0.12 + 0.88 * Math.pow(f, 1.3)) * Math.sin(ph - f * 5.2)
      sp.push({ x: x + nx0 * off, y: y + ny0 * off, d: -z })
    }
    if (sp[0].d > 9 && sp[NB].d > 9) continue
    const half = (f) => 0.2 * (BODY / 2.1) * (f < 0.3 ? Math.pow(Math.sin(f / 0.3 * Math.PI / 2), 0.65) : 1 - 0.8 * Math.pow((f - 0.3) / 0.7, 1.2)) + 0.012
    const E = [], tn = []
    for (let i = 0; i <= NB; i++) {
      const a = sp[Math.max(0, i - 1)], b = sp[Math.min(NB, i + 1)]; let tx = a.x - b.x, ty = a.y - b.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl   // toward the head
      tn.push([tx, ty]); E.push({ l: [sp[i].x - ty * half(i / NB), sp[i].y + tx * half(i / NB)], r: [sp[i].x + ty * half(i / NB), sp[i].y - tx * half(i / NB)] })
    }
    const P3 = (x, y, d, dz) => h._P(x, y, surf - d + dz)
    const shapes = []
    let yMin = Infinity, yMax = -Infinity, bad = false
    const add = (pts, fill, a) => { if (!Array.isArray(pts)) { shapes.push({ c: pts, fill, a }); return } if (pts.some(s => !s)) { bad = true; return } for (const s of pts) { if (s.y < yMin) yMin = s.y; if (s.y > yMax) yMax = s.y } shapes.push({ pts, fill, a }) }
    // the tail's fork, behind the body
    const tN = [-tn[NB][0], -tn[NB][1]], tW = 0.13 + 0.07 * (1 + bump), sT_ = sp[NB], dT = sT_.d, dm = dimAt(dT)
    const fc = mixc([6, 10, 18], [112, 140, 172], dm)
    add([P3(sp[NB - 1].x - tn[NB][1] * 0.02, sp[NB - 1].y + tn[NB][0] * 0.02, dT, 0), P3(sT_.x + tN[0] * 0.19 - tn[NB][1] * tW, sT_.y + tN[1] * 0.19 + tn[NB][0] * tW, dT, 0), P3(sT_.x + tN[0] * 0.09, sT_.y + tN[1] * 0.09, dT, 0), P3(sT_.x + tN[0] * 0.19 + tn[NB][1] * tW, sT_.y + tN[1] * 0.19 - tn[NB][0] * tW, dT, 0), P3(sp[NB - 1].x + tn[NB][1] * 0.02, sp[NB - 1].y - tn[NB][0] * 0.02, dT, 0)], fc, 0.85)
    // pectoral fins, a pair, beating slowly
    for (const side of [-1, 1]) {
      const i = 4, e = side < 0 ? E[i].l : E[i].r, sw = 0.16 + 0.05 * Math.sin(ph * 1.5 + side), dd = sp[i].d
      add([P3(e[0], e[1], dd, -0.03), P3(e[0] + (side < 0 ? 1 : -1) * tn[i][1] * -sw - tn[i][0] * 0.04, e[1] + (side < 0 ? 1 : -1) * tn[i][0] * sw - tn[i][1] * 0.04, dd, -0.05), P3(e[0] - tn[i][0] * 0.2 + (side < 0 ? 1 : -1) * tn[i][1] * -sw * 0.8, e[1] - tn[i][1] * 0.2 + (side < 0 ? 1 : -1) * tn[i][0] * sw * 0.8, dd, -0.05), P3(e[0] - tn[i][0] * 0.14, e[1] - tn[i][1] * 0.14, dd, -0.03)], mixc([6, 10, 18], [128, 152, 182], dimAt(dd)), 0.8)
    }
    // the body: a chain of round sections (so it has depth seen from any side), belly dark and low, the flank pale over
    // it, the back a darker blue on top, a sheen on the shoulder; spots on the back; the eyes
    const secs = []
    for (let i = NB; i >= 0; i--) for (const t of [0]) {                         // tail to head, two sections to a link
      const j = i - t, a = sp[Math.floor(j)], b = sp[Math.min(NB, Math.ceil(j))], u2 = j - Math.floor(j)
      const x = a.x + (b.x - a.x) * u2, y = a.y + (b.y - a.y) * u2, d = a.d + (b.d - a.d) * u2
      const c = P3(x, y, d, 0), rr = half(j / NB) * 1.05 * h._k(y)
      if (!c) { bad = true; break }
      secs.push({ x: c.x, y: c.y, r: Math.max(0.9, rr), d, f: j / NB })
      if (c.y - rr < yMin) yMin = c.y - rr; if (c.y + rr > yMax) yMax = c.y + rr
    }
    for (const [layer, up, k, c0] of [['belly', 0.1, 1.0, [92, 120, 154]], ['flank', -0.12, 0.84, [196, 218, 238]], ['back', -0.4, 0.5, [78, 112, 156]], ['sheen', -0.5, 0.2, [240, 248, 255]]])
      for (const c of secs) add({ x: c.x, y: c.y + up * c.r, r: c.r * k }, layer === 'sheen' ? mixc([6, 10, 18], c0, dimAt(c.d) * 0.9) : mixc([6, 10, 18], c0, dimAt(c.d)), layer === 'sheen' ? 0.5 : 1)
    if (!secs.length) continue                                  // (the fish's head is behind the camera: nothing to draw)
    const hd = secs[secs.length - 1], nk = secs[secs.length - 4] || secs[0]
    let ex = hd.x - nk.x, ey = hd.y - nk.y; const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el
    const eyes = [-1, 1].map(sd => ({ x: hd.x + ex * hd.r * 0.15 - ey * sd * hd.r * 0.55, y: hd.y + ey * hd.r * 0.15 + ex * sd * hd.r * 0.55 - hd.r * 0.3, d: hd.d }))
    const spots = secs.filter((c, i) => i % 3 === 1 && c.f > 0.25 && c.f < 0.85).map(c => ({ x: c.x + (c.f * 977 % 1 - 0.5) * c.r, y: c.y - c.r * 0.45, d: c.d }))
    const hi = []
    if (bad) continue
    // deeper: smaller (seen through that much clear water) -- scaled about the fish's middle section
    let dbar = 0; for (const c of secs) dbar += c.d; dbar /= secs.length
    const sc = 1 - 0.55 * Math.min(1, dbar / 6.4), mid = secs[secs.length >> 1], shr = (o) => { o.x = mid.x + (o.x - mid.x) * sc; o.y = mid.y + (o.y - mid.y) * sc; return o }
    if (sc < 0.999) {
      for (const sh of shapes) { if (sh.c) { shr(sh.c); sh.c.r *= sc } else sh.pts.forEach(shr) }
      eyes.forEach(shr); spots.forEach(shr)
      yMin = mid.y + (yMin - mid.y) * sc; yMax = mid.y + (yMax - mid.y) * sc
    }
    out.fish.push({ shapes, hi, eyes, spots, yMin, yMax, k: h._k(sp[0].y) * sc })
  }
  p._ff = out; return out
}
function drawFishBand(h, ctx, F, yA, yB, surf) {
  for (const f of F.fish) {
    if (f.yMax < yA || f.yMin > yB) continue
    for (const sh of f.shapes) {
      ctx.globalAlpha = sh.a; ctx.fillStyle = sh.fill
      ctx.beginPath()
      if (sh.c) ctx.arc(sh.c.x, sh.c.y, sh.c.r, 0, Math.PI * 2)
      else { ctx.strokeStyle = sh.fill; ctx.lineWidth = 0.8; ctx.lineJoin = 'round'; sh.pts.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.closePath() }
      ctx.fill(); if (!sh.c) ctx.stroke()
    }
    ctx.globalAlpha = 1
    for (const sp of f.spots) { ctx.fillStyle = `rgba(14,24,42,${(0.6 * dimAt(sp.d)).toFixed(3)})`; ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(0.8, f.k * 0.012), 0, Math.PI * 2); ctx.fill() }
    for (const e of f.eyes) { ctx.fillStyle = `rgba(6,8,14,${(0.95 * Math.max(0.2, dimAt(e.d))).toFixed(3)})`; ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(1, f.k * 0.016), 0, Math.PI * 2); ctx.fill() }
  }
}

// ── a pool ───────────────────────────────────────────────────────────────────────────────────────────────────
// A pool: { type: 'pool', x, y, rx, ry, z (the rim's top), rings: [{ g, z }...] the round steps from the outermost in
// (g: how far past the water's edge each one's outer edge is, z: its top; the last is the rim, engraved), fish: { count, nuts } }.
// The steps are painted: smooth ovals, risers and treads, the treads of the same stone as the floor; the hall's tiles
// under them are flat and you climb them by hidden decks (the map's `spans` with `hid`). The water is so clear it is
// not seen: a deep hole, its far wall lit a little and going down into the dark -- and in it the salmon.
const ellipse = (cx, cy, rx, ry, z, n = 96) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, z } })
export function poolRows(p) { const g = p.rings[0].g + 0.2; return [Math.floor(p.y - p.ry - g), Math.floor(p.y + p.ry + g)] }
const SEG = 96
// the stone of each step's blocks (outermost first; the last is the rim: darker, smoother, a blue grey)
const TONES = [[132, 128, 118], [140, 135, 123], [104, 108, 118]]
export function drawPool(h, ctx, p) {
  const r = p.row, NR = p.rings.length, lip = p.lip ?? 0.22
  if (!p._G) {
    const zr = p.rings[NR - 1].z
    p._G = { rings: p.rings.map((R, k) => ({ g: R.g, z: R.z, zl: k ? p.rings[k - 1].z : 0, outer: ellipse(p.x, p.y, p.rx + R.g, p.ry + R.g, R.z, SEG), low: ellipse(p.x, p.y, p.rx + R.g, p.ry + R.g, k ? p.rings[k - 1].z : 0, SEG),
      inner: ellipse(p.x, p.y, p.rx + (k + 1 < NR ? p.rings[k + 1].g : 0), p.ry + (k + 1 < NR ? p.rings[k + 1].g : 0), R.z, SEG) })),
      top: ellipse(p.x, p.y, p.rx, p.ry, zr, SEG), water: ellipse(p.x, p.y, p.rx, p.ry, zr - lip, SEG),
      // the steps under the water, each smaller and deeper: seen through it, faint
      wallD: Array.from({ length: 15 }, (_, i) => i * 0.45), wallC: {}, archD: [] }
    // one great archway in the far wall, and through it a stair going down into the dark: frames of the way, each one further
    // in (out through the wall) and lower than the last
    {
      const w = 1.5, zs = zr - lip - 3.4, zb = zr - lip - 6.0, KF = 10, wy = (x) => p.y - p.ry * Math.sqrt(Math.max(0, 1 - ((x - p.x) / p.rx) ** 2))
      const outline = (ww) => { const o = [[-ww, zb], [-ww, zs]]; for (let t = 1; t < 18; t++) { const th = Math.PI * t / 18; o.push([-ww * Math.cos(th), zs + ww * Math.sin(th)]) } o.push([ww, zs], [ww, zb]); return o }
      p._G.tun = { w, zb, zs, frames: Array.from({ length: KF + 1 }, (_, k) => outline(w).map(([xo, z]) => ({ x: p.x + xo, y: wy(p.x + xo) - 0.62 * k, z: z - 0.42 * k }))),
        treads: Array.from({ length: KF }, (_, k) => [-w, w].flatMap(sx => [sx]).length && [[-w, 0], [w, 0], [w, 1], [-w, 1]].map(([xo, f]) => ({ x: p.x + xo, y: wy(p.x + xo) - 0.62 * (k + f), z: zb - 0.42 * k }))),
        ring: outline(w + 0.3).map(([xo, z]) => ({ x: p.x + xo, y: wy(p.x + xo) + 0.01, z: z + (z > zs ? 0 : 0) })), ringIn: outline(w).map(([xo, z]) => ({ x: p.x + xo, y: wy(p.x + xo) + 0.01, z })) }
    }
    p._G.wall = p._G.wallD.map(dd => ellipse(p.x, p.y, p.rx, p.ry, zr - lip - dd, SEG))
    // the steps are of the floor's own stone (floorArt.treads): their tops are the floor's picture, their faces the colour of
    // the stone on each, a piece to each stone
    const FA = h.floorArt
    if (FA && FA.treads) {
      const TPx = h.base.width / h.W, bx = Math.max(0, Math.floor((p.x - p.rx - 4) * TPx)), by = Math.max(0, Math.floor((p.y - p.ry - 4) * TPx))
      const bw = Math.min(h.base.width - bx, Math.ceil((2 * p.rx + 8) * TPx)), bh = Math.min(h.base.height - by, Math.ceil((2 * p.ry + 8) * TPx))
      const data = h.base.getContext('2d').getImageData(bx, by, bw, bh).data
      const px = (x, y) => { const X = Math.min(bw - 1, Math.max(0, Math.floor(x * TPx) - bx)), Y = Math.min(bh - 1, Math.max(0, Math.floor(y * TPx) - by)), o = (Y * bw + X) * 4; return [data[o], data[o + 1], data[o + 2]] }
      p._G.neg = negCourses(FA).negInfo
      // a stone's colour: the brighter of two places on it (the middle may be carved)
      p._G.stoneCol = (m, t0, t1) => {
        const I = p._G.neg[m], gm = FA.g0 + I.e0 + I.w / 2, out = []
        for (const f of [0.25, 0.75]) { const t = t0 + (t1 - t0) * f; out.push(px(p.x + (p.rx + gm) * Math.cos(t), p.y + (p.ry + gm) * Math.sin(t))) }
        return out[0][0] + out[0][1] + out[0][2] > out[1][0] + out[1][1] + out[1][2] ? out[0] : out[1]
      }
    }
  }
  const G = p._G, band = (poly, e = 0.06) => clipBand(poly, r - e, r + 1 + e), zr = p.rings[NR - 1].z, surf = zr - lip
  const lw = Math.max(1, h._k(r + 0.5) * 0.013)
  ctx.save()
  const face = (quad, a, zm, dark, course, rgb) => {                 // a piece of a face (riser or the water's lip): one flat lit colour, a course joint, a dark edge
    ctx.beginPath(); if (!worldPath(h, ctx, quad)) return
    const L = h.lightAt(p.x + Math.cos(a) * p.rx, p.y + Math.sin(a) * p.ry + (dark ? 0.2 : 0.15), zm, -1)
    ctx.fillStyle = h._rgb(L.map(v => clamp01(v * (dark ? 0.8 : 1.1))), rgb || (dark ? [84, 86, 96] : [104, 102, 96])); ctx.fill()
    ctx.strokeStyle = 'rgba(8,8,10,0.55)'; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke()
    if (course) { const n = quad.length / 2; ctx.beginPath()
      for (let j = 0; j < n; j++) { const A = quad[j], B = quad[quad.length - 1 - j], m = h._P(A.x + (B.x - A.x) * 0.5, A.y + (B.y - A.y) * 0.5, (A.z + B.z) / 2); if (m) (j ? ctx.lineTo(m.x, m.y) : ctx.moveTo(m.x, m.y)) }
      ctx.strokeStyle = 'rgba(8,8,10,0.35)'; ctx.stroke() }
  }
  // the water: clear, so it is a hole going down -- the far wall lit a little where the rim lets the light in, then the dark;
  // the submerged steps faint on it; and in it the salmon. Painted in this row's band of the screen (the floor in it is
  // hidden by the water), inside the rim's inner edge, so the rim in front of it covers it as it should
  {
    const yA = h._Y(r, zr), yB = h._Y(r + 1, 0)       // the band this row's floor and its decks (up to the rim's height) cover on the screen
    const ft = h._P(p.x, p.y - p.ry, surf), nt0 = h._P(p.x, p.y + p.ry, zr)
    const top = h._P(p.x, p.y - p.ry, surf), deep = h._P(p.x, p.y - p.ry, surf - 2.6)
    if (ft && nt0 && top && deep && yB >= ft.y - 2 && yA <= nt0.y + 2) {
      const L = h.lightAt(p.x, p.y - p.ry + 0.4, surf - 0.1, -1), v = Math.min(1.3, Math.max(L[0], L[1], L[2]) * 1.6)
      const slab = (e) => { ctx.beginPath(); ctx.rect(0, yA - e, h.cam.sw, yB - yA + 2 * e); ctx.clip() }   // (a row's band overlaps the one before it: the later one repaints the same thing)
      ctx.save(); slab(0.6)
      ctx.beginPath(); worldPath(h, ctx, G.top); ctx.clip(); ctx.beginPath(); worldPath(h, ctx, G.water); ctx.clip()
      ctx.fillStyle = 'rgb(2,4,9)'; ctx.fillRect(0, yA - 2, h.cam.sw, yB - yA + 4)
      // the far wall of the shaft: courses of cut stone curving round and going down, dimmer the deeper, until the dark has them
      if (!p._W || p._W.t !== h.t) {
        const pts = G.wall.map(E => E.map(q => h._P(q.x, q.y, q.z)))
        const T = G.tun, tun = { frames: T.frames.map(F => F.map(q => h._P(q.x, q.y, q.z))), treads: T.treads.map(F => F.map(q => h._P(q.x, q.y, q.z))), ring: T.ring.map(q => h._P(q.x, q.y, q.z)), ringIn: T.ringIn.map(q => h._P(q.x, q.y, q.z)) }
        p._W = { t: h.t, pts, tun }
      }
      const WP = p._W.pts, NC = WP.length - 1
      for (let ci = 0; ci < NC; ci++) {
        const dm = (G.wallD[ci] + G.wallD[ci + 1]) / 2, fade = Math.pow(Math.max(0, 1 - dm / 6.6), 2.3)
        if (fade < 0.01) continue
        for (let i = (ci % 2) * 1; i < SEG; i += 2) {
          const a2 = (i + 1) / SEG * Math.PI * 2; if (Math.sin(a2) > 0.4) continue
          const q = [WP[ci][i % SEG], WP[ci][(i + 2) % SEG], WP[ci + 1][(i + 2) % SEG], WP[ci + 1][i % SEG]]
          if (q.some(z => !z)) continue
          const y0 = Math.min(q[0].y, q[1].y, q[2].y, q[3].y), y1 = Math.max(q[0].y, q[1].y, q[2].y, q[3].y); if (y1 < yA - 1 || y0 > yB + 1) continue
          const key = ci * SEG + i, jit = 0.85 + 0.3 * ((hash(key * 977 + 13) & 255) / 255)
          let col = G.wallC[key]
          if (!col) { const L = h.lightAt(p.x + Math.cos(a2) * p.rx, p.y + Math.sin(a2) * p.ry + 0.15, surf - dm, -1); col = G.wallC[key] = L.map(v => clamp01(v * 1.5 + 0.1)) }
          ctx.beginPath(); q.forEach((z, k) => (k ? ctx.lineTo(z.x, z.y) : ctx.moveTo(z.x, z.y))); ctx.closePath()
          const f = fade * jit
          ctx.fillStyle = h._rgb(col.map(v => v * f * 0.7), [88, 98, 118]); ctx.fill()
          ctx.strokeStyle = `rgba(2,4,9,${(0.45 + 0.4 * (1 - fade)).toFixed(2)})`; ctx.lineWidth = lw; ctx.stroke()
        }
      }
      // the great archway, and the stair going down through it
      {
        const TN = p._W.tun, FR = TN.frames, KF = FR.length - 1, n = FR[0].length
        if (!FR.some(F => F.some(z => !z)) && !TN.ring.some(z => !z) && !TN.ringIn.some(z => !z)) {
          let ya = Infinity, yb = -Infinity; for (const z of TN.ring) { if (z.y < ya) ya = z.y; if (z.y > yb) yb = z.y }
          for (const z of FR[KF]) if (z.y > yb) yb = z.y
          if (!(yb < yA - 1 || ya > yB + 1)) {
            const base = h.lightAt(p.x, p.y - p.ry + 0.3, surf - 3.5, -1), bl = Math.max(0.35, Math.min(1, (base[0] + base[1] + base[2]) / 1.5))
            const poly = (pts, col) => { ctx.beginPath(); pts.forEach((z, k) => (k ? ctx.lineTo(z.x, z.y) : ctx.moveTo(z.x, z.y))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(1,2,6,0.7)'; ctx.lineWidth = lw; ctx.stroke() }
            const sh = (k, m) => { const f = m * bl * Math.pow(Math.max(0, 1 - k / (KF + 1.5)), 1.5); return `rgb(${(78 * f) | 0},${(92 * f) | 0},${(116 * f) | 0})` }
            ctx.beginPath(); FR[0].forEach((z, k) => (k ? ctx.lineTo(z.x, z.y) : ctx.moveTo(z.x, z.y))); ctx.closePath(); ctx.fillStyle = 'rgb(1,2,5)'; ctx.fill()
            for (let k = KF - 1; k >= 0; k--) {                                          // far to near: the riser, the tread, the walls either side
              const A = FR[k], B = FR[k + 1], L = n - 1
              poly([A[0], A[1], B[1], B[0]], sh(k, 0.75)); poly([A[L], A[L - 1], B[L - 1], B[L]], sh(k, 0.75))         // the walls
              if (TN.treads[k].every(z => z)) poly(TN.treads[k], sh(k, 1.3))                // the tread, lit from above
            }
            const E = FR[KF], gx = (E[0].x + E[n - 1].x) / 2, gy = (E[0].y + E[1].y) / 2, gr = Math.abs(E[n - 1].x - E[0].x) * 0.7
            const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr); gg.addColorStop(0, 'rgba(70,170,180,0.2)'); gg.addColorStop(1, 'rgba(70,170,180,0)')
            ctx.fillStyle = gg; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2)
            // the frame: a band of voussoirs round the mouth
            ctx.beginPath(); TN.ring.forEach((z, k) => (k ? ctx.lineTo(z.x, z.y) : ctx.moveTo(z.x, z.y))); ctx.closePath()
            TN.ringIn.forEach((z, k) => (k ? ctx.lineTo(z.x, z.y) : ctx.moveTo(z.x, z.y))); ctx.closePath()
            const Lw = h.lightAt(p.x, p.y - p.ry + 0.2, surf - 3.2, -1)
            ctx.fillStyle = h._rgb(Lw.map(v => clamp01(v * 1.5 + 0.1) * 0.55), [110, 122, 146]); ctx.fill('evenodd')
            ctx.strokeStyle = 'rgba(2,4,9,0.75)'; ctx.lineWidth = lw; ctx.stroke()
            for (let k = 2; k < n - 2; k += 2) { ctx.beginPath(); ctx.moveTo(TN.ringIn[k].x, TN.ringIn[k].y); ctx.lineTo(TN.ring[k].x, TN.ring[k].y); ctx.stroke() }
          }
        }
      }
      ctx.lineWidth = lw * 1.4; ctx.strokeStyle = 'rgba(190,220,245,0.4)'; ctx.beginPath()          // the water's edge on the wall
      G.wall[0].forEach((q, i) => { const z = WP[0][i]; if (z && Math.sin(i / SEG * Math.PI * 2) < 0.4) ctx.lineTo(z.x, z.y); else ctx.moveTo(z ? z.x : 0, z ? z.y : 0) }); ctx.stroke()
      ctx.restore()
      const F = fishFrame(h, p, surf)
      ctx.save(); slab(0.6)
      ctx.beginPath(); worldPath(h, ctx, G.top); ctx.clip(); ctx.beginPath(); worldPath(h, ctx, G.water); ctx.clip()
      drawFishBand(h, ctx, F, yA - 40, yB + 40, surf)
      ctx.globalCompositeOperation = 'lighter'
      for (const nt of F.nuts) { ctx.fillStyle = 'rgba(205,150,60,0.9)'; ctx.beginPath(); ctx.ellipse(nt.x, nt.y, Math.max(1.5, h._k(p.y) * 0.04), Math.max(1, h._k(p.y) * 0.026), 0, 0, Math.PI * 2); ctx.fill() }
      for (const rg of F.rings) {
        const c0 = h._P(rg.x, rg.y, surf), c1 = h._P(rg.x + 1, rg.y, surf), c2 = h._P(rg.x, rg.y + 1, surf); if (!c0 || !c1 || !c2) continue
        for (const [lag, al] of rg.two ? [[0, 0.95], [0.24, 0.6]] : [[0, 0.95]]) {
          const b2 = rg.b - lag * 0.4; if (b2 <= 0 || b2 >= 1) continue
          const rad = 0.05 + (rg.R || 3.4) * Math.pow(b2, 0.62), a = Math.pow(1 - b2, 1.3) * al * rg.w
          ctx.strokeStyle = `rgba(215,232,248,${a.toFixed(3)})`; ctx.lineWidth = Math.max(1.2, h._k(rg.y) * 0.022)
          ctx.beginPath(); ctx.ellipse(c0.x, c0.y, Math.abs(c1.x - c0.x) * rad, Math.abs(c2.y - c0.y) * rad, 0, 0, Math.PI * 2); ctx.stroke()
        }
      }
      ctx.restore()
    }
  }
  // the steps and the rim, outermost first: each one's riser (its face toward you), then its tread, laid in cut blocks
  G.rings.forEach((R, k) => {
    if (G.neg) {
      // each step's stones: its face (a piece to each stone, in the stone's colour), then its top, the floor's own picture
      const m = NR - 1 - k, I = G.neg[m], TAU = Math.PI * 2
      for (let j = 0; j < I.m; j++) {
        const t0 = (j / I.m - I.off) * TAU - Math.PI, t1 = (j + 1) / I.m * TAU - I.off * TAU - Math.PI, am = (t0 + t1) / 2
        if (Math.sin(am) < -0.35 || Math.floor(p.y + Math.sin(am) * (p.ry + R.g)) !== r) continue
        const quad = [], NS = 3
        for (let q = 0; q <= NS; q++) { const t = t0 + (t1 - t0) * q / NS; quad.push({ x: p.x + Math.cos(t) * (p.rx + R.g), y: p.y + Math.sin(t) * (p.ry + R.g), z: R.z }) }
        for (let q = NS; q >= 0; q--) { const t = t0 + (t1 - t0) * q / NS; quad.push({ x: p.x + Math.cos(t) * (p.rx + R.g), y: p.y + Math.sin(t) * (p.ry + R.g), z: R.zl }) }
        face(quad, am, (R.z + R.zl) / 2, false, R.z - R.zl > 0.3, G.stoneCol(m, t0, t1).map(v => v * 0.92))
      }
      const ob = clipBand(R.outer, r - 0.04, r + 1.04), ib = clipBand(R.inner, r - 0.04, r + 1.04)
      if (ob.length >= 3) {
        const TPx = h.base.width / h.W
        ctx.save(); ctx.beginPath(); worldPath(h, ctx, ob); if (ib.length >= 3) worldPath(h, ctx, ib); ctx.clip('evenodd')
        let a = Infinity, b = -Infinity; for (const q of ob) { a = Math.min(a, q.x); b = Math.max(b, q.x) }
        const c0 = Math.max(0, Math.floor(a)), c1 = Math.min(h.W - 1, Math.floor(b))
        h._strips(ctx, h.litCv, r, c0, c1, R.z, c0 * TPx, (c1 + 1) * TPx, r * TPx, h._Y(r, R.z), h._Y(r + 1, R.z))
        ctx.restore()
      }
      return
    }
    for (let i = 0; i < SEG; i += 3) {
      const a = (i + 1.5) / SEG * Math.PI * 2
      if (Math.sin(a) < -0.35 || Math.floor(p.y + Math.sin(a) * (p.ry + R.g)) !== r) continue
      const quad = []; for (let j = i; j <= i + 3; j++) quad.push(R.outer[j % SEG]); for (let j = i + 3; j >= i; j--) quad.push(R.low[j % SEG])
      face(quad, a, (R.z + R.zl) / 2, false, R.z - R.zl > 0.3)
    }
    const g0 = k + 1 < NR ? p.rings[k + 1].g : 0, gm = (R.g + g0) / 2
    for (let i = 0; i < SEG; i += 3) {
      const a = (i + 1.5) / SEG * Math.PI * 2, ym = p.y + Math.sin(a) * (p.ry + gm)
      if (Math.floor(ym) !== r) continue
      const quad = []; for (let j = i; j <= i + 3; j++) quad.push(R.outer[j % SEG]); for (let j = i + 3; j >= i; j--) quad.push(R.inner[j % SEG])
      ctx.beginPath(); if (!worldPath(h, ctx, quad)) continue
      const L = h.lightAt(p.x + Math.cos(a) * (p.rx + gm), ym, R.z + 0.05, -1), jit = 0.9 + 0.2 * ((hash(i * 131 + k * 977 + (p.n || 0) * 17) & 255) / 255)
      ctx.fillStyle = h._rgb(L.map(v => clamp01(v * 1.2 * jit)), TONES[Math.min(k, TONES.length - 1)]); ctx.fill()
      ctx.strokeStyle = 'rgba(10,10,10,0.5)'; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke()
      ctx.strokeStyle = 'rgba(255,248,228,0.26)'; ctx.lineWidth = lw * 1.3; ctx.beginPath()                // the lit nosing
      for (let j = i; j <= i + 3; j++) { const s = h._P(R.outer[j % SEG].x, R.outer[j % SEG].y, R.z); if (s) (j > i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)) }
      ctx.stroke()
      if (k === NR - 1) {                                       // the rim is carved: a running line, and a chevron or a turn of the spiral on each block
        ctx.strokeStyle = 'rgba(8,8,10,0.62)'; ctx.lineWidth = lw * 1.2; ctx.beginPath()
        for (let j = i; j <= i + 3; j++) { const an = j / SEG * Math.PI * 2, s = h._P(p.x + Math.cos(an) * (p.rx + R.g * 0.5), p.y + Math.sin(an) * (p.ry + R.g * 0.5), R.z); if (s) (j > i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)) }
        ctx.stroke()
        const c = h._P(p.x + Math.cos(a) * (p.rx + R.g * 0.5), p.y + Math.sin(a) * (p.ry + R.g * 0.5), R.z), sz = h._k(ym) * R.g * 0.2
        if (c) { ctx.beginPath(); if ((i / 3) % 2) { ctx.moveTo(c.x - sz, c.y); ctx.lineTo(c.x, c.y - sz * 0.45); ctx.lineTo(c.x + sz, c.y) } else ctx.arc(c.x, c.y, sz * 0.4, 0, Math.PI * 1.6); ctx.stroke() }
      }
    }
  })
  // the water's lip: the rim's inner face, on the far side, where the water stands a little below it
  if (G.neg) {
    const I = G.neg[0], TAU = Math.PI * 2
    for (let j = 0; j < I.m; j++) {
      const t0 = (j / I.m - I.off) * TAU - Math.PI, t1 = (j + 1) / I.m * TAU - I.off * TAU - Math.PI, am = (t0 + t1) / 2
      if (Math.sin(am) > 0.2 || Math.floor(p.y + Math.sin(am) * p.ry) !== r) continue
      const quad = []
      for (let q = 0; q <= 3; q++) { const t = t0 + (t1 - t0) * q / 3; quad.push({ x: p.x + Math.cos(t) * p.rx, y: p.y + Math.sin(t) * p.ry, z: zr }) }
      for (let q = 3; q >= 0; q--) { const t = t0 + (t1 - t0) * q / 3; quad.push({ x: p.x + Math.cos(t) * p.rx, y: p.y + Math.sin(t) * p.ry, z: surf }) }
      face(quad, am, zr - lip / 2, true, false, G.stoneCol(0, t0, t1).map(v => v * 0.85))
    }
  } else
  for (let i = 0; i < SEG; i += 3) {
    const a = (i + 1.5) / SEG * Math.PI * 2
    if (Math.sin(a) > 0.2 || Math.floor(p.y + Math.sin(a) * p.ry) !== r) continue
    const quad = []; for (let j = i; j <= i + 3; j++) quad.push(G.top[j % SEG]); for (let j = i + 3; j >= i; j--) quad.push(G.water[j % SEG])
    face(quad, a, zr - lip / 2, true)
  }
  // a nut falling from the roots (not clipped: it comes from high above the pool)
  for (const f of fishFrame(h, p, surf).falls) {
    if (Math.floor(f.y) !== r) continue
    const a = h._P(f.x, f.y, f.z), b = h._P(f.x, f.y, f.z + 0.5); if (!a || !b) continue
    ctx.strokeStyle = 'rgba(205,150,60,0.35)'; ctx.lineWidth = Math.max(1, h._k(f.y) * 0.03); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    ctx.fillStyle = 'rgb(214,160,70)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, Math.max(1.5, h._k(f.y) * 0.05), Math.max(1.5, h._k(f.y) * 0.06), 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

// The front of a bridge: { type: 'span', x0, x1, y, z0, zt, ox0, ox1, zs, rise }: a dressed face from the ground to the
// parapet's top (zt) with the stream's way through it, a low arch (springing at zs, rising `rise`), its voussoirs, the
// coping along the top, the dark under it.
export function drawSpan(h, ctx, p) {
  const { x0, x1, y, z0, zt, ox0, ox1, zs } = p, rise = p.rise ?? 0.3, k = h._k(y)
  if (!k) return
  const P = (a, c) => h._P(a, y, c), cx = (ox0 + ox1) / 2, rad = (ox1 - ox0) / 2
  const arc = []; for (let q = 0; q <= 20; q++) { const a = Math.PI * q / 20; arc.push(P(cx + rad * Math.cos(a), zs + rise * Math.sin(a))) }
  const rect = [P(x0, zt), P(x1, zt), P(x1, z0), P(x0, z0)], hole = [P(ox0, z0), P(ox0, zs), ...arc, P(ox1, zs), P(ox1, z0)].reverse()
  if (rect.some(q => !q) || hole.some(q => !q)) return
  const path = (a) => { a.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath() }
  ctx.save()
  ctx.beginPath(); path(rect); path(hole); ctx.clip('evenodd')
  const pat = h._pattern(ctx, 'm'), s = k / h.FACE_PX
  pat.setTransform?.(new DOMMatrix([s, 0, 0, s, h.cam.sw / 2 - h.cam.col * k, h._Y(y, 0)]))
  ctx.fillStyle = pat; ctx.fillRect(0, 0, h.cam.sw, h.cam.sh)
  const oc = h._i(Math.floor(cx), Math.floor(y + 0.1)), Lb = h.lightAt(cx, y + 0.05, z0 + 0.2, oc), Lt = h.lightAt(cx, y + 0.05, zt, oc)
  const gr = ctx.createLinearGradient(0, P(cx, z0).y, 0, P(cx, zt).y); gr.addColorStop(0, h._rgb(Lb.map(v => v * 1.2))); gr.addColorStop(1, h._rgb(Lt.map(v => v * 1.2)))
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gr; ctx.fillRect(0, 0, h.cam.sw, h.cam.sh); ctx.globalCompositeOperation = 'source-over'
  // the coping: a pale course along the top, its lower edge a line
  const cp = [P(x0, zt), P(x1, zt), P(x1, zt - 0.1), P(x0, zt - 0.1)]
  ctx.fillStyle = 'rgba(235,228,205,0.3)'; ctx.beginPath(); path(cp); ctx.fill()
  ctx.strokeStyle = 'rgba(10,8,6,0.65)'; ctx.lineWidth = Math.max(1, k * 0.014)
  ctx.beginPath(); ctx.moveTo(cp[3].x, cp[3].y); ctx.lineTo(cp[2].x, cp[2].y); ctx.stroke()
  // courses and joints in the face either side of the arch, voussoirs round it
  ctx.beginPath()
  for (const zc of [zt - 0.38, zt - 0.66]) { const a = P(x0, zc), b = P(x1, zc); if (zc > z0 + 0.05) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y) } }
  for (let c = 0; c < 2; c++) for (let x = x0 + 0.45 + c * 0.3; x < x1; x += 0.9) { if (x > ox0 - 0.15 && x < ox1 + 0.15) continue; const a = P(x, zt - 0.1 - c * 0.28), b = P(x, zt - 0.38 - c * 0.28); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y) }
  ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1
  ctx.beginPath()
  for (let q = 1; q < 12; q++) { const a = Math.PI * q / 12, i0 = P(cx + rad * Math.cos(a), zs + rise * Math.sin(a)), i1 = P(cx + (rad + 0.22) * Math.cos(a), zs + (rise + 0.16) * Math.sin(a)); ctx.moveTo(i0.x, i0.y); ctx.lineTo(i1.x, i1.y) }
  ctx.stroke()
  ctx.restore()
  // inside the arch: the dark under the deck
  ctx.save(); ctx.beginPath(); path(hole); ctx.fillStyle = 'rgba(2,4,8,0.55)'; ctx.fill(); ctx.restore()
  h._polys.push({ pts: [rect[0], rect[1], rect[2], rect[3]], r: Math.floor(y - 0.01), walk: false })
}

// A statue (statues.js): { type: 'statue', kind, x, y, z, s (its height in tiles), stone: [r, g, b], flip }, lit where
// it stands, a shadow at its foot
export function drawStatue(h, ctx, p) {
  const at = h._P(p.x, p.y, p.z); if (!at) return
  const k = h._k(p.y), hgt = k * (p.s ?? 2.4), wd = hgt / 2
  const L = h.lightAt(p.x, p.y + 0.15, p.z + (p.s ?? 2.4) * 0.5, h._i(Math.floor(p.x), Math.floor(p.y + 0.2)))
  const b = Math.max(0.12, Math.max(L[0], L[1], L[2]))
  const img = statueCanvas(p.kind)
  ctx.save(); ctx.imageSmoothingEnabled = true
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(at.x, at.y, wd * 0.45, wd * 0.12, 0, 0, Math.PI * 2); ctx.fill()
  if (p.flip) { ctx.translate(at.x, 0); ctx.scale(-1, 1); ctx.translate(-at.x, 0) }
  ctx.drawImage(litSprite(img, 0, 0, img.width, img.height, b, false, 0.55, p.stone || [170, 170, 170]), at.x - wd / 2, at.y - hgt, wd, hgt)
  ctx.restore()
}

// ═════════ the ferrywoman ═══════════════════════════════════
// { type: 'ferry', x, y, z (the water), a (heading, radians: 0 east, PI/2 south, toward you), woman: 'paddle' | 'stand' |
//   'none', u (0..1, from kneeling to stood at the bow), still (not paddling) }: a hide boat, black with tar, and in it a
// woman in white, her black hair down over her face. Paddling, she kneels and pulls with her hands, a slap and a ring each
// stroke; stood, she is at the bow, her arms hanging.
// { type: 'wraith', x, y, z, wz (the water's height), a, pose: 'fall' | 'under' | 'climb' | 'crawl' | 'none', u }: the same
// woman out of the boat: stepping off its bow, a ring going along under the water, coming up out of it, crawling.
// escape.js moves them both.
const FS = 1.35                                                   // how big she is, and the boat
const paleOf = (b) => (f) => `rgb(${Math.min(255, 196 * b * f) | 0},${Math.min(255, 202 * b * f) | 0},${Math.min(255, 210 * b * f) | 0})`
function fFrame(h, p) {
  const hx = Math.cos(p.a ?? Math.PI / 2), hy = Math.sin(p.a ?? Math.PI / 2), lx = -hy, ly = hx
  return { W: (dl, df, dz) => h._P(p.x + (lx * dl + hx * df) * FS, p.y + (ly * dl + hy * df) * FS, p.z + dz * FS), toward: hy > 0 }
}
function fPoly(ctx, pts, fill) { if (pts.some(q => !q)) return; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill() }
function fLine(ctx, pts, col, w) { if (pts.some(q => !q)) return; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke() }
function fRing(ctx, h, x, y, z, r, a) {
  const c = h._P(x, y, z), c1 = h._P(x + 1, y, z); if (!c || !c1 || a <= 0) return
  const rr = Math.abs(c1.x - c.x) * r
  ctx.strokeStyle = `rgba(210,222,240,${Math.min(1, a).toFixed(3)})`; ctx.lineWidth = Math.max(1, h._k(y) * 0.015)
  ctx.beginPath(); ctx.ellipse(c.x, c.y, rr, rr * 0.35, 0, 0, Math.PI * 2); ctx.stroke()
}
function fBright(h, p) { const L = h.lightAt(p.x, p.y + 0.3, p.z + 0.6, -1); return Math.max(0.78, Math.min(1.2, Math.max(L[0], L[1], L[2]) * 1.6)) }
const fHair = (W, df, z0, zTop, zEnd, w, sway = 0) => {
  const hair = [W(-w * 0.85 + sway, df, zTop), W(w * 0.85 + sway, df, zTop), W(w + sway, df, zTop - 0.26)]
  for (let i = 0; i <= 6; i++) { const f = 1 - i / 6; hair.push(W(-w + 2 * w * f + sway, df, z0 + zEnd + (i % 2) * 0.07 - Math.sin(i / 6 * Math.PI) * 0.05)) }
  hair.push(W(-w + sway, df, zTop - 0.26))
  return hair
}
// stood: her robe, her arms hanging, her head, the hair over it down to her waist (hs: how far up she has come, 0..1)
function fStanding(ctx, h, W, df, z0, pale, k, sway, hs = 1) {
  const Z = (z) => z0 + z * hs
  fPoly(ctx, [W(-0.15 + sway, df, Z(0.02)), W(0.15 + sway, df, Z(0.02)), W(0.1 + sway, df, Z(1.02)), W(-0.1 + sway, df, Z(1.02))], pale(1))
  for (const s of [-1, 1]) fLine(ctx, [W(s * 0.12 + sway, df, Z(0.98)), W(s * 0.16 + sway, df + 0.02, Z(0.72)), W(s * 0.15 + sway, df + 0.03, Z(0.5))], pale(0.9), Math.max(1, k * 0.034 * FS))
  const hd = W(sway, df + 0.01, Z(1.14)); if (hd) { ctx.beginPath(); ctx.arc(hd.x, hd.y, k * 0.085 * FS, 0, Math.PI * 2); ctx.fillStyle = pale(1.05); ctx.fill() }
  fPoly(ctx, fHair((dl, f, z) => W(dl, f, z), df + 0.03, z0, Z(1.24), 0.6 * hs, 0.11, sway), 'rgb(4,4,6)')
}
// on all fours, coming at you: the robe behind, the hair hanging to the ground in front of her face, the arms reaching
function fCrawling(ctx, h, W, z0, ph, pale, k) {
  const r1 = Math.max(0, Math.sin(ph)) * 0.2, r2 = Math.max(0, Math.sin(ph + Math.PI)) * 0.2
  fPoly(ctx, [W(-0.17, -0.55, z0 + 0.03), W(0.17, -0.55, z0 + 0.03), W(0.14, 0.18, z0 + 0.42), W(-0.14, 0.18, z0 + 0.42)], pale(0.95))
  const hd = W(0, 0.32, z0 + 0.44); if (hd) { ctx.beginPath(); ctx.arc(hd.x, hd.y, k * 0.085 * FS, 0, Math.PI * 2); ctx.fillStyle = pale(1.05); ctx.fill() }
  const hair = [W(-0.1, 0.28, z0 + 0.55), W(0.1, 0.28, z0 + 0.55)]
  for (let i = 0; i <= 6; i++) { const f = i / 6; hair.push(W(0.15 - 0.3 * f, 0.62 + (i % 2) * 0.06, z0 + 0.01)) }
  fPoly(ctx, hair, 'rgb(4,4,6)')
  for (const [s, r] of [[-1, r1], [1, r2]]) fLine(ctx, [W(s * 0.13, 0.16, z0 + 0.4), W(s * 0.26, 0.3 + r * 0.6, z0 + 0.3), W(s * 0.22, 0.48 + r, z0 + 0.02)], pale(0.9), Math.max(1, k * 0.034 * FS))
}

export function drawFerry(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  const { W, toward } = fFrame(h, p), pale = paleOf(fBright(h, p))
  const ph = h.t * Math.PI * 2 / (p.stroke ?? 1.6), paddling = p.woman === 'paddle' && !p.still
  ctx.save()
  if (paddling) for (const [side, off] of [[-1, 0], [1, Math.PI]]) {                // the rings her hands leave
    const u = (((ph + off) / (Math.PI * 2)) % 1 + 1) % 1
    const hx = Math.cos(p.a ?? Math.PI / 2), hy = Math.sin(p.a ?? Math.PI / 2)
    fRing(ctx, h, p.x - hy * side * 0.5 * FS + hx * 0.12 * FS, p.y + hx * side * 0.5 * FS + hy * 0.12 * FS, p.z, 0.3 + u * 1.6, 0.5 * (1 - u))
  }
  // the boat: a long hull, its gunwale, the dark inside
  const hull = [], rim = [], inner = []
  for (let i = 0; i < 20; i++) { const t = i / 20 * Math.PI * 2, df = Math.cos(t) * 0.85, dl = Math.sin(t) * 0.32 * (1 - 0.35 * Math.max(0, Math.cos(t)) ** 4); hull.push(W(dl * 1.02, df, 0.02)); rim.push(W(dl, df, 0.24)); inner.push(W(dl * 0.8, df * 0.88, 0.22)) }
  const bb = fBright(h, p)
  fPoly(ctx, hull, 'rgb(8,9,11)'); fPoly(ctx, rim, `rgb(${22 * bb | 0},${22 * bb | 0},${25 * bb | 0})`); fPoly(ctx, inner, 'rgb(5,5,7)')
  if (p.woman === 'stand') {
    const u = p.u ?? 1, sway = Math.sin(h.t * 0.6) * 0.012
    fStanding(ctx, h, W, 0.5 * u, 0.2, pale, k, sway, 0.55 + 0.45 * u)
  } else if (p.woman === 'paddle') {
    const arm = (side, off) => {
      const s = Math.sin(ph + off), c = Math.cos(ph + off), reach = paddling ? s * 0.3 : 0, down = paddling ? 0.12 + 0.2 * Math.max(0, c) : 0.32
      fLine(ctx, [W(side * 0.13, 0.02, 0.62), W(side * 0.3, 0.05 + reach * 0.5, 0.44), W(side * 0.46, 0.1 + reach, down)], pale(0.9), Math.max(1, k * 0.034 * FS))
    }
    if (toward) { arm(-1, 0); arm(1, Math.PI) }
    fPoly(ctx, [W(-0.2, 0, 0.2), W(0.2, 0, 0.2), W(0.13, 0, 0.66), W(-0.13, 0, 0.66)], pale(1))
    const hd = W(0, 0.02, 0.79); if (hd) { ctx.beginPath(); ctx.arc(hd.x, hd.y, k * 0.088 * FS, 0, Math.PI * 2); ctx.fillStyle = pale(1.05); ctx.fill() }
    fPoly(ctx, fHair(W, 0.03, 0, 0.89, 0.47, 0.1), 'rgb(4,4,6)')
    if (!toward) { arm(-1, 0); arm(1, Math.PI) }
  }
  ctx.restore()
}

export function drawWraith(h, ctx, p) {
  const k = h._k(p.y); if (!k || !p.pose || p.pose === 'none') return
  const { W } = fFrame(h, p), pale = paleOf(fBright(h, p)), wz = p.wz ?? p.z, u = p.u ?? 0
  ctx.save()
  const clip = () => { const c = h._P(p.x, p.y + 0.25, wz); if (c) { ctx.beginPath(); ctx.rect(-1e4, -1e4, 3e4, 1e4 + c.y); ctx.clip() } }
  if (p.pose === 'fall') {
    if (u > 0.4) for (const [lag, al] of [[0, 0.7], [0.18, 0.45]]) { const v = (u - 0.4 - lag) / 0.6; if (v > 0) fRing(ctx, h, p.x, p.y, wz, 0.25 + v * 1.8, al * (1 - v)) }
    clip()
    fStanding(ctx, h, W, 0.35 * u, 0.2 - 1.9 * Math.pow(u, 1.6), pale, k, 0)
  } else if (p.pose === 'under') {                                  // a ring and a few bubbles, going along under the water
    for (let i = 0; i < 2; i++) { const f = ((h.t * 0.9 + i / 2) % 1); fRing(ctx, h, p.x, p.y, wz, 0.15 + f * 1.1, 0.4 * (1 - f)) }
    for (let i = 0; i < 4; i++) { const b = h._P(p.x + Math.sin(h.t * 3 + i * 2.1) * 0.25, p.y + Math.cos(h.t * 2.3 + i) * 0.15, wz); if (b && Math.sin(h.t * 5 + i * 1.7) > 0.3) { ctx.fillStyle = 'rgba(215,228,245,0.6)'; ctx.fillRect(b.x - 1, b.y - 1, 2, 2) } }
  } else if (p.pose === 'climb') {
    fRing(ctx, h, p.x, p.y, wz, 0.4 + u * 0.8, 0.5 * (1 - u))
    clip()
    fCrawling(ctx, h, W, 0, h.t * 2, pale, k)
  } else if (p.pose === 'crawl') {
    fCrawling(ctx, h, W, 0, p.ph ?? h.t * 4.2, pale, k)
  }
  ctx.restore()
}

// { type: 'body', x, y, z (the water), sx, sy, sw, sh (a frame of the champions' sheet, without their kit), rot, s, a }:
// one of the dead lying out on the water, face up, at its own angle, pale, turning very slowly
const BODIES = new Map()
export function drawBody(h, ctx, p) {
  const img = h.scene?.textures?.get?.('championSheet_unarmored')?.getSourceImage?.()
  if (!img || !img.width) return
  const at = h._P(p.x, p.y, p.z); if (!at) return
  const k = h._k(p.y); if (!k || k < 3) return
  const key = p.sx + ',' + p.sy
  let pale = BODIES.get(key)
  if (!pale) {                                                       // the frame, drained of its colour: a cold grey-white
    pale = document.createElement('canvas'); pale.width = p.sw; pale.height = p.sh
    const g = pale.getContext('2d'); g.drawImage(img, p.sx, p.sy, p.sw, p.sh, 0, 0, p.sw, p.sh)
    const d = g.getImageData(0, 0, p.sw, p.sh), a = d.data
    for (let i = 0; i < a.length; i += 4) { const l = (a[i] * 0.3 + a[i + 1] * 0.55 + a[i + 2] * 0.15) / 255; a[i] = 120 + 95 * l; a[i + 1] = 130 + 95 * l; a[i + 2] = 145 + 95 * l }
    g.putImageData(d, 0, 0); BODIES.set(key, pale)
  }
  // and this one's own: part of it under the water (fading out one way, toward a darker, bluer cold), its edges soft
  const own = p._own || (p._own = (() => {
    const c = document.createElement('canvas'); c.width = p.sw * 2; c.height = p.sh * 2
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(pale, 0, 0, c.width, c.height)
    const an = ((p.n || 0) * 2.399) % (Math.PI * 2), dx = Math.cos(an) * c.width / 2, dy = Math.sin(an) * c.height / 2
    const m = g.createLinearGradient(c.width / 2 - dx, c.height / 2 - dy, c.width / 2 + dx, c.height / 2 + dy)
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.45, 'rgba(0,0,0,0.85)'); m.addColorStop(1, 'rgba(0,0,0,0.05)')
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = m; g.fillRect(0, 0, c.width, c.height)
    const t = g.createLinearGradient(c.width / 2 - dx, c.height / 2 - dy, c.width / 2 + dx, c.height / 2 + dy)
    t.addColorStop(0.3, 'rgba(40,60,90,0)'); t.addColorStop(1, 'rgba(40,60,90,0.7)')
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = t; g.fillRect(0, 0, c.width, c.height)
    return c
  })())
  // the swell under it: a slow lift and fall, each its own (two waves out of step, so it never quite repeats), a little
  // drift with it, and as it lifts more of it shows
  const ph = (p.n || 0) * 1.7 + p.x * 0.9, sw = Math.sin(h.t * 0.85 + ph) * 0.7 + Math.sin(h.t * 0.53 + ph * 1.3) * 0.3
  const bob = h._P(p.x + Math.sin(h.t * 0.31 + ph) * 0.06, p.y + Math.cos(h.t * 0.27 + ph) * 0.04, p.z + sw * 0.05) || at
  const w = k * (p.s ?? 1.1), hh = w * p.sh / p.sw
  ctx.save(); ctx.imageSmoothingEnabled = true
  ctx.globalAlpha = Math.min(1, (p.a ?? 0.55) * (1 + sw * 0.12))
  ctx.translate(bob.x, bob.y); ctx.scale(1, 0.5)
  ctx.rotate((p.rot ?? 0) + Math.sin(h.t * 0.07 + (p.n || 0)) * 0.08 + Math.sin(h.t * 0.85 + ph - 0.8) * 0.025)
  ctx.drawImage(own, -w / 2, -hh / 2, w, hh)
  ctx.restore()
}

// { type: 'wake', y0, y1, z }: open water's rings where you pressed against it (hewnRock.bump): two, going out and
// fading, drawn a row's slice at a time on the water (so the nearer water does not cover them)
export function drawWake(h, ctx, p) {
  const r = p.row, z = p.z ?? 0
  const live = (h.bumps || []).filter(b => h.t - b.t0 >= 0 && h.t - b.t0 < 5); if (!live.length) return
  const near = live.filter(b => b.y + 2.6 >= r && b.y - 2.6 <= r + 1); if (!near.length) return
  ctx.save(); ctx.beginPath(); let any = false                        // only on this row's water
  for (let c = 0; c < h.W; c++) {
    if (!h.isWater(c, r)) continue
    let e = c; while (e + 1 < h.W && h.isWater(e + 1, r)) e++
    const q = [h._P(c, r, z), h._P(e + 1, r, z), h._P(e + 1, r + 1, z), h._P(c, r + 1, z)]
    if (q.every(Boolean)) { ctx.moveTo(q[0].x, q[0].y - 0.5); ctx.lineTo(q[1].x, q[1].y - 0.5); ctx.lineTo(q[2].x, q[2].y + 0.5); ctx.lineTo(q[3].x, q[3].y + 0.5); ctx.closePath(); any = true }
    c = e
  }
  if (!any) { ctx.restore(); return }
  ctx.clip()
  for (const b of near) {
    for (const lag of [0, 0.9]) {
      const a = h.t - b.t0 - lag; if (a < 0) continue
      const u = a / (5 - lag), R = 0.15 + 2.3 * Math.sqrt(u), al = 0.32 * (1 - u) * (lag ? 0.6 : 1); if (al <= 0.01) continue
      ctx.beginPath(); let ok = false
      for (let i = 0; i <= 40; i++) { const th = i / 40 * Math.PI * 2, q = h._P(b.x + Math.cos(th) * R, b.y + Math.sin(th) * R, z); if (!q) continue; ok ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); ok = true }
      if (!ok) continue
      ctx.strokeStyle = `rgba(200,212,232,${al.toFixed(3)})`; ctx.lineWidth = Math.max(1, h._k(b.y) * 0.022); ctx.stroke()
    }
  }
  ctx.restore()
}

// ═════════ far off, and fog ═══════════════════════════════════
// { type: 'farrock', x, y (far out, past the map's edge), z (the sea), w, h }: a rock in the sea seen a long way off: a
// dark mass, its top ragged, an arch through it at the waterline with a light in it, the fog thick about its foot.
// Drawn first, with the farthest row (hewnRock.js MULTI).
// Teach Duinn, the Bull: a great steep-sided rock, its top broad and broken, and through the middle of it at the waterline
// the tunnel, so the light shows clean through; a smaller rock (the Cow) off to one side
const ROCK = [[-1, 0], [-0.94, 0.22], [-0.86, 0.52], [-0.74, 0.74], [-0.6, 0.86], [-0.46, 0.9], [-0.34, 0.97], [-0.18, 1.0], [-0.02, 0.95], [0.12, 0.98], [0.28, 0.92], [0.44, 0.88], [0.58, 0.8], [0.72, 0.64], [0.84, 0.42], [0.93, 0.2], [1, 0]]
const ARCH = [[-0.2, 0], [-0.21, 0.16], [-0.17, 0.27], [-0.09, 0.33], [0.0, 0.32], [0.08, 0.26], [0.12, 0.15], [0.12, 0]]
const COW = [[-1, 0], [-0.8, 0.5], [-0.5, 0.85], [-0.1, 1.0], [0.35, 0.8], [0.75, 0.45], [1, 0]]
function farMass(h, ctx, p, cx, w, ht, outline, arch) {
  const P = ([u, v]) => h._P(cx + u * w / 2, p.y, p.z + v * ht)
  const pts = outline.map(P), hole = arch ? arch.map(P) : null
  if (pts.some(q => !q) || (hole && hole.some(q => !q))) return null
  const top = Math.min(...pts.map(q => q.y)), base = pts[0].y
  const g = ctx.createLinearGradient(0, top, 0, base); g.addColorStop(0, 'rgb(10,12,16)'); g.addColorStop(0.75, 'rgb(15,18,23)'); g.addColorStop(1, 'rgb(24,28,35)')
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath()
  if (hole) { hole.slice().reverse().forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath() }
  ctx.fillStyle = g; ctx.fill('evenodd')
  ctx.strokeStyle = 'rgba(150,162,180,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); pts.slice(1, -1).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke()
  return { pts, hole, top, base }
}
export function drawFarRock(h, ctx, p) {
  if (p.row !== 0) return
  const base0 = h._P(p.x, p.y, p.z); if (!base0) return
  ctx.save()
  // the sea on out past the map's edge to the rock's foot: dark, paler toward the fog far off
  const e0 = h._P(p.x, 0, p.z)
  if (e0 && e0.y > base0.y) {
    const sg = ctx.createLinearGradient(0, base0.y - 3, 0, e0.y + 2); sg.addColorStop(0, 'rgb(44,51,61)'); sg.addColorStop(1, 'rgb(9,11,15)')
    ctx.fillStyle = sg; ctx.fillRect(0, base0.y - 3, h.cam.sw, e0.y - base0.y + 5)
  }
  farMass(h, ctx, p, p.x + p.w * 0.78, p.w * 0.32, p.h * 0.38, COW, null)              // the Cow
  const R = farMass(h, ctx, p, p.x, p.w, p.h, ROCK, ARCH)                               // the Bull, and the way through it
  if (R) {
    const H = R.hole, ax = (H[0].x + H[H.length - 1].x) / 2, ay = R.base, ar = Math.abs(H[H.length - 1].x - H[0].x)
    ctx.save(); ctx.beginPath(); H.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.clip()
    const lg = ctx.createRadialGradient(ax, ay, 0, ax, ay, ar); lg.addColorStop(0, 'rgba(236,240,250,0.95)'); lg.addColorStop(1, 'rgba(160,175,200,0.85)')
    ctx.fillStyle = lg; ctx.fillRect(ax - ar, ay - ar * 1.5, ar * 2, ar * 1.6)
    ctx.restore()
    ctx.globalCompositeOperation = 'lighter'
    const gg = ctx.createRadialGradient(ax, ay, 0, ax, ay, ar * 1.6); gg.addColorStop(0, 'rgba(215,228,255,0.3)'); gg.addColorStop(1, 'rgba(215,228,255,0)')
    ctx.fillStyle = gg; ctx.fillRect(ax - ar * 2, ay - ar * 2, ar * 4, ar * 2.4)
  }
  ctx.restore()
}
// { type: 'murk', x0, x1, y0, y1, a }: a stair going down into the dark: each row from y0 to y1 darker than the last,
// its step and its riser both (up to a at the bottom)
export function drawMurk(h, ctx, p) {
  const r = p.row, n = p.y1 - p.y0 + 1, a = (p.a ?? 0.9) * Math.pow(Math.min(1, (r - p.y0 + 1) / n), 0.6)
  const cm = Math.floor((p.x0 + p.x1) / 2), z0 = h.walkZ(cm, r), z1 = h.walkZ(cm, r + 1) ?? z0
  if (z0 == null) return
  const Q = (x, y, z) => h._P(x, y, z)
  const pts = [Q(p.x0, r, z0 + 0.02), Q(p.x1, r, z0 + 0.02), Q(p.x1, r + 1, z0 + 0.02), Q(p.x1, r + 1, z1), Q(p.x0, r + 1, z1), Q(p.x0, r + 1, z0 + 0.02)]
  if (pts.some(q => !q)) return
  const L = Q(p.x0, r + 1, z1), R = Q(p.x1, r + 1, z1), f = 1 / (p.x1 - p.x0)          // (soft at its two sides)
  const g = ctx.createLinearGradient(L.x, 0, R.x, 0), c = (k) => `rgba(2,3,6,${(a * k).toFixed(3)})`
  g.addColorStop(0, c(0)); g.addColorStop(f * 1.2, c(1)); g.addColorStop(1 - f * 1.2, c(1)); g.addColorStop(1, c(0))
  ctx.save(); ctx.fillStyle = g
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill()
  ctx.restore()
}
// { type: 'seafog', row0, z, rgb, a }: distance over still water. Drawn once all the rows up to row0 are down (and before
// the nearer ones): a veil of fog over the screen, clear at row0's line, thickening smoothly out to the horizon (rgb at a),
// then thinning again up into the dark above it. Whatever is far off goes into it: the water, the dead on it, the boat,
// the rock.
export function drawSeaFog(h, ctx, p) {
  const near = h._P(h.cam.col, p.row0 + 1, p.z), edge = h._P(h.cam.col, 0, p.z), hor = h._P(h.cam.col, -400, p.z)
  if (!near || !edge || !hor || near.y <= edge.y) return
  const top = hor.y - (near.y - hor.y) * 0.6, span = near.y - top, f = (y) => Math.min(1, Math.max(0, (y - top) / span))
  const [r, g, b] = p.rgb || [44, 51, 61], A = p.a ?? 0.9, c = (a) => `rgba(${r},${g},${b},${a.toFixed(3)})`
  const gr = ctx.createLinearGradient(0, top, 0, near.y)
  gr.addColorStop(0, c(0))
  gr.addColorStop(f(hor.y - (edge.y - hor.y) * 0.8), c(A * 0.25))
  gr.addColorStop(f(hor.y), c(A * 0.85))
  gr.addColorStop(f(edge.y), c(A))                                   // the map's far edge: the sea past it is all fog
  gr.addColorStop(f(edge.y + (near.y - edge.y) * 0.35), c(A * 0.6))
  gr.addColorStop(f(edge.y + (near.y - edge.y) * 0.7), c(A * 0.2))
  gr.addColorStop(1, c(0))
  ctx.save(); ctx.fillStyle = gr; ctx.fillRect(0, top, h.cam.sw, span + 1); ctx.restore()
}
// { type: 'fogbank', x0, x1, y, z, h, a, speed }: a bank of fog (assets/fog01.png) standing up off the water across the
// view at row y, drifting slowly sideways
let FOG = null, FOGF = null
export function drawFogBank(h, ctx, p) {
  if (!FOG) { FOG = new Image(); FOG.src = 'assets/fog01.png' }
  if (!FOG.complete || !FOG.naturalWidth) return
  if (!FOGF) {                                                        // the picture, faded out at its top and its foot
    FOGF = document.createElement('canvas'); FOGF.width = FOG.naturalWidth; FOGF.height = FOG.naturalHeight
    const g = FOGF.getContext('2d'); g.drawImage(FOG, 0, 0)
    const m = g.createLinearGradient(0, 0, 0, FOGF.height); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.35, 'rgba(0,0,0,1)'); m.addColorStop(0.6, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)')
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = m; g.fillRect(0, 0, FOGF.width, FOGF.height)
  }
  const L = h._P(p.x0, p.y, p.z), R = h._P(p.x1, p.y, p.z), T = h._P(p.x0, p.y, p.z + p.h)
  if (!L || !R || !T) return
  const w = R.x - L.x, ht = L.y - T.y; if (w < 2 || ht < 1) return
  const off = ((h.t * (p.speed ?? 0.02) * w) % w + w) % w
  ctx.save(); ctx.globalAlpha = p.a ?? 0.35; ctx.globalCompositeOperation = 'screen'
  ctx.beginPath(); ctx.rect(L.x, T.y, w, ht); ctx.clip()
  ctx.drawImage(FOGF, L.x - off, T.y, w, ht); ctx.drawImage(FOGF, L.x - off + w, T.y, w, ht)
  ctx.restore()
}

// ═════════ raised floor-stones ═══════════════════════════════════
// { type: 'stones', cells: [{ n, j, z }], y0, y1 }: stones of the hand-laid floor (floorStones.mjs) pushed up to height z. Each
// is a piece of a ring: its top is the floor's own picture (so its joints and tone are the floor's), its faces the stone's
// edge in the colour of the floor at that edge, with a course joint at every third of a tile. Drawn, as the pool is, a row's
// slice at a time, so you and the figures go in front of and behind them as they should.
const TOP_STONE = 1 / 3
function buildStones(h, p, A) {
  const co = courses(A), TPx = h.base.width / h.W, raised = new Map()
  for (const c of p.cells) raised.set(c.n + ',' + c.j, c.z)
  // how high the ground is at a point: a raised (or lowered) stone's top, else the floor there (its tile's height: a stair
  // of stones can stand on a floor laid lower down)
  const ground = (x, y) => { const i = Math.floor(y) * h.W + Math.floor(x); return i >= 0 && i < h.k.length && h.k[i] === 0 ? h.z[i] : 0 }
  const zOf = (x, y) => { const c = cellAt(A, x, y, co); return c ? (raised.get(c.n + ',' + c.j) ?? ground(x, y)) : ground(x, y) }
  const bctx = h.base.getContext('2d')
  const cells = p.cells.map(c => {
    const G = cellGeom(A, c.n, c.j, co), ns = Math.max(3, Math.ceil((G.t1 - G.t0) * (A.rx + A.ry) / 2 * 5 / 2)), tt = (i) => G.t0 + (G.t1 - G.t0) * i / ns
    const inner = [], outer = []
    for (let i = 0; i <= ns; i++) { inner.push({ ...ptAt(A, G.ga, tt(i)), z: c.z }); outer.push({ ...ptAt(A, G.gb, tt(i)), z: c.z }) }
    const top = [...inner, ...outer.slice().reverse()]
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const q of top) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y) }
    // the picture's colour inside the stone's edge (once: the floor's picture is read where the face is)
    const bx = Math.max(0, Math.floor(x0 * TPx) - 2), by = Math.max(0, Math.floor(y0 * TPx) - 2), bw = Math.min(h.base.width - bx, Math.ceil((x1 - x0) * TPx) + 5), bh = Math.min(h.base.height - by, Math.ceil((y1 - y0) * TPx) + 5)
    const img = bctx.getImageData(bx, by, bw, bh).data
    const col = (x, y) => { const px = Math.min(bw - 1, Math.max(0, Math.floor(x * TPx) - bx)), py = Math.min(bh - 1, Math.max(0, Math.floor(y * TPx) - by)), o = (py * bw + px) * 4; return [img[o], img[o + 1], img[o + 2]] }
    const gi = G.ga + 0.1, go = G.gb - 0.1
    // the face toward the dais (the inner arc): a run of pieces, each as high as the stone beside it is low
    const south = []
    for (let i = 0; i < ns; i++) {
      const tm = (tt(i) + tt(i + 1)) / 2, mid = ptAt(A, G.ga - 0.06, tm), zl = Math.min(c.z, zOf(mid.x, mid.y))
      if (zl >= c.z - 0.01) continue
      const a = inner[i], b = inner[i + 1], m = ptAt(A, G.ga, tm), nx = -Math.cos(tm) / (A.rx + G.ga), ny = -Math.sin(tm) / (A.ry + G.ga), nl = Math.hypot(nx, ny)
      south.push({ q: [{ ...a, z: c.z }, { ...b, z: c.z }, { ...b, z: zl }, { ...a, z: zl }], zl, mx: m.x, my: m.y, nx: nx / nl, ny: ny / nl, rgb: col(...Object.values(ptAt(A, gi, tm))) })
    }
    // the face away from the dais (the outer arc): only where the stone stands over a lower floor beyond it (a kerb over a
    // stair going down outside it)
    const north = []
    for (let i = 0; i < ns; i++) {
      const tm = (tt(i) + tt(i + 1)) / 2, mid = ptAt(A, G.gb + 0.06, tm), zl = Math.min(c.z, zOf(mid.x, mid.y))
      if (zl >= c.z - 0.01) continue
      const a = outer[i], b = outer[i + 1], m = ptAt(A, G.gb, tm), nx = Math.cos(tm) / (A.rx + G.gb), ny = Math.sin(tm) / (A.ry + G.gb), nl = Math.hypot(nx, ny)
      north.push({ q: [{ ...b, z: c.z }, { ...a, z: c.z }, { ...a, z: zl }, { ...b, z: zl }], zl, mx: m.x, my: m.y, nx: nx / nl, ny: ny / nl, rgb: col(...Object.values(ptAt(A, go, tm))) })
    }
    // (each run of pieces along an arc made one face, so a tall face has no seams down it)
    const runs = (L, outerArc) => {
      const out = []; let cur = null
      for (const F of L) {
        if (cur && Math.hypot(cur.last.x - F.q[outerArc ? 1 : 0].x, cur.last.y - F.q[outerArc ? 1 : 0].y) < 1e-6) { cur.list.push(F); cur.last = F.q[outerArc ? 0 : 1] }
        else { cur = { list: [F], last: F.q[outerArc ? 0 : 1] }; out.push(cur) }
      }
      return out.map(({ list }) => {
        if (list.length === 1) return list[0]
        const tops = outerArc ? [list[0].q[1], ...list.map(F => F.q[0])] : [list[0].q[0], ...list.map(F => F.q[1])]
        const bots = outerArc ? [list[0].q[2], ...list.map(F => F.q[3])] : [list[0].q[3], ...list.map(F => F.q[2])]
        const M = list[list.length >> 1]
        return { q: [...tops, ...bots.reverse()], top2: [tops[0], tops[tops.length - 1]], zl: Math.min(...list.map(F => F.zl)), mx: M.mx, my: M.my, nx: M.nx, ny: M.ny, rgb: M.rgb }
      })
    }
    // the two radial faces
    const sides = []
    for (const [t, dir] of [[G.t0, -1], [G.t1, 1]]) {
      const a = ptAt(A, G.ga, t), b = ptAt(A, G.gb, t), mid = ptAt(A, (G.ga + G.gb) / 2, t + dir * 0.012), zn = ptAt(A, (G.ga + G.gb) / 2, t + dir * 0.012)
      const out = zOf(mid.x + dir * 0, mid.y)
      const o = ptAt(A, (G.ga + G.gb) / 2, t + dir * 0.03), zl = Math.min(c.z, zOf(o.x, o.y))
      if (zl >= c.z - 0.01) continue
      const tgx = -(A.rx + (G.ga + G.gb) / 2) * Math.sin(t), tgy = (A.ry + (G.ga + G.gb) / 2) * Math.cos(t), tl = Math.hypot(tgx, tgy)
      const im = ptAt(A, (G.ga + G.gb) / 2, t - dir * 0.02)
      sides.push({ q: [{ ...a, z: c.z }, { ...b, z: c.z }, { ...b, z: zl }, { ...a, z: zl }], zl, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, nx: dir * tgx / tl, ny: dir * tgy / tl, rgb: col(im.x, im.y) })
    }
    return { z: c.z, dk: c.dk || 0, tx: !!c.tx, solid: !!c.solid, src: [bx, by, bw, bh], top, south: runs(south, false), north: runs(north, true), sides, r0: Math.floor(y0 - 0.05), r1: Math.floor(y1 + 0.05), cy: (y0 + y1) / 2, cx: (x0 + x1) / 2, x0, x1 }
  })
  return { cells }
}
export function drawStones(h, ctx, p) {
  const A = h.floorArt, r = p.row
  if (!A || !h.litCv) return
  if (!p._S) p._S = buildStones(h, p, A)
  const TPx = h.base.width / h.W, cx = h.cam.col, cr = h.cam.row
  const band = (poly, e = 0.04) => clipBand(poly, r - e, r + 1 + e)
  const cells = p._S.cells.filter(c => r >= c.r0 && r <= c.r1).sort((a, b) => a.cy - b.cy || Math.abs(b.cx - cx) - Math.abs(a.cx - cx))
  const lw = Math.max(1, h._k(r + 0.5) * 0.014)
  for (const c of cells) {
    const z = c.z
    // the top: the floor's picture at this height, laid in strips, clipped to the stone
    const poly = band(c.top)
    if (poly.length >= 3) {
      ctx.save(); ctx.beginPath()
      if (worldPath(h, ctx, poly)) {
        ctx.clip()
        let a = Infinity, b = -Infinity; for (const q of poly) { a = Math.min(a, q.x); b = Math.max(b, q.x) }
        const c0 = Math.max(0, Math.floor(a)), c1 = Math.min(h.W - 1, Math.floor(b))
        h._strips(ctx, h.litCv, r, c0, c1, z, c0 * TPx, (c1 + 1) * TPx, r * TPx, h._Y(r, z), h._Y(r + 1, z))
        if (c.dk) { ctx.fillStyle = `rgba(2,3,6,${(c.dk * 0.8).toFixed(3)})`; ctx.fillRect(0, h._Y(r, z) - 2, h.cam.sw, h._Y(r + 1, z) - h._Y(r, z) + 4) }   // going down into the dark
      }
      ctx.restore()
    }
    // the faces you can see
    for (const F of [...c.south, ...c.north, ...c.sides]) {
      if ((cx - F.mx) * F.nx + (cr - F.my) * F.ny <= 0) continue
      const q = band(F.q, 0.03); if (q.length < 3) continue
      const zm = (z + F.zl) / 2, L = h.lightAt(F.mx + F.nx * 0.15, F.my + F.ny * 0.15, zm, -1)
      const k = 0.95 * (F.nx * F.nx > F.ny * F.ny ? 0.82 : 1) * (1 - c.dk * 0.55)        // (a riser darkens less than its step: the steps still read, going down)
      ctx.beginPath(); if (!worldPath(h, ctx, q)) continue
      if (c.tx) {                                    // cut from the same block: the stone's own picture, laid over the face, then lit
        ctx.save(); ctx.clip()
        let a = Infinity, b = Infinity, e = -Infinity, f = -Infinity; for (const P of q) { const S = h._P(P.x, P.y, P.z); if (S) { a = Math.min(a, S.x); b = Math.min(b, S.y); e = Math.max(e, S.x); f = Math.max(f, S.y) } }
        if (e > a && f > b) {
          if (!c.pat) {                              // (the stone's piece of the picture, repeated at the floor's own scale)
            const cv = document.createElement('canvas'); cv.width = Math.max(1, c.src[2]); cv.height = Math.max(1, c.src[3])
            cv.getContext('2d').drawImage(h.base, c.src[0], c.src[1], c.src[2], c.src[3], 0, 0, cv.width, cv.height)
            c.pat = ctx.createPattern(cv, 'repeat')
          }
          const T = h._P(F.q[0].x, F.q[0].y, z), ks = h._k(F.my) / TPx
          if (c.pat.setTransform && T) c.pat.setTransform(new DOMMatrix([ks, 0, 0, ks, T.x, T.y]))
          ctx.fillStyle = c.pat; ctx.fillRect(a, b, e - a, f - b)
          ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = h._rgb(L.map(v => clamp01(v * 1.1)), [255 * k, 255 * k, 255 * k]); ctx.fillRect(a, b, e - a, f - b)
        }
        ctx.restore()
      } else { ctx.fillStyle = h._rgb(L.map(v => clamp01(v * 1.05)), F.rgb.map(v => v * k)); ctx.fill() }
      ctx.lineJoin = 'round'
      if (c.solid) continue                          // (a step is one stone, no courses in it)
      ctx.strokeStyle = 'rgba(8,10,16,0.5)'; ctx.lineWidth = lw
      for (let zz = z - TOP_STONE; zz > F.zl + 0.05; zz -= TOP_STONE) {          // a course joint at every third of a tile
        const [A0, A1] = F.top2 || F.q, a = h._P(A0.x, A0.y, zz), b = h._P(A1.x, A1.y, zz)
        if (a && b && Math.floor((A0.y + A1.y) / 2) === r) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
      }
    }
    // the nosing: a light line along the front edge of the top, and a dark seam under it
    for (const F of c.solid ? [...c.south, ...c.sides] : c.south) {
      const away = (cx - F.mx) * F.nx + (cr - F.my) * F.ny <= 0
      if ((away && !c.solid) || Math.floor(F.my) !== r) continue
      const [A0, A1] = F.top2 || F.q, a = h._P(A0.x, A0.y, z), b = h._P(A1.x, A1.y, z); if (!a || !b) continue
      if (away) {                                    // a step going down away from you: its edge, worn pale, and the dark of the drop past it
        const d0 = h._P(A0.x + F.nx * 0.07, A0.y + F.ny * 0.07, z - 0.05), d1 = h._P(A1.x + F.nx * 0.07, A1.y + F.ny * 0.07, z - 0.05)
        if (d0 && d1) { ctx.strokeStyle = `rgba(2,3,6,${(0.75 * (1 - c.dk * 0.3)).toFixed(3)})`; ctx.lineWidth = lw * 2.2; ctx.beginPath(); ctx.moveTo(d0.x, d0.y); ctx.lineTo(d1.x, d1.y); ctx.stroke() }
      }
      ctx.strokeStyle = `rgba(235,240,250,${((away ? 0.3 : 0.22) * (1 - c.dk * 0.5)).toFixed(3)})`; ctx.lineWidth = lw * 1.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    }
  }
}

// ═════════ the well hall's floor ═════════════════════════════════════════════════════════════════════════════════════
// mapData.hewn.floorArt = { cx, cy, rx, ry, g0, rect: [x0, y0, x1, y1], ring, channels: [{ pts: [[x, y]...], rgb }] }.
// The floor is laid in rings out from the dais (courses of cut slate, joints running out from the pool), a ring of water
// round the dais's foot, and a channel from it to each gate, each in a border of its gate's colour with a plait carved
// beside it. Painted once, into the map's floor picture (and a second picture for what glows: lichen in the joints).
// (h2, the hash, and WIDS, the courses' widths, are floorStones.mjs's: the stones are chosen by it too)
const vn = (x, y, s) => {                                             // smooth value noise
  const X = Math.floor(x), Y = Math.floor(y), fx = x - X, fy = y - Y, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  return (h2(X, Y + s * 977) * (1 - u) + h2(X + 1, Y + s * 977) * u) * (1 - v) + (h2(X, Y + 1 + s * 977) * (1 - u) + h2(X + 1, Y + 1 + s * 977) * u) * v
}
function resample(pts, ds) {                                          // a polyline as points `ds` apart, with the unit normal and distance along at each
  const out = []; let acc = 0, nxt = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay); if (!L) continue
    while (nxt <= acc + L) { const t = (nxt - acc) / L; out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, nx: -(by - ay) / L, ny: (bx - ax) / L, s: nxt }); nxt += ds }
    acc += L
  }
  return out
}
// the dais's steps as courses of the floor's stone: A.treads are the offsets g (out from the water) where each begins; NEGE
// them as offsets from the first ring course (negative), then 0; one { e0, w, m stones round, len, off } for each
function negCourses(A) {
  const { rx, ry, g0 } = A, NEGE = [...(A.treads || []).map(g => g - g0), 0]
  const negInfo = NEGE.slice(0, -1).map((e0, m) => {
    const w = NEGE[m + 1] - e0, n = m - (NEGE.length - 1), gm = g0 + e0 + w / 2, a = rx + gm, c = ry + gm, per = Math.PI * (3 * (a + c) - Math.sqrt((3 * a + c) * (a + 3 * c)))
    const mm = Math.max(6, Math.round(per / (w * 1.3)))
    return { e0, w, m: mm, len: per / mm, off: h2(n, 5) }
  })
  return { NEGE, negInfo }
}
export function paintFloorArt(h, b, TP, gl) {
  const A = h.floorArt, { cx, cy, rx, ry, g0 } = A, [rx0, ry0, rx1, ry1] = A.rect
  const E = [0]; while (E[E.length - 1] < 34) E.push(E[E.length - 1] + WIDS[(E.length - 1) % WIDS.length])
  const info = E.slice(0, -1).map((e0, n) => {
    const w = E[n + 1] - e0, gm = g0 + e0 + w / 2, a = rx + gm, c = ry + gm, per = Math.PI * (3 * (a + c) - Math.sqrt((3 * a + c) * (a + 3 * c)))
    const m = Math.max(6, Math.round(per / (w * 1.3)))
    return { e0, w, m, len: per / m, off: h2(n, 5) }
  })
  // the dais's own steps are courses of the same stone, going on inward (A.treads: where each begins, out from the water)
  const { NEGE, negInfo } = negCourses(A)
  // 1. the stone, pixel by pixel
  const PW = (rx1 - rx0) * TP, PH = (ry1 - ry0) * TP, tmp = document.createElement('canvas'); tmp.width = PW; tmp.height = PH
  const tc = tmp.getContext('2d'), img = tc.createImageData(PW, PH), d = img.data
  const ok = (c, r) => { const i = r * h.W + c; if (c < 0 || r < 0 || c >= h.W || r >= h.H) return false; const s = h.span.get(i); return (s && s.walk === 'deck') || h.k[i] === 0 }
  const edge = new Uint8Array(h.W * h.H)
  for (let r = 0; r < h.H; r++) for (let c = 0; c < h.W; c++) if (ok(c, r) && !(A.nokerb || []).some(([a0, b0, a1, b1]) => c >= a0 && c <= a1 && r >= b0 && r <= b1)) { for (let dy2 = -1; dy2 <= 1; dy2++) for (let dx2 = -1; dx2 <= 1; dx2++) if (!ok(c + dx2, r + dy2)) edge[r * h.W + c] = 1 }
  for (let py = 0; py < PH; py++) {
    const wy = ry0 + (py + 0.5) / TP, dy = wy - cy
    for (let px = 0; px < PW; px++) {
      const wx = rx0 + (px + 0.5) / TP
      if (!ok(Math.floor(wx), Math.floor(wy))) continue
      const dx = wx - cx
      let g = Math.max(g0, (Math.hypot(dx / rx, dy / ry) - 1) * Math.sqrt(rx * ry))
      for (let it = 0; it < 4; it++) {
        const a = rx + g, c = ry + g, f = dx * dx / (a * a) + dy * dy / (c * c) - 1
        g += f / (2 * (dx * dx / (a * a * a) + dy * dy / (c * c * c)) + 1e-9)
      }
      const o = (py * PW + px) * 4
      let R, G, B
      const q = g - g0, tcx = Math.floor(wx), tcy = Math.floor(wy)
      if (q < NEGE[0]) { R = 62; G = 66; B = 76 }
      else if (q >= 0 && edge[tcy * h.W + tcx]) {                              // the kerb: a course of long dark slabs laid along the wall
        const bx = wx + (Math.floor(wy * 2) % 2) * 0.5, fx = bx - Math.floor(bx), fy = wy * 2 - Math.floor(wy * 2), sj = h2(Math.floor(bx), Math.floor(wy * 2) + 91)
        const k = 0.8 + 0.3 * sj + (h2(px, py) - 0.5) * 0.06 + (vn(wx * 5, wy * 5, 6) - 0.5) * 0.16
        R = 66 * k; G = 70 * k; B = 82 * k
        const de = Math.min(fx, 1 - fx, fy / 2, (1 - fy) / 2)
        if (de < 0.03) { R = 20; G = 22; B = 28 } else if (fy < 0.14 || fx < 0.07) { R *= 1.22; G *= 1.22; B *= 1.25 } else if (fy > 0.9) { R *= 0.8; G *= 0.8; B *= 0.8 }
      } else {
        // the joints wander a little, as if cut by hand
        const qs = q + (vn(wx * 1.7, wy * 1.7, 3) - 0.5) * 0.016, tw = Math.atan2(dy / (ry + g), dx / (rx + g)) + (vn(wx * 2.3, wy * 2.3, 4) - 0.5) * 0.008
        let n, I, qw
        if (q < 0) {                                                                         // a step of the dais
          qw = Math.min(-1e-4, Math.max(NEGE[0] + 1e-4, qs)); let m = negInfo.length - 1; while (m > 0 && NEGE[m] > qw) m--
          n = m - negInfo.length; I = negInfo[m]
        } else {
          qw = Math.max(0, qs)
          n = Math.min(info.length - 1, Math.floor(qw / 0.98)); while (n > 0 && E[n] > qw) n--; while (n < info.length - 1 && E[n + 1] <= qw) n++
          I = info[n]
        }
        const v = (qw - I.e0) / I.w
        const u = ((tw + Math.PI) / (Math.PI * 2) + I.off) * I.m, j = Math.floor(u), fu = u - j, jj = ((j % I.m) + I.m) % I.m, sd = n * 131 + jj
        const dr = Math.min(v, 1 - v) * I.w, dt = Math.min(fu, 1 - fu) * I.len, de = Math.min(dr, dt)
        const band = n === 3 ? 1 : n === 6 ? 2 : n === -negInfo.length ? (jj % 2 ? 1 : 2) : 0      // a band of carved spirals; a band of ogham; the rim: one or the other on each stone
        const damp = vn(wx * 0.5, wy * 0.5, 1), grain = (h2(px, py) - 0.5) * 0.07, pat = vn(wx * 5, wy * 5, 2) - 0.5
        let k = (0.88 + 0.22 * h2(sd, n)) * (n % 3 === 0 ? 1.12 : 1) * (1 + pat * 0.22 + grain)
        if (damp > 0.6) k *= 0.82
        if (q < 1.8) k *= 0.88 + 0.12 * Math.max(0, q) / 1.8                                              // wetter at the dais's foot
        R = 92 * k; G = 97 * k; B = 108 * k
        const hs = h2(sd, 9)
        if (hs < 0.12) { R *= 1.07; G *= 0.97; B *= 0.88 } else if (hs > 0.9) { R *= 0.9; G *= 0.98; B *= 1.1 }      // a warmer stone now and then, a bluer
        if (band) { R = R * 1.12 + 8; G = G * 1.1 + 6; B = B * 1.05 + 4 }
        // a stone's edges: a light edge toward the light (north-west), a dark one away, a dark seam between
        const rr = Math.hypot(dx / ((rx + g) ** 2), dy / ((ry + g) ** 2)) || 1, nx = dx / ((rx + g) ** 2) / rr, ny = dy / ((ry + g) ** 2) / rr
        const rad = v < 0.5 ? -1 : 1, tan = fu < 0.5 ? -1 : 1
        const lit = dr < dt ? (nx * rad * -0.55 + ny * rad * -0.83) : (-ny * tan * -0.55 + nx * tan * -0.83)
        if (de < 0.032) { R = 24; G = 26; B = 32 }
        else {
          if (de < 0.17) { const ao = 1 - 0.16 * (1 - de / 0.17); R *= ao; G *= ao; B *= ao }
          if (de < 0.075) { const e = lit > 0.25 ? 1.38 : lit < -0.25 ? 0.72 : 1.05; R *= e; G *= e; B *= e }
          const cu = Math.min(fu, 1 - fu) * I.len, cv = Math.min(v, 1 - v) * I.w                    // a chipped corner
          if (cu + cv < 0.14 && h2(sd, 21) < 0.2) { R *= 0.38; G *= 0.38; B *= 0.42 }
          if (h2(sd, 33) < 0.1 && Math.abs(vn(wx * 4.6 + sd, wy * 4.6, 5) - 0.5) < 0.012) { R = 22; G = 24; B = 30 }      // a crack
          const sp = h2(px * 3 + 1, py * 5 + 7); if (sp < 0.012) { R *= 1.3; G *= 1.3; B *= 1.35 } else if (sp < 0.03) { R *= 0.78; G *= 0.78; B *= 0.8 }
          const lx = (fu - 0.5) * I.len, ly = (v - 0.5) * I.w
          if (band === 1) {                                                                           // a spiral on each stone
            const r2 = Math.hypot(lx, ly), th = Math.atan2(ly, lx), ss = r2 / 0.085 - th / (Math.PI * 2) + h2(sd, 3)
            if (r2 < 0.38 * I.w && ss - Math.floor(ss) < 0.3) { R = 30; G = 32; B = 40 } else if (r2 < 0.4 * I.w && ss - Math.floor(ss) < 0.4) { R *= 1.25; G *= 1.25; B *= 1.3 }
          } else if (band === 2) {                                                                    // ogham: a stem and notches
            const cnt = 1 + Math.floor(h2(sd, 4) * 5), kk = Math.round(lx / 0.15 + (cnt - 1) / 2), cx2 = (kk - (cnt - 1) / 2) * 0.15
            if (Math.abs(ly) < 0.022 && Math.abs(lx) < 0.5 * I.len * 0.85) { R = 30; G = 32; B = 40 }
            else if (kk >= 0 && kk < cnt && Math.abs(lx - cx2) < 0.022 && Math.abs(ly) < 0.2) { R = 30; G = 32; B = 40 }
          }
        }
      }
      d[o] = R; d[o + 1] = G; d[o + 2] = B; d[o + 3] = 255
    }
  }
  tc.putImageData(img, 0, 0)
  b.drawImage(tmp, rx0 * TP, ry0 * TP)
  // 2. the water: the ring at the dais's foot and a channel from it to each gate, each in a border of its gate's colour
  b.save(); b.scale(TP, TP); b.lineJoin = 'round'; b.lineCap = 'round'
  const ringPts = []; const rg = g0 + (A.ring ?? 0.62)
  for (let i = 0; i <= 180; i++) { const a = i / 180 * Math.PI * 2; ringPts.push([cx + Math.cos(a) * (rx + rg), cy + Math.sin(a) * (ry + rg)]) }
  const paths = A.ring === false ? [...A.channels] : [{ pts: ringPts, rgb: [150, 160, 180], ring: true }, ...A.channels]
  const stroke = (pts, w, col) => { b.beginPath(); pts.forEach(([x, y], i) => (i ? b.lineTo(x, y) : b.moveTo(x, y))); b.strokeStyle = col; b.lineWidth = w; b.stroke() }
  const mixc = (rgb, k, base = [124, 128, 140]) => base.map((v, i) => Math.round(v * (1 - k) + rgb[i] * k))
  for (const P of paths) {                                            // the border: dark edge, then the paler stone of the gate's colour
    const band = mixc(P.rgb, P.ring ? 0.1 : 0.3)
    stroke(P.pts, 1.5, 'rgb(24,26,32)'); stroke(P.pts, 1.4, `rgb(${band})`)
  }
  for (const P of paths) {                                            // the plait, a strand each side
    const rs = resample(P.pts, 0.04), strandCol = mixc(P.rgb, P.ring ? 0.12 : 0.4, [170, 172, 182]), edge = 'rgb(22,24,30)'
    for (const side of [-1, 1]) {
      const off = side * 0.52, amp = 0.1, lam = 0.62
      const S = [0, 1].map(k => rs.map(p => { const o = off + amp * Math.sin(p.s / lam * Math.PI * 2 + k * Math.PI); return [p.x + p.nx * o, p.y + p.ny * o] }))
      const draw = (k, i0, i1) => { const seg = S[k].slice(i0, i1 + 1); stroke(seg, 0.135, edge); stroke(seg, 0.085, `rgb(${strandCol})`) }
      draw(0, 0, rs.length - 1); draw(1, 0, rs.length - 1)
      const half = lam / 2, win = Math.round(0.1 * lam / 0.04)
      for (let m = 1; m * half < rs[rs.length - 1].s; m++) { const ic = Math.round(m * half / 0.04); draw(m % 2 ? 0 : 1, Math.max(0, ic - win), Math.min(rs.length - 1, ic + win)) }
    }
  }
  for (const P of paths) {                                            // the water: a lit lip, the dark wall, the water
    stroke(P.pts, 0.5, 'rgba(176,186,204,0.75)'); stroke(P.pts, 0.43, 'rgb(14,18,26)'); stroke(P.pts, 0.34, 'rgb(10,22,40)'); stroke(P.pts, 0.2, 'rgb(14,36,62)')
  }
  for (const P of A.channels) {                                       // a boss where the channel leaves the ring
    const p0 = P.pts[0], band = mixc(P.rgb, 0.4, [170, 172, 182])
    b.beginPath(); b.arc(p0[0], p0[1], 0.62, 0, Math.PI * 2); b.fillStyle = 'rgb(24,26,32)'; b.fill()
    b.beginPath(); b.arc(p0[0], p0[1], 0.55, 0, Math.PI * 2); b.fillStyle = `rgb(${band})`; b.fill()
    b.beginPath(); b.arc(p0[0], p0[1], 0.3, 0, Math.PI * 2); b.fillStyle = 'rgb(14,18,26)'; b.fill()
    b.beginPath(); b.arc(p0[0], p0[1], 0.22, 0, Math.PI * 2); b.fillStyle = 'rgb(14,36,62)'; b.fill()
  }
  // 3. mineral veins in the stone, and lichen: dim in the floor, glowing in the second picture
  const rnd = seeded(77)
  b.lineCap = 'round'
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, gg = g0 + 1 + rnd() * 14; let x = cx + Math.cos(a) * (rx + gg), y = cy + Math.sin(a) * (ry + gg), an = rnd() * 6.28
    if (!ok(Math.floor(x), Math.floor(y))) continue
    b.beginPath(); b.moveTo(x, y)
    for (let s = 0; s < 7; s++) { an += (rnd() - 0.5) * 1.1; x += Math.cos(an) * 0.18; y += Math.sin(an) * 0.18; b.lineTo(x, y) }
    b.strokeStyle = `rgba(190,200,220,${(0.1 + rnd() * 0.14).toFixed(2)})`; b.lineWidth = 0.025 + rnd() * 0.02; b.stroke()
  }
  gl.save(); gl.scale(TP, TP)
  const blob = (x, y, r) => {
    b.fillStyle = 'rgba(46,92,100,0.5)'; b.beginPath(); b.arc(x, y, r, 0, 6.3); b.fill()
    const gr = gl.createRadialGradient(x, y, 0, x, y, r * 2.2); gr.addColorStop(0, 'rgba(70,170,190,0.34)'); gr.addColorStop(1, 'rgba(70,170,190,0)')
    gl.fillStyle = gr; gl.beginPath(); gl.arc(x, y, r * 2.2, 0, 6.3); gl.fill()
    gl.fillStyle = 'rgba(170,235,240,0.5)'; gl.beginPath(); gl.arc(x, y, r * 0.55, 0, 6.3); gl.fill()
  }
  const lichen = (x, y) => { if (!ok(Math.floor(x), Math.floor(y))) return; const n = 3 + Math.floor(rnd() * 6); for (let i = 0; i < n; i++) blob(x + (rnd() - 0.5) * 0.28, y + (rnd() - 0.5) * 0.2, 0.025 + rnd() * 0.035) }
  for (let i = 0; i < 520; i++) {                                     // along the joints between the courses
    const bd = 1 + Math.floor(rnd() * 14), a = rnd() * Math.PI * 2, gg = g0 + E[Math.min(bd, E.length - 1)] + (rnd() - 0.5) * 0.06
    lichen(cx + Math.cos(a) * (rx + gg), cy + Math.sin(a) * (ry + gg))
  }
  for (const P of paths) {                                            // thick where the water is
    const rs = resample(P.pts, 0.45)
    for (const p of rs) if (rnd() < 0.55) { const side = rnd() < 0.5 ? -1 : 1, o = 0.78 + rnd() * 0.18; lichen(p.x + p.nx * o * side, p.y + p.ny * o * side) }
  }
  gl.restore(); b.restore()
}
