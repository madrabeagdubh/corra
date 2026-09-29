// seaWorld.js
// Location: js/game/scenes/crossing/seaWorld.js
//
// The sea crossings' shared world: a small 3D-lite sea in real perspective,
// a champion rowing with pull and glide, pulsed ripples, a landmark that
// hides the stars before it can be seen, aerial perspective, weather.
// Everything that differs between journeys comes from a config -- see
// DAWN and RETURN at the bottom. The scenes (dawnCrossing.js,
// returnCrossing.js) keep their own shell: poem, audio, skip menu, exit.
//
//   const world = createSeaWorld({ canvas, ctx, champion, tickSounds, config })
//   world.draw(now)      -- call every animation frame

const rnd    = (a, b) => a + Math.random() * (b - a)
const clamp  = (x, a, b) => x < a ? a : x > b ? b : x
const lerp   = (a, b, t) => a + (b - a) * clamp(t, 0, 1)
const easeIO = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
const easeOut = t => 1 - (1 - clamp(t, 0, 1)) * (1 - clamp(t, 0, 1))
const easeIn  = t => clamp(t, 0, 1) * clamp(t, 0, 1)

// Generated back view, v2 -- works from the HEAD BLOCK, not skin colour.
// Small pixel sprites draw the head as a little block above the shoulders:
//   * find it: the top rows, down to where the opaque width jumps (shoulders)
//   * hair / hood / helmet = the colour of its top row; if that differs from
//     the face, the whole head becomes it (from behind, you see the hair);
//     if it's the same (bald), the head stays skin, features smoothed away
//   * small bright front details on the torso (buckles, brooches) take the
//     colour around them
//   * mirror left-right
function makeBackView({ width: w, height: h, data: d }) {
  const out = new Uint8ClampedArray(d)
  const I = (x, y) => (y * w + x) * 4
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[I(x, y) + 3] > 20
  const col = (x, y) => [d[I(x, y)], d[I(x, y) + 1], d[I(x, y) + 2]]
  const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b
  const same = (a, b, tol = 26) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < tol * 3
  const rowSpan = y => { let a = -1, b = -1; for (let x = 0; x < w; x++) if (opaque(x, y)) { if (a < 0) a = x; b = x } return a < 0 ? null : [a, b] }
  // the head: from the first opaque row down to where the width jumps
  let top = 0; while (top < h && !rowSpan(top)) top++
  if (top >= h) return { width: w, height: h, data: out }
  const headW0 = rowSpan(top)[1] - rowSpan(top)[0] + 1
  let bottom = top
  for (let y = top + 1; y < h; y++) { const s = rowSpan(y); if (!s) break; if (s[1] - s[0] + 1 > Math.max(headW0 + 3, headW0 * 1.6)) break; bottom = y }
  const hs = rowSpan(top), mid = Math.round((hs[0] + hs[1]) / 2)
  // hair = commonest colour on the top row(s); face = commonest colour in the head's lower half
  const commonest = (y0, y1) => { const m = new Map()
    for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) if (opaque(x, y)) { const c = col(x, y); if (lum(c) < 18) continue; const k = c.join(); m.set(k, (m.get(k) || 0) + 1) }
    let best = null, n = 0; for (const [k, v] of m) if (v > n) { n = v; best = k.split(',').map(Number) } return best }
  const hair = commonest(top, top + Math.max(0, Math.floor((bottom - top) * 0.25)))
  const face = commonest(top + Math.ceil((bottom - top) / 2), bottom)
  const bald = !hair || !face || same(hair, face)
  const fill = bald ? face : hair
  for (let y = top; y <= bottom; y++) for (let x = 0; x < w; x++) {
    if (!opaque(x, y)) continue
    const c = col(x, y)
    if (lum(c) < 18 && (x === rowSpan(y)[0] || x === rowSpan(y)[1])) continue    // keep the outline
    const i = I(x, y); out[i] = fill[0]; out[i + 1] = fill[1]; out[i + 2] = fill[2]
  }
  // torso: small bright details take the colour around them
  for (let y = bottom + 1; y < h; y++) for (let x = 1; x < w - 1; x++) {
    if (!opaque(x, y)) continue
    const c = col(x, y), around = [col(x - 1, y), col(x + 1, y), col(x, y - 1), col(x, y + 1)].filter((_, k) => opaque([x - 1, x + 1, x, x][k], [y, y, y - 1, y + 1][k]))
    const sat = Math.max(...c) - Math.min(...c)
    if (around.length >= 3 && sat > 90 && around.filter(a => !same(a, c)).length >= 3) {
      const a = around.find(a => !same(a, c)); const i = I(x, y); out[i] = a[0]; out[i + 1] = a[1]; out[i + 2] = a[2]
    }
  }
  // mirror
  const m = new Uint8ClampedArray(out.length)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = I(x, y), b = I(w - 1 - x, y); for (let c = 0; c < 4; c++) m[a + c] = out[b + c] }
  return { width: w, height: h, data: m, head: [top, bottom], bald }
}


