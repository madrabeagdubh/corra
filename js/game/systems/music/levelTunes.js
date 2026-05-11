// Level and scene music — separate from champion themes

export const levelTunes = {

  myLaganLove: `X: 2
T: My Lagan Love (Extended)
R: air
M: 2/4
L: 1/8
Q: "Rubato" 1/4=60
K: Cmaj
{d}e/f/ | [C,G,g]3d (3[E,c]BG | [F,,C,F]3G [G,,D,B]c/d/ | [C,G,c]3B ([G,,D,G]>G | [C,G,G]3) {d}e/f/ |
[C,G,g]3d (3[E,c]BG | [F,,C,F]3G [G,,D,B]c/d/ | [C,G,c]3B ([G,,D,G]>G | [C,G,G]3) G Bc |
[A,,E,e]3d [G,,D,d]c/B/ | [F,,C,c]4 {g}ef | [C,G,g]3c [B,,G,e]d/e/ | [^F,,D,^f]g [G,,D,g]_b [G,,D,g]=f |
[C,G,g]3d (3[E,c]BG | [F,,C,F]3G [G,,D,B]c/d/ | [C,G,c]3B ([G,,D,G]>G | [C,G,G]4 |
[C,G,c']3b (3[E,a]ge | [F,C,f]3g [G,D,b]c'/d'/ | [C,G,c']3b ([G,D,g]>g | [C,G,g]3) {g'}a/b/ |
[C,G,c']3b (3[E,a]ge | [F,C,f]3g [G,D,b]c'/d'/ | [C,G,c']3b ([G,D,g]>g | [C,G,g]3) g bc' |
[A,E,e']3d' [G,D,d']c'/b/ | [F,C,c']4 {g'}a/b/ | [C,G,c']3c' [B,G,e']d'/e'/ | [^F,D,^f']g' [G,D,g']_b' [G,D,g']=f' |
[C,G,c']3b (3[E,a]ge | [F,C,f]3g [G,D,b]c'/d'/ | [C,G,c']3b ([G,D,g]>g | [C,G,g]4 ||`,

  // ─── DING DONG — plain source (kept) ─────────────────────────────────────
  dingDong: `X: 1
T: Ding Dong Dederó
R: reel
M: 4/4
L: 1/8
K: Dmaj
d2 A2 BG G2|A2 A2 c2 d2|d2 A2 BG AF|G2 F2 G2 A2|
d2 A2 BG G2|A2 A2 c2 d2|dd A2 BG AF|G2 F2 G4:|
|:A2 A2 B2 AG|A2 A2 f2 ef|g2 f2 e2 dc|A2 A2 c2 d2|
A2 A2 B2 AG|A2 A2 f2 ef|g2 f2 e2 dc|A2 A2 c2 de|
d2 A2 BG G2|A2 A2 c2 d2|d2 A2 BG AF|G2 F2 G2 A2|
d2 A2 BG G2|A2 A2 c2 d2|dd A2 BG AF|G2 F2 G4:|`,

  // ─── DING DONG DEDERÓ — slow dirge treatment ─────────────────────────────
  //
  // Based faithfully on the source tune (session.org D major version).
  // NOT a hornpipe. A smith's working song, treated as a slow air.
  //
  // Character:
  //   — Very slow. Every note has weight. The hammer barely lifts.
  //   — D dorian feel: C natural throughout (flattened 7th).
  //     This is the note that makes it dark and modal rather than bright.
  //   — Low register throughout. The B part stays down an octave from usual.
  //   — Sustained drone D and A in the bass, written as held notes
  //     alongside the melody using chord notation.
  //   — Grace notes and ornaments on offbeats and approach notes ONLY.
  //     The main downbeats land clean and bare. Never interrupt the pulse.
  //   — Harmonies are low thirds, not high sixths. Warm not bright.
  //
  // Structure:
  //   VERSE 1  (24 bars) — Bare melody. Steel drums alone. Almost no ornament.
  //                         Drone D pedal in the left hand register.
  //   VERSE 2  (24 bars) — Banjo joins. Low harmonies. More grace notes now,
  //                         crowding the offbeats and approach notes.
  //   BRIDGE   ( 8 bars) — Bare A phrase again, stripped, with long rests.
  //                         The hammer pauses. Silence is part of the music.
  //   VERSE 3  (24 bars) — Full ensemble. Deep harmonies. Bassoon drones.
  //                         Most ornamented — but always on the margins.
  //   CODA     ( 8 bars) — A phrase only. Slowing. Ends on long held D.
  //
  // Uses forge_village_deep preset [114, 105, 53, 92, 70]
  // Tempo: forge_village_deep = 4200ms/bar — very slow indeed
  //
  dingDongVillage: `X: 5
T: Ding Dong Dederó (Dirge)
R: forge_village_deep
M: 4/4
L: 1/8
K: Ddor
% K:Ddor = D dorian: D E F G A B C D
% C natural (not C#) gives the dark modal colour.
% ════════════════════════════════════════════════════════════
% VERSE 1 — Bare. Steel drums. Drone D underneath.
% The tune arrives slowly, like smoke from a forge.
% Main notes clean. Grace notes only on approach.
% ════════════════════════════════════════════════════════════
[D,A,]8|
[D,A,]4 {E}d4|{e}d2 A2 BG G2|[D,A,]2 A2 c2 {B}d2|
{e}d2 A2 BG AF|[D,A,]2 F2 G2 A2|
{e}d2 A2 BG G2|[D,A,]2 A2 c2 {B}d2|
{e}d2 A2 BG AF|[D,A,]2 F2 G4|
[D,A,]2 A2 B2 AG|A2 A2 f2 {g}ef|
[D,A,]4 e2 dc|A2 A2 c2 d2|
[D,A,]2 A2 B2 AG|A2 A2 f2 {g}ef|
[D,A,]4 e2 dc|A2 A2 c2 de|
{e}d2 A2 BG G2|[D,A,]2 A2 c2 {B}d2|
{e}d2 A2 BG AF|[D,A,]2 F2 G2 A2|
{e}d2 A2 BG G2|[D,A,]2 A2 c2 {B}d2|
{e}d2 A2 BG AF|[D,A,]2 F2 G4|
% ════════════════════════════════════════════════════════════
% VERSE 2 — Banjo joins. Low harmonies (thirds below).
% Grace notes crowd the offbeats now — between the blows.
% Still the main notes land bare and heavy.
% ════════════════════════════════════════════════════════════
[D,A,]8|
[D,A,]4 {E}[df]4|{e}[df]2 [AF]2 [BG]G {A}G2|[D,A,]2 [AF]2 [ce]2 {B}[df]2|
{e}[df]2 [AF]2 [BG][AF]|[D,A,]2 [FD]2 [GE]2 A2|
{e}[df]2 [AF]2 [BG]G {A}G2|[D,A,]2 [AF]2 [ce]2 {B}[df]2|
{e}[df]2 [AF]2 [BG][AF]|[D,A,]2 [FD]2 [GE]4|
[D,A,]2 [AF]2 [BG]2 {B}[AF]G|[AF]2 [AF]2 [fd]2 {g}[ea][fd]|
[D,A,]4 [ea]2 [dc]|[AF]2 [AF]2 [ce]2 [df]2|
[D,A,]2 [AF]2 [BG]2 {B}[AF]G|[AF]2 [AF]2 [fd]2 {g}[ea][fd]|
[D,A,]4 [ea]2 [dc]|[AF]2 [AF]2 [ce]2 [df][ea]|
{e}[df]2 [AF]2 [BG]G {A}G2|[D,A,]2 [AF]2 [ce]2 {B}[df]2|
{e}[df]2 [AF]2 [BG][AF]|[D,A,]2 [FD]2 [GE]2 A2|
{e}[df]2 [AF]2 [BG]G {A}G2|[D,A,]2 [AF]2 [ce]2 {B}[df]2|
{e}[df]2 [AF]2 [BG][AF]|[D,A,]2 [FD]2 [GE]4|
% ════════════════════════════════════════════════════════════
% BRIDGE — Stripped. Long rests. The hammer pauses.
% Just the A phrase, bare, with space around each note.
% Silence is part of this music.
% ════════════════════════════════════════════════════════════
[D,A,]8|
{e}d4 z2 A2|BG z2 G4|
A4 z2 c2|{B}d4 z4|
{e}d4 A2 z2|BG AF z4|
[D,A,]4 G4|[D,,D,A,D]8|
% ════════════════════════════════════════════════════════════
% VERSE 3 — Full ensemble. Voices, pad, bassoon.
% Most ornamented — grace notes crowd every margin.
% But the main beats still land bare and deep.
% The bassoon drones the root. The pad sustains.
% Low harmonies throughout. Nothing climbs high.
% ════════════════════════════════════════════════════════════
[D,,D,A,D]8|
[D,A,]4 {E}[df]4|{e}[df]2 [AF]2 {A}[BG][BG] {B}[GE]2|[D,A,]2 [AF]2 [ce]2 {B}[df]2|
{e}[df]2 [AF]2 {A}[BG][AF]|[D,A,]2 [FD]2 [GE]2 {A}[FA]2|
{e}[df]2 [AF]2 {A}[BG][BG] {B}[GE]2|[D,A,]2 [AF]2 [ce]2 {B}[df]2|
{e}[df]2 [AF]2 {A}[BG][AF]|[D,A,]2 [FD]2 [GE]4|
[D,A,]2 [AF]2 {A}[BG]2 {B}[AF][BG]|[AF]2 [AF]2 [fd]2 {g}[ea][fd]|
[D,A,]4 {e}[ea]2 {d}[dc]|[AF]2 [AF]2 [ce]2 [df]2|
[D,A,]2 [AF]2 {A}[BG]2 {B}[AF][BG]|[AF]2 [AF]2 [fd]2 {g}[ea][fd]|
[D,A,]4 {e}[ea]2 {d}[dc]|[AF]2 [AF]2 [ce]2 {d}[df][ea]|
{e}[df]2 [AF]2 {A}[BG][BG] {B}[GE]2|[D,A,]2 [AF]2 [ce]2 {B}[df]2|
{e}[df]2 [AF]2 {A}[BG][AF]|[D,A,]2 [FD]2 [GE]2 {A}[FA]2|
{e}[df]2 [AF]2 {A}[BG][BG] {B}[GE]2|[D,A,]2 [AF]2 [ce]2 {B}[df]2|
{e}[df]2 [AF]2 {A}[BG][AF]|[D,A,]2 [FD]2 [GE]4|
% ════════════════════════════════════════════════════════════
% CODA — A phrase only. Slowing. Grace notes bare now.
% The hammer slows. One last D, held long.
% The fire settles.
% ════════════════════════════════════════════════════════════
[D,A,]8|
{e}d2 A2 BG G2|[D,A,]2 A2 c2 {B}d2|
{e}d2 A2 BG AF|[D,A,]2 F2 G2 A2|
{e}d2 A2 BG G2|[D,A,]2 A2 c2 d2|
d2 A2 BG AF|[D,,D,A,D]8|`,

};

