// returnCrossing.js
// Call: initReturnCrossing(champion, sliderValue, onComplete)
//
// The return journey: Skye → Éire. Top-centre to bottom-left.
// Choppy day, light swell, wind from the north-east.
// No stars. No lightning. Just a small boat on grey-green water.
//
// New vs dawnCrossing:
//   • Boat travels top-centre → bottom-left (reversed + diagonal)
//   • Sea swell: sinusoidal wave bands rolling across the canvas
//   • Boat pitches ±4° as it crests and troughs
//   • Yaw correction: boat drifts from wind, oar on one side pauses to straighten
//   • Foreground foam: spray particles at the very bottom, as though from a shore
//   • Skye silhouette fades OUT at the start (we are leaving)
//   • Ireland coast (flat, dark) fades IN from bottom-left later
//   • Cloud layer: 3 stretched ellipses drifting right-to-left
//   • Colour palette: slate grey-green → cold dusk blue
//   • La Tène ripples inherited unchanged

// ─────────────────────────────────────────────────────────────────────────────
// BOAT PIXELS (same pixel art)
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
// Slightly longer ready (more effortful), shorter return (urgency)
const READY_MS  = 1600;
const STROKE_MS = 1400;
const RETURN_MS =  800;
const OAR_CYCLE = READY_MS + STROKE_MS + RETURN_MS;  // 3800 ms

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
    let moonPhase = typeof sliderValue === 'number' ? sliderValue : 0.15;

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
    const base = Math.min(W0, H0);
    const gaFontPx = Math.round(base * 0.072);
    const enFontPx = Math.round(base * 0.052);

    const fontOverride = document.createElement('style');
    fontOverride.id = 'returnCrossingFontOverride';
    fontOverride.textContent = `
        /* Irish — cold silver-white, with icy glow */
        #returnCrossing div div div:first-child {
            font-size:${gaFontPx}px !important;
            color:#d8e8f0 !important;
            text-shadow:
                0 0 22px rgba(160,200,230,0.85),
                0 0  8px rgba(100,160,200,0.6),
                1px  1px 0 rgba(0,10,20,0.9),
               -1px -1px 0 rgba(0,10,20,0.9),
                1px -1px 0 rgba(0,10,20,0.9),
               -1px  1px 0 rgba(0,10,20,0.9) !important;
        }
        /* English — muted warm grey, subordinate */
        #returnCrossing div div div:nth-child(2) {
            font-size:${enFontPx}px !important;
            color:#8a9a8e !important;
            font-family:Urchlo,serif !important;
            text-shadow:
                0 0 10px rgba(0,0,0,0.95),
                1px  1px 0 rgba(0,0,0,0.8),
               -1px -1px 0 rgba(0,0,0,0.8),
                1px -1px 0 rgba(0,0,0,0.8),
               -1px  1px 0 rgba(0,0,0,0.8) !important;
        }
    `;
    document.head.appendChild(fontOverride);

    // ── Moon slider ───────────────────────────────────────────────────────────
    let enEls = [];

    const moonR = Math.round(H0 * 0.024);
    const moonD = moonR * 2;

    const sliderStrip = document.createElement('div');
    sliderStrip.style.cssText = [
        'position:fixed;top:0;left:0;right:0;height:52px;z-index:999998;',
        'display:flex;align-items:center;justify-content:center;',
        'background:rgba(0,0,0,0.32);pointer-events:all;',
    ].join('');

    const moonCanvas = document.createElement('canvas');
    moonCanvas.width  = moonD;
    moonCanvas.height = moonD;
    moonCanvas.style.cssText = [
        'position:absolute;top:50%;transform:translateY(-50%);',
        `width:${moonD}px;height:${moonD}px;pointer-events:none;z-index:1;`,
    ].join('');

    function drawMoonThumb(phase) {
        const mc = moonCanvas.getContext('2d');
        const r = moonR, cx = r, cy = r;
        mc.clearRect(0, 0, moonD, moonD);
        const grd = mc.createRadialGradient(cx,cy,r*0.4,cx,cy,r*1.6);
        grd.addColorStop(0, `rgba(200,220,255,${0.1+phase*0.1})`);
        grd.addColorStop(1, 'rgba(200,220,255,0)');
        mc.fillStyle=grd; mc.beginPath(); mc.arc(cx,cy,r*1.6,0,Math.PI*2); mc.fill();
        mc.fillStyle='rgb(8,4,30)'; mc.beginPath(); mc.arc(cx,cy,r*0.92,0,Math.PI*2); mc.fill();
        mc.fillStyle=`rgb(${Math.round(200+phase*35)},${Math.round(210+phase*30)},${Math.round(220+phase*20)})`;
        mc.beginPath();
        if (phase >= 0.99) {
            mc.arc(cx,cy,r*0.92,0,Math.PI*2);
        } else {
            const tx = r*0.92*Math.cos(phase*Math.PI);
            mc.arc(cx,cy,r*0.92,-Math.PI/2,Math.PI/2);
            mc.ellipse(cx,cy,Math.abs(tx),r*0.92,0,Math.PI/2,-Math.PI/2,tx>0);
        }
        mc.fill();
        mc.strokeStyle=`rgba(200,220,255,${0.12+phase*0.22})`; mc.lineWidth=1;
        mc.beginPath(); mc.arc(cx,cy,r*0.92,0,Math.PI*2); mc.stroke();
    }

    const localSlider = document.createElement('input');
    localSlider.type='range'; localSlider.min=0; localSlider.max=1;
    localSlider.step=0.05; localSlider.value=moonPhase;
    localSlider.style.cssText=[
        '-webkit-appearance:none;appearance:none;',
        'width:100%;height:100%;',
        'border-radius:4px;outline:none;cursor:pointer;',
        'position:absolute;top:0;left:0;margin:0;',
        'z-index:2;pointer-events:all;touch-action:none;',
        'background:transparent;',
    ].join('');

    const thumbStyle = document.createElement('style');
    thumbStyle.textContent=`
        #returnCrossing input[type=range]::-webkit-slider-thumb{
            -webkit-appearance:none;
            width:${moonD+8}px;height:${moonD+8}px;
            background:transparent;border:none;cursor:grab;
        }
        #returnCrossing input[type=range]::-webkit-slider-thumb:active{cursor:grabbing;}
        #returnCrossing input[type=range]::-moz-range-thumb{
            width:${moonD+8}px;height:${moonD+8}px;
            background:transparent;border:none;cursor:grab;
        }
    `;
    document.head.appendChild(thumbStyle);

    const sliderWrapper = document.createElement('div');
    sliderWrapper.style.cssText=[
        'position:relative;width:80%;max-width:580px;',
        `height:${moonD+8}px;display:flex;align-items:center;`,
    ].join('');
    sliderWrapper.appendChild(localSlider);
    sliderWrapper.appendChild(moonCanvas);
    sliderStrip.appendChild(sliderWrapper);
    container.appendChild(sliderStrip);

    function positionMoon(val) {
        const usable = sliderWrapper.offsetWidth - moonR*2;
        moonCanvas.style.left = (moonR + val*usable - moonR)+'px';
        drawMoonThumb(val);
        const pct = val*100;
        sliderWrapper.style.background =
            `linear-gradient(to right,rgba(180,200,212,0.45) 0%,rgba(180,200,212,0.45) ${pct}%,rgba(60,70,70,0.4) ${pct}%,rgba(60,70,70,0.4) 100%)`;
    }
    localSlider.oninput = e => {
        moonPhase = parseFloat(e.target.value);
        positionMoon(moonPhase);
        for (const en of enEls) {
            const ga       = en.previousElementSibling;
            const rawAlpha = ga ? ga.style.opacity : '';
            const spatial  = rawAlpha !== '' ? parseFloat(rawAlpha) : 1;
            en.style.opacity = String(spatial * moonPhase);
        }
    };
    requestAnimationFrame(() => positionMoon(moonPhase));

    // ── Canvas ────────────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.insertBefore(canvas, sliderStrip);
    const ctx = canvas.getContext('2d');

    function resize() { canvas.width=window.innerWidth; canvas.height=window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    // ── Scene timing ──────────────────────────────────────────────────────────
    const SCENE_DURATION  = 95000;
    const BOAT_DURATION   = 88000;
    const SKYE_FADE_END   = 22000;   // Skye bg fades out in first 22s

    // ── Clouds ────────────────────────────────────────────────────────────────
    // Three layers drifting left at different speeds.
    // Each cloud is a soft stack of overlapping ellipses.
    const clouds = Array.from({ length: 7 }, (_, i) => ({
        x:     rnd(0, 1.4),          // normalised x (can be >1 — off-screen right)
        y:     rnd(0.04, 0.32),      // normalised y — upper third
        w:     rnd(0.18, 0.42),      // normalised width
        h:     rnd(0.04, 0.10),      // normalised height
        speed: rnd(0.000008, 0.000022), // normalised x per ms
        alpha: rnd(0.06, 0.18),
        puffs: Array.from({ length: Math.floor(rnd(3,6)) }, () => ({
            ox: rnd(-0.5, 0.5),      // offset within cloud, normalised to cloud width
            oy: rnd(-0.4, 0.4),
            rs: rnd(0.7, 1.3),       // relative size
        })),
    }));

    // ── Swell: rolling wave bands ─────────────────────────────────────────────
    // 6 wave crests, each a sinusoidal horizontal band scrolling upward (toward
    // the boat as it recedes into the distance). The boat rides these —
    // pitching as it crosses each crest.
    const WAVE_COUNT = 6;
    const waves = Array.from({ length: WAVE_COUNT }, (_, i) => ({
        phase:  (i / WAVE_COUNT) * Math.PI * 2,   // spread evenly
        speed:  rnd(0.00028, 0.00048),             // scroll speed (normalised/ms)
        amp:    rnd(0.018, 0.038),                 // crest height (normalised H)
        wl:     rnd(0.22, 0.40),                   // wavelength (normalised W)
        alpha:  rnd(0.04, 0.11),
        bright: rnd(0.5, 1.0),                     // whitecap brightness multiplier
    }));

    // ── Wave splash: occasional burst spray ──────────────────────────────────
    // A single energetic splash every 7–10 seconds. Each splash fires a burst
    // of particles from a random x position near the bottom, angled left,
    // right, or straight up. Particles arc under gravity and fade out.
    let splashParticles = [];
    let nextSplashAt    = rnd(3000, 6000);  // ms from scene start

    function fireSplash(elapsed) {
        const W2 = canvas.width, H2 = canvas.height;
        // Pick a position along the lower portion of the screen
        const sx   = rnd(0.05, 0.95);
        const sy   = rnd(0.82, 0.92);
        // Direction bias: left, right, or up
        const roll = Math.random();
        const bias = roll < 0.33 ? -1 : roll < 0.66 ? 1 : 0;  // -1=left, 1=right, 0=up
        const count = Math.floor(rnd(28, 55));
        for (let i = 0; i < count; i++) {
            const speed  = rnd(0.0006, 0.0022);
            const spread = rnd(-0.55, 0.55);
            const angle  = -Math.PI/2 + bias * rnd(0.1, 0.65) + spread * 0.45;
            splashParticles.push({
                x:    sx,
                y:    sy,
                vx:   Math.cos(angle) * speed,
                vy:   Math.sin(angle) * speed,
                life: 0,
                maxLife: rnd(500, 1600),
                r:    rnd(1.5, 5),
            });
        }
        nextSplashAt = elapsed + rnd(7000, 10000);
    }

    // ── Yaw state ────────────────────────────────────────────────────────────
    // The boat drifts off-course from the NE wind, accumulating yaw.
    // When yaw exceeds threshold, the port (left) oar pauses one stroke.
    // This straightens the course. Then yaw resets and drifts again.
    let yawAngle   = 0;            // current heading deviation (radians)
    let yawCorrect = false;        // true = currently correcting
    let yawTimer   = 0;
    const YAW_DRIFT    = 0.000018;  // radians per ms of drift
    const YAW_THRESH   = 0.09;      // trigger correction at this angle
    const YAW_CORRECT  = 0.00012;   // correction rate per ms
    let suppressPort   = false;     // when true, port oar holds READY position

    // ── Images ────────────────────────────────────────────────────────────────
    const skyeImg = new Image();
    skyeImg.src   = 'assets/skye01.png';
    let skyeLoaded = false;
    skyeImg.onload  = () => { skyeLoaded = true; };
    skyeImg.onerror = () => {};

    // Ireland: flat low coastline — we draw it procedurally (no asset needed)
    // A dark irregular silhouette along the bottom-left.

    // Cloud asset (optional enhancement — drawn procedurally if absent)
    const cloudImg = new Image();
    cloudImg.src   = 'assets/cloud1.png';
    let cloudLoaded = false;
    cloudImg.onload  = () => { cloudLoaded = true; };
    cloudImg.onerror = () => {};

    // ── Text ──────────────────────────────────────────────────────────────────
    const SCROLLING_TEXT_PATH   = '/ui/scrollingTextPlayer.js';
    const RETURN_TEXTS_PATH     = '/data/returnCrossingTexts.js';
    let textPlayer = null;
    let sceneDone  = false;

    const textTimer = setTimeout(async () => {
        try {
            const [stMod, txtMod] = await Promise.all([
                import(SCROLLING_TEXT_PATH),
                import(RETURN_TEXTS_PATH),
            ]);
            const { ScrollingTextPlayer }  = stMod;
            const { returnCrossingTexts }  = txtMod;

            textPlayer = new ScrollingTextPlayer({
                lines:        returnCrossingTexts.crossing,
                getMoonPhase: () => moonPhase,
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
                const CEIL   = 66;
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
                    if (y < CEIL + FADEPX) {
                        alpha = Math.max(0, (y - CEIL) / FADEPX);
                    }
                    if (bottom > H2 * (1 - 0.07)) {
                        alpha = Math.min(alpha, Math.max(0, (H2 - y) / (H2 * 0.07)));
                    }
                    entry.gaEl.style.opacity = String(alpha);
                    if (entry.enEl) entry.enEl.style.opacity = String(alpha * mp);
                }
            };

            textPlayer._naturalVel = RC_PX_PER_MS;
            textPlayer._velocity   = RC_PX_PER_MS;
            textPlayer._ceilingY       = 999999;
            textPlayer._onReachCeiling = function() {};
            textPlayer._onComplete     = function() {};

            if (textPlayer._hitZone) {
                const SLIDER_H = 52;
                textPlayer._hitZone.style.top    = SLIDER_H + 'px';
                textPlayer._hitZone.style.height = (window.innerHeight - SLIDER_H) + 'px';
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

            // Exit when last line scrolls off top
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

            setTimeout(() => {
                enEls = Array.from(container.querySelectorAll('div > div > div:nth-child(2)'));
            }, 100);

        } catch(e) {
            console.error('[returnCrossing] Text modules failed.\nCheck SCROLLING_TEXT_PATH + RETURN_TEXTS_PATH\n', e);
        }
    }, 2000);

    // ── Music fade ─────────────────────────────────────────────────────────────
    (async () => {
        try {
            const mod = await import('../../heroSelect.js');
            const mp  = mod.getMusicPlayer?.();
            if (mp?.audioContext) {
                const ac=mp.audioContext, t0=ac.currentTime;
                for (const tr of (mp.tracks||[])) {
                    if (tr?.gain) {
                        tr.gain.gain.setValueAtTime(tr.gain.gain.value,t0);
                        tr.gain.gain.linearRampToValueAtTime(0,t0+18);
                    }
                }
            }
        } catch(e) {}
    })();

    // Hard cap is a safety net only — real exit is driven by text completion.
    // Set generously long so a paused reader never gets cut off.
    // 240s (4 min) is far beyond any realistic reading time.
    const hardCap = setTimeout(() => { if (!sceneDone) beginExit(); }, 240000);

    // ── Audio ─────────────────────────────────────────────────────────────────
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
        const buf = boatAC.createBuffer(1, Math.ceil(boatAC.sampleRate*dur), boatAC.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
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
            g.gain.linearRampToValueAtTime(intensity * (i===0?0.28:0.18), now+0.04);
            g.gain.exponentialRampToValueAtTime(0.001, now+0.38);
            n.connect(bp); bp.connect(g); g.connect(masterOut);
            n.start(now); n.stop(now+0.38);
        });
    }

    function playCreak() {
        if (!ensureAudio()) return;
        const now = boatAC.currentTime;
        const osc = boatAC.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(48, now+0.28);
        const g = boatAC.createGain();
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now+0.28);
        const n  = makeNoise(0.09);
        const bp = boatAC.createBiquadFilter();
        bp.type='bandpass'; bp.frequency.value=280; bp.Q.value=3;
        const g2 = boatAC.createGain();
        g2.gain.setValueAtTime(0.07, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now+0.08);
        osc.connect(g); g.connect(masterOut);
        n.connect(bp); bp.connect(g2); g2.connect(masterOut);
        osc.start(now); osc.stop(now+0.28);
        n.start(now);   n.stop(now+0.09);
    }

    // Wind gust — filtered noise swept from high to low
    function playWind() {
        if (!ensureAudio()) return;
        const now = boatAC.currentTime;
        const dur = rnd(1.2, 2.4);
        const n   = makeNoise(dur);
        const hp  = boatAC.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 800;
        const g   = boatAC.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.12, now + dur*0.2);
        g.gain.linearRampToValueAtTime(0.08, now + dur*0.7);
        g.gain.linearRampToValueAtTime(0, now + dur);
        n.connect(hp); hp.connect(g); g.connect(masterOut);
        n.start(now); n.stop(now+dur);
    }

    // Seagull laughing cry — the classic "ha-ha-ha-ha" kittiwake/herring gull call.
    // Each laugh unit is a short downward-pitched pulse: "kyow" repeated rapidly.
    // Achieved with a triangle oscillator (rounder than sine, slight harmonics)
    // with a fast pitch drop per syllable, amplitude modulated to create discrete
    // pulses. 3–6 laugh syllables per call, 2–3 calls per event.
    function playGull() {
        if (!ensureAudio()) return;
        const now   = boatAC.currentTime;
        const calls = Math.floor(rnd(1, 3));
        for (let callIdx = 0; callIdx < calls; callIdx++) {
            const callDelay  = callIdx * rnd(0.9, 1.6);
            const syllables  = Math.floor(rnd(3, 7));
            const sylDur     = rnd(0.10, 0.16);   // each "ha" duration
            const sylGap     = rnd(0.04, 0.09);   // silence between syllables
            const baseF      = rnd(600, 950);

            for (let s = 0; s < syllables; s++) {
                const t0 = now + callDelay + s * (sylDur + sylGap);

                // Triangle osc — rounder than sawtooth, still has odd harmonics
                const osc = boatAC.createOscillator();
                osc.type  = 'triangle';
                // Each syllable: sharp drop from high to low — the "kyow" shape
                osc.frequency.setValueAtTime(baseF * (1.0 - s * 0.04), t0);
                osc.frequency.exponentialRampToValueAtTime(baseF * 0.55, t0 + sylDur * 0.7);

                // Slight formant shaping via peaking filter — adds nasal quality
                const peak = boatAC.createBiquadFilter();
                peak.type = 'peaking';
                peak.frequency.value = baseF * 1.4;
                peak.Q.value = 3;
                peak.gain.value = 8;

                // Pulse envelope: fast attack, fast decay
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
        const now = boatAC.currentTime;
        const count = Math.floor(rnd(2,4));
        for (let i=0;i<count;i++) {
            const delay = i*rnd(0.04,0.12);
            const freq  = rnd(1800,2700);
            const osc   = boatAC.createOscillator();
            osc.frequency.value = freq;
            const g = boatAC.createGain();
            g.gain.setValueAtTime(0.07, now+delay);
            g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.14);
            osc.connect(g); g.connect(masterOut);
            osc.start(now+delay); osc.stop(now+delay+0.14);
        }
    }

    function tickSounds(now, inStroke, strokeT, inReturn, returnT) {
        if (!boatAC) {
            if (inStroke && strokeT < 0.08) ensureAudio();
            return;
        }
        if (inStroke && strokeT < 0.08) {
            playWaterRush(0.4 + strokeT * 1.2);
        }
        const rndCreak = rnd(6000,14000);
        if (now - lastCreak > rndCreak && Math.random() < 0.012) {
            lastCreak = now; playCreak();
        }
        if (inReturn && returnT < 0.22 && now - lastDrip > 5000 && Math.random() < 0.04) {
            lastDrip = now; playDrip();
        }
        // Wind gust — more frequent than dawn
        if (now - lastWind > rnd(4000,10000) && Math.random() < 0.004) {
            lastWind = now; playWind();
        }
        // Seagull cry — occasional, 12–30s apart
        if (now - lastGull > rnd(12000,30000) && Math.random() < 0.006) {
            lastGull = now; playGull();
        }
    }

    // ── Exit ──────────────────────────────────────────────────────────────────
   function beginExit() {
    if (sceneDone) return;
    sceneDone = true;
    clearTimeout(textTimer); clearTimeout(hardCap);
    if (textPlayer) { textPlayer.destroy(); textPlayer = null; }
    window.removeEventListener('resize', resize);
    thumbStyle.remove();
    fontOverride.remove();

    // Fade audio
    if (boatAC) {
        try {
            if (masterOut) {
                masterOut.gain.setValueAtTime(masterOut.gain.value, boatAC.currentTime);
                masterOut.gain.linearRampToValueAtTime(0, boatAC.currentTime + 2.5);
            }
            setTimeout(() => { try { boatAC.close(); } catch(e){} }, 3000);
        } catch(e) {}
    }

    // Veil
    const veil = document.createElement('div');
    veil.style.cssText = [
        'position:fixed;inset:0;z-index:1000000;',
        'background:#0a120e;opacity:0;transition:opacity 2.8s ease;pointer-events:none;',
    ].join('');
    document.body.appendChild(veil);

    setTimeout(() => {
        cancelAnimationFrame(rafId);
        requestAnimationFrame(() => { veil.style.opacity = '1'; });
    }, 500);

    setTimeout(() => {
        // Stop canvas loop
        cancelAnimationFrame(rafId);

        // Remove container
        container.remove();

        // Nuclear cleanup — remove any stray crossing divs and veils
        document.querySelectorAll(
            '#returnCrossing, #dawnCrossing, #returnCrossingFontOverride, #dawnCrossingFontOverride'
        ).forEach(el => el.remove());

        // Remove any veil divs left at z-index 1000000
        document.querySelectorAll('body > div').forEach(el => {
            const z = parseInt(el.style.zIndex || '0', 10);
            if (z >= 1000000) el.remove();
        });

        veil.remove();

        // Restore game container
        const gc = document.getElementById('gameContainer');
        if (gc) {
            gc.style.display   = '';
            gc.style.opacity   = '1';
            gc.style.position  = 'fixed';
            gc.style.inset     = '0';
            gc.style.zIndex    = '999999';
        }

        if (onComplete) onComplete();
    }, 3900);
} 

    // ── Ripples — identical La Tène system from dawnCrossing ─────────────────
    const RIPPLE_LIFE   = 9000;    // slightly shorter on choppy water
    const RIPPLE_MAX_R  = 0.26;
    const RIPPLE_SETS   = 10;
    let   ripples       = [];
    let   lastRipple    = 0;

    function rippleColor(hue, alpha) {
        return `hsla(${(hue%360).toFixed(1)},28%,68%,${alpha.toFixed(3)})`;
    }

    function spawnRipple(x, y, angle) {
        if (ripples.length >= RIPPLE_SETS) ripples.shift();
        ripples.push({
            x, y, born: performance.now(), angle,
            hueOffset: 180 + Math.random() * 60,  // cooler blue-grey hues
            scaleX:    0.85 + Math.random() * 0.18,
            scaleY:    0.38 + Math.random() * 0.14,
            sqPhase:   Math.random() * Math.PI * 2,
            sqPhase2:  Math.random() * Math.PI * 2,
        });
    }

    function drawSquirmArc(ctx, R, startAngle, endAngle, sqAmp, sqFreq, sqTime, sqPh, sqPh2, baseAlpha, hue) {
        const STEPS    = 52;
        const FADE_END = 0.18;
        for (let s = 0; s < STEPS; s++) {
            const t0 = s / STEPS;
            const t1 = (s + 1) / STEPS;
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

    // Ireland coast removed — handled by sea horizon only

    // ── Render ────────────────────────────────────────────────────────────────
    const startTime    = performance.now();
    let   rafId        = null;
    let   boatProgress = 0;
    let   lastFrameTime = performance.now();

    function draw(now) {
        rafId = requestAnimationFrame(draw);
        const W = canvas.width, H = canvas.height;
        const elapsed = now - startTime;
        const dt = Math.min(now - lastFrameTime, 64);
        lastFrameTime = now;

        // ── Sea colour: slate grey-green → cold dusk blue ────────────────────
        const colT = clamp(elapsed / SCENE_DURATION, 0, 1);
        const colE = easeIO(colT);
        // Start: dark grey-green (overcast day at sea)
        // End:   deep slate-blue (approaching dusk)
        const sr = Math.round(lerp(14, 20, colE));
        const sg = Math.round(lerp(28, 32, colE));
        const sb = Math.round(lerp(28, 52, colE));

        ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
        ctx.fillRect(0, 0, W, H);

        // ── Sky gradient (upper 40%) ──────────────────────────────────────────
        const skyGrad = ctx.createLinearGradient(0,0,0,H*0.42);
        const skyR = Math.round(lerp(52, 28, colE));
        const skyG = Math.round(lerp(62, 38, colE));
        const skyB = Math.round(lerp(72, 68, colE));
        skyGrad.addColorStop(0, `rgb(${skyR},${skyG},${skyB})`);
        skyGrad.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H*0.42);

        // ── Skye silhouette — fades OUT in first 22s ──────────────────────────
        if (skyeLoaded) {
            const skyeT     = clamp(elapsed / SKYE_FADE_END, 0, 1);
            const skyeAlpha = (1 - easeIO(skyeT)) * 0.22;
            if (skyeAlpha > 0.001) {
                const aspect = skyeImg.naturalWidth / skyeImg.naturalHeight;
                const skyeW  = W;
                const skyeH  = skyeW / aspect;
                ctx.save();
                ctx.globalAlpha = skyeAlpha;
                ctx.drawImage(skyeImg, 0, 52, skyeW, skyeH);
                ctx.restore();
            }
        }

        // ── Swell: rolling wave bands ─────────────────────────────────────────
        // Drawn as translucent horizontal brushstrokes that scroll upward,
        // mimicking the perspective of receding swells.
        {
            ctx.save();
            for (const w of waves) {
                // Wave phase advances each frame
                w.phase += w.speed * dt;

                // Scan vertically — each y gets a swell contribution
                // The wave band is most opaque near y = 0.55–0.90 (water surface)
                const bandTop    = 0.48;
                const bandBottom = 0.96;
                const STEPS = 38;
                for (let s = 0; s < STEPS; s++) {
                    const fy   = bandTop + (bandBottom - bandTop) * (s / STEPS);
                    const fy1  = bandTop + (bandBottom - bandTop) * ((s+1) / STEPS);
                    // Each y-band has a lateral sinusoidal intensity
                    const wave = Math.sin(fy * Math.PI * (1/w.wl) + w.phase);
                    if (wave < 0.3) continue;
                    const wAlpha = (wave - 0.3) / 0.7 * w.alpha * (fy > 0.7 ? 1 : fy/0.7);
                    // Whitecap: brighter near the crest
                    const wR = Math.round(lerp(sr, 200, wave * w.bright * 0.22));
                    const wG = Math.round(lerp(sg, 215, wave * w.bright * 0.22));
                    const wB = Math.round(lerp(sb, 220, wave * w.bright * 0.28));
                    // Lateral shimmer — slight x-offset per strip
                    const dx = Math.sin(fy * 7.3 + elapsed * 0.0004) * W * 0.012;
                    ctx.fillStyle = `rgba(${wR},${wG},${wB},${wAlpha.toFixed(3)})`;
                    ctx.fillRect(dx, fy*H, W+4, Math.ceil((fy1-fy)*H)+1);
                }
            }
            ctx.restore();
        }

        // ── Sea shimmer (same as dawnCrossing, cooler palette) ────────────────
        for (let i = 0; i < 140; i++) {
            const fy = i/140, y = fy*H;
            const ir = sr + Math.sin(fy*11.4 + elapsed*0.00038         ) * (4+colE*6);
            const ig = sg + Math.sin(fy*7.2  + elapsed*0.00033 + 1.2   ) * (5+colE*8);
            const ib = sb + Math.cos(fy*9.5  + elapsed*0.00044 + fy*0.5) * (7+colE*10);
            const dx = Math.sin(fy*5.3 + elapsed*0.00042 + i*0.07) * (fy*4);
            ctx.fillStyle=`rgba(${Math.round(clamp(ir,0,255))},${Math.round(clamp(ig,0,255))},${Math.round(clamp(ib,0,255))},0.18)`;
            ctx.fillRect(Math.round(dx), Math.round(y), W+6, Math.ceil(H/140+1));
        }

        // ── Clouds ────────────────────────────────────────────────────────────
        {
            ctx.save();
            for (const cl of clouds) {
                cl.x -= cl.speed * dt;
                if (cl.x + cl.w < -0.05) cl.x = 1.05;  // wrap around

                const cx   = cl.x * W;
                const cy   = cl.y * H;
                const cw   = cl.w * W;
                const ch   = cl.h * H;

                if (cloudLoaded) {
                    // Use cloud asset if available
                    ctx.globalAlpha = cl.alpha;
                    ctx.drawImage(cloudImg, cx - cw*0.5, cy - ch*0.5, cw, ch);
                } else {
                    // Procedural soft ellipse stack
                    for (const puff of cl.puffs) {
                        const px = cx + puff.ox * cw * 0.5;
                        const py = cy + puff.oy * ch * 0.5;
                        const pr = cw * 0.22 * puff.rs;
                        const grd = ctx.createRadialGradient(px,py,0,px,py,pr);
                        grd.addColorStop(0, `rgba(180,190,195,${cl.alpha*1.5})`);
                        grd.addColorStop(1, `rgba(180,190,195,0)`);
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

        // Ireland coast removed

        // ── Ripples ───────────────────────────────────────────────────────────
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
                ctx.scale(rip.scaleX, rip.scaleY);
                for (let ring = 0; ring < RINGS; ring++) {
                    const ringDelay = (ring/RINGS)*0.35;
                    const ringT     = clamp((lifeT-ringDelay)/(1-ringDelay),0,1);
                    if (ringT<=0) continue;
                    const R     = maxR * ringT;
                    const hue   = rip.hueOffset + elapsed*0.012 + ring*28;
                    const lw    = Math.max(0.3,(1-ringT*0.65)*2.4);
                    const alpha = fadeA*(1-ringT*0.45)*(0.52-ring*0.05);
                    if (alpha<0.004||R<1) continue;
                    const sqAmp  = R*(0.07+ringT*0.14);
                    const sqFreq = 2.7+ring*1.7;
                    const sqPh   = rip.sqPhase+ring*1.4;
                    const sqPh2  = rip.sqPhase2+ring*0.9;
                    // Upper semicircle — wake trails above/behind as boat moves down-screen
                    const arcS=Math.PI, arcE=Math.PI*2;
                    ctx.lineWidth=lw*8;
                    drawSquirmArc(ctx,R,arcS,arcE,sqAmp,sqFreq,sqTime,sqPh,sqPh2,alpha*0.10,hue);
                    ctx.lineWidth=lw*2.4;
                    drawSquirmArc(ctx,R,arcS,arcE,sqAmp,sqFreq,sqTime,sqPh,sqPh2,alpha*0.38,hue);
                    ctx.lineWidth=Math.max(0.4,lw*0.6);
                    drawSquirmArc(ctx,R,arcS,arcE,sqAmp,sqFreq,sqTime,sqPh,sqPh2,alpha*0.80,(hue+35)%360);
                    const h2=( hue+55+ring*18)%360;
                    const alpha2=alpha*0.32;
                    if (alpha2>0.005) {
                        const arcS2=Math.PI*1.12,arcE2=Math.PI*1.88;
                        ctx.lineWidth=lw*1.6;
                        drawSquirmArc(ctx,R*0.80,arcS2,arcE2,sqAmp*1.3,sqFreq+1,sqTime*1.2,sqPh2,sqPh,alpha2*0.36,h2);
                        ctx.lineWidth=Math.max(0.3,lw*0.45);
                        drawSquirmArc(ctx,R*0.80,arcS2,arcE2,sqAmp*1.3,sqFreq+1,sqTime*1.2,sqPh2,sqPh,alpha2*0.78,(h2+25)%360);
                    }
                }
                ctx.restore();
            }
            ctx.restore();
        }

        // ── Boat ──────────────────────────────────────────────────────────────
        // Trajectory: top-centre → bottom-left (opposite of dawn)
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

        const boatE  = easeIO(boatProgress);
        // Top-centre → bottom-left
        const boatX  = lerp(W*0.50, W*0.14, boatE);
        const boatY  = lerp(H*0.48, H*0.82, boatE);  // starts mid-screen, descends

        // ── Yaw drift and correction ──────────────────────────────────────────
        yawTimer += dt;
        if (!yawCorrect) {
            // Wind pushes boat northward (right) — accumulate yaw
            yawAngle += YAW_DRIFT * dt;
            if (yawAngle >= YAW_THRESH) {
                yawCorrect  = true;
                suppressPort = true;
            }
        } else {
            // Correct: yaw eases back to zero, port oar suppressed
            yawAngle = Math.max(0, yawAngle - YAW_CORRECT * dt);
            if (yawAngle <= 0.005) {
                yawCorrect   = false;
                suppressPort = false;
                yawAngle     = 0;
            }
        }

        // ── Boat pitch from swell ─────────────────────────────────────────────
        // Sample wave field at boat position to get vertical displacement
        let swellY = 0;
        for (const w of waves) {
            swellY += Math.sin(boatY/H * Math.PI * (1/w.wl) + w.phase) * w.amp * H * 0.4;
        }
        const pitchAngle = Math.atan2(swellY * 0.012, 40);  // subtle

        // ── Tick sounds ───────────────────────────────────────────────────────
        tickSounds(now, inStroke, strokeT, inReturn, returnT);

        // ── Spawn ripples ─────────────────────────────────────────────────────
        if (inReturn && returnT < 0.04 && now - lastRipple > OAR_CYCLE * 0.8) {
            lastRipple = now;
            const prevE   = easeIO(Math.max(0, boatProgress - 0.005));
            const prevX   = lerp(W*0.50, W*0.14, prevE);
            const prevY   = lerp(H*0.48, H*0.82, prevE);
            const boatAng = Math.atan2(boatY - prevY, boatX - prevX);
            spawnRipple(boatX - 16, boatY + 5, boatAng);
            // Only spawn starboard ripple when not suppressing port
            if (!suppressPort) {
                spawnRipple(boatX + 16, boatY + 5, boatAng);
            }
        }

        // ── Draw boat ─────────────────────────────────────────────────────────
        const persp  = lerp(0.22, 1.0, boatE);   // grows as boat approaches
        const bAlpha = lerp(0.0, 1.0, clamp(boatE/0.10, 0, 1)) *
                       lerp(1.0, 0.0, clamp((boatE-0.88)/0.12, 0, 1));
        const SCALE  = Math.max(1, Math.round((W/145)*persp));
        const bw = BOAT_W*SCALE, bh = BOAT_H*SCALE;
        const bLeft = boatX - bw*0.5, bTop = boatY - bh;

        // Oar angles
        let pullAngle, liftY;
        if (inReady) {
            pullAngle = READY_ANGLE;
            liftY     = SCALE * READY_LIFT;
        } else if (inStroke) {
            const sweepT  = easeOut(easeIn(strokeT));
            pullAngle = lerp(CATCH_ANGLE, FINISH_ANGLE, sweepT);
            liftY     = 0;
        } else {
            const liftT   = clamp(returnT/0.60,0,1);
            const settleT = clamp((returnT-0.60)/0.40,0,1);
            const peakLift = SCALE*READY_LIFT*1.3;
            liftY = returnT<0.60
                ? lerp(0, peakLift, easeOut(liftT))
                : lerp(peakLift, SCALE*READY_LIFT, easeIn(settleT));
            pullAngle = lerp(FINISH_ANGLE, READY_ANGLE, easeIO(returnT));
        }

        const oAlpha = clamp(persp*2.2, 0, 1) * bAlpha;

        // Hull reflection
        if (bAlpha > 0.02) {
            ctx.save();
            ctx.globalAlpha = 0.06*(boatE*0.6+0.4)*bAlpha;
            ctx.translate(bLeft, bTop+bh+1); ctx.scale(1,-0.14);
            for (let row=0;row<BOAT_H;row++)
                for (let col=0;col<BOAT_W;col++)
                    if (BOAT_PIXELS[row][col]==='1') {
                        ctx.fillStyle=`rgba(${sr+14},${sg+17},${sb+22},1)`;
                        ctx.fillRect(col*SCALE,row*SCALE,SCALE,SCALE);
                    }
            ctx.restore();
        }

        // Draw with pitch + yaw applied
        ctx.save();
        ctx.translate(boatX, boatY - bh*0.5);
        ctx.rotate(pitchAngle + yawAngle * 0.4);
        ctx.translate(-boatX, -(boatY - bh*0.5));

        // Oars
        function drawOar(frac, dir, suppress) {
            if (oAlpha < 0.01) return;
            ctx.save();
            ctx.globalAlpha = oAlpha;
            // Suppressed oar stays at READY (raised, not stroking)
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
        drawOar(0.26, -1, suppressPort);   // port oar (left) — suppressed during correction
        drawOar(0.74,  1, false);           // starboard always rows

        // Hull
        if (bAlpha > 0.01) {
            ctx.globalAlpha = bAlpha;
            for (let row=0;row<BOAT_H;row++)
                for (let col=0;col<BOAT_W;col++)
                    if (BOAT_PIXELS[row][col]==='1') {
                        ctx.fillStyle='#040709';
                        ctx.fillRect(Math.round(bLeft+col*SCALE),Math.round(bTop+row*SCALE),SCALE,SCALE);
                    }
            ctx.globalAlpha=1;
        }
        ctx.restore();

        // ── Wave splash bursts ────────────────────────────────────────────────
        {
            // Fire a new splash when timer expires
            if (elapsed >= nextSplashAt) fireSplash(elapsed);

            ctx.save();
            splashParticles = splashParticles.filter(p => p.life <= p.maxLife);
            for (const p of splashParticles) {
                p.life += dt;
                p.x   += p.vx * dt;
                p.y   += p.vy * dt;
                p.vy  += 0.0000018 * dt;  // gravity
                const lifeT = p.life / p.maxLife;
                const alpha = lifeT < 0.12
                    ? lifeT / 0.12
                    : 1 - Math.pow(lifeT, 1.6);
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

        // ── Vignette ──────────────────────────────────────────────────────────
        const vig = ctx.createRadialGradient(W*0.5,H*0.5,H*0.07,W*0.5,H*0.5,H*0.95);
        vig.addColorStop(0,'rgba(0,0,0,0)');
        vig.addColorStop(1,`rgba(2,4,6,${lerp(0.72,0.42,colE)})`);
        ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

        // Subtle canvas warp
        canvas.style.transform=`skewX(${Math.sin(elapsed*0.00031)*0.0012}rad) skewY(${Math.cos(elapsed*0.00022)*0.0008}rad)`;
    }

    rafId = requestAnimationFrame(draw);
}

