#!/usr/bin/env python3
"""
patch_fullscreen_shared_module.py

Extracts the fullscreen-request-with-fade logic (previously private to
introModal.js) into a shared module, js/game/ui/fullscreenFade.js, and
wires it up in two places:

  1. introModal.js -- the ogham dial's first-touch trigger, and every
     other existing fallback call site, now call the shared function
     instead of a private copy. Ready to run whenever it's needed; a fast
     no-op (via the module's own "already done" flag, checked first)
     whenever it isn't.

  2. fullscreenButton.js -- the floating restore button, already shown
     automatically whenever the game is active and NOT in fullscreen
     (its own update() already handles that), now requests fullscreen
     through the SAME shared function instead of a bare, un-faded call.

The shared module also listens for fullscreenchange and resets its own
"already done" flag whenever the player actually exits fullscreen -- back
gesture, browser chrome, Esc, whatever. Without that reset, the flag
would stay true forever after the first successful entry, and the
restore button's tap would silently no-op instead of re-requesting.

Idempotent: guarded on the new module's presence / the call sites already
being updated.
"""
import sys
from pathlib import Path

FADE_MODULE = Path("js/game/ui/fullscreenFade.js")
MODAL_TARGET = Path("js/introModal.js")
BUTTON_TARGET = Path("js/game/ui/fullscreenButton.js")

FADE_MODULE_SOURCE = """/**
 * fullscreenFade.js
 *
 * Shared fullscreen-request logic: fade the screen while the transition
 * happens, and remember whether it has already succeeded so repeat calls
 * (e.g. the ogham dial's onFirstTouch, which retries on every touch) no-op
 * instead of re-requesting. Forgets that memory the moment the player
 * actually exits fullscreen, so a later request -- typically via the
 * floating restore button -- tries again instead of silently doing nothing.
 *
 * Used by:
 *   - introModal.js, from the ogham dial's first touch onward, and every
 *     other existing fallback trigger in that file. Ready to run whenever
 *     it's needed; a fast no-op whenever it isn't (already fullscreen,
 *     already granted this session, or no Fullscreen API at all).
 *   - fullscreenButton.js, the floating restore button shown during actual
 *     gameplay whenever the game is active and not currently fullscreen.
 */

let _fsDone = false;
let _fsFadeEl = null, _fsFadeBusy = false;

function _fsFadeOverlay() {
    if (_fsFadeEl) return _fsFadeEl;
    const el = document.createElement('div');
    el.id = 'fs-fade-overlay';
    el.style.cssText = [
        'position:fixed;inset:0;z-index:999998;',
        'background:#070b0a;pointer-events:none;',
        'opacity:0;transition:opacity 0.25s ease;',
    ].join('');
    document.body.appendChild(el);
    _fsFadeEl = el;
    return el;
}
function _fsFadeIn() {
    if (_fsFadeBusy) return;
    _fsFadeBusy = true;
    const el = _fsFadeOverlay();
    el.style.transition = 'opacity 0.25s ease';
    el.style.opacity = '1';
}
function _fsFadeOut(ms) {
    const el = _fsFadeOverlay();
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity = '0';
    _fsFadeBusy = false;
}

/** Ready to run whenever it's needed; a fast no-op whenever it isn't. */
export function requestFullscreenWithFade() {
    console.log('[fullscreenFade] requestFullscreenWithFade() called, _fsDone=', _fsDone);
    if (_fsDone) return;
    try {
        const el = document.documentElement;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            console.log('[fullscreenFade] already fullscreen');
            _fsDone = true; return;
        }
        if (el.requestFullscreen) {
            console.log('[fullscreenFade] calling el.requestFullscreen()');
            _fsFadeIn();
            el.requestFullscreen()
                .then(() => {
                    console.log('[fullscreenFade] fullscreen GRANTED');
                    _fsDone = true;
                    setTimeout(() => _fsFadeOut(450), 300);
                })
                .catch(err => {
                    console.warn('[fullscreenFade] Fullscreen request rejected:', err && err.message, err);
                    _fsFadeOut(150);
                });
        } else if (el.webkitRequestFullscreen) {
            console.log('[fullscreenFade] calling el.webkitRequestFullscreen()');
            _fsFadeIn();
            el.webkitRequestFullscreen(); _fsDone = true;
            setTimeout(() => _fsFadeOut(450), 500);
        } else if (el.msRequestFullscreen) {
            console.log('[fullscreenFade] calling el.msRequestFullscreen()');
            _fsFadeIn();
            el.msRequestFullscreen(); _fsDone = true;
            setTimeout(() => _fsFadeOut(450), 500);
        } else {
            console.warn('[fullscreenFade] no requestFullscreen API available on this element');
        }
    } catch (e) { console.warn('[fullscreenFade] Fullscreen:', e); }
}

/** For scene (re)initialisation -- matches the old _fullscreenDone reset
 *  that used to live in introModal.js's initConstellationScene(). */
export function resetFullscreenState() {
    _fsDone = false;
}

/* If the player actually exits fullscreen -- back gesture, browser chrome,
   Esc key, whatever -- forget that we've already succeeded, so the next
   request (typically via the floating restore button) tries again instead
   of silently no-op'ing forever. */
function _onFullscreenChange() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (_fsDone) console.log('[fullscreenFade] exited fullscreen -- ready to re-enter');
        _fsDone = false;
    }
}
document.addEventListener('fullscreenchange', _onFullscreenChange);
document.addEventListener('webkitfullscreenchange', _onFullscreenChange);
"""

