import Phaser from 'phaser';
import { GameSettings } from '../settings/gameSettings.js';

export default class TextPanel {
  constructor(scene) {
    this.scene = scene;
    this.container = null;
    this.isVisible = false;
    this.typewriterActive = false;
    this.currentCharIndex = 0;
    this.irishTextObject = null;
    this.englishTextObject = null;
  }

  show(config) {
    // If a panel is visible, start fading it out but don't wait
    if (this.isVisible && this.container) {
      const oldContainer = this.container;
      const oldTapZone = this.tapZone;

      this.typewriterActive = false;
      this.container = null;
      this.tapZone = null;
      this.irishTextObject = null;
      this.englishTextObject = null;

      // Fade out old container in background (it will be behind the new one)
      oldContainer.setDepth(1999); // Put old panel behind new one
      this.scene.tweens.add({
        targets: oldContainer,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          oldContainer.destroy();
          if (oldTapZone) oldTapZone.destroy();
        }
      });
    }

    const { irish, english, type = 'dialogue', speaker = null, onDismiss = null, options = null, onChoice = null } = config;
    this.onDismiss = onDismiss;
    this.irishFullText = irish;
    this.englishFullText = english;

    // Create container
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(2000);
    this.container.setScrollFactor(0);
    this.container.alpha = 1; // Start at full opacity immediately

    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;

    if (type === 'dialogue') {
      this.createDialoguePanel(irish, english, speaker, screenWidth, screenHeight);
    } else if (type === 'examine') {
      this.createExaminePanel(irish, english, screenWidth, screenHeight);
    } else if (type === 'notification') {
      this.createNotificationPanel(irish, english, screenWidth, screenHeight);
    } else if (type === 'chat_options') {
      this.createChatOptionsPanel(irish, english, options, onChoice, speaker, screenWidth, screenHeight);
    }

    this.isVisible = true;

    // Disable joystick controls when text is showing
    if (this.scene.joystick) {
      this.scene.joystick.base.disableInteractive();
      this.scene.joystick.thumb.disableInteractive();

      // Disable directional buttons
      Object.values(this.scene.joystick.buttons).forEach(button => {
        button.disableInteractive();
      });

      // Disable drag events
      this.scene.input.setDraggable(this.scene.joystick.thumb, false);
    }

