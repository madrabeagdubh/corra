import Phaser from 'phaser';
import Player from '../../player/player.js';
import BowMechanics from '../../combat/bowMechanics.js';
import TextPanel from '../../ui/textPanel.js';
import { GameSettings } from '../../settings/gameSettings.js';
import AdvancedTraining from './advancedTraining.js';
export default class BowTutorial extends Phaser.Scene {
	  constructor() {
		      super({ key: 'BowTutorial' });
		    }

	  preload() {
		      // Load parry sound
		       //this.load.audio('parrySound', 'assets/sounds/parry.ogg');


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
this.load.image('skyeClouds', 'assets/skye0.png');       


    this.load.image('cape', 'assets/cape.png');
    // Load champion spritesheet and atlas
    this.load.image('championSheet', 'assets/champions/champions-with-kit.png');
    this.load.image('arrowTexture', 'assets/arrow1.png');
    this.load.json('championAtlas', 'assets/champions/champions0.json');

    this.load.image('scathach', 'assets/sc01.png');
    // Load tutorial data
    this.load.json('bowTutorialData', '/maps/bowTutorial.json?v=' + Date.now());
  }

create() {  // <-- THIS WAS MISSING!
    console.log('BowTutorial: starting');
    this.hitLocked = false;
    // Load tutorial data
    this.tutorialData = this.cache.json.get('bowTutorialData');

    if (!this.tutorialData) {
      console.error('BowTutorial: Tutorial data not found!');
      return;
    }

    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;

this.clouds1 = this.add.image(0, 0, 'skyeClouds');
this.clouds1.setOrigin(0, 0); // Top-left origin
this.clouds1.setDepth(-1); // Behind the mountains

this.clouds2 = this.add.image(this.clouds1.width -1, 0, 'skyeClouds');
this.clouds2.setOrigin(0, 0); // Top-left origin
this.clouds2.setDepth(-1);

this.mountainBottom = this.add.image(screenWidth / 2, screenHeight / 2, 'skyeMountainBottom');
this.mountainBottom.setDisplaySize(screenWidth, screenHeight);
this.mountainBottom.setDepth(0);

this.mountainTop = this.add.image(screenWidth / 2, screenHeight / 2, 'skyeMountainTop');
this.mountainTop.setDisplaySize(screenWidth, screenHeight);
this.mountainTop.setDepth(0); 










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
    this.createTarget();

    // Initialize text panel system
    this.textPanel = new TextPanel(this);

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

    // Show exposition narrative
    this.showExposition();

    this.createScathach();

   
this.advancedTraining = new AdvancedTraining(this);
  

// Create prediction dot (for testing/future spell)
this.predictionDot = this.add.circle(0, 0, 5, 0xff0000, 0.8);
this.predictionDot.setDepth(100);
this.predictionDot.setVisible(false);
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
    this.narrativeQueue = [...exposition];

    const showNext = () => {
      if (this.narrativeQueue.length === 0) {
        this.narrativeInProgress = false;
        console.log('BowTutorial: exposition complete');
        return;
      }

      const entry = this.narrativeQueue.shift();

      this.textPanel.show({
        irish: entry.irish,
        english: entry.english,
        type: 'dialogue',
        speaker: 'Scáthach ',
        onDismiss: () => {
          this.time.delayedCall(300, showNext);
        }
      });
    };

    showNext();
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

  showHitDialogue() {
    if (this.narrativeInProgress || this.textPanel.isVisible || this.tutorialComplete) return;

    const hitDialogues = this.tutorialData.narrative.onHit;
    const dialogue = this.getRandomDialogue(hitDialogues, this.usedHitDialogues);

    this.textPanel.show({
      irish: dialogue.irish,
      english: dialogue.english,
      type: 'dialogue',
      speaker: 'Scáthach '
    });
  }

  showMissDialogue() {
    if (this.narrativeInProgress || this.textPanel.isVisible || this.tutorialComplete) return;

    const missDialogues = this.tutorialData.narrative.onMiss;
    const dialogue = this.getRandomDialogue(missDialogues, this.usedMissDialogues);

    this.textPanel.show({
      irish: dialogue.irish,
      english: dialogue.english,
      type: 'dialogue',
      speaker: 'Scáthach'
    });
  }

  showFarewell() {
    const farewell = this.tutorialData.narrative.farewell;
    if (!farewell || farewell.length === 0) return;

    this.tutorialComplete = true;
    this.narrativeInProgress = true;
    this.narrativeQueue = [...farewell];

    const showNext = () => {
      if (this.narrativeQueue.length === 0) {
        this.narrativeInProgress = false;
        console.log('BowTutorial: farewell complete - tutorial finished');
        // Could transition to another scene here
      
this.cameras.main.fadeOut(500, 0, 0, 0);
this.cameras.main.once('camerafadeoutcomplete', () => {
  this.scene.start('BogMeadow');
});

  return;
      }

      const entry = this.narrativeQueue.shift();

      this.textPanel.show({
        irish: entry.irish,
        english: entry.english,
        type: 'dialogue',
        speaker: 'Scáthach',
        onDismiss: () => {
          this.time.delayedCall(300, showNext);
        }
      });
    };

    showNext();
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
    this.bullseye1 = this.add.circle(targetX, targetY, 20, 0xff6600, 0.8);
    this.bullseye2 = this.add.circle(targetX, targetY, 10, 0xffff00, 0.9);
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
  



// Scroll clouds slowly
  const scrollSpeed =  0.1 ; // Adjust speed here (pixels per frame)
  
  if (this.clouds1) {
    this.clouds1.x -= scrollSpeed;
    this.clouds2.x -= scrollSpeed;
    
    const cloudWidth = this.clouds1.width;
    
    // Loop clouds1
    if (this.clouds1.x <= -cloudWidth) {
      this.clouds1.x = this.clouds2.x + cloudWidth;
    }
    
    // Loop clouds2
    if (this.clouds2.x <= -cloudWidth) {
      this.clouds2.x = this.clouds1.x + cloudWidth;
    }
  }




// Update prediction dot while aiming
  if (this.bowMechanics.isAiming && this.predictionDot) {
    const prediction = this.bowMechanics.predictLandingPoint();
    if (prediction) {
      this.predictionDot.setPosition(prediction.x, prediction.y);
      this.predictionDot.setVisible(true);
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
  if (this.consecutiveHits >= 1 && !this.tutorialComplete) {
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

/*ining() {
  console.log('BowTutorial: starting more training');
  
  this.narrativeInProgress = true;
  
  // Remove Scáthach
  if (this.scathach) {
    this.scathach.destroy();
    this.scathach = null;
  }
  
  // Remove the original target
  if (this.target) {
    this.target.destroy();
    this.target = null;
  }
  
  // Get player position
  const playerX = this.player.x;
  const playerY = this.player.y;
  
  // Create dark-themed target to the north-west
  const darkTarget = this.add.sprite(
    playerX - 150,  // West
    playerY - 150,  // North
    'target'  // Use your target sprite key
  );
  darkTarget.setTint(0x4a2860);  // Dark purple tint
  darkTarget.setScale(1);
  darkTarget.setDepth(10);
  
  // Create light-themed target to the north-east
  const lightTarget = this.add.sprite(
    playerX + 150,  // East
    playerY - 150,  // North
    'target'  // Use your target sprite key
  );
  lightTarget.setTint(0xffd700);  // Golden/light tint
  lightTarget.setScale(1);
  lightTarget.setDepth(10);
  
  // Store references
  this.darkTarget = darkTarget;
  this.lightTarget = lightTarget;
  
  this.narrativeInProgress = false;
  
  // Maybe show some dialogue explaining the new challenge?
  this.textPanel.show({
    irish: 'Anois, déan iarracht ar an dá sprioc seo!',
    english: 'Now, try hitting both of these targets!',
    type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      console.log('Ready for advanced training');
    }
  });
}*/


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
    const sliderWidth = this.scale.width * 0.95; // 95% of screen width
    const sliderHeight = 8;
    const sliderX = this.scale.width * 0.025; // Center it (2.5% margin on each side)
    const sliderY = 20;

    // Create background track (dark part)
    const trackBg = this.add.rectangle(
      sliderX + sliderWidth / 2,
      sliderY,
      sliderWidth,
      sliderHeight,
      0x444444
    ).setScrollFactor(0).setDepth(3500); // Above text panel (which is 3000)

    // Create golden fill (updates based on opacity)
    const trackFill = this.add.rectangle(
      sliderX,
      sliderY,
      sliderWidth * GameSettings.englishOpacity,
      sliderHeight,
      0xd4af37
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(3501);

    // Create draggable thumb
    const thumb = this.add.circle(
      sliderX + (sliderWidth * GameSettings.englishOpacity),
      sliderY,
      15,
      0xffd700
    ).setScrollFactor(0).setDepth(3502).setInteractive();

    this.input.setDraggable(thumb);

    this.input.on('drag', (pointer, gameObject, dragX) => {
      if (gameObject === thumb) {
        const clampedX = Phaser.Math.Clamp(dragX, sliderX, sliderX + sliderWidth);
        thumb.x = clampedX;

        const opacity = (clampedX - sliderX) / sliderWidth;
        GameSettings.setEnglishOpacity(opacity);

        // Update golden fill width
        trackFill.width = sliderWidth * opacity;

        // Update any visible English text in real-time
        if (this.textPanel) {
          this.textPanel.updateEnglishOpacity();
        }
      }
    });
  }
}
