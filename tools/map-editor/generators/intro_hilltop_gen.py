# generator-version: 1   (the patch only replaces this file if this number is lower than its own)
# intro_hilltop_gen.py -- the intro's hilltop level.
#   Tune the knobs below (TREND_SCALE, PEAK_SCALE, WAVE_SCALE, DIP), then regenerate:
#       python3 tools/map-editor/generators/intro_hilltop_gen.py
#   and reload http://localhost:5173/?level=1&fps=1   (no build step; pure Python, no numpy).
import math

# THE HILLTOP MAP  (pure Python: no numpy, so it can run inside the patch on a phone)
#
# The camera stands on a hilltop looking north. Everything is expressed by DISTANCE from
# the camera's screen-bottom row, d = CAM_ROW - row, because that is what perspective
# cares about; the map row is just CAM_ROW - d.
#
#   d  0..14   the CROWN: flat (a shallow dome). The druid and queen stand here.
#   d 12..28   the DROP-OFF: the land falls away below the crown edge. From a low camera
#              the near slope is hidden behind that edge, which is what makes the hill
#              read as a hill; only what rises above the edge line shows beyond it.
#   d 24..82   ROLLING RIDGES, meandering left to right, rising with distance (so each
#              ridge shows above the one in front, layered like real depth) with their
#              on-screen size held roughly steady by growing the wave amplitude with d.
#   d 82..96   the far range falls away behind its own crest, so the map's north edge (a
#              straight cut where nothing is drawn) hides BEHIND the skyline.
#
# heightMap is a VERTEX grid, (H+1) x (W+1), and 0 is the camera's own eye level: heights
# can be negative (the renderer applies them as-is), which is what lets land fall away.
W, H      = 96, 120
# --- the knobs -----------------------------------------------------------------------------
TREND_SCALE = 0.80       # how high the land climbs toward the far range (lower = more sky)
PEAK_SCALE  = 0.80       # the two distant peaks
WAVE_SCALE  = 1.00       # how strongly the ridges roll (higher = more pronounced hills)
DIP         = 1.9        # how far the land falls away past the crown edge (hides the near slope)
CAM_ROW   = 114          # the renderer's camera row = player row + 14 (CAMERA_ROW_OFFSET)
PLAYER_ROW = CAM_ROW - 14
CROWN_D   = 14           # crown reaches this far ahead of the camera
FAR_D     = 96           # the renderer draws at most 96 rows back (FOCAL_LENGTH * 8)
TAU = 2 * math.pi


def _smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def height(x, r):
    d = CAM_ROW - r
    dx = x - W / 2.0

    # the crown: a shallow dome, so it is not a billiard table
    dome = -0.0035 * dx * dx
    dome = max(dome, -0.55)

    # rolling weight: 0 on the crown, 1 from d = 24
    t = _smooth((d - 12.0) / 12.0)

    # the drop-off: a dip just past the crown edge, recovering by d ~ 30
    dip = -DIP * math.sin(math.pi * max(0.0, min(1.0, (d - 12.0) / 18.0))) ** 2

    # the trend: the land climbs toward a far range, then falls away behind it
    lateral = 1.0 + 0.28 * math.sin(TAU * x / 58.0 + 0.7)
    if d <= 82:
        trend = 0.075 * TREND_SCALE * max(0.0, d - 14.0) * lateral
    else:
        trend = (0.075 * TREND_SCALE * 68.0 * lateral) - 0.36 * TREND_SCALE * (d - 82.0)

    trend = max(trend, 0.4)      # rows past the renderer's 96-row reach are never drawn; keep them sane anyway

    # meandering ridges: three incommensurate waves, so it does not look corrugated
    amp = (0.60 + 0.009 * d) * WAVE_SCALE
    w1 = 0.90 * math.sin(TAU * (d / 10.5 + 0.30 * math.sin(TAU * x / 31.0) + 0.12 * math.sin(TAU * x / 13.0 + 2.0)) + 0.6)
    w2 = 0.55 * math.sin(TAU * (d / 6.3 - x / 27.0) + 1.3)
    w3 = 0.35 * math.sin(TAU * (x / 17.0 + d / 16.0) + 0.4)
    waves = amp * (w1 + w2 + w3) * t

    # two distant peaks give the skyline some character
    peaks = 0.0
    for px, ph, pw in ((33.0, 2.6, 5.5), (66.0, 3.3, 6.5)):
        peaks += PEAK_SCALE * ph * math.exp(-((x - px) / pw) ** 2) * math.exp(-((d - 78.0) / 9.0) ** 2)

    # the crown is the flat plane the dome sits on; everything beyond blends in from it
    return dome * (1 - t) + (trend + dip + waves + peaks) * t


def make_map():
    heights = [[round(height(x, r), 3) for x in range(W + 1)] for r in range(H + 1)]
    ground = [[839 if (x + y) % 2 == 0 else 840 for x in range(W)] for y in range(H)]
    zeros = [[0] * W for _ in range(H)]
    return {
        'name': 'intro_hilltop',
        'width': W,
        'height': H,
        'hasCliffs': True,           # tells the renderer to read heightMap for ground undulation
        'layers': [ground, zeros],
        'wallMask': [row[:] for row in zeros],
        'heightMap': heights,
        'legend': {'839': 'grass', '840': 'grass'},
        'spawns': {'player': {'x': W // 2, 'y': PLAYER_ROW}},
        'exits': {},
        'entries': {},
    }


if __name__ == '__main__':
    # Standalone: python3 intro_hilltop_gen.py   (writes public/maps/bogMaps/intro_hilltop.json)
    import json, os
    out = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                        '../../../public/maps/bogMaps/intro_hilltop.json'))
    with open(out, 'w') as f:
        json.dump(make_map(), f, separators=(',', ':'))
    print('wrote', out)
