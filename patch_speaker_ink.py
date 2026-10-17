#!/usr/bin/env python3
"""
Irish speech colours: every speaker's Irish line is an off-white pastel, tinted their own colour.

  conall    #7fd6a3 (leaf green)   -> #dff2e4  pale mint
  uathach   #ffb25c (amber)        -> #fbe3c8  pale peach
  garbhan   #e0876a (terracotta)   -> #f6dcd2  pale blush
  player    #e8cf8a (landfall gold)-> #f5ecc9  pale cream-gold
  narrator  #d8e8f0                   unchanged (already a pale blue-white)

Conall / Uathach live in ui/speakers.js, which feeds the cards, captions, the garden
course, the tournament and the lessons. Garbhan and the landfall player keep their own
local constants, so they are changed here too.

Run from the repo root:   python3 patch_speaker_ink.py
Idempotent: running it again changes nothing.
"""
import os, sys

EDITS = {
    "js/game/ui/speakers.js": [
        ("//   inkFor('conall')        -> '#7fd6a3'   (null for a speaker with no colour of their own)",
         "//   inkFor('conall')        -> '#dff2e4'   (null for a speaker with no colour of their own)"),
        ("  conall:   '#7fd6a3',   // fresh leaf-green: the Warden of the garden, steady and plain-spoken",
         "  conall:   '#dff2e4',   // pale mint: the Warden of the garden, steady and plain-spoken"),
        ("  uathach:  '#ffb25c',   // warm amber: quick, bright, a little fierce",
         "  uathach:  '#fbe3c8',   // pale peach: quick, bright, a little fierce"),
    ],
    "js/game/scenes/locations/skye/garbhan.js": [
        ("const INK = { garbhan: '#e0876a' }",
         "const INK = { garbhan: '#f6dcd2' }"),
    ],
    "js/game/scenes/locations/skye/landfall.js": [
        ("const PLAYER = '#e8cf8a'",
         "const PLAYER = '#f5ecc9'"),
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
        for old, new in edits:
            if new in out:
                skipped += 1
                continue
            if out.count(old) != 1:
                sys.exit(f"ERROR: {path}: expected exactly one match for:\n{old}\n(found {out.count(old)}) - file has drifted, nothing written for it")
            out = out.replace(old, new)
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
