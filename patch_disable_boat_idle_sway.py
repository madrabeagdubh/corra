#!/usr/bin/env python3
"""
patch_disable_boat_idle_sway.py

Disables the idle sway/breathing animation (breathScale/shift/watch) while
the boat is active. That animation runs whenever the player isn't moving,
with no exclusion for being seated in a boat -- it looks right standing on
land, but applies an unwanted extra wobble on top of the boat's own
idle rock/wobble animation when seated. Requested directly rather than
continuing to tune the facingLeft flip debounce further, since that
debounce (see patch_boat_flip_hysteresis.py) didn't fully resolve the
twitching on its own.

Note: based on reading the code, this animation doesn't itself flip
_facingLeft (it only reads it), so this addresses one specific source of
idle-boat jitter but may be separate from the discrete orientation-flip
bug patch_boat_flip_hysteresis.py targets. Worth testing both together and
reporting back whether the twitch you're seeing is this sway, the discrete
flip, or both -- that'll tell us whether more work is needed on the flip
side specifically.

Idempotent: safe to run more than once.

Run from the repo root:
    python3 patch_disable_boat_idle_sway.py
"""
from pathlib import Path

ROOT = Path.cwd()
TARGET = "js/game/effects/pgr/pgrPlayerBoat.js"

OLD = """      ctx.transform(scaleX * (_playerFacing ?? pgr._facingLeft ? -1 : 1), lean, 0, scaleY, sway, -bounce)
    } else {
      const breathScale = 1.0 + Math.sin(t * 1.1) * 0.014
      const shift       = Math.sin(t * 0.6) * scaledTileW * 0.018
      const watch       = Math.sin(t * 2.1 + 0.5) * scaledTileW * 0.007
      ctx.transform(
        breathScale * ((_playerFacing ?? pgr._facingLeft) ? -1 : 1), 0,
        0, breathScale,
        shift, watch
      )
    }"""

NEW = """      ctx.transform(scaleX * (_playerFacing ?? pgr._facingLeft ? -1 : 1), lean, 0, scaleY, sway, -bounce)
    } else if (pgr._boatActive) {
      // Idle sway/breathing (breathScale/shift/watch below) looks right for
      // a person standing on land but reads as unwanted twitch for a
      // seated figure in a boat -- disabled here per request. The boat's
      // own wobble/rock animation already provides idle motion in this
      // context, so this is just the facing flip with no added sway.
      ctx.transform((_playerFacing ?? pgr._facingLeft) ? -1 : 1, 0, 0, 1, 0, 0)
    } else {
      const breathScale = 1.0 + Math.sin(t * 1.1) * 0.014
      const shift       = Math.sin(t * 0.6) * scaledTileW * 0.018
      const watch       = Math.sin(t * 2.1 + 0.5) * scaledTileW * 0.007
      ctx.transform(
        breathScale * ((_playerFacing ?? pgr._facingLeft) ? -1 : 1), 0,
        0, breathScale,
        shift, watch
      )
    }"""

path = ROOT / TARGET
if not path.exists():
    print(f"✗ {TARGET} does not exist -- run this from the repo root")
    raise SystemExit(1)

text = path.read_text(encoding="utf-8")

if NEW in text:
    print("• already applied, skipping")
elif OLD not in text:
    print(f"✗ expected text not found in {TARGET} -- file has drifted, "
          f"apply by hand: add an `else if (pgr._boatActive) {{...}}` "
          f"branch before the existing idle-sway `else` block that skips "
          f"breathScale/shift/watch and just applies the facing flip, see "
          f"patch source for the exact block.")
else:
    count = text.count(OLD)
    if count > 1:
        print(f"✗ match is not unique ({count}x) -- apply by hand")
    else:
        path.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
        print(f"✓ idle sway/breathing disabled while boat is active")
