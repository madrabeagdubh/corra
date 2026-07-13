import json
d = json.load(open('public/maps/bogMaps/d3_sea.json'))
layer0 = d['layers'][0]
layer1 = d['layers'][1]  # cliff/elevation GID layer (740 = cliff face)
LAND = {839, 840, 731}
for y in range(0, 12):
    for x in range(len(layer0[y])):
        if layer0[y][x] in LAND:
            elev_gid = layer1[y][x] if y < len(layer1) and x < len(layer1[y]) else 0
            has_cliff_nearby = any(
                layer1[yy][xx] == 740
                for yy in range(max(0,y-1), min(len(layer1), y+2))
                for xx in range(max(0,x-1), min(len(layer1[0]), x+2))
            )
            print(f'({x},{y}) gid={layer0[y][x]} layer1_here={elev_gid} cliff_nearby={has_cliff_nearby}')
