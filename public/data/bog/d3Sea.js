// d3Sea.js -- content for the estuary map (mouth of the Boyne).
// Location: public/data/bog/d3Sea.js
// Loaded by BogScene._loadContent() as d3SeaContent (getMapKey 'd3_sea'
// -> _contentKey 'd3Sea').
//
// Muireann: the watcher on the south headland. She is the player's first
// speaking NPC and the first point of the quest system. Her job is to
// teach the player that NPCs can be talked to, that questions have
// answers, and to send them upriver to b0 -- where the tavern, the bard
// and the harp already live.
//
// She holds her position permanently (hold: true on every node), so she
// stays available as a clue/rumour source for later mini-quests. Her
// state advances only through `requires` gates, not through cycling.
//
// Quest: q_baile  -- reach the ringfort. Completed on entry to b0.
// Notes: met_muireann, knows_muireann, knows_boyne

export const d3SeaContent = {
  npcs: [],
  objects: [],
  introNarrative: [],

  fixedEncounters: [
    {
      id: 'muireann',
      // The summit of the north promontory: heightMap 1.615, the highest
      // grass on the map (only the waterside tile at 19,0 is fractionally
      // higher). Her billboard draws on PGR's object canvas, which sits above
      // the ground canvas, so she was never occluded by the cliff -- she just
      // projected to a screen position inside the grey face. Standing at the
      // true summit puts her against the sky instead.
      // d3Sea sets hasNorthFallback() false, so row 0 has no preview geometry
      // to collide with.
      x: 17, y: 0,
      // Hailed from the water: 8 tiles, not the default 1. The player is in
      // the boat and should never have to land to talk to her; the summit is
      // further back from the channel than the crest was.
      radius: 8,
      // GID 9101 is registered to /assets/muireann.png by d3Sea.js's create()
      // via perspectiveGround.registerCustomTile(). Keep the two in sync.
      visual: { gid: 9101, flat: false },

      dialogues: [

        // ── 0. First contact ────────────────────────────────────────────
        {
          requires: { questAbsent: 'q_baile' },
          hold: true,
          note: 'met_muireann',
          ga: 'Hóra thíos! Ag rámhaíocht atá tú? Is fada ó chonaic mé bád ag teacht aníos an inbhear.',
          en: 'Hey down there! Is it rowing you are? It is long since I saw a boat coming up the estuary.',
          // No option here is marked `exit`, so EncounterPanel appends a
          // default "Slán." button. Mark one of your own `exit: true` if you
          // want different wording.
          options: [
            {
              ga: 'Cé tú féin?',
              en: 'Who are you?',
              note: 'knows_muireann',
              replyGa: 'Muireann is ainm dom. Coimeádaim súil ar bhéal na habhann.',
              replyEn: 'Muireann is my name. I keep watch on the mouth of the river.',
            },
            {
              ga: 'Cá bhfuil mé?',
              en: 'Where am I?',
              note: 'knows_boyne',
              replyGa: 'Béal na Bóinne. Tá an fharraige taobh thiar díot. Téann an abhainn siar.',
              replyEn: 'The mouth of the Boyne. The sea is behind you. The river goes west.',
            },
            {
              // The one option that moves the story. Advances to node 1.
              ga: 'Cá bhfuil daoine le fáil?',
              en: 'Where can people be found?',
              hold: false,
              setQuest: 'q_baile',
              replyGa: 'Tá ráth ar an mbruach thuaidh, suas an abhainn siar. Gabh siar agus gheobhaidh tú é.',
              replyEn: 'There is a ringfort on the north bank, upriver to the west. Go west and you will find it.',
            },
          ],
        },

        // ── 1. Quest active ─────────────────────────────────────────────
        {
          requires: { questActive: 'q_baile' },
          hold: true,
          ga: 'An bhfuil tú anseo fós? Siar leat. Tá an ráth ar an mbruach thuaidh.',
          en: 'Are you still here? Away west with you. The ringfort is on the north bank.',
          options: [
            {
              ga: 'Cén fhad é?',
              en: 'How far is it?',
              replyGa: 'Níl sé i bhfad. Lá amháin ag rámhaíocht, ar a mhéad.',
              replyEn: 'It is not far. One day rowing, at most.',
            },
            {
              ga: 'Cé atá ann?',
              en: 'Who is there?',
              replyGa: 'Cormac an seanóir, agus Mór ag an teach óil. Abair leo gur mise a chuir ann thú.',
              replyEn: 'Cormac the elder, and Mór at the alehouse. Tell them it was I who sent you.',
            },
            { ga: 'Slán agat.', en: 'Goodbye.', exit: true },
          ],
        },

        // ── 2. Quest complete -- permanent rumour post ──────────────────
        {
          requires: { questComplete: 'q_baile' },
          hold: true,
          ga: 'Chonaic tú an ráth, mar sin. Tar ar ais chugam má bhíonn scéala uait. Feicim gach rud ón gcarraig seo.',
          en: 'So you saw the ringfort. Come back to me if you want news. I see everything from this rock.',
        },

      ],
    },
  ],
}

