// d3Sea.js -- content for the estuary map (mouth of the Boyne).
// Location: public/data/bog/d3Sea.js
//
// Muireann: a druid keeping watch on the river mouth. First speaking NPC.
// Her job is to orient the player, calibrate them (this is what talking to
// people is like; Irish is safe; guessing costs nothing), and activate them
// (go west). Everything else is flavour and must not delay those three.
//
// SHAPE -- three beats and a hub. Each beat asks ONE thing and moves on.
// Nothing loops until beat 3, where looping is the point.
//
//   0  she hails you            An bhfuil tú ag rámhaíocht?   Tá / Níl
//   1  she guesses what you are Fear Fianna atá ionat?        Is ea / Ní hea
//   2  she gives the road       + quest q_baile               (hub: free questions)
//   3  quest active             short nudge + repeat the road
//   4  quest complete           permanent rumour post
//
// The greeting-duel is GONE. It was a good gag in the wrong place: five
// rungs of formula before the player knows where they are. The two moments
// worth keeping from it survive as single exchanges -- Manannán at beat 0
// (she does not care for the sea-god named lightly at his own river mouth)
// and the heron at beat 1.
//
// CONVENTIONS
//   say / sayEn   the line the HERO speaks, shown above her answer in the
//                 speaker colour. Buttons stay short; the character speaks
//                 in full. A player running high English opacity still sees
//                 their own character speaking Irish.
//   again         what she says on RETURN to a node already visited this
//                 conversation. Without it she re-delivers her whole hail
//                 every loop and keeps re-asking answered questions.
//   first: true   option disappears after one use this conversation.
//   hold: false   this answer moves her on to the next beat.
//   exit: true    the player is done talking (different from hold).
//
// The Irish is FUNCTIONAL PLACEHOLDER -- Ribo to replace.

