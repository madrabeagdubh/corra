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

