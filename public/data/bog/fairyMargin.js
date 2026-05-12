// js/game/data/bog/fairyMargin.js  (or public/data/bog/fairyMargin.js — match your bogThreshold path)
// Content for the Fairy_Margin scene.
// Currently used as a voice synthesis test environment.

export const fairyMarginContent = {

  introNarrative: [],

  objects: [],

  // Fixed encounters — rendered as PGR billboards, interacted via moon badge.
  // The blacksmith is positioned west of the fairy mound, clear of existing geometry.

  fixedEncounters: [
    {
      id: 'blacksmith_singing',
      x: 0, y: 0,
      visual: { gid: 473, flat: false },   // placeholder gid — swap for forge sprite when available
      dialogues: [
        {
          ga: 'Ding dong dederó, buail sin, séid seo!\nDing dong dederó, buail sin, séid seo!\nD\'imigh mo bhean leis an táilliúir aerach.',
          en: 'Ding dong dederó, strike that, blow this!\nDing dong dederó, strike that, blow this!\nMy wife has gone off with the merry tailor.',
        },
        {
          ga: 'Ní maith a ním féin tua ná corrán,\nNí maith a ním féin ramhan ná sleán,\nO\'d\'imigh uaim mo stuaire mná\nle gaige trua gan bhuar, gan sparán.',
          en: 'I cannot forge a good axe or reaping-hook,\nI cannot forge a good spade or slane,\nSince my fine woman left me\nfor a wretched fop without cattle or purse.',
        },
        {
          ga: 'Cá bhfuil mo bhuachaill? Buail sin, séid seo!\nCá bhfuil mo neart, is snas mo chéirde?\nCá bhfuil mo radharc? Tá\'n adharc ar m\'éadan\nÓ d\'éaluigh mo bhean leis an táilliúir aerach.',
          en: 'Where is my boy? Strike that, blow this!\nWhere is my strength, and the polish of my craft?\nWhere is my sight? The horn is on my forehead\nSince my wife slipped away with the merry tailor.',
        },
      ],
    },
  ],

  npcs: [],
}

