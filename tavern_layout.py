#!/usr/bin/env python3
# tavern_layout.py
# Run from anywhere:  python3 tavern_layout.py
#
# Three things:
#  1. villageScene.js  -- per-NPC trigger radius. NPCs may now carry an optional
#     "triggerRadius" (in TILES) in the map; missing => the default 1.8. This is
#     what lets Sorcha's moonTile badge reach across the bar.
#  2. tavern.json      -- spread the NPCs out (poet + Fearghus were crowding the
#     harp and each other), give Sorcha triggerRadius 3, and add the hearth
#     billboard against the back (north) wall.
#  All JSON edits are non-destructive (json.load): doors/exits/entries/objects
#  are left exactly as they are on disk.

import os, sys, json

def find_root():
    for c in (os.getcwd(), os.path.expanduser("~/Corra")):
        if os.path.exists(os.path.join(c, "js/game/scenes/locations/villageScene.js")):
            return c
    return None

ROOT = find_root()
if not ROOT:
    print("XX  couldn't find the repo -- run from the Corra root."); sys.exit(1)

# ──────────────────────────────────────────────────────────────────────────
# 1. villageScene.js  -- per-NPC trigger radius
# ──────────────────────────────────────────────────────────────────────────
VS = os.path.join(ROOT, "js/game/scenes/locations/villageScene.js")
s = open(VS, encoding="utf-8").read()
vs_edits = 0

if "triggerRadius:" in s and "npc.triggerRadius" in s:
    print("OK  villageScene.js already has per-NPC radius -- skipping.")
else:
    # (a) store triggerRadius on the npc record
    a = ("        imgCanvas, met: false, zone: npcZone,\n"
         "        screenX: 0, screenY: 0, screenW: 0, screenH: 0,")
    b = ("        imgCanvas, met: false, zone: npcZone,\n"
         "        triggerRadius: npcData.triggerRadius ?? null,\n"
         "        screenX: 0, screenY: 0, screenW: 0, screenH: 0,")
    if a in s:
        s = s.replace(a, b, 1); vs_edits += 1
        print("  [OK ] createNPCs(): record triggerRadius from map data")
    else:
        print("  [XX ] createNPCs(): npc push anchor")

    # (b) use per-NPC radius in the proximity test
    a = ("    ;(this.npcs || []).forEach(npc => {\n"
         "      const d = Phaser.Math.Distance.Between(px, py, npc.logicalX, npc.logicalY)\n"
         "      if (d < NPC_RADIUS && d < npcDist) { npcDist = d; nearestNPC = npc }\n"
         "    })")
    b = ("    ;(this.npcs || []).forEach(npc => {\n"
         "      const r = npc.triggerRadius != null ? npc.triggerRadius * this.tileSize : NPC_RADIUS\n"
         "      const d = Phaser.Math.Distance.Between(px, py, npc.logicalX, npc.logicalY)\n"
         "      if (d < r && d < npcDist) { npcDist = d; nearestNPC = npc }\n"
         "    })")
    if a in s:
        s = s.replace(a, b, 1); vs_edits += 1
        print("  [OK ] checkProximityInteractions(): per-NPC radius (default 1.8)")
    else:
        print("  [XX ] checkProximityInteractions(): NPC proximity-loop anchor")

    if vs_edits == 2:
        open(VS, "w", encoding="utf-8").write(s)
        print("OK  villageScene.js written.")
    else:
        print(f"XX  villageScene.js: only {vs_edits}/2 anchors matched -- NOT saved.")
        print("    Paste me createNPCs() + checkProximityInteractions() and I'll recut.")
        sys.exit(1)

# ──────────────────────────────────────────────────────────────────────────
# 2. tavern.json  -- reposition NPCs, Sorcha radius, hearth billboard
# ──────────────────────────────────────────────────────────────────────────
TJ = os.path.join(ROOT, "public/maps/village/tavern.json")
data = json.load(open(TJ, encoding="utf-8"))

# NPC moves (harp stays at 2,3). Poet by the hearth, Fearghus over by the
# right-hand table, Sorcha unchanged behind the bar but with a reach radius.
moves = {
    "poet":     {"x": 7, "y": 4},
    "fearghus": {"x": 9, "y": 7},
    "sorcha":   {"x": 13, "y": 5, "triggerRadius": 3},
}
seen = set()
for npc in data.get("npcs", []):
    m = moves.get(npc.get("id"))
    if not m:
        continue
    npc.update(m)
    seen.add(npc["id"])
    extra = f" (+triggerRadius {m['triggerRadius']})" if "triggerRadius" in m else ""
    print(f"  [OK ] npc '{npc['id']}' -> ({m['x']},{m['y']}){extra}")
for mid in moves:
    if mid not in seen:
        print(f"  [XX ] npc '{mid}' not found in tavern.json -- left unchanged")

# Hearth billboard against the back wall (centre, cols 7-8). 220x270px at the
# tavern's 96px tiles is ~2.3 x 2.8 tiles, so fw/fh 2/3 is a close first pass.
# This is a VISUAL placement -- nudge x / y / fw / fh / overscale once you see it.
buildings = data.setdefault("buildings", [])
if any(b.get("id") == "hearth" for b in buildings):
    print("  [..] hearth building already present -- left as-is")
else:
    buildings.append({
        "id": "hearth",
        "src": "assets/hearth.png",
        "x": 7, "y": 1,
        "fw": 2, "fh": 3,
        "mode": "billboard",
        "overscale": 1.0,
        "roofSplit": 0.0,
    })
    print("  [OK ] added hearth billboard at back wall (x7 y1, fw2 fh3)")

json.dump(data, open(TJ, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("OK  tavern.json written (doors/exits/entries/objects untouched).")

print("\nDone. In the tavern: NPCs are spread out, Sorcha's badge should now")
print("appear from the bar front (col 11, ~2 tiles across the barrels), and the")
print("hearth sits on the back wall. The hearth size/spot is a first guess --")
print("tell me which way to nudge it once you've had a look.")
