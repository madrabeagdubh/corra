// Store the current Amergin line from heroSelect
let currentAmerginLine = null;

export function setCurrentAmerginLine(line) {
    currentAmerginLine = line;
}

let initialized = false;
let englishSliderValue = 0.15;

export function initTutorialOrAdventure(champion, sliderValue = 0.15, amerginLine = null) {
    if (initialized) return;
    initialized = true;

    // Use the passed slider value from heroSelect
    englishSliderValue = sliderValue;
    
    // Use the passed Amergin line if provided
    if (amerginLine) {
        currentAmerginLine = amerginLine;
    }

    console.log('[TutorialOrAdventure] Initializing with champion:', champion.nameEn);




// UNMUTE ALL INSTRUMENTS when tutorial/adventure screen opens
    (async () => {
        const heroSelectModule = await import('./heroSelect.js');
        const musicPlayer = heroSelectModule.getMusicPlayer?.();
        
        if (musicPlayer && musicPlayer.tracks) {
            console.log('[TutorialOrAdventure] Unmuting all instruments');
            
            // Unmute all tracks
            for (let i = 0; i < musicPlayer.tracks.length; i++) {
                if (musicPlayer.tracks[i] && !musicPlayer.tracks[i].active) {
                    console.log('[TutorialOrAdventure] Unmuting:', musicPlayer.tracks[i].name || `Track ${i}`);
                    await musicPlayer.toggleInstrument(i);
                }
            }
            
            console.log('[TutorialOrAdventure] All instruments active');
        }
    })();





    // ───────────── MAIN CONTAINER ─────────────
    const container = document.createElement('div');
    container.id = 'championIntro';
    container.style.cssText = `
        position: fixed;
        inset: 0;
        background: #000;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0;
        box-sizing: border-box;
    `;

    // ───────────── SLIDER (TOP - STYLED LIKE HEROSELECT) ─────────────
    const sliderSection = document.createElement('div');
    sliderSection.style.cssText = `
        width: 100%;
        display: flex;
        justify-content: center;
        padding: 1rem 0;
        background: rgba(0, 0, 0, 0.8);
    `;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.05;
    slider.value = englishSliderValue;
    slider.className = 'champion-slider'; // Match heroSelect class

    // Apply the exact same styling as heroSelect's slider
    slider.style.cssText = `
        -webkit-appearance: none;
        width: 80%;
        max-width: 600px;
        height: 12px;
        border-radius: 6px;
        outline: none;
        cursor: pointer;
        background: linear-gradient(
            to right,
            #d4af37 0%,
            #d4af37 ${englishSliderValue * 100}%,
            #444 ${englishSliderValue * 100}%,
            #444 100%
        );
    `;

    // Add the webkit thumb styling to match heroSelect
    const sliderStyle = document.createElement('style');
    sliderStyle.textContent = `
        #championIntro .champion-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #d4af37;
            cursor: pointer;
            border: 2px solid #000;
            box-shadow: 0 0 8px rgba(212, 175, 55, 0.6);
        }

        #championIntro .champion-slider::-moz-range-thumb {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #d4af37;
            cursor: pointer;
            border: 2px solid #000;
            box-shadow: 0 0 8px rgba(212, 175, 55, 0.6);
        }
    `;
    document.head.appendChild(sliderStyle);

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

    sliderSection.appendChild(slider);

    // ───────────── TEXT (BELOW SLIDER - SAME AS HEROSELECT) ─────────────
    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
        text-align: center;
        max-width: 800px;
        padding: 2rem 1rem 1rem 1rem;
        min-height: 120px;
    `;

    // Use the current Amergin line from heroSelect, or fall back to default
    const displayLine = currentAmerginLine || {
        ga: `Cé an té le nod slí na gcloch sléibhe?`,
        en: `Who knows the way of the mountain stones?`
    };

    const irishText = document.createElement('div');
    irishText.textContent = displayLine.ga;
    irishText.style.cssText = `
        font-family: Aonchlo, serif;
        font-size: 1.8rem;
        color: #d4af37;
        margin-bottom: 1.5rem;
        line-height: 1.5;
    `;

    textContainer.append(irishText);

    // ───────────── CHAMPION (CENTER - SAME SIZE AS HEROSELECT) ─────────────
    const championHolder = document.createElement('div');
    championHolder.style.cssText = `
        flex: 1;
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        overflow: visible;
        padding: 1rem;
        position: relative;
    `;

    // Response text - Irish (above champion, hidden initially)
    const responseIrish = document.createElement('div');
    responseIrish.textContent = 'Cé murach mise.';
    responseIrish.style.cssText = `
        font-family: Aonchlo, serif;
        font-size: 1.8rem;
        color: #ffd700;
        margin-bottom: 1rem;
        line-height: 1.5;
        opacity: 0;
        transition: opacity 0.6s ease;
    `;

    const canvas = document.createElement('canvas');
    canvas.className = 'champion-canvas';
    canvas.style.cssText = `
        display: block !important;
        max-width: 85%;
        max-height: 55vh;
        object-fit: contain;
        image-rendering: pixelated;
        image-rendering: -moz-crisp-edges;
        image-rendering: crisp-edges;
        filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5));
        margin-bottom: 1rem;
    `;

    // Response text - English (below champion, hidden initially)
    const responseEnglish = document.createElement('div');
    responseEnglish.textContent = 'Who, if not I.';
    responseEnglish.style.cssText = `
        font-family: 'Courier New', monospace;
        font-size: 1.7rem;
        color: rgb(0, 255, 0);
        opacity: 0;
        transition: opacity 0.6s ease;
        line-height: 1.5;
    `;

    championHolder.append(responseIrish, canvas, responseEnglish);

    // Load sprite immediately
    (async function loadChampionSprite() {
        console.log('[TutorialOrAdventure] Loading champion sprite for:', champion.nameEn);
        
        try {
            const sheet = new Image();
            sheet.crossOrigin = "anonymous";
            
            const atlas = await fetch('assets/champions/champions0.json').then(r => r.json());
            
            const loadPromise = new Promise((resolve, reject) => {
                sheet.onload = () => {
                    console.log('[TutorialOrAdventure] Sheet loaded successfully');
                    resolve();
                };
                sheet.onerror = (e) => {
                    console.error('[TutorialOrAdventure] Sheet load error:', e);
                    reject(e);
                };
            });
            
            sheet.src = 'assets/champions/champions0.png';
            await loadPromise;

            const frameName = champion.spriteKey.endsWith('.png')
                ? champion.spriteKey
                : `${champion.spriteKey}.png`;

            const frame = atlas.textures[0].frames.find(f => f.filename === frameName);
            
            if (!frame) {
                console.error('[TutorialOrAdventure] Frame not found for:', frameName);
                return;
            }

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
            
            console.log('[TutorialOrAdventure] Champion sprite drawn successfully');
        } catch (e) {
            console.error('[TutorialOrAdventure] Champion sprite load failed:', e);
        }
    })();

    // ───────────── BUTTONS (BOTTOM) ─────────────
    const bottomSection = document.createElement('div');
    bottomSection.style.cssText = `
        width: 100%;
        max-width: 800px;
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
        padding: 1rem;
        box-sizing: border-box;
        transition: opacity 0.6s ease;
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
            color: #fff;
            transition: all 0.2s ease;
        `;

        const label = document.createElement('div');
        label.textContent = ga;

        btn.appendChild(label);
        btn.onclick = onClick;

        // Add hover effect
        btn.onmouseenter = () => {
            btn.style.transform = 'scale(1.02)';
            btn.style.boxShadow = '0 0 15px rgba(210, 105, 30, 0.5)';
        };
        btn.onmouseleave = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = 'none';
        };

        return {
            btn,
            setLanguage(opacity) {
                // Show Irish when opacity is low, English when high
                const isEnglish = opacity >= 0.5;
                label.textContent = isEnglish ? en : ga;
            }
        };
    }

    // Function to show the response and proceed after delay
    async function showResponseAndProceed(callback) {
        // Fade in the Irish response
        responseIrish.style.opacity = '1';
        
        // Fade in the English response based on current slider value
        responseEnglish.style.opacity = englishSliderValue;
        
        // Hide buttons
        bottomSection.style.opacity = '0';
        bottomSection.style.pointerEvents = 'none';
        
        // Wait 2 seconds for the response to be read
        setTimeout(async () => {
            // Unmute all instruments for final flourish
            const heroSelect = await import('./heroSelect.js');
            const musicPlayer = heroSelect.getMusicPlayer?.();
            
            if (musicPlayer && musicPlayer.tracks) {
                console.log('[TutorialOrAdventure] Unmuting all instruments for fade out');
                
                // Unmute all tracks first - with safety check
                for (let i = 0; i < musicPlayer.tracks.length; i++) {
                    // Check if track exists and has the active property
                    if (musicPlayer.tracks[i] && typeof musicPlayer.tracks[i].active !== 'undefined') {
                        if (!musicPlayer.tracks[i].active) {
                            await musicPlayer.toggleInstrument(i);
                        }
                    } else {
                        console.log('[TutorialOrAdventure] Track', i, 'not ready yet, skipping');
                    }
                }
                
                // Fade out all tracks over 2 seconds
                console.log('[TutorialOrAdventure] Fading out music...');
                const fadeStartTime = musicPlayer.audioContext.currentTime;
                
                for (const track of musicPlayer.tracks) {
                    // Check if track and gain exist before fading
                    if (track && track.active && track.gain) {
                        // Exponential fade out
                        track.gain.gain.setTargetAtTime(0, fadeStartTime, 0.6);
                    }
                }
            }
            
            // Create black overlay for fade to black
            const blackOverlay = document.createElement('div');
            blackOverlay.style.cssText = `
                position: fixed;
                inset: 0;
                background: #000;
                opacity: 0;
                z-index: 100001;
                transition: opacity 2s ease;
                pointer-events: none;
            `;
            document.body.appendChild(blackOverlay);
            
            // Start fading everything out
            setTimeout(() => {
                sliderSection.style.transition = 'opacity 1s ease';
                sliderSection.style.opacity = '0';
                textContainer.style.transition = 'opacity 1s ease';
                textContainer.style.opacity = '0';
                championHolder.style.transition = 'opacity 1.5s ease';
                championHolder.style.opacity = '0';
                blackOverlay.style.opacity = '1';
            }, 100);
            
            // Find and fade out starfield
            console.log('[TutorialOrAdventure] Looking for starfield canvases...');
            const allCanvases = document.querySelectorAll('canvas');
            allCanvases.forEach(canvas => {
                const style = canvas.style;
                const isStarfield = 
                    style.position === 'fixed' || 
                    style.zIndex === '1' ||
                    style.zIndex === '200' ||
                    canvas.width === window.innerWidth;
                
                if (isStarfield && canvas.parentElement) {
                    console.log('[TutorialOrAdventure] Found starfield, fading out...');
                    canvas.style.transition = 'opacity 2s ease';
                    canvas.style.opacity = '0';
                }
            });
            
            // After 2.5 seconds, proceed to game
            setTimeout(() => {
                // Stop music completely
                if (musicPlayer && musicPlayer.stop) {
                    console.log('[TutorialOrAdventure] Stopping music player');
                    musicPlayer.stop();
                }
                
                // Remove starfield canvases
                allCanvases.forEach(canvas => {
                    const style = canvas.style;
                    const isStarfield = 
                        style.position === 'fixed' || 
                        style.zIndex === '1' ||
                        style.zIndex === '200' ||
                        canvas.width === window.innerWidth;
                    
                    if (isStarfield && canvas.parentElement) {
                        canvas.remove();
                    }
                });
                
                // CRITICAL: Remove the black overlay BEFORE calling callback
                if (blackOverlay && blackOverlay.parentElement) {
                    console.log('[TutorialOrAdventure] Removing black overlay');
                    blackOverlay.remove();
                }
                
                // Also remove the main tutorialOrAdventure container
                const tutorialContainer = document.getElementById('championIntro');
                if (tutorialContainer) {
                    console.log('[TutorialOrAdventure] Removing championIntro container');
                    tutorialContainer.remove();
                }
                
                console.log('[TutorialOrAdventure] Calling game start callback');
                callback();
            }, 2500);
        }, 2000);
    }

    const trainingBtn = createButton('Oiliúint', 'Training', () => {
        showResponseAndProceed(() => {
            console.log('[TutorialOrAdventure] Training button clicked');
            console.log('[TutorialOrAdventure] Starting BowTutorial');
            
            // COMPLETE CLEANUP: Remove ALL heroSelect-related elements
            
            // 1. Remove heroSelect container
            const heroSelectContainer = document.getElementById('heroSelect');
            if (heroSelectContainer) {
                console.log('[TutorialOrAdventure] Removing heroSelect container');
                heroSelectContainer.remove();
            }
            
            // 2. Remove global stats bar (critical - this is what's intercepting touches!)
            const statsBar = document.getElementById('global-stats-bar');
            if (statsBar) {
                console.log('[TutorialOrAdventure] Removing global stats bar');
                statsBar.remove();
            }
            
            // 3. Remove any stat popups
            const statPopup = document.getElementById('statPopup');
            if (statPopup) {
                console.log('[TutorialOrAdventure] Removing stat popup');
                statPopup.remove();
            }
            
            // 4. Remove any lingering styles
            const sunSliderStyle = document.getElementById('sunSliderStyle');
            if (sunSliderStyle) {
                sunSliderStyle.remove();
            }
            
            const statPopupStyle = document.getElementById('statPopupStyle');
            if (statPopupStyle) {
                statPopupStyle.remove();
            }
            
            console.log('[TutorialOrAdventure] ✓ All heroSelect elements cleaned up');
            
            if (window.startGame) {
                window.startGame(champion, { startScene: 'BowTutorial' });
            } else {
                console.error('[TutorialOrAdventure] window.startGame not found!');
            }
        });
    });

    const bogBtn = createButton('An Portach', 'The Bog', () => {
        showResponseAndProceed(() => {
            console.log('[TutorialOrAdventure] Bog button clicked');
            console.log('[TutorialOrAdventure] Starting BogMeadow');
            
            // COMPLETE CLEANUP: Remove ALL heroSelect-related elements
            
            // 1. Remove heroSelect container
            const heroSelectContainer = document.getElementById('heroSelect');
            if (heroSelectContainer) {
                console.log('[TutorialOrAdventure] Removing heroSelect container');
                heroSelectContainer.remove();
            }
            
            // 2. Remove global stats bar (critical - this is what's intercepting touches!)
            const statsBar = document.getElementById('global-stats-bar');
            if (statsBar) {
                console.log('[TutorialOrAdventure] Removing global stats bar');
                statsBar.remove();
            }
            
            // 3. Remove any stat popups
            const statPopup = document.getElementById('statPopup');
            if (statPopup) {
                console.log('[TutorialOrAdventure] Removing stat popup');
                statPopup.remove();
            }
            
            // 4. Remove any lingering styles
            const sunSliderStyle = document.getElementById('sunSliderStyle');
            if (sunSliderStyle) {
                sunSliderStyle.remove();
            }
            
            const statPopupStyle = document.getElementById('statPopupStyle');
            if (statPopupStyle) {
                statPopupStyle.remove();
            }
            
            console.log('[TutorialOrAdventure] ✓ All heroSelect elements cleaned up');
            
            if (window.startGame) {
                window.startGame(champion, { startScene: 'BogMeadow' });
            } else {
                console.error('[TutorialOrAdventure] window.startGame not found!');
            }
        });
    });

    const backBtn = createButton('Ar Ais', 'Back', async () => {
        console.log('[TutorialOrAdventure] Back button clicked');
        
        // Mute the second instrument (piano) before going back
        const heroSelectModule = await import('./heroSelect.js');
        if (heroSelectModule.muteSecondInstrument) {
            console.log('[TutorialOrAdventure] Muting second instrument');
            await heroSelectModule.muteSecondInstrument();
        }
        
        cleanup(); // remove modal
        
        // Unpause heroSelect
        const heroSelectContainer = document.getElementById('heroSelect');
        if (heroSelectContainer) {
            heroSelectContainer.style.opacity = '1';
            heroSelectContainer.style.pointerEvents = 'auto';
        }
        
        // Restore any other heroSelect state if needed
        if (heroSelectModule.showHeroSelect) {
            heroSelectModule.showHeroSelect();
        }
    });

    bottomSection.append(trainingBtn.btn, bogBtn.btn, backBtn.btn);

    // ───────────── LANGUAGE SWITCH LOGIC ─────────────
    function updateLanguage() {
        // Update button labels based on slider
        trainingBtn.setLanguage(englishSliderValue);
        bogBtn.setLanguage(englishSliderValue);
        backBtn.setLanguage(englishSliderValue);
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
        sliderStyle.remove();
    }
}

