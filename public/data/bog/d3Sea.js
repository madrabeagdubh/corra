// d3Sea.js -- content for the estuary map (mouth of the Boyne).
// Location: public/data/bog/d3Sea.js
//
// ============================================================================
// MUIREANN -- the cold open's one speaking part.
// ============================================================================
//

export const d3SeaContent = {
  npcs: [],
  objects: [],
introNarrative: [
  {


	  ga: 'Seacht lá\n\nSeacht lá óna d\'fhág mé \n\nOileán an Cheo\n\nsíos Caol Muile\n\nlena fhallaí carraigracha \n\na chlaonann isteach go naimhdreach\n\nansin trasna Mhuir Mhaoil\n\nThar Latharna\n\nThar scornach fhairsing Loch Cuan\n\nthar ghuaillí dorcha Chairlinn\n\nTimpeall ar Chuailnge:\n\nsmig thaoisigh uasail\n\nag ghoba amach sa mhuir\n\ngan ghealladh\n\nisteach liom ar dheireadh\n\nuiscí níos socaire\n\nAn é seo an áit?\n\nD\'fhéadfadh gur í an Bhóinn í\n\nD\'fhéadfadh gur í an Bhóinn í',
	  en: 'Seven days\n\nSeven days since I left \n\nthe isle of Skye\n\ndown the narrow Sound of Mull\n\nwith it\'s rocky walls \n\nleaning close as enemies\n\nThen across the Sea of Moyle\n\nPast Larne\n\nPast the wide throat of Strangford\n\npast Carlingford\'s dark shoulders\n\nAnd round Cooley:\n\nthe chin of a noble chieftain\n\njutting out into the sea\n\nwithout surrender\n\nat last I enter\n\ncalmer waters\n\nIs this the place?\n\nIt may be the Boyne\n\nIt may be the Boyne'

  }
],
  fixedEncounters: [
    {
      id: 'muireann',
      // PLACEMENT -- (13,1) is the crest of the north headland, h=1.44, the
      // highest tile in the column. (13,2) below it is gid 731 waterside --
      // the sloping face -- which is why she read as standing partway down
      // the cliff rather than on top of it.
      x: 13, y: 1,
      // RADIUS -- she is 17 rows north of the player's lane (row 18), so the
      // numbers are forced: 18 covers lane columns 8-18, 20 covers 21 tiles
      // of it. She is the first NPC in the game and being sailed past is the
      // worse failure. A lookout shouting down from a headland carries.
      //
      // The cleaner fix is a map edit: bring the lane north so she is 6-8
      // rows off it, then drop this to 8. Note entries.east has
      // yFromSource:true, so the arrival row is inherited from d3OpenSea's
      // exit, not set here.
      radius: 3,
      // yOffset nudges her up the hill, in billboard heights. The foot of a
      // billboard sits on the tile's SOUTH edge, which on a crest lands at
      // the break of slope rather than on top. Negative = higher.
      visual:   { gid: 9101, flat: false, yOffset: -0.18 },
      portrait: '/assets/npcs/muireann.png',

      dialogues: [

        // ── node 0 — the meeting ──────────────────────────────────
        {
          easca: 'playerName',
          eascaMatch: 'knows_own_name',
          continue: true,
          ga: 'Geal an éadan os cionn na maidí\nCé atá ag rámhaíocht go cróga\ni dtreo béal na Bóinne?',
          en: 'Bright the brow above the oars\nWho is it that\'s rowing bravely\ntowards the mouth of the Boyne?',
        },

        // ── node 1 — she answers, knowing the name ────────────────
        {
          requires: { note: 'knows_own_name' },
          continue: true,
          ga: 'Beannacht an chladaigh chugat, {playerVoc}.\nMuireann is ainm dom.',
          en: 'Blessing of the shore to you, {playerVoc}.\nMuireann is my name.',
        },

        // ── node 2 — she answers, not knowing the name ────────────
        {
          requires: { noteAbsent: 'knows_own_name' },
          continue: true,
          ga: 'Ab ea.\nMuireann is ainm dom.',
          en: 'Is that so.\nMuireann is my name.',
        },

        // ── node 3 — the hub ──────────────────────────────────────
        {
          hold: true,
          ga: 'Agus cá bhfuil do thriall?',
          en: 'And where are you bound?',
          again: { ga: 'Bhuel?', en: 'Well?' },
          options: [
            {
              requires: { noteAbsent: 'answered_muireann' },
              note: 'answered_muireann',
              first: true,
              ga: 'Freagair an cheist',
              en: 'Answer the question',
              say: 'Chuig an móna ina gcailltear fir, chuig talamh báite Almhain.',
              sayEn: 'To the bog that drinks men whole, to Allen\'s sunken ground.',
              replyGa: 'Bóthar crua, agus ceann uaigneach.',
              replyEn: 'A hard road, and a lonely one.',
            },
            {
              requires: { noteAbsent: 'answered_muireann' },
              note: 'answered_muireann',
              first: true,
              ga: 'Sraon an cheist',
              en: 'Parry the question',
              say: 'Ní mhíníonn an ghaoth í féin don ghallán.',
              sayEn: 'The wind does not explain itself to the standing stone.',
              replyGa: 'Tá rún i do chroí dod bhrú ar aghaidh, sílim.',
              replyEn: 'Some purpose drives thee, I think.',
            },
            {
              requires: { note: 'answered_muireann', noteAbsent: 'knows_goll' },
              note: 'has_druid_word',
              setQuest: 'q_baile',
              ga: 'Cuir comhairle orm',
              en: 'Advise me',
              say: 'Cad atá le déanamh agam, mar sin?',
              sayEn: 'What am I to do, then?',
              replyGa: 'Téigh ó thuaidh go ráth Fhionnbarra, agus lorg a ghabha, Goll nach gcodlaíonn.\nMá chasann fear dola air ort ar an gcladach, abair go bhfuil d\'ainm ag Muireann an Draoi.',
              replyEn: 'Go north to the ráth of Fionnbarra, and seek his smith, Goll who does not sleep.\nIf his toll-man should meet thee at the strand, say that Muireann the Druid knows thy name.',
            },
            {
              exit: true,
              silent: true,
              ga: 'Fág',
              en: 'Leave',
            },
          ],
        },

      ],
    },
  ],
}


