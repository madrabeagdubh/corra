
// Content for bog_threshold -- An Gheata Thoir
// The East Gate of the Bog
// Edit here freely without touching map geometry

export const bogThresholdContent = {

  introNarrative: [
    {
      ga: 'Ar deireadh thiar,\ngeata thoir Mhóin Alúine mhóir,\néiríonn mo chroí chomh beag le hubh dreolín\nag an radharc\nÓ, an méid atá romham anois! \nCill Dara agus Uíbh Fhailí \nagus an Mhí agus an tIarmhí \nagus an Longfort,\n agus greidhm ag an Móin orthú mar aon.\nShíl mé gur thuigis fairsingeacht\nmise a chodail faoin spéir oscailte\n mise a shiúil bóithre fada Chonnacht.\nAch níor thuigeas tada,\nfaic na ngrást,\ngo dtí an uair seo.\n\nAch thánaigh mé ar shon chúise,\nCé go slogfadh an portach Allen cnoc, cleas agus cuimhne\nCuir misneach ionam,\néinne,\nóir casann an cosán tríd an fraoch.',
      en: 'At long last,\nthe eastern gate of the great Bog of Allen\nmy heart grows small as a wren\'s egg.\nat the sight\nOh, what stretches before me now!\nKildare and Offaly\nand Meath and Westmeath \nand Longford, \nall held by the bog as one.\nI thought I knew vastness\n I who had slept beneath the open sky\nI who walked the long roads of Connacht.\n But I knew nothing,\nnothing at all,\n till this hour.\n\nBut I have come to pledge a thing most solemn\nThough the bog would swallow Allen, hill, haste and memory.\nOh, put courage in me, \nsomeone,\nfor the path winds through the heather.'
    }
  ],

  objects: [
 ],

  // Fixed encounters -- rendered as PGR billboards, interacted via moon badge.
  // examine objects above provide the descriptive text when walking near.
  // These provide the voice/dialogue cycling via EncounterPanel.

  fixedEncounters: [
    {
      id: 'skull_north_voice',
      x: 14, y: 11,
      visual: { gid: 473, flat: false },
      dialogues: [
        {
          ga: '"Cad é an bláth thú, a rud beag beo, atá fós bán ar ghéag an gheimhridh? Bhíomar cosúil leatsa uair -- teas samhraidh, buille croí, rún coinnithe te. Anois is sinne an geata féin.\n\nAbair d\'ainm go fírinneach, óir titfidh ainm bréige a deirtear anseo isteach sa phortach agus caillfear é, agus leanfaidh an té a dúirt é ina dhiaidh, luath nó mall."',
          en: '"What bloom are you, little living thing, that you stand yet white upon the winter\'s bough? We were once as you -- a summer glow, a heart\'s pulse, a secret kept warm. Now we are the gate itself.\n\nName yourself truly, for a false name spoken here falls into the bog and is lost, and the one who spoke it follows after, ere long."',
        },
        {
          ga: '"Imigh leat mar sin -- agus téigh tríd an sneachta agus tríd an gclochar agus tríd an uisce dubh más gá. Ná glaodh orainn nuair a gheobhaidh tú cad atá uait, ná nuair nach gheobhaidh tú é.\n\nAch abair liom -- an doirtear fós an meá? An bhfuil an halla fós te, agus clár an tiarna geal?"',
          en: '"Pass then, and go through snow and sleet and the black water if you must. Do not call back to us when you have found what you seek, nor when you have not.\n\nBut tell me -- is the mead still poured? Is the hall still warm, and bright the lord\'s board?"',
        },
        {
          ga: '"Ó gach fear den domhan d\'imigh mé,\nó chara agus ó namhaid, d\'fhág mé slán.\nAch abair liom, a bheo -- an doirtear fós an deoch?\nAn bhfuil an halla te, is bord an tiarna geal?"\n\nTá an scoilt feadh a giall ag maolú, is cosúil. Nó sin a cheapann tú.',
          en: '"From all the men of the world I\'ve gone,\nfrom friend and from foe, I have wandered on.\nBut tell me, living one -- is the mead still poured?\nIs the hall still warm, and bright the lord\'s board?"\n\nThe crack along her jaw seems, somehow, to soften. Or so you think.',
        },
      ],
    },
    {
      id: 'skull_south_voice',
      x: 14, y: 17,
      visual: { gid: 527, flat: false },
      dialogues: [
        {
          ga: '"Aye, abair d\'ainm. Agus inis dúinn seo freisin -- cad é an lúcháir atá á lorg agat taobh thall den gheata seo?\n\nNí shiúlann aon fhear bóthar an phortaigh thiar ar son pléisiúr uisce fhuar timpeall a rúitíní. Inis dúinn do bhróin, d\'ocras, d\'eachtra gan dóchas -- óir is eachtraí gan dóchas iad uilig a thagann go dtí an geata seo. Chonaic mé ag teacht iad le tamall fada."',
          en: '"Aye, name yourself. And tell us this beside -- what joy do you seek beyond this gate? For no man walks the bog-road west for the mere pleasure of cold water about his ankles.\n\nTell us your grief, your hunger, your hopeless errand -- for all errands that come to this gate are hopeless ones, I find. I have watched them come a long while now."',
        },
        {
          ga: '"Ní raibh mé óg ag fáil bháis, a chara, ní raibh mé ró-aosta ach oiread.\nChuaigh mé tríd an bportach in earrach liath nuair a bhí an leann íseal,\nagus thóg an loch cad a d\'fhág an tsleá agus tharraing síos mé.\n\nThug mé mo chomhairle duit saor in aisce. Féach cé acu is fearr leat."',
          en: '"I was neither young in dying, friend, nor was I very old.\nI crossed the bog in autumn-grey when the drinking-ale was low,\nand the lake took what the spear had spared and pulled me down below.\n\nI give you my counsel free of charge. Choose your road carefully."',
        },
        {
          ga: '"Mo chuisle, mo rún, ise.\nBláth úll cumhra, ise.\nChoinnigh mé a hainm mar ghríosach i mo cliabh,\nagus thug mé liom te go mo scíthfhada fhuar.\n\nNa caoin mé. Ná bí trua dom.\nCuimhnigh amháin -- bhí mé ann.\nBhí mé ann."',
          en: '"My heart\'s pulse, my secret, she.\nThe flower of the fragrant apple, she.\nI kept her name like a coal in my chest,\nand carried it warm to my long, cold rest.\n\nGive me no pity. Give me no tear.\nOnly remember -- I was here.\nI was here."',
        },
      ],
    },
  ],

  npcs: [],

}

