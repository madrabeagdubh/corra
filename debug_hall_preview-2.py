#!/usr/bin/env python3
"""
debug_hall_preview.py -- add (or remove) a throttled probe on the hall's
north-preview silhouette.

  python3 debug_hall_preview.py        # add the probe
  python3 debug_hall_preview.py --off  # remove it

Run from repo root. Idempotent both ways. Rebuild after either.

Logs once a second rather than once a frame -- the unthrottled version
fires ~60x/sec and buries everything else in the console. Walk south-to-
north in b1 with the console open and watch the numbers change as you
approach.

WHAT TO LOOK FOR
  roofPx     -- eaveY minus peakY. Should be around 95-125px on the way
                in. If it is single digits, the roof is being computed
                flat and the problem is upstream of the fill.
  NaN        -- any NaN in x or y means the roof path is invalid, canvas
                silently draws nothing, and the wall (which does not use
                roofH) still renders as a flat-topped rectangle. That
                would match the screenshots exactly.
  aboveHz    -- whether the roof sits entirely above the horizon line.
                The huts straddle it and render; the hall does not, which
                is the one asymmetry I have not been able to rule out.
  wallH/roofH-- confirms KIND_STYLE actually arrived through the import
                rather than falling back to the dwelling defaults.
"""

import os, sys

TARGET = 'js/game/effects/pgr/pgrNorthPreview.js'
ANCHOR = "    const peakY = baseY - (style.wallH + style.roofH) * scale"
MARKER = '__hallProbe'

PROBE = """
    // TEMPORARY DIAGNOSTIC -- remove with debug_hall_preview.py --off
    if (isLonghall) {
      const _t = Date.now()
      if (!globalThis.__hallProbe || _t - globalThis.__hallProbe > 1000) {
        globalThis.__hallProbe = _t
        globalThis.__hallProbeDraw = { pgr, xEaveL, xEaveR, eaveY, peakY }
        const _n = (v) => Number.isFinite(v) ? Math.round(v * 10) / 10 : ('BAD:' + v)
        console.log('[hall] row=' + tileRow
          + ' scale=' + _n(scale)
          + ' baseY=' + _n(baseY) + ' eaveY=' + _n(eaveY) + ' peakY=' + _n(peakY)
          + ' roofPx=' + _n(eaveY - peakY) + ' wallPx=' + _n(baseY - eaveY)
          + ' xEave=' + _n(xEaveL) + '..' + _n(xEaveR)
          + ' xWall=' + _n(xLeft) + '..' + _n(xRight)
          + ' hz=' + pgr._horizonPx?.()
          + ' canvas=' + pgr._gCtx?.canvas?.width + 'x' + pgr._gCtx?.canvas?.height
          + ' haze=' + _n(hazeT) + ' alpha=' + _n(edgeAlpha))
      }
    }"""

# Read the canvas back straight after the roof fill. If the pixel is brown
# here but the roof is absent on screen, something later in the frame is
# painting over it, and the search halves. If the pixel is already NOT
# brown, the fill itself never landed.
READBACK_ANCHOR = "    ctx.closePath()\n    ctx.fill()\n\n    ctx.globalAlpha = 1.0\n  }"
READBACK = """    ctx.closePath()
    ctx.fill()

    // TEMPORARY DIAGNOSTIC -- remove with debug_hall_preview.py --off
    if (isLonghall && globalThis.__hallProbeDraw?.pgr === pgr
        && globalThis.__hallProbeRead !== globalThis.__hallProbe) {
      globalThis.__hallProbeRead = globalThis.__hallProbe
      try {
        const _cw = ctx.canvas.width, _chh = ctx.canvas.height
        const _px = Math.round(Math.max(0, Math.min(_cw - 1, (xEaveL + xEaveR) / 2)))
        const _py = Math.round(Math.max(0, Math.min(_chh - 1, (eaveY + peakY) / 2)))
        const _d = ctx.getImageData(_px, _py, 1, 1).data
        console.log('[hall] roof pixel right after fill at (' + _px + ',' + _py + ') = rgba('
          + _d[0] + ',' + _d[1] + ',' + _d[2] + ',' + _d[3] + ')  expect a dark brown ~(110,88,60)')
      } catch (e) { console.log('[hall] readback failed:', e.message) }
    }

    ctx.globalAlpha = 1.0
  }"""

LEGACY_PROBE = """
    // TEMPORARY DIAGNOSTIC -- remove with debug_hall_preview.py --off
    if (isLonghall) {
      const _t = Date.now()
      if (!globalThis.__hallProbe || _t - globalThis.__hallProbe > 1000) {
        globalThis.__hallProbe = _t
        const _bad = [scale, baseY, eaveY, peakY, xEaveL, xEaveR, xLeft, xRight]
          .some(v => !Number.isFinite(v))
        console.log('[hall preview]', {
          tileRow, localRow,
          wallH: style.wallH, roofH: style.roofH,
          scale: +scale.toFixed(1),
          baseY: +baseY.toFixed(0), eaveY: +eaveY.toFixed(0), peakY: +peakY.toFixed(0),
          roofPx: +(eaveY - peakY).toFixed(0),
          wallPx: +(baseY - eaveY).toFixed(0),
          xEaveL: +xEaveL.toFixed(0), xEaveR: +xEaveR.toFixed(0),
          horizonPx: pgr._horizonPx?.(),
          aboveHz: eaveY < (pgr._horizonPx?.() ?? 0),
          hazeT: +hazeT.toFixed(3), edgeAlpha: +edgeAlpha.toFixed(3),
          NaN_PRESENT: _bad,
        })
      }
    }"""


def strip_all(src):
    """Remove any probe version. v1 and v2 share the __hallProbe marker, so
    version-blind removal is what makes the order you run things in
    irrelevant -- otherwise v2 sees v1's marker, assumes its own probe is
    already installed, and silently no-ops."""
    src = src.replace(PROBE, '', 1)
    src = src.replace(LEGACY_PROBE, '', 1)
    src = src.replace(READBACK, READBACK_ANCHOR, 1)
    return src


def main():
    off = '--off' in sys.argv
    if not os.path.exists(TARGET):
        sys.exit(f'{TARGET} not found -- run from repo root')
    src = open(TARGET).read()
    present = MARKER in src

    if off:
        if not present:
            print('  [skip] probe not present')
            return
        src = strip_all(src)
        open(TARGET, 'w').write(src)
        print('  [ok]   probe removed (any version)')
        return

    if present:
        # Could be v1 from an earlier run. Strip whatever is there and
        # reinstall, rather than skipping and leaving the old one in place.
        src = strip_all(src)
        print('  [ok]   removed an existing probe first')
    if ANCHOR not in src:
        sys.exit('  [FAIL] peakY line not found -- add the probe by hand '
                 f'after `const peakY` in {TARGET}')
    src = src.replace(ANCHOR, ANCHOR + PROBE, 1)
    if READBACK_ANCHOR not in src:
        sys.exit('  [FAIL] roof fill / globalAlpha reset not found')
    src = src.replace(READBACK_ANCHOR, READBACK, 1)
    open(TARGET, 'w').write(src)
    print('  [ok]   probe + pixel readback added')
    print('         walk north in b1 with the console open')


if __name__ == '__main__':
    main()
    print('rebuild with:')
    print('  NODE_OPTIONS=--max-old-space-size=3072 npm run build')
