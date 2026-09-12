#!/usr/bin/env python3
"""
patch_ogham_irish_vivid_color.py

Brightens the ogham dial's Irish poem text. Explicitly NOT a glow/blur
effect -- the full two-layer speakerGlow() blur used elsewhere in the
game (scrollingTextPlayer.js) is the exact effect that was previously the
single largest performance cost in this intro (see the "ONE tight
shadow" comment a few lines up), and this text's opacity is rewritten
every frame the carving/reveal animation is running. Reintroducing that
blur here risks reintroducing that regression, so per direct instruction
this is font colour only.

Only the dial's OWN hardcoded copy of the colour changes -- not
COLORS.druid in gameTypography.js, which this was originally matched to
and which drives every other druid line in the game. Changing that
shared constant would brighten druid dialogue everywhere, not just this
one dramatic opening incantation.

Idempotent: guarded on the new colour value.
"""
import sys
from pathlib import Path

TARGET = Path("js/introOghamDial.js")

OLD = """  #ogd-col .ga{font-family:Urchlo,Aonchlo,serif;
    font-size:1.8rem;line-height:1.2;color:#a0a0b8;opacity:0;
    transition:opacity 1.1s ease-out}"""

NEW = """  #ogd-col .ga{font-family:Urchlo,Aonchlo,serif;
    font-size:1.8rem;line-height:1.2;
    /* Brighter, more saturated version of speakerColor('druid')'s #a0a0b8 --
       same violet-grey hue family, so it still reads as the druid's voice,
       but vivid rather than muted for this one dramatic opening incantation.
       Colour only, deliberately no glow/shadow -- see the note above about
       why that blur was removed from this column in the first place. */
    color:#cbb8ff;opacity:0;
    transition:opacity 1.1s ease-out}"""


def patch(text):
    if "#cbb8ff" in text:
        print("  - Irish text colour: already brightened, skipping")
        return text, False

    if OLD not in text:
        print("  ! marker not found -- check by hand")
        return text, False

    text = text.replace(OLD, NEW, 1)
    print("  - Irish text colour: #a0a0b8 -> #cbb8ff (vivid, same hue family, no glow)")
    return text, True


def main():
    if not TARGET.exists():
        print(f"Can't find {TARGET} -- run this from the repo root.")
        sys.exit(1)

    original = TARGET.read_text()
    patched, changed = patch(original)

    if changed:
        TARGET.write_text(patched)
        print(f"Patched {TARGET}")
    else:
        print("Nothing to do -- already applied.")


if __name__ == "__main__":
    main()
