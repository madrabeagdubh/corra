// returnCrossing.js — v2
// Call: initReturnCrossing(champion, sliderValue, onComplete)
//
// The return journey: Skye → Éire. Top-centre to bottom-left.
// Choppy day, light swell, wind from the north-east.
import { transitionOut, transitionIn } from '../ui/sceneTransition.js'
import { FONTS, COLORS, SPACING, TYPE, createDomButton } from '../systems/gameTypography.js';
import { GameSettings } from '../settings/gameSettings.js';
import { createMoonWidget } from '../ui/moonWidget.js';

// ─────────────────────────────────────────────────────────────────────────────
// BOAT PIXELS
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
const BOAT_W = 16;
const BOAT_H = 8;

// ── Oar cycle ─────────────────────────────────────────────────────────────────
const READY_MS  = 1600;
const STROKE_MS = 1400;
const RETURN_MS =  800;
const OAR_CYCLE = READY_MS + STROKE_MS + RETURN_MS;

const READY_ANGLE  = -0.44;
const CATCH_ANGLE  = -0.44;
const FINISH_ANGLE =  0.40;
const READY_LIFT   =  2.4;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const rnd    = (a, b) => a + Math.random() * (b - a);
const clamp  = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp   = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
const easeIO = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
const easeOut = t => 1 - (1-clamp(t,0,1))*(1-clamp(t,0,1));
const easeIn  = t => clamp(t,0,1)*clamp(t,0,1);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export function initReturnCrossing(champion, sliderValue, onComplete) {
    // Seed from passed value or current GameSettings
    let moonPhase = typeof sliderValue === 'number' ? sliderValue : (GameSettings.englishOpacity ?? 0.15);
    GameSettings.setEnglishOpacity(moonPhase);

    // ── Container ─────────────────────────────────────────────────────────────
    const container = document.createElement('div');
    container.id = 'returnCrossing';
    container.style.cssText = [
        'position:fixed;inset:0;z-index:999999;',
        'overflow:hidden;pointer-events:all;background:#08100e;touch-action:none;',
    ].join('');
    document.body.appendChild(container);

    // ── Font override for ScrollingTextPlayer ─────────────────────────────────
    const W0 = window.innerWidth, H0 = window.innerHeight;
    const gaFontPx = TYPE.domBody.sizePx;
    const enFontPx = TYPE.domBodyEn.sizePx;

    const SCENE_IRISH_COLOR = '#d8e8f0';
    const SCENE_EN_COLOR    = '#8a9a8e';

    const fontOverride = document.createElement('style');
    fontOverride.id = 'returnCrossingFontOverride';
    fontOverride.textContent = `
        #returnCrossing div div div:first-child {
            font-size:${gaFontPx}px !important;
            color:${SCENE_IRISH_COLOR} !important;
            line-height:${SPACING.irishLineHeight} !important;
            text-shadow:
                0 0 22px rgba(160,200,230,0.85),
                0 0  8px rgba(100,160,200,0.6),
                1px  1px 0 rgba(0,10,20,0.9),
               -1px -1px 0 rgba(0,10,20,0.9),
                1px -1px 0 rgba(0,10,20,0.9),
               -1px  1px 0 rgba(0,10,20,0.9) !important;
        }
        #returnCrossing div div div:nth-child(2) {
            font-size:${enFontPx}px !important;
            color:${SCENE_EN_COLOR} !important;
            font-family:${FONTS.english} !important;
            line-height:${SPACING.englishLineHeight} !important;
            text-shadow:
                0 0 10px rgba(0,0,0,0.95),
                1px  1px 0 rgba(0,0,0,0.8),
               -1px -1px 0 rgba(0,0,0,0.8),
                1px -1px 0 rgba(0,0,0,0.8),
               -1px  1px 0 rgba(0,0,0,0.8) !important;
        }
    `;
    document.head.appendChild(fontOverride);

    // ── Moon widget — fixed bottom-centre, swipe to change English opacity ────
    // No buttons in this scene; scrolling text has its own bottom fade margin.
    const moonWidget = createMoonWidget({
        initialPhase : moonPhase,
        showSlider   : false,
        corner       : 'bottom-center',
        onChange     : (phase) => {
            moonPhase = phase;
            GameSettings.setEnglishOpacity(phase);
            // ScrollingTextPlayer reads GameSettings.englishOpacity each frame
        },
    })
	;

	// ── Skip menu ─────────────────────────────────────────────────────────────
    const skipBackdrop = document.createElement('div');
    skipBackdrop.style.cssText = [
        'position:fixed;inset:0;z-index:1000001;',
        'background:rgba(2,4,8,0.7);opacity:0;',
        'pointer-events:none;transition:opacity 0.25s ease;display:none;',
    ].join('');
    document.body.appendChild(skipBackdrop);

    let skipMenuOpen = false;

    function openSkipMenu() {
        if (skipMenuOpen || sceneDone) return;
        skipMenuOpen = true;
        skipBackdrop.style.display = 'block';
        requestAnimationFrame(() => { skipBackdrop.style.opacity = '0.7'; });
        skipBackdrop.style.pointerEvents = 'all';

        const card = document.createElement('div');
        card.style.cssText = [
            'position:fixed;top:50%;left:50%;',
            'transform:translate(-50%,-50%);',
            'background:rgba(2,4,8,0.96);',
            'border:1px solid rgba(212,175,55,0.35);',
            'border-radius:18px;padding:2rem 1.5rem 1.5rem;',
            'width:min(340px,85vw);',
            'display:flex;flex-direction:column;gap:1rem;align-items:center;',
            'z-index:1000002;',
            'box-shadow:0 8px 40px rgba(0,0,0,0.8);',
            'opacity:0;transition:opacity 0.25s ease;',
        ].join('');
        document.body.appendChild(card);
        requestAnimationFrame(() => { card.style.opacity = '1'; });

        const skipBtn = createDomButton({
            ga: 'Scip', en: 'Skip', opacity: moonPhase,
            onClick: () => {
                card.remove();
                skipBackdrop.remove();
                beginExit();
            },
        });
        skipBtn.el.style.width = '100%';
        card.appendChild(skipBtn.el);

        const closeMenu = () => {
            skipMenuOpen = false;
            card.style.opacity = '0';
            skipBackdrop.style.opacity = '0';
            setTimeout(() => {
                card.remove();
                skipBackdrop.style.display = 'none';
                skipBackdrop.style.pointerEvents = 'none';
            }, 280);
            moonWidget.setTapHandler(null);
        };

        moonWidget.setTapHandler(closeMenu);
        skipBackdrop.addEventListener('pointerdown', closeMenu, { once: true });
    }

    moonWidget.setLongPressHandler(() => { openSkipMenu(); });
    moonWidget.setLongPressProgressHandler((p) => {
        if (p > 0.12) {
            skipBackdrop.style.display = 'block';
            skipBackdrop.style.opacity = String(Math.min((p - 0.12) * 0.8, 0.4));
        } else {
            skipBackdrop.style.opacity = '0';
        }
    });

    // ── Canvas ────────────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.insertBefore(canvas, container.firstChild);
    const ctx = canvas.getContext('2d');

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    // ── Scene timing ──────────────────────────────────────────────────────────
    const SCENE_DURATION = 95000;
    const BOAT_DURATION  = 88000;
    const SKYE_FADE_END  = 22000;

    // ── Clouds ────────────────────────────────────────────────────────────────
    const clouds = Array.from({ length: 7 }, () => ({
        x:     rnd(0, 1.4),
        y:     rnd(0.04, 0.32),
        w:     rnd(0.18, 0.42),
        h:     rnd(0.04, 0.10),
        speed: rnd(0.000008, 0.000022),
        alpha: rnd(0.06, 0.18),
        puffs: Array.from({ length: Math.floor(rnd(3,6)) }, () => ({
            ox: rnd(-0.5, 0.5),
            oy: rnd(-0.4, 0.4),
            rs: rnd(0.7, 1.3),
        })),
    }));

    // ── Swell ─────────────────────────────────────────────────────────────────
    const WAVE_COUNT = 6;
    const waves = Array.from({ length: WAVE_COUNT }, (_, i) => ({
        phase:  (i / WAVE_COUNT) * Math.PI * 2,
        speed:  rnd(0.00028, 0.00048),
        amp:    rnd(0.018, 0.038),
        wl:     rnd(0.22, 0.40),
        alpha:  rnd(0.04, 0.11),
        bright: rnd(0.5, 1.0),
    }));

    // ── Foam lines ────────────────────────────────────────────────────────────
    const FOAM_COUNT = 42;
    const foamLines  = Array.from({ length: FOAM_COUNT }, () => ({
        x:      rnd(0, 1),
        y:      rnd(0.50, 0.95),
        len:    rnd(0.018, 0.050),
        speedX: rnd(0.000004, 0.000010),
        speedY: rnd(0.000003, 0.000008),
        alpha:  rnd(0.07, 0.20),
    }));

    // ── Wave crests ───────────────────────────────────────────────────────────
    const CREST_COUNT = 8;
    const waveCrests  = Array.from({ length: CREST_COUNT }, () => makeCrest(rnd(0, 6000)));

    function makeCrest(bornOffset) {
        return {
            x:       rnd(0.05, 0.92),
            y:       rnd(0.55, 0.90),
            width:   rnd(0.06, 0.14),
            height:  rnd(0.006, 0.014),
            life:    0 - bornOffset,
            maxLife: rnd(1800, 3200),
            alpha:   rnd(0.18, 0.38),
        };
    }

    // ── Splash ────────────────────────────────────────────────────────────────
    let splashParticles = [];
    let nextSplashAt    = rnd(3000, 6000);

    function fireSplash(elapsed) {
        const sx   = rnd(0.05, 0.95);
        const sy   = rnd(0.82, 0.92);
        const roll = Math.random();
        const bias = roll < 0.33 ? -1 : roll < 0.66 ? 1 : 0;
        const count = Math.floor(rnd(28, 55));
        for (let i = 0; i < count; i++) {
            const speed  = rnd(0.0006, 0.0022);
            const spread = rnd(-0.55, 0.55);
            const angle  = -Math.PI/2 + bias * rnd(0.1, 0.65) + spread * 0.45;
            splashParticles.push({
                x: sx, y: sy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0,
                maxLife: rnd(500, 1600),
                r: rnd(1.5, 5),
            });
        }
        nextSplashAt = elapsed + rnd(7000, 10000);
    }

    // ── Yaw state ─────────────────────────────────────────────────────────────
    let yawAngle   = 0;
    let yawCorrect = false;
    let yawTimer   = 0;
    const YAW_DRIFT   = 0.000018;
    const YAW_THRESH  = 0.09;
    const YAW_CORRECT = 0.00012;
    let suppressPort  = false;

    // ── Images ────────────────────────────────────────────────────────────────
    const skyeImg = new Image();
    skyeImg.src = 'assets/skye01.png';
    let skyeLoaded = false;
    skyeImg.onload  = () => { skyeLoaded = true; };
    skyeImg.onerror = () => {};

    const cloudImg = new Image();
    cloudImg.src = 'assets/cloud1.png';
    let cloudLoaded = false;
    cloudImg.onload  = () => { cloudLoaded = true; };
    cloudImg.onerror = () => {};

    // ── Text ──────────────────────────────────────────────────────────────────
    const SCROLLING_TEXT_PATH = new URL('/ui/scrollingTextPlayer.js',    import.meta.url).href;
    const RETURN_TEXTS_PATH   = new URL('/data/returnCrossingTexts.js',  import.meta.url).href;

    let textPlayer = null;
    let sceneDone  = false;

    const textTimer = setTimeout(async () => {
        try {
            const [stMod, txtMod] = await Promise.all([
                import(SCROLLING_TEXT_PATH),
                import(RETURN_TEXTS_PATH),
            ]);
            const { ScrollingTextPlayer } = stMod;
            const { returnCrossingTexts } = txtMod;

            textPlayer = new ScrollingTextPlayer({
                lines:        returnCrossingTexts.crossing,
                getMoonPhase: () => GameSettings.englishOpacity,
                onComplete:   () => {},
                container,
            });
            textPlayer.start();

            const RC_PX_PER_MS = 50 / 1000;

            for (const entry of textPlayer._lineEls) {
                entry._cachedH = entry.wrapper.offsetHeight;
            }

            textPlayer._lastLoopTime = performance.now();
            textPlayer._loop = function(timestamp) {
                if (!this._running || this._fadingOut) return;
                const now = timestamp || performance.now();
                const dt  = Math.min(now - this._lastLoopTime, 64);
                this._lastLoopTime = now;
                if (!this._paused && !this._dragging && !this._atCeiling) {
                    const natural = RC_PX_PER_MS;
                    if (Math.abs(this._velocity - natural) > 0.0001) {
                        const a = 1 - Math.exp(-dt / 200);
                        this._velocity += (natural - this._velocity) * a;
                        if (this._velocity > -natural && this._velocity < natural) {
                            this._velocity = natural;
                        }
                    } else {
                        this._velocity = natural;
                    }
                    this._scrollY += this._velocity * dt;
                }
                this._render();
                this._rafId = requestAnimationFrame(this._loop.bind(this));
            };

            textPlayer._render = function() {
                if (!this._overlay) return;
                const H2     = window.innerHeight;
                const mp     = this._getMoonPhase();
                const CEIL   = 8;
                const FADEPX = 80;
                for (const entry of this._lineEls) {
                    const y      = this._screenY(entry);
                    const h      = entry._cachedH || (entry._cachedH = entry.wrapper.offsetHeight);
                    const bottom = y + h;
                    entry.wrapper.style.top = y + 'px';
                    if (bottom < 0 || y > H2) {
                        entry.gaEl.style.opacity = '0';
                        if (entry.enEl) entry.enEl.style.opacity = '0';
                        continue;
                    }
                    let alpha = 1;
                    if (y < CEIL + FADEPX) alpha = Math.max(0, (y - CEIL) / FADEPX);
                    // Fade text out before it reaches the moon widget at bottom
                    if (bottom > H2 * (1 - 0.18)) alpha = Math.min(alpha, Math.max(0, (H2 - y) / (H2 * 0.18)));
                    entry.gaEl.style.opacity = String(alpha);
                    if (entry.enEl) entry.enEl.style.opacity = String(alpha * mp);
                }
            };

            textPlayer._naturalVel = RC_PX_PER_MS;
            textPlayer._velocity   = RC_PX_PER_MS;
            textPlayer._ceilingY       = 999999;
            textPlayer._onReachCeiling = function() {};
            textPlayer._onComplete     = function() {};

            // No slider strip — hitZone covers full screen
            if (textPlayer._hitZone) {
                textPlayer._hitZone.style.top    = '0px';
                textPlayer._hitZone.style.height = window.innerHeight + 'px';
                textPlayer._hitZone.style.bottom = '';
            }

            const origGestureEnd = textPlayer._gestureEnd.bind(textPlayer);
            textPlayer._gestureEnd = function(endY, wasTap) {
                origGestureEnd(endY, wasTap);
                if (!wasTap && !this._atCeiling) {
                    if (this._velocity > -this._naturalVel && this._velocity < this._naturalVel) {
                        this._velocity = this._naturalVel;
                    }
                }
            };

            const exitWhenDone = setInterval(() => {
                if (sceneDone) { clearInterval(exitWhenDone); return; }
                if (!textPlayer || !textPlayer._lineEls) return;
                const last = textPlayer._lineEls[textPlayer._lineEls.length - 1];
                if (!last) return;
                const y = textPlayer._screenY(last);
                const h = last.wrapper.offsetHeight || 60;
                if (y + h < 0) {
                    clearInterval(exitWhenDone);
                    setTimeout(() => { if (!sceneDone) beginExit(); }, 600);
                }
            }, 150);

        } catch(e) {
            console.error('[returnCrossing] Text modules failed.\n', e);
        }
    }, 2000);

    // ── Music fade ─────────────────────────────────────────────────────────────
    (async () => {
        try {
            const mod = await import('../../heroSelect.js');
            const mp  = mod.getMusicPlayer?.();
            if (mp?.audioContext) {
                const ac = mp.audioContext, t0 = ac.currentTime;
                for (const tr of (mp.tracks || [])) {
                    if (tr?.gain) {
                        tr.gain.gain.setValueAtTime(tr.gain.gain.value, t0);
                        tr.gain.gain.linearRampToValueAtTime(0, t0 + 18);
                    }
                }
            }
        } catch(e) {}
    })();

    const hardCap = setTimeout(() => { if (!sceneDone) beginExit(); }, 240000);

    // ── Audio ──────────────────────────────────────────────────────────────────
    let boatAC    = null;
    let masterOut = null;
    let lastCreak = 0, lastDrip = 0, lastBubble = 0, lastOminous = 0;
    let lastWind  = 0;
    let lastGull  = 0;

    function ensureAudio() {
        if (boatAC) return true;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            boatAC    = new AC();
            masterOut = boatAC.createGain();
            masterOut.gain.value = 0.55;
            masterOut.connect(boatAC.destination);
            return true;
        } catch(e) { return false; }
    }

    function makeNoise(dur) {
        const buf = boatAC.createBuffer(1, Math.ceil(boatAC.sampleRate * dur), boatAC.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = boatAC.createBufferSource();
        src.buffer = buf;
        return src;
    }

    function playWaterRush(intensity) {
        if (!ensureAudio()) return;
        const now = boatAC.currentTime;
        [380, 720].forEach((freq, i) => {
            const n  = makeNoise(0.38);
            const bp = boatAC.createBiquadFilter();
            bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.8;
            const g  = boatAC.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(intensity * (i===0 ? 0.28 : 0.18), now + 0.04);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
            n.connect(bp); bp.connect(g); g.connect(masterOut);
            n.start(now); n.stop(now + 0.38);
        });
    }

    function playCreak() {
        if (!ensureAudio()) return;
        const now = boatAC.currentTime;
        const osc = boatAC.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(48, now + 0.28);
        const g = boatAC.createGain();
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        const n  = makeNoise(0.09);
        const bp = boatAC.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 280; bp.Q.value = 3;
        const g2 = boatAC.createGain();
        g2.gain.setValueAtTime(0.07, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(g); g.connect(masterOut);
        n.connect(bp); bp.connect(g2); g2.connect(masterOut);
        osc.start(now); osc.stop(now + 0.28);
        n.start(now);   n.stop(now + 0.09);
    }

    function playWind() {
        if (!ensureAudio()) return;
        const now = boatAC.currentTime;
        const dur = rnd(1.2, 2.4);
        const n   = makeNoise(dur);
        const hp  = boatAC.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 800;
        const g = boatAC.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.12, now + dur * 0.2);
        g.gain.linearRampToValueAtTime(0.08, now + dur * 0.7);
        g.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(hp); hp.connect(g); g.connect(masterOut);
        n.start(now); n.stop(now + dur);
    }

    function playGull() {
        if (!ensureAudio()) return;
        const now   = boatAC.currentTime;
        const calls = Math.floor(rnd(1, 3));
        for (let callIdx = 0; callIdx < calls; callIdx++) {
            const callDelay = callIdx * rnd(0.9, 1.6);
            const syllables = Math.floor(rnd(3, 7));
            const sylDur    = rnd(0.10, 0.16);
            const sylGap    = rnd(0.04, 0.09);
            const baseF     = rnd(600, 950);
            for (let s = 0; s < syllables; s++) {
                const t0  = now + callDelay + s * (sylDur + sylGap);
                const osc = boatAC.createOscillator();
                osc.type  = 'triangle';
                osc.frequency.setValueAtTime(baseF * (1.0 - s * 0.04), t0);
                osc.frequency.exponentialRampToValueAtTime(baseF * 0.55, t0 + sylDur * 0.7);
                const peak = boatAC.createBiquadFilter();
                peak.type = 'peaking'; peak.frequency.value = baseF * 1.4; peak.Q.value = 3; peak.gain.value = 8;
                const g = boatAC.createGain();
                g.gain.setValueAtTime(0, t0);
                g.gain.linearRampToValueAtTime(0.11, t0 + 0.012);
                g.gain.setValueAtTime(0.10, t0 + sylDur * 0.4);
                g.gain.exponentialRampToValueAtTime(0.001, t0 + sylDur);
                osc.connect(peak); peak.connect(g); g.connect(masterOut);
                osc.start(t0); osc.stop(t0 + sylDur + 0.02);
            }
        }
    }

    function playDrip() {
        if (!ensureAudio()) return;
        const now   = boatAC.currentTime;
        const count = Math.floor(rnd(2, 4));
        for (let i = 0; i < count; i++) {
            const delay = i * rnd(0.04, 0.12);
            const freq  = rnd(1800, 2700);
            const osc   = boatAC.createOscillator();
            osc.frequency.value = freq;
            const g = boatAC.createGain();
            g.gain.setValueAtTime(0.07, now + delay);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.14);
            osc.connect(g); g.connect(masterOut);
            osc.start(now + delay); osc.stop(now + delay + 0.14);
        }
    }

    function tickSounds(now, inStroke, strokeT, inReturn, returnT) {
        if (!boatAC) {
            if (inStroke && strokeT < 0.08) ensureAudio();
            return;
        }
        if (inStroke && strokeT < 0.08) playWaterRush(0.4 + strokeT * 1.2);
        const rndCreak = rnd(6000, 14000);
        if (now - lastCreak > rndCreak && Math.random() < 0.012) { lastCreak = now; playCreak(); }
        if (inReturn && returnT < 0.22 && now - lastDrip > 5000 && Math.random() < 0.04) { lastDrip = now; playDrip(); }
        if (now - lastWind > rnd(4000, 10000) && Math.random() < 0.004) { lastWind = now; playWind(); }
        if (now - lastGull > rnd(12000, 30000) && Math.random() < 0.006) { lastGull = now; playGull(); }
    }

    // ── Exit ──────────────────────────────────────────────────────────────────
    function beginExit() {
        if (sceneDone) return;
        sceneDone = true;
        clearTimeout(textTimer);
        clearTimeout(hardCap);
        if (textPlayer) { textPlayer.destroy(); textPlayer = null; }
        window.removeEventListener('resize', resize);
        fontOverride.remove();
        moonWidget.destroy();

        if (boatAC) {
            try {
                if (masterOut) {
                    masterOut.gain.setValueAtTime(masterOut.gain.value, boatAC.currentTime);
                    masterOut.gain.linearRampToValueAtTime(0, boatAC.currentTime + 2.5);
                }
                setTimeout(() => { try { boatAC.close(); } catch(e){} }, 3000);
            } catch(e) {}
        }

        const veil = document.createElement('div');
        veil.style.cssText = [
            'position:fixed;inset:0;z-index:1000000;',
            'background:#0a120e;opacity:0;transition:opacity 2.8s ease;pointer-events:none;',
        ].join('');
        document.body.appendChild(veil);

        setTimeout(() => {
            cancelAnimationFrame(rafId);
            requestAnimationFrame(() => { veil.style.opacity = '1'; });
            transitionOut(2800);
        }, 500);

        setTimeout(() => {
            cancelAnimationFrame(rafId);
            container.remove();

            document.querySelectorAll(
                '#returnCrossing, #dawnCrossing, #returnCrossingFontOverride, #dawnCrossingFontOverride'
            ).forEach(el => el.remove());

            document.querySelectorAll('body > div').forEach(el => {
                const z = parseInt(el.style.zIndex || '0', 10);
                if (z >= 1000000) el.remove();
            });

            veil.remove();
            transitionIn();

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

    // ── Ripples ───────────────────────────────────────────────────────────────
    const RIPPLE_LIFE  = 9000;
    const RIPPLE_MAX_R = 0.26;
    const RIPPLE_SETS  = 10;
    let ripples    = [];
    let lastRipple = 0;

    function rippleColor(hue, alpha) {
        return `hsla(${(hue%360).toFixed(1)},28%,68%,${alpha.toFixed(3)})`;
    }

    function spawnRipple(x, y, angle) {
        if (ripples.length >= RIPPLE_SETS) ripples.shift();
        ripples.push({
            x, y, born: performance.now(), angle,
            hueOffset: 180 + Math.random() * 60,
            scaleX:    0.90 + Math.random() * 0.16,
            scaleY:    0.15 + Math.random() * 0.06,
            sqPhase:   Math.random() * Math.PI * 2,
            sqPhase2:  Math.random() * Math.PI * 2,
        });
    }

    function drawSquirmArc(ctx, R, startAngle, endAngle, sqAmp, sqFreq, sqTime, sqPh, sqPh2, baseAlpha, hue) {
        const STEPS = 52, FADE_END = 0.18;
        for (let s = 0; s < STEPS; s++) {
            const t0 = s / STEPS, t1 = (s + 1) / STEPS;
            const endFade0 = t0 < FADE_END ? t0/FADE_END : t0 > 1-FADE_END ? (1-t0)/FADE_END : 1;
            const segAlpha = baseAlpha * endFade0;
            if (segAlpha < 0.003) continue;
            const a0 = startAngle + (endAngle - startAngle) * t0;
            const a1 = startAngle + (endAngle - startAngle) * t1;
            const sq0 = sqAmp*(Math.sin(sqFreq*a0+sqTime*1.1+sqPh)*0.65+Math.sin(sqFreq*a0*3+sqTime*0.7+sqPh2)*0.35);
            const sq1 = sqAmp*(Math.sin(sqFreq*a1+sqTime*1.1+sqPh)*0.65+Math.sin(sqFreq*a1*3+sqTime*0.7+sqPh2)*0.35);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a0)*(R+sq0), Math.sin(a0)*(R+sq0));
            ctx.lineTo(Math.cos(a1)*(R+sq1), Math.sin(a1)*(R+sq1));
            ctx.strokeStyle = rippleColor(hue, segAlpha);
            ctx.stroke();
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    const startTime     = performance.now();
    let   rafId         = null;
    let   boatProgress  = 0;
    let   lastFrameTime = performance.now();

    function draw(now) {
        rafId = requestAnimationFrame(draw);
        const W = canvas.width, H = canvas.height;
        const elapsed = now - startTime;
        const dt = Math.min(now - lastFrameTime, 64);
        lastFrameTime = now;

        // Sea colour
        const colT = clamp(elapsed / SCENE_DURATION, 0, 1);
        const colE = easeIO(colT);
        const sr = Math.round(lerp(14, 20, colE));
        const sg = Math.round(lerp(28, 32, colE));
        const sb = Math.round(lerp(28, 52, colE));

        ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
        ctx.fillRect(0, 0, W, H);

        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H*0.42);
        const skyR = Math.round(lerp(52, 28, colE));
        const skyG = Math.round(lerp(62, 38, colE));
        const skyB = Math.round(lerp(72, 68, colE));
        skyGrad.addColorStop(0, `rgb(${skyR},${skyG},${skyB})`);
        skyGrad.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H*0.42);

        // Skye fades out
        if (skyeLoaded) {
            const skyeT     = clamp(elapsed / SKYE_FADE_END, 0, 1);
            const skyeAlpha = (1 - easeIO(skyeT)) * 0.22;
            if (skyeAlpha > 0.001) {
                const aspect = skyeImg.naturalWidth / skyeImg.naturalHeight;
                const skyeW  = W, skyeH = skyeW / aspect;
                ctx.save(); ctx.globalAlpha = skyeAlpha;
                ctx.drawImage(skyeImg, 0, 0, skyeW, skyeH);
                ctx.restore();
            }
        }

        // Swell
        {
            ctx.save();
            for (const w of waves) {
                w.phase += w.speed * dt;
                const bandTop = 0.48, bandBottom = 0.96;
                const STEPS = 38;
                for (let s = 0; s < STEPS; s++) {
                    const fy  = bandTop + (bandBottom - bandTop) * (s / STEPS);
                    const fy1 = bandTop + (bandBottom - bandTop) * ((s+1) / STEPS);
                    const wave = Math.sin(fy * Math.PI * (1/w.wl) + w.phase);
                    if (wave < 0.3) continue;
                    const wAlpha = (wave - 0.3) / 0.7 * w.alpha * (fy > 0.7 ? 1 : fy/0.7);
                    const wR = Math.round(lerp(sr, 210, wave * w.bright * 0.55));
                    const wG = Math.round(lerp(sg, 220, wave * w.bright * 0.55));
                    const wB = Math.round(lerp(sb, 228, wave * w.bright * 0.65));
                    const dx = Math.sin(fy * 7.3 + elapsed * 0.0004) * W * 0.012;
                    ctx.fillStyle = `rgba(${wR},${wG},${wB},${wAlpha.toFixed(3)})`;
                    ctx.fillRect(dx, fy*H, W+4, Math.ceil((fy1-fy)*H)+1);
                }
            }
            ctx.restore();
        }

        // Sea shimmer
        for (let i = 0; i < 140; i++) {
            const fy = i/140, y = fy*H;
            const ir = sr + Math.sin(fy*11.4 + elapsed*0.00038) * (4+colE*6);
            const ig = sg + Math.sin(fy*7.2  + elapsed*0.00033 + 1.2) * (5+colE*8);
            const ib = sb + Math.cos(fy*9.5  + elapsed*0.00044 + fy*0.5) * (7+colE*10);
            const dx = Math.sin(fy*5.3 + elapsed*0.00042 + i*0.07) * (fy*4);
            ctx.fillStyle = `rgba(${Math.round(clamp(ir,0,255))},${Math.round(clamp(ig,0,255))},${Math.round(clamp(ib,0,255))},0.18)`;
            ctx.fillRect(Math.round(dx), Math.round(y), W+6, Math.ceil(H/140+1));
        }

        // Foam lines
        {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            for (const fl of foamLines) {
                fl.x -= fl.speedX * 0.25 * dt;
                fl.y -= fl.speedY * 0.25 * dt;
                if (fl.x + fl.len < 0) fl.x = 1.0 + rnd(0, 0.08);
                if (fl.y < 0.48) { fl.y = rnd(0.88, 0.96); fl.x = rnd(0, 1); }
                const x0 = Math.round(fl.x * W);
                const y0 = Math.round(fl.y * H);
                const pw = Math.round(fl.len * W);
                const depthFade = clamp((fl.y - 0.50) / 0.40, 0, 1);
                if (depthFade < 0.01) continue;
                const PIXEL = Math.max(1, Math.round(W / 280));
                ctx.globalAlpha = fl.alpha * depthFade;
                ctx.fillStyle = 'rgb(200,210,218)';
                ctx.fillRect(x0, y0, pw, PIXEL);
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // Wave crests
        {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            for (const cr of waveCrests) {
                cr.life += dt * 0.25;
                if (cr.life > cr.maxLife) { Object.assign(cr, makeCrest(0)); cr.life = 0; continue; }
                if (cr.life < 0) continue;
                const t   = cr.life / cr.maxLife;
                const env = t < 0.18 ? t / 0.18 : 1 - Math.pow((t - 0.18) / 0.82, 0.7);
                if (env < 0.01) continue;
                const cx = Math.round(cr.x * W);
                const cy = Math.round(cr.y * H);
                const rx = Math.round(cr.width  * W * 0.5 * (0.7 + env * 0.3));
                const ry = Math.max(1, Math.round(cr.height * H * env));
                const PIXEL  = Math.max(2, Math.round(W / 220));
                const bright = Math.round(lerp(185, 240, env));
                const barH   = Math.max(PIXEL, Math.round(PIXEL * 1.5));
                ctx.globalAlpha = cr.alpha * env;
                ctx.fillStyle = `rgb(${bright},${bright+5},${bright+10})`;
                ctx.fillRect(cx - rx, cy, rx * 2, barH);
                ctx.globalAlpha = cr.alpha * env * 0.5;
                ctx.fillStyle = `rgb(${Math.min(255,bright+20)},${Math.min(255,bright+25)},${Math.min(255,bright+28)})`;
                ctx.fillRect(cx - rx, cy, rx * 2, PIXEL);
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // Clouds
        {
            ctx.save();
            for (const cl of clouds) {
                cl.x -= cl.speed * dt;
                if (cl.x + cl.w < -0.05) cl.x = 1.05;
                const cx = cl.x * W, cy = cl.y * H;
                const cw = cl.w * W, ch = cl.h * W;
                if (cloudLoaded) {
                    ctx.globalAlpha = cl.alpha;
                    ctx.drawImage(cloudImg, cx - cw*0.5, cy - ch*0.5, cw, ch);
                } else {
                    for (const puff of cl.puffs) {
                        const px = cx + puff.ox * cw * 0.5;
                        const py = cy + puff.oy * ch * 0.5;
                        const pr = cw * 0.22 * puff.rs;
                        const grd = ctx.createRadialGradient(px,py,0,px,py,pr);
                        grd.addColorStop(0, `rgba(180,190,195,${cl.alpha*1.5})`);
                        grd.addColorStop(1, 'rgba(180,190,195,0)');
                        ctx.fillStyle = grd;
                        ctx.beginPath();
                        ctx.ellipse(px, py, pr, pr*0.55, 0, 0, Math.PI*2);
                        ctx.fill();
                    }
                }
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // Ripples
        {
            const rNow = performance.now();
            ripples = ripples.filter(r => (rNow - r.born) < RIPPLE_LIFE);
            ctx.save();
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            for (const rip of ripples) {
                const age   = rNow - rip.born;
                const lifeT = age / RIPPLE_LIFE;
                const fadeA = lifeT < 0.06 ? lifeT/0.06 : 1-Math.pow(lifeT,1.25);
                if (fadeA < 0.004) continue;
                const maxR  = H * RIPPLE_MAX_R;
                const RINGS = 5;
                const sqTime = elapsed * 0.0022 + rip.sqPhase;
                ctx.save();
                ctx.translate(rip.x, rip.y);
                for (let ring = 0; ring < RINGS; ring++) {
                    const ringDelay = (ring/RINGS)*0.35;
                    const ringT = clamp((lifeT-ringDelay)/(1-ringDelay),0,1);
                    if (ringT <= 0) continue;
                    const R     = maxR * ringT;
                    const hue   = rip.hueOffset + elapsed*0.012 + ring*28;
                    const lw    = Math.max(0.3, (1-ringT*0.65)*2.4);
                    const alpha = fadeA*(1-ringT*0.45)*(0.72-ring*0.06);
                    if (alpha < 0.004 || R < 1) continue;
                    const sqAmp  = R*(0.07+ringT*0.14);
                    const sqFreq = 2.7+ring*1.7;
                    const sqPh   = rip.sqPhase+ring*1.4;
                    const sqPh2  = rip.sqPhase2+ring*0.9;
                    ctx.save();
                    ctx.scale(rip.scaleX, rip.scaleY * (1 - ring * 0.04));
                    const arcS = Math.PI, arcE = Math.PI*2;
                    ctx.lineWidth = lw*8;    drawSquirmArc(ctx,R,arcS,arcE,sqAmp,sqFreq,sqTime,sqPh,sqPh2,alpha*0.10,hue);
                    ctx.lineWidth = lw*2.4;  drawSquirmArc(ctx,R,arcS,arcE,sqAmp,sqFreq,sqTime,sqPh,sqPh2,alpha*0.38,hue);
                    ctx.lineWidth = Math.max(0.4,lw*0.6); drawSquirmArc(ctx,R,arcS,arcE,sqAmp,sqFreq,sqTime,sqPh,sqPh2,alpha*0.80,(hue+35)%360);
                    const h2 = (hue+55+ring*18)%360, alpha2 = alpha*0.32;
                    if (alpha2 > 0.005) {
                        const arcS2 = Math.PI*1.12, arcE2 = Math.PI*1.88;
                        ctx.lineWidth = lw*1.6; drawSquirmArc(ctx,R*0.80,arcS2,arcE2,sqAmp*1.3,sqFreq+1,sqTime*1.2,sqPh2,sqPh,alpha2*0.36,h2);
                        ctx.lineWidth = Math.max(0.3,lw*0.45); drawSquirmArc(ctx,R*0.80,arcS2,arcE2,sqAmp*1.3,sqFreq+1,sqTime*1.2,sqPh2,sqPh,alpha2*0.78,(h2+25)%360);
                    }
                    ctx.restore();
                }
                ctx.restore();
            }
            ctx.restore();
        }

        // ── Boat ──────────────────────────────────────────────────────────────
        const cycMs    = elapsed % OAR_CYCLE;
        const inReady  = cycMs < READY_MS;
        const inStroke = !inReady && cycMs < READY_MS + STROKE_MS;
        const inReturn = !inReady && !inStroke;
        const strokeT  = inStroke ? (cycMs - READY_MS) / STROKE_MS : 0;
        const returnT  = inReturn ? (cycMs - READY_MS - STROKE_MS) / RETURN_MS : 0;
        const strokeEnv = inStroke ? Math.sin(strokeT * Math.PI) : 0;

        const baseRate   = 1 / (BOAT_DURATION / (1000/60));
        const coastRate  = inReturn ? lerp(0.55, 0.40, returnT) : 0.45;
        const surgeScale = inStroke ? (1.0 + strokeEnv * 1.1) : coastRate;
        boatProgress     = clamp(boatProgress + baseRate * surgeScale, 0, 1);

        const boatE = easeIO(boatProgress);
        const boatX = lerp(W*0.50, W*0.14, boatE);
        const boatY = lerp(H*0.48, H*0.82, boatE);

        // Yaw
        yawTimer += dt;
        if (!yawCorrect) {
            yawAngle += YAW_DRIFT * dt;
            if (yawAngle >= YAW_THRESH) { yawCorrect = true; suppressPort = true; }
        } else {
            yawAngle = Math.max(0, yawAngle - YAW_CORRECT * dt);
            if (yawAngle <= 0.005) { yawCorrect = false; suppressPort = false; yawAngle = 0; }
        }

        // Pitch from swell
        let swellY = 0;
        for (const w of waves) swellY += Math.sin(boatY/H * Math.PI * (1/w.wl) + w.phase) * w.amp * H * 0.4;
        const pitchAngle = Math.atan2(swellY * 0.012, 40);

        tickSounds(now, inStroke, strokeT, inReturn, returnT);

        if (inReturn && returnT < 0.04 && now - lastRipple > OAR_CYCLE * 0.8) {
            lastRipple = now;
            const prevE   = easeIO(Math.max(0, boatProgress - 0.005));
            const prevX   = lerp(W*0.50, W*0.14, prevE);
            const prevY   = lerp(H*0.48, H*0.82, prevE);
            const boatAng = Math.atan2(boatY - prevY, boatX - prevX);
            const behindDist = Math.max(1, Math.round((W/145) * lerp(0.22, 1.0, boatE))) * 14;
            const behindX = boatX - Math.cos(boatAng) * behindDist;
            const behindY = boatY - Math.sin(boatAng) * behindDist;
            spawnRipple(behindX - 12, behindY, boatAng);
            if (!suppressPort) spawnRipple(behindX + 12, behindY, boatAng);
        }

        const persp  = lerp(0.22, 1.0, boatE);
        const bAlpha = lerp(0.0, 1.0, clamp(boatE/0.10, 0, 1)) *
                       lerp(1.0, 0.0, clamp((boatE-0.88)/0.12, 0, 1));
        const SCALE  = Math.max(1, Math.round((W/145)*persp));
        const bw = BOAT_W*SCALE, bh = BOAT_H*SCALE;
        const bLeft = boatX - bw*0.5, bTop = boatY - bh;

        let pullAngle, liftY;
        if (inReady) {
            pullAngle = READY_ANGLE; liftY = SCALE * READY_LIFT;
        } else if (inStroke) {
            const sweepT = easeOut(easeIn(strokeT));
            pullAngle = lerp(CATCH_ANGLE, FINISH_ANGLE, sweepT); liftY = 0;
        } else {
            const liftT   = clamp(returnT/0.60, 0, 1);
            const settleT = clamp((returnT-0.60)/0.40, 0, 1);
            const peakLift = SCALE*READY_LIFT*1.3;
            liftY = returnT < 0.60
                ? lerp(0, peakLift, easeOut(liftT))
                : lerp(peakLift, SCALE*READY_LIFT, easeIn(settleT));
            pullAngle = lerp(FINISH_ANGLE, READY_ANGLE, easeIO(returnT));
        }

        const oAlpha = clamp(persp*2.2, 0, 1) * bAlpha;

        // Hull reflection
        if (bAlpha > 0.02) {
            ctx.save();
            ctx.globalAlpha = 0.06*(boatE*0.6+0.4)*bAlpha;
            ctx.translate(bLeft, bTop+bh+1); ctx.scale(1, -0.14);
            for (let row=0; row<BOAT_H; row++)
                for (let col=0; col<BOAT_W; col++)
                    if (BOAT_PIXELS[row][col]==='1') {
                        ctx.fillStyle = `rgba(${sr+14},${sg+17},${sb+22},1)`;
                        ctx.fillRect(col*SCALE, row*SCALE, SCALE, SCALE);
                    }
            ctx.restore();
        }

        ctx.save();
        ctx.translate(boatX, boatY - bh*0.5);
        ctx.rotate(pitchAngle + yawAngle * 0.4);
        ctx.translate(-boatX, -(boatY - bh*0.5));

        function drawOar(frac, dir, suppress) {
            if (oAlpha < 0.01) return;
            ctx.save();
            ctx.globalAlpha = oAlpha;
            const oAngle = suppress ? READY_ANGLE : pullAngle;
            const oLift  = suppress ? SCALE * READY_LIFT : liftY;
            ctx.translate(bLeft + bw*frac, bTop + bh*0.38 - oLift);
            ctx.rotate(oAngle * dir);
            ctx.strokeStyle = '#050810';
            ctx.lineWidth   = Math.max(1, SCALE*0.55);
            ctx.beginPath();
            ctx.moveTo(-dir*SCALE*7, -SCALE*0.8);
            ctx.lineTo( dir*SCALE*13,  SCALE*2.4);
            ctx.stroke();
            ctx.fillStyle = '#050810';
            ctx.beginPath();
            ctx.ellipse(dir*SCALE*13, SCALE*2.4, SCALE*1.4, SCALE*0.48, oAngle*dir*0.4, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-dir*SCALE*7, -SCALE*0.8, Math.max(1,SCALE*0.7), 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
        drawOar(0.26, -1, suppressPort);
        drawOar(0.74,  1, false);

        if (bAlpha > 0.01) {
            ctx.globalAlpha = bAlpha;
            for (let row=0; row<BOAT_H; row++)
                for (let col=0; col<BOAT_W; col++)
                    if (BOAT_PIXELS[row][col]==='1') {
                        ctx.fillStyle = '#040709';
                        ctx.fillRect(Math.round(bLeft+col*SCALE), Math.round(bTop+row*SCALE), SCALE, SCALE);
                    }
            ctx.globalAlpha = 1;
        }
        ctx.restore();

        // Splash bursts
        {
            if (elapsed >= nextSplashAt) fireSplash(elapsed);
            ctx.save();
            splashParticles = splashParticles.filter(p => p.life <= p.maxLife);
            for (const p of splashParticles) {
                p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
                p.vy  += 0.0000018 * dt;
                const lifeT = p.life / p.maxLife;
                const alpha = lifeT < 0.12 ? lifeT / 0.12 : 1 - Math.pow(lifeT, 1.6);
                if (alpha < 0.01) continue;
                const brightness = Math.round(lerp(210, 245, 1 - lifeT));
                ctx.globalAlpha = alpha * 0.75;
                ctx.fillStyle   = `rgb(${brightness},${brightness+3},${brightness+6})`;
                ctx.beginPath();
                ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // Vignette
        const vig = ctx.createRadialGradient(W*0.5, H*0.5, H*0.07, W*0.5, H*0.5, H*0.95);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, `rgba(2,4,6,${lerp(0.72, 0.42, colE)})`);
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

        canvas.style.transform = `skewX(${Math.sin(elapsed*0.00031)*0.0012}rad) skewY(${Math.cos(elapsed*0.00022)*0.0008}rad)`;
    }

    rafId = requestAnimationFrame(draw);
}

