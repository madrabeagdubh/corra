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

// Derived CSS strings from the single COLORS.queen source of truth
const GOLD_FULL    = COLORS.queen;                    // '#d4af37'
const GOLD_DIM     = COLORS.queen + '73';             // ~45% opacity via hex alpha
const GOLD_BORDER  = COLORS.queen + '4d';             // ~30% opacity
const GOLD_ACTIVE_BG = COLORS.queen + '1a';           // ~10% opacity fill on active tab
const PANEL_BG     = 'rgba(8,6,2,0.95)';

export function createGameMenuHub({
    onInventoryOpen  = null,
    onInventoryClose = null,
} = {}) {
    let open      = false;
    let destroyed = false;
    let curIdx    = Math.max(0, PANELS.findIndex(p => p.key === (GameSettings.lastMenuPanel || 'inventory')));

    // -- Root overlay --
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

    // -- Tab indicator bar --
    const tabBar = document.createElement('div');
    tabBar.style.cssText = [
        'display:flex;align-items:stretch;',
        `background:${PANEL_BG};`,
        `border-bottom:2px solid ${GOLD_BORDER};`,
        'pointer-events:all;',
        'flex-shrink:0;',
    ].join('');

    const tabEls = PANELS.map((panel, i) => {
        const tab = document.createElement('div');
        tab.style.cssText = [
            'flex:1;padding:0.65rem 0.1rem;',
            'text-align:center;cursor:pointer;',
            'font-size:0.72rem;',
            `border-right:1px solid ${GOLD_BORDER};`,
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

    // -- DOM panel area --
    const domArea = document.createElement('div');
    domArea.style.cssText = [
        'flex:1;',
        'overflow:hidden;',
        'pointer-events:all;',
        'display:none;',
        `background:${PANEL_BG};`,
    ].join('');
    root.appendChild(domArea);

    // Placeholder panels
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

    // -- Swipe detection --
    let swipeStartX = 0;
    let swipeStartT = 0;
    let swiping     = false;

    root.addEventListener('pointerdown', (e) => {
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

    // -- Panel navigation --
    function _goTo(idx, skipCallbacks) {
        const prev    = PANELS[curIdx].key;
        curIdx        = idx;
        const current = PANELS[curIdx].key;
        GameSettings.lastMenuPanel = current;

        _updateTabs();

        if (prev === 'inventory' && current !== 'inventory' && !skipCallbacks) {
            if (onInventoryClose) onInventoryClose();
        }

        if (current === 'inventory') {
            domArea.style.display = 'none';
            Object.values(domPanels).forEach(p => p.style.display = 'none');
            if (!skipCallbacks && onInventoryOpen) onInventoryOpen();
        } else {
            domArea.style.display = 'block';
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
            tabEls[i].textContent      = useEn ? panel.en : panel.ga;
            tabEls[i].style.color      = active ? GOLD_FULL : GOLD_DIM;
            tabEls[i].style.background = active ? GOLD_ACTIVE_BG : 'transparent';
            tabEls[i].style.fontFamily = useEn ? FONTS.english : FONTS.irish;
        });
    }

    window.addEventListener('englishOpacityChange', _updateTabs);

    // -- Open / close --
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
        if (PANELS[curIdx].key === 'inventory' && onInventoryClose) {
            onInventoryClose();
        }
        const onFaded = () => {
            root.removeEventListener('transitionend', onFaded);
            if (!open) root.style.display = 'none';
        };
        root.addEventListener('transitionend', onFaded);
    }

    // -- Public API --
    return {
        open()         { _open(); },
        close()        { _close(); },
        isOpen()       { return open; },
        currentPanel() { return PANELS[curIdx].key; },

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

