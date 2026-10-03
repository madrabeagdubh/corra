// courseScript.js
// Location: js/game/scenes/locations/skye/courseScript.js
//
// EVERYTHING CONALL SAYS in the crash course (faicheCourse.js), in one place,
// so the dialogue can be rewritten without touching the logic. Edit freely:
//
//   L(en, ga)   one caption: English, then Irish. Leave `ga` out and the
//               English shows in both slots (and isn't voiced).
//   a list      said one after another, each held for its reading time.
//   ms          (optional, last argument) how long it stays up.
//
// The lessons run in ORDER (faicheCourse.js ORDER). Each has these slots:
//   intro    said as it begins (you may already act: it is listening)
//   hint     if you stall (see HINT_AFTER_MS), a plain instruction
//   good     a word when you do it right (some lessons have several)
//   done     said as it ends
// Lines for particular moments are named where they're used (see the comments).
//
// PLACEHOLDERS: the structure is the point. The Irish that was given is kept
// ("arís", "ar aire", "ar chlé", "ionsaigh", "go maith"); the rest is a first
// draft, or English in both slots. LORE is for poetry and old sayings, said now and then.

export const L = (en, ga = en, ms) => ({ en, ga, ms })

export const SCRIPT = {

  // ── 1. meet (garden) ──────────────────────────────────────────────────────
  meet: {
    intro: [
      L('Hello.', 'Dia dhuit.'),
      L('I am Conall.', 'Is mise Conall.'),
      L('Uathach teaches from the dais, and only the tournament brings her down. Until then, you have me.', undefined, 6200),
    ],
    stand: L('Stand on the mark.'),
    standAgain: L('The mark. Stand on it.'),
  },

  // ── 2. dirs: forward / left / back / right, one step each ─────────────────
  dirs: {
    intro: L('I call; you step. One call, one step. Watch the brooch.', undefined, 4200),
    // the calls themselves (Irish only matters here): see DIR_CALLS in faicheCourse.js
    done: [L('Good.', 'Go maith.'), L('Now a finger, not a foot.')],
  },

  // ── 3. tap: tap-to-move (four marks, all near you) ───────────────────────
  tap: {
    intro: L('Put a finger on the gold mark, and let your feet follow.', 'Leag do mhéar ar an áit sin.', 4200),
    hint: L('Tap the gold mark on the grass.'),
    tapped: L('That is it.', 'Sin é.'),
    walked: L('You walked. Well enough -- but next time use your finger.'),
    again: L('Again.', 'Arís.'),
    further: L('Again.', 'Arís.'),
    done: L('Good. That is one way to move. There are better ones.', undefined, 4200),
  },

  // ── 4. drag: he draws a line on the ground and walks it; then you ────────
  drag: {
    intro: L('Watch. I will show you a better way than tapping.', undefined, 3600),
    drawing: L('I put a finger down, and draw where I mean to go.', undefined, 4200),
    following: L('And now I walk it.', undefined, 3000),
    you: L('Now you. Put a finger on the ground and drag it, and draw where you mean to go.', undefined, 5200),
    hint: L('Drag a finger across the ground, and your feet will follow the line.'),
    good: L('Good. Again, with a bend in it.', undefined, 2800),
    done: [L('Good.', 'Go maith.'), L('A line may turn, and cross, and carry a sword with it. You will see.', undefined, 4600)],
  },

  // ── 5. sword: the throw ──────────────────────────────────────────────────
  sword: {
    intro: [
      L('Enough walking. A body that only walks is a poor thing to meet a sword with.'),
      L('Here.', 'Seo.'),
    ],
    throw: L('Catch!', 'Beir air!'),
    caught: L('Good hands. It is ash, worn smooth. It will bruise you, not kill you.', undefined, 4200),
    done: L('Now. How to carry it.'),
  },

  // ── 6. calls: how the blade is carried (the moon shows the gesture) ──────
  // Said and done in this order: draw, salute, sheathe, (good), draw. Each
  // `hint` shows if you stall; the moon also shows the gesture to make.
  calls: {
    intro: L('A blade has its manners. First, how it is carried.', undefined, 3600),
    draw:    { say: L('Draw your blade.', 'Ar aire!'),      hint: L('Swipe up on the moon.') },
    salute:  { say: L('Salute.'),                            hint: L('While on guard, swipe up on the moon again.') },
    sheathe: { say: L('Sheathe your blade.', 'Seas ar ais'), hint: L('Swipe down on the moon.') },
    good: L('Good.', 'Go maith.', 1400),
    drawAgain: { say: L('Draw your blade.', 'Ar aire!'),     hint: L('Swipe up on the moon.') },
  },

  // Said now and then: poetry, old sayings. Put anything here.
  lore: [
    L('Bíonn gach tosú lag.', undefined, 3000),             // PLACEHOLDER saying: every beginning is weak
    L('The edge of a blade is not the sharpest part of it. The hand is.', undefined, 4200),
    L('Scáthach taught that the sword is a question, and the body the answer.', undefined, 4600),
  ],

  // ── 7. cuts: attack, again, again, faster ────────────────────────────────
  cuts: {
    intro: L('Now strike.', 'Ionsaigh!', 1800),
    hint: L('Tap the moon.'),
    again: L('Again.', 'Arís.', 1300),
    faster: L('Faster.', 'Níos tapúla.', 1300),
    good: L('Good.', 'Go maith.', 1400),
    hardWork: L('See? It is hard work.', undefined, 2600),
  },

  // ── 8. fatigue: when to give everything, when to hold back ───────────────
  fatigue: {
    intro: [
      L('Every blow costs breath. Give everything at every blow, and soon you have nothing.', undefined, 4600),
      L('Show me. Cut until the moon is empty.', undefined, 3200),
    ],
    hint: L('Keep cutting. Tap the moon, again and again.'),
    winded: L('There. Spent. Now you are a man holding a stick.', undefined, 3800),
    rest: L('Rest. Stand still, and let it come back.', undefined, 3000),
    rested: L('That is the secret of it: know when to hold back.', undefined, 3400),
    done: L('Rest when you can. Strike when you must.', undefined, 3000),
  },

  // ── 8b. strong: ready a strong attack ────────────────────────────────────
  strong: {
    intro: L('And when it counts, give it everything. Ready a strong attack.', undefined, 4200),
    hint: L('Hold the moon until the ring is full, then let go.'),
    good: L('There. That one has weight.', 'Go maith.', 2200),
    breathe: L('Breathe first. A strong blow costs twice.', undefined, 3000),
    done: L('A cut is for opening a guard. A strong blow is for ending an argument.', undefined, 4600),
  },

  // ── 9. dummy: carried out, cut, struck, shoved ───────────────────────────
  dummy: {
    fetch: L('Wait. I will fetch the dummy.', undefined, 3000),
    clear: L('Step aside. I need that ground.', undefined, 2400),
    intro: [
      L('Straw does not bleed, and does not bear a grudge. Hit it.', undefined, 4200),
      L('Cut it. Strike it strong. Walk into it, blade out, and give it your shoulder. Thirty points.', undefined, 6200),
    ],
    hint: L('Stand beside it, draw your sword, and tap the moon. Hold for a strong blow.'),
    done: L('Good. A cut opens, a strong blow ends, a shoulder shifts. Now to bring your feet into it.', undefined, 5600),
  },

  // ── 10. feet: cut it while walking a line ────────────────────────────────
  feet: {
    intro: [
      L('Feet and blade are one thing. Draw a line that passes the dummy, and cut as you go by.', undefined, 6000),
      L('Three passes.', undefined, 1800),
    ],
    hint: L('Drag a line along the dummy, and tap the moon as you pass it.'),
    passOne: L('That is one.', undefined, 1400),
    passTwo: L('Two.', undefined, 1200),
    done: L('Good. Never stand still when you can pass by. I will put it away.', undefined, 4600),
  },

  // ── 11. duel: brief, slow, gentle; he coaches ────────────────────────────
  duel: {
    intro: [
      L('Last of the lessons. A short bout, and a slow one. I will not hurt you.', undefined, 4600),
      L('On guard.', 'Ar aire.'),
    ],
    hint: L('Draw your sword (swipe up on the moon), and come at me.'),
    coach: {
      tell: L('My sword is lifting. Step back!', undefined, 2400),
      miss: L('He missed. Now step in and cut!', undefined, 2600),
      hit: [L('Good.', 'Go maith.', 1400), L('Again.', 'Arís.', 1400), L('That is it.', 'Sin é.', 1400)],
      hurt: L('Too slow. Step back when the blade lifts.', undefined, 2600),
      shove: L('A shoulder. Use it sparingly.', undefined, 2400),
    },
    disarm: L('Mine is gone. Walk into me to hand it back.', undefined, 3600),
    returned: L('Good. A man who returns the sword is worth meeting twice.', undefined, 4200),
    struck: L('Never strike a man who has no sword.', undefined, 3600),
    won: [L('Well done. That is a bout.', 'Go maith.', 3000), L('Step back when the blade lifts, step in when it misses. Say it until it says itself.', undefined, 5200)],
  },

  // ── 12. end ──────────────────────────────────────────────────────────────
  end: {
    intro: [
      L('That is all I can teach you alone. The rest is the others.', undefined, 4400),
      L('Go back across the loch to the green. Uathach is taking a class there. Join the other students.', undefined, 6200),
    ],
  },

  // anything else
  generic: {
    giveUp: L('Enough. It will come in the doing.', undefined, 3000),
    sheathe: L('Put it away.'),
  },
}

export const HINT_AFTER_MS = 14000         // a plain instruction, if a lesson stalls this long
export const GIVE_UP_MS = 90000            // and after this, he lets it go and moves on
