// skyeLoch.js
// Location: public/data/skye/skyeLoch.js
//
// The loch. Garbhán, who keeps the stepping stones, is run by the scene
// (js/game/scenes/locations/skye/garbhan.js): it opens this conversation itself when you come
// near him, and starts the fight when the last card is read. He has no place on the map (x, y are
// off it) and no badge: this entry is only his words, his portrait and his tune.
//
// The dialogues array is generated from
//   tools/dialogue/drafts/skyeLoch.dlg
// Do not hand-edit it: edit the draft and recompile:
//   node tools/dialogue/compile.mjs tools/dialogue/drafts/skyeLoch.dlg
// Everything else here is hand-maintained.
//
// ── NOTES ─────────────────────────────────────────────────────────────────
//   garbhan_met    -- set when the fight begins: the next time he only says "Back for more?"
//
// His tune: js/game/systems/music/dialogueHarp.js, NPC_TUNES, keyed by the portrait below.
// Keep `dialogues` the last field.

export const skyeLochContent = {
  objects: [],
  npcs:    [],
  fixedEncounters: [
    {
      id: 'garbhan',
      x: -30, y: -30,
      radius: 0,
      visual:   { gid: 9205, flat: false },
      portrait: '/assets/npcs/garbhan.png',
      dialogues: [

        // ── first meeting ─────────────────────────────────────────
        {
          requires: { noteAbsent: 'garbhan_met' },
          ga: 'Agus cá háit, a gealbhan beag liath',
          en: 'And where is it, o little grey sparrow',
          exchange: [
            {
              replyGa: 'a ceapann tú eitilt inniu?',
              replyEn: 'do you think to fly today?',
            },
            {
              say: 'Go dtí an comórtas.\nBheinn buíoch dá bhfágfá an bealach a chara.',
              sayEn: 'To the tournament.\nI would be grateful if you let me pass, friend.',
              replyGa: 'A chara! An gcuala tú é sin, uisce?\nAn gcuala tú é sin, spéir?\nA chara, arsa an gealbhan. A chara!\nCas síar, a chréatúir, cas síar.\nNíl áit sa comórtas dá leithead.',
              replyEn: 'Friend! Did ye hear that, water?\nDid ye hear that, sky?\nFriend, says the sparrow. Friend!\nTurn back, little one, turn back.\nTheres no place in the tournament for the likes of you.',
            },
            {
              say: 'Ní fútsa an cinneadh sin.',
              sayEn: 'That is not your decision.',
              replyGa: 'Tar trasna mar sin má tá an chroí ionat.\nTar go bhfeice mé an claíomh maith adhmaid sin.',
              replyEn: 'Come across then if ye dare it.\nCome and let me have a look at that fine wooden sword.',
            },
            {
              say: 'Rachaidh mé timpeall.',
              sayEn: 'I will go round.',
              replyGa: 'Ní rachaidh tú,\nóir beidh mise ansin romhat.\nTá mo chosa níos faide.',
              replyEn: 'Ye will not,\nfor I will be there before you.\nMy legs are longer.',
            },
            {
              say: 'Níl aon dochar deanta fós.\nSeas ar leataobh\nagus seasfaidh mise ar leataobh duitse, lá éigin.',
              sayEn: 'No harm done yet.\nStand aside\nand I will stand aside in my turn.',
              replyGa: 'An piseog ab ea? Geasróg an ea?',
              replyEn: 'Is that some charm? A spell, is it?',
            },
            {
              say: 'Níl ann ach an focal lách\nagus an fhirine',
              sayEn: 'It is only the gentle word\nand the truth',
              replyGa: 'Más ea,\nNíl aon úsáid agam dá leithead.\nTar is bain triail as Garbhóg an Muineál Mór!',
              replyEn: 'Well,\nI\'ve no use for the like.\nCome try Garbhóg the Thick-Necked!',
            },
            {
              say: 'Tar, mar sin.',
              sayEn: 'Come then.',
            },
          ],
        },

        // ── again ─────────────────────────────────────────────────
        {
          requires: { note: 'garbhan_met' },
          ga: 'Ar ais arís? Go maith.',
          en: 'Back again? Good.',
        },

      ],
    },
  ],
}
