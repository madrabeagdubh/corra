#startButton {
rt default class BaseObject {
  constructor(scene, x, y, width, height, color = 0x888888) {
    this.scene = scene;
    this.sprite = scene.add.rectangle(x, y, width, height, color);
    scene.physics.add.existing(this.sprite, true); // static body
  }

  // optional collision callback
  onCollide(player) {}
}
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0066ff, #00ccff);
  color: white;
  font-size: 3rem;
  border: none;
  border-radius: 0;  /* remove rounded corners for fullscreen */
  z-index: 10000;
  cursor: pointer;
  user-select: none;
  display: flex;
  justify-content: center;
  align-items: center;
}


