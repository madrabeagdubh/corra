// tutorialOrAdventure.js
// Using a single state object avoids any re-declaration conflicts
// if this module is ever evaluated in an unexpected context.

const _state = {
    currentAmerginLine: null,
    initialized: false,
    englishSliderValue: 0.15,
};

export function setCurrentAmerginLine(line) {
    _state.currentAmerginLine = line;
}

// ─────────────────────────────────────────────
// SPINNING STARFIELD
// Fully self-contained. Returns stop() fn.
// ─────────────────────────────────────────────
function createStarfield() {
    const sfCanvas = document.createElement('canvas');
    sfCanvas.id = 'tutorialStarfield';
    sfCanvas.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        z-index: 100000;
        pointer-events: none;
    `;
    document.body.appendChild(sfCanvas);
    sfCanvas.width  = window.innerWidth;
    sfCanvas.height = window.innerHeight;

    const ctx = sfCanvas.getContext('2d');
    let rafId = null;

    function makeStar(scatter) {
        return {
            angle:      Math.random() * Math.PI * 2,
            depth:      scatter ? Math.random() * (sfCanvas.width * 0.5) : sfCanvas.width * 0.5,
            speed:      Math.random() * 1.5 + 0.5,
            size:       Math.random() * 1.5 + 0.5,
            brightness: Math.random() * 0.6 + 0.4,
        };
    }

    const stars = Array.from({ length: 200 }, () => makeStar(true));

    function loop() {
        ctx.clearRect(0, 0, sfCanvas.width, sfCanvas.height);
        for (const s of stars) {
            s.depth -= s.speed;
            if (s.depth <= 0) { Object.assign(s, makeStar(false)); continue; }

            const cx    = sfCanvas.width  / 2;
            const cy    = sfCanvas.height / 2;
            const scale = (sfCanvas.width * 0.5) / s.depth;
            const x     = cx + Math.cos(s.angle) * scale * 100;
            const y     = cy + Math.sin(s.angle) * scale * 100;

            if (x < -20 || x > sfCanvas.width + 20 || y < -20 || y > sfCanvas.height + 20) {
                Object.assign(s, makeStar(false));
                continue;
            }

            ctx.beginPath();
            ctx.arc(x, y, Math.max(0.3, s.size * scale * 0.8), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(212,175,55,${s.brightness * Math.min(1, scale * 0.4)})`;
            ctx.fill();
        }
        rafId = requestAnimationFrame(loop);
    }
    loop();

    return function stop() {
        if (rafId) cancelAnimationFrame(rafId);
        sfCanvas.remove();
    };
}

