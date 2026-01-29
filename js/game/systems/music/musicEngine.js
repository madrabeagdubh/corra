// Music Engine v2.0 - Spatial Audio
export default class MusicEngine {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;
        this.masterGain.connect(this.ctx.destination);
    }

    createTrackGain() {
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = 0;
        gainNode.connect(this.masterGain);
        return gainNode;
    }
    
    createTrackGainWithPanning(patchId) {
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = 0; // Start silent
        
        // Create stereo panner for spatial separation
        const panner = this.ctx.createStereoPanner();
        
        // Store the target volume for when we fade in
        let targetVolume = 1.0;
        
        // Position instruments in stereo field
        if (patchId === 105) {
            // Banjo: Center-left (lead instrument)
            panner.pan.value = -0.2;
            targetVolume = 0.9;
        } else if (patchId === 0) {
            // Piano: Center-right (accompaniment)
            panner.pan.value = 0.3;
            targetVolume = 0.7;
        } else if (patchId === 46) {
            // Harp: Far right (shimmer)
            panner.pan.value = 0.6;
            targetVolume = 0.85;
        } else if (patchId === 32) {
            // Bass: Center (foundation)
            panner.pan.value = 0;
            targetVolume = 0.7;
        } else if (patchId === 21) {
            // Accordion: Left
            panner.pan.value = -0.4;
            targetVolume = 0.75;
        } else if (patchId === 22) {
            // Harmonica: Slight left (concertina-like)
            panner.pan.value = -0.3;
            targetVolume = 0.85; // Boost to cut through
        } else if (patchId === 23) {
            // Tango Accordion: Left
            panner.pan.value = -0.35;
            targetVolume = 0.8;
        } else if (patchId === 57) {
            // Trombone: Center-right (power!)
            panner.pan.value = 0.25;
            targetVolume = 0.85;
        } else if (patchId === 58) {
            // Tuba: Dead center (deep foundation)
            panner.pan.value = 0;
            targetVolume = 0.75;
        } else if (patchId === 60) {
            // French Horn: Left (warm and noble)
            panner.pan.value = -0.35;
            targetVolume = 0.8;
        } else if (patchId === 66) {
            // Tenor Sax: Right (jazzy surprise)
            panner.pan.value = 0.4;
            targetVolume = 0.85;
        }
        
        // Connect: gain -> panner -> master
        gainNode.connect(panner);
        panner.connect(this.masterGain);
        
        // Store target volume as a custom property for later use
        gainNode.targetVolume = targetVolume;
        
        return gainNode;
    }

    applyFade(gainNode, targetVol, duration = 0.5) {
        const now = this.ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        
        const safeTarget = targetVol < 0.0001 ? 0.0001 : targetVol;
        const safeStart = gainNode.gain.value < 0.0001 ? 0.0001 : gainNode.gain.value;
        
        gainNode.gain.setValueAtTime(safeStart, now);
        gainNode.gain.exponentialRampToValueAtTime(safeTarget, now + duration);
    }

    testBeep() {
        const osc = this.ctx.createOscillator();
        const beepGain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);

        osc.connect(beepGain);
        beepGain.connect(this.masterGain);

        beepGain.gain.setValueAtTime(0, this.ctx.currentTime);
        beepGain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.1);
        beepGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1);

        osc.start();
        osc.stop(this.ctx.currentTime + 1);
        console.log("[Test Beep] 440Hz");
    }
}

