// pgrCliffFaces.js — cliff faces + elevated terrain side/front faces
// Location: js/game/effects/pgr/pgrCliffFaces.js
//
// Split out of perspectiveGroundRenderer.js. Module pattern: plain
// functions taking the PGR instance as their first argument, reading
// and writing its fields directly -- all state stays on the instance,
// so behaviour is identical to the pre-split code and PGR.destroy()
// works untouched. Class statics are reached via pgr.constructor.

export function drawNorthCliffFace(pgr, ctx, col, row, elev, tileAlpha, yTopClamped, yBotClamped) {
    const scaledW = pgr._scaleAtRow(row + 1)
    const tileH   = scaledW * elev

    const capBot = yTopClamped
    const capTop = yTopClamped - tileH

    const horizonPx = pgr._horizonPx()
    if (capBot < horizonPx) return

    const xTL = pgr._colToScreenX(col,     row)
    const xTR = pgr._colToScreenX(col + 1, row)
    const xBL = pgr._colToScreenX(col,     row + 1)
    const xBR = pgr._colToScreenX(col + 1, row + 1)

    ctx.globalAlpha = tileAlpha
    pgr._drawTrapezoidTinted(ctx, 839,
      { x: xTL, y: capTop }, { x: xTR, y: capTop },
      { x: xBL, y: capBot }, { x: xBR, y: capBot },
      null)
    ctx.globalAlpha = 1.0

    const faceTop = capBot
    const faceBot = yBotClamped
    if (faceBot <= faceTop) return

    const screenX = pgr._colToScreenX(col + 0.5, row + 1)
    ctx.save()
    ctx.globalAlpha = tileAlpha * 0.88
    ctx.fillStyle = '#2a4020'
    ctx.fillRect(
      Math.round(screenX - scaledW / 2),
      Math.round(faceTop),
      Math.round(scaledW),
      Math.round(faceBot - faceTop))
    ctx.restore()
  }

export function drawElevatedFace(pgr, ctx, col, row, elev, gid, tileAlpha, yBotHint) {
    const yBot = pgr._rowToScreenY(row + 1) ?? yBotHint
    if (yBot === null) return
    const tileH = pgr._scaleAtRow(row + 1) || pgr._scaleAtRow(row)
    const yTop  = yBot - tileH * elev
    if (yTop >= yBot) return

    const xBL = pgr._colToScreenX(col,     row + 1)
    const xBR = pgr._colToScreenX(col + 1, row + 1)
    const xTL = xBL
    const xTR = xBR

    ctx.globalAlpha = tileAlpha
    pgr._drawTrapezoidTinted(ctx, gid,
      { x: xTL, y: yTop }, { x: xTR, y: yTop },
      { x: xBL, y: yBot }, { x: xBR, y: yBot },
      null)
    ctx.globalAlpha = 1.0
  }

export function drawElevatedSideFace(pgr, ctx, edgeCol, row, elev, gid, tileAlpha) {
    const yFront = pgr._rowToScreenY(row + 1)
    if (yFront === null) return
    const sFront = pgr._scaleAtRow(row + 1)
    if (!(sFront > 0)) return

    const yBack  = pgr._rowToScreenY(row)
    const sBack  = pgr._scaleAtRow(row)

    const xFront = pgr._colToScreenX(edgeCol, row + 1)
    const xBack  = pgr._colToScreenX(edgeCol, row)

    const yFrontTop = yFront - elev * sFront
    const yBackTop  = yBack  !== null ? yBack  - elev * sBack : yFrontTop

    const tint = pgr.tintManager.getTint(gid, edgeCol, row)
    const sideColor = tint
      ? `hsl(${tint.h},${Math.round(tint.s * 0.55)}%,${Math.max(tint.l - 18, 4)}%)`
      : 'rgb(52, 38, 28)'

    ctx.save()
    ctx.globalAlpha = tileAlpha * 0.85
    ctx.fillStyle = sideColor
    ctx.beginPath()
    ctx.moveTo(xBack,  yBackTop)
    ctx.lineTo(xFront, yFrontTop)
    ctx.lineTo(xFront, yFront)
    if (yBack !== null) ctx.lineTo(xBack, yBack)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(20,14,8,0.45)'
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.restore()
  }

