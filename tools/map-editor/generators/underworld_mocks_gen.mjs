// underworld_mocks_gen.mjs
// Location: tools/map-editor/generators/underworld_mocks_gen.mjs
//
// The underworld mockups: sixteen small maps for the hewn renderer (effects/hewnRock.js + hewnExtras.js),
// written to public/maps/cave/mock_*.json. Look at one with
//   ?scene=hewnTest&map=mock_well            (and &at=x,y to stand somewhere, &z=0.6 &look=0.12 for the camera,
//                                             &grade=teal|ember|etch|pixel for a screen grade)
//
//   node tools/map-editor/generators/underworld_mocks_gen.mjs
//
// Round one, from the reference pictures: arches, causeway, chasm, stacks, shaft, guardroom, spring, escher.
// Round two, the Otherworld: cats, bru, well, balor, sidhe, crypt, circle, crannog.

import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { createNoise2D } from 'simplex-noise'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/maps/cave')
mkdirSync(OUT_DIR, { recursive: true })

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

function scene(name, W, H, fill = '#', fz = 8, fm = 'r') {
  const S = { name, W, H, kind: [], z: [], mat: [], spans: [], lights: [], props: [], hex: [], falls: [], extra: {} }
  for (let y = 0; y < H; y++) { S.kind.push(new Array(W).fill(fill)); S.z.push(new Array(W).fill(fz)); S.mat.push(new Array(W).fill(fm)) }
  S.set = (x, y, k, z, m) => { if (x < 0 || y < 0 || x >= W || y >= H) return; S.kind[y][x] = k; S.z[y][x] = +(+z).toFixed(3); if (m) S.mat[y][x] = m }
  S.rect = (x0, y0, x1, y1, k, z, m) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) S.set(x, y, k, z, m) }
  S.light = (x, y, z, r, rgb, i = 1) => S.lights.push({ x, y, z, r, rgb, i })
  S.prop = (p) => S.props.push(p)
  S.deck = (x, y, z, t = 0.4, walk = 'deck') => S.spans.push({ x, y, z, t, walk })
  return S
}
function out(S, spawn) {
  const map = {
    name: S.name, width: S.W, height: S.H,
    layers: [Array.from({ length: S.H }, () => new Array(S.W).fill(0)), Array.from({ length: S.H }, () => new Array(S.W).fill(0))],
    legend: {}, spawns: { player: { x: spawn[0], y: spawn[1] } }, exits: {},
    hewn: { kind: S.kind.map(r => r.join('')), z: S.z, mat: S.mat.map(r => r.join('')), spans: S.spans, lights: S.lights, props: S.props, hex: S.hex, falls: S.falls, zones: [], ...S.extra },
  }
  writeFileSync(resolve(OUT_DIR, `${S.name}.json`), JSON.stringify(map))
  console.log(S.name, S.W + 'x' + S.H)
}

// 1 ── torchlit stair and arches (Ultima Underworld; the receding arches) ───────────────────
{
  const S = scene('mock_arches', 24, 34, '#', 5, 'm')
  for (let y = 0; y < 34; y++) for (let x = 0; x < 24; x++) S.z[y][x] = y >= 22 ? 5.5 : y >= 14 ? 7.5 : 8.5
  S.rect(10, 22, 13, 33, '.', 0, 'm')
  for (let y = 14; y <= 21; y++) S.rect(10, y, 13, y, '.', (22 - y) / 3, 'm')
  S.rect(10, 2, 13, 13, '.', 3, 'm')
  S.rect(9, 6, 9, 8, '.', 3, 'm'); S.rect(14, 9, 14, 10, '.', 3, 'm')            // side bays
  for (const [y, z0] of [[30, 0], [25.0, 0], [14, 3], [9, 3], [5, 3]]) {
    S.prop({ type: 'arch', x0: 10, x1: 14, y, z0, zs: z0 + 1.7, zt: z0 + 3.4, pier: 0.4 })
    if (y !== 9) for (const x of [10.2, 13.8]) { S.prop({ type: 'torch', x, y: y + 0.03, z: z0 + 1.55 }); S.light(x, y + 0.35, z0 + 1.7, 4.2, [255, 160, 80], 0.85) }
  }
  S.light(12, 2.6, 4.6, 9, [100, 165, 255], 1.1); S.light(11.5, 7, 4.4, 6, [90, 150, 240], 0.6)
  S.prop({ type: 'sprite', gid: 201, x: 10.45, y: 27.7, z: 0, s: 0.85 }); S.prop({ type: 'sprite', gid: 201, x: 13.45, y: 28.6, z: 0, s: 0.8 })
  S.prop({ type: 'sprite', gid: 473, x: 13.3, y: 23.6, z: 0, s: 0.7 })
  S.prop({ type: 'sprite', gid: 304, x: 9.5, y: 7.6, z: 3, s: 1.1 })
  out(S, [12, 31])
}

