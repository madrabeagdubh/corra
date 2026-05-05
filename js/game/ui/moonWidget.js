/**
 * moonWidget.js
 *
 * Universal moon phase widget for Corra.
 * Three modes:
 *
 *   showSlider: true   — full-width strip with track
 *   showSlider: false  — standalone fixed moon, corner position, swipe to change
 *   embeddedCanvas     — renders into an existing canvas (dpad hub mode)
 *
 * corner values:
 *   'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'bottom-center'
 *
 * Tap feedback (standalone mode only):
 *   - Outer glow pulses outward and brightens (canvas)
 *   - Wrapper div bounces scale: 1 → 1.12 → 0.96 → 1.0
 *   Both driven by rAF, peak at ~100ms, fully settled by ~480ms.
 *   Fires before the tapHandler so it runs even if the handler triggers a
 *   screen transition.
 *
 * Public API:
 *   moon.setPhase(v)       — set phase 0–1
 *   moon.getPhase()        — current phase
 *   moon.nudgePhase(dx)    — called by Joystick swipe with pixel delta
 *   moon.setTapHandler(fn) — override tap callback at runtime (pass null to clear)
 *   moon.pauseDrift()
 *   moon.resumeDrift()
 *   moon.destroy()
 *   moon.moonD             — pixel diameter (useful for calculating clearance)
 */

// ---------------------------------------------------------------------------
// getMoonBottomOffset(moonD, pad?)
// Status bar height  = STATUS_H = 42px  (matches _statusBar in bogLocationScene)
// Joystick radius    = JOY_R    = 60px  (matches joyR in bogLocationScene)
// Moon centre from screen bottom = STATUS_H + JOY_R = 102px
// ---------------------------------------------------------------------------
const STATUS_H = 42
const JOY_R    = 60

export function getMoonBottomOffset(moonD, pad = 18) {
    const wrapperH         = moonD + pad * 2
    const centreFromBottom = STATUS_H + JOY_R
    return Math.max(8, Math.round(centreFromBottom - wrapperH / 2))
}

// ---------------------------------------------------------------------------

const DRIFT_RATE = 0.1 / 9000

// Tap feedback timing
const PULSE_ATTACK_MS  = 100   // time to peak glow/scale
const PULSE_DECAY_MS   = 380   // time from peak back to rest
const PULSE_TOTAL_MS   = PULSE_ATTACK_MS + PULSE_DECAY_MS

// Glow boost at peak
const PULSE_GLOW_RADIUS_BOOST = 0.55   // added to the base 1.6× radius multiplier
const PULSE_GLOW_ALPHA_BOOST  = 0.28   // added to base glow alpha

// Scale bounce keyframes (wrapper div)
const SCALE_PEAK      = 1.12
const SCALE_OVERSHOOT = 0.96
const SCALE_REST      = 1.00

