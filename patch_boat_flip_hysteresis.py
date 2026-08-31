#!/usr/bin/env python3
"""
patch_boat_flip_hysteresis.py  (v2)

Fixes the boat sprite flipping left/right unpredictably while sitting
idle in open water.

The boat's facing direction is driven by boatVX crossing a threshold in
pgrPlayerBoat.js. boatSystem.js applies a small continuous eastward drift
any time the boat is idle on open water, and there may be additional
joystick noise near its own deadzone -- either can walk boatVX back and
forth across a narrow window while the boat isn't actually being paddled,
flipping the sprite each crossing. Real paddling moves the boat at
80-160 px/s, well clear of any reasonable threshold here.

v1 of this fix (widened threshold to 12 px/s, required 6 consecutive
frames before committing to a flip) measurably reduced the problem but
didn't eliminate it -- a screen recording showed two brief (<125ms) flip
incidents surviving the 6-frame hold across 5.7 seconds of idling. v2
raises the hold to 30 frames (~500ms at 60fps) and the threshold to 15,
comfortably covering noise bursts of that length while still being far
faster than any deliberate directional change during actual paddling.

Detects which of three states the file is in before doing anything:
  - Never patched (has the original 4-line threshold check)
  - v1 already applied (has the 6-frame-hold version)
  - v2 already applied (nothing to do)

Idempotent: safe to run more than once regardless of starting state.

Run from the repo root:
    python3 patch_boat_flip_hysteresis.py
"""
from pathlib import Path

ROOT = Path.cwd()
TARGET = "js/game/effects/pgr/pgrPlayerBoat.js"

ORIGINAL = """if (pgr._boatActive) {
  if (boatVX < -4)      pgr._facingLeft = true
  else if (boatVX > 4)  pgr._facingLeft = false
} else if (p?.isMoving) {
  if (p.moveDirection.x < 0)      pgr._facingLeft = true
  else if (p.moveDirection.x > 0) pgr._facingLeft = false
}"""

V2 = """if (pgr._boatActive) {
  // Idle drift (boatSystem.js's east current) plus joystick noise near its
  // own deadzone can push boatVX back and forth across a narrow threshold
  // many times a second while the boat isn't actually being paddled --
  // each crossing used to flip the sprite, causing a visible left/right
  // twitch at rest. Real paddling moves the boat at 80-160 px/s, an order
  // of magnitude above this, so widening the deadzone costs nothing there.
  // Requiring the new direction to hold for 30 consecutive frames (~500ms
  // at 60fps) before committing filters out noise bursts up to that
  // length -- confirmed against a recording showing brief (<125ms) flip
  // incidents surviving a shorter 6-frame hold, before this was increased.
  const FLIP_THRESHOLD    = 15
  const FLIP_HOLD_FRAMES  = 30
  const candidateLeft = boatVX < -FLIP_THRESHOLD ? true
                      : boatVX >  FLIP_THRESHOLD ? false
                      : null
  if (candidateLeft === null || candidateLeft === pgr._facingLeft) {
    pgr._facingLeftHold = 0
  } else if (candidateLeft === pgr._facingLeftCandidate) {
    pgr._facingLeftHold = (pgr._facingLeftHold ?? 0) + 1
    if (pgr._facingLeftHold >= FLIP_HOLD_FRAMES) {
      pgr._facingLeft = candidateLeft
      pgr._facingLeftHold = 0
    }
  } else {
    pgr._facingLeftCandidate = candidateLeft
    pgr._facingLeftHold = 1
  }
} else if (p?.isMoving) {
  if (p.moveDirection.x < 0)      pgr._facingLeft = true
  else if (p.moveDirection.x > 0) pgr._facingLeft = false
}"""

V1_CONSTANTS = """  const FLIP_THRESHOLD    = 12
  const FLIP_HOLD_FRAMES  = 6"""

V2_CONSTANTS = """  const FLIP_THRESHOLD    = 15
  const FLIP_HOLD_FRAMES  = 30"""

path = ROOT / TARGET
if not path.exists():
    print(f"✗ {TARGET} does not exist -- run this from the repo root")
    raise SystemExit(1)

text = path.read_text(encoding="utf-8")

if V2_CONSTANTS in text:
    print("• already at v2 (30-frame hold), skipping")
elif V1_CONSTANTS in text:
    text = text.replace(V1_CONSTANTS, V2_CONSTANTS, 1)
    path.write_text(text, encoding="utf-8")
    print("✓ upgraded v1 -> v2 (6 -> 30 frame hold)")
elif ORIGINAL in text:
    count = text.count(ORIGINAL)
    if count > 1:
        print(f"✗ match is not unique ({count}x) -- apply by hand")
    else:
        text = text.replace(ORIGINAL, V2, 1)
        path.write_text(text, encoding="utf-8")
        print("✓ applied v2 directly (fresh install)")
else:
    print(f"✗ none of the expected patterns found in {TARGET} -- "
          f"file has drifted further than expected, apply by hand: "
          f"raise FLIP_THRESHOLD to 15 and FLIP_HOLD_FRAMES to 30 in the "
          f"boat facingLeft debounce block, see patch source for context.")
