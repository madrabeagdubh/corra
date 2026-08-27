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
          easca: 'playerName',
          eascaMatch: 'knows_own_name',
          continue: true,
          ga: 'Cé atá ag rámhaíocht go cróga\ni dtreo béal na Bóinne?',
          en: 'Who is it that is rowing bravely\ntowards the mouth of the Boyne?',
        },

        // ── node 1 — she answers, knowing the name ────────────────
        {
          requires: { note: 'knows_own_name' },
          continue: true,
          ga: 'Beannacht an chladaigh chugat, {playerVoc}.\nMuireann is ainm dom.',
          en: 'Blessing of the shore to you, {playerVoc}.\nMuireann is my name.',
        },

        // ── node 2 — she answers, not knowing the name ────────────
        {
          requires: { noteAbsent: 'knows_own_name' },
          continue: true,
          ga: 'Ab ea.\nMuireann is ainm dom.',
          en: 'Is that so.\nMuireann is my name.',
        },

        // ── node 3 — the hub ──────────────────────────────────────
        {
          hold: true,
          ga: 'Agus cá bhfuil do thriall?',
          en: 'And where are you bound?',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              requires: { noteAbsent: 'evaded_muireann' },
              note: 'told_muireann_truth',
              first: true,
              ga: 'Freagair go díreach',
              en: 'Answer plainly',
              say: 'Chun na móna ina gcailltear fir, chuig talamh báite Almhain.\nÁit a dtriailtear na Fianna.',
              sayEn: 'To the bog that drinks men whole, to Allen\'s sunken ground.\nWhere the Fianna test their own.',
              replyGa: 'Tá Móin Almhain feicthe agam.\nCé a chonaic riamh an rud a chonaic mé?\nChonaic mé na ceoite a bhrataíonn a croí,\nmo lean, is duairc an chuimhne í.\nAnsin, {playerVoc}, screadann taibhsí na ndaoine a ligeadh i ndearmad\nar dhíoltas sa chaorán is sa tsalachar.\nTá aibhisigh sa tír dhorcha sin\nnach ngéillfidh ach don gha,\nsáite le rún an uafáis.\nAn bhfuil oiliúint ar bith ort?',
              replyEn: 'I have seen the bog of Allen.\nWho ever saw what I have seen?\nI have seen the mists that shroud its heart,\nhow drear and mournful the memory.\nThere, {playerVoc}, the wraiths of the forgotten\ncry out for vengeance amidst the murk and the mire.\nThere are horrors in that dark country\nthat yield to nothing save the spear,\ndriven with dire intent.\nHast thou had any training at all?',
            },
            {
              requires: { noteAbsent: 'told_muireann_truth' },
              note: 'evaded_muireann',
              first: true,
              ga: 'Sraon',
              en: 'Parry',
              exchange: [
                {
                  say: 'Iarr ar chorr na móna. Is aici a bheidh mo scéal.',
                  sayEn: 'Ask the heron of the fen. She will know my story.',
                  replyGa: 'Freagair go díreach mé. Cén gnó a thóg chuig na tailte seo thú?',
                  replyEn: 'Speak plainly. What business brings a stranger to these lands?',
                },
                {
                  say: 'Ní mhíníonn an ghaoth í féin don ghallán.',
                  sayEn: 'The wind does not explain itself to the standing stone.',
                  replyGa: 'Tá rún i do chroí dod bhrú ar aghaidh, sílim.',
                  replyEn: 'Some purpose drives thee, I think.',
                },
              ],
            },
            {
              requires: { note: 'told_muireann_truth' },
              note: 'answered_muireann',
              first: true,
              ga: 'D\'fhoghlaim mé ó Scáthach',
              en: 'I trained beneath Scáthach',
              say: 'D\'fhoghlaim mé ó Scáthach, ar Oileán an Cheo.',
              sayEn: 'I trained beneath Scáthach of Skye.',
              replyGa: 'Scáthach.\nScáthach í féin.\nAgus chuir sí mar seo thú.\nA Scáthach, a iníon an uafáis agus barr feabhais,\nní thuigim do chúis.',
              replyEn: 'Scáthach.\nScáthach herself.\nAnd she sent thee thus.\nO Scáthach, daughter of excellence and terror,\nthy purpose is dark to me.',
            },
            {
              requires: { note: 'told_muireann_truth' },
              note: 'answered_muireann',
              first: true,
              ga: 'Cuirfidh Fionn faoi arm mé',
              en: 'Fionn will arm me',
              say: 'Níl ceann agam. Cuirfidh Fionn faoi arm mé nuair a sheasfaidh mé os a chomhair.',
              sayEn: 'I have none. Fionn will arm me when I stand before him.',
              replyGa: 'Is uaisle le Fionn an fhilíocht ná an tsleá.\nNí ga an chéad rud a iarrfaidh sé ort.',
              replyEn: 'Fionn keeps poetry before the blade.\nA spear is not the first thing he will ask of thee.',
            },
            {
              requires: { note: 'evaded_muireann' },
              note: 'answered_muireann',
              first: true,
              ga: 'Sraon arís',
              en: 'Parry again',
              say: 'Tá rud ag feitheamh orm nach bhfuil feicthe fós.',
              sayEn: 'There is a thing that waits, and it is not yet found.',
              replyGa: 'Imigh leat mar sin.\nTéigh san áit nach bhfuil tú ag dul.',
              replyEn: 'Go then.\nGo where thou art not going.',
            },
            {
              requires: { note: 'answered_muireann', noteAbsent: 'knows_goll' },
              note: 'knows_goll',
              ga: 'Cuir comhairle orm',
              en: 'Advise me',
              say: 'Cad atá le déanamh agam, mar sin?',
              sayEn: 'What am I to do, then?',
              replyGa: 'Ach éist liom anois, {playerVoc}.\nBeidh iarann uait sula mbeidh an mhóin thart leat.\nTéigh go dún Fhionnbarra.\nLorg a ghabha, Goll nach gcodlaíonn.\nInis dó cá bhfuil do thriall.\nBeidh a fhios aige cad atá le déanamh.',
              replyEn: 'But hear me now, {playerVoc}.\nThou wilt need iron before the bog is done with thee.\nGo to the dún of Fionnbarra.\nSeek out his smith, Goll who does not sleep.\nTell him where thou art bound.\nHe will know what is required.',
            },
            {
              requires: { note: 'answered_muireann', noteAbsent: 'knows_fionnbarra' },
              note: 'knows_fionnbarra',
              ga: 'Cá bhfuil mé?',
              en: 'Where am I?',
              say: 'Cé leis an trá seo?',
              sayEn: 'Whose shore is this?',
              replyGa: 'Tháinig do bháidín go béal na Bóinne ghlé ghroí.\nIs léi féin an trá seo ar dtús.\nIs é Fionnbarra mac Dubhloingse Taoiseach an ghleanna seo.',
              replyEn: 'Thy little boat has reached the mouth of Bóinn the bright and winding.\nThis shore belongs first to her.\nFionnbarra mac Dubhloingse is Chief of this valley.',
            },
            {
              requires: { note: 'knows_fionnbarra', noteAbsent: 'knows_of_tollman' },
              note: 'knows_of_tollman',
              ga: 'Fionnbarra?',
              en: 'Fionnbarra?',
              say: 'Cén cineál duine é Fionnbarra?',
              sayEn: 'What kind of man is Fionnbarra?',
              replyGa: 'Ní fear éagórach é Fionnbarra.\nIs iomaí cú atá aige.\nAch tá a fhear dola ag feitheamh ag an abhainn agus aghaidh mar charraig chrosta air.',
              replyEn: 'Fionnbarra is not an unjust man.\nHis hounds are many.\nBut his toll-man waits at the river with a face like an angry stone.',
            },
            {
              requires: { note: 'knows_of_tollman', noteAbsent: 'asked_hounds' },
              note: 'asked_hounds',
              ga: 'A chuid con?',
              en: 'His hounds?',
              say: 'Inis dom faoina chuid con.',
              sayEn: 'Tell me of his hounds.',
              replyGa: 'Brocán agus Dorchán,\nagus an ceann liath ar a dtugtar Scáthán.\nIs baolach an fhiosracht í.\nNá smaoinigh orthu,\nar eagla go gcloisfidís an smaoineamh i do chloigeann\nagus go dtiocfaidís ort sa dorchadas.',
              replyEn: 'Brocán and Dorchán,\nand the grey one they call Scáthán.\nIt is a dangerous curiosity.\nDo not think of them,\nlest they hear the thought in thy skull\nand come for thee in the darkness.',
            },
            {
              requires: { note: 'knows_own_name', noteAbsent: 'has_druid_word' },
              note: 'has_druid_word',
              ga: 'A fhear dola?',
              en: 'His toll-man?',
              say: 'A fhear dola?',
              sayEn: 'His toll-man?',
              replyGa: 'Mar seo a dhéanann sé gnó:\nan té nach ngoidfidh sé uaidh, cuirfidh sé moill air.\nMá chasann fear dola Fhionnbarra ort ar an gcladach,\nabair leis go bhfuil d\'ainm ag Muireann an Draoi.',
              replyEn: 'Such is how he does business:\nwhom he robs not, he delays.\nIf Fionnbarra\'s toll-man should meet thee at the strand,\nthou art to say that Muireann the Druid knows thy name.',
            },
            {
              requires: { note: 'knows_of_tollman', noteAbsent: 'knows_own_name' },
              ga: 'A fhear dola?',
              en: 'His toll-man?',
              say: 'A fhear dola?',
              sayEn: 'His toll-man?',
              replyGa: 'Mar seo a dhéanann sé gnó:\nan té nach ngoidfidh sé uaidh, cuirfidh sé moill air.',
              replyEn: 'Such is how he does business:\nwhom he robs not, he delays.',
            },
            {
              requires: { note: 'asked_hounds' },
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
                  replyGa: 'An áit mhór dhorcha sin, agus uisce uirthi ar dhath an tsean-chré-umha.\nNíl sé i bhfad. Dhá lá siar, dhá lá ó dheas. Coinnigh na cnoic ar do láimh chlé.\nNá téigh de shiúl oíche.\nAgus má chloiseann tú ceol na bpíob gan seinnteoir,\nníor chuala tú faic. Lean ort.\nGo n-éirí an bóthar leat.',
                  replyEn: 'That great dark place, with water the colour of old bronze.\nIt is not far. Two days west, two days south. Keep the hills to thy left hand.\nGo not by night.\nAnd if thou hear the sound of pipes where no one stands,\nthou hast heard nothing. Walk on.\nMay thy journey succeed.',
                },
              ],
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


