
import { initConstellationScene, waitForHeroAssets, getPreloadedAssets, getPrewarmedPlayer } from './introModal.js';

//import { initIntroModal, getPreloadedAssets } from './introModal.js';
import { startGame } from './main.js';
import { champions } from '../data/champions.js';
import { showCharacterModal } from './characterModal.js';
import '../css/heroSelect.css';
import {allTunes} from './game/systems/music/allTunes.js';
import {TradSessionPlayer } from './game/systems/music/tradSessionPlayerScheduled.js';
import { getTuneKeyForChampion } from './game/systems/music/championTuneMapping.js';

console.log('[HeroSelect] MODULE LOADED - heroSelect.js is executing');

// Global state
let initialized = false;
let sequenceTriggered = false;
function resetState() {
    initialized = false;
}

let sliderTutorialComplete = false;
// Initialize the new music player
let musicPlayer = null;
let currentTuneKey = null;

// Current Amergin line for export to tutorialOrAdventure
let currentAmerginLineForExport = null;

// CRITICAL FIX: Declare these at module level so they're accessible everywhere
let currentChampionIndex = 0;
let validChampions = [];
let audioUnlocked = true;
let lastMusicChangeTime = 0;
const MUSIC_CHANGE_DELAY = 500;

let initialSliderValue = 0.05;

// Module-level scrollContainer reference
let scrollContainer = null;

// Swipe nudge state
let swipeNudgeTimer = null;
let swipeNudgeCancelled = false;
let swipeNudgePanning = false;   // true while the nudge itself is moving scrollLeft

// Stat descriptions
const statDescriptions = {
  attack: { irish: "Troid", english: "Fight" },
  defense: { irish: "Cosain", english: "Defend" },
  health: { irish: "Sláinte", english: "Health" }
};

const statIcons = {
  attack: '⚔️',
  defense: '🛡️',
  health: '❤️'
};


// Make sure startGame is globally available
 if (!window.startGame) {
     window.startGame = startGame;
     }


function createStatsDisplay(champion, currentOpacity) {
    if (!champion || !champion.stats) return null;

    const statsContainer = document.createElement('div');
    statsContainer.id = 'global-stats-bar';
    statsContainer.style.cssText = `
        position: fixed !important;
        bottom: 120px !important;
        left: 0 !important;
        right: 0 !important;
        border-top: 2px solid #d4af37 !important;
        z-index: 10005 !important;
        padding: 15px !important;
        display: flex !important;
        justify-content: center !important;
        gap: 40px !important;
        pointer-events: auto !important;
    `;

    const statIconsLocal = { attack: '⚔️', defense: '🛡️', health: '❤️' };

    ['attack', 'defense', 'health'].forEach(statName => {
        if (champion.stats[statName] !== undefined) {
            const item = document.createElement('div');
            item.style.cssText = `
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                cursor: pointer !important;
                pointer-events: auto !important;
            `;

            item.innerHTML = `
                <span style="font-size: 2.5rem; margin-bottom: 5px;">${statIconsLocal[statName]}</span>
                <span style="color: #d4af37; font-family: monospace; font-weight: bold; font-size: 1.3rem;">
                    ${champion.stats[statName]}
                </span>
            `;

            item.onclick = (e) => {
                e.stopPropagation();
                cancelSwipeNudge();
                createStatPopup(statName, currentOpacity);
            };

            item.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                cancelSwipeNudge();
                createStatPopup(statName, currentOpacity);
            }, { passive: true });

            statsContainer.appendChild(item);
        }
    });

    return statsContainer;
}

function createStatPopup(statName, englishOpacity) {
  console.log('Creating stat popup for:', statName, 'opacity:', englishOpacity);

  const existing = document.getElementById('statPopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'statPopup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.92);
    border: 3px solid #d4af37;
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

  const iconElement = document.createElement('div');
  iconElement.style.cssText = `
    font-size: 3rem;
    text-align: center;
    height: 4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `;
  iconElement.textContent = statIcons[statName];

  const irishText = document.createElement('div');
  irishText.id = 'statPopupIrish';
  irishText.style.cssText = `
    font-size: 1.4rem;
    color: #ffff00;
    line-height: 1.5;
    font-family: Urchlo !important;
    text-align: center;
    height: 2.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  `;
  irishText.textContent = '';

  const englishText = document.createElement('div');
  englishText.id = 'statPopupEnglish';
  
  const slider = document.querySelector('.champion-slider');
  const liveOpacity = slider ? parseFloat(slider.value) : englishOpacity;

  englishText.style.cssText = `
    font-size: 1.1rem;
    color: rgba(0, 255, 0, ${liveOpacity});
    line-height: 1.5;
    font-family: CourierPrime !important;
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

  popup.appendChild(iconElement);
  popup.appendChild(irishText);
  popup.appendChild(englishText);

  if (!document.getElementById('statPopupStyle')) {
    const style = document.createElement('style');
    style.id = 'statPopupStyle';
    style.textContent = `
      @keyframes popupFadeIn { 
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } 
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); } 
      }
      @keyframes popupFadeOut { 
        from { opacity: 1; transform: translate(-50%, -50%) scale(1); } 
        to { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } 
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
  const englishString = statDescriptions[statName].english;
  let charIndex = 0;

  function typeNextChar() {
    if (charIndex < irishString.length) {
      const span = document.createElement('span');
      span.textContent = irishString[charIndex];
      span.style.cssText = `display: inline; animation: letterGlow 0.4s ease;`;
      irishText.appendChild(span);
      charIndex++;
      setTimeout(typeNextChar, 400 / irishString.length + 20);
    } else {
      setTimeout(() => {
        // Text already set - just fade in by opacity
        englishText.style.opacity = liveOpacity;

        if (slider) {
          const updatePopupColor = () => {
            englishText.style.color = `rgba(0, 255, 0, ${slider.value})`;
          };
          slider.addEventListener('input', updatePopupColor);

          const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
              mutation.removedNodes.forEach(node => {
                if (node === popup) {
                  slider.removeEventListener('input', updatePopupColor);
                  observer.disconnect();
                }
              });
            });
          });
          observer.observe(document.body, { childList: true });
        }

        autoCloseTimer = setTimeout(closePopup, 2700);
      }, 500);
    }
  }

  typeNextChar();
}

