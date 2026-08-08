#!/usr/bin/env python3
"""
patch_b0_road.py -- give b0 a pathDist road so the b1 approach continues
into the rath instead of stopping dead at the map boundary.

Run from repo root. Idempotent: rewrites b0.json's pathDist every time
from the centreline below, so re-running after tweaking ROAD or
TINT_FALLOFF just replaces it.

WHY pathDist AND NOT TILES
  The road is not a tileset GID anywhere in this project. b1 has no road
  tiles either -- its whole road is TintManager.getGroundTint()'s mud
  blend, driven by a pathDist field where 0 = centreline and 1 = beyond
  the falloff. b0 simply had no pathDist key, so the preview's
  `nb.pathDist?.[localRow]?.[mCol] ?? null` returned null and no mud was
  ever blended. Same formula as _pathShared.mjs's carvePathCorridor:
  pathDist = clamp(distance / tintFalloff, 0, 1).

  TINT_FALLOFF matches b1's generator (7) so the two sides of the
  boundary blend at the same rate. Change both or neither.

WALLMASK IS NOT TOUCHED
  carvePathCorridor also zeroes wallMask within halfWidth, to punch a
  corridor through trees. b0's wallMask is the palisade, and its south
  arc is ALREADY open from x=22..33 at row 38 -- the road runs straight
  through that gate at x=27.5. Carving here would delete posts that are
  meant to stand.
"""

import json, math, os, sys

MAP = 'public/maps/bogMaps/b0.json'

# Centreline in tile coordinates, south edge -> through the south gate ->
# a short way into the village. b0's entries.south is x=27, the palisade's
# south gap spans x=22..33 (centre 27.5), and the north gate sits at x=27-28,
# so a straight run up x=27.5 threads all three without a bend.
#
# The north end (y=30) is inside the ring but stops short of the buildings
# (longhall y=18, house_1 y=22, tavern y=23) -- far enough to read as
# "the road reaches the rath", not so far it mud-tints the whole green.
# Raise or lower that one number to taste.
ROAD = [(27.5, 56.0), (27.5, 30.0)]

TINT_FALLOFF = 7.0


def seg_dist(px, py, ax, ay, bx, by):
    """Distance from point to line SEGMENT (not infinite line)."""
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def main():
    if not os.path.exists(MAP):
        sys.exit(f'{MAP} not found -- run from repo root')

    with open(MAP) as f:
        data = json.load(f)

    W, H = data['width'], data['height']

    pathDist = []
    for y in range(H):
        row = []
        for x in range(W):
            # Tile CENTRE, matching how pathDist is sampled per-tile.
            cx, cy = x + 0.5, y + 0.5
            d = min(seg_dist(cx, cy, *ROAD[i], *ROAD[i + 1])
                    for i in range(len(ROAD) - 1))
            row.append(round(max(0.0, min(1.0, d / TINT_FALLOFF)), 6))
        pathDist.append(row)

    existed = 'pathDist' in data
    data['pathDist'] = pathDist

    with open(MAP, 'w') as f:
        json.dump(data, f, indent=2)

    on_path = sum(1 for r in pathDist for v in r if v < 0.35)
    print(f'{"replaced" if existed else "added"} pathDist on {MAP} '
          f'({W}x{H}, {on_path} tiles at <0.35)')


if __name__ == '__main__':
    main()
