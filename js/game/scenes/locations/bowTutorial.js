import Phaser from 'phaser';
import Player from '../../player/player.js';
import BowMechanics from '../../combat/bowMechanics.js';
import PerspectiveGroundRenderer from '../../effects/perspectiveGroundRenderer.js';
import CreatureSheetHelper from '../../ui/inventory/creatureSheetHelper.js';
import ItemSheetHelper from '../../ui/inventory/itemSheetHelper.js';

import { initReturnCrossing } from '../returnCrossing.js';

import TextPanel from '../../ui/textPanel.js';
import { ScrollingTextPlayer } from '../../ui/scrollingTextPlayer.js';
import { GameSettings } from '../../settings/gameSettings.js';
import AdvancedTraining from './advancedTraining.js';
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
                       // Load bow sounds
    this.load.audio('creak1', 'assets/sounds/creak1.wav');
    this.load.audio('arrowShoot1', 'assets/sounds/arrowShoot1.wav');
 this.load.audio('arrowShoot2', 'assets/sounds/arrowShoot2.wav');
  this.load.audio('arrowShoot3', 'assets/sounds/arrowShoot3.wav');
  this.load.audio('pumpkin_break_01', 'assets/sounds/pumpkin_break_01.ogg');
   this.load.audio('parrySound', 'assets/sounds/parry.mp3');



    this.load.image('cape', 'assets/cape.png');
    // Load champion spritesheet and atlas
    this.load.image('championSheet_unarmored', 'assets/champions/champions-no-kit.png');
    this.load.image('championSheet_armored', 'assets/champions/champions-with-kit.png');
    this.load.image('arrowTexture', 'assets/arrow1.png');
    this.load.json('championAtlas', 'assets/champions/champions0.json');

    this.load.image('scathach', 'assets/sc01.png');
    this.load.spritesheet('dragon', 'assets/dragonFrames.png', {
      frameWidth: 500, frameHeight: 359
    });
    // Target sprites come from oryxCreatures sheet (GIDs 1987-1991)
    // Sky background layers
    // Oryx tileset for PGR
    this.load.image('oryxTiles', '/assets/oryx/oryx_16bit_fantasy_world_trans.png');
    this.load.image('oryxItems', '/assets/oryx/oryx_16bit_fantasy_items_trans.png');
    this.load.image('oryxCreatures', '/assets/oryx/oryx_16bit_fantasy_creatures_trans.png');
    this.load.json('oryxCatalogue', '/assets/oryx/oryxCatalogue.json');
    // Load tutorial data
    this.load.json('bowTutorialData', '/maps/bowTutorial.json?v=' + Date.now());
  }


init(data) {
        console.log('[BowTutorial] *** INIT CALLED ***');
        console.trace();
    }

resetHitTracker() {
  if (!this.hitTrackerCircles) return;

  this.hitTrackerCircles.forEach((circle, index) => {
    // Kill any running tweens on these objects
    this.tweens.killTweensOf(circle.inner);
    this.tweens.killTweensOf(circle.outer);

    // Hard reset visual state
    circle.filled = false;
    circle.inner.setVisible(false);
    circle.inner.setAlpha(0);
    circle.inner.setScale(1);
    circle.outer.setAlpha(1);
  });
}

createHitTracker() {
  const screenWidth = this.scale.width;
  const screenHeight = this.scale.height;

  // Position in top-right corner
  const startX = screenWidth - 180;
  const startY = 80;
  const spacing = 40;

  this.hitTrackerCircles = [];

  for (let i = 0; i < 4; i++) {
    const x = startX + (i * spacing);
    const y = startY;

    // Outer circle (border)
    const outer = this.add.circle(x, y, 15, 0xffffff, 0);
    outer.setStrokeStyle(3, 0xd4af37);
    outer.setDepth(3000);
    outer.setScrollFactor(0);

    // Inner fill circle (starts invisible) - make sure it's actually a filled circle
    const inner = this.add.circle(x, y, 12, 0xffd700, 1); // Set alpha to 1 initially for testing
    inner.setDepth(3001);
    inner.setScrollFactor(0);
    inner.setVisible(false); // Start hidden, we'll show it with the tween

    this.hitTrackerCircles.push({ outer, inner, filled: false });
  }
}

