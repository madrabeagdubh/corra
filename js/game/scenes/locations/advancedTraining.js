import Phaser from "phaser";
export default class AdvancedTraining {
  constructor(scene) {
    this.scene = scene;
this.wordPairs =[
  { light: { irish: 'Bán', english: 'White' }, dark: { irish: 'Dubh', english: 'Black' } },
  { light: { irish: 'Lasta', english: 'On' }, dark: { irish: 'Múchta', english: 'Off' } },
  { light: { irish: 'Fíor', english: 'True' }, dark: { irish: 'Bréagach', english: 'False' } },
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
  { light: { irish: 'Cróga', english: 'Brave' }, dark: { irish: 'Meathtach', english: 'Cowardly' } },
  { light: { irish: 'Macánta', english: 'Honest' }, dark: { irish: 'Mí-mhacánta', english: 'Dishonest' } }
]
   
    this.currentPairIndex = 0;
    this.isActive = false;
    this.darkTarget = null;
    this.lightTarget = null;
    this.currentTargetType = null;
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
    
    this.scene.textPanel.show({
      irish: wordToShow.irish,
      english: wordToShow.english,
      type: 'notification'
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
      
      // Visual feedback - green flash
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
      this.scene.textPanel.show({
        irish: 'Mícheart! Bain triail eile as.',
        english: 'Wrong! Try again.',
        type: 'notification'
      });
    }
  }

createScathachForKata() {
  const screenWidth = this.scene.scale.width;
  const screenHeight = this.scene.scale.height;
  const scathachX = screenWidth * 0.85;
  const scathachY = screenHeight * 0.45;
  
  // Recreate Scáthach
  this.scene.scathach = this.scene.add.image(scathachX, scathachY, 'scathach');
  this.scene.scathach.setScale(0.8);
  this.scene.scathach.setDepth(20);
  this.scene.scathach.setAlpha(0); // Start invisible
  
  // Fade her in
  this.scene.tweens.add({
    targets: this.scene.scathach,
    alpha: 1,
    duration: 800,
    ease: 'Power2'
  });
} 
complete() {
  this.isActive = false;
  
  this.scene.textPanel.show({
	irish: 'Ní thuigenn an saighead ach an haon agus náid',
    english: 'The arrow knows only loose and hold.',
    type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      this.revealSpear1();
    }
  });
}

revealSpear1() {
 
this.createScathachForKata();

 // TODO: Scáthach appears with spear
  this.scene.time.delayedCall(800, () => {
    this.scene.textPanel.show({
      irish: 'Ach ní hionnan ríal an slea agus ríal an saighead.\nCeistíonn an slea- cé chomh fada? cé chomh fíor?',
      english: 'But the spear is not ruled as the arrow is ruled. The spear asks how far? How true?',
      type: 'dialogue',
      speaker: 'Scáthach',
      onDismiss: () => {
        this.spearKata1();
      }
    });
  });
}

spearKata1() {
 
 // TODO: Spear kata begins - draw back, feint, curve
  this.scene.time.delayedCall(2000, () => {
    this.revealSpear2();
  });
}

revealSpear2() {
  this.scene.textPanel.show({
    irish: 'Is í an tslea bunús ár neart,\ncrá ár namhaid.',
    english: 'The spear is the essence of our might, the bane of our foes.',
    type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      this.spearKata2();
    }
  });
}

spearKata2() {
  // TODO: Spear whirls - serpent motion
  this.scene.time.delayedCall(2000, () => {
    this.revealSpear3();
  });
}

revealSpear3() {
  this.scene.textPanel.show({
    irish: 'Óllphéist na nairm í an tsleá.\nI fraoch nó i bhfriotal\nón slea a thiochfaidh cáil ort.',
    english: 'The spear is the dragon among weapons.\nIn fury or restraint you will be known by your spear',
    type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      this.spearKataFinal();
    }
  });
}

spearKataFinal() {
  // TODO: Final flourish - blade stops at champion's neck
  this.scene.time.delayedCall(1500, () => {
    this.revealSpear4();
  });
}
revealSpear4() {
  this.scene.textPanel.show({
    irish: 'Ach ní go fóil.\nAr dtús, seas i scáil crann ársa,\nagus geall do chroí don chaith ós comhair na Fíanna.',
    english: 'But not yet. First you must stand with the Fenians and in the shadow of ancient trees pledged your heart to battle.',
    type: 'dialogue',
    speaker: 'Scáthach',
    onDismiss: () => {
      // Call farewell from the scene
      if (this.scene.showFarewell) {
        this.scene.showFarewell();
      }
    }
  });
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
    
    this.isActive = false;
  }
}

