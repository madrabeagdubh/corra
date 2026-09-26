import { NOCTURNE } from '../systems/nightPalette.js'   // [nocturne]
// riverLayer.js -- a smooth river drawn into the PGR's ground, row by row.
// Location: js/game/effects/riverLayer.js
//
// The game's own water is tile-based (GIDs 1625/1679): right for maps seen from above, but
// from the intro's low camera a winding river of whole tiles is all stair-steps. This draws
// the river instead as a smooth ribbon along a centreline the map provides:
//
//   map.river = { width, level, line: [[col, row], ...] }   (intro_hilltop_gen.py --shape valley)
//
// DEPTH. The PGR paints its ground far to near, one tile row at a time, and calls
// scene.riverLayer.renderRow() after each row (next to the flora's own hook). Each call
// fills only the ribbon's slice lying in that row, so nearer ground -- banks, the feet of
// hills, the far ridge -- paints over farther water by itself. No occlusion code at all.
//
// LOOK. Dark water holding the night sky, on pgr-ground, so it takes the ground's grade and
// the moon's dimming like the rest of the land.
//
// THE MOON ROAD is drawn separately, onto pgr-objects (under the flowers of the same and
// nearer rows). On the ground canvas it could never be bright: the ground's tone curve and
// the moon's dimming cap anything there at roughly a third of full brightness. pgr-objects
// carries the flowers' gentler grade and lifted brightness instead (introLevel's FLORA), so
// the reflection can actually shine. That canvas is not occluded by nearer ground, so the
// road is clipped by hand: at the moon's x, anything below the highest ground drawn in front
// of it is hidden, which is what hides it behind the far ridge.
// The road twinkles and drifts gently downstream (ROAD_FRAMES etc.); the water itself is still.
//
// Knobs: WATER_NEAR, WATER_FAR, FLOWER_MARGIN, GLINT_*, ROAD_* below.  [riverLook] [riverFlow] [riverSlow]

// [riverLook] Night water holds the sky, so it should read as lighter and bluer than the
// land around it, and paler with distance (a glancing view sees the brighter sky at the
// horizon). These are chosen for what they become AFTER the ground grade, measured against
// a real screenshot: that curve turns any light, neutral colour sage-green -- grass-coloured
// -- so the water has to go in strongly blue-violet to come out as a moonlit slate-blue.
// (With ?night=0 or ?lit=1 there is no grade, and it shows as the vivid violet it really is.)
// [nocturne] With the shared warm palette on (the default), its waterNear/waterFar are used
// instead: calibrated to ITS ground curve. These two are the cool palette's (?nocturne=0).
const WATER_NEAR  = NOCTURNE.on ? NOCTURNE.waterNear : [100, 95, 250]
const WATER_FAR   = NOCTURNE.on ? NOCTURNE.waterFar  : [135, 108, 255]
const WATER_FAR_D = 70        // distance (tiles) by which it reaches WATER_FAR
// Flowers keep this far (tiles) back from the water's edge, so the bank reads cleanly.
const FLOWER_MARGIN = 0.8
// The moon road at its core, and how opaque. Graded like the flowers: gently.
const GLINT_RGB   = NOCTURNE.on ? NOCTURNE.glint : [236, 240, 250]   // [nocturne] gold
const GLINT_ALPHA = 1.0
// The moon road's half-width: a fixed part in px, plus a part in tiles (so it widens with
// nearness, as the reflection does).
const GLINT_PX    = 5
const GLINT_TILES = 0.55
// [riverLook] The road broken into ripple highlights: every slice of it gets its own
// (fixed, seeded) width, sideways offset and strength, so it reads as moonlight on moving
// water rather than a painted column. 0 on all three = the smooth road.
const ROAD_WIDTH_VAR = 0.45   // width varies by +/- this fraction
const ROAD_SHIFT     = 0.35   // sideways shift, as a fraction of the half-width
const ROAD_DIM       = 0.5    // how much dimmer the faintest slices are (0..1)
const ROAD_SLICE_PX  = 3.5    // near rows are split into slices about this tall, so
                              // the ripples stay fine up close
