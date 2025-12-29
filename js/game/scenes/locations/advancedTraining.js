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

  start() {
    console.log('AdvancedTraining: starting');
    
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
    const playerX = this.scene.player.sprite.x;
    const playerY = this.scene.player.sprite.y;
    
    const darkX = playerX - 150;
    const darkY = playerY - 150;
    const lightX = playerX + 150;
    const lightY = playerY - 150;
    
    // Create dark target (black and blue stripes)
    this.darkTarget = this.scene.add.graphics();
    this.darkTarget.setPosition(darkX, darkY);
    this.darkTarget.setDepth(100);
    this.drawTarget(this.darkTarget, 'dark');
    this.darkTarget.setData('hit', false);
    this.darkTarget.setData('type', 'dark');
    
    // Create light target (white and blue stripes)
    this.lightTarget = this.scene.add.graphics();
    this.lightTarget.setPosition(lightX, lightY);
    this.lightTarget.setDepth(100);
    this.drawTarget(this.lightTarget, 'light');
    this.lightTarget.setData('hit', false);
    this.lightTarget.setData('type', 'light');
    
    console.log('Targets created at:', darkX, darkY, lightX, lightY);
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
    this.scene.textPanel.show({
      irish: 'Níl ach ceann scríbe amháin ag an saighead.',
      english: 'The arrow has but one destiny.',
      type: 'dialogue',
      speaker: 'Scáthach',
      onDismiss: () => {
        this.isActive = true;
        this.showNextWord();
      }
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
													    this.scene.textPanel.show({
													          irish: wordToShow.irish,
														        english: wordToShow.english,
															      type: 'archery_prompt'
															          });
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
      const distance = Phaser.Math.Distance.Between(
        arrow.x, arrow.y,
        target.x, target.y
      );
      
      // If arrow is very close to target, it's our hit
      if (distance < 35) {
        hitDistance = distance;
      }
    });
    
    console.log('Hit distance from center:', hitDistance);
    
    // Check if it's a bullseye (center circle)
    let isBullseye = false;
    if (hitDistance <= 5) { // Testing with 20 pixels
      isBullseye = true;
      this.bullseyeHits++;
      console.log('BULLSEYE! Total bullseyes:', this.bullseyeHits);
       this.scene.textPanel.show({
    irish: 'Súil na sprice!',
    english: 'Bullseye!',
    type: 'dialogue'
  }); 
    }
    
    this.totalHits++;
    
    // Visual feedback - gold flash for bullseye, green for regular hit
    target.clear();
    const hitColor = isBullseye ? 0xffd700 : 0x00ff00;
    target.fillStyle(hitColor, 1);
    target.fillCircle(0, 0, 25);
    target.setData('hit', true);
    
    // Show bullseye notification
    if (isBullseye) {
      this.showBullseyeEffect(target.x, target.y);
    }
    
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
    this.scene.textPanel.show({
      irish: 'Mícheart! Bain triail eile as.',
      english: 'Wrong! Try again.',
      type: 'notification'
    });
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
  this.scene.textPanel.show({



   irish: 'Fíor nó bréagach. Bás nó saol. Sin a nochtan an saighead. Sin uile',
    english: 'True or false. Death or life. So reveals the arrow. Nothing more.',
   

   type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      this.spearKata1();
    }
  });
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
  this.scene.textPanel.show({
    irish: 'Óllphéist na nairm í.',
    english: 'She is the dragon of weapons.',
    type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      this.spearKata3();
    }
  });
}




sliceMountain() {
  // NOTE: The slice line is now created in createMountainSlash()
  // so we don't draw it again here
  
  // Slide the top of the mountain down
  this.scene.tweens.add({
    targets: this.mountainTop,
    y: this.mountainTop.y + 30,
    x: this.mountainTop.x - 20,
    angle: -5,
    duration: 1500,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      // Destroy the OLD mountains from bowTutorial
      console.log('Checking old mountains:', this.scene.mountainTop, this.scene.mountainBottom);

      if (this.scene.mountainTop) {
        console.log('Destroying scene.mountainTop');
        this.scene.mountainTop.destroy();
        this.scene.mountainTop = null;
      }
      if (this.scene.mountainBottom) {
        console.log('Destroying scene.mountainBottom');
        this.scene.mountainBottom.destroy();
        this.scene.mountainBottom = null;
      }
    }
  });

  // Continue to next part of the sequence
  this.scene.time.delayedCall(4500, () => {
    this.revealSpear4();
  });
}





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
  // THE DRAGON SEQUENCE
  const scathachX = this.scene.scathach.x;
  const scathachY = this.scene.scathach.y;

  const screenWidth = this.scene.scale.width;
  const screenHeight = this.scene.scale.height;

  // HIDE the original mountains from bowTutorial
  if (this.scene.mountainTop) this.scene.mountainTop.setVisible(false);
  if (this.scene.mountainBottom) this.scene.mountainBottom.setVisible(false);

  // Create NEW mountain pieces for the animation
  this.mountainTop = this.scene.add.image(
    screenWidth / 2,
    screenHeight / 2,
    'skyeMountainBottom'
  );
  this.mountainTop.setDepth(5);
  this.mountainTop.setDisplaySize(screenWidth, screenHeight);

  this.mountainBottom = this.scene.add.image(
    screenWidth / 2,
    screenHeight / 2,
    'skyeMountainTop'
  );
  this.mountainBottom.setDepth(5);
  this.mountainBottom.setDisplaySize(screenWidth, screenHeight);






