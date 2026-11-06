// puca.js
// Location: js/game/effects/puca.js
//
// The púca, and Géaga's face: drawn among hewn rock (effects/hewnRock.js) by the escape scene (cave/escape.js).
//
//   drawPuca(h, ctx, p)     p: { x, y, z, state, t }   state: 'bound' (in a snare), 'dancing' (caught in a ring),
//                           'standing', 'leaving' (t: seconds since it went: up and away north, a horse of the air)
//   drawGeagaFace(h, ctx, g)   g: { x, y, z, wake }   two slits of light in the roots, opening as wake goes 0..1
//
// The sprite is a PLACEHOLDER, drawn here as pixel art: a small black horse with a goat's curled horns and gold eyes.

const ART = [
  [
    '........................',
    '........................',
    '........................',
    '...................hh...',
    '..................h..h..',
    '..................h.hk..',
    '.................mkkkk..',
    '................mmkykkk.',
    '...............mmkkkkkkk',
    '..............mmkkkd.kkk',
    '.............mmkkk...dkk',
    '..kkkkkkkkkkmkkkk.......',
    '.kkkkkkkkkkkkkkkk.......',
    'kkdkkkkkkkkkkkkkk.......',
    'k.kdkkkkkkkkkkkkk.......',
    'k.kkdddkkkkkkkkkk.......',
    'k..kkkkkkkkkkkkk........',
    '...kk.kk....kk.kk.......',
    '...kk.kk....kk.kk.......',
    '...kk..k....k..kk.......',
    '...k...k....k...k.......',
    '...k...k....k...k.......',
    '..kk..kk...kk..kk.......',
    '........................',
  ],
  [
    '........................',
    '........................',
    '...................hh...',
    '..................h..h..',
    '..................h.hk..',
    '.................mkkkk..',
    '................mmkykkk.',
    '...............mmkkkkkkk',
    '..............mmkkkd.kkk',
    '.............mmkkk...dkk',
    '..kkkkkkkkkkmkkkk.......',
    '.kkkkkkkkkkkkkkkk.......',
    'kkdkkkkkkkkkkkkkk.......',
    'k.kdkkkkkkkkkkkkk.......',
    'k.kkdddkkkkkkkkkk.......',
    'k..kkkkkkkkkkkkk........',
    '..kk..kk...kk..kk.......',
    '.kk....kk.kk....kk......',
    'kk......kkk......kk.....',
    'k........k........k.....',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
]
const COL = { k: [14, 13, 16], d: [42, 40, 52], m: [4, 4, 6], h: [185, 170, 138], y: [255, 205, 60] }
let SPRITES = null
function sprites() {
  if (SPRITES) return SPRITES
  SPRITES = ART.map(rows => {
    const c = document.createElement('canvas'); c.width = 24; c.height = 24
    const g = c.getContext('2d'), im = g.createImageData(24, 24)
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const col = COL[ch]; if (!col) return
      const i = (y * 24 + x) * 4; im.data[i] = col[0]; im.data[i + 1] = col[1]; im.data[i + 2] = col[2]; im.data[i + 3] = 255
    }))
    g.putImageData(im, 0, 0)
    return c
  })
  return SPRITES
}
// where the eye is on the sprite (for its glow), per frame
const EYE = [[19.5, 7.5], [19.5, 6.5]]

