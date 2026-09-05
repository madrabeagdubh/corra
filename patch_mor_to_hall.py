#!/usr/bin/env python3
"""
patch_mor_to_hall.py

Moves Mór from b0.js (the exterior rath, where she sat at a documented
"holding position" placeholder) into the village hall, where her own
original comment said she always belonged once the content-loading
mechanism existed -- it now does (villageScene.js, previous patch).

This also fixes the real bug you hit: her exterior placeholder position
was close enough to the hall's door-proximity radius that door-proximity
(which takes precedence over NPC-proximity every frame in
PerspectiveScene.checkProximityInteractions) could suppress her badge
entirely, so tapping to talk to her sometimes walked you through the door
instead. Moving her inside removes the collision outright.

Does NOT touch tools/dialogue/drafts/villageHall.dlg or
public/data/village/villageHall.js's fixedEncounters content -- those are
provided as complete files (villageHall.dlg, and this script writes the
matching skeleton). Run in this order:

    python3 patch_mor_to_hall.py
    cp villageHall.dlg tools/dialogue/drafts/
    node tools/dialogue/compile.mjs tools/dialogue/drafts/villageHall.dlg

Idempotent: safe to run more than once.
"""
from pathlib import Path

ROOT = Path.cwd()

# ---------------------------------------------------------------------------
# 1. public/data/village/villageHall.js -- replace the Órlaith placeholder
#    with a skeleton for Mór
# ---------------------------------------------------------------------------

VILLAGE_HALL_SKELETON = """// villageHall.js -- content for the chieftain's hall interior.
// Location: public/data/village/villageHall.js
//
// ============================================================================
// MÓR -- moved here from b0.js (the exterior ráth), where she was always
// meant to end up. See tools/dialogue/drafts/villageHall.dlg for the full
// history/reasoning.
// ============================================================================
//
// PLACEMENT/VISUAL ARE PLACEHOLDERS. villageHall.json's player spawn is
// (7,7); this puts her a few tiles further in, roughly where a hearth-side
// figure might stand, but I can't see the rendered room from here --
// reposition once you can see it in-game.
//
// PORTRAIT: still points at muireann.png, the same placeholder b0.js used
// for her (its own comment already flagged this as needing real art).
// Not a new problem, just carried over.

export const villageHallContent = {
  npcs: [],
  objects: [],
  introNarrative: [
    {
      ga: 'Tá an halla dorcha, agus beagnach folamh.',
      en: 'Dim is the hall, and near empty.'
    },
    {
      ga: 'Ní choinníonn ach tine bheag ina choinne dorchadais, agus a chloch fhuar.',
      en: 'Only a small fire holds against the dark, and its cold stone.'
    }
  ],

  fixedEncounters: [
    {
      id: 'mor',
      name: 'Mór',
      x: 7, y: 5,
      radius: 3,
      visual:   { gid: 255, flat: false },
      portrait: '/assets/npcs/muireann.png',

      dialogues: [
      ],
    },
  ],
}
"""

path = ROOT / "public/data/village/villageHall.js"
if not path.exists():
    print(f"✗ public/data/village/villageHall.js does not exist -- run "
          f"the previous patch (patch_village_hall.py) first")
else:
    current = path.read_text(encoding="utf-8")
    if "id: 'mor'," in current:
        print("• villageHall.js skeleton: already has Mór, skipping")
    elif "id: 'reachtaire'," in current:
        path.write_text(VILLAGE_HALL_SKELETON, encoding="utf-8")
        print("✓ villageHall.js skeleton: replaced Órlaith placeholder with Mór")
    else:
        print("✗ villageHall.js: neither Órlaith nor Mór found -- file has "
              "drifted, apply by hand")

# ---------------------------------------------------------------------------
# 2. public/data/bog/b0.js -- remove Mór's block, replace the stale header
# ---------------------------------------------------------------------------

B0_NEW_HEADER = """// b0.js -- village content: the people of the ráth.
// Location: public/data/bog/b0.js
//
// Mór (formerly the sole fixedEncounter here) has moved to
// public/data/village/villageHall.js -- she was always meant to be met
// inside the hall, not held at a placeholder spot out here (see her own
// header comment there for the full reasoning). fixedEncounters is empty
// until whoever/whatever replaces her out here is decided.

export const b0Content = {

  fixedEncounters: [
  ],
"""

b0_path = ROOT / "public/data/bog/b0.js"
if not b0_path.exists():
    print("✗ public/data/bog/b0.js does not exist -- skipping")
else:
    text = b0_path.read_text(encoding="utf-8")
    if "Mór (formerly the sole fixedEncounter here) has moved to" in text:
        print("• b0.js: already migrated, skipping")
    elif "id: 'mor'," not in text:
        print("✗ b0.js: Mór not found at all -- file has drifted further "
              "than expected, apply by hand")
    else:
        start_anchor = "// b0.js -- village content: the people of the ráth.\n// Location: public/data/bog/b0.js\n"
        end_anchor   = "      ],\n    },\n  ],\n\n  // ── Background villagers"
        si = text.find(start_anchor)
        ei = text.find(end_anchor)
        if si < 0 or ei < 0 or ei <= si:
            print("✗ b0.js: couldn't locate the exact region to remove -- "
                  "file has drifted, apply by hand: delete Mór's "
                  "fixedEncounter block and the stale header describing "
                  "her, replace with an empty fixedEncounters: [].")
        else:
            new_text = text[:si] + B0_NEW_HEADER + text[ei + len("      ],\n    },\n  ],\n"):]
            b0_path.write_text(new_text, encoding="utf-8")
            print("✓ b0.js: removed Mór's block, replaced stale header")

# ---------------------------------------------------------------------------
# 3. Syntax sanity check (best-effort, doesn't fail the script if node
#    isn't on PATH for some reason)
# ---------------------------------------------------------------------------

import subprocess
for f in ["public/data/bog/b0.js", "public/data/village/villageHall.js"]:
    fp = ROOT / f
    if not fp.exists():
        continue
    try:
        r = subprocess.run(
            ["node", "--input-type=module", "--check"],
            stdin=open(fp, "rb"), capture_output=True, timeout=10,
        )
        if r.returncode == 0:
            print(f"✓ {f}: syntax OK")
        else:
            print(f"✗ {f}: syntax check failed -- {r.stderr.decode().strip()}")
    except Exception as e:
        print(f"• {f}: couldn't run syntax check ({e}) -- verify by hand")
