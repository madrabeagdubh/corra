// vegetation.js  (first draft)
// Location: js/game/effects/vegetation.js
//
// Wind-swayed ground flora for open maps. Forest interiors already have
// UndergrowthRenderer; this is its counterpart for bog, ráth and riverbank.
//
// ── Species ──────────────────────────────────────────────────────────────────
// All native. Fuchsia and montbretia were on the original list and are utterly
// characteristic of West Cork *now*, but both are 19th-century garden escapees
// (Chile and South Africa respectively) and would be anachronisms here. The
// natives below carry the same visual punch and, unlike the incomers, each has
// an Irish name worth teaching — so the layer can feed the vocabulary system
// later rather than being purely decorative.
//
// ── How the sway works ───────────────────────────────────────────────────────
// Sway is NOT computed per pixel per frame. Each species is baked at load into
// PHASES complete sprites, one per point in the sway cycle. At draw time a
// plant picks a phase index and blits once — O(1) per plant, one drawImage,
// no trig in the frame loop.
//
// The phase index comes from wind.phaseAt(worldX), not from a global clock, so
// a gust ARRIVES at the left of a field before the right. That travelling
// front is what makes it read as weather rather than as N independent wigglers.
//
// ── Placement ────────────────────────────────────────────────────────────────
// Deterministic hash per tile, so nothing is stored and the same tile always
// grows the same thing. Density is modulated by a coarse clump hash, and each
// species is gated on habitat (wet ground, dry exposed ground, slope), so the
// vegetation encodes the terrain and the ground reads as a place.
//
// ── Draw order ───────────────────────────────────────────────────────────────
// Drawn from the PGR's per-row loop, onto the objects canvas, so plants
// interleave correctly with trees, buildings and NPCs by row.
//
// ── Known gaps in this draft ─────────────────────────────────────────────────
//   * No clumping around trees yet — that needs the map's object list. The
//     coarse clump hash gives grouping, but not "gathered at the foot of that
//     ash tree" specifically.
//   * No water test, so this defaults OFF and is enabled per map. Turning it on
//     for a map with open water needs an isWater() callback first, or plants
//     will grow on the sea.
//
// Usage: wired by PerspectiveScene; the PGR calls renderRow per row.

import { wind } from './wind.js'

const REF_H = 28          // bake height in px; plants are scaled from this
const PHASES = 12         // sway cycle steps baked per species
const VARIANTS = 3        // silhouette variants per species

/* ── species ──────────────────────────────────────────────────────────────
   stiffness : sway frequency        amplitude : sway arc in ref px
   lag       : how much the head trails the stem
   wet       : preferred ground wetness, 0 dry .. 1 waterlogged
   tol       : how far from `wet` it will still grow
   stem      : optional, default 1. Multiplies the stalk's length only; the head keeps
               its size. <1 = a lower plant with the same bloom.  [flowerStems]  */

