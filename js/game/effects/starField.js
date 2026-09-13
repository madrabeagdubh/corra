/**
 * starField.js
 *
 * The turning sky, drawn as stars on a wheel rather than a wheel of stars.
 *
 * WHY THIS REPLACED THE RENDER TEXTURES
 * The old drawStaticBackground() baked 3,470 stars into three square
 * RenderTextures and spun them. Cheap per frame, but a square rotating about
 * its own centre only covers a circle of radius S/2 — so the hub was welded to
 * the middle of the screen, which is where the dial and the moon sit. The sky
 * appeared to orbit the moon. Moving the hub means growing S: putting the pole
 * above the top edge of a 1080x2160 phone needs S≈5500, which is 121MB of GPU
 * texture per layer. Three of those is not a phone.
 *
 * Here each star keeps a radius and an angle about an arbitrary hub, and the
 * hub can be anywhere — off the top of the screen, which is what a northern sky
 * actually looks like, Polaris sitting some 53° up from Ireland. Memory drops
 * from ~157MB of texture to a few thousand floats.
 *
 * WHAT IT COSTS INSTEAD, AND WHY IT IS STILL CHEAP
 * Positions are recomputed every frame. Drawing that through Graphics would
 * rebuild and re-upload geometry each time, which is exactly the cost we are
 * trying to avoid, so the stars are Blitter bobs: a bob is a position and a
 * frame, and moving one is two number writes. The counts are also cut — 3,470
 * was chosen for a texture baked once, where quantity is free. About a thousand
 * live stars reads as dense under the nebula and the moonlight.
 *
 * ANGULAR WRAPPING
 * With the hub off-screen the visible sky is a wedge, not a full circle, so
 * stars spread over 2π would spend most of their lives out of frame. They are
 * distributed across the wedge the screen subtends, padded, and wrapped back to
 * the entry edge when they leave — which happens off-screen, so nothing pops.
 * If the hub is inside the screen the wedge is the whole circle and no wrapping
 * happens.
 */

import Phaser from 'phaser';
import { NIGHT, SKY_SPIN } from '../systems/nightPalette.js';

const TEX = 'starGlyphs';
const CELL = 9;

/* n is the star count, ms one full turn, depth the render order.

   THE THREEFOLD SPREAD IS DELIBERATE. A real sky turns rigidly and every star
   shares one clock, and rendering it that way looked correct and felt dead. The
   spread reads as depth, and depth is more engaging than accuracy here. This is
   a sky with a dial at the centre of it, not an almanac. */
const LAYERS = [
    // Brightened from the original 0.08/0.30, 0.15/0.52, 0.28/0.75 -- alpha is
    // set once per star at creation, not recomputed per frame, so this is a
    // free change with no ongoing cost.
    { key:'bg',    n:560, ms:180000, depth:3, frames:['s','s','m'], minA:0.14, maxA:0.46 },
    { key:'drift', n:760, ms: 90000, depth:4, frames:['s','m','m'], minA:0.24, maxA:0.72 },
    { key:'fg',    n:180, ms: 60000, depth:5, frames:['m','l','l'], minA:0.40, maxA:0.95 },
];

// Trails: each star gets this many extra bobs lagging behind its head, alpha
// falling off geometrically per segment. 0 disables trails entirely.
const TRAIL_SEGMENTS = 0;
const TRAIL_GAP       = 0.05;   // radians between segments
const TRAIL_FALLOFF   = 0.55;   // each segment's alpha vs. the one before it

// Twinkle: how many stars (across all layers) get a fresh random alpha each
// call to twinkle(), and the range that new alpha is scaled into.
const TWINKLE_PER_FRAME = 20;
const TWINKLE_MIN       = 0.35;
const TWINKLE_MAX       = 1.0;

