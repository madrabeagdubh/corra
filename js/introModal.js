import { allTunes } from './game/systems/music/allTunes.js';
import * as abcjs from 'abcjs';
import { champions } from '../data/champions.js';

console.log('[IntroModal] MODULE LOADED - introModal.js is executing');

var initialized = false;
var audioContextUnlocked = false;
var fullscreenRequested = false;

console.log('[IntroModal] Preloading music data... tunes available:', Object.keys(allTunes).length);
console.log('[IntroModal] ABC.js library loaded');

function warmupMusicSystem() {
    setTimeout(function() {
        try {
            console.log('[IntroModal] Warming up music system...');
            
            var AudioContext = window.AudioContext || window.webkitAudioContext;
            var tempContext = new AudioContext();
            
            var simpleTune = 'X:1\nT:Test\nM:4/4\nL:1/8\nK:C\nCDEF GABc|';
            
            var parsed = abcjs.parseOnly(simpleTune);
            console.log('[IntroModal] ABC parsing warmed up');
            
            setTimeout(function() {
                tempContext.close();
            }, 100);
            
            console.log('[IntroModal] Music system ready');
        } catch (e) {
            console.warn('[IntroModal] Music warmup failed (non-critical):', e);
        }
    }, 0);
}

warmupMusicSystem();

var preloadedAssets = {
    spriteSheet: null,
    atlasData: null,
    validChampions: null,
    firstChampionCanvas: null,
    randomStartIndex: null
};

function preloadHeroSelectAssets() {
    console.log('[IntroModal] Preloading hero select assets...');
    
    var img = new Image();
    img.src = 'assets/champions/champions-with-kit.png';
    
    return new Promise(function(resolve, reject) {
        img.onload = function() {
            preloadedAssets.spriteSheet = img;
            console.log('[IntroModal] Sprite sheet preloaded');
            
            fetch('assets/champions/champions0.json')
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    preloadedAssets.atlasData = data;
                    console.log('[IntroModal] Atlas data preloaded');
                    
                    preloadedAssets.validChampions = champions.filter(function(c) {
                        return c && c.spriteKey && c.stats;
                    });
                    console.log('[IntroModal] Parsed', preloadedAssets.validChampions.length, 'valid champions');
                    
                    var randomIndex = Math.floor(Math.random() * preloadedAssets.validChampions.length);
                    preloadedAssets.randomStartIndex = randomIndex;
                    
                    var firstChamp = preloadedAssets.validChampions[randomIndex];
                    var frameName = firstChamp.spriteKey.endsWith('.png') ? firstChamp.spriteKey : firstChamp.spriteKey + '.png';
                    var frameData = preloadedAssets.atlasData.textures[0].frames.find(function(f) {
                        return f.filename === frameName;
                    });
                    
                    if (frameData) {
                        var canvas = document.createElement('canvas');
                        canvas.width = frameData.frame.w;
                        canvas.height = frameData.frame.h;
                        var ctx = canvas.getContext('2d');
                        ctx.drawImage(
                            preloadedAssets.spriteSheet,
                            frameData.frame.x, 
                            frameData.frame.y,
                            frameData.frame.w,
                            frameData.frame.h,
                            0,
                            0,
                            frameData.frame.w,
                            frameData.frame.h
                        );
                        
                        preloadedAssets.firstChampionCanvas = canvas;
                        console.log('[IntroModal] Pre-rendered first champion:', firstChamp.nameEn);
                    }
                    
                    resolve();
                })
                .catch(function(e) {
                    console.warn('[IntroModal] Asset preload failed:', e);
                    reject(e);
                });
        };
        
        img.onerror = reject;
    }).catch(function(e) {
        console.warn('[IntroModal] Asset preload failed (non-critical):', e);
    });
}

var heroAssetsReady = preloadHeroSelectAssets();

export function waitForHeroAssets() {
    return heroAssetsReady;
}

export function getPreloadedAssets() {
    return preloadedAssets;
}

var amerginLines = [
    { ga: "Cé an té le nod slí na gcloch sléibhe?", en: "Who knows the way of the mountain stones?" },
    { ga: "Cé gair aois na gealaí?", en: "Who fortells the ages of the moon?" },
    { ga: "Cá dú dul faoi na gréine?", en: "Who knows where the sun rests?" },
    { ga: "Cé beir buar ó thigh Teathra?", en: "Who can raid the house of Teathra?" },
    { ga: "Cé buar Teathra le gean?", en: "Who can charm the sunless king?" },
    { ga: "Cé daon? Cé dia, dealbhóir arm faobhrach?", en: "What people? what god sculpts keen weapons?" }
];

