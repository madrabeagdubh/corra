// roundhouseRenderer.js
// Location: js/game/effects/roundhouseRenderer.js
//
// ── Canvas + occlusion fix ───────────────────────────────────────────────────
// Previously drew onto forestEffects.ctx -- which turned out to be
// ForestEffects' OWN leftover always-on-top canvas (haze/exit-markers,
// z-index above even the player's _oCtx), not the shared ground canvas
// trunks/terrain actually use. That made buildings render over the player
// unconditionally (wrong side of the _oCtx/_gCtx split -- see
// forestEffects.js's own v7 header, which fixed this exact bug for trunks)
// AND over any palisade post that should have been in front of a wall
// (buildings were one big painter's-order-blind pass drawn after the
// entire per-row terrain+trunk loop, regardless of true row order).
//
// Fixed the same way trunks were fixed: walls now register with PGR via
// setStructures() and draw INSIDE its per-row loop (see getEntriesForRow/
// the draw closures below), on _gCtx, interleaved row-by-row with terrain
// and trunks -- so a post at a nearer row genuinely paints over a wall
// from a farther row, and the player (always on the separate, higher
// _oCtx) always correctly draws over any wall regardless of row.
//
// Roofs/portico/ornament/ground-shadow stay a separate final pass
// (drawOverlay(), called after the whole per-row loop + forestEffects.
// update() complete) since they sit above wall-top height, where a
// ground-level post is very unlikely to need to occlude them -- row-
// bucketing those too would add real complexity for a case that doesn't
// currently show the bug.
//
// ── Shape families ───────────────────────────────────────────────────────────
// Round huts (roundhouse/dwelling): N-gon wall + N-gon cone roof. Camera
// faces north, so wall segments facing north (away) are skipped -- same
// simplification DolmenRenderer uses for its stones' hidden back face.
// Longhall: rectangular, gabled, shown LENGTHWISE (long axis east-west,
// broadside to the approach) -- both gable ends in shot, each with a
// timber-infill triangle and a crossed roof-beam ornament; long south
// wall is the dominant face, with a small entrance portico on it.
//
// ── Thatch tiling ─────────────────────────────────────────────────────────────
// Swatches come from thatchTexture.js, generated seamless at
// construction. They REPLACED thatch1/2.png, which were roof stamps
// with baked-in outlines, not tileable swatches. _drawTiledQuad
// subdivides a projected quad into a grid sized from its real tile-space
// extent and draws the full swatch into each cell via PGR's own
// _drawAffineTriangle (same primitive SteepFaceRenderer uses for stone).
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//   import RoundhouseRenderer from '../../effects/roundhouseRenderer.js'
//   this.roundhouses = new RoundhouseRenderer(mapData.houses || [])
//   this.perspectiveGround.setStructures(this.roundhouses)   // walls: per-row, in PGR's own loop
//   // each frame, AFTER forestEffects.update():
//   this.roundhouses.drawOverlay(this.perspectiveGround, sw, sh)   // roofs/portico/shadow
//   // in shutdown(): this.perspectiveGround.setStructures(null)

import { makeThatchCanvas, THATCH_VARIANTS } from './thatchTexture.js'

const TILE_TARGET = 1.3   // roughly how many tile-lengths one texture repeat should span

export const KIND_STYLE = {
  longhall: {
    wallH: 2.9, roofH: 2.3,
    // How far the thatch projects past the wall on every side. It
    // continues down the ridge->eave slope, so the wall top still
    // sits exactly on the roof plane. 0 restores the old flush eave.
    eaveOverhang: 0.45,
    wallLight: 'rgba(188,168,132,1)', wallDark: 'rgba(118,102,74,1)',
    trim: 'rgba(54,40,26,0.95)',
    // Overrides the Math.min(1.3, wallH * 0.7) default below: the
    // hall's door should read as grander than a dwelling's, and the
    // 1.3 cap otherwise made every door in the village the same
    // height regardless of the wall it sits in.
    doorH: 1.7,
    postW: 0.17,
  },
  roundhouse: { wallH: 2.1, roofH: 2.0, wallLight: 'rgba(192,174,138,1)', wallDark: 'rgba(126,110,80,1)' },
  dwelling: { wallH: 1.8, roofH: 1.7, wallLight: 'rgba(188,170,134,1)', wallDark: 'rgba(120,104,76,1)' },
}
const DOOR_COLOR      = 'rgba(24,20,16,0.9)'
const SHADOW_COLOR    = 'rgba(18,16,12,0.30)'
const ROOF_SHADE_DARK = 'rgba(8,6,4,0.30)'
const ROOF_SHADE_MID  = 'rgba(8,6,4,0.12)'

