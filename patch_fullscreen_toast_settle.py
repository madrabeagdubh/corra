#!/usr/bin/env python3
"""
patch_fullscreen_toast_settle.py   (v4 -- replaces v1/v2/v3 in the patch stack)

Gets the land out of the way of Chrome's "to exit full screen, press Esc" pill.

v4 changes from v3:
  - FIX: v3's grey fill was as tall as the nearest plate's whole lift (~130px),
    and the hill art is transparent between its ridges, so the fill showed
    through as a solid grey band with a hard top edge. It is now sized to the
    ACTUAL gap a lift opens under the plates (plus a little slack), so its top
    edge sits behind opaque ground and it shows only in the gap itself. If no
    gap opens it is a sliver. TOAST_FILL = false removes it entirely.

v3 changes from v2:
  - TIMING: the land now HOLDS STILL for the pill's whole life (TOAST_MS, 10s
    from entering fullscreen) and only THEN begins to descend, taking
    TOAST_SETTLE_MS (also 10s) to arrive. The haze holds at full strength for
    the same 10s and fades with the descent.
  - Lifted higher (TOAST_MARGIN_PX 12 -> 56).
  - Haze stronger (alpha .90 -> .97, and it stays denser further up).
  - A solid pill-grey FILL sits under the land, so if a plate is lifted past
    its own bottom edge the gap shows grey rather than stars. That replaces
    v2's cap on lift (nothing limits how high you can push TOAST_MARGIN_PX
    now). The fill is removed when the descent finishes.
  - The "fullscreen never arrived" fallback still exists, and skips the hold
    (there is no pill to wait out).

Touches ONE file: js/game/effects/nightScape.js
  1. constants block           (anchor: `const Z_LIGHT = 44;`)
  2. instance code             (anchor: `let pulled = false;` / `let lastProgress = -1;`)
  3. destroy() cleanup         (anchor: the swayRAF / wrap.remove / light.remove trio)

Idempotent. Any v1, v2 or v3 patch present is stripped first, then v4 applied.
Usage:  python3 patch_fullscreen_toast_settle.py [path/to/repo]
"""
import sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
path = root / 'js/game/effects/nightScape.js'
src = path.read_text()

if '>>> toastSettle v4' in src:
    print('nightScape.js: v4 already applied, nothing to do')
    sys.exit(0)


def replace_once(text, anchor, new, label):
    n = text.count(anchor)
    if n != 1:
        sys.exit(f'ABORT: anchor for "{label}" found {n} times (expected 1). '
                 f'File left untouched.')
    return text.replace(anchor, new)


def strip_between(text, start, end, label):
    i = text.find(start)
    if i < 0:
        sys.exit(f'ABORT: old-version start marker for "{label}" not found. '
                 f'File left untouched.')
    j = text.find(end, i)
    if j < 0:
        sys.exit(f'ABORT: old-version end marker for "{label}" not found. '
                 f'File left untouched.')
    return text[:i] + text[j + len(end):]


Z_HAZE_LINE = ("const Z_HAZE              = Z_BASE + LAYERS.length;"
               "   // over the land, under the dial\n")
DESTROY_END = "            if (haze) haze.remove();\n"

# ── strip v1 / v2 if present ─────────────────────────────────────────────────
if '[toastSettle]' in src:                                   # v1
    print('v1 found -- stripping it first')
    src = strip_between(src, "\n/* ── [toastSettle] THE BROWSER'S FULLSCREEN NOTICE",
                        Z_HAZE_LINE, 'v1 constants')
    src = strip_between(src, "\n    /* ── [toastSettle] see the constants block near the top of this file",
                        "        document.addEventListener('webkitfullscreenchange', onToastFs);\n    }\n",
                        'v1 instance code')
    src = strip_between(src, "            // [toastSettle]\n", DESTROY_END, 'v1 destroy')

if 'toastSettle v2' in src:                                  # v2
    print('v2 found -- stripping it first')
    src = strip_between(src, "\n/* ── [toastSettle v2] THE BROWSER'S FULLSCREEN NOTICE",
                        Z_HAZE_LINE, 'v2 constants')
    src = strip_between(src, "\n    /* ── [toastSettle v2] see the constants block near the top of this file",
                        "        document.addEventListener('pointerdown', onToastTouch, true);\n    }\n",
                        'v2 instance code')
    src = strip_between(src, "            // [toastSettle v2]\n", DESTROY_END, 'v2 destroy')

if 'toastSettle v3' in src:                                  # v3
    print('v3 found -- stripping it first')
    src = strip_between(src, "\n// >>> toastSettle v3 (constants)\n",
                        "// <<< toastSettle v3 (constants)\n", 'v3 constants')
    src = strip_between(src, "\n    // >>> toastSettle v3 (instance)\n",
                        "    // <<< toastSettle v3 (instance)\n", 'v3 instance code')
    src = strip_between(src, "            // >>> toastSettle v3 (destroy)\n",
                        "            // <<< toastSettle v3 (destroy)\n", 'v3 destroy')

