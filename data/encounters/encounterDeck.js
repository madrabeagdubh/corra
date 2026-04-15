export class EncounterDeck {
  constructor(cards) {
    this._pool = [...cards]
  }

  draw(n = 2) {
    const shuffled = Phaser.Utils.Array.Shuffle([...this._pool])
    return shuffled.slice(0, n)
  }
} 
