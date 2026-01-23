// js/game/systems/music/tradTuneConfig.js

/**
 * Configuration for Irish Trad tunes
 * Defines loop progressions and instrument assignments
 */

// Standard loop progressions for different tune types
export const LOOP_PROGRESSIONS = {
    jig: [
        { name: "Solo Whistle", voices: [1], description: "Opening - Tin whistle alone" },
        { name: "+ Concertina", voices: [1, 2], description: "Harmony joins" },
        { name: "+ Rhythm", voices: [1, 2, 3], description: "Full ensemble" },
        { name: "Solo Concertina", voices: [2], description: "Different solo" },
        { name: "Whistle + Rhythm", voices: [1, 3], description: "Build back up" }
    ],
    
    reel: [
        { name: "Solo Whistle", voices: [1], description: "Opening - Tin whistle alone" },
        { name: "+ Fiddle", voices: [1, 2], description: "Fiddle harmony" },
        { name: "+ Guitar", voices: [1, 2, 3], description: "Full band" },
        { name: "Solo Fiddle", voices: [2], description: "Fiddle takes lead" },
        { name: "Whistle + Guitar", voices: [1, 3], description: "Duo finish" }
    ],
    
    slipJig: [
        { name: "Solo Whistle", voices: [1], description: "Opening - Tin whistle alone" },
        { name: "+ Concertina", voices: [1, 2], description: "Harmony joins" },
        { name: "+ Banjo", voices: [1, 2, 3], description: "Full trio" },
        { name: "Solo Concertina", voices: [2], description: "Concertina feature" },
        { name: "All Together", voices: [1, 2, 3], description: "Grand finale" }
    ],
    
    // Default progression if type not specified
    default: [
        { name: "Solo", voices: [1], description: "Single instrument" },
        { name: "Duo", voices: [1, 2], description: "Two instruments" },
        { name: "Trio", voices: [1, 2, 3], description: "Three instruments" },
        { name: "Solo 2", voices: [2], description: "Different solo" },
        { name: "Duo 2", voices: [1, 3], description: "Different pair" }
    ]
};

// Instrument assignments
export const INSTRUMENTS = {
    // Irish trad instruments
    78: { name: "Tin Whistle", short: "Whistle", type: "melody" },
    110: { name: "Fiddle", short: "Fiddle", type: "melody" },
    21: { name: "Concertina", short: "Concertina", type: "harmony" },
    23: { name: "Accordion", short: "Accordion", type: "harmony" },
    105: { name: "Banjo", short: "Banjo", type: "rhythm" },
    25: { name: "Acoustic Guitar", short: "Guitar", type: "rhythm" },
    109: { name: "Uilleann Pipes", short: "Pipes", type: "melody" },
    73: { name: "Flute", short: "Flute", type: "melody" },
    
    // Percussion (channel 10)
    // Note: Percussion uses different program numbers on channel 10
    35: { name: "Bodhrán", short: "Bodhrán", type: "percussion" }
};

/**
 * Convert a tune from allTunes.js into a multi-voice format
 * @param {string} tuneName - Name of the tune
 * @param {string} singleVoiceAbc - ABC notation with single melody line
 * @param {string} tuneType - Type: 'jig', 'reel', 'slipJig', etc.
 * @returns {Object} Tune data ready for AbcTradPlayer
 */
export function prepareTuneData(tuneName, singleVoiceAbc, tuneType = 'default') {
    // Extract BPM from ABC (Q: field)
    const tempoMatch = singleVoiceAbc.match(/Q:\s*(\d+)/);
    const bpm = tempoMatch ? parseInt(tempoMatch[1]) : 120;
    
    // For now, create a multi-voice ABC with the melody on all voices
    // Later we'll add harmony generation here
    const multiVoiceAbc = createMultiVoiceAbc(singleVoiceAbc, tuneType);
    
    // Get appropriate progression for this tune type
    const progression = LOOP_PROGRESSIONS[tuneType] || LOOP_PROGRESSIONS.default;
    
    return {
        name: tuneName,
        type: tuneType,
        abc: multiVoiceAbc,
        bpm: bpm,
        progression: progression
    };
}

/**
 * Create multi-voice ABC from single-voice melody
 * @param {string} abc - Original single-voice ABC
 * @param {string} tuneType - Type of tune
 * @returns {string} Multi-voice ABC notation
 */
function createMultiVoiceAbc(abc, tuneType) {
    const lines = abc.split('\n');
    const header = [];
    const melody = [];
    let inMelody = false;
    
    // Separate header from melody
    lines.forEach(line => {
        if (line.match(/^[A-Z]:/)) {
            header.push(line);
        } else if (line.match(/^\|/) || inMelody) {
            inMelody = true;
            melody.push(line);
        }
    });
    
    // Determine instruments based on tune type
    let instruments;
    if (tuneType === 'reel') {
        instruments = [78, 110, 25]; // Whistle, Fiddle, Guitar
    } else if (tuneType === 'slipJig') {
        instruments = [78, 21, 105]; // Whistle, Concertina, Banjo
    } else {
        instruments = [78, 21, 105]; // Default: Whistle, Concertina, Banjo
    }
    
    // Build multi-voice ABC
    const result = [...header];
    
    // Add voice definitions with MIDI program directive
    result.push(`V:1 name="${INSTRUMENTS[instruments[0]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[0]}`);
    result.push(`V:2 name="${INSTRUMENTS[instruments[1]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[1]}`);
    result.push(`V:3 name="${INSTRUMENTS[instruments[2]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[2]}`);
    
    // For now, all voices play the same melody
    // TODO: Add harmony generation
    melody.forEach(line => {
        result.push(`[V:1] ${line}`);
    });
    
    melody.forEach(line => {
        result.push(`[V:2] ${line}`);
    });
    
    melody.forEach(line => {
        result.push(`[V:3] ${line}`);
    });
    
    const finalAbc = result.join('\n');
    
    // DEBUG: Log the generated ABC
    console.log('[tradTuneConfig] Generated multi-voice ABC:');
    console.log(finalAbc);
    console.log('[tradTuneConfig] Instruments:', instruments);
    
    return finalAbc;
}

/**
 * Get a random instrument for a given type
 * @param {string} type - 'melody', 'harmony', 'rhythm'
 * @returns {number} MIDI program number
 */
export function getRandomInstrument(type) {
    const instrumentsOfType = Object.entries(INSTRUMENTS)
        .filter(([num, info]) => info.type === type)
        .map(([num]) => parseInt(num));
    
    return instrumentsOfType[Math.floor(Math.random() * instrumentsOfType.length)];
}
