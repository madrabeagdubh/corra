#!/usr/bin/env python3
"""
patch_north_preview.py -- two fixes to the north-neighbour preview, both
visible from b1 looking at b0.

Run from repo root. Idempotent: every edit checks for its own result
first and skips if already applied. Anchored on identifiers, never on
comment prose.

(1) PALISADE RENDERED AS FOREST
    setNorthNeighborWallMask() bakes the neighbour's wallMask into
    trunks using the CURRENT scene's ForestEffects instance, with the
    CURRENT scene's tree options. b0's wallMask is 82 palisade posts;
    b0's own scene draws them as bare timber via getForestEffectsOptions
    (widthScale 0.18, branchScale 0). b1 has no such override, so from
    b1 the palisade came out as full leafy oaks -- a ring of trees
    around the rath that does not exist.

    Fixed with a per-map opt-out rather than a global kill: the other
    twelve north-previews (a2->a1, b2->b1, c2->c1, d2->d1 and so on) all
    point at genuine forest, and their trunks are correct and wanted.
    Only b0's wallMask means something other than trees.

(2) BUILDINGS DRAWN AS ONE OVERSIZED CONE
    drawNorthPreviewBuilding drew a single triangle from ground level to
    a hardcoded roofH of 4.2 (longhall) / 3.2 (other). The real
    buildings are wall + roof: longhall 2.2+2.3, tavern 2.1+2.0,
    dwelling 1.8+1.7. So the preview drew no wall at all, and made a
    cone taller than b0's entire hill (which peaks at 3.03) -- hence
    roofs apparently floating behind the ringfort with no building
    under them.

    Now reads KIND_STYLE straight from roundhouseRenderer.js, so preview
    and real geometry cannot drift. Still flat silhouettes, no facets or
    thatch texture -- that is deliberate at this distance.
"""

import json, os, re, sys

REPO_FILES = {
    'map':     'public/maps/bogMaps/b0.json',
    'scene':   'js/game/scenes/locations/perspectiveScene.js',
    'rhouse':  'js/game/effects/roundhouseRenderer.js',
    'preview': 'js/game/effects/pgr/pgrNorthPreview.js',
}


def read(p):
    with open(p) as f:
        return f.read()


def write(p, s):
    with open(p, 'w') as f:
        f.write(s)


def check_paths():
    missing = [p for p in REPO_FILES.values() if not os.path.exists(p)]
    if missing:
        sys.exit('not found (run from repo root): ' + ', '.join(missing))


# ── 1a. b0.json: declare that its wallMask is not trees ────────────────
def patch_map():
    p = REPO_FILES['map']
    data = json.load(open(p))
    if data.get('previewTrunks') is False:
        print('  [skip] b0.json already has previewTrunks: false')
        return
    data['previewTrunks'] = False
    json.dump(data, open(p, 'w'), indent=2)
    print('  [ok]   b0.json += previewTrunks: false')


# ── 1b. perspectiveScene.js: honour the flag ───────────────────────────
def patch_scene():
    p = REPO_FILES['scene']
    src = read(p)
    if 'previewTrunks' in src:
        print('  [skip] perspectiveScene.js already honours previewTrunks')
        return

    old = ("""          this.forestEffects?.setNorthNeighborWallMask(
            neighborMapData.wallMask ?? null, neighborMapData.height
          )""")
    if old not in src:
        sys.exit('  [FAIL] setNorthNeighborWallMask call site not found '
                 'in perspectiveScene.js -- file has moved on, patch by hand')

    new = ("""          // A neighbour whose wallMask is NOT trees (b0's is its palisade
          // ring) opts out with previewTrunks: false in its map JSON.
          // Trunks are baked with THIS scene's ForestEffects options, not
          // the neighbour's, so b0's bare-post overrides never applied and
          // the palisade came through as a ring of full oaks.
          this.forestEffects?.setNorthNeighborWallMask(
            neighborMapData.previewTrunks === false
              ? null
              : (neighborMapData.wallMask ?? null),
            neighborMapData.height
          )""")
    write(p, src.replace(old, new, 1))
    print('  [ok]   perspectiveScene.js honours previewTrunks')


# ── 2a. roundhouseRenderer.js: export the style table ──────────────────
def patch_roundhouse():
    p = REPO_FILES['rhouse']
    src = read(p)
    if 'export const KIND_STYLE' in src:
        print('  [skip] roundhouseRenderer.js already exports KIND_STYLE')
        return
    if 'const KIND_STYLE = {' not in src:
        sys.exit('  [FAIL] KIND_STYLE declaration not found in '
                 'roundhouseRenderer.js -- patch by hand')
    write(p, src.replace('const KIND_STYLE = {',
                         'export const KIND_STYLE = {', 1))
    print('  [ok]   roundhouseRenderer.js exports KIND_STYLE')


