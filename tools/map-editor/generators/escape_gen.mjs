// escape_gen.mjs
// Location: tools/map-editor/generators/escape_gen.mjs
//
// The escape from the underworld: the ghost's climb from the Well of Segais up to the source of the Boyne, for the
// hewn renderer (effects/hewnRock.js + hewnExtras.js) and the escape scene (scenes/locations/cave/escape.js).
// Writes public/maps/cave/escape_*.json:
//
//   escape_tobar       Tobar Segais: Géaga over the well, five streams; the north one is the way out, behind her roots
//   escape_doimhne     the deeps: a long climb beside a stream that runs uphill; strong ghouls; a púca in a snare
//   escape_gailearai   the galleries: floors over floors, water running up the walls; a door west goes astray
//   escape_balor       astray: Balor's hall, his eye in the wall, his guards (deadly; beaten, you wake at the well)
//   escape_sidh        the hall under the hill: the folk at their fires; a púca caught dancing in a ring
//   escape_droichead   the crossing: bridges over the dark, roots from above; many ghouls, weaker, quick to run
//   escape_foinse      the source of the Boyne: the spring, the last stair, the night sky
//
//   node tools/map-editor/generators/escape_gen.mjs
//   ?scene=escape                           starts at the well;  &map=escape_sidh  any stage;  &at=x,y  a tile
//
// Each map's `escape` block (read by escape.js):
//   ways     [{ x0, y0, x1, y1, to, at: [x, y] }]       step into the box: you go to map `to`, standing at `at`
//   packs    [{ x0, y0, x1, y1, spots: [[x, y]], foe }]  step into the box: ghouls come at you from the spots (once)
//   npcs     [{ id, x, y, kind }]                        who is here (their words: public/data/underworld/escape.js)
//   gate     { tiles: [[x, y]], note }                   no way through until the note is set (Géaga's roots)
//   watchers N, foe                                      eyes in the dark while you stand still, and what they are
//   wake     { map, at }                                 beaten here, you wake there (default: where you came in)
//   end      true                                        the last map: the way out is the end of the escape
//
// Every map is checked when it is written: from where you start, every way, every pack's spots and every npc must be
// reachable by the scene's own rule (a step up or down of at most STEP; a diagonal may not cut a corner).

import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { createNoise2D } from 'simplex-noise'
import { courses, cellAt, cellGeom, ptAt } from '../../../js/game/effects/floorStones.mjs'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/maps/cave')
mkdirSync(OUT_DIR, { recursive: true })
const STEP = 0.55

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const q3 = (z) => Math.round(z * 3) / 3                    // heights in thirds of a tile: every riser a real step
const lerp = (a, b, t) => a + (b - a) * t

function scene(name, W, H, fill = '#', fz = 8, fm = 'r') {
  const S = { name, W, H, kind: [], z: [], mat: [], spans: [], lights: [], props: [], hex: [], falls: [], zones: [], extra: {}, esc: { ways: [], packs: [], npcs: [] } }
  for (let y = 0; y < H; y++) { S.kind.push(new Array(W).fill(fill)); S.z.push(new Array(W).fill(fz)); S.mat.push(new Array(W).fill(fm)) }
  S.in = (x, y) => x >= 0 && y >= 0 && x < W && y < H
  S.set = (x, y, k, z, m) => { if (!S.in(x, y)) return; S.kind[y][x] = k; S.z[y][x] = +(+z).toFixed(3); if (m) S.mat[y][x] = m }
  S.rect = (x0, y0, x1, y1, k, z, m) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) S.set(x, y, k, z, m) }
  S.light = (x, y, z, r, rgb, i = 1) => S.lights.push({ x, y, z, r, rgb, i })
  S.prop = (p) => S.props.push(p)
  S.deck = (x, y, z, t = 0.4, walk = 'deck', hid = false) => S.spans.push({ x, y, z: +(+z).toFixed(3), t, walk, ...(hid ? { hid: true } : {}) })
  return S
}

const circle = (cx, cy, r, f) => { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) f(x, y) }

// a floor of rounded, ragged outline: an ellipse (cx, cy, rx, ry) at height z, its edge roughened by noise
function cavern(S, cx, cy, rx, ry, z, m = 'c', nz = null, rough = 0.12) {
  for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + (nz ? nz(x * 0.27, y * 0.27) * rough : 0)
    if (d < 1) S.set(x, y, '.', z, m)
  }
}

// a passage along a line of points [x, y, z]: `w` wide, its floor rising (or falling) from point to point. Each tile
// takes the height of the point on the line nearest it, so a slope is a stair with a riser on every row (keep slopes
// to under STEP a tile). Only rock is cut, unless keep is false; what is already floor is left as it is.
function passage(S, pts, w, m = 'c', { keep = true } = {}) {
  const best = new Map()
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1]
    const L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1
    for (let y = Math.floor(Math.min(ay, by) - w); y <= Math.ceil(Math.max(ay, by) + w); y++) for (let x = Math.floor(Math.min(ax, bx) - w); x <= Math.ceil(Math.max(ax, bx) + w); x++) {
      if (!S.in(x, y)) continue
      const px = x + 0.5, py = y + 0.5
      const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L2))
      const d = Math.hypot(px - lerp(ax, bx, t), py - lerp(ay, by, t))
      if (d > w / 2) continue
      const k = y * S.W + x, o = best.get(k)
      if (o && o.d <= d) continue
      if (!o && keep && S.kind[y][x] === '.') continue
      best.set(k, { d, x, y, z: lerp(az, bz, t) })
    }
  }
  for (const { x, y, z } of best.values()) S.set(x, y, '.', Math.round(z * 100) / 100, m)
}

// a stream along a line of points [x, y, z]: water laid only in rock beside the way (never across it), its surface at
// z. Where it climbs more than a step it runs UP a little fall of its own (z0 below, z1 above).
function stream(S, pts, w = 1.2, m = 'p') {
  let last = null
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1]
    const L = Math.max(1, Math.hypot(bx - ax, by - ay)), n = Math.ceil(L * 4)
    for (let s = 0; s <= n; s++) {
      const t = s / n, x = lerp(ax, bx, t), y = lerp(ay, by, t), z = q3(lerp(az, bz, t))
      circle(x, y, w / 2, (cx, cy) => { if (S.in(cx, cy) && S.kind[cy][cx] === '#') S.set(cx, cy, '~', z, m) })
      if (last && z > last.z + 0.3) S.falls.push({ x0: x - 0.45, x1: x + 0.45, y: Math.floor(y) + 1, z0: last.z - 0.1, z1: z + 0.05 })
      last = { z }
    }
  }
}

// walls round everything: rock at `rz` where it is still rock, so the hall reads as cut from it
function walls(S, rz) { for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (S.kind[y][x] === '#') S.z[y][x] = Math.max(S.z[y][x], rz) }

// rock beside a floor rises higher the further from it (so the walls are cliffs, not curbs)
function cliffs(S, base, per = 1.2, top = 14) {
  const d = Array.from({ length: S.H }, () => new Array(S.W).fill(99))
  const q = []
  for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (S.kind[y][x] !== '#') { d[y][x] = 0; q.push([x, y]) }
  while (q.length) {
    const [x, y] = q.shift()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (!S.in(nx, ny) || d[ny][nx] <= d[y][x] + 1) continue
      d[ny][nx] = d[y][x] + 1; q.push([nx, ny])
    }
  }
  for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (S.kind[y][x] === '#') {
    let near = -Infinity
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (S.in(nx, ny) && S.kind[ny][nx] !== '#') near = Math.max(near, S.z[ny][nx]) }
    const b = near === -Infinity ? base : near
    S.z[y][x] = +Math.min(b + top, b + 3.5 + d[y][x] * per).toFixed(2)
  }
}

// a bridge over the void: the box x0..x1, y0..y1, its deck rising from zA at one end to zB at the other (along x or y);
// laid only where there is nothing (what is already floor stays floor)
function bridge(S, x0, x1, y0, y1, zA, zB, along = 'y') {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!S.in(x, y) || S.kind[y][x] !== 'v') continue
    const t = along === 'y' ? (y1 === y0 ? 0 : (y - y0) / (y1 - y0)) : (x1 === x0 ? 0 : (x - x0) / (x1 - x0))
    S.mat[y][x] = 'w'; S.deck(x, y, q3(lerp(zA, zB, t)), 0.3)
  }
}

// ── checking a map: can you get from the start to everything? ──────────────────────────────────
function walkZ(S, x, y) {
  if (!S.in(x, y)) return null
  const s = S.spans.find(o => o.x === x && o.y === y)
  if (S.block && S.block.some(([bx, by]) => bx === x && by === y) && !(s && s.walk === 'deck')) return null
  if (s) return s.walk === 'deck' ? s.z : (S.kind[y][x] === '.' ? S.z[y][x] : null)
  return S.kind[y][x] === '.' ? S.z[y][x] : null
}
function reach(S, from, blocked = new Set()) {
  const W = S.W, seen = new Uint8Array(W * S.H), q = [from]
  const wz = (x, y) => (blocked.has(x + ',' + y) ? null : walkZ(S, x, y))
  if (wz(...from) == null) return seen
  seen[from[1] * W + from[0]] = 1
  while (q.length) {
    const [x, y] = q.pop(), a = wz(x, y)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const nx = x + dx, ny = y + dy
      if (!S.in(nx, ny) || seen[ny * W + nx]) continue
      const b = wz(nx, ny)
      if (b == null || Math.abs(b - a) > STEP) continue
      if (dx && dy) {
        let ok = true
        for (const [cx, cy] of [[nx, y], [x, ny]]) { const m = wz(cx, cy); if (m == null || Math.abs(m - a) > STEP || Math.abs(m - b) > STEP) ok = false }
        if (!ok) continue
      }
      seen[ny * W + nx] = 1; q.push([nx, ny])
    }
  }
  return seen
}

