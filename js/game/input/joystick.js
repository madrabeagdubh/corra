// Joystick.js
//
// The brooch: an 8-directional movement control drawn as a penannular
// brooch (dealg), with the moon widget set in its centre. All elements are
// position:fixed DOM -- no Phaser game objects -- so _reposition() can
// realign everything after fullscreen changes, scene transitions, or the
// browser bar showing/hiding.
//
//   THE HOOP     a thin ring, open at the lower left (the gap), its two ends
//                flattened into small enamelled plates.
//   THE PIN      fixed on the diagonal, its head (the stone) at the upper
//                right, its point out through the gap: fastened.
//   THE RING     turns under the pin while a direction is held, swinging
//                the gap to the side AWAY from the thumb, so the thumb is
//                always on solid metal; it turns back to fastened on release.
//                (As on a real penannular brooch, where the ring turns
//                through the pin's head loop.)
//   THE STONE    the pin's jewelled head, on the hoop. It lights (cyan) when
//                there's something to interact with, and a tap on it then
//                does what tapping the portrait on the moon does.
//   THE MOON     the centre jewel: the moon widget, exactly as before.
//
// Touch: a press anywhere on the brooch picks the direction from its ANGLE
// round the centre -- the drawing is only a marker. Cardinals get 60°,
// diagonals the 30° between. Slide round the ring to change direction
// without lifting. Once steering, the finger can wander off the brooch and
// still steer. The stone claims a press only while lit, and a press that
// starts on it and slides becomes steering, so no direction is ever lost.
//
// Centre hub (moon) interactions -- unchanged:
//   - Swipe left/right       → onSwipe(dx)
//   - Long press             → onLongPress()
//   - Long press in progress → onLongPressProgress(0..1)
//   - Long press cancelled   → onLongPressCancel()
//   - Short tap              → onTap()
//
// Phaser integration -- unchanged:
//   - this.force and this.angle are set while a direction is held
//     (angle in degrees: 0 right, 90 down, 180 left, -90 up; diagonals ±45/±135)
//   - baseLocationScene reads these each frame to move the player
//   - reset() clears force/angle
//
// New public API:
//   - setStone(lit, onTap)   light/unlight the stone; onTap runs when it's tapped
//   - setMetal('bronze'|'silver'|'gold')

// Geometry, in units of the control radius R (config.radius).
const G = {
  HUB:    0.52,   // moon hub radius (the old d-pad's was 0.48)
  RING:   0.82,   // hoop centre line
  BAND:   0.075,  // hoop thickness
  GAP:    22,     // half-angle of the opening, degrees
  GAP_AT: 135,    // where the opening is: lower left
  PIN:    0.058,  // pin shaft width
  TIP:    1.18,   // how far past the centre the pin's point reaches
  STONE:  0.15,   // stone radius
  DRAW:   1.25,   // the drawing canvas's half-size (the pin's point overhangs)
  DEAD:   0.30,   // while steering, ignore angle changes this close to the centre
}
const STONE_AT = G.GAP_AT + 180          // upper right; the pin's head rests here
const DIR_DEG  = { right: 0, down: 90, left: 180, up: 270 }

const METALS = {
  bronze: { dark: '#3b230f', base: '#a06a32', light: '#e8b772', enamel: '#b3262a' },
  silver: { dark: '#2e3237', base: '#a3aab1', light: '#f4f6f8', enamel: '#2f5fa8' },
  gold:   { dark: '#4a3408', base: '#c49a2e', light: '#fbe39a', enamel: '#8e1b3a' },
}
const GOLD_GLOW = '245,208,96'
const CYAN_GLOW = '0,220,255'

const rad = a => a * Math.PI / 180

