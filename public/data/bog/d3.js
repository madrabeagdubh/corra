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
      portrait: '/assets/npcs/othran.png',

      dialogues: [

        // ── node 0 — the ford ─────────────────────────────────────
        {
          hold: true,
          en: '...',
          again: { ga: '...', en: '...' },
          options: [
            {
              requires: { noteAbsent: 'met_odhran' },
              note: 'tried_to_sneak',
              ga: 'Iarracht dul thart go ciúin',
              en: 'Try to slip past',
              say: '[Sleamhnaigh cois na habhann, chomh ciúin leis na giolcacha.]',
              sayEn: '[Slip along the near bank, quiet as the reeds.]',
              replyGa: 'Beireann an rópa dola ort go tobann trasna na loirgne.\nNí bheidh dul trasna anseo gan fhios dó.',
              replyEn: 'The toll-rope catches you sharp across the shin.\nThere will be no crossing here unseen.',
            },
            {
              requires: { noteAbsent: 'hailed_1' },
              note: 'hailed_1',
              ga: 'Beannaigh an bruach',
              en: 'Hail the bank',
              say: 'Hóra, a bhruach!',
              sayEn: 'Ho, the bank!',
              replyGa: '...',
              replyEn: '...',
            },
            {
              requires: { note: 'hailed_1', noteAbsent: 'hailed_2' },
              note: 'hailed_2',
              ga: 'Beannaigh arís',
              en: 'Hail the bank again',
              say: 'Hóigh! An bhfuil anam ar bith ar an mbruach sin?',
              sayEn: 'Hoy! Is there a soul on that bank at all?',
              replyGa: 'Ní fhreagraíonn ach an abhainn.',
              replyEn: 'Only the river answers.',
            },
            {
              requires: { note: 'hailed_2', noteAbsent: 'hailed_3' },
              note: 'hailed_3',
              ga: 'Iarracht amháin eile',
              en: 'One more try',
              say: 'DÚIRT MÉ -- hóra, a bhruach!',
              sayEn: 'I SAID -- ho, the bank!',
              replyGa: 'Bogann gualainn beagán. Sin rud éigin, ar a laghad.',
              replyEn: 'A shoulder twitches. That is something, at least.',
            },
            {
              requires: { note: 'hailed_1', noteAbsent: 'met_odhran' },
              note: 'met_odhran',
              ga: 'An bhfuil tú gortaithe?',
              en: 'Are you hurt?',
              exchange: [
                {
                  say: 'An bhfuil tú slán? Ar gortíodh thú?',
                  sayEn: 'Are you hale? Have you been wounded?',
                  replyGa: 'Gortíodh mé, muise. Tá mé créachtaithe.',
                  replyEn: 'A wound, aye. I have been struck most grievously.',
                },
                {
                  say: 'Ní fheicim fuil.',
                  sayEn: 'I see no blood.',
                  replyGa: 'Le briathra a gortíodh mé.',
                  replyEn: 'With words was I wounded.',
                },
              ],
            },
            {
              requires: { note: 'knows_odhran_is_tollman' },
              note: 'knows_odhran_cannot_reckon',
              ga: 'Ainmnigh do dhola',
              en: 'Name your toll',
              exchange: [
                {
                  say: 'Ainmnigh do dhola agus íocfaidh mé é nó cuirfidh mé ina choinne, mar a cheadaíonn Dia agus nós.',
                  sayEn: 'Then name your toll and I will pay it or dispute it as God and custom allow.',
                  replyGa: 'Ní féidir liom é a ainmniú.',
                  replyEn: 'I cannot name it.',
                },
                {
                  say: 'Ní féidir?',
                  sayEn: 'Cannot?',
                  replyGa: 'Ní féidir. Tá mé i ndólás.',
                  replyEn: 'Cannot. I am in woe.',
                },
              ],
            },
            {
              requires: { note: 'met_odhran' },
              note: 'knows_odhran_is_tollman',
              ga: 'Cad a tharla?',
              en: 'What happened?',
              exchange: [
                {
                  say: 'Cad a tharla dhuit?',
                  sayEn: 'What happened to you?',
                  replyGa: 'Is mise Odhrán, maor dola Fionnbarra, ar leis an t-áth seo\nTaoiseach ó seo go Druim Caillí.',
                  replyEn: 'I am Odhrán, toll-keeper to Fionnbarra, who holds this ford\nChief from here to Druim Caillí.',
                },
                {
                  say: 'Ab ea.',
                  sayEn: 'Is that so.',
                  replyGa: 'b\'ea.\nbhfuel a dtuigeann tú, bhí féasta, tí Fionnbharra.\nBhí áit maith agam, chois tinne.\nBhí m\'ainm ráite ós árd ag an Taoiseach, ós comhair na laoch\nNí beag san. Bhí áthas orm.\nAch bhí file ánn an oiche sin.\nCraythur thanaí le súile dubha glic\nAr mhastlaigh mo áthas é? Ceapaim gur mhastlaigh.',
                  replyEn: 'It was.\nYou see, there was a feast, at Fionnbarra\'s hall.\nI had a good place, by the fire.\nThe chief had said my name aloud before his warriors.\nwhich is no small thing. I was pleased.\nBut there was a poet there, that night.\nA lean, sharp-tongued creature with clever black eyes.\nDid my happiness offend him? I think so.',
                },
                {
                  say: 'Agus?',
                  sayEn: 'And?',
                  replyGa: 'Agus chum sé aoir',
                  replyEn: 'He made a satire.',
                },
                {
                  say: 'Ar?',
                  sayEn: 'Upon whom?',
                  replyGa: 'Orm',
                  replyEn: 'Upon me.',
                },
              ],
            },
            {
              requires: { note: 'heard_of_satire' },
              note: 'knows_satire_harms',
              ga: 'Cad a dúirt sé?',
              en: 'What did he say?',
              exchange: [
                {
                  say: 'Cén saighs Aoir?',
                  sayEn: 'What kind of satire?',
                  replyGa: 'Dúirt sé go raibh aithne orm ó Dhún Bolg go dtí na clocha thuaidh mar an fear\na thóg an tsáil dheireanach aráin thirim as ciseán baintrí\nagus a mheá-ig é, sular leath-ig é.',
                  replyEn: 'He said that I was known from Dún Bolg to the northern stones as the man\nwho had taken the last dry heel of bread from a widow\'s basket\nand weighed it before returning half.',
                },
                {
                  say: 'Is crua sin.',
                  sayEn: 'That is hard.',
                  replyGa: 'Ní raibh sé críochnaithe.',
                  replyEn: 'He was not finished.',
                },
                {
                  say: 'Ah.',
                  sayEn: 'Ah.',
                  replyGa: 'Dúirt sé go raibh mé éirithe chomh cruinn sa bho-lg ó na dol-ig\nnach bhféadfaí mé a aithint ón gcarraig ar a shuí mé\nAgus nach tugann an charraig smeachadh a béil, ar a laghad.',
                  replyEn: 'He said that I had grown so round in the belly from the taking of tolls\nthat when I sat upon my rock I could not be told from it,\nAnd that the rock at least did not smack its lips.',
                },
              ],
            },
            {
              requires: { note: 'knows_satire_harms' },
              note: 'knows_odhran_cave',
              ga: 'Cad a dhéanfaidh tú?',
              en: 'What will you do?',
              say: 'Cad a dhéanfaidh tú anois?',
              sayEn: 'What will you do now?',
              replyGa: 'Chuala mé go bhfuil uaimh os cionn Chnoc Maol\náit a bhféadfadh fear suí go han-chiúin\ngan dola a bhailiú ó dhuine ar bith go deo arís.\nD\'fhéadfainn mo rópa dola a fhágáil agus dul isteach leis na manaigh.\nSuíonn siad sa dorchadas agus ní áiríonn siad faic,\nagus ní dhéanann duine ar bith magadh fúthu. Nós naofa é.',
              replyEn: 'I heard there is a cave above Cnoc Maol\nwhere a man might sit very quietly\nand not collect tolls from anyone ever again.\nI could leave my toll-rope and go in with the monks.\nThey sit in the dark and they reckon nothing,\nNo one mocks them for it. It is considered holy.',
            },
            {
              requires: { note: 'knows_odhran_cave' },
              note: 'has_toll_rope',
              ga: 'Rópa dola?',
              en: 'Toll rope?',
              say: 'Cad faoi an rópa?',
              sayEn: 'What about the rope?',
              replyGa: 'Shínfainn é trasna an abhainn nuair a bhí trácht agam.\nIs rópa maith é. Tóg é. Tóg saor in aisce é. Gan dola.',
              replyEn: 'I did stretch it across the river when I had traffic.\nIt is a good rope. Take it. Take it for free. No toll.',
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

