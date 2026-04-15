/**
 * moonWidget.js
 *
 * Universal moon phase widget for Corra.
 * Two modes:
 *
 *   showSlider: true  — full-width strip with track (dawnCrossing)
 *   showSlider: false — standalone fixed moon, top-left corner, swipe to change
 *
 * Swipe right → wax (fuller moon, more English visible)
 * Swipe left  → wane (darker crescent, less English)
 *
 * Drift behaviour:
 *   Phase > 0.25 → drifts back toward 0.25 at ~1% per 9 s.
 *   Phase ≤ 0.25 → no action.
 *   Pauses while dragging or when pauseDrift() is called externally.
 *
 * Public API:
 *   moon.setPhase(v)    — set phase 0–1
 *   moon.getPhase()     — current phase
 *   moon.pauseDrift()
 *   moon.resumeDrift()
 *   moon.destroy()
 */

// ── Constants ──────────────────────────────────────────────────────────────────
const DRIFT_TARGET = 0.25;
const DRIFT_RATE   = 0.1 / 9000;   // gentle drift — only active when English is bright

// ── Factory ────────────────────────────────────────────────────────────────────
export function createMoonWidget(opts = {}) {
    const {
        initialPhase = 0.15,
        onChange     = null,
        onTap        = null,   // called when moon is tapped (not dragged)
        showSlider   = false,
        corner       = 'top-right',  // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
        container    = document.body,
    } = opts;

    // ── Size ───────────────────────────────────────────────────────────────────
    // Fixed mode: large enough to touch comfortably through a phone case.
    // Using 11% of smaller dimension, minimum 48px diameter.
    // Slider mode: slim, fits inside the strip.
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    const moonR  = opts.size
        ? Math.round(opts.size / 2)
        : showSlider
            ? Math.round(minDim * 0.025)
            : Math.max(24, Math.round(minDim * 0.055));
    const moonD  = moonR * 2;

    let phase         = Math.max(0, Math.min(1, initialPhase));
    let rawPhase      = phase;   // unbounded accumulator for cyclic moon
    let dragging      = false;
    let driftPaused   = false;
    let lastFrameTime = null;
    let rafId         = null;
    let destroyed     = false;

    // ── Canvas ─────────────────────────────────────────────────────────────────
    const canvas  = document.createElement('canvas');
    canvas.width  = moonD;
    canvas.height = moonD;

    // ── DOM structure ──────────────────────────────────────────────────────────
    let rootEl;
    let sliderInput = null;
    let trackFillEl = null;
    let wrapperEl   = null;

    if (showSlider) {
        const built = _buildSliderStrip(canvas, moonR, moonD);
        rootEl      = built.strip;
        sliderInput = built.input;
        trackFillEl = built.trackFill;
        wrapperEl   = built.wrapper;

        sliderInput.value = phase;
        _updateTrackFill(trackFillEl, phase);
        container.appendChild(rootEl);

        sliderInput.addEventListener('input', (e) => {
            _setPhaseInternal(parseFloat(e.target.value));
        });
    } else {
        rootEl = _buildFixed(canvas, moonR, moonD, corner);
        document.body.appendChild(rootEl);
    }

    // ── Swipe / drag interaction ───────────────────────────────────────────────
    // Fixed mode: moonD*3 px covers full 0→1 sweep (~3 moon-diameters).
    // This means a short swipe near the corner gives the full range.
    // Slider mode keeps a wider range so the track feels proportional.
    const SWIPE_RANGE = () => showSlider ? window.innerWidth * 0.70 : moonD * 3;

    let dragStartX    = 0;
    let dragStartTime = 0;
    let phaseAtStart  = rawPhase;   // tracks unbounded accumulator

    const onStart = (clientX) => {
        dragging      = true;
        dragStartX    = clientX;
        dragStartTime = performance.now();
        phaseAtStart  = rawPhase;
        canvas.style.cursor = 'grabbing';
    };

    const onMove = (clientX) => {
        if (!dragging) return;
        const range = showSlider && wrapperEl
            ? wrapperEl.offsetWidth - moonR * 2
            : SWIPE_RANGE();
        const delta = (clientX - dragStartX) / range;
        // Accumulate into rawPhase (unbounded) — cyclic triangle wave
        // maps this to display phase so moon rolls continuously.
        _setPhaseInternal(phaseAtStart + delta);
    };

    const onEnd = (clientX) => {
        if (!dragging) return;
        dragging = false;
        canvas.style.cursor = 'grab';
        // Tap = short duration + small movement
        const dt  = performance.now() - dragStartTime;
        const dx  = Math.abs((clientX ?? dragStartX) - dragStartX);
        console.log('[moonWidget] onEnd dt:', dt.toFixed(0), 'dx:', dx.toFixed(1), 'hasTap:', !!onTap);
        if (onTap && dt < 400 && dx < 12) onTap();
    };

    // Pointer events with setPointerCapture — reliable on mobile, no window listeners.
    // Captured pointer events always fire on the element even if finger moves off it.
    const pdHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        canvas.setPointerCapture(e.pointerId);
        onStart(e.clientX);
    };
    const pmHandler = (e) => {
        if (!dragging) return;
        e.preventDefault();
        onMove(e.clientX);
    };
    const puHandler = (e) => {
        if (!dragging) return;
        e.preventDefault();
        canvas.releasePointerCapture(e.pointerId);
        onEnd(e.clientX);
    };

    canvas.addEventListener('pointerdown',   pdHandler, { passive: false });
    canvas.addEventListener('pointermove',   pmHandler, { passive: false });
    canvas.addEventListener('pointerup',     puHandler, { passive: false });
    canvas.addEventListener('pointercancel', puHandler, { passive: false });

    // ── Drift loop ─────────────────────────────────────────────────────────────
    function driftLoop(timestamp) {
        if (destroyed) return;
        rafId = requestAnimationFrame(driftLoop);

        // Only drift when English is brighter than half (phase > 0.5).
        // At or below half the moon is in Irish-dominant territory — leave it alone.
        if (dragging || driftPaused || phase <= 0.25) {
            lastFrameTime = timestamp;
            return;
        }
        if (lastFrameTime === null) { lastFrameTime = timestamp; return; }

        const dt = Math.min(timestamp - lastFrameTime, 100);
        lastFrameTime = timestamp;
        // Always drift toward lower phase (darker moon, less English).
        // Find the nearest integer that represents a dark moon BELOW current cyclePos.
        // cyclePos 0..1 = waxing: drift toward 0 (rawPhase decreases)
        // cyclePos 1..2 = waning: drift toward 2 (rawPhase increases, phase still falling)
        const cp  = _rawToCyclePos(rawPhase);
        const dir = cp <= 1 ? -1 : 1;   // waxing: go back toward dark; waning: continue to dark
        _setPhaseInternal(rawPhase + dir * DRIFT_RATE * dt);
    }

    rafId = requestAnimationFrame(driftLoop);

    // ── Internal setter ────────────────────────────────────────────────────────
    // rawPhase is an unbounded accumulator. displayPhase is derived via a
    // triangle wave so the moon cycles full→crescent→dark→crescent→full
    // continuously in either swipe direction.
    // cyclePos in [0,2): 0..1 = waxing (dark->full), 1..2 = waning (full->dark)
    function _rawToCyclePos(raw) {
        return ((raw % 2) + 2) % 2;
    }

    // Triangle wave: 0=dark, 1=full, and both visual phase and opacity track together.
    // Swipe right = fuller moon = more English. Simple and clear.
    function _cycleToPhase(cp) {
        return cp <= 1 ? cp : 2 - cp;
    }

    function _setPhaseInternal(v) {
        rawPhase       = v;
        const cyclePos = _rawToCyclePos(rawPhase);
        phase          = _cycleToPhase(cyclePos);  // 0=dark/no English, 1=full/full English
        _drawMoon(canvas, phase, moonR, cyclePos);

        if (showSlider) {
            if (sliderInput) sliderInput.value = phase;
            if (trackFillEl) _updateTrackFill(trackFillEl, phase);
            if (wrapperEl)   _positionMoonCanvas(canvas, wrapperEl, phase, moonR);
        }

        if (onChange) onChange(phase);
    }

    // ── Initial render ─────────────────────────────────────────────────────────
    _drawMoon(canvas, phase, moonR, 0);   // initial: waxing
    if (showSlider && wrapperEl) {
        requestAnimationFrame(() => _positionMoonCanvas(canvas, wrapperEl, phase, moonR));
    }

    // ── Public API ─────────────────────────────────────────────────────────────
    return {
        element:      rootEl,
        setPhase(v)   { _setPhaseInternal(v); },   // v treated as rawPhase
        getPhase()    { return phase; },
        pauseDrift()  { driftPaused = true; },
        resumeDrift() { driftPaused = false; lastFrameTime = null; },
        destroy() {
            destroyed = true;
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            canvas.removeEventListener('pointerdown',   pdHandler);
            canvas.removeEventListener('pointermove',   pmHandler);
            canvas.removeEventListener('pointerup',     puHandler);
            canvas.removeEventListener('pointercancel', puHandler);
            if (rootEl && rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
        },
    };
}

