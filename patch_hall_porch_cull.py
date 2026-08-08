#!/usr/bin/env python3
"""
patch_hall_porch_cull.py -- replace the portico canopy with posts that
carry the thatch eave, and stop both gable ends drawing at once.

Run from repo root, AFTER patch_hall_proportions.py. Idempotent.

(1) THATCH LANDING ON THE PORCH ROOF
    The eave tip sits at row 20.25, height 2.33. The portico canopy sits
    at height 2.05 spanning rows 19.8 to 21.0 -- so the overhang hangs
    INTO the canopy's airspace, 0.28 above it, roughly 23px of wall
    between them on screen. That is the "thatch crossing under the
    lintel": a horizontal canopy and an overhanging eave cannot occupy
    the same volume.

    Ribo's original instinct -- posts, no horizontal member -- was right,
    and my steer to keep a canopy was wrong. The canopy quad is gone. The
    two posts now stand at the eave TIP (y1 + eaveOverhang) and rise to
    exactly the eave height there, so they visibly carry the overhanging
    thatch instead of competing with it. That is also how the real thing
    is built.

    The wall-face lintel beam STAYS. It is flush with the wall, well
    below the eave, so it never had the collision -- it reads as a
    doorhead, not a porch roof.

    Post reach is bounded by construction: the roof plane falls
    roofH/(d/2) = 1.28 per row past the wall, so an overhang beyond about
    0.78 would drop the eave below the lintel at 1.9. At 0.45 it lands at
    2.33, clear of it. Worth remembering before increasing eaveOverhang.

(2) BOTH GABLE ENDS VISIBLE AT ONCE
    _collectLongHallRow pushes BOTH gable wall strips every frame, and
    _drawLongHallOverlay fills BOTH gable roof triangles, with no
    back-face test -- so standing square in front of the hall you see the
    inside faces of both ends splayed out either side. The round huts
    already cull this way (`if (midSin < -0.15) continue`); the longhall
    never got the equivalent.

    A gable at x is only genuinely visible when the camera column is
    outside it: west end when camCol < x0, east end when camCol > x1.
    Culling leaves no hole -- the two roof slope quads still meet at the
    ridge, and the end being dropped is the one facing away.

    The gable ornaments are NOT culled. They sit above the roof line and
    read as silhouette from any angle.
"""

import os, sys

RHOUSE = 'js/game/effects/roundhouseRenderer.js'


def edit(src, marker, old, new, label, out):
    if marker in src:
        out.append(f'  [skip] {label}')
        return src
    if old not in src:
        sys.exit(f'  [FAIL] anchor not found: {old[:70]}')
    out.append(f'  [ok]   {label}')
    return src.replace(old, new, 1)


