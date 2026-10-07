// tighConaill.js
// Location: public/data/skye/tighConaill.js
//
// Conall's cabin (js/game/scenes/locations/skye/tighConaill.js, tighPlay.js). Three short
// conversations, all his, all read at the player's own pace, with the room's own doings
// (he draws the curtain, he throws the brooch) between them:
//   0  hello, and a word about the light (then he goes and draws the curtain)
//   1  the clothes and the stew, the training grounds
//   2  at the door, as he leaves: "students at Dún Scáthach wear one of these"
//
// The dialogues arrays are generated from
//   tools/dialogue/drafts/tighConaill.dlg         (encounter 0)
//   tools/dialogue/drafts/tighConaillClothes.dlg  (encounter 1)
//   tools/dialogue/drafts/tighConaillDoor.dlg     (encounter 2)
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

        // ── node 0 — awake ────────────────────────────────────────
        {
          continue: true,
          ga: 'Á, tá tú ann.\nChodail tú mar chloch. Bhí imní ag teacht orm.',
          en: 'Ah, there you are.\nYou slept like a stone. I was beginning to wonder.',
        },

        // ── node 1 — the light ────────────────────────────────────
        {
          ga: 'Cuirimis solas ar an scéal.',
          en: 'Let us have some light on the matter.',
        },

      ],
    },
    {
      id: 'conall_clothes',
      x: 0, y: 0, radius: 1,
      visual:   { gid: 9203, flat: false },
      portrait: '/assets/npcs/othran.png',
      dialogues: [

        // ── node 0 — the clothes, the stew ────────────────────────
        {
          continue: true,
          ga: 'Tá do chuid éadaí nite agus triomaithe, ansin ar an gcófra.\nIth leat den stobhach, agus lig do scíth chomh fada agus is mian leat.',
          en: 'Your clothes are washed and dried, there on the chest.\nHelp yourself to the stew, and rest as long as you like.',
        },

        // ── node 1 — the training grounds ─────────────────────────
        {
          ga: 'Nuair a bheidh tú réidh, tar agus aimsigh mé ar an bhfaiche.\nTá na daoine eile thuas ag an gcaisleán. Beidh an áit againn dúinn féin.',
          en: 'When you are ready, come and find me in the training grounds.\nThe others are up at the castle. We will have the place to ourselves.',
        },

      ],
    },
    {
      id: 'conall_door',
      x: 0, y: 0, radius: 1,
      visual:   { gid: 9203, flat: false },
      portrait: '/assets/npcs/othran.png',
      dialogues: [

        // ── node 0 — the brooch ───────────────────────────────────
        {
          note: 'tigh_brooch',
          ga: 'Ó, rud amháin eile.\nCaitheann daltaí Dhún Scáthaigh ceann díobh seo.\nFágfaidh mé le do chuid éadaí é.',
          en: 'Oh, one thing more.\nStudents at Dún Scáthach wear one of these.\nI\'ll leave it with your things.',
        },

      ],
    },
  ],
}
