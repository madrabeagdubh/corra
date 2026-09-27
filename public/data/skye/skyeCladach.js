// skyeCladach.js
// Location: public/data/skye/skyeCladach.js
//
// The shore of Skye, where the boat lands. Uathach, Scáthach's daughter,
// runs the movement lesson: the step drill, then the bramble lane. The
// lesson itself (drill, dust-dash, lane) lives in
//   js/game/scenes/locations/skye/skyeCladach.js
// This file only holds her placement and her conversation.
//
// The dialogues array is generated from
//   tools/dialogue/drafts/skyeCladach.dlg
// Do not hand-edit it: edit the draft and recompile:
//   node tools/dialogue/compile.mjs tools/dialogue/drafts/skyeCladach.dlg
// Everything else here (position, radius, visual) is hand-maintained.
//
// ── NOTES ─────────────────────────────────────────────────────────────────
//   drill_start          -- dialogue: player is ready; the drill begins
//   drill_done           -- scene: drill finished, she has dashed up the lane
//   lesson_movement      -- scene: player reached her at the top of the lane
//   uathach_told_machaire -- dialogue: she has pointed them onward
//   leave_skye           -- boat dialogue: one-off; the scene clears it
//                           and starts the crossing back to the mainland
//
// TWO SPEAKERS: Uathach (skyeCladach.dlg, @encounter 0) and the boat
// (skyeCladachBoat.dlg, @encounter 1). Keep `dialogues` the last field of
// each -- the compiler finds each array's end from the next one.

export const skyeCladachContent = {
  objects: [],
  npcs:    [],
  fixedEncounters: [
    {
      id: 'uathach',
      // On the headland top, just right of where the hidden stair comes
      // out (16,21): the player sees her above the wall from the landing,
      // and her calls bring them up beside her.
      x: 17, y: 20,
      radius: 2,
      visual:   { gid: 9201, flat: false },
      portrait: '/assets/npcs/sorcha.png',
      dialogues: [

        // ── node 0 — the landing ──────────────────────────────────
        {
          continue: true,
          ga: 'Bhuel. Scaoil an fharraige uaithi thú.\nIs mise Uathach, iníon Scáthaí.',
          en: 'So. The sea gave you up.\nI am Uathach, daughter of Scáthach.',
        },

        // ── node 1 — first, an order ──────────────────────────────
        {
          requires: { noteAbsent: 'drill_start' },
          hold: true,
          ga: 'Tá mo mháthair ag fanacht ag an dún.\nAch ar dtús, feicfimid an féidir leat ordú a leanúint.',
          en: 'My mother is waiting at the dún.\nBut first, let\'s see if you can follow an order.',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              note: 'drill_start',
              exit: true,
              ga: 'Réidh.',
              en: 'Ready.',
            },
            {
              first: true,
              ga: 'Cé hí Scáthach?',
              en: 'Who is Scáthach?',
              say: 'Cé hí Scáthach?',
              sayEn: 'Who is Scáthach?',
              replyGa: 'An múinteoir arm is fearr ar domhan.\nAgus an ceann is crua.',
              replyEn: 'The finest teacher of arms in the world.\nAnd the hardest.',
            },
          ],
        },

        // ── node 1a — the top, a clean climb ──────────────────────
        {
          requires: { note: 'climb_clean', noteAbsent: 'pep_done' },
          hold: true,
          ga: 'Níor chaill tú céim.\nFáilte go Scí. Ní thagann mórán an bealach seo. Tháinig tusa.\nMás furasta a bhí sé, ar aghaidh linn. Más mian leat tuilleadh, bíonn tuilleadh ann i gcónaí.',
          en: 'You didn\'t miss a step.\nWelcome to Skye. Not many come this way. You did.\nIf that was easy, on we go. If you want more, there\'s always more.',
          options: [
            {
              note: 'go_loch',
              exit: true,
              ga: 'Ar aghaidh chuig an loch.',
              en: 'On to the loch.',
            },
            {
              note: 'go_garden',
              exit: true,
              ga: 'Chuig an ngairdín ar dtús.',
              en: 'To the garden first.',
            },
          ],
        },

        // ── node 1b — the top, a harder climb ─────────────────────
        {
          requires: { note: 'climb_rough', noteAbsent: 'pep_done' },
          hold: true,
          ga: 'Ní raibh sé sin éasca. Is cuma.\nFáilte go Scí. Ní thagann mórán an bealach seo. Tháinig tusa.\nTá gairdín thiar ansin. Cleachtfaimid ann chomh fada agus is mian leat.',
          en: 'That wasn\'t easy. No matter.\nWelcome to Skye. Not many come this way. You did.\nThere\'s a garden over west. We\'ll practise there as long as you like.',
          options: [
            {
              note: 'go_garden',
              exit: true,
              ga: 'Chuig an ngairdín.',
              en: 'To the garden.',
            },
            {
              note: 'go_loch',
              exit: true,
              ga: 'Ar aghaidh chuig an loch.',
              en: 'On to the loch.',
            },
          ],
        },

        // ── node 2 — mid-lesson ───────────────────────────────────
        {
          requires: { note: 'drill_start', noteAbsent: 'lesson_movement' },
          hold: true,
          ga: 'Éist, agus bog.',
          en: 'Listen, and move.',
        },

        // ── node 3 — onward ───────────────────────────────────────
        {
          requires: { note: 'lesson_movement', noteAbsent: 'uathach_told_machaire' },
          note: 'uathach_told_machaire',
          continue: true,
          ga: 'Thall ansin tá an machaire. Bíonn na daltaí eile ag díomhaoineas ann.\nTaispeánfaidh Feardiad duit conas a dhéantar rudaí anseo.\nTaobh thall díobh tá an droichead fada, agus mo mháthair ar an taobh eile de.',
          en: 'Beyond is the machaire. The other students idle there.\nFeardiad will show you how things are done here.\nPast them is the long bridge, and my mother beyond it.',
        },

        // ── node 4 — after ────────────────────────────────────────
        {
          requires: { note: 'uathach_told_machaire' },
          hold: true,
          ga: 'Ar aghaidh leat. Ní iompróidh mé thú.',
          en: 'Go on. I\'ll not carry you.',
        },

      ],
    },
    {
      id: 'boat',
      // The jetty head. The boat itself is drawn by ShoreProps (moored
      // across the head, row 34); this is only its conversation, so the
      // flag is hidden at runtime and the gid serves the moon badge.
      // Its dialogue sets `leave_skye`, which the scene acts on.
      x: 18, y: 33,
      radius: 1.3,
      visual:   { gid: 9202, flat: false },
      portrait: '/assets/boat.png',
      dialogues: [

        // ── node 0 — the boat ─────────────────────────────────────
        {
          hold: true,
          ga: 'An bád a thug anseo thú.\nThabharfadh sé ar ais thar farraige thú.',
          en: 'The boat that brought you here.\nIt would take you back across the sea.',
          options: [
            {
              note: 'leave_skye',
              exit: true,
              ga: 'Fág an t-oileán.',
              en: 'Leave the island.',
            },
            {
              exit: true,
              ga: 'Ní fós.',
              en: 'Not yet.',
            },
          ],
        },

      ],
    },
  ],
}
