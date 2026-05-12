import Phaser from 'phaser';
import { FONTS, COLORS, TYPE } from './game/systems/gameTypography.js';
import { allTunes } from './game/systems/music/allTunes.js';
import * as abcjs from 'abcjs';
import { champions } from '../data/champions.js';
import { TradSessionPlayer } from './game/systems/music/tradSessionPlayerScheduled.js';
import { getTuneKeyForChampion } from './game/systems/music/championTuneMapping.js';
import { levelTunes } from './game/systems/music/levelTunes.js';
import { triggerMurmuration } from './game/effects/murmuration.js';
import { ScrollingTextPlayer } from './game/ui/scrollingTextPlayer.js';
import { constellationTexts } from '../data/constellationTexts.js';
import { createMoonWidget, getMoonBottomOffset } from './game/ui/moonWidget.js';
import { createDomButton } from './game/systems/gameTypography.js';




var _audioUnlocked  = false;
var _fullscreenDone = false;

(function warmupMusicSystem() {
    setTimeout(function() {
        try {
            const AC  = window.AudioContext || window.webkitAudioContext;
            const tmp = new AC();
            abcjs.parseOnly('X:1\nT:Test\nM:4/4\nL:1/8\nK:C\nCDEF GABc|');
            setTimeout(() => tmp.close(), 100);
        } catch (e) { console.warn('[ConstellationScene] Music warmup:', e); }
    }, 0);
})();

var _preloadedAssets = {
    spriteSheet: null, atlasData: null, validChampions: null,
    firstChampionCanvas: null, randomStartIndex: null,
};
var _prewarmedPlayer = null;

var _heroAssetsReady = (function preloadHeroSelectAssets() {
    const img = new Image();
    img.src   = 'assets/champions/champions-with-kit.png';
    return new Promise((resolve) => {
        img.onload = () => {
            _preloadedAssets.spriteSheet = img;
            fetch('assets/champions/champions0.json')
                .then(r => r.json())
                .then(data => {
                    _preloadedAssets.atlasData      = data;
                    _preloadedAssets.validChampions = champions.filter(c => c && c.spriteKey && c.stats);
                    const idx   = Math.floor(Math.random() * _preloadedAssets.validChampions.length);
                    _preloadedAssets.randomStartIndex = idx;
                    const champ = _preloadedAssets.validChampions[idx];
                    const fname = champ.spriteKey.endsWith('.png') ? champ.spriteKey : champ.spriteKey + '.png';
                    const fd    = data.textures[0].frames.find(f => f.filename === fname);
                    if (fd) {
                        const cv = document.createElement('canvas');
                        cv.width = fd.frame.w; cv.height = fd.frame.h;
                        cv.getContext('2d').drawImage(
                            img, fd.frame.x, fd.frame.y, fd.frame.w, fd.frame.h,
                            0, 0, fd.frame.w, fd.frame.h
                        );
                        _preloadedAssets.firstChampionCanvas = cv;
                    }
                    try {
                        const tuneKey = getTuneKeyForChampion(champ);
                        if (tuneKey) {
                            _prewarmedPlayer = new TradSessionPlayer();
                            _prewarmedPlayer.loadTune(tuneKey);
                        }
                    } catch(e) { console.warn('[ConstellationScene] Music pre-warm failed:', e); }
                    resolve();
                })
                .catch(e => { console.warn('[ConstellationScene] Asset preload failed:', e); resolve(); });
        };
        img.onerror = () => resolve();
    });
})();

export function getPrewarmedPlayer() { return _prewarmedPlayer; }
export function waitForHeroAssets()  { return _heroAssetsReady; }
export function getPreloadedAssets() { return _preloadedAssets; }
export function isAudioUnlocked()    { return _audioUnlocked; }

function _unlockAudio() {
    if (_audioUnlocked) return;
    try {
        const AC  = window.AudioContext || window.webkitAudioContext;
        const tmp = new AC();
        if (tmp.state === 'suspended') tmp.resume();
        const buf = tmp.createBuffer(1, 1, 22050);
        const src = tmp.createBufferSource();
        src.buffer = buf; src.connect(tmp.destination); src.start(0);
        _audioUnlocked = true;
        setTimeout(() => tmp.close(), 100);
    } catch (e) { console.warn('[ConstellationScene] Audio unlock:', e); }
}

function _requestFullscreen() {
    if (_fullscreenDone) return;
    try {
        const el = document.documentElement;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            _fullscreenDone = true; return;
        }
        if (el.requestFullscreen) {
            el.requestFullscreen().then(() => { _fullscreenDone = true; }).catch(() => {});
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen(); _fullscreenDone = true;
        } else if (el.msRequestFullscreen) {
            el.msRequestFullscreen(); _fullscreenDone = true;
        }
    } catch (e) { console.warn('[ConstellationScene] Fullscreen:', e); }
}

var _sceneInitialized = false;

export function initConstellationScene(onComplete) {
    if (_sceneInitialized) return;
    _sceneInitialized = true;
    _fullscreenDone = false;
    document.fonts.load('1.8rem Urchlo').catch(() => {});
    document.fonts.load('1.8rem Aonchlo').catch(() => {});
    const game = new Phaser.Game({
        type: Phaser.AUTO, width: window.innerWidth, height: window.innerHeight,
        backgroundColor: '#00060f', parent: 'gameContainer',
        scene: [ConstellationScene],
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { touch: true },
    });
    game.registry.set('onComplete', onComplete);
    return game;
}

