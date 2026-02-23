import Phaser from 'phaser';
import { allTunes } from './game/systems/music/allTunes.js';
import * as abcjs from 'abcjs';
import { champions } from '../data/champions.js';

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
                    resolve();
                })
                .catch(e => { console.warn('[ConstellationScene] Asset preload failed:', e); resolve(); });
        };
        img.onerror = () => resolve(); // non-fatal
    });
})();

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
    _fullscreenDone = true;
    try {
        const el = document.documentElement;
        if (document.fullscreenElement || document.webkitFullscreenElement) return;
        if      (el.requestFullscreen)       el.requestFullscreen().catch(() => {});
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen)     el.msRequestFullscreen();
    } catch (e) { console.warn('[ConstellationScene] Fullscreen:', e); }
}

/**
 * Drop-in replacement for initIntroModal(onComplete).
 * Creates a Phaser game running just the ConstellationScene.
 * onComplete(moonPhase, frozenAmerginLine) is called after all constellations are drawn.
 */
export function initConstellationScene(onComplete) {
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
    game.events.once('ready', () => {
        game.registry.set('onComplete', onComplete);
    });

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
    {
        id: 'laoch', irishText: 'An Laoch', englishText: 'The Warrior',
        waitingGa: 'Iompraíonn sé an claíomh is dorcha sa spéir',
        waitingEn: 'He carries the darkest sword in the sky',
        starOffsets: [
            { lx:   0.78, ly:  -1.10 },  // 0 Gamma Per — head
            { lx:   0.21, ly:  -0.68 },  // 1 Mirfak — shoulder (brightest)
            { lx:  -0.33, ly:  -0.44 },  // 2 Delta Per — body upper
            { lx:   0.71, ly:   0.35 },  // 3 Algol — raised sword arm (demon star)
            { lx:  -0.74, ly:   0.46 },  // 4 Epsilon Per — body lower
            { lx:  -0.64, ly:   1.40 },  // 5 Zeta Per — foot
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

        this.cameras.main.setBackgroundColor('#00060f');

        const wSize  = 5000;
        this.worldCX = wSize / 2;
        this.worldCY = wSize / 2;
        this.cameras.main.setBounds(0, 0, wSize, wSize);

        // Nebula layer — behind everything, very slow parallax
        this.drawNebula(wSize);

        this.drawStaticBackground(wSize);

        this.worldG  = this.add.graphics().setDepth(10);
        this.rippleG = this.add.graphics().setDepth(11);
        this.trailG  = this.add.graphics().setScrollFactor(0).setDepth(13);

        const textSize     = Math.round(Math.min(this.W, this.H) * 0.055);
        const subTextSize  = Math.round(Math.min(this.W, this.H) * 0.036);
        const textY        = this.H * 0.80;
        const subY         = textY + Math.round(Math.min(this.W, this.H) * 0.068);

        // Constellation name texts (shown on completion) — Aonchlo gold / Courier green
        this.irishText = this.add
            .text(this.W / 2, textY, '', {
                fontFamily: 'Aonchlo, serif',
                fontSize: textSize + 'px',
                color: '#d4af37', stroke: '#000a1a', strokeThickness: 3,
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
                color: '#d4af37', stroke: '#000a1a', strokeThickness: 3,
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

        this.buildConstellations(wSize);
        this.panCameraTo(0, false);

        // Hide all constellation graphics until moon has settled
        this.worldG.setAlpha(0);

        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup',   this.onPointerUp,   this);

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
            'display:flex;flex-direction:column;',
            'align-items:center;justify-content:center;',
        ].join('');
        this.moonOverlay = overlay;

        // Irish text — Aonchlo, gold, same size as introModal's 1.8rem equivalent
        const irishEl = document.createElement('div');
        irishEl.textContent = line.ga;
        irishEl.style.cssText = [
            'font-family:Aonchlo,serif;',
            `font-size:${Math.round(Math.min(W, H) * 0.052)}px;`,
            'color:#d4af37;text-align:center;',
            'text-shadow:0 0 18px rgba(0,0,0,0.9);',
            'padding:0 1.5rem;margin-bottom:0.6em;',
            'pointer-events:none;',
            'opacity:1;transition:opacity 0.8s ease-in-out;',
        ].join('');
        this.irishOverlayEl = irishEl;

        // English text — Courier New, green, starts near-invisible
        const enEl = document.createElement('div');
        enEl.textContent = line.en;
        enEl.style.cssText = [
            'font-family:"Courier New",monospace;',
            `font-size:${Math.round(Math.min(W, H) * 0.038)}px;`,
            'color:rgb(0,255,0);text-align:center;',
            'text-shadow:0 0 12px rgba(0,0,0,0.9);',
            'padding:0 1.5rem;margin-bottom:1.4em;',
            'pointer-events:none;',
            'opacity:0.05;transition:opacity 0.5s ease;',
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
        overlay.appendChild(moonCanvas);
        document.body.appendChild(overlay);

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
        glow.addColorStop(0,   `rgba(200,220,255,${0.08 + phase * 0.14})`);
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

        // Base disc: dark side colour
        ctx.fillStyle = '#0a0e1a';
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

        // Fade out Irish/English text
        [this.irishOverlayEl, this.englishEl].forEach(el => {
            if (el) { el.style.transition = 'opacity 0.6s'; el.style.opacity = '0'; }
        });

        // Step 1: gently reverse the sky rotation back to 0° over ~1.4s
        this.tweens.add({
            targets:  this,
            spinAngle: 0,
            duration: 1400,
            ease:     'Sine.easeInOut',
            onUpdate: () => { this.cameras.main.setAngle(this.spinAngle); },
        });

        // Step 2: simultaneously snap moon's vertical to its top-strip position
        // We do this via CSS transition so it looks like the camera pans down
        // to reveal the starfield below, with the moon staying fixed in the sky.
        moonEl.style.transition = `left 0.9s cubic-bezier(0.4,0,0.2,1), top 1.2s cubic-bezier(0.4,0,0.2,1)`;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            moonEl.style.left = endX + 'px';
            moonEl.style.top  = endY + 'px';
        }));

        // Step 3: while moon flies up, pan camera downward so the sky scrolls
        // into view — making it look like we're looking down at the stars, not
        // that the moon moved up.
        const cam       = this.cameras.main;
        const panOffset = H * 0.38;   // how far to pan: roughly where moon started
        const panProg   = { t: 0 };
        const startScrollY = cam.scrollY;
        this.tweens.add({
            targets:  panProg,
            t:        1,
            duration: 1400,
            ease:     'Cubic.easeInOut',
            onUpdate: () => {
                // Interpolate scroll toward the "constellation starting" position
                // which panCameraTo(0) already set — we just nudge it by panOffset
                // and let it settle back. Result: camera scrolls smoothly downward.
                cam.scrollY = startScrollY + panOffset * panProg.t;
            },
            onComplete: () => {
                // Now snap to the correct constellation position cleanly
                this.panCameraTo(0, false);
            },
        });

        // Step 4: after everything settles, fade in stars then activate constellations
        setTimeout(() => {
            [this.irishOverlayEl, this.englishEl].forEach(el => { if (el) el.remove(); });
            moonEl.style.transition = '';

            // Fade in the world graphics (stars)
            this.tweens.add({
                targets: this.worldG,
                alpha: 1,
                duration: 1200,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    this.canInteract = true;
                    this.startSequencePulse();
                },
            });
        }, 1600);

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
        // No-op after init — rotation is set directly in onDragMove and tweened in settleMoon
    }

    // ── Nebula background — very slow parallax, behind all stars ─────────────
    drawNebula(wSize) {
        // We paint the nebula image onto a RenderTexture tiled across the world.
        // scrollFactor 0.012 means it barely drifts as the camera pans — looks
        // like a distant nebula far behind the star field.
        // We use a plain Graphics soft-glow fallback if the image isn't ready,
        // then swap in the image once loaded.

        const S   = Math.max(this.W, this.H) * 2.4;  // large enough to cover any pan
        const rt  = this.add.renderTexture(wSize / 2 - S / 2, wSize / 2 - S / 2, S, S)
                        .setScrollFactor(0.012).setDepth(-1).setAlpha(0.38);

        const paintNebula = (img) => {
            rt.clear();
            const g = this.make.graphics({ add: false });
            // Dark base
            g.fillStyle(0x00060f, 1);
            g.fillRect(0, 0, S, S);
            rt.draw(g, 0, 0);
            g.destroy();

            if (img) {
                // Draw nebula image centred, covering the RT, slightly rotated
                rt.draw(img, S / 2 - img.width / 2, S / 2 - img.height / 2);
            } else {
                // Soft radial glow fallback
                const fg = this.make.graphics({ add: false });
                const positions = [[0.3,0.4],[0.7,0.3],[0.5,0.7],[0.2,0.7],[0.8,0.6]];
                for (const [px, py] of positions) {
                    fg.fillGradientStyle(0x1a0a3a, 0x0a1a3a, 0x000820, 0x000820, 0.18, 0.14, 0, 0);
                    fg.fillCircle(S * px, S * py, S * 0.22);
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

        // Very slow rotation tween to match the HTML starfield's nebula drift
        this.tweens.add({
            targets:  rt,
            angle:    360,
            duration: 600000,   // one full rotation in 10 minutes
            repeat:   -1,
            ease:     'Linear',
        });
    }

    drawStaticBackground(wSize) {
        // Use the larger dimension so RT covers full screen in any orientation
        const W = this.W;
        const H = this.H;
        const S = Math.max(W, H);   // square — covers portrait AND landscape

        const rt  = this.add.renderTexture(0, 0, S, S).setScrollFactor(0.03).setDepth(0);
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

        // Static layer is now SPARSE — fewer stars, softer
        for (const l of [
            { n: 400,  minR: 0.6, maxR: 1.0, minA: 0.12, maxA: 0.28 },
            { n: 120,  minR: 1.0, maxR: 1.5, minA: 0.18, maxA: 0.38 },
            { n: 30,   minR: 1.4, maxR: 2.0, minA: 0.22, maxA: 0.44 },
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

        // Drifting mid-field layer — now DENSER, with occasional twinkling
        const rng2 = new Phaser.Math.RandomDataGenerator(['réaltaí2']);
        const span = wSize * 0.18;

        // Collect star data so we can tween some of them
        this._twinkleStars = [];

        // Build layer as individual Image objects so we can tween alpha per-star.
        // For performance, most are drawn into a graphics object; only a random
        // subset (~12%) are promoted to twinkle candidates.
        const g2 = this.add.graphics().setDepth(1).setScrollFactor(0.10);

        const starDefs = [
            { n: 1600, minR: 0.6, maxR: 1.1, minA: 0.15, maxA: 0.38 },
            { n: 500,  minR: 1.0, maxR: 1.6, minA: 0.22, maxA: 0.50 },
            { n: 120,  minR: 1.4, maxR: 2.2, minA: 0.28, maxA: 0.58 },
        ];

        const drawStarDrift = (g, x, y, r, a) => {
            g.fillStyle(0xffffff, a);
            if (r < 1.2) {
                g.fillRect(Math.floor(x), Math.floor(y), 2, 2);
            } else {
                const arm = Math.round(r);
                g.fillRect(Math.floor(x - arm), Math.floor(y), arm * 2 + 1, 1);
                g.fillRect(Math.floor(x), Math.floor(y - arm), 1, arm * 2 + 1);
            }
        };

        for (const l of starDefs) {
            for (let i = 0; i < l.n; i++) {
                const x = rng2.realInRange(0, span);
                const y = rng2.realInRange(0, span);
                const r = rng2.realInRange(l.minR, l.maxR);
                const a = rng2.realInRange(l.minA, l.maxA);

                // ~12% of drifting stars become twinkle candidates
                if (rng2.realInRange(0, 1) < 0.12) {
                    // Draw as a tiny RenderTexture so we can tween its alpha
                    const size = r < 1.2 ? 3 : Math.round(r) * 2 + 3;
                    const trt  = this.add.renderTexture(x, y, size, size)
                        .setScrollFactor(0.10).setDepth(1).setOrigin(0, 0);
                    const tg   = this.make.graphics({ add: false });
                    tg.fillStyle(0xffffff, 1);
                    if (r < 1.2) {
                        tg.fillRect(0, 0, 2, 2);
                    } else {
                        const arm = Math.round(r);
                        const cx  = Math.floor(size / 2);
                        tg.fillRect(cx - arm, cx, arm * 2 + 1, 1);
                        tg.fillRect(cx, cx - arm, 1, arm * 2 + 1);
                    }
                    trt.draw(tg, 0, 0);
                    tg.destroy();
                    trt.setAlpha(a);
                    this._twinkleStars.push({ rt: trt, baseAlpha: a });
                } else {
                    drawStarDrift(g2, x, y, r, a);
                }
            }
        }

        // Schedule staggered slow twinkles
        this._twinkleStars.forEach((s, idx) => {
            const delay  = rng2.integerInRange(0, 12000);
            const dur    = rng2.integerInRange(1800, 4500);
            const loAlpha = Math.max(0.03, s.baseAlpha * 0.25);
            this.time.delayedCall(delay, () => {
                this.tweens.add({
                    targets:  s.rt,
                    alpha:    loAlpha,
                    duration: dur,
                    ease:     'Sine.easeInOut',
                    yoyo:     true,
                    repeat:   -1,
                    repeatDelay: rng2.integerInRange(3000, 9000),
                });
            });
        });
    }

    buildConstellations(wSize) {
        const usable = Math.min(this.W, this.H) * 0.68;
        this.constellations = CONSTELLATION_DATA.map((data, idx) => {
            const theta = SPIRAL_B + idx * SPIRAL_STEP;
            const r     = SPIRAL_A * (1 + idx * 0.4);
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
                wcx, wcy, stars, connections, completed: false,
            };
        });
    }

    panCameraTo(idx, animate = true) {
        const c = this.constellations[idx];
        if (!c) return;
        const tx = c.wcx - this.W / 2;
        const ty = c.wcy - this.H / 2;
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

        this.tweens.add({
            targets:  prog,
            t:        1,
            duration: 3000,
            ease:     'Cubic.easeInOut',   // heavy ease-in, heavy ease-out
            onUpdate: () => {
                const t  = prog.t;
                const it = 1 - t;
                // Quadratic Bézier: B(t) = (1-t)²·P0 + 2(1-t)t·Pm + t²·P1
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

    onPointerDown(pointer) {
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
                this.trailPts   = [{ x: pointer.x, y: pointer.y }];
                star.lit        = true;
                this.tweens.killTweensOf(star);
                star.brightness = 2.0;
                this.spawnRipple(star.wx, star.wy);
                break;
            }
        }
    }

    onPointerMove(pointer) {
        if (!this.isDrawing) return;

        this.smoothX += (pointer.x - this.smoothX) * TRAIL_SMOOTH;
        this.smoothY += (pointer.y - this.smoothY) * TRAIL_SMOOTH;

        const last = this.trailPts[this.trailPts.length - 1];
        const dx = this.smoothX - last.x, dy = this.smoothY - last.y;
        if (dx * dx + dy * dy >= 2) {
            this.trailPts.push({ x: this.smoothX, y: this.smoothY });
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
                    if (this._onComplete) {
                        this._onComplete(this.moonPhase, this._frozenAmerginLine);
                    }
                });
            },
        });
    }

    shutdown() {
        if (this._lyricInterval) clearInterval(this._lyricInterval);
        if (this.moonOverlay)    this.moonOverlay.remove();
        if (this._moonStyle)     this._moonStyle.remove();
    }

    initAudio() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AC();
        } catch (e) { console.warn('[audio]', e); }
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

