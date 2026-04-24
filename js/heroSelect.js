import { initConstellationScene, waitForHeroAssets, getPreloadedAssets, getPrewarmedPlayer } from './introModal.js';
import { startGame } from './main.js';
import { champions } from '../data/champions.js';
import { showCharacterModal } from './characterModal.js';
import '../css/heroSelect.css';
import { allTunes } from './game/systems/music/allTunes.js';
import { TradSessionPlayer } from './game/systems/music/tradSessionPlayerScheduled.js';
import { getTuneKeyForChampion } from './game/systems/music/championTuneMapping.js';
import { FONTS, COLORS, TYPE, SPACING, createDomButton } from './game/systems/gameTypography.js';
import { GameSettings } from './game/settings/gameSettings.js';
import { createMoonWidget } from './game/ui/moonWidget.js';

console.log('[HeroSelect] MODULE LOADED - heroSelect.js is executing');

// ── Global state ──────────────────────────────────────────────────────────────
let initialized      = false;
let sequenceTriggered = false;
function resetState() { initialized = false; }

let sliderTutorialComplete = false;
let musicPlayer    = null;
let currentTuneKey = null;

let currentAmerginLineForExport = null;

let currentChampionIndex = 0;
let validChampions       = [];
let audioUnlocked        = true;
let lastMusicChangeTime  = 0;
const MUSIC_CHANGE_DELAY = 500;

let initialSliderValue = 0.05;

let scrollContainer  = null;

// Swipe nudge state
let swipeNudgeTimer   = null;
let swipeNudgeCancelled = false;
let swipeNudgePanning   = false;

// Active moonWidget instance
let moonWidgetInstance = null;

// ── Stat descriptions ─────────────────────────────────────────────────────────
const statDescriptions = {
  attack:  { irish: 'Troid',   english: 'Fight'   },
  defense: { irish: 'Cosain',  english: 'Defend'  },
  health:  { irish: 'Sláinte', english: 'Health'  },
};





const statIcons = {
    attack:  'assets/icons/sword.png',
    defense: 'assets/icons/shield.png',
    health:  'assets/icons/heart.png',
    speed:   'assets/icons/wing.png',
 //  magic:   'assets/icons/star.png',
    luck:    'assets/icons/clover.png',
};

// Helper used by both createStatsDisplay and createStatPopup.
// Returns an <img> element sized to `size` px, falling back to the stat key
// as text if the image fails to load.
function makeStatIcon(statName, size = 32) {
    const img = document.createElement('img');
    img.src    = statIcons[statName];
    img.width  = size;
    img.height = size;
    img.style.cssText = `
        width:${size}px;height:${size}px;
        object-fit:contain;
        image-rendering:pixelated;
        image-rendering:crisp-edges;
        display:block;
    `;
    img.onerror = () => {
        // Graceful fallback if asset not yet present
        const span = document.createElement('span');
        span.textContent = statName[0].toUpperCase();
        span.style.cssText = `font-size:${size * 0.7}px;line-height:1;`;
        img.replaceWith(span);
    };
    return img;
}










