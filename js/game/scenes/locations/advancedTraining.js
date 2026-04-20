import Phaser from "phaser";
import { wordPairs } from '/data/wordPairs';
export default class AdvancedTraining {
  constructor(scene) {
    this.scene = scene;

    // Select 10 random word pairs with Bán/Dubh always first
        this.wordPairs = this.selectWordPairs();
	    this.currentPairIndex = 0;
   
    this.currentPairIndex = 0;
    this.isActive = false;
    this.darkTarget = null;
    this.lightTarget = null;
    this.currentTargetType = null;
this.bullseyeHits = 0;
  this.totalHits = 0;
  }

	preload(){
// Make sure fonts are loaded
  this.load.on('complete', () => {
    document.fonts.ready.then(() => {
      console.log('Fonts loaded');
    });
  });
	}
playSwoosh(volume = 0.5) {
  const sounds = ['metalSwoosh1', 'metalSwoosh2', 'metalSwoosh4'];
  const key = Phaser.Utils.Array.GetRandom(sounds);

  this.scene.sound.play(key, {
    volume,
    rate: Phaser.Math.FloatBetween(0.9, 1.1) // slight pitch variation
  });
}

  start() {
    console.log('AdvancedTraining: starting');

    // Create dragon animations if not already created
    if (!this.scene.anims.exists('dragon_idle')) {
      this.scene.anims.create({
        key: 'dragon_idle',
        frames: [{ key: 'dragon', frame: 0 }],
        frameRate: 1, repeat: -1
      })
      this.scene.anims.create({
        key: 'dragon_roar',
        frames: this.scene.anims.generateFrameNumbers('dragon', { start: 0, end: 1 }),
        frameRate: 4, repeat: -1
      })
    }
    
    // Clean up old tutorial elements
    this.cleanupTutorialElements();
    
    // Create new targets
    this.createTargets();
    
    // Show introduction
    this.showIntroduction();
  }

  cleanupTutorialElements() {
    // Remove Scáthach
    if (this.scene.scathach) {
      this.scene.scathach.destroy();
      this.scene.scathach = null;
    }
    
    // Remove cape and its animation
    if (this.scene.cape) {
      if (this.scene.capeUpdateCallback) {
        this.scene.events.off('update', this.scene.capeUpdateCallback);
      }
      this.scene.cape.destroy();
      this.scene.cape = null;
    }
    
    // Remove hitbox
    if (this.scene.scathachHitbox) {
      this.scene.scathachHitbox.destroy();
      this.scene.scathachHitbox = null;
    }
    
    // Remove original target and bullseyes
    if (this.scene.target) {
      this.scene.target.destroy();
      this.scene.target = null;
    }
    
    if (this.scene.bullseye1) {
      this.scene.bullseye1.destroy();
      this.scene.bullseye1 = null;
    }
    
    if (this.scene.bullseye2) {
      this.scene.bullseye2.destroy();
      this.scene.bullseye2 = null;
    }
  }

  createTargets() {
    // Position targets in screen space north of player using PGR projection
    const pgr = this.scene.perspectiveGround
    const ts  = this.scene.tileSize ?? 48

    // Player spawn is at col=4, row=16. Place targets 7 tiles north, ±2.5 tiles side.
    const SPAWN_LX = 4 * ts + ts / 2
    const SPAWN_LY = 16 * ts + ts / 2

    const darkLogX  = SPAWN_LX - 2.5 * ts
    const darkLogY  = SPAWN_LY - 11 * ts
    const lightLogX = SPAWN_LX + 2.5 * ts
    const lightLogY = SPAWN_LY - 11 * ts

    // Project to screen
    const darkProj  = pgr?._projectLogical(darkLogX,  darkLogY)
    const lightProj = pgr?._projectLogical(lightLogX, lightLogY)

    const sw = this.scene.scale.width
    const sh = this.scene.scale.height

    const darkX  = darkProj?.screenX  ?? sw * 0.35
    const darkY  = darkProj?.screenY  ?? sh * 0.45
    const lightX = lightProj?.screenX ?? sw * 0.65
    const lightY = lightProj?.screenY ?? sh * 0.45

    // Create dark target
    this.darkTarget = this.scene.add.graphics();
    this.darkTarget.setPosition(darkX, darkY);
    this.darkTarget.setScrollFactor(0);
    this.darkTarget.setDepth(100);
    this.drawTarget(this.darkTarget, 'dark');
    this.darkTarget.setData('hit', false);
    this.darkTarget.setData('type', 'dark');
    // No logicalX — use screen coords for hit detection

    // Create light target
    this.lightTarget = this.scene.add.graphics();
    this.lightTarget.setPosition(lightX, lightY);
    this.lightTarget.setScrollFactor(0);
    this.lightTarget.setDepth(100);
    this.drawTarget(this.lightTarget, 'light');
    this.lightTarget.setData('hit', false);
    this.lightTarget.setData('type', 'light');

    console.log('Targets created at:', darkX.toFixed(0), darkY.toFixed(0), lightX.toFixed(0), lightY.toFixed(0));
  }

