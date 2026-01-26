/**
 * ORGAN / SHADOW VARIANT
 * Gothic, ritualistic, non-session instrumentation
 * Intended for combat, dread, liminal spaces
 *
 * Explicitly avoids instruments used in tradTuneConfig:
 * (Banjo, Fiddle, Concertina, Harp, Guitar, Cello,
 *  Whistle, Flute, Accordion, Piano)
 */

export const LOOP_PROGRESSIONS = {
    combat: [
        { name: "Low Organ Drone", voices: [2], description: "Pressure builds" },
        { name: "+ Bass Weight", voices: [2, 3], description: "Threat embodied" },
        { name: "+ Clarinet Cry", voices: [1, 2, 3], description: "Blades cross" },
        { name: "Relentless", voices: [1, 2, 3], description: "No retreat" }
    ],

    ritual: [
        { name: "Solo Organ", voices: [2], description: "Invocation" },
        { name: "+ Glass Harmonics", voices: [2, 3], description: "Otherworld resonance" },
        { name: "+ Clarinet Signal", voices: [1, 2, 3], description: "Veil thins" },
        { name: "Possession", voices: [1, 2, 3], description: "Crossing complete" }
    ],

    lament: [
        { name: "Solo Clarinet", voices: [1], description: "Mourning breath" },
        { name: "+ Organ Chords", voices: [1, 2], description: "Weight of memory" },
        { name: "+ Low Strings", voices: [1, 2, 3], description: "Grief settles" },
        { name: "Aftermath", voices: [1, 2, 3], description: "What remains" }
    ],

    march: [
        { name: "Organ Pulse", voices: [2], description: "Measured steps" },
        { name: "+ Bass Tread", voices: [2, 3], description: "Approach" },
        { name: "+ Clarinet Edge", voices: [1, 2, 3], description: "Resolve hardens" },
        { name: "Iron Will", voices: [1, 2, 3], description: "Point of no return" }
    ],

    default: [
        { name: "Organ Drone", voices: [2], description: "Unease" },
        { name: "+ Clarinet", voices: [1, 2], description: "Attention drawn" },
        { name: "+ Bass Depth", voices: [1, 2, 3], description: "Commitment" },
        { name: "Full Texture", voices: [1, 2, 3], description: "Engaged" }
    ]
};

/**
 * MIDI instruments — none overlap with tradTuneConfig
 */
export const INSTRUMENTS = {
    19: { name: "Pipe Organ", short: "Organ", type: "harmony" },
    71: { name: "Clarinet", short: "Clarinet", type: "melody" },
    48: { name: "String Ensemble 1", short: "Strings", type: "bass" },
    99: { name: "Atmospheric FX", short: "Atmos", type: "texture" }
};

/**
 * Tempo philosophy:
 * Slower than dance music
 * Faster than dirges
 * Emphasis on inevitability
 */
export const TEMPO_OVERRIDES = {
    ritual: 48,     // Suspended, breath-based
    lament: 42,     // Heavy and slow
    march: 78,      // Deliberate, martial
    combat: 132,    // Driving, oppressive
    default: 88
};

export function prepareTuneData(tuneName, singleVoiceAbc, tuneType = 'default') {
    let cleanAbc = singleVoiceAbc.replace(/^Q:.*$/gm, '');
    let bpm = TEMPO_OVERRIDES[tuneType] || TEMPO_OVERRIDES.default;

    const lines = cleanAbc.split('\n');
    const outputLines = [];
    let foundX = false;

    for (const line of lines) {
        if (line.match(/^X:\s*\d+/)) {
            outputLines.push(line);
            outputLines.push(`Q:1/4=${bpm}`);
            foundX = true;
        } else if (!line.match(/^Q:/)) {
            outputLines.push(line);
        }
    }

    cleanAbc = outputLines.join('\n');

    console.log(
        `[tradTuneConfig.organ] ${tuneType.toUpperCase()}: Q:1/4=${bpm}`
    );

    const multiVoiceAbc = createMultiVoiceAbc(cleanAbc, tuneType, bpm);
    const progression = LOOP_PROGRESSIONS[tuneType] || LOOP_PROGRESSIONS.default;

    return {
        name: tuneName,
        type: tuneType,
        abc: multiVoiceAbc,
        bpm,
        progression
    };
}

function createMultiVoiceAbc(abc, tuneType, bpm) {
    const lines = abc.split('\n');
    const header = [];
    const melody = [];
    let inMelody = false;

    lines.forEach(line => {
        if (line.match(/^[A-Z]:/) && !line.startsWith('Q:')) {
            header.push(line);
        } else if (line.match(/^\|/) || inMelody) {
            inMelody = true;
            melody.push(line);
        }
    });

    const result = [header[0], `Q:1/4=${bpm}`, ...header.slice(1)];

    let instruments;

    if (tuneType === 'combat') {
        instruments = [71, 19, 48]; // Clarinet, Organ, Strings
    } else if (tuneType === 'ritual') {
        instruments = [71, 19, 99]; // Clarinet, Organ, Atmos
    } else if (tuneType === 'lament') {
        instruments = [71, 19, 48];
    } else if (tuneType === 'march') {
        instruments = [71, 19, 48];
    } else {
        instruments = [71, 19, 48];
    }

    result.push(`V:1 name="${INSTRUMENTS[instruments[0]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[0]}`);
    result.push(`V:2 name="${INSTRUMENTS[instruments[1]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[1]}`);
    result.push(`V:3 name="${INSTRUMENTS[instruments[2]].short}" clef=bass`);
    result.push(`%%MIDI program ${instruments[2]}`);

    melody.forEach(line => result.push(`[V:1] ${line}`));
    melody.forEach(line => result.push(`[V:2] ${line}`));
    melody.forEach(line => result.push(`[V:3] ${line}`));

    return result.join('\n');
}

export function getRandomInstrument(type) {
    const instrumentsOfType = Object.entries(INSTRUMENTS)
        .filter(([_, info]) => info.type === type)
        .map(([num]) => parseInt(num));

    return instrumentsOfType[
        Math.floor(Math.random() * instrumentsOfType.length)
    ];
}
