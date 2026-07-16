import json

W, H = 36, 42

def water_row(y):
    return [1625 if (x + y) % 2 == 0 else 1679 for x in range(W)]

def zero_row():
    return [0] * W

layer0 = [water_row(y) for y in range(H)]
layer1 = [zero_row() for _ in range(H)]
layer2 = [zero_row() for _ in range(H)]
layer3 = [zero_row() for _ in range(H)]

d = {
    "name": "d3_sea",
    "width": W,
    "height": H,
    "layers": [layer0, layer1, layer2, layer3],
    "hasCliffs": False,
    "legend": {"0": "overlay", "731": "waterside", "839": "grass", "1625": "water", "1679": "water"},
    "spawns": {"player": {"x": 18, "y": 21}},
    "exits": {
        "west": {
            "tiles": [[0, y] for y in range(6, 21)],
            "destination": "d3",
            "entryPoint": "east"
        },
        "east": {
            "tiles": [[35, y] for y in range(6, 30)],
            "destination": "d3_open_sea",
            "entryPoint": "west"
        }
    },
    "entries": {
        "west": {"x": 3, "y": 13, "yFromSource": True},
        "east": {"x": 32, "y": 18, "yFromSource": True}
    },
    "border": {
        "openCols": [],
        "openRows": [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]
    }
}

with open('public/maps/bogMaps/d3_sea.json', 'w') as f:
    json.dump(d, f)

print("Wrote minimal water-only d3_sea.json")
print(f"layers: {len(d['layers'])}, each {H} rows x {W} cols")
