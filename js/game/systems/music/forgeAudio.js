// forgeAudio.js
// Synthesised forge soundscape for the village scene.
// Designed to run alongside dingDongVillage in levelTunes.
//
// Architecture mirrors returnCrossing.js — pure Web Audio API,
// no external samples needed.
//
// Layers:
//   1. Birdsong       — sparse, cheerful, fades out as forge warms up
//   2. Bellows        — slow rhythmic filtered noise, breathing of the forge
//   3. Fire hiss      — low continuous filtered noise, the forge bed
//   4. Pitched hammer — tuned to D major notes, rhythmically tied to the tune
//                       The hammer pattern IS the melody skeleton of Ding Dong.
//                       As music fades in, the hammering fades back to accent.
//
// Usage:
//   import { ForgeAudio } from './forgeAudio.js';
//   const forge = new ForgeAudio();
//   forge.start();               // begins full soundscape
//   forge.setMusicLevel(0–1);    // call as music fades in — pulls hammers back
//   forge.stop();                // graceful fade and cleanup
//
// The hammers play a simplified version of the Ding Dong rhythm in D:
//   D  A  D  G  —  D  A  D  —  A  D  A  G
// Pitched to MIDI note frequencies so they ring musically.

const NOTE_FREQ = {
    D4:  293.66,
    E4:  329.63,
    F4:  349.23,  // actually F#4 in Dmaj
    Fs4: 369.99,
    G4:  392.00,
    A4:  440.00,
    B4:  493.88,
    c5:  523.25,
    d5:  587.33,
};

// The hammer melody pattern — note, time offset in beats, velocity (0-1)
// One cycle = 4 beats. At 2200ms/bar this is 550ms/beat.
// This traces the skeleton of Ding Dong Dederó.
const HAMMER_PATTERN = [
    { note: 'D4',  beat: 0.0,  vel: 1.0  },  // d
    { note: 'A4',  beat: 0.5,  vel: 0.7  },  // A
    { note: 'D4',  beat: 1.0,  vel: 0.85 },  // d
    { note: 'G4',  beat: 1.75, vel: 0.6  },  // G
    { note: 'D4',  beat: 2.0,  vel: 1.0  },  // d
    { note: 'A4',  beat: 2.5,  vel: 0.7  },  // A
    { note: 'G4',  beat: 3.0,  vel: 0.8  },  // G
    { note: 'Fs4', beat: 3.75, vel: 0.5  },  // F#
];

const BEAT_MS    = 550;   // matches forge_village tempo (2200ms / 4 beats)
const CYCLE_MS   = BEAT_MS * 4;

// Birdsong call shapes — frequency contours for synthesised bird calls
const BIRD_CALLS = [
    // Robin-like: bright, descending phrase
    { syls: [ { f0: 2800, f1: 2200, dur: 0.08 }, { f0: 2400, f1: 1800, dur: 0.10 }, { f0: 2600, f1: 2100, dur: 0.07 } ], gap: 0.06 },
    // Wren-like: rapid high trill
    { syls: [ { f0: 3200, f1: 3000, dur: 0.05 }, { f0: 3400, f1: 3100, dur: 0.04 }, { f0: 3600, f1: 3200, dur: 0.05 }, { f0: 3300, f1: 2900, dur: 0.06 } ], gap: 0.04 },
    // Blackbird-like: warm, flowing, wider range
    { syls: [ { f0: 1800, f1: 2400, dur: 0.14 }, { f0: 2200, f1: 1600, dur: 0.18 }, { f0: 1900, f1: 2100, dur: 0.12 } ], gap: 0.10 },
    // Chaffinch-like: cascading down
    { syls: [ { f0: 2600, f1: 2400, dur: 0.06 }, { f0: 2400, f1: 2100, dur: 0.07 }, { f0: 2100, f1: 1700, dur: 0.09 }, { f0: 1600, f1: 1400, dur: 0.12 } ], gap: 0.05 },
];

export class ForgeAudio {
    constructor() {
        this.ac           = null;
        this.masterGain   = null;
        this.hammerGain   = null;
        this.bellowsGain  = null;
        this.fireGain     = null;
        this.birdGain     = null;
        this._running     = false;
        this._musicLevel  = 0;       // 0 = no music, 1 = full music
        this._hammerTimer = null;
        this._birdTimer   = null;
        this._bellowsNode = null;
        this._fireNode    = null;
        this._patternIdx  = 0;
        this._rafId       = null;
        this._startTime   = null;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    start() {
        if (this._running) return;
        this._running  = true;
        this._startTime = performance.now();

        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.ac = new AC();
        } catch(e) {
            console.warn('[ForgeAudio] AudioContext failed:', e);
            return;
        }

        // Master output — starts silent, fades in slowly
        this.masterGain = this.ac.createGain();
        this.masterGain.gain.setValueAtTime(0.0001, this.ac.currentTime);
        this.masterGain.gain.exponentialRampToValueAtTime(0.7, this.ac.currentTime + 4.0);
        this.masterGain.connect(this.ac.destination);

        // Layer gains
        this.birdGain    = this._makeGain(0.55);
        this.bellowsGain = this._makeGain(0.0);   // bellows fades in after birds
        this.fireGain    = this._makeGain(0.0);    // fire bed fades in with bellows
        this.hammerGain  = this._makeGain(0.0);    // hammers fade in after bellows

        // Start layers
        this._startBirdsong();
        this._startBellows();
        this._startFireBed();

        // Stagger the layers coming in
        // Birds immediately, bellows after 8s, hammers after 16s
        setTimeout(() => this._rampGain(this.bellowsGain, 0.35, 4000), 8000);
        setTimeout(() => this._rampGain(this.fireGain,    0.18, 3000), 10000);
        setTimeout(() => {
            this._rampGain(this.hammerGain, 0.8, 5000);
            this._startHammerPattern();
        }, 16000);

        // Birds fade out as hammers come in
        setTimeout(() => this._rampGain(this.birdGain, 0.0, 6000), 18000);
    }

