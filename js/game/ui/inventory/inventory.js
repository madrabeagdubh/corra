// inventory/inventory.js
export default class Inventory {
  constructor({ rows = 5, cols = 5 }) {
    this.rows = rows;
    this.cols = cols;
    
    // Equipment slots (top row, indices 0-4)
    this.equipSlots = {
      rightHand: 0,    // index 0
      leftHand: 1,     // index 1
      armor: 2,        // index 2
      accessory1: 3,   // index 3
      accessory2: 4    // index 4
    };
    
    // Total slots = rows * cols
    // First row (0-4) = equipment
    // Remaining rows (5-24) = inventory
    this.totalSlots = rows * cols;
    this.inventoryStartIndex = cols; // Start of regular inventory (index 5)
    
    // Array to hold items (null = empty slot)
    this.slots = new Array(this.totalSlots).fill(null);
  }

  // Get item at specific slot index
  getItem(index) {
    if (index < 0 || index >= this.totalSlots) return null;
    return this.slots[index];
  }

  // Set item at specific slot index
  setItem(index, item) {
    if (index < 0 || index >= this.totalSlots) return false;
    this.slots[index] = item;
    return true;
  }

  // Find first empty slot in inventory (not equipment slots)
  findEmptyInventorySlot() {
    for (let i = this.inventoryStartIndex; i < this.totalSlots; i++) {
      if (!this.slots[i]) return i;
    }
    return -1;
  }

  // Add item to inventory (finds empty slot automatically)
  addItem(item) {
    const emptySlot = this.findEmptyInventorySlot();
    if (emptySlot === -1) {
      console.warn('Inventory full!');
      return false;
    }
    this.slots[emptySlot] = item;
    return emptySlot;
  }

  // Remove item from slot
  removeItem(index) {
    const item = this.slots[index];
    this.slots[index] = null;
    return item;
  }

  // Equip an item from inventory to equipment slot
  equipItem(item, slotInfo) {
    if (!item.equipSlot) return;

    // Check if the Bow is going into the right hand
    if (item.subtype === 'bow') {
       // Lock the left hand (Slot 1)
       this.player.inventory.setItem(1, { 
         id: 'occupied', 
         nameGa: '(In úsáid)', 
         nameEn: '(In use)', 
         spriteKey: null 
       });
    }

    const success = this.player.inventory.equipItem(slotInfo.index, item.equipSlot);

    if (success) {
      this.player.updateStatsFromEquipment();
      this.refreshGridDisplay();
      this.itemDetailPanel.hide();
    }
  }
 

  // Unequip item to inventory
  unequipItem(item, slotInfo) {
    // 1. Ask inventory to move item to backpack
    // Note: We use slotInfo.isEquipSlot logic or specific mapping here
    const success = this.player.inventory.unequipItem(item.equipSlot);

    if (success) {
      // 2. SPECIAL: If it's a Bow, we must manually clear the "Occupied" slot in the Left Hand (Slot 1)
      if (item.subtype === 'bow') {
        this.player.inventory.setItem(1, null); 
      }

      console.log(`Unequipped ${item.nameEn}`);
      this.player.updateStatsFromEquipment();
      this.refreshGridDisplay();
      this.itemDetailPanel.hide();
    }
  }

  usePotion(item, slotInfo) {
    console.log(`Drinking ${item.nameEn}`);
    // Apply healing logic to player
    if (item.stats && item.stats.healAmount) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + item.stats.healAmount);
    }
    
    // Remove one from stack or remove item
    this.player.inventory.removeItem(slotInfo.index);
    this.refreshGridDisplay();
    this.itemDetailPanel.hide();
  }
  

  // Get all equipped items
  getEquippedItems() {
    const equipped = {};
    for (const [slotName, index] of Object.entries(this.equipSlots)) {
      equipped[slotName] = this.slots[index];
    }
    return equipped;
  }

  // Calculate total stats from equipped items
  calculateEquippedStats() {
    const stats = {
      defense: 0,
      attack: 0,
      health: 0,
      speed: 0
    };

    const equipped = this.getEquippedItems();
    for (const item of Object.values(equipped)) {
      if (item && item.stats) {
        for (const [stat, value] of Object.entries(item.stats)) {
          stats[stat] = (stats[stat] || 0) + value;
        }
      }
    }

    return stats;
  }
}
