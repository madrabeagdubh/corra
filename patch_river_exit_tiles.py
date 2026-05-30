#!/usr/bin/env python3
"""
Run from ~/Corra:
  python3 ~/Downloads/patch_river_exit_tiles.py

Updates the exits.tiles arrays to match the full river profile at each edge.
"""
import json
from pathlib import Path

MAPS_DIR = Path('public/maps/bogMaps')
WATER = {1625, 1679}
REED  = {731}
RIVER = WATER | REED

RIVER_EXITS = {
    'b3': ['west', 'east'],
    'c3': ['west', 'east'],
    'd3': ['west', 'east'],
    'a3': ['east'],
}

for mapname, exits in RIVER_EXITS.items():
    path = MAPS_DIR / f'{mapname}.json'
    if not path.exists():
        print(f'[{mapname}] not found'); continue

    with open(path) as f:
        m = json.load(f)

    layer0 = m['layers'][0]

    for direction in exits:
        edge_col = 0 if direction == 'west' else 35
        edge_row_n = 0 if direction == 'north' else 35

        # Find all rows that are river at the edge column
        river_rows = []
        for row in range(36):
            gid = layer0[row][edge_col]
            if gid in RIVER:
                river_rows.append(row)

        if not river_rows:
            print(f'[{mapname}] {direction}: no river tiles at edge, skipping')
            continue

        # Build new tiles list
        new_tiles = [[edge_col, row] for row in river_rows]
        old_tiles = m['exits'][direction]['tiles']
        m['exits'][direction]['tiles'] = new_tiles

        print(f'[{mapname}] {direction}: {len(old_tiles)} -> {len(new_tiles)} exit tiles (rows {river_rows[0]}-{river_rows[-1]})')

    # Also update border.openRows to include all river rows at west/east edges
    # so the walk grid allows passage
    all_river_rows = set()
    for direction in exits:
        for tx, ty in m['exits'][direction]['tiles']:
            if direction in ('west', 'east'):
                all_river_rows.add(ty)

    if all_river_rows and 'border' in m:
        existing = set(m['border'].get('openRows', []))
        merged = sorted(existing | all_river_rows)
        m['border']['openRows'] = merged
        print(f'[{mapname}] border.openRows updated: {merged}')

    with open(path, 'w') as f:
        json.dump(m, f, separators=(',', ':'))
    print(f'[{mapname}] saved')

print('\nDone.')
