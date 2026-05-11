// villageMusic.js
// Mute/unmute orchestration for dingDongVillage dirge treatment.
//
// Structure:
//   Verse 1  24 bars — Steel Drums alone         (bars 1-24)
//   Verse 2  24 bars — Banjo joins               (bar 25)
//   Bridge    8 bars — all carry through         (bars 49-56)
//   Verse 3  24 bars — Voices (57), Pad (65), Bassoon (73)
//   Coda      8 bars — wind-down                 (bars 81-88)
//
// Tempo: 4200ms/bar
//
// Track map ([114, 105, 53, 92, 70]):
//   0: Steel Drums  — always on
//   1: Banjo        — bar 25
//   2: Voice Oohs   — bar 57
//   3: Pad Bowed    — bar 65
//   4: Bassoon      — bar 73 — joins last, drones the root

const MS = 4200; // ms per bar

const CUE = {
    banjoIn:   24 * MS,
    voiceIn:   56 * MS,
    padIn:     64 * MS,
    bassoonIn: 72 * MS,
    codaStart: 80 * MS,
};

let _timers  = [];
let _running = false;

export function startVillageMusic(player) {
    if (_running) return;
    _running = true;

    console.log('[VillageMusic] Dirge. Cues (seconds):',
        Object.fromEntries(Object.entries(CUE).map(([k,v]) => [k, (v/1000).toFixed(1)]))
    );

    _timers.push(setTimeout(() => _unmute(player, 1, 'Banjo'),      CUE.banjoIn));
    _timers.push(setTimeout(() => _unmute(player, 2, 'Voice Oohs'), CUE.voiceIn));
    _timers.push(setTimeout(() => _unmute(player, 3, 'Pad Bowed'),  CUE.padIn));
    _timers.push(setTimeout(() => _unmute(player, 4, 'Bassoon'),    CUE.bassoonIn));

    // Coda wind-down — reverse order, two bars apart
    _timers.push(setTimeout(() => _mute(player, 3, 'Pad Bowed'),  CUE.codaStart));
    _timers.push(setTimeout(() => _mute(player, 2, 'Voice Oohs'), CUE.codaStart + 2 * MS));
    _timers.push(setTimeout(() => _mute(player, 1, 'Banjo'),      CUE.codaStart + 4 * MS));
    _timers.push(setTimeout(() => _mute(player, 4, 'Bassoon'),    CUE.codaStart + 6 * MS));
}

export function windDownVillageMusic(player, onComplete) {
    _timers.forEach(t => clearTimeout(t));
    _timers  = [];
    _running = false;

    if (!player) { if (onComplete) onComplete(); return; }

    [3, 2, 1, 4].forEach((idx, i) => {
        _timers.push(setTimeout(() => {
            _mute(player, idx, player.tracks[idx]?.name || String(idx));
        }, i * MS));
    });

    if (onComplete) setTimeout(onComplete, 5 * MS);
}

export function stopVillageMusic() {
    _timers.forEach(t => clearTimeout(t));
    _timers  = [];
    _running = false;
}

function _unmute(player, index, label) {
    if (!player?.tracks?.[index]) return;
    if (!player.tracks[index].active) {
        console.log(`[VillageMusic] Unmuting ${label} (track ${index})`);
        player.toggleInstrument(index);
    }
}

function _mute(player, index, label) {
    if (!player?.tracks?.[index]) return;
    if (player.tracks[index].active) {
        console.log(`[VillageMusic] Muting ${label} (track ${index})`);
        player.toggleInstrument(index);
    }
}

