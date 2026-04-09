/**
 * gameMenuHub.js
 *
 * A swipeable panel system that wraps multiple game views.
 * Lives as a DOM overlay above the Phaser canvas.
 *
 * - Tab indicator bar at top shows current panel + neighbours
 * - Horizontal swipe navigates between panels
 * - For 'inventory': fires onInventoryOpen/onInventoryClose to show/hide WorldMenu
 * - For other panels: renders a DOM panel directly
 *
 * moon tap -> hub.open() -> shows current panel
 * moon tap -> hub.close() -> hides everything
 */

import { FONTS, COLORS } from '../systems/gameTypography.js';
import { GameSettings }  from '../settings/gameSettings.js';

const PANELS = [
    { key: 'inventory', ga: 'Storas',    en: 'Inventory' },
    { key: 'quests',    ga: 'Turas',     en: 'Quests'    },
    { key: 'stats',     ga: 'Staid',     en: 'Stats'     },
    { key: 'map',       ga: 'Learscail', en: 'Map'       },
    { key: 'settings',  ga: 'Socruithe', en: 'Settings'  },
];

export function createGameMenuHub({
    onInventoryOpen  = null,
    onInventoryClose = null,
} = {}) {
    let open      = false;
    let destroyed = false;
    let curIdx    = Math.max(0, PANELS.findIndex(p => p.key === (GameSettings.lastMenuPanel || 'inventory')));

    // ── Root overlay ─────────────────────────────────────────────────────────
    // Covers full screen. pointer-events:none by default so Phaser
    // stays interactive when closed. Only the tab bar and DOM panels
    // get pointer-events:all.
    const root = document.createElement('div');
    root.id = 'gameMenuHub';
    root.style.cssText = [
        'position:fixed;inset:0;',
        'z-index:1000002;',
        'display:none;',
        'flex-direction:column;',
        'pointer-events:none;',
        'opacity:0;',
        'transition:opacity 0.18s ease;',
    ].join('');
    document.body.appendChild(root);

    // ── Tab indicator bar ─────────────────────────────────────────────────────
    const tabBar = document.createElement('div');
    tabBar.style.cssText = [
        'display:flex;align-items:stretch;',
        'background:rgba(8,6,2,0.95);',
        'border-bottom:2px solid rgba(212,175,55,0.3);',
        'pointer-events:all;',
        'flex-shrink:0;',
    ].join('');

    const tabEls = PANELS.map((panel, i) => {
        const tab = document.createElement('div');
        tab.style.cssText = [
            'flex:1;padding:0.65rem 0.1rem;',
            'text-align:center;cursor:pointer;',
            'font-size:0.72rem;',
            'border-right:1px solid rgba(212,175,55,0.1);',
            'transition:color 0.15s, background 0.15s;',
            'user-select:none;-webkit-user-select:none;',
        ].join('');
        tab.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            _goTo(i);
        });
        tabBar.appendChild(tab);
        return tab;
    });

    root.appendChild(tabBar);

    // ── DOM panel area ────────────────────────────────────────────────────────
    // Only shown for non-inventory panels (inventory uses WorldMenu below).
    const domArea = document.createElement('div');
    domArea.style.cssText = [
        'flex:1;',
        'overflow:hidden;',
        'pointer-events:all;',
        'display:none;',  // hidden when inventory is active
        'background:rgba(8,6,2,0.96);',
    ].join('');
    root.appendChild(domArea);

    // Build one DOM panel per non-inventory tab (placeholder content for now)
    const domPanels = {};
    PANELS.forEach((panel) => {
        if (panel.key === 'inventory') return;
        const el = document.createElement('div');
        el.style.cssText = [
            'width:100%;height:100%;',
            'display:flex;flex-direction:column;',
            'align-items:center;justify-content:center;',
            'gap:0.5rem;',
        ].join('');

        const title = document.createElement('div');
        title.style.cssText = `font-size:1.4rem;color:${COLORS.speaker};`;
        title.textContent = panel.ga;

        const sub = document.createElement('div');
        sub.style.cssText = `font-size:0.9rem;color:${COLORS.uiDim};`;
        sub.textContent = panel.en;

        el.appendChild(title);
        el.appendChild(sub);
        el.style.display = 'none';
        domArea.appendChild(el);
        domPanels[panel.key] = el;
    });

    // ── Swipe detection on the whole root ────────────────────────────────────
    let swipeStartX = 0;
    let swipeStartT = 0;
    let swiping     = false;

    root.addEventListener('pointerdown', (e) => {
        // Only track swipes that start in the domArea or tabBar
        swipeStartX = e.clientX;
        swipeStartT = performance.now();
        swiping     = true;
    }, { passive: true });

    root.addEventListener('pointerup', (e) => {
        if (!swiping) return;
        swiping = false;
        const dx = e.clientX - swipeStartX;
        const dt = performance.now() - swipeStartT;
        if (Math.abs(dx) > 45 && dt < 400) {
            const dir = dx < 0 ? 1 : -1;
            _goTo(Math.max(0, Math.min(PANELS.length - 1, curIdx + dir)));
        }
    }, { passive: true });

    // ── Panel navigation ──────────────────────────────────────────────────────
    function _goTo(idx, skipCallbacks) {
        const prev    = PANELS[curIdx].key;
        curIdx        = idx;
        const current = PANELS[curIdx].key;
        GameSettings.lastMenuPanel = current;

        _updateTabs();

        // Close WorldMenu if leaving inventory
        if (prev === 'inventory' && current !== 'inventory' && !skipCallbacks) {
            if (onInventoryClose) onInventoryClose();
        }

        if (current === 'inventory') {
            // Hide DOM area, show WorldMenu underneath
            domArea.style.display = 'none';
            Object.values(domPanels).forEach(p => p.style.display = 'none');
            if (!skipCallbacks && onInventoryOpen) onInventoryOpen();
        } else {
            // Show DOM area with correct panel
            domArea.style.display = 'block';
            // Close WorldMenu if switching away
            if (prev === 'inventory' && !skipCallbacks && onInventoryClose) {
                onInventoryClose();
            }
            Object.entries(domPanels).forEach(([key, el]) => {
                el.style.display = key === current ? 'flex' : 'none';
            });
        }
    }

    function _updateTabs() {
        const useEn = GameSettings.englishOpacity >= 0.5;
        PANELS.forEach((panel, i) => {
            const active = i === curIdx;
            tabEls[i].textContent = useEn ? panel.en : panel.ga;
            tabEls[i].style.color      = active
                ? 'rgba(212,175,55,1)'
                : 'rgba(212,175,55,0.45)';
            tabEls[i].style.background = active
                ? 'rgba(212,175,55,0.1)'
                : 'transparent';
            tabEls[i].style.fontFamily = useEn ? FONTS.english : FONTS.irish;
        });
    }

    // Language updates
    window.addEventListener('englishOpacityChange', _updateTabs);

    // ── Open / close ──────────────────────────────────────────────────────────
    function _open() {
        open = true;
        curIdx = Math.max(0, PANELS.findIndex(p => p.key === (GameSettings.lastMenuPanel || 'inventory')));
        root.style.display = 'flex';
        _goTo(curIdx, false);
        requestAnimationFrame(() => { root.style.opacity = '1'; });
    }

    function _close() {
        open = false;
        root.style.opacity = '0';
        // Hide WorldMenu if inventory was active
        if (PANELS[curIdx].key === 'inventory' && onInventoryClose) {
            onInventoryClose();
        }
        const onFaded = () => {
            root.removeEventListener('transitionend', onFaded);
            if (!open) root.style.display = 'none';
        };
        root.addEventListener('transitionend', onFaded);
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        open()         { _open(); },
        close()        { _close(); },
        isOpen()       { return open; },
        currentPanel() { return PANELS[curIdx].key; },

        /** Inject DOM content into a named panel (replaces placeholder) */
        setContent(key, el) {
            if (domPanels[key]) {
                domPanels[key].innerHTML = '';
                domPanels[key].appendChild(el);
            }
        },

        destroy() {
            if (destroyed) return;
            destroyed = true;
            window.removeEventListener('englishOpacityChange', _updateTabs);
            if (root.parentNode) root.parentNode.removeChild(root);
        },
    };
}

