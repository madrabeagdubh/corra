// d3Sea.js -- content for the estuary map (mouth of the Boyne).
// Location: public/data/bog/d3Sea.js
//
// ============================================================================
// MUIREANN -- the cold open's one speaking part.
// ============================================================================
//

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

        // ── node 0 — the hail ─────────────────────────────────────
        {
          en: 'Who art thou that rows so bold\ntowards the Boyne\'s surging mouth?\nName thyself.',
          options: [
            {
              note: 'met_muireann',
              easca: 'playerName',
              en: 'Name yourself',
              sayEn: 'I am {playerName}.\nWind that carried me greet thee.',
              replyEn: 'Stone of the shore greet thee, {playerName}.\nI am Muireann.',
            },
            {
              note: 'withheld_name',
              en: 'Give no name',
              sayEn: 'No ill thing have I in mind. No man\'s kin, no man\'s kine.\nMy quarrel is with my own name, too small yet for any song.',
              replyEn: '[[ she lets it stand. she does not ask twice. ]]',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 1 — whose shore ──────────────────────────────────
        {
          en: '[[ short, or nothing. ]]',
          options: [
            {
              note: 'knows_fionnbarra',
              en: 'What chieftain\'s shore is this?',
              sayEn: 'What chieftain\'s shore is this?',
              replyEn: 'Thy little boat has reached the mouth of Bóinn the bright and winding.\nThis shore belongs first to her.\nFionnbarra mac Dubhloingse is Chief of this grey headland\nand of the three valleys that run north.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 2 — the chief ────────────────────────────────────
        {
          en: '[[ short. ]]',
          options: [
            {
              en: 'Who is Fionnbarra?',
              sayEn: 'What kind of man is Chief Fionnbarra?',
              replyEn: 'Fionnbarra is not an unjust man.\nHis hounds are many.\nBut his toll-man waits at the river with a face like an angry stone.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 3 — the toll-man ─────────────────────────────────
        {
          en: '[[ short. ]]',
          options: [
            {
              requires: { note: 'met_muireann' },
              note: 'has_druid_word',
              en: 'His toll-man?',
              sayEn: 'His toll-man?',
              replyEn: 'If Fionnbarra\'s toll-man should meet thee at the strand,\nthou art to say that Muireann the Druid knows thy name.',
            },
            {
              requires: { note: 'withheld_name' },
              en: 'His toll-man?',
              sayEn: 'His toll-man?',
              replyEn: 'Such is how he deals with men:\nwhom he robs not, he delays.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 4 — where art thou bound ─────────────────────────
        {
          en: 'And where now does the curragh turn its nose?',
          options: [
            {
              note: 'told_muireann_truth',
              en: 'Tell her plainly',
              sayEn: 'To the bog that drinks men whole, Allen\'s dark and sunken ground.\nThere the Fianna test their own. There I mean to prove my worth.',
              replyEn: '[[ she takes this in. no ceremony about it. ]]',
            },
            {
              note: 'evaded_muireann',
              en: 'Tell her less',
              exchange: [
                {
                  sayEn: 'Ask the heron of the fen. She will know my road.',
                  replyEn: 'Speak plainly. What business brings a stranger to these lands?',
                },
                {
                  sayEn: 'I cannot tell thee the name of the house before I have stood within it.',
                  replyEn: 'Some purpose drives thee, I think.',
                },
              ],
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 5 — she answers the plain answer ─────────────────
        {
          requires: { note: 'told_muireann_truth' },
          en: 'Thou hast mastered the spear?',
          options: [
            {
              en: 'Fionn will teach me',
              sayEn: 'Fionn I have heard of. Fionn the great one.\nFionn, they say, shall teach me more.',
              replyEn: 'Fionn keeps poetry before the sword.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 6 — she answers the careful answer ───────────────
        {
          requires: { note: 'evaded_muireann' },
          en: 'Where then art thou bound?',
          options: [
            {
              en: 'Say even less',
              sayEn: 'There is a thing that waits for finding, and it is not yet found.',
              replyEn: 'Go then. Go where thou art not going.\nArrive where thou art not bound.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 7 — the road ─────────────────────────────────────
        {
          en: '[[ short. ]]',
          options: [
            {
              note: 'knows_rath',
              en: 'Which way, then?',
              exchange: [
                {
                  sayEn: 'Which way, then?',
                  replyEn: 'Half a morning\'s walk northwest along the track. Thou canst not miss the ringfort.\nThou wilt find food, shelter, the hospitality of Fionnbarra.',
                },
                {
                  sayEn: 'And after?',
                  replyEn: 'That great dark place, with water the colour of old bronze.\nIt is not far. Two days west, two days south. Keep the hills to thy left hand.\nTravel well.',
                },
              ],
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 8 — the parting ──────────────────────────────────
        {
          en: 'Go not by night.\nAnd if thou hear the sound of pipes where no one stands,\nthou hast heard nothing. Walk on.\nMay the Boyne remember thy name to the sea.\nMay the sea speak thy name to the deep places.',
        },

      ],
    },
  ],
}