assert 'toastSettle' not in src, 'old patch not fully stripped'


# ── 1. constants ─────────────────────────────────────────────────────────────
A1 = "const Z_LIGHT = 44;\n"
N1 = A1 + r"""
// >>> toastSettle v4 (constants)
/* ── THE BROWSER'S FULLSCREEN NOTICE ──────────────────────────────────────────
   Chrome draws a grey "to exit full screen" pill over the bottom of the page
   for ten seconds after fullscreen is granted. It can't be styled or moved, so
   the scene gets out of its way instead.

   BEFORE fullscreen (from the moment the scene is built) every land plate sits
   lifted clear of where the pill will be, with a haze in the pill's own grey
   along the bottom edge, and a thin fill of the same grey under the land so the
   gap a lift opens beneath a plate's bottom edge shows grey, not sky. Nothing changes
   when the pill appears: it arrives over a scene that has already made room.

   The moment fullscreen is entered a ten-second countdown starts, and the land
   HOLDS STILL for all of it. Only when the pill has gone do the plates begin to
   ease down into their proper place while the haze clears, taking
   TOAST_SETTLE_MS to arrive. The fill goes when the descent ends.

   The lift is per plate, scaled by 1/z like the parallax itself: near ground
   travels furthest, the far ridge barely. druid and queen share midHead's z, so
   they move exactly as the ground under their feet does.

   It rides the `translate` property, not `transform`. `transform` belongs to
   setProgress()/pullBack(); `translate` composes with it OUTSIDE the scale, so
   the lift is in true screen units and the two never fight. The resting lift is
   an inline style; the descent is a Web Animations API animation -- compositor
   work, no per-frame JS.

   Chrome gives no event when the pill goes: TOAST_MS is a stopwatch, not a
   signal. Touch devices with a Fullscreen API only (the desktop notice sits at
   the top, not here). Set TOAST_SETTLE false to switch the whole thing off. */
const TOAST_SETTLE        = true;
const TOAST_MS            = 10000;   // how long the pill stays up: the land holds still this long
const TOAST_SETTLE_MS     = 10000;   // then takes this long to descend and clear
const TOAST_EASE          = 'cubic-bezier(.37,0,.63,1)';   // ease-in-out (sine)
/* The pill's top edge, measured up from the bottom of the screen, in DEVICE
   pixels (read off a screenshot). Chrome sizes the pill in dp, so dividing by
   devicePixelRatio gives CSS px that hold across phones; vh would not. */
const TOAST_TOP_DEVICE_PX = 208;
const TOAST_MARGIN_PX     = 56;      // clearance above the pill for the nearest plate (was 12)
const TOAST_RGB           = '78,77,82';  // the pill's own colour, sampled
const TOAST_HAZE_ALPHA    = 0.97;    // was .90
const TOAST_HAZE_MID      = 0.85;    // share of that alpha still left halfway up the haze (was .65)
const TOAST_HAZE_EXTRA_PX = 60;      // haze reaches this far above the nearest plate's lift
/* If fullscreen has not arrived this long after the first touch, stop waiting
   and descend anyway (with no hold: there is no pill), so a refused request
   can't leave the land floating. */
const TOAST_GIVEUP_MS     = 12000;
/* The fill under the land is only for the gap a lift opens beneath a plate's
   bottom edge, so it is sized to that gap plus this much slack (poem progress
   shrinks a plate's spare below the floor a little as the dolly creeps). It
   must stay SHORT: the hill art is transparent between its ridges, and a tall
   fill shows through them as a grey band. */
const TOAST_FILL          = true;
const TOAST_FILL_SLACK_PX = 24;
const Z_HAZE              = Z_BASE + LAYERS.length;   // over the land, under the dial
const Z_FILL              = Z_BASE - 1;               // under the land, over the sky
// <<< toastSettle v4 (constants)
"""
src = replace_once(src, A1, N1, 'constants')


