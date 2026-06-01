import RiverScene from '../riverScene.js'
import { createVoice, VOICES } from '../../../systems/voice/voiceSynth.js'

const SEANBEAN_DIALOGUES = [
  { ga: 'Chonaic me longa ag dul thar braid ar feadh cead bliain.', en: 'I have watched ships pass for a hundred years.', speaker: 'Seanbhean na Mara' },
  { ga: 'An bhfuil tu ag dul? No ag teacht?', en: 'Are you going? Or coming?', speaker: 'Seanbhean na Mara' },
  { ga: 'Ta an fharraige fuar. Ta si foighneach freisin.', en: 'The sea is cold. She is patient too.', speaker: 'Seanbhean na Mara' },
  { ga: 'Fan go foill. Eist leis an tonn.', en: 'Wait a while. Listen to the wave.', speaker: 'Seanbhean na Mara' },
]

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

  async create(data) {
    await super.create(data)
    this._seanBeanVoice = null
    this._spawnSeanBean()
  }

  onEnter() {
    this.time.delayedCall(50, () => {
      if (!this.boatSystem || !this.perspectiveGround) {
        console.warn('[d3Sea] onEnter: boatSystem or perspectiveGround missing')
        return
      }
      if (this.textures.exists('boat')) {
        this.perspectiveGround.loadBoatImage(this.textures.get('boat').getSourceImage())
      }
      this.boatSystem._noDrift = true
      if (this._swallows) { this._swallows.stop(); this._swallows = null }
      this.boatSystem.activate()

      const champion = this.registry.get('selectedChampion')
      const seenKey  = `d3_sea_estuary_${champion?.id}`
      if (!localStorage.getItem(seenKey)) {
        localStorage.setItem(seenKey, 'true')
        this.time.delayedCall(800, () => {
          this.textPanel?.show({
            ga: 'An fharraige. Ag breathnu siar ar Albain den uair dheireanach.',
            en: 'The sea. Looking back at Scotland for the last time.',
            type: 'notification',
          })
        })
      }
    })
  }

  _spawnSeanBean() {
    const ts = this.tileDisplaySize ?? 48
    // tile (5,13) — open water, same row as player spawn (2,13), reachable by boat
    const lx = 5 * ts + ts * 0.5
    const ly = 13 * ts + ts * 0.5

    const proxy = {
      x: lx,
      y: ly,
      _data: new Map([
        ['id',            'seanbean_na_mara'],
        ['name',          'Seanbhean na Mara'],
        ['dialogues',     SEANBEAN_DIALOGUES],
        ['dialogueIndex', 0],
      ]),
      getData(k)       { return this._data.get(k) },
      setData(k, v)    { this._data.set(k, v) },
      setInteractive() { return this },
      setVisible()     { return this },
      destroy()        {},
      active: true,
    }

    if (this.npcs) this.npcs.push(proxy)
    this._seanBeanProxy = proxy
    this._installVoiceOnScene()
    console.log('[d3Sea] Seanbhean proxy at tile (5,13)')
  }

  _installVoiceOnScene() {
    const original = this.talkToNPC?.bind(this)
    if (!original) return
    this.talkToNPC = (npc) => {
      if (npc.getData('id') !== 'seanbean_na_mara') return original(npc)
      this._speakSeanBean(npc)
    }
  }

  _speakSeanBean(npc) {
    if (!this._seanBeanVoice) {
      this._seanBeanVoice = createVoice(VOICES.seanBhean)
    }
    const voice     = this._seanBeanVoice
    const dialogues = npc.getData('dialogues')
    const index     = npc.getData('dialogueIndex') || 0
    const dialogue  = dialogues[index]

    if (this.joystick) this.joystick.reset()
    if (this.player)   this.player.isMoving = false

    voice.speak(dialogue.ga || '', { mode: 'speech' })

    this.textPanel?.show({
      ga:      dialogue.ga || '',
      en:      dialogue.en || '',
      type:    'dialogue',
      speaker: dialogue.speaker || npc.getData('name'),
      onDismiss: () => {
        voice.stop()
        const next = (index + 1) % dialogues.length
        npc.setData('dialogueIndex', next)
      },
    })
  }

  shutdown() {
    if (this._seanBeanVoice) {
      try { this._seanBeanVoice.destroy() } catch(e) {}
      this._seanBeanVoice = null
    }
    super.shutdown?.()
  }
}

