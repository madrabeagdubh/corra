export function showCharacterModal(champion) {
    let modal = document.getElementById('characterModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'characterModal';
        
        modal.style.cssText = `
            position: fixed !important;
	    top: 40px !important;
            left: 0 !important;
            width: 100vw !important;
            height: calc(100vh - 160px) !important;
            background-color: transparent !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            align-items: center !important;
            z-index: 990 !important;
            overflow: hidden !important;
            pointer-events: none !important;
        `;
        
        const content = document.createElement('div');
        content.id = 'characterModalContent';
        content.style.cssText = `
            background-color: #2a1810 !important;
            color: white !important;
            padding: 20px !important;
            border-radius: 12px !important;
            border: 3px solid #888 !important;
            width: 90% !important;
            max-width: 800px !important;
            height: 90% !important;
            overflow-y: auto !important;
            position: relative !important;
            font-family: monospace !important;
            pointer-events: auto !important;
            display: flex !important;
            flex-direction: column !important;
        `;

        modal.appendChild(content);

        modal.addEventListener('click', e => {
            if (e.target === modal) {
                // Don't remove on modal click since it's transparent now
            }
        });

        document.body.appendChild(modal);
    }

    const content = document.getElementById('characterModalContent');

    // Stat icons mapping
    const statIcons = {
        attack: '⚔️',
        defense: '🛡️',
        health: '❤️',
        speed: '🪽',
        magic: '✨',
        luck: '☘️'
    };

    // Build stats HTML in the specified order
    const statsOrder = ['attack', 'defense', 'health', 'speed', 'magic', 'luck'];
    const statsHTML = statsOrder.map(stat => {
        const value = champion.stats[stat];
        return `<span style="margin-right: 15px; font-size: 1.1em;">${statIcons[stat]} ${value}</span>`;
    }).join('');

    // Add name above the box
    const existingName = document.getElementById('modalChampionName');
    if (existingName) existingName.remove();
    
    const nameHeader = document.createElement('h2');
    nameHeader.id = 'modalChampionName';
    nameHeader.textContent = champion.nameGa;
    nameHeader.style.cssText = `
        color: white !important;
        text-align: center !important;
        font-size: 28px !important;
        margin: 0 0 10px 0 !important;
        font-family: monospace !important;
        pointer-events: none !important;
    `;
    modal.insertBefore(nameHeader, content);
    
    content.innerHTML = `
        <div style="flex: 0 0 auto;">
            <p id="bioGaText" style="color: white; font-size: 20px; line-height: 1.6; min-height: 3em; margin-top: 0;"></p>
            <p id="bioEnText" class="modal-bio-en" style="color: #00ff00; font-size: 20px; line-height: 1.6; opacity: 0; transition: opacity 0.8s ease;"></p>
        </div>
        <div style="flex: 1 1 auto;"></div>
        <div style="flex: 0 0 auto;">
            <div style="margin: 15px 0; padding: 10px; background-color: rgba(0,0,0,0.3); border-radius: 8px; text-align: center;">
                ${statsHTML}
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <button id="closeModalBtn" style="
                    padding: 10px 30px;
                    font-size: 16px;
                    background-color: #4a3020;
                    color: white;
                    border: 2px solid #888;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    font-family: monospace;
                ">Siar</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // Typewriter effect for Irish bio
    const bioGaElement = document.getElementById('bioGaText');
    const bioEnElement = document.getElementById('bioEnText');
    const irishText = champion.charBioGa;
    const englishText = champion.charBioEn;
    
    let charIndex = 0;
    const typewriterSpeed = 40; // milliseconds per character
    
    function typeNextCharacter() {
        if (charIndex < irishText.length) {
            const char = irishText[charIndex];
            const span = document.createElement('span');
            span.textContent = char;
            span.style.cssText = `
                display: inline;
                animation: letterAppear 0.4s ease;
                text-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
            `;
            
            bioGaElement.appendChild(span);
            
            // Remove the glow after animation
            setTimeout(() => {
                span.style.textShadow = 'none';
            }, 400);
            
            charIndex++;
            setTimeout(typeNextCharacter, typewriterSpeed);
        } else {
            // Irish text complete, show English after delay
            setTimeout(() => {
                bioEnElement.textContent = englishText;
                
                // Get slider value for opacity
                const slider = document.querySelector('.champion-slider');
                const targetOpacity = slider ? slider.value : 1;
                bioEnElement.style.opacity = targetOpacity;
                
                // Update opacity when slider changes
                if (slider) {
                    slider.addEventListener('input', () => {
                        bioEnElement.style.opacity = slider.value;
                    });
                }
            }, 600);
        }
    }
    
    // Add CSS animation for letter appearance
    if (!document.getElementById('typewriterStyles')) {
        const style = document.createElement('style');
        style.id = 'typewriterStyles';
        style.textContent = `
            @keyframes letterAppear {
                0% {
                    opacity: 0;
                    transform: scale(1.3);
                    text-shadow: 0 0 15px rgba(255, 200, 100, 1);
                }
                50% {
                    transform: scale(1.1);
                }
                100% {
                    opacity: 1;
                    transform: scale(1);
                    text-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Start typewriter effect
    typeNextCharacter();

    // Add close button functionality
    const closeBtn = document.getElementById('closeModalBtn');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    // Add hover effect to button
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.backgroundColor = '#6a4030';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.backgroundColor = '#4a3020';
    });
} 
