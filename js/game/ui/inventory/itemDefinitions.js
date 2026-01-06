// inventory/itemDefinitions.js
import Item from './item.js';

// Define all item templates
export const ITEM_DEFS = {
  leather_armor: {
    id: 'leather_armor',
    type: 'armor',
    subtype: 'chest',
    nameEn: 'Leather Armor',
    nameGa: 'Armúr Leathair',
    descEn: 'Basic leather protection. Light but reliable.',
    descGa: 'Cosaint leathair bunúsach. Éadrom ach iontaofa.',
    stats: { defense: 3 },
    equipSlot: 'armor',
    spriteKey: 'armor_leather',
    color: 0x8B4513
  },

  simple_bow: {
    id: 'simple_bow',
    type: 'weapon',
    subtype: 'bow',
    nameEn: 'Simple Bow',
    nameGa: 'Bogha Simplí',
    descEn: 'A basic hunting bow. Requires arrows.',
    descGa: 'Bogha seilge bunúsach. Tá saigheada ag teastáil.',
    stats: { attack: 4, range: 5 },
    equipSlot: 'rightHand',
    spriteKey: 'weapon_bow',
    color: 0x8B4513
  },

  arrows: {
    id: 'arrows',
    type: 'ammunition',
    subtype: 'arrow',
    nameEn: 'Arrows',
    nameGa: 'Saigheada',
    descEn: 'Sharp arrows for your bow.',
    descGa: 'Saigheada géara do do bhogha.',
    stackable: true,
    quantity: 30,
    spriteKey: 'ammo_arrow',
    color: 0xFFFFFF
  },

  healing_potion: {
    id: 'healing_potion',
    type: 'consumable',
    subtype: 'potion',
    nameEn: 'Healing Potion',
    nameGa: 'Deoch Leighis',
    descEn: 'Restores 20 health when consumed.',
    descGa: 'Athchóiríonn 20 sláinte nuair a chaitear é.',
    stats: { healAmount: 20 },
    stackable: true,
    quantity: 1,
    spriteKey: 'potion_health',
    color: 0xFF0000
  }
};

// Helper to create item instances
export function createItem(itemId, quantity = 1) {
  const def = ITEM_DEFS[itemId];
  if (!def) {
    console.error(`Item definition not found: ${itemId}`);
    return null;
  }

  const itemData = { ...def };
  if (quantity > 1 && itemData.stackable) {
    itemData.quantity = quantity;
  }

  return new Item(itemData);
}

// Create starting inventory for player
export function createStartingInventory() {
  return [
    createItem('simple_bow'),
    null, // left hand empty
    createItem('leather_armor'),
    null, // accessory1 empty
    null, // accessory2 empty
    createItem('healing_potion'),
    createItem('arrows', 30),
    // Rest are null (empty slots)
  ];
}
