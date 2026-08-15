// d3.js -- content for the first river map west of the estuary.
// Location: public/data/bog/d3.js
// Loaded by BogScene._loadContent() (map key 'd3' -> d3Content).
//
// The dialogues array below is GENERATED from tools/dialogue/drafts/d3.dlg.
// Edit the draft, not this array:
//
//   node tools/dialogue/compile.mjs tools/dialogue/drafts/d3.dlg
//
// Everything OUTSIDE that array -- id, position, radius, visual -- is
// hand-maintained and the compiler leaves it alone.
//
// ============================================================================
// BEAT 3 of the cold open: the road.
// ============================================================================
//
// THIS ENCOUNTER REPLACED THE WALKING BRIUGU. His full text with its Irish is
// parked at tools/dialogue/drafts/d3Briugu.dlg -- 12 translated lines, which
// were the only finished Irish in the whole cold open. Nothing in the game
// loads that file; it is kept so the work survives, and so he can be dropped
// onto another river map (c3 and b3 are both free) if he is wanted back.
//
// ---------------------------------------------------------------------------
// TWO THINGS THE SWAP COST
// ---------------------------------------------------------------------------
//
// 1. b0 HAS A DEAD OPTION NOW. Mór's line in b0.js is gated on
//    `requires: { note: 'met_briugu' }` -- "I saw a man on the road, going
//    east. He would not say why." / "... He had a house. Eat your food now."
//    Nothing sets met_briugu any more, so that option can never appear; the
//    linter reports it as "required but never set". It is one of the better
//    moments in b0 and it is currently unreachable.
//
//    It does NOT transfer as written: Odhrán is stationary, tells everyone
//    everything, and keeps a toll rather than a house. Re-gating on
//    met_odhran needs both of Mór's lines rewritten, and that is Irish, so
//    it is Ribo's to write. Something like "I saw a man by the water who
//    could not name his own toll" would keep her "..." doing the same work.
//
// 2. THE PACING ARGUMENT THIS FILE USED TO CARRY. The old header held that
//    this beat's job was PACING, and its encounter should be "deliberately
//    thin" -- because if the thing after Muireann is another conversation,
//    the game reads as a dialogue tree with scenery between the nodes.
//    Odhrán is the longest encounter in the project. His MAINLINE is short
//    (three hails, a wound, and away) and all the depth is opt-in, which is
//    the defence -- but the argument was a good one and is worth re-reading.
//
//    What survives the swap is the briugu's other job: establishing an NPC
//    who does NOT want to talk, so the villagers' evasiveness later reads as
//    character rather than the game withholding. Odhrán's opening silence
//    does that harder than terseness did.
//
// ---------------------------------------------------------------------------
// PLACEMENT
// ---------------------------------------------------------------------------
// (19,12) -- the LAST tile of the briugu's walk path. The previous header
// recorded it as verified against the tile layer: (12,5)-(18,11) are grass,
// (19,12) is the waterside strip where the bank meets the channel. Already
// proven reachable from the boat, which is why it is worth reusing rather
// than picking a fresh tile.
//
// He is LYING DOWN and does not get up. If the sprite ends up standing,
// node 0 reads wrong -- the whole opening beat is that he does not rise.
//
// He must NOT be moved onto a map-edge or crossing tile:
// checkProximityInteractions returns early when an exit is in range, so an
// encounter sharing one can never be spoken to.
//
// ---------------------------------------------------------------------------
// NOTES
// ---------------------------------------------------------------------------
//   READS   has_druid_word        -- set at d3Sea node 4; the one-tap bypass
//   SETS    met_odhran, asked_wound, used_druid_word, asked_odhran_toll,
//           knows_odhran_shame, knows_odhran_binding, knows_odhran_cave,
//           has_toll_rope, offered_odhran_help
//
// has_toll_rope is the only one with a physical consequence. If the rope is
// to be an item rather than a fact, it needs wiring wherever inventory
// lives; the note alone will not put it in anyone's hands.

