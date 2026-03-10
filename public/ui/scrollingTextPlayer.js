/**
 * ScrollingTextPlayer
 *
 * Scrolls Irish/English paired lines upward into the bottom half of the screen,
 * holds them there briefly, then fades out. The top half of the screen is always
 * free for star interaction.
 *
 * Behaviour:
 *   - Lines enter from below the screen bottom, scroll upward.
 *   - Scroll stops when the last line reaches the vertical midpoint (SCROLL_CEILING).
 *   - After HOLD_MS, the overlay fades out and onComplete fires.
 *   - The user can drag downward at any time to pull content back into view,
 *     resetting the hold timer.
 *   - Dragging upward accelerates scroll toward the ceiling but cannot exceed it.
 *   - Tapping pauses for PAUSE_MS then auto-resumes.
 *
 * The overlay is pointer-events:none everywhere except a hit zone in the bottom
 * half, so Phaser star-drawing and the moon slider both work unobstructed.
 *
 * Speaker colours:
 *   queen  →  gold  (#d4af37)
 *   druid  →  grey  (#a0a0b8)
 */

// ── Tuning ─────────────────────────────────────────────────────────────────────

const SCROLL_PX_PER_SEC = 32;    // upward scroll speed — comfortable reading pace
const PAUSE_MS          = 5000;  // tap-to-pause duration before auto-resume
const RESUME_EASE_MS    = 1600;  // ms to ease back to natural speed after a fling
const HOLD_MS           = 4000;  // ms to hold at ceiling before fading out
const FADE_OUT_MS       = 1000;  // fade-out transition duration
const END_PAUSE_MS      = 400;   // ms after fade completes before onComplete fires

// Layout fractions of screen height
const SCROLL_CEILING    = 0.48;  // content stops scrolling when top line reaches this Y
const FADE_ZONE_BOTTOM  = 0.08;  // lines fade in over this fraction as they enter from bottom
const FADE_ZONE_TOP     = 0.10;  // lines fade out over this fraction as they approach ceiling
const MOON_SAFE_ZONE    = 0.13;  // top strip reserved for moon — excluded from hit zone
const HIT_ZONE_TOP      = 0.50;  // hit zone starts at midpoint — bottom half only

// Typography
const LINE_GAP_PX       = 10;
const PAIR_GAP_PX       = 42;
const IRISH_FONT_SIZE   = '1.35rem';
const ENGLISH_FONT_SIZE = '1.05rem';
const QUEEN_COLOR       = '#d4af37';
const DRUID_COLOR       = '#a0a0b8';
const STROKE_COLOR      = 'rgba(0,6,26,0.9)';

// ── ScrollingTextPlayer ────────────────────────────────────────────────────────

export class ScrollingTextPlayer {

