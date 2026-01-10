import { GameSettings } from '../../settings/gameSettings.js';

export default class ItemDetailPanel {
  constructor(scene, { x, y, width, height, onAction }) {
    this.scene = scene;
    this.onAction = onAction;
    this.width = width;
    this.height = height;

    // 1. SHIELD
    this.blocker = scene.add.rectangle(scene.cameras.main.centerX, scene.cameras.main.centerY, scene.cameras.main.width, scene.cameras.main.height, 0x000000, 0.5)
      .setDepth(2500).setScrollFactor(0).setInteractive().setVisible(false);

    // 2. ROOT CONTAINER
    this.container = scene.add.container(x, y).setDepth(3000).setScrollFactor(0).setVisible(false);

    // 3. PANEL BACKGROUND
    this.bg = scene.add.rectangle(0, 0, width, height, 0x2a1810, 0.98).setStrokeStyle(3, 0x888888);
    this.container.add(this.bg);

    // 4. ITEM IMAGE
    const imageY = -height / 2 + 50;
    this.itemImage = scene.add.image(0, imageY, '').setOrigin(0.5).setDisplaySize(64, 64).setVisible(false);
    this.container.add(this.itemImage);

    // 5. TEXT AREA BOUNDS
    const titleY = -height / 2 + 120;
    this.textAreaTop = titleY + 85;
    this.textAreaHeight = height - 280;
    this.textAreaWidth = width - 60;
    this.textAreaBottom = this.textAreaTop + this.textAreaHeight;

    this.nameTextGa = scene.add.text(0, titleY, '', { 
      fontSize: '28px', 
      color: '#ffffff', 
      fontFamily: 'Aonchlo' 
    }).setOrigin(0.5, 0);

    this.nameTextEn = scene.add.text(0, titleY + 35, '', { 
      fontSize: '18px', 
      color: '#00ff00',
      fontStyle: 'italic'
    }).setOrigin(0.5, 0);
    
    this.container.add([this.nameTextGa, this.nameTextEn]);

    // 6. SCROLLBAR
    this.scrollTrack = scene.add.rectangle(this.width/2 - 15, this.textAreaTop + this.textAreaHeight/2, 4, this.textAreaHeight, 0x444444);
    this.scrollHandle = scene.add.rectangle(this.width/2 - 15, this.textAreaTop, 8, 30, 0x888888);
    this.container.add([this.scrollTrack, this.scrollHandle]);

    this.textLines = [];
    this.isScrolling = false;
    this.velocity = 0;
    this.scrollY = 0;

    this.setupScrolling();
    this.createButtons();
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
this.nameTextGa.setFontFamily('Aonchlo').updateText()
    this.textLines.forEach(entry => entry.text.destroy());
    this.textLines = [];

    const gaParts = (item.descGa || "").split('\n');
    const enParts = (item.descEn || "").split('\n');
    const maxLines = Math.max(gaParts.length, enParts.length);

    for (let i = 0; i < maxLines; i++) {
      [ {t: gaParts[i], c: '#ffffff', type: 'ga'},
        {t: enParts[i], c: '#00ff00', type: 'en'}
      ].forEach(cfg => {
        if (cfg.t) {
          const txt = this.scene.add.text(-this.textAreaWidth/2, 0, cfg.t, {
            fontSize: cfg.type === 'ga' ? '20px' : '16px',
            color: cfg.c,
            fontFamily: cfg.type === 'ga' ? 'Aonchlo' : 'Arial',
            fontStyle: cfg.type === 'en' ? 'italic' : 'normal',
            wordWrap: { width: this.textAreaWidth - 25 }
          }).setOrigin(0, 0).setDepth(1);
          
          this.container.add(txt);
          this.textLines.push({ text: txt, type: cfg.type });
        }
      });
    }

    this.scrollY = 0;
    this.velocity = 0;
    this.updateLanguageOpacity();
    this.scene.time.delayedCall(50, () => this.updateTextPositions());
  }

