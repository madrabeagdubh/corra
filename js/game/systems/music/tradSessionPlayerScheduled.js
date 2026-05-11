// Trad Session Player - Scheduled Start Times for Perfect Sync
import * as abcjs from 'abcjs';
import { MusicEngine } from './musicEngine.js';
import { allTunes } from './allTunes.js';

const ENSEMBLE_PRESETS = {
    reel:          [46, 0, 105],
    jig:           [46, 0, 105],
    slipjig:       [46, 0, 105],
    hornpipe:      [46, 0, 105],
    polka:         [46, 0, 105],
    waltz:         [46, 0, 105],
    march:         [46, 0, 105],
    slide:         [46, 0, 105],
    barndance:     [46, 0, 105],
    air:           [46, 0, 94],
    drone:         [92, 94],
    forge_sparse:  [114, 94],
    // Village: Steel Drums + Banjo + Choir Aahs + Pad Bowed
    // Track 0 starts audible, 1-3 start muted.
    // villageMusic.js unmutes them on a timer.
    forge_village: [114, 105, 52, 92],
    defaultPreset: [46, 0, 105],
};

const PATCH_NAMES = {
    46:  'Harp',
    105: 'Banjo',
    0:   'Piano',
    22:  'Harmonica',
    52:  'Choir Aahs',
    53:  'Voice Oohs',
    92:  'Pad Bowed',
    94:  'Pad Halo',
    114: 'Steel Drums',
    115: 'Woodblock',
};

const TEMPO_SETTINGS = {
    reel:          1300,
    jig:           1550,
    slipjig:       1650,
    hornpipe:      1500,
    polka:         1100,
    waltz:         2000,
    march:         1400,
    slide:         1000,
    barndance:     1200,
    air:           1800,
    drone:         8000,
    bagpipe:       2200,
    forge_sparse:  3000,
    forge_village: 2200,  // slow and stately — working men's pace
    defaultTempo:  1300,
};

const REVERB_SETTINGS = {
    forge_sparse:  { wetGain: 0.75, decay: 5.0 },
    forge_village: { wetGain: 0.20, decay: 1.5 },
    air:           { wetGain: 0.15, decay: 1.2 },
};

export class TradSessionPlayer {
    constructor() {
        this.audioContext       = null;
        this.engine             = null;
        this.tracks             = [];
        this.isPlaying          = false;
        this.scheduledStartTime = null;
        this.loopTimeoutId      = null;
        this._tuneType          = null;
        this._reverbNode        = null;

        this.loop    = true;
        this.onEnded = null;

        this.stage = document.createElement('div');
        this.stage.style.display = 'none';
        document.body.appendChild(this.stage);
    }

