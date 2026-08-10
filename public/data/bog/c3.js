// c3Ford.js
// Location: public/data/bog/c3Ford.js
//
// Odhrán at the ford. SKELETON ONLY -- the dialogues array below is
// generated from tools/dialogue/drafts/c3Ford.dlg. Do not hand-edit the
// dialogue here; edit the draft and recompile:
//
//   node tools/dialogue/compile.mjs tools/dialogue/drafts/c3Ford.dlg
//
// Everything OUTSIDE the dialogues array -- id, position, radius, visual --
// is hand-maintained and the compiler leaves it alone.
//
// PLACEMENT IS A PLACEHOLDER. Odhrán should be on the near bank of the
// ford, on the flat rock the satire mocks him for resembling, and NOT on
// a crossing tile: checkProximityInteractions returns early when a door or
// exit is in range, so an encounter sharing a transition tile can never be
// spoken to. Same trap that buried Cormac under the hall door in b0.
//
// He is lying down. If the sprite ends up standing, node 0 reads wrong --
// the whole opening beat is that the toll-man does not get up.
//
// ── NOTES THIS ENCOUNTER USES ─────────────────────────────────────────────
//
//   READS
//     has_druid_word        -- set at d3Sea node 4. Puts the one-tap bypass
//                              on node 0. Using it skips the entire scene,
//                              which is the intended trap.
//   SETS
//     met_odhran            -- seen him on the ground
//     asked_wound           -- "struck with words"
//     used_druid_word       -- took the bypass and learned nothing
//     asked_odhran_why      -- opens node 2 (the feast)
//     knows_odhran_shame    -- Séadna named; connectable to the ráth
//     knows_odhran_binding  -- opens node 3 (the reckoning)
//     knows_odhran_cave     -- he has somewhere to disappear to
//     has_toll_rope         -- the rope, given freely
//
// has_toll_rope is the only one with a physical consequence. If rope is to
// be a real item rather than a fact, it needs wiring wherever inventory
// lives -- the note alone will not put it in the player's hands.

export const c3FordContent = {

  fixedEncounters: [
    {
      id: 'odhran',
      name: 'Odhrán',
      // PLACEHOLDER -- near bank, clear of the crossing tiles.
      x: 28, y: 30,
      radius: 3,
      // PLACEHOLDER art. `portrait` loads by URL and fails loudly; the GID
      // tile path fails silently, so always set both.
      visual:   { gid: 9104, flat: false },
      portrait: '/assets/npcs/muireann.png',

      dialogues: [
      ],
    },
  ],

  npcs: [],
  objects: [],
  introNarrative: [],
}

