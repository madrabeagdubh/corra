#!/usr/bin/env python3
"""
patch_hall_proportions.py -- taller hall walls, an overhanging thatch
eave, a wider hall and smaller flanking huts.

Run from repo root, AFTER patch_hall_polish.py. Idempotent.

(1) WALL HEIGHT 2.2 -> 2.9
    The real cause of the cramped, cheap-looking frontage. At 2.2 the
    stack was door 1.70 / lintel 0.20 / bare wall 0.30 -- 14% of the wall
    left above the doorway, so the thatch appeared to rest on the door
    frame. At 2.9 that becomes 1.00, and the portico canopy (which sizes
    itself to max(wallH * 0.68, doorH + 0.35) = 2.05) drops from 0.15
    below the eave to 0.85, so canopy and roof stop merging.

    It also improves the wall:roof ratio from 2.2:2.3 to 2.9:2.3, which
    is most of why the building read as all roof.

(2) EAVE OVERHANG
    Separate from the cramping, and arguably the bigger offender: the
    thatch stopped EXACTLY at the wall top, flush, like a lid on a box.
    Real thatch projects well past the wall and throws a shadow line.

    The roof plane now extends `eaveOverhang` past all four sides and
    continues down its own existing slope (roofH over d/2), so the wall
    top still lands exactly on that plane and the gable triangles still
    cover the gable ends with no seam -- the overhung corner is on the
    same line the wall top was already on.

    Set eaveOverhang to 0 in KIND_STYLE to revert this alone; every other
    change here is independent of it.

    The round huts are NOT given an overhang -- their roof is a cone
    assembled a different way in _drawHutOverlay, and that is a separate
    piece of work. The hall being the more finely built structure is a
    defensible reading in the meantime.

(3) FOOTPRINTS
    Hall w 7 -> 9.5, d 3.2 -> 3.6. Huts r 2.6 -> 2.0 and 2.4 -> 1.8.

    Row arithmetic re-checked, since the door depends on it: the hall's
    y1 becomes 19.8, which still rounds to row 20, and its span (d/2 + 1
    = 2.8) still collects row 20. The huts' doorways move to rows 25 and
    24 and both stay inside their own spans.

    The portico widens on its own -- pw is min(2.6, w * 0.3), which was
    clamped at 2.1 and now reaches its 2.6 ceiling. Door width is
    deliberately NOT raised with it: at 1.5 wide by 1.7 high it stays
    portrait, and a wider one would read as a barn opening.

KNOCK-ON WORTH KNOWING
    The hall's ridge goes from 4.5 to 5.2 world units. It sits on b0's
    hill, which peaks at 3.03, so in the b1 north preview the silhouette
    rises from 6.93 to 8.2. That is consistent with what you would see
    standing in b0 -- but it will loom more from the south approach.
"""

import json, os, sys

RHOUSE = 'js/game/effects/roundhouseRenderer.js'
MAP    = 'public/maps/bogMaps/b0.json'

HOUSE_SIZES = {
    'longhall': {'w': 9.5, 'd': 3.6},
    'tavern':   {'r': 2.0},
    'house_1':  {'r': 1.8},
}


