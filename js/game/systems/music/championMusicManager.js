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
        this.fadeOutDuration = 300; // ms for quick fade
        this.debounceTimer = null;
    }

    /**
     * Play theme for a champion (debounced to handle rapid swiping)
     */
    playChampionTheme(champion, immediate = false) {
        if (!this.isEnabled || !champion) return;

        // Clear any pending theme changes
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        const playTheme = async () => {
            // Don't restart if same champion
            if (this.currentChampionId === champion.spriteKey && this.currentPlayer?.getIsPlaying()) {
                console.log('[ChampionMusic] Same champion, keeping current theme');
                return;
            }

            console.log(`[ChampionMusic] Playing theme for ${champion.nameGa}`);

            // Get the tune for this champion
            const tuneTitle = champion.themeTuneTitle || 'keshThe'; // Default fallback
            const tuneKey = this.getTuneKeyFromTitle(tuneTitle);
            const abc = allTunes[tuneKey];

            if (!abc) {
                console.warn(`[ChampionMusic] No tune found for ${tuneTitle}`);
                return;
            }

            // Prepare ONLY the first loop of a jig (banjo solo)
            const tuneData = prepareTuneData(tuneTitle, abc, 'jig');
            
            // Modify to play ONLY the first loop (banjo solo)
            tuneData.progression = [tuneData.progression[0]]; // Just the first loop

            // Fade out current player
            if (this.currentPlayer) {
                this.fadeOutPlayer(this.currentPlayer);
            }

            // Create new player
            const newPlayer = new AbcTradPlayer();
            await newPlayer.init();
            await newPlayer.prepareTune(tuneData);
            
            // Set up looping callback - restart the same tune when it ends
            newPlayer.onLoopChange = (loopIndex, progression) => {
                console.log(`[ChampionMusic] Loop ${loopIndex}: ${progression.name}`);
                
                // After first loop completes, restart from beginning
                if (loopIndex === 0 && newPlayer === this.currentPlayer) {
                    setTimeout(async () => {
                        if (newPlayer === this.currentPlayer && this.isEnabled) {
                            await newPlayer.stop();
                            await newPlayer.prepareTune(tuneData);
                            await newPlayer.play();
                        }
                    }, 500); // Small gap before restart
                }
            };

            // Start playback with fade-in
            await newPlayer.play();
            this.fadeInPlayer(newPlayer);

            this.currentPlayer = newPlayer;
            this.currentChampionId = champion.spriteKey;
        };

        // Debounce for smooth swiping, or play immediately on initial load
        if (immediate) {
            playTheme();
        } else {
            this.debounceTimer = setTimeout(playTheme, 200);
        }
    }

    /**
     * Convert theme title to tune key in allTunes
     */
    getTuneKeyFromTitle(title) {
        // Convert "Drowsy Maggie" to "drowsyMaggie" format
        const camelCase = title
            .split(' ')
            .map((word, i) => {
                if (i === 0) return word.toLowerCase();
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join('');

        // Check if exists, otherwise try to find close match
        if (allTunes[camelCase]) {
            return camelCase;
        }

        // Fallback: find by partial match
        const keys = Object.keys(allTunes);
        const match = keys.find(key => 
            key.toLowerCase().includes(title.toLowerCase().replace(/\s+/g, ''))
        );

        return match || 'keshThe'; // Ultimate fallback
    }

    /**
     * Fade out a player (for when switching champions)
     */
    fadeOutPlayer(player) {
        if (!player) return;

        this.fadingPlayers.push(player);

        // Quick fade using AudioContext
        if (player.audioContext && player.synth) {
            const gainNode = player.audioContext.createGain();
            gainNode.gain.setValueAtTime(1, player.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, player.audioContext.currentTime + this.fadeOutDuration / 1000);

            setTimeout(async () => {
                await player.stop();
                const index = this.fadingPlayers.indexOf(player);
                if (index > -1) {
                    this.fadingPlayers.splice(index, 1);
                }
            }, this.fadeOutDuration);
        } else {
            // Fallback: just stop immediately
            setTimeout(async () => {
                await player.stop();
                const index = this.fadingPlayers.indexOf(player);
                if (index > -1) {
                    this.fadingPlayers.splice(index, 1);
                }
            }, this.fadeOutDuration);
        }
    }

    /**
     * Fade in a new player (smooth entrance)
     */
    fadeInPlayer(player) {
        if (!player || !player.audioContext || !player.synth) return;

        try {
            const gainNode = player.audioContext.createGain();
            gainNode.gain.setValueAtTime(0, player.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(1, player.audioContext.currentTime + 0.3);
        } catch (e) {
            console.warn('[ChampionMusic] Fade-in not supported:', e);
        }
    }

    /**
     * Stop all music (when leaving hero select)
     */
    async stopAll() {
        console.log('[ChampionMusic] Stopping all music');
        
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        if (this.currentPlayer) {
            await this.currentPlayer.stop();
            this.currentPlayer = null;
        }

        for (const player of this.fadingPlayers) {
            await player.stop();
        }
        this.fadingPlayers = [];
        this.currentChampionId = null;
    }

    /**
     * Enable/disable music
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.stopAll();
        }
    }

    /**
     * Clean up on destroy
     */
    destroy() {
        this.stopAll();
    }
}

// Export singleton instance
export const championMusicManager = new ChampionMusicManager();
