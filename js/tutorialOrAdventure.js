import { championMusicManager } from './game/systems/music/championMusicManager.js';

let initialized = false;
let englishOpacity = 0.15;

export function initTutorialOrAdventure(champion) {
    if (initialized) return;
    initialized = true;

    console.log('[ChampionIntro] Starting intro for:', champion.nameGa);

    // Music Transition
    const waitForBarEnd = async () => {
        await championMusicManager.transitionToLoop(2);
    };
    waitForBarEnd();

    // 1. MAIN CONTAINER - Now with even higher z-index to be ABOVE heroSelect
    const container = document.createElement('div');
    container.id = 'championIntro';
    container.className = 'champion-intro-container';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #000;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        padding: 2rem;
        box-sizing: border-box;
    `;

    // 2. TOP SECTION (Slider)
    const topSection = document.createElement('div');
    topSection.style.cssText = `width: 100%; display: flex; justify-content: center;`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.05;
    slider.value = englishOpacity;
    slider.className = 'champion-slider';
    slider.style.cssText = `
        -webkit-appearance: none;
        width: 80%;
        max-width: 600px;
        height: 10px;
        background: linear-gradient(to right, #d4af37 0%, #d4af37 ${englishOpacity * 100}%, #444 ${englishOpacity * 100}%, #444 100%);
        border-radius: 5px;
        outline: none;
    `;

    topSection.appendChild(slider);

    // 3. MIDDLE SECTION (Scrollable Story)
    const middleSection = document.createElement('div');
    middleSection.style.cssText = `
        flex: 1;
        width: 100%;
        max-width: 800px;
        margin: 1.5rem 0;
        overflow-y: auto;
        padding-right: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
    `;

    // Define lines for interspacing
    const lines = [
        { ga: `Tá ${champion.nameGa} réidh le troid.`, en: `${champion.nameEn} is ready to fight.` },
        { ga: "An bhfuil tú réidh le dul go Portach na hEala,", en: "Will you journey to the Bog of Allen," },
        { ga: "nó ar mhaith leat oiliúint le Scáthach ar Oileán Sgitheanach?", en: "or train with Scáthach on the Isle of Skye?" }
    ];

    const storyContainer = document.createElement('div');
    storyContainer.style.width = '100%';

    // Create a list to track English elements for the slider update
    const englishElements = [];

    lines.forEach(line => {
        const lineBox = document.createElement('div');
        lineBox.style.marginBottom = '2rem';

        const gaLine = document.createElement('div');
        gaLine.style.cssText = `
            font-family: Aonchlo, serif;
            font-size: 1.6rem;
            color: #d4af37;
            margin-bottom: 0.2rem;
        `;
        gaLine.textContent = line.ga;

        const enLine = document.createElement('div');
        enLine.style.cssText = `
            font-family: 'Courier New', monospace;
            font-size: 1.1rem;
            color: rgba(0, 255, 0, ${englishOpacity});
            transition: color 0.2s ease;
        `;
        enLine.textContent = line.en;

        englishElements.push(enLine);
        lineBox.appendChild(gaLine);
        lineBox.appendChild(enLine);
        storyContainer.appendChild(lineBox);
    });

    middleSection.appendChild(storyContainer);

    // 4. BOTTOM SECTION (Compact Buttons)
    const bottomSection = document.createElement('div');
    bottomSection.style.cssText = `
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.8rem;
        padding-bottom: 10px;
        flex-shrink: 0;
    `;

    // Helper function to build the dual-language buttons
    const createButton = (irishLabel, englishLabel, onclick) => {
        const btn = document.createElement('button');
        btn.style.cssText = `
            width: 100%;
            max-width: 400px;
            padding: 1rem;
            background: #8b4513;
            border: 3px solid #d2691e;
            border-radius: 12px;
            cursor: pointer;
            color: #1a1a1a;
            transition: all 0.2s;
            flex-shrink: 0;
        `;

        const updateButtonText = () => {
            if (englishOpacity > 0.5) {
                btn.textContent = englishLabel;
                btn.style.fontFamily = '"Courier New", Courier, monospace';
                btn.style.fontWeight = '300';
                btn.style.letterSpacing = '1px';
                btn.style.textTransform = 'none';
            } else {
                btn.textContent = irishLabel;
                btn.style.fontFamily = 'Aonchlo, serif';
                btn.style.fontWeight = 'bold';
                btn.style.letterSpacing = '2px';
                btn.style.textTransform = 'uppercase';
            }
        };

        btn.onmouseover = () => btn.style.transform = 'scale(1.02)';
        btn.onmouseout = () => btn.style.transform = 'scale(1)';

        updateButtonText();
        btn.onclick = onclick;

        return { btn, updateButtonText };
    };

    // 1. Oiliúint / Training -> Starts BowTutorial
    const trainingBtn = createButton('Oiliúint', 'Training', () => {
        console.log('[TutorialOrAdventure] Training button clicked');
        console.log('[TutorialOrAdventure] Starting BowTutorial');
        cleanup();
        
        // Hide heroSelect before starting game
        const heroSelectContainer = document.getElementById('heroSelect');
        if (heroSelectContainer) {
        
heroSelectContainer.remove()
	}
        
        if (window.startGame) {
            window.startGame(champion, { startScene: 'BowTutorial' });
        } else {
            console.error('[TutorialOrAdventure] window.startGame not found!');
        }
    });

    // 2. An Portach / The Bog -> Starts BogMeadow
    const skipBtn = createButton('An Portach', 'The Bog', () => {
        console.log('[TutorialOrAdventure] Bog button clicked');
        console.log('[TutorialOrAdventure] Starting BogMeadow');
        cleanup();
        
        // Hide heroSelect before starting game
        const heroSelectContainer = document.getElementById('heroSelect');
        if (heroSelectContainer) {
        
heroSelectContainer.remove()
	}
        
        if (window.startGame) {
            window.startGame(champion, { startScene: 'BogMeadow' });
        } else {
            console.error('[TutorialOrAdventure] window.startGame not found!');
        }
    });

    // 3. Ar Ais / Back -> Just close the modal, heroSelect is still underneath!
  


const backBtn = createButton('Ar Ais', 'Back', async () => {
    console.log('[TutorialOrAdventure] Back button clicked');
    cleanup();
    
    // Optional: explicitly show heroSelect again
    const heroSelectModule = await import('./heroSelect.js');
    if (heroSelectModule.showHeroSelect) {
        heroSelectModule.showHeroSelect();
    }
});








    bottomSection.appendChild(trainingBtn.btn);
    bottomSection.appendChild(skipBtn.btn);
    bottomSection.appendChild(backBtn.btn);

    // 5. ASSEMBLE AND STYLE
    container.appendChild(topSection);
    container.appendChild(middleSection);
    container.appendChild(bottomSection);

    const sliderStyle = document.createElement('style');
    sliderStyle.textContent = `
        .champion-intro-container .champion-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: #ffd700;
            cursor: pointer;
            border: 8px solid rgba(255, 215, 0, 0.3);
            background-clip: padding-box;
            box-shadow: 0 0 15px rgba(0,0,0,0.5);
        }
    `;
    document.head.appendChild(sliderStyle);

    // 6. INPUT LOGIC (Updated for multiple elements)
    slider.oninput = (e) => {
        englishOpacity = Number(e.target.value);
        englishElements.forEach(el => {
            el.style.color = `rgba(0, 255, 0, ${englishOpacity})`;
        });
        slider.style.background = `linear-gradient(to right, #d4af37 0%, #d4af37 ${englishOpacity * 100}%, #444 ${englishOpacity * 100}%, #444 100%)`;
        trainingBtn.updateButtonText();
        skipBtn.updateButtonText();
        backBtn.updateButtonText();
    };

    function cleanup() {
        console.log('[TutorialOrAdventure] cleanup() called - removing modal overlay');
        container.remove();
        sliderStyle.remove();
        initialized = false;
    }

    // Append to body - it will sit ON TOP of heroSelect
    document.body.appendChild(container);
}

