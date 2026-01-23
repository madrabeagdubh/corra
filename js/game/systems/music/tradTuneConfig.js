// js/game/systems/music/tradTuneConfig.js
/**
 * Complete tradTuneConfig.js with bodhrán and drone support
 */

// Updated loop progressions with bodhrán (voice 4) and drone (voice 5)
export const LOOP_PROGRESSIONS = {
    jig: [
        { name: "Solo Whistle", voices: [1], description: "Opening - Tin whistle alone" },
        { name: "+ Concertina", voices: [1, 2], description: "Harmony joins" },
        { name: "+ Rhythm", voices: [1, 2, 3, 4], description: "Add bodhrán" },
        { name: "Solo Concertina", voices: [2], description: "Feature solo" },
        { name: "Whistle + Bodhrán", voices: [1, 4], description: "Duo finish" }
    ],

    reel: [
        { name: "Solo Whistle", voices: [1], description: "Opening" },
        { name: "+ Fiddle", voices: [1, 2], description: "Fiddle harmony" },
        { name: "+ Guitar", voices: [1, 2, 3], description: "Add guitar" },
        { name: "+ Bodhrán", voices: [1, 2, 3, 4], description: "Full band" },
        { name: "Solo Fiddle", voices: [2], description: "Fiddle takes lead" },
        { name: "All Together", voices: [1, 2, 3, 4], description: "Grand finale" }
    ],

    slipJig: [
        { name: "Solo Whistle", voices: [1], description: "Opening - Tin whistle alone" },
        { name: "+ Concertina", voices: [1, 2], description: "Harmony joins" },
        { name: "+ Banjo", voices: [1, 2, 3], description: "Full trio" },
        { name: "+ Bodhrán", voices: [1, 2, 3, 4], description: "Add percussion" },
        { name: "Solo Concertina", voices: [2], description: "Concertina feature" },
        { name: "All Together", voices: [1, 2, 3, 4], description: "Grand finale" }
    ],

    pipes: [
        { name: "Drone Only", voices: [5], description: "Pipes warming up" },
        { name: "Pipes + Drone", voices: [1, 5], description: "Pipes enter" },
        { name: "+ Fiddle", voices: [1, 2, 5], description: "Fiddle joins" },
        { name: "+ Rhythm", voices: [1, 2, 3, 4, 5], description: "Full session" },
        { name: "Pipes Feature", voices: [1, 4, 5], description: "Pipes and bodhrán" }
    ],

    flute: [
        { name: "Solo Flute", voices: [1], description: "Opening" },
        { name: "+ Concertina", voices: [1, 2], description: "Harmony" },
        { name: "+ Banjo", voices: [1, 2, 3], description: "Add banjo" },
        { name: "+ Bodhrán", voices: [1, 2, 3, 4], description: "Full ensemble" },
        { name: "Flute + Bodhrán", voices: [1, 4], description: "Duo finish" }
    ],

    // Default progression if type not specified
    default: [
        { name: "Solo", voices: [1], description: "Single instrument" },
        { name: "Duo", voices: [1, 2], description: "Two instruments" },
        { name: "Trio", voices: [1, 2, 3], description: "Three instruments" },
        { name: "+ Bodhrán", voices: [1, 2, 3, 4], description: "Add percussion" },
        { name: "Solo 2", voices: [2], description: "Different solo" }
    ]
};

// Instrument assignments (MIDI program numbers)
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
    116: { name: "Taiko Drum", short: "Bodhrán", type: "percussion" }
};

/**
 * Convert a tune from allTunes.js into a multi-voice format
 */
