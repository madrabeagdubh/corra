// thatchTexture.js — procedurally generated seamless thatch swatches
// Location: js/game/effects/thatchTexture.js
//
// Replaces assets/buildings/thatch1.png and thatch2.png, which were not
// swatches at all: they were Oryx-style roof STAMPS (a chevron and a
// hip-roof shape), each with a hard dark outline baked into the image.
// RoundhouseRenderer._drawTiledQuad repeats its texture up to five times
// across the longhall, so those stamps came out as a grid of chevrons
// with the outlines colliding into grey blotches.
//
// Generated at construction rather than shipped as PNGs, for three
// reasons: the parameters below are tunable in an editor instead of
// needing an image tool to regenerate a binary; the result is seamless
// by construction rather than by hand; and it draws synchronously, so
// the roofs are textured on the first frame instead of popping in when
// an <img> load resolves.
//
// ORIENTATION MATTERS. _drawTiledQuad maps v from ridge (p00/p10) to
// eave (p01/p11), so +v is DOWN the roof slope. Straws therefore run
// along v, and courses are bands of constant v. Getting this backwards
// gives thatch combed sideways, which reads as basketwork.

const TAU = Math.PI * 2

// Seeded so a given house always gets the same roof across reloads --
// the swatch is picked by a hash of house.id in RoundhouseRenderer.
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * @param {object} [opts]
 * @param {number} [opts.seed]     -- any integer; same seed, same swatch
 * @param {number} [opts.size]     -- square, in px. 128 is plenty: one
 *   repeat spans ~1.3 world tiles (see TILE_TARGET), so it is never
 *   magnified much beyond 1:1 on screen.
 * @param {number} [opts.courses]  -- overlapping layers per repeat. The
 *   longhall draws repV=1, so this is literally how many courses show
 *   down its slope; huts draw repV=2, so they show double.
 * @param {number} [opts.straws]   -- individual stems. Below ~600 the
 *   base colour shows through as bald patches.
 * @param {number} [opts.weather]  -- 0..1 fraction of stems that have
 *   greyed off. Past ~0.25 the roof reads as rotten rather than old.
 * @returns {HTMLCanvasElement}
 */
export function makeThatchCanvas(opts = {}) {
  const {
    seed = 1337, size = 128, courses = 5, straws = 900,
    baseH = 43, baseS = 38, baseL = 50, weather = 0.06,
  } = opts

  const W = size, H = size
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  const rnd = mulberry32(seed)
  const ch = H / courses

  // Course lines sag slightly, as laid thatch does. Two waves of INTEGER
  // period: each is individually seamless across the x edge, but the beat
  // between them hides the repeat that a single sine made obvious (it
  // read as pantiles).
  const sag = (x) => 0.9 * Math.sin(TAU * 1 * x / W + 0.7)
                   + 0.55 * Math.sin(TAU * 3 * x / W + 2.1)

  ctx.fillStyle = `hsl(${baseH},${baseS}%,${baseL - 4}%)`
  ctx.fillRect(0, 0, W, H)

  // ── Stems ────────────────────────────────────────────────────────────
  // Each stem is confined to one course, so it terminates at the course
  // line the way combed thatch does, and is drawn in four segments that
  // darken toward the top (buried under the course above) and lighten at
  // the exposed lower lip.
  for (let i = 0; i < straws; i++) {
    const course = Math.floor(rnd() * courses)
    const x = rnd() * W
    const sg = sag(x)
    const y0 = course * ch - ch * 0.10 + sg
    const y1 = (course + 1) * ch + ch * 0.16 + sg
    const lean = (rnd() - 0.5) * 5.0
    const wdt = 1.3 + rnd() * 2.4

    const grey = rnd() < weather
    const hh = baseH + (rnd() - 0.5) * 9 - (grey ? 13 : 0)
    const ss = Math.max(4, (baseS + (rnd() - 0.5) * 14) * (grey ? 0.7 : 1.0))
    const ll = baseL + (rnd() - 0.5) * 22 - (grey ? 2 : 0)

    ctx.lineWidth = wdt
    for (let seg = 0; seg < 4; seg++) {
      const t0 = seg / 4, t1 = (seg + 1) / 4
      const shade = -9 + 13 * t0
      const lseg = Math.max(12, Math.min(84, ll + shade))
      ctx.strokeStyle = `hsla(${hh},${ss}%,${lseg}%,${(170 + rnd() * 60) / 255})`
      // Drawn three times so a stem straddling the vertical edge wraps
      // instead of being clipped -- same trick the course bands below use
      // implicitly by spanning the full width.
      for (const dx of [-W, 0, W]) {
        ctx.beginPath()
        ctx.moveTo(x + lean * t0 + dx, y0 + (y1 - y0) * t0)
        ctx.lineTo(x + lean * t1 + dx, y0 + (y1 - y0) * t1)
        ctx.stroke()
      }
    }
  }

  // ── Course shadow and lip highlight ──────────────────────────────────
  // Stepped 1px bands rather than a blur: ctx.filter support is patchy on
  // mobile, and a falloff this short is indistinguishable from a blurred
  // one at the size these ever appear on screen.
  //
  // <= courses, not < courses, so the band at v=0 is drawn as well as the
  // one at v=1 -- they coincide at the wrap, and omitting either leaves a
  // visible ridge-line seam.
  for (let k = 0; k <= courses; k++) {
    const yline = k * ch
    for (let xc = 0; xc < W; xc++) {
      const yl = yline + sag(xc)
      for (let step = 0; step < 7; step++) {
        ctx.fillStyle = `rgba(24,16,8,${(80 * (1 - step / 7)) / 255})`
        ctx.fillRect(xc, yl + step, 1, 1)
      }
      for (let step = 0; step < 3; step++) {
        ctx.fillStyle = `rgba(255,232,184,${(52 * (1 - step / 3)) / 255})`
        ctx.fillRect(xc, yl - 2 - step, 1, 1)
      }
    }
  }

  return c
}

// The two swatches RoundhouseRenderer picks between: fresh gold straw and
// an older, greyer roof. Kept as data rather than inlined so a third can
// be added without touching the renderer.
export const THATCH_VARIANTS = [
  { seed: 1337, baseH: 43, baseS: 38, baseL: 50, weather: 0.06 },
  { seed: 9021, baseH: 38, baseS: 31, baseL: 45, weather: 0.12 },
]