function createStatsDisplay(champion) {
    if (!champion || !champion.stats) return null;

    const statsContainer = document.createElement('div');
    statsContainer.id = 'global-stats-bar';
    statsContainer.style.cssText = `
        position: fixed !important;
        bottom: 120px !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 10005 !important;
        padding: 15px !important;
        display: flex !important;
        justify-content: center !important;
        gap: 40px !important;
        pointer-events: auto !important;
    `;

    ['attack', 'defense', 'health'].forEach(statName => {
        if (champion.stats[statName] === undefined) return;

        const item = document.createElement('div');
        item.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 5px !important;
            cursor: pointer !important;
            pointer-events: auto !important;
        `;

        const iconWrap = document.createElement('div');
        iconWrap.style.cssText = `
            width:40px;height:40px;
            display:flex;align-items:center;justify-content:center;
        `;
        iconWrap.appendChild(makeStatIcon(statName, 36));

        const val = document.createElement('span');
        val.style.cssText = `
            color:${COLORS.speaker};
            font-family:${FONTS.english};
            font-weight:bold;
            font-size:1.3rem;
        `;
        val.textContent = champion.stats[statName];

        item.appendChild(iconWrap);
        item.appendChild(val);



item.onclick = (e) => {
    e.stopPropagation();
    cancelSwipeNudge();
    const existing = document.getElementById('statPopup');
    if (existing && existing.dataset.stat === statName) { existing.click(); return; }
    createStatPopup(statName);
};

item.onclick = (e) => {
    e.stopPropagation();
    cancelSwipeNudge();
    const existing = document.getElementById('statPopup');
    if (existing && existing.dataset.stat === statName) { existing.click(); return; }
    createStatPopup(statName);
};

        statsContainer.appendChild(item);
    });

    return statsContainer;
}

function createStatPopup(statName) {
    const liveOpacity = GameSettings.englishOpacity ?? 0.15;

    const existing = document.getElementById('statPopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'statPopup';
popup.dataset.stat = statName;
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.92);
        border: 3px solid ${COLORS.speaker};
        border-radius: 15px;
        padding: 1.5rem;
        width: 80%;
        max-width: 340px;
        height: 200px;
        z-index: 99999;
        box-shadow: 0 10px 40px rgba(0,0,0,0.9);
        animation: popupFadeIn 0.2s ease-out;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
    `;

    // Icon: image at 48px, centered
    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = `
        height: 4rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-bottom: 0.4rem;
    `;
    iconWrap.appendChild(makeStatIcon(statName, 48));

    const irishText = document.createElement('div');
    irishText.id = 'statPopupIrish';
    irishText.style.cssText = `
        font-size: ${TYPE.body.size};
        color: ${COLORS.irish};
        line-height: ${SPACING.irishLineHeight};
        font-family: ${FONTS.irish};
        text-align: center;
        height: 2.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
    `;

    const englishText = document.createElement('div');
    englishText.id = 'statPopupEnglish';
    englishText.style.cssText = `
        font-size: ${TYPE.bodyEn.size};
        color: ${COLORS.english};
        line-height: ${SPACING.englishLineHeight};
        font-family: ${FONTS.english};
        text-align: center;
        height: 1.8rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 0.5s ease;
    `;
    englishText.textContent = statDescriptions[statName].english;

    popup.appendChild(iconWrap);
    popup.appendChild(irishText);
    popup.appendChild(englishText);

    if (!document.getElementById('statPopupStyle')) {
        const style = document.createElement('style');
        style.id = 'statPopupStyle';
        style.textContent = `
            @keyframes popupFadeIn {
                from { opacity:0; transform:translate(-50%,-50%) scale(0.9); }
                to   { opacity:1; transform:translate(-50%,-50%) scale(1);   }
            }
            @keyframes popupFadeOut {
                from { opacity:1; transform:translate(-50%,-50%) scale(1);   }
                to   { opacity:0; transform:translate(-50%,-50%) scale(0.9); }
            }
            @keyframes letterGlow {
                0%   { opacity:0; transform:translateY(10px); }
                100% { opacity:1; transform:translateY(0);    }
            }
        `;
        document.head.appendChild(style);
    }

    let autoCloseTimer = null;
    const closePopup = () => {
        if (autoCloseTimer) clearTimeout(autoCloseTimer);
        popup.style.animation = 'popupFadeOut 0.2s ease-in';
        setTimeout(() => { if (popup.parentNode) popup.remove(); }, 200);
    };
    popup.addEventListener('click', closePopup);
    document.body.appendChild(popup);

    const irishString = statDescriptions[statName].irish;
    let charIndex = 0;

    function typeNextChar() {
        if (charIndex < irishString.length) {
            const span = document.createElement('span');
            span.textContent = irishString[charIndex];
            span.style.cssText = 'display:inline;animation:letterGlow 0.4s ease;';
            irishText.appendChild(span);
            charIndex++;
            setTimeout(typeNextChar, 400 / irishString.length + 20);
        } else {
            setTimeout(() => {
                englishText.style.opacity = String(GameSettings.englishOpacity ?? liveOpacity);
                autoCloseTimer = setTimeout(closePopup, 2700);
            }, 500);
        }
    }

    typeNextChar();
}

let globalStatsBar = null;

function updateGlobalStats(champion) {
    if (globalStatsBar) globalStatsBar.remove();
    globalStatsBar = createStatsDisplay(champion);
    if (globalStatsBar) {
        if (!sliderTutorialComplete) globalStatsBar.style.opacity = '0';
        document.body.appendChild(globalStatsBar);
        const statValues = globalStatsBar.querySelectorAll('span:last-child');
        statValues.forEach((val, i) => {
            setTimeout(() => val.classList.add('stat-animate'), i * 50);
        });
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────
export function initHeroSelect() {
    console.log('[HeroSelect] initHeroSelect called, initialized:', initialized);
    if (initialized) return;
    initialized = true;

    initConstellationScene(async (sliderValue, amerginLine) => {
        console.log('[HeroSelect] Intro complete, slider value:', sliderValue);
        initialSliderValue = sliderValue;
        currentAmerginLineForExport = amerginLine;

        // Sync GameSettings so everything downstream has the right initial value
        GameSettings.setEnglishOpacity(sliderValue);

        await waitForHeroAssets();
        initMainHeroSelect();
    });
}

function initMainHeroSelect() {
    console.log('[HeroSelect] Initializing main hero select');

    const container = document.getElementById('heroSelect');
    if (!container) return;

    container.style.position = 'relative';
    container.style.zIndex   = '10002';
    container.style.opacity  = '0';

    sliderTutorialComplete = true;
    audioUnlocked          = true;
    currentChampionIndex   = 0;

    if (!musicPlayer) {
        musicPlayer = getPrewarmedPlayer() || new TradSessionPlayer();
        console.log('[HeroSelect] Music player initialized');
    }

    const preloaded           = getPreloadedAssets();
    const sheet               = preloaded.spriteSheet;
    const atlasData           = preloaded.atlasData;
    const allValidChampions   = preloaded.validChampions;
    const firstChampionCanvas = preloaded.firstChampionCanvas;
    const randomStartIndex    = preloaded.randomStartIndex;

    const CHAMPION_SUBSET_SIZE = 30;
    const shuffled    = [...allValidChampions].sort(() => Math.random() - 0.5);
    validChampions    = shuffled.slice(0, CHAMPION_SUBSET_SIZE);

    const preRenderedChamp = allValidChampions[randomStartIndex];
    if (!validChampions.includes(preRenderedChamp)) validChampions[0] = preRenderedChamp;
    const newStartIndex = validChampions.indexOf(preRenderedChamp);

    // ── Layout styles ─────────────────────────────────────────────────────────
    const layoutStyle = document.createElement('style');
    layoutStyle.textContent = `
        @keyframes statPulse {
            0%   { transform:scale(1);   filter:brightness(1); }
            30%  { transform:scale(1.2); filter:brightness(1.8) drop-shadow(0 0 10px ${COLORS.speaker}); }
            100% { transform:scale(1);   filter:brightness(1); }
        }
        @keyframes swipeWiggle {
            0%   { transform:translateX(0)    scaleY(1);    }
            12%  { transform:translateX(-32px) scaleY(0.96); }
            30%  { transform:translateX(26px)  scaleY(1.03); }
            48%  { transform:translateX(-16px) scaleY(0.98); }
            64%  { transform:translateX(10px)  scaleY(1.01); }
            80%  { transform:translateX(-5px)  scaleY(1);    }
            100% { transform:translateX(0)    scaleY(1);    }
        }
        @keyframes championBoogie {
            0%,24.9%  { transform:translateY(0px)   scale(1,1);   }
            12.5%     { transform:translateY(-12px)  scale(0.9,1.15)  rotate(3deg);  }
            25%,49.9% { transform:translateY(0px)   scale(-1,1);  }
            37.5%     { transform:translateY(-12px)  scale(-0.9,1.15) rotate(-3deg); }
            50%,74.9% { transform:translateY(0px)   scale(1,1);   }
            62.5%     { transform:translateY(-12px)  scale(0.9,1.15)  rotate(3deg);  }
            75%,99.9% { transform:translateY(0px)   scale(-1,1);  }
            87.5%     { transform:translateY(-12px)  scale(-0.9,1.15) rotate(-3deg); }
            100%      { transform:translateY(0px)   scale(1,1);   }
        }
        .champion-canvas.floating {
            animation:championBoogie 2s linear infinite;
            transform-origin:bottom center;
        }
        .stat-animate { animation:statPulse 0.4s ease-out; }
        .hero-select-container {
            display:flex;flex-direction:column;height:100vh;width:100vw;
            overflow:hidden;background:transparent;position:relative;
        }
        .champion-scroll {
            flex:1;display:flex;overflow-x:auto;
            scroll-snap-type:x proximity;
            scrollbar-width:none;-ms-overflow-style:none;
            overflow-y:visible !important;
            -webkit-overflow-scrolling:touch;
        }
        .champion-scroll::-webkit-scrollbar { display:none; }
        .champion-card {
            min-width:100vw;height:100%;
            display:flex;flex-direction:column;
            align-items:center;justify-content:center !important;
            scroll-snap-align:start;box-sizing:border-box;
            text-align:center;padding-bottom:180px;
        }
        .champion-canvas {
            max-width:85%;max-height:55vh;object-fit:contain;
            margin-bottom:20px;
            filter:drop-shadow(0 10px 20px rgba(0,0,0,0.5));
        }
        .champion-name-ga {
            font-family:${FONTS.irish};
            font-size:3rem;
            color:${COLORS.speaker};
            margin:10px 0 5px 0;
            text-shadow:2px 2px 4px rgba(0,0,0,0.8);
        }
        .champion-name-en {
            font-family:${FONTS.english};
            font-size:1.4rem;
            margin-bottom:20px;
            color:${COLORS.english};
        }
        .champion-bottom-panel { padding:20px;z-index:10; }
    `;
    document.head.appendChild(layoutStyle);

    container.className = 'hero-select-container';
    scrollContainer = document.createElement('div');
    scrollContainer.className = 'champion-scroll';
    scrollContainer.style.opacity    = '0';
    scrollContainer.style.transition = 'opacity 0.3s ease';
    scrollContainer.style.webkitOverflowScrolling = 'touch';
    scrollContainer.style.scrollBehavior = 'auto';
    container.appendChild(scrollContainer);
    // ── Bottom panel ──────────────────────────────────────────────────────────
  

 const bottomPanel = document.createElement('div');
bottomPanel.className = 'champion-bottom-panel';
    bottomPanel.style.opacity = '0';

    const chooseBtn = createDomButton({
        ga:      'Ar Aghaidh',
        en:      'Continue',
        opacity: GameSettings.englishOpacity,
        onClick: async () => {
            cancelSwipeNudge();
            try {
                const el = document.documentElement;
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    if (el.requestFullscreen) el.requestFullscreen().catch(e => console.warn('[HeroSelect] Fullscreen:', e));
                    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
                }
            } catch(e) { console.warn('[HeroSelect] Fullscreen error:', e); }

            if (validChampions[currentChampionIndex]) {
                const musicReady = musicPlayer &&
                                   musicPlayer.tracks &&
                                   musicPlayer.tracks.length > 0 &&
                                   musicPlayer.tracks.every(t => t && t.name && typeof t.active !== 'undefined');
                if (musicReady) {
                    await unmutePiano();
                    setTimeout(() => finalize(validChampions[currentChampionIndex]), 800);
                } else {
                    setTimeout(() => finalize(validChampions[currentChampionIndex]), 200);
                }
            }
        },
    });
    chooseBtn.el.style.width = '100%';
    bottomPanel.appendChild(chooseBtn.el);
    container.appendChild(bottomPanel);


 
    // ── Moon widget — fixed top-left corner, swipe to change phase ───────────
    // Appends itself directly to document.body at a fixed position.
    // Swipe right = fuller moon / more English opacity.
    // Swipe left  = darker crescent / less English.
    moonWidgetInstance = createMoonWidget({
        initialPhase : initialSliderValue,
        showSlider   : false,
        onChange     : (phase) => {
            GameSettings.setEnglishOpacity(phase);

            document.querySelectorAll('.champion-name-en').forEach(el => {
                el.style.opacity = String(phase);
            });

            const popup = document.getElementById('statPopupEnglish');
            if (popup) popup.style.opacity = String(phase);
chooseBtn.applyLanguage(phase);
        },
    });




    // ── Render champions ──────────────────────────────────────────────────────
    currentChampionIndex = newStartIndex;
    const infiniteChampions = [...validChampions, ...validChampions, ...validChampions];
    const targetScroll      = window.innerWidth * (validChampions.length + newStartIndex);
    const firstChamp        = validChampions[newStartIndex];
    const englishOpacity    = GameSettings.englishOpacity ?? initialSliderValue;

    const BATCH_SIZE  = 30;
    let currentIndex  = 0;
    let hasScrolled   = false;

    function renderBatch() {
        const endIndex = Math.min(currentIndex + BATCH_SIZE, infiniteChampions.length);

        for (let i = currentIndex; i < endIndex; i++) {
            const champ     = infiniteChampions[i];
            const frameName = champ.spriteKey.endsWith('.png') ? champ.spriteKey : `${champ.spriteKey}.png`;
            const frameData = atlasData.textures[0].frames.find(f => f.filename === frameName);
            if (!frameData) continue;

            const card = document.createElement('div');
            card.className = 'champion-card';
            card.onclick = () => {
                try {
                    const el = document.documentElement;
                    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
                        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
                    }
                } catch(e) {}
                showCharacterModal(champ);
            };

            let canvas;
            if (i === validChampions.length + newStartIndex && firstChampionCanvas) {
                canvas = document.createElement('canvas');
                canvas.className = 'champion-canvas floating';
                canvas.width  = firstChampionCanvas.width;
                canvas.height = firstChampionCanvas.height;
                canvas.getContext('2d').drawImage(firstChampionCanvas, 0, 0);
            } else {
                canvas = document.createElement('canvas');
                canvas.className = 'champion-canvas floating';
                canvas.width  = frameData.frame.w;
                canvas.height = frameData.frame.h;
                canvas.getContext('2d').drawImage(
                    sheet,
                    frameData.frame.x, frameData.frame.y, frameData.frame.w, frameData.frame.h,
                    0, 0, frameData.frame.w, frameData.frame.h
                );
            }

            const nameGa = document.createElement('div');
            nameGa.className = 'champion-name-ga';
            nameGa.textContent = champ.nameGa;

            const nameEn = document.createElement('div');
            nameEn.className = 'champion-name-en';
            nameEn.textContent = champ.nameEn;
            nameEn.style.opacity = String(englishOpacity);

            card.appendChild(canvas);
            card.appendChild(nameGa);
            card.appendChild(nameEn);
            scrollContainer.appendChild(card);
        }

        currentIndex = endIndex;

        if (!hasScrolled && currentIndex >= (validChampions.length + newStartIndex + 1)) {
            scrollContainer.scrollLeft = targetScroll;
            hasScrolled = true;

            // ── Atmospheric entrance ──────────────────────────────────────────
            const veil = document.createElement('div');
            veil.style.cssText = `
                position:fixed;inset:0;z-index:99998;
                background:#00060f;pointer-events:none;
                opacity:1;transition:opacity 1.8s ease;
            `;

            const invocationWrap = document.createElement('div');
            invocationWrap.style.cssText = `
                position:absolute;inset:0;
                display:flex;flex-direction:column;
                align-items:center;justify-content:center;
                gap:1rem;pointer-events:none;
            `;

            const invocIrish = document.createElement('div');
            invocIrish.textContent = ' ';
            invocIrish.style.cssText = `
                font-family:${FONTS.irish};
                font-size:clamp(1.6rem,5vw,2.6rem);
                color:${COLORS.speaker};
                text-align:center;padding:0 8%;
                opacity:0;transform:translateY(12px);
                transition:opacity 1s ease,transform 1s ease;
                text-shadow:0 0 30px rgba(212,175,55,0.4);
            `;

            const invocEnglish = document.createElement('div');
            invocEnglish.textContent = ' ';
            invocEnglish.style.cssText = `
                font-family:${FONTS.english};
                font-size:clamp(0.9rem,2.8vw,1.3rem);
                color:${COLORS.druid};
                text-align:center;padding:0 8%;
                opacity:0;transform:translateY(8px);
                transition:opacity 0.8s ease 0.4s,transform 0.8s ease 0.4s;
            `;

            invocationWrap.appendChild(invocIrish);
            invocationWrap.appendChild(invocEnglish);
            veil.appendChild(invocationWrap);
            document.body.appendChild(veil);

            scrollContainer.style.opacity    = '0';
            scrollContainer.style.transform  = 'translateY(28px)';
            scrollContainer.style.transition = 'opacity 1.4s ease,transform 1.4s ease';
            bottomPanel.style.opacity    = '0';
            bottomPanel.style.transition = 'opacity 1s ease';

            try {
                const tuneKey = getTuneKeyForChampion(firstChamp);
                if (tuneKey && !musicPlayer.isPlaying) playChampionTune(tuneKey);
            } catch(e) { console.error('[HeroSelect] Error starting music:', e); }

            requestAnimationFrame(() => {
                invocIrish.style.opacity   = '1';
                invocIrish.style.transform = 'translateY(0)';
                setTimeout(() => {
                    invocEnglish.style.opacity   = String(GameSettings.englishOpacity ?? initialSliderValue);
                    invocEnglish.style.transform = 'translateY(0)';
                }, 300);
            });

            setTimeout(() => {
                invocIrish.style.transition   = 'opacity 0.9s ease,transform 0.9s ease';
                invocEnglish.style.transition = 'opacity 0.7s ease,transform 0.7s ease';
                invocIrish.style.opacity      = '0';
                invocIrish.style.transform    = 'translateY(-10px)';
                invocEnglish.style.opacity    = '0';
                invocEnglish.style.transform  = 'translateY(-8px)';

                setTimeout(() => {
                    const heroContainer = document.getElementById('heroSelect');
                    if (heroContainer) {
                        heroContainer.style.transition = 'opacity 0.01s';
                        heroContainer.style.opacity    = '1';
                    }
                    scrollContainer.style.opacity   = '1';
                    scrollContainer.style.transform = 'translateY(0)';
                    updateGlobalStats(firstChamp);
                    veil.style.opacity = '0';

                    setTimeout(() => {
                        if (globalStatsBar) {
                            globalStatsBar.style.opacity    = '0';
                            globalStatsBar.style.transform  = 'translateY(10px)';
                            globalStatsBar.style.transition = 'opacity 0.9s ease,transform 0.9s ease';
                            globalStatsBar.style.pointerEvents = 'auto';
                            requestAnimationFrame(() => {
                                globalStatsBar.style.opacity   = '1';
                                globalStatsBar.style.transform = 'translateY(0)';
                            });
                        }

                        setTimeout(() => {
                            bottomPanel.style.opacity = '1';
                            veil.remove();
                            runSwipeNudge();
                        }, 900);
                    }, 600);
                }, 700);
            }, 1800);
        }

        if (currentIndex < infiniteChampions.length) {
            requestAnimationFrame(renderBatch);
        } else {
            console.log('[HeroSelect] ✓ All champions rendered');
            initSwipe(scrollContainer, validChampions.length);
            initBackgroundParticles();
        }
    }

    renderBatch();
}

// ── Swipe nudge ───────────────────────────────────────────────────────────────
function cancelSwipeNudge() {
    swipeNudgeCancelled = true;
    swipeNudgePanning   = false;
    if (swipeNudgeTimer) { clearTimeout(swipeNudgeTimer); swipeNudgeTimer = null; }
    if (scrollContainer) scrollContainer.style.scrollSnapType = 'x proximity';
}

function runSwipeNudge() {
    if (!scrollContainer || swipeNudgeCancelled) return;
    swipeNudgeCancelled = false;

    const PAN_PX    = Math.round(window.innerWidth * 0.42);
    const EASE_MS   = 380;
    const HOLD_MS   = 120;
    const REPEAT_MS = 3000;

    function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

    function animatePan(fromX, toX, durationMs, onDone) {
        const start = performance.now();
        const loop  = (now) => {
            if (swipeNudgeCancelled) { scrollContainer.scrollLeft = fromX; return; }
            const raw = Math.min((now - start) / durationMs, 1);
            scrollContainer.scrollLeft = fromX + (toX - fromX) * easeInOut(raw);
            if (raw < 1) requestAnimationFrame(loop); else onDone();
        };
        requestAnimationFrame(loop);
    }

    function runCycle() {
        if (swipeNudgeCancelled || !scrollContainer) return;
        scrollContainer.style.scrollSnapType = 'none';
        swipeNudgePanning = true;
        const baseX = scrollContainer.scrollLeft;

        animatePan(baseX, baseX - PAN_PX, EASE_MS, () => {
            if (swipeNudgeCancelled) { swipeNudgePanning = false; scrollContainer.style.scrollSnapType = 'x proximity'; return; }
            setTimeout(() => {
                animatePan(baseX - PAN_PX, baseX + PAN_PX, EASE_MS * 2, () => {
                    if (swipeNudgeCancelled) { swipeNudgePanning = false; scrollContainer.style.scrollSnapType = 'x proximity'; return; }
                    setTimeout(() => {
                        animatePan(baseX + PAN_PX, baseX, EASE_MS, () => {
                            swipeNudgePanning = false;
                            scrollContainer.style.scrollSnapType = 'x proximity';
                            if (!swipeNudgeCancelled) swipeNudgeTimer = setTimeout(runCycle, REPEAT_MS);
                        });
                    }, HOLD_MS);
                });
            }, HOLD_MS);
        });
    }

    runCycle();
}

// ── Swipe / scroll tracking ───────────────────────────────────────────────────
function initSwipe(scrollContainer, champCount) {
    let debounceTimer = null;

    scrollContainer.addEventListener('scroll', () => {
        if (!swipeNudgePanning) cancelSwipeNudge();
        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            const w        = window.innerWidth;
            const rawIndex = Math.round(scrollContainer.scrollLeft / w);
            const actual   = rawIndex % champCount;

            if (actual !== currentChampionIndex) {
                currentChampionIndex = actual;
                updateGlobalStats(validChampions[currentChampionIndex]);

                const now = Date.now();
                if (now - lastMusicChangeTime > MUSIC_CHANGE_DELAY) {
                    lastMusicChangeTime = now;
                    const tuneKey = getTuneKeyForChampion(validChampions[currentChampionIndex]);
                    if (tuneKey && tuneKey !== currentTuneKey) playChampionTune(tuneKey);
                }
            }

            // Infinite scroll wraparound
            if (scrollContainer.scrollLeft < w * 0.5) {
                scrollContainer.style.scrollSnapType = 'none';
                scrollContainer.scrollLeft += champCount * w;
                requestAnimationFrame(() => { scrollContainer.style.scrollSnapType = 'x proximity'; });
            } else if (scrollContainer.scrollLeft > (champCount * 2 - 0.5) * w) {
                scrollContainer.style.scrollSnapType = 'none';
                scrollContainer.scrollLeft -= champCount * w;
                requestAnimationFrame(() => { scrollContainer.style.scrollSnapType = 'x proximity'; });
            }
        }, 100);
    });
}

