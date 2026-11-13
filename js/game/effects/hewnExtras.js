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
import { h2, WIDS, courses, cellGeom, ptAt, cellAt, stoneU } from './floorStones.mjs'
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
  const nSteps = p.steps ?? 6, fall = p.fall ?? 0.62
  for (let i = 0; i < nSteps; i++) {
    const yy = y - 0.18 - i * 0.32, zz = z - i * 0.26, ins = 0.08 + (p.narrow ?? 0) * i, a = h._P(x - w / 2 + ins, yy, zz), b = h._P(x + w / 2 - ins, yy, zz)
    if (!a || !b) continue
    const al = 0.5 * v * Math.pow(fall, i)
    ctx.strokeStyle = `rgba(150,160,180,${al.toFixed(3)})`; ctx.lineWidth = Math.max(1, k * 0.02); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    const c = h._P(x - w / 2 + ins, yy, zz - 0.26), d = h._P(x + w / 2 - ins, yy, zz - 0.26)
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

// { type: 'banner', x, y, z, w, len, rgb, pulse, ph }: a ragged strip of pale cloth hanging from z down by len at (x, y), its hem
// torn into points, stirring slowly. With p.pulse it leans toward the door (smaller y) on the same breath as the mist
// drawn 'in' (period p.pulse, phase p.ph), so the cloth is the one thing in the dark that shows which way the air goes.
export function drawBanner(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  const w = p.w ?? 0.5, len = p.len ?? 1.5, col = p.rgb || [196, 200, 198], N = 7
  const L = h.lightAt(p.x, p.y + 0.4, p.z - len * 0.5, -1), v = Math.min(1, Math.max(0.22, Math.max(L[0], L[1], L[2]) * 1.3))
  const u = p.pulse ? ((h.t + (p.ph || 0)) / p.pulse) % 1 : 0, lean = p.pulse ? Math.sin(Math.PI * Math.min(1, u * 1.6)) ** 2 * 0.5 : 0
  const left = [], right = []
  for (let s = 0; s <= N; s++) {
    const t = s / N, hh = hash((p.n || 0) * 53 + s * 7919)
    const sway = Math.sin(h.t * 0.5 + t * 2.1) * 0.05 * t + Math.sin(h.t * 1.3 + s) * 0.012 * t
    const hw = w / 2 * (1 - 0.18 * t) * (0.92 + (hh & 15) / 15 * 0.16)
    const yy = p.y - lean * t * t, zz = p.z - len * t
    const a = h._P(p.x - hw + sway, yy, zz), b = h._P(p.x + hw + sway, yy, zz)
    if (!a || !b) return
    left.push(a); right.push(b)
  }
  // the hem: three or four points of unequal length along the foot
  const hem = [], teeth = 4
  for (let i = 0; i <= teeth; i++) {
    const f = i / teeth, hh = hash((p.n || 0) * 71 + i * 104729), drop = i % 2 ? 0 : 0.1 + (hh & 15) / 15 * 0.22
    const a = left[N], b = right[N]
    const px = a.x + (b.x - a.x) * f, py = a.y + (b.y - a.y) * f
    hem.push({ x: px, y: py + k * (i % 2 ? 0.02 : drop) })
  }
  ctx.save()
  if (p.arch) {                                                       // hung in a doorway: its head cut by the arch, so no gap shows
    const A = p.arch, zs = A.z + A.hj, rr = A.w / 2 + 0.015, pts = [h._P(A.x - rr, A.y, A.z - 3)]
    for (let i = 0; i <= 24; i++) { const an = Math.PI - Math.PI * i / 24; pts.push(h._P(A.x + Math.cos(an) * rr, A.y, zs + Math.sin(an) * rr)) }
    pts.push(h._P(A.x + rr, A.y, A.z - 3))
    if (!pts.some(q => !q)) { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.clip() }
  }
  ctx.beginPath(); ctx.moveTo(left[0].x, left[0].y)
  for (let s = 1; s <= N; s++) ctx.lineTo(left[s].x, left[s].y)
  for (let i = 0; i < hem.length; i++) ctx.lineTo(hem[i].x, hem[i].y)
  for (let s = N; s >= 0; s--) ctx.lineTo(right[s].x, right[s].y)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, left[0].y, 0, hem[0].y + k * 0.3)
  g.addColorStop(0, `rgba(${col.map(c => c * v * 0.55 | 0)},0.95)`); g.addColorStop(0.6, `rgba(${col.map(c => c * v * 0.9 | 0)},0.9)`); g.addColorStop(1, `rgba(${col.map(c => c * v | 0)},0.55)`)
  ctx.fillStyle = g; ctx.fill()
  ctx.strokeStyle = `rgba(0,0,0,${(0.35).toFixed(2)})`; ctx.lineWidth = Math.max(1, k * 0.012)      // the folds
  for (const f of [0.3, 0.62]) { ctx.beginPath(); ctx.moveTo(left[0].x + (right[0].x - left[0].x) * f, left[0].y); for (let s = 1; s <= N; s++) ctx.lineTo(left[s].x + (right[s].x - left[s].x) * f, left[s].y); ctx.stroke() }
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
  // (the roots over the well fade away while you look down into it from the step: h.deep. Not the gate's)
  const FK = p.id ? 1 : 1 - 0.95 * (h.deep || 0); if (FK < 0.03) return
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
    // grey, like old driftwood or ash-bark, not brown (p.brown: the old colour)
    ctx.strokeStyle = p.brown
      ? `rgb(${clamp01(L[0] * 1.2) * 110 | 0},${clamp01(L[1] * 1.2) * 84 | 0},${clamp01(L[2] * 1.2) * 56 | 0})`
      : `rgb(${clamp01(L[0] * 1.2) * 104 | 0},${clamp01(L[1] * 1.2) * 101 | 0},${clamp01(L[2] * 1.2) * 100 | 0})`
    const w0 = Math.max(1, k * 0.035 * (1 + (hh & 3) / 3))
    // the line of it, top to bottom; its top fades into the dark it comes out of (unless p.hard): drawn in pieces,
    // faint, half, whole, and thinning toward the tip
    const pts = []
    for (let s = 0; s <= 8; s++) {
      const t = s / 8, pt = h._P(x + Math.sin(t * 5 + q) * 0.06 + sw * t * t, y, p.z - len * t)
      if (pt) pts.push(pt)
    }
    if (pts.length < 2) continue
    const parts = p.hard ? [[0, 8, 1, 1]] : [[0, 2, 0.12, 1], [2, 4, 0.5, 0.9], [4, 6, 1, 0.62], [6, 8, 1, 0.34]]
    for (const [i0, i1, al, wk] of parts) {
      if (i1 >= pts.length) continue
      ctx.globalAlpha = al * FK; ctx.lineWidth = Math.max(1, w0 * wk)
      ctx.beginPath(); ctx.moveTo(pts[i0].x, pts[i0].y)
      for (let i = i0 + 1; i <= Math.min(i1, pts.length - 1); i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()
    }
    // a fork on some: a thinner branch leaving the line about halfway down, leaning to one side, shorter, ending in a point
    if (!p.nofork && ((hh >> 12) & 7) < 3 && pts.length === 9) {
      const side = (hh >> 15) & 1 ? 1 : -1, fl = len * (0.3 + ((hh >> 16) & 15) / 15 * 0.2)
      const fp = [pts[4]]
      for (let s = 1; s <= 4; s++) {
        const t = s / 4, pt = h._P(x + Math.sin(0.5 * 5 + q) * 0.06 + sw * 0.25 + side * 0.17 * t, y, p.z - len * 0.5 - fl * t)
        if (pt) fp.push(pt)
      }
      if (fp.length === 5) {
        ctx.globalAlpha = 0.9 * FK
        for (let i = 1; i < 5; i++) { ctx.lineWidth = Math.max(1, w0 * 0.62 * (1 - (i - 1) / 4 * 0.75)); ctx.beginPath(); ctx.moveTo(fp[i - 1].x, fp[i - 1].y); ctx.lineTo(fp[i].x, fp[i].y); ctx.stroke() }
      }
    }
    ctx.globalAlpha = FK
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
      const x = (p.x0 + p.x1) / 2 + (((hh & 1023) / 1023) - 0.5) * (p.x1 - p.x0) * 0.6
      // p.draw === 'in': the door draws a breath in -- the mist gathers on the threshold and is pulled through it and down
      const a = p.draw === 'in' ? h._P(x, p.y + 1.5 - u * 1.3, p.z + 0.45 - u * 0.75) : h._P(x, p.y + 0.5, p.z + u * 1.2); if (!a) continue
      const rx = k * (p.draw === 'in' ? 1.5 - u * 0.8 : 0.7 + u * 0.9), g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, rx)
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
// They keep to the great archway in the far wall, out of sight, until something stirs the water (you, pressing at the
// rim: hewnRock.bump). Then each in its turn comes out of the dark of the arch, swims up in a long lazy curve to where a
// nut has dropped from the roots, lifts its nose through the surface (rings spread), flicks round and goes back into the
// arch -- and again, a while later, for the next nut. Its body is a chain of sixteen links following the path it swam,
// with a wave running down them; each is drawn with the pale flank over the dark back and the darker belly under, fins,
// eyes, the tail's fork, all seen through the water: the deeper, the darker. Going in and out of the arch it fades.
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
  const TAU = Math.PI * 2, NA = p.arcade ?? 26, wallY = p.y - p.ry
  // the little arches round the wall (the arcade, see paintShaft): the angles of those that are there
  const little = []
  for (let i = 0; i < NA; i++) { const am = (i + 1) / NA * TAU, n = (am + Math.PI / 2 + TAU) % TAU; if (Math.sin(am) > 0.3 || n < 0.42 || n > TAU - 0.42) continue; little.push(am) }
  const pa = (a, rr, d) => [p.x + Math.cos(a) * p.rx * rr, p.y + Math.sin(a) * p.ry * rr, -d]
  // a way in or out of the water: the great archway in the far wall (its crown hangs down to about 3.4 under the surface),
  // or one of the little arches (their crowns, to about 1.4). It is through the wall there that it comes and goes.
  const jx = (R(2) - 0.5) * 1.6, jx2 = (R(3) - 0.5) * 1.6
  const portal = (r, k) => (r < 0.5 || !little.length) ? { great: true, a: -Math.PI / 2, d: 2.3 } : { great: false, a: little[Math.floor(R(k) * little.length) % little.length], d: 0.9 }
  const entA = portal(R(21), 22), exA = portal(R(23), 24)
  const gate = (t, jj) => t.great ? [[p.x + jj, wallY + 0.25, -2.3], [(p.x + jj) * 0.7 + p.x * 0.3, wallY - 1.4, -2.6]] : [pa(t.a, 0.93, t.d), pa(t.a, 1.45, t.d)]     // [the mouth, and outside it]
  const [inM, inO] = gate(entA, jx), [exM, exO] = gate(exA, jx2)
  // (every other round or so, no nut: in at a way in, down the shaft in a long gentle spiral, the circle drawing in as it
  // goes deeper, to the mid-distance, a cruise round the shaft there, and up in another spiral, opening out again, to a way
  // out: that may be a different arch)
  if (R(11) < 0.5) {
    const ent = entA, ex = exA
    const s2 = R(12) < 0.5 ? -1 : 1, DM = 6 + 2.5 * R(15), turnsD = 0.3 + 0.3 * R(13), turnsC = 0.8 + 0.5 * R(16), ph1 = R(17) * 6, ph2 = R(18) * 6
    const D = [inO, inM], A1 = ent.a + s2 * TAU * turnsD
    for (let k = 1; k <= 10; k++) { const u = k / 10, e = smooth01(u); D.push(pa(ent.a + s2 * TAU * turnsD * u, 0.6 - 0.12 * e, ent.d + (DM - ent.d) * e)) }
    // (the cruise: round the shaft in the mid-distance, in wide loose turns, bobbing a little)
    const A2 = A1 + s2 * TAU * turnsC
    for (let k = 1; k <= 12; k++) { const u = k / 12, env = Math.sin(u * Math.PI); D.push(pa(A1 + s2 * TAU * turnsC * u, 0.46 + 0.12 * Math.sin(u * TAU * 1.5 + ph1) * env, DM + 1.3 * Math.sin(u * TAU * 1.25 + ph2) * env)) }
    const delta = (((ex.a - A2) * s2) % TAU + TAU) % TAU, turnsU = (delta + (delta < TAU * 0.15 ? TAU : 0)) / TAU     // (on round the same way, to come out at the arch)
    for (let k = 1; k <= 10; k++) { const u = k / 10, e = smooth01(u); D.push(pa(A2 + s2 * TAU * turnsU * u, 0.46 + 0.14 * e, DM + (ex.d - DM) * e)) }
    D.push(pa(ex.a, 0.84, ex.d), exM, exO)
    const V = 1.2, cap = 34 + q * 9                                      // (it must be done before its round comes again)
    F = swimPath(D, 0, V, 480)
    if (F.D > cap) F = swimPath(D, 0, V * F.D / cap, 480)
    F.dive = true
    PATHS.set(key, F); return F
  }
  // the nut: in (at an arch, or, the first time it is seen and often after, up out of the deeps in a rising spiral), out on
  // the water to where it lies, and away again (down an arch, or down into the deeps)
  const up = round === 0 || R(25) < 0.5, down = R(26) < 0.45, sd = R(27) < 0.5 ? -1 : 1, a0 = R(28) * TAU
  const an = R(0) * Math.PI * 2, rt = 0.15 + 0.4 * R(1), Nx = p.x + Math.cos(an) * p.rx * rt, Ny = p.y + Math.sin(an) * p.ry * rt
  const head = [], tail = []
  let Mx, My
  if (up) {
    const m = pa(a0 + sd * 4.0, 0.45, 2.2); Mx = m[0]; My = m[1]
    head.push(pa(a0, 0.38, 9.2), pa(a0 + sd * 1.4, 0.5, 6.4), pa(a0 + sd * 2.8, 0.5, 3.8), m)
  } else { Mx = inM[0]; My = inM[1]; head.push(inO, inM) }
  const dx = Nx - Mx, dy = Ny - My, dl = Math.hypot(dx, dy) || 1, sx = -dy / dl, sy = dx / dl, side = (R(9) < 0.5 ? 1 : -1) * Math.min(1.2, dl * 0.25)
  const mid = (f, off, depth) => [Mx + dx * f + sx * off, My + dy * f + sy * off, -depth]
  const back = mid(0.5, -side, 1.8)
  if (down) {
    const a1 = Math.atan2((back[1] - p.y) / p.ry, (back[0] - p.x) / p.rx), sd2 = R(29) < 0.5 ? -1 : 1
    tail.push(pa(a1 + sd2 * 1.0, 0.5, 4.5), pa(a1 + sd2 * 2.2, 0.48, 7.5), pa(a1 + sd2 * 3.4, 0.42, 10.5), pa(a1 + sd2 * 4.6, 0.38, 13.8))
  } else tail.push(exM, exO)
  const K = [...head, mid(0.35, side, 2.0), mid(0.78, side * 0.5, 0.9), [Nx, Ny, 0],
    [Nx + dx / dl * 0.35 - sx * side * 0.3, Ny + dy / dl * 0.35 - sy * side * 0.3, -0.5], back, ...tail]
  const kT = K.findIndex(pt => pt[2] === 0), cap = 36 + q * 9, V0 = up ? 1.15 : 0.85
  F = swimPath(K, kT, V0)
  if (F.D > cap) F = swimPath(K, kT, V0 * F.D / cap)                    // (and done before its round comes again)
  PATHS.set(key, F); return F
}
// a swim through key points K ([x, y, -depth]), slowing round the one at index kT (where it touches the surface)
function swimPath(K, kT, V = 0.85, N = 220) {
  const pts = spline(K, N), len = [0], tm = [0]
  const iT = Math.round(kT / (K.length - 1) * N)
  for (let i = 1; i <= N; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]))
  const sT = len[iT]
  for (let i = 1; i <= N; i++) { const s = (len[i] + len[i - 1]) / 2, v = V * (1 - 0.6 * Math.exp(-(((s - sT) / 1.1) ** 2))); tm.push(tm[i - 1] + (len[i] - len[i - 1]) / v) }
  return { pts, len, tm, L: len[N], D: tm[N], iT, sT, tT: tm[iT] }
}
// The salmon's gifts: they come out of the arch together, each to a nut floating out on the water, and nose them across
// the surface to the foot of the steps, so they arrive side by side at the same moment. startPoolGifts returns them; each
// has `ready` (h.t: there to take). gift.lift = h.t and it rises out of the water and is gone (cave/wellMirror.js).
// While they're about it, the others keep to the arch (fishFrame: p._hush).
export function startPoolGifts(h, p, tips, wait = 0.6) {
  const wallY = p.y - p.ry, R = (k) => (hash(Math.floor(h.t * 10) * 31 + k * 977) & 0xffff) / 65535
  const made = tips.map(([Tx, Ty0], i) => {
    const side = Tx < p.x - 0.1 ? -1 : Tx > p.x + 0.1 ? 1 : (R(i) < 0.5 ? -1 : 1)
    const Nx = p.x + side * (1.5 + 0.9 * R(i * 3 + 1)) + (Tx - p.x) * 0.4, Ny = p.y - 1.4 + 1.2 * R(i * 3 + 2), Ty = Ty0 + 0.1
    const Mx = p.x + side * 0.45 + (i - 1) * 0.25, My = wallY + 0.25
    // (up out of the deeps in a rising spiral, into the water by where the arch is, and on to the nut)
    const My2 = My + 1.4, aM = Math.atan2((My2 - p.y) / p.ry, (Mx - p.x) / p.rx), aS = aM - side * 2.2, pt = (a, rr, d) => [p.x + Math.cos(a) * p.rx * rr, p.y + Math.sin(a) * p.ry * rr, -d]
    const K = [pt(aS, 0.4, 9.2), pt(aS + side * 1.0, 0.5, 5.8), [Mx, My2, -2.3], [(Mx + Nx) / 2 + side * 0.5, (My2 + Ny) / 2, -1.6], [Nx, Ny + 0.3, -0.5], [Nx, Ny, -0.12],
      [(Nx + Tx) / 2, (Ny + Ty) / 2 + 0.25, -0.1], [Tx, Ty, -0.08], [Tx - side * 0.4, Ty + 0.6, -1.0], [p.x + side * (0.6 + 0.3 * i), p.y - 0.6, -3.6], [p.x + side * 0.3, p.y + 0.2, -7], [p.x - side * 0.4, p.y + 0.5, -10.5], [p.x + side * 0.2, p.y + 0.3, -13.5]]      // (and away, down into the depths)
    const F = swimPath(K, 7, 1.2)
    const at = (k) => F.tm[Math.round(k / (K.length - 1) * (F.pts.length - 1))]
    return { F, N: [Nx, Ny], T: [Tx, Ty], tPick: at(5), tLeave: at(7), taken: false, lift: null, q: i }
  })
  // (all to arrive together: the longest swim sets off first)
  const arrive = h.t + wait + Math.max(...made.map(g => g.tLeave))
  for (const g of made) { g.t0 = arrive - g.tLeave; g.ready = arrive + 0.5 }
  ;(p._gifts || (p._gifts = [])).push(...made)
  const end = Math.max(...made.map(g => g.t0 + g.F.D))
  p._hush = { t0: h.t, end }
  const wk = h._fishWake || (h._fishWake = new Map()); wk.set(p, end)                  // (and the others take up their foraging after)
  return made
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

// Three great ones that live down in the mid-deeps: each goes round and round the shaft at its own level, bobbing, the
// others the other way, so there is always something to see when you look down. (A long looped path, three laps, the middle
// lap the one used; body longer than the visitors', for they are older.)
function makeDwellers(p) {
  const TAU = Math.PI * 2, out = [], LC = 3                      // (a cycle is three laps; once in it, a slow rise to the mid levels and back)
  for (let i = 0; i < 3; i++) {
    const dir = i % 2 ? -1 : 1, d0 = 11 + 3 * i, RISE = 6.5 + 2 * i, ph = i * 2.1, a0 = i * 2.4, ph2 = i * 2.2 + 0.6, n = 18, K = []
    for (let k = 0; k <= 3 * LC * n; k++) {
      const th = a0 + dir * TAU * k / n, rr = 0.5 + 0.1 * Math.sin(2 * th + ph), c = (k % (LC * n)) / (LC * n)
      const up = Math.pow(Math.max(0, Math.sin(TAU * c + ph2)), 3)
      K.push([p.x + Math.cos(th) * p.rx * rr, p.y + Math.sin(th) * p.ry * rr, -(d0 + 1.2 * Math.sin(2 * th + ph) - RISE * up)])
    }
    const F = swimPath(K, 0, 1, 330 * LC), V = 0.7 + 0.12 * i
    F.tm = F.len.map(l => l / V); F.D = F.L / V; F.tT = -1e3; F.far = true            // (far: seen further down, as a dim shape against the light)
    const lapT = F.L / 3 / V
    out.push({ F, lapT, off: i * 7.3, q: 6 + 2 * i })
  }
  return out
}

// one frame's fish: lists of screen shapes, made once per frame and drawn through each row's slice of the water
function fishFrame(h, p, surf) {
  if (p._ff && p._ff.t === h.t) return p._ff
  const out = { t: h.t, fish: [], rings: [], nuts: [], falls: [] }
  // you, bumping the pool's edge (hewnRock.bump): a ring or two out from where you pressed
  for (const b of h.bumps || []) { const a = h.t - b.t0; if (a >= 0 && a < 4.5) out.rings.push({ x: b.x, y: b.y, b: a / 4.5, w: 1, two: true, R: 2.0 }) }
  // (asleep in the arch until the first ripple of this visit)
  const wk = h._fishWake || (h._fishWake = new Map())
  if (!wk.has(p)) { const b = (h.bumps || []).find(b => b.t0 <= h.t); if (b) wk.set(p, b.t0) }
  const wake = wk.get(p)
  if (wake == null) { p._ff = out; return out }
  const n = p.fish?.count ?? 3
  // (while the gifts are about, the others fade off down into the arch; after, they begin their rounds again)
  if (p._hush && h.t > p._hush.end) p._hush = null
  const hush = p._hush ? Math.min(1, (h.t - p._hush.t0) / 1.5) : 0
  for (let q = 0; q < n; q++) {
    const DELAY = 1.2, STAG = 9.5, per = 40 + q * 9, base = wake + DELAY + q * STAG, T = h.t - base
    if (T < 0) continue
    const round = Math.floor(T / per), u = T - round * per
    const F = fishPath(p, q, round)
    const tTouch = base + round * per + F.tT, age = h.t - tTouch
    const nose = F.pts[F.iT]
    if (p.fish?.nuts && !F.dive) {                                // a nut drops from the roots a while before the fish comes for it
      const uL = Math.max(0.8, F.tT - 7), tFall = base + round * per + uL - h.t                    // seconds until it lands (negative: it has)
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
    const fish = bodyOf(h, p, F, u, q, surf)
    if (fish && hush < 1) fish.fa *= 1 - hush
    if (fish && fish.fa > 0.02) out.fish.push(fish)
  }
  // the dwellers, down in the mid-deeps
  const dw = p._dw || (p._dw = makeDwellers(p))
  for (const d of dw) { const fish = bodyOf(h, p, d.F, d.lapT + ((h.t + d.off) % d.lapT), d.q, surf); if (fish && fish.fa > 0.02) out.fish.push(fish) }
  // the salmon's gifts (startPoolGifts): the nut afloat, then nosed across to the steps, waiting there, then lifting out
  if (p._gifts) {
    p._gifts = p._gifts.filter(g => !(g.taken && h.t - g.t0 > g.F.D + 2))
    for (const g of p._gifts) {
      const u = h.t - g.t0
      if (u >= 0 && u < g.F.D + 1.5) { const fish = bodyOf(h, p, g.F, u, 1 + g.q, surf); if (fish) out.fish.push(fish) }
      if (g.taken) continue
      let nx, ny, nz = surf
      if (u < g.tPick) { nx = g.N[0]; ny = g.N[1] }
      else if (u < g.tLeave) { const [x, y] = atS(g.F, sAtTime(g.F, u)); nx = x; ny = y }
      else { nx = g.T[0]; ny = g.T[1] }
      if (g.lift != null) continue                                           // (up out of the water onto the step: drawPoolSteps draws that)
      const s2 = h._P(nx + Math.sin(h.t * 0.9 + g.q) * 0.02, ny, nz); if (s2) out.nuts.push(s2)
      if (u > -0.4 && u < 0.1) out.rings.push({ x: g.N[0], y: g.N[1], b: (u + 0.4) / 2, w: 0.6 })
    }
  }
  out.fish.sort((a, b) => b.db - a.db)                           // (the deeper drawn first, so a lower one never covers a higher)
  p._ff = out; return out
}
// one fish's shapes, u seconds along its swim F
function bodyOf(h, p, F, u, q, surf) {
  const dimX = (d) => Math.min(1, dimAt(d) + 0.3 * Math.min(1, h.deep || 0) * Math.min(1, d / 4))          // (looking down, the light from the bottom lifts the deeper ones)
  const NB = 16, wallAt = (x) => p.y - p.ry * Math.sqrt(Math.max(0, 1 - ((x - p.x) / p.rx) ** 2))
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
  const FE = F.far ? 24 : 13                                    // (how deep it can be seen: the far ones are dim shapes a long way down)
  if (sp[0].d > FE + 1.5 && sp[NB].d > FE + 1.5) return null
  // how far out of the arch it is: in the wall, nothing; a body's length out, all of it
  // (in at the wall -- the great arch, or one of the little ones -- it's gone; and gone down into the depths, too)
  const mr = Math.min(p.rx, p.ry), vis = (o) => Math.max(0, Math.min(1, ((1 - Math.hypot((o.x - p.x) / p.rx, (o.y - p.y) / p.ry)) * mr + 0.15) / 0.9))
  const fd = Math.max(0, Math.min(1, (FE - (sp[0].d + sp[NB].d) / 2) / (FE - 5)))                  // (it goes dim and clear by degrees, the whole way down)
  const fa = (vis(sp[0]) + vis(sp[NB >> 1]) + vis(sp[NB])) / 3 * fd
  void wallAt
  // looking down into the well (h.deep), a salmon going deep goes down it: drawn as at a little depth, then drawn in, smaller
  // and smaller, toward the light at the bottom (p._VP: paintDeep) -- the well on the screen being no world's well
  // looking straight down the well (h.deep), a salmon going deep goes down it, toward the light at the bottom (p._VP: paintDeep);
  // in the slanting view, toward a point under the middle of the pool. Either way each part of it is drawn smaller by its own
  // depth (scl), as seen in perspective: so a fish diving is foreshortened and tilted, its head smaller than its tail.
  const DC = 2.2, dpt = (h.deep || 0) > 0.05 && p._VP ? Math.min(1, h.deep) : 0
  let fa2 = fa
  if (dpt > 0) { const dm = (sp[0].d + sp[NB].d) / 2; fa2 = (vis(sp[0]) + vis(sp[NB >> 1]) + vis(sp[NB])) / 3 * Math.max(0, Math.min(1, (FE - dm) / (F.far ? 8 : 4))) * (0.35 + 0.65 * h.deep) + fa * (1 - (0.35 + 0.65 * h.deep)) }
  fa2 *= Math.min(1, u / 1.6)                                      // (it comes up out of the dim: faded in over its first moments)
  if (fa2 < 0.02) return null
  const half = (f) => 0.2 * (BODY / 2.1) * (f < 0.3 ? Math.pow(Math.sin(f / 0.3 * Math.PI / 2), 0.65) : 1 - 0.8 * Math.pow((f - 0.3) / 0.7, 1.2)) + 0.012
  const E = [], tn = []
  for (let i = 0; i <= NB; i++) {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(NB, i + 1)]; let tx = a.x - b.x, ty = a.y - b.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl   // toward the head
    tn.push([tx, ty]); E.push({ l: [sp[i].x - ty * half(i / NB), sp[i].y + tx * half(i / NB)], r: [sp[i].x + ty * half(i / NB), sp[i].y - tx * half(i / NB)] })
  }
  const vpN = h._P(p.x, p.y, surf - 3)
  const V = vpN && dpt > 0 ? { x: vpN.x + (p._VP.x - vpN.x) * dpt, y: vpN.y + (p._VP.y - vpN.y) * dpt } : vpN
  const scl = (d) => d <= DC ? 1 : Math.exp(-(d - DC) * 0.16)
  const P3 = (x, y, d, dz) => {
    const S = h._P(x, y, surf - Math.min(d, DC) + dz)
    if (!S || !V || d <= DC) return S
    const k = scl(d); return { x: V.x + (S.x - V.x) * k, y: V.y + (S.y - V.y) * k }
  }
  const shapes = []
  let yMin = Infinity, yMax = -Infinity, bad = false
  const add = (pts, fill, a) => { if (!Array.isArray(pts)) { shapes.push({ c: pts, fill, a }); return } if (pts.some(s => !s)) { bad = true; return } for (const s of pts) { if (s.y < yMin) yMin = s.y; if (s.y > yMax) yMax = s.y } shapes.push({ pts, fill, a }) }
  // the tail's fork, behind the body
  const tN = [-tn[NB][0], -tn[NB][1]], tW = 0.13 + 0.07 * (1 + bump), sT_ = sp[NB], dT = sT_.d, dm = dimX(dT)
  const fc = mixc([6, 10, 18], [112, 140, 172], dm)
  add([P3(sp[NB - 1].x - tn[NB][1] * 0.02, sp[NB - 1].y + tn[NB][0] * 0.02, dT, 0), P3(sT_.x + tN[0] * 0.19 - tn[NB][1] * tW, sT_.y + tN[1] * 0.19 + tn[NB][0] * tW, dT, 0), P3(sT_.x + tN[0] * 0.09, sT_.y + tN[1] * 0.09, dT, 0), P3(sT_.x + tN[0] * 0.19 + tn[NB][1] * tW, sT_.y + tN[1] * 0.19 - tn[NB][0] * tW, dT, 0), P3(sp[NB - 1].x + tn[NB][1] * 0.02, sp[NB - 1].y - tn[NB][0] * 0.02, dT, 0)], fc, 0.85)
  // pectoral fins, a pair, beating slowly
  for (const side of [-1, 1]) {
    const i = 4, e = side < 0 ? E[i].l : E[i].r, sw = 0.16 + 0.05 * Math.sin(ph * 1.5 + side), dd = sp[i].d
    add([P3(e[0], e[1], dd, -0.03), P3(e[0] + (side < 0 ? 1 : -1) * tn[i][1] * -sw - tn[i][0] * 0.04, e[1] + (side < 0 ? 1 : -1) * tn[i][0] * sw - tn[i][1] * 0.04, dd, -0.05), P3(e[0] - tn[i][0] * 0.2 + (side < 0 ? 1 : -1) * tn[i][1] * -sw * 0.8, e[1] - tn[i][1] * 0.2 + (side < 0 ? 1 : -1) * tn[i][0] * sw * 0.8, dd, -0.05), P3(e[0] - tn[i][0] * 0.14, e[1] - tn[i][1] * 0.14, dd, -0.03)], mixc([6, 10, 18], [128, 152, 182], dimX(dd)), 0.8)
  }
  // the body: a chain of round sections (so it has depth seen from any side), belly dark and low, the flank pale over
  // it, the back a darker blue on top, a sheen on the shoulder; spots on the back; the eyes
  const secs = []
  for (let i = NB; i >= 0; i--) for (const t of [0]) {                         // tail to head, two sections to a link
    const j = i - t, a = sp[Math.floor(j)], b = sp[Math.min(NB, Math.ceil(j))], u2 = j - Math.floor(j)
    const x = a.x + (b.x - a.x) * u2, y = a.y + (b.y - a.y) * u2, d = a.d + (b.d - a.d) * u2
    const c = P3(x, y, d, 0), rr = half(j / NB) * 1.05 * h._k(y) * scl(d)
    if (!c) { bad = true; break }
    secs.push({ x: c.x, y: c.y, r: Math.max(0.9, rr), d, f: j / NB })
    if (c.y - rr < yMin) yMin = c.y - rr; if (c.y + rr > yMax) yMax = c.y + rr
  }
  // (each layer a chain of capsules, link to link, so the body stays one body however far it is stretched; not balls)
  for (const [layer, up, k, c0] of [['belly', 0.1, 1.0, [92, 120, 154]], ['flank', -0.12, 0.84, [196, 218, 238]], ['back', -0.4, 0.5, [78, 112, 156]]])
    for (let i = 0; i + 1 < secs.length; i++) {
      const a = secs[i], b = secs[i + 1]
      shapes.push({ seg: { a: { x: a.x, y: a.y + up * a.r, r: a.r * k }, b: { x: b.x, y: b.y + up * b.r, r: b.r * k } }, fill: mixc([6, 10, 18], c0, dimX((a.d + b.d) / 2)), a: 1 })
    }
  { let rs = 0, ds = 0; for (const c of secs) { rs += c.r; ds += c.d }                                              // (the sheen on the shoulder, one stroke)
    rs /= secs.length; ds /= secs.length
    shapes.push({ line: secs.map(c => ({ x: c.x, y: c.y - 0.5 * c.r })), w: Math.max(1, rs * 0.4), fill: mixc([6, 10, 18], [240, 248, 255], dimX(ds) * 0.9), a: 0.5 }) }
  if (!secs.length) return null                                  // (the fish's head is behind the camera: nothing to draw)
  const hd = secs[secs.length - 1], nk = secs[secs.length - 4] || secs[0]
  let ex = hd.x - nk.x, ey = hd.y - nk.y; const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el
  const eyes = [-1, 1].map(sd => ({ x: hd.x + ex * hd.r * 0.15 - ey * sd * hd.r * 0.55, y: hd.y + ey * hd.r * 0.15 + ex * sd * hd.r * 0.55 - hd.r * 0.3, d: hd.d }))
  const spots = secs.filter((c, i) => i % 3 === 1 && c.f > 0.25 && c.f < 0.85).map(c => ({ x: c.x + (c.f * 977 % 1 - 0.5) * c.r, y: c.y - c.r * 0.45, d: c.d }))
  const hi = []
  if (bad) return null
  let dbar = 0; for (const c of secs) dbar += c.d; dbar /= secs.length
  const mid = secs[secs.length >> 1], sc = scl(dbar)
  // and the deeper, the more it wavers, as a thing does seen down through that much moving water
  const wd = Math.max(0, Math.min(1, (dbar - 1.5) / 8))
  if (wd > 0.01) {
    const amp = wd * 0.11 * h._k(mid.y) * sc, tt = h.t * 1.7 + q * 2.1
    const wob = (o) => { o.x += amp * Math.sin(tt + o.y * 0.07); return o }
    for (const sh of shapes) { if (sh.c) wob(sh.c); else if (sh.seg) { wob(sh.seg.a); wob(sh.seg.b) } else if (sh.line) sh.line.forEach(wob); else sh.pts.forEach(wob) }
    eyes.forEach(wob); spots.forEach(wob)
    yMin -= 3; yMax += 3
  }
  return { shapes, hi, eyes, spots, yMin, yMax, k: h._k(sp[0].y) * scl(sp[0].d), fa: fa2, db: dbar, tun: 1, V: p._VP }
}
function drawFishBand(h, ctx, F, yA, yB, surf) {
  for (const f of F.fish) {
    if (f.yMax < yA || f.yMin > yB) continue
    if (f.tun < 1) { ctx.save(); ctx.translate(f.V.x, f.V.y); ctx.scale(f.tun, f.tun); ctx.translate(-f.V.x, -f.V.y) }      // (gone down the well)
    const fa = f.fa ?? 1
    for (const sh of f.shapes) {
      ctx.globalAlpha = sh.a * fa; ctx.fillStyle = sh.fill
      if (sh.seg) { const q = sh.seg; ctx.strokeStyle = sh.fill; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, q.a.r + q.b.r); ctx.beginPath(); ctx.moveTo(q.a.x, q.a.y); ctx.lineTo(q.b.x, q.b.y); ctx.stroke(); continue }
      if (sh.line) { ctx.strokeStyle = sh.fill; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = sh.w; ctx.beginPath(); sh.line.forEach((o, i) => (i ? ctx.lineTo(o.x, o.y) : ctx.moveTo(o.x, o.y))); ctx.stroke(); continue }
      ctx.beginPath()
      if (sh.c) ctx.arc(sh.c.x, sh.c.y, sh.c.r, 0, Math.PI * 2)
      else { ctx.strokeStyle = sh.fill; ctx.lineWidth = 0.8; ctx.lineJoin = 'round'; sh.pts.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.closePath() }
      ctx.fill(); if (!sh.c) ctx.stroke()
    }
    ctx.globalAlpha = fa
    for (const sp of f.spots) { ctx.fillStyle = `rgba(14,24,42,${(0.6 * dimAt(sp.d)).toFixed(3)})`; ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(0.8, f.k * 0.012), 0, Math.PI * 2); ctx.fill() }
    for (const e of f.eyes) { ctx.fillStyle = `rgba(6,8,14,${(0.95 * Math.max(0.2, dimAt(e.d))).toFixed(3)})`; ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(1, f.k * 0.016), 0, Math.PI * 2); ctx.fill() }
    ctx.globalAlpha = 1
    if (f.tun < 1) ctx.restore()
  }
}

