#!/usr/bin/env python3
# unify_door_proximity.py
# Run from anywhere:  python3 unify_door_proximity.py
#
# Fixes the unpredictable / inverted door badge (lingers when far, clears when
# you re-approach).
#
# Root cause: the base runs, every frame:
#     this._flagInRange = false
#     this.checkProximityInteractions()
#     if (!this._flagInRange) this._encounterPanel.clearNotify()
# Harp/NPC set _flagInRange=true so the base leaves them alone. But the door was
# handled in _updateDoorProximity AFTER super.update() -- i.e. after the base's
# clear check -- and never set _flagInRange. So the base started a (grace-timer)
# clear every frame while the door re-asserted; a clear started while walking
# away then fired right as you returned (notify() skips re-asserting a same-id
# card), producing the inversion.
#
# Fix: handle the door INSIDE checkProximityInteractions so it sets _flagInRange
# like everything else, and stop the separate post-update pass. (_updateDoorProximity
# is left in place but no longer called -- harmless dead code you can delete later.)

import os, sys

def find_root():
    for c in (os.getcwd(), os.path.expanduser("~/Corra")):
        if os.path.exists(os.path.join(c, "js/game/scenes/locations/perspectiveScene.js")):
            return c
    return None

ROOT = find_root()
if not ROOT:
    print("XX  couldn't find the repo -- run from the Corra root."); sys.exit(1)
P = os.path.join(ROOT, "js/game/scenes/locations/perspectiveScene.js")

s = open(P, encoding="utf-8").read()
if "_checkDoorProximity" in s:
    print("OK  already patched -- nothing to do."); sys.exit(0)

edits = 0

# (1) stop the separate post-update door pass
a = "    super.update(time, delta)\n    this._updateDoorProximity()"
b = "    super.update(time, delta)"
if a in s:
    s = s.replace(a, b, 1); edits += 1
    print("  [OK ] update(): removed post-update _updateDoorProximity() call")
else:
    print("  [XX ] update(): _updateDoorProximity() call anchor")

# (2) add the unified door proximity, run inside the proximity pass
methods = (
"  // ── Unified door proximity ────────────────────────────────────────────────\n"
"  // Doors must participate in the SAME per-frame _flagInRange protocol as\n"
"  // harp/NPC/encounter flags. The base does, each frame:\n"
"  //     this._flagInRange = false\n"
"  //     this.checkProximityInteractions()\n"
"  //     if (!this._flagInRange) this._encounterPanel.clearNotify()\n"
"  // so a door badge is only kept alive by setting _flagInRange here -- and the\n"
"  // base's own clearNotify() handles hiding it (with its grace timer) when you\n"
"  // leave. Running this AFTER super.update() instead (the old _updateDoorProximity)\n"
"  // let the base fight the door every frame and produced the inverted flicker.\n"
"  checkProximityInteractions() {\n"
"    if (this._checkDoorProximity()) return\n"
"    super.checkProximityInteractions()\n"
"  }\n"
"\n"
"  _checkDoorProximity() {\n"
"    if (this._exiting || !this.player || !this._encounterPanel) return false\n"
"    const zones = this._doorZones\n"
"    if (!zones?.length) return false\n"
"    const px = this.player.logicalX, py = this.player.logicalY\n"
"    const R  = PerspectiveScene.DOOR_RADIUS_TILES * this.tileSize\n"
"    let nearest = null, nearestDist = Infinity\n"
"    for (const z of zones) {\n"
"      const dist = Phaser.Math.Distance.Between(px, py, z.getData('logicalX'), z.getData('logicalY'))\n"
"      if (dist < R && dist < nearestDist) { nearestDist = dist; nearest = z }\n"
"    }\n"
"    if (!nearest) return false\n"
"    const door   = nearest.getData('door')\n"
"    const cardId = 'door:' + door.id\n"
"    this._flagInRange = true   // keep the base from clearing while we're at the door\n"
"    if (this._encounterPanel._card?.id !== cardId) {\n"
"      this._encounterPanel.notify({\n"
"        id:      cardId,\n"
"        visual:  door.visual || PerspectiveScene.DOOR_VISUAL,\n"
"        ga:      door.ga || 'An doras',\n"
"        en:      door.en || 'The door',\n"
"        _isDoor: true,\n"
"        _door:   door,\n"
"      }, nearest)\n"
"    }\n"
"    this._encounterPanel._openPanel = () => this._triggerDoor(door)\n"
"    return true\n"
"  }\n"
"\n"
)
a = "  // ── Intro narrative"
if a in s:
    s = s.replace(a, methods + a, 1); edits += 1
    print("  [OK ] added checkProximityInteractions() + _checkDoorProximity()")
else:
    print("  [XX ] intro-narrative anchor for method insertion")

if edits == 2:
    open(P, "w", encoding="utf-8").write(s)
    print("\nOK  perspectiveScene.js written.")
    print("Test: door badge should show only near the door, clear when you walk")
    print("away, and NOT vanish as you re-approach. Harp/NPC behave as before.")
else:
    print(f"\nXX  only {edits}/2 anchors matched -- nothing saved. Paste me update() and")
    print("the door-methods region of perspectiveScene.js and I'll re-cut.")
    sys.exit(1)