export const d3SeaContent = {
  npcs: [],
  objects: [],
  introNarrative: [],

  fixedEncounters: [
    {
      id: 'muireann',
      x: 13, y: 1,          // north headland, on the crest above the channel
      radius: 6,            // hailed from the water -- no need to land
      visual: { gid: 9101, flat: false },

      dialogues: [

        // ── 0. She hails you ────────────────────────────────────────────
        // GRAMMAR: 'An bhfuil tú...?' is the plain verbal question, echoed
        // with TÁ / NÍL. (The fronted cleft 'Ag rámhaíocht atá tú?' is a
        // copula question and takes IS EA / NÍ HEA -- that pair is taught
        // one beat later, at her guess, where the copula is correct anyway.
        // Both are worth teaching; not in the same breath.)
        {
          requires: { questAbsent: 'q_baile' },
          note: 'met_muireann',
          ga: 'Hóra thíos! An bhfuil tú ag rámhaíocht?',
          en: 'Hey down there! Are you rowing?',
          options: [
            {
              ga: 'Tá', en: 'I am',
              hold: false,
              say:   'Tá. Ó mhaidin. Tá mo dhroim á rá liom.',
              sayEn: 'I am. Since morning. My back is telling me so.',
              replyGa: 'Feicim sin. Tá tú fada ó bhaile, cibé áit as ar tháinig tú.',
              replyEn: 'I can see that. You are far from home, wherever you came from.',
            },
            {
              // Ironic, not hostile. She takes it as the joke it is.
              ga: 'Níl', en: 'I am not',
              hold: false,
              note: 'muireann_sass',
              say:   'Níl. Ag foghlaim eitilte atáim, agus níl ag éirí go rómhaith liom.',
              sayEn: 'I am not. I am learning to fly, and it is not going well.',
              replyGa: 'Ha! Is fada ó chuala mé freagra mar sin.',
              replyEn: 'Ha! It is long since I heard an answer like that.',
            },
            {
              // The one moment of seriousness. She does not care for the
              // sea-god named lightly at the mouth of his own water.
              ga: 'Dar Manannán, tá!', en: 'By Manannán, I am!',
              hold: false,
              note: 'invoked_manannan',
              say:   'Dar Manannán Mac Lir, tá! Ó dhubh go dubh.',
              sayEn: 'By Manannán Mac Lir, I am! From dark to dark.',
              replyGa: 'Fainic. Ná luaigh an t-ainm sin go héadrom ag béal na farraige.',
              replyEn: 'Careful. Do not name him lightly at the mouth of the sea.',
            },
            { ga: 'Slán', en: 'Farewell', exit: true },
          ],
        },

        // ── 1. She guesses what you are ─────────────────────────────────
        // The copula question, so IS EA / NÍ HEA. Also the misreading beat:
        // she has decided what a young warrior rowing in from the sea is
        // for, and the player gets to push back before they know what the
        // game's paths even are. Being misread is what makes someone
        // define themselves.
        {
          ga: 'Fear Fianna atá ionat, is dócha. Ag triall ar Mhóin Almhain, mar a bhíonn siad go léir.',
          en: 'You are a Fianna man, I suppose. Bound for the Bog of Allen, as they all are.',
          options: [
            {
              ga: 'Is ea', en: 'I am',
              hold: false,
              note: 'said_fianna',
              say:   'Is ea. Tá mé ag dul faoi na trialacha.',
              sayEn: 'I am. I am going to face the trials.',
              replyGa: 'Bhí a fhios agam. Sibhse go léir, agus sibh ag ceapadh gurb í an tsleá an freagra ar gach ceist.',
              replyEn: 'I knew it. The lot of you, thinking the spear is the answer to every question.',
            },
            {
              ga: 'Ní hea', en: 'I am not',
              hold: false,
              note: 'denied_fianna',
              say:   'Ní hea. Nó, ní hea go fóill. Níl a fhios agam fós cad atá romham.',
              sayEn: 'I am not. Or -- not yet. I do not yet know what is ahead of me.',
              replyGa: 'Hm. Freagra macánta. Ní chloisim mórán díobh sin ach oiread.',
              replyEn: 'Hm. An honest answer. I do not hear many of those either.',
            },
            {
              // The heron. A young warrior rowing in to join the Fianna
              // names a WADING BIRD -- not a spear, not a battle-god. It is
              // the closing image of his own opening verse (Rachfaidh mé mar
              // chorra réisc) and it is the game's title. She has already
              // decided what he is. This says otherwise. She does not remark
              // on it. She just looks at him properly.
              ga: 'Mar chorr réisc', en: 'As a heron',
              hold: false,
              note: 'invoked_heron',
              say:   'Rachaidh mé mar chorra réisc. Ciúin agus ar aire.',
              sayEn: 'I shall go as the heron. Quiet and alert.',
              replyGa: '...  Abair sin arís uair éigin.',
              replyEn: '...  Say that again sometime.',
            },
          ],
        },

        // ── 2. She gives the road -- and becomes a hub ───────────────────
        // First real loop in the conversation, and the only one. `again` is
        // what stops her re-delivering the directions after every question.
        {
          hold: true,
          setQuest: 'q_baile',
          note: 'knows_boyne',
          ga: 'Béal na Bóinne atá agat. Tá ráth ar an mbruach thuaidh, suas an abhainn siar. Gabh siar agus gheobhaidh tú é.',
          en: 'It is the mouth of the Boyne you have. There is a ringfort on the north bank, upriver to the west. Go west and you will find it.',
          again: {
            ga: 'Bhuel? An bhfuil tuilleadh uait?',
            en: 'Well? Do you want more?',
          },
          options: [
            {
              ga: 'Cé tú féin?', en: 'Who are you?',
              first: true,
              note: 'knows_muireann',
              say:   'Agus cé tú féin, a bhean na carraige?',
              sayEn: 'And who are you yourself, woman of the rock?',
              replyGa: 'Muireann. Coimeádaim súil ar bhéal na habhann.',
              replyEn: 'Muireann. I keep watch on the mouth of the river.',
            },
            {
              ga: 'Cén fhad?', en: 'How far?',
              replyGa: 'Lá amháin ag rámhaíocht, ar a mhéad. Ní fada.',
              replyEn: 'One day rowing, at most. It is not far.',
            },
            {
              ga: 'Cé atá ann?', en: 'Who is there?',
              replyGa: 'Cormac an seanóir, agus Mór ag an teach óil. Abair leo gur mise a chuir ann thú.',
              replyEn: 'Cormac the elder, and Mór at the alehouse. Tell them it was I who sent you.',
            },
            {
              // She refuses. Distraction without portent -- a promise to
              // keep in chapter 3.
              ga: 'Cad atá tú ag faire?', en: 'What are you watching for?',
              first: true,
              say:   'Tá tú ag breathnú ar an uisce, ní ormsa. Cad atá tú ag faire?',
              sayEn: 'You are looking at the water, not at me. What are you watching for?',
              replyGa: 'Ní dhéarfaidh mé. Ní bhaineann sé leat -- go fóill.',
              replyEn: 'I will not say. It does not concern you -- yet.',
            },
            { ga: 'Slán agat', en: 'Goodbye', exit: true, hold: false },
          ],
        },

        // ── 3. Quest active ─────────────────────────────────────────────
        {
          requires: { questActive: 'q_baile' },
          hold: true,
          ga: 'An bhfuil tú anseo fós? Siar leat.',
          en: 'Are you still here? Away west with you.',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              ga: 'Cá bhfuil an ráth?', en: 'Where is the ringfort?',
              replyGa: 'Ar an mbruach thuaidh, suas an abhainn siar. Lá amháin ag rámhaíocht.',
              replyEn: 'On the north bank, upriver to the west. One day rowing.',
            },
            {
              ga: 'Cé atá ann?', en: 'Who is there?',
              replyGa: 'Cormac an seanóir, agus Mór ag an teach óil.',
              replyEn: 'Cormac the elder, and Mór at the alehouse.',
            },
            { ga: 'Slán agat', en: 'Goodbye', exit: true },
          ],
        },

        // ── 4. Quest complete -- permanent rumour post ──────────────────
        {
          requires: { questComplete: 'q_baile' },
          hold: true,
          ga: 'Chonaic tú an ráth, mar sin. Tar ar ais chugam má bhíonn scéala uait.',
          en: 'So you saw the ringfort. Come back to me if you want news.',
          again: { ga: 'Bhuel?', en: 'Well?' },
        },

      ],
    },
  ],
}

