// Trad Session Player v2.0 - Multi-part Arrangements
import * as abcjs from 'abcjs';
import MusicEngine from './musicEngine.js';
import { allTunes } from './allTunes.js';

const ENSEMBLE_PRESETS = {
    reel: [105, 22, 46],     // Banjo, Harmonica (concertina-like), Harp
    jig: [105, 32, 46],      // Banjo, Acoustic Bass, Harp
    slide: [105, 60, 0],     // Banjo, French Horn, Piano
    hornpipe: [105, 57, 32], // Banjo, Trombone, Bass
    default: [105, 22, 46]   // Banjo, Harmonica, Harp
};

const PATCH_NAMES = { 
    32: "Acoustic Bass",
    38: "Synth Bass",
    39: "Synth Bass 2",
    42: "Cello",
    43: "Contrabass",
    47: "Timpani",
    57: "Trombone",
    58: "Tuba",
    60: "French Horn",
    66: "Tenor Sax",
    105: "Banjo", 
    106: "Banjo 2",
    0: "Piano",
    73: "Flute",
    21: "Accordion",
    22: "Harmonica",
    23: "Tango Accordion",
    46: "Harp",
    110: "Fiddle",
    40: "Violin"
};

// Timing offsets kept at zero for perfect sync
const INSTRUMENT_TIMING_OFFSETS = {
    32: 0, 42: 0, 57: 0, 58: 0, 60: 0, 66: 0, 105: 0, 106: 0, 0: 0, 73: 0, 21: 0, 22: 0, 23: 0, 46: 0, 110: 0, 40: 0
};

// Reduced ornament probability - more subtle
const ORNAMENT_PROBABILITY = {
    32: 0,      // Bass: no ornaments, keep it solid
    42: 0.02,   // Cello: very minimal
    57: 0.03,   // Trombone: very few, powerful notes
    58: 0,      // Tuba: no ornaments
    60: 0.04,   // French Horn: occasional
    66: 0.08,   // Tenor Sax: jazzy ornaments
    105: 0.06,  // Banjo: occasional rolls
    106: 0.04,  // Banjo 2: even fewer ornaments
    0: 0,       // Piano: clean
    73: 0.05,   // Flute: some cuts
    21: 0.04,   // Accordion: occasional
    22: 0.05,   // Harmonica: some bends/ornaments
    23: 0.04,   // Tango Accordion: occasional
    46: 0.02,   // Harp: minimal
    110: 0.05,  // Fiddle: some grace notes
    40: 0.05    // Violin: some grace notes
};

export default class TradSessionPlayer {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.engine = new MusicEngine(this.audioContext);
        this.tracks = [];
        this.isPlaying = false;
        
