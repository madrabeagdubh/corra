// dashFx.js
// Location: js/game/combat/dashFx.js
//
// What the dash looks like (the engine is melee.js: DASH, FOE_DASH, startDash, _foeDashGo). Yours and the foe's are one picture:
//
//   the gather      the body low and coiled, a tremble; (his: the lane glows red, melee's own target quads)
//   the going       a faint comet of blue light along the line; afterimages of you (meleeBout's ghosts, the bullet-time
//                   blue); dust and a whoosh where you left
//   the standing    through, and still: back to the one you passed, the body low, the blade at the hip pointing back
//                   the way you came. The edges of the screen darken a little.
//   the cut         X slashes across him (only if it lands), a ring, and he is thrown on
//
// The view calls: onEvent (the four events), draw(view, ctx) (over the finished frame), and the pose helpers below.

import { whoosh } from '../scenes/locations/skye/dustDash.js'

const clamp01 = u => Math.max(0, Math.min(1, u))
const easeOut = u => 1 - (1 - clamp01(u)) ** 3
const easeIO = u => (1 - Math.cos(Math.PI * clamp01(u))) / 2
const rnd = (seed, i) => { const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453; return x - Math.floor(x) }     // steady "random": the same per dash, per i
const GOLD = '110,185,255', WHITE = '235,246,255'          // (the bullet-time blue of your afterimages)
export const POSE_HAND = [0.10, 0.20]                  // the grip at the hip, in body heights (x toward the side the blade trails; y down)

export function newState() { return { p: null, f: null, cuts: [], flash: -1e9, dust: [] } }

// ── events ──────────────────────────────────────────────────────────────────
export function onEvent(v, name, d = {}) {
  const S = v.dfx, now = v.now()
  const buzz = ms => { try { navigator.vibrate?.(ms) } catch (_) {} }
  if (name === 'dashStart') {
    S.p = { t0: now, from: d.from, to: d.to, dir: d.dir, ms: d.ms, seed: Math.random() * 100, cutT: null }
    goFx(v, d.from, d.to, d.ms)
    buzz([20, 30, 20])
  } else if (name === 'foeSwing' && d.dash) {
    const f = v.m.foe
    S.f = { t0: now, from: f.dashFrom || [f.c, f.r], to: [f.c, f.r], dir: f.dashDir || [1, 0], ms: 300, seed: Math.random() * 100, cutT: null }
    goFx(v, S.f.from, S.f.to, S.f.ms)
  } else if (name === 'dashCut') {
    S.cuts.push({ t0: now, tiles: d.foes, dir: d.dir, seed: Math.random() * 100 })
    if (S.p) S.p.cutT = now
    buzz([40, 25, 60])
  } else if (name === 'foeCut') {
    const t = v.m.pa.tile(), f = v.m.foe
    if (S.f) S.f.cutT = now
    if (d.hit) { S.cuts.push({ t0: now, tiles: [[t[0], t[1]]], dir: f.dashDir || [1, 0], seed: Math.random() * 100, onPlayer: true }); buzz([40, 25, 60]) }
  } else if (name === 'dashEnd') {
    // (the afterglow fades on its own)
  }
}
// a whoosh, and dust: a low scuff where it began, a skid where it stopped
function goFx(v, from, to, ms) {
  try {
    whoosh(v.scene, 0.3, 0.42, 3200, 300)
    const now = v.now(), S = v.dfx
    for (let i = 0; i < 7; i++) S.dust.push({ at: from, t0: now, life: 600 + 300 * Math.random(), ox: (Math.random() - 0.5) * 0.6, k: 0.3 + 0.7 * Math.random(), up: 0.1 + 0.25 * Math.random(), back: true, to })
    for (let i = 0; i < 6; i++) S.dust.push({ at: to, t0: now + ms * 0.9, life: 650 + 300 * Math.random(), ox: (Math.random() - 0.5) * 0.5, k: 0.3 + 0.7 * Math.random(), up: 0.1 + 0.2 * Math.random(), back: false, from })
    setTimeout(() => { try { whoosh(v.scene, 0.14, 0.25, 900, 3200) } catch (_) {} }, ms * 0.9)
  } catch (_) {}
}
function drawDust(v, ctx, now) {
  const S = v.dfx
  S.dust = S.dust.filter(d => now - d.t0 < d.life)
  for (const d of S.dust) {
    const age = (now - d.t0) / d.life
    if (age < 0) continue
    const F = v.figure(d.at[0], d.at[1]), O = v.figure(d.back ? d.to[0] : d.from[0], d.back ? d.to[1] : d.from[1])
    if (!F || !O) continue
    let ux = O.x - F.x, uy = O.y - F.y; const mg = Math.hypot(ux, uy) || 1; ux /= mg; uy /= mg
    const sgn = d.back ? -1 : 1                                              // left behind where it began; carried on where it stopped
    const dist = F.w * (0.25 + 1.1 * d.k) * easeOut(age) * sgn
    const x = F.x + d.ox * F.w + ux * dist, y = F.y - F.w * d.up * age + uy * dist * 0.35
    const r = F.w * (0.1 + 0.2 * age) * (0.7 + 0.5 * d.k)
    ctx.fillStyle = `rgba(206,190,156,${0.42 * (1 - age) * (1 - age)})`
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r, 0, 0, Math.PI * 2); ctx.fill()
  }
}

