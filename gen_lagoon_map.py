"""
gen_lagoon_map.py
Generates the sunken-dolmen pond map (overwrites grove.json). Built by
adapting gen_grove_map.py's sparse angle-bucketed tree placement, plus:
  - A basin carved into the heightmap (NOT the grove's gentle rolling
    noise alone) -- a deliberate depression at the map centre, deep
    enough to hold standing water, narratively "the dolmen's weight plus
    rainy weather caused the ground to sink."
  - Water tiles (GIDs 1625/1679, same animated alternating pair PGR's
    own water-phase code already handles -- confirmed from d3_sea.json)
    placed wherever the basin depth exceeds a threshold.
  - A small ring of stepping-stone tiles crossing the water from the
    nearest dry-ground approach to the dolmen's anchor point.
  - Asymmetric tree density: denser in the NE/NW arc, sparser SE/S/W,
    rather than the grove's uniform ring -- per explicit direction.
  - The dolmen's anchor point recorded in the map JSON (dolmenAnchor)
    so the scene file knows where to construct DolmenRenderer.

Map size 40x40 (up from the grove's 24x24) -- explicitly larger so
approaching from the edges feels like a real walk, not an instant arrival.
"""
import json
import math
import random

random.seed(314)

W, H = 40, 40
CENTER = (20, 20)
POND_RADIUS = 6.5   # was 4.5 -- bigger lake, per direct feedback ("maybe
                     # we should make it a bit bigger")

wall_mask = [[0 for _ in range(W)] for _ in range(H)]
layer0 = [[839 if (x+y) % 2 == 0 else 840 for x in range(W)] for y in range(H)]
layer1 = [[0 for _ in range(W)] for _ in range(H)]

WATER_GID_A = 1625
WATER_GID_B = 1679

# ── Basin heightmap (carved depression, not gentle rolling noise) ───────────
# Reuses the same multi-octave value-noise technique as
# gen_forest_heightmap.mjs for the SURROUNDING terrain's gentle
# undulation, then SUBTRACTS a radial basin function centred on the
# dolmen so the middle genuinely sinks well below the surrounding
# ground -- the noise alone (as used for the grove) never dips low
# enough to read as "the ground gave way here."
VW, VH = W + 1, H + 1
HEIGHT_AMP = 0.7
BASELINE_SHIFT = 0.55
BASIN_DEPTH = 3.2          # was 1.6 -- much more dramatic sunken bowl, per
# explicit direction ("allow more variation in heights, to really sink
# the water down into a bowl"). Note HEIGHT_AMP itself is only 0.7, so
# this depth substantially exceeds the surrounding terrain's own natural
# variation -- intentional, since the basin should read as a clear
# anomaly (the ground gave way here) against otherwise gentle terrain.
BASIN_RADIUS = POND_RADIUS + 3.0   # basin is wider than the water itself,
                                     # so the depression reads as a real
                                     # sunken bowl, not a sudden pit exactly
                                     # at the water's edge

OCTAVES = [
    {"scale": 0.12, "amp": 1.00},
    {"scale": 0.28, "amp": 0.45},
    {"scale": 0.55, "amp": 0.20},
]
TOTAL_AMP = sum(o["amp"] for o in OCTAVES)

def corner_hash(gx, gy):
    s = (gx * 374761393 + gy * 1103515245) & 0xffffffff
    s ^= (s >> 16); s = (s * 0x45d9f3b) & 0xffffffff
    s ^= (s >> 16); s = (s * 0x45d9f3b) & 0xffffffff
    s ^= (s >> 16)
    return (s & 0xffff) / 0xffff

def value_noise(nx, ny, scale):
    gx0 = int(nx * scale); gy0 = int(ny * scale)
    gx1, gy1 = gx0 + 1, gy0 + 1
    fx = nx * scale - gx0; fy = ny * scale - gy0
    sfx = fx * fx * (3 - 2 * fx); sfy = fy * fy * (3 - 2 * fy)
    return (
        corner_hash(gx0, gy0) * (1 - sfx) * (1 - sfy) +
        corner_hash(gx1, gy0) * sfx       * (1 - sfy) +
        corner_hash(gx0, gy1) * (1 - sfx) * sfy +
        corner_hash(gx1, gy1) * sfx       * sfy
    )

def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)

height_map = []
for vy in range(VH):
    row = []
    for vx in range(VW):
        v = 0.0
        for o in OCTAVES:
            v += (value_noise(vx, vy, o["scale"]) * 2 - 1) * o["amp"]
        v /= TOTAL_AMP
        v_shifted = v + BASELINE_SHIFT
        base_h = max(0, min(HEIGHT_AMP, v_shifted * HEIGHT_AMP))

        # Basin subtraction: distance from centre, smoothly interpolated
        # so the depression has a gentle sloped rim rather than a hard
        # cliff edge -- you walk DOWN into it, not fall off a step.
        dist = math.hypot(vx - CENTER[0], vy - CENTER[1])
        basin_t = 1 - smoothstep(0, BASIN_RADIUS, dist)  # 1 at centre, 0 at/past radius
        h = base_h - BASIN_DEPTH * basin_t
        row.append(round(max(0.0, h), 4))  # clamp at 0 -- PGR doesn't expect negative heights
    height_map.append(row)

