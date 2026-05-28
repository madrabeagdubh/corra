// Joystick.js
//
// Fully DOM-based 8-directional d-pad with moon widget in the hub centre.
// All elements are position:fixed DOM divs -- no Phaser game objects.
// This means _reposition() can correctly align everything after fullscreen
// changes, scene transitions, or browser bar show/hide.
//
// Centre hub interactions:
//   - Swipe left/right       → onSwipe(dx)
//   - Long press             → onLongPress()
//   - Long press in progress → onLongPressProgress(0..1)
//   - Long press cancelled   → onLongPressCancel()
//   - Short tap              → onTap()
//
// Phaser integration:
//   - this.force and this.angle are set when a direction button is held
//   - baseLocationScene reads these each frame to move the player
//   - reset() clears force/angle

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
    this._onSwipe             = config.onSwipe              ?? null

    const R = this.radius

    // Hub diameter
    const hubD = Math.round(R * 0.48) * 2

    // Remove stale elements from previous scene
    ;['dpad-root', 'dpad-moon-hub', 'dpad-fs-icon'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.parentNode?.removeChild(el)
    })

    const phaserCanvas = scene.game.canvas

    // -- Root container -------------------------------------------------------
    // All dpad elements live inside this fixed div.
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

    // -- Base circle ----------------------------------------------------------
    this._base = document.createElement('div')
    this._base.style.cssText = [
      'position:absolute;',
      `width:${R * 2}px;height:${R * 2}px;`,
      'border-radius:50%;',
      'background:rgba(5,5,5,0.85);',
      `border:1.5px solid rgba(212,175,55,0.6);`,
      'left:0;top:0;',
      'pointer-events:none;',
    ].join('')
    this._root.appendChild(this._base)

    // Charge glow overlay canvas
    this._glowCanvas = document.createElement('canvas')
    this._glowCanvas.width  = R * 2
    this._glowCanvas.height = R * 2
    this._glowCanvas.style.cssText = [
      'position:absolute;left:0;top:0;',
      `width:${R * 2}px;height:${R * 2}px;`,
      'pointer-events:none;',
      'border-radius:50%;',
      'opacity:0;transition:opacity 0.1s ease;',
    ].join('')
    this._root.appendChild(this._glowCanvas)
    this._glowCtx = this._glowCanvas.getContext('2d')

    // -- Direction buttons ----------------------------------------------------
    // Each button is a div at the correct position within the root container.
    // angleDeg: the movement angle this button produces.

    const GOLD = 'rgba(212,175,55,0.55)'
    const GOLD_ACTIVE = 'rgba(245,208,96,1.0)'

    const cardOff  = R * 0.72
    const cardSize = R * 0.55 + 1
    const diagOff  = R * 0.72
    const diagSize = R * 0.38 + 1
    const diagXY   = diagOff * Math.cos(Math.PI / 4)

    this._buttons = []
    this._activeBtn = null

    const makeBtn = (offsetX, offsetY, size, angleDeg, invisible = false) => {
      const btn = document.createElement('div')
      btn._angle     = angleDeg
      btn._active    = false
      btn._invisible = invisible

      btn.style.cssText = [
        'position:absolute;',
        `width:${size}px;height:${size}px;`,
        `left:${(R + offsetX - size / 2).toFixed(1)}px;`,
        `top:${(R + offsetY - size / 2).toFixed(1)}px;`,
        invisible
          ? 'pointer-events:all;'
          : [
            'pointer-events:all;',
            'background:rgba(8,8,8,0.82);',
            `border:1px solid ${GOLD};`,
            'box-sizing:border-box;',
          ].join(''),
      ].join('')

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        btn.setPointerCapture(e.pointerId)
        this._pressBtn(btn)
      })
      btn.addEventListener('pointerup',     () => this._releaseBtn(btn))
      btn.addEventListener('pointercancel', () => this._releaseBtn(btn))
      btn.addEventListener('pointerout',    (e) => {
        if (!btn.hasPointerCapture(e.pointerId)) this._releaseBtn(btn)
      })

      this._root.appendChild(btn)
      this._buttons.push(btn)
      return btn
    }

    // Cardinals
    makeBtn(0,         -cardOff, cardSize, -90)   // up
    makeBtn(0,          cardOff, cardSize,  90)   // down
    makeBtn(-cardOff,   0,       cardSize, 180)   // left
    makeBtn( cardOff,   0,       cardSize,   0)   // right

    // Diagonals (invisible hit areas)
    makeBtn( diagXY, -diagXY, diagSize, -45,  true)
    makeBtn( diagXY,  diagXY, diagSize,  45,  true)
    makeBtn(-diagXY,  diagXY, diagSize, 135,  true)
    makeBtn(-diagXY, -diagXY, diagSize, -135, true)

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
      `border:1.5px solid rgba(212,175,55,0.7);`,
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
  `border:1px solid rgba(212,175,55,0.4);`,
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
    // Everything inside root (buttons, hub) automatically follows.

    const _reposition = () => {
      const r          = phaserCanvas.getBoundingClientRect()
      const sx         = r.width / phaserCanvas.width

      // Horizontal centre follows bx
      const px         = r.left + this.baseX * sx

      // Vertical: bottom of dpad (root height = R*2) touches status bar top
      const statusBar  = document.getElementById('status-bar')
      const statusRect = statusBar?.getBoundingClientRect()
      const rootH      = R * 2 * sx
      const rootW      = R * 2 * sx
      const py         = statusRect
        ? statusRect.top - rootH        // top of root = statusTop - full height
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
      const hubCentreX = px
      const hubCentreY = py + rootH / 2
      if (this._fsIcon) {
        this._fsIcon.style.left = `${(hubCentreX - fs / 2).toFixed(1)}px`
        this._fsIcon.style.top  = `${(hubCentreY - fs / 2).toFixed(1)}px`
   } 
if (this._root.style.opacity === '0') {
    requestAnimationFrame(() => {
      this._root.style.opacity = '1'
    })


  }

if (this._root.style.opacity === '0') {
  requestAnimationFrame(() => {
    this._root.style.opacity = '1'
    // Only show fsIcon if not in fullscreen
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement)
    if (this._fsIcon && !isFs) {
      this._fsIcon.style.opacity = '1'
    }
  })
}


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
      const dx = e.clientX - this._hubSwipeStartX
      if (Math.abs(dx) > 6) {
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

      this._hubDragging    = false
      this._longPressFired = false
    }, { passive: false })

    this._moonCanvas.addEventListener('pointercancel', () => {
      if (this._longPressTimer)    { clearTimeout(this._longPressTimer);   this._longPressTimer   = null }
      if (this._longPressInterval) { clearInterval(this._longPressInterval); this._longPressInterval = null }
      if (this._onLongPressCancel) this._onLongPressCancel()
      this._hubDragging    = false
      this._longPressFired = false
    })
  }

  // -- Button press/release -------------------------------------------------
  _pressBtn(btn) {
    if (this._activeBtn && this._activeBtn !== btn) this._releaseBtn(this._activeBtn)
    this._activeBtn = btn
    btn._active = true
    if (!btn._invisible) {
      btn.style.background = 'rgba(20,18,8,0.98)'
      btn.style.borderColor = 'rgba(245,208,96,1.0)'
    }
    this.force = this.radius
    this.angle = btn._angle
  }

  _releaseBtn(btn) {
    if (!btn) return
    btn._active = false
    if (!btn._invisible) {
      btn.style.background = 'rgba(8,8,8,0.82)'
      btn.style.borderColor = 'rgba(212,175,55,0.55)'
    }
    if (this._activeBtn === btn) {
      this._activeBtn = null
      this.force = 0
      this.angle = 0
    }
  }

  // -- Fullscreen -----------------------------------------------------------
  _requestFullscreen() {
    const el = document.documentElement
    try {
      if (el.requestFullscreen)            el.requestFullscreen()
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
    } catch(e) {}
  }

  // -- Moon canvas access ---------------------------------------------------
  drawChargeGlow(progress) {
    const ctx = this._glowCtx
    const R   = this.radius
    if (!ctx) return
    ctx.clearRect(0, 0, R * 2, R * 2)
    if (progress <= 0) {
      this._glowCanvas.style.opacity = '0'
      return
    }
    this._glowCanvas.style.opacity = '1'
    // Glow sweeps inward from outer ring toward centre as progress increases
    const outerR = R * 0.98
    const innerR = outerR * (1 - progress * 0.7)
    const grad = ctx.createRadialGradient(R, R, innerR, R, R, outerR)
    const intensity = Math.min(1, progress * 1.4)
    grad.addColorStop(0,   `rgba(212,175,55,0)`)
    grad.addColorStop(0.4, `rgba(212,175,55,${(intensity * 0.3).toFixed(3)})`)
    grad.addColorStop(0.8, `rgba(255,220,80,${(intensity * 0.7).toFixed(3)})`)
    grad.addColorStop(1,   `rgba(255,240,120,${(intensity * 0.9).toFixed(3)})`)
    ctx.beginPath()
    ctx.arc(R, R, outerR, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    // Bright ring at outer edge
    ctx.beginPath()
    ctx.arc(R, R, outerR * 0.97, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255,240,120,${(intensity * 0.8).toFixed(3)})`
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Pulsing cyan ring shown when a badge prompt is active (e.g. disembark)
  // Call with progress=1 to show, progress=0 to hide.
  // Animates a slow breathing pulse when shown.
  drawBadgeGlow(progress) {
    const ctx = this._glowCtx
    const R   = this.radius
    if (!ctx) return
    ctx.clearRect(0, 0, R * 2, R * 2)
    if (progress <= 0) {
      this._glowCanvas.style.opacity = '0'
      return
    }
    this._glowCanvas.style.opacity = '1'
    const outerR = R * 0.98
    const pulse  = 0.55 + 0.45 * Math.sin(Date.now() * 0.004)  // breathing 0.1-1.0
    const grad   = ctx.createRadialGradient(R, R, outerR * 0.6, R, R, outerR)
    grad.addColorStop(0,   'rgba(0,220,255,0)')
    grad.addColorStop(0.5, `rgba(0,200,255,${(pulse * 0.25).toFixed(3)})`)
    grad.addColorStop(0.85,`rgba(0,230,255,${(pulse * 0.55).toFixed(3)})`)
    grad.addColorStop(1,   `rgba(100,245,255,${(pulse * 0.75).toFixed(3)})`)
    ctx.beginPath()
    ctx.arc(R, R, outerR, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    // Bright cyan ring
    ctx.beginPath()
    ctx.arc(R, R, outerR * 0.97, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(0,240,255,${(pulse * 0.9).toFixed(3)})`
    ctx.lineWidth = 2.5
    ctx.stroke()
  }

  getMoonCanvas() { return this._moonCanvas }
  getMoonRadius() { return Math.round(this.radius * 0.24) }

  // -- Public API -----------------------------------------------------------
  reset() {
    this.force = 0
    this.angle = 0
    if (this._activeBtn) {
      this._releaseBtn(this._activeBtn)
      this._activeBtn = null
    }
  }

  hideRing() {
    if (this._base) this._base.style.opacity = '0'
  }

  showRing() {
    if (this._base) this._base.style.opacity = '1'
  }

  hideDirections() {
    // Hide the 4 cardinal buttons (first 4 in _buttons)
    this._buttons.slice(0, 4).forEach(btn => {
      btn.style.opacity = '0'
      btn.style.pointerEvents = 'none'
    })
  }

  showDirections() {
    this._buttons.slice(0, 4).forEach(btn => {
      btn.style.opacity = '1'
      btn.style.pointerEvents = 'all'
    })
  }

  destroy() {
    if (this._longPressTimer)    clearTimeout(this._longPressTimer)
    if (this._longPressInterval) clearInterval(this._longPressInterval)
    if (this._onFsChange) {
      document.removeEventListener('fullscreenchange',       this._onFsChange)
      document.removeEventListener('webkitfullscreenchange', this._onFsChange)
    }
    if (this._root?.parentNode)   this._root.parentNode.removeChild(this._root)
    if (this._fsIcon?.parentNode) this._fsIcon.parentNode.removeChild(this._fsIcon)
  }
}

