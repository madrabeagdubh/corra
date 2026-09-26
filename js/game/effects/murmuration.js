/**
 * murmuration.js
 *
 * Wild geese rising — inverted V formations, all birds visible on screen,
 * pure honking and wingbeat audio that fades as the flock thins.
 *
 * Usage:
 *   import { triggerMurmuration } from './murmuration.js';
 *   triggerMurmuration(audioContext);
 */

// [geese] The sprites live in public/assets/, not assets/vfx/ -- the old paths never loaded,
// so every goose was the procedural stroke fallback. They are black, nose-up silhouettes with
// four wingbeat frames. USE_SPRITES = false brings back the simple strokes.
const SPRITE_PATHS = [
    'assets/gooseFrame1.png',
    'assets/gooseFrame2.png',
    'assets/gooseFrame3.png',
    'assets/gooseFrame4.png',
];
const USE_SPRITES = true;

const TOTAL_MS        = 18000;   // the sound's length (the flight ends when the last bird is gone)
const FRAME_MS        = 100;

// [geese] A few skeins, rising out of the valley through the middle of the view.
const FORMATIONS      = 4;       // skeins (was 14)
const BIRDS_MIN       = 7;       // birds per skein (was 62, which stretched each skein ~1000 px)
const BIRDS_MAX       = 13;
const SPAWN_GAP_MS    = 2600;    // between skeins
const CENTRE_SPREAD   = 0.10;    // where they cross mid-screen: centre +/- this share of width
const LEAN            = 0.22;    // max heading lean from straight up, radians
const V_HALF_ANGLE    = 0.62;    // half the V's opening (~35 deg): arms trail behind the leader
const SPEED_MIN       = 0.11;    // px per ms (was ~0.28-0.63: they crossed in 1.5-3 s)
const SPEED_MAX       = 0.16;
const SIZE_MIN        = 14;      // bird size before depth (sprite width is 2.8x this) (was 9)
const SIZE_MAX        = 24;      // (was 15)
// [geeseLayer] Where the geese fly in the page's stacking order: above the stars and the
// constellations (the Phaser canvas, z 10) and the moon's glow (z 17, made earlier, so this
// draws over it), below the land (pgr-* layers, z 18+) and the figures (z 30+). They rise from
// behind the hills and fly through the sky rather than across the front of the screen.
const GEESE_Z         = 17;
// [geeseInside] ...inside #gameContainer: it is position:fixed, so it is its own stacking
// context, and only from inside it can the geese go between the stars and the land. A z-index
// on <body> is compared with the whole container at once (above the land AND the stars).
// Without the container, the old place: <body>, over everything.
const GEESE_Z_BODY    = 88888;
const FADE_BAND       = 0.12;    // share of screen height to fade in over (bottom) and out (top)

const _sprites      = [];
let   _spritesReady = false;

(function _preload() {
    let loaded = 0;
    for (const path of SPRITE_PATHS) {
        const img   = new Image();
        img.onload  = () => { if (++loaded === SPRITE_PATHS.length) _spritesReady = true; };
        img.onerror = () => { if (++loaded === SPRITE_PATHS.length) _spritesReady = true; };
        img.src     = path;
        _sprites.push(img);
    }
})();


// ── Public ────────────────────────────────────────────────────────────────────

export function triggerMurmuration(audioContext) {
    const trigger = () => _playMurmuringSound(audioContext);
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(trigger);
    } else {
        trigger();
    }
    _playMurmuringVisual();
}


// ── Audio — honks and wingbeats only, fading with the flock ──────────────────

function _playMurmuringSound(ac) {
    if (!ac) return;

    // Small lookahead to avoid scheduling in the past
    const now     = ac.currentTime + 0.02;
    const TOTAL_S = TOTAL_MS / 1000;

    // No compressor/limiter — just a clean master gain
    const master = ac.createGain();
    master.connect(ac.destination);

    // Master envelope — full immediately, slow fade as flock thins
    master.gain.setValueAtTime(2.2,  now);
    master.gain.setValueAtTime(2.2,  now + TOTAL_S * 0.35);
    master.gain.linearRampToValueAtTime(0, now + TOTAL_S);

    // Wingbeat layer — rhythmic filtered noise bursts, like actual wing strokes
    _wingbeatsLayer(ac, master, now, TOTAL_S);

    // Honk layer — goose calls, dense at start, sparse and distinct at end
    _honksLayer(ac, master, now, TOTAL_S);
}

