// skyeLoch.js
// Location: public/data/skye/skyeLoch.js
//
// The loch: Uathach's tap-to-move lesson (js/game/scenes/locations/skye/
// skyeLoch.js runs it; her lines during it are captions). This file only
// holds her placement and what she says if tapped.
//
// The dialogues array is generated from tools/dialogue/drafts/skyeLoch.dlg
//   node tools/dialogue/compile.mjs tools/dialogue/drafts/skyeLoch.dlg

export const skyeLochContent = {
  objects: [],
  npcs:    [],
  fixedEncounters: [
    {
      id: 'uathach',
      // Round A: across the first pool, on the middle bank. The scene
      // dashes her to her round-B spot and off again (uathachSpots in the
      // map JSON).
      x: 18, y: 15,
      radius: 1,
      visual:   { gid: 9201, flat: false },
      portrait: '/assets/npcs/sorcha.png',
      dialogues: [

        // ── node 0 — at the loch ──────────────────────────────────
        {
          hold: true,
          ga: 'Ní ar do chosa.\nFéach ar an áit a bhfuil tú ag dul.',
          en: 'Not at your feet.\nLook where you\'re going.',
        },

      ],
    },
  ],
}