    /**
     * @param {{ ga: string, en?: string, speaker?: string }[]} lines
     * @param {() => number} getMoonPhase
     * @param {() => void}   onComplete
     * @param {HTMLElement}  [container]
     */
    constructor({ lines, getMoonPhase, onComplete, container }) {
        this._lines        = lines;
        this._getMoonPhase = getMoonPhase || (() => 0);
        this._onComplete   = onComplete   || (() => {});
        this._container    = container    || document.body;

        // scrollY: distance content has moved upward in px.
        // 0 = content at natural start (just below screen bottom).
        // Increases as content scrolls up toward ceiling.
        this._scrollY      = 0;
        this._velocity     = SCROLL_PX_PER_SEC / 60;
        this._naturalVel   = SCROLL_PX_PER_SEC / 60;
        this._running      = false;
        this._paused       = false;
        this._pauseTimer   = null;
        this._rafId        = null;

        // Hold + fade state
        this._atCeiling    = false;   // true once scroll has reached ceiling
        this._holdTimer    = null;    // setTimeout for hold period
        this._fadingOut    = false;   // true during CSS fade-out
        this._completed    = false;

        // Drag tracking
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
        this._ceilingY = 0;   // computed scroll value at which top line hits SCROLL_CEILING

        this._buildDOM();
        this._bindEvents();
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    start() {
        if (this._running) return;
        this._running  = true;
        this._scrollY  = 0;
        this._atCeiling = false;
        this._fadingOut = false;
        this._completed = false;
        this._overlay.style.opacity  = '1';
        this._overlay.style.transition = '';
        this._rafId = requestAnimationFrame(this._loop.bind(this));
    }

    destroy() {
        this._running = false;
        if (this._rafId)     cancelAnimationFrame(this._rafId);
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

    // ── Static helpers ─────────────────────────────────────────────────────────

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

    // ── DOM ────────────────────────────────────────────────────────────────────

    _buildDOM() {
        const H = window.innerHeight;

        // Full-screen visual container — pointer-events:none so stars and moon
        // receive events through it unobstructed.
        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:fixed;inset:0;',
            'z-index:99998;',
            'pointer-events:none;',
            'overflow:hidden;',
        ].join('');
        this._overlay = overlay;
        this._container.appendChild(overlay);

        // Hit zone — bottom half only, below moon safe area.
        // Only this region captures scroll/drag/tap gestures.
        const hitTop = Math.round(H * HIT_ZONE_TOP);
        const hitZone = document.createElement('div');
        hitZone.style.cssText = [
            'position:absolute;',
            `top:${hitTop}px;left:0;right:0;bottom:0;`,
            'pointer-events:all;',
            'touch-action:none;',
        ].join('');
        this._hitZone = hitZone;
        overlay.appendChild(hitZone);

        // Build line elements
        let cursor = 0;
        this._lineEls = this._lines.map(line => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = [
                'position:absolute;',
                'left:0;right:0;',
                'text-align:center;',
                'padding:0 8%;',
                'pointer-events:none;',
            ].join('');

            const gaColor = line.speaker === 'queen' ? QUEEN_COLOR : DRUID_COLOR;
            const gaEl = document.createElement('div');
            gaEl.textContent = line.ga;
            gaEl.style.cssText = [
                'font-family:Urchlo,serif;',
                `font-size:${IRISH_FONT_SIZE};`,
                `color:${gaColor};`,
                `text-shadow:0 0 18px ${STROKE_COLOR},0 0 8px ${STROKE_COLOR};`,
                'line-height:1.45;',
                'opacity:0;',
            ].join('');
            wrapper.appendChild(gaEl);

            let enEl = null;
            if (line.en) {
                enEl = document.createElement('div');
                enEl.textContent = line.en;
                const enColor = line.speaker === 'queen' ? '#b8966a' : '#9b8dbd';
                enEl.style.cssText = [
                    'font-family:"Courier New",monospace;',
                    `font-size:${ENGLISH_FONT_SIZE};`,
                    `color:${enColor};`,
                    `text-shadow:0 0 12px ${STROKE_COLOR};`,
                    `margin-top:${LINE_GAP_PX}px;`,
                    'line-height:1.4;',
                    'opacity:0;',
                ].join('');
                wrapper.appendChild(enEl);
            }

            overlay.appendChild(wrapper);

            const entry = { wrapper, gaEl, enEl, offsetY: cursor };
            cursor += wrapper.offsetHeight + PAIR_GAP_PX;
            return entry;
        });

        // Compute the scrollY value at which the last line's top edge
        // sits at the ceiling fraction.
        // screenY(last) = H - scrollY + last.offsetY  (see _screenY)
        // We want screenY(last) = H * SCROLL_CEILING
        // → ceilingY = H - H*SCROLL_CEILING + last.offsetY
        //            = H*(1 - SCROLL_CEILING) + last.offsetY
        const lastEntry = this._lineEls[this._lineEls.length - 1];
        if (lastEntry) {
            this._ceilingY = H * (1 - SCROLL_CEILING) + lastEntry.offsetY;
        }
    }

    // ── Main loop ──────────────────────────────────────────────────────────────

    _loop() {
        if (!this._running || this._fadingOut) return;

        if (!this._paused && !this._dragging && !this._atCeiling) {
            // Ease velocity back toward natural after a fling
            if (Math.abs(this._velocity - this._naturalVel) > 0.01) {
                const a = 1 - Math.exp(-16 / (RESUME_EASE_MS / (1000 / 60)));
                this._velocity += (this._naturalVel - this._velocity) * a;
            } else {
                this._velocity = this._naturalVel;
            }

            this._scrollY += this._velocity;

            // Clamp to ceiling
            if (this._scrollY >= this._ceilingY) {
                this._scrollY = this._ceilingY;
                this._onReachCeiling();
            }
        }

        this._render();
        this._rafId = requestAnimationFrame(this._loop.bind(this));
    }