  drawTarget(target, type) {
    const radius = 20;
    if (type === 'dark') {
      target.fillStyle(0x000000, 1);
      target.fillCircle(0, 0, radius);
      target.fillStyle(0x0066ff, 1);
      target.fillCircle(0, 0, radius * 0.75);
      target.fillStyle(0x000000, 1);
      target.fillCircle(0, 0, radius * 0.5);
      target.fillStyle(0x0066ff, 1);
      target.fillCircle(0, 0, radius * 0.25);
    } else {
      target.fillStyle(0xffffff, 1);
      target.fillCircle(0, 0, radius);
      target.fillStyle(0x0066ff, 1);
      target.fillCircle(0, 0, radius * 0.75);
      target.fillStyle(0xffffff, 1);
      target.fillCircle(0, 0, radius * 0.5);
      target.fillStyle(0x0066ff, 1);
      target.fillCircle(0, 0, radius * 0.25);
    }
  }

  showIntroduction() {
    this.scene._showStoryLines([
      { ga: 'Níl ach ceann scríbe amháin ag an saighead.', en: 'The arrow has but one destiny.', speaker: 'queen' }
    ], () => {
      this.isActive = true;
      this.showNextWord();
    });
  }


selectWordPairs() {
    // Find the Bán/Dubh pair (White/Black)
        const banDubhPair = wordPairs.find(pair => 
	      pair.light.irish === 'Bán' && pair.dark.irish === 'Dubh'
	          );

		      // Get all other pairs
		          const otherPairs = wordPairs.filter(pair => 
			        !(pair.light.irish === 'Bán' && pair.dark.irish === 'Dubh')
				    );

				        // Shuffle the other pairs using Phaser's array shuffle
					    const shuffled = Phaser.Utils.Array.Shuffle([...otherPairs]);

					        // Take the first 9 from the shuffled array
						    const selectedPairs = shuffled.slice(0, 9);

						        // Return Bán/Dubh first, then the 9 random pairs
							    return [banDubhPair, ...selectedPairs];
							      }

							        showNextWord() {
								    if (this.currentPairIndex >= this.wordPairs.length) {
								          this.complete();
									        return;
										    }

										        const pair = this.wordPairs[this.currentPairIndex];
											    const showLight = Math.random() > 0.5;
											        const wordToShow = showLight ? pair.light : pair.dark;

												    this.currentTargetType = showLight ? 'light' : 'dark';

												        // Use archery_prompt type instead of notification
    this.scene._flashLine(wordToShow.irish, wordToShow.english);
																    }


  update() {
    if (!this.isActive) return;
    
    // Check for hits on targets
    if (this.darkTarget && !this.darkTarget.getData('hit')) {
      const darkHit = this.scene.bowMechanics.checkHit(this.darkTarget, 35);
      if (darkHit) {
        this.onTargetHit('dark');
      }
    }
    
    if (this.lightTarget && !this.lightTarget.getData('hit')) {
      const lightHit = this.scene.bowMechanics.checkHit(this.lightTarget, 35);
      if (lightHit) {
        this.onTargetHit('light');
      }
    }
  }

