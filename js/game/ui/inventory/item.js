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
    this.quantity = data.quantity || 1;

    // NEW: Actions from itemDefinitions.js
    this.actions = data.actions || []; // <--- ADD THIS
    
    // NEW: Allowed Slots from itemDefinitions.js
    this.allowedSlots = data.allowedSlots || []; // <--- ADD THIS

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
      quantity: this.quantity,
      actions: [...this.actions],        // <--- ADD THIS (Copy the array)
      allowedSlots: [...this.allowedSlots], // <--- ADD THIS
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
 
