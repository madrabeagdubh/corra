import { GameSettings } from '../../settings/gameSettings.js';
import { FONTS, COLORS } from '../../systems/gameTypography.js';

export default class ButtonBar {
  constructor(scene, { width, onAction }) {
    this.scene = scene;
    this.width = width;
    this.onAction = onAction;
    this.container = scene.add.container(0, 0);
    this.buttons = [];
    this.absoluteButtons = [];
  }

  refresh(actions, isEquipped) {
    // Clean up old absolute buttons
    this.absoluteButtons.forEach(el => el.destroy());
    this.absoluteButtons = [];
    this.buttons = [];
    this.container.removeAll(true);

    const labelMap = {
      equip:   { ga: 'Feisteail', en: 'Equip'   },
      unequip: { ga: 'Difheistiu', en: 'Unequip' },
      drop:    { ga: 'Scaoil',    en: 'Drop'    },
      throw:   { ga: 'Caith',     en: 'Throw'   },
      drink:   { ga: 'Ol',        en: 'Drink'   }
    };

    let finalActions = actions.map(a => (isEquipped && a === 'equip') ? 'unequip' : a);

    const spacing = 100;
    let currentX = -((finalActions.length - 1) * spacing) / 2;

    finalActions.forEach((actionKey) => {
      const labels = labelMap[actionKey] || { ga: actionKey, en: actionKey };
      const btnObj = this.createButton(currentX, actionKey, labels);
      this.buttons.push(btnObj);
      currentX += spacing;
    });

    this.updateOpacity();
  }

  createButton(localX, actionKey, labels) {
    // Keep all elements inside the container so they hide with it automatically
    const bg = this.scene.add.rectangle(localX, 0, 92, 40, 0x2a1810)
      .setStrokeStyle(2, 0xd4af37)
      .setDepth(3100)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true, priorityID: 99999 });
    this.container.add(bg);

    const tGa = this.scene.add.text(localX, 0, labels.ga, {
      fontSize: '15px',
      fontFamily: FONTS.irish,
      color: COLORS.irish,
    }).setOrigin(0.5).setDepth(3101).setScrollFactor(0);
    this.container.add(tGa);

    const tEn = this.scene.add.text(localX, 0, labels.en, {
      fontSize: '13px',
      fontFamily: FONTS.english,
      color: COLORS.english,
    }).setOrigin(0.5).setDepth(3101).setScrollFactor(0);
    this.container.add(tEn);

    // Still track for opacity updates and destroy
    this.absoluteButtons.push(bg, tGa, tEn);

    bg.on('pointerdown', (pointer, lx, ly, event) => {
      if (event) event.stopPropagation();
      bg.setFillStyle(0x4a2820);
      this.scene.time.delayedCall(100, () => {
        if (bg && bg.active) bg.setFillStyle(0x2a1810);
      });
      this.onAction(actionKey);
    });

    return { bg, textGa: tGa, textEn: tEn, localX };
  }

  updatePositions() {
    // Elements are in the container — no manual positioning needed.
    // Just apply language visibility.
    this.updateOpacity();
  }

  hide() {
    // Container visibility is controlled by itemDetailPanel.container.
    // This is a no-op now but kept for API compatibility.
  }

  updateOpacity() {
    // Buttons are binary: show Irish OR English at full opacity.
    // Threshold at 0.5 — above shows English, below shows Irish.
    const useEn = GameSettings.englishOpacity >= 0.5;

    this.buttons.forEach(btn => {
      if (btn.textGa && btn.textGa.active) {
        btn.textGa.setVisible(!useEn).setAlpha(1);
      }
      if (btn.textEn && btn.textEn.active) {
        btn.textEn.setVisible(useEn).setAlpha(1);
      }
    });
  }

  destroy() {
    this.container.destroy();
    this.absoluteButtons.forEach(el => { if (el && el.active) el.destroy(); });
    this.absoluteButtons = [];
  }
}
 
