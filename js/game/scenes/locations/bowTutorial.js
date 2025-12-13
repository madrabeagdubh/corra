import Phaser from 'phaser';
import Player from '../../player/player.js';
import BowMechanics from '../../combat/bowMechanics.js';

export default class BowTutorial extends Phaser.Scene {
  constructor() {
    super({ key: 'BowTutorial' });
  }

  preload() {
    // Load champion spritesheet and atlas (same as base scene)
    this.load.image('championSheet', 'assets/champions/champions-with-kit.png');
    this.load.image('arrowTexture', 'assets/arrow.png');
    this.load.json('championAtlas', 'assets/champions/champions0.json');
  }

  create() {
    console.log('BowTutorial: starting');

    // Simple background
    this.cameras.main.setBackgroundColor('#3a5f3a');
    
    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;

    // Create ground
    this.add.rectangle(screenWidth / 2, screenHeight / 2, screenWidth, screenHeight, 0x4a7a4a, 0.5);

    // Get champion
    const champion = this.registry.get('selectedChampion') || 
                     window.selectedChampion || 
                     { id: 'demo', nameGa: 'Demo', row: 0, col: 0 };

    // Create player in LOWER third of screen
    const playerX = screenWidth / 2;
    const playerY = screenHeight * 0.6;
    this.player = new Player(this, playerX, playerY, champion);
    
    // Disable player movement for tutorial
    this.player.canMove = false;

    // Initialize bow mechanics
    this.bowMechanics = new BowMechanics(this, this.player);

    // Create single target near top
    this.createTarget();

    // Add instructions
    this.addInstructions();

    // Track hits
    this.hitCount = 0;
    this.missCount = 0;
    this.scoreText = this.add.text(20, 20, 'Hits: 0 | Misses: 0', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setDepth(1000);

    console.log('BowTutorial: ready');
  }

  createTarget() {
    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;
    
    // Single target near top of screen
    const targetX = screenWidth / 2;
    const targetY = screenHeight * 0.2; // 20% from top

    this.target = this.add.circle(targetX, targetY, 30, 0xff0000, 0.7);
    this.target.setStrokeStyle(4, 0xffffff);
    this.target.setData('hit', false);
    
    // Add bullseye rings
    this.add.circle(targetX, targetY, 20, 0xff6600, 0.8);
    this.add.circle(targetX, targetY, 10, 0xffff00, 0.9);
  }

  addInstructions() {
    const instructions = [
      'Touch your hero',
      'Drag DOWN to aim UP',
      'Match power to distance!'
    ];

    const text = this.add.text(
      this.scale.width / 2,
      this.scale.height - 80,
      instructions.join('\n'),
      {
        fontSize: '20px',
        fontFamily: 'Arial',
        color: '#ffff00',
        backgroundColor: '#000000',
        padding: { x: 15, y: 10 },
        align: 'center',
        lineSpacing: 8
      }
    ).setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(1000);
  }

  update(time, delta) {
    // Update bow mechanics (arrow physics)
    this.bowMechanics.update(delta);

    // Check for arrow hit on target
    if (!this.target.getData('hit')) {
      const hit = this.bowMechanics.checkHit(this.target, 35);
      if (hit) {
        this.onTargetHit(hit);
      }
    }

    // Check for missed arrows (arrows that landed but didn't hit)
    this.bowMechanics.arrows.forEach(arrow => {


if (!arrow.getData('active') && !arrow.getData('counted')) {
	  arrow.setData('counted', true);

	  const landX = arrow.getData('x');
	  const landY = arrow.getData('y');

	  const distance = Phaser.Math.Distance.Between(
		      landX, landY,
		      this.target.x, this.target.y
		    );

	  if (distance > 35) {
		      this.missCount++;
		      this.updateScore();
		    }
}
    });
  }

  onTargetHit(hitData) {
    this.target.setData('hit', true);
    this.hitCount++;
    
    // Visual feedback
    this.target.setFillStyle(0x00ff00, 0.9);
    
    // Particle effect
    const particles = this.add.particles(this.target.x, this.target.y, 'championSheet', {
      speed: { min: 80, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 600,
      quantity: 15,
      tint: 0x00ff00
    });
    
    this.time.delayedCall(600, () => particles.destroy());
    
    // Update score
    this.updateScore();
    
    // Reset target after delay
    this.time.delayedCall(2000, () => {
      this.target.setFillStyle(0xff0000, 0.7);
      this.target.setData('hit', false);
    });

    console.log(`TARGET HIT! Force: ${hitData.force.toFixed(2)}, Distance: ${hitData.distance.toFixed(0)}`);
  }

  updateScore() {
    this.scoreText.setText(`Hits: ${this.hitCount} | Misses: ${this.missCount}`);
    
    // Calculate accuracy
    const total = this.hitCount + this.missCount;
    if (total > 0) {
      const accuracy = Math.round((this.hitCount / total) * 100);
      this.scoreText.setText(`Hits: ${this.hitCount} | Misses: ${this.missCount} | Accuracy: ${accuracy}%`);
    }
  }
}
