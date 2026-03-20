import BogLocationScene from './bogLocationScene.js'

export default class BogThreshold extends BogLocationScene {
  constructor() { super({ key: 'Bog_Threshold' }) }
    getMapKey()     { return 'bog_threshold' }
      getAmbient()    { return 0x2a2a15 }
        getPlayerLight(){ return { color: 0xfff0cc, intensity: 1.9, radius: 270 } }
	  getWisps()      { return [
	      { rx: 0.48, ry: 0.47, color: 0xcc4400, intensity: 0.5, radius: 120 },
	        ]}
		  getMusicTrack()  { return 'banish_misfortune' }
		  }

