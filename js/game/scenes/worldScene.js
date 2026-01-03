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
    console.log('WorldScene - game config:', this.game.config);
    console.log('WorldScene - selectedChampion:', this.game.config.selectedChampion);

    // Launch the tutorial scene
    // To switch back to bog, uncomment next line and comment out the BowTutorial line
    // this.scene.start("BogMeadow");
   this.scene.start("BowTutorial");

    window.hideLoader();
  }

  update() {
    // No update needed when just launching other scenes
  }
}


