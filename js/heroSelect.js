import { initIntroModal, getPreloadedAssets } from './introModal.js';
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

// Stat descriptions
const statDescriptions = {
  attack: { irish: "Ionsaigh", english: "Attack" },
  defense: { irish: "Cosaint", english: "Defense" },
  health: { irish: "Sláinte", english: "Health" }
};

const statIcons = {
  attack: '⚔️',
  defense: '🛡️',
  health: '❤️'
};

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
        z-index: 499 !important;
        padding: 15px !important;
        display: flex !important;
        justify-content: center !important;
        gap: 40px !important;
        pointer-events: none;
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
                pointer-events: auto;
            `;

            item.innerHTML = `
                <span style="font-size: 2.5rem; margin-bottom: 5px;">${statIconsLocal[statName]}</span>
                <span style="color: #d4af37; font-family: monospace; font-weight: bold; font-size: 1.3rem;">
                    ${champion.stats[statName]}
                </span>
            `;

            item.onclick = (e) => {
                e.stopPropagation();
                createStatPopup(statName, currentOpacity);
            };

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
    background: rgba(0,0,0, 0.98);
    border: 3px solid #d4af37;
    border-radius: 15px;
    padding: 1.5rem;
    width: 100%;
    max-width: 90%;
    min-height: 180px;
    height: auto;
    z-index: 10000;
    box-shadow: 0 10px 40px rgba(0,0,0,0.8);
    animation: popupFadeIn 0.2s ease-out;
    cursor: pointer;
  `;

  const iconElement = document.createElement('div');
  iconElement.style.cssText = `font-size: 3rem; text-align: center; margin-bottom: 1rem;`;
  iconElement.textContent = statIcons[statName];

  const irishText = document.createElement('div');
  irishText.id = 'statPopupIrish';
  irishText.style.cssText = `
    font-size: 1.4rem;
    color: #ffff00;
    margin-bottom: 0.8rem;
    line-height: 1.5;
    font-family: Aonchlo !important;
    text-align: center;
    min-height: 1.8rem;
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
    transition: opacity 0.5s ease;
  `;

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
        englishText.textContent = englishString;
        englishText.style.opacity = "1";

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
    
    console.log('[HeroSelect] Calling initIntroModal...');
    // Show intro modal first
    initIntroModal((sliderValue, amerginLine) => {
        console.log('[HeroSelect] Intro complete, slider value:', sliderValue);
        console.log('[HeroSelect] Current Amergin line:', amerginLine);
        
        // Store the values from intro
        initialSliderValue = sliderValue;
        currentAmerginLineForExport = amerginLine;
        
        // Now initialize the main hero select
        initMainHeroSelect();
    });
}

