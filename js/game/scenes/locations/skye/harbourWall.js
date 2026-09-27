// harbourWall.js
// Location: js/game/scenes/locations/skye/harbourWall.js
//
// The stepped headland behind Skye's landing, dressed as old harbour
// stonework -- somewhere between a quay and a dungeon: dressed masonry
// faces, flagstone ledges with no rail and a sheer drop, weathered and
// cracked carved steps, rusty mooring rings with chains sagging between
// them, rust bleeding down the stone.
//
// A PGR structure provider (pgr.setStructures; combine with others via
// combineStructures below). Draws on the GROUND canvas, after each row's
// tiles, so nearer rows paint over it -- correct occlusion for free.
// SteepFaceRenderer must be told to skip these rows (its overlay canvas
// would otherwise cover the lot in generic stone).
//
// mapData.wall = {
//   risers:   [rows]          stone faces (camera-facing slopes)
//   ledges:   [rows]          flagstone terraces between them
//   quay:     [rows]          flagstones at the foot
//   gaps:     { row: col }    the carved stair in each riser
// }
//
// Textures are baked once as small pixel-art canvases and mapped onto
// each tile's projected quad with PGR's own affine helper.

const TEX = 32

function hash(x, y, s = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const STONE  = ['#6d6862', '#77726a', '#625e58', '#7f7a71', '#58544f']
const MORTAR = '#2b2825'
const CRACK  = '#35312d'
const MOSS   = ['#4a5930', '#56663a']
const RUST   = { dark: '#4a2614', mid: '#7a3d1c', light: '#a65a2a', stain: 'rgba(122,61,28,' }

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false
  return [c, ctx]
}

// Dressed masonry: four courses, staggered blocks, dark mortar, the odd
// crack and tuft of moss in a joint, darkening toward the wet foot.
function bakeMasonry(seed) {
  const [c, ctx] = canvas(TEX, TEX)
  ctx.fillStyle = MORTAR; ctx.fillRect(0, 0, TEX, TEX)
  const courseH = TEX / 4
  for (let r = 0; r < 4; r++) {
    let x = r % 2 ? -6 : 0
    let i = 0
    while (x < TEX) {
      const w = 9 + Math.floor(hash(r, i, seed) * 8)
      const col = STONE[Math.floor(hash(r, i, seed + 1) * STONE.length)]
      ctx.fillStyle = col
      ctx.fillRect(x + 1, r * courseH + 1, w - 1, courseH - 1)
      // worn top edge highlight
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fillRect(x + 1, r * courseH + 1, w - 1, 1)
      if (hash(r, i, seed + 2) < 0.3) {                 // crack
        ctx.fillStyle = CRACK
        let cx = x + 2 + Math.floor(hash(r, i, seed + 3) * (w - 4)), cy = r * courseH + 2
        for (let k = 0; k < courseH - 2; k++) { ctx.fillRect(cx, cy + k, 1, 1); if (hash(k, i, seed) < 0.4) cx += hash(i, k, seed) < 0.5 ? -1 : 1 }
      }
      if (hash(r, i, seed + 4) < 0.18) {                // moss in the joint
        ctx.fillStyle = MOSS[r % 2]
        ctx.fillRect(x, r * courseH + courseH - 2, 3, 2)
      }
      x += w; i++
    }
  }
  // wet, darker toward the foot of the face
  for (let y = 0; y < TEX; y++) {
    ctx.fillStyle = `rgba(10,12,16,${(y / TEX) * 0.35})`
    ctx.fillRect(0, y, TEX, 1)
  }
  return c
}

// Flagstones: a few irregular slabs, worn pale in the middle, cracked.
function bakeFlags(seed) {
  const [c, ctx] = canvas(TEX, TEX)
  ctx.fillStyle = MORTAR; ctx.fillRect(0, 0, TEX, TEX)
  const cuts = [0, 11 + Math.floor(hash(1, 1, seed) * 8), TEX]
  for (let r = 0; r < 2; r++) {
    const y0 = r ? cuts[1] : 0, y1 = r ? TEX : cuts[1]
    const split = 8 + Math.floor(hash(r, 2, seed) * 16)
    for (const [x0, x1] of [[0, split], [split, TEX]]) {
      ctx.fillStyle = STONE[Math.floor(hash(x0, y0, seed) * STONE.length)]
      ctx.fillRect(x0 + 1, y0 + 1, x1 - x0 - 1, y1 - y0 - 1)
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fillRect(x0 + 3, y0 + 3, x1 - x0 - 5, y1 - y0 - 5)
      if (hash(x0, y1, seed) < 0.45) {
        ctx.fillStyle = CRACK
        let cx = x0 + 2, cy = y0 + 2 + Math.floor(hash(x1, y0, seed) * (y1 - y0 - 4))
        for (let k = 0; k < x1 - x0 - 3; k++) { ctx.fillRect(cx + k, cy, 1, 1); if (hash(k, cy, seed) < 0.3) cy += hash(cy, k, seed) < 0.5 ? -1 : 1 }
      }
    }
  }
  return c
}

