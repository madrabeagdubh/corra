
// Trad Session Player - Scheduled Start Times for Perfect Sync
import * as abcjs from 'abcjs';
import { MusicEngine } from './musicEngine.js';
import { allTunes } from './allTunes.js';

const ENSEMBLE_PRESETS = 
{

    reel:      [46, 0, 105],
    jig:       [46, 0, 105],
    slipjig:   [46, 0, 105],
    hornpipe:  [46, 0, 105],
    polka:     [46, 0, 105],
    waltz:     [46, 0, 105],
    march:     [46, 0, 105],
    slide:     [46, 0, 105],
    barndance: [46, 0, 105],
    air:       [46, 0, 105],
    defaultPreset: [46, 0, 105]



};

const PATCH_NAMES = { 
    46: "Harp",
    105: "Banjo", 
    0: "Piano",
    22: "Harmonica"
};

const TEMPO_SETTINGS = {
    reel: 1300,
    jig: 1550,
    slipjig: 1650,
    hornpipe: 1500,
    polka: 1100,
    waltz: 2000,
    march: 1400,
    slide: 1000,
    barndance: 1200,
    air: 1500,
    defaultTempo: 1300
};

export class TradSessionPlayer {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.engine = new MusicEngine(this.audioContext);
        this.tracks = [];
        this.isPlaying = false;
        this.scheduledStartTime = null;
        this.loopTimeoutId = null;
        
