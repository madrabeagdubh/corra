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

// Inject level tunes into allTunes so TradSessionPlayer can find them
allTunes['myLaganLove'] = levelTunes.myLaganLove;

// ── Module-level: runs immediately on import, same as introModal ─────────────

var _audioUnlocked   = false;
var _fullscreenDone  = false;

// Warm up the ABC music parser so first playback has no stutter
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

// Preload hero-select assets in the background while the constellation scene plays
var _preloadedAssets = { spriteSheet: null, atlasData: null, validChampions: null, firstChampionCanvas: null, randomStartIndex: null };

var _prewarmedPlayer = null;

var _heroAssetsReady = (function preloadHeroSelectAssets() {
    const img = new Image();
    img.src   = 'assets/champions/champions-with-kit.png';
    return new Promise((resolve, reject) => {
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
                        const cv  = document.createElement('canvas');
                        cv.width  = fd.frame.w; cv.height = fd.frame.h;
                        cv.getContext('2d').drawImage(img, fd.frame.x, fd.frame.y, fd.frame.w, fd.frame.h, 0, 0, fd.frame.w, fd.frame.h);
                        _preloadedAssets.firstChampionCanvas = cv;
                    }

                    // Pre-warm the music player for the first champion
                    try {
                        const tuneKey = getTuneKeyForChampion(champ);
                        if (tuneKey) {
                            _prewarmedPlayer = new TradSessionPlayer();
                            _prewarmedPlayer.loadTune(tuneKey); // fire and forget
                            console.log('[ConstellationScene] Pre-warming music for:', champ.nameEn, tuneKey);
                        }
                    } catch(e) {
                        console.warn('[ConstellationScene] Music pre-warm failed (non-critical):', e);
                    }

                    resolve();
                })
                .catch(e => { console.warn('[ConstellationScene] Asset preload failed:', e); resolve(); });
        };
        img.onerror = () => resolve(); // non-fatal
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
            _fullscreenDone = true;
            return;
        }
        if (el.requestFullscreen) {
            el.requestFullscreen().then(() => { _fullscreenDone = true; }).catch(() => {});
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
            _fullscreenDone = true;
        } else if (el.msRequestFullscreen) {
            el.msRequestFullscreen();
            _fullscreenDone = true;
        }
    } catch (e) { console.warn('[ConstellationScene] Fullscreen:', e); }
}

/**
 * Drop-in replacement for initIntroModal(onComplete).
 * Creates a Phaser game running just the ConstellationScene.
 * onComplete(moonPhase, frozenAmerginLine) is called after all constellations are drawn.
 */
var _sceneInitialized = false;

