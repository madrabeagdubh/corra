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
  } else if (type === 'archery_prompt') {
    this.createArcheryPromptPanel(irish, english, screenWidth, screenHeight);
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
  // Clear previous option texts
  this.englishOptionTexts = [];

  const panelWidth = screenWidth * 0.9;
  const panelHeight = screenHeight * 0.5;
  const panelX = screenWidth / 2;
  const panelY = screenHeight - panelHeight / 2;



const panelGraphics = this.scene.add.graphics();
panelGraphics.fillStyle(0x1b2a1b, 0.95); // dark grey-green background
panelGraphics.lineStyle(4, 0xc0c0c0, 1); // silver border
panelGraphics.fillRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
panelGraphics.strokeRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);

this.container.add(panelGraphics);



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
          fontFamily: 'Urchlo',
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
        fontFamily: 'Urchlo',
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

// Store reference so it can be updated by the slider
this.englishTextObject = englishText;
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
       0x1b2a1b,1      );
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
          fontFamily: 'Urchlo',
          color: '#ffffff',
          wordWrap: { width: screenWidth * 0.7 }
        }
      ).setOrigin(0.5, 0);
      this.container.add(optionIrishText);

      // English option text


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
    
    // Store reference for opacity updates
    this.englishOptionTexts.push(optionEnglishText);

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




createArcheryPromptPanel(irish, english, screenWidth, screenHeight) {
  const panelWidth = screenWidth * 0.9;
  const panelHeight = 100;
  const panelX = screenWidth / 2;
  const panelY = panelHeight / 2 + 20;

  // Draw background with border
  const panelGraphics = this.scene.add.graphics();
  panelGraphics.fillStyle(0x1a2a3a, 0.95); // dark blue background
  panelGraphics.lineStyle(4, 0xc0c0c0, 1); // silver border
  panelGraphics.fillRoundedRect(
    panelX - panelWidth/2, 
    panelY - panelHeight/2, 
    panelWidth, 
    panelHeight, 
    8
  );
  panelGraphics.strokeRoundedRect(
    panelX - panelWidth/2, 
    panelY - panelHeight/2, 
    panelWidth, 
    panelHeight, 
    8
  );
  this.container.add(panelGraphics);

  // Irish text - larger and centered
  const irishText = this.scene.add.text(
    screenWidth / 2,
    35,
    irish,
    {
      fontSize: '24px',
      fontFamily: 'Aonchlo',
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: panelWidth * 0.9 }
    }
  ).setOrigin(0.5, 0);
  this.container.add(irishText);

  // English text below
  
  const englishText = this.scene.add.text(
    screenWidth / 2,
    35 + irishText.height + 8,
    english,
    {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#00ff00',
      wordWrap: { width: panelWidth * 0.9 }
    }
  ).setOrigin(0.5, 0);
  englishText.setAlpha(GameSettings.englishOpacity);
  englishText.setData('isEnglish', true);
  this.container.add(englishText);
  
  // Store reference so it can be updated
  this.englishTextObject = englishText;

  // NO auto-dismiss - this panel stays until manually hidden
  // NO tap zone - controlled by the archery system
}







  createExaminePanel(irish, english, screenWidth, screenHeight) {
const panelWidth = screenWidth * 0.35;
const panelHeight = screenHeight * 0.5;
const panelX = screenWidth / 2;
const panelY = screenHeight - panelHeight / 2;

const panelGraphics = this.scene.add.graphics();
panelGraphics.fillStyle(0x1b2a1b, 0.95); // dark grey-green background
panelGraphics.lineStyle(4, 0xc0c0c0, 1); // silver border
panelGraphics.fillRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
panelGraphics.strokeRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);