function out(S, spawn) {
  const E = S.esc
  const all = reach(S, spawn)
  const at = (x, y) => all[Math.floor(y) * S.W + Math.floor(x)]
  const bad = []
  for (const w of E.ways) { let any = false; for (let y = w.y0; y <= w.y1; y++) for (let x = w.x0; x <= w.x1; x++) if (at(x, y)) any = true; if (!any) bad.push('way to ' + w.to) }
  for (const p of E.packs) { for (const [x, y] of p.spots) if (!at(x, y)) bad.push(`pack spot ${x},${y}`) }
  for (const n of E.npcs) if (n.reach !== false && !at(n.x, n.y + 1) && !at(n.x, n.y) && !at(n.x - 1, n.y) && !at(n.x + 1, n.y)) bad.push('npc ' + n.id)
  if (E.gate) {   // with the gate shut, the way past it must be shut too (else the roots are only for show)
    const shut = reach(S, spawn, new Set(E.gate.tiles.map(([x, y]) => x + ',' + y)))
    for (const w of E.ways.filter(w => w.pastGate)) for (let y = w.y0; y <= w.y1; y++) for (let x = w.x0; x <= w.x1; x++) if (shut[y * S.W + x]) bad.push('gate leaks to ' + w.to)
  }
  if (bad.length) { console.error(`${S.name}: NOT REACHABLE: ${bad.join('; ')}`); process.exitCode = 1 }
  // every way on glows a little, so it is found by looking, not by feeling along the walls (astray stays dark)
  for (const w of E.ways) {
    if (w.dark) continue
    const x = (w.x0 + w.x1 + 1) / 2, y = (w.y0 + w.y1 + 1) / 2, z = (walkZ(S, Math.floor(x), Math.floor(y)) ?? 0) + 1.6
    S.lights.push({ x, y, z, r: 5, rgb: [175, 205, 255], i: 0.65 })
  }
  let n = 0; for (const v of all) n += v
  const map = {
    name: S.name, width: S.W, height: S.H,
    layers: [Array.from({ length: S.H }, () => new Array(S.W).fill(0)), Array.from({ length: S.H }, () => new Array(S.W).fill(0))],
    legend: {}, spawns: { player: { x: spawn[0], y: spawn[1] } }, exits: {},
    hewn: { kind: S.kind.map(r => r.join('')), z: S.z, mat: S.mat.map(r => r.join('')), spans: S.spans, lights: S.lights, props: S.props, hex: S.hex, falls: S.falls, zones: S.zones, ...(S.block ? { block: S.block } : {}), ...S.extra },
    escape: { ...E, ways: E.ways.map(({ pastGate, dark, ...w }) => w), npcs: E.npcs.map(({ reach, ...n }) => n) },
  }
  writeFileSync(resolve(OUT_DIR, `${S.name}.json`), JSON.stringify(map))
  console.log(`${S.name} ${S.W}x${S.H}, ${n} tiles walkable from the start${bad.length ? '' : ', all reachable'}`)
}

