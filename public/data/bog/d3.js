// d3.js -- content for the first river map west of the estuary.
// Location: public/data/bog/d3.js
// Loaded by BogScene._loadContent() (map key 'd3' -> d3Content).
//
// ============================================================================
// BEAT 3 of the cold open: the road.
// ============================================================================
//
// The player has just had a conversation. If the next thing is another
// conversation, the game reads as a dialogue tree with scenery between the
// nodes. So this beat's job is PACING, and its one encounter is deliberately
// thin: Irish appears, the player understands it or taps the moon, and
// nothing depends on the answer. No branching, no consequence, no quest.
//
// It also establishes something Muireann cannot: an NPC who does NOT want to
// talk. She answers everything. He answers almost nothing. Getting that in
// early means the villagers' evasiveness later reads as character rather
// than as the game withholding.
//
// ---------------------------------------------------------------------------
// WHO HE IS (the player is told none of this)
// ---------------------------------------------------------------------------
// He is a briugu -- a hospitaller. Under the old law his whole standing was
// that his door was open and his table good; a briugu who turned a traveller
// away lost rank. Séadna made a poem about the meanness of his house. Nothing
// accusatory. Nothing anyone could object to openly. Now people stop
// somewhere else, and a briugu with no guests has no function at all.
//
// He is a PREVIOUS victim, not the man the player will watch being satirised
// tonight. That is the point: the player meets him, does not understand,
// sees a different man cut down that evening, and connects them later --
// ideally at the moment they realise this has happened before and will keep
// happening.
//
// He is also the counterweight to Mór, who the player meets an hour after
// this, doing the same job, warmly, while something is quietly eating the
// man who did it before her.
//
// He will not explain himself. A man ashamed of his own hospitality does not
// tell a stranger about it -- least of all a stranger he is not feeding.
//
// NOTES SET
//   met_briugu          -- saw him on the bank
//   briugu_would_not_say -- pressed him and got nothing
//
// Nothing reads these yet. Later they should: someone at the ráth recognising
// the description, and Muireann on a return visit.

export const d3Content = {
  npcs: [],
  objects: [],
  introNarrative: [],

  fixedEncounters: [
    {
      id: 'briugu',
      // Starting tile, inland and north-west -- the direction of the ráth.
      // He does not stay here; see `walk` below.
      x: 12, y: 5,
      radius: 3,

      // He is WALKING, and walking SOUTH-EAST: out of the village, down
      // toward the river, across the line the player is rowing. That is the
      // whole characterisation -- the first person met on this road is
      // leaving the place the player is going to.
      //
      // Path verified against the tile layer: (12,5)-(18,11) are grass,
      // (19,12) is the waterside strip where the bank meets the channel.
      // He stops there, at the water's edge, which is both where the player
      // can reach him and a reasonable place for a man on foot to halt.
      //
      // stepMs 1100 is a trudge. loop 'stop' means he stays at the last
      // tile: a dawdling player can still catch him, and he never absurdly
      // turns round and walks back toward the village.
      // startWhenNear: he holds at the top of the path until the player is
      // within 14 tiles, THEN sets off. Without it, an eight-tile walk at
      // 1100ms a tile finishes in under nine seconds -- less time than it
      // takes to row in from the map edge -- so the player only ever finds
      // him already arrived and standing still.
      walk: {
        path: [[12,5],[13,6],[14,7],[15,8],[16,9],[17,10],[18,11],[19,12]],
        stepMs: 1100,
        loop: 'stop',
        startWhenNear: 14,
      },

      // GID 9102 is registered to an image file by d3.js's create() (gid 473
      // was a stock Oryx tile that turned out to be a skull). Placeholder art
      // for now -- he is borrowing Muireann's image until he has his own.
      // Keep this GID in sync with BRIUGU_GID in the scene file.
      visual:   { gid: 9102, flat: false },
      portrait: '/assets/npcs/muireann.png',

      dialogues: [

        // ── 0. First sight ──────────────────────────────────────────────
        // He speaks first, and only because ignoring a passing boat would be
        // ruder than he is willing to be. Note the direction: everything
        // about him is leaving.
        {
          note: 'met_briugu',
          hold: true,
          ga: 'Beannacht. Tá tú ag dul siar, feicim.',
          en: 'Blessing. You are going west, I see.',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              // The obvious question, and the one he will not answer.
              ga: 'Agus tusa?', en: 'And you?',
              first: true,
              note: 'briugu_would_not_say',
              say:   'Agus tusa? Tá tú ag dul soir, agus gan bád agat.',
              sayEn: 'And you? You are going east, and you with no boat.',
              replyGa: 'Táim. Siúlfaidh mé.',
              replyEn: 'I am. I will walk.',
            },
            {
              // Pressing gets him no further. He is not being mysterious --
              // he simply will not say, and the difference should be
              // legible in how flatly he answers.
              ga: 'Cad as a bhfuil tú ag teacht?', en: 'Where are you coming from?',
              first: true,
              say:   'Cad as a bhfuil tú ag teacht? An ó na ráth thiar?',
              sayEn: 'Where are you coming from? From the ringfort west?',
              replyGa: 'Is ea.',
              replyEn: 'I am.',
            },
            {
              // The one line that is nearly an answer, and the player has no
              // way to read it yet. It should land as a shrug on the first
              // pass and as a wound on the second.
              ga: 'An bhfuil aon scéal ann?', en: 'Is there any news there?',
              first: true,
              say:   'An bhfuil aon scéal sa ráth? Bhfuil fáilte roimh strainséir?',
              sayEn: 'Is there news at the ringfort? Is a stranger welcome there?',
              replyGa: 'Tá fáilte ann. Bhí fáilte i m\'áitse freisin, tráth.',
              replyEn: 'There is a welcome there. There was a welcome in my place too, once.',
            },
            { ga: 'Slán', en: 'Farewell', exit: true, silent: true },
          ],
        },

        // ── 1. If the player comes back ─────────────────────────────────
        // He has not moved and will not be drawn. Kept short so that
        // re-approaching costs nothing and teaches that not every NPC is a
        // vending machine.
        {
          hold: true,
          ga: 'Táim ag imeacht. Ná coinnigh mé.',
          en: 'I am leaving. Do not keep me.',
          again: { ga: 'Fós anseo?', en: 'Still here?' },
        },

      ],
    },
  ],
}

