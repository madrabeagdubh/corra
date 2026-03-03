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
                ga: 'Féach Cú na Féinne, ',
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
                ga: 'Leathaíonn Tethra fúair a thiarnas dorcha.',
                en: 'Cold Tethra spreads his dark dominion.',
                speaker: 'druid',
            },
        ],
    },

    // ── An Carr Mór — The Great Chariot / Ursa Major ────────────────────────
    // The queen searches desperately for any champion among the stars.
    carr: {
        waiting: [
            {
                ga: '?',
                en: 'Then they shall meet a host of champions, fierce and full of deeds.',
                speaker: 'queen',
            },
            {
                ga: '   ',
                en: 'And brave the chiefs under my  banner!',
                speaker: 'queen',
            },
        ],
        completion: [
            {
                en: 'Queen, thy men are valiant, bright their deeds in memory, sure their hands in war-craft.',
                ga: '',
                speaker: 'druid',
            },
            {
                ga: ' ',
                en: 'But the Boar does rise with war, And war beneath the Boar\'s red rising is doomed.',
                speaker: 'druid',
            },
        ],
    },

    // ── Cúirt Fhomhóir — The Court of Fomor (Corona Borealis) ───────────────
    // The full Fomorian court is revealed.
    cuirt: {
        waiting: [
            {
                ga: '?',
                en: 'Frightened druid! Think ye I shall bend my neck as birch before the winter storm?',
                speaker: 'queen',
            },
            {
                ga: '?',
                en: 'That I who hold the red branch would lay it at the feet of foes?',
                speaker: 'queen',
            }
        ],
        completion: [
            {
                ga: 'Feicim Cúirt na Fomhórach — ár mbith-naimhde, a bhanríon.',
                en: 'I cast no scorn upon thy gathered lances, Brave the host, and great thy chiefs who lead it.',
                speaker: 'druid',
            },
            {
                ga: 'Seacht réalta ina bhfinnéithe ar an tuar dorcha.',
                en: 'But seven stars stand witness to the dark foretelling:',
                speaker: 'druid',
            },
            {
                ga: 'Agus gach suíochán lán.',
                en: 'The banished king gathers arms of drowned men, and in the court of tethra, every seat is full.',
                speaker: 'druid',
            },
        ],
    },

    // ── An Draoi — The Druid (Boötes) ───────────────────────────────────────
    // The druid's full verdict. The queen's defiant answer.
    draoi: {
        waiting: [
            { ga: '', en: 'Bright the vault of night', speaker: 'druid' },
            { ga: '', en: 'Eastward sweep mine eyes in grief, Westward too and over-head;', speaker: 'druid' },
            { ga: '', en: 'Where among the high-placed ones o faithful wolf, Dwells a sign of mighty deed?', speaker: 'druid' },
            { ga: '', en: 'Sea and land have given none; Shall not heaven hear my need? Shall I weep? Shall I wail?', speaker: 'druid' },
        ],
        completion: [
            {
                ga: '',
                en: 'Hold. Hold. Let not thy voice rise further.',
                speaker: 'druid',
            },
            {
                ga: '',
                en: 'There is a thing upon the sky this night That was not there the night before.',
                speaker: 'druid',
            },
            {
                ga: '',
                en: 'A star unknown to me in all my years of watching, Rises cold and strange beside the Harp of heaven. Mark this unknown star beside the Harp. There is one coming whose name is not yet told us, unsung as yet by any bard.',
                speaker: 'druid',
            },
            {
                ga: '',
                en: 'I will not call it hope, for hope is reckless, But I will say this much and no word further:',
                speaker: 'druid',
            },
            {
                ga: '',
                en: 'I am not glad to say a thing so bitter, That thine armies gather and must turn away. But a stranger thread runs through the loom of battle, And it is that thread alone which will not break. Like a stone cast in the bay of Bantry, So shall one be cast into the sea.',
                speaker: 'druid',
            },
            {
                ga: '',
                en: 'Falling without guidance into the lightless kingdom; One shall cross the dark lord\'s threshold and face what hosts will meet there. That is the omen. My queen, I have nothing more to say.',
                speaker: 'druid',
            },
        ],
    },

    // ── An Torc — The Wild Boar (Scorpius) ──────────────────────────────────
    // The seven omens. The Boar's war-sign confirmed.
    torc: {
        waiting: [
            {
                ga: '?',
                en: '',
                speaker: 'queen',
            },
        ],
        completion: [
            {
                ga: '.',
                en: '.',
                speaker: 'druid',
            },
            {
                ga: '.',
                en: '.',
                speaker: 'druid',
            },
            {
                ga: '.',
                en: '.',
                speaker: 'druid',
            },
            {
                ga: '.',
                en: '.',
                speaker: 'druid',
            },
        ],
    },

    // ── Cláirseach na Spéire — The Harp of Heaven (Lyra) ────────────────────
    // The pivot. The unknown star. The hinge into the game.
    clairseach: {
        waiting: [
            {
                ga: '!',
                en: 'f!',
                speaker: 'queen',
            },
            {
                ga: '.',
                en: '.',
                speaker: 'druid',
            },
        ],
        completion: [
            {
                ga: '.',
                en: 'Hold. There is a thing upon the sky this night that was not there the night before.',
                speaker: 'druid',
            },
            {
                ga: 'Feicim cláirseach na spéire — agus réalt fuar aisteach in aice léi.',
                en: 'I see the harp of heaven — and rising cold and strange beside it, a star unknown to me.',
                speaker: 'druid',
            },
            {
                ga: 'Ní fhaca mé a leithéid i ré Choinn, ná i ré na ndaoine a mhúin dom léamh.',
                en: 'No such star have I seen in Conn\'s time, nor in the time of those who taught me reading.',
                speaker: 'druid',
            },
            {
                ga: 'Ní glaofaidh mé dóchas air, óir is meargánta dóchas.',
                en: 'I will not call it hope, for hope is reckless.',
                speaker: 'druid',
            },
            {
                ga: 'Ach déarfaidh mé an méid seo agus ní focal eile:',
                en: 'But I will say this much and no word further:',
                speaker: 'druid',
            },
        ],
    },

    // ── An Laoch — The Hero (Perseus) ───────────────────────────────────────
    // The druid points. The question is asked. The silence is the answer.
    // Completion is empty — the wolf has no name. Triggers immediate fade.
    laoch: {
        waiting: [
            {
                ga: 'Cé, a Chonaill? Cé ar a lonraíonn an réalt anaithnid?',
                en: 'Then who, o wolf? Upon whom does the strange star shine?',
                speaker: 'queen',
            },
        ],
        completion: [],   // silence — the wolf has no answer. Fade to the game.
    },

};

