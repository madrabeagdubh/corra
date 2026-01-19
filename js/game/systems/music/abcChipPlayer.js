// AbcChipPlayer.js
import ABCJS from "abcjs";
import ChipSynth from "./chipSynth";

export default class AbcChipPlayer {
  constructor() {
    this.synth = new ChipSynth();
    this.isPlaying = false;
  }




async play(abc) {
  // Ensure AudioContext is running
  await this.synth.ctx.resume();

  // Hidden container for ABCJS render
  let container = document.getElementById("abc-hidden");
  if (!container) {
    container = document.createElement("div");
    container.id = "abc-hidden";
    container.style.display = "none";
    document.body.appendChild(container);
  }
  container.innerHTML = "";

  // Render ABC notation (needed for timing)
  const visualObjs = ABCJS.renderAbc(container, abc, { add_classes: true });
  if (!visualObjs || visualObjs.length === 0) return;

  const tune = visualObjs[0];
  console.log("[AbcChipPlayer] Tune loaded:", tune.title || "Untitled");

  // Modern ABCJS synth
  const synth = new ABCJS.synth.CreateSynth();
  try {
    await synth.init({ visualObj: tune, options: { soundFontUrl: null } });
  } catch (err) {
    console.error("[AbcChipPlayer] Synth init failed:", err);
    return;
  }

  const events = synth.getSequence();
  if (!events || !events.length) {
    console.warn("[AbcChipPlayer] No events generated");
    return;
  }

  const now = this.synth.ctx.currentTime;

  events.forEach(ev => {
    if (!ev.midiPitches) return;

    ev.midiPitches.forEach(mp => {
      const freq = 440 * Math.pow(2, (mp - 69) / 12);
      this.synth.play(freq, now + ev.time, ev.duration);
    });
  });

  const totalDuration = events[events.length - 1].time + events[events.length - 1].duration;
  this.isPlaying = true;

  setTimeout(() => {
    this.isPlaying = false;
    console.log("[AbcChipPlayer] Playback finished");
  }, totalDuration * 1000 + 200);
}








  scheduleWithSynthSequence(tune) {
    const now = this.synth.ctx.currentTime;

    // ABCJS SynthSequence handles note timing, duration, tempo
    const seq = new ABCJS.synth.SynthSequence();
    try {
      seq.init({ visualObj: tune, millisecondsPerMeasure: null });
    } catch (err) {
      console.error("[AbcChipPlayer] SynthSequence init failed:", err);
      return;
    }

    const events = seq.getSequence();
    if (!events || !events.length) {
      console.warn("[AbcChipPlayer] No synth events generated");
      return;
    }

    events.forEach(ev => {
      if (!ev.midiPitches) return;

      ev.midiPitches.forEach(mp => {
        const freq = 440 * Math.pow(2, (mp - 69) / 12);
        // Play each note via ChipSynth
        this.synth.play(freq, now + ev.time, ev.duration);
      });
    });

    const totalDuration = events[events.length - 1].time + events[events.length - 1].duration;
    this.isPlaying = true;

    console.log(`[AbcChipPlayer] Scheduled ${totalDuration.toFixed(2)}s of music`);

    setTimeout(() => {
      this.isPlaying = false;
      console.log("[AbcChipPlayer] Playback finished");
    }, totalDuration * 1000 + 200);
  }

  stop() {
    this.isPlaying = false;
    this.synth.stopAll();
    console.log("[AbcChipPlayer] Stopped");
  }
}
