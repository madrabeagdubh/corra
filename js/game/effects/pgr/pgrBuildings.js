// pgrBuildings.js — building image billboards (box / decal / billboard modes)
// Location: js/game/effects/pgr/pgrBuildings.js
//
// Split out of perspectiveGroundRenderer.js. Module pattern: plain
// functions taking the PGR instance as their first argument, reading
// and writing its fields directly -- all state stays on the instance,
// so behaviour is identical to the pre-split code and PGR.destroy()
// works untouched. Class statics are reached via pgr.constructor.

export function setBuildings(pgr, list) {
    pgr._buildings = []
    for (const b of (list || [])) {
      const entry = {
        ...b,
        anchorRow:    b.anchor ?? (b.y + b.fh - 1),
        centerColInt: Math.floor(b.x + b.fw / 2),
        canvas:       null,
      }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const c   = document.createElement('canvas')
        c.width   = img.width
        c.height  = img.height
        const ctx = c.getContext('2d')
        ctx.imageSmoothingEnabled = false
        ctx.filter = 'saturate(70%)'
        ctx.drawImage(img, 0, 0)
        ctx.filter = 'none'
        entry.canvas   = c
        pgr._lastCamX = null
      }
      img.onerror = e => console.error('[PGR] building image failed:', b.src, e)
      img.src = '/' + b.src.replace(/^\//, '')
      // cuboid faces: `top` and `side` are extra images (the front face is `src`)
      for (const [key, field] of [['top', 'topCanvas'], ['side', 'sideCanvas']]) {
        if (!b[key]) continue
        const im = new Image()
        im.onload = () => { entry[field] = im; pgr._lastCamX = null }
        im.onerror = e => console.error('[PGR] building image failed:', b[key], e)
        im.src = '/' + b[key].replace(/^\//, '')
      }
      pgr._buildings.push(entry)
    }
    console.log('[PGR] buildings registered:', pgr._buildings.length)
  }

export function drawBuilding(pgr, ctx, b, horizonPx, sw) {
    if (b.hidden) return                                  // a scene can take a piece away (the sleeper, once he is up)
    if (b.mode === 'cuboid')    return drawCuboid(pgr, ctx, b)
    if (b.mode === 'wallplane') return drawWallPlane(pgr, ctx, b)
    if (b.mode === 'diagplane') return drawDiagPlane(pgr, ctx, b)
    const frontRow   = b.anchorRow + 1
    const yBase      = pgr._rowToScreenY(frontRow)
    if (yBase === null || yBase < horizonPx) return
    const os         = b.overscale ?? 1.2
    const cxTile     = b.x + b.fw / 2
    const scaleFront = pgr._scaleAtRow(frontRow)
    if (!(scaleFront > 0)) return
    const wFront     = b.fw * scaleFront * os
    const cxFront    = pgr._colToScreenX(cxTile, frontRow)
    if (cxFront + wFront < -sw || cxFront - wFront > sw * 2) return

    const mode = b.mode ?? 'box'
    let boundary = null
    ctx.globalAlpha = 1.0

    if (mode === 'decal') {
      boundary = drawBuildingDecal(pgr, ctx, b, cxTile, frontRow, os, horizonPx)
    } else if (mode === 'billboard') {
      const hB = wFront * (b.canvas.height / b.canvas.width)
      ctx.drawImage(b.canvas,
        Math.round(cxFront - wFront / 2), Math.round(yBase - hB),
        Math.round(wFront), Math.round(hB))
      boundary = [
        { x: cxFront - wFront / 2, y: yBase - hB },
        { x: cxFront + wFront / 2, y: yBase - hB },
        { x: cxFront + wFront / 2, y: yBase },
        { x: cxFront - wFront / 2, y: yBase },
      ]
    } else {
      boundary = drawBuildingBox(pgr, ctx, b, cxTile, cxFront, wFront, yBase, scaleFront)
    }

    if (boundary && boundary.length) {
      // Screen extent for TiltShift. `top` is the roofline, `base` the
      // footprint row -- distance is judged by base, sharpness applied to top.
      let _tsTop = Infinity
      for (let _i = 0; _i < boundary.length; _i++) {
        if (boundary[_i].y < _tsTop) _tsTop = boundary[_i].y
      }
      if (pgr._tsSpans) pgr._tsSpans.push({ top: _tsTop, base: yBase })

      const bTint = pgr.tintManager.getTint(b.tintGid ?? 197, b.x, b.y)
      if (bTint) {
        ctx.save()
        ctx.globalCompositeOperation = 'source-atop'
        ctx.globalAlpha = (bTint.alpha ?? 0.45) * 0.8
        ctx.fillStyle = `hsl(${bTint.h},${bTint.s}%,${bTint.l}%)`
        ctx.beginPath()
        ctx.moveTo(boundary[0].x, boundary[0].y)
        for (let i = 1; i < boundary.length; i++) ctx.lineTo(boundary[i].x, boundary[i].y)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
    }
  }

function drawBuildingBox(pgr, ctx, b, cxTile, cxFront, wFront, yBase, scaleFront) {
    const img   = b.canvas
    const iw    = img.width, ih = img.height
    const split = Math.min(0.85, Math.max(0.05, b.roofSplit ?? 0.45))
    const wallSrcY    = ih * split
    const wallSrcH    = ih - wallSrcY
    const wallScreenH = wFront * (wallSrcH / iw)
    const yWallTop    = yBase - wallScreenH

    const backRow = b.y
    let yBack     = pgr._rowToScreenY(backRow)
    let scaleBack = pgr._scaleAtRow(backRow)
    if (yBack === null || !(scaleBack > 0)) { yBack = yWallTop; scaleBack = scaleFront }
    const hTiles    = wallScreenH / scaleFront
    const wBack     = b.fw * scaleBack * (b.overscale ?? 1.2)
    const cxBack    = pgr._colToScreenX(cxTile, backRow)
    const yRoofBack = yBack - hTiles * scaleBack

    ctx.drawImage(img, 0, wallSrcY, iw, wallSrcH,
      Math.round(cxFront - wFront / 2), Math.round(yWallTop),
      Math.round(wFront), Math.round(wallScreenH))

    const TL = { x: cxBack  - wBack  / 2, y: yRoofBack }
    const TR = { x: cxBack  + wBack  / 2, y: yRoofBack }
    const BL = { x: cxFront - wFront / 2, y: yWallTop }
    const BR = { x: cxFront + wFront / 2, y: yWallTop }
    pgr._drawAffineTriangle(ctx, img,
      { u: 0, v: 0 }, { u: iw, v: 0 }, { u: iw, v: wallSrcY }, TL, TR, BR)
    pgr._drawAffineTriangle(ctx, img,
      { u: 0, v: 0 }, { u: iw, v: wallSrcY }, { u: 0, v: wallSrcY }, TL, BR, BL)

    return [
      { x: cxFront - wFront / 2, y: yBase },
      { x: cxFront + wFront / 2, y: yBase },
      BR, TR, TL, BL,
    ]
  }

function drawBuildingDecal(pgr, ctx, b, cxTile, frontRow, os, horizonPx) {
    const img        = b.canvas
    const iw         = img.width, ih = img.height
    const widthTiles = b.fw * os
    const depthTiles = widthTiles * (ih / iw)
    const STRIPS     = 10
    let prev = null
    for (let i = 0; i <= STRIPS; i++) {
      const f   = i / STRIPS
      const row = frontRow - depthTiles * (1 - f)
      const y   = pgr._rowToScreenY(row)
      const s   = pgr._scaleAtRow(row)
      const cx  = pgr._colToScreenX(cxTile, row)
      const cur = (y === null || !(s > 0)) ? null
        : { y, cx, w: widthTiles * s, v: ih * f }
      if (prev && cur && cur.y > horizonPx - 4) {
        const TL = { x: prev.cx - prev.w / 2, y: prev.y }
        const TR = { x: prev.cx + prev.w / 2, y: prev.y }
        const BL = { x: cur.cx  - cur.w  / 2, y: cur.y }
        const BR = { x: cur.cx  + cur.w  / 2, y: cur.y }
        pgr._drawAffineTriangle(ctx, img,
          { u: 0, v: prev.v }, { u: iw, v: prev.v }, { u: iw, v: cur.v }, TL, TR, BR)
        pgr._drawAffineTriangle(ctx, img,
          { u: 0, v: prev.v }, { u: iw, v: cur.v }, { u: 0, v: cur.v }, TL, BR, BL)
      }
      prev = cur
    }
    const backRowD = frontRow - depthTiles
    const yF = pgr._rowToScreenY(frontRow), sF = pgr._scaleAtRow(frontRow)
    const yK = pgr._rowToScreenY(backRowD), sK = pgr._scaleAtRow(backRowD)
    if (yF === null || yK === null) return null
    const cxF = pgr._colToScreenX(cxTile, frontRow)
    const cxK = pgr._colToScreenX(cxTile, backRowD)
    return [
      { x: cxK - widthTiles * sK / 2, y: yK },
      { x: cxK + widthTiles * sK / 2, y: yK },
      { x: cxF + widthTiles * sF / 2, y: yF },
      { x: cxF - widthTiles * sF / 2, y: yF },
    ]
  }



// ── solid shapes seen in perspective (indoor rooms, furniture) ──────────────
// A point on the ground (col, row) lifted `up` tiles.
function lift(pgr, col, row, up) {
  const y = pgr._rowToScreenY(row), sc = pgr._scaleAtRow(row)
  if (y === null || !(sc > 0)) return null
  return { x: pgr._colToScreenX(col, row), y: y - up * sc }
}
// An image over a quad (TL, TR, BR, BL on screen), as two triangles.
function quad(pgr, ctx, img, sx, sy, sw, sh, TL, TR, BR, BL) {
  pgr._drawAffineTriangle(ctx, img, { u: sx, v: sy }, { u: sx + sw, v: sy }, { u: sx + sw, v: sy + sh }, TL, TR, BR)
  pgr._drawAffineTriangle(ctx, img, { u: sx, v: sy }, { u: sx + sw, v: sy + sh }, { u: sx, v: sy + sh }, TL, BR, BL)
}
// A vertical plane standing on column line `col`, from row r0 (u = 0) to row r1, `h` tiles high.
function drawVertPlane(pgr, ctx, img, col, r0, r1, h, h0 = 0) {
  const N = Math.max(4, Math.ceil((r1 - r0) * 3))
  for (let i = 0; i < N; i++) {
    const ra = r0 + (r1 - r0) * i / N, rb = r0 + (r1 - r0) * (i + 1) / N
    const a0 = lift(pgr, col, ra, h0), a1 = lift(pgr, col, ra, h)
    const b0 = lift(pgr, col, rb, h0), b1 = lift(pgr, col, rb, h)
    if (!a0 || !b0) continue
    quad(pgr, ctx, img, img.width * i / N, 0, img.width / N, img.height, a1, b1, b0, a0)
  }
}
// The inside face of a side wall: b = { x: the column line, y: back row, fd: rows deep, h: tiles high, src }
function drawWallPlane(pgr, ctx, b) {
  ctx.globalAlpha = 1
  drawVertPlane(pgr, ctx, b.canvas, b.x, b.y, b.y + b.fd, b.h)
}
// A vertical plane set slantwise across a corner, from ground point (x0, y0) to (x1, y1), `h` tiles high:
// b = { x0, y0, x1, y1, h, src }
function drawDiagPlane(pgr, ctx, b) {
  ctx.globalAlpha = 1
  const img = b.canvas, N = 8
  for (let i = 0; i < N; i++) {
    const ta = i / N, tb = (i + 1) / N
    const pa = { c: b.x0 + (b.x1 - b.x0) * ta, r: b.y0 + (b.y1 - b.y0) * ta }
    const pb = { c: b.x0 + (b.x1 - b.x0) * tb, r: b.y0 + (b.y1 - b.y0) * tb }
    const a0 = lift(pgr, pa.c, pa.r, 0), a1 = lift(pgr, pa.c, pa.r, b.h)
    const b0 = lift(pgr, pb.c, pb.r, 0), b1 = lift(pgr, pb.c, pb.r, b.h)
    if (!a0 || !b0) continue
    quad(pgr, ctx, img, img.width * i / N, 0, img.width / N, img.height, a1, b1, b0, a0)
  }
}
// A box: b = { x, y (back row), fw, fd, h, src (front face), top, side, z0 (it floats on something: the bed's sleeper) }
function drawCuboid(pgr, ctx, b) {
  ctx.globalAlpha = 1
  const x0 = b.x, x1 = b.x + b.fw, r0 = b.y, r1 = b.y + b.fd, h = b.h, z0 = b.z0 || 0
  const camCol = pgr._perspCamCol()
  const front = b.canvas, side = b.sideCanvas || b.canvas
  if (x0 > camCol) drawVertPlane(pgr, ctx, side, x0, r0, r1, h, z0)      // its left face, when it is right of centre
  if (x1 < camCol) drawVertPlane(pgr, ctx, side, x1, r0, r1, h, z0)
  if (b.topCanvas) {
    const t = b.topCanvas, N = Math.max(4, Math.ceil(b.fd * 4))
    for (let i = 0; i < N; i++) {
      const ra = r0 + b.fd * i / N, rb = r0 + b.fd * (i + 1) / N
      const TL = lift(pgr, x0, ra, h), TR = lift(pgr, x1, ra, h), BR = lift(pgr, x1, rb, h), BL = lift(pgr, x0, rb, h)
      if (!TL || !BL) continue
      quad(pgr, ctx, t, 0, t.height * i / N, t.width, t.height / N, TL, TR, BR, BL)
    }
  }
  const FL = lift(pgr, x0, r1, h), FR = lift(pgr, x1, r1, h), BRr = lift(pgr, x1, r1, z0), BLl = lift(pgr, x0, r1, z0)
  if (FL && BRr) quad(pgr, ctx, front, 0, 0, front.width, front.height, FL, FR, BRr, BLl)
}