 onTargetHit(targetType) {
  const hitCorrectTarget = targetType === this.currentTargetType;
  
  if (hitCorrectTarget) {
    const target = targetType === 'dark' ? this.darkTarget : this.lightTarget;
    
    // Find the arrow that just hit by looking for recently deactivated arrows
    let hitDistance = 999; // Default to far away
    
    this.scene.bowMechanics.arrows.forEach(arrow => {
      // Use landing screen position, not arrow.x/y (Graphics object)
      const lsx = arrow.getData('landScreenX') ?? arrow.getData('prevScreenX')
      const lsy = arrow.getData('landScreenY') ?? arrow.getData('prevScreenY')
      if (lsx == null) return
      const distance = Phaser.Math.Distance.Between(
        lsx, lsy,
        target.x, target.y
      );
      if (distance < hitDistance) {
        hitDistance = distance;
      }
    });
    
    this.totalHits++;

    // Green flash on hit
    target.clear();
    target.fillStyle(0x00ff00, 1);
    target.fillCircle(0, 0, 25);
    target.setData('hit', true);
    
    // Move to next word after delay
    this.scene.time.delayedCall(1500, () => {
      target.clear();
      this.drawTarget(target, targetType);
      target.setData('hit', false);
      
      this.currentPairIndex++;
      this.showNextWord();
    });
  } else {
    // Wrong target
    this.scene._flashLine('Mícheart! Bain triail eile as.', 'Wrong! Try again.');
  }
} 

showBullseyeEffect(x, y) {
  // Create a golden ring that expands outward
  const ring = this.scene.add.graphics();
  ring.setDepth(101);
  ring.lineStyle(3, 0xffd700, 1);
  ring.strokeCircle(x, y, 10);
  
  this.scene.tweens.add({
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
  
  // Optional: Add text popup
  const bullseyeText = this.scene.add.text(x, y - 30, 'BULLSEYE!', {
    fontSize: '16px',
    fontFamily: 'monospace',
    color: '#ffd700',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  bullseyeText.setDepth(102);
  
  this.scene.tweens.add({
    targets: bullseyeText,
    y: y - 60,
    alpha: 0,
    duration: 800,
    ease: 'Power2',
    onComplete: () => bullseyeText.destroy()
  });
}








createScathachForKata() {
  // Create Scáthach off-screen right
  this.dragonKataComplete = false;
  const screenWidth = this.scene.scale.width;
  const screenHeight = this.scene.scale.height;
  const targetX = screenWidth * 0.5; // Center of screen
  const targetY = screenHeight * 0.45;

  this.scene.scathach = this.scene.add.image(screenWidth + 50, targetY, 'scathach');
  this.scene.scathach.setScale(0.8);
  this.scene.scathach.setDepth(20);
  this.scene.scathach.setAlpha(1);

  // Create spear as a container (so it rotates properly)
  this.spear = this.scene.add.container(
    this.scene.scathach.x - 1,
    this.scene.scathach.y + 20
  );
  this.spear.setDepth(21);

  // Create the graphics for shaft and head
  const spearGraphics = this.scene.add.graphics();
  
  // Brown wooden shaft (vertical)
  spearGraphics.lineStyle(3, 0x8b4513, 1);
  spearGraphics.lineBetween(0, 0, 0, -60);
  
  // Bronze/golden spearhead
  spearGraphics.fillStyle(0xcd7f32, 1);
  spearGraphics.fillTriangle(-4, -60, 4, -60, 0, -75);

  // Add graphics to container
  this.spear.add(spearGraphics);

  // Start the hobbling walk
  this.hobbleToCenter(targetX, targetY);
}








hobbleToCenter(targetX, targetY) {
  const stepDistance = 18;
  const numSteps = Math.floor((this.scene.scathach.x - targetX) / stepDistance);
  let currentStep = 0;

  const takeStep = () => {
    if (currentStep >= numSteps) {
      this.scene.time.delayedCall(500, () => {
        this.revealSpear1();
      });
      return;
    }

    this.scene.tweens.add({
      targets: this.spear,
      x: this.spear.x - stepDistance,
      angle: -15,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.scene.scathach,
          x: this.scene.scathach.x - stepDistance,
          y: this.scene.scathach.y + Math.sin(currentStep) * 2,
          duration: 300,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.scene.tweens.add({
              targets: this.spear,
              angle: 0,
              duration: 100
            });

            currentStep++;
            this.scene.time.delayedCall(150, takeStep);
          }
        });
      }
    });
  };

  takeStep();
} 




complete() {
  this.isActive = false;
  this.createScathachForKata();
}





revealSpear1() {
  this.scene._showStoryLines([
    { ga: 'Fíor nó bréagach. Bás nó saol. Sin a nochtan an saighead. Sin uile', en: 'True or false. Death or life. So reveals the arrow. Nothing more.', speaker: 'queen' }
  ], () => { this.spearKata1(); });
}



// KATA 0 — assume stance / settle into position
spearKata0() {
  const startY = this.scene.scathach.y;

  this.scene.tweens.add({
    targets: this.scene.scathach,
    y: startY - 12,
    duration: 400,
    ease: 'Sine.easeOut',
    onComplete: () => {
      this.scene.time.delayedCall(300, () => {
        this.spearKataSimple();
      });
    }
  });
}

// KATA 1 — simple, grounded movement
spearKataSimple() {
  const startX = this.scene.scathach.x;

  this.scene.tweens.add({
    targets: this.scene.scathach,
    x: startX + 20,
    duration: 250,
    yoyo: true,
    repeat: 1,
    ease: 'Quad.easeInOut',
    onComplete: () => {
      this.scene.time.delayedCall(200, () => {
        this.revealSpear2();
      });
    }
  });
}



revealSpear3() {
  this.scene._showStoryLines([
    { ga: 'Óllphéist na nairm í.', en: 'She is the dragon of weapons.', speaker: 'queen' }
  ], () => { this.spearKata3(); });
}




// sliceMountain removed





drawSlashEffect(x, y, angleOffset, color) {
  const radius = 80;
  const startAngle = -Math.PI / 4 + angleOffset;
  const endAngle = Math.PI / 4 + angleOffset;
  
  // Main slash line
  this.slashEffect.lineStyle(4, color, 0.8);
  this.slashEffect.beginPath();
  this.slashEffect.arc(x, y, radius, startAngle, endAngle, false);
  this.slashEffect.strokePath();
  
  // Motion blur trail
  this.slashEffect.lineStyle(8, color, 0.3);
  this.slashEffect.beginPath();
  this.slashEffect.arc(x, y, radius - 5, startAngle, endAngle, false);
  this.slashEffect.strokePath();
  
  // Fade out effect
  this.scene.tweens.add({
    targets: this.slashEffect,
    alpha: 0,
    duration: 400,
    ease: 'Power2'
  });
}

spearKata4() {
  // THE DRAGON SEQUENCE — simplified (no mountain drama for now)
  const scathachX = this.scene.scathach.x;
  const scathachY = this.scene.scathach.y;

  // Subtle ethereal glow
  this.etherealGlow = this.scene.add.circle(scathachX, scathachY, 70, 0xffffff, 0.12);
  this.etherealGlow.setDepth(18);

    // Mark complete so revealSpear4 takes the "go to bog" path
  this.dragonKataComplete = true;

  // Levitate upward - Scáthach
  this.scene.tweens.add({
    targets: this.scene.scathach,
    y: scathachY - 80,
    duration: 1000,
    ease: 'Sine.easeOut',
    onComplete: () => {
      this.executeThreeSlashes(scathachX, scathachY - 80);
      // Land and go to finale
      this.scene.time.delayedCall(1500, () => {
        this.scene.tweens.add({
          targets: this.scene.scathach,
          y: scathachY,
          duration: 600,
          ease: 'Bounce.easeOut',
          onComplete: () => { this.revealSpear4(); }
        });
      });
    }
  });

  // Levitate the spear with her
  if (this.spear) {
    this.scene.tweens.add({
      targets: this.spear,
      y: this.spear.y - 150,
      duration: 1500,
      ease: 'Sine.easeOut'
    });
  }

  // Levitate the glow with her
  this.scene.tweens.add({
    targets: this.etherealGlow,
    y: scathachY - 150,
    duration: 1500,
    ease: 'Sine.easeOut'
  });

  this.dragonKataComplete = true;
}

executeThreeSlashes(x, y) {
  // First slash - spear slashes diagonally
  this.createSpearSlash(x, y, Math.PI / 6, 0xff0000);
  this.scene.cameras.main.shake(200, 0.005);

  this.scene.time.delayedCall(400, () => {
    // Second slash
    this.createSpearSlash(x, y, -Math.PI / 6, 0xff6600);
    this.scene.cameras.main.shake(300, 0.008);

    this.scene.time.delayedCall(400, () => {
      // THIRD SLASH - then throw spear at mountain
      this.createSpearSlash(x, y, 0, 0xff8800);
      this.scene.cameras.main.shake(400, 0.01);
      
      // After third slash, hurl spear at mountain
      this.scene.time.delayedCall(300, () => {
        this.hurlSpearAtMountain(x, y);
      });
    });
  });
}
createSpearSlash(x, y, angle, color) {
  // Animate the walking spear to create the slash
  if (this.spear) {
    const startAngle = this.spear.angle;
    const targetAngle = (angle * 180 / Math.PI) - 90; // Convert to degrees, adjust for vertical spear
    
    // Quick slash rotation
    this.scene.tweens.add({
      targets: this.spear,
      angle: targetAngle,
      duration: 150,
      ease: 'Power2.easeOut',
      yoyo: true
    });
  }

  // Slash trail effect
  const slash = this.scene.add.graphics();
  slash.setDepth(26);

  const length = 200;
  const startX = x + Math.cos(angle) * -length / 2;
  const startY = y + Math.sin(angle) * -length / 2;
  const endX = x + Math.cos(angle) * length / 2;
  const endY = y + Math.sin(angle) * length / 2;

  // Main slash
  slash.lineStyle(6, color, 1);
  slash.lineBetween(startX, startY, endX, endY);

  // Glow effect
  slash.lineStyle(15, color, 0.3);
  slash.lineBetween(startX, startY, endX, endY);

  this.scene.tweens.add({
    targets: slash,
    alpha: 0,
    duration: 600,
    onComplete: () => slash.destroy()
  });
}



hurlSpearAtMountain(x, y) {
  if (!this.spear) return;

  const screenWidth = this.scene.scale.width;
  const screenHeight = this.scene.scale.height;
  
  // Target: center of screen, HIGHER up (mountain in distance)
  const targetX = screenWidth / 2;
  const targetY = screenHeight * 0.25; // Higher up - mountain is in distance

  // Hide walking spear, create throwable version
  this.spear.setVisible(false);

  // Create spear for throwing (horizontal)
  const thrownSpear = this.scene.add.container(x, y);
  thrownSpear.setDepth(25);

  const spearGraphics = this.scene.add.graphics();
  spearGraphics.lineStyle(4, 0x8b4513, 1);
  spearGraphics.lineBetween(-25, 0, 25, 0);
  spearGraphics.fillStyle(0xcd7f32, 1);
  spearGraphics.fillTriangle(25, -6, 25, 6, 37, 0);
  
  thrownSpear.add(spearGraphics);

  // Point toward target (upward angle)
  const angleToTarget = Math.atan2(targetY - y, targetX - x);
  thrownSpear.angle = angleToTarget * 180 / Math.PI;

  // Throw spear - shrink to dot as it travels upward
  this.scene.tweens.add({
    targets: thrownSpear,
    x: targetX,
    y: targetY,
    scale: 0.1, // Shrink to dot
    duration: 800,
    ease: 'Power2.easeIn',
    onComplete: () => {
      // Spear hits mountain - create white slash
      this.showDragonSilhouette(targetX, targetY);
      thrownSpear.setVisible(false);

      // Return spear after slash
      this.scene.time.delayedCall(200, () => {
        this.returnSpearToScathach(thrownSpear, x, y);
      });
    }
  });
}


// createMountainSlash removed






returnSpearToScathach(thrownSpear, scathachX, scathachY) {
  thrownSpear.setVisible(true);
  
  // Return to Scáthach - grow back to normal size
  this.scene.tweens.add({
    targets: thrownSpear,
    x: scathachX,
    y: scathachY,
    scale: 1,
    angle: -90, // Vertical again
    duration: 600,
    ease: 'Power2.easeOut',
    onComplete: () => {
      thrownSpear.destroy();
      // Restore walking spear
      if (this.spear) {
        this.spear.setVisible(true);
        this.spear.x = this.scene.scathach.x - 5;
        this.spear.y = this.scene.scathach.y + 20;
        this.spear.angle = 0;
      }
    }
  });


}





// landAndSliceMountain removed — no mountain sequence










createDragonSlash(x, y) {
  // Trigger the dragon cinematic — it handles everything internally
  this.showDragonSilhouette(x, y)

  // While dragon is doing its thing, land Scáthach
  this.scene.time.delayedCall(3800, () => {
    if (this.scene.scathach) {
      this.scene.tweens.add({
        targets: this.scene.scathach,
        y: this.scene.scale.height * 0.58,
        duration: 600,
        ease: 'Bounce.easeOut'
      })
    }
    if (this.etherealGlow) {
      this.scene.tweens.add({
        targets: this.etherealGlow, alpha: 0, duration: 600,
        onComplete: () => { this.etherealGlow?.destroy(); this.etherealGlow = null; }
      })
    }
    if (this.spear) {
      this.spear.setVisible(true)
      if (this.scene.scathach) {
        this.spear.x = this.scene.scathach.x - 5
        this.spear.y = this.scene.scathach.y + 20
      }
      this.spear.angle = 0
    }
  })

  // Final speech after dragon withdraws
  this.scene.time.delayedCall(5200, () => { this.revealSpear4(); })
}

showDragonSilhouette(x, y) {
  const sw = this.scene.scale.width
  const sh = this.scene.scale.height

  // ── Dark overlay ──────────────────────────────────────────────────────────
  const dark = this.scene.add.rectangle(sw/2, sh/2, sw, sh, 0x000000, 0)
  dark.setDepth(420)
  this.scene.tweens.add({ targets: dark, alpha: 0.75, duration: 800 })

  // ── Dragon sprite ─────────────────────────────────────────────────────────
  // Rotated 45° CCW (angle: -45) so the head faces down-left and
  // the neck exits off the top-right — no severed neck visible.
  // Enters from top-right, strafes left, exits top-left.
  const dragonScale = (sw * 1.1) / 500
  const dragonH     = 359 * dragonScale

  let dragon
  if (this.scene.textures.exists('dragon')) {
    dragon = this.scene.add.sprite(sw + 400, -300, 'dragon')  // far off screen so neck hidden
    dragon.setScale(dragonScale)
    dragon.setOrigin(0.5, 0)
    dragon.setDepth(430)
    dragon.setAngle(-45)   // 45° CCW — head points down-left, body exits top-right
    dragon.setFlipX(false)
    dragon.play('dragon_idle')
  } else {
    dragon = this.scene.add.graphics().setDepth(430)
    dragon.fillStyle(0x8b0000, 0.9)
    dragon.fillTriangle(0, 0, -120, 200, 120, 200)
    dragon.x = sw + 200; dragon.y = -100
    dragon.angle = -45
  }

  // ── Rumble as it approaches ───────────────────────────────────────────────
  this.scene.cameras.main.shake(400, 0.005)

  // ── Strafe across — enter top-right, exit top-left ────────────────────────
  // Phase 1: glide menacingly into view (mouth closed)
  this.scene.tweens.add({
    targets: dragon,
    x: sw * 0.55,
    y: sh * 0.08,
    duration: 2800,
    ease: 'Sine.easeIn',
    onComplete: () => {

      // ── Mid-screen — open mouth, chomp, fire ─────────────────────────────
      if (dragon.play) dragon.play('dragon_roar')
      this.scene.cameras.main.shake(1400, 0.02)

      const flash = this.scene.add.rectangle(sw/2, sh/2, sw, sh, 0xff2200, 0)
      flash.setDepth(425)
      this.scene.tweens.add({
        targets: flash, alpha: 0.4, duration: 100,
        yoyo: true, repeat: 3,
        onComplete: () => flash.destroy()
      })

      // Fire breath — streams down-left from mouth
      this._spawnDragonFire(dragon, sw, sh, dragonScale, dragonH)

      // ── Phase 2: continue strafing left, exit top-left ───────────────────
      this.scene.time.delayedCall(1800, () => {
        if (dragon.play) dragon.play('dragon_idle')
        this.scene.cameras.main.shake(400, 0.01)

        this.scene.tweens.add({
          targets: dragon,
          x: -sw * 0.8,   // far enough left that neck exits before head visible
          y: -400,
          duration: 2400,
          ease: 'Sine.easeOut',
          onComplete: () => {
            dragon.destroy()
            // Lights come back
            this.scene.tweens.add({
              targets: dark, alpha: 0, duration: 1600,
              onComplete: () => dark.destroy()
            })
          }
        })
      })
    }
  })
}

_spawnDragonFire(dragon, sw, sh, dragonScale, dragonH) {
  // Fire tracks dragon mouth dynamically using a repeating timer
  // Mouth is at the tip of the head — offset based on -45deg rotation
  // At -45deg, the head points down-left, mouth at roughly:
  //   x = dragon.x - cos(45) * dragonH * 0.85
  //   y = dragon.y + sin(45) * dragonH * 0.85

  const BURSTS     = 18    // number of fire bursts over the roar period
  const BURST_MS   = 120   // ms between bursts

  for (let b = 0; b < BURSTS; b++) {
    this.scene.time.delayedCall(b * BURST_MS, () => {
      if (!dragon?.active && !dragon?.scene) return

      // Sample dragon mouth position right now
      // Sprite local mouth = (0px, 160px) i.e. left edge, halfway up
      // Origin (0.5, 0) means local (-250, 160) from origin
      // Rotated -45deg: rotate local offset then add to dragon world pos
      const scale  = dragonScale
      const lx     = -250 * scale   // left edge from centre
      const ly     =  160 * scale   // 160px down
      const cos45  = 0.7071
      const sin45  = 0.7071
      const mouthX = dragon.x + cos45 * lx + sin45 * ly
      const mouthY = dragon.y - sin45 * lx + cos45 * ly

      // 4-6 fire particles per burst
      const count = Phaser.Math.Between(4, 7)
      for (let i = 0; i < count; i++) {
        const size = Phaser.Math.Between(8, 22)
        const p = this.scene.add.rectangle(
          mouthX + Phaser.Math.Between(-12, 12),
          mouthY + Phaser.Math.Between(-8, 8),
          size, size,
          Phaser.Utils.Array.GetRandom([0xff4400, 0xff8800, 0xffcc00, 0xff2200, 0xff0000]),
          0.95
        )
        p.setDepth(435)
        p.setOrigin(0.5)

        // Stream down-left from mouth
        const spread = sh * 0.45
        this.scene.tweens.add({
          targets: p,
          x: mouthX + Phaser.Math.Between(-sw * 0.45, -sw * 0.05),
          y: mouthY + Phaser.Math.Between(spread * 0.2, spread),
          scaleX: Phaser.Math.FloatBetween(0.05, 0.4),
          scaleY: Phaser.Math.FloatBetween(0.05, 0.4),
          alpha: 0,
          duration: Phaser.Math.Between(700, 1400),
          ease: 'Power1.easeOut',
          onComplete: () => p.destroy()
        })
      }

      // Ember sparks
      for (let i = 0; i < 2; i++) {
        const spark = this.scene.add.circle(
          mouthX + Phaser.Math.Between(-15, 15),
          mouthY + Phaser.Math.Between(-5, 15),
          Phaser.Math.Between(2, 5),
          Phaser.Utils.Array.GetRandom([0xffffff, 0xffff00, 0xff8800]), 1
        )
        spark.setDepth(436)
        this.scene.tweens.add({
          targets: spark,
          x: spark.x + Phaser.Math.Between(-180, 20),
          y: spark.y + Phaser.Math.Between(80, sh * 0.55),
          alpha: 0, scale: 0,
          duration: Phaser.Math.Between(900, 1800),
          ease: 'Power2.easeOut',
          onComplete: () => spark.destroy()
        })
      }
    })
  }
}

// landAndSliceMountain removed (duplicate)

// sliceMountain removed
revealSpear4() {
  if (!this.dragonKataComplete) {
    this.scene._showStoryLines([
      { ga: 'I fraoch nó i bhfriotal\nón slea a thiochfaidh cáil ort.', en: 'In fury or restraint you will be known by your spear', speaker: 'queen' }
    ], () => { this.spearKata4(); });
  } else {
    this.scene._showStoryLines([
      { ga: 'Ach ní go fóill. Móin Alúinne ar dtús. Ansin, an ga.', en: '...but not yet.First, the Bog of Allen.Then the spear.', speaker: 'queen' }
    ], () => { this.grantMagicArrows(); });
  }
} 














// KATA 1 — Walking entrance with spear held horizontally
spearKata1() {
  const startX = this.scene.scathach.x;
  const startY = this.scene.scathach.y;

  // Flip to face direction of movement
  this.scene.scathach.setFlipX(true);

  // Show text immediately
  this.scene._showStoryLines([
    { ga: 'Ní mar sin an ga.\nGuth na nGael, úfás ár naimhde...', en: 'Not so the spear.\nVoice of our people, terror of our foes...', speaker: 'queen' }
  ], () => { this.revealSpear2(); });

  // Animation plays simultaneously
  this.scene.tweens.add({
    targets: this.scene.scathach,
    x: startX + 60,
    y: startY - 5,
    duration: 800,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      // Flip back to face forward
      this.scene.scathach.setFlipX(false);
    }
  });

