// js/game/systems/music/tradTuneConfig.js
/**
 * ACTUALLY FIXED: Tempo now properly inserted into final ABC
 */

export const LOOP_PROGRESSIONS = {
    jig: [
        { name: "Solo Banjo", voices: [1], description: "Bright & bouncy" },
        { name: "+ Fiddle", voices: [1, 2], description: "Lively duo" },
        { name: "+ Concertina", voices: [1, 2, 3], description: "Full session" },
        { name: "Fiddle Solo", voices: [2], description: "Soaring melody" },
        { name: "All Together", voices: [1, 2, 3], description: "Joyful finale" }
    ],

    reel: [
        { name: "Solo Banjo", voices: [1], description: "Fast & driving" },
        { name: "+ Fiddle", voices: [1, 2], description: "Flying fingers" },
        { name: "+ Flute", voices: [1, 2, 3], description: "Racing trio" },
        { name: "Fiddle + Flute", voices: [2, 3], description: "Wind sprint" },
        { name: "Grand Finale", voices: [1, 2, 3], description: "Breathless!" }
    ],

    slipJig: [
        { name: "Solo Banjo", voices: [1], description: "Lilting 9/8" },
        { name: "+ Harp", voices: [1, 2], description: "Ethereal flow" },
        { name: "+ Whistle", voices: [1, 2, 3], description: "Dancing trio" },
        { name: "Harp Solo", voices: [2], description: "Mystical" },
        { name: "All Together", voices: [1, 2, 3], description: "Graceful finale" }
    ],

    march: [
        { name: "Drum Call", voices: [3], description: "Steady beat" },
        { name: "+ Banjo", voices: [1, 3], description: "Soldiers gather" },
        { name: "+ Pipes", voices: [1, 2, 3], description: "Battalion ready" },
        { name: "Battle Hymn", voices: [2, 3], description: "War pipes" },
        { name: "Victory March", voices: [1, 2, 3], description: "Triumphant return!" }
    ],

    epic: [
        { name: "Ancient Times", voices: [2], description: "Harp alone, slow" },
        { name: "Hero Rises", voices: [1, 2], description: "Banjo enters" },
        { name: "+ Strings", voices: [1, 2, 3], description: "Journey begins" },
        { name: "Dark Hour", voices: [3], description: "Cello mourns" },
        { name: "Hope Returns", voices: [1, 2], description: "Light breaks" },
        { name: "Legendary Triumph", voices: [1, 2, 3], description: "Victory!" }
    ],

    lament: [
        { name: "Grief", voices: [2], description: "Harp weeps" },
        { name: "+ Sorrow", voices: [2, 3], description: "Cello joins" },
        { name: "A Light", voices: [1, 2, 3], description: "Gentle hope" },
        { name: "Remembrance", voices: [2], description: "Peaceful" },
        { name: "Healing", voices: [1, 2, 3], description: "Moving forward" }
    ],

    pipes: [
        { name: "Drone Awakens", voices: [5], description: "Ancient sound" },
        { name: "Pipes Call", voices: [1, 5], description: "War cry" },
        { name: "+ Fiddle", voices: [1, 2, 5], description: "Warriors gather" },
        { name: "+ Banjo", voices: [1, 2, 3, 5], description: "Full regiment" },
        { name: "To Battle!", voices: [1, 2, 3, 5], description: "Charge!" }
    ],

    celtic: [
        { name: "Solo Banjo", voices: [1], description: "Folk tale begins" },
        { name: "+ Harp", voices: [1, 2], description: "Ancient magic" },
        { name: "+ Guitar", voices: [1, 2, 3], description: "Timeless trio" },
        { name: "Harp + Guitar", voices: [2, 3], description: "Celtic soul" },
        { name: "All Together", voices: [1, 2, 3], description: "Heritage proud" }
    ],

    whistle: [
        { name: "Solo Banjo", voices: [1], description: "Village green" },
        { name: "+ Whistle", voices: [1, 2], description: "Shepherd's call" },
        { name: "+ Concertina", voices: [1, 2, 3], description: "Fair day" },
        { name: "Whistle Solo", voices: [2], description: "Pure & clear" },
        { name: "All Together", voices: [1, 2, 3], description: "Community dance" }
    ],

    session: [
        { name: "Solo Banjo", voices: [1], description: "Pub opener" },
        { name: "+ Fiddle", voices: [1, 2], description: "Crowd gathers" },
        { name: "+ Accordion", voices: [1, 2, 3], description: "Session heats up" },
        { name: "Fiddle + Accordion", voices: [2, 3], description: "Trading tunes" },
        { name: "Full Craic", voices: [1, 2, 3], description: "Everyone joins!" }
    ],

    default: [
        { name: "Solo", voices: [1], description: "Opening" },
        { name: "+ Harmony", voices: [1, 2], description: "Building" },
        { name: "Full", voices: [1, 2, 3], description: "Together" },
        { name: "Finale", voices: [1, 2, 3], description: "Grand finish" }
    ]
};

