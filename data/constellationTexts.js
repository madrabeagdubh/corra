
export const constellationTexts = {

    // ── Cú na Féinne — The Hound of the Fianna (Orion) ──────────────────────
    // Opening: the druid has been watching all night. His first reading is grim.
    cu: {
        waiting: [
            {
                ga: 'Tríd oichí fada gan codladh a bhanríonn, tá córthaí na spéire cúrtaithe agam',
                en: 'Through long and sleepless nights o queen, I have searched the signs of the sky.',
                speaker: 'druid',
            },
            {
                ga: 'Éist go maith le mo léamh!',
                en: 'Heed well my reading.',
                speaker: 'druid',
            },
        ],
        completion: [
            {
                ga: 'Féach Cú na Féinne, anocht ag drannadh fiachal',
                en: 'See the hound of the fianna, tonight he snarls',
                speaker: 'druid',
            },
        ],
    },

    // ── An Naomhóg — The Currach (Cassiopeia) ───────────────────────────────
    // The queen presses for more. The druid reads the sea signs.
    naomhog: {
        waiting: [
            {
                ga: 'Agus ar muir? Cad deir bealach na Bó Finne, a Chonaill na súile géire?',
                en: 'And at sea? What says the river of heaven, o keen-eyed wolf?',
                speaker: 'queen',
            },
        ],
        completion: [
            {
                ga: 'Corraíonn slua na Fomhóraigh faoín naomhóg.',
                en: 'The Fomorian host stirs beneath the curragh.',
                speaker: 'druid',
            },
            {
                ga: 'Leathaíonn Tethra tiarnas sa dorchadas.',
                en: 'Tethra spreads his dominion in the darkness.',
                speaker: 'druid',
            },
        ],
    },

    // ── An Carr Mór — The Great Chariot / Ursa Major ────────────────────────
    // The queen searches desperately for any champion among the stars.
    carr: {
        waiting: [
            {
                ga: 'Feach an carr ar an bóthar dubh! Geal an réalt ó Thúaidh, scíath na féine. Geal an cú-dornchla a lionnrann ar thaobh ',
                en: 'Behold the chariot on the dark road! Bright the fenian shield among the northern stars, Bright the hound-hilt gleaming at their side. ',
                speaker: 'queen',
            },
            {
                en: 'Tethra will grieve to see that burning point Rise above the hilltops cold and far.',
                ga: 'Beidh brón ar Tethra an splanc úd, ag éirí go bán os cionn na gcnoc cianta.',
                speaker: 'queen',
            } 
        ],
        completion: [
           {
                ga: 'Ní thugan insint an scéal searabh sásamh dom, ach eiríonn an Torc faoi réalt dearg, ',
                en: 'I am not glad to say a thing so bitter, but the Boar does rise with war,',
                speaker: 'druid',
            
                ga: 'Feicim taoisigh fomhórach cogairsithe, dúr agus ulamh.',
                en: 'The Fomorian chiefs are marshalled, grim and ready.',
                speaker: 'druid',
            },
            {
                ga: 'Tá teaghlach Tethra anchumtha ag eirí ó cathaoiracha báite, ní beidh rath ar chaith faoí realt dearg na Toirce. ',
                en: 'Ill shaped are Tethra\'s kin, Rising from sunken thrones; And war beneath the Boar\'s red rising is doomed.',
                speaker: 'druid',
            },
        ],
    },

    // ── Cúirt Fhomhóir — The Court of Fomor (Corona Borealis) ───────────────
    // The full Fomorian court is revealed.
    cuirt: {
        waiting: [
            {
                ga: 'Tá faitíos ort a dhraoí! An deanfainn umhlú go talamh meas tú? Mar beith gheal lá stoirme?',
                en: 'Frightened druid! Think ye I shall bend my neck like birch on a stormy day?',
                speaker: 'queen',
            },
            {
                ga: 'An amhlaidh go leagfainn an Chraobh Rua ag cosa naimhde? ',
                en: 'That I who hold the red branch would lay it at the feet of foes?',
                speaker: 'queen',
            }
        ],
        completion: [
            {
                ga: 'Ní dhéanaim tarcaisne don Chraobh Rua, ná dá ceannaireacht.',
                en: 'I cast no scorn upon the branch, nor on the chiefs who lead it.',
                speaker: 'druid',
            },
            {
                ga: 'Seacht réalta ina bhfinnéithe ar an tuar dorcha.',
                en: 'But seven stars stand witness to the dark foretelling:',
                speaker: 'druid',
            },
            {
                ga: 'Feicim cúirt ár mbith-naimhde, agus gach suíochán lán.',
                en: 'I see the court of Tethra, and every seat is full.',
                speaker: 'druid',
            },
        ],
    },

    // ── An Draoi — The Druid (Boötes) ───────────────────────────────────────
    // The druid's full verdict. The queen's defiant answer.
    draoi: {
        waiting: [
            { ga: 'Geal, cruinneach na hoíche', en: 'Bright the vault of night', speaker: 'queen' },
            { ga: 'Chíor mé shúile soir faoi bhrón, Siar chomh maith, is os mo chionn;', en: 'Eastward I sweep mine eyes in grief, Westward too and over-head;', speaker: 'queen' },
            { ga: 'Cá bhfuil dóchas i measc na húisle, a Chonaill dhíl?', en: 'Where among the high-placed ones o faithful wolf, Dwells a sign of hope?', speaker: 'queen' },
            { ga: 'Níl teachtaireacht ar muir ná i dtír, An bhfuil na spéartha chomh balbh?', en: 'Sea and land have given none; Shall not heaven hear my need?', speaker: 'queen' },
        ],
        completion: [
            {
                ga: 'Fan. Fan. Ná caoin go fóil',
                en: 'Hold. Hold. Let not thy voice rise further.',
                speaker: 'druid',
            },
            {
                ga: 'Tá neach sa spéir anocht,Nach raibh ann aréir.',
                en: 'There is a thing upon the sky this night That was not there the night before.',
                speaker: 'druid',
            },
            {
                ga: 'Feicim réalta anaithnid dom le linn mo bhlianta faire, ag éirí in aice le Cláirseach na bhFlaitheas.',
                en: 'A star unknown to me in all my years of watching, Rises beside the Harp of heaven. ',
                speaker: 'druid',
            },
            {
                ga: ' Tabhair faoi deara an réalta seo in aice na Cláirsí. Tá neach ag teacht le ainm nach bhfuil ráite, laoch roimh nar chan aon bard fáilte.',
                en: 'Mark this unknown star beside the Harp. There is one coming whose name is not yet told us, a hero unsung as yet by any bard.',
                speaker: 'druid',
            },
             {
                ga: 'Cé, a Chonaill? Cé ar a lonraíonn an réalt anaithnid?',
                en: 'Then who, o wolf? Upon whom does the strange star shine?',
                speaker: 'queen',
            },
            {
                ga: 'Sin críoch mo léargais, a bhanríon. Tá an chuid eile i ndán dúinn.',
                en: 'I have hidden nothing o queen. The rest is our destiny.',
                speaker: 'druid',
            },
        ],
    },


};

