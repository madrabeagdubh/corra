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
  equipItem(fromIndex, toSlot) {
    const item = this.getItem(fromIndex);
    if (!item || !item.equipSlot) return false;

    // Get the equipment slot index
    const equipIndex = this.equipSlots[toSlot];
    if (equipIndex === undefined) return false;

    // Swap: if something already equipped, move it to inventory
    const currentlyEquipped = this.slots[equipIndex];
    
    // Move new item to equipment slot
    this.slots[equipIndex] = item;
    this.slots[fromIndex] = null;

    // If there was something equipped, put it where the new item came from
    if (currentlyEquipped) {
      this.slots[fromIndex] = currentlyEquipped;
    }

    return true;
  }

  // Unequip item to inventory
  unequipItem(equipSlot) {
    const equipIndex = this.equipSlots[equipSlot];
    if (equipIndex === undefined) return false;

    const item = this.slots[equipIndex];
    if (!item) return false;

    const emptySlot = this.findEmptyInventorySlot();
    if (emptySlot === -1) {
      console.warn('No room to unequip!');
      return false;
    }

    this.slots[emptySlot] = item;
    this.slots[equipIndex] = null;
    return true;
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
