// Level and scene music — separate from champion themes

export const levelTunes = {

    myLaganLove: `X: 2
T: My Lagan Love
R: air
M: 2/4
L: 1/8
K: Cmaj
3de/f/|g3d cB/G/|F3G Bc/d/|c3B (G>G|G3)d/e/ fe/f/|
g3d cB/G/|F3G Bc/d/|c3B G>G|G3G Bc|
e3d dc/B/|c4 ef|g3c ed/e/|^fg g_b g=f|
g3d (3cBG|F3G Bc/d/|c3B G>G|G4||`,

    // Constellation scene ambient drone — C Dorian held chord.
    // R:drone → ENSEMBLE_PRESETS.drone = [92, 94] (Pad Bowed + Pad Halo).
    // TEMPO_SETTINGS.drone = 8000ms/measure.
    // M:4/4, L:1/4 (quarter note default), whole note = 4 beats = 1 measure = 8s.
    // 8 measures × 8s = 64s tuneDuration — long enough that looping is seamless.
    constellationDrone: `X: 3
T: Constellation Drone
R: drone
M: 4/4
L: 1/4
K: Cmaj
[C,G,_E]4 | [C,G,_E]4 | [C,G,_E]4 | [C,G,_E]4 |
[C,G,_E]4 | [C,G,_E]4 | [C,G,_E]4 | [C,G,_E]4 |`,

};

