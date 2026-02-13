import BowTutorial from "./game/scenes/locations/bowTutorial.js"
import WorldScene from "./game/scenes/worldScene.js"
import BogMeadow from "./game/scenes/locations/bogMeadow.js"



const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#222222',
  parent: 'gameContainer',
  scene: [WorldScene, BogMeadow, BowTutorial],
  autoStart: false,  
 scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    pixelArt: true  // Optional: keeps tiles crisp
  },
  physics: {
    default: 'arcade'  // If you need it later
  },
  input: {
    touch: {
      capture: true  // Enable touch events
    }
  }
};

// ✅ FIX #1: Accept 'options' parameter with default value

export function startGame(selectedChampion, options = {}) {


  console.log('startGame called with:', selectedChampion, 'options:', options);

  window.selectedChampion = selectedChampion;
  config.selectedChampion = selectedChampion;

  window.game = new Phaser.Game(config);

  // Set the registry data
  window.game.registry.set('selectedChampion', selectedChampion);

  
  
const sceneToStart = options.startScene || 'BowTutorial';
console.log('[main.js] Starting scene:', sceneToStart);



window.startGame = startGame
window.game.scene.start(sceneToStart, { champion: selectedChampion });

  console.log('Game created, champion stored in registry');
}

window.startGame = startGame;

function resizeGame() {
  const container = document.getElementById('gameContainer');
  if (container) {
    container.style.width = window.innerWidth + 'px';
    container.style.height = window.innerHeight + 'px';
  }

  if (window.game && window.game.scale) {
    window.game.scale.resize(window.innerWidth, window.innerHeight);
  }
}

window.addEventListener('load', resizeGame);
window.addEventListener('resize', resizeGame);
window.addEventListener('orientationchange', resizeGame);

window.addEventListener('load', () => console.log('Game started'));

