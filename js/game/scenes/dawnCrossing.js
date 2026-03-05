// dawnCrossing.js
// Liminal bridge: champion rows to Scáthach's isle at dawn.
// Full-screen sea reflects the stars — player doesn't realise they're
// looking at water until the slow revelation unfolds.
//
// Call: initDawnCrossing(champion, sliderValue, onComplete)

import { ScrollingTextPlayer } from '../ui/scrollingTextPlayer.js';
import { dawnCrossingTexts   } from '../../../data/dawnCrossingTexts.js';

// ─────────────────────────────────────────────────────────────────────────────
// BOAT
// ─────────────────────────────────────────────────────────────────────────────
const BOAT_PIXELS = [
    '0000000110000000',
    '0000001111000000',
    '0000011111100000',
    '0001111111111000',
    '0111111111111110',
    '1111111111111111',
    '0111111111111110',
    '0001111111111000',
];
const BOAT_W    = 16;
const BOAT_H    = 8;
const OAR_CYCLE = 3200; // ms — slow, unhurried curragh pull

// ─────────────────────────────────────────────────────────────────────────────
// PSYCHEDELIC TENDRIL SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
//
// Each oar-stroke spawns a BLOOM at the boat's wake position.
// A bloom contains ROOT TENDRILS — each one is an EPICYCLIC CURVE:
//   position(t) = Σ{ radius_i * [cos(freq_i*t + phase_i), sin(freq_i*t + phase_i)] }
// Summing 3–5 such rotating vectors naturally produces loops, figure-eights,
// spirals, and knotwork-like self-crossings — the La Tène character.
//
// As a tendril grows it periodically BRANCHES, spawning child tendrils
// from its current tip with slightly mutated parameters.
// Children can have children up to MAX_DEPTH.
//
// All path points are stored. Fading takes ~55 s.
// The colours are soft pastels — vapour-trail iridescence in the dark water.
//
// Performance: paths are stored as Float32Arrays with a rolling head pointer.
// We cap total tendrils and prune dead ones each frame.

const PASTEL_PALETTE = [
    [215, 235, 255],   // ice blue
    [220, 255, 235],   // mint
    [255, 218, 245],   // rose
    [240, 220, 255],   // lavender
    [255, 242, 210],   // peach
    [210, 255, 248],   // seafoam
    [255, 255, 218],   // champagne
    [228, 212, 255],   // violet
    [208, 245, 218],   // sage
    [255, 228, 218],   // blush
    [218, 248, 255],   // sky
    [255, 235, 240],   // petal
];

const TENDRIL_GROW_MS   = 20000;   // grows for 20 s
const TENDRIL_FADE_MS   = 55000;   // then fades for 55 s (total life 75 s)
const TENDRIL_TOTAL_MS  = TENDRIL_GROW_MS + TENDRIL_FADE_MS;
const BRANCH_INTERVAL   = 3800;    // try to branch every ~3.8 s
const MAX_DEPTH         = 4;
const MAX_TOTAL         = 420;     // global cap on live tendrils
const PTS_PER_MS        = 0.14;    // path density — points added per ms of growth
const BLOOM_INTERVAL    = 2000;    // ms between wake spawns

let allTendrils = [];   // flat list for iteration

function rnd(a, b)   { return a + Math.random() * (b - a); }
function pick(arr)   { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

function makeCycles(depth) {
    const n = 3 + Math.floor(Math.random() * 3);
    return Array.from({ length: n }, (_, i) => ({
        // Outer cycles have smaller radius — detail on top of form
        r:     rnd(12, 70) * Math.pow(0.72, i) * (1 - depth * 0.14),
        freq:  rnd(0.35, 2.6) * (Math.random() > 0.5 ? 1 : -1),
        phase: rnd(0, Math.PI * 2),
    }));
}

function spawnTendril(ox, oy, depth, parentCol) {
    if (allTendrils.length >= MAX_TOTAL) return null;
    const col = depth === 0
        ? pick(PASTEL_PALETTE)
        : PASTEL_PALETTE[
            (PASTEL_PALETTE.indexOf(parentCol) + 1 + Math.floor(Math.random() * 3))
            % PASTEL_PALETTE.length
          ];
    const t = {
        ox, oy,
        col,
        depth,
        cycles:      makeCycles(depth),
        points:      [],   // [x, y, x, y, ...] Float32 pairs
        born:        performance.now(),
        lastBranch:  performance.now() + rnd(1000, 2500),
        lineW:       clamp(0.9 - depth * 0.16, 0.22, 0.9),
        children:    [],
        dead:        false,
        // for branching
        lastTipX:    ox,
        lastTipY:    oy,
    };
    allTendrils.push(t);
    return t;
}

function spawnBloom(x, y) {
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
        spawnTendril(x + rnd(-8, 8), y + rnd(-4, 4), 0, null);
    }
}

