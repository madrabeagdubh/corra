/**
 * ALTERNATIVE TUNE CONFIG
 * Soft, round, and distinct from traditional Irish setup
 * Gentle instrumentation, each mode has its own BPM and texture
 */

export const LOOP_PROGRESSIONS = {
    default: [
        { name: "Soft Piano Intro", voices: [1], description: "Gentle beginning" },
        { name: "+ String Ensemble", voices: [1, 2], description: "Warm harmonic support" },
        { name: "+ Contrabass Layer", voices: [1, 2, 3], description: "Depth added" },
        { name: "Full Texture", voices: [1, 2, 3], description: "Complete sound" }
    ],

    lament: [
        { name: "Solo Contrabass", voices: [3], description: "Low mournful" },
        { name: "+ Flute Line", voices: [2, 3], description: "Airy grief" },
        { name: "+ Soft Organ Pad", voices: [1, 2, 3], description: "Weight settles" },
        { name: "Aftermath", voices: [1, 2, 3], description: "Gentle closure" }
    ],

    slide: [
        { name: "Nylon Guitar Lead", voices: [1], description: "Smooth articulation" },
        { name: "+ Clarinet Harmony", voices: [1, 2], description: "Rich blend" },
        { name: "+ Contrabass Depth", voices: [1, 2, 3], description: "Subtle grounding" },
        { name: "Slide Texture", voices: [1, 2, 3], description: "Complete melodic layer" }
    ],

    reel: [
        { name: "Clean Electric Guitar", voices: [1], description: "Bright motion" },
        { name: "+ Vibraphone Accent", voices: [1, 2], description: "Light shimmer" },
        { name: "+ Soft Strings", voices: [1, 2, 3], description: "Warm support" },
        { name: "Energetic Texture", voices: [1, 2, 3], description: "Full lively sound" }
    ],

    ambient: [
        { name: "Soft Pipe Organ", voices: [1], description: "Ethereal atmosphere" },
        { name: "+ Celesta Bells", voices: [1, 2], description: "Sparkling layers" },
        { name: "+ Contrabass Pad", voices: [1, 2, 3], description: "Smooth low support" },
        { name: "Ambient Texture", voices: [1, 2, 3], description: "Full gentle ambience" }
    ]
};

/**
 * MIDI instruments — soft, round, distinct from tradTuneConfig
 */
export const INSTRUMENTS = {
    1:  { name: "Soft Piano", short: "Piano", type: "melody" },
    2:  { name: "Nylon Guitar", short: "Guitar", type: "melody" },
    3:  { name: "Clean Electric Guitar", short: "E-Guitar", type: "melody" },
    4:  { name: "Clarinet", short: "Clarinet", type: "melody" },
    5:  { name: "Flute", short: "Flute", type: "melody" },
    6:  { name: "Contrabass", short: "Bass", type: "bass" },
    7:  { name: "String Ensemble 1", short: "Strings", type: "harmony" },
    8:  { name: "Vibraphone", short: "Vibe", type: "texture" },
    9:  { name: "Celesta", short: "Celesta", type: "texture" },
    10: { name: "Pipe Organ (Soft)", short: "Organ", type: "harmony" }
};

/**
 * Tempo for each mode
 */
export const TEMPO_OVERRIDES = {
    default: 100,
    lament: 55,
    slide: 115,
    reel: 155,
    ambient: 80
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

    // Assign instruments per mode
    let instruments;
    switch(tuneType) {
        case 'default': instruments = [1, 7, 6]; break;   // Piano, Strings, Contrabass
        case 'lament':  instruments = [6, 5, 10]; break;  // Contrabass, Flute, Soft Organ
        case 'slide':   instruments = [2, 4, 6]; break;   // Nylon Guitar, Clarinet, Contrabass
        case 'reel':    instruments = [3, 8, 7]; break;   // Electric Guitar, Vibraphone, Strings
        case 'ambient': instruments = [10, 9, 6]; break;  // Soft Organ, Celesta, Contrabass
        default:       instruments = [1, 7, 6]; break;
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