export function drawCliffSide(pgr, ctx, col, row, elev, neighbourRow, sideDir, tileAlpha) {
    const edgeCol  = sideDir > 0 ? col + 1 : col
    const yBotA    = pgr._rowToScreenY(row + 1)
    const tileHA   = pgr._scaleAtRow(row + 1)
    const yTopA    = yBotA !== null ? yBotA - tileHA * elev : null

    const yBotB    = pgr._rowToScreenY(neighbourRow + 1)
    const tileHB   = pgr._scaleAtRow(neighbourRow + 1)
    const yTopB    = yBotB !== null ? yBotB - tileHB * elev : null

    if (yTopA === null || yBotA === null || yTopB === null || yBotB === null) return
    if (yBotA <= yTopA || yBotB <= yTopB) return

    const xA = pgr._colToScreenX(edgeCol, row + 1)
    const xB = pgr._colToScreenX(edgeCol, neighbourRow + 1)

    ctx.save()
    ctx.globalAlpha = tileAlpha * 0.85
    ctx.fillStyle = 'rgb(60, 42, 28)'
    ctx.beginPath()
    ctx.moveTo(xB, yTopB)
    ctx.lineTo(xB, yBotB)
    ctx.lineTo(xA, yBotA)
    ctx.lineTo(xA, yTopA)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(30,20,10,0.6)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

// Solid (untextured, shaded-fill) vertical face for a landmass whose
// NORTH edge borders lower ground -- e.g. a headland jutting up from
// the south side of a channel, where the elevation drop happens as row
// DECREASES rather than increases. Mirrors drawElevatedSideFace's own
// approach (a plain darkened fill along an edge, not a textured cliff
// GID) but oriented along a ROW edge (the tile's own north border,
// spanning col to col+1) instead of a COLUMN edge.
//
// Added because no north-facing case existed at all previously: the
// renderer only drew faces for elevation drops to the south, east, or
// west. A south-facing landmass's channel-facing edge had NO geometry
// drawn there whatsoever -- the elevated ground quad just ended in
// mid-air with nothing filling the vertical gap down to the lower
// tile beside it, which read as seeing "through" the terrain to
// whatever sat behind/below it (confirmed via screenshot: the player
// and boat visible through the cliff). This doesn't need to look like
// rock -- a plain shaded fill (same treatment east/west faces already
// use) is enough to make the drop read as solid.
// Mirrors drawElevatedFace exactly (the working south-facing case),
// just anchored on the NORTH boundary ('row', the shared edge with
// row-1) instead of the south boundary ('row+1'). Uses the tile's OWN
// texture via _drawTrapezoidTinted -- the same bright grass image the
// plateau's top surface uses -- rather than a flat darkened fill.
//
// That darkened-fill approach (mirroring drawElevatedSideFace's east/
// west style instead) was the actual bug: it made the drop read as a
// visually DISTINCT dark wall structure, not a continuation of the
// grass, which is why it looked like "a wall with grass on the ground"
// instead of the grass itself sloping down to meet it. Using the same
// texture as the top surface makes the two blend into one continuous
// grassy drop, exactly matching how the north bank's own (working)
// south-facing case already looks, and satisfies "no texture needed
// there" as bare unadorned grass rather than a distinct rock/wall look.
export function drawElevatedNorthFace(pgr, ctx, col, row, elev, gid, tileAlpha) {
  const yFront = pgr._rowToScreenY(row)
  if (yFront === null) return
  const tileH = pgr._scaleAtRow(row) || pgr._scaleAtRow(row + 1)
  const yTop  = yFront - tileH * elev
  if (yTop >= yFront) return

  const xL = pgr._colToScreenX(col,     row)
  const xR = pgr._colToScreenX(col + 1, row)

  ctx.globalAlpha = tileAlpha
  pgr._drawTrapezoidTinted(ctx, gid,
    { x: xL, y: yTop }, { x: xR, y: yTop },
    { x: xL, y: yFront }, { x: xR, y: yFront },
    null)
  ctx.globalAlpha = 1.0
}

export function drawCliffFace(pgr, ctx, col, row, elev, tileAlpha) {
    const yBot = pgr._rowToScreenY(row + 1)
    if (yBot === null) return

    const tileScreenH = pgr._scaleAtRow(row + 1)
    const yTop        = yBot - tileScreenH * elev

    if (yTop >= yBot) return

    const xBL = pgr._colToScreenX(col,     row + 1)
    const xBR = pgr._colToScreenX(col + 1, row + 1)
    const xTL = xBL
    const xTR = xBR

    ctx.globalAlpha = tileAlpha
    pgr._drawTrapezoidTinted(ctx,
      pgr.constructor.CLIFF_FACE_GID,
      { x: xTL, y: yTop }, { x: xTR, y: yTop },
      { x: xBL, y: yBot }, { x: xBR, y: yBot },
      null)
    ctx.globalAlpha = 1.0
  }


