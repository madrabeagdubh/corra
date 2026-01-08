// inventory/itemDefinitions.js
import Item from './item.js';

// Define all item templates
export const ITEM_DEFS = {
  leather_armor: {
    id: 'leather_armor',
    type: 'armor',
    subtype: 'chest',
    nameEn: 'Armor',
    nameGa: 'Caith éidigh',
    descEn: 'Each piece a marvel, wrought with the skill of a thousand years.\nThe helm beareth the etchings of knot and beast, symbols of strength and cunning,\nwarding all ill fortune. Within it, my brow finds sanctuary,\nprotected from the swords of Saxon foes.\nUpon my shoulders mighty pauldrons. This cuirass, to encase my chest with impenetrable strength.\nA fortress for my heart. These greaves! unyielding in their purpose.',
    descGa: 'Gach píosa mar shárshaothar, scil an aimsir óg.\nAgus ar an clogaid, scríobhadh snaimanna ainmhithe mar comharthaí neart agus cleasacht,\ni gcoinne gach mí-ádh. Orm, tagann faoiseamh ar mo éadan\ncosaint i gcoinne na claimhte naimheadach Sasanach\nThar mo ghuailainn, pauldróin móra. Seo an lúireach, a cheilteann mo chliabh le neart dochloíte.\nDún dom croí. Jambeau! daingean ina gcuspóir.`',
    stats: { defense: 3 },
    equipSlot: 'armor',
    spriteKey: 'armor_leather',
    color: 0x8B4513
  },

  simple_bow: {
    id: 'simple_bow',
    type: 'weapon',
    subtype: 'bow',
    nameEn: 'Bow',
    nameGa: 'Bogha',
    descEn: 'Behold the wooden bow, of yew-tree fair,\nCrafted by hands skilled in war\'s dire art,\nA weapon of old, of wisdom rare,\nof doom and destiny.',
    descGa: 'Féach an bogha adhmaid, d’iúr ghlan,\nceaptha ag lámh i ndán an chogaidh,\narm an tsean-aimsir,de saíocht fánach,\nde uafáis agus fáil.',
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
    descEn: 'Behold the arrow of the Gael: a harbinger of woe,\nWith a tip that gleams like the morning star,\nA shaft crafted by the hand of the skilled,\nIts fletching the feathers of the raven,\nDark as the storm-clouds gathering o\'er the plains,\nA draught of sorrow for the clans.',
    descGa: 'Féach ar tsaighead na nGael:tuar bás, brón.\na ceann mar réalt an maidin,\nó láimh cheardaí oilte a ghas,\na cleite de chleiteacha an fhithich,\ndorchadas scamaill stoirm na machairí intí,\ndeoch bhróin do na treabh í.',
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
    descEn: 'Drink ye of this potion, and let it flow as the river through the valley, bringing strength and peace!  The elixir restors vigor to limbs aching from the clash of swords. Yet, the elixir is not for the unworthy, for it demands a heart of pure intent and a soul open to the mysteries of the world. Beware! for those who seek with greed or malice, the elixir shall turn bitter upon the tongue, and its gifts shall be as dust within thy grasp.',
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
