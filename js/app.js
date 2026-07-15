// ========== 应用入口（ES Module 版） ==========
import { CONFIG } from './config.js';
import { Utils } from './utils.js';
import { DOMRefs } from './core/dom-refs.js';
import { EventBus } from './core/event-bus.js';
import { AppState } from './core/app-state.js';
import { AppInitializer } from './core/app-initializer.js';
import { EVENTS } from './core/event-constants.js';
import { ApiClient } from './services/api-client.js';
import { UI } from './utils/ui-strings.js';

// ----- 服务层 -----
import { Article } from './models/article-model.js';
import { NotificationService } from './services/notification-service.js';
import { VisibilityService } from './services/visibility-service.js';
import { ArticleService } from './services/article-service.js';
import { Watermark } from './services/watermark.js';
import { DecoShelf } from './services/deco.js';
import { Texture } from './services/texture.js';
import { HeroBackground } from './services/hero-background.js';
import { WebSocketManager } from './services/websocket-service.js';

// ----- UI 组件 -----
import { UIHelpers } from './ui/components/helpers.js';
import { Sidebar } from './ui/components/sidebar.js';
import { UISearch } from './ui/components/search.js';
import { UIDirectory } from './ui/components/directory/index.js';
import { UIArticles } from './ui/components/articles.js';
import { UIDetail } from './ui/components/detail.js';
import { UIController } from './ui/ui-controller.js';
import { DecoShelfUI } from './ui/components/deco-ui.js';

// ----- Admin 模块 -----
import { AdminState } from './admin/state.js';
import { AdminPosition } from './admin/position.js';
import { AdminDrag } from './admin/drag.js';
import { AdminUI } from './admin/ui.js';
import { AdminAvatar } from './admin/avatar.js';
import { AdminAuth } from './admin/auth.js';
import { AdminPanel } from './admin/panel/index.js';
import './admin/panel/render.js';
import './admin/panel/events/index.js';
import './admin/panel/palette.js';
import { AdminUiEvents } from './admin/events/ui.js';
import { ContextMenu } from './admin/events/context-menu.js';
import { AdminEvents } from './admin/events/index.js';
import { Admin } from './admin/index.js';

console.log('🚀 [app] ES Module 入口已加载');

