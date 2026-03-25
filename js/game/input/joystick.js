// Joystick.js
//
// 8-directional d-pad with:
//   - 4 cardinal buttons (up/down/left/right) — rectangular
//   - 4 diagonal buttons (corners) — smaller, between the cardinals
//   - Hold-state: force/angle stay active while finger is down, zero on release
//   - Gold glow feedback on active button
//   - Drag-thumb analog mode still works alongside buttons

export default class Joystick {
  constructor(scene, config) {
    this.scene  = scene;
    this.radius = config.radius || 60;
    this.baseX  = config.x;
    this.baseY  = config.y;

    this.force = 0;
    this.angle = 0;

    // Track which button is currently held
    this._activeButton = null;

    // ── Base ring ─────────────────────────────────────────────────────────────
    this.base = scene.add.circle(this.baseX, this.baseY, this.radius, 0x1a1a2e, 0.7);
    this.base.setStrokeStyle(2, 0x4a4a6a, 0.9);
    this.base.setScrollFactor(0);
    this.base.setDepth(1000);

    // ── Directional buttons ───────────────────────────────────────────────────
    //
    // Cardinal buttons: large squares at N/S/E/W
    // Diagonal buttons: smaller squares at NE/NW/SE/SW
    //
    // Angles follow Phaser convention (0° = right, clockwise):
    //   right=0, down=90, left=180/-180, up=-90
    //   diagonals: NE=-45, SE=45, SW=135, NW=-135

    const R  = this.radius;
    const bx = this.baseX;
    const by = this.baseY;

    // Cardinal offsets
    const cardOff  = R * 0.72;   // distance from centre
    const cardSize = R * 0.55;   // button size

    // Diagonal offsets (closer in, between cardinals)
    const diagOff  = R * 0.72;
    const diagSize = R * 0.38;
    const diagXY   = diagOff * Math.cos(Math.PI / 4);  // 45° component

    this.buttons = {};

    // Cardinals
    this.buttons.up    = this._makeButton(bx,           by - cardOff, cardSize, -90);
    this.buttons.down  = this._makeButton(bx,           by + cardOff, cardSize,  90);
    this.buttons.left  = this._makeButton(bx - cardOff, by,           cardSize, 180);
    this.buttons.right = this._makeButton(bx + cardOff, by,           cardSize,   0);

    // Diagonals — invisible hit areas between the cardinal buttons
    this.buttons.upRight   = this._makeButton(bx + diagXY, by - diagXY, diagSize, -45,  true);
    this.buttons.downRight = this._makeButton(bx + diagXY, by + diagXY, diagSize,  45,  true);
    this.buttons.downLeft  = this._makeButton(bx - diagXY, by + diagXY, diagSize, 135,  true);
    this.buttons.upLeft    = this._makeButton(bx - diagXY, by - diagXY, diagSize, -135, true);

    // ── Centre thumb ──────────────────────────────────────────────────────────
    this.thumb = scene.add.circle(bx, by, R * 0.22, 0x2a2a4a, 0.85);
    this.thumb.setStrokeStyle(2, 0x6a6a9a, 0.9);
    this.thumb.setScrollFactor(0);
    this.thumb.setDepth(1003);

    // ── Drag (analog) mode ────────────────────────────────────────────────────
    this.thumb.setInteractive();
    scene.input.setDraggable(this.thumb);

    scene.input.on('dragstart', (pointer, obj) => {
      if (obj !== this.thumb) return;
      this.thumb.setFillStyle(0x4a4a8a, 0.95);
      this.thumb.setScale(1.1);
    });

    scene.input.on('drag', (pointer, obj, dragX, dragY) => {
      if (obj !== this.thumb) return;

      // Release any held button when drag starts
      if (this._activeButton) this._releaseButton(this._activeButton);

      const dx  = pointer.x - bx;
      const dy  = pointer.y - by;
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

  // ── Button factory ────────────────────────────────────────────────────────

  _makeButton(x, y, size, angleDeg, invisible = false) {
    const alpha = invisible ? 0 : 0.6;
    const btn = this.scene.add.rectangle(x, y, size, size, 0x1e1e3a, alpha);
    btn.setStrokeStyle(1.5, invisible ? 0x000000 : 0x4a4a7a, invisible ? 0 : 0.8);
    btn._invisible = invisible;
    btn.setScrollFactor(0);
    btn.setDepth(1001);
    btn.setInteractive();

    btn.on('pointerdown', () => {
      this._pressButton(btn, angleDeg);
    });

    btn.on('pointerup',   () => { if (this._activeButton === btn) this._releaseButton(btn); });
    btn.on('pointerout',  () => { if (this._activeButton === btn) this._releaseButton(btn); });

    // Hover (desktop)
    btn.on('pointerover', () => {
      if (this._activeButton !== btn && !btn._invisible)
        btn.setFillStyle(0x2e2e5a, 0.8);
    });

    return btn;
  }

  _pressButton(btn, angleDeg) {
    // Release previously held button if any
    if (this._activeButton && this._activeButton !== btn)
      this._releaseButton(this._activeButton);

    this._activeButton = btn;

    // Gold glow — active state (only visible on cardinal buttons)
    if (!btn._invisible) {
      btn.setFillStyle(0x3a3000, 0.95);
      btn.setStrokeStyle(2, 0xd4af37, 1.0);
      btn.setScale(1.12);
    }

    this.force = this.radius;
    this.angle = angleDeg;
  }

  _releaseButton(btn) {
    if (!btn) return;
    if (!btn._invisible) {
      btn.setFillStyle(0x1e1e3a, 0.6);
      btn.setStrokeStyle(1.5, 0x4a4a7a, 0.8);
      btn.setScale(1.0);
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
    this.thumb.setFillStyle(0x2a2a4a, 0.85);
    this.thumb.setScale(1.0);
  }

  // ── Public API ────────────────────────────────────────────────────────────

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
        btn.setFillStyle(0x1e1e3a, 0.6);
        btn.setStrokeStyle(1.5, 0x4a4a7a, 0.8);
        btn.setScale(1.0);
      }
    });
  }
}

