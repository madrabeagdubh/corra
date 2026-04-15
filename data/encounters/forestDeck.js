// Forest encounter deck
// Each card specifies its own visual via gid + flat flag.
// The deck manager draws a random subset each session.

export const forestDeck = [
  {
    id: 'enc_campfire',
    visual: { gid: 39, flat: false },
    ga: 'Tine bheag sa choill, fós te. D\'fhág duine éigin le déanaí í. Tá babhla cré lena taobh.',
    en: 'A small fire in the wood, still warm. Someone left it recently. A clay bowl sits beside it.'
  },
  {
    id: 'enc_crows',
    visual: { gid: 209, flat: false },
    ga: 'Trí phréachán ag féachaint ort ó chrann. Tá rud éigin lonrach i ngob ceann acu. Fanann siad socair.',
    en: 'Three crows watch you from a branch. One holds something shiny in its beak. They do not move.'
  },
  {
    id: 'enc_chest',
    visual: { gid: 255, flat: false },
    ga: 'Cófra beag adhmaid i measc na bhfréamhacha. Tá sé daingnithe le sreang leathair — ní le glas. Fós féin, ní osclaítear go héasca é.',
    en: 'A small wooden chest among the roots. Fastened with a leather cord — not a lock. Still, it does not open easily.'
  },
  {
    id: 'enc_page',
    visual: { gid: 469, flat: true },
    ga: 'Leathanach amháin, fliuch, leagtha ar chloch. Tá scríbhneoireacht air — Gaeilge, an-sean. Tá focal amháin soiléir: AIRE.',
    en: 'A single page, wet, laid on a stone. There is writing on it — Irish, very old. One word is clear: AIRE. Beware.'
  },
  {
    id: 'enc_skull',
    visual: { gid: 473, flat: true },
    ga: 'Cloigeann ainmhí mór ar an talamh. Ní hé aon ainmhí sa choill seo é. Tá sé glanta go néata — ní ag ainmhithe eile a rinneadh é sin.',
    en: 'A large animal skull on the ground. It is not from any animal in this wood. It has been cleaned neatly — not by other animals.'
  },
  {
    id: 'enc_cairn',
    visual: { gid: 412, flat: true },
    ga: 'Carn cloch sa chré. Tá sé níos sine ná an choill féin. Níl aon ainm, níl aon mharc. Ach tá bláth nua ar a bharr.',
    en: 'A cairn of stones in the earth. It is older than the wood itself. No name, no mark. But there is a fresh flower on top.'
  },
]
 
