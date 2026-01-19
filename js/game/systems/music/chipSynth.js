// ChipSynth.js
export default class ChipSynth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.activeOscillators = new Set();
    console.log("[ChipSynth] Initialized");
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Master gain
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;

      // Gentle compression
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 3;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.2;

      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      console.log("[ChipSynth] Audio context created");
    }
    return this.ctx;
  }

  play(freq, start, duration) {
    this.ensureContext();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Chip sound: triangle wave, slight detune for human feel
    osc.type = "triangle";
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 3;

    // Gentle low-pass to smooth timbre
    filter.type = "lowpass";
    filter.frequency.value = freq * 4;
    filter.Q.value = 0.8;

    // ADSR envelope tuned for slow melodic tunes
    const attack = 0.02;
    const decay = 0.06;
    const sustain = 0.6;
    const release = 0.08;

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.7, start + attack);
    gain.gain.linearRampToValueAtTime(sustain, start + attack + decay);
    gain.gain.setValueAtTime(sustain, start + duration - release);
    gain.gain.linearRampToValueAtTime(0, start + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc.start(start);
    osc.stop(start + duration + 0.02);

    osc.onended = () => {
      this.activeOscillators.delete(osc);
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    this.activeOscillators.add(osc);
  }

  stopAll() {
    this.activeOscillators.forEach(osc => {
      try { osc.stop(); } catch {}
    });
    this.activeOscillators.clear();
  }

  testBeep() {
    this.ensureContext();
    this.play(440, this.ctx.currentTime, 0.4);
  }
}
