// skyeTigh.js
// Location: public/data/skye/skyeTigh.js
//
// Tigh Chonaill, the official map (tighConaill.js). What can be looked at: stand by it and tap the ? on the moon (see tighConaill.js).

export const skyeTighContent = {
  objects: [
    { id: 'fire',     type: 'examine', x: 4, y: 4, text: { ga: 'Tine', en: 'The fire' } },
    { id: 'wood',     type: 'examine', x: 3, y: 3, text: { ga: 'Connadh', en: 'Firewood' } },
    { id: 'window',   type: 'examine', x: 6, y: 3, text: { ga: 'Fuinneog', en: 'The window' } },
    { id: 'bed',      type: 'examine', x: 2, y: 5, text: { ga: 'Do leaba', en: 'Your bed' } },
    { id: 'table',    type: 'examine', x: 6, y: 7, text: { ga: 'An bord', en: 'The table' } },      // in front of it, on its south side
    { id: 'chest',    type: 'examine', x: 2, y: 7, text: { ga: 'An cófra ag bun na leapa', en: 'The chest at the foot of the bed' } },
    { id: 'door',     type: 'examine', x: 4, y: 9, text: { ga: 'An doras', en: 'The door' } },
  ],
  npcs: [],
  // Conall, the one figure in the room (the script moves him; his words are in tighConaill.js)
  fixedEncounters: [
    { id: 'conall', x: 4, y: 6, radius: 0, visual: { gid: 9203, flat: false }, portrait: '/assets/npcs/othran.png', dialogues: [] },
  ],
}
