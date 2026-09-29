// tutorialOrAdventure.js
//
// The champion's moment before the crossing. The night sky carries on from
// heroSelect, the champion dances to their own theme tune, and on choosing a
// road they stop, step forward and answer Amergin.

import { initReturnCrossing } from './game/scenes/returnCrossing.js';
import { initDawnCrossing }   from './game/scenes/dawnCrossing.js';
import { FONTS, COLORS, TYPE, SPACING, BUTTON, createDomButton } from './game/systems/gameTypography.js';
import { GameSettings }     from './game/settings/gameSettings.js';
import { createMoonWidget } from './game/ui/moonWidget.js';
import { hopMsForTuneKey, danceTransform, musicClockFor } from './game/effects/championDance.js';
import { getTuneKeyForChampion } from './game/systems/music/championTuneMapping.js';

const _state = {
    currentAmerginLine: null,
    initialized:        false,
};

export function setCurrentAmerginLine(line) {
    _state.currentAmerginLine = line;
}

// Same night as heroSelect (its exit veil and nebula are #00060f).
const NIGHT = '#00060f';

function _moonClearance() {
    const minDim   = Math.min(window.innerWidth, window.innerHeight);
    const moonR    = Math.max(24, Math.round(minDim * 0.055));
    const moonD    = moonR * 2;
    const pad      = 18;
    const wrapperH = moonD + pad * 2;
    return Math.round(102 + wrapperH / 2) + 8;
}

async function _getMusicPlayer() {
    try {
        const mod = await import('./heroSelect.js');
        return mod.getMusicPlayer?.() || null;
    } catch (e) {
        console.error('[TutorialOrAdventure] Music player lookup failed:', e);
        return null;
    }
}

// ---------------------------------------------
// NIGHT SKY — still stars that twinkle slowly
// ---------------------------------------------
function createNightSky() {
    const canvas = document.createElement('canvas');
    canvas.id = 'tutorialNightSky';
    canvas.style.cssText = `
        position:fixed;inset:0;width:100%;height:100%;
        z-index:100000;pointer-events:none;
    `;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Stars live in 0..1 coordinates so a resize just redraws them in place.
    const stars = Array.from({ length: 170 }, () => ({
        x:      Math.random(),
        y:      Math.random(),
        r:      Math.random() * 1.2 + 0.3,
        base:   Math.random() * 0.45 + 0.15,
        speed:  0.0004 + Math.random() * 0.0012,   // radians per ms
        offset: Math.random() * Math.PI * 2,
        gold:   Math.random() < 0.12,
    }));

    let w = 0, h = 0;
    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth; h = window.innerHeight;
        canvas.width  = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    let rafId = null;
    function loop(now) {
        ctx.clearRect(0, 0, w, h);
        for (const s of stars) {
            const a = s.base * (0.6 + 0.4 * Math.sin(now * s.speed + s.offset));
            ctx.beginPath();
            ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
            ctx.fillStyle = s.gold ? `rgba(212,175,55,${a})` : `rgba(200,220,255,${a})`;
            ctx.fill();
        }
        rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return function stop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        window.removeEventListener('resize', resize);
        canvas.remove();
    };
}

// ---------------------------------------------
// THE DANCE — one hop per beat of the champion's own tune
// ---------------------------------------------
function createDance(el, champion, musicPlayerPromise) {
    let rafId = null;
    let mp    = null;
    const hopMs = hopMsForTuneKey(getTuneKeyForChampion(champion));
    musicPlayerPromise.then(p => { mp = p; });

    function frame() {
        // The music's clock keeps landings on the beat; wall time otherwise.
        const ms = musicClockFor(mp) ?? performance.now();
        el.style.transform = danceTransform(ms, hopMs);
        rafId = requestAnimationFrame(frame);
    }

    return {
        start() { if (!rafId) rafId = requestAnimationFrame(frame); },
        stop()  { if (rafId) cancelAnimationFrame(rafId); rafId = null; },
    };
}

