// Music Engine v2.2 - Spatial Audio
export class MusicEngine {
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
        gainNode.gain.value = 0;

        const panner = this.ctx.createStereoPanner();

        let targetVolume = 1.0;

        if (patchId === 114) {
            // Steel Drums: centre — melody lead
            panner.pan.value = 0;
            targetVolume = 0.85;
        } else if (patchId === 105) {
            // Banjo: slight left
            panner.pan.value = -0.2;
            targetVolume = 0.8;
        } else if (patchId === 53) {
            // Voice Oohs: slight right
            panner.pan.value = 0.2;
            targetVolume = 0.7;
        } else if (patchId === 92) {
            // Pad Bowed: wide left — ambient bed
            panner.pan.value = -0.5;
            targetVolume = 0.55;
        } else if (patchId === 94) {
            // Pad Halo: wide right
            panner.pan.value = 0.5;
            targetVolume = 0.45;
        } else if (patchId === 70) {
            // Bassoon: centre-left — like someone standing nearby
            panner.pan.value = -0.15;
            targetVolume = 0.65;
        } else if (patchId === 0) {
            // Piano: centre-right
            panner.pan.value = 0.3;
            targetVolume = 0.7;
        } else if (patchId === 32) {
            // Acoustic Bass: centre
            panner.pan.value = 0;
            targetVolume = 0.75;
        } else if (patchId === 22) {
            // Harmonica: slight left
            panner.pan.value = -0.3;
            targetVolume = 0.85;
        } else if (patchId === 46) {
            // Harp: centre-right
            panner.pan.value = 0.25;
            targetVolume = 0.9;
        } else {
            panner.pan.value = 0;
            targetVolume = 0.8;
        }

        gainNode.connect(panner);
        panner.connect(this.masterGain);
        gainNode.targetVolume = targetVolume;

        return gainNode;
    }

    applyFade(gainNode, targetVol, duration = 0.5) {
        const now = this.ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);

        const safeTarget = targetVol < 0.0001 ? 0.0001 : targetVol;
        const safeStart  = gainNode.gain.value < 0.0001 ? 0.0001 : gainNode.gain.value;

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
        console.log('[Test Beep] 440Hz');
    }
}