// ── Music ─────────────────────────────────────────────────────────────────────
async function playChampionTune(tuneKey) {
    if (!tuneKey || !musicPlayer) return;
    if (currentTuneKey === tuneKey && musicPlayer.isPlaying) return;

    if (currentTuneKey && musicPlayer.isPlaying) {
        try {
            const oldTracks = musicPlayer.tracks ? [...musicPlayer.tracks] : [];
            for (const track of oldTracks) {
                if (track?.gain) {
                    track.gain.gain.setValueAtTime(track.gain.gain.value, musicPlayer.audioContext.currentTime);
                    track.gain.gain.linearRampToValueAtTime(0, musicPlayer.audioContext.currentTime + 1.0);
                }
            }
            const loaded = await musicPlayer.loadTune(tuneKey, false);
            if (!loaded) return;
            currentTuneKey = tuneKey;
            await musicPlayer.play();
            setTimeout(() => {
                for (const track of oldTracks) {
                    try { if (track.synth?.stop) track.synth.stop(); if (track.gain) track.gain.disconnect(); } catch(e) {}
                }
            }, 1200);
        } catch(e) { console.error('[HeroSelect] Crossfade error:', e); }
    } else {
        currentTuneKey = tuneKey;
        try {
            const loaded = await musicPlayer.loadTune(tuneKey, false);
            if (!loaded) return;
            await musicPlayer.play();
        } catch(e) { console.error('[HeroSelect] Play error:', e); }
    }
}

