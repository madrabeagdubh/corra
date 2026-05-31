import BogLocationScene from './bogLocationScene.js'
import { GameState } from '../../../systems/gameState.js'

export default class BogD3Sea extends BogLocationScene {

  constructor() { super({ key: 'd3_sea' }) }

  getMapKey()           { return 'd3_sea' }
  getAmbient()          { return 0x223344 }
  getPlayerLight()      { return { color: 0xcce8ff, intensity: 1.8, radius: 320 } }
  getWisps()            { return [] }
  getMusicTrack()       { return null }
  getExtraUnwalkableGIDs() { return new Set([740, 1832]) }
  getSkyImage()         { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition()      { return '50% 60%' }
  getMountainImage()    { return null }
  getMountainPosition() { return '50% 100%' }

  onEnter() {
    const edge = this.entryData?.entryEdge

    this.time.delayedCall(50, () => {
      if (!this.boatSystem || !this.perspectiveGround) return
      if (this.textures.exists('boat')) {
        this.perspectiveGround.loadBoatImage(
          this.textures.get('boat').getSourceImage()
        )
      }

      // No current drift in the estuary -- open sea, player controls
      if (this.boatSystem) this.boatSystem._noDrift = true

      // Stop swallows -- seabirds will replace them later
      if (this._swallows) { this._swallows.stop(); this._swallows = null }

      // Player always arrives by boat from the west
      if (!edge || edge === 'west') {
        this.boatSystem.activate()
      }

      // Brief narrative -- first time only
      const seenKey = `d3_sea_estuary_${this.registry.get('selectedChampion')?.id}`
      if (!localStorage.getItem(seenKey)) {
        localStorage.setItem(seenKey, 'true')
        this.time.delayedCall(800, () => {
          this.textPanel?.show({
            ga: 'An fharraige. Ag breathnú siar ar Albain den uair dheireanach.',
            en: 'The sea. Looking back at Scotland for the last time.',
            type: 'notification'
          })
        })
      }
    })
  }
}

