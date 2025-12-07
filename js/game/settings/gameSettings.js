

export const GameSettings = {
  englishOpacity: 0.7, // Default: 70% visible (0.0 = invisible, 1.0 = full brightness)
  
  setEnglishOpacity(value) {
    this.englishOpacity = Math.max(0, Math.min(1, value));
    // Could save to localStorage here if you want persistence
    // localStorage.setItem('englishOpacity', this.englishOpacity);
  },
  
  loadSettings() {
    // Load from localStorage if available
    // const saved = localStorage.getItem('englishOpacity');
    // if (saved !== null) this.englishOpacity = parseFloat(saved);
  }
};
