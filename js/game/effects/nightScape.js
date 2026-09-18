/**
 * nightScape.js
 *
 * The land the ogham dial stands in, and the moonlight on it.
 *
 * WHY THE SCENE OWNS THIS
 * The dial's handOff() does root.remove(), so anything living inside it dies at
 * the pull-back. The land outlives the poem, so it is built in _buildSky()
 * alongside the star wheels and the dial simply plays in front of it.
 *
 * ── THE HORIZON IS THE VANISHING POINT, NOT THE BOTTOM OF THE SCREEN ─────────
 * The first version scaled every layer about 50% 100%. That is a real pull-back
 * in the arithmetic and completely wrong in the eye: scaling about the bottom
 * edge slides everything DOWN toward that edge, so the layers read as one
 * picture shrinking rather than a world receding.
 *
 * Recede from a landscape and ground features move UP, toward the horizon,
 * because they are getting further away and everything distant sits at eye
 * level. So the origin is the horizon line. Near ground climbs toward it fast,
 * the far ridge barely stirs, and the stars at infinity do not move at all.
 * That spread IS the parallax.
 *
 * The cost is that a layer scaled about the horizon lifts its own bottom edge
 * off the bottom of the screen. So each plate is hung with a negative `bottom`,
 * computed to land its bottom edge exactly on the viewport floor at final
 * scale. Which in turn means THE ART MUST BE OPAQUE FROM ITS RIDGE LINE DOWN —
 * a thin transparent band leaves a hole with stars showing through the ground.
 *
 * ── FIGURES STAND ON A LAYER, THEY ARE NOT A LAYER ──────────────────────────
 * druid and queen share midHeadland's depth exactly. Give them a depth of their
 * own and they recede at a different rate from the ground under their feet, so
 * they drift off it and float. Same z, same scale, same lift: contact holds.
 *
 * ── MOONLIGHT ───────────────────────────────────────────────────────────────
 * A gradient repainted into `background` every frame cannot be transitioned —
 * CSS will not interpolate a background image — so the glow teleported whenever
 * the moon moved without a drag driving it, most visibly across the 2.4s
 * pull-back. It is now a fixed-size element moved with `transform`, which does
 * transition, and scaled by the moon's actual diameter so the glow shrinks with
 * the moon instead of staying a floodlight.
 *
 * It is also masked to its lower half. Physically a moon lights everything, but
 * lighting the open sky just greys it out, drowns the stars and makes the poem
 * hard to read. What we want is the low air over the land.
 */

const DIR = 'assets/nightscape/';

/* Depth in arbitrary units, and how far the camera travels. Only ever used as
   z/(z+PULL), so the units cancel; the ratios are what matter. */
const PULL = 1.5;

/* Eye level as a fraction of viewport height. Everything recedes toward this
   line, so it also sets HOW LOW the land is able to finish: a plate at scale s
   can never end below FLOOR*(1-s) above the floor, because scaling about the
   horizon lifts it by exactly that much.

   It started at 0.48, mid-screen, which is where a horizon goes when you are
   standing in a landscape. This composition is not that — it is a low band of
   land beneath a very large sky, with the moon resting near the bottom edge. A
   horizon that high forced every plate to finish high enough to sit over the
   moon, and no amount of tuning `top` could get underneath it. */
const HORIZON = 0.75;

/* Each land plate is described by where its TOP EDGE should finish, in vh above
   the viewport floor, after the dolly. Everything else is derived. This is the
   only way to author it that survives a change of phone: sizing by width and
   letting the file's aspect ratio decide the height, as the first version did,
   makes vertical coverage depend on the device's aspect and the plates walked
   clean off the bottom of the screen before the shot even began.

   finalTop must stay above FLOOR - FLOOR*s, or the layer cannot be on screen at
   the START at all — scaling about the horizon lifts a near plate so far that a
   low finishing position implies it began below the floor. That is why
   nearForeground sits at z 2.2 rather than 1.5: at s=0.5 nothing it could finish
   at under 26vh was visible during the poem. */
