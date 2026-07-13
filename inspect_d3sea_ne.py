import json
d = json.load(open('public/maps/bogMaps/d3_sea.json'))
layer0 = d['layers'][0]
layer1 = d['layers'][1]
LAND = {839, 840, 731}

print('    ' + ''.join(str(c%10) for c in range(20, 36)))
for y in range(0, 15):
    line = ''
    for x in range(20, 36):
        g0 = layer0[y][x] if y < len(layer0) and x < len(layer0[y]) else 0
        g1 = layer1[y][x] if y < len(layer1) and x < len(layer1[y]) else 0
        if g1 == 740:
            line += '#'
        elif g0 in LAND:
            line += 'o'
        elif g0 in (1625, 1679):
            line += '.'
        else:
            line += ' '
    print(f'{y:2d}: {line}')
print()
print('# = cliff face   o = grass/waterside land   . = water   (blank) = void')
