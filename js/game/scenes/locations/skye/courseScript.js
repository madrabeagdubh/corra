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

  // ── 2. dirs: forward / back / left / right ───────────────────────────────
  dirs: {
    intro: L('I call; you step. One call, one step. Watch the brooch.', undefined, 4200),
    // the calls themselves (Irish only matters here): see DIR_CALLS in faicheCourse.js
    done: [L('Good.', 'Go maith.'), L('Your feet know their business. Now, the sky.')],
  },

  // ── 3. compass: north / south / east / west ──────────────────────────────
  compass: {
    intro: [
      L('Up the garden is north. Face it, and the cold sea is beyond.', undefined, 4600),
      L('The old way is to face the sunrise. East is before you, west behind, south on your right hand, north on your left.', undefined, 7600),
      L('So the word for right is the word for south. Remember that.', undefined, 4200),
      L('Now by the sky, not the hand.', undefined, 2600),
    ],
    done: L('Good. A sailor could do no better.', 'Go maith.'),
  },

  // ── 4. tap: tap-to-move ──────────────────────────────────────────────────
  tap: {
    intro: L('Now the better way. Put a finger on the gold mark, and let your feet follow.', 'Leag do mhéar ar an áit sin.', 4200),
    hint: L('Tap the gold mark on the grass.'),
    tapped: L('That is it.', 'Sin é.'),
    walked: L('You walked. Well enough -- but next time use your finger.'),
    again: L('Again.', 'Arís.'),
    further: L('Further.', 'Níos faide.'),
    done: L('Good. Two ways to move. There is a third, and I will show you it when you have a sword.', undefined, 5200),
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

  // ── 9. dodge ─────────────────────────────────────────────────────────────
  dodge: {
    intro: [
      L('Now I come at you. Do not stand and take it: step back when my sword lifts.', undefined, 5200),
      L('On guard.', 'Ar aire.'),
    ],
    hint: L('Draw your sword (swipe up). When he lifts his, step back.'),
    good: [L('Good. Nothing there.', undefined, 1800), L('Again.', 'Arís.', 1400)],
    hurt: L('That is what it costs to stand still. Again.', undefined, 2600),
    done: L('A blow that finds nothing is a gift. But you do not live on gifts.', undefined, 4200),
  },

  // ── 10. counter ──────────────────────────────────────────────────────────
  counter: {
    intro: L('The gift: step back, he misses, and you step in and cut. Back, in, cut.', undefined, 5200),
    hint: L('Step back when he swings. When he has missed, step in and tap the moon.'),
    good: [L('Go maith!', undefined, 1600), L('That is the whole art.', undefined, 2200)],
    hurt: L('Too slow. Back, then in.', undefined, 2200),
    done: L('Back, in, cut. Say it as you do it, until it says itself.', undefined, 4200),
  },

  // ── 11. charge and disarm ────────────────────────────────────────────────
  charge: {
    intro: [
      L('Now I guard. Blades that meet hard can throw a sword from a hand. A strong blow meets hardest.', undefined, 6200),
      L('Strike my guard, and strike it strong.'),
    ],
    hint: L('Hold the moon until the ring is full, then let go -- against his guard.'),
    disarmed: L('There. Mine is gone. Fetch it, and give it back to me.', undefined, 4200),
    giveBack: L('Walk into me to hand it over.'),
    returned: L('Good. A man who returns the sword is worth meeting twice.', undefined, 4200),
    giveUp: L('It happens when it happens. You know how.', undefined, 3000),
    struck: L('Never strike a man who has no sword. Remember that above the rest.', undefined, 4600),
    done: L('Never strike a man who has no sword. Remember that above the rest.', undefined, 4600),
  },

  // ── 12. shove ────────────────────────────────────────────────────────────
  shove: {
    intro: L('Last. When the blades are no use, use your shoulder. Walk into me, sword out.', undefined, 5200),
    hint: L('Stand en garde and walk into him.'),
    good: [L('Good.', 'Go maith.', 1400), L('Again.', 'Arís.', 1400)],
    done: L('It costs breath, and it opens a man. Use it sparingly.', undefined, 4200),
  },

  // ── 13. end ──────────────────────────────────────────────────────────────
  end: {
    intro: [
      L('That is the first of it. The rest is the green: the dummy, and the others.', undefined, 4600),
      L('Go east, past the loch and the machaire. I will meet you there.', undefined, 4600),
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
