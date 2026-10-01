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
