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
  this.englishOptionTexts = [];
  this.readingCursor = null;
  this.cursorParticles = [];

  // Add this:
  this.cursorAnchor = { x: 0, y: 0 };
  this.cursorTime = 0;
} 

  show(config) {
    if (this.isVisible && this.container) {
      const oldContainer = this.container;
      const oldTapZone = this.tapZone;
      
      this.typewriterActive = false;
      this.container = null;
      this.tapZone = null;
      this.irishTextObject = null;
      this.englishTextObject = null;

      oldContainer.setDepth(1999);
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

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(2000);
    this.container.setScrollFactor(0);
    this.container.alpha = 1;

    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;

    if (type === 'dialogue') {
      this.createDialoguePanel(irish, english, speaker, screenWidth, screenHeight);
    } else if (type === 'examine') {
      this.createExaminePanel(irish, english, screenWidth, screenHeight);
    } else if (type === 'notification') {
      this.createNotificationPanel(irish, english, screenWidth, screenHeight);
    } else if (type === 'archery_prompt') {
      this.createArcheryPromptPanel(irish, english, screenWidth, screenHeight);
    } else if (type === 'chat_options') {
      this.createChatOptionsPanel(irish, english, options, onChoice, speaker, screenWidth, screenHeight);
    }

    this.isVisible = true;

    if (this.scene.joystick) {
      this.scene.joystick.base.disableInteractive();
      this.scene.joystick.thumb.disableInteractive();

      Object.values(this.scene.joystick.buttons).forEach(button => {
        button.disableInteractive();
      });

      this.scene.input.setDraggable(this.scene.joystick.thumb, false);
    }

    if (type === 'dialogue' || type === 'examine') {
      this.startTypewriter();
    }
  }

  createChatOptionsPanel(irish, english, options, onChoice, speaker, screenWidth, screenHeight) {
    this.englishOptionTexts = [];

    const panelWidth = screenWidth * 0.9;
    const panelHeight = screenHeight * 0.5;
    const panelX = screenWidth / 2;
    const panelY = screenHeight - panelHeight / 2;

    const panelGraphics = this.scene.add.graphics();
    panelGraphics.fillStyle(0x1b2a1b, 0.95);
    panelGraphics.lineStyle(4, 0xc0c0c0, 1);
    panelGraphics.fillRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
    panelGraphics.strokeRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);

    this.container.add(panelGraphics);

    let textY = panelY - panelHeight / 2 + 30;
    const textX = screenWidth * 0.1;

    if (speaker) {
      const speakerText = this.scene.add.text(textX, textY, speaker, {
        fontSize: '18px',
        fontFamily: 'Urchlo',
        color: '#d4af37',
        fontStyle: 'bold'
      }).setOrigin(0, 0);
      this.container.add(speakerText);
      textY += 35;
    }

    const irishText = this.scene.add.text(textX, textY, irish, {
      fontSize: '22px',
      fontFamily: 'Urchlo',
      color: '#ffffff',
      wordWrap: { width: screenWidth * 0.8 },
      lineSpacing: 8
    }).setOrigin(0, 0);
    this.container.add(irishText);

    const englishText = this.scene.add.text(textX, textY + irishText.height + 15, english, {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#00ff00',
      wordWrap: { width: screenWidth * 0.8 },
      lineSpacing: 6
    }).setOrigin(0, 0);
    englishText.setAlpha(GameSettings.englishOpacity);
    englishText.setData('isEnglish', true);
    this.container.add(englishText);

    this.englishTextObject = englishText;

    const optionsStartY = textY + irishText.height + englishText.height + 60;

    options.forEach((option, index) => {
      const optionY = optionsStartY + (index * 90);

      const buttonBg = this.scene.add.rectangle(screenWidth / 2, optionY, screenWidth * 0.8, 70, 0x1b2a1b, 1);
      buttonBg.setStrokeStyle(2, 0xd4af37);
      buttonBg.setInteractive({ useHandCursor: true });
      this.container.add(buttonBg);

      const optionIrishText = this.scene.add.text(screenWidth / 2, optionY - 15, option.irish, {
        fontSize: '20px',
        fontFamily: 'Urchlo',
        color: '#ffffff',
        wordWrap: { width: screenWidth * 0.7 }
      }).setOrigin(0.5, 0);
      this.container.add(optionIrishText);

      const optionEnglishText = this.scene.add.text(screenWidth / 2, optionY + optionIrishText.height - 10, option.english, {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#00ff00',
        wordWrap: { width: screenWidth * 0.7 }
      }).setOrigin(0.5, 0);
      optionEnglishText.setAlpha(GameSettings.englishOpacity);
      optionEnglishText.setData('isEnglish', true);
      this.container.add(optionEnglishText);

      this.englishOptionTexts.push(optionEnglishText);

      buttonBg.on('pointerover', () => {
        buttonBg.setFillStyle(0x4a3830);
        buttonBg.setStrokeStyle(3, 0xffd700);
      });

      buttonBg.on('pointerout', () => {
        buttonBg.setFillStyle(0x3a2820);
        buttonBg.setStrokeStyle(2, 0xd4af37);
      });

      buttonBg.on('pointerdown', () => {
        console.log(`Option ${index} selected:`, option.irish);
        this.hide();
        this.scene.time.delayedCall(100, () => {
          if (onChoice) {
            onChoice(index, option);
          }
        });
      });
    });
  }

  createArcheryPromptPanel(irish, english, screenWidth, screenHeight) {
    const panelWidth = screenWidth * 0.9;
    const panelHeight = 100;
    const panelX = screenWidth / 2;
    const panelY = panelHeight / 2 + 20;

    const panelGraphics = this.scene.add.graphics();
    panelGraphics.fillStyle(0x1a2a3a, 0.95);
    panelGraphics.lineStyle(4, 0xc0c0c0, 1);
    panelGraphics.fillRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
    panelGraphics.strokeRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
    this.container.add(panelGraphics);

    const irishText = this.scene.add.text(screenWidth / 2, 35, irish, {
      fontSize: '24px',
      fontFamily: 'Aonchlo',
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: panelWidth * 0.9 }
    }).setOrigin(0.5, 0);
    this.container.add(irishText);

    const englishText = this.scene.add.text(screenWidth / 2, 35 + irishText.height + 8, english, {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#00ff00',
      wordWrap: { width: panelWidth * 0.9 }
    }).setOrigin(0.5, 0);
    englishText.setAlpha(GameSettings.englishOpacity);
    englishText.setData('isEnglish', true);
    this.container.add(englishText);

    this.englishTextObject = englishText;
  }

  createExaminePanel(irish, english, screenWidth, screenHeight) {
    const panelWidth = screenWidth * 0.35;
    const panelHeight = screenHeight * 0.5;
    const panelX = screenWidth / 2;
    const panelY = screenHeight - panelHeight / 2;

    const panelGraphics = this.scene.add.graphics();
    panelGraphics.fillStyle(0x1b2a1b, 0.95);
    panelGraphics.lineStyle(4, 0xc0c0c0, 1);
    panelGraphics.fillRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
    panelGraphics.strokeRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);

    this.container.add(panelGraphics);

    const textY = screenHeight - panelHeight + 25;
    const textX = screenWidth * 0.05;

    this.irishTextObject = this.scene.add.text(textX, textY, '', {
      fontSize: '20px',
      fontFamily: 'Urchlo',
      color: '#ffffff',
      wordWrap: { width: screenWidth * 0.9 },
      lineSpacing: 6
    }).setOrigin(0, 0);
    this.container.add(this.irishTextObject);

    this.englishTextObject = this.scene.add.text(textX, textY + 60, '', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#00ff00',
      wordWrap: { width: screenWidth * 0.9 },
      lineSpacing: 4
    }).setOrigin(0, 0);
    this.englishTextObject.setAlpha(0);
    this.englishTextObject.setData('isEnglish', true);
    this.container.add(this.englishTextObject);

    const hint = this.scene.add.text(screenWidth / 2, screenHeight - 15, '', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#888888',
      fontStyle: 'italic'
    }).setOrigin(0.5, 0);
    this.container.add(hint);

    this.tapZone = this.scene.add.zone(0, 0, screenWidth, screenHeight).setOrigin(0, 0);
    this.tapZone.setInteractive();
    this.tapZone.setDepth(3000);
    this.tapZone.setScrollFactor(0);

    this.tapZone.on('pointerdown', () => {
      console.log('Examine panel tap detected!');
      this.dismissWithCooldown();
    });
  }

  createDialoguePanel(irish, english, speaker, screenWidth, screenHeight) {
    const panelWidth = screenWidth * 0.9;
    const panelHeight = screenHeight * 0.5;
    const panelX = screenWidth / 2;
    const panelY = screenHeight - panelHeight / 2 - 16;

    const panelGraphics = this.scene.add.graphics();
    panelGraphics.fillStyle(0x1b2a1b, 0.95);
    panelGraphics.lineStyle(4, 0xc0c0c0, 1);
    panelGraphics.fillRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
    panelGraphics.strokeRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);

    this.container.add(panelGraphics);

    let textY = panelY - panelHeight / 2 + 30;
    const textX = screenWidth * 0.1;

    if (speaker) {
      const speakerText = this.scene.add.text(textX, textY, speaker, {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#d4af37',
        fontStyle: 'bold'
      }).setOrigin(0, 0);
      this.container.add(speakerText);
      textY += 35;
    }

    this.irishTextObject = this.scene.add.text(textX, textY, '', {
      fontSize: '22px',
      fontFamily: 'Urchlo',
      color: '#ffffff',
      wordWrap: { width: screenWidth * 0.8 },
      lineSpacing: 8,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: '#e6f3ff',
        blur: 6,
        stroke: false,
        fill: true
      }
    }).setOrigin(0, 0);
    this.container.add(this.irishTextObject);

    this.englishTextObject = this.scene.add.text(textX, textY + 100, '', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#00ff00',
      wordWrap: { width: screenWidth * 0.8 },
      lineSpacing: 6
    }).setOrigin(0, 0);
    this.englishTextObject.setAlpha(0);
    this.englishTextObject.setData('isEnglish', true);
    this.container.add(this.englishTextObject);

    const hint = this.scene.add.text(screenWidth / 2, panelY + panelHeight / 2 - 20, '', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#888888',
      fontStyle: 'italic'
    }).setOrigin(0.5, 0);
    this.container.add(hint);

    this.tapZone = this.scene.add.zone(0, 0, screenWidth, screenHeight).setOrigin(0, 0);
    this.tapZone.setInteractive();
    this.tapZone.setDepth(3000);
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
    const panelPadding = 10;
    const panelWidth = screenWidth * 0.9;

    const tempIrishText = this.scene.add.text(0, 0, irish, {
      fontSize: '18px',
      fontFamily: 'monospace',
      wordWrap: { width: panelWidth * 0.9 }
    });
    let totalHeight = tempIrishText.height;

    let tempEnglishText;
    if (GameSettings.englishOpacity > 0.1 && english) {
      tempEnglishText = this.scene.add.text(0, 0, english, {
        fontSize: '14px',
        fontFamily: 'monospace',
        wordWrap: { width: panelWidth * 0.9 }
      });
      totalHeight += tempEnglishText.height + 5;
    }

    const panelHeight = totalHeight + panelPadding * 2;
    const panelX = screenWidth / 2;
    const panelY = panelHeight / 2 + 30;

    const panelGraphics = this.scene.add.graphics();
    panelGraphics.fillStyle(0x1b2a1b, 0.95);
    panelGraphics.lineStyle(4, 0xc0c0c0, 1);
    panelGraphics.fillRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
    panelGraphics.strokeRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
    this.container.add(panelGraphics);

    const irishText = this.scene.add.text(panelX, panelY - panelHeight/2 + panelPadding, irish, {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#ffffff',
      wordWrap: { width: panelWidth * 0.9 }
    }).setOrigin(0.5, 0);
    this.container.add(irishText);

    if (tempEnglishText) {
      const englishText = this.scene.add.text(panelX, irishText.y + irishText.height + 5, english, {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#00ff00',
        wordWrap: { width: panelWidth * 0.9 }
      }).setOrigin(0.5, 0);
      englishText.setAlpha(GameSettings.englishOpacity);
      englishText.setData('isEnglish', true);
      this.container.add(englishText);
    }

    tempIrishText.destroy();
    if (tempEnglishText) tempEnglishText.destroy();

    this.scene.time.delayedCall(4000, () => {
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
      const currentText = this.irishTextObject.text;

      let textToAdd = char;

      if (char !== ' ' && char !== '\n') {
        let lookAhead = '';
        let tempIndex = this.currentCharIndex;

        while (tempIndex < this.irishFullText.length) {
          const nextChar = this.irishFullText[tempIndex];
          if (nextChar === ' ' || nextChar === '\n') break;
          lookAhead += nextChar;
          tempIndex++;
        }

        const testText = currentText + char;
        this.irishTextObject.setText(testText);
        const heightBefore = this.irishTextObject.height;

        const testWithWord = currentText + lookAhead;
        this.irishTextObject.setText(testWithWord);
        const heightAfter = this.irishTextObject.height;

        if (heightAfter > heightBefore) {
          textToAdd = lookAhead;
          this.currentCharIndex = tempIndex - 1;
        } else {
          this.irishTextObject.setText(currentText);
        }
      }

      const newText = currentText + textToAdd;
      this.irishTextObject.setText(newText);

      this.irishTextObject.setStyle({
        fontSize: '22px',
        fontFamily: 'Urchlo',
        color: '#ffffff',
        wordWrap: { width: this.irishTextObject.style.wordWrapWidth },
        lineSpacing: 8,
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: '#e6f3ff',
          blur: 6,
          stroke: false,
          fill: true
        }
      });

      this.updateReadingCursor();

      this.currentCharIndex++;

      const speed = 40;
      this.scene.time.delayedCall(speed, () => this.typeNextCharacter());
    } else {
      this.typewriterActive = false;

      if (this.readingCursor) {
        this.scene.tweens.add({
          targets: this.readingCursor,
          alpha: 0,
          scale: 0,
          duration: 300,
          onComplete: () => {
            if (this.readingCursor) {
              this.readingCursor.destroy();
              this.readingCursor = null;
            }
          }
        });
      }

      this.cursorParticles.forEach(p => p.destroy());
      this.cursorParticles = [];

      this.irishTextObject.setStyle({
        fontSize: '22px',
        fontFamily: 'Urchlo',
        color: '#ffffff',
        wordWrap: { width: this.irishTextObject.style.wordWrapWidth },
        lineSpacing: 8,
        shadow: {
          offsetX: 0,
          offsetY: 1,
          color: '#c8e0ff',
          blur: 8,
          stroke: false,
          fill: true
        }
      });

      this.showEnglishText();
    }
  }