function initMainHeroSelect() {
    console.log('[HeroSelect] Initializing main hero select');
    
    const container = document.getElementById('heroSelect');
    if (!container) return;

container.style.position = 'relative';
container.style.zIndex = '10002';

    initialized = true; 
    sliderTutorialComplete = true; // Skip tutorial, intro handled it
    
    // CRITICAL FIX: Use module-level variables instead of local ones
    audioUnlocked = true; // Audio was unlocked in intro modal
    let englishOpacity = initialSliderValue; // Use value from intro modal
    currentChampionIndex = 0; // Use module-level variable
    
    // Declare scrollContainer early so it's accessible in renderChampions
    let scrollContainer;
    
    // Initialize music player
    if (!musicPlayer) {
        musicPlayer = new TradSessionPlayer();
        console.log('[HeroSelect] Music player initialized');
    }
    
    // Canvas starfield from index.html is already running - no need to init another one
    console.log('[HeroSelect] Using canvas starfield from index.html');

    // Defer asset loading until after UI is created
    let sheet, atlasData, sheetLoaded;
    
    const layoutStyle = document.createElement('style');
    layoutStyle.textContent = `
@keyframes statPulse {
    0% { transform: scale(1); filter: brightness(1); }
    30% { transform: scale(1.2); filter: brightness(1.8) drop-shadow(0 0 10px #d4af37); }
    100% { transform: scale(1); filter: brightness(1); }
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
    scroll-snap-type: x mandatory;
    scrollbar-width: none; 
    -ms-overflow-style: none;
    overflow-y: visible !important;
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
    font-family: Aonchlo, serif; 
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
    scrollContainer.style.opacity = '0'; // Hide initially
    scrollContainer.style.transition = 'opacity 0.3s ease';
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

// Create the slider element
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
        @keyframes thumbInvite {
            0% { transform: scale(1); box-shadow: 0 0 0px #ffd700; }
            50% { transform: scale(1.1); box-shadow: 0 0 20px #ffd700; } /* Scaled down slightly to avoid clipping */
            100% { transform: scale(1); box-shadow: 0 0 0px #ffd700; }
        }

        .champion-slider {
            -webkit-appearance: none !important;
            appearance: none !important;
            width: 90% !important;
            height: 10px !important;
            background: #444 !important;
            border-radius: 5px !important;
            outline: none !important;
            margin: 20px 0 !important; /* Added margin to give the thumb room to grow */
            padding: 0 !important;
        }

        .champion-slider::-webkit-slider-thumb {
            -webkit-appearance: none !important;
            appearance: none !important;
            width: 44px !important;
            height: 44px !important;
            border-radius: 50% !important;
            background: #ffd700 !important;
            cursor: pointer !important;
            border: 8px solid rgba(255, 215, 0, 0.3) !important;
            background-clip: padding-box !important;
            box-shadow: 0 0 15px rgba(0,0,0,0.5) !important;
            position: relative; 
            z-index: 2;
        }

        /* The Animation Rule */
        .slider-waiting::-webkit-slider-thumb {
            animation: thumbInvite 1.5s infinite ease-in-out !important;
            border: 4px solid #ffffff !important; /* Forces the border to be white */
            filter: drop-shadow(0 0 5px #ffd700); /* Uses filter instead of box-shadow if shadow is clipping */
        }
    `;








   if (!document.getElementById('sunSliderStyle')) document.head.appendChild(sliderStyle);

    let chooseButton;
    // 1. Define the visual update logic in one place
    const updateSliderVisuals = (opacity) => {
        englishOpacity = opacity; // Keep global variable in sync

        document.querySelectorAll('.champion-name-en').forEach(el => {
            el.style.color = `rgba(0, 255, 0, ${opacity})`;
        });
        
        const tutorialEnglish = document.querySelector('#tutorial-english-text');
        if (tutorialEnglish) {
            tutorialEnglish.style.opacity = opacity;
        }

        if (chooseButton) {
            if (opacity > 0.5) {
                chooseButton.textContent = 'Continue';
                chooseButton.style.fontFamily = '"Courier New", Courier, monospace';
                chooseButton.style.fontWeight = '300';
                chooseButton.style.letterSpacing = '1px';
                chooseButton.style.textTransform = 'none';
            } else {
                chooseButton.textContent = 'Ar Aghaidh';
                chooseButton.style.fontFamily = 'Aonchlo, serif';
                chooseButton.style.fontWeight = 'bold';
                chooseButton.style.letterSpacing = '2px';
                chooseButton.style.textTransform = 'uppercase';
            }
        }
        slider.style.background = `linear-gradient(to right, #d4af37 0%, #d4af37 ${opacity * 100}%, #444 ${opacity * 100}%, #444 100%)`;
    };

    // 2. The player dragging the slider
   







slider.oninput = e => {
    const val = Number(e.target.value);
    updateSliderVisuals(val);
};;
/////////////


    // 3. The "Imperceptible" Fade Logic
    let isUserTouchingSlider = false;
    slider.addEventListener('mousedown', () => isUserTouchingSlider = true);
    slider.addEventListener('touchstart', () => isUserTouchingSlider = true);
    window.addEventListener('mouseup', () => isUserTouchingSlider = false);
    window.addEventListener('touchend', () => isUserTouchingSlider = false);

    const applyDecay = () => {
        // Slow down the fade: 0.0001 per frame
        if (sliderTutorialComplete && !isUserTouchingSlider && englishOpacity > 0) {
            const newValue = Math.max(0, englishOpacity - 0.0001);
            slider.value = newValue; // Move the physical sun slider
            updateSliderVisuals(newValue); // Update the colors/text
        }
        requestAnimationFrame(applyDecay);
    };

    // Start the loop
    requestAnimationFrame(applyDecay);
;

    topPanel.appendChild(slider);
    container.appendChild(topPanel);

   
    // Make sure topPanel (with slider) is above the overlay
    topPanel.style.zIndex = '10001';

    const bottomPanel = document.createElement('div');
    bottomPanel.className = 'champion-bottom-panel';
    chooseButton = document.createElement('button');
    chooseButton.className = 'champion-choose-button';
    chooseButton.textContent = 'Ar Aghaidh';
    chooseButton.style.cssText = `
        width: 100%; padding: 1.2rem; font-size: 1.3rem; color: #1a1a1a;
        background: linear-gradient(145deg, #8b4513, #d2691e, #8b4513);
        border: 3px solid #d2691e; border-radius: 12px; cursor: pointer;
        text-transform: uppercase; letter-spacing: 2px; font-family: Aonchlo;
    `;
   

chooseButton.onclick = async () => {
    console.log('[DEBUG] Continue button clicked');
    console.log('[DEBUG] currentChampionIndex:', currentChampionIndex);
    console.log('[DEBUG] validChampions length:', validChampions.length);
    console.log('[DEBUG] Champion at index:', validChampions[currentChampionIndex]);
    
    if (validChampions[currentChampionIndex]) {
        // Check if music is loaded AND tracks are fully initialized
        const musicReady = musicPlayer && 
                          musicPlayer.tracks && 
                          musicPlayer.tracks.length > 0 &&
                          musicPlayer.tracks.every(t => t && t.name && typeof t.active !== 'undefined');
        
        if (musicReady) {
            // Unmute piano before transitioning
            console.log('[DEBUG] Music ready, unmuting piano...');
            await unmutePiano();
            // Wait a moment to hear the piano join in
            console.log('[DEBUG] Waiting 800ms for piano to be heard...');
            setTimeout(() => {
                finalize(validChampions[currentChampionIndex]);
            }, 800);
        } else {
            console.warn('[DEBUG] Music not fully loaded yet, proceeding without unmuting');
            // Proceed anyway after short delay
            setTimeout(() => {
                finalize(validChampions[currentChampionIndex]);
            }, 200);
        }
    } else {
        console.error('[DEBUG] No champion at currentChampionIndex:', currentChampionIndex);
    }
};
;
    bottomPanel.appendChild(chooseButton);
    container.appendChild(bottomPanel);

    // NOW load assets - UI is ready, scrollContainer exists
    const preloaded = getPreloadedAssets();
    
    if (preloaded.spriteSheet && preloaded.atlasData) {
        // Both assets preloaded - use them immediately
        sheet = preloaded.spriteSheet;
        atlasData = preloaded.atlasData;
        sheetLoaded = true;
        console.log('[HeroSelect] Using preloaded assets ✓');
        tryRender();
    } else {
        // Fallback: load assets now
        sheet = new Image();
        atlasData = null;
        sheetLoaded = false;
        
        console.log('[HeroSelect] Loading assets (not preloaded)');
        sheet.src = 'assets/champions/champions-with-kit.png';
        sheet.onload = () => {
            sheetLoaded = true;
            tryRender();
        };
        
        fetch('assets/champions/champions0.json')
            .then(res => res.json())
            .then(data => {
                atlasData = data;
                tryRender();
            });
    }

    function tryRender() {
        console.log('[HeroSelect] tryRender called - atlasData:', !!atlasData, 'sheetLoaded:', sheetLoaded, 'champions:', champions.length);
        if (atlasData && sheetLoaded && champions.length > 0) {
            console.log('[HeroSelect] All conditions met, calling renderChampions');
            renderChampions();
        } else {
            console.log('[HeroSelect] Waiting for assets...');
        }
    }

    function renderChampions() {
        // CRITICAL FIX: Use module-level validChampions instead of local variable
        validChampions = champions.filter(c => c && c.spriteKey && c.stats);
        const infiniteChampions = [...validChampions, ...validChampions, ...validChampions];

        // Calculate random index FIRST before any rendering
        const randomIndex = Math.floor(Math.random() * validChampions.length);
        currentChampionIndex = randomIndex;
        
        // Calculate target scroll position
        const targetScroll = window.innerWidth * (validChampions.length + randomIndex);
        
        console.log('[HeroSelect] Will show champion', randomIndex, ':', validChampions[randomIndex].nameEn);

        // Start music for the selected champion immediately
        try {
            const selectedChampion = validChampions[randomIndex];
            const tuneKey = getTuneKeyForChampion(selectedChampion);
            if (tuneKey && !musicPlayer.isPlaying) {
                console.log('[HeroSelect] Starting tune for:', selectedChampion.nameEn, '- tune:', tuneKey);
                playChampionTune(tuneKey);
            }
            console.log('[HeroSelect] Music started successfully, proceeding to render');
        } catch (e) {
            console.error('[HeroSelect] Error starting music:', e);
        }

        console.log('[HeroSelect] About to define renderBatch function');

        // Batch rendering to prevent freeze - render in chunks across frames
        const BATCH_SIZE = 5; // Render 5 champions per frame
        let currentIndex = 0;
        let hasScrolled = false; // Track if we've scrolled yet

        function renderBatch() {
            const endIndex = Math.min(currentIndex + BATCH_SIZE, infiniteChampions.length);
            
            
            for (let i = currentIndex; i < endIndex; i++) {
                const champ = infiniteChampions[i];
                const frameName = champ.spriteKey.endsWith('.png') ? champ.spriteKey : `${champ.spriteKey}.png`;
                const frameData = atlasData.textures[0].frames.find(f => f.filename === frameName);
                if (!frameData) continue;

                const card = document.createElement('div');
                card.className = 'champion-card';
                card.onclick = () => showCharacterModal(champ);

                const canvas = document.createElement('canvas');
                canvas.className = 'champion-canvas';
                canvas.width = frameData.frame.w; 
                canvas.height = frameData.frame.h;
                const ctx = canvas.getContext('2d');

                ctx.drawImage(sheet, frameData.frame.x, frameData.frame.y, frameData.frame.w, frameData.frame.h, 0, 0, frameData.frame.w, frameData.frame.h);

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

            // Scroll and show container once we've rendered enough cards to reach the target
            if (!hasScrolled && currentIndex >= (validChampions.length + randomIndex + 1)) {
                scrollContainer.scrollLeft = targetScroll;
                scrollContainer.style.opacity = '1';
                hasScrolled = true;
                console.log('[HeroSelect] Scrolled to and showing champion', randomIndex);
            }

            if (currentIndex < infiniteChampions.length) {
                // More to render - schedule next batch
                requestAnimationFrame(renderBatch);
            } else {
                // Rendering complete - finalize
                completeRendering();
            }
        }

        function completeRendering() {
            // Ensure container is visible (in case we didn't reach the threshold)
            if (!hasScrolled) {
                scrollContainer.scrollLeft = targetScroll;
                scrollContainer.style.opacity = '1';
                console.log('[HeroSelect] Final scroll and show');
            }
            console.log('[HeroSelect] All champions rendered');

            // Don't scroll again - we already did it during rendering
            // currentChampionIndex and scrollContainer.scrollLeft are already set

            // Don't start music immediately - wait for user to interact
            // Music will start on first swipe or after a delay

        initSwipe(scrollContainer, validChampions.length);
    initBackgroundParticles(); // Add this line
     
        updateGlobalStats(validChampions[randomIndex]);
        
        // Keep the starfield running as the background - don't hide it
        // It will stay visible behind the hero select UI
        console.log('[HeroSelect] Starfield continues as background');
        
        // Music already started before rendering - no need to start again here
        
// Show stats bar once tutorial completes
const checkAndShowStats = () => {
    if (sliderTutorialComplete && globalStatsBar) {
        showStatsBar();
    } else if (!sliderTutorialComplete) {
        setTimeout(checkAndShowStats, 100);
    }
};
checkAndShowStats();


// Start floating animation for the initial champion after tutorial completes
    const startInitialAnimation = () => {
        if (sliderTutorialComplete) {
            const allCanvases = document.querySelectorAll('.champion-canvas');
            allCanvases.forEach(canvas => canvas.classList.add('floating'));
        } else {
            setTimeout(startInitialAnimation, 100);
        }
    };
    startInitialAnimation();
        }
        
        // Start rendering in batches
        console.log('[HeroSelect] Starting batched rendering of', infiniteChampions.length, 'champions');
        requestAnimationFrame(renderBatch);
    }

    // Note: Shared starfield from index.html continues running as background



}
function runSwipeNudge() {
    const dist = window.innerWidth * 0.45;
    const start = scrollContainer.scrollLeft;

    scrollContainer.style.scrollSnapType = 'none';
    scrollContainer.style.scrollBehavior = 'smooth';

    scrollContainer.scrollLeft = start - dist;
    setTimeout(() => {
        scrollContainer.scrollLeft = start + dist;
        setTimeout(() => {
            scrollContainer.scrollLeft = start;
            setTimeout(() => {
                scrollContainer.style.scrollSnapType = 'x mandatory';
            }, 600);
        }, 700);
    }, 700);
}




function initBackgroundParticles() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        pointer-events: none;
    `;
    
    const container = document.getElementById('heroSelect');
    if (container) {
        container.insertBefore(canvas, container.firstChild);
    }
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Particle system
    const particles = [];
	const particleCount =10;
    
    class Particle {
        constructor() {
            this.reset();
        }
        
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.2; // Slight horizontal drift
            this.vy = Math.random() * 0.5 + 0.3; // Downward movement
            this.size = Math.random() * 2 + 0.5;
            this.opacity = Math.random() * 0.5 + 0.2;
            this.color = Math.random() > 0.5 ? '#d4af37' : '#ffd700'; // Gold colors
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            
            // Wrap horizontally
            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
            
            // Reset to top when reaching bottom
            if (this.y > canvas.height) {
                this.y = 0;
                this.x = Math.random() * canvas.width;
            }
        }
        
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.opacity;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    
    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    // Handle resize
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}


function showStatsBar() {
    if (!globalStatsBar) return;
    globalStatsBar.style.transition = 'opacity 0.8s ease';
    globalStatsBar.style.opacity = '1';
}

    function nudgeSlider(sliderEl, callback) {
        const trigger = (val) => { sliderEl.value = val; sliderEl.oninput({ target: sliderEl }); };
        sliderEl.style.transition = 'all 0.15s ease-out';
        const steps = [0.2, 0.4, 0.6, 0.8, 1.0, 'pause', 0.8, 0.6, 0.4, 0.2, 0.1];
        let delay = 0;
        steps.forEach(step => {
            if (step === 'pause') { delay += 600; }
            else {
                setTimeout(() => trigger(step), delay);
                delay += 150;
            }
        });
        setTimeout(() => {
            sliderEl.style.transition = 'none';
            if (callback) callback();
        }, delay + 200);
    }

   function initSwipe(container, len) {
    let isDragging = false, startX, startY, scrollL, velocity = 0, lastX, lastT, animID;
    let scrollTimeout = null;
    
    // CRITICAL FIX: Use module-level validChampions instead of redefining it
    
    const startFloating = () => {
        if (sliderTutorialComplete) {
            // Find the center champion canvas
            const allCanvases = document.querySelectorAll('.champion-canvas');
            allCanvases.forEach(canvas => canvas.classList.add('floating'));
        }
    };
    
    const stopFloating = () => {
        const allCanvases = document.querySelectorAll('.champion-canvas');
        allCanvases.forEach(canvas => canvas.classList.remove('floating'));
    };
   
    const handleTouchStart = (e) => {
        if (!sliderTutorialComplete) return;
        
        stopFloating();
        
        isDragging = true;
        startX = e.touches[0].pageX;
        startY = e.touches[0].pageY;
        scrollL = container.scrollLeft;
        lastX = startX;
        lastT = performance.now();

        if (animID) cancelAnimationFrame(animID);
        container.style.scrollSnapType = 'none';
        container.style.scrollBehavior = 'auto';
    };
   
    const handleTouchMove = (e) => {
        if (!isDragging) return;
        
        const x = e.touches[0].pageX;
        container.scrollLeft = scrollL - (x - startX);
        const now = performance.now();
        const dt = now - lastT;
        if (dt > 0) velocity = (lastX - x) / dt * 16;
        lastX = x; 
        lastT = now;
    };
  
    const handleTouchEnd = () => {
        isDragging = false;
        velocity *= 1.5;

        const decay = () => {
            container.scrollLeft += velocity;
            velocity *= 0.9;
            if (Math.abs(velocity) > 0.1) {
                animID = requestAnimationFrame(decay);
                return;
            }
            const w = window.innerWidth;
            const target = Math.round(container.scrollLeft / w);
            container.style.scrollBehavior = 'smooth';
            container.scrollTo({ left: target * w, behavior: 'smooth' });
            
            setTimeout(() => {
                container.style.scrollSnapType = 'x mandatory';
                
                const realIndex = (target % len + len) % len;
                const currentChamp = validChampions[realIndex];

                if (currentChampionIndex !== realIndex) {
                    currentChampionIndex = realIndex;
                    
                    updateGlobalStats(currentChamp);

                    const now = Date.now();
                    if (audioUnlocked && (now - lastMusicChangeTime) >= MUSIC_CHANGE_DELAY) {
                        lastMusicChangeTime = now;
                        
                        if (currentChamp) {
                            console.log('[DEBUG] Champion changed to:', currentChamp.nameEn);
                            const tuneKey = getTuneKeyForChampion(currentChamp);
                            console.log('[DEBUG] Playing tune:', tuneKey);
                            if (tuneKey) {
                                playChampionTune(tuneKey);
                            }
                        }
                    }
                }

                container.scrollLeft = (len + realIndex) * w;
                
                // CRITICAL FIX: Resume floating animation after scroll settles
                if (scrollTimeout) clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(startFloating, 500);
            }, 350);
        };

        decay();
    };
   
    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove);
    container.addEventListener('touchend', handleTouchEnd);
} 

async function playChampionTune(tuneKey) {
    console.log('[DEBUG] Playing tune:', tuneKey);
    
    if (!musicPlayer) {
        console.warn('[DEBUG] Music player not initialized');
        return;
    }
    
    // If same tune is already playing, don't reload
    if (currentTuneKey === tuneKey && musicPlayer.isPlaying) {
        console.log('[DEBUG] Tune already playing');
        return;
    }
    
    // If switching tunes, do overlap crossfade
    const isChangingTune = currentTuneKey && currentTuneKey !== tuneKey && musicPlayer.isPlaying;
    
    if (isChangingTune) {
        console.log('[DEBUG] Crossfading from', currentTuneKey, 'to', tuneKey);
        
        // Capture the old tracks and their state
        const oldTracks = musicPlayer.tracks.map(t => ({
            synth: t.synth,
            gain: t.gain,
            active: t.active
        }));
        
        const oldIsPlaying = musicPlayer.isPlaying;
        
        // Start fading out old tracks immediately
        const fadeOutTime = musicPlayer.audioContext.currentTime;
        for (const track of oldTracks) {
            if (track.gain) {
                // Fade out over 800ms using exponential fade
                track.gain.gain.setTargetAtTime(0.0001, fadeOutTime, 0.75);
            }
        }
        
        console.log('[DEBUG] Old tune fading out, loading new tune...');
        
        // Load new tune WITHOUT stopping (preservePlayback = true)
        currentTuneKey = tuneKey;
        
        try {
            // This loads new tracks but doesn't stop the old ones yet
            const loaded = await musicPlayer.loadTune(tuneKey, true);
            
            if (!loaded) {
                console.error('[DEBUG] Failed to load tune');
                // Clean up old tracks anyway
                for (const track of oldTracks) {
                    try {
                        if (track.synth && track.synth.stop) {
                            track.synth.stop();
                        }
                    } catch (e) {}
                }
                return;
            }
            
            console.log('[DEBUG] New tune loaded, starting playback...');
            console.log('[DEBUG] Audio context state:', musicPlayer.audioContext.state);
            
            // Start new tune playing
            await musicPlayer.play();
            
            console.log('[DEBUG] New tune playing, both tunes audible during crossfade');
            console.log('[DEBUG] Audio context state after play:', musicPlayer.audioContext.state);
            console.log('[DEBUG] isPlaying flag:', musicPlayer.isPlaying);
            
            // Verify banjo is the only active track in new tune
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
            
            // Clean up old synths after fade completes (1 second)
            setTimeout(() => {
                console.log('[DEBUG] Stopping old synths...');
                for (const track of oldTracks) {
                    try {
                        if (track.synth && track.synth.stop) {
                            track.synth.stop();
                        }
                        // Disconnect old gain nodes
                        if (track.gain) {
                            try {
                                track.gain.disconnect();
                            } catch (e) {}
                        }
                    } catch (e) {
                        console.log('[DEBUG] Error stopping old synth:', e);
                    }
                }
                console.log('[DEBUG] ✓ Crossfade complete, old synths cleaned up');
            }, 1200);
            
        } catch (error) {
            console.error('[DEBUG] Error during crossfade:', error);
            // Clean up old tracks on error
            for (const track of oldTracks) {
                try {
                    if (track.synth && track.synth.stop) {
                        track.synth.stop();
                    }
                } catch (e) {}
            }
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
            
            console.log('[DEBUG] Tune loaded, tracks:', musicPlayer.tracks.map(t => `${t.name}(${t.active ? 'ON' : 'OFF'})`));
            console.log('[DEBUG] Audio context state before play:', musicPlayer.audioContext.state);
            
            await musicPlayer.play();
            
            console.log('[DEBUG] Play() completed');
            console.log('[DEBUG] Audio context state after play:', musicPlayer.audioContext.state);
            console.log('[DEBUG] isPlaying flag:', musicPlayer.isPlaying);
            
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
    
    // Check if tracks are actually loaded (not undefined)
    const loadedTracks = musicPlayer.tracks.filter(t => t && t.name);
    console.log('[DEBUG] Loaded tracks:', loadedTracks.length, '/', musicPlayer.tracks.length);
    
    if (loadedTracks.length === 0) {
        console.warn('[DEBUG] No tracks loaded yet, cannot unmute');
        return;
    }
    
    console.log('[DEBUG] Available tracks:', loadedTracks.map(t => t.name));
    
    // Try to find piano first
    let targetIndex = musicPlayer.tracks.findIndex(t => t && t.name === 'Piano');
    
    if (targetIndex < 0) {
        // No piano, so enable the second instrument (index 1) if available
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

    // Pause the stats bar (don't remove)
    if (globalStatsBar) {
        globalStatsBar.style.opacity = '0';
        globalStatsBar.style.pointerEvents = 'none';
    }

    // Pause the heroSelect container (don't remove)
    const heroSelectContainer = document.getElementById('heroSelect');
    if (heroSelectContainer) {
        heroSelectContainer.style.opacity = '0';
        heroSelectContainer.style.pointerEvents = 'none';
    }
    
    // Get the current slider value
    const slider = document.querySelector('.champion-slider');
    const currentSliderValue = slider ? parseFloat(slider.value) : 0.15;
    
    // Launch the tutorialOrAdventure overlay with current state
    import('./tutorialOrAdventure.js').then(module => {
        module.initTutorialOrAdventure(champ, currentSliderValue, currentAmerginLineForExport);
    });
}








function showHeroSelect() {
    console.log('[HeroSelect] showHeroSelect() called - making visible again');
    
    const container = document.querySelector('.hero-select-container');
    if (container) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
    }
    
    if (globalStatsBar) {
        globalStatsBar.style.opacity = '1';
        globalStatsBar.style.pointerEvents = 'auto';
    }
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
    
    // Turn off all instruments except banjo (index 0)
    for (let i = 1; i < musicPlayer.tracks.length; i++) {
        if (musicPlayer.tracks[i] && musicPlayer.tracks[i].active) {
            console.log('[HeroSelect] Turning off:', musicPlayer.tracks[i].name);
            musicPlayer.toggleInstrument(i);
        }
    }
    
    console.log('[HeroSelect] Second instrument muted, back to banjo only');
}

export { showHeroSelect };

