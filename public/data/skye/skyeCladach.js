// skyeCladach.js
// Location: public/data/skye/skyeCladach.js
//
// The shore of Skye, where the boat lands. Conall, the Warden, greets them:
// he invites them up the harbour wall and they find the stair for themselves.
// (Uathach, Scáthach's daughter, stays on the green's dais until the tournament.)
// The climb itself lives in
//   js/game/scenes/locations/skye/skyeCladach.js
// This file only holds his placement and his conversation.
//
// The dialogues array is generated from
//   tools/dialogue/drafts/skyeCladach.dlg
// Do not hand-edit it: edit the draft and recompile:
//   node tools/dialogue/compile.mjs tools/dialogue/drafts/skyeCladach.dlg
// Everything else here (position, radius, visual) is hand-maintained.
//
// ── NOTES ─────────────────────────────────────────────────────────────────
//   climb_started        -- dialogue: "I'm coming"; he leaves them to the wall
//   climb_top            -- scene: they're on top of the wall; opens the pep talk
//   leave_skye           -- boat dialogue: one-off; the scene clears it
//                           and starts the crossing back to the mainland
//
// TWO SPEAKERS: Conall (skyeCladach.dlg, @encounter 0) and the boat
// (skyeCladachBoat.dlg, @encounter 1). Keep `dialogues` the last field of
// each -- the compiler finds each array's end from the next one.

export const skyeCladachContent = {
  objects: [],
  npcs:    [],
  fixedEncounters: [
    {
      id: 'conall',
      // On the headland top, just right of where the hidden stair comes
      // out (16,21): the player sees him above the wall from the landing,
      // and his calls bring them up beside him.
      x: 17, y: 20,
      radius: 2,
      visual:   { gid: 9203, flat: false },
      portrait: '/assets/npcs/othran.png',
      dialogues: [

        // ── node 0 — the landing ──────────────────────────────────
        {
          continue: true,
          ga: 'Bhuel. Scaoil an fharraige uaithi thú.\nIs mise Conall. Coimeádaim an fhaiche d\'Uathach, iníon Scáthaí.',
          en: 'So. The sea gave you up.\nI am Conall. I keep the green for Uathach, Scáthach\'s daughter.',
        },

        // ── node 1 — the top ──────────────────────────────────────
        {
          requires: { note: 'climb_top', noteAbsent: 'pep_done' },
          hold: true,
          ga: 'Fuair tú an staighre.\nFáilte go Scí. Ní thagann mórán an bealach seo. Tháinig tusa.\nTá gairdín thiar ansin, mar a mhúinim na chéad cheachtanna. Ní thiocfaidh Uathach anuas dóibh siúd. Feicfidh tú í ag an gcomórtas.',
          en: 'You found the stair.\nWelcome to Skye. Not many come this way. You did.\nThere\'s a garden over west, where I teach the first lessons. Uathach won\'t come down for those. You\'ll see her at the tournament.',
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

        // ── node 2 — the invitation ───────────────────────────────
        {
          requires: { noteAbsent: 'climb_started' },
          hold: true,
          ga: 'Tá an balla seo sean, agus staighre ann áit éigin. Tar aníos nuair a bheidh tú réidh.',
          en: 'The wall is old, and there\'s a stair in it somewhere. Come up when you\'re ready.',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              note: 'climb_started',
              exit: true,
              ga: 'Tagaim aníos.',
              en: 'I\'m coming.',
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

        // ── node 2a — on the wall ─────────────────────────────────
        {
          requires: { note: 'climb_started' },
          hold: true,
          ga: 'Tar aníos.',
          en: 'Come up.',
        },

      ],
    },
    // (the ogham stones have no encounters: the scene captions them as you walk up -- oghamMarks.js)
    {
      id: 'boat',
      // The jetty head. The boat itself is drawn by ShoreProps (moored
      // across the head, row 34); this is only its conversation, so the
      // flag is hidden at runtime and the gid serves the moon badge.
      // Its dialogue sets `leave_skye`, which the scene acts on.
      x: 18, y: 33,
      radius: 2.4,
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
