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
        src = src.replace(PROBE, '', 1)
        open(TARGET, 'w').write(src)
        print('  [ok]   probe removed')
        return

    if present:
        print('  [skip] probe already present')
        return
    if ANCHOR not in src:
        sys.exit('  [FAIL] peakY line not found -- add the probe by hand '
                 f'after `const peakY` in {TARGET}')
    open(TARGET, 'w').write(src.replace(ANCHOR, ANCHOR + PROBE, 1))
    print('  [ok]   probe added after const peakY')
    print('         walk north in b1 with the console open')


if __name__ == '__main__':
    main()
    print('rebuild with:')
    print('  NODE_OPTIONS=--max-old-space-size=3072 npm run build')
