// undergrowthRenderer.js
// Location: js/game/effects/undergrowthRenderer.js
//
// Forest floor decoration: ferns/grass/flowers as camera-facing billboards,
// small leaning/irregular rocks (deliberately NOT cube-like), and sparse
// large boulder-knoll mounds. Rocks and knolls act as anchor points for
// small flora tufts, since they're natural nodes for leafy growth that
// doesn't need its own identity/description (see forestEffects.js /
// testForest.js discussion -- anything that DOES need a description
// belongs in mapData.objects as an authored entry, not here).
//
// Draws onto ForestEffects' own canvas context -- no separate DOM layer.

export default class UndergrowthRenderer {

  // ── Flora: billboard chance per open ground cell ─────────────────────────────
  static FLORA_KINDS = {
    grass:  { chance: 0.16, minScale: 0.65, maxScale: 1.05, heightTiles: 0.35 },
    fern:   { chance: 0.07, minScale: 0.75, maxScale: 1.15, heightTiles: 0.55 },
    flower: { chance: 0.04, minScale: 0.6,  maxScale: 0.9,  heightTiles: 0.3  },
  }
  static FLORA_KIND_KEYS = Object.keys(UndergrowthRenderer.FLORA_KINDS)
  static FLORA_TOTAL_CHANCE = UndergrowthRenderer.FLORA_KIND_KEYS
    .reduce((sum, k) => sum + UndergrowthRenderer.FLORA_KINDS[k].chance, 0)

  static TEMPLATE_VARIANTS_PER_KIND = 3
  static BAKE_REF_SIZE = 64

  // ── Small rocks: slope-gated, leaning, irregular ─────────────────────────────
  static ROCK_SLOPE_THRESHOLD = 0.05
  static ROCK_CHANCE          = 0.10
  static ROCK_HEIGHT_MIN      = 0.12
  static ROCK_HEIGHT_MAX      = 0.26
  static ROCK_FOOTPRINT_MIN   = 0.3
  static ROCK_FOOTPRINT_MAX   = 0.55

  // ── Boulder knolls: rare, large, dome-like mounds ────────────────────────────
  static KNOLL_MAX_COUNT      = 3
  static KNOLL_MIN_SPACING    = 9     // tiles between knoll centres
  static KNOLL_FOOTPRINT_MIN  = 1.8
  static KNOLL_FOOTPRINT_MAX  = 2.8
  static KNOLL_HEIGHT_MIN     = 0.35
  static KNOLL_HEIGHT_MAX     = 0.55
  static KNOLL_CORNER_CUT     = 0.28  // 0=sharp quad, higher=rounder octagon silhouette
  static KNOLL_TUFT_COUNT_MIN = 4
  static KNOLL_TUFT_COUNT_MAX = 7

  constructor(scene, ctx) {
    this.scene = scene
    this._ctx  = ctx
    this._templates   = this._bakeAllTemplates()
    this._rockPattern = this._bakeRockPattern()
    this._mossPattern = this._bakeMossOverlayPattern()

    const rockResult  = this._buildRocks()
    const knollResult = this._buildKnolls()
    this._rocks  = rockResult.rocks
    this._knolls = knollResult.knolls
    this._flora  = this._buildFlora().concat(rockResult.anchoredFlora, knollResult.anchoredFlora)

    console.log('[UndergrowthRenderer] constructed --', this._flora.length, 'flora,',
      this._rocks.length, 'rocks,', this._knolls.length, 'knolls')
  }

  static _hash01(x, y, salt = 0) {
    let h = (x * 374761393 + y * 668265263 + salt * 2654435761) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h = (h ^ (h >>> 16)) >>> 0
    return h / 0xffffffff
  }

  // ── Flora template baking ────────────────────────────────────────────────────

  _bakeAllTemplates() {
    const templates = {}
    for (const key of UndergrowthRenderer.FLORA_KIND_KEYS) {
      templates[key] = []
      for (let v = 0; v < UndergrowthRenderer.TEMPLATE_VARIANTS_PER_KIND; v++) {
        let seed = key.charCodeAt(0) * 7919 + v * 104729
        const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
        if (key === 'grass')  templates[key].push(this._bakeGrassTemplate(rand))
        if (key === 'fern')   templates[key].push(this._bakeFernTemplate(rand))
        if (key === 'flower') templates[key].push(this._bakeFlowerTemplate(rand))
      }
    }
    return templates
  }

