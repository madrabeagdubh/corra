// statues.js
// Location: js/game/effects/statues.js
//
// Statues for the gatehouses of the antechamber (tools/map-editor/generators/escape_gen.mjs, escape_tobar): big,
// looming, impressionistic figures carved in stone, drawn here in canvas -- no sprite sheet. Each is drawn once, in
// greys (light from the upper left, the shadows deep), and hewnExtras' drawStatue tints it to its stone and lights it
// where it stands.
//
//   statueCanvas(kind)   a canvas, 64 wide by 128 tall, the figure's feet at the bottom middle
//     'mourner'  a hooded figure, head bowed, hands folded in the sleeves           (Tech Duinn)
//     'harper'   a tall figure with a harp held to the shoulder, hair long          (the hollow hills)
//     'giant'    a hulking one-eyed giant, one arm hanging, a club                  (the Fomorian edge)
//     'selkie'   a woman with a sealskin over her head and shoulders, a tail below  (Tethra's court)
//     'hound'    a great hound sitting up, ears back                                (the way out: Bran and Sceólang)
//     'lusty'    the Lustymore man: one face, one eye cut, squatting, hands on his knees  (Tech Duinn)
//     'janus'    squat and two-faced, after the figure on Boa Island: a great head, eyes wide, arms crossed, a belt  (Tech Duinn)
//   sigilGlyph(kind, rgb)   a 96px icon of a gate's sigil, glowing on dark stone, for the moon's badge

const W = 64, H = 128
const CACHE = new Map()

export function statueCanvas(kind) {
  if (CACHE.has(kind)) return CACHE.get(kind)
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')
  ;(FIGURES[kind] || FIGURES.mourner)(g)
  CACHE.set(kind, c)
  return c
}

