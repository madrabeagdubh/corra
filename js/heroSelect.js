import { champions } from '../data/champions.js';
import { showCharacterModal } from './characterModal.js'
import '../css/heroSelect.css'

import AbcChipPlayer from './game/systems/music/abcChipPlayer.js';
import { foggyDew } from './game/systems/music/foggyDew.js';

// Prevent double initialization
let initialized = false;
let musicPlayer = null;
let musicStarted = false;

// Stat descriptions
const statDescriptions = {
  attack: {
    irish: "Ionsaigh",
    english: "Attack"
  },
  defense: {
    irish: "Cosaint",
    english: "Defense"
  },
  health: {
    irish: "Sláinte",
    english: "Health"
  }
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
        background: rgba(42, 24, 16, 0.95) !important;
        border-top: 2px solid #d4af37 !important;
        z-index: 499 !important;
        padding: 15px !important;
        display: flex !important;
        justify-content: center !important;
        gap: 40px !important;
        pointer-events: none;
    `;

    const statIcons = { attack: '⚔️', defense: '🛡️ ', health: '❤️' };

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
                <span style="font-size: 2.5rem; margin-bottom: 5px;">${statIcons[statName]}</span>
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
    background: rgba(42, 24, 16, 0.98);
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
    opacity: 0; 
    transition: opacity 0.5s ease;
  `;

  popup.appendChild(iconElement);
  popup.appendChild(irishText);
  popup.appendChild(englishText);

  if (!document.getElementById('statPopupStyle')) {
    const style = document.createElement('style');
    style.id = 'statPopupStyle';
    style.textContent = `
      @keyframes popupFadeIn { from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
      @keyframes popupFadeOut { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } }
      @keyframes letterGlow { 
        0% { opacity: 0; transform: scale(1.3); text-shadow: 0 0 15px rgba(255, 200, 100, 1); } 
        100% { opacity: 1; transform: scale(1); text-shadow: none; } 
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

        autoCloseTimer = setTimeout(closePopup, 4000);
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
        document.body.appendChild(globalStatsBar);

        const statValues = globalStatsBar.querySelectorAll('span:last-child');
        statValues.forEach((val, index) => {
            setTimeout(() => {
                val.classList.add('stat-animate');
            }, index * 50);
        });
    }
}

function initHeroSelect() {
    if (initialized) return;

    const container = document.getElementById('heroSelect');
    if (!container) return;

    initialized = true;

    // --- MUSIC INIT ---
    musicPlayer = new AbcChipPlayer();

    let englishOpacity = 0.15;
    let currentChampionIndex = 0;
    let atlasData = null;
    let sheetLoaded = false;

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
    font-family: Dumble; 
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
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = 0; slider.max = 1; slider.step = 0.01;
    slider.value = englishOpacity;
    slider.className = 'champion-slider';
    
    const sliderStyle = document.createElement('style');
    sliderStyle.id = 'sunSliderStyle';
    sliderStyle.textContent = `
        .champion-slider {
            -webkit-appearance: none !important;
            appearance: none !important;
            width: 90% !important;
            height: 10px !important;
            background: #444 !important;
            border-radius: 5px !important;
            outline: none !important;
            margin: 0 !important;
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
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: 0 0 15px rgba(0,0,0,0.5) !important;
        }
    `;
    if (!document.getElementById('sunSliderStyle')) document.head.appendChild(sliderStyle);

    slider.oninput = e => {
        englishOpacity = Number(e.target.value);
       
        document.querySelectorAll('.champion-name-en').forEach(el => {
            el.style.color = `rgba(0, 255, 0, ${englishOpacity})`;
        });

        if (chooseButton) {
            if (englishOpacity > 0.5) {
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
        slider.style.background = `linear-gradient(to right, #d4af37 0%, #d4af37 ${englishOpacity * 100}%, #444 ${englishOpacity * 100}%, #444 100%)`;
    };

    topPanel.appendChild(slider);
    container.appendChild(topPanel);

    const bottomPanel = document.createElement('div');
    bottomPanel.className = 'champion-bottom-panel';
    const chooseButton = document.createElement('button');
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

        infiniteChampions.forEach((champ, i) => {
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
        runOnboarding();
        window.hideLoader();
        
        updateGlobalStats(validChampions[randomIndex]);
    }

    function runOnboarding() {
        setTimeout(() => {
            nudgeSlider(slider, () => {
                setTimeout(() => {
                    const dist = window.innerWidth * 0.45;
                    const start = scrollContainer.scrollLeft;
                    scrollContainer.style.scrollSnapType = 'none';
                    scrollContainer.style.scrollBehavior = 'smooth';
                    scrollContainer.scrollLeft = start - dist;
                    setTimeout(() => {
                        scrollContainer.scrollLeft = start + dist;
                        setTimeout(() => {
                            scrollContainer.scrollLeft = start;
                            setTimeout(() => { scrollContainer.style.scrollSnapType = 'x mandatory'; }, 600);
                        }, 700);
                    }, 700);
                }, 400);
            });
        }, 800);
    }

    function nudgeSlider(slider, callback) {
        const trigger = (val) => { slider.value = val; slider.oninput({ target: slider }); };
        slider.style.transition = 'all 0.15s ease-out';
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
            slider.style.transition = 'none';
            if (callback) callback();
        }, delay + 200);
    }

    function initSwipe(container, len) {
        let isDragging = false, startX, startY, scrollL, velocity = 0, lastX, lastT, animID;
        let currentSwipeDetected = false;
        
        const validChampions = champions.filter(c => c && c.spriteKey && c.stats);
       
       
const handleTouchStart = (e) => {
    console.log('[swipe] touchstart on', e.target.className);

    isDragging = true;
    currentSwipeDetected = false;
    startX = e.touches[0].pageX;
    startY = e.touches[0].pageY;
    scrollL = container.scrollLeft;
    lastX = startX;
    lastT = performance.now();

    if (animID) cancelAnimationFrame(animID);
    container.style.scrollSnapType = 'none';
    container.style.scrollBehavior = 'auto';

    // Ensure AudioContext is resumed immediately on gesture
    if (musicPlayer) {
        const ctx = musicPlayer.synth.ensureContext();
        if (ctx.state !== 'running') {
            ctx.resume().then(() => {
                console.log('[music] ✓ AudioContext resumed on touchstart', ctx.state);
                // Play a micro-beep to unlock context
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                gain.gain.value = 0;
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.001);
            });
        }
    }
};

;;
       
        const handleTouchMove = (e) => {
            if (!isDragging) return;
            
            const x = e.touches[0].pageX;
            
            const deltaX = Math.abs(x - startX);
            
            // Detect swipe
            if (!currentSwipeDetected && deltaX > 15) {
                currentSwipeDetected = true;
                console.log('[swipe] Swipe detected! deltaX:', deltaX);
            }
            
            container.scrollLeft = scrollL - (x - startX);
            const now = performance.now();
            const dt = now - lastT;
            if (dt > 0) velocity = (lastX - x) / dt * 16;
            lastX = x; 
            lastT = now;
        };
      
       const handleTouchEnd = () => {
    console.log('[swipe] touchend - swipe detected:', currentSwipeDetected, 'music started:', musicStarted);

    // Play music on touchend after swipe
    if (currentSwipeDetected && !musicStarted && musicPlayer) {
        const ctx = musicPlayer.synth.ensureContext(); // Make sure context exists

        // Resume context if needed
        if (ctx.state !== 'running') {
            ctx.resume().then(() => {
                console.log('[music] AudioContext resumed on touchend:', ctx.state);
                try {
                    musicPlayer.play(foggyDew);
                    musicStarted = true;
                    console.log('[music] ✓ Music playing!');
                } catch (err) {
                    console.error('[music] Play error:', err);
                    musicStarted = false;
                }
            }).catch(err => {
                console.error('[music] Context resume failed:', err);
                musicStarted = false;
            });
        } else {
            // Context already running, just play
            try {
                musicPlayer.play(foggyDew);
                musicStarted = true;
                console.log('[music] ✓ Music playing!');
            } catch (err) {
                console.error('[music] Play error:', err);
                musicStarted = false;
            }
        }
    }

    isDragging = false;
    velocity *= 2.5;

    const decay = () => {
        container.scrollLeft += velocity;
        velocity *= 0.95;
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
            currentChampionIndex = realIndex;
            updateGlobalStats(validChampions[realIndex]);
            container.scrollLeft = (len + realIndex) * w;
        }, 350);
    };

    decay();
}; 
        container.addEventListener('touchstart', handleTouchStart);
        container.addEventListener('touchmove', handleTouchMove);
        container.addEventListener('touchend', handleTouchEnd);
        
        // Desktop click fallback
        container.addEventListener('click', () => {
            if (!musicStarted && musicPlayer) {
                const ctx = musicPlayer.synth.ctx;
                
                ctx.resume().then(() => {
                    if (ctx.state === 'running') {
                        musicStarted = true;
                        musicPlayer.play(foggyDew)
                            .then(() => console.log('[music] ✓ Playing from click!'))
                            .catch(err => console.error('[music] Click failed:', err));
                    }
                });
            }
        }, { once: true });
    }

    function finalize(champ) {
        window.showLoader();
        
        if (globalStatsBar) {
            globalStatsBar.remove();
            globalStatsBar = null;
        }

        const container = document.querySelector('.hero-select-container');
        if (container) container.remove();
        
        if (window.startGame) window.startGame(champ);
    }
}

document.addEventListener('DOMContentLoaded', initHeroSelect);

if (document.readyState !== 'loading') {
  console.log('DOM already loaded, initializing...');
  initHeroSelect();
}
