import Phaser from 'phaser';
import Player from '../../player/player.js';
import BowMechanics from '../../combat/bowMechanics.js';

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
    this.load.image('skyeBackground', 'assets/skye1.png');

this.load.image('skyeMountainTop', 'assets/skye1.png');   
this.load.image('skyeMountainBottom', 'assets/skye2.png');
// skyeClouds removed — replaced by fog layer
this.load.image('fog', 'assets/fog01.png');


    this.load.image('cape', 'assets/cape.png');
    // Load champion spritesheet and atlas
    this.load.image('championSheet_unarmored', 'assets/champions/champions-no-kit.png');
    this.load.image('championSheet_armored', 'assets/champions/champions-with-kit.png');
    this.load.image('arrowTexture', 'assets/arrow1.png');
    this.load.json('championAtlas', 'assets/champions/champions0.json');

    this.load.image('scathach', 'assets/sc01.png');
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

// --- BACKGROUND: wintry tinted mountains (no clouds) ---

// Atmospheric depth haze — Oileán an Cheo (Isle of Mist)
// Baked into a RenderTexture so the gradient is smooth with zero hard edges.
// Two vertical strips (top-half and bottom-half) drawn into one texture,
// creating a bell-curve opacity that peaks in the middle of the screen.
const hazeRT = this.add.renderTexture(0, 0, screenWidth, screenHeight)
    .setDepth(0.5).setOrigin(0, 0);

const hazeGfx = this.add.graphics();

// Top half: alpha 0 → 0.75 (transparent sky fading into mist)
hazeGfx.fillGradientStyle(0xaabbc8, 0xaabbc8, 0xaabbc8, 0xaabbc8, 0, 0, 0.75, 0.75);
hazeGfx.fillRect(0, 0, screenWidth, screenHeight * 0.5);
hazeRT.draw(hazeGfx, 0, 0);

// Bottom half: alpha 0.75 → 0 (mist clearing toward the ground / gameplay area)
hazeGfx.clear();
hazeGfx.fillGradientStyle(0xaabbc8, 0xaabbc8, 0xaabbc8, 0xaabbc8, 0.75, 0.75, 0, 0);
hazeGfx.fillRect(0, 0, screenWidth, screenHeight * 0.5);
hazeRT.draw(hazeGfx, 0, screenHeight * 0.5);

hazeGfx.destroy(); // no longer needed after baking

this.mountainBottom = this.add.image(screenWidth / 2, screenHeight / 2, 'skyeMountainBottom');
this.mountainBottom.setDisplaySize(screenWidth, screenHeight);
this.mountainBottom.setDepth(0);
this.mountainBottom.setTint(0x8899aa); // cool grey-blue winter tint

this.mountainTop = this.add.image(screenWidth / 2, screenHeight / 2, 'skyeMountainTop');
this.mountainTop.setDisplaySize(screenWidth, screenHeight);
this.mountainTop.setDepth(0);
this.mountainTop.setTint(0x99aabb); // slightly lighter/cooler at the peaks

// --- FOG LAYERS: two-layer parallax, scrolling left ---
// Fog graphic is 1024x512. We scale it to 1.5× screen width so the two
// panels always overlap and the seam never shows on any screen size.
const fogScaleW = screenWidth * 1.5;
const fogScaleH = screenHeight * 0.45; // natural-ish aspect for 1024x512

// Layer 1 — foreground fog, normal orientation, slightly faster
const fogY1 = screenHeight * 0.78;
this.fog1a = this.add.image(0, fogY1, 'fog').setOrigin(0, 0.5).setDisplaySize(fogScaleW, fogScaleH).setAlpha(0.28).setDepth(1);
this.fog1b = this.add.image(fogScaleW, fogY1, 'fog').setOrigin(0, 0.5).setDisplaySize(fogScaleW, fogScaleH).setAlpha(0.28).setDepth(1);

// Layer 2 — background fog, flipped horizontally, slower (parallax depth cue)
const fogY2 = screenHeight * 0.85;
this.fog2a = this.add.image(0, fogY2, 'fog').setOrigin(0, 0.5).setDisplaySize(fogScaleW, fogScaleH).setAlpha(0.18).setDepth(2).setFlipX(true);
this.fog2b = this.add.image(fogScaleW, fogY2, 'fog').setOrigin(0, 0.5).setDisplaySize(fogScaleW, fogScaleH).setAlpha(0.18).setDepth(2).setFlipX(true);