// stone, lit from the upper left: a body filled with a sideways gradient, its edge darker
const stone = (g, x0, x1, light = 0.82, dark = 0.3) => {
  const gr = g.createLinearGradient(x0, 0, x1, 0)
  gr.addColorStop(0, grey(light)); gr.addColorStop(0.55, grey((light + dark) / 2 + 0.05)); gr.addColorStop(1, grey(dark))
  return gr
}
const grey = (v) => { const n = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${n},${n},${n})` }
const shape = (g, fill, pts, close = true) => {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath()
  g.fillStyle = fill; g.fill()
  g.strokeStyle = 'rgba(10,10,10,0.55)'; g.lineWidth = 1.2; g.stroke()
}
const line = (g, pts, a = 0.5, w = 1) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokeStyle = `rgba(10,10,10,${a})`; g.lineWidth = w; g.stroke() }
const plinth = (g) => { shape(g, stone(g, 10, 54, 0.7, 0.28), [[10, 118], [54, 118], [56, 128], [8, 128]]) }

const FIGURES = {
  // after the figure on Boa Island: a squat block of a body, a head as big as it, the eyes great ovals, a wide nose, the mouth
  // open and turned down, the chin pointed; the arms crossed over the belly, a belt under them; at each side of the head the
  // seam where the face on the other side begins. Tears cut down from the eyes
  // after the Lustymore man, the Dreenan figure's smaller fellow: one face only, heart-shaped, one eye cut and the other
  // not, a straight nose, an open mouth; squatting, his hands resting on his knees
  lusty(g) {
    plinth(g)
    shape(g, stone(g, 12, 52, 0.72, 0.24), [[14, 92], [50, 92], [52, 118], [12, 118]])                             // the haunches, a block
    shape(g, stone(g, 10, 54, 0.82, 0.28), [[18, 62], [26, 56], [38, 56], [46, 62], [50, 94], [14, 94]])          // the trunk
    for (const sx of [-1, 1]) {
      shape(g, stone(g, 10, 54, 0.9, 0.34), [[32 + sx * 6, 102], [32 + sx * 18, 98], [32 + sx * 19, 112], [32 + sx * 7, 114]])   // a knee
      shape(g, stone(g, 10, 54, 0.78, 0.28), [[32 + sx * 14, 62], [32 + sx * 19, 66], [32 + sx * 18, 100], [32 + sx * 12, 100]])  // an arm, down to it
      line(g, [[32 + sx * 9, 104], [32 + sx * 17, 102]], 0.5, 1); line(g, [[32 + sx * 9, 108], [32 + sx * 17, 106]], 0.5, 1)    // the fingers on it
    }
    shape(g, stone(g, 12, 52, 0.86, 0.3), [[20, 22], [26, 16], [32, 22], [38, 16], [44, 22], [46, 38], [32, 58], [18, 38]])   // the head, heart-shaped
    g.beginPath(); g.ellipse(26, 32, 5, 3.6, 0, 0, Math.PI * 2); g.fillStyle = grey(0.6); g.fill(); g.strokeStyle = 'rgba(10,10,10,0.6)'; g.lineWidth = 1.3; g.stroke()
    g.beginPath(); g.ellipse(26, 33, 2.2, 2.2, 0, 0, Math.PI * 2); g.fillStyle = 'rgb(20,20,20)'; g.fill()
    line(g, [[35, 32], [42, 33]], 0.4, 1.2)                                                                          // the eye not cut, a worn line
    line(g, [[25, 37], [24, 48]], 0.45, 1)                                                                           // a tear under the one
    shape(g, stone(g, 26, 38, 0.92, 0.4), [[31, 30], [34, 30], [35, 42], [30, 42]])                                // the nose, straight
    g.beginPath(); g.ellipse(32, 48, 3.4, 2.4, 0, 0, Math.PI * 2); g.fillStyle = 'rgb(20,20,20)'; g.fill()          // the mouth, open
  },
  janus(g) {
    plinth(g)
    shape(g, stone(g, 12, 52, 0.7, 0.24), [[14, 84], [50, 84], [52, 118], [12, 118]])                             // the lower body, a block
    shape(g, stone(g, 10, 54, 0.62, 0.2), [[12, 80], [52, 80], [52, 88], [12, 88]])                               // the belt
    for (let x = 14; x < 50; x += 6) line(g, [[x, 80], [x + 3, 88], [x + 6, 80]], 0.4, 1)
    shape(g, stone(g, 10, 54, 0.8, 0.26), [[16, 56], [24, 50], [40, 50], [48, 56], [52, 80], [12, 80]])           // the trunk, shoulders sloped
    shape(g, stone(g, 12, 52, 0.86, 0.32), [[14, 64], [22, 60], [44, 74], [42, 80], [34, 78]])                    // the arms, crossed
    shape(g, stone(g, 12, 52, 0.78, 0.28), [[50, 64], [42, 60], [20, 74], [22, 80], [30, 78]])
    shape(g, stone(g, 12, 52, 0.84, 0.3), [[18, 14], [32, 6], [46, 14], [50, 30], [44, 46], [32, 56], [20, 46], [14, 30]])   // the head, the chin pointed
    line(g, [[15, 22], [14, 34], [18, 44]], 0.5, 1.4); line(g, [[49, 22], [50, 34], [46, 44]], 0.5, 1.4)        // the seams to the other face
    for (const ex of [24, 40]) {                                                                                     // the eyes, great ovals, rimmed
      g.beginPath(); g.ellipse(ex, 26, 6, 4.5, 0, 0, Math.PI * 2); g.fillStyle = grey(0.62); g.fill(); g.strokeStyle = 'rgba(10,10,10,0.6)'; g.lineWidth = 1.4; g.stroke()
      g.beginPath(); g.ellipse(ex, 27, 2.6, 2.6, 0, 0, Math.PI * 2); g.fillStyle = 'rgb(20,20,20)'; g.fill()
      line(g, [[ex - 1, 31], [ex - 2, 44]], 0.45, 1)                                                                // a tear cut down the cheek
    }
    shape(g, stone(g, 26, 38, 0.9, 0.4), [[30, 28], [34, 28], [37, 38], [27, 38]])                                 // the nose
    shape(g, 'rgb(20,20,20)', [[25, 46], [32, 42], [39, 46], [36, 48], [28, 48]])                                  // the mouth, open, turned down
    line(g, [[26, 12], [32, 9], [38, 12]], 0.35, 1)
  },
  // hooded, bowed, the robe falling straight to the ground, the hands lost in the sleeves
  mourner(g) {
    plinth(g)
    shape(g, stone(g, 14, 50), [[24, 30], [40, 30], [46, 60], [50, 118], [14, 118], [18, 60]])
    shape(g, stone(g, 18, 48, 0.75, 0.22), [[22, 14], [36, 10], [44, 22], [44, 38], [36, 44], [24, 42], [20, 30]])   // the hood, bowed forward
    shape(g, 'rgb(18,18,18)', [[28, 24], [40, 22], [41, 36], [33, 40], [27, 36]])                                  // the dark inside it
    shape(g, stone(g, 22, 46, 0.86, 0.36), [[22, 62], [44, 60], [46, 72], [24, 74]])                              // the folded sleeves
    for (const x of [22, 30, 38, 44]) line(g, [[x, 80], [x + (x - 32) * 0.15, 116]], 0.35)                        // the folds
    line(g, [[24, 68], [44, 66]], 0.45)
  },
  // tall and straight, the harp against the left shoulder, hair down the back, one hand at the strings
  harper(g) {
    plinth(g)
    shape(g, stone(g, 18, 46), [[26, 34], [38, 34], [44, 64], [46, 118], [18, 118], [20, 64]])                    // the gown
    shape(g, stone(g, 22, 44, 0.85, 0.3), [[26, 16], [36, 16], [38, 30], [32, 34], [26, 30]])                      // the head
    shape(g, stone(g, 20, 44, 0.6, 0.22), [[24, 18], [38, 18], [44, 52], [40, 66], [36, 40], [28, 40], [22, 60], [20, 40]])   // the hair
    shape(g, stone(g, 4, 30, 0.9, 0.35), [[8, 40], [14, 30], [30, 38], [26, 76], [12, 80], [6, 60]])               // the harp's frame
    shape(g, 'rgb(28,28,28)', [[12, 40], [16, 35], [26, 41], [23, 70], [13, 73], [10, 58]])
    for (let i = 0; i < 6; i++) line(g, [[14 + i * 2, 38 + i], [13 + i * 2, 72 - i]], 0.5, 0.8)                     // the strings
    shape(g, stone(g, 22, 40, 0.88, 0.4), [[28, 50], [38, 46], [40, 52], [30, 58]])                                 // the hand
    for (const x of [24, 32, 40]) line(g, [[x, 70], [x + (x - 32) * 0.2, 116]], 0.3)
  },
  // a hulk: hunched, a head sunk in the shoulders and a single eye, one great arm hanging to the knee with a club
  giant(g) {
    plinth(g)
    shape(g, stone(g, 14, 32, 0.7, 0.22), [[16, 94], [30, 94], [31, 118], [14, 118]])                             // the legs, short and thick
    shape(g, stone(g, 32, 50, 0.6, 0.18), [[34, 94], [48, 94], [50, 118], [33, 118]])
    shape(g, stone(g, 8, 56, 0.8, 0.2), [[12, 44], [22, 34], [44, 33], [54, 44], [52, 72], [46, 100], [16, 100], [12, 72]])   // the body, hunched
    shape(g, stone(g, 2, 18, 0.82, 0.3), [[10, 42], [17, 46], [18, 80], [15, 100], [5, 101], [3, 78], [5, 52]])    // the near arm, hanging to the knee
    shape(g, stone(g, 2, 18, 0.7, 0.25), [[3, 96], [16, 95], [17, 106], [9, 110], [2, 105]])                       // its fist
    shape(g, stone(g, 22, 44, 0.84, 0.26), [[23, 30], [30, 20], [40, 20], [45, 30], [42, 42], [33, 46], [25, 41]])  // the head, sunk between the shoulders
    shape(g, 'rgb(14,14,14)', [[30, 28], [37, 28], [38, 33], [33, 36], [29, 33]])                                  // the one eye
    line(g, [[28, 25], [40, 25]], 0.6, 2)                                                                           // the brow
    shape(g, stone(g, 46, 62, 0.62, 0.16), [[48, 42], [57, 46], [61, 80], [55, 86], [51, 66]])                     // the far arm
    shape(g, stone(g, 50, 64, 0.58, 0.16), [[54, 80], [60, 79], [63, 126], [52, 126]])                             // the club, resting on the ground
    line(g, [[18, 56], [32, 61], [48, 55]], 0.45, 1.4)
    line(g, [[22, 82], [44, 82]], 0.35, 1.2)
  },
  // a woman under a sealskin: the seal's head over hers, its pelt round her shoulders, falling to a tail at the foot
  selkie(g) {
    plinth(g)
    shape(g, stone(g, 14, 50, 0.8, 0.26), [[20, 36], [44, 36], [48, 70], [42, 96], [48, 112], [44, 118], [20, 118], [16, 108], [22, 96], [16, 70]])
    shape(g, stone(g, 18, 46, 0.86, 0.3), [[26, 22], [38, 22], [40, 36], [32, 42], [24, 36]])                      // her face
    shape(g, stone(g, 14, 50, 0.6, 0.2), [[20, 26], [26, 12], [38, 10], [46, 22], [48, 44], [42, 60], [38, 40], [40, 26], [32, 18], [26, 22], [24, 40], [18, 58], [16, 42]])   // the pelt
    shape(g, 'rgb(20,20,20)', [[30, 13], [34, 13], [33, 16]])                                                      // the seal's eye
    line(g, [[22, 100], [32, 108], [44, 100]], 0.5, 1.2)                                                           // the tail's fins
    for (const y of [70, 80, 90]) line(g, [[20, y], [44, y - 2]], 0.25)
  },
  // a hound, sitting up, long-legged and deep-chested, looking out
  hound(g) {
    plinth(g)
    shape(g, stone(g, 6, 40, 0.66, 0.2), [[8, 118], [10, 98], [16, 84], [28, 78], [38, 88], [38, 108], [32, 118]])   // the haunch, folded under
    line(g, [[30, 116], [16, 120], [6, 116], [4, 110]], 0.6, 2)                                                    // the tail, curled round the feet
    shape(g, stone(g, 14, 50, 0.8, 0.22), [[14, 92], [20, 66], [28, 48], [42, 44], [50, 56], [48, 80], [40, 92]])   // the back, rising to the shoulder
    shape(g, stone(g, 38, 52, 0.7, 0.26), [[37, 76], [42, 76], [42, 118], [36, 118]])                              // the far foreleg
    shape(g, stone(g, 42, 54, 0.86, 0.32), [[44, 70], [50, 68], [51, 116], [54, 118], [44, 118]])                  // the near foreleg, long and straight
    shape(g, stone(g, 30, 52, 0.86, 0.3), [[30, 50], [34, 34], [40, 24], [48, 28], [52, 48], [50, 72], [42, 74]])  // the neck and the deep chest
    shape(g, stone(g, 32, 62, 0.9, 0.3), [[36, 26], [40, 16], [47, 13], [53, 18], [61, 25], [60, 29], [52, 30], [44, 32]])   // the head, the long narrow muzzle
    shape(g, stone(g, 30, 44, 0.55, 0.2), [[42, 17], [33, 14], [30, 19], [38, 24]])                               // the ear, laid back
    shape(g, 'rgb(14,14,14)', [[47, 18], [50, 18], [49, 21]])                                                      // the eye
    line(g, [[22, 70], [34, 60]], 0.3, 1)
  },
}

// A gate's sigil as an icon: the sign in its light, cut in a disc of dark stone (hewnExtras' SIGILS draw the sign)
export function sigilGlyph(kind, rgb, draw) {
  const c = document.createElement('canvas'); c.width = c.height = 96
  const g = c.getContext('2d')
  const disc = g.createRadialGradient(40, 38, 6, 48, 48, 46)
  disc.addColorStop(0, '#3a3a3e'); disc.addColorStop(1, '#141416')
  g.fillStyle = disc; g.beginPath(); g.arc(48, 48, 44, 0, Math.PI * 2); g.fill()
  g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.stroke()
  g.translate(48, 50); g.lineCap = 'round'; g.lineJoin = 'round'
  g.beginPath(); draw(g, 30, 0); g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 6; g.stroke()
  g.shadowColor = `rgb(${rgb})`; g.shadowBlur = 10
  g.beginPath(); draw(g, 30, 0); g.strokeStyle = `rgba(${rgb},0.95)`; g.lineWidth = 3; g.stroke()
  return c
}

// Plain icons for the moon's badge: Géaga (a purple blur with yellow eyes), the dead (a pale hooded face)
export function figureGlyph(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 96
  const g = c.getContext('2d')
  g.lineCap = 'round'; g.lineJoin = 'round'
  if (kind === 'geaga') {
    // (a purple blur, and in it two slits of yellow light, tilted and shaped as the eyes she has in the water)
    const blob = (x, y, rx, ry, a) => { const r = Math.max(rx, ry), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(122,62,176,${a})`); gr.addColorStop(1, 'rgba(122,62,176,0)')
      g.save(); g.translate(x, y); g.scale(rx / r, ry / r); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore() }
    blob(48, 50, 44, 36, 0.95); blob(34, 54, 28, 24, 0.7); blob(62, 46, 28, 24, 0.7); blob(48, 62, 34, 20, 0.55)
    for (const side of [-1, 1]) {
      const x = 48 + side * 17, y = 48
      const gl = g.createRadialGradient(x, y, 0, x, y, 17); gl.addColorStop(0, 'rgba(255,238,110,0.75)'); gl.addColorStop(1, 'rgba(255,238,110,0)')
      g.fillStyle = gl; g.beginPath(); g.ellipse(x, y, 17, 9, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = 'rgba(255,244,140,0.98)'; g.beginPath(); g.ellipse(x, y, 10, 3.2, side * -0.12, 0, Math.PI * 2); g.fill()
    }
  } else {
    const fg = g.createRadialGradient(44, 40, 4, 48, 50, 40); fg.addColorStop(0, 'rgba(235,240,250,0.95)'); fg.addColorStop(1, 'rgba(150,165,190,0.6)')
    g.fillStyle = fg; g.beginPath(); g.moveTo(20, 90); g.quadraticCurveTo(14, 30, 48, 14); g.quadraticCurveTo(82, 30, 76, 90); g.closePath(); g.fill()
    g.fillStyle = 'rgba(20,24,34,0.85)'; g.beginPath(); g.ellipse(48, 48, 15, 19, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(200,220,255,0.9)'; for (const x of [42, 54]) { g.beginPath(); g.arc(x, 46, 2.4, 0, Math.PI * 2); g.fill() }
  }
  return c
}
