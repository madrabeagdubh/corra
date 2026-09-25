# generator-version: 7   (the patch only replaces this file if this number is lower than its own)
# intro_hilltop_gen.py -- the intro's hilltop level.
#   Tune the knobs below (TREND_SCALE, PEAK_SCALE, WAVE_SCALE, DIP), then regenerate:
#       python3 tools/map-editor/generators/intro_hilltop_gen.py
#   and reload http://localhost:5173/   (no build step; pure Python, no numpy).
#
#   RE-ROLLING. The shape is deterministic: the same seed always gives the same hill, and
#   seed 0 is the original map exactly. To roll a different one:
#       python3 tools/map-editor/generators/intro_hilltop_gen.py --seed 7
#   The seed only moves the wave phases, the two peaks and the lateral trend, so every roll
#   is still this hill -- a crown, a drop-off, ridges rising into a far range -- not a
#   different kind of landscape. Roll until one looks right, then keep that number: it is
#   the whole description of the map. Add --out PATH to write somewhere else and compare.
#
#   SHAPES. --shape hilltop (the default) is the hill described above. --shape valley is a
#   V-shaped valley running away from the camera, written to intro_valley.json so both can
#   exist side by side; load it with ?map=valley. See height_valley() below.
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
SEED        = 0          # re-roll with --seed N; 0 is the original hill
# THE VALLEY. The moon widget rests low and centred -- about 85% down the screen, always below
# the horizon -- so it is always seen against land rather than sky. With a full field of flowers
# that land became a wall of tall near-field blooms right behind it. This sinks the mid-ground
# directly ahead of the camera so the ground (and its flowers) drops away behind the moon, with
# the far range still standing beyond it. Set VALLEY_DEPTH = 0 for the old unbroken slope.
VALLEY_DEPTH = 2       # how far the floor drops below the surrounding land
VALLEY_D0    = 18        # nearest distance it affects (the crown, d < 14, is never touched)
VALLEY_D1    = 62        # farthest: beyond this the land climbs to the range as before
VALLEY_W     = 24.0      # half-width in tiles; larger = a broad basin, smaller = a gully

# --shape valley. The camera stands on the floor of a V-shaped valley that runs away from it
# and opens to the horizon. The walls rise on both sides and the floor vanishes into the
# notch between them -- which is where the moon rests, in open sky, framed by the walls.
# Tuned in simulation against the moon's real rest position (120px up from the bottom) on a
# phone-shaped screen: no terrain inside the moon's ring, windowed or fullscreen, and about
# 34px of clear sky all round it; the hills climb to roughly a third of the way up.
VSHAPE_FLOOR = 3.8       # floor half-width at the camera, in tiles
VSHAPE_WIDEN = 0.03      # ...and how much wider it gets per tile of distance
# Beyond the floor the land does not rise as one wall but as ROWS OF HILLS: rounded ridges
# running away from the camera, parallel to the valley, each rising a little above the one in
# front, their crests wandering with noise. Gentler on the eye, and there is always another
# ridge further out for the view to find when it pans toward another constellation.
VHILL_RISE   = 1.25      # how fast the ground climbs away from the floor's edge, per tile...
VHILL_KNEE   = 26.0      # ...easing off over about this many tiles, so the far hills flatten
VHILL_ROW    = 9.5       # spacing between successive ridges, in tiles across
VHILL_ROWAMP = 3.8       # how pronounced each ridge is above the general rise
VHILL_NOISE  = 1.2       # the wander: fbm noise over the whole slope, tiles
# A low ridge closing off the far end of the valley, wall to wall, so the floor does not just
# run flat into the sky. Rounded and low: lowest in the middle, where its crest sits just under
# the moon, rising gently toward the walls. It is MERGED with the hills (whichever is higher
# wins), never stacked on them, so the walls themselves do not grow.
VRIDGE_D0    = 58.0      # where it starts to rise, tiles out...
VRIDGE_D1    = 90.0      # ...and where it is at full height (the renderer stops at ~96)
VRIDGE_MID   = 2.0       # height in the middle, tiles -- keeps its crest under the moon
VRIDGE_SIDE  = 6.5       # height out toward the walls
VRIDGE_W     = 14.0      # how far out from the middle it takes to rise to that
VRIDGE_UND   = 1.4       # the roll along its crest
CAM_ROW   = 114          # the renderer's camera row = player row + 14 (CAMERA_ROW_OFFSET)
PLAYER_ROW = CAM_ROW - 14
CROWN_D   = 14           # crown reaches this far ahead of the camera
FAR_D     = 96           # the renderer draws at most 96 rows back (FOCAL_LENGTH * 8)
TAU = 2 * math.pi

