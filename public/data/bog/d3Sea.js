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
          en: 'Who art thou that rows so bold\ntowards the Boyne\'s wide, bitter mouth?',
          options: [
            {
              note: 'met_muireann',
              en: 'Return her greeting',
              sayEn: 'Wind that carried me greet thee.',
              replyEn: 'Stone of the shore greet thee.',
            },
            {
              note: 'met_muireann',
              en: 'Say nothing',
              sayEn: '[[ the player says nothing, or something graceless ]]',
              replyEn: '[[ she notes it. not offended — a druid is not offended by a stranger\'s ignorance — but something has been learned about him. ]]',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 1 — the name ─────────────────────────────────────
        {
          en: '[[ short. she is waiting. ]]',
          options: [
            {
              note: 'gave_name',
              easca: 'playerName',
              en: 'Give your name',
              sayEn: '[[ she is asking; the keyboard opens and the player types it ]]',
              replyEn: '[[ she repeats it back — once, plainly, without comment ]] {playerName}',
            },
            {
              note: 'withheld_name',
              en: 'Refuse it',
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

        // ── node 2 — whose shore ──────────────────────────────────
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

        // ── node 3 — the chief ────────────────────────────────────
        {
          en: '[[ short. ]]',
          options: [
            {
              en: 'What kind of man is Fionnbarra?',
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

        // ── node 4 — the toll-man ─────────────────────────────────
        {
          en: '[[ short. ]]',
          options: [
            {
              requires: { note: 'gave_name' },
              note: 'has_druid_word',
              en: 'His toll-man?',
              sayEn: 'His toll-man?',
              replyEn: 'If Fionnbarra\'s toll-man should meet thee at the strand,\nthou art to say that Muireann the Druid knows thy name.',
            },
            {
              requires: { note: 'withheld_name' },
              en: 'His toll-man?',
              sayEn: 'His toll-man?',
              replyEn: 'I would send a word with thee for him.\n[[ but the word is that I know thy name, and I do not. ]]\n[[ she does not press. she has already declined to ask twice. ]]',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 5 — where art thou bound ─────────────────────────
        {
          en: 'And where now does the curragh turn its nose?\nWhat draws thee south along this shore?',
          options: [
            {
              note: 'told_muireann_truth',
              en: 'Tell her plainly',
              sayEn: 'From the grey isle that lies where sky meets the cold sea-wind.\nLong the crossing, hard the oar.\nTo the bog that drinks men whole, Allen\'s dark and sunken ground.\nThere the Fianna test their own. There I mean to prove my worth.',
              replyEn: '[[ she takes this in. no ceremony about it. ]]',
            },
            {
              note: 'evaded_muireann',
              en: 'Tell her less',
              exchange: [
                {
                  sayEn: 'Ask the heron of the fen. He will know my road before me.',
                  replyEn: 'Speak plain. What business brings a stranger to these lands?',
                },
                {
                  sayEn: 'I have come from where the hound lost the scent\nand the hawk lost the wind beneath her wing.\nFrom where the fire was, that is not now burning.\nThe sea is a poor keeper of roads.',
                  replyEn: 'So. So.\nThou art careful in thy answer.',
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

        // ── node 6 — she answers the plain answer ─────────────────
        {
          requires: { note: 'told_muireann_truth' },
          en: '[[ short. ]]',
          options: [
            {
              en: 'Fionn will teach me',
              sayEn: 'Fionn I have heard of. Fionn the great one.\nFionn, they say, shall teach me more.',
              replyEn: 'Fionn keeps poetry before the sword.\n[[ said flatly, as a fact about Fionn rather than as advice — it should be possible to miss entirely. ]]',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 7 — she answers the careful answer ───────────────
        {
          requires: { note: 'evaded_muireann' },
          en: 'Where then art thou bound?',
          options: [
            {
              en: 'Say even less',
              sayEn: 'There is a thing that waits for finding, and it is not yet found.\nI cannot tell thee the name of the house before I have stood within it.',
              replyEn: 'Go then. Go where thou art not going.\nArrive where thou art not bound.\n[[ she is amused rather than obstructed. this is a form she knows. ]]',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 8 — the road ─────────────────────────────────────
        {
          en: 'Some purpose drives thee, I think.',
          options: [
            {
              note: 'knows_rath',
              en: 'Which way, then?',
              exchange: [
                {
                  sayEn: 'Which way, then?',
                  replyEn: 'Half a morning\'s walk northwest along the track. Thou canst not miss the ringfort.\nThou wilt find a fire, a full bowl, and dry ground there.',
                },
                {
                  sayEn: 'And after?',
                  replyEn: 'That great dark place, with its waters the colour of old bronze.\nIt is not far. Two days west, two days south. Keep the hills to thy left hand.\nTravel well.',
                },
              ],
            },
            {
              exit: true,
              en: 'Slán agat',
              sayEn: '[[ the parting. ]]',
              replyEn: 'Go not by night.\nAnd if thou hear the sound of pipes where no man stands,\nthou hast heard nothing. Walk on.\nMay the Boyne remember thy name to the sea.\nMay the sea speak thy name to the deep places.',
            },
          ],
        },

      ],
    },
  ],
}


