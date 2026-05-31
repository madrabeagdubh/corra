import BogLocationScene from '../bogScene.js'

export default class DruidTemple extends BogLocationScene {
  constructor() { super({ key: 'Druid_Temple' }) }
    getMapKey()     { return 'druid_temple' }
      getAmbient()    { return 0x1a2211 }
        getPlayerLight(){ return { color: 0xffeeaa, intensity: 1.8, radius: 240 } }
	  getWisps()      { return [
	      { rx: 0.5,  ry: 0.42, color: 0x44ff88, intensity: 0.9, radius: 200 },
	          { rx: 0.2,  ry: 0.3,  color: 0x22aa44, intensity: 0.4, radius: 120 },
		      { rx: 0.8,  ry: 0.3,  color: 0x22aa44, intensity: 0.4, radius: 120 },
		          { rx: 0.2,  ry: 0.65, color: 0x22aa44, intensity: 0.35, radius: 110 },
			      { rx: 0.8,  ry: 0.65, color: 0x22aa44, intensity: 0.35, radius: 110 },
			        ]}
				  getMusicTrack()  { return 'drowsy_maggie' }
				    getExtraUnwalkableGIDs() { return new Set([103]) }
				    }

