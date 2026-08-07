#!/usr/bin/env python3
"""
patch_dialogue_dance.py

The speaker's portrait dances while their tune plays, and consecutive tunes
stop treading on each other.

Run from the repo root, AFTER patch_dialogue_hero_harp.py:

    python3 patch_dialogue_dance.py

Idempotent. One file: js/game/ui/textPanel.js

1. THE DANCE
------------

Modelled on championBoogie in heroSelect.js -- hop, flip, hop, flip -- but that
is CSS on a DOM canvas and the encounter portrait is a Phaser image, so it's
rebuilt as a tween.

The hop is pinned to the tune's own dance beat rather than to a fixed interval:
three units under a jig, four under a reel, which is the same span the bodhrán
phrases on. So a jig NPC bounces quicker than a reel NPC, and both are in time
with what they're singing.

IMPORTANT -- it moves `bob`, not `y`. _applyScroll owns every content item's
position and rewrites it each tick, so a tween on obj.y would be overwritten the
moment the player touched the card. Same ownership problem the reveal alpha had,
same solution: one owner, and the animation contributes an input rather than
writing the property. Anything else that wants to move a card element needs to
do the same.

Flip and rotation are tweened directly, since _applyScroll doesn't touch them.

2. THE OVERLAP
--------------

Harp notes ring for one to two and a half seconds after they're struck, so a
motif is still sounding well past its last note. Blocks were sized to the motif
almost exactly, which put the next phrase on top of the previous one's tail.

Both tails go up -- three beats instead of two for a spoken line, three instead
of one after the player's. With longer lines the problem largely solves itself
anyway, since a motif has a fixed length and more text gives it more room to
decay into.
"""

import io
import os
import sys

UI_PATH = os.path.join('js', 'game', 'ui', 'textPanel.js')

MARKER = 'CARD_DANCE_HOP_PX'


def die(msg):
    print('  !! %s' % msg)
    sys.exit(1)


def replace_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        die('expected 1 match for %s, found %d' % (label, n))
    print('  -- %s' % label)
    return src.replace(old, new, 1)


OLD_CONST = """const CARD_READ_TAIL_BEATS = 2       // breath after the last note of a block"""

NEW_CONST = """// Harp notes ring for one to two and a half seconds after they're struck, so a
// motif is still sounding well past its final note. Blocks sized flush to the
// motif put the next phrase on top of the last one's tail.
const CARD_READ_TAIL_BEATS = 3       // breath after the last note of a block

// The portrait dances while its owner's tune plays -- after championBoogie in
// heroSelect.js, but pinned to the tune's own dance beat rather than a fixed
// interval, so a jig NPC bounces quicker than a reel one.
const CARD_DANCE_HOP_PX    = 9
const CARD_DANCE_TILT      = 0.05    // radians at the top of a hop"""


OLD_HERO_TAIL = """const CARD_READ_HERO_TAIL_BEATS = 1"""
NEW_HERO_TAIL = """const CARD_READ_HERO_TAIL_BEATS = 3"""


# Portraits need to be identifiable, and to carry a bob offset.
OLD_PORTRAIT = """        this._contentItems.push({
          obj: img, localY: cy, baseAlpha: 1, group: row.group, reveal: 0,
        })"""

NEW_PORTRAIT = """        this._contentItems.push({
          obj: img, localY: cy, baseAlpha: 1, group: row.group, reveal: 0,
          isPortrait: true, isHero: !!row.isHero, bob: 0,
        })"""


# _applyScroll folds the bob in, the same way it folds in the reveal.
OLD_Y = """      const y = this._contentBaseY + localY - this._scrollY
      obj.y = y"""

NEW_Y = """      // The dance contributes here rather than writing obj.y itself: this
      // function rewrites the position every tick, so a tween on obj.y would
      // be undone the instant the player touched the card.
      const y = this._contentBaseY + localY - this._scrollY - (item.bob || 0)
      obj.y = y"""


# The dance itself.
OLD_METHOD = """  /**
   * How far the English is lifted, 0 to 1, while the moon is held."""

NEW_METHOD = """  /**
   * Make a speaker's portrait dance for `durationMs`, hopping once per
   * `stepMs`. Hop, flip, hop, flip -- championBoogie's shape, at the tempo of
   * whatever tune is playing.
   *
   * Tweens `bob` rather than `y` for the reason given in _applyScroll.
   */
  _dance(isHero, durationMs, stepMs) {
    if (!this._contentItems || !(stepMs > 0)) return
    const item = this._contentItems.find(
      it => it.isPortrait && !!it.isHero === !!isHero
    )
    if (!item?.obj?.active) return

    const hops = Math.max(1, Math.round(durationMs / stepMs))
    item.bob = 0
    this._revealTweens.push(this.scene.tweens.add({
      targets: item,
      bob: CARD_DANCE_HOP_PX,
      duration: Math.round(stepMs / 2),
      yoyo: true,
      repeat: hops - 1,
      ease: 'Quad.easeOut',
      onUpdate: () => this._applyScroll(),
      onYoyo: () => {
        // The flip is what makes it read as a dance rather than a bounce.
        if (item.obj?.active) item.obj.toggleFlipX()
      },
      onComplete: () => {
        item.bob = 0
        if (item.obj?.active) { item.obj.setFlipX(false); item.obj.rotation = 0 }
        this._applyScroll()
      },
    }))

    this._revealTweens.push(this.scene.tweens.add({
      targets: item.obj,
      rotation: { from: -CARD_DANCE_TILT, to: CARD_DANCE_TILT },
      duration: Math.round(stepMs / 2),
      yoyo: true,
      repeat: hops - 1,
      ease: 'Sine.easeInOut',
    }))
  }

  /**
   * How far the English is lifted, 0 to 1, while the moon is held."""


OLD_FIRE = """        const blockMs = readMs(g)
        const fire = () => {
          try { DialogueHarp.phrase({ isHero, blockMs }) } catch (e) {}
        }"""

NEW_FIRE = """        const blockMs = readMs(g)
        // The hop lands on the tune's dance beat -- three units under a jig,
        // four under a reel -- which is the same span the bodhrán phrases on.
        const step = (bar === 6 || bar === 9 ? 3 : 4) * unit
        const fire = () => {
          try { DialogueHarp.phrase({ isHero, blockMs }) } catch (e) {}
          try { this._dance(isHero, motif, step) } catch (e) {}
        }"""


def main():
    if not os.path.isfile(UI_PATH):
        die('%s not found -- run this from the repo root.' % UI_PATH)

    with io.open(UI_PATH, encoding='utf-8') as fh:
        src = fh.read()

    if MARKER in src:
        print('Already patched -- nothing to do.')
        return

    if 'CARD_READ_HERO_TAIL_BEATS' not in src:
        die('run patch_dialogue_hero_harp.py first -- this builds on it.')

    print('Patching %s' % UI_PATH)
    src = replace_once(src, OLD_CONST, NEW_CONST, 'dance + longer tail constants')
    src = replace_once(src, OLD_HERO_TAIL, NEW_HERO_TAIL, 'longer tail after the player line')
    src = replace_once(src, OLD_PORTRAIT, NEW_PORTRAIT, 'portraits carry a bob')
    src = replace_once(src, OLD_Y, NEW_Y, '_applyScroll folds in the bob')
    src = replace_once(src, OLD_METHOD, NEW_METHOD, '_dance()')
    src = replace_once(src, OLD_FIRE, NEW_FIRE, 'dance with the phrase')

    with io.open(UI_PATH, 'w', encoding='utf-8') as fh:
        fh.write(src)

    print('Done.')


if __name__ == '__main__':
    main()
