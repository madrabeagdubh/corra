// championTuneMapping.js
// Maps champion themeTuneTitle to tune keys in allTunes by searching the T: field

import { allTunes } from './allTunes.js';

/**
 * Get tune key for a champion by searching allTunes for matching title
 * @param {Object} champion - Champion object with themeTuneTitle property
 * @returns {string|null} - Tune key or null if not found
 */
export function getTuneKeyForChampion(champion) {
    if (!champion) {
        console.warn('[ChampionTuneMap] No champion provided');
        return null;
    }
    
    const tuneTitle = champion.themeTuneTitle;
    
    if (!tuneTitle) {
        console.warn('[ChampionTuneMap] Champion has no themeTuneTitle:', champion.nameEn);
        return 'drowsyMaggie'; // Default fallback
    }
    
    console.log('[ChampionTuneMap] Searching for:', tuneTitle);
    
    // Search through allTunes to find matching T: field
    for (const [key, abcContent] of Object.entries(allTunes)) {
        // Extract the T: line from the ABC notation
        const titleMatch = abcContent.match(/^T:\s*(.+)$/m);
        
        if (titleMatch && titleMatch[1]) {
            const abcTitle = titleMatch[1].trim();
            
            // Check if titles match (case-insensitive)
            if (abcTitle.toLowerCase() === tuneTitle.toLowerCase()) {
                console.log('[ChampionTuneMap] ✓ Found:', tuneTitle, '->', key);
                return key;
            }
        }
    }
    
    console.warn('[ChampionTuneMap] ✗ No match found for:', tuneTitle);
    console.warn('[ChampionTuneMap] Falling back to drowsyMaggie');
    
    // Fallback to a default tune
    return 'drowsyMaggie';
}

