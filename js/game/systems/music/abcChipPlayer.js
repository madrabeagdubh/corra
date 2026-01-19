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
    this.synth.ensureContext();
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
    if (!visualObjs || visualObjs.length === 0) {
      console.warn("[AbcChipPlayer] No visual objects rendered");
      return;
    }

    const tune = visualObjs[0];
    console.log("[AbcChipPlayer] Tune loaded:", tune.title || "Untitled");

    // Extract notes directly from the tune structure
    const events = this.extractNotes(tune);
    
    if (!events || events.length === 0) {
      console.warn("[AbcChipPlayer] No notes found in tune");
      return;
    }

    const now = this.synth.ctx.currentTime;

    events.forEach(ev => {
      const freq = 440 * Math.pow(2, (ev.midi - 69) / 12);
      this.synth.play(freq, now + ev.time, ev.duration);
    });

    const totalDuration = events[events.length - 1].time + events[events.length - 1].duration;
    this.isPlaying = true;

    console.log(`[AbcChipPlayer] Scheduled ${events.length} notes, ${totalDuration.toFixed(2)}s total`);

    setTimeout(() => {
      this.isPlaying = false;
      console.log("[AbcChipPlayer] Playback finished");
    }, totalDuration * 1000 + 200);
  }

  extractNotes(tune) {
    const events = [];
    let currentTime = 0;
    
    // Try to get tempo from metaText
    let tempo = 120; // default
    if (tune.metaText && tune.metaText.tempo) {
      tempo = tune.metaText.tempo.bpm || 120;
    }
    
    const beatDuration = 60 / tempo; // Duration of one quarter note in seconds
    
    // Note name to semitone offset from C
    const noteToSemitone = {
      'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11,
      'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
    };
    
    // Parse through all lines and voices
    if (!tune.lines) {
      console.warn("[AbcChipPlayer] No lines found in tune");
      return events;
    }

    tune.lines.forEach((line) => {
      if (!line.staff) return;
      
      line.staff.forEach((staff) => {
        if (!staff.voices) return;
        
        staff.voices.forEach((voice) => {
          voice.forEach((element) => {
            // Handle notes
            if (element.el_type === "note") {
              if (element.pitches && element.pitches.length > 0) {
                element.pitches.forEach(pitch => {
                  // Use the note name to get the correct MIDI note
                  const noteName = pitch.name;
                  
                  if (!noteName || !(noteName in noteToSemitone)) {
                    console.warn("[AbcChipPlayer] Unknown note name:", noteName);
                    return;
                  }
                  
                  // Determine octave from case (lowercase = higher octave in ABC)
                  const isLowerCase = noteName === noteName.toLowerCase();
                  const baseOctave = isLowerCase ? 5 : 4; // e = E5, E = E4
                  
                  // Get semitone offset from C
                  const semitoneOffset = noteToSemitone[noteName];
                  
                  // Calculate MIDI note (C4 = 60)
                  const midiNote = (baseOctave * 12) + semitoneOffset + (pitch.accidental || 0);
                  
                  const duration = element.duration * beatDuration * 4;
                  
                  console.log(`[AbcChipPlayer] Note: ${noteName} -> MIDI ${midiNote}`);
                  
                  events.push({
                    midi: midiNote,
                    time: currentTime,
                    duration: duration
                  });
                });
              }
              // Advance time by note duration
              currentTime += element.duration * beatDuration * 4;
            }
            // Handle rests
            else if (element.el_type === "rest") {
              currentTime += element.duration * beatDuration * 4;
            }
          });
        });
      });
    });

    return events;
  }

  stop() {
    this.isPlaying = false;
    this.synth.stopAll();
    console.log("[AbcChipPlayer] Stopped");
  }
}