// ── Fixed-position standalone moon ────────────────────────────────────────────
// Sits in the top-left with generous margin to clear phone case edges.
// The wrapper is meaningfully larger than the moon canvas for a comfortable
// touch target — important for thick-cased phones where corner px are stiff.
function _buildFixed(moonCanvas, moonR, moonD, corner = 'top-right') {
    const margin = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.04);
    const pad    = 18;

    // Map corner string to CSS edge properties
    const isTop    = corner.startsWith('top');
    const isLeft   = corner.endsWith('left');
    const vEdge    = isTop  ? `top:${margin}px;`    : `bottom:${margin}px;`;
    const hEdge    = isLeft ? `left:${margin}px;`   : `right:${margin}px;`;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
        'position:fixed;',
        vEdge,
        hEdge,
        `width:${moonD + pad * 2}px;`,
        `height:${moonD + pad * 2}px;`,
        'z-index:1000003;',   // above scene (999999), veils (1000000), and hub (1000002)
        'display:flex;',
        'align-items:center;',
        'justify-content:center;',
        'pointer-events:all;',
        // Tile only — no rgba backing so the transparent canvas corners
        // don't produce a visible dark square around the moon.
        'background:url(assets/ciorcal-glass-bg.png) center/cover no-repeat;',
    ].join('');

    moonCanvas.style.cssText = [
        `width:${moonD}px;`,
        `height:${moonD}px;`,
        'cursor:grab;',
        'touch-action:none;',
        'display:block;',
        // 180° flips the lit face rightward (matches swipe direction).
        // Additional -20° tilts the moon CCW for a natural sky-hanging angle.
        'transform:rotate(160deg);',
    ].join('');

    wrapper.appendChild(moonCanvas);
    return wrapper;
}

