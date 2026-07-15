// ========== 目录树主模块 ==========
import { renderTree } from './render.js';
import { bindInteractions, handleNodeClick, setActiveNode } from './events.js';
import { showContextMenu } from './context-menu.js';
import { enableDragDrop, applyDragDropVisuals } from './drag-drop.js';
import { Utils } from '../../../utils.js';
import { AppState } from '../../../core/app-state.js';
import { EventBus } from '../../../core/event-bus.js';
import { EVENTS } from '../../../core/event-constants.js';
import { ArticleService } from '../../../services/article-service.js';
import { ArticleListStore } from '../../../stores/article-list-store.js';

export const UIDirectory = {
    container: null,
    allArticles: [],
    isPositionMode: false,
    _dragDisableFn: null,
    _unbindEventsFn: null,
    _toggleVisibilityHandler: null,
    _saveFolderStateHandler: null,
    filterKeyword: null,

    init(container) {
        console.log('[UIDirectory] 初始化...');
        this.container = container;
        EventBus.on(EVENTS.ARTICLE_DATA_LOADED, () => {
            this.updateTree();
        });
        EventBus.on('admin:position-mode-enter', () => this.enterPositionMode());
        EventBus.on('admin:position-mode-exit', () => this.exitPositionMode());
        EventBus.on(EVENTS.AUTH_LOGGED_OUT, () => {
            if (this.isPositionMode) this.exitPositionMode();
        });
        console.log('[UIDirectory] 初始化完成');
    },

    updateTree(filterKeyword = null) {
        this.filterKeyword = filterKeyword;
        const articles = ArticleService.getVisibleArticles();
        const sortedArticles = [...articles].sort((a, b) => a.id - b.id);
        this.allArticles = sortedArticles;

        const treeData = ArticleService.buildDirectoryTree(sortedArticles);
        this.container.innerHTML = renderTree(treeData, 0, filterKeyword);

        this.bindInteractions();
        if (!filterKeyword) {
            EventBus.emit(EVENTS.ARTICLES_UPDATED, { articles: sortedArticles });
            if (!ArticleListStore.getIsSearchMode()) {
                ArticleListStore.resetToFullList(sortedArticles);
            }
        }
        if (this.isPositionMode) {
            this._enableDragDrop();
        }
        console.log('[UIDirectory] 目录树已更新，文章数:', sortedArticles.length, filterKeyword ? `(过滤: ${filterKeyword})` : '');
    },

    bindInteractions() {
        if (this._unbindEventsFn) {
            this._unbindEventsFn();
            this._unbindEventsFn = null;
        }
        if (this._toggleVisibilityHandler) {
            this.container.removeEventListener('directory-toggle-visibility', this._toggleVisibilityHandler);
        }
        if (this._saveFolderStateHandler) {
            this.container.removeEventListener('directory-save-folder-state', this._saveFolderStateHandler);
        }

        const self = this;

        this._toggleVisibilityHandler = async function (e) {
            const { id, btn } = e.detail;
            const currentVisible = btn.dataset.visible === 'true';
            const newVisible = !currentVisible;
            const success = await ArticleService.setVisibility(id, newVisible);
            if (success) {
                btn.dataset.visible = newVisible;
                btn.textContent = newVisible ? '👁️' : '🚫';
                btn.style.color = newVisible ? '#3a5a2b' : '#5a3e2b';
                const parentContent = btn.closest('.tree-node-content');
                const titleSpan = parentContent.querySelector('.node-title');
                const oldAnnot = parentContent.querySelector('.tree-node-content > span:last-child');
                if (oldAnnot && oldAnnot.textContent === '(访客不可见)') {
                    oldAnnot.remove();
                }
                if (!newVisible) {
                    const annot = document.createElement('span');
                    annot.style.cssText = 'font-size:9px;color:#7a6a58;margin-left:6px;';
                    annot.textContent = '(访客不可见)';
                    titleSpan.after(annot);
                }
            }
        };

        this._saveFolderStateHandler = function (e) {
            const { folderName, isCollapsed } = e.detail;
            console.log(`[FolderState-事件] 存储: ${folderName} = ${isCollapsed}`);
            Utils.storage.set('folder-collapsed-' + folderName, isCollapsed);
        };

        this.container.addEventListener('directory-toggle-visibility', this._toggleVisibilityHandler);
        this.container.addEventListener('directory-save-folder-state', this._saveFolderStateHandler);

        const contextMenuHandler = (x, y, type, name, articleId, nodeLi) => {
            showContextMenu(x, y, type, name, articleId, nodeLi, () => {
                self.updateTree(self.filterKeyword);
            });
        };
        const handleNodeClickFn = (nodeElement, nodeData, isDouble) => {
            handleNodeClick(nodeElement, nodeData, isDouble, (nodeId) => {
                self.setActiveNode(nodeId);
            });
        };
        const setActiveNodeFn = (nodeId) => {
            self.setActiveNode(nodeId);
        };
        const unbind = bindInteractions(
            this.container,
            contextMenuHandler,
            handleNodeClickFn,
            setActiveNodeFn
        );
        this._unbindEventsFn = unbind;

        // ★★★ 独立处理 toggle 点击（解决事件未触发问题）★★★
        const toggleHandler = (e) => {
            const toggleIcon = e.target.closest('.toggle-icon[data-toggle="toggle"]');
            if (!toggleIcon) return;
            e.stopPropagation();
            const nodeLi = toggleIcon.closest('.tree-node.folder');
            if (!nodeLi) return;
            const childrenDiv = nodeLi.querySelector(':scope > .children');
            if (!childrenDiv) return;
            const isVisible = childrenDiv.style.display !== 'none';
            const newDisplay = isVisible ? 'none' : 'block';
            childrenDiv.style.display = newDisplay;
            toggleIcon.textContent = isVisible ? '▶' : '▼';
            const folderIcon = nodeLi.querySelector('.node-icon');
            if (folderIcon) folderIcon.textContent = isVisible ? '📁' : '📂';
            const folderName = nodeLi.dataset.name;
            if (folderName) {
                const isCollapsed = !isVisible;
                Utils.storage.set('folder-collapsed-' + folderName, isCollapsed);
                console.log(`[FolderState-独立] 存储: ${folderName} = ${isCollapsed}`);
                // 派发事件以通知其他监听器（可选）
                const event = new CustomEvent('directory-save-folder-state', {
                    detail: { folderName, isCollapsed }
                });
                self.container.dispatchEvent(event);
            }
        };
        this.container.addEventListener('click', toggleHandler);
        // 确保清理时也移除这个监听
        const originalUnbind = this._unbindEventsFn;
        this._unbindEventsFn = () => {
            if (originalUnbind) originalUnbind();
            this.container.removeEventListener('click', toggleHandler);
        };
    },

    setActiveNode(nodeId) {
        setActiveNode(this.container, nodeId);
    },

    enterPositionMode() {
        if (this.isPositionMode) return;
        this.isPositionMode = true;
        this._enableDragDrop();
        Utils.showToast('已进入位置管理模式，拖拽文章或文件夹调整位置', false);
    },

    exitPositionMode() {
        if (!this.isPositionMode) return;
        this.isPositionMode = false;
        if (this._dragDisableFn) {
            this._dragDisableFn();
            this._dragDisableFn = null;
        }
        applyDragDropVisuals(this.container, false);
        Utils.showToast('已退出位置管理模式', false);
    },

    _enableDragDrop() {
        if (this._dragDisableFn) {
            this._dragDisableFn();
            this._dragDisableFn = null;
        }
        const disableFn = enableDragDrop(this.container, () => {
            this.updateTree(this.filterKeyword);
        });
        this._dragDisableFn = disableFn;
        applyDragDropVisuals(this.container, true);
    },
};

console.log('✅ UIDirectory 已加载（使用 localStorage 持久化 + 独立 toggle 处理）');