export function createSeaWorld({ canvas, ctx, champion, tickSounds = () => {}, onEvent = () => {}, config = DAWN }) {
    const C = { ...DAWN, ...config }
    // Dev switches (URL): &fps shows a frame meter; &norunoff turns the
    // runoff off -- compare the two to see its real cost on a device.
    const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
    if (params.has('norunoff')) delete C.runoff
    const meter = params.has('fps') ? { frames: 0, since: 0, text: '' } : null
    // ══════════════════════════════════════════════════════════════════════════
    // THE CROSSING -- a small 3D-lite world in real perspective.
    //
    // A rower faces the stern: the champion leaves Ireland watching it go, and
    // Skye rises behind their back. Two acts:
    //   ACT ONE (close)  the camera rides in the stern, the champion large and
    //                    almost a silhouette, rim-lit by the coming dawn, oars
    //                    sweeping out of frame. The water streams past.
    //   ACT TWO (far)    the camera stops and rises; the boat pulls away toward
    //                    the horizon, shrinking, as Skye comes out of the dawn.
    // PULL AND GLIDE: each stroke is catch -> a hard drive (the boat surges) ->
    // release (blades lift and feather, dripping) -> a long slow recovery while
    // the boat glides and the speed bleeds away.
    // THE WAKE: natural ripples, in pulses with the oars. Each drive sends a
    // bow wave as the boat surges and a pair of rings from the stern as it
    // finishes; the glide between is quiet -- forward motion, stroke by
    // stroke, not an engine. The blades splash small rings as they catch
    // the water, and now and then a stroke leaves a little eddy that turns and
    // unwinds as it fades. Faint, moonlit, calm. (Knobs: RIPPLE.)
    // SKY, MIRROR, DAWN: stars; then the water stills and holds them (stirred by
    // the swirls); then colour rises from the horizon into sky and sea.
    // World units are metres. x: right, z: ahead (toward Skye), h: height.
    // ══════════════════════════════════════════════════════════════════════════

    // ── THE TIMELINE, in seconds from the start ─────────────────────────────
    // JOURNEY_S is how long the crossing takes to go from night to full dawn
    // (the poem usually ends it at about this point). Every other moment is
    // just "at N seconds". To make the close-up longer, raise act2; to make
    // Skye appear sooner, lower skye0; and so on. (Internally these become
    // fractions of the journey -- the S() below -- so the sky colours, which
    // are keyed to the journey as a whole, stretch to match JOURNEY_S.)
    const JOURNEY_S = C.journeyS
    const S = sec => sec / JOURNEY_S
    const T = {
        still0: S(C.still[0]), still1: S(C.still[1]),       // the water stills (star reflections)
        act2: S(C.act2), act2Len: S(C.act2Len),             // the camera lets the boat go
        skye0: S(C.landmarkIn[0]), skye1: S(C.landmarkIn[1]), // the landmark out of the haze
    }
    const HEAD = C.heading                                  // +1: toward the horizon; -1: toward us
    const STROKE = { catchMs: 380, driveMs: 820, releaseMs: 260, glideMs: 0, recoverMs: 1950, recoverLift: 0.24, ...(C.stroke || {}) }
    const CYCLE  = STROKE.catchMs + STROKE.driveMs + STROKE.releaseMs + STROKE.glideMs + STROKE.recoverMs
    const SWEEP  = { catch: 0.78, finish: -0.52 }  // oar angle: + toward the bow
    const OAR    = { pinX: 0.62, pinH: 0.55, out: 1.9, inb: 0.75, bladeFrom: 1.3, handleGap: 0.16 }
    const BOAT   = { len: 4.4, beam: 1.25, gun: 0.55, bowGun: 0.78 }
    const ROWER  = { at: 1.7, seatH: 0.42, heightM: 0.98, leanZ: 0.24 }
    const VORTEX_LIFE = 11000
    // pulses: rings are made only on the drive -- a bow wave as the boat
    // surges (at bowAt through the drive) and a pair from the stern as it
    // finishes (sternAt) -- sized by the boat's speed. The glide is quiet.
    const RIPPLE = { bowAt: [0.25, 0.6], sternAt: 0.85, ringSpeed: 0.55, ringLife: 5600, ringAlpha: 0.32,
                     splashSpeed: 0.9, splashLife: 1800, splashAlpha: 0.45,
                     swirlChance: 0.3, swirlLife: 3600, swirlAlpha: 0.5, points: 48, loosen: 1.3 }
    const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
    const mixRGB = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * clamp(t, 0, 1)))
    const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))

    // Sky keyframes: [t, top, horizon]
    const SKY = C.sky.map(([k, top, hor]) => [k, hex(top), hex(hor)])
    function skyAt(t) {
        for (let i = 1; i < SKY.length; i++) {
            if (t <= SKY[i][0]) {
                const k = (t - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0])
                return [mixRGB(SKY[i - 1][1], SKY[i][1], k), mixRGB(SKY[i - 1][2], SKY[i][2], k)]
            }
        }
        return [SKY[SKY.length - 1][1], SKY[SKY.length - 1][2]]
    }

    // Stars across the sky (fractions of the width and of the sky's height)
    const skyStars = Array.from({ length: 340 }, () => ({
        x: Math.random(), y: Math.pow(Math.random(), 0.8),
        r: rnd(0.3, 1.5), a: rnd(0.25, 0.9), tw: rnd(0.0006, 0.002), ph: rnd(0, 6.28),
    }))

    // ── the champion, as a near-silhouette rim-lit by the dawn ────────────────
    const rower = { sil: null, rim: null, w: 0, h: 0 }
    ;(function loadRower() {
        const frameName = champion?.spriteKey
            ? (champion.spriteKey.endsWith('.png') ? champion.spriteKey : `${champion.spriteKey}.png`) : null
        if (!frameName) return
        const img = new Image()
        img.src = 'assets/champions/champions-with-kit.png'
        Promise.all([
            new Promise(r => { img.onload = r; img.onerror = r }),
            fetch('assets/champions/champions0.json').then(r => r.json()).catch(() => null),
        ]).then(([, atlas]) => {
            const f = atlas?.textures?.[0]?.frames?.find(fr => fr.filename === frameName)?.frame
            if (!f || !img.width) return
            const cropH = Math.round(f.h * 0.66)             // seated: head and body above the thwart
            const make = (fill, keepColour) => {
                const c = document.createElement('canvas'); c.width = f.w; c.height = cropH
                const g = c.getContext('2d'); g.imageSmoothingEnabled = false
                g.drawImage(img, f.x, f.y, f.w, cropH, 0, 0, f.w, cropH)
                if (C.rowerView === 'back') {                 // seen from behind: a generated back view
                    const id = g.getImageData(0, 0, f.w, cropH), bv = makeBackView(id)
                    id.data.set(bv.data); g.putImageData(id, 0, 0)
                }
                g.globalCompositeOperation = 'source-atop'
                g.fillStyle = fill; g.globalAlpha = keepColour ? C.silhouette : 1
                g.fillRect(0, 0, f.w, cropH)
                return c
            }
            rower.sil = make('#07080d', true)                // silhouette (C.silhouette: how complete)
            rower.rim = make('#ffffff', false)               // tinted per frame for the rim
            rower.w = f.w; rower.h = cropH
        })
    })()

    // ── world state ─────────────────────────────────────────────────────────
    // act one: the camera rides a little behind and above the stern
    // act two rises high and looks down: h2 is its height, horizon2 where the
    // horizon ends up (fraction of screen height) -- the sky becomes a band
    // at the top, the sea a page beneath.
    const CAM = C.cam
    let zBoat = C.startZ, zCam = C.follow ? C.startZ - CAM.behind : C.camZ, vBoat = 0.7, camH = CAM.h1
    let bob = 0                                           // the swell lifting the boat
    let xBoat = 0                                         // sideways, for a diagonal course (C.drift)
    let lastT = performance.now()
    let prevPhase = ''
    let strokes = 0
    const vortices = [], drips = [], rings = [], ripples = []
    const haze = { col: [0, 0, 0], k: 0 }            // aerial perspective for the boat
    const pulse = { bow: 0, stern: false }
    let goNow = 0                                         // how far into act two (0..1), for the weather

    // ── projection ──────────────────────────────────────────────────────────
    let W = 0, H = 0, yH = 0, F = 0
    function proj(x, h, z) {
        const d = Math.max(0.25, z - zCam)
        return { x: W / 2 + F * x / d, y: yH + F * (camH - h) / d, s: F / d }
    }

    // ── the stroke ──────────────────────────────────────────────────────────
    function strokeAt(ms) {
        const c = ms % CYCLE
        const { catchMs: A, driveMs: D, releaseMs: R } = STROKE
        if (c < A) {
            const t = c / A
            return { phase: 'catch', t, sweep: SWEEP.catch, lift: 0.2 * (1 - easeIn(t)), lean: -1 }
        }
        if (c < A + D) {
            const t = (c - A) / D, e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
            return { phase: 'drive', t, sweep: lerp(SWEEP.catch, SWEEP.finish, e), lift: 0, lean: lerp(-1, 1, e) }
        }
        const L = STROKE.recoverLift, G = STROKE.glideMs
        if (c < A + D + R) {
            const t = (c - A - D) / R
            return { phase: 'release', t, sweep: SWEEP.finish, lift: L * easeOut(t), lean: 1, feather: t }
        }
        // the glide: everything held -- body back, hands in, blades high and
        // level -- while the boat runs on
        if (c < A + D + R + G) {
            const t = (c - A - D - R) / G
            return { phase: 'glide', t, sweep: SWEEP.finish, lift: L, lean: 1, feather: 1 }
        }
        const t = (c - A - D - R - G) / STROKE.recoverMs, e = easeIO(t)
        return { phase: 'recover', t, sweep: lerp(SWEEP.finish, SWEEP.catch, e),
                 lift: L - 0.06 * t, lean: lerp(1, -1, easeIO(clamp(t * 1.1, 0, 1))), feather: 1 }
    }

    function bladeTip(side, st, zRow) {
        return { x: xBoat + side * (OAR.pinX + OAR.out * Math.cos(st.sweep)), z: zRow + HEAD * OAR.out * Math.sin(st.sweep), h: st.lift }
    }

    // ── drawing pieces ──────────────────────────────────────────────────────
    function drawSkyAndSea(t, top, hor) {
        const sky = ctx.createLinearGradient(0, 0, 0, yH)
        sky.addColorStop(0, rgb(top)); sky.addColorStop(1, rgb(hor))
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, yH + 1)
        const sea = ctx.createLinearGradient(0, yH, 0, H)
        sea.addColorStop(0, rgb(mixRGB(hor, [0, 0, 0], 0.25)))
        sea.addColorStop(1, rgb(mixRGB(top, [0, 0, 0], 0.45)))
        ctx.fillStyle = sea; ctx.fillRect(0, yH, W, H - yH)
        // the sun coming up behind Skye
        const sunA = C.sun ? smooth(0.72, 1, t) : 0
        if (sunA > 0) {
            const g = ctx.createRadialGradient(W * 0.6, yH, 0, W * 0.6, yH, H * 0.5)
            g.addColorStop(0, `rgba(255,214,150,${0.55 * sunA})`); g.addColorStop(1, 'rgba(255,214,150,0)')
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
        }
    }

    function drawStars(now, t, vScreens) {
        const a = 1 - smooth(0.58, 0.86, t)
        if (a <= 0) return
        const still = smooth(T.still0, T.still1, t) * (1 - smooth(0.7, 0.95, t))
        for (const s of skyStars) {
            const tw = 0.65 + 0.35 * Math.sin(now * s.tw + s.ph)
            const x = s.x * W, y = s.y * yH * 0.97
            ctx.fillStyle = `rgba(235,240,255,${s.a * tw * a})`
            ctx.fillRect(x, y, s.r, s.r)
            if (still <= 0.02) continue
            // the reflection: mirrored about the horizon, shimmering, and
            // stirred round by any swirl it falls within
            let rx = x + Math.sin(now * 0.0011 + s.ph * 3) * 1.4, ry = yH + (yH - y) * 0.92
            for (const v of vScreens) {
                const dx = rx - v.x, dy = (ry - v.y) / 0.38, d = Math.hypot(dx, dy)
                if (d < v.r && d > 0.5) {
                    const k = (1 - d / v.r) * v.spin
                    const c = Math.cos(k), sn = Math.sin(k)
                    rx = v.x + dx * c - dy * sn; ry = v.y + (dx * sn + dy * c) * 0.38
                }
            }
            ctx.fillStyle = `rgba(215,225,255,${s.a * tw * a * still * 0.7})`
            ctx.fillRect(rx, ry, s.r * 1.2, s.r * 0.7)
        }
    }

    // Skye: the pixel-art headland (assets/skye2.png), cropped to its
    // pixels, drawn crisp and low on the horizon, veiled in the dawn haze.
    const skye = { img: null, crop: null, tint: null }
    ;(function loadSkye() {
        const img = new Image()
        img.onload = () => {
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
            const g = c.getContext('2d'); g.drawImage(img, 0, 0)
            const d = g.getImageData(0, 0, c.width, c.height).data
            let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0
            for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
                if (d[(y * c.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
            }
            if (x1 <= x0) return
            skye.crop = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
            skye.img = img
            skye.tint = document.createElement('canvas'); skye.tint.width = skye.crop.w; skye.tint.height = skye.crop.h
            skye.occ = document.createElement('canvas'); skye.occ.width = skye.crop.w; skye.occ.height = skye.crop.h
        }
        img.src = C.landmark.src
    })()

    function drawSkye(t, hor, top) {
        if (!skye.img) return
        const a = C.landmark.fade === 'out' ? 1 - (C.landmark.fadeTo ?? 0.75) * smooth(T.skye0, T.skye1, t) : smooth(T.skye0, T.skye1, t)
        const { x, y, w, h } = skye.crop
        const dw = W * C.landmark.w, dh = dw * h / w
        const X = W * C.landmark.x - dw / 2, Y = yH - dh + 1
        // The land is there before it can be seen: its silhouette, filled with
        // the sky behind it, hides the stars from the first frame -- a patch
        // of starless sky that becomes the island as the light comes.
        {
            const og = skye.occ.getContext('2d')
            og.globalCompositeOperation = 'source-over'
            og.clearRect(0, 0, w, h); og.drawImage(skye.img, x, y, w, h, 0, 0, w, h)
            og.globalCompositeOperation = 'source-in'
            const skyAtY = sy => mixRGB(top, hor, clamp(sy / yH, 0, 1))
            const grad = og.createLinearGradient(0, 0, 0, h)
            grad.addColorStop(0, rgb(skyAtY(Y))); grad.addColorStop(1, rgb(skyAtY(Y + dh)))
            og.fillStyle = grad; og.fillRect(0, 0, w, h)
            ctx.save(); ctx.imageSmoothingEnabled = false
            ctx.drawImage(skye.occ, X, Y, dw, dh)
            ctx.restore()
        }
        if (a <= 0) return
        const tg = skye.tint.getContext('2d')
        tg.globalCompositeOperation = 'source-over'
        tg.clearRect(0, 0, w, h); tg.drawImage(skye.img, x, y, w, h, 0, 0, w, h)
        tg.globalCompositeOperation = 'source-atop'                   // the haze
        tg.fillStyle = rgb(mixRGB(hor, [30, 32, 58], 0.35), 0.62 - 0.3 * smooth(0.8, 1, t))
        tg.fillRect(0, 0, w, h)
        ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = a
        ctx.drawImage(skye.tint, X, Y, dw, dh)
        ctx.restore()
    }

    // ── ripples ─────────────────────────────────────────────────────────────
    function addRipple(kind, x, z, now, dir = 1, size = 1) {
        ripples.push({ kind, x, z, born: now, dir, size, ph: rnd(0, 6.28), ph2: rnd(0, 6.28), drift: rnd(-1, 1) })
    }

    function drawRipples(now, t, hor) {
        const col = mixRGB(hor, [255, 255, 255], 0.65)
        ctx.lineCap = 'round'
        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i]
            const life = r.kind === 'ring' ? RIPPLE.ringLife : r.kind === 'splash' ? RIPPLE.splashLife : RIPPLE.swirlLife
            const age = (now - r.born) / life
            if (age >= 1) { ripples.splice(i, 1); continue }
            const c = proj(r.x, 0, r.z)
            if (c.y < yH + 1) continue
            const fade = Math.pow(1 - age, 1.6) * Math.min(1, age * 8)
            ctx.lineWidth = Math.max(0.6, c.s * 0.012)
            ctx.beginPath()
            if (r.kind === 'swirl') {
                // an eddy: a loose spiral that turns and unwinds as it fades
                const R = 0.18 + age * 0.9, turn = r.dir * age * 3.2, arms = 2.4 * Math.PI
                for (let k = 0; k <= 40; k++) {
                    const u = k / 40, a = turn + r.dir * u * arms, rr = R * (0.15 + 0.85 * u)
                    const p = proj(r.x + Math.cos(a) * rr, 0, r.z + Math.sin(a) * rr)
                    k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)
                }
                ctx.strokeStyle = rgb(col, RIPPLE.swirlAlpha * fade)
            } else {
                // A ring that loosens as it goes: it wobbles, turns, and breaks
                // into arcs, dissolving into swirls rather than staying a circle.
                const speed = r.kind === 'ring' ? RIPPLE.ringSpeed : RIPPLE.splashSpeed
                const R = (0.1 + speed * age * life / 1000) * (r.size || 1)
                const loose = RIPPLE.loosen * age
                const turn = r.drift * age * 1.1
                const cx = r.x + r.drift * age * 0.3
                let on = false
                for (let k = 0; k <= RIPPLE.points; k++) {
                    const a = (k / RIPPLE.points) * Math.PI * 2
                    if (Math.sin(3 * a + r.ph2 + age * 2) < -1 + 1.6 * age) { on = false; continue }   // gaps open
                    const w = 1 + loose * (0.22 * Math.sin(3 * a + r.ph + age * 2.1) + 0.12 * Math.sin(5 * a - r.ph2 + age * 3.3))
                    const aa = a + turn * (0.5 + 0.5 * Math.sin(a + r.ph))
                    const p = proj(cx + Math.cos(aa) * R * w, 0, r.z + Math.sin(aa) * R * w)
                    on ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); on = true
                }
                ctx.strokeStyle = rgb(col, (r.kind === 'ring' ? RIPPLE.ringAlpha : RIPPLE.splashAlpha) * fade * Math.min(1.2, r.size || 1))
            }
            ctx.stroke()
        }
    }

    // Where each live vortex sits on screen, for stirring the star reflections.
    function vortexScreens(now) {
        const out = []
        for (let i = vortices.length - 1; i >= 0; i--) {
            const v = vortices[i], age = (now - v.born) / VORTEX_LIFE
            if (age >= 1) { vortices.splice(i, 1); continue }
            const c = proj(v.x, 0, v.z)
            out.push({ x: c.x, y: c.y, r: (0.35 + age * 1.1) * c.s * 1.1, spin: v.dir * (1 - age) * 1.4 })
        }
        return out
    }

    function drawBoat(st, t, hor) {
        const zs = zBoat, zb = zBoat + HEAD * BOAT.len
        const P = (x, h, z) => proj(x + xBoat, h + bob, z)
        const half = BOAT.beam / 2
        const sL = P(-half * 0.85, BOAT.gun, zs), sR = P(half * 0.85, BOAT.gun, zs)
        const mL = P(-half, BOAT.gun, zs + HEAD * BOAT.len * 0.45), mR = P(half, BOAT.gun, zs + HEAD * BOAT.len * 0.45)
        const bw = P(0, BOAT.bowGun, zb)
        const wsL = P(-half * 0.8, 0, zs), wsR = P(half * 0.8, 0, zs)
        const wmL = P(-half * 0.9, 0, zs + HEAD * BOAT.len * 0.45), wmR = P(half * 0.9, 0, zs + HEAD * BOAT.len * 0.45)
        const wb = P(0, 0, zb)
        const poly = (pts, fill) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill() }
        const hz = c => rgb(mixRGB(hex(c), haze.col, haze.k))
        poly([sL, mL, bw, wb, wmL, wsL], hz('#0a090c'))                   // port side
        poly([sR, mR, bw, wb, wmR, wsR], hz('#0c0b0e'))                   // starboard side
        poly([sL, sR, wsR, wsL], hz('#0e0c10'))                           // transom
        poly([sL, mL, bw, mR, sR], hz('#120f0c'))                         // inside
        // the gunwale catching the light
        ctx.strokeStyle = rgb(mixRGB(hor, [255, 255, 255], 0.2), 0.25 + 0.45 * smooth(0.55, 1, t))
        ctx.lineWidth = Math.max(1, sL.s * 0.02)
        ctx.beginPath(); ctx.moveTo(sL.x, sL.y); ctx.lineTo(mL.x, mL.y); ctx.lineTo(bw.x, bw.y); ctx.lineTo(mR.x, mR.y); ctx.lineTo(sR.x, sR.y); ctx.stroke()
    }

    // Currach oars: long, narrow, almost bladeless, turning on a wooden
    // thole pin, never feathered. Drawn in two parts: outboard (pin to tip)
    // behind the rower, the handle (hands to pin) in front.
    function oarPoints(side, st, zRow) {
        const tip = bladeTip(side, st, zRow)
        // A straight oar: the handle lies on the line from the blade through
        // the pin (so lifting the blade drops the hands). The handles never
        // cross -- if they'd come within a hand's gap, the inboard is shortened.
        const pin = { x: xBoat + side * OAR.pinX, z: zRow, h: OAR.pinH + bob }
        let k = OAR.inb / OAR.out
        const hxRaw = OAR.pinX - ((tip.x - xBoat) * side - OAR.pinX) * k
        if (hxRaw < OAR.handleGap) k *= (OAR.pinX - OAR.handleGap) / (OAR.pinX - hxRaw)
        const handle = { x: pin.x - (tip.x - pin.x) * k, z: pin.z - (tip.z - pin.z) * k, h: pin.h - (tip.h - pin.h) * k }
        return { tip, handle, pin, h0: proj(handle.x, handle.h, handle.z), p0: proj(pin.x, pin.h, pin.z), b1: proj(tip.x, tip.h, tip.z) }
    }
    function strokeOar(a, b, s0, s1, t) {
        ctx.lineCap = 'round'
        ctx.strokeStyle = rgb(mixRGB([28, 20, 13], haze.col, haze.k))   // stout, dark oak
        ctx.lineWidth = Math.max(2.5, s0 * 0.12)
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    }
    function drawOarOut(side, st, zRow, t) {
        const o = oarPoints(side, st, zRow)
        strokeOar(o.p0, o.b1, o.p0.s, o.b1.s, t)
        // the thole pin
        ctx.fillStyle = rgb(mixRGB([32, 24, 15], haze.col, haze.k))
        ctx.fillRect(o.p0.x - o.p0.s * 0.02, o.p0.y - o.p0.s * 0.09, o.p0.s * 0.04, o.p0.s * 0.09)
        return o
    }
    function drawOarIn(side, st, zRow, t) {
        const o = oarPoints(side, st, zRow)
        strokeOar(o.h0, o.p0, o.h0.s, o.p0.s, t)
    }

    function drawRower(st, zRow, t, hor) {
        if (!rower.sil) return
        const z = zRow + HEAD * st.lean * ROWER.leanZ * (C.lean ?? 1) * (st.phase === 'drive' ? 1 : 0.85)
        const base = proj(xBoat, (C.seatH ?? ROWER.seatH) + bob, z)
        // leanShape: from behind, leaning forward shortens the figure and
        // opening back lengthens it -- shape, not size
        const hPx = F * ROWER.heightM / Math.max(0.3, z - zCam) * (1 + (C.leanShape || 0) * st.lean)
        const wPx = hPx * rower.w / rower.h
        const x = base.x - wPx / 2, y = base.y - hPx
        ctx.save()
        ctx.imageSmoothingEnabled = false
        // rim: the sprite lit from behind by the dawn, peeking round the
        // edges. Tinted on its own small canvas -- source-atop on the main
        // canvas would flood the (opaque) background.
        const rimA = 0.15 + 0.7 * smooth(0.5, 1, t)
        const rimCol = rgb(mixRGB(hor, [255, 240, 210], 0.35))
        if (!rower.tint) { rower.tint = document.createElement('canvas'); rower.tint.width = rower.w; rower.tint.height = rower.h }
        const tg = rower.tint.getContext('2d')
        tg.globalCompositeOperation = 'source-over'
        tg.clearRect(0, 0, rower.w, rower.h); tg.drawImage(rower.rim, 0, 0)
        tg.globalCompositeOperation = 'source-atop'
        tg.fillStyle = rimCol; tg.fillRect(0, 0, rower.w, rower.h)
        ctx.globalAlpha = rimA
        ctx.drawImage(rower.tint, x - hPx * 0.012, y - hPx * 0.01, wPx, hPx)
        ctx.drawImage(rower.tint, x + hPx * 0.012, y - hPx * 0.01, wPx, hPx)
        ctx.globalAlpha = 1
        if (haze.k > 0.01) {
            if (!rower.hz) { rower.hz = document.createElement('canvas'); rower.hz.width = rower.w; rower.hz.height = rower.h }
            const hg = rower.hz.getContext('2d')
            hg.globalCompositeOperation = 'source-over'
            hg.clearRect(0, 0, rower.w, rower.h); hg.drawImage(rower.sil, 0, 0)
            hg.globalCompositeOperation = 'source-atop'
            hg.fillStyle = rgb(haze.col, haze.k); hg.fillRect(0, 0, rower.w, rower.h)
            ctx.drawImage(rower.hz, x, y, wPx, hPx)
        } else {
            ctx.drawImage(rower.sil, x, y, wPx, hPx)
        }
        ctx.restore()
    }

    function drawDripsAndRings(now, dt) {
        for (let i = drips.length - 1; i >= 0; i--) {
            const d = drips[i]
            d.h -= d.vh * dt; d.vh += 9.8 * dt
            if (d.h <= 0) { rings.push({ x: d.x, z: d.z, born: now }); drips.splice(i, 1); continue }
            const p = proj(d.x, d.h, d.z)
            ctx.fillStyle = 'rgba(210,228,245,0.8)'; ctx.fillRect(p.x, p.y, Math.max(1, p.s * 0.012), Math.max(1, p.s * 0.02))
        }
        for (let i = rings.length - 1; i >= 0; i--) {
            const r = rings[i], age = (now - r.born) / 1400
            if (age >= 1) { rings.splice(i, 1); continue }
            const p = proj(r.x, 0, r.z)
            ctx.strokeStyle = `rgba(215,230,245,${0.5 * (1 - age)})`; ctx.lineWidth = 1
            ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * 0.12 * (0.3 + age), p.s * 0.045 * (0.3 + age), 0, 0, Math.PI * 2); ctx.stroke()
        }
    }

    // ── weather (the return's grey, windy day) ─────────────────────────────
    // the swell: long faint crest lines rolling toward us; rain: fine slanted
    // streaks across the whole view (the dawn has none; the return uses rings).
    const rain = []
    function drawWeather(now, dt, t, hor) {
        const Wc = C.weather
        // the swell: long crests rolling toward us, faint and slow
        {
            const tt = now / 1000, span = 70
            ctx.lineWidth = 1
            for (let k = 0; k < span / Wc.crestM; k++) {
                // fixed on the water (drifting at crestSpeed), not tied to the
                // camera: as the camera rides with the boat they slide past
                // with its own surge -- pulse for pulse with the oars
                const z = zCam + 2 + ((k * Wc.crestM - tt * Wc.crestSpeed - zCam - 2) % span + span) % span
                const a = (Wc.crestA || 0.16) * Math.min(1, (z - zCam) / 6) * (1 - (z - zCam) / span)
                if (a <= 0.01) continue
                ctx.strokeStyle = rgb(mixRGB(hor, [255, 255, 255], 0.35), a)
                ctx.beginPath()
                for (let i = 0; i <= 14; i++) {
                    const x = -14 + i * 2
                    const p = proj(x, 0.05 * Math.sin(x * 0.7 + k * 1.3 + tt * 0.8), z + 0.4 * Math.sin(x * 0.3 + k))
                    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)
                }
                ctx.stroke()
            }
        }
    }
    // ── rain, impressionistic ──────────────────────────────────────────────
    // IMPACTS: a dense, restless field of tiny rings where drops strike the
    // sea -- rain seen through what it does. Each is one ellipse, batched.
    // VEILS: slow dark curtains of heavier rain drifting across the distance.
    const impacts = [], veils = []
    // THE STORM FRONT: rain reaches the sea only beyond it; it starts far off
    // (by the island and the curtains) and advances to us. frontDist is how
    // far ahead of the camera it lies; storm is 0..1 as it arrives.
    let frontDist = Infinity, storm = 1
    function updateFront(sec) {
        const Fr = C.weather?.front
        if (!Fr) return
        const k = smooth(Fr.from, Fr.to, sec)
        // even progress down the SCREEN (screen position goes as 1/distance),
        // not in metres -- otherwise it hovers at the horizon, then rushes in
        // (endDist: the water at the bottom edge of the screen)
        frontDist = sec < Fr.from ? Infinity : (k >= 1 ? 0 : 1 / lerp(1 / Fr.startDist, 1 / Fr.endDist, k))
        storm = k
    }
    // Each ring is one small pre-drawn oval SPRITE (a few variants), stamped
    // at many sizes and flattened onto the water -- about the cheapest thing a
    // canvas does, so there can be a great many. They're spread evenly over
    // the VISIBLE water (by screen height), so it rains everywhere, not just
    // near the boat; the front's bands sit in screen space.
    let ringSprites = null
    function makeRingSprites() {
        ringSprites = [1.4, 2, 2.6].map(lw => {
            const c = document.createElement('canvas'); c.width = c.height = 32
            const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = lw
            g.beginPath(); g.ellipse(16, 16, 14 - lw, 14 - lw, 0, 0, Math.PI * 2); g.stroke()
            return c
        })
    }
    function drawImpacts(now, dt, hor) {
        const I = C.weather.impacts
        if (!ringSprites) makeRingSprites()
        const sec = (now - startTime) / 1000, R0 = C.runoff
        const glass = R0 && sec > R0.start && sec < R0.start + R0.fade[1]
        const cap = glass ? I.max * (I.duringRunoff ?? 1) : I.max
        const Fr = C.weather.front
        let n = I.perSec * dt * (glass ? (I.duringRunoff ?? 1) : 1)
        // where the front is on screen: before it sets out there's no rain on
        // the water at all (the front is 'at the horizon'); once it has passed
        // us it's everywhere (below the bottom edge)
        const yFront = !Fr ? H + 1 : frontDist === Infinity ? yH : frontDist <= 0 ? H + 1 : yH + F * camH / frontDist
        const water = H - yH - 2
        while (n > 0 && impacts.length < cap) {
            if (n < 1 && Math.random() > n) break
            n--
            let sy
            if (Fr && yFront > yH + 2 && yFront < H && Math.random() < Fr.bandShare) {
                // the front arrives in bands: a dense one at its edge, fainter above
                const k = Math.random() < 0.55 ? 0 : Math.random() < 0.65 ? 1 : 2
                sy = yFront - (k * Fr.bandGap + Math.random() * Fr.band) * water
            } else {
                // everywhere the front has crossed (above it on screen) keeps raining
                sy = yH + 2 + Math.random() * (Math.min(yFront, H) - yH - 2)
            }
            const sx = Math.random() * W
            // a ragged front: its edge wavers across the screen, so it reads as
            // weather arriving over the whole sea, not a line aimed at the boat
            const edge = Fr && Fr.ragged && yFront > yH && yFront < H
                ? yFront + Fr.ragged * water * (Math.sin(sx * 0.021 + sec * 0.7) * 0.6 + Math.sin(sx * 0.057 - sec * 1.1) * 0.4) : yFront
            if (sy <= yH + 1 || sy > edge) continue
            const d = F * camH / (sy - yH)
            if (d > I.far) continue
            impacts.push({ x: (sx - W / 2) * d / F, z: zCam + d, born: now, r: rnd(0.35, 1.2) * I.r, v: Math.floor(Math.random() * 3), sq: rnd(0.8, 1.2) })
        }
        const bins = [[], [], []]
        for (let i = impacts.length - 1; i >= 0; i--) {
            const m = impacts[i], age = (now - m.born) / I.lifeMs
            if (age >= 1) { impacts.splice(i, 1); continue }
            const p = proj(m.x, 0, m.z)
            if (p.y < yH + 1 || p.y > H + 4) continue
            // distant rings are drawn at a minimum size: the far sea glitters too
            const rx = Math.max(I.minPx || 0, m.r * (0.3 + age) * p.s * m.sq)
            const flat = clamp(camH / Math.max(0.5, m.z - zCam) * 1.2, 0.14, 0.9)
            bins[Math.min(2, Math.floor(age * 3))].push([m.v, p.x, p.y, rx, rx * flat])
        }
        bins.forEach((list, b) => {
            if (!list.length) return
            ctx.globalAlpha = I.alpha * (1 - b / 3)
            for (const [v, x, y, rx, ry] of list) ctx.drawImage(ringSprites[v], x - rx, y - ry, rx * 2, ry * 2)
        })
        ctx.globalAlpha = 1
    }

    // Curtains of heavier rain: broad, dark, textured with fine falling
    // streaks slanting in the wind, a pale mist where they meet the sea,
    // sweeping slowly across the view.
    function drawVeils(now, dt, t, hor) {
        const V = C.weather.veils
        const secNow = (now - startTime) / 1000
        const grow = V.grow ? lerp(V.grow.alpha[0], V.grow.alpha[1], smooth(V.grow.from, V.grow.to, secNow)) : 1
        while (veils.length < V.count) {
            veils.push({ x: rnd(-(V.spread || 45), V.spread || 45), z: zCam + rnd(V.near, V.far), w: rnd(V.width[0], V.width[1]), a: rnd(0.6, 1),
                         streaks: Array.from({ length: V.streaks }, () => ({ u: Math.random(), a: rnd(0.3, 1), ph: Math.random(), l: rnd(0.08, 0.22) })) })
        }
        const dark = mixRGB(hor, [34, 38, 46], 0.6), light = mixRGB(hor, [232, 236, 242], 0.5)
        const tt = now / 1000
        // From high above a curtain makes no sense: each one fades, and the
        // same squall is seen as a dark cell drifting over the sea below it.
        const above = smooth(0.25, 0.75, goNow)
        for (const v of veils) {
            if (above > 0.01) {
                const c = proj(v.x, 0, v.z)
                if (c.y > yH) {
                    const rx = v.w * 0.6 * c.s, ry = rx * clamp(camH / Math.max(1, v.z - zCam), 0.2, 1)
                    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, ry / rx)
                    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
                    cg.addColorStop(0, rgb(dark, V.alpha * 0.8 * v.a * above)); cg.addColorStop(1, rgb(dark, 0))
                    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill()
                    ctx.restore()
                }
            }
        }
        if (above >= 0.99) { for (const v of veils) { v.x += V.speed * dt } return }
        for (const v of veils) {
            v.x += V.speed * dt
            // no popping: a curtain fades as it nears the camera, and when it's
            // moved far away again it fades back in
            if (v.x > (V.spread || 45) + 10) { v.x = -(V.spread || 45) - 10; v.z = zCam + rnd(V.near, V.far); v.born = now }
            if (v.z - zCam < V.near * 0.35) { v.z = zCam + rnd(V.near, V.far); v.x = rnd(-(V.spread || 45), V.spread || 45); v.born = now }
            v.vis = smooth(V.near * 0.35, V.near * 0.8, v.z - zCam) * (v.born ? smooth(0, 1500, now - v.born) : 1)
            const a = proj(v.x - v.w / 2, 0, v.z), b = proj(v.x + v.w / 2, 0, v.z)
            if (b.x < -20 || a.x > W + 20) continue
            const top = Math.min(yH - H * 0.35, 0), bottom = a.y, wpx = b.x - a.x, k = V.alpha * v.a * (1 - above) * grow * (v.vis ?? 1)
            // the body of the curtain; its lower part thins out in slices, each
            // fainter and a little narrower, to a ragged end (no straight edge)
            const g = ctx.createLinearGradient(a.x, 0, b.x, 0)
            g.addColorStop(0, rgb(dark, 0)); g.addColorStop(0.25, rgb(dark, k)); g.addColorStop(0.75, rgb(dark, k)); g.addColorStop(1, rgb(dark, 0))
            // Drawn in horizontal slices, top to bottom: each shifted by the
            // BEND (wind is stronger aloft, so the top is carried further --
            // a curve, not a column), and the lower part thinning out, each
            // slice fainter and a little narrower, to a ragged end.
            ctx.fillStyle = g
            if (v.fadeFrac == null) { v.fadeFrac = rnd(0.25, 0.5); v.ragged = rnd(0, 6.28); v.bend = rnd(V.bend[0], V.bend[1]) }
            // thin slices (~6 px) so the curve's edge is smooth, not stepped
            const hh2 = bottom - top, N = Math.max(16, Math.min(70, Math.round(hh2 / 6))), sliceH = hh2 / N
            for (let i = 0; i < N; i++) {
                const yf = i / N                                               // 0 top .. 1 bottom
                const shift = v.bend * wpx * Math.pow(1 - yf, 2) * (C.weather.windX < 0 ? -1 : 1)
                const inFade = yf > 1 - v.fadeFrac ? (yf - (1 - v.fadeFrac)) / v.fadeFrac : 0
                const f = 1 - inFade
                const inset = wpx * 0.3 * inFade * (0.5 + 0.5 * Math.sin(v.ragged + i * 1.3 + tt * 0.4))
                ctx.globalAlpha = f * f
                ctx.save(); ctx.translate(shift, 0)
                // slices meet exactly on whole pixels (overlap would double the
                // darkness along each seam and show as banding)
                const y0 = Math.round(top + i * sliceH), y1 = Math.round(top + (i + 1) * sliceH)
                if (y1 > y0) ctx.fillRect(a.x + inset, y0, wpx - inset * 1.4, y1 - y0)
                ctx.restore()
            }
            ctx.globalAlpha = 1
            // falling streaks inside it, slanting with the wind
            const slant = (C.weather.windX || 0) * 0.08 * (bottom - top)
            ctx.lineWidth = 1
            ctx.strokeStyle = rgb(light, 0.12 * v.a * (1 - above) * Math.min(1, grow * 1.5))
            ctx.beginPath()
            for (const s0 of v.streaks) {
                const edge = Math.sin(Math.PI * s0.u)                    // thinner at the curtain's edges
                if (edge < 0.25) continue
                const x = a.x + s0.u * wpx
                const len = s0.l * (bottom - top)
                const y = top + (((tt * V.fall + s0.ph) % 1) * (bottom - top + len)) - len
                const y0 = Math.max(top, y), y1 = Math.min(bottom, y + len)
                if (y1 <= y0) continue
                const f0 = (y0 - top) / (bottom - top), f1 = (y1 - top) / (bottom - top)
                ctx.moveTo(x + slant * f0, y0); ctx.lineTo(x + slant * f1, y1)
            }
            ctx.stroke()
            // mist at the foot, where the rain throws up spray
            // (a soft oval, faded on every side -- no hard edges)
            const cx = (a.x + b.x) / 2, rx = wpx * 0.42, ry = Math.max(3, wpx * 0.1)
            ctx.save()
            ctx.translate(cx, bottom - ry * 0.4); ctx.scale(1, ry / rx)
            const m = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
            m.addColorStop(0, rgb(light, 0.24 * v.a * (1 - above))); m.addColorStop(1, rgb(light, 0))
            ctx.fillStyle = m
            ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill()
            ctx.restore()
        }
    }
    // ── runoff on the glass ─────────────────────────────────────────────────
    // Rain on the glass we're looking through, like a windscreen: drops land
    // in various sizes, cling for a moment, then run -- wandering, sometimes
    // stopping, merging where they meet (the bigger, the faster), leaving
    // beads behind. Each drop is a little lens: through it a blurred,
    // magnified, upside-down piece of the scene, faded softly at its edge --
    // no outline. Thick at the start; none land after landUntil; the rest
    // fade away as the camera begins to rise.
    const runoff = { drops: [], snap: null, lens: null, next: 0 }
    function drawRunoff(sec, dt) {
        const R0 = C.runoff
        sec -= R0.start || 0                                   // the splash begins when the storm reaches us
        if (sec < 0) return
        const fade = 1 - smooth(R0.fade[0], R0.fade[1], sec)
        if (fade <= 0) { runoff.drops.length = 0; return }
        const drops = runoff.drops
        // landing: a hit -- it splats (spreads, then pulls in), flings a few
        // tiny droplets, and makes a small tap (the shell plays it)
        // a few BIG drops, placed over the boat and rower as the splash begins,
        // so the best of the effect -- the boat bent through big water -- is
        // always seen, not left to chance
        if (R0.big && !runoff.bigPlan) {
            runoff.bigPlan = Array.from({ length: R0.big.count }, () => ({
                at: rnd(R0.big.at[0], R0.big.at[1]), x: rnd(R0.big.x[0], R0.big.x[1]), y: rnd(R0.big.y[0], R0.big.y[1]), r: rnd(R0.big.r[0], R0.big.r[1]) }))
        }
        if (runoff.bigPlan) {
            for (const b of runoff.bigPlan) {
                if (b.done || sec < b.at) continue
                b.done = true
                drops.push({ x: b.x * W, y: b.y * H, r: b.r, vy: 0, wait: rnd(1.2, 2.6), wob: rnd(0, 6.28), stuck: 0, bead: false, life: 0,
                             shape: Math.floor(Math.random() * 6), rot: rnd(-0.4, 0.4), sq: rnd(0.85, 1.1) })
                onEvent('glassHit', { x: b.x, size: 1 })
            }
        }
        if (sec < R0.landUntil) {
            runoff.next -= dt
            const burst = sec < 0.6 ? 3 : 1                                     // the splash arrives all at once
            while (runoff.next <= 0 && drops.length < R0.max) {
                runoff.next += rnd(0.3, 1.7) / (R0.perSec * burst)
                const r = R0.r[0] + Math.pow(Math.random(), 1.8) * (R0.r[1] - R0.r[0])
                const d = { x: rnd(0, W), y: rnd(-0.05, 0.85) * H, r, vy: 0, wait: rnd(0.3, 2.4), wob: rnd(0, 6.28), stuck: 0, bead: false, life: 0,
                            shape: Math.floor(Math.random() * 6), rot: rnd(-0.5, 0.5), sq: rnd(0.8, 1.15) }
                drops.push(d)
                for (let k = 0, n = Math.floor(rnd(0, 3.5)); k < n && drops.length < R0.max + 12; k++) {
                    const a = rnd(0, 6.28), dist = r * rnd(1.3, 2.4)
                    drops.push({ x: d.x + Math.cos(a) * dist, y: d.y + Math.sin(a) * dist, r: rnd(1.2, 2.6), vy: 0, wait: rnd(1.5, 4), wob: 0,
                                 stuck: 0, bead: true, life: 0, shape: Math.floor(Math.random() * 6), rot: 0, sq: 1 })
                }
                onEvent('glassHit', { x: d.x / W, size: r / R0.r[1] })
            }
        }
        // moving: cling, run, wander, stop, merge, bead
        for (let i = drops.length - 1; i >= 0; i--) {
            const d = drops[i]
            d.life += dt
            if (d.bead) { if (d.life > d.wait) { drops.splice(i, 1) } continue }
            if (d.wait > 0) { d.wait -= dt; continue }
            if (d.stuck > 0) { d.stuck -= dt; d.vy = 0; continue }             // clinging (stops dead)
            if (d.r < R0.runAt) { d.r += dt * 1.2; continue }                  // too small to run yet: it swells
            // gravity: it breaks away and ACCELERATES (heavier drops harder),
            // lurching -- stick and slip -- rather than floating
            const g = R0.gravity * H * (0.4 + d.r / R0.r[1])
            d.vy = Math.min(R0.maxV * (d.r / R0.r[1] + 0.35) * H, d.vy + g * dt)
            d.y += d.vy * dt
            d.x += Math.sin(d.wob + d.y * 0.02) * d.r * 1.2 * dt                  // it doesn't go straight
            if (Math.random() < R0.stopChance * dt) d.stuck = rnd(0.12, 0.9)      // sometimes it catches
            if (Math.random() < 0.9 * dt && d.r > R0.runAt && drops.length < R0.max + 12) {
                drops.push({ x: d.x + rnd(-1, 1), y: d.y - d.r, r: rnd(1.6, 3.2), vy: 0, wait: rnd(1.5, 4), wob: 0, stuck: 0, bead: true, life: 0,
                             shape: Math.floor(Math.random() * 6), rot: 0, sq: 1 })
                d.r *= 0.985
            }
            if (d.y - d.r > H) { drops.splice(i, 1); continue }
            for (let j = drops.length - 1; j >= 0; j--) {                        // merge what it runs into
                const o = drops[j]
                if (j === i || o.y > d.y + d.r) continue
                if (Math.hypot(o.x - d.x, o.y - d.y) < (d.r + o.r) * 0.8) {
                    d.r = Math.min(Math.max(R0.r[1], R0.big ? R0.big.r[1] : 0) * 1.2, Math.sqrt(d.r * d.r + o.r * o.r)); d.vy *= 1.15
                    drops.splice(j, 1); if (j < i) i--
                }
            }
        }
        // drops merge the moment they touch -- never two overlapping: one drop
        // with their combined volume, at their combined centre (running ones
        // also gather what they run into, below)
        for (let i = 0; i < drops.length; i++) {
            const a = drops[i]
            if (a.bead) continue
            for (let j = drops.length - 1; j > i; j--) {
                const b = drops[j]
                if (b.bead) continue
                if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.85) {
                    const A = a.r * a.r, B = b.r * b.r
                    a.x = (a.x * A + b.x * B) / (A + B); a.y = (a.y * A + b.y * B) / (A + B)
                    a.r = Math.min(Math.max(R0.r[1], R0.big ? R0.big.r[1] : 0) * 1.25, Math.sqrt(A + B))
                    a.vy = Math.max(a.vy, b.vy); a.wait = Math.min(a.wait, b.wait); a.life = Math.max(a.life, 0.15)
                    drops.splice(j, 1)
                }
            }
        }
        if (!drops.length) return
        // The view through the water: one softened, slightly milky copy a frame.
        // NO blur filter (slow on many phones): the copy is made at a fraction
        // of the size (R0.down) and enlarged again inside each drop -- the
        // enlarging softens it for free. A faint white wash makes it milky.
        if (!runoff.snap) {
            runoff.snap = document.createElement('canvas'); runoff.lens = document.createElement('canvas')
            // the soft edges, made once: six irregular blobs (real drops are
            // never perfect circles), reused for every drop
            runoff.masks = Array.from({ length: 6 }, (_, v) => {
                const mc = document.createElement('canvas'); mc.width = mc.height = 64
                const mg = mc.getContext('2d')
                const ph = [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)]
                mg.filter = 'blur(3px)'
                mg.fillStyle = '#000'; mg.beginPath()
                for (let i = 0; i <= 40; i++) {
                    const a = (i / 40) * Math.PI * 2
                    const rr = 24 * (1 + 0.1 * Math.sin(2 * a + ph[0]) + 0.07 * Math.sin(3 * a + ph[1]) + 0.05 * Math.sin(5 * a + ph[2]))
                    const x = 32 + Math.cos(a) * rr, y = 32 + Math.sin(a) * rr * (1 + 0.1 * Math.max(0, Math.sin(a)))   // a little fuller below
                    i ? mg.lineTo(x, y) : mg.moveTo(x, y)
                }
                mg.fill(); mg.filter = 'none'
                return mc
            })
        }
        const DN = R0.down || 4
        const hw = Math.ceil(W / DN), hh = Math.ceil(H / DN)
        if (runoff.snap.width !== hw || runoff.snap.height !== hh) { runoff.snap.width = hw; runoff.snap.height = hh }
        const sg = runoff.snap.getContext('2d')
        sg.imageSmoothingEnabled = true
        sg.clearRect(0, 0, hw, hh)
        sg.drawImage(canvas, 0, 0, hw, hh)
        sg.fillStyle = `rgba(255,255,255,${R0.milk})`; sg.fillRect(0, 0, hw, hh)
        const L = runoff.lens, lg = L.getContext('2d')
        for (const d of drops) {
            const running = !d.bead && d.wait <= 0 && d.stuck <= 0 && d.vy > 5
            // the hit: spreads, then pulls in, over the first ~0.15 s
            const splat = d.bead ? 1 : 1 + 0.35 * Math.max(0, 1 - d.life / 0.15)
            const stretch = running ? clamp(1 + d.vy / H * 1.4, 1, 1.7) : 1        // a teardrop as it runs
            const rx = d.r * d.sq * splat / Math.sqrt(stretch), ry = d.r / d.sq * splat * stretch
            // a faint wet track above a running drop
            if (running && d.r > R0.runAt) {
                // (the source patch is clamped to the copy: never ask outside it)
                const sx0 = clamp((d.x - d.r * 0.3) / DN, 0, hw - 1), sy0 = clamp((d.y - d.r * 4) / DN, 0, hh - 1)
                const sw0 = Math.min(d.r * 0.6 / DN, hw - sx0), sh0 = Math.min(d.r * 3.2 / DN, hh - sy0)
                if (sw0 >= 0.5 && sh0 >= 0.5) {
                    ctx.globalAlpha = 0.18 * fade
                    ctx.drawImage(runoff.snap, sx0, sy0, sw0, sh0, sx0 * DN, sy0 * DN, sw0 * DN, sh0 * DN)
                    ctx.globalAlpha = 1
                }
            }
            const size = Math.ceil(Math.max(rx, ry) * 2) + 2
            if (L.width < size || L.height < size) { L.width = L.height = Math.max(size, 64) }
            lg.clearRect(0, 0, size, size)
            lg.globalCompositeOperation = 'source-over'
            // a lens: a wider patch of the scene, magnified and inverted
            const src = d.r * R0.lens
            lg.save(); lg.translate(size / 2, size / 2); lg.scale(-1, -1)
            {   // clamp the lens's source patch to the copy
                const lx = clamp((d.x - src) / DN, 0, hw - 1), ly = clamp((d.y - src) / DN, 0, hh - 1)
                const lw = Math.max(0.5, Math.min(src * 2 / DN, hw - lx)), lh = Math.max(0.5, Math.min(src * 2 / DN, hh - ly))
                lg.drawImage(runoff.snap, lx, ly, lw, lh, -size / 2, -size / 2, size, size)
            }
            lg.restore()
            // shading: a little darker toward the lower edge, a pale highlight
            const sh = lg.createLinearGradient(0, 0, 0, size)
            sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(0.6, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(10,14,20,0.22)')
            lg.fillStyle = sh; lg.fillRect(0, 0, size, size)
            // a small glint -- it stays small however big the drop is
            lg.fillStyle = 'rgba(255,255,255,0.28)'
            lg.beginPath(); lg.arc(size * 0.36, size * 0.3, clamp(size * 0.035, 0.6, 4), 0, Math.PI * 2); lg.fill()
            // soft edge: fade to nothing at the rim
            lg.globalCompositeOperation = 'destination-in'
            lg.drawImage(runoff.masks[d.shape], 0, 0, size, size)
            lg.globalCompositeOperation = 'source-over'
            ctx.globalAlpha = fade * (d.bead ? Math.min(1, (d.wait - d.life) / 1.2 + 0.2) * 0.8 : 1)
            ctx.drawImage(L, 0, 0, size, size, d.x - rx, d.y - ry, rx * 2, ry * 2)
        }
        ctx.globalAlpha = 1
    }

    // Rising through the clouds: soft masses drift down past the view, then
    // an even grey -- only the poem remains.
    const cloudBlobs = Array.from({ length: 7 }, (_, i) => ({ x: rnd(0.1, 0.9), off: i / 7 + rnd(0, 0.1), r: rnd(0.35, 0.6) }))
    function drawCloudsOver(sec) {
        const A = C.ascent, k = clamp((sec - A.from) / (A.to - A.from), 0, 1)
        if (k <= 0) return
        const col = hex(A.grey)
        for (const c of cloudBlobs) {
            const y = (c.off * 0.9 - 0.35 + k * 1.6) * H                 // passes once -- no wrapping (no pops)
            const g = ctx.createRadialGradient(c.x * W, y, 0, c.x * W, y, c.r * H)
            const a = 0.65 * Math.sin(Math.PI * clamp(k * 1.3, 0, 1))
            g.addColorStop(0, rgb(col, a)); g.addColorStop(1, rgb(col, 0))
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
        }
        const solid = smooth(0.35, 0.95, k)
        ctx.fillStyle = rgb(col, solid)
        ctx.fillRect(0, 0, W, H)
        // inside the cloud: soft shades of grey turning slowly through each other
        if (solid > 0.05) {
            // a strong wind: shades of grey chasing each other across the view,
            // stretched along the wind, the lighter ones faster
            for (const sw of swirls) {
                const span = W * (1 + 2 * sw.r)
                const x = ((sec * sw.speed * W + sw.ph * W) % span + span) % span - sw.r * W
                const y = (sw.y + 0.05 * Math.sin(sec * 1.3 + sw.ph * 6)) * H
                ctx.save(); ctx.translate(x, y); ctx.scale(2.2, 1)
                const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sw.r * H * 0.6)
                const c2 = mixRGB(col, sw.light ? [255, 255, 255] : [20, 22, 28], 0.28)
                g.addColorStop(0, rgb(c2, 0.7 * solid)); g.addColorStop(1, rgb(c2, 0))
                ctx.fillStyle = g; ctx.fillRect(-sw.r * H, -sw.r * H, sw.r * H * 2, sw.r * H * 2)
                ctx.restore()
            }
        }
    }
    const swirls = Array.from({ length: 8 }, (_, i) => ({ light: i % 2 === 0, speed: (i % 2 === 0 ? rnd(0.5, 0.8) : rnd(0.3, 0.5)) * -1,
                                                       ph: Math.random(), y: rnd(0.1, 0.9), r: rnd(0.25, 0.45) }))

    function drawRain(now, dt, hor) {
        const Wc = C.weather
        while (rain.length < Wc.rain) rain.push({ x: rnd(0, 1), y: rnd(-0.2, 1), l: rnd(0.02, 0.05), v: rnd(0.9, 1.4) })
        ctx.strokeStyle = rgb(mixRGB(hor, [235, 238, 245], 0.6), 0.16)
        ctx.lineWidth = 1
        ctx.beginPath()
        for (const r of rain) {
            r.y += r.v * dt; r.x += Wc.rainSlant * r.v * dt
            if (r.y > 1.05) { r.y = rnd(-0.15, -0.02); r.x = rnd(-0.2, 1) }
            const x = r.x * W, y = r.y * H
            ctx.moveTo(x, y); ctx.lineTo(x + Wc.rainSlant * r.l * H, y + r.l * H)
        }
        ctx.stroke()
    }

    // ── Draw loop ──────────────────────────────────────────────────────────────

    const startTime = performance.now()

    function draw(now) {
        W = canvas.width; H = canvas.height
        const elapsed = now - startTime
        const t = clamp(elapsed / (JOURNEY_S * 1000), 0, 1)
        const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now
        F = H * 0.95 * lerp(1, CAM.zoom2 ?? 1, smooth(T.act2, T.act2 + T.act2Len, clamp(elapsed / (JOURNEY_S * 1000), 0, 1)))   // act two may widen
        if (CAM.zoom1 && CAM.mid) F *= lerp(CAM.zoom1, 1, smooth(CAM.mid.from, CAM.mid.to, elapsed / 1000))   // the opening: a narrow lens

        // the stroke, and the boat's speed: a surge on the drive, a slow
        // bleed-away through the glide
        const st = strokeAt(elapsed)
        const drive = st.phase === 'drive' ? Math.sin(Math.PI * st.t) : 0
        vBoat += (drive * (C.drive || 3.4) - (vBoat - 0.35) / 1.9) * dt
        zBoat += HEAD * vBoat * dt
        xBoat += (C.drift || 0) * vBoat * dt

        if (C.weather) bob = C.weather.swell * Math.sin(elapsed / 1000 * 2 * Math.PI / C.weather.swellS + zBoat * 0.35)
        // act two: the camera stops following, and rises
        const go = smooth(T.act2, T.act2 + T.act2Len, t)
        goNow = go
        // the mid pull-back (boat and island in frame), then act two's rise
        const mid = CAM.mid ? smooth(CAM.mid.from / JOURNEY_S, CAM.mid.to / JOURNEY_S, t) : 0
        const behindNow = lerp(CAM.behind, CAM.mid ? CAM.mid.behind : CAM.behind, mid)
        if (C.followAll) zCam = zBoat - lerp(behindNow, CAM.behind2 ?? CAM.behind, go)   // stay with the boat, pulling back
        else if (C.follow) zCam += HEAD * vBoat * dt * (1 - go)
        camH = lerp(lerp(CAM.h1, CAM.mid ? CAM.mid.h : CAM.h1, mid), CAM.h2, go)
        if (C.ascent) camH = lerp(camH, C.ascent.h, smooth(C.ascent.from / JOURNEY_S, C.ascent.to / JOURNEY_S, t))
        camH += bob * (C.camRide || 0) * (1 - go)          // a camera out there rides the same swell
        yH = H * lerp(CAM.horizon1, CAM.horizon2, go)

        const zRow = zBoat + HEAD * ROWER.at
        // the wake, in pulses with the drive
        if (st.phase === 'catch') pulse.bow = 0, pulse.stern = false
        if (st.phase === 'drive') {
            const size = clamp(vBoat / 1.6, 0.5, 1.3)
            while (pulse.bow < RIPPLE.bowAt.length && st.t >= RIPPLE.bowAt[pulse.bow]) {
                addRipple('ring', xBoat, zBoat + HEAD * BOAT.len * 0.95, now, 1, size); pulse.bow++
            }
            if (!pulse.stern && st.t >= RIPPLE.sternAt) {
                pulse.stern = true
                for (const dx of [-0.35, 0.35]) addRipple('ring', xBoat + dx, zBoat + HEAD * 0.1, now, 1, size)
            }
        }
        // splashes as the blades catch
        if (st.phase === 'catch' && prevPhase !== 'catch') {
            for (const side of [-1, 1]) { const tip = bladeTip(side, { sweep: SWEEP.catch, lift: 0 }, zRow); addRipple('splash', tip.x, tip.z, now) }
        }
        // where the blades leave the water: the water turns (for the star
        // reflections), and now and then a visible eddy
        if (st.phase === 'release' && prevPhase === 'drive') {
            for (const side of [-1, 1]) {
                const tip = bladeTip(side, { sweep: SWEEP.finish, lift: 0 }, zRow)
                vortices.push({ x: tip.x, z: tip.z, dir: -side, born: now })
                if (Math.random() < RIPPLE.swirlChance) addRipple('swirl', tip.x, tip.z, now, -side)
            }
            if (vortices.length > 24) vortices.splice(0, vortices.length - 24)
            strokes++
        }
        if (st.phase === 'recover' && st.t < 0.5 && Math.random() < 0.12) {
            const side = Math.random() < 0.5 ? -1 : 1, tip = bladeTip(side, st, zRow)
            drips.push({ x: tip.x, z: tip.z, h: tip.h, vh: 0 })
        }
        tickSounds(now, st.phase === 'drive', st.t, st.phase === 'recover', st.t)
        prevPhase = st.phase

        const [top, hor] = skyAt(t)
        // the boat, oars and rower take on the sea's colour as they recede
        // (aerial perspective): never a stark cut-out, lost in the dawn light
        {
            const d = zRow - zCam
            const b = proj(0, 0, zRow)
            const k = clamp((b.y - yH) / Math.max(1, H - yH), 0, 1)
            haze.col = mixRGB(mixRGB(hor, [0, 0, 0], 0.25), mixRGB(top, [0, 0, 0], 0.45), k)
            haze.k = smooth(3, 24, d) * 0.85
        }
        drawSkyAndSea(t, top, hor)
        // stars first, then the island over them: as it emerges it covers the
        // stars behind it, in proportion to how solid it has become
        const vScreens = vortexScreens(now)
        if (C.stars) drawStars(now, t, vScreens)
        drawSkye(t, hor, top)
        if (C.weather?.fog) {
            // a fog bank on the horizon, thickening: the island is lost in it
            const f = lerp(C.weather.fog[0], C.weather.fog[1], smooth(T.skye0, T.skye1, t))
            const g = ctx.createLinearGradient(0, yH - H * 0.2, 0, yH + H * 0.1)
            const fc = mixRGB(hor, [236, 238, 242], 0.35)
            g.addColorStop(0, rgb(fc, 0)); g.addColorStop(0.7, rgb(fc, f)); g.addColorStop(0.85, rgb(fc, f)); g.addColorStop(1, rgb(fc, 0))
            ctx.fillStyle = g; ctx.fillRect(0, yH - H * 0.2, W, H * 0.3)
        }
        drawRipples(now, t, hor)
        if (C.weather) drawWeather(now, dt, t, hor)
        if (C.weather?.veils) drawVeils(now, dt, t, hor)
        updateFront(elapsed / 1000)
        if (C.weather?.impacts) drawImpacts(now, dt, hor)
        drawDripsAndRings(now, dt)
        // the boat, the oars behind the rower, the rower, then the near oars
        if (Math.min(zBoat, zBoat + HEAD * BOAT.len) - zCam > 0.3) {   // until it has passed us
            drawBoat(st, t, hor)
            drawOarOut(-1, st, zRow, t); drawOarOut(1, st, zRow, t)
            if (C.rowerView === 'back') {           // seen from behind, the body hides the handles
                drawOarIn(-1, st, zRow, t); drawOarIn(1, st, zRow, t)
                drawRower(st, zRow, t, hor)
            } else {
                drawRower(st, zRow, t, hor)
                drawOarIn(-1, st, zRow, t); drawOarIn(1, st, zRow, t)
            }
        }
        if (C.weather?.rain) drawRain(now, dt, hor)

        if (C.ascent) drawCloudsOver(elapsed / 1000)
        if (C.runoff) drawRunoff(elapsed / 1000, dt)
        // a soft vignette, lifting as the light comes
        const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.1, W * 0.5, H * 0.5, H * 0.9)
        vig.addColorStop(0, 'rgba(0,0,0,0)')
        vig.addColorStop(1, `rgba(1,2,5,${lerp(0.62, 0.12, smooth(0.5, 1, t))})`)
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
        if (meter) {
            meter.frames++
            if (now - meter.since > 500) {
                const fps = meter.frames * 1000 / (now - meter.since)
                meter.text = `${fps.toFixed(0)} fps  ${(1000 / fps).toFixed(1)} ms${C.runoff ? '  runoff' : ''}`
                meter.frames = 0; meter.since = now
            }
            ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(6, 6, 150, 20)
            ctx.fillStyle = '#e6edf5'; ctx.font = '12px monospace'; ctx.fillText(meter.text, 12, 20)
        }
    }

    // near: 1 by the boat, 0 once high in the cloud -- for the rain's sound
    return { draw,
        // how high into the cloud we've risen, 0..1 (for the rising wind)
        get climb() { return C.ascent ? Math.max(goNow * 0.5, smooth(C.ascent.from - 3, C.ascent.to, (performance.now() - startTime) / 1000)) : goNow },
        // how much rain to hear: the storm's arrival, times how near we are
        get rain() { return (C.weather?.front ? storm : 1) * this.near },
        get near() { return C.ascent ? (1 - goNow) * (1 - smooth(C.ascent.from, C.ascent.to, (performance.now() - startTime) / 1000)) : 1 - goNow } }
}

