/**
 * nightPalette.js
 *
 * One source of truth for the night sky's colour and its direction of turn.
 *
 * These values used to be scattered: '#00060f' twice in introModal.js, '#02040a'
 * three times in index.html, white stars in two places, and three wheel speeds
 * whose sign disagreed with the ogham dial's. The intro and the constellation
 * scene are meant to read as one continuous night, so they cannot be tuned
 * apart from each other.
 *
 * The base colour is the dial's own root background, so the pull-back hands off
 * onto the same darkness it started in.
 *
 * NOTE: index.html's <style> block cannot import this, so the three CSS/canvas
 * colours there are literals carrying a comment pointing back here. If you
 * change `base`, change them too.
 */

export const NIGHT = {
    // Deepest background. Matches #ogd-root in introOghamDial.js.
    baseCss : '#040409',

    // Stars: a bone-green white rather than pure white, so they sit in the same
    // air as the ogham strokes (#8fb3a2) instead of on top of them.
    starHex : 0xe1e4f2,
    starCss : '225, 228, 242',

    /* n1-top@3x.png is strongly blue-dominant — sampled around R5 G20 B40 — and
       ADD blending makes that the purple the whole scene was swimming in. A
       Phaser tint only multiplies, so it can darken the blue but can never put
       green where the art has none. Instead the image is redrawn once through a
       Canvas2D filter, which CAN rotate the hue, and the loader in index.html
       uses the identical filter so both nebulae are the same colour. */
    /* saturate was 0.35, which left the green it had just rotated into as a flat
       grey-green wash -- the sky's share of the scene's murk. At 0.62 the nebula
       has colour to be mystical with, and the small brightness lift keeps its
       bright cores glowing rather than sitting flush against the base. If this
       changes, change index.html's copy of the same string too. */
    /* The nebula is natively a deep blue (hue ~222, with crimson wisps); -95deg had turned it
       green. +20deg carries it on to indigo-violet and keeps the crimson in the deep clouds:
       richer and stranger than the green was. */
    nebulaFilter : 'hue-rotate(20deg) saturate(0.85) brightness(0.95)',
    nebulaAlpha  : 0.55,   // 0.5 -> 0.68 for a richer backdrop, then 0.74 with the above

    /* Procedural fallback, used when the nebula image is missing. Same greens,
       reached directly rather than by filter. */
    nebulaBlobs : [
        { x:0.35, y:0.38, r:0.38, c1:0x4a4a9a, c2:0x14123a },
        { x:0.65, y:0.28, r:0.32, c1:0x3c3c86, c2:0x100e30 },
        { x:0.50, y:0.65, r:0.40, c1:0x5a3470, c2:0x160c28 },
        { x:0.22, y:0.68, r:0.30, c1:0x2e3474, c2:0x0c0e26 },
        { x:0.78, y:0.58, r:0.34, c1:0x44388a, c2:0x120e30 },
    ],
};

/* The sky turns counter-clockwise, the way a northern sky turns about Polaris —
   and, more to the point, the way the ogham ring turns. They were opposed, and
   at the handoff you watched the whole sky reverse. Multiply any clockwise rate
   by this rather than hand-flipping signs, so there is one place to change if
   the dial ever turns the other way. */
export const SKY_SPIN = -1;

/* [nocturne] THE INTRO VALLEY'S LIGHT -- one warm moonlight, after Atkinson Grimshaw: deep
   blue-green shadow, olive mid-tones, lit surfaces and air turning gold. Every element of the
   valley takes its colour from here (introLevel's land, flowers, mist and horizon glow;
   nightScape's figures; riverLayer's water and moon road), so they are tuned together.

   Tone curves are 6-point tables over 0..1 (feFuncX type="table"), applied after a desaturate.
   Values meant to survive a grade are chosen for what they become AFTER it.

   ?nocturne=0 switches all of it off, back to each module's own previous values. */
const NOCTURNE_ON = typeof location === 'undefined' ||
    new URLSearchParams(location.search).get('nocturne') !== '0';