    _render() {
        if (!this._overlay) return;
        const H          = window.innerHeight;
        const ceilPx     = H * SCROLL_CEILING;
        const bottomFade = H * (1 - FADE_ZONE_BOTTOM);
        const moonPhase  = this._getMoonPhase();

        for (const entry of this._lineEls) {
            const y      = this._screenY(entry);
            const bottom = y + entry.wrapper.offsetHeight;

            entry.wrapper.style.top = y + 'px';

            // Cull off-screen
            if (bottom < 0 || y > H) {
                entry.gaEl.style.opacity = '0';
                if (entry.enEl) entry.enEl.style.opacity = '0';
                continue;
            }

            // Fade in from bottom, fade out near ceiling
            let alpha = 1;
            if (y < ceilPx + H * FADE_ZONE_TOP) {
                // Approaching ceiling — fade out
                alpha = Math.max(0, (y - ceilPx) / (H * FADE_ZONE_TOP));
            }
            if (bottom > bottomFade) {
                // Entering from bottom — fade in
                alpha = Math.min(alpha, Math.max(0, (H - y) / (H * FADE_ZONE_BOTTOM)));
            }

            entry.gaEl.style.opacity = String(alpha);
            if (entry.enEl) {
                entry.enEl.style.opacity = String(alpha * moonPhase);
            }
        }
    }

    // ── Ceiling hold + fade ────────────────────────────────────────────────────

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
        if (!this._running || this._fadingOut || this._completed) return;
        this._fadingOut = true;
        this._overlay.style.transition = `opacity ${FADE_OUT_MS}ms ease-out`;
        this._overlay.style.opacity    = '0';
        setTimeout(() => {
            if (this._running) {
                this.destroy();
                this._onComplete();
            }
        }, FADE_OUT_MS + END_PAUSE_MS);
    }

    // ── Screen coordinate ──────────────────────────────────────────────────────

    /**
     * screenY = H - scrollY + entry.offsetY
     *
     * scrollY=0  → first line (offsetY=0) sits at y=H  (just below screen) ✓
     * scrollY>0  → lines move upward ✓
     * scrollY=ceilingY → last line top sits at H*SCROLL_CEILING ✓
     */
    _screenY(entry) {
        return window.innerHeight - this._scrollY + entry.offsetY;
    }

    // ── Touch / mouse ──────────────────────────────────────────────────────────

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

        // If fading out, snap back to visible and restart hold timer
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

        if (dt > 0) {
            this._dragVelocity = this._dragVelocity * 0.6 + (dy / dt) * 0.4;
        }

        // Drag up (negative dy) → increase scrollY → content moves up
        let newScroll = this._dragStartScroll + (this._dragStartY - clientY);

        // Clamp: floor at 0 (can't scroll below start), ceiling at ceilingY
        newScroll = Math.max(0, Math.min(this._ceilingY, newScroll));
        this._scrollY  = newScroll;
        this._atCeiling = (newScroll >= this._ceilingY);

        this._lastDragY    = clientY;
        this._lastDragTime = now;
    }

    _gestureEnd(endY, wasTap) {
        if (wasTap) {
            this._dragging = false;
            this._paused   = true;
            // Also cancel any in-progress fade and restart hold timer
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
                // If content is at ceiling, restart hold timer
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

        // Fling: convert drag velocity to scroll velocity
        // dragVelocity: px/ms, negative = dragging upward
        const flingVel = -(this._dragVelocity * (1000 / 60));
        const maxVel   = this._naturalVel * 10;
        this._velocity = Math.max(-this._naturalVel * 3, Math.min(maxVel, flingVel));
        this._dragging = false;

        // If dragged back down, resume scrolling upward
        if (this._atCeiling) {
            this._startHoldTimer();
        } else {
            this._atCeiling = false;
            // Resume loop if it stopped
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
        const endY   = e.changedTouches[0]?.clientY ?? this._lastDragY;
        const dy     = Math.abs(endY - this._tapStartY);
        const dt     = performance.now() - this._tapStartTime;
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
 
