// b0.js -- village content: the people of the ráth.
// Location: public/data/bog/b0.js
//
// ============================================================================
// BEAT 4 of the cold open: the ráth.
// ============================================================================
//
// MÓR is a fixedEncounter, not an npc. The `npcs` array cycles flat lines with
// no options, no `requires` and no notes -- fine for background villagers,
// useless for a scene that has to react to what happened on the estuary.
// fixedEncounters get the whole dialogue system, and b0 does not override
// createObjects(), so they work here unchanged.
//
// WHAT THIS SCENE HAS TO DO
//   * close q_baile visibly. The quest already flips to 'complete' on arrival
//     (b0.js onEnter), but nothing in the world acknowledged it. Mór is that
//     acknowledgement.
//   * prove the notes-and-reactions pattern across scenes. `knows_muireann`
//     was set on a headland an hour ago and changes a line here. That is the
//     first time a flag crosses a map boundary, and it is the pattern every
//     later scene copies.
//   * be ORDINARY. No fuss, no wonder, no recognition. Hospitality was a legal
//     obligation, not a favour -- a briugu who turned a traveller away lost
//     rank -- so Mór's warmth is simply how things are done. That flatness is
//     what protects the prophecy irony: the answer to a prophecy walks in and
//     is treated like any wet traveller.
//   * NOT be uneasy. She has nothing to hide tonight. The player should only
//     realise in hindsight that she had been careful. Unease before the satire
//     tips the hand.
//
// THE FIRE EXCHANGE (nodes 2-4) is the teacht drill: tar / tiocfaidh mé / tar
// mar sin / táim ag teacht / feicim go bhfuil. Five lines, one verb, four
// forms, and the meaning is never in doubt -- a conjugation drill wearing a
// joke. It also licenses the register: the game shows it knows its own idiom
// is a bit much. Use it ONCE. Never wink again.
//
// NOTES SET HERE
//   met_mor              -- she exists
//   mor_knows_muireann   -- the two of them are connected in the player's mind
//   at_the_fire          -- accepted the seat. The sleep/dream beat should
//                           require this.
//   knows_seadna_coming  -- told there is a bard in the hall tonight. Set
//                           deliberately flatly: it should read as "there's
//                           entertainment", not as a warning.