# The seed's only job is to move things around, never to change how the hill is built. Each
# call gives one repeatable number in 0..1 for a given (seed, name), from the standard library
# so this stays dependency-free and identical on any machine.
def _rand(name):
    if not SEED:
        return None
    import hashlib
    h = hashlib.sha256(f'{SEED}:{name}'.encode()).digest()
    return int.from_bytes(h[:6], 'big') / float(1 << 48)


def _phase(name):
    """A phase offset in turns (0..1), or 0 when unseeded -- so seed 0 is the original map."""
    r = _rand(name)
    return 0.0 if r is None else r


def _jitter(name, amount):
    """A symmetric offset in -amount..+amount, or 0 when unseeded."""
    r = _rand(name)
    return 0.0 if r is None else (r * 2 - 1) * amount


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
    lateral = 1.0 + 0.28 * math.sin(TAU * (x / 58.0 + _phase('lateral')) + 0.7)
    if d <= 82:
        trend = 0.075 * TREND_SCALE * max(0.0, d - 14.0) * lateral
    else:
        trend = (0.075 * TREND_SCALE * 68.0 * lateral) - 0.36 * TREND_SCALE * (d - 82.0)

    trend = max(trend, 0.4)      # rows past the renderer's 96-row reach are never drawn; keep them sane anyway

    # meandering ridges: three incommensurate waves, so it does not look corrugated
    amp = (0.60 + 0.009 * d) * WAVE_SCALE
    w1 = 0.90 * math.sin(TAU * (d / 10.5 + _phase('w1')
                                + 0.30 * math.sin(TAU * (x / 31.0 + _phase('w1x')))
                                + 0.12 * math.sin(TAU * (x / 13.0 + _phase('w1x2')) + 2.0)) + 0.6)
    w2 = 0.55 * math.sin(TAU * (d / 6.3 - x / 27.0 + _phase('w2')) + 1.3)
    w3 = 0.35 * math.sin(TAU * (x / 17.0 + d / 16.0 + _phase('w3')) + 0.4)
    waves = amp * (w1 + w2 + w3) * t

    # two distant peaks give the skyline some character
    peaks = 0.0
    for i, (px, ph, pw) in enumerate(((33.0, 2.6, 5.5), (66.0, 3.3, 6.5))):
        px += _jitter(f'peak{i}x', 11.0)      # slides along the skyline, stays clear of the edges
        ph += _jitter(f'peak{i}h', 0.9)       # a touch taller or lower
        pw += _jitter(f'peak{i}w', 1.5)       # a touch broader or sharper
        peaks += PEAK_SCALE * ph * math.exp(-((x - px) / pw) ** 2) * math.exp(-((d - 78.0) / 9.0) ** 2)

    # the valley: a basin sunk into the mid-ground straight ahead, so the moon has somewhere to
    # sit. Smooth in d (sin^2, zero at both ends) and Gaussian across x, so it opens and closes
    # gradually instead of showing a rim.
    valley = 0.0
    if VALLEY_DEPTH and VALLEY_D0 < d < VALLEY_D1:
        along = math.sin(math.pi * (d - VALLEY_D0) / (VALLEY_D1 - VALLEY_D0)) ** 2
        valley = -VALLEY_DEPTH * along * math.exp(-((dx / VALLEY_W) ** 2))

    # the crown is the flat plane the dome sits on; everything beyond blends in from it
    return dome * (1 - t) + (trend + dip + waves + peaks + valley) * t


def _h2(ix, iy, salt):
    # A repeatable lattice hash in 0..1: integer mixing, so it is fast enough to run over the
    # whole map several times and identical on any machine. The seed feeds in, so a different
    # --seed is a different set of hills.
    n = (ix * 374761393 + iy * 668265263 + salt * 2246822519 + SEED * 3266489917) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffffff) / float(0xffffff)


def _vnoise(x, y, salt):
    # Value noise: hashed corners, smoothly interpolated -- Perlin's shape without the
    # gradients, which is plenty for rolling hills.
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = _smooth(x - ix), _smooth(y - iy)
    a = _h2(ix, iy, salt);     b = _h2(ix + 1, iy, salt)
    c = _h2(ix, iy + 1, salt); d = _h2(ix + 1, iy + 1, salt)
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy


def _fbm(x, y, salt, octaves=3):
    # Layered noise, each octave twice as fine and half as strong. Centred on 0, roughly -1..1.
    v, amp, tot = 0.0, 1.0, 0.0
    for o in range(octaves):
        v += amp * (_vnoise(x, y, salt + o * 101) * 2 - 1)
        tot += amp; x *= 2.03; y *= 2.03; amp *= 0.5
    return v / tot


def height_valley(x, r):
    # The valley: a level floor running away into the notch where the moon rests, and rows of
    # rolling hills climbing away from it on both sides.
    d = CAM_ROW - r
    dx = x - W / 2.0
    side = 1 if dx >= 0 else 0

    # the floor: nearly level, a little ripple so it is not glass, none right at the camera
    t = _smooth((d - 10.0) / 10.0)
    floor = (0.25 * math.sin(TAU * (x / 11.0 + d / 17.0 + _phase('vf1')))
           + 0.15 * math.sin(TAU * (x / 5.0 - d / 7.0 + _phase('vf2')))) * t

    half = VSHAPE_FLOOR + VSHAPE_WIDEN * max(0.0, d)
    past = abs(dx) - half
    if past <= 0:
        # The floor -- but the far ridge crosses it too. Returning bare floor here once left the
        # ridge stopping dead at the floor's edge, which showed as a blocky shoulder either side
        # of the moon and nothing at all beneath it.
        return floor + _far_ridge(dx, d)

    grow = _smooth(min(1.0, past / 3.0))          # meet the floor without a crease
    # the general climb, easing off with distance so the outer hills roll rather than tower
    rise = VHILL_RISE * past / (1.0 + past / VHILL_KNEE)
    # the rows: rounded ridges across the slope, their spacing nudged by noise so they are not
    # a washboard, their crests rising and falling along the valley
    wob  = 0.18 * _fbm(d / 14.0, past / 14.0, 7 + side)
    row  = 0.5 - 0.5 * math.cos(TAU * (past / VHILL_ROW + wob + _phase('vrow' + str(side))))
    crest = 0.55 + 0.45 * _fbm(d / 11.0, past / 9.0, 17 + side)
    ridges = VHILL_ROWAMP * row * crest * _smooth(min(1.0, past / 6.0))
    wander = VHILL_NOISE * _fbm(x / 9.0, d / 9.0, 29) * _smooth(min(1.0, past / 5.0))
    hills = (rise + ridges + wander) * grow
    return floor + max(hills, _far_ridge(dx, d))


def _far_ridge(dx, d):
    # The low ridge across the valley's far end. Smooth fbm for the roll, so it reads as the
    # same rounded country as the hills, only further off -- not a new kind of terrain.
    if d <= VRIDGE_D0:
        return 0.0
    along = _smooth(min(1.0, (d - VRIDGE_D0) / (VRIDGE_D1 - VRIDGE_D0)))
    base = VRIDGE_MID + (VRIDGE_SIDE - VRIDGE_MID) * _smooth(min(1.0, abs(dx) / VRIDGE_W))
    roll = VRIDGE_UND * _fbm(dx / 5.5, d / 9.0, 53)
    return max(0.0, (base + roll) * along)


SHAPE = 'hilltop'        # set by --shape


def make_map():
    fn = height_valley if SHAPE == 'valley' else height
    heights = [[round(fn(x, r), 3) for x in range(W + 1)] for r in range(H + 1)]
    ground = [[839 if (x + y) % 2 == 0 else 840 for x in range(W)] for y in range(H)]
    zeros = [[0] * W for _ in range(H)]
    return {
        'name': 'intro_valley' if SHAPE == 'valley' else 'intro_hilltop',
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
    # Standalone: python3 intro_hilltop_gen.py [--seed N] [--out PATH]
    import argparse, json, os
    ap = argparse.ArgumentParser(description='Generate the intro hilltop map.')
    ap.add_argument('--seed', type=int, default=SEED,
                    help='re-roll the hill; 0 (the default) is the original map')
    ap.add_argument('--out', default=None, help='write somewhere else, to compare rolls')
    ap.add_argument('--shape', choices=('hilltop', 'valley'), default='hilltop',
                    help='hilltop (default) or valley; each writes its own file')
    args = ap.parse_args()
    SEED = args.seed
    SHAPE = args.shape
    out = args.out or os.path.normpath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     f'../../../public/maps/bogMaps/intro_{SHAPE}.json'))
    with open(out, 'w') as f:
        json.dump(make_map(), f, separators=(',', ':'))
    print(f'wrote {out}  ({SHAPE}, seed {SEED})')