export default class Joystick {
  constructor(scene, config) {
    this.scene  = scene
    this.radius = config.radius || 60
    this.baseX  = config.x
    this.baseY  = config.y

    this.force = 0
    this.angle = 0

    this._onTap               = config.onTap               ?? null
    this._onLongPress         = config.onLongPress          ?? null
    this._onLongPressProgress = config.onLongPressProgress  ?? null
    this._onLongPressCancel   = config.onLongPressCancel    ?? null
    // Fires on every press end, whether or not the long press completed.
    // _onLongPressCancel deliberately does NOT fire after a completed long
    // press -- right for a cancellation, but it leaves anything driven by press
    // PROGRESS with no way to know the finger has lifted.
    this._onPressEnd          = config.onPressEnd            ?? null
    this._onSwipe             = config.onSwipe              ?? null
    // The moon: a press starting (for anything timed off it, e.g. a
    // charged blow), and a vertical swipe -- 'up' or 'down', once per
    // press. A press locks to one axis as it starts moving, so a
    // vertical swipe never nudges the language slider and vice versa.
    // onPressEnd now gets { dragged } -- true if the press swiped.
    this._onPressStart        = config.onPressStart         ?? null
    this._onSwipeVertical     = config.onSwipeVertical      ?? null
    this._ringGestures        = config.ringGestures         ?? null     // () => true: swipes on the ring are the moon's gestures
    this._onRingDrag          = config.onRingDrag           ?? null     // (pointerId) a drag from above the brooch onto it: swallow it

    const R = this.radius

    // Hub diameter
    const hubD = Math.round(R * G.HUB) * 2

    // Brooch state
    this._metal      = METALS.bronze
    this._dirDeg     = null       // held direction, 0..360 (0 right, 90 down), or null
    this._ringRot    = 0          // how far the hoop has turned from fastened, degrees
    this._hint       = null       // { deg, strength } from highlight()
    this._charge     = 0          // long-press progress 0..1
    this._stoneLit   = false
    this._stoneTap   = null
    this._badgeGlow  = false
    this._dirsHidden = false
    this._ringHidden = false
    this._dirty      = true

    // Remove stale elements from previous scene
    ;['dpad-root', 'dpad-moon-hub', 'dpad-fs-icon'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.parentNode?.removeChild(el)
    })

    const phaserCanvas = scene.game.canvas

    // -- Root container -------------------------------------------------------
    // All brooch elements live inside this fixed div (2R square).
    // _reposition() moves this div to the correct position.
    this._root = document.createElement('div')
    this._root.id = 'dpad-root'
    this._root.style.cssText = [
      'position:fixed;',
      'left:0;top:0;',
      `width:${R * 2}px;`,
      `height:${R * 2}px;`,
      'z-index:1000004;',
      'pointer-events:none;',
      'opacity:0;',                           // start hidden
      'transition:opacity 0.3s ease;',        // fade in
    ].join('')
    document.body.appendChild(this._root)

    // -- The drawing ----------------------------------------------------------
    // Larger than the root so the pin's point can overhang; never takes input.
    const E = Math.round(R * G.DRAW)
    this._drawHalf = E
    this._canvas = document.createElement('canvas')
    this._canvas.style.cssText = [
      'position:absolute;',
      `left:${R - E}px;top:${R - E}px;`,
      `width:${E * 2}px;height:${E * 2}px;`,
      'pointer-events:none;',
      'transition:opacity 0.2s ease;',
    ].join('')
    this._root.appendChild(this._canvas)
    this._sizeCanvas()

    // -- The touch pad --------------------------------------------------------
    // A circle the size of the brooch. The moon hub sits on top of it and
    // takes its own presses; everything else lands here.
    this._pad = document.createElement('div')
    this._pad.style.cssText = [
      'position:absolute;left:0;top:0;',
      `width:${R * 2}px;height:${R * 2}px;`,
      'border-radius:50%;',
      'pointer-events:all;',
      'touch-action:none;',
      'z-index:1;',
    ].join('')
    this._root.appendChild(this._pad)
    this._bindPad()
    this._bindAbove()

    // -- Moon hub -------------------------------------------------------------
    this._hubDom = document.createElement('div')
    this._hubDom.id = 'dpad-moon-hub'
    this._hubDom.style.cssText = [
      'position:absolute;',
      `width:${hubD}px;height:${hubD}px;`,
      `left:${(R - hubD / 2).toFixed(1)}px;`,
      `top:${(R - hubD / 2).toFixed(1)}px;`,
      'border-radius:50%;',
      'pointer-events:none;',
      'border:1.5px solid rgba(212,175,55,0.7);',
      'background:url(assets/ciorcal-glass-bg.png) center/cover no-repeat;',
      'z-index:2;',
    ].join('')
    this._root.appendChild(this._hubDom)

    // Moon canvas inside hub
    this._moonCanvas = document.createElement('canvas')
    this._moonCanvas.width  = hubD
    this._moonCanvas.height = hubD
    this._moonCanvas.style.cssText = [
      `width:${hubD}px;height:${hubD}px;`,
      'transform:rotate(160deg);',
      'display:block;',
      'touch-action:none;',
      'pointer-events:all;',
      'border-radius:50%;',
    ].join('')
    this._hubDom.appendChild(this._moonCanvas)