export const SPECIES = {
  aiteann: {            // gorse — dry, exposed, spiny, barely moves
    name: 'Gorse', irish: 'Aiteann',
    form: 'bush', h: 0.62, stiffness: 1.6, amplitude: 0.7, lag: 0.0,
    wet: 0.12, tol: 0.30, weight: 1.0,
    palette: ['#F5C21B', '#E0A800', '#2F4A2A', '#1E3320'],
  },
  ceannbhan: {          // bog cotton — waterlogged only, whips about
    name: 'Bog cotton', irish: 'Ceannbhán',
    form: 'tuft', h: 0.34, stem: 0.25, stiffness: 1.2, amplitude: 2.4, lag: 0.22,
    wet: 0.92, tol: 0.22, weight: 1.1,
    palette: ['#FBFBF4', '#E4E4D2', '#7E8B4E', '#5F6B39'],
  },
  feileastram: {        // yellow flag iris — wet margins, stiff blades
    name: 'Yellow flag', irish: 'Feileastram',
    form: 'blade', h: 0.70, stem: 0.25, stiffness: 0.9, amplitude: 1.6, lag: 0.08,
    wet: 0.80, tol: 0.20, weight: 0.7,
    palette: ['#F2C21A', '#D19A00', '#2C5D2E', '#1D4220'],
  },
  creachtach: {         // purple loosestrife — wet margins, tall spike
    name: 'Purple loosestrife', irish: 'Créachtach',
    form: 'spike', h: 0.78, stem: 0.25, stiffness: 0.8, amplitude: 2.1, lag: 0.12,
    wet: 0.74, tol: 0.24, weight: 0.8,
    palette: ['#C1548A', '#8E2F62', '#2E5340', '#1B3A2A'],
  },
  airgead: {            // meadowsweet — damp meadow, frothy head
    name: 'Meadowsweet', irish: 'Airgead luachra',
    form: 'umbel', h: 0.60, stem: 0.25, stiffness: 1.0, amplitude: 1.7, lag: 0.16,
    wet: 0.62, tol: 0.26, weight: 0.9,
    palette: ['#F6F3E0', '#DCD6B4', '#3A5433', '#243B22'],
  },
  buachalan: {          // ragwort — rough dry pasture, stiff gold head
    name: 'Ragwort', irish: 'Buachalán buí',
    form: 'umbel', h: 0.48, stiffness: 1.1, amplitude: 1.3, lag: 0.05,
    wet: 0.32, tol: 0.28, weight: 0.9,
    palette: ['#F0CE26', '#CBA614', '#3E5A32', '#26401F'],
  },
  lusmor: {             // foxglove — banks and clearings, drooping bells
    name: 'Foxglove', irish: 'Lus mór',
    form: 'bells', h: 0.85, stiffness: 0.7, amplitude: 1.5, lag: 0.34,
    wet: 0.44, tol: 0.24, weight: 0.55,
    palette: ['#C86BB0', '#8E3E7C', '#33512F', '#20361F'],
  },
}

const SPECIES_KEYS = Object.keys(SPECIES)

/* MEADOW_SPECIES -- dry-to-damp upland grassland flowers, for a hilltop rather than a bog.
   Deliberately NOT part of SPECIES: species are picked by cumulative weight, so adding to
   that object would re-roll the mix on every map in the game. These are opt-in, by passing
   `species: [...]` to Vegetation (see introLevel.js). Same fields as SPECIES above. */
export const MEADOW_SPECIES = {
  mearacan: {           // harebell -- dry hilltops, thin nodding blue bells
    name: 'Harebell', irish: 'Méaracán gorm',
    form: 'bells', h: 0.40, stem: 0.25, stiffness: 0.5, amplitude: 2.2, lag: 0.30,
    wet: 0.40, tol: 0.26, weight: 1.0,
    palette: ['#8FB6E8', '#5B82C4', '#3B5A34', '#243B22'],
  },
  noinin: {             // ox-eye daisy -- meadow, white ray florets round a gold disc
    name: 'Ox-eye daisy', irish: 'Nóinín mór',
    form: 'umbel', h: 0.52, stem: 0.25, stiffness: 1.0, amplitude: 1.4, lag: 0.10,
    wet: 0.50, tol: 0.28, weight: 1.1,
    palette: ['#FAFAF0', '#E8D98A', '#3A5433', '#243B22'],
  },
  minscoth: {           // common knapweed -- rough grassland, hard purple head
    name: 'Knapweed', irish: 'Mínscoth',
    form: 'spike', h: 0.56, stem: 0.25, stiffness: 1.2, amplitude: 1.2, lag: 0.08,
    wet: 0.46, tol: 0.26, weight: 0.85,
    palette: ['#B0569E', '#7C3670', '#41573A', '#27381F'],
  },
  crobhein: {           // bird's-foot trefoil -- low, spreading, egg-and-bacon yellow
    name: "Bird's-foot trefoil", irish: 'Crobh éin',
    form: 'tuft', h: 0.26, stiffness: 1.4, amplitude: 0.9, lag: 0.04,
    wet: 0.42, tol: 0.30, weight: 1.0,
    palette: ['#F3C84D', '#E08A2A', '#3E5A32', '#26401F'],
  },
  odhrach: {            // devil's-bit scabious -- damp upland, violet pincushion
    name: "Devil's-bit scabious", irish: 'Odhrach bhallach',
    form: 'umbel', h: 0.58, stem: 0.25, stiffness: 0.9, amplitude: 1.6, lag: 0.14,
    wet: 0.58, tol: 0.26, weight: 0.9,
    palette: ['#9A8AD8', '#6A5AAE', '#3A5433', '#243B22'],
  },
}