// ═════════════ 1. Tobar Segais: the antechamber ═══════════════════════════════════════════════
// A built hall round the well under the hazel. The well is a wide oval pool, its water level with a broad engraved
// rim, two steps all round going up to it. Five streams go out of it, winding over the floor: west, north-west,
// north-east and east to the shut gates of the realms they lead to (each gatehouse its own stone, light, statues and
// sigil: walk up to one and it tells you where it goes), and north to the way up -- its gatehouse fortified like the
// rest, but open, its portcullis raised -- where the stream climbs a crafted stair, behind Géaga's roots until she
// looks away. The dead who came before you wait about the hall.
{
  const S = scene('escape_tobar', 42, 50, '#', 10, 'c')
  const cx = 21.5, cy = 26.5, RX = 5.5, RY = 4.3                 // the pool: its middle, and its water's half-widths
  const RIM = 1.3, STEP = 1.0, ZR = 0.75                         // the rim's width and height; each step's width
  const e = (x, y, g) => Math.hypot((x + 0.5 - cx) / (RX + g), (y + 0.5 - cy) / (RY + g))
  // the hall: dressed stone, its corners cut
  for (let y = 10; y <= 45; y++) for (let x = 4; x <= 37; x++) {
    const dx = Math.max(0, Math.abs(x + 0.5 - 21) - 11), dy = Math.max(0, Math.abs(y + 0.5 - 27.5) - 12)
    if (Math.hypot(dx, dy) < 6.5) S.set(x, y, '.', 0, 'm')
  }
  // the pool, a round dais: two steps up and the rim, all of them ovals painted by the pool prop (hewnExtras.js). The
  // tiles under them are flat floor; you climb the steps by hidden decks at each step's height. The water is a hole
  // (its tiles not walked on), and the salmon swim in it.
  S.block = []
  const RINGS = [{ g: RIM + 2 * STEP, z: 0.25 }, { g: RIM + STEP, z: 0.5 }, { g: RIM, z: ZR }]
  for (let y = 10; y <= 45; y++) for (let x = 4; x <= 37; x++) {
    const water = e(x, y, -0.15) < 1
    if (water) { S.block.push([x, y]); continue }
    for (const R of [...RINGS].reverse()) if (e(x, y, R.g) < 1) { S.deck(x, y, R.z, 0.2, 'deck', true); break }
  }
  S.extra.ripples = false

  // the stones of the floor that are raised (the gates' stairs, the standing stones): which stone is which is floorStones.mjs's
  const ART = { cx, cy, rx: RX, ry: RY, g0: RIM + 2 * STEP }, CO = courses(ART), raised = new Map()
  const lift = (x, y, z) => { const c = cellAt(ART, x, y, CO); if (c) raised.set(c.n + ',' + c.j, { ...c, z }) }
  const zAt = (x, y) => { const c = cellAt(ART, x, y, CO); return c ? (raised.get(c.n + ',' + c.j)?.z ?? 0) : 0 }

  // the gatehouses. Three on the north wall (north-west, the open way north, north-east), one in each side wall
  const G = {
    nw: { id: 'gate_fomor',  x: 10, mat: 'b', stone: [96, 94, 100],  light: [255, 70, 40],  sigil: 'eye',    statue: 'giant',   door: [34, 24, 22], red: true },
    ne: { id: 'gate_sidh',   x: 32, mat: 'w', stone: [214, 176, 104], light: [255, 205, 120], sigil: 'spiral', statue: 'harper',  door: [120, 88, 34] },
    w:  { id: 'gate_donn',   y: 38, mat: 'o', sea: 'escape_donn', stone: [200, 202, 210], light: [215, 225, 255], sigil: 'mound',  statue: 'mourner', door: [58, 52, 48], candles: true },
    e:  { id: 'gate_tethra', y: 26, mat: 'd', stone: [150, 178, 172], light: [90, 210, 200],  sigil: 'wave',   statue: 'selkie',  door: [44, 52, 50], drip: true },
  }
  const merlons = (x0, x1, y, z, col) => { for (let x = x0 + 0.2; x < x1; x += 0.65) S.prop({ type: 'box', x, y, z, w: 0.3, d: 0.3, h: 0.42, col }) }
  const north = (g, open) => {                                   // a gatehouse in the north wall, door x-1..x+1 (or the open way)
    const x0 = g.x - 1, x1 = g.x + 1, dark = g.stone.map(v => v * 0.55 | 0)
    if (!open) {
      S.rect(x0, 8, x1, 9, '.', 0, 'm')
      S.rect(x0, 7, x1, 7, '#', 4.6, g.mat)
      S.prop({ type: 'arch', x0, x1: x1 + 1, y: 8, z0: 0, zs: 1.8, zt: 3.1, pier: 0.35 })
      S.prop({ type: 'box', x: g.x + 0.5, y: 8.03, z: 0.5, w: 2.1, d: 0.05, h: 2.1, col: g.door })
      S.prop({ type: 'grille', x0: g.x - 0.45, x1: g.x + 1.45, y: 8.06, z0: 0, z1: 0.5 })
      S.prop({ type: 'sigil', kind: g.sigil, x: g.x + 0.5, y: 8.0, z: 3.85, r: 0.55, rgb: g.light })
      merlons(x0, x1 + 1, 7.85, 4.6, dark)
      if (g.red) S.prop({ type: 'streak', x0: g.x - 0.8, x1: g.x + 1.8, y0: 8.05, y1: 10.2, z: 0.01, rgb: [255, 50, 20], a: 0.35, flicker: true, fade: 'south' })
      S.light(g.x + 0.5, 10, 2.4, 5, g.light, 0.9)
      S.esc.npcs.push({ id: g.id, x: g.x + 0.5, y: 9.6, kind: 'gate', radius: 2.8, sigil: g.sigil, rgb: g.light })
    }
    for (const tx of [g.x - 2, g.x + 2]) { S.rect(tx, 7, tx, 9, '#', 6, g.mat); merlons(tx, tx + 1, 9.82, 6, dark); if (!zAt(tx + 0.5, 10.62)) S.set(tx, 10, '#', 0.6, g.mat) }
    for (const [tx, f] of [[g.x - 2, false], [g.x + 2, true]]) S.prop({ type: 'statue', kind: g.statue, x: tx + 0.5, y: 10.62, z: zAt(tx + 0.5, 10.62) || 0.6, s: 2.7, stone: g.stone, flip: f })
  }
  const side = (g, west) => {                                     // a gatehouse in a side wall: seen edge-on
    if (g.sea) return seaDoor(g)
    const wx = west ? 2 : 39, ax = west ? 3 : 38, tx0 = west ? 2 : 37, tx1 = west ? 4 : 39, px = west ? 5 : 36, dark = g.stone.map(v => v * 0.55 | 0)
    S.rect(wx, g.y - 1, wx, g.y + 1, '#', 4.6, g.mat)
    S.rect(ax, g.y - 1, ax, g.y + 1, '.', 0, 'm')
    for (const ty of [g.y - 3, g.y - 2, g.y + 2, g.y + 3]) S.rect(tx0, ty, tx1, ty, '#', 6, g.mat)
    for (const ty of [g.y - 2, g.y + 3]) merlons(tx0, tx1 + 1, ty + 0.82, 6, dark)
    S.prop({ type: 'box', x: west ? 3.04 : 37.96, y: g.y + 0.5, z: 0.4, w: 0.06, d: 2.2, h: 2.2, col: g.door })
    S.prop({ type: 'sigil', kind: g.sigil, x: west ? 3.0 : 38.0, y: g.y + 0.5, z: 3.7, r: 0.6, rgb: g.light, plane: 'x', flip: !west })
    for (const [py, f] of [[g.y - 4, !west], [g.y + 4, !west]]) { const zs = zAt(px + 0.5, py + 0.62); if (!zs) S.set(px, py, '#', 0.6, g.mat); S.prop({ type: 'statue', kind: g.statue, x: px + 0.5, y: py + 0.62, z: zs || 0.6, s: 2.7, stone: g.stone, flip: f }) }
    S.light(west ? 4.2 : 37.8, g.y + 0.5, 2.6, 5.5, g.light, 1.0)
    if (g.candles) S.prop({ type: 'candles', x: west ? 4.4 : 37.6, y: g.y + 2.3, z: zAt(west ? 4.4 : 37.6, g.y + 2.3), w: 1.0, count: 5 })
    if (g.drip) S.falls.push({ x0: ax - 0.1, x1: ax + 1.1, y: g.y + 2, z0: 2.8, z1: Math.max(0.1, zAt(ax + 0.5, g.y + 2 - 0.1)) })
    S.esc.npcs.push({ id: g.id, x: west ? 4.5 : 37.5, y: g.y + 0.5, kind: 'gate', radius: 2.8, sigil: g.sigil, rgb: g.light })
  }
  // The sea-door (Donn's), low in the west wall, is no gatehouse: it is the hall's own stone. A stair goes down south out
  // of the hall's corner, toward you, the floor's courses going down it a step each (stones of the floor laid lower and
  // lower, on a floor far below: hewnExtras.js drawStones); an arch stands over its head; about it the stones stand up in
  // stacks, as at the other gates. The rock that was there is gone, so nothing stands between you and the stair.
  // The sea-door (Donn's): the hall's own floor going down. Its two outermost courses of stones, out past the pool, leave
  // the floor at the south-west and go down a step each stone, curving north along the west wall into the dark: you see
  // them going away from you, down. A kerb of the floor's stones stands between the hall and the stair; the next courses
  // out stand up as its far wall; past them the rock. At its head a portal corbelled as the old passage-graves were: two
  // piers of the floor's slabs, each course stepped out over the way toward the other, not quite meeting.
  const seaDoorR = (g) => {
    const TAU = Math.PI * 2, tH = 2.86, tE = 3.5, tD = 3.64, R = 0.45, dT = TAU / CO.info[10].m, BASE = -7
    const ang = (t) => ((t % TAU) + TAU) % TAU
    const inWedge = (t, a = 1.05, b = 0.18) => t >= tH - a && t <= tD + b
    const midOf = (n, j) => { const G = cellGeom(ART, n, j, CO); return { G, tm: ang((G.t0 + G.t1) / 2) } }
    // what was here: the west gate's stacks and its statue's stone
    for (const [key, c] of [...raised]) { const G = cellGeom(ART, c.n, c.j, CO), m = ptAt(ART, (G.ga + G.gb) / 2, (G.t0 + G.t1) / 2); if (m.x < 11 && m.y > 16) raised.delete(key) }
    // the ground: rock beyond the far wall, floor up to it
    for (let y = 14; y <= 48; y++) for (let x = 0; x <= 13; x++) {
      const c = cellAt(ART, x + 0.5, y + 0.5, CO); if (!c) continue
      const tm = midOf(c.n, c.j).tm; if (!inWedge(tm)) continue
      if (c.n >= 14 || (c.n >= 12 && tm < tH - 0.09)) S.set(x, y, '#', 8.5, 'm')          // (round the corner before the portal, the rock itself)
      else if (S.kind[y][x] === '#') S.set(x, y, '.', 0, 'm')
    }
    const stair = new Set()
    for (let n = 9; n <= 13; n++) for (let j = 0; j < CO.info[n].m; j++) {
      const { G, tm } = midOf(n, j); if (!inWedge(tm)) continue
      const pts = [G.ga, G.gb].flatMap(gg => [G.t0, (G.t0 + G.t1) / 2, G.t1].map(t => ptAt(ART, gg, t)))
      if (n < 12 && pts.some(q => S.kind[Math.floor(q.y)]?.[Math.floor(q.x)] !== '.')) continue          // (the far wall's stones may go into the rock)
      if (n === 10 || n === 11) {
        if (tm < tH) continue                                                         // the way to it: the hall's floor
        if (tm > tD) { raised.set(n + ',' + j, { n, j, z: 2.67, dk: 0.9, tx: true }); continue }      // its end: the dark
        const z = -(Math.floor((tm - tH) / dT) + 1) * R
        raised.set(n + ',' + j, { n, j, z, dk: tm > tE ? 0.93 : Math.min(0.8, Math.pow(-z / 5, 1.6)), tx: true, solid: true }); stair.add(n + ',' + j)
      } else if (n === 9) { if (tm > tH + 0.03) raised.set(n + ',' + j, { n, j, z: 0.67, dk: Math.min(0.6, Math.max(0, tm - tH) * 0.6), tx: true }) }
      else if (tm > tH + 0.03) raised.set(n + ',' + j, { n, j, z: 2.67, dk: Math.min(0.7, Math.max(0, tm - tH) * 0.7), tx: true })
    }
    // the floor under it: under the lowest stone on each tile (the stones are what you see; where you walk is the stone
    // under the tile's middle, the hidden decks laid for the whole hall below)
    const zr = (x, y) => { const c = cellAt(ART, x, y, CO); const r = c && raised.get(c.n + ',' + c.j); return r ? r.z : null }
    const way = []
    for (let y = 14; y <= 48; y++) for (let x = 0; x <= 13; x++) {
      if (S.kind[y][x] !== '.') continue
      const zs = [[0.5, 0.5], [0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]].map(([u, v]) => zr(x + u, y + v)).filter(z => z != null)
      if (zs.length && Math.min(...zs) < 0) S.z[y][x] = Math.max(BASE, Math.min(...zs) - 0.01)
      const c = cellAt(ART, x + 0.5, y + 0.5, CO); if (c && stair.has(c.n + ',' + c.j) && midOf(c.n, c.j).tm > tE - 0.04) way.push([x, y])
    }
    S.extra.stoneOnly = [[0, 14, 13, 48, 0.01]]
    // the portal
    const pi = ptAt(ART, 12.75, tH - 0.03), po = ptAt(ART, 15.75, tH - 0.03), d = Math.hypot(po.x - pi.x, po.y - pi.y), ux = (po.x - pi.x) / d, uy = (po.y - pi.y) / d
    for (const [P, sx, sd] of [[pi, 1, 3], [po, -1, 7]]) {
      S.block.push([Math.floor(P.x), Math.floor(P.y)])                       // (not walked through)
      S.prop({ type: 'pillar', x: P.x, y: P.y, z: zAt(P.x, P.y), h: 4.2, w: 1.3, seed: sd, tex: true, big: true, cb: [ux * sx, uy * sx], cz: 2.3, cstep: 0.22 })
    }
    // the dead's statue and their candles, on the hall's side of the kerb; a cold light at the head; breath out of the dark
    const st = ptAt(ART, 11.4, tH - 0.32)
    S.prop({ type: 'statue', kind: g.statue, x: st.x, y: st.y, z: zAt(st.x, st.y), s: 2.7, stone: g.stone, flip: false })
    if (g.candles) { const cd = ptAt(ART, 11.9, tH - 0.2); S.prop({ type: 'candles', x: cd.x, y: cd.y, z: zAt(cd.x, cd.y), w: 1.0, count: 5 }) }
    const hd = ptAt(ART, 14.3, tH + 0.02); S.light(hd.x, hd.y, 0.9, 3.8, [185, 200, 225], 0.65)
    for (const [f, a] of [[0.18, 0.5], [0.4, 0.32], [0.62, 0.18]]) { const t = tH + f * (tE - tH), q = ptAt(ART, 14.3, t); S.light(q.x, q.y, zAt(q.x, q.y) + 1.2, 3.0, [150, 170, 210], a) }      // less and less light, going down
    for (let k = 0; k < 6; k++) {
      const t = tH + 0.12 + k * (tE - tH) / 6, a = ptAt(ART, 13.3, t), b = ptAt(ART, 15.2, t)
      S.prop({ type: 'mist', y: Math.floor((a.y + b.y) / 2), x0: Math.min(a.x, b.x) - 0.3, x1: Math.max(a.x, b.x) + 0.3, z: zAt((a.x + b.x) / 2, (a.y + b.y) / 2) + 0.2, rgb: [200, 212, 230], a: 0.2, count: 2, pulse: 9, ph: k * 0.7 })
    }
    const ap = ptAt(ART, 14.3, tH - 0.15)
    S.esc.npcs.push({ id: g.id, x: ap.x, y: ap.y, kind: 'gate', radius: 2.8, sigil: g.sigil, rgb: g.light })
    const bt = ptAt(ART, 14.3, tE); S.esc.sea = { x: bt.x, y: bt.y }
    const xs = way.map(q => q[0]), ys = way.map(q => q[1])
    S.esc.ways.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), to: g.sea, at: [12, 42], dark: true })
  }
  // The sea-door (Donn's), as it is now: the hall's floor goes down at the south-west. Its outer courses ease down a
  // half step each, ring by ring, each lower ring reaching further west, so you come at it from the south or the east and
  // wind west and down, to a landing sunk in the corner. Over the landing the floor of the hall stands sheer (come at it
  // from above and it is a drop), and cut in that face, under the floor you walked on, the door: corbelled of the floor's
  // slabs, a portcullis's teeth hanging in its head, and inside it steps going on down, north, into the dark.
  const seaDoorT = (g) => {
    const TAU = Math.PI * 2, ang = (t) => ((t % TAU) + TAU) % TAU, LAND = 45, DX = 3.5, ZL = -3.0, FACE = LAND + 0.62
    const xW = (n) => 9 - (n - 9) * 0.7                                    // how far west each ring's descent reaches
    const zOfCell = (n, tm, m, G) => {
      if (n < 9) return null
      if (m.x < 9.5 && m.x >= 0.6) {                                                    // the landing: stones wholly south of the face
        const ys = [G.ga, G.gb].flatMap(gg => [G.t0, (G.t0 + G.t1) / 2, G.t1].map(t => ptAt(ART, gg, t).y))
        if (Math.min(...ys) >= LAND - 0.05) return ZL
        if (m.y >= LAND - 0.6) return null
      }
      if (m.x < Math.max(xW(n), 6.6) || tm < 1.65) return null                           // the floor standing over it
      const k = Math.max(0, Math.min(6, (1.95 - tm) / 0.05))                              // (easing in from the east)
      const z = -0.5 * Math.max(0, Math.min(6, n - 8 - k))
      return z < 0 ? z : null
    }
    for (const [key, c] of [...raised]) { const G = cellGeom(ART, c.n, c.j, CO), m = ptAt(ART, (G.ga + G.gb) / 2, (G.t0 + G.t1) / 2); if (m.x < 18 && m.y > 33) raised.delete(key) }
    // the ground: floor wherever a stone goes down (the rock at the corner cut back to it)
    const cz = (x, y) => { const c = cellAt(ART, x, y, CO); if (!c) return null; const G = cellGeom(ART, c.n, c.j, CO); return zOfCell(c.n, ang((G.t0 + G.t1) / 2), ptAt(ART, (G.ga + G.gb) / 2, (G.t0 + G.t1) / 2), G) }
    for (let y = 34; y <= 44; y++) for (let x = 1; x <= 6; x++) if (S.kind[y][x] === '#') S.set(x, y, '.', 0, 'm')          // (the old gatehouse's rock gone: the floor over the door)
    for (let y = 34; y <= 48; y++) for (let x = 1; x <= 18; x++) if ((cz(x + 0.5, y + 0.5) != null || (y >= LAND && x <= 9)) && S.kind[y][x] !== '.') S.set(x, y, '.', 0, 'm')
    for (let n = 9; n < CO.info.length; n++) for (let j = 0; j < CO.info[n].m; j++) {
      const G = cellGeom(ART, n, j, CO), tm = ang((G.t0 + G.t1) / 2), m = ptAt(ART, (G.ga + G.gb) / 2, (G.t0 + G.t1) / 2)
      if (m.x > 19 || m.y < 33) continue
      const z = zOfCell(n, tm, m, G); if (z == null) continue
      const pts = [G.ga, G.gb].flatMap(gg => [G.t0, (G.t0 + G.t1) / 2, G.t1].map(t => ptAt(ART, gg, t)))
      if (pts.some(q => S.kind[Math.floor(q.y)]?.[Math.floor(q.x)] !== '.')) continue
      raised.set(n + ',' + j, { n, j, z, dk: Math.min(0.55, -z / 6), tx: true, solid: true })
    }
    const zr = (x, y) => { const c = cellAt(ART, x, y, CO); const r = c && raised.get(c.n + ',' + c.j); return r ? r.z : null }
    for (let y = 34; y <= 48; y++) for (let x = 0; x <= 18; x++) {
      if (S.kind[y][x] !== '.') continue
      const zs = [[0.5, 0.5], [0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]].map(([u, v]) => zr(x + u, y + v)).filter(z => z != null)
      if (zs.length) S.z[y][x] = Math.min(...zs) - 0.01
      else { const c0 = cz(x + 0.5, y + 0.5); if (c0 != null) S.z[y][x] = c0 }                     // (a tile no whole stone covers: its floor at the stones' height)
    }
    S.extra.stoneOnly = [[0, 34, 18, 48]]
    // the door, in the face under the floor; the floor's edge over it the hall's own (its stones' faces show, cut whole)
    for (let n = 9; n < CO.info.length; n++) for (let j = 0; j < CO.info[n].m; j++) {
      const G = cellGeom(ART, n, j, CO), m = ptAt(ART, (G.ga + G.gb) / 2, (G.t0 + G.t1) / 2)
      if (m.y < 36 || m.x > 18 || m.x < 0.6 || raised.has(n + ',' + j)) continue
      const pts = [G.ga, G.gb].flatMap(gg => [G.t0, (G.t0 + G.t1) / 2, G.t1].map(t => ptAt(ART, gg, t)))
      if (pts.some(q => S.kind[Math.floor(q.y)]?.[Math.floor(q.x)] !== '.')) continue
      if (!pts.some(q => S.z[Math.floor(q.y)][Math.floor(q.x)] < -0.05)) continue
      raised.set(n + ',' + j, { n, j, z: 0, tx: true })
    }
    S.prop({ type: 'doorway', x: DX, y: FACE, z: ZL, w: 1.8, h: 2.75 })
    for (const [sx, sd] of [[-1, 11], [1, 13]]) S.prop({ type: 'pillar', x: DX + sx * 1.3, y: FACE + 0.2, z: ZL, h: 3.0, w: 0.82, seed: sd, tex: true, big: true, cb: [-sx, 0], cz: ZL + 1.6, cstep: 0.17 })
    for (const [x, f] of [[DX - 2.0, false], [DX + 2.0, true]]) S.prop({ type: 'statue', kind: g.statue, x, y: LAND - 0.9, z: 0, s: 2.4, stone: g.stone, flip: f })      // the dead's watchers, on the brink over it
    if (g.candles) S.prop({ type: 'candles', x: DX + 1.9, y: LAND + 0.7, z: ZL, w: 0.8, count: 5 })
    S.light(DX, LAND + 1.2, ZL + 1.0, 3.6, [170, 190, 225], 0.7)
    S.light(12, 42.5, -0.6, 4.0, [170, 190, 225], 0.4)
    S.prop({ type: 'mist', y: Math.floor(FACE), x0: DX - 0.6, x1: DX + 0.6, z: ZL + 0.1, rgb: [200, 212, 230], a: 0.28, count: 2, pulse: 8, ph: 0 })
    S.esc.npcs.push({ id: g.id, x: DX, y: LAND + 2.2, kind: 'gate', radius: 2.8, sigil: g.sigil, rgb: g.light })
    S.esc.sea = { x: DX, y: LAND + 1 }
    S.esc.ways.push({ x0: Math.floor(DX - 0.5), y0: LAND + 1, x1: Math.floor(DX + 0.5), y1: LAND + 1, to: g.sea, at: [12, 42], dark: true })
  }
  const seaDoor = (g) => {
    const V = process.env.SEADOOR || 'T'
    if (V === 'T') return seaDoorT(g)
    if (V === 'R') return seaDoorR(g)                                // (SEADOOR=R: the stair along the west wall; =A the straight one)
    const top = g.y + 2, bot = 48, BASE = -2.33, sea = (x, y) => y >= top && x >= 1 && x <= 4
    for (let y = g.y - 3; y <= bot; y++) for (let x = 0; x <= 6; x++) if (S.kind[y][x] === '#') S.set(x, y, '.', y >= top ? BASE : 0, 'm')
    const n0 = cellAt(ART, 2.5, top + 0.15, CO).n
    for (let n = 0; n < CO.info.length; n++) for (let j = 0; j < CO.info[n].m; j++) {
      const G = cellGeom(ART, n, j, CO), pts = [G.ga, G.gb].flatMap(gg => [G.t0, (G.t0 + G.t1) / 2, G.t1].map(t => ptAt(ART, gg, t)))
      const mid = ptAt(ART, (G.ga + G.gb) / 2, (G.t0 + G.t1) / 2), mx = Math.floor(mid.x), my = Math.floor(mid.y)
      if (mx < 0 || mx > 6 || my < g.y - 3 || my > bot) continue
      if (pts.some(q => q.x < 0 || q.x > 7 || q.y < g.y - 3 || q.y > bot + 1)) continue
      const tiles = pts.map(q => [Math.floor(q.x), Math.floor(q.y)])
      if (tiles.some(([x, y]) => S.kind[y]?.[x] !== '.')) continue
      if (sea(mx, my)) {                                                 // a step of the stair: a course lower each
        if (tiles.some(([x, y]) => !sea(x, y) && S.z[y][x] === 0)) continue
        const z = q3(Math.min(0, -(n - n0 + 1) / 3)); if (z > BASE + 0.05) raised.set(n + ',' + j, { n, j, z, dk: Math.min(0.5, -z / 4) })      // (darker, the deeper)
      } else if (my >= top || mx < 1 || my <= g.y - 2) {                 // the stacks: either side of the stair, and where the gatehouse was (the arch's mouth kept clear)
        if (tiles.some(([x, y]) => S.z[y][x] === 0 && !(y < top && x < 4))) continue
        raised.set(n + ',' + j, { n, j, z: my >= top ? 0 : 0.67, dk: my >= top ? Math.min(0.5, (my - top) / 16) : 0 })
      }
    }
    // the floor under the stair and the stacks: just under the lowest stone on each tile, so no pit shows between them
    const zr = (x, y) => { const c = cellAt(ART, x, y, CO); const r = c && raised.get(c.n + ',' + c.j); return r ? r.z : null }
    for (let y = top; y <= bot; y++) for (let x = 0; x <= 6; x++) {
      if (S.kind[y][x] !== '.' || S.z[y][x] !== BASE) continue
      const zs = [[0.5, 0.5], [0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]].map(([u, v]) => zr(x + u, y + v)).filter(z => z != null)
      if (zs.length) S.z[y][x] = Math.max(BASE, Math.min(...zs) - 0.01)
    }
    // either side of the stair's head a pillar of the stones laid dry, one on another, old past telling
    for (const [px, py, sd] of [[0.6, top - 0.2, 3], [5.3, top - 0.2, 7]]) { lift(px, py, 0.67); S.prop({ type: 'pillar', x: px, y: py, z: 0.67, h: 2.5, w: 1.05, seed: sd, tex: true }) }
    S.extra.stoneOnly = [[0, top, 6, bot]]                 // (the floor under the stair has no faces of its own: the stones' are the steps)
    for (let y = top + 1; y <= bot; y += 2) S.prop({ type: 'mist', y: y + 0.5, x0: 0.5, x1: 5.5, z: BASE + 0.4, rgb: [205, 214, 228], a: 0.12, count: 3 })
    S.light(2.8, top + 0.5, 0.8, 3.5, [185, 200, 225], 0.6)
    S.esc.sea = { x: 2.8, y: top + 3 }                     // hands slapping the water beyond it, now and then (escape.js)
    S.esc.ways.push({ x0: 1, y0: bot - 1, x1: 4, y1: bot, to: g.sea, at: [12, 42], dark: true })     // (the way on a step before the bottom: into the dark, straight on)
    const px = 5, py = g.y - 4, zs = zAt(px + 0.5, py + 0.62)                // the statue north of it
    if (!zs) S.set(px, py, '#', 0.6, g.mat)
    S.prop({ type: 'statue', kind: g.statue, x: px + 0.5, y: py + 0.62, z: zs || 0.6, s: 2.7, stone: g.stone, flip: false })
    if (g.candles) S.prop({ type: 'candles', x: 4.6, y: g.y + 0.6, z: zAt(4.6, g.y + 0.6), w: 1.0, count: 5 })
    S.esc.npcs.push({ id: g.id, x: 4.5, y: g.y + 1.5, kind: 'gate', radius: 2.8, sigil: g.sigil, rgb: g.light })
  }
  const h2s = (a) => { let x = Math.imul(a | 0, 374761393) | 0; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296 }
  // each of the other gates gets the north gate's stairs: the floor's stones climbing each side of the way in toward the
  // door, the highest beside it, the statues on the top. A stone's height by how far it is from the way (k, a stone's
  // length each) and from the wall (c, a course's depth): 1.33 less a third for each step of the two.
  const shrine = (wall, ax) => {
    for (let n = 0; n < CO.info.length; n++) for (let j = 0; j < CO.info[n].m; j++) {
      const G = cellGeom(ART, n, j, CO), pts = [G.ga, G.gb].flatMap(g => [G.t0, (G.t0 + G.t1) / 2, G.t1].map(t => ptAt(ART, g, t)))
      const mid = ptAt(ART, (G.ga + G.gb) / 2, (G.t0 + G.t1) / 2)
      const lat = (q) => Math.abs((wall === 'n' ? q.x : q.y) - ax), dep = (q) => wall === 'n' ? q.y - 10 : wall === 'w' ? q.x - 4 : 38 - q.x
      if (Math.min(...pts.map(dep)) < -0.6 || dep(mid) < 0.1 || dep(mid) > 3.4) continue
      if (pts.some(q => { const ty = Math.floor(q.y + (mid.y - q.y) * 0.35), tx = Math.floor(q.x + (mid.x - q.x) * 0.35); return S.kind[ty]?.[tx] !== '.' || S.z[ty][tx] !== 0 })) continue
      const L = Math.min(...pts.map(lat)); if (L < 1.45 || Math.max(...pts.map(lat)) > 5.6) continue
      const z = Math.round((1.33 - 0.33 * (Math.floor(dep(mid)) + Math.max(0, Math.floor((L - 1.45) / 1.2 + 0.2) - 1))) * 3) / 3
      if (z >= 0.3 && !raised.has(n + ',' + j)) raised.set(n + ',' + j, { n, j, z })
    }
  }
  shrine('n', 10.5); shrine('n', 32.5); shrine('w', 38.5); shrine('e', 26.5)
  for (const [x, y] of [[8.5, 10.62], [12.5, 10.62], [30.5, 10.62], [34.5, 10.62], [5.5, 34.62], [36.5, 22.62], [36.5, 30.62]]) if (!zAt(x, y)) lift(x, y, 1.0)       // a statue always stands on a stone
  north(G.nw, false); north(G.ne, false); side(G.w, true); side(G.e, false)
  for (const x of [8.5, 12.5, 30.5, 34.5]) { const cx2 = x + (x % 22 < 11 ? -0.7 : 0.7); S.prop({ type: 'candles', x: cx2, y: 11.2, z: zAt(cx2, 11.2), w: 0.5, count: 3 }) }

  // the way up: the north gatehouse, fortified but open (its portcullis raised); through it a crafted stair, kerbed
  // both sides, a landing halfway; the stream climbing its own channel beside it
  {
    const RISE = [[1.33, 1.33, 1.0, 0.67, 0.33], [1.0, 1.0, 0.67, 0.33], [0.67, 0.67, 0.33], [0.33, 0.33]]        // by course from the wall (8, 7, 6, 5), then stone by stone out from the way in
    RISE.forEach((hs, ci) => {
      const n = 8 - ci, I = CO.info[n]
      for (const side of [-1, 1]) {
        const st = []
        for (let j = 0; j < I.m; j++) {
          const G = cellGeom(ART, n, j, CO), pts = [G.ga, G.gb].flatMap(g => [G.t0, (G.t0 + G.t1) / 2, G.t1].map(t => ptAt(ART, g, t)))
          const dx = pts.map(q => (q.x - 21.5) * side)
          if (Math.min(...dx) < 1.45 || Math.max(...dx) > 8 || pts.some(q => q.y < 9.95 || q.y > 17)) continue          // clear of the way, near it, and inside the hall
          st.push({ j, d: Math.min(...dx) })
        }
        st.sort((a, b) => a.d - b.d).slice(0, hs.length).forEach((q, k) => raised.set(n + ',' + q.j, { n, j: q.j, z: hs[k] }))
      }
    })
    for (const [x, y, z] of [[13.5, 18.6, 1.0], [14.9, 18.9, 0.67], [12.4, 19.5, 0.67], [13.8, 19.9, 0.33], [11.6, 20.6, 0.33], [15.9, 19.9, 0.33]]) lift(x, y, z)
    for (const [x, y, z] of [[29.0, 17.4, 1.0], [30.2, 17.9, 1.0], [28.0, 17.0, 0.67], [31.0, 19.0, 0.67]]) lift(x, y, z)
  }
  north({ x: 21, mat: 'm', stone: [190, 186, 176], statue: 'hound' }, true)
     // the shrine: stones of the floor itself pushed up (js/game/effects/floorStones.mjs says which stone is which). Each side of
  // the way in climbs, a course at a time, to a plinth where a hound sits with candles about it; the way between stays at the
  // floor's own height. Heights in thirds: a step of a third is walked, two thirds and more is a wall to you. Then standing
  // stones in the hall: a cluster you can climb and a few tall ones you walk round.
  for (const x of [19.5, 23.5]) {
    const cx2 = x + (x < 21.5 ? -0.7 : 0.7)
    S.prop({ type: 'candles', x: cx2, y: 11.2, z: zAt(cx2, 11.2), w: 0.5, count: 3 })
    S.light(x, 11.0, zAt(x, 11.0) + 1.1, 4.5, [255, 190, 120], 0.8)
  }
  {
    // you walk on them by the tile: each tile stands at the height of the stone under its middle (hidden decks)
    for (let y = 10; y <= 48; y++) for (let x = 0; x <= 37; x++) {
      if (S.kind[y][x] !== '.' || S.spans.some(s => s.x === x && s.y === y)) continue
      const z = zAt(x + 0.5, y + 0.5)
      if (z !== 0) S.deck(x, y, z, 0.2, 'deck', true)
    }
    const cells = [...raised.values()]
    let y0 = Infinity, y1 = -Infinity
    for (const c of cells) for (const q of [CO.info[c.n]].flatMap(() => { const G = cellGeom(ART, c.n, c.j, CO); return [G.ga, G.gb].flatMap(g => [G.t0, (G.t0 + G.t1) / 2, G.t1].map(t => ptAt(ART, g, t))) })) { y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y) }
    S.prop({ type: 'stones', cells, y0: Math.floor(y0 - 0.1), y1: Math.floor(y1 + 0.1) })
  }
  const STAIR = [2.67, 2.33, 2.0, 1.67, 1.67, 1.33, 1.0, 0.67, 0.33]        // rows 0..8
  for (let y = 0; y <= 8; y++) {
    S.rect(19, y, 22, y, '.', STAIR[y], 'm')
    S.set(18, y, '#', STAIR[y] + 0.75, 'm'); S.set(24, y, '#', STAIR[y] + 0.75, 'm')
    S.set(23, y, '~', STAIR[y] - 0.35, 'p')
  }
  S.rect(19, 9, 23, 9, '.', 0, 'm'); S.set(23, 9, '~', -0.2, 'p')
  for (let y = 0; y < 9; y++) { const z0 = y === 8 ? -0.2 : STAIR[y + 1] - 0.35, z1 = STAIR[y] - 0.35; if (z1 > z0 + 0.1) S.falls.push({ x0: 23.05, x1: 23.95, y: y + 1, z0: z0 - 0.05, z1: z1 + 0.05 }) }
  S.prop({ type: 'steps', x0: 19, x1: 23, y0: 0, y1: 8 })
  S.prop({ type: 'arch', x0: 18, x1: 25, y: 9, z0: 0, zs: 2.4, zt: 3.9, pier: 0.4 })
  S.prop({ type: 'grille', x0: 18.6, x1: 24.4, y: 9.02, z0: 3.0, z1: 3.7 })                 // the portcullis, raised
  merlons(18, 25, 8.85, 4.0, [104, 102, 96])
  for (const x of [18.5, 24.5]) {
    S.prop({ type: 'box', x, y: 4.55, z: 2.42, w: 0.5, d: 0.36, h: 2.1, col: [140, 138, 130] })
    S.prop({ type: 'ogham', x: x - 0.22, y: 4.74, z0: 2.6, z1: 4.4, glow: '170,215,255' })
  }
  S.esc.gate = { tiles: [[19, 9], [20, 9], [21, 9], [22, 9]], note: 'escape_geaga_blind_eye', prop: 'gate' }
  S.prop({ type: 'roots', id: 'gate', x0: 19.0, x1: 23.0, y0: 9.05, y1: 9.95, z: 4.2, dz: 4.0, count: 56, even: true })

  // the streams: out from the foot of the pool's steps, winding over the floor to their gates (painted water; the floor
  // under them not walked on; a slab bridge over each, halfway)
  const ER = (ang) => [cx + Math.cos(ang) * (RX + RIM + 2 * STEP - 0.5), cy + Math.sin(ang) * (RY + RIM + 2 * STEP - 0.5)]
  const winding = (a, b, amp, seed) => {          // a line from a to b, swinging side to side, smooth, still at its ends
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy)
    const pts = []
    for (let i = 0; i <= n; i++) {
      const t = i / n, env = Math.sin(Math.PI * t), sw = Math.sin(t * Math.PI * (1.6 + (seed % 3) * 0.4) + seed) * amp * env
      pts.push([a[0] + dx * t - dy / L * sw, a[1] + dy * t + dx / L * sw, 0.01])
    }
    return pts
  }
  const smoothPath = (keys, step = 0.25) => {      // a smooth line through the points, one point every `step`
    const P = keys, n = 400, raw = []
    for (let i = 0; i <= n; i++) {
      const f = i / n * (P.length - 1), k = Math.min(P.length - 2, Math.floor(f)), t = f - k, t2 = t * t, t3 = t2 * t
      const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)]
      raw.push([0, 1].map(a => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)))
    }
    const out = [[raw[0][0], raw[0][1], 0.01]]; let acc = 0
    for (let i = 1; i < raw.length; i++) { acc += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]); if (acc >= step) { out.push([raw[i][0], raw[i][1], 0.01]); acc = 0 } }
    out.push([raw[n][0], raw[n][1], 0.01]); return out
  }
  const rivers = [
    smoothPath([ER(Math.PI), [10.8, 26.2], [9.0, 24.8], [8.5, 26.6], [8.5, 28.8], [7.4, 29.8], [5.2, 28.0], [3.6, 26.5]]),     // west, to Tech Duinn: a bend, a straight run south (where the bridge is), a bend
    winding(ER(-Math.PI * 0.72), [10.5, 9.4], 1.2, 2),               // north-west, to the Fomorian edge
    winding(ER(-Math.PI / 2), [22.5, 9.6], 0.9, 3),                  // north, to the stair's channel
    winding(ER(-Math.PI * 0.28), [32.5, 9.4], 1.2, 4),               // north-east, to the hollow hills
    smoothPath([ER(0), [31.8, 26.8], [33.6, 24.8], [34.2, 26.8], [34.2, 29.0], [35.4, 30.0], [37.0, 28.0], [38.4, 26.5]]),       // east, to Tethra's court, the same bend the other way
  ]
  // the floor is laid in rings out from the dais; the water is a ring round its foot and a channel from it to each gate,
  // shallow, set in the stone (nothing to climb over: all of it can be walked). Painted into the floor (hewnExtras.js).
  const tail = (pts, to) => [...pts.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]), ...to]
  S.extra.floorArt = {
    cx, cy, rx: RX, ry: RY, g0: RIM + 2 * STEP, rect: [0, 8, 41, 49], ring: false, treads: [0, RIM, RIM + STEP], nokerb: [[14, 10, 28, 13], [0, 14, 18, 48]],
    channels: [],                                                        // (the water and its knotwork: to be worked in another way)
  }
  S.prop({ type: 'pool', x: cx, y: cy, rx: RX, ry: RY, z: ZR, rings: RINGS, fish: { count: 2, nuts: true } })
  cliffs(S, 0, 1.3, 11)
  for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (S.kind[y][x] === '#' && S.mat[y][x] === 'c') S.z[y][x] = Math.max(S.z[y][x], 8.5)

  // the hazel over the well: its roots down out of the dark, longest over the water; the nuts
  S.prop({ type: 'roots', x0: cx - 8, x1: cx + 8, y0: cy - 7, y1: cy + 6, z: 9, dz: 6.6, count: 130, nuts: true })
  S.prop({ type: 'glowworms', x: 0, y: 6.999, x0: 3, x1: 39, z0: 6, z1: 9.5, n: 80 })
  // the dead who came to ask her before you, and are still waiting
  for (const sh of [
    { id: 'shade_manach', x: 9.5, y: 36.5, c: 0, r: 4 },
    { id: 'shade_laoch', x: 33.5, y: 35.5, c: 8, r: 2, f: true },
    { id: 'shade_mathair', x: 14.5, y: 41.5, c: 9, r: 2 },
    { id: 'shade_file', x: 28.5, y: 41.5, c: 4, r: 0, f: true },
  ]) {
    S.prop({ type: 'mob', c: sh.c, r: sh.r, x: sh.x, y: sh.y, z: 0, s: 0.85, ghost: true, alpha: 0.5, flip: !!sh.f })
    S.esc.npcs.push({ id: sh.id, x: sh.x, y: sh.y, kind: 'shade', radius: 1.6 })
  }
  S.light(cx, cy, 1.0, 10, [200, 220, 255], 1.0)
  S.light(cx, cy - 1, 7, 10, [230, 210, 150], 0.45)
  S.light(21, 1.2, 4.0, 6.5, [175, 205, 255], 0.95)
  for (const [x, y] of [[8, 40], [34, 40], [7, 18], [35, 18]]) S.light(x, y, 2.4, 6, [190, 200, 220], 0.35)
  S.extra.ambient = [0.22, 0.225, 0.24]; S.extra.drips = true
  S.zones.push({ x0: 4, y0: 10, x1: 37, y1: 45, zoom: 0.84, look: 0.06 })
  S.esc.npcs.push({ id: 'geaga', x: cx, y: cy - 1, kind: 'geaga', radius: 7.5, reach: false })
  S.esc.ways.push({ x0: 19, y0: 0, x1: 22, y1: 0, to: 'escape_doimhne', at: [13, 57], pastGate: true })
  out(S, [21, 40])
}