async function unmutePiano() {
    if (!musicPlayer?.tracks) return;
    let targetIndex = musicPlayer.tracks.findIndex(t => t?.name === 'Piano');
    if (targetIndex < 0 && musicPlayer.tracks.length > 1) targetIndex = 1;
    if (targetIndex >= 0 && musicPlayer.tracks[targetIndex] && !musicPlayer.tracks[targetIndex].active) {
        await musicPlayer.toggleInstrument(targetIndex);
    }
}

// ── Finalize / exit ───────────────────────────────────────────────────────────
function finalize(champ) {
    const currentSliderValue = GameSettings.englishOpacity ?? 0.15;

    if (moonWidgetInstance) moonWidgetInstance.pauseDrift();

    const exitVeil = document.createElement('div');
    exitVeil.id = 'heroSelectExitVeil';
    exitVeil.style.cssText = [
        'position:fixed;inset:0;z-index:99999;',
        'background:#00060f;pointer-events:all;',
        'opacity:0;transition:opacity 1.2s ease;',
    ].join('');
    document.body.appendChild(exitVeil);

    requestAnimationFrame(() => { exitVeil.style.opacity = '1'; });

    setTimeout(() => {
        if (globalStatsBar) { globalStatsBar.style.opacity = '0'; globalStatsBar.style.pointerEvents = 'none'; }
        const heroSelectContainer = document.getElementById('heroSelect');
        if (heroSelectContainer) { heroSelectContainer.style.opacity = '0'; heroSelectContainer.style.pointerEvents = 'none'; }

        import('./tutorialOrAdventure.js').then(module => {
            module.initTutorialOrAdventure(champ, currentSliderValue, currentAmerginLineForExport);
        });
    }, 1100);
}

