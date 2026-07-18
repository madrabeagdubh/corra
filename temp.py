#!/usr/bin/env python3
# patch_canopy_mass.py
# Adds "canopy mass" support: wallMask value 2 = a trunk-less foliage mound
# (the deep forest's canopy seen from outside), used by the a4-d4 threshold
# band. Value-2 cells block movement exactly like value-1 trees.
#
# Touches:
#   forestEffects.js        -- render value-2 cells as ground-anchored,
#                              clamped-radius foliage caps (no trunk/branches);
#                              new options canopyMassRadiusTiles /
#                              canopyMassMaxScreenFrac; north-preview support
#   perspectiveScene.js     -- collision: wallMask >= 1 blocks
#   riverScene.js           -- same
#   forest/testForest.js    -- same
#   undergrowthRenderer.js  -- skip flora/rocks/knolls on any nonzero cell
#
# Run from the repo root:  python3 patch_canopy_mass.py
# Idempotent: skips any edit whose new text is already present.

import sys

def edit(path, pairs):
    try:
        src = open(path, encoding='utf-8').read()
    except FileNotFoundError:
        sys.exit(f'FAIL: {path} not found -- run from the repo root.')
    changed = False
    for label, old, new, count in pairs:
        if new in src and (count == 1 or src.count(old) == 0):
            print(f'  SKIP (already applied): {label}')
            continue
        if src.count(old) != count:
            sys.exit(f'FAIL: {path}: expected {count} match(es) for "{label}", found {src.count(old)}.\n'
                     f'File has drifted from what this patch expects -- nothing written.')
        src = src.replace(old, new)
        changed = True
        print(f'  OK: {label}')
    if changed:
        open(path, 'w', encoding='utf-8').write(src)
        print(f'  Written: {path}')