# ── Water placement ──────────────────────────────────────────────────────────
# Any TILE (not vertex) whose four corners average below a depth
# threshold gets a water GID instead of grass. Threshold chosen so water
# appears within roughly POND_RADIUS of centre, derived empirically from
# the basin function rather than hardcoding a separate water-radius that
# could drift out of sync with the actual terrain shape.
def tile_avg_height(tx, ty):
    return (height_map[ty][tx] + height_map[ty][tx+1] +
            height_map[ty+1][tx] + height_map[ty+1][tx+1]) / 4.0

WATER_HEIGHT_THRESHOLD = 0.12   # tiles below this average height become water
WATER_HARD_RADIUS = POND_RADIUS + 1.0   # water can ONLY exist within this
# distance of centre, regardless of height -- a first version let ANY
# low-noise spot on the map become water if it happened to dip below the
# threshold, producing stray disconnected ponds at map corners unrelated
# to the dolmen's basin at all (confirmed visually). The basin's radial
# falloff already guarantees centre-ward tiles are lower, but ambient
# noise elsewhere on a 40x40 map can still independently dip low by
# chance -- this hard radius is the actual fix, not just a tighter
# threshold (which wouldn't have prevented the stray ponds, only
# shrunk them).

water_tiles = set()
for ty in range(H):
    for tx in range(W):
        dist = math.hypot(tx + 0.5 - CENTER[0], ty + 0.5 - CENTER[1])
        if dist > WATER_HARD_RADIUS:
            continue
        if tile_avg_height(tx, ty) < WATER_HEIGHT_THRESHOLD:
            water_tiles.add((tx, ty))
            wall_mask[ty][tx] = 1   # water is unwalkable by default --
                                     # stepping stones below punch through

print(f"Water tiles: {len(water_tiles)}")

# ── Stepping stones ──────────────────────────────────────────────────────────
# A straight-ish line of discrete walkable tiles from the nearest dry
# ground (south, since the player's natural approach/spawn direction in
# the grove precedent was also south) to the dolmen anchor at centre.
# Stepping stones punch THROUGH the water's wallMask=1 by re-clearing
# those specific cells to 0, and are recorded separately (steppingStones
# key) so the scene/renderer can draw them distinctly from open water.
DOLMEN_ANCHOR = CENTER  # dolmen sits exactly at map centre

def stepping_stone_path(start, end, step_spacing=1.4, jitter=0.18):
    """Generates stone positions along a slightly irregular line from
    start to end -- not perfectly straight, real stepping stones don't
    line up in a ruler-straight row."""
    sx, sy = start
    ex, ey = end
    dist = math.hypot(ex - sx, ey - sy)
    count = max(2, int(dist / step_spacing))
    stones = []
    for i in range(count + 1):
        t = i / count
        x = sx + (ex - sx) * t + random.uniform(-jitter, jitter)
        y = sy + (ey - sy) * t + random.uniform(-jitter, jitter)
        stones.append((x, y))
    return stones

# Approach point: just south of the pond's edge, dry ground.
approach_start = (CENTER[0], CENTER[1] + WATER_HARD_RADIUS + 1.5)
stone_positions = stepping_stone_path(approach_start, DOLMEN_ANCHOR)

stepping_stones = []
for (sx, sy) in stone_positions:
    tx, ty = int(round(sx)), int(round(sy))
    if 0 <= tx < W and 0 <= ty < H:
        wall_mask[ty][tx] = 0   # punch through water's unwalkable flag
        stepping_stones.append([tx, ty])

print(f"Stepping stones placed: {len(stepping_stones)}")

# ── Asymmetric tree placement ────────────────────────────────────────────────
# Same angle-bucketed approach as gen_grove_map.py (one tree per angular
# sector with jitter, avoiding the clustering a pure-random first attempt
# produced there) -- but with PER-SECTOR density weighting instead of
# uniform distribution: NE/NW arc gets a tree in nearly every sector,
# SE/S/W arc skips most sectors, producing the requested "densely wooded
# NE to NW, sparse SE/S/W" gradient rather than an even ring.
TREE_BAND_INNER = WATER_HARD_RADIUS + 2.0
TREE_BAND_OUTER = TREE_BAND_INNER + 10.0   # wide band, since this is a much
                                             # bigger map than the grove
MIN_TREE_SPACING = 1.8

