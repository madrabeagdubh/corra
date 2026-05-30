import json, copy, sys

TREE_GIDS = {
    260,261,262,263,264,265,266,267,268,
    314,315,316,317,318,319,320,321,322,
    368,369,370,371,372,373,374,375,376,
    422,423,424,425,426,427,428,429,430,
    476,477,478,479,480,481,482,483,484,
    208,209,211
}

WATER_GIDS = {1625, 1679}
SHORE_GID  = 731
GRASS_GIDS = {839, 840}
GRASS      = 839

def fix_map(data):
    L0 = copy.deepcopy(data['layers'][0])
    L1 = data['layers'][1]
    H  = data['height']
    W  = data['width']
    border    = data.get('border', {})
    open_cols = set(border.get('openCols', []))
    open_rows = set(border.get('openRows', []))
    changed   = 0

    def is_water(g):  return g in WATER_GIDS
    def is_ws(g):     return g in WATER_GIDS or g == SHORE_GID

    # 1. North/south border corridor tiles -> grass
    for col in open_cols:
        for row in [0, H-1]:
            if L0[row][col] not in GRASS_GIDS:
                L0[row][col] = GRASS; changed += 1

    # 2. West/east border corridor tiles that are water/shore -> grass
    for row in open_rows:
        for col in [0, W-1]:
            if is_ws(L0[row][col]):
                L0[row][col] = GRASS; changed += 1

    # 3. Grass under tree tiles in layer 1
    for y in range(H):
        for x in range(W):
            if L1[y][x] in TREE_GIDS and L0[y][x] not in GRASS_GIDS:
                L0[y][x] = GRASS; changed += 1

    # 4. Widen water: shore tiles with >=2 water neighbours become water
    L0b = copy.deepcopy(L0)
    for y in range(1, H-1):
        for x in range(1, W-1):
            if L0[y][x] != SHORE_GID: continue
            nbrs = [L0[y-1][x], L0[y+1][x], L0[y][x-1], L0[y][x+1]]
            wn = sum(1 for g in nbrs if is_water(g))
            if wn >= 2:
                L0b[y][x] = 1625; changed += 1

    data = dict(data)
    data['layers'] = [L0b, L1]
    return data, changed

import os
BASE = 'maps/bogMaps'
MAPS = ['a3','b3','c3','d3']

for mapname in MAPS:
    path = f'{BASE}/{mapname}.json'
    if not os.path.exists(path):
        print(f'{mapname}: NOT FOUND at {path}')
        continue
    with open(path) as f:
        data = json.load(f)
    fixed, n = fix_map(data)
    with open(path,'w') as f:
        json.dump(fixed, f, separators=(',',':'))
    print(f'{mapname}: {n} tiles changed')

print('all done')
