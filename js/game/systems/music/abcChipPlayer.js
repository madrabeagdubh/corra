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
    
    // Debug: Show the key signature and time signature
    if (tune.metaText) {
      console.log('[abcChipPlayer] Key:', tune.metaText.key);
      console.log('[abcChipPlayer] Meter:', tune.metaText.meter);
      console.log('[abcChipPlayer] Rhythm:', tune.metaText.rhythm);
    }

    // Extract notes from the tune structure
    this.scheduleNotes(tune);
  }

  scheduleNotes(tune) {
    const now = this.synth.ctx.currentTime;
    let currentTime = 0;
    const beatDuration = 0.5; // Half note = 0.5s (slower, more stately for march tempo)

    console.log('[abcChipPlayer] Scheduling notes...');

    if (tune.lines) {
      tune.lines.forEach(line => {
        if (line.staff) {
          line.staff.forEach(staff => {
            if (staff.voices) {
              staff.voices.forEach(voice => {
                voice.forEach(element => {
                  // Handle notes
                  if (element.el_type === 'note' && element.pitches) {
                    // Calculate duration based on the note's duration value
                    const duration = (element.duration || 0.125) * beatDuration * 4;
                    
                    element.pitches.forEach(pitch => {
                      if (pitch.pitch !== undefined) {
                        // The pitch value from ABCJS is relative to C (middle C = 0)
                        // Convert to MIDI: middle C (C4) = MIDI 60
                        const midiPitch = pitch.pitch + 60;
                        const freq = 440 * Math.pow(2, (midiPitch - 69) / 12);
                        
                        console.log(`[abcChipPlayer] Note: ${freq.toFixed(1)}Hz (MIDI ${midiPitch}) at ${currentTime.toFixed(3)}s for ${duration.toFixed(3)}s`);
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
                  // Handle bar lines (just for logging)
                  else if (element.el_type === 'bar') {
                    console.log(`[abcChipPlayer] --- Bar line at ${currentTime.toFixed(3)}s ---`);
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
