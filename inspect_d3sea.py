import json
d = json.load(open('public/maps/bogMaps/d3_sea.json'))
layer0 = d['layers'][0]
LAND = {839, 840, 731}
for y, row in enumerate(layer0):
    cols = [x for x, g in enumerate(row) if g in LAND]
    if cols:
        print(f'row {y}: land at cols {min(cols)}-{max(cols)} ({len(cols)} tiles)')