export const INSTRUMENTS = {
    105: { name: "Banjo", short: "Banjo", type: "melody" },
    110: { name: "Fiddle", short: "Fiddle", type: "melody" },
    21: { name: "Concertina", short: "Concertina", type: "harmony" },
    46: { name: "Celtic Harp", short: "Harp", type: "melody" },
    25: { name: "Acoustic Guitar", short: "Guitar", type: "rhythm" },
    42: { name: "Cello", short: "Cello", type: "bass" },
    109: { name: "Uilleann Pipes", short: "Pipes", type: "melody" },
    78: { name: "Tin Whistle", short: "Whistle", type: "melody" },
    73: { name: "Flute", short: "Flute", type: "melody" },
    23: { name: "Accordion", short: "Accordion", type: "harmony" },
    117: { name: "Melodic Tom", short: "Drum", type: "rhythm" }
};

// Tempo settings - each type has distinct tempo
export const TEMPO_OVERRIDES = {
    lament: 50,      // Very slow, mournful
    epic: 75,        // Slow, majestic
    celtic: 95,      // Moderate, flowing
    march: 100,      // Steady marching pace
    pipes: 100,      // Martial, steady
    whistle: 105,    // Light & airy
    session: 108,    // Pub pace
    slipJig: 110,    // Lilting 9/8
    jig: 115,        // Bouncy 6/8
    reel: 120,       // Fast & driving
};
export function prepareTuneData(tuneName, singleVoiceAbc, tuneType = 'default') {
    // 1. STRIP any existing tempo to prevent "sticky" values from previous tunes
    let cleanAbc = singleVoiceAbc.replace(/^Q:.*\n?/gm, '');
    
    let bpm = TEMPO_OVERRIDES[tuneType] || 100;
    
    // 2. Explicitly inject the fresh tempo at the top
    // We insert it right after the X: (Reference Number) tag
    cleanAbc = cleanAbc.replace(/(X:\s*\d+)/, `$1\nQ:${bpm}`);

    console.log(`[tradTuneConfig] Setting ${tuneType} to ${bpm} BPM`);

    const multiVoiceAbc = createMultiVoiceAbc(cleanAbc, tuneType, bpm);
    const progression = LOOP_PROGRESSIONS[tuneType] || LOOP_PROGRESSIONS.default;

    return {
        name: tuneName,
        type: tuneType,
        abc: multiVoiceAbc,
        bpm: bpm,
        progression: progression
    };
}


function createMultiVoiceAbc(abc, tuneType, bpm) {
    const lines = abc.split('\n');
    const header = [];
    const melody = [];
    let inMelody = false;

    lines.forEach(line => {
        // If it's a header line but NOT a Q line (since we handle Q specifically)
        if (line.match(/^[A-Z]:/) && !line.startsWith('Q:')) {
            header.push(line);
        } else if (line.match(/^\|/) || inMelody) {
            inMelody = true;
            melody.push(line);
        }
    });

    // Always ensure Q: is at the top of our new result
    


    // CRITICAL FIX: Ensure Q: field is in header
    const hasQField = header.some(line => line.match(/^Q:/));
    if (!hasQField && bpm) {
        // Add Q: field right after X: line
        const xIndex = header.findIndex(line => line.match(/^X:/));
        if (xIndex >= 0) {
            header.splice(xIndex + 1, 0, `Q:${bpm}`);
        } else {
            header.unshift(`Q:${bpm}`);
        }
    }

    const keyMatch = abc.match(/K:\s*([A-G][#b]?)\s*(min|maj|m)?/i);
    const key = keyMatch ? keyMatch[1] : 'D';
    const isMinor = keyMatch && keyMatch[2] && keyMatch[2].toLowerCase().includes('min');
    
    let instruments, addDrone = false;
    
    // DISTINCT INSTRUMENTATION per type
    if (tuneType === 'jig') {
        instruments = [105, 110, 21]; // Banjo, Fiddle, Concertina
    } else if (tuneType === 'reel') {
        instruments = [105, 110, 73]; // Banjo, Fiddle, Flute
    } else if (tuneType === 'slipJig') {
        instruments = [105, 46, 78]; // Banjo, Harp, Whistle
    } else if (tuneType === 'march') {
        instruments = [105, 109, 25]; // Banjo, Pipes, Guitar (no percussion for now)
    } else if (tuneType === 'epic') {
        instruments = [105, 46, 42]; // Banjo, Harp, Cello
    } else if (tuneType === 'lament') {
        instruments = [105, 46, 42]; // Banjo, Harp, Cello
    } else if (tuneType === 'pipes') {
        instruments = [109, 110, 105]; // Pipes, Fiddle, Banjo
        addDrone = true;
    } else if (tuneType === 'celtic') {
        instruments = [105, 46, 25]; // Banjo, Harp, Guitar
    } else if (tuneType === 'whistle') {
        instruments = [105, 78, 21]; // Banjo, Whistle, Concertina
    } else if (tuneType === 'session') {
        instruments = [105, 110, 23]; // Banjo, Fiddle, Accordion
    } else {
        instruments = [105, 46, 25]; // Default: Banjo, Harp, Guitar
    }


    const result = [header[0], `Q:${bpm}`, ...header.slice(1)];
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
    
    // Verify Q: field is present
    const finalTempoMatch = finalAbc.match(/Q:\s*(\d+)/);
    console.log(`[tradTuneConfig] ${tuneType.toUpperCase()}: Tempo in final ABC = Q:${finalTempoMatch ? finalTempoMatch[1] : 'NOT FOUND!!!'}`);
    
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