// ─────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────
export function initTutorialOrAdventure(champion, sliderValue = 0.15, amerginLine = null) {
    if (_state.initialized) return;
    _state.initialized = true;

    _state.englishSliderValue = sliderValue;
    if (amerginLine) _state.currentAmerginLine = amerginLine;

    console.log('[TutorialOrAdventure] Initializing with champion:', champion.nameEn);

    // Unmute all instruments (fire-and-forget)
    (async () => {
        try {
            const mod = await import('./heroSelect.js');
            const mp  = mod.getMusicPlayer?.();
            if (mp?.tracks) {
                for (let i = 0; i < mp.tracks.length; i++) {
                    if (mp.tracks[i] && !mp.tracks[i].active) await mp.toggleInstrument(i);
                }
                console.log('[TutorialOrAdventure] All instruments active');
            }
        } catch (e) { console.error('[TutorialOrAdventure] Unmute error:', e); }
    })();

    // ── BOOGIE KEYFRAMES ─────────────────────
    if (!document.getElementById('tutorialBoogieStyle')) {
        const s = document.createElement('style');
        s.id = 'tutorialBoogieStyle';
        s.textContent = `
            @keyframes championBoogie {
                0%,  24.9% { transform: translateY(0px)   scale( 1,   1);                  }
                12.5%      { transform: translateY(-12px) scale( 0.9, 1.15) rotate( 3deg); }
                25%, 49.9% { transform: translateY(0px)   scale(-1,   1);                  }
                37.5%      { transform: translateY(-12px) scale(-0.9, 1.15) rotate(-3deg); }
                50%, 74.9% { transform: translateY(0px)   scale( 1,   1);                  }
                62.5%      { transform: translateY(-12px) scale( 0.9, 1.15) rotate( 3deg); }
                75%, 99.9% { transform: translateY(0px)   scale(-1,   1);                  }
                87.5%      { transform: translateY(-12px) scale(-0.9, 1.15) rotate(-3deg); }
                100%       { transform: translateY(0px)   scale( 1,   1);                  }
            }
            .tutorial-champion-canvas {
                animation: championBoogie 2s linear infinite;
                transform-origin: bottom center;
            }
        `;
        document.head.appendChild(s);
    }

    // ── Z-INDEX LAYER STACK ──────────────────
    // 99999  : black background div
    // 100000 : starfield canvas  (pointer-events:none — never blocks input)
    // 100001 : UI container      (all visible interactive elements)

    const blackBg = document.createElement('div');
    blackBg.id = 'tutorialBlackBg';
    blackBg.style.cssText = `
        position: fixed; inset: 0;
        background: #000;
        z-index: 99999;
        pointer-events: none;
    `;
    document.body.appendChild(blackBg);

    let stopStarfield = createStarfield();

    // ── UI CONTAINER ─────────────────────────
    // height:100% + overflow:hidden so flex children fill the screen
    const uiContainer = document.createElement('div');
    uiContainer.id = 'championIntro';
    uiContainer.style.cssText = `
        position: fixed; inset: 0;
        background: transparent;
        z-index: 100001;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        box-sizing: border-box;
        overflow: hidden;
    `;

    // ── SLIDER SECTION ───────────────────────
    const sliderSection = document.createElement('div');
    sliderSection.style.cssText = `
        width: 100%;
        display: flex; justify-content: center;
        padding: 1rem 0;
        background: rgba(0,0,0,0.8);
        flex-shrink: 0;
    `;

    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = 0; slider.max = 1; slider.step = 0.05;
    slider.value = _state.englishSliderValue;
    slider.className = 'champion-slider';
    slider.style.cssText = `
        -webkit-appearance: none;
        width: 80%; max-width: 600px;
        height: 12px; border-radius: 6px;
        outline: none; cursor: pointer;
    `;

    const sliderThumbStyle = document.createElement('style');
    sliderThumbStyle.id = 'tutorialSliderStyle';
    sliderThumbStyle.textContent = `
        #championIntro .champion-slider::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 24px; height: 24px; border-radius: 50%;
            background: #d4af37; cursor: pointer;
            border: 2px solid #000;
            box-shadow: 0 0 8px rgba(212,175,55,0.6);
        }
        #championIntro .champion-slider::-moz-range-thumb {
            width: 24px; height: 24px; border-radius: 50%;
            background: #d4af37; cursor: pointer;
            border: 2px solid #000; box-shadow: 0 0 8px rgba(212,175,55,0.6);
        }
    `;
    document.head.appendChild(sliderThumbStyle);

    function refreshSliderTrack() {
        const pct = _state.englishSliderValue * 100;
        slider.style.background = `linear-gradient(to right, #d4af37 0%, #d4af37 ${pct}%, #444 ${pct}%, #444 100%)`;
    }
    refreshSliderTrack();
    sliderSection.appendChild(slider);

    // ── AMERGIN TEXT ─────────────────────────
    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
        text-align: center; max-width: 800px; width: 100%;
        padding: 1.5rem 1rem 0.5rem 1rem;
        flex-shrink: 0;
        box-sizing: border-box;
    `;
    const displayLine = _state.currentAmerginLine || {
        ga: 'Cé an té le nod slí na gcloch sléibhe?',
        en: 'Who knows the way of the mountain stones?'
    };
    const irishTextEl = document.createElement('div');
    irishTextEl.textContent = displayLine.ga;
    irishTextEl.style.cssText = `
        font-family: Aonchlo, serif;
        font-size: 1.8rem; color: #d4af37;
        margin-bottom: 0.5rem; line-height: 1.5;
    `;
    textContainer.appendChild(irishTextEl);

    // ── CHAMPION AREA ────────────────────────
    // flex:1 fills remaining height; padding-bottom:180px matches heroSelect .champion-card
    const championHolder = document.createElement('div');
    championHolder.style.cssText = `
        flex: 1; width: 100%;
        min-height: 0;
        display: flex; flex-direction: column;
        justify-content: center; align-items: center;
        overflow: hidden;
        padding: 0.5rem 1rem;
        box-sizing: border-box;
    `;

    const responseIrish = document.createElement('div');
    responseIrish.textContent = 'Cé murach mise.';
    responseIrish.style.cssText = `
        font-family: Aonchlo, serif;
        font-size: 1.8rem; color: #ffd700;
        margin-bottom: 1rem; line-height: 1.5;
        opacity: 0; transition: opacity 0.6s ease;
    `;

    const championCanvas = document.createElement('canvas');
    championCanvas.className = 'tutorial-champion-canvas';
    championCanvas.style.cssText = `
        display: block !important;
        max-width: 85%; max-height: 35vh;
        object-fit: contain;
        image-rendering: pixelated;
        image-rendering: -moz-crisp-edges;
        image-rendering: crisp-edges;
        filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5));
        margin-bottom: 20px;
    `;

    const responseEnglish = document.createElement('div');
    responseEnglish.textContent = 'Who, if not I.';
    responseEnglish.style.cssText = `
        font-family: CourierPrime, 'Courier New', monospace;
        font-size: 1.7rem; color: rgb(0,255,0);
        opacity: 0; transition: opacity 0.6s ease; line-height: 1.5;
    `;

    championHolder.append(responseIrish, championCanvas, responseEnglish);

    // Load sprite
    (async function loadSprite() {
        try {
            const atlas = await fetch('assets/champions/champions0.json').then(r => r.json());
            const sheet = await new Promise((res, rej) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => res(img);
                img.onerror = rej;
                img.src = 'assets/champions/champions0.png';
            });
            const frameName = champion.spriteKey.endsWith('.png') ? champion.spriteKey : `${champion.spriteKey}.png`;
            const frame = atlas.textures[0].frames.find(f => f.filename === frameName);
            if (!frame) { console.error('[TutorialOrAdventure] Frame not found:', frameName); return; }

            championCanvas.width  = frame.frame.w;
            championCanvas.height = frame.frame.h;
            const c = championCanvas.getContext('2d');
            c.imageSmoothingEnabled = false;
            c.drawImage(sheet, frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h, 0, 0, frame.frame.w, frame.frame.h);
            console.log('[TutorialOrAdventure] Sprite drawn successfully');
        } catch (e) {
            console.error('[TutorialOrAdventure] Sprite load failed:', e);
        }
    })();

    // ── BUTTONS ──────────────────────────────
    const bottomSection = document.createElement('div');
    bottomSection.style.cssText = `
        width: 100%; max-width: 800px;
        display: flex; flex-direction: column;
        gap: 0.7rem; padding: 1rem;
        box-sizing: border-box; flex-shrink: 0;
        transition: opacity 0.6s ease;
    `;

    function createButton(ga, en, onClick) {
        const btn = document.createElement('button');
        btn.style.cssText = `
            width: 100%; padding: 1.1rem; border-radius: 12px;
            background: linear-gradient(145deg, #8b4513, #d2691e, #8b4513);
            border: 3px solid #d2691e;
            font-size: 1.3rem; cursor: pointer; color: #fff;
            transition: all 0.2s ease;
        `;
        const label = document.createElement('div');
        label.textContent = ga;
        label.style.fontFamily = 'Aonchlo, serif';
        btn.appendChild(label);
        btn.onclick = onClick;
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.02)'; btn.style.boxShadow = '0 0 15px rgba(210,105,30,0.5)'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)';    btn.style.boxShadow = 'none'; };
        return {
            btn,
            setLanguage(opacity) {
                const isEn = opacity >= 0.5;
                label.textContent      = isEn ? en : ga;
                label.style.fontFamily = isEn ? "CourierPrime, 'Courier New', monospace" : 'Aonchlo, serif';
            }
        };
    }

    function cleanupHeroSelect() {
        document.getElementById('heroSelect')?.remove();
        document.getElementById('global-stats-bar')?.remove();
        document.getElementById('statPopup')?.remove();
        document.getElementById('sunSliderStyle')?.remove();
        document.getElementById('statPopupStyle')?.remove();
        console.log('[TutorialOrAdventure] ✓ heroSelect elements cleaned up');
    }

    async function showResponseAndProceed(callback) {
        responseIrish.style.opacity   = '1';
        responseEnglish.style.opacity = String(_state.englishSliderValue);
        bottomSection.style.opacity       = '0';
        bottomSection.style.pointerEvents = 'none';

        await new Promise(r => setTimeout(r, 2000));

        try {
            const heroSelect  = await import('./heroSelect.js');
            const mp = heroSelect.getMusicPlayer?.();
            if (mp?.tracks) {
                for (let i = 0; i < mp.tracks.length; i++) {
                    const t = mp.tracks[i];
                    if (t && typeof t.active !== 'undefined' && !t.active) await mp.toggleInstrument(i);
                }
                const t0 = mp.audioContext.currentTime;
                for (const track of mp.tracks) {
                    if (track?.active && track.gain) track.gain.gain.setTargetAtTime(0, t0, 0.6);
                }
            }
        } catch (e) { console.error('[TutorialOrAdventure] Music fade error:', e); }

        const blackOverlay = document.createElement('div');
        blackOverlay.style.cssText = `
            position: fixed; inset: 0; background: #000; opacity: 0;
            z-index: 200000; transition: opacity 2s ease; pointer-events: none;
        `;
        document.body.appendChild(blackOverlay);

        setTimeout(() => {
            [sliderSection, textContainer, championHolder].forEach(el => {
                el.style.transition = 'opacity 1s ease'; el.style.opacity = '0';
            });
            blackOverlay.style.opacity = '1';
        }, 100);

        if (stopStarfield) { stopStarfield(); stopStarfield = null; }
        blackBg.style.transition = 'opacity 1s ease'; blackBg.style.opacity = '0';

        await new Promise(r => setTimeout(r, 2500));

        blackOverlay.remove();
        blackBg.remove();
        document.getElementById('championIntro')?.remove();
        sliderThumbStyle.remove();
        callback();
    }

    const trainingBtn = createButton('Oiliúint', 'Training', () => {
        showResponseAndProceed(() => {
            cleanupHeroSelect();
            window.startGame
                ? window.startGame(champion, { startScene: 'BowTutorial' })
                : console.error('[TutorialOrAdventure] window.startGame not found!');
        });
    });

    const bogBtn = createButton('An Portach', 'The Bog', () => {
        showResponseAndProceed(() => {
            cleanupHeroSelect();
            window.startGame
                ? window.startGame(champion, { startScene: 'BogMeadow' })
                : console.error('[TutorialOrAdventure] window.startGame not found!');
        });
    });

    const backBtn = createButton('Ar Ais', 'Back', async () => {
        try {
            const mod = await import('./heroSelect.js');
            if (mod.muteSecondInstrument) await mod.muteSecondInstrument();
            cleanup();
            const hsc = document.getElementById('heroSelect');
            if (hsc) { hsc.style.opacity = '1'; hsc.style.pointerEvents = 'auto'; }
            if (mod.showHeroSelect) mod.showHeroSelect();
        } catch (e) {
            console.error('[TutorialOrAdventure] Back error:', e);
            cleanup();
        }
    });

    bottomSection.append(trainingBtn.btn, bogBtn.btn, backBtn.btn);

    // ── LANGUAGE UPDATES ─────────────────────
    function updateLanguage() {
        trainingBtn.setLanguage(_state.englishSliderValue);
        bogBtn.setLanguage(_state.englishSliderValue);
        backBtn.setLanguage(_state.englishSliderValue);
    }

    slider.oninput = e => {
        _state.englishSliderValue = parseFloat(e.target.value);
        refreshSliderTrack();
        updateLanguage();
    };

    updateLanguage();

    // ── ASSEMBLE ─────────────────────────────
    uiContainer.append(sliderSection, textContainer, championHolder, bottomSection);
    document.body.appendChild(uiContainer);

    // ── CLEANUP ──────────────────────────────
    function cleanup() {
        _state.initialized = false;
        if (stopStarfield) { stopStarfield(); stopStarfield = null; }
        document.getElementById('tutorialBlackBg')?.remove();
        document.getElementById('championIntro')?.remove();
        document.getElementById('tutorialSliderStyle')?.remove();
    }
}