// 2 ── Clochán na bhFómhórach (the Causeway) ─────────────────────────────────────────────────
{
  const S = scene('mock_causeway', 28, 34, '.', -3, 'b')
  const rnd = rng(7), nz = createNoise2D(rnd)
  S.rect(0, 0, 27, 3, '#', 13, 'b'); S.rect(0, 4, 27, 5, '#', 8, 'b')
  S.rect(0, 27, 27, 33, '~', -1.6, 'r'); S.rect(21, 20, 27, 26, '~', -1.6, 'r')
  S.rect(12, 23, 13, 24, '.', 0, 'b')
  const r = 0.56, dx = 1.5 * r, dy = Math.sqrt(3) * r
  for (let i = 0; i * dx < 27; i++) for (let j = 0; j * dy < 31; j++) {
    const x = 0.6 + i * dx, y = 6 + j * dy + (i % 2 ? dy / 2 : 0)
    if (x > 11.5 && x < 14.5 && y > 22.5 && y < 25.5) continue
    let z = 4.8 - (y - 6) * 0.3 + nz(x * 0.25, y * 0.25) * 1.0 + (rnd() - 0.5) * 0.5 - Math.max(0, x - 17) * 0.3
    if (y > 21 && Math.abs(x - 13) < 4) z = Math.min(z, 0.4 + (rnd() - 0.5) * 0.5)
    if (z < -1.35) continue
    S.hex.push({ x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(2), r, base: -1.6, pool: rnd() < 0.22, lichen: z > 1.2 && rnd() < 0.7 })
  }
  S.extra = { ambient: [0.5, 0.53, 0.6], bg: ['#5f6f7c', '#9eacb4', '#c9d1d2'] }
  S.light(-6, 18, 9, 24, [255, 215, 170], 0.4)
  out(S, [12, 24])
}

// 3 ── the chasm walk (The Immortal) ─────────────────────────────────────────────────────────
{
  const S = scene('mock_chasm', 26, 26, 'v', 0, 'm')
  S.rect(0, 0, 25, 4, '#', 7, 'm')
  S.rect(1, 5, 24, 7, '.', 0, 'm')
  S.set(7, 7, 'v', 0); S.set(8, 7, 'v', 0); S.set(19, 7, 'v', 0)
  S.rect(10, 18, 15, 21, '.', 0, 'm'); S.rect(9, 22, 16, 25, '.', 0, 'm')
  for (let y = 8; y <= 17; y++) { S.deck(12, y, 0, 0.3); S.deck(13, y, 0, 0.3); S.set(12, y, 'v', 0, 'w'); S.set(13, y, 'v', 0, 'w') }
  for (const x of [4, 10, 16, 22]) { S.prop({ type: 'torch', x, y: 5.03, z: 1.7 }); S.light(x, 5.4, 1.9, 5, [140, 235, 230], 0.95) }
  S.prop({ type: 'box', kind: 'chest', x: 21.5, y: 6.2, z: 0, w: 0.6, d: 0.4, h: 0.38, col: [120, 84, 46] })
  S.prop({ type: 'sprite', gid: 473, x: 3.5, y: 6.4, z: 0, s: 0.75 })
  S.light(12.5, 12, -9, 14, [80, 200, 200], 0.9)
  S.extra = { drips: true, ambient: [0.07, 0.15, 0.16] }
  out(S, [12, 20])
}

// 4 ── the stacks (The Immortal: needles of rock over the dark) ─────────────────────────────
{
  const S = scene('mock_stacks', 26, 32, 'v', 0, 'c')
  const stack = (x0, y0, x1, y1, z) => S.rect(x0, y0, x1, y1, '.', z, 'c')
  stack(10, 24, 12, 26, 0); stack(10, 19, 12, 20, 1.0); stack(17, 18, 18, 20, 1.0)
  stack(12, 11, 14, 13, 3.0); stack(6, 15, 7, 16, 2.0); stack(4, 9, 4, 9, 4.5); stack(19, 8, 20, 9, 3.5); stack(9, 4, 10, 5, 6)
  stack(15, 2, 16, 3, 8); stack(2, 20, 3, 21, -1.5); stack(21, 24, 22, 25, -0.8)
  ;[[11, 23, 0.25], [11, 22, 0.5], [11, 21, 0.75]].forEach(([x, y, z]) => { S.deck(x, y, z, 0.25); S.mat[y][x] = 'w' })
  for (let x = 13; x <= 16; x++) { S.deck(x, 19, 1.0, 0.25); S.mat[19][x] = 'w' }
  for (const [x, y, z] of [[12, 18, 1.3], [12, 17, 1.6], [12, 16, 2.0], [12, 15, 2.3], [12, 14, 2.65]]) { S.deck(x, y, z, 0.25); S.mat[y][x] = 'w' }
  S.prop({ type: 'sprite', gid: 473, x: 13.4, y: 12.3, z: 3, s: 0.9 })
  for (const [x, y] of [[12.6, 12.8], [13.9, 11.6], [12.4, 11.5]]) S.prop({ x, y, z: 3, gid: 2381, s: 0.45 })
  S.light(13, 16, -10, 22, [255, 110, 45], 1.3); S.light(6, 22, -8, 14, [255, 90, 30], 0.8)
  S.prop({ type: 'shaft', x: 13, y: 12.2, z0: 3, z1: 18, w: 1.3, rgb: [200, 220, 255] })
  S.light(13, 12.2, 4.5, 6, [190, 210, 255], 0.9)
  S.extra = { drips: true, abyss: false, ambient: [0.05, 0.035, 0.03] }
  out(S, [11, 25])
}