function _wingbeatsLayer(ac, dest, now, totalS) {
    // Short percussive noise bursts at wingbeat tempo — ~2.5 strokes/sec per bird
    // Layered irregular timing gives the impression of many birds
    const BEAT_INTERVAL = 0.18;   // seconds between beats (rough)
    const BEAT_DUR      = 0.11;   // each beat duration

    // Schedule wingbeat bursts across the full duration
    for (let t = 0; t < totalS; t += BEAT_INTERVAL * (0.7 + Math.random() * 0.6)) {
        const fadeFraction = t / totalS;
        const gainVal      = (1.0 - fadeFraction * 0.85) * 1.1;
        if (gainVal < 0.05) continue;

        // Slight random offset so beats don't all align
        const beatTime = now + t + (Math.random() - 0.5) * 0.08;

        // Small noise buffer per beat
        const bufLen = Math.floor(ac.sampleRate * (BEAT_DUR + 0.05));
        const buf    = ac.createBuffer(1, bufLen, ac.sampleRate);
        const d      = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;

        const src = ac.createBufferSource();
        src.buffer = buf;

        // Shape into the whoosh of a wing stroke — lowish freq, short
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 320 + Math.random() * 200; bp.Q.value = 1.2;

        const g = ac.createGain();
        g.gain.setValueAtTime(0,        beatTime);
        g.gain.linearRampToValueAtTime(gainVal, beatTime + BEAT_DUR * 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, beatTime + BEAT_DUR);

        src.connect(bp); bp.connect(g); g.connect(dest);
        try { src.start(beatTime); src.stop(beatTime + BEAT_DUR + 0.02); } catch(e) {}
    }
}

function _honksLayer(ac, dest, now, totalS) {
    const calls = _generateCalls(totalS);
    for (const c of calls) {
        _scheduleHonk(ac, dest, now + c.time, c.freq, c.gain, c.dur, c.detune);
    }
}

function _generateCalls(totalS) {
    const calls = [];
    let t = 0.0;

    while (t < totalS * 0.95) {
        const fade = t / totalS;

        // Calls start dense and frequent, thin out as flock passes
        const gap = 0.06 + fade * 0.35;

        // Gain fades with the flock
        const gainVal = (1.0 - fade * 0.8) * 1.8;
        if (gainVal < 0.08) break;

        calls.push({
            time:   t,
            freq:   330 + Math.random() * 160,
            gain:   gainVal * (0.6 + Math.random() * 0.4),
            dur:    0.08 + Math.random() * 0.12,
            detune: (Math.random() - 0.5) * 180,
        });

        t += gap * (0.6 + Math.random() * 0.8);
    }

    // Final sparse distant calls — very recognisably avian
    for (let i = 0; i < 8; i++) {
        const t2 = totalS * 0.7 + i * (0.5 + Math.random() * 0.7);
        if (t2 < totalS * 0.98) calls.push({
            time:   t2,
            freq:   350 + Math.random() * 80,
            gain:   0.15 + Math.random() * 0.12,
            dur:    0.12 + Math.random() * 0.1,
            detune: (Math.random() - 0.5) * 40,
        });
    }

    return calls.sort((a, b) => a.time - b.time);
}

