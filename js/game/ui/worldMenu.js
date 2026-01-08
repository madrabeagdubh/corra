// js/game/ui/worldMenu.js
import Phaser from 'phaser';
import InventoryGrid from './inventory/inventoryGrid.js';
import ItemDetailPanel from './inventory/itemDetailPanel.js';

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

    // Re-enable tap-to-close outside panel area
    this.bg.on('pointerdown', (pointer) => {
      // Calculate if tap is outside the panel bounds
      const panelHeight = height * 0.8;
      const panelWidth = Math.min(panelHeight, width * 0.9);
      const panelLeft = width / 2 - panelWidth / 2;
      const panelRight = width / 2 + panelWidth / 2;
      const panelTop = height / 2 - panelHeight / 2;
      const panelBottom = height / 2 + panelHeight / 2;

      const isOutside = pointer.x < panelLeft || pointer.x > panelRight ||
                        pointer.y < panelTop || pointer.y > panelBottom;

      if (isOutside) {
        console.log('Tapped outside panel - closing');
        this.close();
      }
    });

    // --- Main inventory panel ---
    const panelHeight = height * 0.8;
    const panelWidth = Math.min(panelHeight, width * 0.9);

    // Use stone texture if available, fallback to grey rectangle
    if (scene.textures.exists('panel_stone')) {
      this.panel = scene.add.sprite(width / 2, height / 2, 'panel_stone')
        .setDisplaySize(panelWidth, panelHeight)
        .setScrollFactor(0)
        .setDepth(1901)
        .setVisible(false);
      
      // Add border
      this.panelBorder = scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight)
        .setStrokeStyle(3, 0xffffff)
        .setFillStyle(0x000000, 0) // Transparent fill
        .setScrollFactor(0)
        .setDepth(1901)
        .setVisible(false);
    } else {
      // Fallback to rectangle
      this.panel = scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x888888)
        .setScrollFactor(0)
        .setDepth(1901)
        .setStrokeStyle(3, 0xffffff)
        .setVisible(false);
    }

    // No close button needed anymore

    // --- Inventory Grid (centered, no need to move for detail panel) ---
    const gridSize = panelWidth * 0.85;
    const gridY = height / 2; // Centered

    this.inventoryGrid = new InventoryGrid(scene, {
      x: width / 2,
      y: gridY,
      size: gridSize,
      rows: 5,
      cols: 5,
      onSlotSelected: (slot) => this.handleInventorySlot(slot)
    });

    this.inventoryGrid.hide();

    // --- Item Detail Panel (full-screen overlay, appears on top) ---
    this.itemDetailPanel = new ItemDetailPanel(scene, {
      x: width / 2,
      y: height / 2,
      width: panelWidth * 0.95,
      height: panelHeight * 0.95,
      onAction: (action, item, slotInfo) => this.handleItemAction(action, item, slotInfo)
    });

    console.log('ItemDetailPanel created:', this.itemDetailPanel);
    console.log('ItemDetailPanel container:', this.itemDetailPanel.container);
  }

  handleInventorySlot(slot) {
    console.log('=== handleInventorySlot called ===');
    console.log('Selected slot:', slot);

    // Get the item from player's inventory
    const item = this.player.inventory.getItem(slot.index);
    console.log('Item found:', item);

    if (item) {
      console.log('Showing detail panel for:', item.nameEn);
      // Show item details
      this.itemDetailPanel.show(item, slot);
    } else {
      console.log('Empty slot - hiding detail panel');
      // Empty slot - hide detail panel
      this.itemDetailPanel.hide();
    }
  }

  handleItemAction(action, item, slotInfo) {
    console.log('Action:', action, 'Item:', item.nameEn, 'Slot:', slotInfo.index);

    switch (action) {
      case 'equip':
        this.equipItem(item, slotInfo);
        break;
      case 'drop':
        this.dropItem(item, slotInfo);
        break;
      case 'throw':
        this.throwItem(item, slotInfo);
        break;
    }
  }

  equipItem(item, slotInfo) {
    if (!item.equipSlot) {
      console.warn('Item is not equippable');
      return;
    }

    // Move item from inventory to equipment slot
    const success = this.player.inventory.equipItem(slotInfo.index, item.equipSlot);
    
    if (success) {
      console.log(`Equipped ${item.nameEn} to ${item.equipSlot}`);
      
      // Update player stats
      this.player.updateStatsFromEquipment();
      
      // Refresh the grid display
      this.refreshGridDisplay();
      
      // Hide detail panel after equipping
      this.itemDetailPanel.hide();
    }
  }

  dropItem(item, slotInfo) {
    // Remove from inventory
    this.player.inventory.removeItem(slotInfo.index);
    
    // Create dropped item at player's current position
    this.scene.events.emit('dropItem', item, this.player.sprite.x, this.player.sprite.y);
    
    console.log(`Dropped ${item.nameEn} at player position`);
    
    // Close menu after dropping
    this.close();
  }

  throwItem(item, slotInfo) {
    // TODO: Implement throw mechanic
    console.log(`Threw ${item.nameEn}`);
    this.close();
  }

  refreshGridDisplay() {
    // Update grid visuals to show which slots have items
    const inventory = this.player.inventory;
    
    this.inventoryGrid.squares.forEach((square, index) => {
      const item = inventory.getItem(index);
      this.inventoryGrid.updateSlot(index, item);
    });
  }

  open() {
    this.bg.setVisible(true);
    this.panel.setVisible(true);
    if (this.panelBorder) this.panelBorder.setVisible(true);
    this.inventoryGrid.show();
    this.refreshGridDisplay();
    this.isOpen = true;
  }

  close() {
    this.bg.setVisible(false);
    this.panel.setVisible(false);
    if (this.panelBorder) this.panelBorder.setVisible(false);
    this.inventoryGrid.hide();
    this.itemDetailPanel.hide();
    this.isOpen = false;
  }

  destroy() {
    this.bg.destroy();
    this.panel.destroy();
    if (this.panelBorder) this.panelBorder.destroy();
    this.inventoryGrid.destroy();
    this.itemDetailPanel.destroy();
  }
} 
