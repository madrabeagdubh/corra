// js/game/ui/inventory/itemDefinitions.js
import Item from './item.js';
import { TILES } from '../../../../data/oryx-tiles.js'
console.log('[itemDefs] TILES.BOW:', TILES?.BOW, 'TILES defined:', !!TILES)

/**
 * ITEM_DEFS
 * Slots 0-1: Hands (0=Right, 1=Left)
 * Slot 2: Armor
 * Slots 3-4: Accessories/Quivers
 * Slots 5-24: General Inventory
 *
 * itemGid: GID on oryx_16bit_fantasy_items_trans.png (from TILES constants)
 * spriteKey: fallback individual PNG texture key (legacy)
 */
export const ITEM_DEFS = {
  leather_armor: {
    id: 'leather_armor',
    spriteKey: 'item_leather_armor',
    itemGid: TILES.LEATHER_ARMOUR,          // 2564
    type: 'armor',
    subtype: 'chest',
    nameEn: 'Armor',
    nameGa: 'Caith éidigh',
    descEn: 'Fenian armour, \neach piece a marvel, \nwrought with the skill of millenia.\nThe helm beareth the etchings of knot and beast,\nsymbols of strength and cunning,\nwarding all ill fortune. \nWithin it, my brow finds sanctuary,\nprotected from the swords of my foes.\nBehold these mighty pauldrons!\nThis cuirass, to encase my chest with impenetrable strength.\nA fortress for my heart. \nThese greaves! unyielding in their purpose.',
    descGa: 'Caith éidigh na fíanna, \ngach píosa mar shárshaothar, \nscil an aimsir óg.\nAgus ar an clogaid, scríobhadh snaimanna ainmhithe \n comhartha neart comhartha cleasacht,\ncosaint i gcoinne gach mí-ádh.\nAgus é orm, tagann faoiseamh ar mo éadan\ncosaint é i gcoinne claimhte naimheadach\nThar mo ghuailainn, pauldróin móra.\nSeo an lúireach, a cheilteann mo chliabh le neart dochloíte.\nDún dom croí. \nJambeau! daingean ina gcuspóir.',
    stats: { defense: 3 },
    equipSlot: 'armor',
    allowedSlots: [2],
    actions: ['equip', 'drop', 'throw'],
    color: 0x8B4513
  },

  simple_bow: {
    id: 'simple_bow',
    spriteKey: 'item_simple_bow',
    itemGid: TILES.BOW,                      // 2482
    type: 'weapon',
    subtype: 'bow',
    nameEn: 'Bow',
    nameGa: 'Bogha',
    descEn: 'Behold the wooden bow! \nof yew-tree fair,\nCrafted by hands skilled in war\'s dire art,\nA weapon of old,\nof doom and destiny.',
    descGa: 'Féach an bogha adhmaid! \nd\'iúr ghlan,\nceaptha ag láimh i ndán an chogaidh,\narm an tsean-aimsir,\nde uafáis agus fáil.',
    stats: { attack: 4, range: 5 },
    equipSlot: 'rightHand',
    allowedSlots: [0],
    actions: ['equip', 'drop', 'throw'],
    color: 0x8B4513
  },

  arrows: {
    id: 'arrows',
    spriteKey: 'item_arrows',
    itemGid: TILES.QUIVER_ARROWS_WHITE,      // 2444
    type: 'ammunition',
    subtype: 'arrow',
    nameEn: 'Arrows',
    nameGa: 'Saigheada',
    descEn: 'Behold the arrow of the Gael!\na harbinger of woe,\nWith a tip that gleams like the morning star,\nA shaft crafted by the hand of the skilled,\nIts fletching the feathers of the raven,\nDark as the storm-clouds gathering o\'er the plains,\nA draught of sorrow for the clans.',
    descGa: 'Féach ar tsaighead na nGael!\ntuar bás, brón.\na ceann mar réalt an maidin,\nó láimh cheardaí oilte a ghas,\na cleite de chleiteacha an fhithich,\ndorchadas scamaill stoirm na machairí intí,\ndeoch bhróin do na treabh í.',
    stackable: true,
    maxStack: 30,
    quantity: 30,
    allowedSlots: [],
    actions: ['drop', 'throw'],
    color: 0xA0522D
  },

  healing_potion: {
    id: 'healing_potion',
    spriteKey: 'item_healing_potion',
    itemGid: TILES.MEDIUM_RED_POTION,        // 2284
    type: 'consumable',
    subtype: 'potion',
    nameEn: 'Healing Potion',
    nameGa: 'Deoch Leighis',
    descEn: 'Drink ye of this potion, \nand let it flow as the river through the valley, \nbringing strength and peace! \nThe elixir restores vigor to limbs aching from the clash of swords.',
    descGa: 'Chaith síar an deoch laigheas seo!\nLig di sreabhadh ionat mar shruth na habhann trí ghleann na mbeo, \nag iompar neart agus síochána.',
    stats: { healAmount: 20 },
    stackable: true,
    maxStack: 10,
    quantity: 1,
    allowedSlots: [],
    actions: ['drink', 'drop', 'throw'],
    color: 0xFF0000
  }
};

export function createItem(itemId, quantity = null) {
  const def = ITEM_DEFS[itemId];
  if (!def) {
    console.error(`Item definition not found: ${itemId}`);
    return null;
  }
  const itemData = JSON.parse(JSON.stringify(def));
  if (quantity !== null) itemData.quantity = quantity;
  return new Item(itemData);
}

export function createStartingInventory() {
  return [
    createItem('simple_bow'),      // Slot 0 — rightHand
    null,                           // Slot 1 — leftHand
    createItem('leather_armor'),   // Slot 2 — armor
    null,                           // Slot 3
    null,                           // Slot 4
    createItem('healing_potion'),  // Slot 5
    createItem('arrows', 30),      // Slot 6
  ];
}