export function prepareTuneData(tuneName, singleVoiceAbc, tuneType = 'default') {
    // Extract BPM from ABC (Q: field)
    const tempoMatch = singleVoiceAbc.match(/Q:\s*(\d+)/);
    const bpm = tempoMatch ? parseInt(tempoMatch[1]) : 120;

    // Create multi-voice ABC with harmony, bodhrán, and drone
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
 * Now includes bodhrán (voice 4) and drone (voice 5) support
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

    // Get the key from ABC (e.g., K:D means D major)
    const keyMatch = abc.match(/K:\s*([A-G][#b]?)\s*(min|maj|m)?/i);
    const key = keyMatch ? keyMatch[1] : 'D';
    const isMinor = keyMatch && keyMatch[2] && keyMatch[2].toLowerCase().includes('min');
    
    // Determine instruments based on tune type
    let instruments, addBodhran = false, addDrone = false;
    
    if (tuneType === 'reel') {
        instruments = [78, 110, 25]; // Whistle, Fiddle, Guitar
        addBodhran = true;
    } else if (tuneType === 'slipJig') {
        instruments = [78, 21, 105]; // Whistle, Concertina, Banjo
        addBodhran = true;
    } else if (tuneType === 'jig') {
        instruments = [78, 21, 105]; // Whistle, Concertina, Banjo
        addBodhran = true;
    } else if (tuneType === 'pipes') {
        instruments = [109, 110, 25]; // Uilleann Pipes, Fiddle, Guitar
        addDrone = true; // Pipes need their drone!
        addBodhran = true;
    } else if (tuneType === 'flute') {
        instruments = [73, 21, 105]; // Flute, Concertina, Banjo
        addBodhran = true;
    } else {
        instruments = [78, 21, 105]; // Default: Whistle, Concertina, Banjo
        addBodhran = true;
    }

    // Build multi-voice ABC
    const result = [...header];

    // Add voice definitions for main instruments (Voices 1-3)
    result.push(`V:1 name="${INSTRUMENTS[instruments[0]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[0]}`);
    result.push(`V:2 name="${INSTRUMENTS[instruments[1]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[1]}`);
    result.push(`V:3 name="${INSTRUMENTS[instruments[2]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[2]}`);

    // Add bodhrán if requested (Voice 4)
    if (addBodhran) {
        result.push(`V:4 name="Bodhrán" clef=percussion`);
        result.push(`%%MIDI channel 10`); // Percussion channel
        result.push(`%%MIDI program 116`); // Taiko Drum (closest to bodhrán)
    }

    // Add drone if requested (Voice 5)
    if (addDrone) {
        result.push(`V:5 name="Drone" clef=bass`);
        result.push(`%%MIDI program 109`); // Bagpipe for drone
    }

    // Main melody voices (all play same melody for now)
    melody.forEach(line => {
        result.push(`[V:1] ${line}`);
    });
    melody.forEach(line => {
        result.push(`[V:2] ${line}`);
    });
    melody.forEach(line => {
        result.push(`[V:3] ${line}`);
    });

    // Generate bodhrán pattern
    if (addBodhran) {
        const bodhranPattern = generateBodhranPattern(abc, tuneType);
        bodhranPattern.forEach(line => {
            result.push(`[V:4] ${line}`);
        });
    }

    // Generate drone
    if (addDrone) {
        const dronePattern = generateDrone(abc, key, isMinor);
        dronePattern.forEach(line => {
            result.push(`[V:5] ${line}`);
        });
    }

    const finalAbc = result.join('\n');
    
    console.log('[tradTuneConfig] Generated multi-voice ABC:');
    console.log(finalAbc);
    console.log('[tradTuneConfig] Instruments:', instruments);
    console.log('[tradTuneConfig] Bodhrán:', addBodhran, 'Drone:', addDrone);

    return finalAbc;
}

/**
 * Generate bodhrán rhythm pattern based on tune type
 */
function generateBodhranPattern(abc, tuneType) {
    const lines = abc.split('\n').filter(l => l.match(/^\|/));
    const pattern = [];
    
    // Extract meter from ABC (M: field)
    const meterMatch = abc.match(/M:\s*(\d+)\/(\d+)/);
    const meter = meterMatch ? `${meterMatch[1]}/${meterMatch[2]}` : '4/4';
    
    if (tuneType === 'jig' || meter === '6/8') {
        // 6/8 jig pattern: strong-weak-weak strong-weak-weak
        // Using MIDI note C (middle C) for bodhrán hits
        lines.forEach(() => {
            pattern.push('|:[^C3C3^C3^C3:|]'); // Accented pattern
        });
    } else if (tuneType === 'slipJig' || meter === '9/8') {
        // 9/8 slip jig: three groups of three
        lines.forEach(() => {
            pattern.push('|:[^C3C3C3:|]');
        });
    } else if (tuneType === 'reel' || meter === '4/4') {
        // 4/4 reel: steady quarter notes with accents
        lines.forEach(() => {
            pattern.push('|:[^C2C2^C2C2:|]');
        });
    } else {
        // Default simple pattern
        lines.forEach(() => {
            pattern.push('|:[C4:|]');
        });
    }
    
    return pattern;
}

/**
 * Generate drone notes (tonic + dominant)
 * Uilleann pipes traditionally drone on the tonic and dominant
 */
function generateDrone(abc, key, isMinor) {
    const lines = abc.split('\n').filter(l => l.match(/^\|/));
    const pattern = [];
    
    // Map keys to drone notes (low octave)
    // Format: [tonic, dominant] as whole notes
    const droneNotes = {
        'D': '[D,2A,2]', // D major - most common for Irish pipes
        'G': '[G,2D2]',   // G major
        'A': '[A,2E2]',   // A major/minor (very common)
        'E': '[E,2B,2]',  // E minor
        'B': '[B,2F2]',   // B minor
        'C': '[C2G2]'     // C major
    };
    
    const drone = droneNotes[key] || '[D,2A,2]'; // Default to D
    
    // Create continuous drone for each measure
    lines.forEach(() => {
        pattern.push(`|:${drone}${drone}:|`); // Repeat drone pattern
    });
    
    return pattern;
}

/**
 * Get a random instrument for a given type
 * @param {string} type - 'melody', 'harmony', 'rhythm', 'percussion'
 * @returns {number} MIDI program number
 */
export function getRandomInstrument(type) {
    const instrumentsOfType = Object.entries(INSTRUMENTS)
        .filter(([num, info]) => info.type === type)
        .map(([num]) => parseInt(num));

    return instrumentsOfType[Math.floor(Math.random() * instrumentsOfType.length)];
}
