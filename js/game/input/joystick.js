// Joystick.js
//
// 8-directional d-pad with:
//   - 4 cardinal buttons (up/down/left/right) -- TileSprite with darkStone texture
//   - 4 diagonal buttons (corners) -- invisible hit areas
//   - Base circle -- TileSprite with darkStone, clipped by geometry mask
//   - Gold stroke overlay via Graphics
//   - Drag-thumb analog mode still works alongside buttons

export default class Joystick {
  constructor(scene, config) {
    this.scene  = scene;
    this.radius = config.radius || 60;
    this.baseX  = config.x;
    this.baseY  = config.y;

    this.force = 0;
    this.angle = 0;

    this._activeButton = null;

    const R  = this.radius;
    const bx = this.baseX;
    const by = this.baseY;

    // -- Base circle -- TileSprite masked to circle shape ---------------------
    const hasStone = this._textureExists('darkStone');

    if (hasStone) {
      // Draw the circle mask shape
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

    // Gold ring over the base circle edge
    this._baseRingGfx = scene.add.graphics();
    this._baseRingGfx.setScrollFactor(0);
    this._baseRingGfx.setDepth(1001);
    this._baseRingGfx.lineStyle(1.5, 0xd4af37, 0.6);
    this._baseRingGfx.strokeCircle(bx, by, R);

    // -- Layout constants -----------------------------------------------------
    const cardOff  = R * 0.72;
    const cardSize = R * 0.55 + 1;   // +1px to close gap at circle edge

    const diagOff  = R * 0.72;
    const diagSize = R * 0.38 + 1;
    const diagXY   = diagOff * Math.cos(Math.PI / 4);

    // -- Gold stroke Graphics layer -------------------------------------------
    // Depth layering: base(1000) < baseRing(1001) < buttons(1002) < strokeGfx(1003) < thumb(1004)
    this._strokeGfx = scene.add.graphics();
    this._strokeGfx.setScrollFactor(0);
    this._strokeGfx.setDepth(1003);

    this.buttons = {};

    // Cardinals
    this.buttons.up    = this._makeButton(bx,           by - cardOff, cardSize, -90);
    this.buttons.down  = this._makeButton(bx,           by + cardOff, cardSize,  90);
    this.buttons.left  = this._makeButton(bx - cardOff, by,           cardSize, 180);
    this.buttons.right = this._makeButton(bx + cardOff, by,           cardSize,   0);

    // Diagonals -- invisible hit areas
    this.buttons.upRight   = this._makeButton(bx + diagXY, by - diagXY, diagSize, -45,  true);
    this.buttons.downRight = this._makeButton(bx + diagXY, by + diagXY, diagSize,  45,  true);
    this.buttons.downLeft  = this._makeButton(bx - diagXY, by + diagXY, diagSize, 135,  true);
    this.buttons.upLeft    = this._makeButton(bx - diagXY, by - diagXY, diagSize, -135, true);

    // Draw initial gold strokes
    this._redrawStrokes();

    // -- Centre thumb ---------------------------------------------------------
    this.thumb = scene.add.circle(bx, by, R * 0.22, 0x0a0a0a, 0.9);
    this.thumb.setStrokeStyle(1.5, 0xd4af37, 0.7);
    this.thumb.setScrollFactor(0);
    this.thumb.setDepth(1004);

    // -- Drag (analog) mode ---------------------------------------------------
    this.thumb.setInteractive();
    scene.input.setDraggable(this.thumb);

    scene.input.on('dragstart', (pointer, obj) => {
      if (obj !== this.thumb) return;
      this.thumb.setFillStyle(0x1a1200, 0.95);
      this.thumb.setScale(1.1);
    });

    scene.input.on('drag', (pointer, obj, dragX, dragY) => {
      if (obj !== this.thumb) return;
      if (this._activeButton) this._releaseButton(this._activeButton);

      const dx   = pointer.x - bx;
      const dy   = pointer.y - by;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ang  = Math.atan2(dy, dx);

      if (dist < R) {
        this.thumb.x = pointer.x;
        this.thumb.y = pointer.y;
        this.force   = dist;
      } else {
        this.thumb.x = bx + Math.cos(ang) * R;
        this.thumb.y = by + Math.sin(ang) * R;
        this.force   = R;
      }
      this.angle = Math.atan2(this.thumb.y - by, this.thumb.x - bx) * (180 / Math.PI);
    });

    scene.input.on('dragend', (pointer, obj) => {
      if (obj !== this.thumb) return;
      this._resetThumb();
      this.force = 0;
      this.angle = 0;
    });
  }

  // -- Texture check ---------------------------------------------------------

  _textureExists(key) {
    try { return this.scene.textures.exists(key); } catch(e) { return false; }
  }

  // -- Button factory --------------------------------------------------------

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

    // Use natural bounds -- works correctly for both TileSprite and Rectangle
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

  // -- Gold stroke overlay ---------------------------------------------------

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

      // Faux bevel -- lighter line along top edge
      gfx.lineStyle(1, 0xf5e090, isActive ? 0.35 : 0.18);
      gfx.lineBetween(x + 2, y + 2, x + size - 2, y + 2);
    }
  }

  // -- Press / release -------------------------------------------------------

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

  _resetThumb() {
    this.thumb.x = this.baseX;
    this.thumb.y = this.baseY;
    this.thumb.setFillStyle(0x0a0a0a, 0.9);
    this.thumb.setScale(1.0);
  }

  // -- Public API ------------------------------------------------------------

  reset() {
    this.force = 0;
    this.angle = 0;
    this._resetThumb();
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
}