// [riverFlow] The road moves, slowly. Some slices change through ROAD_FRAMES variants, each on
// its own offset so they never change in unison, and the whole pattern creeps one row
// downstream -- toward the camera -- every ROAD_DRIFT_S seconds. [riverSlow] Both are
// cross-faded: rather than drawing a slice twice to blend two variants, its width, shift and
// strength are interpolated between them, so a change is a slow swell or fade at no extra
// cost. Nothing moves when the device asks for reduced motion.
const ROAD_FRAMES    = 6      // variants a changing slice moves through
const ROAD_STEP_S    = 3.5    // seconds for a slice to move from one variant to the next
const ROAD_TWINKLE   = 0.45   // share of slices that change (0 = none)
const ROAD_DRIFT_S   = 14     // seconds per row of downstream drift (0 = no drift)
// [pixelWater] The look. 'pixel': old-school -- the road as short, hard-edged dashes on a
// chunky pixel grid, two flat tones, with gaps, changing in hard steps; the water in a few
// flat bands. 'smooth': the soft gradient road (all the ROAD_* values above).
const RIVER_STYLE    = 'pixel'
const PIX            = 2      // the pixel grid, in canvas px
const PIXEL_STEP_S   = 1.2    // each dash changes, in one hard step, this often (own offset)
const PIXEL_GAP      = 0.35   // chance a dash is left out, so the road is broken
const PIXEL_DIM      = 0.5    // the dimmer of the two tones, as an alpha
const WATER_BANDS    = 3      // flat bands of water colour from near to far (pixel style)

