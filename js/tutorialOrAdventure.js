// Store the current Amergin line from heroSelect
let currentAmerginLine = null;

export function setCurrentAmerginLine(line) {
    currentAmerginLine = line;
}

let initialized = false;
let englishSliderValue = 0.15;

export function initTutorialOrAdventure(champion) {
    if (initialized) return;
    initialized = true;

    // ───────────── MAIN CONTAINER (GRID) ─────────────
    const container = document.createElement('div');
    container.id = 'championIntro';
    container.style.cssText = `
        position: fixed;
        inset: 0;
        background: #000;
        z-index: 100000;
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        justify-items: center;
        padding: 1rem;
        box-sizing: border-box;
    `;

    // ───────────── SLIDER (TOP) ─────────────
    const sliderSection = document.createElement('div');
    sliderSection.style.cssText = `
        width: 100%;
        display: flex;
        justify-content: center;
    `;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.05;
    slider.value = englishSliderValue;

    const updateSliderStyle = () => {
        slider.style.background = `
            linear-gradient(
                to right,
                #d4af37 0%,
                #d4af37 ${englishSliderValue * 100}%,
                #444 ${englishSliderValue * 100}%,
                #444 100%
            )
        `;
    };

    slider.style.cssText = `
        -webkit-appearance: none;
        width: 80%;
        max-width: 600px;
        height: 10px;
        border-radius: 5px;
        outline: none;
    `;
    updateSliderStyle();

    sliderSection.appendChild(slider);

    // ───────────── TEXT (BELOW SLIDER) ─────────────
    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
        text-align: center;
        max-width: 800px;
        margin-top: 0.5rem;
    `;

    const displayLine = currentAmerginLine || {
        ga: `Cé an té le nod slí na gcloch sléibhe?`,
        en: `Who knows the way of the mountain stones?`
    };

    const irishText = document.createElement('div');
    irishText.textContent = displayLine.ga;
    irishText.style.cssText = `
        font-family: Aonchlo, serif;
        font-size: 2rem;
        color: #d4af37;
        line-height: 1.5;
    `;

    const englishText = document.createElement('div');
    englishText.textContent = displayLine.en;
    englishText.style.cssText = `
        font-family: 'Courier New', monospace;
        font-size: 1.4rem;
        color: #00ff00;
        line-height: 1.5;
        display: none;
    `;

    textContainer.append(irishText, englishText);

    // ───────────── CHAMPION (CENTER, VISIBLE) ─────────────
    const championHolder = document.createElement('div');
    championHolder.style.cssText = `
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
    `;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
        display: block;
        height: 420px;
        max-height: 60vh;
        width: auto;
        image-rendering: pixelated;
    `;

    championHolder.appendChild(canvas);

    async function loadChampionSprite() {
        try {
            const sheet = new Image();
            sheet.src = 'assets/champions/champions-with-kit.png';

            const atlas = await fetch('assets/champions/champions0.json').then(r => r.json());
            await new Promise(res => (sheet.onload = res));

            const frameName = champion.spriteKey.endsWith('.png')
                ? champion.spriteKey
                : `${champion.spriteKey}.png`;

            const frame = atlas.textures[0].frames.find(f => f.filename === frameName);
            if (!frame) return;

            canvas.width = frame.frame.w;
            canvas.height = frame.frame.h;

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
                sheet,
                frame.frame.x,
                frame.frame.y,
                frame.frame.w,
                frame.frame.h,
                0,
                0,
                frame.frame.w,
                frame.frame.h
            );
        } catch (e) {
            console.error('Champion sprite load failed', e);
        }
    }

    loadChampionSprite();

    // ───────────── BUTTONS (BOTTOM) ─────────────
    const bottomSection = document.createElement('div');
    bottomSection.style.cssText = `
        width: 100%;
        max-width: 800px;
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
        margin-bottom: 0.5rem;
    `;

    function createButton(ga, en, onClick) {
        const btn = document.createElement('button');
        btn.style.cssText = `
            width: 100%;
            padding: 1.1rem;
            border-radius: 12px;
            background: linear-gradient(145deg, #8b4513, #d2691e, #8b4513);
            border: 3px solid #d2691e;
            font-family: Aonchlo;
            font-size: 1.3rem;
            cursor: pointer;
        `;

        const label = document.createElement('div');
        label.textContent = ga;

        btn.appendChild(label);
        btn.onclick = onClick;

        return {
            btn,
            setLanguage(isEnglish) {
                label.textContent = isEnglish ? en : ga;
            }
        };
    }

    const trainingBtn = createButton('Oiliúint', 'Training', () => {
        cleanup();
        document.getElementById('heroSelect')?.remove();
        window.startGame?.(champion, { startScene: 'BowTutorial' });
    });

    const bogBtn = createButton('An Portach', 'The Bog', () => {
        cleanup();
        document.getElementById('heroSelect')?.remove();
        window.startGame?.(champion, { startScene: 'BogMeadow' });
    });

    const backBtn = createButton('Ar Ais', 'Back', async () => {
        const heroSelect = await import('./heroSelect.js');
        await heroSelect.muteSecondInstrument?.();
        cleanup();
        heroSelect.showHeroSelect?.();
    });

    bottomSection.append(trainingBtn.btn, bogBtn.btn, backBtn.btn);

    // ───────────── LANGUAGE SWITCH LOGIC ─────────────
    function updateLanguage() {
        const isEnglish = englishSliderValue >= 0.5;

        irishText.style.display = isEnglish ? 'none' : 'block';
        englishText.style.display = isEnglish ? 'block' : 'none';

        trainingBtn.setLanguage(isEnglish);
        bogBtn.setLanguage(isEnglish);
        backBtn.setLanguage(isEnglish);
    }

    slider.oninput = e => {
        englishSliderValue = parseFloat(e.target.value);
        updateSliderStyle();
        updateLanguage();
    };

    updateLanguage();

    // ───────────── ASSEMBLE ─────────────
    container.append(
        sliderSection,
        textContainer,
        championHolder,
        bottomSection
    );

    document.body.appendChild(container);

    function cleanup() {
        initialized = false;
        container.remove();
    }
}
