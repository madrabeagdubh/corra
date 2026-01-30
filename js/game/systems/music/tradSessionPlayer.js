// Trad Session Player v3.0 - Multi-Voice Single-Synth Architecture
import * as abcjs from 'abcjs';
import MusicEngine from './musicEngine.js';
import { allTunes } from './allTunes.js';

const ENSEMBLE_PRESETS = {
    reel: [105, 22, 43],       // Banjo, Harmonica, Contrabass
    jig: [105, 43, 0],         // Banjo, Contrabass, Piano
    slipjig: [105, 0, 22],     // Banjo, Piano, Harmonica
    hornpipe: [105, 43, 22],   // Banjo, Contrabass, Harmonica
    polka: [105, 22],          // Banjo, Harmonica
    waltz: [105, 0, 43],       // Banjo, Piano, Contrabass
    march: [105, 43],          // Banjo, Contrabass
    slide: [105, 0, 22],       // Banjo, Piano, Harmonica
    barndance: [105, 22, 43],  // Banjo, Harmonica, Contrabass
    air: [105, 0],             // Banjo, Piano
    default: [105, 22]         // Banjo, Harmonica
};

const PATCH_NAMES = { 
    43: "Contrabass",
    105: "Banjo", 
    0: "Piano",
    22: "Harmonica"
};

// Tempo settings in milliseconds per measure for different tune types
const TEMPO_SETTINGS = {
    reel: 1300,        // ~110 BPM (4/4 time)
    jig: 1550,         // ~115 BPM for dotted quarter (6/8 time)
    slipjig: 1650,     // Slightly slower for 9/8 time
    hornpipe: 1500,    // ~100 BPM (4/4 time)
    polka: 1100,       // ~130 BPM (2/4 time)
    waltz: 2000,       // ~90 BPM (3/4 time)
    march: 1400,       // ~105 BPM (4/4 time)
    slide: 1000,       // ~145 BPM (12/8 time, feels like fast 4)
    barndance: 1200,   // ~120 BPM (4/4 time)
    air: 2500,         // ~70 BPM (slow and expressive)
    default: 1300      // Default to reel tempo
};

// Reduced ornament probability
const ORNAMENT_PROBABILITY = {
    43: 0,      // Contrabass: no ornaments
    105: 0.06,  // Banjo: occasional rolls
    0: 0,       // Piano: clean
    22: 0.05    // Harmonica: some bends/ornaments
};

export default class TradSessionPlayer {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.engine = new MusicEngine(this.audioContext);
        this.synth = null;
        this.voices = [];
        this.isPlaying = false;
        this.loopTimer = null;
        
