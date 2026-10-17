#!/usr/bin/env python3
"""
Two fixes.

1. ONE colour for the player's Irish.
   Cards drew the player's Irish in COLORS.speaker (bright gold #d4af37, which is the colour of the
   speaker NAME labels too); captions (landfall) drew it pastel. Now both read INK.player
   (ui/speakers.js), a pale cream-gold, so there is one place to change it.
     speakers.js   INK.player = '#f5ecc9'
     textPanel.js  the player's rows in a card use INK.player (name labels keep the gold)
     landfall.js   PLAYER = INK.player   (works whether or not the earlier pastel patch is in)

2. A swiped-empty card now goes on its own.
   An overflowing card (text taller than the body) can be scrolled until nothing is left on
   screen. It was only dismissed if the finger lifted at that moment AND the swipe was fast
   (DISMISS_VEL), so a slow swipe, or a glide that carried the text off after the lift, left an
   empty card that needed a second swipe. Now, for a card with no buttons:
     - lifting with the text fully scrolled off dismisses it, at any speed
     - momentum carrying the text fully off dismisses it
   Cards with buttons are unchanged (the choice is the way on). Short cards that don't scroll are
   unchanged (still a fast swipe up).

Run from the repo root:   python3 patch_player_ink_and_card_swipe.py
Idempotent: running it again changes nothing.
"""
import os, sys

HELPER = """\
  // An overflowing card swiped until nothing is left on screen is finished with. Cards with buttons never
  // are: the choice is the way on.
  _cardEmptied() {
    return this.currentPanelType === 'encounter_card' && this.isVisible && !this.isFading &&
      this._maxScroll > 0 && this._scrollY >= this._maxScroll - 0.5 && !(this._buttons && this._buttons.length)
  }

"""

# each edit: (old or tuple of acceptable olds, new)
EDITS = {
    "js/game/ui/speakers.js": [
        ("  narrator: '#d8e8f0',   // pale blue-white: the voice that is no one (hints, the sea crossings)",
         "  narrator: '#d8e8f0',   // pale blue-white: the voice that is no one (hints, the sea crossings)\n"
         "  player:   '#f5ecc9',   // pale cream-gold: the champion, in cards and captions alike"),
    ],
    "js/game/ui/textPanel.js": [
        ("import { Bodhran }      from '../systems/music/bodhran.js'",
         "import { Bodhran }      from '../systems/music/bodhran.js'\nimport { INK }          from './speakers.js'"),
        ("isHero ? SPEAKER_COLOR : (this._speakerInk || IRISH_COLOR)",
         "isHero ? INK.player : (this._speakerInk || IRISH_COLOR)"),
        # momentum carried the text off after the lift
        ("  // Keep ticking only while there's still momentum",
         "  // swiped until the card is empty (a glide can carry it there after the lift): it goes\n"
         "  if (!this._dragging && this._cardEmptied()) { this.hide(this._keepChromeOnHide); return }\n"
         "  // Keep ticking only while there's still momentum"),
        # lifting on an emptied card, at any speed
        ("  if (!hasButtons && savedVel < -DISMISS_VEL && fullyScrolled) {",
         "  if (!hasButtons && fullyScrolled && (this._maxScroll > 0 || savedVel < -DISMISS_VEL)) {"),
        ("  _onReachTop() {\n    if (this._atTop) return",
         HELPER + "  _onReachTop() {\n    if (this._atTop) return"),
    ],
    "js/game/scenes/locations/skye/landfall.js": [
        (("const PLAYER = '#e8cf8a'", "const PLAYER = '#f5ecc9'"),
         "const PLAYER = INK.player"),
    ],
}


def main():
    changed = skipped = 0
    for path, edits in EDITS.items():
        if not os.path.isfile(path):
            sys.exit(f"ERROR: {path} not found - run this from the repo root")
        with open(path, "r", encoding="utf-8", newline="") as f:
            src = f.read()
        out = src
        for olds, new in edits:
            if isinstance(olds, str):
                olds = (olds,)
            if new in out:
                skipped += 1
                continue
            hits = [o for o in olds if out.count(o) == 1]
            if len(hits) != 1:
                sys.exit(f"ERROR: {path}: expected exactly one match for one of:\n" + "\n".join(olds) +
                         "\n(file has drifted, nothing written for it)")
            out = out.replace(hits[0], new)
            changed += 1
        if out != src:
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(out)
            print(f"patched  {path}")
        else:
            print(f"already  {path}")
    print(f"{changed} edit(s) applied, {skipped} already in place")


if __name__ == "__main__":
    main()
