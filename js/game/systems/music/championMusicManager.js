// js/game/systems/music/championMusicManager.js

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
        this.fadeInDuration = 1500;
        this.debounceTimer = null;

        this.masterGain = null;
        this.audioContext = null;
    }


setVolume(volume) {
    if (this.masterGain) {
        this.masterGain.gain.value = volume;
    }
}


    /**
     * Connects to the context unlocked by your UI slider.
     * Most crucial part: It prevents the manager from creating its own "locked" context.
     */
    initContext() {
        if (!this.audioContext) {
            this.audioContext = window.sharedAudioContext;
        }

        if (this.audioContext && !this.masterGain) {
            // Check if context is suspended (safety check)
            if (this.audioContext.state === 'suspended') {
                console.warn('[ChampionMusic] Context still suspended. Attempting resume...');
                this.audioContext.resume();
            }

            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 1.0;
            this.masterGain.connect(this.audioContext.destination);
            console.log('[ChampionMusic] Master gain linked and active.');
        }
        return this.audioContext;
    }

    async playChampionTheme(champion, immediate = false) {
        if (!this.isEnabled || !champion) return;

        this.initContext();

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        const playTheme = async () => {
            if (this.currentChampionId === champion.spriteKey && this.currentPlayer?.getIsPlaying()) {
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
            tuneData.progression = [tuneData.progression[0]]; // Solo first loop

            if (this.currentPlayer) {
                this.fadeOutPlayer(this.currentPlayer);
            }

            const newPlayer = new AbcTradPlayer();
            
            /** * IMPORTANT: You must modify your AbcTradPlayer.js init() 
             * to accept an existing context. 
             */
            await newPlayer.init(this.audioContext); 
            await newPlayer.prepareTune(tuneData);

            newPlayer._loopTuneData = tuneData;
            newPlayer._championId = champion.spriteKey;

            await newPlayer.play();
            
            // Start silent and fade in
            this.applyVolumeFade(newPlayer, 0, 1, this.fadeInDuration);

            this.currentPlayer = newPlayer;
            this.currentChampionId = champion.spriteKey;
            this.setupSeamlessLoop(newPlayer);
        };

        if (immediate) playTheme();
        else this.debounceTimer = setTimeout(playTheme, 200);
    }

    applyVolumeFade(player, startVol, endVol, duration) {
        if (!player || !player.setVolume) {
            console.warn('[ChampionMusic] Player missing setVolume method');
            return;
        }
        
        const startTime = Date.now();
        player.setVolume(startVol);

        const tick = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Linear fade (good for ambiance)
            const currentVol = startVol + (endVol - startVol) * progress;
            player.setVolume(currentVol);

            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    getTuneKeyFromTitle(title) {
        const cleaned = title.replace(/[,\.!?;:]/g, '').trim();
        const camelCase = cleaned
            .split(/\s+/)
            .map((word, i) =>
                i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join('');

        if (allTunes[camelCase]) return camelCase;

        const normalized = title.toLowerCase().replace(/[^a-z]/g, '');
        const match = Object.keys(allTunes).find(key => {
            const k = key.toLowerCase().replace(/[^a-z]/g, '');
            return k.includes(normalized) || normalized.includes(k);
        });

        return match || 'keshThe';
    }

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
                    if (player.setVolume) player.setVolume(1.0);
                } catch (err) {
                    console.warn('[ChampionMusic] Loop restart failed', err);
                    clearInterval(interval);
                }
            }
        }, 100);

        player._loopInterval = interval;
    }

    fadeOutPlayer(player) {
        if (!player) return;
        if (player._loopInterval) {
            clearInterval(player._loopInterval);
            player._loopInterval = null;
        }

        this.fadingPlayers.push(player);
        this.applyVolumeFade(player, 1, 0, this.fadeOutDuration);

        setTimeout(async () => {
            await player.stop();
            const i = this.fadingPlayers.indexOf(player);
            if (i !== -1) this.fadingPlayers.splice(i, 1);
        }, this.fadeOutDuration);
    }

    async stopAll() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        if (this.currentPlayer) {
            if (this.currentPlayer._loopInterval) clearInterval(this.currentPlayer._loopInterval);
            await this.currentPlayer.stop();
            this.currentPlayer = null;
        }
        for (const player of this.fadingPlayers) {
            await player.stop();
        }
        this.fadingPlayers = [];
        this.currentChampionId = null;
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) this.stopAll();
    }
}

export const championMusicManager = new ChampionMusicManager();