// ============================================================
// 0. 注入 UI 文案到主页面（所有硬编码文字替换）
// ============================================================
function injectUITexts() {
    // ---- 页面标题 ----
    document.title = UI.common.siteTitle + ' - ' + UI.common.siteSubtitle;

    // ---- 通用元素 ----
    const siteTitle = document.getElementById('siteTitle');
    if (siteTitle) siteTitle.textContent = UI.common.siteTitle;

    const siteSubtitle = document.getElementById('siteSubtitle');
    if (siteSubtitle) siteSubtitle.textContent = UI.common.siteSubtitle;

    const searchInput = document.getElementById('sidebarSearchInput');
    if (searchInput) searchInput.placeholder = UI.common.searchPlaceholder;

    const copyrightBar = document.getElementById('copyrightBar');
    if (copyrightBar) {
        copyrightBar.textContent = UI.copyright
            .replace('{siteTitle}', UI.common.siteTitle)
            .replace('{siteSubtitle}', UI.common.siteSubtitle);
    }

    // ---- 首屏说明 ----
    const heroTitle = document.getElementById('heroTitle');
    if (heroTitle) heroTitle.textContent = UI.hero.title;

    const heroDesc = document.getElementById('heroDescription');
    if (heroDesc) heroDesc.innerHTML = UI.hero.description;

    // ---- 登录 ----
    const loginLabel = document.getElementById('loginLabel');
    if (loginLabel) loginLabel.textContent = UI.login.triggerLabel;

    const welcomeText = document.getElementById('welcomeText');
    if (welcomeText) welcomeText.textContent = UI.login.welcomeText;

    const loginModalTitle = document.getElementById('loginModalTitle');
    if (loginModalTitle) loginModalTitle.textContent = UI.login.modalTitle;

    const loginUsernameLabel = document.getElementById('loginUsernameLabel');
    if (loginUsernameLabel) loginUsernameLabel.textContent = UI.login.usernameLabel;

    const loginPasswordLabel = document.getElementById('loginPasswordLabel');
    if (loginPasswordLabel) loginPasswordLabel.textContent = UI.login.passwordLabel;

    const loginUsername = document.getElementById('loginUsername');
    if (loginUsername) loginUsername.placeholder = UI.login.placeholderUsername;

    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) loginPassword.placeholder = UI.login.placeholderPassword;

    const modalLoginBtn = document.getElementById('modalLoginBtn');
    if (modalLoginBtn) modalLoginBtn.textContent = UI.login.loginButton;

    const loginHint = document.getElementById('loginHint');
    if (loginHint) loginHint.textContent = UI.login.hint;

    // ---- 头像裁剪 ----
    const cropTitle = document.getElementById('cropModalTitle');
    if (cropTitle) cropTitle.textContent = UI.crop.title;

    const cropPreviewLabel = document.getElementById('cropPreviewLabel');
    if (cropPreviewLabel) cropPreviewLabel.textContent = UI.crop.previewLabel;

    const cropCancel = document.getElementById('cropCancelBtn');
    if (cropCancel) cropCancel.textContent = UI.crop.cancel;

    const cropConfirm = document.getElementById('cropConfirmBtn');
    if (cropConfirm) cropConfirm.textContent = UI.crop.confirm;

    // ---- 管理员面板 ----
    const adminTitle = document.getElementById('adminPanelTitle');
    if (adminTitle) adminTitle.textContent = UI.admin.panelTitle;

    // ---- 侧边栏 ----
    const sidebarTitle = document.getElementById('sidebarTitle');
    if (sidebarTitle) sidebarTitle.textContent = '📜'; // 图标，不依赖 UI

    // ---- 位置管理控件 ----
    const enterPosBtn = document.getElementById('enterPositionModeBtn');
    if (enterPosBtn) enterPosBtn.textContent = UI.admin.positionModeEnter;

    const savePosBtn = document.getElementById('savePositionChangesBtn');
    if (savePosBtn) savePosBtn.textContent = UI.admin.positionModeSave;

    const cancelPosBtn = document.getElementById('cancelPositionChangesBtn');
    if (cancelPosBtn) cancelPosBtn.textContent = UI.admin.positionModeCancel;

    const posHint = document.getElementById('positionModeHint');
    if (posHint) posHint.textContent = UI.admin.positionModeHint;

    // ---- 目录加载占位 ----
    const dirLoading = document.getElementById('directoryLoading');
    if (dirLoading) dirLoading.textContent = UI.directory.loading;

    // ---- 文章列表加载 ----
    const articlesLoading = document.getElementById('articlesLoading');
    if (articlesLoading) articlesLoading.textContent = UI.articles.loading;

    // ---- 可见水印 ----
    const visibleWatermark = document.getElementById('visibleWatermark');
    if (visibleWatermark) {
        visibleWatermark.textContent = `© ${UI.common.siteTitle} · ${UI.common.siteSubtitle} · 内容受保护`;
    }

    console.log('[app] UI 文案注入完成');
}

// 立即执行注入（在 DOM 加载后也执行一次）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUITexts);
} else {
    injectUITexts();
}

// ============================================================
// 1. 注册 ApiClient 全局拦截器
// ============================================================
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

