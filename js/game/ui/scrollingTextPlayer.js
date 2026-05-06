/**
 * ScrollingTextPlayer
 *
 * Scrolls Irish/English paired lines upward through the screen.
 * Text enters just above the bottom UI (moon widget or dpad hub),
 * travels the full screen height, and exits off the top with no fade.
 *
 * Constructor options:
 *   lines              — array of { ga, en?, speaker? }
 *   getMoonPhase       — () => 0..1, controls English opacity
 *   onComplete         — called after final fade-out
 *   container          — DOM element to append to (default: document.body)
 *   bottomClearancePx  — px from screen bottom to keep clear of UI
 *                        (moon widget top edge, or dpad hub top edge).
 *                        Defaults to 0.
 *
 * Behaviour:
 *   - Lines enter from just above bottomClearancePx, scroll upward.
 *   - Scroll stops when the last line reaches SCROLL_CEILING (~5% from top).
 *   - After HOLD_MS, overlay fades out and onComplete fires.
 *   - User can swipe anywhere on screen (above clearance) to scroll text.
 *   - Tapping pauses for PAUSE_MS then auto-resumes.
 *   - No fade at the top — text simply scrolls off screen.
 *
 * NOTE: offsetY values and ceilingY are measured at start() time (inside a
 * rAF) so wrapper.offsetHeight is accurate after the browser has rendered.
 */

import { FONTS, COLORS, TYPE, SPACING, speakerColor, speakerColorEn } from '../systems/gameTypography.js';

// ── Tuning ────────────────────────────────────────────────────────────────────

const SCROLL_PX_PER_SEC = 30;
const PAUSE_MS          = 5000;
const RESUME_EASE_MS    = 1600;
const HOLD_MS           = 4000;
const FADE_OUT_MS       = 1000;
const END_PAUSE_MS      = 400;

const SCROLL_CEILING    = 0.05;   // last line stops at 5% from top
const FADE_ZONE_BOTTOM  = 0.10;   // entry fade zone as fraction of screen height

const LINE_GAP_PX       = 10;
const PAIR_GAP_PX       = 42;
const IRISH_FONT_SIZE   = TYPE.domBody.size;
const ENGLISH_FONT_SIZE = TYPE.domBodyEn.size;
const IRISH_FONT        = FONTS.irish;
const ENGLISH_FONT      = FONTS.english;
const STROKE_COLOR      = 'rgba(0,6,26,0.9)';

// ── ScrollingTextPlayer ───────────────────────────────────────────────────────

export class ScrollingTextPlayer {