// ── how the bodies stand ────────────────────────────────────────────────────
// where the dash is, in time: null when there is none. k: how far along the going (0..1), u: along the standing (0..1)
export function phase(m, D) {
  if (!D) return null
  const el = m.t - D.t0, k = clamp01(el / D.glide)
  return { el, k, u: clamp01((el - D.glide) / Math.max(1, D.end - D.glide)), going: el < D.glide, cutDone: el >= D.cutAt }
}
function crouch(P, dirX, now) {
  // low and still, a little settling; after the cut a kick back, and up
  const settle = easeOut((P.el - 0) / 120)
  let sy = 0.84, sx = 1.12, rot = dirX * 0.1, dy = 0.035, dx = 0
  if (P.cutDone) { const q = clamp01((P.el - P.cutAt) / 320); rot -= dirX * 0.2 * Math.sin(Math.PI * q) * (1 - q); dy -= 0.03 * Math.sin(Math.PI * Math.min(1, q * 1.6)) }
  const rise = clamp01((P.u - 0.78) / 0.22)                                               // standing up at the end
  return { dx, dy: dy * (1 - rise), rot: rot * (1 - rise), sx: 1 + (sx - 1) * (1 - rise) * settle, sy: 1 - (1 - sy) * (1 - rise) * settle }
}
export function playerPose(v) {
  const m = v.m, D = m.dash, P = phase(m, D)
  if (!P) return null
  const dirX = Math.sign(v.screenVec(D.from, D.to)[0]) || (v.side?.() ?? 1)
  if (P.going) return { dx: 0, dy: -0.02, rot: dirX * 0.3, sx: 1.3, sy: 0.88 }
  P.cutAt = D.cutAt - D.glide; P.el -= D.glide
  return crouch(P, dirX, v.now())
}
// which way he faces while it lasts: the way he went (away from the one he passed)
export function playerFacing(D) {
  if (!D) return null
  return { away: D.dir[1] < 0 ? true : D.dir[1] > 0 ? false : null, left: D.dir[0] < 0 ? true : D.dir[0] > 0 ? false : null }
}
// the blade: trailing at the hip, pointing back along the way he came
export function playerBlade(v, side, hw) {
  const m = v.m, D = m.dash, P = phase(m, D)
  if (!P) return null
  const back = v.screenAngle(D.to, D.from)
  const k = P.going ? 0.6 + 0.4 * easeOut(P.k) : 1
  return { angle: back, hand: [-side * POSE_HAND[0] * hw * k, POSE_HAND[1] * hw * k] }
}
// the foe's: the gather (coiled, trembling), the going (stretched), the standing (as yours)
export function foePose(v, foe, fs, now) {
  const m = v.m
  if (foe.dash && foe.state === 'wind') {
    const k = clamp01((m.t - foe.st0) / Math.max(1, foe.until - foe.st0)), dirX = Math.sign((foe.dashDir || [1, 0])[0]) || 1
    return { dx: Math.sin(now / 28) * 0.012 * k, dy: 0.03 * easeOut(k), rot: -dirX * 0.16 * easeOut(k), sx: 1 + 0.14 * easeOut(k), sy: 1 - 0.2 * easeOut(k) }
  }
  if (foe.dashUntil > m.t && foe.dashT0 != null) {
    const el = m.t - foe.dashT0, dirX = Math.sign((foe.dashDir || [1, 0])[0]) || 1
    const G = 300, C = 340, P = 1000
    if (el < G) return { dx: 0, dy: -0.02, rot: dirX * 0.3, sx: 1.3, sy: 0.88 }
    return crouch({ el: el - G, cutAt: C, cutDone: el >= G + C, u: clamp01((el - G) / (P - G)) }, dirX, now)
  }
  return null
}
export function foeBlade(v, foe, fs, ff) {
  const m = v.m
  if (!((foe.dash && foe.state === 'wind') || (foe.dashUntil > m.t && foe.dashT0 != null))) return null
  const from = foe.dashFrom || [foe.c, foe.r], to = [foe.c, foe.r]
  const wind = foe.dash && foe.state === 'wind'
  // gathering: the blade drawn back, held low (pointing along the lane's far end); then trailing, as yours
  const back = wind ? v.screenAngle([foe.c, foe.r], foe.lane?.[foe.lane.length - 1] || [foe.c + 1, foe.r]) + 180 : v.screenAngle(to, from)
  return { angle: back, hand: [-fs * POSE_HAND[0] * ff.h / ff.w, POSE_HAND[1] * ff.h / ff.w] }
}

