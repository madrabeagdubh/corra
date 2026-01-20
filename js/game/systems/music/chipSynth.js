export default class ChipSynth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.activeOscillators = new Set();
    console.log("[ChipSynth] Multi-voice initialized");
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;

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

  // Main melody voice
  playMelody(freq, start, duration) {
    if (!isFinite(freq) || !isFinite(start) || !isFinite(duration)) return;

    this.ensureContext();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, start);

    // Bright melody envelope
    const attack = 0.02;
    const release = 0.1;

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.4, start + attack);
    gain.gain.setValueAtTime(0.4, start + duration - release);
    gain.gain.linearRampToValueAtTime(0, start + duration);

    osc.connect(gain);
    gain.connect(this.master);

    osc.start(start);
    osc.stop(start + duration + 0.1);
  }

  // Harmony voice (plays thirds or fifths above melody)
  playHarmony(freq, start, duration, interval = 4) {
    if (!isFinite(freq) || !isFinite(start) || !isFinite(duration)) return;

    this.ensureContext();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    // Add interval (3 = minor third, 4 = major third, 7 = fifth)
    const harmonyFreq = freq * Math.pow(2, interval / 12);
    osc.frequency.setValueAtTime(harmonyFreq, start);

    // Softer harmony
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.03);
    gain.gain.setValueAtTime(0.15, start + duration - 0.1);
    gain.gain.linearRampToValueAtTime(0, start + duration);

    osc.connect(gain);
    gain.connect(this.master);

    osc.start(start);
    osc.stop(start + duration + 0.1);
  }

  // Bass voice (plays root notes)
  playBass(freq, start, duration) {
    if (!isFinite(freq) || !isFinite(start) || !isFinite(duration)) return;

    this.ensureContext();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    // Drop bass down 2 octaves
    const bassFreq = freq / 4;
    osc.frequency.setValueAtTime(bassFreq, start);

    // Punchy bass envelope
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.3, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.1, start + 0.1);
    gain.gain.setValueAtTime(0.1, start + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0.001, start + duration);

    osc.connect(gain);
    gain.connect(this.master);

    osc.start(start);
    osc.stop(start + duration + 0.1);
  }

  // Percussion (kick and snare-like sounds)
  playDrum(type, start) {
    if (!isFinite(start)) return;

    this.ensureContext();

    if (type === 'kick') {
      // Kick drum: pitched sweep down
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(150, start);
      osc.frequency.exponentialRampToValueAtTime(40, start + 0.1);

      gain.gain.setValueAtTime(0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

      osc.connect(gain);
      gain.connect(this.master);

      osc.start(start);
      osc.stop(start + 0.2);

    } else if (type === 'snare') {
      // Snare: noise burst
      const noise = this.ctx.createBufferSource();
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 1000;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);

      noise.start(start);
    } else if (type === 'hihat') {
      // Hi-hat: short noise
      const noise = this.ctx.createBufferSource();
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 7000;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);

      noise.start(start);
    }
  }

  // Legacy single-voice method (for backwards compatibility)
  play(freq, start, duration) {
    this.playMelody(freq, start, duration);
  }

  stopAll() {
    this.activeOscillators.forEach(osc => {
      try { osc.stop(); } catch {}
    });
    this.activeOscillators.clear();
  }

  testBeep() {
    this.ensureContext();
    this.playMelody(440, this.ctx.currentTime, 0.4);
  }
}
