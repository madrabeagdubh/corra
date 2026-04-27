/**
 * hubEascaIntegration.js
 *
 * Drop this wiring into whichever Scene creates your GameMenuHub
 * (e.g. GameScene, UIScene, or wherever moonWidget.onTap lives).
 *
 * Assumes:
 *   - `this` is the Phaser scene
 *   - Easca3 and createGameMenuHub are already imported
 *   - The moon widget tap already calls hub.open() / hub.close()
 */

import Easca3             from '../ui/Easca3.js';          // adjust path as needed
import { createGameMenuHub } from '../ui/gameMenuHub.js';  // adjust path as needed

// ---------------------------------------------------------------------------
// 1. Callback fired when player sends a message from the keyboard
// ---------------------------------------------------------------------------
function onPlayerMessage(text) {
    console.log('[Labhair] Player said:', text);
    // TODO: pass `text` to your NPC dialogue handler, Firebase, or LLM endpoint.
    // e.g.  this.npcManager.receivePlayerInput(text);
    //       this.events.emit('playerSpoke', text);
}

// ---------------------------------------------------------------------------
// 2. Create the Easca3 keyboard (once, in scene create())
// ---------------------------------------------------------------------------

// In your scene's create() method:
//
//   this.easca = new Easca3(this, onPlayerMessage.bind(this));
//
// Easca3 starts hidden (setVisible(false) in its constructor),
// so it won't appear until the Labhair tab is opened.

// ---------------------------------------------------------------------------
// 3. Create the hub with Labhair callbacks wired up
// ---------------------------------------------------------------------------

//   this.hub = createGameMenuHub({
//
//       onInventoryOpen:  () => { this.worldMenu.show(); },
//       onInventoryClose: () => { this.worldMenu.hide(); },
//
//       onLabhairtOpen:   () => { this.easca.showKeyboard(); },
//       onLabhairtClose:  () => { this.easca.hideKeyboard(); },
//   });

// ---------------------------------------------------------------------------
// 4. Full minimal scene example
// ---------------------------------------------------------------------------

export class GameScene extends Phaser.Scene {

    create() {

        // -- Keyboard --
        this.easca = new Easca3(this, (text) => {
            console.log('[Labhair] Player said:', text);
            // Route to NPC / LLM here
        });

        // -- Hub --
        this.hub = createGameMenuHub({
            onInventoryOpen:  () => { this.worldMenu?.show(); },
            onInventoryClose: () => { this.worldMenu?.hide(); },
            onLabhairtOpen:   () => { this.easca.showKeyboard(); },
            onLabhairtClose:  () => { this.easca.hideKeyboard(); },
        });

        // -- Moon tap toggles hub --
        this.moonWidget = createMoonWidget({
            // ...your existing moon options...
            onTap: () => {
                if (this.hub.isOpen()) {
                    this.hub.close();
                } else {
                    this.hub.open();
                }
            },
        });
    }

    shutdown() {
        this.easca?.destroy();
        this.hub?.destroy();
        this.moonWidget?.destroy();
    }
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
//
// Z-INDEX LAYERING (no conflicts):
//   Phaser canvas            z-index: auto (below all fixed DOM)
//   Easca3 (Phaser layer)    depth: 1000   (canvas-internal, always below DOM)
//   moonWidget wrapper       z-index: 1000003
//   gameMenuHub root         z-index: 1000002
//   domArea (hub content)    z-index: inherited from hub
//
//   When Labhair is active:
//     - hub root is visible (z: 1000002) — tab bar shows
//     - domArea is hidden   — canvas shows through the gap below the tab bar
//     - Easca3 renders on canvas beneath, fully visible
//     - Tab bar stays on top so the player can swipe away
//
// EASCA3 VERTICAL POSITION:
//   The keyboard sits at canvas coordinates. If the tab bar covers the top
//   of the keyboard text display, nudge Easca3's textDisplay Y down by the
//   tab bar's pixel height (~42px typical). You can read it via:
//
//     const tabBarH = document.querySelector('#gameMenuHub > div')?.offsetHeight ?? 42;
//     this.easca.textDisplay.setY(this.easca.textDisplay.y + tabBarH);
//
//   Or pass tabBarOffset into Easca3's constructor and apply it in updateLayout().
//
// SEND CALLBACK → NPC DIALOGUE:
//   The second argument to `new Easca3(scene, callback)` is called with the
//   typed string when the player hits Send. Wire it to whatever receives
//   player input — a local NPC state machine, a Firebase write, or a fetch()
//   to your LLM endpoint.

