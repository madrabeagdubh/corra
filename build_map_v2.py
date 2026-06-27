"""
build_map_v2.py
Corridor-carving generator for testForest. Originally ported CA cave logic
from forest_maze_gen.mjs, but CA at various threshold combos kept producing
either one large rounded chamber or tiny disconnected fragments -- never
actual winding/branching corridors (verified by direct ASCII inspection
across several parameter sweeps). Switched to a biased drunkard's-walk
corridor carver instead, which is purpose-built for winding paths: it
prefers continuing in its current direction (straight_bias) with occasional
turns and occasional jumps back to an earlier branch point, producing real
forking corridors rather than blobby rooms.

Phases:
  1. Carve: biased random walk from map centre, marking floor as it goes
  2. Connectivity: flood-fill, keep only the largest open region (in case
     the walk left any isolated floor cells -- shouldn't happen since the
     walk is itself one continuous path, but kept as a safety net)
  3. Exits: punch openings through chosen edges
  4. Perimeter: every edge tile is wall or exit, never open

Output: testForest.json (map) + trunk positions derived from real corridor
edges, printed for pasting into forestEffects.js's TRUNK_WORLD_POSITIONS.
"""
import json
import random

CONFIG = {
    'width': 32,
    'height': 32,
    'target_open_frac': 0.32,   # fraction of map that ends up walkable
    'straight_bias': 0.75,      # chance to continue current direction vs. turn
    'branch_jump_chance': 0.03, # chance to jump back to an earlier branch point
    'branch_record_chance': 0.05, # chance any given carved cell becomes a branch point
    'exit_width': 3,
    'exit_clear_depth': 4,
    'exit_west': True,
    'exit_east': True,
}

def make2d(w, h, v=False):
    return [[v for _ in range(w)] for _ in range(h)]

def in_bounds(x, y, w, h):
    return 0 <= x < w and 0 <= y < h

def carve_corridors(cfg, rng):
    w, h = cfg['width'], cfg['height']
    grid = [[True] * w for _ in range(h)]  # True = wall
    total = w * h
    target_open = int(total * cfg['target_open_frac'])

    x, y = w // 2, h // 2
    grid[y][x] = False
    open_count = 1
    dirs = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    last_dir = rng.choice(dirs)
    branch_points = [(x, y)]

    max_iters = target_open * 40  # safety cap against infinite loops
    it = 0
    while open_count < target_open and it < max_iters:
        it += 1
        if rng.random() < cfg['branch_jump_chance'] and branch_points:
            x, y = rng.choice(branch_points)
            last_dir = rng.choice(dirs)

        if rng.random() < cfg['straight_bias']:
            dx, dy = last_dir
        else:
            dx, dy = rng.choice(dirs)
            last_dir = (dx, dy)

        nx, ny = x + dx, y + dy
        if not (1 <= nx < w - 1 and 1 <= ny < h - 1):
            last_dir = rng.choice(dirs)
            continue
        x, y = nx, ny
        if grid[y][x]:
            grid[y][x] = False
            open_count += 1
            if rng.random() < cfg['branch_record_chance']:
                branch_points.append((x, y))

    return grid

def flood_fill(grid, sx, sy, w, h):
    visited = make2d(w, h, False)
    cells = []
    stack = [(sx, sy)]
    while stack:
        cx, cy = stack.pop()
        if not in_bounds(cx, cy, w, h) or visited[cy][cx] or grid[cy][cx]:
            continue
        visited[cy][cx] = True
        cells.append((cx, cy))
        stack += [(cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)]
    return cells

def enforce_connectivity(grid, cfg):
    w, h = cfg['width'], cfg['height']
    visited = make2d(w, h, False)
    largest = []
    for y in range(h):
        for x in range(w):
            if grid[y][x] or visited[y][x]:
                continue
            region = flood_fill(grid, x, y, w, h)
            for rx, ry in region:
                visited[ry][rx] = True
            if len(region) > len(largest):
                largest = region
    main_set = set(largest)
    for y in range(h):
        for x in range(w):
            if not grid[y][x] and (x, y) not in main_set:
                grid[y][x] = True
    return grid, largest

def carve_exit_corridor(grid, cfg, edge):
    w, h = cfg['width'], cfg['height']
    half = cfg['exit_width'] // 2
    if edge == 'west':
        cx, cy, dx, dy = 0, h // 2, 1, 0
    elif edge == 'east':
        cx, cy, dx, dy = w - 1, h // 2, -1, 0
    elif edge == 'north':
        cx, cy, dx, dy = w // 2, 0, 0, 1
    else:
        cx, cy, dx, dy = w // 2, h - 1, 0, -1

    x, y = cx, cy
    for i in range(w):
        for offset in range(-half, half + 1):
            px = x + (offset if dy != 0 else 0)
            py = y + (offset if dx != 0 else 0)
            if in_bounds(px, py, w, h):
                grid[py][px] = False
        if i >= cfg['exit_clear_depth'] and not grid[y][x]:
            break
        x += dx
        y += dy
    return cx, cy