export function createMoonWidget(opts = {}) {
    const {
        initialPhase   = 0.15,
        onChange       = null,
        onTap          = null,
        showSlider     = false,
        corner         = 'top-right',
        container      = document.body,
        embeddedCanvas = null,
        embeddedRadius = null,
        swipeRange     = 120,
    } = opts

    const embedded = !!embeddedCanvas

    const minDim = Math.min(window.innerWidth, window.innerHeight)
    const moonR  = embeddedRadius ?? (opts.size
        ? Math.round(opts.size / 2)
        : showSlider
            ? Math.round(minDim * 0.025)
            : Math.max(24, Math.round(minDim * 0.055)))
    const moonD  = moonR * 2
    const pad    = 18

    let phase         = Math.max(0, Math.min(1, initialPhase))
    let rawPhase      = phase
    let dragging      = false
    let driftPaused   = false
    let lastFrameTime = null
    let rafId         = null
    let destroyed     = false

    // Runtime-overridable tap handler
    let tapHandler = onTap

    // Pulse state — shared between the draw function and the pulse animator
    let pulseT = 0   // 0 = no pulse, >0 = pulse in progress (0..1 maps attack+decay)

    const canvas  = embeddedCanvas ?? document.createElement('canvas')
    if (!embedded) {
        canvas.width  = moonD
        canvas.height = moonD
    }

    let rootEl      = null
    let sliderInput = null
    let trackFillEl = null
    let wrapperEl   = null

    if (!embedded) {
        if (showSlider) {
            const built = _buildSliderStrip(canvas, moonR, moonD)
            rootEl      = built.strip
            sliderInput = built.input
            trackFillEl = built.trackFill
            wrapperEl   = built.wrapper

            sliderInput.value = phase
            _updateTrackFill(trackFillEl, phase)
            container.appendChild(rootEl)

            sliderInput.addEventListener('input', (e) => {
                _setPhaseInternal(parseFloat(e.target.value))
            })
        } else {
            rootEl = _buildFixed(canvas, moonR, moonD, pad, corner)
            document.body.appendChild(rootEl)
        }

        const SWIPE_RANGE = () => showSlider ? window.innerWidth * 0.70 : moonD * 3

        let dragStartX    = 0
        let dragStartTime = 0
        let phaseAtStart  = rawPhase

        const onStart = (clientX) => {
            dragging      = true
            dragStartX    = clientX
            dragStartTime = performance.now()
            phaseAtStart  = rawPhase
            canvas.style.cursor = 'grabbing'
        }

        const onMove = (clientX) => {
            if (!dragging) return
            const range = showSlider && wrapperEl
                ? wrapperEl.offsetWidth - moonR * 2
                : SWIPE_RANGE()
            const delta = (clientX - dragStartX) / range
            _setPhaseInternal(phaseAtStart + delta)
        }

        const onEnd = (clientX) => {
            if (!dragging) return
            dragging = false
            canvas.style.cursor = 'grab'
            const dt = performance.now() - dragStartTime
            const dx = Math.abs((clientX ?? dragStartX) - dragStartX)
            if (dt < 400 && dx < 12) {
                // Trigger visual feedback first, then fire the handler.
                // Feedback runs independently via rAF so a screen transition
                // won't cut it short.
                _triggerTapFeedback()
                if (tapHandler) tapHandler()
            }
        }

        const pdHandler = (e) => {
            e.preventDefault()
            e.stopPropagation()
            canvas.setPointerCapture(e.pointerId)
            onStart(e.clientX)
        }
        const pmHandler = (e) => {
            if (!dragging) return
            e.preventDefault()
            onMove(e.clientX)
        }
        const puHandler = (e) => {
            if (!dragging) return
            e.preventDefault()
            canvas.releasePointerCapture(e.pointerId)
            onEnd(e.clientX)
        }

        canvas.addEventListener('pointerdown',   pdHandler, { passive: false })
        canvas.addEventListener('pointermove',   pmHandler, { passive: false })
        canvas.addEventListener('pointerup',     puHandler, { passive: false })
        canvas.addEventListener('pointercancel', puHandler, { passive: false })
    }

    // ── Tap feedback ──────────────────────────────────────────────────────────
    // Drives two simultaneous effects:
    //   1. pulseT fed into _drawMoon to boost the outer glow
    //   2. CSS transform on rootEl for the scale bounce
    //
    // Timeline (ms):
    //   0              → PULSE_ATTACK_MS  : ease-out ramp up  (glow + scale expand)
    //   PULSE_ATTACK_MS → ~60% of decay   : ease-in ramp down + overshoot on scale
    //   remainder                         : settle back to rest
    //
    function _easeOut(t) { return 1 - (1 - t) * (1 - t) }
    function _easeIn(t)  { return t * t }

    let _pulseRafId   = null
    let _pulseStartMs = 0

    function _triggerTapFeedback() {
        // Cancel any in-progress pulse and restart
        if (_pulseRafId) { cancelAnimationFrame(_pulseRafId); _pulseRafId = null }
        _pulseStartMs = performance.now()
        _animatePulse()
    }

    function _animatePulse() {
        if (destroyed) return
        const elapsed = performance.now() - _pulseStartMs

        if (elapsed >= PULSE_TOTAL_MS) {
            // Settled — ensure clean rest state
            pulseT = 0
            _drawMoon(canvas, phase, moonR, _rawToCyclePos(rawPhase), 0)
            if (rootEl) rootEl.style.transform = _buildTransform(corner, SCALE_REST)
            _pulseRafId = null
            return
        }

        let glowPulse   // 0..1, drives glow boost
        let scaleFactor // actual CSS scale value

        if (elapsed < PULSE_ATTACK_MS) {
            // Attack: ease-out ramp up
            const t = _easeOut(elapsed / PULSE_ATTACK_MS)
            glowPulse   = t
            scaleFactor = SCALE_REST + (SCALE_PEAK - SCALE_REST) * t
        } else {
            // Decay: ease-in ramp down with a scale overshoot
            const t = (elapsed - PULSE_ATTACK_MS) / PULSE_DECAY_MS  // 0..1

            // Glow fades straight back
            glowPulse = _easeIn(1 - t)

            // Scale: peak → overshoot at ~50% → rest
            // Split decay into two halves
            if (t < 0.5) {
                const t2 = _easeOut(t / 0.5)
                scaleFactor = SCALE_PEAK + (SCALE_OVERSHOOT - SCALE_PEAK) * t2
            } else {
                const t2 = _easeOut((t - 0.5) / 0.5)
                scaleFactor = SCALE_OVERSHOOT + (SCALE_REST - SCALE_OVERSHOOT) * t2
            }
        }

        pulseT = glowPulse
        _drawMoon(canvas, phase, moonR, _rawToCyclePos(rawPhase), glowPulse)
        if (rootEl) rootEl.style.transform = _buildTransform(corner, scaleFactor)

        _pulseRafId = requestAnimationFrame(_animatePulse)
    }

    // Build the correct transform string for the wrapper, preserving any
    // existing translateX(-50%) that bottom-center positioning requires.
    function _buildTransform(corner, scale) {
        if (corner === 'bottom-center') {
            return `translateX(-50%) scale(${scale.toFixed(4)})`
        }
        return scale === SCALE_REST ? '' : `scale(${scale.toFixed(4)})`
    }

    // -- Drift loop -----------------------------------------------------------
    function driftLoop(timestamp) {
        if (destroyed) return
        rafId = requestAnimationFrame(driftLoop)
        if (dragging || driftPaused || phase <= 0.25) { lastFrameTime = timestamp; return }
        if (lastFrameTime === null) { lastFrameTime = timestamp; return }
        const dt  = Math.min(timestamp - lastFrameTime, 100)
        lastFrameTime = timestamp
        const cp  = _rawToCyclePos(rawPhase)
        const dir = cp <= 1 ? -1 : 1
        _setPhaseInternal(rawPhase + dir * DRIFT_RATE * dt)
    }

    rafId = requestAnimationFrame(driftLoop)

    // -- Phase internals ------------------------------------------------------
    function _rawToCyclePos(raw) { return ((raw % 2) + 2) % 2 }
    function _cycleToPhase(cp)   { return cp <= 1 ? cp : 2 - cp }

    function _setPhaseInternal(v) {
        rawPhase       = v
        const cyclePos = _rawToCyclePos(rawPhase)
        phase          = _cycleToPhase(cyclePos)
        const r        = embedded ? Math.floor(canvas.width / 2) : moonR
        // Pass current pulseT so the drift loop doesn't clobber an active pulse
        _drawMoon(canvas, phase, r, cyclePos, pulseT)
        if (!embedded && showSlider) {
            if (sliderInput) sliderInput.value = phase
            if (trackFillEl) _updateTrackFill(trackFillEl, phase)
            if (wrapperEl)   _positionMoonCanvas(canvas, wrapperEl, phase, moonR)
        }
        if (onChange) onChange(phase)
    }

    const initR = embedded ? Math.floor(canvas.width / 2) : moonR
    _drawMoon(canvas, phase, initR, 0, 0)
    if (!embedded && showSlider && wrapperEl) {
        requestAnimationFrame(() => _positionMoonCanvas(canvas, wrapperEl, phase, moonR))
    }

    // -- Public API -----------------------------------------------------------
    return {
        element: rootEl,
        moonD,

        setPhase(v)    { _setPhaseInternal(v) },
        getPhase()     { return phase },
        getCanvas()    { return canvas },
        nudgePhase(dx) { _setPhaseInternal(rawPhase + dx / swipeRange) },

        setTapHandler(fn) { tapHandler = fn ?? null },

        pauseDrift()   { driftPaused = true },
        resumeDrift()  { driftPaused = false; lastFrameTime = null },

        destroy() {
            destroyed = true
            if (rafId)       { cancelAnimationFrame(rafId);       rafId       = null }
            if (_pulseRafId) { cancelAnimationFrame(_pulseRafId); _pulseRafId = null }
            if (rootEl?.parentNode) rootEl.parentNode.removeChild(rootEl)
        },
    }
}