let globalStatsBar = null;

function updateGlobalStats(champion) {
    if (globalStatsBar) globalStatsBar.remove();
    
    const slider = document.querySelector('.champion-slider');
    const currentOpacity = slider ? parseFloat(slider.value) : 0.15;
    
    globalStatsBar = createStatsDisplay(champion, currentOpacity);
    
    if (globalStatsBar) {
        // Hide stats during tutorial
        if (!sliderTutorialComplete) {
            globalStatsBar.style.opacity = '0';
        }
        
        document.body.appendChild(globalStatsBar);

        const statValues = globalStatsBar.querySelectorAll('span:last-child');
        statValues.forEach((val, index) => {
            setTimeout(() => {
                val.classList.add('stat-animate');
            }, index * 50);
        });
    }
}

export function initHeroSelect() {
    console.log('[HeroSelect] initHeroSelect called, initialized:', initialized);
    if (initialized) {
        console.log('[HeroSelect] Already initialized, returning');
        return;
    }
    initialized = true;

initConstellationScene(async (sliderValue, amerginLine) => {
    console.log('[HeroSelect] Intro complete, slider value:', sliderValue);
    console.log('[HeroSelect] Current Amergin line:', amerginLine);

    initialSliderValue = sliderValue;
    currentAmerginLineForExport = amerginLine;

    console.log('[HeroSelect] Waiting for preloaded hero assets...');
    await waitForHeroAssets();
    console.log('[HeroSelect] Assets ready. Initializing hero select.');

    initMainHeroSelect();
});}

