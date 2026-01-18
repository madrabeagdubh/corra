export default class ChipSynth {
 
constructor() {
  this.ctx = new (window.AudioContext || window.webkitAudioContext)();

  console.log("[chipSynth] ctx state:", this.ctx.state);

  document.body.addEventListener("click", () => {
    if (this.ctx.state !== "running") {
      this.ctx.resume();
      console.log("[chipSynth] ctx resumed");
    }
  }, { once: true });

  this.master = this.ctx.createGain();
  this.master.gain.value = 0.2;
  this.master.connect(this.ctx.destination);
}
 play(freq, start, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.value = freq;

    // old-school envelope
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
    gain.gain.linearRampToValueAtTime(0, start + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(start);
    osc.stop(start + duration);
  }



testBeep() {
  const osc = this.ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = 440;

  osc.connect(this.master);
  osc.start();
  osc.stop(this.ctx.currentTime + 0.5);
}
}
