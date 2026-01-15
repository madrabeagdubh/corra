// js/game/ui/inventory/item.js
export default class Item {
  constructor(data) {
    this.id = data.id;
    this.type = data.type;
    this.subtype = data.subtype;

    // Display names
    this.nameEn = data.nameEn;
    this.nameGa = data.nameGa;
    this.descEn = data.descEn;
    this.descGa = data.descGa;

    // Stats and properties
    this.stats = data.stats || {};
    this.stackable = data.stackable || false;
    this.maxStack = data.maxStack || 1; // NEW: Maximum stack size
    this.quantity = data.quantity || 1;

    // Actions from itemDefinitions.js
    this.actions = data.actions || [];
    
    // Allowed Slots from itemDefinitions.js
    this.allowedSlots = data.allowedSlots || [];

    // Equipment slot
    this.equipSlot = data.equipSlot;

    // Visual
    this.spriteKey = data.spriteKey;
    this.color = data.color || 0xffffff;
  }

  clone() {
    return new Item({
      id: this.id,
      type: this.type,
      subtype: this.subtype,
      nameEn: this.nameEn,
      nameGa: this.nameGa,
      descEn: this.descEn,
      descGa: this.descGa,
      stats: { ...this.stats },
      stackable: this.stackable,
      maxStack: this.maxStack, // NEW: Include maxStack in clone
      quantity: this.quantity,
      actions: [...this.actions],
      allowedSlots: [...this.allowedSlots],
      equipSlot: this.equipSlot,
      spriteKey: this.spriteKey,
      color: this.color
    });
  }

  getDisplayName(lang = 'en') {
    return lang === 'ga' ? this.nameGa : this.nameEn;
  }

  getDescription(lang = 'en') {
    return lang === 'ga' ? this.descGa : this.descEn;
  }

  /**
   * Check if this item can stack with another item
   */
  canStackWith(otherItem) {
    if (!this.stackable || !otherItem || !otherItem.stackable) {
      return false;
    }
    
    // Must be the same item type
    if (this.id !== otherItem.id) {
      return false;
    }
    
    // Check if there's room in the stack
    return this.quantity < this.maxStack;
  }

  /**
   * Add quantity to this stack
   * Returns the amount that couldn't be added (overflow)
   */
  addToStack(amount) {
    if (!this.stackable) return amount;
    
    const spaceAvailable = this.maxStack - this.quantity;
    const amountToAdd = Math.min(amount, spaceAvailable);
    
    this.quantity += amountToAdd;
    
    return amount - amountToAdd; // Return overflow
  }

  /**
   * Remove quantity from this stack
   * Returns true if successful, false if not enough quantity
   */
  removeFromStack(amount) {
    if (this.quantity < amount) {
      return false;
    }
    
    this.quantity -= amount;
    return true;
  }
}
