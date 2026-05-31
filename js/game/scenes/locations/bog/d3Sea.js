import RiverScene from '../riverScene.js'

export default class BogD3Sea extends RiverScene {

  constructor() { super({ key: 'd3_sea' }) }

  getMapKey()              { return 'd3_sea' }
  getAmbient()             { return 0x223344 }
  getPlayerLight()         { return { color: 0xcce8ff, intensity: 1.8, radius: 320 } }
  getWisps()               { return [] }
  getMusicTrack()          { return null }
  getExtraUnwalkableGIDs() { return new Set([740, 1832]) }
  getSkyImage()            { return '/assets/skies/bog_threshold_sky.png' }
  getSkyPosition()         { return '50% 60%' }
  getMountainImage()       { return null }
  getMountainPosition()    { return '50% 100%' }

  getElevationConfig() {
    return {
      cliffGids:    new Set([740]),
      cliffFaceGid: 740,
      elevatedGids: new Set([839, 840]),
      cliffSouth:   new Set([731, 1625, 1679]),
      cliffHeight:  1.0,
    }
  }

  preload() {
    super.preload()
    this.load.image('boat', '/assets/boat.png')
  }

  onEnter() {
    this.time.delayedCall(50, () => {
      if (!this.boatSystem || !this.perspectiveGround) {
        console.warn('[d3Sea] onEnter: boatSystem or perspectiveGround missing')
        return
      }

      // Load boat sprite into PGR
      if (this.textures.exists('boat')) {
        this.perspectiveGround.loadBoatImage(
          this.textures.get('boat').getSourceImage()
        )
      }

      // No eastward current in the open estuary — player steers freely
      this.boatSystem._noDrift = true

      // Stop swallows — seabirds replace them on this map
      if (this._swallows) { this._swallows.stop(); this._swallows = null }

      // Always activate boat — player always arrives by boat on this map
      this.boatSystem.activate()

      // Brief narrative — first time only
      const champion = this.registry.get('selectedChampion')
      const seenKey  = `d3_sea_estuary_${champion?.id}`
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