// ── Fixed-position standalone moon ───────────────────────────────────────────
function _buildFixed(moonCanvas, moonR, moonD, pad, corner) {
    const margin = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.04)

    let posCSS
    if (corner === 'bottom-center') {
        const bottomPx = getMoonBottomOffset(moonD, pad)
        // Note: transform is set here for positioning; scale is appended
        // dynamically by _buildTransform() during pulse animation.
        posCSS = `bottom:${bottomPx}px;left:50%;transform:translateX(-50%);`
    } else {
        const isTop  = corner.startsWith('top')
        const isLeft = corner.endsWith('left')
        posCSS = (isTop ? `top:${margin}px;` : `bottom:${margin}px;`) +
                 (isLeft ? `left:${margin}px;` : `right:${margin}px;`)
    }

    const wrapper = document.createElement('div')
    wrapper.style.cssText = [
        'position:fixed;',
        posCSS,
        `width:${moonD + pad * 2}px;`,
        `height:${moonD + pad * 2}px;`,
        'z-index:1000003;',
        'display:flex;align-items:center;justify-content:center;',
        'pointer-events:all;',
        // Allow scale transform to expand beyond wrapper bounds
        'transform-origin:center center;',
        'will-change:transform;',
        'background:url(assets/ciorcal-glass-bg.png) center/cover no-repeat;',
    ].join('')

    moonCanvas.style.cssText = [
        `width:${moonD}px;height:${moonD}px;`,
        'cursor:grab;touch-action:none;display:block;',
        'transform:rotate(160deg);',
    ].join('')

    wrapper.appendChild(moonCanvas)
    return wrapper
}

