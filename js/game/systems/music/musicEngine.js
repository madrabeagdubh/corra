export default class MusicEngine {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
    }

    /**
     * Creates a gain node for an individual instrument
     */
    createTrackGain() {
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = 0; // Start silent
        gainNode.connect(this.masterGain);
        return gainNode;
    }

    /**
     * Smoothly transitions volume using an exponential ramp
     */
    applyFade(gainNode, targetVol, duration = 0.5) {
        const now = this.ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        // We use duration/3 as the time constant for a natural curve
        gainNode.gain.setTargetAtTime(targetVol, now, duration / 3);
    }

    /**
     * Internal Beep Test: Bypasses ABC/MIDI to test raw speakers
     */
    testBeep() {
        const osc = this.ctx.createOscillator();
        const beepGain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime); // A4 note

        osc.connect(beepGain);
        beepGain.connect(this.masterGain);

        beepGain.gain.setValueAtTime(0, this.ctx.currentTime);
        beepGain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.1);
        beepGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1);

        osc.start();
        osc.stop(this.ctx.currentTime + 1);
        console.log("[MusicEngine] Raw oscillator beep triggered.");
    }
}

