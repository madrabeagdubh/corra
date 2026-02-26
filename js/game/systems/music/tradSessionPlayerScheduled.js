// Trad Session Player - Scheduled Start Times for Perfect Sync
import * as abcjs from 'abcjs';
import { MusicEngine } from './musicEngine.js';
import { allTunes } from './allTunes.js';

const ENSEMBLE_PRESETS = {
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
    // Drone: two sustaining pad patches only — no harp/piano/banjo.
    // Patch 92 = Pad 5 (Bowed), Patch 94 = Pad 7 (Halo).
    // These are GM pads designed to sustain indefinitely — ideal for ambient drone.
    drone:     [92, 94],
    defaultPreset: [46, 0, 105],
};

const PATCH_NAMES = {
    46:  'Harp',
    105: 'Banjo',
    0:   'Piano',
    22:  'Harmonica',
    92:  'Pad Bowed',
    94:  'Pad Halo',
};

const TEMPO_SETTINGS = {
    reel:      1300,
    jig:       1550,
    slipjig:   1650,
    hornpipe:  1500,
    polka:     1100,
    waltz:     2000,
    march:     1400,
    slide:     1000,
    barndance: 1200,
    air:       1500,
    // Drone: very slow — 8000ms/measure means whole notes last ~8s each
    drone:     8000,
    defaultTempo: 1300,
};

export class TradSessionPlayer {
    constructor() {
        // AudioContext is NOT created here — deferred until play() or loadTune()
        // so it always happens inside a user gesture callstack, satisfying
        // iOS/mobile autoplay policy and preventing DOMException on resume().
        this.audioContext = null;
        this.engine       = null;
        this.tracks       = [];
        this.isPlaying    = false;
        this.scheduledStartTime = null;
        this.loopTimeoutId      = null;
        this._tuneType          = null;

        this.stage = document.createElement('div');
        this.stage.style.display = 'none';
        document.body.appendChild(this.stage);
    }