// ═════════════ 2. Na Doimhní (the deeps) ══════════════════════════════════════════════════════
// A long climb. The stream runs beside the way, uphill, falling upward at every stair. Two places where they wait for
// you; in a side cave off the second, a púca caught in their snare.
{
  const S = scene('escape_doimhne', 28, 60, '#', 10, 'c'), rnd = rng(9), nz = createNoise2D(rnd)
  const route = [[13, 59, 0], [13, 54, 0], [10, 49, 0.67], [8, 45, 1.33], [8, 41, 1.33], [12, 37, 2.33], [17, 33, 3], [18, 29, 3.67], [15, 25, 4.33], [14, 21, 4.33], [12, 16, 5.67], [12, 11, 7], [13, 6, 8], [13, 0, 8]]
  passage(S, route, 3.0, 'c')
  cavern(S, 8, 43, 4.3, 3.4, 1.33, 'c', nz)                         // the first chamber
  cavern(S, 14.5, 23.5, 5.6, 3.8, 4.33, 'c', nz)                    // the second
  passage(S, [[9.5, 23, 4.33], [6, 22.5, 4.33]], 2.4, 'c')         // the side cave where the púca is held
  cavern(S, 5.2, 22.5, 2.1, 1.9, 4.33, 'c', nz, 0.05)
  cavern(S, 13, 3.5, 3, 2.6, 8, 'c', nz, 0.08)
  stream(S, route.map(([x, y, z]) => [x + 2.3, y, z - 0.4]), 1.2)
  cliffs(S, 0, 1.2, 12)
  // what lies about: bones, a broken shield; the snare's stakes round the púca
  for (const [x, y, z] of [[6.4, 44.6, 1.33], [9.8, 41.6, 1.33], [17.2, 22.3, 4.33], [12.1, 25.4, 4.33]]) S.prop({ x, y, z, gid: 2381, s: 0.5 })
  for (let q = 0; q < 8; q++) { const a = q / 8 * Math.PI * 2; S.prop({ type: 'mite', x: 5.0 + Math.cos(a) * 1.05, y: 22.6 + Math.sin(a) * 0.9, z: 4.33, h: 0.7, r: 0.07, tone: [96, 80, 60] }) }
  let n = 0
  while (n < 30) {
    const x = 2 + rnd() * 24, y = 2 + rnd() * 56, c = Math.floor(x), r = Math.floor(y)
    if (S.kind[r][c] !== '.' || route.some(([px, py]) => Math.hypot(px - x, py - y) < 2.2)) continue
    S.prop({ type: 'mite', x, y, z: S.z[r][c], h: 0.4 + rnd() * 1.4, r: 0.12 + rnd() * 0.2 }); n++
  }
  for (const [x, y, z] of route.filter((_, i) => i % 2)) S.light(x + 2.3, y, z, 3.2, [120, 220, 160], 0.45)
  S.light(5.2, 22.5, 5.3, 3.5, [255, 190, 120], 0.55)                // a little light where the púca is
  S.light(13, 3.5, 9.5, 6, [120, 200, 255], 0.5)
  S.extra = { ambient: [0.075, 0.08, 0.085], drips: true }
  S.zones.push({ x0: 3, y0: 39, x1: 13, y1: 47, zoom: 0.8 }, { x0: 8, y0: 19, x1: 21, y1: 28, zoom: 0.75 })
  S.esc.packs.push({ x0: 4, y0: 40, x1: 12, y1: 46, spots: [[7, 40], [10, 41], [5, 42]], foe: 'deep' })
  S.esc.packs.push({ x0: 10, y0: 20, x1: 20, y1: 27, spots: [[17, 21], [12, 21], [18, 25]], foe: 'deep' })
  S.esc.npcs.push({ id: 'puca_snare', x: 5, y: 22.5, kind: 'puca', state: 'bound', radius: 2.2 })
  S.esc.ways.push({ x0: 11, y0: 0, x1: 15, y1: 1, to: 'escape_gailearai', at: [15, 45] })
  S.esc.ways.push({ x0: 11, y0: 58, x1: 15, y1: 59, to: 'escape_tobar', at: [20, 1] })
  S.esc.watchers = 2; S.esc.foe = 'deep'
  out(S, [13, 57])
}

