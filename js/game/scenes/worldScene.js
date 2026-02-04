import Phaser from "phaser"

import Joystick from "../input/joystick.js"
import Player from "../player/player.js"
import BogScene from "./locations/bogMeadow.js"
import BowTutorial from "./locations/bowTutorial.js"

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: "WorldScene" })
  }




create() {
  console.log('[WorldScene] create() called');
  console.log('[WorldScene] game config:', this.game.config);

  const champion = this.registry.get('selectedChampion');
  console.log('[WorldScene] selectedChampion:', champion);

  if (!champion) {
    console.warn('[WorldScene] No champion found — WorldScene should be idle');
  }

  window.hideLoader();
}



  update() {
    // No update needed when just launching other scenes
  }
}


