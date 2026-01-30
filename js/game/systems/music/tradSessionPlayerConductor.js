// Trad Session Player v5.0 - True Multi-Voice with MIDI Volume Control
import * as abcjs from 'abcjs';
import { MusicEngine } from './musicEngine.js';
import { allTunes } from './allTunes.js';

const ENSEMBLE_PRESETS = {
    reel: [105, 22, 32, 0],      // Banjo, Harmonica, Bass, Piano
    jig: [105, 32, 0],           // Banjo, Bass, Piano
    slipjig: [105, 0, 22],       // Banjo, Piano, Harmonica
    hornpipe: [105, 32, 22],     // Banjo, Bass, Harmonica
    polka: [105, 22],            // Banjo, Harmonica
    waltz: [105, 0, 32],         // Banjo, Piano, Bass
    march: [105, 32],            // Banjo, Bass
    slide: [105, 0, 22],         // Banjo, Piano, Harmonica
    barndance: [105, 22, 32],    // Banjo, Harmonica, Bass
    air: [105, 0],               // Banjo, Piano
    defaultPreset: [105, 22]     // Banjo, Harmonica
};

const PATCH_NAMES = { 
    32: "Acoustic Bass",
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
    air: 2500,
    defaultTempo: 1300
};

export class TradSessionPlayer {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.engine = new MusicEngine(this.audioContext);
        this.synth = null;
        this.voices = [];
        this.isPlaying = false;
        this.loopTimer = null;
        this.baseMusic = null;
        this.patchIds = [];
        this.tuneType = null;
        this.tempoMs = 1300;
        