this.fogSpeed1 = 0.3;  // foreground: faster
this.fogSpeed2 = 0.15; // background: slower = feels further away










    // Get champion
    const champion = this.registry.get('selectedChampion') ||
                     window.selectedChampion ||
                     { id: 'demo', nameGa: 'Demo', row: 0, col: 0 };

    // Create player in LOWER third of screen
    const playerX = screenWidth / 2;
    const playerY = screenHeight * 0.75;
    this.player = new Player(this, playerX, playerY, champion);

    // Disable player movement for tutorial
    this.player.canMove = false;

    // Initialize bow mechanics
    this.bowMechanics = new BowMechanics(this, this.player);

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

    // Destroy storyPlayer if scene shuts down unexpectedly
    this.events.once('shutdown', () => {
      if (this.storyPlayer)  { this.storyPlayer.destroy();  this.storyPlayer  = null; }
      if (this._flashPlayer) { this._flashPlayer.destroy(); this._flashPlayer = null; }
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

  this._showStoryLines(lines, () => {
    this.narrativeInProgress = false;
    console.log('BowTutorial: exposition complete');
    this.time.delayedCall(300, () => { this.createTarget(); });
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
    const vel = 60 / 60;
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
        if (entry.enEl) entry.enEl.style.opacity = String(alpha * mp);
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
        if (entry.enEl) entry.enEl.style.opacity = String(alpha * mp);
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
    // Use the value directly from your imported GameSettings object
    const currentOpacity = GameSettings.englishOpacity;

    initReturnCrossing(this.champion, currentOpacity, () => {
        if (window.startGame) {
            window.startGame(this.champion, { startScene: 'BogMeadow' });
        } else {
            console.error('[BowTutorial] window.startGame not found!');
            this.scene.start('BogMeadow'); 
        }
    });
});

  });
}


   createTarget() {
    this.currentTargetIndex = 0;
    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;
    const targetData = this.tutorialData.targetSequence[this.currentTargetIndex];
    const targetX = screenWidth * targetData.x;
    const targetY = screenHeight * targetData.y;
    this.target = this.add.circle(targetX, targetY, 30, 0xff0000, 0.7);
    this.target.setStrokeStyle(4, 0xffffff);
    this.target.setData('hit', false);
    this.target.setDepth(500);
    this.bullseye1 = this.add.circle(targetX, targetY, 20, 0xff6600, 0.8).setDepth(501);
    this.bullseye2 = this.add.circle(targetX, targetY, 10, 0xffff00, 0.9).setDepth(502);
this.bullseye1.setDepth(10);
this.bullseye2.setDepth(10);
  }

  moveTargetToNext() {
    this.currentTargetIndex++;
    if (this.currentTargetIndex >= this.tutorialData.targetSequence.length) {
      this.currentTargetIndex = 0;
    }
    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;
    const targetData = this.tutorialData.targetSequence[this.currentTargetIndex];
    const newX = screenWidth * targetData.x;
    const newY = screenHeight * targetData.y;
    this.tweens.add({
      targets: [this.target, this.bullseye1, this.bullseye2],
      x: newX,
      y: newY,
      duration: 500,
      ease: 'Power2'
    });
  }



