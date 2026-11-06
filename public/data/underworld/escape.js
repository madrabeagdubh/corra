// escape.js -- the words of the escape from the underworld (scenes/locations/cave/escape.js).
// Location: public/data/underworld/escape.js
//
// The dialogues arrays are GENERATED from the drafts in tools/dialogue/drafts/escape_*.dlg (one draft per
// encounter, in this order). Edit the drafts, then:
//   node tools/dialogue/compile.mjs tools/dialogue/drafts/escape_geaga.dlg      (and the others)
//
// ALL PLACEHOLDERS for now: each card says what happens there, for the real words to be written.
// The escape scene places these itself (escape_*.json maps, `npcs`), so there is no x/y here; it reads the notes:
//   escape_geaga_blind_eye        Géaga looks away: her roots across the north stair part
//   escape_puca_snare_free        the púca in the deeps is cut loose: it goes
//   escape_puca_ring_free         the púca in the sídh's ring is let out: it goes, a horse of the air
//   escape_done                   out at the source of the Boyne
// The gates (gate_*), the dead waiting at the well (shade_*) and the woman in the boat past the sea-door (ferrywoman)
// set no notes.

export const escapeContent = {
  npcs: [],
  objects: [],
  introNarrative: [],
  fixedEncounters: [
    {
      id: 'geaga',
      dialogues: [

        // ── she wakes: never one ──────────────────────────────────
        {
          requires: { noteAbsent: 'escape_geaga_blind_eye' },
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'I see thee, champion. I see thee, and the one before thee,\nand all of them stretching back and back into the dark.\nThou art a flowering of that old root.\nThou art come to where all things that were, are still.',
        },

        // ── the asking ────────────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_geaga_blind_eye' },
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'Back.\nThou wouldst go back up into the green world,\nto walk again where the rain falls and fires are lit against the dark.\nIt is an old asking. I have heard it before.\nWhat comes down into the dark does not go back up into the light.',
        },

        // ── she looks away ────────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_geaga_blind_eye' },
          note: 'escape_geaga_blind_eye',
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'She says no more.\nSlowly, as a tree turns from the wind, she turns her eyes from the north stair.',
        },

        // ── afterwards ────────────────────────────────────────────
        {
          requires: { note: 'escape_geaga_blind_eye' },
          ga: '[Gaeilge le teacht]',
          en: 'She says nothing. She is not looking.',
        },

      ],
    },
    {
      id: 'puca_snare',
      dialogues: [

        // ── node 0 — caught ───────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_puca_snare_free' },
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: '[PLACEHOLDER] The púca, lashed in the ghouls\' snare, sees you.\nIt tells you how it came to be caught (its own trick, gone wrong), and begs you to cut it loose.',
        },

        // ── node 1 — loosed ───────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_puca_snare_free' },
          note: 'escape_puca_snare_free',
          ga: '[Gaeilge le teacht]',
          en: '[PLACEHOLDER] You cut the cords. It thanks you in its fashion, and is gone.',
        },

      ],
    },
    {
      id: 'puca_ring',
      dialogues: [

        // ── node 0 — dancing ──────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_puca_ring_free' },
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: '[PLACEHOLDER] The púca dances in the ring and cannot stop. It laughs at itself, between breaths.\nIt asks you to break the ring.',
        },

        // ── node 1 — out ──────────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_puca_ring_free' },
          note: 'escape_puca_ring_free',
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: '[PLACEHOLDER] You kick a toadstool out of the ring. The púca stops, and is a horse of the air, and is gone.\nIt will remember you.',
        },

      ],
    },
    {
      id: 'end',
      dialogues: [

        // ── node 0 — out ──────────────────────────────────────────
        {
          continue: true,
          ga: '[Gaeilge le teacht]',
          en: '[PLACEHOLDER] The night air. The source of the Boyne behind you, and dawn not far off.',
        },

        // ── node 1 — to be continued ──────────────────────────────
        {
          note: 'escape_done',
          ga: '[Gaeilge le teacht]',
          en: '[PLACEHOLDER] (To be continued: to the mouth of the Boyne before sunrise, without touching the ground.)',
        },

      ],
    },
    {
      id: 'gate_donn',
      dialogues: [

        // ── the sea-door ──────────────────────────────────────────
        {
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'No door fills the frame. Only the opening, and the cold coming in over the worn sill in folds.\nMourners are carved either side, I think. The stone about them is slick with damp.\nA smell comes up from below: water that never felt daylight.',
        },

        // ── where it goes ─────────────────────────────────────────
        {
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'This is the way to Teach Duinn. No green shore beyond:\nonly the rock, and the house upon it, and Donn waiting within.\nCome to my house, all of you, after your death. The words of Donn.',
        },

      ],
    },
    {
      id: 'gate_sidh',
      dialogues: [

        // ── the thorn ─────────────────────────────────────────────
        {
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'A hawthorn has grown up here through the stone, gnarled as an old man’s knuckle,\nblossom on it white as milk, blooming in this dark. Its trunk is hollow where a door should be.',
        },

        // ── the session ───────────────────────────────────────────
        {
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'And from behind it, a session in full cry: fiddles racing each other,\nfeet stamping the floor, a roar of laughter, a voice lifting into a song.\nYou stand out in the cold, like one outside a lit house on a winter’s night.',
        },

        // ── where it goes ─────────────────────────────────────────
        {
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'Beyond are the hollow hills, the bright halls of the sídh. The latch is on their side.\nAnd no one cuts a fairy thorn: not a champion, not a king with all his host behind him,\nnot if he values his cattle, his children, his luck, his mind.',
        },

      ],
    },
    {
      id: 'gate_fomor',
      dialogues: [

        // ── the gate ──────────────────────────────────────────────
        {
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'Black basalt, hewn in courses, fitted without mortar.\nGiants are carved either side, each with a single eye,\nand over the lintel an eye is cut, half-lidded, watching.\nRed light bleeds under the door, and the heat comes with it.',
        },

        // ── the pounding ──────────────────────────────────────────
        {
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'From far beyond and far below, a pounding: slow, even, without pause and without hurry.\nNot the sea. The sea has breath in it, a drawing-back, a thinking. This has none.',
        },

        // ── where it goes ─────────────────────────────────────────
        {
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'Beyond lie the Fomoire, and Balor’s halls of iron, where fire gives no comfort.\nThe gate is sealed. It is no grief to leave it so.',
        },

      ],
    },
    {
      id: 'gate_tethra',
      dialogues: [

        // ── the gate ──────────────────────────────────────────────
        {
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'Sea-worn stone, crusted with shells and the white of old salt.\nSeal-folk are carved either side, their faces turned toward the water.\nThe steps go down to a gate half under the tide, rusted and barnacled:\nthe heave and the fall, the heave and the fall, the water running back between the stones.',
        },

        // ── where it goes ─────────────────────────────────────────
        {
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'This way runs down to Tethra, king under the wave.\nNo one that has gone down those steps has come back up from them.\nThat much is known. That much, and no more.',
        },

      ],
    },
    {
      id: 'shade_manach',
      dialogues: [

        // ── waiting ───────────────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_geaga_blind_eye' },
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'You are waiting also? Good. Then we are two, and the waiting is less strange with two.\nI have lost the count of how long. That grieves me. I was always careful with numbers.',
        },

        // ── the book ──────────────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_geaga_blind_eye' },
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'I had a book. My own. Fourteen years from the first ruling of the vellum:\nthe life of the blessed Ciarán, the nature of the salmon,\nthe stars above Clonmacnoise, and what the old ones named them before Patrick came.',
        },

        // ── one page ──────────────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_geaga_blind_eye' },
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'The fire took the house on a Thursday.\nI had one page left to write. Fourteen years, and one page.',
        },

        // ── she let you go ────────────────────────────────────────
        {
          requires: { note: 'escape_geaga_blind_eye' },
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'She let you go. Yes. Yes, I see it. You are plainly a different order of thing than I am.\nI copied letters fourteen years in a cold room above a river.',
        },

        // ── Fionnbarr ─────────────────────────────────────────────
        {
          requires: { note: 'escape_geaga_blind_eye' },
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'There is a young brother at Clonmacnoise, Fionnbarr. He was fond of me.\nTell him I am not suffering. It is only that I cannot settle.',
        },

        // ── the Nail of the Sky ───────────────────────────────────
        {
          requires: { note: 'escape_geaga_blind_eye' },
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'And if you find a pen, and a clean piece of vellum: the last star was to be the cold one, that does not move.\nThe fishermen call it the Nail of the Sky, for all things turn about it and it holds firm.\nOne sentence. I would feel better, knowing it was written somewhere. Go now. Go.',
        },

      ],
    },
    {
      id: 'shade_laoch',
      dialogues: [

        // ── the speech ────────────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_geaga_blind_eye' },
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'A hundred years I have been fashioning what I will say to her. The words are good now. Well-made.\nI was never a man of poems. The poets came to me, and I gave them silver.\nHear it, and judge it.',
        },

        // ── as she will hear it ───────────────────────────────────
        {
          requires: { noteAbsent: 'escape_geaga_blind_eye' },
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'Géaga of the well, of the nine hazels and the nine gifts: I was Ferchar of Sliabh Fuait.\nThree kings called me champion. At the ford of the Bóinn I held alone,\nand what was left of me after was still standing. Give me one morning above, one fight in the open air.',
        },

        // ── the ending ────────────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_geaga_blind_eye' },
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'Is that well enough? The middle part I have changed four times.\nA hundred years, and the ending is still not right.',
        },

        // ── she let you go ────────────────────────────────────────
        {
          requires: { note: 'escape_geaga_blind_eye' },
          continue: true,
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'She let you go. She looked at you, and she let you go.\nA hundred years, and she has not once looked at me long enough to hear it.\nWell. It is no matter. You are going up, and I am not, and that is the shape of things.',
        },

        // ── tell them he held ─────────────────────────────────────
        {
          requires: { note: 'escape_geaga_blind_eye' },
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'Find someone of my blood, if any are left above. Tell them Ferchar of Sliabh Fuait held.\nIn every place they set him, he held, and he did not fall.\nTell them nothing else. That is enough. That is more than enough.',
        },

      ],
    },
    {
      id: 'shade_mathair',
      dialogues: [

        // ── node 0 — waiting ──────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_geaga_blind_eye' },
          ga: '[Gaeilge le teacht]',
          en: '[PLACEHOLDER] (A woman who wants to see her child grown, just once.) Waiting, as you are, to ask her.',
        },

        // ── node 1 — she let you go ───────────────────────────────
        {
          requires: { note: 'escape_geaga_blind_eye' },
          ga: '[Gaeilge le teacht]',
          en: '[PLACEHOLDER] She let you go? (Wonder, envy, a message for the living.)',
        },

      ],
    },
    {
      id: 'shade_file',
      dialogues: [

        // ── the poem ──────────────────────────────────────────────
        {
          requires: { noteAbsent: 'escape_geaga_blind_eye' },
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'Three hazels bend above the pool,\nThree salmon take the falling nut;\nWhat the water knows, it will not tell,\nWhat the tree knows, it has forgot—',
        },

        // ── she let you go ────────────────────────────────────────
        {
          requires: { note: 'escape_geaga_blind_eye' },
          ga: '[Gaeilge le teacht]\n[Gaeilge le teacht]',
          en: 'She let you go? Then the last line is up there somewhere, under the sky.\nIf you hear it, at a fire, from a child, anywhere at all: keep it for me.',
        },

      ],
    },
    {
      id: 'ferrywoman',
      dialogues: [

        // ── node 0 — she does not answer ──────────────────────────
        {
          ga: '[Gaeilge le teacht]',
          en: '[PLACEHOLDER] She does not answer. She stands at the bow, and the water drips from her hair.',
        },

      ],
    },
  ],
}