// Darken the sky - just create it dark
this.darkOverlay = this.scene.add.rectangle(
  screenWidth / 2,
  screenHeight / 2,
  screenWidth,
  screenHeight,
  0x000000,
  0.1  // Just create it at target alpha
);
this.darkOverlay.setDepth(189);

// Ethereal glow around Scáthach - just create it glowing
this.etherealGlow = this.scene.add.circle(scathachX, scathachY, 90, 0xffffff, 0.1);  // scale 1.5 = radius 90
this.etherealGlow.setDepth(18);








  // Levitate upward - Scáthach
  this.scene.tweens.add({
    targets: this.scene.scathach,
    y: scathachY - 150,
    duration: 1500,
    ease: 'Sine.easeOut',
    onComplete: () => {
      this.executeThreeSlashes(scathachX, scathachY - 150);
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
      this.createMountainSlash(targetX, targetY);
      thrownSpear.setVisible(false);

      // Return spear after slash
      this.scene.time.delayedCall(200, () => {
        this.returnSpearToScathach(thrownSpear, x, y);
      });
    }
  });
}


createMountainSlash(x, y) {
  // White flash
  const flash = this.scene.add.rectangle(
    this.scene.scale.width / 2,
    this.scene.scale.height / 2,
    this.scene.scale.width,
    this.scene.scale.height,
    0xffffff,
    0
  );
  flash.setDepth(30);




this.scene.tweens.add({
  targets: flash,
    alpha: 1,
      duration: 100,
        yoyo: true,
	  onComplete: () => {                  // <-- Add opening brace
	      flash.destroy();                   // <-- Add semicolon
	          this.showDragonSilhouette(x, y);   // <-- Now inside callback
		    }                                    // <-- Add closing brace
		    });








  ;

  // Diagonal slash line (steeper angle, higher up, right side higher)
  const sliceLine = this.scene.add.graphics();
  sliceLine.setDepth(28);
  sliceLine.lineStyle(3, 0xffffff, 1);
  
  const leftY = this.scene.scale.height * 0.26;  // Higher on left
  const rightY = this.scene.scale.height * 0.18; // Even higher on right - steeper angle
  
  sliceLine.lineBetween(0, leftY, this.scene.scale.width, rightY);

  this.scene.time.delayedCall(500, () => {
    sliceLine.destroy();
  });

  // Trigger mountain split
  this.scene.time.delayedCall(200, () => {
    this.landAndSliceMountain();
  });
}






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





landAndSliceMountain() {
  const originalY = this.scene.scale.height * 0.45;

  // Scáthach lands gracefully
  this.scene.tweens.add({
    targets: this.scene.scathach,
    y: originalY,
    duration: 600,
    ease: 'Bounce.easeOut'
  });

  // Spear lands with her
  if (this.spear) {
    this.scene.tweens.add({
      targets: this.spear,
      y: originalY + 20,
      duration: 600,
      ease: 'Bounce.easeOut'
    });
  }

  // Clear sky
  this.scene.tweens.add({
    targets: this.darkOverlay,
    alpha: 0,
    duration: 1000,
    onComplete: () => {
      this.darkOverlay.destroy();
      this.darkOverlay = null;
    }
  });

  this.scene.tweens.add({
    targets: this.etherealGlow,
    alpha: 0,
    duration: 800,
    onComplete: () => {
      this.etherealGlow.destroy();
      this.etherealGlow = null;
    }
  });

  // Wait a beat, THEN slice the mountain (which already happened visually)
  this.scene.time.delayedCall(1000, () => {
    this.sliceMountain();
  });
}










createDragonSlash(x, y) {
  // White flash
  const flash = this.scene.add.rectangle(
    this.scene.scale.width / 2,
    this.scene.scale.height / 2,
    this.scene.scale.width,
    this.scene.scale.height,
    0xffffff,
    0
  );
  flash.setDepth(30);
  
  this.scene.tweens.add({
    targets: flash,
    alpha: 1,
    duration: 100,
    yoyo: true,
    onComplete: () => {
      this.showDragonSilhouette(x, y);
      flash.destroy();
    }
  });
  
  // Massive screen shake
  this.scene.cameras.main.shake(500, 0.02);
  
  // Land and clear sky
  this.scene.time.delayedCall(1200, () => {
    this.landAndSliceMountain();
  });
}

