// js/game/ui/inventory/item.js
//
// An item keeps every field its definition gives it (h, defGa, edged, ...),
// not only the ones named below: a definition can grow without this file
// having to learn about it.
export default class Item {
  constructor(data) {
    Object.assign(this, data);

    this.itemGid = data.itemGid || null;
    this.id = data.id;
    this.type = data.type;
    this.subtype = data.subtype;

    // Display names
    this.nameEn = data.nameEn;
    this.nameGa = data.nameGa;
    this.descEn = data.descEn ?? data.descriptionEn;
    this.descGa = data.descGa ?? data.descriptionGa;

    // Stats and properties
    this.stats = data.stats || {};
    this.stackable = data.stackable || false;
    this.maxStack = data.maxStack || 1;
    this.quantity = data.quantity || 1;

    // Size in the pack: 1 cell, or 2 cells tall for long things (bows, swords)
    this.h = data.h === 2 ? 2 : 1;

    // Actions from itemDefinitions.js
    this.actions = data.actions || [];

    // Allowed Slots from itemDefinitions.js
    this.allowedSlots = data.allowedSlots || [];

    // Equipment slot
    this.equipSlot = data.equipSlot;

    // Visual
    this.spriteKey = data.spriteKey;
    this.color = data.color || 0xffffff;
    this.tint = data.tint || null;          // a tint over the shared sprite (training arrows: pale wood)
    this.training = !!data.training;
  }

  clone() {
    const data = JSON.parse(JSON.stringify(this));
    return new Item(data);
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