export default class RoundhouseRenderer {

  // houses: mapData.houses entries -- round huts are { id, kind, x, y, r };
  // the longhall is { id, kind:'longhall', x, y, w, d, r }.
  constructor(houses) {
    // Same { canvas } entry shape _loadTexture returned, so every
    // `if (thatch.canvas)` call site below is untouched -- but built
    // synchronously, so there is no null-canvas window on frame one.
    this._thatch = THATCH_VARIANTS.map(v => ({ canvas: makeThatchCanvas(v) }))
    this._houses = (houses || []).map(h => ({
      ...h,
      style: KIND_STYLE[h.kind] || KIND_STYLE.dwelling,
      segments: Math.max(8, Math.min(16, Math.round((h.r || 2) * 3))),
      thatch: this._thatch[this._hashStr(h.id) % this._thatch.length],
      frontOffset: h.kind === 'longhall' ? (h.d || 3) / 2 + 1.2 : (h.r || 2),
    }))
    console.log('[RoundhouseRenderer] constructed --', this._houses.length, 'buildings')
  }

  _hashStr(s) {
    let h = 0
    for (let i = 0; i < String(s).length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
    return Math.abs(h)
  }

  // ── PGR per-row hook (walls) ─────────────────────────────────────────────────

  // Called by PGR from inside its own per-row loop. Cheap bounding check
  // per house first (most houses don't overlap most rows), then delegate
  // to the shape-specific collector. Returns { draw(ctx, pgr) } entries;
  // geometry itself is computed lazily inside draw(), using the pgr
  // passed at that point (not cached here).
  getEntriesForRow(tileRow) {
    const entries = []
    for (const house of this._houses) {
      const span = house.kind === 'longhall' ? (house.d / 2 + 1) : (house.r + 1)
      if (Math.abs(tileRow - house.y) > span) continue
      if (house.kind === 'longhall') this._collectLongHallRow(house, tileRow, entries)
      else                            this._collectHutRow(house, tileRow, entries)
    }
    return entries
  }

  // ── Round hut wall segments (one row bucket per segment) ────────────────────

  _collectHutRow(house, tileRow, entries) {
    const { x: cx, y: cy, r, segments, style } = house
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2, a1 = ((i + 1) / segments) * Math.PI * 2
      const vy0 = cy + Math.sin(a0) * r, vy1 = cy + Math.sin(a1) * r
      if (Math.round((vy0 + vy1) / 2) !== tileRow) continue
      const midSin = Math.sin((a0 + a1) / 2)
      if (midSin < -0.15) continue   // north-facing, never seen -- same rule as before

      const vx0 = cx + Math.cos(a0) * r, vx1 = cx + Math.cos(a1) * r
      const lightness = Math.max(0, Math.min(1, 0.5 + 0.5 * midSin))
      const color = this._blend(style.wallDark, style.wallLight, lightness)
      entries.push({
        draw: (ctx, pgr) => {
          const b0 = this._projectGround(pgr, vx0, vy0), b1 = this._projectGround(pgr, vx1, vy1)
          if (!b0 || !b1) return
          const s0 = pgr._scaleAtRow?.(vy0) ?? 0, s1 = pgr._scaleAtRow?.(vy1) ?? 0
          const t0 = { x: b0.x, y: b0.y - style.wallH * s0 }
          const t1 = { x: b1.x, y: b1.y - style.wallH * s1 }
          this._fillQuad(ctx, t0, t1, b1, b0, color)
        },
      })
    }
    this._collectDoorway(house, tileRow, entries, cx, cy + r * 0.96, Math.min(0.6, r * 0.28), style)
  }

