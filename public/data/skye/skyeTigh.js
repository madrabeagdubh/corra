// skyeTigh.js
// Location: public/data/skye/skyeTigh.js
//
// Tigh Fhearghais, the official map (tighFhearghais.js). What can be looked at: stand by it and tap the ? on the moon (see tighFhearghais.js).

export const skyeTighContent = {
  objects: [
    { id: 'fire',     type: 'examine', x: 4, y: 4, text: { ga: 'Tine', en: 'The fire' } },
    { id: 'window',   type: 'examine', x: 6, y: 3, text: { ga: 'Fuinneog', en: 'The window' } },
    { id: 'bed',      type: 'examine', x: 2, y: 5, text: { ga: 'Do leaba', en: 'Your bed' } },
    { id: 'ficheall', type: 'examine', x: 6, y: 6, text: { ga: 'Ficheall', en: 'A board game' } },     // looked at, it opens the game (ui/ficheall)
  ],
  npcs: [],
  // Fergus, the one figure in the room (the script moves him; his words are in tighFhearghais.js)
  fixedEncounters: [
    { id: 'fearghas', x: 4, y: 6, radius: 0, visual: { gid: 9203, flat: false }, portrait: '/assets/npcs/othran.png', dialogues: [] },
  ],
}
