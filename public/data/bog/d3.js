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

        // ── node 0 — the hails ────────────────────────────────────
        {
          requires: { noteAbsent: 'met_odhran' },
          note: 'met_odhran',
          en: 'He is lying on the bank where the grass gives out to the water.\nThe toll-rope is slack in the channel beside him.\nHe does not get up.',
          again: { en: 'He does not answer.' },
          options: [
            {
              requires: { note: 'has_druid_word' },
              note: 'used_druid_word',
              first: true,
              en: 'Say the druid\'s word',
              sayEn: 'The Druid of the Cliff-Mouth knows my name.',
              replyEn: 'Then he knows more than I do.\nRow on. There is no toll on you today.',
            },
            {
              en: 'Ho, the bank!',
              sayEn: 'Ho, the bank!',
              replyEn: '...',
            },
            {
              en: 'What toll is this place keeping?',
              sayEn: 'What toll is this place keeping?',
              replyEn: '...',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 1 — are you hale ─────────────────────────────────
        {
          en: '...',
          again: { en: 'He has not moved.' },
          options: [
            {
              en: 'Is this the toll-point of Fionnbarra\'s reach?',
              sayEn: 'Is this the toll-point of Fionnbarra\'s reach?',
              replyEn: '...',
            },
            {
              note: 'asked_wound',
              en: 'Are you hale?',
              sayEn: 'Are you hale? Have you taken a wound?',
              replyEn: 'A wound. Aye. That would be the word for it.\nI have been struck most grievously.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 2 — struck by words ──────────────────────────────
        {
          en: '...',
          again: { en: 'Well?' },
          options: [
            {
              en: 'I see no blood',
              sayEn: 'I see no blood.',
              replyEn: 'Nay. I have been struck by words.\nI am Odhrán, toll-keeper to Chief Fionnbarra,\nChieftain from this reach to three crossings north of Druim Caillí.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 3 — name your toll ───────────────────────────────
        {
          en: 'So. You will be wanting to pass.',
          again: { en: 'Name it, you are thinking. I cannot.' },
          options: [
            {
              note: 'asked_odhran_toll',
              en: 'Then name your toll',
              sayEn: 'Then name your toll, and I will pay it\nor dispute it as God and custom allow.',
              replyEn: 'I cannot name it.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 4 — the feast ────────────────────────────────────
        {
          en: 'Cannot. I am in woe.\nThere was a feast at Fionnbarra\'s hall.\nI sat in my place, which is a good place, near the fire,\nwith meat on my bone and mead in my cup.\nThe chief had said my name aloud before his warriors,\nwhich is no small thing.\nBut there was a bard there. A lean, sharp-tongued creature\nwith clever black eyes.',
          again: { en: 'I am in woe.' },
          options: [
            {
              en: 'And?',
              sayEn: 'And?',
              replyEn: 'He made a satire.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 5 — upon whom ────────────────────────────────────
        {
          en: 'A satire. In the hall. Before them all.',
          again: { en: 'Upon me.' },
          options: [
            {
              note: 'knows_odhran_shame',
              en: 'Upon whom?',
              sayEn: 'Upon whom?',
              replyEn: 'Upon me.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 6 — the widow's bread ────────────────────────────
        {
          en: 'You will be wanting to know what he said.',
          again: { en: 'It was very well made.' },
          options: [
            {
              en: 'What did he say?',
              sayEn: 'What did he say?',
              replyEn: 'He said I was known from Dún Bolg to the northern stones\nas the man who took the last dry heel of bread\nfrom a widow\'s basket, and weighed it before returning half.\nHe rhymed it all. It was very well made.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 7 — the rock ─────────────────────────────────────
        {
          en: 'That is hard, you are thinking.\nHe was not finished.',
          again: { en: 'He was not finished.' },
          options: [
            {
              en: 'Ah',
              sayEn: 'Ah.',
              replyEn: 'He said I was a man grown so round in the belly\nfrom the taking of tolls that when I sat upon my rock\nI could not be told from it,\nand that the difference between Odhrán and the rock\nwas that the rock at least did not smack its lips.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 8 — the binding ──────────────────────────────────
        {
          en: 'That was not the worst of it.\nThe worst was the riddle he bound into his mocking.\nHe turned his full craft upon me, before all, and spoke thus:',
          again: { en: 'I cannot find the end of it.' },
          options: [
            {
              note: 'knows_odhran_binding',
              en: 'What was it he bound on you?',
              sayEn: 'What was it he bound on you?',
              replyEn: '"Odhrán! Odhrán! Thou great and mighty counter of small coins!\nThou shalt have no peace until thou hast reckoned truly this:\nthe number of thy years, divided by the number of honest men\nthou hast known. Add what the dead owe the living,\nless the worth of mercy shown but never asked for.\nMultiply what the wren sings at morning\nby the silence of the stone at midnight.\nPay this to the man who wronged thee.\nKeep nothing. Owe nothing. Be free."',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 9 — what am I now ────────────────────────────────
        {
          en: 'I do not know what a dead man owes the living.\nI do not know how to subtract mercy.\nI cannot find the man I wronged. I cannot find the man who wronged me.',
          again: { en: 'What am I now?' },
          options: [
            {
              en: 'And since that night you cannot reckon',
              sayEn: 'And since that night you cannot reckon the tolls.',
              replyEn: 'Since that night I cannot reckon.\nI was Chief Fionnbarra\'s right hand of the river.\nNever bested by fisherman nor lord nor holy wanderer.\nWhat am I now? A man satirised truly in the hall of his chief,\nbefore warriors and dogs.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 10 — the cave and the rope ───────────────────────
        {
          en: 'I heard there is a cave above Cnoc Maol\nwhere a man might sit very quietly\nand not collect tolls from anyone ever again.',
          again: { en: 'It is a good rope.' },
          options: [
            {
              note: 'knows_odhran_cave',
              en: 'A cave?',
              sayEn: 'A cave.',
              replyEn: 'I could leave my toll-rope and go in with the monks.\nThey sit in the dark and they reckon nothing,\nand no one mocks them for it. It is considered holy.',
            },
            {
              requires: { note: 'knows_odhran_cave' },
              note: 'has_toll_rope',
              en: 'The toll-rope?',
              sayEn: 'The toll-rope?',
              replyEn: 'I did stretch it across the water when I had traffic.\nIt is a good rope. Take it. Take it freely. No toll.',
            },
            {
              exit: true,
              silent: true,
              en: 'Row on',
            },
          ],
        },

        // ── node 11 — let me help ─────────────────────────────────
        {
          en: 'Take it and go. There is nothing here for you.',
          again: { en: 'I shall enquire.' },
          options: [
            {
              note: 'offered_odhran_help',
              en: 'Let me help',
              sayEn: 'Odhrán, a bard\'s satire is a sharp thing.\nIt cuts to the bone, and the bone-cut aches long after.\nI am going west to the ráth. I shall enquire.',
              replyEn: '...\nDo that.',
            },
            {
              exit: true,
              silent: true,
              en: 'Say nothing',
            },
          ],
        },

        // ── node 12 — afterwards ──────────────────────────────────
        {
          en: 'The water is open. It costs you nothing.',
          again: { en: 'The water is open.' },
          options: [
            {
              exit: true,
              silent: true,
              en: 'Farewell',
            },
          ],
        },

      ],
    },
  ],
}