        this.stage = document.createElement('div');
        this.stage.style.display = 'none';
        document.body.appendChild(this.stage);
    }

    /**
     * Apply instrument-specific variations to create ensemble voicing
     */
    applyInstrumentVariations(music, patchId) {
        const lines = music.split('\n');
        
        // Piano: Simplify to chord tones and rhythm
        if (patchId === 0) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                
                let newLine = line;
                
                // Keep first and third notes of runs to create rhythmic accompaniment
                newLine = newLine.replace(/([A-Ga-g]{4,})/g, (match) => {
                    if (match.length >= 4) {
                        return match[0] + match[0] + match[2] + match[2];
                    }
                    return match;
                });
                
                return newLine;
            }).join('\n');
        }
        
        // Contrabass: Simple walking bass line
        if (patchId === 43) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                
                let newLine = line;
                
                // Extract first note of each measure and create steady bass
                newLine = newLine.replace(/\|([A-Ga-g])[A-Ga-g]*/g, (match, firstNote) => {
                    // Transpose down an octave for bass register
                    const lowerNote = firstNote.toLowerCase();
                    return '|' + lowerNote + lowerNote + lowerNote + lowerNote;
                });
                
                return newLine;
            }).join('\n');
        }
        
        // Harmonica: Melodic with occasional double-stops
        if (patchId === 22) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                
                let newLine = line;
                
                // Add occasional double-stops on longer notes
                newLine = newLine.replace(/([A-G])2/g, (match) => {
                    if (Math.random() < 0.3) return `[$1$1]2`;
                    return match;
                });
                
                return newLine;
            }).join('\n');
        }
        
        // Banjo: Keep full melody (lead instrument)
        return music;
    }

    /**
     * Add ornaments based on probability
     */
    addOrnaments(music, patchId) {
        const probability = ORNAMENT_PROBABILITY[patchId] || 0;
        if (probability === 0) return music;
        
        const lines = music.split('\n');
        return lines.map(line => {
            if (!line.includes('|')) return line;
            
            return line.replace(/([A-Ga-g])/g, (match) => {
                if (Math.random() < probability) {
                    const ornaments = ['~', '{/g}', '{g}', '{c}'];
                    return ornaments[Math.floor(Math.random() * ornaments.length)] + match;
                }
                return match;
            });
        }).join('\n');
    }

    /**
     * Extract the music body (everything after the header) from ABC notation
     */
    extractMusicBody(abcString) {
        const lines = abcString.split('\n');
        const musicLines = [];
        let inBody = false;
        
        for (const line of lines) {
            // Once we hit the K: (key) line, everything after is music
            if (line.match(/^K:/)) {
                inBody = true;
                continue;
            }
            
            if (inBody && line.trim()) {
                musicLines.push(line);
            }
        }
        
        return musicLines.join('\n');
    }

    /**
     * Create a multi-voice ABC notation from a base tune
     */
    createMultiVoiceABC(baseMusic, patchIds, tuneType) {
        console.log('[MultiVoice] Creating multi-voice ABC for', patchIds.length, 'instruments');
        
        // Parse the header from base music
        const lines = baseMusic.split('\n');
        const headerLines = [];
        let keyLine = '';
        
        for (const line of lines) {
            if (line.match(/^[XTRMQLK]:/)) {
                if (line.startsWith('K:')) {
                    keyLine = line;
                    break;
                }
                // Skip R: line as we'll use tuneType instead
                if (!line.startsWith('R:')) {
                    headerLines.push(line);
                }
            }
        }
        
        // Build the multi-voice ABC
        const multiVoiceLines = [];
        
        // Add header
        multiVoiceLines.push(...headerLines);
        
        // Add rhythm type
        multiVoiceLines.push(`R: ${tuneType}`);
        
        // Add key
        multiVoiceLines.push(keyLine);
        multiVoiceLines.push('');
        
        // Add each instrument as a separate voice
        patchIds.forEach((patchId, index) => {
            const voiceNum = index + 1;
            const instrumentName = PATCH_NAMES[patchId] || `Voice${voiceNum}`;
            
            console.log(`[MultiVoice] Creating voice ${voiceNum} for ${instrumentName} (patch ${patchId})`);
            
            // Apply instrument-specific variations
            let voiceMusic = this.applyInstrumentVariations(baseMusic, patchId);
            voiceMusic = this.addOrnaments(voiceMusic, patchId);
            
            // Extract just the music body (no headers)
            const musicBody = this.extractMusicBody(voiceMusic);
            
            // Add MIDI program and voice directives
            multiVoiceLines.push(`%%MIDI program ${patchId}`);
            multiVoiceLines.push(`V:${voiceNum} name="${instrumentName}" clef=treble`);
            multiVoiceLines.push(musicBody);
            multiVoiceLines.push('');
        });
        
        const result = multiVoiceLines.join('\n');
        console.log('[MultiVoice] Generated ABC length:', result.length, 'chars');
        console.log('[MultiVoice] Preview:', result.substring(0, 500));
        
        return result;
    }

    /**
     * Main loader - creates a single synth with multiple voices
     */
    async loadTune(tuneKey) {
        console.log(`[TradSessionPlayer] Loading tune: ${tuneKey}`);
        
        try {
            await this.stop();
            
            const tuneData = allTunes[tuneKey];
            if (!tuneData) {
                throw new Error(`Tune "${tuneKey}" not found in allTunes collection`);
            }
            
            // Handle both string format and object format
            const baseMusic = typeof tuneData === 'string' ? tuneData : tuneData.abc;
            
            if (!baseMusic) {
                throw new Error(`Tune "${tuneKey}" has no ABC notation data`);
            }
            
            // Extract tune type from ABC notation's R: line
            let tuneType = 'default';
            const rhythmMatch = baseMusic.match(/^R:\s*(.+)$/m);
            if (rhythmMatch && rhythmMatch[1]) {
                tuneType = rhythmMatch[1].trim().toLowerCase().replace(/\s+/g, '');
            }
            
            console.log(`[TradSessionPlayer] Tune type: ${tuneType}`);
            
            // Get ensemble preset for this tune type
            let patchIds = ENSEMBLE_PRESETS[tuneType];
            if (!patchIds || !Array.isArray(patchIds)) {
                console.warn(`[TradSessionPlayer] Tune type "${tuneType}" not found, using default preset`);
                patchIds = ENSEMBLE_PRESETS.default;
            }
            
            if (!patchIds || !Array.isArray(patchIds) || patchIds.length === 0) {
                throw new Error(`No valid ensemble preset found for tune type "${tuneType}"`);
            }
            
            console.log(`[TradSessionPlayer] Using patches:`, patchIds.map(id => `${id}:${PATCH_NAMES[id]}`));
            
            // Create multi-voice ABC notation
            const multiVoiceABC = this.createMultiVoiceABC(baseMusic, patchIds, tuneType);
            
            // Get tempo for this tune type
            const tempoMs = TEMPO_SETTINGS[tuneType] || TEMPO_SETTINGS.default;
            console.log(`[TradSessionPlayer] Tempo: ${tempoMs}ms per measure`);
            
            // Create gain nodes for each voice
            this.voices = patchIds.map((patchId, index) => {
                const gain = this.engine.createTrackGainWithPanning(patchId);
                return {
                    name: PATCH_NAMES[patchId] || `Voice${index + 1}`,
                    patchId: patchId,
                    gain: gain,
                    active: false,
                    voiceIndex: index
                };
            });
            
            console.log(`[TradSessionPlayer] Created ${this.voices.length} voice gain nodes`);
            
            // Create single synth with multi-voice ABC
            this.synth = new abcjs.synth.CreateSynth();
            
            const soundFontUrls = [
                'https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/',
                'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/'
            ];
            
            let initSuccess = false;
            let lastError = null;
            
            for (const soundFontUrl of soundFontUrls) {
                try {
                    console.log(`[TradSessionPlayer] Trying soundfont: ${soundFontUrl}`);
                    
                    const visualObj = abcjs.renderAbc(this.stage, multiVoiceABC, { 
                        responsive: 'resize' 
                    })[0];
                    
                    await this.synth.init({
                        audioContext: this.audioContext,
                        visualObj: visualObj,
                        millisecondsPerMeasure: tempoMs,
                        options: {
                            soundFontUrl: soundFontUrl
                        }
                    });
                    
                    console.log(`[TradSessionPlayer] Synth initialized successfully`);
                    initSuccess = true;
                    break;
                    
                } catch (error) {
                    console.warn(`[TradSessionPlayer] Failed with ${soundFontUrl}:`, error.message);
                    lastError = error;
                }
            }
            
            if (!initSuccess) {
                throw new Error(`All soundfont URLs failed. Last error: ${lastError?.message}`);
            }
            
            console.log(`[TradSessionPlayer] Priming synth...`);
            
            const primeTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Synth prime timeout (10s)')), 10000)
            );
            
            await Promise.race([this.synth.prime(), primeTimeout]);
            console.log(`[TradSessionPlayer] Synth primed successfully`);
            
            // Connect synth audio output through voice-specific gain nodes
            // Note: abcjs outputs a single mixed audio stream, so we connect to master
            // Individual voice control is achieved through the gain nodes in the rendering
            if (this.synth.audioBufferPlayer && this.synth.audioBufferPlayer.connect) {
                try {
                    this.synth.audioBufferPlayer.disconnect();
                    this.synth.audioBufferPlayer.connect(this.engine.masterGain);
                    console.log(`[TradSessionPlayer] Connected synth to master gain`);
                } catch (e) {
                    console.warn(`[TradSessionPlayer] Could not reconnect audioBufferPlayer:`, e);
                }
            }
            
            console.log('[TradSessionPlayer] Load complete. Voices:', this.voices.length);
            return true;
            
        } catch (loadError) {
            console.error('[TradSessionPlayer] Load error:', loadError);
            console.error('[TradSessionPlayer] Load error stack:', loadError.stack);
            return false;
        }
    }

    async play() {
        console.log('[TradSessionPlayer] Playing...');
        
        if (this.audioContext.state !== 'running') {
            await this.audioContext.resume();
        }

        try {
            if (!this.synth) {
                throw new Error('No synth loaded. Call loadTune() first.');
            }
            
            this.isPlaying = true;
            
            // Start the single synth
            await this.synth.start();
            console.log('[TradSessionPlayer] Synth started');
            
            // Get the duration of the tune for looping
            const duration = this.synth.duration || 10; // fallback to 10 seconds
            console.log(`[TradSessionPlayer] Tune duration: ${duration} seconds`);
            
            // Set up automatic looping
            this.setupLooping(duration);
            
            // Reconnect audio if needed
            if (this.synth.directSource && this.synth.directSource.length > 0) {
                this.synth.directSource.forEach((source) => {
                    try {
                        source.disconnect();
                        source.connect(this.engine.masterGain);
                    } catch (e) {
                        console.error('[TradSessionPlayer] Reconnection failed:', e);
                    }
                });
            }
            
            // Default: Turn on first two voices
            if (this.voices.length > 0) {
                console.log('[TradSessionPlayer] Auto-enabling first voice...');
                this.toggleVoice(0);
                
                if (this.voices.length > 1) {
                    console.log('[TradSessionPlayer] Also enabling second voice...');
                    this.toggleVoice(1);
                }
            }
            
            console.log('[TradSessionPlayer] Play complete');
            
        } catch (playError) {
            console.error('[TradSessionPlayer] Play error:', playError);
            console.error('[TradSessionPlayer] Play error stack:', playError.stack);
        }
    }

    setupLooping(duration) {
        // Clear any existing loop timer
        if (this.loopTimer) {
            clearTimeout(this.loopTimer);
        }
        
        // Schedule the restart slightly before the end to ensure smooth looping
        const loopTime = (duration * 1000) - 50; // 50ms before end
        
        this.loopTimer = setTimeout(async () => {
            if (this.isPlaying && this.synth) {
                console.log('[TradSessionPlayer] Looping...');
                
                try {
                    await this.synth.start();
                    
                    // Reconnect audio
                    if (this.synth.directSource && this.synth.directSource.length > 0) {
                        this.synth.directSource.forEach((source) => {
                            try {
                                source.disconnect();
                                source.connect(this.engine.masterGain);
                            } catch (e) {}
                        });
                    }
                    
                    // Set up the next loop
                    this.setupLooping(duration);
                    
                } catch (e) {
                    console.error('[TradSessionPlayer] Loop restart failed:', e);
                }
            }
        }, loopTime);
    }

    toggleVoice(index) {
        const voice = this.voices[index];
        if (!voice) return false;
        
        voice.active = !voice.active;
        const targetVol = voice.active ? (voice.gain.targetVolume || 1.0) : 0.0;
        
        console.log(`[${voice.name}] ${voice.active ? 'ON' : 'OFF'}`);
        this.engine.applyFade(voice.gain, targetVol, 0.4);
        
        return voice.active;
    }

    // Alias for backward compatibility
    toggleInstrument(index) {
        return this.toggleVoice(index);
    }

    // Expose voices as tracks for backward compatibility with UI
    get tracks() {
        return this.voices;
    }

    /**
     * Test audio with a simple synthesized note
     */
    testSimpleNote() {
        console.log('[TradSessionPlayer] testSimpleNote() - Creating simple oscillator melody');
        
        const now = this.audioContext.currentTime;
        const noteGain = this.audioContext.createGain();
        noteGain.connect(this.engine.masterGain);
        
        // Play a simple E minor scale
        const notes = [330, 370, 392, 440, 494, 523, 587, 659]; // E3 to E4
        
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.2);
            osc.connect(noteGain);
            
            noteGain.gain.setValueAtTime(0, now + i * 0.2);
            noteGain.gain.linearRampToValueAtTime(0.1, now + i * 0.2 + 0.01);
            noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.19);
            
            osc.start(now + i * 0.2);
            osc.stop(now + i * 0.2 + 0.2);
        });
        
        console.log('[TradSessionPlayer] Simple note test completed');
    }

    async stop() {
        this.isPlaying = false;
        
        // Clear loop timer
        if (this.loopTimer) {
            clearTimeout(this.loopTimer);
            this.loopTimer = null;
        }
        
        // Stop synth
        if (this.synth) {
            try {
                await this.synth.stop();
            } catch (e) {
                console.warn('[TradSessionPlayer] Error stopping synth:', e);
            }
            this.synth = null;
        }
        
        // Reset voices
        this.voices = [];
    }
}