const LAYERS = [
    // key         file                       z    finalVw  finalTop(vh)
    { key:'farRidge', file:'farRidge.png',       z:8,   vw:105, top:26 },
    { key:'midHead',  file:'midHeadland.png',    z:3,   vw:110, top:17 },
    { key:'druid',    file:'druid.png',          z:3,   vh:8,  foot:11, left:'56%', w:26 },
    { key:'queen',    file:'queen.png',          z:3,   vh:7,  foot:11, left:'63%', w:24 },
    { key:'nearFg',   file:'nearForeground.png', z:2.2, vw:120, top:23 },
];

const scaleFor = z => z / (z + PULL);

// setPan()'s per-layer maximum: half of whatever a layer's own vw exceeds
// 100 by -- the overhang it was already built with specifically so it has
// room to pan without exposing empty space past its own edge. Layers with
// no vw of their own (druid/queen -- small figures, not full-width
// backdrop plates) borrow midHead's overhang instead of computing one from
// their own much smaller width, since they share its depth (z=3) and
// should move with it.
// Every backdrop plate tiles now (repeat-x, see box construction below), so
// none of them can run out of image -- each gets a much larger, unclamped
// swing instead of the overhang-capped maximum figures (druid/queen) still
// use. Scaled by depth so nearer layers still move more, same as the
// overhang-capped approach did: farRidge z=8 -> 15vw, midHead z=3 -> 40vw
// (unchanged from the midHead-only version), nearFg z=2.2 -> ~54.5vw.
const wrapVwFor = z => 120 / z;

// druid/queen (the only layers with no L.vw) lock to nearFg's own wrap
// swing, not an independent amount -- they stand on that layer and should
// slide with it exactly, not at their own rate. Matching wrapVw's raw
// number alone isn't enough: each layer's wrap carries its own recede
// scale (scaleFor(z), fixed by the time any panning happens), which
// MULTIPLIES whatever translation the child (el) gets -- apparent shift =
// raw_vw * scaleFor(z). druid/queen (z=3) and nearFg (z=2.2) scale
// differently, so the same raw number would still move at different
// apparent rates. Compensating by the ratio of the two scales makes the
// APPARENT shift match exactly, not just the raw vw figure.
const nearFgZ = LAYERS.find(x => x.key === 'nearFg').z;
const maxPanVwFor = L => (L.vw !== undefined)
    ? (L.vw - 100) / 2
    : wrapVwFor(nearFgZ) * (scaleFor(nearFgZ) / scaleFor(L.z));

/* Height of the viewport below the horizon, in vh. Every bit of the geometry
   below is measured from the floor up to this line. */
const FLOOR = (1 - HORIZON) * 100;

/* How far below the floor a plate hangs at scale 1, so that once scaled about
   the horizon its bottom edge lands exactly on the floor. */
const dropFor = s => (1 / s - 1) * FLOOR;

/* How far up the screen the plate reaches at scale 1, back-calculated from
   where its top edge should finish. A point h above the floor maps to
   FLOOR - (FLOOR - h) * s, so inverting gives this. */
const coverFor = (s, finalTop) => FLOOR - (FLOOR - finalTop) / s;

/* The moonlight glow. Off: a screen-blend layer bigger than the viewport is
   the most expensive thing in this scene, and its cost climbs with the
   moon's brightness. The code below is left intact — set this true to put
   it back, or to compare against whatever replaces it. */
const MOONLIGHT = false;

/* The land is lit by the moon rather than painted lit. DARK is where it sits
   at a new moon — 0 is pitch, 1 is no effect. Cheap: one shader per layer, and
   only rewritten when the value actually changes. Do NOT add a blur to these
   elements; it would be re-run on every brightness change. Bake tilt-shift
   into the art instead. */
const MOON_REVEAL = true;
const DARK = 0.30;

const Z_BASE  = 30;
const Z_LIGHT = 44;

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

/* The glow element's unscaled size, and the moon diameter that corresponds to
   scale 1. 188 is the dial's moon in its own 660 viewBox. */
const LIGHT_PX  = 2000;
const MOON_REF  = 188;

