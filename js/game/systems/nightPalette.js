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
    baseCss : '#070b0a',

    // Stars: a bone-green white rather than pure white, so they sit in the same
    // air as the ogham strokes (#8fb3a2) instead of on top of them.
    starHex : 0xdfe9df,
    starCss : '223, 233, 223',

    /* n1-top@3x.png is strongly blue-dominant — sampled around R5 G20 B40 — and
       ADD blending makes that the purple the whole scene was swimming in. A
       Phaser tint only multiplies, so it can darken the blue but can never put
       green where the art has none. Instead the image is redrawn once through a
       Canvas2D filter, which CAN rotate the hue, and the loader in index.html
       uses the identical filter so both nebulae are the same colour. */
    nebulaFilter : 'hue-rotate(-95deg) saturate(0.35) brightness(1.0)',
    nebulaAlpha  : 0.5,

    /* Procedural fallback, used when the nebula image is missing. Same greens,
       reached directly rather than by filter. */
    nebulaBlobs : [
        { x:0.35, y:0.38, r:0.38, c1:0x3e7a5c, c2:0x123024 },
        { x:0.65, y:0.28, r:0.32, c1:0x2f6b52, c2:0x0e2a20 },
        { x:0.50, y:0.65, r:0.40, c1:0x2a6e58, c2:0x0a2a22 },
        { x:0.22, y:0.68, r:0.30, c1:0x1f5a48, c2:0x0a2018 },
        { x:0.78, y:0.58, r:0.34, c1:0x356b4e, c2:0x102a1e },
    ],
};

/* The sky turns counter-clockwise, the way a northern sky turns about Polaris —
   and, more to the point, the way the ogham ring turns. They were opposed, and
   at the handoff you watched the whole sky reverse. Multiply any clockwise rate
   by this rather than hand-flipping signs, so there is one place to change if
   the dial ever turns the other way. */
export const SKY_SPIN = -1;

