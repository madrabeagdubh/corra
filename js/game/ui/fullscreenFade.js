/**
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
