// EncounterDeck — draws a random subset of cards from a pool.
// Cards carry their own visual definition (gid, flat).
// Placement is handled by the scene's _loadContent() injection.

export class EncounterDeck {
  constructor(cards) {
    this._pool = [...cards]
  }

  // Returns n shuffled cards from the pool.
  draw(n = 2) {
    const shuffled = [...this._pool].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, n)
  }
}
  
