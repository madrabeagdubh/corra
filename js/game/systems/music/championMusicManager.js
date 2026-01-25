// js/game/systems/music/championMusicManager.js

/**
 * Manages champion theme music during hero select
 * - Each champion has their own theme tune (banjo solo, first loop only)
 * - Smart crossfading prevents cacophony during swiping
 * - Quick fade-out for non-selected champions
 */

import AbcTradPlayer from './abcTradPlayer.js';
import { prepareTuneData } from './tradTuneConfig.js';
import { allTunes } from './allTunes.js';

class ChampionMusicManager {
    constructor() {
        this.currentPlayer = null;
        this.fadingPlayers = [];
        this.currentChampionId = null;
        this.isEnabled = true;

        this.fadeOutDuration = 800;
        this.fadeInDuration = 800;
        this.debounceTimer = null;

        this.masterGain = null;
        this.audioContext = null;
    }

    /**
     * Shared master gain (future-proofing)
     */
    getMasterGain() {
        if (!this.audioContext) {
            this.audioContext = window.sharedAudioContext;
        }

        if (!this.masterGain && this.audioContext) {
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 1;
            this.masterGain.connect(this.audioContext.destination);

            console.log('[ChampionMusic] Master gain created');
        }

        return this.masterGain;
    }

    /**
     * Play theme for a champion (debounced for swiping)
     */
    playChampionTheme(champion, immediate = false) {
        if (!this.isEnabled || !champion) return;

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        const playTheme = async () => {
            if (
                this.currentChampionId === champion.spriteKey &&
                this.currentPlayer?.getIsPlaying()
            ) {
                console.log('[ChampionMusic] Same champion, keeping current theme');
                return;
            }

            console.log(`[ChampionMusic] Playing theme for ${champion.nameGa}`);

            const tuneTitle = champion.themeTuneTitle || 'Kesh, The';
            const tuneKey = this.getTuneKeyFromTitle(tuneTitle);
            const abc = allTunes[tuneKey];

            if (!abc) {
                console.warn(`[ChampionMusic] No tune found for ${tuneTitle}`);
                return;
            }

            const tuneData = prepareTuneData(tuneTitle, abc, 'jig');

            // Only first loop (banjo solo)
            tuneData.progression = [tuneData.progression[0]];

            if (this.currentPlayer) {
                this.fadeOutPlayer(this.currentPlayer);
            }

            const newPlayer = new AbcTradPlayer();
            await newPlayer.init();
            await newPlayer.prepareTune(tuneData);

            newPlayer._loopTuneData = tuneData;
            newPlayer._championId = champion.spriteKey;

            newPlayer.onLoopChange = (loopIndex, progression) => {
                console.log(
                    `[ChampionMusic] Loop ${loopIndex}: ${progression.name}`
                );
            };

            await newPlayer.play();
            this.fadeInPlayer(newPlayer);
            this.setupSeamlessLoop(newPlayer);

            this.currentPlayer = newPlayer;
            this.currentChampionId = champion.spriteKey;
        };

        if (immediate) {
            playTheme();
        } else {
            this.debounceTimer = setTimeout(playTheme, 200);
        }
    }

    /**
     * Convert theme title → allTunes key
     */
    getTuneKeyFromTitle(title) {
        const cleaned = title.replace(/[,\.!?;:]/g, '').trim();

        const camelCase = cleaned
            .split(/\s+/)
            .map((word, i) =>
                i === 0
                    ? word.toLowerCase()
                    : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join('');

        if (allTunes[camelCase]) {
            return camelCase;
        }

        const normalized = title.toLowerCase().replace(/[^a-z]/g, '');
        const match = Object.keys(allTunes).find(key => {
            const k = key.toLowerCase().replace(/[^a-z]/g, '');
            return k.includes(normalized) || normalized.includes(k);
        });

        if (match) {
            console.log(`[ChampionMusic] Fallback match: ${match}`);
            return match;
        }

        console.warn(`[ChampionMusic] No match for "${title}", using default`);
        return 'keshThe';
    }

    /**
     * Seamless looping (poll-based)
     */
    setupSeamlessLoop(player) {
        if (!player || !player._loopTuneData) return;

        const interval = setInterval(async () => {
            if (player !== this.currentPlayer || !this.isEnabled) {
                clearInterval(interval);
                return;
            }

            if (!player.getIsPlaying()) {
                try {
                    await player.prepareTune(player._loopTuneData);
                    await player.play();
                } catch (err) {
                    console.warn('[ChampionMusic] Loop restart failed', err);
                    clearInterval(interval);
                }
            }
        }, 100);

        player._loopInterval = interval;
    }

    /**
     * Fade out old player
     */
    fadeOutPlayer(player) {
        if (!player) return;

        if (player._loopInterval) {
            clearInterval(player._loopInterval);
            player._loopInterval = null;
        }

        this.fadingPlayers.push(player);

        setTimeout(async () => {
            await player.stop();
            const i = this.fadingPlayers.indexOf(player);
            if (i !== -1) this.fadingPlayers.splice(i, 1);
        }, this.fadeOutDuration);
    }

    /**
     * Fade in (logical placeholder)
     */
    fadeInPlayer(player) {
        if (!player) return;
        player._fadeInStart = Date.now();
    }

    /**
     * Stop everything
     */
    async stopAll() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        if (this.currentPlayer) {
            if (this.currentPlayer._loopInterval) {
                clearInterval(this.currentPlayer._loopInterval);
            }
            await this.currentPlayer.stop();
            this.currentPlayer = null;
        }

        for (const player of this.fadingPlayers) {
            if (player._loopInterval) {
                clearInterval(player._loopInterval);
            }
            await player.stop();
        }

        this.fadingPlayers = [];
        this.currentChampionId = null;
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.stopAll();
        }
    }

    destroy() {
        this.stopAll();
    }
}

export const championMusicManager = new ChampionMusicManager();
