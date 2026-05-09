import Phaser from 'phaser';
import Player from '../../player/player.js';
import BowMechanics from '../../combat/bowMechanics.js';
import PerspectiveGroundRenderer from '../../effects/perspectiveGroundRenderer.js';
import CreatureSheetHelper from '../../ui/inventory/creatureSheetHelper.js';
import ItemSheetHelper from '../../ui/inventory/itemSheetHelper.js';

import { initReturnCrossing } from '../../scenes/returnCrossing.js';

import TextPanel from '../../ui/textPanel.js';
import { ScrollingTextPlayer } from '../../ui/scrollingTextPlayer.js';
import { GameSettings } from '../../settings/gameSettings.js';
import { createMoonWidget } from '../../ui/moonWidget.js';
import AdvancedTraining from '../../scenes/locations/advancedTraining.js';
import { createStatusBar } from '../../ui/statusBar.js';


export default class BowTutorial extends Phaser.Scene {
    constructor() {
        super({ key: 'BowTutorial' });
    }

    preload() {
        this.load.audio('metalSwoosh1', '/assets/sounds/metalSwoosh1.wav');
        this.load.audio('metalSwoosh2', '/assets/sounds/metalSwoosh2.wav');
        this.load.audio('metalSwoosh4', '/assets/sounds/metalSwoosh4.wav');

        this.load.image('item_simple_bow', 'assets/inventory/W_Bow02.png');
        this.load.image('glowCursor', 'assets/glowCursor.png');

        this.load.audio('creak1',           'assets/sounds/creak1.wav');
        this.load.audio('arrowShoot1',      'assets/sounds/arrowShoot1.wav');
        this.load.audio('arrowShoot2',      'assets/sounds/arrowShoot2.wav');
        this.load.audio('arrowShoot3',      'assets/sounds/arrowShoot3.wav');
        this.load.audio('pumpkin_break_01', 'assets/sounds/pumpkin_break_01.ogg');
        this.load.audio('parrySound',       'assets/sounds/parry.mp3');

        this.load.image('cape',                    'assets/cape.png');
        this.load.image('championSheet_unarmored', 'assets/champions/champions-no-kit.png');
        this.load.image('championSheet_armored',   'assets/champions/champions-with-kit.png');
        this.load.image('arrowTexture',            'assets/arrow1.png');
        this.load.json('championAtlas',            'assets/champions/champions0.json');

        this.load.image('scathach', 'assets/sc01.png');
        this.load.spritesheet('dragon', 'assets/dragonFrames.png', {
            frameWidth: 500, frameHeight: 359,
        });

        this.load.image('oryxTiles',     '/assets/oryx/oryx_16bit_fantasy_world_trans.png');
        this.load.image('oryxItems',     '/assets/oryx/oryx_16bit_fantasy_items_trans.png');
        this.load.image('oryxCreatures', '/assets/oryx/oryx_16bit_fantasy_creatures_trans.png');
        this.load.json('oryxCatalogue',  '/assets/oryx/oryxCatalogue.json');
        this.load.json('bowTutorialData', '/maps/bowTutorial.json?v=' + Date.now());
    }

    init(data) {
        console.log('[BowTutorial] *** INIT CALLED ***');
        console.trace();
    }

    // ── Hit tracker ───────────────────────────────────────────────────────────
    resetHitTracker() {
        if (!this.hitTrackerCircles) return;
        this.hitTrackerCircles.forEach((circle) => {
            this.tweens.killTweensOf(circle.inner);
            this.tweens.killTweensOf(circle.outer);
            circle.filled = false;
            circle.inner.setVisible(false);
            circle.inner.setAlpha(0);
            circle.inner.setScale(1);
            circle.outer.setAlpha(1);
        });
    }

    createHitTracker() {
        const screenWidth = this.scale.width;
        const startX  = screenWidth - 180;
        const startY  = 80;
        const spacing = 40;

        this.hitTrackerCircles = [];

        for (let i = 0; i < 4; i++) {
            const x = startX + (i * spacing);
            const y = startY;

            const outer = this.add.circle(x, y, 15, 0xffffff, 0);
            outer.setStrokeStyle(3, 0xd4af37);
            outer.setDepth(3000);
            outer.setScrollFactor(0);

            const inner = this.add.circle(x, y, 12, 0xffd700, 1);
            inner.setDepth(3001);
            inner.setScrollFactor(0);
            inner.setVisible(false);

            this.hitTrackerCircles.push({ outer, inner, filled: false });
        }
    }

    updateHitTracker(consecutiveHits) {
        if (this.hitTrackerComplete) return;
        if (!this.hitTrackerCircles) return;

        this.hitTrackerCircles.forEach((circle, index) => {
            if (index < consecutiveHits && !circle.filled) {
                circle.filled = true;
                circle.inner.setVisible(true);
                circle.inner.setAlpha(0);
                circle.inner.setScale(1);

                this.tweens.add({
                    targets:  circle.inner,
                    alpha:    1,
                    scale:    1.3,
                    duration: 200,
                    ease:     'Back.easeOut',
                    onComplete: () => {
                        this.tweens.add({
                            targets:  circle.inner,
                            alpha:    1,
                            scale:    1.3,
                            duration: 200,
                            ease:     'Back.easeOut',
                            onComplete: () => {
                                this.tweens.add({
                                    targets:  circle.inner,
                                    scale:    1,
                                    duration: 150,
                                    ease:     'Power2',
                                });
                                if (index === this.hitTrackerCircles.length - 1 && !this.hitTrackerComplete) {
                                    this.completeHitTracker();
                                }
                            },
                        });
                    },
                });

                this.tweens.add({
                    targets:  circle.outer,
                    alpha:    1,
                    duration: 100,
                    yoyo:     true,
                    repeat:   2,
                });

            } else if (index >= consecutiveHits && circle.filled) {
                circle.filled = false;
                this.tweens.add({
                    targets:  circle.inner,
                    alpha:    0,
                    scale:    0.5,
                    duration: 200,
                    ease:     'Power2',
                    onComplete: () => { circle.inner.setVisible(false); },
                });
            }
        });
    }