// ── the picture ─────────────────────────────────────────────────────────────
export function draw(v, ctx) {
  const S = v.dfx, now = v.now(), W = ctx.canvas.width, H = ctx.canvas.height
  S.cuts = S.cuts.filter(c => now - c.t0 < 800)
  drawDust(v, ctx, now)
  for (const k of ['p', 'f']) {
    const s = S[k]
    if (!s) continue
    if (now - s.t0 > s.ms + 1500) { S[k] = null; continue }
    comet(v, ctx, s, now)
  }
  // the tension: the edges close in
  for (const k of ['p', 'f']) {
    const s = S[k]
    if (!s) continue
    const el = now - s.t0, standing = el > s.ms * 0.8, cutAge = s.cutT ? now - s.cutT : -1
    let a = standing ? easeOut((el - s.ms * 0.8) / 200) : 0
    if (cutAge >= 0) a *= 1 - clamp01(cutAge / 380)
    if (a <= 0.01) continue
    const g = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.2, W / 2, H * 0.55, Math.hypot(W, H) * 0.6)
    g.addColorStop(0, 'rgba(8,6,16,0)'); g.addColorStop(1, `rgba(8,6,16,${0.72 * a})`)
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }
  for (const c of S.cuts) cutFx(v, ctx, c, now)
}