    // Start typewriter immediately (but not for chat_options)
    if (type === 'dialogue' || type === 'examine') {
      this.startTypewriter();
    }
  }

  createChatOptionsPanel(irish, english, options, onChoice, speaker, screenWidth, screenHeight) {
    const panelHeight = screenHeight * 0.6;
    const panelY = screenHeight - panelHeight / 2;

    const panel = this.scene.add.rectangle(
      screenWidth / 2,
      panelY,
      screenWidth * 0.9,
      panelHeight,
      0x2a1810,
      0.95
    );
    this.container.add(panel);

    let textY = panelY - panelHeight / 2 + 30;
    const textX = screenWidth * 0.1;

    // Speaker name if provided
    if (speaker) {
      const speakerText = this.scene.add.text(
        textX,
        textY,
        speaker,
        {
          fontSize: '18px',
          fontFamily: 'monospace',
          color: '#d4af37',
          fontStyle: 'bold'
        }
      ).setOrigin(0, 0);
      this.container.add(speakerText);
      textY += 35;
    }

    // Irish text (shown immediately, no typewriter)
    const irishText = this.scene.add.text(
      textX,
      textY,
      irish,
      {
        fontSize: '22px',
        fontFamily: 'monospace',
        color: '#ffffff',
        wordWrap: { width: screenWidth * 0.8 },
        lineSpacing: 8
      }
    ).setOrigin(0, 0);
    this.container.add(irishText);

    // English text (shown immediately with opacity)
    const englishText = this.scene.add.text(
      textX,
      textY + irishText.height + 15,
      english,
      {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#00ff00',
        wordWrap: { width: screenWidth * 0.8 },
        lineSpacing: 6
      }
    ).setOrigin(0, 0);
    englishText.setAlpha(GameSettings.englishOpacity);
    englishText.setData('isEnglish', true);
    this.container.add(englishText);

    // Position for options (below the dialogue text with more spacing)
    const optionsStartY = textY + irishText.height + englishText.height + 60;

    // Create clickable option buttons
    options.forEach((option, index) => {
      const optionY = optionsStartY + (index * 90);
      
      // Button background
      const buttonBg = this.scene.add.rectangle(
        screenWidth / 2,
        optionY,
        screenWidth * 0.8,
        70,
        0x3a2820,
        1
      );
      buttonBg.setStrokeStyle(2, 0xd4af37);
      buttonBg.setInteractive({ useHandCursor: true });
      this.container.add(buttonBg);

      // Irish option text
      const optionIrishText = this.scene.add.text(
        screenWidth / 2,
        optionY - 15,
        option.irish,
        {
          fontSize: '20px',
          fontFamily: 'monospace',
          color: '#ffffff',
          wordWrap: { width: screenWidth * 0.7 }
        }
      ).setOrigin(0.5, 0);
      this.container.add(optionIrishText);

      // English option text
      const optionEnglishText = this.scene.add.text(
        screenWidth / 2,
        optionY + optionIrishText.height - 10,
        option.english,
        {
          fontSize: '16px',
          fontFamily: 'monospace',
          color: '#00ff00',
          wordWrap: { width: screenWidth * 0.7 }
        }
      ).setOrigin(0.5, 0);
      optionEnglishText.setAlpha(GameSettings.englishOpacity);
      optionEnglishText.setData('isEnglish', true);
      this.container.add(optionEnglishText);
// Hover effects
      buttonBg.on('pointerover', () => {
        buttonBg.setFillStyle(0x4a3830);
        buttonBg.setStrokeStyle(3, 0xffd700);
      });

      buttonBg.on('pointerout', () => {
        buttonBg.setFillStyle(0x3a2820);
        buttonBg.setStrokeStyle(2, 0xd4af37);
      });

      // Click handler
      buttonBg.on('pointerdown', () => {
        console.log(`Option ${index} selected:`, option.irish);
        
        // Dismiss the panel first
        this.hide();
        
        // Call the choice callback after a brief delay to ensure panel is hidden
        this.scene.time.delayedCall(100, () => {
          if (onChoice) {
            onChoice(index, option);
          }
        });
      });
    });
  }

  createExaminePanel(irish, english, screenWidth, screenHeight) {
    const panelHeight = screenHeight * 0.35;

    // Background panel
    const panel = this.scene.add.rectangle(
      screenWidth / 2,
      screenHeight - panelHeight / 2,
      screenWidth,
      panelHeight,
      0x2a1810,
      0.95
    );
    this.container.add(panel);

    const textY = screenHeight - panelHeight + 25;
    const textX = screenWidth * 0.05; // Left edge with 5% padding

    // Irish text - ANCHORED LEFT
    this.irishTextObject = this.scene.add.text(
      textX,
      textY,
      '',
      {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#ffffff',
        wordWrap: { width: screenWidth * 0.9 },
        lineSpacing: 6
      }
    ).setOrigin(0, 0);
    this.container.add(this.irishTextObject);

    // English text - ANCHORED LEFT
    this.englishTextObject = this.scene.add.text(
      textX,
      textY + 60,
      '',
      {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#00ff00',
        wordWrap: { width: screenWidth * 0.9 },
        lineSpacing: 4
      }
    ).setOrigin(0, 0);
    this.englishTextObject.setAlpha(0);
    this.englishTextObject.setData('isEnglish', true);
    this.container.add(this.englishTextObject);

    // Tap hint
    const hint = this.scene.add.text(
      screenWidth / 2,
      screenHeight - 15,
      'Tap to close',
      {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#888888',
        fontStyle: 'italic'
      }
    ).setOrigin(0.5, 0);
    this.container.add(hint);

    // Create tap zone OUTSIDE container, at scene level
    this.tapZone = this.scene.add.zone(
      0,
      0,
      screenWidth,
      screenHeight
    ).setOrigin(0, 0);

    this.tapZone.setInteractive();
    this.tapZone.setDepth(3000); // Higher than container
    this.tapZone.setScrollFactor(0);

    this.tapZone.on('pointerdown', () => {
      console.log('Examine panel tap detected!');
      this.dismissWithCooldown();
    });
  }

  createDialoguePanel(irish, english, speaker, screenWidth, screenHeight) {
    // Main panel
    const panelHeight = screenHeight * 0.5;
    const panelY = screenHeight - panelHeight / 2;

    const panel = this.scene.add.rectangle(
      screenWidth / 2,
      panelY,
      screenWidth * 0.9,
      panelHeight,
      0x2a1810,
      0.95
    );
    this.container.add(panel);

    let textY = panelY - panelHeight / 2 + 30;
    const textX = screenWidth * 0.1; // Left edge with 10% padding

    // Speaker name if provided
    if (speaker) {
      const speakerText = this.scene.add.text(
        textX,
        textY,
        speaker,
        {
          fontSize: '18px',
          fontFamily: 'monospace',
          color: '#d4af37',
          fontStyle: 'bold'
        }
      ).setOrigin(0, 0);
      this.container.add(speakerText);
      textY += 35;
    }

    // Irish text (will be filled by typewriter) - ANCHORED LEFT
    this.irishTextObject = this.scene.add.text(
      textX,
      textY,
      '',
      {
        fontSize: '22px',
        fontFamily: 'monospace',
        color: '#ffffff',
        wordWrap: { width: screenWidth * 0.8 },
        lineSpacing: 8
      }
    ).setOrigin(0, 0);
    this.container.add(this.irishTextObject);

    // English text (will fade in after typewriter) - ANCHORED LEFT
    this.englishTextObject = this.scene.add.text(
      textX,
      textY + 100,
      '',
      {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#00ff00',
        wordWrap: { width: screenWidth * 0.8 },
        lineSpacing: 6
      }
    ).setOrigin(0, 0);
    this.englishTextObject.setAlpha(0);
    this.englishTextObject.setData('isEnglish', true);
    this.container.add(this.englishTextObject);

    // Tap to continue hint
    const hint = this.scene.add.text(
      screenWidth / 2,
      panelY + panelHeight / 2 - 20,
      'Tap to continue',
      {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#888888',
        fontStyle: 'italic'
      }
    ).setOrigin(0.5, 0);
    this.container.add(hint);

    // Create tap zone OUTSIDE container, at scene level
    this.tapZone = this.scene.add.zone(
      0,
      0,
      screenWidth,
      screenHeight
    ).setOrigin(0, 0);

    this.tapZone.setInteractive();
    this.tapZone.setDepth(3000); // Higher than container
    this.tapZone.setScrollFactor(0);

    this.tapZone.on('pointerdown', () => {
      console.log('Dialogue panel tap detected!');
      this.dismissWithCooldown();
    });
  }

  dismissWithCooldown() {
    console.log('dismissWithCooldown called, typewriterActive:', this.typewriterActive);
    if (this.typewriterActive) {
      this.skipTypewriter();
    } else {
      this.hide();

      this.scene.textPanelCooldown = true;
      this.scene.time.delayedCall(2000, () => {
        this.scene.textPanelCooldown = false;
      });
    }
  }

  createNotificationPanel(irish, english, screenWidth, screenHeight) {
    const panelWidth = screenWidth * 0.8;
    const panelHeight = 80;

    // Background panel at top
    const panel = this.scene.add.rectangle(
      screenWidth / 2,
      panelHeight / 2 + 10,
      panelWidth,
      panelHeight,
      0x2a1810,
      0.9
    );
    this.container.add(panel);

    // For notifications, just show text immediately (no typewriter)
    const irishText = this.scene.add.text(
      screenWidth / 2,
      25,
      irish,
      {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#ffffff',
        wordWrap: { width: panelWidth * 0.9 }
      }
    ).setOrigin(0.5, 0);
    this.container.add(irishText);

    if (GameSettings.englishOpacity > 0.1) {
      const englishText = this.scene.add.text(
        screenWidth / 2,
        25 + irishText.height + 5,
        english,
        {
          fontSize: '14px',
          fontFamily: 'monospace',
          color: '#00ff00',
          wordWrap: { width: panelWidth * 0.9 }
        }
      ).setOrigin(0.5, 0);
      englishText.setAlpha(GameSettings.englishOpacity);
      englishText.setData('isEnglish', true);
      this.container.add(englishText);
    }

    // Auto-dismiss
    this.scene.time.delayedCall(3000, () => {
      this.hide();
    });
  }

  startTypewriter() {
    this.typewriterActive = true;
    this.currentCharIndex = 0;
    this.typeNextCharacter();
  }

  typeNextCharacter() {
    if (!this.typewriterActive || !this.irishTextObject) return;

    if (this.currentCharIndex < this.irishFullText.length) {
      const char = this.irishFullText[this.currentCharIndex];

      // Add character with glow effect
      const currentText = this.irishTextObject.text + char;
      this.irishTextObject.setText(currentText);

      // Add temporary glow to the whole text
      this.irishTextObject.setStyle({
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: '#ffffff',
          blur: 8,
          fill: true
        }
      });

      // Remove glow after brief moment
      this.scene.time.delayedCall(100, () => {
        if (this.irishTextObject) {
          this.irishTextObject.setStyle({ shadow: { blur: 0 } });
        }
      });

      this.currentCharIndex++;

      // Continue to next character
      const speed = 40; // milliseconds per character
      this.scene.time.delayedCall(speed, () => this.typeNextCharacter());
    } else {
      // Typewriter complete
      this.typewriterActive = false;
      this.showEnglishText();
    }
  }

  skipTypewriter() {
    this.typewriterActive = false;
    if (this.irishTextObject) {
      this.irishTextObject.setText(this.irishFullText);
      this.irishTextObject.setStyle({ shadow: { blur: 0 } });
    }
    this.showEnglishText();
  }

  showEnglishText() {
    if (!this.englishTextObject) return;

    // Adjust English text position based on Irish text height
    const irishHeight = this.irishTextObject.height;
    this.englishTextObject.y = this.irishTextObject.y + irishHeight + 20;
    this.englishTextObject.setText(this.englishFullText);

    // Fade in English text
    this.scene.tweens.add({
      targets: this.englishTextObject,
      alpha: GameSettings.englishOpacity,
      duration: 800,
      ease: 'Power2'
    });
  }

  updateEnglishOpacity() {
    if (this.englishTextObject && !this.typewriterActive) {
      this.englishTextObject.setAlpha(GameSettings.englishOpacity);
    }
  }

  hide() {
    if (!this.isVisible || !this.container) return;

    this.typewriterActive = false;

    // Destroy the tap zone
    if (this.tapZone) {
      this.tapZone.destroy();
      this.tapZone = null;
    }

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        if (this.container) {
          this.container.destroy();
          this.container = null;
          this.irishTextObject = null;
          this.englishTextObject = null;
        }
        this.isVisible = false;

        // Re-enable joystick when text is hidden
        if (this.scene.joystick) {
          this.scene.joystick.base.setInteractive();
          this.scene.joystick.thumb.setInteractive();

          // Re-enable directional buttons
          Object.values(this.scene.joystick.buttons).forEach(button => {
            button.setInteractive();
          });

          // Re-enable drag
          this.scene.input.setDraggable(this.scene.joystick.thumb, true);
        }

        if (this.onDismiss) {
          this.onDismiss();
        }
      }
    });
  }
}
