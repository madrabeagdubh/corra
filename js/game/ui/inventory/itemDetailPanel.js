import { FONTS, COLORS, TYPE, SPACING } from '../../systems/gameTypography.js';
import { GameSettings } from '../../settings/gameSettings.js';
import ButtonBar from './buttonBar.js';

export default class ItemDetailPanel {
  constructor(scene, { x, y, width, height, onAction }) {
    this.scene = scene;
    this.onAction = onAction;
    this.width = width;
    this.height = height;

    /* ---------------- BLOCKER ---------------- */
    this.blocker = scene.add.rectangle(
      scene.cameras.main.centerX,
      scene.cameras.main.centerY,
      scene.cameras.main.width,
      scene.cameras.main.height,
      0x000000,
      0.5
    )
      .setDepth(2500)
      .setScrollFactor(0)
      .setVisible(false)
      .setInteractive({ priorityID: 100 });

    ['pointerdown', 'pointermove', 'pointerup'].forEach(evt => {
      this.blocker.on(evt, (_, __, ___, e) => e?.stopPropagation());
    });

    /* ---------------- CONTAINER ---------------- */
    this.container = scene.add.container(x, y)
      .setDepth(3000)
      .setScrollFactor(0)
      .setVisible(false);

    this.bg = scene.add.rectangle(0, 0, width + 40, height + 200, 0x080f08, 1.0)
      .setStrokeStyle(3, 0x888888)
      .setDepth(3001)
      .setInteractive({ priorityID: 2000 });

    this.bg.on('pointerdown', (_, __, ___, e) => e?.stopPropagation());
    this.container.add(this.bg);

    /* ---------------- ITEM IMAGE & TITLE ---------------- */
    const imageY = -height / 2 + 50;
    this.itemImage = scene.add.image(0, imageY, '')
      .setOrigin(0.5)
      .setDisplaySize(64, 64)
      .setDepth(3002)
      .setVisible(false);
    this.container.add(this.itemImage);

    const titleY = -height / 2 + 120;

    // Irish title: TYPE.heading
    this.nameTextGa = scene.add.text(0, titleY, '', {
      fontSize:   TYPE.heading.size,
      color:      COLORS.irish,
      fontFamily: FONTS.irish,
    }).setOrigin(0.5, 0).setDepth(3002);

    // English title: TYPE.bodyEn -- was hardcoded '16px', now matches type scale
    this.nameTextEn = scene.add.text(0, titleY + 38, '', {
      fontSize:   TYPE.bodyEn.size,
      color:      COLORS.english,
      fontFamily: FONTS.english,
    }).setOrigin(0.5, 0).setDepth(3002);

    this.container.add([this.nameTextGa, this.nameTextEn]);

    /* ---------------- TEXT LAYOUT ---------------- */
    this.textAreaTop    = titleY + 95;
    this.textAreaHeight = height - 290;
    this.textAreaWidth  = width - 60;
    this.textAreaBottom = this.textAreaTop + this.textAreaHeight;

    this.textLines   = [];
    this.scrollY     = 0;
    this.velocity    = 0;
    this.isScrolling = false;

    /* ---------------- SCROLL INDICATORS ---------------- */
    this.scrollTrack = scene.add.rectangle(
      this.width/2 - 15,
      this.textAreaTop + this.textAreaHeight/2,
      4,
      this.textAreaHeight,
      0x444444
    ).setDepth(3002);

    this.scrollHandle = scene.add.rectangle(
      this.width/2 - 15,
      this.textAreaTop,
      8,
      30,
      0x888888
    ).setDepth(3003);

    this.container.add([this.scrollTrack, this.scrollHandle]);

    /* ---------------- SCROLL HIT AREA ---------------- */
    this.hitArea = scene.add.rectangle(
      0,
      this.textAreaTop + this.textAreaHeight / 2,
      this.textAreaWidth,
      this.textAreaHeight - 80,
      0xffffff,
      0.001
    )
      .setDepth(3010)
      .setScrollFactor(0)
      .setInteractive({ priorityID: 5000 });

    this.container.add(this.hitArea);

    this.hitArea.on('pointerdown', (pointer, _, __, e) => {
      if (pointer._downOnButton) return;
      e?.stopPropagation();
      this.isScrolling  = true;
      this.velocity     = 0;
      this.lastPointerY = pointer.y;
      this.lastMoveTime = scene.time.now;
    });

    this.hitArea.on('pointermove', (pointer) => {
      if (!this.isScrolling) return;
      const delta = pointer.y - this.lastPointerY;
      this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, -this.maxScrollY, 0);
      this.updateTextPositions();
      this.lastPointerY = pointer.y;
      const now = this.scene.time.now;
      const dt  = now - this.lastMoveTime;
      if (dt > 0) { this.velocity = delta / dt * 16; this.lastMoveTime = now; }
    });

