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

// The terminator is softened by a MASK: everything but the dark part of the disc, blurred (the limb side stays solid, so the bright edge is crisp and the soft edge
// runs out into it at the horns with no cut). The blurred mask is kept until the phase moves on.
const SOFT = 0.26                // how far the light eases out toward the terminator, as a share of the radius
const CAN_BLUR = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype
let off = null
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
const maskCache = { key: '', c: null, pad: 0 }
function softMask(n, sc, r, phase, waning, tilt) {
    const key = [n, Math.round(r * sc), Math.round(phase * 90), waning ? 1 : 0, Math.round(tilt * 60)].join('|')
    if (maskCache.key === key && maskCache.c) return maskCache
    const b = Math.max(1, r * sc * SOFT * 0.55), pad = Math.ceil(b * 3), N = n + pad * 2
    const m = mk(N, N), g = m.getContext('2d')
    g.fillStyle = '#fff'; g.fillRect(0, 0, N, N)
    g.save(); g.translate(N / 2, N / 2); g.scale(sc, sc)
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip()
    g.globalCompositeOperation = 'destination-out'; g.fillRect(-r - 2, -r - 2, r * 2 + 4, r * 2 + 4)       // the disc, cleared ...
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff'; litPath(g, 0, 0, r, phase, waning, tilt); g.fill()   // ... but for the lit part
    g.restore()
    const m2 = mk(N, N), g2 = m2.getContext('2d')
    g2.filter = `blur(${b}px)`; g2.drawImage(m, 0, 0); g2.filter = 'none'
    maskCache.key = key; maskCache.c = m2; maskCache.pad = pad
    return maskCache
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
        const soft = CAN_BLUR && phase < 0.985
        // the lit part is laid down on a spare canvas so its edge can be eased away there
        const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b) || 1, n = Math.ceil(s * 2 * sc), o = soft ? (off = off && off.width === n && off.height === n ? off : mk(n, n)) : null, g = o ? o.getContext('2d') : ctx
        const ox = o ? s : cx, oy = o ? s : cy
        if (o) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, n, n); g.setTransform(sc, 0, 0, sc, 0, 0) }
        g.save()
        litPath(g, ox, oy, r, phase, waning, tilt); g.clip()
        g.drawImage(IMG, ox - s, oy - s, s * 2, s * 2)
        g.globalCompositeOperation = 'color'; g.fillStyle = TINT; g.fillRect(ox - r, oy - r, r * 2, r * 2)
        g.globalCompositeOperation = 'screen'; g.fillStyle = LIFT; g.fillRect(ox - r, oy - r, r * 2, r * 2)
        g.restore()
        if (o) {
            const mk2 = softMask(n, sc, r, phase, waning, tilt)
            g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(mk2.c, -mk2.pad, -mk2.pad); g.restore()
            ctx.drawImage(o, cx - s, cy - s, n / sc, n / sc)
        }
    }
    ctx.restore()
    return true
}