    completeHitTracker() {
        if (this.hitTrackerComplete) return;
        this.hitTrackerComplete = true;

        this.hitTrackerCircles.forEach(circle => {
            this.tweens.killTweensOf(circle.inner);
            this.tweens.killTweensOf(circle.outer);
        });

        this.hitTrackerCircles.forEach(circle => {
            this.tweens.add({
                targets:  [circle.inner, circle.outer],
                alpha:    0,
                duration: 120,
                yoyo:     true,
                repeat:   3,
                ease:     'Linear',
            });
        });

        this.time.delayedCall(2000, () => {
            this.hitTrackerCircles.forEach(circle => {
                this.tweens.add({
                    targets:  [circle.inner, circle.outer],
                    alpha:    0,
                    duration: 400,
                    ease:     'Power2',
                    onComplete: () => {
                        circle.inner.setVisible(false);
                        circle.outer.setVisible(false);
                    },
                });
            });
        });
    }

    // ── create ────────────────────────────────────────────────────────────────
    create() {
        console.log('BowTutorial: starting');
        this.hitLocked = false;

        // Create status bar via shared module — same as bogLocationScene
        this._statusBar = createStatusBar(document.getElementById('gameContainer'));
        this.tutorialData = this.cache.json.get('bowTutorialData');
        this.hitTrackerComplete = false;

        if (!this.tutorialData) {
            console.error('BowTutorial: Tutorial data not found!');
            return;
        }

        const screenWidth  = this.scale.width;
        const screenHeight = this.scale.height;

        const champion = this.registry.get('selectedChampion') ||
                         window.selectedChampion ||
                         { id: 'demo', nameGa: 'Demo', row: 0, col: 0 };

        this.champion = champion;
        this.tileSize = 48;

        // Tall narrow map — 14 cols, 50 rows gives a deep field toward horizon
        const MW = 14, MH = 50, BOG = 733;
        const layer0 = Array.from({ length: MH }, () => Array(MW).fill(BOG));
        this.mapData = {
            width: MW, height: MH,
            layers: [layer0, Array.from({ length: MH }, () => Array(MW).fill(0))],
            tiles:  layer0,
        };

        const PLAYER_ROW = 18;
        const playerX = 4 * this.tileSize + this.tileSize / 2;
        const playerY = PLAYER_ROW * this.tileSize + this.tileSize / 2;

        try {
            this.player = new Player(this, playerX, playerY, champion);
        } catch(e) {
            console.error('[BowTutorial] Player constructor error:', e);
            return;
        }
        if (!this.player) {
            console.error('[BowTutorial] Player is undefined after construction');
            return;
        }
        this.player.canMove = false;

        this.perspectiveGround = new PerspectiveGroundRenderer(this);
        this.perspectiveGround.setPlayer(this.player);

        this.game.renderer.gl?.clearColor(0, 0, 0, 0);
        this.game.canvas.style.background = 'transparent';
        const container = document.getElementById('gameContainer');
if (container) container.style.background = '#b5956a';
        this.perspectiveGround.setPlayerScale(2.0);
        this.perspectiveGround.setLighting({
            darkness:     0.0,
            radius:       0.8,
            groundColour: 'rgba(0,0,0,0)',
        });

        this.perspectiveGround.setMood('bog_threshold');

        this.time.delayedCall(400, () => {
            if (this.perspectiveGround) {
                this.perspectiveGround._gcR = 'rgba(0,0,0,0)';
                this.perspectiveGround._lastCamX = null;
            }
        });

        this.itemSheet     = new ItemSheetHelper(this);
        this.creatureSheet = new CreatureSheetHelper(this);
        this.bowMechanics  = new BowMechanics(this, this.player);
        this.textPanel     = new TextPanel(this);
        this.storyPlayer   = null;

        this.hitCount          = 0;
        this.missCount         = 0;
        this.bullseyeHits      = 0;
        this.consecutiveHits   = 0;
        this.consecutiveMisses = 0;
        this.NARRATIVE_THRESHOLD = 3;
        this.usedHitDialogues  = [];
        this.usedMissDialogues = [];
        this.tutorialComplete  = false;

        this._createMountainBg();
        this.addSettingsSlider();

        // ── Resize handler — reposition screen-space objects on fullscreen toggle
        this._boundOnResize = () => this._onResize();
        this.scale.on('resize', this._boundOnResize);

        this.events.once('shutdown', () => {
            // Remove resize listener
            this.scale.off('resize', this._boundOnResize);

            ;['pgr-ground','pgr-objects','pgr-light','pgr-sky','pgr-sky-img','pgr-fog'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            const container = document.getElementById('gameContainer');
            if (container) container.style.background = '';

            if (this._mountainBgEl)     { this._mountainBgEl.remove();       this._mountainBgEl     = null; }
            if (this._mountainBgResize) { window.removeEventListener('resize', this._mountainBgResize); this._mountainBgResize = null; }
            if (this._moonWidget)       { this._moonWidget.destroy();         this._moonWidget       = null; }
            if (this.storyPlayer)       { this.storyPlayer.destroy();         this.storyPlayer       = null; }
            if (this._flashPlayer)      { this._flashPlayer.destroy();        this._flashPlayer      = null; }
            if (this.perspectiveGround) { this.perspectiveGround.destroy();   this.perspectiveGround = null; }
            if (this.itemSheet)         { this.itemSheet.clear();             this.itemSheet         = null; }
            if (this.creatureSheet)     { this.creatureSheet.clear();         this.creatureSheet     = null; }
            if (this.bowMechanics)      { this.bowMechanics.destroy();        this.bowMechanics      = null; }

            if (this._statusBar?.parentNode) {
                this._statusBar.parentNode.removeChild(this._statusBar);
                this._statusBar = null;
            }
        });

        this.showExposition();
        this.createScathach();

        this.advancedTraining = new AdvancedTraining(this);

        this.predictionDot = this.add.circle(0, 0, 5, 0xff0000, 0.8);
        this.predictionDot.setDepth(100);
        this.predictionDot.setVisible(false);

        this.createHitTracker();
    }

    // ── Resize handler ────────────────────────────────────────────────────────
    // Called when the screen size changes (e.g. fullscreen toggle).
    // Targets and Scáthach are positioned in screen-space so they must be
    // recreated / repositioned to match the new dimensions.
    _onResize() {
        // Give PGR one frame to re-layout before we re-project
        this.time.delayedCall(50, () => {
            // Recreate the current target at its correct screen position
            if (this.target && !this.tutorialComplete) {
                // Step back the index so createTarget() reuses the same slot
                this.currentTargetIndex = (this.currentTargetIndex ?? 0) - 1;
                if (this.currentTargetIndex < 0) this.currentTargetIndex = 4;
                if (this._targetTween) { this._targetTween.stop(); this._targetTween = null; }
                this.target.destroy();
                this.target = null;
                this.createTarget();
            }

            // Reposition Scáthach to match new screen dimensions
            if (this.scathach) {
                const sw = this.scale.width;
                const sh = this.scale.height;
                const nx = sw * 0.82;
                const ny = sh * 0.62;
                this.scathach.setPosition(nx, ny);
                if (this.scathachHitbox) this.scathachHitbox.setPosition(nx, ny);
                if (this.cape) this.cape.setPosition(nx - 18, ny - 18);
            }

            // Reposition hit tracker circles
            if (this.hitTrackerCircles) {
                const startX  = this.scale.width - 180;
                const startY  = 80;
                const spacing = 40;
                this.hitTrackerCircles.forEach((circle, i) => {
                    circle.outer.setPosition(startX + i * spacing, startY);
                    circle.inner.setPosition(startX + i * spacing, startY);
                });
            }
        });
    }

    // ── Mountain background ─────────────────────────────────────────────────
_createMountainBg() {
    if (this._mountainBgEl) return;

    const container = document.getElementById('gameContainer');
    if (!container) return;

    const img = document.createElement('img');
    img.src = '/assets/skies/skye.png';

    img.style.cssText = [
        'position:absolute;',
        'top:0;left:0;',
        'width:100%;',
        'height:50%;',           // covers sky region above PGR horizon (~28vh)
        'object-fit:cover;',
        'object-position:center top;',
        'z-index:0;',            // behind pgr-ground (1), pgr-objects (2)
        'pointer-events:none;',
    ].join('');

    img.style.webkitMaskImage = 'linear-gradient(to bottom, black 70%, transparent 100%)';
    img.style.maskImage        = 'linear-gradient(to bottom, black 70%, transparent 100%)';

    
img.onload = () => {
    console.log('[BowTutorial] mountain bg loaded');
    if (this.perspectiveGround) {
        this.perspectiveGround._extractPaletteFromImage(img);
        // _extractPaletteFromImage is synchronous (canvas drawImage + getImageData)
        // so _gcR is already set by the time we get here — just override it now
        this.perspectiveGround._gcR = 'hsl(35, 25%, 32%)';
        this.perspectiveGround._lastCamX = null;
    }
};
img.onerror = () => console.warn('[BowTutorial] mountain bg failed:', img.src);

    container.appendChild(img);
    this._mountainBgEl = img;
    this._mountainBgResize = null;
}

    // ── Moon widget ───────────────────────────────────────────────────────────

    addSettingsSlider() {
        if (this._moonWidget) {
            this._moonWidget.destroy();
            this._moonWidget = null;
        }

        this._moonWidget = createMoonWidget({
            initialPhase : GameSettings.englishOpacity ?? 0.7,
            showSlider   : false,
            corner       : 'bottom-center',
            onChange     : (phase) => {
                GameSettings.setEnglishOpacity(phase);
                if (this.textPanel) this.textPanel.updateEnglishOpacity?.();
                for (const player of [this.storyPlayer, this._flashPlayer]) {
                    if (!player?._lineEls) continue;
                    for (const entry of player._lineEls) {
                        if (entry.enEl) entry.enEl.style.opacity = String(phase);
                    }
                }
            },
        });
    }

    // ── Bullseye effect ───────────────────────────────────────────────────────
    showBullseyeEffect(x, y) {
        const ring = this.add.graphics();
        ring.setDepth(101);
        ring.lineStyle(3, 0xffd700, 1);
        ring.strokeCircle(x, y, 10);

        this.tweens.add({
            targets:  ring,
            alpha:    0,
            duration: 600,
            ease:     'Power2',
            onUpdate: () => {
                ring.clear();
                ring.lineStyle(3, 0xffd700, ring.alpha);
                ring.strokeCircle(x, y, 10 + (1 - ring.alpha) * 30);
            },
            onComplete: () => ring.destroy(),
        });

        const bullseyeText = this.add.text(x, y - 30, 'SÚIL NA SPRICE!', {
            fontSize:   '16px',
            fontFamily: 'monospace',
            color:      '#ffd700',
            fontStyle:  'bold',
        }).setOrigin(0.5);
        bullseyeText.setDepth(102);

        this.tweens.add({
            targets:    bullseyeText,
            y:          y - 60,
            alpha:      0,
            duration:   800,
            ease:       'Power2',
            onComplete: () => bullseyeText.destroy(),
        });
    }

    // ── Exposition ────────────────────────────────────────────────────────────
    showExposition() {
        const exposition = this.tutorialData.narrative.exposition;
        if (!exposition || exposition.length === 0) return;

        this.narrativeInProgress = true;

        const lines = exposition.map(e => ({
            ga:      e.irish,
            en:      e.english,
            speaker: 'queen',
        }));

        this.time.delayedCall(1500, () => { if (!this.target) this.createTarget(); });

        this._showStoryLines(lines, () => {
            this.narrativeInProgress = false;
            if (!this.target) this.time.delayedCall(300, () => { this.createTarget(); });
        });
    }

    getRandomDialogue(pool, usedArray) {
        const unused = pool.filter((d, i) => !usedArray.includes(i));
        if (unused.length === 0) { usedArray.length = 0; return pool[0]; }
        const randomIndex = Phaser.Math.Between(0, unused.length - 1);
        const dialogue    = unused[randomIndex];
        usedArray.push(pool.indexOf(dialogue));
        return dialogue;
    }

    // ── Story lines ───────────────────────────────────────────────────────────
    _showStoryLines(lines, onComplete) {
        if (this.storyPlayer) { this.storyPlayer.destroy(); this.storyPlayer = null; }

        const canvas    = this.sys.game.canvas;
        const container = canvas.parentElement || document.body;

        this.storyPlayer = new ScrollingTextPlayer({
            lines,
            getMoonPhase: () => GameSettings.englishOpacity ?? 0.7,
            onComplete: () => {
                this.storyPlayer = null;
                if (onComplete) onComplete();
            },
            container,
        });

        this.storyPlayer.start();

        const vel = 50 / 60;
        this.storyPlayer._naturalVel     = vel;
        this.storyPlayer._velocity       = vel;
        this.storyPlayer._ceilingY       = 999999;
        this.storyPlayer._onReachCeiling = function() {};
        this.storyPlayer._onComplete     = function() {};

        const H      = window.innerHeight;
        this.storyPlayer._scrollY = H * 0.5;

        const SLIDER_H = 0;
        const topZoneH = H * 0.5 - SLIDER_H;
        if (this.storyPlayer._hitZone) {
            const hz = this.storyPlayer._hitZone;
            hz.style.top           = SLIDER_H + 'px';
            hz.style.height        = topZoneH + 'px';
            hz.style.bottom        = '';
            hz.style.pointerEvents = 'all';
        }
        if (this.storyPlayer._overlay) {
            this.storyPlayer._overlay.style.pointerEvents = 'none';
        }

        const CEIL_PX = SLIDER_H + 8;
        const FADE_PX = 80;
        const MID_PX  = H * 0.5;
        this.storyPlayer._render = function() {
            if (!this._overlay) return;
            const mp = this._getMoonPhase();
            for (const entry of this._lineEls) {
                const y      = this._screenY(entry);
                const bottom = y + entry.wrapper.offsetHeight;
                entry.wrapper.style.top = y + 'px';
                if (bottom < 0 || y > MID_PX + 40) {
                    entry.gaEl.style.opacity = '0';
                    if (entry.enEl) entry.enEl.style.opacity = '0';
                    continue;
                }
                let alpha = 1;
                if (y < CEIL_PX + FADE_PX) alpha = Math.max(0, (y - CEIL_PX) / FADE_PX);
                if (bottom > MID_PX - FADE_PX) alpha = Math.min(alpha, Math.max(0, (MID_PX - y) / FADE_PX));
                entry.gaEl.style.opacity = String(alpha);
                if (entry.enEl) {
                    entry.enEl.style.opacity = String(mp);
                    entry.enEl.style.color   = '#c084fc';
                }
            }
        };

        const stp  = this.storyPlayer;
        const poll = setInterval(() => {
            if (!stp || !stp._lineEls) { clearInterval(poll); return; }
            const last = stp._lineEls[stp._lineEls.length - 1];
            if (!last) return;
            if (stp._screenY(last) + (last.wrapper.offsetHeight || 60) < 0) {
                clearInterval(poll);
                stp._running = false;
                if (stp._overlay) { stp._overlay.style.transition = 'opacity 0.8s ease'; stp._overlay.style.opacity = '0'; }
                setTimeout(() => { if (stp.destroy) stp.destroy(); if (onComplete) onComplete(); }, 900);
            }
        }, 150);
    }

    // ── Flash line ────────────────────────────────────────────────────────────
    _flashLine(irish, english) {
        if (this.narrativeInProgress) return;
        if (this._flashPlayer) { this._flashPlayer.destroy(); this._flashPlayer = null; }

        const canvas    = this.sys.game.canvas;
        const container = canvas.parentElement || document.body;
        const H         = window.innerHeight;
        const SLIDER_H  = 0;

        this._flashPlayer = new ScrollingTextPlayer({
            lines:        [{ ga: irish, en: english, speaker: 'queen' }],
            getMoonPhase: () => GameSettings.englishOpacity ?? 0.7,
            onComplete:   () => { this._flashPlayer = null; },
            container,
        });

        this._flashPlayer.start();

        const vel = 120 / 60;
        this._flashPlayer._naturalVel     = vel;
        this._flashPlayer._velocity       = vel;
        this._flashPlayer._ceilingY       = 999999;
        this._flashPlayer._onReachCeiling = function() {};
        this._flashPlayer._onComplete     = function() {};
        this._flashPlayer._scrollY        = H * 0.5;

        const topZoneH = H * 0.5 - SLIDER_H;
        if (this._flashPlayer._hitZone) {
            const hz = this._flashPlayer._hitZone;
            hz.style.top           = SLIDER_H + 'px';
            hz.style.height        = topZoneH + 'px';
            hz.style.bottom        = '';
            hz.style.pointerEvents = 'all';
        }
        if (this._flashPlayer._overlay) {
            this._flashPlayer._overlay.style.pointerEvents = 'none';
        }

        const CEIL_PX = SLIDER_H + 8;
        const FADE_PX = 80;
        const MID_PX  = H * 0.5;
        this._flashPlayer._render = function() {
            if (!this._overlay) return;
            const mp = this._getMoonPhase();
            for (const entry of this._lineEls) {
                const y      = this._screenY(entry);
                const bottom = y + entry.wrapper.offsetHeight;
                entry.wrapper.style.top = y + 'px';
                if (bottom < 0 || y > MID_PX + 40) {
                    entry.gaEl.style.opacity = '0';
                    if (entry.enEl) entry.enEl.style.opacity = '0';
                    continue;
                }
                let alpha = 1;
                if (y < CEIL_PX + FADE_PX) alpha = Math.max(0, (y - CEIL_PX) / FADE_PX);
                if (bottom > MID_PX - FADE_PX) alpha = Math.min(alpha, Math.max(0, (MID_PX - y) / FADE_PX));
                entry.gaEl.style.opacity = String(alpha);
                if (entry.enEl) {
                    entry.enEl.style.opacity = String(mp);
                    entry.enEl.style.color   = '#c084fc';
                }
            }
        };

        const fp   = this._flashPlayer;
        const poll = setInterval(() => {
            if (!fp || !fp._lineEls) { clearInterval(poll); return; }
            const last = fp._lineEls[fp._lineEls.length - 1];
            if (!last) return;
            if (fp._screenY(last) + (last.wrapper.offsetHeight || 60) < 0) {
                clearInterval(poll);
                fp._running = false;
                if (fp._overlay) { fp._overlay.style.transition = 'opacity 0.6s'; fp._overlay.style.opacity = '0'; }
                setTimeout(() => { if (fp.destroy) fp.destroy(); }, 700);
            }
        }, 150);
    }

    showHitDialogue() {
        if (this.narrativeInProgress || this.tutorialComplete) return;
        const dialogue = this.getRandomDialogue(this.tutorialData.narrative.onHit, this.usedHitDialogues);
        this._flashLine(dialogue.irish, dialogue.english);
    }

    showMissDialogue() {
        if (this.narrativeInProgress || this.tutorialComplete) return;
        const dialogue = this.getRandomDialogue(this.tutorialData.narrative.onMiss, this.usedMissDialogues);
        this._flashLine(dialogue.irish, dialogue.english);
    }

    // ── Farewell ──────────────────────────────────────────────────────────────
    showFarewell() {
        const farewell = this.tutorialData.narrative.farewell;
        if (!farewell || farewell.length === 0) return;

        this.tutorialComplete    = true;
        this.narrativeInProgress = false;

        const lines = farewell.map(e => ({
            ga:      e.irish,
            en:      e.english,
            speaker: 'queen',
        }));

        this._tellDirect(lines, () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                ;['pgr-ground','pgr-objects','pgr-light','pgr-sky','pgr-sky-img','pgr-fog'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                const container = document.getElementById('gameContainer');
                if (container) container.style.background = '#000';

                const currentOpacity = GameSettings.englishOpacity;

                const inv = this.player?.inventory;
                if (inv) {
                    const rh = inv.getEquippedItem('rightHand');
                    if (rh?.id === 'simple_bow') inv.unequipItem('rightHand');
                }

                if (this.bowMechanics) {
                    this.bowMechanics.destroy();
                    this.bowMechanics = null;
                }

                initReturnCrossing(this.champion, currentOpacity, () => {
                    if (window.startGame) {
                        window.startGame(this.champion, { startScene: 'Bog_Threshold' });
                    } else {
                        console.error('[BowTutorial] window.startGame not found!');
                        this.scene.start('Bog_Threshold');
                    }
                });
            });
        });
    }

    _tellDirect(lines, onComplete) {
        const sw = this.scale.width;
        const sh = this.scale.height;
        const moonPhase = GameSettings.englishOpacity ?? 0.7;

        let idx = 0;

        const showLine = () => {
            if (idx >= lines.length) {
                if (onComplete) onComplete();
                return;
            }

            const line = lines[idx++];

            const gaText = this.add.text(sw / 2, sh * 0.22, line.ga, {
                fontSize:        '25px',
                fontFamily:      'Urchlo, serif',
                color:           '#d4af37',
                stroke:          '#000000',
                strokeThickness: 4,
                align:           'center',
                wordWrap:        { width: sw * 0.82 },
            }).setOrigin(0.5, 0).setDepth(600).setScrollFactor(0).setAlpha(0);

            const enText = this.add.text(sw / 2, sh * 0.22 + gaText.height + 10, line.en, {
                fontSize:        '20px',
                fontFamily:      '"Courier New", monospace',
                color:           '#a0c8a0',
                stroke:          '#000000',
                strokeThickness: 3,
                align:           'center',
                wordWrap:        { width: sw * 0.82 },
            }).setOrigin(0.5, 0).setDepth(600).setScrollFactor(0).setAlpha(0);

            this.tweens.add({
                targets: [gaText, enText], alpha: 1,
                duration: 600, ease: 'Power2',
                onComplete: () => {
                    enText.setAlpha(moonPhase);
                    this.time.delayedCall(3200, () => {
                        this.tweens.add({
                            targets: [gaText, enText], alpha: 0,
                            duration: 500, ease: 'Power2',
                            onComplete: () => {
                                gaText.destroy();
                                enText.destroy();
                                showLine();
                            }
                        });
                    });
                }
            });
        };

        showLine();
    }

    // ── Targets ───────────────────────────────────────────────────────────────
    _targetGids() { return [1987, 1988, 1989, 1990, 1991]; }

    createTarget() {
        if (this.target) {
            if (this._targetTween) { this._targetTween.stop(); this._targetTween = null; }
            this.target.destroy(); this.target = null;
        }
        this.currentTargetIndex = (this.currentTargetIndex ?? -1) + 1;
        if (this.currentTargetIndex >= 5) this.currentTargetIndex = 0;

        const positions = [
            { dx: -2, dy: -14, axis: 'x' },
            { dx: -3, dy: -16, axis: 'x' },
            { dx: -1, dy: -13, axis: 'y' },
            { dx: -2, dy: -15, axis: 'y' },
            { dx: -1, dy: -17, axis: 'x' },
        ];

        const SPAWN_LX = 4 * 48 + 24;
        const SPAWN_LY = 18 * 48 + 24;

        const pos      = positions[this.currentTargetIndex];
        const logicalX = SPAWN_LX + pos.dx * 48;
        const logicalY = SPAWN_LY + pos.dy * 48;

        const pgr     = this.perspectiveGround;
        const proj    = pgr?._projectLogical(logicalX, logicalY);
        const ts      = pgr?.tileDisplaySize ?? 48;
        const tileRow = logicalY / ts - 0.5;
        const scaledW = pgr?._scaleAtRow(tileRow + 1) ?? 20;

        const scale = Math.min((scaledW / ts) * 3.0 * 1.5, 7.0);

        const screenX = proj?.screenX ?? this.scale.width  * 0.5;
        const screenY = proj?.screenY ?? this.scale.height * 0.65;
        const standY  = screenY - scaledW * 0.3;
        const buriedY = screenY + scaledW * 2;

        const gid    = this._targetGids()[this.currentTargetIndex];
        const canvas = this.creatureSheet?.getCanvas(gid);
        let target;

        const targetDepth = Math.round(tileRow + 4);

        if (canvas) {
            const texKey = `creature_${gid}`;
            if (!this.textures.exists(texKey)) this.textures.addCanvas(texKey, canvas);
            target = this.add.image(screenX, buriedY, texKey)
                .setDepth(targetDepth).setScale(scale).setOrigin(0.5, 1);
        } else {
            target = this.add.circle(screenX, buriedY, 22, 0xcc2200, 0.9)
                .setStrokeStyle(2, 0xffffff).setDepth(targetDepth);
        }

        const renderedHalfW = (scaledW * 1.5) * 0.55;

        target._worldLogicalX = logicalX;
        target._worldLogicalY = logicalY;
        target._standY        = standY;
        target._scaledW       = scaledW;
        target._moveAxis      = pos.axis;
        target._hitRadius     = renderedHalfW;
        target.setData('hit', false);
        this.target = target;

        const targetRow   = logicalY / 48 - 0.5;
        const depthFactor = 1 - Math.max(0, Math.min(1, (targetRow - 2) / 16));

        const xRange = Math.round(60 + depthFactor * 120);
        const yRange = Math.round(20 + depthFactor * 40);
        const speed  = Phaser.Math.Between(
            Math.round(800  + depthFactor * 600),
            Math.round(1600 + depthFactor * 1200)
        );

        this.tweens.add({
            targets: target, y: standY, duration: 350, ease: 'Back.easeOut',
            onComplete: () => {
                if (!this.target) return;

                if (pos.axis === 'y') {
                    this._targetTween = this.tweens.add({
                        targets:   this.target,
                        y:         standY + yRange,
                        duration:  speed,
                        yoyo:      true,
                        repeat:    -1,
                        ease:      'Sine.easeInOut',
                    });
                    this.tweens.add({
                        targets:  this.target,
                        x:        screenX + Math.round(xRange * 0.3),
                        duration: speed * 1.7,
                        yoyo:     true,
                        repeat:   -1,
                        ease:     'Sine.easeInOut',
                    });
                } else {
                    this._targetTween = this.tweens.add({
                        targets:  this.target,
                        x:        screenX + xRange,
                        duration: speed,
                        yoyo:     true,
                        repeat:   -1,
                        ease:     'Sine.easeInOut',
                    });
                    this.tweens.add({
                        targets:  this.target,
                        y:        standY + Math.round(yRange * 0.4),
                        duration: speed * 0.6,
                        yoyo:     true,
                        repeat:   -1,
                        ease:     'Sine.easeInOut',
                    });
                }
            },
        });
    }

    _knockdownTarget() {
        const t = this.target;
        if (!t) return;
        if (this._targetTween) { this._targetTween.stop(); this._targetTween = null; }
        this.target = null;
        this.tweens.add({
            targets:  t,
            angle:    -90,
            y:        t.y + (t._scaledW ?? 20) * 2,
            alpha:    0,
            duration: 400,
            ease:     'Power2.easeIn',
            onComplete: () => { if (t?.scene) t.destroy(); },
        });
    }

    _updateTargetScreenPos() {}

    moveTargetToNext() {
        if (this.target) {
            if (this._targetTween) { this._targetTween.stop(); this._targetTween = null; }
            const t = this.target; this.target = null;
            this.tweens.add({
                targets: t, y: t.y + (t._scaledW ?? 20) * 3, alpha: 0,
                duration: 300, ease: 'Power2.easeIn',
                onComplete: () => { t.destroy(); this.createTarget(); },
            });
        } else {
            this.createTarget();
        }
    }

    // ── Update ────────────────────────────────────────────────────────────────
    update(time, delta) {
        if (this.perspectiveGround) this.perspectiveGround.update();
        if (this.textPanel)         this.textPanel.update(time, delta);

        if (this.bowMechanics?.isAiming && this.predictionDot) {
            const prediction = this.bowMechanics?.predictLandingPoint();
            if (prediction) { this.predictionDot.setPosition(prediction.x, prediction.y); this.predictionDot.setVisible(false); }
        } else if (this.predictionDot) {
            this.predictionDot.setVisible(false);
        }

        if (this.scathach && this.scathachHitbox) {
            this.scathachHitbox.x = this.scathach.x;
            this.scathachHitbox.y = this.scathach.y;
        }

        if (!this._arrowsExhausted && this.player?.inventory) {
            const inv   = this.player.inventory;
            let total   = 0;
            for (let i = 0; i < inv.totalSlots; i++) {
                const item = inv.getItem(i);
                if (item?.id === 'arrows') total += item.quantity;
            }
            const inFlight = (this.bowMechanics?.arrows?.filter(a => !a.getData('hasLanded'))?.length ?? 0);
            if (total === 0 && inFlight === 0 && !this.tutorialComplete) {
                this._arrowsExhausted = true;
                this.time.delayedCall(800, () => { this.showFarewell(); });
            }
        }

        this.bowMechanics?.update(delta);

        if (this.target && !this.hitLocked) {
            const radius = this.target._hitRadius ?? 45;
            const hit = this.bowMechanics?.checkHit(this.target, radius);
            if (hit) this.onTargetHit(hit);
        }

        if (this.scathach && this.scathachHitbox) {
            this.bowMechanics?.arrows?.forEach(arrow => {
                if (arrow.getData('parried') || arrow.getData('hitTarget')) return;
                const sx = arrow.getData('hasLanded')
                    ? (arrow.getData('landScreenX') ?? arrow.getData('prevScreenX'))
                    : arrow.getData('prevScreenX');
                const sy = arrow.getData('hasLanded')
                    ? (arrow.getData('landScreenY') ?? arrow.getData('prevScreenY'))
                    : arrow.getData('prevScreenY');
                if (sx == null) return;
                const distance = Phaser.Math.Distance.Between(sx, sy, this.scathachHitbox.x, this.scathachHitbox.y);
                if (distance < 70) this.onScathachHit(arrow);
            });
        }

        if (this.target) {
            this.bowMechanics?.arrows?.forEach(arrow => {
                if (arrow.getData('hasLanded') && !arrow.getData('counted')) {
                    arrow.setData('counted', true);
                    if (arrow.getData('hitTarget')) return;
                    const landSX = arrow.getData('landScreenX');
                    const landSY = arrow.getData('landScreenY');
                    if (landSX == null) return;
                    const distance = Phaser.Math.Distance.Between(landSX, landSY, this.target.x, this.target.y);
                    if (distance > 60) { this.missCount++; this.onMiss(); }
                }
            });
        }

        if (this.advancedTraining) this.advancedTraining.update();
    }

    // ── Hit / miss handlers ───────────────────────────────────────────────────
    onTargetHit(hitData) {
        if (this.hitLocked) return;
        this.hitLocked = true;

        this.hitCount++;
        this.consecutiveHits++;
        this.consecutiveMisses = 0;

        this.updateHitTracker(this.consecutiveHits);
        this._knockdownTarget();

        if (this.consecutiveHits >= 4 && !this.tutorialComplete) {
            this.tutorialComplete = true;
            this.textPanel.show({
                type:    'chat_options',
                irish:   'Sin é.',
                english: "That's it.",
                speaker: 'Scáthach',
                options: [
                    { irish: 'Ceacht eile?', english: 'Another lesson?' },
                    { irish: 'Fág slán',     english: 'Take your leave'  },
                ],
                onChoice: (index) => {
                    if (index === 0) { this.time.delayedCall(300, () => { this.moreTraining(); }); }
                    else             { this.time.delayedCall(300, () => { this.showFarewell(); }); }
                },
            });
            return;
        }

        if (this.consecutiveHits === this.NARRATIVE_THRESHOLD && !this.tutorialComplete) {
            this.showHitDialogue();
        }

        this.time.delayedCall(600, () => { this.hitLocked = false; this.createTarget(); });
    }

    onMiss() {
        this.resetHitTracker();
        this.consecutiveHits   = 0;
        this.consecutiveMisses++;
        if (this.consecutiveMisses >= this.NARRATIVE_THRESHOLD && !this.tutorialComplete) {
            this.showMissDialogue();
            this.consecutiveMisses = 0;
        }
    }

    onScathachHit(arrow) {
        arrow.setData('parried', true);
        arrow.setData('active',  false);
        arrow.setData('counted', true);

        const arrowX = this.scathachHitbox?.x ?? (arrow.getData('prevScreenX') ?? 200);
        const arrowY = this.scathachHitbox?.y ?? (arrow.getData('prevScreenY') ?? 300);

        const trail = arrow.getData('trail');
        if (trail) trail.destroy();

        const arrowIndex = this.bowMechanics?.arrows?.indexOf(arrow) ?? -1;
        if (arrowIndex > -1) this.bowMechanics?.arrows?.splice(arrowIndex, 1);
        arrow.destroy();

        this.scathach.setTint(0xffffff);
        this.time.delayedCall(200, () => { this.scathach.clearTint(); });

        this.tweens.add({
            targets:  this.scathach,
            x:        this.scathach.x + Phaser.Math.Between(-6, 6),
            duration: 80,
            yoyo:     true,
            ease:     'Quad.easeOut',
        });

        this.sound.play('parrySound', { volume: 1 });

        const deflectGfx = this.add.graphics();
        deflectGfx.setDepth(200);
        deflectGfx.setScrollFactor(0);

        const baseUpwardAngle = -Math.PI / 2;
        const spread          = Phaser.Math.DegToRad(60);
        const deflectAngle    = baseUpwardAngle + Phaser.Math.FloatBetween(-spread/2, spread/2);
        const bounceDistance  = Phaser.Math.Between(120, 200);
        const endX            = arrowX + Math.cos(deflectAngle) * bounceDistance;
        const endY            = arrowY + Math.sin(deflectAngle) * bounceDistance;
        const arrowLen        = 12;

        const proxy = { t: 0 };
        this.tweens.add({
            targets:  proxy,
            t:        1,
            duration: Phaser.Math.Between(700, 1000),
            ease:     'Cubic.easeOut',
            onUpdate: () => {
                const cx  = arrowX + (endX - arrowX) * proxy.t;
                const cy  = arrowY + (endY - arrowY) * proxy.t;
                const rot = deflectAngle + proxy.t * Math.PI * Phaser.Math.FloatBetween(3, 5);
                deflectGfx.clear();
                deflectGfx.lineStyle(1.5, 0xffffff, 1 - proxy.t * 0.8);
                deflectGfx.beginPath();
                deflectGfx.moveTo(cx - Math.cos(rot) * arrowLen, cy - Math.sin(rot) * arrowLen);
                deflectGfx.lineTo(cx + Math.cos(rot) * arrowLen, cy + Math.sin(rot) * arrowLen);
                deflectGfx.strokePath();
            },
            onComplete: () => { deflectGfx.destroy(); },
        });
    }

    moreTraining() {
        this.time.delayedCall(300, () => { this.advancedTraining.start(); });
    }

    // ── Scáthach ──────────────────────────────────────────────────────────────
    createScathach() {
        const screenWidth  = this.scale.width;
        const screenHeight = this.scale.height;

        const scathachX = screenWidth  * 0.82;
        const scathachY = screenHeight * 0.62;

        this.wind = { x: -15, y: 5 };

        this.scathach = this.add.image(scathachX, scathachY, 'scathach');
        this.scathach.setScale(1.3);
        this.scathach.setDepth(50);

        this.scathachHitbox = this.add.circle(scathachX, scathachY, 55, 0xff0000, 0);
        this.scathachHitbox.setData('isScathach', true);
        this.scathachHitbox.setDepth(19);

        this.cape = this.add.image(scathachX - 18, scathachY - 18, 'cape');
        this.cape.setOrigin(0, 0);
        this.cape.setDepth(49);

        this.capeTime = 0;

        this.capeUpdateCallback = (time, delta) => {
            if (!this.cape) return;
            this.capeTime += delta * 0.001;
            const windStrength = Phaser.Math.Clamp(Math.abs(this.wind.x) / 15, 0.4, 1);
            this.cape.rotation = -0.12 * windStrength + Math.sin(this.capeTime * 1.1) * 0.05;
            this.cape.scaleX   = 1 + Math.sin(this.capeTime * 0.9) * 0.1;
            this.cape.scaleY   = 1 + Math.sin(this.capeTime * 1.3 + 1) * 0.04;
        };
        this.events.on('update', this.capeUpdateCallback);

        this.time.addEvent({
            delay:    5000,
            loop:     true,
            callback: () => {
                if (!this.cape) return;
                this.tweens.add({
                    targets:  this.cape,
                    scaleX:   1.25,
                    rotation: -0.2,
                    duration: 900,
                    yoyo:     true,
                    ease:     'Sine.easeInOut',
                });
            },
        });
    }
}

