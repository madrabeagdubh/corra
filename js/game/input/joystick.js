export default class Joystick {
  constructor(scene, config) {
    this.scene = scene;
    this.radius = config.radius || 60;
    this.baseX = config.x;
    this.baseY = config.y;

    this.force = 0;
    this.angle = 0;

    // Base circle (outer ring) - dark with border
    this.base = scene.add.circle(this.baseX, this.baseY, this.radius, 0x2a2a2a, 0.6);
    this.base.setStrokeStyle(3, 0x555555, 0.8);
    this.base.setScrollFactor(0);
    this.base.setDepth(1000);

    // Create directional buttons (cross shape)
    const buttonSize = this.radius * 0.6;
    const buttonOffset = this.radius * 0.7;

    this.buttons = {
      up: this.createDirectionalButton(this.baseX, this.baseY - buttonOffset, buttonSize),
      down: this.createDirectionalButton(this.baseX, this.baseY + buttonOffset, buttonSize),
      left: this.createDirectionalButton(this.baseX - buttonOffset, this.baseY, buttonSize),
      right: this.createDirectionalButton(this.baseX + buttonOffset, this.baseY, buttonSize)
    };

    // Draggable thumb (inner circle) - lighter with border
    this.thumb = scene.add.circle(this.baseX, this.baseY, this.radius / 2.5, 0x4a4a4a, 0.8);
    this.thumb.setStrokeStyle(3, 0x888888, 0.9);
    this.thumb.setScrollFactor(0);
    this.thumb.setDepth(1002);

    // Make thumb interactive and draggable
    this.thumb.setInteractive();
    scene.input.setDraggable(this.thumb);

    // Visual feedback for thumb drag
    scene.input.on('dragstart', (pointer, gameObject) => {
      if (gameObject === this.thumb) {
        this.thumb.setFillStyle(0x6a6a6a, 0.9);
        this.thumb.setScale(1.1);
      }
    });

    // Handle drag for analog movement
    scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
      if (gameObject !== this.thumb) return;

      const screenX = pointer.x;
      const screenY = pointer.y;

      const dx = screenX - this.baseX;
      const dy = screenY - this.baseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.radius) {
        this.thumb.x = screenX;
        this.thumb.y = screenY;
        this.force = distance;
      } else {
        const angle = Math.atan2(dy, dx);
        this.thumb.x = this.baseX + Math.cos(angle) * this.radius;
        this.thumb.y = this.baseY + Math.sin(angle) * this.radius;
        this.force = this.radius;
      }

      this.angle = Math.atan2(this.thumb.y - this.baseY, this.thumb.x - this.baseX) * (180 / Math.PI);
    });

    scene.input.on('dragend', (pointer, gameObject) => {
      if (gameObject === this.thumb) {
        this.thumb.x = this.baseX;
        this.thumb.y = this.baseY;
        this.thumb.setFillStyle(0x4a4a4a, 0.8);
        this.thumb.setScale(1.0);
        this.force = 0;
        this.angle = 0;
      }
    });
  }

  createDirectionalButton(x, y, size) {
    // Button square - subtle, minimal style
    const button = this.scene.add.rectangle(x, y, size, size, 0x3a3a3a, 0.5);
    button.setStrokeStyle(2, 0x666666, 0.7);
    button.setScrollFactor(0);
    button.setDepth(1001);
    button.setInteractive();

    // Calculate direction based on position relative to center
    const dx = x - this.baseX;
    const dy = y - this.baseY;
    const direction = Math.atan2(dy, dx) * (180 / Math.PI);

    // Touch feedback
    button.on('pointerdown', () => {
      // Visual feedback - brighten and scale
      button.setFillStyle(0x6a6a6a, 0.9);
      button.setScale(1.15);
      
      // Trigger movement in this direction
      this.force = this.radius;
      this.angle = direction;
      
      // Reset after brief moment
      this.scene.time.delayedCall(100, () => {
        button.setFillStyle(0x3a3a3a, 0.5);
        button.setScale(1.0);
        this.force = 0;
        this.angle = 0;
      });
    });

    // Hover effect (for desktop testing)
    button.on('pointerover', () => {
      if (!this.scene.input.activePointer.isDown) {
        button.setFillStyle(0x4a4a4a, 0.7);
      }
    });

    button.on('pointerout', () => {
      if (!this.scene.input.activePointer.isDown) {
        button.setFillStyle(0x3a3a3a, 0.5);
      }
    });

    return button;
  }
}