// 5 ── the pale shaft (the cavern with the beast, the light from above, the green pool) ──────
{
  const S = scene('mock_shaft', 26, 30, '#', 9, 'c')
  const rnd = rng(3), nz = createNoise2D(rnd)
  for (let y = 0; y < 30; y++) for (let x = 0; x < 26; x++) {
    const d = Math.hypot((x + 0.5 - 13) / 10.5, (y + 0.5 - 15) / 12) + nz(x * 0.3, y * 0.3) * 0.08
    if (d < 1) S.set(x, y, '.', 0, 'c')
  }
  S.rect(12, 26, 13, 29, '.', 0, 'c')
  S.rect(9, 6, 17, 6, '.', 0.5, 'c'); S.rect(10, 3, 16, 5, '.', 1.1, 'c')
  for (let y = 0; y < 30; y++) for (let x = 0; x < 26; x++) if (Math.hypot((x + 0.5 - 12.5) / 4.6, (y + 0.5 - 15.5) / 2.4) < 1) S.set(x, y, '~', -0.25, 'g')
  S.prop({ type: 'shaft', x: 13, y: 4.4, z0: 1.1, z1: 17, w: 1.6, rgb: [235, 245, 195] })
  S.light(13, 4.5, 3, 13, [235, 245, 190], 1.3)
  S.light(12.5, 15.5, 0.6, 7, [120, 210, 90], 0.8)
  S.prop({ type: 'sprite', gid: 473, x: 13, y: 4.9, z: 1.1, s: 1.2 })
  for (const [x, y] of [[10.6, 7.6], [15.2, 8.1], [12.1, 9.3]]) S.prop({ x, y, z: 0, gid: 2381, s: 0.5 })
  let n = 0
  while (n < 34) {
    const x = 3 + rnd() * 20, y = 3 + rnd() * 24
    const c = Math.floor(x), r = Math.floor(y)
    if (S.kind[r][c] !== '.' || Math.abs(x - 13) < 1.6 && y > 18) continue
    if (Math.hypot((x - 12.5) / 5.5, (y - 15.5) / 3.2) < 1) continue
    S.prop({ type: 'mite', x, y, z: S.z[r][c], h: 0.5 + rnd() * 1.8, r: 0.15 + rnd() * 0.25 }); n++
  }
  S.extra = { drips: true, ambient: [0.06, 0.07, 0.065] }
  out(S, [13, 26])
}

// 6 ── a guardroom (the isometric room: pillars, torches, a door, a rack, a table) ───────────
{
  const S = scene('mock_guardroom', 22, 22, '#', 2.4, 'm')
  S.rect(5, 5, 16, 16, '.', 0, 'm')
  for (const [x, y] of [[8, 8], [13, 8], [8, 13], [13, 13]]) S.set(x, y, '#', 3.2, 'm')
  S.rect(10, 17, 11, 21, '.', 0, 'm')
  S.prop({ type: 'sprite', gid: 146, x: 10.5, y: 5.04, z: 0, s: 1.25 })
  for (const x of [7, 14]) { S.prop({ type: 'torch', x, y: 5.03, z: 1.5 }); S.light(x, 5.4, 1.6, 5, [255, 150, 70], 0.95) }
  for (const [x, y] of [[8.5, 9], [13.5, 14]]) { S.prop({ type: 'torch', x, y: y + 0.03, z: 1.6 }); S.light(x, y + 0.4, 1.7, 4.5, [255, 150, 70], 0.85) }
  S.prop({ type: 'sprite', gid: 253, x: 15.2, y: 5.7, z: 0, s: 1.1 })
  S.prop({ type: 'sprite', gid: 249, x: 6.8, y: 11.6, z: 0, s: 1.1 })
  S.prop({ type: 'box', kind: 'chest', x: 15.3, y: 15.4, z: 0, w: 0.7, d: 0.45, h: 0.45, col: [118, 80, 44] })
  for (const [x, y] of [[5.6, 15.5], [6.5, 15.7], [5.7, 14.6]]) S.prop({ type: 'sprite', gid: 201, x, y, z: 0, s: 0.8 })
  S.prop({ type: 'sprite', gid: 304, x: 10.5, y: 10.8, z: 0, s: 1.1 })
  S.extra = { ambient: [0.05, 0.04, 0.035] }
  out(S, [10, 16])
}