def enforce_perimeter(grid, exits, cfg):
    w, h = cfg['width'], cfg['height']
    half = cfg['exit_width'] // 2
    for x in range(w):
        grid[0][x] = True
        grid[h-1][x] = True
    for y in range(h):
        grid[y][0] = True
        grid[y][w-1] = True
    for edge, cx, cy in exits:
        if edge == 'west':
            for dy in range(-half, half + 1):
                yy = cy + dy
                if in_bounds(0, yy, w, h):
                    grid[yy][0] = False
        elif edge == 'east':
            for dy in range(-half, half + 1):
                yy = cy + dy
                if in_bounds(w-1, yy, w, h):
                    grid[yy][w-1] = False
        elif edge == 'north':
            for dx in range(-half, half + 1):
                xx = cx + dx
                if in_bounds(xx, 0, w, h):
                    grid[0][xx] = False
        elif edge == 'south':
            for dx in range(-half, half + 1):
                xx = cx + dx
                if in_bounds(xx, h-1, w, h):
                    grid[h-1][xx] = False

def build_base(w, h):
    return [[839 if (x + y) % 2 == 0 else 840 for x in range(w)] for y in range(h)]

def find_spawn(grid, w, h, near_edge='west'):
    # Find an open cell near the chosen edge, away from the very border.
    target_x = 3 if near_edge == 'west' else w - 4
    best = None
    best_dist = None
    for y in range(h):
        for x in range(w):
            if grid[y][x]:
                continue
            d = abs(x - target_x)
            if best_dist is None or d < best_dist:
                best_dist = d
                best = (x, y)
    return best

def edge_trunk_positions(grid, w, h, stride=2):
    """Floor cells adjacent to a wall cell, thinned by stride, offset +0.5
    to center within the tile -- same approach used for testForest's
    hand-built corridor map, just generalized to any wall mask."""
    candidates = []
    for y in range(h):
        for x in range(w):
            if grid[y][x]:
                continue
            neighbours = [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
            if any(in_bounds(nx, ny, w, h) and grid[ny][nx] for nx, ny in neighbours):
                candidates.append((x + 0.5, y + 0.5))
    return candidates[::stride]


def generate(seed_name='testForest'):
    cfg = CONFIG
    w, h = cfg['width'], cfg['height']
    rng = random.Random(seed_name)

    grid = carve_corridors(cfg, rng)
    grid, main_region = enforce_connectivity(grid, cfg)

    edges = []
    if cfg['exit_west']: edges.append('west')
    if cfg['exit_east']: edges.append('east')
    exit_centres = []
    for edge in edges:
        cx, cy = carve_exit_corridor(grid, cfg, edge)
        exit_centres.append((edge, cx, cy))

    enforce_perimeter(grid, exit_centres, cfg)

    base = build_base(w, h)
    layer1 = [[0] * w for _ in range(h)]  # stays zeroed -- ForestEffects owns wall visuals

    spawn = find_spawn(grid, w, h, near_edge='west')
    if spawn is None:
        raise RuntimeError("No open spawn cell found -- regenerate with different seed/params")

    trunk_positions = edge_trunk_positions(grid, w, h, stride=2)

    # wallMask: True/1 = impassable (forest interior), False/0 = walkable
    # path. This is the SAME grid trunks/floor-tint are derived from --
    # stored separately from layers[] so testForest.js's isColliding()
    # override can check it directly without needing a GID to also force
    # PGR to render something there (PGR draws any nonzero layer1 GID as
    # either a billboard or flat tile -- there's no "wall but invisible"
    # GID, so collision data has to live outside the render layers).
    wall_mask = [[1 if grid[y][x] else 0 for x in range(w)] for y in range(h)]

    map_data = {
        'name': 'testForest',
        'width': w,
        'height': h,
        'layers': [base, layer1],
        'wallMask': wall_mask,
        'spawns': {'player': {'x': spawn[0], 'y': spawn[1]}},
        'legend': {'839': 'grass', '840': 'grass'},
    }

    with open('testForest.json', 'w') as f:
        json.dump(map_data, f)

    print(f"Generated {w}x{h} corridor-carved maze (seed={seed_name!r})")
    print(f"Spawn: {spawn}")
    print(f"Main open region size: {len(main_region)} cells")
    print(f"Trunk candidates (stride=2): {len(trunk_positions)}")
    print()
    print("ASCII preview ('#'=wall '.'=floor '@'=spawn):")
    for y in range(h):
        row = ''
        for x in range(w):
            if (x, y) == spawn:
                row += '@'
            else:
                row += '#' if grid[y][x] else '.'
        print(row)

    return trunk_positions


if __name__ == '__main__':
    positions = generate('testForest')
    print()
    print("── Paste into forestEffects.js TRUNK_WORLD_POSITIONS ──")
    print("  static TRUNK_WORLD_POSITIONS = [")
    line = "    "
    for i, (tx, ty) in enumerate(positions):
        line += f"[{tx}, {ty}], "
        if (i + 1) % 4 == 0:
            print(line)
            line = "    "
    if line.strip():
        print(line)
    print("  ]")