this.container.add(panelGraphics);





    const textY = screenHeight - panelHeight + 25;
    const textX = screenWidth * 0.05; // Left edge with 5% padding

    // Irish text - ANCHORED LEFT
    this.irishTextObject = this.scene.add.text(
      textX,
      textY,
      '',
      {
        fontSize: '20px',
        fontFamily: 'Urchlo',
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

    // Tap to close type hint - currently an empty string
	
    const hint = this.scene.add.text(
      screenWidth / 2,
      screenHeight - 15,
      '',
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
const panelWidth = screenWidth * 0.9;
const panelHeight = screenHeight * 0.5;
const panelX = screenWidth / 2;
const panelY = screenHeight - panelHeight / 2 -16;

const panelGraphics = this.scene.add.graphics();
panelGraphics.fillStyle(0x1b2a1b, 0.95); // dark grey-green background
panelGraphics.lineStyle(4, 0xc0c0c0, 1); // silver border
panelGraphics.fillRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
panelGraphics.strokeRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);

this.container.add(panelGraphics);

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

// Also update the Irish text creation in createDialoguePanel to have the initial style:
// Replace lines 446-458 with:

// Irish text (will be filled by typewriter) - ANCHORED LEFT
this.irishTextObject = this.scene.add.text(
  textX,
  textY,
  '',
  {
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
      '',
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
    // Estimate text height
    const panelPadding = 10; // space around text
    const panelWidth = screenWidth * 0.9;
    
    // Create temporary text objects to measure height
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
        totalHeight += tempEnglishText.height + 5; // extra spacing
    }

    const panelHeight = totalHeight + panelPadding * 2;
    const panelX = screenWidth / 2;
    const panelY = panelHeight / 2 + 30; // top padding from screen

    // Draw background with border
    const panelGraphics = this.scene.add.graphics();
    panelGraphics.fillStyle(0x1b2a1b, 0.95); // dark grey-green background
    panelGraphics.lineStyle(4, 0xc0c0c0, 1); // silver border
    panelGraphics.fillRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
    panelGraphics.strokeRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 8);
    this.container.add(panelGraphics);

    // Add Irish text
    const irishText = this.scene.add.text(panelX, panelY - panelHeight/2 + panelPadding, irish, {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#ffffff',
        wordWrap: { width: panelWidth * 0.9 }
    }).setOrigin(0.5, 0);
    this.container.add(irishText);

    // Add English text if needed
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

    // Destroy temporary measurement text
    tempIrishText.destroy();
    if (tempEnglishText) tempEnglishText.destroy();

    // Auto-dismiss
    this.scene.time.delayedCall(4000, () => {
        this.hide();
    });
}





  startTypewriter() {
    this.typewriterActive = true;
    this.currentCharIndex = 0;
    this.typeNextCharacter();
  }

// Replace the typeNextCharacter method in TextPanel.js

typeNextCharacter() {
  if (!this.typewriterActive || !this.irishTextObject) return;

  if (this.currentCharIndex < this.irishFullText.length) {
    const char = this.irishFullText[this.currentCharIndex];
    const currentText = this.irishTextObject.text;

    // Check if we're at a space (end of word) or if next chars form a word that might wrap
    let textToAdd = char;

    // If we're adding a non-space character, look ahead to get the full word
    if (char !== ' ' && char !== '\n') {
      let lookAhead = '';
      let tempIndex = this.currentCharIndex;

      // Gather the rest of the current word
      while (tempIndex < this.irishFullText.length) {
        const nextChar = this.irishFullText[tempIndex];
        if (nextChar === ' ' || nextChar === '\n') break;
        lookAhead += nextChar;
        tempIndex++;
      }

      // Test if adding just this character would cause the word to wrap
      const testText = currentText + char;
      this.irishTextObject.setText(testText);
      const heightBefore = this.irishTextObject.height;

      // Now test with the full word
      const testWithWord = currentText + lookAhead;
      this.irishTextObject.setText(testWithWord);
      const heightAfter = this.irishTextObject.height;

      // If the word causes wrapping, add the whole word at once
      if (heightAfter > heightBefore) {
        textToAdd = lookAhead;
        this.currentCharIndex = tempIndex - 1; // Will be incremented below
      } else {
        // Reset to just adding the single character
        this.irishTextObject.setText(currentText);
      }
    }

    // Add character(s) with elegant, consistent styling
    const newText = currentText + textToAdd;
    this.irishTextObject.setText(newText);

    // Apply a subtle, constant glow that doesn't flicker
    this.irishTextObject.setStyle({
      fontSize: '22px',
      fontFamily: 'Urchlo',
      color: '#ffffff',
      wordWrap: { width: this.irishTextObject.style.wordWrapWidth },
      lineSpacing: 8,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: '#e6f3ff',  // Soft white-blue glow
        blur: 6,
        stroke: false,
        fill: true
      }
    });

    this.currentCharIndex++;

    // Continue to next character
    const speed = 40; // milliseconds per character
    this.scene.time.delayedCall(speed, () => this.typeNextCharacter());
  } else {
    // Typewriter complete - enhance the final appearance
    this.typewriterActive = false;
    
    // Apply a slightly stronger glow for the completed text
    this.irishTextObject.setStyle({
      fontSize: '22px',
      fontFamily: 'Urchlo',
      color: '#ffffff',
      wordWrap: { width: this.irishTextObject.style.wordWrapWidth },
      lineSpacing: 8,
      shadow: {
        offsetX: 0,
        offsetY: 1,
        color: '#c8e0ff',  // Slightly stronger glow when complete
        blur: 8,
        stroke: false,
        fill: true
      }
    });
    
    this.showEnglishText();
  }
}
  skipTypewriter() {
    this.typewriterActive = false;
    if (this.irishTextObject) {
      this.irishTextObject.setText(this.irishFullText);
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
  // Update main dialogue/examine English text
  if (this.englishTextObject && !this.typewriterActive) {
    this.englishTextObject.setAlpha(GameSettings.englishOpacity);
  }
  
  // Update all option English texts
  this.englishOptionTexts.forEach(optionText => {
    if (optionText && optionText.active) {
      optionText.setAlpha(GameSettings.englishOpacity);
    }
  });
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
        this.englishOptionTexts = []; // Add this line
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
