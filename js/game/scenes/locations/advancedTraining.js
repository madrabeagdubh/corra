import Phaser from "phaser";
import { ScrollingTextPlayer } from '../../ui/scrollingTextPlayer.js';
import { wordPairs } from '/data/wordPairs';
import { TYPE, COLORS, FONTS } from '../../systems/gameTypography.js';

export default class AdvancedTraining {
  constructor(scene) {
    this.scene = scene;
    this.wordPairs = this.selectWordPairs();
    this.currentPairIndex = 0;
    this.isActive = false;
    this.darkTarget = null;
    this.lightTarget = null;
    this.currentTargetType = null;
    this.bullseyeHits = 0;
    this.totalHits = 0;
  }

  playSwoosh(volume = 0.5) {
    const sounds = ['metalSwoosh1', 'metalSwoosh2', 'metalSwoosh4'];
    const key = Phaser.Utils.Array.GetRandom(sounds);
    this.scene.sound.play(key, { volume, rate: Phaser.Math.FloatBetween(0.9, 1.1) });
  }

  start() {
    console.log('AdvancedTraining: starting');

    // Stop bowTutorial from calling showFarewell() due to arrow exhaustion
    this.scene._arrowsExhausted = true;
    this.scene.tutorialComplete  = true;

    // Restock arrows
    const inv = this.scene.player?.inventory;
    if (inv) {
      let restocked = false;
      for (let i = 0; i < inv.totalSlots; i++) {
        const item = inv.getItem(i);
        if (item?.id === 'arrows') { item.quantity = 20; restocked = true; break; }
      }
      if (!restocked) inv.addItem({ id: 'arrows', quantity: 20 });
    }

    // Reset bow mechanics so the new arrows are recognised
    this.scene.bowMechanics?.forceEnableAiming?.();

    if (!this.scene.anims.exists('dragon_idle')) {
      this.scene.anims.create({
        key: 'dragon_idle',
        frames: [{ key: 'dragon', frame: 0 }],
        frameRate: 1, repeat: -1
      });
      this.scene.anims.create({
        key: 'dragon_roar',
        frames: this.scene.anims.generateFrameNumbers('dragon', { start: 0, end: 1 }),
        frameRate: 4, repeat: -1
      });
    }

    this.cleanupTutorialElements();
    this.createTargets();
    this.showIntroduction();
  }

  cleanupTutorialElements() {
    if (this.scene.scathach) {
      this.scene.scathach.destroy(); this.scene.scathach = null;
    }
    if (this.scene.cape) {
      if (this.scene.capeUpdateCallback) {
        this.scene.events.off('update', this.scene.capeUpdateCallback);
      }
      this.scene.cape.destroy(); this.scene.cape = null;
    }
    if (this.scene.scathachHitbox) {
      this.scene.scathachHitbox.destroy(); this.scene.scathachHitbox = null;
    }
    if (this.scene.target) {
      if (this.scene._targetTween) { this.scene._targetTween.stop(); this.scene._targetTween = null; }
      this.scene.target.destroy(); this.scene.target = null;
    }
  }

  createTargets() {
    const pgr = this.scene.perspectiveGround;
    const ts  = this.scene.tileSize ?? 48;
    const sw  = this.scene.scale.width;
    const sh  = this.scene.scale.height;

    // Player at col=4, row=18. Push targets to row 3 (dy=-15) — far field,
    // near horizon. Separated by 4 tiles either side of centre.
    const SPAWN_LX = 12 * ts + ts / 2;
    const SPAWN_LY = 18 * ts + ts / 2;

    const darkLogX  = SPAWN_LX - 4 * ts;
    const darkLogY  = SPAWN_LY - 15 * ts;
    const lightLogX = SPAWN_LX + 4 * ts;
    const lightLogY = SPAWN_LY - 15 * ts;

    const darkProj  = pgr?._projectLogical(darkLogX,  darkLogY);
    const lightProj = pgr?._projectLogical(lightLogX, lightLogY);

    const margin = 50;
    const darkX  = Math.max(margin, Math.min(sw - margin, darkProj?.screenX  ?? sw * 0.25));
    const darkY  = Math.max(margin, Math.min(sh - margin, darkProj?.screenY  ?? sh * 0.55));
    const lightX = Math.max(margin, Math.min(sw - margin, lightProj?.screenX ?? sw * 0.75));
    const lightY = Math.max(margin, Math.min(sh - margin, lightProj?.screenY ?? sh * 0.55));

    const HIT_R = 40;

    this.darkTarget = this.scene.add.graphics();
    this.darkTarget.setPosition(darkX, darkY);
    this.darkTarget.setScrollFactor(0);
    this.darkTarget.setDepth(15);
    this.drawTarget(this.darkTarget, 'dark');
    this.darkTarget.setData('hit', false);
    this.darkTarget.setData('type', 'dark');
    this.darkTarget._hitRadius = HIT_R;
    this.darkTarget.logicalX   = null;

    this.lightTarget = this.scene.add.graphics();
    this.lightTarget.setPosition(lightX, lightY);
    this.lightTarget.setScrollFactor(0);
    this.lightTarget.setDepth(15);
    this.drawTarget(this.lightTarget, 'light');
    this.lightTarget.setData('hit', false);
    this.lightTarget.setData('type', 'light');
    this.lightTarget._hitRadius = HIT_R;
    this.lightTarget.logicalX   = null;

    console.log('[AdvancedTraining] targets — dark:', darkX.toFixed(0), darkY.toFixed(0),
      'light:', lightX.toFixed(0), lightY.toFixed(0), 'radius:', HIT_R);
  }

