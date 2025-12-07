// js/game/objects/rock.js
import BaseObject from './baseObject.js';

export default class Rock extends BaseObject {
  constructor(scene, x, y, width = 64, height = 64) {
    super(scene, x, y, width, height);
    // Use a simple grey rectangle for now
    this.graphics.fillStyle(0x888888, 1);
    this.graphics.fillRect(0, 0, width, height);

    // Enable physics so player can't walk through
    scene.physics.add.existing(this);
    this.body.setImmovable(true);
  }
}