  // Callers pass the FINAL doorY and half-width. This used to derive both
  // from a centre and radius, which silently broke the longhall: it
  // handed in y1 - 0.001 and w * 0.15, so doorY landed on row 21 while
  // the call itself only ever ran on row 20, and the guard below rejected
  // it every frame.
  _collectDoorway(house, tileRow, entries, cx, doorY, doorHalf, style) {
    if (Math.round(doorY) !== tileRow) return
    entries.push({
      draw: (ctx, pgr) => {
        const gB0 = this._projectGround(pgr, cx - doorHalf, doorY)
        const gB1 = this._projectGround(pgr, cx + doorHalf, doorY)
        if (!gB0 || !gB1) return
        const scale = pgr._scaleAtRow?.(doorY) ?? 0
        const doorH = style.doorH ?? Math.min(1.3, style.wallH * 0.7)
        const gT0 = { x: gB0.x, y: gB0.y - doorH * scale }
        const gT1 = { x: gB1.x, y: gB1.y - doorH * scale }
        this._fillQuad(ctx, gT0, gT1, gB1, gB0, DOOR_COLOR)
        // Lintel beam. Gated on style.trim, which only the longhall
        // defines -- the dwellings keep their plain openings.
        if (style.trim) {
          const lintelHalf = doorHalf * 1.15, lintelH = 0.20
          const lB0 = this._projectGround(pgr, cx - lintelHalf, doorY)
          const lB1 = this._projectGround(pgr, cx + lintelHalf, doorY)
          if (lB0 && lB1) {
            this._fillQuad(ctx,
              { x: lB0.x, y: lB0.y - (doorH + lintelH) * scale },
              { x: lB1.x, y: lB1.y - (doorH + lintelH) * scale },
              { x: lB1.x, y: lB1.y - doorH * scale },
              { x: lB0.x, y: lB0.y - doorH * scale },
              style.trim)
          }
        }
      },
    })
  }

  // ── Longhall wall rows: two gable ends (each split into per-row strips,
  // since they run north-south and can span several rows) + the long
  // south wall (a single row, it runs east-west at constant y) ───────────────

  _collectLongHallRow(house, tileRow, entries) {
    const { x: cx, y: cy, w, d, style } = house
    const x0 = cx - w / 2, x1 = cx + w / 2
    const y0 = cy - d / 2, y1 = cy + d / 2

    // Gable ends are back-face culled: you can only genuinely see the west
    // end from west of it, and the east end from east of it. Both were
    // drawn unconditionally, so standing square in front of the hall
    // showed the INSIDE of both ends splayed out either side. The round
    // huts have always culled this way -- see midSin in _collectHutRow.
    this._pushVerticalWallStrip(x0, y0, y1, tileRow, style.wallH, style.wallDark, entries, 'west')
    this._pushVerticalWallStrip(x1, y0, y1, tileRow, style.wallH,
      this._blend(style.wallDark, style.wallLight, 0.7), entries, 'east')

    // Long south (front) wall -- one row, at y1.
    if (Math.round(y1) === tileRow) {
      const color = this._blend(style.wallDark, style.wallLight, 0.55)
      entries.push({
        draw: (ctx, pgr) => {
          const gSW = this._projectGround(pgr, x0, y1), gSE = this._projectGround(pgr, x1, y1)
          if (!gSW || !gSE) return
          const s = pgr._scaleAtRow?.(y1) ?? 0
          const tSW = { x: gSW.x, y: gSW.y - style.wallH * s }
          const tSE = { x: gSE.x, y: gSE.y - style.wallH * s }
          this._fillQuad(ctx, tSW, tSE, gSE, gSW, color)
        },
      })
      this._collectDoorway(house, tileRow, entries, cx, y1 - 0.001, Math.min(0.75, w * 0.11), style)
    }
  }

