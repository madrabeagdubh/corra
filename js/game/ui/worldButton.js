import Phaser from 'phaser';

export default class WorldButton {
  constructor(scene, { x, y, size = 56, onClick }) {
    this.scene = scene;

    // Background square
    this.bg = scene.add.rectangle(x, y, size, size, 0x666666);
    this.bg.setPipeline('TextureTintPipeline')
    this.bg.setScrollFactor(0);
    this.bg.setDepth(4000);
    this.bg.setStrokeStyle(2, 0x999999);
    this.bg.setInteractive({ useHandCursor: true });
    // Click handler with debounce
    this.lastClick = 0;

    this.bg.on('pointerup', (pointer) => {
      const now = this.scene.time.now;
      if (now - this.lastClick < 300) return;

      this.lastClick = now;

      pointer.event?.stopPropagation?.();

      if (onClick) {
        onClick();
      }
    });
  }

  destroy() {
    this.bg.destroy();
  }
}
