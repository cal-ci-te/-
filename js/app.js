// ========== 应用入口（轻量化版本） ==========
import { CONFIG } from './config.js';
import { Utils } from './utils.js';
import { DOMRefs } from './core/dom-refs.js';
import { EventBus } from './core/event-bus.js';
import { AppState } from './core/app-state.js';
import { EVENTS } from './core/event-constants.js';
import { ApiClient } from './services/api-client.js';
import { UI } from './utils/ui-strings.js';

// ----- 导入 bootstrap 模块 -----
import { injectUITexts } from './bootstrap/ui-injector.js';
import { registerAllModules, AppInitializer } from './bootstrap/module-registry.js';
import { setupBroadcastChannel } from './bootstrap/broadcast-setup.js';

// ----- 导入服务/UI -----
import { Article } from './models/article-model.js';
import { ArticleService } from './services/article-service.js';
import { DecoShelf } from './services/deco.js';
import { DecoShelfUI } from './ui/components/deco-ui.js';
import { HeroBackground } from './services/hero-background.js';
import { Admin } from './admin/index.js';
import { UIController } from './ui/ui-controller.js';
import { UIDirectory } from './ui/components/directory/index.js';
import { ContextMenu } from './admin/events/context-menu.js';
import { ThemeService } from './services/theme-service.js';
import { Texture } from './services/texture.js';

console.log('🚀 [app] ES Module 入口已加载（轻量化版本）');

// ===== 1. 注入 UI 文案 =====
injectUITexts();

// ===== 2. 注册 ApiClient 拦截器 =====
ApiClient.useRequestInterceptor((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.options.headers = {
            ...config.options.headers,
            'Authorization': `Bearer ${token}`,
        };
    }
    return config;
});

ApiClient.useResponseInterceptor(
    (data) => data,
    async (error) => {
        if (error.status === 401) {
            EventBus.emit('auth:unauthorized');
        }
        return Promise.reject(error);
    }
);

// ===== 3. 注册所有模块 =====
registerAllModules();

// ===== 4. 启动应用 =====
AppInitializer.start();

// ===== 5. 设置 BroadcastChannel =====
setupBroadcastChannel();

// ===== 6. 初始化主题服务 =====
// 在主题服务初始化前，确保 Texture 进入主题模式
if (Texture && typeof Texture.setThemeMode === 'function') {
    Texture.setThemeMode(true);
}
ThemeService.init();

// ===== 7. 初始化右键菜单（延迟） =====
setTimeout(() => {
    if (ContextMenu && typeof ContextMenu.init === 'function') {
        ContextMenu.init();
        console.log('[app] 贴纸右键菜单已初始化');
    }
}, 200);

// ===== 8. 绑定位置管理控件事件 =====
function setupPositionModeControls() {
    const controls = document.getElementById('positionModeControls');
    let enterBtn = document.getElementById('enterPositionModeBtn');
    let saveBtn = document.getElementById('savePositionChangesBtn');
    let cancelBtn = document.getElementById('cancelPositionChangesBtn');

    if (!controls || !enterBtn || !saveBtn || !cancelBtn) {
        console.warn('[app] 位置管理控件元素不存在');
        return;
    }

    function bindSafeEvent(el, handler) {
        if (!el) return;
        const cloned = el.cloneNode(true);
        el.parentNode.replaceChild(cloned, el);
        if (el === enterBtn) enterBtn = cloned;
        if (el === saveBtn) saveBtn = cloned;
        if (el === cancelBtn) cancelBtn = cloned;
        cloned.addEventListener('click', handler);
        cloned.addEventListener('touchstart', function(e) {
            if (!this._touchHandled) {
                this._touchHandled = true;
                handler(e);
                setTimeout(() => { this._touchHandled = false; }, 300);
            }
        }, { passive: false });
        return cloned;
    }

    const updateVisibility = (isLoggedIn) => {
        controls.style.display = isLoggedIn ? 'block' : 'none';
        if (!isLoggedIn) {
            EventBus.emit('admin:position-mode-exit');
            enterBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
            const hint = controls.querySelector('.pos-hint');
            if (hint) hint.remove();
        }
    };

    EventBus.on(EVENTS.AUTH_LOGGED_IN, () => updateVisibility(true));
    EventBus.on(EVENTS.AUTH_LOGGED_OUT, () => updateVisibility(false));

    enterBtn = bindSafeEvent(enterBtn, function(e) {
        e.preventDefault();
        EventBus.emit('admin:position-mode-enter');
        enterBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
        if (!controls.querySelector('.pos-hint')) {
            const hint = document.createElement('div');
            hint.className = 'pos-hint';
            hint.textContent = '💡 拖拽节点到目标位置，点击"保存更改"生效';
            controls.appendChild(hint);
        }
        Utils.showToast('已进入位置管理模式，拖拽节点调整位置', false);
    });

    saveBtn = bindSafeEvent(saveBtn, function(e) {
        e.preventDefault();
        EventBus.emit('admin:position-mode-exit');
        enterBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        const hint = controls.querySelector('.pos-hint');
        if (hint) hint.remove();
        Utils.showToast('位置更改已保存', false);
    });

    cancelBtn = bindSafeEvent(cancelBtn, function(e) {
        e.preventDefault();
        EventBus.emit('admin:position-mode-exit');
        enterBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        const hint = controls.querySelector('.pos-hint');
        if (hint) hint.remove();
        Utils.showToast('已取消，未保存更改', false);
    });

    const isLoggedIn = AppState.get('isLoggedIn');
    updateVisibility(isLoggedIn);

    console.log('[app] 位置管理控件事件已绑定（支持移动端 touch）');
}