function initMainHeroSelect() {
    console.log('[HeroSelect] Initializing main hero select');
    
    const container = document.getElementById('heroSelect');
    if (!container) return;

    container.style.position = 'relative';
    container.style.zIndex = '10002';
    container.style.opacity = '0';  // stay invisible until veil sequence reveals

    sliderTutorialComplete = true; // Skip tutorial, intro handled it
    
    // CRITICAL FIX: Use module-level variables instead of local ones
    audioUnlocked = true; // Audio was unlocked in intro modal
    let englishOpacity = initialSliderValue; // Use value from intro modal
    currentChampionIndex = 0; // Use module-level variable
    
    // Use pre-warmed music player if available, otherwise create new one
    if (!musicPlayer) {
        musicPlayer = getPrewarmedPlayer() || new TradSessionPlayer();
        console.log('[HeroSelect] Music player initialized');
    }
    
    // Canvas starfield from index.html is already running - no need to init another one
    console.log('[HeroSelect] Using canvas starfield from index.html');

    // GET PRELOADED ASSETS - everything is ready!
    const preloaded = getPreloadedAssets();
    const sheet = preloaded.spriteSheet;
    const atlasData = preloaded.atlasData;
    const allValidChampions = preloaded.validChampions;
    const firstChampionCanvas = preloaded.firstChampionCanvas;
    const randomStartIndex = preloaded.randomStartIndex;
    
    const CHAMPION_SUBSET_SIZE = 30;
    
    const shuffled = [...allValidChampions].sort(() => Math.random() - 0.5);
    validChampions = shuffled.slice(0, CHAMPION_SUBSET_SIZE);
    
    const preRenderedChamp = allValidChampions[randomStartIndex];
    if (!validChampions.includes(preRenderedChamp)) {
        validChampions[0] = preRenderedChamp;
    }
    
    const newStartIndex = validChampions.indexOf(preRenderedChamp);
    
    console.log('[HeroSelect] Using preloaded assets:', {
        sheet: !!sheet,
        atlasData: !!atlasData,
        totalChampions: allValidChampions.length,
        selectedSubset: validChampions.length,
        firstCanvas: !!firstChampionCanvas,
        firstCanvasSize: firstChampionCanvas ? `${firstChampionCanvas.width}x${firstChampionCanvas.height}` : 'N/A',
        preRenderedChamp: preRenderedChamp ? preRenderedChamp.nameEn : 'N/A',
        startIndex: newStartIndex
    });
    
    const layoutStyle = document.createElement('style');
    layoutStyle.textContent = `
@keyframes statPulse {
    0% { transform: scale(1); filter: brightness(1); }
    30% { transform: scale(1.2); filter: brightness(1.8) drop-shadow(0 0 10px #d4af37); }
    100% { transform: scale(1); filter: brightness(1); }
}

@keyframes swipeWiggle {
    0%   { transform: translateX(0) scaleY(1); }
    12%  { transform: translateX(-32px) scaleY(0.96); }
    30%  { transform: translateX(26px) scaleY(1.03); }
    48%  { transform: translateX(-16px) scaleY(0.98); }
    64%  { transform: translateX(10px) scaleY(1.01); }
    80%  { transform: translateX(-5px) scaleY(1); }
    100% { transform: translateX(0) scaleY(1); }
}

@keyframes championBoogie {
    /* --- FACING RIGHT --- */
    0%, 24.9% { transform: translateY(0px) scale(1, 1); }
    12.5% { transform: translateY(-12px) scale(0.9, 1.15) rotate(3deg); }
    
    /* --- SNAP FLIP LEFT --- */
    25%, 49.9% { transform: translateY(0px) scale(-1, 1); }
    37.5% { transform: translateY(-12px) scale(-0.9, 1.15) rotate(-3deg); }

    /* --- SNAP FLIP RIGHT --- */
    50%, 74.9% { transform: translateY(0px) scale(1, 1); }
    62.5% { transform: translateY(-12px) scale(0.9, 1.15) rotate(3deg); }

    /* --- SNAP FLIP LEFT --- */
    75%, 99.9% { transform: translateY(0px) scale(-1, 1); }
    87.5% { transform: translateY(-12px) scale(-0.9, 1.15) rotate(-3deg); }
    
    100% { transform: translateY(0px) scale(1, 1); }
}

.champion-canvas.floating {
    animation: championBoogie 2s linear infinite;
    transform-origin: bottom center;
}

.stat-animate {
    animation: statPulse 0.4s ease-out;
}

.hero-select-container {
    display: flex; flex-direction: column; height: 100vh; width: 100vw; overflow: hidden;
    background: transparent; position: relative;
}

.champion-scroll {
    flex: 1; 
    display: flex; 
    overflow-x: auto; 
    scroll-snap-type: x proximity;
    scrollbar-width: none; 
    -ms-overflow-style: none;
    overflow-y: visible !important;
    -webkit-overflow-scrolling: touch;
} 

.champion-scroll::-webkit-scrollbar { display: none; }

.champion-card {
    min-width: 100vw;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center !important; 
    scroll-snap-align: start;
    box-sizing: border-box;
    text-align: center;
    padding-bottom: 180px;
}

.champion-canvas {
    max-width: 85%; 
    max-height: 55vh; 
    object-fit: contain; 
    margin-bottom: 20px;
    filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5));
}

.champion-name-ga {
    font-family: Urchlo, serif; 
    font-size: 3rem;
    color: #d4af37; 
    margin: 10px 0 5px 0;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
}

.champion-name-en {
    font-family: CourrierPrime; 
    font-size: 1.4rem; 
    margin-bottom: 20px;
}

.champion-top-panel { 
    padding: 20px; 
    z-index: 10; 
    display: flex; 
    justify-content: center; 
    align-items: center;
    width: 100%;
    box-sizing: border-box;
}

.champion-bottom-panel { padding: 20px; z-index: 10; }
   `;
    document.head.appendChild(layoutStyle);

    container.className = 'hero-select-container';
    scrollContainer = document.createElement('div');
    scrollContainer.className = 'champion-scroll';
    scrollContainer.style.opacity = '0';
    scrollContainer.style.transition = 'opacity 0.3s ease';
    scrollContainer.style.webkitOverflowScrolling = 'touch';
    scrollContainer.style.scrollBehavior = 'auto';
    container.appendChild(scrollContainer);

    const topPanel = document.createElement('div');
    topPanel.className = 'champion-top-panel';
    topPanel.style.cssText = `
        position: fixed;
        top: 10px;
        left: 0;
        width: 100%;
        z-index: 10001;
        padding: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
    `;

    // ── Slider with moon canvas thumb ────────────────────────────────────────

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.05;
    slider.value = initialSliderValue;
    slider.className = 'champion-slider';

    const sliderStyle = document.createElement('style');
    sliderStyle.id = 'sunSliderStyle';
    sliderStyle.textContent = `
        @keyframes letterGlow {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
        }

        .champion-slider {
            -webkit-appearance: none !important;
            appearance: none !important;
            width: 100% !important;
            height: 10px !important;
            background: #444 !important;
            border-radius: 5px !important;
            outline: none !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block;
            cursor: pointer;
        }

        /* Hide native thumb — moon canvas replaces it */
        .champion-slider::-webkit-slider-thumb {
            -webkit-appearance: none !important;
            appearance: none !important;
            width: 0px !important;
            height: 0px !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }

        .champion-slider::-moz-range-thumb {
            width: 0px !important;
            height: 0px !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }
    `;
    document.head.appendChild(sliderStyle);

    // Moon canvas
    const moonR = Math.round(window.innerHeight * 0.025);
    const moonD = moonR * 2;
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width  = moonD;
    moonCanvas.height = moonD;
  moonCanvas.style.cssText = `
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: ${moonD}px;
    height: ${moonD}px;
    pointer-events: none;
    z-index: 2;
`;

slider.style.cssText = `position: relative; z-index: 1;`; 


function drawMoon(phase) {
    const ctx = moonCanvas.getContext('2d');
    const r   = moonR;
    const cx  = r, cy = r;
    ctx.clearRect(0, 0, moonCanvas.width, moonCanvas.height);

    // Outer glow
    const grd = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.6);
    grd.addColorStop(0, `rgba(200,220,255,${0.12 + phase * 0.10})`);
    grd.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // ← ADD THIS: dark side fill so track doesn't show through
    ctx.fillStyle = 'rgb(8, 4, 30)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.fill();

    // Moon body (lit portion drawn on top)
    ctx.fillStyle = `rgb(${Math.round(200 + phase * 35)}, ${Math.round(210 + phase * 30)}, ${Math.round(220 + phase * 20)})`;


        ctx.beginPath();
        if (phase >= 0.99) {
            ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        } else {
            const terminatorX = r * 0.92 * Math.cos(phase * Math.PI);
            ctx.arc(cx, cy, r * 0.92, -Math.PI / 2, Math.PI / 2);
            ctx.ellipse(cx, cy, Math.abs(terminatorX), r * 0.92, 0, Math.PI / 2, -Math.PI / 2, terminatorX > 0);
        }
        ctx.fill();

        // Rim highlight
        ctx.strokeStyle = `rgba(200,220,255,${0.15 + phase * 0.25})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Wrapper: slider + moon canvas stacked
    const sliderWrapper = document.createElement('div');
    sliderWrapper.style.cssText = `
        position: relative;
        width: 90%;
        display: flex;
        align-items: center;
        height: ${moonD + 10}px;
    `;

    function positionMoon(val) {
        const trackW = sliderWrapper.offsetWidth;
        const margin = moonR;
        const usable = trackW - margin * 2;
        moonCanvas.style.left = (margin + val * usable - moonR) + 'px';
        drawMoon(val);
    }

    const initialTrackPercent = initialSliderValue * 100;
    slider.style.background = `linear-gradient(to right, #d4af37 0%, #d4af37 ${initialTrackPercent}%, #444 ${initialTrackPercent}%, #444 100%)`;

    slider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        const percent = val * 100;
        slider.style.background = `linear-gradient(to right, #d4af37 0%, #d4af37 ${percent}%, #444 ${percent}%, #444 100%)`;
        positionMoon(val);

        englishOpacity = val;
        document.querySelectorAll('.champion-name-en').forEach(el => {
            el.style.color = `rgba(0, 255, 0, ${val})`;
        });

        const popup = document.getElementById('statPopupEnglish');
        if (popup) popup.style.color = `rgba(0, 255, 0, ${val})`;
    };

    sliderWrapper.appendChild(slider);
    sliderWrapper.appendChild(moonCanvas);
    topPanel.appendChild(sliderWrapper);

    // Draw moon at initial position once in DOM
    requestAnimationFrame(() => positionMoon(initialSliderValue));

    // ── End moon slider ───────────────────────────────────────────────────────

    container.appendChild(topPanel);
    topPanel.style.zIndex = '10001';

    const bottomPanel = document.createElement('div');
    bottomPanel.className = 'champion-bottom-panel';
    bottomPanel.style.opacity = '0';  // hidden until atmospheric entrance reveals it
    const chooseButton = document.createElement('button');
    chooseButton.className = 'champion-choose-button';
    chooseButton.textContent = 'Ar Aghaidh';
    chooseButton.style.cssText = `
        width: 100%; padding: 1.2rem; font-size: 1.3rem; color: #1a1a1a;
        background: linear-gradient(145deg, #8b4513, #d2691e, #8b4513);
        border: 3px solid #d2691e; border-radius: 12px; cursor: pointer;
        text-transform: uppercase; letter-spacing: 2px; font-family: Urchlo;
    `;

    chooseButton.onclick = async () => {
        cancelSwipeNudge();
        console.log('[DEBUG] Continue button clicked');

        try {
            const el = document.documentElement;
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (el.requestFullscreen) {
                    el.requestFullscreen().catch(e => console.warn('[HeroSelect] Fullscreen failed:', e));
                } else if (el.webkitRequestFullscreen) {
                    el.webkitRequestFullscreen();
                }
            }
        } catch(e) {
            console.warn('[HeroSelect] Fullscreen error:', e);
        }

        console.log('[DEBUG] currentChampionIndex:', currentChampionIndex);
        console.log('[DEBUG] validChampions length:', validChampions.length);
        console.log('[DEBUG] Champion at index:', validChampions[currentChampionIndex]);
        
        if (validChampions[currentChampionIndex]) {
            const musicReady = musicPlayer && 
                              musicPlayer.tracks && 
                              musicPlayer.tracks.length > 0 &&
                              musicPlayer.tracks.every(t => t && t.name && typeof t.active !== 'undefined');
            
            if (musicReady) {
                console.log('[DEBUG] Music ready, unmuting piano...');
                await unmutePiano();
                console.log('[DEBUG] Waiting 800ms for piano to be heard...');
                setTimeout(() => {
                    finalize(validChampions[currentChampionIndex]);
                }, 800);
            } else {
                console.warn('[DEBUG] Music not fully loaded yet, proceeding without unmuting');
                setTimeout(() => {
                    finalize(validChampions[currentChampionIndex]);
                }, 200);
            }
        } else {
            console.error('[DEBUG] No champion at currentChampionIndex:', currentChampionIndex);
        }
    };
    
    bottomPanel.appendChild(chooseButton);
    container.appendChild(bottomPanel);

    // RENDER ALL CHAMPIONS with batching for speed
    console.log('[HeroSelect] Starting champion rendering');
    
    currentChampionIndex = newStartIndex;
    
    const infiniteChampions = [...validChampions, ...validChampions, ...validChampions];
    const targetScroll = window.innerWidth * (validChampions.length + newStartIndex);
    const firstChamp = validChampions[newStartIndex];
    
    const BATCH_SIZE = 30;
    let currentIndex = 0;
    let hasScrolled = false;
    
    function renderBatch() {
        const endIndex = Math.min(currentIndex + BATCH_SIZE, infiniteChampions.length);
        
        for (let i = currentIndex; i < endIndex; i++) {
            const champ = infiniteChampions[i];
            const frameName = champ.spriteKey.endsWith('.png') ? champ.spriteKey : `${champ.spriteKey}.png`;
            const frameData = atlasData.textures[0].frames.find(f => f.filename === frameName);
            if (!frameData) continue;
            
            const card = document.createElement('div');
            card.className = 'champion-card';
            card.onclick = () => {
                try {
                    const el = document.documentElement;
                    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                        if (el.requestFullscreen) {
                            el.requestFullscreen().catch(e => console.warn('[HeroSelect] Fullscreen failed:', e));
                        } else if (el.webkitRequestFullscreen) {
                            el.webkitRequestFullscreen();
                        }
                    }
                } catch(e) {
                    console.warn('[HeroSelect] Fullscreen error:', e);
                }
                showCharacterModal(champ);
            };
            
            let canvas;
            if (i === validChampions.length + newStartIndex && firstChampionCanvas) {
                console.log('[HeroSelect] Using pre-rendered canvas for champion', i);
                canvas = document.createElement('canvas');
                canvas.className = 'champion-canvas floating';
                canvas.width = firstChampionCanvas.width;
                canvas.height = firstChampionCanvas.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(firstChampionCanvas, 0, 0);
            } else {
                canvas = document.createElement('canvas');
                canvas.className = 'champion-canvas floating';
                canvas.width = frameData.frame.w;
                canvas.height = frameData.frame.h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(sheet, frameData.frame.x, frameData.frame.y, frameData.frame.w, frameData.frame.h, 0, 0, frameData.frame.w, frameData.frame.h);
            }
            
            const nameGa = document.createElement('div');
            nameGa.className = 'champion-name-ga';
            nameGa.textContent = champ.nameGa;
            
            const nameEn = document.createElement('div');
            nameEn.className = 'champion-name-en';
            nameEn.textContent = champ.nameEn;
            nameEn.style.color = `rgba(0, 255, 0, ${englishOpacity})`;
            
            card.appendChild(canvas);
            card.appendChild(nameGa);
            card.appendChild(nameEn);
            
            scrollContainer.appendChild(card);
        }
        
        currentIndex = endIndex;
        
        if (!hasScrolled && currentIndex >= (validChampions.length + newStartIndex + 1)) {
            scrollContainer.scrollLeft = targetScroll;
            hasScrolled = true;

            // ── Staged atmospheric entrance ───────────────────────────────────
            // 1. Keep everything hidden. Show a dark veil with a brief Irish
            //    invocation that bridges from the constellation scene.
            // 2. After the veil lifts, reveal the champion with a rise-from-mist.
            // 3. Top panel and stats drift in last so the hero gets the stage.

            const veil = document.createElement('div');
            veil.style.cssText = `
                position: fixed; inset: 0; z-index: 99998;
                background: #00060f;
                pointer-events: none;
                opacity: 1;
                transition: opacity 1.8s ease;
            `;

            // Brief invocation — same style as constellation scene text
            const invocationWrap = document.createElement('div');
            invocationWrap.style.cssText = `
                position: absolute; inset: 0;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                gap: 1rem; pointer-events: none;
            `;

            const invocIrish = document.createElement('div');
            invocIrish.textContent = ' ';
            invocIrish.style.cssText = `
                font-family: Urchlo, serif;
                font-size: clamp(1.6rem, 5vw, 2.6rem);
                color: #d4af37;
                text-align: center;
                padding: 0 8%;
                opacity: 0;
                transform: translateY(12px);
                transition: opacity 1s ease, transform 1s ease;
                text-shadow: 0 0 30px rgba(212,175,55,0.4);
            `;

            const invocEnglish = document.createElement('div');
            invocEnglish.textContent = ' ';
            invocEnglish.style.cssText = `
                font-family: "Courier New", monospace;
                font-size: clamp(0.9rem, 2.8vw, 1.3rem);
                color: rgba(155, 141, 189, ${initialSliderValue});
                text-align: center;
                padding: 0 8%;
                opacity: 0;
                transform: translateY(8px);
                transition: opacity 0.8s ease 0.4s, transform 0.8s ease 0.4s;
            `;

            invocationWrap.appendChild(invocIrish);
            invocationWrap.appendChild(invocEnglish);
            veil.appendChild(invocationWrap);
            document.body.appendChild(veil);

            // Hide all UI until veil lifts
            scrollContainer.style.opacity = '0';
            scrollContainer.style.transform = 'translateY(28px)';
            scrollContainer.style.transition = 'opacity 1.4s ease, transform 1.4s ease';
            topPanel.style.opacity = '0';
            topPanel.style.transition = 'opacity 1s ease';
            bottomPanel.style.opacity = '0';
            bottomPanel.style.transition = 'opacity 1s ease';

            // Start music immediately (under the veil, seamless from constellation)
            try {
                const tuneKey = getTuneKeyForChampion(firstChamp);
                if (tuneKey && !musicPlayer.isPlaying) {
                    playChampionTune(tuneKey);
                }
            } catch (e) {
                console.error('[HeroSelect] Error starting music:', e);
            }

            // Phase 1 (0ms): fade in the invocation text
            requestAnimationFrame(() => {
                invocIrish.style.opacity   = '1';
                invocIrish.style.transform = 'translateY(0)';
                setTimeout(() => {
                    invocEnglish.style.opacity   = '1';
                    invocEnglish.style.transform = 'translateY(0)';
                }, 300);
            });

            // Phase 2 (1800ms): fade out invocation, lift veil
            setTimeout(() => {
                invocIrish.style.transition   = 'opacity 0.9s ease, transform 0.9s ease';
                invocEnglish.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
                invocIrish.style.opacity      = '0';
                invocIrish.style.transform    = 'translateY(-10px)';
                invocEnglish.style.opacity    = '0';
                invocEnglish.style.transform  = 'translateY(-8px)';

                setTimeout(() => {
                    // Reveal the hero content BEFORE the veil fades — it sits
                    // under the veil so the starfield is never exposed.
                    const heroContainer = document.getElementById('heroSelect');
                    if (heroContainer) {
                        heroContainer.style.transition = 'opacity 0.01s';
                        heroContainer.style.opacity = '1';
                    }
                    scrollContainer.style.opacity   = '1';
                    scrollContainer.style.transform = 'translateY(0)';
                    updateGlobalStats(firstChamp);

                    // Now start the veil fade with content safely underneath
                    veil.style.opacity = '0';

                    // Phase 3 (700ms): top panel settles in as veil clears
                    setTimeout(() => {
                        topPanel.style.opacity = '1';

                        if (globalStatsBar) {
                            globalStatsBar.style.opacity      = '0';
                            globalStatsBar.style.transform    = 'translateY(10px)';
                            globalStatsBar.style.transition   = 'opacity 0.9s ease, transform 0.9s ease';
                            globalStatsBar.style.pointerEvents = 'auto';
                            requestAnimationFrame(() => {
                                globalStatsBar.style.opacity   = '1';
                                globalStatsBar.style.transform = 'translateY(0)';
                            });
                        }

                        // Phase 4: action button last
                        setTimeout(() => {
                            bottomPanel.style.opacity = '1';
                            veil.remove();
                            runSwipeNudge();
                        }, 900);

                    }, 600);
                }, 700);

            }, 1800);

            console.log('[HeroSelect] ✓ Atmospheric entrance sequence started');
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

function cancelSwipeNudge() {
    swipeNudgeCancelled = true;
    swipeNudgePanning = false;
    if (swipeNudgeTimer) { clearTimeout(swipeNudgeTimer); swipeNudgeTimer = null; }
    if (scrollContainer) scrollContainer.style.scrollSnapType = 'x proximity';
}

function runSwipeNudge() {
    if (!scrollContainer || swipeNudgeCancelled) return;
    swipeNudgeCancelled = false;

    // How far to pan — enough to reveal the neighbouring champion's edge + name
    const PAN_PX    = Math.round(window.innerWidth * 0.42);
    const EASE_MS   = 380;   // ms per leg of the pan
    const HOLD_MS   = 120;   // pause at the extremes
    const REPEAT_MS = 3000;  // gap between full cycles

    function easeInOut(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function animatePan(fromX, toX, durationMs, onDone) {
        const start = performance.now();
        const loop  = (now) => {
            if (swipeNudgeCancelled) { scrollContainer.scrollLeft = fromX; return; }
            const raw = Math.min((now - start) / durationMs, 1);
            scrollContainer.scrollLeft = fromX + (toX - fromX) * easeInOut(raw);
            if (raw < 1) requestAnimationFrame(loop);
            else onDone();
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
                            if (!swipeNudgeCancelled) {
                                swipeNudgeTimer = setTimeout(runCycle, REPEAT_MS);
                            }
                        });
                    }, HOLD_MS);
                });
            }, HOLD_MS);
        });
    }

    runCycle();
}

