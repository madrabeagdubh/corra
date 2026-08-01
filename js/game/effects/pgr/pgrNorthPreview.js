// pgrNorthPreview.js — faded preview of the north-neighbour map beyond row 0
// Location: js/game/effects/pgr/pgrNorthPreview.js
//
// Split out of perspectiveGroundRenderer.js. Module pattern: plain
// functions taking the PGR instance as their first argument, reading
// and writing its fields directly -- all state stays on the instance,
// so behaviour is identical to the pre-split code and PGR.destroy()
// works untouched. Class statics are reached via pgr.constructor.

import { GID_CATEGORIES_GROUND, mirrorIndex } from './pgrShared.js'

  // Mirrors _vertexH() but reads from the north neighbour's heightMap
  // instead of the current map's.
function neighborVertexH(pgr, col, row) {
    const nb = pgr._northNeighbor
    if (!nb?.heightMap) return 0
    if (col < 0 || row < 0 || col > nb.width || row > nb.height) return 0
    return nb.heightMap[row]?.[col] ?? 0
  }

  /**
   * Draws one row of the north-neighbour preview -- ground tiles + trees,
   * faded toward the horizon, no collision/FOV/interactivity of any kind
   * (the player can't actually reach these rows until the real scene
   * transition happens). Called from inside update()'s main per-row loop
   * for any tileRow < 0, INSTEAD of that loop's normal per-tile-row body
   * (which is written entirely in terms of the CURRENT map's own data and
   * would need touching in dozens of places to be neighbour-aware --
   * deliberately not attempted here, since this is a pure visual preview,
   * not a second playable map).
   *
   * @param {number} tileRow       -- negative world row (e.g. -1 is
   *   immediately north of the current map's own row 0)
   * @param {number} camCol
   * @param {number} sw
   * @param {number} horizonPx
   * @param {number} playerTileRow -- passed through to ForestEffects.drawTrunk
   *   for its own (unrelated) south-fade-near-player effect; irrelevant at
   *   these distances but harmless to pass through.
   */
