// villageHall.js -- content for the chieftain's hall interior.
// Location: public/data/village/villageHall.js
//
// ============================================================================
// MÓR -- moved here from b0.js (the exterior ráth), where she was always
// meant to end up. See tools/dialogue/drafts/villageHall.dlg for the full
// history/reasoning.
// ============================================================================
//
// PLACEMENT/VISUAL ARE PLACEHOLDERS. villageHall.json's player spawn is
// (7,7); this puts her a few tiles further in, roughly where a hearth-side
// figure might stand, but I can't see the rendered room from here --
// reposition once you can see it in-game.
//
// PORTRAIT: still points at muireann.png, the same placeholder b0.js used
// for her (its own comment already flagged this as needing real art).
// Not a new problem, just carried over.

export const villageHallContent = {
  npcs: [],
  objects: [],
  introNarrative: [
    {
      ga: 'Tá an halla dorcha, agus beagnach folamh.',
      en: 'Dim is the hall, and near empty.'
    },
    {
      ga: 'Ní choinníonn ach tine bheag ina choinne dorchadais, agus a chloch fhuar.',
      en: 'Only a small fire holds against the dark, and its cold stone.'
    }
  ],

  fixedEncounters: [
    {
      id: 'mor',
      name: 'Mór',
      x: 7, y: 5,
      radius: 3,
      visual:   { gid: 255, flat: false },
      portrait: '/assets/npcs/muireann.png',

      dialogues: [

        // ── node 0 — arrival ──────────────────────────────────────
        {
          note: 'met_mor',
          hold: true,
          ga: 'Tar isteach as an bhfearthainn. Tá tú fliuch go craiceann.',
          en: 'Come in out of the rain. You are wet to the skin.',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              requires: { note: 'knows_muireann' },
              note: 'mor_knows_muireann',
              ga: 'Muireann a chuir anseo mé',
              en: 'Muireann sent me',
              say: 'Muireann a chuir anseo mé. An bhean ar an gcarraig ag béal na habhann.',
              sayEn: 'Muireann sent me. The woman on the rock at the mouth of the river.',
              replyGa: 'Á. Tá sí ar an gcarraig sin fós, mar sin. Suigh síos.',
              replyEn: 'Ah. She is still on that rock, so. Sit down.',
            },
            {
              requires: { noteAbsent: 'knows_muireann' },
              ga: 'Tá mé ag taisteal',
              en: 'I am travelling',
              say: 'Tá mé ag taisteal siar. Ní raibh mé anseo riamh cheana.',
              sayEn: 'I am travelling west. I have never been here before.',
              replyGa: 'Bíonn daoine ag dul siar. Suigh síos.',
              replyEn: 'People do be going west. Sit down.',
            },
            {
              first: true,
              ga: 'Cé tú féin?',
              en: 'Who are you?',
              replyGa: 'Mór. Is liomsa an teach seo -- nó is liom é nuair nach mbíonn an taoiseach ann, agus is annamh a bhíonn.',
              replyEn: 'Mór. This house is mine -- or it is mine when the chieftain is not in it, and he seldom is.',
            },
            {
              exit: true,
              silent: true,
              ga: 'Slán',
              en: 'Farewell',
            },
          ],
        },

        // ── node 1 — food ─────────────────────────────────────────
        {
          ga: 'Tá anraith ann, agus arán. Ith.',
          en: 'There is soup, and bread. Eat.',
          options: [
            {
              ga: 'Go raibh maith agat',
              en: 'Thank you',
              say: 'Go raibh maith agat. Ní raibh oiread agus sáil aráin agam le dhá lá.',
              sayEn: 'Thank you. I have not had so much as a heel of bread these two days.',
              replyGa: 'Ná habair é. Sin mar a bhíonn sé anseo.',
              replyEn: 'Do not mention it. That is how it is here.',
            },
            {
              ga: 'Cad atá le díol agam?',
              en: 'What do I owe?',
              say: 'Cad atá le díol agam? Oibreoidh mé ar a shon, más gá.',
              sayEn: 'What do I owe? I will work for it if needs be.',
              replyGa: 'Oibreoidh tú, an ea? I dteach s\'agamsa? Ith do chuid.',
              replyEn: 'You will work, is it? In my house? Eat your food.',
            },
            {
              exit: true,
              silent: true,
              ga: 'Ní anois',
              en: 'Not now',
            },
          ],
        },

        // ── node 2 — the fire, I ──────────────────────────────────
        {
          ga: 'An dtiocfaidh tú chun na tine?',
          en: 'Will you come to the fire?',
          options: [
            {
              ga: 'Tiocfaidh',
              en: 'I will come',
              say: 'Tiocfaidh mé chun na tine.',
              sayEn: 'I will come to the fire.',
            },
            {
              exit: true,
              silent: true,
              ga: 'Ní anois',
              en: 'Not now',
            },
          ],
        },

        // ── node 3 — the fire, II ─────────────────────────────────
        {
          ga: 'Tar, mar sin.',
          en: 'Come, then.',
          options: [
            {
              ga: 'Táim ag teacht',
              en: 'I am coming',
              say: 'Táim ag teacht.',
              sayEn: 'I am coming.',
            },
            {
              exit: true,
              silent: true,
              ga: 'Ní anois',
              en: 'Not now',
            },
          ],
        },

        // ── node 4 — the fire, III ────────────────────────────────
        {
          note: 'at_the_fire',
          ga: 'Feicim go bhfuil.',
          en: 'I see that you are.',
          options: [
            {
              ga: 'Ní gá é a insint',
              en: 'There is no need to narrate it',
              replyGa: 'Ha! Suigh síos, a stróinséir, agus bí i do thost.',
              replyEn: 'Ha! Sit down, stranger, and be quiet.',
            },
            {
              exit: true,
              silent: true,
              ga: 'Ní anois',
              en: 'Not now',
            },
          ],
        },

        // ── node 5 — the hub ──────────────────────────────────────
        {
          hold: true,
          ga: 'Tá an tine agat, agus do bholg lán. Ná bí ag corraí.',
          en: 'You have the fire, and your belly is full. Do not be stirring.',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              note: 'knows_seadna_coming',
              first: true,
              ga: 'An bhfuil scéal ann?',
              en: 'Is there news?',
              say: 'An bhfuil scéal ar bith sa teach seo?',
              sayEn: 'Is there any news in this house?',
              replyGa: 'Tá file againn le trí seachtaine. Beidh sé ag gabháil fhoinn anocht. Fan go gcloisfidh tú é.',
              replyEn: 'We have a poet these three weeks. He will be singing tonight. Wait until you hear him.',
            },
            {
              first: true,
              ga: 'Cé hé an taoiseach?',
              en: 'Who is the chieftain?',
              say: 'Cé hé an taoiseach anseo? Cé leis an talamh seo?',
              sayEn: 'Who is the chieftain here? Whose land is this?',
              replyGa: 'Fionnbarra. Bíonn sé sa halla níos mó anois ná mar a bhíodh.',
              replyEn: 'Fionnbarra. He is in the hall more now than he used to be.',
            },
            {
              requires: { note: 'met_briugu' },
              first: true,
              ga: 'Chonaic mé fear ar an mbóthar',
              en: 'I saw a man on the road',
              say: 'Chonaic mé fear ar an mbóthar, agus é ag imeacht soir. Ní déarfadh sé cad chuige.',
              sayEn: 'I saw a man on the road, going east. He would not say why.',
              replyGa: '...  Bhí teach aige. Ith do chuid anois.',
              replyEn: '...  He had a house. Eat your food now.',
            },
            {
              note: 'has_brat',
              completeQuest: 'q_baile',
              ga: 'Sílim go luífidh mé',
              en: 'I think I\'ll sleep',
              say: 'Sílim go bhfuil mo dhóthain agam den oíche seo. Luífidh mé, más é do thoil é.',
              sayEn: 'I have had enough of tonight, I think. I\'ll sleep, if I may.',
              replyGa: 'Seacht lá atá caite agat ar an abhainn sin, de réir do chuma.\nLig do do ghéaga. Níl tú san áit a raibh tú ag dul, ach tá tú slán.\nTá an tine te, agus tá boladh níos fearr ón bpota ná mar a fheictear air.\nSínítear brat trom thar do ghuaillí agus do shúile ag dúnadh.',
              replyEn: 'Seven days you\'ve been on that river, by the look of you.\nRest the limbs. You are not where you meant to be, but you are safe.\nThe fire is warm, and the pot smells better than it looks.\nSomeone drapes a heavy brat over your shoulders as your eyes close.',
            },
            {
              exit: true,
              silent: true,
              ga: 'Slán go fóill',
              en: 'Goodbye for now',
            },
          ],
        },

      ],
    },
  ],
}
