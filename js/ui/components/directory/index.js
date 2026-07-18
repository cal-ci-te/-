// ========== 目录树主模块（协调器） ==========
import { renderTree } from './render.js';
import { setActiveNode } from './events.js';
import { showContextMenu } from './context-menu.js';
import { enableDragDrop, applyDragDropVisuals } from './drag-drop.js';
import {
    createMobileControls,
    showMobileControls,
    hideMobileControls,
    destroyMobileControls,
    recreateMobileControls,
} from './mobile-controls.js';
import { createPositionManager } from './position-manager.js';
import { createPendingMovesManager } from './directory-pending-moves.js';
import { handleDirectoryDrop } from './directory-drop-handler.js';
import { bindDirectoryInteractions } from './directory-interactions-binder.js';
import { Utils } from '../../../utils.js';
import { AppState } from '../../../core/app-state.js';
import { EventBus } from '../../../core/event-bus.js';
import { EVENTS } from '../../../core/event-constants.js';
import { ArticleService } from '../../../services/article-service.js';
import { isMobile, enableTouchDrag, enableTouchContext } from '../../../mobile/index.js';



export const UIDirectory = {
    container: null,
    filterKeyword: null,
    _unbindInteractionsFn: null,
    _positionManager: null,
    _touchContextDisableFn: null,
    _mobileControls: null,
    _pendingMovesManager: null,

    // ----- 生命周期 -----
    init(container) {
        console.log('[UIDirectory] 初始化...');
        this.container = container;

        // 初始化待移动操作管理器
        this._pendingMovesManager = createPendingMovesManager();

        // 初始化位置管理器
        this._positionManager = createPositionManager({
            container: this.container,
            getFilterKeyword: () => this.filterKeyword,
            updateTree: (keyword) => this.updateTree(keyword),
            enableDragDrop: (el, cb) => enableDragDrop(el, cb),
            enableTouchDrag: (el, onDrop, onEnd) => enableTouchDrag(el, onDrop, onEnd),
            handleDrop: (sourceData, targetData) => this._handleDrop(sourceData, targetData),
            onSave: () => this._pendingMovesManager.commitMoves(() => this.updateTree(this.filterKeyword)),
            onCancel: () => this._pendingMovesManager.clearMoves(),
        });

        // 移动端控件
        if (isMobile()) {
            this._mobileControls = createMobileControls(container, {
                onSave: () => this._handleMobileSave(),
                onCancel: () => this._handleMobileCancel(),
            });
        }

        // 事件监听
        EventBus.on(EVENTS.ARTICLE_DATA_LOADED, () => this.updateTree());
        EventBus.on('admin:position-mode-enter', () => this._positionManager.enter());
        EventBus.on('admin:position-mode-exit', () => this._positionManager.exit(true));
        EventBus.on('admin:position-mode-cancel', () => this._positionManager.exit(false));
        EventBus.on(EVENTS.AUTH_LOGGED_OUT, () => {
            if (this._positionManager.isActiveMode()) {
                this._positionManager.exit(true);
            }
        });

        // 移动端长按支持
        if (isMobile()) {
            this._initMobileSupport();
        }

        console.log('[UIDirectory] 初始化完成');
    },

    // ----- 更新目录树 -----
    updateTree(filterKeyword = null) {
        this.filterKeyword = filterKeyword;
        const articles = ArticleService.getVisibleArticles();
        const sortedArticles = [...articles].sort((a, b) => a.id - b.id);

        const treeData = ArticleService.buildDirectoryTree(sortedArticles);
        this.container.innerHTML = renderTree(treeData, 0, filterKeyword, '');

        // 绑定交互（使用新的绑定器）
        this._bindInteractions();

        if (!filterKeyword) {
            EventBus.emit(EVENTS.ARTICLES_UPDATED, { articles: sortedArticles });
        }

        // 移动端控件重建
        if (isMobile()) {
            this._mobileControls = recreateMobileControls(this.container, {
                onSave: () => this._handleMobileSave(),
                onCancel: () => this._handleMobileCancel(),
            });
            if (this._positionManager.isActiveMode()) {
                showMobileControls();
            }
        }

        // 如果处于位置模式，重新启用拖拽
        if (this._positionManager.isActiveMode()) {
            this._positionManager.disableAllDrag();
            if (isMobile()) {
                enableTouchDrag(
                    this.container,
                    async (sourceData, targetData) => {
                        await this._handleDrop(sourceData, targetData);
                    },
                    () => this.updateTree(this.filterKeyword)
                );
                showMobileControls();
            } else {
                enableDragDrop(this.container, () => this.updateTree(this.filterKeyword));
                applyDragDropVisuals(this.container, true);
            }
        }

        console.log('[UIDirectory] 目录树已更新，文章数:', sortedArticles.length);
    },

    // ----- 绑定交互（使用新绑定器）-----
    _bindInteractions() {
        // 移除旧绑定
        if (this._unbindInteractionsFn) {
            this._unbindInteractionsFn();
            this._unbindInteractionsFn = null;
        }

        const self = this;
        this._unbindInteractionsFn = bindDirectoryInteractions(this.container, {
            onUpdateTree: () => self.updateTree(self.filterKeyword),
            onSetActiveNode: (nodeId) => self.setActiveNode(nodeId),
            onVisibilityToggleSuccess: () => {
                // 可见性切换成功，触发列表更新
                // 由于切换后 ArticleService 会触发事件，这里无需额外操作
            },
        });
    },

    // ----- 辅助方法 -----
    setActiveNode(nodeId) {
        setActiveNode(this.container, nodeId);
    },

    // ----- 移动端控件回调 -----
    _handleMobileSave() {
        console.log('[UIDirectory] 移动端保存位置');
        this._positionManager.exit(true);
        if (this._mobileControls) {
            this._mobileControls.style.display = 'none';
        }
    },

    _handleMobileCancel() {
        console.log('[UIDirectory] 移动端取消位置管理');
        this._positionManager.exit(false);
        if (this._mobileControls) {
            this._mobileControls.style.display = 'none';
        }
    },

    // ----- 移动端长按支持 -----
    _initMobileSupport() {
        if (this._touchContextDisableFn) {
            this._touchContextDisableFn();
        }
        this._touchContextDisableFn = enableTouchContext(
            this.container,
            (x, y, type, name, articleId, nodeLi) => {
                showContextMenu(x, y, type, name, articleId, nodeLi, () => {
                    this.updateTree(this.filterKeyword);
                });
            },
            500
        );
        console.log('[UIDirectory] 移动端长按支持已启用');
    },

    // ----- 拖拽放置（委托给外部模块）-----
    async _handleDrop(sourceData, targetData) {
        await handleDirectoryDrop(sourceData, targetData, {
            positionManager: this._positionManager,
            pendingMovesManager: this._pendingMovesManager,
            updateTreeFn: () => this.updateTree(this.filterKeyword),
            isPositionMode: this._positionManager.isActiveMode(),
        });
    },

    // ----- 销毁 -----
    destroy() {
        if (this._unbindInteractionsFn) {
            this._unbindInteractionsFn();
            this._unbindInteractionsFn = null;
        }
        if (this._touchContextDisableFn) {
            this._touchContextDisableFn();
            this._touchContextDisableFn = null;
        }
        if (this._positionManager) {
            this._positionManager.disableAllDrag();
        }
        if (this._pendingMovesManager) {
            this._pendingMovesManager.clearMoves();
        }
        destroyMobileControls();
        console.log('[UIDirectory] 已销毁');
    }
};

console.log('✅ UIDirectory 已加载（模块化拆分版）');