// ── Slider strip ─────────────────────────────────────────────────────────────
function _buildSliderStrip(moonCanvas, moonR, moonD) {
    if (!document.getElementById('moonWidgetThumbStyle')) {
        const s = document.createElement('style')
        s.id = 'moonWidgetThumbStyle'
        s.textContent = `
            .moon-widget-slider {
                -webkit-appearance:none;appearance:none;
                width:100%;height:10px;border-radius:5px;outline:none;
                cursor:pointer;position:absolute;top:50%;
                transform:translateY(-50%);left:0;margin:0;
                z-index:2;background:transparent;pointer-events:all;touch-action:none;
            }
            .moon-widget-slider::-webkit-slider-thumb {
                -webkit-appearance:none;appearance:none;
                width:0;height:0;background:transparent;border:none;box-shadow:none;
            }
            .moon-widget-slider::-moz-range-thumb {
                width:0;height:0;background:transparent;border:none;box-shadow:none;
            }
        `
        document.head.appendChild(s)
    }

    const strip = document.createElement('div')
    strip.style.cssText = [
        'position:fixed;top:0;left:0;right:0;height:52px;z-index:999998;',
        'display:flex;align-items:center;justify-content:center;',
        'background:rgba(0,0,0,0.28);pointer-events:all;',
    ].join('')

    const wrapper = document.createElement('div')
    wrapper.style.cssText = [
        'position:relative;width:88%;max-width:600px;',
        `height:${moonD + 10}px;display:flex;align-items:center;`,
    ].join('')

    const trackBg = document.createElement('div')
    trackBg.style.cssText = [
        'position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);',
        'height:8px;border-radius:4px;background:#444;pointer-events:none;',
    ].join('')

    const trackFill = document.createElement('div')
    trackFill.style.cssText = [
        'position:absolute;left:0;top:50%;transform:translateY(-50%);',
        'height:8px;border-radius:4px;pointer-events:none;width:0%;',
        'background:linear-gradient(to right,#d4af37,#f0d060);',
    ].join('')

    const input = document.createElement('input')
    input.type = 'range'; input.min = 0; input.max = 1; input.step = 0.01
    input.className = 'moon-widget-slider'

    moonCanvas.style.cssText = [
        'position:absolute;top:50%;transform:translateY(-50%);',
        `width:${moonD}px;height:${moonD}px;`,
        'pointer-events:all;cursor:grab;z-index:3;',
    ].join('')

    wrapper.appendChild(trackBg)
    wrapper.appendChild(trackFill)
    wrapper.appendChild(input)
    wrapper.appendChild(moonCanvas)
    strip.appendChild(wrapper)

    return { strip, input, trackFill, wrapper }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function _updateTrackFill(trackFill, phase) {
    if (trackFill) trackFill.style.width = (phase * 100).toFixed(2) + '%'
}

function _positionMoonCanvas(canvas, wrapper, phase, moonR) {
    const usable = wrapper.offsetWidth - moonR * 2
    if (usable <= 0) return
    canvas.style.left = (moonR + phase * usable - moonR) + 'px'
}

// ── Drawing ──────────────────────────────────────────────────────────────────
// pulseT (0..1) boosts the outer glow radius and alpha when > 0.
function _drawMoon(canvas, phase, r, cyclePos, pulseT = 0) {
    const waning = (cyclePos !== undefined) && (cyclePos > 1)
    const ctx    = canvas.getContext('2d')
    const cx = r, cy = r
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Outer glow — expanded and brightened during pulse
    const glowRadiusMult = 1.6 + PULSE_GLOW_RADIUS_BOOST * pulseT
    const glowAlphaBase  = 0.14 + phase * 0.12 + PULSE_GLOW_ALPHA_BOOST * pulseT
    const grd = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * glowRadiusMult)
    grd.addColorStop(0, `rgba(180,170,255,${Math.min(1, glowAlphaBase).toFixed(3)})`)
    grd.addColorStop(1, 'rgba(200,220,255,0)')
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(cx, cy, r * glowRadiusMult, 0, Math.PI * 2)
    ctx.fill()

    // Dark disc
    ctx.fillStyle = 'rgb(8,4,30)'
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2); ctx.fill()

    // Lit face
    const lr = Math.round(160 + phase * 20)
    const lg = Math.round(170 + phase * 20)
    const lb = Math.round(225 + phase * 25)
    ctx.fillStyle = `rgb(${lr},${lg},${lb})`
    ctx.beginPath()
    if (phase >= 0.99) {
        ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2)
    } else {
        const tx = r * 0.92 * Math.cos(phase * Math.PI)
        if (!waning) {
            ctx.arc(cx, cy, r * 0.92, -Math.PI / 2, Math.PI / 2)
            ctx.ellipse(cx, cy, Math.abs(tx), r * 0.92, 0, Math.PI / 2, -Math.PI / 2, tx > 0)
        } else {
            ctx.arc(cx, cy, r * 0.92, Math.PI / 2, -Math.PI / 2)
            ctx.ellipse(cx, cy, Math.abs(tx), r * 0.92, 0, -Math.PI / 2, Math.PI / 2, tx > 0)
        }
    }
    ctx.fill()

    // Rim highlight — slightly more visible during pulse
    const rimAlpha = 0.20 + phase * 0.30 + 0.15 * pulseT
    ctx.strokeStyle = `rgba(180,160,255,${Math.min(1, rimAlpha).toFixed(3)})`
    ctx.lineWidth   = 1
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2); ctx.stroke()

    // Mare detail
    if (phase > 0.1) {
        const mare = (mx, my, mr, a) => {
            ctx.fillStyle = `rgba(140,130,200,${(a * phase).toFixed(3)})`
            ctx.beginPath()
            ctx.arc(cx + mx * r * 0.7, cy + my * r * 0.7, mr * r * 0.18, 0, Math.PI * 2)
            ctx.fill()
        }
        mare( 0.2, -0.3, 1.0, 0.18)
        mare(-0.3,  0.1, 0.7, 0.14)
        mare( 0.4,  0.35, 0.6, 0.12)
    }
}