def main():
    src = open(RHOUSE).read()
    out = []

    # ── 1. posts carry the eave; canopy removed ──────────────────────────
    src = edit(src, 'porchOut',
        """    const pw = Math.min(2.6, w * 0.3), pd = 1.2
    const px0 = cx - pw / 2, px1 = cx + pw / 2
    const py  = y1 + pd""",
        """    const pw = Math.min(2.6, w * 0.3)
    const px0 = cx - pw / 2, px1 = cx + pw / 2
    // Posts stand at the eave TIP and rise to exactly the eave height
    // there, so they carry the overhanging thatch. They used to stand
    // 1.2 out and hold up a horizontal canopy at 2.05 -- which the eave
    // then hung into, 0.28 above it, and the two read as one cheap slab.
    const ov       = style.eaveOverhang ?? 0
    const porchOut = ov > 0 ? ov : 0.35
    const halfD    = d / 2
    const py = y1 + porchOut""",
        'posts moved to the eave tip', out)

    src = edit(src, 'eave height at the post row',
        "    const ph  = Math.max(style.wallH * 0.68, doorH + 0.35)",
        """    // The eave height at the post row: the roof plane falls
    // roofH/(d/2) per row past the wall. Bounded below by the doorhead so
    // a large eaveOverhang can never bury the doorway -- past roughly
    // 0.78 here the plane would drop below the 1.9 lintel top.
    const ph  = Math.max(doorH + 0.25,
      style.wallH - (halfD > 0 ? porchOut * (style.roofH / halfD) : 0))""",
        'post height follows the eave plane', out)

    src = edit(src, 'No canopy quad',
        """    const attachL = this._projectGround(pgr, px0, y1), attachR = this._projectGround(pgr, px1, y1)
    const postL   = this._projectGround(pgr, px0, py),  postR   = this._projectGround(pgr, px1, py)
    if (!attachL || !attachR || !postL || !postR) return
    const sPost = pgr._scaleAtRow?.(py) ?? sSouth

    const attachLTop = { x: attachL.x, y: attachL.y - ph * sSouth }
    const attachRTop = { x: attachR.x, y: attachR.y - ph * sSouth }
    const postLTop   = { x: postL.x,   y: postL.y   - ph * sPost }
    const postRTop   = { x: postR.x,   y: postR.y   - ph * sPost }

    this._fillQuad(ctx, attachLTop, attachRTop, postRTop, postLTop, style.wallDark)

    const postW = style.postW ?? 0.12""",
        """    const postL = this._projectGround(pgr, px0, py), postR = this._projectGround(pgr, px1, py)
    if (!postL || !postR) return
    const sPost = pgr._scaleAtRow?.(py) ?? sSouth

    const postLTop = { x: postL.x, y: postL.y - ph * sPost }
    const postRTop = { x: postR.x, y: postR.y - ph * sPost }

    // No canopy quad -- see this patch's header. The thatch overhang IS
    // the porch roof now; these two only carry it.
    const postW = style.postW ?? 0.12""",
        'canopy removed, posts kept', out)

    # ── 2. gable back-face culling ───────────────────────────────────────
    src = edit(src, 'cullSide',
        """    // West gable wall (x=x0, spans y0..y1) -- this row's strip, if any.
    this._pushVerticalWallStrip(x0, y0, y1, tileRow, style.wallH, style.wallDark, entries)
    // East gable wall (x=x1) -- lighter tone, matches original shading choice.
    this._pushVerticalWallStrip(x1, y0, y1, tileRow, style.wallH,
      this._blend(style.wallDark, style.wallLight, 0.7), entries)""",
        """    // Gable ends are back-face culled: you can only genuinely see the west
    // end from west of it, and the east end from east of it. Both were
    // drawn unconditionally, so standing square in front of the hall
    // showed the INSIDE of both ends splayed out either side. The round
    // huts have always culled this way -- see midSin in _collectHutRow.
    this._pushVerticalWallStrip(x0, y0, y1, tileRow, style.wallH, style.wallDark, entries, 'west')
    this._pushVerticalWallStrip(x1, y0, y1, tileRow, style.wallH,
      this._blend(style.wallDark, style.wallLight, 0.7), entries, 'east')""",
        'gable wall strips culled', out)

    src = edit(src, 'gableVisible',
        """  _pushVerticalWallStrip(x, y0, y1, tileRow, wallH, color, entries) {
    const segY0 = Math.max(y0, tileRow), segY1 = Math.min(y1, tileRow + 1)
    if (segY1 <= segY0) return
    entries.push({
      draw: (ctx, pgr) => {
        const gA = this._projectGround(pgr, x, segY0), gB = this._projectGround(pgr, x, segY1)""",
        """  // cullSide: 'west' | 'east' | undefined. Tested inside draw(), not here,
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
        const gA = this._projectGround(pgr, x, segY0), gB = this._projectGround(pgr, x, segY1)""",
        'gableVisible helper added', out)

    src = edit(src, 'gableVisible(pgr, ex0',
        """    this._fillTri(ctx, tNW, tSW, ridgeW, this._blend(style.wallDark, style.wallLight, 0.85))
    this._fillTri(ctx, tNE, tSE, ridgeE, this._blend(style.wallDark, style.wallLight, 0.7))""",
        """    // Same back-face rule as the gable walls. Dropping the far end leaves
    // no hole: the two slope quads above still meet along the ridge.
    if (RoundhouseRenderer.gableVisible(pgr, ex0, 'west'))
      this._fillTri(ctx, tNW, tSW, ridgeW, this._blend(style.wallDark, style.wallLight, 0.85))
    if (RoundhouseRenderer.gableVisible(pgr, ex1, 'east'))
      this._fillTri(ctx, tNE, tSE, ridgeE, this._blend(style.wallDark, style.wallLight, 0.7))""",
        'gable roof triangles culled', out)

    open(RHOUSE, 'w').write(src)
    for line in out:
        print(line)


if __name__ == '__main__':
    if not os.path.exists(RHOUSE):
        sys.exit(f'{RHOUSE} not found -- run from repo root')
    print('hall porch + gable culling:')
    main()
    print('done. rebuild with:')
    print('  NODE_OPTIONS=--max-old-space-size=3072 npm run build')