function unlockAudio() {
    if (audioContextUnlocked) {
        return Promise.resolve();
    }
    
    return new Promise(function(resolve) {
        try {
            var AudioContext = window.AudioContext || window.webkitAudioContext;
            var tempContext = new AudioContext();
            
            console.log('[IntroModal] Audio context state:', tempContext.state);
            
            if (tempContext.state === 'suspended') {
                tempContext.resume().then(function() {
                    console.log('[IntroModal] Audio context resumed');
                });
            }
            
            var buffer = tempContext.createBuffer(1, 1, 22050);
            var source = tempContext.createBufferSource();
            source.buffer = buffer;
            source.connect(tempContext.destination);
            source.start(0);
            
            audioContextUnlocked = true;
            console.log('[IntroModal] Audio context unlocked');
            
            setTimeout(function() {
                tempContext.close();
            }, 100);
            
            resolve();
        } catch (e) {
            console.warn('[IntroModal] Audio unlock failed:', e);
            resolve();
        }
    });
}

// Synchronous fullscreen - MUST be called directly from user gesture
function requestFullscreen() {
    if (fullscreenRequested) return;
    fullscreenRequested = true;
    
    try {
        var el = document.documentElement;

        console.log('[IntroModal] Browser/Platform:', navigator.userAgent);
        console.log('[IntroModal] Already fullscreen?', !!document.fullscreenElement || !!document.webkitFullscreenElement);

        if (document.fullscreenElement || document.webkitFullscreenElement) {
            console.log('[IntroModal] Already fullscreen - skipping');
            return;
        }

        // Call synchronously - no promises
        if (el.requestFullscreen) {
            console.log('[IntroModal] Calling requestFullscreen()...');
            var promise = el.requestFullscreen();
            promise.then(function() {
                console.log('[IntroModal] ✅ Fullscreen SUCCESS!');
            }).catch(function(e) {
                console.error('[IntroModal] ❌ Fullscreen FAILED');
                console.error('[IntroModal] Error name:', e.name);
                console.error('[IntroModal] Error message:', e.message);
                console.error('[IntroModal] Full error:', e);
            });
            console.log('[IntroModal] Fullscreen requested');
        } else if (el.webkitRequestFullscreen) {
            console.log('[IntroModal] Calling webkitRequestFullscreen()...');
            el.webkitRequestFullscreen();
            console.log('[IntroModal] Fullscreen requested (webkit)');
        } else if (el.msRequestFullscreen) {
            console.log('[IntroModal] Calling msRequestFullscreen()...');
            el.msRequestFullscreen();
            console.log('[IntroModal] Fullscreen requested (ms)');
        } else {
            console.warn('[IntroModal] ⚠️ Fullscreen API NOT SUPPORTED on this browser');
            console.log('[IntroModal] Available methods:', {
                requestFullscreen: typeof el.requestFullscreen,
                webkitRequestFullscreen: typeof el.webkitRequestFullscreen,
                msRequestFullscreen: typeof el.msRequestFullscreen
            });
        }
    } catch (e) {
        console.error('[IntroModal] ❌ Exception in requestFullscreen');
        console.error('[IntroModal] Exception:', e);
    }
}

