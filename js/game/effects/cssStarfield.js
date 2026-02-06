// cssStarfield.js - Pure CSS starfield (replacement for canvas starfield)

let starfieldElement = null;

/**
 * Initialize CSS starfield background
 * This replaces the canvas-based starfield with a pure CSS version
 */
export function initCSSStarfield() {
  console.log('[CSSStarfield] Initializing...');
  
  // Don't create duplicate
  if (starfieldElement && starfieldElement.parentNode) {
    console.log('[CSSStarfield] Already exists, skipping');
    return starfieldElement;
  }
  
  // Create main container
  const container = document.createElement('div');
  container.className = 'css-starfield-bg';
  container.id = 'cssStarfield';
  
  // Create stars container
  const starsContainer = document.createElement('div');
  starsContainer.className = 'css-stars-container';
  
  // Create three rotating groups for depth
  const groups = [
    { count: 80, class: 'fast' },
    { count: 80, class: '' },
    { count: 80, class: 'slow' }
  ];
  
  groups.forEach(group => {
    const swirlGroup = document.createElement('div');
    swirlGroup.className = `css-star-swirl ${group.class}`;
    
    for (let i = 0; i < group.count; i++) {
      const star = document.createElement('div');
      star.className = 'css-bg-star';
      
      // Random position in circular area
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 50; // 0-50% from center
      const x = 50 + Math.cos(angle) * dist;
      const y = 50 + Math.sin(angle) * dist;
      
      star.style.left = x + '%';
      star.style.top = y + '%';
      star.style.width = (Math.random() * 2 + 1) + 'px';
      star.style.height = star.style.width;
      star.style.animationDelay = (Math.random() * 3) + 's';
      star.style.animationDuration = (Math.random() * 2 + 2) + 's';
      
      swirlGroup.appendChild(star);
    }
    
    starsContainer.appendChild(swirlGroup);
  });
  
  container.appendChild(starsContainer);
  document.body.appendChild(container);
  
  starfieldElement = container;
  console.log('[CSSStarfield] Initialized successfully');
  
  return container;
}

/**
 * Stop/remove CSS starfield
 */
export function stopCSSStarfield() {
  console.log('[CSSStarfield] Stopping...');
  
  if (starfieldElement && starfieldElement.parentNode) {
    starfieldElement.parentNode.removeChild(starfieldElement);
    starfieldElement = null;
    console.log('[CSSStarfield] Removed');
  }
}

/**
 * Check if starfield is currently active
 */
export function isStarfieldActive() {
  return starfieldElement && starfieldElement.parentNode;
}