    this.hitArea.on('pointerup', () => { this.isScrolling = false; });

    this.scene.events.on('update', () => {
      if (!this.container || !this.container.visible || this.isScrolling) return;
      if (Math.abs(this.velocity) > 0.1) {
        this.scrollY = Phaser.Math.Clamp(this.scrollY + this.velocity, -this.maxScrollY, 0);
        this.updateTextPositions();
        this.velocity *= 0.95;
      }
    });

    /* ---------------- BUTTON BAR ---------------- */
    this.buttonBar = new ButtonBar(scene, {
      width: width,
      onAction: (actionKey) => {
        this.onAction?.(actionKey, this.currentItem, this.currentSlot);
      }
    });
    this.buttonBar.container.y = 99999;  // hidden -- DOM buttons used instead
    this.buttonBar.container.setDepth(3100);
    this.container.add(this.buttonBar.container);
  }

  /* ================= SHOW ================= */
  _createDomButtons(actions, isEquipped) {
    this._destroyDomButtons()
    const labelMap = {
      equip:   { ga: 'Feisteáil',   en: 'Equip'   },
      unequip: { ga: 'Difheistigh', en: 'Unequip'  },
      drop:    { ga: 'Scaoil',      en: 'Drop'     },
      throw:   { ga: 'Caith',       en: 'Throw'    },
      drink:   { ga: 'Ól',          en: 'Drink'    },
    }
    const finalActions = actions.map(a => (isEquipped && a === 'equip') ? 'unequip' : a)
    if (!finalActions.length) return

    const moonEl   = document.getElementById('dpad-moon-hub')
    const moonRect = moonEl?.getBoundingClientRect()
    const moonCX   = moonRect ? moonRect.left + moonRect.width  / 2 : window.innerWidth  / 2
    const moonCY   = moonRect ? moonRect.top  + moonRect.height / 2 : window.innerHeight - 80
    const moonR    = moonRect ? moonRect.width / 2 + 12 : 62  // +12 gap from moon edge
    const btnW     = Math.min(110, moonCX - moonR - 8)
    const btnH     = 44
    const gap      = 6

    // Split: left column and right column
    const mid   = Math.ceil(finalActions.length / 2)
    const left  = finalActions.slice(0, mid)
    const right = finalActions.slice(mid)

    // Left column: right-aligned to moon left edge, centred vertically on moon
    const totalLeftH  = left.length  * btnH + (left.length  - 1) * gap
    const totalRightH = right.length * btnH + (right.length - 1) * gap
    const leftStartY  = moonCY - totalLeftH  / 2
    const rightStartY = moonCY - totalRightH / 2
    const leftX       = moonCX - moonR - btnW
    const rightX      = moonCX + moonR

    left.forEach((actionKey, i) => {
      const labels = labelMap[actionKey] || { ga: actionKey, en: actionKey }
      this._makeDomBtn(labels, actionKey, leftX, leftStartY + i * (btnH + gap), btnW, btnH)
    })
    right.forEach((actionKey, i) => {
      const labels = labelMap[actionKey] || { ga: actionKey, en: actionKey }
      this._makeDomBtn(labels, actionKey, rightX, rightStartY + i * (btnH + gap), btnW, btnH)
    })
  }

  _makeDomBtn(labels, actionKey, x, y, w, h) {
    const btn = document.createElement('button')
    btn.dataset.ga = labels.ga
    btn.dataset.en = labels.en

    const op = typeof GameSettings !== 'undefined' ? (GameSettings.englishOpacity ?? 0.5) : 0.5
    const isEn = op >= 0.5
    const font = isEn
      ? '"Courier New", monospace'
      : 'Urchlo, serif'
    btn.textContent = isEn ? labels.en : labels.ga

    btn.style.cssText = [
      'position:fixed;',
      `left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;`,
      `width:${w.toFixed(1)}px;height:${h}px;`,
      'background:rgba(30,15,5,0.92);',
      'border:1.5px solid rgba(212,175,55,0.8);',
      'border-radius:6px;',
      'color:#d4af37;',
      `font-size:18px;font-family:${font};`,
      'cursor:pointer;z-index:4000;',
      'display:flex;align-items:center;justify-content:center;',
      'padding:2px 6px;text-align:center;',
      'touch-action:none;',
    ].join('')

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      window._lastDomButtonTap = Date.now()
      this._destroyDomButtons()
      this.onAction?.(actionKey, this._currentItem, this._currentSlot)
    })

    // Live language update
    btn._langHandler = () => {
      const newOp = typeof GameSettings !== 'undefined' ? (GameSettings.englishOpacity ?? 0.5) : 0.5
      const newEn = newOp >= 0.5
      btn.textContent  = newEn ? btn.dataset.en : btn.dataset.ga
      btn.style.fontFamily = newEn ? '"Courier New", monospace' : 'Urchlo, serif'
    }
    window.addEventListener('englishOpacityChange', btn._langHandler)

    document.body.appendChild(btn)
    this._domBtns = this._domBtns || []
    this._domBtns.push(btn)
  }

  _destroyDomButtons() {
    if (this._domBtns) {
      this._domBtns.forEach(b => {
        if (b._langHandler) window.removeEventListener('englishOpacityChange', b._langHandler)
        b.parentNode?.removeChild(b)
      })
      this._domBtns = []
    }
  }

  show(item, slotInfo) {
    if (!item) return this.hide();

    this.currentItem = item;
    this.currentSlot = slotInfo;
    this.blocker.setVisible(true);
    this.container.setVisible(true);
    this.hitArea.setVisible(true);

    if (item.spriteKey) {
      this.itemImage.setTexture(item.spriteKey).setVisible(true);
    } else {
      this.itemImage.setVisible(false);
    }

    this.nameTextGa.setText(item.nameGa || 'Gan ainm');
    this.nameTextEn.setText(item.nameEn || 'Unknown');

    // Clean up old text lines
    this.textLines.forEach(entry => entry.text.destroy());
    this.textLines = [];

    const gaParts  = (item.descGa || '').split('\n');
    const enParts  = (item.descEn || '').split('\n');
    const maxLines = Math.max(gaParts.length, enParts.length);

    for (let i = 0; i < maxLines; i++) {
      [
        { t: gaParts[i], type: 'ga' },
        { t: enParts[i], type: 'en' },
      ].forEach(cfg => {
        if (!cfg.t) return;

        const isEn  = cfg.type === 'en';
        const txt   = this.scene.add.text(
          -this.textAreaWidth / 2,
          0,
          cfg.t,
          {
            // Irish body: TYPE.body; English body: TYPE.bodyEn (was hardcoded '16px')
            fontSize:   isEn ? TYPE.bodyEn.size : TYPE.body.size,
            fontFamily: isEn ? FONTS.english : FONTS.irish,
            fontStyle:  isEn ? 'italic' : 'normal',
            color:      isEn ? COLORS.english : COLORS.irish,
            wordWrap:   { width: this.textAreaWidth - 25 },
          }
        )
          .setOrigin(0, 0)
          .setDepth(3005);

        this.container.add(txt);
        this.textLines.push({ text: txt, type: cfg.type });
      });
    }

    this.buttonBar.refresh(item.actions || [], slotInfo.isEquipSlot);
    this._currentItem = item;
    this._currentSlot = slotInfo;
    this._createDomButtons(item.actions || [], slotInfo.isEquipSlot);
    this.buttonBar.updatePositions();

    this.scrollY  = 0;
    this.velocity = 0;
    this.updateLanguageOpacity();

    this.scene.time.delayedCall(50, () => this.updateTextPositions());
  }

  /* ================= MASK + SCROLL ================= */
  updateTextPositions() {
    let currentY = this.textAreaTop + this.scrollY;
    let totalH   = 0;

    this.textLines.forEach((entry, index) => {
      const t    = entry.text;
      t.y        = currentY;

      const cropY      = Math.max(0, this.textAreaTop - t.y);
      const cropHeight = Math.min(t.height, this.textAreaBottom - t.y) - cropY;
      t.setCrop(0, cropY, t.width, cropHeight <= 0 ? 0 : cropHeight);

      const isNextEn = this.textLines[index + 1]?.type === 'en';
      const step     = t.height + (isNextEn ? 4 : 22);
      currentY      += step;
      totalH        += step;
    });

    this.maxScrollY = Math.max(0, totalH - this.textAreaHeight);

    if (this.maxScrollY > 0) {
      this.scrollHandle
        .setVisible(true)
        .setY(this.textAreaTop + (Math.abs(this.scrollY) / this.maxScrollY * (this.textAreaHeight - 30)) + 15);
      this.scrollTrack.setVisible(true);
    } else {
      this.scrollHandle.setVisible(false);
      this.scrollTrack.setVisible(false);
    }
  }

  /* ================= LANGUAGE OPACITY ================= */
  updateLanguageOpacity() {
    const opacity = GameSettings.englishOpacity;
    this.textLines.forEach(entry => {
      entry.text.setAlpha(entry.type === 'en' ? opacity : 1);
      entry.text.setVisible(entry.type === 'ga' || opacity > 0.05);
    });
    if (this.nameTextEn) {
      this.nameTextEn.setAlpha(opacity);
      this.nameTextEn.setVisible(opacity > 0.05);
    }
    this.buttonBar?.updateOpacity();
  }

  /* ================= HIDE ================= */
  hide() {
    this.blocker.setVisible(false);
    this._destroyDomButtons();
    this.container.setVisible(false);
    this.hitArea.setVisible(false);
    this.buttonBar.hide();
    this.isScrolling = false;
  }

  get isVisible() {
    return this.container.visible;
  }
}