# ── 2b. pgrNorthPreview.js: wall + roof from the shared table ──────────
def patch_preview():
    p = REPO_FILES['preview']
    src = read(p)
    if 'KIND_STYLE' in src:
        print('  [skip] pgrNorthPreview.js already uses KIND_STYLE')
        return

    anchor = ("import { GID_CATEGORIES_GROUND, mirrorIndex } "
              "from './pgrShared.js'")
    if anchor not in src:
        sys.exit('  [FAIL] pgrShared import not found in pgrNorthPreview.js')
    src = src.replace(
        anchor,
        anchor + "\nimport { KIND_STYLE } from '../roundhouseRenderer.js'",
        1)

    # Everything from the old colour constants to end of the old function.
    start = src.index('  const HOUSE_BASE_COLOR')
    end = src.index('    pgr._gCtx.globalAlpha = 1.0\n  }\n', start) \
        + len('    pgr._gCtx.globalAlpha = 1.0\n  }\n')

    new_fn = r'''  // Daub wall and thatch roof, as flat silhouettes. Pulled from the
  // rgba wall colours in roundhouseRenderer's KIND_STYLE so the two
  // read as the same buildings; converted to HSL here because the haze
  // blend below interpolates in HSL.
  const WALL_BASE_COLOR = { h: 40, s: 29, l: 63 }
  const ROOF_BASE_COLOR = { h: 32, s: 30, l: 32 }

  // The roof oversails the wall a little, as thatch does -- without it
  // the silhouette reads as a box with a hat balanced on top.
  const EAVE_OVERHANG = 1.12

  // Anchored to the house's own world row (see the call site above), so
  // this only ever runs once per house per frame -- no need for its own
  // onscreen/culling check beyond the row match already done there.
  //
  // Heights come from KIND_STYLE, the SAME table RoundhouseRenderer uses
  // for the real geometry. They were hardcoded here as a single roofH of
  // 4.2/3.2 measured from the ground, which drew no wall at all and made
  // a cone taller than b0's whole hill (peak 3.03).
  function drawNorthPreviewBuilding(pgr, house, tileRow, localRow, yBotClamped, edgeAlpha, hazeT, columnOffset) {
    const style = KIND_STYLE[house.kind] ?? KIND_STYLE.dwelling
    const isLonghall = house.kind === 'longhall'
    // Longhall is a rectangle seen broadside from the south, so its
    // WIDTH is what shows; the round kinds use their radius.
    const footR = isLonghall ? (house.w ?? 6) / 2 : (house.r ?? 2)
    const eaveR = footR * EAVE_OVERHANG

    const scale = pgr._scaleAtRow(tileRow)
    // house.x is in the NEIGHBOUR's own coordinate space -- correct as-is
    // for sampling the neighbour's OWN heightmap, but needs columnOffset
    // subtracted before it's usable as a screen-projection column in
    // THIS map's space (see the fetch-time comment on columnOffset).
    const h = neighborVertexH(pgr, Math.round(house.x), localRow)
    const baseY = yBotClamped - h * scale

    const drawX   = house.x - columnOffset
    const xCenter = pgr._colToScreenX(drawX, tileRow)
    const xLeft   = pgr._colToScreenX(drawX - footR, tileRow)
    const xRight  = pgr._colToScreenX(drawX + footR, tileRow)
    const xEaveL  = pgr._colToScreenX(drawX - eaveR, tileRow)
    const xEaveR  = pgr._colToScreenX(drawX + eaveR, tileRow)

    const eaveY = baseY - style.wallH * scale
    const peakY = baseY - (style.wallH + style.roofH) * scale

    const HAZE_H = pgr.constructor.NORTH_HAZE_H
    const HAZE_S = pgr.constructor.NORTH_HAZE_S
    const HAZE_L = pgr.constructor.NORTH_HAZE_L
    const hazed = (c) => `hsl(${c.h + (HAZE_H - c.h) * hazeT},` +
                         `${c.s + (HAZE_S - c.s) * hazeT}%,` +
                         `${c.l + (HAZE_L - c.l) * hazeT}%)`

    const ctx = pgr._gCtx
    ctx.globalAlpha = edgeAlpha

    // Wall first, roof over it -- the roof's overhang should cover the
    // wall's top corners, not the other way round.
    ctx.fillStyle = hazed(WALL_BASE_COLOR)
    ctx.beginPath()
    ctx.moveTo(xLeft,  baseY)
    ctx.lineTo(xRight, baseY)
    ctx.lineTo(xRight, eaveY)
    ctx.lineTo(xLeft,  eaveY)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = hazed(ROOF_BASE_COLOR)
    ctx.beginPath()
    if (isLonghall) {
      // Hipped ridge rather than a point -- a rectangular hall read as a
      // cone otherwise, which is what made it hard to tell apart from
      // the roundhouses at this distance.
      const ridgeR  = footR * 0.34
      const xRidgeL = pgr._colToScreenX(drawX - ridgeR, tileRow)
      const xRidgeR = pgr._colToScreenX(drawX + ridgeR, tileRow)
      ctx.moveTo(xEaveL,  eaveY)
      ctx.lineTo(xRidgeL, peakY)
      ctx.lineTo(xRidgeR, peakY)
      ctx.lineTo(xEaveR,  eaveY)
    } else {
      ctx.moveTo(xEaveL,  eaveY)
      ctx.lineTo(xCenter, peakY)
      ctx.lineTo(xEaveR,  eaveY)
    }
    ctx.closePath()
    ctx.fill()

    ctx.globalAlpha = 1.0
  }
'''
    write(p, src[:start] + new_fn + src[end:])
    print('  [ok]   pgrNorthPreview.js draws wall + roof from KIND_STYLE')


if __name__ == '__main__':
    check_paths()
    print('north-preview patches:')
    patch_map()
    patch_scene()
    patch_roundhouse()
    patch_preview()
    print('done. rebuild with:')
    print('  NODE_OPTIONS=--max-old-space-size=3072 npm run build')
