// characterModal.js -- typography + GameSettings integration

import { FONTS, COLORS, TYPE, SPACING, createDomButton } from './game/systems/gameTypography.js';
import { GameSettings } from './game/settings/gameSettings.js';
import { VoiceSynth, championVoice, championTuneKey } from './game/systems/voice/voiceSynth.js';
import { allTunes } from './game/systems/music/allTunes.js';

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
    luck:    { irish: 'Adh',     english: 'Luck'    },
};

const statIconPaths = {
    attack:  'assets/icons/sword.png',
    defense: 'assets/icons/shield.png',
    health:  'assets/icons/heart.png',
    speed:   'assets/icons/wing.png',
    luck:    'assets/icons/clover.png',
};

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

function createStatPopup(statName) {
    const existing = document.getElementById('statPopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'statPopup';
    popup.dataset.stat = statName;
    popup.style.cssText = `
        position:fixed;top:50%;left:50%;
        transform:translate(-50%,-50%);
        background:rgba(0,0,0,0.96);
        border:3px solid ${COLORS.speaker};
        border-radius:15px;padding:1.5rem;
        width:100%;max-width:100%;min-height:180px;height:auto;
        z-index:100020;box-shadow:0 10px 40px rgba(0,0,0,0.8);
        animation:popupFadeIn 0.2s ease-out;cursor:pointer;
    `;

    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = `display:flex;align-items:center;justify-content:center;margin-bottom:1rem;`;
    iconWrap.appendChild(makeStatIcon(statName, 48));

    const irishText = document.createElement('div');
    irishText.id = 'statPopupIrish';
    irishText.style.cssText = `
        font-family:${FONTS.irish};font-size:${TYPE.body.size};
        color:${COLORS.irish};line-height:${SPACING.irishLineHeight};
        margin-bottom:0.8rem;text-align:center;min-height:1.8rem;
    `;

    const englishText = document.createElement('div');
    englishText.id = 'statPopupEnglish';
    englishText.style.cssText = `
        font-family:${FONTS.english};font-size:${TYPE.bodyEn.size};
        color:${COLORS.english};line-height:${SPACING.englishLineHeight};
        text-align:center;opacity:0;transition:opacity 0.8s ease;
    `;

    popup.appendChild(iconWrap);
    popup.appendChild(irishText);
    popup.appendChild(englishText);

    if (!document.getElementById('statPopupStyle')) {
        const style = document.createElement('style');
        style.id = 'statPopupStyle';
        style.textContent = `
            @keyframes popupFadeIn {
                from { opacity:0; transform:translate(-50%,-50%) scale(0.9); }
                to   { opacity:1; transform:translate(-50%,-50%) scale(1);   }
            }
            @keyframes popupFadeOut {
                from { opacity:1; transform:translate(-50%,-50%) scale(1);   }
                to   { opacity:0; transform:translate(-50%,-50%) scale(0.9); }
            }
            @keyframes letterGlow {
                0%   { opacity:0; transform:scale(1.3); text-shadow:0 0 15px rgba(255,200,100,1); }
                50%  { transform:scale(1.1); }
                100% { opacity:1; transform:scale(1); text-shadow:0 0 8px rgba(255,255,255,0.8); }
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
        const heroSelect  = await import('./heroSelect.js');
        const musicPlayer = heroSelect.getMusicPlayer?.();
        const moon        = heroSelect.getMoonWidget?.();

        // Unmute piano while modal is open
        if (musicPlayer?.tracks) {
            const pianoIndex = musicPlayer.tracks.findIndex(t => t?.name === 'Piano');
            if (pianoIndex >= 0 && !musicPlayer.tracks[pianoIndex].active) {
                await musicPlayer.toggleInstrument(pianoIndex);
            } else if (pianoIndex < 0 && musicPlayer.tracks.length > 1 && !musicPlayer.tracks[1].active) {
                await musicPlayer.toggleInstrument(1);
            }
        }

        if (!document.getElementById('characterModalStyles')) {
            const s = document.createElement('style');
            s.id = 'characterModalStyles';
            s.textContent = `
                @keyframes letterAppear {
                    0%   { opacity:0; filter:blur(4px) brightness(2); }
                    100% { opacity:1; filter:blur(0)   brightness(1); }
                }
                @keyframes modalRise {
                    from { opacity:0; transform:translateY(24px); }
                    to   { opacity:1; transform:translateY(0); }
                }

                /* ── Modal shell ── */
                #characterModal {
                    position:fixed !important;
                    top:0 !important;
                    left:0 !important;right:0 !important;bottom:0 !important;
                    width:100vw !important;height:100vh !important;
                    z-index:100010 !important;
                    display:flex !important;
                    flex-direction:column !important;
                    align-items:stretch !important;
                    pointer-events:auto !important;
                    background:#00060f !important;
                    overflow:hidden !important;
                    animation:modalRise 0.45s cubic-bezier(.22,.68,0,1.2) both;
                    box-sizing:border-box !important;
                }

                /* ── Scrollable bio zone ── */
                #charModalBioZone {
                    flex:1 1 0;
                    min-height:0;
                    overflow-y:auto;
                    overflow-x:hidden;
                    padding:0 6vw 1rem;
                    scrollbar-width:thin;
                    scrollbar-color:rgba(212,175,55,0.3) transparent;
                    box-sizing:border-box;
                }
                #charModalBioZone::-webkit-scrollbar { width:3px; }
                #charModalBioZone::-webkit-scrollbar-thumb {
                    background:rgba(212,175,55,0.3);border-radius:2px;
                }

                /* ── Stats bar ── */
                #charModalStatsBar {
                    flex:0 0 auto;
                    display:flex;
                    flex-wrap:nowrap;
                    justify-content:center;
                    align-items:center;
                    gap:0.5rem;
                    padding:0.75rem 6vw;
                    border-top:1px solid rgba(212,175,55,0.18);
                    background:rgba(0,6,15,0.6);
                }

                /* ── Moon spacer footer ── */
                #charModalMoonSpacer {
                    flex:0 0 auto;
                }

                /* ── Divider rule ── */
                .modal-rule {
                    height:1px;
                    background:linear-gradient(to right,
                        transparent,rgba(212,175,55,0.5) 20%,
                        rgba(212,175,55,0.5) 80%,transparent);
                    margin:0.8rem 0;
                }

                /* ── Stat chips ── */
                .modal-stat-chip {
                    display:inline-flex;align-items:center;gap:0.4rem;
                    padding:0.4rem 0.75rem;
                    border:1px solid rgba(212,175,55,0.35);border-radius:999px;
                    cursor:pointer;background:rgba(212,175,55,0.07);
                    transition:background 0.18s ease,border-color 0.18s ease,transform 0.12s ease;
                    user-select:none;-webkit-user-select:none;
                    white-space:nowrap;
                }
                .modal-stat-chip:hover,.modal-stat-chip:active {
                    background:rgba(212,175,55,0.18);
                    border-color:rgba(212,175,55,0.7);
                    transform:scale(1.06);
                }
                .modal-stat-chip .chip-value {
                    font-family:${FONTS.english};
                    font-size:1rem;
                    color:rgba(255,255,255,0.75);
                }
            `;
            document.head.appendChild(s);
        }

        const existing = document.getElementById('characterModal');
        if (existing) existing.remove();

        const englishOpacity = GameSettings.englishOpacity ?? 0.15;

        // Calculate moon clearance
        const minDim   = Math.min(window.innerWidth, window.innerHeight);
        const moonR    = Math.max(24, Math.round(minDim * 0.055));
        const moonD    = moonR * 2;
        const pad      = 18;
        const wrapperH = moonD + pad * 2;
        const moonSpacerH = Math.round(102 + wrapperH / 2) + 8;

        const modal = document.createElement('div');
        modal.id = 'characterModal';

        // ── 1. Top bar ─────────────────────────────────────────────────────
        const topBar = document.createElement('header');
        topBar.style.cssText = `
            flex:0 0 auto;
            padding:max(44px, env(safe-area-inset-top, 44px)) 6vw 0.6rem;
            text-align:center;
        `;

        const nameGa = document.createElement('h1');
        nameGa.textContent = champion.nameGa;
        nameGa.style.cssText = `
            font-family:${FONTS.irish};
            font-size:clamp(2.2rem,7vw,3.4rem);
            color:${COLORS.speaker};margin:0 0 0.15em;
            letter-spacing:0.04em;
            text-shadow:0 0 28px rgba(212,175,55,0.35);line-height:1.1;
        `;

        const nameEn = document.createElement('div');
        nameEn.textContent = champion.nameEn || '';
        nameEn.style.cssText = `
            font-family:${FONTS.english};
            font-size:clamp(0.9rem,2.8vw,1.2rem);
            color:${COLORS.druid};letter-spacing:0.12em;
            text-transform:lowercase;margin-bottom:0.5rem;
            opacity:${englishOpacity};transition:opacity 0.3s ease;
        `;

        const rule1 = document.createElement('div');
        rule1.className = 'modal-rule';

        topBar.appendChild(nameGa);
        topBar.appendChild(nameEn);
        topBar.appendChild(rule1);
        modal.appendChild(topBar);

        // ── 2. Bio zone ────────────────────────────────────────────────────
        const bioZone = document.createElement('div');
        bioZone.id = 'charModalBioZone';

        const bioGaElement = document.createElement('p');
        bioGaElement.id = 'bioGaText';
        bioGaElement.style.cssText = `
            font-family:${FONTS.irish};
            font-size:clamp(1.4rem,4.5vw,1.9rem);
            color:${COLORS.irish};line-height:${SPACING.irishLineHeight};
            margin:0 0 0.8rem;
        `;

        const bioEnElement = document.createElement('p');
        bioEnElement.id = 'bioEnText';
        bioEnElement.style.cssText = `
            font-family:${FONTS.english};
            font-size:${TYPE.bodyEn.size};
            color:${COLORS.english};line-height:${SPACING.englishLineHeight};
            margin:0;opacity:0;transition:opacity 0.8s ease;
        `;

        bioZone.appendChild(bioGaElement);
        bioZone.appendChild(bioEnElement);
        modal.appendChild(bioZone);

        // ── 3. Stats bar ───────────────────────────────────────────────────
        const statsBar = document.createElement('div');
        statsBar.id = 'charModalStatsBar';

        const statsOrder = ['attack', 'defense', 'health', 'speed', 'luck'];
        statsOrder.forEach(stat => {
            const val = champion.stats?.[stat];
            if (val === undefined) return;

            const chip = document.createElement('button');
            chip.className = 'modal-stat-chip';
            chip.dataset.stat = stat;

            const iconEl = makeStatIcon(stat, 22);
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

            statsBar.appendChild(chip);
        });

        modal.appendChild(statsBar);

        // ── 4. Moon spacer footer ──────────────────────────────────────────
        const footer = document.createElement('footer');
        footer.id = 'charModalMoonSpacer';
        footer.style.height = `${moonSpacerH}px`;
        modal.appendChild(footer);

        document.body.appendChild(modal);

        // ── Voice synthesis + music ducking ────────────────────────────────
        //
        // On modal open:  music ducks to 12%, voice speaks bio after 800ms
        // On voice end:   music unducks
        // On modal close: voice stops, music fully restored
        //
        // All audio shares heroSelect's existing AudioContext.

        const mp       = heroSelect.getMusicPlayer?.();
        const audioCtx = mp?.audioContext ?? null;

        // ── Duck the music ─────────────────────────────────────────────────
        const _preDuckGains = []
        if (mp?.tracks && audioCtx) {
            const t0 = audioCtx.currentTime
            mp.tracks.forEach((tr, i) => {
                if (!tr?.gain) return
                const current = tr.gain.gain.value
                _preDuckGains[i] = current
                tr.gain.gain.setValueAtTime(current, t0)
                tr.gain.gain.linearRampToValueAtTime(current * 0.12, t0 + 1.2)
            })
        }

        const _unduckMusic = () => {
            if (!mp?.tracks || !audioCtx) return
            const t0 = audioCtx.currentTime
            mp.tracks.forEach((tr, i) => {
                if (!tr?.gain) return
                const target = _preDuckGains[i] ?? 0.5
                tr.gain.gain.setValueAtTime(tr.gain.gain.value, t0)
                tr.gain.gain.linearRampToValueAtTime(target, t0 + 1.8)
            })
        }

        // ── Voice ──────────────────────────────────────────────────────────
        let voiceSynth = null;
        try {
            const voice   = championVoice(champion);
            const tuneKey = championTuneKey(champion, allTunes);
            voiceSynth = new VoiceSynth({
                audioContext: audioCtx ?? undefined,
                volume: 0.78,
            });
            console.log(`[characterModal] voice=${voice} tuneKey=${tuneKey} champion=${champion.nameEn}`);

            const irishBio = champion.charBioGa || '';
            if (irishBio) {
                setTimeout(() => {
                    if (!voiceSynth) return
                    voiceSynth.speak(irishBio, {
                        voice,
                        tuneKey,
                        onDone: () => { _unduckMusic() },
                    });
                }, 800);
            }
        } catch(e) {
            console.warn('[characterModal] VoiceSynth failed:', e);
            voiceSynth = null;
        }

        // ── Close logic ────────────────────────────────────────────────────
        const closeModal = async () => {
            // Stop voice
            if (voiceSynth) {
                try { voiceSynth.fadeOut(400) } catch(e) {}
                setTimeout(() => {
                    try { voiceSynth.destroy() } catch(e) {}
                    voiceSynth = null
                }, 500)
            }

            // Restore music to pre-duck volume
            _unduckMusic()

            if (musicPlayer?.tracks) {
                const pianoIndex = musicPlayer.tracks.findIndex(t => t?.name === 'Piano');
                if (pianoIndex >= 0 && musicPlayer.tracks[pianoIndex].active) {
                    await musicPlayer.toggleInstrument(pianoIndex);
                } else if (pianoIndex < 0 && musicPlayer.tracks.length > 1 && musicPlayer.tracks[1].active) {
                    await musicPlayer.toggleInstrument(1);
                }
            }

            window.removeEventListener('englishOpacityChange', onOpacityChange);
            heroSelect.restoreHeroSelectTap?.();

            modal.style.animation  = 'none';
            modal.style.transition = 'opacity 0.3s ease';
            modal.style.opacity    = '0';
            setTimeout(() => modal.remove(), 320);
        };

        // Override moon tap to close this modal
        if (moon) {
            moon.setTapHandler(() => {
                const popup = document.getElementById('statPopup');
                if (popup) { popup.click(); return; }
                closeModal();
            });
        }

        // ── Live opacity updates ───────────────────────────────────────────
        const onOpacityChange = (e) => {
            const op = e.detail.opacity;
            nameEn.style.opacity       = String(op);
            bioEnElement.style.opacity = String(op);
            const popupEn = document.getElementById('statPopupEnglish');
            if (popupEn) popupEn.style.opacity = String(op);
        };
        window.addEventListener('englishOpacityChange', onOpacityChange);

        // ── Typewriter: Irish bio ──────────────────────────────────────────
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
                    bioEnElement.textContent   = englishBio;
                    bioEnElement.style.opacity = String(GameSettings.englishOpacity ?? englishOpacity);
                    nameEn.style.opacity       = String(GameSettings.englishOpacity ?? englishOpacity);
                }, 600);
            }
        }

        typeNextCharacter();
    });
}