  // Move the spear with her
  if (this.spear) {
    this.scene.tweens.add({
      targets: this.spear,
      x: this.spear.x + 60,
      y: this.spear.y - 5,
      duration: 800,
      ease: 'Sine.easeInOut'
    });
  }
}

// KATA 2 — Spinning spear throw and catch
revealSpear2() {
  this.scene._showStoryLines([
    { ga: '...ní dheiltar dán an ga.', en: '...spearfate is irreducable.', speaker: 'queen' }
  ], () => { this.revealSpear3(); });
  
  // Start kata 2 animation immediately
  this.spearKata2();
}


spearKata2() {
  const scathachX = this.scene.scathach.x;
  const scathachY = this.scene.scathach.y;

  // HIDE the walking spear when she starts throwing
  if (this.spear) {
    this.spear.setVisible(false);
  }

  // Create a container for the spear (shaft + blade)
  const spear = this.scene.add.container(scathachX, scathachY);
  spear.setDepth(this.scene.scathach.depth + 1);

  // Create graphics for the horizontal throwing spear
  const spearGraphics = this.scene.add.graphics();
  
  // Brown wooden shaft (horizontal, centered at origin)
  spearGraphics.lineStyle(4, 0x8b4513, 1);
  spearGraphics.lineBetween(-25, 0, 25, 0);  // 50 pixels total, centered
  
  // Bronze/golden blade at the right end
  spearGraphics.fillStyle(0xcd7f32, 1);
  spearGraphics.fillTriangle(25, -6, 25, 6, 37, 0);  // Triangle at right end

  spear.add(spearGraphics);

  // Step 1: Hold spear parallel (horizontal stance)
  this.scene.tweens.add({
    targets: this.scene.scathach,
    y: scathachY - 10,
    duration: 300,
    ease: 'Back.easeOut',
    onComplete: () => {

      // Step 2: Throw spear spinning into the air
      this.scene.tweens.add({
        targets: spear,
        y: scathachY - 200,
        angle: 720, // Two full rotations - head stays attached
        duration: 800,
        ease: 'Quad.easeOut'
      });

      // Step 3: Scáthach backflip sequence
      this.scene.time.delayedCall(100, () => {
        this.scene.tweens.add({
          targets: this.scene.scathach,
          y: scathachY - 120,
          angle: -360,
          duration: 600,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.scene.scathach.angle = 0;

            this.scene.tweens.add({
              targets: this.scene.scathach,
              y: scathachY,
              duration: 300,
              ease: 'Bounce.easeOut'
            });
          }
        });
      });

      // Step 5: Catch the spear (timed with landing)
      this.scene.time.delayedCall(700, () => {
        this.scene.tweens.add({
          targets: spear,
          y: scathachY,
          x: scathachX,
          angle: 0,
          duration: 200,
          ease: 'Back.easeIn',
          onComplete: () => {
            // Spear caught! Quick spin effect
            this.scene.tweens.add({
              targets: spear,
              angle: 180,
              duration: 150,
              yoyo: true,
              onComplete: () => {
                spear.destroy();
                // Show walking spear again at her current position
                if (this.spear) {
                  this.spear.setVisible(true);
                  this.spear.x = this.scene.scathach.x - 5;
                  this.spear.y = this.scene.scathach.y + 20;
                }
              }
            });

            this.scene.cameras.main.shake(100, 0.003);
          }
        });
      });
    }
  });
}