    /**
     * @param {{ ga: string, en?: string, speaker?: string }[]} lines
     * @param {() => number} getMoonPhase
     * @param {() => void}   onComplete
     * @param {HTMLElement}  [container]
     * @param {number}       [bottomClearancePx]
     */
    constructor({ lines, getMoonPhase, onComplete, container, bottomClearancePx = 0 }) {
        this._lines             = lines;
        this._getMoonPhase      = getMoonPhase || (() => 0);
        this._onComplete        = onComplete   || (() => {});
        this._container         = container    || document.body;
        this._bottomClearancePx = Math.max(0, bottomClearancePx);

        this._scrollY      = 0;
        this._velocity     = SCROLL_PX_PER_SEC / 60;
        this._naturalVel   = SCROLL_PX_PER_SEC / 60;
        this._running      = false;
        this._paused       = false;
        this._pauseTimer   = null;
        this._rafId        = null;

        this._atCeiling    = false;
        this._holdTimer    = null;
        this._fadingOut    = false;
        this._completed    = false;

        this._dragging        = false;
        this._dragStartY      = 0;
        this._dragStartScroll = 0;
        this._lastDragY       = 0;
        this._lastDragTime    = 0;
        this._dragVelocity    = 0;
        this._tapStartY       = 0;
        this._tapStartTime    = 0;

        this._overlay  = null;
        this._hitZone  = null;
        this._lineEls  = [];
        this._ceilingY = 0;

        this._buildDOM();
        this._bindEvents();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    start() {
        if (this._running) return;
        this._running   = true;
        this._scrollY   = 0;
        this._atCeiling = false;
        this._fadingOut = false;
        this._completed = false;
        this._overlay.style.opacity    = '1';
        this._overlay.style.transition = '';

        // Measure after one rAF so wrapper.offsetHeight is real
        requestAnimationFrame(() => {
            this._measureOffsets();
            this._rafId = requestAnimationFrame(this._loop.bind(this));
        });
    }

    destroy() {
        this._running = false;
        if (this._rafId)      cancelAnimationFrame(this._rafId);
        if (this._pauseTimer) clearTimeout(this._pauseTimer);
        if (this._holdTimer)  clearTimeout(this._holdTimer);
        this._unbindEvents();
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        this._hitZone = null;
        this._lineEls = [];
    }

    static parseLines(str) {
        const raw = str.split('\n').map(s => s.trim()).filter(Boolean);
        const out = [];
        let i = 0;
        while (i < raw.length) {
            const ga = raw[i];
            const en = (i + 1 < raw.length) ? raw[i + 1] : null;
            out.push(en ? { ga, en } : { ga });
            i += en ? 2 : 1;
        }
        return out;
    }

    // ── DOM ───────────────────────────────────────────────────────────────────

    _buildDOM() {
        const H       = window.innerHeight;
        const clearPx = this._bottomClearancePx;

        const overlay = document.createElement('div');
        overlay.setAttribute('data-stp', '');
        overlay.style.cssText = [
            'position:fixed;inset:0;',
            'z-index:99998;',
            'pointer-events:none;',
            'overflow:hidden;',
        ].join('');
        this._overlay = overlay;
        this._container.appendChild(overlay);

        // Hit zone covers the full screen height above the clearance strip.
        // Text now travels the full screen so the gesture area must match.
        // The bottom boundary stops at the clearance strip so the moon/dpad
        // widget below it still receives its own touch events.
        const hitZone = document.createElement('div');
        hitZone.style.cssText = [
            'position:absolute;',
            'top:0;left:0;right:0;',
            `bottom:${clearPx}px;`,
            'pointer-events:all;',
            'touch-action:none;',
        ].join('');
        this._hitZone = hitZone;
        overlay.appendChild(hitZone);

        // Build wrapper elements — positioned off-screen until _measureOffsets()
        this._lineEls = this._lines.map(line => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = [
                'position:absolute;',
                'left:0;right:0;',
                'text-align:center;',
                'padding:0 8%;',
                'pointer-events:none;',
                'top:-9999px;',
            ].join('');

            const gaColor = speakerColor(line.speaker);
            const gaEl    = document.createElement('div');
            gaEl.textContent = line.ga;
            gaEl.style.cssText = [
                `font-family:${IRISH_FONT};`,
                `font-size:${IRISH_FONT_SIZE};`,
                `color:${gaColor};`,
                `text-shadow:0 0 18px ${STROKE_COLOR},0 0 8px ${STROKE_COLOR};`,
                `line-height:${SPACING.irishLineHeight};`,
                'opacity:0;',
            ].join('');
            wrapper.appendChild(gaEl);

            let enEl = null;
            if (line.en) {
                enEl = document.createElement('div');
                enEl.textContent = line.en;
                const enColor = speakerColorEn(line.speaker);
                enEl.style.cssText = [
                    `font-family:${ENGLISH_FONT};`,
                    `font-size:${ENGLISH_FONT_SIZE};`,
                    `color:${enColor};`,
                    `text-shadow:0 0 12px ${STROKE_COLOR};`,
                    `margin-top:${LINE_GAP_PX}px;`,
                    `line-height:${SPACING.englishLineHeight};`,
                    'opacity:0;',
                ].join('');
                wrapper.appendChild(enEl);
            }

            overlay.appendChild(wrapper);
            return { wrapper, gaEl, enEl, offsetY: 0 };
        });
    }

    // ── _measureOffsets ───────────────────────────────────────────────────────
    // Called at start() time after one rAF so offsetHeight values are real.

    _measureOffsets() {
        const H       = window.innerHeight;
        const clearPx = this._bottomClearancePx;
        let cursor    = 0;

        for (const entry of this._lineEls) {
            entry.offsetY = cursor;
            cursor += (entry.wrapper.offsetHeight || 60) + PAIR_GAP_PX;
        }

        // ceilingY: scrollY at which last line's top reaches H * SCROLL_CEILING
        // screenY(last) = (H - clearPx) - scrollY + last.offsetY
        // want: screenY(last) = H * SCROLL_CEILING
        // → scrollY = (H - clearPx) - H*SCROLL_CEILING + last.offsetY
        const lastEntry = this._lineEls[this._lineEls.length - 1];
        if (lastEntry) {
            this._ceilingY = (H - clearPx) - H * SCROLL_CEILING + lastEntry.offsetY;
        }
    }