// ── Slider strip (dawnCrossing / full-width strip contexts) ───────────────────
function _buildSliderStrip(moonCanvas, moonR, moonD) {
    if (!document.getElementById('moonWidgetThumbStyle')) {
        const s = document.createElement('style');
        s.id = 'moonWidgetThumbStyle';
        s.textContent = `
            .moon-widget-slider {
                -webkit-appearance:none;appearance:none;
                width:100%;height:10px;border-radius:5px;outline:none;
                cursor:pointer;position:absolute;top:50%;
                transform:translateY(-50%);left:0;margin:0;
                z-index:2;background:transparent;
                pointer-events:all;touch-action:none;
            }
            .moon-widget-slider::-webkit-slider-thumb {
                -webkit-appearance:none;appearance:none;
                width:0;height:0;background:transparent;border:none;box-shadow:none;
            }
            .moon-widget-slider::-moz-range-thumb {
                width:0;height:0;background:transparent;border:none;box-shadow:none;
            }
        `;
        document.head.appendChild(s);
    }

    const strip = document.createElement('div');
    strip.style.cssText = [
        'position:fixed;top:0;left:0;right:0;height:52px;',
        'z-index:999998;display:flex;align-items:center;',
        'justify-content:center;background:rgba(0,0,0,0.28);',
        'pointer-events:all;',
    ].join('');

    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
        'position:relative;width:88%;max-width:600px;',
        `height:${moonD + 10}px;display:flex;align-items:center;`,
    ].join('');

    const trackBg = document.createElement('div');
    trackBg.style.cssText = [
        'position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);',
        'height:8px;border-radius:4px;background:#444;pointer-events:none;',
    ].join('');

    const trackFill = document.createElement('div');
    trackFill.style.cssText = [
        'position:absolute;left:0;top:50%;transform:translateY(-50%);',
        'height:8px;border-radius:4px;pointer-events:none;width:0%;',
        'background:linear-gradient(to right,#d4af37,#f0d060);',
    ].join('');

    const input = document.createElement('input');
    input.type      = 'range';
    input.min       = 0;
    input.max       = 1;
    input.step      = 0.01;
    input.className = 'moon-widget-slider';

    moonCanvas.style.cssText = [
        'position:absolute;top:50%;transform:translateY(-50%);',
        `width:${moonD}px;height:${moonD}px;`,
        'pointer-events:all;cursor:grab;z-index:3;',
    ].join('');

    wrapper.appendChild(trackBg);
    wrapper.appendChild(trackFill);
    wrapper.appendChild(input);
    wrapper.appendChild(moonCanvas);
    strip.appendChild(wrapper);

    return { strip, input, trackFill, wrapper };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function _updateTrackFill(trackFill, phase) {
    if (trackFill) trackFill.style.width = (phase * 100).toFixed(2) + '%';
}