export const b0Content = {

  fixedEncounters: [
    {
      id: 'mor',
      name: 'Mór',
      // BESIDE the hall door, not on it. Door proximity takes precedence
      // over encounter proximity (checkProximityInteractions returns early
      // when a door is in range), so an NPC sharing the door's tile can
      // never be spoken to -- the door badge wins every frame.
      // HOLDING POSITION. She was at (34,26), beside the old
      // hut door at (36,26), which no longer exists. She
      // belongs inside the hall greeting on entry -- this is just
      // somewhere reachable until that mechanism is built.
      x: 30, y: 23,
      radius: 3,
      // Placeholder art -- she wants her own. `portrait` loads by URL and
      // fails loudly; the GID tile path fails silently, so always set both.
      visual:   { gid: 9103, flat: false },
      portrait: '/assets/npcs/muireann.png',

      dialogues: [

        // ── 0. Arrival ──────────────────────────────────────────────────
        // Wet, tired, unannounced, and nobody makes anything of it.
        {
          note: 'met_mor',
          ga: 'Tar isteach as an bhfearthainn. Tá tú fliuch go craiceann.',
          en: 'Come in out of the rain. You are wet to the skin.',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              // The cross-scene payoff. Not a passport -- small talk. She
              // registers it and moves on, which is the point: the note
              // earns recognition of a person, not a privilege.
              ga: 'Muireann a chuir anseo mé', en: 'Muireann sent me',
              requires: { note: 'knows_muireann' },
              note: 'mor_knows_muireann',
              hold: false,
              say:   'Muireann a chuir anseo mé. An bhean ar an gcarraig ag béal na habhann.',
              sayEn: 'Muireann sent me. The woman on the rock at the mouth of the river.',
              replyGa: 'Á. Tá sí ar an gcarraig sin fós, mar sin. Suigh síos.',
              replyEn: 'Ah. She is still on that rock, so. Sit down.',
            },
            {
              // The same beat for a player who never met her, or never got
              // her name. Nothing is gated behind Muireann.
              ga: 'Tá mé ag taisteal', en: 'I am travelling',
              requires: { noteAbsent: 'knows_muireann' },
              hold: false,
              say:   'Tá mé ag taisteal siar. Ní raibh mé anseo riamh cheana.',
              sayEn: 'I am travelling west. I have never been here before.',
              replyGa: 'Bíonn daoine ag dul siar. Suigh síos.',
              replyEn: 'People do be going west. Sit down.',
            },
            {
              ga: 'Cé tú féin?', en: 'Who are you?',
              first: true,
              replyGa: 'Mór. Is liomsa an teach seo -- nó is liom é nuair nach mbíonn an taoiseach ann, agus is annamh a bhíonn.',
              replyEn: 'Mór. This house is mine -- or it is mine when the chieftain is not in it, and he seldom is.',
            },
            { ga: 'Slán', en: 'Farewell', exit: true, silent: true },
          ],
        },

        // ── 1. Food ─────────────────────────────────────────────────────
        // Given, not negotiated. He offered to work for it on the estuary;
        // here nobody even raises the question.
        {
          ga: 'Tá anraith ann, agus arán. Ith.',
          en: 'There is soup, and bread. Eat.',
          options: [
            {
              ga: 'Go raibh maith agat', en: 'Thank you',
              hold: false,
              say:   'Go raibh maith agat. Ní raibh oiread agus sáil aráin agam le dhá lá.',
              sayEn: 'Thank you. I have not had so much as a heel of bread these two days.',
              replyGa: 'Ná habair é. Sin mar a bhíonn sé anseo.',
              replyEn: 'Do not mention it. That is how it is here.',
            },
            {
              ga: 'Cad atá le díol agam?', en: 'What do I owe?',
              hold: false,
              say:   'Cad atá le díol agam? Oibreoidh mé ar a shon, más gá.',
              sayEn: 'What do I owe? I will work for it if needs be.',
              replyGa: 'Oibreoidh tú, an ea? I dteach s\'agamsa? Ith do chuid.',
              replyEn: 'You will work, is it? In my house? Eat your food.',
            },
          ],
        },

        // ── 2-4. The fire ───────────────────────────────────────────────
        // The teacht drill. One verb, four forms, meaning never in doubt.
        // Nodes rather than options-within-a-node so each line gets its own
        // card and the rhythm lands. USE ONCE -- see the header.
        {
          ga: 'An dtiocfaidh tú chun na tine?',
          en: 'Will you come to the fire?',
          options: [
            {
              ga: 'Tiocfaidh', en: 'I will come',
              hold: false,
              say:   'Tiocfaidh mé chun na tine.',
              sayEn: 'I will come to the fire.',
            },
          ],
        },
        {
          ga: 'Tar, mar sin.',
          en: 'Come, then.',
          options: [
            {
              ga: 'Táim ag teacht', en: 'I am coming',
              hold: false,
              say:   'Táim ag teacht.',
              sayEn: 'I am coming.',
            },
          ],
        },
        {
          ga: 'Feicim go bhfuil.',
          en: 'I see that you are.',
          note: 'at_the_fire',
          options: [
            {
              // The hero punctures it, and the game admits its own idiom is
              // a bit much. This is the licence; do not spend it twice.
              ga: 'Ní gá é a insint', en: 'There is no need to narrate it',
              hold: false,
              replyGa: 'Ha! Suigh síos, a stróinséir, agus bí i do thost.',
              replyEn: 'Ha! Sit down, stranger, and be quiet.',
            },
          ],
        },

        // ── 5. The hub ──────────────────────────────────────────────────
        // Where she stays for the rest of the evening. The bard is mentioned
        // FLATLY -- entertainment, not warning. She has nothing to hide
        // tonight, and the player should only realise in hindsight that she
        // had been careful.
        {
          hold: true,
          ga: 'Tá an tine agat, agus do bholg lán. Ná bí ag corraí.',
          en: 'You have the fire, and your belly is full. Do not be stirring.',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              ga: 'An bhfuil scéal ann?', en: 'Is there news?',
              first: true,
              note: 'knows_seadna_coming',
              say:   'An bhfuil scéal ar bith sa teach seo?',
              sayEn: 'Is there any news in this house?',
              replyGa: 'Tá file againn le trí seachtaine. Beidh sé ag gabháil fhoinn anocht. Fan go gcloisfidh tú é.',
              replyEn: 'We have a poet these three weeks. He will be singing tonight. Wait until you hear him.',
            },
            {
              ga: 'Cé hé an taoiseach?', en: 'Who is the chieftain?',
              first: true,
              say:   'Cé hé an taoiseach anseo? Cé leis an talamh seo?',
              sayEn: 'Who is the chieftain here? Whose land is this?',
              replyGa: 'Fionnbarra. Bíonn sé sa halla níos mó anois ná mar a bhíodh.',
              replyEn: 'Fionnbarra. He is in the hall more now than he used to be.',
            },
            {
              ga: 'Chonaic mé fear ar an mbóthar', en: 'I saw a man on the road',
              requires: { note: 'met_briugu' },
              first: true,
              say:   'Chonaic mé fear ar an mbóthar, agus é ag imeacht soir. Ní déarfadh sé cad chuige.',
              sayEn: 'I saw a man on the road, going east. He would not say why.',
              replyGa: '...  Bhí teach aige. Ith do chuid anois.',
              replyEn: '...  He had a house. Eat your food now.',
            },
            { ga: 'Slán go fóill', en: 'Goodbye for now', exit: true, silent: true },
          ],
        },

      ],
    },
  ],

  // ── Background villagers ───────────────────────────────────────────────
  // Still plain npcs: flat cycling lines, no options. Fine for texture.
  npcs: [
    {
      id: 'cormac',
      name: 'Cormac',
      // Was (28,21) -- which became the hall's door tile exactly,
      // so the door badge won every frame and he could never be
      // spoken to. See the note on Mór above about door proximity
      // taking precedence. DOOR_RADIUS_TILES is 2.0.
      x: 24, y: 25,
      visual: { color: '0x8b5a2b', radius: 16 },
      dialogues: [
        { ga: 'Is fada ó tháinig aoi chugainn. Fáilte go dtí an ráth.',
          en: 'It is long since a guest came to us. Welcome to the ráth.' },
        { ga: 'Bhí an baile seo anseo roimh mo sheanathair féin.',
          en: 'This place was here before my own grandfather.' },
      ],
    },
    {
      id: 'niamh',
      name: 'Niamh',
      x: 23, y: 20,
      visual: { color: '0xd9a441', radius: 12 },
      dialogues: [
        // Worth knowing: this line already names the heron, months before
        // anyone planned it. If the player told Muireann they would go as
        // one, a gated variant of this would be the cheapest possible
        // payoff for invoked_heron.
        { ga: 'An bhfaca tú an corr éisc thíos ag an abhainn? Chonaic mise í!',
          en: 'Did you see the heron down at the river? I saw her!' },
        { ga: 'Deir Sadhbh go bhfuil na daoine maithe sa choill. Ná habair léi go ndúirt mé é.',
          en: 'Sadhbh says the good people are in the wood. Don\'t tell her I said it.' },
      ],
    },
  ],

  objects: [],
  introNarrative: [],
}

