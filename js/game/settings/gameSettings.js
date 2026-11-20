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

// [enCurve] English opacity follows the moon's lit share on a curve, so it is only fully bright at the full moon.
// The moon widget and the title sky convert at their edge (phase <-> opacity); everything else just sees an opacity.
export const EN_CURVE = 2
export const englishAlpha = (phase) => Math.pow(Math.max(0, Math.min(1, phase)), EN_CURVE)
export const englishPhaseFromAlpha = (alpha) => Math.pow(Math.max(0, Math.min(1, alpha)), 1 / EN_CURVE)

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

