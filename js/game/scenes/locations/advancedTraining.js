import Phaser from "phaser";
export default class AdvancedTraining {
  constructor(scene) {
    this.scene = scene;
this.wordPairs =[
  { light: { irish: 'Bán', english: 'White' }, dark: { irish: 'Dubh', english: 'Black' } },
  { light: { irish: 'Lasta', english: 'On' }, dark: { irish: 'Múchta', english: 'Off' } },
/*  { light: { irish: 'Fíor', english: 'True' }, dark: { irish: 'Bréagach', english: 'False' } },
  { light: { irish: 'A hAon', english: 'One' }, dark: { irish: 'A Náid', english: 'Zero' } },
  { light: { irish: 'Beo', english: 'Alive' }, dark: { irish: 'Marbh', english: 'Dead' } },
  { light: { irish: 'Dearfach', english: 'Positive' }, dark: { irish: 'Diúltach', english: 'Negative' } },
  { light: { irish: 'Lá', english: 'Day' }, dark: { irish: 'Oíche', english: 'Night' } },
  { light: { irish: 'Ceart', english: 'Right' }, dark: { irish: 'Mícheart', english: 'Wrong' } },
  { light: { irish: 'Láidir', english: 'Strong' }, dark: { irish: 'Lag', english: 'Weak' } },
  { light: { irish: 'Maith', english: 'Good' }, dark: { irish: 'Olc', english: 'Bad' } },
  { light: { irish: 'Geal', english: 'Light' }, dark: { irish: 'Dorcha', english: 'Dark' } },
  { light: { irish: 'Suas', english: 'Up' }, dark: { irish: 'Síos', english: 'Down' } },
  { light: { irish: 'Lán', english: 'Full' }, dark: { irish: 'Folamh', english: 'Empty' } },
  { light: { irish: 'Te', english: 'Hot' }, dark: { irish: 'Fuar', english: 'Cold' } },
  { light: { irish: 'Buaigh', english: 'Win' }, dark: { irish: 'Caill', english: 'Lose' } },
  { light: { irish: 'Rath', english: 'Success' }, dark: { irish: 'Teip', english: 'Failure' } },
  { light: { irish: 'Grá', english: 'Love' }, dark: { irish: 'Fuath', english: 'Hate' } },
  { light: { irish: 'Cara', english: 'Friend' }, dark: { irish: 'Neamhaid', english: 'Enemy' } },
  { light: { irish: 'Dóchas', english: 'Hope' }, dark: { irish: 'Éadóchas', english: 'Despair' } },
  { light: { irish: 'Flaithiúil', english: 'Generous' }, dark: { irish: 'Cíocrach', english: 'Greedy' } },
  { light: { irish: 'Tús', english: 'Start' }, dark: { irish: 'Deireadh', english: 'End' } },
  { light: { irish: 'Cliste', english: 'Smart' }, dark: { irish: 'Amaideach', english: 'Stupid' } },
  { light: { irish: 'Álainn', english: 'Beautiful' }, dark: { irish: 'Gránna', english: 'Ugly' } },
  { light: { irish: 'Sonas', english: 'Joy' }, dark: { irish: 'Brón', english: 'Sorrow' } },
  { light: { irish: 'Soirbh', english: 'Optimistic' }, dark: { irish: 'Doirbh', english: 'Pessimistic' } },
  { light: { irish: 'Sásta', english: 'Happy' }, dark: { irish: 'Gruama', english: 'Sad' } },
  { light: { irish: 'Laoch', english: 'Hero' }, dark: { irish: 'Crochaire', english: 'Villain' } },
 */ { light: { irish: 'Cróga', english: 'Brave' }, dark: { irish: 'Meathtach', english: 'Cowardly' } },
 { light: { irish: 'Macánta', english: 'Honest' }, dark: { irish: 'Mí-mhacánta', english: 'Dishonest' } }
]
   
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
  
  // Create spear graphic (placeholder - simple line for now)
  this.spear = this.scene.add.graphics();
  this.spear.lineStyle(3, 0x888888, 1); // Gray spear shaft
  this.spear.lineBetween(0, 0, 0, -60); // 60 pixels tall
  this.spear.fillStyle(0xc0c0c0, 1); // Silver spearhead
  this.spear.fillTriangle(-4, -60, 4, -60, 0, -75);
  this.spear.setDepth(21);
  this.spear.x = this.scene.scathach.x - 5; // Slightly in front
  this.spear.y = this.scene.scathach.y + 20; // Bottom near her feet
  
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
    irish: 'Sin fírinne an tsaighead.',
    english: 'That\'s the arrow\'s truth.',
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


revealSpear2() {
  this.scene.textPanel.show({
    irish: 'Ach ní hionnan an slea agus an saighead.',
    english: 'But the spear and the arrow are not the same.',
    type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      this.spearKata2();
    }
  });
}

revealSpear3() {
  this.scene.textPanel.show({
    irish: 'Is í an sleá, úfás ár naimhead,  .',
    english: 'The spear is the terror of our foes, the irreducible complexity of our poetry.',
    type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      this.spearKata3();
    }
  });
}




