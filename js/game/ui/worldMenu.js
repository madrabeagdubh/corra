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
      .setInteractive({ priorityID: 0 }) 
      .setVisible(false);

    // Track if pointer started inside detail panel
    this.pointerStartedInDetailPanel = false;

    // Listen for pointer down to track where gestures start
    this.bg.on('pointerdown', (pointer, localX, localY, event) => {
      // Check if detail panel is open and visible
      if (this.itemDetailPanel && this.itemDetailPanel.isVisible) {
        this.pointerStartedInDetailPanel = true;
        return;
      }

      this.pointerStartedInDetailPanel = false;

      // Check if we tapped outside the main inventory panel to close menu
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

    // Only close on pointerup if we didn't start in the detail panel
    this.bg.on('pointerup', (pointer) => {
      if (this.pointerStartedInDetailPanel) {
        this.pointerStartedInDetailPanel = false;
        return;
      }
    });

    // --- Main inventory panel ---
    const panelHeight = height * 0.8;
    const panelWidth = Math.min(panelHeight, width * 0.9);

    if (scene.textures.exists('panel_stone')) {
      this.panel = scene.add.sprite(width / 2, height / 2, 'panel_stone')
        .setDisplaySize(panelWidth, panelHeight)
        .setScrollFactor(0)
        .setDepth(1901)
        .setVisible(false);

      this.panelBorder = scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight)
        .setStrokeStyle(3, 0xffffff)
        .setFillStyle(0x000000, 0)
        .setScrollFactor(0)
        .setDepth(1901)
        .setVisible(false);
    } else {
      this.panel = scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x888888)
        .setScrollFactor(0)
        .setDepth(1901)
        .setStrokeStyle(3, 0xffffff)
        .setVisible(false);
    }

    // --- Inventory Grid ---
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

    // --- Item Detail Panel ---
    this.itemDetailPanel = new ItemDetailPanel(scene, {
      x: width / 2,
      y: height / 2,
      width: panelWidth * 0.95,
      height: panelHeight * 0.95,
      onAction: (action, item, slotInfo) => this.handleItemAction(action, item, slotInfo)
    });

    // --- Global Touch Sniffer (Debug only) ---
    this.scene.input.on('pointerdown', (pointer, gameObjects) => {
      if (!this.isOpen) return;
      console.log('--- Touch Report ---');
      console.log(`Position: ${Math.floor(pointer.x)}, ${Math.floor(pointer.y)}`);
      if (gameObjects.length > 0) {
        gameObjects.forEach((obj, i) => {
          const key = obj.texture?.key || 'no-texture';
          console.log(`[${i}] Type: ${obj.type} | Key: ${key} | Depth: ${obj.depth}`);
        });
      } else {
        console.log('Result: Hit nothing');
      }
    });
  }

  handleInventorySlot(slot) {
    const item = this.player.inventory.getItem(slot.index);
    if (item) {
      console.log('Showing detail panel for:', item.nameEn);
      this.itemDetailPanel.show(item, slot);
    } else {
      this.itemDetailPanel.hide();
    }
  }

  handleItemAction(action, item, slotInfo) {
    console.log('Action:', action, 'Item:', item.nameEn);
    switch (action) {
      case 'equip':
        this.equipItem(item, slotInfo);
        break;
      case 'unequip':
        this.unequipItem(item, slotInfo);
        break;
      case 'drink':
        this.usePotion(item, slotInfo);
        break;
      case 'drop':
      case 'throw':
        this.throwItem(item, slotInfo);
        break;
    }
  }

  equipItem(item, slotInfo) {
    console.log('equipItem called - slotInfo:', slotInfo);
    
    if (!item.equipSlot) return;

    // Don't try to equip if already equipped
    if (slotInfo.isEquipSlot) {
      console.warn('Item is already equipped, use unequip instead');
      return;
    }

    // Special case: Bow takes up both hands
    if (item.subtype === 'bow') {
      // Lock the left hand (Slot 1) with a placeholder
      this.player.inventory.setItem(this.player.inventory.equipSlots['leftHand'], {
        id: 'occupied',
        nameGa: '(In úsáid)',
        nameEn: '(In use)',
        spriteKey: null,
        type: 'placeholder'
      });
    }

    const success = this.player.inventory.equipItem(slotInfo.index, item.equipSlot);
    if (success) {
      this.player.updateStatsFromEquipment();
      this.refreshGridDisplay();
      this.itemDetailPanel.hide();
    }
  }

  unequipItem(item, slotInfo) {
    const success = this.player.inventory.unequipItem(item.equipSlot);
    if (success) {
      // Special case: If unequipping a bow, clear the left hand placeholder
      if (item.subtype === 'bow') {
        this.player.inventory.setItem(this.player.inventory.equipSlots['leftHand'], null);
      }

      console.log(`Unequipped ${item.nameEn}`);
      this.player.updateStatsFromEquipment();
      this.refreshGridDisplay();
      this.itemDetailPanel.hide();
    }
  }

  usePotion(item, slotInfo) {
    console.log(`Used ${item.nameEn}`);
    // Add your potion use logic here
    this.player.inventory.removeItem(slotInfo.index);
    this.refreshGridDisplay();
    this.itemDetailPanel.hide();
  }

  throwItem(item, slotInfo) {
    console.log(`Threw ${item.nameEn}`);
    this.close();
  }

  refreshGridDisplay() {
    const inventory = this.player.inventory;
    this.inventoryGrid.squares.forEach((square, index) => {
      const item = inventory.getItem(index);
      this.inventoryGrid.updateSlot(index, item);
    });
  }

  toggle() {
    if (this.itemDetailPanel && this.itemDetailPanel.isVisible) {
      this.itemDetailPanel.hide();
      return;
    }
    this.isOpen ? this.close() : this.open();
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


throwItem(item, slotInfo) {
  console.log(`Dropped ${item.nameEn}`);
  
  // Remove from inventory
  this.player.inventory.removeItem(slotInfo.index);
  
  // Spawn the item on the map near the player
  this.spawnItemOnMap(item);
  
  // Refresh and close
  this.refreshGridDisplay();
  this.close();
}

spawnItemOnMap(item) {
  // Get player position - drop slightly in front based on facing direction
  const dropX = this.player.sprite.x;
  const dropY = this.player.sprite.y + 32; // Slightly below player
  
  // Create the dropped item sprite
  const droppedItem = this.scene.physics.add.sprite(dropX, dropY, item.spriteKey)
    .setScale(1.0)
    .setDepth(this.player.sprite.depth - 1); // Below player so they can walk over it
  
  // Make sure the body exists and configure it
  if (droppedItem.body) {
    droppedItem.body.setSize(32, 32); // Adjust size as needed
    droppedItem.body.setAllowGravity(false); // Prevent it from falling if you have gravity
    droppedItem.body.immovable = true; // Item doesn't move when player touches it
  } else {
    console.error('Failed to create physics body for dropped item!');
  }
  
  // Store the full item data on the sprite for pickup
  droppedItem.itemData = item.clone();
  
 }
tryPickupItem(droppedItem, collider) {
  // Check if player just dropped this item (prevent immediate pickup)
  if (droppedItem.justDropped) {
    return;
  }
  
  // Find empty slot
  const emptySlot = this.player.inventory.findEmptyInventorySlot();
  
  if (emptySlot === -1) {
    console.log('Inventory full! Cannot pick up.');
    // Could show a UI message here
    return;
  }
  
  // Add back to inventory
  this.player.inventory.setItem(emptySlot, droppedItem.itemData);
  
  // Remove from dropped items array
  const index = this.scene.droppedItems.indexOf(droppedItem);
  if (index > -1) {
    this.scene.droppedItems.splice(index, 1);
  }
  
  // Destroy the collider and sprite
  if (collider) {
    collider.destroy();
  }
  droppedItem.destroy();
  
  console.log(`Picked up ${droppedItem.itemData.nameEn} into slot ${emptySlot}`);
  
  // Refresh grid if menu is open
  if (this.isOpen) {
    this.refreshGridDisplay();
  }
}





}  