    // -- Fullscreen icon ------------------------------------------------------
    // Separate body-level element so its position:fixed is viewport-relative
    const fsSize = 36
    this._fsIcon = document.createElement('div')
    this._fsIcon.id = 'dpad-fs-icon'
    this._fsIcon.style.cssText = [
      'position:fixed;',
      'left:0;top:0;',
      `width:${fsSize}px;height:${fsSize}px;`,
      'display:flex;align-items:center;justify-content:center;',
      'font-size:18px;',
      'color:rgba(212,175,55,0.9);',
      'pointer-events:all;',
      'cursor:pointer;',
      'z-index:1000006;',
      'background:rgba(8,6,2,0.6);',
      'border-radius:50%;',
      'border:1px solid rgba(212,175,55,0.4);',
      'opacity:0;',                       // start hidden
      'transition:opacity 0.3s ease;',    // fade in
    ].join('')
    this._fsIcon.textContent = '⛶'
    this._fsIcon.addEventListener('pointerup', (e) => {
      e.stopPropagation()
      this._fsIcon.style.display = 'none'
      this._requestFullscreen()
    })
    document.body.appendChild(this._fsIcon)

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      this._fsIcon.style.display = 'none'
    }

    // -- Reposition -----------------------------------------------------------
    // Anchors the root div so its centre matches bx horizontally,
    // and its bottom touches the top of the status bar vertically.
    // Everything inside root (drawing, pad, hub) automatically follows.
    const _reposition = () => {
      const r          = phaserCanvas.getBoundingClientRect()
      const sx         = r.width / phaserCanvas.width

      // Horizontal centre follows bx
      const px         = r.left + this.baseX * sx

      // Vertical: bottom of the root (height R*2) touches the status bar top
      const statusBar  = document.getElementById('status-bar')
      const statusRect = statusBar?.getBoundingClientRect()
      const rootH      = R * 2 * sx
      const rootW      = R * 2 * sx
      const py         = statusRect
        ? statusRect.top - rootH
        : r.bottom - rootH - 42

      // Scale the root to match canvas scale
      this._root.style.width     = `${rootW.toFixed(1)}px`
      this._root.style.height    = `${rootH.toFixed(1)}px`
      this._root.style.left      = `${(px - rootW / 2).toFixed(1)}px`
      this._root.style.top       = `${py.toFixed(1)}px`
      this._root.style.transform = `scale(${sx.toFixed(4)})`
      this._root.style.transformOrigin = 'top left'

      // fsIcon: centred on hub, which is at root centre
      const fs = 36
      if (this._fsIcon) {
        this._fsIcon.style.left = `${(px - fs / 2).toFixed(1)}px`
        this._fsIcon.style.top  = `${(py + rootH / 2 - fs / 2).toFixed(1)}px`
      }

      if (this._root.style.opacity === '0') {
        requestAnimationFrame(() => {
          this._root.style.opacity = '1'
          // Only show fsIcon if not in fullscreen
          const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement)
          if (this._fsIcon && !isFs) this._fsIcon.style.opacity = '1'
        })
      }
      this._dirty = true
    }
    this._reposition = _reposition

    setTimeout(_reposition, 300)
    setTimeout(_reposition, 600)

    this._onFsChange = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement)
      this._fsIcon.style.display = isFs ? 'none' : 'flex'
      setTimeout(_reposition, 300)
      setTimeout(_reposition, 600)
    }
    document.addEventListener('fullscreenchange',       this._onFsChange)
    document.addEventListener('webkitfullscreenchange', this._onFsChange)

    // -- Moon hub interactions ------------------------------------------------
    this._hubSwipeStartX    = 0
    this._hubSwipeStartT    = 0
    this._hubDragging       = false
    this._longPressTimer    = null
    this._longPressInterval = null
    this._longPressFired    = false
    const LONG_PRESS_MS     = 700

    this._moonCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this._moonCanvas.setPointerCapture(e.pointerId)
      this._hubSwipeStartX = e.clientX
      this._hubSwipeStartT = performance.now()
      this._hubDragging    = false
      this._longPressFired = false
      this._hubX0 = e.clientX; this._hubY0 = e.clientY
      this._hubAxis = null; this._hubVFired = false
      if (this._onPressStart) this._onPressStart()

      this._longPressInterval = setInterval(() => {
        if (this._hubDragging) return
        const elapsed  = performance.now() - this._hubSwipeStartT
        if (elapsed < 80) return
        const progress = Math.min((elapsed - 80) / (LONG_PRESS_MS - 80), 1.0)
        if (this._onLongPressProgress) this._onLongPressProgress(progress)
      }, 16)

      this._longPressTimer = setTimeout(() => {
        this._longPressFired = true
        if (this._longPressInterval) {
          clearInterval(this._longPressInterval)
          this._longPressInterval = null
        }
        if (this._onLongPress) this._onLongPress()
      }, LONG_PRESS_MS)
    }, { passive: false })

    this._moonCanvas.addEventListener('pointermove', (e) => {
      if (performance.now() - this._hubSwipeStartT < 50) return
      if (!this._hubAxis) {
        const mx = e.clientX - this._hubX0, my = e.clientY - this._hubY0
        if (Math.hypot(mx, my) < 8) return
        this._hubAxis = Math.abs(my) > Math.abs(mx) ? 'v' : 'h'
      }
      if (this._hubAxis === 'v') {
        const my = e.clientY - this._hubY0
        if (!this._hubDragging && Math.abs(my) < 18) return          // a slip of the thumb is still a press
        if (this._longPressTimer)    { clearTimeout(this._longPressTimer);   this._longPressTimer   = null }
        if (this._longPressInterval) { clearInterval(this._longPressInterval); this._longPressInterval = null }
        if (!this._hubDragging) { this._hubDragging = true; if (this._onLongPressCancel) this._onLongPressCancel() }
        if (!this._hubVFired && Math.abs(my) >= 18) {
          this._hubVFired = true
          if (this._onSwipeVertical) this._onSwipeVertical(my < 0 ? 'up' : 'down')
        }
        return
      }
      const dx = e.clientX - this._hubSwipeStartX
      if (Math.abs(dx) > 20) {                                    // a real swipe, not a thumb settling
        if (this._longPressTimer)    { clearTimeout(this._longPressTimer);   this._longPressTimer   = null }
        if (this._longPressInterval) { clearInterval(this._longPressInterval); this._longPressInterval = null }
        this._hubDragging = true
        if (this._onSwipe) this._onSwipe(dx)
        this._hubSwipeStartX = e.clientX
      }
    }, { passive: true })

    this._moonCanvas.addEventListener('pointerup', (e) => {
      e.preventDefault()
      if (this._longPressTimer)    { clearTimeout(this._longPressTimer);   this._longPressTimer   = null }
      if (this._longPressInterval) { clearInterval(this._longPressInterval); this._longPressInterval = null }
      this._moonCanvas.releasePointerCapture(e.pointerId)

      const dt = performance.now() - this._hubSwipeStartT
      const dx = Math.abs(e.clientX - this._hubSwipeStartX)

      if (!this._longPressFired && !this._hubDragging && dt < 700 && dx < 12) {
        if (this._onLongPressCancel) this._onLongPressCancel()
        if (this._onTap) this._onTap()
      } else if (!this._longPressFired) {
        if (this._onLongPressCancel) this._onLongPressCancel()
      }
      if (this._onPressEnd) this._onPressEnd({ dragged: this._hubDragging })

      this._hubDragging    = false
      this._longPressFired = false
    }, { passive: false })

    this._moonCanvas.addEventListener('pointercancel', () => {
      if (this._longPressTimer)    { clearTimeout(this._longPressTimer);   this._longPressTimer   = null }
      if (this._longPressInterval) { clearInterval(this._longPressInterval); this._longPressInterval = null }
      if (this._onLongPressCancel) this._onLongPressCancel()
      if (this._onPressEnd) this._onPressEnd({ dragged: true })
      this._hubDragging    = false
      this._longPressFired = false
    })

    // -- Render loop ----------------------------------------------------------
    // Draws only when something changed or is animating (pin easing, pulses).
    this._raf = null
    const tick = (t) => {
      // A new Joystick removes the old one's elements by id without calling
      // destroy(); stop drawing once ours are gone.
      if (!this._root.isConnected) { this._raf = null; return }
      this._raf = requestAnimationFrame(tick)
      this._now = t
      if (this._dirty || this._animating()) this._draw()
    }
    this._raf = requestAnimationFrame(tick)
  }

  // -- Touch pad -------------------------------------------------------------
  // Where a pointer is, relative to the brooch's centre, in units of R.
  // Uses the pad's on-screen rect, so the root's scale is accounted for.
  _local(e) {
    const b = this._pad.getBoundingClientRect()
    const r = b.width / 2
    const x = (e.clientX - (b.left + r)) / r
    const y = (e.clientY - (b.top + r)) / r
    return { x, y, d: Math.hypot(x, y) }
  }

  // The direction (0..360, 0 right, 90 down) for a point: cardinals ±30°,
  // diagonals the 30° between.
  _sector(x, y) {
    let a = Math.atan2(y, x) * 180 / Math.PI
    if (a < 0) a += 360
    for (const c of [0, 90, 180, 270, 360]) if (Math.abs(a - c) <= 30) return c % 360
    return Math.round((a - 45) / 90) * 90 + 45
  }

  _onStone(x, y) {
    const sx = Math.cos(rad(STONE_AT)) * G.RING, sy = Math.sin(rad(STONE_AT)) * G.RING
    return Math.hypot(x - sx, y - sy) < G.STONE * 1.8
  }

  // A drag that starts on the ground just above the brooch and comes down onto it is the swipe down too
  // (sheathe), when the ring gestures are on. The scene is told, so the drag is not also a route or a tap.
  _bindAbove() {
    let tr = null
    const down = (e) => {
      tr = null
      if (!this._ringGestures?.() || !this._onSwipeVertical || this._root.contains(e.target)) return
      const b = this._pad.getBoundingClientRect(), R = b.width / 2, cx = b.left + R, cy = b.top + R
      if (e.clientY < cy - R * 0.9 && e.clientY > cy - R * 2.8 && Math.abs(e.clientX - cx) < R * 1.6) tr = { id: e.pointerId, y0: e.clientY, cx, cy, R }
    }
    const move = (e) => {
      if (!tr || e.pointerId !== tr.id) return
      if (Math.hypot(e.clientX - tr.cx, e.clientY - tr.cy) <= tr.R * 1.05 && e.clientY - tr.y0 > tr.R * 0.35) {
        const id = tr.id; tr = null
        this._onRingDrag?.(id)
        this._onSwipeVertical('down')
      }
    }
    const up = () => { tr = null }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    this._unbindAbove = () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
    }
  }

  _bindPad() {
    const pad = this._pad
    this._padMode = null          // 'dir' | 'stone' | 'pend' (waiting to see if it is a gesture) | 'gesture'
    this._padDown = null
    this._padLast = null

    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      pad.setPointerCapture(e.pointerId)
      const p = this._local(e)
      if (this._stoneLit && this._stoneTap && this._onStone(p.x, p.y)) {
        this._padMode = 'stone'
        this._padDown = { x: e.clientX, y: e.clientY }
        return
      }
      // while something owns the moon, an up/down swipe from anywhere on the ring is its gesture:
      // wait a moment to see which this is before steering
      if (this._ringGestures?.() && this._onSwipeVertical) {
        this._padMode = 'pend'
        this._padDown = { x: e.clientX, y: e.clientY }
        this._padLast = { x: p.x, y: p.y }
        clearTimeout(this._padPendT)
        this._padPendT = setTimeout(() => this._padCommit(), 70)
        return
      }
      this._padMode = 'dir'
      this._setDir(this._sector(p.x, p.y))
    }, { passive: false })

    pad.addEventListener('pointermove', (e) => {
      if (!this._padMode) return
      const p = this._local(e)
      if (this._padMode === 'gesture') return
      if (this._padMode === 'pend') {
        const dx = e.clientX - this._padDown.x, dy = e.clientY - this._padDown.y
        this._padLast = { x: p.x, y: p.y }
        if (Math.abs(dy) >= 18 && Math.abs(dy) > Math.abs(dx) * 1.4) {
          clearTimeout(this._padPendT); this._padPendT = null
          this._padMode = 'gesture'
          this._onSwipeVertical(dy < 0 ? 'up' : 'down')
        } else if (Math.hypot(dx, dy) >= 12) this._padCommit()
        return
      }
      // A press that starts on the lit stone but slides becomes steering.
      if (this._padMode === 'stone') {
        if (Math.hypot(e.clientX - this._padDown.x, e.clientY - this._padDown.y) < 10) return
        this._padMode = 'dir'
      }
      if (p.d < G.DEAD) return           // too near the centre to read an angle
      this._setDir(this._sector(p.x, p.y))
    })

    const end = () => {
      if (this._padMode === 'stone') this._stoneTap?.()
      if (this._padMode === 'pend') {                       // a quick tap on the ring: one step
        this._padCommit()
        this._padMode = null
        setTimeout(() => { if (!this._padMode) this._setDir(null) }, 90)
        return
      }
      this._padMode = null
      clearTimeout(this._padPendT); this._padPendT = null
      this._setDir(null)
    }
    pad.addEventListener('pointerup', end)
    pad.addEventListener('pointercancel', end)
    pad.addEventListener('lostpointercapture', () => { if (this._padMode) end() })
  }
  // it was not a gesture: steer, from where the finger is now
  _padCommit() {
    clearTimeout(this._padPendT); this._padPendT = null
    if (this._padMode !== 'pend') return
    this._padMode = 'dir'
    const q = this._padLast
    if (q) this._setDir(this._sector(q.x, q.y))
  }

  _setDir(deg) {
    if (deg === this._dirDeg) return
    this._dirDeg = deg
    if (deg === null) {
      this.force = 0
      this.angle = 0
    } else {
      this.force = this.radius
      this.angle = deg > 180 ? deg - 360 : deg     // keep the old -90..180 convention
    }
    this._dirty = true
  }

  // -- Drawing ---------------------------------------------------------------
  _sizeCanvas() {
    const dpr = window.devicePixelRatio || 1
    const px  = this._drawHalf * 2
    this._canvas.width  = Math.round(px * dpr)
    this._canvas.height = Math.round(px * dpr)
    this._ctx = this._canvas.getContext('2d')
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // Where the hoop should be turned to: the gap opposite the held direction,
  // or 0 (fastened) when nothing is held. Shortest way round.
  _ringTarget() {
    if (this._dirDeg === null) return 0
    return ((this._dirDeg + 180 - G.GAP_AT + 540) % 360) - 180
  }

  _animating() {
    const off = Math.abs(this._ringTarget() - this._ringRot)
    return off > 0.3 || !!this._hint || this._stoneLit || this._badgeGlow || this._charge > 0
  }

  _draw() {
    this._dirty = false
    const ctx = this._ctx, E = this._drawHalf, R = this.radius, m = this._metal
    const t = this._now || 0
    ctx.clearRect(0, 0, E * 2, E * 2)
    ctx.save()
    ctx.translate(E, E)

    // turn the hoop toward its target: briskly while held, gently back to fastened
    const d = this._ringTarget() - this._ringRot
    this._ringRot += d * (this._dirDeg === null ? 0.12 : 0.25)
    const gapAt = G.GAP_AT + this._ringRot

    // the hoop and its two ends
    this._arc(ctx, G.RING * R, gapAt + G.GAP, gapAt - G.GAP + 360, G.BAND * R, m)
    this._terminal(ctx, R, gapAt + G.GAP, -1, m)
    this._terminal(ctx, R, gapAt - G.GAP,  1, m)

    // long-press charge: gold runs round the hoop from one end to the other
    if (this._charge > 0) {
      const a0 = gapAt + G.GAP, span = 360 - 2 * G.GAP
      const k = Math.min(1, this._charge * 1.4)
      this._glow(ctx, R, a0, a0 + span * this._charge, `rgba(${GOLD_GLOW},${(0.35 + 0.6 * k).toFixed(3)})`)
    }
    // the step drill's called direction
    if (this._hint) {
      const pulse = 0.5 + 0.5 * Math.sin(t / 180)
      const a = this._hint.strength * (0.35 + 0.55 * pulse)
      this._glow(ctx, R, this._hint.deg - 20, this._hint.deg + 20, `rgba(${GOLD_GLOW},${a.toFixed(3)})`)
    }
    // the held direction
    if (this._dirDeg !== null) {
      this._glow(ctx, R, this._dirDeg - 20, this._dirDeg + 20, `rgba(${GOLD_GLOW},0.9)`)
    }

    this._pin(ctx, R, STONE_AT, m)
    this._stone(ctx, R, m, t)

    // thin metal bezel round the moon hub (the hub itself is DOM, on top)
    ctx.beginPath(); ctx.arc(0, 0, G.HUB * R + 2.5, 0, Math.PI * 2)
    ctx.fillStyle = m.base; ctx.fill()
    ctx.strokeStyle = m.dark; ctx.lineWidth = 1; ctx.stroke()
    ctx.restore()
  }

  _arc(ctx, r, a0, a1, w, m) {
    ctx.lineCap = 'butt'
    ctx.beginPath(); ctx.arc(0, 0, r, rad(a0), rad(a1)); ctx.strokeStyle = m.dark; ctx.lineWidth = w + 1.6; ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, r, rad(a0), rad(a1)); ctx.strokeStyle = m.base; ctx.lineWidth = w; ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, r - w * 0.18, rad(a0), rad(a1)); ctx.strokeStyle = m.light
    ctx.lineWidth = Math.max(0.8, w * 0.28); ctx.stroke()
  }

  _glow(ctx, R, a0, a1, colour) {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.shadowColor = colour; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.arc(0, 0, G.RING * R, rad(a0), rad(a1))
    ctx.strokeStyle = colour; ctx.lineWidth = G.BAND * R * 1.6; ctx.stroke()
    ctx.restore()
  }

  // A flattened, flared end plate with a drop of enamel -- a brooch's end,
  // not a torc's round buffer. `dir` (+1/-1) is which way it flares.
  _terminal(ctx, R, a, dir, m) {
    const w = G.BAND * R
    ctx.save(); ctx.rotate(rad(a)); ctx.translate(G.RING * R, 0)
    ctx.beginPath()
    ctx.moveTo(-w * 0.55, -dir * w * 0.2)
    ctx.lineTo(-w * 1.25, dir * w * 1.9)
    ctx.quadraticCurveTo(0, dir * w * 2.5, w * 1.25, dir * w * 1.9)
    ctx.lineTo(w * 0.55, -dir * w * 0.2)
    ctx.closePath()
    ctx.fillStyle = m.base; ctx.fill(); ctx.strokeStyle = m.dark; ctx.lineWidth = 1; ctx.stroke()
    ctx.beginPath(); ctx.ellipse(0, dir * w * 1.35, w * 0.62, w * 0.55, 0, 0, Math.PI * 2)
    ctx.fillStyle = m.enamel; ctx.fill(); ctx.strokeStyle = m.dark; ctx.lineWidth = 0.8; ctx.stroke()
    ctx.restore()
  }

  // Head looped over the hoop at `ha`; shaft across behind the moon; point
  // out past the far side.
  _pin(ctx, R, ha, m) {
    const hx = Math.cos(rad(ha)) * G.RING * R, hy = Math.sin(rad(ha)) * G.RING * R
    const ta = ha + 180
    const tx = Math.cos(rad(ta)) * G.TIP * R, ty = Math.sin(rad(ta)) * G.TIP * R
    const w = G.PIN * R
    const len = Math.hypot(tx - hx, ty - hy)
    const ux = (tx - hx) / len, uy = (ty - hy) / len
    const nx = -uy * w / 2, ny = ux * w / 2
    const sx = hx + ux * w * 1.2, sy = hy + uy * w * 1.2
    ctx.beginPath()
    ctx.moveTo(sx + nx, sy + ny)
    ctx.lineTo(tx - ux * w * 3 + nx * 0.8, ty - uy * w * 3 + ny * 0.8)
    ctx.lineTo(tx, ty)
    ctx.lineTo(tx - ux * w * 3 - nx * 0.8, ty - uy * w * 3 - ny * 0.8)
    ctx.lineTo(sx - nx, sy - ny)
    ctx.closePath()
    const g = ctx.createLinearGradient(sx + nx, sy + ny, sx - nx, sy - ny)
    g.addColorStop(0, m.light); g.addColorStop(0.5, m.base); g.addColorStop(1, m.dark)
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = m.dark; ctx.lineWidth = 1; ctx.stroke()
    // collar where the shaft leaves the loop
    ctx.beginPath()
    ctx.moveTo(sx + nx * 1.6 + ux * 2, sy + ny * 1.6 + uy * 2)
    ctx.lineTo(sx - nx * 1.6 + ux * 2, sy - ny * 1.6 + uy * 2)
    ctx.strokeStyle = m.dark; ctx.lineWidth = 3; ctx.stroke()
    ctx.strokeStyle = m.light; ctx.lineWidth = 1.4; ctx.stroke()
    // head: a loop wrapped round the hoop
    ctx.beginPath(); ctx.arc(hx, hy, G.BAND * R * 1.35, 0, Math.PI * 2)
    ctx.strokeStyle = m.dark; ctx.lineWidth = 3.4; ctx.stroke()
    ctx.strokeStyle = m.light; ctx.lineWidth = 1.6; ctx.stroke()
  }

  _stone(ctx, R, m, t) {
    const x = Math.cos(rad(STONE_AT)) * G.RING * R, y = Math.sin(rad(STONE_AT)) * G.RING * R
    const cr = G.STONE * R, lit = this._stoneLit || this._badgeGlow
    if (lit) {
      const k = 0.55 + 0.45 * Math.sin(t / 260)
      ctx.save(); ctx.shadowColor = `rgba(${CYAN_GLOW},${k.toFixed(3)})`; ctx.shadowBlur = 8 + 12 * k
      ctx.beginPath(); ctx.arc(x, y, cr * 1.1, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${CYAN_GLOW},${(0.5 * k).toFixed(3)})`; ctx.fill(); ctx.restore()
    }
    ctx.beginPath(); ctx.arc(x, y, cr, 0, Math.PI * 2); ctx.fillStyle = m.base; ctx.fill()
    ctx.strokeStyle = m.dark; ctx.lineWidth = 1; ctx.stroke()
    const sr = cr * 0.72
    const g = ctx.createRadialGradient(x - sr * 0.35, y - sr * 0.35, sr * 0.1, x, y, sr)
    if (lit) { g.addColorStop(0, '#e6fdff'); g.addColorStop(0.4, '#39d4f0'); g.addColorStop(1, '#063a4a') }
    else     { g.addColorStop(0, '#6f8a93'); g.addColorStop(0.5, '#23414b'); g.addColorStop(1, '#081a20') }
    ctx.beginPath(); ctx.arc(x, y, sr, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
  }

  // -- Fullscreen -----------------------------------------------------------
  _requestFullscreen() {
    const el = document.documentElement
    try {
      if (el.requestFullscreen)            el.requestFullscreen()
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
    } catch (e) {}
  }

  // -- Glows ------------------------------------------------------------------
  // Long-press progress on the moon (menu charge), 0..1.
  drawChargeGlow(progress) {
    this._charge = Math.max(0, progress || 0)
    this._dirty = true
  }

  // A badge prompt is active (e.g. disembark). Lights the stone. 1 on, 0 off.
  drawBadgeGlow(progress) {
    this._badgeGlow = (progress || 0) > 0
    this._dirty = true
  }

  // -- The stone ----------------------------------------------------------------
  // Lit while there's something to interact with; onTap runs when it's tapped.
  setStone(lit, onTap = null) {
    this._stoneLit = !!lit
    this._stoneTap = lit ? onTap : null
    this._dirty = true
  }

  setMetal(name) {
    this._metal = METALS[name] || METALS.bronze
    this._dirty = true
  }

  // -- Moon canvas access ---------------------------------------------------
  getMoonCanvas() { return this._moonCanvas }
  getMoonRadius() { return Math.round(this.radius * 0.27) }

  // Temporarily lifts the moon hub (backing + canvas) out of _root's normal
  // stacking context so it can render and take input ABOVE another high
  // z-index overlay (corraHarp.js's harp overlay, z-index:2000000), while
  // staying the exact same widget instance. Call hideDirections() alongside
  // this if the brooch shouldn't show through as well.
  elevateMoon(zIndex = 2000001) {
    if (!this._hubDom || this._hubElevated) return
    const rect = this._hubDom.getBoundingClientRect()
    this._hubPrevStyle = {
      position: this._hubDom.style.position,
      left:     this._hubDom.style.left,
      top:      this._hubDom.style.top,
      zIndex:   this._hubDom.style.zIndex,
    }
    this._hubDom.style.position = 'fixed'
    this._hubDom.style.left     = `${rect.left}px`
    this._hubDom.style.top      = `${rect.top}px`
    this._hubDom.style.width    = `${rect.width}px`
    this._hubDom.style.height   = `${rect.height}px`
    this._hubDom.style.zIndex   = String(zIndex)
    this._hubElevated = true
  }

  // Reverts elevateMoon(), handing the hub back to _reposition().
  restoreMoon() {
    if (!this._hubDom || !this._hubElevated) return
    const prev = this._hubPrevStyle || {}
    this._hubDom.style.position = prev.position || 'absolute'
    this._hubDom.style.left     = prev.left     || ''
    this._hubDom.style.top      = prev.top      || ''
    this._hubDom.style.zIndex   = prev.zIndex   || '2'
    this._hubDom.style.width    = ''
    this._hubDom.style.height   = ''
    this._hubElevated  = false
    this._hubPrevStyle = null
    this._reposition?.()
  }

  // -- Public API -----------------------------------------------------------
  reset() {
    this.force = 0
    this.angle = 0
    this._padMode = null
    this._setDir(null)
  }

  hideRing() {
    this._ringHidden = true
    this._applyVisibility()
  }

  showRing() {
    this._ringHidden = false
    this._applyVisibility()
  }

  _applyVisibility() {
    this._canvas.style.opacity = (this._ringHidden || this._dirsHidden) ? '0' : '1'
    this._pad.style.pointerEvents = this._dirsHidden ? 'none' : 'all'
  }

  // -- Tutorial highlight ------------------------------------------------------
  // highlight('up'|'down'|'left'|'right', strength 0..1) makes that part of
  // the hoop pulse gold; highlight(null) clears it. Independent of the held
  // direction's glow, so it survives the player actually pressing it.
  highlight(dir, strength = 1) {
    const on = dir && DIR_DEG[dir] !== undefined && strength > 0
    this._hint = on ? { deg: DIR_DEG[dir], strength: Math.min(1, strength) } : null
    this._dirty = true
  }

  // The whole brooch goes, and stops taking touches, leaving the moon alone
  // in its hub. (All eight directions: a tap aimed at a dialogue button
  // must not walk the player across the map.)
  hideDirections() {
    this._dirsHidden = true
    this._applyVisibility()
    this.reset?.()
  }

  showDirections() {
    this._dirsHidden = false
    this._applyVisibility()
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf)
    if (this._longPressTimer)    clearTimeout(this._longPressTimer)
    if (this._longPressInterval) clearInterval(this._longPressInterval)
    if (this._onFsChange) {
      document.removeEventListener('fullscreenchange',       this._onFsChange)
      document.removeEventListener('webkitfullscreenchange', this._onFsChange)
    }
    this._unbindAbove?.()
    if (this._root?.parentNode)   this._root.parentNode.removeChild(this._root)
    if (this._fsIcon?.parentNode) this._fsIcon.parentNode.removeChild(this._fsIcon)
  }
}