// ── the journeys ─────────────────────────────────────────────────────────────
// Times are seconds from the start. sky: [journey fraction, top, horizon].
export const DAWN = {
    journeyS: 36, still: [2, 8], act2: 10, act2Len: 3, landmarkIn: [13, 29],
    landmark: { src: 'assets/skye2.png', x: 0.52, w: 0.46, fade: 'in' },
    sky: [
        [0.00, '#03050b', '#0b1224'],
        [0.40, '#080c24', '#1e2244'],
        [0.68, '#1a2150', '#6a4a72'],
        [0.86, '#3d5288', '#d98a78'],
        [1.00, '#6f8cbc', '#f6c48a'],
    ],
    stars: true, sun: true,
    cam: { behind: 1.5, h1: 1.75, h2: 7.5, horizon1: 0.44, horizon2: 0.2 },
    follow: true, heading: 1, startZ: 0, camZ: -1.5,
    rowerView: 'front', silhouette: 0.86,
    weather: null,
}

// The return: Skye to Eire on a grey, windy, ominous day -- the dawn
// crossing turned around. Close behind the rower (a generated back view,
// silhouetted), pulling away from Skye; then the camera rises, pulls back
// and widens until the boat is nearly lost in a heavy grey sea, while the
// island sinks into a thickening fog bank. Ireland is below, offscreen.
export const RETURN = {
    // 0-3 s right on the rower, easing back to a large close-up (the island
    // over their shoulder) where we STAY; 2-13 s the curtains gather round
    // the island until they all but hide it; 13-20 s the storm crosses the
    // water toward us, rain filling the sea behind its ragged edge; ~20 s it
    // reaches us and the glass takes the splash, the rower large behind the
    // drops; ~28 s only then the rise, down to a speck; then the cloud.
    journeyS: 40, still: [999, 999], act2: 28, act2Len: 7, landmarkIn: [6, 32],
    landmark: { src: 'assets/skye2.png', x: 0.5, w: 0.4, fade: 'out', fadeTo: 0.97 },
    sky: [
        [0.00, '#5b6169', '#8c9299'],
        [0.50, '#4f555d', '#7c8289'],
        [1.00, '#3e434a', '#686e75'],
    ],
    stars: false, sun: false,
    // opens on a narrow lens (zoom1) so the rower fills the screen, easing
    // back to the large close-up
    cam: { behind: 6.3, zoom1: 2.3, mid: { from: 0.6, to: 3.4, behind: 6.3, h: 2.15 },
           behind2: 120, h1: 1.6, h2: 48, horizon1: 0.42, horizon2: 0.14, zoom2: 0.7 },
    follow: false, followAll: true, heading: -1, startZ: 0, camZ: 0, drift: 0,
    rowerView: 'back', silhouette: 0.82,           // near-silhouette: the back's shape still reads
    // A strong, regular oarsperson, in five distinct phases: a sharp catch,
    // a hard fast drive, the release, a HELD glide, a steady recovery.
    drive: 4.4, lean: 0.25, leanShape: 0.09,
    seatH: 0.04,                                    // sits low: the handles come in at the chest
    stroke: { catchMs: 300, driveMs: 680, releaseMs: 220, glideMs: 750, recoverMs: 1300, recoverLift: 0.34 },
    camRide: 0.85,                                  // the camera rides the swell too (no bouncing)
    ascent: { from: 34, to: 40, h: 90, grey: '#8b9097' },
    // the glass takes the splash as the storm reaches us (start, seconds);
    // times below are from then. gravity: how hard running drops accelerate
    // big: a few large drops placed over the boat (x, y: screen fractions;
    // at: seconds after the splash starts) so the boat is seen through them
    runoff: { start: 20, perSec: 5, max: 16, r: [18, 90], runAt: 26, gravity: 1.6, maxV: 1.1, stopChance: 0.7,
              landUntil: 5, fade: [6.2, 7.8], lens: 1.8, down: 4, milk: 0.07,   // down: how soft (copy at 1/down size); milk: white wash
              big: { count: 3, r: [80, 125], x: [0.3, 0.7], y: [0.45, 0.8], at: [0.05, 1.0] } },
    // swellS = the stroke cycle (catch+drive+release+glide+recover, 3.25 s):
    // the boat's pitch, the camera's ride and the stroke share one rhythm.
    // crestSpeed 0: the swell lines lie still on the water and slide past
    // as the boat pulls.
    weather: { swell: 0.34, swellS: 3.25, crestM: 3.4, crestSpeed: 0, crestA: 0.24,
               windX: -0.6, windZ: -0.4, rain: 0, fog: [0.05, 0.85],
               // the storm crossing the water: its front runs from startDist
               // to us; most rings fall in bands at its edge (bandShare)
               // band, bandGap: in fractions of the water's height on screen
               // the front: a light, RAGGED leading edge (ragged: how far it wavers
               // across the screen, as a fraction of the water's height)
               front: { from: 13, to: 20, startDist: 60, endDist: 3.2, band: 0.05, bandGap: 0.09, bandShare: 0.12, ragged: 0.12 },
               // raise perSec & max if the phone copes; duringRunoff thins them while drops run
               // minPx: smallest ring drawn (px), so distant rain still shows
               impacts: { perSec: 1100, max: 1300, lifeMs: 480, r: 0.14, near: 1.2, far: 90, alpha: 0.55, duringRunoff: 0.6, minPx: 1.3 },
               // curtains gathered round the island (spread), growing darker 2-10 s
               // bend: how far the top is carried by the wind (fraction of width); wider, so they overlap
               veils: { count: 9, near: 24, far: 65, width: [14, 34], speed: 1.1, alpha: 0.5, streaks: 16, fall: 0.9, spread: 26, bend: [0.3, 1.1],
                        grow: { from: 2, to: 9, alpha: [0.25, 1.7] } } },
}
