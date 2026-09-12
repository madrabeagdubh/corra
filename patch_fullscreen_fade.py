#!/usr/bin/env python3
"""
patch_fullscreen_fade.py

Adds a brief fade-to-black around the fullscreen transition, so the
viewport resize (browser chrome disappearing, everything anchored to the
screen edges jumping to its new position) happens while the screen is
visually covered, instead of as a visible snap.

CRITICAL CONSTRAINT: the fade must not delay the actual el.requestFullscreen()
call relative to the triggering touch event. That call has to stay
synchronous with the gesture -- see patch_early_fullscreen.py and
patch_fullscreen_retry_every_touch.py, which exist specifically because a
non-synchronous call gets rejected with "Permissions check failed"
(missing transient user activation). So the fade-in and the fullscreen
request fire in the same synchronous tick; the fade just runs
concurrently via CSS transition while the request resolves.

Timing:
  - Fade in: 250ms, starting the instant the request is made.
  - On success: hold, then fade back out over 450ms -- long enough to
    cover the resize event and the (now two-rAF-deferred, see
    patch_relayout_resize_race.py) relayout settling underneath it.
  - On rejection: fade back out quickly (150ms) -- nothing actually
    changed, so no need to hold a dark screen for a failed, invisible
    attempt. This matters because onFirstTouch now retries on every
    touch (patch_fullscreen_retry_every_touch.py), so failed attempts are
    expected and shouldn't leave a lingering flash.
  - webkitRequestFullscreen()/msRequestFullscreen() (older, synchronous,
    no promise): same fade-in, then a fixed hold before fading out, since
    there's nothing to await.
  - Already fullscreen, or no Fullscreen API at all: no fade -- nothing
    is changing on screen either way.

A simple _fadeBusy guard avoids restarting the transition if a second
call arrives while one fade is still mid-flight; in the observed
real-world pattern (one rejection, then a later success) the two never
actually overlap, but the guard costs nothing.

Idempotent: guarded on the new overlay helper's presence.
"""
import sys
from pathlib import Path

TARGET = Path("js/introModal.js")

OLD = """function _requestFullscreen() {
    console.log('[ConstellationScene] _requestFullscreen() called, _fullscreenDone=', _fullscreenDone);
    if (_fullscreenDone) return;
    try {
        const el = document.documentElement;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            console.log('[ConstellationScene] already fullscreen');
            _fullscreenDone = true; return;
        }
        if (el.requestFullscreen) {
            console.log('[ConstellationScene] calling el.requestFullscreen()');
            el.requestFullscreen()
                .then(() => { console.log('[ConstellationScene] fullscreen GRANTED'); _fullscreenDone = true; })
                .catch(err => console.warn('[ConstellationScene] Fullscreen request rejected:', err && err.message, err));
        } else if (el.webkitRequestFullscreen) {
            console.log('[ConstellationScene] calling el.webkitRequestFullscreen()');
            el.webkitRequestFullscreen(); _fullscreenDone = true;
        } else if (el.msRequestFullscreen) {
            console.log('[ConstellationScene] calling el.msRequestFullscreen()');
            el.msRequestFullscreen(); _fullscreenDone = true;
        } else {
            console.warn('[ConstellationScene] no requestFullscreen API available on this element');
        }
    } catch (e) { console.warn('[ConstellationScene] Fullscreen:', e); }
}"""

NEW = """/* ── Fullscreen fade ─────────────────────────────────────────────────────
   A full-viewport cover, faded in the instant a fullscreen request is
   made and held across the resize it causes, so the jump in anchored
   elements' positions happens while the screen is covered rather than
   in plain view. Created lazily, reused for the life of the page. */
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

function _requestFullscreen() {
    console.log('[ConstellationScene] _requestFullscreen() called, _fullscreenDone=', _fullscreenDone);
    if (_fullscreenDone) return;
    try {
        const el = document.documentElement;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            console.log('[ConstellationScene] already fullscreen');
            _fullscreenDone = true; return;
        }
        if (el.requestFullscreen) {
            console.log('[ConstellationScene] calling el.requestFullscreen()');
            _fsFadeIn();
            el.requestFullscreen()
                .then(() => {
                    console.log('[ConstellationScene] fullscreen GRANTED');
                    _fullscreenDone = true;
                    setTimeout(() => _fsFadeOut(450), 300);
                })
                .catch(err => {
                    console.warn('[ConstellationScene] Fullscreen request rejected:', err && err.message, err);
                    _fsFadeOut(150);
                });
        } else if (el.webkitRequestFullscreen) {
            console.log('[ConstellationScene] calling el.webkitRequestFullscreen()');
            _fsFadeIn();
            el.webkitRequestFullscreen(); _fullscreenDone = true;
            setTimeout(() => _fsFadeOut(450), 500);
        } else if (el.msRequestFullscreen) {
            console.log('[ConstellationScene] calling el.msRequestFullscreen()');
            _fsFadeIn();
            el.msRequestFullscreen(); _fullscreenDone = true;
            setTimeout(() => _fsFadeOut(450), 500);
        } else {
            console.warn('[ConstellationScene] no requestFullscreen API available on this element');
        }
    } catch (e) { console.warn('[ConstellationScene] Fullscreen:', e); }
}"""


def patch(text):
    if "_fsFadeOverlay" in text:
        print("  - fullscreen fade: already applied, skipping")
        return text, False

    if OLD not in text:
        print("  ! marker not found -- check by hand (is patch_fullscreen_diagnostics.py "
              "applied? this expects that exact form)")
        return text, False

    text = text.replace(OLD, NEW, 1)
    print("  - fullscreen fade: added (fade-in concurrent with the request, "
          "held through the resize, faded out after)")
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
