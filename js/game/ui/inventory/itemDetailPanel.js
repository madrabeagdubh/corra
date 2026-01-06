// inventory/ItemDetailPanel.js
export default class ItemDetailPanel {
  constructor(scene, { x, y, width, height, onAction }) {
    this.scene = scene;
    this.onAction = onAction;
    this.currentItem = null;
    this.currentSlot = null;

    // Container for the whole panel
    this.container = scene.add.container(x, y)
      .setDepth(1903)
      .setScrollFactor(0)
      .setVisible(false);

    // Background
    this.bg = scene.add.rectangle(0, 0, width, height, 0x444444)
      .setStrokeStyle(2, 0xffffff);
    this.container.add(this.bg);

    // Item name (English)
    this.nameText = scene.add.text(0, -height / 2 + 20, '', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5, 0);
    this.container.add(this.nameText);

    // Item name (Irish)
    this.nameGaText = scene.add.text(0, -height / 2 + 45, '', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaaaaa',
      fontStyle: 'italic',
      align: 'center'
    }).setOrigin(0.5, 0);
    this.container.add(this.nameGaText);

    // Description (English)
    this.descText = scene.add.text(0, -height / 2 + 75, '', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: width - 40 }
    }).setOrigin(0.5, 0);
    this.container.add(this.descText);

    // Description (Irish)
    this.descGaText = scene.add.text(0, -height / 2 + 110, '', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#999999',
      align: 'center',
      wordWrap: { width: width - 40 },
      fontStyle: 'italic'
    }).setOrigin(0.5, 0);
    this.container.add(this.descGaText);

    // Action buttons
    this.buttons = [];
    this.createButtons(width, height);
  }

  createButtons(width, height) {
    const buttonWidth = width * 0.28;
    const buttonHeight = 35;
    const buttonY = height / 2 - 50;
    const spacing = buttonWidth + 10;

    // Button configs: [action, label, x-offset]
    const buttonConfigs = [
      ['equip', 'Equip', -spacing],
      ['drop', 'Drop', 0],
      ['throw', 'Throw', spacing]
    ];

    buttonConfigs.forEach(([action, label, xOffset]) => {
      const btn = this.createButton(xOffset, buttonY, buttonWidth, buttonHeight, label, action);
      this.buttons.push(btn);
    });
  }

  createButton(x, y, width, height, label, action) {
    const btnContainer = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, width, height, 0x666666)
      .setStrokeStyle(2, 0x999999)
      .setInteractive({ useHandCursor: true });

    const text = this.scene.add.text(0, 0, label, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    btnContainer.add([bg, text]);
    this.container.add(btnContainer);

    // Hover effects
    bg.on('pointerover', () => {
      bg.setFillStyle(0x888888);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x666666);
    });

    bg.on('pointerup', () => {
      if (this.onAction && this.currentItem && this.currentSlot !== null) {
        this.onAction(action, this.currentItem, this.currentSlot);
      }
    });

    return { container: btnContainer, bg, text, action };
  }

  show(item, slotInfo) {
    this.currentItem = item;
    this.currentSlot = slotInfo;

    if (!item) {
      this.hide();
      return;
    }

    // Update text content
    this.nameText.setText(item.nameEn || 'Unknown Item');
    this.nameGaText.setText(item.nameGa || '');
    this.descText.setText(item.descEn || '');
    this.descGaText.setText(item.descGa || '');

    // Show/hide buttons based on item and slot
    this.updateButtonVisibility(item, slotInfo);

    this.container.setVisible(true);
  }

  updateButtonVisibility(item, slotInfo) {
    // Equip button: only show if item is equippable and in inventory (not already equipped)
    const equipBtn = this.buttons.find(b => b.action === 'equip');
    if (equipBtn) {
      const canEquip = item.equipSlot && !slotInfo.isEquipSlot;
      equipBtn.container.setVisible(canEquip);
    }

    // Drop/Throw always available (you can implement logic later)
    // For now, show all
  }

  hide() {
    this.container.setVisible(false);
    this.currentItem = null;
    this.currentSlot = null;
  }

  destroy() {
    this.container.destroy(true);
  }
}
