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
        this.fadeOutDuration = 800; // ms for smooth crossfade
        this.fadeInDuration = 800; // ms for smooth fade-in
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
            const tuneTitle = champion.themeTuneTitle || 'Kesh, The'; // Default fallback
            const tuneKey = this.getTuneKeyFromTitle(tuneTitle);
            const abc = allTunes[tuneKey];

            if (!abc) {
                console.warn(`[ChampionMusic] No tune found for ${tuneTitle} (tried key: ${tuneKey})`);
                return;
            }

            console.log(`[ChampionMusic] Using tune key: ${tuneKey}`);

            // Prepare ONLY the first loop of a jig (banjo solo)
            const tuneData = prepareTuneData(tuneTitle, abc, 'jig');

            // Modify to play ONLY the first loop (banjo solo) but make it loop
            tuneData.progression = [tuneData.progression[0]]; // Just the first loop

            // Fade out current player (crossfade)
            if (this.currentPlayer) {
                this.fadeOutPlayer(this.currentPlayer);
            }

            // Create new player
            const newPlayer = new AbcTradPlayer();
            await newPlayer.init();
            await newPlayer.prepareTune(tuneData);

            // Store reference to tuneData for looping
            newPlayer._loopTuneData = tuneData;
            newPlayer._championId = champion.spriteKey;

            // Set up looping callback - restart the same tune when it ends
            newPlayer.onLoopChange = (loopIndex, progression) => {
                console.log(`[ChampionMusic] Loop ${loopIndex}: ${progression.name}`);
            };

            // Start playback with fade-in
            await newPlayer.play();
            this.fadeInPlayer(newPlayer);

            // Set up seamless looping - when the tune ends, restart it immediately
            this.setupSeamlessLoop(newPlayer);

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
        // Remove punctuation and convert "Kesh, The" -> "Kesh The" -> "keshThe"
        const cleaned = title
            .replace(/[,\.!?;:]/g, '') // Remove all punctuation
            .trim();
        
        const camelCase = cleaned
            .split(/\s+/) // Split on whitespace
            .map((word, i) => {
                if (i === 0) return word.toLowerCase();
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join('');

        console.log(`[ChampionMusic] Title "${title}" -> key "${camelCase}"`);

        // Check if exists
        if (allTunes[camelCase]) {
            return camelCase;
        }

        // Fallback: find by partial match (case-insensitive, no spaces)
        const keys = Object.keys(allTunes);
        const normalized = title.toLowerCase().replace(/[^a-z]/g, '');
        const match = keys.find(key =>
            key.toLowerCase().replace(/[^a-z]/g, '').includes(normalized) ||
            normalized.includes(key.toLowerCase().replace(/[^a-z]/g, ''))
        );

        if (match) {
            console.log(`[ChampionMusic] Found fallback match: ${match}`);
            return match;
        }

        console.warn(`[ChampionMusic] No match found for "${title}", using default`);
        return 'keshThe'; // Ultimate fallback
    }

    /**
     * Set up seamless looping for a player
     */
    setupSeamlessLoop(player) {
        if (!player || !player._loopTuneData) return;

        // Listen for when playback ends
        const checkAndLoop = setInterval(async () => {
            // Stop checking if this player is no longer current
            if (player !== this.currentPlayer || !this.isEnabled) {
                clearInterval(checkAndLoop);
                return;
            }

            // If player stopped playing, restart it
            if (!player.getIsPlaying()) {
                console.log('[ChampionMusic] Restarting loop seamlessly');
                try {
                    await player.prepareTune(player._loopTuneData);
                    await player.play();
                } catch (err) {
                    console.warn('[ChampionMusic] Loop restart failed:', err);
                    clearInterval(checkAndLoop);
                }
            }
        }, 100); // Check every 100ms

        // Store the interval so we can clear it later
        player._loopInterval = checkAndLoop;
    }

    /**
     * Fade out a player (for when switching champions)
     */
    fadeOutPlayer(player) {
        if (!player) return;

        console.log('[ChampionMusic] Fading out previous player');

        // Clear any loop interval
        if (player._loopInterval) {
            clearInterval(player._loopInterval);
            player._loopInterval = null;
        }

        this.fadingPlayers.push(player);

        // Create a gain node for smooth fade out
        if (player.audioContext) {
            try {
                // We need to connect the synth output through a gain node
                // Since abcjs doesn't expose this directly, we'll use a timer-based volume fade
                const startTime = Date.now();
                const fadeInterval = setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / this.fadeOutDuration, 1);
                    const volume = 1 - progress;

                    // abcjs synth doesn't have direct volume control, so we'll just stop after fade duration
                    if (progress >= 1) {
                        clearInterval(fadeInterval);
                        player.stop().then(() => {
                            const index = this.fadingPlayers.indexOf(player);
                            if (index > -1) {
                                this.fadingPlayers.splice(index, 1);
                            }
                        });
                    }
                }, 50);
            } catch (e) {
                console.warn('[ChampionMusic] Fade-out error:', e);
                // Fallback: just stop after duration
                setTimeout(async () => {
                    await player.stop();
                    const index = this.fadingPlayers.indexOf(player);
                    if (index > -1) {
                        this.fadingPlayers.splice(index, 1);
                    }
                }, this.fadeOutDuration);
            }
        } else {
            // Fallback: stop after fade duration
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
        if (!player || !player.audioContext) return;

        console.log('[ChampionMusic] Fading in new player');

        // Similar to fade out, we don't have direct volume control
        // But the crossfade effect comes from the overlap of old fading out + new starting
        // The new player just starts at normal volume
        
        // Store start time for potential future volume adjustments
        player._fadeInStart = Date.now();
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
