// swordRig.js
// Location: js/game/combat/swordRig.js
//
// Where a held sword and its scabbard are, and how they're drawn. Shared by
// PGR's weapon overlay (pgr/pgrPlayerBoat.js) and the fight's view
// (meleeView.js), so both agree where the scabbard's mouth is.
//
// Units: tile widths, measured from the sword HAND's resting place (the
// side the player faces, 0.4 of the way up the body). The Oryx swords have
// their tip at the image's top left and the grip at the bottom right.
//
// A pose (scene.weaponPose()) is one of:
//   null                       sheathed: the hilt standing out of the scabbard
//   { sheath: 0..1 }           sliding out (or in): 0 in the scabbard, 1 just clear of it
//   { angle, hand: [dx, dy] }  in the hand: angle in screen degrees (0 right,
//                              -90 up); hand offset in tile widths

export const SWORD_SCALE = 0.7          // the sword's drawn size, in tile widths (before PLAYER_SCALE)

// in source pixels of the 16 px icon
const GRIP = [12, 12], GUARD_GAP = 2.8, GRIP_TO_TIP = 12.7

// Scabbard on the hip away from the sword hand, the hilt leaning toward the
// hand so it can be drawn across the body.
export function rig(side, ps) {
  const px = SWORD_SCALE * ps / 16                  // tile widths per source pixel
  const axisDeg = 90 + side * 35                    // from the mouth toward the scabbard's tip
  const a = axisDeg * Math.PI / 180, u = [Math.cos(a), Math.sin(a)]
  const mouth = [-side * 0.3 * ps, -0.03 * ps]
  return {
    px, axisDeg, u, mouth,
    bladeLen: GRIP_TO_TIP * px,
    // where the grip is with the blade drawn k of the way out (0 = home, 1 = clear)
    gripAt(k) { const d = (GUARD_GAP + k * (GRIP_TO_TIP - GUARD_GAP)) * px; return [mouth[0] - u[0] * d, mouth[1] - u[1] * d] },
  }
}

// Draw the scabbard and the sword. x, y: the player's feet on screen; w: the
// row's tile width in px; ps: PLAYER_SCALE; side: -1 facing left, 1 right.
export function drawHeldSword(ctx, img, { x, y, w, ps, side, pose }) {
  const R = rig(side, ps)
  const H = w * 1.8 * ps
  const hx = x + side * w * 0.2 * ps, hy = y - H * 0.4            // the hand at rest
  const P = ([dx, dy]) => [hx + dx * w, hy + dy * w]
  const mouth = P(R.mouth), s = R.px * w                          // s: screen px per source px
  const sheathK = pose == null ? 0 : pose.sheath

  // the scabbard: dark leather, a little lighter at the edge, a metal chape at the tip
  ctx.save()
  ctx.translate(mouth[0], mouth[1]); ctx.rotate(R.axisDeg * Math.PI / 180)
  const L = (GRIP_TO_TIP + 1) * s, wd = Math.max(2, 2.6 * s)
  ctx.fillStyle = '#3a2716'; ctx.fillRect(0, -wd / 2, L, wd)
  ctx.fillStyle = '#5a3d22'; ctx.fillRect(0, -wd / 2, L, Math.max(1, wd * 0.3))
  ctx.fillStyle = '#9a8a6a'; ctx.fillRect(L - wd * 0.9, -wd / 2, wd * 0.9, wd)
  ctx.restore()

  // the blur of a cut: a crescent swept by the blade itself, through where it has just been (pose.smear)
  if (sheathK == null && pose.smear) drawSmear(ctx, pose.smear, P, GRIP_TO_TIP * s)

  ctx.save()
  let gx, gy, ang
  if (sheathK != null) {
    // in or partly out of the scabbard: along its axis, hidden past the mouth
    ;[gx, gy] = P(R.gripAt(Math.max(0, Math.min(1, sheathK))))
    ang = R.axisDeg
    ctx.translate(mouth[0], mouth[1]); ctx.rotate(R.axisDeg * Math.PI / 180)
    ctx.beginPath(); ctx.rect(-4000, -4000, 4000, 8000); ctx.clip()   // keep only what's outside the mouth
    ctx.rotate(-R.axisDeg * Math.PI / 180); ctx.translate(-mouth[0], -mouth[1])
  } else {
    ;[gx, gy] = P(pose.hand || [0, 0])
    ang = pose.angle ?? -90
  }
  ctx.translate(gx, gy)
  ctx.rotate((ang + 135) * Math.PI / 180)
  ctx.imageSmoothingEnabled = false
  const sc = s * 16 / img.width
  ctx.drawImage(img, -GRIP[0] / 16 * img.width * sc, -GRIP[1] / 16 * img.height * sc, img.width * sc, img.height * sc)
  ctx.restore()
}