# ── 2. instance code ─────────────────────────────────────────────────────────
A2 = "    let pulled = false;\n    let lastProgress = -1;\n"
N2 = A2 + r"""
    // >>> toastSettle v4 (instance)
    /* See the constants block near the top of this file. The scene is always
       built before the dial's first touch (that touch is what asks for
       fullscreen), so the resting lift is in place well before the pill can
       appear. If the scene is built while already fullscreen (a restart) there
       is nothing to make room for, so nothing is lifted.
       There is deliberately no cap on the lift: whatever a plate is lifted past
       its own bottom edge, the fill shows through instead of the sky. */
    let toastAnims = [], toastFired = false, haze = null, fill = null, giveUpTimer = null;
    const toastLift = [];
    const inFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    const fsApi = document.documentElement.requestFullscreen
               || document.documentElement.webkitRequestFullscreen;
    const toastOn = TOAST_SETTLE && !!fsApi && !inFs() && window.matchMedia
        && window.matchMedia('(pointer: coarse)').matches;

    function toastEnd() { toastAnims.forEach(a => a.cancel()); toastAnims = []; }

    /* holdMs: how long to stay put before descending. The pill's full life when
       fullscreen has just been entered; nothing when giving up on fullscreen. */
    function toastSettle(holdMs) {
        if (toastFired) return;
        toastFired = true;
        clearTimeout(giveUpTimer);
        document.removeEventListener('pointerdown', onToastTouch, true);
        const timing = { delay: holdMs, duration: TOAST_SETTLE_MS,
                         easing: TOAST_EASE, fill: 'both' };
        made.forEach((m, i) => {
            const px = toastLift[i];
            if (!px) return;
            const a = m.wrap.animate(
                [{ translate: `0 ${(-px).toFixed(1)}px` }, { translate: '0 0' }],
                timing);
            // Clear the resting inline lift BEFORE releasing the animation, so
            // there is no frame where neither is holding the value.
            a.onfinish = () => { m.wrap.style.translate = ''; a.cancel(); };
            toastAnims.push(a);
        });
        const h = haze.animate([{ opacity: 1 }, { opacity: 0 }],
            { ...timing, easing: 'linear' });
        h.onfinish = () => {
            haze.style.opacity = '0'; h.cancel();
            haze.remove(); if (fill) fill.remove();   // the plates are home; both are hidden or spent
        };
        toastAnims.push(h);
    }

    const onToastFs = () => { if (inFs()) toastSettle(TOAST_MS); };
    const onToastTouch = () => {
        document.removeEventListener('pointerdown', onToastTouch, true);
        if (!toastFired) giveUpTimer = setTimeout(() => toastSettle(0), TOAST_GIVEUP_MS);
    };

    if (toastOn) {
        const near = TOAST_TOP_DEVICE_PX / (window.devicePixelRatio || 1) + TOAST_MARGIN_PX;
        made.forEach((m, i) => {
            const px = near * nearFgZ / LAYERS[i].z;
            toastLift[i] = px;
            m.wrap.style.translate = `0 ${(-px).toFixed(1)}px`;
        });

        // Under the land: pill-grey, sized to the ACTUAL gap. A plate's bottom
        // edge hangs dropFor(s) below the floor at scale 1, so lifting it by
        // `lift` opens a gap of (lift - drop) at the bottom of the screen. The
        // deepest of those, plus slack, is all the fill needs to be -- and
        // keeping it that short keeps its top edge behind opaque ground.
        if (TOAST_FILL) {
            const gap = Math.max(0, ...made.map((m, i) =>
                toastLift[i] - dropFor(m.endScale) / 100 * window.innerHeight));
            fill = document.createElement('div');
            fill.dataset.nightscape = 'toastFill';
            fill.style.cssText = [
                'position:fixed;left:0;right:0;bottom:0;pointer-events:none;',
                `height:${(gap + TOAST_FILL_SLACK_PX).toFixed(0)}px;`,
                `background:rgb(${TOAST_RGB});z-index:${Z_FILL};`,
            ].join('');
            parent.appendChild(fill);
        }

        // Over the land: the haze.
        haze = document.createElement('div');
        haze.dataset.nightscape = 'toastHaze';
        const c = TOAST_RGB, a0 = TOAST_HAZE_ALPHA;
        haze.style.cssText = [
            'position:fixed;left:0;right:0;bottom:0;pointer-events:none;opacity:1;',
            `height:${(near + TOAST_HAZE_EXTRA_PX).toFixed(0)}px;`,
            `z-index:${Z_HAZE};`,
            `background:linear-gradient(to top,` +
                `rgba(${c},${a0}) 0%,` +
                `rgba(${c},${(a0 * TOAST_HAZE_MID).toFixed(2)}) 50%,` +
                `rgba(${c},0) 100%);`,
        ].join('');
        parent.appendChild(haze);

        document.addEventListener('fullscreenchange', onToastFs);
        document.addEventListener('webkitfullscreenchange', onToastFs);
        document.addEventListener('pointerdown', onToastTouch, true);
    }
    // <<< toastSettle v4 (instance)
"""
src = replace_once(src, A2, N2, 'instance code')


# ── 3. destroy() ─────────────────────────────────────────────────────────────
A3 = ("            if (swayRAF) cancelAnimationFrame(swayRAF);\n"
      "            made.forEach(m => m.wrap.remove());\n"
      "            light.remove();\n")
N3 = ("            if (swayRAF) cancelAnimationFrame(swayRAF);\n"
      "            // >>> toastSettle v4 (destroy)\n"
      "            document.removeEventListener('fullscreenchange', onToastFs);\n"
      "            document.removeEventListener('webkitfullscreenchange', onToastFs);\n"
      "            document.removeEventListener('pointerdown', onToastTouch, true);\n"
      "            clearTimeout(giveUpTimer);\n"
      "            toastEnd();\n"
      "            if (haze) haze.remove();\n"
      "            if (fill) fill.remove();\n"
      "            // <<< toastSettle v4 (destroy)\n"
      "            made.forEach(m => m.wrap.remove());\n"
      "            light.remove();\n")
src = replace_once(src, A3, N3, 'destroy()')

path.write_text(src)
print('nightScape.js: v4 patched OK')
