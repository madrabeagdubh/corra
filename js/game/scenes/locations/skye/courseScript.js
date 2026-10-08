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
// PLACEHOLDERS: for now every line is English in BOTH slots (so nothing is
// voiced). Put the Irish back in as `ga` when it is ready.

export const L = (en, ga = en, ms) => ({ en, ga, ms })

export const SCRIPT = {

  // ── 1. meet (garden) ──────────────────────────────────────────────────────
  meet: {
    intro: [
      L('Hello.'),
      L('I am Conall.'),
      L('Uathach teaches from the dais, and only the tournament brings her down. Until then, you have me.', undefined, 6200),
    ],
    stand: L('Stand on the mark.'),
    standAgain: L('The mark. Stand on it.'),
  },

  // ── 2. drag: he draws a line on the ground and walks it; then you ────────
  drag: {
    intro: L('Watch. I will show you the best way to move.', undefined, 3600),
    drawing: L('I put a finger down, and draw where I mean to go.', undefined, 4200),
    following: L('And now I walk it.', undefined, 3000),
    you: L('Now you. Put a finger on the ground and drag it, and draw where you mean to go.', undefined, 5200),
    hint: L('Drag a finger across the ground, and your feet will follow the line.'),
    good: L('Good. Again, with a bend in it.', undefined, 2800),
    done: [L('Good.'), L('A line may turn, and cross, and bend. Now, what you do with the ground once you have it.', undefined, 5200)],
  },

  // ── 2b. space: before any blade, the ground ──────────────────────────────
  // Bare-handed. First he lunges at the tile you stand on (it turns red) and you
  // step off it; then he shoves you about until you shove back.
  space: {
    intro: [
      L('Before the blade, the ground. A fighter who gives up the ground has lost the fight already.', undefined, 5400),
      L('Keep your distance. I will come at you, and the tile under you will turn red. Be off it.', undefined, 5200),
    ],
    dodgeGo: L('On guard. Watch the tile.', undefined, 2400),
    dodgeHint: L('When the tile under you turns red, step off it.'),
    tag: L('Off the tile, not on it.', undefined, 2400),
    good: [L('Go maith!'), L('Sin é!'), L('Arís!'), L('Good.')],
    mid: [
      L('Good. Now: if you cannot control the space, make sure that they cannot either.', undefined, 5400),
      L('This time I will shove you about, until you shove me back. Walk into me.', undefined, 4600),
    ],
    shoveGo: L('On guard.', undefined, 1800),
    shoveHint: L('Walk into him to shove him back.'),
    shoved: [L('Go maith!'), L('Sin é! Arís!')],
    done: L('Good. The ground is yours to give, and to take. Now, steel.', undefined, 4200),
  },

  // ── 3. sword: the throw ──────────────────────────────────────────────────
  // (you stand on the mark, he stands facing you, two tiles to your left)
  sword: {
    intro: [
      L('Enough walking. A body that only walks is a poor thing to meet a sword with.'),
      L('Here.'),
    ],
    throw: L('Catch!'),
    caught: L('Good hands. It is ash, worn smooth. It will bruise you, not kill you.', undefined, 4200),
    done: L('Now. How to carry it.'),
  },

  // ── 4. calls: draw, salute, swish, sheathe (the moon shows each gesture) ─
  // One flow, each step said, shown on the moon, and answered with a word the
  // moment you get it right: you never wonder whether it counted.
  calls: {
    intro: L('A blade has its manners. First, how it is carried.', undefined, 3600),
    draw:    { say: L('Draw your blade.'), hint: L('Swipe up on the moon.') },
    salute:  { say: L('Salute.'),          hint: L('While on guard, swipe up on the moon again.') },
    swish:   { say: L('Now swing it. Cut at the air in front of you.', undefined, 3200), hint: L('Tap the moon.'),
               again: L('Again.', undefined, 1300), faster: L('Faster.', undefined, 1300) },
    sheathe: { say: L('Now put it away.'), hint: L('Swipe down on the moon.') },
    good: L('Good.', undefined, 1100),
  },

  // Said now and then: poetry, old sayings. Put anything here.
  lore: [
    L('Every beginning is weak.', undefined, 3000),
    L('The edge of a blade is not the sharpest part of it. The hand is.', undefined, 4200),
    L('Scáthach taught that the sword is a question, and the body the answer.', undefined, 4600),
  ],

  // ── 5. fatigue: when to give everything, when to hold back ───────────────
  fatigue: {
    intro: L('Every blow costs breath. Tap the moon, and cut until it is empty.', undefined, 4600),
    hint: L('Keep cutting. Tap the moon, again and again.'),
    winded: L('There. Spent. Now you are a man holding a stick.', undefined, 3800),
    rest: L('Spent. Now rest: stand still, and let it come back.', undefined, 3200),
    rested: L('That is the secret of it: know when to hold back.', undefined, 3400),
    done: L('Rest when you can. Strike when you must.', undefined, 3000),
  },

  // ── 6. strong: ready a strong attack ─────────────────────────────────────
  strong: {
    intro: L('And when it counts, give it everything. Ready a strong attack.', undefined, 4200),
    hint: L('Hold the moon until the ring is full, then let go.'),
    good: L('There. That one has weight.', undefined, 2200),
    breathe: L('Breathe first. A strong blow costs twice.', undefined, 3000),
    done: L('A cut is for opening a guard. A strong blow is for ending an argument.', undefined, 4600),
  },

  // ── 7. dummy: he stands in for it, parrying all, and counts ──────────────
  dummy: {
    fetch: L('Stay there. I will be the target.', undefined, 3000),
    clear: L('Step aside. I need that ground.', undefined, 2400),
    intro: [
      L('You cannot hurt me, and I will not hurt you. Try.', undefined, 4200),
      L('Cut me. Strike strong. I will turn it all aside, and I will know what would have landed.', undefined, 5200),
    ],
    saluteFirst: L('A bout begins with a salute. Draw your sword, and return mine.', undefined, 3600),
    saluteHint: L('Swipe up on the moon to draw, and up again to salute.'),
    saluteDone: L('Good. Now.', undefined, 1600),
    hint: L('Stand beside Conall, draw your sword, and tap the moon. Hold for a strong blow.'),
    done: L('Enough. Those would have landed. A cut opens, a strong blow ends, a shoulder shifts. Now to bring your feet into it.', undefined, 6000),
  },

  // ── 8. feet: cut him while walking a line ────────────────────────────────
  feet: {
    intro: [
      L('Feet and blade are one thing. Draw a line that passes me, and cut as you go by.', undefined, 6000),
      L('Three passes.', undefined, 1800),
    ],
    hint: L('Drag a line past Conall, and tap the moon as you pass him.'),
    passOne: L('That is one.', undefined, 1400),
    passTwo: L('Two.', undefined, 1200),
    done: L('Good. Never stand still when you can pass by.', undefined, 3600),
  },

  // ── 9. duel: brief, slow, gentle; he coaches ─────────────────────────────
  duel: {
    intro: [
      L('Last of the lessons. Three bouts. I will not go easy for long.', undefined, 4600),
      L('On guard.'),
    ],
    hint: L('Draw your sword (swipe up on the moon), and come at me.'),
    coach: {
      tell: L('My sword is lifting. Step back!', undefined, 2400),
      miss: L('He missed. Now step in and cut!', undefined, 2600),
      hit: [L('Go maith!'), L('Sin é!'), L('Good!')],
      parry: [L('Sin é!'), L('Well turned!'), L('Go maith!')],
      hurt: L('Too slow. Step back when the blade lifts.', undefined, 2600),
      shove: L('A shoulder. Use it sparingly.', undefined, 2400),
      noSalute: L('You forgot to salute. A bout begins with respect.', undefined, 2800),
    },
    round: [L('Again. I will not be so slow.', undefined, 3000), L('Once more. Harder.', undefined, 3000)],
    disarm: L('Mine is gone. Walk into me to hand it back.', undefined, 3600),
    returned: L('Good. A man who returns the sword is worth meeting twice.', undefined, 4200),
    struck: L('Never strike a man who has no sword.', undefined, 3600),
    won: [L('Well done. That is a bout.', undefined, 3000), L('Step back when the blade lifts, step in when it misses. Say it until it says itself.', undefined, 5200)],
  },

  // ── 10. end ──────────────────────────────────────────────────────────────
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