const CONSTELLATION_DATA = [
   
{ id: 'cu', starOffsets: [
    { lx: -1.20, ly:  0.60 }, // 0 — rear haunches
    { lx: -0.30, ly: -0.80 }, // 1 — back/spine
    { lx:  0.60, ly: -0.50 }, // 2 — neck
    { lx:  1.10, ly:  0.70 }, // 3 — nose/head down
], connections: [
    { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 },
]},  { id: 'naomhog', starOffsets: [
        { lx:  1.37, ly: -0.10 }, { lx:  0.55, ly:  0.37 }, { lx:  0.13, ly: -0.07 },
        { lx: -0.64, ly: -0.02 }, { lx: -1.40, ly: -0.38 },
    ], connections: [
        { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 4 },
    ]},
    { id: 'carr', starOffsets: [
        { lx:  1.23, ly: -0.40 }, { lx:  1.25, ly: -0.05 }, { lx:  0.42, ly:  0.12 },
        { lx:  0.07, ly: -0.09 }, { lx: -0.54, ly: -0.02 }, { lx: -1.02, ly:  0.04 },
        { lx: -1.40, ly:  0.40 },
    ], connections: [
        { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 0 },
        { from: 3, to: 4 }, { from: 4, to: 5 }, { from: 5, to: 6 },
    ]},
    { id: 'torc', starOffsets: [
        { lx:  1.14, ly: -1.40 }, { lx:  1.27, ly: -1.11 }, { lx:  0.53, ly: -0.73 },
        { lx: -0.00, ly:  0.07 }, { lx: -0.10, ly:  0.89 }, { lx: -0.55, ly:  0.98 },
        { lx: -1.10, ly:  0.35 }, { lx: -1.19, ly:  0.95 },
    ], connections: [
        { from: 0, to: 2 }, { from: 1, to: 2 }, { from: 2, to: 3 },
        { from: 3, to: 4 }, { from: 4, to: 5 }, { from: 5, to: 6 }, { from: 5, to: 7 },
    ]},
    { id: 'cuirt', starOffsets: [
        { lx: -1.30, ly:  0.40 }, { lx: -0.85, ly: -0.55 }, { lx: -0.30, ly: -1.10 },
        { lx:  0.00, ly: -1.35 }, { lx:  0.30, ly: -1.10 }, { lx:  0.85, ly: -0.55 },
        { lx:  1.30, ly:  0.40 },
    ], connections: [
        { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 },
        { from: 3, to: 4 }, { from: 4, to: 5 }, { from: 5, to: 6 },
    ]},
    { id: 'draoi', starOffsets: [
        { lx:  0.42, ly:  1.13 }, { lx:  1.05, ly:  1.23 }, { lx: -0.46, ly:  0.19 },
        { lx: -0.06, ly: -1.15 }, { lx: -0.96, ly: -1.40 },
    ], connections: [
        { from: 0, to: 1 }, { from: 0, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 4 },
    ]},
    { id: 'clairseach', starOffsets: [
        { lx:  1.31, ly: -1.28 }, { lx:  0.45, ly: -0.77 }, { lx: -0.08, ly:  1.10 },
        { lx: -1.07, ly:  1.40 }, { lx: -0.61, ly: -0.45 },
    ], connections: [
        { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 },
        { from: 3, to: 4 }, { from: 4, to: 1 },
    ]},
    { id: 'laoch', starOffsets: [
        { lx:  0.78, ly: -1.45 }, { lx:  0.21, ly: -1.03 }, { lx: -0.33, ly: -0.79 },
        { lx:  0.71, ly:  0.00 }, { lx: -0.74, ly:  0.11 }, { lx: -0.64, ly:  1.05 },
    ], connections: [
        { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 1, to: 3 },
        { from: 2, to: 4 }, { from: 4, to: 5 },
    ]},
];

const SPIRAL_A = 550, SPIRAL_B = 0.9, SPIRAL_STEP = 1.45;
const TRAIL_SMOOTH = 0.28, TRAIL_MAX = 70;
const LINE_LINGER_MS = 7600;
const RIPPLE_MS = 900, RIPPLE_MAX_R = 55, RIPPLE_ALPHA = 0.75;

// ── Moon rest position ────────────────────────────────────────────────────────
// Fixed px from the bottom edge of the screen after swipe.
// This is the only value you need to tune — consistent across all window sizes.
const MOON_REST_FROM_BOTTOM = 120;

const AMERGIN_LINES = [
    { ga: 'Cé an té le nod slí na gcloch sléibhe?', en: 'Who knows the way of the mountain stones?' },
    { ga: 'Cé gair aois na gealaí?',                en: 'Who foretells the ages of the moon?' },
    { ga: 'Cá dú dul faoi na gréine?',              en: 'Who knows where the sun rests?' },
    { ga: 'Cé beir buar ó thigh Teathra?',          en: 'Who can raid the house of Teathra?' },
    { ga: 'Cé buar Teathra le gean?',               en: 'Who can charm the sunless king?' },
];