// ===== 9. 登录UI事件绑定 =====
function setupLoginUI() {
    const loginTrigger = DOMRefs.get(DOMRefs.login.trigger);
    const modalOverlay = DOMRefs.get(DOMRefs.login.modal);
    const modalCloseBtn = DOMRefs.get(DOMRefs.login.closeBtn);
    const modalLoginBtn = DOMRefs.get(DOMRefs.login.loginBtn);
    const usernameInput = DOMRefs.get(DOMRefs.login.username);
    const passwordInput = DOMRefs.get(DOMRefs.login.password);

    if (loginTrigger) {
        loginTrigger.removeEventListener('click', loginTrigger._loginHandler);
        loginTrigger._loginHandler = function () {
            if (!Admin.isLoggedIn) {
                if (modalOverlay) modalOverlay.classList.add('active');
            }
        };
        loginTrigger.addEventListener('click', loginTrigger._loginHandler);
    }

    if (modalCloseBtn) {
        modalCloseBtn.removeEventListener('click', modalCloseBtn._closeHandler);
        modalCloseBtn._closeHandler = function () {
            if (modalOverlay) modalOverlay.classList.remove('active');
        };
        modalCloseBtn.addEventListener('click', modalCloseBtn._closeHandler);
    }

    if (modalOverlay) {
        modalOverlay.removeEventListener('click', modalOverlay._overlayHandler);
        modalOverlay._overlayHandler = function (e) {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('active');
            }
        };
        modalOverlay.addEventListener('click', modalOverlay._overlayHandler);
    }

    if (modalLoginBtn) {
        modalLoginBtn.removeEventListener('click', modalLoginBtn._loginBtnHandler);
        modalLoginBtn._loginBtnHandler = function () {
            const username = usernameInput ? usernameInput.value : '';
            const password = passwordInput ? passwordInput.value : '';
            Admin.login(username, password);
        };
        modalLoginBtn.addEventListener('click', modalLoginBtn._loginBtnHandler);
    }

    if (passwordInput) {
        passwordInput.removeEventListener('keypress', passwordInput._keypressHandler);
        passwordInput._keypressHandler = function (e) {
            if (e.key === 'Enter') {
                const username = usernameInput ? usernameInput.value : '';
                Admin.login(username, passwordInput.value);
            }
        };
        passwordInput.addEventListener('keypress', passwordInput._keypressHandler);
    }

    console.log('[app] 登录UI事件已绑定');
}

// ===== 10. DOM 就绪后绑定 =====
function initializeApp() {
    setupPositionModeControls();
    setupLoginUI();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// ===== 11. 暴露关键模块到全局 =====
window.EventBus = EventBus;
window.AppState = AppState;
window.EVENTS = EVENTS;
window.UIController = UIController;
window.Article = Article;
window.ArticleService = ArticleService;
window.DecoShelf = DecoShelf;
window.DecoShelfUI = DecoShelfUI;
window.HeroBackground = HeroBackground;
window.Admin = Admin;
window.Utils = Utils;
window.DOMRefs = DOMRefs;
window.UIDirectory = UIDirectory;
window.ThemeService = ThemeService;
window.Texture = Texture;

console.log('✅ app.js 已加载 (轻量化版本)');