export function createNightScape(opts = {}) {
    const parent = (typeof opts.parent === 'string'
        ? document.getElementById(opts.parent) : opts.parent) || document.body;

    const made = [];

    LAYERS.forEach((L, i) => {
        const s    = scaleFor(L.z);
        const drop = dropFor(s);

        const wrap = document.createElement('div');
        wrap.dataset.nightscape = L.key;
        wrap.style.cssText = [
            /* NO overflow:hidden. The wrapper carries the scale, and a
               clipping box scales with its element — so hiding overflow
               here crops each layer to a shrinking rectangle and the land
               pulls away from the screen edges as it recedes. That was the
               dark margin down both sides. */
            'position:fixed;inset:0;pointer-events:none;',
            `z-index:${Z_BASE + i};`,
            `transform-origin:50% ${(HORIZON * 100).toFixed(1)}%;transform:scale(1);`,
        ].join('');

        /* A div with a background rather than an <img>. Both width and height
           have to be set independently — width for overscan, height for
           vertical coverage — and an <img> given both would distort. `cover`
           crops instead, so the art's own aspect ratio stops mattering. */
        const el = document.createElement('div');
        let box;
        if (L.top !== undefined) {
            const cover = coverFor(s, L.top);
            if (cover < 2) console.warn(
                `[nightScape] ${L.key} finishes too low to be visible at the ` +
                `start (cover ${cover.toFixed(1)}vh). Raise finalTop or z.`);
            // Genuinely repeating rather than cover/no-repeat, now that all three
            // backdrop plates have art suited to it. `auto <height>` keeps each
            // tile at the image's own aspect ratio (unlike `cover`, which sizes
            // from BOTH box dimensions and would distort a repeating tile).
            box = `width:${(L.vw / s).toFixed(2)}vw;height:${(cover + drop).toFixed(2)}vh;` +
                  `background:url(${DIR}${L.file}) repeat-x 0 100%/auto ${(cover + drop).toFixed(2)}vh;`;
        } else {
            // Figures: contain, so a silhouette keeps its proportions inside a
            // box whose height is what we actually care about.
            box = `width:${(L.w / s).toFixed(2)}vw;height:${(L.vh / s).toFixed(2)}vh;` +
                  `background:url(${DIR}${L.file}) no-repeat 50% 100%/contain;`;
        }
        el.style.cssText = [
            'position:absolute;',
            `bottom:${(L.foot !== undefined ? L.foot - drop : -drop).toFixed(2)}vh;`,
            L.left ? `left:${L.left};` : 'left:50%;',
            'transform:translateX(-50%);',
            box,
        ].join('');

        wrap.appendChild(el);
        parent.appendChild(wrap);

        let lit = null;
        if (L.key === 'druid' || L.key === 'queen') {
            lit = el.cloneNode(false);
            lit.style.backgroundImage = `url(${DIR}${L.file.replace('.png','Lit.png')})`;
            lit.style.opacity = '0';
            lit.style.transition = 'opacity 0.4s ease';
            wrap.appendChild(lit);
        }

        /* The tall flower stalks' own tops, continuously (if very gently)
           ruffled. A masked clone rather than touching `el` directly: `el`'s
           own transform is needed unchanged for panning (setPan() writes
           backgroundPositionX on wrapping layers, not transform, but keeping
           the sway on a separate element means the skew can never fight
           anything else that moves `el`). The mask is measured from the
           actual art — nearForeground.png is fully transparent above ~14% of
           its own height, sparse (the thin tops, meant to sway) from there
           to ~40%, and solid ground/dense bloom below ~68% (measured via a
           per-row opacity scan) — so the fade sits in that transition rather
           than at an arbitrary round number.
           `el` gets the EXACT INVERSE mask, not no mask at all: with `sway`
           merely stacked on top of an unmasked `el`, the two are pixel-
           identical only at rest (skewX(0)); the moment `sway` skews, its
           shifted stalks no longer land on the same pixels as `el`'s
           unmoving copy underneath, and this art is too sparse (thin lines
           against a mostly transparent ground) to fully cover its own old
           position — so the static copy shows through as a visible double.
           Complementary masks mean each row is drawn by exactly one of the
           two layers at any moment: `el` is the only thing rendering the
           lower, static two-thirds, `sway` the only thing rendering the
           upper, moving third, with a crossfade handoff between them at rest
           that reproduces the original single-layer image exactly.
           Position (backgroundPositionX) and brightness (filter) are kept in
           sync with `el` wherever those already get written below
           (setPan(), place()) — a clone has no live link to the original, so
           anything that moves or lights `el` has to say so explicitly for
           `sway` too, the same way `lit` already does. */
        let sway = null;
        if (L.key === 'nearFg') {
            /* Transition zone widened from 38-68% to 30-70%, and the sway
               clone's own pivot moved from the very bottom (100%) to this
               zone's own midpoint (50%) -- together, these fix a seam that
               showed up once the sway amplitude grew: skewX() shifts every
               point sideways by an amount proportional to its distance from
               transform-origin, so with the origin pinned at the roots, the
               transition zone (30-70%, nowhere near the roots) shifted by
               real, visible pixels under any meaningful skew, sliding out
               of registration with the static base layer directly beneath
               it and exposing it as a duplicated-looking sliver right where
               the stalks meet the ground. Pivoting from the transition
               zone's own centre instead keeps that zone close to the point
               that doesn't move, so it stays in registration with the base
               layer through the skew; the fully-opaque top (still the part
               that's actually far enough from centre to swing visibly)
               keeps reading as the thing swaying, and the widened,
               softer gradient gives any residual mismatch less of a hard
               edge to be seen at. */
            el.style.maskImage =
                'linear-gradient(to bottom, transparent 0%, transparent 30%, black 70%)';
            el.style.webkitMaskImage = el.style.maskImage;
            sway = el.cloneNode(false);
            sway.style.maskImage =
                'linear-gradient(to bottom, black 0%, black 30%, transparent 70%)';
            sway.style.webkitMaskImage = sway.style.maskImage;
            sway.style.transformOrigin = '50% 50%';
            wrap.appendChild(sway);
        }

        made.push({ wrap, el, lit, sway, endScale: s, maxPanVw: maxPanVwFor(L),
                    wraps: L.top !== undefined, wrapVw: wrapVwFor(L.z) });
    });

    /* ── moonlight ──────────────────────────────────────────────────────────
       Fixed size, moved and scaled by transform so both can be transitioned.
       Masked to the lower half: the low air over the land is lit, the open sky
       is left to the stars and the text. */
    const light = document.createElement('div');
    light.dataset.nightscape = 'moonlight';
    const mask = 'linear-gradient(to bottom, rgba(0,0,0,0) 44%, rgba(0,0,0,1) 78%)';
    light.style.cssText = [
        'position:fixed;left:0;top:0;',
        `width:${LIGHT_PX}px;height:${LIGHT_PX}px;`,
        'pointer-events:none;border-radius:50%;',
        `z-index:${Z_LIGHT};`,
        'mix-blend-mode:screen;opacity:0;',
        'background:radial-gradient(circle closest-side,' +
            'rgba(198,216,201,0.34) 0%,' +
            'rgba(158,184,166,0.16) 30%,' +
            'rgba(120,150,132,0.05) 55%,' +
            'rgba(0,0,0,0) 72%);',
        `-webkit-mask-image:${mask};mask-image:${mask};`,
        'transform-origin:50% 50%;',
        'transition:opacity 0.35s ease;',
    ].join('');
    /* Not built into the page at all when MOONLIGHT is off — hiding it would
       still leave the compositor a layer to think about. */
    if (MOONLIGHT) parent.appendChild(light);

    /* Lit fraction of the disc, the same curve the dial uses for the English
       gloss — so the land and the text brighten together. */
    const lumFor = p => {
        const s = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI / 2);
        return s * s;
    };

    /* Declared here, not below with `pulled` — place() runs during setup and
       would hit the temporal dead zone of a `let` declared after it. */
    let _lastBright = null;

    let _x = window.innerWidth / 2,
        _y = window.innerHeight * 0.35,
        _d = MOON_REF,
        _p = 0;

    function place() {
        const lum0 = lumFor(_p);

        /* Out of the dark as the moon fills. Rounded to three places and cached,
           so a slow drift writes a few times a second rather than every frame. */
        if (MOON_REVEAL) {
            const b = (DARK + (1 - DARK) * lum0).toFixed(3);
            if (b !== _lastBright) {
                _lastBright = b;
                made.forEach(m => {
                    m.el.style.filter = `brightness(${b})`;
                    // A clone has no live link back to `el` -- brightness has
                    // to be said again here or the swaying top stays whatever
                    // brightness it happened to be cloned at.
                    if (m.sway) m.sway.style.filter = `brightness(${b})`;
                });
            }
        }
        // The figures still take their light from the moon; only the glow layer
        // is gone. This is the cheap half of the effect and it stays.
        made.forEach(m => { if (m.lit) m.lit.style.opacity = lum0.toFixed(3); });
        if (!MOONLIGHT) return;
        const k = _d / MOON_REF;
        light.style.transform =
            `translate3d(${(_x - LIGHT_PX / 2).toFixed(1)}px,` +
            `${(_y - LIGHT_PX / 2).toFixed(1)}px,0) scale(${k.toFixed(4)})`;
        const lum = lumFor(_p);
        light.style.opacity = lum > 0.002 ? lum.toFixed(3) : '0';
        made.forEach(m => { if (m.lit) m.lit.style.opacity = lum.toFixed(3); });
    }
    place();

    /* ── the flower tops, gently astir ──────────────────────────────────────
       Continuous rather than one-shot: a small, ever-present base sway (two
       incommensurable sines, the same "cheap, seamless, no noise table"
       shape wind.js already uses elsewhere in the game for exactly this
       reason) with an occasional stronger swell riding on top of it, rather
       than long stretches of stillness broken by discrete gusts. Driven by
       its own requestAnimationFrame loop -- this file has no per-frame
       update hook of its own to piggyback on (it's driven externally, in
       bursts, by setProgress()/setPan()/setMoon()), and wind.js's own
       instance is meant to be advanced by a Phaser scene's update(), not
       read from here -- so this reproduces that shape rather than sharing
       the module, in spirit if not in code.
       The gust term is a clamped, steeply-powered sine: mostly near zero,
       rising to a brief, pronounced swell rather than smoothly swinging
       every which way -- an occasional stronger gust riding on the
       continuous base, not a second, larger metronome next to the first
       one. First pass at this (0.45/0.22/2.6, 23s gust period) read as too
       subtle to register as a breeze; doubled once already
       (0.9/0.44/5.2) and still came back as "hardly noticed" -- upped
       again here, further and by more (1.4/0.68/9.0), and the gust period
       itself shortened too (23s -> ~13s, gust frequency raised along with
       size, not just size alone, since "too infrequent" was as much the
       complaint as "too gentle"). */
    const nearFgMade = made.find(m => m.sway);
    let swayRAF = null;
    const swayT0 = performance.now();
    function tickSway(now){
        if (!nearFgMade || !nearFgMade.sway.isConnected) { swayRAF = null; return; }
        const t = (now - swayT0) / 1000;
        const base = Math.sin(t * 0.157) * 1.4 + Math.sin(t * 0.370 + 1.7) * 0.68;
        const gust = Math.max(0, Math.sin(t * 0.45 + 4.1)) ** 4 * 9.0;
        const deg = base + gust;
        nearFgMade.sway.style.transform = `translateX(-50%) skewX(${deg.toFixed(3)}deg)`;
        swayRAF = requestAnimationFrame(tickSway);
    }
    if (nearFgMade) swayRAF = requestAnimationFrame(tickSway);

    let pulled = false;
    let lastProgress = -1;

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

    return {
        /* Driven by the dial while the poem runs, then by the moon widget.
           Instant, because during a drag the glow must not lag the finger. */
        setMoon(x, y, phase, diameter) {
            if (typeof x === 'number') _x = x;
            if (typeof y === 'number') _y = y;
            if (typeof phase === 'number') _p = phase;
            if (typeof diameter === 'number' && diameter > 0) _d = diameter;
            light.style.transition = 'opacity 0.35s ease';
            place();
        },

        /* The camera move. Layers recede toward the horizon at their own rates,
           and the glow travels and shrinks with the moon on the same curve
           rather than teleporting when the scene finally rebuilds. */
        /* Called every frame or so while the poem runs. The layers cover
           CREEP_SHARE of their journey across the whole poem — enough that the
           world is visibly receding as you read, little enough that the pull-back
           still has somewhere to go. No transition: this tracks a value the
           reader is driving, and it must be able to run backwards. */
        setProgress(u) {
            if (pulled) return;
            // The whole journey, matching the dial's CREEP_CAP.
            const t = Math.max(0, Math.min(1, u));
            /* Below this the layers move less than a pixel, and five style writes
               on full-viewport composited elements is not free. */
            if (Math.abs(t - lastProgress) < 0.001) return;
            lastProgress = t;
            made.forEach(m => {
                // Written once. Reassigning it every tick invalidates the style of
                // a large composited layer for no reason.
                if (m.wrap.style.transition !== 'none') m.wrap.style.transition = 'none';
                m.wrap.style.transform =
                    `scale(${(1 + (m.endScale - 1) * t).toFixed(4)})`;
            });
        },

        /* Horizontal pan, synced to the camera's own pan tween (see
           panCameraTo() in introModal.js) -- sells the idea that the whole
           scene, druid/queen included, is turning to look at a different
           part of the sky, rather than the stars alone moving. fraction is
           clamped to [-1, 1]; each layer's own maxPanVw (set at creation,
           see maxPanVwFor() above) caps it to exactly the overhang that
           layer's own art was built with, so full pan reveals as much of
           each layer as physically exists, no more. Applied to `el` (and
           `lit`, to stay aligned) -- `wrap` owns the separate scale
           transform for recede/pull-back, so the two never fight over one
           transform. */
        setPan(fraction) {
            const f = Math.max(-1, Math.min(1, fraction));
            made.forEach(m => {
                if (m.wraps) {
                    // repeat-x wraps automatically and infinitely -- no clamping,
                    // no need to touch the centering transform at all.
                    m.el.style.backgroundPositionX = (f * m.wrapVw).toFixed(2) + 'vw';
                    // Same reasoning as place()'s brightness sync above: a
                    // clone doesn't track `el`'s position on its own, so a
                    // pan would otherwise leave the swaying top's flowers
                    // visibly offset from the static ones under it.
                    if (m.sway) m.sway.style.backgroundPositionX = m.el.style.backgroundPositionX;
                    return;
                }
                const vw = (f * m.maxPanVw).toFixed(2);
                const tr = `translateX(calc(-50% + ${vw}vw))`;
                m.el.style.transform = tr;
                if (m.lit) m.lit.style.transform = tr;
            });
        },

        pullBack(ms = 2400, target = null, easing = 'cubic-bezier(.32,.02,.2,1)') {
            if (pulled) return;
            pulled = true;

            made.forEach(m => {
                m.wrap.style.transition = `transform ${ms}ms ${easing}`;
                void m.wrap.offsetHeight;
                m.wrap.style.transform = `scale(${m.endScale.toFixed(4)})`;
            });

            if (target) {
                light.style.transition =
                    `transform ${ms}ms ${easing}, opacity 0.35s ease`;
                void light.offsetHeight;
                if (typeof target.cx === 'number') _x = target.cx;
                if (typeof target.cy === 'number') _y = target.cy;
                if (typeof target.d  === 'number' && target.d > 0) _d = target.d;
                place();
            }
        },

        elements: made.map(m => m.wrap).concat([light]),

        destroy() {
            if (swayRAF) cancelAnimationFrame(swayRAF);
            // >>> toastSettle v4 (destroy)
            document.removeEventListener('fullscreenchange', onToastFs);
            document.removeEventListener('webkitfullscreenchange', onToastFs);
            document.removeEventListener('pointerdown', onToastTouch, true);
            clearTimeout(giveUpTimer);
            toastEnd();
            if (haze) haze.remove();
            if (fill) fill.remove();
            // <<< toastSettle v4 (destroy)
            made.forEach(m => m.wrap.remove());
            light.remove();
        },
    };
}

