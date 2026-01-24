// js/game/systems/music/tradTuneConfig.js
/**
 * FIXED: Tempo override and discord issues resolved
 */

export const LOOP_PROGRESSIONS = {
    jig: [
        { name: "Solo Banjo", voices: [1], description: "Bright opening" },
        { name: "+ Fiddle", voices: [1, 2], description: "Lively duo" },
        { name: "+ Cello", voices: [1, 2, 3], description: "Rich trio" },
        { name: "Fiddle + Cello", voices: [2, 3], description: "Melodic harmony" },
        { name: "All Together", voices: [1, 2, 3], description: "Joyful finale" }
    ],

    reel: [
        { name: "Solo Banjo", voices: [1], description: "Driving lead" },
        { name: "+ Fiddle", voices: [1, 2], description: "Classic pairing" },
        { name: "+ Concertina", voices: [1, 2, 3], description: "Full session" },
        { name: "Fiddle Solo", voices: [2], description: "Soaring melody" },
        { name: "Grand Finale", voices: [1, 2, 3], description: "Triumphant!" }
    ],

    slipJig: [
        { name: "Solo Banjo", voices: [1], description: "9/8 dance" },
        { name: "+ Harp", voices: [1, 2], description: "Ethereal shimmer" },
        { name: "+ Guitar", voices: [1, 2, 3], description: "Gentle rhythm" },
        { name: "Harp Solo", voices: [2], description: "Mystical" },
        { name: "All Together", voices: [1, 2, 3], description: "Enchanting" }
    ],

    march: [
        { name: "Lone Warrior", voices: [1], description: "Solo banjo" },
        { name: "+ Battle Drums", voices: [1, 3], description: "Guitar rhythm" },
        { name: "Army Gathers", voices: [1, 2, 3], description: "Full strength" },
        { name: "War Hymn", voices: [2, 3], description: "Strings unite" },
        { name: "Victory March", voices: [1, 2, 3], description: "Triumphant!" }
    ],

    epic: [
        { name: "Ancient Times", voices: [2], description: "Harp alone" },
        { name: "Hero Rises", voices: [1, 2], description: "Banjo enters" },
        { name: "Journey Begins", voices: [1, 2, 3], description: "Full quest" },
        { name: "Dark Hour", voices: [3], description: "Guitar alone" },
        { name: "Hope Returns", voices: [1, 2], description: "Light breaks" },
        { name: "Triumph", voices: [1, 2, 3], description: "Victory!" }
    ],

    lament: [
        { name: "Mourning", voices: [2], description: "Harp, deeply sad" },
        { name: "Remembrance", voices: [2, 3], description: "Guitar joins softly" },
        { name: "Hope", voices: [1, 2, 3], description: "Banjo brings light" },
        { name: "Acceptance", voices: [2], description: "Peaceful harp" },
        { name: "Moving On", voices: [1, 2, 3], description: "Forward together" }
    ],

    pipes: [
        { name: "Drone Only", voices: [5], description: "Ancient awakening" },
        { name: "Pipes Call", voices: [1, 5], description: "Rallying cry" },
        { name: "+ Fiddle", voices: [1, 2, 5], description: "Warriors gather" },
        { name: "+ Banjo", voices: [1, 2, 3, 5], description: "Full war party" },
        { name: "Battle Charge", voices: [1, 2, 3, 5], description: "Into glory!" }
    ],

    celtic: [
        { name: "Solo Banjo", voices: [1], description: "Folk opening" },
        { name: "+ Harp", voices: [1, 2], description: "Ancient blend" },
        { name: "+ Guitar", voices: [1, 2, 3], description: "Grounded trio" },
        { name: "Harp + Guitar", voices: [2, 3], description: "Gentle duo" },
        { name: "All Together", voices: [1, 2, 3], description: "Celtic pride" }
    ],

    whistle: [
        { name: "Solo Banjo", voices: [1], description: "Village tune" },
        { name: "+ Whistle", voices: [1, 2], description: "Shepherd joins" },
        { name: "+ Concertina", voices: [1, 2, 3], description: "Session grows" },
        { name: "Whistle Solo", voices: [2], description: "Pure and clear" },
        { name: "All Together", voices: [1, 2, 3], description: "Community joy" }
    ],

    session: [
        { name: "Solo Banjo", voices: [1], description: "Pub opener" },
        { name: "+ Fiddle", voices: [1, 2], description: "Locals join in" },
        { name: "+ Flute", voices: [1, 2, 3], description: "Session heats up" },
        { name: "Fiddle + Flute", voices: [2, 3], description: "Wind duet" },
        { name: "Full Session", voices: [1, 2, 3], description: "Craic!" }
    ],

    default: [
        { name: "Solo Banjo", voices: [1], description: "Opening" },
        { name: "+ Harmony", voices: [1, 2], description: "Building" },
        { name: "Full Trio", voices: [1, 2, 3], description: "Together" },
        { name: "Finale", voices: [1, 2, 3], description: "Grand finish" }
    ]
};

