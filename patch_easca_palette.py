#!/usr/bin/env python3
"""
Recolour Easca to match the encounter card rather than a stock blue UI kit.

Matched against:
  card border (visible gold frame, COLORS.queen)     #d4af37
  card fill   (near-black, warm)                     0x111a11 family
  Irish text                                          #e8dfc0 (warm parchment)
  hint / dim                                          #445544

Keys move from cold navy to the same warm dark register as the card, with
gold taking over as the accent that was blue. Send/backspace keep their own
green/orange -- those are functional colours (go / undo), not palette, and
recolouring them would cost the keyboard its one piece of built-in affordance.

Idempotent. Run from repo root.
"""

import sys, pathlib

EASCA = pathlib.Path('js/game/ui/easca3.js')

A = """    this.C = {
      keyBg:         0x1b3454,
      keyStroke:     0x3a5a8a,
      keyPressed:    0x4fc3f7,
      accentBg:      0x1a1040,
      accentStroke:  0x7b5ea7,
      accentPressed: 0x9c6fff,
      sendBg:        0x0a2a1a,
      sendStroke:    0x2e9e6a,
      sendPressed:   0x3ddc84,
      bsBg:          0x2a1000,   // orange-tinted backspace
      bsStroke:      0x8a4a00,
      bsPressed:     0xff8c00,
      panelBg:       0x04090f,
      panelStroke:   0x1e3a5a,
    };"""

P = """    this.C = {
      // Matched to the encounter card: warm near-black fill, gold accent
      // (COLORS.queen), parchment text -- so the keyboard reads as the same
      // object opening rather than a different app layered on top.
      keyBg:         0x1c1712,   // warm charcoal, not navy
      keyStroke:     0x6b5a3a,   // dim gold-brown, echoes panelStroke below
      keyPressed:    0xd4af37,   // COLORS.queen -- full gold on press
      accentBg:      0x241c14,
      accentStroke:  0x8a6a2a,
      accentPressed: 0xd4af37,
      sendBg:        0x0a2a1a,   // left as a functional colour: go
      sendStroke:    0x2e9e6a,
      sendPressed:   0x3ddc84,
      bsBg:          0x2a1000,   // left as a functional colour: undo
      bsStroke:      0x8a4a00,
      bsPressed:     0xff8c00,
      panelBg:       0x111a11,   // COLORS.panelFill
      panelStroke:   0xd4af37,   // COLORS.queen -- the visible card border
    };"""


def main():
    if not EASCA.exists():
        sys.exit(f'not found: {EASCA} — run from repo root')
    src = EASCA.read_text()
    if 'Matched to the encounter card' in src:
        print('already patched — nothing to do')
        return
    if A not in src:
        sys.exit('palette block not found as expected — has easca3.js changed?')
    EASCA.write_text(src.replace(A, P, 1))
    print('patched js/game/ui/easca3.js')


if __name__ == '__main__':
    main()
