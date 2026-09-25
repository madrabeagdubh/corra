/**
 * toastFog.js
 *
 * Android Chrome shows a grey system toast ("to exit full screen, press
 * Esc") along the bottom of the screen for about 10s once fullscreen is
 * granted. We can't remove it -- the browser draws it above the page -- but
 * we can blend it in, so attention stays on the intro text rather than on
 * the browser's notice.
 *
 * Behaviour:
 *   1. From the moment the intro scene starts, a fog in the toast's own
 *      grey covers the bottom fifth of the screen.
 *   2. It stays up, with no time limit, until fullscreen is confirmed.
 *   3. Once fullscreen is confirmed, it holds 10s more (the toast's life).
 *   4. Then it lets go like mist rather than switching off: the bank thins
 *      slowly and sinks southward while its colour turns from the toast's
 *      flat grey to the night's own mist, and a handful of soft wisps peel
 *      off its upper edge and drift away down and sideways on curling paths,
 *      each at its own pace. Everything is removed once they have gone.
 *
 * Only transform and opacity are animated (Web Animations), which a phone
 * composites without repainting, and only for these few seconds. With
 * "reduce motion" set on the device, it simply fades.
 *
 * Only created where a toast can actually happen: a touch device with the
 * Fullscreen API that isn't already fullscreen. iPhone Safari has no
 * Fullscreen API, and desktop Chrome puts its notice at the top, so neither
 * gets the fog.
 *
 * Usage (introModal.js):
 *   armToastFog()    at the start of the intro scene
 *   clearToastFog()  when the intro ends, in case fullscreen never happened
 */

// Sampled from a screenshot of the real toast: #4E4D52.
const TOAST_GREY_RGB   = '78,77,82';
// What it turns into as it thins: close to the moonlit mist and the floor beneath it, so the
// last of it reads as part of the night rather than something laid over it.
const NIGHT_MIST_RGB   = '42,48,70';
// The wisps sit between the two: seen against the dark sky above the bank, a tone halfway from
// the toast's grey to the night's mist reads as mist, where the darker night tone read as
// smudges.
const WISP_RGB         = '62,64,82';
const BAND_VH          = 20;     // bottom fifth of the screen
const HOLD_AFTER_FS_MS = 10000;  // the toast's life after fullscreen is granted

// The release. The bank takes DRIFT_MS to thin away while sinking SINK_VH; the wisps each
// take a little over or under that, starting at staggered moments, so there is never one
// instant when "the fog goes".
// Slowed to a crawl on purpose: the release should be something you half-notice, not watch.
const DRIFT_MS = 15000;
const SINK_VH  = 4;
// How far the wisps travel sideways, at most (vw). Small: they idle, they do not fly.
const WISP_DRIFT_VW = 5;

// The wisps: where along the top edge each starts (fraction of screen width), which way it
// curls (+1 right, -1 left), how big, how long, how late. Fixed rather than random, so the
// effect is the same every time and can be tuned by eye.
const WISPS = [
    { x: 0.14, curl: -1, w: 58, h: 9, ms: 14000, delay:    0 },
    { x: 0.42, curl:  1, w: 64, h: 10, ms: 17000, delay: 1200 },
    { x: 0.70, curl: -1, w: 52, h: 8, ms: 13000, delay:  600 },
    { x: 0.90, curl:  1, w: 56, h: 9, ms: 16000, delay: 2400 },
    { x: 0.30, curl:  1, w: 46, h: 8, ms: 12000, delay: 3200 },
];
// Where the wisps sit: their lower edge this far up (vh). With their heights above, they live
// inside the bank -- the bottom fifth of the screen -- rather than floating clear of it.
const WISP_BOTTOM_VH = 6;

let _armed = false;
let _el = null;          // the whole fog: bank + wisps
let _bank = null;        // the bank itself (a grey layer and a mist layer, cross-faded)
let _holdTimer = null;
let _doneTimer = null;
let _prevBg = null;      // the page background, while the fog borrows it

const _inFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const _reduceMotion = () => !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function _listen(on) {
    const fn = on ? 'addEventListener' : 'removeEventListener';
    document[fn]('fullscreenchange', _onFsChange);
    document[fn]('webkitfullscreenchange', _onFsChange);
}

function _onFsChange() {
    if (!_inFs()) return;              // a failed or exited request: keep waiting
    _listen(false);
    _restoreBg();                      // fullscreen hides the navigation bar, so give it back
    _holdTimer = setTimeout(_release, HOLD_AFTER_FS_MS);
}

function _layer(rgb) {
    // Solid where the toast sits, thinning upward so it reads as fog.
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;inset:0;' +
        `background:linear-gradient(to top,rgba(${rgb},1) 0%,rgba(${rgb},1) 55%,rgba(${rgb},0) 100%);`;
    return d;
}

