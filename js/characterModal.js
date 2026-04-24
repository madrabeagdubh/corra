// characterModal.js -- typography + GameSettings integration

import { FONTS, COLORS, TYPE, SPACING, createDomButton } from './game/systems/gameTypography.js';
import { GameSettings } from './game/settings/gameSettings.js';

function ensureFontsLoaded(callback) {
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(callback);
    } else {
        setTimeout(callback, 100);
    }
}

const statDescriptions = {
    attack:  { irish: 'Troid',   english: 'Fight'   },
    defense: { irish: 'Cosain',  english: 'Defend'  },
    health:  { irish: 'Slainte', english: 'Health'  },
    speed:   { irish: 'Luas',    english: 'Speed'   },
   // magic:   { irish: 'Snas',    english: 'Polish'  },
    luck:    { irish: 'Adh',     english: 'Luck'    },
};

const statIconPaths = {
    attack:  'assets/icons/sword.png',
    defense: 'assets/icons/shield.png',
    health:  'assets/icons/heart.png',
    speed:   'assets/icons/wing.png',
  //  magic:   'assets/magic.png',
    luck:    'assets/icons/clover.png',
};

// Returns a pixelated <img> for a stat icon, with text fallback
function makeStatIcon(statName, size) {
    const img = document.createElement('img');
    img.src    = statIconPaths[statName] || '';
    img.width  = size;
    img.height = size;
    img.style.cssText = `
        width:${size}px;height:${size}px;
        object-fit:contain;
        image-rendering:pixelated;
        image-rendering:crisp-edges;
        display:block;
    `;
    img.onerror = () => {
        const span = document.createElement('span');
        span.textContent      = statName[0].toUpperCase();
        span.style.fontSize   = `${Math.round(size * 0.7)}px`;
        span.style.lineHeight = '1';
        span.style.color      = COLORS.speaker;
        img.replaceWith(span);
    };
    return img;
}