function _scheduleHonk(ac, dest, t, freq, gainVal, dur, detune) {
    try {
        // Two detuned sawtooth oscillators through a formant filter
        const o1 = ac.createOscillator();
        o1.type = 'sawtooth'; o1.frequency.value = freq; o1.detune.value = detune;
        const o2 = ac.createOscillator();
        o2.type = 'sawtooth'; o2.frequency.value = freq * 1.008; o2.detune.value = detune * 0.6;

        // Nasal formant
        const f1 = ac.createBiquadFilter();
        f1.type = 'bandpass'; f1.frequency.value = freq * 2.1; f1.Q.value = 4.0;
        // Body formant
        const f2 = ac.createBiquadFilter();
        f2.type = 'bandpass'; f2.frequency.value = freq * 0.9; f2.Q.value = 1.8;

        const g = ac.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gainVal, t + dur * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);

        o1.connect(f1); f1.connect(g);
        o2.connect(f2); f2.connect(g);
        g.connect(dest);

        o1.start(t); o1.stop(t + dur + 0.02);
        o2.start(t); o2.stop(t + dur + 0.02);
    } catch(e) {}
}


// ── Visual ────────────────────────────────────────────────────────────────────
//
// All birds spawn WITHIN the visible screen and fly upward.
// Inverted V formation — leader at bottom-centre of the V,
// wings spreading upward and outward asymmetrically.
// Canvas is position:fixed — completely independent of Phaser camera.

function _playMurmuringVisual() {
    const W = window.innerWidth;
    const H = window.innerHeight;

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    canvas.style.cssText = [
        'position:fixed',
        'top:0',
        'left:0',
        'width:100%',
        'height:100%',
        `z-index:${_geeseParent() === document.body ? GEESE_Z_BODY : GEESE_Z}`,
        'pointer-events:none',
    ].join(';');
    _geeseParent().appendChild(canvas);   // [geeseInside]

    const ctx       = canvas.getContext('2d');
    const startTime = performance.now();
    let   last      = startTime;

    const formations = [];
    for (let i = 0; i < FORMATIONS; i++) {
        formations.push(_createFormation(W, H, i * SPAWN_GAP_MS + Math.random() * 600));
    }

    const frame = (now) => {
        const elapsed = now - startTime;
        const dt      = Math.min(64, now - last);
        last = now;

        ctx.clearRect(0, 0, W, H);

        const useSprites = USE_SPRITES && _spritesReady &&
                           _sprites.every(im => im.complete && im.naturalWidth > 0);

        let alive = false;
        for (const f of formations) {
            if (elapsed < f.spawnAt) { alive = true; continue; }
            _updateFormation(f, elapsed - f.spawnAt, dt);
            if (_drawFormation(ctx, f, H, useSprites)) alive = true;
        }

        // Done when every skein has flown off the top (or after a generous cap).
        if (alive && elapsed < 45000) {
            requestAnimationFrame(frame);
        } else {
            canvas.remove();
        }
    };

    requestAnimationFrame(frame);
}

// [geese] One skein: a proper V, the leader at the point and both arms trailing BEHIND it
// (the old arms both ran off to one side, which is what carried the flocks off to the left).
// Its path is chosen so it crosses the middle of the screen near the centre line, entering
// from below the land and leaving off the top.
function _geeseParent() {
    return document.getElementById('gameContainer') || document.body;
}

