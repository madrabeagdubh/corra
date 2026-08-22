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

        // ── node 0 — the meeting ──────────────────────────────────
        {
          requires: { noteAbsent: 'met_muireann' },
          ga: 'Cé thú féin atá ag rámhíocht go cróga\ni dtreo béal na Bóinne?',
          en: 'Who art thou that rows so bold\ntowards the mouth of the Boyne?',
          options: [
            {
              note: 'met_muireann',
              easca: 'playerName',
              ga: 'Is mise...',
              en: 'I am...',
              say: 'Is mise {playerName}\nBeannacht na gaoithe ort.',
              sayEn: 'I am {playerName}\nBlessing of the wind to you.',
              replyGa: 'Beannacht an claddach ort, a {playerName}.\nMuireann is ainm dom.\nAgus cá bhfuil do thríal?',
              replyEn: 'Blessing of the shore to you, {playerName}.\nMuireann is my name.\nAnd where are you going?',
            },
            {
              note: 'withheld_name',
              ga: 'Ná tabhair ainm',
              en: 'Give no name',
              say: 'Is le m\'ainm féin mo chomhrac; níor thug beart de mo chuid brí dó.',
              sayEn: 'My quarrel is with my own name, no deed of mine has given it meaning.',
              replyGa: 'Ab ea.\nFreagair seo dom mar sin.\nAgus cá bhfuil do thríall?',
              replyEn: 'Is that so.\nThen answer me this instead.\nwhere are you going?',
            },
            {
              exit: true,
              silent: true,
              ga: 'fág',
              en: 'leave',
            },
          ],
        },

        // ── node 1 — the hub ──────────────────────────────────────
        {
          hold: true,
          ga: '...',
          en: '...',
          again: { ga: 'Agus?', en: 'And?' },
          options: [
            {
              requires: { noteAbsent: 'evaded_muireann' },
              note: 'told_muireann_truth',
              first: true,
              ga: 'Abair lei',
              en: 'Tell her',
              say: 'Chun na móna ina chailtear fir, chuig talamh báite Almhain.\nÁit a thriailfar na Fhian.',
              sayEn: 'To the bog that drinks men whole, to Allen\'s sunken ground.\nWhere the Fianna test their own.',
              replyGa: 'Cuirfidh an mhóin dúthlán ort.\nAn bhfuil an gha fhoghlamaíthe agat?',
              replyEn: 'The bog will challenge thee.\nHast thou mastered the spear?',
            },
            {
              requires: { noteAbsent: 'told_muireann_truth' },
              note: 'evaded_muireann',
              first: true,
              ga: 'Inis leath fhírinne',
              en: 'Tell half truth',
              exchange: [
                {
                  say: 'Íarr ar chorr na móna. Is aici a bheidh mo scéal.',
                  sayEn: 'Ask the heron of the fen. She will know my story.',
                  replyGa: 'Freagair go díreach mé. Cén gnó a thóg chuig na tailte seo thú?',
                  replyEn: 'Speak plainly. What business brings a stranger to these lands?',
                },
                {
                  say: 'Ní mhíníonn an ghaoth í féin don ghallán.',
                  sayEn: 'The wind does not explain itself to the standing stone.',
                  replyGa: 'Tá rún i do chroí dod brú ar aghaidh, sílim.',
                  replyEn: 'Some purpose drives thee, I think.',
                },
              ],
            },
            {
              requires: { note: 'told_muireann_truth' },
              first: true,
              ga: 'Foghlaimoidh mé ó Fhionn',
              en: 'I will learn from Fionn',
              say: 'Múinfidh Fionn dom an rud nach múineann an mhóin.',
              sayEn: 'Fionn will teach me what the bog does not.',
              replyGa: 'Tá aithne agam ar Fionn \\n an gaiscíoch mór.\nIs uaisle le Fionn an fhilíocht ná an slea.',
              replyEn: 'I know Fionn. Fionn the great one.\nFionn keeps poetry before the blade.',
            },
            {
              requires: { note: 'evaded_muireann' },
              first: true,
              ga: 'Ná habair murán',
              en: 'Say little',
              say: 'Tá rud ag feitheamh orm, nach bhfuil feicthe fós.',
              sayEn: 'There is a thing that waits, and it is not yet found.',
              replyGa: 'Imigh leat mar sin.',
              replyEn: 'Go then.',
            },
            {
              requires: { noteAbsent: 'knows_fionnbarra' },
              note: 'knows_fionnbarra',
              ga: 'Cá bhfuil mé?',
              en: 'Where am I?',
              say: 'Cé leis an trá seo?',
              sayEn: 'Whose shore is this?',
              replyGa: 'Tháinig do bháidín go béal na Bóinne ghlé ghroí.\nIs léisí an trá seo ar dtús.\nIs é Fionnbarra mac Dubhloingse Taoiseach an gleann seo.',
              replyEn: 'Thy little boat has reached the mouth of Bóinn the bright and winding.\nThis shore belongs first to her.\nFionnbarra mac Dubhloingse is Chief of this valley',
            },
            {
              requires: { note: 'knows_fionnbarra', noteAbsent: 'knows_of_tollman' },
              note: 'knows_of_tollman',
              ga: 'Fionnbarra?',
              en: 'Fionnbarra?',
              say: 'Cén cineál duine é Fionnbarra?',
              sayEn: 'What kind of man is Fionnbarra?',
              replyGa: 'Ní fear héagórach é Fionnbarra.\nIs iomaí cú atá aige.\nAch tá a fhear cána ag feitheamh ag an abhainn agus aghaidh mar carraig crosta aige.',
              replyEn: 'Fionnbarra is not an unjust man.\nHis hounds are many.\nBut his toll-man waits at the river and his face like an angry stone.',
            },
            {
              requires: { note: 'knows_of_tollman', noteAbsent: 'asked_hounds' },
              note: 'asked_hounds',
              ga: 'A chuid con?',
              en: 'His hounds?',
              say: 'Inis dom faoina madraí.',
              sayEn: 'Tell me of his hounds.',
              replyGa: 'Brocán agus Dorchán,\nagus an ceann liath ar a dtugtar Scáthán.\nIs baolach an fhiosracht é.\nNá smaoinigh orthu,\nar eagla go gcloisfidís an smaoineamh i do chloigeann\nagus go dtiocfaidís ort sa dorchadas.',
              replyEn: 'Brocán and Dorchán,\nand the grey one they call Scáthán.\nIt is a dangerous curiosity.\nDo not think of them,\nlest they hear the thought in thy skull\nand come for thee in the darkness.',
            },
            {
              requires: { note: 'knows_of_tollman', noteAbsent: 'withheld_name' },
              note: 'has_druid_word',
              ga: 'A fhear cána?',
              en: 'His toll-man?',
              say: 'A fhear cána?',
              sayEn: 'His toll-man?',
              replyGa: 'Mar seo a dhéanann sé gnó:\nan té nach ngoidfidh sé uaidh, cuirfidh sé moill air.\nMá chasann fear cána Fhionnbarra ort ar an gcladach,\nabair leis go bhfuil d\'ainm ag Muireann an Draoi.',
              replyEn: 'Such is how he does business:\nwhom he robs not, he delays.\nIf Fionnbarra\'s toll-man should meet thee at the strand,\nthou art to say that Muireann the Druid knows thy name.',
            },
            {
              requires: { note: 'knows_of_tollman', noteAbsent: 'met_muireann' },
              ga: 'A fhear cána?',
              en: 'His toll-man?',
              say: 'A fhear cána?',
              sayEn: 'His toll-man?',
              replyGa: 'Mar seo a dhéanann sé gnó:\nan té nach ngoidfidh sé uaidh, cuirfidh sé moill air.',
              replyEn: 'Such is how he does business:\nwhom he robs not, he delays.',
            },
            {
              note: 'knows_rath',
              ga: 'Cén treo?',
              en: 'Which way?',
              exchange: [
                {
                  say: 'Cén treo, mar sin?',
                  sayEn: 'Which way, then?',
                  replyGa: 'Siúil siar ó thuaidh feadh an bhealaigh leath na maidine. Feicfidh tú an ráth.\nGheobhaidh tú bia, dídean, agus fáilte Fhionnbarra ann.',
                  replyEn: 'Half a morning\'s walk northwest along the track. Thou wilt see the ringfort.\nThou wilt find food, shelter, the hospitality of Fionnbarra.',
                },
                {
                  say: 'Agus ina dhiaidh sin?',
                  sayEn: 'And after?',
                  replyGa: 'An áit mhór dhorcha sin, agus uisce uirthi ar dhath an tsean-chré-umha.\nNíl sé i bhfad. Dhá lá siar, dhá lá ó dheas. Coinnigh na cnoic ar do láimh chlé.\nNá téigh is d\'oíche.\nAgus má chloiseann tú ceol na bpíob gan seinnteoir,\nníor chuala tú faic. Lean ort.\nGo n-éirí an bóthar leat.',
                  replyEn: 'That great dark place, with water the colour of old bronze.\nIt is not far. Two days west, two days south. Keep the hills to thy left hand.\nGo not by night.\nAnd if thou hear the sound of pipes where no one stands,\nthou hast heard nothing. Walk on.\nMay thy journey succeed.',
                },
              ],
            },
            {
              exit: true,
              silent: true,
              ga: 'Fág',
              en: 'Row on',
            },
          ],
        },

      ],
    },
  ],
}


