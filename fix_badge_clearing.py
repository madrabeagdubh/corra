#!/usr/bin/env python3
# fix_badge_clearing.py
# Run from anywhere:  python3 fix_badge_clearing.py
#
# Fixes two bugs that together let you exit the tavern from across the room:
#   (A) perspectiveScene.js / _updateDoorProximity: it set panel._openPanel to the
#       door transition whenever you were merely NEAR a door -- even if a harp/NPC
#       badge owned the panel. Now the door action is set only while the door
#       actually owns the badge.
#   (C) villageScene.js / checkProximityInteractions: harp/NPC badges were never
#       explicitly cleared on step-away (it trusted the base). Now the scene
#       clears its own harp/NPC badge when nothing is in range.

import os, sys

def find_root():
    for c in (os.getcwd(), os.path.expanduser("~/Corra")):
        if os.path.exists(os.path.join(c, "js/game/scenes/locations/perspectiveScene.js")):
            return c
    return None

ROOT = find_root()
if not ROOT:
    print("XX  couldn't find the repo -- run from the Corra root."); sys.exit(1)

PERSP   = os.path.join(ROOT, "js/game/scenes/locations/perspectiveScene.js")
VILLAGE = os.path.join(ROOT, "js/game/scenes/locations/villageScene.js")

ok = True
def rep(tag, good, msg=""):
    global ok
    if not good: ok = False
    print(f"  [{'OK ' if good else 'XX '}] {tag}{(' - ' + msg) if msg else ''}")


# ── (A) perspectiveScene.js: door owns _openPanel only when it owns the badge ──
def patch_persp():
    print("perspectiveScene.js")
    if not os.path.exists(PERSP):
        rep("file", False, "not found"); return
    s = open(PERSP, encoding="utf-8").read()
    if "Set the open action only while the door actually owns the badge" in s:
        rep("already patched", True, "skipping"); return

    a = (
"      // Show the door badge only when nothing else (e.g. an encounter flag) is\n"
"      // already claiming the panel -- and re-assert if something cleared it.\n"
"      if ((!panel._card || panel._card._isDoor) && panel._card?.id !== cardId) {\n"
"        panel.notify({\n"
"          id:      cardId,\n"
"          visual:  door.visual || PerspectiveScene.DOOR_VISUAL,\n"
"          ga:      door.ga || 'An doras',\n"
"          en:      door.en || 'The door',\n"
"          _isDoor: true,\n"
"          _door:   door,\n"
"        }, nearest)\n"
"      }\n"
"      // Route the panel's open action to the transition (same hook the\n"
"      // harp uses) so pressing the badge teleports rather than opening a card.\n"
"      panel._openPanel = () => this._triggerDoor(door)"
    )
    b = (
"      // Claim the badge only when nothing higher-priority (harp/NPC) holds it,\n"
"      // so a door action can't get attached to a harp/NPC badge.\n"
"      if (!panel._card || panel._card._isDoor) {\n"
"        if (panel._card?.id !== cardId) {\n"
"          panel.notify({\n"
"            id:      cardId,\n"
"            visual:  door.visual || PerspectiveScene.DOOR_VISUAL,\n"
"            ga:      door.ga || 'An doras',\n"
"            en:      door.en || 'The door',\n"
"            _isDoor: true,\n"
"            _door:   door,\n"
"          }, nearest)\n"
"        }\n"
"        // Set the open action only while the door actually owns the badge.\n"
"        panel._openPanel = () => this._triggerDoor(door)\n"
"      }"
    )
    if a in s:
        open(PERSP, "w", encoding="utf-8").write(s.replace(a, b, 1))
        rep("_updateDoorProximity(): _openPanel ownership", True)
    else:
        rep("_updateDoorProximity(): anchor (door patches applied first?)", False)


# ── (C) villageScene.js: clear our own harp/NPC badge on step-away ────────────
def patch_village():
    print("villageScene.js")
    if not os.path.exists(VILLAGE):
        rep("file", False, "not found"); return
    s = open(VILLAGE, encoding="utf-8").read()
    if "clear our own harp/NPC badge so it doesn't linger" in s:
        rep("already patched", True, "skipping"); return

    a = (
"    if (nearestNPC) {\n"
"      this._showNPCBadge(nearestNPC)\n"
"      return\n"
"    }\n"
"    super.checkProximityInteractions()\n"
"  }"
    )
    b = (
"    if (nearestNPC) {\n"
"      this._flagInRange = true\n"
"      this._showNPCBadge(nearestNPC)\n"
"      return\n"
"    }\n"
"    // Nothing in range: clear our own harp/NPC badge so it doesn't linger after\n"
"    // we step away (leave a door badge alone -- _updateDoorProximity owns that).\n"
"    if (this._encounterPanel?._card?._isHarp || this._encounterPanel?._card?._isNPC) {\n"
"      this._encounterPanel.clearNotify()\n"
"    }\n"
"    this._flagInRange = false\n"
"    super.checkProximityInteractions()\n"
"  }"
    )
    if a in s:
        open(VILLAGE, "w", encoding="utf-8").write(s.replace(a, b, 1))
        rep("checkProximityInteractions(): explicit clear + NPC _flagInRange", True)
    else:
        rep("checkProximityInteractions(): anchor", False)


if __name__ == "__main__":
    print(f"Patching from: {ROOT}\n")
    patch_persp()
    patch_village()
    print()
    if ok:
        print("Done. Review with `git diff`, then test: badges should clear when you")
        print("step away, and the door should only fire when its badge is showing.")
    else:
        print("An anchor didn't match -- nothing partial was written for that file.")
        print("Paste me the affected method and I'll re-cut it.")
        sys.exit(1)
