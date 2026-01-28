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
    console.log('[WorldScene] selectedChampion:', this.game.config.selectedChampion);

    // DON'T automatically start any scene!
    // The scenes should be started explicitly from main.js via window.game.scene.start()
    
    // If for some reason WorldScene IS started, just do nothing
    console.log('[WorldScene] WorldScene should not be auto-starting scenes');
    
    window.hideLoader();
  }

  update() {
    // No update needed when just launching other scenes
  }
}


