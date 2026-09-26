# river_preview.py -- preview a river's course through the intro valley, before any of it
# goes into the game. Pure Python (no numpy, no PIL), writes one SVG.
#
#   python3 tools/map-editor/generators/river_preview.py
#   then open  http://localhost:5173/river_preview.svg   (Vite serves public/)
#
# Top panel: a rough stand-in for the game's view -- the same perspective maths as the PGR
# (FOCAL_LENGTH 12, PLAYER_DIST 1.2, across 6.5, horizon 112px up), painted far to near on a
# phone-shaped screen, with the moon's rest position and the figures' spots marked. It is NOT
# the game's rendering: no textures, no grade, no mist. It is there to judge the COURSE.
# Bottom panel: top-down, the map with the river, the figures and the camera's view wedge.
#
# Edit RIVER_PTS in intro_hilltop_gen.py and re-run this before regenerating the map.
import math, os, sys
sys.dont_write_bytecode = True   # no __pycache__ left in the repo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import intro_hilltop_gen as gen

# --- the river ---------------------------------------------------------------------------
# The course and channel now live in the generator (RIVER_PTS etc.): edit them there.
RIVER_W, WATER_LEVEL = gen.RIVER_W, gen.WATER_LEVEL

# --- the screen (phone-ish, CSS px) --------------------------------------------------------
SW, SH   = 400, 860
GROUND_H = 112           # horizonFromBottom
ACROSS   = 6.5
FL, PD   = 12.0, 1.2
CAM_COL  = 48.0
CAM_ROW  = gen.CAM_ROW
MOON_Y   = SH - 120
FIG_D    = 12            # figureDepth
FIGS     = [('queen', 0.53, 58), ('druid', 0.63, 66)]   # screen-x fraction, rough height px


HM = None
LINE = None


def river_dist(col, d):
    return gen.river_dist(LINE, col, d)


def build():
    # The generator's own heights, carved exactly as the map is.
    global HM, LINE
    gen.SHAPE = 'valley'
    LINE = gen.river_line()
    HM = [[gen.river_carve(gen.height_valley(x, r), river_dist(x, CAM_ROW - r))
           for x in range(gen.W + 1)] for r in range(gen.H + 1)]


def vh(col, row):
    # bilinear over the vertex grid
    c0, r0 = int(math.floor(col)), int(math.floor(row))
    fc, fr = col - c0, row - r0
    def g(c, r):
        c = max(0, min(gen.W, c)); r = max(0, min(gen.H, r))
        return HM[r][c]
    return ((g(c0, r0) * (1 - fc) + g(c0 + 1, r0) * fc) * (1 - fr)
            + (g(c0, r0 + 1) * (1 - fc) + g(c0 + 1, r0 + 1) * fc) * fr)


def scale(d):
    return (SW / ACROSS) * (FL + PD) / (FL + d)


def proj(col, d, h):
    s = scale(d)
    return SW / 2 + (col - CAM_COL) * s, (SH - GROUND_H) + GROUND_H * FL / (FL + d) - h * s


def rgb(r, g, b):
    return f'#{max(0,min(255,int(r))):02x}{max(0,min(255,int(g))):02x}{max(0,min(255,int(b))):02x}'