export function drawPuca(h, ctx, p) {
  const k = h._k(p.y); if (!k) return
  const T = h.t, st = p.state || 'standing'
  let x = p.x, y = p.y, z = p.z, flip = !!p.flip, alpha = 1, fr = Math.floor(T * 2) % 2, rot = 0, jit = 0
  if (st === 'bound') { fr = 0; jit = (Math.floor(T * 7) % 9 === 0) ? (Math.random() - 0.5) * 0.06 : 0; rot = -0.08 }
  if (st === 'dancing') { const b = T * 3.2; z += Math.abs(Math.sin(b)) * 0.35; flip = Math.floor(b / Math.PI) % 2 === 1; fr = Math.floor(T * 6) % 2 }
  if (st === 'leaving') {
    const t = p.t || 0
    fr = Math.floor(T * 9) % 2
    z += t * t * 0.9 + t * 0.6; y -= t * 2.4; flip = false
    alpha = Math.max(0, 1 - t / 2.6)
    if (alpha <= 0) return
  }
  const at = h._P(x + jit, y, z); if (!at) return
  const s = k * 1.15
  const L = h.lightAt(p.x, p.y + 0.1, p.z + 0.6, h._i(Math.floor(p.x), Math.floor(p.y)))
  const b = Math.max(L[0], L[1], L[2])
  const img = sprites()[fr]
  ctx.save()
  ctx.globalAlpha *= alpha * (0.55 + 0.45 * Math.min(1, b * 2))       // black on black: it is the eye you see first
  if (st !== 'leaving') { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); const g0 = h._P(p.x, p.y, p.z); if (g0) { ctx.ellipse(g0.x, g0.y, s * 0.42, s * 0.09, 0, 0, Math.PI * 2); ctx.fill() } }
  ctx.translate(at.x, at.y)
  if (rot) ctx.rotate(rot)
  if (flip) ctx.scale(-1, 1)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, -s / 2, -s, s, s)
  // the eye: gold, and lit from within whatever the light
  const [ex, ey] = EYE[fr]
  const gx = -s / 2 + ex / 24 * s, gy = -s + ey / 24 * s
  ctx.globalCompositeOperation = 'lighter'
  const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, s * 0.12)
  gr.addColorStop(0, 'rgba(255,210,80,0.85)'); gr.addColorStop(1, 'rgba(255,210,80,0)')
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, s * 0.12, 0, Math.PI * 2); ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  if (st === 'bound') {                         // the snare: cords over it, pale against the black
    ctx.strokeStyle = 'rgba(200,190,160,0.85)'; ctx.lineWidth = Math.max(1, s * 0.03)
    for (const [ax, ay, bx, by] of [[-0.45, -0.55, 0.25, -0.2], [-0.3, -0.25, 0.3, -0.6], [-0.1, -0.15, 0.05, -0.62], [0.15, -0.72, 0.42, -0.4]]) {
      ctx.beginPath(); ctx.moveTo(ax * s, ay * s); ctx.lineTo(bx * s, by * s); ctx.stroke()
    }
  }
  if (st === 'dancing' || st === 'leaving') {    // sparks off its hooves
    ctx.globalCompositeOperation = 'lighter'
    for (let q = 0; q < 5; q++) {
      const ph = (T * 1.7 + q * 0.37) % 1, sx = (-0.35 + q * 0.17) * s, sy = (-0.05 - ph * 0.5) * s
      ctx.fillStyle = `rgba(220,255,200,${(0.6 * (1 - ph)).toFixed(2)})`
      ctx.fillRect(sx, sy, Math.max(1, s * 0.035), Math.max(1, s * 0.035))
    }
  }
  ctx.restore()
}

// Géaga's face: two long slits of pale light among the roots over the well, opening as she wakes to you
export function drawGeagaFace(h, ctx, g) {
  if (!(g.wake > 0.01)) return
  const k = h._k(g.y); if (!k) return
  const breathe = 0.85 + 0.15 * Math.sin(h.t * 0.9)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  for (const side of [-1, 1]) {
    const c = h._P(g.x + side * 0.9, g.y, g.z); if (!c) continue
    const w = k * 0.55, hh = k * 0.06 * g.wake
    const gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, w)
    gr.addColorStop(0, `rgba(225,240,170,${(0.55 * g.wake * breathe).toFixed(3)})`); gr.addColorStop(1, 'rgba(225,240,170,0)')
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(c.x, c.y, w, w * 0.45, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = `rgba(245,255,215,${(0.9 * g.wake).toFixed(3)})`
    ctx.beginPath(); ctx.ellipse(c.x, c.y, w * 0.42, Math.max(1, hh), side * -0.12, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}
