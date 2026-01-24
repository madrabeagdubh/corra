// js/game/scenes/tradMusicScene.js
/**
 * Demonstrates multi-voice progressive loop system with bodhrán & drone
 */
export default class TradMusicScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TradMusicScene' });
        this.player = null;
        this.statusText = null;
        this.loopText = null;
        this.instrumentsText = null;
    }

    create() {
        // Initialize the music player
        this.player = new window.AbcTradPlayer();

        // Set up loop change callback
        this.player.onLoopChange = (loopIndex, progression) => {
            this.updateLoopDisplay(loopIndex, progression);
        };

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Title
        this.add.text(width / 2, 50, 'Irish Trad Session', {
            fontSize: '48px',
            fontFamily: 'Courier New',
            color: '#90ee90',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, 100, 'Progressive Multi-Voice Loops + Bodhrán', {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#aaffaa'
        }).setOrigin(0.5);

        // Status displays
        this.statusText = this.add.text(width / 2, 150, 'Status: Ready', {
            fontSize: '20px',
            fontFamily: 'Courier New',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.loopText = this.add.text(width / 2, 180, '', {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#ffff88'
        }).setOrigin(0.5);

        this.instrumentsText = this.add.text(width / 2, 205, '', {
            fontSize: '14px',
            fontFamily: 'Courier New',
            color: '#aaffaa',
            align: 'center'
        }).setOrigin(0.5);

        // Create tune selection buttons
        this.createTuneButtons();

        // Stop button
        this.createStopButton();

        // Info panel
        this.createInfoPanel();
    }

// In tradMusicScene.js - Update createTuneButtons() method:

createTuneButtons() {
    const width = this.cameras.main.width;
    const startY = 230;
    const spacing = 52;

    // Full range of tune types - cheerful to EPIC!
    const tunesToDisplay = [
        { key: 'keshThe', label: 'The Kesh (Jig)', type: 'jig', color: 0x44aa44 },
        { key: 'cooleys', label: "Cooley's (Reel)", type: 'reel', color: 0xaa4444 },
        { key: 'butterflyThe', label: 'Butterfly (Slip Jig)', type: 'slipJig', color: 0x4444aa },
        { key: 'morrisons', label: "Morrison's (March)", type: 'march', color: 0xaa6644 },
        { key: 'silverSpearThe', label: 'Silver Spear (Epic!)', type: 'epic', color: 0x9944aa },
        { key: 'keshThe', label: 'The Kesh (Lament)', type: 'lament', color: 0x6666aa },
        { key: 'butterflyThe', label: 'Butterfly (Celtic)', type: 'celtic', color: 0x66aa66 },
        { key: 'keshThe', label: 'The Kesh (Pipes)', type: 'pipes', color: 0xaa8844 },
        { key: 'cooleys', label: "Cooley's (Session)", type: 'session', color: 0xaa4466 }
    ];

    tunesToDisplay.forEach((tune, index) => {
        this.createButton(
            width / 2,
            startY + (index * spacing),
            tune.label,
            tune.color,
            () => this.playTune(tune.key, tune.type)
        );
    });
}

createStopButton() {
    const width = this.cameras.main.width;
    this.createButton(
        width / 2,
        680,
        '⏹   STOP',
        0x884444,
        () => this.stopMusic()
    );
}

    createStopButton() {
        const width = this.cameras.main.width;
        this.createButton(
            width / 2,
            640,
            '⏹   STOP',
            0x884444,
            () => this.stopMusic()
        );
    }

    createButton(x, y, text, color, callback) {
        const buttonWidth = 500;
        const buttonHeight = 50;

        const button = this.add.rectangle(x, y, buttonWidth, buttonHeight, color)
            .setInteractive({ useHandCursor: true })
            .setStrokeStyle(2, 0xffffff);

        const buttonText = this.add.text(x, y, text, {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        button.on('pointerover', () => {
            button.setScale(1.05);
            buttonText.setScale(1.05);
        });

        button.on('pointerout', () => {
            button.setScale(1);
            buttonText.setScale(1);
        });

        button.on('pointerdown', () => {
            button.setScale(0.95);
            buttonText.setScale(0.95);
        });

        button.on('pointerup', () => {
            button.setScale(1);
            buttonText.setScale(1);
            callback();
        });
    }

    createInfoPanel() {
        const width = this.cameras.main.width;

        const infoText = [
            'Progressive Loop System:',
            '• Solo opens → harmony joins → bodhrán enters',
            '• Pipes include authentic drone!',
            '• Different instruments per arrangement',
            '• No audio distortion - real soundfonts!'
        ].join('\n');

        this.add.text(width / 2, 680, infoText, {
            fontSize: '11px',
            fontFamily: 'Courier New',
            color: '#88aa88',
            align: 'center',
            lineSpacing: 2
        }).setOrigin(0.5);
    }

    async playTune(tuneKey, tuneType) {
        // Preload soundfonts on first interaction (eliminates download wait)
        if (!this.player.soundfontsPreloaded) {
            this.statusText.setText('Loading soundfonts...');
            await this.player.preloadSoundfonts();
        }

        // Get the ABC from allTunes
        const abc = window.allTunes[tuneKey];

        if (!abc) {
            console.error('Tune not found:', tuneKey);
            return;
        }

        console.log('[TradMusicScene] Playing:', tuneKey, 'as', tuneType);
        console.log('[TradMusicScene] Original ABC from allTunes:');
        console.log(abc);

        // Prepare the tune data with multi-voice setup
        const tuneData = window.prepareTuneData(
            tuneKey,
            abc,
            tuneType
        );

        console.log('[TradMusicScene] Prepared tune data:', tuneData);
        console.log('[TradMusicScene] Multi-voice ABC length:', tuneData.abc.length);
        console.log('[TradMusicScene] Progression steps:', tuneData.progression.length);

        this.statusText.setText(`♪ Playing: ${tuneData.name} (${tuneType})`);

        // Prepare and play
        await this.player.prepareTune(tuneData);
        await this.player.play();
    }

    async stopMusic() {
        this.statusText.setText('Status: Stopped');
        this.loopText.setText('');
        this.instrumentsText.setText('');
        await this.player.stop();
    }

    updateLoopDisplay(loopIndex, progression) {
        const totalLoops = this.player.currentTune?.progression.length || 5;
        this.loopText.setText(`Loop ${loopIndex + 1}/${totalLoops}: ${progression.name}`);
        this.instrumentsText.setText(progression.description);
    }

    shutdown() {
        if (this.player) {
            this.player.destroy();
        }
    }
}