    _ensureAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.engine       = new MusicEngine(this.audioContext);
        }
    }

    _buildReverb(decay = 2.0, wetGain = 0.4) {
        const ac      = this.audioContext;
        const rate    = ac.sampleRate;
        const length  = Math.floor(rate * decay);
        const impulse = ac.createBuffer(2, length, rate);

        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
            }
        }

        const convolver = ac.createConvolver();
        convolver.buffer = impulse;

        const wet = ac.createGain();
        wet.gain.value = wetGain;

        convolver.connect(wet);
        wet.connect(this.engine.masterGain);

        return convolver;
    }

    _teardownReverb() {
        if (this._reverbNode) {
            try { this._reverbNode.disconnect(); } catch (e) {}
            this._reverbNode = null;
        }
    }

    async loadTune(tuneKey, preservePlayback = false) {
        console.log(`[TradSessionPlayer] Loading tune: ${tuneKey}`);
        this._ensureAudioContext();

        try {
            if (!preservePlayback) {
                await this.stop();
            }

            this._teardownReverb();

            const tuneData = allTunes[tuneKey];
            if (!tuneData) throw new Error(`Tune "${tuneKey}" not found`);

            const baseMusic = typeof tuneData === 'string' ? tuneData : tuneData.abc;
            if (!baseMusic) throw new Error(`Tune has no ABC notation`);

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

            const reverbSettings = REVERB_SETTINGS[tuneType];
            if (reverbSettings) {
                console.log(`[TradSessionPlayer] Building reverb: decay=${reverbSettings.decay}s wet=${reverbSettings.wetGain}`);
                this._reverbNode = this._buildReverb(reverbSettings.decay, reverbSettings.wetGain);
            }

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
                                visualObj,
                                millisecondsPerMeasure: tempoMs,
                                options: { soundFontUrl, program: patchId },
                            });

                            initSuccess = true;
                            break;
                        } catch (error) {
                            console.warn(`[Track ${index}] Failed with ${soundFontUrl}:`, error.message);
                        }
                    }

                    if (!initSuccess) {
                        throw new Error(`Failed to init synth for ${PATCH_NAMES[patchId] || patchId}`);
                    }

                    this.tracks[index] = {
                        name:   PATCH_NAMES[patchId] || String(patchId),
                        synth,
                        gain,
                        active: (index === 0),
                    };

                    // Track 0 audible from start, rest silent
                    gain.gain.value = (index === 0) ? (gain.targetVolume || 1.0) : 0;

                } catch (error) {
                    console.error(`[Track ${index}] Error:`, error);
                    throw error;
                }
            });

            await Promise.all(promises);

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
        this._ensureAudioContext();

        if (this.audioContext.state !== 'running') {
            try {
                await this.audioContext.resume();
            } catch (e) {
                console.warn('[TradSessionPlayer] AudioContext resume failed:', e);
            }
        }

        console.log('[TradSessionPlayer] AudioContext state at play():', this.audioContext.state);

        try {
            if (this.tracks.length === 0) throw new Error('No tracks loaded');

            this.isPlaying = true;

            console.log('[TradSessionPlayer] Priming all tracks...');
            for (let i = 0; i < this.tracks.length; i++) {
                try {
                    await this.tracks[i].synth.prime();
                    console.log(`[Track ${i}] Primed`);
                    if (i === 0 && this._tuneType !== 'drone' && this.tracks[i].synth.duration) {
                        this.tuneDuration = this.tracks[i].synth.duration;
                    }
                } catch(e) {
                    console.error(`[Track ${i}] Prime failed:`, e.name, e.message);
                    throw e;
                }
            }

            const scheduleAhead = 0.1;
            this.scheduledStartTime = this.audioContext.currentTime + scheduleAhead;

            const startPromises = this.tracks.map(async (track, i) => {
                try {
                    await track.synth.start();
                } catch(e) {
                    console.error(`[Track ${i}] start() threw: name="${e.name}" message="${e.message}"`, e);
                    throw e;
                }

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

                if (this._reverbNode) {
                    track.gain.connect(this._reverbNode);
                }
            });

            await Promise.all(startPromises);
            console.log('[Scheduled] All synths started');

            if (this.tuneDuration > 0) {
                this.setupLooping();
            }

        } catch (error) {
            console.error('[TradSessionPlayer] Play error:', error);
            throw error;
        }
    }

    setupLooping() {
        if (this.loopTimeoutId) {
            clearTimeout(this.loopTimeoutId);
        }

        const loopTime = (this.tuneDuration * 1000) - 50;

        this.loopTimeoutId = setTimeout(async () => {
            if (!this.isPlaying) return;

            if (!this.loop) {
                console.log('[TradSessionPlayer] Track ended (loop=false), firing onEnded');
                this.isPlaying = false;
                if (typeof this.onEnded === 'function') {
                    this.onEnded();
                }
                return;
            }

            console.log('[Loop] Restarting all synths...');

            try {
                for (const track of this.tracks) {
                    await track.synth.prime();
                }
            } catch (e) {
                console.warn('[Loop] Re-prime failed:', e.name, e.message);
            }

            const startPromises = [];
            for (const track of this.tracks) {
                startPromises.push(track.synth.start());
            }

            try {
                await Promise.all(startPromises);
            } catch (e) {
                console.warn('[Loop] Start failed:', e.name, e.message);
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
                if (this._reverbNode) {
                    track.gain.connect(this._reverbNode);
                }
            }

            console.log('[Loop] All synths restarted');
            this.setupLooping();
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

        this._teardownReverb();

        this.tracks             = [];
        this.scheduledStartTime = null;
    }
}

