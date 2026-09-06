// cloudShadows.js  (v2 — composited onto the ground canvas)
// Location: js/game/effects/cloudShadows.js
//
// Broken cloud racing over the ground.
//
// ── Why not a DOM overlay ────────────────────────────────────────────────────
// v1 was a CSS-3D plane at z:5. It could not work: a screen-space rectangle has
// no idea where the ground is, so it bled over the sky and showed its own
// straight edges wherever the plane ended. Both are unfixable in that approach.
//
// v2 paints into the PGR's ground canvas instead, at the end of the ground
// pass, with globalCompositeOperation = 'source-atop'. That composite mode only
// paints where pixels already exist — and the ground canvas is transparent
// above the terrain. So the shadows land on ground and nothing else, with no
// mask, no clipping and no edges. Sky bleed is impossible by construction.
//
// Trees and buildings live on the objects canvas and are NOT shadowed. That is
// the "perspective tiles layer only" behaviour; shadowing the objects too would
// mean a second pass on that canvas.
//
// ── Projection ───────────────────────────────────────────────────────────────
// The ground is drawn in horizontal bands. For each band we ask the PGR itself
// for the world row and the pixels-per-tile at that row, then set a pattern
// transform so the cloud texture is sampled in WORLD space. Shadows therefore
// compress toward the horizon exactly as the terrain does, because they use the
// same projection rather than an approximation of it.
//
// Per band, with N = texture size and C = cloudTiles (world tiles per texture
// repeat), s = pxPerTile at that row:
//
//   patternScale = s * C / N
//   tx = sw/2 - (camCol + windCol) * s
//   ty = bandY - (worldRow + windRow) * s
//
// ── Cost ─────────────────────────────────────────────────────────────────────
// One pattern fill per band (~70 at the default 24px). Total fill is one
// ground-sized alpha blend per frame — the same order as the old overlay, but
// correct. The texture is built once.
//
// Usage (wired by PerspectiveScene; PGR calls renderTo):
//   this.cloudShadows = new CloudShadows(this, { pgr: this.perspectiveGround })
//   this.cloudShadows.update(delta)          // advances drift
//   this.cloudShadows.destroy()

import { wind } from './wind.js'

export const CLOUD_SHADOW_DEFAULTS = {
  enabled: true,

  // Darkness of a full shadow, 0..1.
  intensity: 0.42,
  shadowColor: '#16202b',

  // ── Sunlight ──────────────────────────────────────────────────────────────
  // Lit ground is not merely "less dark" — under broken cloud the gaps are
  // warm while the shadowed ground goes cool and blue. That warm/cool split is
  // most of what sells the effect; without it a sun patch reads as a hole in a
  // filter rather than as light.
  //
  // This costs NOTHING extra: both the shadow and the sun tint are baked into
  // the single RGBA texture (colour mixed by coverage, alpha carrying both),
  // so it is still one pattern fill per band.
  sunAmount: 0.10,
  sunColor: '#ffd9a0',

  // Fraction of ground under cloud.
  //
  // IMPORTANT: cover and softness fight each other. softness widens the ramp
  // either side of the coverage threshold, which pushes the whole distribution
  // down — so raising softness silently REDUCES how much ground ends up
  // shaded. Soft edges therefore need a HIGHER cover to stay overcast.
  // At softness 0.9, cover must be ~0.93 to read as a cloudy day.
  cover: 0.93,
  // Softness of shadow edges, 0..1.
  softness: 0.9,

  // Domain warp, in lattice units. Pushes the noise through itself so edges
  // curl and wisp instead of looking like smooth blobs. Bake-time only.
  warp: 0.35,

  // World tiles spanned by one texture repeat. Bigger = larger, slower clouds.
  cloudTiles: 30,
  // Drift in tiles/sec at wind strength 1.0.
  speed: 2.2,

  // ── Banding ───────────────────────────────────────────────────────────────
  // Bands are spaced GEOMETRICALLY, not at a fixed pixel height. A fixed height
  // is catastrophic near the horizon, where pixels-per-tile collapses and the
  // texture coordinate explodes — that is what produced the hard horizontal
  // lines. Each band instead ends when pixels-per-tile has dropped by
  // bandRatio, so the sampling error is uniform down the screen.
  bandRatio: 0.96,   // 0.9..0.98; closer to 1 = smoother, more bands
  minBandPx: 2,
  maxBandPx: 40,

  // Stop drawing where a tile is narrower than this many pixels. Shadows there
  // are sub-pixel, and it is precisely where the seams are worst.
  minScale: 10,
  // Fade shadows out between minScale and fadeScale, so the residual seams sit
  // where there is no shadow left to seam. Also reads as haze swallowing the
  // distance, which is what actually happens.
  fadeScale: 34,

  // Lattice periods across the texture. Whole numbers only, or the tile seams.
  repeat: 1,
  textureSize: 256,
  seed: 1337,

  // Paints shadows bright red at full strength to confirm placement.
  debug: false,
}