// The blur a cut leaves: a crescent between the tip's path and a line partway down the blade, swept through the
// blade's own recent poses (smear.pts: [{ angle, hand }], oldest first), so it follows the cut exactly -- the hand
// moving with it -- and is thickest in the middle, as the old arc was.
function drawSmear(ctx, smear, P, len) {
  const pts = smear.pts, n = pts.length
  if (n < 3 || !(smear.a > 0.02)) return
  const outer = [], inner = []
  pts.forEach((q, i) => {
    const u = i / (n - 1), [gx, gy] = P(q.hand || [0, 0]), a = q.angle * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a)
    const ro = len * (0.86 + 0.14 * u), th = len * 0.34 * Math.sin(Math.PI * Math.pow(u, 0.7))
    outer.push([gx + c * ro, gy + sn * ro]); inner.push([gx + c * (ro - th), gy + sn * (ro - th)])
  })
  ctx.save()
  ctx.beginPath(); outer.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(inner[i][0], inner[i][1])
  ctx.closePath()
  ctx.fillStyle = `rgba(245,232,200,${0.32 * smear.a})`; ctx.fill()
  ctx.restore()
}

// ── the cut ──────────────────────────────────────────────────────────────
// A cut as keyframes, not a line turning on a pin: the blade lifted high and back, driven through the target,
// carried right round to finish low across the body -- from where the backhand rises through the target again
// and finishes high, ready for the next. Each key: [k, off, f, r, ease into it]
//   off   degrees from the line to the target, turned the way the swordsman faces (side)
//   f, r  the hand: forward toward the target, and raised, in tile widths (kept near the body: the arms are the sprite's)
const FORE = [[0, -25, 0.12, 0.05], [0.36, -135, -0.08, 0.32, 'out'], [0.56, 0, 0.24, 0.04, 'in'], [0.7, 75, 0.18, -0.08, 'lin'], [1, 140, 0.04, -0.1, 'out']]
const BACK = [[0, 140, 0.04, -0.1], [0.3, 95, 0.12, -0.06, 'out'], [0.56, 0, 0.24, 0.06, 'in'], [0.75, -80, 0.12, 0.22, 'lin'], [1, -135, -0.08, 0.32, 'out']]
export const CUT_HIT = 0.56               // the blade crosses the target here (melee SW hitAt / vis)
const EASE = { in: q => q * q, out: q => 1 - (1 - q) * (1 - q), lin: q => q }

// hand offset (tile widths) for f forward toward a screen angle `aim`, r raised
const handAt = (aim, f, r) => { const a = aim * Math.PI / 180; return [Math.cos(a) * f, Math.sin(a) * f * 0.5 - r] }

/** where blade and hand are at progress k (0..1) of a cut at screen angle `aim` */
export function cutPose(k, aim, side, backhand = false) {
  const K = backhand ? BACK : FORE, q = Math.max(0, Math.min(1, k))
  let i = 1
  while (i < K.length - 1 && q > K[i][0]) i++
  const [k0, o0, f0, r0] = K[i - 1], [k1, o1, f1, r1, e] = K[i]
  const t = (EASE[e] || EASE.lin)(Math.max(0, Math.min(1, (q - k0) / (k1 - k0))))
  const off = o0 + (o1 - o0) * t
  return { angle: aim + side * off, hand: handAt(aim, f0 + (f1 - f0) * t, r0 + (r1 - r0) * t) }
}

/** on guard, facing him: the point at his eyes, breathing (t: ms, on the world's clock) */
export function guardPose(aim, side, t, feint = 0) {
  const b = Math.sin(t / 650)
  return { angle: aim + side * (-25 + 3 * b - 10 * feint), hand: handAt(aim, 0.12 + 0.1 * feint, 0.05 + 0.012 * Math.sin(t / 650 + 1)) }
}

/** the blur behind a moving blade: its poses back along its path from k to (no further than) kMin */
export function cutSmear(at, k, kMin = 0, span = 0.16, n = 10) {
  const top = Math.min(1, k), pts = []
  for (let j = n; j >= 0; j--) { const q = top - span * j / n; if (q >= kMin) pts.push(at(q)) }
  if (pts.length < 3) return null
  let travel = 0
  for (let i = 1; i < pts.length; i++) travel += Math.abs(((pts[i].angle - pts[i - 1].angle) % 360 + 540) % 360 - 180)
  return { pts, a: Math.min(1, travel / 70) }
}
