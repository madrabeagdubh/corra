import Phaser from 'phaser'
import './heroSelect.js'
import BowTutorial from './game/scenes/locations/bowTutorial.js'
import WorldScene from './game/scenes/worldScene.js'
import BogMeadow from './game/scenes/locations/bog/bogMeadow.js'

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

export function startGame(selectedChampion, options = {}) {
    console.log('startGame called with:', selectedChampion, 'options:', options)

    // Destroy existing game instance before creating a new one
    if (window.game) {
        window.game.destroy(true)
        window.game = null
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
    }

    window.selectedChampion = selectedChampion

    // Build config fresh so width/height are current, not stale from module load
    const config = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: '#222222',
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
    window.game.registry.set('selectedChampion', selectedChampion)

    const sceneToStart = options.startScene || 'BowTutorial'
    console.log('[main.js] Starting scene:', sceneToStart)
    window.startGame = startGame
    window.game.scene.start(sceneToStart, { champion: selectedChampion })

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