export function initIntroModal(onComplete) {
    if (initialized) {
        return;
    }
    initialized = true;

    console.log('[IntroModal] Initializing');

    function loadFont() {
        return document.fonts.load('1.8rem Aonchlo')
            .then(function() {
                console.log('[IntroModal] Font loaded');
            })
            .catch(function(e) {
                console.warn('[IntroModal] Font load failed:', e);
            });
    }

    loadFont();

    var container = document.createElement('div');
    container.id = 'intro-modal';
    container.style.cssText = 'position: fixed; inset: 0; z-index: 100000; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: all; opacity: 0; transition: opacity 0.3s ease; background: transparent;';
    
    var contentLayer = document.createElement('div');
    contentLayer.style.cssText = 'position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; width: 100%; padding: 2rem; box-sizing: border-box;';

    var irishText = document.createElement('div');
    var initialLine = amerginLines[Math.floor(Math.random() * amerginLines.length)];
    irishText.textContent = initialLine.ga;
    irishText.style.cssText = 'font-family: Aonchlo, serif; font-size: 1.8rem; color: #d4af37; margin-bottom: 1rem; text-align: center; transition: opacity 0.8s ease-in-out; min-height: 4rem;';

    var englishText = document.createElement('div');
    englishText.textContent = initialLine.en;
    englishText.style.cssText = 'font-family: "Courier New", monospace; font-size: 1.7rem; color: rgb(0, 255, 0); opacity: 0.05; transition: opacity 0.5s ease; min-height: 4rem; text-align: center; margin-bottom: 2rem;';

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    slider.value = '0.05';
    slider.className = 'intro-slider';
    slider.style.cssText = '-webkit-appearance: none; width: 90%; max-width: 600px; height: 10px; background: linear-gradient(to right, #d4af37 0%, #d4af37 5%, #444 5%, #444 100%); border-radius: 5px; outline: none; margin: 20px 0;';

    var sliderStyle = document.createElement('style');
    sliderStyle.textContent = '.intro-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 44px; height: 44px; border-radius: 50%; background: #ffd700; cursor: pointer; border: 8px solid rgba(255, 215, 0, 0.3); background-clip: padding-box; box-shadow: 0 0 15px rgba(0,0,0,0.5); animation: thumbInvite 1.5s infinite ease-in-out; } .intro-slider::-moz-range-thumb { width: 44px; height: 44px; border-radius: 50%; background: #ffd700; cursor: pointer; border: 8px solid rgba(255, 215, 0, 0.3); box-shadow: 0 0 15px rgba(0,0,0,0.5); } @keyframes thumbInvite { 0%, 100% { transform: scale(1); border-color: rgba(255, 215, 0, 0.3); } 50% { transform: scale(1.15); border-color: rgba(255, 255, 255, 0.8); } }';
    document.head.appendChild(sliderStyle);

    var currentLyricIndex = amerginLines.indexOf(initialLine);
    var hasMovedSlider = false;

    var lyricInterval = setInterval(function() {
        if (!hasMovedSlider) {
            currentLyricIndex = (currentLyricIndex + 1) % amerginLines.length;
            var line = amerginLines[currentLyricIndex];
            
            irishText.style.opacity = '0';
            englishText.style.opacity = '0';

            setTimeout(function() {
                irishText.textContent = line.ga;
                englishText.textContent = line.en;
                irishText.style.opacity = '1';
                englishText.style.opacity = slider.value;
            }, 800);
        }
    }, 10000);

    // CRITICAL: Request fullscreen IMMEDIATELY on touchstart (synchronously)
    slider.addEventListener('touchstart', function() {
        requestFullscreen(); // Must be first, synchronous
        unlockAudio(); // Can be async
    }, false);

    // CRITICAL: Request fullscreen IMMEDIATELY on mousedown (synchronously)
    slider.addEventListener('mousedown', function() {
        requestFullscreen(); // Must be first, synchronous
        unlockAudio(); // Can be async
    }, false);

    contentLayer.appendChild(irishText);
    contentLayer.appendChild(englishText);
    contentLayer.appendChild(slider);
    container.appendChild(contentLayer);
    document.body.appendChild(container);
    
    Promise.race([
        loadFont(),
        new Promise(function(resolve) { setTimeout(resolve, 100); })
    ]).then(function() {
        requestAnimationFrame(function() {
            container.style.opacity = '1';
            
            setTimeout(function() {
                console.log('[IntroModal] Container visible');
            }, 500);
        });
    });

    slider.oninput = function(e) {
        var val = parseFloat(e.target.value);

        englishText.style.opacity = val;
        slider.style.background = 'linear-gradient(to right, #d4af37 0%, #d4af37 ' + (val * 100) + '%, #444 ' + (val * 100) + '%, #444 100%)';

        if (!hasMovedSlider && val > 0.15) {
            hasMovedSlider = true;
            clearInterval(lyricInterval);

            var currentLine = amerginLines[currentLyricIndex];

            setTimeout(function() {
                container.style.transition = 'opacity 0.8s ease';
                container.style.opacity = '0';

                setTimeout(function() {
                    container.remove();
                    sliderStyle.remove();
                    initialized = false;

                    onComplete(val, currentLine);
                }, 800);
            }, 1500);
        }
    };
}

export function getCurrentIntroState() {
    return initialized;
}

export function isAudioUnlocked() {
    return audioContextUnlocked;
}

