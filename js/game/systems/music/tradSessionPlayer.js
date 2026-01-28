
 import * as abcjs from 'abcjs';
import MusicEngine from './musicEngine.js';
import { allTunes } from './allTunes.js';

const ENSEMBLE_PRESETS = {
    reel: [110, 105, 0],    // Fiddle, Banjo, Piano
    jig: [105, 110, 0],     // Banjo, Fiddle, Piano
    default: [105, 110, 0]
};

const PATCH_NAMES = { 
    110: "Fiddle", 
    105: "Banjo", 
    0: "Piano" 
};

export default class TradSessionPlayer {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.engine = new MusicEngine(this.audioContext);
        this.tracks = []; 
        
        // abcjs requires a DOM element to render buffers
        this.stage = document.createElement('div');
        this.stage.style.display = 'none';
        document.body.appendChild(this.stage);
    }

    async loadTune(tuneKey) {
        await this.stop();
        const rawAbc = allTunes[tuneKey];
        if (!rawAbc) return console.error("Tune not found:", tuneKey);

        const isReel = rawAbc.toLowerCase().includes('r: reel');
        const patches = ENSEMBLE_PRESETS[isReel ? 'reel' : 'jig'];
        const bpm = isReel ? 160 : 140;

        const promises = patches.map(async (patchId) => {
            const gain = this.engine.createTrackGain();
            
            // Reconstruct ABC with explicit metadata for the synth
            const cleanAbc = `X:1\nT:${tuneKey}\nQ:1/4=${bpm}\nK:D\n%%MIDI program ${patchId}\n${rawAbc}`;
            
            const visualObj = abcjs.renderAbc(this.stage, cleanAbc)[0];
            const synth = new abcjs.synth.CreateSynth();

            await synth.init({
                audioContext: this.audioContext,
                visualObj: visualObj,
                gainNode: gain,
                options: {
                    // Alternative mirror if the first one is blocked
                    soundFontUrl: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/"
                }
            });

            await synth.prime();
            
            this.tracks.push({ 
                name: PATCH_NAMES[patchId] || "Instrument", 
                synth, 
                gain, 
                active: false 
            });
        });

        await Promise.all(promises);
    }

    async play() {
        if (this.audioContext.state !== 'running') {
            await this.audioContext.resume();
        }

        this.tracks.forEach(t => t.synth.start());

        // Default: Turn on the first instrument (usually Banjo) immediately
        if (this.tracks.length > 0) {
            this.toggleInstrument(0); 
        }
    }

    toggleInstrument(index) {
        const track = this.tracks[index];
        if (!track) return false;
        
        track.active = !track.active;
        this.engine.applyFade(track.gain, track.active ? 1.0 : 0.0, 0.4);
        return track.active;
    }

    async stop() {
        const stopPromises = this.tracks.map(t => {
            try {
                // Ensure we return a promise even if stop() returns undefined
                return Promise.resolve(t.synth.stop());
            } catch (e) { 
                return Promise.resolve(); 
            }
        });
        await Promise.all(stopPromises);
        this.tracks = [];
    }
}

