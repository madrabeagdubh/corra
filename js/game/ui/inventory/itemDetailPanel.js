// js/game/ui/inventory/ItemDetailPanel.js
import { GameSettings } from '../../settings/gameSettings.js';

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

    const topY = -height / 2 + 20;

    // ─────────────────────────
    // ITEM NAME
    // ─────────────────────────

    // Irish name (primary)
    this.nameTextGa = scene.add.text(0, topY, '', {
      fontSize: '18px',
      fontFamily: 'urchlo',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center'
    })
      .setOrigin(0.5, 0)
      .setAlpha(1);
    this.container.add(this.nameTextGa);

    // English name (secondary, fades)
    this.nameTextEn = scene.add.text(0, topY + 22, '', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#dddddd',
      fontStyle: 'bold',
      align: 'center'
    })
      .setOrigin(0.5, 0)
      .setAlpha(GameSettings.englishOpacity);
    this.container.add(this.nameTextEn);

    // ─────────────────────────
    // DESCRIPTION
    // ─────────────────────────

    const descY = topY + 50;

    // Irish description
    this.descTextGa = scene.add.text(0, descY, '', {
      fontSize: '12px',
      fontFamily: 'urchlo',
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: width - 40 }
    })
      .setOrigin(0.5, 0)
      .setAlpha(1);
    this.container.add(this.descTextGa);

    // English description (below Irish, fades)
    this.descTextEn = scene.add.text(0, descY + 36, '', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#bbbbbb',
      align: 'center',
      wordWrap: { width: width - 40 }
    })
      .setOrigin(0.5, 0)
      .setAlpha(GameSettings.englishOpacity);
    this.container.add(this.descTextEn);

    // Action buttons
    this.buttons = [];
    this.createButtons(width, height);
  }

  createButtons(width, height) {
    const buttonWidth = width * 0.28;
    const buttonHeight = 35;
    const buttonY = height / 2 - 50;
    const spacing = buttonWidth + 10;

    const buttonConfigs = [
      ['equip', 'Use', 'Úsáid', -spacing],
      ['drop', 'Drop', 'Scaoil', 0],
      ['throw', 'Throw', 'Caith', spacing]
    ];

    buttonConfigs.forEach(([action, labelEn, labelGa, xOffset]) => {
      const btn = this.createButton(
        xOffset,
        buttonY,
        buttonWidth,
        buttonHeight,
        labelEn,
        labelGa,
        action
      );
      this.buttons.push(btn);
    });
  }

  createButton(x, y, width, height, labelEn, labelGa, action) {
    const btnContainer = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, width, height, 0x666666)
      .setStrokeStyle(2, 0x999999)
      .setInteractive({ useHandCursor: true });

    // English label (fades)
    const textEn = this.scene.add.text(0, 0, labelEn, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)
      .setAlpha(GameSettings.englishOpacity);

    // Irish label (inverse fade)
    const textGa = this.scene.add.text(0, 0, labelGa, {
      fontSize: '14px',
      fontFamily: 'Urchlo',
      color: '#ffffff',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)
      .setAlpha(1 - GameSettings.englishOpacity);

    btnContainer.add([bg, textEn, textGa]);
    this.container.add(btnContainer);

    bg.on('pointerover', () => bg.setFillStyle(0x888888));
    bg.on('pointerout', () => bg.setFillStyle(0x666666));

    bg.on('pointerup', () => {
      if (this.onAction && this.currentItem && this.currentSlot !== null) {
        this.onAction(action, this.currentItem, this.currentSlot);
      }
    });

    return { container: btnContainer, bg, textEn, textGa, action };
  }

  show(item, slotInfo) {
    this.currentItem = item;
    this.currentSlot = slotInfo;

    if (!item) {
      this.hide();
      return;
    }

    this.nameTextGa.setText(item.nameGa || '');
    this.nameTextEn.setText(item.nameEn || '');
    this.descTextGa.setText(item.descGa || '');
    this.descTextEn.setText(item.descEn || '');

    this.updateLanguageOpacity();
    this.updateButtonVisibility(item, slotInfo);

    this.container.setVisible(true);
  }

  updateLanguageOpacity() {
    const enOpacity = GameSettings.englishOpacity;

    // Item text
    this.nameTextEn.setAlpha(enOpacity);
    this.descTextEn.setAlpha(enOpacity);
    this.nameTextGa.setAlpha(1);
    this.descTextGa.setAlpha(1);

    // Buttons crossfade
    const gaOpacity = 1 - enOpacity;
    this.buttons.forEach(btn => {
      btn.textEn.setAlpha(enOpacity);
      btn.textGa.setAlpha(gaOpacity);
    });
  }

  updateButtonVisibility(item, slotInfo) {
    const equipBtn = this.buttons.find(b => b.action === 'equip');
    if (equipBtn) {
      const canEquip = item.equipSlot && !slotInfo.isEquipSlot;
      equipBtn.container.setVisible(canEquip);
    }
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