update(time, delta) {
  if (!this.readingCursor) return;

  this.cursorTime += delta * 0.002;

  const orbitRadius = 6;
  const orbitSpeed = 1.2;

  const bobAmplitude = 4;
  const bobSpeed = 2.5;

  const glowPulse =
    0.6 + Math.sin(this.cursorTime * 3) * 0.3;

  const offsetX =
    Math.cos(this.cursorTime * orbitSpeed) * orbitRadius;

  const offsetY =
    Math.sin(this.cursorTime * orbitSpeed) * orbitRadius * 0.6 +
    Math.sin(this.cursorTime * bobSpeed) * bobAmplitude;

  this.readingCursor.x = this.cursorAnchor.x + offsetX;
  this.readingCursor.y = this.cursorAnchor.y + offsetY;

  this.readingCursor.setAlpha(glowPulse);
  this.readingCursor.setScale(1 + glowPulse * 0.15);
}


updateReadingCursor() {
    if (!this.irishTextObject) return;

    if (!this.cursorAnchor) {
        this.cursorAnchor = { x: this.irishTextObject.x, y: this.irishTextObject.y };
        this.cursorTime = 0;
    }

    const lines = this.irishTextObject.getWrappedText();
    if (!lines || lines.length === 0) return;

    const lastLineIndex = lines.length - 1;
    const lastLine = lines[lastLineIndex];

    const metrics = this.irishTextObject.style.getTextMetrics();
    const lineHeight = metrics.fontSize + (this.irishTextObject.style.lineSpacing || 0);

    const textX = this.irishTextObject.x;
    const textY = this.irishTextObject.y;

    // Measure the width of the last line
    const lastLineWidth = this.irishTextObject.context.measureText(lastLine).width;

    // Base position
    const baseX = textX + lastLineWidth;
    const baseY = textY + lastLineIndex * lineHeight + lineHeight * 0.6;

    this.cursorTime += 0.016; // increment for animation

    this.cursorAnchor.x = baseX;
    this.cursorAnchor.y = baseY;

    // Ghostly orbit + jitter
    const orbitX = Math.sin(this.cursorTime * 2.5) * (3 + Math.random() * 1.5);
    const orbitY = Math.cos(this.cursorTime * 3.2) * (2 + Math.random()*1.5);
    const cursorX = this.cursorAnchor.x + orbitX;
    const cursorY = this.cursorAnchor.y + orbitY;

    if (!this.readingCursor) {
        this.readingCursor = this.scene.add.sprite(cursorX, cursorY, 'glowCursor');
        this.readingCursor.setDepth(2500);
        this.readingCursor.setOrigin(0.5);
        this.container.add(this.readingCursor);

        // Continuous ghostly rotation
        this.scene.tweens.add({
            targets: this.readingCursor,
            angle: 360,
            duration: 4000,
            repeat: -1,
            ease: 'Linear'
        });

        // Pulse for flickering glow
        this.scene.tweens.add({
            targets: this.readingCursor,
            scale: { from: 0.25, to: 0.35 },
            alpha: { from: 0.6, to: 1 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    } else {
        this.readingCursor.setPosition(cursorX, cursorY);
    }

    // Trail effect (soft fading sparks)
    if (Math.random() < 0.15) {
        const trail = this.scene.add.circle(
            cursorX + (Math.random() - 0.5) * 8,
            cursorY + (Math.random() - 0.5) * 8,
            3 + Math.random() * 2,
            0xffffaa,
            0.4
        );
        trail.setDepth(2499);
        this.container.add(trail);
        this.cursorParticles.push(trail);

        this.scene.tweens.add({
            targets: trail,
            alpha: 0,
            scale: 0.1,
            duration: 600 + Math.random() * 300,
            ease: 'Sine.easeOut',
            onComplete: () => {
                trail.destroy();
                const idx = this.cursorParticles.indexOf(trail);
                if (idx > -1) this.cursorParticles.splice(idx, 1);
            }
        });
    }
}


 

  skipTypewriter() {
    this.typewriterActive = false;
    if (this.irishTextObject) {
      this.irishTextObject.setText(this.irishFullText);
    }
    
    if (this.readingCursor) {
      this.readingCursor.destroy();
      this.readingCursor = null;
    }
    this.cursorParticles.forEach(p => p.destroy());
    this.cursorParticles = [];
    
    this.showEnglishText();
  }

  showEnglishText() {
    if (!this.englishTextObject) return;

    const irishHeight = this.irishTextObject.height;
    this.englishTextObject.y = this.irishTextObject.y + irishHeight + 20;
    this.englishTextObject.setText(this.englishFullText);

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

    this.englishOptionTexts.forEach(optionText => {
      if (optionText && optionText.active) {
        optionText.setAlpha(GameSettings.englishOpacity);
      }
    });
  }

  hide() {
    if (!this.isVisible || !this.container) return;

    this.typewriterActive = false;

    if (this.readingCursor) {
      this.readingCursor.destroy();
      this.readingCursor = null;
    }
    this.cursorParticles.forEach(p => p.destroy());
    this.cursorParticles = [];

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
          this.englishOptionTexts = [];
        }
        this.isVisible = false;

        if (this.scene.joystick) {
          this.scene.joystick.base.setInteractive();
          this.scene.joystick.thumb.setInteractive();

          Object.values(this.scene.joystick.buttons).forEach(button => {
            button.setInteractive();
          });

          this.scene.input.setDraggable(this.scene.joystick.thumb, true);
        }

        if (this.onDismiss) {
          this.onDismiss();
        }
      }
    });
  }
}