export const NOCTURNE = {
    on: NOCTURNE_ON,

    // The land. Shadows sit blue-green, mid-tones olive, and only faces the moon lights turn
    // ochre-gold -- red rises fastest at the top, blue is held low there.
    groundSat : 0.5,
    groundTone: {
        r: [0.03, 0.08, 0.22, 0.46, 0.72, 0.95],
        g: [0.05, 0.12, 0.27, 0.45, 0.62, 0.80],
        b: [0.10, 0.18, 0.26, 0.31, 0.36, 0.44],
    },

    // The flowers (pgr-objects, also the moon road). Warmer and quieter than before: blue
    // pulled down, colour kept but not shouting.
    flora: { sat: 0.62, slope: [0.86, 0.74, 0.54], lift: [0.030, 0.034, 0.048] },

    // The figures, into the same light: desaturated, then the same shape of curve as the land
    // but lighter, so they still read as people and keep their colours' identity.
    figureSat : 0.55,
    figureTone: {
        r: [0.04, 0.14, 0.32, 0.52, 0.70, 0.86],
        g: [0.05, 0.13, 0.28, 0.44, 0.58, 0.70],
        b: [0.08, 0.14, 0.22, 0.30, 0.38, 0.46],
    },

    // The mist along the far ridges: warm grey-olive, so distance dissolves into the glow.
    haze: '112,106,84',

    // [moonGlow] The moon's own colour: the ogham dial paints its moon with these three stops
    // (centre, 70%, limb), and the glow around it is `light`, the same cream-gold.
    moon: { stops: ['#fbf3dc', '#efe3c4', '#d6c69e'], light: '242,228,192' },

    // The moon's glow: centred on the moon and following it, behind the land and above the
    // stars. radiusMoons is how far out it reaches, in moon radii; its fall-off is long and
    // eased (see introLevel _addGlow). Strength follows the moon: minAlpha at new moon, alpha
    // at the land's fullest.
    glow: { radiusMoons: 9, alpha: 0.42, minAlpha: 0.14 },

    // The river (drawn into pgr-ground, so these are PRE-grade, chosen for their result):
    // near, the dark overhead sky -> deep teal; far, the glow -> warm and pale.
    waterNear: [80, 100, 230],
    waterFar : [170, 165, 235],
    // The moon road (on pgr-objects, under the flora grade): gold.
    glint    : [255, 224, 160],
};

/* [wash] A MUTED, WASHED-OUT LOOK, laid over everything above. wash 0 = the palette exactly as
   written; 1 = fully washed. Blacks lift and whites come in (less contrast), saturation drops on
   the land, flowers and figures, the moon road pales toward a warm grey, and the glow fades a
   little. Because the river's water is graded by the land's own curve, it washes with it.
   Live override: ?wash=0..1. */
{
    const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('wash');
    const W = Math.max(0, Math.min(1, q != null && q !== '' && isFinite(+q) ? +q : 0.6));
    const N = NOCTURNE;
    N.wash = W;
    const lo = 0.07 * W, hi = 1 - 0.10 * W;                   // where 0 and 1 now land
    const flatten = (tab) => tab.map(v => +(lo + v * (hi - lo)).toFixed(4));
    for (const ch of ['r', 'g', 'b']) {
        N.groundTone[ch] = flatten(N.groundTone[ch]);
        N.figureTone[ch] = flatten(N.figureTone[ch]);
    }
    N.groundSat *= 1 - 0.40 * W;
    N.figureSat *= 1 - 0.40 * W;
    N.flora = {
        sat:   N.flora.sat * (1 - 0.45 * W),
        slope: N.flora.slope.map(v => +(v * (1 - 0.12 * W)).toFixed(4)),
        lift:  N.flora.lift.map(v => +(v + 0.06 * W).toFixed(4)),
    };
    const grey = [228, 222, 204];
    N.glint = N.glint.map((v, i) => Math.round(v + (grey[i] - v) * 0.6 * W));
    N.glow = { ...N.glow, alpha: N.glow.alpha * (1 - 0.25 * W), minAlpha: N.glow.minAlpha * (1 - 0.25 * W) };
}

/* The figures' filter lives in the document once, for nightScape to point at. */
export function ensureNocturneFilters() {
    if (!NOCTURNE.on || typeof document === 'undefined') return;
    if (document.getElementById('nocturne-figure')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;';
    const t = NOCTURNE.figureTone;
    svg.innerHTML =
        '<filter id="nocturne-figure" color-interpolation-filters="sRGB">' +
        `<feColorMatrix type="saturate" values="${NOCTURNE.figureSat}"/>` +
        '<feComponentTransfer>' +
        ['r', 'g', 'b'].map(ch =>
            `<feFunc${ch.toUpperCase()} type="table" tableValues="${t[ch].join(' ')}"/>`).join('') +
        '</feComponentTransfer></filter>';
    document.body.appendChild(svg);
}

