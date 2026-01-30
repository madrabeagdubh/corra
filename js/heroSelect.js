import { initStarfield, stopStarfield } from './game/effects/starfield.js';
import { champions } from '../data/champions.js';
import { showCharacterModal } from './characterModal.js'
import '../css/heroSelect.css'

import { championMusicManager } from './game/systems/music/championMusicManager.js';
import AbcTradPlayer from './game/systems/music/abcTradPlayer.js';
import { prepareTuneData } from './game/systems/music/tradTuneConfig.js';

// Global state
let initialized = false;

function resetState() {
    initialized = false;
}

let sliderTutorialComplete = false;






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
        background: rgba(0,0,0, 0.95) !important;
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
    if (initialized) return;

    const container = document.getElementById('heroSelect');
    if (!container) return;

    initialized = true;

    let englishOpacity = 0.15;
    let currentChampionIndex = 0;
    let atlasData = null;
    let sheetLoaded = false;
    let audioUnlocked = false;
    let lastMusicChangeTime = 0;
    const MUSIC_CHANGE_DELAY = 500;

    const sheet = new Image();
    sheet.src = 'assets/champions/champions-with-kit.png';

    fetch('assets/champions/champions0.json')
        .then(res => res.json())
        .then(data => {
            atlasData = data;
            tryRender();
        });

    sheet.onload = () => {
        sheetLoaded = true;
        tryRender();
    };

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
    background: #000; position: relative;
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
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'champion-scroll';
    container.appendChild(scrollContainer);

      const topPanel = document.createElement('div');
    topPanel.className = 'champion-top-panel';
    
    // Calculate 25% of screen height in pixels
    const startTop = window.innerHeight * 0.15;

    topPanel.style.cssText = `
        position: fixed;
        top: ${startTop}px;      /* Pixel-based start */
        left: 0;
        width: 100%;
        z-index: 10001;          /* Higher than overlay */
        padding: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
        /* Force hardware acceleration for the move */
        transition: top 1.0s cubic-bezier(0.19, 1, 0.22, 1); 
        will-change: top;
    `;
 

const slider = document.createElement('input');
slider.type = 'range'; slider.min = 0; slider.max = 1; slider.step = 0.05;
slider.value = englishOpacity;
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
   



let sequenceTriggered = false;




slider.oninput = e => {
    const val = Number(e.target.value);
    updateSliderVisuals(val);

    if (!sequenceTriggered && val > 0.15) {
        console.log('[DEBUG] Slider hit 0.85, moving panel to top');
        console.log('[DEBUG] Current top:', topPanel.style.top);
        console.log('[DEBUG] Current z-index:', topPanel.style.zIndex);
        
        sequenceTriggered = true;
        
        // Force z-index and remove any conflicting styles
        topPanel.style.zIndex = '10002';
        topPanel.style.position = 'fixed';
        topPanel.style.top = '10px';
        
        console.log('[DEBUG] New top:', topPanel.style.top);
        console.log('[DEBUG] New z-index:', topPanel.style.zIndex);
        
        // Force reflow
        void topPanel.offsetHeight;

        // 2. Wait for panel to reach top, THEN wait for reading time, THEN fade
        setTimeout(() => {
            console.log('[DEBUG] Panel movement complete, waiting for player to read...');
            
            // Wait additional time for player to read the English text
            setTimeout(() => {
                console.log('[DEBUG] Starting overlay fade');
                const overlay = document.getElementById('slider-tutorial-overlay');
                if (overlay) {
                    overlay.style.opacity = '0';
                    // Also fade out the tutorial text if it's a separate element
                    if (tutorialText) tutorialText.style.opacity = '0';
                }

                // Wait for fade to complete, then remove overlay
                setTimeout(() => {
                    if (overlay) overlay.remove();
                    
                    // NOW do all the completion stuff
                    sliderTutorialComplete = true;
                    
                    // Fade music volume up
                    if (championMusicManager.setVolume) {
                        let vol = 0.2;
                        const fadeInterval = setInterval(() => {
                            vol += 0.04;
                            if (vol >= 1.0) {
                                championMusicManager.setVolume(1.0);
                                clearInterval(fadeInterval);
                            } else {
                                championMusicManager.setVolume(vol);
                            }
                        }, 100);
                    }
                    
                    showStatsBar();
                    
                    // Wait for stats bar to be visible before showing swipe nudge
                    setTimeout(() => {
                        runSwipeNudge();
                    }, 1500); // Give player 1.5 seconds to see the stats bar first
                }, 1000); // Wait for opacity transition to complete
            }, 2000); // Wait 5 seconds for player to read
        }, 2000); // Wait for panel to reach top
    }
};
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

waitForSliderInteraction();


const overlay = document.createElement('div');
overlay.id = 'slider-tutorial-overlay';
overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.95);
    z-index: 9999;           /* Boost this very high */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: opacity 0.8s ease;
    pointer-events: all;     /* Capture all events */
    touch-action: none;      /* Prevent scrolling behind */