// Carved steps cut into the face: four treads, pale worn tops, dark
// risers, chipped nosings, a crack or two.
function bakeStairs(seed) {
  const [c, ctx] = canvas(TEX, TEX)
  const n = 4, h = TEX / n
  for (let i = 0; i < n; i++) {
    const y = i * h
    ctx.fillStyle = '#4f4b46'; ctx.fillRect(0, y, TEX, h)           // riser (shadowed)
    ctx.fillStyle = '#8a847a'; ctx.fillRect(1, y, TEX - 2, 3)       // tread
    ctx.fillStyle = '#9b958a'; ctx.fillRect(6, y, TEX - 12, 2)      // worn middle, paler
    for (let k = 0; k < 3; k++) {                                   // chipped nosing
      if (hash(i, k, seed) < 0.6) {
        ctx.fillStyle = '#4f4b46'
        ctx.fillRect(Math.floor(hash(k, i, seed + 1) * (TEX - 3)), y + 2, 2 + Math.floor(hash(i, k, seed + 2) * 3), 1)
      }
    }
    if (hash(i, 9, seed) < 0.5) {
      ctx.fillStyle = CRACK
      let cx = 4 + Math.floor(hash(i, 8, seed) * (TEX - 8))
      for (let k = 3; k < h; k++) { ctx.fillRect(cx, y + k, 1, 1); if (hash(k, i, seed) < 0.4) cx++ }
    }
  }
  // stone cheeks either side of the flight
  ctx.fillStyle = '#5c5852'; ctx.fillRect(0, 0, 2, TEX); ctx.fillRect(TEX - 2, 0, 2, TEX)
  return c
}

export default class HarbourWall {
  constructor(scene, wall) {
    this.scene  = scene
    this.wall   = wall || null
    this.risers = new Set(wall?.risers || [])
    this.ledges = new Set(wall?.ledges || [])
    this.quay   = new Set(wall?.quay   || [])
    this.gaps   = wall?.gaps || {}
    this.tex = {
      masonry: [bakeMasonry(1), bakeMasonry(2), bakeMasonry(3)],
      flags:   [bakeFlags(1), bakeFlags(2), bakeFlags(3)],
      stairs:  [bakeStairs(1), bakeStairs(2)],
    }
  }

  /** Rows this renderer owns -- SteepFaceRenderer should skip them. */
  ownsRow(row) { return this.risers.has(row) || this.ledges.has(row) || this.quay.has(row) }

  getEntriesForRow(row) {
    if (!this.wall || !this.ownsRow(row)) return []
    return [{ draw: (ctx, pgr) => this._drawRow(ctx, pgr, row) }]
  }

  // Projected, terrain-lifted corners of tile (col, row).
  _quad(pgr, col, row) {
    const yT = pgr._rowToScreenY(row), yB = pgr._rowToScreenY(row + 1)
    if (yT == null || yB == null) return null
    const sT = pgr._scaleAtRow(row), sB = pgr._scaleAtRow(row + 1)
    return {
      tl: { x: pgr._colToScreenX(col,     row),     y: yT - pgr._vertexH(col,     row)     * sT },
      tr: { x: pgr._colToScreenX(col + 1, row),     y: yT - pgr._vertexH(col + 1, row)     * sT },
      bl: { x: pgr._colToScreenX(col,     row + 1), y: yB - pgr._vertexH(col,     row + 1) * sB },
      br: { x: pgr._colToScreenX(col + 1, row + 1), y: yB - pgr._vertexH(col + 1, row + 1) * sB },
    }
  }

  _texQuad(ctx, pgr, img, q) {
    const W = img.width, H = img.height
    pgr._drawAffineTriangle(ctx, img, { u: 0, v: 0 }, { u: W, v: 0 }, { u: W, v: H }, q.tl, q.tr, q.br)
    pgr._drawAffineTriangle(ctx, img, { u: 0, v: 0 }, { u: W, v: H }, { u: 0, v: H }, q.tl, q.br, q.bl)
  }

  // A point on a quad by (u, v) in 0..1, bilinear.
  _at(q, u, v) {
    const top = { x: q.tl.x + (q.tr.x - q.tl.x) * u, y: q.tl.y + (q.tr.y - q.tl.y) * u }
    const bot = { x: q.bl.x + (q.br.x - q.bl.x) * u, y: q.bl.y + (q.br.y - q.bl.y) * u }
    return { x: top.x + (bot.x - top.x) * v, y: top.y + (bot.y - top.y) * v }
  }

