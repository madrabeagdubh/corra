// moonFace.js -- the moon's own face (public/assets/moon.png, a full moon on a clear ground), drawn at any phase.
//
// Used by the moon tile (moonWidget.js) and the champion sky's moon (starSky.js), so the two are the same moon.
// The phase is the lit share: 0 new, 1 full; waxing is lit from the right, waning from the left. The lit part is the
// photograph, tinted toward the game's moonlight (a cold lavender); the dark part keeps the face faintly, as earthshine
// does. The photograph's edge has a pale fringe, so it is drawn a touch larger than the disc and clipped to it.
//
//   import { drawMoonFace } from './moonFace.js'
//   if (!drawMoonFace(ctx, cx, cy, r, phase, waning)) { ...draw something else while the picture loads... }
//   drawMoonFace(ctx, cx, cy, r, phase, waning, tilt)   // tilt: the terminator turned (radians, + clockwise); the face is not

const IMG = new Image()
const waiting = []
IMG.onload = () => { while (waiting.length) { try { waiting.shift()() } catch (e) { } } }
IMG.src = 'assets/moon.png'
export const moonFaceReady = () => IMG.complete && IMG.naturalWidth > 0
/** Call `fn` once the picture has loaded (at once if it has). */
export function whenMoonFaceReady(fn) { if (moonFaceReady()) fn(); else waiting.push(fn) }

const EARTHSHINE = 0.13          // how much of the face the dark part keeps
const TINT = 'rgba(170,164,255,0.30)', LIFT = 'rgba(70,72,110,0.30)'   // the moonlight's colour over the photograph; a little lift

// the lit part's outline: the bright limb on one side, the terminator (half an ellipse) across; turned by tilt (a path
// keeps the transform it was built under, so the picture clipped by it is not turned)
function litPath(ctx, cx, cy, r, phase, waning, tilt = 0) {
    ctx.beginPath()
    if (phase >= 0.99) { ctx.arc(cx, cy, r, 0, Math.PI * 2); return }
    const tx = r * Math.cos(phase * Math.PI)
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt)
    if (!waning) { ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.ellipse(0, 0, Math.abs(tx), r, 0, Math.PI / 2, -Math.PI / 2, tx > 0) }
    else { ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2); ctx.ellipse(0, 0, Math.abs(tx), r, 0, -Math.PI / 2, Math.PI / 2, tx > 0) }
    ctx.restore()
}

/** Draw the face in a disc of radius r at (cx, cy). The caller draws any glow first and the dark disc under it.
 *  Returns false (drawing nothing) until the picture has loaded. */
export function drawMoonFace(ctx, cx, cy, r, phase, waning = false, tilt = 0) {
    if (!moonFaceReady()) return false
    const s = r * 1.03
    ctx.save()
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
    ctx.globalAlpha = EARTHSHINE; ctx.drawImage(IMG, cx - s, cy - s, s * 2, s * 2); ctx.globalAlpha = 1
    if (phase > 0.005) {
        litPath(ctx, cx, cy, r, phase, waning, tilt); ctx.clip()
        ctx.drawImage(IMG, cx - s, cy - s, s * 2, s * 2)
        ctx.globalCompositeOperation = 'color'; ctx.fillStyle = TINT; ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
        ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = LIFT; ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    }
    ctx.restore()
    return true
}