export const INSTRUMENTS = {
    105: { name: "Banjo", short: "Banjo", type: "melody" },
    110: { name: "Fiddle", short: "Fiddle", type: "melody" },
    21: { name: "Concertina", short: "Concertina", type: "harmony" },
    46: { name: "Celtic Harp", short: "Harp", type: "melody" },
    25: { name: "Acoustic Guitar", short: "Guitar", type: "rhythm" },  // CHANGED from Cello
    109: { name: "Uilleann Pipes", short: "Pipes", type: "melody" },
    78: { name: "Tin Whistle", short: "Whistle", type: "melody" },
    73: { name: "Flute", short: "Flute", type: "melody" },
    60: { name: "French Horn", short: "Horn", type: "melody" },
    23: { name: "Accordion", short: "Accordion", type: "harmony" }
};

// Tempo overrides for specific moods
export const TEMPO_OVERRIDES = {
    lament: 50,      // FORCE slow tempo
    march: 85,       // FORCE march pace
    epic: 95,        // FORCE epic feel
};

// The REAL fix - modify the ABC itself, not just metadata

export function prepareTuneData(tuneName, singleVoiceAbc, tuneType = 'default') {
    // STEP 1: Extract or override tempo
    const tempoMatch = singleVoiceAbc.match(/Q:\s*(\d+)/);
    let bpm;
    
    // Check for tempo override
    if (TEMPO_OVERRIDES[tuneType]) {
        bpm = TEMPO_OVERRIDES[tuneType];
        console.log(`[tradTuneConfig] TEMPO OVERRIDE for ${tuneType}: ${bpm} BPM`);
        
        // CRITICAL FIX: Actually modify the ABC string!
        if (tempoMatch) {
            // Replace existing Q: field
            singleVoiceAbc = singleVoiceAbc.replace(/Q:\s*\d+/, `Q:${bpm}`);
        } else {
            // Add Q: field after the first header line (X:)
            singleVoiceAbc = singleVoiceAbc.replace(/X:\d+\n/, `X:1\nQ:${bpm}\n`);
        }
    } else if (tempoMatch) {
        bpm = parseInt(tempoMatch[1]);
    } else {
        bpm = 100;
    }

    const multiVoiceAbc = createMultiVoiceAbc(singleVoiceAbc, tuneType);
    const progression = LOOP_PROGRESSIONS[tuneType] || LOOP_PROGRESSIONS.default;

    return {
        name: tuneName,
        type: tuneType,
        abc: multiVoiceAbc,
        bpm: bpm,
        progression: progression
    };
}

