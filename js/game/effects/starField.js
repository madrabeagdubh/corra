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
    { key:'bg',    n:560, ms:180000, depth:3, frames:['s','s','m'], minA:0.08, maxA:0.30 },
    { key:'drift', n:760, ms: 90000, depth:4, frames:['s','m','m'], minA:0.15, maxA:0.52 },
    { key:'fg',    n:180, ms: 60000, depth:5, frames:['m','l','l'], minA:0.28, maxA:0.75 },
];

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
       as denser and the bottom of the frame falls away into the land. */
    const DIM = 0.62;

    let W = scene.scale.width, H = scene.scale.height;
    let hx = W * hubXf, hy = H * hubYf;
    let wedge = wedgeFor(hx, hy, W, H);
    let rad   = radiiFor(hx, hy, W, H);

    const rng = new Phaser.Math.RandomDataGenerator(['oíche2025']);

    const layers = LAYERS.map(L => {
        const blitter = scene.add.blitter(0, 0, TEX)
            .setScrollFactor(0).setDepth(L.depth)
            .setBlendMode(Phaser.BlendModes.ADD);

        const stars = [];
        for (let i = 0; i < L.n; i++) {
            const u = rng.frac();
            const r = rad.min + (rad.max - rad.min) * Math.pow(u, falloff);
            const t = (r - rad.min) / Math.max(1, rad.max - rad.min);
            const a = wedge ? rng.realInRange(wedge.lo, wedge.hi)
                            : rng.realInRange(-Math.PI, Math.PI);
            const frame = L.frames[rng.between(0, L.frames.length - 1)];
            const bob = blitter.create(0, 0, frame);
            bob.alpha = rng.realInRange(L.minA, L.maxA) * (1 - DIM * t);
            stars.push({ r, a, bob });
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
        };
        return handle;
    });

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
            for (const s of L._stars) {
                let a = s.a + off;
                if (wedge) {
                    // Leaving the wedge is leaving the screen, so re-entering at
                    // the far edge is invisible. Radius is untouched.
                    a = wedge.lo + (((a - wedge.lo) % span) + span) % span;
                }
                // -CELL/2 because a bob draws from its top-left corner.
                s.bob.x = hx + Math.cos(a) * s.r - CELL / 2;
                s.bob.y = hy + Math.sin(a) * s.r - CELL / 2;
            }
        }
    }
    render();

    return {
        layers,
        speeds: layers.map(l => l._speed),
        render,

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
        },
    };
}

