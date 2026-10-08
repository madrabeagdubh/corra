// introDrone.js
//
// The run-up to My Lagan Love. A quiet open fifth on C that fills the sky while the
// player waits at the first constellation, leans in when they touch a star, and
// opens out the moment the tune begins, so the tune arrives as a release.
//
// C, because the tune is in C (K: Cmaj, bass C and G) and so are the constellation
// chimes. An open fifth with no third, because the tune can then put either colour
// on top of it. Built from C3 upward: a phone speaker gives up somewhere below
// ~250Hz, so a deep drone would simply not be there; the filter lets the upper
// partials of the triangles carry it instead.
//
// Shares the scene's AudioContext. No samples, no network.
//
//   const drone = createIntroDrone(audioContext, destinationNode);
//   drone.start();        // fade in and slowly brighten
//   drone.tension(true);  // a star is held
//   drone.tension(false); // let go without joining anything
//   drone.release();      // the tune has begun
//   drone.stop();         // fade out, free everything

const NOTES      = [130.81, 196.00, 261.63, 392.00];        // C3 G3 C4 G4
const WAVES      = ['triangle', 'triangle', 'sine', 'sine'];
const VOICE_GAIN = [0.16, 0.12, 0.10, 0.07];
const DETUNE_CENTS = 5;                                      // each note is a pair, +/- this

// Master level and filter cutoff (Hz) at each stage.
const LEVEL  = { built: 0.12, lean: 0.16, bloom: 0.24, bed: 0.05 };
const CUTOFF = { start: 380, built: 900, lean: 1300, bloom: 3200, bed: 700 };

const RISE_S   = 10;     // silence to "built"
const LEAN_S   = 0.6;    // time constant for leaning in or easing back
const BLOOM_S  = 0.12;   // time constant of the bloom's attack
const BLOOM_HOLD_MS = 700;
const SETTLE_S = 7;      // bloom down to the bed under the tune
const OUT_S    = 1.2;    // stop() fade

const LFO_HZ = 0.07, LFO_DEPTH_HZ = 140;                    // the filter's slow drift

// [progress] Driven by the poem. HUSH_LEVEL is where it starts, at the first touch.
// PROGRESS_CURVE < 1 lifts the early part: the dial's u is smoothstepped, which would
// otherwise leave the opening lines nearly silent. The shimmer arrives from SHIMMER_FROM
// (a fraction of the poem) to the end.
const HUSH_LEVEL = 0.03;
const PROGRESS_CURVE = 0.6;
const PROGRESS_TC = 1.2;                 // how closely it follows u, seconds
const LFO_HZ_END = 0.28, LFO_DEPTH_END = 300;   // the drift at the end of the poem
const SHIMMER_NOTES = [783.99, 1046.50]; // G5 C6
const SHIMMER_CENTS = 3;
const SHIMMER_PEAK = 0.10;
const SHIMMER_FROM = 0.55;

function smooth01(x) {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
}

// [fade] After the bloom, how long the drone takes to leave once the tune has begun.
const FADE_OUT_S = 10;
const BLOOM_ATTACK_S = 0.25;   // the swell as the tune enters; the fade starts the instant it peaks

