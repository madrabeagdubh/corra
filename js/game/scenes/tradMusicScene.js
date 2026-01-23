// js/game/scenes/TradMusicScene.js

/**
 * Phaser 3 Scene for Irish Trad Music Player
 * Demonstrates multi-voice progressive loop system
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

        this.add.text(width / 2, 100, 'Progressive Multi-Voice Loops', {
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

    createTuneButtons() {
        const width = this.cameras.main.width;
        const startY = 260;
        const spacing = 70;

        // Sample tunes from allTunes.js
        const tunesToDisplay = [
            { key: 'keshThe', label: 'The Kesh', type: 'jig', color: 0x44aa44 },
            { key: 'cooleys', label: "Cooley's Reel", type: 'reel', color: 0xaa4444 },
            { key: 'butterflyThe', label: 'The Butterfly', type: 'slipJig', color: 0x4444aa },
            { key: 'morrisons', label: "Morrison's Jig", type: 'jig', color: 0x44aa44 },
            { key: 'silverSpearThe', label: 'The Silver Spear', type: 'reel', color: 0xaa4444 }
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
            600,
            '⏹  STOP',
            0x884444,
            () => this.stopMusic()
        );
    }

    createButton(x, y, text, color, callback) {
        const buttonWidth = 500;
        const buttonHeight = 55;

        const button = this.add.rectangle(x, y, buttonWidth, buttonHeight, color)
            .setInteractive({ useHandCursor: true })
            .setStrokeStyle(2, 0xffffff);

        const buttonText = this.add.text(x, y, text, {
            fontSize: '20px',
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
            'How it works:',
            '• Loop 1: Solo instrument opens',
            '• Loop 2-3: Others join progressively',
            '• Loop 4: Different solo takes over',
            '• Loop 5: Build back up to ensemble',
            '• Real soundfonts - no distortion!'
        ].join('\n');

        this.add.text(width / 2, 660, infoText, {
            fontSize: '12px',
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

        this.statusText.setText(`Playing: ${tuneData.name}`);
        
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
        this.loopText.setText(`Loop ${loopIndex + 1}/5: ${progression.name}`);
        this.instrumentsText.setText(progression.description);
    }

    shutdown() {
        if (this.player) {
            this.player.destroy();
        }
    }
}
