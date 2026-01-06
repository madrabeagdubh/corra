import Phaser from 'phaser';
import InventoryGrid from './inventory/inventoryGrid.js';

export default class WorldMenu {
  constructor(scene, { player }) {
    this.scene = scene;
    this.player = player;
    this.isOpen = false;

    const { width, height } = scene.cameras.main;

    // --- Semi-transparent background overlay ---
    this.bg = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setScrollFactor(0)
      .setDepth(1900)
      .setInteractive()
      .setVisible(false);

    this.bg.on('pointerup', (pointer) => {
      const topEdge = height * 0.1;
      const bottomEdge = height * 0.9;
      if (pointer.y < topEdge || pointer.y > bottomEdge) {
        this.close();
      }
    });

    // --- Main inventory panel ---
    const panelHeight = height * 0.8;
    // Make panel width the smaller of: square (height-based) or 90% of screen width
    const panelWidth = Math.min(panelHeight, width * 0.9);

    this.panel = scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x888888)
      .setScrollFactor(0)
      .setDepth(1901)
      .setStrokeStyle(3, 0xffffff)
      .setVisible(false);

    // Grid should be smaller than panel to leave padding
    const gridSize = panelWidth * 0.85;

    this.inventoryGrid = new InventoryGrid(scene, {
      x: width / 2,
      y: height / 2,
      size: gridSize,
      rows: 5,
      cols: 5,
      onSlotSelected: (slot) => this.handleInventorySlot(slot)
    });

    this.inventoryGrid.hide();
  }

  handleInventorySlot(slot) {
    console.log('Selected slot:', slot);
  }

  open() {
    this.bg.setVisible(true).setInteractive();
    this.panel.setVisible(true);
    this.inventoryGrid.show();
    this.isOpen = true;
  }

  close() {
    this.bg.setVisible(false).disableInteractive();
    this.panel.setVisible(false);
    this.inventoryGrid.hide();
    this.isOpen = false;
  }

  destroy() {
    this.bg.destroy();
    this.panel.destroy();
    this.inventoryGrid.destroy();
  }
} 
