import json
d = json.load(open('public/maps/bogMaps/d3_sea.json'))

WATER = {0, 1625, 1679}
for li, layer in enumerate(d['layers']):
    for y, row in enumerate(layer):
        for x, g in enumerate(row):
            if g not in WATER:
                print(f'layer{li} ({x},{y}) gid={g}')