function _release() {
    _holdTimer = null;
    if (!_el || !_bank) return;

    if (_reduceMotion() || typeof _el.animate !== 'function') {
        _el.style.transition = 'opacity 6000ms ease';
        _el.style.opacity = '0';
        _doneTimer = setTimeout(clearToastFog, 6100);
        return;
    }

    const ease = 'cubic-bezier(.45,0,.25,1)';

    // The bank: thins and sinks. Most of the thinning happens in the back half, so it lingers
    // a moment -- the eye reads a slow start as weather, a fast start as a switch.
    _bank.animate([
        { opacity: 1,    transform: 'translateY(0)' },
        { opacity: 0.8,  transform: `translateY(${SINK_VH * 0.3}vh)`, offset: 0.35 },
        { opacity: 0,    transform: `translateY(${SINK_VH}vh)` },
    ], { duration: DRIFT_MS, easing: ease, fill: 'forwards' });

    // ...and turns from the toast's grey to the night's mist over its first half.
    const [grey, mist] = _bank.children;
    grey.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: DRIFT_MS * 0.5, easing: 'ease-in-out', fill: 'forwards' });
    mist.animate([{ opacity: 0 }, { opacity: 1 }],
        { duration: DRIFT_MS * 0.5, easing: 'ease-in-out', fill: 'forwards' });

    // The wisps: each rotates a few degrees about a point below itself, which swings it along a
    // shallow arc rather than a straight line -- the hint of a swirl -- while sinking a little,
    // spreading and thinning. They live inside the bank and swell into view within it, so they
    // read as the mist itself stirring rather than something rising off it. They spread
    // SIDEWAYS only: scaling about that low pivot would also lift them -- in the first version,
    // by about a fifth of the screen, which is why they floated so far above the bank.
    let longest = DRIFT_MS;
    for (const w of WISPS) {
        const d = document.createElement('div');
        d.style.cssText = [
            'position:absolute;',
            `left:${(w.x * 100).toFixed(1)}vw;bottom:${WISP_BOTTOM_VH}vh;`,
            `width:${w.w}vw;height:${w.h}vh;margin-left:-${w.w / 2}vw;`,
            `background:radial-gradient(ellipse at center,rgba(${WISP_RGB},0.8) 0%,` +
                `rgba(${WISP_RGB},0.4) 38%,rgba(${WISP_RGB},0) 70%);`,
            'transform-origin:50% 260%;opacity:0;will-change:transform,opacity;',
        ].join('');
        _el.appendChild(d);
        const turn = 5 * w.curl;
        d.animate([
            { opacity: 0,    transform: 'translate(0,0) rotate(0deg) scale(1,1)' },
            { opacity: 0.75, transform: `translate(${w.curl * WISP_DRIFT_VW * 0.2}vw,${SINK_VH * 0.15}vh) rotate(${turn * 0.25}deg) scale(1.04,1)`, offset: 0.2 },
            { opacity: 0.45, transform: `translate(${w.curl * WISP_DRIFT_VW * 0.6}vw,${SINK_VH * 0.6}vh) rotate(${turn * 0.7}deg) scale(1.15,1)`, offset: 0.6 },
            { opacity: 0,    transform: `translate(${w.curl * WISP_DRIFT_VW}vw,${SINK_VH}vh) rotate(${turn}deg) scale(1.25,1)` },
        ], { duration: w.ms, delay: w.delay, easing: ease, fill: 'forwards' });
        longest = Math.max(longest, w.ms + w.delay);
    }

    _doneTimer = setTimeout(clearToastFog, longest + 100);
}

/** Show the fog now; it releases itself 10s after fullscreen is confirmed.
 *  Safe to call more than once; only the first call does anything. */
export function armToastFog() {
    if (_armed) return;
    _armed = true;
    const de = document.documentElement;
    const hasApi = !!(de.requestFullscreen || de.webkitRequestFullscreen);
    const touch  = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (!hasApi || !touch || _inFs()) return;

    const el = document.createElement('div');
    el.id = 'toast-fog';
    // Tall enough for the wisps to rise out of the bank; overflow hidden only at the bottom
    // edge of the screen, which is where everything drifts to.
    el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:100vh;' +
        'z-index:999995;pointer-events:none;overflow:hidden;';
    const bank = document.createElement('div');
    bank.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${BAND_VH}vh;will-change:transform,opacity;`;
    const mist = _layer(NIGHT_MIST_RGB);
    mist.style.opacity = '0';
    bank.appendChild(_layer(TOAST_GREY_RGB));
    bank.appendChild(mist);
    el.appendChild(bank);
    document.body.appendChild(el);
    // Android Chrome paints its navigation bar (the strip under the three buttons) in the
    // page's background colour. Borrow the fog's grey for it while we are windowed, so the
    // bottom of the screen is one grey band instead of a grey band over a dark bar.
    const root = document.documentElement;
    _prevBg = [root.style.backgroundColor, document.body.style.backgroundColor];
    root.style.backgroundColor = `rgb(${TOAST_GREY_RGB})`;
    document.body.style.backgroundColor = `rgb(${TOAST_GREY_RGB})`;
    _el = el;
    _bank = bank;
    _listen(true);
}

/** Remove the fog immediately, wherever it is in its life. */
export function clearToastFog() {
    _listen(false);
    if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
    if (_doneTimer) { clearTimeout(_doneTimer); _doneTimer = null; }
    if (_el) { _el.remove(); _el = null; _bank = null; }
    _restoreBg();
}

function _restoreBg() {
    if (!_prevBg) return;
    document.documentElement.style.backgroundColor = _prevBg[0];
    document.body.style.backgroundColor = _prevBg[1];
    _prevBg = null;
}
