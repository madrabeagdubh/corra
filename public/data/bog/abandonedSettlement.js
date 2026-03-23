// Content for abandoned_settlement — An Ráth Báite
// The Sunken Rath
// Edit here freely without touching map geometry

export const abandonedSettlementContent = {

  introNarrative: [
    {
      ga: 'Seo áit a bhí ann, agus nach bhfuil ann níos mó, agus fós nach dtabharfaidh í féin go hiomlán suas don dearmad.',
      en: 'Here is a place that was, and is no more, and yet will not fully yield itself to forgetting.',
    },
    {
      ga: 'Tá na ballaí ag lúbadh isteach mar fhear ag fáil bháis ag lúbadh ar a bhata, mall agus gan leigheas. Tá an portach tar éis na leaca urláir a thógáil ceann ar cheann, foighneach mar chreidiúnaí.',
      en: 'The walls lean inward as a dying man leans upon his staff, slow and without remedy. The bog has taken the floor stones one by one, patient as a creditor.',
    },
    {
      ga: 'Briseadh an doras. Seasann ríchathaoir ar leataobh san uisce. Luíonn leabhar séalaithe in aghaidh gach fiosrúcháin.\n\nSílim go bhfuil ceisteanna ann nár cruthaíodh fear lena bhfreagairt, agus is áit dóibh an áit seo.',
      en: 'The door was broken. A throne stands tilted in the wet. A book lies sealed against all inquiry.\n\nI think there are questions a man was not made to answer, and this is a place of them.',
    },
  ],

  objects: [
    {
      id: 'broken_door',
      type: 'examine',
      x: 15, y: 13,
      note: 'saw_broken_door',
      text: {
        ga: 'Seo an doras, nó cad a bhí mar dhoras. Smashed, agus ní go réidh, mar a bhriseann adhmad nuair nach dtagann fir isteach ach chun a dhearbhú go bhfuil deireadh le teacht isteach.\n\nTá an bioránach iarainn fós ina áit sa fhráma lofa — dílis thar gach réasún, thar gach úsáid. Tháinig rud éigin tríd an tairsigh seo le fearg, nó díbríodh rud éigin as, agus ní suíonn ceachtar den dá fhírinne go héadrom ar an gcroí.',
        en: 'Here is the door, or what the door was. Smashed, and not gently, as timber is smashed when men come not to enter but to declare that entering is finished.\n\nThe iron pin of it yet holds its place in the rotted frame, faithful past all reason, past all use. Something came through this threshold in anger, or something was driven from it, and neither truth sits lightly on the heart.',
      },
    },
    {
      id: 'throne',
      type: 'examine',
      x: 23, y: 21,
      note: 'saw_throne',
      text: {
        ga: 'Taobh istigh seasann an chathaoir a ghearr siad do rí, nó don té ar thug sé rí air féin — ard-dhroimeach, dubh le taise go leor séasúr. Phóg an portach í mar a phógann sé gach rud anseo, le béal fuar an tseilbhe. Tá sí ag claontú ar thaobh amháin anois. Ní shuíonn aon fhear agus é ag claontú mar sin ach i gcloch dheiridh a nirt.\n\nCúig rí b\'fhéidir a shuigh sa chathaoir sin agus ní bheadh a fhios agam a n-ainmneacha. Cúig chéad guth b\'fhéidir a líon na ballaí seo leis an argóint agus an gháire agus an bhróin a líonann gach balla áit a mbíonn daoine, agus ní fhanann siolla amháin liom.',
        en: 'Within stands the chair they cut for a king, or for one who called himself such, high-backed and black with the damp of many seasons. The bog has kissed it as it kisses all things here, with the cold mouth of possession. It lists to one side now. No man sits and leans thus save in the last hour of his strength.\n\nFive kings might have sat in that chair and I would not know their names. Five hundred voices might have filled these walls with the argument and the laughter and the grief that fills all walls where people have their being, and not a syllable remains to me.',
      },
    },
    {
      id: 'dark_book',
      type: 'examine',
      x: 14, y: 10,
      note: 'saw_dark_book',
      text: {
        ga: 'Agus ar shuíochán na cathrach — oscailte don bháisteach agus do scriosadh mall na mblianta — leabhar. Chomh dubh leis an gcathaoir fúithi, chomh dubh leis an uisce ag ardú ag a himill. Ní iompróidh na leathanaigh. Tá siad thar iompú. Tá an méid a bhí scríofa ann pósta leis féin anois, séalaithe mar a shéalaítear fear sa talamh, thar gach léitheoireacht.\n\nCad a bhí ann? Dlí? Fáistine? An cuntas cúramach ar fhiachais agus ar ghearáin — cuimhne fhada teaghlaigh nach ligfeadh dá gcuid fiacha dul i ndearmad?\n\nNó rud eile. Rud a bhí ag iarraidh doras iata idir é féin agus an domhan beo.\n\nFanann mé gan bogadh.',
        en: 'And on the seat of it, open to the rain and the slow ruin of years, a book. Black as the chair beneath it, black as the water rising at its margins. The pages do not turn. They are past turning. What was written there is wedded to itself now, sealed as a man is sealed in the earth, beyond all reading.\n\nWhat was it? Law? Prophecy? The careful reckoning of debts and grievances, the long memory of a family that would not forget what was owed?\n\nOr something else.',
      },
    },
    {
      id: 'well',
      type: 'examine',
      x: 20, y: 18,
      text: {
        ga: 'Tobar tirim. Ach tá rud éigin ann nach uisce é.\n\nMacalla gan ghuth. Nó anáil — an-chúng, an-réidh — an cineál anála a dhéanann rud atá ag fanacht le tamall fada.\n\nNíl mé chun féachaint níos faide isteach ann.',
        en: 'A dry well. But there is something in it that is not water.\n\nAn echo without a voice. Or breath — very slow, very even — the kind a thing makes when it has been waiting a long time.\n\nI am not going to look further into it.',
      },
    },
  ],

  npcs: [
    {
      id: 'bean_si_silent',
      name: '?',
      x: 16, y: 16,
      visual: { shape: 'circle', radius: 16, color: '0xccccff' },
      dialogues: [
        {
          // Visit 1 — she only looks. Before the player knows anything.
          ga: '(D\'éirigh sí as an uisce dubh mar a d\'éiríonn an ghealach thar Chnoc Áine, agus ní fhéadfainn — Dia a shábháil m\'anam bocht — mo chosa a iompú uaithi, cé go raibh gach ribe ar mo mhuineál ina sheasamh díreach mar luachra san aer.)\n\n(Tá a súile mar uisce domhain nach bhfuil bun leis. Seasann sí. Féachann sí. Ní deir sí aon rud.)',
          en: '(She rose from the black water as the moon rises over Cnoc Áine, and I — God save my wretched soul — could not turn my feet from her, though every hair upon my neck stood straight as rushes in the wind.)\n\n(Her eyes are the blue of deep water that has no bottom to it. She stands. She looks. She says nothing.)',
        },
        {
          // Visit 2 — after the player has touched the dark book
          ga: '"A scoláire," ar sise — agus ba mhilse a glór ná an smólach ar a chrann féin, aye, agus ba uafásaí, mar a bhíonn rud milís agus uafásach araon nuair a thagann sé chugat thar fhad mór blianta — "iomprann tú rud nach leatsa le hiompar."',
          en: '"Scholar," said she — and her voice was more sweet than the thrush upon its own green tree, aye, and more terrible, the way a thing may be both sweet and terrible when it comes to you across a great distance of years — "you carry what was never yours to carry."',
        },
        {
          // Visit 3 — the lord's story
          ga: '"Bhí sé ina thiarna anseo," ar sise, "nuair a bhí an áit seo ina coróin de thine agus de chomhluadar. Céad anam ag ithe ag a bhord. Céad guth ag cur lúcháire ina chuid rachta.\n\nGo dtugadh Dia gur fhan sé sásta leis an méid a thug an talamh maith dó go fial. Go dtugadh Dia gur lig sé don eolas ina chodladh fanacht ina chodladh."',
          en: '"He was lord here," said she, "when this place wore its crown of fire and fellowship. Five score souls ate at his board. Five score voices made his rafters glad.\n\nWould God he had been content with what the good earth gave him freely. Would God he had let sleeping knowledge sleep."',
        },
        {
          // Visit 4 — the book, the crossing
          ga: '"Ba é an leabhar a chuardach agus a bhrón araon," ar sise. "Thrásnaigh sé trí uisce lena fháil. Níor thrásnaigh sé uisce ar bith ina dhiaidh."\n\nBhog an ghealach. Chrioth an t-uisce timpeall na gcloch báite mar a bheadh cuimhne air ar rud a raibh air dearmad a dhéanamh de.',
          en: '"The book was his seeking and his sorrow both," said she. "He crossed three waters to possess it and crossed no water after."\n\nThe moon moved. The water about the sunken stones shivered as though it remembered something it would rather not.',
        },
        {
          // Visit 5 — the people, the full look
          ga: '"D\'imigh siad," ar sise go bog, "mar a imíonn an bláth. Mar a imíonn gach rud geal nach ngrádhaítear go leor nó in am."\n\nFhéach sí orm ansin — féachaint iomlán, ar bhealach nár dhein sí roimhe — agus ní scríobhfaidh mé síos cad a chonaic mé ina súile domhaine sin, óir tá trócaire fiú ag fear air féin.',
          en: '"They went," said she softly, "as the blossom goes. As all bright things go that are loved too little or too late."\n\nShe looked at me then — full looked, the way she had not done before — and I will not write down what I saw in those deep eyes of hers, for there are mercies a man owes himself.',
        },
        {
          // Visit 6 — the charge, across the water
          ga: '"Rud a cuireadh i dtólamh le bród," tháinig a guth ar ais chugam thar an uisce dubh, agus thar cibé fad eile a bhí idir a domhan-se agus domhan mo leasa-se, "ní mór é a thabhairt ar ais le brón. Rud a bádh anseo uair — b\'fhéidir go mbáfar arís é. Nó b\'fhéidir go n-éireoidh sé."\n\nAnsin ní raibh ann ach na clocha, agus an t-uisce, agus an ghealach, agus buille mo chroí féin ag déanamh a argóint bheag eaglach in aghaidh an chiúnais.',
          en: '"What was sought in pride must be returned in sorrow," her voice came back to me across the black water, and across whatever other distance lay between her world and mine. "What was drowned here once may yet be drowned again — or may yet rise."\n\nThen there was nothing but the stones, and the water, and the moon, and my own heartbeat making its small frightened argument against the silence.',
        },
      ],
    },
  ],

}