// ============================================================
// 2. 注册各模块初始化任务
// ============================================================
AppInitializer
    .register('UI', function () {
        if (UIController && typeof UIController.init === 'function') {
            UIController.init();
        } else {
            console.warn('[app] UIController 未加载');
        }
    }, ['Config', 'Utils', 'DOMRefs', 'EventBus', 'AppState'])
    .register('Watermark', function () {
        if (Watermark && typeof Watermark.loadConfig === 'function') {
            Watermark.loadConfig();
        }
    }, ['Config', 'Utils'])
    .register('Deco', function () {
        if (DecoShelf && typeof DecoShelf.loadLibrary === 'function') {
            (async () => {
                try {
                    await DecoShelf.loadLibrary();
                    console.log('[app] Deco 贴图库加载完成');
                } catch (e) {
                    console.warn('[app] Deco 贴图库加载失败:', e);
                }
            })();
        }
    }, ['Config', 'Utils'])
    .register('Texture', function () {
        if (Texture && typeof Texture.loadConfig === 'function') {
            Texture.loadConfig();
        }
    }, ['Config', 'Utils'])
    .register('HeroBackground', function () {
        if (HeroBackground && typeof HeroBackground.init === 'function') {
            HeroBackground.init();
        }
    }, ['Config', 'Utils'])
    .register('ArticleData', function () {
        if (ArticleService && typeof ArticleService.fetchArticles === 'function') {
            ArticleService.fetchArticles()
                .then(function () {
                    EventBus.emit(EVENTS.ARTICLE_DATA_LOADED);
                })
                .catch(function (error) {
                    console.error('[app] ArticleService 加载失败:', error);
                    if (Article && typeof Article.fetchArticles === 'function') {
                        Article.fetchArticles().finally(function () {
                            EventBus.emit(EVENTS.ARTICLE_DATA_LOADED);
                        });
                    }
                });
        } else if (Article && typeof Article.fetchArticles === 'function') {
            Article.fetchArticles().finally(function () {
                EventBus.emit(EVENTS.ARTICLE_DATA_LOADED);
            });
        } else {
            console.error('[app] 没有可用的文章数据加载模块');
        }
    }, ['Config', 'Utils', 'UI'])
    .register('WebSocket', function () {
        if (WebSocketManager && typeof WebSocketManager.init === 'function') {
            WebSocketManager.init();
        } else {
            console.warn('[app] WebSocket 服务未加载');
        }
    }, ['Config', 'Utils'])
    .register('Admin', function () {
        if (Admin && typeof Admin.checkStatus === 'function') {
            Admin.checkStatus();
        }
    }, ['Config', 'Utils', 'AdminState', 'AdminAuth', 'AdminUI']);

// ============================================================
// 3. UI 就绪后加载文章数据
// ============================================================
EventBus.once(EVENTS.UI_INITIALIZED, function () {
    console.log('[app] UI 已就绪，开始加载文章数据...');
    const articleModule = AppInitializer._modules.find(function (m) {
        return m.name === 'ArticleData';
    });
    if (articleModule && !articleModule.loaded) {
        try {
            articleModule.init();
            articleModule.loaded = true;
        } catch (e) {
            console.error('[app] 文章数据加载失败:', e);
        }
    }
});

// ============================================================
// 4. BroadcastChannel 监听
// ============================================================
try {
    const channel = new BroadcastChannel('revachol');
    channel.onmessage = (event) => {
        const data = event.data;
        console.log('[BroadcastChannel] 收到消息:', data.type, data.payload);
        const type = data.type;

        if (type === 'article_updated' || type === 'article_created' || type === 'article_deleted' || type === 'visibility_changed') {
            console.log('[BroadcastChannel] 触发数据刷新...');
            // 强制从后端拉取最新数据
            ArticleService.fetchArticles(true)
                .then(() => {
                    console.log('[BroadcastChannel] 数据刷新完成，触发 UI 更新');
                    // 触发文章数据加载事件（所有监听组件都会更新）
                    EventBus.emit(EVENTS.ARTICLE_DATA_LOADED);
                    // 同时直接更新目录树（如果已初始化）
                    if (window.UIDirectory && typeof window.UIDirectory.updateTree === 'function') {
                        const filter = window.UIDirectory.filterKeyword || null;
                        window.UIDirectory.updateTree(filter);
                        console.log('[BroadcastChannel] 目录树已手动更新');
                    }
                })
                .catch(err => {
                    console.error('[BroadcastChannel] 刷新数据失败:', err);
                });
        } else if (type === 'draft_saved') {
            console.log('[BroadcastChannel] 草稿保存（忽略）:', data.payload);
        } else {
            console.log('[BroadcastChannel] 未知消息类型:', type);
        }
    };
    window.addEventListener('beforeunload', () => channel.close());
    console.log('✅ BroadcastChannel 已建立');
} catch (e) {
    console.warn('[BroadcastChannel] 不支持或初始化失败:', e);
}