// KATA 3 — Rapid spinning attack with multiple strikes
revealSpear3() {
  this.scene._showStoryLines([
    { ga: 'Óllphéist na nairm í.', en: 'She is the dragon of weapons.', speaker: 'queen' }
  ], () => { this.revealSpear4(); });
  
  // Start kata 3 animation immediately
  this.spearKata3();
}






spearKata3() {
  const scathachX = this.scene.scathach.x;
  const scathachY = this.scene.scathach.y;

  this.slashEffect = this.scene.add.graphics();
  this.slashEffect.setDepth(25);

  // SEQUENCE 1: Figure-8 spear twirl with forward dash
  this.scene.tweens.add({
    targets: this.scene.scathach,
    x: scathachX + 50,
    duration: 400,
    ease: 'Power2.easeOut',
    onStart: () => {
this.playSwoosh(0.6)    

  // Spear does figure-8 twirl
      if (this.spear) {
        this.scene.tweens.add({
          targets: this.spear,
          angle: 360,
          x: this.spear.x + 50,
          duration: 400,
          ease: 'Linear'
        });
      }
      this.drawSlashEffect(scathachX + 25, scathachY, Math.PI / 4, 0xff4400);
      this.scene.cameras.main.shake(100, 0.003);
    },
    onComplete: () => {

      // SEQUENCE 2: Vertical leap with overhead spin
      this.scene.tweens.add({
        targets: this.scene.scathach,
        y: scathachY - 120,
        duration: 400,
        ease: 'Power2.easeOut',
        onStart: () => {

this.playSwoosh(0.7)
          // Spear spins overhead
          if (this.spear) {
            this.scene.tweens.add({
              targets: this.spear,
              angle: 720, // Double spin
              y: this.spear.y - 120,
              duration: 400,
              ease: 'Power2.easeOut'
            });
          }
          this.drawSlashEffect(scathachX + 50, scathachY - 60, -Math.PI / 3, 0xff6600);
          this.scene.cameras.main.shake(150, 0.004);
        },
        onComplete: () => {

          // SEQUENCE 3: Mid-air horizontal spin with thrust
          this.scene.tweens.add({
            targets: this.scene.scathach,
            angle: 360, // Full rotation
            duration: 350,
            ease: 'Linear',
            onStart: () => {

this.playSwoosh(0.8)
              // Spear extends outward during spin
              if (this.spear) {
                this.scene.tweens.add({
                  targets: this.spear,
                  angle: 360,
                  duration: 350,
                  ease: 'Linear'
                });
              }
              this.drawSlashEffect(scathachX + 50, scathachY - 120, 0, 0xff8800);
              this.scene.cameras.main.shake(150, 0.005);
            },
            onComplete: () => {
              this.scene.scathach.angle = 0;

              // SEQUENCE 4: Descending spiral strike
              this.scene.tweens.add({
                targets: this.scene.scathach,
                y: scathachY,
                x: scathachX + 30,
                angle: 540, // 1.5 rotations on descent
                duration: 500,
                ease: 'Power2.easeIn',
                onStart: () => {

this.playSwoosh(0.9)
                  // Spear creates spiral trail
                  if (this.spear) {
                    this.scene.tweens.add({
                      targets: this.spear,
                      angle: 540,
                      y: this.spear.y + 120,
                      x: this.spear.x - 20,
                      duration: 500,
                      ease: 'Power2.easeIn'
                    });
                  }
                  
                  // Multiple slash effects during descent
                  this.drawSlashEffect(scathachX + 50, scathachY - 90, -Math.PI / 6, 0xffaa00);
                  this.scene.time.delayedCall(150, () => {
                    this.drawSlashEffect(scathachX + 40, scathachY - 60, Math.PI / 3, 0xffcc00);
                  });
                  this.scene.time.delayedCall(300, () => {
                    this.drawSlashEffect(scathachX + 30, scathachY - 30, -Math.PI / 4, 0xffdd00);
                  });
                },
                onComplete: () => {

                  // SEQUENCE 5: Ground impact with final thrust
                  this.scene.scathach.angle = 0;
                  
                  // Quick crouch
                  this.scene.tweens.add({
                    targets: this.scene.scathach,
                    y: scathachY + 10,
                    duration: 100,
                    ease: 'Power2.easeIn',
                    onComplete: () => {
                      
                      // Explosive final thrust forward
                      this.scene.tweens.add({
                        targets: this.scene.scathach,
                        x: scathachX + 70,
                        y: scathachY,
                        duration: 250,
                        ease: 'Back.easeOut',
                        onStart: () => {
                          // Spear thrusts forward with impact
                       this.playSwoosh(1)
   if (this.spear) {
                            this.scene.tweens.add({
                              targets: this.spear,
                              x: this.spear.x + 90, // Spear extends further
                              angle: -90, // Horizontal thrust
                              duration: 250,
                              ease: 'Back.easeOut',
                              onComplete: () => {
                                // Return spear to vertical
                                this.scene.tweens.add({
                                  targets: this.spear,
                                  angle: 0,
                                  duration: 200
                                });
                              }
                            });
                          }
                          
                          // Final impact slash
                          this.drawSlashEffect(scathachX + 70, scathachY, 0, 0xffff00);
                          this.scene.cameras.main.shake(250, 0.01);
                        },
                       

onComplete: () => {
  // Reset to neutral stance - return to STARTING position
  this.scene.tweens.add({
    targets: this.scene.scathach,
    x: scathachX,  // Return to original X
    y: scathachY,  // Return to original Y (not +10)
    duration: 400,
    ease: 'Sine.easeInOut'
  });

  if (this.spear) {
    this.scene.tweens.add({
      targets: this.spear,
      x: scathachX - 5,  // Use scathachX not this.scene.scathach.x
      y: scathachY + 20,
      angle: 0,
      duration: 400,
      ease: 'Sine.easeInOut'
    });
  }

  // Clean up
  if (this.slashEffect) {
    this.slashEffect.destroy();
    this.slashEffect = null;
  }

  // Clean up any lingering graphics from spear sequence
  ;['animMountainTop','animMountainBottom','etherealGlow','darkOverlay'].forEach(k => {
    if (this[k]) { this[k].destroy(); this[k] = null; }
  })
}









                      });
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });
}




















grantMagicArrows() {
  // Store the magic arrows count in the game registry for later
  this.scene.registry.set('magicArrows', this.bullseyeHits);
  console.log(`Granted ${this.bullseyeHits} magic arrows to player inventory`);
  
  // Show a brief notification
  if (this.bullseyeHits > 0) {
    this.scene._flashLine(
      `Bronadh ${this.bullseyeHits} saighead draíochta ort!`,
      `You were presented with ${this.bullseyeHits} magic arrows!`
    );
    
    this.scene.time.delayedCall(4000, () => {
      if (this.scene.showFarewell) {
        this.scene.showFarewell();
      }
    });
  } else {
    if (this.scene.showFarewell) {
      this.scene.showFarewell();
    }
  }
}

cleanup() {
  if (this.darkTarget) {
    this.darkTarget.destroy();
    this.darkTarget = null;
  }
  
  if (this.lightTarget) {
    this.lightTarget.destroy();
    this.lightTarget = null;
  }
  
  // Clean up kata effects if they still exist
  if (this.slashEffect) {
    this.slashEffect.destroy();
    this.slashEffect = null;
  }

  // Clean up any lingering graphics from spear sequence
  ;['animMountainTop','animMountainBottom','etherealGlow','darkOverlay'].forEach(k => {
    if (this[k]) { this[k].destroy(); this[k] = null; }
  })
  
  if (this.darkOverlay) {
    this.darkOverlay.destroy();
    this.darkOverlay = null;
  }
  
  if (this.etherealGlow) {
    this.etherealGlow.destroy();
    this.etherealGlow = null;
  }
  
  if (this.mountainTop) {
    this.mountainTop.destroy();
    this.mountainTop = null;
  }
  
  if (this.mountainBottom) {
    this.mountainBottom.destroy();
    this.mountainBottom = null;
  }
  
  this.isActive = false;
}




}

