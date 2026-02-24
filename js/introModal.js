import Phaser from 'phaser';
import { allTunes } from './game/systems/music/allTunes.js';
import * as abcjs from 'abcjs';
import { champions } from '../data/champions.js';
import { TradSessionPlayer } from './game/systems/music/tradSessionPlayerScheduled.js';
import { getTuneKeyForChampion } from './game/systems/music/championTuneMapping.js';

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

    // Load the Aonchlo font before Phaser boots, mirroring introModal's loadFont()
    document.fonts.load('1.8rem Aonchlo').catch(() => {});

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
        input: { touch: { capture: true } },
    });

    // Pass onComplete into the scene via registry so it can call it from onAllComplete




game.registry.set('onComplete', onComplete);  // ← set it directly, no 'ready' wrapper
return game;



    return game;
}

const CONSTELLATION_DATA = [
    // ── Cú na Féinne — The Hound of the Fianna (Orion) ─────────────────────
    {
        id: 'cu', irishText: 'Cú na Féinne', englishText: 'The Hound of the Fianna',
        waitingGa: 'Leanann sé rian na réalt ar feadh na hoíche',
        waitingEn: 'He follows the trail of stars through the night',
        starOffsets: [
            { lx:  -0.79, ly:  -1.38 },  // 0 Betelgeuse — left shoulder (we flip Y: up=negative)
            { lx:   0.44, ly:  -1.21 },  // 1 Bellatrix — right shoulder
            { lx:   0.17, ly:  -0.13 },  // 2 Mintaka — belt right
            { lx:  -0.00, ly:   0.02 },  // 3 Alnilam — belt mid
            { lx:  -0.20, ly:   0.14 },  // 4 Alnitak — belt left
            { lx:   0.88, ly:   1.16 },  // 5 Rigel — right foot
            { lx:  -0.49, ly:   1.40 },  // 6 Saiph — left foot
        ],
        connections: [
            { from: 0, to: 2 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 },
            { from: 4, to: 6 }, { from: 2, to: 5 },
        ],
    },

    // ── An Naomhóg — The Currach (Cassiopeia) ──────────────────────────────
    {
        id: 'naomhog', irishText: 'An Naomhóg', englishText: 'The Currach',
        waitingGa: 'Seolann sí ar abhainn na spéire gan stiúir',
        waitingEn: 'She sails the river of heaven without a rudder',
        starOffsets: [
            { lx:   1.37, ly:  -0.10 },  // 0 Caph
            { lx:   0.55, ly:   0.37 },  // 1 Schedar
            { lx:   0.13, ly:  -0.07 },  // 2 Gamma Cas (middle of W)
            { lx:  -0.64, ly:  -0.02 },  // 3 Ruchbah
            { lx:  -1.40, ly:  -0.38 },  // 4 Segin
        ],
        connections: [
            { from: 0, to: 1 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 },
        ],
    },

    // ── An Carr Mór — The Great Chariot / Plough (Ursa Major) ──────────────
    {
        id: 'carr', irishText: 'An Carr Mór', englishText: 'The Great Chariot',
        waitingGa: 'Timpeallann sé an pol thuaidh go síoraí',
        waitingEn: 'It wheels around the north pole without rest',
        starOffsets: [
            { lx:   1.23, ly:  -0.40 },  // 0 Dubhe — bowl rim outer
            { lx:   1.25, ly:  -0.05 },  // 1 Merak — bowl rim inner
            { lx:   0.42, ly:   0.12 },  // 2 Phecda — bowl base inner
            { lx:   0.07, ly:  -0.09 },  // 3 Megrez — bowl base outer / handle join
            { lx:  -0.54, ly:  -0.02 },  // 4 Alioth — handle 1
            { lx:  -1.02, ly:   0.04 },  // 5 Mizar — handle 2
            { lx:  -1.40, ly:   0.40 },  // 6 Alkaid — handle tip
        ],
        connections: [
            { from: 0, to: 1 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 0 },
            { from: 3, to: 4 }, { from: 4, to: 5 }, { from: 5, to: 6 },
        ],
    },

    // ── Éan na Stoirme — The Stormbird (Cygnus / Northern Cross) ───────────
    {
        id: 'ean', irishText: 'Éan na Stoirme', englishText: 'The Stormbird',
        waitingGa: 'Eitlíonn sí ar bhealach na bó finne',
        waitingEn: 'She flies the white cow\'s road across the sky',
        starOffsets: [
            { lx:  -0.93, ly:  -0.89 },  // 0 Deneb — tail (brightest)
            { lx:  -0.30, ly:  -0.23 },  // 1 Sadr — body center
            { lx:   1.40, ly:   1.39 },  // 2 Albireo — head/beak
            { lx:  -1.09, ly:   0.60 },  // 3 Gienah — right wing tip
            { lx:   0.93, ly:  -0.87 },  // 4 Delta Cyg — left wing tip
        ],
        connections: [
            { from: 0, to: 1 }, { from: 1, to: 2 },
            { from: 3, to: 1 }, { from: 1, to: 4 },
        ],
    },

    // ── An Draoi — The Druid (Boötes) ──────────────────────────────────────
    {
        id: 'draoi', irishText: 'An Draoi', englishText: 'The Druid',
        waitingGa: 'Léann sé leabhar na spéire roimh an bhfocal',
        waitingEn: 'He reads the book of heaven before the word',
        starOffsets: [
            { lx:   0.42, ly:   1.13 },  // 0 Arcturus — staff foot / base
            { lx:   1.05, ly:   1.23 },  // 1 Muphrid — right foot
            { lx:  -0.46, ly:   0.19 },  // 2 Izar — body
            { lx:  -0.06, ly:  -1.15 },  // 3 Seginus — left shoulder
            { lx:  -0.96, ly:  -1.40 },  // 4 Nekkar — head / hood peak
        ],
        connections: [
            { from: 0, to: 1 }, { from: 0, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 },
        ],
    },

    // ── Cláirseach na Spéire — The Harp of Heaven (Lyra) ───────────────────
    {
        id: 'clairseach', irishText: 'Cláirseach na Spéire', englishText: 'The Harp of Heaven',
        waitingGa: 'Cloisimid a ceol i gciúnas na hoíche',
        waitingEn: 'We hear her music in the silence of the night',
        starOffsets: [
            { lx:   1.31, ly:  -1.28 },  // 0 Vega — top peg (brightest)
            { lx:   0.45, ly:  -0.77 },  // 1 Zeta Lyr — neck
            { lx:  -0.08, ly:   1.10 },  // 2 Sheliak — lower left
            { lx:  -1.07, ly:   1.40 },  // 3 Sulafat — base corner
            { lx:  -0.61, ly:  -0.45 },  // 4 Delta Lyr — lower right
        ],
        connections: [
            { from: 0, to: 1 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 },
            { from: 4, to: 1 },
        ],
    },

    // ── An Fhéinics — The Phoenix / Rising Fire (Leo) ──────────────────────
    {
        id: 'fheinics', irishText: 'An Fhéinics', englishText: 'The Phoenix',
        waitingGa: 'Éiríonn sí arís as an luaithreach gach earrach',
        waitingEn: 'She rises again from the ashes each spring',
        starOffsets: [
            { lx:   0.85, ly:  -0.51 },  // 0 Rasalas — crest tip
            { lx:   0.39, ly:  -0.31 },  // 1 Adhafera — crest upper
            { lx:   0.33, ly:  -0.03 },  // 2 Algieba — crest base
            { lx:   0.55, ly:   0.57 },  // 3 Regulus — heart / base (brightest)
            { lx:  -0.72, ly:  -0.09 },  // 4 Zosma — body / haunches
            { lx:  -1.40, ly:   0.37 },  // 5 Denebola — tail tip
        ],
        connections: [
            { from: 0, to: 1 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 }, { from: 4, to: 5 },
        ],
    },

    // ── An Bradán Feasa — The Salmon of Knowledge (Pisces) ─────────────────
    {
        id: 'bradan', irishText: 'An Bradán Feasa', englishText: 'The Salmon of Knowledge',
        waitingGa: 'D\'ith sé cnónna na heagna ag tobar an domhain',
        waitingEn: 'He ate the nuts of wisdom at the well of the world',
        starOffsets: [
            { lx:   1.18, ly:  -0.20 },  // 0 Gamma Psc — west fish near tail
            { lx:   1.03, ly:  -0.32 },  // 1 Kappa Psc — west fish tail tip
            { lx:   0.52, ly:   0.03 },  // 2 Omega Psc — west fish head
            { lx:  -1.40, ly:  -0.23 },  // 3 Alrescha — the knot
            { lx:   0.06, ly:   0.07 },  // 4 Delta Psc — north fish tail
            { lx:  -0.48, ly:   0.09 },  // 5 Epsilon Psc — north fish body
            { lx:  -0.92, ly:  -0.56 },  // 6 Eta Psc — north fish head (brightest)
        ],
        connections: [
            { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 },
            { from: 3, to: 4 }, { from: 4, to: 5 }, { from: 5, to: 6 },
        ],
    },

    // ── An Torc — The Wild Boar (Scorpius) ─────────────────────────────────
    {
        id: 'torc', irishText: 'An Torc', englishText: 'The Wild Boar',
        waitingGa: 'Gearrann a starrfhiacla trí dhorchadas an deiscirt',
        waitingEn: 'His tusks cut through the darkness of the south',
        starOffsets: [
            { lx:   1.14, ly:  -1.40 },  // 0 Graffias — snout right
            { lx:   1.27, ly:  -1.11 },  // 1 Delta Sco — snout left
            { lx:   0.53, ly:  -0.73 },  // 2 Antares — heart/eye (red, brightest)
            { lx:  -0.00, ly:   0.07 },  // 3 Epsilon Sco — body
            { lx:  -0.10, ly:   0.89 },  // 4 Zeta Sco — hindquarters
            { lx:  -0.55, ly:   0.98 },  // 5 Eta Sco — tail base
            { lx:  -1.10, ly:   0.35 },  // 6 Shaula — tail tip / tusk
            { lx:  -1.19, ly:   0.95 },  // 7 Theta Sco — tail curl
        ],
        connections: [
            { from: 0, to: 2 }, { from: 1, to: 2 },
            { from: 2, to: 3 }, { from: 3, to: 4 },
            { from: 4, to: 5 }, { from: 5, to: 6 },
            { from: 5, to: 7 },
        ],
    },

    // ── An Laoch — The Hero / Warrior (Perseus) ─────────────────────────────
// ── An Laoch — The Hero / Warrior (Perseus) ─────────────────────────────
{
    id: 'laoch', irishText: 'An Laoch', englishText: 'The Warrior',
    waitingGa: 'Iompraíonn sé an claíomh is dorcha sa spéir',
    waitingEn: 'He carries the darkest sword in the sky',
    starOffsets: [
        { lx:   0.78, ly:  -1.45 },  // 0 Gamma Per — head
        { lx:   0.21, ly:  -1.03 },  // 1 Mirfak — shoulder (brightest)
        { lx:  -0.33, ly:  -0.79 },  // 2 Delta Per — body upper
        { lx:   0.71, ly:   0.00 },  // 3 Algol — raised sword arm (demon star)
        { lx:  -0.74, ly:   0.11 },  // 4 Epsilon Per — body lower
        { lx:  -0.64, ly:   1.05 },  // 5 Zeta Per — foot
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

// How long completed lines stay bright before fading (ms)
const LINE_LINGER_MS = 2800;

// Ripple ring animation
const RIPPLE_MS    = 900;    // total lifetime
const RIPPLE_MAX_R = 55;     // world-space radius at full expansion
const RIPPLE_ALPHA = 0.75;   // peak alpha (at t=0)

const AMERGIN_LINES = [
    { ga: 'Cé an té le nod slí na gcloch sléibhe?', en: 'Who knows the way of the mountain stones?' },
    { ga: 'Cé gair aois na gealaí?',                en: 'Who foretells the ages of the moon?' },
    { ga: 'Cá dú dul faoi na gréine?',              en: 'Who knows where the sun rests?' },
    { ga: 'Cé beir buar ó thigh Teathra?',          en: 'Who can raid the house of Teathra?' },
    { ga: 'Cé buar Teathra le gean?',               en: 'Who can charm the sunless king?' },
    { ga: 'Cé daon? Cé dia, dealbhóir arm faobhrach?', en: 'What people? What god sculpts keen weapons?' },
];

export class ConstellationScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ConstellationScene' });
        this.currentIndex = 0;
        this.canInteract  = false;   // blocked until moon phase is set

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
        this.irishText    = null;
        this.constellations = [];
        this.pulseTimer   = null;
        this.pulseIdx     = 0;
        this.worldCX = 0;
        this.worldCY = 0;

        // Moon / English-reveal system
        this.moonPhase       = 0;      // 0 = crescent, 1 = full
        this.moonCanvas      = null;   // HTMLCanvasElement drawn each frame
        this.moonOverlay     = null;   // the DOM overlay container
        this.moonEl          = null;   // the draggable moon canvas element
        this.englishEl       = null;   // English translation div
        this.irishOverlayEl  = null;   // Irish text div (in overlay)
        this.moonInitDone    = false;  // true once player has released first drag
        this.spinAngle       = 0;      // current camera rotation degrees
    }

    get W() { return this.scale.width; }
    get H() { return this.scale.height; }

    create() {
        this.initAudio();
        this._onComplete = this.registry.get('onComplete') || null;
        this._frozenAmerginLine = null;

        // Dark sky background — nebula and stars render over this via ADD blend.
        this.cameras.main.setBackgroundColor('#00060f');

        const wSize  = 5000;
        this.worldCX = wSize / 2;
        this.worldCY = wSize / 2;
        this.cameras.main.setBounds(0, 0, wSize, wSize);

        // (Nebula is rendered by the starfield canvas behind this Phaser canvas)
        this.drawStaticBackground(wSize);

        this.worldG  = this.add.graphics().setDepth(10);
        this.rippleG = this.add.graphics().setDepth(11);
        this.trailG  = this.add.graphics().setScrollFactor(0).setDepth(13);

        const textSize     = Math.round(Math.min(this.W, this.H) * 0.095);
        const subTextSize  = Math.round(Math.min(this.W, this.H) * 0.062);
        const textY        = this.H * 0.15;   // top quarter
        const subY         = this.H * 0.72;   // bottom third

        // Constellation name texts (shown on completion) — Aonchlo gold / Courier green
        this.irishText = this.add
            .text(this.W / 2, textY, '', {
                fontFamily: 'Aonchlo, serif',
                fontSize: textSize + 'px',
                color: '#f5d76e', stroke: '#000a1a', strokeThickness: 3,
            })
            .setScrollFactor(0).setDepth(22).setOrigin(0.5).setAlpha(0);

        this.englishConstellationText = this.add
            .text(this.W / 2, subY, '', {
                fontFamily: '"Courier New",monospace',
                fontSize: subTextSize + 'px',
                color: 'rgb(0,255,0)', stroke: '#000a1a', strokeThickness: 2,
            })
            .setScrollFactor(0).setDepth(22).setOrigin(0.5).setAlpha(0);

        // Waiting texts — same font scheme
        this.waitingIrishText = this.add
            .text(this.W / 2, textY, '', {
                fontFamily: 'Aonchlo, serif',
                fontSize: textSize + 'px',
                color: '#f5d76e', stroke: '#000a1a', strokeThickness: 3,
                wordWrap: { width: this.W * 0.82 },
                align: 'center',
            })
            .setScrollFactor(0).setDepth(22).setOrigin(0.5).setAlpha(0);

        this.waitingEnglishText = this.add
            .text(this.W / 2, subY, '', {
                fontFamily: '"Courier New",monospace',
                fontSize: subTextSize + 'px',
                color: 'rgb(0,255,0)', stroke: '#000a1a', strokeThickness: 2,
                wordWrap: { width: this.W * 0.82 },
                align: 'center',
            })
            .setScrollFactor(0).setDepth(22).setOrigin(0.5).setAlpha(0);

        // UI camera — never rotates, only renders depth-22 text objects.
        // Main camera handles everything else (and rotates for the wheeling sky effect).
        this.uiCamera = this.cameras.add(0, 0, this.W, this.H)
            .setName('ui')
            .setBackgroundColor('rgba(0,0,0,0)');
        this.uiCamera.ignore(
            this.children.list.filter(obj => obj.depth !== 22)
        );
        // Main camera ignores all depth-22 objects
        this.cameras.main.ignore(
            this.children.list.filter(obj => obj.depth === 22)
        );

        this.buildConstellations(wSize);
        // Camera starts at constellation 0 position — settleMoon will pan into it
        const c0 = this.constellations[0];
        this.cameras.main.setScroll(c0.wcx - this.W / 2, c0.wcy - this.H / 2 - this.H * 0.38);

        // Hide all constellation graphics until moon has settled
        this.worldG.setAlpha(0);

        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup',   this.onPointerUp,   this);

        // Fullscreen must be triggered from a native DOM event — attach directly to canvas
        const fsHandler = () => {
            _requestFullscreen();
            _unlockAudio();
            this.game.canvas.removeEventListener('pointerdown', fsHandler);
            this.game.canvas.removeEventListener('touchstart',  fsHandler);
        };
        this.game.canvas.addEventListener('pointerdown', fsHandler, { once: true, passive: true });
        this.game.canvas.addEventListener('touchstart',  fsHandler, { once: true, passive: true });

        // Build the moon overlay — constellations are blocked until first release
        this.buildMoonOverlay();
    }

    // ── Moon overlay ─────────────────────────────────────────────────────────

    buildMoonOverlay() {
        const W = this.W, H = this.H;
        const moonR   = Math.round(H * 0.025);
        const moonD   = moonR * 2;
        const marginX = Math.round(W * 0.06);

        // ── Cycling Amergin lines (mirrors introModal behaviour exactly) ──────
        let currentLyricIndex = Math.floor(Math.random() * AMERGIN_LINES.length);
        let line              = AMERGIN_LINES[currentLyricIndex];
        let hasInteracted     = false;

        // Overlay container
        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:fixed;inset:0;z-index:99999;',
            'pointer-events:none;',
        ].join('');
        this.moonOverlay = overlay;

        // Irish text — Aonchlo, gold — in top quarter of screen
        const irishEl = document.createElement('div');
        irishEl.textContent = line.ga;
        irishEl.style.cssText = [
            'font-family:Aonchlo,serif;',
            `font-size:${Math.round(Math.min(W, H) * 0.075)}px;`,
            'color:#d4af37;text-align:center;',
            'text-shadow:0 0 18px rgba(0,0,0,0.9);',
            'padding:0 1.5rem;',
            'pointer-events:none;',
            'opacity:1;transition:opacity 0.8s ease-in-out;',
            'position:absolute;',
            `top:${Math.round(H * 0.12)}px;`,
            'left:0;right:0;',
        ].join('');
        this.irishOverlayEl = irishEl;

        // English text — Courier New, green — in bottom third
        const enEl = document.createElement('div');
        enEl.textContent = line.en;
        enEl.style.cssText = [
            'font-family:"Courier New",monospace;',
            `font-size:${Math.round(Math.min(W, H) * 0.048)}px;`,
            'color:rgb(0,255,0);text-align:center;',
            'text-shadow:0 0 12px rgba(0,0,0,0.9);',
            'padding:0 1.5rem;',
            'pointer-events:none;',
            'opacity:0.05;transition:opacity 0.5s ease;',
            'position:absolute;',
            `top:${Math.round(H * 0.68)}px;`,
            'left:0;right:0;',
        ].join('');
        this.englishEl = enEl;

        // Cycle lines every 10s until first interaction — exactly as introModal does
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

        // Moon canvas
        const moonCanvas = document.createElement('canvas');
        moonCanvas.width  = moonD;
        moonCanvas.height = moonD;
        moonCanvas.style.cssText = [
            `width:${moonD}px;height:${moonD}px;`,
            'cursor:grab;touch-action:none;',
            'pointer-events:all;',
            'position:fixed;',
            `left:${marginX - moonR}px;`,
            `top:${Math.round(H * 0.35)}px;`,
            'animation:moonInvite 2s infinite ease-in-out;',
        ].join('');
        this.moonEl     = moonCanvas;
        this.moonCanvas = moonCanvas;
        this._moonR     = moonR;
        this._marginX   = marginX;

        const style = document.createElement('style');
        style.id = 'moon-style';
        style.textContent = `
            @keyframes moonInvite {
                0%,100% { filter: drop-shadow(0 0 ${moonR*0.4}px rgba(200,220,255,0.4)); transform: scale(1); }
                50%      { filter: drop-shadow(0 0 ${moonR*1.1}px rgba(200,220,255,0.85)); transform: scale(1.08); }
            }
        `;
        document.head.appendChild(style);
        this._moonStyle = style;

        this.drawMoonPhase(0);

        overlay.appendChild(irishEl);
        overlay.appendChild(enEl);
        document.body.appendChild(overlay);
        document.body.appendChild(moonCanvas);   // moon lives on body, not in flex overlay

        // ── Drag logic ────────────────────────────────────────────────────────
        let dragging         = false;
        let dragStartX       = 0;
        let phaseAtDragStart = 0;
        const trackW         = W - marginX * 2;

        const onDragStart = (clientX) => {
            // CRITICAL: fullscreen + audio unlock must be synchronous on first gesture
            _requestFullscreen();
            _unlockAudio();

            if (!hasInteracted) {
                hasInteracted = true;
                clearInterval(lyricInterval);
                // Freeze the current line for passing to onComplete later
                this._frozenAmerginLine = line;
            }

            dragging             = true;
            dragStartX           = clientX;
            phaseAtDragStart     = this.moonPhase;
            moonCanvas.style.animation = 'none';
            moonCanvas.style.cursor    = 'grabbing';
        };

        const onDragMove = (clientX) => {
            if (!dragging) return;
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
        };

        const onDragEnd = () => {
            if (!dragging) return;
            dragging = false;
            moonCanvas.style.cursor = 'grab';
            if (!this.moonInitDone) {
                this.moonInitDone = true;
                this.settleMoon(this.moonPhase);
            }
        };

        moonCanvas.addEventListener('mousedown',  (e) => { e.preventDefault(); onDragStart(e.clientX); });
        window.addEventListener('mousemove',      (e) => { if (dragging) onDragMove(e.clientX); });
        window.addEventListener('mouseup',        ()  => { onDragEnd(); });
        moonCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); onDragStart(e.touches[0].clientX); }, { passive: false });
        window.addEventListener('touchmove',      (e) => { if (dragging) { e.preventDefault(); onDragMove(e.touches[0].clientX); } }, { passive: false });
        window.addEventListener('touchend',       ()  => { onDragEnd(); });
    }

    drawMoonPhase(phase) {
        // phase: 0 = thin crescent, 1 = full moon
        const canvas = this.moonCanvas;
        if (!canvas) return;
        const r   = this._moonR;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cx = r, cy = r;

        // Outer glow
        const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.6);
        glow.addColorStop(0,   `rgba(200,220,255,${0.18 + phase * 0.14})`);
        glow.addColorStop(0.5, `rgba(150,180,255,${0.08 + phase * 0.06})`);
        glow.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
        ctx.fill();

        // Moon disc — lit surface (always full circle, clipped)
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        ctx.clip();

        // Base disc: dark side colour — faint blue so crescent shape is always visible
        ctx.fillStyle = '#1a2035';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Lit portion: draw as a lens/crescent using two overlapping circles
        // phase=0 → hairline crescent on right edge
        // phase=1 → full disc
        ctx.fillStyle = '#d8e8f8';

        // The lit crescent: right half always lit, left side governed by phase
        // We draw the lit area as the intersection / union of two arcs
        ctx.beginPath();
        if (phase >= 0.99) {
            // Full moon
            ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        } else {
            // Crescent to gibbous: the terminator is an ellipse
            // x-radius of terminator ellipse: r when phase=0, -r when phase=0.5 (full half), 0 at phase=0
            // Maps: phase 0→0.5 = crescent (terminator bulges left), 0.5→1 = gibbous (bulges right)
            const terminatorX = r * 0.92 * Math.cos(phase * Math.PI);  // r → -r
            ctx.arc(cx, cy, r * 0.92, -Math.PI / 2, Math.PI / 2);      // right semicircle
            ctx.ellipse(cx, cy, Math.abs(terminatorX), r * 0.92, 0, Math.PI / 2, -Math.PI / 2, terminatorX > 0);
        }
        ctx.fill();

        // Subtle surface texture — a few faint mare circles
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

        // Thin rim highlight
        ctx.strokeStyle = `rgba(200,220,255,${0.15 + phase * 0.25})`;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        ctx.stroke();
    }

    positionMoon(phase) {
        // Move moon to its settled top-strip position based on current phase
        const W = this.W, H = this.H;
        const r = this._moonR, marginX = this._marginX;
        const moonD  = r * 2;
        const trackW = W - marginX * 2;
        const x = marginX + phase * trackW - r;   // left edge of canvas
        const y = Math.round(H * 0.01);            // 1% from top

        const el = this.moonEl;
        el.style.position = 'fixed';
        el.style.left     = x + 'px';
        el.style.top      = y + 'px';
        el.style.width    = moonD + 'px';
        el.style.height   = moonD + 'px';
    }

    settleMoon(phase) {
        // Called once on first release.
        // 1. Fade out the text overlay elements, keep moon
        // 2. Transition moon from centred to its top-strip position
        // 3. After landing, enable constellations

        const overlay = this.moonOverlay;
        const moonEl  = this.moonEl;
        const W = this.W, H = this.H;
        const r = this._moonR, marginX = this._marginX;
        const moonD  = r * 2;
        const trackW = W - marginX * 2;
        const endX   = marginX + phase * trackW - r;
        const endY   = Math.round(H * 0.01);

        // Text will fade when the moon actually starts moving (after the delay below)
        // Kill the pulsing invite animation immediately though
        moonEl.style.animation = 'none';
        moonEl.style.filter    = 'none';

        // Step 1: gently reverse the sky rotation back to 0° over ~1.4s
        this.tweens.add({
            targets:  this,
            spinAngle: 0,
            duration: 1400,
            ease:     'Sine.easeInOut',
            onUpdate: () => { this.cameras.main.setAngle(this.spinAngle); },
        });

        // Step 2: moon flies to top with dreamlike afterimage trail
        // We create ghost copies that fade in/out along the path
        const startLeft = parseFloat(moonEl.style.left) || (parseFloat(moonEl.style.left) || 0);
        const startTop  = parseFloat(moonEl.style.top)  || Math.round(this.H * 0.35);

        const NUM_GHOSTS = 6;
        const ghosts = [];
        for (let i = 0; i < NUM_GHOSTS; i++) {
            const ghost = moonEl.cloneNode(true);
            ghost.style.pointerEvents = 'none';
            ghost.style.animation     = 'none';
            ghost.style.cursor        = 'default';
            // Start at same position as moon
            ghost.style.left     = moonEl.style.left;
            ghost.style.top      = moonEl.style.top;
            ghost.style.opacity  = '0';
            ghost.style.filter   = 'blur(1px)';
            ghost.style.transition = '';
            document.body.appendChild(ghost);
            ghosts.push(ghost);
        }

        // Animate moon and ghosts — 2s pause first so user can read the text
        const MOVE_DURATION = 3500; // ms — slow, dreamy float upward
        const MOVE_DELAY    = 2000; // ms — wait before starting
        const moveStart = performance.now() + MOVE_DELAY;
        const fromLeft  = parseFloat(moonEl.style.left) || 0;
        const fromTop   = parseFloat(moonEl.style.top)  || Math.round(this.H * 0.35);

        let _textFaded = false;
        const animateMoonTrail = (now) => {
            // Sit still until delay has elapsed
            if (now < moveStart) { requestAnimationFrame(animateMoonTrail); return; }
            // Fade text out exactly as moon begins to move
            if (!_textFaded) {
                _textFaded = true;
                [this.irishOverlayEl, this.englishEl].forEach(el => {
                    if (el) { el.style.transition = 'opacity 1.2s'; el.style.opacity = '0'; }
                });
            }
            const elapsed = now - moveStart;
            const rawT    = Math.min(elapsed / MOVE_DURATION, 1);
            // ease out quad — starts moving confidently, glides to a stop
            const t = 1 - (1 - rawT) * (1 - rawT);

            const curLeft = fromLeft + (endX - fromLeft) * t;
            const curTop  = fromTop  + (endY - fromTop)  * t;
            moonEl.style.left = curLeft + 'px';
            moonEl.style.top  = curTop  + 'px';

            // Each ghost trails behind at a fractional t
            ghosts.forEach((ghost, i) => {
                const lag  = (i + 1) / (NUM_GHOSTS + 1) * 0.55; // how far behind
                const gt   = Math.max(0, rawT - lag);
                const ease = gt < 0.5 ? 4 * gt * gt * gt : 1 - Math.pow(-2 * gt + 2, 3) / 2;
                const gLeft = fromLeft + (endX - fromLeft) * ease;
                const gTop  = fromTop  + (endY - fromTop)  * ease;
                ghost.style.left = gLeft + 'px';
                ghost.style.top  = gTop  + 'px';
                // fade: appear during transit, vanish near end
                const fadeIn  = Math.min(gt * 4, 1);
                const fadeOut = Math.max(0, 1 - (rawT - 0.5) * 2);
                ghost.style.opacity = String(fadeIn * fadeOut * (0.5 - i * 0.07));
            });

            if (rawT < 1) {
                requestAnimationFrame(animateMoonTrail);
            } else {
                // rAF complete — moon is exactly at endX/endY with no jump
                moonEl.style.left = endX + 'px';
                moonEl.style.top  = endY + 'px';
                ghosts.forEach(g => g.remove());

                // Now safe to start long drift without any position conflict
                this._startPostSettleSequence(moonEl, endX, endY, W, H);
            }
        };
        requestAnimationFrame(animateMoonTrail);

        // Step 3: pan camera into first constellation while moon is floating up
        const cam        = this.cameras.main;
        const targetScrollX = this.constellations[0].wcx - this.W / 2;
        const targetScrollY = this.constellations[0].wcy - this.H / 2;
        const panProg    = { t: 0 };
        cam.setScroll(targetScrollX, targetScrollY - H * 0.38);
        this.tweens.add({
            targets:  panProg,
            t:        1,
            duration: 1400,
            ease:     'Cubic.easeInOut',
            onUpdate: () => {
                cam.scrollY = (targetScrollY - H * 0.38) + H * 0.38 * panProg.t;
            },
            onComplete: () => {
                cam.setScroll(targetScrollX, targetScrollY);
            },
        });

        // Re-wire drag for settled moon along top strip
        let dragging     = false;
        let dragStartX   = 0;
        let phaseAtStart = phase;

        const onMove = (clientX) => {
            if (!dragging) return;
            const delta    = (clientX - dragStartX) / trackW;
            const newPhase = Math.max(0, Math.min(1, phaseAtStart + delta));
            this.moonPhase = newPhase;
            this.drawMoonPhase(newPhase);
            this.positionMoon(newPhase);
            // Update English opacity on any visible text
            if (this.waitingEnglishText.alpha > 0) {
                this.waitingEnglishText.setAlpha(newPhase);
            }
            if (this.englishConstellationText.alpha > 0) {
                this.englishConstellationText.setAlpha(newPhase);
            }
        };
        const onStart = (clientX) => {
            dragging     = true;
            dragStartX   = clientX;
            phaseAtStart = this.moonPhase;
            moonEl.style.cursor = 'grabbing';
        };
        const onEnd = () => {
            dragging = false;
            moonEl.style.cursor = 'grab';
        };

        moonEl.addEventListener('mousedown',  (e) => { e.preventDefault(); onStart(e.clientX); });
        window.addEventListener('mousemove',  (e) => { if (dragging) onMove(e.clientX); });
        window.addEventListener('mouseup',    ()  => { onEnd(); });
        moonEl.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(e.touches[0].clientX); }, { passive: false });
        window.addEventListener('touchmove',  (e) => { if (dragging) { e.preventDefault(); onMove(e.touches[0].clientX); } }, { passive: false });
        window.addEventListener('touchend',   ()  => { onEnd(); });
    }

    // ── spin is now driven directly by moonPhase in onDragMove, no physics loop needed
    updateSpin(delta) {
        if (this._bgWheelsPaused) return;
        const dt = delta * (this._bgWheelsSpeedMult || 1);
        if (this._bgWheelRt)    this._bgWheelRt.angle    += this._bgWheelSpeed    * dt;
        if (this._driftWheelRt) this._driftWheelRt.angle += this._driftWheelSpeed * dt;
        if (this._fgWheelRt)    this._fgWheelRt.angle    += this._fgWheelSpeed    * dt;

        // Rotate camera to carry worldG (constellation) with the stars
        const camDeg = this._driftWheelSpeed * dt;
        this.spinAngle = (this.spinAngle || 0) + camDeg;
        this.cameras.main.setAngle(this.spinAngle);
    }

    // ── Nebula background — very slow parallax, behind all stars ─────────────
    drawNebula(wSize) {
        // We paint the nebula image onto a RenderTexture tiled across the world.
        // scrollFactor 0.012 means it barely drifts as the camera pans — looks
        // like a distant nebula far behind the star field.
        // We use a plain Graphics soft-glow fallback if the image isn't ready,
        // then swap in the image once loaded.

        // Nebula fixed to screen centre, large enough to cover at any rotation
        const S   = Math.round(Math.max(this.W, this.H) * 1.5);
        const rt  = this.add.renderTexture(0, 0, S, S)
                        .setScrollFactor(0).setDepth(0).setAlpha(0.7)
                        .setOrigin(0.5).setPosition(this.W / 2, this.H / 2)
                        .setBlendMode(Phaser.BlendModes.SCREEN);
        this._nebulaWheelRt    = rt;
        this._nebulaWheelSpeed = -360 / 120000;  // 2 min per revolution — slowest

        const paintNebula = (img) => {
            rt.clear();
            if (img) {
                // Scale image to fill RT
                const scaleX = S / img.width;
                const scaleY = S / img.height;
                const scale  = Math.max(scaleX, scaleY);
                const dw = img.width * scale, dh = img.height * scale;
                rt.draw(img, (S - dw) / 2, (S - dh) / 2);
            } else {
                // Glow fallback — rich colours so nebula is clearly visible
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

        // Try to use the nebula image from the HTML page
        if (this.textures.exists('nebula')) {
            paintNebula(this.textures.get('nebula').getSourceImage());
        } else {
            this.load.image('nebula', 'assets/n1-top@3x.png');
            this.load.once('complete', () => {
                paintNebula(this.textures.get('nebula').getSourceImage());
            });
            this.load.start();
            paintNebula(null);  // paint glow fallback immediately
        }

        // Nebula rotation is driven by updateSpin() — no tween needed
        this._nebulaWheelTween = null;
    }

    drawStaticBackground(wSize) {
        const W = this.W;
        const H = this.H;
        // Must be large enough to cover screen at all rotation angles.
        // At 45° a square of side S has diagonal S√2 — so use 1.5× for safety.
        const S = Math.round(Math.max(W, H) * 1.5);

        const rt  = this.add.renderTexture(0, 0, S, S)
            .setScrollFactor(0).setDepth(3).setOrigin(0.5)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setPosition(W / 2, H / 2);
        const tmp = this.make.graphics({ add: false });
        const rng = new Phaser.Math.RandomDataGenerator(['oíche2025']);

        // All background stars are square (1×1 or 2×2) or pixel-cross shaped.
        // No circular blobs — kept small and dim.
        const drawStarStatic = (x, y, r, a) => {
            tmp.fillStyle(0xffffff, a);
            if (r < 1.2) {
                // tiny square
                tmp.fillRect(Math.floor(x), Math.floor(y), 2, 2);
            } else {
                // pixel cross
                const arm = Math.round(r);
                tmp.fillRect(Math.floor(x - arm), Math.floor(y), arm * 2 + 1, 1);
                tmp.fillRect(Math.floor(x), Math.floor(y - arm), 1, arm * 2 + 1);
            }
        };

        // Static layer — boosted brightness so rotation is clearly visible
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

        // Far-field layer — manual rotation in update(), 90s per revolution CCW
        this._bgWheelRt    = rt;
        this._bgWheelSpeed = -360 / 180000;   // 3 min per revolution
        this._bgWheelTween = null;            // no tween — driven by updateSpin()

        // Mid-field layer — denser, slightly faster wheel, opposite direction.
        // Built as a RenderTexture centred on screen so rotation pivots correctly.
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

        // Distribute stars across the full RT area (centred, so from -S/2 to S/2 in local space)
        // but draw into the RT's local coords [0..S]
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

        // Mid-field — manual rotation in update(), 45s per revolution CCW
        this._driftWheelRt    = rt2;
        this._driftWheelSpeed = -360 / 90000;  // 90s per revolution
        this._driftWheelTween = null;           // no tween — driven by updateSpin()

        // Foreground layer — brightest, fastest rotation, sparse large stars
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

        // Foreground rotates fastest — 60s per revolution
        this._fgWheelRt    = rt3;
        this._fgWheelSpeed = -360 / 60000;
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
                completedAt: null,   // set to time.now when completed
            }));

            return {
                id: data.id,
                irishText: data.irishText,
                englishText: data.englishText || '',
                waitingGa: data.waitingGa || '',
                waitingEn: data.waitingEn || '',
                cameraOffsetY: data.cameraOffsetY || 0,
                wcx, wcy, stars, connections, completed: false,
            };
        });
    }

    panCameraTo(idx, animate = true) {
        const c = this.constellations[idx];
        if (!c) return;
        const tx = c.wcx - this.W / 2;
        const ty = c.wcy - this.H / 2 + (c.cameraOffsetY || 0) * this.H;
        if (!animate) { this.cameras.main.setScroll(tx, ty); return; }

        // Arc motion: interpolate from current scroll through a perpendicular
        // midpoint, then into the target — gives a "wheeling through the sky" feel.
        const sx    = this.cameras.main.scrollX;
        const sy    = this.cameras.main.scrollY;
        const dx    = tx - sx, dy = ty - sy;
        const dist  = Math.sqrt(dx * dx + dy * dy) || 1;

        // Perpendicular unit vector (rotate 90°), scaled by ~30% of travel distance
        const arcH  = dist * 0.28;
        const px    = -dy / dist * arcH;
        const py    =  dx / dist * arcH;

        // Mid-arc point (quadratic Bézier control point)
        const mx    = (sx + tx) / 2 + px;
        const my    = (sy + ty) / 2 + py;

        // Animate a progress value 0→1 and evaluate the Bézier each tick
        const cam   = this.cameras.main;
        const prog  = { t: 0 };

        // Kill any ongoing camera tween first
        this.tweens.killTweensOf(cam);
        this.tweens.killTweensOf(prog);

        // ── Parallax sky shift during pan ────────────────────────────────────
        // The camera moves (sx,sy) → (tx,ty) in world space.
        // Background layers are scrollFactor(0) so they don't move at all by default.
        // To fake parallax we temporarily translate them OPPOSITE to camera travel,
        // at a fraction of the camera displacement — deeper layers move less.
        // This makes the sky look like it's turning with you, not sitting still
        // while constellation stars fly across it.

        const camDX = tx - sx;   // total camera travel in world px
        const camDY = ty - sy;

        // Snapshot starting positions of all layers
        const bgLayers = [
            { rt: this._bgWheelRt,    depth: 0.25 },
            { rt: this._driftWheelRt, depth: 0.45 },
            { rt: this._fgWheelRt,    depth: 0.65 },
        ].filter(l => l.rt);

        const startAngles  = bgLayers.map(l => l.rt.angle);
        const startCamAngle = this.spinAngle || 0;

        // Rotation sweep proportional to pan distance — further pans = bigger sky turn
        const panDist   = Math.sqrt(camDX * camDX + camDY * camDY);
        const sweepDeg  = Math.min(panDist * 0.018, 55);
        const sweepSign = -1;  // always CCW

        // Pause auto-rotation — drive manually during pan
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
        });
    }

    showWaitingTexts(c) {
        // Fade in Irish waiting text fully, English at current moonPhase
        this.waitingIrishText.setText(c.waitingGa).setAlpha(0);
        this.waitingEnglishText.setText(c.waitingEn).setAlpha(0);
        this.tweens.add({ targets: this.waitingIrishText,   alpha: 1,               duration: 900, ease: 'Sine.easeIn' });
        this.tweens.add({ targets: this.waitingEnglishText, alpha: this.moonPhase,  duration: 900, ease: 'Sine.easeIn' });
    }

    hideWaitingTexts(onComplete) {
        this.tweens.add({
            targets: [this.waitingIrishText, this.waitingEnglishText],
            alpha: 0, duration: 600, ease: 'Sine.easeOut',
            onComplete,
        });
    }

    startSequencePulse() {
        if (this.pulseTimer) { this.pulseTimer.remove(); this.pulseTimer = null; }
        this.pulseIdx = 0;
        // Mark that player has taken control — from now on wheels pause while working.
        // But don't pause immediately — let sky keep spinning freely until first star touch.
        this._interactionStarted = true;

        // Show waiting texts for the current constellation
        const c = this.constellations[this.currentIndex];
        if (c && c.waitingGa) this.showWaitingTexts(c);

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
        // Collect all unique star indices that are part of pending connections
        const seen = new Set();
        const seq  = [];
        for (const cn of pending) {
            if (!seen.has(cn.from)) { seen.add(cn.from); seq.push(cn.from); }
            if (!seen.has(cn.to))   { seen.add(cn.to);   seq.push(cn.to);   }
        }
        return seq;
    }

    hitR() { return Math.min(this.W, this.H) * 0.09; }

    // Convert a screen-space pointer position to the rotated camera's coordinate space.
    // trailG is scrollFactor(0) so it renders in the camera's rotated screen space —
    // pointer.x/y are in unrotated screen space, so we must rotate them to match.
    screenToRotated(sx, sy) {
        const cx = this.W / 2, cy = this.H / 2;
        const rad = Phaser.Math.DegToRad(this.spinAngle || 0);
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const dx = sx - cx, dy = sy - cy;
        return {
            x: cx + dx * cos + dy * sin,
            y: cy - dx * sin + dy * cos,
        };
    }

    onPointerDown(pointer) {
        // Attempt fullscreen on any game touch — catches cases where moon drag didn't trigger it
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
                // Sky and camera still while player draws
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
                // Play a note immediately if this forms a valid pending connection
                if (this.strokeHits.length >= 2) {
                    const prev = this.strokeHits[this.strokeHits.length - 2];
                    const a = prev.index, b = star.index;
                    const pendingConn = c.connections.find(
                        cn => !cn.completed &&
                              ((cn.from === a && cn.to === b) || (cn.from === b && cn.to === a))
                    );
                    if (pendingConn) this.playStarNote();
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

        // Check every consecutive pair in the stroke against pending connections.
        // Connections are undirected — either orientation is valid.
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
                // Note is played in onPointerMove when the second star is touched.
                // For a single-tap on an already-connected pair, play here as fallback.
                if (this.strokeHits.length === 1) this.playStarNote();
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

        // 1. Fade out waiting texts
        this.hideWaitingTexts(() => {

            // 2. Fade in constellation name (Irish full, English at moonPhase)
            this.time.delayedCall(300, () => {
                this.irishText.setText(c.irishText).setAlpha(0);
                this.tweens.add({ targets: this.irishText, alpha: 1, duration: 900 });

                if (c.englishText) {
                    this.englishConstellationText.setText(c.englishText).setAlpha(0);
                    this.tweens.add({
                        targets: this.englishConstellationText,
                        alpha: this.moonPhase,
                        duration: 900,
                    });
                }

                // 3. After name has shown, fade it out and advance
                this.time.delayedCall(LINE_LINGER_MS + 1200, () => {
                    this.tweens.add({ targets: this.irishText,              alpha: 0, duration: 800 });
                    this.tweens.add({ targets: this.englishConstellationText, alpha: 0, duration: 800 });

                    this.time.delayedCall(900, () => {
                        this.currentIndex++;
                        if (this.currentIndex < this.constellations.length) {
                            this.panCameraTo(this.currentIndex, true);
                            // After pan settles, show next waiting texts and re-enable
                            this.time.delayedCall(2200, () => {
                                this.canInteract = true;
                                this.startSequencePulse();
                            });
                        } else {
                            this.onAllComplete();
                        }
                    });
                });
            });
        });
    }










onAllComplete() {
    this.irishText.setText('Go raibh maith agat').setAlpha(0);
    this.tweens.add({
        targets: this.irishText, alpha: 1, duration: 2000,
        onComplete: () => {
            this.time.delayedCall(2000, () => {
                // Fade to deep indigo
                this.cameras.main.fadeOut(1800, 10, 5, 40);

                this.cameras.main.once('camerafadeoutcomplete', () => {
                    // Shut down the moon overlay cleanly
                    this.shutdown();

                    // Remove the moon canvas directly from body
                    if (this.moonEl && this.moonEl.parentNode) {
                        this.moonEl.parentNode.removeChild(this.moonEl);
                        this.moonEl = null;
                    }

                    // Fire the callback — this triggers initMainHeroSelect() in heroSelect.js
                    if (this._onComplete) {
                        this._onComplete(this.moonPhase, this._frozenAmerginLine);
                    }

                    // Destroy the Phaser game instance and remove its canvas
                    const canvas = this.game.canvas;
                    this.game.destroy(true);
                    canvas.remove();

                    const gameContainer = document.getElementById('gameContainer');
                    if (gameContainer) gameContainer.style.display = 'none';
                });
            });
        },
    });
}







    shutdown() {
        if (this._lyricInterval)  clearInterval(this._lyricInterval);
        if (this.moonOverlay)     { this.moonOverlay.remove(); this.moonOverlay = null; }
        if (this._moonStyle)      { this._moonStyle.remove();  this._moonStyle  = null; }
    }

    initAudio() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AC();

            // Master gain for all constellation sounds
            this._sfxGain = this.audioContext.createGain();
            this._sfxGain.gain.value = 0.28;
            this._sfxGain.connect(this.audioContext.destination);

            // ── My Lagan Love (Cmaj) — pre-parsed note frequencies ────────────────
            // Parsed from ABC: K:Cmaj, L:1/8. Uppercase=C4 oct, lower=C5 oct.
            // B, = B3 (below middle C). _B = Bb, _e = Eb.
            this._starNotes = [
                392.00, 440.01, 493.89, 523.26, 392.00, 349.23, 329.63,  // G A B c G F E
                261.63, 246.95, 261.63, 329.63, 349.23, 329.63,           // C B, C E F E
                261.63, 261.63, 261.63, 261.63,                            // C C C C
                392.00, 440.01, 466.17, 440.01, 493.89, 523.26,           // G A _B A B c
                392.00, 349.23, 329.63, 261.63, 246.95, 261.63,           // G F E C B, C
                329.63, 349.23, 329.63, 261.63, 261.63, 261.63, 261.63,   // E F E C C C C
                329.63, 349.23, 440.01, 392.00, 392.00, 349.23, 329.63,   // E F A G G F E
                349.23, 440.01, 493.89, 523.26, 349.23, 440.01, 392.00,   // F A B c F A G
                440.01, 493.89, 523.26, 622.26, 523.26, 493.89,           // A B c _e c B
                523.26, 392.00, 349.23, 329.63, 261.63, 246.95, 261.63,   // c G F E C B, C
                329.63, 349.23, 329.63, 261.63, 261.63, 261.63,           // E F E C C C
            ];

            this._noteIndex = 0;  // steps forward on each successful star connection

        } catch (e) { console.warn('[audio]', e); }
    }

    // Queue a note — plays at tune tempo regardless of gesture speed
    playStarNote() {
        const ac = this.audioContext;
        if (!ac || !this._sfxGain) return;
        try {
            if (ac.state === 'suspended') { ac.resume(); }
            // Get the next note frequency from the tune
            const freq = this._starNotes[this._noteIndex % this._starNotes.length];
            this._noteIndex++;
            // Schedule it at the next available slot in the note queue
            this._scheduleNote(freq);
        } catch (e) { console.warn('[audio] playStarNote:', e); }
    }

    // Schedule a note at the next available beat slot — never drops, never rushes
    _scheduleNote(freq) {
        const ac = this.audioContext;
        if (!ac) return;
        const NOTE_INTERVAL = 0.32; // seconds per note (~half-note at 90bpm — dignified)
        const now = ac.currentTime;
        // Next available slot: either now, or after the last scheduled note
        if (!this._nextNoteTime || this._nextNoteTime < now) {
            this._nextNoteTime = now + 0.04; // tiny lead to avoid scheduling in past
        }
        const startAt = this._nextNoteTime;
        this._nextNoteTime += NOTE_INTERVAL;

        // Harp pluck: triangle core + faint sawtooth shimmer
        const gain = ac.createGain();
        gain.connect(this._sfxGain);

        const osc1 = ac.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.value = freq;
        osc1.connect(gain);

        const osc2 = ac.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.value = freq * 2.001;
        const osc2g = ac.createGain();
        osc2g.gain.value = 0.06;
        osc2.connect(osc2g);
        osc2g.connect(gain);

        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(0.85, startAt + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + 1.8);

        osc1.start(startAt); osc1.stop(startAt + 1.9);
        osc2.start(startAt); osc2.stop(startAt + 1.9);
    }

    // Strum a resonant C-major chord when a constellation is fully connected.
    playCompletionChord() {
        const ac = this.audioContext;
        if (!ac || !this._sfxGain) return;
        try {
            if (ac.state === 'suspended') { ac.resume(); }

            // Wait for any queued star notes to finish before the chord
            const now     = ac.currentTime;
            const chordAt = Math.max(now + 0.1, this._nextNoteTime || 0);

            // C major harp strum: C2 G2 C3 E3 G3 C4 E4 G4
            const chordFreqs = [
                65.41,  // C2
                98.00,  // G2
                130.81, // C3
                164.81, // E3
                196.00, // G3
                261.63, // C4
                329.63, // E4
                392.00, // G4
            ];

            const masterGain = ac.createGain();
            masterGain.connect(this._sfxGain);
            masterGain.gain.setValueAtTime(0.55, chordAt);
            masterGain.gain.exponentialRampToValueAtTime(0.001, chordAt + 5.5);

            // Light reverb delay
            const delay = ac.createDelay(0.5);
            delay.delayTime.value = 0.24;
            const delayGain = ac.createGain();
            delayGain.gain.value = 0.22;
            masterGain.connect(delay);
            delay.connect(delayGain);
            delayGain.connect(masterGain);

            chordFreqs.forEach((freq, i) => {
                const stagger = i * 0.055;
                const g = ac.createGain();
                g.connect(masterGain);

                const osc = ac.createOscillator();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                osc.connect(g);

                const osc2 = ac.createOscillator();
                osc2.type = 'sine';
                osc2.frequency.value = freq * 2;
                const g2 = ac.createGain();
                g2.gain.value = 0.15;
                osc2.connect(g2);
                g2.connect(g);

                const start = chordAt + stagger;
                g.gain.setValueAtTime(0, start);
                g.gain.linearRampToValueAtTime(1.0, start + 0.012);
                g.gain.exponentialRampToValueAtTime(0.001, start + 5.0);

                osc.start(start);  osc.stop(start + 5.1);
                osc2.start(start); osc2.stop(start + 5.1);
            });

            // Reset note queue so next constellation starts cleanly
            this._noteIndex    = Math.ceil(this._noteIndex / 8) * 8;
            this._nextNoteTime = null;

        } catch (e) { console.warn('[audio] playCompletionChord:', e); }
    }

    // Schedule a single melody note — harp pluck, same timbre as star notes
    _scheduleMelodyNote(freq, startAt) {
        const ac = this.audioContext;
        if (!ac) return;

        const gain = ac.createGain();
        gain.connect(this._sfxGain);

        const osc1 = ac.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.value = freq;
        osc1.connect(gain);

        const osc2 = ac.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.value = freq * 2.001;
        const osc2g = ac.createGain();
        osc2g.gain.value = 0.06;
        osc2.connect(osc2g);
        osc2g.connect(gain);

        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(0.80, startAt + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + 2.0);

        osc1.start(startAt); osc1.stop(startAt + 2.1);
        osc2.start(startAt); osc2.stop(startAt + 2.1);
    }

    _startPostSettleSequence(moonEl, endX, endY, W, H) {
        // Called once the moon rAF animation completes — no jumping possible
        [this.irishOverlayEl, this.englishEl].forEach(el => { if (el) el.remove(); });
        if (this.moonOverlay) { this.moonOverlay.remove(); this.moonOverlay = null; }

        // ── Very slow moon drift upward over the whole scene ─────────────────
        // We animate via rAF so it stays perfectly in sync, no CSS jump-to-from.
        const DRIFT_MS    = 480000;  // 8 minutes
        const moonDriftPx = Math.round(H * 0.06);  // drifts up ~6% of screen height
        const driftStart  = performance.now();
        const driftFromY  = endY;
        const driftToY    = Math.max(0, endY - moonDriftPx);

        const driftLoop = (now) => {
            if (!this.moonEl) return;  // scene shut down
            const t = Math.min((now - driftStart) / DRIFT_MS, 1);
            this.moonEl.style.top = (driftFromY + (driftToY - driftFromY) * t) + 'px';
            if (t < 1) requestAnimationFrame(driftLoop);
        };
        requestAnimationFrame(driftLoop);

        // ── Camera drifts slowly downward — the sky is revealing itself below ─
        const camDriftProg = { t: 0 };
        const camDriftRange = H * 0.14;
        this._moonDriftTween = this.tweens.add({
            targets:  camDriftProg,
            t:        1,
            duration: DRIFT_MS,
            ease:     'Linear',
            onUpdate: () => {
                if (!this.canInteract) return;
                const base = this.constellations[this.currentIndex]
                    ? this.constellations[this.currentIndex].wcy - this.H / 2
                    : this.constellations[0].wcy - this.H / 2;
                this.cameras.main.scrollY = base + camDriftProg.t * camDriftRange;
            },
        });

        // Fade in the world graphics (stars)
        this.tweens.add({
            targets:  this.worldG,
            alpha:    1,
            duration: 1200,
            ease:     'Sine.easeIn',
            onComplete: () => {
                this.canInteract = true;
                this.startSequencePulse();
            },
        });
    }

    _setBgWheelPaused(paused) {
        // Before first interaction the sky always wheels freely.
        if (paused && !this._interactionStarted) return;
        this._bgWheelsPaused = paused;
    }

    spawnRipple(wx, wy) {
        // Each ripple lives for RIPPLE_MS ms, expanding from 0 to RIPPLE_MAX_R
        // and fading from RIPPLE_ALPHA to 0.
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

            // Completed connection lines — bright while lingering, smooth fade to ghost
            for (const conn of c.connections) {
                if (!conn.completed) continue;
                const a = c.stars[conn.from], b = c.stars[conn.to];

                let alpha, width;
                if (conn.completedAt === null) {
                    // Constellation still in progress — hold at full brightness indefinitely
                    alpha = 0.92;
                    width = 2.5;
                } else {
                    // Whole constellation done — linger then fade
                    const age  = now - conn.completedAt;
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

            // Stars
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

        // Ripple rings — expand and fade in world space
        this.rippleG.clear();
        this.ripples = this.ripples.filter(rp => {
            const t = (now - rp.startTime) / RIPPLE_MS;
            if (t >= 1) return false;   // expired
            const ease  = 1 - (1 - t) * (1 - t);   // ease-out quad: fast expand, slow end
            const r     = RIPPLE_MAX_R * ease;
            const alpha = RIPPLE_ALPHA * (1 - t);
            // Outer soft halo ring
            this.rippleG.lineStyle(4, 0x99ddff, alpha * 0.28);
            this.rippleG.strokeCircle(rp.wx, rp.wy, r * 1.18);
            // Main ring
            this.rippleG.lineStyle(1.5, 0xddeeff, alpha);
            this.rippleG.strokeCircle(rp.wx, rp.wy, r);
            return true;
        });

        // Comet trail — segments taper from fat head to invisible tail
        if (this.isDrawing && this.trailPts.length >= 2) {
            this.trailG.clear();
            const pts = this.trailPts;
            const n   = pts.length;

            // Build smoothed points via Catmull-Rom
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
                // t=0 at tail, t=1 at head (finger position)
                const t     = i / (sn - 1);
                const t2    = t * t;           // quadratic — fade fast at tail
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