// -- Stat popup --
function createStatPopup(statName) {
    const existing = document.getElementById('statPopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'statPopup';
popup.dataset.stat = statName;  
popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
background: rgba(0, 0, 0, 0.96);        

border: 3px solid ${COLORS.speaker};
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

    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1rem;
    `;
    iconWrap.appendChild(makeStatIcon(statName, 48));

    const irishText = document.createElement('div');
    irishText.id = 'statPopupIrish';
    irishText.style.cssText = `
        font-family: ${FONTS.irish};
        font-size: ${TYPE.body.size};
        color: ${COLORS.irish};
        line-height: ${SPACING.irishLineHeight};
        margin-bottom: 0.8rem;
        text-align: center;
        min-height: 1.8rem;
    `;

    const englishText = document.createElement('div');
    englishText.id = 'statPopupEnglish';
    englishText.style.cssText = `
        font-family: ${FONTS.english};
        font-size: ${TYPE.bodyEn.size};
        color: ${COLORS.english};
        line-height: ${SPACING.englishLineHeight};
        text-align: center;
        opacity: 0;
        transition: opacity 0.8s ease;
    `;

    popup.appendChild(iconWrap);
    popup.appendChild(irishText);
    popup.appendChild(englishText);

    if (!document.getElementById('statPopupStyle')) {
        const style = document.createElement('style');
        style.id = 'statPopupStyle';
        style.textContent = `
            @keyframes popupFadeIn {
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                to   { opacity: 1; transform: translate(-50%, -50%) scale(1);   }
            }
            @keyframes popupFadeOut {
                from { opacity: 1; transform: translate(-50%, -50%) scale(1);   }
                to   { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
            }
            @keyframes letterGlow {
                0%   { opacity: 0; transform: scale(1.3); text-shadow: 0 0 15px rgba(255,200,100,1); }
                50%  { transform: scale(1.1); }
                100% { opacity: 1; transform: scale(1); text-shadow: 0 0 8px rgba(255,255,255,0.8); }
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

    const irishString   = statDescriptions[statName].irish;
    const englishString = statDescriptions[statName].english;
    let charIndex = 0;

    function typeNextChar() {
        if (charIndex < irishString.length) {
            const span = document.createElement('span');
            span.textContent = irishString[charIndex];
            span.style.cssText = 'display:inline;animation:letterGlow 0.4s ease;';
            irishText.appendChild(span);
            setTimeout(() => { span.style.textShadow = 'none'; }, 400);
            charIndex++;
            setTimeout(typeNextChar, 40);
        } else {
            setTimeout(() => {
                englishText.textContent = englishString;
                englishText.style.opacity = String(GameSettings.englishOpacity ?? 0.15);
                autoCloseTimer = setTimeout(closePopup, 4000);
            }, 600);
        }
    }

    typeNextChar();
}

// -- Main modal --
export async function showCharacterModal(champion) {
    ensureFontsLoaded(async () => {
        // -- Music --
        const heroSelect  = await import('./heroSelect.js');
        const musicPlayer = heroSelect.getMusicPlayer?.();

        if (musicPlayer?.tracks) {
            const pianoIndex = musicPlayer.tracks.findIndex(t => t?.name === 'Piano');
            if (pianoIndex >= 0 && !musicPlayer.tracks[pianoIndex].active) {
                await musicPlayer.toggleInstrument(pianoIndex);
            } else if (pianoIndex < 0 && musicPlayer.tracks.length > 1 && !musicPlayer.tracks[1].active) {
                await musicPlayer.toggleInstrument(1);
            }
        }

        // -- Styles (injected once) --
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
                    
background: #00060f !important;
    radial-gradient(ellipse 55% 45% at 75% 65%, rgba(15,35,90,0.22) 0%, transparent 60%),
                        #00060f !important;
                    overflow: hidden !important;
                    animation: modalRise 0.45s cubic-bezier(.22,.68,0,1.2) both;
                }
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
                .modal-bio-zone::-webkit-scrollbar-thumb {
                    background: rgba(212,175,55,0.3); border-radius: 2px;
                }
                .modal-stats-zone {
                    flex: 0 0 auto;
                    padding: 0.6rem 0 0;
                }
                .modal-rule {
                    height: 1px;
                    background: linear-gradient(to right,
                        transparent,
                        rgba(212,175,55,0.5) 20%,
                        rgba(212,175,55,0.5) 80%,
                        transparent);
                    margin: 1rem 0;
                }
                .modal-stat-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.45rem 0.85rem;
                    border: 1px solid rgba(212,175,55,0.35);
                    border-radius: 999px;
                    cursor: pointer;
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
                    font-family: ${FONTS.english};
                    font-size: 1rem;
                    color: rgba(255,255,255,0.75);
                }
                #closeModalBtn {
                    display: block !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                }
            `;
            document.head.appendChild(s);
        }

        // -- Remove stale modal --
        const existing = document.getElementById('characterModal');
        if (existing) existing.remove();

        const englishOpacity = GameSettings.englishOpacity ?? 0.15;

        // -- Modal shell --
        const modal = document.createElement('div');
        modal.id = 'characterModal';

        // -- Top bar --
        const topBar = document.createElement('header');
        topBar.style.cssText = `
            flex: 0 0 auto;
            padding: 1.4rem 6vw 0.6rem;
            text-align: center;
        `;

        const nameGa = document.createElement('h1');
        nameGa.textContent = champion.nameGa;
        nameGa.style.cssText = `
            font-family: ${FONTS.irish};
            font-size: clamp(2.4rem, 8vw, 3.8rem);
            color: ${COLORS.speaker};
            margin: 0 0 0.15em;
            letter-spacing: 0.04em;
            text-shadow: 0 0 28px rgba(212,175,55,0.35);
            line-height: 1.1;
        `;

        const nameEn = document.createElement('div');
        nameEn.textContent = champion.nameEn || '';
        nameEn.style.cssText = `
            font-family: ${FONTS.english};
            font-size: clamp(1rem, 3vw, 1.3rem);
            color: ${COLORS.druid};
            letter-spacing: 0.12em;
            text-transform: lowercase;
            margin-bottom: 0.6rem;
            opacity: ${englishOpacity};
            transition: opacity 0.3s ease;
        `;

        const rule1 = document.createElement('div');
        rule1.className = 'modal-rule';

        topBar.appendChild(nameGa);
        topBar.appendChild(nameEn);
        topBar.appendChild(rule1);
        modal.appendChild(topBar);

        // -- Body --
        const body = document.createElement('div');
        body.id = 'characterModalBody';

        const bioGaElement = document.createElement('p');
        bioGaElement.id = 'bioGaText';
        bioGaElement.style.cssText = `
            font-family: ${FONTS.irish};
            font-size: clamp(1.5rem, 5vw, 2rem);
            color: ${COLORS.irish};
            line-height: ${SPACING.irishLineHeight};
            margin: 0 0 0.8rem;
        `;

        const bioEnElement = document.createElement('p');
        bioEnElement.id = 'bioEnText';
        bioEnElement.style.cssText = `
            font-family: ${FONTS.english};
            font-size: clamp(1.2rem, 4vw, 1.6rem);
            color: ${COLORS.english};
            line-height: ${SPACING.englishLineHeight};
            margin: 0 0 1.2rem;
            opacity: 0;
            transition: opacity 0.8s ease;
        `;

        const rule2 = document.createElement('div');
        rule2.className = 'modal-rule';

        // -- Stats chips (icon image + value) --
        const statsContainer = document.createElement('div');
        statsContainer.id = 'statsContainer';
        statsContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 0.55rem;
            justify-content: center;
            padding: 0.8rem 0 0.4rem;
        `;

        const statsOrder = ['attack', 'defense', 'health', 'speed',  'luck'];
        statsOrder.forEach(stat => {
            const val = champion.stats[stat];
            if (val === undefined) return;
            const chip = document.createElement('button');
            chip.className = 'modal-stat-chip';
            chip.dataset.stat = stat;

            const iconEl = makeStatIcon(stat, 24);
            const valEl  = document.createElement('span');
            valEl.className   = 'chip-value';
            valEl.textContent = val;

            chip.appendChild(iconEl);
            chip.appendChild(valEl);
           
chip.addEventListener('click', (e) => {
    e.stopPropagation();
    const existing = document.getElementById('statPopup');
    if (existing && existing.dataset.stat === stat) { existing.click(); return; }
    createStatPopup(stat);
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

        // -- Bottom bar --
        const bottomBar = document.createElement('footer');
        bottomBar.style.cssText = `
            flex: 0 0 auto;
            padding: 12px 20px 20px;
            background: transparent;
        `;

        // Close button via createDomButton -- dark fill, gold border,
        // language switches with moon at 0.5 threshold.
        const closeBtnHandle = createDomButton({
            ga:      'Siar',
            en:      'Back',
            opacity: englishOpacity,
            onClick: async () => {
                if (musicPlayer?.tracks) {
                    const pianoIndex = musicPlayer.tracks.findIndex(t => t?.name === 'Piano');
                    if (pianoIndex >= 0 && musicPlayer.tracks[pianoIndex].active) {
                        await musicPlayer.toggleInstrument(pianoIndex);
                    } else if (pianoIndex < 0 && musicPlayer.tracks.length > 1 && musicPlayer.tracks[1].active) {
                        await musicPlayer.toggleInstrument(1);
                    }
                }
                window.removeEventListener('englishOpacityChange', onOpacityChange);
                modal.style.animation  = 'none';
                modal.style.transition = 'opacity 0.3s ease';
                modal.style.opacity    = '0';
                setTimeout(() => modal.remove(), 320);
            },
        });
        closeBtnHandle.el.id = 'closeModalBtn';
        bottomBar.appendChild(closeBtnHandle.el);
        modal.appendChild(bottomBar);

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // -- Live opacity updates from moon widget --
        const onOpacityChange = (e) => {
            const op = e.detail.opacity;
            nameEn.style.opacity       = String(op);
            bioEnElement.style.opacity = String(op);

            const popupEn = document.getElementById('statPopupEnglish');
            if (popupEn) popupEn.style.opacity = String(op);

            closeBtnHandle.applyLanguage(op);
        };
        window.addEventListener('englishOpacityChange', onOpacityChange);

        // -- Typewriter: Irish bio --
        const irishBio   = champion.charBioGa || '';
        const englishBio = champion.charBioEn || '';
        let charIndex = 0;

        function typeNextCharacter() {
            if (charIndex < irishBio.length) {
                const span = document.createElement('span');
                span.textContent = irishBio[charIndex];
                span.style.cssText = 'display:inline;animation:letterAppear 0.35s ease both;';
                bioGaElement.appendChild(span);
                charIndex++;
                setTimeout(typeNextCharacter, 38);
            } else {
                setTimeout(() => {
                    bioEnElement.textContent = englishBio;
                    bioEnElement.style.opacity = String(GameSettings.englishOpacity ?? englishOpacity);
                    nameEn.style.opacity       = String(GameSettings.englishOpacity ?? englishOpacity);
                }, 600);
            }
        }

        typeNextCharacter();
    });
}

