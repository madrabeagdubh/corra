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
   line. Move it and the whole sense of where the viewer is standing moves. */
const HORIZON = 0.48;

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
    { key:'farRidge', file:'farRidge.png',       z:8,   vw:105, top:44 },
    { key:'midHead',  file:'midHeadland.png',    z:3,   vw:110, top:32 },
    { key:'druid',    file:'druid.png',          z:3,   vh:8,  foot:40, left:'20%', w:26 },
    { key:'queen',    file:'queen.png',          z:3,   vh:7,  foot:39, left:'29%', w:24 },
    { key:'nearFg',   file:'nearForeground.png', z:2.2, vw:120, top:24 },
];

const scaleFor = z => z / (z + PULL);

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

const Z_BASE  = 30;
const Z_LIGHT = 44;

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
            box = `width:${(L.vw / s).toFixed(2)}vw;height:${(cover + drop).toFixed(2)}vh;` +
                  `background:url(${DIR}${L.file}) no-repeat 50% 100%/cover;`;
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

        made.push({ wrap, el, lit, endScale: s });
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
    parent.appendChild(light);

    /* Lit fraction of the disc, the same curve the dial uses for the English
       gloss — so the land and the text brighten together. */
    const lumFor = p => {
        const s = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI / 2);
        return s * s;
    };

    let _x = window.innerWidth / 2,
        _y = window.innerHeight * 0.35,
        _d = MOON_REF,
        _p = 0;

    function place() {
        const k = _d / MOON_REF;
        light.style.transform =
            `translate3d(${(_x - LIGHT_PX / 2).toFixed(1)}px,` +
            `${(_y - LIGHT_PX / 2).toFixed(1)}px,0) scale(${k.toFixed(4)})`;
        const lum = lumFor(_p);
        light.style.opacity = lum > 0.002 ? lum.toFixed(3) : '0';
        made.forEach(m => { if (m.lit) m.lit.style.opacity = lum.toFixed(3); });
    }
    place();

    let pulled = false;

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
            made.forEach(m => {
                m.wrap.style.transition = 'none';
                m.wrap.style.transform =
                    `scale(${(1 + (m.endScale - 1) * t).toFixed(4)})`;
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
            made.forEach(m => m.wrap.remove());
            light.remove();
        },
    };
}

