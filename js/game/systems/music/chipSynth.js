export default class ChipSynth {
 
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    console.log("[chipSynth] Initialized (context will be created on first interaction)");
  }
  
  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      console.log("[chipSynth] Context created, state:", this.ctx.state);
      
      // Add compression for better overall sound
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-20, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);
      
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
    return this.ctx;
  }
 
  play(freq, start, duration) {
    this.ensureContext();
    
    // Use triangle wave for a softer, more melodic sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    // Triangle wave is softer than square
    osc.type = "triangle";
    osc.frequency.value = freq;
    
    // Low-pass filter to soften the sound
    filter.type = "lowpass";
    filter.frequency.value = freq * 3; // Filter at 3x the fundamental
    filter.Q.value = 1;
    
    // Better ADSR envelope for more musical sound
    const attackTime = 0.01;
    const decayTime = 0.05;
    const sustainLevel = 0.6;
    const releaseTime = 0.1;
    
    gain.gain.setValueAtTime(0, start);
    // Attack
    gain.gain.linearRampToValueAtTime(0.8, start + attackTime);
    // Decay to sustain
    gain.gain.linearRampToValueAtTime(sustainLevel, start + attackTime + decayTime);
    // Sustain (hold at sustainLevel)
    gain.gain.setValueAtTime(sustainLevel, start + duration - releaseTime);
    // Release
    gain.gain.linearRampToValueAtTime(0, start + duration);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    
    osc.start(start);
    osc.stop(start + duration);
  }
  
  testBeep() {
    this.ensureContext();
    
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 440;
    
    osc.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }
}
