// b0.js -- village content: the people of the ráth.
// Location: public/data/bog/b0.js
// Loaded by BogLocationScene._loadContent() as b0Content.
//
// Trimmed from an original six to three, repositioned for the current
// layout (longhall + tavern + one dwelling -- the smith/herbwoman/
// herdsman were anchored to buildings/features that no longer exist:
// multiple dwellings, the well, the pen). Positions sit just outside
// each NPC's own building, in front of RoundhouseRenderer's doorway
// notches. Dialogues array cycles one entry per conversation (progress
// persists via GameState under stateKey b0.<id>).

export const b0Content = {
  npcs: [
    {
      id: 'cormac',
      name: 'Cormac',
      // The elder, before the longhall's portico.
      x: 28, y: 21,
      visual: { color: '0x8b5a2b', radius: 16 },
      dialogues: [
        { ga: 'Is fada ó tháinig aoi chugainn. Fáilte go dtí an ráth.',
          en: 'It is long since a guest came to us. Welcome to the ráth.' },
        { ga: 'Bhí an baile seo anseo roimh mo sheanathair féin.',
          en: 'This place was here before my own grandfather.' },
      ],
    },
    {
      id: 'mor',
      name: 'Mór',
      // The alewife, at the tavern door.
      x: 36, y: 26,
      visual: { color: '0xb0413e', radius: 15 },
      dialogues: [
        { ga: 'Fáilte romhat, a stróinséir. Tá an teach seo te, agus tá ceol ann.',
          en: 'Welcome, stranger. This house is warm, and there is music in it.' },
        { ga: 'Suigh síos, agus lig do scíth.',
          en: 'Sit down, and take your rest.' },
      ],
    },
    {
      id: 'niamh',
      name: 'Niamh',
      // A child, loose in the fort.
      x: 23, y: 20,
      visual: { color: '0xd9a441', radius: 12 },
      dialogues: [
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