// 3. Add this method (replace your existing updateHitTracker):
updateHitTracker(consecutiveHits) {

  if (this.hitTrackerComplete) return
  console.log('updateHitTracker called with:', consecutiveHits);
  
  if (!this.hitTrackerCircles) {
    console.error('hitTrackerCircles not initialized!');
    return;
  }
  
  this.hitTrackerCircles.forEach((circle, index) => {
    if (index < consecutiveHits && !circle.filled) {
      console.log(`FILLING circle ${index}`);
      // Fill this circle with animation
      circle.filled = true;
      
      // Make visible and animate
      circle.inner.setVisible(true);
      circle.inner.setAlpha(0);
      circle.inner.setScale(1);

      this.tweens.add({
        targets: circle.inner,
        alpha: 1,
        scale: 1.3,
        duration: 200,
        ease: 'Back.easeOut',
        onStart: () => {
          console.log(`Tween started for circle ${index}, inner visible: ${circle.inner.visible}`);
        },
        onComplete: () => {
          console.log(`Tween complete for circle ${index}, alpha: ${circle.inner.alpha}`);
         this.tweens.add({
  targets: circle.inner,
  alpha: 1,
  scale: 1.3,
  duration: 200,
  ease: 'Back.easeOut',
  onComplete: () => {
    this.tweens.add({
      targets: circle.inner,
      scale: 1,
      duration: 150,
      ease: 'Power2'
    });

    // ✅ COMPLETION TRIGGER — only when last circle fills
    if (
      index === this.hitTrackerCircles.length - 1 &&
      !this.hitTrackerComplete
    ) {
      this.completeHitTracker();
    }
  }
}); 
        }
      });

      // Flash the outer ring
      this.tweens.add({
        targets: circle.outer,
        alpha: 1,
        duration: 100,
        yoyo: true,
        repeat: 2
      });

    } else if (index >= consecutiveHits && circle.filled) {
      console.log(`EMPTYING circle ${index}`);
      // Empty this circle (on miss)
      circle.filled = false;

      this.tweens.add({
        targets: circle.inner,
        alpha: 0,
        scale: 0.5,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          circle.inner.setVisible(false);
        }
      });
    }
  });
}

completeHitTracker() {
  if (this.hitTrackerComplete) return;

  this.hitTrackerComplete = true;

  // Kill all running tweens to avoid interference
  this.hitTrackerCircles.forEach(circle => {
    this.tweens.killTweensOf(circle.inner);
    this.tweens.killTweensOf(circle.outer);
  });

  // FLASH FLASH
  this.hitTrackerCircles.forEach(circle => {
    this.tweens.add({
      targets: [circle.inner, circle.outer],
      alpha: 0,
      duration: 120,
      yoyo: true,
      repeat: 3, // flash–flash
      ease: 'Linear'
    });
  });

  // After flash + pause, fade out and hide
  this.time.delayedCall(2000, () => {
    this.hitTrackerCircles.forEach(circle => {
      this.tweens.add({
        targets: [circle.inner, circle.outer],
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => {
          circle.inner.setVisible(false);
          circle.outer.setVisible(false);
        }
      });
    });
  });
}










create() {  // <-- THIS WAS MISSING!
    console.log('BowTutorial: starting');
    this.hitLocked = false;
    // Load tutorial data
    this.tutorialData = this.cache.json.get('bowTutorialData');
this.hitTrackerComplete = false;
    if (!this.tutorialData) {
      console.error('BowTutorial: Tutorial data not found!');
      return;
    }

    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;

// Background handled by PGR sky vignette










    // Get champion
    const champion = this.registry.get('selectedChampion') ||
                     window.selectedChampion ||
                     { id: 'demo', nameGa: 'Demo', row: 0, col: 0 };

    this.champion = champion;
    this.tileSize = 48;

    // ── Inline map — bog floor for PGR ───────────────────────────────────────
    // MH=22 ensures row 16 exists for player spawn
    const MW = 20, MH = 22, BOG = 733;
    const layer0 = Array.from({length: MH}, () => Array(MW).fill(BOG));
    this.mapData = {
      width: MW, height: MH,
      layers: [layer0, Array.from({length: MH}, () => Array(MW).fill(0))],
      tiles: layer0,
    };

    // With camera at (0,0), perspCamRow ≈ 19.
    // Col 4 centres horizontally, row 16 projects to lower third.
    const playerX = 4 * this.tileSize + this.tileSize / 2;   // = 216
    const playerY = 16 * this.tileSize + this.tileSize / 2;  // = 792

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

    // Keep camera at (0,0) so Phaser GameObjects (Scáthach etc.) stay in place.
    // PGR reads camera scroll for projection — at (0,0) the player tile
    // will project based on CAMERA_ROW_OFFSET relative to scroll origin.

    // PGR — ground + player billboard + weapon overlay
    this.perspectiveGround = new PerspectiveGroundRenderer(this);
    this.perspectiveGround.setPlayer(this.player);

    // Sky colour — visible above horizon through transparent Phaser canvas
    this.game.renderer.gl?.clearColor(0, 0, 0, 0);
    this.game.canvas.style.background = 'transparent';
    const container = document.getElementById('gameContainer')
    if (container) container.style.background = '#8aabbf'  // overcast sky blue-grey  // dark grey-blue sky

    // Larger player for tutorial — more visible, heroic scale
    this.perspectiveGround.setPlayerScale(2.0)  // 2x normal height

    // Bright overcast lighting for tutorial — much less dark than bog scenes
    this.perspectiveGround.setLighting({
      darkness:    0.3,    // very little darkness outside light radius
      radius:      0.7,    // wide light coverage
      groundColour: '#4a6a30'  // lighter, greener ground
    })

    // ItemSheetHelper for weapon overlay
    this.itemSheet = new ItemSheetHelper(this);
    // CreatureSheetHelper for target sprites
    this.creatureSheet = new CreatureSheetHelper(this);

    // ── Sky + mountain background ─────────────────────────────────────────
    // Drawn on Phaser canvas (transparent, z-index 10).
    // Depth 0.x puts them behind all other Phaser GameObjects.
    // Mountains fill the upper portion — PGR ground covers the lower half.
    // Sky colour set via container background (see below)

    // Initialize bow mechanics
    this.bowMechanics = new BowMechanics(this, this.player);

    // Tab-blur/focus fix handled inside BowMechanics._setupInput()

    // Create single target

    // Initialize text panel system
    this.textPanel = new TextPanel(this);

    // ScrollingTextPlayer for exposition and farewell sequences.
    // Configured for the top half of the screen — gameplay lives below.
    this.storyPlayer = null;  // created on demand, destroyed when done

    // Track hits
    this.hitCount = 0;
    this.missCount = 0;
this.bullseyeHits = 0;
    this.consecutiveHits = 0;
    this.consecutiveMisses = 0;
    this.NARRATIVE_THRESHOLD = 3;
    this.usedHitDialogues = [];
    this.usedMissDialogues = [];
    this.tutorialComplete = false;

    // Add settings slider
    this.addSettingsSlider();

    // Destroy resources if scene shuts down
    this.events.once('shutdown', () => {
      // Immediately hide all PGR DOM canvases to prevent flash on scene transition
      ;['pgr-ground','pgr-objects','pgr-light','pgr-sky','pgr-sky-img','pgr-fog'].forEach(id => {
        const el = document.getElementById(id)
        if (el) el.style.display = 'none'
      })
      // Also reset container background so new scene can set its own
      const container = document.getElementById('gameContainer')
      if (container) container.style.background = ''

      if (this.storyPlayer)       { this.storyPlayer.destroy();       this.storyPlayer       = null; }
      if (this._flashPlayer)      { this._flashPlayer.destroy();      this._flashPlayer      = null; }
      if (this.perspectiveGround) { this.perspectiveGround.destroy(); this.perspectiveGround = null; }
      if (this.itemSheet)         { this.itemSheet.clear();           this.itemSheet         = null; }
      if (this.creatureSheet)     { this.creatureSheet.clear();       this.creatureSheet     = null; }
      // blur handler cleaned up by BowMechanics.destroy()
    });

    // Show exposition narrative
    this.showExposition();

    this.createScathach();

   
this.advancedTraining = new AdvancedTraining(this);
  

// Create prediction dot (for testing/future spell)
this.predictionDot = this.add.circle(0, 0, 5, 0xff0000, 0.8);
this.predictionDot.setDepth(100);
this.predictionDot.setVisible(false);


this.createHitTracker()


  }


