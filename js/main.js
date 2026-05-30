import Phaser from 'phaser'
import './heroSelect.js'
import BowTutorial from './game/scenes/locations/bowTutorial.js'
import WorldScene from './game/scenes/worldScene.js'
import BogMeadow from './game/scenes/locations/bog/bogMeadow.js'
// Bog world scenes
// // // import GreatOpenBog        from './game/scenes/locations/bog/greatOpenBog.js'
// // // import AbandonedSettlement from './game/scenes/locations/bog/abandonedSettlement.js'
// // // import FortressOfBlood     from './game/scenes/locations/bog/fortressOfBlood.js'
// // // import FairyMargin         from './game/scenes/locations/bog/fairyMargin.js'
// // // import CursedWood          from './game/scenes/locations/bog/cursedWood.js'
// // // import LakeOfShadows       from './game/scenes/locations/bog/lakeOfShadows.js'
// // // import HeartOfTheBog       from './game/scenes/locations/bog/heartOfTheBog.js'
// // // import TreeMaze            from './game/scenes/locations/bog/treeMaze.js'
import BogThreshold        from './game/scenes/locations/bog/bogThreshold.js'
// // // import OakWood             from './game/scenes/locations/bog/oakWood.js'
// // // import DruidTemple         from './game/scenes/locations/bog/druidTemple.js'
import BogA1 from './game/scenes/locations/bog/a1.js'
import BogA2 from './game/scenes/locations/bog/a2.js'
import BogA3 from './game/scenes/locations/bog/a3.js'
import BogA4 from './game/scenes/locations/bog/a4.js'
import BogB1 from './game/scenes/locations/bog/b1.js'
import BogB2 from './game/scenes/locations/bog/b2.js'
import BogB3 from './game/scenes/locations/bog/b3.js'
import BogB4 from './game/scenes/locations/bog/b4.js'
import BogC1 from './game/scenes/locations/bog/c1.js'
import BogC2 from './game/scenes/locations/bog/c2.js'
import BogC3 from './game/scenes/locations/bog/c3.js'
import BogC4 from './game/scenes/locations/bog/c4.js'
import BogD1 from './game/scenes/locations/bog/d1.js'
import BogD2 from './game/scenes/locations/bog/d2.js'
import BogD3 from './game/scenes/locations/bog/d3.js'
import BogD4 from './game/scenes/locations/bog/d4.js'
import BogD3Sea from './game/scenes/locations/bog/d3Sea.js'
import { champions } from '../data/champions.js'
import { initFullscreenButton } from './game/ui/fullscreenButton.js'
initFullscreenButton()  // call at module load time, not inside _createGame()
export function startGame(selectedChampion, options = {}) {
    if (window.game) {
        window.game.destroy(true)
        window.game = null
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
        gameContainer.style.display    = 'block'
        gameContainer.style.width      = window.innerWidth + 'px'
        gameContainer.style.height     = window.innerHeight + 'px'
        gameContainer.style.background = 'transparent'
        gameContainer.style.position   = 'relative'
    }

    window.selectedChampion = selectedChampion

    const config = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        transparent: true,
        parent: 'gameContainer',
        scene: [
            WorldScene,
            BogMeadow,
            BowTutorial,
            // Bog world
// // //             GreatOpenBog,
// // //             AbandonedSettlement,
// // //             FortressOfBlood,
// // //             FairyMargin,
// // //             CursedWood,
// // //             LakeOfShadows,
// // //             HeartOfTheBog,
// // //             TreeMaze,
            BogThreshold,
            BogA1, BogA2, BogA3, BogA4,
            BogB1, BogB2, BogB3, BogB4,
            BogC1, BogC2, BogC3, BogC4,
            BogD1, BogD2, BogD3, BogD4, BogD3Sea,
// // //             OakWood,
// // //             DruidTemple,
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

    // All scenes start directly — WorldScene is only used as an idle holder
    // and does not route to other scenes. BowTutorial is no longer a special
    // case; it starts the same way every other scene does.
    window.game.scene.start(sceneToStart, { champion: selectedChampion })
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

function onFullscreenChange() {
    setTimeout(() => {
        resizeGame()
        // Recentre camera on player after resize so perspective stays accurate
        if (window.game?.scene) {
            window.game.scene.scenes.forEach(scene => {
                if (scene.player && scene.cameras?.main) {
                    const cam = scene.cameras.main
                    cam.scrollX = scene.player.logicalX - window.innerWidth / 2
                    cam.scrollY = scene.player.logicalY - window.innerHeight / 2
                }
            })
        }
    }, 150)
}

window.addEventListener('load', resizeGame)
window.addEventListener('resize', resizeGame)
window.addEventListener('orientationchange', resizeGame)
document.addEventListener('fullscreenchange', onFullscreenChange)
document.addEventListener('webkitfullscreenchange', onFullscreenChange)
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

