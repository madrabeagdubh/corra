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

const SPRITE_PATHS = [
    'assets/vfx/gooseFrame1.png',
    'assets/vfx/gooseFrame2.png',
    'assets/vfx/gooseFrame3.png',
    'assets/vfx/gooseFrame4.png',
];

const TOTAL_MS        = 18000;
const FORMATIONS      = 14;
const BIRDS_PER_FLOCK = 62;
const FRAME_MS        = 100;

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
        'z-index:88888',
        'pointer-events:none',
    ].join(';');
    document.body.appendChild(canvas);

    const ctx       = canvas.getContext('2d');
    const startTime = performance.now();

    // Build formations — each starts fully on screen
    const formations = [];
    for (let i = 0; i < FORMATIONS; i++) {
        const spawnAt = i * (TOTAL_MS * 0.10) + Math.random() * 200;
        formations.push(_createFormation(W, H, spawnAt));
    }

    const frame = (now) => {
        const elapsed  = now - startTime;
        const progress = Math.min(elapsed / TOTAL_MS, 1);

        ctx.clearRect(0, 0, W, H);

        const useSprites = _spritesReady &&
                           _sprites[0]?.complete &&
                           _sprites[0]?.naturalWidth > 0;

        for (const f of formations) {
            if (elapsed < f.spawnAt) continue;
            _updateFormation(f, elapsed - f.spawnAt);
            _drawFormation(ctx, f, H, useSprites);
        }

        if (progress < 1) {
            requestAnimationFrame(frame);
        } else {
            const fadeStart = performance.now();
            const fadeOut   = (t2) => {
                canvas.style.opacity = String(1 - Math.min((t2 - fadeStart) / 1000, 1));
                if (t2 - fadeStart < 1000) requestAnimationFrame(fadeOut);
                else canvas.remove();
            };
            requestAnimationFrame(fadeOut);
        }
    };

    requestAnimationFrame(frame);
}

function _createFormation(W, H, spawnAt) {
    const birdSize = 12 + Math.random() * 14;
    const speed    = 2.8 + Math.random() * 3.5;

    // Flight direction — mostly upward, slight lean
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;

    // Leader spawns in lower two-thirds of screen, away from edges
    const leaderStartX = W * 0.15 + Math.random() * W * 0.70;
    const leaderStartY = H * 0.55 + Math.random() * H * 0.30;

    const birds = [];

    for (let i = 0; i < BIRDS_PER_FLOCK; i++) {
        // Inverted V: leader is at the bottom point.
        // Birds spread upward-left and upward-right from the leader.
        // Asymmetrical — left arm slightly longer or different angle than right.
        let localX, localY;

        if (i === 0) {
            localX = 0; localY = 0;  // leader — bottom of the V
        } else {
            // Alternate left and right arms, but with slight asymmetry
            const isLeft  = i % 2 === 1;
            const rank    = Math.ceil(i / 2);
            const armAngle = isLeft
                ? -0.42 - Math.random() * 0.12   // left arm angle (up-left)
                :  0.38 + Math.random() * 0.12;   // right arm angle (up-right) — slightly different

            const spacing = birdSize * (1.6 + Math.random() * 0.4);
            localX = Math.cos(armAngle) * spacing * rank;
            localY = Math.sin(armAngle) * spacing * rank;   // negative = upward from leader
        }

        // Clamp initial world position to stay within screen
        const worldX = leaderStartX + localX;
        const worldY = leaderStartY + localY;

        birds.push({
            localX,
            localY,
            x: worldX,
            y: worldY,
            frameIndex:    Math.floor(Math.random() * 4),
            frameTimer:    Math.random() * FRAME_MS,
            frameDuration: FRAME_MS * (0.75 + Math.random() * 0.5),
            wobblePhase:   Math.random() * Math.PI * 2,
            wobbleAmp:     (Math.random() - 0.5) * 3.5,
            size:          birdSize * (i === 0 ? 1.1 : 0.8 + Math.random() * 0.35),
            maxAlpha:      i === 0 ? 1.0 : 0.78 + Math.random() * 0.22,
        });
    }

    return {
        spawnAt,
        leaderStartX,
        leaderStartY,
        leaderX: leaderStartX,
        leaderY: leaderStartY,
        angle,
        speed,
        birdSize,
        birds,
    };
}

function _updateFormation(f, age) {
    const cos = Math.cos(f.angle);
    const sin = Math.sin(f.angle);

    f.leaderX = f.leaderStartX + cos * f.speed * age * 0.1;
    f.leaderY = f.leaderStartY + sin * f.speed * age * 0.1;

    for (const bird of f.birds) {
        // Rotate local offset into flight-direction space
        const rot  = f.angle - Math.PI / 2;
        const rx   = bird.localX * Math.cos(rot) - bird.localY * Math.sin(rot);
        const ry   = bird.localX * Math.sin(rot) + bird.localY * Math.cos(rot);
        const wob  = bird.wobbleAmp * Math.sin(age * 0.0022 + bird.wobblePhase);

        bird.x = f.leaderX + rx + wob;
        bird.y = f.leaderY + ry;

        bird.frameTimer += 16;
        if (bird.frameTimer >= bird.frameDuration) {
            bird.frameTimer = 0;
            bird.frameIndex = (bird.frameIndex + 1) % Math.max(1, _sprites.length);
        }
    }
}

function _drawFormation(ctx, f, H, useSprites) {
    for (const bird of f.birds) {
        // Birds fade out as they exit the top — no fade-in needed
        // since they start on screen
        const exitFade = Math.max(0, Math.min(bird.y / (H * 0.1), 1));
        const alpha    = exitFade * bird.maxAlpha;

        if (alpha < 0.02) continue;

        if (useSprites) {
            _drawSprite(ctx, bird, f.angle, alpha);
        } else {
            _drawProcedural(ctx, bird.x, bird.y, bird.size, f.angle, alpha);
        }
    }
}

function _drawSprite(ctx, bird, angle, alpha) {
    const sprite = _sprites[bird.frameIndex];
    if (!sprite?.complete || !sprite.naturalWidth) {
        _drawProcedural(ctx, bird.x, bird.y, bird.size, angle, alpha);
        return;
    }

    const w = bird.size * 2.8;
    const h = w * (sprite.naturalHeight / sprite.naturalWidth);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(bird.x, bird.y);
    ctx.rotate(angle);
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(6, 8, 20, 0.88)';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
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

