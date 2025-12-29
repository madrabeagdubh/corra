

export const GameSettings = {
  englishOpacity: 0.2,
  
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