/* ── tileable value noise ────────────────────────────────────────────────── */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smooth = t => t * t * (3 - 2 * t)

function makeLattice(g, rnd) {
  const v = new Float32Array(g * g)
  for (let i = 0; i < v.length; i++) v[i] = rnd()
  return v
}

function sampleLattice(v, g, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = smooth(x - xi), yf = smooth(y - yi)
  const x0 = ((xi % g) + g) % g, x1 = (x0 + 1) % g
  const y0 = ((yi % g) + g) % g, y1 = (y0 + 1) % g
  const top = v[y0 * g + x0] + (v[y0 * g + x1] - v[y0 * g + x0]) * xf
  const bot = v[y1 * g + x0] + (v[y1 * g + x1] - v[y1 * g + x0]) * xf
  return top + (bot - top) * yf
}

function buildTextureCanvas(cfg) {
  const N = cfg.textureSize
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(N, N)
  const d = img.data

  const rnd = mulberry32(cfg.seed)
  // Four octaves, not three. Three gives only large smooth forms — the
  // "lava lamp" look. The fourth adds detail riding on the big shapes, which
  // is what stops a cloud edge reading as a drawn curve.
  const grids = [2, 4, 8, 16]
  const amps  = [0.52, 0.26, 0.14, 0.08]
  const lats  = grids.map(g => makeLattice(g, rnd))

  // Each octave must span a WHOLE number of lattice periods across the
  // texture, or opposite edges do not meet and the tile shows a seam.
  const repeat = Math.max(1, Math.round(cfg.repeat))

  // fbm sample at a point, in lattice space
  const fbm = (px, py) => {
    let n = 0
    for (let o = 0; o < grids.length; o++) {
      const g = grids[o]
      n += sampleLattice(lats[o], g, px * g * repeat, py * g * repeat) * amps[o]
    }
    return n
  }

  const raw = new Float32Array(N * N)
  let mn = Infinity, mx = -Infinity
  const w = cfg.warp || 0

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let px = x / N, py = y / N
      if (w > 0) {
        // Domain warp: offset the lookup by the field itself. The warp field is
        // periodic, so the texture still tiles.
        const wx = fbm(px + 0.31, py + 0.17) - 0.5
        const wy = fbm(px - 0.23, py + 0.44) - 0.5
        px += wx * w / (grids[0] * repeat)
        py += wy * w / (grids[0] * repeat)
      }
      const n = fbm(px, py)
      raw[y * N + x] = n
      if (n < mn) mn = n
      if (n > mx) mx = n
    }
  }

  // Summed octaves cluster around the middle rather than filling 0..1, so
  // normalise before thresholding — otherwise `cover` barely bites.
  const span = (mx - mn) || 1
  const thresh = 1 - cfg.cover
  const ramp = Math.max(0.02, cfg.softness * 0.6)

  const rgb = hex => {
    const h = hex.replace('#', '')
    const v = parseInt(h, 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
  }
  const [sr, sg, sb] = rgb(cfg.debug ? '#ff0000' : cfg.shadowColor)
  const [ur, ug, ub] = rgb(cfg.sunColor)

  // Alpha is scaled at draw time by ctx.globalAlpha = intensity, so the sun
  // tint is expressed relative to it and lands at sunAmount once multiplied.
  const sunRatio = cfg.debug ? 0
    : Math.min(4, (cfg.sunAmount || 0) / Math.max(0.001, cfg.intensity))

  const coverage = new Float32Array(N * N)

  for (let i = 0; i < raw.length; i++) {
    const n = (raw[i] - mn) / span
    let c = (n - thresh) / ramp
    c = c < 0 ? 0 : c > 1 ? 1 : c
    c = smooth(c)                        // 0 = full sun, 1 = full shadow
    coverage[i] = c

    // Cool where shadowed, warm where lit; the crossover does the work.
    const j = i * 4
    d[j]     = Math.round(ur + (sr - ur) * c)
    d[j + 1] = Math.round(ug + (sg - ug) * c)
    d[j + 2] = Math.round(ub + (sb - ub) * c)
    d[j + 3] = Math.round(Math.min(1, c + (1 - c) * sunRatio) * 255)
  }

  ctx.putImageData(img, 0, 0)
  cv._coverage = coverage      // raw 0..1 field, for per-tile sampling
  return cv
}

