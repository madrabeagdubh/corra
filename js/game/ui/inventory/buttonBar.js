import { GameSettings } from '../../settings/gameSettings.js';
import { FONTS, COLORS, BUTTON, createButton, pickLanguage } from '../../systems/gameTypography.js';

export default class ButtonBar {
  constructor(scene, { width, onAction }) {
    this.scene    = scene;
    this.width    = width;
    this.onAction = onAction;
    this.container = scene.add.container(0, 0);
    this.buttons   = [];      // { btn (createButton handle), actionKey }
  }

  refresh(actions, isEquipped) {
    // Destroy previous buttons
    this.buttons.forEach(({ btn }) => btn.destroy());
    this.buttons = [];
    this.container.removeAll(true);

    const labelMap = {
      equip:   { ga: 'Feisteáil', en: 'Equip'   },
      unequip: { ga: 'Difheistigh', en: 'Unequip' },
      drop:    { ga: 'Scaoil',    en: 'Drop'    },
      throw:   { ga: 'Caith',     en: 'Throw'   },
      drink:   { ga: 'Ól',        en: 'Drink'   },
    };

    const finalActions = actions.map(a => (isEquipped && a === 'equip') ? 'unequip' : a);
    // Use more screen width -- dpad arrows are hidden while menu is open
    const availW = Math.min(window.innerWidth * 0.9, 400)
    const spacing = Math.round(availW / Math.max(finalActions.length, 1));
    let currentX  = -((finalActions.length - 1) * spacing) / 2;

    finalActions.forEach((actionKey) => {
      const labels  = labelMap[actionKey] || { ga: actionKey, en: actionKey };
      const btnW    = spacing - 8;

      const btn = createButton(this.scene, {
        x:       currentX,
        y:       0,
        width:   btnW,
        labelGa: labels.ga,
        labelEn: labels.en,
        depth:   3100,
        opacity: GameSettings.englishOpacity,
        onTap:   () => this.onAction(actionKey),
      });

      // Add both bg and text into the container so they hide with it
      this.container.add(btn.bg);
      this.container.add(btn.text);
      this.buttons.push({ btn, actionKey });
      currentX += spacing;
    });
  }

  updatePositions() {
    // Elements live in the container -- no manual repositioning needed.
    this.updateOpacity();
  }

  hide() {
    // Container visibility is controlled by itemDetailPanel.container.
    // Kept for API compatibility.
  }

  updateOpacity() {
    const op = GameSettings.englishOpacity;
    this.buttons.forEach(({ btn }) => btn.updateOpacity(op));
  }

  destroy() {
    this.buttons.forEach(({ btn }) => btn.destroy());
    this.buttons = [];
    this.container.destroy();
  }
}