// the streak left along the line: a comet (blue glow, pale core)
function comet(v, ctx, s, now) {
  const el = now - s.t0, k = clamp01(el / s.ms), e = 1 - (1 - k) * (1 - k)
  const fade = el < s.ms ? 1 : clamp01(1 - (el - s.ms) / 650)
  if (fade <= 0.01) return
  const A = v.figure(s.from[0], s.from[1]), B = v.figure(s.to[0], s.to[1])
  if (!A || !B) return
  const lift = 0.5
  const ax = A.x, ay = A.y - A.h * lift, bx = B.x, by = B.y - B.h * lift
  const hx = ax + (bx - ax) * e, hy = ay + (by - ay) * e                       // the head of it, where he is now
  const len = Math.hypot(hx - ax, hy - ay) || 1, ux = (hx - ax) / len, uy = (hy - ay) / len, px = -uy, py = ux
  const w = (A.w + B.w) / 2
  ctx.save()
  ctx.lineCap = 'round'
  // two layers: the glow (wide, gold) and the core (narrow, white), each a long thin triangle tapering to the tail
  for (const [rgb, width, al] of [[GOLD, w * 0.62, 0.28], [GOLD, w * 0.34, 0.45], [WHITE, w * 0.14, 0.95]]) {
    const wd = width * (el < s.ms ? 1 : 0.35 + 0.65 * fade)
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx + px * wd / 2, hy + py * wd / 2); ctx.lineTo(hx - px * wd / 2, hy - py * wd / 2); ctx.closePath()
    ctx.fillStyle = `rgba(${rgb},${al * fade})`; ctx.fill()
  }
  ctx.restore()
}

// the cut: crossed slashes, a flash, a ring
function cutFx(v, ctx, c, now) {
  const u = (now - c.t0) / 650
  if (u < 0 || u >= 1) return
  for (const tile of c.tiles) {
    const F = c.onPlayer ? v.playerFigure() : v.figure(tile[0], tile[1])
    if (!F) continue
    const x = F.x, y = F.y - F.h * 0.5, w = F.w
    const dv = v.screenVec([tile[0] - c.dir[0], tile[1] - c.dir[1]], tile), ang = Math.atan2(dv[1], dv[0])
    ctx.save()
    ctx.translate(x, y)
    // a burst of light at the moment
    const fb = clamp01(1 - u / 0.22)
    if (fb > 0) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.1); g.addColorStop(0, `rgba(${WHITE},${0.95 * fb})`); g.addColorStop(1, `rgba(${GOLD},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w * 1.1, 0, Math.PI * 2); ctx.fill() }
    // three slashes across the line of the dash, one long, two short, each drawn quickly then fading
    const sl = [[ang + Math.PI / 2 - 0.55, 2.6, 0], [ang + Math.PI / 2 + 0.5, 2.1, 0.04], [ang + Math.PI / 2 - 0.05, 1.5, 0.08]]
    for (const [a, L0, delay] of sl) {
      const q = clamp01((u - delay) / 0.2), fade = clamp01(1 - (u - delay - 0.12) / 0.5)
      if (q <= 0 || fade <= 0) continue
      const L = w * L0 * easeOut(q), cx = Math.cos(a), cy = Math.sin(a), nx = -cy, ny = cx, th = w * 0.09
      for (const [rgb, m, al] of [[GOLD, 2.6, 0.35], [WHITE, 1, 1]]) {
        ctx.beginPath()
        ctx.moveTo(-cx * L / 2, -cy * L / 2); ctx.lineTo(nx * th * m, ny * th * m); ctx.lineTo(cx * L / 2, cy * L / 2); ctx.lineTo(-nx * th * m, -ny * th * m); ctx.closePath()
        ctx.fillStyle = `rgba(${rgb},${al * fade})`; ctx.fill()
      }
    }
    // the ring, flat on the ground, and a star of short lines
    const rq = easeOut(u / 0.7)
    ctx.strokeStyle = `rgba(${WHITE},${0.8 * (1 - u)})`; ctx.lineWidth = Math.max(2, w * 0.05 * (1 - u))
    ctx.beginPath(); ctx.ellipse(0, F.h * 0.45, w * (0.3 + 1.5 * rq), w * (0.3 + 1.5 * rq) * 0.35, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = `rgba(${GOLD},${0.9 * (1 - u)})`; ctx.lineWidth = Math.max(1.5, w * 0.03)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rnd(c.seed, i) * 0.3, r1 = w * (0.25 + 0.9 * easeOut(u / 0.5)), r2 = r1 + w * (0.25 + 0.4 * rnd(c.seed, i + 20))
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); ctx.stroke()
    }
    ctx.restore()
  }
}
