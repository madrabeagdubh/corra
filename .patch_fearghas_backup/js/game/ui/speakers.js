// speakers.js
// Location: js/game/ui/speakers.js
//
// WHO IS SPEAKING, AND IN WHAT COLOUR. One colour per speaker for their Irish
// line, the same wherever they speak: a dialogue card (textPanel), a caption
// over the action (SkyeCaption), a lesson. The English beneath stays neutral:
// it is the translation layer, not a voice.
//
//   inkFor('conall')        -> '#dff2e4'   (null for a speaker with no colour of their own)
//   speakerOf(zone)         -> 'conall'    an encounter zone's speaker: its data 'speaker',
//                                          else its id ('conall_rescue' -> 'conall'), else its sprite
//   inkForZone(zone)        -> the colour, or null
//
// To give someone a colour: add them to INK (and, if their encounters are
// known by sprite, to BY_GID).

export const INK = {
  conall:   '#dff2e4',   // pale mint: the Warden of the garden, steady and plain-spoken
  uathach:  '#fbe3c8',   // pale peach: quick, bright, a little fierce
  narrator: '#d8e8f0',   // pale blue-white: the voice that is no one (hints, the sea crossings)
  player:   '#f5ecc9',   // pale cream-gold: the champion, in cards and captions alike
}

// encounters known by their sprite (Skye's figures: skyeScene SKYE_GID)
const BY_GID = { 9203: 'conall', 9201: 'uathach' }

export const inkFor = name => (name && INK[name]) || null

export function speakerOf(zone) {
  try {
    const named = zone?.getData?.('speaker')
    if (named) return named
    const id = String(zone?.getData?.('id') || '')
    const byId = Object.keys(INK).find(k => id === k || id.startsWith(k + '_'))
    if (byId) return byId
    const gid = zone?.getData?.('visual')?.gid ?? zone?.getData?.('flagVisual')?.gid
    return BY_GID[gid] || null
  } catch (_) { return null }
}

export const inkForZone = zone => inkFor(speakerOf(zone))