    // ── Lazily create AudioContext + MusicEngine on first use ────────────────
    _ensureAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.engine       = new MusicEngine(this.audioContext);
        }
    }

    async loadTune(tuneKey, preservePlayback = false) {
        console.log(`[TradSessionPlayer] Loading tune: ${tuneKey}`);

        // Create context here so soundfont fetches use it — but it may still
        // be suspended until play() is called inside a gesture.
        this._ensureAudioContext();

        try {
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

            this._tuneType = tuneType;
            console.log(`[TradSessionPlayer] Tune type: ${tuneType}`);

            let patchIds = ENSEMBLE_PRESETS[tuneType] || ENSEMBLE_PRESETS.defaultPreset;
            console.log(`[TradSessionPlayer] Using patches:`, patchIds.map(id => `${id}:${PATCH_NAMES[id] || id}`));

            const tempoMs = TEMPO_SETTINGS[tuneType] || TEMPO_SETTINGS.defaultTempo;
            console.log(`[TradSessionPlayer] Tempo: ${tempoMs}ms per measure`);

            const soundFontUrls = [
                'https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/',
                'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/',
            ];

            this.tracks = new Array(patchIds.length);

            const promises = patchIds.map(async (patchId, index) => {
                try {
                    console.log(`[Track ${index}] Loading ${PATCH_NAMES[patchId] || patchId}`);

                    const instrumentABC = this.setInstrumentProgram(baseMusic, patchId);
                    const gain          = this.engine.createTrackGainWithPanning(patchId);

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
                                visualObj:    visualObj,
                                millisecondsPerMeasure: tempoMs,
                                options: {
                                    soundFontUrl: soundFontUrl,
                                    program:      patchId,
                                },
                            });

                            initSuccess = true;
                            break;
                        } catch (error) {
                            console.warn(`[Track ${index}] Failed with ${soundFontUrl}`);
                        }
                    }

                    if (!initSuccess) {
                        throw new Error(`Failed to init synth for ${PATCH_NAMES[patchId] || patchId}`);
                    }

console.log('[audio] context state at play():', this.audioContext.state);


                    await synth.prime();
                    console.log(`[Track ${index}] Primed`);

                    // Only capture duration from track 0 for non-drone tunes.
                    // Drone duration is hardcoded below — abcjs mis-reports sustain length.
                    if (index === 0 && synth.duration && tuneType !== 'drone') {
                        this.tuneDuration = synth.duration;
                    }

                    this.tracks[index] = {
                        name:   PATCH_NAMES[patchId] || String(patchId),
                        synth,
                        gain,
                        active: (index === 0),
                    };

                    if (index === 0) {
                        gain.gain.value = gain.targetVolume || 1.0;
                    }

                } catch (error) {
                    console.error(`[Track ${index}] Error:`, error);
                    throw error;
                }
            });

            await Promise.all(promises);

            // Hardcode drone duration: 8 measures × 8s = 64s.
            // abcjs reports the note-onset window, not the full sustain tail,
            // so synth.duration comes back ~4s for whole-note pads — causing the
            // loop timer to fire before the notes have barely begun.
            if (tuneType === 'drone') {
                this.tuneDuration = 64;
                console.log('[TradSessionPlayer] Drone duration hardcoded to 64s');
            }

            console.log('[TradSessionPlayer] All tracks loaded');
            console.log('[TradSessionPlayer] Track order:', this.tracks.map(t => t.name));
            return true;

        } catch (error) {
            console.error('[TradSessionPlayer] Load error:', error);
            return false;
        }
    }

    setInstrumentProgram(abcString, program) {
        const lines  = abcString.split('\n');
        const result = [];
        let foundMIDI   = false;
        let inMusicBody = false;

        for (const line of lines) {
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

        // Ensure context exists — critical if play() is the first call
        this._ensureAudioContext();

        // Resume must happen here, inside the gesture callstack.
        // On iOS, audioContext.resume() only works synchronously in a touch handler.
        if (this.audioContext.state !== 'running') {
            try {
                await this.audioContext.resume();
            } catch (e) {
                console.warn('[TradSessionPlayer] AudioContext resume failed:', e);
            }
        }

        try {
            if (this.tracks.length === 0) {
                throw new Error('No tracks loaded');
            }

            this.isPlaying = true;

            const scheduleAhead = 0.1;
            this.scheduledStartTime = this.audioContext.currentTime + scheduleAhead;

            console.log(`[Scheduled] Will start at time: ${this.scheduledStartTime.toFixed(3)}`);
            console.log(`[Scheduled] Current time: ${this.audioContext.currentTime.toFixed(3)}`);

            const startPromises = this.tracks.map(async (track, i) => {
                const startTime = this.audioContext.currentTime;
                console.log(`[Track ${i}] Starting at: ${startTime.toFixed(4)}`);
                await track.synth.start();
                const endTime = this.audioContext.currentTime;
                console.log(`[Track ${i}] Start completed in: ${((endTime - startTime) * 1000).toFixed(2)}ms`);

                if (track.synth.audioBufferPlayer) {
                    try { track.synth.audioBufferPlayer.disconnect(); } catch (e) {}
                    track.synth.audioBufferPlayer.connect(track.gain);
                }

                if (track.synth.directSource) {
                    track.synth.directSource.forEach((source) => {
                        try { source.disconnect(); } catch (e) {}
                        source.connect(track.gain);
                    });
                }
            });

            await Promise.all(startPromises);
            console.log('[Scheduled] All synths started');
            console.log('[Scheduled] Total elapsed:', ((this.audioContext.currentTime - this.scheduledStartTime + 0.1) * 1000).toFixed(2), 'ms');

            if (this.tuneDuration > 0) {
                this.setupLooping();
            }

            console.log('[TradSessionPlayer] Play complete - waiting for external track control');

        } catch (error) {
            console.error('[TradSessionPlayer] Play error:', error);
            throw error; // re-throw so callers (_startHarpSilent etc.) can handle it
        }
    }

    setupLooping() {
        if (this.loopTimeoutId) {
            clearTimeout(this.loopTimeoutId);
        }

        // Fire 50ms before the tune ends to give abcjs time to re-prime
        const loopTime = (this.tuneDuration * 1000) - 50;

        this.loopTimeoutId = setTimeout(async () => {
            if (!this.isPlaying) return;

            console.log('[Loop] Restarting all synths...');

            // Re-prime each synth before restarting — required by abcjs after stop
            try {
                for (const track of this.tracks) {
                    await track.synth.prime();
                }
            } catch (e) {
                console.warn('[Loop] Re-prime failed:', e);
            }

            const scheduleAhead = 0.05;
            this.scheduledStartTime = this.audioContext.currentTime + scheduleAhead;
            console.log(`[Loop] Scheduled restart at: ${this.scheduledStartTime.toFixed(3)}`);

            const startPromises = [];
            for (const track of this.tracks) {
                startPromises.push(track.synth.start());
            }

            try {
                await Promise.all(startPromises);
            } catch (e) {
                console.warn('[Loop] Start failed:', e);
                return;
            }

            for (const track of this.tracks) {
                if (track.synth.audioBufferPlayer) {
                    try { track.synth.audioBufferPlayer.disconnect(); } catch (e) {}
                    track.synth.audioBufferPlayer.connect(track.gain);
                }

                if (track.synth.directSource) {
                    track.synth.directSource.forEach((source) => {
                        try { source.disconnect(); } catch (e) {}
                        source.connect(track.gain);
                    });
                }
            }

            console.log('[Loop] All synths restarted');
            this.setupLooping(); // schedule the next loop
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
        this._ensureAudioContext();
        const now      = this.audioContext.currentTime;
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

        this.tracks      = [];
        this.scheduledStartTime = null;
    }
}