function initSwipe(scrollContainer, champCount) {
    let lastScrollLeft = scrollContainer.scrollLeft;
    let debounceTimer = null;
    let isScrolling = false;

    scrollContainer.addEventListener('scroll', () => {
        // Ignore scroll events that we triggered ourselves
        if (!swipeNudgePanning) cancelSwipeNudge();
        isScrolling = true;
        clearTimeout(debounceTimer);
        
        debounceTimer = setTimeout(() => {
            const newScrollLeft = scrollContainer.scrollLeft;
            const w = window.innerWidth;
            
            const rawIndex = Math.round(newScrollLeft / w);
            const actualIndex = rawIndex % champCount;
            
            if (actualIndex !== currentChampionIndex) {
                currentChampionIndex = actualIndex;
                console.log('[HeroSelect] Swiped to champion:', currentChampionIndex, validChampions[currentChampionIndex].nameEn);
                
                updateGlobalStats(validChampions[currentChampionIndex]);
                
                const now = Date.now();
                if (now - lastMusicChangeTime > MUSIC_CHANGE_DELAY) {
                    lastMusicChangeTime = now;
                    const tuneKey = getTuneKeyForChampion(validChampions[currentChampionIndex]);
                    if (tuneKey && tuneKey !== currentTuneKey) {
                        playChampionTune(tuneKey);
                    }
                }
            }
            
            if (newScrollLeft < w * 0.5) {
                scrollContainer.style.scrollSnapType = 'none';
                scrollContainer.scrollLeft = newScrollLeft + (champCount * w);
                requestAnimationFrame(() => {
                    scrollContainer.style.scrollSnapType = 'x proximity';
                });
            } else if (newScrollLeft > (champCount * 2 - 0.5) * w) {
                scrollContainer.style.scrollSnapType = 'none';
                scrollContainer.scrollLeft = newScrollLeft - (champCount * w);
                requestAnimationFrame(() => {
                    scrollContainer.style.scrollSnapType = 'x proximity';
                });
            }
            
            lastScrollLeft = newScrollLeft;
            isScrolling = false;
        }, 100);
    });
}