  _bakeGrassTemplate(rand) {
    const S = UndergrowthRenderer.BAKE_REF_SIZE
    const canvas = document.createElement('canvas')
    canvas.width = S; canvas.height = S
    const c = canvas.getContext('2d')
    const baseX = S / 2, baseY = S * 0.95

    const bladeCount = 6 + Math.floor(rand() * 4)
    for (let i = 0; i < bladeCount; i++) {
      const spread = (rand() - 0.5) * S * 0.55
      const height = S * (0.55 + rand() * 0.4)
      const curve  = (rand() - 0.5) * S * 0.25
      const tipX = baseX + spread + curve
      const tipY = baseY - height
      const midX = baseX + spread * 0.5 + curve * 0.4
      const midY = baseY - height * 0.5

      const shade = 0.55 + rand() * 0.4
      c.strokeStyle = `rgba(${Math.round(50*shade)}, ${Math.round(95*shade)}, ${Math.round(38*shade)}, 0.85)`
      c.lineWidth = 1.5 + rand() * 1.5
      c.beginPath()
      c.moveTo(baseX + spread * 0.2, baseY)
      c.quadraticCurveTo(midX, midY, tipX, tipY)
      c.stroke()
    }
    return canvas
  }

  _bakeFernTemplate(rand) {
    const S = UndergrowthRenderer.BAKE_REF_SIZE
    const canvas = document.createElement('canvas')
    canvas.width = S; canvas.height = S
    const c = canvas.getContext('2d')
    const baseX = S / 2, baseY = S * 0.95

    const frondCount = 4 + Math.floor(rand() * 3)
    for (let i = 0; i < frondCount; i++) {
      const ang = (i / frondCount - 0.5) * 1.6 + (rand() - 0.5) * 0.2
      const len = S * (0.6 + rand() * 0.35)
      const tipX = baseX + Math.sin(ang) * len
      const tipY = baseY - Math.cos(ang) * len
      const midX = baseX + Math.sin(ang) * len * 0.5
      const midY = baseY - Math.cos(ang) * len * 0.6

      const shade = 0.5 + rand() * 0.4
      c.strokeStyle = `rgba(${Math.round(34*shade)}, ${Math.round(70*shade)}, ${Math.round(30*shade)}, 0.9)`
      c.lineWidth = 2 + rand() * 1.5
      c.beginPath()
      c.moveTo(baseX, baseY)
      c.quadraticCurveTo(midX, midY, tipX, tipY)
      c.stroke()

      const tickCount = 4 + Math.floor(rand() * 3)
      for (let t = 1; t <= tickCount; t++) {
        const f = t / (tickCount + 1)
        const px = baseX + (tipX - baseX) * f
        const py = baseY + (tipY - baseY) * f
        const tickLen = (1 - f) * S * 0.12
        const tickAng = ang + Math.PI / 2
        c.strokeStyle = `rgba(${Math.round(40*shade)}, ${Math.round(80*shade)}, ${Math.round(34*shade)}, 0.7)`
        c.lineWidth = 1
        c.beginPath()
        c.moveTo(px, py)
        c.lineTo(px + Math.sin(tickAng) * tickLen, py - Math.cos(tickAng) * tickLen)
        c.stroke()
      }
    }
    return canvas
  }

  _bakeFlowerTemplate(rand) {
    const canvas = this._bakeGrassTemplate(rand)
    const c = canvas.getContext('2d')
    const S = UndergrowthRenderer.BAKE_REF_SIZE
    const petalColors = ['rgba(230,220,150,0.9)', 'rgba(210,140,160,0.9)', 'rgba(200,200,230,0.9)']

    const bloomCount = 2 + Math.floor(rand() * 3)
    for (let i = 0; i < bloomCount; i++) {
      const x = S * (0.3 + rand() * 0.4)
      const y = S * (0.25 + rand() * 0.3)
      const r = S * (0.04 + rand() * 0.03)
      c.fillStyle = petalColors[Math.floor(rand() * petalColors.length)]
      c.beginPath()
      c.arc(x, y, r, 0, Math.PI * 2)
      c.fill()
    }
    return canvas
  }

