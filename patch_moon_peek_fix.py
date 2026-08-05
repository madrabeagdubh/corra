#!/usr/bin/env python3
"""
patch_moon_peek_fix.py

Points the peek at the control that actually fires: the joystick, not the moon
widget.

Run from the repo root, AFTER patch_moon_peek.py:

    python3 patch_moon_peek_fix.py

Idempotent. Rewrites js/game/systems/moonPeek.js and patches
js/game/input/joystick.js.

WHAT WAS WRONG
--------------

The stack trace named it exactly:

    at Joystick.onLongPress [as _onLongPress] (perspectiveScene.js:840)

The moon tile's pointer events are bound by Joystick, on its own _moonCanvas --
the moon widget sits below the joystick root, so the joystick is what receives
the press. moonWidget's long-press handlers were being swapped faithfully and
were never going to fire, because nothing was listening to them.

The joystick exposes onLongPress, onLongPressProgress and onLongPressCancel as
mutable fields, so the swap works the same way. It just has to be done to the
right object.

THE TRAP IN THE RELEASE PATH
----------------------------

joystick.js fires _onLongPressCancel on pointerup ONLY when the long press
hasn't already fired:

    } else if (!this._longPressFired) {
      if (this._onLongPressCancel) this._onLongPressCancel()
    }

Correct for its own purposes -- a completed long press isn't a cancellation. But
it means holding past 700ms and releasing fires nothing at all, so the peek
would stick at full English until the next press. The player would silently lose
their difficulty setting for the rest of the conversation.

So joystick.js gains onPressEnd, called on every pointerup and pointercancel
whatever else happened. Additive: nothing currently passes it, so no existing
behaviour changes.

WHAT THE PEEK REPLACES WHILE A CONVERSATION IS OPEN
---------------------------------------------------

    onLongPressProgress -> raise the English, and NOT show the menu preview,
                           which is what the scene's own handler does
    onLongPress         -> nothing, so the hub can't open
    onLongPressCancel   -> drop the English back
    onPressEnd          -> drop the English back, including after a completed
                           hold

All four are saved and restored on exit, so the hub, the preview overlay and the
charge glow come back exactly as the scene wired them.

Swiping still nudges the moon phase: a drag cancels the press inside the
joystick, and onPressEnd resets the peek when the finger lifts.
"""

import io
import os
import sys

JOY_PATH  = os.path.join('js', 'game', 'input', 'joystick.js')
PEEK_PATH = os.path.join('js', 'game', 'systems', 'moonPeek.js')

MARKER = '_onPressEnd'


def die(msg):
    print('  !! %s' % msg)
    sys.exit(1)


def replace_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        die('expected 1 match for %s, found %d' % (label, n))
    print('  -- %s' % label)
    return src.replace(old, new, 1)


J_OLD_FIELD = """    this._onLongPressCancel   = config.onLongPressCancel    ?? null"""

J_NEW_FIELD = """    this._onLongPressCancel   = config.onLongPressCancel    ?? null
    // Fires on every press end, whether or not the long press completed.
    // _onLongPressCancel deliberately does NOT fire after a completed long
    // press -- right for a cancellation, but it leaves anything driven by press
    // PROGRESS with no way to know the finger has lifted.
    this._onPressEnd          = config.onPressEnd            ?? null"""


J_OLD_UP = """      if (!this._longPressFired && !this._hubDragging && dt < 700 && dx < 12) {
        if (this._onLongPressCancel) this._onLongPressCancel()
        if (this._onTap) this._onTap()
      } else if (!this._longPressFired) {
        if (this._onLongPressCancel) this._onLongPressCancel()
      }"""

J_NEW_UP = """      if (!this._longPressFired && !this._hubDragging && dt < 700 && dx < 12) {
        if (this._onLongPressCancel) this._onLongPressCancel()
        if (this._onTap) this._onTap()
      } else if (!this._longPressFired) {
        if (this._onLongPressCancel) this._onLongPressCancel()
      }
      if (this._onPressEnd) this._onPressEnd()"""


