import ABCJS from "abcjs";
import ChipSynth from "./chipSynth";

export default class AbcChipPlayer {
    constructor() {
        this.synth = new ChipSynth();
        this.ctx = null;
    }

    async play(abc) {
        // 1. Ensure audio context is ready
        this.ctx = this.synth.ensureContext();
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // 2. Parse ABC notation (invisible render)
        const visualObj = ABCJS.renderAbc(document.createElement("div"), abc)[0];
        
        if (!visualObj) {
            console.error("Failed to parse ABC notation");
            return;
        }

        // 3. Extract tempo from ABC or use default
        let bpm = 70;
        const tempoMatch = abc.match(/Q:\s*(\d+)/);
        if (tempoMatch) {
            bpm = parseInt(tempoMatch[1]);
        }
        
        const secondsPerQuarterNote = 60 / bpm;
        console.log(`[AbcChipPlayer] Tempo: ${bpm} BPM = ${secondsPerQuarterNote.toFixed(3)}s per quarter note`);

        // 4. Extract notes
        const notes = this.extractNotes(visualObj, secondsPerQuarterNote);
        console.log(`[AbcChipPlayer] Extracted ${notes.length} notes`);

        // 5. Schedule everything with multi-voice arrangement
        const now = this.ctx.currentTime + 0.1;
        
        // Get meter for drum pattern
        const meter = this.extractMeter(abc);
        const beatsPerMeasure = meter.num;
        const beatDuration = secondsPerQuarterNote * (4 / meter.denom);
        
        console.log(`[AbcChipPlayer] Meter: ${meter.num}/${meter.denom}, beat duration: ${beatDuration.toFixed(3)}s`);
        
        // Schedule melody with harmony
        let harmonyCount = 0;
        notes.forEach((note, i) => {
            // Melody (main voice)
            this.synth.playMelody(note.freq, now + note.time, note.duration);
            
            // Harmony (every other note, playing thirds)
            if (i % 2 === 0) {
                this.synth.playHarmony(note.freq, now + note.time, note.duration, 4);
                harmonyCount++;
            }
        });
        
        console.log(`[AbcChipPlayer] Scheduled ${notes.length} melody notes + ${harmonyCount} harmony notes`);
        
        // Add bass line (root notes on strong beats)
        const bassNotes = this.scheduleBass(notes, now, beatDuration, beatsPerMeasure);
        console.log(`[AbcChipPlayer] Scheduled ${bassNotes} bass notes`);
        
        // Add percussion pattern
        const drumHits = this.scheduleDrums(notes, now, beatDuration, beatsPerMeasure);
        console.log(`[AbcChipPlayer] Scheduled ${drumHits} drum hits`);

        console.log("♪ Multi-voice playback scheduled");
    }

    extractMeter(abc) {
        // Extract time signature (e.g., M: 4/4)
        const meterMatch = abc.match(/M:\s*(\d+)\/(\d+)/);
        if (meterMatch) {
            return { num: parseInt(meterMatch[1]), denom: parseInt(meterMatch[2]) };
        }
        return { num: 4, denom: 4 }; // Default 4/4
    }

    scheduleBass(notes, startTime, beatDuration, beatsPerMeasure) {
        if (notes.length === 0) return 0;
        
        // Play bass on strong beats throughout the song
        const totalDuration = notes[notes.length - 1].time + notes[notes.length - 1].duration;
        const totalBeats = Math.ceil(totalDuration / beatDuration);
        let bassCount = 0;
        
        for (let beat = 0; beat < totalBeats; beat++) {
            const beatTime = beat * beatDuration;
            const beatInMeasure = beat % beatsPerMeasure;
            
            // Play bass on beats 1 and 3
            if (beatInMeasure === 0 || beatInMeasure === 2) {
                // Find the melody note closest to this beat
                const closestNote = notes.reduce((closest, note) => {
                    const currentDist = Math.abs(note.time - beatTime);
                    const closestDist = Math.abs(closest.time - beatTime);
                    return currentDist < closestDist ? note : closest;
                });
                
                if (closestNote) {
                    this.synth.playBass(closestNote.freq, startTime + beatTime, beatDuration * 0.9);
                    bassCount++;
                }
            }
        }
        
        return bassCount;
    }

    scheduleDrums(notes, startTime, beatDuration, beatsPerMeasure) {
        if (notes.length === 0) return 0;
        
        const totalDuration = notes[notes.length - 1].time + notes[notes.length - 1].duration;
        const totalBeats = Math.ceil(totalDuration / beatDuration);
        let drumCount = 0;
        
        for (let beat = 0; beat < totalBeats; beat++) {
            const time = startTime + (beat * beatDuration);
            const beatInMeasure = beat % beatsPerMeasure;
            
            // Kick on beats 1 and 3
            if (beatInMeasure === 0 || beatInMeasure === 2) {
                this.synth.playDrum('kick', time);
                drumCount++;
            }
            
            // Snare on beats 2 and 4
            if (beatInMeasure === 1 || beatInMeasure === 3) {
                this.synth.playDrum('snare', time);
                drumCount++;
            }
            
            // Hi-hat on every eighth note
            this.synth.playDrum('hihat', time);
            this.synth.playDrum('hihat', time + beatDuration / 2);
            drumCount += 2;
        }
        
        return drumCount;
    }

   extractNotes(visualObj, secondsPerQuarterNote) {
  const notes = [];
  let currentTime = 0;

  const staff = visualObj.lines[0].staff[0];
  const keyMap = this.buildKeySignatureMap(staff);

  visualObj.lines.forEach(line => {
    line.staff?.forEach(staff => {
      staff.voices?.forEach(voice => {
        voice.forEach(element => {

          if (element.el_type === "note" && element.pitches) {
            const duration =
              (element.duration || 0.25) * secondsPerQuarterNote;

            element.pitches.forEach(pitch => {
              const midi = this.pitchToMidi(pitch, keyMap);
              const freq = this.midiToFreq(midi);

              notes.push({
                freq,
                time: currentTime,
                duration,
                midi
              });
            });

            currentTime += duration;

          } else if (element.el_type === "rest") {
            currentTime +=
              (element.duration || 0.25) * secondsPerQuarterNote;
          }

        });
      });
    });
  });

  console.log("First notes:", notes.slice(0, 5));
  return notes;
}

buildKeySignatureMap(staff) {
  const map = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  staff.keySignature?.accidentals?.forEach(acc => {
    const noteIndex = { C:0, D:1, E:2, F:3, G:4, A:5, B:6 }[acc.note];
    map[noteIndex] =
      acc.acc === "sharp" ? 1 :
      acc.acc === "flat"  ? -1 : 0;
  });

  return map;
}

pitchToMidi(pitch, keyMap) {
  const diatonicToChromatic = [0, 2, 4, 5, 7, 9, 11];

  const octave = Math.floor(pitch.pitch / 7);
  const noteIndex = pitch.pitch % 7;

  let accidental = keyMap[noteIndex] || 0;

  if (pitch.accidental === "sharp") accidental = 1;
  if (pitch.accidental === "flat") accidental = -1;
  if (pitch.accidental === "natural") accidental = 0;

  return 60 + octave * 12 + diatonicToChromatic[noteIndex] + accidental;
} 

    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    stop() {
        this.synth.stopAll();
    }
}
