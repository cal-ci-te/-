// ========== 目录树位置管理模式 ==========
import { ArticleService } from '../../../services/article-service.js';
import { ArticleListStore } from '../../../stores/article-list-store.js';
import { EventBus } from '../../../core/event-bus.js';
import { EVENTS } from '../../../core/event-constants.js';
import { Utils } from '../../../utils.js';
import { isMobile, enableTouchDrag, enableTouchContext } from '../../../mobile/index.js';
import { enableDragDrop, applyDragDropVisuals } from './drag-drop.js';
import { showMobileControls, hideMobileControls } from './mobile-controls.js';

/**
 * 创建位置模式管理器
 * @param {Object} context - 上下文
 * @param {HTMLElement} context.container
 * @param {Function} context.getFilterKeyword
 * @param {Function} context.updateTree
 * @param {Function} context.enableDragDrop
 * @param {Function} context.enableTouchDrag
 * @param {Function} context.handleDrop
 * @param {Function} context.onSave   // [新增] 保存回调
 * @param {Function} context.onCancel // [新增] 取消回调
 * @returns {Object} 管理器实例
 */
export function createPositionManager(context) {
    let isActive = false;
    let snapshot = null;
    let dragDisableFn = null;
    let touchDragDisableFn = null;

    const {
        container,
        getFilterKeyword,
        updateTree,
        enableDragDrop: enablePCDrag,
        enableTouchDrag: enableTouchDragFn,
        handleDrop,
        onSave,   // [新增] 保存回调
        onCancel, // [新增] 取消回调
    } = context;

    // ----- 快照操作 -----
    function saveSnapshot() {
        snapshot = {
            articles: JSON.parse(JSON.stringify(ArticleService._data || [])),
            categories: JSON.parse(JSON.stringify(ArticleService._categories || []))
        };
        console.log('[PositionManager] 已保存快照，文章数:', snapshot.articles.length);
    }

    function restoreSnapshot() {
        if (!snapshot) return;
        console.log('[PositionManager] 恢复快照');
        ArticleService._data = snapshot.articles;
        ArticleService._categories = snapshot.categories;
        ArticleService.cache.data = null;
        ArticleService.cache.timestamp = null;
        snapshot = null;
    }

    function clearSnapshot() {
        snapshot = null;
    }

    // ----- 拖拽控制 -----
    function disableAllDrag() {
        if (dragDisableFn) {
            dragDisableFn();
            dragDisableFn = null;
        }
        if (touchDragDisableFn) {
            touchDragDisableFn();
            touchDragDisableFn = null;
        }
        applyDragDropVisuals(container, false);
    }

    function enableDragForCurrentDevice() {
        disableAllDrag();
        if (isMobile()) {
            touchDragDisableFn = enableTouchDragFn(
                container,
                async (sourceData, targetData) => {
                    await handleDrop(sourceData, targetData);
                },
                () => {
                    updateTree(getFilterKeyword());
                }
            );
            showMobileControls();
        } else {
            dragDisableFn = enablePCDrag(container, () => {
                updateTree(getFilterKeyword());
            });
            applyDragDropVisuals(container, true);
        }
    }

    // ----- 公共方法 -----
    function enter() {
        if (isActive) return;
        isActive = true;
        saveSnapshot();
        enableDragForCurrentDevice();
        Utils.showToast('已进入位置管理模式，拖拽节点调整位置', false);
    }

    function exit(shouldSave = true) {
        if (!isActive) return;
        isActive = false;

        disableAllDrag();
        hideMobileControls();
        applyDragDropVisuals(container, false);

        if (!shouldSave && snapshot) {
            restoreSnapshot();
            updateTree(getFilterKeyword());
            // [新增] 调用取消回调（清空待处理列表）
            if (onCancel) onCancel();
            Utils.showToast('已取消，未保存更改', false);
        } else {
            clearSnapshot();
            // [新增] 调用保存回调（提交待处理列表）
            if (onSave) onSave();
            // Toast 由外部处理
        }
    }

    function isActiveMode() {
        return isActive;
    }

    function getSnapshot() {
        return snapshot;
    }

    return {
        enter,
        exit,
        isActiveMode,
        getSnapshot,
        saveSnapshot,    // 暴露以便外部强制保存
        disableAllDrag,  // 暴露以便销毁时清理
    };
}