        this.stage = document.createElement('div');
        this.stage.style.display = 'none';
        document.body.appendChild(this.stage);
    }

    /**
     * Apply instrument-specific variations
     */
    applyInstrumentVariations(music, patchId) {
        const lines = music.split('\n');
        
        // Piano: Simplified chord accompaniment
        if (patchId === 0) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                let newLine = line.replace(/([A-Ga-g]{4,})/g, (match) => {
                    if (match.length >= 4) {
                        return match[0] + match[0] + match[2] + match[2];
                    }
                    return match;
                });
                return newLine;
            }).join('\n');
        }
        
        // Bass: Simple walking bass
        if (patchId === 32) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                return line.replace(/\|[A-Ga-g,'"\^_=\[\]0-9\/]+/g, (measure) => {
                    const noteMatch = measure.match(/[A-G]/i);
                    if (!noteMatch) return measure;
                    const bassNote = noteMatch[0].toUpperCase();
                    return '|' + bassNote + '2' + bassNote + '2';
                });
            }).join('\n');
        }
        
        // Harmonica: Occasional double-stops
        if (patchId === 22) {
            return lines.map(line => {
                if (!line.includes('|')) return line;
                return line.replace(/([A-G])2/g, (match) => {
                    if (Math.random() < 0.3) return `[$1$1]2`;
                    return match;
                });
            }).join('\n');
        }
        
        // Banjo: Keep melody as-is
        return music;
    }

    /**
     * Extract music body from ABC
     */
    extractMusicBody(abcString) {
        const lines = abcString.split('\n');
        const musicLines = [];
        let inBody = false;
        
        for (const line of lines) {
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
     * Create multi-voice ABC with MIDI volume controls
     */
    createMultiVoiceABC() {
        console.log('[MultiVoice] Creating ABC with dynamic volumes');
        
        // Parse header from base music
        const lines = this.baseMusic.split('\n');
        const headerLines = [];
        let keyLine = '';
        
        for (const line of lines) {
            if (line.match(/^[XTMQL]:/)) {
                if (!line.startsWith('R:')) {
                    headerLines.push(line);
                }
            }
            if (line.startsWith('K:')) {
                keyLine = line;
                break;
            }
        }
        
        // Build multi-voice ABC
        const result = [];
        result.push(...headerLines);
        result.push(`R: ${this.tuneType}`);
        result.push(keyLine);
        result.push('');
        
        // Add each voice
        this.patchIds.forEach((patchId, index) => {
            const voice = this.voices[index];
            const voiceNum = index + 1;
            const instrumentName = PATCH_NAMES[patchId];
            
            // Determine MIDI volume based on active state
            // MIDI control 7 is volume: 0-127, where 0=silent, 127=max
            const volume = voice.active ? 100 : 0;
            
            console.log(`[MultiVoice] Voice ${voiceNum} (${instrumentName}): volume=${volume}`);
            
            // Apply instrument variations
            let voiceMusic = this.applyInstrumentVariations(this.baseMusic, patchId);
            const musicBody = this.extractMusicBody(voiceMusic);
            
            // Add voice with MIDI program and volume control
            result.push(`%%MIDI program ${patchId}`);
            result.push(`%%MIDI control 7 ${volume}`);
            result.push(`V:${voiceNum} name="${instrumentName}"`);
            result.push(musicBody);
            result.push('');
        });
        
        return result.join('\n');
    }

    /**
     * Load tune and prepare voices
     */
    async loadTune(tuneKey) {
        console.log(`[TradSessionPlayer] Loading tune: ${tuneKey}`);
        
        try {
            await this.stop();
            
            const tuneData = allTunes[tuneKey];
            if (!tuneData) {
                throw new Error(`Tune "${tuneKey}" not found`);
            }
            
            this.baseMusic = typeof tuneData === 'string' ? tuneData : tuneData.abc;
            if (!this.baseMusic) {
                throw new Error(`Tune has no ABC notation`);
            }
            
            // Extract tune type
            this.tuneType = 'defaultPreset';
            const rhythmMatch = this.baseMusic.match(/^R:\s*(.+)$/m);
            if (rhythmMatch && rhythmMatch[1]) {
                this.tuneType = rhythmMatch[1].trim().toLowerCase().replace(/\s+/g, '');
            }
            
            console.log(`[TradSessionPlayer] Tune type: ${this.tuneType}`);
            
            // Get instruments
            this.patchIds = ENSEMBLE_PRESETS[this.tuneType] || ENSEMBLE_PRESETS.defaultPreset;
            console.log(`[TradSessionPlayer] Instruments:`, this.patchIds.map(id => PATCH_NAMES[id]));
            
            // Get tempo
            this.tempoMs = TEMPO_SETTINGS[this.tuneType] || TEMPO_SETTINGS.defaultTempo;
            console.log(`[TradSessionPlayer] Tempo: ${this.tempoMs}ms per measure`);
            
            // Create voice objects (all start inactive)
            this.voices = this.patchIds.map((patchId, index) => ({
                name: PATCH_NAMES[patchId],
                patchId: patchId,
                active: false,
                index: index
            }));
            
            // Create initial synth with all voices silent
            await this.rebuildSynth();
            
            console.log('[TradSessionPlayer] Load complete');
            return true;
            
        } catch (error) {
            console.error('[TradSessionPlayer] Load error:', error);
            return false;
        }
    }

    /**
     * Rebuild synth with current voice states
     */
    async rebuildSynth() {
        console.log('[RebuildSynth] Creating synth with current voice states');
        
        // Stop existing synth if any
        if (this.synth) {
            try {
                await this.synth.stop();
            } catch (e) {}
        }
        
        // Generate ABC with current voice volumes
        const multiVoiceABC = this.createMultiVoiceABC();
        
        console.log('[RebuildSynth] Generated ABC preview (first 500 chars):');
        console.log(multiVoiceABC.substring(0, 500));
        
        // Create new synth
        this.synth = new abcjs.synth.CreateSynth();
        
        const soundFontUrls = [
            'https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/',
            'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/'
        ];
        
        let initSuccess = false;
        for (const soundFontUrl of soundFontUrls) {
            try {
                console.log('[RebuildSynth] Rendering ABC...');
                const visualObj = abcjs.renderAbc(this.stage, multiVoiceABC, { 
                    responsive: 'resize' 
                })[0];
                
                console.log('[RebuildSynth] Visual object created:', visualObj ? 'yes' : 'no');
                if (visualObj) {
                    console.log('[RebuildSynth] Visual obj lines:', visualObj.lines?.length);
                }
                
                console.log('[RebuildSynth] Initializing synth with', soundFontUrl);
                await this.synth.init({
                    audioContext: this.audioContext,
                    visualObj: visualObj,
                    millisecondsPerMeasure: this.tempoMs,
                    options: { soundFontUrl: soundFontUrl }
                });
                
                console.log('[RebuildSynth] Init successful');
                initSuccess = true;
                break;
            } catch (error) {
                console.warn(`[RebuildSynth] Failed with ${soundFontUrl}:`, error.message);
            }
        }
        
        if (!initSuccess) {
            throw new Error('All soundfont URLs failed');
        }
        
        console.log('[RebuildSynth] Priming synth...');
        await this.synth.prime();
        console.log('[RebuildSynth] Prime complete');
        
        // Store duration
        if (this.synth.duration) {
            this.tuneDuration = this.synth.duration;
            console.log('[RebuildSynth] Duration captured:', this.tuneDuration);
        } else {
            console.warn('[RebuildSynth] WARNING: No duration found on synth!');
            console.log('[RebuildSynth] Synth object:', this.synth);
        }
        
        // Connect to master gain - try both connection methods
        if (this.synth.audioBufferPlayer) {
            try {
                this.synth.audioBufferPlayer.disconnect();
            } catch (e) {}
            this.synth.audioBufferPlayer.connect(this.engine.masterGain);
            console.log('[RebuildSynth] Connected audioBufferPlayer to master gain');
        } else {
            console.warn('[RebuildSynth] No audioBufferPlayer found');
        }
        
        if (this.synth.directSource && this.synth.directSource.length > 0) {
            this.synth.directSource.forEach((source, i) => {
                try {
                    source.disconnect();
                } catch (e) {}
                source.connect(this.engine.masterGain);
            });
            console.log('[RebuildSynth] Connected directSource to master gain, count:', this.synth.directSource.length);
        } else {
            console.warn('[RebuildSynth] No directSource found');
        }
        
        console.log('[RebuildSynth] Synth ready, duration:', this.tuneDuration);
    }

    async play() {
        console.log('[TradSessionPlayer] Playing...');
        
        if (this.audioContext.state !== 'running') {
            await this.audioContext.resume();
            console.log('[TradSessionPlayer] AudioContext resumed');
        }

        try {
            if (!this.synth) {
                throw new Error('No synth loaded');
            }
            
            this.isPlaying = true;
            
            console.log('[TradSessionPlayer] Starting synth...');
            await this.synth.start();
            console.log('[TradSessionPlayer] Synth started');
            
            // Connect audio AFTER start (critical timing)
            if (this.synth.audioBufferPlayer) {
                try {
                    this.synth.audioBufferPlayer.disconnect();
                } catch (e) {}
                this.synth.audioBufferPlayer.connect(this.engine.masterGain);
                console.log('[Play] Connected audioBufferPlayer');
            }
            
            if (this.synth.directSource && this.synth.directSource.length > 0) {
                this.synth.directSource.forEach((source) => {
                    try {
                        source.disconnect();
                    } catch (e) {}
                    source.connect(this.engine.masterGain);
                });
                console.log('[Play] Connected directSource, count:', this.synth.directSource.length);
            }
            
            // Setup looping
            if (this.tuneDuration > 0) {
                this.setupLooping();
                console.log('[Play] Looping setup with duration:', this.tuneDuration);
            }
            
            // Turn on first two voices
            if (this.voices.length > 0) {
                await this.toggleInstrument(0);
                if (this.voices.length > 1) {
                    await this.toggleInstrument(1);
                }
            }
            
            console.log('[TradSessionPlayer] Playing successfully');
            
        } catch (error) {
            console.error('[TradSessionPlayer] Play error:', error);
            console.error('[TradSessionPlayer] Error stack:', error.stack);
        }
    }

    setupLooping() {
        if (this.loopTimer) {
            clearTimeout(this.loopTimer);
        }
        
        const loopTime = (this.tuneDuration * 1000) - 50;
        
        this.loopTimer = setTimeout(async () => {
            if (this.isPlaying) {
                console.log('[Loop] Restarting...');
                await this.synth.start();
                
                if (this.synth.directSource) {
                    this.synth.directSource.forEach((source) => {
                        try {
                            source.disconnect();
                        } catch (e) {}
                        source.connect(this.engine.masterGain);
                    });
                }
                
                this.setupLooping();
            }
        }, loopTime);
    }

    async toggleInstrument(index) {
        const voice = this.voices[index];
        if (!voice) return false;
        
        // Toggle state
        voice.active = !voice.active;
        console.log(`[${voice.name}] ${voice.active ? 'ON' : 'OFF'}`);
        
        // Rebuild synth with new volume settings
        const wasPlaying = this.isPlaying;
        await this.rebuildSynth();
        
        // Restart playback if it was playing
        if (wasPlaying) {
            await this.synth.start();
            
            if (this.synth.directSource) {
                this.synth.directSource.forEach((source) => {
                    try {
                        source.disconnect();
                    } catch (e) {}
                    source.connect(this.engine.masterGain);
                });
            }
            
            // Re-establish looping
            if (this.tuneDuration > 0) {
                this.setupLooping();
            }
        }
        
        return voice.active;
    }

    get tracks() {
        return this.voices;
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
        
        if (this.loopTimer) {
            clearTimeout(this.loopTimer);
            this.loopTimer = null;
        }
        
        if (this.synth) {
            try {
                await this.synth.stop();
            } catch (e) {}
            this.synth = null;
        }
        
        this.voices = [];
    }
}

