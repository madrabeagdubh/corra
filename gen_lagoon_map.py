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

# ── Directional rim heightmap (NOT radially symmetric) ───────────────────────
# A first version used a radially symmetric "noise minus a circular dip"
# approach, carried over from gen_forest_heightmap.mjs's gentle rolling
# style -- but that meant the south approach rose to the SAME height as
# every other direction once far enough from the pond, producing a steep
# ridge directly in the player's entry path (confirmed via screenshot).
# Replaced entirely with a directional rim: south stays low (gentle
# walkable approach), N/E/W rise much higher (dramatic, secluded-feeling
# enclosure) -- height is built UP from the basin floor toward a
# direction-dependent rim target, not carved DOWN from flat noise.
VW, VH = W + 1, H + 1
BASIN_RADIUS_INNER = POND_RADIUS + 1.0   # within this distance of centre,
                                           # height is pulled toward the
                                           # basin floor (0) regardless of
                                           # direction -- the pond itself
                                           # and its immediate banks.
RIM_FULL_RADIUS = max(W, H) * 0.55        # distance at which the rim
                                           # reaches its full directional
                                           # target height -- chosen to
                                           # reach most of the way to the
                                           # map edge, so N/E/W edges
                                           # genuinely read as elevated/
                                           # enclosing, not just the
                                           # immediate pond banks.
NOISE_DETAIL_AMP = 0.4   # small per-tile texture on top of the smooth
                          # directional rim -- much smaller than the rim
                          # heights themselves (2-6.5), so it reads as
                          # roughness/texture, not a competing height
                          # signal that could itself create unwanted
                          # ridges the way the old approach did.

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
        v /= TOTAL_AMP   # [-1, 1], pure noise texture, used as DETAIL on
                          # top of the directional rim below, not as the
                          # primary height source any more

        dx = vx - CENTER[0]
        dy = vy - CENTER[1]
        dist = math.hypot(dx, dy)

        # ── Directional rim height ──────────────────────────────────────────
        # A first version used a RADIALLY SYMMETRIC basin (noise minus a
        # uniform circular dip) -- this meant the south approach rose to
        # the SAME height as every other direction once far enough from
        # the pond, producing a steep faceted ridge directly in the
        # player's path (confirmed via screenshot: player standing at
        # the base of a sharp rise on the south side). Fixed by making
        # the RIM HEIGHT ITSELF directional: south stays low (max ~2),
        # N/E/W rise much higher (max ~6-7), per explicit values given.
        # angle: 0 = east, increasing CCW in screen space (y-down).
        angle = math.atan2(dy, dx)
        south = math.pi / 2
        # ang_t: 0 at due south, 1 at due north (the angularly furthest
        # point from south) -- smooth cosine-based blend, not a hard
        # north/south split, so the rim rises gradually as you move away
        # from the south-facing approach rather than jumping at an exact
        # angle.
        ang_diff = abs(((angle - south + math.pi) % (2 * math.pi)) - math.pi)
        ang_t = ang_diff / math.pi   # 0 at south, 1 at north
        # Smoothstep the angular blend too, so the transition between
        # "low south rim" and "high N/E/W rim" curves rather than
        # changing linearly with angle.
        ang_t_smooth = ang_t * ang_t * (3 - 2 * ang_t)

        RIM_SOUTH_MAX = 2.0   # per explicit value: "southern edge should
                               # be 2 at its highest"
        RIM_OTHER_MAX = 6.5   # per explicit value: "N/W/E edges can be
                               # up to 6 or 7" -- 6.5 splits the difference
        rim_target = RIM_SOUTH_MAX + (RIM_OTHER_MAX - RIM_SOUTH_MAX) * ang_t_smooth

        # Distance blend: a first version used ONE shared outer radius
        # for every direction, so south rose toward its (lower) ceiling
        # at the SAME RATE as north rose toward its much higher one --
        # producing a steep grassy bank looming right over the water on
        # the south side (confirmed via screenshot: "looking underground
        # to where the roots would be" -- a sharp rise starting almost
        # immediately past the shore). Fixed by making the BLEND
        # DISTANCE itself direction-dependent too: south's rise is
        # stretched over a much longer distance (gentle, gradual apron),
        # while N/E/W can rise more quickly since they're meant to feel
        # dramatic/enclosing close-in.
        SOUTH_RISE_DISTANCE = RIM_FULL_RADIUS * 2.2   # south needs MUCH
                                                          # more distance to
                                                          # reach its (lower)
                                                          # ceiling -- a long,
                                                          # gentle apron
        OTHER_RISE_DISTANCE = RIM_FULL_RADIUS * 0.7   # N/E/W reach their
                                                          # (higher) ceiling
                                                          # over a shorter
                                                          # distance -- still
                                                          # smooth, not abrupt,
                                                          # but enclosing
                                                          # sooner
        rise_distance = SOUTH_RISE_DISTANCE + (OTHER_RISE_DISTANCE - SOUTH_RISE_DISTANCE) * ang_t_smooth

        dist_t = smoothstep(BASIN_RADIUS_INNER, BASIN_RADIUS_INNER + rise_distance, dist)

        # Noise adds gentle per-tile texture/roughness on top of the
        # smooth directional rim -- scaled down substantially (NOISE_DETAIL_AMP,
        # not HEIGHT_AMP) so it reads as texture, not as a competing
        # height signal that could itself create unwanted ridges.
        h = rim_target * dist_t + v * NOISE_DETAIL_AMP
        row.append(round(max(0.0, h), 4))
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
WATER_HARD_RADIUS = POND_RADIUS + 1.5   # was +1.0 -- widened slightly so
# the pond is a bit bigger overall, per direct feedback ("making the
# submerged area that little bit bigger").
WATER_GUARANTEED_RADIUS = POND_RADIUS - 1.0   # was implicit/absent --
# everything within THIS distance of centre is unconditionally water,
# no height check at all. A first version relied purely on the height
# threshold even close to centre, which let the noise-detail layer
# (NOISE_DETAIL_AMP) occasionally push a tile's average height just
# above WATER_HEIGHT_THRESHOLD even deep inside the basin, producing a
# stray land patch breaking the water surface (confirmed via
# screenshot). This guarantees the pond's core is always solid water
# regardless of noise.