  _bakeRockPattern() {
    const size = 96
    const tile = document.createElement('canvas')
    tile.width = size; tile.height = size
    const c = tile.getContext('2d')
    c.fillStyle = 'rgba(96, 92, 84, 0.95)'
    c.fillRect(0, 0, size, size)

    let seed = 4242
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    for (let i = 0; i < 10; i++) {
      const cx = rand() * size, cy = rand() * size, r = 5 + rand() * 14
      c.fillStyle = rand() < 0.5 ? 'rgba(30,28,24,0.3)' : 'rgba(150,146,136,0.2)'
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill()
    }
    for (let i = 0; i < 5; i++) {
      const x = rand() * size, y = rand() * size, r = 6 + rand() * 12
      const grad = c.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, 'rgba(58,78,30,0.5)')
      grad.addColorStop(1, 'rgba(58,78,30,0)')
      c.fillStyle = grad
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill()
    }
    return this._ctx.createPattern(tile, 'repeat')
  }

  // Green blotchy OVERLAY pattern (mostly transparent) for knoll tops --
  // drawn on top of the rock pattern so moss/grass appears to be
  // reclaiming the stone rather than replacing its texture entirely.
  _bakeMossOverlayPattern() {
    const size = 96
    const tile = document.createElement('canvas')
    tile.width = size; tile.height = size
    const c = tile.getContext('2d')
    let seed = 8181
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const blotchCount = 10 + Math.floor(rand() * 6)
    for (let i = 0; i < blotchCount; i++) {
      const x = rand() * size, y = rand() * size, r = 8 + rand() * 18
      const grad = c.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0,   'rgba(60,92,34,0.85)')
      grad.addColorStop(0.6, 'rgba(50,80,28,0.55)')
      grad.addColorStop(1,   'rgba(50,80,28,0)')
      c.fillStyle = grad
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill()
    }
    return this._ctx.createPattern(tile, 'repeat')
  }

  // ── Placement: flora on open ground ──────────────────────────────────────────

  _buildFlora() {
    const mask = this.scene.mapData?.wallMask
    if (!mask) return []
    const mapH = mask.length, mapW = mask[0]?.length ?? 0
    const flora = []

    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        if (mask[ty][tx] >= 1) continue

        const roll = UndergrowthRenderer._hash01(tx, ty, 11)
        if (roll >= UndergrowthRenderer.FLORA_TOTAL_CHANCE) continue

        let acc = 0, chosenKey = null
        for (const key of UndergrowthRenderer.FLORA_KIND_KEYS) {
          acc += UndergrowthRenderer.FLORA_KINDS[key].chance
          if (roll < acc) { chosenKey = key; break }
        }
        if (!chosenKey) continue

        const variantRoll = UndergrowthRenderer._hash01(tx, ty, 23)
        const variantIdx = Math.floor(variantRoll * UndergrowthRenderer.TEMPLATE_VARIANTS_PER_KIND)
        const scaleRoll = UndergrowthRenderer._hash01(tx, ty, 37)
        const kind = UndergrowthRenderer.FLORA_KINDS[chosenKey]
        const scale = kind.minScale + scaleRoll * (kind.maxScale - kind.minScale)
        const offX = (UndergrowthRenderer._hash01(tx, ty, 41) - 0.5) * 0.7
        const offY = (UndergrowthRenderer._hash01(tx, ty, 53) - 0.5) * 0.4

        flora.push({ tx: tx + 0.5 + offX, ty: ty + 0.5 + offY, kindKey: chosenKey, kind, variantIdx, scale })
      }
    }
    return flora
  }

  // ── Placement: small rocks on sloped terrain ─────────────────────────────────

  _localSlope(tx, ty) {
    const hm = this.scene.mapData?.heightMap
    if (!hm) return 0
    const h00 = hm[ty]?.[tx] ?? 0
    const h10 = hm[ty]?.[tx + 1] ?? 0
    const h01 = hm[ty + 1]?.[tx] ?? 0
    const h11 = hm[ty + 1]?.[tx + 1] ?? 0
    return Math.max(h00, h10, h01, h11) - Math.min(h00, h10, h01, h11)
  }

  _buildRocks() {
    const mask = this.scene.mapData?.wallMask
    if (!mask) return { rocks: [], anchoredFlora: [] }
    const mapH = mask.length, mapW = mask[0]?.length ?? 0
    const rocks = []
    const anchoredFlora = []

    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        if (mask[ty][tx] >= 1) continue
        if (this._localSlope(tx, ty) < UndergrowthRenderer.ROCK_SLOPE_THRESHOLD) continue

        const roll = UndergrowthRenderer._hash01(tx, ty, 71)
        if (roll >= UndergrowthRenderer.ROCK_CHANCE) continue

        const heightTiles = UndergrowthRenderer.ROCK_HEIGHT_MIN +
          UndergrowthRenderer._hash01(tx, ty, 83) * (UndergrowthRenderer.ROCK_HEIGHT_MAX - UndergrowthRenderer.ROCK_HEIGHT_MIN)
        const footprintFrac = UndergrowthRenderer.ROCK_FOOTPRINT_MIN +
          UndergrowthRenderer._hash01(tx, ty, 97) * (UndergrowthRenderer.ROCK_FOOTPRINT_MAX - UndergrowthRenderer.ROCK_FOOTPRINT_MIN)
        const offX = (UndergrowthRenderer._hash01(tx, ty, 101) - 0.5) * (1 - footprintFrac) * 0.6
        const offY = (UndergrowthRenderer._hash01(tx, ty, 109) - 0.5) * (1 - footprintFrac) * 0.4

        // Lean: the top face is offset sideways relative to the ground
        // footprint, so the rock reads as a leaning/tilted mass rather
        // than a perfectly upright cube -- this was the single biggest
        // giveaway that made the earlier version look architectural.
        const leanAngle = UndergrowthRenderer._hash01(tx, ty, 131) * Math.PI * 2
        const leanMag   = (0.3 + UndergrowthRenderer._hash01(tx, ty, 137) * 0.5) * footprintFrac
        const leanX = Math.cos(leanAngle) * leanMag
        const leanY = Math.sin(leanAngle) * leanMag * 0.3

        // Irregular footprint: each ground corner gets its own small
        // independent jitter instead of a perfect square -- a second,
        // cheap fix for the "cube" read.
        const jit = footprintFrac * 0.22
        const cornerJitter = (salt) => (UndergrowthRenderer._hash01(tx, ty, salt) - 0.5) * jit

        rocks.push({
          tx, ty, heightTiles, footprintFrac, offX, offY, leanX, leanY,
          jTL: { x: cornerJitter(141), y: cornerJitter(142) },
          jTR: { x: cornerJitter(143), y: cornerJitter(144) },
          jBL: { x: cornerJitter(145), y: cornerJitter(146) },
          jBR: { x: cornerJitter(147), y: cornerJitter(148) },
        })

        // Anchor a small tuft of grass/fern right around this rock --
        // rocks are natural nodes for leafy growth that doesn't need its
        // own description (texture, not notable flora).
        const tuftCount = 2 + Math.floor(UndergrowthRenderer._hash01(tx, ty, 151) * 3)
        for (let i = 0; i < tuftCount; i++) {
          const kindKey = UndergrowthRenderer._hash01(tx, ty, 160 + i) < 0.6 ? 'grass' : 'fern'
          const kind = UndergrowthRenderer.FLORA_KINDS[kindKey]
          const ang = UndergrowthRenderer._hash01(tx, ty, 170 + i) * Math.PI * 2
          const rad = footprintFrac * (0.5 + UndergrowthRenderer._hash01(tx, ty, 180 + i) * 0.5)
          const fx = tx + 0.5 + Math.cos(ang) * rad
          const fy = ty + 0.5 + Math.sin(ang) * rad * 0.5
          const variantIdx = Math.floor(UndergrowthRenderer._hash01(tx, ty, 190 + i) * UndergrowthRenderer.TEMPLATE_VARIANTS_PER_KIND)
          const scale = kind.minScale + UndergrowthRenderer._hash01(tx, ty, 200 + i) * (kind.maxScale - kind.minScale)
          anchoredFlora.push({ tx: fx, ty: fy, kindKey, kind, variantIdx, scale })
        }
      }
    }
    return { rocks, anchoredFlora }
  }

  // ── Placement: sparse boulder knolls ─────────────────────────────────────────
  // No slope requirement here -- unlike small rocks, a knoll creates its
  // own relief rather than needing existing terrain variation to sit in.
  // Candidates are ranked by a deterministic hash and greedily picked
  // subject to a max count and minimum spacing, so knolls stay rare and
  // spread out rather than clustering.

  _buildKnolls() {
    const mask = this.scene.mapData?.wallMask
    if (!mask) return { knolls: [], anchoredFlora: [] }
    const mapH = mask.length, mapW = mask[0]?.length ?? 0

    const candidates = []
    for (let ty = 2; ty < mapH - 2; ty++) {
      for (let tx = 2; tx < mapW - 2; tx++) {
        if (mask[ty][tx] >= 1) continue
        candidates.push({ tx, ty, suitability: UndergrowthRenderer._hash01(tx, ty, 211) })
      }
    }
    candidates.sort((a, b) => b.suitability - a.suitability)

    const knolls = []
    for (const c of candidates) {
      if (knolls.length >= UndergrowthRenderer.KNOLL_MAX_COUNT) break
      const tooClose = knolls.some(k => Math.hypot(k.tx - c.tx, k.ty - c.ty) < UndergrowthRenderer.KNOLL_MIN_SPACING)
      if (tooClose) continue
      const footprintFrac = UndergrowthRenderer.KNOLL_FOOTPRINT_MIN +
        UndergrowthRenderer._hash01(c.tx, c.ty, 221) * (UndergrowthRenderer.KNOLL_FOOTPRINT_MAX - UndergrowthRenderer.KNOLL_FOOTPRINT_MIN)
      const heightTiles = UndergrowthRenderer.KNOLL_HEIGHT_MIN +
        UndergrowthRenderer._hash01(c.tx, c.ty, 223) * (UndergrowthRenderer.KNOLL_HEIGHT_MAX - UndergrowthRenderer.KNOLL_HEIGHT_MIN)
      knolls.push({ tx: c.tx, ty: c.ty, footprintFrac, heightTiles })
    }

    const anchoredFlora = []
    for (const k of knolls) {
      const tuftCount = UndergrowthRenderer.KNOLL_TUFT_COUNT_MIN +
        Math.floor(UndergrowthRenderer._hash01(k.tx, k.ty, 231) *
          (UndergrowthRenderer.KNOLL_TUFT_COUNT_MAX - UndergrowthRenderer.KNOLL_TUFT_COUNT_MIN + 1))
      for (let i = 0; i < tuftCount; i++) {
        const kindKey = UndergrowthRenderer._hash01(k.tx, k.ty, 240 + i) < 0.75 ? 'grass' : 'fern'
        const kind = UndergrowthRenderer.FLORA_KINDS[kindKey]
        const ang = UndergrowthRenderer._hash01(k.tx, k.ty, 250 + i) * Math.PI * 2
        const rad = (k.footprintFrac / 2) * UndergrowthRenderer._hash01(k.tx, k.ty, 260 + i)
        const fx = k.tx + 0.5 + Math.cos(ang) * rad
        const fy = k.ty + 0.5 + Math.sin(ang) * rad * 0.5
        const variantIdx = Math.floor(UndergrowthRenderer._hash01(k.tx, k.ty, 270 + i) * UndergrowthRenderer.TEMPLATE_VARIANTS_PER_KIND)
        const scale = kind.minScale + UndergrowthRenderer._hash01(k.tx, k.ty, 280 + i) * (kind.maxScale - kind.minScale)
        anchoredFlora.push({ tx: fx, ty: fy, kindKey, kind, variantIdx, scale })
      }
    }
    return { knolls, anchoredFlora }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  update(pgr, sw, sh) {
    if (!pgr) return
    this._drawKnolls(pgr, sw, sh)
    this._drawRocks(pgr, sw, sh)
    this._drawFlora(pgr, sw, sh)
  }

  _terrainHAt(pgr, px, py) {
    const x0i = Math.floor(px), y0i = Math.floor(py)
    const fx = px - x0i, fy = py - y0i
    const h00 = pgr._vertexH?.(x0i, y0i) ?? 0
    const h10 = pgr._vertexH?.(x0i + 1, y0i) ?? 0
    const h01 = pgr._vertexH?.(x0i, y0i + 1) ?? 0
    const h11 = pgr._vertexH?.(x0i + 1, y0i + 1) ?? 0
    return h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) + h01 * (1 - fx) * fy + h11 * fx * fy
  }

  _groundScreenPos(pgr, tx, ty) {
    const baseScreenY = pgr._rowToScreenY?.(ty + 0.5 + 1)
    const scale = pgr._scaleAtRow?.(ty + 0.5 + 1)
    if (baseScreenY == null || !(scale > 0)) return null
    const screenX = pgr._colToScreenX?.(tx, ty + 0.5 + 1)
    if (screenX == null) return null

    const groundRow = Math.floor(ty + 1)
    const hLeft  = pgr._vertexH?.(Math.floor(tx), groundRow) ?? 0
    const hRight = pgr._vertexH?.(Math.floor(tx) + 1, groundRow) ?? 0
    const groundHeightTiles = (hLeft + hRight) * 0.5
    const screenY = baseScreenY - groundHeightTiles * scale

    return { screenX, screenY, scale }
  }

  _drawFlora(pgr, sw, sh) {
    const ctx = this._ctx
    for (const f of this._flora) {
      const pos = this._groundScreenPos(pgr, f.tx, f.ty)
      if (!pos) continue
      const { screenX, screenY, scale } = pos
      if (screenX < -100 || screenX > sw + 100 || screenY < -100 || screenY > sh + 100) continue

      const img = this._templates[f.kindKey][f.variantIdx]
      const drawH = f.kind.heightTiles * scale * f.scale * 2
      const drawW = drawH * (img.width / img.height)

      ctx.drawImage(img, screenX - drawW / 2, screenY - drawH, drawW, drawH)
    }
  }

  _drawRocks(pgr, sw, sh) {
    const ctx = this._ctx
    for (const r of this._rocks) {
      const half = r.footprintFrac / 2
      const cx = r.tx + 0.5 + r.offX
      const cy = r.ty + 0.5 + r.offY
      const x0 = cx - half, x1 = cx + half
      const y0 = cy - half, y1 = cy + half

      const gTL = this._project(pgr, x0 + r.jTL.x, y0 + r.jTL.y)
      const gTR = this._project(pgr, x1 + r.jTR.x, y0 + r.jTR.y)
      const gBL = this._project(pgr, x0 + r.jBL.x, y1 + r.jBL.y)
      const gBR = this._project(pgr, x1 + r.jBR.x, y1 + r.jBR.y)
      if (!gTL || !gTR || !gBL || !gBR) continue

      const sTop = pgr._scaleAtRow?.(y0) ?? 0
      const sBot = pgr._scaleAtRow?.(y1) ?? 0
      gTL.y -= this._terrainHAt(pgr, x0, y0) * sTop
      gTR.y -= this._terrainHAt(pgr, x1, y0) * sTop
      gBL.y -= this._terrainHAt(pgr, x0, y1) * sBot
      gBR.y -= this._terrainHAt(pgr, x1, y1) * sBot

      const xs = [gTL.x, gTR.x, gBL.x, gBR.x], ys = [gTL.y, gTR.y, gBL.y, gBR.y]
      if (Math.max(...xs) < -100 || Math.min(...xs) > sw + 100) continue
      if (Math.max(...ys) < -100 || Math.min(...ys) > sh + 100) continue

      const hTop = r.heightTiles * sTop
      const hBot = r.heightTiles * sBot
      const leanPxX = r.leanX * sTop
      const leanPxY = r.leanY * sTop

      const topTL = { x: gTL.x + leanPxX, y: gTL.y - hTop + leanPxY }
      const topTR = { x: gTR.x + leanPxX, y: gTR.y - hTop + leanPxY }
      const topBL = { x: gBL.x + leanPxX, y: gBL.y - hBot + leanPxY }
      const topBR = { x: gBR.x + leanPxX, y: gBR.y - hBot + leanPxY }

      this._fillQuad(ctx, topTL, topBL, gBL, gTL, this._rockPattern, 0.55)
      this._fillQuad(ctx, topTR, topBR, gBR, gTR, this._rockPattern, 0.55)
      this._fillQuad(ctx, topBL, topBR, gBR, gBL, this._rockPattern, 0.72)
      this._fillQuad(ctx, topTL, topTR, topBR, topBL, this._rockPattern, 1.0)
    }
  }

  _drawKnolls(pgr, sw, sh) {
    const ctx = this._ctx
    for (const k of this._knolls) {
      const half = k.footprintFrac / 2
      const cx = k.tx + 0.5, cy = k.ty + 0.5
      const x0 = cx - half, x1 = cx + half
      const y0 = cy - half, y1 = cy + half

      const gTL = this._project(pgr, x0, y0)
      const gTR = this._project(pgr, x1, y0)
      const gBL = this._project(pgr, x0, y1)
      const gBR = this._project(pgr, x1, y1)
      if (!gTL || !gTR || !gBL || !gBR) continue

      const sTop = pgr._scaleAtRow?.(y0) ?? 0
      const sBot = pgr._scaleAtRow?.(y1) ?? 0
      gTL.y -= this._terrainHAt(pgr, x0, y0) * sTop
      gTR.y -= this._terrainHAt(pgr, x1, y0) * sTop
      gBL.y -= this._terrainHAt(pgr, x0, y1) * sBot
      gBR.y -= this._terrainHAt(pgr, x1, y1) * sBot

      const xs = [gTL.x, gTR.x, gBL.x, gBR.x], ys = [gTL.y, gTR.y, gBL.y, gBR.y]
      if (Math.max(...xs) < -150 || Math.min(...xs) > sw + 150) continue
      if (Math.max(...ys) < -150 || Math.min(...ys) > sh + 150) continue

      const hTop = k.heightTiles * sTop
      const hBot = k.heightTiles * sBot
      const topTL = { x: gTL.x, y: gTL.y - hTop }
      const topTR = { x: gTR.x, y: gTR.y - hTop }
      const topBL = { x: gBL.x, y: gBL.y - hBot }
      const topBR = { x: gBR.x, y: gBR.y - hBot }

      // Sides + front: same trapezoid approach as rocks -- at this low a
      // height-to-footprint ratio these read as a gentle bank, not a wall.
      this._fillQuad(ctx, topTL, topBL, gBL, gTL, this._rockPattern, 0.5)
      this._fillQuad(ctx, topTR, topBR, gBR, gTR, this._rockPattern, 0.5)
      this._fillQuad(ctx, topBL, topBR, gBR, gBL, this._rockPattern, 0.68)

      // Top face: octagon-cut (not a plain quad) so the mound's silhouette
      // reads as rounded rather than boxy, then a moss overlay on top of
      // the rock texture -- "boulder heaved up as a grassy knoll."
      const octagon = this._octagonFromQuad(topTL, topTR, topBR, topBL, UndergrowthRenderer.KNOLL_CORNER_CUT)
      this._fillPolygon(ctx, octagon, this._rockPattern, 0)
      this._fillPolygon(ctx, octagon, this._mossPattern, 0)
    }
  }

  _octagonFromQuad(tl, tr, br, bl, cutFrac) {
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    return [
      lerp(tl, tr, cutFrac), lerp(tr, tl, cutFrac),
      lerp(tr, br, cutFrac), lerp(br, tr, cutFrac),
      lerp(br, bl, cutFrac), lerp(bl, br, cutFrac),
      lerp(bl, tl, cutFrac), lerp(tl, bl, cutFrac),
    ]
  }

  _fillQuad(ctx, p1, p2, p3, p4, pattern, brightnessFrac) {
    this._fillPolygon(ctx, [p1, p2, p3, p4], pattern, brightnessFrac < 1 ? (1 - brightnessFrac) : 0)
  }

  _fillPolygon(ctx, points, fillStyle, darkenAlpha) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    ctx.closePath()
    ctx.clip()
    const xs = points.map(p => p.x), ys = points.map(p => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    ctx.fillStyle = fillStyle
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY)
    if (darkenAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${darkenAlpha.toFixed(3)})`
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY)
    }
    ctx.restore()
  }

  _project(pgr, tileX, tileY) {
    const y = pgr._rowToScreenY?.(tileY)
    if (y == null) return null
    const x = pgr._colToScreenX?.(tileX, tileY)
    if (x == null) return null
    return { x, y }
  }

  destroy() {
    this._flora = []
    this._rocks = []
    this._knolls = []
    this._ctx = null
  }
}
