// js/game/objects/droppedItem.js
import baseObject from './baseObject.js';

export default class DroppedItem extends BaseObject {
  constructor(scene, x, y, item) {
    // Create a smaller rectangle for the item (16x16 or 24x24)
    const size = 24;
    super(scene, x, y, size, size, item.color || 0xFFFFFF);
    
    this.item = item;
    this.tileSize = 32; // Match your player's tileSize
    
    // Snap to grid
    this.sprite.x = Math.round(x / this.tileSize) * this.tileSize;
    this.sprite.y = Math.round(y / this.tileSize) * this.tileSize;
    
    // Set depth so it appears below player but above ground
    this.sprite.setDepth(50);
    
    // Add a slight visual indicator (optional - you can add a sprite later)
    this.createVisual();
    
    // Enable interaction
    this.sprite.setInteractive({ useHandCursor: true });
    
    // Pickup on click/touch (optional)
    this.sprite.on('pointerup', () => {
      this.onPickup();
    });
  }

  createVisual() {
    // Add a small pulsing effect or glow to make items noticeable
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.7,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  onPickup() {
    // This will be called when player walks over or clicks the item
    // The scene should handle adding it to player inventory
    this.scene.events.emit('pickupItem', this);
  }

  // Called when player collides with item
  onCollide(player) {
    // Try to add to player's inventory
    const addedIndex = player.inventory.addItem(this.item);
    
    if (addedIndex !== false) {
      console.log(`Picked up: ${this.item.nameEn}`);
      this.destroy();
    } else {
      console.log('Inventory full!');
      // Could show a message to player
    }
  }

  destroy() {
    // Clean up tweens
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
  }
}
