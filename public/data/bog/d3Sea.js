// d3Sea.js -- content for the estuary map (mouth of the Boyne).
// Location: public/data/bog/d3Sea.js
//
// ============================================================================
// MUIREANN -- the cold open's one speaking part.
// ============================================================================
//
// The prologue has told the PLAYER they are the unnamed champion of a
// prophecy. Nobody in the world knows it, including their own character.
// Muireann sizing the hero up as one more spearman is therefore not her
// being unfair -- it is the audience watching someone fail to recognise the
// answer to a prophecy. Every dismissal in this scene plays as irony.
// NOTHING here may hint that she suspects. The moment an NPC says "there is
// something about you", the irony collapses into flattery.
//
// REGISTER: dry only. She is terse, unimpressed, and funny. The oracular
// voice -- the ford/gate/fire warning, Ruadhán, the Cúlchaint -- is held
// back entirely for a later meeting, because the register shift is itself
// the event, and it cannot land until the dry voice is established first.
//
// HER JOB, in order of importance:
//   1. orient   -- where am I, where do I go
//   2. calibrate-- NPCs talk, choices are safe, guessing costs nothing,
//                  Irish is on the screen and English is one tap away
//   3. activate -- go west to the ráth
// Everything else is flavour and must not delay those three.
//
// SHAPE -- three beats and a hub. Each beat asks ONE thing and moves on.
// Nothing loops until the hub, where looping is the point.
//
//   0  she hails you        An bhfuil tú ag rámhaíocht?   Tá / Níl / Manannán
//   1  she guesses at you   Fear Fianna atá ionat?        Is ea / Ní hea / heron
//   2  the road + q_baile   HUB: rest, the bog, who is there, what she watches
//   3  quest active         short nudge, road repeated on request
//   4  quest complete       permanent rumour post
//
// CONVENTIONS (all handled by EncounterPanel)
//   say / sayEn   the line the HERO speaks, shown above her answer in the
//                 speaker colour. DEFAULTS to the button's own text, so a
//                 question the player picks is spoken rather than vanishing
//                 with the button. Buttons stay short; the character speaks
//                 in full. Matters for the language mission: the button may
//                 be read in English, but the spoken line is always Irish.
//   silent: true  suppress the hero block entirely.
//   again         what she says on RETURN to a node already visited THIS
//                 conversation. Without it she re-delivers her whole hail
//                 every loop and re-asks answered questions.
//   first: true   option disappears after one use this conversation.
//   hold: false   this answer moves her on to the next beat.
//   exit: true    the player is done talking (distinct from hold).
//
// NOTES SET HERE, and who should eventually read them:
//   met_muireann        -- she exists
//   muireann_sass       -- the hero answers sideways. Colour only.
//   invoked_manannan    -- named the sea-god lightly at his own river mouth
//   said_fianna         -- declared for the Fianna
//   denied_fianna       -- would not declare
//   invoked_heron       -- named a wading bird instead of a spear. THE one
//                          that matters: it is the closing image of the
//                          hero's own opening verse, it is the game's title,
//                          and the prologue called the champion "a star
//                          whose name is not yet spoken". She almost sees
//                          it. She does not. She says: say that again
//                          sometime -- a promise the game should keep.
//   knows_muireann      -- has her name. Mór at the ráth should react.
//   knows_boyne         -- knows where they are
//   knows_road_west     -- has the road. Redundant with q_baile but cheap.
//
// The Irish is FUNCTIONAL PLACEHOLDER -- Ribo to replace. What is worth
// preserving structurally: Tá/Níl and Is ea/Ní hea as echo-answers taught
// one beat apart (different grammatical forms, deliberately not in the same
// breath); short buttons with fuller spoken lines; and the heron.

