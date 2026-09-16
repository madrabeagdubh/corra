#!/usr/bin/env python3
"""
patch_nightscape_figures_lock_to_nearfg.py

Locks druid/queen's horizontal pan to nearFg's, so they read as standing
on that layer and sliding with it, rather than moving at their own,
independently-derived rate.

Previously, maxPanVwFor()'s fallback (used only by druid/queen, the two
layers with no L.vw of their own) borrowed midHead's OLD static overhang
-- a leftover from before midHead itself started wrapping, no longer a
meaningful reference now that all three backdrop plates tile.

This changes that fallback to wrapVwFor(nearFg.z) instead -- the exact
same swing amount nearFg itself uses. druid/queen still move via
transform:translateX (they're single sprites, not tiling backgrounds,
so they can't wrap the way nearFg does), but since panCameraTo() already
clamps its fraction to [-1, 1], nearFg's own background-position-x
shift never exceeds one full swing either -- so matching that same vw
amount keeps druid/queen's apparent motion pinned to the foreground's,
without needing them to tile themselves.

Idempotent: guarded on the nearFg reference's presence.
"""
import sys
from pathlib import Path

TARGET = Path("js/game/effects/nightScape.js")

OLD = """const maxPanVwFor = L => (L.vw !== undefined)
    ? (L.vw - 100) / 2
    : (LAYERS.find(x => x.key === 'midHead').vw - 100) / 2;"""

NEW = """// druid/queen (the only layers with no L.vw) lock to nearFg's own wrap
// swing, not an independent amount -- they stand on that layer and should
// slide with it exactly, not at their own rate.
const maxPanVwFor = L => (L.vw !== undefined)
    ? (L.vw - 100) / 2
    : wrapVwFor(LAYERS.find(x => x.key === 'nearFg').z);"""


def patch(text):
    if "lock to nearFg's own wrap" in text:
        print("  - already applied, skipping")
        return text, False

    if OLD not in text:
        print("  ! marker not found -- check by hand")
        return text, False

    text = text.replace(OLD, NEW, 1)
    print("  - druid/queen: pan amount now locked to nearFg's wrapVw")
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
