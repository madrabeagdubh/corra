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

    // Absorb ALL pointer phases so bg never steals input
    ['pointerdown', 'pointermove', 'pointerup'].forEach(evt => {
      this.blocker.on(evt, (_, __, ___, e) => e?.stopPropagation());
    });

    /* ---------------- CONTAINER ---------------- */
    this.container = scene.add.container(x, y)
      .setDepth(3000)
      .setScrollFactor(0)
      .setVisible(false);

    this.bg = scene.add.rectangle(0, 0, width, height, 0x2a1810, 0.98)
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
    this.nameTextGa = scene.add.text(0, titleY, '', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Aonchlo'
    }).setOrigin(0.5, 0).setDepth(3002);

    this.nameTextEn = scene.add.text(0, titleY + 35, '', {
      fontSize: '18px',
      color: '#00ff00',
      fontStyle: 'italic'
    }).setOrigin(0.5, 0).setDepth(3002);

    this.container.add([this.nameTextGa, this.nameTextEn]);

    /* ---------------- TEXT LAYOUT ---------------- */
    this.textAreaTop = titleY + 85;
    this.textAreaHeight = height - 280;
    this.textAreaWidth = width - 60;
    this.textAreaBottom = this.textAreaTop + this.textAreaHeight;

    this.textLines = [];
    this.scrollY = 0;
    this.velocity = 0;
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

      this.isScrolling = true;
      this.velocity = 0;
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
      const dt = now - this.lastMoveTime;
      if (dt > 0) {
        this.velocity = delta / dt * 16;
        this.lastMoveTime = now;
      }
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
    this.buttonBar.container.y = (this.height / 2) - 50;
    this.buttonBar.container.setDepth(3100);
    this.container.add(this.buttonBar.container);
  }

  /* ================= SHOW ================= */
  show(item, slotInfo) {
    if (!item) return this.hide();
    
    this.currentItem = item;
    this.currentSlot = slotInfo;
    this.blocker.setVisible(true);
    this.container.setVisible(true);
    this.hitArea.setVisible(true);

    // Update item image
    if (item.spriteKey) {
      this.itemImage.setTexture(item.spriteKey).setVisible(true);
    } else {
      this.itemImage.setVisible(false);
    }

    // Update title texts
    this.nameTextGa.setText(item.nameGa || 'Gan ainm');
    this.nameTextEn.setText(item.nameEn || 'Unknown');

    // Clean up old text lines
    this.textLines.forEach(entry => entry.text.destroy());
    this.textLines = [];

    const gaParts = (item.descGa || '').split('\n');
    const enParts = (item.descEn || '').split('\n');
    const maxLines = Math.max(gaParts.length, enParts.length);

    for (let i = 0; i < maxLines; i++) {
      [
        { t: gaParts[i], type: 'ga' },
        { t: enParts[i], type: 'en' }
      ].forEach(cfg => {
        if (!cfg.t) return;

        const txt = this.scene.add.text(
          -this.textAreaWidth / 2,
          0,
          cfg.t,
          {
            fontSize: cfg.type === 'ga' ? '20px' : '16px',
            fontFamily: cfg.type === 'ga' ? 'Aonchlo' : 'Arial',
            fontStyle: cfg.type === 'en' ? 'italic' : 'normal',
            color: cfg.type === 'ga' ? '#ffffff' : '#00ff00',
            wordWrap: { width: this.textAreaWidth - 25 }
          }
        )
          .setOrigin(0, 0)
          .setDepth(3005);

        this.container.add(txt);
        this.textLines.push({ text: txt, type: cfg.type });
      });
    }

    this.buttonBar.refresh(item.actions || [], slotInfo.isEquipSlot);
    this.buttonBar.updatePositions();

    this.scrollY = 0;
    this.velocity = 0;
    this.updateLanguageOpacity();

    this.scene.time.delayedCall(50, () => this.updateTextPositions());
  }

  /* ================= MASK + SCROLL ================= */
  updateTextPositions() {
    let currentY = this.textAreaTop + this.scrollY;
    let totalH = 0;

    this.textLines.forEach((entry, index) => {
      const t = entry.text;
      t.y = currentY;

      // --- CROP MASKING ---
      const cropY = Math.max(0, this.textAreaTop - t.y);
      const cropHeight = Math.min(t.height, this.textAreaBottom - t.y) - cropY;

      t.setCrop(0, cropY, t.width, cropHeight <= 0 ? 0 : cropHeight);

      const isNextEn = this.textLines[index + 1]?.type === 'en';
      const step = t.height + (isNextEn ? 4 : 22);
      currentY += step;
      totalH += step;
    });

    this.maxScrollY = Math.max(0, totalH - this.textAreaHeight);

    if (this.maxScrollY > 0) {
      this.scrollHandle.setVisible(true).y = this.textAreaTop + (Math.abs(this.scrollY) / this.maxScrollY * (this.textAreaHeight - 30)) + 15;
      this.scrollTrack.setVisible(true);
    } else {
      this.scrollHandle.setVisible(false);
      this.scrollTrack.setVisible(false);
    }
  }

  /* ================= LANGUAGE OPACITY ================= */
  updateLanguageOpacity() {
    const enAlpha = GameSettings.englishOpacity;
    if (this.nameTextEn) this.nameTextEn.setAlpha(enAlpha);
    this.textLines.forEach(entry => {
      entry.text.setAlpha(entry.type === 'en' ? enAlpha : 1);
    });
    this.buttonBar?.updateOpacity();
  }

  /* ================= HIDE ================= */
  hide() {
    this.blocker.setVisible(false);
    this.container.setVisible(false);
    this.hitArea.setVisible(false);
    this.buttonBar.hide();
    this.isScrolling = false;
  }

  get isVisible() {
    return this.container.visible;
  }
}