// Perspective squash for water surface
function pScaleY(y, H) {
    return 0.15 + 0.62 * (y / H);
}

function updateTendril(t, now, H) {
    if (t.dead) return;
    const age = now - t.born;
    if (age > TENDRIL_TOTAL_MS) { t.dead = true; return; }

    if (age < TENDRIL_GROW_MS) {
        // Add new path points
        const t2     = age * 0.001;
        const target = Math.floor(age * PTS_PER_MS);
        const current = t.points.length / 2;
        const add    = target - current;

        if (add > 0) {
            let cx = 0, cy = 0;
            for (const c of t.cycles) {
                cx += c.r * Math.cos(c.freq * t2 + c.phase);
                cy += c.r * Math.sin(c.freq * t2 + c.phase) * pScaleY(t.oy, H);
            }
            const px = t.ox + cx;
            const py = t.oy + cy;
            for (let k = 0; k < add; k++) {
                t.points.push(px, py);
            }
            t.lastTipX = px;
            t.lastTipY = py;
        }

        // Branching
        if (t.depth < MAX_DEPTH && now > t.lastBranch && allTendrils.length < MAX_TOTAL) {
            t.lastBranch = now + BRANCH_INTERVAL * rnd(0.7, 1.4);
            const child = spawnTendril(t.lastTipX, t.lastTipY, t.depth + 1, t.col);
            if (child) t.children.push(child);
        }
    }
}