J_OLD_CANCEL = """      if (this._onLongPressCancel) this._onLongPressCancel()
      this._hubDragging    = false
      this._longPressFired = false
    })"""

J_NEW_CANCEL = """      if (this._onLongPressCancel) this._onLongPressCancel()
      if (this._onPressEnd) this._onPressEnd()
      this._hubDragging    = false
      this._longPressFired = false
    })"""


PEEK_JS = r"""// moonPeek.js
//
// During a conversation, holding the moon brings the English up. Releasing puts
// it back. The player's own setting is never touched -- this is a display
// multiplier over the top of it, so a peek can't quietly undo the difficulty
// they chose. A look, not a change.
//
// WHICH CONTROL: the joystick, not the moon widget. The moon tile's pointer
// events are bound by Joystick on its own _moonCanvas -- the widget sits below
// the joystick root, so the joystick receives the press. Swapping moonWidget's
// handlers looks right and does nothing at all.
//
// Outside a conversation the joystick's long press opens the hub, with a
// preview overlay and a charge glow. All of that is saved on enter() and put
// back on exit().

export const MoonPeek = {
  _scene:  null,
  _saved:  null,
  _active: false,

  /** Called once, when the encounter panel is built. */
  attach(_moonWidget, scene) {
    if (scene) this._scene = scene
  },

  _panel() { return this._scene?.textPanel ?? null },
  // Looked up late: the joystick is built in the scene's create(), which may
  // run after the encounter panel's constructor.
  _joy()   { return this._scene?.joystick ?? null },

  _set(p) {
    const panel = this._panel()
    if (panel?.setEnglishPeek) panel.setEnglishPeek(p)
  },

  /** A conversation has started: the hold becomes the English dial. */
  enter() {
    if (this._active) return
    const js = this._joy()
    if (!js) return
    this._active = true

    this._saved = {
      press:    js._onLongPress,
      progress: js._onLongPressProgress,
      cancel:   js._onLongPressCancel,
      end:      js._onPressEnd,
    }

    // Note what is NOT called here: the scene's own progress handler, which
    // fades in the menu preview. Holding during a conversation shouldn't show
    // the player a menu it isn't going to open.
    js._onLongPressProgress = (p) => this._set(p)
    // Swallowed: opening a bag mid-sentence is the thing we're here to stop.
    js._onLongPress         = () => {}
    js._onLongPressCancel   = () => this._set(0)
    // The one that matters. onLongPressCancel doesn't fire after a COMPLETED
    // hold, so without this the English would stay up for good once the player
    // held past the threshold even once.
    js._onPressEnd          = () => this._set(0)
  },

  /** Conversation over. Idempotent -- both end routes call it. */
  exit() {
    if (!this._active) return
    this._active = false
    this._set(0)

    const js = this._joy()
    if (js && this._saved) {
      js._onLongPress         = this._saved.press
      js._onLongPressProgress = this._saved.progress
      js._onLongPressCancel   = this._saved.cancel
      js._onPressEnd          = this._saved.end
    }
    this._saved = null
  },
}
"""


def main():
    for p in (JOY_PATH, PEEK_PATH):
        if not os.path.isfile(p):
            die('%s not found -- run this from the repo root.' % p)

    with io.open(JOY_PATH, encoding='utf-8') as fh:
        joy = fh.read()

    if MARKER in joy:
        print('Already patched -- nothing to do.')
        return

    print('Rewriting %s' % PEEK_PATH)
    with io.open(PEEK_PATH, 'w', encoding='utf-8') as fh:
        fh.write(PEEK_JS)

    print('Patching %s' % JOY_PATH)
    joy = replace_once(joy, J_OLD_FIELD, J_NEW_FIELD, 'onPressEnd callback')
    joy = replace_once(joy, J_OLD_UP, J_NEW_UP, 'fire it on pointerup')
    joy = replace_once(joy, J_OLD_CANCEL, J_NEW_CANCEL, 'fire it on pointercancel')

    with io.open(JOY_PATH, 'w', encoding='utf-8') as fh:
        fh.write(joy)

    print('Done.')


if __name__ == '__main__':
    main()
