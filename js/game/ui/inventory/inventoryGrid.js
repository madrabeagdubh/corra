// js/game/ui/inventory/inventoryGrid.js
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
    this.gridX = x;
    this.gridY = y;

    this.squares = [];
    this.itemSprites = [];

    const squareSize = size / cols;
    const startX = x - size / 2 + squareSize / 2;
    const startY = y - size / 2 + squareSize / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        const isEquipSlot = row === 0;

        const squareX = startX + col * squareSize;
        const squareY = startY + row * squareSize;

        let square;
        const slotTexture = isEquipSlot ? 'slot_equipped' : 'slot_inventory';
        
        if (scene.textures.exists(slotTexture)) {
          square = scene.add.sprite(squareX, squareY, slotTexture);
          square.setDisplaySize(squareSize - 4, squareSize - 4);
        } else {
          const color = isEquipSlot ? 0x555555 : 0x777777;
          square = scene.add.rectangle(squareX, squareY, squareSize - 4, squareSize - 4, color);
          square.setStrokeStyle(2, 0x000000);
        }

        square.setDepth(1902);
        square.setScrollFactor(0);
        square.setVisible(false);

        // Use default hit area - Phaser will automatically create it based on the bounds
        square.setInteractive();
        
        // Debug: log when hit area is created
        console.log('Square', index, 'at', squareX, squareY, 'hit area:', square.input.hitArea);

        square.slotIndex = index;
        square.row = row;
        square.col = col;
        square.isEquipSlot = isEquipSlot;
        square.squareSize = squareSize;

        square.on('pointerdown', () => {
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

        this.squares.push(square);
        this.itemSprites.push(null);
      }
    }

    this.lastSelected = null;
  }

  highlightSquare(activeSquare) {
    this.squares.forEach(square => {
      if (square.type === 'Rectangle') {
        square.setStrokeStyle(2, 0x000000);
      } else {
        square.setTint(0xffffff);
      }
    });

    if (activeSquare.type === 'Rectangle') {
      activeSquare.setStrokeStyle(3, 0xffffff);
    } else {
      activeSquare.setTint(0xffff99);
    }
    
    this.lastSelected = activeSquare;
  }

  updateSlot(index, item) {
    if (index < 0 || index >= this.squares.length) {
      return;
    }

    const square = this.squares[index];
    
    if (this.itemSprites[index]) {
      this.itemSprites[index].destroy();
      this.itemSprites[index] = null;
    }

    if (item) {
      console.log('UpdateSlot', index, '- Item:', item.nameEn, 'Color:', item.color);
      
      const textureKey = 'item_' + item.id;
      
      if (this.scene.textures.exists(textureKey)) {
        console.log('Using texture:', textureKey);
        const itemSprite = this.scene.add.sprite(square.x, square.y, textureKey);
        itemSprite.setDisplaySize(square.squareSize * 0.7, square.squareSize * 0.7);
        itemSprite.setDepth(1903);
        itemSprite.setScrollFactor(0);
        itemSprite.setVisible(square.visible);
        // CRITICAL: Disable input completely
        itemSprite.disableInteractive();
        itemSprite.input = null;

        this.itemSprites[index] = itemSprite;
      } else {
        console.log('Using colored rectangle for:', item.nameEn);
        const itemRect = this.scene.add.rectangle(
          square.x, 
          square.y, 
          square.squareSize * 0.6, 
          square.squareSize * 0.6,
          item.color
        );
        itemRect.setDepth(1903);
        itemRect.setScrollFactor(0);
        itemRect.setVisible(square.visible);
        // Make sure rectangles also don't capture input
        itemRect.input = null;

        this.itemSprites[index] = itemRect;
      }
    }
  }

  show() {
    this.squares.forEach((square, index) => {
      square.setVisible(true);
      if (this.itemSprites[index]) {
        this.itemSprites[index].setVisible(true);
      }
    });
  }

  hide() {
    this.squares.forEach((square, index) => {
      square.setVisible(false);
      if (this.itemSprites[index]) {
        this.itemSprites[index].setVisible(false);
      }
    });
  }

  destroy() {
    this.squares.forEach(square => {
      square.destroy();
    });
    this.itemSprites.forEach(sprite => {
      if (sprite) {
        sprite.destroy();
      }
    });
    this.squares = [];
    this.itemSprites = [];
  }
}
