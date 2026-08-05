// moonPeek.js
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