    // Call this as the music fades in (0 = no music, 1 = full music)
    // Hammers pull back to accent-only as music takes over
    setMusicLevel(level) {
        this._musicLevel = Math.max(0, Math.min(1, level));
        if (!this.hammerGain) return;
        // As music rises, hammer volume drops to a subtle accent
        const hammerVol = 0.8 - (this._musicLevel * 0.55);
        this._rampGain(this.hammerGain, Math.max(0.12, hammerVol), 2000);
    }

    stop() {
        this._running = false;
        if (this._hammerTimer) clearTimeout(this._hammerTimer);
        if (this._birdTimer)   clearTimeout(this._birdTimer);
        if (this._rafId)       cancelAnimationFrame(this._rafId);

        if (this.masterGain && this.ac) {
            const now = this.ac.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
            this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
            setTimeout(() => {
                try { this.ac.close(); } catch(e) {}
            }, 3000);
        }
    }

    // ── Birdsong ──────────────────────────────────────────────────────────────

    _startBirdsong() {
        const scheduleCall = () => {
            if (!this._running) return;
            const call = BIRD_CALLS[Math.floor(Math.random() * BIRD_CALLS.length)];
            this._playBirdCall(call);
            // Space calls irregularly — sounds more natural
            const nextMs = 3000 + Math.random() * 8000;
            this._birdTimer = setTimeout(scheduleCall, nextMs);
        };
        // First call after a short pause
        this._birdTimer = setTimeout(scheduleCall, 1500 + Math.random() * 2000);
    }