  // cullSide: 'west' | 'east' | undefined. Tested inside draw(), not here,
  // because the camera can move between collection and draw.
  static gableVisible(pgr, x, cullSide) {
    if (!cullSide) return true
    const camCol = pgr._perspCamCol?.()
    if (camCol == null) return true
    return cullSide === 'west' ? camCol < x : camCol > x
  }

  _pushVerticalWallStrip(x, y0, y1, tileRow, wallH, color, entries, cullSide) {
    const segY0 = Math.max(y0, tileRow), segY1 = Math.min(y1, tileRow + 1)
    if (segY1 <= segY0) return
    entries.push({
      draw: (ctx, pgr) => {
        if (!RoundhouseRenderer.gableVisible(pgr, x, cullSide)) return
        const gA = this._projectGround(pgr, x, segY0), gB = this._projectGround(pgr, x, segY1)
        if (!gA || !gB) return
        const sA = pgr._scaleAtRow?.(segY0) ?? 0, sB = pgr._scaleAtRow?.(segY1) ?? 0
        const tA = { x: gA.x, y: gA.y - wallH * sA }, tB = { x: gB.x, y: gB.y - wallH * sB }
        this._fillQuad(ctx, tA, tB, gB, gA, color)
      },
    })
  }

  // ── Overlay pass: roofs, portico, gable ornament, ground shadow ─────────────
  // Called after forestEffects.update() (same reasoning DolmenRenderer's
  // grove.js wiring uses), drawing straight onto pgr._gCtx.

  drawOverlay(pgr, sw, sh) {
    if (!pgr) return
    const ctx = pgr._gCtx
    if (!ctx) return
    for (const house of this._houses) {
      if (!this._onscreen(pgr, house.x, house.y, sw, sh)) continue
      if (house.kind === 'longhall') this._drawLongHallOverlay(pgr, ctx, house)
      else                            this._drawHutOverlay(pgr, ctx, house)
    }
  }

  _drawHutOverlay(pgr, ctx, house) {
    const { x: cx, y: cy, r, segments, style, thatch } = house
    this._drawRingShadow(pgr, ctx, cx, cy, r * 1.2, segments)

    const topVerts = [], angles = []
    for (let i = 0; i <= segments; i++) {
      const a  = (i / segments) * Math.PI * 2
      const vx = cx + Math.cos(a) * r, vy = cy + Math.sin(a) * r
      const ground = this._projectGround(pgr, vx, vy)
      if (!ground) { topVerts.push(null); angles.push(a); continue }
      const scale = pgr._scaleAtRow?.(vy) ?? 0
      topVerts.push({ x: ground.x, y: ground.y - style.wallH * scale })
      angles.push(a)
    }

    const apexScale  = pgr._scaleAtRow?.(cy) ?? 0
    const apexGround = this._projectGround(pgr, cx, cy)
    if (!apexGround) return
    const apex = { x: apexGround.x, y: apexGround.y - (style.wallH + style.roofH) * apexScale }
    for (let i = 0; i < segments; i++) {
      const t0 = topVerts[i], t1 = topVerts[i + 1]
      if (!t0 || !t1) continue
      const midSin = Math.sin((angles[i] + angles[i + 1]) / 2)
      if (thatch.canvas) this._drawTiledQuad(pgr, ctx, thatch.canvas, apex, apex, t0, t1, 1, 2)
      else                this._fillTri(ctx, apex, t0, t1, style.wallDark)
      this._fillTri(ctx, apex, t0, t1, midSin < 0 ? ROOF_SHADE_DARK : ROOF_SHADE_MID)
    }
  }