// 7 ── the green spring (the room with the dais, two stairs, the glowing basin, the chest) ───
{
  const S = scene('mock_spring', 22, 22, '#', 3, 'm')
  S.rect(4, 4, 17, 17, '.', 0, 'm')
  S.rect(4, 4, 17, 8, '.', 4 / 3, 'm'); S.rect(9, 9, 12, 10, '.', 4 / 3, 'm')
  for (const xs of [[6, 8], [13, 15]]) for (const [y, z] of [[9, 1], [10, 2 / 3], [11, 1 / 3]]) S.rect(xs[0], y, xs[1], y, '.', z, 'm')
  S.rect(4, 12, 7, 15, '.', 0.9, 'm'); S.rect(5, 13, 6, 14, '~', 0.55, 'g')
  S.light(5.9, 13.9, 1.2, 6.5, [110, 255, 140], 1.2)
  S.prop({ type: 'box', kind: 'chest', x: 13.6, y: 6.3, z: 4 / 3, w: 0.75, d: 0.5, h: 0.5, col: [150, 98, 50] })
  for (const [x, y, z, hh] of [[16.4, 13, 0, 1.0], [16.4, 6.5, 4 / 3, 1.0], [9.2, 5.5, 4 / 3, 1.0]]) {
    S.prop({ type: 'box', x, y, z, w: 0.36, d: 0.36, h: hh, col: [120, 112, 104] })
    S.prop({ type: 'torch', x, y: y + 0.2, z: z + hh + 0.25 }); S.light(x, y + 0.3, z + hh + 0.4, 5, [255, 210, 150], 0.9)
  }
  S.prop({ type: 'sprite', gid: 201, x: 16.2, y: 5.2, z: 4 / 3, s: 0.8 })
  S.prop({ type: 'box', x: 10.5, y: 15.2, z: 0, w: 1.0, d: 0.7, h: 0.02, col: [30, 30, 34] })
  S.extra = { ambient: [0.12, 0.09, 0.17] }
  out(S, [10, 16])
}

// 8 ── Escher's well (Relativity: galleries, arcades, flights at every level) ─────────────────
{
  const S = scene('mock_escher', 24, 30, '#', 9, 'm')
  S.rect(3, 12, 20, 27, '.', 0, 'm')
  S.rect(3, 3, 20, 9, '.', 3, 'm')
  for (let x = 3; x <= 20; x++) { S.set(x, 9, '.', 0, 'm'); S.deck(x, 9, 3, 0.5) }
  for (let y = 10; y <= 18; y++) for (const x of [5, 6, 17, 18]) S.set(x, y, '.', Math.max(0, 3 - (y - 9) / 3), 'm')
  for (let x = 7; x <= 16; x++) S.deck(x, 16, 2.4, 0.4)
  for (let x = 3; x <= 20; x++) S.deck(x, 13, 4.6, 0.4)
  S.rect(10, 19, 13, 23, 'v', 0)
  for (let x = 9; x <= 14; x++) S.deck(x, 21, 0, 0.35)
  S.rect(9, 0, 14, 2, '.', 6, 'm'); for (let y = 2; y >= 0; y--) S.rect(9, y, 14, y, '.', 3 + (3 - y), 'm')
  for (const [x0, x1] of [[7, 10.5], [10.5, 14], [14, 17.5]]) S.prop({ type: 'arch', x0, x1, y: 10, z0: 0, zs: 1.2, zt: 2.5, pier: 0.3 })
  S.extra = { ambient: [0.5, 0.49, 0.47], drips: true }
  S.light(11.5, 21, 4, 10, [255, 255, 240], 0.6)
  for (const x of [5.5, 17.5]) { S.prop({ type: 'torch', x, y: 9.03, z: 1.6 }) }
  out(S, [11, 25])
}

// ═════════════ second round: the Otherworld ═════════════════════════════════════════════════
const circle = (cx, cy, r, f) => { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) f(x, y) }

// 9 ── Uaimh na gCat: a souterrain with an ogham lintel, down into the cave of the cats ─────────
{
  const S = scene('mock_cats', 22, 36, '#', 9, 'c'), rnd = rng(11)
  S.rect(0, 23, 21, 35, '#', 2.4, 'd')
  S.rect(11, 24, 11, 35, '.', 0, 'd')
  for (const y of [33, 30, 27]) S.deck(11, y, 2.0, 0.4, 'under')
  S.prop({ type: 'ogham', horiz: true, x0: 11.05, x1: 11.95, y: 28.001, z: 1.8 })
  S.set(11, 23, '.', -0.5, 'c')
  S.rect(9, 22, 13, 22, '.', -1.0, 'c'); S.rect(8, 21, 14, 21, '.', -1.4, 'c'); S.rect(7, 19, 15, 20, '.', -1.8, 'c')
  S.rect(5, 14, 17, 18, '.', -2, 'c')
  S.rect(3, 5, 18, 13, '.', -2, 'c')
  for (let y = 5; y <= 18; y++) for (let x = 3; x <= 18; x++) if (S.kind[y][x] === '.' && rnd() < 0.25) S.z[y][x] = +(-2 + rnd() * 0.35).toFixed(2)
  S.rect(3, 6, 5, 12, '.', 0.4, 'c'); S.rect(16, 8, 18, 14, '.', 1.2, 'c'); S.set(15, 12, '.', -0.4, 'c')
  S.prop({ type: 'streak', x0: 8.5, x1: 13.5, y0: 5, y1: 6.2, z: -1.98, rgb: [255, 70, 30], a: 0.5, flicker: true })
  S.prop({ type: 'eyes', y: 5.0, x0: 3.2, x1: 18.8, z0: -1.2, z1: 4, count: 30, sep: 0.13 })
  S.prop({ type: 'eyes', y: 6.0, x0: 3.2, x1: 5.8, z0: -1.8, z1: 0.2, count: 4, sep: 0.13 })
  S.prop({ type: 'eyes', y: 8.0, x0: 16.1, x1: 18.8, z0: -1.6, z1: 1.0, count: 5, sep: 0.13 })
  for (const [x, y, z, f] of [[4.4, 9.6, 0.4, false], [17.2, 11.5, 1.2, true], [8.5, 15.8, -2, false], [13.4, 7.4, -2, true], [10.6, 12.2, -2, false]]) {
    S.prop({ type: 'mob', c: 14, r: 12, x, y, z, s: 0.75, flip: f })
    S.prop({ type: 'eyes', x: x + (f ? -0.08 : 0.08), y: y + 0.02, z: z + 0.45, sep: 0.07 })
  }
  for (const y of [7, 11, 15]) S.prop({ type: 'mist', y, x0: 3, x1: 18, z: -2, rgb: [150, 220, 190], a: 0.1, count: 7 })
  S.light(11, 5.6, -1.2, 7, [255, 80, 40], 1.2)
  S.light(10.5, 11, 3, 11, [110, 200, 170], 0.95)
  S.light(17, 10, 2.5, 3, [140, 230, 180], 0.4)
  S.extra = { ambient: [0.05, 0.085, 0.075], drips: true }
  out(S, [11, 33])
}

