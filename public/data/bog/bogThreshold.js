// Content for bog_threshold — objects, NPCs, introNarrative
// Edit here freely without touching map geometry

export const bogThresholdContent = {
  introNarrative: [
    { ga: 'Sheas mé ag an teorainn.', en: 'I stood at the boundary.' },
    { ga: 'Ar thaobh amháin — an domhan a bhí ar eolas agam. Ar an taobh eile — an portach.', en: 'On one side — the world I knew. On the other side — the bog.' },
    { ga: 'Bhí na cloigne ag faire. Ní dúirt siad tada.', en: 'The skulls were watching. They said nothing.' },
  ],

  objects: [
    {
      id: 'skull_north', type: 'examine', x: 14, y: 12,
      text: {
        ga: 'Cloigeann mór. Cuireann sé faitíos ort. Tá súile air nach bhfuil ann.',
        en: 'A great skull. It unsettles you. It has eyes that are not there.',
      },
    },
    {
      id: 'skull_south', type: 'examine', x: 14, y: 16,
      text: {
        ga: 'An dara cloigeann. Tá siad ag féachaint ar a chéile thar an gconair.',
        en: 'The second skull. They are looking at each other across the path.',
      },
    },
    {
      id: 'path_end', type: 'examine', x: 6, y: 14,
      text: {
        ga: 'Tá an cosán ag imeacht faoin bportach. Níl aon slí ar ais feicthe agam.',
        en: 'The path disappears into the bog. I can see no way back.',
      },
    },
    {
      id: 'standing_stone', type: 'examine', x: 10, y: 14,
      text: {
        ga: 'Cloch ard. Tá sí níos sine ná cuimhne.',
        en: 'A tall stone. It is older than memory.',
      },
    },
  ],

  npcs: [
  ],
}

