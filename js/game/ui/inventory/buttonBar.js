import { GameSettings } from '../../settings/gameSettings.js';

export default class ButtonBar {
  constructor(scene, { width, onAction }) {
    this.scene = scene;
    this.width = width;
    this.onAction = onAction;
    this.container = scene.add.container(0, 0);
    this.buttons = [];
    this.absoluteButtons = []; // Track elements added directly to scene
  }

  refresh(actions, isEquipped) {
    // Clean up old absolute buttons
    this.absoluteButtons.forEach(el => el.destroy());
    this.absoluteButtons = [];
    this.buttons = [];
    this.container.removeAll(true);

    const labelMap = {
      equip:   { ga: 'Feisteáil', en: 'Equip' },
      unequip: { ga: 'Dífheistiú', en: 'Unequip' },
      drop:    { ga: 'Scaoil',     en: 'Drop' },
      throw:   { ga: 'Caith',      en: 'Throw' },
      drink:   { ga: 'Ól',         en: 'Drink' }
    };

    // Replace 'equip' with 'unequip' if we are looking at an equipped item
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
    // We'll position these when updatePositions() is called
    const btnCont = this.scene.add.container(localX, 0);
    this.container.add(btnCont);

    // Create button background DIRECTLY in scene, not in any container
    const bg = this.scene.add.rectangle(0, 0, 92, 40, 0x4a3020)
      .setStrokeStyle(2, 0x888888)
      .setDepth(3100)
      .setScrollFactor(0)
      .setInteractive({
        useHandCursor: true,
        priorityID: 99999
      })
      .setVisible(false); // Start hidden

    const tGa = this.scene.add.text(0, -2, labels.ga, {
      fontSize: '16px',
      fontFamily: 'Aonchlo',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(3101).setScrollFactor(0).setVisible(false);

    const tEn = this.scene.add.text(0, 12, labels.en, {
      fontSize: '11px',
      fontStyle: 'italic',
      color: '#00ff00'
    }).setOrigin(0.5).setDepth(3101).setScrollFactor(0).setVisible(false);

    // Track for cleanup and positioning
    this.absoluteButtons.push(bg, tGa, tEn);

    // Pointer events
    bg.on('pointerdown', (pointer, localX, localY, event) => {
      if (event) event.stopPropagation();

      console.log(`!!! BUTTON HIT DETECTED: ${actionKey} !!!`);

      // Visual feedback for touch
      bg.setFillStyle(0x7a5040);
      this.scene.time.delayedCall(100, () => {
        if (bg && bg.active) bg.setFillStyle(0x4a3020);
      });

      this.onAction(actionKey);
    });

    return { bg: bg, textGa: tGa, textEn: tEn, localX: localX, container: btnCont };
  }

  updatePositions() {
    // Get the absolute screen position of the container
    const containerX = this.container.x + this.container.parentContainer.x;
    const containerY = this.container.y + this.container.parentContainer.y;

    console.log('ButtonBar container position:', containerX, containerY);

    this.buttons.forEach((btn, index) => {
      const absX = containerX + btn.localX;
      const absY = containerY;
      
      console.log(`Button ${index} at localX=${btn.localX} -> absX=${absX}, absY=${absY}`);
      
      btn.bg.setPosition(absX, absY).setVisible(true);
      btn.textGa.setPosition(absX, absY - 2).setVisible(true);
      btn.textEn.setPosition(absX, absY + 12).setVisible(true);
    });
  }

  hide() {
    this.absoluteButtons.forEach(el => el.setVisible(false));
  }

  updateOpacity() {
    const enAlpha = GameSettings.englishOpacity;
    this.buttons.forEach(btn => {
      if (btn.textEn) btn.textEn.setAlpha(enAlpha);
    });
  }

  destroy() {
    this.container.destroy();
    this.absoluteButtons.forEach(el => el.destroy());
    this.absoluteButtons = [];
  }
} 
