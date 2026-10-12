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
        "en": "Stand thus, neither too wide, nor too narrow.",
        "ga": "Seas mar seo, ní ró-leathan, is ní ró-chúng."
      },
      {
        "en": "Stand not on thy heels, nor on thy toes.",
        "ga": "Ná seas ar do shále, ná ar do bharraicíní."
      },
      {
        "en": "Stand upon the ground, if you get me.",
        "ga": "Seas ar an tallamh, a dtuigeann tú."
      },
      {
        "en": "All else is built upon it.",
        "ga": "Sin an bunchloch"
      }
    ]
  },
  "drag": {
    "intro": [
      {
        "en": "Now. The movement.",
        "ga": "Anois. An ghluaiseact."
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
  "space": {
    "intro": [
      {
        "en": "Move. But do not flee.",
        "ga": "Gluais. Ach ná teith."
      },
      {
        "en": "Find space between us.",
        "ga": "Aimsigh spás eadrainn."
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
        "en": "Now press me, until I am brought to my knee.",
        "ga": "Anois brúigh orm, go dtí go mbeidh mé ar mo ghlúin."
      }
    ],
    "shoveGo": [
      {
        "en": "Come, then. Knock me down.",
        "ga": "Ar aghaidh, mar sin. Leag mé."
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
        "en": "There it is. Thou hast done it, and no blade yet drawn between us.",
        "ga": "Sin agat é. D'éirigh leat, gan aon chlaíomh tarraingthe eádrainn fós."
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
    "caught": [],
    "draw": [
      {
        "en": "Draw now.",
        "ga": "Tarraing anois."
      },
      {
        "en": "Too much wrist. Too much shoulder. Art thou pulling a net from the sea?",
        "ga": "An iomarca ón caol. An iomarca ón gualainn. An ag tarraingt líon ón bhfarraige atá tú?"
      },
      {
        "en": "Thy feet! Where are thy feet?",
        "ga": "Do chosa! Cá bhfuil do chosa?"
      },
      {
        "en": "Stand with esteem.",
        "ga": "Seas le gean."
      },
      {
        "en": "Once drawn, the blade does not sheathe itself from fear.",
        "ga": "Nuair a tharraingítear í, ní théann an lann ar ais ina truaill le heagla."
      }
    ]
  },
  "calls": {
    "intro": [
      {
        "en": "Now we salute",
        "ga": "Anois, beannaímid"
      },
      {
        "en": "Salute not to thine enemy's honour.",
        "ga": "Ní chuig honóir do namhaid a bheannaíonn tú."
      },
      {
        "en": "A salute is a word spoken inward, to thyself alone.",
        "ga": "Is é an beannú focal a labhraítear isteach i do chroí féin amháin."
      },
      {
        "en": "I enter with clear mind and clean intent.",
        "ga": "Ar aghaidh liom le aigne ghlan is le intinn soléir."
      },
      {
        "en": "Whatever blood I spill here, I do so with open eyes.",
        "ga": "Cibé fuil a dhoirtim anseo, deanaim sin le shúile oscailte."
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
        "ga": "Déanfaidh sé an gnó."
      }
    ]
  },
  "fatigue": {
    "intro": [
      {
        "en": "Come at me, then.",
        "ga": "Tar orm, mar sin."
      },
      {
        "en": "Strike, strike, strike again.",
        "ga": "Buail, buail, buail arís."
      }
    ],
    "stop": [
      {
        "en": "Stop.",
        "ga": "Stad."
      }
    ],
    "after": {
      "say": [
        {
          "en": "What hast thou taught thyself this hour?",
          "ga": "Cén ceacht a mhúin tú duit féin san uair seo?"
        }
      ],
      "ask": [
        {
          "en": "That I tire.",
          "ga": "Go dtagann an tuirse orm.",
          "value": "on",
          "next": {
            "say": [
              {
                "en": "This is the heart of it.",
                "ga": "Sin é croí na ceiste."
              },
              {
                "en": "Strength is not the gift we seek.",
                "ga": "Ní hí an neart an bua a lorgaimid."
              },
              {
                "en": "We seek the stillness behind the eyes.",
                "ga": "Lorgaimid an t-suaimhneas atá taobh thiar de na súile."
              },
              {
                "en": "The great sin of the Gaelic blade is not cowardice. It is waste.",
                "ga": "Ní hé an t-eagala an peaca ar claíomh na nGael. Is é an cur amú é."
              },
              {
                "en": "Better strike once and truly, rather than ten times in hope.",
                "ga": "Is fearr buille amháin cruinn a bhualadh ná deich mbuille le dóchas."
              }
            ],
            "ask": [
              {
                "en": "I am ready.",
                "ga": "Tá mé réidh.",
                "value": "on"
              },
              {
                "en": "Once more.",
                "ga": "Arís amháin.",
                "value": "again"
              }
            ]
          }
        },
        {
          "en": "That every blow costs.",
          "ga": "Go bhfuil costas ar gach buille.",
          "value": "on",
          "next": {
            "say": [
              {
                "en": "This is the heart of it.",
                "ga": "Sin é croí na ceiste."
              },
              {
                "en": "Strength is not the gift we seek.",
                "ga": "Ní hí an neart an bua a lorgaimid."
              },
              {
                "en": "We seek the stillness behind the eyes.",
                "ga": "Lorgaimid an t-suaimhneas atá taobh thiar de na súile."
              },
              {
                "en": "The great sin of the Gaelic blade is not cowardice. It is waste.",
                "ga": "Ní hé an t-eagala an peaca ar claíomh na nGael. Is é an cur amú é."
              },
              {
                "en": "Better strike once and truly, rather than ten times in hope.",
                "ga": "Is fearr buille amháin cruinn a bhualadh ná deich mbuille le dóchas."
              }
            ],
            "ask": [
              {
                "en": "I am ready.",
                "ga": "Tá mé réidh.",
                "value": "on"
              },
              {
                "en": "Once more.",
                "ga": "Arís amháin.",
                "value": "again"
              }
            ]
          }
        },
        {
          "en": "I do not know.",
          "ga": "Níl fhios agam.",
          "value": "on",
          "next": {
            "say": [
              {
                "en": "This is the heart of it.",
                "ga": "Sin é croí na ceiste."
              },
              {
                "en": "Strength is not the gift we seek.",
                "ga": "Ní hí an neart an bua a lorgaimid."
              },
              {
                "en": "We seek the stillness behind the eyes.",
                "ga": "Lorgaimid an t-suaimhneas atá taobh thiar de na súile."
              },
              {
                "en": "The great sin of the Gaelic blade is not cowardice. It is waste.",
                "ga": "Ní hé an t-eagala an peaca ar claíomh na nGael. Is é an cur amú é."
              },
              {
                "en": "Better strike once and truly, rather than ten times in hope.",
                "ga": "Is fearr buille amháin cruinn a bhualadh ná deich mbuille le dóchas."
              }
            ],
            "ask": [
              {
                "en": "I am ready.",
                "ga": "Tá mé réidh.",
                "value": "on"
              },
              {
                "en": "Once more.",
                "ga": "Arís amháin.",
                "value": "again"
              }
            ]
          }
        }
      ]
    },
    "core": {
      "say": [
        {
          "en": "This is the heart of it.",
          "ga": "Sin é croí na ceiste."
        },
        {
          "en": "Strength is not the gift we seek.",
          "ga": "Ní hí an neart an bua a lorgaimid."
        },
        {
          "en": "We seek the stillness behind the eyes.",
          "ga": "Lorgaimid an t-suaimhneas atá taobh thiar de na súile."
        },
        {
          "en": "The great sin of the Gaelic blade is not cowardice. It is waste.",
          "ga": "Ní hé an t-eagala an peaca ar claíomh na nGael. Is é an cur amú é."
        },
        {
          "en": "Better strike once and truly, rather than ten times in hope.",
          "ga": "Is fearr buille amháin cruinn a bhualadh ná deich mbuille le dóchas."
        }
      ],
      "ask": [
        {
          "en": "I am ready.",
          "ga": "Tá mé réidh.",
          "value": "on"
        },
        {
          "en": "Once more.",
          "ga": "Arís amháin.",
          "value": "again"
        }
      ]
    }
  },
  "strong": {
    "notThus": [
      {
        "en": "Nay, not thus.",
        "ga": "Ní mar sin, ní hea."
      },
      {
        "en": "Not with the arm locked tight as a gate-bar.",
        "ga": "Ní leis an ngéag glasáilte chomh daingean le barra geata."
      },
      {
        "en": "Loose thy wrist.",
        "ga": "Scaoil chaol do láimhe."
      }
    ]
  },
  "dummy": {
    "intro": [
      {
        "en": "Thy wrist. Loosen it. The blade must speak",
        "ga": "Chaol do láimhe. Scaoil é. Caithfidh an lann labhairt ar do shon"
      },
      {
        "en": "and no tongue speaks well",
        "ga": "is ní labhrann aon teanga go maith"
      },
      {
        "en": "through a clenched jaw.",
        "ga": "tríd giall fásctha."
      },
      {
        "en": "Loose it as thou wouldst loose a hound from leash.",
        "ga": "Scaoil é mar a scaoilfeá cú ó iall."
      }
    ],
    "landed": [
      {
        "en": "Thus. Dost thou see?",
        "ga": "Mar seo. An bhfeiceann tú?"
      }
    ],
    "after": {
      "say": [
        {
          "en": "Thy feet betray thee.",
          "ga": "Feallann do chosa ort."
        },
        {
          "en": "Look. Rooted as an oak. No. No.",
          "ga": "Féach. Fastaithe mar dhair. Ní hea. Ní hea."
        },
        {
          "en": "Move thus. And thus.",
          "ga": "Bog mar seo. Agus mar seo."
        }
      ],
      "ask": [
        {
          "en": "I am ready.",
          "ga": "Tá mé réidh.",
          "value": "on"
        },
        {
          "en": "Once more.",
          "ga": "Arís amháin.",
          "value": "again"
        }
      ]
    }
  },
  "feet": {
    "intro": [
      {
        "en": "Tell me this, What use is a fine blade to a standing stone?",
        "ga": "Cén mhaith lann bhreá do chloch sheasaimh?"
      },
      {
        "en": "Move, and move again.",
        "ga": "Gluais, agus gluais arís."
      },
      {
        "en": "Step left when their eye says right.",
        "ga": "Céim ar chlé nuair a deir a súil ar dheis."
      },
      {
        "en": "Step back when their shoulders say forward.",
        "ga": "Céim ar gcúl nuair a deir a nguaillí ar aghaidh."
      },
      {
        "en": "Great the fool who stands to trade blow for blow with the foe of equal iron.",
        "ga": "Mór an amadán a sheasann buille ar bhuille i gcoinne naimhead an comh-iarainn."
      },
      {
        "en": "Woe to him who remains where the sword expects to find him.",
        "ga": "Is mairg an té ag feiteamh áit a bhfuil an lann ag súil leis."
      }
    ],
    "go": [
      {
        "en": "Come at me.",
        "ga": "Tar chugam."
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
      }
    ],
    "after": {
      "say": [
        {
          "en": "Three.",
          "ga": "A trí."
        },
        {
          "en": "Dost thou see? I have not retreated from thee.",
          "ga": "An bhfeiceann tú? Níor chúlaigh mé uait."
        },
        {
          "en": "A man who steps backward loses ground he may never recover.",
          "ga": "An ti a thógas céim ar gcúl, cailleann sé talamh nach ngabhfaidh sé ar ais go deo b'fhéidir."
        },
        {
          "en": "Step to the side. Step to the inside of his blade-arm, and thou art safe while he swings at empty air.",
          "ga": "Tóg céim ar leataobh. Tóg céim chuig taobh istigh dá ghéag claoímh, is tá tú slán fad a bhíonn seisean ag luascadh i gcoinne an taer fholamh."
        }
      ],
      "ask": [
        {
          "en": "I am ready.",
          "ga": "Tá mé réidh.",
          "value": "on"
        },
        {
          "en": "Once more.",
          "ga": "Arís amháin.",
          "value": "again"
        }
      ]
    }
  },
  "duel": {
    "intro": [
      {
        "en": "Now. Thy footwork. Once more.",
        "ga": "Anois. Do shaothar coise. Arís amháin."
      },
      {
        "en": "Heel first. Wrist loose. Step to the inside.",
        "ga": "An tsáil ar dtús. An caol láimhe scaoilte. Tóg céim ar an taobh istigh."
      },
      {
        "en": "Again. From the beginning.",
        "ga": "Arís. Ón tús."
      }
    ],
    "go": [
      {
        "en": "Come at me.",
        "ga": "Tar chugam."
      }
    ],
    "read": [
      {
        "en": "Thy foot is telling me where you are going.",
        "ga": "Tá do chos ag insint dom cá bhfuil do thríal."
      }
    ],
    "after": {
      "say": [
        {
          "en": "Thou hast the making of it.",
          "ga": "Tá an t-ábhar ionat."
        },
        {
          "en": "Enough.",
          "ga": "Is leoir sin."
        }
      ],
      "ask": [
        {
          "en": "Thank you.",
          "ga": "Go raibh maith agat.",
          "value": "on"
        },
        {
          "en": "Again.",
          "ga": "Arís.",
          "value": "again"
        }
      ]
    }
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
