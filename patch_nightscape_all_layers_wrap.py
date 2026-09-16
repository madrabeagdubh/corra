#!/usr/bin/env python3
"""
patch_nightscape_all_layers_wrap.py

Generalizes patch_nightscape_midhead_wrap.py from "midHead only" to all
three backdrop plates (farRidge, midHead, nearFg), now that farRidge.png
and nearForeground.png have been replaced with wider art suited to
looping (see the accompanying image files -- copy them into
public/assets/nightscape/, overwriting the old ones, before this
matters visually).

CHANGES:
  - Box construction: repeat-x applies to any layer with L.top !==
    undefined (i.e. any backdrop plate), not just L.key === 'midHead'.
  - wrapVwFor(z) replaces the single MIDHEAD_WRAP_VW constant -- each
    layer gets its own swing, scaled by depth so nearer layers still
    move more (120/z: farRidge z=8 -> 15vw, midHead z=3 -> 40vw,
    unchanged from before, nearFg z=2.2 -> ~54.5vw).
  - made.push()'s wraps flag is now L.top !== undefined instead of a
    hardcoded key check.
  - setPan() reads m.wrapVw (set per-layer at creation) instead of a
    single shared constant.

druid/queen (figures, no L.top) are untouched -- still the overhang-
capped transform approach from patch_nightscape_land_pan_full_width.py,
since they're small sprites, not backdrop plates meant to tile.

Idempotent: guarded on wrapVwFor's presence.
"""
import sys
from pathlib import Path

TARGET = Path("js/game/effects/nightScape.js")

CONST_OLD = """// midHead alone tiles (repeat-x, see box construction above), so it can't
// run out of image -- it gets a much larger, unclamped swing instead of
// the overhang-capped maximum every other layer uses.
const MIDHEAD_WRAP_VW = 40;"""

CONST_NEW = """// Every backdrop plate tiles now (repeat-x, see box construction below), so
// none of them can run out of image -- each gets a much larger, unclamped
// swing instead of the overhang-capped maximum figures (druid/queen) still
// use. Scaled by depth so nearer layers still move more, same as the
// overhang-capped approach did: farRidge z=8 -> 15vw, midHead z=3 -> 40vw
// (unchanged from the midHead-only version), nearFg z=2.2 -> ~54.5vw.
const wrapVwFor = z => 120 / z;"""

BOX_OLD = """            if (L.key === 'midHead') {
                // Genuinely repeating instead of cover/no-repeat: midHeadland is a
                // repetitive treeline with no single unique landmark, so tiling it
                // doesn't visibly duplicate anything -- unlike farRidge (one
                // distinctive rock) or nearFg (a distinctive valley shape), which
                // stay as cover/no-repeat. `auto <height>` keeps the tile at the
                // image's own aspect ratio (unlike `cover`, which sizes from BOTH
                // box dimensions and would distort a repeating tile).
                box = `width:${(L.vw / s).toFixed(2)}vw;height:${(cover + drop).toFixed(2)}vh;` +
                      `background:url(${DIR}${L.file}) repeat-x 0 100%/auto ${(cover + drop).toFixed(2)}vh;`;
            } else {
                box = `width:${(L.vw / s).toFixed(2)}vw;height:${(cover + drop).toFixed(2)}vh;` +
                      `background:url(${DIR}${L.file}) no-repeat 50% 100%/cover;`;
            }"""

BOX_NEW = """            // Genuinely repeating rather than cover/no-repeat, now that all three
            // backdrop plates have art suited to it. `auto <height>` keeps each
            // tile at the image's own aspect ratio (unlike `cover`, which sizes
            // from BOTH box dimensions and would distort a repeating tile).
            box = `width:${(L.vw / s).toFixed(2)}vw;height:${(cover + drop).toFixed(2)}vh;` +
                  `background:url(${DIR}${L.file}) repeat-x 0 100%/auto ${(cover + drop).toFixed(2)}vh;`;"""

PUSH_OLD = """        made.push({ wrap, el, lit, endScale: s, maxPanVw: maxPanVwFor(L),
                    wraps: L.key === 'midHead' });"""
PUSH_NEW = """        made.push({ wrap, el, lit, endScale: s, maxPanVw: maxPanVwFor(L),
                    wraps: L.top !== undefined, wrapVw: wrapVwFor(L.z) });"""

SETPAN_OLD = """                if (m.wraps) {
                    // repeat-x wraps automatically and infinitely -- no clamping,
                    // no need to touch the centering transform at all.
                    m.el.style.backgroundPositionX = (f * MIDHEAD_WRAP_VW).toFixed(2) + 'vw';
                    return;
                }"""
SETPAN_NEW = """                if (m.wraps) {
                    // repeat-x wraps automatically and infinitely -- no clamping,
                    // no need to touch the centering transform at all.
                    m.el.style.backgroundPositionX = (f * m.wrapVw).toFixed(2) + 'vw';
                    return;
                }"""

BLOCKS = [
    ("wrapVwFor constant",       CONST_OLD,  CONST_NEW),
    ("box construction",         BOX_OLD,    BOX_NEW),
    ("made.push() (wraps/wrapVw)", PUSH_OLD, PUSH_NEW),
    ("setPan() (per-layer wrapVw)", SETPAN_OLD, SETPAN_NEW),
]


def patch(text):
    if "wrapVwFor" in text:
        print("  - already applied, skipping")
        return text, False

    missing = [name for name, old, _ in BLOCKS if old not in text]
    if missing:
        print(f"  ! marker(s) not found for: {', '.join(missing)} -- "
              f"has patch_nightscape_midhead_wrap.py been applied? check by hand")
        return text, False

    for name, old, new in BLOCKS:
        text = text.replace(old, new, 1)
        print(f"  - {name}: updated")

    return text, True


def main():
    if not TARGET.exists():
        print(f"Can't find {TARGET} -- run this from the repo root.")
        sys.exit(1)

    original = TARGET.read_text()
    patched, changed = patch(original)

    if changed:
        TARGET.write_text(patched)
        print(f"Patched {TARGET}")
    else:
        print("Nothing to do -- already applied.")


if __name__ == "__main__":
    main()