showBullseyeEffect(x, y) {
  // Create a golden ring that expands outward
  const ring = this.add.graphics();
  ring.setDepth(101);
  ring.lineStyle(3, 0xffd700, 1);
  ring.strokeCircle(x, y, 10);
  
  this.tweens.add({
    targets: ring,
    alpha: 0,
    duration: 600,
    ease: 'Power2',
    onUpdate: () => {
      ring.clear();
      ring.lineStyle(3, 0xffd700, ring.alpha);
      ring.strokeCircle(x, y, 10 + (1 - ring.alpha) * 30);
    },
    onComplete: () => ring.destroy()
  });
  
  // Add text popup
  const bullseyeText = this.add.text(x, y - 30, 'SÚIL NA SPRICE!', {
    fontSize: '16px',
    fontFamily: 'monospace',
    color: '#ffd700',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  bullseyeText.setDepth(102);
  
  this.tweens.add({
    targets: bullseyeText,
    y: y - 60,
    alpha: 0,
    duration: 800,
    ease: 'Power2',
    onComplete: () => bullseyeText.destroy()
  });
}
showExposition() {
  const exposition = this.tutorialData.narrative.exposition;
  if (!exposition || exposition.length === 0) return;

  this.narrativeInProgress = true;

  // Convert exposition array to ScrollingTextPlayer line format.
  // speaker: 'queen' → gold (Scáthach speaks in gold).
  const lines = exposition.map(e => ({
    ga:      e.irish,
    en:      e.english,
    speaker: 'queen',
  }));

  // Spawn target after short fixed delay regardless of text progress
  this.time.delayedCall(1500, () => { if (!this.target) this.createTarget(); });

  this._showStoryLines(lines, () => {
    this.narrativeInProgress = false;
    console.log('BowTutorial: exposition complete');
    if (!this.target) this.time.delayedCall(300, () => { this.createTarget(); });
  });
}

  getRandomDialogue(pool, usedArray) {
    // Get unused dialogues
    const unused = pool.filter((d, i) => !usedArray.includes(i));

    // If all used, reset
    if (unused.length === 0) {
      usedArray.length = 0;
      return pool[0];
    }

    // Pick random unused
    const randomIndex = Phaser.Math.Between(0, unused.length - 1);
    const dialogue = unused[randomIndex];
    const originalIndex = pool.indexOf(dialogue);
    usedArray.push(originalIndex);

    return dialogue;
  }

  // ── _showStoryLines ─────────────────────────────────────────────────────────
  // Plays bilingual lines using ScrollingTextPlayer.
  // Text zone: top half of screen (below slider strip), leaving bottom half
  // fully free for Phaser bow gameplay.
  // Touch in the top half controls scroll speed/direction.
  // Touch in the bottom half passes through to Phaser.
  _showStoryLines(lines, onComplete) {
    if (this.storyPlayer) {
      this.storyPlayer.destroy();
      this.storyPlayer = null;
    }

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

    // ── Speed ─────────────────────────────────────────────────────────────────
    const vel = 50 / 60;
    this.storyPlayer._naturalVel = vel;
    this.storyPlayer._velocity   = vel;

    // ── No ceiling clamp — text scrolls freely off the top ───────────────────
    this.storyPlayer._ceilingY       = 999999;
    this.storyPlayer._onReachCeiling = function() {};
    this.storyPlayer._onComplete     = function() {};

    // ── Start at mid-screen ───────────────────────────────────────────────────
    const H = window.innerHeight;
    this.storyPlayer._scrollY = H * 0.5;

    // ── Constrain hitZone to top half only (below slider) ────────────────────
    // This means: touch in top half → STP gets it (pause/scrub).
    //             touch in bottom half → passes through to Phaser canvas.
    const SLIDER_H = 52;   // height of slider strip
    const topZoneH = H * 0.5 - SLIDER_H;
    if (this.storyPlayer._hitZone) {
      const hz = this.storyPlayer._hitZone;
      hz.style.top            = SLIDER_H + 'px';
      hz.style.height         = topZoneH + 'px';
      hz.style.bottom         = '';
      hz.style.pointerEvents  = 'all';
    }
    // Overlay itself stays pointer-events:none so Phaser bottom half works
    if (this.storyPlayer._overlay) {
      this.storyPlayer._overlay.style.pointerEvents = 'none';
    }

    // ── Patch _render: ceiling at slider strip, fade zone below it ───────────
    const CEIL_PX  = SLIDER_H + 8;   // a little below the slider strip
    const FADE_PX  = 80;              // fade zone height in px
    const FADE_BOT = 0.10;            // bottom-of-zone fade fraction (of H)
    const MID_PX   = H * 0.5;        // bottom of text zone — fade out here too
    this.storyPlayer._render = function() {
      if (!this._overlay) return;
      const H2 = window.innerHeight;
      const mp = this._getMoonPhase();
      for (const entry of this._lineEls) {
        const y      = this._screenY(entry);
        const bottom = y + entry.wrapper.offsetHeight;
        entry.wrapper.style.top = y + 'px';
        // Cull lines fully outside the text zone
        if (bottom < 0 || y > MID_PX + 40) {
          entry.gaEl.style.opacity = '0';
          if (entry.enEl) entry.enEl.style.opacity = '0';
          continue;
        }
        let alpha = 1;
        // Fade out near ceiling (top)
        if (y < CEIL_PX + FADE_PX) {
          alpha = Math.max(0, (y - CEIL_PX) / FADE_PX);
        }
        // Fade out near midscreen (bottom of text zone)
        if (bottom > MID_PX - FADE_PX) {
          alpha = Math.min(alpha, Math.max(0, (MID_PX - y) / FADE_PX));
        }
        entry.gaEl.style.opacity = String(alpha);
        if (entry.enEl) {
          entry.enEl.style.opacity = String(mp);
          entry.enEl.style.color   = '#c084fc'; // purple for English text
        }
      }
    };

    // ── Exit poll: once last line scrolls off top, fire onComplete ────────────
    const stp = this.storyPlayer;
    const poll = setInterval(() => {
      if (!stp || !stp._lineEls) { clearInterval(poll); return; }
      const last = stp._lineEls[stp._lineEls.length - 1];
      if (!last) return;
      const y = stp._screenY(last);
      const h = last.wrapper.offsetHeight || 60;
      if (y + h < 0) {
        clearInterval(poll);
        stp._running = false;
        if (stp._overlay) {
          stp._overlay.style.transition = 'opacity 0.8s ease';
          stp._overlay.style.opacity    = '0';
        }
        setTimeout(() => {
          if (stp.destroy) stp.destroy();
          if (onComplete) onComplete();
        }, 900);
      }
    }, 150);
  }

  // ── _flashLine ───────────────────────────────────────────────────────────────
  // Show a single reactive dialogue line (hit/miss) through storyPlayer.
  // If a storyPlayer is already running it injects a fresh one on top briefly;
  // otherwise creates a short-lived one that auto-destroys after the line exits.
  _flashLine(irish, english) {
    // Don't interrupt a running narrative sequence
    if (this.narrativeInProgress) return;

    // Destroy any previous flash player
    if (this._flashPlayer) {
      this._flashPlayer.destroy();
      this._flashPlayer = null;
    }

    const canvas    = this.sys.game.canvas;
    const container = canvas.parentElement || document.body;
    const H         = window.innerHeight;
    const SLIDER_H  = 52;

    this._flashPlayer = new ScrollingTextPlayer({
      lines: [{ ga: irish, en: english, speaker: 'queen' }],
      getMoonPhase: () => GameSettings.englishOpacity ?? 0.7,
      onComplete: () => { this._flashPlayer = null; },
      container,
    });

    this._flashPlayer.start();

    // Fast scroll
    const vel = 120 / 60;
    this._flashPlayer._naturalVel = vel;
    this._flashPlayer._velocity   = vel;
    this._flashPlayer._ceilingY       = 999999;
    this._flashPlayer._onReachCeiling = function() {};
    this._flashPlayer._onComplete     = function() {};

    // Start at mid-screen
    this._flashPlayer._scrollY = H * 0.5;

    // Top-half hitzone
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

    // Same render patch
    const CEIL_PX = SLIDER_H + 8;
    const FADE_PX = 80;
    const MID_PX  = H * 0.5;
    this._flashPlayer._render = function() {
      if (!this._overlay) return;
      const H2 = window.innerHeight;
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
          entry.enEl.style.color   = '#c084fc'; // purple for English text
        }
      }
    };

    // Auto-destroy once line exits top
    const fp = this._flashPlayer;
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
    const hitDialogues = this.tutorialData.narrative.onHit;
    const dialogue = this.getRandomDialogue(hitDialogues, this.usedHitDialogues);
    this._flashLine(dialogue.irish, dialogue.english);
  }

  showMissDialogue() {
    if (this.narrativeInProgress || this.tutorialComplete) return;
    const missDialogues = this.tutorialData.narrative.onMiss;
    const dialogue = this.getRandomDialogue(missDialogues, this.usedMissDialogues);
    this._flashLine(dialogue.irish, dialogue.english);
  }


