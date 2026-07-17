// ========== 目录树主模块（协调器） ==========
import { renderTree } from './render.js';
import { bindInteractions, handleNodeClick, setActiveNode } from './events.js';
import { showContextMenu } from './context-menu.js';
import { enableDragDrop, applyDragDropVisuals } from './drag-drop.js';
import { handleFolderToggle } from './folder-state.js';
import {
    createMobileControls,
    showMobileControls,
    hideMobileControls,
    destroyMobileControls,
    recreateMobileControls,
} from './mobile-controls.js';
import { createPositionManager } from './position-manager.js';
import { Utils } from '../../../utils.js';
import { AppState } from '../../../core/app-state.js';
import { EventBus } from '../../../core/event-bus.js';
import { EVENTS } from '../../../core/event-constants.js';
import { ArticleService } from '../../../services/article-service.js';
import { ArticleListStore } from '../../../stores/article-list-store.js';
import { isMobile, enableTouchDrag, enableTouchContext } from '../../../mobile/index.js';

export const UIDirectory = {
    container: null,
    filterKeyword: null,
    _unbindEventsFn: null,
    _toggleVisibilityHandler: null,
    _positionManager: null,
    _touchContextDisableFn: null,
    _mobileControls: null,

    // ----- 生命周期 -----
    init(container) {
        console.log('[UIDirectory] 初始化...');
        this.container = container;

        // 初始化位置管理器
        this._positionManager = createPositionManager({
            container: this.container,
            getFilterKeyword: () => this.filterKeyword,
            updateTree: (keyword) => this.updateTree(keyword),
            enableDragDrop: (el, cb) => enableDragDrop(el, cb),
            enableTouchDrag: (el, onDrop, onEnd) => enableTouchDrag(el, onDrop, onEnd),
            handleDrop: (sourceData, targetData) => this._handleDrop(sourceData, targetData),
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

        this.bindInteractions();

        if (!filterKeyword) {
            EventBus.emit(EVENTS.ARTICLES_UPDATED, { articles: sortedArticles });
            if (!ArticleListStore.getIsSearchMode()) {
                ArticleListStore.resetToFullList(sortedArticles);
            }
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
            // 位置管理器内部会根据设备类型启用对应拖拽
            // 但 updateTree 后需要重新启用，因为 DOM 重建了
            // 我们通过重新 enter 来触发启用（但 enter 会检查 isActive）
            // 更优雅：让位置管理器暴露 reapply 方法
            // 临时方案：手动调用启用
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

    // ----- 事件绑定 -----
    bindInteractions() {
        if (this._unbindEventsFn) {
            this._unbindEventsFn();
            this._unbindEventsFn = null;
        }
        if (this._toggleVisibilityHandler) {
            this.container.removeEventListener('directory-toggle-visibility', this._toggleVisibilityHandler);
        }

        const self = this;

        // 可见性切换
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
        this.container.addEventListener('directory-toggle-visibility', this._toggleVisibilityHandler);

        // 交互事件（单击、双击、右键）
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

        // ★★★ 折叠状态切换（委托给 folder-state 模块） ★★★
        this.container.addEventListener('click', (e) => {
            handleFolderToggle(e, this.container);
        });

        console.log('[UIDirectory] 交互事件已绑定');
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
        Utils.showToast('位置更改已保存', false);
    },

    _handleMobileCancel() {
        console.log('[UIDirectory] 移动端取消位置管理');
        this._positionManager.exit(false);
        if (this._mobileControls) {
            this._mobileControls.style.display = 'none';
        }
        // Toast 已由 position-manager 显示
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

    // ----- 拖拽放置业务逻辑（保持不变） -----
    async _handleDrop(sourceData, targetData) {
        const { type: sourceType, id: sourceId } = sourceData;
        const { targetFolderId, isSibling } = targetData;

        if (sourceType === 'folder') {
            const finalParent = isSibling ? targetFolderId : targetFolderId;
            const success = ArticleService.moveCategory(sourceId, finalParent);
            if (success) {
                const msg = finalParent ? '到 "' + finalParent + '"' : '到根目录';
                Utils.showToast('文件夹已移动' + msg, false);
                await ArticleService.fetchArticles(true);
                this.updateTree(this.filterKeyword);
            } else {
                Utils.showToast('移动失败', true);
            }
            return;
        }

        if (sourceType === 'article') {
            const allArticles = ArticleService.getAllArticles();
            const article = allArticles.find(a => a.id === parseInt(sourceId));
            if (!article) {
                Utils.showToast('源文章不存在', true);
                return;
            }

            let newCategory = isSibling ? (targetFolderId || '未分类') : (targetFolderId || '未分类');
            if (article.category === newCategory) {
                Utils.showToast('文章已在目标文件夹中', false);
                return;
            }

            try {
                const response = await fetch('/api/articles/' + article.id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: article.title,
                        content: article.content,
                        category: newCategory
                    })
                });
                if (response.ok) {
                    Utils.showToast('文章已移动到 "' + newCategory + '"', false);
                    await ArticleService.fetchArticles(true);
                    this.updateTree(this.filterKeyword);
                } else {
                    Utils.showToast('移动失败: ' + response.statusText, true);
                }
            } catch (err) {
                console.error('[UIDirectory] 移动文章失败:', err);
                Utils.showToast('移动失败: ' + err.message, true);
            }
            return;
        }

        Utils.showToast('未知拖拽类型', true);
    },

    // ----- 销毁 -----
    destroy() {
        if (this._unbindEventsFn) {
            this._unbindEventsFn();
            this._unbindEventsFn = null;
        }
        if (this._touchContextDisableFn) {
            this._touchContextDisableFn();
            this._touchContextDisableFn = null;
        }
        if (this._positionManager) {
            this._positionManager.disableAllDrag();
        }
        destroyMobileControls();
        console.log('[UIDirectory] 已销毁');
    }
};

console.log('✅ UIDirectory 已加载（模块化拆分版）');