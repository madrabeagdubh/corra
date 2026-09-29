// championDance.js
//
// The champions' little dance: one hop per beat of their own theme tune,
// turning to face the other way on each landing. Driven from JS (not a CSS
// keyframe) so the turn happens in a single frame and never flickers.
//
//   hopMsForTuneKey(key)      -> ms per hop for a tune in allTunes
//   hopMsForTuneType(type)    -> ms per hop for 'reel', 'jig', ...
//   danceTransform(ms, hopMs) -> CSS transform for that moment
//   musicClockFor(player)     -> ms since the playing tune started (or null)

import { allTunes } from '../systems/music/allTunes.js';
import { TEMPO_SETTINGS } from '../systems/music/tradSessionPlayerScheduled.js';

// Felt beats per bar: reels, jigs, hornpipes and polkas are danced in two,
// slip jigs and waltzes in three.
const BEATS_PER_BAR = { slipjig: 3, waltz: 3 };
const HOP_MIN_MS = 420;
const HOP_MAX_MS = 950;
const HOP_HEIGHT = 12;   // px

export function hopMsForTuneType(tuneType) {
    const barMs = TEMPO_SETTINGS[tuneType] || TEMPO_SETTINGS.defaultTempo;
    let hop = barMs / (BEATS_PER_BAR[tuneType] || 2);
    // Keep it danceable: halve or double into a comfortable range.
    while (hop > HOP_MAX_MS) hop /= 2;
    while (hop < HOP_MIN_MS) hop *= 2;
    return hop;
}

// Same R: parsing as TradSessionPlayer.loadTune.
export function tuneTypeForKey(tuneKey) {
    const data = tuneKey && allTunes[tuneKey];
    const abc  = typeof data === 'string' ? data : data?.abc;
    const m    = abc?.match(/^R:\s*(.+)$/m);
    return m ? m[1].trim().toLowerCase().replace(/\s+/g, '') : 'reel';
}

export function hopMsForTuneKey(tuneKey) {
    return hopMsForTuneType(tuneTypeForKey(tuneKey));
}

export function danceTransform(ms, hopMs) {
    const beats  = ms / hopMs;
    const hopIdx = Math.floor(beats);
    const arc    = Math.sin(Math.PI * (beats - hopIdx));   // 0 → 1 → 0
    const face   = (hopIdx & 1) ? -1 : 1;                  // turns on each landing
    return `translateY(${-HOP_HEIGHT * arc}px) rotate(${3 * face * arc}deg) `
         + `scale(${face * (1 - 0.1 * arc)}, ${1 + 0.15 * arc})`;
}

export function musicClockFor(player) {
    if (!player?.isPlaying || !player.audioContext || typeof player.scheduledStartTime !== 'number') return null;
    return (player.audioContext.currentTime - player.scheduledStartTime) * 1000;
}
