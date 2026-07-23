// b0.js -- village content: the people of the ráth.
// Location: public/data/bog/b0.js
// Loaded by BogLocationScene._loadContent() as b0Content.
//
// Scaffold: six named villagers with starter bilingual lines. Each NPC's
// dialogues array cycles one entry per conversation (progress persists via
// GameState under stateKey b0.<id>). Replace / extend lines freely; the
// panel reads { ga, en } pairs. Positions sit just outside their house
// sites (see mapData.houses in b0.json) so they'll read as standing at
// their own doors once the RoundhouseRenderer lands.

export const b0Content = {
  npcs: [
    {
      id: 'cormac',
      name: 'Cormac',
      // The elder, before the great hall at the crown.
      x: 18, y: 12,
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
      // The alewife, at the tavern-house door.
      x: 22, y: 16,
      visual: { color: '0xb0413e', radius: 15 },
      dialogues: [
        { ga: 'Fáilte romhat, a stróinséir. Tá an teach seo te, agus tá ceol ann.',
          en: 'Welcome, stranger. This house is warm, and there is music in it.' },
        { ga: 'Suigh síos, agus lig do scíth.',
          en: 'Sit down, and take your rest.' },
      ],
    },
    {
      id: 'fiachra',
      name: 'Fiachra',
      // The smith, near the western dwellings.
      x: 14, y: 14,
      visual: { color: '0x4a4a52', radius: 15 },
      dialogues: [
        { ga: 'Ní dhéanaim ach obair mhaith. Iarann maith, lámha maithe.',
          en: 'I do only good work. Good iron, good hands.' },
      ],
    },
    {
      id: 'sadhbh',
      name: 'Sadhbh',
      // The herbwoman, by the well.
      x: 16, y: 19,
      visual: { color: '0x5a7d4a', radius: 14 },
      dialogues: [
        { ga: 'Tá leigheas sa mhóin, dá mbeadh a fhios agat cá bhfuil sé.',
          en: 'There is healing in the bog, if you knew where it lies.' },
        { ga: 'Ná bain an sceach aonair. Ná bain go deo í.',
          en: 'Do not cut the lone thorn tree. Never cut it.' },
      ],
    },
    {
      id: 'donn',
      name: 'Donn',
      // The herdsman, by the pen on the east side.
      x: 24, y: 18,
      visual: { color: '0x7a6a4f', radius: 15 },
      dialogues: [
        { ga: 'Fan amach ó na ba, le do thoil. Tá siad cantalach inniu.',
          en: 'Keep away from the cows, please. They are cranky today.' },
      ],
    },
    {
      id: 'niamh',
      name: 'Niamh',
      // A child, loose in the fort.
      x: 19, y: 17,
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