function showHeroSelect() {
    console.log('[HeroSelect] showHeroSelect() called');

    const staleVeil = document.getElementById('heroSelectExitVeil');
    if (staleVeil) staleVeil.remove();

    if (moonWidgetInstance) moonWidgetInstance.resumeDrift();

    const returnVeil = document.createElement('div');
    returnVeil.style.cssText = [
        'position:fixed;inset:0;z-index:99999;',
        'background:#00060f;pointer-events:all;',
        'opacity:1;transition:opacity 1.1s ease;',
    ].join('');
    document.body.appendChild(returnVeil);

    const container = document.getElementById('heroSelect');
    if (container) { container.style.transition = 'opacity 0.01s'; container.style.opacity = '1'; container.style.pointerEvents = 'auto'; }
    if (scrollContainer) { scrollContainer.style.opacity = '1'; scrollContainer.style.transform = 'translateY(0)'; }

    const bottomPanel = document.querySelector('.champion-bottom-panel');
    if (bottomPanel) bottomPanel.style.opacity = '1';

    if (globalStatsBar) { globalStatsBar.style.opacity = '1'; globalStatsBar.style.pointerEvents = 'auto'; }

    requestAnimationFrame(() => {
        returnVeil.style.opacity = '0';
        setTimeout(() => returnVeil.remove(), 1200);
    });
}