water_tiles = set()
for ty in range(H):
    for tx in range(W):
        dist = math.hypot(tx + 0.5 - CENTER[0], ty + 0.5 - CENTER[1])
        if dist > WATER_HARD_RADIUS:
            continue
        if dist <= WATER_GUARANTEED_RADIUS:
            water_tiles.add((tx, ty))
            wall_mask[ty][tx] = 1
            continue
        if tile_avg_height(tx, ty) < WATER_HEIGHT_THRESHOLD:
            water_tiles.add((tx, ty))
            wall_mask[ty][tx] = 1   # water is unwalkable by default --
                                     # stepping stones below punch through

print(f"Water tiles: {len(water_tiles)}")

# ── Fill stray island holes ──────────────────────────────────────────────────
# Even with WATER_GUARANTEED_RADIUS covering the pond's deep interior,
# noise-detail variation near the EDGE of the water radius can still
# occasionally push an individual tile's height just above
# WATER_HEIGHT_THRESHOLD despite being substantially surrounded by water
# on most sides -- confirmed via direct detection: 5 such "island" tiles
# existed even after the guaranteed-radius fix, scattered at different
# points around the pond's edge (not just one location), each surrounded
# by water on 3 of its 4 neighbouring cells. This pass converts any such
# cell to water too, since a single landlocked tile surrounded by water
# reads as a visual bug (a stray patch breaking the water surface), not
# as a meaningful tiny island worth preserving.
stones_set = set(tuple(s) for s in [])  # populated AFTER stepping stones are
                                          # placed below -- see second pass
filled_holes = 0
for ty in range(1, H - 1):
    for tx in range(1, W - 1):
        if (tx, ty) in water_tiles:
            continue
        neighbor_water = sum(
            1 for (dx, dy) in [(1,0),(-1,0),(0,1),(0,-1)]
            if (tx+dx, ty+dy) in water_tiles
        )
        if neighbor_water >= 3:
            water_tiles.add((tx, ty))
            wall_mask[ty][tx] = 1
            filled_holes += 1
