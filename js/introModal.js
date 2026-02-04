import { initStarfield, stopStarfield } from './game/effects/starfield.js';
import { allTunes } from './game/systems/music/allTunes.js';
import * as abcjs from 'abcjs';

let initialized = false;
let introStarfield = null;
let audioContextUnlocked = false;

console.log('[IntroModal] Preloading music data... tunes available:', Object.keys(allTunes).length);
console.log('[IntroModal] ABC.js library loaded');

// Preload/warm up the music system during intro
async function warmupMusicSystem() {
    try {
        console.log('[IntroModal] Warming up music system...');
        
        // Create a temporary audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const tempContext = new AudioContext();
        
        // Try parsing a simple tune to warm up abcjs
        const simpleTune = `X:1
T:Test
M:4/4
L:1/8
K:C
CDEF GABc|`;
        
        const parsed = abcjs.parseOnly(simpleTune);
        console.log('[IntroModal] ABC parsing warmed up');
        
        // Close temp context
        setTimeout(() => {
            tempContext.close();
        }, 100);
        
        console.log('[IntroModal] ✓ Music system ready');
    } catch (e) {
        console.warn('[IntroModal] Music warmup failed (non-critical):', e);
    }
}

// Start warming up immediately
warmupMusicSystem();




const amerginLines = [
    { ga: "Cé an té le nod slí na gcloch sléibhe?", en: "Who knows the way of the mountain stones?" },
    { ga: "Cé gair aois na gealaí?", en: "Who fortells the ages of the moon?" },
    { ga: "Cá dú dul faoi na gréine?", en: "Who knows where the sun rests?" },
    { ga: "Cé beir buar ó thigh Teathra?", en: "Who raids cattle from the house of Death?" },
    { ga: "Cé buar Teathra le gean?", en: "Upon whom do the stars smile?" },
    { ga: "Cé daon? Cé dia, dealbhóir arm faobhrach?", en: "What people? what god is the sculptor of keen weapons?" }
];


// Function to unlock audio context
async function unlockAudioContext() {
    if (audioContextUnlocked) return;
    
    try {
        // Create a temporary audio context to unlock
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const tempContext = new AudioContext();
        
        console.log('[IntroModal] Audio context state:', tempContext.state);
        
        if (tempContext.state === 'suspended') {
            await tempContext.resume();
            console.log('[IntroModal] Audio context resumed, state:', tempContext.state);
        }
        
        // Play a silent sound to fully unlock
        const buffer = tempContext.createBuffer(1, 1, 22050);
        const source = tempContext.createBufferSource();
        source.buffer = buffer;
        source.connect(tempContext.destination);
        source.start(0);
        
        audioContextUnlocked = true;
        console.log('[IntroModal] ✓ Audio context unlocked');
        
        // Close temporary context
        setTimeout(() => {
            tempContext.close();
        }, 100);
    } catch (e) {
        console.warn('[IntroModal] Audio unlock failed:', e);
    }
}

export function initIntroModal(onComplete) {
    if (initialized) return;
    initialized = true;

    // Preload the Aonchlo font before showing the modal
    async function ensureFontLoaded() {
        try {
            // Wait for the font to load
            await document.fonts.load('1.8rem Aonchlo');
            console.log('[IntroModal] Aonchlo font loaded');
        } catch (e) {
            console.warn('[IntroModal] Font preload failed (non-critical):', e);
        }
    }

    // Start font loading
    ensureFontLoaded();

    // Create container (initially hidden)
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
        opacity: 0;
        transition: opacity 0.3s ease;
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
        
        // Unlock audio on first interaction (don't await - let it happen in background)
        if (!audioContextUnlocked) {
            unlockAudioContext().catch(e => console.warn('[IntroModal] Audio unlock failed:', e));
        }
        
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
            }, 4500); // Keep the 4500ms delay from original
        }
    };

    // Also unlock on touch for mobile
    slider.addEventListener('touchstart', () => {
        if (!audioContextUnlocked) {
            unlockAudioContext().catch(e => console.warn('[IntroModal] Audio unlock failed:', e));
        }
    }, { once: false });

    contentLayer.append(irishText, englishText, slider);
    container.appendChild(contentLayer);
    document.body.appendChild(container);
    
    // Fade in the container after font loads (or after 100ms max wait)
    Promise.race([
        ensureFontLoaded(),
        new Promise(resolve => setTimeout(resolve, 100))
    ]).then(() => {
        // Small delay to ensure render, then fade in
        requestAnimationFrame(() => {
            container.style.opacity = '1';
        });
    });
}

export function getCurrentIntroState() {
    // This can be used to get state if needed
    return initialized;
}

export function isAudioUnlocked() {
    return audioContextUnlocked;
}



