        this.stage = document.createElement('div');
        this.stage.style.display = 'none';
        document.body.appendChild(this.stage);
    }

    /**
     * Add instrument-specific variations to create a fuller ensemble sound
     */
    applyInstrumentVariations(music, patchId) {
        const lines = music.split('\n');
        
        // Harp: Play arpeggiated/broken chords on longer notes
        if (patchId === 46) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                
                // Break up longer notes (2, 3, 4) into flowing patterns
                let newLine = line;
                newLine = newLine.replace(/([A-G])4/g, '$1$1$1$1');  // Whole note -> 4 quarters
                newLine = newLine.replace(/([A-G])3/g, '$1$1$1');    // Dotted half -> 3 quarters
                newLine = newLine.replace(/([A-G])2/g, '$1$1');      // Half note -> 2 quarters
                
                return newLine;
            }).join('\n');
        }
        
        // Piano: Simplify to emphasize chord tones and rhythm
        if (patchId === 0) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                
                let newLine = line;
                
                // Remove some passing notes - keep first note of groups
                // This makes piano more rhythmic, less melodic
                newLine = newLine.replace(/([A-Ga-g]{4,})/g, (match) => {
                    // Keep first, third note of longer runs
                    if (match.length >= 4) {
                        return match[0] + match[0] + match[2] + match[2];
                    }
                    return match;
                });
                
                return newLine;
            }).join('\n');
        }
        
        // Bass: Play root notes and fifths (simplified bass line)
        if (patchId === 32) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                
                let newLine = line;
                
                // Simplify to first note of each measure/bar
                // This creates a walking bass feel
                newLine = newLine.replace(/\|([A-Ga-g])[A-Ga-g]*/g, (match, firstNote) => {
                    // Repeat the first note to create steady bass
                    return '|' + firstNote + firstNote + firstNote + firstNote;
                });
                
                return newLine;
            }).join('\n');
        }
        
        // Accordion/Harmonica: Play on strong beats, add chords
        if (patchId === 21 || patchId === 22 || patchId === 23) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                
                let newLine = line;
                
                // For harmonica: keep it more melodic, less chordal
                if (patchId === 22) {
                    // Just add occasional double-stops
                    newLine = newLine.replace(/([A-G])2/g, (match) => {
                        if (Math.random() < 0.3) return `[$1$1]2`;
                        return match;
                    });
                } else {
                    // Accordion: more chords
                    newLine = newLine.replace(/([A-G])2/g, '[$1$1]2');
                }
                
                return newLine;
            }).join('\n');
        }
        
        // Brass (Trombone, French Horn): Play melody with sustained notes
        if (patchId === 57 || patchId === 60) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                
                let newLine = line;
                
                // Lengthen notes for brass sustain
                newLine = newLine.replace(/([A-G])([A-G])([A-G])([A-G])/g, '$12$32');
                
                // Add some octave jumps for power
                newLine = newLine.replace(/\|([A-G])/g, (match, note) => {
                    if (Math.random() < 0.2) {
                        return '|' + note.toLowerCase(); // Drop octave occasionally
                    }
                    return match;
                });
                
                return newLine;
            }).join('\n');
        }
        
        // Tuba: Deep bass notes
        if (patchId === 58) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                
                // Play very simple bass line (first note of each measure, held)
                let newLine = line.replace(/\|([A-Ga-g])[A-Ga-g]*/g, '|$14');
                
                return newLine;
            }).join('\n');
        }
        
        // Tenor Sax: Jazzy variations
        if (patchId === 66) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                
                let newLine = line;
                
                // Add some chromatic approaches
                newLine = newLine.replace(/([A-G])([A-G])/g, (match, n1, n2) => {
                    if (Math.random() < 0.15) {
                        return `${n1}^${n1}${n2}`; // Add chromatic note
                    }
                    return match;
                });
                
                return newLine;
            }).join('\n');
        }
        
        // Banjo: Keep full melody (it's the lead)
        return music;
    }

    /**
     * Add ornaments to ABC notation based on tune type and instrument
     */
    addOrnaments(music, tuneType, patchId) {
        const probability = ORNAMENT_PROBABILITY[patchId] || 0;
        if (probability === 0) return music;
        
        const lines = music.split('\n');
        const ornamented = lines.map(line => {
            // Only ornament note lines (contains bars |)
            if (!line.includes('|') || line.trim().startsWith('"')) return line;
            
            let newLine = line;
            
            // For banjo: add occasional mordents and short rolls
            if (patchId === 105 || patchId === 106) {
                // Add ~(tilde) for mordent/roll on occasional notes
                newLine = newLine.replace(/([A-G][2-4])/g, (match) => {
                    if (Math.random() < probability) {
                        return `~${match}`;
                    }
                    return match;
                });
            }
            
            // For other instruments: very occasional grace notes
            else {
                // Single grace note before occasional notes
                newLine = newLine.replace(/\|([A-Ga-g])/g, (match, note) => {
                    if (Math.random() < probability) {
                        return `|{${note.toLowerCase()}}${note}`;
                    }
                    return match;
                });
            }
            
            return newLine;
        });
        
        return ornamented.join('\n');
    }

    /**
     * Add swing/lilt to jigs - simplified version
     */
    addSwing(music, tuneType) {
        if (tuneType !== 'jig') return music;
        
        // For jigs, just mark the tune type - abcjs will handle the feel
        return music;
    }

    async loadTune(tuneKey) {
        console.log('[TradSessionPlayer] Loading:', tuneKey);
        
        await this.stop();
        
        const rawAbc = allTunes[tuneKey];
        if (!rawAbc) {
            console.error('[TradSessionPlayer] Tune not found:', tuneKey);
            return false;
        }

        // Detect tune type from ABC
        const lowerAbc = rawAbc.toLowerCase();
        let tuneType = 'reel'; // default
        
        if (lowerAbc.includes('r: reel') || lowerAbc.includes('r:reel')) tuneType = 'reel';
        else if (lowerAbc.includes('r: jig') || lowerAbc.includes('r:jig')) tuneType = 'jig';
        else if (lowerAbc.includes('r: slide') || lowerAbc.includes('r:slide')) tuneType = 'slide';
        else if (lowerAbc.includes('r: hornpipe') || lowerAbc.includes('r:hornpipe')) tuneType = 'hornpipe';
        
        const patches = ENSEMBLE_PRESETS[tuneType] || ENSEMBLE_PRESETS.default;
        
        // Set appropriate BPM for tune type
        const bpmMap = {
            reel: 160,
            jig: 120,
            slide: 180,
            hornpipe: 140
        };
        const bpm = bpmMap[tuneType] || 160;

        console.log('[TradSessionPlayer] Type:', tuneType, 'BPM:', bpm, 'Patches:', patches);

        try {
            const promises = patches.map(async (patchId, index) => {
                const gain = this.engine.createTrackGainWithPanning(patchId);
                
                // Clean up the ABC
                const cleanedAbc = rawAbc.trim();
                const lines = cleanedAbc.split('\n');
                
                // Extract important headers and find where music starts
                let meter = '4/4';
                let length = '1/8';
                let key = 'D';
                let rhythm = tuneType;  // Use the detected tune type
                
                const musicLines = [];
                let headersDone = false;
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    
                    // Skip empty lines before music starts
                    if (!headersDone && trimmed === '') continue;
                    
                    // Extract header info
                    if (trimmed.match(/^M:\s*(.+)/)) meter = trimmed.match(/^M:\s*(.+)/)[1];
                    if (trimmed.match(/^L:\s*(.+)/)) length = trimmed.match(/^L:\s*(.+)/)[1];
                    if (trimmed.match(/^K:\s*(.+)/)) key = trimmed.match(/^K:\s*(.+)/)[1];
                    if (trimmed.match(/^R:\s*(.+)/)) rhythm = trimmed.match(/^R:\s*(.+)/)[1];
                    
                    // Header lines start with a capital letter followed by a colon
                    const isHeader = /^[A-Z]:\s*/.test(trimmed);
                    const isDirective = /^%%/.test(trimmed);
                    
                    if (!isHeader && !isDirective && trimmed !== '') {
                        headersDone = true;
                    }
                    
                    // Once we're past headers, collect everything
                    if (headersDone) {
                        musicLines.push(line);
                    }
                }
                
                const musicOnly = musicLines.join('\n').trim();
                
                // Apply session-style variations per instrument
                let enhancedMusic = musicOnly;
                
                // First: Apply instrument-specific variations (different parts)
                enhancedMusic = this.applyInstrumentVariations(enhancedMusic, patchId);
                
                // Then: Add swing/lilt based on tune type
                enhancedMusic = this.addSwing(enhancedMusic, tuneType);
                
                // Finally: Add ornaments based on instrument
                enhancedMusic = this.addOrnaments(enhancedMusic, tuneType, patchId);
                
                // Get timing offset for this instrument
                const timingOffset = INSTRUMENT_TIMING_OFFSETS[patchId] || 0;
                
                // Build complete ABC with clean headers
                let fullAbc = `X:1
T:${tuneKey}
R:${rhythm}
M:${meter}
L:${length}
Q:1/4=${bpm}
K:${key}
%%MIDI program ${patchId}`;
                
                // Transpose bass instruments down
                if (patchId === 32) {
                    fullAbc += '\n%%MIDI transpose -12';  // Acoustic bass: 1 octave
                }
                
                fullAbc += '\n' + enhancedMusic;
                
                console.log(`[Track ${index}] ${PATCH_NAMES[patchId]} loaded`);
                
                try {
                    // Render ABC
                    const visualObjs = abcjs.renderAbc(this.stage, fullAbc, {
                        add_classes: true
                    });
                    
                    if (!visualObjs || visualObjs.length === 0) {
                        throw new Error('ABC rendering returned no visual objects');
                    }
                    
                    const visualObj = visualObjs[0];
                    console.log(`[Track ${index}] ABC rendered, visualObj:`, visualObj);
                    console.log(`[Track ${index}] visualObj.lines length:`, visualObj.lines?.length);
                    console.log(`[Track ${index}] visualObj.metaText:`, visualObj.metaText);
                    
                    // Check if there's actual music
                    if (!visualObj.lines || visualObj.lines.length === 0) {
                        console.error(`[Track ${index}] WARNING: No music lines in visualObj!`);
                        console.error(`[Track ${index}] This means ABC parsing failed silently`);
                    }
                    
                    // Log the first few elements if they exist
                    if (visualObj.lines && visualObj.lines.length > 0) {
                        console.log(`[Track ${index}] First line:`, visualObj.lines[0]);
                        if (visualObj.lines[0].staff) {
                            console.log(`[Track ${index}] First staff voices:`, visualObj.lines[0].staff[0]?.voices?.length);
                        }
                    }
                    
                    // Create synth
                    console.log(`[Track ${index}] Creating synth...`);
                    const synth = new abcjs.synth.CreateSynth();
                    
                    // Try to init synth with timeout
                    console.log(`[Track ${index}] Initializing synth with audioContext state:`, this.audioContext.state);
                    
                    // List of soundfont URLs to try
                    const soundFontUrls = [
                        "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/",
                        "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/",
                        "https://surikov.github.io/webaudiofontdata/sound/"
                    ];
                    
                    let initSuccess = false;
                    let lastError = null;
                    
                    for (let urlIndex = 0; urlIndex < soundFontUrls.length && !initSuccess; urlIndex++) {
                        const soundFontUrl = soundFontUrls[urlIndex];
                        console.log(`[Track ${index}] Trying soundfont URL ${urlIndex + 1}/${soundFontUrls.length}: ${soundFontUrl}`);
                        
                        try {
                            // Create timeout promise
                            const timeoutPromise = new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Synth init timeout (15s)')), 15000)
                            );
                            
                            const initPromise = synth.init({
                                audioContext: this.audioContext,
                                visualObj: visualObj,
                                millisecondsPerMeasure: tuneType === 'reel' ? 1500 : (tuneType === 'jig' ? 2000 : 1700),
                                options: {
                                    soundFontUrl: soundFontUrl,
                                    debugCallback: (msg) => console.log(`[Track ${index} abcjs]`, msg)
                                }
                            });
                            
                            // Race between init and timeout
                            await Promise.race([initPromise, timeoutPromise]);
                            
                            console.log(`[Track ${index}] Synth initialized successfully with ${soundFontUrl}`);
                            
                            // CRITICAL: Set the output gain node before priming
                            console.log(`[Track ${index}] Setting gain node on synth...`);
                            if (synth.audioBufferPlayer) {
                                console.log(`[Track ${index}] Found audioBufferPlayer, connecting to gain...`);
                                try {
                                    synth.audioBufferPlayer.disconnect();
                                    synth.audioBufferPlayer.connect(gain);
                                    console.log(`[Track ${index}] Connected audioBufferPlayer to gain node`);
                                } catch (e) {
                                    console.warn(`[Track ${index}] Could not reconnect audioBufferPlayer:`, e);
                                }
                            }
                            
                            initSuccess = true;
                            
                        } catch (error) {
                            console.warn(`[Track ${index}] Failed with ${soundFontUrl}:`, error.message);
                            lastError = error;
                            // Continue to next URL
                        }
                    }
                    
                    if (!initSuccess) {
                        throw new Error(`All soundfont URLs failed. Last error: ${lastError?.message}`);
                    }
                    
                    console.log(`[Track ${index}] Priming synth...`);
                    
                    const primeTimeout = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Synth prime timeout (10s)')), 10000)
                    );
                    
                    await Promise.race([synth.prime(), primeTimeout]);
                    console.log(`[Track ${index}] Synth primed successfully`);
                    
                    this.tracks.push({ 
                        name: PATCH_NAMES[patchId] || "Instrument", 
                        synth, 
                        gain, 
                        active: false,
                        timingOffset: timingOffset
                    });
                    
                    console.log(`[Track ${index}] Track added successfully`);
                    
                } catch (trackError) {
                    console.error(`[Track ${index}] Error:`, trackError);
                    console.error(`[Track ${index}] Error stack:`, trackError.stack);
                    throw trackError;
                }
            });

            await Promise.all(promises);
            console.log('[TradSessionPlayer] All tracks loaded. Total tracks:', this.tracks.length);
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
            console.log('[TradSessionPlayer] Starting all synths...');
            
            this.isPlaying = true; // Enable looping
            
            // Start all synths at exactly the same time for perfect sync
            const startPromises = this.tracks.map(async (track, i) => {
                // Start the synth
                await track.synth.start();
                
                // Set up looping callback AFTER start
                setTimeout(() => {
                    if (track.synth.onEnded && typeof track.synth.onEnded === 'function') {
                        // Already has a callback, replace it
                        const originalOnEnded = track.synth.onEnded;
                        track.synth.onEnded = () => {
                            originalOnEnded();
                            if (this.isPlaying) {
                                this.restartTrack(i);
                            }
                        };
                    } else {
                        // Set our own callback
                        track.synth.onEnded = () => {
                            if (this.isPlaying) {
                                this.restartTrack(i);
                            }
                        };
                    }
                }, 100);
                
                // Reconnect the audio through our gain node
                if (track.synth.directSource && track.synth.directSource.length > 0) {
                    track.synth.directSource.forEach((source) => {
                        try {
                            source.disconnect();
                            source.connect(track.gain);
                        } catch (e) {
                            console.error(`[Track ${i}] Reconnection failed:`, e);
                        }
                    });
                }
            });
            
            await Promise.all(startPromises);

            // Default: Turn on first two instruments
            if (this.tracks.length > 0) {
                console.log('[TradSessionPlayer] Auto-enabling first track...');
                this.toggleInstrument(0);
                
                if (this.tracks.length > 1) {
                    console.log('[TradSessionPlayer] Also enabling second track...');
                    this.toggleInstrument(1);
                }
            }
            
            console.log('[TradSessionPlayer] Play complete');
            
        } catch (playError) {
            console.error('[TradSessionPlayer] Play error:', playError);
            console.error('[TradSessionPlayer] Play error stack:', playError.stack);
        }
    }

    toggleInstrument(index) {
        const track = this.tracks[index];
        if (!track) return false;
        
        track.active = !track.active;
        // Use the target volume stored on the gain node, or default to 1.0
        const targetVol = track.active ? (track.gain.targetVolume || 1.0) : 0.0;
        
        console.log(`[${track.name}] ${track.active ? 'ON' : 'OFF'}`);
        this.engine.applyFade(track.gain, targetVol, 0.4);
        
        return track.active;
    }

    async restartTrack(index) {
        const track = this.tracks[index];
        if (!track) return;
        
        console.log(`[Track ${index}] Looping...`);
        
        try {
            await track.synth.start();
            
            // Reconnect audio
            if (track.synth.directSource && track.synth.directSource.length > 0) {
                track.synth.directSource.forEach((source) => {
                    try {
                        source.disconnect();
                        source.connect(track.gain);
                    } catch (e) {}
                });
            }
        } catch (e) {
            console.error(`[Track ${index}] Restart failed:`, e);
        }
    }

    /**
     * Test audio with a simple synthesized note (no soundfonts needed)
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
            osc.type = 'triangle'; // More pleasant than sine
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
        this.isPlaying = false; // Disable looping
        
        const stopPromises = this.tracks.map((t) => {
            try {
                return Promise.resolve(t.synth.stop());
            } catch (e) {
                return Promise.resolve();
            }
        });
        
        await Promise.all(stopPromises);
        this.tracks = [];
    }
}