export class RiverLayer {
  /**
   * @param {{width:number, level?:number, line:number[][]}} river  from the map JSON
   * @param {{moonX?: () => (number|null|undefined)}} opts  the moon's centre in canvas px
   */
  constructor(river, opts = {}) {
    this.width = river.width
    this.level = river.level ?? 0
    this.moonX = opts.moonX || (() => null)
    this._still = !!(typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches)
    this._tw = 0        // [riverSlow] continuous: variant steps, and rows of drift
    this._tp = 0        // [pixelWater] the pixel road's hard steps
    this._dr = 0
    const line = river.line
    const half = this.width / 2

    // Both banks, offset from the centreline along its normal.
    const L = [], R = []
    for (let i = 0; i < line.length; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)]
      let tx = b[0] - a[0], ty = b[1] - a[1]
      const n = Math.hypot(tx, ty) || 1
      tx /= n; ty /= n
      const [c, r] = line[i]
      L.push([c - ty * half, r + tx * half])
      R.push([c + ty * half, r - tx * half])
    }

    // One quad per step, all wound the same way, so a single nonzero fill is their union
    // even where the inside of a tight bend folds over itself. Bucketed by the tile rows
    // each one touches.
    this._rows = new Map()
    for (let i = 0; i + 1 < line.length; i++) {
      let q = [L[i], L[i + 1], R[i + 1], R[i]]
      let area = 0
      for (let k = 0; k < 4; k++) {
        const p = q[k], s = q[(k + 1) % 4]
        area += p[0] * s[1] - s[0] * p[1]
      }
      if (area < 0) q = q.reverse()
      const rows = q.map(p => p[1])
      for (let tr = Math.floor(Math.min(...rows)); tr <= Math.floor(Math.max(...rows)); tr++) {
        if (!this._rows.has(tr)) this._rows.set(tr, [])
        this._rows.get(tr).push(q)
      }
    }

    // Tiles the water covers, for Vegetation's isWater(): anything whose centre lies within
    // the half-width, plus FLOWER_MARGIN of clear bank.
    this._water = new Set()
    const reach = half + FLOWER_MARGIN
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1]
      for (let r = Math.floor(Math.min(ay, by) - reach); r <= Math.floor(Math.max(ay, by) + reach); r++) {
        for (let c = Math.floor(Math.min(ax, bx) - reach); c <= Math.floor(Math.max(ax, bx) + reach); c++) {
          if (segDist(c + 0.5, r + 0.5, ax, ay, bx, by) <= reach) this._water.add(c + ',' + r)
        }
      }
    }
  }

  isWaterTile(col, row) { return this._water.has(col + ',' + row) }

  /** Called by the PGR after the ground of tileRow is drawn, before any nearer row. */
  renderRow(pgr, ctx, tileRow) {
    // The loop runs far to near, so a row at or before the last one means a new frame.
    if (!(tileRow > this._lastRow)) {
      this._occ = null
      if (!this._still) {                                       // [riverFlow]
        const t = performance.now() / 1000
        this._tw = t / ROAD_STEP_S
        this._tp = t / PIXEL_STEP_S                              // [pixelWater]
        this._dr = ROAD_DRIFT_S > 0 ? t / ROAD_DRIFT_S : 0
      }
    }
    this._lastRow = tileRow
    const quads = this._rows.get(tileRow)
    if (!quads) return
    const camRow = pgr._perspCamRow()
    // The water's slice of this row, as a screen band at the water's own level.
    const y0 = this._y(pgr, tileRow), y1 = this._y(pgr, tileRow + 1)
    if (y0 == null || y1 == null) return

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, y0, pgr._sw, y1 - y0 + 0.5)   // +0.5: no hairline seam between rows
    ctx.clip()

    const path = this._path(pgr, quads, camRow)
    if (path) {
      let t = smooth((camRow - tileRow - 0.5) / WATER_FAR_D)
      if (RIVER_STYLE === 'pixel') t = Math.round(t * (WATER_BANDS - 1)) / Math.max(1, WATER_BANDS - 1)   // [pixelWater]
      ctx.fillStyle = `rgb(${WATER_NEAR.map((v, i) => Math.round(v + (WATER_FAR[i] - v) * t)).join(',')})`
      ctx.fill(path, 'nonzero')
    }
    ctx.restore()
    if (path) this._glint(pgr, path, tileRow, y0, y1)
  }

  _path(pgr, quads, camRow) {
    const path = new Path2D()
    let any = false
    for (const q of quads) {
      if (q.some(p => camRow - p[1] <= 0.02)) continue   // behind the camera: off-screen anyway
      for (let k = 0; k < 4; k++) {
        const [c, r] = q[k]
        const x = pgr._colToScreenX(c, r), y = this._y(pgr, r)
        if (k === 0) path.moveTo(x, y); else path.lineTo(x, y)
      }
      path.closePath()
      any = true
    }
    return any ? path : null
  }

  // The moon road's slice of this row, on the objects canvas. Clipped to one rect: the moon's
  // strip across, this row's band down, and nothing below the ground standing in front.
  _glint(pgr, path, tileRow, y0, y1) {
    const ctx = pgr._oCtx
    // [glintAlways] No tagged moon (the ogham dial's moon, during the poem) -> the screen's
    // centre line, where every moon in the intro sits.
    const m = this.moonX()
    const mx = Number.isFinite(m) ? m : pgr._sw / 2
    if (!ctx) return
    const w0 = GLINT_PX + GLINT_TILES * pgr._scaleAtRow(tileRow + 0.5)
    const bottom = Math.min(y1 + 0.5, this._occlusion(pgr, mx)[tileRow + 1] ?? Infinity)
    if (bottom <= y0) return
    const c = GLINT_RGB.join(',')
    if (RIVER_STYLE === 'pixel') return this._glintPixel(ctx, path, tileRow, y0, y1, mx, w0, bottom, c)
    // [riverLook] One ripple highlight per slice. Seeded on the world row, so each stays put
    // on its bit of water as the view pans. [riverFlow] ...and on the drift, which carries the
    // pattern downstream; a twinkling slice also picks its variant from the frame.
    // [riverSlow] The drift, blended between the pattern one row back and the next.
    const base = Math.floor(this._dr), fd = smooth(this._dr - base)
    const n = Math.max(1, Math.min(4, Math.round((y1 - y0) / ROAD_SLICE_PX)))
    for (let k = 0; k < n; k++) {
      const s0 = y0 + (y1 - y0) * k / n
      const s1 = Math.min(bottom, y0 + (y1 - y0) * (k + 1) / n + (k === n - 1 ? 0.5 : 0))
      if (s1 <= s0) break
      const p0 = this._ripple(tileRow - base, k), p1 = this._ripple(tileRow - base - 1, k)
      const w  = w0 * (1 + ROAD_WIDTH_VAR * (p0[0] + (p1[0] - p0[0]) * fd))
      const cx = mx + w0 * ROAD_SHIFT * (p0[1] + (p1[1] - p0[1]) * fd)
      const a  = GLINT_ALPHA * (1 - ROAD_DIM * (p0[2] + (p1[2] - p0[2]) * fd))
      const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0)
      g.addColorStop(0,   `rgba(${c},0)`)
      g.addColorStop(0.3, `rgba(${c},${(a * 0.2).toFixed(3)})`)
      g.addColorStop(0.5, `rgba(${c},${a.toFixed(3)})`)
      g.addColorStop(0.7, `rgba(${c},${(a * 0.2).toFixed(3)})`)
      g.addColorStop(1,   `rgba(${c},0)`)
      ctx.save()
      ctx.beginPath()
      ctx.rect(cx - w, s0, 2 * w, s1 - s0)
      ctx.clip()
      ctx.fillStyle = g
      ctx.fill(path, 'nonzero')
      ctx.restore()
    }
  }

  // [pixelWater] The old-school road: per slice of the row, one short dash on the PIX grid, in
  // one of two flat tones, or a gap. Each dash's shape is picked afresh in a hard step every
  // PIXEL_STEP_S (on its own offset), and the whole pattern steps a row downstream every
  // ROAD_DRIFT_S. Clipped to the water, like the smooth road.
  _glintPixel(ctx, path, tileRow, y0, y1, mx, w0, bottom, c) {
    const snap = (v) => Math.round(v / PIX) * PIX
    const row = tileRow - Math.floor(this._dr)
    const n = Math.max(1, Math.min(4, Math.round((y1 - y0) / (PIX * 2))))
    for (let k = 0; k < n; k++) {
      const y = snap(y0 + (y1 - y0) * k / n)
      if (y >= bottom || y + PIX <= y0) continue   // thin far rows still get their dash
      const v  = hash(row, k, 7) < ROAD_TWINKLE
        ? Math.floor(this._tp + hash(row, k, 8) * ROAD_FRAMES) % ROAD_FRAMES : 0
      const sv = 10 * v
      if (hash(row, k, 3 + sv) < PIXEL_GAP) continue
      const w  = w0 * (0.35 + 0.65 * hash(row, k, 1 + sv))
      const cx = mx + w0 * ROAD_SHIFT * (hash(row, k, 2 + sv) * 2 - 1)
      const x0 = snap(cx - w), x1 = Math.max(x0 + PIX, snap(cx + w))
      ctx.save()
      ctx.beginPath()
      ctx.rect(x0, y, x1 - x0, Math.min(PIX, bottom - y))   // never below the ground in front
      ctx.clip()
      ctx.fillStyle = `rgba(${c},${hash(row, k, 4 + sv) > 0.4 ? GLINT_ALPHA : PIXEL_DIM})`
      ctx.fill(path, 'nonzero')
      ctx.restore()
    }
  }

  // [riverSlow] One ripple's shape for a slice of pattern-row `row`: [width, shift, dimness],
  // the first two in -1..1, the last 0..1. A changing slice is cross-faded between its current
  // variant and the next.
  _ripple(row, k) {
    const one = (v) => {
      const sv = 10 * v
      return [hash(row, k, 1 + sv) * 2 - 1, hash(row, k, 2 + sv) * 2 - 1, hash(row, k, 3 + sv)]
    }
    if (!(hash(row, k, 7) < ROAD_TWINKLE)) return one(0)
    const p = this._tw + hash(row, k, 8) * ROAD_FRAMES
    const i = Math.floor(p), f = smooth(p - i)
    const a = one(i % ROAD_FRAMES), b = one((i + 1) % ROAD_FRAMES)
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
  }

  // Per tile row r: the highest (smallest y) any ground reaches at screen x = mx, over row r
  // and every row nearer the camera. Water in a row farther than r is hidden below that.
  // Made once a frame, the first time the moon road needs it.
  _occlusion(pgr, mx) {
    if (this._occ) return this._occ
    const occ = {}
    const camRow = pgr._perspCamRow(), camCol = pgr._perspCamCol()
    let best = Infinity
    for (let r = Math.ceil(camRow) - 1; r >= 0; r--) {
      const y = pgr._rowToScreenY(r)
      if (y == null) continue
      const s = pgr._scaleAtRow(r)
      const col = camCol + (mx - pgr._sw / 2) / (s || 1)
      const c0 = Math.floor(col), f = col - c0
      const h = pgr._vertexH(c0, r) * (1 - f) + pgr._vertexH(c0 + 1, r) * f
      best = Math.min(best, y - h * s)
      occ[r] = best
    }
    return (this._occ = occ)
  }

  _y(pgr, row) {
    const y = pgr._rowToScreenY(row)
    return y == null ? null : y - this.level * pgr._scaleAtRow(row)
  }
}

function smooth(t) {
  t = Math.max(0, Math.min(1, t))
  return t * t * (3 - 2 * t)
}

// A repeatable 0..1 for (a, b, salt).
function hash(a, b, salt) {
  let h = (a * 374761393 + b * 668265263 + salt * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay
  const L = vx * vx + vy * vy
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L)) : 0
  return Math.hypot(ax + vx * t - px, ay + vy * t - py)
}
