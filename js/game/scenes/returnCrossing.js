// returnCrossing.js — v3 (the world is crossing/seaWorld.js, RETURN)
// Call: initReturnCrossing(champion, sliderValue, onComplete)
//
// The return journey: Skye -> Eire on a grey, windy, ominous day. Skye at
// the top, receding into the murk; Ireland below us, offscreen. The boat
// rows toward us out of the grey, bow first, the rower's back to us (a
// generated back view, silhouetted against the light), through a lifting
// swell, rain on the wind.
import { transitionOut, transitionIn } from '../ui/sceneTransition.js'
import { FONTS, COLORS, SPACING, TYPE, NARRATOR_GLOW, createDomButton } from '../systems/gameTypography.js';
import { GameSettings } from '../settings/gameSettings.js';
import { createMoonWidget } from '../ui/moonWidget.js';
import { createContrast } from '../ui/textContrast.js';
import { createSeaWorld, RETURN } from './crossing/seaWorld.js';

// used by the sound hooks (tickSounds); the world has its own helpers
const rnd = (a, b) => a + Math.random() * (b - a);

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
    const gaFontPx = TYPE.domBody.sizePx;
    const enFontPx = TYPE.domBodyEn.sizePx;

    const SCENE_IRISH_COLOR = COLORS.narrator;     // the narrator: same voice, same look, both crossings
    const SCENE_EN_COLOR    = '#8a9a8e';

    const fontOverride = document.createElement('style');
    fontOverride.id = 'returnCrossingFontOverride';
    fontOverride.textContent = `
        #returnCrossing div div div:first-child {
            font-size:${gaFontPx}px !important;
            color:${SCENE_IRISH_COLOR} !important;
            line-height:${SPACING.irishLineHeight} !important;
            text-shadow:${NARRATOR_GLOW} !important;
        }
        #returnCrossing div div div:nth-child(2) {
            font-size:${enFontPx}px !important;
            color:${SCENE_EN_COLOR} !important;
            font-family:${FONTS.english} !important;
            line-height:${SPACING.englishLineHeight} !important;
            text-shadow:none !important;   /* the colour itself contrasts (ui/textContrast.js) */
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

    // ── Canvas ────────────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.insertBefore(canvas, container.firstChild);
    const ctx = canvas.getContext('2d');

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    const contrast = createContrast()

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
                    if (entry.enEl) {
                        entry.enEl.style.opacity = String(alpha * mp);
                        const el = entry.enEl
                        contrast.update(el, [canvas], () => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })
                    }
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

    // The crossing ends when the poem's last line has scrolled away -- however
    // long the player lingers, scrubbing back to read. The only timer is a
    // failsafe in case the poem never loaded at all.
    const hardCap = setTimeout(() => { if (!sceneDone && !textPlayer) beginExit(); }, 20000);

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

    // ── Rain ───────────────────────────────────────────────────────────────────
    // Close by the boat: CRACKLE -- countless flat little pops, like static
    // (rain on wood and water up close is clicks, not tones): a loop of
    // sparse random impulses. Behind it a WASH with slow waves of intensity,
    // and a low body. The level follows how near the camera is to the boat
    // (world.rain: the storm arriving across the water, times how near we
    // are): a distant wash grows as it approaches, the crackle arrives with
    // it; as we climb the crackle fades first, the wash lingers, then goes.
    let rain = null;
    function startRain() {
        if (rain || !boatAC) return;
        const loop = (dur) => { const s = makeNoise(dur); s.loop = true; return s; };
        const src = loop(3), hp = boatAC.createBiquadFilter(), lp = boatAC.createBiquadFilter(), wash = boatAC.createGain();
        hp.type = 'highpass'; hp.frequency.value = 700; lp.type = 'lowpass'; lp.frequency.value = 7000; wash.gain.value = 0;
        src.connect(hp); hp.connect(lp); lp.connect(wash); wash.connect(masterOut); src.start();
        const src2 = loop(3), bp = boatAC.createBiquadFilter(), body = boatAC.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6; body.gain.value = 0;
        src2.connect(bp); bp.connect(body); body.connect(masterOut); src2.start();
        // the crackle: 2 s of sparse impulses (random sign and size), looped
        const sr = boatAC.sampleRate, cb = boatAC.createBuffer(1, sr * 2, sr), cd = cb.getChannelData(0);
        for (let i = 0; i < 2 * 380; i++) {                       // ~380 pops a second
            const at = Math.floor(Math.random() * (cd.length - 4)), v = (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.7);
            cd[at] += v; cd[at + 1] += v * 0.5; cd[at + 2] -= v * 0.25;
        }
        const cs = boatAC.createBufferSource(); cs.buffer = cb; cs.loop = true;
        const chp = boatAC.createBiquadFilter(), crackle = boatAC.createGain();
        chp.type = 'highpass'; chp.frequency.value = 900; crackle.gain.value = 0;
        cs.connect(chp); chp.connect(crackle); crackle.connect(masterOut); cs.start();
        rain = { wash, body, crackle, last: performance.now() };
    }
    function tickRain(now, near) {
        if (!boatAC) return;
        startRain();
        const t = boatAC.currentTime;
        rain.last = now;
        const swell = 0.75 + 0.25 * Math.sin(now / 1000 * 0.55) * Math.sin(now / 1000 * 0.23 + 1);   // waves of intensity
        rain.crackle.gain.setTargetAtTime(0.5 * near * near, t, 0.3);          // leads close by, fades first
        rain.wash.gain.setTargetAtTime((0.02 + 0.07 * near) * swell, t, 0.6);  // softer, lingering
        rain.body.gain.setTargetAtTime(0.05 * near, t, 0.6);
    }


    // A drop hitting the glass: a SPLAT -- a soft wet slap of noise with a
    // little low thump under it for the big ones; bigger drops louder and
    // lower, placed left or right where it lands.
    function playGlassTap(x, size) {
        if (!boatAC) return;
        const t = boatAC.currentTime, out = boatAC.createGain();
        if (boatAC.createStereoPanner) { const pan = boatAC.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, x * 2 - 1)) * 0.8; out.connect(pan); pan.connect(masterOut); }
        else out.connect(masterOut);
        const src = makeNoise(0.2), bp = boatAC.createBiquadFilter(), g = boatAC.createGain();
        bp.type = 'bandpass'; bp.frequency.value = rnd(900, 1800) * (1.25 - 0.5 * size); bp.Q.value = 0.9;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12 + 0.4 * size, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + 0.12 * size);
        src.connect(bp); bp.connect(g); g.connect(out); src.start(t); src.stop(t + 0.22);
        if (size > 0.45) {                                           // the big ones land with weight
            const o = boatAC.createOscillator(), og = boatAC.createGain();
            o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
            og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.25 * size, t + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
            o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.14);
        }
    }

    // ── Rising wind ────────────────────────────────────────────────────────────
    // As the camera climbs, everything else fades and a wind rises. Like
    // d3OpenSea's: a steady wash (looped noise, a broad band, a high-pass)
    // and gusts -- noise bursts that swell and fall away. And a KEEN: three
    // whistling voices, each a narrow resonance in the noise gliding slowly up
    // and down in pitch, swelling and fading on its own time, drifting in and
    // out of each other. On its own path, so it isn't faded with the rest.
    let wind = null;
    function tickWind(now, climb) {
        if (!boatAC) return;
        const t = boatAC.currentTime, s = now / 1000;
        if (!wind) {
            const out = boatAC.createGain(); out.gain.value = 0; out.connect(boatAC.destination);
            const src = makeNoise(4); src.loop = true;
            const bp = boatAC.createBiquadFilter(), hp = boatAC.createBiquadFilter(), wash = boatAC.createGain();
            bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.4; hp.type = 'highpass'; hp.frequency.value = 300; wash.gain.value = 0.5;
            src.connect(bp); bp.connect(hp); hp.connect(wash); wash.connect(out); src.start();
            const voices = [0, 1, 2].map(() => {
                const n = makeNoise(4); n.loop = true;
                const f = boatAC.createBiquadFilter(), g = boatAC.createGain();
                f.type = 'bandpass'; f.frequency.value = rnd(400, 1100); f.Q.value = rnd(10, 16); g.gain.value = 0;
                n.connect(f); f.connect(g); g.connect(out); n.start();
                return { f, g, next: 0 };
            });
            wind = { out, bp, voices, nextGust: s + rnd(2, 4) };
        }
        wind.out.gain.setTargetAtTime(0.16 * climb, t, 0.6);           // a presence, not a gale
        wind.bp.frequency.setTargetAtTime(500 + 500 * climb, t, 0.8);
        // the keen: each voice glides to a new pitch and level now and then
        for (const v of wind.voices) {
            if (s < v.next) continue;
            v.next = s + rnd(1.4, 3.6);
            v.f.frequency.setTargetAtTime(rnd(380, 900) + 500 * climb * Math.random(), t, rnd(0.6, 1.4));
            v.g.gain.setTargetAtTime(Math.random() < 0.4 ? 0 : rnd(0.3, 0.9), t, rnd(0.6, 1.4));
        }
        // gusts, as in d3OpenSea: a burst that swells and falls away
        if (s > wind.nextGust && climb > 0.1) {
            wind.nextGust = s + rnd(3, 7);
            const dur = rnd(1.5, 3.5), src = makeNoise(dur), hp2 = boatAC.createBiquadFilter(), g = boatAC.createGain();
            hp2.type = 'highpass'; hp2.frequency.value = 500 + climb * 400;
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12 + climb * 0.12, t + dur * 0.3);
            g.gain.linearRampToValueAtTime(0.04, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
            src.connect(hp2); hp2.connect(g); g.connect(wind.out); src.start(t); src.stop(t + dur);
        }
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
        if (wind && boatAC) wind.out.gain.setTargetAtTime(0, boatAC.currentTime, 0.4);
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

    // ── The crossing itself: the shared sea world (crossing/seaWorld.js) ──────
    const world = createSeaWorld({ canvas, ctx, champion, tickSounds, config: RETURN,
        onEvent: (type, e) => { if (type === 'glassHit') playGlassTap(e.x, e.size) } })
    let rafId = null
    function draw(now) {
        rafId = requestAnimationFrame(draw)
        world.draw(now)
        tickRain(now, world.rain)
        tickWind(now, world.climb)
        // everything but the wind fades as we rise into the cloud
        if (boatAC && masterOut && !sceneDone) masterOut.gain.setTargetAtTime(0.55 * Math.max(0, world.near), boatAC.currentTime, 0.5)
    }

    rafId = requestAnimationFrame(draw);
}