def persp_svg():
    polys = []
    for r in range(0, gen.H):
        d_top = CAM_ROW - r
        if d_top <= 0.3 or d_top > gen.FAR_D:
            continue
        sub = 4 if d_top < 20 else 3 if d_top < 40 else 2
        half_view = 0.5 * ACROSS * (FL + d_top) / (FL + PD) + 2
        c_lo = max(0, int(CAM_COL - half_view)); c_hi = min(gen.W - 1, int(CAM_COL + half_view) + 1)
        for si in range(sub):                       # far to near within the row
            ra, rb = r + si / sub, r + (si + 1) / sub
            da, db = CAM_ROW - ra, CAM_ROW - rb
            if db <= 0.05:
                continue
            for c in range(c_lo, c_hi + 1):
                for sj in range(sub):
                    ca, cb = c + sj / sub, c + (sj + 1) / sub
                    cm, dm = (ca + cb) / 2, (da + db) / 2
                    water = river_dist(cm, dm) <= RIVER_W / 2
                    if water:
                        hs = [WATER_LEVEL] * 4
                    else:
                        hs = [vh(ca, ra), vh(cb, ra), vh(cb, rb), vh(ca, rb)]
                    pts = [proj(ca, da, hs[0]), proj(cb, da, hs[1]), proj(cb, db, hs[2]), proj(ca, db, hs[3])]
                    fog = min(1.0, dm / 90.0) ** 0.8
                    if water:
                        sx = (pts[0][0] + pts[2][0]) / 2
                        glint = max(0.0, 1 - abs(sx - SW / 2) / (10 + 60 * FL / (FL + dm)))
                        base = (18 + 150 * glint, 26 + 160 * glint, 58 + 150 * glint)
                    else:
                        # light from the moon, ahead and above: faces tilted toward the camera
                        # and toward the valley's centre catch it
                        dhdc = (vh(cb, (ra + rb) / 2) - vh(ca, (ra + rb) / 2)) / (cb - ca)
                        dhdd = (vh(cm, rb) - vh(cm, ra)) / (da - db)
                        lit = 0.55 + 0.25 * max(-1, min(1, dhdd)) - 0.12 * abs(dhdc)
                        base = (52 * lit, 78 * lit, 60 * lit)
                    col = [b * (1 - fog) + h * fog for b, h in zip(base, (84, 96, 128))]
                    polys.append('<polygon points="%s" fill="%s"/>' % (
                        ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts), rgb(*col)))
    # the figures, pinned to FIG_D like the scene does
    figs = []
    for name, fx, fh in FIGS:
        col = CAM_COL + (fx * SW - SW / 2) / scale(FIG_D)
        x, y = proj(col, FIG_D, vh(col, CAM_ROW - FIG_D))
        figs.append(f'<rect x="{x-7:.1f}" y="{y-fh:.1f}" width="14" height="{fh}" rx="6" fill="#111" opacity="0.85"/>'
                    f'<text x="{x:.1f}" y="{y-fh-4:.1f}" font-size="10" fill="#ccc" text-anchor="middle">{name}</text>')
    # The moon's centre only: its size on screen is not modelled here. The dashed line is
    # where its reflection (the moon road) falls on any water it crosses.
    moon = (f'<line x1="{SW/2}" y1="{MOON_Y}" x2="{SW/2}" y2="{SH}" stroke="#e8e4c8" stroke-width="1" stroke-dasharray="3 4" opacity="0.5"/>'
            f'<circle cx="{SW/2}" cy="{MOON_Y}" r="4" fill="#e8e4c8"/>'
            f'<text x="{SW/2-8}" y="{MOON_Y+3}" font-size="10" fill="#ccc" text-anchor="end">moon centre</text>')
    top = SH - 360
    return (f'<svg x="0" y="0" width="{SW}" height="360" viewBox="0 {top} {SW} 360">'
            f'<rect x="0" y="{top}" width="{SW}" height="360" fill="#0b0f24"/>'
            + ''.join(polys) + moon + ''.join(figs) + '</svg>')


def topdown_svg(y0):
    k = 4
    cells = []
    for r in range(gen.H):
        for c in range(gen.W):
            h = HM[r][c]
            if river_dist(c + 0.5, CAM_ROW - r - 0.5) <= RIVER_W / 2:
                f = '#2d4f8e'
            else:
                v = max(0.0, min(1.0, h / 10.0))
                f = rgb(40 + 120 * v, 70 + 110 * v, 45 + 100 * v)
            cells.append(f'<rect x="{c*k}" y="{r*k}" width="{k}" height="{k}" fill="{f}"/>')
    line = ' '.join(f'{c*k:.1f},{(CAM_ROW-d)*k:.1f}' for c, d in LINE)
    marks = ''.join(f'<circle cx="{c*k:.1f}" cy="{(CAM_ROW-d)*k:.1f}" r="2.5" fill="#fff"/>' for c, d in gen.RIVER_PTS)
    # the camera and its view wedge
    cy = CAM_ROW * k
    wedge = []
    for side in (-1, 1):
        d = gen.FAR_D
        c = CAM_COL + side * 0.5 * ACROSS * (FL + d) / (FL + PD)
        c0 = CAM_COL + side * 0.5 * ACROSS * (FL + 0) / (FL + PD)
        wedge.append(f'<line x1="{c0*k:.1f}" y1="{cy}" x2="{c*k:.1f}" y2="{(CAM_ROW-d)*k:.1f}" stroke="#ff0" stroke-width="1" stroke-dasharray="4 3"/>')
    figs = ''
    for name, fx, _ in FIGS:
        c = CAM_COL + (fx * SW - SW / 2) / scale(FIG_D)
        figs += (f'<circle cx="{c*k:.1f}" cy="{(CAM_ROW-FIG_D)*k:.1f}" r="3.5" fill="#f33"/>'
                 f'<text x="{c*k+6:.1f}" y="{(CAM_ROW-FIG_D)*k+3:.1f}" font-size="9" fill="#fff">{name[0].upper()}</text>')
    return (f'<svg x="{(SW - gen.W*k)/2}" y="{y0}" width="{gen.W*k}" height="{gen.H*k}">'
            + ''.join(cells)
            + f'<polyline points="{line}" fill="none" stroke="#9cf" stroke-width="1" opacity="0.7"/>'
            + marks + ''.join(wedge) + figs
            + f'<circle cx="{CAM_COL*k}" cy="{cy}" r="3" fill="#ff0"/></svg>')


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(os.path.join(
        os.path.dirname(os.path.abspath(__file__)), '../../../public/river_preview.svg'))
    build()
    y0 = 370
    total = y0 + gen.H * 4 + 10
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{SW}" height="{total}" style="background:#111">'
           + persp_svg() + topdown_svg(y0) + '</svg>')
    with open(out, 'w') as f:
        f.write(svg)
    print('wrote', out)