  drawTarget(target, type) {
    const R = 24;
    target.clear();
    if (type === 'dark') {
      target.fillStyle(0x111111, 1); target.fillCircle(0, 0, R);
      target.fillStyle(0x4488ff, 1); target.fillCircle(0, 0, R * 0.70);
      target.fillStyle(0x111111, 1); target.fillCircle(0, 0, R * 0.45);
      target.fillStyle(0x4488ff, 1); target.fillCircle(0, 0, R * 0.20);
    } else {
      target.fillStyle(0xffffff, 1); target.fillCircle(0, 0, R);
      target.fillStyle(0x4488ff, 1); target.fillCircle(0, 0, R * 0.70);
      target.fillStyle(0xffffff, 1); target.fillCircle(0, 0, R * 0.45);
      target.fillStyle(0x4488ff, 1); target.fillCircle(0, 0, R * 0.20);
    }
  }

  showIntroduction() {
    // Reset narrative flag and use flashLine so it doesn't block
    this.scene.narrativeInProgress = false;
    this.scene._flashLine(
      'Níl ach ceann scríbe amháin ag an saighead.',
      'The arrow has but one destiny.'
    );
    this.scene.time.delayedCall(2200, () => {
      this.isActive = true;
      this.showNextWord();
    });
  }

  selectWordPairs() {
    const banDubhPair = wordPairs.find(p => p.light.irish === 'Bán' && p.dark.irish === 'Dubh');
    const others      = wordPairs.filter(p => !(p.light.irish === 'Bán' && p.dark.irish === 'Dubh'));
    return [banDubhPair, ...Phaser.Utils.Array.Shuffle([...others]).slice(0, 9)];
  }

  showNextWord() {
    if (this.currentPairIndex >= this.wordPairs.length) { this.complete(); return; }

    const pair    = this.wordPairs[this.currentPairIndex];
    const doLight = Math.random() > 0.5;
    const word    = doLight ? pair.light : pair.dark;
    this.currentTargetType = doLight ? 'light' : 'dark';

    this._showWordPrompt(word.irish, word.english);
  }

  _showWordPrompt(irish, english) {
    this._clearWordPrompt();

    const sw       = this.scene.scale.width;
    const sh       = this.scene.scale.height;
    const moonPhase = this.scene._moonWidget?.getPhase?.() ?? 0.7;

    // Irish word — uses game typography body style, queen colour
    this._wordPromptIrish = this.scene.add.text(sw / 2, sh * 0.30, irish, {
      fontSize:        TYPE.body.size,
      fontFamily:      FONTS.irish,
      color:           COLORS.queen,
      stroke:          '#000000',
      strokeThickness: 4,
      align:           'center',
    }).setOrigin(0.5).setDepth(500).setScrollFactor(0);

    // English translation — bodyEn style, english colour, moon-gated opacity
    this._wordPromptEnglish = this.scene.add.text(sw / 2, sh * 0.30 + 40, english, {
      fontSize:        TYPE.bodyEn.size,
      fontFamily:      FONTS.english,
      color:           COLORS.english,
      stroke:          '#000000',
      strokeThickness: 3,
      align:           'center',
    }).setOrigin(0.5).setDepth(500).setScrollFactor(0).setAlpha(moonPhase);
  }

  _clearWordPrompt() {
    if (this._wordPromptIrish)   { this._wordPromptIrish.destroy();   this._wordPromptIrish   = null; }
    if (this._wordPromptEnglish) { this._wordPromptEnglish.destroy(); this._wordPromptEnglish = null; }
  }