// ── Background particles ──────────────────────────────────────────────────────
function initBackgroundParticles() {
    const nebula = document.createElement('div');
    nebula.style.cssText = [
        'position:fixed;inset:0;z-index:-2;pointer-events:none;',
        'background:radial-gradient(ellipse 80% 60% at 30% 40%,rgba(60,30,120,0.18) 0%,transparent 70%),',
        'radial-gradient(ellipse 60% 50% at 70% 60%,rgba(20,40,100,0.14) 0%,transparent 65%),',
        '#00060f;opacity:0;transition:opacity 2s ease;',
    ].join('');
    document.body.appendChild(nebula);
    setTimeout(() => { nebula.style.opacity = '1'; }, 2600);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = [
        'position:fixed;top:0;left:0;width:100%;height:100%;',
        'z-index:-1;pointer-events:none;',
        'opacity:0;transition:opacity 1.8s ease;',
    ].join('');

    const container = document.getElementById('heroSelect');
    if (container) container.insertBefore(canvas, container.firstChild);

    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x  = Math.random() * canvas.width;
            this.y  = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.25;
            this.vy = (Math.random() - 0.5) * 0.25;
            this.radius       = Math.random() * 1.4 + 0.3;
            this.opacity      = Math.random() * 0.35 + 0.08;
            this.twinkleSpeed = 0.008 + Math.random() * 0.012;
            this.twinkleOffset = Math.random() * Math.PI * 2;
        }
        update(t) {
            this.x += this.vx; this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width)  this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height)  this.vy *= -1;
            this.currentOpacity = this.opacity * (0.7 + 0.3 * Math.sin(t * this.twinkleSpeed + this.twinkleOffset));
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200,220,255,${this.currentOpacity})`;
            ctx.fill();
        }
    }

    for (let i = 0; i < 40; i++) particles.push(new Particle());

    let t = 0;
    function animate() {
        t++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(t); p.draw(); });
        requestAnimationFrame(animate);
    }
    animate();
    setTimeout(() => { canvas.style.opacity = '1'; }, 2600);
}

// ── DOM init ──────────────────────────────────────────────────────────────────
const _skipHeroSelect = new URLSearchParams(window.location.search).get('scene')
if (!_skipHeroSelect) {
  document.addEventListener('DOMContentLoaded', initHeroSelect)
  if (document.readyState !== 'loading') initHeroSelect()
}

// ── Exports ───────────────────────────────────────────────────────────────────
export function getCurrentAmerginLine()      { return currentAmerginLineForExport; }
export function setCurrentAmerginLine(line)  { currentAmerginLineForExport = line; }
export function getMusicPlayer()             { return musicPlayer; }

export async function muteSecondInstrument() {
    if (!musicPlayer?.tracks) return;
    for (let i = 1; i < musicPlayer.tracks.length; i++) {
        if (musicPlayer.tracks[i]?.active) musicPlayer.toggleInstrument(i);
    }
}

export { showHeroSelect };

