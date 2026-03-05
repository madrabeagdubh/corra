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
        z-index: 100020;
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
        font-family: Urchlo, serif;
        text-align: center;
        min-height: 1.8rem;
    `;

    const englishText = document.createElement('div');
    englishText.id = 'statPopupEnglish';
    englishText.style.cssText = `
        font-size: 1rem;
        color: rgba(0, 255, 0, ${englishOpacity});
        line-height: 1.5;
        font-family: "Courier New", monospace;
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
        
        // ── Inject modal styles once ─────────────────────────────────────────
        if (!document.getElementById('characterModalStyles')) {
            const s = document.createElement('style');
            s.id = 'characterModalStyles';
            s.textContent = `
                @keyframes letterAppear {
                    0%   { opacity: 0; filter: blur(4px) brightness(2); }
                    100% { opacity: 1; filter: blur(0)   brightness(1); }
                }
                @keyframes modalRise {
                    from { opacity: 0; transform: translateY(24px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes popupFadeIn {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
                    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
                @keyframes popupFadeOut {
                    from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    to   { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
                }
                @keyframes letterGlow {
                    0%   { opacity: 0; transform: scale(1.3); text-shadow: 0 0 15px rgba(255,200,100,1); }
                    50%  { transform: scale(1.1); }
                    100% { opacity: 1; transform: scale(1); text-shadow: 0 0 8px rgba(255,255,255,0.8); }
                }
                #characterModal {
                    position: fixed !important;
                    top: 90px !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    width: 100vw !important;
                    height: calc(100vh - 90px) !important;
                    z-index: 100010 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: stretch !important;
                    pointer-events: auto !important;
                    background:
                        radial-gradient(ellipse 70% 50% at 25% 35%, rgba(55,25,110,0.28) 0%, transparent 65%),
                        radial-gradient(ellipse 55% 45% at 75% 65%, rgba(15,35,90,0.22) 0%, transparent 60%),
                        #00060f !important;
                    overflow: hidden !important;
                    animation: modalRise 0.45s cubic-bezier(.22,.68,0,1.2) both;
                }
                /* Body layout: bio zone scrolls, stats+button stay fixed at bottom */
                #characterModalBody {
                    flex: 1 1 auto;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    padding: 0 6vw;
                }
                .modal-bio-zone {
                    flex: 1 1 auto;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding-bottom: 0.5rem;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(212,175,55,0.3) transparent;
                }
                .modal-bio-zone::-webkit-scrollbar { width: 3px; }
                .modal-bio-zone::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 2px; }
                .modal-stats-zone {
                    flex: 0 0 auto;
                    padding: 0.6rem 0 0;
                }

                /* Gold ruled divider */
                .modal-rule {
                    height: 1px;
                    background: linear-gradient(to right, transparent, rgba(212,175,55,0.5) 20%, rgba(212,175,55,0.5) 80%, transparent);
                    margin: 1rem 0;
                }

                /* Stat chips */
                .modal-stat-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.45rem 0.85rem;
                    border: 1px solid rgba(212,175,55,0.35);
                    border-radius: 999px;
                    cursor: pointer;
                    font-size: 1rem;
                    font-family: Urchlo, serif;
                    color: #d4af37;
                    background: rgba(212,175,55,0.07);
                    transition: background 0.18s ease, border-color 0.18s ease, transform 0.12s ease;
                    user-select: none;
                    -webkit-user-select: none;
                }
                .modal-stat-chip:hover, .modal-stat-chip:active {
                    background: rgba(212,175,55,0.18);
                    border-color: rgba(212,175,55,0.7);
                    transform: scale(1.06);
                }
                .modal-stat-chip .chip-value {
                    font-family: "Courier New", monospace;
                    font-size: 0.85rem;
                    color: rgba(255,255,255,0.75);
                }

                /* Close / back button — mirror of Ar Aghaidh */
                #closeModalBtn {
                    display: block !important;
                    width: 100% !important;
                    padding: 1.2rem !important;
                    font-size: 1.3rem !important;
                    font-family: Urchlo, serif !important;
                    letter-spacing: 2px !important;
                    text-transform: uppercase !important;
                    color: #1a1a1a !important;
                    background: linear-gradient(145deg, #8b4513, #d2691e, #8b4513) !important;
                    border: 3px solid #d2691e !important;
                    border-radius: 12px !important;
                    cursor: pointer !important;
                    transition: filter 0.18s ease, transform 0.1s ease !important;
                }
                #closeModalBtn:hover  { filter: brightness(1.15) !important; }
                #closeModalBtn:active { transform: scale(0.98) !important; }
            `;
            document.head.appendChild(s);
        }

        // ── Remove stale modal ───────────────────────────────────────────────
        const existing = document.getElementById('characterModal');
        if (existing) existing.remove();

        const slider = document.querySelector('.champion-slider');
        const englishOpacity = slider ? parseFloat(slider.value) : 0.15;

        // ── Build modal shell ────────────────────────────────────────────────
        const modal = document.createElement('div');
        modal.id = 'characterModal';

        // ── Top bar: name + thin gold rule ──────────────────────────────────
        const topBar = document.createElement('header');
        topBar.style.cssText = `
            flex: 0 0 auto;
            padding: 1.4rem 6vw 0.6rem;
            text-align: center;
        `;

        const nameGa = document.createElement('h1');
        nameGa.textContent = champion.nameGa;
        nameGa.style.cssText = `
            font-family: Urchlo,  serif;
            font-size: clamp(2rem, 7vw, 3.2rem);
            color: #d4af37;
            margin: 0 0 0.15em;
            letter-spacing: 0.04em;
            text-shadow: 0 0 28px rgba(212,175,55,0.35);
            line-height: 1.1;
        `;

        const nameEn = document.createElement('div');
        nameEn.textContent = champion.nameEn || '';
        nameEn.style.cssText = `
            font-family: "Courier New", monospace;
            font-size: clamp(0.8rem, 2.5vw, 1rem);
            color: rgba(155,141,189,${englishOpacity});
            letter-spacing: 0.12em;
            text-transform: lowercase;
            margin-bottom: 0.6rem;
            transition: color 0.3s ease;
        `;

        const rule1 = document.createElement('div');
        rule1.className = 'modal-rule';

        topBar.appendChild(nameGa);
        topBar.appendChild(nameEn);
        topBar.appendChild(rule1);
        modal.appendChild(topBar);

        // ── Scrollable body ──────────────────────────────────────────────────
        const body = document.createElement('div');
        body.id = 'characterModalBody';

        // Bio — Irish
        const bioGaElement = document.createElement('p');
        bioGaElement.id = 'bioGaText';
        bioGaElement.style.cssText = `
            font-family: Urchlo, serif;
            font-size: clamp(1.15rem, 4vw, 1.45rem);
            color: #e8dcc8;
            line-height: 1.75;
            margin: 0 0 0.8rem;
        `;

        // Bio — English
        const bioEnElement = document.createElement('p');
        bioEnElement.id = 'bioEnText';
        bioEnElement.style.cssText = `
            font-family: "Courier New", monospace;
            font-size: clamp(1rem, 3.2vw, 1.15rem);
            color: rgba(0,255,0,${englishOpacity});
            line-height: 1.7;
            margin: 0 0 1.2rem;
            opacity: 0;
            transition: opacity 0.8s ease;
        `;

        const rule2 = document.createElement('div');
        rule2.className = 'modal-rule';

        // Stats row
        const statsContainer = document.createElement('div');
        statsContainer.id = 'statsContainer';
        statsContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 0.55rem;
            justify-content: center;
            padding: 0.8rem 0 0.4rem;
        `;

        const statsOrder = ['attack', 'defense', 'health', 'speed', 'magic', 'luck'];
        statsOrder.forEach(stat => {
            const val = champion.stats[stat];
            if (val === undefined) return;
            const chip = document.createElement('button');
            chip.className = 'modal-stat-chip';
            chip.dataset.stat = stat;
            chip.innerHTML = `<span>${statIcons[stat]}</span><span class="chip-value">${val}</span>`;
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                createStatPopup(stat, englishOpacity);
            });
            statsContainer.appendChild(chip);
        });

        const bioZone = document.createElement('div');
        bioZone.className = 'modal-bio-zone';
        bioZone.appendChild(bioGaElement);
        bioZone.appendChild(bioEnElement);

        const statsZone = document.createElement('div');
        statsZone.className = 'modal-stats-zone';
        statsZone.appendChild(rule2);
        statsZone.appendChild(statsContainer);

        body.appendChild(bioZone);
        body.appendChild(statsZone);
        modal.appendChild(body);

        // ── Fixed bottom bar: back button — same footprint as Ar Aghaidh ────
        const bottomBar = document.createElement('footer');
        bottomBar.style.cssText = `
            flex: 0 0 auto;
            padding: 12px 20px 20px;
            background: transparent;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.id = 'closeModalBtn';
        closeBtn.textContent = 'Siar';
        bottomBar.appendChild(closeBtn);
        modal.appendChild(bottomBar);

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // ── Typewriter: Irish bio ────────────────────────────────────────────
        const irishText = champion.charBioGa || '';
        const englishText = champion.charBioEn || '';
        let charIndex = 0;
        const typewriterSpeed = 38;

        function typeNextCharacter() {
            if (charIndex < irishText.length) {
                const span = document.createElement('span');
                span.textContent = irishText[charIndex];
                span.style.cssText = 'display:inline;animation:letterAppear 0.35s ease both;';
                bioGaElement.appendChild(span);
                charIndex++;
                setTimeout(typeNextCharacter, typewriterSpeed);
            } else {
                setTimeout(() => {
                    bioEnElement.textContent = englishText;
                    bioEnElement.style.opacity = englishOpacity;
                    if (slider) {
                        slider.addEventListener('input', () => {
                            bioEnElement.style.opacity = slider.value;
                            nameEn.style.color = `rgba(155,141,189,${slider.value})`;
                        });
                    }
                }, 600);
            }
        }

        typeNextCharacter();

        // ── Close / back ─────────────────────────────────────────────────────
        closeBtn.addEventListener('click', async () => {
            if (musicPlayer && musicPlayer.tracks) {
                console.log('[CharacterModal] Muting piano');
                const pianoIndex = musicPlayer.tracks.findIndex(t => t && t.name === 'Piano');
                if (pianoIndex >= 0 && musicPlayer.tracks[pianoIndex].active) {
                    await musicPlayer.toggleInstrument(pianoIndex);
                } else if (pianoIndex < 0 && musicPlayer.tracks.length > 1 && musicPlayer.tracks[1].active) {
                    await musicPlayer.toggleInstrument(1);
                }
            }
            modal.style.animation = 'none';
            modal.style.transition = 'opacity 0.3s ease';
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 320);
        });
    });
}