  update() {
    if (!this.isActive) return;

    // Keep English opacity in sync with moon widget
    if (this._wordPromptEnglish) {
      this._wordPromptEnglish.setAlpha(this.scene._moonWidget?.getPhase?.() ?? 0.7);
    }

    if (this.darkTarget && !this.darkTarget.getData('hit')) {
      const hit = this.scene.bowMechanics.checkHit(this.darkTarget, this.darkTarget._hitRadius ?? 40);
      if (hit) this.onTargetHit('dark');
    }
    if (this.lightTarget && !this.lightTarget.getData('hit')) {
      const hit = this.scene.bowMechanics.checkHit(this.lightTarget, this.lightTarget._hitRadius ?? 40);
      if (hit) this.onTargetHit('light');
    }
  }

  onTargetHit(targetType) {
    const correct = targetType === this.currentTargetType;

    if (correct) {
      const target = targetType === 'dark' ? this.darkTarget : this.lightTarget;
      this.totalHits++;
      this._clearWordPrompt();

      target.clear();
      target.fillStyle(0x00ff00, 1);
      target.fillCircle(0, 0, 24);
      target.setData('hit', true);

      this.scene.time.delayedCall(1200, () => {
        if (!target?.scene) return;
        this.drawTarget(target, targetType);
        target.setData('hit', false);
        this.currentPairIndex++;
        this.showNextWord();
      });
    } else {
      // Flash wrong target red briefly
      const wrong = targetType === 'dark' ? this.darkTarget : this.lightTarget;
      if (wrong) {
        wrong.clear();
        wrong.fillStyle(0xff2200, 1);
        wrong.fillCircle(0, 0, 24);
        this.scene.time.delayedCall(500, () => {
          if (wrong?.scene) this.drawTarget(wrong, targetType);
        });
      }
    }
  }

  complete() {
    this.isActive = false;
    this._clearWordPrompt();
    // Hide targets
    if (this.darkTarget)  this.darkTarget.setVisible(false)
    if (this.lightTarget) this.lightTarget.setVisible(false)
    // Disable bow
    if (this.scene.bowMechanics) this.scene.bowMechanics.disabled = true
    this.createScathachForKata();
  }

  // ── Scáthach kata sequence ─────────────────────────────────────────────────

  createScathachForKata() {
    this.dragonKataComplete = false;
    const sw  = this.scene.scale.width;
    const sh  = this.scene.scale.height;
    const pgr = this.scene.perspectiveGround
    const ts  = this.scene.tileSize ?? 48

    // Place Scáthach at far field -- same col as player, row 3
    const SPAWN_LX = 12 * ts + ts / 2
    const SPAWN_LY = 28 * ts + ts / 2
    const scathLogX = SPAWN_LX
    const scathLogY = SPAWN_LY - 15 * ts
    const proj = pgr?._projectLogical(scathLogX, scathLogY)
    const tileRow = scathLogY / ts - 0.5
    const scaledW = pgr?._scaleAtRow(tileRow + 1) ?? 20
    const scathScale = Math.min((scaledW / ts) * 5.0, 6.0)

    const targetX = proj?.screenX ?? sw * 0.5
    const targetY = proj?.screenY ?? sh * 0.45

    const camScrollX2 = this.scene.cameras.main.scrollX
    const camScrollY2 = this.scene.cameras.main.scrollY
    const worldTargetY = targetY + camScrollY2
    this.scene.scathach = this.scene.add.image(sw + camScrollX2 + 50, worldTargetY, 'scathach');
    this.scene.scathach.setScale(scathScale).setDepth(20);

    this.spear = this.scene.add.container(this.scene.scathach.x - 1, this.scene.scathach.y + 20);
    this.spear.setDepth(19);
    const sg = this.scene.add.graphics();
    sg.lineStyle(3, 0x8b4513, 1); sg.lineBetween(0, 0, 0, -60);
    sg.fillStyle(0xcd7f32, 1); sg.fillTriangle(-4, -60, 4, -60, 0, -75);
    this.spear.add(sg);

    const worldTargetX = targetX + this.scene.cameras.main.scrollX
    this.hobbleToCenter(worldTargetX);
  }

  hobbleToCenter(targetX) {
    const duration = 3500
    if (this.spear) {
      this.scene.tweens.add({
        targets: this.spear, x: targetX,
        duration, ease: 'Sine.easeInOut'
      })
    }
    this.scene.tweens.add({
      targets: [this.scene.scathach, this.spear], x: targetX,
      duration, ease: 'Sine.easeInOut',
    });
    setTimeout(() => { this.revealSpear1(); }, duration + 500);
  }

