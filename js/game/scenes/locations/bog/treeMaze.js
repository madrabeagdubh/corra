import BogLocationScene from '../bogScene.js'

export default class TreeMaze extends BogLocationScene {
  constructor() { super({ key: 'Tree_Maze' }) }
    getMapKey()     { return 'tree_maze' }
      getAmbient()    { return 0x1a1a0a }
        getPlayerLight(){ return { color: 0xffdd88, intensity: 2.0, radius: 180 } }
	  getWisps()      { return [
	      { rx: 0.18, ry: 0.12, color: 0x44ff44, intensity: 0.3, radius: 100 },
	          { rx: 0.82, ry: 0.12, color: 0x44ff44, intensity: 0.3, radius: 100 },
		      { rx: 0.5,  ry: 0.45, color: 0xffff44, intensity: 0.25, radius: 90 },
		          { rx: 0.25, ry: 0.72, color: 0x44ff44, intensity: 0.2, radius: 80 },
			      { rx: 0.75, ry: 0.72, color: 0x44ff44, intensity: 0.2, radius: 80 },
			        ]}
				  getMusicTrack()  { return 'silver_spear' }
				    getExtraUnwalkableGIDs() { return new Set([206, 208, 209, 211]) }
				    }