function drawTendril(ctx, t, now) {
    if (t.dead || t.points.length < 4) return;

    const age   = now - t.born;
    const fadeT = age < TENDRIL_GROW_MS
        ? 0
        : (age - TENDRIL_GROW_MS) / TENDRIL_FADE_MS;

    // Long full plateau, then smooth power fade
    const alpha = (1 - Math.pow(clamp(fadeT, 0, 1), 2.8))
                * (0.78 - t.depth * 0.13);
    if (alpha < 0.004) return;

    const pts = t.points;
    const [r, g, b] = t.col;

    // Draw in segments so we can apply a hue shimmer that ripples along the path
    const N       = pts.length / 2;
    const segSize = Math.max(6, Math.floor(N / 50));

    ctx.lineWidth   = t.lineW;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    for (let i = 0; i < N - 1; i += segSize) {
        const end = Math.min(i + segSize, N - 1);
        // Hue shimmer: a sine wave that travels along the path over time
        const shimmer   = Math.sin(i * 0.06 + now * 0.00028) * 22;
        const shimmer2  = Math.cos(i * 0.04 + now * 0.00019) * 14;
        const fr = Math.round(clamp(r + shimmer,  0, 255));
        const fg = Math.round(clamp(g + shimmer2, 0, 255));
        const fb = Math.round(clamp(b - shimmer * 0.4, 0, 255));

        ctx.strokeStyle = `rgba(${fr},${fg},${fb},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(pts[(i) * 2], pts[(i) * 2 + 1]);
        for (let j = i + 1; j <= end; j++) {
            ctx.lineTo(pts[j * 2], pts[j * 2 + 1]);
        }
        ctx.stroke();
    }
}

function tickTendrils(now, H) {
    // Prune dead
    allTendrils = allTendrils.filter(t => !t.dead);
    for (const t of allTendrils) updateTendril(t, now, H);
}

function renderTendrils(ctx, now) {
    for (const t of allTendrils) drawTendril(ctx, t, now);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function initDawnCrossing(champion, sliderValue, onComplete) {
    allTendrils = [];

    let moonPhase = typeof sliderValue === 'number' ? sliderValue : 0.15;

    // ── Container ─────────────────────────────────────────────────────────────
    const container = document.createElement('div');
    container.id    = 'dawnCrossing';
    container.style.cssText = [
        'position:fixed;inset:0;z-index:999999;',
        'overflow:hidden;pointer-events:all;',
        'background:#020408;touch-action:none;',
    ].join('');
    document.body.appendChild(container);

    // ── Canvas ────────────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // ── Timing ────────────────────────────────────────────────────────────────
    const SCENE_DURATION = 95000;
    const STAR_FADE_END  = 44000;
    const SEA_DAWN_END   = 74000;
    const BOAT_DURATION  = 88000;

    // ── Stars (full screen — reflected sky illusion) ──────────────────────────
    const stars = Array.from({ length: 280 }, () => ({
        x:    Math.random(),
        y:    Math.random(),
        r:    rnd(0.2, 1.6),
        base: rnd(0.15, 0.65),
        ts:   rnd(0.0004, 0.0015),
        to:   rnd(0, Math.PI * 2),
        vx:   rnd(-1, 1) * 0.000035,
        vy:   rnd(-1, 1) * 0.000020,
    }));

    // ── Music fade ────────────────────────────────────────────────────────────
    (async () => {
        try {
            const mod = await import('../../heroSelect.js');
            const mp  = mod.getMusicPlayer?.();
            if (mp?.audioContext) {
                const ac = mp.audioContext;
                const t0 = ac.currentTime;
                for (const tr of (mp.tracks || [])) {
                    if (tr?.gain) {
                        tr.gain.gain.setValueAtTime(tr.gain.gain.value, t0);
                        tr.gain.gain.linearRampToValueAtTime(0, t0 + 18);
                    }
                }
            }
        } catch(e) {}
    })();

    // ── Text ──────────────────────────────────────────────────────────────────
    let textPlayer = null;
    let sceneDone  = false;

    const opacityInterval = setInterval(() => {
        const s = document.querySelector('.champion-slider');
        if (s) moonPhase = parseFloat(s.value);
    }, 350);

    const textTimer = setTimeout(() => {
        textPlayer = new ScrollingTextPlayer({
            lines:        dawnCrossingTexts.crossing,
            getMoonPhase: () => moonPhase,
            onComplete:   beginExit,
            container,
        });
        textPlayer.start();
    }, 5000);

    const hardCap = setTimeout(() => { if (!sceneDone) beginExit(); }, SCENE_DURATION);

    // ── Exit ──────────────────────────────────────────────────────────────────
    function beginExit() {
        if (sceneDone) return;
        sceneDone = true;
        clearTimeout(textTimer);
        clearTimeout(hardCap);
        clearInterval(opacityInterval);
        if (textPlayer) { textPlayer.destroy(); textPlayer = null; }
        window.removeEventListener('resize', resize);

        const veil = document.createElement('div');
        veil.style.cssText = [
            'position:fixed;inset:0;z-index:1000000;',
            'background:#b2bac4;opacity:0;',
            'transition:opacity 2.8s ease;pointer-events:none;',
        ].join('');
        document.body.appendChild(veil);

        setTimeout(() => {
            cancelAnimationFrame(rafId);
            requestAnimationFrame(() => { veil.style.opacity = '1'; });
        }, 500);

        setTimeout(() => {
            container.remove();
            veil.remove();
            allTendrils = [];

            const gc = document.getElementById('gameContainer');
            if (gc) {
                gc.style.display  = '';
                gc.style.opacity  = '1';
                gc.style.position = 'fixed';
                gc.style.inset    = '0';
                gc.style.zIndex   = '999999';
            }
            if (onComplete) onComplete();
        }, 3900);
    }

    // ── Render ────────────────────────────────────────────────────────────────
    const startTime  = performance.now();
    let   rafId      = null;
    let   lastBloom  = 0;

    const lerp  = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
    const easeIO = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;

    function draw(now) {
        rafId = requestAnimationFrame(draw);
        const W = canvas.width;
        const H = canvas.height;
        const elapsed = now - startTime;

        // ── Sea colour ────────────────────────────────────────────────────────
        const colT = clamp(elapsed / SEA_DAWN_END, 0, 1);
        const colE = easeIO(colT);
        const night = [2,   4,  10];
        const dawn  = [50,  62,  80];
        const day   = [142, 152, 162];
        function seaC(ch) {
            return colT < 0.5
                ? lerp(night[ch], dawn[ch],  colT * 2)
                : lerp(dawn[ch],  day[ch],  (colT - 0.5) * 2);
        }
        const [sr, sg, sb] = [seaC(0), seaC(1), seaC(2)];

        // ── Full-screen banded sea with iridescent shimmer ────────────────────
        for (let i = 0; i < 220; i++) {
            const fy = i / 220;
            const y  = fy * H;
            const ir = sr + Math.sin(fy * 11.4 + elapsed * 0.00042             ) * (7  + colE * 9);
            const ig = sg + Math.sin(fy * 7.2  + elapsed * 0.00037 + 1.2       ) * (9  + colE * 11);
            const ib = sb + Math.cos(fy * 9.5  + elapsed * 0.00051 + fy * 0.5  ) * (12 + colE * 14);
            const dx = Math.sin(fy * 5.3 + elapsed * 0.00045 + i * 0.07) * (fy * 5);
            ctx.fillStyle = `rgb(${
                Math.round(clamp(ir, 0, 255))},${
                Math.round(clamp(ig, 0, 255))},${
                Math.round(clamp(ib, 0, 255))})`;
            ctx.fillRect(Math.round(dx), Math.round(y), W + 8, Math.ceil(H / 220 + 1));
        }

        // ── Stars (full-screen reflected-sky illusion) ────────────────────────
        const starFadeT = clamp(elapsed / STAR_FADE_END, 0, 1);
        const starAlpha = 1 - easeIO(starFadeT);
        const speedMult = Math.max(0, 1 - starFadeT * 0.98);

        if (starAlpha > 0.003) {
            for (const s of stars) {
                s.x += s.vx * speedMult;
                s.y += s.vy * speedMult;
                if (s.x < 0) s.x += 1; if (s.x > 1) s.x -= 1;
                if (s.y < 0) s.y += 1; if (s.y > 1) s.y -= 1;
                const tw = 0.55 + 0.45 * Math.sin(elapsed * s.ts + s.to);
                const cR = Math.round(lerp(235, 168, starFadeT));
                const cG = Math.round(lerp(240, 180, starFadeT));
                ctx.beginPath();
                ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${cR},${cG},255,${s.base * tw * starAlpha})`;
                ctx.fill();
            }
        }

        // ── Tendril system (La Tène wake) ─────────────────────────────────────
        tickTendrils(now, H);
        renderTendrils(ctx, now);

        // ── Boat ───────────────────────────────────────────────────────────────
        const boatT = clamp(elapsed / BOAT_DURATION, 0, 1);
        const boatE = easeIO(boatT);
        const boatX = lerp(W * 0.08, W * 0.84, boatE);
        const boatY = lerp(H * 0.80, H * 0.40, boatE);

        if (now - lastBloom > BLOOM_INTERVAL) {
            lastBloom = now;
            spawnBloom(boatX, boatY + 10);
            if (Math.random() > 0.5) spawnBloom(boatX + rnd(-20, 20), boatY + rnd(5, 18));
        }

        const persp = lerp(1.0, 0.28, boatE);
        const SCALE = Math.max(1, Math.round((W / 148) * persp));
        const bw    = BOAT_W * SCALE;
        const bh    = BOAT_H * SCALE;
        const bLeft = boatX - bw * 0.5;
        const bTop  = boatY - bh;

        // Solo rower, both oars TOGETHER (curragh stroke)
        const cycT      = (elapsed % OAR_CYCLE) / OAR_CYCLE;
        const pullAngle = Math.sin(cycT * Math.PI * 2) * 0.50;
        const liftY     = Math.max(0, -Math.sin(cycT * Math.PI * 2)) * SCALE * 1.6;
        const oAlpha    = clamp(persp * 2.4, 0, 1);

        // Hull reflection
        ctx.save();
        ctx.globalAlpha = 0.09 * (1 - boatE * 0.5);
        ctx.translate(bLeft, bTop + bh + 2);
        ctx.scale(1, -0.18);
        for (let row = 0; row < BOAT_H; row++) {
            for (let col = 0; col < BOAT_W; col++) {
                if (BOAT_PIXELS[row][col] === '1') {
                    ctx.fillStyle = `rgba(${Math.round(sr+14)},${Math.round(sg+17)},${Math.round(sb+22)},1)`;
                    ctx.fillRect(col * SCALE, row * SCALE, SCALE, SCALE);
                }
            }
        }
        ctx.restore();

        function drawOar(fromFrac, dir) {
            ctx.save();
            ctx.globalAlpha = oAlpha;
            ctx.translate(bLeft + bw * fromFrac, bTop + bh * 0.50 - liftY);
            ctx.rotate(pullAngle * dir);
            ctx.strokeStyle = '#050810';
            ctx.lineWidth   = Math.max(1, SCALE * 0.58);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(dir * SCALE * 11, SCALE * 2.0);
            ctx.stroke();
            ctx.fillStyle = '#050810';
            ctx.beginPath();
            ctx.ellipse(
                dir * SCALE * 11, SCALE * 2.0,
                SCALE * 1.4, SCALE * 0.48,
                pullAngle * dir * 0.4, 0, Math.PI * 2
            );
            ctx.fill();
            ctx.restore();
        }

        drawOar(0.20, -1);  // port
        drawOar(0.80,  1);  // starboard

        // Hull
        ctx.globalAlpha = 1;
        for (let row = 0; row < BOAT_H; row++) {
            for (let col = 0; col < BOAT_W; col++) {
                if (BOAT_PIXELS[row][col] === '1') {
                    ctx.fillStyle = '#040709';
                    ctx.fillRect(
                        Math.round(bLeft + col * SCALE),
                        Math.round(bTop  + row * SCALE),
                        SCALE, SCALE
                    );
                }
            }
        }

        // ── Canvas warp ───────────────────────────────────────────────────────
        const wx = Math.sin(elapsed * 0.00033) * 0.0016;
        const wy = Math.cos(elapsed * 0.00024) * 0.0011;
        canvas.style.transform = `skewX(${wx}rad) skewY(${wy}rad)`;

        // ── Vignette ──────────────────────────────────────────────────────────
        const vigStr = lerp(0.78, 0.22, colE);
        const vig = ctx.createRadialGradient(W*0.5, H*0.5, H*0.08, W*0.5, H*0.5, H*0.94);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, `rgba(1,2,5,${vigStr})`);
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
    }

    rafId = requestAnimationFrame(draw);
}