// 10 ── Brú na Bóinne: the passage, the sun down it at midwinter, the cross-shaped chamber ─────
{
  const S = scene('mock_bru', 24, 37, '#', 7, 'o')
  S.rect(0, 15, 23, 36, '#', 3.0, 'd')
  S.rect(11, 15, 12, 36, '.', 1, 'o')
  for (let y = 15; y <= 36; y++) { S.set(10, y, '#', 3.0, 'o'); S.set(13, y, '#', 3.0, 'o') }
  for (const y of [33, 29, 25, 21, 17]) for (const x of [11, 12]) S.deck(x, y, 3.0, 0.5, 'under')
  S.rect(9, 6, 14, 14, '.', 1, 'o')
  S.rect(5, 8, 8, 10, '.', 1, 'o'); S.rect(15, 8, 18, 10, '.', 1, 'o'); S.rect(10, 2, 13, 5, '.', 1, 'o')
  for (const [x, y] of [[6.5, 9.3], [16.5, 9.3], [11.5, 3.7]]) S.prop({ type: 'box', kind: 'basin', x, y, z: 1, w: 1.4, d: 0.9, h: 0.35, col: [150, 142, 126] })
  S.prop({ type: 'spiral', tri: true, x: 11.5, y: 2.001, z: 3.2, rad: 0.42, glow: [255, 214, 130] })
  S.prop({ type: 'spiral', x: 9.5, y: 6.001, z: 2.8, rad: 0.32 }); S.prop({ type: 'spiral', x: 14.5, y: 6.001, z: 2.8, rad: 0.32 })
  S.prop({ type: 'spiral', x: 9.5, y: 6.001, z: 4.3, rad: 0.25 }); S.prop({ type: 'spiral', x: 14.5, y: 6.001, z: 4.3, rad: 0.25 })
  S.prop({ type: 'streak', x0: 11.3, x1: 12.7, y0: 7.5, y1: 37, z: 1.01, rgb: [255, 200, 110], a: 0.32 })
  for (let y = 35; y >= 9; y -= 4) S.light(12, y, 1.5, 3.2, [255, 190, 100], 0.7)
  S.light(12, 8.5, 1.6, 5.5, [255, 205, 130], 1.3)
  S.light(11.5, 3.2, 3.2, 3, [255, 214, 130], 0.6)
  for (let y = 17; y <= 33; y += 3) S.prop({ type: 'mist', y, x0: 11, x1: 13, z: 1.3, rgb: [255, 210, 140], a: 0.07, count: 2 })
  S.prop({ type: 'mob', c: 10, r: 6, x: 11.6, y: 11.6, z: 1, s: 0.85, glow: [255, 220, 150] })
  for (const [dx, dz] of [[-0.45, 1.3], [0.45, 1.25], [-0.2, 1.6], [0.25, 1.55]]) S.prop({ type: 'mob', c: 15, r: 12, x: 11.6 + dx, y: 11.62, z: 1, s: 0.32, float: dz })
  S.extra = { ambient: [0.04, 0.035, 0.04] }
  out(S, [12, 31])
}