// ═════════════ 3. Na Gailearaithe (the galleries) ═════════════════════════════════════════════
// A hall with floors over floors, after Escher: the ground, a gallery, a high gallery, joined by stairs at the sides
// and a bridge across. The water runs up the walls. A door west off the gallery leads astray, to Balor.
{
  const S = scene('escape_gailearai', 30, 48, '#', 12, 'm')
  S.rect(4, 26, 25, 43, '.', 0, 'm')                                // the ground floor
  S.rect(13, 44, 16, 47, '.', 0, 'm')                               // in from the south
  S.rect(3, 16, 26, 22, '.', 3, 'm')                                // the gallery
  S.rect(4, 3, 25, 9, '.', 6, 'm')                                  // the high gallery
  S.rect(13, 0, 16, 2, '.', 6, 'm')                                 // and out, north
  for (let y = 23; y <= 31; y++) for (const x of [4, 5, 24, 25]) S.set(x, y, '.', q3(Math.max(0, Math.min(3, 3 - (y - 22) / 3))), 'm')   // the side stairs up to the gallery
  for (let y = 10; y <= 15; y++) for (const x of [13, 14, 15, 16]) S.set(x, y, '.', 3 + (16 - y) * 0.5, 'm')                        // the middle stair up to the high one
  // the void under the gallery's middle, bridged; and a well of nothing in the ground floor, bridged too
  S.rect(10, 18, 19, 21, 'v', 0)
  for (let x = 10; x <= 19; x++) for (const y of [19, 20]) S.deck(x, y, 3, 0.45)
  S.rect(11, 33, 18, 37, 'v', 0)
  for (let y = 33; y <= 37; y++) for (const x of [14, 15]) S.deck(x, y, 0, 0.35)
  // the arcade along the ground floor's back, the arches over the side stairs
  for (const [x0, x1] of [[6, 10], [10, 14], [15.5, 19.5], [19.5, 23.5]]) S.prop({ type: 'arch', x0, x1, y: 26, z0: 0, zs: 1.3, zt: 2.7, pier: 0.3 })
  for (const [x0, x1] of [[6, 10.5], [19, 23.5]]) S.prop({ type: 'arch', x0, x1, y: 16, z0: 3, zs: 4.3, zt: 5.6, pier: 0.3 })
  // (the west door, off the gallery, that led astray to Balor's hall is walled up for now; his hall is still made, below)
  walls(S, 12)
  // water running up the walls (falls with their top above their foot), and lying in the ground floor's gutters
  for (const [x0, y, z0, z1] of [[7, 26, 0, 3], [21, 26, 0, 3], [6, 16, 3, 6], [22, 16, 3, 6], [13, 3, 6, 11]]) S.falls.push({ x0, x1: x0 + 1.2, y, z0, z1 })
  for (let y = 33; y <= 42; y++) { S.set(4, y, '~', -0.3, 'p'); S.set(25, y, '~', -0.3, 'p') }
  for (const x of [6.5, 23.5]) { S.prop({ type: 'torch', x, y: 26.03, z: 1.7 }); S.light(x, 26.4, 1.9, 5, [255, 170, 100], 0.8) }
  for (const x of [8, 21]) { S.prop({ type: 'torch', x, y: 16.03, z: 4.7 }); S.light(x, 16.4, 4.9, 5, [255, 170, 100], 0.8) }
  S.light(14.5, 6, 8, 12, [235, 235, 220], 0.6)
  S.extra = { ambient: [0.2, 0.2, 0.19], drips: true }
  S.zones.push({ x0: 3, y0: 23, x1: 26, y1: 43, zoom: 0.75, look: 0.05 }, { x0: 3, y0: 3, x1: 26, y1: 22, zoom: 0.78 })
  S.esc.packs.push({ x0: 6, y0: 26, x1: 23, y1: 32, spots: [[8, 28], [21, 28], [14, 27]], foe: 'deep' })
  S.esc.packs.push({ x0: 4, y0: 3, x1: 25, y1: 9, spots: [[7, 5], [22, 5], [10, 4], [19, 4]], foe: 'mid' })
  S.esc.ways.push({ x0: 13, y0: 0, x1: 16, y1: 0, to: 'escape_sidh', at: [12, 41] })
  S.esc.ways.push({ x0: 13, y0: 47, x1: 16, y1: 47, to: 'escape_doimhne', at: [13, 2] })
  S.esc.watchers = 2; S.esc.foe = 'deep'
  out(S, [15, 45])
}