function showStatsBar() {
    if (globalStatsBar) {
        globalStatsBar.style.transition = 'opacity 0.5s ease';
        globalStatsBar.style.opacity = '1';
        globalStatsBar.style.pointerEvents = 'auto';
    }
}

async function playChampionTune(tuneKey) {
    if (!tuneKey || !musicPlayer) {
        console.warn('[HeroSelect] Cannot play tune - missing tuneKey or musicPlayer');
        return;
    }
    
    console.log('[DEBUG] playChampionTune called with tuneKey:', tuneKey);
    console.log('[DEBUG] Current tune:', currentTuneKey);
    console.log('[DEBUG] Music player isPlaying:', musicPlayer.isPlaying);
    
    if (currentTuneKey === tuneKey && musicPlayer.isPlaying) {
        console.log('[DEBUG] Already playing this tune, skipping');
        return;
    }
    
    if (currentTuneKey && musicPlayer.isPlaying) {
        console.log('[DEBUG] Crossfading from', currentTuneKey, 'to', tuneKey);
        
        try {
            const oldTracks = musicPlayer.tracks ? [...musicPlayer.tracks] : [];
            console.log('[DEBUG] Captured old tracks:', oldTracks.length);
            
            for (const track of oldTracks) {
                if (track && track.gain) {
                    const currentGain = track.gain.gain.value;
                    track.gain.gain.setValueAtTime(currentGain, musicPlayer.audioContext.currentTime);
                    track.gain.gain.linearRampToValueAtTime(0, musicPlayer.audioContext.currentTime + 1.0);
                    console.log('[DEBUG] Fading out track:', track.name);
                }
            }
            
            const loaded = await musicPlayer.loadTune(tuneKey, false);
            
            if (!loaded) {
                console.error('[DEBUG] Failed to load new tune');
                return;
            }
            
            currentTuneKey = tuneKey;
            console.log('[DEBUG] New tune loaded, starting playback...');
            
            await musicPlayer.play();
            
            console.log('[DEBUG] New tune playing');
            
            const activeTrackNames = musicPlayer.tracks.filter(t => t.active).map(t => t.name);
            console.log('[DEBUG] Active tracks:', activeTrackNames);
            
            if (activeTrackNames.length !== 1 || !musicPlayer.tracks[0].active) {
                console.warn('[DEBUG] Unexpected track state, fixing...');
                for (let i = 0; i < musicPlayer.tracks.length; i++) {
                    if (i === 0 && !musicPlayer.tracks[i].active) {
                        musicPlayer.toggleInstrument(i);
                    } else if (i !== 0 && musicPlayer.tracks[i].active) {
                        musicPlayer.toggleInstrument(i);
                    }
                }
            }
            
            setTimeout(() => {
                console.log('[DEBUG] Stopping old synths...');
                for (const track of oldTracks) {
                    try {
                        if (track.synth && track.synth.stop) {
                            track.synth.stop();
                        }
                        if (track.gain) {
                            try {
                                track.gain.disconnect();
                            } catch (e) {}
                        }
                    } catch (e) {
                        console.log('[DEBUG] Error stopping old synth:', e);
                    }
                }
                console.log('[DEBUG] ✓ Crossfade complete');
            }, 1200);
            
        } catch (error) {
            console.error('[DEBUG] Error during crossfade:', error);
        }
        
    } else {
        // First tune or resuming - no crossfade needed
        currentTuneKey = tuneKey;
        
        try {
            const loaded = await musicPlayer.loadTune(tuneKey, false);
            
            if (!loaded) {
                console.error('[DEBUG] Failed to load tune');
                return;
            }
            
            console.log('[DEBUG] Tune loaded');
            
            await musicPlayer.play();
            
            console.log('[DEBUG] Tune playing');
            
            const activeTrackNames = musicPlayer.tracks.filter(t => t.active).map(t => t.name);
            console.log('[DEBUG] Active tracks:', activeTrackNames);
            
            if (activeTrackNames.length !== 1 || !musicPlayer.tracks[0].active) {
                console.warn('[DEBUG] Unexpected track state, fixing...');
                for (let i = 0; i < musicPlayer.tracks.length; i++) {
                    if (i === 0 && !musicPlayer.tracks[i].active) {
                        musicPlayer.toggleInstrument(i);
                    } else if (i !== 0 && musicPlayer.tracks[i].active) {
                        musicPlayer.toggleInstrument(i);
                    }
                }
            }
            
            console.log('[DEBUG] ✓ Tune playing with banjo only');
            
        } catch (error) {
            console.error('[DEBUG] Error playing tune:', error);
        }
    }
}