  _drawLongHallOverlay(pgr, ctx, house) {
    const { x: cx, y: cy, w, d, style, thatch } = house
    const x0 = cx - w / 2, x1 = cx + w / 2
    const y0 = cy - d / 2, y1 = cy + d / 2

    this._drawBoxShadow(pgr, ctx, x0 - 0.4, x1 + 0.4, y0 - 0.3, y1 + 0.6)

    // Roof corners sit OUTSIDE the wall by `ov` on all four sides, at the
    // height the ridge->eave slope (roofH over d/2) has fallen to by
    // then. Because that is the same line the wall top already lay on,
    // the wall top still meets the roof plane exactly and the gable
    // triangles below still cover the gable ends seamlessly -- they just
    // reach further out and further down.
    const ov     = style.eaveOverhang ?? 0
    const halfD  = d / 2
    const eaveH  = style.wallH - (halfD > 0 ? ov * (style.roofH / halfD) : 0)
    const ex0 = x0 - ov, ex1 = x1 + ov
    const ey0 = y0 - ov, ey1 = y1 + ov

    const gNW = this._projectGround(pgr, ex0, ey0), gNE = this._projectGround(pgr, ex1, ey0)
    const gSW = this._projectGround(pgr, ex0, ey1), gSE = this._projectGround(pgr, ex1, ey1)
    if (!gNW || !gNE || !gSW || !gSE) return
    const sNorth = pgr._scaleAtRow?.(ey0) ?? 0, sSouth = pgr._scaleAtRow?.(ey1) ?? 0
    const tNW = { x: gNW.x, y: gNW.y - eaveH * sNorth }
    const tNE = { x: gNE.x, y: gNE.y - eaveH * sNorth }
    const tSW = { x: gSW.x, y: gSW.y - eaveH * sSouth }
    const tSE = { x: gSE.x, y: gSE.y - eaveH * sSouth }

    const gRidgeW = this._projectGround(pgr, ex0, cy), gRidgeE = this._projectGround(pgr, ex1, cy)
    if (!gRidgeW || !gRidgeE) return
    const sMid = pgr._scaleAtRow?.(cy) ?? 0
    const ridgeW = { x: gRidgeW.x, y: gRidgeW.y - (style.wallH + style.roofH) * sMid }
    const ridgeE = { x: gRidgeE.x, y: gRidgeE.y - (style.wallH + style.roofH) * sMid }

    const repU = Math.max(1, Math.round(w / TILE_TARGET))
    // Slope is longer than d/2 once it overhangs -- repeat count
    // follows it, or the thatch courses stretch near the eave.
    const repV = Math.max(1, Math.round((halfD + ov) / TILE_TARGET))

    if (thatch.canvas) this._drawTiledQuad(pgr, ctx, thatch.canvas, ridgeW, ridgeE, tSW, tSE, repU, repV)
    else                this._fillQuad(ctx, ridgeW, ridgeE, tSE, tSW, style.wallDark)
    this._fillQuad(ctx, ridgeW, ridgeE, tSE, tSW, ROOF_SHADE_MID)

    if (thatch.canvas) this._drawTiledQuad(pgr, ctx, thatch.canvas, ridgeW, ridgeE, tNW, tNE, repU, repV)
    else                this._fillQuad(ctx, ridgeW, ridgeE, tNE, tNW, style.wallDark)
    this._fillQuad(ctx, ridgeW, ridgeE, tNE, tNW, ROOF_SHADE_DARK)

    // Same back-face rule as the gable walls. Dropping the far end leaves
    // no hole: the two slope quads above still meet along the ridge.
    if (RoundhouseRenderer.gableVisible(pgr, ex0, 'west'))
      this._fillTri(ctx, tNW, tSW, ridgeW, this._blend(style.wallDark, style.wallLight, 0.85))
    if (RoundhouseRenderer.gableVisible(pgr, ex1, 'east'))
      this._fillTri(ctx, tNE, tSE, ridgeE, this._blend(style.wallDark, style.wallLight, 0.7))

    this._drawGableOrnament(ctx, ridgeW, sMid, style)
    this._drawGableOrnament(ctx, ridgeE, sMid, style)
    this._drawPortico(pgr, ctx, house, style, pgr._scaleAtRow?.(y1) ?? sSouth)
  }