`;










// Explicitly stop clicks from reaching elements underneath
overlay.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
};
overlay.ontouchstart = (e) => {
    e.stopPropagation();
};

container.appendChild(overlay);


const tutorialText = document.createElement('div');
tutorialText.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: Aonchlo, serif;
    font-size: 1.8rem;
    color: #d4af37;
    text-align: center;
    padding: 2rem;
    max-width: 80%;
    width: 80%;
    line-height: 1.6;
`;




const irishText = document.createElement('div');
irishText.textContent = `I Nás na nLaoch i dTír na nÓg… `;
irishText.style.cssText = `
    font-family: Aonchlo, serif;
    font-size: 1.8rem;
    color: #d4af37;
    margin-bottom: 0.5rem;
`;

const englishText = document.createElement('div');
englishText.id = 'tutorial-english-text';
englishText.textContent = `In Tír na nÓg, at the meeting place of champions...`;
englishText.style.cssText = `
    font-family: 'Courier New', monospace;
    font-size: 1.7rem;
    color: rgb(0, 255, 0);
    opacity: 0;
    transition: opacity 0.2s ease;
    min-height: 1.5em;
    display: block;
`;



// Add "Slide to Begin" instruction
const slideInstruction = document.createElement('div');
slideInstruction.style.cssText = `
    font-family: Aonchlo, serif;
    font-size: 2.2rem;
    color: #d4af37;
    text-align: center;
    margin-top: 2rem;
    animation: slideInstructionPulse 2s ease-in-out infinite;
    text-shadow: 0 0 20px rgba(212, 175, 55, 0.6);
`;
slideInstruction.innerHTML = '';

// Add arrow pointing to slider
const arrow = document.createElement('div');
arrow.style.cssText = `
`;
arrow.textContent = '';

const instructionStyle = document.createElement('style');
instructionStyle.textContent = `
    @keyframes slideInstructionPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
    }
    @keyframes arrowBounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-15px); }
    }
`;
document.head.appendChild(instructionStyle);

tutorialText.appendChild(irishText);
tutorialText.appendChild(englishText);