showFarewell() {
  const farewell = this.tutorialData.narrative.farewell;
  if (!farewell || farewell.length === 0) return;

  this.tutorialComplete = true;
  this.narrativeInProgress = true;

  const lines = farewell.map(e => ({
    ga: e.irish,
    en: e.english,
    speaker: 'queen',
  }));

  this._showStoryLines(lines, () => {
    this.narrativeInProgress = false;
    console.log('BowTutorial: farewell complete');

    this.cameras.main.fadeOut(500, 0, 0, 0);
  this.cameras.main.once('camerafadeoutcomplete', () => {
    // Hide PGR DOM canvases immediately — prevents flash when new scene loads
    ;['pgr-ground','pgr-objects','pgr-light','pgr-sky','pgr-sky-img','pgr-fog'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.style.display = 'none'
    })
    const container = document.getElementById('gameContainer')
    if (container) container.style.background = '#000'

    const currentOpacity = GameSettings.englishOpacity;

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


  // Creature GIDs from oryxCreatures sheet
  _targetGids() { return [1987, 1988, 1989, 1990, 1991] }

  createTarget() {
    if (this.target) {
      if (this._targetTween) { this._targetTween.stop(); this._targetTween = null; }
      this.target.destroy(); this.target = null;
    }
    this.currentTargetIndex = (this.currentTargetIndex ?? -1) + 1;
    if (this.currentTargetIndex >= 5) this.currentTargetIndex = 0;

    const SPAWN_LX = 4 * 48 + 24;
    const SPAWN_LY = 16 * 48 + 24;
    const positions = [
      { dx:  0, dy: -10 },
      { dx: -3, dy: -10 },
      { dx:  3, dy: -10 },
      { dx: -4, dy: -12 },
      { dx:  4, dy: -12 },
    ];
    const pos      = positions[this.currentTargetIndex];
    const logicalX = SPAWN_LX + pos.dx * 48;
    const logicalY = SPAWN_LY + pos.dy * 48;

    const pgr     = this.perspectiveGround;
    const proj    = pgr?._projectLogical(logicalX, logicalY);
    const ts      = pgr?.tileDisplaySize ?? 48;
    const tileRow = logicalY / ts - 0.5;
    const scaledW = pgr?._scaleAtRow(tileRow + 1) ?? 20;
    const scale   = (scaledW / ts) * 3.0;

    const screenX = proj?.screenX ?? this.scale.width / 2;
    const screenY = proj?.screenY ?? this.scale.height * 0.45;
    const standY  = screenY - scaledW * 0.3;
    const buriedY = screenY + scaledW * 2;

    // Build creature texture from sheet
    const gid    = this._targetGids()[this.currentTargetIndex];
    const canvas = this.creatureSheet?.getCanvas(gid);
    let target;

    if (canvas) {
      const texKey = `creature_${gid}`;
      if (!this.textures.exists(texKey)) this.textures.addCanvas(texKey, canvas);
      target = this.add.image(screenX, buriedY, texKey)
        .setDepth(10).setScale(scale).setOrigin(0.5, 1);
    } else {
      target = this.add.circle(screenX, buriedY, 22, 0xcc2200, 0.9)
        .setStrokeStyle(2, 0xffffff).setDepth(10);
    }

    target._worldLogicalX = logicalX;
    target._worldLogicalY = logicalY;
    target._standY        = standY;
    target._scaledW       = scaledW;
    target.setData('hit', false);
    this.target = target;

    // Pop up from ground
    this.tweens.add({
      targets: target, y: standY, duration: 350, ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.target) return;
        const range = Phaser.Math.Between(70, 130);
        const speed = Phaser.Math.Between(1800, 3200);
        this._targetTween = this.tweens.add({
          targets: this.target, x: screenX + range,
          duration: speed, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      }
    });
  }

  // Called when target is hit — knockdown animation
  _knockdownTarget() {
    const t = this.target;
    if (!t) return;
    if (this._targetTween) { this._targetTween.stop(); this._targetTween = null; }
    this.target = null;
    this.tweens.add({
      targets: t,
      angle:   -90,
      y:       t.y + (t._scaledW ?? 20) * 2,
      alpha:   0,
      duration: 400, ease: 'Power2.easeIn',
      onComplete: () => { if (t?.scene) t.destroy(); }
    });
  }

  _updateTargetScreenPos() {
    // Targets positioned once at creation — no per-frame update needed
  }

  moveTargetToNext() {
    // Duck target back down then create next one
    if (this.target) {
      if (this._targetTween) { this._targetTween.stop(); this._targetTween = null; }
      const t = this.target; this.target = null;
      this.tweens.add({
        targets: t, y: t.y + (t._scaledW ?? 20) * 3, alpha: 0,
        duration: 300, ease: 'Power2.easeIn',
        onComplete: () => { t.destroy(); this.createTarget(); }
      });
    } else {
      this.createTarget();
    }
  }



update(time, delta) {
  // PGR renders ground + player billboard each frame
  if (this.perspectiveGround) this.perspectiveGround.update();

  if (this.textPanel) {
    this.textPanel.update(time, delta);
  }







// Update prediction dot while aiming
  if (this.bowMechanics.isAiming && this.predictionDot) {
    const prediction = this.bowMechanics.predictLandingPoint();
    if (prediction) {
      this.predictionDot.setPosition(prediction.x, prediction.y);
      this.predictionDot.setVisible(false);
    }
  } else if (this.predictionDot) {
    this.predictionDot.setVisible(false);
  }
  // Update Scáthach hitbox to follow sprite position
  if (this.scathach && this.scathachHitbox) {
    this.scathachHitbox.x = this.scathach.x;
    this.scathachHitbox.y = this.scathach.y;
  }

  // Check for out of arrows
  if (!this._arrowsExhausted && this.player?.inventory) {
    const inv   = this.player.inventory
    let total   = 0
    for (let i = 0; i < inv.totalSlots; i++) {
      const item = inv.getItem(i)
      if (item?.id === 'arrows') total += item.quantity
    }
    const inFlight = this.bowMechanics.arrows.filter(a => !a.getData('hasLanded')).length
    if (total === 0 && inFlight === 0 && !this.tutorialComplete) {
      this._arrowsExhausted = true
      this.time.delayedCall(800, () => { this.showFarewell() })
    }
  }

  // Update bow mechanics (arrow physics)
  this.bowMechanics.update(delta);

  // Check for arrow hit on target - ADD NULL CHECK
    
if (this.target && !this.hitLocked) {

const hit = this.bowMechanics.checkHit(this.target, 30);
    if (hit) {
      this.onTargetHit(hit);
    }
  }

  // Check if any arrow (in-flight OR just landed) passes near Scáthach
  if (this.scathach && this.scathachHitbox) {
    this.bowMechanics.arrows.forEach(arrow => {
      if (arrow.getData('parried') || arrow.getData('hitTarget')) return

      // Use landing screen pos if landed, otherwise current pos
      const sx = arrow.getData('hasLanded')
        ? (arrow.getData('landScreenX') ?? arrow.getData('prevScreenX'))
        : arrow.getData('prevScreenX')
      const sy = arrow.getData('hasLanded')
        ? (arrow.getData('landScreenY') ?? arrow.getData('prevScreenY'))
        : arrow.getData('prevScreenY')
      if (sx == null) return

      const distance = Phaser.Math.Distance.Between(
        sx, sy,
        this.scathachHitbox.x, this.scathachHitbox.y
      )
      if (distance < 70) {
        this.onScathachHit(arrow)
      }
    })
  }

  // Check for missed arrows - ADD NULL CHECK
  if (this.target) {
    this.bowMechanics.arrows.forEach(arrow => {
      if (arrow.getData('hasLanded') && !arrow.getData('counted')) {
        arrow.setData('counted', true)
        // Skip miss logic if this arrow already registered a hit
        if (arrow.getData('hitTarget')) return
        const landSX = arrow.getData('landScreenX')
        const landSY = arrow.getData('landScreenY')
        if (landSX == null) return
        const distance = Phaser.Math.Distance.Between(
          landSX, landSY, this.target.x, this.target.y
        )
        if (distance > 50) {
          this.missCount++
          this.onMiss()
        }
      }
    })
  }



  if (this.advancedTraining) {
    this.advancedTraining.update();
  }

}

onTargetHit(hitData) {
  if (this.hitLocked) return;
  this.hitLocked = true;

  this.hitCount++;
  this.consecutiveHits++;
  this.consecutiveMisses = 0;

  this.updateHitTracker(this.consecutiveHits);
  // Knockdown animation on hit
  this._knockdownTarget();

  // Check win condition first
  if (this.consecutiveHits >= 4 && !this.tutorialComplete) {
    this.tutorialComplete = true;
    
    this.textPanel.show({
      type: 'chat_options',
      irish: 'Sin é.',
      english: 'That\'s it.',
      speaker: 'Scáthach',
      options: [
        {
          irish: 'Ceacht eile?',
          english: 'Another lesson?'
        },
        {
          irish: 'Fág slán',
          english: 'Take your leave'
        }
      ],
      onChoice: (index, option) => {
        console.log(`Player chose option ${index}:`, option);
        if (index === 0) {
          this.time.delayedCall(300, () => {
            this.moreTraining();
          });
        } else {
          this.time.delayedCall(300, () => {
            this.showFarewell();
          });
        }
      }
    });
    
    return; // Exit early, don't move target
  }

  // Show dialogue at 3 hits
  if (this.consecutiveHits === this.NARRATIVE_THRESHOLD && !this.tutorialComplete) {
    this.showHitDialogue();
  }

  // Move to next target after knockdown completes
  this.time.delayedCall(600, () => {
    this.hitLocked = false;
    this.createTarget();
  });

  console.log(
    `TARGET HIT! Force: ${hitData.force.toFixed(2)}, Distance: ${hitData.distance.toFixed(0)}`
  );
}

onMiss() {
this.resetHitTracker()
  this.consecutiveHits = 0;
  this.consecutiveMisses++;

  if (
    this.consecutiveMisses >= this.NARRATIVE_THRESHOLD &&
    !this.tutorialComplete
  ) {
    this.showMissDialogue();
    this.consecutiveMisses = 0;
  }
}
onScathachHit(arrow) {
  // Mark the original arrow
  arrow.setData('parried', true);
  arrow.setData('active', false);
  arrow.setData('counted', true);

  // Use Scáthach's position as spawn point for the parry effect
  const arrowX = this.scathachHitbox?.x ?? (arrow.getData('prevScreenX') ?? 200);
  const arrowY = this.scathachHitbox?.y ?? (arrow.getData('prevScreenY') ?? 300);
  const arrowRotation = 0;

  // Destroy trail
  const trail = arrow.getData('trail');
  if (trail) trail.destroy();

  // Remove from bowMechanics tracking
  const arrowIndex = this.bowMechanics.arrows.indexOf(arrow);
  if (arrowIndex > -1) {
    this.bowMechanics.arrows.splice(arrowIndex, 1);
  }

  // Destroy the physics arrow
  arrow.destroy();

  // === VISUAL PARRY EFFECT ===

  // Tint Scáthach bright white for 200ms
  this.scathach.setTint(0xffffff);
  this.time.delayedCall(200, () => {
    this.scathach.clearTint();
  });

  // Subtle recoil on Scáthach
  this.tweens.add({
    targets: this.scathach,
    x: this.scathach.x + Phaser.Math.Between(-6, 6),
    duration: 80,
    yoyo: true,
    ease: 'Quad.easeOut'
  });

  // Play parry sound
  this.sound.play('parrySound', { volume: 1 });

  // === RANDOM SKYWARD DEFLECTION ===
  // Draw deflected arrow as a Graphics line (matches our arrow style)
  const deflectGfx = this.add.graphics()
  deflectGfx.setDepth(200)
  deflectGfx.setScrollFactor(0)

  const baseUpwardAngle = -Math.PI / 2;
  const spread          = Phaser.Math.DegToRad(60);
  const deflectAngle    = baseUpwardAngle + Phaser.Math.FloatBetween(-spread / 2, spread / 2);
  const bounceDistance  = Phaser.Math.Between(120, 200);
  const endX            = arrowX + Math.cos(deflectAngle) * bounceDistance;
  const endY            = arrowY + Math.sin(deflectAngle) * bounceDistance;
  const arrowLen        = 12;

  // Animate via manual tween using a proxy object
  const proxy = { t: 0 };
  this.tweens.add({
    targets: proxy,
    t: 1,
    duration: Phaser.Math.Between(700, 1000),
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      const cx  = arrowX + (endX - arrowX) * proxy.t;
      const cy  = arrowY + (endY - arrowY) * proxy.t;
      const rot = deflectAngle + proxy.t * Math.PI * Phaser.Math.FloatBetween(3, 5);
      deflectGfx.clear()
      deflectGfx.lineStyle(1.5, 0xffffff, 1 - proxy.t * 0.8)
      deflectGfx.beginPath()
      deflectGfx.moveTo(cx - Math.cos(rot) * arrowLen, cy - Math.sin(rot) * arrowLen)
      deflectGfx.lineTo(cx + Math.cos(rot) * arrowLen, cy + Math.sin(rot) * arrowLen)
      deflectGfx.strokePath()
    },
    onComplete: () => { deflectGfx.destroy() }
  });

  console.log('🗡️  PARRIED! arrow at:', arrowX.toFixed(0), arrowY.toFixed(0),
    'arrowTexture exists:', this.textures.exists('arrowTexture'));
}


moreTraining() {
  this.time.delayedCall(300, () => {
    this.advancedTraining.start();
  });
}
createScathach() {
  const screenWidth = this.scale.width;
  const screenHeight = this.scale.height;

  // Position
  const scathachX = screenWidth * 0.75;
  const scathachY = screenHeight * 0.58;  // lower - in the ground zone

  // Wind direction (left + slightly down)
  this.wind = { x: -15, y: 5 };

  // Add Scáthach
  this.scathach = this.add.image(scathachX, scathachY, 'scathach');
  this.scathach.setScale(0.8);
  this.scathach.setDepth(20);

  // Create hitbox attached to Scáthach
  this.scathachHitbox = this.add.circle(scathachX, scathachY, 40, 0xff0000, 0);
  this.scathachHitbox.setData('isScathach', true);
  this.scathachHitbox.setDepth(19);
  
  // --- CAPE SPRITE ---
  this.cape = this.add.image(
    scathachX - 20,
    scathachY - 15,
    'cape'
  );

  this.cape.setOrigin(0, 0);
  this.cape.setDepth(15);

  // Animation state
  this.capeTime = 0;

  // Store the cape update callback so we can remove it later
  this.capeUpdateCallback = (time, delta) => {
    if (!this.cape) return; // Guard clause
    
    this.capeTime += delta * 0.001;

    const windStrength = Phaser.Math.Clamp(
      Math.abs(this.wind.x) / 15,
      0.4,
      1
    );

    this.cape.rotation =
      -0.12 * windStrength +
      Math.sin(this.capeTime * 1.1) * 0.05;

    this.cape.scaleX = 1 + Math.sin(this.capeTime * 0.9) * 0.1;

    this.cape.scaleY =
      1 + Math.sin(this.capeTime * 1.3 + 1) * 0.04;
  };

  // Billowing update
  this.events.on('update', this.capeUpdateCallback);

  // --- OCCASIONAL GUST ---
  this.time.addEvent({
    delay: 5000,
    loop: true,
    callback: () => {
      if (!this.cape) return; // Guard clause
      
      this.tweens.add({
        targets: this.cape,
        scaleX: 1.25,
        rotation: -0.2,
        duration: 900,
        yoyo: true,
        ease: 'Sine.easeInOut'
      });
    }
  });

  console.log('Scáthach created at:', scathachX, scathachY);
}


  addSettingsSlider() {
    const W          = this.scale.width;
    const sliderX    = W * 0.04;
    const sliderW    = W * 0.92;
    const sliderY    = 26;
    const initVal    = GameSettings.englishOpacity ?? 0.7;

    // Track background
    this.add.rectangle(sliderX + sliderW/2, sliderY, sliderW, 6, 0x333333)
      .setScrollFactor(0).setDepth(3500);

    // Gold fill — updated on drag
    const trackFill = this.add.rectangle(sliderX, sliderY, sliderW * initVal, 6, 0xd4af37)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(3501);

    // Moon thumb — drawn on a Phaser RenderTexture
    const moonR  = 14;
    const moonD  = moonR * 2;
    const moonRT = this.add.renderTexture(0, 0, moonD, moonD)
      .setScrollFactor(0).setDepth(3502).setOrigin(0.5, 0.5);
    moonRT.x = sliderX + sliderW * initVal;
    moonRT.y = sliderY;

    const drawMoon = (phase) => {
      moonRT.clear();
      const g = this.add.graphics();
      // Glow
      g.fillStyle(0xc8dcff, 0.18 + phase * 0.12);
      g.fillCircle(moonR, moonR, moonR * 1.5);
      // Dark disc
      g.fillStyle(0x08041e, 1);
      g.fillCircle(moonR, moonR, moonR * 0.92);
      // Lit face
      const litR = Math.round(200 + phase*35);
      const litG = Math.round(210 + phase*30);
      const litB = Math.round(220 + phase*20);
      g.fillStyle(Phaser.Display.Color.GetColor(litR, litG, litB), 1);
      if (phase >= 0.99) {
        g.fillCircle(moonR, moonR, moonR * 0.92);
      } else {
        // Crescent: draw filled semicircle then subtract with dark ellipse
        // Approximate with Phaser graphics arc
        g.slice(moonR, moonR, moonR * 0.92,
          Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(90), false);
        g.fillPath();
        const ex = moonR * 0.92 * Math.cos(phase * Math.PI);
        g.fillStyle(0x08041e, 1);
        g.fillEllipse(moonR + ex * 0.5, moonR, Math.abs(ex), moonR * 1.84);
      }
      moonRT.draw(g, 0, 0);
      g.destroy();
    };

    drawMoon(initVal);

    // Make thumb interactive
    moonRT.setInteractive(
      new Phaser.Geom.Circle(moonR, moonR, moonR * 1.4),
      Phaser.Geom.Circle.Contains
    );
    this.input.setDraggable(moonRT);

    this.input.on('drag', (pointer, obj, dragX) => {
      if (obj !== moonRT) return;
      const cx      = Phaser.Math.Clamp(dragX, sliderX, sliderX + sliderW);
      obj.x         = cx;
      const opacity = (cx - sliderX) / sliderW;
      GameSettings.setEnglishOpacity(opacity);
      trackFill.width = sliderW * opacity;
      drawMoon(opacity);

      // Update textPanel English opacity
      if (this.textPanel) this.textPanel.updateEnglishOpacity();

      // Update storyPlayer English opacity immediately
      if (this.storyPlayer && this.storyPlayer._lineEls) {
        for (const entry of this.storyPlayer._lineEls) {
          if (entry.enEl) {
            entry.enEl.style.opacity = String(opacity);
            entry.enEl.style.color   = '#c084fc'; // purple for English text
          }
        }
      }
    });
  }
}  