// ---------------------------------------------
// MAIN ENTRY POINT
// ---------------------------------------------
export function initTutorialOrAdventure(champion, sliderValue = 0.15, amerginLine = null) {
    if (_state.initialized) return;
    _state.initialized = true;
    let _responseRevealed = false;
    let _leaving = false;

    GameSettings.setEnglishOpacity(
        typeof sliderValue === 'number' ? sliderValue : GameSettings.englishOpacity
    );

    if (amerginLine) _state.currentAmerginLine = amerginLine;

    console.log('[TutorialOrAdventure] Initializing with champion:', champion.nameEn);

    const musicPlayerPromise = _getMusicPlayer();

    // Bring in the full ensemble for this scene.
    musicPlayerPromise.then(async mp => {
        try {
            if (!mp?.tracks) return;
            for (let i = 0; i < mp.tracks.length; i++) {
                if (mp.tracks[i] && !mp.tracks[i].active) await mp.toggleInstrument(i);
            }
        } catch (e) { console.error('[TutorialOrAdventure] Unmute error:', e); }
    });

    // Remove the old CSS dance if an earlier version left it behind.
    document.getElementById('tutorialBoogieStyle')?.remove();

    const blackBg = document.createElement('div');
    blackBg.id = 'tutorialBlackBg';
    blackBg.style.cssText = `
        position:fixed;inset:0;z-index:99999;pointer-events:none;
        background:
            radial-gradient(ellipse 80% 60% at 30% 40%,rgba(60,30,120,0.18) 0%,transparent 70%),
            radial-gradient(ellipse 60% 50% at 70% 60%,rgba(20,40,100,0.14) 0%,transparent 65%),
            ${NIGHT};
    `;
    document.body.appendChild(blackBg);

    let stopNightSky = createNightSky();

    const uiContainer = document.createElement('div');
    uiContainer.id = 'championIntro';
    uiContainer.style.cssText = `
        position:fixed;inset:0;background:transparent;
        z-index:100001;display:flex;flex-direction:column;
        align-items:center;height:100%;
        box-sizing:border-box;overflow:hidden;
        opacity:0;transition:opacity 0.9s ease;
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
        font-family:${TYPE.domBody.font};
        font-size:${TYPE.domBody.size};color:${COLORS.speaker};
        margin-bottom:0.5rem;line-height:${SPACING.irishLineHeight};
    `;
    textContainer.appendChild(irishTextEl);

    const championHolder = document.createElement('div');
    championHolder.style.cssText = `
        flex:1;width:100%;min-height:0;
        display:flex;flex-direction:column;
        justify-content:center;align-items:center;
        gap:1rem;
        overflow:visible;padding:0.5rem 1.5rem;box-sizing:border-box;
    `;

    const responseIrish = document.createElement('div');
    responseIrish.textContent = 'Cé murach mise.';
    responseIrish.style.cssText = `
        font-family:${TYPE.domBody.font};
        font-size:${TYPE.domBody.size};color:${COLORS.speaker};
        line-height:${SPACING.irishLineHeight};text-align:center;
        max-width:800px;width:100%;
        opacity:0;transition:opacity 0.6s ease;
        pointer-events:none;
        min-height:2.7rem;
    `;

    const responseEnglish = document.createElement('div');
    responseEnglish.textContent = 'Who, if not I.';
    responseEnglish.style.cssText = `
        font-family:${TYPE.domBodyEn.font};
        font-size:${TYPE.domBodyEn.size};color:${COLORS.english};
        opacity:0;transition:opacity 0.4s ease;
        line-height:${SPACING.englishLineHeight};
        pointer-events:none;
        text-align:center;max-width:800px;width:100%;
        min-height:2.1rem;
    `;

    textContainer.appendChild(responseIrish);
    textContainer.appendChild(responseEnglish);

    const championCanvas = document.createElement('canvas');
    championCanvas.style.cssText = `
        display:block !important;
        max-width:75%;max-height:20vh;
        object-fit:contain;
        image-rendering:pixelated;
        image-rendering:-moz-crisp-edges;
        image-rendering:crisp-edges;
        filter:drop-shadow(0 10px 20px rgba(0,0,0,0.5));
        transform-origin:bottom center;
        will-change:transform;
    `;
    championHolder.appendChild(championCanvas);

    const dance = createDance(championCanvas, champion, musicPlayerPromise);

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
            if (!_leaving) dance.start();
        } catch (e) {
            console.error('[TutorialOrAdventure] Sprite load failed:', e);
        }
    })();

    // Stop dancing, face front, and take a step toward the player.
    function stepForward() {
        dance.stop();
        championCanvas.style.transition = 'transform 0.25s ease-out';
        championCanvas.style.transform  = 'translateY(0px) rotate(0deg) scale(1, 1)';
        return new Promise(resolve => setTimeout(() => {
            championCanvas.style.transition = 'transform 0.9s cubic-bezier(0.25, 0.8, 0.35, 1)';
            championCanvas.style.transform  = 'translateY(4vh) scale(1.3, 1.3)';
            setTimeout(resolve, 900);
        }, 300));
    }

    // Button stack: Training + Bog (the moon handles going back)
    const moonClear = _moonClearance();
    const bottomSection = document.createElement('div');
    bottomSection.style.cssText = `
        width:100%;max-width:800px;
        display:flex;flex-direction:column;
        gap:${BUTTON.gap}px;
        padding:1rem 1rem ${moonClear}px 1rem;
        box-sizing:border-box;flex-shrink:0;
        transition:opacity 0.6s ease;
    `;

    function cleanupHeroSelect() {
        import('./heroSelect.js').then(m => m.destroyMoonWidget?.()).catch(() => {});
        document.getElementById('heroSelect')?.remove();
        document.getElementById('heroSelectNebula')?.remove();
        document.getElementById('heroSelectExitVeil')?.remove();
        document.getElementById('global-stats-bar')?.remove();
        document.getElementById('statPopup')?.remove();
        document.getElementById('sunSliderStyle')?.remove();
        document.getElementById('statPopupStyle')?.remove();
    }

    async function showResponseAndProceed(callback) {
        if (_leaving) return;
        _leaving = true;

        // Nothing else may fire while we leave.
        moonWidget.setTapHandler(null);
        moonWidget.setLongPressHandler(null);
        bottomSection.style.opacity       = '0';
        bottomSection.style.pointerEvents = 'none';

        await stepForward();

        responseIrish.style.opacity   = '1';
        responseEnglish.style.opacity = String(GameSettings.englishOpacity);
        _responseRevealed = true;
        await new Promise(r => setTimeout(r, 1800));

        const mp = await musicPlayerPromise;
        try {
            if (mp?.tracks && mp.audioContext) {
                const t0 = mp.audioContext.currentTime;
                for (const track of mp.tracks) {
                    if (track?.active && track.gain) track.gain.gain.setTargetAtTime(0, t0, 0.6);
                }
            }
        } catch (e) { console.error('[TutorialOrAdventure] Music fade error:', e); }

        const blackOverlay = document.createElement('div');
        blackOverlay.style.cssText = `
            position:fixed;inset:0;background:#000;opacity:0;
            z-index:200000;transition:opacity 2s ease;pointer-events:none;
        `;
        document.body.appendChild(blackOverlay);
        requestAnimationFrame(() => {
            uiContainer.style.transition = 'opacity 1s ease';
            uiContainer.style.opacity    = '0';
            blackOverlay.style.opacity   = '1';
        });

        moonWidget.destroy();
        await new Promise(r => setTimeout(r, 2500));

        if (stopNightSky) { stopNightSky(); stopNightSky = null; }
        blackOverlay.remove();
        blackBg.remove();
        uiContainer.remove();

        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer) {
            gameContainer.style.display  = '';
            gameContainer.style.opacity  = '1';
            gameContainer.style.position = 'fixed';
            gameContainer.style.inset    = '0';
            gameContainer.style.zIndex   = '999999';
        }

        cleanupHeroSelect();
        _state.initialized = false;
        callback();
    }

    const trainingBtn = createDomButton({
        ga: 'Oiliúint', en: 'Training',
        opacity: GameSettings.englishOpacity,
        onClick: () => {
            showResponseAndProceed(() => {
                // Training = the Isle of Skye: the dawn crossing rows the
                // player over and they step off at the Skye jetty (the old
                // BowTutorial stays registered until Scathach's archery is
                // ported to the dún).
                initDawnCrossing(champion, GameSettings.englishOpacity, () => {
                    window.startGame
                        ? window.startGame(champion, { startScene: 'skye_cladach' })
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
                initReturnCrossing(champion, GameSettings.englishOpacity, () => {
                    window.startGame
                        ? window.startGame(champion, { startScene: 'd3_sea' })
                        : console.error('[TutorialOrAdventure] window.startGame not found!');
                });
            });
        },
    });

    bottomSection.append(trainingBtn.el, bogBtn.el);

    // -- Moon widget — tap = go back to heroSelect ----------------------------
    const moonWidget = createMoonWidget({
        initialPhase : GameSettings.englishOpacity,
        showSlider   : false,
        corner       : 'bottom-center',
        onChange     : (phase) => {
            GameSettings.setEnglishOpacity(phase);
            _applyOpacity(phase);
        },
    });

    const _goBack = async () => {
        if (_leaving) return;
        _leaving = true;
        moonWidget.setTapHandler(null);
        moonWidget.setLongPressHandler(null);
        try {
            const mod = await import('./heroSelect.js');
            if (mod.muteSecondInstrument) await mod.muteSecondInstrument();
            cleanup();
            moonWidget.destroy();
            const hsc = document.getElementById('heroSelect');
            if (hsc) { hsc.style.opacity = '1'; hsc.style.pointerEvents = 'auto'; }
            if (mod.showHeroSelect) mod.showHeroSelect();
        } catch (e) {
            console.error('[TutorialOrAdventure] Back error:', e);
            cleanup();
        }
    };
    moonWidget.setTapHandler(_goBack);
    moonWidget.setLongPressHandler(_goBack);

    function _applyOpacity(opacity) {
        if (_responseRevealed) responseEnglish.style.opacity = String(opacity);
        trainingBtn.applyLanguage(opacity);
        bogBtn.applyLanguage(opacity);
    }

    _applyOpacity(GameSettings.englishOpacity);

    uiContainer.append(textContainer, championHolder, bottomSection);
    document.body.appendChild(uiContainer);
    requestAnimationFrame(() => { uiContainer.style.opacity = '1'; });

    function cleanup() {
        _state.initialized = false;
        dance.stop();
        if (stopNightSky) { stopNightSky(); stopNightSky = null; }
        blackBg.remove();
        uiContainer.remove();
    }
}
