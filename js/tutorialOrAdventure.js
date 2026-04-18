// tutorialOrAdventure.js

import { initReturnCrossing } from './game/scenes/returnCrossing.js';
import { initDawnCrossing }   from './game/scenes/dawnCrossing.js';
import { FONTS, COLORS, TYPE, BUTTON, createDomButton } from './game/systems/gameTypography.js';
import { GameSettings }         from './game/settings/gameSettings.js';
import { createMoonWidget }     from './game/ui/moonWidget.js';

const _state = {
    currentAmerginLine: null,
    initialized:        false,
};

export function setCurrentAmerginLine(line) {
    _state.currentAmerginLine = line;
}

// ---------------------------------------------
// SPINNING STARFIELD
// ---------------------------------------------
function createStarfield() {
    const sfCanvas = document.createElement('canvas');
    sfCanvas.id = 'tutorialStarfield';
    sfCanvas.style.cssText = `
        position:fixed;top:0;left:0;
        width:100%;height:100%;
        z-index:100000;pointer-events:none;
    `;
    document.body.appendChild(sfCanvas);
    sfCanvas.width  = window.innerWidth;
    sfCanvas.height = window.innerHeight;

    const ctx = sfCanvas.getContext('2d');
    let rafId = null;

    function makeStar(scatter) {
        return {
            angle:      Math.random() * Math.PI * 2,
            depth:      scatter ? Math.random() * (sfCanvas.width * 0.5) : sfCanvas.width * 0.5,
            speed:      Math.random() * 1.5 + 0.5,
            size:       Math.random() * 1.5 + 0.5,
            brightness: Math.random() * 0.6 + 0.4,
        };
    }

    const stars = Array.from({ length: 200 }, () => makeStar(true));

    function loop() {
        ctx.clearRect(0, 0, sfCanvas.width, sfCanvas.height);
        for (const s of stars) {
            s.depth -= s.speed;
            if (s.depth <= 0) { Object.assign(s, makeStar(false)); continue; }
            const cx    = sfCanvas.width  / 2;
            const cy    = sfCanvas.height / 2;
            const scale = (sfCanvas.width * 0.5) / s.depth;
            const x     = cx + Math.cos(s.angle) * scale * 100;
            const y     = cy + Math.sin(s.angle) * scale * 100;
            if (x < -20 || x > sfCanvas.width + 20 || y < -20 || y > sfCanvas.height + 20) {
                Object.assign(s, makeStar(false)); continue;
            }
            ctx.beginPath();
            ctx.arc(x, y, Math.max(0.3, s.size * scale * 0.8), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(212,175,55,${s.brightness * Math.min(1, scale * 0.4)})`;
            ctx.fill();
        }
        rafId = requestAnimationFrame(loop);
    }
    loop();

    return function stop() {
        if (rafId) cancelAnimationFrame(rafId);
        sfCanvas.remove();
    };
}

// ---------------------------------------------
// MAIN ENTRY POINT
// ---------------------------------------------
export function initTutorialOrAdventure(champion, sliderValue = 0.15, amerginLine = null) {
    if (_state.initialized) return;
    _state.initialized = true;
    let _responseRevealed = false;

    GameSettings.setEnglishOpacity(
        typeof sliderValue === 'number' ? sliderValue : GameSettings.englishOpacity
    );

    if (amerginLine) _state.currentAmerginLine = amerginLine;

    console.log('[TutorialOrAdventure] Initializing with champion:', champion.nameEn);

    // Unmute all instruments
    (async () => {
        try {
            const mod = await import('./heroSelect.js');
            const mp  = mod.getMusicPlayer?.();
            if (mp?.tracks) {
                for (let i = 0; i < mp.tracks.length; i++) {
                    if (mp.tracks[i] && !mp.tracks[i].active) await mp.toggleInstrument(i);
                }
            }
        } catch(e) { console.error('[TutorialOrAdventure] Unmute error:', e); }
    })();

    // Boogie keyframes
    if (!document.getElementById('tutorialBoogieStyle')) {
        const s = document.createElement('style');
        s.id = 'tutorialBoogieStyle';
        s.textContent = `
            @keyframes championBoogie {
                0%,  24.9% { transform:translateY(0px)   scale( 1,   1);                  }
                12.5%      { transform:translateY(-12px) scale( 0.9, 1.15) rotate( 3deg); }
                25%, 49.9% { transform:translateY(0px)   scale(-1,   1);                  }
                37.5%      { transform:translateY(-12px) scale(-0.9, 1.15) rotate(-3deg); }
                50%, 74.9% { transform:translateY(0px)   scale( 1,   1);                  }
                62.5%      { transform:translateY(-12px) scale( 0.9, 1.15) rotate( 3deg); }
                75%, 99.9% { transform:translateY(0px)   scale(-1,   1);                  }
                87.5%      { transform:translateY(-12px) scale(-0.9, 1.15) rotate(-3deg); }
                100%       { transform:translateY(0px)   scale( 1,   1);                  }
            }
            .tutorial-champion-canvas {
                animation:championBoogie 2s linear infinite;
                transform-origin:bottom center;
            }
        `;
        document.head.appendChild(s);
    }

    // Black background
    const blackBg = document.createElement('div');
    blackBg.id = 'tutorialBlackBg';
    blackBg.style.cssText = `
        position:fixed;inset:0;background:#000;
        z-index:99999;pointer-events:none;
    `;
    document.body.appendChild(blackBg);

    let stopStarfield = createStarfield();

    // UI container
    const uiContainer = document.createElement('div');
    uiContainer.id = 'championIntro';
    uiContainer.style.cssText = `
        position:fixed;inset:0;background:transparent;
        z-index:100001;display:flex;flex-direction:column;
        align-items:center;height:100%;
        box-sizing:border-box;overflow:hidden;
    `;

    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
        text-align:center;max-width:800px;width:100%;
        padding:0 1.5rem 0.5rem 1.5rem;
        margin-top:7rem;
        flex-shrink:0;box-sizing:border-box;
    `;

    const displayLine = _state.currentAmerginLine || {
        ga: 'Cé an té le nod slí na gcloch sléibhe?',
        en: 'Who knows the way of the mountain stones?',
    };

    const irishTextEl = document.createElement('div');
    irishTextEl.textContent = displayLine.ga;
    irishTextEl.style.cssText = `
        font-family:${FONTS.irish};
        font-size:1.8rem;color:${COLORS.speaker};
        margin-bottom:0.5rem;line-height:1.5;
    `;
    textContainer.appendChild(irishTextEl);

    // -- Champion area --
    const championHolder = document.createElement('div');
    championHolder.style.cssText = `
        flex:1;width:100%;min-height:0;
        display:flex;flex-direction:column;
        justify-content:center;align-items:center;
        gap:1rem;
        overflow:hidden;padding:0.5rem 1.5rem;box-sizing:border-box;
    `;

    const responseIrish = document.createElement('div');
    responseIrish.textContent = 'Cé murach mise.';
    responseIrish.style.cssText = `
        font-family:${FONTS.irish};
        font-size:1.8rem;color:${COLORS.speaker};
        line-height:1.5;text-align:center;
        max-width:800px;width:100%;
        opacity:0;transition:opacity 0.5s ease;
        pointer-events:none;
    `;

    const championCanvas = document.createElement('canvas');
    championCanvas.className = 'tutorial-champion-canvas';
    championCanvas.style.cssText = `
        display:block !important;
        max-width:85%;max-height:25vh;
        object-fit:contain;
        image-rendering:pixelated;
        image-rendering:-moz-crisp-edges;
        image-rendering:crisp-edges;
        filter:drop-shadow(0 10px 20px rgba(0,0,0,0.5));
        margin-bottom:20px;
    `;

    const responseEnglish = document.createElement('div');
    responseEnglish.textContent = 'Who, if not I.';
    responseEnglish.style.cssText = `
        font-family:${FONTS.english};
        font-size:1.7rem;color:${COLORS.english};
        opacity:0;transition:opacity 0.3s ease;line-height:1.5;
        pointer-events:none;
        text-align:center;max-width:800px;width:100%;
        max-height:0;overflow:hidden;
    `;

    // Append response elements
    textContainer.appendChild(responseIrish);
    textContainer.appendChild(responseEnglish);

    championHolder.appendChild(championCanvas);

    // Load sprite
    (async function loadSprite() {
        try {
            const atlas = await fetch('assets/champions/champions0.json').then(r => r.json());
            const sheet = await new Promise((res, rej) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload  = () => res(img);
                img.onerror = rej;
                img.src = 'assets/champions/champions0.png';
            });
            const frameName = champion.spriteKey.endsWith('.png') ? champion.spriteKey : `${champion.spriteKey}.png`;
            const frame = atlas.textures[0].frames.find(f => f.filename === frameName);
            if (!frame) { console.error('[TutorialOrAdventure] Frame not found:', frameName); return; }
            championCanvas.width  = frame.frame.w;
            championCanvas.height = frame.frame.h;
            const c = championCanvas.getContext('2d');
            c.imageSmoothingEnabled = false;
            c.drawImage(sheet, frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h, 0, 0, frame.frame.w, frame.frame.h);
        } catch(e) {
            console.error('[TutorialOrAdventure] Sprite load failed:', e);
        }
    })();

    // -- Buttons --
    const bottomSection = document.createElement('div');
    bottomSection.style.cssText = `
        width:100%;max-width:800px;
        display:flex;flex-direction:column;
        gap:${BUTTON.gap}px;
        padding:1rem;
        box-sizing:border-box;flex-shrink:0;
        transition:opacity 0.6s ease;
    `;

    // Use createDomButton from gameTypography for consistent styling across the game.
    // Language switches at the 0.5 moon threshold via applyLanguage(opacity).
    function cleanupHeroSelect() {
        document.getElementById('heroSelect')?.remove();
        document.getElementById('global-stats-bar')?.remove();
        document.getElementById('statPopup')?.remove();
        document.getElementById('sunSliderStyle')?.remove();
        document.getElementById('statPopupStyle')?.remove();
    }

    async function showResponseAndProceed(callback) {
        responseIrish.style.pointerEvents   = 'auto';
        responseEnglish.style.pointerEvents = 'auto';
        responseIrish.style.opacity          = '1';
        _responseRevealed = true;
        responseEnglish.style.maxHeight = '10rem';
        responseEnglish.style.opacity   = String(GameSettings.englishOpacity);
        bottomSection.style.opacity       = '0';
        bottomSection.style.pointerEvents = 'none';
        await new Promise(r => setTimeout(r, 2000));

        // Fade music
        try {
            const heroSelect = await import('./heroSelect.js');
            const mp = heroSelect.getMusicPlayer?.();
            if (mp?.tracks) {
                for (let i = 0; i < mp.tracks.length; i++) {
                    const t = mp.tracks[i];
                    if (t && typeof t.active !== 'undefined' && !t.active) await mp.toggleInstrument(i);
                }
                const t0 = mp.audioContext.currentTime;
                for (const track of mp.tracks) {
                    if (track?.active && track.gain) track.gain.gain.setTargetAtTime(0, t0, 0.6);
                }
            }
        } catch(e) { console.error('[TutorialOrAdventure] Music fade error:', e); }

        const blackOverlay = document.createElement('div');
        blackOverlay.style.cssText = `
            position:fixed;inset:0;background:#000;opacity:0;
            z-index:200000;transition:opacity 2s ease;pointer-events:none;
        `;
        document.body.appendChild(blackOverlay);

        setTimeout(() => {
            [textContainer, championHolder].forEach(el => {
                el.style.transition = 'opacity 1s ease'; el.style.opacity = '0';
            });
            blackOverlay.style.opacity = '1';
        }, 100);

        if (stopStarfield) { stopStarfield(); stopStarfield = null; }
        moonWidget.destroy();
        blackBg.style.transition = 'opacity 1s ease'; blackBg.style.opacity = '0';

        await new Promise(r => setTimeout(r, 2500));

        blackOverlay.remove();
        blackBg.remove();
        document.getElementById('championIntro')?.remove();

        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer) {
            gameContainer.style.display  = '';
            gameContainer.style.opacity  = '1';
            gameContainer.style.position = 'fixed';
            gameContainer.style.inset    = '0';
            gameContainer.style.zIndex   = '999999';
        }

        document.getElementById('heroSelectExitVeil')?.remove();
        document.getElementById('global-stats-bar')?.remove();
        document.getElementById('statPopup')?.remove();
        document.getElementById('heroSelect')?.remove();
        document.querySelectorAll('canvas[style*="z-index: -1"], div[style*="z-index:-2"], div[style*="z-index: -2"]')
            .forEach(el => el.remove());

        callback();
    }

    const trainingBtn = createDomButton({
        ga: 'Oiliúint', en: 'Training',
        opacity: GameSettings.englishOpacity,
        onClick: () => {
            showResponseAndProceed(() => {
                cleanupHeroSelect();
                initDawnCrossing(champion, GameSettings.englishOpacity, () => {
                    window.startGame
                        ? window.startGame(champion, { startScene: 'BowTutorial' })
                        : console.error('[TutorialOrAdventure] window.startGame not found!');
                });
            });
        },
    });

    const bogBtn = createDomButton({
        ga: 'An Portach', en: 'The Bog',
        opacity: GameSettings.englishOpacity,
        onClick: () => {
            showResponseAndProceed(() => {
                cleanupHeroSelect();
                initReturnCrossing(champion, GameSettings.englishOpacity, () => {
                    window.startGame
                        ? window.startGame(champion, { startScene: 'Bog_Threshold' })
                        : console.error('[TutorialOrAdventure] window.startGame not found!');
                });
            });
        },
    });

    const backBtn = createDomButton({
        ga: 'Ar Ais', en: 'Back',
        opacity: GameSettings.englishOpacity,
        onClick: async () => {
            try {
                const mod = await import('./heroSelect.js');
                if (mod.muteSecondInstrument) await mod.muteSecondInstrument();
                cleanup();
                moonWidget.destroy();
                const hsc = document.getElementById('heroSelect');
                if (hsc) { hsc.style.opacity = '1'; hsc.style.pointerEvents = 'auto'; }
                if (mod.showHeroSelect) mod.showHeroSelect();
            } catch(e) {
                console.error('[TutorialOrAdventure] Back error:', e);
                cleanup();
            }
        },
    });

    bottomSection.append(trainingBtn.el, bogBtn.el, backBtn.el);

    // -- Moon widget --
    const moonWidget = createMoonWidget({
        initialPhase : GameSettings.englishOpacity,
        showSlider   : false,
        onChange     : (phase) => {
            GameSettings.setEnglishOpacity(phase);
            _applyOpacity(phase);
        },
    });

    function _applyOpacity(opacity) {
        if (_responseRevealed) responseEnglish.style.opacity = String(opacity);
        trainingBtn.applyLanguage(opacity);
        bogBtn.applyLanguage(opacity);
        backBtn.applyLanguage(opacity);
    }

    _applyOpacity(GameSettings.englishOpacity);

    uiContainer.append(textContainer, championHolder, bottomSection);
    document.body.appendChild(uiContainer);

    function cleanup() {
        _state.initialized = false;
        if (stopStarfield) { stopStarfield(); stopStarfield = null; }
        document.getElementById('tutorialBlackBg')?.remove();
        document.getElementById('championIntro')?.remove();
    }
}

