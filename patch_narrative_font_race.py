#!/usr/bin/env python3
"""
patch_narrative_font_race.py

Fixes why the narrative panel's Irish text wasn't rendering in Urchlo even
after TYPE.narrative/COLORS.narrative were set correctly.

Urchlo is a custom @font-face, loaded only via document.fonts.load() calls
scattered in JS (introModal.js, characterModal.js) -- there's no CSS trick
forcing it to load early the way Aonchlo has (.font-loader class). Phaser
bakes text into a canvas texture using whatever font is ACTUALLY loaded at
the instant scene.add.text() runs, and never re-bakes it later even once
the real font finishes downloading.

showIntroNarrative() fires the instant a scene loads -- the worst possible
timing for that race, since regular NPC dialogue (opened later by a tap)
usually wins it by accident and looks fine. This patch makes
showIntroNarrative() explicitly wait for Urchlo/Aonchlo to finish loading
before rendering its first card, same document.fonts.load() call
introModal.js already uses elsewhere, just actually awaited this time.

Idempotent: safe to run more than once.

Run from the repo root:
    python3 patch_narrative_font_race.py
"""
from pathlib import Path

ROOT = Path.cwd()
TARGET = "js/game/scenes/locations/perspectiveScene.js"

OLD = """      this.textPanel.show({
        irish: entry.ga || entry.irish || '', english: entry.en || entry.english || '',
        type: 'narrative',
        onDismiss: () => this.time.delayedCall(300, showNext)
      })
    }
    showNext()
  }"""

NEW = """      this.textPanel.show({
        irish: entry.ga || entry.irish || '', english: entry.en || entry.english || '',
        type: 'narrative',
        onDismiss: () => this.time.delayedCall(300, showNext)
      })
    }
    // Urchlo is a custom @font-face; Phaser bakes text into a canvas
    // texture using whatever font is actually loaded at the instant
    // add.text() runs, and never re-bakes it once the real font finishes
    // downloading. showIntroNarrative() fires the moment the scene loads --
    // the worst-case timing for that race -- so unlike dialogue opened
    // later by a tap, it usually loses it. Same pattern as the (unawaited)
    // load call in introModal.js, but actually waited on here.
    if (document.fonts && document.fonts.ready) {
      Promise.all([
        document.fonts.load('16px Urchlo'),
        document.fonts.load('16px Aonchlo'),
      ]).catch(() => {}).then(showNext)
    } else {
      showNext()
    }
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
          f"apply by hand: in showIntroNarrative(), replace the final "
          f"`showNext()` call with a document.fonts.load('Urchlo')/"
          f"('Aonchlo') gate before calling showNext, see patch source for "
          f"the exact block.")
else:
    count = text.count(OLD)
    if count > 1:
        print(f"✗ match is not unique ({count}x) -- apply by hand")
    else:
        path.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
        print(f"✓ showIntroNarrative() now waits for Urchlo/Aonchlo to load first")