  _tell(lines, onComplete) {
    // Use a dedicated storyPlayer channel for advancedTraining
    // so it doesn't conflict with bowTutorial's storyPlayer
    if (this._tellPlayer) { this._tellPlayer.destroy(); this._tellPlayer = null }



    const canvas    = this.scene.sys.game.canvas
    const container = canvas.parentElement || document.body
    const H         = window.innerHeight

    this._tellPlayer = new ScrollingTextPlayer({
      lines: lines.map(l => ({ ga: l.ga, en: l.en, speaker: l.speaker || 'queen' })),
      getMoonPhase: () => this.scene._moonWidget?.getPhase?.() ?? 0.7,
      onComplete: () => { this._tellPlayer = null; if (onComplete) onComplete() },
      container,
    })

    this._tellPlayer.start()

    const vel = 50 / 60
    this._tellPlayer._naturalVel     = vel
    this._tellPlayer._velocity       = vel
    this._tellPlayer._ceilingY       = 999999
    this._tellPlayer._onReachCeiling = function() {}
    this._tellPlayer._onComplete     = function() {}
    this._tellPlayer._scrollY        = H * 0.5

    if (this._tellPlayer._hitZone) {
      const hz = this._tellPlayer._hitZone
      hz.style.top    = '0px'
      hz.style.height = (H * 0.5) + 'px'
      hz.style.bottom = ''
      hz.style.pointerEvents = 'all'
    }
    if (this._tellPlayer._overlay) {
      this._tellPlayer._overlay.style.pointerEvents = 'none'
    }

    const MID_PX  = H * 0.5
    const CEIL_PX = 8
    const FADE_PX = 80
    this._tellPlayer._render = function() {
      if (!this._overlay) return
      const mp = this._getMoonPhase()
      for (const entry of this._lineEls) {
        const y      = this._screenY(entry)
        const bottom = y + entry.wrapper.offsetHeight
        entry.wrapper.style.top = y + 'px'
        if (bottom < 0 || y > MID_PX + 40) {
          entry.gaEl.style.opacity = '0'
          if (entry.enEl) entry.enEl.style.opacity = '0'
          continue
        }
        let alpha = 1
        if (y < CEIL_PX + FADE_PX) alpha = Math.max(0, (y - CEIL_PX) / FADE_PX)
        if (bottom > MID_PX - FADE_PX) alpha = Math.min(alpha, Math.max(0, (MID_PX - y) / FADE_PX))
        entry.gaEl.style.opacity = String(alpha)
        if (entry.enEl) entry.enEl.style.opacity = String(alpha * mp)
      }
    }

    // Poll for completion
    const player = this._tellPlayer
    const poll = setInterval(() => {
      if (!player || !player._lineEls) { clearInterval(poll); return }
      const last = player._lineEls[player._lineEls.length - 1]
      if (!last) return
      const lastY = player._screenY(last)
      if (lastY < 0) {
        clearInterval(poll)
        player._running = false
        if (player._overlay) {
          player._overlay.style.transition = 'opacity 0.8s ease'
          player._overlay.style.opacity = '0'
        }
        setTimeout(() => {
          if (player.destroy) player.destroy()
          if (this._tellPlayer === player) this._tellPlayer = null
          if (onComplete) onComplete()
        }, 900)
      }
    }, 150)
  }

  revealSpear1() {
    console.log('[AT] revealSpear1')
    this._tell([
      { ga: 'Fíor nó bréagach. Bás nó saol. Sin a nochtan an saighead. Sin uile',
        en: 'True or false. Death or life. So reveals the arrow. Nothing more.', speaker: 'queen' }
    ], () => { this.spearKata1(); });
  }

  spearKata1() {
    console.log('[AT] spearKata1')
    const startX = this.scene.scathach.x;
    const startY = this.scene.scathach.y;
    this.scene.scathach.setFlipX(true);
    this._tell([
      { ga: 'Ní mar sin an ga.\nGuth na nGael, úfás ár naimhde...',
        en: 'Not so the spear.\nVoice of our people, terror of our foes...', speaker: 'queen' }
    ], () => { this.revealSpear2(); });
    this.scene.tweens.add({
      targets: this.scene.scathach, x: startX + 60, y: startY - 5,
      duration: 800, ease: 'Sine.easeInOut',
      onComplete: () => { this.scene.scathach.setFlipX(false); }
    });
    if (this.spear) {
      this.scene.tweens.add({
        targets: this.spear, x: this.spear.x + 60, y: this.spear.y - 5,
        duration: 800, ease: 'Sine.easeInOut'
      });
    }
  }

