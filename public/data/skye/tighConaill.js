// tighConaill.js
// Location: public/data/skye/tighConaill.js
//
// Conall's cabin (js/game/scenes/locations/skye/tighConaill.js, tighPlay.js). Two conversations, both his, both
// read at the player's own pace, with the room's own doings (the brooch is thrown, he draws the curtain) between:
//   0  at the window, as he draws the curtain: "thou hast slept the better part of two days"
//   1  the rescue, played first, in the dark (tighConaill.js _dream): the drowning, "I am Conall",
//      "the mark of a student of Dún Scáthach" (the brooch is thrown), the path of the blade
//
// The dialogues arrays are generated from
//   tools/dialogue/drafts/tighConaill.dlg         (encounter 0)
//   tools/dialogue/drafts/tighConaillRescue.dlg   (encounter 1)
// Do not hand-edit them: edit the drafts and recompile, e.g.
//   node tools/dialogue/compile.mjs tools/dialogue/drafts/tighConaill.dlg
// Keep `dialogues` the last field of each speaker.
//
// ── NOTES (set by the dialogue, watched by the scene) ──────────────────────
//   tigh_brooch    -- he throws the brooch

export const tighConaillContent = {
  objects: [],
  npcs:    [],
  fixedEncounters: [
    {
      id: 'conall',
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
      id: 'conall_rescue',
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
              sayEn: 'I was drowning.\nI was surely drowning.',
              replyGa: 'Níl ort ach tuirse.',
              replyEn: 'Thou art weary, nothing more.',
            },
          ],
        },

        // ── node 2 — where is this place ──────────────────────────
        {
          exchange: [
            {
              say: 'Cá bhfuil mé anois?',
              sayEn: 'Where is this place?',
              replyGa: 'Mo aoi thú. Conall is ainm dom.',
              replyEn: 'Thou art my guest. I am Conall.',
            },
          ],
        },

        // ── node 3 — the mark ─────────────────────────────────────
        {
          exchange: [
            {
              replyGa: 'Chaitheann daltaí dealg an Cheo.\nDuitse an ceann seo.',
              replyEn: 'Students wear the brooch of Skye.\nThis one is for you.',
            },
          ],
        },

        // ── node 4 — the path of the blade ────────────────────────
        {
          exchange: [
            {
              say: 'Ach níor thugas liom eallach,\nná tiarnas breá airgid.',
              sayEn: 'But I brought no cattle with me,\nnor fine tribute of silver.',
              replyGa: 'Bí socair\nRinne tú do chás cheana féin\ncois trá\ngan aithne\nleathbáite\nan fharraige fós ag sileadh uait.\nLig do scíth.\nCuirfidh mé ar bhóthar an chlaímh thú,',
              replyEn: 'Be still\nThou hast made thy case already\nupon the shore\nsenseless\nhalf-drowned\nthe sea still running from thee.\nTake thy rest.\nI set thee on the path of the blade,',
            },
          ],
        },

        // ── node 5 — at the door ──────────────────────────────────
        {
          ga: 'Nach é sin a mheallann na Taoisigh Ghaelacha go Ceo?',
          en: 'Is that not why ye Gaelic Chieftains come to Skye?',
        },

      ],
    },
  ],
}
