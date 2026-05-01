import Phaser from "phaser";

/**
 * Easca3 — Irish-optimised keyboard for Corra
 *
 * Performance notes:
 *  - No delayedCall chains for key fade — single short tween via Phaser.Tweens
 *  - pointerup always fires letter even after slight finger drift (no pointerout cancel)
 *  - isLongPressing guarded carefully so fast taps never get swallowed
 *  - All objects on scene directly (not in Container) so hit areas are always correct
 */

class Easca3 {
  constructor(scene, onSendMessageCallback) {
    this.myScene = scene;
    this.onSendMessageCallback = onSendMessageCallback;
    this.DEPTH = 2000;
    this.FONT  = 'urchlo, Georgia, serif';

    // ── Palette ───────────────────────────────────────────────────────────────
    this.C = {
      keyBg:         0x0d1a2e,
      keyStroke:     0x3a5a8a,
      keyPressed:    0x4fc3f7,
      accentBg:      0x1a1040,
      accentStroke:  0x7b5ea7,
      accentPressed: 0x9c6fff,
      sendBg:        0x0a2a1a,
      sendStroke:    0x2e9e6a,
      sendPressed:   0x3ddc84,
      bsBg:          0x2a1000,   // orange-tinted backspace
      bsStroke:      0x8a4a00,
      bsPressed:     0xff8c00,
      panelBg:       0x04090f,
      panelStroke:   0x1e3a5a,
    };

    // ── Irish layout ──────────────────────────────────────────────────────────
    // Each cell: [ displayChar, ...longPressVariants ]
    // Single-item cell = no long-press menu
    this.irishLayout = [
      [['e','é','E','É'], ['r'],               ['t','T','th','Th'], ['u','ú','U','Ú'], ['i','í','I','Í'], ['o','ó','O','Ó'], ['p','P','ph','Ph']],
      [['a','á','A','Á'], ['s','S','sh','Sh'], ['d','D','dh','Dh'], ['f','F','fh','Fh'], ['g','G','gh','Gh','ng','nG'], ['h'], ['l']],
      [['c','C','ch','Ch'], ['b','B','bh','Bh'], ['n'], ['m','M','mh','Mh'], ['.', ',', "\u2026"], ['?','!','\u00bf'], ['!','?','\u00a1']],
    ];

    // ── Numeric layout ────────────────────────────────────────────────────────
    this.numericLayout = [
      [['q'], ['w'], ['y'],  ["'",'\u201c','\u201d'], ['1'], ['2'], ['3']],
      [['j'], ['k'], ['-','\u2013','\u2014'],  ['4'], ['5'], ['6'], ['7']],
      [['z'], ['x'], ['v'],  ['.'],             ['8'], ['9'], ['0']],
    ];

    // Stagger offsets per row (fraction of keySpacing)
    this.rowStagger = [0, 0, 0.0];

    // ── State ─────────────────────────────────────────────────────────────────
    this.numericModeActive = false;
    this.typedText         = '';
    this.keyObjects        = {};
    this.controlObjects    = [];
    this.letterObjects     = [];
    this.currentAccentMenu = null;
    this.longPressTimer    = null;
    this.longPressDelay    = 500;
    this.isLongPressing    = false;
    this.keySize           = 0;
    this.keySpacing        = 0;
    this.visible           = false;

    // Track which key rect is currently pressed (for reliable release)
    this._pressedKey       = null;
    this._pressedNormalColor = null;

    // ── Text zone ─────────────────────────────────────────────────────────────
    this.textZoneBg = this.myScene.add.rectangle(0, 0, 100, 100, 0x04090f)
      .setStrokeStyle(1.5, 0x1e3a5a).setAlpha(0.96)
      .setScrollFactor(0).setDepth(this.DEPTH + 1).setVisible(false);

    this.textDisplay = this.myScene.add.text(0, 0, 'Scr\u00edobh\u2026', {
      fontSize: '28px', fill: '#2a4a6a',
      fontFamily: this.FONT, wordWrap: { width: 300 }, align: 'center',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(this.DEPTH + 2).setVisible(false);

    // ── Background panel ─────────────────────────────────────────────────────
    this.bgPanel = this.myScene.add.rectangle(0, 0, 10, 10, this.C.panelBg)
      .setStrokeStyle(1.5, this.C.panelStroke).setAlpha(0.97)
      .setScrollFactor(0).setDepth(this.DEPTH).setVisible(false);

    this.updateLayout();
    this.myScene.scale.on('resize', this.updateLayout, this);
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  updateLayout() {
    const W = this.myScene.scale.width;
    const H = this.myScene.scale.height;

    const hPad       = W * 0.025;
    this.keySpacing  = (W - hPad * 2) / 7;
    this.keySize     = Math.min(this.keySpacing * 0.94, 68);

    const vPad        = H * 0.025;
    const controlRowY = H - vPad - this.keySize / 2;
    this.controlRowY  = controlRowY;
    this.rowYPositions = [
      controlRowY - this.keySpacing * 3,
      controlRowY - this.keySpacing * 2,
      controlRowY - this.keySpacing * 1,
    ];
    this.rowStartX = (W - 6 * this.keySpacing) / 2;

    // Text zone — top 30%
    const zoneH = H * 0.30, zoneW = W * 0.92;
    const zoneCY = H * 0.01 + zoneH / 2;
    this.textZoneBg.setPosition(W / 2, zoneCY).setSize(zoneW, zoneH);
    this.textDisplay.setPosition(W / 2, zoneCY)
      .setWordWrapWidth(zoneW - 32)
      .setFontSize(`${Math.max(22, Math.round(H * 0.042))}px`);

    // Background panel
    const topY = this.rowYPositions[0] - this.keySize / 2 - 10;
    const botY = controlRowY + this.keySize / 2 + 10;
    this.bgPanel.setPosition(W / 2, topY + (botY - topY) / 2).setSize(W, botY - topY);

    this._destroyControlRow();
    this._destroyLetterKeys();
    this._buildControlRow();
    this._buildLetterKeys();

    if (this.visible) this._showAllObjects();
  }

  // ── Control row ────────────────────────────────────────────────────────────
  _destroyControlRow() {
    this.controlObjects.forEach(o => { if (o?.active) o.destroy(); });
    this.controlObjects  = [];
    this.modeButton      = null;
    this.modeButtonLabel = null;
  }

  _buildControlRow() {
    const Y = this.controlRowY, ks = this.keySize, sp = this.keySpacing, C = this.C;
    const col0 = this.rowStartX;
    const col5 = this.rowStartX + 5 * sp;
    const col6 = this.rowStartX + 6 * sp;

    // MODE button
    this.modeButton = this._makeKey(col0, Y, ks * 1.1, ks, C.accentBg, C.accentStroke);
    this.modeButtonLabel = this._makeLabel(col0, Y, this.numericModeActive ? 'ABC' : '123', ks * 0.33);
    this.modeButtonLabel.setStyle({
      fill: this.numericModeActive ? '#9c6fff' : '#c8deff',
      fontFamily: this.FONT,
    });
    this._bindSimpleKey(this.modeButton, this.modeButtonLabel, C.accentBg, C.accentPressed, () => {
      this._toggleNumericMode();
    });
    this.controlObjects.push(this.modeButton, this.modeButtonLabel);

    // BACKSPACE — orange tinted
    const bsKey = this._makeKey(col5, Y, ks, ks, C.bsBg, C.bsStroke);
    const bsLbl = this._makeLabel(col5, Y, '⌫', ks * 0.42);
    bsLbl.setStyle({ fill: '#ff8c00', fontFamily: this.FONT });
    this._bindSimpleKey(bsKey, bsLbl, C.bsBg, C.bsPressed, () => {
      this.handleBackspace();
    });
    this.controlObjects.push(bsKey, bsLbl);

    // SEND
    const sendKey = this._makeKey(col6, Y, ks * 1.1, ks, C.sendBg, C.sendStroke);
    const sendLbl = this._makeLabel(col6, Y, '↑', ks * 0.50);
    sendLbl.setStyle({ fill: '#3ddc84', fontFamily: this.FONT });
    this._bindSimpleKey(sendKey, sendLbl, C.sendBg, C.sendPressed, () => {
      this.sendMessage();
    });
    this.controlObjects.push(sendKey, sendLbl);

    // SPACEBAR
    const spLeft  = this.rowStartX + 1 * sp - ks / 2;
    const spRight = this.rowStartX + 4 * sp + ks / 2;
    const spW     = spRight - spLeft;
    const spCX    = spLeft + spW / 2;
    const spKey   = this._makeKey(spCX, Y, spW, ks, C.accentBg, C.accentStroke);
    const spLbl   = this._makeLabel(spCX, Y, '___', ks * 0.28);
    spLbl.setStyle({ fill: '#3a5a8a', fontFamily: this.FONT });
    this._bindSimpleKey(spKey, spLbl, C.accentBg, C.accentPressed, () => {
      this.addLetterToText(' ');
    });
    this.controlObjects.push(spKey, spLbl);

    this.controlObjects.forEach(o => o.setVisible(this.visible));
  }

  // ── Letter keys ────────────────────────────────────────────────────────────
  _destroyLetterKeys() {
    this.letterObjects.forEach(o => { if (o?.active) o.destroy(); });
    this.letterObjects = [];
    this.keyObjects    = {};
  }

  _buildLetterKeys() {
    const C      = this.C;
    const layout = this.numericModeActive ? this.numericLayout : this.irishLayout;

    layout.forEach((row, rowIndex) => {
      const y            = this.rowYPositions[rowIndex];
      const stagger      = (this.rowStagger[rowIndex] || 0) * this.keySpacing;
      const centreOffset = ((7 - row.length) * this.keySpacing) / 2;
      const rowX0        = this.rowStartX + stagger + centreOffset;

      row.forEach((cell, colIndex) => {
        const x           = rowX0 + colIndex * this.keySpacing;
        const displayChar = cell[0];
        const variants    = cell.length > 1 ? cell : null;

        // Skip blank spacer cells
        if (displayChar === ' ') return;

        const key      = this._makeKey(x, y, this.keySize, this.keySize, C.keyBg, C.keyStroke);
        const fSize    = this.keySize * (displayChar.length === 1 ? 0.46 : 0.34);
        const keyLabel = this._makeLabel(x, y, displayChar, fSize);

        if (this.numericModeActive) {
          keyLabel.setStyle({ fill: '#a0c8ff', fontFamily: this.FONT });
        }

        this.keyObjects[displayChar] = { key, keyLabel };
        this.letterObjects.push(key, keyLabel);

        // Long-press or simple tap
        if (variants) {
          this._bindLongPressKey(key, keyLabel, displayChar, variants);
        } else {
          this._bindSimpleKey(key, keyLabel, C.keyBg, C.keyPressed, () => {
            this.addLetterToText(displayChar);
          });
        }

        key.setVisible(this.visible);
        keyLabel.setVisible(this.visible);
      });
    });
  }

  // ── Input binding helpers ─────────────────────────────────────────────────
  // Simple key: lights up on down, fires action on up, works even after drift
  _bindSimpleKey(keyRect, keyLabel, normalColor, pressColor, action) {
    let pressed = false;

    keyRect.on('pointerdown', () => {
      pressed = true;
      keyRect.setFillStyle(pressColor);
      if (keyLabel) keyLabel.setScale(1.1);
    });

    keyRect.on('pointerup', () => {
      if (!pressed) return;
      pressed = false;
      this._releaseVisual(keyRect, keyLabel, normalColor);
      action();
    });

    // pointerout does NOT cancel the action — only resets visual
    keyRect.on('pointerout', () => {
      if (!pressed) return;
      // finger drifted off — reset visual but action still fires on pointerup
      this._releaseVisual(keyRect, keyLabel, normalColor);
      // don't set pressed=false; pointerup can still come
    });
  }

  // Long-press key: short tap = type char, hold = show variants menu
  _bindLongPressKey(keyRect, keyLabel, displayChar, variants) {
    const C = this.C;
    let pressed = false;

    keyRect.on('pointerdown', () => {
      pressed = true;
      this.isLongPressing = false;
      keyRect.setFillStyle(C.keyPressed);
      keyLabel.setScale(1.1);

      if (this.longPressTimer) { this.longPressTimer.destroy(); this.longPressTimer = null; }
      this.longPressTimer = this.myScene.time.delayedCall(this.longPressDelay, () => {
        if (!pressed) return;
        this.isLongPressing = true;
        this.showAccentMenu(displayChar, keyRect, variants);
      });
    });

    keyRect.on('pointerup', () => {
      if (!pressed) return;
      pressed = false;
      if (this.longPressTimer) { this.longPressTimer.destroy(); this.longPressTimer = null; }
      this._releaseVisual(keyRect, keyLabel, C.keyBg);
      if (!this.isLongPressing && !this.currentAccentMenu) {
        this.addLetterToText(displayChar);
      }
      this.isLongPressing = false;
    });

    keyRect.on('pointerout', () => {
      // Visual reset only — don't cancel, pointerup can still arrive
      if (!pressed) return;
      this._releaseVisual(keyRect, keyLabel, C.keyBg);
    });
  }

  // Visual release — quick fade via a single Phaser tween (no delayedCall chain)
  _releaseVisual(keyRect, keyLabel, normalColor) {
    if (keyLabel) keyLabel.setScale(1.0);
    if (!keyRect?.active) return;

    // Kill any existing tween on this rect
    this.myScene.tweens.killTweensOf(keyRect);

    // Snapshot pressed color components
    const sR = 0x4f, sG = 0xc3, sB = 0xf7;
    const eR = (normalColor >> 16) & 0xff;
    const eG = (normalColor >> 8)  & 0xff;
    const eB =  normalColor        & 0xff;

    // Use a single tween on a plain object to avoid Phaser color tween quirks
    const proxy = { t: 0 };
    this.myScene.tweens.add({
      targets:  proxy,
      t:        1,
      duration: 150,
      ease:     'Quad.easeOut',
      onUpdate: () => {
        if (!keyRect?.active) return;
        const p = proxy.t;
        keyRect.setFillStyle(Phaser.Display.Color.GetColor(
          Math.round(sR + (eR - sR) * p),
          Math.round(sG + (eG - sG) * p),
          Math.round(sB + (eB - sB) * p)
        ));
      },
      onComplete: () => {
        if (keyRect?.active) keyRect.setFillStyle(normalColor);
      },
    });
  }

  // ── 123 / ABC toggle ──────────────────────────────────────────────────────
  _toggleNumericMode() {
    this.numericModeActive = !this.numericModeActive;
    if (this.modeButtonLabel) {
      this.modeButtonLabel.setText(this.numericModeActive ? 'ABC' : '123');
      this.modeButtonLabel.setStyle({
        fill: this.numericModeActive ? '#9c6fff' : '#c8deff',
        fontFamily: this.FONT,
      });
    }
    this._destroyLetterKeys();
    this._buildLetterKeys();
  }

  // ── Accent / variant menu ─────────────────────────────────────────────────
  showAccentMenu(displayChar, baseKeyRect, variants) {
    if (!variants?.length) return;
    this.hideAccentMenu();

    const overlay = this.myScene.add.rectangle(
      this.myScene.cameras.main.centerX, this.myScene.cameras.main.centerY,
      this.myScene.cameras.main.width,   this.myScene.cameras.main.height,
      0x000000, 0
    ).setScrollFactor(0).setDepth(this.DEPTH + 4).setInteractive();
    overlay.on('pointerdown', (ptr) => {
      const b = this.currentAccentMenu?.container?.getBounds();
      if (!b || !b.contains(ptr.x, ptr.y)) this.hideAccentMenu();
      ptr.event.stopPropagation();
    });

    const menuY = baseKeyRect.y - this.keySize - 10;
    const mc    = this.myScene.add.container(baseKeyRect.x, menuY)
      .setDepth(this.DEPTH + 5).setScrollFactor(0);

    const btnW = this.keySize, gap = 5;
    const cols = Math.min(variants.length, 6);
    const totalW = cols * (btnW + gap) - gap;

    mc.add(
      this.myScene.add.rectangle(0, 0, totalW + 14, this.keySize + 10, 0x04090f)
        .setStrokeStyle(1.5, 0x3a5a8a).setScrollFactor(0)
    );

    variants.forEach((v, i) => {
      const bx  = (i % cols) * (btnW + gap) - totalW / 2 + btnW / 2;
      const by  = Math.floor(i / cols) * (this.keySize + gap);
      const btn = this.myScene.add.rectangle(bx, by, btnW, this.keySize, this.C.keyBg)
        .setStrokeStyle(1.5, this.C.accentStroke).setScrollFactor(0).setInteractive();
      const lbl = this.myScene.add.text(bx, by, v, {
        fontSize: `${Math.max(12, Math.round(this.keySize * 0.38))}px`,
        fill: '#c8deff', fontFamily: this.FONT,
      }).setOrigin(0.5).setScrollFactor(0);

      btn.on('pointerdown', (ptr) => {
        btn.setFillStyle(this.C.keyPressed);
        ptr.event.stopPropagation();
      });
      btn.on('pointerup', (ptr) => {
        this.addLetterToText(v);
        this.hideAccentMenu();
        ptr.event.stopPropagation();
      });
      btn.on('pointerover', () => btn.setFillStyle(0x1a3a5e));
      btn.on('pointerout',  () => btn.setFillStyle(this.C.keyBg));
      mc.add(btn); mc.add(lbl);
    });

    this.currentAccentMenu = { container: mc, displayChar, baseKey: baseKeyRect, overlay };
  }

  hideAccentMenu() {
    if (!this.currentAccentMenu) return;
    const { container, overlay } = this.currentAccentMenu;
    if (overlay?.active)   { overlay.off('pointerdown'); overlay.destroy(); }
    if (container?.active) { container.destroy(); }
    this.currentAccentMenu = null;
    this.isLongPressing    = false;
    if (this.longPressTimer) { this.longPressTimer.destroy(); this.longPressTimer = null; }
  }

  // ── Factories ─────────────────────────────────────────────────────────────
  _makeKey(x, y, w, h, fill, stroke) {
    return this.myScene.add.rectangle(x, y, w, h, fill)
      .setStrokeStyle(1.5, stroke).setAlpha(0.95)
      .setScrollFactor(0).setDepth(this.DEPTH).setInteractive();
  }

  _makeLabel(x, y, text, fontSize) {
    return this.myScene.add.text(x, y, text, {
      fontSize: `${Math.max(13, Math.round(fontSize))}px`,
      fill: '#c8deff', fontFamily: this.FONT,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(this.DEPTH + 1);
  }

  _showAllObjects() {
    this.bgPanel.setVisible(true);
    this.controlObjects.forEach(o => o?.setVisible(true));
    this.letterObjects.forEach(o => o?.setVisible(true));
  }

  _hideAllObjects() {
    this.bgPanel.setVisible(false);
    this.controlObjects.forEach(o => o?.setVisible(false));
    this.letterObjects.forEach(o => o?.setVisible(false));
  }

  // ── Text ──────────────────────────────────────────────────────────────────
  addLetterToText(letter) {
    this.typedText += letter;
    this.updateTextDisplay();
    this.myScene.events.emit('keyPressed', letter);
  }

  handleBackspace() {
    if (this.typedText.length > 0) {
      this.typedText = this.typedText.slice(0, -1);
      this.updateTextDisplay();
      this.myScene.events.emit('keyPressed', 'BACKSPACE');
    }
  }

  updateTextDisplay() {
    if (!this.textDisplay) return;
    if (this.typedText.length === 0) {
      this.textDisplay.setText('Scr\u00edobh\u2026');
      this.textDisplay.setStyle({ fill: '#2a4a6a', fontFamily: this.FONT });
    } else {
      this.textDisplay.setText(this.typedText);
      this.textDisplay.setStyle({ fill: '#c8deff', fontFamily: this.FONT });
    }
  }

  sendMessage() {
    if (this.onSendMessageCallback && this.typedText.trim() !== '') {
      this.onSendMessageCallback(this.typedText);
      this.clearText();
      this.hideKeyboard();
    }
  }

  clearText()   { this.typedText = ''; this.updateTextDisplay(); }
  getText()     { return this.typedText; }
  setText(t)    { this.typedText = t; this.updateTextDisplay(); }

  // ── Show / hide ───────────────────────────────────────────────────────────
  showKeyboard() {
    this.visible = true;
    this.updateLayout();
    this._showAllObjects();
    this.textZoneBg.setVisible(true);
    this.textDisplay.setVisible(true);
    this.clearText();
  }

  hideKeyboard() {
    this.visible = false;
    this.hideAccentMenu();
    this._hideAllObjects();
    this.textZoneBg.setVisible(false);
    this.textDisplay.setVisible(false);
  }

  setVisible(v) { if (v) this.showKeyboard(); else this.hideKeyboard(); }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  destroy() {
    this.myScene.scale.off('resize', this.updateLayout, this);
    this.myScene.tweens.killAll();
    this.hideAccentMenu();
    if (this.longPressTimer) this.longPressTimer.destroy();
    this._destroyControlRow();
    this._destroyLetterKeys();
    if (this.bgPanel?.active)     this.bgPanel.destroy();
    if (this.textDisplay?.active) this.textDisplay.destroy();
    if (this.textZoneBg?.active)  this.textZoneBg.destroy();
  }
}

export default Easca3;