export const d3Content = {
  npcs: [],
  objects: [],
  introNarrative: [],

  fixedEncounters: [
    {
      id: 'odhran',
      name: 'Odhrán',
      // On the bank, lying down. See PLACEMENT above. No `walk` block: the
      // briugu walked, Odhrán does not move at all, and that is the point.
      x: 19, y: 12,
      radius: 3,
      // PLACEHOLDER art -- he wants his own, lying down. `portrait` loads by
      // URL and fails loudly; the GID tile path fails silently, so set both.
      visual:   { gid: 9102, flat: false },
      portrait: '/assets/npcs/muireann.png',

      dialogues: [

        // ── node 0 — the ford ─────────────────────────────────────
        {
          hold: true,
          again: { en: '[[ short line — he has not moved ]]' },
          options: [
            {
              requires: { noteAbsent: 'met_odhran' },
              ga: 'Hóra, a bhruach!',
              en: 'Ho, the bank!',
              say: 'Hóra, a bhruach!',
              sayEn: 'Ho, the bank!',
              replyGa: '...',
              replyEn: '...',
            },
            {
              requires: { noteAbsent: 'met_odhran' },
              ga: 'Cén dola atá á thógáil san áit seo?',
              en: 'What toll is this place keeping?',
              say: 'Cén dola atá á thógáil san áit seo?',
              sayEn: 'What toll is this place keeping?',
              replyGa: '...',
              replyEn: '...',
            },
            {
              requires: { noteAbsent: 'met_odhran' },
              note: 'met_odhran',
              ga: 'An bhfuil tú slán? Ar buaileadh créacht ort?',
              en: 'Are you hale? Have you taken a wound?',
              say: 'An bhfuil tú slán? Ar buaileadh créacht ort?\nNí fheicim fuil ar bith.',
              sayEn: 'Are you hale? Have you taken a wound?\nI see no blood.',
              replyGa: 'Créacht, muise. Sin é an focal air. Buaileadh go trom mé.\nNí hea. Is le briathra a buaileadh mé.\nIs mise Odhrán, maor dola don Taoiseach Fionnbarra, ar leis an t-áth seo\nagus na trí áth ó thuaidh go Druim Caillí.',
              replyEn: 'A wound, aye. That would be the word for it. I have been struck most grievously.\nNay. I have been struck by words.\nI am Odhrán, toll-keeper to Chief Fionnbarra, who holds this ford\nand the three crossings north to Druim Caillí.',
            },
            {
              requires: { note: 'met_odhran' },
              note: 'knows_odhran_cannot_reckon',
              ga: 'Ainmnigh do dhola, mar sin',
              en: 'Then name your toll',
              say: 'Ainmnigh do dhola agus íocfaidh mé é nó cuirfidh mé ina choinne, mar a cheadaíonn Dia agus nós.\nNí féidir?',
              sayEn: 'Then name your toll and I will pay it or dispute it as God and custom allow.\nCannot?',
              replyGa: 'Ní féidir liom é a ainmniú.\nNí féidir. Tá mé i ndólás.',
              replyEn: 'I cannot name it.\nCannot. I am in woe.',
            },
            {
              requires: { note: 'met_odhran' },
              note: 'knows_fionnbarra',
              ga: 'Do thaoiseach',
              en: 'Your chief',
              say: '[[ an é seo an t-áth dola atá faoi réim Fhionnbarra? ]]',
              sayEn: '[[ is this the toll-point of Fionnbarra\'s reach? ]]',
              replyGa: '[[ is é, agus na trí áth seo ó thuaidh ]]\n[[ an fhleá, agus mo dhea-áit féin cois tine ]]\n[[ labhair sé m\'ainm os ard os comhair na laochra ]]\n[[ níor chuir sé fios orm ó shin ]]',
              replyEn: '[[ it is, and these three crossings north ]]\n[[ the feast, and my own good place by the fire ]]\n[[ he spoke my name aloud before the warriors ]]\n[[ he has not sent for me since ]]',
            },
            {
              requires: { note: 'met_odhran' },
              note: 'knows_satire_harms',
              ga: 'An té a bhuail thú',
              en: 'The one who struck you',
              say: '[[ fiafraigh cad a dúradh ]]\nIs crua sin.',
              sayEn: '[[ ask what was said ]]\nThat is hard.',
              replyGa: '[[ bhí file ann — seang, géartheangach, súile dubha glice ]]\nDúirt sé go raibh aithne orm ó Dhún Bolg go dtí na clocha thuaidh mar an fear\na thóg an tsáil dheireanach aráin thirim as ciseán baintrí\nagus a mheáigh í sular thug sé leath ar ais. Chuir sé i rím ar fad é. Bhí sé déanta go han-mhaith.\nNí raibh sé críochnaithe.\nDúirt sé go raibh mé éirithe chomh cruinn sa bholg ó bheith ag tógáil dola\nnach bhféadfaí mé a aithint thar an gcarraig nuair a shuínn uirthi,\nagus gurbh í an difríocht idir Odhrán agus an charraig\nná nach ndéanadh an charraig smailc lena béal, ar a laghad.',
              replyEn: '[[ there was a file there — lean, sharp-tongued, clever black eyes ]]\nHe said that I was known from Dún Bolg to the northern stones as the man\nwho had taken the last dry heel of bread from a widow\'s basket\nand weighed it before returning half. He rhymed it all. It was very well made.\nHe was not finished.\nHe said that I had grown so round in the belly from the taking of tolls\nthat when I sat upon my rock I could not be told from it,\nand that the difference between Odhrán and the rock\nwas that the rock at least did not smack its lips.',
            },
            {
              requires: { note: 'met_odhran' },
              note: 'knows_odhran_cave',
              ga: 'Cad a dhéanfaidh tú anois?',
              en: 'What will you do now?',
              say: '[[ fiafraigh cad atá i ndán dó ]]',
              sayEn: '[[ ask what becomes of him ]]',
              replyGa: 'Chuala mé go bhfuil uaimh os cionn Chnoc Maol\nmar a bhféadfadh fear suí go han-chiúin\ngan dola a bhailiú ó dhuine ar bith go deo arís.\nD\'fhéadfainn mo théad dola a fhágáil agus dul isteach leis na manaigh.\nSuíonn siad sa dorchadas agus ní áiríonn siad faic,\nagus ní dhéanann duine ar bith fonóid fúthu dá bharr. Meastar gur rud naofa é.',
              replyEn: 'I heard there is a cave above Cnoc Maol\nwhere a man might sit very quietly\nand not collect tolls from anyone ever again.\nI could leave my toll-rope and go in with the monks.\nThey sit in the dark and they reckon nothing,\nand no one mocks them for it. It is considered holy.',
            },
            {
              requires: { note: 'knows_satire_harms' },
              note: 'knows_seadna_name',
              ga: 'An bhfuil ainm air?',
              en: 'Has he a name?',
              say: 'An bhfuil ainm air?',
              sayEn: 'Has he a name?',
              replyGa: 'Séadna.\n[[ agus cá bhfuil sé anois, nó cá raibh a thriall ]]',
              replyEn: 'Séadna.\n[[ and where he is now, or where he was going ]]',
            },
            {
              requires: { note: 'knows_satire_harms' },
              note: 'heard_odhran_riddle',
              ga: 'An é sin an chuid ba mheasa?',
              en: 'Was that the worst of it?',
              say: 'An é sin an chuid ba mheasa?',
              sayEn: 'Was that the worst of it?',
              replyGa: 'Níorbh é sin an chuid ba mheasa. Ba é an tomhas a cheangail sé isteach ina aor an chuid ba mheasa.\nDhírigh sé a cheird ar fad orm, os comhair cách, agus labhair sé mar seo:\n"A Odhráin! A Odhráin! A áiritheoir mhóir na mbonn beag!\nNí bheidh suaimhneas agat go dtí go mbeidh seo áirithe go fírinneach agat:\nLíon do bhlianta roinnte ar líon na bhfear ionraic ar chuir tú aithne orthu.\nCuir leis an méid atá ag na mairbh ar na beo,\nlúide luach na trócaire a tugadh gan iarraidh.\nIolraigh a gcanann an dreoilín ar maidin\nfaoi thost na cloiche i lár na hoíche.\nÍoc é seo leis an té a rinne éagóir ort.\nNá coinnigh faic. Ná bíodh fiacha ort. Bí saor."\nNíl a fhios agam cad atá ag fear marbh ar na beo. Níl a fhios agam conas trócaire a dhealú.\nNí féidir liom an té a ndearna mé éagóir air a aimsiú. Ní féidir liom an té a rinne éagóir orm a aimsiú.\nAgus ón oíche sin i leith ní thig liom áireamh a dhéanamh.',
              replyEn: 'That was not the worst. The worst was the riddle he bound into his mocking.\nHe turned upon me his full craft, before all, and he spoke thus:\n"Odhrán! Odhrán! Thou great and mighty counter of small coins!\nThou shalt have no peace, until thou hast reckoned truly this:\nThe number of thy years divided by the number of honest men thou hast known.\nAdd what the dead owe the living,\nless the worth of mercy shown but never asked for.\nMultiply what the wren sings at morning\nby the silence of the stone at midnight.\nPay this to the man who wronged thee.\nKeep nothing. Owe nothing. Be free."\nI do not know what a dead man owes the living. I do not know how to subtract mercy.\nI cannot find the man I wronged. I cannot find the man who wronged me.\nAnd since that night I cannot reckon.',
            },
            {
              requires: { note: 'knows_odhran_cave' },
              note: 'has_toll_rope',
              ga: 'Do théad, mar sin',
              en: 'Your rope, then',
              say: '[[ iarr an téad ]]',
              sayEn: '[[ ask for the rope ]]',
              replyGa: 'Shín mé trasna an átha í nuair a bhí trácht agam.\nIs maith an téad í. Tóg leat í. Tóg saor in aisce í. Gan dola.',
              replyEn: 'I did stretch it across the ford when I had traffic.\nIt is a good rope. Take it. Take it freely. No toll.',
            },
            {
              requires: { note: 'met_odhran' },
              exit: true,
              en: '[[ boast label ]]',
              sayEn: '[[ you are who you are, and the rope is a rope ]]',
              replyEn: '[[ he stands aside — not moved, only outmatched ]]',
            },
            {
              requires: { note: 'met_odhran' },
              exit: true,
              en: '[[ custom label ]]',
              sayEn: '[[ then I have named it and you have not, so I pass ]]',
              replyEn: '[[ he cannot answer it, and does not enjoy losing this way ]]',
            },
            {
              requires: { note: 'has_druid_word' },
              exit: true,
              en: '[[ druid word label ]]',
              sayEn: '[[ Muireann\'s word ]]',
              replyEn: '[[ pass, as one under protection ]]\n[[ but what did it mean? ]]',
            },
            {
              requires: { note: 'heard_odhran_riddle' },
              note: 'freed_odhran',
              exit: true,
              en: '[[ riddle answer label ]]',
              sayEn: '[[ the sum is nothing — keep nothing, owe nothing, be free ]]',
              replyEn: '[[ he does not thank you. he sits up. ]]',
            },
            {
              exit: true,
              silent: true,
              ga: 'Siúil leat',
              en: 'Walk on',
            },
          ],
        },

      ],
    },
  ],
}

