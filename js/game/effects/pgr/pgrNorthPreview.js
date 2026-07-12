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

    // hazeT: strong atmospheric wash right at the horizon, fading out as
    // the row's screen position moves away from it.
    const hazeT = Math.pow(1 - t, 1.3)
    // edgeAlpha: fully transparent exactly at the horizon, opaque once
    // far enough from it -- no depth-based cutoff any more, this alone
    // governs visibility.
    const edgeAlpha = Math.pow(t, 0.8)
    if (edgeAlpha <= 0.01) return

    // Outer safety bound only -- caps how many world-rows ever get
    // iterated per frame, regardless of how the screen-space fade above
    // plays out. Not itself responsible for the visual fade any more.
    if (Math.abs(tileRow) > pgr.constructor.NORTH_PREVIEW_DEPTH) return

    const scaleNear = pgr._scaleAtRow(tileRow + 1)
    const halfCols  = scaleNear > 0.001 ? (sw / 2) / scaleNear + 1 : neighborW
    const colStart  = Math.floor(camCol - halfCols) - pgr.constructor.EDGE_EXTEND
    const colEnd    = Math.ceil(camCol + halfCols)  + pgr.constructor.EDGE_EXTEND

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
      const mCol = mirrorIndex(tileCol, neighborW)

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
      if (nb.heightMap && GID_CATEGORIES_GROUND.has(gid0)) {
        const h00 = neighborVertexH(pgr, mCol,     localRow)
        const h10 = neighborVertexH(pgr, mCol + 1, localRow)
        const h01 = neighborVertexH(pgr, mCol,     localRow + 1)
        const h11 = neighborVertexH(pgr, mCol + 1, localRow + 1)
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

      const _nTL = { x: xTL, y: yTopClamped }, _nTR = { x: xTR, y: yTopClamped }
      const _nBL = { x: xBL, y: yBotClamped }, _nBR = { x: xBR, y: yBotClamped }
      pgr._gCtx.globalAlpha = edgeAlpha
      if (!lodRow || !pgr._lodFillQuad(pgr._gCtx, gid0, hazedTint, edgeAlpha, _nTL, _nTR, _nBL, _nBR)) {
        pgr._drawTrapezoidTinted(pgr._gCtx, gid0, _nTL, _nTR, _nBL, _nBR, hazedTint)
      }
    }
    pgr._gCtx.globalAlpha = 1.0

    if (pgr._forestEffects) {
      const rowTrunks = pgr._forestEffects.getNorthPreviewTrunksForRow(tileRow)
      for (const trunk of rowTrunks) {
        pgr._forestEffects.drawTrunk(pgr._gCtx, trunk, this, playerTileRow, edgeAlpha)
      }
    }
  }

