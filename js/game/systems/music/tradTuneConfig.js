// js/game/systems/music/tradTuneConfig.js
/**
 * REFINED: Streamlined to 6 arrangements with dramatic tempo differences
 * Removed: drums, bodhrán, pipes
 * Added: Piano mixed throughout
 */

export const LOOP_PROGRESSIONS = {
    jig: [
        { name: "Solo Banjo", voices: [1], description: "Bright & bouncy" },
        { name: "+ Fiddle", voices: [1, 2], description: "Lively duo" },
        { name: "+ Piano", voices: [1, 2, 3], description: "Dancing trio" },
        { name: "All Together", voices: [1, 2, 3], description: "Joyful finale" }
    ],

    reel: [
        { name: "Solo Fiddle", voices: [1], description: "Fast & driving" },
        { name: "+ Banjo", voices: [1, 2], description: "Flying fingers" },
        { name: "+ Flute", voices: [1, 2, 3], description: "Racing trio" },
        { name: "Grand Finale", voices: [1, 2, 3], description: "Breathless!" }
    ],

    slipJig: [
        { name: "Solo Piano", voices: [1], description: "Lilting 9/8" },
        { name: "+ Harp", voices: [1, 2], description: "Ethereal flow" },
        { name: "+ Fiddle", voices: [1, 2, 3], description: "Dancing trio" },
        { name: "All Together", voices: [1, 2, 3], description: "Graceful finale" }
    ],

    slide: [
        { name: "Solo Banjo", voices: [1], description: "Playful slide" },
        { name: "+ Accordion", voices: [1, 2], description: "Countryside hop" },
        { name: "+ Fiddle", voices: [1, 2, 3], description: "Dancing trio" },
        { name: "All Together", voices: [1, 2, 3], description: "Full ceili" }
    ],

    lament: [
        { name: "Solo Piano", voices: [1], description: "Melancholy" },
        { name: "+ Cello", voices: [1, 2], description: "Deep sorrow" },
        { name: "+ Harp", voices: [1, 2, 3], description: "Gentle hope" },
        { name: "Healing", voices: [1, 2, 3], description: "Moving forward" }
    ],

    default: [
        { name: "Solo Banjo", voices: [1], description: "Opening" },
        { name: "+ Fiddle", voices: [1, 2], description: "Building" },
        { name: "+ Piano", voices: [1, 2, 3], description: "Together" },
        { name: "Grand Finale", voices: [1, 2, 3], description: "Full ensemble" }
    ]
};

export const INSTRUMENTS = {
    105: { name: "Banjo", short: "Banjo", type: "melody" },
    110: { name: "Fiddle", short: "Fiddle", type: "melody" },
    21: { name: "Concertina", short: "Concertina", type: "harmony" },
    46: { name: "Celtic Harp", short: "Harp", type: "melody" },
    25: { name: "Acoustic Guitar", short: "Guitar", type: "rhythm" },
    42: { name: "Cello", short: "Cello", type: "bass" },
    78: { name: "Tin Whistle", short: "Whistle", type: "melody" },
    73: { name: "Flute", short: "Flute", type: "melody" },
    23: { name: "Accordion", short: "Accordion", type: "harmony" },
    0: { name: "Acoustic Grand Piano", short: "Piano", type: "harmony" }
};

// Tempo settings - each type has VERY distinct tempo
export const TEMPO_OVERRIDES = {
    lament: 45,      // Very slow, mournful
    slide: 110,      // Moderate playful
    slipJig: 115,    // Lilting 9/8
    default: 100,    // Standard pace
    jig: 130,        // Bouncy & bright
    reel: 160,       // Fast & driving
};

export function prepareTuneData(tuneName, singleVoiceAbc, tuneType = 'default') {
    // 1. STRIP any existing tempo AND Q: fields completely
    let cleanAbc = singleVoiceAbc.replace(/^Q:.*$/gm, '');
    
    let bpm = TEMPO_OVERRIDES[tuneType] || 100;
    
    // 2. Build completely fresh ABC with new tempo as FIRST header after X:
    const lines = cleanAbc.split('\n');
    const outputLines = [];
    let foundX = false;
    
    for (const line of lines) {
        if (line.match(/^X:\s*\d+/)) {
            outputLines.push(line);
            outputLines.push(`Q:1/4=${bpm}`);  // Explicit quarter note tempo
            foundX = true;
        } else if (!line.match(/^Q:/)) {  // Skip any other Q: lines
            outputLines.push(line);
        }
    }
    
    cleanAbc = outputLines.join('\n');

    console.log(`[tradTuneConfig] ${tuneType.toUpperCase()}: Setting tempo to Q:1/4=${bpm}`);

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

    // CRITICAL FIX: Ensure Q: field is in header with explicit format
    const hasQField = header.some(line => line.match(/^Q:/));
    if (!hasQField && bpm) {
        const xIndex = header.findIndex(line => line.match(/^X:/));
        if (xIndex >= 0) {
            header.splice(xIndex + 1, 0, `Q:1/4=${bpm}`);
        } else {
            header.unshift(`Q:1/4=${bpm}`);
        }
    }

    const keyMatch = abc.match(/K:\s*([A-G][#b]?)\s*(min|maj|m)?/i);
    const key = keyMatch ? keyMatch[1] : 'D';
    const isMinor = keyMatch && keyMatch[2] && keyMatch[2].toLowerCase().includes('min');
    
    let instruments;
    
    // DISTINCT INSTRUMENTATION per type
    if (tuneType === 'jig') {
        instruments = [105, 110, 0]; // Banjo, Fiddle, Piano
    } else if (tuneType === 'reel') {
        instruments = [110, 105, 73]; // Fiddle, Banjo, Flute
    } else if (tuneType === 'slipJig') {
        instruments = [0, 46, 110]; // Piano, Harp, Fiddle
    } else if (tuneType === 'slide') {
        instruments = [105, 23, 110]; // Banjo, Accordion, Fiddle
    } else if (tuneType === 'lament') {
        instruments = [0, 42, 46]; // Piano, Cello, Harp
    } else {
        instruments = [105, 110, 0]; // Default: Banjo, Fiddle, Piano
    }


    const result = [header[0], `Q:1/4=${bpm}`, ...header.slice(1)];
    result.push(`V:1 name="${INSTRUMENTS[instruments[0]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[0]}`);
    result.push(`V:2 name="${INSTRUMENTS[instruments[1]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[1]}`);
    result.push(`V:3 name="${INSTRUMENTS[instruments[2]].short}" clef=treble`);
    result.push(`%%MIDI program ${instruments[2]}`);

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
    
    // Verify Q: field is present
    const finalTempoMatch = finalAbc.match(/Q:1\/4=(\d+)/);
    console.log(`[tradTuneConfig] ${tuneType.toUpperCase()}: Final tempo = Q:1/4=${finalTempoMatch ? finalTempoMatch[1] : 'NOT FOUND!!!'}`);
    
    return finalAbc;
}

export function getRandomInstrument(type) {
    const instrumentsOfType = Object.entries(INSTRUMENTS)
        .filter(([num, info]) => info.type === type)
        .map(([num]) => parseInt(num));

    return instrumentsOfType[Math.floor(Math.random() * instrumentsOfType.length)];
}
