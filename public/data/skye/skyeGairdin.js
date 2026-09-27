// skyeGairdin.js
// Location: public/data/skye/skyeGairdin.js
//
// Uathach in her kata garden (js/game/scenes/locations/skye/skyeGairdin.js).
// Kata calls are captions; this is her conversation -- an idle line, and
// the sos (break) chats the scene unlocks every second kata.
//
// The dialogues array is generated from tools/dialogue/drafts/skyeGairdin.dlg

export const skyeGairdinContent = {
  objects: [],
  npcs:    [],
  fixedEncounters: [
    {
      id: 'uathach',
      // On the tier, north of the board, looking down on it.
      x: 18, y: 7,
      radius: 2,
      visual:   { gid: 9201, flat: false },
      portrait: '/assets/npcs/sorcha.png',
      dialogues: [

        // ── node 0 — idle, before the first break ─────────────────
        {
          requires: { noteAbsent: 'sos_1' },
          hold: true,
          ga: 'Seas sa lár nuair atá tú réidh.\nFan chomh fada agus is mian leat. Fill aon uair is mian leat.',
          en: 'Stand in the middle when you\'re ready.\nStay as long as you like. Come back whenever you like.',
        },

        // ── node 1 — sos: the feet first ──────────────────────────
        {
          requires: { note: 'sos_1', noteAbsent: 'sos_1_heard' },
          note: 'sos_1_heard',
          continue: true,
          ga: 'Lig do scíth nóiméad.\nTá gach rud eile tógtha ar na cosa.\nClaíomh, sleá, bogha: gan na cosa, níl iontu ach adhmad agus iarann.',
          en: 'Rest a moment.\nEverything else is built on the feet.\nSword, spear, bow: without the feet, they\'re only wood and iron.',
        },

        // ── node 2 — idle ─────────────────────────────────────────
        {
          requires: { noteAbsent: 'sos_2' },
          hold: true,
          ga: 'Arís, aon uair is mian leat.',
          en: 'Again, whenever you like.',
        },

        // ── node 3 — sos: the word and the foot ───────────────────
        {
          requires: { note: 'sos_2', noteAbsent: 'sos_2_heard' },
          note: 'sos_2_heard',
          continue: true,
          ga: 'Nuair a leanann na cosa an focal gan smaoineamh, bíonn an intinn saor.\nSin é an fáth a siúlaimid arís iad, agus arís eile.',
          en: 'When the feet follow the word without thinking, the mind is free.\nThat\'s why we walk them again, and again.',
        },

        // ── node 4 — idle ─────────────────────────────────────────
        {
          requires: { noteAbsent: 'sos_3' },
          hold: true,
          ga: 'Is cuma leis na clocha cé chomh minic a shiúlann tú orthu.',
          en: 'The stones don\'t mind how often you walk them.',
        },

        // ── node 5 — sos: older than the board ────────────────────
        {
          requires: { note: 'sos_3', noteAbsent: 'sos_3_heard' },
          note: 'sos_3_heard',
          continue: true,
          ga: 'Tá cuid de na patrúin seo níos sine ná an clár.\nTháinig siad anuas ón spéir, a deirtear.',
          en: 'Some of these patterns are older than the board.\nThey came down from the sky, they say.',
        },

        // ── node 6 — idle, for good ───────────────────────────────
        {
          hold: true,
          ga: 'Beidh na clocha anseo.',
          en: 'The stones will be here.',
        },

      ],
    },
  ],
}