  updateTextPositions() {
    let currentY = this.textAreaTop + this.scrollY;
    let totalH = 0;

    this.textLines.forEach((entry, index) => {
      const t = entry.text;
      t.y = currentY;

      const cropY = Math.max(0, this.textAreaTop - t.y);
      const cropHeight = Math.min(t.height, this.textAreaBottom - t.y) - cropY;

      if (cropHeight <= 0) {
        t.setCrop(0, 0, 0, 0);
      } else {
        t.setCrop(0, cropY, t.width, cropHeight);
      }
      
      const isNextEn = (this.textLines[index+1] && this.textLines[index+1].type === 'en');
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

  setupScrolling() {
    const worldX = this.container.x;
    const worldY = this.container.y + this.textAreaTop + this.textAreaHeight/2;
    this.hitArea = this.scene.add.rectangle(worldX, worldY, this.textAreaWidth, this.textAreaHeight, 0xffffff, 0.001)
      .setDepth(3001).setScrollFactor(0).setInteractive().setVisible(false);

    this.hitArea.on('pointerdown', (pointer, lx, ly, event) => {
      if (event) event.stopPropagation();
      this.isScrolling = true;
      this.velocity = 0;
      this.lastPointerY = pointer.y;
      this.lastMoveTime = this.scene.time.now;
    });

    this.hitArea.on('pointermove', (pointer) => {
      if (!this.isScrolling) return;
      const delta = pointer.y - this.lastPointerY;
      this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, -this.maxScrollY, 0);
      this.updateTextPositions();
      this.lastPointerY = pointer.y;
    });

    this.hitArea.on('pointerup', () => { this.isScrolling = false; });
    this.scene.events.on('update', () => {
      if (!this.container.visible || this.isScrolling) return;
      if (Math.abs(this.velocity) > 0.1) {
        this.scrollY = Phaser.Math.Clamp(this.scrollY + this.velocity, -this.maxScrollY, 0);
        this.updateTextPositions();
        this.velocity *= 0.95;
      }
    });
  }

  createButtons() {
    const buttonY = this.height / 2 - 50;
    const configs = [
      {a:'equip', en:'Equip', ga:'Feisteáil', x:-100}, 
      {a:'drop', en:'Drop', ga:'Scaoil', x:0}, 
      {a:'close', en:'Close', ga:'Siar', x:100}
    ];
    
    this.buttons = configs.map(l => {
      const btnCont = this.scene.add.container(l.x, buttonY);
      const bbg = this.scene.add.rectangle(0,0,95,40,0x4a3020).setStrokeStyle(2,0x888888).setInteractive({ priorityID: 1000 });
      const tGa = this.scene.add.text(0,0,l.ga,{ fontSize:'18px', fontFamily: 'Aonchlo' }).setOrigin(0.5);
      const tEn = this.scene.add.text(0,0,l.en,{ fontSize:'14px' }).setOrigin(0.5);
      btnCont.add([bbg, tGa, tEn]);
      this.container.add(btnCont);
      bbg.on('pointerdown', () => {
        if (l.a === 'close') this.hide();
        else this.onAction?.(l.a, this.currentItem, this.currentSlot);
      });
      return { textEn: tEn, textGa: tGa };
    });
  }

  updateLanguageOpacity() {
    const enAlpha = GameSettings.englishOpacity;
    this.nameTextEn.setAlpha(enAlpha);
    this.textLines.forEach(entry => entry.text.setAlpha(entry.type === 'en' ? enAlpha : 1));
    this.buttons?.forEach(b => {
      b.textEn.setAlpha(enAlpha);
      b.textGa.setAlpha(1 - enAlpha);
    });
  }

  hide() {
    this.blocker.setVisible(false);
    this.container.setVisible(false);
    this.hitArea.setVisible(false);
    this.isScrolling = false;
  }

  get isVisible() {
    return this.container && this.container.visible;
  }
}