// 11 ── Tobar Segais: the well under the hazels, five streams going out from it ─────────────────
{
  const S = scene('mock_well', 26, 32, '#', 9, 'c'), cx = 12.5, cy = 9.5
  S.rect(2, 3, 23, 29, '.', 0, 'c')
  circle(cx, cy, 4.0, (x, y) => S.set(x, y, '.', 0.25, 'c'))
  for (const a of [Math.PI / 2, Math.PI * 0.82, Math.PI * 0.18, Math.PI, 0]) {
    for (let t = 3; t < 22; t += 0.3) {
      const x = Math.floor(cx + Math.cos(a) * t), y = Math.floor(cy + Math.sin(a) * t)
      if (x < 2 || x > 23 || y < 3 || y > 29) break
      S.set(x, y, '~', -0.45, 'g')
    }
  }
  circle(cx, cy, 3.1, (x, y) => S.set(x, y, '~', -0.35, 'g'))
  for (const [x, y] of [[12, 21], [12, 25]]) S.set(x, y, '.', 0, 'c')
  S.prop({ type: 'roots', x0: 8.5, x1: 16.5, y0: 5.5, y1: 13.5, z: 7, dz: 4.8, count: 90, nuts: true })
  S.prop({ type: 'fish', x: cx, y: cy, z: -0.35, rad: 2.3, count: 3 })
  for (const y of [8, 10, 12]) S.prop({ type: 'mist', y, x0: 9.5, x1: 15.5, z: -0.3, rgb: [220, 235, 170], a: 0.1, count: 3 })
  S.prop({ type: 'glowworms', x: 0, y: 2.999, x0: 2.5, x1: 23, z0: 1, z1: 8, n: 70 })
  S.prop({ type: 'mob', c: 11, r: 6, x: 16.2, y: 13.2, z: 0.25, s: 0.8, ghost: true, alpha: 0.6 })
  S.light(cx, cy, 0.6, 9, [200, 235, 130], 1.4)
  for (const a of [Math.PI / 2, Math.PI * 0.82, Math.PI * 0.18, Math.PI, 0]) for (let t = 5; t < 18; t += 3.5) S.light(cx + Math.cos(a) * t, cy + Math.sin(a) * t, 0.2, 2.6, [150, 235, 120], 0.55)
  S.light(cx, cy - 1, 6, 8, [230, 210, 130], 0.5)
  for (const [x, z] of [[6, 4], [19, 5]]) S.light(x, 3.4, z, 7, [80, 215, 185], 0.6)
  S.extra = { ambient: [0.065, 0.075, 0.06] }
  out(S, [10, 27])
}

// 12 ── Balor's hall under Tory: the eye in the wall, the giants at the lid, its gaze on the floor ─
{
  const S = scene('mock_balor', 26, 34, '#', 14, 'c'), rnd = rng(23)
  S.rect(2, 3, 23, 31, '.', 0, 'c')
  for (let q = 0; q < 14; q++) { const x = 3 + rnd() * 19, y = 7 + rnd() * 22, r = 0.8 + rnd() * 1.6; circle(x, y, r, (a, b) => { if (a >= 2 && a <= 23 && b >= 3 && b <= 31) S.set(a, b, '~', -0.3, 'c') }) }
  S.rect(12, 6, 13, 31, '.', 0.4, 'b')
  S.rect(8, 3, 17, 5, '.', 1.2, 'b')
  for (const [x, y] of [[5, 10], [20, 10], [5, 19], [20, 19], [5, 27], [20, 27]]) S.set(x, y, '#', 14, 'c')
  S.prop({ type: 'eye', x: 12.5, y: 3.0, z: 6.2, w: 8, open: 0.24 })
  S.prop({ type: 'streak', x0: 11.7, x1: 13.3, y0: 6, y1: 34, z: 0.41, rgb: [255, 40, 15], a: 0.28, flicker: true, fade: 'south' })
  S.prop({ type: 'mob', c: 14, r: 18, x: 9.6, y: 4.6, z: 1.2, s: 1.25 })
  S.prop({ type: 'mob', c: 15, r: 18, x: 15.4, y: 4.6, z: 1.2, s: 1.25, flip: true })
  S.prop({ type: 'mob', c: 9, r: 14, x: 10.9, y: 5.2, z: 1.2, s: 1.1 })
  S.prop({ type: 'mob', c: 9, r: 14, x: 14.1, y: 5.2, z: 1.2, s: 1.1, flip: true })
  S.prop({ type: 'box', x: 6.5, y: 23.5, z: -0.35, w: 0.8, d: 2.1, h: 0.32, col: [56, 42, 28] })
  S.light(12.5, 4.2, 5.6, 15, [255, 60, 30], 1.5)
  for (let q = 0; q < 6; q++) S.light(4 + rnd() * 18, 8 + rnd() * 22, 0.3, 4, [80, 170, 190], 0.5)
  S.extra = { ambient: [0.03, 0.055, 0.08], drips: true, grade: { palette: 'ember', px: 3, strength: 0, source: { x: 12.5, y: 5, r: 18 }, follow: 'eye' } }
  out(S, [12, 29])
}