sliceMountain() {
  // Draw the slice line
  const sliceLine = this.scene.add.graphics();
  sliceLine.setDepth(10);
  sliceLine.lineStyle(2, 0xffffff, 0.8);
  sliceLine.lineBetween(
    0, 
    this.scene.scale.height * 0.28, 
    this.scene.scale.width, 
    this.scene.scale.height * 0.28
  );
  
  // Slide the top of the mountain down
  this.scene.tweens.add({
    targets: this.mountainTop,
    y: this.mountainTop.y + 30,
    x: this.mountainTop.x - 20,
    angle: -5,
    duration: 1500,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      // Fade out the mountain pieces
      this.scene.tweens.add({
        targets: [this.mountainTop, this.mountainBottom],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.mountainTop.destroy();
          this.mountainBottom.destroy();
          this.mountainTop = null;
          this.mountainBottom = null;
        }
      });
    }
  });
  
  this.scene.time.delayedCall(500, () => {
    sliceLine.destroy();
  });
  
  // REMOVED: No longer calls revealSpear4 here
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
  // The TOP piece (which will slide) uses skyeMountainBottom graphic
  this.mountainTop = this.scene.add.image(
    screenWidth / 2,           // ADD X position
    screenHeight / 2,          // ADD Y position
    'skyeMountainBottom'
  );
  this.mountainTop.setDepth(5);
  this.mountainTop.setDisplaySize(screenWidth, screenHeight);

  // The BOTTOM piece (which stays) uses skyeMountainTop graphic
  this.mountainBottom = this.scene.add.image(
    screenWidth / 2,           // ADD X position
    screenHeight / 2,          // ADD Y position
    'skyeMountainTop'
  );
  this.mountainBottom.setDepth(5);
  this.mountainBottom.setDisplaySize(screenWidth, screenHeight);

  // Darken the sky
  this.darkOverlay = this.scene.add.rectangle(
    screenWidth / 2,
    screenHeight / 2,
    screenWidth,
    screenHeight,
    0x000000,
    0
  );
  this.darkOverlay.setDepth(19);  // Darken the sky
  this.darkOverlay.setDepth(19);
  
  this.scene.tweens.add({
    targets: this.darkOverlay,
    alpha: 0.6,
    duration: 1000,
    ease: 'Power2'
  });
  
  // Ethereal glow around Scáthach
  this.etherealGlow = this.scene.add.circle(scathachX, scathachY, 60, 0xffffff, 0);
  this.etherealGlow.setDepth(18);
  
  this.scene.tweens.add({
    targets: this.etherealGlow,
    alpha: 0.4,
    scale: 1.5,
    duration: 800,
    ease: 'Sine.easeInOut'
  });
  
  // Levitate upward
  this.scene.tweens.add({
    targets: this.scene.scathach,
    y: scathachY - 150,
    duration: 1500,
    ease: 'Sine.easeOut',
    onComplete: () => {
      this.executeThreeSlashes(scathachX, scathachY - 150);
    }
  });

this.dragonKataComplete = true;

}

executeThreeSlashes(x, y) {
  // First slash
  this.createDraconicSlash(x, y, Math.PI / 6, 0xff0000);
  this.scene.cameras.main.shake(200, 0.005);
  
  this.scene.time.delayedCall(400, () => {
    // Second slash
    this.createDraconicSlash(x, y, -Math.PI / 6, 0xff6600);
    this.scene.cameras.main.shake(300, 0.008);
    
    this.scene.time.delayedCall(400, () => {
      // THIRD BLINDING SLASH - THE DRAGON
      this.createDragonSlash(x, y);
    });
  });
}

createDraconicSlash(x, y, angle, color) {
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
  dragon.setDepth(29);
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
  // Draw the slice line
  const sliceLine = this.scene.add.graphics();
  sliceLine.setDepth(10);
  sliceLine.lineStyle(2, 0xffffff, 0.8);
  sliceLine.lineBetween(
    0,
    this.scene.scale.height * 0.28,
    this.scene.scale.width,
    this.scene.scale.height * 0.28
  );

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

  // Remove the slice line after a moment
  this.scene.time.delayedCall(500, () => {
    sliceLine.destroy();
  });

  // Continue to next part of the sequence
  this.scene.time.delayedCall(4500, () => {
    this.revealSpear4();
  });
}


