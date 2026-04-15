// Content for bog_threshold — An Gheata Thoir
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
    {
      id: 'skull_north',
      type: 'examine',
      x: 14, y: 12,
      note: 'saw_skull_north',
      text: {
        ga: 'Cloigeann mór — chomh leathan le cloch tairsí, chomh liath le ceo bogaigh ar maidin Samhna. Tá na súilchairn folmha chomh domhain le go bhféadfaidís báisteach naoi n-oíche a choinneáil, agus coinneoidh. Tá cáith buí-óir leata ar an gcluas-chnámh clé — chomh tendre le póg máthar ar leanbh ina chodladh.\n\nAgus fós. Níl aon tendre ann. Táim cinnte de.',
        en: 'A great skull — her brow as wide as a threshold stone, as grey as bog-mist on a November dawning. The hollow sockets of her eyes are deep enough to hold the rain of nine dark nights, and hold it still. Lichen has set its pale gold blessing across the left cheek-bone, as tender as a mother\'s kiss upon a sleeping child.\n\nAnd yet. There is no tenderness here. I am certain of it.',
      },
    },
    {
      id: 'skull_south',
      type: 'examine',
      x: 14, y: 16,
      note: 'saw_skull_south',
      text: {
        ga: 'An dara cloigeann — suite níos airde, agus é ag claontú beagán, mar fhear a d\'ól go domhain den eorna agus a aimsíonn an ursain ina chomrádaí fiúntach. Ritheann scoilt mhór óna bharr go dtí a ghiall — créacht níos sine ná cuimhne, dorcha istigh mar bhogach geimhridh ag meán oíche.\n\nSan áit a bhfuil a bhealach-mhala ag gobadh amach, rinne fiach dubh a seannead — coróin gharbh de mhaidí dubha, tréigthe anois, óir ní fanann fiach dubh i bhfad ag geata mar seo.\n\nTá an péire acu snaidhmthe le fréamhacha donna — mar a bheadh an talamh féin ag síneadh aníos lena n-éileamh ar ais.',
        en: 'The second skull is set higher, and leans somewhat, as a man leans who has drunk deep of the barley bree and finds the doorpost a worthy companion. One great crack runs from crown to jaw, a wound older than memory, dark within as a winter bog at midnight.\n\nWhere his brow-ridge juts, a raven has made her old nest — a ragged crown of black sticks, abandoned now, for even ravens will not linger long at such a gate as this.\n\nBoth are threaded through with the brown roots of creeping things, as though the very earth has reached upward to reclaim what is hers, and will not be hurried in the taking.',
      },
    },
    {
      id: 'path_end',
      type: 'examine',
      x: 6, y: 14,
      text: {
        ga: 'Rolláilann an portach amach romham, dubh agus ag análú, leathan agus gan deireadh.\n\nNíl aon bhóthar ann tríd an dorchadas sin. Fós, siúlfaidh mé é. Mar a théann an chorr réisc — ciúin agus ar aire.',
        en: 'The bog rolls out before me, black and breathing, wide and endless.\n\nNo road runs through that darkness. Still, I will walk it. As the grey heron goes — quiet and alert.',
      },
    },
    {
      id: 'standing_stone',
      type: 'examine',
      x: 10, y: 14,
      text: {
        ga: 'Seasann Cnocán Uíbh Fhailí uaibhreach, bródúil agus uaigneach thar an inse.\n\nDruidim leis an gcloch. Níl aon rún uirthi. Is rún í féin. Tá sí níos sine ná na hainmneacha uile a tugadh ar an talamh seo.',
        en: 'Where Croghan Hill of Offaly stands lordly, proud and friendless across the waste.\n\nI approach the stone. There is no rune upon it. It is itself the rune. It is older than all the names ever given to this land.',
      },
    }
  ],

  npcs: [
    {
      id: 'skull_north_voice',
      name: 'An Cloigeann Mór',
      x: 14, y: 11,
      visual: { shape: 'circle', radius: 14, color: '0x998877' },
      dialogues: [
        {
          ga: '"Cad é an bláth thú, a rud beag beo, atá fós bán ar ghéag an gheimhridh? Bhíomar cosúil leatsa uair — teas samhraidh, buille croí, rún coinnithe te. Anois is sinne an geata féin.\n\nAbair d\'ainm go fírinneach, óir titfidh ainm bréige a deirtear anseo isteach sa phortach agus caillfear é, agus leanfaidh an té a dúirt é ina dhiaidh, luath nó mall."',
          en: '"What bloom are you, little living thing, that you stand yet white upon the winter\'s bough? We were once as you — a summer glow, a heart\'s pulse, a secret kept warm. Now we are the gate itself.\n\nName yourself truly, for a false name spoken here falls into the bog and is lost, and the one who spoke it follows after, ere long."',
        },
        {
          ga: '"Imigh leat mar sin — agus téigh tríd an sneachta agus tríd an gclochar agus tríd an uisce dubh más gá. Ná glaodh orainn nuair a gheobhaidh tú cad atá uait, ná nuair nach gheobhaidh tú é.\n\nAch abair liom — an doirtear fós an meá? An bhfuil an halla fós te, agus clár an tiarna geal?"',
          en: '"Pass then, and go through snow and sleet and the black water if you must. Do not call back to us when you have found what you seek, nor when you have not.\n\nBut tell me — is the mead still poured? Is the hall still warm, and bright the lord\'s board?"',
        },
        {
          ga: '"Ó gach fear den domhan d\'imigh mé,\nó chara agus ó namhaid, d\'fhág mé slán.\nAch abair liom, a bheo — an doirtear fós an deoch?\nAn bhfuil an halla te, is bord an tiarna geal?"\n\nTá an scoilt feadh a giall ag maolú, is cosúil. Nó sin a cheapann tú.',
          en: '"From all the men of the world I\'ve gone,\nfrom friend and from foe, I have wandered on.\nBut tell me, living one — is the mead still poured?\nIs the hall still warm, and bright the lord\'s board?"\n\nThe crack along her jaw seems, somehow, to soften. Or so you think.',
        },
      ],
    },
    {
      id: 'skull_south_voice',
      name: 'An Cloigeann Scoilte',
      x: 14, y: 17,
      visual: { shape: 'circle', radius: 14, color: '0x776655' },
      dialogues: [
        {
          ga: '"Aye, abair d\'ainm. Agus inis dúinn seo freisin — cad é an lúcháir atá á lorg agat taobh thall den gheata seo?\n\nNí shiúlann aon fhear bóthar an phortaigh thiar ar son pléisiúr uisce fhuar timpeall a rúitíní. Inis dúinn do bhróin, d\'ocras, d\'eachtra gan dóchas — óir is eachtraí gan dóchas iad uilig a thagann go dtí an geata seo. Chonaic mé ag teacht iad le tamall fada."',
          en: '"Aye, name yourself. And tell us this beside — what joy do you seek beyond this gate? For no man walks the bog-road west for the mere pleasure of cold water about his ankles.\n\nTell us your grief, your hunger, your hopeless errand — for all errands that come to this gate are hopeless ones, I find. I have watched them come a long while now."',
        },
        {
          ga: '"Ní raibh mé óg ag fáil bháis, a chara, ní raibh mé ró-aosta ach oiread.\nChuaigh mé tríd an bportach in earrach liath nuair a bhí an leann íseal,\nagus thóg an loch cad a d\'fhág an tsleá agus tharraing síos mé.\n\nThug mé mo chomhairle duit saor in aisce. Féach cé acu is fearr leat."',
          en: '"I was neither young in dying, friend, nor was I very old.\nI crossed the bog in autumn-grey when the drinking-ale was low,\nand the lake took what the spear had spared and pulled me down below.\n\nI give you my counsel free of charge. Choose your road carefully."',
        },
        {
          ga: '"Mo chuisle, mo rún, ise.\nBláth úll cumhra, ise.\nChoinnigh mé a hainm mar ghríosach i mo cliabh,\nagus thug mé liom te go mo scíthfhada fhuar.\n\nNa caoin mé. Ná bí trua dom.\nCuimhnigh amháin — bhí mé ann.\nBhí mé ann."',
          en: '"My heart\'s pulse, my secret, she.\nThe flower of the fragrant apple, she.\nI kept her name like a coal in my chest,\nand carried it warm to my long, cold rest.\n\nGive me no pity. Give me no tear.\nOnly remember — I was here.\nI was here."',
        },
      ],
    },
  ],

}

