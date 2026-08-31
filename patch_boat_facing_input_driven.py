#!/usr/bin/env python3
"""
patch_boat_facing_input_driven.py  (v3, supersedes patch_boat_flip_hysteresis.py)

Two rounds of widening/debouncing the velocity threshold that drove the
boat's left/right facing both failed to stop it occasionally flipping
while sitting idle (confirmed against two separate screen recordings).
Idle drift keeps boatVX nonzero even when nothing is being paddled, so
filtering that signal was always going to be chasing noise with an
unknown ceiling.

This replaces the velocity-threshold approach entirely: facing now only
updates while there's active paddle/path input, and holds a fixed
direction (left) whenever there isn't. No velocity signal is read at all
while idle, so there's nothing left to flip on.

MATCHING STRATEGY: earlier versions of this patch (and its predecessor,
patch_boat_flip_hysteresis.py) matched on the full block including its
explanatory comment. That comment text drifted across runs -- a repo
that ran an early version of the hysteresis script, then a later
"upgrade just the two numbers" version, ended up with v1's comment sitting
above v2's numbers, a combination neither script anticipated, and both
failed to match. This version anchors only on the invariant code tail
(the candidateLeft ternary through the closing if/else chain) that has
been byte-identical across every version of that fix -- the comment and
the two FLIP_THRESHOLD/FLIP_HOLD_FRAMES constants above it are left alone
(now dead/unused code, harmless) rather than matched, since they're the
part that kept drifting.

Handles two possible starting states:
  - Never patched (original 4-line threshold check)
  - Any hysteresis-debounce variant applied (v1, v2, or any hybrid of the
    two), regardless of exact comment wording or constant values

Idempotent: safe to run more than once regardless of starting state.

Run from the repo root:
    python3 patch_boat_facing_input_driven.py
"""
from pathlib import Path

ROOT = Path.cwd()
TARGET = "js/game/effects/pgr/pgrPlayerBoat.js"

# Matches the pristine, never-patched original.
ORIGINAL = """if (pgr._boatActive) {
  if (boatVX < -4)      pgr._facingLeft = true
  else if (boatVX > 4)  pgr._facingLeft = false
} else if (p?.isMoving) {"""

# Matches the invariant tail of ANY hysteresis-debounce variant (v1, v2, or
# a hybrid), regardless of the comment or FLIP_THRESHOLD/FLIP_HOLD_FRAMES
# values sitting above it. This is the part that never changed between
# versions.
DEBOUNCE_TAIL = """  const candidateLeft = boatVX < -FLIP_THRESHOLD ? true
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
} else if (p?.isMoving) {"""

FRESH_V3 = """if (pgr._boatActive) {
  // Facing is driven by whether there's active paddle/path input, not by
  // velocity: idle drift keeps boatVX nonzero on its own, and two rounds
  // of widening/debouncing the velocity threshold both failed to stop the
  // sprite occasionally flipping while sitting still (confirmed against
  // screen recordings). Rather than keep filtering a signal that's
  // inherently noisy at idle, sidestep it -- facing only updates while
  // actually being paddled/steered, and holds a fixed direction otherwise.
  const joystickActive = (pgr.scene?.joystick?.force ?? 0) > 10
  const pathActive     = (pgr.scene?.boatSystem?._pathForce ?? 0) > 10
  if (joystickActive || pathActive) {
    if (boatVX < -4)      pgr._facingLeft = true
    else if (boatVX > 4)  pgr._facingLeft = false
  } else {
    pgr._facingLeft = true   // fixed idle orientation
  }
} else if (p?.isMoving) {"""

# Used when replacing just the debounce tail -- doesn't repeat
# "if (pgr._boatActive) {" since that line is already there, above
# whatever stale comment/constants are being left in place.
TAIL_REPLACEMENT = """  const joystickActive = (pgr.scene?.joystick?.force ?? 0) > 10
  const pathActive     = (pgr.scene?.boatSystem?._pathForce ?? 0) > 10
  if (joystickActive || pathActive) {
    if (boatVX < -4)      pgr._facingLeft = true
    else if (boatVX > 4)  pgr._facingLeft = false
  } else {
    pgr._facingLeft = true   // fixed idle orientation
  }
} else if (p?.isMoving) {"""

MARKER = "pgr._facingLeft = true   // fixed idle orientation"

path = ROOT / TARGET
if not path.exists():
    print(f"✗ {TARGET} does not exist -- run this from the repo root")
    raise SystemExit(1)

text = path.read_text(encoding="utf-8")

if MARKER in text:
    print("• already at v3 (input-driven facing), skipping")
elif DEBOUNCE_TAIL in text:
    count = text.count(DEBOUNCE_TAIL)
    if count > 1:
        print(f"✗ match is not unique ({count}x) -- apply by hand")
    else:
        text = text.replace(DEBOUNCE_TAIL, TAIL_REPLACEMENT, 1)
        path.write_text(text, encoding="utf-8")
        print("✓ upgraded to v3 (input-driven facing) -- note: the old "
              "comment and FLIP_THRESHOLD/FLIP_HOLD_FRAMES constants above "
              "it are left in place as dead code, harmless but no longer "
              "used; delete them by hand if you want it tidy")
elif ORIGINAL in text:
    count = text.count(ORIGINAL)
    if count > 1:
        print(f"✗ match is not unique ({count}x) -- apply by hand")
    else:
        text = text.replace(ORIGINAL, FRESH_V3, 1)
        path.write_text(text, encoding="utf-8")
        print("✓ applied v3 directly (fresh install)")
else:
    print(f"✗ none of the expected patterns found in {TARGET} -- "
          f"file has drifted further than expected. Paste the output of:\n"
          f"  sed -n '83,115p' {TARGET}\n"
          f"and it can be matched by hand.")