// Even better approach - inject tempo into the multi-voice ABC headers:
function createMultiVoiceAbc(abc, tuneType) {
    const lines = abc.split('\n');
    const header = [];
    const melody = [];
    let inMelody = false;

    lines.forEach(line => {
        if (line.match(/^[A-Z]:/)) {
            header.push(line);
        } else if (line.match(/^\|/) || inMelody) {
            inMelody = true;
            melody.push(line);
        }
    });

    // FORCE tempo override in the header itself
    if (TEMPO_OVERRIDES[tuneType]) {
        const bpm = TEMPO_OVERRIDES[tuneType];
        // Remove any existing Q: line
        const filteredHeader = header.filter(line => !line.match(/^Q:/));
        header.length = 0;
        header.push(...filteredHeader);
        
        // Add tempo after X: line
        const xIndex = header.findIndex(line => line.match(/^X:/));
        if (xIndex >= 0) {
            header.splice(xIndex + 1, 0, `Q:${bpm}`);
        }
    }

    const keyMatch = abc.match(/K:\s*([A-G][#b]?)\s*(min|maj|m)?/i);
    const key = keyMatch ? keyMatch[1] : 'D';
    const isMinor = keyMatch && keyMatch[2] && keyMatch[2].toLowerCase().includes('min');
    
    let instruments, addDrone = false;
    
    if (tuneType === 'reel') {
        instruments = [105, 110, 21];
    } else if (tuneType === 'slipJig') {
        instruments = [105, 46, 25];
    } else if (tuneType === 'jig') {
        instruments = [105, 110, 25];
    } else if (tuneType === 'march') {
        instruments = [105, 110, 25];
    } else if (tuneType === 'epic') {
        instruments = [105, 46, 25];
    } else if (tuneType === 'lament') {
        instruments = [105, 46, 25];
    } else if (tuneType === 'pipes') {
        instruments = [109, 110, 105];
        addDrone = true;
    } else if (tuneType === 'celtic') {
        instruments = [105, 46, 25];
    } else if (tuneType === 'whistle') {
        instruments = [105, 78, 21];
    } else if (tuneType === 'session') {
        instruments = [105, 110, 73];
    } else {
        instruments = [105, 46, 25];
    }

    const result = [...header];

    result.push(`V:1 name="${INSTRUMENTS[instruments[0]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[0]}`);
    result.push(`V:2 name="${INSTRUMENTS[instruments[1]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[1]}`);
    result.push(`V:3 name="${INSTRUMENTS[instruments[2]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[2]}`);

    if (addDrone) {
        result.push(`V:5 name="Drone" clef=bass`);
        result.push(`%%MIDI program 109`);
    }

    melody.forEach(line => {
        result.push(`[V:1] ${line}`);
    });
    melody.forEach(line => {
        result.push(`[V:2] ${line}`);
    });
    melody.forEach(line => {
        result.push(`[V:3] ${line}`);
    });

    if (addDrone) {
        const dronePattern = generateDrone(abc, key, isMinor);
        dronePattern.forEach(line => {
            result.push(`[V:5] ${line}`);
        });
    }

    const finalAbc = result.join('\n');
    
    console.log('[tradTuneConfig] Generated ABC with tempo override:');
    console.log(finalAbc.split('\n').slice(0, 10).join('\n')); // Show first 10 lines
    
    return finalAbc;
}

function generateDrone(abc, key, isMinor) {
    const lines = abc.split('\n').filter(l => l.match(/^\|/));
    const pattern = [];

    const droneNotes = {
        'D': '[D,2A,2]',
        'G': '[G,2D2]',
        'A': '[A,2E2]',
        'E': '[E,2B,2]',
        'B': '[B,2F2]',
        'C': '[C2G2]'
    };

    const drone = droneNotes[key] || '[D,2A,2]';

    lines.forEach(() => {
        pattern.push(`|:${drone}${drone}:|`);
    });

    return pattern;
}

export function getRandomInstrument(type) {
    const instrumentsOfType = Object.entries(INSTRUMENTS)
        .filter(([num, info]) => info.type === type)
        .map(([num]) => parseInt(num));

    return instrumentsOfType[Math.floor(Math.random() * instrumentsOfType.length)];
}