export class CloudShadows {
  constructor(scene, opts = {}) {
    this.scene = scene
    this.pgr   = opts.pgr || scene.perspectiveGround || scene.pgr || null
    this.cfg   = { ...CLOUD_SHADOW_DEFAULTS, ...opts }

    // Drift accumulators, in world tiles.
    this._wCol = 0
    this._wRow = 0

    this._tex = buildTextureCanvas(this.cfg)
    this._pattern = null   // built lazily against the ground ctx
    this._bandKey = null
    this._bandCache = []
    this._buildRamp()
  }

  /** Per frame, from the scene. Only advances drift — no drawing. */
  update(delta) {
    if (!this.cfg.enabled) return
    const dt = (delta || 16) / 1000
    const v = this.cfg.speed * wind.strength
    this._wCol += wind.dirX * v * dt
    this._wRow += wind.dirY * v * dt

    // Wrap on the texture period so the offsets never grow without bound.
    const C = this.cfg.cloudTiles
    if (Math.abs(this._wCol) > C * 64) this._wCol %= C
    if (Math.abs(this._wRow) > C * 64) this._wRow %= C
  }

  /**
   * Called by the PGR at the end of its ground pass, with the ground context.
   * source-atop confines every fill to pixels the terrain already painted.
   */
  /**
   * Band boundaries, cached. They depend only on the camera row and the
   * viewport, so they are recomputed on movement, not every frame.
   */
  _bands(pgr, horizonPx, sh) {
    const camRow = pgr._perspCamRow()
    const key = `${Math.round(camRow * 4)}_${sh}_${horizonPx}`
    if (this._bandKey === key) return this._bandCache

    const c = this.cfg
    const out = []
    let y = sh
    let sLast = pgr._scaleAtRow(pgr._screenYToWorldRow(y - 1) ?? 0) || 1

    while (y > horizonPx) {
      // Grow the band until pixels-per-tile has dropped by bandRatio.
      let h = c.minBandPx
      while (h < c.maxBandPx && y - h > horizonPx) {
        const r = pgr._screenYToWorldRow(y - h)
        if (r == null) break
        const s = pgr._scaleAtRow(r)
        if (!s || s / sLast < c.bandRatio) break
        h++
      }

      const y0 = y - h
      if (y0 <= horizonPx) break

      const rMid = pgr._screenYToWorldRow(y0 + h * 0.5)
      if (rMid == null) break
      const sMid = pgr._scaleAtRow(rMid)
      if (!sMid || sMid < c.minScale) break

      // Fade in over minScale..fadeScale so the worst seams carry no shadow.
      const f = Math.min(1, Math.max(0, (sMid - c.minScale) / Math.max(1, c.fadeScale - c.minScale)))
      out.push({ y0, h, row: rMid, s: sMid, fade: f * f * (3 - 2 * f) })

      sLast = sMid
      y = y0
    }

    this._bandKey = key
    this._bandCache = out
    return out
  }