print(f"Filled stray island holes: {filled_holes}")

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
        water_tiles.discard((tx, ty))   # remove from water set too, so the
        # GID-writing pass below gives this cell real ground (839/840),
        # not a water GID -- a first version left stepping stones IN
        # water_tiles, so they were walkable but still visually painted
        # as water, which defeats the purpose of a visible stone path.
        stepping_stones.append([tx, ty])

print(f"Stepping stones placed: {len(stepping_stones)}")

# ── Asymmetric tree placement ────────────────────────────────────────────────
# Same angle-bucketed approach as gen_grove_map.py (one tree per angular
# sector with jitter, avoiding the clustering a pure-random first attempt
# produced there) -- but with PER-SECTOR density weighting instead of
# uniform distribution: NE/NW arc gets a tree in nearly every sector,
# SE/S/W arc skips most sectors, producing the requested "densely wooded
# Per direct revised feedback: dense forest surrounding the ENTIRE map on
# all sides except south (player's view/approach direction must stay
# clear), with trees extending all the way out to obscure the map edges
# completely -- "this is an isolated place deep in the woods." This
# replaces the earlier NE-through-W gradient concept, which only
# produced a partial density bias, not full edge coverage. Band now
# extends much further out (close to the map boundary itself) rather
# than stopping 10 tiles past the pond.
TREE_BAND_INNER = WATER_HARD_RADIUS + 2.0
TREE_BAND_OUTER = max(W, H) * 0.75   # reaches close to the map edge,
                                       # not just a fixed ring width
MIN_TREE_SPACING = 2.9   # was 2.2 -- still landed at 118 trees (target ~70),
                          # nudged up based on observed scaling.

def sector_keep_chance(angle_rad):
    """Dense (0.95) on all sides EXCEPT a south wedge centred on due
    south (angle = +pi/2 in this screen-Y-down convention, since the
    player's spawn/approach is south of the dolmen) -- that wedge fades
    down to near-zero so the player's view/entry path stays open. Smooth
    cosine-style falloff at the wedge's own edges, not a hard cutoff, so
    the transition into open ground doesn't look like a mechanically
    straight tree-wall stopping at an exact angle."""
    south = math.pi / 2
    diff = abs(((angle_rad - south + math.pi) % (2 * math.pi)) - math.pi)
    # diff=0 at due south (clearest), diff=pi at due north (densest)
    SOUTH_WEDGE_HALF_ANGLE = math.radians(38)   # wedge width each side of due south
    if diff < SOUTH_WEDGE_HALF_ANGLE:
        t = diff / SOUTH_WEDGE_HALF_ANGLE   # 0 at dead centre south, 1 at wedge edge
        return 0.06 + 0.89 * (t ** 1.4)     # ranges ~0.06 (centre) to ~0.95 (wedge edge)
    return 0.99   # everywhere outside the south wedge: near-certain, was 0.95

placed_trees = []
def far_enough(x, y):
    for (tx, ty) in placed_trees:
        if ((x-tx)**2 + (y-ty)**2) ** 0.5 < MIN_TREE_SPACING:
            return False
    return True

sector_count = 120   # finer-grained again, since the south wedge's own
                      # smooth falloff needs enough angular resolution to
                      # read as a gradual opening, not a stepped one
sector_width = (2 * math.pi) / sector_count

# More rings, denser spacing, reaching much further out toward the map
# edge -- per "map edges should be entirely obscured," not just a
# generous treeline some distance in from the boundary.
RING_COUNT = 4   # was 12 -- way too dense. Targeting ~70 trees total.
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

with open('public/maps/forest/grove.json', 'w') as f:
    json.dump(map_data, f)

print(f"\nFinal: {W}x{H} map, {len(water_tiles)} water tiles, "
      f"{len(stepping_stones)} stepping stones, {len(placed_trees)} trees, "
      f"dolmen at {DOLMEN_ANCHOR}, spawn at {spawn}")