update(time, delta) {
  
  if (this.textPanel) {
    this.textPanel.update(time, delta);
  }


// --- FOG PARALLAX SCROLL ---
  // Layer 1 (foreground, faster)
  if (this.fog1a) {
    this.fog1a.x -= this.fogSpeed1;
    this.fog1b.x -= this.fogSpeed1;
    const fw1 = this.fog1a.displayWidth;
    if (this.fog1a.x + fw1 < 0) this.fog1a.x = this.fog1b.x + fw1;
    if (this.fog1b.x + fw1 < 0) this.fog1b.x = this.fog1a.x + fw1;
  }
  // Layer 2 (background, slower)
  if (this.fog2a) {
    this.fog2a.x -= this.fogSpeed2;
    this.fog2b.x -= this.fogSpeed2;
    const fw2 = this.fog2a.displayWidth;
    if (this.fog2a.x + fw2 < 0) this.fog2a.x = this.fog2b.x + fw2;
    if (this.fog2b.x + fw2 < 0) this.fog2b.x = this.fog2a.x + fw2;
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

  // Update bow mechanics (arrow physics)
  this.bowMechanics.update(delta);

  // Check for arrow hit on target - ADD NULL CHECK
    
if (this.target && !this.hitLocked) {

const hit = this.bowMechanics.checkHit(this.target, 35);
    if (hit) {
      this.onTargetHit(hit);
    }
  }

  // Check if any arrow hit Scáthach - ADD NULL CHECKS
  if (this.scathach && this.scathachHitbox) {
    this.bowMechanics.arrows.forEach(arrow => {
      if (arrow.getData('active') && !arrow.getData('parried')) {
        const distance = Phaser.Math.Distance.Between(
          arrow.x, arrow.y,
          this.scathachHitbox.x, this.scathachHitbox.y
        );

        const hasPassedScathach = arrow.y < this.scathachHitbox.y - 50;

        if (distance < 40 && !hasPassedScathach) {
          this.onScathachHit(arrow);
        }
      }
    });
  }

  // Check for missed arrows - ADD NULL CHECK
  if (this.target) {
    this.bowMechanics.arrows.forEach(arrow => {
      if (!arrow.getData('active') && !arrow.getData('counted')) {
        arrow.setData('counted', true);

        const landX = arrow.x;
        const landY = arrow.y;

        const distance = Phaser.Math.Distance.Between(
          landX, landY,
          this.target.x, this.target.y
        );

        if (distance > 35) {
          this.consecutiveHits = 0;
          this.missCount++;
          this.onMiss();
        }
      }
    });
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
  // Check if it's a bullseye (very close to center)
  if (hitData.distance <= 5) {
    this.bullseyeHits++;
    console.log('BULLSEYE! Total:', this.bullseyeHits);
    // Gold flash for bullseye
    this.target.setFillStyle(0xffd700, 0.9);
    this.showBullseyeEffect(this.target.x, this.target.y);
  } else {
    // Regular green flash
    this.target.setFillStyle(0x00ff00, 0.9);
  }

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

  // Reset target and move to next after a short delay
  this.time.delayedCall(1000, () => {
    this.target.setFillStyle(0xff0000, 0.7);
    this.hitLocked = false;
    this.moveTargetToNext();
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

  // Store arrow's current state
  const arrowX = arrow.x;
  const arrowY = arrow.y;
  const arrowRotation = arrow.rotation;

  // Destroy the trail and shadow immediately
  const trail = arrow.getData('trailGraphics');
  if (trail) trail.destroy();

  const shadow = arrow.getData('shadow');
  if (shadow) shadow.destroy();

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

  // Create a NEW visual-only arrow sprite for the parry effect
  const parriedArrow = this.add.image(arrowX, arrowY, 'arrowTexture');
  parriedArrow.setOrigin(0.5, 0.5).setScale(0.2);
  parriedArrow.setRotation(arrowRotation);

  // Play parry sound
  this.sound.play('parrySound', { volume: 1 });

  // === RANDOM SKYWARD DEFLECTION ===
  const baseUpwardAngle = -Math.PI / 2; // straight up
  const spread = Phaser.Math.DegToRad(60); // ±30°
  const deflectAngle =
    baseUpwardAngle + Phaser.Math.FloatBetween(-spread / 2, spread / 2);

  const bounceDistance = Phaser.Math.Between(100, 160);

  this.tweens.add({
    targets: parriedArrow,
    x: arrowX + Math.cos(deflectAngle) * bounceDistance,
    y: arrowY + Math.sin(deflectAngle) * bounceDistance,
    rotation:
      arrowRotation + Phaser.Math.FloatBetween(Math.PI * 3, Math.PI * 6),
    alpha: 0,
    duration: Phaser.Math.Between(700, 1000),
    ease: 'Cubic.easeOut',
    onComplete: () => {
      parriedArrow.destroy();
    }
  });

  console.log('🗡️  PARRIED! Scáthach deflected the arrow!');
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
  const scathachX = screenWidth * 0.85;
  const scathachY = screenHeight * 0.45;

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
            const rawA   = entry.gaEl.style.opacity;
            const spatial = rawA !== '' ? parseFloat(rawA) : 1;
            entry.enEl.style.opacity = String(spatial * opacity);
          }
        }
      }
    });
  }
}