// 13 ── the hall under the sídh: fires down the middle, the folk of the hill, the high seat ─────
{
  const S = scene('mock_sidhe', 24, 34, '#', 9, 'c')
  S.rect(4, 3, 19, 31, '.', 0, 'm')
  S.rect(8, 3, 15, 5, '.', 0.8, 'm'); S.rect(9, 6, 14, 6, '.', 0.4, 'm')
  for (const y of [10, 17, 24]) for (const x of [6, 17]) S.set(x, y, '#', 9, 'w')
  for (const y of [11.5, 18.5, 25.5]) for (const x of [8.4, 15.6]) S.prop({ type: 'box', x, y, z: 0, w: 0.55, d: 4.2, h: 0.35, col: [96, 68, 40] })
  for (const y of [24.5, 17.5, 10.5]) { S.prop({ type: 'embers', x: 12, y, z: 0 }); S.light(12, y, 0.7, 6, [255, 150, 70], 1.0) }
  S.prop({ type: 'cauldron', x: 13.7, y: 21.2, z: 0, r: 0.5, brew: [230, 190, 90] })
  S.prop({ type: 'box', x: 11.5, y: 3.8, z: 0.8, w: 1.3, d: 0.6, h: 1.1, col: [150, 108, 46] })
  S.prop({ type: 'mob', c: 8, r: 4, x: 11.2, y: 4.6, z: 0.8, s: 0.9, glow: [255, 220, 160] })
  S.prop({ type: 'mob', c: 13, r: 6, x: 12.4, y: 4.7, z: 0.8, s: 0.9, glow: [210, 230, 255] })
  S.prop({ type: 'box', kind: 'chest', x: 9.0, y: 4.3, z: 0.8, w: 0.7, d: 0.45, h: 0.45, col: [160, 120, 50] })
  S.prop({ type: 'box', kind: 'chest', x: 14.2, y: 4.3, z: 0.8, w: 0.7, d: 0.45, h: 0.45, col: [160, 120, 50] })
  const folk = [[10, 6, 9.4, 12.6], [11, 6, 7.4, 13.8], [12, 6, 9.3, 19.5], [10, 7, 15.0, 11.4], [13, 6, 16.6, 18.2], [11, 7, 14.9, 26.4], [12, 7, 7.5, 25.2], [8, 2, 10.6, 22.6]]
  folk.forEach(([c, r, x, y], q) => S.prop({ type: 'mob', c, r, x, y, z: 0, s: 0.82, glow: [200, 220, 255], flip: x > 12 }))
  for (const [x, y, z] of [[8, 14, 3.2], [16, 9, 3.6], [10, 21, 3.0], [15, 27, 2.6], [12, 7.5, 4]]) { S.prop({ type: 'mob', c: 0, r: 20, x, y, z, s: 0.32, float: 0, glow: [130, 230, 255] }); S.light(x, y, z, 3.5, [120, 220, 255], 0.5) }
  for (const y of [27, 20, 13]) S.prop({ type: 'mist', y, x0: 4.5, x1: 19.5, z: 0, rgb: [200, 215, 240], a: 0.08, count: 7 })
  S.light(11.5, 4.5, 3, 6.5, [255, 215, 150], 1.0)
  S.extra = { ambient: [0.05, 0.045, 0.06] }
  out(S, [12, 30])
}

// 14 ── the crypt under the abbey: the altar and its relics, the abbots, and older stone below ──
{
  const S = scene('mock_crypt', 22, 34, '#', 7, 'm')
  S.rect(8, 3, 13, 31, '.', 0, 'm')
  for (const y0 of [8, 15, 22]) { S.rect(5, y0, 7, y0 + 2, '.', 0, 'm'); S.rect(14, y0, 16, y0 + 2, '.', 0, 'm') }
  for (const y of [7, 14, 21, 28]) S.prop({ type: 'arch', x0: 8, x1: 14, y, z0: 0, zs: 2.2, zt: 3.9, pier: 0.4 })
  for (const y0 of [8, 15, 22]) for (const x of [6.0, 15.0]) S.prop({ type: 'box', x, y: y0 + 1.2, z: 0, w: 1.0, d: 1.9, h: 0.55, col: [116, 110, 100] })
  S.prop({ type: 'box', x: 10.5, y: 4.0, z: 0, w: 2.4, d: 0.8, h: 0.9, col: [150, 140, 122] })
  S.prop({ type: 'box', x: 10.5, y: 3.95, z: 0.9, w: 0.45, d: 0.3, h: 0.32, col: [210, 165, 60] })
  S.prop({ type: 'candles', x: 9.6, y: 4.1, z: 0.9, w: 0.8, count: 5 }); S.prop({ type: 'candles', x: 11.4, y: 4.1, z: 0.9, w: 0.8, count: 5 })
  S.light(10.5, 4.6, 1.6, 6.5, [255, 190, 110], 1.2)
  S.rect(10, 15, 11, 18, '.', -2.4, 'c'); S.set(10, 15, '#', -0.7, 'c')
  S.prop({ type: 'ogham', x: 10.12, y: 16.001, z0: -2.3, z1: -0.8, glow: [120, 235, 210] })
  S.light(10.6, 16.6, -1.6, 4.5, [80, 215, 190], 1.1)
  S.prop({ type: 'shaft', x: 12.4, y: 24.4, z0: 0, z1: 9, w: 0.55, rgb: [170, 190, 255] })
  S.light(12.4, 24.5, 1, 4, [160, 180, 255], 0.7)
  S.prop({ type: 'mob', c: 0, r: 4, x: 9.0, y: 22.6, z: 0, s: 0.85, ghost: true })
  S.prop({ type: 'mob', c: 1, r: 4, x: 12.8, y: 10.6, z: 0, s: 0.85, ghost: true, flip: true })
  S.prop({ type: 'mob', c: 2, r: 16, x: 15.4, y: 16.9, z: 0.55, s: 0.6 })
  S.extra = { ambient: [0.04, 0.04, 0.055] }
  out(S, [10, 30])
}