async function unmutePiano() {
    console.log('[DEBUG] Unmuting piano (or second instrument)');
    
    if (!musicPlayer || !musicPlayer.tracks) {
        console.warn('[DEBUG] No music player or tracks available');
        return;
    }
    
    const loadedTracks = musicPlayer.tracks.filter(t => t && t.name);
    console.log('[DEBUG] Loaded tracks:', loadedTracks.length, '/', musicPlayer.tracks.length);
    
    if (loadedTracks.length === 0) {
        console.warn('[DEBUG] No tracks loaded yet, cannot unmute');
        return;
    }
    
    console.log('[DEBUG] Available tracks:', loadedTracks.map(t => t.name));
    
    let targetIndex = musicPlayer.tracks.findIndex(t => t && t.name === 'Piano');
    
    if (targetIndex < 0) {
        console.log('[DEBUG] No Piano track, enabling second instrument instead');
        if (loadedTracks.length > 1) {
            targetIndex = 1;
        } else {
            console.log('[DEBUG] Only one track available, nothing to add');
            return;
        }
    }
    
    if (targetIndex >= 0 && musicPlayer.tracks[targetIndex] && !musicPlayer.tracks[targetIndex].active) {
        console.log('[DEBUG] Toggling ON:', musicPlayer.tracks[targetIndex].name, 'at index', targetIndex);
        await musicPlayer.toggleInstrument(targetIndex);
    } else if (targetIndex >= 0 && musicPlayer.tracks[targetIndex]) {
        console.log('[DEBUG] Track already active:', musicPlayer.tracks[targetIndex].name);
    }
}

