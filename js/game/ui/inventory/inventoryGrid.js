import Phaser from 'phaser';

export default class InventoryGrid {
  constructor(scene, { x, y, size = 400, rows = 5, cols = 5 }) {
    this.scene = scene;
    this.rows = rows;
    this.cols = cols;
    this.size = size;

    this.container = scene.add.container(x, y).setDepth(1902);
    this.squares = [];

    const squareSize = size / cols;
    const startX = -size / 2 + squareSize / 2;
    const startY = -size / 2 + squareSize / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const color = row === 0 ? 0x555555 : 0xaaaaaa;
        const square = scene.add.rectangle(
          startX + col * squareSize,
          startY + row * squareSize,
          squareSize - 4,
          squareSize - 4,
          color
        ).setStrokeStyle(2, 0xffffff)
         .setInteractive({ useHandCursor: true });

        square.on('pointerup', () => {
          console.log(`Clicked row ${row}, col ${col}`);
        });

        this.container.add(square);
        this.squares.push(square);
      }
    }
  }

  show() {
    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }

  destroy() {
    this.container.destroy();
  }
}