// 15 ── the gilded stone: a ring of twelve in a cavern, the moon down on the thirteenth ─────────
{
  const S = scene('mock_circle', 28, 32, '#', 10, 'c'), cx = 13.5, cy = 13
  S.rect(2, 2, 25, 29, '.', 0, 'c')
  circle(cx, cy, 9.2, (x, y) => { if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > 8.2) S.set(x, y, '.', 0.35, 'c') })
  for (const [x, y] of [[13, 21], [14, 21], [13, 22], [14, 22]]) S.set(x, y, '.', 0, 'c')
  for (let q = 0; q < 12; q++) {
    const a = q / 12 * Math.PI * 2 + 0.13, x = cx + Math.cos(a) * 5.6, y = cy + Math.sin(a) * 4.6, ht = 1.7 + ((q * 7) % 5) * 0.18
    S.prop({ type: 'box', x, y, z: 0, w: 0.55, d: 0.38, h: ht, col: [128, 126, 120] })
    S.prop({ type: 'ogham', x: x - 0.24, y: y + 0.191, z0: 0.15, z1: ht - 0.1 })
    if (q === 1 || q === 5 || q === 10) S.prop({ type: 'mob', c: 17, r: 12, x, y: y + 0.01, z: ht, s: 0.5, flip: q === 5 })
  }
  S.prop({ type: 'box', x: cx, y: cy, z: 0, w: 0.8, d: 0.6, h: 3.0, col: [215, 172, 70] })
  S.prop({ type: 'mob', c: 9, r: 2, x: cx + 0.1, y: cy + 1.4, z: 0, s: 0.85 })
  S.prop({ type: 'shaft', x: cx, y: cy + 0.35, z0: 0, z1: 16, w: 1.1, rgb: [190, 210, 255] })
  for (let y = 9; y <= 21; y += 3) S.prop({ type: 'mist', y, x0: 3, x1: 24, z: 0, rgb: [190, 200, 225], a: 0.1, count: 8 })
  S.light(cx, cy + 0.5, 6, 11, [170, 190, 255], 1.0)
  S.light(cx, cy + 0.8, 1.5, 3.5, [255, 205, 110], 0.7)
  S.extra = { ambient: [0.03, 0.035, 0.05] }
  out(S, [13, 27])
}

// 16 ── the crannóg on the black lake: a causeway of logs, a palisade, a fire, lights on the water ─
{
  const S = scene('mock_crannog', 28, 36, '~', -0.5, 'c'), cx = 13.5, cy = 10.5
  S.rect(0, 0, 27, 1, '#', 12, 'c'); S.rect(0, 0, 1, 35, '#', 12, 'c'); S.rect(26, 0, 27, 35, '#', 12, 'c')
  S.rect(2, 29, 25, 35, '.', 0, 'c')
  circle(cx, cy, 4.6, (x, y) => S.set(x, y, '.', 0.3, 'c'))
  for (let y = 15; y <= 28; y++) for (const x of [13, 14]) { S.deck(x, y, 0.15, 0.25); S.mat[y][x] = 'w' }
  for (let q = 0; q < 46; q++) {
    const a = q / 46 * Math.PI * 2
    if (Math.abs(a - Math.PI / 2) < 0.2) continue
    S.prop({ type: 'mite', x: cx + Math.cos(a) * 4.15, y: cy + Math.sin(a) * 4.15, z: 0.3, h: 0.9 + (q % 3) * 0.15, r: 0.1, tone: [120, 88, 54] })
  }
  S.prop({ type: 'box', x: cx, y: 9.4, z: 0.3, w: 3.0, d: 2.4, h: 1.3, col: [118, 94, 58] })
  S.prop({ type: 'box', x: cx, y: 9.4, z: 1.6, w: 2.0, d: 1.5, h: 0.55, col: [140, 112, 62] })
  S.prop({ type: 'box', x: cx, y: 10.61, z: 0.3, w: 0.5, d: 0.02, h: 0.85, col: [22, 16, 10] })
  S.prop({ type: 'embers', x: 15.9, y: 12.6, z: 0.3 }); S.light(15.9, 12.6, 0.9, 7, [255, 145, 70], 1.2)
  S.prop({ type: 'mob', c: 1, r: 4, x: 13.0, y: 14.3, z: 0.3, s: 0.8 })
  S.prop({ type: 'box', x: 15.7, y: 24.2, z: -0.45, w: 0.7, d: 2.0, h: 0.33, col: [50, 38, 26] })
  for (const [x, y, z] of [[6, 18, 0.7], [21, 14, 0.9], [7.5, 7.5, 1.1], [20.5, 23, 0.6], [4.5, 25, 0.8]]) { S.prop({ type: 'mob', c: 0, r: 20, x, y, z, s: 0.3, float: 0, glow: [140, 235, 255] }); S.light(x, y, z, 3.2, [120, 220, 255], 0.55) }
  S.prop({ type: 'fish', x: 7.5, y: 21.5, z: -0.5, rad: 2.0, count: 2, rgb: [60, 70, 55] })
  for (let y = 15; y <= 27; y += 3) S.prop({ type: 'mist', y, x0: 2, x1: 25, z: -0.5, rgb: [180, 200, 215], a: 0.1, count: 7 })
  S.extra = { ambient: [0.04, 0.05, 0.065] }
  out(S, [13, 31])
}