        this.stage = document.createElement('div');
        this.stage.style.display = 'none';
        document.body.appendChild(this.stage);
    }

    async loadTune(tuneKey, preservePlayback = false) {
        console.log(`[TradSessionPlayer] Loading tune: ${tuneKey}`);
        
        try {
            // Only stop if not preserving playback for crossfade
            if (!preservePlayback) {
                await this.stop();
            }
            
            const tuneData = allTunes[tuneKey];
            if (!tuneData) {
                throw new Error(`Tune "${tuneKey}" not found`);
            }
            
            const baseMusic = typeof tuneData === 'string' ? tuneData : tuneData.abc;
            if (!baseMusic) {
                throw new Error(`Tune has no ABC notation`);
            }
            
            // Extract tune type
            let tuneType = 'reel';
            const rhythmMatch = baseMusic.match(/^R:\s*(.+)$/m);
            if (rhythmMatch && rhythmMatch[1]) {
                tuneType = rhythmMatch[1].trim().toLowerCase().replace(/\s+/g, '');
            }
            
            console.log(`[TradSessionPlayer] Tune type: ${tuneType}`);
            
            // Get instruments
            let patchIds = ENSEMBLE_PRESETS[tuneType] || ENSEMBLE_PRESETS.defaultPreset;
            console.log(`[TradSessionPlayer] Using patches:`, patchIds.map(id => `${id}:${PATCH_NAMES[id]}`));
            
            // Get tempo
            const tempoMs = TEMPO_SETTINGS[tuneType] || TEMPO_SETTINGS.defaultTempo;
            console.log(`[TradSessionPlayer] Tempo: ${tempoMs}ms per measure`);
            
            const soundFontUrls = [
                'https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/',
                'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/'
            ];
            
            // Create synths for each instrument using ORIGINAL ABC
            // Pre-allocate tracks array to preserve order
            this.tracks = new Array(patchIds.length);
            
            const promises = patchIds.map(async (patchId, index) => {
                try {
                    console.log(`[Track ${index}] Loading ${PATCH_NAMES[patchId]}`);
                    
                    // Modify ABC to use this instrument
                    const instrumentABC = this.setInstrumentProgram(baseMusic, patchId);
                    
                    const gain = this.engine.createTrackGainWithPanning(patchId);
                    
                    let synth;
                    let initSuccess = false;
                    
                    for (const soundFontUrl of soundFontUrls) {
                        try {
                            synth = new abcjs.synth.CreateSynth();
                            
                            const visualObj = abcjs.parseOnly(instrumentABC)[0];
                            
                            if (!visualObj || !visualObj.lines || visualObj.lines.length === 0) {
                                throw new Error('Parse produced no lines');
                            }
                            
                            await synth.init({
                                audioContext: this.audioContext,
                                visualObj: visualObj,
                                millisecondsPerMeasure: tempoMs,
                                options: {
                                    soundFontUrl: soundFontUrl,
                                    program: patchId
                                }
                            });
                            
                            initSuccess = true;
                            break;
                        } catch (error) {
                            console.warn(`[Track ${index}] Failed with ${soundFontUrl}`);
                        }
                    }
                    
                    if (!initSuccess) {
                        throw new Error(`Failed to init synth for ${PATCH_NAMES[patchId]}`);
                    }
                    
                    await synth.prime();
                    console.log(`[Track ${index}] Primed`);
                    
                    // Store duration from first synth
                    if (index === 0 && synth.duration) {
                        this.tuneDuration = synth.duration;
                    }
                    
                    // Store in the correct position instead of pushing
                    this.tracks[index] = { 
                        name: PATCH_NAMES[patchId],
                        synth, 
                        gain, 
                        active: (index === 0) // First track (Banjo) starts active
                    };
                    
                    // Set gain for first track
                    if (index === 0) {
                        gain.gain.value = gain.targetVolume || 1.0;
                    }
                    
                } catch (error) {
                    console.error(`[Track ${index}] Error:`, error);
                    throw error;
                }
            });

            await Promise.all(promises);
            console.log('[TradSessionPlayer] All tracks loaded');
            console.log('[TradSessionPlayer] Track order:', this.tracks.map(t => t.name));
            return true;
            
        } catch (error) {
            console.error('[TradSessionPlayer] Load error:', error);
            return false;
        }
    }

    /**
     * Add or replace MIDI program directive in ABC
     * Also apply simple bass transformation if needed
     */
    setInstrumentProgram(abcString, program) {
        const lines = abcString.split('\n');
        const result = [];
        let foundMIDI = false;
        let inMusicBody = false;
        
        for (const line of lines) {
            // Replace existing MIDI program or add before K:
            if (line.startsWith('%%MIDI program')) {
                result.push(`%%MIDI program ${program}`);
                foundMIDI = true;
            } else if (line.startsWith('K:')) {
                if (!foundMIDI) {
                    result.push(`%%MIDI program ${program}`);
                    foundMIDI = true;
                }
                result.push(line);
                inMusicBody = true;
            } else if (inMusicBody && program === 32 && line.includes('|')) {
                // Simple bass line for Acoustic Bass
                // Extract first note of each measure and create steady pattern
                const bassLine = line.replace(/\|([A-Ga-g])[A-Ga-g,'"\^_=\[\]0-9\/]*/g, (match, firstNote) => {
                    const bassNote = firstNote.toUpperCase();
                    return '|' + bassNote + '2' + bassNote + '2';
                });
                result.push(bassLine);
            } else {
                result.push(line);
            }
        }
        
        return result.join('\n');
    }

    async play() {
        console.log('[TradSessionPlayer] Playing with scheduled start...');
        
        if (this.audioContext.state !== 'running') {
            await this.audioContext.resume();
        }

        try {
            if (this.tracks.length === 0) {
                throw new Error('No tracks loaded');
            }
            
            this.isPlaying = true;
            
            // Schedule start time 100ms in the future
            // This gives JavaScript time to call start() on all synths
            // before any audio actually plays
            const scheduleAhead = 0.1; // 100ms
            this.scheduledStartTime = this.audioContext.currentTime + scheduleAhead;
            
            console.log(`[Scheduled] Will start at time: ${this.scheduledStartTime.toFixed(3)}`);
            console.log(`[Scheduled] Current time: ${this.audioContext.currentTime.toFixed(3)}`);
            
            // Start all synths (they'll all play from the same scheduled time)
            const startPromises = this.tracks.map(async (track, i) => {
                const startTime = this.audioContext.currentTime;
                console.log(`[Track ${i}] Starting at: ${startTime.toFixed(4)}`);
                await track.synth.start();
                const endTime = this.audioContext.currentTime;
                console.log(`[Track ${i}] Start completed in: ${((endTime - startTime) * 1000).toFixed(2)}ms`);
                
                // Connect audio
                if (track.synth.audioBufferPlayer) {
                    try {
                        track.synth.audioBufferPlayer.disconnect();
                    } catch (e) {}
                    track.synth.audioBufferPlayer.connect(track.gain);
                }
                
                if (track.synth.directSource) {
                    track.synth.directSource.forEach((source) => {
                        try {
                            source.disconnect();
                        } catch (e) {}
                        source.connect(track.gain);
                    });
                }
            });
            
            await Promise.all(startPromises);
            console.log('[Scheduled] All synths started');
            console.log('[Scheduled] Total elapsed:', ((this.audioContext.currentTime - this.scheduledStartTime + 0.1) * 1000).toFixed(2), 'ms');
            
            // Setup looping
            if (this.tuneDuration > 0) {
                this.setupLooping();
            }
            
            // NOTE: Do NOT auto-enable tracks here
            // The calling code (heroSelect.js) will handle which instruments to enable
            console.log('[TradSessionPlayer] Play complete - waiting for external track control');
            
        } catch (error) {
            console.error('[TradSessionPlayer] Play error:', error);
        }
    }

    setupLooping() {
        if (this.loopTimeoutId) {
            clearTimeout(this.loopTimeoutId);
        }
        
        // Calculate exact loop time based on Web Audio clock, not setTimeout
        const loopTime = (this.tuneDuration * 1000) - 50;
        
        this.loopTimeoutId = setTimeout(async () => {
            if (this.isPlaying) {
                console.log('[Loop] Restarting all synths synchronously...');
                
                // CRITICAL: Schedule ALL synths to start at the same future time
                const scheduleAhead = 0.05; // 50ms ahead
                this.scheduledStartTime = this.audioContext.currentTime + scheduleAhead;
                
                console.log(`[Loop] Scheduled restart at: ${this.scheduledStartTime.toFixed(3)}`);
                
                // Start all synths in rapid succession
                const startPromises = [];
                for (const track of this.tracks) {
                    startPromises.push(track.synth.start());
                }
                
                // Await all starts together
                await Promise.all(startPromises);
                
                // Reconnect audio immediately
                for (const track of this.tracks) {
                    if (track.synth.audioBufferPlayer) {
                        try {
                            track.synth.audioBufferPlayer.disconnect();
                        } catch (e) {}
                        track.synth.audioBufferPlayer.connect(track.gain);
                    }
                    
                    if (track.synth.directSource) {
                        track.synth.directSource.forEach((source) => {
                            try {
                                source.disconnect();
                            } catch (e) {}
                            source.connect(track.gain);
                        });
                    }
                }
                
                console.log('[Loop] All synths restarted');
                
                // Schedule next loop
                this.setupLooping();
            }
        }, loopTime);
    }

    toggleInstrument(index) {
        const track = this.tracks[index];
        if (!track) return false;
        
        track.active = !track.active;
        const targetVol = track.active ? (track.gain.targetVolume || 1.0) : 0.0;
        
        console.log(`[${track.name}] ${track.active ? 'ON' : 'OFF'}`);
        this.engine.applyFade(track.gain, targetVol, 0.4);
        
        return track.active;
    }

    testSimpleNote() {
        const now = this.audioContext.currentTime;
        const noteGain = this.audioContext.createGain();
        noteGain.connect(this.engine.masterGain);
        
        const notes = [330, 370, 392, 440, 494, 523, 587, 659];
        
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
    }

    async stop() {
        this.isPlaying = false;
        
        if (this.loopTimeoutId) {
            clearTimeout(this.loopTimeoutId);
            this.loopTimeoutId = null;
        }
        
        for (const track of this.tracks) {
            try {
                await track.synth.stop();
            } catch (e) {}
        }
        
        this.tracks = [];
        this.scheduledStartTime = null;
    }
}