// Looking down into the well from the step (h.deep), everything under the water wavers together, as things seen down
// through moving water do: the shaft, the great arch, the depths, Géaga's eyes, your reflection, the salmon. All of it is
// put together once a frame on one canvas the screen's size, and each row's band of the water takes its slice of that
// in thin strips, each pushed a little aside and up or down by slow waves running down the screen.
function paintWaterWarped(h, ctx, p, G, surf, F, yA0, yB0) {
  const C = h.cam, key = h.t + ',' + C.col + ',' + C.row + ',' + C.z
  const Wl = h._wl || (h._wl = { cv: document.createElement('canvas'), key: '' })
  if (Wl.key !== key) {
    if (Wl.cv.width !== C.sw || Wl.cv.height !== C.sh) { Wl.cv.width = C.sw; Wl.cv.height = C.sh }
    const g = Wl.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, C.sw, C.sh)
    paintShaftBand(h, g, p, G, surf, -1e9, 1e9)
    if (p.steps) drawSunkSteps(h, g, p, surf)
    if (h.inWater) drawEyesInWater(h, g, p, h.inWater, surf)
    if (h.mirror) drawMirror(h, g, h.mirror, surf)
    drawFishBand(h, g, F, -1e9, 1e9, surf)
    Wl.key = key
  }
  const S = p._SH; if (!S) return
  const d = h.deep, t = h.t, y0 = Math.max(S.y0, Math.floor(yA0 - 3)), y1 = Math.min(S.y0 + S.H, Math.ceil(yB0 + 3)), STR = 8
  ctx.fillStyle = 'rgb(2,4,9)'; ctx.fillRect(S.x0, y0, S.W, y1 - y0)
  for (let y = y0; y < y1; y += STR) {
    const f = Math.max(0, Math.min(1, (y - S.y0) / (S.H || 1))), amp = d * C.sw * 0.0035 * (0.35 + 0.65 * f)          // (gentle: only enough to show it's water)
    const dx = amp * (Math.sin(y * 0.012 + t * 0.7) + 0.55 * Math.sin(y * 0.031 - t * 1.15) + 0.25 * Math.sin(y * 0.071 + t * 1.9))
    const sy = y + d * 2.5 * (0.4 + 0.6 * f) * Math.sin(y * 0.009 + t * 0.55), hh = Math.min(STR + 1, y1 - y + 1)
    ctx.drawImage(Wl.cv, S.x0, Math.max(0, Math.min(C.sh - hh, sy)), S.W, hh, S.x0 + dx, y, S.W, hh)
  }
}