export function drawNorthPreviewRow(pgr, tileRow, camCol, sw, horizonPx, playerTileRow) {
    const nb = pgr._northNeighbor
    if (!nb?.layer0) return
    const neighborH = nb.height
    const neighborW = nb.width
    if (!neighborH || !neighborW) return

    // Shift the negative world row into the neighbour's own local row
    // indexing -- its southmost row (adjacent to our row 0) is world row
    // -1, so local row = tileRow + neighborH.
    // If the preview depth (NORTH_PREVIEW_DEPTH) reaches further than the
    // neighbour's own height, mirror-reflect back into its valid row
    // range rather than returning nothing -- same technique as the
    // column mirroring below, and for the same reason: the screen-space
    // fade doesn't know or care how tall the neighbour actually is, so
    // without this, rows beyond the neighbour's own size left a real gap
    // where the fade still expected visible ground.
    const localRow = mirrorIndex(tileRow + neighborH, neighborH)

    const yTop = pgr._rowToScreenY(tileRow)
    const yBot = pgr._rowToScreenY(tileRow + 1)
    if (yBot === null) return
    if (yTop !== null && yTop > pgr._sh + 100) return
    if (yBot < horizonPx - pgr.tileDisplaySize * 3) return

    const yTopClamped = (yTop === null || yTop < horizonPx - pgr.tileDisplaySize)
      ? horizonPx - pgr.tileDisplaySize : yTop
    const yBotClamped = Math.min(pgr._sh + 100, yBot)
    if (yBotClamped <= yTopClamped) return

    // The fade is driven by SCREEN-SPACE proximity to the horizon line,
    // NOT world-depth (tileRow) directly. Reasoning: perspective
    // compresses distant world-rows into an ever-shrinking band of
    // screen pixels near the horizon -- a fade that's gradual in WORLD
    // units still ends up looking like an abrupt cutoff on screen,
    // because most of that "gradual" range only ever occupies a handful
    // of actual pixels. Tying the fade to how close this row's screen
    // position is to the horizon line guarantees a visually smooth
    // dissolve regardless of that compression -- the same principle the
    // main renderer already uses for its own horizonFade, just with a
    // much wider band here since this needs to read as genuine
    // atmospheric distance, not a last-instant fade-in.
    const groundSpan   = Math.max(1, pgr._sh - horizonPx)
    const fadeBandPx   = groundSpan * pgr.constructor.NORTH_FADE_BAND_FRAC
    const distToHorizonPx = Math.max(0, yBotClamped - horizonPx)
    const t = Math.min(1, distToHorizonPx / fadeBandPx)   // 0 = at the horizon line, 1 = fadeBandPx+ away from it

    const scaleNear = pgr._scaleAtRow(tileRow + 1)
    const halfCols  = scaleNear > 0.001 ? (sw / 2) / scaleNear + 1 : neighborW
    const colStart  = Math.floor(camCol - halfCols) - pgr.constructor.EDGE_EXTEND
    const colEnd    = Math.ceil(camCol + halfCols)  + pgr.constructor.EDGE_EXTEND

    // A tall feature (the ráth's hill, say) can sit at a world row that's
    // technically very deep in preview territory -- its OWN row is far
    // from the current map's edge in the neighbour's local coordinates,
    // even though the height-offset above makes it rise up and read as
    // large/near on screen. Distance-based t/hazeT alone doesn't know
    // that: it was tuned for the flat-fields fallback, where nothing
    // ever had real elevation, so nothing ever needed this.
    //
    // Sample several columns across this row's ACTUAL visible span (not
    // just one guessed point at camCol) and take the tallest -- a single
    // sample at camCol landed whatever column of the CURRENT map's
    // camera happened to mirror into the neighbour's width, which has no
    // reason to be anywhere near the neighbour's own tallest feature
    // (b0's hill peaks at x=28 of 56; b1's camera column doesn't know or
    // care about that). Missing the peak meant almost no height boost,
    // so the fade stayed glassy even with the floor logic in place.
    let _rowHeight = 0
    if (nb.heightMap) {
      const SAMPLES = 9
      for (let s = 0; s <= SAMPLES; s++) {
        const sampleCol = Math.round(colStart + (colEnd - colStart) * (s / SAMPLES))
        const mSample   = mirrorIndex(sampleCol + (nb.columnOffset ?? 0), neighborW)
        const h = neighborVertexH(pgr, mSample, localRow)
        if (h > _rowHeight) _rowHeight = h
      }
    }
    const _heightBoost = Math.max(0, Math.min(1, _rowHeight / 2.0))

    // hazeT: strong atmospheric wash right at the horizon, fading out as
    // the row's screen position moves away from it -- dampened for tall
    // terrain, which shouldn't wash out just because it's nominally distant.
    const hazeT = Math.pow(1 - t, 1.3) * (1 - _heightBoost * 0.9)
    // edgeAlpha: fully transparent exactly at the horizon, opaque once
    // far enough from it, floored upward for real elevation.
    const edgeAlpha = Math.max(Math.pow(t, 0.8), _heightBoost * 0.9)
    if (edgeAlpha <= 0.01) return

    // Outer safety bound only -- caps how many world-rows ever get
    // iterated per frame, regardless of how the screen-space fade above
    // plays out. Not itself responsible for the visual fade any more.
    if (Math.abs(tileRow) > pgr.constructor.NORTH_PREVIEW_DEPTH) return


    // LOD -- see LOD_MIN_ROW_PX. The preview lives entirely in the
    // horizon band, so in practice almost all of it qualifies: the haze
    // wash was already pushing tint alpha toward 0.95 (near-total
    // coverage of the texture) up there, so a flat pre-blended fill is
    // visually equivalent at a fraction of the cost.
    const lodRow = yTop === null || (yBot - yTop) < pgr.constructor.LOD_MIN_ROW_PX

    const HAZE_H = pgr.constructor.NORTH_HAZE_H
    const HAZE_S = pgr.constructor.NORTH_HAZE_S
    const HAZE_L = pgr.constructor.NORTH_HAZE_L

    for (let tileCol = colStart; tileCol <= colEnd; tileCol++) {
      // Mirror-reflect columns beyond the NEIGHBOUR's own width, same
      // technique and reasoning as the main map's own phantom-tile
      // handling (see the main loop's !inMap block) -- this preview row
      // needs FAR more columns than the neighbour actually has once
      // perspective widens near the horizon, and a straight `continue`
      // left the exact same kind of gap here that fix solved for the
      // main map's own rows.
      const mCol = mirrorIndex(tileCol + (nb.columnOffset ?? 0), neighborW)

      const xTL = pgr._colToScreenX(tileCol,     tileRow)
      const xTR = pgr._colToScreenX(tileCol + 1, tileRow)
      if (xTR < -10 || xTL > sw + 10) continue

      const gid0raw = nb.layer0[localRow]?.[mCol] ?? 0
      if (!gid0raw) continue
      // Skip special-purpose codes (building footprints etc.) that were
      // never meant to render via the normal tileset lookup -- see
      // _isValidTilesetGid's own note. Falls back to the base ground
      // fill (already drawn beneath everything) rather than an
      // attempted draw that quietly produces nothing.
      if (!pgr._isValidTilesetGid(gid0raw)) continue
      // Static water frame (no phase animation) -- fine for a distant,
      // already-hazy preview; not worth the extra bookkeeping.
      const gid0 = (gid0raw === 1625 || gid0raw === 1679) ? 1625 : gid0raw

      const xBL = pgr._colToScreenX(tileCol,     tileRow + 1)
      const xBR = pgr._colToScreenX(tileCol + 1, tileRow + 1)

      let tint0
      let h00 = 0, h10 = 0, h01 = 0, h11 = 0
      const isGroundGid = nb.heightMap && GID_CATEGORIES_GROUND.has(gid0)
      if (isGroundGid) {
        h00 = neighborVertexH(pgr, mCol,     localRow)
        h10 = neighborVertexH(pgr, mCol + 1, localRow)
        h01 = neighborVertexH(pgr, mCol,     localRow + 1)
        h11 = neighborVertexH(pgr, mCol + 1, localRow + 1)
        const pd0 = nb.pathDist?.[localRow]?.[mCol] ?? null
        tint0 = pgr.tintManager.getGroundTint(gid0, mCol, localRow, h00, h10, h01, h11, pd0)
      } else {
        tint0 = pgr.tintManager.getTint(gid0, mCol, localRow)
      }
      // getTint()/getGroundTint() return null for uncategorised GIDs --
      // fall back to a neutral base so the haze blend still has
      // something sensible to work from.
      if (!tint0) tint0 = { h: 90, s: 20, l: 45, alpha: 0.5 }

      // Blend toward the haze colour, AND boost the wash's own opacity
      // toward near-total coverage as hazeT approaches 1 -- otherwise
      // the tile's own underlying texture detail would still show
      // through even at maximum haze, undercutting the "melts into
      // distance" effect (the tint is a translucent wash over the base
      // tile, not a full recolour -- see _drawTrapezoidTinted).
      const hazedTint = {
        h: tint0.h + (HAZE_H - tint0.h) * hazeT,
        s: tint0.s + (HAZE_S - tint0.s) * hazeT,
        l: tint0.l + (HAZE_L - tint0.l) * hazeT,
        alpha: Math.min(0.95, (tint0.alpha ?? 0.5) + hazeT * 0.4),
      }

      // Raise each corner by its own real height, same technique (and
      // same per-row scale source) the main per-row loop already uses
      // for the CURRENT map's own hills (see the _yTL/_yTR/_yBL/_yBR
      // lines in the main loop above) -- height was only ever feeding
      // the tint here before, so a tall hill could never actually rise
      // above the horizon; it just read as flat, differently-shaded
      // ground fading into the haze.
      const sTop = pgr._scaleAtRow(tileRow), sBot = pgr._scaleAtRow(tileRow + 1)
      const _nTL = { x: xTL, y: yTopClamped - h00 * sTop }
      const _nTR = { x: xTR, y: yTopClamped - h10 * sTop }
      const _nBL = { x: xBL, y: yBotClamped - h01 * sBot }
      const _nBR = { x: xBR, y: yBotClamped - h11 * sBot }
      pgr._gCtx.globalAlpha = edgeAlpha
      if (!lodRow || !pgr._lodFillQuad(pgr._gCtx, gid0, hazedTint, edgeAlpha, _nTL, _nTR, _nBL, _nBR)) {
        pgr._drawTrapezoidTinted(pgr._gCtx, gid0, _nTL, _nTR, _nBL, _nBR, hazedTint)
      }
    }
    pgr._gCtx.globalAlpha = 1.0

    if (pgr._forestEffects) {
      const rowTrunks = pgr._forestEffects.getNorthPreviewTrunksForRow(tileRow)
      for (const trunk of rowTrunks) {
        // `pgr`, not `this` -- this module is plain exported functions, so
        // `this` is undefined here (ES module strict mode) and drawTrunk()
        // needs the PGR instance to project rows to screen space.
        pgr._forestEffects.drawTrunk(pgr._gCtx, trunk, pgr, playerTileRow, edgeAlpha)
      }
    }

    // Building silhouettes -- not the real per-facet RoundhouseRenderer
    // treatment (not worth the compute at this distance, and it needs a
    // live PGR of the neighbour's OWN scene to project against, which
    // doesn't exist here), just a simple flat triangle anchored to each
    // house's own (x,y), on whichever world row that falls on. Same
    // height/haze/alpha inputs as the ground this frame so they sit on
    // the slope and fade into the distance consistently with everything
    // else in the preview, rather than floating or looking pasted-on.
    if (nb.houses?.length) {
      for (const house of nb.houses) {
        if (Math.round(house.y) - neighborH !== tileRow) continue
        drawNorthPreviewBuilding(pgr, house, tileRow, localRow, yBotClamped, edgeAlpha, hazeT, nb.columnOffset ?? 0)
      }
    }
  }

  const HOUSE_BASE_COLOR    = { h: 32, s: 30, l: 32 }
  const LONGHALL_BASE_COLOR = { h: 28, s: 34, l: 26 }

  // Anchored to the house's own world row (see the call site above), so
  // this only ever runs once per house per frame -- no need for its own
  // onscreen/culling check beyond the row match already done there.
  function drawNorthPreviewBuilding(pgr, house, tileRow, localRow, yBotClamped, edgeAlpha, hazeT, columnOffset) {
    const isLonghall = house.kind === 'longhall'
    const footR = isLonghall ? Math.max(house.w || 6, house.d || 3) / 2 : (house.r || 2)
    const roofH = isLonghall ? 4.2 : 3.2

    const scale = pgr._scaleAtRow(tileRow)
    // house.x is in the NEIGHBOUR's own coordinate space -- correct as-is
    // for sampling the neighbour's OWN heightmap, but needs columnOffset
    // subtracted before it's usable as a screen-projection column in
    // THIS map's space (see the fetch-time comment on columnOffset).
    const h = neighborVertexH(pgr, Math.round(house.x), localRow)
    const baseY = yBotClamped - h * scale

    const drawX  = house.x - columnOffset
    const xCenter = pgr._colToScreenX(drawX, tileRow)
    const xLeft   = pgr._colToScreenX(drawX - footR, tileRow)
    const xRight  = pgr._colToScreenX(drawX + footR, tileRow)
    const peakY   = baseY - roofH * scale

    const base = isLonghall ? LONGHALL_BASE_COLOR : HOUSE_BASE_COLOR
    const HAZE_H = pgr.constructor.NORTH_HAZE_H
    const HAZE_S = pgr.constructor.NORTH_HAZE_S
    const HAZE_L = pgr.constructor.NORTH_HAZE_L
    const hh = base.h + (HAZE_H - base.h) * hazeT
    const ss = base.s + (HAZE_S - base.s) * hazeT
    const ll = base.l + (HAZE_L - base.l) * hazeT

    pgr._gCtx.globalAlpha = edgeAlpha
    pgr._gCtx.fillStyle = `hsl(${hh},${ss}%,${ll}%)`
    pgr._gCtx.beginPath()
    pgr._gCtx.moveTo(xCenter, peakY)
    pgr._gCtx.lineTo(xLeft,  baseY)
    pgr._gCtx.lineTo(xRight, baseY)
    pgr._gCtx.closePath()
    pgr._gCtx.fill()
    pgr._gCtx.globalAlpha = 1.0
  }


