import ABCJS from "abcjs";
import ChipSynth from "./chipSynth";

export default class AbcChipPlayer {
  constructor() {
    this.synth = new ChipSynth();
  }


play(abc) {
  // Ensure hidden render target exists
  let container = document.getElementById("abc-hidden");
  if (!container) {
    container = document.createElement("div");
    container.id = "abc-hidden";
    container.style.display = "none";
    document.body.appendChild(container);
  }

  // Render ONCE (required for timing)
  const visualObjs = ABCJS.renderAbc(container, abc, {
    add_classes: false,
    responsive: false
  });

  const tune = visualObjs[0];

  const timing = new ABCJS.TimingCallbacks(tune, {
    eventCallback: (event) => this.onEvent(event)
  });

  this.startTime = this.synth.ctx.currentTime + 0.1;
  timing.start();
}




onEvent(event) {
  if (!event) return;
  if (!event.midiPitches || event.midiPitches.length === 0) return;

  const start = this.startTime + event.time;
  const duration = event.duration;

  const pitch = event.midiPitches[0].pitch;
  const freq = 440 * Math.pow(2, (pitch - 69) / 12);

  this.synth.play(freq, start, duration);
}
}
