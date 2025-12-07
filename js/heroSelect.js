import { champions } from '../data/champions.js';
import { showCharacterModal } from './characterModal.js'
import '../css/heroSelect.css'

// Prevent double initialization
let initialized = false;

function initHeroSelect() {
  console.log('initHeroSelect called, initialized:', initialized);

  if (initialized) {
    console.log('Already initialized, skipping');
    return;
  }

  const container = document.getElementById('heroSelect');
  if (!container) {
    console.error('heroSelect container not found!');
    return;
  }

  // Set initialized AFTER we confirm container exists
  initialized = true;
  console.log('heroSelect container found, proceeding with init');

  let englishOpacity = 0.15;
  let currentChampionIndex = 0;

  const sheet = new Image();
  sheet.src = 'assets/champions/champions-with-kit.png';

  console.log('Attempting to load spritesheet from:', sheet.src);

  let atlasData = null;
  let sheetLoaded = false;

  // Load the JSON atlas
  fetch('assets/champions/champions0.json')
    .then(res => {
      console.log('Atlas fetch response:', res.status);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(data => {
      console.log('Atlas raw data:', data);
      if (!data.textures || !data.textures[0] || !data.textures[0].frames) {
        throw new Error('Invalid atlas structure');
      }
      atlasData = data;
      console.log('Atlas loaded, frames:', atlasData.textures[0].frames.length);
      tryRender();
    })
    .catch(err => {
      console.error('Failed to load atlas:', err);
      console.error('Error details:', err.message, err.stack);
    });

  sheet.onload = () => {
    console.log('✓ Spritesheet loaded successfully!');
    sheetLoaded = true;
    tryRender();
  };

  sheet.onerror = (e) => {
    console.error('✗ Failed to load spritesheet from:', sheet.src);
  };

  // Add container class
  container.className = 'hero-select-container';

  // Create scroll wrapper
  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'champion-scroll';
  container.appendChild(scrollContainer);

  // Create top control panel for opacity slider
  const topPanel = document.createElement('div');
  topPanel.className = 'champion-top-panel';




const slider = document.createElement('input');
slider.type = 'range';
slider.min = 0;
slider.max = 1;
slider.step = 0.01;
slider.value = englishOpacity;
slider.className = 'champion-slider';

// Style the slider track with golden fill
slider.style.cssText = `
  width: 100% !important;
  height: 8px !important;
  border-radius: 5px !important;
  background: linear-gradient(to right, 
    #d4af37 0%, 
    #d4af37 ${englishOpacity * 100}%, 
    #444 ${englishOpacity * 100}%, 
    #444 100%) !important;
  outline: none !important;
  -webkit-appearance: none !important;
  cursor: pointer !important;
`;

// Add styles for the sun thumb
const sliderStyle = document.createElement('style');
sliderStyle.id = 'sunSliderStyle';
sliderStyle.textContent = `
  .champion-slider::-webkit-slider-thumb {
    -webkit-appearance: none !important;
    appearance: none !important;
    width: 30px !important;
    height: 30px !important;
    border-radius: 50% !important;
    background: #ffd700 !important;
    cursor: pointer !important;
    border: none !important;
    font-size: 20px !important
  font-family: monospace !important;;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    content: '☀️' !important;
  }
  
  .champion-slider::-moz-range-thumb {
    width: 30px !important;
    height: 30px !important;
    border-radius: 50% !important;
    background: #ffd700 !important;
    cursor: pointer !important;
    border: none !important;
  }
`;
if (!document.getElementById('sunSliderStyle')) {
  document.head.appendChild(sliderStyle);
}

slider.oninput = e => {
  englishOpacity = Number(e.target.value);
  document.querySelectorAll('.champion-name-en').forEach(el => {
    el.style.color = `rgba(255,255,255,${englishOpacity})`;
  });
  
  // Update the golden fill as slider moves
  slider.style.background = `linear-gradient(to right, 
    #d4af37 0%, 
    #d4af37 ${englishOpacity * 100}%, 
    #444 ${englishOpacity * 100}%, 
    #444 100%)`;
};


  topPanel.appendChild(slider);
  container.appendChild(topPanel);

  // Create bottom button panel
  const bottomPanel = document.createElement('div');
  bottomPanel.className = 'champion-bottom-panel';


const chooseButton = document.createElement('button');
chooseButton.className = 'champion-choose-button';
chooseButton.textContent = 'Ar Aghaidh';
chooseButton.style.cssText = `
  width: 100% !important;
  padding: 1.2rem !important;
  font-size: 1.3rem !important;
  font-weight: bold !important;
  color: #1a1a1a !important;
  
background: linear-gradient(145deg, #8b4513, #d2691e, #8b4513) !important;
  color: #1a1a1a !important;
  border: 3px solid #d2691e !important
  border-radius: 12px !important;
  cursor: pointer !important;
  text-transform: uppercase !important;
  letter-spacing: 2px !important;
`;
chooseButton.onclick = () => {
  const validChampions = champions.filter(c => c && c.spriteKey);
  if (validChampions[currentChampionIndex]) {
    finalize(validChampions[currentChampionIndex]);
  }
};

  bottomPanel.appendChild(chooseButton);
  container.appendChild(bottomPanel);

  function tryRender() {
    if (!atlasData || !sheetLoaded) {
      console.log('Waiting... atlas:', !!atlasData, 'sheet:', sheetLoaded);
      return;
    }

    if (!champions || champions.length === 0) {
      console.error('No champions data found! Make sure champions are imported.');
      return;
    }

    console.log('Rendering', champions.length, 'champions');
    renderChampions();
	  window.hideLoader();
  }

  function createStatsDisplay(champion) {
    const statsContainer = document.createElement('div');
    statsContainer.className = 'champion-stats';

    if (!champion.stats) {
      return statsContainer; // Return empty if no stats
    }

    const statIcons = {
      attack: '⚔️',
      defense: '🛡️',
      health: '❤️'
    };

    const statOrder = ['attack', 'defense', 'health'];

    statOrder.forEach(statName => {
      if (champion.stats[statName] !== undefined) {
        const statItem = document.createElement('div');
        statItem.className = 'stat-item';

        const icon = document.createElement('span');
        icon.className = 'stat-icon';
        icon.textContent = statIcons[statName];

        const value = document.createElement('span');
        value.className = 'stat-value';
        value.textContent = champion.stats[statName];

        statItem.appendChild(icon);
        statItem.appendChild(value);
        statsContainer.appendChild(statItem);
      }
    });

    return statsContainer;
  }

  function renderChampions() {
    // Filter out any undefined/null champions
    const validChampions = champions.filter(c => c && c.spriteKey);
    console.log('Valid champions:', validChampions.length, 'of', champions.length);

    // Create infinite scroll by tripling the array
    const infiniteChampions = [...validChampions, ...validChampions, ...validChampions];

    infiniteChampions.forEach((champ, i) => {
      // Handle spriteKey with or without .png extension
      const frameName = champ.spriteKey.endsWith('.png') ? champ.spriteKey : `${champ.spriteKey}.png`;
      const frameData = atlasData.textures[0].frames.find(f => f.filename === frameName);

      if (!frameData) {
        console.error(`Frame not found: ${frameName}`);
        return;
      }

      const { frame } = frameData;

      const heroDiv = document.createElement('div');
      heroDiv.className = 'champion-card';


heroDiv.addEventListener('click', () => {
    const validChampions = champions.filter(c => c && c.spriteKey);
        const champIndex = i % validChampions.length; // map back to middle set
	    const champ = validChampions[champIndex];
	        showCharacterModal(champ);
		});





      const canvas = document.createElement('canvas');
      canvas.width = frame.w;
      canvas.height = frame.h;
      canvas.className = 'champion-canvas';
      const ctx = canvas.getContext('2d');

      // Draw using exact atlas coordinates
      ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);

      heroDiv.appendChild(canvas);

      const nameGa = document.createElement('div');
      nameGa.className = 'champion-name-ga';
      nameGa.textContent = champ.nameGa;
      heroDiv.appendChild(nameGa);

      const nameEn = document.createElement('div');
      nameEn.className = 'champion-name-en';
      nameEn.textContent = champ.nameEn;
      nameEn.style.color = `rgba(255,255,255,${englishOpacity})`;
      heroDiv.appendChild(nameEn);

      // Add stats display
      const statsDisplay = createStatsDisplay(champ);
      heroDiv.appendChild(statsDisplay);

      scrollContainer.appendChild(heroDiv);
    });

// Start at a random champion in the middle set
const randomIndex = Math.floor(Math.random() * validChampions.length);
scrollContainer.scrollLeft = window.innerWidth * (validChampions.length + randomIndex);
currentChampionIndex = randomIndex;


    initSwipe(scrollContainer, validChampions.length);
  }

  function initSwipe(container, championsLength) {
    let isDragging = false;
    let startX = 0;
    let scrollLeft = 0;
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;
    let momentumID = null;

    container.addEventListener('touchstart', e => {
      isDragging = true;
      startX = e.touches[0].pageX;
      scrollLeft = container.scrollLeft;
      velocity = 0;
      lastX = startX;
      lastTime = performance.now();
      if (momentumID) cancelAnimationFrame(momentumID);

      container.style.scrollSnapType = 'none';
      container.style.scrollBehavior = 'auto';
    });

    container.addEventListener('touchmove', e => {
      if (!isDragging) return;

      const x = e.touches[0].pageX;
      const dx = x - startX;
      container.scrollLeft = scrollLeft - dx;

      const now = performance.now();
      const dt = now - lastTime;
      if (dt > 0) {
        velocity = (lastX - x) / dt * 16;
      }
      lastX = x;
      lastTime = now;
    });

    container.addEventListener('touchend', e => {
      isDragging = false;
      velocity *= 2.5;

      // Hide all stats immediately when touch ends
      document.querySelectorAll('.champion-stats').forEach(stats => {
        stats.classList.remove('stats-visible');
      });

      const decay = () => {
        container.scrollLeft += velocity;
        velocity *= 0.95;

        if (Math.abs(velocity) > 0.1) {
          momentumID = requestAnimationFrame(decay);
          return;
        }

        const cardWidth = window.innerWidth;
        const currentScroll = container.scrollLeft;
        const targetIndex = Math.round(currentScroll / cardWidth);

        container.style.scrollBehavior = 'smooth';
        container.scrollTo({
          left: targetIndex * cardWidth,
          behavior: 'smooth'
        });

        const realIndex = targetIndex % championsLength;
        currentChampionIndex = (realIndex + championsLength) % championsLength;






        // Show stats for centered card after scroll completes
        setTimeout(() => {
          const cards = scrollContainer.querySelectorAll('.champion-card');
          const centerCard = cards[targetIndex];
          if (centerCard) {
            const statsElement = centerCard.querySelector('.champion-stats');
            if (statsElement) {
              statsElement.classList.add('stats-visible');
            }
          }
        }, 300);

        setTimeout(() => {
          container.style.scrollSnapType = 'x mandatory';

          setTimeout(() => {
            const col = championsLength + realIndex;
            container.style.scrollSnapType = 'none';
            container.style.scrollBehavior = 'auto';
            container.scrollLeft = col * cardWidth;
            container.style.scrollSnapType = 'x mandatory';
            container.style.scrollBehavior = 'smooth';
          }, 50);
        }, 300);
      };

      decay();
    });
  }


function finalize(champ) {
  console.log('Champion selected:', champ.nameGa);

window.showLoader();
  // Close modal if it's open
  const modal = document.getElementById('characterModal');
  if (modal) {
    modal.remove();
  }

  
  // Request fullscreen before removing container
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(err => {
      console.log('Fullscreen request failed:', err);
    });
  } else if (elem.webkitRequestFullscreen) { // Safari
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) { // IE11
    elem.msRequestFullscreen();
  }
  
  container.remove();
  if (window.startGame) {
    window.startGame(champ);
	  //This champion data is now available in any scene via this.game.config.selectedChampion
  }
}




}

// Initialize after function is defined
document.addEventListener('DOMContentLoaded', initHeroSelect);

// Also run immediately if DOM is already loaded
if (document.readyState !== 'loading') {
  console.log('DOM already loaded, initializing...');
  initHeroSelect();
}