function finalize(champ) {
    console.log('[HeroSelect] === FINALIZE CALLED ===');

    const slider = document.querySelector('.champion-slider');
    const currentSliderValue = slider ? parseFloat(slider.value) : 0.15;

    // Graceful exit — dark veil descends before handing off
    const exitVeil = document.createElement('div');
    exitVeil.id = 'heroSelectExitVeil';  // ID so showHeroSelect can remove it
    exitVeil.style.cssText = [
        'position:fixed;inset:0;z-index:99999;',
        'background:#00060f;',
        'pointer-events:all;',
        'opacity:0;',
        'transition:opacity 1.2s ease;',
    ].join('');
    document.body.appendChild(exitVeil);

    requestAnimationFrame(() => {
        exitVeil.style.opacity = '1';
    });

    setTimeout(() => {
        if (globalStatsBar) {
            globalStatsBar.style.opacity = '0';
            globalStatsBar.style.pointerEvents = 'none';
        }
        const heroSelectContainer = document.getElementById('heroSelect');
        if (heroSelectContainer) {
            heroSelectContainer.style.opacity = '0';
            heroSelectContainer.style.pointerEvents = 'none';
        }

        import('./tutorialOrAdventure.js').then(module => {
            module.initTutorialOrAdventure(champ, currentSliderValue, currentAmerginLineForExport);
        });
    }, 1100);
}