export function createIntroDrone(ac, destination) {
    const master = ac.createGain();
    master.gain.value = 0.0001;
    master.connect(destination);

    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = CUTOFF.start;
    filter.Q.value = 0.6;
    filter.connect(master);

    const lfo = ac.createOscillator();
    lfo.frequency.value = LFO_HZ;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = LFO_DEPTH_HZ;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);

    const oscs = [lfo];
    NOTES.forEach((hz, i) => {
        [-DETUNE_CENTS, DETUNE_CENTS].forEach(cents => {
            const o = ac.createOscillator();
            o.type = WAVES[i];
            o.frequency.value = hz;
            o.detune.value = cents;
            const g = ac.createGain();
            g.gain.value = VOICE_GAIN[i];
            o.connect(g);
            g.connect(filter);
            oscs.push(o);
        });
    });

    // [progress] The shimmer: a thin high pair that only arrives late in the poem.
    const shimmerGain = ac.createGain();
    shimmerGain.gain.value = 0;
    shimmerGain.connect(master);
    SHIMMER_NOTES.forEach(hz => {
        [-SHIMMER_CENTS, SHIMMER_CENTS].forEach(cents => {
            const o = ac.createOscillator();
            o.type = 'sine';
            o.frequency.value = hz;
            o.detune.value = cents;
            o.connect(shimmerGain);
            oscs.push(o);
        });
    });

    let state = 'idle';      // idle -> building -> released -> stopped
    let holdTimer = null;
    let fadeTimer = null;

    // Glide a parameter toward a value from wherever it is now.
    function glide(param, value, timeConstant) {
        const t = ac.currentTime;
        param.cancelScheduledValues(t);
        param.setValueAtTime(param.value, t);
        param.setTargetAtTime(value, t, timeConstant);
    }

    return {
        get state() { return state; },

        // [progress] begin() starts it at the hush, for the poem to steer with progress(u).
        // start() is still there for a scene with no poem: it just rises on its own.
        begin() {
            if (state !== 'idle') return;
            state = 'building';
            oscs.forEach(o => { try { o.start(); } catch (e) {} });
            this.progress(0, 0.5);
        },

        progress(u, timeConstant = PROGRESS_TC) {
            if (state !== 'building') return;
            const p = Math.max(0, Math.min(1, u));
            const e = Math.pow(p, PROGRESS_CURVE);
            glide(master.gain,      HUSH_LEVEL + (LEVEL.built - HUSH_LEVEL) * e,        timeConstant);
            glide(filter.frequency, CUTOFF.start + (CUTOFF.built - CUTOFF.start) * e,   timeConstant);
            glide(lfo.frequency,    LFO_HZ + (LFO_HZ_END - LFO_HZ) * e,                 timeConstant);
            glide(lfoDepth.gain,    LFO_DEPTH_HZ + (LFO_DEPTH_END - LFO_DEPTH_HZ) * e,  timeConstant);
            glide(shimmerGain.gain, SHIMMER_PEAK * smooth01((p - SHIMMER_FROM) / (1 - SHIMMER_FROM)), timeConstant);
        },

        start() {
            if (state !== 'idle') return;
            state = 'building';
            oscs.forEach(o => { try { o.start(); } catch (e) {} });
            glide(master.gain,       LEVEL.built,  RISE_S / 3);
            glide(filter.frequency,  CUTOFF.built, RISE_S / 3);
        },

        tension(on) {
            if (state !== 'building') return;
            glide(master.gain,      on ? LEVEL.lean  : LEVEL.built,  LEAN_S);
            glide(filter.frequency, on ? CUTOFF.lean : CUTOFF.built, LEAN_S);
        },

        release() {
            if (state !== 'building') return;
            state = 'released';
            const t0 = ac.currentTime;
            master.gain.cancelScheduledValues(t0);
            master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t0);
            master.gain.linearRampToValueAtTime(LEVEL.bloom, t0 + BLOOM_ATTACK_S);
            master.gain.exponentialRampToValueAtTime(0.0001, t0 + FADE_OUT_S);   // [fade] silent FADE_OUT_S after the tune begins
            glide(filter.frequency, CUTOFF.bloom, BLOOM_S);
            holdTimer = setTimeout(() => {
                holdTimer = null;
                if (state !== 'released') return;
                // [fade] the whole gain curve was scheduled in release(); only the filter settles here
                fadeTimer = setTimeout(() => { fadeTimer = null; if (state === 'released') this.stop(); }, FADE_OUT_S * 1000);
                glide(filter.frequency, CUTOFF.bed, SETTLE_S / 3);
            }, BLOOM_HOLD_MS);
        },

        stop() {
            if (state === 'stopped') return;
            state = 'stopped';
            if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
            if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
            try {
                const t = ac.currentTime;
                master.gain.cancelScheduledValues(t);
                master.gain.setValueAtTime(master.gain.value, t);
                master.gain.linearRampToValueAtTime(0.0001, t + OUT_S);
                oscs.forEach(o => { try { o.stop(t + OUT_S + 0.1); } catch (e) {} });
            } catch (e) {}
            setTimeout(() => { try { master.disconnect(); } catch (e) {} }, (OUT_S + 0.4) * 1000);
        },
    };
}
