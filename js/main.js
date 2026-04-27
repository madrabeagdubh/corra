import Phaser from 'phaser'
import './heroSelect.js'
import BowTutorial from './game/scenes/locations/bowTutorial.js'
import WorldScene from './game/scenes/worldScene.js'
import BogMeadow from './game/scenes/locations/bog/bogMeadow.js'
import { initFullscreenButton } from './game/ui/fullscreenButton.js'
// Bog world scenes
import GreatOpenBog        from './game/scenes/locations/bog/greatOpenBog.js'
import AbandonedSettlement from './game/scenes/locations/bog/abandonedSettlement.js'
import FortressOfBlood     from './game/scenes/locations/bog/fortressOfBlood.js'
import FairyMargin         from './game/scenes/locations/bog/fairyMargin.js'
import CursedWood          from './game/scenes/locations/bog/cursedWood.js'
import LakeOfShadows       from './game/scenes/locations/bog/lakeOfShadows.js'
import HeartOfTheBog       from './game/scenes/locations/bog/heartOfTheBog.js'
import TreeMaze            from './game/scenes/locations/bog/treeMaze.js'
import BogThreshold        from './game/scenes/locations/bog/bogThreshold.js'
import OakWood             from './game/scenes/locations/bog/oakWood.js'
import DruidTemple         from './game/scenes/locations/bog/druidTemple.js'
import { champions } from '../data/champions.js' // adjust path as needed






export function startGame(selectedChampion, options = {}) {
    if (window.game) {
        window.game.destroy(true)
        window.game = null
        // Wait for Phaser to fully clean up before creating new instance
        setTimeout(() => _createGame(selectedChampion, options), 100)
        return
    }
    _createGame(selectedChampion, options)
}

function _createGame(selectedChampion, options) {
  // URL override: ?scene=Bog_Threshold
  const urlParams = new URLSearchParams(window.location.search)
  const sceneOverride = urlParams.get('scene')
  if (sceneOverride) options.startScene = sceneOverride

  if (sceneOverride && !selectedChampion) {
    selectedChampion = window.devChampion || { id: 'dev', nameGa: 'Dev' }
  } 
    // Hide starfield loader
    const starfieldLoader = document.getElementById('starfieldLoader')
    if (starfieldLoader) starfieldLoader.style.display = 'none'
    // Make sure gameContainer is visible and sized before Phaser boots
    const gameContainer = document.getElementById('gameContainer')
    if (gameContainer) {
        gameContainer.style.display = 'block'
        gameContainer.style.width   = window.innerWidth + 'px'
        gameContainer.style.height  = window.innerHeight + 'px'
	    gameContainer.style.background = 'transparent'  //


	    gameContainer.style.background = 'transparent'  // dark grey-blue — visible as sky above horizon
    gameContainer.style.position   = 'relative'      // ← needed for absolute children

    }

    window.selectedChampion = selectedChampion

    // Build config fresh so width/height are current, not stale from module load
    const config = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
	    transparent:true,
//        backgroundColor: '#222222',
        parent: 'gameContainer',
        scene: [
            WorldScene,
            BogMeadow,
            BowTutorial,
            // Bog world
            GreatOpenBog,
            AbandonedSettlement,
            FortressOfBlood,
            FairyMargin,
            CursedWood,
            LakeOfShadows,
            HeartOfTheBog,
            TreeMaze,
            BogThreshold,
            OakWood,
            DruidTemple,
        ],
        autoStart: false,
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        render: { pixelArt: true },
        physics: { default: 'arcade' },
        input: { touch: { capture: true } }
    }

    config.selectedChampion = selectedChampion
    window.game = new Phaser.Game(config)

initFullscreenButton();
    window.game.registry.set('selectedChampion', selectedChampion)

    const sceneToStart = options.startScene || 'BowTutorial'
    console.log('[main.js] Starting scene:', sceneToStart)
    window.startGame = startGame
if (sceneToStart !== 'BowTutorial') {
  // Direct scene load -- skip WorldScene
  window.game.scene.start(sceneToStart, { champion: selectedChampion })
} else {
  window.game.scene.start('WorldScene', { champion: selectedChampion })
}
    console.log('Game created, champion stored in registry')
}

window.startGame = startGame

function resizeGame() {
    const container = document.getElementById('gameContainer')
    if (container) {
        container.style.width  = window.innerWidth + 'px'
        container.style.height = window.innerHeight + 'px'
    }
    if (window.game && window.game.scale) {
        window.game.scale.resize(window.innerWidth, window.innerHeight)
    }
}

window.addEventListener('load', resizeGame)
window.addEventListener('resize', resizeGame)
window.addEventListener('orientationchange', resizeGame)
window.addEventListener('load', () => console.log('Game started'))
// Dev shortcut: ?scene=Bog_Threshold boots directly, bypassing hero select
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search)
  const sceneOverride = urlParams.get('scene')
  if (sceneOverride) {
    const devChampion = champions[0]
    const champId = devChampion.id || devChampion.nameGa || 'dev'
    localStorage.setItem(`${sceneOverride}_intro_${champId}`, 'true')
    startGame(devChampion, { startScene: sceneOverride })
    setTimeout(() => {
      window.game?.scene.stop('WorldScene')
      window.stopStarfield?.()
      const toHide = ['starfieldLoader', 'heroSelect']
      toHide.forEach(id => {
        const el = document.getElementById(id)
        if (el) el.style.display = 'none'
      })
    }, 200)
  }
})
