// Character Modal with music integration

function ensureFontsLoaded(callback) {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(callback);
  } else {
    setTimeout(callback, 100);
  }
}

const statDescriptions = {
    attack: { irish: "Troid", english: "Fight" },
    defense: { irish: "Cosain", english: "Defend" },
    health: { irish: "Sláinte", english: "Health" },
    speed: { irish: "Luas", english: "Speed" },
    magic: { irish: "Snas", english: "Polish" },
    luck: { irish: "Ádh", english: "luck" }
};

const statIcons = {
    attack: '⚔️',
    defense: '🛡️',
    health: '❤️',
    speed: '🪽',
    magic: '✨',
    luck: '☘️'
};

function createStatPopup(statName, englishOpacity) {
    console.log('Creating stat popup for:', statName);
    
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
        max-width: 100%;
        min-height: 180px;
        height: auto;
        z-index: 100000;
        box-shadow: 0 10px 40px rgba(0,0,0,0.8);
        animation: popupFadeIn 0.2s ease-out;
        cursor: pointer;
    `;

    const iconElement = document.createElement('div');
    iconElement.style.cssText = `
        font-size: 3rem;
        text-align: center;
        margin-bottom: 1rem;
    `;
    iconElement.textContent = statIcons[statName];

    const irishText = document.createElement('div');
    irishText.id = 'statPopupIrish';
    irishText.style.cssText = `
        font-size: 1.2rem;
        color: #ffffff;
        margin-bottom: 0.8rem;
        line-height: 1.5;
        font-family: Aonchlo;
        text-align: center;
        min-height: 1.8rem;
    `;

    const englishText = document.createElement('div');
    englishText.id = 'statPopupEnglish';
    englishText.style.cssText = `
        font-size: 1rem;
        color: rgba(0, 255, 0, ${englishOpacity});
        line-height: 1.5;
        font-family: CourierPrime;
        text-align: center;
        opacity: 0;
        transition: opacity 0.8s ease;
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
            @keyframes letterGlow {
                0% { opacity: 0; transform: scale(1.3); text-shadow: 0 0 15px rgba(255, 200, 100, 1); }
                50% { transform: scale(1.1); }
                100% { opacity: 1; transform: scale(1); text-shadow: 0 0 8px rgba(255, 255, 255, 0.8); }
            }
        `;
        document.head.appendChild(style);
    }

    let autoCloseTimer = null;

    const closePopup = () => {
        if (autoCloseTimer) clearTimeout(autoCloseTimer);
        popup.style.animation = 'popupFadeOut 0.2s ease-in';
        setTimeout(() => {
            if (popup.parentNode) popup.remove();
        }, 200);
    };

    popup.addEventListener('click', closePopup);
    document.body.appendChild(popup);

    const irishString = statDescriptions[statName].irish;
    const englishString = statDescriptions[statName].english;
    let charIndex = 0;
    const typeSpeed = 40;

    function typeNextChar() {
        if (charIndex < irishString.length) {
            const char = irishString[charIndex];
            const span = document.createElement('span');
            span.textContent = char;
            span.style.cssText = `display: inline; animation: letterGlow 0.4s ease;`;
            
            irishText.appendChild(span);
            setTimeout(() => { span.style.textShadow = 'none'; }, 400);

            charIndex++;
            setTimeout(typeNextChar, typeSpeed);
        } else {
            setTimeout(() => {
                englishText.textContent = englishString;
                
                const slider = document.querySelector('.champion-slider');
                const currentOpacity = slider ? parseFloat(slider.value) : englishOpacity;
                englishText.style.opacity = currentOpacity;

                if (slider) {
                    const updateOpacity = () => {
                        englishText.style.opacity = slider.value;
                    };
                    slider.addEventListener('input', updateOpacity);
                    
                    popup.addEventListener('remove', () => {
                        slider.removeEventListener('input', updateOpacity);
                    });
                }

                autoCloseTimer = setTimeout(closePopup, 4000);
            }, 600);
        }
    }

    typeNextChar();
}

export async function showCharacterModal(champion) {
       ensureFontsLoaded(async () => {
        // Import heroSelect to access music controls
        const heroSelect = await import('./heroSelect.js');
        const musicPlayer = heroSelect.getMusicPlayer?.();
        
        // Unmute piano when modal opens
        if (musicPlayer && musicPlayer.tracks) {
            console.log('[CharacterModal] Unmuting piano');
            // Find piano track (usually index 1) and unmute it
            const pianoIndex = musicPlayer.tracks.findIndex(t => t && t.name === 'Piano');
            if (pianoIndex >= 0 && !musicPlayer.tracks[pianoIndex].active) {
                await musicPlayer.toggleInstrument(pianoIndex);
            } else if (pianoIndex < 0 && musicPlayer.tracks.length > 1 && !musicPlayer.tracks[1].active) {
                // No piano, just toggle second instrument
                await musicPlayer.toggleInstrument(1);
            }
        }
        
        let modal = document.getElementById('characterModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'characterModal';

            modal.style.cssText = `
                position: fixed !important;
                top: 40px !important;
                left: 0 !important;
                width: 100vw !important;
                height: calc(100vh - 160px) !important;
                background-color: rgba(0, 0, 0, 0.5) !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: flex-start !important;
                align-items: center !important;
                z-index: 99999 !important;
                overflow: hidden !important;
                pointer-events: auto !important;
            `;

            const content = document.createElement('div');
            content.id = 'characterModalContent';
            content.style.cssText = `
                background-color: rgba(0, 0, 0, 0.3) !important;
                color: white !important;
                padding: 20px !important;
                border-radius: 12px !important;
                border: 3px solid #d4af37 !important;
                width: 90% !important;
                max-width: 800px !important;
                height: 90% !important;
                overflow-y: auto !important;
                position: relative !important;
                font-family: Aonchlo !important;
                pointer-events: auto !important;
                display: flex !important;
                flex-direction: column !important;
                z-index: 1 !important;
            `;

            modal.appendChild(content);
            document.body.appendChild(modal);
        }

        const content = document.getElementById('characterModalContent');
        const slider = document.querySelector('.champion-slider');
        const englishOpacity = slider ? slider.value : 0.15;

        const statsOrder = ['attack', 'defense', 'health', 'speed', 'magic', 'luck'];
        const statsHTML = statsOrder.map(stat => {
            const value = champion.stats[stat];
            return `<span class="modal-stat-item" data-stat="${stat}" style="
                margin-right: 15px; 
                font-size: 1.1em; 
                cursor: pointer;
                transition: transform 0.1s ease;
                display: inline-block;
            ">${statIcons[stat]} ${value}</span>`;
        }).join('');

        const existingName = document.getElementById('modalChampionName');
        if (existingName) existingName.remove();

        const nameHeader = document.createElement('h2');
        nameHeader.id = 'modalChampionName';
        nameHeader.textContent = champion.nameGa;
        nameHeader.style.cssText = `
            color: white !important;
            text-align: center !important;
            font-size: 28px !important;
            margin: 0 0 10px 0 !important;
            font-family: Aonchlo !important;
            pointer-events: none !important;
            z-index: 2 !important;
            position: relative !important;
        `;
        modal.insertBefore(nameHeader, content);

        content.innerHTML = `
            <div style="flex: 0 0 auto;">
                <p id="bioGaText" style="color: white; font-family:Aonchlo !important; font-size: 20px; line-height: 1.6; min-height: 3em; margin-top: 0;"></p>
                <p id="bioEnText" class="modal-bio-en" style="color: #00ff00; font-size: 20px; line-height: 1.6; opacity: 0; font-family: Anaphora !important; transition: opacity 0.8s ease;"></p>
            </div>
            <div style="flex: 1 1 auto;"></div>
            <div style="flex: 0 0 auto;">
                <div id="statsContainer" style="margin: 15px 0; padding: 10px; background-color: rgba(0,0,0,0.3); border-radius: 8px; text-align: center;">
                    ${statsHTML}
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button id="closeModalBtn" style="
                        padding: 10px 30px;
                        font-size: 16px;
                        background-color: #4a3020;
                        color: white;
                        border: 2px solid #888;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: bold;
                        font-family: Aonchlo;
                    ">Siar</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        document.querySelectorAll('.modal-stat-item').forEach(statItem => {
            statItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const statName = statItem.dataset.stat;
                console.log('Modal stat clicked:', statName);
                createStatPopup(statName, englishOpacity);
            });

            statItem.addEventListener('mouseenter', () => {
                statItem.style.transform = 'scale(1.1)';
            });
            statItem.addEventListener('mouseleave', () => {
                statItem.style.transform = 'scale(1)';
            });
        });

        const bioGaElement = document.getElementById('bioGaText');
        const bioEnElement = document.getElementById('bioEnText');
        const irishText = champion.charBioGa;
        const englishText = champion.charBioEn;

        let charIndex = 0;
        const typewriterSpeed = 40;

        function typeNextCharacter() {
            if (charIndex < irishText.length) {
                const char = irishText[charIndex];
                const span = document.createElement('span');
                span.textContent = char;
                span.style.cssText = `
                    display: inline;
                    animation: letterAppear 0.4s ease;
                    text-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
                `;

                bioGaElement.appendChild(span);
                setTimeout(() => { span.style.textShadow = 'none'; }, 400);

                charIndex++;
                setTimeout(typeNextCharacter, typewriterSpeed);
            } else {
                setTimeout(() => {
                    bioEnElement.textContent = englishText;
                    bioEnElement.style.opacity = englishOpacity;

                    if (slider) {
                        slider.addEventListener('input', () => {
                            bioEnElement.style.opacity = slider.value;
                        });
                    }
                }, 600);
            }
        }

        if (!document.getElementById('typewriterStyles')) {
            const style = document.createElement('style');
            style.id = 'typewriterStyles';
            style.textContent = `
                @keyframes letterAppear {
                    0% { opacity: 0; transform: scale(1.3); text-shadow: 0 0 15px rgba(255, 200, 100, 1); }
                    50% { transform: scale(1.1); }
                    100% { opacity: 1; transform: scale(1); text-shadow: 0 0 8px rgba(255, 255, 255, 0.8); }
                }
            `;
            document.head.appendChild(style);
        }

        typeNextCharacter();

        const closeBtn = document.getElementById('closeModalBtn');
        closeBtn.addEventListener('click', async () => {
            // Mute piano when closing
            if (musicPlayer && musicPlayer.tracks) {
                console.log('[CharacterModal] Muting piano');
                const pianoIndex = musicPlayer.tracks.findIndex(t => t && t.name === 'Piano');
                if (pianoIndex >= 0 && musicPlayer.tracks[pianoIndex].active) {
                    await musicPlayer.toggleInstrument(pianoIndex);
                } else if (pianoIndex < 0 && musicPlayer.tracks.length > 1 && musicPlayer.tracks[1].active) {
                    // No piano, just toggle second instrument
                    await musicPlayer.toggleInstrument(1);
                }
            }
            modal.remove();
        });

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.backgroundColor = '#6a4030';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.backgroundColor = '#4a3020';
        });
    });
}