  _drawGableOrnament(ctx, ridgePeak, scale, style) {
    const len = 0.8 * scale
    ctx.strokeStyle = style.trim || 'rgba(50,38,26,0.95)'
    ctx.lineWidth = Math.max(1, 0.12 * scale)
    ctx.beginPath()
    ctx.moveTo(ridgePeak.x - len * 0.5, ridgePeak.y - len)
    ctx.lineTo(ridgePeak.x + len * 0.15, ridgePeak.y + len * 0.25)
    ctx.moveTo(ridgePeak.x + len * 0.5, ridgePeak.y - len)
    ctx.lineTo(ridgePeak.x - len * 0.15, ridgePeak.y + len * 0.25)
    ctx.stroke()
  }

  _drawPortico(pgr, ctx, house, style, sSouth) {
    const { x: cx, y: cy, w, d } = house
    const y1 = cy + d / 2
    const pw = Math.min(2.6, w * 0.3)
    const px0 = cx - pw / 2, px1 = cx + pw / 2
    // Posts stand at the eave TIP and rise to exactly the eave height
    // there, so they carry the overhanging thatch. They used to stand
    // 1.2 out and hold up a horizontal canopy at 2.05 -- which the eave
    // then hung into, 0.28 above it, and the two read as one cheap slab.
    const ov       = style.eaveOverhang ?? 0
    const porchOut = ov > 0 ? ov : 0.35
    const halfD    = d / 2
    const py = y1 + porchOut
    // Never shorter than the doorway it shelters. A fixed second
    // constant drifted out of step with doorH the moment doorH was
    // raised for the hall; this cannot.
    const doorH = style.doorH ?? Math.min(1.3, style.wallH * 0.7)
    // The eave height at the post row: the roof plane falls
    // roofH/(d/2) per row past the wall. Bounded below by the doorhead so
    // a large eaveOverhang can never bury the doorway -- past roughly
    // 0.78 here the plane would drop below the 1.9 lintel top.
    const ph  = Math.max(doorH + 0.25,
      style.wallH - (halfD > 0 ? porchOut * (style.roofH / halfD) : 0))

    const postL = this._projectGround(pgr, px0, py), postR = this._projectGround(pgr, px1, py)
    if (!postL || !postR) return
    const sPost = pgr._scaleAtRow?.(py) ?? sSouth

    const postLTop = { x: postL.x, y: postL.y - ph * sPost }
    const postRTop = { x: postR.x, y: postR.y - ph * sPost }

    // No canopy quad -- see this patch's header. The thatch overhang IS
    // the porch roof now; these two only carry it.
    const postW = style.postW ?? 0.12
    this._fillQuad(ctx,
      { x: postLTop.x - postW * sPost, y: postLTop.y }, { x: postLTop.x + postW * sPost, y: postLTop.y },
      { x: postL.x + postW * sPost, y: postL.y }, { x: postL.x - postW * sPost, y: postL.y },
      style.wallDark)
    this._fillQuad(ctx,
      { x: postRTop.x - postW * sPost, y: postRTop.y }, { x: postRTop.x + postW * sPost, y: postRTop.y },
      { x: postR.x + postW * sPost, y: postR.y }, { x: postR.x - postW * sPost, y: postR.y },
      style.wallDark)
  }

  // ── Ground-contact shadows ───────────────────────────────────────────────────

  _drawRingShadow(pgr, ctx, cx, cy, r, segments) {
    const pts = []
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2
      const p = this._projectGround(pgr, cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      if (p) pts.push(p)
    }
    if (pts.length < 3) return
    ctx.fillStyle = SHADOW_COLOR
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath()
    ctx.fill()
  }

  _drawBoxShadow(pgr, ctx, x0, x1, y0, y1) {
    const p00 = this._projectGround(pgr, x0, y0), p10 = this._projectGround(pgr, x1, y0)
    const p01 = this._projectGround(pgr, x0, y1), p11 = this._projectGround(pgr, x1, y1)
    if (!p00 || !p10 || !p01 || !p11) return
    this._fillQuad(ctx, p00, p10, p11, p01, SHADOW_COLOR)
  }

