// worldMenu.js
//
// The pack, as the scenes know it. The drawing and the handling are in
// inventory/inventoryView.js (DOM, under the menu hub's tab bar); this keeps
// the names the scenes already call: open, close, isOpen, refreshGridDisplay,
// itemDetailPanel.{isVisible,hide,updateLanguageOpacity}, tryPickupItem.

import InventoryView from './inventory/inventoryView.js';

export default class WorldMenu {
  constructor(scene, { player, onClose }) {
    this.onClose = onClose;
    this.scene = scene;
    this.player = player;
    this.isOpen = false;

    this.view = new InventoryView(scene, { player });

    const view = this.view;
    // the item card stands where the old detail panel did
    this.itemDetailPanel = {
      get isVisible() { return view.cardOpen; },
      hide: () => view.closeCard(),
      updateLanguageOpacity: () => view.applyLanguage(),
    };
    this.inventoryGrid = { show() {}, hide() {} };
  }

  refreshGridDisplay() {
    if (this.isOpen) this.view.render();
  }

  toggle() {
    if (this.view.cardOpen) { this.view.closeCard(); return; }
    this.isOpen ? this.close() : this.open();
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    // the brooch stays round the moon while the pack is open; only its arrows go
    this.scene.joystick?.hideDirections();
    this.view.open();
  }

  // silent: the hub is the one closing it (or moving to another tab), so it
  // isn't told to close in turn
  close(silent = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.view.close();
    this.scene.joystick?.showDirections();
    if (!silent) this.onClose?.();
  }

  show() { this.open(); }
  hide() { this.close(); }

  // walking onto a dropped thing picks it up
  tryPickupItem(droppedItem, collider) {
    if (droppedItem.justDropped) return;
    if (this.player.inventory.addItem(droppedItem.itemData) === false) return;
    const index = this.scene.droppedItems?.indexOf(droppedItem) ?? -1;
    if (index > -1) this.scene.droppedItems.splice(index, 1);
    if (collider) collider.destroy();
    droppedItem.destroy();
    this.refreshGridDisplay();
  }

  destroy() {
    this.view.destroy();
  }
}
