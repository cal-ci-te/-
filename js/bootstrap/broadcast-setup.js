import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { ArticleService } from '../services/article-service.js';

export function setupBroadcastChannel() {
    try {
        const channel = new BroadcastChannel('revachol');
        channel.onmessage = (event) => {
            const data = event.data;
            console.log('[BroadcastChannel] 收到消息:', data.type, data.payload);
            const type = data.type;

            if (type === 'article_updated' || type === 'article_created' || 
                type === 'article_deleted' || type === 'visibility_changed') {
                console.log('[BroadcastChannel] 触发数据刷新...');
                ArticleService.fetchArticles(true)
                    .then(() => {
                        console.log('[BroadcastChannel] 数据刷新完成，触发 UI 更新');
                        EventBus.emit(EVENTS.ARTICLE_DATA_LOADED);
                        if (window.__REVACHOL__.UIDirectory && typeof window.__REVACHOL__.UIDirectory.updateTree === 'function') {
                            const filter = window.__REVACHOL__.UIDirectory.filterKeyword || null;
                            window.__REVACHOL__.UIDirectory.updateTree(filter);
                            console.log('[BroadcastChannel] 目录树已手动更新');
                        }
                    })
                    .catch(err => {
                        console.error('[BroadcastChannel] 刷新数据失败:', err);
                    });
            } else if (type === 'draft_saved') {
                console.log('[BroadcastChannel] 草稿保存（忽略）:', data.payload);
            } else if (type === 'magic_box_position_changed') {
                // 超现实箱子：其他标签页管理员拖拽更新了默认位置
                const { defaultX, defaultY } = data.payload || {};
                if (defaultX !== undefined && defaultY !== undefined) {
                    import('../ui/components/magic-box/index.js').then(function (mod) {
                        const box = mod.getMagicBox();
                        if (box && box._state) {
                            box._state.setDefaultPosition(defaultX, defaultY);
                            console.log('[BroadcastChannel] 箱子默认位置已同步:', defaultX, defaultY);
                        }
                    });
                }
            } else {
                console.log('[BroadcastChannel] 未知消息类型:', type);
            }
        };
        window.addEventListener('beforeunload', () => channel.close());
        console.log('✅ BroadcastChannel 已建立');
        return channel;
    } catch (e) {
        console.warn('[BroadcastChannel] 不支持或初始化失败:', e);
        return null;
    }
}