    _playBirdCall(call) {
        if (!this.ac || !this.birdGain) return;
        const now = this.ac.currentTime;
        let t = now;

        for (const syl of call.syls) {
            const osc  = this.ac.createOscillator();
            const gain = this.ac.createGain();

            // Slight vibrato
            const vibLFO  = this.ac.createOscillator();
            const vibGain = this.ac.createGain();
            vibLFO.frequency.value  = 6 + Math.random() * 4;
            vibGain.gain.value      = syl.f0 * 0.02;
            vibLFO.connect(vibGain);
            vibGain.connect(osc.frequency);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(syl.f0, t);
            osc.frequency.exponentialRampToValueAtTime(syl.f1, t + syl.dur);

            // Gentle bandpass to shape the timbre
            const bp = this.ac.createBiquadFilter();
            bp.type            = 'bandpass';
            bp.frequency.value = (syl.f0 + syl.f1) / 2;
            bp.Q.value         = 3.5;

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.18 + Math.random() * 0.08, t + syl.dur * 0.15);
            gain.gain.setValueAtTime(0.18, t + syl.dur * 0.7);
            gain.gain.exponentialRampToValueAtTime(0.001, t + syl.dur);

            osc.connect(bp);
            bp.connect(gain);
            gain.connect(this.birdGain);

            osc.start(t);
            osc.stop(t + syl.dur + 0.01);
            vibLFO.start(t);
            vibLFO.stop(t + syl.dur + 0.01);

            t += syl.dur + call.gap;
        }
    }

    // ── Bellows ───────────────────────────────────────────────────────────────
    // Slow rhythmic filtered noise — the breathing of the forge

    _startBellows() {
        if (!this.ac) return;

        const breathe = () => {
            if (!this._running) return;
            this._playBellowsBreath();
            // Bellows cycle: push ~1.8s, pause ~0.8s
            setTimeout(breathe, 2600 + Math.random() * 400);
        };

        setTimeout(breathe, 0);
    }

    _playBellowsBreath() {
        if (!this.ac || !this.bellowsGain) return;
        const now = this.ac.currentTime;
        const dur = 1.6 + Math.random() * 0.4;

        const noise = this._makeNoise(dur + 0.2);
        const lp    = this.ac.createBiquadFilter();
        lp.type            = 'lowpass';
        lp.frequency.value = 280 + Math.random() * 80;
        lp.Q.value         = 0.8;

        const gain = this.ac.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.6,   now + dur * 0.35);
        gain.gain.linearRampToValueAtTime(0.45,  now + dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        noise.connect(lp);
        lp.connect(gain);
        gain.connect(this.bellowsGain);
        noise.start(now);
        noise.stop(now + dur + 0.1);
    }

    // ── Fire bed ──────────────────────────────────────────────────────────────
    // Continuous low hiss — the forge coals

    _startFireBed() {
        if (!this.ac || !this.fireGain) return;

        const makeFireSegment = () => {
            if (!this._running) return;
            const dur   = 4.0;
            const noise = this._makeNoise(dur + 0.5);

            const bp = this.ac.createBiquadFilter();
            bp.type            = 'bandpass';
            bp.frequency.value = 180 + Math.random() * 60;
            bp.Q.value         = 0.6;

            const hp = this.ac.createBiquadFilter();
            hp.type            = 'highpass';
            hp.frequency.value = 80;

            const gain = this.ac.createGain();
            gain.gain.setValueAtTime(0.7, this.ac.currentTime);

            noise.connect(bp);
            bp.connect(hp);
            hp.connect(gain);
            gain.connect(this.fireGain);
            noise.start(this.ac.currentTime);
            noise.stop(this.ac.currentTime + dur + 0.4);

            setTimeout(makeFireSegment, dur * 1000 - 100);
        };

        makeFireSegment();
    }

    // ── Pitched hammers ───────────────────────────────────────────────────────
    // Tuned to D major. The pattern traces Ding Dong Dederó's skeleton.
    // As music fades in, hammers recede to accent only.

    _startHammerPattern() {
        if (!this._running) return;

        const scheduleNext = () => {
            if (!this._running) return;
            const step = HAMMER_PATTERN[this._patternIdx % HAMMER_PATTERN.length];
            this._playHammerStrike(NOTE_FREQ[step.note], step.vel);
            this._patternIdx++;

            // Time to next hit
            const currentBeat = this._patternIdx % HAMMER_PATTERN.length;
            const nextStep    = HAMMER_PATTERN[currentBeat];
            const currentStep = HAMMER_PATTERN[(this._patternIdx - 1) % HAMMER_PATTERN.length];

            // Gap between this hit and next
            let gapBeats;
            if (currentBeat === 0) {
                // End of cycle — gap from last hit to end of bar + start of next
                gapBeats = (4.0 - currentStep.beat) + HAMMER_PATTERN[0].beat;
            } else {
                gapBeats = nextStep.beat - currentStep.beat;
            }

            const gapMs = gapBeats * BEAT_MS;
            this._hammerTimer = setTimeout(scheduleNext, Math.max(50, gapMs));
        };

        scheduleNext();
    }

    _playHammerStrike(freq, velocity) {
        if (!this.ac || !this.hammerGain) return;
        const now = this.ac.currentTime;

        // Impact transient — short noise burst
        const transient     = this._makeNoise(0.025);
        const transientGain = this.ac.createGain();
        transientGain.gain.setValueAtTime(velocity * 0.7, now);
        transientGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

        const transientBP = this.ac.createBiquadFilter();
        transientBP.type            = 'bandpass';
        transientBP.frequency.value = 1200;
        transientBP.Q.value         = 1.2;

        transient.connect(transientBP);
        transientBP.connect(transientGain);
        transientGain.connect(this.hammerGain);
        transient.start(now);
        transient.stop(now + 0.03);

        // Pitched ring — the musical tone of the metal
        // Two oscillators slightly detuned for that metallic shimmer
        [1.0, 1.003].forEach((detune, i) => {
            const osc  = this.ac.createOscillator();
            const gain = this.ac.createGain();

            osc.type            = 'sine';
            osc.frequency.value = freq * detune;

            // Metallic overtones
            if (i === 0) {
                const osc2  = this.ac.createOscillator();
                const gain2 = this.ac.createGain();
                osc2.type            = 'sine';
                osc2.frequency.value = freq * 2.756; // inharmonic partial
                gain2.gain.setValueAtTime(velocity * 0.12, now);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                osc2.connect(gain2);
                gain2.connect(this.hammerGain);
                osc2.start(now);
                osc2.stop(now + 0.5);
            }

            // Sharp attack, long metallic ring
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(velocity * 0.55, now + 0.004);
            gain.gain.exponentialRampToValueAtTime(velocity * 0.08, now + 0.18);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

            osc.connect(gain);
            gain.connect(this.hammerGain);
            osc.start(now);
            osc.stop(now + 1.5);
        });
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    _makeNoise(dur) {
        const buf  = this.ac.createBuffer(1, Math.ceil(this.ac.sampleRate * dur), this.ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src  = this.ac.createBufferSource();
        src.buffer = buf;
        return src;
    }

    _makeGain(value) {
        const g = this.ac.createGain();
        g.gain.value = value;
        g.connect(this.masterGain);
        return g;
    }

    _rampGain(gainNode, targetValue, durationMs) {
        if (!gainNode || !this.ac) return;
        const now    = this.ac.currentTime;
        const target = Math.max(0.0001, targetValue);
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), now);
        gainNode.gain.exponentialRampToValueAtTime(target, now + durationMs / 1000);
    }
}