export function initConstellationScene(onComplete) {
    if (_sceneInitialized) return;
    _sceneInitialized = true;
    _fullscreenDone = false;

    // Load the font before Phaser boots, mirroring introModal's loadFont()
    document.fonts.load('1.8rem Urchlo').catch(() => {});

    const game = new Phaser.Game({
        type:            Phaser.AUTO,
        width:           window.innerWidth,
        height:          window.innerHeight,
        backgroundColor: '#00060f',
        parent:          'gameContainer',
        scene:           [ConstellationScene],
        scale: {
            mode:       Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        input: { touch: true },
    });

    game.registry.set('onComplete', onComplete);
    return game;
}

const CONSTELLATION_DATA = [
    // ── Cú na Féinne - The Hound of the Fianna (Orion) ─────────────────────
    {
        id: 'cu',
        starOffsets: [
            { lx:  -0.79, ly:  -1.38 },
            { lx:   0.44, ly:  -1.21 },
            { lx:   0.17, ly:  -0.13 },
            { lx:  -0.00, ly:   0.02 },
            { lx:  -0.20, ly:   0.14 },
            { lx:   0.88, ly:   1.16 },
            { lx:  -0.49, ly:   1.40 },
        ],
        connections: [
            { from: 0, to: 2 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 },
            { from: 4, to: 6 }, { from: 2, to: 5 },
        ],
    },

    // ── An Naomhóg - The Currach (Cassiopeia) ──────────────────────────────
    {
        id: 'naomhog',
        starOffsets: [
            { lx:   1.37, ly:  -0.10 },
            { lx:   0.55, ly:   0.37 },
            { lx:   0.13, ly:  -0.07 },
            { lx:  -0.64, ly:  -0.02 },
            { lx:  -1.40, ly:  -0.38 },
        ],
        connections: [
            { from: 0, to: 1 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 },
        ],
    },

    // ── An Carr Mór - The Great Chariot / Plough (Ursa Major) ───────────────
    {
        id: 'carr',
        starOffsets: [
            { lx:   1.23, ly:  -0.40 },
            { lx:   1.25, ly:  -0.05 },
            { lx:   0.42, ly:   0.12 },
            { lx:   0.07, ly:  -0.09 },
            { lx:  -0.54, ly:  -0.02 },
            { lx:  -1.02, ly:   0.04 },
            { lx:  -1.40, ly:   0.40 },
        ],
        connections: [
            { from: 0, to: 1 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 0 },
            { from: 3, to: 4 }, { from: 4, to: 5 }, { from: 5, to: 6 },
        ],
    },

    // ── An Torc - The Wild Boar (Scorpius) ──────────────────────────────────
    {
        id: 'torc',
        starOffsets: [
            { lx:   1.14, ly:  -1.40 },
            { lx:   1.27, ly:  -1.11 },
            { lx:   0.53, ly:  -0.73 },
            { lx:  -0.00, ly:   0.07 },
            { lx:  -0.10, ly:   0.89 },
            { lx:  -0.55, ly:   0.98 },
            { lx:  -1.10, ly:   0.35 },
            { lx:  -1.19, ly:   0.95 },
        ],
        connections: [
            { from: 0, to: 2 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 },
            { from: 4, to: 5 }, { from: 5, to: 6 },
            { from: 5, to: 7 },
        ],
    },

    // ── Cúirt Fhomhóir - The Court of Fomor (Corona Borealis) ───────────────
    {
        id: 'cuirt',
        starOffsets: [
            { lx:  -1.30, ly:   0.40 },
            { lx:  -0.85, ly:  -0.55 },
            { lx:  -0.30, ly:  -1.10 },
            { lx:   0.00, ly:  -1.35 },
            { lx:   0.30, ly:  -1.10 },
            { lx:   0.85, ly:  -0.55 },
            { lx:   1.30, ly:   0.40 },
        ],
        connections: [
            { from: 0, to: 1 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 },
            { from: 4, to: 5 }, { from: 5, to: 6 },
        ],
    },

    // ── An Draoi - The Druid (Boötes) ───────────────────────────────────────
    {
        id: 'draoi',
        starOffsets: [
            { lx:   0.42, ly:   1.13 },
            { lx:   1.05, ly:   1.23 },
            { lx:  -0.46, ly:   0.19 },
            { lx:  -0.06, ly:  -1.15 },
            { lx:  -0.96, ly:  -1.40 },
        ],
        connections: [
            { from: 0, to: 1 }, { from: 0, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 },
        ],
    },

    // ── Cláirseach na Spéire - The Harp of Heaven (Lyra) ────────────────────
    {
        id: 'clairseach',
        starOffsets: [
            { lx:   1.31, ly:  -1.28 },
            { lx:   0.45, ly:  -0.77 },
            { lx:  -0.08, ly:   1.10 },
            { lx:  -1.07, ly:   1.40 },
            { lx:  -0.61, ly:  -0.45 },
        ],
        connections: [
            { from: 0, to: 1 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 },
            { from: 4, to: 1 },
        ],
    },

    // ── An Laoch - The Hero / Warrior (Perseus) ──────────────────────────────
    {
        id: 'laoch',
        starOffsets: [
            { lx:   0.78, ly:  -1.45 },
            { lx:   0.21, ly:  -1.03 },
            { lx:  -0.33, ly:  -0.79 },
            { lx:   0.71, ly:   0.00 },
            { lx:  -0.74, ly:   0.11 },
            { lx:  -0.64, ly:   1.05 },
        ],
        connections: [
            { from: 0, to: 1 }, { from: 1, to: 2 },
            { from: 1, to: 3 },
            { from: 2, to: 4 }, { from: 4, to: 5 },
        ],
    },
];

const SPIRAL_A    = 550;
const SPIRAL_B    = 0.9;
const SPIRAL_STEP = 1.45;

const TRAIL_SMOOTH  = 0.28;
const TRAIL_MAX     = 70;

const LINE_LINGER_MS = 7600;

const RIPPLE_MS    = 900;
const RIPPLE_MAX_R = 55;
const RIPPLE_ALPHA = 0.75;

const AMERGIN_LINES = [
    { ga: 'Cé an té le nod slí na gcloch sléibhe?', en: 'Who knows the way of the mountain stones?' },
    { ga: 'Cé gair aois na gealaí?',                en: 'Who foretells the ages of the moon?' },
    { ga: 'Cá dú dul faoi na gréine?',              en: 'Who knows where the sun rests?' },
    { ga: 'Cé beir buar ó thigh Teathra?',          en: 'Who can raid the house of Teathra?' },
    { ga: 'Cé buar Teathra le gean?',               en: 'Who can charm the sunless king?' },
];

// ── DOM attribute used to tag all ScrollingTextPlayer root elements ───────────
// scrollingTextPlayer.js should set this on its root el; we also query it here
// as a fallback nuclear cleanup.
const STP_ATTR = 'data-stp';

export class ConstellationScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ConstellationScene' });
        this.currentIndex = 0;
        this.canInteract  = false;

        this.isDrawing  = false;
        this.strokeHits = [];
        this.trailPts   = [];
        this.smoothX    = 0;
        this.smoothY    = 0;

        this.audioContext = null;
        this.lastNoteTime = 0;
        this.noteDebounce = 130;

        this.worldG  = null;
        this.trailG  = null;
        this.ripples = [];
        this.constellations = [];
        this.pulseTimer   = null;
        this.pulseIdx     = 0;
        this.worldCX = 0;
        this.worldCY = 0;

        this.moonPhase = 0;
        this.moonCanvas      = null;
        this.moonOverlay     = null;
        this.moonEl          = null;
        this.englishEl       = null;
        this.irishOverlayEl  = null;
        this.moonInitDone    = false;
        this.spinAngle       = 0;

        // ── Text players ──────────────────────────────────────────────────────
        // _textPlayer      = current waiting-text player
        // _completionPlayer = current completion-text player (was previously a
        //                     local variable in onConstellationComplete — the
        //                     source of the heroSelect DOM bleed bug)
        this._textPlayer       = null;
        this._completionPlayer = null;

        // ── Audio state ───────────────────────────────────────────────────────
        this._harpStarted      = false;

        // ── Dusk gradient ─────────────────────────────────────────────────────
        this._duskEl           = null;

        // ── Dark mythos image overlay ─────────────────────────────────────────
        this._darkImage        = null;
        this._darkImageEl      = null;

        // ── Moon skip state ───────────────────────────────────────────────────
        this._moonSkipTriggered    = false;
        this._moonVerticalDragging = false;
        this._skipHintEl           = null;
        this._skipHintVisible      = false;
        this._skipHintAutoTimer    = null;

        // ── Moon slide hint (pre-interaction arrow) ───────────────────────────
        this._moonHintEl           = null;
        this._moonHintTimer        = null;
        this._moonHintCancelled    = false;
    }

    get W() { return this.scale.width; }
    get H() { return this.scale.height; }

    preload(){
        this.load.image('shadowHill', './assets/shadowHill.png');
        // Dark mythos images - fade in after constellation drawn, out on spin away
        this.load.image('naomhog', './assets/naomhog.png');
        this.load.image('cuirt',   './assets/cuirt.png');
    }

    create() {
        this.initAudio();
        this._onComplete = this.registry.get('onComplete') || null;
        this._frozenAmerginLine = null;

        this.cameras.main.setBackgroundColor('#00060f');

        const wSize  = 5000;
        this.worldCX = wSize / 2;
        this.worldCY = wSize / 2;
        this.cameras.main.setBounds(0, 0, wSize, wSize);

        this.drawStaticBackground(wSize);
        this.drawNebula(wSize);

        this.worldG  = this.add.graphics().setDepth(10);
        this.rippleG = this.add.graphics().setDepth(11);
        this.trailG  = this.add.graphics().setScrollFactor(0).setDepth(13);

        this.uiCamera = this.cameras.add(0, 0, this.W, this.H)
            .setName('ui')
            .setBackgroundColor('rgba(0,0,0,0)');
        this.uiCamera.ignore(this.children.list.filter(obj => obj.depth !== 22));
        this.cameras.main.ignore(this.children.list.filter(obj => obj.depth === 22));

        this.buildConstellations(wSize);
        const c0 = this.constellations[0];
        this.cameras.main.setScroll(c0.wcx - this.W / 2, c0.wcy - this.H / 2 - this.H * 0.38);

        this.worldG.setAlpha(0);

        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup',   this.onPointerUp,   this);

        const fsHandler = () => {
            _requestFullscreen();
            _unlockAudio();
            this.game.canvas.removeEventListener('pointerdown', fsHandler);
            this.game.canvas.removeEventListener('touchstart',  fsHandler);
        };
        this.game.canvas.addEventListener('pointerdown', fsHandler, { once: true, passive: true });
        this.game.canvas.addEventListener('touchstart',  fsHandler, { once: true, passive: true });

        this.buildMoonOverlay();

        const { width, height } = this.scale;
        if (this.textures.exists('shadowHill')) {
            this.shadowHill = this.add.image(0, 0, 'shadowHill')
                .setScrollFactor(0)
                .setOrigin(0, 1)
                .setPosition(0, height)
                .setScale(0.8)
                .setDepth(23);
            this.cameras.main.ignore(this.shadowHill);
        }

        this.scale.on('resize', (gameSize) => {
            if (this.shadowHill) {
                this.shadowHill.setPosition(0, gameSize.height);
            }
            if (this._duskEl) {
                this._duskEl.style.height = Math.round(gameSize.height * 0.20) + 'px';
            }
            this._updateDusk();
        });

        // ── Dusk atmospheric gradient ─────────────────────────────────────────
        this._duskEl = document.createElement('div');
        this._duskEl.style.cssText = [
            'position:fixed;left:0;right:0;bottom:0;',
            `height:${Math.round(this.H * 0.20)}px;`,
            'pointer-events:none;',
            'z-index:99994;',
            'opacity:0;',
            'transition:background 1.8s ease, opacity 0.6s ease;',
        ].join('');
        document.body.appendChild(this._duskEl);
        this._drawDuskGradient(0);
    }

    // ── Dusk gradient ─────────────────────────────────────────────────────────
    _drawDuskGradient(progress) {
        const el = this._duskEl;
        if (!el) return;
        const t = Math.max(0, Math.min(1, progress));

        const botR = Math.round(Phaser.Math.Linear(140,  40, t));
        const botG = Math.round(Phaser.Math.Linear(170,  20, t));
        const botB = Math.round(Phaser.Math.Linear(210,  80, t));
        const botA = Phaser.Math.Linear(0.28, 0.14, t);

        const topR = Math.round(Phaser.Math.Linear(60,  20, t));
        const topG = Math.round(Phaser.Math.Linear(30,   5, t));
        const topB = Math.round(Phaser.Math.Linear(90,  40, t));
        const topA = 0.0;

        el.style.background = [
            `linear-gradient(to bottom,`,
            `  rgba(${topR},${topG},${topB},${topA}) 0%,`,
            `  rgba(${botR},${botG},${botB},${botA}) 100%)`,
        ].join('');

        if (el.style.opacity === '0') el.style.opacity = '1';
    }

    _updateDusk() {
        const total = this.constellations.length;
        const prog  = total > 1 ? this.currentIndex / (total - 1) : 0;
        this._drawDuskGradient(prog);
    }

    // ── Dark mythos image ─────────────────────────────────────────────────────
    _showDarkImage(constellationId) {
        this._hideDarkImage(true);

        const W = this.W, H = this.H;

        const el = document.createElement('img');
        el.src = `assets/stars/${constellationId}.png`;
        el.onerror = () => { el.src = 'assets/sc01.png'; };

        el.style.cssText = [
            'position:fixed;',
            'width:auto;',
            `max-height:${Math.round(H * 0.50)}px;`,
            `max-width:${Math.round(W * 0.70)}px;`,
            'left:50%;top:45%;',
            'transform:translate(-50%,-50%) scale(2);',
            'pointer-events:none;',
            'z-index:99993;',
            'opacity:0;',
            'transition:opacity 2.2s ease-in;',
            'mix-blend-mode:screen;',
        ].join('');
        document.body.appendChild(el);
        this._darkImageEl = el;
        this._darkImage   = true;

        requestAnimationFrame(() => { if (el.parentNode) el.style.opacity = '0.65'; });
    }

    _hideDarkImage(immediate = false) {
        const el = this._darkImageEl;
        if (!el) return;
        this._darkImageEl = null;
        this._darkImage   = null;
        if (immediate) { el.remove(); return; }
        el.style.transition = 'opacity 0.9s ease-out';
        el.style.opacity    = '0';
        setTimeout(() => el.remove(), 950);
    }

    // ── Moon overlay ──────────────────────────────────────────────────────────
    buildMoonOverlay() {
        const W = this.W, H = this.H;
        const moonR   = Math.round(H * 0.025);
        const moonD   = moonR * 2;
        const marginX = Math.round(W * 0.06);
        const trackW  = W - marginX * 2;

        const arcStartX = marginX;
        const arcStartY = Math.round(H * 0.32);
        const trackY    = Math.round(H * 0.04);

        const getArcY = (clientX) => {
            const t        = Math.max(0, Math.min(1, (clientX - marginX) / trackW));
            const sineArch = Math.sin(t * Math.PI);
            return arcStartY - (H * 0.15) * sineArch;
        };

        let currentLyricIndex = Math.floor(Math.random() * AMERGIN_LINES.length);
        let line              = AMERGIN_LINES[currentLyricIndex];
        let hasInteracted     = false;

        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:fixed;inset:0;z-index:99999;',
            'pointer-events:none;',
        ].join('');
        this.moonOverlay = overlay;

        const irishEl = document.createElement('div');
        irishEl.textContent = line.ga;
        irishEl.style.cssText = [
            `font-family:${FONTS.irish};`,
            `font-size:${TYPE.domBody.size};`,
            `color:${COLORS.irish};text-align:center;`,
            'text-shadow:0 0 18px rgba(0,0,0,0.9);',
            'padding:0 6%;',
            'pointer-events:none;',
            'opacity:1;transition:opacity 0.8s ease-in-out;',
            'position:absolute;',
            `top:${Math.round(H * 0.1)}px;`,
            'left:0;right:0;',
        ].join('');
        this.irishOverlayEl = irishEl;

        const enEl = document.createElement('div');
        enEl.textContent = line.en;
        enEl.style.cssText = [
            `font-family:${FONTS.english};`,
            `font-size:${TYPE.domBodyEn.size};`,
            `color:${COLORS.druid};text-align:center;`,
            'text-shadow:0 0 12px rgba(0,0,0,0.9);',
            'padding:0 6%;',
            'pointer-events:none;',
            'opacity:0.05;transition:opacity 0.5s ease;',
            'position:absolute;',
            `top:${Math.round(H * 0.2)}px;`,
            'left:0;right:0;',
        ].join('');
        this.englishEl = enEl;

        const lyricInterval = setInterval(() => {
            if (hasInteracted) return;
            currentLyricIndex = (currentLyricIndex + 1) % AMERGIN_LINES.length;
            line = AMERGIN_LINES[currentLyricIndex];
            irishEl.style.opacity = '0';
            enEl.style.opacity    = '0';
            setTimeout(() => {
                irishEl.textContent = line.ga;
                enEl.textContent    = line.en;
                irishEl.style.opacity = '1';
                enEl.style.opacity    = String(this.moonPhase || 0.05);
            }, 800);
        }, 10000);
        this._lyricInterval = lyricInterval;

        // ── Moon canvas ───────────────────────────────────────────────────────
        const moonCanvas = document.createElement('canvas');
        moonCanvas.width  = moonD;
        moonCanvas.height = moonD;
        moonCanvas.style.cssText = [
            `width:${moonD}px;height:${moonD}px;`,
            'cursor:grab;touch-action:none;',
            'pointer-events:all;',
            'position:fixed;',
            'z-index:99997;',
            `left:${arcStartX - moonR}px;`,
            `top:${arcStartY - moonR}px;`,
            // No animation here — we add the ring pulse via canvas draw instead
        ].join('');
        this.moonEl     = moonCanvas;
        this.moonCanvas = moonCanvas;
        this._moonR     = moonR;
        this._marginX   = marginX;

        // ── Keyframe for ring pulse only (no translate/scale invite) ─────────
        const style = document.createElement('style');
        style.id = 'moon-style';
        style.textContent = `
            @keyframes moonRingPulse {
                0%   { opacity: 0.55; }
                50%  { opacity: 1.0; }
                100% { opacity: 0.55; }
            }
        `;
        document.head.appendChild(style);
        this._moonStyle = style;

        this.drawMoonPhase(0);

        overlay.appendChild(irishEl);
        overlay.appendChild(enEl);
        document.body.appendChild(overlay);
        document.body.appendChild(moonCanvas);

        // ── Slide-right hint arrow — appears after 4 s idle ──────────────────
        this._scheduleMoonHint(arcStartX, arcStartY, moonR, marginX, trackW, W, H);

        // ── Drag logic ────────────────────────────────────────────────────────
        let dragging         = false;
        let dragStartX       = 0;
        let phaseAtDragStart = 0;
        let arcDone          = false;

        const cancelHint = () => {
            if (this._moonHintCancelled) return;
            this._moonHintCancelled = true;
            if (this._moonHintTimer) { clearTimeout(this._moonHintTimer); this._moonHintTimer = null; }
            this._hideMoonHint();
        };

        const onDragStart = (clientX, clientY) => {
            _requestFullscreen();
            _unlockAudio();

            cancelHint();

            if (!hasInteracted) {
                hasInteracted = true;
                clearInterval(lyricInterval);
                this._frozenAmerginLine = line;
            }

            dragging             = true;
            dragStartX           = clientX;
            phaseAtDragStart     = this.moonPhase;
            moonCanvas.style.cursor = 'grabbing';

            this._moonDragStartY = clientY;
            this._moonDragCurY   = clientY;
        };

        const onDragMove = (clientX, clientY) => {
            if (!dragging) return;

            if (clientY !== undefined) this._moonDragCurY = clientY;

            if (!arcDone) {
                const clampedX  = Math.max(marginX, Math.min(marginX + trackW, clientX));
                const curY      = getArcY(clampedX);
                moonCanvas.style.left = (clampedX - moonR) + 'px';
                moonCanvas.style.top  = (curY      - moonR) + 'px';

                const t = (clampedX - marginX) / trackW;
                this.moonPhase = Math.max(0, Math.min(1, t));
                this.drawMoonPhase(this.moonPhase);
                enEl.style.opacity = String(this.moonPhase);

                const targetAngle = this.moonPhase * 13;
                this.spinAngle = targetAngle;
                this.cameras.main.setAngle(targetAngle);

            } else {
                const delta    = (clientX - dragStartX) / trackW;
                const newPhase = Math.max(0, Math.min(1, phaseAtDragStart + delta));
                this.moonPhase = newPhase;
                this.drawMoonPhase(newPhase);
                enEl.style.opacity = String(newPhase);
                this.moonEl.style.left = (marginX + newPhase * trackW - moonR) + 'px';

                if (!this.moonInitDone) {
                    const targetAngle = newPhase * 13;
                    this.spinAngle = targetAngle;
                    this.cameras.main.setAngle(targetAngle);
                }
            }
        };

        const onDragEnd = () => {
            if (!dragging) return;
            dragging = false;
            moonCanvas.style.cursor = 'grab';

            if (!arcDone) {
                arcDone = true;

                const fromX = parseFloat(moonCanvas.style.left) + moonR;
                const fromY = parseFloat(moonCanvas.style.top)  + moonR;
                const toX   = marginX + this.moonPhase * trackW;
                const toY   = trackY;

                const floatStart = performance.now();
                const FLOAT_MS   = 4200;

                const floatLoop = (now) => {
                    const raw = Math.min((now - floatStart) / FLOAT_MS, 1);
                    const t   = 1 - Math.pow(1 - raw, 3);
                    moonCanvas.style.left = (fromX + (toX - fromX) * t - moonR) + 'px';
                    moonCanvas.style.top  = (fromY + (toY - fromY) * t - moonR) + 'px';
                    if (raw < 1) {
                        requestAnimationFrame(floatLoop);
                    } else {
                        moonCanvas.style.left = (toX - moonR) + 'px';
                        moonCanvas.style.top  = (toY - moonR) + 'px';
                        if (!this.moonInitDone) {
                            this.moonInitDone = true;
                            this.settleMoon(this.moonPhase);
                        }
                    }
                };
                requestAnimationFrame(floatLoop);

            } else {
                if (!this.moonInitDone) {
                    this.moonInitDone = true;
                    this.settleMoon(this.moonPhase);
                }
            }
        };

        moonCanvas.addEventListener('mousedown',  (e) => { e.preventDefault(); onDragStart(e.clientX, e.clientY); });
        window.addEventListener('mousemove',      (e) => { if (dragging) onDragMove(e.clientX, e.clientY); });
        window.addEventListener('mouseup',        ()  => { onDragEnd(); });
        moonCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); onDragStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
        window.addEventListener('touchmove',      (e) => { if (dragging) { e.preventDefault(); onDragMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
        window.addEventListener('touchend',       ()  => { onDragEnd(); });
    }

    // ── Moon slide-right hint ─────────────────────────────────────────────────
    // A dashed arrow that grows outward from the moon, tide-like.
    // Drawn on a canvas via rAF so the extension feels organic rather than
    // CSS-timed. One full grow-and-fade cycle, then repeats every 8 s.

    _scheduleMoonHint(moonX, moonY, moonR, marginX, trackW, W, H) {
        this._moonHintTimer = setTimeout(() => {
            if (this._moonHintCancelled) return;
            this._showMoonHint(moonX, moonY, moonR, marginX, trackW, W, H);
        }, 4000);
    }

    _showMoonHint(moonX, moonY, moonR, marginX, trackW, W, H) {
        if (this._moonHintCancelled) return;
        this._hideMoonHint(true);

        // ── Read the moon's LIVE position at fire time ────────────────────────
        let liveMoonLeft = moonX;
        let liveMoonTop  = moonY;
        if (this.moonEl) {
            liveMoonLeft = parseFloat(this.moonEl.style.left) || moonX;
            liveMoonTop  = parseFloat(this.moonEl.style.top)  || moonY;
        }
        // Right edge and vertical centre of the moon in fixed coords
        const moonRightX = liveMoonLeft + moonR * 2;  // left + diameter
        const moonCY     = liveMoonTop  + moonR;       // top + radius

        // ── Logical (CSS) dimensions ──────────────────────────────────────────
        // Arrow max length: 2.5× moon diameter. Height: just enough for chevron.
        const maxLen  = Math.round(moonR * 5);
        const headSz  = Math.round(moonR * 0.42);
        const cssW    = maxLen + headSz + 2;           // breathing room at tip
        const cssH    = Math.round(headSz * 2 + 4);   // snug around chevron arms
        const arrowY  = cssH / 2;                     // vertical centre of canvas

        // ── Device pixel ratio — makes strokes crisp on retina/HDPI ─────────
        const dpr = window.devicePixelRatio || 1;

        const cv = document.createElement('canvas');
        cv.width  = Math.round(cssW * dpr);   // backing buffer at full resolution
        cv.height = Math.round(cssH * dpr);
        cv.style.cssText = [
            'position:fixed;',
            'pointer-events:none;',
            'z-index:99996;',
            // Place canvas so its left edge is flush with the moon's right edge
            `left:${Math.round(moonRightX + 3)}px;`,
            `top:${Math.round(moonCY - cssH / 2)}px;`,
            // CSS size = logical size — DPR scaling is handled by ctx.scale below
            `width:${cssW}px;`,
            `height:${cssH}px;`,
        ].join('');
        document.body.appendChild(cv);
        this._moonHintEl = cv;

        const ctx = cv.getContext('2d');
        ctx.scale(dpr, dpr);  // all draw calls now in logical (CSS) pixels
        // Slow, dreamy cycle: 3.2 s grow, 2.0 s fade — total 5.2 s
        const GROW_MS  = 3200;
        const FADE_MS  = 2000;
        const TOTAL_MS = GROW_MS + FADE_MS;
        const DASH = 4, GAP = 6;

        let start = null;
        let alive = true;

        const draw = (now) => {
            if (!alive || !cv.parentNode) return;
            if (!start) start = now;

            const elapsed = now - start;
            const raw     = Math.min(elapsed / TOTAL_MS, 1);

            // Grow: very gentle ease-out — feels like it drifts outward
            const growT    = Math.min(elapsed / GROW_MS, 1);
            const growEase = 1 - Math.pow(1 - growT, 1.8);
            const lineLen  = growEase * maxLen;

            // Alpha: slow fade-in over first third of grow, hold, then fade over FADE_MS
            let alpha;
            if (elapsed < GROW_MS) {
                const riseT = Math.min(elapsed / (GROW_MS * 0.35), 1);
                alpha = riseT * riseT;
            } else {
                const fadeT = (elapsed - GROW_MS) / FADE_MS;
                // ease-in on the fade so it lingers longer before disappearing
                alpha = 1 - fadeT * fadeT;
            }
            alpha = Math.max(0, Math.min(1, alpha)) * 0.82; // keep it gentle — max ~82%

            ctx.clearRect(0, 0, cssW, cssH);

            if (lineLen > 2) {
                ctx.globalAlpha = alpha;
                // Lavender — soft, not saturated
                ctx.strokeStyle = 'rgba(200,180,255,1)';
                ctx.lineWidth   = 1.4;
                ctx.lineCap     = 'round';

                // Dashed line growing rightward
                ctx.beginPath();
                ctx.setLineDash([DASH, GAP]);
                ctx.moveTo(0, arrowY);
                ctx.lineTo(lineLen, arrowY);
                ctx.stroke();
                ctx.setLineDash([]);

                // Chevron arrowhead — fades in once line is visibly long
                if (lineLen > headSz * 2.5) {
                    const headAlpha = Math.min((lineLen - headSz * 2.5) / (headSz * 3), 1);
                    ctx.globalAlpha = alpha * headAlpha;
                    ctx.lineWidth   = 1.4;
                    ctx.beginPath();
                    ctx.moveTo(lineLen - headSz, arrowY - headSz * 0.65);
                    ctx.lineTo(lineLen,           arrowY);
                    ctx.lineTo(lineLen - headSz, arrowY + headSz * 0.65);
                    ctx.stroke();
                }

                ctx.globalAlpha = 1;
            }

            if (raw < 1) {
                requestAnimationFrame(draw);
            } else {
                alive = false;
                cv.remove();
                if (this._moonHintEl === cv) this._moonHintEl = null;
                if (!this._moonHintCancelled) {
                    this._moonHintTimer = setTimeout(() => {
                        if (!this._moonHintCancelled) {
                            this._showMoonHint(moonX, moonY, moonR, marginX, trackW, W, H);
                        }
                    }, 8000);
                }
            }
        };

        requestAnimationFrame(draw);
    }

    _hideMoonHint(immediate = false) {
        const el = this._moonHintEl;
        if (!el) return;
        this._moonHintEl = null;
        // Canvas has no CSS opacity transition; just remove it
        el.remove();
    }

    // ── Moon phase drawing ────────────────────────────────────────────────────
    // Ring replaces the radial glow: a crisp bright arc that pulses gently.
    drawMoonPhase(phase) {
        const canvas = this.moonCanvas;
        if (!canvas) return;
        const r   = this._moonR;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cx = r, cy = r;

        // ── Bright ring (replaces old glow) ───────────────────────────────────
        // Outer soft halo — very subtle, just to separate from background
        const halo = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.45);
        halo.addColorStop(0,   `rgba(210,225,255,${0.12 + phase * 0.10})`);
        halo.addColorStop(0.6, `rgba(180,200,255,${0.04 + phase * 0.04})`);
        halo.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2);
        ctx.fill();

        // Moon disc
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = '#1a2035';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#d8e8f8';
        ctx.beginPath();
        if (phase >= 0.99) {
            ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        } else {
            const terminatorX = r * 0.92 * Math.cos(phase * Math.PI);
            ctx.arc(cx, cy, r * 0.92, -Math.PI / 2, Math.PI / 2);
            ctx.ellipse(cx, cy, Math.abs(terminatorX), r * 0.92, 0, Math.PI / 2, -Math.PI / 2, terminatorX > 0);
        }
        ctx.fill();

        if (phase > 0.1) {
            const mare = (mx, my, mr, a) => {
                ctx.fillStyle = `rgba(160,180,210,${a * phase})`;
                ctx.beginPath();
                ctx.arc(cx + mx * r * 0.7, cy + my * r * 0.7, mr * r * 0.18, 0, Math.PI * 2);
                ctx.fill();
            };
            mare( 0.2, -0.3, 1.0, 0.18);
            mare(-0.3,  0.1, 0.7, 0.14);
            mare( 0.4,  0.35, 0.6, 0.12);
        }

        ctx.restore();

        // ── Crisp bright ring ─────────────────────────────────────────────────
        // Two rings: outer dim + inner bright, so it reads cleanly against dark sky.
        // Alpha scales slightly with phase so the ring feels like it's charging up.
        const ringAlpha = 0.55 + phase * 0.35;
        ctx.strokeStyle = `rgba(220,235,255,${ringAlpha * 0.3})`;
        ctx.lineWidth   = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.92 + 2.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(220,235,255,${ringAlpha})`;
        ctx.lineWidth   = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.92 + 0.8, 0, Math.PI * 2);
        ctx.stroke();
    }

    positionMoon(phase) {
        const W = this.W, H = this.H;
        const r = this._moonR, marginX = this._marginX;
        const moonD  = r * 2;
        const trackW = W - marginX * 2;
        const x = marginX + phase * trackW - r;
        const y = Math.round(H * 0.01);

        const el = this.moonEl;
        el.style.position = 'fixed';
        el.style.left     = x + 'px';
        el.style.top      = y + 'px';
        el.style.width    = moonD + 'px';
        el.style.height   = moonD + 'px';
    }

    // ── settleMoon ────────────────────────────────────────────────────────────
    settleMoon(phase) {
        if (!this._harpSilentStarted) {
            this._initAudioContext();
            this._startHarpOnSwipe();
        }
        const overlay = this.moonOverlay;
        const moonEl  = this.moonEl;
        const W = this.W, H = this.H;
        const r = this._moonR, marginX = this._marginX;
        const moonD  = r * 2;
        const trackW = W - marginX * 2;
        const endX   = marginX + phase * trackW - r;
        const endY   = Math.round(H * 0.01);

        const constellationOffsetY = H * 0.22;

        moonEl.style.animation = 'none';
        moonEl.style.filter    = 'none';

        this._bgWheelsPaused = true;
        this.spinAngle = 0;
        this.cameras.main.setAngle(0);

        const NUM_GHOSTS = 6;
        const ghosts = [];
        for (let i = 0; i < NUM_GHOSTS; i++) {
            const ghost = moonEl.cloneNode(true);
            ghost.style.pointerEvents = 'none';
            ghost.style.animation     = 'none';
            ghost.style.cursor        = 'default';
            ghost.style.left          = moonEl.style.left;
            ghost.style.top           = moonEl.style.top;
            ghost.style.opacity       = '0';
            ghost.style.filter        = 'blur(1px)';
            ghost.style.transition    = '';
            document.body.appendChild(ghost);
            ghosts.push(ghost);
        }

        const MOVE_DURATION = 3500;
        const MOVE_DELAY    = 800;
        const moveStart = performance.now() + MOVE_DELAY;
        const fromLeft  = parseFloat(moonEl.style.left) || 0;
        const fromTop   = parseFloat(moonEl.style.top)  || Math.round(this.H * 0.35);

        const cam           = this.cameras.main;
        const targetScrollX = this.constellations[0].wcx - this.W / 2;
        const targetScrollY = this.constellations[0].wcy - this.H / 2;
        const finalScrollY  = targetScrollY + constellationOffsetY;

        let _textFaded = false;
        const animateMoonTrail = (now) => {
            if (now < moveStart) { requestAnimationFrame(animateMoonTrail); return; }
            if (!_textFaded) {
                _textFaded = true;
                [this.irishOverlayEl, this.englishEl].forEach(el => {
                    if (el) { el.style.transition = 'opacity 1.2s'; el.style.opacity = '0'; }
                });
            }
            const elapsed = now - moveStart;
            const rawT    = Math.min(elapsed / MOVE_DURATION, 1);
            const t       = 1 - (1 - rawT) * (1 - rawT);

            const curLeft = fromLeft + (endX - fromLeft) * t;
            const curTop  = fromTop  + (endY - fromTop)  * t;
            moonEl.style.left = curLeft + 'px';
            moonEl.style.top  = curTop  + 'px';

            ghosts.forEach((ghost, i) => {
                const lag   = (i + 1) / (NUM_GHOSTS + 1) * 0.55;
                const gt    = Math.max(0, rawT - lag);
                const ease  = gt < 0.5 ? 4 * gt * gt * gt : 1 - Math.pow(-2 * gt + 2, 3) / 2;
                const gLeft = fromLeft + (endX - fromLeft) * ease;
                const gTop  = fromTop  + (endY - fromTop)  * ease;
                ghost.style.left    = gLeft + 'px';
                ghost.style.top     = gTop  + 'px';
                const fadeIn  = Math.min(gt * 4, 1);
                const fadeOut = Math.max(0, 1 - (rawT - 0.5) * 2);
                ghost.style.opacity = String(fadeIn * fadeOut * (0.5 - i * 0.07));
            });

            if (rawT < 1) {
                requestAnimationFrame(animateMoonTrail);
            } else {
                moonEl.style.left = endX + 'px';
                moonEl.style.top  = endY + 'px';
                ghosts.forEach(g => g.remove());
                this._startPostSettleSequence(moonEl, endX, endY, W, H, finalScrollY);
            }
        };
        requestAnimationFrame(animateMoonTrail);

        const panStartY = finalScrollY - H * 0.35;
        const panProg   = { t: 0 };
        cam.setScroll(targetScrollX, panStartY);
        this.tweens.add({
            targets:  panProg,
            t:        1,
            duration: 1400,
            ease:     'Cubic.easeInOut',
            onUpdate: () => {
                cam.scrollY = panStartY + (finalScrollY - panStartY) * panProg.t;
            },
        });

        // ── Re-wire drag for settled moon ────────────────────────────────────
        let dragging        = false;
        let dragStartX      = 0;
        let dragStartY      = 0;
        let phaseAtStart    = phase;
        let moonStartTop    = endY;
        let isVerticalDrag  = false;

        const trackW2 = W - this._marginX * 2;

        const getSettledTop = () => parseFloat(moonEl.style.top) || endY;

        const onMove = (clientX, clientY) => {
            if (!dragging || this._moonSkipTriggered) return;

            const dX = clientX - dragStartX;
            const dY = (clientY || dragStartY) - dragStartY;

            if (isVerticalDrag) {
                const newTop = Math.max(endY, moonStartTop + dY);
                moonEl.style.top  = newTop + 'px';
                moonEl.style.left = (this._moonLockedLeft || 0) + 'px';

                const dragDist  = newTop - endY;
                const halfRange = Math.max(H * 0.5 - endY, 1);
                moonEl.style.opacity = String(Math.max(0, 1 - dragDist / halfRange));

                this._updateSkipHint();
                if (newTop > H * 0.65) {
                    this._triggerMoonSkip(moonEl);
                }
                return;
            }

            const isNearRight = this.moonPhase > 0.85;
            if (isNearRight && Math.abs(dY) > 10 && Math.abs(dY) > Math.abs(dX) * 1.5) {
                isVerticalDrag = true;
                this._moonVerticalDragging = true;
                this._moonLockedLeft = parseFloat(moonEl.style.left) || 0;
                dragStartY   = clientY || dragStartY;
                moonStartTop = getSettledTop();
                moonEl.style.transition = 'none';
                return;
            }

            const delta    = dX / trackW2;
            const newPhase = Math.max(0, Math.min(1, phaseAtStart + delta));
            this.moonPhase = newPhase;
            this.drawMoonPhase(newPhase);
            this.positionMoon(newPhase);
        };

        const onStart = (clientX, clientY) => {
            dragging       = true;
            isVerticalDrag = false;
            dragStartX     = clientX;
            dragStartY     = clientY || 0;
            moonStartTop   = getSettledTop();
            phaseAtStart   = this.moonPhase;
            moonEl.style.cursor = 'grabbing';
            moonEl.style.transition = 'none';
        };

        const onEnd = () => {
            if (!dragging) return;
            dragging = false;
            this._moonVerticalDragging = false;
            moonEl.style.cursor = 'grab';

            if (isVerticalDrag && !this._moonSkipTriggered) {
                isVerticalDrag = false;
                if (this._skipHintEl) { this._skipHintEl.style.opacity = '0'; }
                this._skipHintVisible = false;
                const fromTop = parseFloat(moonEl.style.top) || endY;
                moonEl.style.opacity = '1';
                const floatBack = performance.now();
                const BACK_MS = 600;
                const loop = (now) => {
                    const raw    = Math.min((now - floatBack) / BACK_MS, 1);
                    const t      = 1 - Math.pow(1 - raw, 3);
                    const curTop = fromTop + (endY - fromTop) * t;
                    moonEl.style.top = curTop + 'px';
                    const dragDist  = curTop - endY;
                    const halfRange = Math.max(H * 0.5 - endY, 1);
                    moonEl.style.opacity = String(Math.max(0, 1 - dragDist / halfRange));
                    if (raw < 1) requestAnimationFrame(loop);
                    else { moonEl.style.top = endY + 'px'; moonEl.style.opacity = '1'; }
                };
                requestAnimationFrame(loop);
            }
        };

        moonEl.addEventListener('mousedown',  (e) => { e.preventDefault(); onStart(e.clientX, e.clientY); });
        window.addEventListener('mousemove',  (e) => { if (dragging) onMove(e.clientX, e.clientY); });
        window.addEventListener('mouseup',    ()  => { onEnd(); });
        moonEl.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
        window.addEventListener('touchmove',  (e) => { if (dragging) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
        window.addEventListener('touchend',   ()  => { onEnd(); });
    }

    // ── Skip hint — passive, shown once during the post-settle window ────────
    // Appears immediately when the moon settles, fades in over ~1.5 s, then
    // auto-fades before narrative starts. Also re-appears during vertical drag.
    _buildSkipHint(moonEl, moonX, moonY, W, H) {
        if (this._skipHintEl) { this._skipHintEl.remove(); this._skipHintEl = null; }
        if (this._skipHintAutoTimer) { clearTimeout(this._skipHintAutoTimer); this._skipHintAutoTimer = null; }

        const moonR  = this._moonR || 20;
        const svgNS  = 'http://www.w3.org/2000/svg';

        const arrowH = Math.round(H * 0.09);
        const arrowW = Math.round(moonR * 5);
        const cx     = arrowW / 2;
        const totalH = arrowH + 32;

        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width',   arrowW);
        svg.setAttribute('height',  totalH);
        svg.setAttribute('viewBox', `0 0 ${arrowW} ${totalH}`);

        // Label
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', cx);
        text.setAttribute('y', 15);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-family', FONTS.ui || 'sans-serif');
        text.setAttribute('font-size', '13');
        text.setAttribute('fill', 'rgba(255,225,70,0.92)');
        text.setAttribute('letter-spacing', '2');
        text.textContent = 'skip intro';
        svg.appendChild(text);

        // Dashed vertical line
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', cx); line.setAttribute('y1', 22);
        line.setAttribute('x2', cx); line.setAttribute('y2', arrowH + 14);
        line.setAttribute('stroke', 'rgba(255,215,50,0.78)');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '4 6');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);

        // Downward chevron
        const ay = arrowH + 24;
        const arrow = document.createElementNS(svgNS, 'polyline');
        arrow.setAttribute('points', `${cx - 9},${ay - 10} ${cx},${ay} ${cx + 9},${ay - 10}`);
        arrow.setAttribute('stroke', 'rgba(255,215,50,0.88)');
        arrow.setAttribute('stroke-width', '2');
        arrow.setAttribute('fill', 'none');
        arrow.setAttribute('stroke-linecap', 'round');
        arrow.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(arrow);

        // Centred below the moon
        svg.style.cssText = [
            'position:fixed;',
            'pointer-events:none;',
            'z-index:99996;',
            `left:${Math.round(moonX + moonR - arrowW / 2)}px;`,
            `top:${Math.round(moonY + moonR * 2 + 8)}px;`,
            'opacity:0;',
            'transition:opacity 1.5s ease;',
        ].join('');

        document.body.appendChild(svg);
        this._skipHintEl      = svg;
        this._skipHintVisible = false;

        // Fade in immediately
        requestAnimationFrame(() => {
            if (svg.parentNode) svg.style.opacity = '1';
        });

        // Auto-fade out after 3.5 s — before narrative text begins
        this._skipHintAutoTimer = setTimeout(() => {
            this._fadeOutSkipHint();
        }, 3500);
    }

    _fadeOutSkipHint() {
        const el = this._skipHintEl;
        if (!el) return;
        el.style.transition = 'opacity 1.2s ease';
        el.style.opacity    = '0';
        setTimeout(() => {
            if (el.parentNode) el.remove();
            if (this._skipHintEl === el) this._skipHintEl = null;
        }, 1250);
    }

    // Called during vertical drag to show/hide hint reactively
    _updateSkipHint() {
        const el = this._skipHintEl;
        if (!el || this._moonSkipTriggered) return;
        const moonEl = this.moonEl;
        if (!moonEl) return;

        const curTop     = parseFloat(moonEl.style.top) || 0;
        const draggedFar = this._moonVerticalDragging && (curTop > this.H * 0.08);

        if (draggedFar && !this._skipHintVisible) {
            this._skipHintVisible = true;
            if (this._skipHintAutoTimer) { clearTimeout(this._skipHintAutoTimer); this._skipHintAutoTimer = null; }
            el.style.transition = 'opacity 0.3s ease';
            el.style.opacity    = '1';
        } else if (!draggedFar && this._skipHintVisible) {
            this._skipHintVisible = false;
            el.style.opacity = '0';
        }
    }

    // ── _startPostSettleSequence ──────────────────────────────────────────────
    _startPostSettleSequence(moonEl, endX, endY, W, H, baseScrollY) {

        [this.irishOverlayEl, this.englishEl].forEach(el => { if (el) el.remove(); });
        if (this.moonOverlay) { this.moonOverlay.remove(); this.moonOverlay = null; }

        const DRIFT_MS    = 480000;
        const moonDriftPx = Math.round(H * 0.06);
        const driftStart  = performance.now();
        const driftFromY  = endY;
        const driftToY    = Math.max(0, endY - moonDriftPx);

        this._buildSkipHint(moonEl, endX, endY, W, H);

        const driftLoop = (now) => {
            if (!this.moonEl) return;
            const t = Math.min((now - driftStart) / DRIFT_MS, 1);
            if (!this._moonVerticalDragging) {
                this.moonEl.style.top = (driftFromY + (driftToY - driftFromY) * t) + 'px';
            }
            this._updateSkipHint();
            if (t < 1) requestAnimationFrame(driftLoop);
        };
        requestAnimationFrame(driftLoop);

        const camDriftRange = H * 0.14;

        this.tweens.add({
            targets:  this.worldG,
            alpha:    1,
            duration: 1200,
            ease:     'Sine.easeIn',
            onStart: () => {
                this._bgWheelsPaused = false;
            },
            onComplete: () => {
                const driftBaseScrollY = this.cameras.main.scrollY;
                const camDriftProg = { t: 0 };

                this._moonDriftTween = this.tweens.add({
                    targets:  camDriftProg,
                    t:        1,
                    duration: DRIFT_MS,
                    ease:     'Linear',
                    onUpdate: () => {
                        this.cameras.main.scrollY = driftBaseScrollY + camDriftProg.t * camDriftRange;
                    },
                });

                this.startSequencePulse();
            },
        });
    }

    // ── spin ──────────────────────────────────────────────────────────────────
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
        const S   = Math.round(Math.max(this.W, this.H) * 1.5);
        const rt  = this.add.renderTexture(0, 0, S, S)
                        .setScrollFactor(0).setDepth(2).setAlpha(0.55)
                        .setOrigin(0.5).setPosition(this.W / 2, this.H / 2)
                        .setBlendMode(Phaser.BlendModes.ADD);
        this._nebulaWheelRt    = rt;
        this._nebulaWheelSpeed = -360 / 120000;

        const paintNebula = (img) => {
            rt.clear();
            if (img) {
                const scaleX = S / img.width;
                const scaleY = S / img.height;
                const scale  = Math.max(scaleX, scaleY);
                const dw = img.width * scale, dh = img.height * scale;
                rt.draw(img, (S - dw) / 2, (S - dh) / 2);
            } else {
                const fg = this.make.graphics({ add: false });
                const glows = [
                    { x:0.35, y:0.38, r:0.38, c1:0x6030c0, c2:0x1a1060 },
                    { x:0.65, y:0.28, r:0.32, c1:0x402090, c2:0x101050 },
                    { x:0.50, y:0.65, r:0.40, c1:0x203880, c2:0x0a1840 },
                    { x:0.22, y:0.68, r:0.30, c1:0x501060, c2:0x180830 },
                    { x:0.78, y:0.58, r:0.34, c1:0x381888, c2:0x101430 },
                ];
                for (const g of glows) {
                    fg.fillGradientStyle(g.c1, g.c1, g.c2, g.c2, 0.7, 0.7, 0, 0);
                    fg.fillCircle(S * g.x, S * g.y, S * g.r);
                }
                rt.draw(fg, 0, 0);
                fg.destroy();
            }
        };

        if (this.textures.exists('nebula')) {
            paintNebula(this.textures.get('nebula').getSourceImage());
        } else {
            this.load.image('nebula', 'assets/n1-top@3x.png');
            this.load.once('complete', () => {
                paintNebula(this.textures.get('nebula').getSourceImage());
            });
            this.load.start();
        }

        this._nebulaWheelTween = null;
    }

    drawStaticBackground(wSize) {
        const W = this.W;
        const H = this.H;
        const S = Math.round(Math.max(W, H) * 1.5);

        const rt  = this.add.renderTexture(0, 0, S, S)
            .setScrollFactor(0).setDepth(3).setOrigin(0.5)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setPosition(W / 2, H / 2);
        const tmp = this.make.graphics({ add: false });
        const rng = new Phaser.Math.RandomDataGenerator(['oíche2025']);

        const drawStarStatic = (x, y, r, a) => {
            tmp.fillStyle(0xffffff, a);
            if (r < 1.2) {
                tmp.fillRect(Math.floor(x), Math.floor(y), 2, 2);
            } else {
                const arm = Math.round(r);
                tmp.fillRect(Math.floor(x - arm), Math.floor(y), arm * 2 + 1, 1);
                tmp.fillRect(Math.floor(x), Math.floor(y - arm), 1, arm * 2 + 1);
            }
        };

        for (const l of [
            { n: 600,  minR: 0.6, maxR: 1.0, minA: 0.08, maxA: 0.18 },
            { n: 200,  minR: 1.0, maxR: 1.5, minA: 0.12, maxA: 0.24 },
            { n: 60,   minR: 1.4, maxR: 2.0, minA: 0.16, maxA: 0.30 },
        ]) {
            for (let i = 0; i < l.n; i++) {
                drawStarStatic(
                    rng.realInRange(0, S),
                    rng.realInRange(0, S),
                    rng.realInRange(l.minR, l.maxR),
                    rng.realInRange(l.minA, l.maxA)
                );
            }
        }
        rt.draw(tmp, 0, 0);
        tmp.destroy();

        this._bgWheelRt    = rt;
        this._bgWheelSpeed = 360 / 180000;
        this._bgWheelTween = null;

        const rng2 = new Phaser.Math.RandomDataGenerator(['réaltaí2']);
        const rt2  = this.add.renderTexture(0, 0, S, S)
            .setScrollFactor(0).setDepth(4).setOrigin(0.5)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setPosition(W / 2, H / 2);

        const tmp2 = this.make.graphics({ add: false });

        const drawStarDrift = (x, y, r, a) => {
            tmp2.fillStyle(0xffffff, a);
            if (r < 1.2) {
                tmp2.fillRect(Math.floor(x), Math.floor(y), 2, 2);
            } else {
                const arm = Math.round(r);
                tmp2.fillRect(Math.floor(x - arm), Math.floor(y), arm * 2 + 1, 1);
                tmp2.fillRect(Math.floor(x), Math.floor(y - arm), 1, arm * 2 + 1);
            }
        };

        const starDefs = [
            { n: 1800, minR: 0.6, maxR: 1.1, minA: 0.15, maxA: 0.38 },
            { n: 600,  minR: 1.0, maxR: 1.6, minA: 0.22, maxA: 0.50 },
            { n: 150,  minR: 1.4, maxR: 2.2, minA: 0.28, maxA: 0.58 },
        ];

        for (const l of starDefs) {
            for (let i = 0; i < l.n; i++) {
                drawStarDrift(
                    rng2.realInRange(0, S),
                    rng2.realInRange(0, S),
                    rng2.realInRange(l.minR, l.maxR),
                    rng2.realInRange(l.minA, l.maxA)
                );
            }
        }
        rt2.draw(tmp2, 0, 0);
        tmp2.destroy();

        this._driftWheelRt    = rt2;
        this._driftWheelSpeed = 360 / 90000;
        this._driftWheelTween = null;

        const rng3 = new Phaser.Math.RandomDataGenerator(['réaltaí3']);
        const rt3  = this.add.renderTexture(0, 0, S, S)
            .setScrollFactor(0).setDepth(5).setOrigin(0.5)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setPosition(W / 2, H / 2);

        const tmp3 = this.make.graphics({ add: false });
        for (const l of [
            { n: 180,  minR: 1.0, maxR: 2.0, minA: 0.28, maxA: 0.55 },
            { n: 60,   minR: 1.8, maxR: 3.0, minA: 0.38, maxA: 0.65 },
            { n: 20,   minR: 2.5, maxR: 4.0, minA: 0.45, maxA: 0.75 },
        ]) {
            for (let i = 0; i < l.n; i++) {
                const x = rng3.realInRange(0, S);
                const y = rng3.realInRange(0, S);
                const r = rng3.realInRange(l.minR, l.maxR);
                const a = rng3.realInRange(l.minA, l.maxA);
                tmp3.fillStyle(0xffffff, a);
                const arm = Math.round(r);
                tmp3.fillRect(Math.floor(x - arm), Math.floor(y), arm * 2 + 1, 1);
                tmp3.fillRect(Math.floor(x), Math.floor(y - arm), 1, arm * 2 + 1);
            }
        }
        rt3.draw(tmp3, 0, 0);
        tmp3.destroy();

        this._fgWheelRt    = rt3;
        this._fgWheelSpeed = 360 / 60000;
    }

    buildConstellations(wSize) {
        const usable = Math.min(this.W, this.H) * 0.68;
        this.constellations = CONSTELLATION_DATA.map((data, idx) => {
            const theta = SPIRAL_B + idx * SPIRAL_STEP;

            const r = SPIRAL_A * (1 + idx * 0.25);
            const wcx   = this.worldCX + Math.cos(theta) * r;
            const wcy   = this.worldCY + Math.sin(theta) * r;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const o of data.starOffsets) {
                minX = Math.min(minX, o.lx); maxX = Math.max(maxX, o.lx);
                minY = Math.min(minY, o.ly); maxY = Math.max(maxY, o.ly);
            }
            const scale = usable / Math.max((maxX - minX) || 0.01, (maxY - minY) || 0.01);
            const ocx = (minX + maxX) / 2, ocy = (minY + maxY) / 2;

            const stars = data.starOffsets.map((o, i) => ({
                index: i,
                wx: wcx + (o.lx - ocx) * scale,
                wy: wcy + (o.ly - ocy) * scale,
                brightness: 1.0, lit: false, completed: false,
            }));

            const connections = data.connections.map(c => ({
                from: c.from, to: c.to,
                completed: false,
                completedAt: null,
            }));

            return {
                id: data.id,
                cameraOffsetY: data.cameraOffsetY || 0,
                wcx, wcy, stars, connections, completed: false,
            };
        });
    }

    panCameraTo(idx, animate = true) {
        this._hideDarkImage(false);
        this.currentIndex = idx;
        this._updateDusk();

        const panNow = this.time.now;
        for (const c of this.constellations) {
            if (c.completed) {
                for (const cn of c.connections) {
                    if (cn.completedAt !== null && cn.panStartTime === undefined) {
                        cn.panStartTime = panNow;
                    }
                }
            }
        }

        const c = this.constellations[idx];
        if (!c) return;
        const tx = c.wcx - this.W / 2;
        const ty = c.wcy - this.H / 2 + this.H * 0.22;
        if (!animate) { this.cameras.main.setScroll(tx, ty); return; }

        if (this._moonDriftTween) {
            this._moonDriftTween.stop();
            this._moonDriftTween = null;
        }

        const sx    = this.cameras.main.scrollX;
        const sy    = this.cameras.main.scrollY;
        const dx    = tx - sx, dy = ty - sy;
        const dist  = Math.sqrt(dx * dx + dy * dy) || 1;

        const arcH  = dist * 0.28;
        const px    = -dy / dist * arcH;
        const py    =  dx / dist * arcH;

        const mx    = (sx + tx) / 2 + px;
        const my    = (sy + ty) / 2 + py;

        const cam   = this.cameras.main;
        const prog  = { t: 0 };

        this.tweens.killTweensOf(cam);
        this.tweens.killTweensOf(prog);

        const camDX = tx - sx;
        const camDY = ty - sy;

        const bgLayers = [
            { rt: this._bgWheelRt,    depth: 0.25 },
            { rt: this._driftWheelRt, depth: 0.45 },
            { rt: this._fgWheelRt,    depth: 0.65 },
        ].filter(l => l.rt);

        const startAngles   = bgLayers.map(l => l.rt.angle);
        const startCamAngle = this.spinAngle || 0;

        const panDist   = Math.sqrt(camDX * camDX + camDY * camDY);
        const sweepDeg  = Math.min(panDist * 0.018, 55);
        const sweepSign = -1;

        this._bgWheelsPaused = true;

        const PAN_MS = 3000;
        const prog2  = { t: 0 };
        this.tweens.add({
            targets:  prog2,
            t:        1,
            duration: PAN_MS,
            ease:     'Cubic.easeInOut',
            onUpdate: () => {
                const t = prog2.t;
                bgLayers.forEach((l, i) => {
                    l.rt.angle = startAngles[i] + sweepDeg * sweepSign * l.depth * t;
                });
                this.spinAngle = startCamAngle * (1 - t);
                this.cameras.main.setAngle(this.spinAngle);
            },
            onComplete: () => {
                this.spinAngle = 0;
                this.cameras.main.setAngle(0);
                this._bgWheelsPaused = false;
                this._setBgWheelPaused(true);
            },
        });

        this.tweens.add({
            targets:  prog,
            t:        1,
            duration: PAN_MS,
            ease:     'Cubic.easeInOut',
            onUpdate: () => {
                const t  = prog.t;
                const it = 1 - t;
                cam.scrollX = it * it * sx + 2 * it * t * mx + t * t * tx;
                cam.scrollY = it * it * sy + 2 * it * t * my + t * t * ty;
            },
            onComplete: () => {
                const newBase  = this.cameras.main.scrollY;
                const driftProg = { t: 0 };
                this._moonDriftTween = this.tweens.add({
                    targets:  driftProg,
                    t:        1,
                    duration: 480000,
                    ease:     'Linear',
                    onUpdate: () => {
                        if (!this.canInteract) return;
                        this.cameras.main.scrollY = newBase + driftProg.t * (this.H * 0.14);
                    },
                });
            },
        });
    }

    showWaitingTexts(c, onComplete) {
        if (this._textPlayer) {
            this._textPlayer.destroy();
            this._textPlayer = null;
        }

        const texts = constellationTexts[c.id];
        const lines = (texts && texts.waiting && texts.waiting.length)
            ? texts.waiting
            : null;

        if (!lines) {
            if (onComplete) onComplete();
            return;
        }

        this._textPlayer = new ScrollingTextPlayer({
            lines,
            getMoonPhase: () => this.moonPhase,
            onComplete:   onComplete || (() => {}),
        });
        this._textPlayer.start();
    }

    hideWaitingTexts(onComplete) {
        if (this._textPlayer) {
            this._textPlayer.destroy();
            this._textPlayer = null;
        }
        if (onComplete) onComplete();
    }

    startSequencePulse() {
        if (this.pulseTimer) { this.pulseTimer.remove(); this.pulseTimer = null; }
        this.pulseIdx = 0;
        this._interactionStarted = true;
        this.canInteract = true;

        this._updateDusk();

        const c = this.constellations[this.currentIndex];
        this.showWaitingTexts(c, () => {});
        this.runPulseStep();
    }

    runPulseStep() {
        const c = this.constellations[this.currentIndex];
        if (!c || c.completed || !this.canInteract) return;
        const seq = this.getStarSeq(c);
        if (!seq.length) return;
        const star = c.stars[seq[this.pulseIdx % seq.length]];
        if (!star) return;
        this.tweens.killTweensOf(star);
        this.tweens.add({
            targets: star, brightness: 2.4, duration: 300,
            ease: 'Sine.easeOut', yoyo: true,
            onComplete: () => { star.brightness = 1; },
        });
        this.pulseIdx++;
        const atEnd = this.pulseIdx % seq.length === 0;
        this.pulseTimer = this.time.delayedCall(atEnd ? 1800 : 500, () => this.runPulseStep());
    }

    getStarSeq(c) {
        const pending = c.connections.filter(cn => !cn.completed);
        if (!pending.length) return [];
        const seen = new Set();
        const seq  = [];
        for (const cn of pending) {
            if (!seen.has(cn.from)) { seen.add(cn.from); seq.push(cn.from); }
            if (!seen.has(cn.to))   { seen.add(cn.to);   seq.push(cn.to);   }
        }
        return seq;
    }

    hitR() { return Math.min(this.W, this.H) * 0.09; }

    screenToRotated(sx, sy) {
        const cx  = this.W / 2;
        const cy  = this.H * 0.28;
        const rad = Phaser.Math.DegToRad(this.spinAngle || 0);
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const dx  = sx - cx, dy = sy - cy;
        return {
            x: cx + dx * cos + dy * sin,
            y: cy - dx * sin + dy * cos,
        };
    }

    onPointerDown(pointer) {
        _requestFullscreen();
        _unlockAudio();
        if (!this.canInteract) return;
        const c = this.constellations[this.currentIndex];
        if (!c || c.completed) return;
        const hr2 = this.hitR() ** 2;
        for (const star of c.stars) {
            const dx = pointer.worldX - star.wx, dy = pointer.worldY - star.wy;
            if (dx * dx + dy * dy < hr2) {
                this.isDrawing  = true;
                this.strokeHits = [star];
                this.smoothX    = pointer.x;
                this.smoothY    = pointer.y;
                const rp0 = this.screenToRotated(pointer.x, pointer.y);
                this.trailPts   = [rp0];
                star.lit        = true;
                this.tweens.killTweensOf(star);
                star.brightness = 2.0;
                this.spawnRipple(star.wx, star.wy);
                this._setBgWheelPaused(true);
                this._frozenSpinAngle = this.spinAngle;
                break;
            }
        }
    }

    onPointerMove(pointer) {
        if (!this.isDrawing) return;

        this.smoothX += (pointer.x - this.smoothX) * TRAIL_SMOOTH;
        this.smoothY += (pointer.y - this.smoothY) * TRAIL_SMOOTH;

        const last = this.trailPts[this.trailPts.length - 1];
        const rp = this.screenToRotated(this.smoothX, this.smoothY);
        const dx = rp.x - last.x, dy = rp.y - last.y;
        if (dx * dx + dy * dy >= 2) {
            this.trailPts.push(rp);
            if (this.trailPts.length > TRAIL_MAX) this.trailPts.shift();
        }

        const c = this.constellations[this.currentIndex];
        if (!c) return;
        const hr2 = this.hitR() ** 2;
        for (const star of c.stars) {
            if (star.lit) continue;
            const ddx = pointer.worldX - star.wx, ddy = pointer.worldY - star.wy;
            if (ddx * ddx + ddy * ddy < hr2) {
                star.lit = true;
                this.strokeHits.push(star);
                this.tweens.killTweensOf(star);
                star.brightness = 2.0;
                this.spawnRipple(star.wx, star.wy);
                if (this.strokeHits.length >= 2) {
                    const prev = this.strokeHits[this.strokeHits.length - 2];
                    const a = prev.index, b = star.index;
                    const pendingConn = c.connections.find(
                        cn => !cn.completed &&
                              ((cn.from === a && cn.to === b) || (cn.from === b && cn.to === a))
                    );
                    if (pendingConn) {
                        this._playConnectionChime();
                    }
                }
            }
        }
    }

    onPointerUp() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.trailPts  = [];
        this.trailG.clear();

        const c = this.constellations[this.currentIndex];
        if (c) this.evaluateStroke(c);

        for (const star of (c ? c.stars : [])) {
            star.lit = false;
            if (!c || !c.completed) {
                this.tweens.killTweensOf(star);
                star.brightness = 1;
            }
        }
        this.strokeHits = [];
    }

    evaluateStroke(c) {
        const hits    = this.strokeHits.map(s => s.index);
        if (hits.length < 2) { this.rejectStroke(c); return; }

        let anyMatched = false;
        for (let i = 0; i < hits.length - 1; i++) {
            const a = hits[i], b = hits[i + 1];
            const conn = c.connections.find(
                cn => !cn.completed &&
                      ((cn.from === a && cn.to === b) || (cn.from === b && cn.to === a))
            );
            if (conn) {
                conn.completed = true;
                anyMatched = true;
            }
        }

        if (!anyMatched) { this.rejectStroke(c); return; }

        if (c.connections.every(cn => cn.completed)) {
            const now2 = this.time.now;
            for (const cn of c.connections) cn.completedAt = now2;
            this.onConstellationComplete(c);
        }
    }

    rejectStroke(c) {
        for (const star of c.stars) {
            this.tweens.killTweensOf(star);
            this.tweens.add({
                targets: star, brightness: 0.2, duration: 200,
                ease: 'Sine.easeInOut', yoyo: true, repeat: 1,
                onComplete: () => { star.brightness = 1; },
            });
        }
    }

    onConstellationComplete(c) {
        c.completed      = true;
        this.canInteract = false;
        if (this.pulseTimer) this.pulseTimer.remove();
        for (const star of c.stars) { star.completed = true; this.tweens.killTweensOf(star); }

        this.playCompletionChord();
        if (c.id === 'draoi') {
            triggerMurmuration(this.audioContext);
        }

        this.time.delayedCall(800, () => this._showDarkImage(c.id));

        const texts       = constellationTexts[c.id];
        const completion  = texts && texts.completion ? texts.completion : [];
        const hasDialogue = completion.length > 0;

        this.hideWaitingTexts(() => {
            if (!hasDialogue) {
                this.time.delayedCall(600, () => this.onAllComplete());
                return;
            }

            this.time.delayedCall(300, () => {
                // ── Store on this so _triggerMoonSkip / onAllComplete can destroy it ──
                if (this._completionPlayer) {
                    this._completionPlayer.destroy();
                    this._completionPlayer = null;
                }
                this._completionPlayer = new ScrollingTextPlayer({
                    lines:        completion,
                    getMoonPhase: () => this.moonPhase,
                    onComplete:   () => {
                        this._completionPlayer = null;
                        this.time.delayedCall(200, () => {
                            this.currentIndex++;
                            if (this.currentIndex < this.constellations.length) {
                                this.panCameraTo(this.currentIndex, true);
                                this.time.delayedCall(800, () => {
                                    this.startSequencePulse();
                                });
                            } else {
                                this.onAllComplete();
                            }
                        });
                    },
                });
                this._completionPlayer.start();
            });
        });
    }

    // ── Nuclear text player cleanup ───────────────────────────────────────────
    // Destroys all tracked players AND removes any orphaned STP DOM nodes.
    // Called before transitioning away so nothing bleeds into heroSelect.
    _destroyAllTextPlayers() {
        if (this._textPlayer) {
            try { this._textPlayer.destroy(); } catch(e) {}
            this._textPlayer = null;
        }
        if (this._completionPlayer) {
            try { this._completionPlayer.destroy(); } catch(e) {}
            this._completionPlayer = null;
        }
        // Belt-and-braces: remove any DOM nodes that ScrollingTextPlayer
        // may have injected but lost its reference to.
        // ScrollingTextPlayer should set data-stp="" on its root container;
        // if it doesn't yet, this is harmless and future-proof.
        document.querySelectorAll('[data-stp]').forEach(el => el.remove());
        // Also catch by common class if STP uses one:
        document.querySelectorAll('.stp-overlay, .stp-container, .scrolling-text-player').forEach(el => el.remove());
    }

    onAllComplete() {
        this._destroyAllTextPlayers();
        this._stopAllAudio();
        this.cameras.main.fadeOut(1800, 10, 5, 40);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.shutdown();

            if (this.moonEl && this.moonEl.parentNode) {
                this.moonEl.parentNode.removeChild(this.moonEl);
                this.moonEl = null;
            }

            if (this._onComplete) {
                this._onComplete(this.moonPhase, this._frozenAmerginLine);
            }

            const canvas = this.game.canvas;
            this.game.destroy(true);
            canvas.remove();

            const gameContainer = document.getElementById('gameContainer');
            if (gameContainer) gameContainer.style.display = 'none';
        });
    }

    shutdown() {
        if (this._lyricInterval)  clearInterval(this._lyricInterval);
        if (this._moonHintTimer)  clearTimeout(this._moonHintTimer);
        if (this._skipHintAutoTimer) { clearTimeout(this._skipHintAutoTimer); this._skipHintAutoTimer = null; }
        this._destroyAllTextPlayers();
        this._stopAllAudio();
        this._hideMoonHint(true);
        if (this.moonOverlay)     { this.moonOverlay.remove(); this.moonOverlay = null; }
        if (this._moonStyle)      { this._moonStyle.remove();  this._moonStyle  = null; }
        if (this._duskEl)         { this._duskEl.remove();     this._duskEl     = null; }
        if (this._skipHintEl)     { this._skipHintEl.remove(); this._skipHintEl = null; }
        this._hideDarkImage(true);
    }

    // ── Moon drag-to-bottom: skip to heroSelect ───────────────────────────────
    _triggerMoonSkip(moonEl) {
        if (this._moonSkipTriggered) return;
        this._moonSkipTriggered = true;

        // Destroy ALL active text players immediately
        this._destroyAllTextPlayers();
        if (this._skipHintAutoTimer) { clearTimeout(this._skipHintAutoTimer); this._skipHintAutoTimer = null; }
        this._fadeOutSkipHint();

        if (this._skipHintEl) { this._skipHintEl.style.opacity = '0'; }

        this._bgWheelsPaused = false;
        this._bgWheelsSpeedMult = 18;

        if (moonEl) {
            const H = this.H;
            const startTop     = parseFloat(moonEl.style.top) || 0;
            const startOpacity = parseFloat(moonEl.style.opacity ?? '1');
            const fallStart    = performance.now();
            const FALL_MS      = 600;
            const fallLoop = (now) => {
                const t    = Math.min((now - fallStart) / FALL_MS, 1);
                const ease = t * t;
                moonEl.style.top     = (startTop + (H + 60 - startTop) * ease) + 'px';
                moonEl.style.opacity = String(Math.max(0, startOpacity * (1 - ease)));
                if (t < 1) requestAnimationFrame(fallLoop);
                else { if (moonEl.parentNode) moonEl.parentNode.removeChild(moonEl); }
            };
            requestAnimationFrame(fallLoop);
        }

        this.time.delayedCall(700, () => {
            this.onAllComplete();
        });
    }

    // ── Audio ─────────────────────────────────────────────────────────────────
    initAudio() {
        this.audioContext       = null;
        this._masterGain        = null;
        this._sfxGain           = null;
        this._harpPreloadPlayer = null;
        this._harpPlayer        = null;
        this._harpStarted       = false;
        this._harpSilentStarted = false;
    }

    _initAudioContext() {
        if (this.audioContext) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AC();

            this._masterGain = this.audioContext.createGain();
            this._masterGain.gain.value = 1.0;
            this._masterGain.connect(this.audioContext.destination);

            this._sfxGain = this.audioContext.createGain();
            this._sfxGain.gain.value = 0.6;
            this._sfxGain.connect(this._masterGain);

            console.log('[audio] SFX AudioContext created, state:', this.audioContext.state);
        } catch (e) { console.warn('[audio] _initAudioContext:', e); }
    }

    _getSfxRoot(index) {
        const roots = [
            65.41, 73.42, 55.00, 49.00, 41.20,
            73.42, 65.41, 55.00, 43.65, 49.00, 73.42,
        ];
        return roots[Math.min(index, roots.length - 1)];
    }

    async _startHarpOnSwipe() {
        if (this._harpSilentStarted) return;
        this._harpSilentStarted = true;
        this._harpStarted = true;
        try {
            console.log('[audio] Harp: loading fresh on moon swipe');
            const player = new TradSessionPlayer();
            const loaded = await player.loadTune('myLaganLove');
            if (!loaded) { console.warn('[audio] Harp load failed'); return; }

            if (player.tracks[1]) { player.tracks[1].gain.gain.value = 0; player.tracks[1].active = false; }
            if (player.tracks[2]) { player.tracks[2].gain.gain.value = 0; player.tracks[2].active = false; }

            player.engine.masterGain.gain.value = 0.0001;

            this._harpPlayer        = player;
            this._harpPreloadPlayer = null;

            await player.play();

            const harpAC = player.audioContext;
            if (harpAC && harpAC.state === 'suspended') await harpAC.resume();
            const masterGain = player.engine.masterGain;
            const now = harpAC.currentTime;
            masterGain.gain.cancelScheduledValues(now);
            masterGain.gain.setValueAtTime(0.0001, now);
            masterGain.gain.exponentialRampToValueAtTime(0.85, now + 2.5);
            console.log('[audio] Harp fading in from moon swipe');
        } catch(e) {
            console.warn('[audio] _startHarpOnSwipe error:', e);
        }
    }

    _stopAllAudio() {
        try {
            if (this._harpPlayer) {
                this._harpPlayer.stop().catch(() => {});
                this._harpPlayer = null;
            }
            if (this._harpPreloadPlayer) {
                this._harpPreloadPlayer.stop().catch(() => {});
                this._harpPreloadPlayer = null;
            }
        } catch(e) {}
    }

    playCompletionChord() {
        const ac = this.audioContext;
        if (!ac || !this._sfxGain) return;
        try {
            if (ac.state === 'suspended') ac.resume();
            const now     = ac.currentTime;
            const chordAt = now + 0.15;
            const root    = this._getSfxRoot(this.currentIndex);
            const ratios  = [1, 1.5, 2, 2.381, 3, 4];

            const masterGain = ac.createGain();
            masterGain.connect(this._sfxGain);
            masterGain.gain.setValueAtTime(0.45, chordAt);
            masterGain.gain.exponentialRampToValueAtTime(0.001, chordAt + 6.0);

            const delay = ac.createDelay(0.8);
            delay.delayTime.value = 0.32;
            const delayGain = ac.createGain();
            delayGain.gain.value = 0.18;
            masterGain.connect(delay);
            delay.connect(delayGain);
            delayGain.connect(masterGain);

            ratios.forEach((ratio, i) => {
                const freq    = root * ratio;
                const stagger = i * 0.07;
                const g = ac.createGain();
                g.connect(masterGain);

                const osc1 = ac.createOscillator();
                osc1.type = 'triangle';
                osc1.frequency.value = freq;
                osc1.connect(g);

                const osc2 = ac.createOscillator();
                osc2.type = 'sine';
                osc2.frequency.value = freq;
                const g2 = ac.createGain();
                g2.gain.value = 0.4;
                osc2.connect(g2);
                g2.connect(g);

                const start = chordAt + stagger;
                g.gain.setValueAtTime(0, start);
                g.gain.linearRampToValueAtTime(0.9, start + 0.015);
                g.gain.exponentialRampToValueAtTime(0.001, start + 5.5);

                osc1.start(start); osc1.stop(start + 5.6);
                osc2.start(start); osc2.stop(start + 5.6);
            });
        } catch (e) { console.warn('[audio] playCompletionChord:', e); }
    }

    _playConnectionChime() {
        const ac = this.audioContext;
        if (!ac || !this._sfxGain) return;
        try {
            if (ac.state === 'suspended') ac.resume();
            const root = this._getSfxRoot(this.currentIndex || 0);
            this._chimeIndex = ((this._chimeIndex || 0) + 1) % 4;
            const ratios = [2, 3, 4, 2.381];
            const freq   = root * ratios[this._chimeIndex] * 2;
            const now    = ac.currentTime;

            const gain = ac.createGain();
            gain.connect(this._sfxGain);

            const osc1 = ac.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.value = freq;
            osc1.connect(gain);

            const osc2 = ac.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.value = freq * 2.756;
            const g2 = ac.createGain();
            g2.gain.value = 0.15;
            osc2.connect(g2);
            g2.connect(gain);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.5, now + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

            osc1.start(now); osc1.stop(now + 1.9);
            osc2.start(now); osc2.stop(now + 1.9);
        } catch(e) { console.warn('[audio] _playConnectionChime:', e); }
    }

    _setBgWheelPaused(paused) {
        if (paused && !this._interactionStarted) return;
        this._bgWheelsPaused = paused;
    }

    spawnRipple(wx, wy) {
        this.ripples.push({ wx, wy, startTime: this.time.now });
    }

    drawScene() {
        this.worldG.clear();
        const now  = this.time.now;
        const camX = this.cameras.main.scrollX;
        const camY = this.cameras.main.scrollY;
        const cullD = Math.max(this.W, this.H) * 1.5;

        for (const c of this.constellations) {
            if (Math.hypot(c.wcx - (camX + this.W / 2), c.wcy - (camY + this.H / 2)) > cullD) continue;
            const isActive = this.constellations[this.currentIndex] === c && !c.completed;

            for (const conn of c.connections) {
                if (!conn.completed) continue;
                const a = c.stars[conn.from], b = c.stars[conn.to];

                let alpha, width;
                if (conn.completedAt === null) {
                    alpha = 0.92;
                    width = 2.5;
                } else if (!conn.panStartTime) {
                    alpha = 0.92;
                    width = 2.5;
                } else {
                    const age  = now - conn.panStartTime;
                    const t    = Math.min(age / LINE_LINGER_MS, 1);
                    const ease = t < 0.7 ? 1 : 1 - ((t - 0.7) / 0.3) ** 2;
                    alpha = 0.12 + ease * 0.80;
                    width = 0.7  + ease * 1.8;
                }

                this.worldG.lineStyle(width * 3, 0x99ccff, alpha * 0.18);
                this.worldG.lineBetween(a.wx, a.wy, b.wx, b.wy);
                this.worldG.lineStyle(width, 0xddeeff, alpha);
                this.worldG.lineBetween(a.wx, a.wy, b.wx, b.wy);
            }

            for (const star of c.stars) {
                if (star.completed) {
                    this.worldG.fillStyle(0x8899aa, 0.15);
                    this.worldG.fillCircle(star.wx, star.wy, 1.2);
                } else if (isActive) {
                    this.drawActiveStar(star.wx, star.wy, star.brightness);
                } else {
                    this.worldG.fillStyle(0x6677aa, 0.20);
                    this.worldG.fillCircle(star.wx, star.wy, 1.8);
                }
            }
        }

        this.rippleG.clear();
        this.ripples = this.ripples.filter(rp => {
            const t = (now - rp.startTime) / RIPPLE_MS;
            if (t >= 1) return false;
            const ease  = 1 - (1 - t) * (1 - t);
            const r     = RIPPLE_MAX_R * ease;
            const alpha = RIPPLE_ALPHA * (1 - t);
            this.rippleG.lineStyle(4, 0x99ddff, alpha * 0.28);
            this.rippleG.strokeCircle(rp.wx, rp.wy, r * 1.18);
            this.rippleG.lineStyle(1.5, 0xddeeff, alpha);
            this.rippleG.strokeCircle(rp.wx, rp.wy, r);
            return true;
        });

        if (this.isDrawing && this.trailPts.length >= 2) {
            this.trailG.clear();
            const pts = this.trailPts;
            const n   = pts.length;

            const smooth = [pts[0]];
            for (let i = 1; i < n; i++) {
                const p0 = pts[Math.max(i - 2, 0)];
                const p1 = pts[i - 1];
                const p2 = pts[i];
                const p3 = pts[Math.min(i + 1, n - 1)];
                smooth.push({
                    x: 0.5 * (p1.x + p2.x) + 0.125 * (-p0.x + p1.x - p2.x + p3.x),
                    y: 0.5 * (p1.y + p2.y) + 0.125 * (-p0.y + p1.y - p2.y + p3.y),
                });
                smooth.push(p2);
            }

            const sn = smooth.length;
            for (let i = 1; i < sn; i++) {
                const t     = i / (sn - 1);
                const t2    = t * t;
                const wOuter = 14 * t2;
                const wCore  =  4 * t2;
                const wHot   =  1 * t;

                const p1 = smooth[i - 1], p2 = smooth[i];

                if (wOuter > 0.3) {
                    this.trailG.lineStyle(wOuter, 0x99ccff, 0.08 * t);
                    this.trailG.lineBetween(p1.x, p1.y, p2.x, p2.y);
                }
                if (wCore > 0.3) {
                    this.trailG.lineStyle(wCore, 0xddeeff, 0.35 * t);
                    this.trailG.lineBetween(p1.x, p1.y, p2.x, p2.y);
                }
                this.trailG.lineStyle(wHot, 0xffffff, 0.90 * t);
                this.trailG.lineBetween(p1.x, p1.y, p2.x, p2.y);
            }
        }
    }

    drawActiveStar(wx, wy, br) {
        const cl    = Math.min(br, 2.5);
        const coreR = 2.0 + cl * 0.85;
        const spike = coreR * (3.0 + cl * 0.8);
        const alpha = 0.6 + Math.min(cl - 1, 1) * 0.4;
        const sw    = Math.max(0.7, cl * 0.5);

        this.worldG.fillStyle(0xbbddff, alpha * 0.14);
        this.worldG.fillCircle(wx, wy, coreR * 3.5);
        this.worldG.lineStyle(sw, 0xffffff, alpha * 0.5);
        this.worldG.lineBetween(wx - spike, wy, wx + spike, wy);
        this.worldG.lineBetween(wx, wy - spike, wx, wy + spike);
        this.worldG.fillStyle(0xffffff, alpha);
        this.worldG.fillCircle(wx, wy, coreR);
    }

    update(time, delta) {
        this.updateSpin(delta);
        this.drawScene();
    }
}