// ═════════════ 4. Astray: Balor's hall ════════════════════════════════════════════════════════
// Under Tory. The eye in the north wall, half-lidded; the giants at the lid; his gaze a red streak down the floor.
// His guards are far beyond a ghost at the height of his strength. Beaten here, you wake at the well.
{
  const S = scene('escape_balor', 28, 36, '#', 14, 'c'), rnd = rng(23)
  S.rect(3, 4, 24, 32, '.', 0, 'c')
  S.rect(25, 18, 27, 20, '.', 0, 'c')                               // in from the east
  for (let q = 0; q < 14; q++) { const x = 4 + rnd() * 19, y = 9 + rnd() * 22, r = 0.8 + rnd() * 1.4; circle(x, y, r, (a, b) => { if (a >= 4 && a <= 23 && b >= 9 && b <= 31 && !(b >= 17 && b <= 21)) S.set(a, b, '~', -0.3, 'c') }) }
  S.rect(13, 7, 14, 32, '.', 0.33, 'b'); S.rect(4, 18, 24, 20, '.', 0, 'c')
  S.rect(9, 4, 18, 6, '.', 0.67, 'b')
  for (const [x, y] of [[6, 11], [21, 11], [6, 25], [21, 25]]) S.set(x, y, '#', 14, 'c')
  S.prop({ type: 'eye', x: 13.5, y: 4.0, z: 6.2, w: 8, open: 0.24 })
  S.prop({ type: 'streak', x0: 12.7, x1: 14.3, y0: 7, y1: 36, z: 0.34, rgb: [255, 40, 15], a: 0.28, flicker: true, fade: 'south' })
  S.prop({ type: 'mob', c: 14, r: 18, x: 10.6, y: 5.6, z: 0.67, s: 1.25 })
  S.prop({ type: 'mob', c: 15, r: 18, x: 16.4, y: 5.6, z: 0.67, s: 1.25, flip: true })
  S.light(13.5, 5.2, 5.6, 16, [255, 60, 30], 1.5)
  for (let q = 0; q < 6; q++) S.light(5 + rnd() * 18, 9 + rnd() * 22, 0.3, 4, [80, 170, 190], 0.5)
  S.extra = { ambient: [0.03, 0.05, 0.075], drips: true, grade: { palette: 'ember', px: 3, strength: 0, source: { x: 13.5, y: 6, r: 18 }, follow: 'eye' } }
  S.zones.push({ x0: 3, y0: 4, x1: 24, y1: 32, zoom: 0.75 })
  S.esc.packs.push({ x0: 6, y0: 12, x1: 22, y1: 24, spots: [[13, 12], [14, 15], [9, 19], [18, 19]], foe: 'fomor' })
  S.esc.ways.push({ x0: 27, y0: 18, x1: 27, y1: 20, to: 'escape_gailearai', at: [2, 19] })
  S.esc.wake = { map: 'escape_tobar', at: [21, 40] }
  out(S, [24, 19])
}