  revealSpear2() {
    console.log('[AT] revealSpear2')
    this._tell([
      { ga: '...ní dheiltar dán an ga.', en: '...spearfate is irreducable.', speaker: 'queen' }
    ], () => { this.revealSpear3(); });
    this.spearKata2();
  }

  spearKata2() {
    const scathachX = this.scene.scathach.x;
    const scathachY = this.scene.scathach.y;
    if (this.spear) this.spear.setVisible(false);

    const spear = this.scene.add.container(scathachX, scathachY);
    spear.setDepth(this.scene.scathach.depth + 1);
    const sg = this.scene.add.graphics();
    sg.lineStyle(4, 0x8b4513, 1); sg.lineBetween(-25, 0, 25, 0);
    sg.fillStyle(0xcd7f32, 1); sg.fillTriangle(25, -6, 25, 6, 37, 0);
    spear.add(sg);

    this.scene.tweens.add({
      targets: this.scene.scathach, y: scathachY - 10, duration: 300, ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({ targets: spear, y: scathachY - 200, angle: 720, duration: 800, ease: 'Quad.easeOut' });
        this.scene.time.delayedCall(100, () => {
          this.scene.tweens.add({
            targets: this.scene.scathach, y: scathachY - 120, angle: -360, duration: 600, ease: 'Sine.easeInOut',
            onComplete: () => {
              this.scene.scathach.angle = 0;
              this.scene.tweens.add({ targets: this.scene.scathach, y: scathachY, duration: 300, ease: 'Bounce.easeOut' });
            }
          });
        });
        this.scene.time.delayedCall(700, () => {
          this.scene.tweens.add({
            targets: spear, y: scathachY, x: scathachX, angle: 0, duration: 200, ease: 'Back.easeIn',
            onComplete: () => {
              this.scene.tweens.add({
                targets: spear, angle: 180, duration: 150, yoyo: true,
                onComplete: () => {
                  spear.destroy();
                  if (this.spear) {
                    this.spear.setVisible(true);
                    this.spear.x = this.scene.scathach.x - 5;
                    this.spear.y = this.scene.scathach.y + 20;
                  }
                }
              });
              this.scene.cameras.main.shake(100, 0.003);
            }
          });
        });
      }
    });
  }

  revealSpear3() {
    // "She is the dragon of weapons" — dragon appears as the words are spoken
    this._tell([
      { ga: 'Óllphéist na nairm í.', en: 'She is the dragon of weapons.', speaker: 'queen' }
    ], () => {
      // Dragon cinematic fires on completion of this line, THEN we go to revealSpear4
      this.showDragonSilhouette(this.scene.scale.width / 2, this.scene.scale.height * 0.25);
      // Wait for dragon sequence (~6s) before next speech
      this.scene.time.delayedCall(6500, () => { this.revealSpear4(); });
    });
    this.spearKata3();
  }

  drawSlashEffect(x, y, angleOffset, color) {
    if (!this.slashEffect) return;
    const r = 80;
    const s = -Math.PI / 4 + angleOffset;
    const e = Math.PI / 4 + angleOffset;
    this.slashEffect.lineStyle(4, color, 0.8);
    this.slashEffect.beginPath(); this.slashEffect.arc(x, y, r, s, e, false); this.slashEffect.strokePath();
    this.slashEffect.lineStyle(8, color, 0.3);
    this.slashEffect.beginPath(); this.slashEffect.arc(x, y, r - 5, s, e, false); this.slashEffect.strokePath();
    this.scene.tweens.add({ targets: this.slashEffect, alpha: 0, duration: 400, ease: 'Power2' });
  }

  spearKata3() {
    const sx = this.scene.scathach.x;
    const sy = this.scene.scathach.y;
    this.slashEffect = this.scene.add.graphics().setDepth(25);

    this.scene.tweens.add({
      targets: this.scene.scathach, x: sx + 50, duration: 400, ease: 'Power2.easeOut',
      onStart: () => {
        this.playSwoosh(0.6);
        if (this.spear) this.scene.tweens.add({ targets: this.spear, angle: 360, x: this.spear.x + 50, duration: 400, ease: 'Linear' });
        this.drawSlashEffect(sx + 25, sy, Math.PI / 4, 0xff4400);
        this.scene.cameras.main.shake(100, 0.003);
      },
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.scene.scathach, y: sy - 120, duration: 400, ease: 'Power2.easeOut',
          onStart: () => {
            this.playSwoosh(0.7);
            if (this.spear) this.scene.tweens.add({ targets: this.spear, angle: 720, y: this.spear.y - 120, duration: 400, ease: 'Power2.easeOut' });
            this.drawSlashEffect(sx + 50, sy - 60, -Math.PI / 3, 0xff6600);
            this.scene.cameras.main.shake(150, 0.004);
          },
          onComplete: () => {
            this.scene.tweens.add({
              targets: this.scene.scathach, angle: 360, duration: 350, ease: 'Linear',
              onStart: () => {
                this.playSwoosh(0.8);
                if (this.spear) this.scene.tweens.add({ targets: this.spear, angle: 360, duration: 350, ease: 'Linear' });
                this.drawSlashEffect(sx + 50, sy - 120, 0, 0xff8800);
                this.scene.cameras.main.shake(150, 0.005);
              },
              onComplete: () => {
                this.scene.scathach.angle = 0;
                this.scene.tweens.add({
                  targets: this.scene.scathach, y: sy, x: sx + 30, angle: 540, duration: 500, ease: 'Power2.easeIn',
                  onStart: () => {
                    this.playSwoosh(0.9);
                    if (this.spear) this.scene.tweens.add({ targets: this.spear, angle: 540, y: this.spear.y + 120, x: this.spear.x - 20, duration: 500, ease: 'Power2.easeIn' });
                    this.drawSlashEffect(sx + 50, sy - 90, -Math.PI / 6, 0xffaa00);
                    this.scene.time.delayedCall(150, () => { this.drawSlashEffect(sx + 40, sy - 60, Math.PI / 3, 0xffcc00); });
                    this.scene.time.delayedCall(300, () => { this.drawSlashEffect(sx + 30, sy - 30, -Math.PI / 4, 0xffdd00); });
                  },
                  onComplete: () => {
                    this.scene.scathach.angle = 0;
                    this.scene.tweens.add({
                      targets: this.scene.scathach, y: sy + 10, duration: 100, ease: 'Power2.easeIn',
                      onComplete: () => {
                        this.scene.tweens.add({
                          targets: this.scene.scathach, x: sx + 70, y: sy, duration: 250, ease: 'Back.easeOut',
                          onStart: () => {
                            this.playSwoosh(1);
                            if (this.spear) {
                              this.scene.tweens.add({
                                targets: this.spear, x: this.spear.x + 90, angle: -90, duration: 250, ease: 'Back.easeOut',
                                onComplete: () => { this.scene.tweens.add({ targets: this.spear, angle: 0, duration: 200 }); }
                              });
                            }
                            this.drawSlashEffect(sx + 70, sy, 0, 0xffff00);
                            this.scene.cameras.main.shake(250, 0.01);
                          },
                          onComplete: () => {
                            this.scene.tweens.add({ targets: this.scene.scathach, x: sx, y: sy, duration: 400, ease: 'Sine.easeInOut' });
                            if (this.spear) this.scene.tweens.add({ targets: this.spear, x: sx - 5, y: sy + 20, angle: 0, duration: 400, ease: 'Sine.easeInOut' });
                            if (this.slashEffect) { this.slashEffect.destroy(); this.slashEffect = null; }
                          }
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  spearKata4() {
    // Ethereal levitation — dragon has already appeared in revealSpear3.
    // This kata is pure presence: she rises, glows, lands.
    const sx = this.scene.scathach.x;
    const sy = this.scene.scathach.y;

    // Ethereal glow — cleaned up after landing
    this.etherealGlow = this.scene.add.circle(sx, sy, 70, 0xffffff, 0.12).setDepth(18);
    this.dragonKataComplete = true;

    this.scene.tweens.add({
      targets: this.scene.scathach, y: sy - 60, duration: 1200, ease: 'Sine.easeInOut',
      yoyo: true, hold: 800,
      onComplete: () => {
        // Clean up glow on landing
        if (this.etherealGlow) {
          this.scene.tweens.add({
            targets: this.etherealGlow, alpha: 0, duration: 600,
            onComplete: () => { if (this.etherealGlow) { this.etherealGlow.destroy(); this.etherealGlow = null; } }
          });
        }
        this.revealSpear4();
      }
    });
    if (this.spear) {
      this.scene.tweens.add({ targets: this.spear, y: this.spear.y - 60, duration: 1200, ease: 'Sine.easeInOut', yoyo: true, hold: 800 });
    }
    this.scene.tweens.add({ targets: this.etherealGlow, y: sy - 60, duration: 1200, ease: 'Sine.easeInOut', yoyo: true, hold: 800 });
  }

  executeThreeSlashes(x, y) {
    this.createSpearSlash(x, y, Math.PI / 6, 0xff0000);
    this.scene.cameras.main.shake(200, 0.005);
    this.scene.time.delayedCall(400, () => {
      this.createSpearSlash(x, y, -Math.PI / 6, 0xff6600);
      this.scene.cameras.main.shake(300, 0.008);
      this.scene.time.delayedCall(400, () => {
        this.createSpearSlash(x, y, 0, 0xff8800);
        this.scene.cameras.main.shake(400, 0.01);
        this.scene.time.delayedCall(300, () => { this.hurlSpearAtMountain(x, y); });
      });
    });
  }

  createSpearSlash(x, y, angle, color) {
    if (this.spear) {
      this.scene.tweens.add({ targets: this.spear, angle: (angle * 180 / Math.PI) - 90, duration: 150, ease: 'Power2.easeOut', yoyo: true });
    }
    const slash = this.scene.add.graphics().setDepth(26);
    const len = 200;
    slash.lineStyle(6, color, 1);
    slash.lineBetween(x + Math.cos(angle) * -len/2, y + Math.sin(angle) * -len/2, x + Math.cos(angle) * len/2, y + Math.sin(angle) * len/2);
    slash.lineStyle(15, color, 0.3);
    slash.lineBetween(x + Math.cos(angle) * -len/2, y + Math.sin(angle) * -len/2, x + Math.cos(angle) * len/2, y + Math.sin(angle) * len/2);
    this.scene.tweens.add({ targets: slash, alpha: 0, duration: 600, onComplete: () => slash.destroy() });
  }

  hurlSpearAtMountain(x, y) {
    if (!this.spear) return;
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const tx = sw / 2, ty = sh * 0.25;
    this.spear.setVisible(false);

    const thrown = this.scene.add.container(x, y).setDepth(25);
    const sg = this.scene.add.graphics();
    sg.lineStyle(4, 0x8b4513, 1); sg.lineBetween(-25, 0, 25, 0);
    sg.fillStyle(0xcd7f32, 1); sg.fillTriangle(25, -6, 25, 6, 37, 0);
    thrown.add(sg);
    thrown.angle = Math.atan2(ty - y, tx - x) * 180 / Math.PI;

    this.scene.tweens.add({
      targets: thrown, x: tx, y: ty, scale: 0.1, duration: 800, ease: 'Power2.easeIn',
      onComplete: () => {
        this.showDragonSilhouette(tx, ty);
        thrown.setVisible(false);
        this.scene.time.delayedCall(200, () => { this.returnSpearToScathach(thrown, x, y); });
      }
    });
  }

  returnSpearToScathach(thrown, sx, sy) {
    thrown.setVisible(true);
    this.scene.tweens.add({
      targets: thrown, x: sx, y: sy, scale: 1, angle: -90, duration: 600, ease: 'Power2.easeOut',
      onComplete: () => {
        thrown.destroy();
        if (this.spear) {
          this.spear.setVisible(true);
          this.spear.x = this.scene.scathach.x - 5;
          this.spear.y = this.scene.scathach.y + 20;
          this.spear.angle = 0;
        }
      }
    });
  }

  showDragonSilhouette(x, y) {
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const dsx = this.scene.cameras.main.scrollX
    const dsy = this.scene.cameras.main.scrollY
    const dark = this.scene.add.rectangle(sw/2 + dsx, sh/2 + dsy, sw, sh, 0x000000, 0).setDepth(420);
    this.scene.tweens.add({ targets: dark, alpha: 0.75, duration: 800 });

    const ds = (sw * 1.1) / 500;
    let dragon;
    if (this.scene.textures.exists('dragon')) {
      const dScrollX = this.scene.cameras.main.scrollX
      const dScrollY = this.scene.cameras.main.scrollY
      dragon = this.scene.add.sprite(sw + dScrollX + 400, dScrollY - 300, 'dragon')
        .setScale(ds).setOrigin(0.5, 0).setDepth(430).setAngle(-45);
      dragon.play('dragon_idle');
    } else {
      dragon = this.scene.add.graphics().setDepth(430);
      dragon.fillStyle(0x8b0000, 0.9); dragon.fillTriangle(0, 0, -120, 200, 120, 200);
      dragon.x = sw + 200; dragon.y = -100; dragon.angle = -45;
    }

    this.scene.cameras.main.shake(400, 0.005);
    this.scene.tweens.add({
      targets: dragon, x: sw * 0.55, y: sh * 0.08, duration: 2800, ease: 'Sine.easeIn',
      onComplete: () => {
        if (dragon.play) dragon.play('dragon_roar');
        this.scene.cameras.main.shake(1400, 0.02);
        const flash = this.scene.add.rectangle(sw/2, sh/2, sw, sh, 0xff2200, 0).setDepth(425);
        this.scene.tweens.add({ targets: flash, alpha: 0.4, duration: 100, yoyo: true, repeat: 3, onComplete: () => flash.destroy() });
        this._spawnDragonFire(dragon, sw, sh, ds);
        this.scene.time.delayedCall(1800, () => {
          if (dragon.play) dragon.play('dragon_idle');
          this.scene.cameras.main.shake(400, 0.01);
          this.scene.tweens.add({
            targets: dragon, x: -sw * 0.8, y: -400, duration: 2400, ease: 'Sine.easeOut',
            onComplete: () => {
              dragon.destroy();
              this.scene.tweens.add({ targets: dark, alpha: 0, duration: 1600, onComplete: () => dark.destroy() });
            }
          });
        });
      }
    });
  }

  _spawnDragonFire(dragon, sw, sh, ds) {
    for (let b = 0; b < 18; b++) {
      this.scene.time.delayedCall(b * 120, () => {
        if (!dragon?.active && !dragon?.scene) return;
        const lx = -250 * ds, ly = 160 * ds;
        const mx = dragon.x + 0.7071 * lx + 0.7071 * ly;
        const my = dragon.y - 0.7071 * lx + 0.7071 * ly;
        for (let i = 0; i < Phaser.Math.Between(4, 7); i++) {
          const p = this.scene.add.rectangle(
            mx + Phaser.Math.Between(-12, 12), my + Phaser.Math.Between(-8, 8),
            Phaser.Math.Between(8, 22), Phaser.Math.Between(8, 22),
            Phaser.Utils.Array.GetRandom([0xff4400,0xff8800,0xffcc00,0xff2200]), 0.95
          ).setDepth(435).setOrigin(0.5);
          this.scene.tweens.add({
            targets: p, x: mx + Phaser.Math.Between(-sw*0.45, -sw*0.05),
            y: my + Phaser.Math.Between(sh*0.2, sh*0.45),
            scaleX: Phaser.Math.FloatBetween(0.05, 0.4), scaleY: Phaser.Math.FloatBetween(0.05, 0.4),
            alpha: 0, duration: Phaser.Math.Between(700, 1400), ease: 'Power1.easeOut',
            onComplete: () => p.destroy()
          });
        }
      });
    }
  }

  revealSpear4() {
    if (!this.dragonKataComplete) {
      this._tell([
        { ga: 'I fraoch nó i bhfriotal\nón slea a thiochfaidh cáil ort.',
          en: 'In fury or restraint you will be known by your spear', speaker: 'queen' }
      ], () => { this.spearKata4(); });
    } else {
      this._tell([
        { ga: 'Ach ní go fóill. Móin Alúinne ar dtús. Ansin, an ga.',
          en: '...but not yet. First, the Bog of Allen. Then the spear.', speaker: 'queen' }
      ], () => { this.grantMagicArrows(); });
    }
  }

  grantMagicArrows() {
    if (this.scene.bowMechanics) this.scene.bowMechanics.disabled = false
    this.scene.registry.set('magicArrows', this.bullseyeHits);
    if (this.bullseyeHits > 0) {
      this.scene._flashLine(
        `Bronadh ${this.bullseyeHits} saighead draíochta ort!`,
        `You were presented with ${this.bullseyeHits} magic arrows!`
      );
      this.scene.time.delayedCall(4000, () => { if (this.scene.showFarewell) this.scene.showFarewell(); });
    } else {
      if (this.scene.showFarewell) this.scene.showFarewell();
    }
  }

  cleanup() {
    this._clearWordPrompt();
    if (this.darkTarget)  { this.darkTarget.destroy();  this.darkTarget  = null; }
    if (this.lightTarget) { this.lightTarget.destroy(); this.lightTarget = null; }
    if (this.slashEffect) { this.slashEffect.destroy(); this.slashEffect = null; }
    ;['etherealGlow','darkOverlay'].forEach(k => { if (this[k]) { this[k].destroy(); this[k] = null; } });
    this.isActive = false;
  }
}