  /** Bilinear sample of the coverage field, in world tiles, wrapping. */
  _coverAt(colW, rowW) {
    const cov = this._tex?._coverage
    if (!cov) return 0
    const N = this.cfg.textureSize
    const C = this.cfg.cloudTiles

    const fx = (colW / C) * N
    const fy = (rowW / C) * N
    const xi = Math.floor(fx), yi = Math.floor(fy)
    const tx = fx - xi, ty = fy - yi

    const x0 = ((xi % N) + N) % N, x1 = (x0 + 1) % N
    const y0 = ((yi % N) + N) % N, y1 = (y0 + 1) % N

    const a = cov[y0 * N + x0], b = cov[y0 * N + x1]
    const c = cov[y1 * N + x0], d = cov[y1 * N + x1]
    const top = a + (b - a) * tx
    const bot = c + (d - c) * tx
    return top + (bot - top) * ty
  }

  /**
   * Per-tile shading, called from inside the PGR's ground tile loop with the
   * tile's world position AND its already-projected quad.
   *
   * This is the whole point of the per-tile mode: the cloud is sampled at
   * (col, row) in WORLD space, so elevation cannot displace it. A tile lifted
   * onto a rampart carries the same shadow it would have at ground level,
   * which is what actually happens outdoors.
   */
  tintTile(ctx, col, row, xTL, yTL, xTR, yTR, xBR, yBR, xBL, yBL, tileAlpha, elev) {
    const cfg = this.cfg

    if (cfg.heightProbe > 0) {
      const hv = Math.min(1, Math.abs(elev || 0) * cfg.heightProbe)
      ctx.save()
      ctx.globalAlpha = 0.25 + 0.65 * hv
      ctx.fillStyle = hv > 0.001 ? `rgb(255,0,${Math.round(255 * (1 - hv))})` : 'rgb(0,180,255)'
      ctx.beginPath()
      ctx.moveTo(xTL, yTL); ctx.lineTo(xTR, yTR)
      ctx.lineTo(xBR, yBR); ctx.lineTo(xBL, yBL)
      ctx.closePath(); ctx.fill()
      ctx.restore()
      return
    }

    if (!cfg.enabled || !cfg.perTile) return

    // Displace the sample along the sun ray in proportion to height. This is
    // the whole terrain response: raised ground samples the cloud from further
    // "up-sun", so a rampart catches a different part of the shadow than the
    // ground at its foot, and the shadow edge bends as it climbs.
    // NOTE: elev must come from the HEIGHTMAP, not from _elev. Maps like b0
    // build their terrain entirely from the per-vertex heightMap and leave
    // _elev null, so reading _elev there gives 0 on every tile and the whole
    // effect silently does nothing however high shiftPerHeight is set.
    const e = (elev || 0) * cfg.shiftPerHeight
    const c = this._coverAt(
      col + this._wCol + e * cfg.sunDirX,
      row + this._wRow + e * cfg.sunDirY)

    const sunRatio = this._sunRatio
    const a = (c + (1 - c) * sunRatio) * cfg.intensity * (tileAlpha ?? 1)
    if (a < 0.02) return

    const col3 = this._mixColour(c)

    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = col3
    ctx.beginPath()
    ctx.moveTo(xTL, yTL)
    ctx.lineTo(xTR, yTR)
    ctx.lineTo(xBR, yBR)
    ctx.lineTo(xBL, yBL)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  _mixColour(c) {
    const i = Math.max(0, Math.min(15, Math.round(c * 15)))
    return this._ramp[i]
  }

  /**
   * Screen-space band compositing — the pre-per-tile path. Kept because it
   * gives smoother gradients on genuinely flat maps.
   */
  renderTo(pgr, ctx) {
    if (this.cfg.perTile) return
    if (!this.cfg.enabled || !ctx || !pgr) return

    const sw = pgr._sw, sh = pgr._sh
    if (!sw || !sh) return

    const horizonPx = pgr._horizonPx()
    const camCol = pgr._perspCamCol()
    const N = this.cfg.textureSize
    const C = this.cfg.cloudTiles

    if (!this._pattern) {
      this._pattern = ctx.createPattern(this._tex, 'repeat')
      if (!this._pattern) return
    }
    // Pattern transforms need DOMMatrix; bail cleanly on anything too old
    // rather than throwing inside the render loop.
    if (typeof DOMMatrix === 'undefined' || !this._pattern.setTransform) return

    const bands = this._bands(pgr, horizonPx, sh)
    const base = this.cfg.debug ? 1 : this.cfg.intensity

    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = this._pattern

    for (let i = 0; i < bands.length; i++) {
      const b = bands[i]
      if (b.fade <= 0.01) continue

      // Sample the texture in WORLD space, using the PGR's own projection.
      const k = b.s * C / N
      const tx = sw / 2 - (camCol + this._wCol) * b.s
      const ty = (b.y0 + b.h * 0.5) - (b.row + this._wRow) * b.s

      ctx.globalAlpha = base * b.fade
      this._pattern.setTransform(new DOMMatrix([k, 0, 0, k, tx, ty]))
      // Exactly b.h, never b.h + 1: bands already tile edge to edge, so any
      // overlap gets alpha-blended TWICE and shows as a dark line at every
      // single band boundary.
      ctx.fillRect(0, b.y0, sw, b.h)
    }

    ctx.restore()
  }

  /**
   * 16-step colour ramp from sun to shadow, precomputed so the per-tile path
   * never builds a colour string in the frame loop.
   */
  _buildRamp() {
    const cfg = this.cfg
    const hex = h => {
      const v = parseInt(String(h).replace('#', ''), 16)
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
    }
    const [sr, sg, sb] = hex(cfg.debug ? '#ff0000' : cfg.shadowColor)
    const [ur, ug, ub] = hex(cfg.sunColor)

    this._sunRatio = cfg.debug ? 0
      : Math.min(4, (cfg.sunAmount || 0) / Math.max(0.001, cfg.intensity))

    this._ramp = []
    for (let i = 0; i < 16; i++) {
      const t = i / 15
      this._ramp.push(`rgb(${Math.round(ur + (sr - ur) * t)},` +
                      `${Math.round(ug + (sg - ug) * t)},` +
                      `${Math.round(ub + (sb - ub) * t)})`)
    }
  }

  configure(opts = {}) {
    const rebuild = ['cover', 'softness', 'shadowColor', 'sunColor', 'sunAmount',
                     'intensity', 'warp', 'repeat', 'textureSize', 'seed', 'debug']
      .some(k => opts[k] !== undefined)
    Object.assign(this.cfg, opts)
    if (rebuild) {
      this._tex = buildTextureCanvas(this.cfg)
      this._pattern = null
    }
    this._bandKey = null
    this._buildRamp()
    return this
  }

  setIntensity(v) { this.cfg.intensity = v; return this }

  setEnabled(on) { this.cfg.enabled = !!on; return this }

  destroy() {
    // v1 left a DOM layer behind; clear any stale one from an old build.
    const stale = document.getElementById('pgr-cloud-shadows')
    if (stale) stale.parentNode?.removeChild(stale)
    this._tex = null
    this._pattern = null
  }
}

export default CloudShadows