function showHeroSelect() {
    console.log('[HeroSelect] showHeroSelect() called - making visible again');

    // Remove any exitVeil left behind by finalize() — this is the black screen bug
    const staleVeil = document.getElementById('heroSelectExitVeil');
    if (staleVeil) staleVeil.remove();

    // Fade back in with a brief dark veil so the return isn't a hard pop
    const returnVeil = document.createElement('div');
    returnVeil.style.cssText = [
        'position:fixed;inset:0;z-index:99999;',
        'background:#00060f;pointer-events:all;',
        'opacity:1;transition:opacity 1.1s ease;',
    ].join('');
    document.body.appendChild(returnVeil);

    // Restore all layers that finalize() hid
    const container = document.getElementById('heroSelect');
    if (container) {
        container.style.transition = 'opacity 0.01s';
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
    }
    if (scrollContainer) {
        scrollContainer.style.opacity = '1';
        scrollContainer.style.transform = 'translateY(0)';
    }
    // Restore top and bottom panels (they may still be at 0 from first entrance)
    const topPanel = document.querySelector('.champion-top-panel');
    if (topPanel) topPanel.style.opacity = '1';
    const bottomPanel = document.querySelector('.champion-bottom-panel');
    if (bottomPanel) bottomPanel.style.opacity = '1';

    if (globalStatsBar) {
        globalStatsBar.style.opacity = '1';
        globalStatsBar.style.pointerEvents = 'auto';
    }

    // Lift the veil
    requestAnimationFrame(() => {
        returnVeil.style.opacity = '0';
        setTimeout(() => returnVeil.remove(), 1200);
    });
}

function initBackgroundParticles() {
    // Soft nebula gradient backdrop — matches constellation scene colour palette
    const nebula = document.createElement('div');
    nebula.style.cssText = [
        'position:fixed;inset:0;z-index:-2;pointer-events:none;',
        'background:radial-gradient(ellipse 80% 60% at 30% 40%, rgba(60,30,120,0.18) 0%, transparent 70%),',
        'radial-gradient(ellipse 60% 50% at 70% 60%, rgba(20,40,100,0.14) 0%, transparent 65%),',
        '#00060f;',
        'opacity:0;transition:opacity 2s ease;',
    ].join('');
    document.body.appendChild(nebula);
    // Fade nebula in after champion appears
    setTimeout(() => { nebula.style.opacity = '1'; }, 2600);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = [
        'position:fixed;top:0;left:0;width:100%;height:100%;',
        'z-index:-1;pointer-events:none;',
        'opacity:0;transition:opacity 1.8s ease;',
    ].join('');
    
    const container = document.getElementById('heroSelect');
    if (container) {
        container.insertBefore(canvas, container.firstChild);
    }
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // More stars, smaller, to echo the constellation starfield
    const particles = [];
    const particleCount = 40;
    
    class Particle {
        constructor() {
            this.reset();
        }
        
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.25;
            this.vy = (Math.random() - 0.5) * 0.25;
            this.radius = Math.random() * 1.4 + 0.3;
            this.opacity = Math.random() * 0.35 + 0.08;
            // Subtle twinkle phase
            this.twinkleSpeed = 0.008 + Math.random() * 0.012;
            this.twinkleOffset = Math.random() * Math.PI * 2;
        }
        
        update(t) {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width)  this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height)  this.vy *= -1;
            this.currentOpacity = this.opacity * (0.7 + 0.3 * Math.sin(t * this.twinkleSpeed + this.twinkleOffset));
        }
        
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 220, 255, ${this.currentOpacity})`;
            ctx.fill();
        }
    }
    
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    
    let t = 0;
    function animate() {
        t++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update(t);
            p.draw();
        });
        requestAnimationFrame(animate);
    }

    animate();
    // Fade canvas particles in after champion appears
    setTimeout(() => { canvas.style.opacity = '1'; }, 2600);
}

document.addEventListener('DOMContentLoaded', initHeroSelect);

if (document.readyState !== 'loading') {
  console.log('DOM already loaded, initializing...');
  initHeroSelect();
}

// Export current Amergin line for tutorialOrAdventure
export function getCurrentAmerginLine() {
    return currentAmerginLineForExport;
}

export function setCurrentAmerginLine(line) {
    currentAmerginLineForExport = line;
}

// Export music player accessor
export function getMusicPlayer() {
    return musicPlayer;
}

// Export function to mute second instrument
export async function muteSecondInstrument() {
    console.log('[HeroSelect] Muting second instrument');
    
    if (!musicPlayer || !musicPlayer.tracks) {
        console.warn('[HeroSelect] No music player or tracks available');
        return;
    }
    
    for (let i = 1; i < musicPlayer.tracks.length; i++) {
        if (musicPlayer.tracks[i] && musicPlayer.tracks[i].active) {
            console.log('[HeroSelect] Turning off:', musicPlayer.tracks[i].name);
            musicPlayer.toggleInstrument(i);
        }
    }
    
    console.log('[HeroSelect] Second instrument muted, back to banjo only');
}

export { showHeroSelect };