// The shaft under the water -- its far wall's courses, the blind arcade, the great archway -- is the same picture in every
// row's band; it is made once (again only when the camera moves) into a canvas the size of the water on the screen, and
// each band takes its slice of that. (It used to be drawn whole for every band: ten times a frame.)
function paintShaftBand(h, ctx, p, G, surf, yA0, yB0) {
  const C = h.cam, key = C.col + ',' + C.row + ',' + C.z + ',' + C.sw + ',' + C.sh
  if (!p._SH || p._SH.key !== key) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, bad = false
    for (const q of G.water) { const S = h._P(q.x, q.y, q.z); if (!S) { bad = true; break } x0 = Math.min(x0, S.x); x1 = Math.max(x1, S.x); y0 = Math.min(y0, S.y); y1 = Math.max(y1, S.y) }
    if (bad) { x0 = 0; y0 = 0; x1 = C.sw; y1 = C.sh }
    x0 = Math.max(0, Math.floor(x0) - 2); y0 = Math.max(0, Math.floor(y0) - 2); x1 = Math.min(C.sw, Math.ceil(x1) + 2); y1 = Math.min(C.sh, Math.ceil(y1) + 2)
    // (one canvas the screen's size, made once: not resized every frame as the water's outline moves on the screen)
    const cv = p._SH?.cv || document.createElement('canvas'), W = Math.max(1, x1 - x0), H = Math.max(1, y1 - y0)
    if (cv.width !== C.sw || cv.height !== C.sh) { cv.width = C.sw; cv.height = C.sh }
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgb(2,4,9)'; g.fillRect(0, 0, W, H)
    g.setTransform(1, 0, 0, 1, -x0, -y0)
    if (x1 > x0 && y1 > y0) paintShaft(h, g, p, G, surf, key)
    p._SH = { key, cv, x0, y0, W, H }
  }
  const S = p._SH, sy = Math.max(0, Math.floor(yA0 - 2 - S.y0)), ey = Math.min(S.H, Math.ceil(yB0 + 2 - S.y0))
  if (ey > sy) ctx.drawImage(S.cv, 0, sy, S.W, ey - sy, S.x0, S.y0 + sy, S.W, ey - sy)
  // and, looking down from the steps, the well going on below all of it: alive, so made afresh (at half size, at most
  // thirty times a second) into a canvas of its own, and laid over the shaft in each band the same way
  const deep = h.deep || 0
  if (deep > 0.02 && ey > sy) {
    const D = p._DP || (p._DP = { cv: document.createElement('canvas'), t: -1, key: '' }), HS = 0.5
    if (D.key !== S.key || h.t - D.t >= 1 / 30 || h.t < D.t || Math.abs((D.deep ?? 0) - deep) > 0.02) {
      const w = Math.max(1, Math.ceil(S.W * HS)), hh = Math.max(1, Math.ceil(S.H * HS))
      if (D.cv.width !== w || D.cv.height !== hh) { D.cv.width = w; D.cv.height = hh }
      const g = D.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, hh); g.setTransform(HS, 0, 0, HS, -S.x0 * HS, -S.y0 * HS)
      paintDeep(h, g, p, G, deep, h.t, surf, deepMap(p, deep))
      D.t = h.t; D.key = S.key; D.deep = deep
    }
    ctx.drawImage(D.cv, 0, sy * HS, S.W * HS, (ey - sy) * HS, S.x0, S.y0 + sy, S.W, ey - sy)
    archRing(h, ctx, p, surf, Math.max(1, h._k(p.y - p.ry * 0.5) * 0.013), Math.min(1, deep * 1.3), deepMap(p, deep))
  }
}
// Looked down into, the arch under the water (and all that's through it) swells, the further the view tips: where it comes
// up through the water's skin it is as wide as the arch it answers, its feet under that arch's feet, so it could still be
// that arch's reflection; but below that it flares out, wider and longer the further down, off the sides of the screen
// and off its foot -- as no reflection would. (A map of the screen: m(x, y) -> [x, y], and how much it widens there, m.s(y).)
const FLARE = 3.4, PLUNGE = [1.25, 1.15]
function deepMap(p, deep) {
  const TN = p._W?.tun, id = (x, y) => [x, y]; id.s = () => 1
  if (!TN || TN.ring.some(z => !z)) return id
  let ya = Infinity, yb = -Infinity, x0 = Infinity, x1 = -Infinity
  for (const z of TN.ring) { if (z.y < ya) ya = z.y; if (z.y > yb) yb = z.y; if (z.x < x0) x0 = z.x; if (z.x > x1) x1 = z.x }
  const cyM = (ya + TN.ring[1].y) / 2, ax = (x0 + x1) / 2, ay = 2 * cyM - yb, Hm = Math.max(1, yb - ya)
  const e = Math.max(0, Math.min(1, deep)), f = e * e * (3 - 2 * e)
  const U = (y) => Math.max(0, (y - ay) / Hm), sX = (u) => 1 + f * FLARE * u * u
  const m = (x, y) => { const u = U(y); return [ax + (x - ax) * sX(u), ay + Hm * (u + f * ((PLUNGE[0] - 1) * u + PLUNGE[1] * u * u))] }
  m.s = (y) => sX(U(y)); return m
}
// The well, looked down into from the steps (h.deep, 0..1: how far the view has tipped down): down through the great
// arch, it goes on, and on -- a passage of arches, each the great arch again, smaller and further, round toward a light
// at the bottom that never comes nearer. Between each arch and the next, a course of the shaft's coursed stone; every
// third, an arcade of little arches, turned the other way up from the one before; every fourth, a band of lamps. The far
// end drifts a very little about the middle; light goes down it in slow swells. Drawn on the screen, inside the arch's
// mouth (and flared with it: deepMap), not in the world: no world has a well this deep.
function paintDeep(h, ctx, p, G, deep, t, surf, m = deepMap(p, deep)) {
  const TN = p._W?.tun; if (!TN || TN.ringIn.some(z => !z)) return
  // the arch's mouth, as the shaft picture shows it (turned over about its crown: archRing), closed across the top
  let ya = Infinity; for (const z of TN.ring) if (z && z.y < ya) ya = z.y
  const cyM = (ya + TN.ring[1].y) / 2, raw = TN.ringIn.map(z => [z.x, 2 * cyM - z.y])
  // (even round its outline, M points, so each arch's points answer to the next's)
  const per = [0]; for (let i = 1; i <= raw.length; i++) { const A = raw[i - 1], B = raw[i % raw.length]; per.push(per[i - 1] + Math.hypot(B[0] - A[0], B[1] - A[1])) }
  const M = 44, Lp = per[raw.length], O = []
  for (let j = 0; j < M; j++) { const d = j / M * Lp; let i = 0; while (i < raw.length - 1 && per[i + 1] < d) i++; const A = raw[i], B = raw[(i + 1) % raw.length], f = (d - per[i]) / ((per[i + 1] - per[i]) || 1); O.push([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]) }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of O) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  // the far end: in the middle of the mouth; drifting only a very little
  const VX = (x0 + x1) / 2 + Math.sin(t * 0.11) * (x1 - x0) * 0.025, VY = y0 + 0.5 * (y1 - y0) + Math.cos(t * 0.083) * (y1 - y0) * 0.02
  const MV = m(VX, VY), sV = m.s(VY); p._VP = { x: MV[0], y: MV[1] }                // (where the salmon go, going down: bodyOf)
  const N = 24, R = 0.84, lw = Math.max(0.6, h._k(p.y) * 0.008)
  const ring = (k) => { const sc = Math.pow(R, k), P = O.map(([x, y]) => [VX + (x - VX) * sc, VY + (y - VY) * sc]); return { sc, P, Q: P.map(([x, y]) => m(x, y)) } }
  const path = (Q) => { ctx.beginPath(); Q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath() }
  const OQ = O.map(([x, y]) => m(x, y))
  ctx.save(); ctx.lineJoin = 'round'
  path(OQ); ctx.clip()                                                       // (only down through the arch)
  ctx.globalAlpha = deep; ctx.fillStyle = 'rgb(2,4,9)'; path(OQ); ctx.fill()
  for (let k = 0; k < N; k++) {
    const E = ring(k), F = ring(k + 1), d = k / N, sc = E.sc, ws = sc + (1 - sc) * sV                      // (ws: how much it's widened, about there)
    if ((x1 - x0) * sc * ws < 1.2) break
    // lit from far below; a slow swell of light going down, a slow shadow coming up
    const pulse = Math.pow(0.5 + 0.5 * Math.cos(k * 0.22 - t * 0.28), 3) * 0.14, shade = Math.pow(0.5 + 0.5 * Math.cos(k * 0.17 + t * 0.19 + 1.3), 3) * 0.12
    const lit = Math.max(0.05, 0.12 + 0.72 * Math.pow(d, 1.5) + pulse * (1 - d * 0.5) - shade * (1 - d))
    const c = [Math.round(70 + 60 * lit), Math.round(82 + 70 * lit), Math.round(100 + 80 * lit)].map(v => Math.round(Math.min(255, v * (0.3 + 0.7 * lit))))
    ctx.globalAlpha = deep * Math.min(1, 0.55 + k * 0.15)
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; path(E.Q); ctx.fill()
    ctx.strokeStyle = 'rgba(2,4,9,0.8)'; ctx.lineWidth = lw * (0.6 + sc * 1.4) * Math.sqrt(ws); path(E.Q); ctx.stroke()
    const tw = k % 2                                                         // (each course's joints half a stone round from the last)
    if (k % 3 === 1) {
      // an arcade round the passage: little arches, crowns toward the light on one course, away from it on the next
      const inv = ((k - 1) / 3) % 2 === 1, step = 2
      ctx.strokeStyle = `rgba(${Math.min(255, c[0] + 40)},${Math.min(255, c[1] + 44)},${Math.min(255, c[2] + 50)},0.9)`; ctx.lineWidth = lw * (0.5 + sc * 1.4) * Math.sqrt(ws)
      for (let i = 0; i < M; i += step) {
        const i1 = (i + step) % M, P0 = (inv ? F : E).P[i], P1 = (inv ? F : E).P[i1], cr = (inv ? E : F).P[(i + 1) % M]
        const mx = (P0[0] + P1[0]) / 2, my = (P0[1] + P1[1]) / 2, hx = (cr[0] - mx) * 0.85, hy = (cr[1] - my) * 0.85, n = 8
        const q0 = [P0[0] + (P1[0] - P0[0]) * 0.1, P0[1] + (P1[1] - P0[1]) * 0.1], q1 = [P0[0] + (P1[0] - P0[0]) * 0.9, P0[1] + (P1[1] - P0[1]) * 0.9]
        ctx.beginPath(); ctx.moveTo(...m(q0[0], q0[1]))
        for (let j = 1; j < n; j++) { const th = Math.PI * j / n, bx = q0[0] + (q1[0] - q0[0]) * (1 - Math.cos(th)) / 2, by = q0[1] + (q1[1] - q0[1]) * (1 - Math.cos(th)) / 2; ctx.lineTo(...m(bx + hx * Math.sin(th), by + hy * Math.sin(th))) }
        ctx.lineTo(...m(q1[0], q1[1])); ctx.closePath()
        ctx.fillStyle = 'rgba(3,6,12,0.82)'; ctx.fill(); ctx.stroke()
      }
    } else {
      // the joints between the stones of the course: from each point of one arch to the same point of the next
      ctx.strokeStyle = 'rgba(2,4,9,0.65)'; ctx.lineWidth = lw * (0.4 + sc) * Math.sqrt(ws); ctx.beginPath()
      for (let i = tw; i < M; i += 2) { const a = E.Q[i], b = F.Q[i]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]) }
      ctx.stroke()
    }
    if (k % 4 === 3) {                                                     // lamps, each with its own slow flicker
      for (let i = 3; i < M; i += 11) {
        const ry = (E.P[i][1] + F.P[i][1]) / 2, [lx, ly] = m((E.P[i][0] + F.P[i][0]) / 2, ry), fl = 0.9 + 0.1 * Math.sin(t * (0.35 + i * 0.01) + k * 2.1 + i), rr = Math.max(1.5, (x1 - x0) * sc * 0.035 * m.s(ry)) * fl
        const gr2 = ctx.createRadialGradient(lx, ly, 0, lx, ly, rr * 3); gr2.addColorStop(0, `rgba(255,226,170,${(0.9 * fl).toFixed(3)})`); gr2.addColorStop(0.25, 'rgba(240,190,120,0.42)'); gr2.addColorStop(1, 'rgba(240,190,120,0)')
        ctx.fillStyle = gr2; ctx.fillRect(lx - rr * 3, ly - rr * 3, rr * 6, rr * 6)
      }
    }
  }
  // the light at the bottom, breathing
  const br = 0.93 + 0.07 * Math.sin(t * 0.21), rr = Math.max(4, (x1 - x0) * 0.16 * Math.sqrt(sV)) * br, [LX, LY] = MV
  const gr = ctx.createRadialGradient(LX, LY, 0, LX, LY, rr * 2.2); gr.addColorStop(0, 'rgba(232,246,250,0.95)'); gr.addColorStop(0.3, 'rgba(160,210,225,0.5)'); gr.addColorStop(1, 'rgba(60,110,130,0)')
  ctx.globalAlpha = deep; ctx.fillStyle = gr; ctx.fillRect(LX - rr * 2.2, LY - rr * 2.2, rr * 4.4, rr * 4.4)
  ctx.restore()
}
// The band of voussoirs round the great archway's mouth, turned over about the middle of its crown (and, looked down into,
// flared: m, deepMap)
function archRing(h, ctx, p, surf, lw, alpha = 1, m = null) {
  const TN = p._W?.tun; if (!TN || TN.ring.some(z => !z) || TN.ringIn.some(z => !z)) return
  const n = TN.ring.length
  let ya = Infinity; for (const z of TN.ring) if (z.y < ya) ya = z.y
  const cyM = (ya + TN.ring[1].y) / 2, F = (z) => (m ? m(z.x, 2 * cyM - z.y) : [z.x, 2 * cyM - z.y])
  // (flared, a straight edge would bend: so each edge in five)
  const fine = (L) => (m ? L.flatMap((z, i) => { const w = L[(i + 1) % L.length]; return [0, 1, 2, 3, 4].map(j => F({ x: z.x + (w.x - z.x) * j / 5, y: z.y + (w.y - z.y) * j / 5 })) }) : L.map(F))
  const A = fine(TN.ring), B = fine(TN.ringIn), st = m ? 5 : 1
  ctx.save(); ctx.globalAlpha = alpha
  ctx.beginPath(); A.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath()
  B.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath()
  const Lw = h.lightAt(p.x, p.y - p.ry + 0.2, surf - 3.2, -1)
  ctx.fillStyle = h._rgb(Lw.map(v => clamp01(v * 1.5 + 0.1) * 0.55), [110, 122, 146]); ctx.fill('evenodd')
  ctx.strokeStyle = 'rgba(2,4,9,0.75)'; ctx.lineWidth = lw; ctx.stroke()
  for (let k = 2; k < n - 2; k += 2) { ctx.beginPath(); ctx.moveTo(B[k * st][0], B[k * st][1]); ctx.lineTo(A[k * st][0], A[k * st][1]); ctx.stroke() }
  ctx.restore()
}
function paintShaft(h, ctx, p, G, surf, key) {
  const yA = -1e9, yB = 1e9, lw = Math.max(1, h._k(p.y - p.ry * 0.5) * 0.013)
  // the far wall of the shaft: courses of cut stone curving round and going down, dimmer the deeper, until the dark has them
  if (!p._W || p._W.key !== key) {
    const pts = G.wall.map(E => E.map(q => h._P(q.x, q.y, q.z)))
    const T = G.tun, tun = { frames: T.frames.map(F => F.map(q => h._P(q.x, q.y, q.z))), treads: T.treads.map(F => F.map(q => h._P(q.x, q.y, q.z))), ring: T.ring.map(q => h._P(q.x, q.y, q.z)), ringIn: T.ringIn.map(q => h._P(q.x, q.y, q.z)) }
    p._W = { key, pts, tun }
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
  // a blind arcade round the shaft just under the water, as Cormac's Chapel is ringed with them: small round arches on
  // shafts, their backs recessed, fading as the water deepens -- broken only where the great archway goes through
  {
    const NA = p.arcade ?? 26, dc = 0.32, TAU = Math.PI * 2
    for (let i = 0; i < NA; i++) {
      const a0 = (i + 0.5) / NA * TAU, a1 = (i + 1.5) / NA * TAU, am = (a0 + a1) / 2
      if (Math.sin(am) > 0.3 || Math.abs(((am + Math.PI / 2 + TAU) % TAU) - 0) < 0.42 || Math.abs(((am + Math.PI / 2 + TAU) % TAU) - TAU) < 0.42) continue
      const P0 = { x: p.x + Math.cos(a0) * p.rx, y: p.y + Math.sin(a0) * p.ry }, P1 = { x: p.x + Math.cos(a1) * p.rx, y: p.y + Math.sin(a1) * p.ry }
      // (hung upside down, as if the arcade were its own reflection: the shafts come down from just under the surface, and
      // each arch turns its crown down into the deep -- what sinks here goes up)
      const rr = Math.hypot(P1.x - P0.x, P1.y - P0.y) / 2, zb = surf - dc, zsp = zb - 0.62
      const fade = Math.pow(Math.max(0, 1 - (dc + 0.62 + rr) / 6.6), 2.3)
      const at = (u, z, inset = 0) => { const a = a0 + (a1 - a0) * u; return h._P(p.x + Math.cos(a) * (p.rx + inset), p.y + Math.sin(a) * (p.ry + inset), z) }
      const arch = (ins, zz) => Array.from({ length: 15 }, (_, k) => { const th = Math.PI - Math.PI * k / 14, u = 0.08 + 0.84 * (1 + Math.cos(th)) / 2; return at(u, zz - Math.sin(th) * (rr * 0.84 - ins), 0) })      // (a true half-circle, crown down)
      const pts = [at(0.08, zb), ...arch(0, zsp), at(0.92, zb)]
      if (pts.some(z => !z)) continue
      const y0 = Math.min(...pts.map(z => z.y)), y1 = Math.max(...pts.map(z => z.y)); if (y1 < yA - 1 || y0 > yB + 1) continue
      const L = h.lightAt(p.x + Math.cos(am) * p.rx, p.y + Math.sin(am) * p.ry + 0.15, zsp, -1), col = L.map(v => clamp01(v * 1.5 + 0.1))
      ctx.beginPath(); pts.forEach((z, k) => (k ? ctx.lineTo(z.x, z.y) : ctx.moveTo(z.x, z.y))); ctx.closePath()
      ctx.fillStyle = `rgba(2,4,9,${(0.55 * fade + 0.1).toFixed(3)})`; ctx.fill()                                  // the recess
      ctx.strokeStyle = h._rgb(col.map(v => v * fade * 1.05), [120, 132, 152]); ctx.lineWidth = lw * 1.8
      ctx.beginPath(); arch(0, zsp).forEach((z, k) => (k ? ctx.lineTo(z.x, z.y) : ctx.moveTo(z.x, z.y))); ctx.stroke()       // its arch
      for (const u of [0.08, 0.92]) { const t0 = at(u, zsp), t1 = at(u, zb); if (t0 && t1) { ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.stroke() } }   // its shafts
      const c0 = at(0.08, zsp), c1 = at(0.92, zsp)
      ctx.fillStyle = h._rgb(col.map(v => v * fade * 1.2), [120, 132, 152])
      for (const c of [c0, c1]) if (c) ctx.fillRect(c.x - lw * 1.6, c.y - lw, lw * 3.2, lw * 2)                       // the capitals
    }
  }
  // the great archway: its dark mouth, and the band of voussoirs round it
  {
    const TN = p._W.tun, FR = TN.frames, KF = FR.length - 1, n = FR[0].length
    if (!FR.some(F => F.some(z => !z)) && !TN.ring.some(z => !z) && !TN.ringIn.some(z => !z)) {
      let ya = Infinity, yb = -Infinity; for (const z of TN.ring) { if (z.y < ya) ya = z.y; if (z.y > yb) yb = z.y }
      // (and the great archway too, its picture turned over about the middle of its crown, so the crown stays where it was
      // but hangs down into the deep, U-wise, and its jambs go up out of the light through the water's skin)
      const cyM = (ya + TN.ring[1].y) / 2
      for (const z of FR[KF]) if (z.y > yb) yb = z.y
      if (!(yb < yA - 1 || ya > yB + 1)) {
        ctx.save(); ctx.translate(0, 2 * cyM); ctx.scale(1, -1)
        const base = h.lightAt(p.x, p.y - p.ry + 0.3, surf - 3.5, -1), bl = Math.max(0.35, Math.min(1, (base[0] + base[1] + base[2]) / 1.5))
        const poly = (pts, col) => { ctx.beginPath(); pts.forEach((z, k) => (k ? ctx.lineTo(z.x, z.y) : ctx.moveTo(z.x, z.y))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(1,2,6,0.7)'; ctx.lineWidth = lw; ctx.stroke() }
        const sh = (k, m) => { const f = m * bl * Math.pow(Math.max(0, 1 - k / (KF + 1.5)), 1.5); return `rgb(${(78 * f) | 0},${(92 * f) | 0},${(116 * f) | 0})` }
        ctx.beginPath(); FR[0].forEach((z, k) => (k ? ctx.lineTo(z.x, z.y) : ctx.moveTo(z.x, z.y))); ctx.closePath(); ctx.fillStyle = 'rgb(1,2,5)'; ctx.fill()
        // (no stair through it now: only the dark of its mouth, so the arch itself is what you see, the well beyond it)
        void poly; void sh
        const E = FR[KF], gx = (E[0].x + E[n - 1].x) / 2, gy = (E[0].y + E[1].y) / 2, gr = Math.abs(E[n - 1].x - E[0].x) * 0.7
        const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr); gg.addColorStop(0, 'rgba(70,170,180,0.2)'); gg.addColorStop(1, 'rgba(70,170,180,0)')
        ctx.fillStyle = gg; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2)
        ctx.restore()
        archRing(h, ctx, p, surf, lw)                                              // the frame: a band of voussoirs round the mouth
      }
    }
  }
  ctx.lineWidth = lw * 1.4; ctx.strokeStyle = 'rgba(190,220,245,0.4)'; ctx.beginPath()          // the water's edge on the wall
  G.wall[0].forEach((q, i) => { const z = WP[0][i]; if (z && Math.sin(i / SEG * Math.PI * 2) < 0.4) ctx.lineTo(z.x, z.y); else ctx.moveTo(z ? z.x : 0, z ? z.y : 0) }); ctx.stroke()
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
    if (yB >= (ft ? ft.y : h._Y(p.y - p.ry, surf)) - 2 && yA <= (nt0 ? nt0.y : h._Y(p.y + p.ry, zr)) + 2) {      // (an edge behind the camera, standing close or pinched in: still painted, else the floor shows grey)
      const L = h.lightAt(p.x, p.y - p.ry + 0.4, surf - 0.1, -1), v = Math.min(1.3, Math.max(L[0], L[1], L[2]) * 1.6)
      const slab = (e) => { ctx.beginPath(); ctx.rect(0, yA - e, h.cam.sw, yB - yA + 2 * e); ctx.clip() }   // (a row's band overlaps the one before it: the later one repaints the same thing)
      const F = fishFrame(h, p, surf), warp = (h.deep || 0) > 0.02
      ctx.save(); slab(0.6)
      ctx.beginPath(); worldPath(h, ctx, G.top); ctx.clip(); ctx.beginPath(); worldPath(h, ctx, G.water); ctx.clip()
      if (warp) paintWaterWarped(h, ctx, p, G, surf, F, yA, yB)              // (looking down into the well from the step: all of it, wavering)
      else paintShaftBand(h, ctx, p, G, surf, yA, yB)
      ctx.restore()
      ctx.save(); slab(0.6)
      ctx.beginPath(); worldPath(h, ctx, G.top); ctx.clip(); ctx.beginPath(); worldPath(h, ctx, G.water); ctx.clip()
      if (!warp) {
        if (p.steps) drawSunkSteps(h, ctx, p, surf)
        if (h.inWater) drawEyesInWater(h, ctx, p, h.inWater, surf)
        if (h.mirror) drawMirror(h, ctx, h.mirror, surf, yA, yB)            // (whoever stands at the step's end, under the water: cave/wellMirror.js)
        drawFishBand(h, ctx, F, yA - 40, yB + 40, surf)
      }
      ctx.globalCompositeOperation = 'lighter'
      for (const nt of F.nuts) { ctx.fillStyle = 'rgba(205,150,60,0.9)'; ctx.beginPath(); ctx.ellipse(nt.x, nt.y, Math.max(1.5, h._k(p.y) * 0.04), Math.max(1, h._k(p.y) * 0.026), 0, 0, Math.PI * 2); ctx.fill() }
      for (const gl of F.glints || []) {                                     // (a nut lifting out to you: a small gleam on it)
        if (!gl.s) continue; const r2 = h._k(p.y) * 0.12 * gl.a
        ctx.strokeStyle = `rgba(255,236,190,${(0.8 * gl.a).toFixed(3)})`; ctx.lineWidth = Math.max(1, h._k(p.y) * 0.012)
        ctx.beginPath(); ctx.moveTo(gl.s.x - r2, gl.s.y); ctx.lineTo(gl.s.x + r2, gl.s.y); ctx.moveTo(gl.s.x, gl.s.y - r2); ctx.lineTo(gl.s.x, gl.s.y + r2); ctx.stroke()
      }
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
  if (p.steps) drawPoolSteps(h, ctx, p, r, zr, surf)
  // a nut falling from the roots (not clipped: it comes from high above the pool) -- not while you look down into the well
  if ((h.deep || 0) < 0.5) for (const f of fishFrame(h, p, surf).falls) {
    if (Math.floor(f.y) !== r) continue
    const a = h._P(f.x, f.y, f.z), b = h._P(f.x, f.y, f.z + 0.5); if (!a || !b) continue
    ctx.strokeStyle = 'rgba(205,150,60,0.35)'; ctx.lineWidth = Math.max(1, h._k(f.y) * 0.03); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    ctx.fillStyle = 'rgb(214,160,70)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, Math.max(1.5, h._k(f.y) * 0.05), Math.max(1.5, h._k(f.y) * 0.06), 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

// The dais under the great arch, and the flight from it down into the water: the pool's `dais` { x0, x1, y0, y1, z } and
// `steps` [{ x0, x1, y0, y1, z }], highest first. Those above the water are drawn whole with every row's band of the water
// (each band paints the water over the screen where they are, so each paints them again after), clipped to that band;
// those under it, in the water, dimmer the deeper, going on down out of sight. Cut stone like the rest of the hall: the
// tops in slabs, worn pale at the nosing; along every riser a row of billets, as round the rim.
function stoneTop(h, ctx, S, z, L, lw, seed, slab = 0.68) {
  const nb = Math.max(1, Math.round((S.x1 - S.x0) / slab)), w = (S.x1 - S.x0) / nb, R = (k) => (hash(seed * 7919 + k * 131) & 0xffff) / 65535
  ctx.strokeStyle = 'rgba(8,9,14,0.5)'; ctx.lineWidth = lw
  ctx.beginPath()
  for (let j = 1; j < nb; j++) { const x = S.x0 + j * w + (R(j) - 0.5) * 0.08, a = h._P(x, S.y0, z), b = h._P(x, S.y1, z); if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y) } }
  if (S.y1 - S.y0 > 0.7) { const ym = (S.y0 + S.y1) / 2, a = h._P(S.x0, ym, z), b = h._P(S.x1, ym, z); if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y) } }   // (a deep step: two courses of slabs)
  ctx.stroke()
  // its grain: a scatter of darker and paler flecks, and a slab here and there a shade off
  for (let j = 0; j < nb; j++) {
    const sh = R(40 + j)
    if (sh > 0.6) { ctx.beginPath(); if (worldPath(h, ctx, [{ x: S.x0 + j * w, y: S.y0, z }, { x: S.x0 + (j + 1) * w, y: S.y0, z }, { x: S.x0 + (j + 1) * w, y: S.y1, z }, { x: S.x0 + j * w, y: S.y1, z }])) { ctx.fillStyle = `rgba(${sh > 0.8 ? '220,226,240' : '10,12,20'},0.07)`; ctx.fill() } }
    for (let i = 0; i < 9; i++) {
      const q = h._P(S.x0 + (j + R(j * 31 + i)) * w, S.y0 + R(j * 37 + i + 300) * (S.y1 - S.y0), z); if (!q) continue
      ctx.fillStyle = R(j * 41 + i + 600) < 0.5 ? 'rgba(8,10,16,0.35)' : 'rgba(225,230,240,0.22)'; ctx.fillRect(q.x, q.y, lw * 1.3, lw * 1.3)
    }
  }
  const a = h._P(S.x0, S.y1, z), b = h._P(S.x1, S.y1, z)                     // (worn pale at the nosing)
  if (a && b) { ctx.strokeStyle = 'rgba(236,240,250,0.32)'; ctx.lineWidth = lw * 1.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
}
function billets(h, ctx, S, zt, zl, lw, col) {
  const n = Math.max(3, Math.round((S.x1 - S.x0) / 0.22)), w = (S.x1 - S.x0) / n, zm = (zt + zl) / 2, hh = Math.min(0.045, (zt - zl) * 0.22)
  ctx.fillStyle = col
  for (let i = 0; i < n; i += 2) {
    const q = [{ x: S.x0 + (i + 0.15) * w, y: S.y1, z: zm + hh }, { x: S.x0 + (i + 0.85) * w, y: S.y1, z: zm + hh }, { x: S.x0 + (i + 0.85) * w, y: S.y1, z: zm - hh }, { x: S.x0 + (i + 0.15) * w, y: S.y1, z: zm - hh }]
    ctx.beginPath(); if (worldPath(h, ctx, q)) ctx.fill()
  }
  ctx.strokeStyle = 'rgba(8,9,14,0.35)'; ctx.lineWidth = lw
  for (const zz of [zm + hh * 1.9, zm - hh * 1.9]) { const a = h._P(S.x0, S.y1, zz), b = h._P(S.x1, S.y1, zz); if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() } }
}
// the dais's top: the floor's own picture, raised -- the rim's ring of stones going on under the arch at the dais's height
// (the floor painted there is the rim's, as drawStones does for the raised stones of the hall)
function floorTop(h, ctx, S) {
  if (!h.litCv || !h.base) return false
  const TPx = h.base.width / h.W, c0 = Math.max(0, Math.floor(S.x0)), c1 = Math.min(h.W - 1, Math.floor(S.x1 - 1e-6))
  for (let rr = Math.floor(S.y0); rr <= Math.floor(S.y1 - 1e-6); rr++) {
    const ya = Math.max(S.y0, rr), yb = Math.min(S.y1, rr + 1)
    ctx.save(); ctx.beginPath()
    if (worldPath(h, ctx, [{ x: S.x0, y: ya, z: S.z }, { x: S.x1, y: ya, z: S.z }, { x: S.x1, y: yb, z: S.z }, { x: S.x0, y: yb, z: S.z }])) {
      ctx.clip(); h._strips(ctx, h.litCv, rr, c0, c1, S.z, c0 * TPx, (c1 + 1) * TPx, rr * TPx, h._Y(rr, S.z), h._Y(rr + 1, S.z))
    }
    ctx.restore()
  }
  return true
}
function stepBlock(h, ctx, S, zb, L, lw, seed, k = 1, sunk = 0) {
  const C = h.cam, zt = S.z
  const tone = (m) => h._rgb(L.map(v => clamp01(v * m * k)), sunk ? [74, 96, 122] : [92, 94, 100])          // (the floor's own grey)
  const face = (q, fill) => { ctx.beginPath(); if (!worldPath(h, ctx, q)) return false; ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = `rgba(6,8,12,${sunk ? 0.3 : 0.55})`; ctx.lineWidth = lw; ctx.stroke(); return true }
  if (C.col < S.x0) face([{ x: S.x0, y: S.y0, z: zt }, { x: S.x0, y: S.y1, z: zt }, { x: S.x0, y: S.y1, z: zb }, { x: S.x0, y: S.y0, z: zb }], tone(0.72))
  if (C.col > S.x1) face([{ x: S.x1, y: S.y0, z: zt }, { x: S.x1, y: S.y1, z: zt }, { x: S.x1, y: S.y1, z: zb }, { x: S.x1, y: S.y0, z: zb }], tone(0.72))
  if (face([{ x: S.x0, y: S.y1, z: zt }, { x: S.x1, y: S.y1, z: zt }, { x: S.x1, y: S.y1, z: zb }, { x: S.x0, y: S.y1, z: zb }], tone(0.92)) && !sunk) billets(h, ctx, S, zt, zb, lw, h._rgb(L.map(v => clamp01(v * 1.2)), [106, 108, 116]))
  if (!sunk && floorTop(h, ctx, S)) {                                       // (its top: the floor's own curved courses, at its height)
    const a = h._P(S.x0, S.y1, zt), b = h._P(S.x1, S.y1, zt)                // (and its edge, worn pale)
    if (a && b) { ctx.strokeStyle = 'rgba(236,240,250,0.3)'; ctx.lineWidth = lw * 1.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
    return
  }
  if (face([{ x: S.x0, y: S.y0, z: zt }, { x: S.x1, y: S.y0, z: zt }, { x: S.x1, y: S.y1, z: zt }, { x: S.x0, y: S.y1, z: zt }], tone(1.22)) && !sunk) stoneTop(h, ctx, S, zt, L, lw, seed)
}
// a step that is a piece of one of the pool's own rings: between two of its ellipses (S.g0 out, S.g1 in -- as the rings are
// measured, out from the water's edge), over the angles S.a0..S.a1, cut in voussoir-like stones as the rim's courses are
function ringStep(h, ctx, p, S, zb, L, lw, seed) {
  const C = h.cam, n = 20, zt = S.z, R = (k) => (hash(seed * 7919 + k * 131) & 0xffff) / 65535
  const at = (a, g, z) => ({ x: p.x + Math.cos(a) * (p.rx + g), y: p.y + Math.sin(a) * (p.ry + g), z })
  const arc = (g, z, rev) => { const o = []; for (let i = 0; i <= n; i++) { const f = rev ? 1 - i / n : i / n; o.push(at(S.a0 + (S.a1 - S.a0) * f, g, z)) } return o }
  const tone = (m) => h._rgb(L.map(v => clamp01(v * m)), [92, 94, 100])
  const face = (q, fill, edge = 0.55) => { ctx.beginPath(); if (!worldPath(h, ctx, q)) return false; ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = `rgba(6,8,12,${edge})`; ctx.lineWidth = lw; ctx.stroke(); return true }
  const w0 = at(S.a0, S.g0, zt), w1 = at(S.a1, S.g0, zt)
  if (C.col < w0.x) face([at(S.a0, S.g0, zt), at(S.a0, S.g1, zt), at(S.a0, S.g1, zb), at(S.a0, S.g0, zb)], tone(0.72))
  if (C.col > w1.x) face([at(S.a1, S.g0, zt), at(S.a1, S.g1, zt), at(S.a1, S.g1, zb), at(S.a1, S.g0, zb)], tone(0.72))
  face([...arc(S.g1, zt), ...arc(S.g1, zb, true)], tone(0.9))                                   // its riser, curving
  // billets along the riser, as round the rim
  const zm = (zt + zb) / 2 + (zt - zb) * 0.15, hh = Math.min(0.035, (zt - zb) * 0.18), NB = Math.max(4, Math.round((S.a1 - S.a0) * (p.rx + S.g1) / 0.2))
  ctx.fillStyle = h._rgb(L.map(v => clamp01(v * 1.2)), [106, 108, 116])
  for (let i = 0; i < NB; i += 2) {
    const a = S.a0 + (S.a1 - S.a0) * (i + 0.15) / NB, b = S.a0 + (S.a1 - S.a0) * (i + 0.85) / NB
    ctx.beginPath(); if (worldPath(h, ctx, [at(a, S.g1, zm + hh), at(b, S.g1, zm + hh), at(b, S.g1, zm - hh), at(a, S.g1, zm - hh)])) ctx.fill()
  }
  face([...arc(S.g0, zt), ...arc(S.g1, zt, true)], tone(1.18), 0.5)                            // its top
  // its stones: joints running in toward the well's middle, as the rim's are cut; a slab here and there a shade off; grain
  const len = (S.a1 - S.a0) * (p.rx + (S.g0 + S.g1) / 2), ns = Math.max(2, Math.round(len / 0.62)), off = (seed % 2) * 0.5
  ctx.strokeStyle = 'rgba(8,9,14,0.5)'; ctx.lineWidth = lw
  for (let j = 0; j < ns; j++) {
    const fa0 = (j + off) / ns, fa1 = Math.min(1, (j + 1 + off) / ns), a0 = S.a0 + (S.a1 - S.a0) * fa0, a1 = S.a0 + (S.a1 - S.a0) * fa1
    if (j || off) { const q0 = h._P(at(a0, S.g0, zt).x, at(a0, S.g0, zt).y, zt), q1 = h._P(at(a0, S.g1, zt).x, at(a0, S.g1, zt).y, zt); if (q0 && q1) { ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke() } }
    const sh = R(40 + j)
    if (sh > 0.62) { ctx.beginPath(); if (worldPath(h, ctx, [at(a0, S.g0, zt), at(a1, S.g0, zt), at(a1, S.g1, zt), at(a0, S.g1, zt)])) { ctx.fillStyle = `rgba(${sh > 0.82 ? '220,226,240' : '10,12,20'},0.07)`; ctx.fill() } }
    for (let i = 0; i < 8; i++) {
      const q = at(a0 + (a1 - a0) * R(j * 31 + i), S.g0 + (S.g1 - S.g0) * R(j * 37 + i + 300), zt), Q = h._P(q.x, q.y, zt); if (!Q) continue
      ctx.fillStyle = R(j * 41 + i + 600) < 0.5 ? 'rgba(8,10,16,0.35)' : 'rgba(225,230,240,0.2)'; ctx.fillRect(Q.x, Q.y, lw * 1.2, lw * 1.2)
    }
  }
  // worn pale at the nosing
  ctx.strokeStyle = 'rgba(236,240,250,0.28)'; ctx.lineWidth = lw * 1.4; ctx.beginPath()
  arc(S.g1, zt).forEach((q, i) => { const Q = h._P(q.x, q.y, q.z); if (Q) (i ? ctx.lineTo(Q.x, Q.y) : ctx.moveTo(Q.x, Q.y)) }); ctx.stroke()
}
function drawPoolSteps(h, ctx, p, r, zr, surf) {
  const C = h.cam, yA = h._Y(r, zr) - 1, yB = h._Y(r + 1, 0) + 1
  ctx.save(); ctx.beginPath(); ctx.rect(0, yA, C.sw, yB - yA); ctx.clip()
  const dry = [...(p.dais ? [{ ...p.dais, dais: true }] : []), ...p.steps.filter(S => S.z > surf)]
  dry.forEach((S, i) => {
    const zb = S.dais ? p.z - 0.05 : surf - 0.2, tl = h._P(S.x0, S.y0, S.z), br = h._P(S.x1, S.y1, zb); if (!tl || !br || br.y < yA || tl.y > yB) return
    const L = h.lightAt((S.x0 + S.x1) / 2, S.y1 - 0.2, S.z + 0.3, -1), lw = Math.max(1, h._k(S.y1) * 0.011)
    if (S.g0 != null) ringStep(h, ctx, p, S, zb, L, lw, i + 3); else stepBlock(h, ctx, S, zb, L, lw, i + 3)
    if (!S.dais && S === p.steps.filter(T => T.z > surf).at(-1)) {
      ctx.strokeStyle = 'rgba(150,190,210,0.35)'; ctx.lineWidth = lw; ctx.beginPath()                // (the wet line where it goes into the water)
      if (S.g0 != null) { for (let j = 0; j <= 16; j++) { const a = S.a0 + (S.a1 - S.a0) * j / 16, Q = h._P(p.x + Math.cos(a) * (p.rx + S.g1), p.y + Math.sin(a) * (p.ry + S.g1), surf); if (Q) (j ? ctx.lineTo(Q.x, Q.y) : ctx.moveTo(Q.x, Q.y)) } }
      else { const c = h._P(S.x0, S.y1, surf), d = h._P(S.x1, S.y1, surf); if (c && d) { ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y) } }
      ctx.stroke()
      // nuts coming up out of the water onto it, each with a small gleam (startPoolGifts; g.rest from cave/wellMirror.js)
      for (const g of p._gifts || []) {
        if (g.lift == null || g.taken) continue
        const f = Math.min(1, (h.t - g.lift) / 0.7), [rx, ry, rz] = g.rest || [g.T[0], g.T[1], S.z], nz = surf + (rz - surf) * f + 0.35 * Math.sin(Math.PI * f)
        const q = h._P(g.T[0] + (rx - g.T[0]) * f, g.T[1] + (ry - g.T[1]) * f, nz), k = h._k(ry); if (!q) continue
        ctx.fillStyle = 'rgb(150,98,46)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.max(2, k * 0.05), Math.max(1.5, k * 0.04), 0, 0, Math.PI * 2); ctx.fill()
        const r2 = k * 0.13 * (1 - f); ctx.strokeStyle = `rgba(255,236,190,${(0.85 * (1 - f)).toFixed(3)})`; ctx.lineWidth = Math.max(1, k * 0.012)
        ctx.beginPath(); ctx.moveTo(q.x - r2, q.y); ctx.lineTo(q.x + r2, q.y); ctx.moveTo(q.x, q.y - r2); ctx.lineTo(q.x, q.y + r2); ctx.stroke()
      }
      // nuts the salmon left there (cave/wellMirror.js: the pool's `lying`)
      for (const n of p.lying || []) {
        const q = h._P(n.x, n.y, S.z), k = h._k(n.y); if (!q) continue
        const rx = Math.max(2, k * 0.05), ry = Math.max(1.5, k * 0.04)
        ctx.fillStyle = 'rgba(4,5,8,0.4)'; ctx.beginPath(); ctx.ellipse(q.x + rx * 0.2, q.y + ry * 0.4, rx * 1.1, ry * 0.6, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgb(150,98,46)'; ctx.beginPath(); ctx.ellipse(q.x, q.y - ry * 0.5, rx, ry, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(232,206,150,0.85)'; ctx.beginPath(); ctx.ellipse(q.x - rx * 0.1, q.y - ry * 1.15, rx * 0.55, ry * 0.32, 0, 0, Math.PI * 2); ctx.fill()
      }
    }
  })
  ctx.restore()
}
// the flight going on down under the water: dimmer and bluer with every step, until the dark has it (in the water's clip)
function drawSunkSteps(h, ctx, p, surf) {
  const sunk = p.steps.filter(S => S.z <= surf)
  sunk.forEach((S, i) => {
    const d = surf - S.z, f = Math.exp(-d * 2.2); if (f < 0.05) return
    const L = h.lightAt((S.x0 + S.x1) / 2, S.y1 - 0.2, surf, -1), lw = Math.max(1, h._k(S.y1) * 0.01)
    ctx.globalAlpha = (0.12 + 0.68 * f) * (1 - 0.6 * (h.deep || 0))                // (looking down into the well, they go thin: it's the well you see)
    stepBlock(h, ctx, S, S.z - 0.6, L, lw, 20 + i, 0.4 + 0.6 * f, 1)
    ctx.globalAlpha = 1
  })
}

// Géaga's eyes, as you see them from the well's step: not up in the roots where she is, but down in the water, as a
// reflection is -- huge, pale, wavering, the well showing through them (escape.js sets h.inWater: { x, y, wake })
function drawEyesInWater(h, ctx, p, g, surf) {
  // (where in the water: a little below the middle of the screen, whatever the view -- tipped down, the pool's middle is
  // often off the bottom of it)
  let y = p.y - p.ry + 0.6, best = Infinity
  for (let yy = y; yy <= p.y + p.ry * 0.6; yy += 0.1) { const q = h._P(g.x, yy, surf - 0.6); if (!q) continue; const d = Math.abs(q.y - h.cam.sh * 0.68); if (d < best) { best = d; y = yy } }
  const t = h.t, k = h._k(y); if (!k) return
  const breathe = 0.85 + 0.15 * Math.sin(t * 0.9)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  for (const side of [-1, 1]) {
    const wx = g.x + side * 1.5 + Math.sin(t * 0.7 + side) * 0.06, c = h._P(wx, y + Math.sin(t * 0.5 + side * 2) * 0.05, surf - 0.6); if (!c) continue
    const w = k * 1.1 * (1 + 0.04 * Math.sin(t * 1.3 + side)), hh = k * 0.12 * g.wake
    const gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, w)
    gr.addColorStop(0, `rgba(225,240,170,${(0.42 * g.wake * breathe).toFixed(3)})`); gr.addColorStop(1, 'rgba(225,240,170,0)')
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(c.x, c.y, w, w * 0.5, 0, 0, Math.PI * 2); ctx.fill()
    // (the eye itself, in a few wavering slices, as a thing seen through moving water is)
    for (let i = -2; i <= 2; i++) {
      const dx = Math.sin(t * 2.1 + i * 1.3 + side) * w * 0.05
      ctx.fillStyle = `rgba(245,255,215,${(0.42 * g.wake * (1 - Math.abs(i) * 0.22)).toFixed(3)})`
      ctx.beginPath(); ctx.ellipse(c.x + dx, c.y + i * hh * 0.4, w * 0.42 * (1 - Math.abs(i) * 0.12), Math.max(0.6, hh * 0.32), side * 0.12, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
}

// You, in the water at the foot of the steps (cave/wellMirror.js sets h.mirror: { img, left, x, y, ps, hm, alpha, deep }):
// your head and shoulders, turned over, looking up at you, never still, as a reflection is. Looking down into the well
// (deep), it grows to fill the water: a great faint face, only its outline, so the arch and the well show through it.
const HEADS = new WeakMap()
function headOf(img) {
  let e = HEADS.get(img); if (e) return e
  const part = 0.46, w = img.width, hh = Math.max(1, Math.round(img.height * part))
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hh
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0, w, hh, 0, 0, w, hh)
  try {
    const D = g.getImageData(0, 0, w, hh), d = D.data, A = (x, y) => (x < 0 || y < 0 || x >= w || y >= hh ? 0 : d[(y * w + x) * 4 + 3])
    const al = new Uint8ClampedArray(w * hh)
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const a = A(x, y); if (!a) continue
      const edge = !A(x - 1, y) || !A(x + 1, y) || !A(x, y - 1) || !A(x, y + 1), near = edge || !A(x - 2, y) || !A(x + 2, y) || !A(x, y - 2) || !A(x, y + 2)
      const r = Math.min(1, Math.hypot((x + 0.5) / w - 0.5, (y + 0.5) / hh - 0.55) * 2.2)
      al[y * w + x] = a * (edge ? 1 : near ? 0.22 : 0)                      // (only its outline: the arch below shows through it)
    }
    for (let i = 0; i < w * hh; i++) d[i * 4 + 3] = al[i]
    g.putImageData(D, 0, 0)
  } catch (_) {}
  e = { cv, w, hh }; HEADS.set(img, e); return e
}
function drawMirror(h, ctx, M, surf, yA = -1e9, yB = 1e9) {
  if (!(M.alpha > 0.01) || !M.img) return
  const S = h._P(M.x, M.y, surf), k = h._k(M.y); if (!S || !k) return
  const E = headOf(M.img), deep = M.deep || 0
  const W = (k * M.ps * 2.6) * (1 - deep) + h.cam.sw * 1.05 * deep, H = W * E.hh / E.w * (1 + 0.5 * deep)
  const n = 16, t = h.t
  ctx.save(); ctx.imageSmoothingEnabled = false
  let y = S.y
  for (let i = 0; i < n; i++) {                                               // from the shoulders (at the water's edge) out to the crown of the head
    const st = 1 + (0.28 + 0.2 * deep) * Math.sin(t * 1.1 + i * 0.55) + 0.12 * Math.sin(t * 2.3 - i * 1.1), sh = H / n * st
    if (y > yB + 2) break
    if (y + sh >= yA - 2) {
      const sx = 1 + (0.14 + 0.1 * deep) * Math.sin(t * 0.8 + i * 0.45), wob = Math.sin(t * 1.4 + i * 0.7) * (k * 0.05 + W * 0.02 * deep)
      const srcY = E.hh * (1 - (i + 1) / n), srcH = E.hh / n
      ctx.globalAlpha = M.alpha * (0.34 - 0.12 * deep) * (0.55 + 0.45 * Math.sin(Math.PI * (i + 0.5) / n))
      ctx.save(); ctx.translate(S.x + wob, y); ctx.scale((M.left ? -1 : 1) * sx, 1)
      ctx.drawImage(E.cv, 0, srcY, E.w, srcH, -W / 2, 0, W, sh + 0.6)
      ctx.restore()
    }
    y += sh
  }
  ctx.restore()
}

// ═════════ the arch over the well, and what's left of the arcade ════════════════════════════════════════════════
// { type: 'wellarch', x, y (its line, across the rim), z (the rim's top), w (from the middle to the inside of each jamb),
// zs (the springing, over z) }: the great arch down in the well, standing whole on the rim above it -- the same plain ring
// of voussoirs on two square jambs, the same width -- so that each is the other's reflection.
// { type: 'stump', x, y, z, h, a, seed }: the foot of one of the shafts of an arcade that stood round the north rim once,
// where the blind arcade under the water has its shafts: a plinth and the stub of the shaft, broken off; some no more
// than the plinth.
function solids(X0, Y0, Z0) {
  const faces = []
  const box = (C, rgb, part) => {
    const P = C.map(([u, v, w]) => ({ x: X0 + u, y: Y0 + w, z: Z0 + v })), mid = P.reduce((a, q) => ({ x: a.x + q.x / 8, y: a.y + q.y / 8, z: a.z + q.z / 8 }), { x: 0, y: 0, z: 0 })
    for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) {
      const q = f.map(i => P[i]), e1 = { x: q[1].x - q[0].x, y: q[1].y - q[0].y, z: q[1].z - q[0].z }, e2 = { x: q[3].x - q[0].x, y: q[3].y - q[0].y, z: q[3].z - q[0].z }
      let n = { x: e1.y * e2.z - e1.z * e2.y, y: e1.z * e2.x - e1.x * e2.z, z: e1.x * e2.y - e1.y * e2.x }
      const fc = q.reduce((a, r) => ({ x: a.x + r.x / 4, y: a.y + r.y / 4, z: a.z + r.z / 4 }), { x: 0, y: 0, z: 0 })
      if (n.x * (fc.x - mid.x) + n.y * (fc.y - mid.y) + n.z * (fc.z - mid.z) < 0) n = { x: -n.x, y: -n.y, z: -n.z }
      const l = Math.hypot(n.x, n.y, n.z) || 1; faces.push({ q, n: { x: n.x / l, y: n.y / l, z: n.z / l }, c: fc, rgb, part })
    }
  }
  // a quad in the (u, v) plane pushed through from w0 to w1 (its top corners may sit at their own heights)
  const prism = (Q, w0, w1, rgb, part) => box([...Q.map(([u, v]) => [u, v, w0]), ...Q.map(([u, v]) => [u, v, w1])], rgb, part)
  return { faces, box, prism }
}
function drawSolids(h, ctx, faces, k, at, lift = 1.7, amb = 0.16) {
  const C = h.cam, eye = { x: C.col, y: C.row + C.FL, z: C.z + C.gH * C.FL / C.k0 }
  const L = h.lightAt(at.x, at.y, at.z, -1), LD = { x: -0.5, y: -0.35, z: 0.79 }
  const dist = (f) => Math.hypot(f.c.x - eye.x, f.c.y - eye.y, f.c.z - eye.z)
  const vis = faces.filter(f => f.n.x * (eye.x - f.c.x) + f.n.y * (eye.y - f.c.y) + f.n.z * (eye.z - f.c.z) > 0).sort((a, b) => dist(b) - dist(a))
  const lw = Math.max(1, k * 0.01)
  ctx.save(); ctx.lineJoin = 'round'
  for (const f of vis) {
    const S = f.q.map(q => h._P(q.x, q.y, q.z)); if (S.some(q => !q)) continue
    const sh = 0.5 + 0.6 * Math.max(0, f.n.x * LD.x + f.n.y * LD.y + f.n.z * LD.z)
    ctx.beginPath(); S.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath()
    ctx.fillStyle = h._rgb(L.map(v => clamp01((v * lift + amb) * sh)), f.rgb); ctx.fill()
    ctx.strokeStyle = 'rgba(8,9,14,0.45)'; ctx.lineWidth = lw; ctx.stroke()
  }
  ctx.restore()
}
function wellArchFaces(p) {
  if (p._F) return p._F
  const { faces, prism } = solids(p.x, p.y, p.z)
  // (the rim's own stone and its own work: the same grey, an impost at each springing, and the rim's billets round the
  // arch's face -- so it reads as of a piece with the floor it stands on, not set on it after)
  const W = p.w, T = 0.3, ZS = p.zs, D = 0.22, ST = [100, 102, 110], ST2 = [92, 94, 102], BL = [112, 114, 122]
  const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
  for (const sd of [-1, 1]) {
    const u0 = sd < 0 ? -W - T : W, u1 = u0 + T
    prism(rect(u0 - 0.06, u1 + 0.06, 0, 0.16), -D - 0.05, D + 0.05, ST2, 'plinth')
    const cuts = [0.16, 0.84, 1.56, ZS - 0.14]
    for (let i = 0; i < 3; i++) prism(rect(u0, u1, cuts[i], cuts[i + 1]), -D, D, i % 2 ? ST2 : ST, 'jamb')
    prism(rect(u0 - 0.07, u1 + 0.07, ZS - 0.14, ZS), -D - 0.05, D + 0.05, ST2, 'impost')
  }
  const N = 11, rI = W, rO = W + T
  for (let i = 0; i < N; i++) {
    const a0 = Math.PI - i * Math.PI / N, a1 = Math.PI - (i + 1) * Math.PI / N
    prism([[rI * Math.cos(a0), ZS + rI * Math.sin(a0)], [rO * Math.cos(a0), ZS + rO * Math.sin(a0)], [rO * Math.cos(a1), ZS + rO * Math.sin(a1)], [rI * Math.cos(a1), ZS + rI * Math.sin(a1)]], -D, D, i % 2 ? ST2 : ST, 'vous')
  }
  // the billets: little blocks standing proud of the arch's face, every other one, round its middle
  const NB = 22, b0 = W + T * 0.3, b1 = W + T * 0.7
  for (let i = 0; i < NB; i += 2) {
    const a0 = Math.PI - (i + 0.15) * Math.PI / NB, a1 = Math.PI - (i + 0.85) * Math.PI / NB
    prism([[b0 * Math.cos(a0), ZS + b0 * Math.sin(a0)], [b1 * Math.cos(a0), ZS + b1 * Math.sin(a0)], [b1 * Math.cos(a1), ZS + b1 * Math.sin(a1)], [b0 * Math.cos(a1), ZS + b0 * Math.sin(a1)]], D, D + 0.05, BL, 'billet')
  }
  return (p._F = faces)
}
export function drawWellArch(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  drawSolids(h, ctx, wellArchFaces(p), k, { x: p.x, y: p.y + 0.6, z: p.z + 0.4 }, 1.25, 0.05)
}
function stumpFaces(p) {
  if (p._F) return p._F
  const { faces, box } = solids(p.x, p.y, 0)
  const R = (i) => (hash((p.seed ?? 1) * 7919 + i * 131) & 0xffff) / 65535
  const ca = Math.cos(p.a ?? 0), sa = Math.sin(p.a ?? 0)
  // (turned to face the pool's middle: u along the rim, w out from it)
  const cub = (u0, u1, w0, w1, v0, vt, rgb, part) => {
    const C = [[u0, w0], [u1, w0], [u1, w1], [u0, w1]].map(([u, w]) => [u * ca - w * sa, u * sa + w * ca])
    const top = (i) => (Array.isArray(vt) ? vt[i] : vt)
    box([[C[0][0], v0, C[0][1]], [C[1][0], v0, C[1][1]], [C[1][0], top(1), C[1][1]], [C[0][0], top(0), C[0][1]],
      [C[3][0], v0, C[3][1]], [C[2][0], v0, C[2][1]], [C[2][0], top(2), C[2][1]], [C[3][0], top(3), C[3][1]]].map(([u, v, w]) => [u, p.z + v, w]), rgb, part)
  }
  cub(-0.2, 0.2, -0.2, 0.2, 0, 0.13, [118, 124, 138], 'plinth')
  if (p.h > 0.16) {
    const hh = p.h, j = () => hh - 0.05 - 0.2 * R(faces.length)          // (its top broken off aslant)
    cub(-0.11, 0.11, -0.11, 0.11, 0.13, [j(), hh, j(), hh - 0.12], [130, 136, 150], 'shaft')
  }
  if (R(9) < 0.4) cub(0.26, 0.38, 0.05, 0.17, 0, 0.07, [118, 124, 138], 'chip')
  return (p._F = faces)
}
export function drawStump(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  drawSolids(h, ctx, stumpFaces(p), k, { x: p.x, y: p.y + 0.4, z: p.z + 0.6 }, 1.5)
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
  const ph = (p.n || 0) * 1.7 + p.x * 0.9; let sw = Math.sin(h.t * 0.85 + ph) * 0.7 + Math.sin(h.t * 0.53 + ph * 1.3) * 0.3
  // (p.surf: a long slow swell running in from the sea to the shore -- toward larger y -- every body lifted by it in turn, a
  // little each side of it for its own; so the whole sea breathes in one ripple)
  let lift = 0.05, dyS = 0
  if (p.surf) { const wv = Math.sin(h.t * 0.62 - p.y * 0.42 + (p.x - 12.5) * 0.05); sw = 0.8 * wv + 0.2 * sw; lift = p.surf; dyS = wv * 0.10 }
  const bob = h._P(p.x + Math.sin(h.t * 0.31 + ph) * 0.06, p.y + Math.cos(h.t * 0.27 + ph) * 0.04 + dyS, p.z + sw * lift) || at
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
const VOID_STONE = -6        // a stone's face beside void goes down this far (then the dark takes it)
function buildStones(h, p, A) {
  const co = courses(A), TPx = h.base.width / h.W, raised = new Map()
  for (const c of p.cells) raised.set(c.n + ',' + c.j, c.z)
  // how high the ground is at a point: a raised (or lowered) stone's top, else the floor there (its tile's height: a stair
  // of stones can stand on a floor laid lower down)
  // (p.edge: the ring offset past which there is nothing -- the hall's own curved brink: a point beyond it is void whatever the tiles say)
  const outside = (x, y) => p.edge != null && Math.hypot((x - A.cx) / (A.rx + p.edge), (y - A.cy) / (A.ry + p.edge)) >= 1
  const ground = (x, y) => {
    const i = Math.floor(y) * h.W + Math.floor(x)
    if (i < 0 || i >= h.k.length) return outside(x, y) ? VOID_STONE : 0
    if (h.k[i] === 0) return h.z[i]                                              // floor: a jetty out past the brink goes on at its height
    if (h.k[i] === 3) return h.span.get(i)?.hid && !outside(x, y) ? 0 : VOID_STONE
    return outside(x, y) ? VOID_STONE : 0
  }
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
// the edge of the hall, where it drops into the dark: a cornice (the edge course standing out a little, its front a band of
// stone) and under it a corbel table, short blocks set close round the tower, every third carved as a head, as the old
// churches carry their eaves. Along one face of an edge stone; corbels at fixed places round the ring, so they run true.
function cornice(h, ctx, p, A, F, z, r, lw) {
  const e = p.edge, ax = A.rx + e, ay = A.ry + e, D = 0.15, Hc = 0.14, Hk = 0.34
  const nrm = (x, y) => { const gx = (x - A.cx) / (ax * ax), gy = (y - A.cy) / (ay * ay), l = Math.hypot(gx, gy) || 1; return [gx / l, gy / l] }
  const T = F.q.slice(0, F.q.length >> 1)
  const L = h.lightAt(F.mx + F.nx * 0.4, F.my + F.ny * 0.4, z - 0.1, -1), base = F.rgb || [96, 98, 104]
  const col = (k) => h._rgb(L.map(v => clamp01(v * 1.05 * k)), base)
  const quad = (q, style) => { const S = q.map(P => h._P(P.x, P.y, P.z)); if (S.some(s => !s)) return; ctx.beginPath(); S.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.closePath(); ctx.fillStyle = style; ctx.fill() }
  for (let i = 0; i + 1 < T.length; i++) {
    const a = T[i], b = T[i + 1]; if (Math.floor((a.y + b.y) / 2) !== r) continue
    const na = nrm(a.x, a.y), nb = nrm(b.x, b.y), ao = { x: a.x + na[0] * D, y: a.y + na[1] * D }, bo = { x: b.x + nb[0] * D, y: b.y + nb[1] * D }
    quad([{ ...a, z }, { ...b, z }, { ...bo, z }, { ...ao, z }], col(1.12))                                       // its top
    quad([{ ...ao, z }, { ...bo, z }, { ...bo, z: z - Hc }, { ...ao, z: z - Hc }], col(0.86))                     // its front
    const s0 = h._P(ao.x, ao.y, z), s1 = h._P(bo.x, bo.y, z), u0 = h._P(ao.x, ao.y, z - Hc), u1 = h._P(bo.x, bo.y, z - Hc)
    if (s0 && s1) { ctx.strokeStyle = 'rgba(235,240,250,0.22)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke() }
    if (u0 && u1) { ctx.strokeStyle = 'rgba(4,5,8,0.7)'; ctx.lineWidth = lw * 1.6; ctx.beginPath(); ctx.moveTo(u0.x, u0.y); ctx.lineTo(u1.x, u1.y); ctx.stroke() }
    // the corbels under it, standing out of the shadow the cornice casts
    quad([{ ...a, z: z - Hc }, { ...b, z: z - Hc }, { ...b, z: z - Hc - Hk - 0.06 }, { ...a, z: z - Hc - Hk - 0.06 }], 'rgba(4,5,8,0.62)')
    const per = 2 * Math.PI * Math.sqrt((ax * ax + ay * ay) / 2), Nc = Math.round(per / 0.8)
    const th = (q) => Math.atan2((q.y - A.cy) / ay, (q.x - A.cx) / ax)
    let t0 = th(a), d = th(b) - t0; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI
    const lo = Math.min(t0, t0 + d), hi = Math.max(t0, t0 + d)
    for (let k = Math.ceil(lo / (2 * Math.PI) * Nc); k / Nc * 2 * Math.PI < hi; k++) {
      const t = k / Nc * 2 * Math.PI, C = { x: A.cx + Math.cos(t) * ax, y: A.cy + Math.sin(t) * ay }, n = nrm(C.x, C.y), tx = -n[1], ty = n[0], w = 0.1
      const f0 = { x: C.x + n[0] * D - tx * w, y: C.y + n[1] * D - ty * w }, f1 = { x: C.x + n[0] * D + tx * w, y: C.y + n[1] * D + ty * w }
      const zt = z - Hc, zb = zt - Hk
      quad([{ ...f0, z: zt }, { ...f1, z: zt }, { ...f1, z: zb + 0.08 }, { ...f0, z: zb + 0.08 }], col(1.0))
      quad([{ ...f0, z: zb + 0.08 }, { ...f1, z: zb + 0.08 }, { x: (f1.x + C.x) / 2, y: (f1.y + C.y) / 2, z: zb }, { x: (f0.x + C.x) / 2, y: (f0.y + C.y) / 2, z: zb }], col(0.62))
      const kk = ((k % Nc) + Nc) % Nc
      if (kk % 3 === 0) {                                                                                      // a head
        const c0 = h._P(C.x + n[0] * (D + 0.01), C.y + n[1] * (D + 0.01), zt - Hk * 0.42), sc = h._k(C.y) * 0.075
        if (c0 && sc > 0.8) {
          ctx.fillStyle = col(1.15); ctx.beginPath(); ctx.ellipse(c0.x, c0.y, sc * 0.8, sc, 0, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = 'rgba(12,12,16,0.8)'
          for (const ex of [-1, 1]) ctx.fillRect(c0.x + ex * sc * 0.33 - sc * 0.14, c0.y - sc * 0.16, sc * 0.28, Math.max(1, sc * 0.1))
          ctx.fillRect(c0.x - sc * 0.18, c0.y + sc * 0.42, sc * 0.36, Math.max(1, sc * 0.08))
        }
      }
    }
  }
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
      const vf = F.zl <= VOID_STONE + 0.01, zm = vf ? z - 0.4 : (z + F.zl) / 2, L = h.lightAt(F.mx + F.nx * 0.15, F.my + F.ny * 0.15, zm, -1)
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
      if (vf) {
        // the dark: the light gives out a little below the lip and is black by four and a half tiles down (hewnRock's ABYSS)
        let ya = Infinity, yb = -Infinity; for (const P of q) { const S = h._P(P.x, P.y, P.z); if (S) { ya = Math.min(ya, S.y); yb = Math.max(yb, S.y) } }
        const g = ctx.createLinearGradient(0, h._Y(r + 0.5, z - 1.2), 0, h._Y(r + 0.5, z - 4.5))
        g.addColorStop(0, '#fff'); g.addColorStop(0.55, '#3a3a3a'); g.addColorStop(1, '#000')
        ctx.save(); ctx.beginPath(); worldPath(h, ctx, q); ctx.clip(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g; ctx.fillRect(0, ya - 2, h.cam.sw, yb - ya + 4); ctx.restore()
        // and the stone dripping from the lip: tapering strands, catching the light (drawDrips, along the arc)
        const T = F.q.slice(0, F.q.length >> 1)
        for (let i = 0; i + 1 < T.length; i++) {
          const a = T[i], b = T[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.round(len * 7))
          if (len < 1e-6) continue
          const tx = (b.x - a.x) / len, ty = (b.y - a.y) / len
          for (let m = 0; m < n; m++) {
            const hh = (Math.imul(Math.floor((a.x + b.x) * 211) + 977 * Math.floor((a.y + b.y) * 157) + m * 31, 2654435761) >>> 0)
            const u = (m + 0.2 + ((hh & 255) / 255) * 0.6) / n, X = a.x + (b.x - a.x) * u + F.nx * 0.01, Y = a.y + (b.y - a.y) * u + F.ny * 0.01
            if (Math.floor(Y) !== r) continue
            const Ld = h.lightAt(X + F.nx * 0.15, Y + F.ny * 0.15, z - 0.3, -1)
            if (Math.max(Ld[0], Ld[1], Ld[2]) < 0.02) continue
            const dl = 0.3 + ((hh >> 8) & 255) / 255 * 1.6, wd = 0.05 + ((hh >> 16) & 15) / 15 * 0.07
            const A1 = h._P(X - tx * wd, Y - ty * wd, z), B1 = h._P(X + tx * wd, Y + ty * wd, z), C1 = h._P(X, Y, z - dl)
            if (!A1 || !B1 || !C1) continue
            const gd = ctx.createLinearGradient(0, A1.y, 0, C1.y)
            gd.addColorStop(0, `rgba(${110 * Ld[0] | 0},${105 * Ld[1] | 0},${100 * Ld[2] | 0},1)`); gd.addColorStop(1, `rgba(${40 * Ld[0] | 0},${38 * Ld[1] | 0},${36 * Ld[2] | 0},0)`)
            ctx.fillStyle = gd; ctx.beginPath(); ctx.moveTo(A1.x, A1.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(C1.x, C1.y); ctx.closePath(); ctx.fill()
          }
        }
      }
      if (vf && p.edge != null) cornice(h, ctx, p, A, F, z, r, lw)
      ctx.lineJoin = 'round'
      if (c.solid) continue                          // (a step is one stone, no courses in it)
      ctx.strokeStyle = 'rgba(8,10,16,0.5)'; ctx.lineWidth = lw
      for (let zz = z - TOP_STONE; zz > Math.max(F.zl, z - 4.5) + 0.05; zz -= TOP_STONE) {          // a course joint at every third of a tile
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
// (the picture is the same every time the map is entered: kept, by the map's floorArt, after the first painting)
const ART_CACHE = new WeakMap()
export function paintFloorArt(h, b, TP) {
  const A = h.floorArt, { cx, cy, rx, ry, g0 } = A, [rx0, ry0, rx1, ry1] = A.rect
  const kept = ART_CACHE.get(A)
  if (kept && kept.TP === TP && kept.W === h.W && kept.H === h.H) { b.drawImage(kept.cv, rx0 * TP, ry0 * TP); return }
  const { E, info } = courses(A)                                     // (floorStones's: with A.spokes, every course has a joint on each spoke)
  // the water, cut in the joints: a runnel down each spoke (A.runs: { t, g0, g1 } -- the spoke's angle, and how far out it
  // runs), one round the joint at A.ringQ, and the drain courses along the jetties (A.drains: axis segments); a basin where
  // a spoke's runnel meets its drain. Each pixel asks: how far am I from the water's line? (d < RW: the bed; then the cut)
  const RW = 0.1, RC = 0.135
  const runs = (A.runs || []).map(R => ({ ...R, c: Math.cos(R.t), s: Math.sin(R.t), X0: cx + rx * Math.cos(R.t), Y0: cy + ry * Math.sin(R.t) }))
  const drains = (A.drains || []).map(([ax, ay, bx, by]) => { const L = Math.hypot(bx - ax, by - ay); return { ax, ay, ux: (bx - ax) / L, uy: (by - ay) / L, L } })
  const WO = { d: 0, side: 1, kind: 0, along: 0 }                         // (one answer, reused: no garbage per pixel)
  const water = (wx, wy, q) => {                                       // the distance to the nearest water line (Infinity: none near), and which side
    let best = Infinity, side = 1, kind = 0, along = 0
    for (const R of runs) { const px = wx - R.X0, py = wy - R.Y0, g = px * R.c + py * R.s, d = -px * R.s + py * R.c; if (g >= R.g0 && g <= R.g1 && Math.abs(d) < best) { best = Math.abs(d); side = Math.sign(d) || 1; kind = 1 } }
    if (A.ringQ != null && Math.abs(q - A.ringQ) < best) { best = Math.abs(q - A.ringQ); side = Math.sign(q - A.ringQ) || 1; kind = 1 }
    for (const D of drains) { const px = wx - D.ax, py = wy - D.ay, a = px * D.ux + py * D.uy, d = -px * D.uy + py * D.ux; if (a >= -0.05 && a <= D.L && Math.abs(d) < 0.34 && Math.abs(d) < best + 0.34) { if (Math.abs(d) <= best) { best = Math.abs(d); side = Math.sign(d) || 1; kind = 2; along = a } } }
    for (const B of A.basins || []) { const d = Math.hypot(wx - B[0], wy - B[1]) - 0.2; if (d < best) { best = Math.max(0, d); side = 1; kind = 3 } }
    WO.d = best; WO.side = side; WO.kind = kind; WO.along = along; return WO
  }
  // the dais's own steps are courses of the same stone, going on inward (A.treads: where each begins, out from the water)
  const { NEGE, negInfo } = negCourses(A)
  // 1. the stone, pixel by pixel
  const PW = (rx1 - rx0) * TP, PH = (ry1 - ry0) * TP, tmp = document.createElement('canvas'); tmp.width = PW; tmp.height = PH
  const tc = tmp.getContext('2d'), img = tc.createImageData(PW, PH), d = img.data
  // (speed: what is the same over a whole tile is asked once a tile, into typed tables, not once a pixel)
  const NT = h.W * h.H, okT = new Uint8Array(NT)
  for (let i = 0; i < NT; i++) { const s = h.span.get(i); okT[i] = ((s && s.walk === 'deck') || h.k[i] === 0) ? 1 : 0 }
  const ok = (c, r) => c >= 0 && r >= 0 && c < h.W && r < h.H && okT[r * h.W + c] === 1
  const edge = new Uint8Array(NT)
  const courtT = new Int8Array(NT).fill(-1)                                // the sunk court (the sea-door's): tiles of whole slabs, by step
  for (const [x, y, k] of A.court?.tiles || []) if (x >= 0 && y >= 0 && x < h.W && y < h.H) courtT[y * h.W + x] = k
  for (let r = 0; r < h.H; r++) for (let c = 0; c < h.W; c++) if (ok(c, r) && !(A.nokerb || []).some(([a0, b0, a1, b1]) => c >= a0 && c <= a1 && r >= b0 && r <= b1)) { for (let dy2 = -1; dy2 <= 1; dy2++) for (let dx2 = -1; dx2 <= 1; dx2++) if (!ok(c + dx2, r + dy2)) edge[r * h.W + c] = 1 }
  for (const [x, y] of A.court?.kerb || []) edge[y * h.W + x] = 1                       // (the hall's brink over the court: a coping of long slabs)
  // (speed: how far out a point is, g, and its angle round, are smooth, and costly -- solved for an ellipse through it,
  // and an atan2 -- so they are worked out on a grid every GS pixels and taken between; so are the slow wobbles in the
  // joints and the damp. What changes from pixel to pixel -- which stone, its edges, the grain -- is still each pixel's own)
  const GS = 4, GW = Math.ceil(PW / GS) + 2, GHh = Math.ceil(PH / GS) + 2
  const GG = new Float32Array(GW * GHh), GT = new Float32Array(GW * GHh), GQJ = new Float32Array(GW * GHh), GTJ = new Float32Array(GW * GHh), GD = new Float32Array(GW * GHh)
  for (let j = 0; j < GHh; j++) for (let i = 0; i < GW; i++) {
    const wx = rx0 + (i * GS + 0.5) / TP, wy = ry0 + (j * GS + 0.5) / TP, dx = wx - cx, dy = wy - cy
    let g = Math.max(g0, (Math.hypot(dx / rx, dy / ry) - 1) * Math.sqrt(rx * ry))
    for (let it = 0; it < 5; it++) { const a = rx + g, c = ry + g, f = dx * dx / (a * a) + dy * dy / (c * c) - 1; g += f / (2 * (dx * dx / (a * a * a) + dy * dy / (c * c * c)) + 1e-9) }
    const k = j * GW + i
    GG[k] = g; GT[k] = Math.atan2(dy / (ry + g), dx / (rx + g))
    GQJ[k] = (vn(wx * 1.7, wy * 1.7, 3) - 0.5) * 0.004; GTJ[k] = (vn(wx * 2.3, wy * 2.3, 4) - 0.5) * 0.002; GD[k] = vn(wx * 0.5, wy * 0.5, 1)
  }
  const TAU2 = Math.PI * 2, PI = Math.PI
  // which tiles to paint (0: none, 1: all, 2: ask each pixel -- a skip rect cuts through it), and which are near water
  const skipR = A.skip || [], paintT = new Uint8Array(NT), wetT = new Uint8Array(NT), anyWater = runs.length || drains.length || A.ringQ != null || (A.basins || []).length
  const segD = (x, y, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L2)); return Math.hypot(x - ax - vx * t, y - ay - vy * t) }
  const NEAR = 0.34 + 0.75                                                  // (the widest water mark, a drain's, and half a tile's diagonal)
  for (let r = Math.max(0, Math.floor(ry0)); r < Math.min(h.H, Math.ceil(ry1)); r++) for (let c = Math.max(0, Math.floor(rx0)); c < Math.min(h.W, Math.ceil(rx1)); c++) {
    const i = r * h.W + c; if (!okT[i]) continue
    let pt = 1
    for (const [a0, b0, a1, b1] of skipR) { if (c >= a0 && c + 1 <= a1 && r >= b0 && r + 1 <= b1) { pt = 0; break } if (c + 1 > a0 && c < a1 && r + 1 > b0 && r < b1) pt = 2 }
    paintT[i] = pt; if (!pt || !anyWater) continue
    const x = c + 0.5, y = r + 0.5
    let near = false
    for (const R of runs) if (segD(x, y, R.X0 + R.c * R.g0, R.Y0 + R.s * R.g0, R.X0 + R.c * R.g1, R.Y0 + R.s * R.g1) < NEAR) { near = true; break }
    if (!near) for (const D of drains) if (segD(x, y, D.ax - D.ux * 0.05, D.ay - D.uy * 0.05, D.ax + D.ux * D.L, D.ay + D.uy * D.L) < NEAR) { near = true; break }
    if (!near) for (const B of A.basins || []) if (Math.hypot(x - B[0], y - B[1]) - 0.2 < NEAR) { near = true; break }
    if (!near && A.ringQ != null) {                                          // (the ring: how far out the tile's middle lies, against the ring's)
      const dx = x - cx, dy = y - cy, gq = (Math.hypot(dx / rx, dy / ry) - 1) * Math.sqrt(rx * ry) - g0
      if (Math.abs(gq - A.ringQ) < NEAR + 0.6) near = true
    }
    wetT[i] = near ? 1 : 0
  }
  for (let py = 0; py < PH; py++) {
    const wy = ry0 + (py + 0.5) / TP, dy = wy - cy, fj = py / GS, j0 = Math.floor(fj), fy = fj - j0, tcy = Math.floor(wy)
    if (tcy < 0 || tcy >= h.H) continue
    const rowT = tcy * h.W
    for (let px = 0; px < PW; px++) {
      const wx = rx0 + (px + 0.5) / TP, tcx = Math.floor(wx)
      if (tcx < 0 || tcx >= h.W) continue
      const ti = rowT + tcx, pt = paintT[ti]
      if (!pt) continue
      if (pt === 2 && skipR.some(([a0, b0, a1, b1]) => wx >= a0 && wx < a1 && wy >= b0 && wy < b1)) continue
      const dx = wx - cx, fi = px / GS, i0 = Math.floor(fi), fx = fi - i0, k00 = j0 * GW + i0, k10 = k00 + 1, k01 = k00 + GW, k11 = k01 + 1
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy
      const g = GG[k00] * w00 + GG[k10] * w10 + GG[k01] * w01 + GG[k11] * w11
      const t0 = GT[k00]; let t1 = GT[k10], t2 = GT[k01], t3 = GT[k11]                       // (the angle, taken across the seam where it goes from -pi to pi)
      if (t1 - t0 > PI) t1 -= TAU2; else if (t1 - t0 < -PI) t1 += TAU2
      if (t2 - t0 > PI) t2 -= TAU2; else if (t2 - t0 < -PI) t2 += TAU2
      if (t3 - t0 > PI) t3 -= TAU2; else if (t3 - t0 < -PI) t3 += TAU2
      let twg = t0 * w00 + t1 * w10 + t2 * w01 + t3 * w11; if (twg > PI) twg -= TAU2; else if (twg <= -PI) twg += TAU2
      const qj = GQJ[k00] * w00 + GQJ[k10] * w10 + GQJ[k01] * w01 + GQJ[k11] * w11, tj = GTJ[k00] * w00 + GTJ[k10] * w10 + GTJ[k01] * w01 + GTJ[k11] * w11
      const dampG = GD[k00] * w00 + GD[k10] * w10 + GD[k01] * w01 + GD[k11] * w11
      const o = (py * PW + px) * 4
      let R, G, B
      const q = g - g0, ck = courtT[ti]
      if (ck >= 0) {                                                  // a step of the court: one whole slab to a tile, its joints the tile's edges
        const fx = wx - tcx, fy = wy - tcy
        const kk = 0.93 + 0.1 * h2(tcx, tcy * 3 + 5) + (h2(px, py) - 0.5) * 0.05 + (vn(wx * 7, wy * 7, 8) - 0.5) * 0.08
        R = 90 * kk; G = 93 * kk; B = 100 * kk
        const de = Math.min(fx, 1 - fx, fy, 1 - fy)
        if (de < 0.028) { R = 22; G = 24; B = 30 }
        else if (de < 0.09) { const lt = (fx < 0.09 || fy < 0.09) ? 1.28 : 0.74; R *= lt; G *= lt; B *= lt }
        if (ck === 0) {                                                        // the landing: an octagon inlaid in pale stone, a dark one inside it
          const od = Math.max(Math.abs(wx - A.court.cx), wy - A.court.fy, (Math.abs(wx - A.court.cx) + wy - A.court.fy) / Math.SQRT2)
          if (Math.abs(od - 1.15) < 0.035) { R = 168; G = 170; B = 176 } else if (Math.abs(od - 0.55) < 0.035) { R = 30; G = 32; B = 38 }
        }
      }
      else if (q < NEGE[0]) { R = 62; G = 66; B = 76 }
      else if (q >= 0 && edge[ti]) {                              // the kerb: a course of long dark slabs laid along the wall
        const bx = wx + (Math.floor(wy * 2) % 2) * 0.5, fx = bx - Math.floor(bx), fy = wy * 2 - Math.floor(wy * 2), sj = h2(Math.floor(bx), Math.floor(wy * 2) + 91)
        const k = 0.8 + 0.3 * sj + (h2(px, py) - 0.5) * 0.06 + (vn(wx * 5, wy * 5, 6) - 0.5) * 0.16
        R = 66 * k; G = 70 * k; B = 82 * k
        const de = Math.min(fx, 1 - fx, fy / 2, (1 - fy) / 2)
        if (de < 0.03) { R = 20; G = 22; B = 28 } else if (fy < 0.14 || fx < 0.07) { R *= 1.22; G *= 1.22; B *= 1.25 } else if (fy > 0.9) { R *= 0.8; G *= 0.8; B *= 0.8 }
      } else {
        // the joints true, as if cut by a mason
        const qs = q + qj, tw = twg + tj
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
        const SU = n < 0 ? null : stoneU(I, tw)
        const u = SU ? SU.j + SU.fu : ((tw + Math.PI) / (Math.PI * 2) + I.off) * I.m, j = Math.floor(u), fu = u - j, jj = ((j % I.m) + I.m) % I.m, sd = n * 131 + jj, ilen = SU ? SU.len : I.len
        const dr = Math.min(v, 1 - v) * I.w, dt = Math.min(fu, 1 - fu) * ilen, de = Math.min(dr, dt)
        // the carving is in bands, as the old churches keep it: spirals near the well (the oldest work); billets on the well's
        // rim; and out at the edge the mouldings of the door's own order: a course of billets, the edge course cut in chevrons
        const band = n === 1 ? 1 : (n === -negInfo.length || n === (A.billet ?? 9)) ? 3 : n === (A.chevron ?? 10) ? 4 : 0
        const damp = dampG, grain = (h2(px, py) - 0.5) * 0.05, pat = vn(wx * 7, wy * 7, 2) - 0.5
        let k = (0.94 + 0.1 * h2(sd, n)) * (n % 3 === 0 ? 1.1 : 1) * ((n + jj) % 2 ? 0.965 : 1.02) * (1 + pat * 0.1 + grain)
        if (damp > 0.6) k *= 0.9
        if (q < 1.8) k *= 0.88 + 0.12 * Math.max(0, q) / 1.8                                              // wetter at the dais's foot
        R = 94 * k; G = 96 * k; B = 102 * k
        const hs = h2(sd, 9)
        if (hs < 0.04) { R *= 1.05; G *= 0.98; B *= 0.92 } else if (hs > 0.97) { R *= 0.94; G *= 0.99; B *= 1.06 }      // a warmer stone now and then, a bluer
        if (band) { R = R * 1.12 + 8; G = G * 1.1 + 6; B = B * 1.05 + 4 }
        // a stone's edges: a light edge toward the light (north-west), a dark one away, a dark seam between
        const rr = Math.hypot(dx / ((rx + g) ** 2), dy / ((ry + g) ** 2)) || 1, nx = dx / ((rx + g) ** 2) / rr, ny = dy / ((ry + g) ** 2) / rr
        const rad = v < 0.5 ? -1 : 1, tan = fu < 0.5 ? -1 : 1
        const lit = dr < dt ? (nx * rad * -0.55 + ny * rad * -0.83) : (-ny * tan * -0.55 + nx * tan * -0.83)
        if (de < 0.016) { R = 24; G = 26; B = 32 }                                             // (the joint: a hair's width)
        else {
          if (de < 0.17) { const ao = 1 - 0.16 * (1 - de / 0.17); R *= ao; G *= ao; B *= ao }
          if (de < 0.05) { const e = lit > 0.25 ? 1.3 : lit < -0.25 ? 0.76 : 1.04; R *= e; G *= e; B *= e }
          const cu = Math.min(fu, 1 - fu) * ilen, cv = Math.min(v, 1 - v) * I.w                    // a chipped corner
          if (cu + cv < 0.14 && h2(sd, 21) < 0.04) { R *= 0.38; G *= 0.38; B *= 0.42 }
          if (h2(sd, 33) < 0.025 && Math.abs(vn(wx * 4.6 + sd, wy * 4.6, 5) - 0.5) < 0.008) { R = 22; G = 24; B = 30 }      // a crack
          const sp = h2(px * 3 + 1, py * 5 + 7); if (sp < 0.008) { R *= 1.18; G *= 1.18; B *= 1.2 } else if (sp < 0.05) { R *= 0.86; G *= 0.86; B *= 0.88 }
          const lx = (fu - 0.5) * ilen, ly = (v - 0.5) * I.w
          if (band === 1) {                                                                           // a spiral on each stone
            const r2 = Math.hypot(lx, ly), th = Math.atan2(ly, lx), ss = r2 / 0.085 - th / (Math.PI * 2) + h2(sd, 3)
            if (r2 < 0.38 * I.w && ss - Math.floor(ss) < 0.3) { R = 30; G = 32; B = 40 } else if (r2 < 0.4 * I.w && ss - Math.floor(ss) < 0.4) { R *= 1.25; G *= 1.25; B *= 1.3 }
          } else if (band === 3) {                                                                    // billets: two rows of short blocks, staggered, standing proud
            const row = v < 0.5 ? 0 : 1, vv = row ? (v - 0.5) * 2 : v * 2, bu = u * 5 + row * 0.5, fb = bu - Math.floor(bu)
            if (fb > 0.1 && fb < 0.6 && vv > 0.2 && vv < 0.8) {
              const e = (fb < 0.15 || vv < 0.27) ? 1.42 : (fb > 0.55 || vv > 0.73) ? 0.62 : 1.16; R *= e; G *= e; B *= e
            } else { R *= 0.7; G *= 0.7; B *= 0.74 }
          } else if (band === 4) {                                                                    // chevrons: one zigzag right round, cut between two fillets
            const sv = u * 2, tri = Math.abs(sv - Math.floor(sv) - 0.5) * 2, vt = 0.24 + 0.52 * tri, dv = (v - vt) * I.w
            if (Math.abs(dv) < 0.034) { R = 30; G = 32; B = 40 } else if (dv > 0 && dv < 0.07) { R *= 1.34; G *= 1.34; B *= 1.36 }
            else if (Math.abs(v - 0.1) * I.w < 0.016 || Math.abs(v - 0.9) * I.w < 0.016) { R = 34; G = 36; B = 44 }
          }
        }
      }
      if (q >= 0 && wetT[ti]) {                                                // the water, in its joint or its drain
        const W = water(wx, wy, q)
        if (W.kind === 2 && W.d < 0.34) {                                      // a drain course: narrow slabs along the jetty, a channel down their middle
          const sj = Math.floor(W.along / 0.85), kk = 0.98 + 0.08 * h2(sj, 77) + (h2(px, py) - 0.5) * 0.05
          R = 98 * kk; G = 100 * kk; B = 106 * kk
          if (W.d > 0.31 || (W.along % 0.85) < 0.03) { R = 24; G = 26; B = 32 }
          else if (W.d > 0.27) { const e = W.side < 0 ? 1.25 : 0.8; R *= e; G *= e; B *= e }
        }
        if (W.d < RC) {
          if (W.d >= RW) { R = 26; G = 28; B = 34 }                                                     // the cut edge
          else {
            const kb = 0.92 + (vn(wx * 9, wy * 9, 12) - 0.5) * 0.12; R = 60 * kb; G = 66 * kb; B = 78 * kb      // the wet bed, seen through clear water
            if (W.side < 0 && W.d > 0.035 && W.d < 0.058) { R = 150; G = 160; B = 176 }                   // the sheen along one side
          }
        }
      }
      d[o] = R; d[o + 1] = G; d[o + 2] = B; d[o + 3] = 255
    }
  }
  tc.putImageData(img, 0, 0)
  const bOut = b; b = tc; tc.setTransform(1, 0, 0, 1, -rx0 * TP, -ry0 * TP)      // (the strokes below go on the same picture, so it can be kept whole)
  // 2. any water left as a stroked line (A.channels, those not laid in the joints)
  b.save(); b.scale(TP, TP); b.lineJoin = 'round'; b.lineCap = 'round'
  const paths = [...(A.channels || [])]
  const stroke = (pts, w, col) => { b.beginPath(); pts.forEach(([x, y], i) => (i ? b.lineTo(x, y) : b.moveTo(x, y))); b.strokeStyle = col; b.lineWidth = w; b.stroke() }
  // runnels: cut flush in the stone, the water in them as clear as the well's -- the wet stone of the bed, a cut edge, and a
  // thin sheen along one side (moving glints are the flow prop's)
  for (const P of paths) {
    const W = P.w ?? 1, rs = resample(P.pts, 0.04)
    stroke(P.pts, 0.27 * W, 'rgb(26,28,34)'); stroke(P.pts, 0.21 * W, 'rgb(62,68,80)'); stroke(P.pts, 0.1 * W, 'rgb(56,63,77)')
    const sh = rs.map(q => [q.x + q.nx * 0.055 * W, q.y + q.ny * 0.055 * W]); stroke(sh, 0.022 * W, 'rgba(200,214,232,0.32)')
    const lp = rs.map(q => [q.x - q.nx * 0.125 * W, q.y - q.ny * 0.125 * W]); stroke(lp, 0.02 * W, 'rgba(210,218,232,0.16)')
  }
  // 3. mineral veins in the stone, and lichen, dull in the joints
  const rnd = seeded(77)
  b.lineCap = 'round'
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, gg = g0 + 1 + rnd() * 14; let x = cx + Math.cos(a) * (rx + gg), y = cy + Math.sin(a) * (ry + gg), an = rnd() * 6.28
    if (!ok(Math.floor(x), Math.floor(y))) continue
    b.beginPath(); b.moveTo(x, y)
    for (let s = 0; s < 7; s++) { an += (rnd() - 0.5) * 1.1; x += Math.cos(an) * 0.18; y += Math.sin(an) * 0.18; b.lineTo(x, y) }
    b.strokeStyle = `rgba(190,200,220,${(0.1 + rnd() * 0.14).toFixed(2)})`; b.lineWidth = 0.025 + rnd() * 0.02; b.stroke()
  }
  const blob = (x, y, r) => {                                          // lichen: dull, a pale blue-grey near the stone's own, filling the joints
    b.fillStyle = `rgba(${126 + (rnd() * 10 | 0)},${134 + (rnd() * 8 | 0)},${146 + (rnd() * 8 | 0)},0.5)`; b.beginPath(); b.arc(x, y, r, 0, 6.3); b.fill()
  }
  const lichen = (x, y) => { if (!ok(Math.floor(x), Math.floor(y))) return; const n = 3 + Math.floor(rnd() * 6); for (let i = 0; i < n; i++) blob(x + (rnd() - 0.5) * 0.28, y + (rnd() - 0.5) * 0.2, 0.025 + rnd() * 0.035) }
  for (let i = 0; i < 520; i++) {                                     // along the joints between the courses
    const bd = 1 + Math.floor(rnd() * 14), a = rnd() * Math.PI * 2, gg = g0 + E[Math.min(bd, E.length - 1)] + (rnd() - 0.5) * 0.06
    lichen(cx + Math.cos(a) * (rx + gg), cy + Math.sin(a) * (ry + gg))
  }
  for (const P of paths) {                                            // a little more where the water is
    const rs = resample(P.pts, 0.6)
    for (const p of rs) if (rnd() < 0.35) { const side = rnd() < 0.5 ? -1 : 1, o = 0.17 + rnd() * 0.06; lichen(p.x + p.nx * o * side, p.y + p.ny * o * side) }
  }
  b.restore()
  bOut.drawImage(tmp, rx0 * TP, ry0 * TP)
  ART_CACHE.set(A, { cv: tmp, TP, W: h.W, H: h.H })
}

// ═════════ Donn's threshold: a half-round apron of steps, and a round-arched door ═══════════════════════════
// { type: 'apron', x, y (the face it stands out from, looking south), z0 (the landing), z1 (the step round it), r0, r1,
//   chan: [[x, y]...] (a water channel on it, optional) }: a half-disc landing before the door, a step down round it, and
// below that the sheer face into the dark. Drawn a row's slice at a time, as the stones are; walked by hidden decks.
export function apronRows(p) { return [Math.floor(p.y), Math.floor(p.y + p.r1 + 0.05)] }
const STONE_A = [104, 104, 108]
export function drawApron(h, ctx, p) {
  const r = p.row, band = (poly, e = 0.04) => clipBand(poly, r - e, r + 1 + e), N = 48
  const arc = (rad, z, t0 = 0, t1 = Math.PI) => Array.from({ length: N + 1 }, (_, i) => { const t = t0 + (t1 - t0) * i / N; return { x: p.x + Math.cos(t) * rad, y: p.y + Math.sin(t) * rad, z } })
  const lw = Math.max(1, h._k(r + 0.5) * 0.014), cam = h.cam
  const lit = (x, y, z, k = 1, base = p.stone || STONE_A) => { const L = h.lightAt(x, y, z, -1); return h._rgb(L.map(v => clamp01(v * 0.92 * k)), base) }
  const fill = (poly, style) => { const q = band(poly); if (q.length < 3) return false; ctx.beginPath(); if (!worldPath(h, ctx, q)) return false; ctx.fillStyle = style; ctx.fill(); return true }
  const line = (pts, style, w = lw) => { ctx.beginPath(); let on = false; for (const q of pts) { if (q.y < r - 0.02 || q.y > r + 1.02) { on = false; continue } const s = h._P(q.x, q.y, q.z); if (!s) { on = false; continue } on ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); on = true } ctx.strokeStyle = style; ctx.lineWidth = w; ctx.stroke() }
  const seg = (a, b, style, w = lw) => { const m = (a.y + b.y) / 2; if (m < r || m > r + 1) return; const s = h._P(a.x, a.y, a.z), t = h._P(b.x, b.y, b.z); if (!s || !t) return; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.strokeStyle = style; ctx.lineWidth = w; ctx.stroke() }
  const pc = (rad, t, z) => ({ x: p.x + Math.cos(t) * rad, y: p.y + Math.sin(t) * rad, z })
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // under it all, a chalice: a flare of corbelled courses under the step, narrowing to a slender stem that goes down into the
  // dark. Drawn first, so the fan and its step go over it; the lowest course first, so the wider ones above hide what folds under
  {
    const RS = p.stem ?? 0.38, DF = p.flare ?? 3.0, rf = (d) => d >= DF ? RS : RS + (p.r1 - RS) * Math.pow(1 - d / DF, 2)
    const arcS = (rad, z, t0, t1, m = 5) => Array.from({ length: m + 1 }, (_, i) => { const t = t0 + (t1 - t0) * i / m; return { x: p.x + Math.cos(t) * rad, y: p.y + Math.sin(t) * rad, z } })
    const CH = 1 / 3, NC = 21
    for (let c = NC - 1; c >= 0; c--) {
      const da = c * CH, db = (c + 1) * CH, ra = rf(da), rb = rf(db), za = p.z1 - da, zb = p.z1 - db
      const nsc = Math.max(4, Math.round(Math.PI * ra / 0.62)), dim = Math.max(0.6, 1 - da / 9) * Math.min(1, (NC - c) / 8)
      for (let i = 0; i < nsc; i++) {
        const t0 = Math.PI * i / nsc, t1 = Math.PI * (i + 1) / nsc, tm = (t0 + t1) / 2, qb = band([...arcS(ra, za, t0, t1), ...arcS(rb, zb, t0, t1).reverse()])
        if (qb.length < 3) continue
        const hv = hash(c * 977 + i * 131 + 3) & 15, mf = pc(ra + 0.9, Math.PI / 2 + (tm - Math.PI / 2) * 0.35, za - 0.2)
        ctx.beginPath(); if (!worldPath(h, ctx, qb)) continue
        ctx.fillStyle = lit(mf.x, mf.y, mf.z, 1.35 * dim * (0.95 + hv / 150)); ctx.fill()
        seg(pc(ra, t0, za), pc(rb, t0, zb), `rgba(8,10,16,${(0.5 * dim + 0.1).toFixed(2)})`)
        line(arcS(rb, zb, t0, t1), `rgba(8,10,16,${(0.5 * dim + 0.1).toFixed(2)})`)
      }
    }
    const ns = Math.max(6, Math.round(Math.PI * p.r1 / 0.62))
    for (let i = 0; i < ns; i++) {                                    // stone dripping from the lip
      const t0 = Math.PI * i / ns, t1 = Math.PI * (i + 1) / ns, tm = (t0 + t1) / 2, m = pc(p.r1 + 0.12, tm, p.z1 - 0.4), Ld = h.lightAt(m.x, m.y, p.z1 - 0.3, -1)
      if (Math.max(Ld[0], Ld[1], Ld[2]) > 0.02) for (let s = 0; s < 2; s++) {
        const hh = hash(i * 131 + s * 977 + 5), u = t0 + (t1 - t0) * (s + 0.2 + ((hh & 255) / 255) * 0.6) / 2, X = p.x + Math.cos(u) * (p.r1 - 0.01), Y = p.y + Math.sin(u) * (p.r1 - 0.01)
        if (Math.floor(Y) !== r || (p.dripT0 && u < p.dripT0)) continue
        const dl = 0.12 + ((hh >> 8) & 255) / 255 * 0.22, wd = 0.04 + ((hh >> 16) & 15) / 15 * 0.05, tx = -Math.sin(u), ty = Math.cos(u)
        const A1 = h._P(X - tx * wd, Y - ty * wd, p.z1), B1 = h._P(X + tx * wd, Y + ty * wd, p.z1), C1 = h._P(X, Y, p.z1 - dl)
        if (!A1 || !B1 || !C1) continue
        const gd = ctx.createLinearGradient(0, A1.y, 0, C1.y)
        gd.addColorStop(0, `rgba(${110 * Ld[0] | 0},${105 * Ld[1] | 0},${100 * Ld[2] | 0},1)`); gd.addColorStop(1, `rgba(${40 * Ld[0] | 0},${38 * Ld[1] | 0},${36 * Ld[2] | 0},0)`)
        ctx.fillStyle = gd; ctx.beginPath(); ctx.moveTo(A1.x, A1.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(C1.x, C1.y); ctx.closePath(); ctx.fill()
      }
    }
  }
  // the landing: a half-disc of fan-laid slabs, a border cut round it
  fill([...arc(p.r0, p.z0), { x: p.x - p.r0, y: p.y, z: p.z0 }], lit(p.x, p.y + p.r0 * 0.5, p.z0 + 0.1, 1.02))
  const nf = 5
  for (let i = 1; i < nf; i++) { const t = Math.PI * i / nf; seg(pc(0.32, t, p.z0), pc(p.r0 - 0.16, t, p.z0), 'rgba(10,12,18,0.7)') }
  line(arc(p.r0 - 0.16, p.z0), 'rgba(10,12,18,0.7)'); line(arc(p.r0 - 0.2, p.z0), 'rgba(205,212,228,0.12)')
  line(arc(0.32, p.z0), 'rgba(10,12,18,0.7)')
  // the riser up to it, its joints in line with the step's
  const ns = Math.max(6, Math.round(Math.PI * p.r1 / 0.62))
  for (let i = 0; i < ns; i++) {
    const t0 = Math.PI * i / ns, t1 = Math.PI * (i + 1) / ns, tm = (t0 + t1) / 2
    const q = [...arc(p.r0, p.z0, t0, t1).slice(0, 1), pc(p.r0, t1, p.z0), pc(p.r0, t1, p.z1), pc(p.r0, t0, p.z1)]
    const m = pc(p.r0 + 0.1, tm, (p.z0 + p.z1) / 2), f = 0.82 + 0.1 * Math.sin(tm)
    if (fill(q, lit(m.x, m.y, m.z, f * 0.86))) seg(pc(p.r0, t0, p.z0), pc(p.r0, t0, p.z1), 'rgba(10,12,18,0.55)')
  }
  // the step: voussoir-like stones round it, each a little different
  for (let i = 0; i < ns; i++) {
    const t0 = Math.PI * i / ns, t1 = Math.PI * (i + 1) / ns, tm = (t0 + t1) / 2, hv = hash(i * 7919 + 13) & 255
    const q = [...arc(p.r0, p.z1, t0, t1), ...arc(p.r1, p.z1, t0, t1).reverse()]
    const m = pc((p.r0 + p.r1) / 2, tm, p.z1)
    fill(q, lit(m.x, m.y, m.z + 0.1, 0.94 + (hv / 255) * 0.1))
    seg(pc(p.r0, t0, p.z1), pc(p.r1, t0, p.z1), 'rgba(10,12,18,0.7)')
  }
  line(arc(p.r1 - 0.04, p.z1), 'rgba(215,222,238,0.18)')               // the worn lip
  line(arc(p.r0, p.z0), 'rgba(215,222,238,0.16)')
  // the inlay: a cut ring on the landing with a chain of lozenges; round the step a band of ogham between two cut lines; a kerb of
  // long slabs along its lip
  {
    const cut = 'rgba(8,10,16,0.72)', pale = 'rgba(226,212,164,0.42)', ro = p.r0 - 0.46
    line(arc(ro - 0.03, p.z0), cut, lw * 1.8); line(arc(ro, p.z0), pale, lw * 1.1)
    for (let i = 0; i < 12; i++) {
      const t = Math.PI * (i + 0.5) / 12, c = pc(ro - 0.22, t, p.z0), sz = 0.07
      fill([{ x: c.x, y: c.y - sz, z: p.z0 }, { x: c.x + sz, y: c.y, z: p.z0 }, { x: c.x, y: c.y + sz, z: p.z0 }, { x: c.x - sz, y: c.y, z: p.z0 }], pale)
    }
    const ra = p.r0 + 0.2, rb = p.r1 - 0.2, rm = (ra + rb) / 2
    line(arc(ra, p.z1), cut, lw * 1.4); line(arc(rb, p.z1), cut, lw * 1.4); line(arc(rm, p.z1), 'rgba(226,212,164,0.34)', lw)
    for (let i = 0; i < 44; i++) {
      if (i % 6 === 5) continue
      const t = Math.PI * (i + 0.5) / 44, hv = hash(i * 131 + 7) & 7, a = pc(rm, t, p.z1), s = hv & 1 ? 1 : -1
      seg(a, pc(rm + s * 0.17, t, p.z1), 'rgba(226,212,164,0.5)', lw * 1.2)
      if (hv === 5) seg(a, pc(rm - s * 0.17, t, p.z1), 'rgba(226,212,164,0.5)', lw * 1.2)
    }
    line(arc(p.r1 - 0.22, p.z1), cut, lw)
    for (let i = 0; i < ns; i++) { const t = Math.PI * (i + 0.5) / ns; seg(pc(p.r1 - 0.22, t, p.z1), pc(p.r1, t, p.z1), 'rgba(10,12,18,0.6)') }
  }
  // water: a channel cut in the stone, from where the stream comes on to the step, round it and in to the door
  if (p.chan) {
    const zat = (q) => Math.hypot(q[0] - p.x, q[1] - p.y) < p.r0 ? p.z0 : p.z1
    const pts = []
    for (let i = 0; i + 1 < p.chan.length; i++) {                   // (in short steps, so each row's slice has its piece)
      const a = p.chan[i], b = p.chan[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1))
      for (let j = 0; j < n; j++) { const q = [a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]; pts.push({ x: q[0], y: q[1], z: zat(q) + 0.005 }) }
    }
    { const q = p.chan[p.chan.length - 1]; pts.push({ x: q[0], y: q[1], z: zat(q) + 0.005 }) }
    const kk = h._k(r + 0.5), L0 = h.lightAt(p.x, p.y + p.r0, p.z0 + 0.1, -1)
    line(pts, 'rgb(22,24,30)', Math.max(1, kk * 0.17)); line(pts, h._rgb(L0.map(v => clamp01(v * 0.9)), [70, 76, 88]), Math.max(1, kk * 0.12)); line(pts.map(q => ({ ...q, x: q.x + 0.03 })), 'rgba(200,214,232,0.3)', Math.max(1, kk * 0.015))
    for (let i = 0; i + 1 < pts.length; i++) {                        // where it goes over the riser: a little fall
      const a = pts[i], b = pts[i + 1]
      if (a.z !== b.z) { const lo = a.z < b.z ? a : b, hi = a.z < b.z ? b : a; if (Math.floor(hi.y) !== r) continue; const s = h._P(hi.x, hi.y, hi.z), t = h._P(hi.x, hi.y, lo.z); if (s && t) { ctx.strokeStyle = 'rgba(190,204,224,0.28)'; ctx.lineWidth = Math.max(1, h._k(r + 0.5) * 0.08); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke() } }
    }
  }
  ctx.restore()
}

// { type: 'flight', cx, cy, rx, ry (the drum's face, an ellipse), d (the treads' depth out from it), b: [angles, west to east,
//   the treads' ends], z: [each tread's top], zfoot, zcap, zB, rise, y0, y1 }: a stair cut along a curved wall, hugging it, in
// the floor's grey. Each tread you walk is drawn as three shallow steps, eighteen shallow steps in all. Under it one arch, its
// ring cut with chevrons, springing from a slender column at its foot (under the pier the flight comes down as) up to
// the wall under its head; a newel post with a lamp at its head. Drawn a row's slice at a time; walked by hidden decks.
function floorTone(h) {
  if (h._ftone !== undefined) return h._ftone
  h._ftone = null
  try {
    const TPx = h.base.width / h.W, d = h.base.getContext('2d').getImageData(Math.floor(16 * TPx), Math.floor(36 * TPx), Math.floor(12 * TPx), Math.floor(4 * TPx)).data
    let R = 0, Gg = 0, B = 0, n = 0; for (let i = 0; i < d.length; i += 16) { R += d[i]; Gg += d[i + 1]; B += d[i + 2]; n++ }
    if (n) h._ftone = [R / n, Gg / n, B / n].map(v => Math.round(Math.min(150, v * 1.05)))
  } catch (e) { h._ftone = null }
  return h._ftone
}
export function drawFlight(h, ctx, p) {
  const r = p.row, band = (poly, e = 0.04) => clipBand(poly, r - e, r + 1 + e), M = 6, D = p.d, n = p.z.length, NS = 3, RS = 0.5 / NS
  const at = (t, g, z) => ({ x: p.cx + Math.cos(t) * (p.rx + g), y: p.cy + Math.sin(t) * (p.ry + g), z })
  const arc = (ta, tb, g, z) => Array.from({ length: M + 1 }, (_, i) => at(ta + (tb - ta) * i / M, g, z))
  const lw = Math.max(1, h._k(r + 0.5) * 0.014), cam = h.cam, base = floorTone(h) || p.stone || STONE_A
  const lit = (q, k) => { const L = h.lightAt(q.x, q.y, q.z, -1); return h._rgb(L.map(v => clamp01(v * 0.95 * k)), base) }
  const fill = (poly, style) => { const q = band(poly); if (q.length < 3) return false; ctx.beginPath(); if (!worldPath(h, ctx, q)) return false; ctx.fillStyle = style; ctx.fill(); return true }
  const line = (pts, style, w = lw) => { ctx.beginPath(); let on = false; for (const q of pts) { if (q.y < r - 0.02 || q.y > r + 1.02) { on = false; continue } const s = h._P(q.x, q.y, q.z); if (!s) { on = false; continue } on ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); on = true } ctx.strokeStyle = style; ctx.lineWidth = w; ctx.stroke() }
  const tan = (t) => { const x = -Math.sin(t) * p.rx, y = Math.cos(t) * p.ry, l = Math.hypot(x, y); return [x / l, y / l] }   // (toward the west, down the flight)
  const sees = (q, nx, ny) => (cam.col - q.x) * nx + (cam.row - q.y) * ny > 0
  // the arch: its intrados from the column's capital at the foot (u 0) to the wall under the head (u 1), a little rise
  const T0 = p.b[0], T1 = p.b[n], uo = (t) => (T0 - t) / (T0 - T1)
  const zi = (t) => { const u = uo(t); return p.zcap + (p.zB - p.zcap) * u + (p.rise ?? 0.3) * Math.sin(Math.PI * u) }, RT = 0.3
  const arcI = (ta, tb, g, dz = 0, m = M) => Array.from({ length: m + 1 }, (_, i) => { const t = ta + (tb - ta) * i / m; return at(t, g, zi(t) + dz) })
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // the column at the foot: a slender shaft out of the dark, a cushion capital and an abacus; its capital carries the arch's
  // springing and the promontory's corner
  {
    const c = at(T0 + 0.004, D - 0.16, 0), zc = p.zcap
    if (Math.floor(c.y) === r) {
      const P = (dx, z) => h._P(c.x + dx, c.y, z), W2 = 0.13, Lc = h.lightAt(c.x, c.y + 0.4, zc - 0.5, -1)
      const a = P(-W2, zc - 0.34), b = P(W2, zc - 0.34), e = P(W2, zc - 6), f = P(-W2, zc - 6)
      if (a && b && e && f) {
        const gr = ctx.createLinearGradient(a.x, 0, b.x, 0); gr.addColorStop(0, h._rgb(Lc.map(v => clamp01(v * 1.05)), base)); gr.addColorStop(0.6, h._rgb(Lc.map(v => clamp01(v * 0.7)), base)); gr.addColorStop(1, h._rgb(Lc.map(v => clamp01(v * 0.4)), base))
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(e.x, e.y); ctx.lineTo(f.x, f.y); ctx.closePath(); ctx.fill()
        const fd = ctx.createLinearGradient(0, P(0, zc - 1.2).y, 0, P(0, zc - 5).y); fd.addColorStop(0, 'rgba(0,0,0,0)'); fd.addColorStop(1, 'rgba(0,0,0,1)')
        ctx.fillStyle = fd; ctx.fill()
        const ck = [P(-0.26, zc - 0.08), P(0.26, zc - 0.08), P(W2, zc - 0.34), P(-W2, zc - 0.34)], ab = [P(-0.3, zc), P(0.3, zc), P(0.3, zc - 0.08), P(-0.3, zc - 0.08)]
        for (const [q, k] of [[ck, 0.95], [ab, 1.1]]) if (!q.some(v => !v)) { ctx.beginPath(); q.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y))); ctx.closePath(); ctx.fillStyle = h._rgb(Lc.map(v => clamp01(v * k)), base); ctx.fill(); ctx.strokeStyle = 'rgba(8,10,16,0.55)'; ctx.lineWidth = lw; ctx.stroke() }
        const nk = [P(-W2, zc - 0.4), P(W2, zc - 0.4)]; if (nk[0] && nk[1]) { ctx.strokeStyle = 'rgba(8,10,16,0.5)'; ctx.beginPath(); ctx.moveTo(nk[0].x, nk[0].y); ctx.lineTo(nk[1].x, nk[1].y); ctx.stroke() }
      }
    }
  }
  // the stones cut to fit: the bridge at the foot (the band carried west to the court's circle, at the step's height) and the
  // stone at the head (carried east, level with the floor). Each one slab, its top cut with a border and a band of chevrons;
  // under the head's two courses of corbel stepping back to the wall
  {
    const [fx, fy, fr] = p.fan || [0, 0, 0], fanArc = (t0, t1, m = 10) => { const a0 = Math.atan2(at(t0, 0, 0).y - fy, at(t0, 0, 0).x - fx), a1 = Math.atan2(at(t1, D, 0).y - fy, at(t1, D, 0).x - fx); return Array.from({ length: m + 1 }, (_, i) => a0 + (a1 - a0) * i / m) }
    const stoneOf = (ta, tb, z, west) => {                             // ta the end at the stair, tb the far end
      const top = west ? [...arc(ta, p.lin, 0, z), ...fanArc(p.lin, p.lout).map(a => ({ x: fx + Math.cos(a) * fr, y: fy + Math.sin(a) * fr, z })), ...arc(p.lout, ta, D, z)]
                       : [...arc(ta, tb, 0, z), ...arc(tb, ta, D, z)]
      const tf = west ? p.lout : tb, k0 = 0.5
      // its outer face; the far end's face (the head's); under the head, the corbel
      if (!west) for (let c = 1; c >= 0; c--) {
        const za = z - k0 - c * 0.3, zb2 = za - 0.3, gd = D - 0.42 * (c + 1)
        fill([...arc(tb, ta, gd, za), ...arc(ta, tb, gd, zb2)], lit(at((ta + tb) / 2, gd + 0.4, za), 0.72 - 0.1 * c))
        const [ex, ey] = tan(tb); if (sees(at(tb, gd / 2, za), -ex, -ey)) fill([at(tb, 0, za), at(tb, gd, za), at(tb, gd, zb2), at(tb, 0, zb2)], lit(at(tb, gd / 2, za), 0.55))
      }
      if (fill([...arc(ta, tf, D, z), ...arc(tf, ta, D, z - k0)], lit(at((ta + tf) / 2, D + 0.4, z - 0.25), 0.84))) { line(arc(ta, tf, D, z - k0), 'rgba(8,10,16,0.55)'); line(arc(ta, tf, D, z - 0.06), 'rgba(8,10,16,0.3)') }
      if (!west) { const [ex, ey] = tan(tb); if (sees(at(tb, D / 2, z), -ex, -ey)) fill([at(tb, 0, z), at(tb, D, z), at(tb, D, z - k0), at(tb, 0, z - k0)], lit(at(tb, D / 2, z), 0.6)) }
      // its top: one slab; a border cut in from its edges; a band of chevrons along its outer side
      if (fill(top, lit(at((ta + tf) / 2, D / 2, z + 0.15), 1.02))) {
        const cut = 'rgba(8,10,16,0.6)', pale = 'rgba(215,222,238,0.22)', tE = west ? Math.min(p.lin, p.lout) - 0.004 : tb, tS = ta + (west ? 0.006 : -0.006)
        line(arc(tS, tE, 0.14, z), cut); line(arc(tS, tE, D - 0.12, z), cut); line([at(tS, 0.14, z), at(tS, D - 0.12, z)], cut)
        if (!west) line([at(tE, 0.14, z), at(tE, D - 0.12, z)], cut)
        line(arc(tS, tE, D - 0.14, z), pale)
        const NZ = Math.max(6, Math.round(Math.abs(tE - tS) * (p.rx + D) / 0.2)), zz = []
        for (let i = 0; i <= NZ; i++) zz.push(at(tS + (tE - tS) * i / NZ, i % 2 ? D - 0.24 : D - 0.52, z))
        line(arc(tS, tE, D - 0.22, z), cut); line(arc(tS, tE, D - 0.54, z), cut); line(zz, 'rgba(226,212,164,0.4)', lw * 1.2)
        if (west) line(fanArc(p.lin, p.lout).map(a => ({ x: fx + Math.cos(a) * fr, y: fy + Math.sin(a) * fr, z })), 'rgba(8,10,16,0.55)')   // (the joint with the court's step)
        else line(arc(ta, tb, D - 0.03, z), pale)
      }
    }
    if (p.lin) stoneOf(T0, null, p.zfoot, true)
    if (p.th) stoneOf(T1, p.th, 0, false)
  }
  // the steps: each tread's three, east (highest) to west
  const subs = []
  for (let j = 0; j < n; j++) for (let k = 0; k < NS; k++) {
    const tb = p.b[j + 1] + (p.b[j] - p.b[j + 1]) * k / NS, ta = p.b[j + 1] + (p.b[j] - p.b[j + 1]) * (k + 1) / NS
    subs.push({ ta, tb, z: p.z[j] - RS * k, head: j === n - 1 && k === 0, i: j * NS + k })
  }
  const mid = (s) => at((s.ta + s.tb) / 2, D / 2, s.z)
  subs.sort((a, b) => Math.abs(mid(b).x - cam.col) - Math.abs(mid(a).x - cam.col))
  for (const s of subs) {
    const { ta, tb, z } = s
    fill([...arcI(ta, tb, 0.005), ...arcI(tb, ta, 0.005, -0.6)], 'rgba(2,3,6,0.32)')                                   // the wall shadowed under the arch
    const [wx, wy] = tan(ta), [ex, ey] = tan(tb), zw = Math.max(z - RS, p.zfoot ?? z - RS)
    if (sees(at(ta, D / 2, z), wx, wy)) { fill([at(ta, 0, z), at(ta, D, z), at(ta, D, zw), at(ta, 0, zw)], lit(at(ta, D / 2 + 0.3, z), 0.74)); line([at(ta, D, zw), at(ta, 0, zw)], 'rgba(8,10,16,0.45)') }
    if (s.head && sees(at(tb, D / 2, z), -ex, -ey)) fill([at(tb, 0, z), at(tb, D, z), ...arcI(tb, tb, D).slice(0, 1), at(tb, 0, zi(tb))], lit(at(tb, D / 2 - 0.3, z), 0.62))
    // its piece of the stair's outer face: the step's edge on top, the arch below
    if (fill([...arc(ta, tb, D, z), ...arcI(tb, ta, D)], lit(at((ta + tb) / 2, D + 0.4, z - 0.5), 0.8))) {
      line(arc(ta, tb, D, z - 0.06), 'rgba(8,10,16,0.35)')
      if (s.i % NS === NS - 1) line([at(ta, D, z - RS), at(ta, D, zi(ta) + RT)], 'rgba(8,10,16,0.22)')            // (the joints between its stones)
    }
    // its top, the nosing worn pale, the joint with the wall dark
    if (fill([...arc(ta, tb, 0, z), ...arc(ta, tb, D, z).reverse()], lit(at((ta + tb) / 2, D / 2, z + 0.15), 1.0 + ((hash(s.i * 7919 + 3) & 15) / 160)))) {
      line(arc(ta, tb, D - 0.03, z), 'rgba(215,222,238,0.22)'); line(arc(ta, tb, 0.03, z), 'rgba(8,10,16,0.5)')
      line([at(ta, 0, z), at(ta, D, z)], 'rgba(8,10,16,0.55)')
    }
  }
  // the pier at its foot, over the column: the flight's end, down from the promontory to the capital
  { const [wx, wy] = tan(T0), z0 = p.zfoot ?? p.z[0] - 0.5
    if (sees(at(T0, D / 2, z0), wx, wy) && fill([at(T0, 0, z0), at(T0, D, z0), at(T0, D, p.zcap), at(T0, 0, p.zcap)], lit(at(T0, D / 2 + 0.3, z0 - 0.4), 0.7))) line([at(T0, D, z0), at(T0, D, p.zcap)], 'rgba(8,10,16,0.45)') }
  // the arch's ring on the outer face: a roll at its edge, chevrons cut between two lines, its voussoirs' joints
  {
    const g = D + 0.004, NR = 60, ring = [...arcI(T0, T1, g, 0, NR), ...arcI(T1, T0, g, RT, NR)]
    if (fill(ring, lit(at((T0 + T1) / 2, D + 0.5, zi((T0 + T1) / 2)), 1.3))) {
      line(arcI(T0, T1, g, 0, NR), 'rgba(8,10,16,0.65)', lw * 1.3); line(arcI(T0, T1, g, 0.05, NR), 'rgba(215,222,238,0.28)')
      line(arcI(T0, T1, g, RT, NR), 'rgba(8,10,16,0.55)')
      const NZ = 44, zz = []
      for (let i = 0; i <= NZ; i++) { const t = T0 + (T1 - T0) * i / NZ; zz.push(at(t, g, zi(t) + (i % 2 ? RT - 0.07 : 0.1))) }
      line(zz, 'rgba(8,10,16,0.6)', lw * 1.2)
      for (let i = 1; i < 22; i++) { const t = T0 + (T1 - T0) * i / 22; line([at(t, g, zi(t)), at(t, g, zi(t) + RT)], 'rgba(8,10,16,0.25)') }
    }
  }
  // the newels at the head, at each end of its stone's outer edge, a lamp on each
  for (const tN of [T1 + 0.012, ...(p.th ? [p.th + 0.012] : [])]) {
    const c = at(tN, D - 0.14, 0)
    if (Math.floor(c.y) === r) {
      const P = (dx, dy, z) => h._P(c.x + dx, c.y + dy, z), w = 0.11, H = 0.8, Lc = h.lightAt(c.x, c.y + 0.4, 0.5, -1)
      const fr = [P(-w, w, 0), P(w, w, 0), P(w, w, H), P(-w, w, H)], sd = cam.col > c.x ? [P(w, w, 0), P(w, -w, 0), P(w, -w, H), P(w, w, H)] : [P(-w, w, 0), P(-w, -w, 0), P(-w, -w, H), P(-w, w, H)]
      const cap = [P(-w - 0.03, w + 0.03, H), P(w + 0.03, w + 0.03, H), P(0, 0, H + 0.2)]
      for (const [q, k] of [[sd, 0.6], [fr, 0.9], [cap, 1.1]]) if (!q.some(v => !v)) { ctx.beginPath(); q.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y))); ctx.closePath(); ctx.fillStyle = h._rgb(Lc.map(v => clamp01(v * k)), base); ctx.fill(); ctx.strokeStyle = 'rgba(8,10,16,0.5)'; ctx.lineWidth = lw; ctx.stroke() }
      const f = P(0, 0, H + 0.32), kk = h._k(c.y)
      if (f) { const fl = 0.85 + 0.15 * Math.sin(h.t * 9 + 1.3), gw = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, kk * 0.3); gw.addColorStop(0, `rgba(255,214,150,${(0.55 * fl).toFixed(3)})`); gw.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = gw; ctx.beginPath(); ctx.arc(f.x, f.y, kk * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `rgba(255,236,190,${fl.toFixed(3)})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, kk * 0.025, kk * 0.05, 0, 0, Math.PI * 2); ctx.fill() }
    }
  }
  ctx.restore()
}

// { type: 'portal', x, y (the face, looking south), z (the sill), w (the opening), hj (the jambs, to the springing), orders,
//   t (each order's width), stone, steps, fall, narrow }: a round-arched door of receding orders, as the old churches
// have: a plain roll innermost, then a band cut in chevrons, and outermost a ring of carved heads looking down at you.
// Each order stands a little forward of the one inside it. Through it, steps going down into the black.
export function drawPortal(h, ctx, p) {
  const { x, y, z } = p, w = p.w ?? 1.3, hj = p.hj ?? 1.05, n = p.orders ?? 3, t = p.t ?? 0.2, zs = z + hj, k = h._k(y); if (!k) return
  const L = h.lightAt(x, y + 0.5, z + 1.1, -1), v = Math.min(1.25, Math.max(0.12, Math.max(L[0], L[1], L[2]) * 1.15))
  const base = p.stone || [176, 176, 178], col = (f) => `rgb(${base.map((c, i) => Math.min(255, c * L[i] * 1.15 * f) | 0)})`
  const P = (xx, yy, zz) => h._P(xx, yy, zz)
  const lw = Math.max(1, k * 0.012)
  const archPts = (rad, yy, a0 = 0, a1 = Math.PI, m = 28) => Array.from({ length: m + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / m; return P(x + Math.cos(a) * rad, yy, zs + Math.sin(a) * rad) })
  const path = (pts) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath() }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // the opening: black, and the steps inside going down, fainter and narrower
  const open = [P(x - w / 2, y, z), ...archPts(w / 2, y).reverse(), P(x + w / 2, y, z)]
  if (open.some(q => !q)) { ctx.restore(); return }
  path(open)
  ctx.save(); ctx.fillStyle = '#010102'; ctx.fill(); ctx.clip()
  const nSteps = p.steps ?? 10, fall = p.fall ?? 0.8
  for (let i = 0; i < nSteps; i++) {
    const yy = y - 0.18 - i * 0.32, zz = z - i * 0.26, ins = 0.06 + (p.narrow ?? 0) * i, a = P(x - w / 2 + ins, yy, zz), b = P(x + w / 2 - ins, yy, zz)
    if (!a || !b) continue
    const al = 0.5 * v * Math.pow(fall, i)
    ctx.strokeStyle = `rgba(150,160,180,${al.toFixed(3)})`; ctx.lineWidth = Math.max(1, k * 0.02); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    const c = P(x - w / 2 + ins, yy, zz - 0.26)
    if (c) { ctx.fillStyle = `rgba(40,44,52,${(al * 0.9).toFixed(3)})`; ctx.fillRect(Math.min(a.x, c.x), a.y, Math.abs(b.x - a.x), Math.max(1, c.y - a.y)) }
  }
  ctx.restore()
  // the orders, the innermost (furthest back) first
  for (let o = 0; o < n; o++) {
    const a0 = w / 2 + o * t, a1 = a0 + t, yy = y + 0.02 + o * 0.07
    const ring = [...archPts(a1, yy), ...archPts(a0, yy).reverse()]
    if (ring.some(q => !q)) continue
    for (const sx of [-1, 1]) {                                          // the jamb: a shaft, lit on its left, its capital at the springing
      const xa = x + sx * a0, xb = x + sx * a1, q = [P(xa, yy, z), P(xb, yy, z), P(xb, yy, zs), P(xa, yy, zs)]
      if (q.some(e => !e)) continue
      path(q); ctx.fillStyle = col(0.9 - o * 0.05); ctx.fill()
      const xm = (xa + xb) / 2, hl = [P(xm - 0.04, yy, z), P(xm - 0.04, yy, zs)], sh = [P(Math.max(xa, xb) - 0.02, yy, z), P(Math.max(xa, xb) - 0.02, yy, zs)]
      ctx.strokeStyle = `rgba(235,238,245,${(0.22 * v).toFixed(3)})`; ctx.lineWidth = lw * 1.4; ctx.beginPath(); ctx.moveTo(hl[0].x, hl[0].y); ctx.lineTo(hl[1].x, hl[1].y); ctx.stroke()
      ctx.strokeStyle = 'rgba(8,10,16,0.45)'; ctx.lineWidth = lw * 2; ctx.beginPath(); ctx.moveTo(sh[0].x, sh[0].y); ctx.lineTo(sh[1].x, sh[1].y); ctx.stroke()
      const cap = [P(xa - sx * 0.03, yy + 0.01, zs - 0.22), P(xb + sx * 0.03, yy + 0.01, zs - 0.22), P(xb + sx * 0.03, yy + 0.01, zs), P(xa - sx * 0.03, yy + 0.01, zs)]
      if (!cap.some(e => !e)) { path(cap); ctx.fillStyle = col(1.05); ctx.fill(); ctx.strokeStyle = 'rgba(8,10,16,0.55)'; ctx.lineWidth = lw; ctx.stroke() }
      { const pl = [P(xa - sx * 0.03, yy + 0.01, z), P(xb + sx * 0.03, yy + 0.01, z), P(xb + sx * 0.03, yy + 0.01, z + 0.16), P(xa - sx * 0.03, yy + 0.01, z + 0.16)]
        if (!pl.some(e => !e)) { path(pl); ctx.fillStyle = col(1.0); ctx.fill(); ctx.strokeStyle = 'rgba(8,10,16,0.55)'; ctx.lineWidth = lw; ctx.stroke() } }
      for (const zb of [z + 0.12]) { const a = P(xa, yy, zb), b = P(xb, yy, zb); if (a && b) { ctx.strokeStyle = 'rgba(8,10,16,0.5)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() } }
    }
    path(ring); ctx.fillStyle = col(1 - o * 0.04); ctx.fill(); ctx.strokeStyle = 'rgba(8,10,16,0.6)'; ctx.lineWidth = lw; ctx.stroke()
    const nv = 9 + o * 2                                                 // the voussoirs' joints
    for (let i = 1; i < nv; i++) { const an = Math.PI * i / nv, a = P(x + Math.cos(an) * a0, yy, zs + Math.sin(an) * a0), b = P(x + Math.cos(an) * a1, yy, zs + Math.sin(an) * a1); if (a && b) { ctx.strokeStyle = 'rgba(8,10,16,0.35)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() } }
    const am = (a0 + a1) / 2
    if (o === 0) {                                                       // a roll: lit along its upper side
      const pts = archPts(am + 0.03, yy); ctx.strokeStyle = `rgba(235,238,245,${(0.2 * v).toFixed(3)})`; ctx.lineWidth = lw * 1.6; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke()
    } else if (o === n - 1 && p.heads !== false) {                         // the heads: pale, eyes shut or hollow, all looking down
      const nh = 11
      for (let i = 0; i < nh; i++) {
        const an = Math.PI * (i + 0.5) / nh, cxh = x + Math.cos(an) * am, czh = zs + Math.sin(an) * am, c0 = P(cxh, yy + 0.01, czh)
        if (!c0) continue
        const s = k * t * 0.42
        ctx.fillStyle = col(1.18); ctx.beginPath(); ctx.ellipse(c0.x, c0.y, s * 0.78, s, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(14,14,18,0.8)'
        const hollow = (hash(i * 37 + 5) & 3) === 0
        for (const ex of [-1, 1]) { ctx.beginPath(); if (hollow) ctx.ellipse(c0.x + ex * s * 0.32, c0.y - s * 0.12, s * 0.15, s * 0.17, 0, 0, Math.PI * 2); else ctx.rect(c0.x + ex * s * 0.32 - s * 0.14, c0.y - s * 0.14, s * 0.28, Math.max(1, s * 0.06)); ctx.fill() }
        ctx.fillRect(c0.x - s * 0.2, c0.y + s * 0.42, s * 0.4, Math.max(1, s * 0.07))
      }
    } else if (o === n - 2 && p.ogham) {                                 // ogham: a stem along the order, strokes across it in groups
      const st = archPts(am, yy)
      if (!st.some(q => !q)) {
        ctx.strokeStyle = 'rgba(8,10,16,0.7)'; ctx.lineWidth = lw * 1.5; ctx.beginPath(); st.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke()
        ctx.strokeStyle = `rgba(226,212,164,${(0.5 * v).toFixed(3)})`; ctx.lineWidth = lw * 1.2
        for (let g = 0; g < 14; g++) {
          const hv = hash(g * 53 + 11), cnt = 1 + (hv & 3), fl = (hv >> 3) & 1
          for (let s = 0; s < cnt; s++) {
            const an = Math.PI * (g + 0.12 + s * 0.2) / 14, r0 = fl ? am - t * 0.34 : am, r1 = fl ? am + t * 0.34 : am + t * 0.34 - (hv & 4 ? t * 0.34 : 0)
            const a = P(x + Math.cos(an) * r0, yy, zs + Math.sin(an) * r0), b = P(x + Math.cos(an) * r1, yy, zs + Math.sin(an) * r1)
            if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
          }
        }
      }
    } else {                                                             // chevrons cut in it
      const m = 14 + o * 2
      const zig = Array.from({ length: m + 1 }, (_, i) => { const an = Math.PI * i / m, rr = i % 2 ? a1 - 0.04 : a0 + 0.04; return P(x + Math.cos(an) * rr, yy, zs + Math.sin(an) * rr) })
      if (!zig.some(q => !q)) {
        ctx.strokeStyle = 'rgba(8,10,16,0.7)'; ctx.lineWidth = lw * 1.6; ctx.beginPath(); zig.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke()
        ctx.strokeStyle = `rgba(235,238,245,${(0.18 * v).toFixed(3)})`; ctx.lineWidth = lw; ctx.beginPath(); zig.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y - lw * 1.5) : ctx.moveTo(q.x, q.y - lw * 1.5))); ctx.stroke()
      }
    }
  }
  // a hood over it all, a thin dark line
  const hood = archPts(w / 2 + n * t + 0.04, y + 0.02 + n * 0.07)
  if (!hood.some(q => !q)) { ctx.strokeStyle = 'rgba(8,10,16,0.6)'; ctx.lineWidth = lw * 2; ctx.beginPath(); hood.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke() }
  h._polys.push({ pts: [P(x - w / 2 - n * t, y, z), P(x + w / 2 + n * t, y, z), P(x + w / 2 + n * t, y, zs + w / 2 + n * t), P(x - w / 2 - n * t, y, zs + w / 2 + n * t)], r: Math.floor(y), walk: false })
  ctx.restore()
}

// { type: 'flow', paths: [[[x, y, z]...]...], y0, y1 }: glints going along the runnels, the only sign there is water in them
export function flowRows(p) { return [Math.floor(p.y0), Math.floor(p.y1)] }
export function drawFlow(h, ctx, p) {
  const r = p.row
  if (!p._R) p._R = p.paths.map(P => { const out = []; let s = 0; for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); out.push({ a, b, s, L }); s += L } return { segs: out, len: s } })
  const sp = p.speed ?? 0.45
  ctx.save()
  p._R.forEach((P, pi) => {
    const n = Math.max(1, Math.round(P.len / 0.55))
    for (let i = 0; i < n; i++) {
      const hh = hash(pi * 7919 + i * 131 + 7), s = ((i + (hh & 255) / 255 * 0.7) / n * P.len + h.t * sp * (0.7 + ((hh >> 8) & 255) / 255 * 0.6)) % P.len
      const g = P.segs.find(q => s >= q.s && s <= q.s + q.L) || P.segs[P.segs.length - 1], u = g.L ? (s - g.s) / g.L : 0
      const x = g.a[0] + (g.b[0] - g.a[0]) * u, y = g.a[1] + (g.b[1] - g.a[1]) * u, z = (g.a[2] ?? 0) + ((g.b[2] ?? 0) - (g.a[2] ?? 0)) * u + 0.01
      if (Math.floor(y) !== r) continue
      const L = h.lightAt(x, y, z + 0.2, -1), lv = Math.max(L[0], L[1], L[2]); if (lv < 0.03) continue
      const S = h._P(x, y, z); if (!S) continue
      const k = h._k(y), tw = 0.5 + 0.5 * Math.sin(h.t * 3 + i * 1.7)
      ctx.fillStyle = `rgba(220,232,246,${(Math.min(0.55, lv * 0.45) * tw).toFixed(3)})`
      ctx.fillRect(S.x - k * 0.025, S.y - Math.max(1, k * 0.008), Math.max(1, k * 0.05), Math.max(1, k * 0.016))
    }
  })
  ctx.restore()
}
// { type: 'culvert', x, y (the riser it is cut in, looking south), z (its foot), w, h }: a little round-arched mouth in the
// foot of a step, where a runnel goes in under it
export function drawCulvert(h, ctx, p) {
  const { x, y, z } = p, w = p.w ?? 0.3, hh = p.h ?? 0.24, k = h._k(y); if (!k) return
  const L = h.lightAt(x, y + 0.3, z + 0.2, -1), m = 24, rr = w / 2, zs = z + hh - rr
  const pts = [h._P(x - rr, y, z), ...Array.from({ length: m + 1 }, (_, i) => { const a = Math.PI - Math.PI * i / m; return h._P(x + Math.cos(a) * rr, y, zs + Math.sin(a) * rr) }), h._P(x + rr, y, z)]
  if (pts.some(q => !q)) return
  ctx.save(); ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fillStyle = '#020203'; ctx.fill()
  ctx.strokeStyle = h._rgb(L.map(v => clamp01(v * 1.1)), [170, 172, 178]); ctx.lineWidth = Math.max(1, k * 0.03); ctx.beginPath(); pts.slice(1, -1).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke()
  ctx.restore()
}

// ═════════ the fairy thorn ════════════════════════════════════════════════════════════════════════════════════════════
// { type: 'thorn', x, y (its foot), z, seed, rgb (the light through it) }: a hawthorn grown up through the stone, gnarled
// and old, white blossom on every branch. Its foot splits into two great limbs that lean together into an arch, and in
// the arch is the light of the hollow hills; above, the crown, twiggy and dense; roots gripping the stone and going over
// its edges into the dark; a petal now and then falling. No one cuts a fairy thorn: it is the gate.
function growThorn(p) {
  const rnd = seeded(p.seed ?? 31), segs = [], tips = [], roots = [], limbs = [[], []]
  const z0 = p.z ?? 0, H = p.h ?? 2.7
  ;[-1, 1].forEach((side, li) => {                                    // the two limbs: out, then leaning in, meeting over the way
    const P0 = [p.x + side * 0.48, p.y, z0], P1 = [p.x + side * 1.0, p.y - 0.08, z0 + H * 0.55], P2 = [p.x + side * 0.14, p.y - 0.04, z0 + H]
    let prev = null
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t, j = i && i < 16 ? (rnd() - 0.5) * 0.14 : 0
      const q = { x: a * P0[0] + b * P1[0] + c * P2[0] + j, y: a * P0[1] + b * P1[1] + c * P2[1] + (rnd() - 0.5) * 0.05, z: a * P0[2] + b * P1[2] + c * P2[2] + j * 0.5 }
      limbs[li].push(q)
      if (prev) segs.push({ a: prev, b: q, w: (0.24 - 0.15 * t) * (0.9 + rnd() * 0.25), d: 0 })
      prev = q
    }
  })
  const branch = (s, dx, dz, dy, len, w, depth) => {
    let x = s.x, y = s.y, z = s.z, n = Math.max(2, Math.round(len / 0.16)), prev = s
    for (let i = 0; i < n; i++) {
      const tw = (rnd() - 0.5) * 0.9; const c = Math.cos(tw), sn = Math.sin(tw); [dx, dz] = [dx * c - dz * sn, dx * sn + dz * c]; dz += 0.06
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l
      x += dx * len / n; z += dz * len / n; y += dy * len / n + (rnd() - 0.5) * 0.03
      const q = { x, y, z }; segs.push({ a: prev, b: q, w: w * (1 - 0.5 * i / n), d: depth }); prev = q
      if (depth >= 2 && i > 0 && rnd() < 0.5) tips.push({ x, y, z, n: 7 })
    }
    if (depth >= 3) { tips.push({ x, y, z, n: 18 }); return }
    const kids = 2 + (rnd() < 0.4 ? 1 : 0)
    for (let m = 0; m < kids; m++) { const a = (m - (kids - 1) / 2) * (0.55 + rnd() * 0.5) + (rnd() - 0.5) * 0.4, c = Math.cos(a), sn = Math.sin(a); branch(prev, dx * c - dz * sn, dx * sn + dz * c, (rnd() - 0.5) * 0.5, len * (0.7 + rnd() * 0.18), w * 0.6, depth + 1) }
  }
  limbs.forEach((Lm, li) => {                                         // the crown, from the upper limbs
    const side = li ? 1 : -1
    for (const i of [7, 9, 11, 13, 15, 16]) { const q = Lm[i], up = 0.45 + rnd() * 0.6; branch(q, side * (0.8 + rnd() * 0.35) * (i === 16 ? 0.35 : 1), up, (rnd() - 0.5) * 0.7, 1.1 + rnd() * 0.6, 0.075, 1) }
  })
  for (const [dx, len] of [[-0.55, 1.0], [-0.15, 1.15], [0.2, 1.1], [0.6, 0.95]]) branch(limbs[dx < 0 ? 0 : 1][16], dx, 1, (rnd() - 0.5) * 0.5, len, 0.1, 1)      // (and up from where they meet: the crown full over the arch)
  for (let i = 0; i < 9; i++) {                                       // the roots: across the stone, some of them over its edge and down
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.4, over = i % 3 === 0
    let x = p.x + Math.cos(a) * 0.35, y = p.y + Math.sin(a) * 0.2, z = z0, prev = { x, y, z }, pts = [prev]
    const ex = p.edges, n = 10
    for (let s = 0; s < n; s++) {
      const off = ex && ((x < ex[0] && Math.cos(a) < 0) || (x > ex[1] && Math.cos(a) > 0) || (y < ex[2] && Math.sin(a) < 0))
      if (over && off) z -= 0.28; else { x += Math.cos(a) * 0.14 + (rnd() - 0.5) * 0.06; y += Math.sin(a) * 0.1 + (rnd() - 0.5) * 0.05 }
      if (!over && ex) { x = Math.max(ex[0] + 0.05, Math.min(ex[1] - 0.05, x)); y = Math.max(ex[2] + 0.05, y) }
      const q = { x, y, z: off && over ? z : z0 + 0.012 }; pts.push(q); prev = q
    }
    roots.push({ pts, w: 0.12 })
  }
  if (p.lean) { const all = [...segs.flatMap(sg => [sg.a, sg.b]), ...tips, ...limbs.flat()]; for (const q of new Set(all)) q.x += p.lean * Math.max(0, q.z - z0) ** 1.3 / H }
  // the weave: twigs grown across the arch, closing it; each one draws back as the gate opens (p.open, 0..1)
  const weave = []
  for (let i = 0; i < (p.weave ?? 9); i++) {
    const ia = 2 + Math.floor(rnd() * 11), ib = 2 + Math.floor(rnd() * 11), A = limbs[0][ia], B = limbs[1][ib], pts = []
    for (let s = 0; s <= 10; s++) { const t = s / 10; pts.push({ x: A.x + (B.x - A.x) * t + Math.sin(t * 9 + i) * 0.05, y: A.y + (B.y - A.y) * t - 0.03, z: A.z + (B.z - A.z) * t + Math.sin(t * Math.PI) * (rnd() - 0.4) * 0.3 }) }
    weave.push({ pts, from: rnd() < 0.5 ? 0 : 1, at: (i + 1) / ((p.weave ?? 9) + 1) })
  }
  return { segs, tips, roots, limbs, weave, rnd: seeded((p.seed ?? 31) + 1) }
}
export function drawThorn(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  if (!p._T) p._T = growThorn(p)
  const T = p._T, z0 = p.z ?? 0, P = (q) => h._P(q.x, q.y, q.z), glowC = p.rgb || [255, 205, 140]
  const L = h.lightAt(p.x, p.y + 0.5, z0 + 1.4, -1), lv = Math.max(L[0], L[1], L[2])
  const bark = (f) => h._rgb(L.map(v => clamp01(v * 1.05 * f + 0.06)), [118, 112, 104])
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // the roots on the stone and over its edges
  for (const R of T.roots) { const S = R.pts.map(P); if (S.some(s => !s)) continue
    for (let i = 0; i + 1 < S.length; i++) { const w = R.w * (1 - i / S.length * 0.8); ctx.strokeStyle = bark(0.72); ctx.lineWidth = Math.max(1, k * w); ctx.beginPath(); ctx.moveTo(S[i].x, S[i].y); ctx.lineTo(S[i + 1].x, S[i + 1].y); ctx.stroke() } }
  // the light of the hollow hills, in the arch the limbs make
  const inner = [...T.limbs[0], ...T.limbs[1].slice().reverse()].map(P)
  if (!inner.some(s => !s)) {
    const open = p.open ?? 1, breathe = (0.75 + 0.25 * Math.sin(h.t * 0.7)) * (0.22 + 0.78 * open), c = P({ x: p.x, y: p.y - 0.05, z: z0 + 1.0 })
    ctx.save(); ctx.beginPath(); inner.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.closePath(); ctx.clip()
    const f = P({ x: p.x, y: p.y - 0.05, z: z0 + 0.1 }), g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, k * 2.6)      // (from the ground beyond, fading up)
    g.addColorStop(0, `rgba(${glowC},${(0.72 * breathe).toFixed(3)})`); g.addColorStop(0.45, `rgba(${glowC.map(v => v * 0.6 | 0)},${(0.32 * breathe).toFixed(3)})`); g.addColorStop(1, 'rgba(30,22,14,0.12)')
    ctx.fillStyle = g; ctx.fillRect(c.x - k * 2, c.y - k * 2.5, k * 4, k * 4)
    for (let i = 0; i < 14; i++) {                                    // motes going up in it
      const u = ((h.t * 0.12 + i * 0.137) % 1), mx = p.x + Math.sin(i * 2.3 + h.t * 0.5) * 0.35, m = P({ x: mx, y: p.y - 0.1, z: z0 + 0.1 + u * 2.3 })
      if (m) { ctx.fillStyle = `rgba(255,236,190,${(0.7 * Math.sin(Math.PI * u)).toFixed(3)})`; ctx.fillRect(m.x, m.y, Math.max(1, k * 0.025), Math.max(1, k * 0.025)) }
    }
    ctx.restore()
    const gg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, k * 2.6)                                 // and spilling out round it
    gg.addColorStop(0, `rgba(${glowC},${(0.16 * breathe).toFixed(3)})`); gg.addColorStop(1, `rgba(${glowC},0)`)
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gg; ctx.fillRect(c.x - k * 2.6, c.y - k * 2.6, k * 5.2, k * 5.2); ctx.globalCompositeOperation = 'source-over'
  }
  // the wood: thick to thin, lit on the left, the light from the arch on the inner sides of the limbs
  const order = T.segs.slice().sort((a, b) => b.w - a.w)
  for (const sg of order) {
    const a = P(sg.a), b = P(sg.b); if (!a || !b) continue
    const w = Math.max(1, k * sg.w)
    ctx.strokeStyle = bark(sg.d ? 0.9 : 0.82); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    if (w > 2.5) { ctx.strokeStyle = 'rgba(10,8,8,0.45)'; ctx.lineWidth = w * 0.3; ctx.beginPath(); ctx.moveTo(a.x + w * 0.3, a.y); ctx.lineTo(b.x + w * 0.3, b.y); ctx.stroke()
      ctx.strokeStyle = `rgba(230,225,215,${(0.18 * lv).toFixed(3)})`; ctx.lineWidth = w * 0.18; ctx.beginPath(); ctx.moveTo(a.x - w * 0.3, a.y); ctx.lineTo(b.x - w * 0.3, b.y); ctx.stroke() }
  }
  for (const Lm of T.limbs) for (let i = 1; i < 13; i++) {           // the arch's light on the limbs' inner sides
    const a = P(Lm[i - 1]), b = P(Lm[i]); if (!a || !b) continue
    const side = Lm === T.limbs[0] ? 1 : -1, w = Math.max(1, k * 0.05)
    ctx.strokeStyle = `rgba(${glowC},0.35)`; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x + side * k * 0.06, a.y); ctx.lineTo(b.x + side * k * 0.06, b.y); ctx.stroke()
  }
  // the weave across the arch: what is left of it as the gate opens
  for (const W of T.weave || []) {
    const open = p.open ?? 1, keep = Math.max(0, Math.min(1, (W.at - open) * 6 + 1)); if (keep <= 0.02) continue
    const n = Math.max(1, Math.round((W.pts.length - 1) * keep)), pts = (W.from ? W.pts.slice().reverse() : W.pts).slice(0, n + 1).map(P); if (pts.some(s => !s)) continue
    ctx.strokeStyle = bark(0.78); ctx.lineWidth = Math.max(1, k * 0.045); ctx.beginPath(); pts.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.stroke()
    ctx.strokeStyle = 'rgba(14,10,8,0.8)'; ctx.lineWidth = Math.max(1, k * 0.012)
    for (let i = 1; i < pts.length; i += 2) { const s = pts[i]; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + k * 0.05 * (i % 4 ? 1 : -1), s.y - k * 0.04); ctx.stroke() }     // thorns
  }
  // the blossom: white on every branch, shining a little of itself
  const rb = seeded((p.seed ?? 31) + 7), bl = Math.min(1.05, 0.86 + lv * 0.3)
  const bloom = 0.1 + 0.9 * (p.open ?? 1)                              // (it comes into flower as the gate opens: shut, a few early blossoms)
  for (const tp of T.tips) for (let i = 0; i < tp.n; i++) {
    if (i >= Math.ceil(tp.n * bloom)) { rb(); rb(); rb(); rb(); rb(); continue }
    const q = { x: tp.x + (rb() - 0.5) * 0.3, y: tp.y + (rb() - 0.5) * 0.2, z: tp.z + (rb() - 0.5) * 0.24 + Math.sin(h.t * 0.9 + tp.x * 3) * 0.01 }, s = P(q); if (!s) continue
    const pink = rb() < 0.18, r = Math.max(1, k * (0.03 + rb() * 0.04))
    ctx.fillStyle = pink ? `rgba(${240 * bl | 0},${214 * bl | 0},${220 * bl | 0},0.95)` : `rgba(${242 * bl | 0},${240 * bl | 0},${232 * bl | 0},0.95)`
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill()
  }
  // a petal falling now and then, drifting out over the dark
  for (let i = 0; i < 8; i++) {
    const per = 9 + i * 1.3, u = ((h.t + i * 3.7) % per) / per, tp = T.tips[(i * 7) % T.tips.length]; if (!tp) continue
    const q = { x: tp.x + Math.sin(h.t * 1.3 + i) * 0.25 + u * 0.6, y: tp.y + u * 0.8, z: tp.z - u * (tp.z + 2.5) }, s = P(q); if (!s) continue
    ctx.fillStyle = `rgba(240,236,230,${(0.85 * (1 - u)).toFixed(3)})`; ctx.fillRect(s.x, s.y, Math.max(1, k * 0.035), Math.max(1, k * 0.02))
  }
  ctx.restore()
}

// { type: 'spout', x, y (the face, looking south), z (the mouth), zl (where it lands), out (how far it throws) }: the keystone
// of Donn's door is a head, and from its mouth the fifth stream falls in a thread in front of the door, onto the threshold
export function drawSpout(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  const L = h.lightAt(p.x, p.y + 0.4, p.z, -1), lv = Math.max(L[0], L[1], L[2]), out = p.out ?? 0.22
  const c = h._P(p.x, p.y + 0.02, p.z + 0.06), s = k * (p.s ?? 0.15); if (!c) return
  ctx.save()
  if (p.tears) { drawWeeper(h, ctx, p, k, L, lv, c, s); ctx.restore(); return }
  // the head: larger than its fellows, pale, eyes shut, mouth open
  ctx.fillStyle = h._rgb(L.map(v => clamp01(v * 1.2)), p.stone || [176, 176, 180]); ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.8, s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(8,8,12,0.6)'; ctx.lineWidth = Math.max(1, k * 0.01); ctx.stroke()
  ctx.fillStyle = 'rgba(12,12,16,0.85)'
  for (const ex of [-1, 1]) ctx.fillRect(c.x + ex * s * 0.32 - s * 0.15, c.y - s * 0.2, s * 0.3, Math.max(1, s * 0.08))
  ctx.beginPath(); ctx.ellipse(c.x, c.y + s * 0.45, s * 0.2, s * 0.24, 0, 0, Math.PI * 2); ctx.fill()
  // the thread of water: out a little from the mouth, then straight down, in pieces going down
  const N = 24, pts = []
  for (let i = 0; i <= N; i++) { const u = i / N, zz = p.z - (p.z - p.zl) * u, yy = p.y + 0.03 + out * Math.sqrt(Math.min(1, u * 4)); pts.push(h._P(p.x, yy, zz)) }
  if (!pts.some(q => !q)) {
    ctx.lineCap = 'round'
    ctx.strokeStyle = `rgba(150,170,196,${(0.32 * Math.max(0.4, lv)).toFixed(3)})`; ctx.lineWidth = Math.max(1, k * 0.045); ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke()
    for (let m = 0; m < 6; m++) {                                     // bright pieces going down it
      const u0 = ((h.t * 0.9 + m / 6) % 1), i0 = Math.floor(u0 * N), i1 = Math.min(N, i0 + 2)
      ctx.strokeStyle = `rgba(215,228,244,${(0.6 * Math.max(0.4, lv)).toFixed(3)})`; ctx.lineWidth = Math.max(1, k * 0.022)
      ctx.beginPath(); ctx.moveTo(pts[i0].x, pts[i0].y); ctx.lineTo(pts[i1].x, pts[i1].y); ctx.stroke()
    }
    const b = pts[N], ph = (h.t * 2.2) % 1                              // where it lands: rings going out on the wet stone
    ctx.strokeStyle = `rgba(200,214,232,${(0.4 * (1 - ph)).toFixed(3)})`; ctx.lineWidth = Math.max(1, k * 0.012)
    ctx.beginPath(); ctx.ellipse(b.x, b.y, k * (0.04 + 0.14 * ph), k * (0.015 + 0.05 * ph), 0, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
}

// the head that weeps: brows drawn up in the middle, eyes cast down, the mouth turned down; from each eye a tear down the cheek
// to the jaw, and from there a thread of water falling to the step
function drawWeeper(h, ctx, p, k, L, lv, c, s) {
  const lw = Math.max(1, k * 0.01), ps = p.s, cz = p.z + 0.06, fy = p.y + 0.03, out = p.out ?? 0.22
  ctx.fillStyle = h._rgb(L.map(v => clamp01(v * 1.2)), p.stone || [176, 176, 180]); ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.78, s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(8,8,12,0.6)'; ctx.lineWidth = lw; ctx.stroke()
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(12,12,16,0.85)'; ctx.lineWidth = Math.max(1, s * 0.08)
  for (const ex of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(c.x + ex * s * 0.55, c.y - s * 0.32); ctx.lineTo(c.x + ex * s * 0.12, c.y - s * 0.46); ctx.stroke()          // a brow, raised at the middle
    ctx.beginPath(); ctx.arc(c.x + ex * s * 0.3, c.y - s * 0.24, s * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()                // an eye, cast down
  }
  ctx.beginPath(); ctx.arc(c.x, c.y + s * 0.72, s * 0.24, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke()                                  // the mouth, turned down
  const N = 26, cA = `rgba(150,170,196,${(0.34 * Math.max(0.4, lv)).toFixed(3)})`, cB = `rgba(215,228,244,${(0.62 * Math.max(0.4, lv)).toFixed(3)})`
  for (const ex of [-1, 1]) {
    const pts = [], ze = cz + 0.12 * ps, zj = cz - 0.78 * ps, xe = p.x + ex * 0.3 * ps, xj = p.x + ex * 0.4 * ps
    for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push(h._P(xe + (xj - xe) * u, fy, ze + (zj - ze) * u)) }                          // down the cheek
    for (let i = 1; i <= N; i++) { const u = i / N, zz = zj - (zj - p.zl) * u, yy = fy + out * Math.sqrt(Math.min(1, u * 4)); pts.push(h._P(xj + ex * 0.02 * u, yy, zz)) }   // and off the jaw
    if (pts.some(q => !q)) continue
    ctx.strokeStyle = cA; ctx.lineWidth = Math.max(1, k * 0.028); ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke()
    for (let m = 0; m < 5; m++) {
      const u0 = ((h.t * 0.8 + m / 5 + (ex > 0 ? 0.37 : 0)) % 1), i0 = Math.floor(u0 * (pts.length - 1)), i1 = Math.min(pts.length - 1, i0 + 2)
      ctx.strokeStyle = cB; ctx.lineWidth = Math.max(1, k * 0.016); ctx.beginPath(); ctx.moveTo(pts[i0].x, pts[i0].y); ctx.lineTo(pts[i1].x, pts[i1].y); ctx.stroke()
    }
    const b = pts[pts.length - 1], ph = (h.t * 2.2 + (ex > 0 ? 0.5 : 0)) % 1
    ctx.strokeStyle = `rgba(200,214,232,${(0.4 * (1 - ph)).toFixed(3)})`; ctx.lineWidth = Math.max(1, k * 0.012)
    ctx.beginPath(); ctx.ellipse(b.x, b.y, k * (0.03 + 0.11 * ph), k * (0.012 + 0.04 * ph), 0, 0, Math.PI * 2); ctx.stroke()
  }
}

// ═════════ the thorn's hill ═══════════════════════════════════════════════════════════════════════════════════════════
// { type: 'spur', steps: [[x, y, z]...] (the tiles of the path up, foot first), top: [[x, y]...] (the hilltop's tiles, at
//   the last step's height), lean, seed, roots: [[[x, y, z]...]...], water: [[x, y, z]...] }: a crooked spur of rock going up
// out of the dark, the steps cut in it, the thorn's roots winding down among them, and a thread of water going UP them.
// Each tile's rock is a column of slices, each a little off the one under it and gnarled, fading into the dark below;
// together they make the hill. Walked by hidden decks (the generator's); drawn a row at a time.
export function spurRows(p) { const ys = [...p.steps, ...p.top].map(q => q[1]); return [Math.min(...ys) - 1, Math.max(...ys) + 1] }
function buildSpur(p) {
  const rnd = seeded(p.seed ?? 5), cols = [], ztop = p.steps[p.steps.length - 1][2]
  const tiles = [...p.steps.map(([x, y, z]) => ({ x, y, z, step: true })), ...p.top.map(([x, y]) => ({ x, y, z: ztop, step: false })), ...(p.pools || []).map(([x, y, z]) => ({ x, y, z, pool: true }))]
  for (const T of tiles) {
    const ph = rnd() * 6.28, ph2 = rnd() * 6.28, slices = []
    for (let z = T.z; z > T.z - 6.2; z -= 0.16) {
      const d = T.z - z, lean = (p.lean ?? 0.12) * (z - 0) * -1
      slices.push({ x: T.x + 0.5 + lean + Math.sin(z * 1.3 + ph) * 0.09, y: T.y + 0.5 + Math.sin(z * 0.9 + ph2) * 0.07, z,
        r: (0.8 + 0.25 * Math.min(1, d / 3)) * (1 + 0.14 * Math.sin(z * 2.1 + ph) + 0.08 * Math.sin(z * 4.3 + ph2)), rr: (0.8 + 0.25 * Math.min(1, d / 3)) * (1 + 0.16 * Math.sin(z * 1.7 + ph2 + 1) + 0.1 * Math.sin(z * 5.1 + ph)), d })
    }
    const k = rnd()
    cols.push({ T, slices, top: Array.from({ length: 9 }, (_, i) => { const a = i / 9 * Math.PI * 2 + 0.3 * (rnd() - 0.5), rr = 0.43 + 0.08 * rnd(); return { x: T.x + 0.5 + Math.cos(a) * rr * (1 + 0.12 * Math.abs(Math.cos(a))), y: T.y + 0.5 + Math.sin(a) * rr, z: T.z } }), tone: 0.92 + 0.14 * k })
  }
  return { cols }
}
export function drawSpur(h, ctx, p) {
  const r = p.row
  if (!p._S) p._S = buildSpur(p)
  const lw = Math.max(1, h._k(r + 0.5) * 0.013)
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const C of p._S.cols.filter(c => c.T.y === r).sort((a, b) => Math.abs(b.T.x + 0.5 - h.cam.col) - Math.abs(a.T.x + 0.5 - h.cam.col))) {
    // the rock: one twisted column, its two sides traced from slice to slice, lit across, going black as it goes down
    const L0 = h.lightAt(C.T.x + 0.5, C.T.y + 1, C.T.z - 0.3, -1), lv = Math.max(L0[0], L0[1], L0[2])
    const lft = [], rgt = []
    for (const S of C.slices) { const c = h._P(S.x, S.y, S.z), ex = h._P(S.x + 1, S.y, S.z); if (!c || !ex) continue; const u = Math.abs(ex.x - c.x); lft.push([c.x - u * S.r, c.y, S.d]); rgt.push([c.x + u * S.rr, c.y, S.d]) }     // (its two sides gnarled apart)
    if (lft.length > 2) {
      const xa = Math.min(...lft.map(q => q[0])), xb = Math.max(...rgt.map(q => q[0])), ya = lft[0][1], yb = lft[lft.length - 1][1]
      ctx.save(); ctx.beginPath(); lft.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); for (let i = rgt.length - 1; i >= 0; i--) ctx.lineTo(rgt[i][0], rgt[i][1]); ctx.closePath()
      const base = h._rgb(L0.map(v => clamp01((v * 1.15 + 0.05) * C.tone)), [100, 98, 104]), g = ctx.createLinearGradient(xa, 0, xb, 0)
      g.addColorStop(0, base); g.addColorStop(0.55, h._rgb(L0.map(v => clamp01((v * 0.8 + 0.03) * C.tone)), [100, 98, 104])); g.addColorStop(1, 'rgb(8,8,12)')
      ctx.fillStyle = g; ctx.fill(); ctx.clip()
      for (let i = 2; i < lft.length; i += 4) {                            // strata and cracks in it
        const q = lft[i], w = rgt[i]; ctx.strokeStyle = `rgba(6,6,10,${(0.25 + 0.15 * ((i * 7) % 3)).toFixed(2)})`; ctx.lineWidth = lw
        ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.quadraticCurveTo((q[0] + w[0]) / 2, q[1] + (w[0] - q[0]) * 0.12, w[0], w[1]); ctx.stroke()
      }
      const gd = ctx.createLinearGradient(0, h._Y(C.T.y + 0.5, C.T.z - 1.0), 0, h._Y(C.T.y + 0.5, C.T.z - 4.5))      // the dark taking it
      gd.addColorStop(0, '#fff'); gd.addColorStop(0.55, '#3a3a3a'); gd.addColorStop(1, '#000')
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gd; ctx.fillRect(xa - 2, Math.min(ya, yb) - 2, xb - xa + 4, Math.abs(yb - ya) + 4)
      ctx.restore()
      void lv
    }
    // the step cut in its top
    const tp = C.top.map(q => h._P(q.x, q.y, q.z)); if (tp.some(q => !q)) continue
    const Lt = h.lightAt(C.T.x + 0.5, C.T.y + 0.5, C.T.z + 0.2, -1)
    ctx.beginPath(); tp.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath()
    if (C.T.pool) {                                                     // a pool held in the rock: dark water, its lip lit, a ring now and then
      ctx.fillStyle = h._rgb(Lt.map(v => clamp01(v * 0.9)), [96, 96, 104]); ctx.fill()
      const wp = C.top.map(q => h._P(C.T.x + 0.5 + (q.x - C.T.x - 0.5) * 0.8, C.T.y + 0.5 + (q.y - C.T.y - 0.5) * 0.8, q.z - 0.03)); if (wp.some(q => !q)) continue
      ctx.beginPath(); wp.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fillStyle = 'rgb(6,10,18)'; ctx.fill()
      ctx.strokeStyle = 'rgba(190,206,228,0.28)'; ctx.lineWidth = lw; ctx.stroke()
      const ph = ((h.t * 0.35 + C.T.x * 0.37) % 1), c0 = h._P(C.T.x + 0.5, C.T.y + 0.5, C.T.z - 0.03), kk = h._k(C.T.y + 0.5)
      if (c0) { ctx.strokeStyle = `rgba(200,214,232,${(0.35 * (1 - ph)).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(c0.x, c0.y, kk * 0.3 * ph, kk * 0.11 * ph, 0, 0, 6.3); ctx.stroke() }
      continue
    }
    ctx.fillStyle = h._rgb(Lt.map(v => clamp01(v * 1.02 * C.tone)), [104, 104, 110]); ctx.fill()
    ctx.strokeStyle = 'rgba(8,10,14,0.7)'; ctx.lineWidth = lw; ctx.stroke()
    ctx.strokeStyle = 'rgba(225,230,240,0.2)'; ctx.beginPath(); tp.slice(4, 9).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke()
  }
  // the water going up: a thread on the steps (its glints are the flow prop's)
  if (p.water) { const W = p.water.filter(q => Math.floor(q[1]) === r).map(q => h._P(q[0], q[1], q[2] + 0.01)); if (W.length > 1 && !W.some(q => !q)) { ctx.strokeStyle = 'rgba(70,82,100,0.9)'; ctx.lineWidth = Math.max(1, h._k(r + 0.5) * 0.05); ctx.beginPath(); W.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); ctx.strokeStyle = 'rgba(190,206,228,0.3)'; ctx.lineWidth = Math.max(1, h._k(r + 0.5) * 0.012); ctx.stroke() } }
  // the roots, winding down over the steps and round the rock
  for (const R of p.roots || []) for (let i = 0; i + 1 < R.length; i++) {
    const a = R[i], b = R[i + 1]; if (Math.floor((a[1] + b[1]) / 2) !== r) continue
    const A = h._P(a[0], a[1], a[2]), B = h._P(b[0], b[1], b[2]); if (!A || !B) continue
    const L = h.lightAt(a[0], a[1] + 0.3, a[2] + 0.2, -1), w = Math.max(1, h._k(a[1]) * (a[3] ?? 0.08))
    ctx.strokeStyle = h._rgb(L.map(v => clamp01(v * 0.95 + 0.04)), [104, 98, 90]); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke()
    if (w > 2) { ctx.strokeStyle = 'rgba(6,6,8,0.4)'; ctx.lineWidth = w * 0.3; ctx.beginPath(); ctx.moveTo(A.x + w * 0.3, A.y); ctx.lineTo(B.x + w * 0.3, B.y); ctx.stroke() }
  }
  ctx.restore()
}