function ensureTexture(scene) {
    if (scene.textures.exists(TEX)) return;
    const g = scene.make.graphics({ add: false });
    g.fillStyle(NIGHT.starHex, 1);
    const c = (CELL - 1) / 2;
    // small: a 2px dot
    g.fillRect(c, c, 2, 2);
    // medium: a two-armed cross
    g.fillRect(CELL + c - 2, c, 5, 1);
    g.fillRect(CELL + c, c - 2, 1, 5);
    // large: a three-armed cross with a thicker core
    g.fillRect(CELL * 2 + c - 3, c, 7, 1);
    g.fillRect(CELL * 2 + c, c - 3, 1, 7);
    g.fillRect(CELL * 2 + c, c, 2, 2);
    g.generateTexture(TEX, CELL * 3, CELL);
    g.destroy();
    const t = scene.textures.get(TEX);
    t.add('s', 0, 0,        0, CELL, CELL);
    t.add('m', 0, CELL,     0, CELL, CELL);
    t.add('l', 0, CELL * 2, 0, CELL, CELL);
}

/* The wedge of sky the screen occupies as seen from the hub, padded. Returns
   null when the hub is inside the screen, meaning: use the whole circle. */
function wedgeFor(hx, hy, W, H) {
    // Strict: a hub sitting exactly ON an edge still only sees a half-plane,
    // and spreading stars over the full circle would waste half of them
    // off-screen. Only a hub genuinely inside the frame needs 2π.
    if (hx > 0 && hx < W && hy > 0 && hy < H) return null;
    const angs = [[0,0],[W,0],[0,H],[W,H]].map(([x,y]) => Math.atan2(y - hy, x - hx));
    let lo = Math.min(...angs), hi = Math.max(...angs);
    if (hi - lo > Math.PI) return null;          // hub straddles: play it safe
    const pad = 0.18;
    return { lo: lo - pad, hi: hi + pad };
}

function radiiFor(hx, hy, W, H) {
    const corners = [[0,0],[W,0],[0,H],[W,H]];
    const d = ([x,y]) => Math.hypot(x - hx, y - hy);
    const nx = Math.max(0, Math.min(W, hx)), ny = Math.max(0, Math.min(H, hy));
    return { min: Math.hypot(nx - hx, ny - hy), max: Math.max(...corners.map(d)) };
}

/**
 * @param {Phaser.Scene} scene
 * @param {object} [opts]
 * @param {number} [opts.hubX] fraction of width  (0.5 = centre)
 * @param {number} [opts.hubY] fraction of height (negative = above the screen)
 */
/* Diagnostics — see patch_star_probe.py. Inert unless the URL asks. */
const _sq = (typeof location !== 'undefined' && location.search) || '';
const STAR_SCALE = (() => {
    const m = /[?&]stars=([0-9.]+)/.exec(_sq);
    return m ? Math.max(0.02, parseFloat(m[1]) || 1) : 1;
})();
const NO_STAR_DRAW = /[?&]noStarDraw\b/.test(_sq);