// ============================================================
// 5. DOM 事件绑定（登录弹窗、头像裁剪等）
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    // ----- 登录触发 -----
    const loginTrigger = DOMRefs.get(DOMRefs.login.trigger);
    const modalOverlay = DOMRefs.get(DOMRefs.login.modal);
    const modalCloseBtn = DOMRefs.get(DOMRefs.login.closeBtn);
    const modalLoginBtn = DOMRefs.get(DOMRefs.login.loginBtn);
    const cropModalOverlay = DOMRefs.get(DOMRefs.crop.overlay);
    const cropModalCloseBtn = DOMRefs.get(DOMRefs.crop.closeBtn);
    const cropCancelBtn = DOMRefs.get(DOMRefs.crop.cancelBtn);
    const cropConfirmBtn = DOMRefs.get(DOMRefs.crop.confirmBtn);

    if (loginTrigger) {
        loginTrigger.addEventListener('click', function () {
            if (!Admin.isLoggedIn) {
                if (modalOverlay) modalOverlay.classList.add('active');
            }
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', function () {
            if (modalOverlay) modalOverlay.classList.remove('active');
        });
    }
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('active');
            }
        });
    }

    if (modalLoginBtn) {
        modalLoginBtn.addEventListener('click', function () {
            const username = DOMRefs.get(DOMRefs.login.username);
            const password = DOMRefs.get(DOMRefs.login.password);
            Admin.login(username ? username.value : '', password ? password.value : '');
        });
    }

    const loginPasswordInput = DOMRefs.get(DOMRefs.login.password);
    if (loginPasswordInput) {
        loginPasswordInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                const username = DOMRefs.get(DOMRefs.login.username);
                Admin.login(username ? username.value : '', loginPasswordInput.value);
            }
        });
    }

    if (cropModalCloseBtn) {
        cropModalCloseBtn.addEventListener('click', function () {
            if (cropModalOverlay) cropModalOverlay.classList.remove('active');
        });
    }
    if (cropCancelBtn) {
        cropCancelBtn.addEventListener('click', function () {
            Admin.cancelCrop();
        });
    }
    if (cropConfirmBtn) {
        cropConfirmBtn.addEventListener('click', function () {
            Admin.confirmCrop();
        });
    }
    if (cropModalOverlay) {
        cropModalOverlay.addEventListener('click', function (e) {
            if (e.target === cropModalOverlay) {
                cropModalOverlay.classList.remove('active');
            }
        });
    }

    document.addEventListener('paste', function (event) {
        const items = event.clipboardData.items;
        let hasImage = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                hasImage = true;
                break;
            }
        }
        if (hasImage) {
            const toast = document.createElement('div');
            toast.className = 'paste-toast';
            toast.innerHTML = '📸 检测到粘贴操作 · 此行为已被记录';
            document.body.appendChild(toast);
            setTimeout(function () {
                toast.remove();
            }, 3000);
        }
    });

    // ===== 文章位置管理控件（侧边栏） =====
    function setupPositionModeControls() {
        const controls = document.getElementById('positionModeControls');
        const enterBtn = document.getElementById('enterPositionModeBtn');
        const saveBtn = document.getElementById('savePositionChangesBtn');
        const cancelBtn = document.getElementById('cancelPositionChangesBtn');

        if (!controls || !enterBtn || !saveBtn || !cancelBtn) return;

        const updateVisibility = (isLoggedIn) => {
            controls.style.display = isLoggedIn ? 'block' : 'none';
            if (!isLoggedIn) {
                EventBus.emit('admin:position-mode-exit');
                enterBtn.style.display = 'inline-block';
                saveBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
            }
        };

        EventBus.on(EVENTS.AUTH_LOGGED_IN, () => updateVisibility(true));
        EventBus.on(EVENTS.AUTH_LOGGED_OUT, () => updateVisibility(false));

        enterBtn.addEventListener('click', function() {
            EventBus.emit('admin:position-mode-enter');
            enterBtn.style.display = 'none';
            saveBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
            Utils.showToast('已进入位置管理模式，拖拽节点调整位置', false);
        });

        saveBtn.addEventListener('click', function() {
            EventBus.emit('admin:position-mode-exit');
            enterBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
            Utils.showToast('位置更改已保存', false);
        });

        cancelBtn.addEventListener('click', function() {
            EventBus.emit('admin:position-mode-exit');
            enterBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
            Utils.showToast('已取消，未保存更改', false);
        });

        const isLoggedIn = AppState.get('isLoggedIn');
        updateVisibility(isLoggedIn);
    }

    setupPositionModeControls();

    console.log('[app] 登录事件绑定完成');
});

// ============================================================
// 6. 启动应用
// ============================================================
AppInitializer.start();

// 在 AppInitializer.start(); 之后添加
setTimeout(() => {
    if (ContextMenu && typeof ContextMenu.init === 'function') {
        ContextMenu.init();
        console.log('[app] 贴纸右键菜单已初始化');
    }
}, 200);

// 临时暴露关键模块到全局，便于调试
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

console.log('✅ app.js 已加载 (ES Module 入口)');
