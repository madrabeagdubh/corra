import Phaser from 'phaser';
export default class InventoryGrid {
  constructor(scene, {
    x = 0,
    y = 0,
    rows = 4,
    cols = 4,
    size = 200,
    onSlotSelected = null
  }) {
    this.scene = scene;
    this.rows = rows;
    this.cols = cols;
    this.size = size;
    this.onSlotSelected = onSlotSelected;

    this.container = scene.add.container(x, y)
      .setDepth(1902)
      .setScrollFactor(0)  // ← ADD THIS LINE
      .setVisible(false);

    this.squares = [];

    const squareSize = size / cols;
    const startX = -size / 2 + squareSize / 2;
    const startY = -size / 2 + squareSize / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        const isEquipSlot = row === 0;

        const color = isEquipSlot ? 0xff5555 : 0xffff00;

        const square = scene.add.rectangle(
          startX + col * squareSize,
          startY + row * squareSize,
          squareSize - 4,
          squareSize - 4,
          color
        )
          .setStrokeStyle(2, 0x000000)
          .setInteractive({ useHandCursor: true });

        square.slotIndex = index;
        square.row = row;
        square.col = col;
        square.isEquipSlot = isEquipSlot;

        square.on('pointerup', () => {
          this.highlightSquare(square);

          if (this.onSlotSelected) {
            this.onSlotSelected({
              index: square.slotIndex,
              row: square.row,
              col: square.col,
              isEquipSlot: square.isEquipSlot
            });
          }
        });

        this.container.add(square);
        this.squares.push(square);
      }
    }
  }

  highlightSquare(activeSquare) {
    this.squares.forEach(square => {
      square.setStrokeStyle(2, 0x000000);
    });

    activeSquare.setStrokeStyle(3, 0xffffff);
  }

  show() {
    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }

  destroy() {
    this.container.destroy(true);
  }
}
