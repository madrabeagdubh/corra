export default class HPDisplay {
  constructor(scene, { x = 20, y = 20 }) {
    this.scene = scene;
    this.hideTimer = null;

    this.container = scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(2000);
    this.container.setAlpha(0); // Start invisible

    // Heart Emoji Text
    this.heart = scene.add.text(0, 0, '❤️', { fontSize: '24px' });
    this.heart.setOrigin(0.5);

    // HP Number Text
    this.hpText = scene.add.text(25, 0, '100', {
      fontSize: '20px',
      fontFamily: 'Arial',
      fontWeight: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.hpText.setOrigin(0, 0.5);

    this.container.add([this.heart, this.hpText]);

    // Setup Heart Pulse Animation (infinite loop)
    scene.tweens.add({
      targets: this.heart,
      scale: 1.2,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Back.easeOut'
    });

    scene.events.on('playerHPChanged', this.updateDisplay, this);
  }

  updateDisplay(currentHP, maxHP) {
    // 1. Update the number
    this.hpText.setText(currentHP);

    // 2. Change color if health is low
    if (currentHP < maxHP * 0.3) {
      this.hpText.setColor('#ff0000'); // Red if below 30%
    } else {
      this.hpText.setColor('#ffffff');
    }

    // 3. Show the UI and reset the hide timer
    this.showTemporarily();
  }

  showTemporarily() {
    // Cancel existing timer if player gets hit again quickly
    if (this.hideTimer) this.hideTimer.remove();

    // Fade in
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      overwrite: true
    });

    // Set timer to hide after 3 seconds
    this.hideTimer = this.scene.time.delayedCall(3000, () => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 500
      });
    });
  }

  destroy() {
    if (this.hideTimer) this.hideTimer.remove();
    this.scene.events.off('playerHPChanged', this.updateDisplay, this);
    this.container.destroy();
  }
}

