/**
 * gameMenuHub.js
 *
 * A swipeable panel system that wraps multiple game views.
 * Tab bar sits at the TOP of the screen.
 * Content panel fills below the tab bar.
 *
 * Panels:
 *   inventory  🎒  -- fires onInventoryOpen/onInventoryClose
 *   stats      ⚔️  -- DOM panel
 *   labhairt   💬  -- fires onLabhairtOpen/onLabhairtClose
 *   log        📜  -- DOM panel
 *   about      ?   -- DOM panel (credits)
 */

import { FONTS, COLORS } from '../systems/gameTypography.js';
import { GameSettings }  from '../settings/gameSettings.js';

const PANELS = [
    { key: 'inventory', ga: 'Stóras',  en: 'Inventory', icon: '/assets/icons/backpack.png',    iconFallback: '🎒' },
    { key: 'stats',     ga: 'Staid',   en: 'Stats',     icon: '/assets/icons/stats.png',        iconFallback: '⚔️' },
    { key: 'labhairt',  ga: 'Labhair', en: 'Speak',     icon: '/assets/icons/speechbubble.png', iconFallback: '💬' },
    { key: 'log',       ga: 'Dialann', en: 'Log',        icon: '/assets/icons/log.png',          iconFallback: '📜' },
    { key: 'about',     ga: 'Fúinn',   en: 'About',     icon: '/assets/icons/about.png',        iconFallback: '?' },
];

const PHASER_PANELS = new Set(['inventory', 'labhairt']);

const GOLD_FULL      = COLORS.queen;
const GOLD_DIM       = COLORS.queen + '73';
const GOLD_BORDER    = COLORS.queen + '4d';
const GOLD_ACTIVE_BG = COLORS.queen + '1a';
const PANEL_BG       = 'rgba(8,6,2,0.95)';

const ABOUT_CONTENT = {
    sections: [
        {
            titleGa: 'Íomhánna',   titleEn: 'Images',
            bodyGa:  'Lorem ipsum agus lorem an ipsum. Gailearaí Náisiúnta na hÉireann.',
            bodyEn:  'Landscape paintings used with permission. National Gallery of Ireland, Dublin.',
        },
        {
            titleGa: 'Ceol',       titleEn: 'Music',
            bodyGa:  'Lorem ipsum agus lorem an ipsum. Ceol traidisiúnta na hÉireann.',
            bodyEn:  'Traditional Irish music. Lorem ipsum and lorem the ipsum.',
        },
        {
            titleGa: 'Tileanna',   titleEn: 'Tiles',
            bodyGa:  'Lorem ipsum agus lorem an ipsum. Oryx Design Lab.',
            bodyEn:  'Pixel art tileset by Oryx Design Lab. Lorem ipsum.',
        },
        {
            titleGa: 'Forbairt',   titleEn: 'Development',
            bodyGa:  'Lorem ipsum agus lorem an ipsum. Claude Sonnet, Anthropic.',
            bodyEn:  'Developed with assistance from Claude (Anthropic). Lorem ipsum agus lorem.',
        },
    ]
}