export const d3SeaContent = {
  npcs: [],
  objects: [],
  introNarrative: [],

  fixedEncounters: [
    {
      id: 'muireann',
      // PLACEMENT -- (13,1) is the crest of the north headland, h=1.44, the
      // highest tile in the column. (13,2) below it is gid 731 waterside --
      // the sloping face -- which is why she read as standing partway down
      // the cliff rather than on top of it.
      x: 13, y: 1,
      // RADIUS -- she is 17 rows north of the player's lane (row 18), so the
      // numbers are forced: 18 covers lane columns 8-18, 20 covers 21 tiles
      // of it. She is the first NPC in the game and being sailed past is the
      // worse failure. A lookout shouting down from a headland carries.
      //
      // The cleaner fix is a map edit: bring the lane north so she is 6-8
      // rows off it, then drop this to 8. Note entries.east has
      // yFromSource:true, so the arrival row is inherited from d3OpenSea's
      // exit, not set here.
      radius: 3,
      // yOffset nudges her up the hill, in billboard heights. The foot of a
      // billboard sits on the tile's SOUTH edge, which on a crest lands at
      // the break of slope rather than on top. Negative = higher.
      visual:   { gid: 9101, flat: false, yOffset: -0.18 },
      portrait: '/assets/npcs/muireann.png',

      dialogues: [

        // ── 0. She hails you ────────────────────────────────────────────
        // GRAMMAR, deliberate: 'An bhfuil tú...?' is the plain verbal
        // question, echoed with TÁ / NÍL. The fronted cleft 'Ag rámhaíocht
        // atá tú?' is a copula question and takes IS EA / NÍ HEA -- that
        // pair is taught one beat later, at her guess, where the copula is
        // the correct form anyway. Both are worth teaching. Not together.
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
              replyGa: 'Is maith an rámhaíocht í, ó chladach liath Sgitheanach. Ní beag an mhaíomh í.',
              replyEn: 'Well rowed, from the grey shore of Skye. That is no small boast.',
            },
            {
              // Ironic, not hostile. She takes it as the joke it is, and
              // answers in kind -- her first laugh matters more than her
              // first warning.
              ga: 'Níl', en: 'I am not',
              hold: false,
              note: 'muireann_sass',
              say:   'Níl. Ag foghlaim eitilte atáim, agus níl ag éirí go rómhaith liom.',
              sayEn: 'I am not. I am learning to fly, and it is not going well.',
              replyGa: 'Ha! Agus mise ag corraí na farraige, sula n-éiríonn sí bog.',
              replyEn: 'Ha! And I am stirring the sea, lest it grow soft.',
            },
            {
              // The one flick of seriousness in an otherwise dry beat. She
              // does not care for the sea-god named lightly at the mouth of
              // his own water. Two lines, then straight back to dry.
              ga: 'Dar Manannán!', en: 'By Manannán!',
              hold: false,
              note: 'invoked_manannan',
              say:   'Dar Manannán Mac Lir, tá! Ó dhubh go dubh.',
              sayEn: 'By Manannán Mac Lir, I am! From dark to dark.',
              replyGa: 'Fainic. Ná luaigh an t-ainm sin go héadrom ag béal na farraige.',
              replyEn: 'Careful. Do not name him lightly at the mouth of the sea.',
            },
            { ga: 'Slán', en: 'Farewell', exit: true, silent: true },
          ],
        },

        // ── 1. She guesses what you are ─────────────────────────────────
        // The copula question, so IS EA / NÍ HEA. Also the misreading beat.
        // She has decided what a young warrior rowing in from the sea is
        // for, and the player pushes back before they know what the game's
        // paths even are. Being misread is what makes someone define
        // themselves -- and the player, who watched the prologue, knows she
        // is wrong in a way she cannot suspect.
        {
          ga: 'Tá cuspóir éigin do do thiomáint, sílim. Fear Fianna atá ionat, is dócha. Ag triall ar Mhóin Almhain, mar a bhíonn siad go léir.',
          en: 'Some purpose drives you, I think. You are a Fianna man, I suppose. Bound for the Bog of Allen, as they all are.',
          options: [
            {
              ga: 'Is ea', en: 'I am',
              hold: false,
              note: 'said_fianna',
              say:   'Is ea. Tá mé chun mo chlaíomh a thairiscint do shlua Fhinn.',
              sayEn: 'I am. I mean to offer my sword to Fionn\'s hosting.',
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
              // THE beat. A young warrior rowing in to join the Fianna names
              // a WADING BIRD -- not a spear, not a battle-god. It is the
              // closing image of his own opening verse, it is the game's
              // title, and the prologue's druid called the coming champion
              // "a star whose name is not yet spoken". She almost sees it.
              // She does not. Her ellipsis is the whole scene.
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

        // ── 2. The road, and the hub ────────────────────────────────────
        // First loop in the conversation and the only one. `again` is what
        // stops her re-delivering the directions after every question.
        //
        // Note what is NOT here: Ruadhán, the ford/gate/fire warning, the
        // bard. All of it is held for a later meeting. In the cold open she
        // is dry, and the player leaves knowing how the game FEELS, not
        // what the story is.
        {
          hold: true,
          setQuest: 'q_baile',
          note: 'knows_boyne',
          // SHORT on purpose. A long card is skipped -- the eye drops to the
          // buttons. The road fits in one breath here; the fire and the full
          // bowl move into the option that asks for them.
          ga: 'Béal na Bóinne atá agat. Tá ráth siar suas an abhainn. Leathmhaidin siúil.',
          en: 'It is the mouth of the Boyne you have. There is a ringfort west up the river. Half a morning\'s walk.',
          again: {
            ga: 'Bhuel? An bhfuil tuilleadh uait?',
            en: 'Well? Do you want more?',
          },
          options: [
            {
              // Carries the warmth that used to be in her opening line.
              ga: 'Bia agus leaba?', en: 'Food and a bed?',
              first: true,
              say:   'Cá bhfaighidh mé suaimhneas agus bia anocht? Níl oiread agus sáil aráin fágtha agam.',
              sayEn: 'Where will I find rest and food tonight? I have not so much as a heel of bread left to me.',
              replyGa: 'Gheobhaidh tú tine ann, agus babhla lán, agus talamh tirim.',
              replyEn: 'You will find a fire there, and a full bowl, and dry ground.',
            },
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
              // The functional one. Deliberately plain: a player in a hurry
              // takes this and leaves, and loses nothing but colour.
              // Label names the ráth explicitly. 'Cé atá ann?' read as
              // "who are you?" once 'Cé tú féin?' had been used and
              // vanished, leaving it first in the list.
              ga: 'Cé atá sa ráth?', en: 'Who is at the ringfort?',
              note: 'knows_road_west',
              say:   'Cé atá sa ráth romham? Cé leis a labhróidh mé?',
              sayEn: 'Who is at the ringfort ahead of me? Who should I speak to?',
              replyGa: 'Mór ag an teach óil. Abair léi gur mise a chuir ann thú -- ní ar do shonsa a gheobhaidh tú leaba.',
              replyEn: 'Mór at the alehouse. Tell her it was I who sent you -- it is not for your sake you will get a bed.',
            },
            {
              // The bog. She undercuts the distance rather than dramatising
              // it: the warnings belong to a later conversation, and a cold
              // open should not front-load dread.
              ga: 'Móin Almhain', en: 'The Bog of Allen',
              first: true,
              say:   'Cén fhad atá sé, an portach seo? Dhá lá? Trí?',
              sayEn: 'How far is it, this bog? Two days? Three?',
              replyGa: 'Níl sé i bhfad. Níl sé rófhada. Ach fan ag Mór ar dtús -- tá aithne aicise ar na cosáin.',
              replyEn: 'It is not far. Not too far. But stop at Mór\'s first -- she knows the paths.',
            },
            {
              // She refuses. Distraction without portent, and a promise to
              // keep in chapter 3. Kept vague on purpose: no prophecy, no
              // riddle, just a woman who will not say.
              ga: 'Cad atá tú ag faire?', en: 'What are you watching for?',
              first: true,
              say:   'Tá tú ag breathnú ar an uisce, ní ormsa. Cad atá tú ag faire?',
              sayEn: 'You are looking at the water, not at me. What are you watching for?',
              replyGa: 'Ní dhéarfaidh mé. Ní bhaineann sé leat -- go fóill.',
              replyEn: 'I will not say. It does not concern you -- yet.',
            },
            { ga: 'Slán agat', en: 'Goodbye', exit: true, hold: false, silent: true },
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
              replyGa: 'Ar an mbruach thuaidh, siar suas an abhainn. Leathmhaidin siúil.',
              replyEn: 'On the north bank, west up the river. Half a morning\'s walk.',
            },
            {
              ga: 'Cé atá sa ráth?', en: 'Who is at the ringfort?',
              replyGa: 'Mór ag an teach óil. Abair léi gur mise a chuir ann thú.',
              replyEn: 'Mór at the alehouse. Tell her it was I who sent you.',
            },
            { ga: 'Slán agat', en: 'Goodbye', exit: true, silent: true },
          ],
        },

        // ── 4. Quest complete -- permanent post ─────────────────────────
        // Where the later conversation hangs off. When the player comes back
        // having seen the hall, THIS is the node that grows: gate new
        // options on notes picked up at the ráth (seadna_satire_heard,
        // ruadhan_judgements_strange, ...) and let her shift register.
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

