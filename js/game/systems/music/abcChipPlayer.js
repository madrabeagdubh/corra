import ABCJS from "abcjs";
import ChipSynth from "./chipSynth";

export default class AbcChipPlayer {
  constructor() {
    this.synth = new ChipSynth();
    this.isPlaying = false;
  }

  async play(abc) {
    // Ensure context is running
    if (this.synth.ctx.state !== 'running') {
      await this.synth.ctx.resume();
      console.log('[abcChipPlayer] resumed audio context');
    }

    // Ensure hidden render target exists
    let container = document.getElementById("abc-hidden");
    if (!container) {
      container = document.createElement("div");
      container.id = "abc-hidden";
      container.style.display = "none";
      document.body.appendChild(container);
    }

    // Clear previous render
    container.innerHTML = '';

    // Render ABC notation (required for timing)
    const visualObjs = ABCJS.renderAbc(container, abc, {
      add_classes: true,
      responsive: false
    });

    if (!visualObjs || visualObjs.length === 0) {
      console.error('[abcChipPlayer] No visual objects rendered');
      return;
    }

    const tune = visualObjs[0];
    console.log('[abcChipPlayer] Tune loaded:', tune);

    // Extract notes from the tune structure
    this.scheduleNotes(tune);
  }

  scheduleNotes(tune) {
    const now = this.synth.ctx.currentTime;
    let currentTime = 0;
    const beatDuration = 0.25; // Quarter note duration in seconds

    console.log('[abcChipPlayer] Scheduling notes...');

    // Walk through the tune structure
    if (tune.lines) {
      tune.lines.forEach(line => {
        if (line.staff) {
          line.staff.forEach(staff => {
            if (staff.voices) {
              staff.voices.forEach(voice => {
                voice.forEach(element => {
                  // Check if this is a note element
                  if (element.el_type === 'note' && element.pitches) {
                    const duration = (element.duration || 0.125) * beatDuration * 4;
                    
                    element.pitches.forEach(pitch => {
                      if (pitch.pitch !== undefined) {
                        const midiPitch = pitch.pitch + 60; // Convert to MIDI
                        const freq = 440 * Math.pow(2, (midiPitch - 69) / 12);
                        
                        console.log(`[abcChipPlayer] Note: ${freq.toFixed(1)}Hz at ${currentTime.toFixed(3)}s for ${duration.toFixed(3)}s`);
                        this.synth.play(freq, now + currentTime, duration);
                      }
                    });
                    
                    currentTime += duration;
                  }
                  // Handle rests
                  else if (element.el_type === 'rest') {
                    const duration = (element.duration || 0.125) * beatDuration * 4;
                    currentTime += duration;
                  }
                });
              });
            }
          });
        }
      });
    }

    console.log(`[abcChipPlayer] Scheduled ${currentTime.toFixed(2)}s of music`);
    this.isPlaying = true;
    
    // Auto-stop after tune finishes
    setTimeout(() => {
      this.isPlaying = false;
      console.log('[abcChipPlayer] Playback finished');
    }, currentTime * 1000 + 500);
  }

  stop() {
    this.isPlaying = false;
    console.log('[abcChipPlayer] Stopped');
  }
}
