import { initStarfield, stopStarfield } from './game/effects/starfield.js';

let initialized = false;
let introStarfield = null;

const amerginLines = [
    { ga: "Cé an té le nod slí na gcloch sléibhe?", en: "Who knows the way of the mountain stones?" },
    { ga: "Cé gair aois na gealaí?", en: "Who tells the age of the moon?" },
    { ga: "Cá dú dul faoi na gréine?", en: "Where does the sun go to rest?" },
    { ga: "Cé beir buar ó thigh Teamhrach?", en: "Who brings the cattle from the house of Tara?" },
    { ga: "Cé buar Teathra le gean?", en: "Who are the cattle of Tethra with love?" },
    { ga: "Cé daon? Cé dia, dealbhóir arm faobhrach?", en: "Who is man? Who is the god that fashions weapons?" }
];

export function initIntroModal(onComplete) {
    if (initialized) return;
    initialized = true;

    // Create container
    const container = document.createElement('div');
    container.id = 'intro-modal';
    container.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: all;
    `;

    // Initialize starfield for intro modal
    introStarfield = initStarfield();
    introStarfield.style.position = 'absolute';
    introStarfield.style.inset = '0';
    introStarfield.style.zIndex = '1';
    introStarfield.style.pointerEvents = 'none';
    container.appendChild(introStarfield);

    // Content layer above starfield
    const contentLayer = document.createElement('div');
    contentLayer.style.cssText = `
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        padding: 2rem;
        box-sizing: border-box;
    `;

    // Irish text
    const irishText = document.createElement('div');
    const initialLine = amerginLines[Math.floor(Math.random() * amerginLines.length)];
    irishText.textContent = initialLine.ga;
    irishText.style.cssText = `
        font-family: Aonchlo, serif;
        font-size: 1.8rem;
        color: #d4af37;
        margin-bottom: 1rem;
        text-align: center;
        transition: opacity 0.8s ease-in-out;
        min-height: 4rem;
    `;

    // English text
    const englishText = document.createElement('div');
    englishText.textContent = initialLine.en;
    englishText.style.cssText = `
        font-family: 'Courier New', monospace;
        font-size: 1.7rem;
        color: rgb(0, 255, 0);
        opacity: 0.05;
        transition: opacity 0.5s ease;
        min-height: 4rem;
        text-align: center;
        margin-bottom: 2rem;
    `;

    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.05;
    slider.value = 0.05;
    slider.className = 'intro-slider';

    slider.style.cssText = `
        -webkit-appearance: none;
        width: 90%;
        max-width: 600px;
        height: 10px;
        background: linear-gradient(to right, #d4af37 0%, #d4af37 5%, #444 5%, #444 100%);
        border-radius: 5px;
        outline: none;
        margin: 20px 0;
    `;

    // Add slider thumb styling
    const sliderStyle = document.createElement('style');
    sliderStyle.textContent = `
        .intro-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: #ffd700;
            cursor: pointer;
            border: 8px solid rgba(255, 215, 0, 0.3);
            background-clip: padding-box;
            box-shadow: 0 0 15px rgba(0,0,0,0.5);
            animation: thumbInvite 1.5s infinite ease-in-out;
        }

        .intro-slider::-moz-range-thumb {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: #ffd700;
            cursor: pointer;
            border: 8px solid rgba(255, 215, 0, 0.3);
            box-shadow: 0 0 15px rgba(0,0,0,0.5);
        }

        @keyframes thumbInvite {
            0%, 100% { transform: scale(1); border-color: rgba(255, 215, 0, 0.3); }
            50% { transform: scale(1.15); border-color: rgba(255, 255, 255, 0.8); }
        }
    `;
    document.head.appendChild(sliderStyle);

    // Slider interaction
    let currentLyricIndex = amerginLines.indexOf(initialLine);
    let hasMovedSlider = false;

    // Cycle through Amergin lines
    const lyricInterval = setInterval(() => {
        if (!hasMovedSlider) {
            currentLyricIndex = (currentLyricIndex + 1) % amerginLines.length;
            const line = amerginLines[currentLyricIndex];
            
            irishText.style.opacity = '0';
            englishText.style.opacity = '0';

            setTimeout(() => {
                irishText.textContent = line.ga;
                englishText.textContent = line.en;
                irishText.style.opacity = '1';
                englishText.style.opacity = slider.value;
            }, 800);
        }
    }, 10000);

    slider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        englishText.style.opacity = val;
        slider.style.background = `linear-gradient(to right, #d4af37 0%, #d4af37 ${val * 100}%, #444 ${val * 100}%, #444 100%)`;
        
        if (!hasMovedSlider && val > 0.15) {
            hasMovedSlider = true;
            clearInterval(lyricInterval);
            
            // Get current line for export
            const currentLine = amerginLines[currentLyricIndex];
            
            // Fade out and complete
            setTimeout(() => {
                container.style.transition = 'opacity 0.8s ease';
                container.style.opacity = '0';
                
                setTimeout(() => {
                    // Stop intro starfield
                    if (introStarfield && introStarfield.parentNode) {
                        stopStarfield();
                    }
                    container.remove();
                    sliderStyle.remove();
                    initialized = false;
                    
                    // Call completion callback with current slider value and line
                    onComplete(val, currentLine);
                }, 800);
            }, 500);
        }
    };

    contentLayer.append(irishText, englishText, slider);
    container.appendChild(contentLayer);
    document.body.appendChild(container);
}

export function getCurrentIntroState() {
    // This can be used to get state if needed
    return initialized;
}