overlay.appendChild(tutorialText);
overlay.appendChild(slideInstruction);
overlay.appendChild(arrow);
container.appendChild(overlay);



    
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
    chooseButton.onclick = () => {
        const validChampions = champions.filter(c => c && c.spriteKey && c.stats);
        if (validChampions[currentChampionIndex]) finalize(validChampions[currentChampionIndex]);
    };
    bottomPanel.appendChild(chooseButton);
    container.appendChild(bottomPanel);

    function tryRender() {
        if (atlasData && sheetLoaded && champions.length > 0) renderChampions();
    }

    function renderChampions() {
        const validChampions = champions.filter(c => c && c.spriteKey && c.stats);
        const infiniteChampions = [...validChampions, ...validChampions, ...validChampions];

        infiniteChampions.forEach((champ) => {
            const frameName = champ.spriteKey.endsWith('.png') ? champ.spriteKey : `${champ.spriteKey}.png`;
            const frameData = atlasData.textures[0].frames.find(f => f.filename === frameName);
            if (!frameData) return;

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
        });

        const randomIndex = Math.floor(Math.random() * validChampions.length);
        scrollContainer.scrollLeft = window.innerWidth * (validChampions.length + randomIndex);
        currentChampionIndex = randomIndex;

        initSwipe(scrollContainer, validChampions.length);
        window.hideLoader();
    initBackgroundParticles(); // Add this line
     
        updateGlobalStats(validChampions[randomIndex]);

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


    function runOnboarding() {
        // Just wait for slider interaction - no auto demo
        waitForSliderInteraction();
    }

function waitForSliderInteraction() {
    console.log('[HeroSelect] Waiting for user to slide...');

    let hasUnlockedAudio = false;
    let hasReleasedSlider = false;

    // Unlock audio on first touch of slider
    

const handleSliderTouch = async (e) => {
    console.log('[DEBUG] === SLIDER TOUCH EVENT ===');
    console.log('[DEBUG] Event type:', e.type);
    console.log('[DEBUG] isTrusted:', e.isTrusted);
    console.log('[DEBUG] hasUnlockedAudio:', hasUnlockedAudio);

    if (hasUnlockedAudio) {
        console.log('[DEBUG] Already unlocked, exiting');
        return;
    }
    hasUnlockedAudio = true;

    console.log('[DEBUG] Slider touched - unlocking audio...');
    console.log('[DEBUG] Existing sharedAudioContext:', window.sharedAudioContext);

    // Hide the instruction immediately
    const instruction = document.querySelector('div[style*="slideInstructionPulse"]');
    const arrow = document.querySelector('div[style*="arrowBounce"]');
    if (instruction) instruction.style.display = 'none';
    if (arrow) arrow.style.display = 'none';

    try {
        // Delete any existing context to force a fresh one
        if (window.sharedAudioContext) {
            console.log('[DEBUG] Closing old context...');
            try {
                await window.sharedAudioContext.close();
            } catch (e) {
                console.log('[DEBUG] Error closing old context:', e);
            }
            window.sharedAudioContext = null;
        }

        // Create fresh context on this guaranteed user gesture
        console.log('[DEBUG] Creating new AudioContext...');
        window.sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();

        console.log('[DEBUG] Context created, state:', window.sharedAudioContext.state);

        // Try resume with timeout
        console.log('[DEBUG] Calling resume() with timeout...');
        const resumePromise = window.sharedAudioContext.resume();
        const timeoutPromise = new Promise(resolve => setTimeout(() => {
            console.log('[DEBUG] Resume timeout hit');
            resolve('timeout');
        }, 500));
        
        const result = await Promise.race([resumePromise, timeoutPromise]);
        console.log('[DEBUG] Resume result:', result);
        console.log('[DEBUG] State after resume:', window.sharedAudioContext.state);

        // If still suspended, play buffer AFTER resume attempt
        if (window.sharedAudioContext.state === 'suspended') {
            console.log('[DEBUG] Still suspended, playing buffer now...');
            const buffer = window.sharedAudioContext.createBuffer(1, 1, 22050);
            const source = window.sharedAudioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(window.sharedAudioContext.destination);
            source.start(0);
            
            console.log('[DEBUG] State after buffer:', window.sharedAudioContext.state);
            
            // Try resume again
            await Promise.race([
                window.sharedAudioContext.resume(),
                new Promise(resolve => setTimeout(resolve, 500))
            ]);
            console.log('[DEBUG] State after second resume:', window.sharedAudioContext.state);
        }

        // Wait for running state
        let attempts = 0;
        while (window.sharedAudioContext.state !== 'running' && attempts < 10) {
            console.log('[DEBUG] Waiting for running state, attempt:', attempts + 1);
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        console.log('[DEBUG] Final audio state:', window.sharedAudioContext.state);
        audioUnlocked = true;

        const validChampions = champions.filter(c => c && c.spriteKey && c.stats);
        const currentChamp = validChampions[currentChampionIndex];

        if (currentChamp && window.sharedAudioContext.state === 'running') {
            console.log('[DEBUG] Starting music for:', currentChamp.nameGa);
            await championMusicManager.playChampionTheme(currentChamp, true);
            championMusicManager.setVolume(0.2);
            console.log('[DEBUG] Music playing');
        } else {
            console.error('[DEBUG] Cannot start music, state:', window.sharedAudioContext?.state);
        }
    } catch (error) {
        console.error('[DEBUG] Error unlocking audio:', error);
    }
};



const handleSliderRelease = async () => {
    if (hasReleasedSlider) return;
    hasReleasedSlider = true;

    slider.removeEventListener('touchstart', handleSliderTouch);
    slider.removeEventListener('mousedown', handleSliderTouch);
    slider.removeEventListener('touchend', handleSliderRelease);
    slider.removeEventListener('mouseup', handleSliderRelease);

    // Don't do anything here - let the slider.oninput sequence handle everything
    // The sequence is triggered when slider value > 0.85
    console.log('[DEBUG] Slider released, waiting for oninput sequence to complete');
};





let firstTouch = true;
let touchUnlocked = false;

// First, try to unlock on touchstart
slider.addEventListener('touchstart', async (e) => {
    if (!firstTouch) return;
    firstTouch = false;
    
    console.log('[DEBUG] Touchstart - attempting unlock...');
    await handleSliderTouch(e);
    touchUnlocked = window.sharedAudioContext?.state === 'running';
    console.log('[DEBUG] Unlock via touchstart successful:', touchUnlocked);
}, { once: true });

// Fallback: if touchstart didn't work, try on first input (actual slider movement)
slider.addEventListener('input', async (e) => {
    if (touchUnlocked || hasUnlockedAudio) return;
    
    console.log('[DEBUG] Input event - attempting unlock (Firefox fallback)...');
    await handleSliderTouch(e);
}, { once: true });

slider.addEventListener('mousedown', handleSliderTouch, { once: true });

slider.addEventListener('touchend', handleSliderRelease);
slider.addEventListener('mouseup', handleSliderRelease);



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
    
    const validChampions = champions.filter(c => c && c.spriteKey && c.stats);
    
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
                            championMusicManager.playChampionTheme(currentChamp);
                        }
                    }
                }

                container.scrollLeft = (len + realIndex) * w;
                
                // Start floating animation after scroll settles
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
    // Launch the tutorialOrAdventure overlay
    import('./tutorialOrAdventure.js').then(module => {
        module.initTutorialOrAdventure(champ);
    });
}
const starfieldCanvas = initStarfield();
document.body.appendChild(starfieldCanvas); // append as the very last element

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

export { showHeroSelect };
