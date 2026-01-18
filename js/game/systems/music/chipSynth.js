export default class ChipSynth {
 
  constructor() {
    // Don't create context in constructor - wait for user interaction
    this.ctx = null;
    this.master = null;
    console.log("[chipSynth] Initialized (context will be created on first interaction)");
  }
  
  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      console.log("[chipSynth] Context created, state:", this.ctx.state);
      
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }
 
  play(freq, start, duration) {
    this.ensureContext();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "square";
    osc.frequency.value = freq;
    
    // old-school envelope
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    
    osc.connect(gain);
    gain.connect(this.master);
    
    osc.start(start);
    osc.stop(start + duration);
  }
  
  testBeep() {
    this.ensureContext();
    
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 440;
    
    osc.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }
}
