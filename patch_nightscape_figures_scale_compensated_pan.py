#!/usr/bin/env python3
"""
patch_nightscape_figures_scale_compensated_pan.py

Fixes druid/queen still sliding at a different rate than nearFg despite
patch_nightscape_figures_lock_to_nearfg.py giving them the same raw
wrapVw number.

THE ACTUAL BUG
Each layer's wrap (parent of el, the element the pan transform is
applied to) carries its own recede scale, scaleFor(z) -- fixed at
endScale by the time any constellation panning happens, well after the
dial's pull-back has already completed and settled. That parent scale
MULTIPLIES whatever translation happens on the child: apparent on-screen
shift = raw_vw * scaleFor(z). druid/queen (z=3) and nearFg (z=2.2) have
different z, so different scaleFor(z) -- giving them the same raw
wrapVw number does NOT produce the same apparent shift, since it gets
scaled differently by each one's own parent.

THE FIX
druid/queen's pan amount is now nearFg's wrapVw, compensated by the
RATIO of the two scales: wrapVw_nearFg * (scaleFor(nearFg.z) /
scaleFor(L.z)). This makes apparent_shift_figures == apparent_shift_
nearFg exactly: (wrapVw_nearFg * ratio) * scaleFor(L.z) simplifies to
wrapVw_nearFg * scaleFor(nearFg.z), the same value nearFg's own shift
resolves to.

Idempotent: guarded on the compensation's presence.
"""
import sys
from pathlib import Path

TARGET = Path("js/game/effects/nightScape.js")

OLD = """// druid/queen (the only layers with no L.vw) lock to nearFg's own wrap
// swing, not an independent amount -- they stand on that layer and should
// slide with it exactly, not at their own rate.
const maxPanVwFor = L => (L.vw !== undefined)
    ? (L.vw - 100) / 2
    : wrapVwFor(LAYERS.find(x => x.key === 'nearFg').z);"""

NEW = """// druid/queen (the only layers with no L.vw) lock to nearFg's own wrap
// swing, not an independent amount -- they stand on that layer and should
// slide with it exactly, not at their own rate. Matching wrapVw's raw
// number alone isn't enough: each layer's wrap carries its own recede
// scale (scaleFor(z), fixed by the time any panning happens), which
// MULTIPLIES whatever translation the child (el) gets -- apparent shift =
// raw_vw * scaleFor(z). druid/queen (z=3) and nearFg (z=2.2) scale
// differently, so the same raw number would still move at different
// apparent rates. Compensating by the ratio of the two scales makes the
// APPARENT shift match exactly, not just the raw vw figure.
const nearFgZ = LAYERS.find(x => x.key === 'nearFg').z;
const maxPanVwFor = L => (L.vw !== undefined)
    ? (L.vw - 100) / 2
    : wrapVwFor(nearFgZ) * (scaleFor(nearFgZ) / scaleFor(L.z));"""


def patch(text):
    if "each layer's wrap carries its own recede" in text:
        print("  - already applied, skipping")
        return text, False

    if OLD not in text:
        print("  ! marker not found -- has patch_nightscape_figures_lock_to_nearfg.py "
              "been applied? check by hand")
        return text, False

    text = text.replace(OLD, NEW, 1)
    print("  - druid/queen: pan amount now scale-compensated to match nearFg's apparent rate")
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