    // ── Main loop ─────────────────────────────────────────────────────────────

    
_loop() {
    if (!this._running) return;

    if (!this._paused && !this._dragging && !this._fadingOut) {
        if (Math.abs(this._velocity - this._naturalVel) > 0.01) {
            const a = 1 - Math.exp(-16 / (RESUME_EASE_MS / (1000 / 60)));
            this._velocity += (this._naturalVel - this._velocity) * a;
        } else {
            this._velocity = this._naturalVel;
        }
        this._scrollY += this._velocity;

        if (!this._completed) {
            const lastEntry = this._lineEls[this._lineEls.length - 1];
            if (lastEntry) {
                const lastY = this._screenY(lastEntry);
                if (lastY < 0) {
                    this._completed = true;
                    if (this._hitZone) {
                        this._hitZone.style.pointerEvents = 'none';
                        this._hitZone.removeEventListener('touchstart', this._onTouchStart);
                        this._hitZone.removeEventListener('mousedown',  this._onMouseDown);
                    }
                    window.removeEventListener('touchmove', this._onTouchMove);
                    window.removeEventListener('touchend',  this._onTouchEnd);
                    window.removeEventListener('mousemove', this._onMouseMove);
                    window.removeEventListener('mouseup',   this._onMouseUp);
                    this._beginFadeOut();
                }
            }
        }
    }

    this._render();
    this._rafId = requestAnimationFrame(this._loop.bind(this));
}

_render() {
        if (!this._overlay) return;
        const H         = window.innerHeight;
        const clearPx   = this._bottomClearancePx;
        const entryZone = H * FADE_ZONE_BOTTOM;
        const entryEdge = H - clearPx;   // Y below which text is hidden behind UI
        const moonPhase = this._getMoonPhase();

        for (const entry of this._lineEls) {
            const y      = this._screenY(entry);
            const bottom = y + (entry.wrapper.offsetHeight || 60);

            entry.wrapper.style.top = y + 'px';

            // Cull: fully above top of screen, or fully below clearance strip
            if (bottom < 0 || y > entryEdge) {
                entry.gaEl.style.opacity = '0';
                if (entry.enEl) entry.enEl.style.opacity = '0';
                continue;
            }

            let alpha = 1;

            // Entry fade: lines fade in as they rise above the clearance strip
            if (bottom > entryEdge - entryZone) {
                alpha = Math.min(alpha, Math.max(0, (entryEdge - y) / entryZone));
            }

            // No top fade — text exits off the top of the screen

            entry.gaEl.style.opacity = String(alpha);
            if (entry.enEl) {
                entry.enEl.style.opacity = String(alpha * moonPhase);
            }
        }
    }

    // ── Ceiling hold + fade ───────────────────────────────────────────────────

    _onReachCeiling() {
        if (this._atCeiling) return;
        this._atCeiling = true;
        this._velocity  = 0;
        this._startHoldTimer();
    }

    _startHoldTimer() {
        if (this._holdTimer) clearTimeout(this._holdTimer);
        this._holdTimer = setTimeout(() => {
            this._holdTimer = null;
            this._beginFadeOut();
        }, HOLD_MS);
    }

_beginFadeOut() {
    if (this._fadingOut) return;
    this._fadingOut = true;
    if (this._overlay) {
        this._overlay.style.transition = `opacity ${FADE_OUT_MS}ms ease-out`;
        this._overlay.style.opacity    = '0';
    }
    setTimeout(() => {
        this.destroy();
        this._onComplete();
    }, FADE_OUT_MS);
}
    // ── Screen coordinate ─────────────────────────────────────────────────────

    _screenY(entry) {
        return (window.innerHeight - this._bottomClearancePx) - this._scrollY + entry.offsetY;
    }

    // ── Touch / mouse ─────────────────────────────────────────────────────────

    _bindEvents() {
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove  = this._onTouchMove.bind(this);
        this._onTouchEnd   = this._onTouchEnd.bind(this);
        this._onMouseDown  = this._onMouseDown.bind(this);
        this._onMouseMove  = this._onMouseMove.bind(this);
        this._onMouseUp    = this._onMouseUp.bind(this);

        this._hitZone.addEventListener('touchstart', this._onTouchStart, { passive: false });
        this._hitZone.addEventListener('mousedown',  this._onMouseDown);
        window.addEventListener('touchmove', this._onTouchMove, { passive: false });
        window.addEventListener('touchend',  this._onTouchEnd);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup',   this._onMouseUp);
    }

