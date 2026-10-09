// enemies.js
// Location: js/game/combat/enemies.js
//
// Foes built from the same stats as the champions -- hearts, Neart (attack),
// Cosaint (defence), Luas (speed) -- plus stamina, and what they do with them.
// A preset here goes to MeleeBout as { F } instead of a PRESETS kind:
//
//   new MeleeBout(scene, { F: GARBHAN, home: [18, 13], gid })
//
// stats(): hearts -> hp, Neart -> atk, Cosaint -> def, Luas -> stepMs (250 - speed * 15, as the Player)
//
// Stamina (melee.js, F.stamina): a pool spent per cut (stamCut) and per step (stamStep), coming back at
// stamRegen a second while he isn't swinging. Run dry and he's blown for at least blownMs: no guard, no
// poise; he backs off, or shoves you if you crowd him, until he has 60% back.
// Poise (F.poise): fresh, a blow lands but doesn't stop him (no stagger, no knock back); a charged blow
// still floors him.

import { BASE } from './melee.js'

export const stats = ({ health, attack, defense, speed, stamina }) =>
  ({ hp: health, atk: attack, def: defense, stepMs: Math.max(120, 250 - speed * 15), stamina })

// Garbhán with his knife: to the death. He's tired, has no guard, and doesn't shove any more.
// On his last heart he drops it and runs (boutOver how: 'fled'). Into the loch, and he won't follow you.
export const GARBHAN_KNIFE = {
  ...BASE, ...stats({ health: 3, attack: 6, defense: 3, speed: 5, stamina: 4 }),
  phase: 'knife', style: 'rusher', aggressor: true, salutes: false, lethal: true, mercy: false, keepBout: true,
  flees: true, dunkable: true, noShove: true,
  windMs: 450, strikeMs: 110, recoverMs: 800, followWind: 320, combo: 1,
  parryBase: 0, parryReel0: 0, parryReelStep: 0, parryMax: 0, restMin: 300, restMax: 700,
  stamCut: 1, stamStep: 0.2, stamRegen: 1.2, blownMs: 1800,
  drown: { graceMs: 1000, everyMs: 1000 },
}

// Garbhán, the bully on the loch's middle bank. He shoves first (three times, or until you strike him),
// then the wooden sword: a wild rush, until he's blown. His last wooden heart: the knife comes out.
export const GARBHAN = {
  ...BASE, ...stats({ health: 6, attack: 6, defense: 4, speed: 6, stamina: 5 }),
  style: 'rusher', aggressor: true, salutes: false, dunkable: true, next: GARBHAN_KNIFE,
  windMs: 420, strikeMs: 110, recoverMs: 700, followWind: 300, combo: 2,
  parryBase: 0.15, parryReel0: 0.1, parryReelStep: 0.05, parryMax: 0.3, restMin: 200, restMax: 500,
  stamCut: 1.2, stamStep: 0.3, stamRegen: 0.8, blownMs: 2500, poise: true,          // about one blown spell per rush
  shoves: 3, shoveWind: 450, shoveGap: 1500,
  drown: { graceMs: 1000, everyMs: 1000 },
}
