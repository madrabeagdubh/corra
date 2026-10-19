// courseLines.js
// GENERATED from tools/dialogue/drafts/faicheCourse.dlg by tools/dialogue/course.mjs -- do not edit.
// Edit the draft and recompile:
//   node tools/dialogue/course.mjs tools/dialogue/drafts/faicheCourse.dlg

export const LINES = {
  "meet": {
    "intro": {
      "say": [
        {
          "en": "Óró! Thou art upon thy feet again.",
          "ga": "Óró! Tá tú ar do chosa arís."
        },
        {
          "en": "Art thou ready?",
          "ga": "An bhfuil tú ullamh?"
        }
      ],
      "ask": [
        {
          "en": "I am.",
          "ga": "Tá mé.",
          "value": "on",
          "next": {
            "say": [
              {
                "en": "Good.",
                "ga": "Go maith."
              }
            ]
          }
        },
        {
          "en": "Not yet.",
          "ga": "Ní go fóill.",
          "value": "wait"
        }
      ]
    },
    "stand": [
      {
        "en": "Now. Stand here.",
        "ga": "Anois. Seas anseo."
      }
    ],
    "stance": [
      {
        "en": "Stand as the heron stands.",
        "ga": "Seas ar nós na chorra"
      },
      {
        "en": "Not rigid.",
        "ga": "Ní righin,"
      },
      {
        "en": "Not slack.",
        "ga": "ní bog"
      }
    ],
    "stance2": [
      {
        "en": "Carry thy head as a {prince}.",
        "ga": "Iompair do cloigeann mar {prince}"
      },
      {
        "en": "easy, unheld.",
        "ga": "go socair, gan srian"
      },
      {
        "en": "Let thine eyes be soft.",
        "ga": "Bíodh do shúile bog"
      },
      {
        "en": "Let thy watching be boundless.",
        "ga": "Bíodh do fhaire gan teorainn"
      }
    ]
  },
  "space": {
    "intro": [
      {
        "en": "Move.",
        "ga": "Gluais."
      }
    ],
    "good": [
      {
        "en": "Again.",
        "ga": "Arís."
      }
    ],
    "mid": [
      {
        "en": "There.",
        "ga": "Sin é."
      },
      {
        "en": "Now press me,",
        "ga": "Anois brúigh síar mé,"
      },
      {
        "en": "until I am brought to my knee.",
        "ga": "go dtí go mbeidh mé ar mo ghlúin."
      }
    ],
    "shoveGo": [
      {
        "en": "Come, then.",
        "ga": "Ar aghaidh, mar sin."
      },
      {
        "en": "Knock me down.",
        "ga": "Leag mé."
      }
    ],
    "shoved": [
      {
        "en": "Again.",
        "ga": "Arís."
      }
    ],
    "after": [
      {
        "en": "There it is.",
        "ga": "Sin agat é."
      },
      {
        "en": "Poor footing, half the battle.",
        "ga": "Droch-sheasamh, leath an chatha."
      }
    ]
  },
  "sword": {
    "intro": [
      {
        "en": "Now.",
        "ga": "Anois."
      }
    ],
    "caught": [
      {
        "en": "a chieftain unrisen is,",
        "ga": "Taoiseach suan is ea"
      },
      {
        "en": "The sword in its sheath",
        "ga": "an claíomh sa truaill"
      },
      {
        "en": "All his strength is there,",
        "ga": "Ann atá a neart,"
      },
      {
        "en": "his fury,",
        "ga": "a chaon-fhearg,"
      },
      {
        "en": "the grief",
        "ga": "an brón"
      },
      {
        "en": "he might bring upon his enemies.",
        "ga": "a d'fhéadfadh sé imirt ar a naimhde"
      },
      {
        "en": "Do not wake it without cause.",
        "ga": "Ná mhúscail é gan cuais."
      }
    ],
    "draw": [
      {
        "en": "Draw now.",
        "ga": "Tarraing anois."
      }
    ],
    "sheathe": [
      {
        "en": "The returning of the blade is not lesser than the drawing.",
        "ga": "Ní lú é filleadh an chlaímh ná a tharraingt."
      },
      {
        "en": "Sheathe it.",
        "ga": "Truaill é."
      }
    ],
    "sheathed": [],
    "drawn": []
  },
  "calls": {
    "intro": [
      {
        "en": "Now we salute.",
        "ga": "Beannaímid anois"
      },
      {
        "en": "Hilt to the brow.",
        "ga": "Dornchla chun an éadain."
      },
      {
        "en": "Blade to the sky.",
        "ga": "Lann chun an spéire."
      },
      {
        "en": "Point to the earth.",
        "ga": "Rinn chun na talún."
      },
      {
        "en": "Salute within,",
        "ga": "Beannaigh istigh,"
      },
      {
        "en": "salute in the heart.",
        "ga": "beannaigh sa chroí."
      },
      {
        "en": "I salute to say",
        "ga": "Beannaighím chun rá"
      },
      {
        "en": "What blood I spill here,",
        "ga": "Cibé fuil a dhoirtim anseo,"
      },
      {
        "en": "I do so with open eyes.",
        "ga": "déanaim sin le lán thuiscint."
      }
    ],
    "salute": [
      {
        "en": "Salute.",
        "ga": "Beannaigh."
      }
    ],
    "again": [
      {
        "en": "Again.",
        "ga": "Arís."
      }
    ],
    "enough": [
      {
        "en": "It will do.",
        "ga": "Is leor sin."
      }
    ]
  },
  "fatigue": {
    "intro": [
      {
        "en": "Come against me.",
        "ga": "Tar i mo choinne."
      },
      {
        "en": "Use thy full weight.",
        "ga": "Bain úsáid as do mheáchan ar fad."
      },
      {
        "en": "Press hard.",
        "ga": "Brúigh go laidir."
      },
      {
        "en": "Again.",
        "ga": "Arís."
      },
      {
        "en": "Mark how I do not remain where I was.",
        "ga": "Tabhair faoi deara nach bhfanaim san áit a raibh mé."
      }
    ],
    "stop": [
      {
        "en": "Stop.",
        "ga": "Stad."
      }
    ],
    "after": [
      {
        "en": "The tide comes.",
        "ga": "Tagann an taoide."
      },
      {
        "en": "It fills the low places.",
        "ga": "Líonann sí na háiteanna ísle."
      },
      {
        "en": "It withdraws.",
        "ga": "cúlíann sé."
      },
      {
        "en": "Thy breath is thy tide.",
        "ga": "Is í do anáil do thaoide."
      },
      {
        "en": "Let it come.",
        "ga": "Lig di teacht."
      },
      {
        "en": "Fill the low places.",
        "ga": "Líon na hísle."
      },
      {
        "en": "Withdraw.",
        "ga": "cúlaigh."
      }
    ],
    "after2": [
      {
        "en": "Let the head of the fearful one",
        "ga": "Bíodh cheann an chlaidhre"
      },
      {
        "en": "fill with chatter.",
        "ga": "lán chainte."
      },
      {
        "en": "Let the thoughts of the boastful one",
        "ga": "Bíodh smaointe an lán de lán"
      },
      {
        "en": "crowd with enemies.",
        "ga": "plódaithe le naimhde."
      },
      {
        "en": "So rises the thought,",
        "ga": "Mar sin a thagann an smaoineamh,"
      },
      {
        "en": "so falls the thought,",
        "ga": "mar sin  a imíonn sé."
      },
      {
        "en": "yet the stone beneath the tide does not move.",
        "ga": "Ní chorraíonn an chloch faoin tíde."
      },
      {
        "en": "Be thou the stone.",
        "ga": "Bíse i do chloch."
      }
    ]
  },
  "dummy": {
    "salute": [
      {
        "en": "Raise thy sword now.",
        "ga": "Ardaigh do chlaímh anois."
      }
    ],
    "saluted": [
      {
        "en": "Good.",
        "ga": "Go maith."
      }
    ],
    "go": [
      {
        "en": "Hold it with sureness.",
        "ga": "Bíodh do greidhm cinnte."
      },
      {
        "en": "Strike at me,",
        "ga": "Tabhair buille dom."
      },
      {
        "en": "swift,",
        "ga": "Bual go gasta."
      },
      {
        "en": "without hesitation.",
        "ga": "Bual go cinnte."
      },
      {
        "en": "Come at me now,",
        "ga": "Tar"
      },
      {
        "en": "let me see what thou canst do.",
        "ga": "taispeáin dom cad atá ionat."
      }
    ],
    "landed": [
      {
        "en": "Thus. Dost thou see?",
        "ga": "Mar sin. An léir duit?"
      }
    ],
    "after": [
      {
        "en": "Look.",
        "ga": "Féach."
      },
      {
        "en": "Rooted as an oak.",
        "ga": "Fréamhaithe mar dhair."
      },
      {
        "en": "No. No.",
        "ga": "Ní hea. Ní hea."
      }
    ]
  },
  "feet": {
    "demo": [
      {
        "en": "Move thus.",
        "ga": "Gluais amhlaidh."
      },
      {
        "en": "And thus.",
        "ga": "Agus amhlaidh."
      }
    ],
    "intro": [
      {
        "en": "Find the Daingean within thyself.",
        "ga": "Aimsigh an daingean ionat féin."
      },
      {
        "en": "It sits low,",
        "ga": "Tá sé suite íseal,"
      },
      {
        "en": "below the navel.",
        "ga": "faoin imleacán."
      },
      {
        "en": "Let thy weight descend to it.",
        "ga": "Scaoil do mheáchan síos chuige."
      },
      {
        "en": "Motion begins there",
        "ga": "Tosaíonn an gluaiseacht ansin."
      },
      {
        "en": "Not from the arm.",
        "ga": "Ní ón géag."
      },
      {
        "en": "Not from the leg.",
        "ga": "Ní ón cos."
      },
      {
        "en": "Not from the clenching jaw.",
        "ga": "Ní ón giall fáscadh."
      },
      {
        "en": "Move as thou dost strike,",
        "ga": "Bual agus tú ag bogadh,"
      },
      {
        "en": "for these are not two separate matters.",
        "ga": "óir ní dhá ábhar eagsúl iad."
      },
      {
        "en": "Woe to him",
        "ga": "Is mairg an té"
      },
      {
        "en": "who remains where the sword expects to find him.",
        "ga": "a fhanann áit a bhfuil claíomh ag súil leis."
      }
    ],
    "go": [
      {
        "en": "Move.",
        "ga": "Bog."
      },
      {
        "en": "Strike.",
        "ga": "Buail."
      },
      {
        "en": "Move again.",
        "ga": "Bog arís."
      },
      {
        "en": "Let them reach for thee and find nothing,",
        "ga": "Lig dóibh tú a lorg áit a raibh tú,"
      },
      {
        "en": "while thy blade is already elsewhere.",
        "ga": "agus do lann in áit eile cheana féin."
      }
    ],
    "still": [
      {
        "en": "Move first.",
        "ga": "Bog ar dtús."
      },
      {
        "en": "Again.",
        "ga": "Arís."
      },
      {
        "en": "Keep moving through the strike.",
        "ga": "Coinnigh ort ag gluaiseacht tríd an mbuille."
      },
      {
        "en": "Through it.",
        "ga": "Tríd."
      }
    ],
    "count": [
      {
        "en": "One.",
        "ga": "A haon."
      },
      {
        "en": "Two.",
        "ga": "A dó."
      },
      {
        "en": "Three.",
        "ga": "A trí."
      },
      {
        "en": "Four.",
        "ga": "A ceathair."
      }
    ],
    "after": [
      {
        "en": "Five.",
        "ga": "A cúig."
      },
      {
        "en": "Step to the side.",
        "ga": "Tóg céim ar leataobh."
      },
      {
        "en": "Press and yield,",
        "ga": "Brúigh agus géill,"
      },
      {
        "en": "This is the nature of the thing.",
        "ga": "Is é seo nádúr an ruda."
      },
      {
        "en": "buail agus tarraing siar.",
        "ga": "strike and withdraw."
      }
    ]
  },
  "drag": {
    "intro": [
      {
        "en": "Now. The movement.",
        "ga": "Anois. An ghluaiseact."
      },
      {
        "en": "When thou must strike,",
        "ga": "Nuair a caithfear buille a thabhairt,"
      },
      {
        "en": "do not think of striking.",
        "ga": "ná smaoinaigh ar an bhuaille."
      },
      {
        "en": "Think of the movement.",
        "ga": "Smaoinigh ar an ghluaiseacht."
      },
      {
        "en": "The strike is what the motion becomes.",
        "ga": "Is é an buille an ghluaisne féin."
      }
    ],
    "following": [
      {
        "en": "See it?",
        "ga": "An bhfeiceann tú?"
      }
    ],
    "you": [
      {
        "en": "Now thy turn.",
        "ga": "Tusa anois."
      }
    ],
    "good": [
      {
        "en": "Again.",
        "ga": "Arís."
      }
    ],
    "after": [
      {
        "en": "Good enough",
        "ga": "Sásúil"
      }
    ]
  },
  "duel": {
    "intro": [
      {
        "en": "there is a place",
        "ga": "Tá áit ann"
      },
      {
        "en": "Between one motion",
        "ga": "idir gluaiseacht amháin"
      },
      {
        "en": "and the next,",
        "ga": "agus an chéad cheann eile."
      }
    ],
    "go": [
      {
        "en": "Now then.",
        "ga": "Anois maise."
      },
      {
        "en": "En garde.",
        "ga": "Ar aire."
      }
    ],
    "won": [
      {
        "en": "Well struck.",
        "ga": "Buaille  maith."
      },
      {
        "en": "But there is a place between;",
        "ga": "Ach tá áit sa troid"
      },
      {
        "en": "thou hast not found it yet.",
        "ga": "nar aimsigh tú fós."
      }
    ],
    "moment": [
      {
        "en": "There! Thou wert there.",
        "ga": "Mar sin! Bhí tú ann."
      },
      {
        "en": "Strike as lightning.",
        "ga": "Buail mar thintreach."
      }
    ],
    "after": [
      {
        "en": "Thou hast the making of it.",
        "ga": "Tá an t-ábhar ionat."
      },
      {
        "en": "Enough.",
        "ga": "Is leor sin."
      }
    ]
  },
  "end": {},
  "generic": {
    "again": [
      {
        "en": "Again.",
        "ga": "Arís."
      }
    ]
  }
}
