// b0.js -- village content: the people of the ráth.
// Location: public/data/bog/b0.js
//
// Mór (formerly the sole fixedEncounter here) has moved to
// public/data/village/villageHall.js -- she was always meant to be met
// inside the hall, not held at a placeholder spot out here (see her own
// header comment there for the full reasoning). fixedEncounters is empty
// until whoever/whatever replaces her out here is decided.

export const b0Content = {

  fixedEncounters: [
  ],

  // ── Background villagers ───────────────────────────────────────────────
  // Still plain npcs: flat cycling lines, no options. Fine for texture.
  npcs: [
    {
      id: 'cormac',
      name: 'Cormac',
      // Was (28,21) -- which became the hall's door tile exactly,
      // so the door badge won every frame and he could never be
      // spoken to. See the note on Mór above about door proximity
      // taking precedence. DOOR_RADIUS_TILES is 2.0.
      x: 24, y: 25,
      visual: { color: '0x8b5a2b', radius: 16 },
      dialogues: [
        { ga: 'Is fada ó tháinig aoi chugainn. Fáilte go dtí an ráth.',
          en: 'It is long since a guest came to us. Welcome to the ráth.' },
        { ga: 'Bhí an baile seo anseo roimh mo sheanathair féin.',
          en: 'This place was here before my own grandfather.' },
      ],
    },
    {
      id: 'niamh',
      name: 'Niamh',
      x: 23, y: 20,
      visual: { color: '0xd9a441', radius: 12 },
      dialogues: [
        // Worth knowing: this line already names the heron, months before
        // anyone planned it. If the player told Muireann they would go as
        // one, a gated variant of this would be the cheapest possible
        // payoff for invoked_heron.
        { ga: 'An bhfaca tú an corr éisc thíos ag an abhainn? Chonaic mise í!',
          en: 'Did you see the heron down at the river? I saw her!' },
        { ga: 'Deir Sadhbh go bhfuil na daoine maithe sa choill. Ná habair léi go ndúirt mé é.',
          en: 'Sadhbh says the good people are in the wood. Don\'t tell her I said it.' },
      ],
    },
  ],

  objects: [],
  introNarrative: [],
}

