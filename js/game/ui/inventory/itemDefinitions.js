// inventory/itemDefinitions.js
import Item from './item.js';

// Define all item templates
export const ITEM_DEFS = {
  leather_armor: {
    id: 'leather_armor',
spriteKey: "item_leather_armor",
	  type: 'armor',
    subtype: 'chest',
    nameEn: 'Armor',
    nameGa: 'Caith éidigh',
	  descEn: 'Fenian armour, \neach piece a marvel, \nwrought with the skill of millenia.\nThe helm beareth the etchings of knot and beast,\nsymbols of strength and cunning,\nwarding all ill fortune. \nWithin it, my brow finds sanctuary,\nprotected from the swords of my foes.\nBehold these mighty pauldrons!\nThis cuirass, to encase my chest with impenetrable strength.\nA fortress for my heart. \nThese greaves! unyielding in their purpose.',
    descGa: 'Caith éidigh na fíanna, \ngach píosa mar shárshaothar, \nscil an aimsir óg.\nAgus ar an clogaid, scríobhadh snaimanna ainmhithe \n comhartha neart comhartha cleasacht,\ncosaint i gcoinne gach mí-ádh.\nAgus é orm, tagann faoiseamh ar mo éadan\ncosaint é i gcoinne claimhte naimheadach\nThar mo ghuailainn, pauldróin móra.\nSeo an lúireach, a cheilteann mo chliabh le neart dochloíte.\nDún dom croí. \nJambeau! daingean ina gcuspóir.`',
    stats: { defense: 3 },
    equipSlot: 'armor',
    color: 0x8B4513
  },

  simple_bow: {
    id: 'simple_bow',
    type: 'weapon',
    subtype: 'bow',
    nameEn: 'Bow',
    nameGa: 'Bogha',
    descEn: 'Behold the wooden bow! \nof yew-tree fair,\nCrafted by hands skilled in war\'s dire art,\nA weapon of old,\nof doom and destiny.',
    descGa: 'Féach an bogha adhmaid! \nd’iúr ghlan,\nceaptha ag lámh i ndán an chogaidh,\narm an tsean-aimsir,,\nde uafáis agus fáil.',
    stats: { attack: 4, range: 5 },
    equipSlot: 'rightHand',
    spriteKey: 'item_simple_bow',
    color: 0x8B4513
  },

  arrows: {
    id: 'arrows',
    type: 'ammunition',
    subtype: 'arrow',
    nameEn: 'Arrows',
    nameGa: 'Saigheada',
    descEn: 'Behold the arrow of the Gael!\na harbinger of woe,\nWith a tip that gleams like the morning star,\nA shaft crafted by the hand of the skilled,\nIts fletching the feathers of the raven,\nDark as the storm-clouds gathering o\'er the plains,\nA draught of sorrow for the clans.',
    descGa: 'Féach ar tsaighead na nGael!\ntuar bás, brón.\na ceann mar réalt an maidin,\nó láimh cheardaí oilte a ghas,\na cleite de chleiteacha an fhithich,\ndorchadas scamaill stoirm na machairí intí,\ndeoch bhróin do na treabh í.',
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
    descEn: 'Drink ye of this potion, \nand let it flow as the river through the valley, \nbringing strength and peace!  \nThe elixir restores vigor to limbs aching from the clash of swords. \nYet, the elixir demands a heart of pure intent and a soul open to the mysteries of the world. \nBeware! for those who seek with greed or malice, \nthe elixir shall turn bitter upon the tongue,\nand its gifts shall be as dust within thy grasp.',
    descGa: 'Chaith síar an deoch laigheas seo!\nLig di sreabhadh ionat mar shruth na habhann trí ghleann na mbeo, \nag iompar neart agus síochána. \nCuirfaidh si beatha nua i ngéaga atá cráite ag troid na gclaimhte. \nFainic éilíonn sé croí macánta agus anam oscailte do rúndiamhra an tsaoil. \nFainic go maith! Ól i gceart í gan saint ná mailís, \nnó beidh sí searbh, agus casfaidh a bheannacht ina mhallacht.',
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
