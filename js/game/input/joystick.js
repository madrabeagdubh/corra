// Joystick.js
//
// 8-directional d-pad with moon widget embedded in the hub centre.
//
//   - 4 cardinal buttons (up/down/left/right) -- TileSprite with darkStone texture
//   - 4 diagonal buttons (corners) -- invisible hit areas
//   - Base circle -- TileSprite with darkStone, clipped by geometry mask
//   - Gold stroke overlay via Graphics
//   - Centre hub: moon canvas (no drag-thumb analog mode)
//
// Centre hub interactions:
//   - Swipe left/right  → change moon phase
//   - Long press        → onLongPress() callback (open menu hub)
//   - Short tap         → onTap() callback (open encounter panel / toggle menu)

export default class Joystick {
  constructor(scene, config) {
    this.scene  = scene;
    this.radius = config.radius || 60;
    this.baseX  = config.x;
    this.baseY  = config.y;

    this.force = 0;
    this.angle = 0;

    this._activeButton = null;

    // Callbacks for centre hub
    this._onTap       = config.onTap       ?? null;   // short tap
    this._onLongPress = config.onLongPress  ?? null;   // long press
    this._onSwipe     = config.onSwipe      ?? null;   // (deltaX) swipe delta

    const R  = this.radius;
    const bx = this.baseX;
    const by = this.baseY;

    // -- Base circle ----------------------------------------------------------
    const hasStone = this._textureExists('darkStone');

    if (hasStone) {
      const maskGfx = scene.add.graphics();
      maskGfx.fillStyle(0xffffff, 1);
      maskGfx.fillCircle(bx, by, R);
      maskGfx.setScrollFactor(0);

      this.base = scene.add.tileSprite(bx, by, R * 2, R * 2, 'darkStone');
      this.base.setAlpha(0.88);
      this.base.setMask(maskGfx.createGeometryMask());
    } else {
      this.base = scene.add.circle(bx, by, R, 0x050505, 0.85);
    }
    this.base.setScrollFactor(0);
    this.base.setDepth(1000);

    // Gold ring
    this._baseRingGfx = scene.add.graphics();
    this._baseRingGfx.setScrollFactor(0);
    this._baseRingGfx.setDepth(1001);
    this._baseRingGfx.lineStyle(1.5, 0xd4af37, 0.6);
    this._baseRingGfx.strokeCircle(bx, by, R);

    // -- Layout constants -----------------------------------------------------
    const cardOff  = R * 0.72;
    const cardSize = R * 0.55 + 1;

    const diagOff  = R * 0.72;
    const diagSize = R * 0.38 + 1;
    const diagXY   = diagOff * Math.cos(Math.PI / 4);

    // -- Gold stroke Graphics layer -------------------------------------------
    this._strokeGfx = scene.add.graphics();
    this._strokeGfx.setScrollFactor(0);
    this._strokeGfx.setDepth(1003);

    this.buttons = {};

    // Cardinals
    this.buttons.up    = this._makeButton(bx,           by - cardOff, cardSize, -90);
    this.buttons.down  = this._makeButton(bx,           by + cardOff, cardSize,  90);
    this.buttons.left  = this._makeButton(bx - cardOff, by,           cardSize, 180);
    this.buttons.right = this._makeButton(bx + cardOff, by,           cardSize,   0);

    // Diagonals
    this.buttons.upRight   = this._makeButton(bx + diagXY, by - diagXY, diagSize, -45,  true);
    this.buttons.downRight = this._makeButton(bx + diagXY, by + diagXY, diagSize,  45,  true);
    this.buttons.downLeft  = this._makeButton(bx - diagXY, by + diagXY, diagSize, 135,  true);
    this.buttons.upLeft    = this._makeButton(bx - diagXY, by - diagXY, diagSize, -135, true);

    this._redrawStrokes();

    // -- Centre moon hub DOM element ------------------------------------------
    // A DOM canvas sits over the Phaser canvas at the hub position.
    // The moon widget will render into this canvas.
    const hubD    = Math.round(R * 0.48) * 2   // diameter of hub moon
    this._hubDom  = document.createElement('div')
    this._hubDom.id = 'dpad-moon-hub'

    // Convert Phaser canvas-local coords to page coords
    const phaserCanvas = scene.game.canvas
    const canvasRect   = phaserCanvas.getBoundingClientRect()
    const scaleX       = canvasRect.width  / phaserCanvas.width
    const scaleY       = canvasRect.height / phaserCanvas.height
    const pageX        = canvasRect.left + bx * scaleX
    const pageY        = canvasRect.top  + by * scaleY
    const hubDScaled   = hubD * Math.min(scaleX, scaleY)

    this._hubDom.style.cssText = [
      'position:fixed;',
      `left:${pageX - hubDScaled / 2}px;`,
      `top:${pageY  - hubDScaled / 2}px;`,
      `width:${hubDScaled}px;`,
      `height:${hubDScaled}px;`,
      'z-index:1000005;',
      'border-radius:50%;',
      'overflow:hidden;',
      'pointer-events:all;',
      'cursor:grab;',
      // Gold ring matching dpad aesthetic
      `border:1.5px solid rgba(212,175,55,0.7);`,
      'background:url(assets/ciorcal-glass-bg.png) center/cover no-repeat;',
    ].join('')

    // The actual moon canvas inside the hub
    this._moonCanvas = document.createElement('canvas')
    this._moonCanvas.width  = hubD
    this._moonCanvas.height = hubD
    this._moonCanvas.style.cssText = [
      `width:${hubDScaled}px;`,
      `height:${hubDScaled}px;`,
      'transform:rotate(160deg);',
      'display:block;',
      'touch-action:none;',
    ].join('')
    this._hubDom.appendChild(this._moonCanvas)

    // Fullscreen icon overlay -- small, top-right of hub
    this._fsIcon = document.createElement('div')
    this._fsIcon.style.cssText = [
      'position:absolute;',
      'top:2px;right:2px;',
      'width:14px;height:14px;',
      'display:flex;align-items:center;justify-content:center;',
      'font-size:9px;',
      'color:rgba(212,175,55,0.7);',
      'pointer-events:all;',
      'cursor:pointer;',
      'z-index:2;',
    ].join('')
    this._fsIcon.textContent = '⛶'
    this._fsIcon.addEventListener('pointerup', (e) => {
      e.stopPropagation()
      this._requestFullscreen()
    })
    this._hubDom.appendChild(this._fsIcon)

    phaserCanvas.parentNode.appendChild(this._hubDom)

    // -- Centre hub interaction -----------------------------------------------
    this._hubSwipeStartX  = 0
    this._hubSwipeStartT  = 0
    this._hubDragging     = false
    this._longPressTimer  = null
    this._longPressFired  = false
    const LONG_PRESS_MS   = 500

    this._moonCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this._moonCanvas.setPointerCapture(e.pointerId)
      this._hubSwipeStartX = e.clientX
      this._hubSwipeStartT = performance.now()
      this._hubDragging    = false
      this._longPressFired = false

      this._longPressTimer = setTimeout(() => {
        this._longPressFired = true
        if (this._onLongPress) this._onLongPress()
      }, LONG_PRESS_MS)
    }, { passive: false })

    this._moonCanvas.addEventListener('pointermove', (e) => {
      if (performance.now() - this._hubSwipeStartT < 50) return
      const dx = e.clientX - this._hubSwipeStartX
      if (Math.abs(dx) > 6) {
        // Cancel long press if swiping
        if (this._longPressTimer) {
          clearTimeout(this._longPressTimer)
          this._longPressTimer = null
        }
        this._hubDragging = true
        if (this._onSwipe) this._onSwipe(dx)
        this._hubSwipeStartX = e.clientX  // incremental deltas
      }
    }, { passive: true })

    this._moonCanvas.addEventListener('pointerup', (e) => {
      e.preventDefault()
      if (this._longPressTimer) {
        clearTimeout(this._longPressTimer)
        this._longPressTimer = null
      }
      this._moonCanvas.releasePointerCapture(e.pointerId)

      const dt = performance.now() - this._hubSwipeStartT
      const dx = Math.abs(e.clientX - this._hubSwipeStartX)

      if (!this._longPressFired && !this._hubDragging && dt < 400 && dx < 12) {
        if (this._onTap) this._onTap()
      }
      this._hubDragging    = false
      this._longPressFired = false
    }, { passive: false })

    this._moonCanvas.addEventListener('pointercancel', () => {
      if (this._longPressTimer) {
        clearTimeout(this._longPressTimer)
        this._longPressTimer = null
      }
      this._hubDragging    = false
      this._longPressFired = false
    })
  }

  // -- Fullscreen -----------------------------------------------------------
  _requestFullscreen() {
    const el = document.documentElement
    try {
      if (el.requestFullscreen)             el.requestFullscreen()
      else if (el.webkitRequestFullscreen)  el.webkitRequestFullscreen()
    } catch(e) {}
  }

  // -- Moon canvas access ---------------------------------------------------
  getMoonCanvas() {
    return this._moonCanvas
  }

  getMoonRadius() {
    return Math.round(this.radius * 0.24)
  }

  // -- Texture check --------------------------------------------------------
  _textureExists(key) {
    try { return this.scene.textures.exists(key); } catch(e) { return false; }
  }

  // -- Button factory -------------------------------------------------------
  _makeButton(x, y, size, angleDeg, invisible = false) {
    let btn;

    if (invisible) {
      btn = this.scene.add.rectangle(x, y, size, size, 0x000000, 0);
      btn._invisible = true;
    } else {
      if (this._textureExists('darkStone')) {
        btn = this.scene.add.tileSprite(x, y, size, size, 'darkStone');
        btn.setAlpha(0.82);
      } else {
        btn = this.scene.add.rectangle(x, y, size, size, 0x080808, 0.7);
      }
      btn._invisible = false;
    }

    btn._x      = x;
    btn._y      = y;
    btn._size   = size;
    btn._active = false;

    btn.setScrollFactor(0);
    btn.setDepth(1002);
    btn.setInteractive();

    btn.on('pointerdown', () => this._pressButton(btn, angleDeg));
    btn.on('pointerup',   () => { if (this._activeButton === btn) this._releaseButton(btn); });
    btn.on('pointerout',  () => { if (this._activeButton === btn) this._releaseButton(btn); });
    btn.on('pointerover', () => {
      if (!btn._invisible && !btn._active) {
        btn.setAlpha(0.95);
        this._redrawStrokes();
      }
    });

    return btn;
  }

  // -- Gold stroke overlay --------------------------------------------------
  _redrawStrokes() {
    const gfx = this._strokeGfx;
    gfx.clear();

    for (const btn of Object.values(this.buttons)) {
      if (btn._invisible) continue;

      const isActive = btn._active;
      const color    = isActive ? 0xf5d060 : 0xd4af37;
      const alpha    = isActive ? 1.0      : 0.55;
      const weight   = isActive ? 2        : 1;
      const size     = btn._size;
      const x        = btn._x - size / 2;
      const y        = btn._y - size / 2;

      gfx.lineStyle(weight, color, alpha);
      gfx.strokeRect(x, y, size, size);

      gfx.lineStyle(1, 0xf5e090, isActive ? 0.35 : 0.18);
      gfx.lineBetween(x + 2, y + 2, x + size - 2, y + 2);
    }
  }

  // -- Press / release ------------------------------------------------------
  _pressButton(btn, angleDeg) {
    if (this._activeButton && this._activeButton !== btn)
      this._releaseButton(this._activeButton);

    this._activeButton = btn;

    if (!btn._invisible) {
      btn._active = true;
      btn.setAlpha(0.98);
      btn.setScale(1.08);
      this._redrawStrokes();
    }

    this.force = this.radius;
    this.angle = angleDeg;
  }

  _releaseButton(btn) {
    if (!btn) return;

    if (!btn._invisible) {
      btn._active = false;
      btn.setAlpha(0.82);
      btn.setScale(1.0);
      this._redrawStrokes();
    }

    if (this._activeButton === btn) {
      this._activeButton = null;
      this.force = 0;
      this.angle = 0;
    }
  }

  // -- Public API -----------------------------------------------------------
  reset() {
    this.force = 0;
    this.angle = 0;
    if (this._activeButton) {
      this._releaseButton(this._activeButton);
      this._activeButton = null;
    }
    Object.values(this.buttons).forEach(btn => {
      if (!btn._invisible) {
        btn._active = false;
        btn.setAlpha(0.82);
        btn.setScale(1.0);
      }
    });
    this._redrawStrokes();
  }

  destroy() {
    if (this._longPressTimer) clearTimeout(this._longPressTimer)
    if (this._hubDom?.parentNode) this._hubDom.parentNode.removeChild(this._hubDom)
  }
}