def sector_keep_chance(angle_rad):
    """Returns keep-probability for a sector at this angle. 0 rad = east,
    increasing counter-clockwise (standard atan2 convention, screen-Y-down
    so this is mathematical CCW in screen space) -- dense arc spans NE
    (~-45deg/-0.785rad) continuously through N through to W
    (~180deg/pi rad), sparse through SE/S. Centred on NW (-135deg/
    -2.356rad, the midpoint of the NE-to-W arc) rather than due N, so
    both NE and W endpoints get strong density rather than the arc
    tapering off before ever reaching W (a first version centred on N
    alone, which under-served W per clarified direction: "one continuous
    dense arc from NE around through N to W")."""
    nw = -3 * math.pi / 4   # -135 degrees
    diff = abs(((angle_rad - nw + math.pi) % (2 * math.pi)) - math.pi)
    t = diff / math.pi  # 0 at NW (arc centre), 1 at SE (arc's opposite point)
    # Steeper falloff than a plain linear blend -- t**1.6 pushes the
    # transition to happen faster near the dense end, producing a more
    # visually obvious "quite a bit more forested" contrast rather than
    # the subtle statistical skew a first (linear) version produced
    # (confirmed via direct measurement: real bias present, but mean
    # angular distance only modestly below the uniform-random
    # expectation -- not a strong enough visual effect).
    t_curved = t ** 1.6
    return 0.96 * (1 - t_curved) + 0.04 * t_curved

placed_trees = []
def far_enough(x, y):
    for (tx, ty) in placed_trees:
        if ((x-tx)**2 + (y-ty)**2) ** 0.5 < MIN_TREE_SPACING:
            return False
    return True

sector_count = 90   # finer-grained than the grove's 22, since this band
                     # is much wider/longer and covers a bigger map
sector_width = (2 * math.pi) / sector_count

# Multiple radial rings per sector, not just one point total -- a first
# version placed at most ONE tree per angular sector regardless of how
# deep the band was, so widening the band (pond got bigger -> band moved
# outward) thinned density rather than preserving it. Rings let density
# actually scale with the band's radial depth.
RING_COUNT = 4
ring_spacing = (TREE_BAND_OUTER - TREE_BAND_INNER) / RING_COUNT

for i in range(sector_count):
    base_ang = i * sector_width
    keep_chance = sector_keep_chance(base_ang)
    for ring in range(RING_COUNT):
        if random.random() > keep_chance:
            continue
        ang = base_ang + random.uniform(-0.4, 0.4) * sector_width
        ring_inner = TREE_BAND_INNER + ring * ring_spacing
        ring_outer = ring_inner + ring_spacing
        r = random.uniform(ring_inner, ring_outer)
        x = int(round(CENTER[0] + r * math.cos(ang)))
        y = int(round(CENTER[1] + r * math.sin(ang)))
        if not (1 <= x < W-1 and 1 <= y < H-1):
            continue
        if not far_enough(x, y):
            continue
        placed_trees.append((x, y))
        wall_mask[y][x] = 1

print(f"Trees placed: {len(placed_trees)}")

# Clear a south approach corridor, same rationale as gen_grove_map.py --
# don't let trees block the player's entry path.
ENTRANCE_CLEARANCE = 2.2
def clear_corridor(cx, cy, dx, dy, length):
    global placed_trees
    keep = []
    for (tx, ty) in placed_trees:
        too_close = False
        for i in range(length):
            px, py = cx + dx*i, cy + dy*i
            if ((tx-px)**2 + (ty-py)**2) ** 0.5 < ENTRANCE_CLEARANCE:
                too_close = True
                break
        if too_close:
            wall_mask[ty][tx] = 0
        else:
            keep.append((tx, ty))
    placed_trees = keep

clear_corridor(CENTER[0], H-1, 0, -1, H)   # south entrance, straight up toward centre
print(f"Trees after corridor clearing: {len(placed_trees)}")

# Animate water with the same alternating-checkerboard GID pattern PGR's
# own water-phase code expects (confirmed from perspectiveGroundRenderer.js
# and d3_sea.json) -- though PGR recomputes the actual displayed GID
# per-frame from _waterPhase, the BASE layer0 value still needs to be one
# of the two water GIDs for PGR's _isWater detection to trigger at all.
# MUST run before map_data is built/saved below -- a first version had
# this loop positioned AFTER json.dump() due to how sequential edits were
# appended, so it silently never affected the saved file at all (confirmed:
# saved lagoon.json had zero water GID cells despite water_tiles containing
# 77 entries).
for (tx, ty) in water_tiles:
    layer0[ty][tx] = WATER_GID_A if (tx + ty) % 2 == 0 else WATER_GID_B

spawn = {"x": CENTER[0], "y": H - 2}

map_data = {
    "name": "lagoon",
    "width": W,
    "height": H,
    "layers": [layer0, layer1],
    "wallMask": wall_mask,
    "heightMap": height_map,
    "spawns": {"player": spawn},
    "legend": {"839": "grass", "840": "grass", "1625": "water", "1679": "water"},
    "dolmenAnchor": {"x": DOLMEN_ANCHOR[0], "y": DOLMEN_ANCHOR[1]},
    "steppingStones": stepping_stones,
    "exits": {}   # standalone test space for now, same as grove was
}

with open('public/maps/forest/lagoon.json', 'w') as f:
    json.dump(map_data, f)

print(f"\nFinal: {W}x{H} map, {len(water_tiles)} water tiles, "
      f"{len(stepping_stones)} stepping stones, {len(placed_trees)} trees, "
      f"dolmen at {DOLMEN_ANCHOR}, spawn at {spawn}")

