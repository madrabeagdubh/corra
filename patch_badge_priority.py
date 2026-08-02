#!/usr/bin/env python3
"""
patch_badge_priority.py -- Corra: the disembark badge stops fighting NPCs.

THE ACTUAL CAUSE of the badge flicker (the timer fixes in
patch_badge_race.py were real but not this).

The moon badge is a single UI slot, and TWO systems drive it:

  * checkProximityInteractions() -> notify(<the NPC card>)
  * the disembark check          -> notify({id:'disembark'}) / clearNotify()

Both run every frame while the player is in a boat. The disembark check
fires whenever the boat is beside land -- and an NPC on a headland is,
necessarily, beside land. So approaching Muireann the two calls alternate:
her card is installed, the disembark card overwrites it, the disembark
check goes false and calls clearNotify(), which takes her badge down while
she is still perfectly in range. Hence "sometimes it doesn't appear,
sometimes it doesn't disappear" -- it depends which one won that frame.

FIX: a conversation outranks a manoeuvre. While a flag is in range the
disembark badge neither shows nor clears. When the flag drops out of range
the disembark state resets, so the badge reappears on the next frame if the
boat is still ashore.

TRADE-OFF WORTH KNOWING: Muireann's radius is currently 20 tiles, which
covers most of the estuary, so the disembark badge is suppressed over a
wide area of d3_sea. That is an argument for the map edit discussed
earlier (bring the lane north, drop the radius to ~8) rather than for
letting the two badges keep fighting.

Run from the repo root:  python3 patch_badge_priority.py
Idempotent; aborts without writing if expected text is missing.
"""
import io, os, sys

ROOT = os.getcwd()
def read(p):
    with io.open(os.path.join(ROOT, p), encoding='utf-8') as f: return f.read()
def write(p, s):
    with io.open(os.path.join(ROOT, p), 'w', encoding='utf-8') as f: f.write(s)

def sub_once(src, old, new, label, sentinel=None):
    if sentinel is None:
        added = [ln for ln in new.split('\n') if ln.strip() and ln not in old]
        sentinel = max(added, key=len) if added else None
    if sentinel and sentinel in src:
        print('  = already applied: %s' % label); return src
    if old not in src:
        print('  ! NOT FOUND: %s\n    aborting, nothing written' % label); sys.exit(1)
    if src.count(old) != 1:
        print('  ! AMBIGUOUS (%d matches): %s' % (src.count(old), label)); sys.exit(1)
    print('  + %s' % label)
    return src.replace(old, new, 1)

P = 'js/game/scenes/locations/baseLocationScene.js'
src = read(P)
print(P)

OLD = """if (!this._noDisembarkUI && this.player?.inBoat && this.boatSystem?.active) {"""
NEW = """// A conversation outranks a manoeuvre. While an encounter flag is in range
// the disembark badge must neither claim the badge slot nor clear it: both
// systems drive the same single UI element, and an NPC standing on a
// headland is by definition beside land, so without this guard the two
// alternate every frame and the badge flickers on and off.
if (this._flagInRange && this._disembarkBadgeShown) {
  // Hand the slot over cleanly, and forget we were showing it, so the
  // badge comes back by itself once the flag drops out of range.
  this._disembarkBadgeShown = false
  this.joystick?.drawBadgeGlow?.(0)
}

if (!this._flagInRange && !this._noDisembarkUI && this.player?.inBoat && this.boatSystem?.active) {"""
src = sub_once(src, OLD, NEW, 'flag in range outranks the disembark badge')
write(P, src)

print('\nDone.')
