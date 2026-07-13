import json
path = 'public/maps/bogMaps/d3_sea.json'
d = json.load(open(path))
layer0 = d['layers'][0]
LAND = {839, 840, 731}

changed = 0
for y in range(1, 11):          # rows 1-10 inclusive — the NW wedge only
    for x in range(len(layer0[y])):
        if layer0[y][x] in LAND:
            layer0[y][x] = 1625 if (x + y) % 2 == 0 else 1679
            changed += 1

json.dump(d, open(path, 'w'))
print(f'Replaced {changed} land tiles with water in rows 1-10.')
