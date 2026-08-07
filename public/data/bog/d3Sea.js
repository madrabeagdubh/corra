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

        // ── node 0 ────────────────────────────────────────────────
        {
          requires: { questAbsent: 'q_baile' },
          note: 'met_muireann',
          en: 'May the stone of the shore greet you, man of the sea.\nMay the current that guided you here honour you.',
          again: { ga: 'Bhuel? Labhair.', en: 'Well? Speak.' },
          options: [
            {
              note: 'gave_greeting',
              en: 'May the wind greet you',
              sayEn: 'May the wind that carried me greet you.\nMay the sea that bore me greet you.',
              replyEn: 'What the sea has brought us,\nlet the land receive well.\nWhat the sea has carried,\nthe land may trust.',
            },
            {
              en: 'Who are you?',
              sayEn: 'Who are you, woman of the stones,\nwho speaks to me so?',
              replyEn: 'One who is here.\nOne who watches.\nThat is all the answer you get yet, and it is enough.',
            },
            {
              exit: true,
              silent: true,
              en: 'Farewell',
            },
          ],
        },

        // ── node 1 ────────────────────────────────────────────────
        {
          en: 'From where were you blown to us?\nIt is a long road for your little boat\nfrom wherever it was built, I think.',
          again: { ga: 'Bhuel? Cad as?', en: 'Well? From where?' },
          options: [
            {
              note: 'answered_plain',
              en: 'From Skye',
              sayEn: 'From the grey shore of Skye I have come.\nLong rowing,\nand the sea rising every day of it.',
              replyEn: 'That is no small thing.\nYour back is telling you so, I expect,\nand it will not stop telling you tonight or tomorrow.',
            },
            {
              note: 'answered_careful',
              en: 'From where the hound lost the scent',
              sayEn: 'From where the hound lost the scent\nand the hawk lost the wind beneath her wing.\nFrom where the fire was that is not now burning.',
              replyEn: 'So, so.\nThat is a careful answer.\nYou would not be so careful were there no reason for it.',
            },
            {
              exit: true,
              silent: true,
              en: 'Farewell',
            },
          ],
        },

        // ── node 2 ────────────────────────────────────────────────
        {
          requires: { noteAbsent: 'knows_boyne' },
          en: 'Attend to me now.\nYou have beached your little boat\nat the mouth of Bóinn the bright and winding,\nand this shore belongs to her before anyone.',
          options: [
            {
              en: 'Whose shore is it, then?',
              sayEn: 'Whose shore is it I have been blown upon, then?',
              replyEn: 'It belongs first and last to Bóinn.\nDo not forget that while you are drinking from the river.',
            },
            {
              exit: true,
              silent: true,
              en: 'Farewell',
            },
          ],
        },

        // ── node 3 ────────────────────────────────────────────────
        {
          note: 'knows_boyne',
          setQuest: 'q_baile',
          hold: true,
          en: 'As for the chieftain:\nyou have put your prow upon the shore of Fionnbarra mac Dubhloingse,\nchieftain of this grey headland\nand of the three valleys that run from it like fingers from a hand.',
          again: { ga: 'Bhuel? An bhfuil tuilleadh uait?', en: 'Well? Do you want more?' },
          options: [
            {
              first: true,
              en: 'What kind of man is he?',
              sayEn: 'What kind of man is this Fionnbarra?',
              replyEn: 'A hand often raised in anger,\nand raised as often in welcome.\nA man of temper and of patience in the one body,\nand his hounds are many.',
            },
            {
              first: true,
              en: 'Is he a just man?',
              sayEn: 'Is he a just man,\nthis man whose land I am walking?',
              replyEn: 'He is not unjust,\nand that is more than I would say for every one of his line.\nHis grandfather\'s grandfather gave oaths to the Tuatha\nthat were not entirely kept,\nand they gave in return a curse upon his cattle\nthat was not entirely lifted.\nThe milk of this place has tasted of broken promises ever since --\nor of the wild garlic in the lower pastures, depending who you ask.',
            },
            {
              note: 'knows_road_west',
              en: 'Where is the ringfort?',
              sayEn: 'Where is the ringfort from here? The day is going.',
              replyEn: 'Half a morning\'s walk northwest along the track.\nYou will not miss it.\nYou will find a fire there, and a full bowl, and dry ground.',
            },
            {
              note: 'knows_muireann',
              first: true,
              en: 'Who are you?',
              sayEn: 'And who are you yourself, woman of the rock,\nwatching the water?',
              replyEn: 'Muireann.\nI keep watch on the mouth of the river, as my mother did before me.\nTell Mór at the ringfort it was I who sent you.',
            },
            {
              exit: true,
              silent: true,
              en: 'Farewell',
            },
          ],
        },

        // ── node 4 ────────────────────────────────────────────────
        {
          hold: true,
          en: 'The toll-man will meet you at the river ford,\nfor the ravens have already carried word of your coming,\nand he is a man who rises early to meet opportunity.',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              note: 'has_druid_word',
              first: true,
              en: 'What will I say to him?',
              sayEn: 'And what will I say to that man\nwhen he stands in front of me?',
              replyEn: 'Say to him that the Druid of the Cliff-Mouth knows your name.\nYou need say no more than that.\nAnd say no more.',
            },
            {
              first: true,
              en: 'What kind of man is he?',
              sayEn: 'What kind of man is this toll-man?',
              replyEn: 'He has a face like a stone that has been disappointed.\nHe is not a loveable man and does not wish to be.\nA chieftain needs such a man all the same.',
            },
            {
              exit: true,
              silent: true,
              en: 'Farewell',
            },
          ],
        },

        // ── node 5 ────────────────────────────────────────────────
        {
          requires: { note: 'answered_careful' },
          hold: true,
          en: 'One more thing, since you are a careful sort.\nFionnbarra has a brother,\nand I will not shout his name from a clifftop\nas a fool shouts the name of a wolf into a dark wood.',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              note: 'knows_cathan',
              first: true,
              en: 'A brother?',
              sayEn: 'A brother? What name is on him, and what is his portion?',
              replyEn: 'Cathán.\nHe holds the southern wood, and three fishing-rights on the tributary,\nand an opinion of himself that would shame the sun for brightness.',
            },
            {
              first: true,
              en: 'And if I meet him?',
              sayEn: 'If I meet him at a ford or a gate or a fire,\nwhat should I do?',
              replyEn: 'Do not look at what is shown to you.\nThat which speaks may not be him,\nand that which smiles is not his smile.\nKnow the man by what he will not do.',
            },
            {
              first: true,
              en: 'What is the danger?',
              sayEn: 'What danger is in it for me, and I going west?',
              replyEn: 'Thin enough.\nAs thin as first ice on the stream,\nas thin as smoke on a summer wind.\nGo your road and miss his road.',
            },
            {
              exit: true,
              silent: true,
              en: 'Farewell',
            },
          ],
        },

        // ── node 6 ────────────────────────────────────────────────
        {
          requires: { questActive: 'q_baile' },
          en: 'May the Boyne remember your name to the sea.\nMay the sea speak your name to the deep places.\nMay the deep places hold you,\nneither too long nor too short.',
          again: { ga: 'Siar leat.', en: 'Away west with you.' },
        },

        // ── node 7 ────────────────────────────────────────────────
        {
          requires: { questComplete: 'q_baile' },
          hold: true,
          en: 'So you saw the ringfort.\nCome back to me if you want news.',
          again: { ga: 'Bhuel?', en: 'Well?' },
        },

      ],
    },
  ],
}


