// dawnCrossing.js  — v10
// Call: initDawnCrossing(champion, sliderValue, onComplete)
import { transitionOut, transitionIn } from '../ui/sceneTransition.js'
import { FONTS, SPACING, TYPE, createDomButton } from '../systems/gameTypography.js';
import { GameSettings } from '../settings/gameSettings.js';
import { createMoonWidget } from '../ui/moonWidget.js';
import { VoiceSynth, championVoice, championTuneKey } from '../systems/voice/voiceSynth.js';
import { allTunes } from '../systems/music/allTunes.js';

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

const READY_MS  = 1800;
const STROKE_MS = 1200;
const RETURN_MS =  900;
const OAR_CYCLE = READY_MS + STROKE_MS + RETURN_MS;

const READY_ANGLE  = -0.44;
const CATCH_ANGLE  = -0.44;
const FINISH_ANGLE =  0.40;
const READY_LIFT   =  2.4;

const rnd    = (a, b) => a + Math.random() * (b - a);
const clamp  = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp   = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
const easeIO = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
const easeOut = t => 1 - (1-clamp(t,0,1))*(1-clamp(t,0,1));
const easeIn  = t => clamp(t,0,1)*clamp(t,0,1);

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
    const SCENE_IRISH_COLOR = '#e8c84a';
    const SCENE_EN_COLOR    = '#9ab4c8';

    const fontOverride = document.createElement('style');
    fontOverride.id = 'dawnCrossingFontOverride';
    fontOverride.textContent = `
        #dawnCrossing div div div:first-child {
            font-size:${gaFontPx}px !important;
            color:${SCENE_IRISH_COLOR} !important;
            line-height:${SPACING.irishLineHeight} !important;
            text-shadow:
                0 0 22px rgba(240,180,20,0.9),
                0 0  8px rgba(200,140,0,0.7),
                1px  1px 0 rgba(60,30,0,0.8),
               -1px -1px 0 rgba(60,30,0,0.8),
                1px -1px 0 rgba(60,30,0,0.8),
               -1px  1px 0 rgba(60,30,0,0.8) !important;
        }
        #dawnCrossing div div div:nth-child(2) {
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

    const SCENE_DURATION = 95000;
    const STAR_FADE_END  = 44000;
    const SEA_DAWN_END   = 74000;
    const BOAT_DURATION  = 88000;

    const stars = Array.from({ length: 520 }, () => {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.pow(Math.random(), 0.6);
        return {
            x: 0.5 + Math.cos(ang) * rad * 0.52,
            y: 0.5 + Math.sin(ang) * rad * 0.52,
            r: rnd(0.15, 1.6),
            base: rnd(0.08, 0.62),
            ts: rnd(0.0003, 0.0014),
            to: rnd(0, Math.PI * 2),
            swirlAng: ang,
            swirlRad: rad * 0.52,
            swirlSpd: rnd(0.000008, 0.000028) * (Math.random() < 0.5 ? 1 : -1),
        };
    });

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
            // Trigger a distress interjection on the ominous creak — adds to atmosphere
            if (voiceSynth && Math.random() < 0.4) {
                voiceSynth.interject('distress', { voice: _voiceId, tuneKey: _voiceTuneKey })
            }
        }
    }

    function tickSounds(now, inStroke, strokeT, inReturn, returnT) {
        if (inStroke && strokeT < 0.08) playWaterRush(0.5 + strokeT * 3);
        if (now - lastCreak > 6000 && Math.random() < 0.0008) { lastCreak = now; playCreak(); }
        if (inReturn && returnT < 0.22 && now - lastDrip > 5000 && Math.random() < 0.04) { lastDrip = now; playDrip(); }
        if (now - lastBubble > 4000 && Math.random() < 0.0012) { lastBubble = now; playBubble(); }
        if (!inStroke && now - lastOminous > 12000 && Math.random() < 0.0004) { lastOminous = now; playOminousCreak(); }
    }

    // ── Voice synthesis ────────────────────────────────────────────────────────
    // Shares boatAC — one AudioContext for the whole scene.
    // Created lazily on first ensureAudio() call, same as boat sounds.

    let voiceSynth    = null;
    let _voiceId      = null;
    let _voiceTuneKey = null;
    const _spokenLines = new Set();

    function initVoice() {
        if (voiceSynth || !boatAC) return;
        try {
            _voiceId      = championVoice(champion);
            _voiceTuneKey = championTuneKey(champion, allTunes);
            voiceSynth    = new VoiceSynth({
                audioContext: boatAC,
                masterGain:   masterOut,
                volume:       0.78,
            });
            console.log(`[dawnCrossing] voice=${_voiceId} tuneKey=${_voiceTuneKey}`);
        } catch(e) {
            console.warn('[dawnCrossing] VoiceSynth init failed:', e);
        }
    }

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
                    if (entry.enEl) entry.enEl.style.opacity = String(alpha * mp);

                    // ── Voice trigger ─────────────────────────────────────────
                    // Speak each line once, when it first reaches ≥30% opacity.
                    // initVoice() is called here so boatAC is guaranteed ready.
                    
if (!_spokenLines.has(i) && alpha >= 0.75) {
                        _spokenLines.add(i);
                        initVoice();
                        if (voiceSynth) {
                            const line = this._lines[i];
                            setTimeout(() => {
                                if (voiceSynth && !sceneDone) {
                                    voiceSynth.speak(line.ga, {
                                        voice:   _voiceId,
                                        tuneKey: _voiceTuneKey,
                                    });
                                }
                            }, 300);
                        }
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

    const hardCap = setTimeout(() => { if (!sceneDone) beginExit(); }, SCENE_DURATION);

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

        // Fade out and destroy voice synth
        if (voiceSynth) {
            voiceSynth.fadeOut(2000);
            setTimeout(() => { try { voiceSynth.destroy(); } catch(e){} voiceSynth = null; }, 2200);
        }

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

    // ── Ripples ────────────────────────────────────────────────────────────────

    const RIPPLE_LIFE  = 11000;
    const RIPPLE_MAX_R = 0.30;
    const RIPPLE_SETS  = 10;
    let ripples    = [];
    let lastRipple = 0;

    function rippleColor(hue, alpha) { return `hsla(${(hue%360).toFixed(1)},44%,74%,${alpha.toFixed(3)})`; }

    function spawnRipple(x, y, angle) {
        if (ripples.length >= RIPPLE_SETS) ripples.shift();
        ripples.push({ x, y, born: performance.now(), angle, hueOffset: Math.random() * 360, scaleX: 0.85 + Math.random() * 0.18, scaleY: 0.38 + Math.random() * 0.14, sqPhase: Math.random() * Math.PI * 2, sqPhase2: Math.random() * Math.PI * 2 });
    }

    function drawSquirmArc(ctx, R, startAngle, endAngle, sqAmp, sqFreq, sqTime, sqPh, sqPh2, baseAlpha, hue) {
        const STEPS = 52, FADE_END = 0.18;
        for (let s = 0; s < STEPS; s++) {
            const t0 = s / STEPS;
            const endFade0 = t0 < FADE_END ? t0 / FADE_END : t0 > 1 - FADE_END ? (1 - t0) / FADE_END : 1;
            const segAlpha = baseAlpha * endFade0;
            if (segAlpha < 0.003) continue;
            const a0 = startAngle + (endAngle - startAngle) * t0;
            const a1 = startAngle + (endAngle - startAngle) * (t0 + 1/STEPS);
            const sq0 = sqAmp * (Math.sin(sqFreq*a0 + sqTime*1.1 + sqPh)*0.65 + Math.sin(sqFreq*a0*3 + sqTime*0.7 + sqPh2)*0.35);
            const sq1 = sqAmp * (Math.sin(sqFreq*a1 + sqTime*1.1 + sqPh)*0.65 + Math.sin(sqFreq*a1*3 + sqTime*0.7 + sqPh2)*0.35);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a0)*(R+sq0), Math.sin(a0)*(R+sq0));
            ctx.lineTo(Math.cos(a1)*(R+sq1), Math.sin(a1)*(R+sq1));
            ctx.strokeStyle = rippleColor(hue, segAlpha);
            ctx.stroke();
        }
    }

    // ── Skye image ─────────────────────────────────────────────────────────────

    const skyeImg = new Image();
    skyeImg.src = 'assets/skye0.png';
    let skyeLoaded = false;
    skyeImg.onload  = () => { skyeLoaded = true; };
    skyeImg.onerror = () => { console.warn('[dawnCrossing] skye0.png not found'); };

    // ── Draw loop ──────────────────────────────────────────────────────────────

    const startTime    = performance.now();
    let   rafId        = null;
    let   boatProgress = 0;

    function draw(now) {
        rafId = requestAnimationFrame(draw);
        const W = canvas.width, H = canvas.height;
        const elapsed = now - startTime;

        const colT = clamp(elapsed / SEA_DAWN_END, 0, 1);
        const colE = easeIO(colT);
        const sr = colT < 0.5 ? lerp(2,  50, colT*2) : lerp(50, 138, (colT-0.5)*2);
        const sg = colT < 0.5 ? lerp(4,  62, colT*2) : lerp(62, 148, (colT-0.5)*2);
        const sb = colT < 0.5 ? lerp(10, 80, colT*2) : lerp(80, 158, (colT-0.5)*2);

        ctx.fillStyle = `rgb(${Math.round(sr)},${Math.round(sg)},${Math.round(sb)})`;
        ctx.fillRect(0, 0, W, H);

        for (let i = 0; i < 180; i++) {
            const fy = i/180, y = fy*H;
            const ir = sr + Math.sin(fy*11.4 + elapsed*0.00042) * (5+colE*8);
            const ig = sg + Math.sin(fy*7.2  + elapsed*0.00037 + 1.2) * (7+colE*10);
            const ib = sb + Math.cos(fy*9.5  + elapsed*0.00051 + fy*0.5) * (9+colE*12);
            const dx = Math.sin(fy*5.3 + elapsed*0.00045 + i*0.07) * (fy*4);
            ctx.fillStyle = `rgba(${Math.round(clamp(ir,0,255))},${Math.round(clamp(ig,0,255))},${Math.round(clamp(ib,0,255))},0.22)`;
            ctx.fillRect(Math.round(dx), Math.round(y), W+6, Math.ceil(H/180+1));
        }

        const starFadeT = clamp(elapsed / STAR_FADE_END, 0, 1);
        const starAlpha = 1 - easeIO(starFadeT);
        if (starAlpha > 0.003) {
            const swirlSpd = Math.max(0, 1 - starFadeT * 1.1);
            for (const s of stars) {
                s.swirlAng += s.swirlSpd * swirlSpd;
                s.x = 0.5 + Math.cos(s.swirlAng) * s.swirlRad;
                s.y = 0.5 + Math.sin(s.swirlAng) * s.swirlRad;
                const tw = 0.55 + 0.45 * Math.sin(elapsed * s.ts + s.to);
                const rC = Math.round(lerp(235, 168, starFadeT));
                const gC = Math.round(lerp(240, 182, starFadeT));
                ctx.beginPath();
                ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${rC},${gC},255,${s.base * tw * starAlpha})`;
                ctx.fill();
            }
        }

        if (skyeLoaded) {
            const skyeT     = clamp((elapsed - SCENE_DURATION*0.45) / (SCENE_DURATION*0.5), 0, 1);
            const skyeAlpha = skyeT * 0.20;
            if (skyeAlpha > 0.001) {
                const aspect = skyeImg.naturalWidth / skyeImg.naturalHeight;
                const skyeW  = W, skyeH = skyeW / aspect;
                ctx.save(); ctx.globalAlpha = skyeAlpha;
                ctx.drawImage(skyeImg, 0, 52, skyeW, skyeH);
                ctx.restore();
            }
        }

        {
            const rNow = performance.now();
            ripples = ripples.filter(r => (rNow - r.born) < RIPPLE_LIFE);
            ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            for (const rip of ripples) {
                const age = rNow - rip.born, lifeT = age / RIPPLE_LIFE;
                const fadeA = lifeT < 0.06 ? lifeT / 0.06 : 1 - Math.pow(lifeT, 1.25);
                if (fadeA < 0.004) continue;
                const maxR = H * RIPPLE_MAX_R, RINGS = 6;
                const sqTime = elapsed * 0.0022 + rip.sqPhase;
                ctx.save(); ctx.translate(rip.x, rip.y); ctx.scale(rip.scaleX, rip.scaleY);
                for (let ring = 0; ring < RINGS; ring++) {
                    const ringDelay = (ring / RINGS) * 0.35;
                    const ringT = clamp((lifeT - ringDelay) / (1 - ringDelay), 0, 1);
                    if (ringT <= 0) continue;
                    const R = maxR * ringT, hue = rip.hueOffset + elapsed * 0.018 + ring * 32;
                    const lw = Math.max(0.3, (1 - ringT * 0.65) * 2.4);
                    const alpha = fadeA * (1 - ringT * 0.45) * (0.58 - ring * 0.055);
                    if (alpha < 0.004 || R < 1) continue;
                    const sqAmp = R * (0.08 + ringT * 0.16), sqFreq = 2.7 + ring * 1.7;
                    const sqPh = rip.sqPhase + ring * 1.4, sqPh2 = rip.sqPhase2 + ring * 0.9;
                    const arcS = 0, arcE = Math.PI;
                    ctx.lineWidth = lw * 8;  drawSquirmArc(ctx, R, arcS, arcE, sqAmp, sqFreq, sqTime, sqPh, sqPh2, alpha * 0.11, hue);
                    ctx.lineWidth = lw * 2.4; drawSquirmArc(ctx, R, arcS, arcE, sqAmp, sqFreq, sqTime, sqPh, sqPh2, alpha * 0.40, hue);
                    ctx.lineWidth = Math.max(0.4, lw * 0.6); drawSquirmArc(ctx, R, arcS, arcE, sqAmp, sqFreq, sqTime, sqPh, sqPh2, alpha * 0.88, (hue+35)%360);
                    const h2 = (hue + 55 + ring * 18) % 360, alpha2 = alpha * 0.35;
                    if (alpha2 > 0.005) {
                        const arcS2 = Math.PI * 0.12, arcE2 = Math.PI * 0.88;
                        ctx.lineWidth = lw * 1.6; drawSquirmArc(ctx, R*0.80, arcS2, arcE2, sqAmp*1.3, sqFreq+1, sqTime*1.2, sqPh2, sqPh, alpha2*0.38, h2);
                        ctx.lineWidth = Math.max(0.3, lw * 0.45); drawSquirmArc(ctx, R*0.80, arcS2, arcE2, sqAmp*1.3, sqFreq+1, sqTime*1.2, sqPh2, sqPh, alpha2*0.82, (h2+25)%360);
                    }
                }
                ctx.restore();
            }
            ctx.restore();
        }

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
        const boatX = lerp(W*0.50, W*0.82, boatE);
        const boatY = lerp(H*0.82, H*0.38, boatE);

        tickSounds(now, inStroke, strokeT, inReturn, returnT);

        if (inReturn && returnT < 0.04 && now - lastRipple > OAR_CYCLE * 0.8) {
            lastRipple = now;
            const boatAngle = Math.atan2(
                boatY - lerp(H*0.82, H*0.38, easeIO(Math.max(0, boatProgress-0.005))),
                boatX - lerp(W*0.50, W*0.82, easeIO(Math.max(0, boatProgress-0.005)))
            );
            spawnRipple(boatX - 16, boatY + 5, boatAngle);
            spawnRipple(boatX + 16, boatY + 5, boatAngle);
        }

        const persp  = lerp(1.0, 0.22, boatE);
        const bAlpha = lerp(1.0, 0.0, clamp((boatE-0.68)/0.32, 0, 1));
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
            const liftT   = clamp(returnT / 0.60, 0, 1);
            const settleT = clamp((returnT - 0.60) / 0.40, 0, 1);
            const peakLift = SCALE * READY_LIFT * 1.3;
            liftY = returnT < 0.60 ? lerp(0, peakLift, easeOut(liftT)) : lerp(peakLift, SCALE * READY_LIFT, easeIn(settleT));
            pullAngle = lerp(FINISH_ANGLE, READY_ANGLE, easeIO(returnT));
        }

        const oAlpha = clamp(persp*2.2, 0, 1) * bAlpha;

        if (bAlpha > 0.02) {
            ctx.save(); ctx.globalAlpha = 0.07*(1-boatE*0.4)*bAlpha;
            ctx.translate(bLeft, bTop+bh+1); ctx.scale(1, -0.14);
            for (let row=0; row<BOAT_H; row++)
                for (let col=0; col<BOAT_W; col++)
                    if (BOAT_PIXELS[row][col]==='1') {
                        ctx.fillStyle = `rgba(${Math.round(sr+14)},${Math.round(sg+17)},${Math.round(sb+22)},1)`;
                        ctx.fillRect(col*SCALE, row*SCALE, SCALE, SCALE);
                    }
            ctx.restore();
        }

        function drawOar(frac, dir) {
            if (oAlpha < 0.01) return;
            ctx.save(); ctx.globalAlpha = oAlpha;
            ctx.translate(bLeft + bw*frac, bTop + bh*0.55 - liftY);
            ctx.rotate(pullAngle * dir);
            ctx.strokeStyle = '#050810'; ctx.lineWidth = Math.max(1, SCALE*0.55);
            ctx.beginPath();
            ctx.moveTo(-dir*SCALE*7, -SCALE*0.8);
            ctx.lineTo( dir*SCALE*13, SCALE*2.4);
            ctx.stroke();
            ctx.fillStyle = '#050810';
            ctx.beginPath();
            ctx.ellipse(dir*SCALE*13, SCALE*2.4, SCALE*1.4, SCALE*0.48, pullAngle*dir*0.4, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-dir*SCALE*7, -SCALE*0.8, Math.max(1, SCALE*0.7), 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
        drawOar(0.26, -1); drawOar(0.74, 1);

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

        canvas.style.transform = `skewX(${Math.sin(elapsed*0.00033)*0.0014}rad) skewY(${Math.cos(elapsed*0.00024)*0.0009}rad)`;

        const vig = ctx.createRadialGradient(W*0.5, H*0.5, H*0.07, W*0.5, H*0.5, H*0.95);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, `rgba(1,2,5,${lerp(0.70, 0.16, colE)})`);
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    rafId = requestAnimationFrame(draw);
}

