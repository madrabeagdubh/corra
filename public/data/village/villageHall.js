// villageHall.js -- content for the chieftain's hall interior.
// Location: public/data/village/villageHall.js
//
// ============================================================================
// The reachtaire (household steward) -- first speaking part inside the hall.
// ============================================================================
//
// PLACEMENT/VISUAL ARE PLACEHOLDERS. villageHall.json's player spawn is
// (7,7); this puts her a few tiles further in, roughly where a hearth-side
// greeter might stand, but I can't see the rendered room from here --
// reposition once you can see it in-game.
//
// PORTRAIT: no art exists for her yet. The other two files sitting in
// /assets/npcs/ (sorcha.png, fearghus.png) turned out to be champion
// select portraits reused from champions.js, not spare NPC art -- using
// either here would make an unrelated background character look identical
// to a hero a player might have picked for themselves. Needs real art (or
// a temporary stand-in of your choosing) before this ships; the path
// below is a placeholder that will 404 until then.

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
      id: 'reachtaire',
      x: 7, y: 5,
      radius: 3,
      visual:   { gid: 255, flat: false },
      portrait: '/assets/npcs/reachtaire.png',

      dialogues: [

        // ── node 0 — the greeting ─────────────────────────────────
        {
          continue: true,
          ga: 'Á, ceann eile, séidte isteach ón abhainn.\nBhuel. Tar chun na tine. Ní iarrann an nós faic ar aoi,\nmar sin ní iarrfaidh mise faic ort -- go fóill.',
          en: 'Ah -- another one, blown in off the river.\nWell. Come to the fire. Custom asks nothing of a guest,\nso I\'ll ask nothing either -- for now.',
        },

        // ── node 1 — the hearth ───────────────────────────────────
        {
          hold: true,
          ga: 'Suigh, más féidir le do chosa é.\nIs beag an chuideachta atá anseo anocht le do shuí a thabhairt faoi deara.',
          en: 'Sit, if the legs will let you.\nThere\'s little enough company here tonight to mind you sitting.',
          again: { ga: 'Suigh nuair is mian leat.', en: 'Sit when you\'re ready.' },
          options: [
            {
              requires: { noteAbsent: 'knows_orlaith' },
              note: 'knows_orlaith',
              ga: 'Cé thusa?',
              en: 'Who are you?',
              say: 'Cé thusa?',
              sayEn: 'Who are you?',
              replyGa: 'Órlaith, reachtaire an tí seo.\nCoinním é nuair nach ndéanann sé féin -- rud, le déanaí, is mó ná a mhalairt.',
              replyEn: 'Órlaith, reachtaire of this house.\nI keep it when himself does not -- which, of late, is most nights.',
            },
            {
              requires: { noteAbsent: 'heard_hall_is_quiet' },
              note: 'heard_hall_is_quiet',
              ga: 'Cá bhfuil chuile dhuine?',
              en: 'Where is everyone?',
              say: 'Cá bhfuil chuile dhuine?',
              sayEn: 'Where is everyone?',
              replyGa: 'Tháinig scéal searbh romhat.\nCoinníonn daoine lena dteallach féin go nglanann an t-aer.',
              replyEn: 'Sour word came ahead of you.\nFolk keep to their own hearths till the air clears.',
            },
            {
              requires: { noteAbsent: 'knows_fionnbarra_absent' },
              note: 'knows_fionnbarra_absent',
              ga: 'An bhfuil an Taoiseach anseo?',
              en: 'Is the chieftain here?',
              say: 'An bhfuil an Taoiseach anseo?',
              sayEn: 'Is the chieftain here?',
              replyGa: 'Níl.\nNá ní bheidh, anocht.',
              replyEn: 'He is not.\nNor will he be, tonight.',
            },
            {
              note: 'has_brat',
              completeQuest: 'q_baile',
              ga: 'Lig do scíth cois na tine',
              en: 'Rest by the fire',
              say: 'Ligfidh mé mo scíth, más é do thoil é.',
              sayEn: 'I\'ll rest, if I may.',
              replyGa: 'Seacht lá atá caite agat ar an abhainn sin, de réir do chuma.\nLig do do ghéaga. Níl tú san áit a raibh tú ag dul, ach tá tú slán.\nTá an tine te, agus tá boladh níos fearr ón bpota ná mar a fheictear air.\nSínítear brat trom thar do ghuaillí agus do shúile ag dúnadh.',
              replyEn: 'Seven days you\'ve been on that river, by the look of you.\nRest the limbs. You\'re not where you meant to be, but you\'re safe.\nThe fire is warm, and the pot smells better than it looks.\nSomeone drapes a heavy brat over your shoulders as your eyes close.',
            },
            {
              exit: true,
              silent: true,
              ga: 'Fág',
              en: 'Leave',
            },
          ],
        },

      ],
    },
  ],
}
