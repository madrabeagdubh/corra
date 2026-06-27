import Phaser from 'phaser'
import './heroSelect.js'
import BowTutorial from './game/scenes/locations/bowTutorial.js'
import WorldScene from './game/scenes/worldScene.js'
import BogA1 from './game/scenes/locations/bog/a1.js'
import BogB0 from './game/scenes/locations/bog/b0.js'
import D3OpenSea from './game/scenes/locations/bog/d3OpenSea.js'
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
import Tavern from './game/scenes/locations/village/tavern.js'
import TestForest from './game/scenes/locations/forest/testForest.js'
import { champions } from '../data/champions.js'
import { initFullscreenButton } from './game/ui/fullscreenButton.js'
initFullscreenButton()

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
    const urlParams = new URLSearchParams(window.location.search)
    const sceneOverride = urlParams.get('scene')
    if (sceneOverride) options.startScene = sceneOverride

    if (sceneOverride && !selectedChampion) {
        selectedChampion = window.devChampion || { id: 'dev', nameGa: 'Dev' }
    }

    const starfieldLoader = document.getElementById('starfieldLoader')
    if (starfieldLoader) starfieldLoader.style.display = 'none'

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
        scene: [TestForest,
            WorldScene,
            BowTutorial,
            BogB0,
            BogA1, BogA2, BogA3, BogA4,
            BogB1, BogB2, BogB3, BogB4,
            BogC1, BogC2, BogC3, BogC4,
            BogD1, BogD2, BogD3, BogD4, BogD3Sea, D3OpenSea,
            Tavern,
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