function _positionMoonCanvas(canvas, wrapper, phase, moonR) {
    const usable = wrapper.offsetWidth - moonR * 2;
    if (usable <= 0) return;
    canvas.style.left = (moonR + phase * usable - moonR) + 'px';
}

// ── Drawing ────────────────────────────────────────────────────────────────────
function _drawMoon(canvas, phase, r, cyclePos) {
    // cyclePos: 0..1 = waxing (right crescent), 1..2 = waning (left crescent)
    const waning = (cyclePos !== undefined) && (cyclePos > 1);
    const ctx = canvas.getContext('2d');
    const cx = r, cy = r;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Outer glow
    const grd = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.6);
    grd.addColorStop(0, `rgba(180,170,255,${(0.14 + phase * 0.12).toFixed(3)})`);
    grd.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Dark disc — prevents anything behind bleeding through
    ctx.fillStyle = 'rgb(8,4,30)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.fill();

    // Lit face
    // Blue-violet tint — muted at low phase, richer at full moon
    const lr = Math.round(160 + phase * 20);
    const lg = Math.round(170 + phase * 20);
    const lb = Math.round(225 + phase * 25);
    ctx.fillStyle = `rgb(${lr},${lg},${lb})`;
    ctx.beginPath();
    if (phase >= 0.99) {
        ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    } else {
        const tx = r * 0.92 * Math.cos(phase * Math.PI);
        if (!waning) {
            // Waxing: lit on right — arc right half, ellipse closes left
            ctx.arc(cx, cy, r * 0.92, -Math.PI / 2, Math.PI / 2);
            ctx.ellipse(cx, cy, Math.abs(tx), r * 0.92, 0, Math.PI / 2, -Math.PI / 2, tx > 0);
        } else {
            // Waning: lit on left — arc left half, ellipse closes right
            ctx.arc(cx, cy, r * 0.92, Math.PI / 2, -Math.PI / 2);
            ctx.ellipse(cx, cy, Math.abs(tx), r * 0.92, 0, -Math.PI / 2, Math.PI / 2, tx > 0);
        }
    }
    ctx.fill();

    // Rim highlight
    ctx.strokeStyle = `rgba(180,160,255,${(0.20 + phase * 0.30).toFixed(3)})`;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();

    // Mare detail at higher phases
    if (phase > 0.1) {
        const mare = (mx, my, mr, a) => {
            ctx.fillStyle = `rgba(140,130,200,${(a * phase).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(cx + mx * r * 0.7, cy + my * r * 0.7, mr * r * 0.18, 0, Math.PI * 2);
            ctx.fill();
        };
        mare( 0.2, -0.3, 1.0, 0.18);
        mare(-0.3,  0.1, 0.7, 0.14);
        mare( 0.4,  0.35, 0.6, 0.12);
    }
}

