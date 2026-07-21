// 动态替换 <link> 标签加载主题 CSS（而非切换 CSS 变量），因三套主题的颜色值差异过大，
// 使用变量回退会导致开发和调试成本高于直接维护三份独立样式文件。
import { Utils } from '../utils.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { Texture } from './texture.js';
import { ContextMenu } from '../admin/events/context-menu.js';

const THEMES = {
    dark: {
        id: 'dark',
        name: '暗色',
        icon: '🌙',
        cssFile: '/css/themes/dark.css',
        isDefault: true,
    },
    light: {
        id: 'light',
        name: '亮色',
        icon: '☀️',
        cssFile: '/css/themes/light.css',
        isDefault: false,
    },
    lofi: {
        id: 'lofi',
        name: '低保真',
        icon: '📼',
        cssFile: '/css/themes/lofi.css',
        isDefault: false,
    },
};

const STORAGE_KEY = 'selected_theme';
let currentTheme = 'dark';
let styleElement = null;

export const ThemeService = {
    getThemes() {
        return Object.keys(THEMES).map(key => ({ ...THEMES[key] }));
    },

    getCurrentTheme() {
        return currentTheme;
    },

    getThemeInfo(themeId) {
        return THEMES[themeId] || THEMES.dark;
    },

    loadTheme() {
        const saved = Utils.storage.get(STORAGE_KEY);
        const themeId = (saved && THEMES[saved]) ? saved : 'dark';
        this.applyTheme(themeId, true);
        console.log('[ThemeService] 加载主题:', themeId);
    },

    applyTheme(themeId, isRestore = false) {
        if (!THEMES[themeId]) {
            console.warn('[ThemeService] 主题不存在:', themeId);
            return;
        }

        currentTheme = themeId;
        const theme = THEMES[themeId];
        this._switchFavicon(themeId);

        // 移除旧的主题样式
        this._loadStylesheet(theme.cssFile);

        // 保存偏好
        Utils.storage.set(STORAGE_KEY, themeId);

        // 设置 data-theme
        if (themeId === 'lofi') {
            document.documentElement.setAttribute('data-theme', 'lofi');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        // 清除内联背景样式，让 CSS 控制
        document.body.style.background = '';
        document.body.style.backgroundColor = '';
        document.body.style.backgroundImage = '';
        document.body.style.backgroundBlendMode = '';

        // 通知 Texture 进入主题模式
        if (Texture && typeof Texture.setThemeMode === 'function') {
            Texture.setThemeMode(true);
        }

        // 通知主题变更
        EventBus.emit(EVENTS.THEME_CHANGED, { themeId, theme, isRestore });

        // 跨页面同步：通知文章编辑器等其它标签页
        try {
          const channel = new BroadcastChannel('revachol');
          channel.postMessage({ type: 'theme_changed', payload: { themeId } });
          channel.close();
        } catch (e) { /* BroadcastChannel 不支持 */ }

        // 更新管理面板中的按钮状态
        this._updateThemeButtons(themeId);

        setTimeout(() => {
            // 刷新目录树
            if (window.__REVACHOL__.UIDirectory && typeof window.__REVACHOL__.UIDirectory.updateTree === 'function') {
                window.__REVACHOL__.UIDirectory.updateTree(window.__REVACHOL__.UIDirectory.filterKeyword || null);
                console.log('[ThemeService] 目录树已刷新');
            }

            // 重新初始化右键菜单
            if (ContextMenu && typeof ContextMenu.init === 'function') {
                ContextMenu.init();
                console.log('[ThemeService] 右键菜单已重新初始化');
            }
        }, 150);

        console.log('[ThemeService] 应用主题:', theme.name);
    },

    switchTheme(themeId) {
        if (themeId === currentTheme) {
            console.log('[ThemeService] 已经是当前主题');
            return;
        }
        this.applyTheme(themeId, false);
    },

    _switchFavicon(themeId) {
        // 移除旧 favicon
        document.querySelectorAll('link[rel="icon"]').forEach(el => el.remove());
        const ts = Date.now();
        const base = `/themes/${themeId}`;
        [ { href: `${base}/favicon.ico`, type: 'image/x-icon', sizes: '' },
          { href: `${base}/favicon-32x32.png`, type: 'image/png', sizes: '32x32' } ]
            .forEach(cfg => {
                const link = document.createElement('link');
                link.rel = 'icon';
                link.type = cfg.type;
                link.href = `${cfg.href}?t=${ts}`;
                if (cfg.sizes) link.sizes = cfg.sizes;
                document.head.appendChild(link);
            });
    },

    _loadStylesheet(href) {
        // 移除所有旧的 id="theme-stylesheet" 的 link
        document.querySelectorAll('#theme-stylesheet').forEach(el => el.remove());
        if (styleElement) {
            styleElement.remove();
            styleElement = null;
        }
        styleElement = document.createElement('link');
        styleElement.rel = 'stylesheet';
        styleElement.href = href;
        styleElement.id = 'theme-stylesheet';
        document.head.appendChild(styleElement);
        console.log('[ThemeService] 加载样式:', href);
    },

    _updateThemeButtons(themeId) {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            const isActive = btn.dataset.theme === themeId;
            btn.style.opacity = isActive ? '1' : '0.5';
            btn.style.borderColor = isActive ? '#c47a44' : '';
            btn.style.boxShadow = isActive ? '0 0 12px rgba(196, 122, 68, 0.3)' : '';
        });
    },

    init() {
        // 确保 Texture 进入主题模式
        if (Texture && typeof Texture.setThemeMode === 'function') {
            Texture.setThemeMode(true);
        }
        this.loadTheme();
        console.log('[ThemeService] 初始化完成');
    },
};