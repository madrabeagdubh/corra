#!/usr/bin/env python3
"""
Two fixes to the Easca prompt.

DEPTH ORDERING
  The lift set every object to the same depth, which flattened Easca's own
  layering -- panel, keys, text zone and accent menu all landed on one plane
  and resolved by insertion order instead. Now the lift ADDS to each object's
  existing depth, so the keyboard keeps its internal ordering and simply
  moves as a set.

THE MOON
  The moon hub is DOM at z-index ~1000002, outside Phaser's depth system
  entirely, so no setDepth will ever clear it. It is hidden for the duration
  and put back afterwards -- the same treatment the d-pad already gets when
  a conversation opens, and for the same reason. There is nothing to
  translate while the player is typing their own name.

Idempotent. Run from repo root, after patch_easca_prompt.py.
"""

import sys, pathlib

SCENE = pathlib.Path('js/game/scenes/locations/perspectiveScene.js')

A = """  _eascaLiftDepth() {
    if (this._eascaDepths) return                 // already lifted
    this._eascaDepths = new Map()
    this._eascaObjects().forEach((o) => {
      try {
        this._eascaDepths.set(o, o.depth ?? 0)
        o.setDepth(PROMPT_EASCA_DEPTH)
      } catch (e) {}
    })
  }

  _eascaRestoreDepth() {
    if (!this._eascaDepths) return
    this._eascaDepths.forEach((d, o) => { try { o.setDepth(d) } catch (e) {} })
    this._eascaDepths = null
  }
"""

P = """  _eascaLiftDepth() {
    if (this._eascaDepths) return                 // already lifted
    this._eascaDepths = new Map()
    // ADD to each object's depth rather than setting it. Flattening them to
    // one value threw away Easca's own layering -- panel, keys, text zone
    // and accent menu all became coplanar and fell back to insertion order,
    // which is why the keys went dark on dark.
    this._eascaObjects().forEach((o) => {
      try {
        const d = o.depth ?? 0
        this._eascaDepths.set(o, d)
        o.setDepth(d + PROMPT_EASCA_DEPTH)
      } catch (e) {}
    })

    // The moon hub is DOM, at a z-index no canvas object can reach. Hide it
    // rather than fight it -- the same reason the d-pad goes away for a
    // conversation, and nothing needs translating while typing a name.
    try {
      const hub = document.getElementById('dpad-moon-hub')
      if (hub) {
        this._eascaHubDisplay = hub.style.display
        hub.style.display = 'none'
      }
    } catch (e) {}
  }

  _eascaRestoreDepth() {
    if (this._eascaDepths) {
      this._eascaDepths.forEach((d, o) => { try { o.setDepth(d) } catch (e) {} })
      this._eascaDepths = null
    }
    try {
      const hub = document.getElementById('dpad-moon-hub')
      if (hub) hub.style.display = this._eascaHubDisplay ?? ''
      this._eascaHubDisplay = undefined
    } catch (e) {}
  }
"""


def main():
    if not SCENE.exists():
        sys.exit(f'not found: {SCENE} — run from repo root')
    src = SCENE.read_text()
    if 'dpad-moon-hub' in src and '_eascaHubDisplay' in src:
        print('already patched — nothing to do')
        return
    if A not in src:
        sys.exit('anchor not found — run patch_easca_prompt.py first')
    SCENE.write_text(src.replace(A, P, 1))
    print('patched js/game/scenes/locations/perspectiveScene.js')


if __name__ == '__main__':
    main()