# ── forestEffects.js ──────────────────────────────────────────────────────────
print('forestEffects.js:')
edit('js/game/effects/forestEffects.js', [
    (
        'canopy-mass options',
        """    this._canopyRadiusScale = options.canopyRadiusScale ?? 1.0""",
        """    this._canopyRadiusScale = options.canopyRadiusScale ?? 1.0

    // \u2500\u2500 Canopy-mass cells (wallMask value 2) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Cells marked 2 in the wallMask render as pure trunk-less foliage
    // mounds sitting on the ground line -- "the forest's canopy seen from
    // outside": e.g. the a4-d4 threshold band, where what should rise from
    // the bottom of the screen as the camera nears the forest is masses of
    // leaves, not a colonnade of trunks. They block movement exactly like
    // value-1 cells. Radius is tile-based (independent of widthScale) and
    // clamped to a fraction of the screen height so near-camera masses
    // stack as mounds instead of whiting out the whole view.
    this._canopyMassRadiusTiles   = options.canopyMassRadiusTiles   ?? 2.2
    this._canopyMassMaxScreenFrac = options.canopyMassMaxScreenFrac ?? 0.4""",
        1,
    ),
    (
        'mask bake: isWall >= 1',
        """    const isWall = (x, y) => (y >= 0 && y < mapH && x >= 0 && x < mapW) ? mask[y][x] === 1 : true""",
        """    const isWall = (x, y) => (y >= 0 && y < mapH && x >= 0 && x < mapW) ? mask[y][x] >= 1 : true""",
        1,
    ),
    (
        'mask bake: carry mass flag into shapes',
        """        positions.push([tx + 0.5, ty + 0.5])
      }
    }
    return positions.map(([tx, ty]) => this._buildTrunkShape(tx, ty))
  }

  _buildTrunkShape(tx, ty) {""",
        """        positions.push([tx + 0.5, ty + 0.5, mask[ty][tx] === 2])
      }
    }
    return positions.map(([tx, ty, mass]) => this._buildTrunkShape(tx, ty, mass))
  }

  _buildTrunkShape(tx, ty, canopyMass = false) {""",
        1,
    ),
    (
        'shape carries canopyMass flag',
        """      return { tx, ty, species, strokes, capFacets, capLayers }""",
        """      return { tx, ty, canopyMass, species, strokes, capFacets, capLayers }""",
        1,
    ),
    (
        'north preview: isWall >= 1',
        """    const isWall = (x, y) => (y >= 0 && y < mapH && x >= 0 && x < mapW) ? wallMask[y][x] === 1 : true""",
        """    const isWall = (x, y) => (y >= 0 && y < mapH && x >= 0 && x < mapW) ? wallMask[y][x] >= 1 : true""",
        1,
    ),
    (
        'north preview: pass mass flag',
        """        const worldTy = (ty + 0.5) - neighborHeight
        const trunk = this._buildTrunkShape(tx + 0.5, worldTy)""",
        """        const worldTy = (ty + 0.5) - neighborHeight
        const trunk = this._buildTrunkShape(tx + 0.5, worldTy, wallMask[ty][tx] === 2)""",
        1,
    ),
    (
        'drawTrunk: canopy-mass branch',
        """    ctx.globalAlpha = alpha

    const groundY = screenY + widthPx * ForestEffects.TRUNK_UNDERGROUND_EXTEND_PX_MUL""",
        """    ctx.globalAlpha = alpha

    // Canopy-mass cells (wallMask 2): no trunk, no branches -- just the
    // foliage cap sitting on the ground line, radius tile-based and clamped
    // so near-camera masses read as stacked mounds of leaves rather than
    // one full-screen sheet.
    if (trunk.canopyMass) {
      const rawR = anchor.scale * this._canopyMassRadiusTiles
      const capRadius = Math.min(rawR, this._sh * this._canopyMassMaxScreenFrac)
      this._drawFoliageCap(ctx, trunk, screenX, screenY, 0, alpha, pgr, capRadius)
      ctx.globalAlpha = 1.0
      return
    }

    const groundY = screenY + widthPx * ForestEffects.TRUNK_UNDERGROUND_EXTEND_PX_MUL""",
        1,
    ),
    (
        '_drawFoliageCap: radius override param',
        """  _drawFoliageCap(ctx, trunk, screenX, topY, widthPx, alpha, pgr) {
    const capRadius = widthPx * ForestEffects.CAP_RADIUS_WIDTH_MUL * this._canopyRadiusScale""",
        """  _drawFoliageCap(ctx, trunk, screenX, topY, widthPx, alpha, pgr, radiusOverride = null) {
    const capRadius = radiusOverride ?? (widthPx * ForestEffects.CAP_RADIUS_WIDTH_MUL * this._canopyRadiusScale)""",
        1,
    ),
    (
        'getTrunkScreenBounds: canopy-mass branch',
        """    const { screenX, screenY, widthPx, heightPx } = anchor

    const capRadius = widthPx * ForestEffects.CAP_RADIUS_WIDTH_MUL * this._canopyRadiusScale""",
        """    const { screenX, screenY, widthPx, heightPx } = anchor

    // Canopy masses: bounds mirror the ground-anchored, clamped-radius cap
    // drawn by drawTrunk()'s canopyMass branch.
    if (trunk.canopyMass) {
      const rawR = anchor.scale * this._canopyMassRadiusTiles
      const capRadius = Math.min(rawR, this._sh * this._canopyMassMaxScreenFrac)
      return {
        screenX, capRadius,
        topY:  screenY - capRadius * (1 + ForestEffects.CAP_HEIGHT_OFFSET_MUL),
        footY: screenY,
      }
    }

    const capRadius = widthPx * ForestEffects.CAP_RADIUS_WIDTH_MUL * this._canopyRadiusScale""",
        1,
    ),
])

# ── Collision: any nonzero wallMask cell blocks ───────────────────────────────
print('perspectiveScene.js:')
edit('js/game/scenes/locations/perspectiveScene.js', [
    (
        'collision: wallMask >= 1',
        """    if (this.mapData?.wallMask?.[ty]?.[tx] === 1) return true""",
        """    if (this.mapData?.wallMask?.[ty]?.[tx] >= 1) return true""",
        1,
    ),
])

print('riverScene.js:')
edit('js/game/scenes/locations/riverScene.js', [
    (
        'collision: wallMask >= 1',
        """    if (this.mapData?.wallMask?.[ty]?.[tx] === 1) return true""",
        """    if (this.mapData?.wallMask?.[ty]?.[tx] >= 1) return true""",
        1,
    ),
])

print('testForest.js:')
edit('js/game/scenes/locations/forest/testForest.js', [
    (
        'collision: wallMask >= 1',
        """    return mask[ty][tx] === 1""",
        """    return mask[ty][tx] >= 1""",
        1,
    ),
])

print('undergrowthRenderer.js:')
edit('js/game/effects/undergrowthRenderer.js', [
    (
        'skip flora/rocks/knolls on any tree cell (3 sites)',
        """if (mask[ty][tx] === 1) continue""",
        """if (mask[ty][tx] >= 1) continue""",
        3,
    ),
])

print('Done.')

