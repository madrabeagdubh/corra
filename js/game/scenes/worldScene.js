import Phaser from "phaser"
import Joystick from "../input/joystick.js"
import Player from "../player/player.js"
import BogScene from "./locations/bogMeadow.js"

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: "WorldScene" })
  }

  create() {


console.log('WorldScene - game config:', this.game.config);
  console.log('WorldScene - selectedChampion:', this.game.config.selectedChampion);
  

    this.scene.add("BogMeadow", BogScene, false)

    this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x44ff44
    )


    this.joystick = new Joystick(this, {
      x: 100,
      y: this.scale.height - 100,
      radius: 60
    })

    console.log("WorldScene created")
    this.scene.start("BogMeadow")

	window.hideLoader();

  }

  update() {
    this.player.update(this.joystick)
  }
} 
