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




/*

1 import Phaser from "phaser"
  2 import Joystick from "../input/joystick.js"
  3 import Player from "../player/player.js"
  4 import BogScene from "./locations/bogMeadow.js"                                5 import BowTutorial from "./locations/bowTutorial.js"                           6                                                                                7 export default class WorldScene extends Phaser.Scene {                         8   constructor() {                                                              9     super({ key: "WorldScene" })
 10   }                                                                           11                                                                               12   create() {                                                                  13                                                                               14                                                                               15 console.log('WorldScene - game config:', this.game.config);                   16   console.log('WorldScene - selectedChampion:', this.game.config.selectedCham    pion);
 17                                                                               18
 19     this.scene.add("BogMeadow", BogScene, false)
 20     this.scene.add("BowTutorial", BowTutorial, false)
 21
 22     this.add.rectangle(
 23       this.scale.width / 2,
 24       this.scale.height / 2,
 25       this.scale.width,
 26       this.scale.height,
 27       0x44ff44
 28     )
 29
 30
 31     this.joystick = new Joystick(this, {
 32       x: 100,
 33       y: this.scale.height - 100,
 34       radius: 60
 35     })
 36
 37     console.log("WorldScene created")
 38     //this.scene.start("BogMeadow")
 39     this.scene.start("BowTutorial")
 40
 41         window.hideLoader();
 42
 43   }
 44
 45   update() {
 46     this.player.update(this.joystick)
 47   }
 48 }
~


*/ 
