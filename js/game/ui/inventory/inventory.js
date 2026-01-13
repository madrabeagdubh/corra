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

 




// Add these methods to your Inventory class

// Equipment slot mapping (you already have this)
// equipSlots = {
//   'rightHand': 0,
//   'leftHand': 1,
//   'head': 2,
//   'body': 3,
//   'feet': 4
// }

/**
 * Equip an item from inventory slot to equipment slot
 * @param {number} inventorySlotIndex - The inventory slot containing the item
 * @param {string} equipSlotName - The equipment slot name (e.g., 'rightHand', 'body')
 * @returns {boolean} - Success status
 */
equipItem(inventorySlotIndex, equipSlotName) {
  // Get the item from inventory
  const item = this.slots[inventorySlotIndex];
  if (!item) {
    console.warn('No item in slot', inventorySlotIndex);
    return false;
  }

  // Verify item can be equipped in this slot
  if (item.equipSlot !== equipSlotName) {
    console.warn(`Item ${item.nameEn} cannot be equipped in ${equipSlotName}`);
    return false;
  }

  // Get the equipment slot index
  const equipSlotIndex = this.equipSlots[equipSlotName];
  if (equipSlotIndex === undefined) {
    console.warn('Invalid equipment slot:', equipSlotName);
    return false;
  }

  // Check if equipment slot is already occupied
  const currentlyEquipped = this.slots[equipSlotIndex];
  
  if (currentlyEquipped) {
    // Swap: move currently equipped item to the inventory slot
    this.slots[inventorySlotIndex] = currentlyEquipped;
    console.log(`Swapped ${currentlyEquipped.nameEn} with ${item.nameEn}`);
  } else {
    // Clear the inventory slot
    this.slots[inventorySlotIndex] = null;
  }

  // Equip the new item
  this.slots[equipSlotIndex] = item;
  console.log(`Equipped ${item.nameEn} to ${equipSlotName}`);

  return true;
}

/**
 * Unequip an item from equipment slot back to inventory
 * @param {string} equipSlotName - The equipment slot name (e.g., 'rightHand')
 * @returns {boolean} - Success status
 */
unequipItem(equipSlotName) {
  // Get the equipment slot index
  const equipSlotIndex = this.equipSlots[equipSlotName];
  if (equipSlotIndex === undefined) {
    console.warn('Invalid equipment slot:', equipSlotName);
    return false;
  }

  // Get the equipped item
  const item = this.slots[equipSlotIndex];
  if (!item) {
    console.warn('No item equipped in', equipSlotName);
    return false;
  }

  // Find an empty inventory slot
  const emptySlot = this.findEmptyInventorySlot();
  if (emptySlot === -1) {
    console.warn('Inventory full! Cannot unequip.');
    return false;
  }

  // Move item to inventory
  this.slots[emptySlot] = item;
  this.slots[equipSlotIndex] = null;
  
  console.log(`Unequipped ${item.nameEn} from ${equipSlotName} to slot ${emptySlot}`);
  return true;
}

/**
 * Check if an item is currently equipped
 * @param {string} equipSlotName - The equipment slot name
 * @returns {boolean}
 */
isEquipped(equipSlotName) {
  const equipSlotIndex = this.equipSlots[equipSlotName];
  return this.slots[equipSlotIndex] !== null && this.slots[equipSlotIndex] !== undefined;
}

/**
 * Get the item in a specific equipment slot
 * @param {string} equipSlotName - The equipment slot name
 * @returns {Item|null}
 */
getEquippedItem(equipSlotName) {
  const equipSlotIndex = this.equipSlots[equipSlotName];
  return this.slots[equipSlotIndex] || null;
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
