import json

W, H = 14, 14

# Floor checkerboard (layer 0) -- same convention as bog maps
layer0 = [[839 if (x + y) % 2 == 0 else 840 for x in range(W)] for y in range(H)]

# Wall mask: True = oak tree cell (impassable), False = open floor
# Hand-drawn corridor: enter west-mid, wind down/right, open into a clearing, exit east-mid
wall = [[True]*W for _ in range(H)]

def carve(x, y):
    wall[y][x] = False

# West entry corridor (row 6-7) leading in from x=0
for x in range(0, 4):
    carve(x, 6); carve(x, 7)

# Turn south
for y in range(6, 10):
    carve(3, y); carve(4, y)

# Corridor east along row 9
for x in range(3, 8):
    carve(x, 9); carve(x, 8)

# Clearing (open room) around (8-10, 6-9)
for y in range(5, 10):
    for x in range(7, 11):
        carve(x, y)

# Exit corridor east from clearing to x=13 at row 6-7
for x in range(10, 14):
    carve(x, 6); carve(x, 7)

# ── Build layer1 (oak wall stamps) using simple 9-slice rule ──────────────
OAK = {
    'TL':260,'TC':261,'TR':262,
    'ML':314,'MC':315,'MR':316,
    'BL':368,'BC':369,'BR':370,
}

def is_wall(x, y):
    if x < 0 or x >= W or y < 0 or y >= H: return True
    return wall[y][x]

layer1 = [[0]*W for _ in range(H)]
for y in range(H):
    for x in range(W):
        if not wall[y][x]:
            continue
        n = is_wall(x, y-1)
        s = is_wall(x, y+1)
        w_ = is_wall(x-1, y)
        e = is_wall(x+1, y)
        if not n and not w_: layer1[y][x] = OAK['TL']
        elif not n and not e: layer1[y][x] = OAK['TR']
        elif not s and not w_: layer1[y][x] = OAK['BL']
        elif not s and not e: layer1[y][x] = OAK['BR']
        elif not n: layer1[y][x] = OAK['TC']
        elif not s: layer1[y][x] = OAK['BC']
        elif not w_: layer1[y][x] = OAK['ML']
        elif not e: layer1[y][x] = OAK['MR']
        else: layer1[y][x] = OAK['MC']

map_data = {
    "name": "testForest",
    "width": W,
    "height": H,
    "layers": [layer0, layer1],
    "spawns": { "player": { "x": 1, "y": 6 } },
    "legend": {
        "839":"grass","840":"grass",
        "260":"oak TL","261":"oak TC","262":"oak TR",
        "314":"oak ML","315":"oak MC","316":"oak MR",
        "368":"oak BL","369":"oak BC","370":"oak BR"
    }
}

with open('/home/claude/forest_proto/testForest.json', 'w') as f:
    json.dump(map_data, f)

# ASCII preview for sanity check
print("ASCII preview ('#' = wall, '.' = floor, '@' = spawn):")
for y in range(H):
    row = ''
    for x in range(W):
        if (x, y) == (1, 6):
            row += '@'
        else:
            row += '#' if wall[y][x] else '.'
    print(row)
