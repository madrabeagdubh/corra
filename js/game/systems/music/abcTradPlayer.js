// js/game/systems/music/AbcTradPlayer.js

/**
 * Irish Trad Music Player using abcjs
 * Handles multi-voice progressive loops with real soundfonts
 * FIXED: Now properly handles pipes drone and bodhrán
 */
export default class AbcTradPlayer {
    constructor() {
        this.audioContext = null;
        this.synth = null;
        this.currentTune = null;
        this.currentLoop = 0;
        this.isPlaying = false;
        this.loopTimer = null;
        this.visualObj = null;
        this.onLoopChange = null;
        this.soundfontsPreloaded = false;
    }

    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[AbcTradPlayer] AudioContext initialized');
        }
    }
    
    async preloadSoundfonts() {
        if (this.soundfontsPreloaded) return;
        
        await this.init();
        
        console.log('[AbcTradPlayer] Preloading Irish trad soundfonts...');
        
        const instruments = [77, 109, 20, 104, 24];
        const tempSynth = new ABCJS.synth.CreateSynth();
        
        try {
            await tempSynth.init({
                audioContext: this.audioContext,
                visualObj: ABCJS.renderAbc("*", "X:1\nK:C\nC")[0],
                options: {
                    soundFontUrl: "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/",
                    program: instruments[0]
                }
            });
            
            this.soundfontsPreloaded = true;
            console.log('[AbcTradPlayer] Soundfonts preloaded successfully');
        } catch (err) {
            console.warn('[AbcTradPlayer] Soundfont preload warning:', err);
        }
    }

    async prepareTune(tuneData) {
        await this.stop();
        this.currentTune = tuneData;
        this.currentLoop = 0;
        console.log('[AbcTradPlayer] Prepared:', tuneData.name);
    }

    async play() {
        if (this.isPlaying) {
            console.warn('[AbcTradPlayer] Already playing');
            return;
        }

        await this.init();
        
        if (this.audioContext.state === 'suspended') {
            console.log('[AbcTradPlayer] Resuming suspended AudioContext...');
            await this.audioContext.resume();
        }

        if (!this.currentTune) {
            console.error('[AbcTradPlayer] No tune prepared!');
            return;
        }

        this.isPlaying = true;
        this.currentLoop = 0;
        await this.playLoop(0);
    }

    async playLoop(loopIndex) {
        if (!this.isPlaying || !this.currentTune || loopIndex >= this.currentTune.progression.length) {
            this.isPlaying = false;
            return;
        }

        try {
            const progression = this.currentTune.progression[loopIndex];
            console.log(`[AbcTradPlayer] Loop ${loopIndex + 1}: ${progression.name}`);
            console.log(`[AbcTradPlayer] Voices to include:`, progression.voices);

            if (this.onLoopChange) {
                this.onLoopChange(loopIndex, progression);
            }

            // Filter ABC to only include voices for this loop
            const filteredAbc = this.filterVoices(this.currentTune.abc, progression.voices);

            // Parse with abcjs
            const tempDiv = document.createElement('div');
            this.visualObj = ABCJS.renderAbc(tempDiv, filteredAbc, { 
                responsive: 'resize' 
            })[0];
            
            if (!this.visualObj) {
                console.error('[AbcTradPlayer] Failed to parse ABC!');
                this.isPlaying = false;
                return;
            }

            // CRITICAL FIX: Determine instrument based on which voice is playing
            const primaryVoice = progression.voices[0]; // Use first voice as primary
            let instrument;
            
            // Map voice numbers to instruments
            // Check if this is a drone-only loop (voice 5 only)
            if (progression.voices.length === 1 && progression.voices[0] === 5) {
                instrument = 109; // Bagpipe for drone
                console.log('[AbcTradPlayer] DRONE ONLY loop - using bagpipe');
            } else if (primaryVoice === 1) {
                // Extract instrument for voice 1 from ABC
                const voice1Instrument = this.extractInstrumentForVoice(this.currentTune.abc, 1);
                instrument = voice1Instrument || 73; // Default to flute
                console.log('[AbcTradPlayer] Voice 1 melody - instrument:', instrument);
            } else if (primaryVoice === 2) {
                const voice2Instrument = this.extractInstrumentForVoice(this.currentTune.abc, 2);
                instrument = voice2Instrument || 21; // Default to concertina
                console.log('[AbcTradPlayer] Voice 2 melody - instrument:', instrument);
            } else if (primaryVoice === 4) {
                // Bodhrán (percussion) - use a melodic substitute
                instrument = 116; // Taiko
                console.log('[AbcTradPlayer] Bodhrán rhythm');
            } else if (primaryVoice === 5) {
                instrument = 109; // Bagpipe for drone
                console.log('[AbcTradPlayer] Drone voice');
            } else {
                instrument = 73; // Default
            }
            
            console.log('[AbcTradPlayer] Using instrument:', instrument);

            try {
                if (this.synth) {
                    console.log('[AbcTradPlayer] Stopping previous synth...');
                    try {
                        await this.synth.stop();
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (e) {
                        console.warn('[AbcTradPlayer] Error stopping previous synth:', e);
                    }
                    this.synth = null;
                }
                
                this.synth = new ABCJS.synth.CreateSynth();
                
                await this.synth.init({
                    audioContext: this.audioContext,
                    visualObj: this.visualObj,
                    options: {
                        soundFontUrl: "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/",
                        program: instrument,
                        onEnded: () => {
                            console.log('[AbcTradPlayer] Synth playback ended');
                            
                            setTimeout(() => {
                                if (this.isPlaying && loopIndex + 1 < this.currentTune.progression.length) {
                                    this.playLoop(loopIndex + 1);
                                } else {
                                    console.log('[AbcTradPlayer] All loops complete');
                                    this.isPlaying = false;
                                }
                            }, 100); // Tighter loop gap!
                        }
                    }
                });
                
                await this.synth.prime();
                this.synth.start();
                
                this.currentLoop = loopIndex;
                
            } catch (err) {
                console.error('[AbcTradPlayer] Synth error:', err);
                this.isPlaying = false;
                return;
            }

        } catch (err) {
            console.error('[AbcTradPlayer] Playback error:', err);
            this.isPlaying = false;
        }
    }

    /**
     * Extract instrument program number for a specific voice
     */
    extractInstrumentForVoice(abc, voiceNumber) {
        const lines = abc.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Look for V:1, V:2, etc.
            const voiceMatch = line.match(/^V:(\d+)/);
            if (voiceMatch && parseInt(voiceMatch[1]) === voiceNumber) {
                // Check next line for %%MIDI program
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim();
                    const programMatch = nextLine.match(/^%%MIDI program (\d+)/);
                    if (programMatch) {
                        return parseInt(programMatch[1]);
                    }
                }
            }
        }
        
        return null;
    }

    filterVoices(abc, voiceNumbers) {
        const lines = abc.split('\n');
        const output = [];
        let currentVoice = null;
        let skipUntilNextVoice = false;
        
        console.log(`[AbcTradPlayer] Filtering for voices: [${voiceNumbers.join(', ')}]`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Always include header lines
            if (line.match(/^[XTZSMRLQK]:/)) {
                output.push(line);
                continue;
            }
            
            // Voice definition: V:1, V:2, etc.
            if (line.match(/^V:\d+/)) {
                const match = line.match(/^V:(\d+)/);
                if (match) {
                    const voiceNum = parseInt(match[1]);
                    currentVoice = voiceNum;
                    
                    if (voiceNumbers.includes(voiceNum)) {
                        output.push(line);
                        // Also include the next line if it's a MIDI directive
                        if (i + 1 < lines.length && lines[i + 1].match(/^%%MIDI/)) {
                            output.push(lines[i + 1]);
                            i++; // Skip next line since we already added it
                        }
                        skipUntilNextVoice = false;
                        console.log(`  ✓ Including voice ${voiceNum}`);
                    } else {
                        skipUntilNextVoice = true;
                        console.log(`  ✗ Skipping voice ${voiceNum}`);
                    }
                }
                continue;
            }
            
            // Empty lines
            if (line === '') {
                output.push('');
                continue;
            }
            
            // Music content with inline voice marker: [V:1] |:ABC
            if (line.match(/^\[V:\d+\]/)) {
                const match = line.match(/^\[V:(\d+)\]/);
                if (match) {
                    const voiceNum = parseInt(match[1]);
                    currentVoice = voiceNum;
                    
                    if (voiceNumbers.includes(voiceNum)) {
                        output.push(line);
                        skipUntilNextVoice = false;
                    } else {
                        skipUntilNextVoice = true;
                    }
                }
                continue;
            }
            
            // Regular music content
            if (!skipUntilNextVoice && currentVoice && voiceNumbers.includes(currentVoice)) {
                output.push(line);
            }
        }

        const filtered = output.join('\n');
        console.log(`[AbcTradPlayer] Filtered ABC (${filtered.length} chars):`);
        console.log(filtered);
        
        return filtered;
    }

    async stop() {
        console.log('[AbcTradPlayer] Stopping...');
        this.isPlaying = false;
        
        if (this.loopTimer) {
            clearTimeout(this.loopTimer);
            this.loopTimer = null;
        }

        if (this.synth) {
            try {
                await this.synth.stop();
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                console.warn('[AbcTradPlayer] Stop error:', err);
            }
        }

        this.currentLoop = 0;
    }

    getCurrentLoop() {
        return this.currentLoop;
    }

    getCurrentProgression() {
        if (this.currentTune && this.currentTune.progression[this.currentLoop]) {
            return this.currentTune.progression[this.currentLoop];
        }
        return null;
    }

    getIsPlaying() {
        return this.isPlaying;
    }

    destroy() {
        this.stop();
        this.synth = null;
        this.audioContext = null;
        this.onLoopChange = null;
    }
}