function _createFormation(W, H, spawnAt) {
    const depth    = 0.6 + Math.random() * 0.4;            // nearer skeins: bigger, faster, darker
    const birdSize = (SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN)) * depth;
    const speed    = (SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN)) * (0.75 + 0.25 * depth);
    const angle    = -Math.PI / 2 + (Math.random() - 0.5) * 2 * LEAN;   // heading; -PI/2 = up
    const fx = Math.cos(angle), fy = Math.sin(angle);                   // forward
    const rx = -fy, ry = fx;                                            // to its right

    const count   = BIRDS_MIN + Math.floor(Math.random() * (BIRDS_MAX - BIRDS_MIN + 1));
    const spacing = birdSize * (1.6 + Math.random() * 0.3);
    const birds   = [];
    // One arm a bird or two longer than the other, as real skeins usually are.
    const extra = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < count; i++) {
        let back = 0, side = 0;
        if (i > 0) {
            const s    = (i % 2 === 1) ? extra : -extra;
            const rank = Math.ceil(i / 2);
            const open = V_HALF_ANGLE + (Math.random() - 0.5) * 0.08;
            back = Math.cos(open) * spacing * rank + (Math.random() - 0.5) * spacing * 0.25;
            side = s * Math.sin(open) * spacing * rank;
        }
        birds.push({
            // offset from the leader, in screen px
            ox: -fx * back + rx * side,
            oy: -fy * back + ry * side,
            x: 0, y: 0,
            frameIndex:    Math.floor(Math.random() * 4),
            frameTimer:    Math.random() * FRAME_MS,
            frameDuration: FRAME_MS * (1.1 + Math.random() * 0.5),
            wobblePhase:   Math.random() * Math.PI * 2,
            wobbleAmp:     (Math.random() - 0.5) * 2.5,
            size:          birdSize * (i === 0 ? 1.08 : 0.9 + Math.random() * 0.2),
            maxAlpha:      (0.7 + 0.3 * depth) * (i === 0 ? 1.0 : 0.85 + Math.random() * 0.15),
        });
    }

    // Start just below the screen with the whole V hidden, on a line that crosses the middle
    // height at xMid.
    const tail   = spacing * Math.ceil((count - 1) / 2) * Math.cos(V_HALF_ANGLE);
    const startY = H + tail + birdSize * 2;
    const xMid   = W * (0.5 + (Math.random() - 0.5) * 2 * CENTRE_SPREAD);
    const toMid  = (H / 2 - startY) / fy;                                // distance to mid-height
    const startX = xMid - fx * toMid;

    return { spawnAt, angle, fx, fy, speed, birds,
             leaderStartX: startX, leaderStartY: startY, leaderX: startX, leaderY: startY };
}

function _updateFormation(f, age, dt) {
    f.leaderX = f.leaderStartX + f.fx * f.speed * age;
    f.leaderY = f.leaderStartY + f.fy * f.speed * age;
    for (const bird of f.birds) {
        const wob = bird.wobbleAmp * Math.sin(age * 0.0022 + bird.wobblePhase);
        bird.x = f.leaderX + bird.ox + f.fy * -wob;     // wobble sideways to the heading
        bird.y = f.leaderY + bird.oy + f.fx * wob;
        bird.frameTimer += dt;
        if (bird.frameTimer >= bird.frameDuration) {
            bird.frameTimer = 0;
            bird.frameIndex = (bird.frameIndex + 1) % Math.max(1, _sprites.length);
        }
    }
}

// Draws the skein; returns true while any of it is still on its way (below the top edge).
function _drawFormation(ctx, f, H, useSprites) {
    let alive = false;
    const band = H * FADE_BAND;
    // Both the sprites and the procedural bird are drawn nose-up at rotation 0.
    const facing = f.angle + Math.PI / 2;
    for (const bird of f.birds) {
        if (bird.y > -bird.size * 3) alive = true;
        const fadeIn  = Math.max(0, Math.min((H - bird.y) / band, 1));   // rising out of the valley
        const fadeOut = Math.max(0, Math.min(bird.y / band, 1));         // leaving off the top
        const alpha   = fadeIn * fadeOut * bird.maxAlpha;
        if (alpha < 0.02) continue;
        if (useSprites) _drawSprite(ctx, bird, facing, alpha);
        else _drawProcedural(ctx, bird.x, bird.y, bird.size, facing, alpha);
    }
    return alive;
}

// The sprites are already black silhouettes: drawn as they are, at the bird's alpha. (The old
// version multiplied a dark rectangle over each one, which on a transparent canvas paints the
// rectangle itself -- never seen only because the sprites never loaded.)
function _drawSprite(ctx, bird, angle, alpha) {
    const sprite = _sprites[bird.frameIndex];
    const w = bird.size * 2.8;
    const h = w * (sprite.naturalHeight / sprite.naturalWidth);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(bird.x, bird.y);
    ctx.rotate(angle);
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    ctx.restore();
}

function _drawProcedural(ctx, x, y, size, angle, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const spread = size * 1.15;
    const dip    = size * 0.42;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-spread * 0.55, dip, -spread, -size * 0.1);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo( spread * 0.55, dip,  spread, -size * 0.1);

    ctx.strokeStyle = `rgba(5, 7, 18, ${alpha})`;
    ctx.lineWidth   = Math.max(0.8, size * 0.22);
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();
}