    _unbindEvents() {
        if (this._hitZone) {
            this._hitZone.removeEventListener('touchstart', this._onTouchStart);
            this._hitZone.removeEventListener('mousedown',  this._onMouseDown);
        }
        window.removeEventListener('touchmove', this._onTouchMove);
        window.removeEventListener('touchend',  this._onTouchEnd);
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup',   this._onMouseUp);
    }

    _gestureStart(clientY) {
        this._dragging        = true;
        this._paused          = false;
        this._fadingOut       = false;
        if (this._overlay) {
            this._overlay.style.transition = '';
            this._overlay.style.opacity    = '1';
        }
        if (this._holdTimer) { clearTimeout(this._holdTimer); this._holdTimer = null; }
        this._dragStartY      = clientY;
        this._dragStartScroll = this._scrollY;
        this._lastDragY       = clientY;
        this._lastDragTime    = performance.now();
        this._dragVelocity    = 0;
    }

    _gestureMove(clientY) {
        if (!this._dragging) return;
        const now = performance.now();
        const dt  = now - this._lastDragTime;
        const dy  = clientY - this._lastDragY;
        if (dt > 0) this._dragVelocity = this._dragVelocity * 0.6 + (dy / dt) * 0.4;
        let newScroll = this._dragStartScroll + (this._dragStartY - clientY);
        newScroll = Math.max(0, Math.min(this._ceilingY, newScroll));
        this._scrollY   = newScroll;
        this._atCeiling = (newScroll >= this._ceilingY);
        this._lastDragY    = clientY;
        this._lastDragTime = now;
    }

    _gestureEnd(endY, wasTap) {
        if (wasTap) {
            this._dragging = false;
            this._paused   = true;
            if (this._fadingOut) {
                this._fadingOut = false;
                if (this._overlay) {
                    this._overlay.style.transition = '';
                    this._overlay.style.opacity    = '1';
                }
            }
            if (this._pauseTimer) clearTimeout(this._pauseTimer);
            this._pauseTimer = setTimeout(() => {
                this._paused     = false;
                this._pauseTimer = null;
                if (this._atCeiling) {
                    this._startHoldTimer();
                } else {
                    this._velocity = this._naturalVel;
                }
                if (!this._rafId && this._running) {
                    this._rafId = requestAnimationFrame(this._loop.bind(this));
                }
            }, PAUSE_MS);
            return;
        }
        const flingVel = -(this._dragVelocity * (1000 / 60));
        const maxVel   = this._naturalVel * 10;
        this._velocity = Math.max(-this._naturalVel * 3, Math.min(maxVel, flingVel));
        this._dragging = false;
        if (this._atCeiling) {
            this._startHoldTimer();
        } else {
            this._atCeiling = false;
            if (!this._rafId && this._running) {
                this._rafId = requestAnimationFrame(this._loop.bind(this));
            }
        }
    }

    _onTouchStart(e) {
        e.preventDefault();
        this._tapStartY    = e.touches[0].clientY;
        this._tapStartTime = performance.now();
        this._gestureStart(e.touches[0].clientY);
    }
    _onTouchMove(e) {
        if (!this._dragging) return;
        e.preventDefault();
        this._gestureMove(e.touches[0].clientY);
    }
    _onTouchEnd(e) {
        if (!this._dragging) return;
        const endY = e.changedTouches[0]?.clientY ?? this._lastDragY;
        const dy   = Math.abs(endY - this._tapStartY);
        const dt   = performance.now() - this._tapStartTime;
        this._gestureEnd(endY, dy < 8 && dt < 300);
    }
    _onMouseDown(e) {
        this._tapStartY    = e.clientY;
        this._tapStartTime = performance.now();
        this._gestureStart(e.clientY);
    }
    _onMouseMove(e) {
        if (!this._dragging) return;
        this._gestureMove(e.clientY);
    }
    _onMouseUp(e) {
        if (!this._dragging) return;
        const dy = Math.abs(e.clientY - this._tapStartY);
        const dt = performance.now() - this._tapStartTime;
        this._gestureEnd(e.clientY, dy < 8 && dt < 300);
    }
}