// ═════════════ 5. An Sídh (the hall under the hill) ═══════════════════════════════════════════
// The folk at their fires: they let a ghost pass. In the middle of the floor a ring, and a púca caught in it, dancing,
// who can't stop.
{
  const S = scene('escape_sidh', 26, 46, '#', 10, 'c')
  S.rect(4, 6, 21, 37, '.', 0, 'm')
  S.rect(11, 38, 13, 45, '.', 0, 'm')                               // in from the south
  S.rect(8, 3, 17, 5, '.', 0.67, 'm'); S.rect(9, 6, 16, 6, '.', 0.33, 'm')
  passage(S, [[19, 6, 0], [21, 4, 0.67], [22, 1, 1.67], [22, 0, 1.67]], 2.4, 'c', { keep: true })    // out, behind the high seat
  for (const y of [12, 19, 26, 33]) for (const x of [6, 19]) S.set(x, y, '#', 10, 'w')
  walls(S, 10)
  for (const y of [13.5, 20.5, 27.5]) for (const x of [8.4, 16.6]) S.prop({ type: 'box', x, y, z: 0, w: 0.55, d: 4.2, h: 0.35, col: [96, 68, 40] })
  for (const y of [31.5, 13.5]) { S.prop({ type: 'embers', x: 12.5, y, z: 0 }); S.light(12.5, y, 0.7, 6, [255, 150, 70], 1.0) }
  S.prop({ type: 'cauldron', x: 14.4, y: 30.2, z: 0, r: 0.5, brew: [230, 190, 90] })
  S.prop({ type: 'box', x: 12.5, y: 4.0, z: 0.67, w: 1.3, d: 0.6, h: 1.1, col: [150, 108, 46] })
  S.prop({ type: 'mob', c: 8, r: 4, x: 12.1, y: 4.8, z: 0.67, s: 0.9, glow: '255,220,160' })
  S.prop({ type: 'mob', c: 13, r: 6, x: 13.3, y: 4.9, z: 0.67, s: 0.9, glow: '210,230,255' })
  const folk = [[10, 6, 9.4, 14.6], [11, 6, 7.4, 15.8], [12, 6, 9.3, 26.5], [10, 7, 15.9, 12.4], [13, 6, 17.6, 25.2], [11, 7, 15.9, 33.4], [12, 7, 7.5, 32.2], [8, 2, 10.6, 30.6]]
  folk.forEach(([c, r, x, y]) => S.prop({ type: 'mob', c, r, x, y, z: 0, s: 0.82, glow: '200,220,255', flip: x > 12.5 }))
  // the ring: pale toadstools round a worn circle, the púca in it
  for (let q = 0; q < 16; q++) { const a = q / 16 * Math.PI * 2; S.prop({ type: 'mite', x: 12.5 + Math.cos(a) * 1.9, y: 22 + Math.sin(a) * 1.5, z: 0, h: 0.18, r: 0.09, tone: [225, 215, 190] }) }
  S.light(12.5, 22, 1.6, 4, [200, 255, 210], 0.75)
  for (const [x, y, z] of [[8, 16, 3.2], [17, 11, 3.6], [10, 28, 3.0], [16, 34, 2.6], [12.5, 8.5, 4]]) { S.prop({ type: 'mob', c: 0, r: 20, x, y, z, s: 0.32, float: 0, glow: '130,230,255' }); S.light(x, y, z, 3.5, [120, 220, 255], 0.5) }
  for (const y of [34, 27, 20, 13]) S.prop({ type: 'mist', y, x0: 4.5, x1: 21.5, z: 0, rgb: [200, 215, 240], a: 0.08, count: 7 })
  S.light(12.5, 4.5, 3, 6.5, [255, 215, 150], 1.0)
  S.light(22, 2, 2.5, 4, [140, 180, 255], 0.5)
  S.extra = { ambient: [0.1, 0.09, 0.11] }
  S.zones.push({ x0: 4, y0: 6, x1: 21, y1: 37, zoom: 0.75, look: 0.05 })
  S.esc.npcs.push({ id: 'puca_ring', x: 12.5, y: 22, kind: 'puca', state: 'dancing', radius: 2.6 })
  S.esc.ways.push({ x0: 21, y0: 0, x1: 23, y1: 0, to: 'escape_droichead', at: [14, 49] })
  S.esc.ways.push({ x0: 11, y0: 45, x1: 13, y1: 45, to: 'escape_gailearai', at: [14, 1] })
  out(S, [12, 41])
}

// ═════════════ 6. An Droichead (the crossing) ═════════════════════════════════════════════════
// Near the top now: bridges over the dark, roots coming down out of the roof. More of them, and weaker; quick to run.
{
  const S = scene('escape_droichead', 28, 52, 'v', 0, 'c'), nz = createNoise2D(rng(31))
  cavern(S, 14, 48, 4.5, 3, 0, 'c', nz)                               // the south ledge
  cavern(S, 14, 31, 4.5, 3.6, 0.67, 'c', nz)                          // the island
  cavern(S, 22, 19, 3.2, 3.2, 1.33, 'c', nz)                          // the east stack
  cavern(S, 8, 8, 4.4, 4.6, 2.33, 'c', nz)                            // the north ledge
  S.rect(7, 0, 9, 4, '.', 2.33, 'c')
  bridge(S, 13, 14, 33, 46, 0.67, 0)                                   // south ledge to the island
  bridge(S, 17, 21, 29, 30, 0.67, 1.0, 'x')                            // the island to the east, and north to the stack
  bridge(S, 21, 22, 21, 30, 1.33, 1.0)
  bridge(S, 20, 21, 12, 17, 1.33, 1.33)                                // the stack north, then west to the north ledge
  bridge(S, 9, 21, 12, 13, 2.33, 1.33, 'x')
  S.rect(0, 0, 27, 0, '#', 9, 'c'); S.rect(7, 0, 9, 0, '.', 2.33, 'c')
  // the roof's roots, hanging into the dark: nearly up
  for (const [x0, x1, y0, y1] of [[4, 11, 3, 12], [17, 25, 15, 23], [10, 18, 27, 35]]) S.prop({ type: 'roots', x0, x1, y0, y1, z: 9, dz: 6.2, count: 50 })
  S.light(14, 40, -9, 16, [90, 140, 200], 0.6)
  S.light(8, 1, 4.5, 7, [150, 180, 255], 0.7)                         // the first of the light from above
  for (const [x, y, z] of [[14, 48, 0], [14, 31, 0.67], [22, 19, 1.33], [8, 8, 2.33]]) S.light(x, y, z + 1.6, 4.5, [255, 170, 100], 0.55)
  for (const [x, y, z] of [[14, 48, 1.6], [14, 31, 2.2], [22, 19, 2.9], [8, 8, 3.9]]) S.prop({ type: 'torch', x: x + 2.6, y: y - 1.97, z })
  S.extra = { ambient: [0.075, 0.08, 0.095], drips: true, abyss: true }
  S.zones.push({ x0: 0, y0: 0, x1: 27, y1: 51, zoom: 0.8 })
  S.esc.packs.push({ x0: 10, y0: 28, x1: 18, y1: 34, spots: [[11, 29], [17, 29], [12, 33], [16, 33]], foe: 'shallow' })
  S.esc.packs.push({ x0: 4, y0: 5, x1: 12, y1: 11, spots: [[5, 7], [11, 7], [6, 10], [10, 10], [8, 5]], foe: 'shallow' })
  S.esc.ways.push({ x0: 7, y0: 0, x1: 9, y1: 0, to: 'escape_foinse', at: [12, 33] })
  S.esc.ways.push({ x0: 12, y0: 51, x1: 16, y1: 51, to: 'escape_sidh', at: [22, 2] })
  S.rect(12, 50, 16, 51, '.', 0, 'c')
  S.esc.watchers = 3; S.esc.foe = 'shallow'
  out(S, [14, 49])
}

