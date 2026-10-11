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
              sayEn: 'Drowning!\nThe black water has me,\nIt fills my throat.',
              replyGa: 'Bí socair.',
              replyEn: 'Lie still.',
            },
          ],
        },

        // ── node 1 — half-woken ───────────────────────────────────
        {
          exchange: [
            {
              say: 'Bhí mé báite. Bhí mé báite gan amhras.',
              sayEn: 'I was drowning. I was surely drowning.',
              replyGa: 'Níl ort ach tuirse.',
              replyEn: 'Thou art weary, nothing more.',
            },
            {
              say: 'Cá bhfuil mé anois?',
              sayEn: 'Where is this place?',
              replyGa: 'Mo aoi thú. Conall is ainm dom.',
              replyEn: 'Thou art my guest. I am Conall.',
            },
          ],
        },

        // ── node 2 — the mark ─────────────────────────────────────
        {
          ga: 'Chaitheann dhaltaí Dhún Scáthach iad seo. Is leatsa é.',
          en: 'And this is the mark of a student of Dún Scáthach. It is thine.',
        },

        // ── node 3 — the path of the blade ────────────────────────
        {
          exchange: [
            {
              say: 'Níor thugas liom eallach, ná tiarnas breá airgid.',
              sayEn: 'I bring no cattle, no fine tribute of silver.',
              replyGa: 'Bí socair\nRinne tú do chás cheana féin nuair a bhain tú amach an trá, gan aithne, leathbáite,\nagus an fharraige fós ag sileadh uait.\nLig do scíth,\nAnsin cuirfidh mé ar bhóthar an chlaímh thú,\nNach é sin a tógann na Taoisigh Gaelach ar fad go Cheo?',
              replyEn: 'Ease now thy troubled mind\nThou hast made thy case already upon the shore, senseless and half-drowned,\nwith the sea still running from thee.\nTake thy rest,\nThen shall I set thee on the path of the blade,\nIs that not why all Gaelic Chieftains come to Skye?',
            },
          ],
        },

      ],
    },
  ],
}