export function createStarField(scene, opts = {}) {
    ensureTexture(scene);

    /* THE POLE SITS ON THE TOP EDGE OF THE SCREEN.
       So the sky turns about a point you can see, at the top of the frame, and
       every star sweeps a visible half-circle beneath it — the north-facing
       view, with the trails closing around the pole rather than drifting past.

       Earlier placements, for the record: on the dial's centre (0.50, 0.52) made
       the ogham wheel the axle of the sky, which is the strongest idea of the
       three and is worth returning to if this reads as too much of a pinwheel;
       above the top edge (-0.35) flattened the arcs to nearly straight; below
       the bottom edge (1.42) gave a southern rainbow that still drifted
       sideways. All four are one number apart. */
    const hubXf = opts.hubX !== undefined ? opts.hubX : 0.50;
    const hubYf = opts.hubY !== undefined ? opts.hubY : -0.12;

    /* One multiplier over every layer, so the sky can be sped up or slowed down
       by feel without disturbing the ratios between the three. Above 1 is
       faster. If you want to harmonise it with the ring's own idle turn, OMEGA
       in introOghamDial.js is the number to divide into. */
    const rate = opts.rateScale !== undefined ? opts.rateScale : 1;

    /* HOW STARS ARE SPREAD ALONG THE RADIUS, WHICH IS WHAT MAKES THE TOP LIVE.
       The first version placed them evenly per unit AREA — the mathematically
       natural choice, and the reason the sky was evenly sparse everywhere.
       Counted in fifths of the screen it came out 60/63/71/57/57: no gradient
       at all, because even density is precisely what "even density" means.

       Spreading them evenly per unit RADIUS instead makes areal density fall off
       as 1/r, so they crowd near the pole and thin toward the bottom of the
       frame: 152/98/60/63/29 over the same fifths. Raise this above 1 to push
       harder toward the pole (2 gives roughly 300/83/48/33/19), below 1 to go
       back toward flat. */
    const falloff = opts.falloff !== undefined ? opts.falloff : 1;

    /* Stars also DIM with radius, so the band along the top is brighter as well
       as denser and the bottom of the frame falls away into the land. Eased
       from 0.62 -- still a real gradient, just not as punishing overall. */
    const DIM = 0.35;

    let W = scene.scale.width, H = scene.scale.height;
    let hx = W * hubXf, hy = H * hubYf;
    let wedge = wedgeFor(hx, hy, W, H);
    let rad   = radiiFor(hx, hy, W, H);

    const rng = new Phaser.Math.RandomDataGenerator(['oíche2025']);

    const layers = LAYERS.map(L => {
        const blitter = scene.add.blitter(0, 0, TEX)
            .setScrollFactor(0).setDepth(L.depth)
            .setBlendMode(Phaser.BlendModes.ADD);
        // Built either way, so the only difference measured is the drawing.
        if (NO_STAR_DRAW) blitter.visible = false;

        const stars = [];
        const count = Math.max(1, Math.round(L.n * STAR_SCALE));
        for (let i = 0; i < count; i++) {
            const u = rng.frac();
            const r = rad.min + (rad.max - rad.min) * Math.pow(u, falloff);
            const t = (r - rad.min) / Math.max(1, rad.max - rad.min);
            const a = wedge ? rng.realInRange(wedge.lo, wedge.hi)
                            : rng.realInRange(-Math.PI, Math.PI);
            const frame = L.frames[rng.between(0, L.frames.length - 1)];
            const baseAlpha = rng.realInRange(L.minA, L.maxA) * (1 - DIM * t);
            // bobs[0] is the head; bobs[1..] are trail segments, each fainter
            // and, once positioned in render(), lagging further behind.
            const bobs = [];
            for (let seg = 0; seg <= TRAIL_SEGMENTS; seg++) {
                const bob = blitter.create(0, 0, frame);
                bob.alpha = baseAlpha * Math.pow(TRAIL_FALLOFF, seg);
                bobs.push(bob);
            }
            stars.push({ r, a, bobs, baseAlpha, twinkle: 1, frameKey: frame });
        }

        /* A handle that quacks like the RenderTexture it replaced: `.angle` in
           degrees, read and written by updateSpin() and panCameraTo() exactly as
           before. Keeping this shape meant those two did not have to change. */
        let deg = 0;
        const handle = {
            get angle() { return deg; },
            set angle(v) { deg = v; },
            _blitter: blitter,
            _stars: stars,
            _speed: SKY_SPIN * rate * 360 / L.ms,
            _lastDeg: null,          // render() skips a layer that has not turned
            _key: L.key,             // looked up by the flare-star picker below
        };
        return handle;
    });

    // Flattened once, not per twinkle() call -- twinkle() runs every frame
    // regardless of rotation state, so it should not rebuild this list each time.
    const allStars = [];
    for (const L of layers) for (const s of L._stars) allStars.push(s);

    function render() {
        // Hoisted: constant for the life of a layout, and it was being recomputed
        // once per star per frame.
        const span = wedge ? wedge.hi - wedge.lo : 0;
        for (const L of layers) {
            /* A still sky costs nothing. Once the wheels are paused — which is the
               whole constellation scene now that the harp stills them — every one
               of these writes would put a star back exactly where it already was. */
            if (L.angle === L._lastDeg) continue;
            L._lastDeg = L.angle;
            const off = L.angle * Math.PI / 180;
            // Trail segments lag BEHIND the direction of motion. Derived from
            // this layer's own rotation sign rather than assumed, so it's
            // correct regardless of which way a given layer turns.
            const trailSign = -Math.sign(L._speed) || 1;
            for (const s of L._stars) {
                for (let seg = 0; seg < s.bobs.length; seg++) {
                    let a = s.a + off + trailSign * seg * TRAIL_GAP;
                    if (wedge) {
                        // Leaving the wedge is leaving the screen, so re-entering at
                        // the far edge is invisible. Radius is untouched.
                        a = wedge.lo + (((a - wedge.lo) % span) + span) % span;
                    }
                    // -CELL/2 because a bob draws from its top-left corner.
                    const bob = s.bobs[seg];
                    bob.x = hx + Math.cos(a) * s.r - CELL / 2;
                    bob.y = hy + Math.sin(a) * s.r - CELL / 2;
                }
            }
        }
    }
    render();

    /* Twinkle: a small random subset of stars gets a fresh alpha each call,
       independent of whether the sky is turning. Cheap by construction --
       TWINKLE_PER_FRAME stars touched, not all of them -- but genuinely a
       separate always-running cost, unlike render() which can skip entirely
       while stilled. Whether to call this during a deliberately still moment
       (e.g. the harp performance) is the caller's decision. */
    function twinkle() {
        if (NO_STAR_DRAW || !allStars.length) return;
        for (let i = 0; i < TWINKLE_PER_FRAME; i++) {
            const s = allStars[(Math.random() * allStars.length) | 0];
            s.twinkle = TWINKLE_MIN + Math.random() * (TWINKLE_MAX - TWINKLE_MIN);
            for (let seg = 0; seg < s.bobs.length; seg++) {
                s.bobs[seg].alpha = s.baseAlpha * Math.pow(TRAIL_FALLOFF, seg) * s.twinkle;
            }
        }
    }

    /* ── Special events ──────────────────────────────────────────────────────
       Meteors, named flare stars, and glimmer clusters -- all rare and
       selective by design, so each reads as a deliberate moment rather than
       an ambient texture applied to everything (which is exactly what made
       the earlier uniform trails read as a glitch). All three self-schedule
       and clean up their pending timers in destroy(). */

    // 1. Meteors: a one-off Graphics streak, animated and destroyed, every
    // 9-22s. Occasional allocation like this is fine -- it's a single object
    // every several seconds, nothing like the per-frame cost the rest of this
    // file is built to avoid.
    const METEOR_MIN_DELAY = 9000, METEOR_MAX_DELAY = 22000;
    let _meteorTimer = null;

    function scheduleMeteor() {
        const delay = METEOR_MIN_DELAY + Math.random() * (METEOR_MAX_DELAY - METEOR_MIN_DELAY);
        _meteorTimer = scene.time.delayedCall(delay, spawnMeteor);
    }
    function spawnMeteor() {
        if (NO_STAR_DRAW) { scheduleMeteor(); return; }
        const a0 = wedge ? (wedge.lo + Math.random() * (wedge.hi - wedge.lo))
                         : (Math.random() * Math.PI * 2 - Math.PI);
        const r0 = rad.min + (rad.max - rad.min) * Math.random();
        const x0 = hx + Math.cos(a0) * r0, y0 = hy + Math.sin(a0) * r0;
        // Roughly tangential to the field's own rotation, with some spread, so
        // it reads as part of the same sky rather than an arbitrary streak.
        const travel = a0 + Math.PI / 2 + (Math.random() - 0.5) * 0.7;
        const dist = 140 + Math.random() * 170;
        const len  = 46 + Math.random() * 30;

        const g = scene.add.graphics().setDepth(6).setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);
        g.lineStyle(2, NIGHT.starHex, 0.85);
        g.lineBetween(0, 0, -Math.cos(travel) * len, -Math.sin(travel) * len);
        g.fillStyle(NIGHT.starHex, 1);
        g.fillCircle(0, 0, 2.4);
        g.setPosition(x0, y0);

        scene.tweens.add({
            targets: g,
            x: x0 + Math.cos(travel) * dist,
            y: y0 + Math.sin(travel) * dist,
            alpha: { from: 1, to: 0 },
            duration: 650 + Math.random() * 250,
            ease: 'Cubic.easeOut',
            onComplete: () => { g.destroy(); },
        });

        scheduleMeteor();
    }
    scheduleMeteor();

    // 2. Named flare stars: a handful of specific stars from the brightest
    // ('fg') layer, occasionally flaring distinctly. Bobs can't be scaled
    // (Phaser's Bob is position/alpha/tint/frame only), so a flare is a
    // frame-swap to the largest glyph plus an alpha boost, not a scale-up.
    const FLARE_COUNT      = 4;
    const FLARE_MIN_DELAY  = 6000, FLARE_MAX_DELAY = 14000;
    const FLARE_HALF_MS    = 320;
    let _flareTimer = null;

    const fgLayer    = layers.find(l => l._key === 'fg');
    const flareStars = fgLayer
        ? Phaser.Utils.Array.Shuffle(fgLayer._stars.slice()).slice(0, FLARE_COUNT)
        : [];

    function scheduleFlare() {
        if (!flareStars.length) return;
        const delay = FLARE_MIN_DELAY + Math.random() * (FLARE_MAX_DELAY - FLARE_MIN_DELAY);
        _flareTimer = scene.time.delayedCall(delay, doFlare);
    }
    function doFlare() {
        const s   = flareStars[(Math.random() * flareStars.length) | 0];
        const bob = s.bobs[0];
        bob.setFrame('l');
        scene.tweens.add({
            targets: bob,
            alpha: 1,
            duration: FLARE_HALF_MS,
            yoyo: true,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                bob.setFrame(s.frameKey);
                bob.alpha = s.baseAlpha * s.twinkle;
            },
        });
        scheduleFlare();
    }
    scheduleFlare();

    // 3. Glimmer clusters -- SIMPLIFIED stand-in for "foreshadow the first
    // constellation". The real constellation stars don't exist as objects at
    // this point (only created later, in ConstellationScene's _build()), so
    // this does NOT preview the actual upcoming shape -- a random anchor
    // star's nearest neighbours (by current screen position) are grouped and
    // flicker together in sync. Same charming spirit, not a literal preview.
    const GLIMMER_MIN_DELAY   = 14000, GLIMMER_MAX_DELAY = 30000;
    const GLIMMER_CLUSTER_SIZE = 4;
    let _glimmerTimer = null;

    function scheduleGlimmer() {
        const delay = GLIMMER_MIN_DELAY + Math.random() * (GLIMMER_MAX_DELAY - GLIMMER_MIN_DELAY);
        _glimmerTimer = scene.time.delayedCall(delay, doGlimmer);
    }
    function doGlimmer() {
        if (!allStars.length) { scheduleGlimmer(); return; }
        const anchor = allStars[(Math.random() * allStars.length) | 0];
        const ax = hx + Math.cos(anchor.a) * anchor.r, ay = hy + Math.sin(anchor.a) * anchor.r;
        const cluster = allStars
            .map(s => ({ s, d: Math.hypot(hx + Math.cos(s.a) * s.r - ax, hy + Math.sin(s.a) * s.r - ay) }))
            .sort((p, q) => p.d - q.d)
            .slice(0, GLIMMER_CLUSTER_SIZE)
            .map(p => p.s);

        for (const s of cluster) {
            const bob = s.bobs[0];
            scene.tweens.add({
                targets: bob,
                alpha: Math.min(1, s.baseAlpha * 1.8),
                duration: 500,
                yoyo: true,
                ease: 'Sine.easeInOut',
                onComplete: () => { bob.alpha = s.baseAlpha * s.twinkle; },
            });
        }
        scheduleGlimmer();
    }
    scheduleGlimmer();

    return {
        layers,
        speeds: layers.map(l => l._speed),
        render,
        twinkle,

        /* Re-seat the hub after a resize, or to move the pole at runtime. Radii
           and the wedge are screen-relative, so both are recomputed; the stars
           keep their angles, so the sky does not reshuffle. */
        relayout(nextHubX, nextHubY) {
            W = scene.scale.width; H = scene.scale.height;
            hx = W * (nextHubX !== undefined ? nextHubX : hubXf);
            hy = H * (nextHubY !== undefined ? nextHubY : hubYf);
            wedge = wedgeFor(hx, hy, W, H);
            rad   = radiiFor(hx, hy, W, H);
            render();
        },

        destroy() {
            layers.forEach(l => l._blitter.destroy());
            allStars.length = 0;
            if (_meteorTimer)  _meteorTimer.remove();
            if (_flareTimer)   _flareTimer.remove();
            if (_glimmerTimer) _glimmerTimer.remove();
        },
    };
}