showDragonSilhouette(x, y) {
  // Placeholder dragon - simple triangular shape
  const dragon = this.scene.add.graphics();
  dragon.setDepth(429);
  dragon.fillStyle(0xff0000, 0.8);
  
  // Dragon body (triangle)
  dragon.fillTriangle(x, y - 100, x - 80, y + 50, x + 80, y + 50);
  
  // Left wing
  dragon.fillTriangle(x - 80, y, x - 150, y - 40, x - 80, y + 50);
  
  // Right wing
  dragon.fillTriangle(x + 80, y, x + 150, y - 40, x + 80, y + 50);
  
  // Eyes glow
  dragon.fillStyle(0xffff00, 1);
  dragon.fillCircle(x - 20, y - 30, 5);
  dragon.fillCircle(x + 20, y - 30, 5);
  
  this.scene.tweens.add({
    targets: dragon,
    alpha: 0,
    duration: 500,
    onComplete: () => dragon.destroy()
  });
}

landAndSliceMountain() {
  const originalY = this.scene.scale.height * 0.45;
  
  // Scáthach lands gracefully
  this.scene.tweens.add({
    targets: this.scene.scathach,
    y: originalY,
    duration: 600,
    ease: 'Bounce.easeOut'
  });
  
  // Clear sky
  this.scene.tweens.add({
    targets: this.darkOverlay,
    alpha: 0,
    duration: 1000,
    onComplete: () => {
      this.darkOverlay.destroy();
      this.darkOverlay = null;
    }
  });
  
  this.scene.tweens.add({
    targets: this.etherealGlow,
    alpha: 0,
    duration: 800,
    onComplete: () => {
      this.etherealGlow.destroy();
      this.etherealGlow = null;
    }
  });
  
  // Wait a beat, THEN slice the mountain
  this.scene.time.delayedCall(1000, () => {
    this.sliceMountain();
  });
}

sliceMountain() {

  // Slide the top of the mountain down
  this.scene.tweens.add({
    targets: this.mountainTop,
    y: this.mountainTop.y + 30,
    x: this.mountainTop.x - 20,
    angle: -5,
    duration: 1500,
    ease: 'Cubic.easeIn',
   onComplete: () => {
  // Destroy the OLD mountains from bowTutorial
  console.log('Checking old mountains:', this.scene.mountainTop, this.scene.mountainBottom);
  
  if (this.scene.mountainTop) {
    console.log('Destroying scene.mountainTop');
    this.scene.mountainTop.destroy();
    this.scene.mountainTop = null;
  }
  if (this.scene.mountainBottom) {
    console.log('Destroying scene.mountainBottom');
    this.scene.mountainBottom.destroy();
    this.scene.mountainBottom = null;
  }
} 
  });


  // Continue to next part of the sequence
  this.scene.time.delayedCall(4500, () => {
    this.revealSpear4();
  });
}

revealSpear4() {
  if (!this.dragonKataComplete) {
    this.scene.textPanel.show({
      irish: 'I fraoch nó i bhfriotal\nón slea a thiochfaidh cáil ort.',
      english: 'In fury or restraint you will be known by your spear',
      type: 'dialogue',
      speaker: 'Scáthach',
      onDismiss: () => {
        this.spearKata4();
      }
    });
  } else {
    this.scene.textPanel.show({
      irish: 'Ach ní go fóill.\nMóin Alúinne ar dtús.\nAnsin, an ga.',
      english: '…but not yet.\nFirst, the Bog of Allen.\nThen the spear',
      type: 'dialogue',
      speaker: 'Scáthach',
      onDismiss: () => {
        this.grantMagicArrows(); // or whatever comes next
      }
    });
  }
} 














// KATA 1 — Walking entrance with spear held horizontally
spearKata1() {
  const startX = this.scene.scathach.x;
  const startY = this.scene.scathach.y;

  // Flip to face direction of movement
  this.scene.scathach.setFlipX(true);

  // Show text immediately
  this.scene.textPanel.show({

	  irish: 'Ní mar sin an ga.\nGuth na nGael, úfás ár naimhde...',
    english: 'Not so the spear.\nVoice of our people, terror of our foes...',
 
 
  type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      this.revealSpear2();
    }
  });

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
  this.scene.textPanel.show({


    irish: '...ní dheiltar dán an ga.',
    english: '...the spear is irreducable.',
 
	  type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      this.revealSpear3();
    }
  });
  
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
  this.scene.textPanel.show({
      irish: 'Óllphéist na nairm í.',
    english: 'She is the dragon of weapons.',
    type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      this.revealSpear4();
    }
  });
  
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
    this.scene.textPanel.show({
      irish: `Bronadh ${this.bullseyeHits} saighead draíochta ort!`,
      english: `You were presented with ${this.bullseyeHits} magic arrows!`,
      type: 'notification'
    });
    
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