revealSpear4() {
  if (!this.dragonKataComplete) {
    this.scene.textPanel.show({
      irish: 'Óllphéist na nairm í an tsleá.\nI fraoch nó i bhfriotal\nón slea a thiochfaidh cáil ort.',
      english: 'The dragon of weapons.\nIn fury or restraint you will be known by your spear',
      type: 'dialogue',
      speaker: 'Scáthach',
      onDismiss: () => {
        this.spearKata4();
      }
    });
  } else {
    this.scene.textPanel.show({
      irish: '…ach ní go fóil.\nSeas ar cnoc Alúne.\nNuair atá do mionn tughta, thaispánfar dhuit mar a stiúrann an fhilíocht sleá na bhFiann',
      english: '…but not yet.\nStand on the Hill of Alune.\nWhen you have taken the oath, I will reveal \nhow poetry guides the fenian spear.',
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
    irish: 'Sin fírinne an tsaighead.',
    english: 'That\'s the arrow\'s truth.',
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
}

// KATA 2 — Spinning spear throw and catch
revealSpear2() {
  this.scene.textPanel.show({
    irish: 'Ach ní hionann an slea agus an saighead.',
    english: 'But the spear and the arrow are not the same.',
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

  // Create a container for the spear (shaft + blade)
  const spear = this.scene.add.container(scathachX, scathachY);
  spear.setDepth(this.scene.scathach.depth + 1);

  // Brown wooden shaft
  const shaft = this.scene.add.rectangle(0, 0, 50, 4, 0x8b4513);
  
  // Golden/bronze blade (triangle pointing right)
  const blade = this.scene.add.triangle(
    25,  // x position (at the end of shaft)
    0,   // y position (centered)
    0, -6,    // point 1 (left top)
    0, 6,     // point 2 (left bottom)
    12, 0,    // point 3 (right tip)
    0xcd7f32  // bronze color
  );

  spear.add([shaft, blade]);

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
        angle: 720, // Two full rotations
        duration: 800,
        ease: 'Quad.easeOut'
      });

      // Step 3: Scáthach backflip sequence
      this.scene.time.delayedCall(100, () => {
        this.scene.tweens.add({
          targets: this.scene.scathach,
          y: scathachY - 120,
          angle: -360, // Full backflip
          duration: 600,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            // Reset rotation
            this.scene.scathach.angle = 0;

            // Step 4: Land and prepare to catch
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
                spear.destroy();  // This properly destroys the container and all children
              }
            });

            // Camera shake on catch
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
    irish: 'Is í an sleá, úfás ár naimhead.',
    english: 'The spear is the terror of our foes, the irreducible complexity of our poetry.',
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

  // Strike 1: Dash forward with horizontal slash
  this.scene.tweens.add({
    targets: this.scene.scathach,
    x: scathachX + 40,
    duration: 200,
    ease: 'Power2.easeOut',
    onStart: () => {
      this.drawSlashEffect(scathachX + 20, scathachY, 0, 0xff6600);
      this.scene.cameras.main.shake(100, 0.004);
    },
    onComplete: () => {
      
      // Strike 2: Leap and vertical spin
      this.scene.tweens.add({
        targets: this.scene.scathach,
        y: scathachY - 100,
        angle: 360,
        duration: 400,
        ease: 'Sine.easeOut',
        onStart: () => {
          this.drawSlashEffect(scathachX + 40, scathachY - 50, Math.PI / 2, 0xff8800);
          this.scene.cameras.main.shake(150, 0.005);
        },
        onComplete: () => {
          
          // Strike 3: Descending spiral attack
          this.scene.tweens.add({
            targets: this.scene.scathach,
            y: scathachY,
            x: scathachX,
            angle: 720, // Double spin on descent
            duration: 500,
            ease: 'Power2.easeIn',
            onStart: () => {
              // Multiple slash trails during descent
              this.drawSlashEffect(scathachX + 30, scathachY - 60, -Math.PI / 4, 0xffaa00);
              this.scene.time.delayedCall(150, () => {
                this.drawSlashEffect(scathachX + 20, scathachY - 30, Math.PI / 4, 0xffcc00);
              });
              this.scene.time.delayedCall(300, () => {
                this.drawSlashEffect(scathachX, scathachY, 0, 0xffee00);
              });
            },
            onComplete: () => {
              // Reset rotation and clean up
              this.scene.scathach.angle = 0;
              this.scene.scathach.x = scathachX;
              this.scene.scathach.y = scathachY;
              
              // Final impact shake
              this.scene.cameras.main.shake(200, 0.008);
              
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

