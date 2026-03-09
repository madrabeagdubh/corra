// dawnCrossing.js  — v8
// Call: initDawnCrossing(champion, sliderValue, onComplete)

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
const BOAT_W = 16;
const BOAT_H = 8;

// ── Oar cycle: READY → STROKE → READY (repeat) ───────────────────────────────
//
//  READY position: oars raised and swept FORWARD (the resting position a tired
//  oarsman holds between strokes — blades clear of water, arms forward, a breath).
//  After the stroke finishes the oars return to this exact position and PAUSE.
//
//  Phase ms:
//    READY_MS   — hold at the forward-raised ready position
//    STROKE_MS  — sweep from catch through to finish, blades in water
//    RETURN_MS  — lift oars, swing back forward to ready position
//
const READY_MS  = 1800;  // pause at ready (forward, raised)
const STROKE_MS = 1200;  // active stroke in water
const RETURN_MS =  900;  // recovery back to ready position
const OAR_CYCLE = READY_MS + STROKE_MS + RETURN_MS;  // 3900 ms total

// Angles (radians, applied symmetrically port/starboard via dir = ±1)
const READY_ANGLE  = -0.44;  // forward of perpendicular, blades raised
const CATCH_ANGLE  = -0.44;  // same as ready — stroke begins where ready ends
const FINISH_ANGLE =  0.40;  // behind perpendicular, blades exit water
const READY_LIFT   =  2.4;   // SCALE multiplier — how high blades sit at rest

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
export function initDawnCrossing(champion, sliderValue, onComplete) {
    let moonPhase = typeof sliderValue === 'number' ? sliderValue : 0.15;

    // ── Container ─────────────────────────────────────────────────────────────
    const container = document.createElement('div');
    container.id = 'dawnCrossing';
    container.style.cssText = [
        'position:fixed;inset:0;z-index:999999;',
        'overflow:hidden;pointer-events:all;background:#020408;touch-action:none;',
    ].join('');
    document.body.appendChild(container);

    // ── Font size override for ScrollingTextPlayer ────────────────────────────
    // ScrollingTextPlayer uses rem constants (1.35 / 1.05) which are too small.
    // We inject a scoped override matching introModal's viewport-relative sizes.
    const W0 = window.innerWidth, H0 = window.innerHeight;
    const base = Math.min(W0, H0);
    const gaFontPx = Math.round(base * 0.072);  // matches introModal Irish size
    const enFontPx = Math.round(base * 0.052);  // smaller, subordinate to Irish
    // Dark red for English — the hero's voice, readable on any grey sea.
    // Harmonious border: deep burgundy-shadow so it lifts off the background.
    const fontOverride = document.createElement('style');
    fontOverride.id = 'dawnCrossingFontOverride';
    fontOverride.textContent = `
        /* Irish — bright gold, eyecatching, with warm glow */
        #dawnCrossing div div div:first-child {
            font-size:${gaFontPx}px !important;
            color:#e8c84a !important;
            text-shadow:
                0 0 22px rgba(240,180,20,0.9),
                0 0  8px rgba(200,140,0,0.7),
                1px  1px 0 rgba(60,30,0,0.8),
               -1px -1px 0 rgba(60,30,0,0.8),
                1px -1px 0 rgba(60,30,0,0.8),
               -1px  1px 0 rgba(60,30,0,0.8) !important;
        }
        /* English — soft steel-blue, muted, subordinate */
        #dawnCrossing div div div:nth-child(2) {
            font-size:${enFontPx}px !important;
            color:#9ab4c8 !important;
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
    // enEls populated after ScrollingTextPlayer.start() via DOM query
    let enEls = [];

    const moonR = Math.round(H0 * 0.024);
    const moonD = moonR * 2;

    const sliderStrip = document.createElement('div');
    sliderStrip.style.cssText = [
        'position:fixed;top:0;left:0;right:0;height:52px;z-index:999998;',
        'display:flex;align-items:center;justify-content:center;',
        'background:rgba(0,0,0,0.28);pointer-events:all;',
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
        #dawnCrossing input[type=range]::-webkit-slider-thumb{
            -webkit-appearance:none;
            width:${moonD+8}px;
            height:${moonD+8}px;
            background:transparent;
            border:none;
            cursor:grab;
        }
        #dawnCrossing input[type=range]::-webkit-slider-thumb:active{cursor:grabbing;}
        #dawnCrossing input[type=range]::-moz-range-thumb{
            width:${moonD+8}px;
            height:${moonD+8}px;
            background:transparent;
            border:none;
            cursor:grab;
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
            `linear-gradient(to right,rgba(212,175,55,0.5) 0%,rgba(212,175,55,0.5) ${pct}%,rgba(80,80,80,0.4) ${pct}%,rgba(80,80,80,0.4) 100%)`;
    }
    localSlider.oninput = e => {
        moonPhase = parseFloat(e.target.value);
        positionMoon(moonPhase);
        // Update English opacity directly — moonPhase is also read by
        // _render every frame, but when STP is paused at ceiling we need
        // to push the change immediately.
        // Use gaEl opacity as the spatial alpha, but default to 1 (not 0)
        // if it hasn't been set yet — never kill text that hasn't loaded.
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

    // ── Timing ────────────────────────────────────────────────────────────────
    const SCENE_DURATION = 95000;
    const STAR_FADE_END  = 44000;
    const SEA_DAWN_END   = 74000;
    const BOAT_DURATION  = 88000;

    // ── Stars ─────────────────────────────────────────────────────────────────
    // Dense opening sky — 520 stars. Each has a slow orbital swirl component:
    // position drifts in a gentle arc around the canvas centre, giving the
    // impression of the sky rotating as the boat moves beneath it.
    // The swirl speed fades to zero as stars fade out with the dawn.
    const stars = Array.from({ length: 520 }, () => {
        // Polar placement — more stars toward centre for milky-way feel
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.pow(Math.random(), 0.6);  // bias toward centre
        return {
            x:    0.5 + Math.cos(ang) * rad * 0.52,
            y:    0.5 + Math.sin(ang) * rad * 0.52,
            r:    rnd(0.15, 1.6),
            base: rnd(0.08, 0.62),
            ts:   rnd(0.0003, 0.0014),   // twinkle speed
            to:   rnd(0, Math.PI * 2),   // twinkle offset
            // Slow swirl: each star orbits at a slightly different rate
            swirlAng: ang,               // current orbital angle
            swirlRad: rad * 0.52,        // orbital radius (normalised)
            swirlSpd: rnd(0.000008, 0.000028) * (Math.random() < 0.5 ? 1 : -1),
        };
    });

    // ── Text (ScrollingTextPlayer) ────────────────────────────────────────────
    const SCROLLING_TEXT_PATH = '../ui/scrollingTextPlayer.js';
    const DAWN_TEXTS_PATH     = '../../../data/dawnCrossingTexts.js';
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
                getMoonPhase: () => moonPhase,
                onComplete:   () => {},  // overridden below after start()
                container,
            });
            textPlayer.start();

            // ── Speed: 180px/s — time-based so frame rate doesn't affect it ──
            // STP uses px-per-frame internally. We patch _loop to use the RAF
            // timestamp so scroll speed is consistent regardless of frame rate.
            // We also cache offsetHeight on each entry once to avoid per-frame
            // layout reflows (the main cause of the slowdown under load).
            const DAWN_PX_PER_MS = 50 / 1000;   // 180px/s in px/ms

            // Cache offsetHeight now that DOM is built
            for (const entry of textPlayer._lineEls) {
                entry._cachedH = entry.wrapper.offsetHeight;
            }

            // Patch _loop to be time-based
            textPlayer._lastLoopTime = performance.now();
            textPlayer._loop = function(timestamp) {
                if (!this._running || this._fadingOut) return;

                const now = timestamp || performance.now();
                const dt  = Math.min(now - this._lastLoopTime, 64); // cap at ~2 frames
                this._lastLoopTime = now;

                if (!this._paused && !this._dragging && !this._atCeiling) {
                    // Ease velocity (expressed in px/ms) back toward natural
                    const natural = DAWN_PX_PER_MS;
                    if (Math.abs(this._velocity - natural) > 0.0001) {
                        const a = 1 - Math.exp(-dt / 200); // 200ms ease constant
                        this._velocity += (natural - this._velocity) * a;
                        // Never let it drop below natural — accidental taps only
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

            // Patch _screenY to use cached height (no reflow in _render)
            textPlayer._render = function() {
                if (!this._overlay) return;
                const H2     = window.innerHeight;
                const mp     = this._getMoonPhase();
                const CEIL   = 58 + 8;
                const FADEPX = 80;
                const MID    = H2 * 0.5; // not used in dawn but keep symmetric
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

            // _naturalVel kept in sync (used by drag/fling calculations in px/ms)
            textPlayer._naturalVel = DAWN_PX_PER_MS;
            textPlayer._velocity   = DAWN_PX_PER_MS;

            // ── Layout constants ──────────────────────────────────────────────
            const H        = window.innerHeight;
            const CEIL_PX  = 58;                       // just below slider strip
            const FADE_FRAC = Math.min(0.10, 60 / H);  // top fade zone ~60px
            const FADE_BOT  = 0.07;                    // bottom entry fade

            // ── Remove the ceiling clamp entirely ────────────────────────────
            // STP's _loop clamps _scrollY at _ceilingY and sets _atCeiling.
            // We set _ceilingY to a huge value so the clamp never fires,
            // letting text scroll all the way off the top of the screen.
            // _onReachCeiling is also neutered so no hold timer starts.
            textPlayer._ceilingY       = 999999;
            textPlayer._onReachCeiling = function() {};
            textPlayer._onComplete     = function() {};

            // ── Expand hitZone to full screen so swipe works everywhere ──────────
            // STP's hitZone defaults to the bottom 50% only (HIT_ZONE_TOP=0.50).
            // Text scrolls into the top of the screen, so we expand it to cover
            // the full viewport — excluding only the slim slider strip at the top.
            if (textPlayer._hitZone) {
                const SLIDER_H = 52;
                textPlayer._hitZone.style.top    = SLIDER_H + 'px';
                textPlayer._hitZone.style.height = (window.innerHeight - SLIDER_H) + 'px';
                textPlayer._hitZone.style.bottom = '';
            }

            // ── Patch _gestureEnd to clamp fling floor at -_naturalVel ──────────
            // STP's fling on release can set _velocity near zero from an accidental
            // tap, then the 1600ms ease-back causes visible slowdown.
            // Fix: after a fling, clamp velocity so it never drops below
            // -_naturalVel (full reverse) — but crucially, a pure tap (wasTap=true)
            // simply pauses and resumes without touching velocity, which is fine.
            // Forward flings above _naturalVel are still allowed (speed-up gesture).
            const origGestureEnd = textPlayer._gestureEnd.bind(textPlayer);
            textPlayer._gestureEnd = function(endY, wasTap) {
                origGestureEnd(endY, wasTap);
                // After fling, if velocity was set near-zero by an accidental touch,
                // snap it back to _naturalVel.
                if (!wasTap && !this._atCeiling) {
                    if (this._velocity > -this._naturalVel && this._velocity < this._naturalVel) {
                        this._velocity = this._naturalVel;
                    }
                }
            };

            // ── Poll: exit when last line has fully left the top ──────────────
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

            // (_render patched above with time-based loop)
            // After start(), all wrapper divs are in the DOM.
            // enEl is always the second child of each wrapper.
            // Query every div that is a :nth-child(2) inside the overlay.
            setTimeout(() => {
                enEls = Array.from(container.querySelectorAll('div > div > div:nth-child(2)'));
                console.log('[dawnCrossing] enEls found:', enEls.length);
            }, 100);
        } catch(e) {
            console.error('[dawnCrossing] Text modules failed.\nCheck SCROLLING_TEXT_PATH + DAWN_TEXTS_PATH\n', e);
        }
    }, 2000);

    // ── Music fade ────────────────────────────────────────────────────────────
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

    const hardCap = setTimeout(() => { if (!sceneDone) beginExit(); }, SCENE_DURATION);

    // ── Exit ──────────────────────────────────────────────────────────────────
    function beginExit() {
        if (sceneDone) return;
        sceneDone = true;
        clearTimeout(textTimer); clearTimeout(hardCap);
        if (textPlayer) { textPlayer.destroy(); textPlayer=null; }
        window.removeEventListener('resize', resize);
        thumbStyle.remove();
        fontOverride.remove();
        // Fade and close audio context
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
        veil.style.cssText=[
            'position:fixed;inset:0;z-index:1000000;',
            'background:#adb5be;opacity:0;transition:opacity 2.8s ease;pointer-events:none;',
        ].join('');
        document.body.appendChild(veil);
        setTimeout(() => {
            cancelAnimationFrame(rafId);
            requestAnimationFrame(() => { veil.style.opacity='1'; });
        }, 500);
        setTimeout(() => {
            container.remove(); veil.remove();
            const gc = document.getElementById('gameContainer');
            if (gc) { gc.style.display=''; gc.style.opacity='1'; gc.style.position='fixed'; gc.style.inset='0'; gc.style.zIndex='999999'; }
            if (onComplete) onComplete();
        }, 3900);
    }

    // ── Boat sounds ───────────────────────────────────────────────────────────
    // Pure Web Audio synthesis — no assets. Three sound layers:
    //   1. Water rush   — filtered noise burst on each stroke, following blade speed
    //   2. Creak/knock  — occasional low woody thump (rowlock, timber settle)
    //   3. Drip/splash  — sparse high transients, like droplets falling from raised blades
    //
    // All sounds are gentle and intermittent, forming an ambient texture.

    let boatAC    = null;   // AudioContext, created on first stroke
    let masterOut = null;   // master gain → destination
    let lastCreak = 0;
    let lastDrip  = 0;

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

    // Noise buffer — 2s of white noise, reused for all water sounds
    let _noiseBuf = null;
    function getNoiseBuf() {
        if (_noiseBuf) return _noiseBuf;
        if (!boatAC) return null;
        const sr  = boatAC.sampleRate;
        const buf = boatAC.createBuffer(1, sr * 2, sr);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random()*2-1;
        _noiseBuf = buf;
        return buf;
    }

    // Water rush — bandpass-filtered noise, short burst
    // intensity 0-1 controls how hard the blade bites
    function playWaterRush(intensity) {
        if (!ensureAudio()) return;
        const ac  = boatAC, now = ac.currentTime;
        const buf = getNoiseBuf();
        if (!buf) return;

        const src = ac.createBufferSource();
        src.buffer = buf;
        src.loop   = true;

        // Bandpass centred around 380 Hz — the "rushing water" frequency zone
        const bp  = ac.createBiquadFilter();
        bp.type            = 'bandpass';
        bp.frequency.value = 380;
        bp.Q.value         = 1.8;

        // Second bandpass for texture — slightly higher
        const bp2 = ac.createBiquadFilter();
        bp2.type            = 'bandpass';
        bp2.frequency.value = 720;
        bp2.Q.value         = 2.4;

        const g  = ac.createGain();
        const g2 = ac.createGain();

        src.connect(bp);  bp.connect(g);   g.connect(masterOut);
        src.connect(bp2); bp2.connect(g2); g2.connect(masterOut);

        const vol = 0.18 + intensity * 0.22;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(vol, now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.9 + intensity * 0.4);

        g2.gain.setValueAtTime(0, now);
        g2.gain.linearRampToValueAtTime(vol * 0.4, now + 0.06);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        src.start(now);
        src.stop(now + 1.4);
    }

    // Creak / knock — low woody transient (rowlock settling, timber flex)
    function playCreak() {
        if (!ensureAudio()) return;
        const ac  = boatAC, now = ac.currentTime;

        // Low thud component
        const osc1 = ac.createOscillator();
        osc1.type  = 'sine';
        osc1.frequency.setValueAtTime(110 + Math.random()*40, now);
        osc1.frequency.exponentialRampToValueAtTime(48, now + 0.18);

        // Woody click component
        const buf = getNoiseBuf();
        const src = ac.createBufferSource();
        src.buffer = buf;
        const hp  = ac.createBiquadFilter();
        hp.type   = 'highpass'; hp.frequency.value = 900; hp.Q.value = 0.8;
        const lp  = ac.createBiquadFilter();
        lp.type   = 'lowpass';  lp.frequency.value = 2200; lp.Q.value = 0.6;

        const g1 = ac.createGain(), g2 = ac.createGain();

        osc1.connect(g1); g1.connect(masterOut);
        src.connect(hp); hp.connect(lp); lp.connect(g2); g2.connect(masterOut);

        g1.gain.setValueAtTime(0, now);
        g1.gain.linearRampToValueAtTime(0.28, now + 0.008);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        g2.gain.setValueAtTime(0, now);
        g2.gain.linearRampToValueAtTime(0.12, now + 0.004);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc1.start(now); osc1.stop(now + 0.25);
        src.start(now);  src.stop(now + 0.1);
    }

    // Drip / droplet — high bright transient, like water falling from lifted blade
    function playDrip() {
        if (!ensureAudio()) return;
        const ac  = boatAC, now = ac.currentTime;

        // 2–3 micro-droplet pings, slightly randomised pitch and timing
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const delay = i * (0.04 + Math.random() * 0.06);
            const freq  = 1800 + Math.random() * 900;

            const osc = ac.createOscillator();
            osc.type  = 'sine';
            osc.frequency.value = freq;

            const g = ac.createGain();
            osc.connect(g); g.connect(masterOut);

            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(0.06 + Math.random()*0.04, now + delay + 0.004);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);

            osc.start(now + delay);
            osc.stop(now  + delay + 0.2);
        }
    }

    // Bubbles — slow gurgling, like water eddying under the hull
    function playBubble() {
        if (!ensureAudio()) return;
        const ac = boatAC, now = ac.currentTime;
        const count = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            const delay = i * (0.06 + Math.random() * 0.14);
            const freq  = 180 + Math.random() * 220;   // low, wet
            const osc   = ac.createOscillator();
            osc.type    = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            osc.frequency.linearRampToValueAtTime(freq * 1.6, now + delay + 0.08);
            const g = ac.createGain();
            osc.connect(g); g.connect(masterOut);
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(0.07 + Math.random()*0.05, now + delay + 0.012);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.22 + Math.random()*0.18);
            osc.start(now + delay);
            osc.stop(now  + delay + 0.45);
        }
    }

    // Ominous creak — deep, slow, resonant. Different from the rowlock knock.
    // Models the hull flexing under water pressure.
    function playOminousCreak() {
        if (!ensureAudio()) return;
        const ac = boatAC, now = ac.currentTime;
        // Very low descending pitch with harmonic shimmer
        for (const [baseFreq, vol, dur] of [
            [62,  0.32, 1.8],   // fundamental — deep hull groan
            [124, 0.10, 1.2],   // 2nd harmonic
            [186, 0.04, 0.7],   // 3rd — thin, unsettling
        ]) {
            const osc = ac.createOscillator();
            osc.type  = 'sawtooth';
            osc.frequency.setValueAtTime(baseFreq + Math.random()*8, now);
            osc.frequency.linearRampToValueAtTime(baseFreq * 0.72, now + dur);
            const lp = ac.createBiquadFilter();
            lp.type  = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 3.5;
            const g  = ac.createGain();
            osc.connect(lp); lp.connect(g); g.connect(masterOut);
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(vol, now + 0.06);
            g.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.start(now); osc.stop(now + dur + 0.1);
        }
    }

    let lastBubble = 0, lastOminous = 0;

    function tickSounds(now, inStroke, strokeT, inReturn, returnT) {
        // Water rush: fires once near start of each stroke
        if (inStroke && strokeT < 0.08) {
            playWaterRush(0.5 + strokeT * 3);
        }
        // Rowlock knock: occasional, 6–14s apart
        if (now - lastCreak > 6000 && Math.random() < 0.0008) {
            lastCreak = now;
            playCreak();
        }
        // Drip: occasional, only during early return, 5–12s apart
        if (inReturn && returnT < 0.22 && now - lastDrip > 5000 && Math.random() < 0.04) {
            lastDrip = now;
            playDrip();
        }
        // Bubbles: random, 4–10s apart
        if (now - lastBubble > 4000 && Math.random() < 0.0012) {
            lastBubble = now;
            playBubble();
        }
        // Ominous creak: rare, 12–25s apart, never during stroke
        if (!inStroke && now - lastOminous > 12000 && Math.random() < 0.0004) {
            lastOminous = now;
            playOminousCreak();
        }
    }

    // ── Ripples ───────────────────────────────────────────────────────────────
    // Each stroke spawns iridescent bracket-ripples BEHIND the boat only.
    //
    // La Tène squirm: instead of smooth arcs we draw polylines where the
    // radius oscillates: r(θ) = R + A·sin(freq·θ + phase + time·speed)
    // This makes each ring writhe slowly like knotwork interlace.
    // Multiple harmonics are layered so the motion is organic not mechanical.
    //
    // Orientation: each ripple stores the boat's forward angle at spawn time.
    // We clip to the rear half-plane so nothing extends in front of the hull.

    const RIPPLE_LIFE   = 11000;
    const RIPPLE_MAX_R  = 0.30;
    const RIPPLE_SETS   = 10;
    let   ripples       = [];
    let   lastRipple    = 0;

    function rippleColor(hue, alpha) {
        return `hsla(${(hue%360).toFixed(1)},44%,74%,${alpha.toFixed(3)})`;
    }

    // angle: boat heading in radians (atan2 of velocity)
    function spawnRipple(x, y, angle) {
        if (ripples.length >= RIPPLE_SETS) ripples.shift();
        ripples.push({
            x, y,
            born:      performance.now(),
            angle,                              // boat heading at spawn
            hueOffset: Math.random() * 360,
            scaleX:    0.85 + Math.random() * 0.18,
            scaleY:    0.38 + Math.random() * 0.14,
            // unique squirm seeds per ripple so they each wriggle differently
            sqPhase:   Math.random() * Math.PI * 2,
            sqPhase2:  Math.random() * Math.PI * 2,
        });
    }

    // Draw one squirming ring as a polyline with soft endpoint fade.
    // Segments near the arc endpoints fade to transparent, dissolving the
    // ring naturally into the hull rather than cutting off hard.
    // baseAlpha: the stroke alpha at the peak of the arc.
    // strokeColor: base rgba string (alpha will be overridden per-segment).
    function drawSquirmArc(ctx, R, startAngle, endAngle, sqAmp, sqFreq, sqTime, sqPh, sqPh2, baseAlpha, hue) {
        const STEPS    = 52;
        const FADE_END = 0.18;  // fraction of arc that fades in/out at each end
        for (let s = 0; s < STEPS; s++) {
            const t0 = s       / STEPS;
            const t1 = (s + 1) / STEPS;
            // Endpoint fade — taper alpha at both ends of the arc
            const endFade0 = t0 < FADE_END
                ? t0 / FADE_END
                : t0 > 1 - FADE_END
                    ? (1 - t0) / FADE_END
                    : 1;
            const segAlpha = baseAlpha * endFade0;
            if (segAlpha < 0.003) continue;

            const a0 = startAngle + (endAngle - startAngle) * t0;
            const a1 = startAngle + (endAngle - startAngle) * t1;
            const sq0 = sqAmp * (Math.sin(sqFreq*a0 + sqTime*1.1 + sqPh)*0.65 + Math.sin(sqFreq*a0*3 + sqTime*0.7 + sqPh2)*0.35);
            const sq1 = sqAmp * (Math.sin(sqFreq*a1 + sqTime*1.1 + sqPh)*0.65 + Math.sin(sqFreq*a1*3 + sqTime*0.7 + sqPh2)*0.35);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a0)*(R+sq0), Math.sin(a0)*(R+sq0));
            ctx.lineTo(Math.cos(a1)*(R+sq1), Math.sin(a1)*(R+sq1));
            ctx.strokeStyle = rippleColor(hue, segAlpha);
            ctx.stroke();
        }
    }

    // ── Skye image ────────────────────────────────────────────────────────────
    // Fades in from 0→20% opacity over the second half of the scene.
    // Drawn at the top of the canvas, anchored to the horizon.
    const skyeImg = new Image();
    skyeImg.src   = 'assets/skye0.png';   // relative to game root
    let skyeLoaded = false;
    skyeImg.onload  = () => { skyeLoaded = true; };
    skyeImg.onerror = () => { console.warn('[dawnCrossing] skye0.png not found — continuing without it'); };

    // ── Render ────────────────────────────────────────────────────────────────
    const startTime    = performance.now();
    let   rafId        = null;
    let   boatProgress = 0;

    function draw(now) {
        rafId = requestAnimationFrame(draw);
        const W = canvas.width, H = canvas.height;
        const elapsed = now - startTime;

        // Sea colour
        const colT = clamp(elapsed/SEA_DAWN_END, 0, 1);
        const colE = easeIO(colT);
        const sr = colT<0.5 ? lerp(2,  50, colT*2) : lerp(50, 138, (colT-0.5)*2);
        const sg = colT<0.5 ? lerp(4,  62, colT*2) : lerp(62, 148, (colT-0.5)*2);
        const sb = colT<0.5 ? lerp(10, 80, colT*2) : lerp(80, 158, (colT-0.5)*2);

        // Clean clear
        ctx.fillStyle = `rgb(${Math.round(sr)},${Math.round(sg)},${Math.round(sb)})`;
        ctx.fillRect(0, 0, W, H);

        // Sea shimmer
        for (let i = 0; i < 180; i++) {
            const fy = i/180, y = fy*H;
            const ir = sr + Math.sin(fy*11.4 + elapsed*0.00042         ) * (5+colE*8);
            const ig = sg + Math.sin(fy*7.2  + elapsed*0.00037 + 1.2   ) * (7+colE*10);
            const ib = sb + Math.cos(fy*9.5  + elapsed*0.00051 + fy*0.5) * (9+colE*12);
            const dx = Math.sin(fy*5.3 + elapsed*0.00045 + i*0.07) * (fy*4);
            ctx.fillStyle=`rgba(${Math.round(clamp(ir,0,255))},${Math.round(clamp(ig,0,255))},${Math.round(clamp(ib,0,255))},0.22)`;
            ctx.fillRect(Math.round(dx), Math.round(y), W+6, Math.ceil(H/180+1));
        }

        // Stars
        const starFadeT = clamp(elapsed/STAR_FADE_END, 0, 1);
        const starAlpha = 1 - easeIO(starFadeT);
        if (starAlpha > 0.003) {
            // Swirl speed decelerates as dawn approaches
            const swirlSpd = Math.max(0, 1 - starFadeT * 1.1);
            for (const s of stars) {
                // Orbital swirl around canvas centre
                s.swirlAng += s.swirlSpd * swirlSpd;
                s.x = 0.5 + Math.cos(s.swirlAng) * s.swirlRad;
                s.y = 0.5 + Math.sin(s.swirlAng) * s.swirlRad;
                const tw = 0.55 + 0.45 * Math.sin(elapsed * s.ts + s.to);
                // Brighter at scene start, warm to amber as dawn comes
                const rC = Math.round(lerp(235, 168, starFadeT));
                const gC = Math.round(lerp(240, 182, starFadeT));
                ctx.beginPath();
                ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${rC},${gC},255,${s.base * tw * starAlpha})`;
                ctx.fill();
            }
        }

        // ── Skye silhouette — fades in from 50% scene onward ─────────────────
        if (skyeLoaded) {
            const skyeT   = clamp((elapsed - SCENE_DURATION*0.45) / (SCENE_DURATION*0.5), 0, 1);
            const skyeAlpha = skyeT * 0.20;   // max 20% opacity
            if (skyeAlpha > 0.001) {
                const aspect = skyeImg.naturalWidth / skyeImg.naturalHeight;
                const skyeW  = W;
                const skyeH  = skyeW / aspect;
                ctx.save();
                ctx.globalAlpha = skyeAlpha;
                // Anchor to top — mountains loom at the horizon
                ctx.drawImage(skyeImg, 0, 52, skyeW, skyeH);
                ctx.restore();
            }
        }

        // ── Ripples — La Tène squirming wake ──────────────────────────────────
        // Rings expand rearward only (clipped to rear half-plane relative to
        // boat heading). Radius oscillates with layered harmonics — the rings
        // writhe and breathe. Three stroke layers per arc (glow/core/hot).
        {
            const rNow = performance.now();
            ripples = ripples.filter(r => (rNow - r.born) < RIPPLE_LIFE);

            ctx.save();
            ctx.lineCap  = 'round';
            ctx.lineJoin = 'round';

            for (const rip of ripples) {
                const age   = rNow - rip.born;
                const lifeT = age / RIPPLE_LIFE;
                const fadeA = lifeT < 0.06
                    ? lifeT / 0.06
                    : 1 - Math.pow(lifeT, 1.25);
                if (fadeA < 0.004) continue;

                const maxR   = H * RIPPLE_MAX_R;
                const RINGS  = 6;
                // Time-driven squirm speed — slow, organic
                const sqTime = elapsed * 0.0022 + rip.sqPhase;  // faster wriggle

                ctx.save();
                ctx.translate(rip.x, rip.y);
                // No rotation, no hard clip.
                // Flatten to water-surface perspective.
                ctx.scale(rip.scaleX, rip.scaleY);
                // Soft front fade is applied per-ring via alpha modulation below.

                for (let ring = 0; ring < RINGS; ring++) {
                    const ringDelay = (ring / RINGS) * 0.35;
                    const ringT     = clamp((lifeT - ringDelay) / (1 - ringDelay), 0, 1);
                    if (ringT <= 0) continue;

                    const R     = maxR * ringT;
                    const hue   = rip.hueOffset + elapsed * 0.018 + ring * 32;
                    const lw    = Math.max(0.3, (1 - ringT * 0.65) * 2.4);
                    const alpha = fadeA * (1 - ringT * 0.45) * (0.58 - ring * 0.055);
                    if (alpha < 0.004 || R < 1) continue;

                    // Squirm: generous amplitude so the wriggle reads clearly
                    const sqAmp  = R * (0.08 + ringT * 0.16);
                    // Frequency: varies per ring, non-integer so rings never sync up
                    const sqFreq = 2.7 + ring * 1.7;
                    // Per-ring phase offset so each ring has its own wriggle
                    const sqPh   = rip.sqPhase  + ring * 1.4;
                    const sqPh2  = rip.sqPhase2 + ring * 0.9;

                    // Full lower semicircle (π to 2π = bottom half in rotated space)
                    const arcS = 0, arcE = Math.PI;

                    // ── Three stroke layers — alpha + hue passed per segment ──
                    // Outer glow
                    ctx.lineWidth = lw * 8;
                    drawSquirmArc(ctx, R, arcS, arcE, sqAmp, sqFreq, sqTime, sqPh, sqPh2, alpha * 0.11, hue);

                    // Core
                    ctx.lineWidth = lw * 2.4;
                    drawSquirmArc(ctx, R, arcS, arcE, sqAmp, sqFreq, sqTime, sqPh, sqPh2, alpha * 0.40, hue);

                    // Hot bright centre
                    ctx.lineWidth = Math.max(0.4, lw * 0.6);
                    drawSquirmArc(ctx, R, arcS, arcE, sqAmp, sqFreq, sqTime, sqPh, sqPh2, alpha * 0.88, (hue+35)%360);

                    // ── Secondary inner arc — knotwork layering ───────────────
                    const h2    = (hue + 55 + ring * 18) % 360;
                    const alpha2 = alpha * 0.35;
                    if (alpha2 > 0.005) {
                        const arcS2 = Math.PI * 0.12, arcE2 = Math.PI * 0.88;
                        ctx.lineWidth = lw * 1.6;
                        drawSquirmArc(ctx, R*0.80, arcS2, arcE2, sqAmp*1.3, sqFreq+1, sqTime*1.2, sqPh2, sqPh, alpha2*0.38, h2);
                        ctx.lineWidth = Math.max(0.3, lw * 0.45);
                        drawSquirmArc(ctx, R*0.80, arcS2, arcE2, sqAmp*1.3, sqFreq+1, sqTime*1.2, sqPh2, sqPh, alpha2*0.82, (h2+25)%360);
                    }
                }
                ctx.restore();
            }
            ctx.restore();
        }

        // ── Boat ──────────────────────────────────────────────────────────────
        // Oar cycle phases within OAR_CYCLE ms:
        //   0            … READY_MS          → READY  (forward, raised, at rest)
        //   READY_MS     … +STROKE_MS        → STROKE (catch → finish, blades in water)
        //   READY_MS+STROKE_MS … +RETURN_MS  → RETURN (lift, swing forward to ready)

        const cycMs     = elapsed % OAR_CYCLE;
        const inReady   = cycMs < READY_MS;
        const inStroke  = !inReady && cycMs < READY_MS + STROKE_MS;
        const inReturn  = !inReady && !inStroke;

        const strokeT   = inStroke ? (cycMs - READY_MS) / STROKE_MS : 0;
        const returnT   = inReturn ? (cycMs - READY_MS - STROKE_MS) / RETURN_MS : 0;

        // Stroke envelope for boat surge
        const strokeEnv = inStroke ? Math.sin(strokeT * Math.PI) : 0;

        // Boat position: surges during stroke, coasts at reduced rate during ready/return
        const baseRate   = 1 / (BOAT_DURATION / (1000/60));
        const coastRate  = inReturn
            ? lerp(0.55, 0.40, returnT)   // gentle deceleration through return
            : 0.45;                         // slow drift during ready pause
        const surgeScale = inStroke ? (1.0 + strokeEnv * 1.1) : coastRate;
        boatProgress     = clamp(boatProgress + baseRate * surgeScale, 0, 1);

        const boatE  = easeIO(boatProgress);
        const boatX  = lerp(W*0.50, W*0.82, boatE);
        const boatY  = lerp(H*0.82, H*0.38, boatE);

        // Tick sounds with current phase state
        tickSounds(now, inStroke, strokeT, inReturn, returnT);

        // Spawn ripple pair at stroke finish
        if (inReturn && returnT < 0.04 && now - lastRipple > OAR_CYCLE * 0.8) {
            lastRipple = now;
            // Boat heading angle — used to orient ripples rearward only
            const boatAngle = Math.atan2(boatY - lerp(H*0.82,H*0.38,easeIO(Math.max(0,boatProgress-0.005))), boatX - lerp(W*0.50,W*0.82,easeIO(Math.max(0,boatProgress-0.005))));
            spawnRipple(boatX - 16, boatY + 5, boatAngle);
            spawnRipple(boatX + 16, boatY + 5, boatAngle);
        }

        const persp  = lerp(1.0, 0.22, boatE);
        const bAlpha = lerp(1.0, 0.0, clamp((boatE-0.68)/0.32, 0, 1));
        const SCALE  = Math.max(1, Math.round((W/145)*persp));
        const bw = BOAT_W*SCALE, bh = BOAT_H*SCALE;
        const bLeft = boatX - bw*0.5, bTop = boatY - bh;

        // ── Oar position ──────────────────────────────────────────────────────
        // The pivot point for each oar is at the gunwale (top edge of hull).
        // pullAngle: angle the oar shaft makes relative to perpendicular
        // liftY: how far the blade end is lifted above the water line (in px)
        //
        // READY:  oars angled forward (READY_ANGLE), lifted (READY_LIFT)
        //         — resting forward position, blades clear of water
        // STROKE: sweep from CATCH_ANGLE to FINISH_ANGLE, liftY=0 (blades in water)
        // RETURN: lift oars from FINISH_ANGLE back to READY_ANGLE+READY_LIFT
        //
        // The oar pivot is FIXED to the hull at bTop+bh*0.38.
        // pullAngle is applied as a rotation at that pivot.
        // liftY translates the entire oar upward from the pivot — this is what
        // keeps blades attached to the hull during the lift phase.

        let pullAngle, liftY;

        if (inReady) {
            // Still at ready position — oars forward and raised
            pullAngle = READY_ANGLE;
            liftY     = SCALE * READY_LIFT;
        } else if (inStroke) {
            // Sweep through water: double-eased for natural feel
            const sweepT  = easeOut(easeIn(strokeT));
            pullAngle = lerp(CATCH_ANGLE, FINISH_ANGLE, sweepT);
            liftY     = 0;  // blades in water
        } else {
            // Return: lift from finish, swing forward to ready
            // liftY: rises through first 60% of return, then settles at READY_LIFT
            const liftT   = clamp(returnT / 0.60, 0, 1);
            const settleT = clamp((returnT - 0.60) / 0.40, 0, 1);
            const peakLift = SCALE * READY_LIFT * 1.3;  // slightly higher arc than rest
            liftY = returnT < 0.60
                ? lerp(0, peakLift, easeOut(liftT))
                : lerp(peakLift, SCALE * READY_LIFT, easeIn(settleT));
            // Angle swings from finish back to ready
            pullAngle = lerp(FINISH_ANGLE, READY_ANGLE, easeIO(returnT));
        }

        const oAlpha = clamp(persp*2.2, 0, 1) * bAlpha;

        // Hull reflection
        if (bAlpha > 0.02) {
            ctx.save();
            ctx.globalAlpha = 0.07*(1-boatE*0.4)*bAlpha;
            ctx.translate(bLeft, bTop+bh+1); ctx.scale(1,-0.14);
            for (let row=0; row<BOAT_H; row++)
                for (let col=0; col<BOAT_W; col++)
                    if (BOAT_PIXELS[row][col]==='1') {
                        ctx.fillStyle=`rgba(${Math.round(sr+14)},${Math.round(sg+17)},${Math.round(sb+22)},1)`;
                        ctx.fillRect(col*SCALE, row*SCALE, SCALE, SCALE);
                    }
            ctx.restore();
        }

        // Oars — pivot fixed at gunwale, liftY raises the whole assembly
        function drawOar(frac, dir) {
            if (oAlpha < 0.01) return;
            ctx.save();
            ctx.globalAlpha = oAlpha;
            ctx.translate(bLeft + bw*frac, bTop + bh*0.55 - liftY);
            ctx.rotate(pullAngle * dir);
            ctx.strokeStyle = '#050810';
            ctx.lineWidth   = Math.max(1, SCALE*0.55);
            ctx.beginPath();
            // Shaft: handle end extends inward (-dir) toward centreline,
            // blade end extends outward. Handles nearly meet above the rower.
            ctx.moveTo(-dir*SCALE*7, -SCALE*0.8);   // handle (inboard, slightly up)
            ctx.lineTo( dir*SCALE*13,  SCALE*2.4);   // blade (outboard)
            ctx.stroke();
            // Blade
            ctx.fillStyle = '#050810';
            ctx.beginPath();
            ctx.ellipse(
                dir*SCALE*13, SCALE*2.4,
                SCALE*1.4, SCALE*0.48,
                pullAngle*dir*0.4, 0, Math.PI*2
            );
            ctx.fill();
            // Handle grip — small rounded end
            ctx.beginPath();
            ctx.arc(-dir*SCALE*7, -SCALE*0.8, Math.max(1, SCALE*0.7), 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
        drawOar(0.26, -1);
        drawOar(0.74,  1);

        // Hull pixels (drawn after oars so hull sits on top)
        if (bAlpha > 0.01) {
            ctx.globalAlpha = bAlpha;
            for (let row=0; row<BOAT_H; row++)
                for (let col=0; col<BOAT_W; col++)
                    if (BOAT_PIXELS[row][col]==='1') {
                        ctx.fillStyle='#040709';
                        ctx.fillRect(Math.round(bLeft+col*SCALE), Math.round(bTop+row*SCALE), SCALE, SCALE);
                    }
            ctx.globalAlpha = 1;
        }

        // Gentle canvas warp
        canvas.style.transform = `skewX(${Math.sin(elapsed*0.00033)*0.0014}rad) skewY(${Math.cos(elapsed*0.00024)*0.0009}rad)`;

        // Vignette
        const vig = ctx.createRadialGradient(W*0.5,H*0.5,H*0.07,W*0.5,H*0.5,H*0.95);
        vig.addColorStop(0,'rgba(0,0,0,0)');
        vig.addColorStop(1,`rgba(1,2,5,${lerp(0.70,0.16,colE)})`);
        ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
    }

    rafId = requestAnimationFrame(draw);
}

