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
  },

 input: {
    touch: {
      capture: true  // Enable touch events
    }
  }

};
export function startGame(selectedChampion) {
  console.log('startGame called with:', selectedChampion);

  window.selectedChampion = selectedChampion;
  config.selectedChampion = selectedChampion;

  window.game = new Phaser.Game(config);
  
  // Set the registry data
  window.game.registry.set('selectedChampion', selectedChampion);
  
  // ADD THIS LINE:
  // This ensures that once the game engine boots, it starts your tutorial scene
  // Replace 'BowTutorial' with the actual key defined in your bowTutorial.js class
  window.game.scene.start('BowTutorial', { champion: selectedChampion });

  console.log('Game created, champion stored in registry');
}


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
