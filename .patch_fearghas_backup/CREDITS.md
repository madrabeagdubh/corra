# Credits

Corra is written and designed by Roibeárd Mac Unfraidh (madrabeagdubh).
Coded with Claude AI and ChatGPT.

This file lists where Corra's art, sound and fonts come from, and the licence each one is under.
Anything marked **?** is not yet traced: see "Still to trace" at the end.

---

## Art

### The Fianna banners: `public/assets/banners/00.png` … `63.png`
The 64 emblems are icons from [game-icons.net](https://game-icons.net), licensed under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). They have been redrawn as pixel art and set on
banners in the county colours for Corra. The credit for each one, with a link to its source, is in
`public/assets/banners/credits.json`. By artist:

- **Delapouite** (28 icons): bat, cavalry, chestnut-leaf, circle, cow, drakkar-dragon, eagle-head, goblin-head, goose,
  jewel-crown, mermaid, mighty-force, oak-leaf, rat, ring, rooster, shamrock, sharp-halberd, sickle,
  spiked-dragon-head, squirrel, stalactites, stump-regrowth, swallow, trinacria, triquetra, two-coins, wood-canoe
- **Lorc** (27 icons): anvil, beast-eye, beech, big-wave, boar-tusks, breastplate, candle-flame, cat, cloak-dagger, crab,
  crystal-ball, cultist, death-note, imp, new-shoot, night-sky, raven, sea-serpent, sewing-needle, six-eyes,
  stiletto, stone-tower, swan, teapot, tower-fall, wasp-sting, wolf-howl
- **DarkZaitzev** (4 icons): apothecary, catch, cauldron, hooded-assassin
- **Catsu**: broken-arrow
- **Pepijn Poolman**: elven-castle
- **GeneralAce135**: fingers-crossed
- **Willdabeast**: round-shield
- **various artists** (the name is on the icon's page): salmon,
  <https://game-icons.net/1x1/various-artists/salmon.html>

Every banner made with these icons is under the same licence, CC BY 3.0.
The tool that draws them is `tools/banners/make_banners.py`.

### Oryx Design Lab, 16-bit Fantasy: `public/assets/oryx/`
© Oryx Design Lab, <https://oryxdesignlab.itch.io/16-bit-fantasy>. The pack comes with a royalty-free licence
for use in games, commercial ones included. It doesn't allow the sprite sheets to be redistributed as a pack.
Bought by Ribo.

### Night sky: `public/assets/n1-top@3x.png`
By FalcoSun Kft. (falcosun.com), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
This is from `public/assets/attribution.txt`, which was committed together with this file.

### Scáthach's mountain background
By Craftpix Studio, <https://craftpix.net/categorys/game-backgrounds/>, under the Craftpix licence.
**?** Which files are these? Most likely `skye2.png`, the mountain.

### Inventory icons: `public/assets/inventory/A_Armour02.png`, `P_Blue04.png`, `W_Bow02.png`, `W_Bow17.png`
These appear to be from "496 pixel art icons for medieval/fantasy RPG" by Henrique Lazarini (7Soul1),
<https://opengameart.org/node/39455>. The file names and the 34×34 size match. **?** The licence, which I
believe is CC0, needs checking on that page.

### Made for Corra
- `public/assets/tigh/`: Conall's house, painted in code (`js/game/scenes/locations/skye/tighRoom.js`).
- `public/assets/countyMaps/`: redrawn from na-ring-gael's county maps (`tools/county-maps/`).

---

## Fonts

| File | Font | Author | Licence |
|---|---|---|---|
| `fonts/courierPrime.ttf` | Courier Prime | Alan Dague-Greene, © 2013 Quote-Unquote Apps | [SIL OFL 1.1](https://openfontlicense.org): free to use and redistribute. The licence is in `fonts/CourierPrime-OFL.txt`. |
| `fonts/IrishPenny.ttf` | Irish Penny | Keith Bates, © 2016 K-Type | **Needs a licence.** The free version is for personal use only. Per K-Type's FAQ, webfont and business use need a K-Type licence ([k-type.com](https://www.k-type.com/faqs/)). |
| `fonts/aonchlo.ttf` | Aonchló GC | Vincent Morley, Gaelchló, © 2003–16 | **Needs permission.** See below. |
| `fonts/urchlo.ttf` | Úrchló Rómhánach GC | Vincent Morley, Gaelchló, © 1996–2015 | **Needs permission.** See below. |

**The Gaelchló fonts.** Their licence is embedded in the font files:

> This font may NOT be distributed by any means whatsoever unless permission is first obtained from Gaelchló.
> It may be used free of charge for the publication of any material in a Celtic language, and of
> non-commercial material in any other language.

Using the fonts for Corra's Irish text is fine. Putting the `.ttf` files on a web server or in a public
repository counts as distributing them, which needs Gaelchló's permission. Ask through
[gaelchlo.com](http://www.gaelchlo.com), or replace these fonts.

---

## Sound

| File | Source | Licence |
|---|---|---|
| `sounds/pumpkin_break_01.ogg` | "Breaking a special pumpkin", kddekadenz, 2012 (OpenGameArt) | CC0 (named in the file's own tags) |
| `sounds/arrowShoot1–3.wav`, `equipJewelry.wav`, `metalSwoosh1/2/4.wav` | Alan McKinney (named as artist and copyright holder in the files' tags) | **?** Which pack are these from? |
| `sounds/creak1.wav` | **?** | **?** |
| `sounds/parry.mp3`, `parry.ogg` | **?** | **?** |

---

## Still to trace

These are in use, and their origin isn't recorded anywhere I could find: not in the files' metadata, the
commit messages, or na-ring-gael. Many were last saved in GIMP, which shows they were edited, not who drew them.
Most came from [OpenGameArt](https://opengameart.org); for each, record the page, the artist and the licence here.

- **Paintings**: `skies/skye.png`, `skies/bog_threshold_sky.png`, `shadowHill.png`.
  These look like photographs of 17th–19th-century landscape oil paintings. If so, the paintings are in the
  public domain. Even so, it's good practice to credit the painter and the museum, and some museums require it.
- **Characters**: `champions/champions0.png`, `champions-no-kit.png`, `champions-with-kit.png`, `npcs/*.png`,
  `muireann.png`, `sc01.png`, `manannan.png`, `nightscape/queen.png`, `nightscape/druid.png`, `dragonFrames.png`.
- **Scenery and things**: `13.png` (the bog tileset), `nightscape/farRidge.png`, `midHeadland.png`,
  `nearForeground.png`, `horse1–4.png`, `harp.png`, `hearth.png`, `boat.png`, `cape.png`, `arrow.png`, `arrow1.png`,
  `log1.png`, `moonTile.png`, `buildings/thatch1–2.png`, `textures/leaves1–2.png`, `fog01.png`.
- **The interface**: `icons/*.png`, `stars/*.png`, `glowCursor.png`, `ciorcal-glass-bg.png`, `bg0.png`, `darkStone.png`,
  `panelBG.png`, `inventory/arrow.png`, `inventory/panel_stone.png`.
- **The flocks**: `gooseFrame1–4.png`, `swal1–3.png`.

## Not used by the game
No code refers to these files, and nothing here records where they came from, so they are candidates for deletion:

`3horses.png`, `Natural.png`, `World01_004_WailingPrince.png`, `bg1.png`, `canopy_test.png`, `cloud0–2.png`, `fog3.png`,
`sc02.png`, `skye0.png`, `skye1.png`, `thresholdMountains.png`, `thresholdMountains_fixed.png`,
`skies/bog_threshold_sky_portrait.png`, `skies/bog_threshold_sky_tall.png`, `buildings/wall1–3.png`, `textures/leaves3.png`,
`targets/target0–7.png`, `inventory/slot_equipped-test.png`, `inventory/slot_inventory-test.png`,
`sounds/lakeland1–4.mp3`, `sounds/lakeland6.mp3`.
