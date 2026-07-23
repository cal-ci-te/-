import { AppInitializer } from '../core/app-initializer.js';
import { UIController } from '../ui/ui-controller.js';
import { Watermark } from '../services/watermark.js';
import { DecoShelf } from '../services/deco.js';
import { Texture } from '../services/texture.js';
import { HeroBackground } from '../services/hero-background.js';
import { ArticleService } from '../services/article-service.js';
import { WebSocketManager } from '../services/websocket-service.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';

import { Admin } from '../admin/index.js';
import '../admin/panel/render.js';      // 扩展 AdminPanel.renderContent
import '../admin/panel/palette.js';     // 扩展 AdminPanel.renderPalettes
import '../admin/panel/events/index.js'; // 扩展 AdminPanel.bindEvents

export function registerAllModules() {
    AppInitializer
        .register('UI', function () {
            if (UIController && typeof UIController.init === 'function') {
                UIController.init();
            } else {
                console.warn('[bootstrap] UIController 未加载');
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
                        const items = await DecoShelf.loadLibrary();
                        console.log('[bootstrap] Deco 贴图库加载完成，共', items ? items.length : 0, '项，位置信息:', items ? items.map(function(i) { return i.id + ':' + (i.position ? '有' : '无'); }) : []);
                        // 先渲染一次（处理 APP_STARTED 已发出的情况）
                        DecoShelf._renderAllDecos();
                        console.log('[bootstrap] Deco 首次渲染完成，DOM 元素数:', document.querySelectorAll('[id^="deco-"]').length);
                        // 再等 APP_STARTED 后渲染一次（处理 DOM 尚未就绪的情况）
                        if (!AppInitializer._initialized) {
                            EventBus.once(EVENTS.APP_STARTED, function () {
                                DecoShelf._renderAllDecos();
                                console.log('[bootstrap] Deco APP_STARTED 后渲染完成');
                            });
                        }
                    } catch (e) {
                        console.warn('[bootstrap] Deco 贴图库加载失败:', e);
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
                        console.error('[bootstrap] ArticleService 加载失败:', error);
                    });
            } else {
                console.error('[bootstrap] 没有可用的文章数据加载模块');
            }
        }, ['Config', 'Utils', 'UI'])
        .register('WebSocket', function () {
            if (WebSocketManager && typeof WebSocketManager.init === 'function') {
                WebSocketManager.init();
            } else {
                console.warn('[bootstrap] WebSocket 服务未加载');
            }
        }, ['Config', 'Utils'])
        .register('Admin', function () {
            if (Admin && typeof Admin.checkStatus === 'function') {
                Admin.checkStatus();
            }
        }, ['Config', 'Utils', 'AdminState', 'AdminAuth', 'AdminUI']);

    // 注册 UI 就绪后加载文章数据的钩子
    EventBus.once(EVENTS.UI_INITIALIZED, function () {
        console.log('[bootstrap] UI 已就绪，开始加载文章数据...');
        const articleModule = AppInitializer._modules.find(function (m) {
            return m.name === 'ArticleData';
        });
        if (articleModule && !articleModule.loaded) {
            try {
                articleModule.init();
                articleModule.loaded = true;
            } catch (e) {
                console.error('[bootstrap] 文章数据加载失败:', e);
            }
        }
    });

    console.log('[bootstrap] 所有模块已注册');
}

export { AppInitializer };