def patch_renderer():
    src = open(RHOUSE).read()

    # ── wall height + overhang on the longhall style ─────────────────────
    if 'eaveOverhang' not in src:
        old = "    wallH: 2.2, roofH: 2.3,\n"
        if old not in src:
            sys.exit('  [FAIL] longhall wallH/roofH line not found')
        src = src.replace(old,
            "    wallH: 2.9, roofH: 2.3,\n"
            "    // How far the thatch projects past the wall on every side. It\n"
            "    // continues down the ridge->eave slope, so the wall top still\n"
            "    // sits exactly on the roof plane. 0 restores the old flush eave.\n"
            "    eaveOverhang: 0.45,\n", 1)
        print('  [ok]   longhall wallH 2.2 -> 2.9, eaveOverhang 0.45')
    else:
        print('  [skip] longhall style already updated')

    # ── roof geometry honours the overhang ───────────────────────────────
    if 'eaveH' not in src:
        old = """    const gNW = this._projectGround(pgr, x0, y0), gNE = this._projectGround(pgr, x1, y0)
    const gSW = this._projectGround(pgr, x0, y1), gSE = this._projectGround(pgr, x1, y1)
    if (!gNW || !gNE || !gSW || !gSE) return
    const sNorth = pgr._scaleAtRow?.(y0) ?? 0, sSouth = pgr._scaleAtRow?.(y1) ?? 0"""
        new = """    // Roof corners sit OUTSIDE the wall by `ov` on all four sides, at the
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
    const sNorth = pgr._scaleAtRow?.(ey0) ?? 0, sSouth = pgr._scaleAtRow?.(ey1) ?? 0"""
        if old not in src:
            sys.exit('  [FAIL] longhall roof corner projection not found')
        src = src.replace(old, new, 1)

        for a, b in [
            ("const tNW = { x: gNW.x, y: gNW.y - style.wallH * sNorth }",
             "const tNW = { x: gNW.x, y: gNW.y - eaveH * sNorth }"),
            ("const tNE = { x: gNE.x, y: gNE.y - style.wallH * sNorth }",
             "const tNE = { x: gNE.x, y: gNE.y - eaveH * sNorth }"),
            ("const tSW = { x: gSW.x, y: gSW.y - style.wallH * sSouth }",
             "const tSW = { x: gSW.x, y: gSW.y - eaveH * sSouth }"),
            ("const tSE = { x: gSE.x, y: gSE.y - style.wallH * sSouth }",
             "const tSE = { x: gSE.x, y: gSE.y - eaveH * sSouth }"),
            ("const gRidgeW = this._projectGround(pgr, x0, cy), "
             "gRidgeE = this._projectGround(pgr, x1, cy)",
             "const gRidgeW = this._projectGround(pgr, ex0, cy), "
             "gRidgeE = this._projectGround(pgr, ex1, cy)"),
            ("const repV = Math.max(1, Math.round((d / 2) / TILE_TARGET))",
             "// Slope is longer than d/2 once it overhangs -- repeat count\n"
             "    // follows it, or the thatch courses stretch near the eave.\n"
             "    const repV = Math.max(1, Math.round((halfD + ov) / TILE_TARGET))"),
            # sSouth is now the scale at the OVERHUNG row; the portico
            # attaches at the wall plane, so hand it that scale explicitly.
            ("this._drawPortico(pgr, ctx, house, style, sSouth)",
             "this._drawPortico(pgr, ctx, house, style, pgr._scaleAtRow?.(y1) ?? sSouth)"),
        ]:
            if a not in src:
                sys.exit(f'  [FAIL] anchor not found: {a[:60]}')
            src = src.replace(a, b, 1)
        print('  [ok]   roof, ridge and gables honour eaveOverhang')
        print('  [ok]   portico re-anchored to the wall plane scale')
    else:
        print('  [skip] roof geometry already honours the overhang')

    open(RHOUSE, 'w').write(src)


def patch_map():
    data = json.load(open(MAP))
    changed = []
    for h in data.get('houses', []):
        want = HOUSE_SIZES.get(h['id'])
        if not want:
            continue
        for k, v in want.items():
            if h.get(k) != v:
                h[k] = v
                changed.append(f"{h['id']}.{k} -> {v}")
    if not changed:
        print('  [skip] b0.json footprints already set')
        return
    json.dump(data, open(MAP, 'w'), indent=2)
    for c in changed:
        print(f'  [ok]   {c}')


if __name__ == '__main__':
    for p in (RHOUSE, MAP):
        if not os.path.exists(p):
            sys.exit(f'{p} not found -- run from repo root')
    print('hall proportions:')
    patch_renderer()
    patch_map()
    print('done. rebuild with:')
    print('  NODE_OPTIONS=--max-old-space-size=3072 npm run build')
