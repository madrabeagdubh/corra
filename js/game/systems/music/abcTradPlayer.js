// js/game/systems/music/AbcTradPlayer.js

/**
 * Irish Trad Music Player using abcjs
 * Handles multi-voice progressive loops with real soundfonts
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
        this.onLoopChange = null; // Callback for loop changes
        this.soundfontsPreloaded = false;
    }

    /**
     * Initialize AudioContext (must be called after user interaction)
     */
    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[AbcTradPlayer] AudioContext initialized');
        }
    }
    
    /**
     * Preload soundfonts for Irish instruments
     * Call this during loading screen or on first user interaction
     */
    async preloadSoundfonts() {
        if (this.soundfontsPreloaded) return;
        
        await this.init();
        
        console.log('[AbcTradPlayer] Preloading Irish trad soundfonts...');
        
        // List of instruments we'll use (MIDI program numbers)
        const instruments = [
            116, // Tin Whistle (actually 78-1 for 0-indexed)
            109, // Fiddle (110-1)
            20, // Concertina (21-1)
            104, // Banjo (105-1)
            24  // Guitar (25-1)
        ];
        
        // Create temporary synth just to trigger soundfont loading
        const tempSynth = new ABCJS.synth.CreateSynth();
        
        try {
            await tempSynth.init({
                audioContext: this.audioContext,
                visualObj: ABCJS.renderAbc("*", "X:1\nK:C\nC")[0],
                options: {
                    soundFontUrl: "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/",
                    program: instruments[0] // Load first instrument
                }
            });
            
            this.soundfontsPreloaded = true;
            console.log('[AbcTradPlayer] Soundfonts preloaded successfully');
        } catch (err) {
            console.warn('[AbcTradPlayer] Soundfont preload warning:', err);
        }
    }

    /**
     * Prepare a tune for playback
     * @param {Object} tuneData - Object with { name, abc, bpm, progression }
     */
    async prepareTune(tuneData) {
        // IMPORTANT: Stop any current playback first
        await this.stop();
        
        this.currentTune = tuneData;
        this.currentLoop = 0;
        console.log('[AbcTradPlayer] Prepared:', tuneData.name);
    }

    /**
     * Start playing the prepared tune with progressive loops
     */
    async play() {
        if (this.isPlaying) {
            console.warn('[AbcTradPlayer] Already playing');
            return;
        }

        await this.init();
        
        // CRITICAL: Resume AudioContext if suspended
        if (this.audioContext.state === 'suspended') {
            console.log('[AbcTradPlayer] Resuming suspended AudioContext...');
            await this.audioContext.resume();
            console.log('[AbcTradPlayer] AudioContext state:', this.audioContext.state);
        }
        
        console.log('[AbcTradPlayer] AudioContext state:', this.audioContext.state);
        console.log('[AbcTradPlayer] AudioContext currentTime:', this.audioContext.currentTime);

        if (!this.currentTune) {
            console.error('[AbcTradPlayer] No tune prepared!');
            return;
        }

        this.isPlaying = true;
        this.currentLoop = 0;
        await this.playLoop(0);
    }

    /**
     * Play a specific loop iteration
     * @param {number} loopIndex - Which loop in the progression to play
     */
    async playLoop(loopIndex) {
        if (!this.isPlaying || !this.currentTune || loopIndex >= this.currentTune.progression.length) {
            this.isPlaying = false;
            return;
        }

        try {
            const progression = this.currentTune.progression[loopIndex];
            console.log(`[AbcTradPlayer] Loop ${loopIndex + 1}: ${progression.name}`);

            // Notify listeners of loop change
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
            
            console.log('[AbcTradPlayer] ABC parsed successfully, lines:', this.visualObj.lines?.length);

            // For now, use a single instrument (abcjs limitation)
            const instrument = 73; // Flute (close to tin whistle)
            
            console.log('[AbcTradPlayer] Creating synth with instrument:', instrument);

            try {
                // CRITICAL: Stop the previous synth before creating a new one
                if (this.synth) {
                    console.log('[AbcTradPlayer] Stopping previous synth...');
                    try {
                        await this.synth.stop();
                        // Small delay to ensure it's fully stopped
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (e) {
                        console.warn('[AbcTradPlayer] Error stopping previous synth:', e);
                    }
                    this.synth = null;
                }
                
                // Always create a fresh synth for each loop
                this.synth = new ABCJS.synth.CreateSynth();
                
                console.log('[AbcTradPlayer] Calling synth.init()...');
                
                await this.synth.init({
                    audioContext: this.audioContext,
                    visualObj: this.visualObj,
                    options: {
                        soundFontUrl: "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/",
                        program: instrument,
                        // This callback fires when playback actually completes
                        onEnded: () => {
                            console.log('[AbcTradPlayer] Synth playback ended naturally');
                            
                            // Wait a beat (500ms), then start next loop
                            setTimeout(() => {
                                if (this.isPlaying && loopIndex + 1 < this.currentTune.progression.length) {
                                    console.log('[AbcTradPlayer] Starting next loop after pause...');
                                    this.playLoop(loopIndex + 1);
                                } else {
                                    console.log('[AbcTradPlayer] All loops complete');
                                    this.isPlaying = false;
                                }
                            }, 10); // Half-second pause between loops
                        }
                    }
                });
                
                console.log('[AbcTradPlayer] Synth init complete, now priming...');
                
                // CRITICAL: Must call prime() to prepare the audio buffer
                await this.synth.prime();
                console.log('[AbcTradPlayer] Synth primed');
                
                // Start playback
                console.log('[AbcTradPlayer] Calling synth.start()...');
                this.synth.start();
                console.log('[AbcTradPlayer] Synth started (will trigger onEnded when done)');
                
                this.currentLoop = loopIndex;
                
            } catch (err) {
                console.error('[AbcTradPlayer] Synth error:', err);
                console.error('[AbcTradPlayer] Error details:', err.message, err.stack);
                this.isPlaying = false;
                return;
            }

        } catch (err) {
            console.error('[AbcTradPlayer] Playback error:', err);
            this.isPlaying = false;
        }
    }

    /**
     * Filter ABC notation to only include specified voices
     * @param {string} abc - Full ABC notation with multiple voices
     * @param {number[]} voiceNumbers - Array of voice numbers to include (e.g., [1, 2])
     * @returns {string} Filtered ABC notation
     */
    filterVoices(abc, voiceNumbers) {
        const lines = abc.split('\n');
        const output = [];
        let currentVoice = null;
        let skipUntilNextVoice = false;
        
        console.log(`[AbcTradPlayer] Filtering for voices: [${voiceNumbers.join(', ')}]`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Always include header lines (before any voices start)
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
            
            // Regular music content - include only if we're in a selected voice
            if (!skipUntilNextVoice && currentVoice && voiceNumbers.includes(currentVoice)) {
                output.push(line);
            }
        }

        const filtered = output.join('\n');
        console.log(`[AbcTradPlayer] Filtered result (${filtered.length} chars, ${output.length} lines):`);
        console.log('---START FILTERED ABC---');
        console.log(filtered);
        console.log('---END FILTERED ABC---');
        
        return filtered;
    }

    /**
     * Calculate approximate duration of a tune
     * @param {Object} visualObj - abcjs visual object
     * @param {number} bpm - Beats per minute
     * @returns {number} Duration in seconds
     */
    calculateDuration(visualObj, bpm) {
        // More accurate calculation based on actual note count
        let totalDuration = 0;
        
        if (visualObj && visualObj.lines) {
            visualObj.lines.forEach(line => {
                if (line.staff) {
                    line.staff.forEach(staff => {
                        staff.voices.forEach(voice => {
                            voice.forEach(element => {
                                if (element.duration) {
                                    totalDuration += element.duration;
                                }
                            });
                        });
                    });
                }
            });
        }

        // Convert to seconds: duration units * 60 / bpm
        // Irish trad tunes typically have repeats (|: :|) which doubles the duration
        // Most tunes have 2 parts, each repeated twice = 4x through
        // Add extra buffer for safety
        const baseDuration = (totalDuration * 60) / bpm;
        const estimatedDuration = baseDuration * 2; // Account for typical repeats
        const withBuffer = estimatedDuration + 1; // Add 1 second safety buffer
        
        console.log(`[AbcTradPlayer] Duration calc: base=${baseDuration.toFixed(2)}s, with repeats=${estimatedDuration.toFixed(2)}s, final=${withBuffer.toFixed(2)}s (bpm=${bpm})`);
        
        return withBuffer > 0 ? withBuffer : 15; // Default to 15s if calculation fails
    }

    /**
     * Stop playback
     */
    async stop() {
        console.log('[AbcTradPlayer] Stopping...');
        
        // Set flag immediately to prevent any pending loops
        this.isPlaying = false;
        
        // Clear timer
        if (this.loopTimer) {
            clearTimeout(this.loopTimer);
            this.loopTimer = null;
        }

        // Stop synth
        if (this.synth) {
            try {
                await this.synth.stop();
                // Give it a moment to fully stop
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                console.warn('[AbcTradPlayer] Stop error:', err);
            }
        }

        this.currentLoop = 0;
        console.log('[AbcTradPlayer] Stopped');
    }

    /**
     * Get current loop index
     * @returns {number}
     */
    getCurrentLoop() {
        return this.currentLoop;
    }

    /**
     * Get current progression info
     * @returns {Object|null}
     */
    getCurrentProgression() {
        if (this.currentTune && this.currentTune.progression[this.currentLoop]) {
            return this.currentTune.progression[this.currentLoop];
        }
        return null;
    }

    /**
     * Check if currently playing
     * @returns {boolean}
     */
    getIsPlaying() {
        return this.isPlaying;
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        this.synth = null;
        this.audioContext = null;
        this.onLoopChange = null;
    }
    
    /**
     * Extract instrument program numbers from ABC and map them by voice
     * @param {string} abc - ABC notation
     * @returns {number[]} Array of MIDI program numbers (0-indexed) for each voice
     */
    extractInstrumentMap(abc) {
        const instruments = [];
        const lines = abc.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check for voice definition: V:1, V:2, etc.
            const voiceMatch = line.match(/^V:(\d+)/);
            if (voiceMatch) {
                const voiceNum = parseInt(voiceMatch[1]);
                
                // Look at the NEXT line for %%MIDI program
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim();
                    const programMatch = nextLine.match(/^%%MIDI program (\d+) (\d+)/);
                    if (programMatch) {
                        const programNum = parseInt(programMatch[2]); // Second number is the instrument
                        instruments[voiceNum - 1] = programNum; // Store by voice index (0-based)
                        console.log(`  Voice ${voiceNum} -> Program ${programNum}`);
                    }
                }
            }
        }
        
        const filtered = instruments.filter(n => n !== undefined && n !== null);
        console.log('[AbcTradPlayer] Extracted instrument map:', filtered);
        return filtered;
    }
}
