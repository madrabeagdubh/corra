// js/game/ui/inventory/ItemDetailPanel.js
import { GameSettings } from '../../settings/gameSettings.js';

export default class ItemDetailPanel {
  constructor(scene, { x, y, width, height, onAction }) {
    this.scene = scene;
    this.onAction = onAction;
    this.width = width;
    this.height = height;

    // 1. Root container
    this.container = scene.add.container(x, y)
      .setDepth(2000)
      .setScrollFactor(0)
      .setVisible(false);

    // 2. Background
    this.bg = scene.add.rectangle(0, 0, width, height, 0x2a1810, 0.95)
      .setStrokeStyle(3, 0x888888);
    this.container.add(this.bg);

    // 3. Layout Constants
    const titleY = -height / 2 + 30;
    this.textAreaTop = titleY + 85;
    this.textAreaHeight = height - 190;
    this.textAreaWidth = width - 60;
    
    // 4. Header
    this.nameTextGa = scene.add.text(0, titleY, '', { 
        fontSize: '24px', color: '#ffffff', fontStyle: 'bold' 
    }).setOrigin(0.5, 0);
    this.nameTextEn = scene.add.text(0, titleY + 35, '', { 
        fontSize: '18px', color: '#00ff00' 
    }).setOrigin(0.5, 0);
    this.container.add([this.nameTextGa, this.nameTextEn]);

    // 5. Array to track our dynamic lines
    this.textLines = [];
    
    this.setupScrolling();
    this.createButtons();
  }

  show(item, slotInfo) {
    if (!item) return this.hide();
    this.currentItem = item;
    this.currentSlot = slotInfo;

    // Set Header
    this.nameTextGa.setText(item.nameGa || 'Gan ainm');
    this.nameTextEn.setText(item.nameEn || 'Unknown');

    // 1. DESTROY old lines
    this.textLines.forEach(entry => entry.text.destroy());
    this.textLines = [];

    // 2. Data Check: Ensure we have strings to work with
    const rawGa = item.descGa || "Gan cur síos ar fáil.";
    const rawEn = item.descEn || "No description available.";

    // 3. Split by newline
    const gaParts = rawGa.split('\n');
    const enParts = rawEn.split('\n');
    const maxLines = Math.max(gaParts.length, enParts.length);
    const textX = -this.textAreaWidth / 2;

    // 4. CREATE lines
    for (let i = 0; i < maxLines; i++) {
      if (gaParts[i]) {
        const tGa = this.scene.add.text(textX, 0, gaParts[i], {
          fontSize: '16px', color: '#ffffff', wordWrap: { width: this.textAreaWidth }
        }).setOrigin(0, 0);
        this.container.add(tGa);
        this.textLines.push({ text: tGa, type: 'ga' });
      }

      if (enParts[i]) {
        const tEn = this.scene.add.text(textX, 0, enParts[i], {
          fontSize: '15px', color: '#00ff00', fontStyle: 'italic', wordWrap: { width: this.textAreaWidth }
        }).setOrigin(0, 0);
        this.container.add(tEn);
        this.textLines.push({ text: tEn, type: 'en' });
      }
    }

    // 5. Initial Visibility
    this.scrollY = 0;
    this.updateLanguageOpacity();
    this.container.setVisible(true);

    // 6. POSITIONING (Delayed slightly for word-wrap calculation)
    this.scene.time.delayedCall(20, () => {
        this.updateTextPositions();
    });
  }

  updateTextPositions() {
    let currentY = this.textAreaTop + this.scrollY;
    const interLineSpacing = 4; // Space between Ga and its En
    const pairSpacing = 16;      // Space between pairs

    this.textLines.forEach((entry, index) => {
      entry.text.y = currentY;
      
      const isNextLineEn = (this.textLines[index+1] && this.textLines[index+1].type === 'en');
      currentY += entry.text.displayHeight + (isNextLineEn ? interLineSpacing : pairSpacing);
    });

    const totalHeight = currentY - (this.textAreaTop + this.scrollY);
    this.maxScrollY = Math.max(0, totalHeight - this.textAreaHeight);
  }

  updateLanguageOpacity() {
    const enAlpha = GameSettings.englishOpacity;
    this.nameTextEn.setAlpha(enAlpha);
    
    this.textLines.forEach(entry => {
      if (entry.type === 'en') {
        entry.text.setAlpha(enAlpha);
      } else {
        entry.text.setAlpha(1); // Irish is always visible
      }
    });

    if (this.buttons) {
      this.buttons.forEach(b => {
        b.textEn.setAlpha(enAlpha);
        b.textGa.setAlpha(1 - enAlpha);
      });
    }
  }

  setupScrolling() {
    this.scrollY = 0;
    this.isDragging = false;
    // Transparent hit area for mouse/touch
    const hitArea = this.scene.add.rectangle(0, this.textAreaTop + this.textAreaHeight/2, this.textAreaWidth, this.textAreaHeight, 0, 0).setInteractive();
    this.container.add(hitArea);

    hitArea.on('pointerdown', p => { this.isDragging = true; this.lastPointerY = p.y; });
    this.scene.input.on('pointermove', p => {
      if (!this.isDragging || !this.container.visible) return;
      const delta = p.y - this.lastPointerY;
      this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, -this.maxScrollY, 0);
      this.updateTextPositions();
      this.lastPointerY = p.y;
    });
    this.scene.input.on('pointerup', () => this.isDragging = false);
  }

  createButtons() {
    const buttonY = this.height / 2 - 50;
    const configs = [
        {a: 'equip', en: 'Equip', ga: 'Feisteáil', x: -100},
        {a: 'drop', en: 'Drop', ga: 'Scaoil', x: 0},
        {a: 'close', en: 'Close', ga: 'Siar', x: 100}
    ];

    this.buttons = configs.map(l => {
      const btnCont = this.scene.add.container(l.x, buttonY);
      const bg = this.scene.add.rectangle(0, 0, 90, 40, 0x4a3020).setStrokeStyle(2, 0x888888).setInteractive();
      const tGa = this.scene.add.text(0, 0, l.ga, { fontSize: '14px' }).setOrigin(0.5);
      const tEn = this.scene.add.text(0, 0, l.en, { fontSize: '14px' }).setOrigin(0.5);
      
      btnCont.add([bg, tGa, tEn]);
      this.container.add(btnCont);

      bg.on('pointerdown', () => {
        if (l.a === 'close') this.hide();
        else this.onAction?.(l.a, this.currentItem, this.currentSlot);
      });

      return { textEn: tEn, textGa: tGa };
    });
  }

  hide() { 
    this.container.setVisible(false); 
    this.isDragging = false;
  }
}
