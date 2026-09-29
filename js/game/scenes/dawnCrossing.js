// dawnCrossing.js  — v12 (the world is crossing/seaWorld.js)
// Call: initDawnCrossing(champion, sliderValue, onComplete)
import { transitionOut, transitionIn } from '../ui/sceneTransition.js'
import { FONTS, SPACING, TYPE, COLORS, NARRATOR_GLOW, createDomButton } from '../systems/gameTypography.js';
import { GameSettings } from '../settings/gameSettings.js';
import { createMoonWidget } from '../ui/moonWidget.js';
import { createContrast } from '../ui/textContrast.js';
import { createSeaWorld, DAWN } from './crossing/seaWorld.js';

const clamp  = (x, a, b) => x < a ? a : x > b ? b : x;

export function initDawnCrossing(champion, sliderValue, onComplete) {
    let moonPhase = typeof sliderValue === 'number' ? sliderValue : (GameSettings.englishOpacity ?? 0.15);
    GameSettings.setEnglishOpacity(moonPhase);

    const container = document.createElement('div');
    container.id = 'dawnCrossing';
    container.style.cssText = [
        'position:fixed;inset:0;z-index:999999;',
        'overflow:hidden;pointer-events:all;background:#020408;touch-action:none;',
    ].join('');
    document.body.appendChild(container);

    const gaFontPx = TYPE.domBody.sizePx;
    const enFontPx = TYPE.domBodyEn.sizePx;
    const SCENE_IRISH_COLOR = COLORS.narrator;     // the narrator: same voice, same look, both crossings
    const SCENE_EN_COLOR    = '#9ab4c8';

    const fontOverride = document.createElement('style');
    fontOverride.id = 'dawnCrossingFontOverride';
    fontOverride.textContent = `
        #dawnCrossing div div div:first-child {
            font-size:${gaFontPx}px !important;
            color:${SCENE_IRISH_COLOR} !important;
            line-height:${SPACING.irishLineHeight} !important;
            text-shadow:${NARRATOR_GLOW} !important;
        }
        #dawnCrossing div div div:nth-child(2) {
            font-size:${enFontPx}px !important;
            color:${SCENE_EN_COLOR} !important;
            font-family:${FONTS.english} !important;
            line-height:${SPACING.englishLineHeight} !important;
            text-shadow:none !important;   /* the colour itself contrasts (ui/textContrast.js) */
        }
    `;
    document.head.appendChild(fontOverride);

    // Moon widget — bottom-centre, position matched to dpad hub
    const moonWidget = createMoonWidget({
        initialPhase : moonPhase,
        showSlider   : false,
        corner       : 'bottom-center',
        onChange     : (phase) => {
            moonPhase = phase;
            GameSettings.setEnglishOpacity(phase);
        },
    });
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
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);


    // ── Audio ──────────────────────────────────────────────────────────────────

    let boatAC    = null;
    let masterOut = null;
    let lastCreak = 0;
    let lastDrip  = 0;
    let lastBubble  = 0;
    let lastOminous = 0;

    function ensureAudio() {
        if (boatAC) return true;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            boatAC   = new AC();
            masterOut = boatAC.createGain();
            masterOut.gain.value = 0.55;
            masterOut.connect(boatAC.destination);
            if (boatAC.state === 'suspended') boatAC.resume();
            return true;
        } catch(e) { return false; }
    }

    let _noiseBuf = null;
    function getNoiseBuf() {
        if (_noiseBuf) return _noiseBuf;
        if (!boatAC) return null;
        const sr  = boatAC.sampleRate;
        const buf = boatAC.createBuffer(1, sr * 2, sr);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        _noiseBuf = buf;
        return buf;
    }

    function playWaterRush(intensity) {
        if (!ensureAudio()) return;
        const ac = boatAC, now = ac.currentTime;
        const buf = getNoiseBuf(); if (!buf) return;
        const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
        const bp  = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 1.8;
        const bp2 = ac.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 720; bp2.Q.value = 2.4;
        const g = ac.createGain(), g2 = ac.createGain();
        src.connect(bp); bp.connect(g); g.connect(masterOut);
        src.connect(bp2); bp2.connect(g2); g2.connect(masterOut);
        const vol = 0.18 + intensity * 0.22;
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + 0.04); g.gain.exponentialRampToValueAtTime(0.001, now + 0.9 + intensity * 0.4);
        g2.gain.setValueAtTime(0, now); g2.gain.linearRampToValueAtTime(vol * 0.4, now + 0.06); g2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        src.start(now); src.stop(now + 1.4);
    }

    function playCreak() {
        if (!ensureAudio()) return;
        const ac = boatAC, now = ac.currentTime;
        const osc1 = ac.createOscillator(); osc1.type = 'sine';
        osc1.frequency.setValueAtTime(110 + Math.random() * 40, now);
        osc1.frequency.exponentialRampToValueAtTime(48, now + 0.18);
        const buf = getNoiseBuf(); const src = ac.createBufferSource(); src.buffer = buf;
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900; hp.Q.value = 0.8;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.6;
        const g1 = ac.createGain(), g2 = ac.createGain();
        osc1.connect(g1); g1.connect(masterOut);
        src.connect(hp); hp.connect(lp); lp.connect(g2); g2.connect(masterOut);
        g1.gain.setValueAtTime(0, now); g1.gain.linearRampToValueAtTime(0.28, now + 0.008); g1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        g2.gain.setValueAtTime(0, now); g2.gain.linearRampToValueAtTime(0.12, now + 0.004); g2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc1.start(now); osc1.stop(now + 0.25); src.start(now); src.stop(now + 0.1);
    }

    function playDrip() {
        if (!ensureAudio()) return;
        const ac = boatAC, now = ac.currentTime;
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const delay = i * (0.04 + Math.random() * 0.06);
            const freq  = 1800 + Math.random() * 900;
            const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
            const g = ac.createGain(); osc.connect(g); g.connect(masterOut);
            g.gain.setValueAtTime(0, now + delay); g.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.04, now + delay + 0.004); g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);
            osc.start(now + delay); osc.stop(now + delay + 0.2);
        }
    }

    function playBubble() {
        if (!ensureAudio()) return;
        const ac = boatAC, now = ac.currentTime;
        const count = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            const delay = i * (0.06 + Math.random() * 0.14);
            const freq  = 180 + Math.random() * 220;
            const osc = ac.createOscillator(); osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            osc.frequency.linearRampToValueAtTime(freq * 1.6, now + delay + 0.08);
            const g = ac.createGain(); osc.connect(g); g.connect(masterOut);
            g.gain.setValueAtTime(0, now + delay); g.gain.linearRampToValueAtTime(0.07 + Math.random() * 0.05, now + delay + 0.012); g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.22 + Math.random() * 0.18);
            osc.start(now + delay); osc.stop(now + delay + 0.45);
        }
    }

    function playOminousCreak() {
        if (!ensureAudio()) return;
        const ac = boatAC, now = ac.currentTime;
        for (const [baseFreq, vol, dur] of [[62, 0.32, 1.8], [124, 0.10, 1.2], [186, 0.04, 0.7]]) {
            const osc = ac.createOscillator(); osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(baseFreq + Math.random() * 8, now);
            osc.frequency.linearRampToValueAtTime(baseFreq * 0.72, now + dur);
            const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 3.5;
            const g = ac.createGain(); osc.connect(lp); lp.connect(g); g.connect(masterOut);
            g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + 0.06); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.start(now); osc.stop(now + dur + 0.1);
        }
    }

    function tickSounds(now, inStroke, strokeT, inReturn, returnT) {
        if (inStroke && strokeT < 0.08) playWaterRush(0.5 + strokeT * 3);
        if (now - lastCreak > 6000 && Math.random() < 0.0008) { lastCreak = now; playCreak(); }
        if (inReturn && returnT < 0.22 && now - lastDrip > 5000 && Math.random() < 0.04) { lastDrip = now; playDrip(); }
        if (now - lastBubble > 4000 && Math.random() < 0.0012) { lastBubble = now; playBubble(); }
        if (!inStroke && now - lastOminous > 12000 && Math.random() < 0.0004) { lastOminous = now; playOminousCreak(); }
    }

    const contrast = createContrast()

    // ── Scene text ─────────────────────────────────────────────────────────────

    const DAWN_TEXTS_PATH     = new URL('/data/dawnCrossingTexts.js',  import.meta.url).href;
    const SCROLLING_TEXT_PATH = new URL('/ui/scrollingTextPlayer.js',  import.meta.url).href;
    let textPlayer = null;
    let sceneDone  = false;

    const textTimer = setTimeout(async () => {
        try {
            const [stMod, txtMod] = await Promise.all([
                import(SCROLLING_TEXT_PATH),
                import(DAWN_TEXTS_PATH),
            ]);
            const { ScrollingTextPlayer } = stMod;
            const { dawnCrossingTexts   } = txtMod;
            textPlayer = new ScrollingTextPlayer({
                lines:        dawnCrossingTexts.crossing,
                getMoonPhase: () => GameSettings.englishOpacity,
                onComplete:   () => {},
                container,
            });
            textPlayer.start();

            const DAWN_PX_PER_MS = 50 / 1000;

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
                    const natural = DAWN_PX_PER_MS;
                    if (Math.abs(this._velocity - natural) > 0.0001) {
                        const a = 1 - Math.exp(-dt / 200);
                        this._velocity += (natural - this._velocity) * a;
                        if (this._velocity > -natural && this._velocity < natural) this._velocity = natural;
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
                const CEIL   = 58 + 8;
                const FADEPX = 80;
                const BOTTOM_FADE_FRAC = 0.18;

                for (let i = 0; i < this._lineEls.length; i++) {
                    const entry  = this._lineEls[i];
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
                    if (bottom > H2 * (1 - BOTTOM_FADE_FRAC))
                        alpha = Math.min(alpha, Math.max(0, (H2 - y) / (H2 * BOTTOM_FADE_FRAC)));

                    entry.gaEl.style.opacity = String(alpha);
                    if (entry.enEl) {
                        entry.enEl.style.opacity = String(alpha * mp);
                        // pick an ink that contrasts with the scene behind it
                        const el = entry.enEl
                        contrast.update(el, [canvas], () => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })
                    }

                }
            };

            textPlayer._naturalVel = DAWN_PX_PER_MS;
            textPlayer._velocity   = DAWN_PX_PER_MS;
            textPlayer._ceilingY       = 999999;
            textPlayer._onReachCeiling = function() {};
            textPlayer._onComplete     = function() {};

            if (textPlayer._hitZone) {
                textPlayer._hitZone.style.top    = '0px';
                textPlayer._hitZone.style.height = (window.innerHeight) + 'px';
                textPlayer._hitZone.style.bottom = '';
            }

            const origGestureEnd = textPlayer._gestureEnd.bind(textPlayer);
            textPlayer._gestureEnd = function(endY, wasTap) {
                origGestureEnd(endY, wasTap);
                if (!wasTap && !this._atCeiling) {
                    if (this._velocity > -this._naturalVel && this._velocity < this._naturalVel)
                        this._velocity = this._naturalVel;
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
            console.error('[dawnCrossing] Text modules failed.\n', e);
        }
    }, 2000);

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

    // The crossing ends when the poem's last line has scrolled away -- however
    // long the player lingers, scrubbing back to read. The only timer is a
    // failsafe in case the poem never loaded at all.
    const hardCap = setTimeout(() => { if (!sceneDone && !textPlayer) beginExit(); }, 20000);

    // ── Exit ───────────────────────────────────────────────────────────────────

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
            'background:#adb5be;opacity:0;transition:opacity 2.8s ease;pointer-events:none;',
        ].join('');
        document.body.appendChild(veil);
        setTimeout(() => {
            cancelAnimationFrame(rafId);
            requestAnimationFrame(() => { veil.style.opacity = '1'; });
            transitionOut(2800);
        }, 500);
        setTimeout(() => {
            container.remove();
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
            console.log('[dawnCrossing] calling onComplete, gameContainer:',
                document.getElementById('gameContainer')?.style.display);
            if (onComplete) onComplete();
        }, 3900);
    }

    // ── The crossing itself: the shared sea world (crossing/seaWorld.js) ──────
    // Everything visual -- the sea, the rower, the stroke, the ripples, Skye
    // rising out of the dawn -- is the DAWN journey there.
    const world = createSeaWorld({ canvas, ctx, champion, tickSounds, config: DAWN })
    let rafId = null
    function draw(now) {
        rafId = requestAnimationFrame(draw)
        world.draw(now)
    }

    rafId = requestAnimationFrame(draw);
}

