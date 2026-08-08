#!/usr/bin/env python3
"""
patch_preview_sky_clip.py -- let north-preview building silhouettes draw
above the horizon line.

Run from repo root, AFTER patch_north_preview.py. Idempotent.

THE BUG
    PGR wraps its ENTIRE row loop in a clip:

        this._gCtx.rect(0, horizonPx, sw, sh - horizonPx)
        this._gCtx.clip()

    Everything above the horizon is discarded. That clip is correct for
    ground rows -- yTopClamped lets a near-horizon row reach a full
    tileDisplaySize above the line, and without the clip it would bleed
    into the sky.

    But north-preview BUILDINGS are drawn inside that same loop, and a
    tall one on high ground sits mostly above the horizon. Measured live:
    hall peakY 143, eaveY 184, horizon 180 -- all but a 4px sliver of
    roof thrown away. The wall at 184..235 is entirely below the line, so
    it survived intact, and the result read as a flat-topped rectangle
    with no roof. A canvas readback immediately after ctx.fill() returned
    rgba(0,0,0,0), confirming the fill was discarded rather than
    overpainted.

    The huts escaped notice because they sit on nearer rows, low enough
    that most of their roof falls below the horizon.

    This is also why b0's OWN hall roof renders correctly: RoundhouseRenderer
    .drawOverlay runs from b0.update() after super.update() returns, past
    the matching restore(), so it was never inside the clip.

THE FIX
    A clip can only ever be narrowed, never widened, so the building
    cannot simply opt out from inside the loop. Instead each building
    paints TWICE:

      1. inline, as now -- clipped to below the horizon, which keeps its
         occlusion ordering against nearer terrain correct;
      2. deferred until after the loop's restore(), re-clipped to
         rect(0, 0, sw, horizonPx) -- the sky band only.

    Drawing the sky half last is safe precisely because nothing can
    occlude it: there is no terrain above the horizon. And the two clips
    are complementary, so no pixel is painted twice and translucent
    edgeAlpha does not double up.

NOT FIXED HERE
    Preview TRUNKS have the same clip problem -- tall trees on a
    neighbour's high ground lose their crowns. It does not show today
    because b0 opts out via previewTrunks:false, but the twelve forest
    previews are affected. Same two-pass approach would work; left alone
    to keep this patch to one thing.
"""

import os, sys

PGR = 'js/game/effects/perspectiveGroundRenderer.js'
NP  = 'js/game/effects/pgr/pgrNorthPreview.js'


def main():
    # ── 1. flush deferred sky draws after the loop's restore ─────────────
    src = open(PGR).read()
    if '_northPreviewSky' in src:
        print('  [skip] PGR already flushes deferred preview silhouettes')
    else:
        anchor = """    this._oCtx.restore()
    this._gCtx.restore()"""
        if anchor not in src:
            sys.exit('  [FAIL] post-loop restore pair not found in PGR')
        src = src.replace(anchor, """    this._oCtx.restore()
    this._gCtx.restore()

    // North-preview building silhouettes, sky half. The row loop above
    // runs entirely inside a clip to below the horizon, so a tall
    // neighbour building on high ground had its roof discarded outright.
    // A clip can only be narrowed, never widened, so the buildings queue
    // their above-horizon pass here instead, re-clipped to the sky band.
    // Safe to draw last: nothing exists above the horizon to occlude it,
    // and this band is complementary to the one they already drew in, so
    // no pixel is painted twice.
    if (this._northPreviewSky?.length) {
      this._gCtx.save()
      this._gCtx.beginPath()
      this._gCtx.rect(0, 0, sw, horizonPx)
      this._gCtx.clip()
      for (const paint of this._northPreviewSky) paint()
      this._gCtx.restore()
      this._northPreviewSky.length = 0
    }""", 1)

        # Queue must be emptied at frame start too, or a frame that skips
        # the flush (early return) would replay stale closures next frame.
        anchor2 = """    this._gCtx.save()
    this._gCtx.beginPath()
    this._gCtx.rect(0, horizonPx, sw, sh - horizonPx)
    this._gCtx.clip()"""
        if anchor2 not in src:
            sys.exit('  [FAIL] ground clip block not found in PGR')
        src = src.replace(anchor2, anchor2 + """

    // Reset per frame: closures capture this frame's geometry, so a
    // stale queue would repaint last frame's silhouettes.
    if (this._northPreviewSky) this._northPreviewSky.length = 0
    else this._northPreviewSky = []""", 1)
        open(PGR, 'w').write(src)
        print('  [ok]   PGR queues + flushes preview silhouettes in the sky band')

    # ── 2. building paints once inline, once deferred ────────────────────
    src = open(NP).read()
    if '_northPreviewSky' in src:
        print('  [skip] preview building already double-paints')
        return

    old_head = """    const ctx = pgr._gCtx
    ctx.globalAlpha = edgeAlpha"""
    if old_head not in src:
        sys.exit('  [FAIL] building draw preamble not found')
    src = src.replace(old_head, """    const ctx = pgr._gCtx

    // Painted twice: once here (clipped to below the horizon by the row
    // loop, preserving occlusion against nearer terrain) and once after
    // the loop restores, clipped to the sky band. See
    // patch_preview_sky_clip.py -- a clip cannot be widened from inside.
    const paint = () => {
    ctx.globalAlpha = edgeAlpha""", 1)

    old_tail = """    ctx.closePath()
    ctx.fill()

    ctx.globalAlpha = 1.0
  }"""
    if old_tail not in src:
        sys.exit('  [FAIL] building draw tail not found')
    src = src.replace(old_tail, """    ctx.closePath()
    ctx.fill()

    ctx.globalAlpha = 1.0
    }

    paint()
    ;(pgr._northPreviewSky ??= []).push(paint)
  }""", 1)

    open(NP, 'w').write(src)
    print('  [ok]   preview building paints inline + deferred')


if __name__ == '__main__':
    for p in (PGR, NP):
        if not os.path.exists(p):
            sys.exit(f'{p} not found -- run from repo root')
    print('preview sky clip:')
    main()
    print('done. rebuild with:')
    print('  NODE_OPTIONS=--max-old-space-size=3072 npm run build')
