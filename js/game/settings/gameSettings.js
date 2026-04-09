/**
 * gameSettings.js
 * Central store for runtime game settings.
 * Dispatches a custom DOM event on change so any live UI can react.
 *
 * Listening for changes:
 *   window.addEventListener('englishOpacityChange', (e) => {
 *       const opacity = e.detail.opacity;  // 0–1
 *   });
 */

export const GameSettings = {
    englishOpacity:  0.15,
    lastMenuPanel:   'inventory',   // persists across open/close

    setEnglishOpacity(value) {
        const clamped = Math.max(0, Math.min(1, value));
        this.englishOpacity = clamped;

        // Broadcast to any listening UI (modal, HUD, etc.)
        window.dispatchEvent(new CustomEvent('englishOpacityChange', {
            detail: { opacity: clamped },
        }));
    },

    loadSettings() {},
};

