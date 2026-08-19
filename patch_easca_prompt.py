#!/usr/bin/env python3
"""
A one-shot Easca prompt on the scene.

Easca's completed text goes to a callback fixed at construction, so a caller
can't pass its own. This routes that callback through a pending resolver:
whoever asked most recently gets the string, and if nobody asked, it logs as
before.

Also handles the two things a prompt needs that the Labhair tab doesn't:

  - DEPTH. The keyboard was built for a screen with nothing over it. A
    conversation card sits around 2000, so its objects are lifted above that
    while a prompt is running and put back afterwards.

  - CANCEL. sendMessage only fires on non-empty text, so a player who closes
    the keyboard without sending would leave the caller waiting forever. The
    prompt watches for the keyboard going away and resolves with null.

Verify from the console before anything is wired to it:

    const s = game.scene.getScenes(true)[0]
    s.promptEasca(t => console.log('got:', t))

Idempotent. Run from repo root.
"""

import sys, pathlib

SCENE = pathlib.Path('js/game/scenes/locations/perspectiveScene.js')

A = """  _createInputUI() {
    this._easca = new Easca3(this, (text) => {
      console.log('[Labhair] Player said:', text)
    })
"""

P = """  /**
   * Ask the player to type something, and call back with it once.
   *
   * `onDone` receives the string, or null if they closed the keyboard
   * without sending. Only one prompt can be outstanding; a second replaces
   * the first, which is the right behaviour for a UI where the only way to
   * ask twice is to have lost track of the first ask.
   */
  promptEasca(onDone) {
    if (!this._easca) { onDone?.(null); return }

    this._eascaPending = (text) => {
      this._eascaPending = null
      this._eascaRestoreDepth()
      onDone?.(text)
    }

    this._eascaLiftDepth()
    this._easca.showKeyboard()

    // sendMessage() hides the keyboard itself, so `visible` going false with
    // a prompt still outstanding means the player backed out.
    this._eascaWatch?.remove()
    this._eascaWatch = this.time.addEvent({
      delay: 200,
      loop:  true,
      callback: () => {
        if (!this._eascaPending) { this._eascaWatch?.remove(); this._eascaWatch = null; return }
        if (this._easca?.visible) return
        const done = this._eascaPending
        this._eascaWatch?.remove(); this._eascaWatch = null
        done(null)
      },
    })
  }

  /** Every object Easca draws, so depth can be moved as a set. */
  _eascaObjects() {
    const e = this._easca
    if (!e) return []
    return [
      e.bgPanel, e.textZoneBg, e.textDisplay,
      ...(e.controlObjects || []),
      ...(e.letterObjects  || []),
    ].filter(Boolean)
  }

  _eascaLiftDepth() {
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

  _createInputUI() {
    this._easca = new Easca3(this, (text) => {
      // A prompt is waiting for this one; the Labhair tab is not.
      if (this._eascaPending) { this._eascaPending(text); return }
      console.log('[Labhair] Player said:', text)
    })
"""

# The keyboard has to clear the conversation card, which lives around 2000.
CONST_A = "  _createInputUI() {\n    this._easca = new Easca3"
CONST_DECL = "// Above the conversation card, which sits around 2000.\nconst PROMPT_EASCA_DEPTH = 2600\n\n"


def main():
    if not SCENE.exists():
        sys.exit(f'not found: {SCENE} — run from repo root')
    src = SCENE.read_text()

    if 'promptEasca' in src:
        print('already patched — nothing to do')
        return
    if A not in src:
        sys.exit('anchor not found — perspectiveScene.js has moved on')

    src = src.replace(A, P, 1)

    # Constant goes just above the class, after the imports.
    lines = src.split('\n')
    last_import = max(i for i, l in enumerate(lines) if l.startswith('import '))
    lines.insert(last_import + 1, '\n' + CONST_DECL.rstrip())
    src = '\n'.join(lines)

    SCENE.write_text(src)
    print('patched js/game/scenes/locations/perspectiveScene.js')
    print('')
    print('Test from the mobile console:')
    print("  const s = game.scene.getScenes(true)[0]")
    print("  s.promptEasca(t => console.log('got:', t))")


if __name__ == '__main__':
    main()