export class ConstellationScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ConstellationScene' });
        this.currentIndex = 0;
        this.canInteract  = false;
        this.isDrawing  = false;
        this.strokeHits = [];
        this.trailPts   = [];
        this.smoothX = 0; this.smoothY = 0;
        this.audioContext = null;
        this.worldG = null; this.trailG = null;
        this.ripples = []; this.constellations = [];
        this.pulseTimer = null; this.pulseIdx = 0;
        this.worldCX = 0; this.worldCY = 0;
        this.moonPhase       = 0.05;
        this._moonWidget     = null;
        this._moonSwipeDone  = false;
        this._moonFinalTopPx = null;
        this._skipMenuOpen   = false;
        this.moonOverlay     = null;
        this.irishOverlayEl  = null;
        this.englishEl       = null;
        this._textPlayer       = null;
        this._completionPlayer = null;
        this._harpStarted      = false;
        this._duskEl           = null;
        this._darkImageEl      = null;
        this._shadowHillEl     = null;
        this.spinAngle         = 0;
    }

    get W() { return this.scale.width; }
    get H() { return this.scale.height; }

    // ── ScrollingTextPlayer clearance ─────────────────────────────────────────
    _stpClearance() {
        const minDim   = Math.min(window.innerWidth, window.innerHeight);
        const moonR    = Math.max(24, Math.round(minDim * 0.055));
        const moonD    = moonR * 2;
        const pad      = 18;
        const wrapperH = moonD + pad * 2;
        return Math.round(102 + wrapperH / 2) + 8;
    }

    preload() {
        this.load.image('shadowHill', './assets/shadowHill.png');
        this.load.image('naomhog', './assets/naomhog.png');
        this.load.image('cuirt',   './assets/cuirt.png');
    }

    create() {
        this.initAudio();
        this._onComplete = this.registry.get('onComplete') || null;
        this._frozenAmerginLine = null;
        this.cameras.main.setBackgroundColor('#00060f');
        const wSize = 5000;
        this.worldCX = wSize / 2; this.worldCY = wSize / 2;
        this.cameras.main.setBounds(0, 0, wSize, wSize);
        this.drawStaticBackground(wSize);
        this.drawNebula(wSize);
        this.worldG  = this.add.graphics().setDepth(10);
        this.rippleG = this.add.graphics().setDepth(11);
        this.trailG  = this.add.graphics().setScrollFactor(0).setDepth(13);
        this.uiCamera = this.cameras.add(0, 0, this.W, this.H)
            .setName('ui').setBackgroundColor('rgba(0,0,0,0)');
        this.uiCamera.ignore(this.children.list.filter(o => o.depth !== 22));
        this.cameras.main.ignore(this.children.list.filter(o => o.depth === 22));
        this.buildConstellations(wSize);
        const c0 = this.constellations[0];
        this.cameras.main.setScroll(c0.wcx - this.W / 2, c0.wcy - this.H / 2 - this.H * 0.38);
        this.worldG.setAlpha(0);
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup',   this.onPointerUp,   this);
        const fsHandler = () => {
            _requestFullscreen(); _unlockAudio();
            this.game.canvas.removeEventListener('pointerdown', fsHandler);
            this.game.canvas.removeEventListener('touchstart',  fsHandler);
        };
        this.game.canvas.addEventListener('pointerdown', fsHandler, { once: true, passive: true });
        this.game.canvas.addEventListener('touchstart',  fsHandler, { once: true, passive: true });
        this.buildMoonOverlay();

        // ── Shadow hill as DOM element ────────────────────────────────────────
        // z-index 99999: above scrolling text (99998), below moon (100000+)
        // pointer-events:none so stars beneath remain tappable
        const hillEl = document.createElement('img');
        hillEl.src = './assets/shadowHill.png';
        hillEl.style.cssText = [
            'position:fixed;',
            'bottom:0;left:0;',
            'width:125%;',
            'height:auto;',
            'pointer-events:none;',
            'z-index:99999;',
        ].join('');
        document.body.appendChild(hillEl);
        this._shadowHillEl = hillEl;

        this.scale.on('resize', (gs) => {
            if (this._duskEl) this._duskEl.style.height = Math.round(gs.height * 0.20) + 'px';
            this._updateDusk();
        });

        this._duskEl = document.createElement('div');
        this._duskEl.style.cssText = [
            'position:fixed;left:0;right:0;bottom:0;',
            `height:${Math.round(this.H * 0.20)}px;`,
            'pointer-events:none;z-index:99994;opacity:0;',
            'transition:background 1.8s ease, opacity 0.6s ease;',
        ].join('');
        document.body.appendChild(this._duskEl);
        this._drawDuskGradient(0);
    }

    // ── Dusk ──────────────────────────────────────────────────────────────────
    _drawDuskGradient(progress) {
        const el = this._duskEl; if (!el) return;
        const t   = Math.max(0, Math.min(1, progress));
        const botR = Math.round(Phaser.Math.Linear(140,  40, t));
        const botG = Math.round(Phaser.Math.Linear(170,  20, t));
        const botB = Math.round(Phaser.Math.Linear(210,  80, t));
        const botA = Phaser.Math.Linear(0.28, 0.14, t);
        el.style.background = `linear-gradient(to bottom,rgba(0,0,0,0) 0%,rgba(${botR},${botG},${botB},${botA}) 100%)`;
        if (el.style.opacity === '0') el.style.opacity = '1';
    }
    _updateDusk() {
        const total = this.constellations.length;
        this._drawDuskGradient(total > 1 ? this.currentIndex / (total - 1) : 0);
    }

    // ── Dark image ────────────────────────────────────────────────────────────
    _showDarkImage(id) {
        this._hideDarkImage(true);
        const W = this.W, H = this.H;
        const el = document.createElement('img');
        el.src = `assets/stars/${id}.png`;
        el.onerror = () => { el.src = 'assets/sc01.png'; };
        el.style.cssText = [
            'position:fixed;width:auto;',
            `max-height:${Math.round(H * 0.50)}px;max-width:${Math.round(W * 0.70)}px;`,
            'left:50%;top:45%;transform:translate(-50%,-50%) scale(2);',
            'pointer-events:none;z-index:99993;opacity:0;',
            'transition:opacity 2.2s ease-in;mix-blend-mode:screen;',
        ].join('');
        document.body.appendChild(el);
        this._darkImageEl = el;
        requestAnimationFrame(() => { if (el.parentNode) el.style.opacity = '0.65'; });
    }
    _hideDarkImage(immediate = false) {
        const el = this._darkImageEl; if (!el) return;
        this._darkImageEl = null;
        if (immediate) { el.remove(); return; }
        el.style.transition = 'opacity 0.9s ease-out'; el.style.opacity = '0';
        setTimeout(() => el.remove(), 950);
    }

    // ── Moon overlay ──────────────────────────────────────────────────────────
    buildMoonOverlay() {
        const H = this.H;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
        this.moonOverlay = overlay;

        let currentLyricIndex = Math.floor(Math.random() * AMERGIN_LINES.length);
        let line              = AMERGIN_LINES[currentLyricIndex];
        this._frozenAmerginLine = line;

        const irishEl = document.createElement('div');
        irishEl.textContent = line.ga;
        irishEl.style.cssText = [
            `font-family:${FONTS.irish};font-size:${TYPE.domBody.size};`,
            `color:${COLORS.irish};text-align:center;`,
            'text-shadow:0 0 18px rgba(0,0,0,0.9);padding:0 6%;',
            'pointer-events:none;opacity:1;transition:opacity 0.8s ease-in-out;',
            'position:absolute;left:0;right:0;',
            `top:${Math.round(H * 0.12)}px;`,
        ].join('');
        this.irishOverlayEl = irishEl;

        const enEl = document.createElement('div');
        enEl.textContent = line.en;
        enEl.style.cssText = [
            `font-family:${FONTS.english};font-size:${TYPE.domBodyEn.size};`,
            `color:${COLORS.druid};text-align:center;`,
            'text-shadow:0 0 12px rgba(0,0,0,0.9);padding:0 6%;',
            'pointer-events:none;opacity:0.05;transition:opacity 0.5s ease;',
            'position:absolute;left:0;right:0;',
            `top:${Math.round(H * 0.22)}px;`,
        ].join('');
        this.englishEl = enEl;

        this._lyricInterval = setInterval(() => {
            if (this._moonSwipeDone) return;
            currentLyricIndex = (currentLyricIndex + 1) % AMERGIN_LINES.length;
            line = AMERGIN_LINES[currentLyricIndex];
            this._frozenAmerginLine = line;
            irishEl.style.opacity = '0'; enEl.style.opacity = '0';
            setTimeout(() => {
                irishEl.textContent   = line.ga;
                enEl.textContent      = line.en;
                irishEl.style.opacity = '1';
                enEl.style.opacity    = String(this.moonPhase || 0.05);
            }, 800);
        }, 10000);

        overlay.appendChild(irishEl);
        overlay.appendChild(enEl);
        document.body.appendChild(overlay);

        this._moonWidget = createMoonWidget({
            initialPhase : 0.05,
            showSlider   : false,
            corner       : 'bottom-center',
            onChange     : (phase) => {
                this.moonPhase = phase;
                enEl.style.opacity = String(phase);

                if (!this._moonSwipeDone && phase > 0.5) {
                    this._moonSwipeDone = true;
                    clearInterval(this._lyricInterval);
                    _requestFullscreen();
                    _unlockAudio();
                    this._driftMoonToBottom();
                    this.settleMoon();
                }
            },
        });

        // Position moon at 35vh to start
    
const wrapper = this._moonWidget.element;
if (wrapper) {
    const earlyUnlock = () => {
        _requestFullscreen();
        _unlockAudio();
        wrapper.removeEventListener('pointerdown', earlyUnlock);
    };
    wrapper.addEventListener('pointerdown', earlyUnlock, { passive: true });
}
        if (wrapper) {
            const moonD    = this._moonWidget.moonD;
            const pad      = 18;
            const wrapperH = moonD + pad * 2;

            // Fixed distance from bottom edge — tune MOON_REST_FROM_BOTTOM above.
            this._moonFinalTopPx = H - wrapperH - MOON_REST_FROM_BOTTOM;

            wrapper.style.bottom    = 'auto';
            wrapper.style.top       = Math.round(H * 0.35) + 'px';
            wrapper.style.left      = '50%';
            wrapper.style.transform = 'translateX(-50%)';
            wrapper.style.transition = 'none';
        }

        this._moonWidget.setLongPressHandler(() => {
            if (!this._moonSwipeDone) return;
            this._openSkipMenu();
        });

        this._moonWidget.setLongPressProgressHandler((p) => {
            if (!this._moonSwipeDone || !this._menuPreview) return;
            if (p <= 0.12) return;
            this._menuPreview.style.display = 'block';
            this._menuPreview.style.opacity = String(
                Math.min(((p - 0.12) * 1.15), 0.6).toFixed(3)
            );
        });

        this._menuPreview = document.createElement('div');
        this._menuPreview.style.cssText = [
            'position:fixed;inset:0;',
            'background:rgba(8,6,2,0.6);',
            'z-index:1000001;',
            'pointer-events:none;',
            'display:none;opacity:0;',
            'transition:opacity 0.3s ease;',
        ].join('');
        document.body.appendChild(this._menuPreview);
    }

    // ── _driftMoonToBottom ────────────────────────────────────────────────────
   _driftMoonToBottom() {
    const wrapper = this._moonWidget?.element;
    if (!wrapper) return;
    const finalTopPx = this._moonFinalTopPx ?? Math.round(this.H * 0.55);

    wrapper.style.transition = 'top 2.5s ease-in-out';
    void wrapper.offsetHeight;
    wrapper.style.top = Math.round(finalTopPx) + 'px';

    // After drift completes, switch to bottom-anchoring so it stays
    // correct if the window resizes or goes fullscreen
    setTimeout(() => {
        const el = this._moonWidget?.element;
        if (!el) return;
        el.style.transition = 'none';
        el.style.top        = 'auto';
        el.style.bottom     = MOON_REST_FROM_BOTTOM + 'px';
    }, 2600);
} 

    // ── settleMoon ────────────────────────────────────────────────────────────
    settleMoon() {
        if (!this._harpSilentStarted) {
            this._initAudioContext();
            this._startHarpOnSwipe();
        }

        this._bgWheelsPaused = true;
        this.spinAngle = 0;
        this.cameras.main.setAngle(0);

        const c0            = this.constellations[0];
        const targetScrollX = c0.wcx - this.W / 2;
        const targetScrollY = c0.wcy - this.H / 2;
        const finalScrollY  = targetScrollY + this.H * 0.22;
        const panStartY     = finalScrollY - this.H * 0.35;

        this.cameras.main.setScroll(targetScrollX, panStartY);

        const panProg = { t: 0 };
        this.tweens.add({
            targets: panProg, t: 1, duration: 1400, ease: 'Cubic.easeInOut',
            onUpdate: () => {
                this.cameras.main.scrollY = panStartY + (finalScrollY - panStartY) * panProg.t;
            },
            onComplete: () => { this._startPostSettleSequence(finalScrollY); },
        });

        // Delay Amergin text fade until after moon drift completes (~2600ms)
        setTimeout(() => {
            [this.irishOverlayEl, this.englishEl].forEach(el => {
                if (el) { el.style.transition = 'opacity 1.2s ease'; el.style.opacity = '0'; }
            });
            setTimeout(() => {
                if (this.moonOverlay) { this.moonOverlay.remove(); this.moonOverlay = null; }
            }, 1400);
        }, 2200);
    }

    // ── _startPostSettleSequence ──────────────────────────────────────────────
    _startPostSettleSequence(baseScrollY) {
        this.tweens.add({
            targets: this.worldG, alpha: 1, duration: 1200, ease: 'Sine.easeIn',
            onStart: () => { this._bgWheelsPaused = false; },
            onComplete: () => {
                const driftBase = this.cameras.main.scrollY;
                const driftProg = { t: 0 };
                this._moonDriftTween = this.tweens.add({
                    targets: driftProg, t: 1, duration: 480000, ease: 'Linear',
                    onUpdate: () => {
                        this.cameras.main.scrollY = driftBase + driftProg.t * (this.H * 0.14);
                    },
                });
                this.startSequencePulse();
            },
        });
    }

    // ── Skip menu ─────────────────────────────────────────────────────────────
    _openSkipMenu() {
        if (this._skipMenuOpen) return;
        this._skipMenuOpen = true;

        const backdrop = this._menuPreview;
        backdrop.style.pointerEvents = 'all';
        backdrop.style.opacity       = '0.7';

        const card = document.createElement('div');
        card.style.cssText = [
            'position:fixed;top:50%;left:50%;',
            'transform:translate(-50%,-50%);',
            'background:rgba(4,8,20,0.96);',
            'border:1px solid rgba(212,175,55,0.35);',
            'border-radius:18px;padding:2rem 1.5rem 1.5rem;',
            'width:min(340px,85vw);',
            'display:flex;flex-direction:column;gap:1rem;align-items:center;',
            'z-index:1000002;',
            'box-shadow:0 8px 40px rgba(0,0,0,0.8);',
            'opacity:0;transition:opacity 0.25s ease;',
        ].join('');
        document.body.appendChild(card);
        this._skipMenuCard = card;
        requestAnimationFrame(() => { card.style.opacity = '1'; });

        const skipBtn = createDomButton({
            ga: 'Scip', en: 'Skip', opacity: this.moonPhase,
            onClick: () => {
                this._closeSkipMenu();
                this.time.delayedCall(300, () => this.onAllComplete());
            },
        });
        skipBtn.el.style.width = '100%';

        const backBtn = createDomButton({
            ga: 'Síar', en: 'Back', opacity: this.moonPhase,
            onClick: () => { this._closeSkipMenu(); },
        });
        backBtn.el.style.width = '100%';

        card.appendChild(skipBtn.el);
        card.appendChild(backBtn.el);

        this._moonWidget.setTapHandler(() => { this._closeSkipMenu(); });

        let touchStartY = 0;
        const onTouchStart = (e) => { touchStartY = e.touches[0].clientY; };
        const onTouchEnd   = (e) => {
            if (touchStartY - e.changedTouches[0].clientY > 40) this._closeSkipMenu();
        };
        backdrop.addEventListener('touchstart', onTouchStart, { passive: true });
        backdrop.addEventListener('touchend',   onTouchEnd,   { passive: true });
        this._skipMenuBackdropHandlers = { onTouchStart, onTouchEnd };
    }

    _closeSkipMenu() {
        if (!this._skipMenuOpen) return;
        this._skipMenuOpen = false;
        this._moonWidget.setTapHandler(null);

        const backdrop = this._menuPreview;
        backdrop.style.opacity       = '0';
        backdrop.style.pointerEvents = 'none';
        setTimeout(() => { backdrop.style.display = 'none'; }, 320);

        if (this._skipMenuBackdropHandlers) {
            backdrop.removeEventListener('touchstart', this._skipMenuBackdropHandlers.onTouchStart);
            backdrop.removeEventListener('touchend',   this._skipMenuBackdropHandlers.onTouchEnd);
            this._skipMenuBackdropHandlers = null;
        }

        if (this._skipMenuCard) {
            this._skipMenuCard.style.opacity = '0';
            setTimeout(() => {
                if (this._skipMenuCard?.parentNode) this._skipMenuCard.remove();
                this._skipMenuCard = null;
            }, 280);
        }
    }

    // ── Spin ──────────────────────────────────────────────────────────────────
    updateSpin(delta) {
        if (this._bgWheelsPaused) return;
        const dt = delta * (this._bgWheelsSpeedMult || 1);
        if (this._bgWheelRt)    this._bgWheelRt.angle    += this._bgWheelSpeed    * dt;
        if (this._driftWheelRt) this._driftWheelRt.angle += this._driftWheelSpeed * dt;
        if (this._fgWheelRt)    this._fgWheelRt.angle    += this._fgWheelSpeed    * dt;
        const camDeg = this._driftWheelSpeed * dt;
        this.spinAngle = (this.spinAngle || 0) + camDeg;
        this.cameras.main.setOrigin(0.5, 0.28);
        this.cameras.main.setAngle(this.spinAngle);
    }

    drawNebula(wSize) {
        const S  = Math.round(Math.max(this.W, this.H) * 1.5);
        const rt = this.add.renderTexture(0, 0, S, S)
            .setScrollFactor(0).setDepth(2).setAlpha(0.55)
            .setOrigin(0.5).setPosition(this.W / 2, this.H / 2)
            .setBlendMode(Phaser.BlendModes.ADD);
        this._nebulaWheelRt    = rt;
        this._nebulaWheelSpeed = -360 / 120000;
        const paintNebula = (img) => {
            rt.clear();
            if (img) {
                const scale = Math.max(S / img.width, S / img.height);
                rt.draw(img, (S - img.width * scale) / 2, (S - img.height * scale) / 2);
            } else {
                const fg = this.make.graphics({ add: false });
                for (const g of [
                    { x:0.35, y:0.38, r:0.38, c1:0x6030c0, c2:0x1a1060 },
                    { x:0.65, y:0.28, r:0.32, c1:0x402090, c2:0x101050 },
                    { x:0.50, y:0.65, r:0.40, c1:0x203880, c2:0x0a1840 },
                    { x:0.22, y:0.68, r:0.30, c1:0x501060, c2:0x180830 },
                    { x:0.78, y:0.58, r:0.34, c1:0x381888, c2:0x101430 },
                ]) { fg.fillGradientStyle(g.c1,g.c1,g.c2,g.c2,0.7,0.7,0,0); fg.fillCircle(S*g.x,S*g.y,S*g.r); }
                rt.draw(fg, 0, 0); fg.destroy();
            }
        };
        if (this.textures.exists('nebula')) {
            paintNebula(this.textures.get('nebula').getSourceImage());
        } else {
            this.load.image('nebula', 'assets/n1-top@3x.png');
            this.load.once('complete', () => paintNebula(this.textures.get('nebula').getSourceImage()));
            this.load.start();
        }
    }

    drawStaticBackground(wSize) {
        const W = this.W, H = this.H;
        const S = Math.round(Math.max(W, H) * 1.5);
        const makeWheel = (seed, layers, speed, depth) => {
            const rt  = this.add.renderTexture(0, 0, S, S)
                .setScrollFactor(0).setDepth(depth).setOrigin(0.5)
                .setPosition(W / 2, H / 2).setBlendMode(Phaser.BlendModes.ADD);
            const tmp = this.make.graphics({ add: false });
            const rng = new Phaser.Math.RandomDataGenerator([seed]);
            for (const l of layers) {
                for (let i = 0; i < l.n; i++) {
                    const x = rng.realInRange(0, S), y = rng.realInRange(0, S);
                    const r = rng.realInRange(l.minR, l.maxR), a = rng.realInRange(l.minA, l.maxA);
                    tmp.fillStyle(0xffffff, a);
                    if (r < 1.2) { tmp.fillRect(Math.floor(x), Math.floor(y), 2, 2); }
                    else {
                        const arm = Math.round(r);
                        tmp.fillRect(Math.floor(x-arm), Math.floor(y), arm*2+1, 1);
                        tmp.fillRect(Math.floor(x), Math.floor(y-arm), 1, arm*2+1);
                    }
                }
            }
            rt.draw(tmp, 0, 0); tmp.destroy();
            return { rt, speed };
        };
        const bg = makeWheel('oíche2025', [
            { n:600, minR:0.6, maxR:1.0, minA:0.08, maxA:0.18 },
            { n:200, minR:1.0, maxR:1.5, minA:0.12, maxA:0.24 },
            { n:60,  minR:1.4, maxR:2.0, minA:0.16, maxA:0.30 },
        ], 360/180000, 3);
        this._bgWheelRt = bg.rt; this._bgWheelSpeed = bg.speed;
        const dr = makeWheel('réaltaí2', [
            { n:1800, minR:0.6, maxR:1.1, minA:0.15, maxA:0.38 },
            { n:600,  minR:1.0, maxR:1.6, minA:0.22, maxA:0.50 },
            { n:150,  minR:1.4, maxR:2.2, minA:0.28, maxA:0.58 },
        ], 360/90000, 4);
        this._driftWheelRt = dr.rt; this._driftWheelSpeed = dr.speed;
        const fg = makeWheel('réaltaí3', [
            { n:180, minR:1.0, maxR:2.0, minA:0.28, maxA:0.55 },
            { n:60,  minR:1.8, maxR:3.0, minA:0.38, maxA:0.65 },
            { n:20,  minR:2.5, maxR:4.0, minA:0.45, maxA:0.75 },
        ], 360/60000, 5);
        this._fgWheelRt = fg.rt; this._fgWheelSpeed = fg.speed;
    }

    buildConstellations(wSize) {
        const usable = Math.min(this.W, this.H) * 0.68;
        this.constellations = CONSTELLATION_DATA.map((data, idx) => {
            const theta = SPIRAL_B + idx * SPIRAL_STEP;
            const r     = SPIRAL_A * (1 + idx * 0.25);
            const wcx   = this.worldCX + Math.cos(theta) * r;
            const wcy   = this.worldCY + Math.sin(theta) * r;
            let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
            for (const o of data.starOffsets) {
                minX=Math.min(minX,o.lx); maxX=Math.max(maxX,o.lx);
                minY=Math.min(minY,o.ly); maxY=Math.max(maxY,o.ly);
            }
            const scale = usable / Math.max((maxX-minX)||0.01, (maxY-minY)||0.01);
            const ocx=(minX+maxX)/2, ocy=(minY+maxY)/2;
            const stars = data.starOffsets.map((o,i) => ({
                index:i, wx:wcx+(o.lx-ocx)*scale, wy:wcy+(o.ly-ocy)*scale,
                brightness:1.0, lit:false, completed:false,
            }));
            const connections = data.connections.map(c => ({
                from:c.from, to:c.to, completed:false, completedAt:null,
            }));
            return { id:data.id, wcx, wcy, stars, connections, completed:false };
        });
    }

    panCameraTo(idx, animate=true) {
        this._hideDarkImage(false);
        this.currentIndex = idx; this._updateDusk();
        const panNow = this.time.now;
        for (const c of this.constellations) {
            if (c.completed) for (const cn of c.connections) {
                if (cn.completedAt !== null && cn.panStartTime === undefined) cn.panStartTime = panNow;
            }
        }
        const c = this.constellations[idx]; if (!c) return;
        const tx = c.wcx - this.W/2, ty = c.wcy - this.H/2 + this.H*0.22;
        if (!animate) { this.cameras.main.setScroll(tx, ty); return; }
        if (this._moonDriftTween) { this._moonDriftTween.stop(); this._moonDriftTween = null; }
        const sx=this.cameras.main.scrollX, sy=this.cameras.main.scrollY;
        const dx=tx-sx, dy=ty-sy, dist=Math.sqrt(dx*dx+dy*dy)||1;
        const arcH=dist*0.28, px=-dy/dist*arcH, py=dx/dist*arcH;
        const mx=(sx+tx)/2+px, my=(sy+ty)/2+py;
        const cam=this.cameras.main, prog={t:0};
        this.tweens.killTweensOf(cam); this.tweens.killTweensOf(prog);
        const bgL=[
            {rt:this._bgWheelRt,    depth:0.25},
            {rt:this._driftWheelRt, depth:0.45},
            {rt:this._fgWheelRt,    depth:0.65},
        ].filter(l=>l.rt);
        const startAngles=bgL.map(l=>l.rt.angle), startCamAngle=this.spinAngle||0;
        const panDist=Math.sqrt((tx-sx)**2+(ty-sy)**2);
        const sweepDeg=Math.min(panDist*0.018,55);
        this._bgWheelsPaused=true;
        const PAN_MS=3000, prog2={t:0};
        this.tweens.add({ targets:prog2, t:1, duration:PAN_MS, ease:'Cubic.easeInOut',
            onUpdate:()=>{ bgL.forEach((l,i)=>{l.rt.angle=startAngles[i]-sweepDeg*l.depth*prog2.t;}); this.spinAngle=startCamAngle*(1-prog2.t); cam.setAngle(this.spinAngle); },
            onComplete:()=>{ this.spinAngle=0; cam.setAngle(0); this._bgWheelsPaused=false; this._setBgWheelPaused(true); },
        });
        this.tweens.add({ targets:prog, t:1, duration:PAN_MS, ease:'Cubic.easeInOut',
            onUpdate:()=>{ const t=prog.t,it=1-t; cam.scrollX=it*it*sx+2*it*t*mx+t*t*tx; cam.scrollY=it*it*sy+2*it*t*my+t*t*ty; },
            onComplete:()=>{
                const newBase=cam.scrollY, dp={t:0};
                this._moonDriftTween=this.tweens.add({ targets:dp, t:1, duration:480000, ease:'Linear',
                    onUpdate:()=>{ if(this.canInteract) cam.scrollY=newBase+dp.t*(this.H*0.14); },
                });
            },
        });
    }

    showWaitingTexts(c, onComplete) {
        if (this._textPlayer) { this._textPlayer.destroy(); this._textPlayer=null; }
        const texts=constellationTexts[c.id];
        const lines=(texts&&texts.waiting&&texts.waiting.length)?texts.waiting:null;
        if (!lines) { if (onComplete) onComplete(); return; }
        this._textPlayer = new ScrollingTextPlayer({
            lines,
            getMoonPhase:      () => this.moonPhase,
            onComplete:        onComplete || (() => {}),
            bottomClearancePx: this._stpClearance(),
        });
        this._textPlayer.start();
    }

    hideWaitingTexts(onComplete) {
        if (this._textPlayer) { this._textPlayer.destroy(); this._textPlayer=null; }
        if (onComplete) onComplete();
    }

    startSequencePulse() {
        if (this.pulseTimer) { this.pulseTimer.remove(); this.pulseTimer=null; }
        this.pulseIdx=0; this._interactionStarted=true; this.canInteract=true;
        this._updateDusk();
        this.showWaitingTexts(this.constellations[this.currentIndex], ()=>{});
        this.runPulseStep();
    }

    runPulseStep() {
        const c=this.constellations[this.currentIndex];
        if (!c||c.completed||!this.canInteract) return;
        const seq=this.getStarSeq(c); if (!seq.length) return;
        const star=c.stars[seq[this.pulseIdx%seq.length]]; if (!star) return;
        this.tweens.killTweensOf(star);
        this.tweens.add({ targets:star, brightness:2.4, duration:300, ease:'Sine.easeOut', yoyo:true,
            onComplete:()=>{star.brightness=1;} });
        this.pulseIdx++;
        const atEnd=this.pulseIdx%seq.length===0;
        this.pulseTimer=this.time.delayedCall(atEnd?1800:500,()=>this.runPulseStep());
    }

    getStarSeq(c) {
        const pending=c.connections.filter(cn=>!cn.completed); if (!pending.length) return [];
        const seen=new Set(), seq=[];
        for (const cn of pending) {
            if (!seen.has(cn.from)){seen.add(cn.from);seq.push(cn.from);}
            if (!seen.has(cn.to))  {seen.add(cn.to);  seq.push(cn.to);  }
        }
        return seq;
    }

    hitR() { return Math.min(this.W,this.H)*0.09; }

    screenToRotated(sx,sy) {
        const cx=this.W/2, cy=this.H*0.28;
        const rad=Phaser.Math.DegToRad(this.spinAngle||0);
        const cos=Math.cos(rad), sin=Math.sin(rad), dx=sx-cx, dy=sy-cy;
        return { x:cx+dx*cos+dy*sin, y:cy-dx*sin+dy*cos };
    }

    onPointerDown(pointer) {
        _requestFullscreen(); _unlockAudio();
        if (!this.canInteract) return;
        const c=this.constellations[this.currentIndex]; if (!c||c.completed) return;
        const hr2=this.hitR()**2;
        for (const star of c.stars) {
            const dx=pointer.worldX-star.wx, dy=pointer.worldY-star.wy;
            if (dx*dx+dy*dy<hr2) {
                this.isDrawing=true; this.strokeHits=[star];
                this.smoothX=pointer.x; this.smoothY=pointer.y;
                this.trailPts=[this.screenToRotated(pointer.x,pointer.y)];
                star.lit=true; this.tweens.killTweensOf(star); star.brightness=2.0;
                this.spawnRipple(star.wx,star.wy); this._setBgWheelPaused(true); break;
            }
        }
    }

    onPointerMove(pointer) {
        if (!this.isDrawing) return;
        this.smoothX+=(pointer.x-this.smoothX)*TRAIL_SMOOTH;
        this.smoothY+=(pointer.y-this.smoothY)*TRAIL_SMOOTH;
        const last=this.trailPts[this.trailPts.length-1];
        const rp=this.screenToRotated(this.smoothX,this.smoothY);
        if ((rp.x-last.x)**2+(rp.y-last.y)**2>=2) {
            this.trailPts.push(rp);
            if (this.trailPts.length>TRAIL_MAX) this.trailPts.shift();
        }
        const c=this.constellations[this.currentIndex]; if (!c) return;
        const hr2=this.hitR()**2;
        for (const star of c.stars) {
            if (star.lit) continue;
            const dx=pointer.worldX-star.wx, dy=pointer.worldY-star.wy;
            if (dx*dx+dy*dy<hr2) {
                star.lit=true; this.strokeHits.push(star);
                this.tweens.killTweensOf(star); star.brightness=2.0; this.spawnRipple(star.wx,star.wy);
                if (this.strokeHits.length>=2) {
                    const prev=this.strokeHits[this.strokeHits.length-2], a=prev.index, b=star.index;
                    if (c.connections.find(cn=>!cn.completed&&((cn.from===a&&cn.to===b)||(cn.from===b&&cn.to===a))))
                        this._playConnectionChime();
                }
            }
        }
    }

    onPointerUp() {
        if (!this.isDrawing) return;
        this.isDrawing=false; this.trailPts=[]; this.trailG.clear();
        const c=this.constellations[this.currentIndex];
        if (c) this.evaluateStroke(c);
        for (const star of (c?c.stars:[])) {
            star.lit=false;
            if (!c||!c.completed) { this.tweens.killTweensOf(star); star.brightness=1; }
        }
        this.strokeHits=[];
    }

    evaluateStroke(c) {
        const hits=this.strokeHits.map(s=>s.index); if (hits.length<2){this.rejectStroke(c);return;}
        let anyMatched=false;
        for (let i=0;i<hits.length-1;i++) {
            const a=hits[i], b=hits[i+1];
            const conn=c.connections.find(cn=>!cn.completed&&((cn.from===a&&cn.to===b)||(cn.from===b&&cn.to===a)));
            if (conn){conn.completed=true;anyMatched=true;}
        }
        if (!anyMatched){this.rejectStroke(c);return;}
        if (c.connections.every(cn=>cn.completed)){
            const now2=this.time.now;
            for (const cn of c.connections) cn.completedAt=now2;
            this.onConstellationComplete(c);
        }
    }

    rejectStroke(c) {
        for (const star of c.stars) {
            this.tweens.killTweensOf(star);
            this.tweens.add({ targets:star, brightness:0.2, duration:200, ease:'Sine.easeInOut',
                yoyo:true, repeat:1, onComplete:()=>{star.brightness=1;} });
        }
    }

    onConstellationComplete(c) {
        c.completed=true; this.canInteract=false;
        if (this.pulseTimer) this.pulseTimer.remove();
        for (const star of c.stars){star.completed=true;this.tweens.killTweensOf(star);}
        this.playCompletionChord();
        if (c.id==='draoi') triggerMurmuration(this.audioContext);
        this.time.delayedCall(800,()=>this._showDarkImage(c.id));
        const texts=constellationTexts[c.id];
        const completion=texts&&texts.completion?texts.completion:[];
        this.hideWaitingTexts(()=>{
            if (!completion.length){this.time.delayedCall(600,()=>this.onAllComplete());return;}
            this.time.delayedCall(300,()=>{
                if (this._completionPlayer){this._completionPlayer.destroy();this._completionPlayer=null;}
                this._completionPlayer = new ScrollingTextPlayer({
                    lines:             completion,
                    getMoonPhase:      () => this.moonPhase,
                    bottomClearancePx: this._stpClearance(),
                    onComplete: () => {
                        this._completionPlayer=null;
                        this.time.delayedCall(200,()=>{
                            this.currentIndex++;
                            if (this.currentIndex<this.constellations.length){
                                this.panCameraTo(this.currentIndex,true);
                                this.time.delayedCall(800,()=>this.startSequencePulse());
                            } else { this.onAllComplete(); }
                        });
                    },
                });
                this._completionPlayer.start();
            });
        });
    }

    _destroyAllTextPlayers() {
        if (this._textPlayer)       {try{this._textPlayer.destroy();}catch(e){}       this._textPlayer=null;}
        if (this._completionPlayer) {try{this._completionPlayer.destroy();}catch(e){} this._completionPlayer=null;}
        document.querySelectorAll('[data-stp]').forEach(el=>el.remove());
        document.querySelectorAll('.stp-overlay,.stp-container,.scrolling-text-player').forEach(el=>el.remove());
    }

    onAllComplete() {
        this._destroyAllTextPlayers();
        this._stopAllAudio();
        this._closeSkipMenu();
        this.cameras.main.fadeOut(1800,10,5,40);
        this.cameras.main.once('camerafadeoutcomplete',()=>{
            this.shutdown();
            if (this._moonWidget){this._moonWidget.destroy();this._moonWidget=null;}
            if (this._onComplete) this._onComplete(this.moonPhase, this._frozenAmerginLine);
            const canvas=this.game.canvas;
            this.game.destroy(true); canvas.remove();
            const gc=document.getElementById('gameContainer');
            if (gc) gc.style.display='none';
        });
    }

    shutdown() {
        if (this._lyricInterval) clearInterval(this._lyricInterval);
        this._destroyAllTextPlayers();
        this._stopAllAudio();
        this._closeSkipMenu();
        if (this.moonOverlay)  {this.moonOverlay.remove();  this.moonOverlay=null;}
        if (this._duskEl)      {this._duskEl.remove();      this._duskEl=null;}
        if (this._menuPreview?.parentNode){this._menuPreview.remove();this._menuPreview=null;}
        if (this._shadowHillEl?.parentNode){this._shadowHillEl.remove();this._shadowHillEl=null;}
        this._hideDarkImage(true);
    }

    // ── Audio ─────────────────────────────────────────────────────────────────
    initAudio() {
        this.audioContext=null; this._masterGain=null; this._sfxGain=null;
        this._harpPlayer=null; this._harpStarted=false; this._harpSilentStarted=false;
    }

    _initAudioContext() {
        if (this.audioContext) return;
        try {
            const AC=window.AudioContext||window.webkitAudioContext;
            this.audioContext=new AC();
            this._masterGain=this.audioContext.createGain(); this._masterGain.gain.value=1.0;
            this._masterGain.connect(this.audioContext.destination);
            this._sfxGain=this.audioContext.createGain(); this._sfxGain.gain.value=0.6;
            this._sfxGain.connect(this._masterGain);
        } catch(e){console.warn('[audio] _initAudioContext:',e);}
    }

    _getSfxRoot(i) {
        return [65.41,73.42,55.00,49.00,41.20,73.42,65.41,55.00,43.65,49.00,73.42][Math.min(i,10)];
    }

  async _startHarpOnSwipe() {
    if (this._harpSilentStarted) return;
    this._harpSilentStarted = true;
    this._harpStarted = true;
    try {
        // Stop prewarmed champion theme
        if (_prewarmedPlayer) {
            try { await _prewarmedPlayer.stop(); } catch(e) {}
            _prewarmedPlayer = null;
        }

        const player = new TradSessionPlayer();
        allTunes['myLaganLove'] = levelTunes.myLaganLove;

        const loaded = await player.loadTune('myLaganLove');
        if (!loaded) { console.warn('[audio] Harp load failed'); return; }

        if (player.tracks[1]) { player.tracks[1].gain.gain.value = 0; player.tracks[1].active = false; }
        if (player.tracks[2]) { player.tracks[2].gain.gain.value = 0; player.tracks[2].active = false; }

        player.engine.masterGain.gain.value = 0.0001;
        this._harpPlayer = player;
        await player.play();

        const ac = player.audioContext;
        if (ac && ac.state === 'suspended') await ac.resume();

        const mg = player.engine.masterGain, now = ac.currentTime;
        mg.gain.cancelScheduledValues(now);
        mg.gain.setValueAtTime(0.0001, now);
        mg.gain.exponentialRampToValueAtTime(0.85, now + 2.5);

    } catch(e) { console.warn('[audio] _startHarpOnSwipe error:', e); }
} 

    _stopAllAudio() {
        try{if(this._harpPlayer){this._harpPlayer.stop().catch(()=>{});this._harpPlayer=null;}}catch(e){}
    }

    playCompletionChord() {
        const ac=this.audioContext; if (!ac||!this._sfxGain) return;
        try {
            if (ac.state==='suspended') ac.resume();
            const now=ac.currentTime, chordAt=now+0.15, root=this._getSfxRoot(this.currentIndex);
            const mg=ac.createGain(); mg.connect(this._sfxGain);
            mg.gain.setValueAtTime(0.45,chordAt); mg.gain.exponentialRampToValueAtTime(0.001,chordAt+6.0);
            const del=ac.createDelay(0.8); del.delayTime.value=0.32;
            const dg=ac.createGain(); dg.gain.value=0.18; mg.connect(del); del.connect(dg); dg.connect(mg);
            [[1,0],[1.5,1],[2,2],[2.381,3],[3,4],[4,5]].forEach(([ratio,i])=>{
                const freq=root*ratio, s=chordAt+i*0.07, g=ac.createGain(); g.connect(mg);
                const o1=ac.createOscillator(); o1.type='triangle'; o1.frequency.value=freq; o1.connect(g);
                const o2=ac.createOscillator(); o2.type='sine'; o2.frequency.value=freq;
                const g2=ac.createGain(); g2.gain.value=0.4; o2.connect(g2); g2.connect(g);
                g.gain.setValueAtTime(0,s); g.gain.linearRampToValueAtTime(0.9,s+0.015);
                g.gain.exponentialRampToValueAtTime(0.001,s+5.5);
                o1.start(s);o1.stop(s+5.6); o2.start(s);o2.stop(s+5.6);
            });
        } catch(e){console.warn('[audio] playCompletionChord:',e);}
    }

    _playConnectionChime() {
        const ac=this.audioContext; if (!ac||!this._sfxGain) return;
        try {
            if (ac.state==='suspended') ac.resume();
            const root=this._getSfxRoot(this.currentIndex||0);
            this._chimeIndex=((this._chimeIndex||0)+1)%4;
            const freq=root*[2,3,4,2.381][this._chimeIndex]*2, now=ac.currentTime;
            const g=ac.createGain(); g.connect(this._sfxGain);
            const o1=ac.createOscillator(); o1.type='sine'; o1.frequency.value=freq; o1.connect(g);
            const o2=ac.createOscillator(); o2.type='sine'; o2.frequency.value=freq*2.756;
            const g2=ac.createGain(); g2.gain.value=0.15; o2.connect(g2); g2.connect(g);
            g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(0.5,now+0.008);
            g.gain.exponentialRampToValueAtTime(0.001,now+1.8);
            o1.start(now);o1.stop(now+1.9); o2.start(now);o2.stop(now+1.9);
        } catch(e){console.warn('[audio] _playConnectionChime:',e);}
    }

    _setBgWheelPaused(paused) {
        if (paused&&!this._interactionStarted) return;
        this._bgWheelsPaused=paused;
    }

    spawnRipple(wx,wy){this.ripples.push({wx,wy,startTime:this.time.now});}

    drawScene() {
        this.worldG.clear();
        const now=this.time.now, camX=this.cameras.main.scrollX, camY=this.cameras.main.scrollY;
        const cullD=Math.max(this.W,this.H)*1.5;

        for (const c of this.constellations) {
            if (Math.hypot(c.wcx-(camX+this.W/2),c.wcy-(camY+this.H/2))>cullD) continue;
            const isActive=this.constellations[this.currentIndex]===c&&!c.completed;
            for (const conn of c.connections) {
                if (!conn.completed) continue;
                const a=c.stars[conn.from], b=c.stars[conn.to];
                let alpha, width;
                if (conn.completedAt===null||!conn.panStartTime){alpha=0.92;width=2.5;}
                else {
                    const age=now-conn.panStartTime, t=Math.min(age/LINE_LINGER_MS,1);
                    const ease=t<0.7?1:1-((t-0.7)/0.3)**2;
                    alpha=0.12+ease*0.80; width=0.7+ease*1.8;
                }
                this.worldG.lineStyle(width*3,0x99ccff,alpha*0.18); this.worldG.lineBetween(a.wx,a.wy,b.wx,b.wy);
                this.worldG.lineStyle(width,0xddeeff,alpha);         this.worldG.lineBetween(a.wx,a.wy,b.wx,b.wy);
            }
            for (const star of c.stars) {
                if (star.completed)  {this.worldG.fillStyle(0x8899aa,0.15);this.worldG.fillCircle(star.wx,star.wy,1.2);}
                else if (isActive)   {this.drawActiveStar(star.wx,star.wy,star.brightness);}
                else                 {this.worldG.fillStyle(0x6677aa,0.20);this.worldG.fillCircle(star.wx,star.wy,1.8);}
            }
        }

        this.rippleG.clear();
        this.ripples=this.ripples.filter(rp=>{
            const t=(now-rp.startTime)/RIPPLE_MS; if(t>=1)return false;
            const ease=1-(1-t)**2, r=RIPPLE_MAX_R*ease, alpha=RIPPLE_ALPHA*(1-t);
            this.rippleG.lineStyle(4,0x99ddff,alpha*0.28); this.rippleG.strokeCircle(rp.wx,rp.wy,r*1.18);
            this.rippleG.lineStyle(1.5,0xddeeff,alpha);    this.rippleG.strokeCircle(rp.wx,rp.wy,r);
            return true;
        });

        if (this.isDrawing&&this.trailPts.length>=2) {
            this.trailG.clear();
            const pts=this.trailPts, n=pts.length, smooth=[pts[0]];
            for (let i=1;i<n;i++) {
                const p0=pts[Math.max(i-2,0)],p1=pts[i-1],p2=pts[i],p3=pts[Math.min(i+1,n-1)];
                smooth.push({x:0.5*(p1.x+p2.x)+0.125*(-p0.x+p1.x-p2.x+p3.x),y:0.5*(p1.y+p2.y)+0.125*(-p0.y+p1.y-p2.y+p3.y)});
                smooth.push(p2);
            }
            for (let i=1;i<smooth.length;i++) {
                const t=i/(smooth.length-1),t2=t*t,p1=smooth[i-1],p2=smooth[i];
                if(t2*14>0.3){this.trailG.lineStyle(14*t2,0x99ccff,0.08*t);this.trailG.lineBetween(p1.x,p1.y,p2.x,p2.y);}
                if(t2*4>0.3) {this.trailG.lineStyle(4*t2, 0xddeeff,0.35*t);this.trailG.lineBetween(p1.x,p1.y,p2.x,p2.y);}
                this.trailG.lineStyle(t,0xffffff,0.9*t); this.trailG.lineBetween(p1.x,p1.y,p2.x,p2.y);
            }
        }
    }

    drawActiveStar(wx,wy,br) {
        const cl=Math.min(br,2.5),coreR=2.0+cl*0.85,spike=coreR*(3.0+cl*0.8);
        const alpha=0.6+Math.min(cl-1,1)*0.4,sw=Math.max(0.7,cl*0.5);
        this.worldG.fillStyle(0xbbddff,alpha*0.14); this.worldG.fillCircle(wx,wy,coreR*3.5);
        this.worldG.lineStyle(sw,0xffffff,alpha*0.5);
        this.worldG.lineBetween(wx-spike,wy,wx+spike,wy); this.worldG.lineBetween(wx,wy-spike,wx,wy+spike);
        this.worldG.fillStyle(0xffffff,alpha); this.worldG.fillCircle(wx,wy,coreR);
    }

    update(time, delta) { this.updateSpin(delta); this.drawScene(); }
}

