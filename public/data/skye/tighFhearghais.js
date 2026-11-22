// tighFhearghais.js
// Location: public/data/skye/tighFhearghais.js
//
// Fergus's cabin (js/game/scenes/locations/skye/tighFhearghais.js, tighPlay.js). Two conversations, both his, both
// read at the player's own pace, with the room's own doings (the brooch is thrown, he draws the curtain) between:
//   0  at the window, as he draws the curtain: "thou hast slept the better part of two days"
//   1  the rescue, played first, in the dark (tighFhearghais.js _dream): the drowning, "I am Fergus",
//      "the mark of a student of Dún Scáthach" (the brooch is thrown), the path of the blade
//
// The dialogues arrays are generated from
//   tools/dialogue/drafts/tighFhearghais.dlg         (encounter 0)
//   tools/dialogue/drafts/tighFhearghaisRescue.dlg   (encounter 1)
// Do not hand-edit them: edit the drafts and recompile, e.g.
//   node tools/dialogue/compile.mjs tools/dialogue/drafts/tighFhearghais.dlg
// Keep `dialogues` the last field of each speaker.
//
// ── NOTES (set by the dialogue, watched by the scene) ──────────────────────
//   tigh_brooch    -- he throws the brooch

export const tighFhearghaisContent = {
  objects: [],
  npcs:    [],
  fixedEncounters: [
    {
      id: 'fearghas',
      x: 0, y: 0, radius: 1,
      visual:   { gid: 9203, flat: false },
      portrait: '/assets/npcs/othran.png',
      dialogues: [

        // ── node 0 — the light ────────────────────────────────────
        {
          ga: 'Chodail tú dhá lá nach mór.',
          en: 'Thou hast slept the better part of two days,',
        },

      ],
    },
    {
      id: 'fearghas_rescue',
      x: 0, y: 0, radius: 1,
      visual:   { gid: 9203, flat: false },
      portrait: '/assets/npcs/othran.png',
      dialogues: [

        // ── node 0 — in the dark ──────────────────────────────────
        {
          exchange: [
            {
              say: 'Ag bá!\nTá mé i ngreim ag an uisce dubh,\nlíonann sé mo scornach.',
              sayEn: 'Drowning!\nI am in the grip of black water,\nIt fills my throat.',
              replyGa: 'Bí socair.',
              replyEn: 'Lie still.',
            },
          ],
        },

        // ── node 1 — half-woken ───────────────────────────────────
        {
          exchange: [
            {
              say: 'Bhí mé ag bá.\nBhí mé báite gan amhras.',
              sayEn: 'I was drowning.\nI drowned! I know it.',
              replyGa: 'Ní raibh ann ach tromluí.\nTá tú slán.',
              replyEn: 'It was just a nightmare.\nYou are safe.',
            },
          ],
        },

        // ── node 2 — where is this place ──────────────────────────
        {
          exchange: [
            {
              say: 'Cé tú féin?',
              sayEn: 'Who are you?',
              replyGa: 'Fearghas is ainm dom\nMo aoi thú',
              replyEn: 'Fergus is my name\nYou are my guest',
            },
          ],
        },

        // ── node 3 — the mark ─────────────────────────────────────
        {
          exchange: [
            {
              replyGa: 'Tá do chuid éadaigh sa chófra ag bun do leapa\nChaitheann daltaí dealg an Cheo',
              replyEn: 'Thy clothes are in the chest at the foot of thy bed\nStudents wear the brooch of Skye',
            },
          ],
        },

        // ── node 4 — the chest, and the path of the blade ─────────
        {
          exchange: [
            {
              replyGa: 'Duitse an ceann seo',
              replyEn: 'This one is for you',
            },
            {
              say: 'Ach níor thugas eallach\nná tiarnas breá airgid\nIs cuma',
              sayEn: 'But I brought no cattle\nnor fine tribute of silver\nDoesn\'t matter',
              replyGa: 'cois trá\nleathbáite\nan fharraige fós ag sileadh uait\nDeanadh do chás\nCuirfidh mé ar bhóthar an chlaímh thú',
              replyEn: 'upon the shore\nhalf-drowned\nthe sea still running from thee\nThy case was made\nI will set thee on the path of the blade',
            },
          ],
        },

        // ── node 5 — at the door ──────────────────────────────────
        {
          exchange: [
            {
              say: 'Sin a mheallann Taoisigh Ghaelacha go Ceo.',
              sayEn: 'That\'s what lures you chiefs to Skye.',
            },
          ],
        },

      ],
    },
  ],
}
