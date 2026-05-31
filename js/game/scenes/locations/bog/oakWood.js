import BogLocationScene from '../bogScene.js'

export default class OakWood extends BogLocationScene {
  constructor() { super({ key: 'Oak_Wood' }) }
    getMapKey()     { return 'oak_wood' }
      getAmbient()    { return 0x445533 }
        getPlayerLight(){ return { color: 0xffffcc, intensity: 1.5, radius: 300 } }
	  getWisps()      { return [
	      { rx: 0.25, ry: 0.3,  color: 0x88ff88, intensity: 0.3, radius: 130 },
	          { rx: 0.75, ry: 0.6,  color: 0x88ff88, intensity: 0.3, radius: 130 },
		      { rx: 0.5,  ry: 0.85, color: 0x66dd66, intensity: 0.25, radius: 110 },
		        ]}
			  getMusicTrack()  { return 'the_kesh' }
			    getExtraUnwalkableGIDs() { return new Set([206, 211]) }
			    }