  _drawRow(ctx, pgr, row) {
    const mapW = this.scene.mapData?.width ?? 36
    const s = pgr._scaleAtRow(row + 1)
    if (s < 2) return
    const camCol = pgr._perspCamCol()
    const half = Math.ceil((pgr._sw / 2) / s) + 2
    const c0 = Math.max(0, Math.floor(camCol - half)), c1 = Math.min(mapW - 1, Math.ceil(camCol + half))
    const isRiser = this.risers.has(row)
    const gap = this.gaps[row]
    const quads = []

    for (let col = c0; col <= c1; col++) {
      const q = this._quad(pgr, col, row)
      if (!q) continue
      quads.push([col, q])
      let img
      if (isRiser) img = col === gap ? this.tex.stairs[row % 2] : this.tex.masonry[Math.floor(hash(col, row) * 3)]
      else         img = this.tex.flags[Math.floor(hash(col, row, 5) * 3)]
      this._texQuad(ctx, pgr, img, q)
    }

    ctx.save()
    if (isRiser) {
      // worn, pale lip along the top of the face: the edge you'd go over
      ctx.strokeStyle = '#a8a196'
      ctx.lineWidth = Math.max(1, s * 0.035)
      ctx.beginPath()
      for (const [col, q] of quads) { if (col === gap) continue; ctx.moveTo(q.tl.x, q.tl.y); ctx.lineTo(q.tr.x, q.tr.y) }
      ctx.stroke()
      this._drawIronwork(ctx, pgr, row, quads, gap, s)
    } else {
      // shadow pooled at the foot of the face above (this ledge's north edge)
      if (this.risers.has(row - 1)) {
        for (const [, q] of quads) {
          const a = this._at(q, 0, 0), b = this._at(q, 1, 0), c = this._at(q, 1, 0.35), d = this._at(q, 0, 0.35)
          const g = ctx.createLinearGradient(0, a.y, 0, d.y)
          g.addColorStop(0, 'rgba(8,10,14,0.55)'); g.addColorStop(1, 'rgba(8,10,14,0)')
          ctx.fillStyle = g
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill()
        }
      }
    }
    ctx.restore()
  }

  // Mooring rings bolted into the face in pairs, a rusty chain sagging
  // between each pair, rust bled down the stone beneath every ring.
  _drawIronwork(ctx, pgr, row, quads, gap, s) {
    const byCol = new Map(quads)
    const lw = Math.max(1, s * 0.03)
    for (const [col] of quads) {
      if (hash(col, row, 11) > 0.16) continue                  // start of a pair
      const col2 = col + 2 + Math.floor(hash(col, row, 12) * 2)
      if (!byCol.has(col2)) continue
      if (gap != null && gap >= col - 1 && gap <= col2 + 1) continue   // keep the stair clear
      const q1 = byCol.get(col), q2 = byCol.get(col2)
      const p1 = this._at(q1, 0.5, 0.3), p2 = this._at(q2, 0.5, 0.3)
      const r = Math.max(2, s * 0.07)
      for (const p of [p1, p2]) this._stain(ctx, p, r, s)
      this._chain(ctx, p1, p2, s * 0.35, r * 0.55, lw)
      for (const p of [p1, p2]) this._ring(ctx, p, r, lw)
    }
  }

  _stain(ctx, p, r, s) {
    const len = s * 0.55
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + len)
    g.addColorStop(0, RUST.stain + '0.45)'); g.addColorStop(1, RUST.stain + '0)')
    ctx.fillStyle = g
    ctx.fillRect(p.x - r * 0.6, p.y, r * 1.2, len)
  }

  _ring(ctx, p, r, lw) {
    ctx.fillStyle = RUST.dark                                    // bolt plate
    ctx.fillRect(p.x - r * 0.5, p.y - r * 1.1, r, r * 0.7)
    ctx.lineWidth = lw * 1.4
    ctx.strokeStyle = RUST.dark
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.75, r, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.lineWidth = lw * 0.7
    ctx.strokeStyle = RUST.light
    ctx.beginPath(); ctx.ellipse(p.x - lw * 0.3, p.y - lw * 0.3, r * 0.75, r, 0, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke()
  }

  // Links along a quadratic sag, alternating face-on and edge-on.
  _chain(ctx, a, b, sag, linkR, lw) {
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 + sag
    const len = Math.hypot(b.x - a.x, b.y - a.y) + sag
    const n = Math.max(4, Math.floor(len / (linkR * 1.6)))
    for (let i = 1; i < n; i++) {
      const t = i / n
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * b.x
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y
      const dx = 2 * (1 - t) * (cx - a.x) + 2 * t * (b.x - cx)
      const dy = 2 * (1 - t) * (cy - a.y) + 2 * t * (b.y - cy)
      const ang = Math.atan2(dy, dx)
      ctx.lineWidth = lw
      ctx.strokeStyle = i % 2 ? RUST.mid : RUST.dark
      ctx.beginPath()
      if (i % 2) ctx.ellipse(x, y, linkR, linkR * 0.55, ang, 0, Math.PI * 2)
      else       ctx.ellipse(x, y, linkR, linkR * 0.18, ang, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

// Several structure providers as one (PGR takes a single provider).
export function combineStructures(...providers) {
  const ps = providers.filter(Boolean)
  return { getEntriesForRow: (row) => ps.flatMap(p => p.getEntriesForRow(row)) }
}