  // ── Tiled texture mapping ────────────────────────────────────────────────────

  _drawTiledQuad(pgr, ctx, tex, p00, p10, p01, p11, repU, repV) {
    const tw = tex.width, th = tex.height
    const lerp  = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    const point = (u, v) => lerp(lerp(p00, p10, u), lerp(p01, p11, u), v)
    for (let j = 0; j < repV; j++) {
      const v0 = j / repV, v1 = (j + 1) / repV
      for (let i = 0; i < repU; i++) {
        const u0 = i / repU, u1 = (i + 1) / repU
        const c00 = point(u0, v0), c10 = point(u1, v0)
        const c01 = point(u0, v1), c11 = point(u1, v1)
        pgr._drawAffineTriangle(ctx, tex, { u: 0, v: 0 }, { u: tw, v: 0 }, { u: tw, v: th }, c00, c10, c11)
        pgr._drawAffineTriangle(ctx, tex, { u: 0, v: 0 }, { u: tw, v: th }, { u: 0, v: th }, c00, c11, c01)
      }
    }
  }

  _onscreen(pgr, cx, cy, sw, sh) {
    const p = this._projectGround(pgr, cx, cy)
    if (!p) return false
    const safeSw = sw ?? 99999, safeSh = sh ?? 99999
    return !(p.x < -400 || p.x > safeSw + 400 || p.y < -400 || p.y > safeSh + 400)
  }

  _terrainHeight(pgr, px, py) {
    const x0i = Math.floor(px), y0i = Math.floor(py)
    const fx = px - x0i, fy = py - y0i
    const h00 = pgr._vertexH?.(x0i,     y0i)     ?? 0
    const h10 = pgr._vertexH?.(x0i + 1, y0i)     ?? 0
    const h01 = pgr._vertexH?.(x0i,     y0i + 1) ?? 0
    const h11 = pgr._vertexH?.(x0i + 1, y0i + 1) ?? 0
    return h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy)
         + h01 * (1 - fx) * fy       + h11 * fx * fy
  }

  _projectGround(pgr, tileX, tileY) {
    const y = pgr._rowToScreenY?.(tileY)
    if (y == null) return null
    const x = pgr._colToScreenX?.(tileX, tileY)
    if (x == null) return null
    const scale = pgr._scaleAtRow?.(tileY) ?? 0
    const h = this._terrainHeight(pgr, tileX, tileY)
    return { x, y: y - h * scale }
  }

  _blend(colorA, colorB, t) {
    const pa = this._parseRgba(colorA), pb = this._parseRgba(colorB)
    const r = Math.round(pa.r + (pb.r - pa.r) * t)
    const g = Math.round(pa.g + (pb.g - pa.g) * t)
    const b = Math.round(pa.b + (pb.b - pa.b) * t)
    const a = pa.a + (pb.a - pa.a) * t
    return `rgba(${r},${g},${b},${a})`
  }

  _parseRgba(str) {
    const m = str.match(/rgba?\(([^)]+)\)/)
    const [r, g, b, a = 1] = m[1].split(',').map(s => parseFloat(s))
    return { r, g, b, a }
  }

  _fillQuad(ctx, p1, p2, p3, p4, fillStyle) {
    ctx.fillStyle = fillStyle
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.lineTo(p3.x, p3.y)
    ctx.lineTo(p4.x, p4.y)
    ctx.closePath()
    ctx.fill()
  }

  _fillTri(ctx, p1, p2, p3, fillStyle) {
    ctx.fillStyle = fillStyle
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.lineTo(p3.x, p3.y)
    ctx.closePath()
    ctx.fill()
  }

  destroy() {
    // Nothing owned directly (no canvas of our own) -- scene is
    // responsible for calling perspectiveGround.setStructures(null).
  }
}

