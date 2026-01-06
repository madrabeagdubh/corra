// inventory/item.js
export default class Item {
  constructor(data) {
    this.id = data.id;
    this.type = data.type; // 'armor', 'weapon', 'consumable', 'misc'
    this.subtype = data.subtype; // 'bow', 'sword', 'chest', 'potion', etc.
    
    // Display names
    this.nameEn = data.nameEn;
    this.nameGa = data.nameGa;
    this.descEn = data.descEn;
    this.descGa = data.descGa;
    
    // Stats and properties
    this.stats = data.stats || {}; // { defense: 5, attack: 2, etc. }
    this.stackable = data.stackable || false;
    this.quantity = data.quantity || 1;
    
    // Equipment slot (if equippable)
    this.equipSlot = data.equipSlot; // 'rightHand', 'leftHand', 'armor', 'accessory1', 'accessory2'
    
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
      quantity: this.quantity,
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
}