// { type: 'harp', x, y (where its soundbox stands), z, rot (its turn from facing south), h, strings, wood }: an old harp of
// the Gaelic kind standing alone on a stone plinth, carved in dark oak, solid: a deep soundbox at the back, a heavy neck
// curving over to a beast's head, a bowed forepillar; brass pins along the neck; strings dull until they're played.
// Built as blocks in three dimensions and drawn face by face, the far ones first.
function buildHarp(p) {
  const H = (p.h ?? 2.3) / 2.3, th = p.rot ?? -0.6, c = Math.cos(th), s = Math.sin(th), z0 = (p.z ?? 0) + 0.24
  const gy = p.gy ?? p.y                                               // (p.y is the row it's drawn in: its front edge, so the floor before it doesn't cover its foot)
  const W = (u, v, w) => ({ x: p.x + u * c - w * s, y: gy + u * s + w * c, z: z0 + v * H })
  const faces = []
  const box = (C, rgb, part) => {
    const P = C.map(q => W(...q)), mid = P.reduce((a, q) => ({ x: a.x + q.x / 8, y: a.y + q.y / 8, z: a.z + q.z / 8 }), { x: 0, y: 0, z: 0 })
    for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) {
      const q = f.map(i => P[i]), e1 = { x: q[1].x - q[0].x, y: q[1].y - q[0].y, z: q[1].z - q[0].z }, e2 = { x: q[3].x - q[0].x, y: q[3].y - q[0].y, z: q[3].z - q[0].z }
      let n = { x: e1.y * e2.z - e1.z * e2.y, y: e1.z * e2.x - e1.x * e2.z, z: e1.x * e2.y - e1.y * e2.x }
      const fc = q.reduce((a, r) => ({ x: a.x + r.x / 4, y: a.y + r.y / 4, z: a.z + r.z / 4 }), { x: 0, y: 0, z: 0 })
      if (n.x * (fc.x - mid.x) + n.y * (fc.y - mid.y) + n.z * (fc.z - mid.z) < 0) n = { x: -n.x, y: -n.y, z: -n.z }
      const l = Math.hypot(n.x, n.y, n.z) || 1; faces.push({ q, n: { x: n.x / l, y: n.y / l, z: n.z / l }, c: fc, rgb, part })
    }
  }
  const beam = (pts, hh, hw, rgb, part) => {                           // a beam along a centre line in the (u, v) plane: half its depth hh, half its thickness hw
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ua, va] = pts[i], [ub, vb] = pts[i + 1], du = ub - ua, dv = vb - va, l = Math.hypot(du, dv) || 1, nu = -dv / l, nv = du / l
      box([[ua - nu * hh, va - nv * hh, -hw], [ub - nu * hh, vb - nv * hh, -hw], [ub + nu * hh, vb + nv * hh, -hw], [ua + nu * hh, va + nv * hh, -hw],
           [ua - nu * hh, va - nv * hh, hw], [ub - nu * hh, vb - nv * hh, hw], [ub + nu * hh, vb + nv * hh, hw], [ua + nu * hh, va + nv * hh, hw]], rgb, part)
    }
  }
  const cub = (a, b, c2, d, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, m = 1 - t; return [m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c2[0] + t * t * t * d[0], m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c2[1] + t * t * t * d[1]] })
  const wood = p.wood || [86, 60, 40], dark = wood.map(v => v * 0.8)
  // the pedestal: a low round drum of stone, a step round its foot
  const drum = (cu, R, v0, v1, rgb) => {
    const N = 18, ring = (v, r) => Array.from({ length: N }, (_, i) => { const a = i / N * Math.PI * 2; return W(cu + Math.cos(a) * r, v, Math.sin(a) * r) })
    const lo = ring(v0, R), hi = ring(v1, R), mid = W(cu, (v0 + v1) / 2, 0)
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, q = [lo[i], lo[j], hi[j], hi[i]], fc = q.reduce((a, r) => ({ x: a.x + r.x / 4, y: a.y + r.y / 4, z: a.z + r.z / 4 }), { x: 0, y: 0, z: 0 })
      const nx = fc.x - mid.x, ny = fc.y - mid.y, l = Math.hypot(nx, ny) || 1
      faces.push({ q, n: { x: nx / l, y: ny / l, z: 0 }, c: fc, rgb, part: 'plinth' })
    }
    const top = hi.slice(), tc = W(cu, v1, 0)
    faces.push({ q: top, n: { x: 0, y: 0, z: 1 }, c: tc, rgb: rgb.map(v => v * 1.08), part: 'plinth', top: true })
  }
  drum(0.95, 0.95, -0.3, -0.22, [92, 92, 98])
  drum(0.95, 0.84, -0.22, 0, [106, 106, 112])
  // the frame is a closed triangle, as a harp's is: the soundbox leaning back from its foot, the neck over the top, the
  // forepillar bowed a little out in front and coming down to meet the soundbox's foot. The strings run up from the
  // soundbox to the neck, fanning a little forward, so they fill the whole of it: long at the front, short at the back
  const SB = [1.0, 0.04], ST = [-0.12, 1.98], sl = Math.hypot(ST[0] - SB[0], ST[1] - SB[1]), du = (ST[0] - SB[0]) / sl, dv = (ST[1] - SB[1]) / sl, nu = dv, nv = -du      // (n: the soundbox's face, toward the strings)
  const sbc = (t, off) => [SB[0] + (ST[0] - SB[0]) * t + nu * off, SB[1] + (ST[1] - SB[1]) * t + nv * off]
  { const b0 = sbc(0, -0.18), b1 = sbc(0, 0.12), t0 = sbc(1, -0.11), t1 = sbc(1, 0.07)
    box([[b0[0], b0[1], -0.2], [b1[0], b1[1], -0.2], [t1[0], t1[1], -0.12], [t0[0], t0[1], -0.12], [b0[0], b0[1], 0.2], [b1[0], b1[1], 0.2], [t1[0], t1[1], 0.12], [t0[0], t0[1], 0.12]], wood, 'box') }     // the soundbox
  const neck = cub([-0.08, 2.06], [0.4, 1.66], [0.85, 1.72], [1.26, 2.16], 14)
  beam(neck, 0.11, 0.08, dark, 'neck')
  const fore = cub([1.26, 2.12], [1.46, 1.5], [1.38, 0.5], [1.06, 0.06], 16)
  beam(fore, 0.09, 0.1, wood, 'fore')
  box([[1.16, 2.14, -0.09], [1.44, 2.14, -0.09], [1.44, 2.36, -0.07], [1.16, 2.36, -0.07], [1.16, 2.14, 0.09], [1.44, 2.14, 0.09], [1.44, 2.36, 0.07], [1.16, 2.36, 0.07]], dark, 'head')   // the beast's head over the forepillar
  box([[0.86, 0, -0.16], [1.26, 0, -0.16], [1.24, 0.12, -0.15], [0.88, 0.12, -0.15], [0.86, 0, 0.16], [1.26, 0, 0.16], [1.24, 0.12, 0.15], [0.88, 0.12, 0.15]], wood.map(v => v * 0.85), 'foot')      // the foot, where the soundbox and the forepillar meet
  const NS = p.strings ?? 22, strings = []
  // (the neck's height at any point along it, taken between its samples: each string to its own place, evenly spaced,
  // straight up from the soundbox, each with its own tuning pin over it)
  const neckAt = (u) => { for (let i = 1; i < neck.length; i++) { const A = neck[i - 1], B = neck[i]; if (u <= B[0] || i === neck.length - 1) { const f = Math.max(0, Math.min(1, (u - A[0]) / ((B[0] - A[0]) || 1))); return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f] } } return neck[0] }
  const pins = []
  for (let i = 0; i < NS; i++) { const t = 0.03 + 0.9 * i / (NS - 1), a = sbc(t, 0.12), b = neckAt(a[0] + 0.03); strings.push([W(a[0], a[1], 0), W(b[0], b[1] - 0.11, 0)]); pins.push(W(b[0], b[1] + 0.02, 0.085)) }
  void gy
  const eye = W(1.4, 2.28, 0.06), knots = [0.2, 0.4, 0.6, 0.8].map(t => { const c2 = sbc(t, -0.03); return [W(c2[0] - 0.06, c2[1] - 0.06, -0.21), W(c2[0] + 0.06, c2[1] + 0.06, -0.21)] })
  return { faces, strings, pins, eye, knots }
}
export function drawHarp(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  if (!p._M) p._M = buildHarp(p)
  const M = p._M, C = h.cam, eye = { x: C.col, y: C.row + C.FL, z: C.z + C.gH * C.FL / C.k0 }
  const L = h.lightAt(p.x + 0.6, p.y + 0.5, (p.z ?? 0) + 1.2, -1), lv = Math.max(L[0], L[1], L[2]), LD = { x: -0.5, y: -0.35, z: 0.79 }
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  const dist = (f) => Math.hypot(f.c.x - eye.x, f.c.y - eye.y, f.c.z - eye.z)
  const under = (f) => f.part === 'plinth' ? 0 : 1                     // (the pedestal first, all of it: it is under the harp, and its big top face would sort wrong)
  const vis = M.faces.filter(f => f.n.x * (eye.x - f.c.x) + f.n.y * (eye.y - f.c.y) + f.n.z * (eye.z - f.c.z) > 0).sort((a, b) => under(a) - under(b) || dist(b) - dist(a))
  const lw = Math.max(1, k * 0.01)
  const mid = M.strings[M.strings.length >> 1][0], dS = Math.hypot(mid.x - eye.x, mid.y - eye.y, mid.z - eye.z)
  let drawn = false
  const strings = () => {
    drawn = true
    for (const [a, b] of M.strings) { const A = h._P(a.x, a.y, a.z), B = h._P(b.x, b.y, b.z); if (!A || !B) continue
      const lit = p.lit ?? 0, g = Math.max(0.4, lv) * (1 + lit * 0.6)                // (they brighten while it's played)
      ctx.strokeStyle = `rgba(${Math.min(255, 170 * g) | 0},${Math.min(255, 140 * g) | 0},${Math.min(255, 88 * g) | 0},${(0.6 + 0.35 * lit).toFixed(2)})`; ctx.lineWidth = Math.max(1, k * 0.007); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke() }
  }
  for (const f of vis) {
    if (!drawn && f.part !== 'plinth' && dist(f) < dS) strings()          // (the strings between the frame's far faces and its near ones)
    const S = f.q.map(q => h._P(q.x, q.y, q.z)); if (S.some(q => !q)) continue
    const sh = 0.45 + 0.6 * Math.max(0, f.n.x * LD.x + f.n.y * LD.y + f.n.z * LD.z)
    ctx.beginPath(); S.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath()
    ctx.fillStyle = h._rgb(L.map(v => clamp01((v * 1.1 + 0.04) * sh)), f.rgb); ctx.fill()
    ctx.strokeStyle = f.part === 'plinth' ? 'rgba(8,10,14,0.5)' : 'rgba(10,6,4,0.3)'; ctx.lineWidth = lw; ctx.stroke()
  }
  if (!drawn) strings()
  for (const q of M.pins) { const P = h._P(q.x, q.y, q.z); if (P) { ctx.fillStyle = `rgba(${200 * Math.max(0.5, lv) | 0},${160 * Math.max(0.5, lv) | 0},${80 * Math.max(0.5, lv) | 0},0.9)`; ctx.fillRect(P.x - 1, P.y - 1, Math.max(2, k * 0.025), Math.max(2, k * 0.025)) } }
  for (const [a, b] of M.knots) { const A = h._P(a.x, a.y, a.z), B = h._P(b.x, b.y, b.z); if (A && B) { ctx.strokeStyle = `rgba(210,180,130,${(0.3 * lv).toFixed(3)})`; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.moveTo(A.x, B.y); ctx.lineTo(B.x, A.y); ctx.stroke() } }
  { const E = h._P(M.eye.x, M.eye.y, M.eye.z); if (E) { ctx.fillStyle = 'rgba(10,8,6,0.9)'; ctx.beginPath(); ctx.arc(E.x, E.y, Math.max(1, k * 0.022), 0, 6.3); ctx.fill() } }
  ctx.restore()
}