// Every species this module can draw. The DEFAULT key list stays SPECIES only.
const ALL_SPECIES = { ...SPECIES, ...MEADOW_SPECIES }

/* ── deterministic hashing ─────────────────────────────────────────────── */

function hash2(x, y, salt = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (salt | 0) * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Ribo's sway curve, with the phase made to TRAVEL rather than each plant
 * running its own clock. Quadratic falloff toward the root keeps the base
 * planted; the result is rounded so pixel columns stay aligned.
 */
function swayOffset(phaseT, rowY, height, sp, swayScale = 1) {
  if (rowY <= 0) return 0
  const nh = rowY / height
  const t = phaseT - sp.lag * nh
  const primary = Math.sin(t * sp.stiffness * 3.0)
  const gust = Math.sin(t * sp.stiffness * 7.1) * 0.25
  return Math.round((primary + gust) * sp.amplitude * swayScale * nh * nh)
}

/* ── silhouettes ──────────────────────────────────────────────────────────
   Each returns, for a plant of height H in ref px, an array of rows from the
   root up: { w, colour } — the width and colour of that pixel row.          */

// Fraction of a plant's height that is stem, by form.
function stemFrac(form) {
  return form === 'bush' ? 0.15
    : form === 'tuft' ? 0.72
    : form === 'blade' ? 0.30
    : form === 'bells' ? 0.42
    : form === 'spike' ? 0.62
    : 0.78
}

function silhouette(sp, H, variant, headStart) {
  const rows = []
  const [c0, c1, stem, stemDark] = sp.palette
  const r = (i, s = 0) => hash2(variant, i, s)

  for (let i = 0; i < H; i++) {
    if (i < headStart) {
      // stem / foliage
      let w = 1
      if (sp.form === 'bush') w = Math.max(2, Math.round(H * 0.5 * (1 - i / H) + r(i) * 2))
      else if (sp.form === 'blade') w = i < H * 0.1 ? 3 : 2
      rows.push({ w, colour: (i % 3 === 0) ? stemDark : stem })
      continue
    }

    const f = (i - headStart) / Math.max(1, H - headStart)   // 0 base .. 1 tip
    let w, colour

    switch (sp.form) {
      case 'bush':                                   // gorse: dense, spiny
        w = Math.max(1, Math.round(H * 0.5 * (1 - f * 0.8) + r(i, 1) * 2))
        colour = r(i, 2) < 0.35 ? c0 : (r(i, 3) < 0.5 ? c1 : stem)
        break
      case 'tuft':                                   // bog cotton: white head
        w = Math.max(1, Math.round(3 * Math.sin(f * Math.PI) + 1 + r(i, 1) * 2))
        colour = r(i, 2) < 0.7 ? c0 : c1
        break
      case 'blade':                                  // iris: blades + flower
        w = f > 0.75 ? 3 : 2
        colour = f > 0.75 ? (r(i, 1) < 0.6 ? c0 : c1) : stem
        break
      case 'spike':                                  // loosestrife: tapering
        w = Math.max(1, Math.round(3 * (1 - f) + 1))
        colour = r(i, 1) < 0.65 ? c0 : c1
        break
      case 'bells':                                  // foxglove: one-sided
        w = Math.max(1, Math.round(3 * (1 - f * 0.6)))
        colour = r(i, 1) < 0.6 ? c0 : c1
        break
      default:                                       // umbel: flat-topped
        w = Math.max(1, Math.round(5 * Math.sin(Math.min(1, f * 1.3) * Math.PI) + 1))
        colour = r(i, 1) < 0.6 ? c0 : c1
    }
    rows.push({ w, colour, bells: sp.form === 'bells' })
  }
  return rows
}

/** Bake one species/variant/phase into a small canvas. */
function bakeSprite(sp, variant, phase, swayScale = 1) {
  // [flowerStems] Head rows as for the full plant; stem rows scaled by sp.stem.
  // Drawn scale is per ref px (not per sprite height), so fewer rows = a lower plant
  // with the head unchanged on screen.
  const H0 = Math.max(6, Math.round(REF_H * sp.h))
  const stem0 = Math.floor(H0 * stemFrac(sp.form))
  const stemRows = Math.max(1, Math.round(stem0 * (sp.stem ?? 1)))
  const H = stemRows + (H0 - stem0)
  const rows = silhouette(sp, H, variant, stemRows)
  const pad = Math.ceil(sp.amplitude * swayScale) + 4
  const W = pad * 2 + 8

  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H + 1
  const ctx = cv.getContext('2d')

  const phaseT = (phase / PHASES) * Math.PI * 2

  for (let i = 0; i < rows.length; i++) {
    const { w, colour, bells } = rows[i]
    const dx = swayOffset(phaseT, i, H, sp, swayScale)
    const y = H - 1 - i
    // Foxglove bells hang to one side of the stem.
    const cx = W / 2 + dx + (bells ? 1 : 0)
    ctx.fillStyle = colour
    ctx.fillRect(Math.round(cx - w / 2), y, w, 1)
  }
  return cv
}

/* ── the layer ────────────────────────────────────────────────────────── */

export const VEGETATION_DEFAULTS = {
  enabled: true,

  // Chance a suitable tile grows anything, before clumping.
  density: 0.34,
  // Coarse clumping: fraction of 3x3 blocks that are rich vs sparse.
  clumpScale: 3,
  clumpBias: 0.55,

  // Do not draw when a tile is narrower than this many px — plants become
  // sub-pixel noise and cost fills for nothing.
  minScale: 22,
  // Fade in over minScale..fadeScale so they do not pop into existence.
  fadeScale: 46,

  // Plant height as a fraction of a tile, before per-species h.
  heightTiles: 0.9,

  // How many INDEPENDENT chances a tile gets to grow something. The roll below
  // is per-tile, so 1 (the default, and every map built before this existed)
  // means a tile holds at most one plant however high `density` goes -- that
  // ceiling, not density, is what stops a meadow reading as full. Each extra
  // pass re-rolls position, species and variant from its own seed offset, and
  // pass 0 is bit-for-bit what a perTile:1 map already drew, so raising this
  // only ever ADDS plants to a map that asks for it.
  perTile: 1,

  // Which species may grow here, as keys. Defaults to the original SPECIES set, so a map
  // that says nothing gets exactly what it always got. Pass a list (keys from SPECIES and/or
  // MEADOW_SPECIES) to choose a different flora for one map.
  species: null,

  // false bakes ONE sway phase instead of PHASES and skips the wind lookup entirely: a still
  // night. Costs a twelfth of the sprite memory, which buys variants and extra species back.
  wind: true,

  // Silhouette variants baked per species. More = less obvious repetition, at bake cost.
  variants: VARIANTS,

  // Per-plant size scatter, +/- this fraction. Real meadows are not one size; without it a
  // dense field reads as wallpaper however many species are in it.
  scaleJitter: 0,

  // Optional fadeAt(x, top, bottom, halfWidth) -> 0..1, in screen px: an alpha multiplier for a
  // plant about to be drawn with that footprint. 0 skips it outright. Lets a scene keep plants
  // out of part of the screen -- the intro clears them from behind the moon -- without the
  // module knowing anything about why. null (the default) costs nothing.
  fadeAt: null,

  // Optional: a height (tiles) by which plants have thinned out and shrunk away. On a map with
  // real hills, flowers climbing the slopes at full size and density read wrong -- the meadow
  // belongs to the low ground. Below it, density and size ease down with height; at it, none.
  // null (the default) leaves every other map as it is.
  heightFade: null,

  // Sway. swayScale multiplies every species amplitude at BAKE time, so
  // changing it rebuilds the sprites. swayRate is how fast the cycle
  // advances. Both default low -- a field of plants all moving reads as
  // dancing long before any single plant looks wrong.
  swayScale: 0.5,
  swayRate: 0.7,

  // Optional: (col,row) => bool. Without it, nothing stops plants growing on
  // open water, which is why this layer defaults off per map.
  isWater: null,

  // Optional: (col,row) => 0..1 wetness. Defaults to a terrain-height proxy.
  wetnessAt: null,

  // Optional: (speciesKey, col, row) => bool. Asked for every plant once its species is
  // chosen; false and it is not drawn. For a scene's own rules -- e.g. only low flowers
  // close to the camera.  [allowAt]
  allowAt: null,

  seed: 7,
}

export class Vegetation {
  constructor(scene, opts = {}) {
    this.scene = scene
    this.pgr = opts.pgr || scene.perspectiveGround || scene.pgr || null
    this.cfg = { ...VEGETATION_DEFAULTS, ...opts }

    // Resolved once: which species, how many variants, how many sway phases.
    this._keys = this.cfg.species ?? SPECIES_KEYS
    const missing = this._keys.filter(k => !ALL_SPECIES[k])
    if (missing.length) console.warn('[Vegetation] unknown species ignored:', missing)
    this._keys = this._keys.filter(k => ALL_SPECIES[k])
    this._phases = this.cfg.wind === false ? 1 : PHASES
    this._variants = Math.max(1, this.cfg.variants | 0)

    // sprites[speciesIndex][variant][phase]
    this.sprites = this._keys.map(k =>
      Array.from({ length: this._variants }, (_, v) =>
        Array.from({ length: this._phases }, (_, p) =>
          bakeSprite(ALL_SPECIES[k], v, p, this.cfg.wind === false ? 0 : this.cfg.swayScale))))

    // Cumulative weights for species selection.
    this._cum = []
    let acc = 0
    for (const k of this._keys) { acc += ALL_SPECIES[k].weight; this._cum.push(acc) }
    this._total = acc
  }

  /** Terrain-height proxy for wetness: low ground relative to its neighbours. */
  _wetness(pgr, col, row) {
    if (this.cfg.wetnessAt) return this.cfg.wetnessAt(col, row)
    const h = pgr._vertexH?.(col, row) ?? 0
    let sum = 0, n = 0
    for (let dx = -2; dx <= 2; dx += 2) {
      for (let dy = -2; dy <= 2; dy += 2) {
        sum += pgr._vertexH?.(col + dx, row + dy) ?? 0
        n++
      }
    }
    const avg = n ? sum / n : h
    // Below local average = wetter. Scaled to roughly 0..1.
    return Math.max(0, Math.min(1, 0.5 + (avg - h) * 0.06))
  }

  /**
   * Called by the PGR once per visible row, from inside its row loop, so
   * plants interleave with trees and NPCs by depth.
   */
  renderRow(pgr, ctx, tileRow) {
    const c = this.cfg
    if (!c.enabled || !ctx || tileRow < 0) return

    const s = pgr._scaleAtRow(tileRow + 1)
    if (!s || s < c.minScale) return

    const fadeRaw = Math.min(1, (s - c.minScale) / Math.max(1, c.fadeScale - c.minScale))
    const fade = fadeRaw * fadeRaw * (3 - 2 * fadeRaw)

    const sw = pgr._sw
    const camCol = pgr._perspCamCol()
    const halfCols = Math.ceil((sw / 2) / s) + 2
    const yBase = pgr._rowToScreenY(tileRow + 1)
    if (yBase == null) return

    const c0 = Math.floor(camCol - halfCols)
    const c1 = Math.ceil(camCol + halfCols)

    const prevAlpha = ctx.globalAlpha

    for (let col = c0; col <= c1; col++) {
     // Each pass is an independent chance for this tile. Pass 0 uses the seed offsets
     // exactly as they were before perTile existed, so a perTile:1 map is unchanged.
     for (let k = 0; k < c.perTile; k++) {
      const ks = k * 977          // 0 for the first pass: the original stream, untouched
      // Coarse clump, then per-tile roll.
      const clump = hash2(Math.floor(col / c.clumpScale), Math.floor(tileRow / c.clumpScale), c.seed + ks)
      const localDensity = c.density * (clump < c.clumpBias ? 0.25 : 1.6)
      const roll = hash2(col, tileRow, c.seed + 1 + ks)
      if (roll > localDensity) continue

      if (c.isWater && c.isWater(col, tileRow)) continue

      const wet = this._wetness(pgr, col, tileRow)

      // Pick a species whose habitat matches this ground.
      const pick = hash2(col, tileRow, c.seed + 2 + ks) * this._total
      let si = 0
      while (si < this._cum.length - 1 && pick > this._cum[si]) si++
      const key = this._keys[si]
      const sp = ALL_SPECIES[key]
      if (Math.abs(wet - sp.wet) > sp.tol) continue
      if (c.allowAt && !c.allowAt(key, col, tileRow)) continue   // [allowAt]

      // Lowland bias: fewer plants the higher the ground, and smaller (see heightFade).
      let lowland = 1
      if (c.heightFade) {
        const gh = pgr._vertexH?.(col, tileRow) ?? 0
        lowland = Math.max(0, Math.min(1, 1 - gh / c.heightFade))
        if (hash2(col, tileRow, c.seed + 8 + ks) > lowland) continue
      }

      const variant = Math.floor(hash2(col, tileRow, c.seed + 3 + ks) * this._variants)

      // Sub-tile jitter so plants do not sit on a lattice.
      const jx = hash2(col, tileRow, c.seed + 4 + ks) - 0.5
      const jy = hash2(col, tileRow, c.seed + 5 + ks) * 0.8 + 0.1

      const worldCol = col + 0.5 + jx * 0.7
      const screenX = pgr._colToScreenX(worldCol, tileRow + jy)
      const rowY = pgr._rowToScreenY(tileRow + jy)
      if (rowY == null) continue

      const terrainH = pgr._vertexH?.(col, tileRow) ?? 0
      const footY = rowY - terrainH * s

      // Travelling gust: phase depends on WORLD X, so the wave sweeps. A still night has one
      // baked phase, so there is nothing to look up.
      let pi = 0
      if (this._phases > 1) {
        const ph = wind.phaseAt(worldCol * 64) * c.swayRate + hash2(col, tileRow, c.seed + 6 + ks) * 6.283
        pi = Math.floor((ph / (Math.PI * 2)) * this._phases) % this._phases
        if (pi < 0) pi += this._phases
      }

      const spr = this.sprites[si][variant][pi]
      // Size scatter, so a full field does not read as one plant stamped over and over.
      const jitter = c.scaleJitter
        ? 1 + (hash2(col, tileRow, c.seed + 7 + ks) * 2 - 1) * c.scaleJitter
        : 1
      const scale = (s * c.heightTiles * jitter * (c.heightFade ? 0.45 + 0.55 * lowland : 1)) / REF_H
      const w = spr.width * scale
      const h = spr.height * scale

      const keep = c.fadeAt ? c.fadeAt(screenX, footY - h, footY, w / 2) : 1
      if (keep <= 0) continue
      ctx.globalAlpha = prevAlpha * fade * keep
      ctx.drawImage(spr, screenX - w / 2, footY - h, w, h)
     }
    }

    ctx.globalAlpha = prevAlpha
  }

  configure(opts = {}) { Object.assign(this.cfg, opts); return this }
  setEnabled(on) { this.cfg.enabled = !!on; return this }
  destroy() { this.sprites = null }
}

export default Vegetation