# ── introModal.js edits ─────────────────────────────────────────────────────

IMPORT_OLD = "import { createStarField } from './game/effects/starField.js';"
IMPORT_NEW = (IMPORT_OLD + "\n"
              "import { requestFullscreenWithFade, resetFullscreenState } "
              "from './game/ui/fullscreenFade.js';")

VAR_OLD = "var _audioUnlocked  = false;\nvar _fullscreenDone = false;"
VAR_NEW = "var _audioUnlocked  = false;"

# The whole private fade+_requestFullscreen block, start marker through its
# closing brace, matched precisely so nothing after it is disturbed.
FADE_BLOCK_START = "/* ── Fullscreen fade ─────────────────────────────────────────────────────"
FADE_BLOCK_END = "    } catch (e) { console.warn('[ConstellationScene] Fullscreen:', e); }\n}\n\nvar _sceneInitialized = false;"
FADE_BLOCK_END_REPLACEMENT = "var _sceneInitialized = false;"

RESET_OLD = "    _sceneInitialized = true;\n    _fullscreenDone = false;"
RESET_NEW = "    _sceneInitialized = true;\n    resetFullscreenState();"


def patch_modal(text):
    changed = False

    if "requestFullscreenWithFade" in text and "function _requestFullscreen()" not in text:
        print("  - introModal.js: already migrated to shared module, skipping")
        return text, False

    if IMPORT_OLD in text and "fullscreenFade.js" not in text:
        text = text.replace(IMPORT_OLD, IMPORT_NEW, 1)
        changed = True
        print("  - introModal.js: added import of shared fullscreenFade module")

    if VAR_OLD in text:
        text = text.replace(VAR_OLD, VAR_NEW, 1)
        changed = True
        print("  - introModal.js: removed local _fullscreenDone (now owned by shared module)")

    if FADE_BLOCK_START in text:
        start = text.index(FADE_BLOCK_START)
        end_marker_idx = text.index(FADE_BLOCK_END, start)
        end = end_marker_idx + len(FADE_BLOCK_END)
        text = text[:start] + FADE_BLOCK_END_REPLACEMENT + text[end:]
        changed = True
        print("  - introModal.js: removed private fade overlay + _requestFullscreen() "
              "(now in shared module)")

    if RESET_OLD in text:
        text = text.replace(RESET_OLD, RESET_NEW, 1)
        changed = True
        print("  - introModal.js: scene-init reset now calls resetFullscreenState()")

    n = text.count("_requestFullscreen()")
    if n:
        text = text.replace("_requestFullscreen()", "requestFullscreenWithFade()")
        changed = True
        print(f"  - introModal.js: {n} call site(s) switched to requestFullscreenWithFade()")

    return text, changed


# ── fullscreenButton.js edits ────────────────────────────────────────────────

BTN_OLD = """  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const el = document.documentElement
    if      (el.requestFullscreen)       el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  })"""
BTN_NEW = """  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    requestFullscreenWithFade()
  })"""

BTN_IMPORT_OLD = "export function initFullscreenButton() {"
BTN_IMPORT_NEW = ("import { requestFullscreenWithFade } from './fullscreenFade.js'\n\n"
                  "export function initFullscreenButton() {")


def patch_button(text):
    changed = False

    if "requestFullscreenWithFade" in text:
        print("  - fullscreenButton.js: already migrated, skipping")
        return text, False

    if BTN_IMPORT_OLD not in text or BTN_OLD not in text:
        print("  ! fullscreenButton.js: marker(s) not found -- check by hand")
        return text, False

    text = text.replace(BTN_IMPORT_OLD, BTN_IMPORT_NEW, 1)
    text = text.replace(BTN_OLD, BTN_NEW, 1)
    changed = True
    print("  - fullscreenButton.js: now uses the shared fade-enabled request")
    return text, changed


def main():
    changed_any = False

    if not FADE_MODULE.exists():
        FADE_MODULE.parent.mkdir(parents=True, exist_ok=True)
        FADE_MODULE.write_text(FADE_MODULE_SOURCE)
        print(f"Created {FADE_MODULE}")
        changed_any = True
    else:
        print(f"  - {FADE_MODULE}: already exists, skipping")

    for target, patch_fn in ((MODAL_TARGET, patch_modal), (BUTTON_TARGET, patch_button)):
        if not target.exists():
            print(f"Can't find {target} -- run this from the repo root.")
            sys.exit(1)
        original = target.read_text()
        patched, changed = patch_fn(original)
        if changed:
            target.write_text(patched)
            print(f"Patched {target}")
            changed_any = True

    if not changed_any:
        print("Nothing to do -- already applied.")


if __name__ == "__main__":
    main()
