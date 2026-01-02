import Phaser from "phaser";
import WorldScene from "./game/scenes/worldScene.js";
import BowTutorial from "./game/scenes/locations/bowTutorial.js" 
import BogMeadow from "./game/scenes/locations/bogMeadow.js" 




const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#222222',
  parent: 'gameContainer',
  scene: [WorldScene, BogMeadow, BowTutorial],
  //scene: [WorldScene, BowTutorial,BogMeadow],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    pixelArt: true  // Optional: keeps tiles crisp
  },
  physics: {
    default: 'arcade'  // If you need it later
  }
};

export function startGame(selectedChampion) {
  console.log('startGame called with:', selectedChampion);
  
  // Store champion globally so it's accessible
  window.selectedChampion = selectedChampion;
  
  // Also try to add it to config
  config.selectedChampion = selectedChampion;
  
  window.game = new Phaser.Game(config);
  
  // Set it again after game is created
  window.game.registry.set('selectedChampion', selectedChampion);
  
  console.log('Game created, champion stored in registry');
}
window.startGame = startGame;

window.startGame = startGame;


function resizeGame() {
  {
    const container = document.getElementById('gameContainer');
    if (container) {
      container.style.width = window.innerWidth + 'px';
      container.style.height = window.innerHeight + 'px';
    }

    if (window.game && window.game.scale) {
      window.game.scale.resize(window.innerWidth, window.innerHeight);
    }
  }
}



window.addEventListener('load', resizeGame);
window.addEventListener('resize', resizeGame);
window.addEventListener('orientationchange', resizeGame);

window.addEventListener('load', () => console.log('Game started'));