// ═════════════ Teach Duinn, seen: past the sea-door ═══════════════════════════════════════════════
// Through the sea-door in the hall's south-west corner: a landing at the mouth of a sea-cave, steps going down into
// still black water, and out beyond, through a fog full of the dead standing on the water, the rock of Donn with the
// way through it lit. Someone is coming over from it, in a hide boat, paddling with her hands (escape.js: esc.ferry).
// Stay, and she takes you across.
{
  const S = scene('escape_donn', 26, 44, '#', 8, 'c'), rnd = rng(53)
  for (let y = 0; y <= 31; y++) for (let x = 0; x < S.W; x++) S.set(x, y, '~', -1.0, 'p')        // the sea
  // the cave's mouth: rock either side, opening out toward the sea
  for (let y = 32; y <= 43; y++) for (const x of [0, 1, 2, 23, 24, 25]) S.set(x, y, '~', -1.0, 'p')     // the sea all about, out past the edges of sight
  // the ground at the cave's mouth: laid in the hall's stone, in courses curving round toward the sea (S.extra.floorArt);
  // the landing and the stair are the floor, and all about them the stones stand up in stacks, higher the further out
  for (let y = 30; y <= 43; y++) for (let x = 3; x <= 22; x++) S.set(x, y, '.', 0, 'm')
  for (let x = 3; x <= 22; x++) if (x < 9 || x > 16) S.set(x, 30, '~', -1.0, 'p')
  S.rect(9, 30, 16, 30, '~', -1.0, 'p')
  S.rect(9, 31, 16, 31, '.', -0.67, 'm'); S.rect(9, 32, 16, 32, '.', -0.33, 'm')     // the steps down into the water
  S.prop({ type: 'steps', x0: 9, x1: 17, y0: 31, y1: 32 })
  const stairZ = (y) => q3((y - 37) / 3)
  for (let y = 38; y <= 43; y++) S.rect(11, y, 14, y, '.', 0, 'm')                  // the stair down from the hall: its courses are stones (below)
  const inStair = (x, y) => x >= 11 && x <= 14 && y >= 38 && y <= 43
  const walk = (x, y) => (x >= 8 && x <= 17 && y >= 33 && y <= 37) || (x >= 9 && x <= 16 && (y === 31 || y === 32)) || (x >= 11 && x <= 14 && y >= 38)
  const ART = { cx: 12.5, cy: 21, rx: 2, ry: 2, g0: 1 }, CO = courses(ART), raised = new Map(), nStair = cellAt(ART, 12.5, 37.9, CO).n, stairStones = []
  for (let n = 0; n < CO.info.length; n++) for (let j = 0; j < CO.info[n].m; j++) {
    const G = cellGeom(ART, n, j, CO), pts = [G.ga, G.gb].flatMap(g => [G.t0, (G.t0 + G.t1) / 2, G.t1].map(t => ptAt(ART, g, t)))
    const mid = ptAt(ART, (G.ga + G.gb) / 2, (G.t0 + G.t1) / 2)
    if (mid.y < 31 || mid.y > 43.5 || mid.x < 3.4 || mid.x > 22.6) continue
    if (inStair(Math.floor(mid.x), Math.floor(mid.y))) { if (n >= nStair) stairStones.push({ n, j }); continue }   // a step (heights below)
    if (pts.some(q => q.y < 30.9 || q.y > 44 || q.x < 3 || q.x > 23 || walk(Math.floor(q.x), Math.floor(q.y)))) continue
    let d = Infinity
    for (let y = 31; y <= 43; y++) for (let x = 8; x <= 17; x++) if (walk(x, y)) d = Math.min(d, Math.hypot(x + 0.5 - mid.x, y + 0.5 - mid.y))
    let z = 0.67 + Math.max(0, d - 1) * 0.42 + (rnd() < 0.35 ? 0.33 : 0)
    if (mid.y > 37.5) z = Math.max(z, stairZ(Math.floor(mid.y)) + 0.67)
    raised.set(n + ',' + j, { n, j, z: Math.min(3.33, q3(z)) })
  }
  { // the stair's steps: each course of it a third higher than the one below, going up away from the sea
    const ns = [...new Set(stairStones.map(c => c.n))].sort((a, b) => a - b)
    for (const c of stairStones) raised.set(c.n + ',' + c.j, { ...c, z: Math.min(2.33, q3((ns.indexOf(c.n) + 1) / 3)) })
  }
  const zAt = (x, y) => { const c = cellAt(ART, x, y, CO); return c ? (raised.get(c.n + ',' + c.j)?.z ?? 0) : 0 }
  for (let y = 30; y <= 43; y++) for (let x = 3; x <= 22; x++) {
    if (S.kind[y][x] !== '.' || (walk(x, y) && !inStair(x, y))) continue
    let z = zAt(x + 0.5, y + 0.5)
    if (!z && !walk(x, y)) z = Math.max(...[[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]].map(([u, v]) => zAt(x + u, y + v)))   // (a gap between stacks: as high as the stones about it)
    if (z > 0) S.deck(x, y, z, 0.2, 'deck', true)
  }
  { // under the stair, the floor just under the lowest stone on each tile
    const zr = (x, y) => { const c = cellAt(ART, x, y, CO); const r = c && raised.get(c.n + ',' + c.j); return r ? r.z : 0 }
    for (let y = 38; y <= 43; y++) for (let x = 11; x <= 14; x++) S.z[y][x] = Math.max(0, Math.min(...[[0.5, 0.5], [0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]].map(([u, v]) => zr(x + u, y + v))) - 0.01) }
  { const cells = [...raised.values()]; let y0 = Infinity, y1 = -Infinity
    for (const c of cells) { const G = cellGeom(ART, c.n, c.j, CO); for (const g of [G.ga, G.gb]) for (const t of [G.t0, G.t1]) { const q = ptAt(ART, g, t); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y) } }
    S.prop({ type: 'stones', cells, y0: Math.floor(y0 - 0.1), y1: Math.floor(y1 + 0.1) }) }
  S.extra.floorArt = { ...ART, rect: [3, 29, 23, 44], ring: false, channels: [] }
  // Teach Duinn, far out: a rock on the edge of sight, the light through its arch, fog banks drifting across between
  S.prop({ type: 'farrock', x: 12.5, y: -70, z: -1.0, w: 30, h: 13 })
  S.prop({ type: 'fogbank', x0: -14, x1: 40, y: 0.2, z: -1.4, h: 4.5, a: 0.4, speed: 0.012 })
  // the fog, and the dead standing in it on the water
  S.prop({ type: 'wake', y0: 0, y1: 43, z: -1.0 })                              // rings where you walk into the sea (hewnRock.bump)
  S.prop({ type: 'seafog', row0: 24, z: -1.0, rgb: [52, 60, 72], a: 0.9 })        // the distance: the water going smoothly into the fog
  // the dead lying out on the water, pale, at every angle, drifting (the champions' sheet, without their kit)
  const BARE = [0, 2, 3, 4, 8, 12, 14, 31, 37, 38, 40, 60, 63, 73, 75, 81, 83, 89, 91, 97, 99, 109, 114, 117, 126, 132, 134, 135, 148, 149, 151, 153, 159, 160, 174, 176, 188, 189, 190, 194, 197, 236, 238, 245, 246, 251, 254, 257, 270, 273, 276, 277, 284, 285, 295, 301, 303, 307, 311, 314]      // the frames that are all but bare (no cloak, no kilt): they read as bodies
  const FR = JSON.parse(readFileSync(resolve(OUT_DIR, '../../assets/champions/champions0.json'), 'utf8')).textures[0].frames
  const rb = rng(1907)
  for (let i = 0; i < 46; i++) {
    const y = 4 + rb() * 25.5, x = 0.5 + rb() * (S.W - 1)
    if (Math.abs(x - 12.5) < 1.7) { rb(); rb(); rb(); continue }       // her way in is clear
    const f = FR[BARE[Math.floor(rb() * BARE.length)]].frame
    S.prop({ type: 'body', x, y, z: -1.0, sx: f.x, sy: f.y, sw: f.w, sh: f.h, rot: rb() * Math.PI * 2, s: 2.6, a: 0.5 + rb() * 0.25 })
  }
  S.prop({ type: 'ferry', id: 'ferry', x: 12.5, y: 0.6, z: -1.0, a: Math.PI / 2, woman: 'paddle', still: true })
  S.prop({ type: 'wraith', id: 'wraith', x: 12.5, y: 0.6, z: -1.0, pose: 'none' })
  S.esc.ferry = { path: [[12.5, 0.6], [12.5, 7], [13.2, 13], [12.4, 20.4]], drift: 1.3, foot: [12.5, 30.75], z: -1.0, grace: 7, secs: 30, zone: { x0: 0, y0: 0, x1: 25, y1: 38 } }
  S.light(12.5, 37, 1.6, 6, [185, 200, 225], 0.4)                      // grey light from the sea-door behind you
  S.extra = { ...S.extra, ambient: [0.11, 0.12, 0.14], abyss: false, ripples: false, glints: false, bg: ['#0a0d11', '#2a313b', '#4e5866', '#252c35', '#0c1015', '#000000', '#000000', '#000000', '#000000', '#000000'] }
  S.zones.push({ x0: 0, y0: 0, x1: 25, y1: 43, zoom: 0.8 })
  S.esc.ways.push({ x0: 11, y0: 43, x1: 14, y1: 43, to: 'escape_tobar', at: [2, 43], dark: true })
  out(S, [12, 42])
}

// ═════════════ 7. Foinse na Bóinne (the source) ════════════════════════════════════════════════
// The water comes up out of the ground into a pool and goes away north as a river. Roots overhead, then earth, then
// the night sky. The last stair is the way out of the underworld.
{
  const S = scene('escape_foinse', 26, 36, '#', 7, 'c'), nz = createNoise2D(rng(41))
  cavern(S, 12.5, 24, 8, 8.5, 0, 'c', nz, 0.12)
  circle(12.5, 22, 3.2, (x, y) => S.set(x, y, '~', -0.3, 'p'))
  for (const [x, y] of [[9, 22], [16, 22]]) S.set(x, y, '.', 0, 'c')
  passage(S, [[12, 33, 0], [12, 35, 0]], 3, 'c', { keep: false })
  // the river north, beside the last stair
  for (let y = 4; y <= 18; y++) for (const x of [14, 15]) S.set(x, y, '~', q3(-0.3 + (18 - y) * 0.2), 'p')
  passage(S, [[11, 16, 0], [11, 12, 1.0], [11, 8, 2.0], [11, 4, 3.0], [11, 0, 3.33]], 2.6, 'c', { keep: false })
  cliffs(S, 0, 1.1, 8)
  for (let y = 0; y <= 6; y++) for (let x = 0; x < S.W; x++) if (S.kind[y][x] === '#') S.z[y][x] = Math.min(S.z[y][x], 4.6 + y * 0.5)   // the roof gives way to the open
  S.prop({ type: 'roots', x0: 6, x1: 19, y0: 16, y1: 30, z: 7, dz: 4, count: 70 })
  S.prop({ type: 'shaft', x: 12.5, y: 22, z0: 0, z1: 9, w: 0.8, rgb: [170, 190, 255] })
  S.prop({ type: 'fish', x: 12.5, y: 22, z: -0.3, rad: 2.2, count: 1, rgb: [210, 200, 180] })        // the salmon
  S.light(12.5, 22, 0.8, 9, [190, 215, 255], 1.0)
  S.light(11, 2, 5, 9, [140, 165, 230], 0.9)
  for (const y of [24, 21]) S.prop({ type: 'mist', y, x0: 9, x1: 16, z: -0.3, rgb: [210, 225, 255], a: 0.09, count: 4 })
  S.extra = { ambient: [0.09, 0.1, 0.13], bg: ['#05070f', '#0c1428', '#1a2747', '#000000'] }
  S.zones.push({ x0: 4, y0: 15, x1: 21, y1: 33, zoom: 0.75 })
  S.esc.ways.push({ x0: 9, y0: 0, x1: 13, y1: 0, to: '', at: [0, 0] })
  S.esc.ways.push({ x0: 11, y0: 35, x1: 13, y1: 35, to: 'escape_droichead', at: [8, 2] })
  S.esc.end = true
  out(S, [12, 33])
}
