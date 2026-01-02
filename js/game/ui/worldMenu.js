import Phaser from 'phaser';
import InventoryGrid from './inventory/inventoryGrid.js';

export default class WorldMenu {
  constructor(scene, { player }) {
    this.scene = scene;
    this.player = player;
    this.isOpen = false;

    const { width, height } = scene.scale;

    // --- Full-screen semi-transparent background ---
    this.bg = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.5)
      .setScrollFactor(0)
      .setDepth(1900)
      .setInteractive()
      .disableInteractive(); // only enable when menu is open

    // Close menu when tapping near top/bottom edges
    this.bg.on('pointerup', (pointer) => {
      const topEdge = height * 0.1;
      const bottomEdge = height * 0.9;
      if (pointer.y < topEdge || pointer.y > bottomEdge) {
        this.close();
      }
    });

    // --- Main inventory panel ---
    const panelHeight = height * 0.8;
    const panelWidth = panelHeight; // square

    this.panel = scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x888888)
      .setScrollFactor(0)
      .setDepth(1901)
      .setStrokeStyle(3, 0xffffff)
      .setVisible(false);

    // --- Inventory grid (5x5) ---
    this.inventoryGrid = new InventoryGrid(scene, {
      x: width / 2,
      y: height / 2,
      size: panelWidth * 0.9, // leave margin
      rows: 5,
      cols: 5
    });
    this.inventoryGrid.hide();

    // Hide menu initially
    this.bg.setVisible(false);
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