export function createGameMenuHub({
    onInventoryOpen  = null,
    onInventoryClose = null,
    onLabhairtOpen   = null,
    onLabhairtClose  = null,
} = {}) {
    let open      = false;
    let destroyed = false;
    let curIdx    = Math.max(0, PANELS.findIndex(p => p.key === (GameSettings.lastMenuPanel || 'inventory')));

    // -- Root overlay -- full screen, flex column, tab bar on top
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

    // -- Tab bar -- horizontal strip at TOP --
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
            'flex:1;padding:0.55rem 0.1rem;',
            'text-align:center;cursor:pointer;',
            'display:flex;flex-direction:column;',
            'align-items:center;justify-content:center;',
            'gap:3px;',
            `border-right:1px solid ${GOLD_BORDER};`,
            'transition:background 0.15s;',
            'user-select:none;-webkit-user-select:none;',
        ].join('');

        const iconEl = document.createElement('div')
        iconEl.style.cssText = 'width:28px;height:28px;display:flex;align-items:center;justify-content:center;'

        const iconImg = document.createElement('img')
        iconImg.src = panel.icon
        iconImg.style.cssText = [
            'width:24px;height:24px;',
            'object-fit:contain;',
            'image-rendering:pixelated;',
            'filter:brightness(0.55);',
            'transition:filter 0.15s;',
        ].join('')
        iconImg.onerror = () => {
            iconImg.style.display = 'none'
            const fallback = document.createElement('span')
            fallback.textContent = panel.iconFallback
            fallback.style.cssText = 'font-size:1.2rem;line-height:1;'
            iconEl.appendChild(fallback)
        }
        iconEl.appendChild(iconImg)
        tab._iconImg = iconImg

        tab.appendChild(iconEl)
        tab.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            _goTo(i);
        });
        tabBar.appendChild(tab);
        return tab;
    });

    root.appendChild(tabBar);

    // -- DOM content area -- fills remaining space below tab bar --
    const domArea = document.createElement('div');
    domArea.style.cssText = [
        'flex:1;',
        'overflow:hidden;',
        'pointer-events:all;',
        'display:none;',
        `background:${PANEL_BG};`,
    ].join('');
    root.appendChild(domArea);

    // -- Build DOM panels --
    const domPanels = {};
    PANELS.forEach((panel) => {
        if (PHASER_PANELS.has(panel.key)) return;

        const el = document.createElement('div');
        el.style.cssText = [
            'width:100%;height:100%;',
            'display:flex;flex-direction:column;',
            'align-items:center;justify-content:center;',
            'gap:0.5rem;overflow-y:auto;',
        ].join('');

        if (panel.key === 'about') {
            _buildAboutPanel(el)
        } else {
            const title = document.createElement('div');
            title.style.cssText = `font-size:1.4rem;color:${COLORS.speaker};font-family:${FONTS.irish};`;
            title.textContent = panel.ga;
            const sub = document.createElement('div');
            sub.style.cssText = `font-size:0.9rem;color:${COLORS.uiDim};font-family:${FONTS.english};`;
            sub.textContent = panel.en;
            el.appendChild(title);
            el.appendChild(sub);
        }

        el.style.display = 'none';
        domArea.appendChild(el);
        domPanels[panel.key] = el;
    });

    function _buildAboutPanel(container) {
        container.style.cssText += 'padding:1.2rem;gap:1rem;justify-content:flex-start;'
        const heading = document.createElement('div')
        heading.style.cssText = [
            `font-family:${FONTS.irish};font-size:1.4rem;`,
            `color:${COLORS.speaker};text-align:center;`,
            'padding-bottom:0.4rem;width:100%;',
            `border-bottom:1px solid ${GOLD_BORDER};`,
        ].join('')
        heading.textContent = 'Corra'
        container.appendChild(heading)

        ABOUT_CONTENT.sections.forEach(section => {
            const block  = document.createElement('div')
            block.style.cssText = 'width:100%;'
            const sTitle = document.createElement('div')
            sTitle.style.cssText = `font-family:${FONTS.irish};font-size:0.95rem;color:${COLORS.speaker};margin-bottom:0.2rem;`
            const sBody  = document.createElement('div')
            sBody.style.cssText  = `font-family:${FONTS.english};font-size:0.78rem;color:${COLORS.uiDim};line-height:1.5;`
            const update = () => {
                const useEn = GameSettings.englishOpacity >= 0.5
                sTitle.textContent = useEn ? section.titleEn : section.titleGa
                sBody.textContent  = useEn ? section.bodyEn  : section.bodyGa
            }
            update()
            block._update = update
            block.appendChild(sTitle)
            block.appendChild(sBody)
            container.appendChild(block)
        })
        container._updateLanguage = () => Array.from(container.children).forEach(c => c._update?.())
    }

    // -- Swipe detection --
    let swipeStartX = 0, swipeStartT = 0, swiping = false;
    root.addEventListener('pointerdown', (e) => { swipeStartX = e.clientX; swipeStartT = performance.now(); swiping = true; }, { passive: true });
    root.addEventListener('pointerup', (e) => {
        if (!swiping) return;
        swiping = false;
        const dx = e.clientX - swipeStartX;
        const dt = performance.now() - swipeStartT;
        if (Math.abs(dx) > 45 && dt < 400) {
            _goTo(Math.max(0, Math.min(PANELS.length - 1, curIdx + (dx < 0 ? 1 : -1))));
        }
    }, { passive: true });

    // -- Panel navigation --
    function _goTo(idx, skipCallbacks) {
        const prev = PANELS[curIdx].key;
        curIdx = idx;
        const current = PANELS[curIdx].key;
        GameSettings.lastMenuPanel = current;
        _updateTabs();

        if (!skipCallbacks) {
            if (prev === 'inventory' && current !== 'inventory' && onInventoryClose) onInventoryClose();
            if (prev === 'labhairt'  && current !== 'labhairt'  && onLabhairtClose)  onLabhairtClose();
        }

        if (current === 'inventory') {
            domArea.style.display = 'none';
            Object.values(domPanels).forEach(p => p.style.display = 'none');
            if (!skipCallbacks && onInventoryOpen) onInventoryOpen();
        } else if (current === 'labhairt') {
            domArea.style.display = 'none';
            Object.values(domPanels).forEach(p => p.style.display = 'none');
            if (!skipCallbacks && onLabhairtOpen) onLabhairtOpen();
        } else {
            domArea.style.display = 'block';
            Object.entries(domPanels).forEach(([key, el]) => {
                el.style.display = key === current ? 'flex' : 'none';
            });
        }
    }

    function _updateTabs() {
        PANELS.forEach((panel, i) => {
            const active = i === curIdx;
            tabEls[i].style.background = active ? GOLD_ACTIVE_BG : 'transparent'
            if (tabEls[i]._iconImg) {
                tabEls[i]._iconImg.style.filter = active
                    ? `brightness(1) drop-shadow(0 0 4px ${GOLD_FULL}88)`
                    : 'brightness(0.55)'
            }
        });
    }

    window.addEventListener('englishOpacityChange', () => {
        _updateTabs()
        domPanels['about']?._updateLanguage?.()
    })

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
        const current = PANELS[curIdx].key;
        if (current === 'inventory' && onInventoryClose) onInventoryClose();
        if (current === 'labhairt'  && onLabhairtClose)  onLabhairtClose();
        const onFaded = () => {
            root.removeEventListener('transitionend', onFaded);
            if (!open) root.style.display = 'none';
        };
        root.addEventListener('transitionend', onFaded);
    }

    return {
        open()         { _open(); },
        close()        { _close(); },
        isOpen()       { return open; },
        currentPanel() { return PANELS[curIdx].key; },
        setContent(key, el) {
            if (domPanels[key]) { domPanels[key].innerHTML = ''; domPanels[key].appendChild(el); }
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            window.removeEventListener('englishOpacityChange', _updateTabs);
            if (root.parentNode) root.parentNode.removeChild(root);
        },
    };
}

