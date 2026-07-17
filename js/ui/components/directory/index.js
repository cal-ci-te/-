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

// ===== 移动端模块导入 =====
import { isMobile, enableTouchDrag, enableTouchContext } from '../../../mobile/index.js';

export const UIDirectory = {
    container: null,
    allArticles: [],
    isPositionMode: false,
    _dragDisableFn: null,
    _touchDragDisableFn: null,
    _touchContextDisableFn: null,
    _unbindEventsFn: null,
    _toggleVisibilityHandler: null,
    _saveFolderStateHandler: null,
    _toggleHandler: null,
    filterKeyword: null,
    _mobileControls: null,

    init(container) {
        console.log('[UIDirectory] 初始化...');
        this.container = container;

        if (isMobile()) {
            this._createMobileControls();
        }

        EventBus.on(EVENTS.ARTICLE_DATA_LOADED, () => {
            this.updateTree();
        });

        EventBus.on('admin:position-mode-enter', () => this.enterPositionMode());
        EventBus.on('admin:position-mode-exit', () => this.exitPositionMode());

        EventBus.on(EVENTS.AUTH_LOGGED_OUT, () => {
            if (this.isPositionMode) this.exitPositionMode();
        });

        if (isMobile()) {
            this._initMobileSupport();
            console.log('[UIDirectory] 移动端支持已启用');
        }

        console.log('[UIDirectory] 初始化完成');
    },

    _createMobileControls() {
        if (document.getElementById('mobilePositionControls')) return;
        const container = this.container;
        if (!container) return;

        const controls = document.createElement('div');
        controls.id = 'mobilePositionControls';
        controls.className = 'mobile-position-controls';
        controls.style.display = 'none';
        controls.innerHTML = `
            <div class="mobile-pos-hint">📌 拖拽节点调整顺序</div>
            <div class="mobile-pos-actions">
                <button class="mobile-pos-save" data-action="mobile-pos-save">💾 保存</button>
                <button class="mobile-pos-cancel" data-action="mobile-pos-cancel">❌ 取消</button>
            </div>
        `;

        container.parentNode.insertBefore(controls, container);

        controls.querySelector('.mobile-pos-save').addEventListener('click', () => {
            this._handleMobileSave();
        });
        controls.querySelector('.mobile-pos-cancel').addEventListener('click', () => {
            this._handleMobileCancel();
        });

        this._mobileControls = controls;
        console.log('[UIDirectory] 移动端位置管理控件已创建');
    },

    _handleMobileSave() {
        console.log('[UIDirectory] 移动端保存位置');
        this.exitPositionMode();
        if (this._mobileControls) {
            this._mobileControls.style.display = 'none';
        }
        Utils.showToast('位置更改已保存', false);
    },

    _handleMobileCancel() {
        console.log('[UIDirectory] 移动端取消位置管理');
        this.exitPositionMode();
        if (this._mobileControls) {
            this._mobileControls.style.display = 'none';
        }
        Utils.showToast('已取消，未保存更改', false);
    },

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

    updateTree(filterKeyword = null) {
        this.filterKeyword = filterKeyword;
        const articles = ArticleService.getVisibleArticles();
        const sortedArticles = [...articles].sort((a, b) => a.id - b.id);
        this.allArticles = sortedArticles;

        const treeData = ArticleService.buildDirectoryTree(sortedArticles);
        this.container.innerHTML = renderTree(treeData, 0, filterKeyword);

        // ===== 关键：每次更新后重新绑定交互事件 =====
        this.bindInteractions();

        if (!filterKeyword) {
            EventBus.emit(EVENTS.ARTICLES_UPDATED, { articles: sortedArticles });
            if (!ArticleListStore.getIsSearchMode()) {
                ArticleListStore.resetToFullList(sortedArticles);
            }
        }

        if (isMobile()) {
            this._recreateMobileControls();
        }

        if (this.isPositionMode) {
            this._enableDragDrop();
            if (isMobile()) {
                this._enableTouchDrag();
                this._showMobileControls();
            }
        }

        console.log('[UIDirectory] 目录树已更新，文章数:', sortedArticles.length, filterKeyword ? `(过滤: ${filterKeyword})` : '');
    },

    _recreateMobileControls() {
        const oldControls = document.getElementById('mobilePositionControls');
        if (oldControls) oldControls.remove();
        this._createMobileControls();
        if (this.isPositionMode) {
            this._showMobileControls();
        }
    },

    _showMobileControls() {
        if (this._mobileControls) {
            this._mobileControls.style.display = 'block';
        }
    },

    _hideMobileControls() {
        if (this._mobileControls) {
            this._mobileControls.style.display = 'none';
        }
    },

    // ===== 关键：实现 bindInteractions，绑定所有交互事件 =====
    bindInteractions() {
        // 移除旧的事件监听（如果有）
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
        if (this._toggleHandler) {
            this.container.removeEventListener('click', this._toggleHandler);
            this._toggleHandler = null;
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

        this._saveFolderStateHandler = function (e) {
            const { folderName, isCollapsed } = e.detail;
            Utils.storage.set('folder-collapsed-' + folderName, isCollapsed);
        };

        this.container.addEventListener('directory-toggle-visibility', this._toggleVisibilityHandler);
        this.container.addEventListener('directory-save-folder-state', this._saveFolderStateHandler);

        // 交互事件（单击、双击、右键菜单）
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

        // 独立处理 toggle 点击（文件夹折叠/展开）
        this._toggleHandler = (e) => {
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
                const event = new CustomEvent('directory-save-folder-state', {
                    detail: { folderName, isCollapsed }
                });
                self.container.dispatchEvent(event);
            }
        };

        this.container.addEventListener('click', this._toggleHandler);

        // 更新清理函数
        const originalUnbind = this._unbindEventsFn;
        this._unbindEventsFn = () => {
            if (originalUnbind) originalUnbind();
            if (self._toggleHandler) {
                self.container.removeEventListener('click', self._toggleHandler);
                self._toggleHandler = null;
            }
        };

        console.log('[UIDirectory] 交互事件已绑定');
    },

    setActiveNode(nodeId) {
        setActiveNode(this.container, nodeId);
    },

    enterPositionMode() {
        if (this.isPositionMode) return;
        this.isPositionMode = true;

        this._enableDragDrop();
        this._enableTouchDrag();

        if (this._mobileControls) {
            this._showMobileControls();
        }

        Utils.showToast('已进入位置管理模式，拖拽节点调整位置', false);
    },

    _enableTouchDrag() {
        if (this._touchDragDisableFn) {
            this._touchDragDisableFn();
            this._touchDragDisableFn = null;
        }

        this._touchDragDisableFn = enableTouchDrag(
            this.container,
            async (sourceData, targetData) => {
                await this._handleDrop(sourceData, targetData);
            },
            () => {
                this.updateTree(this.filterKeyword);
            }
        );
        console.log('[UIDirectory] 触摸拖拽已启用');
    },

    exitPositionMode() {
        if (!this.isPositionMode) return;
        this.isPositionMode = false;

        if (this._dragDisableFn) {
            this._dragDisableFn();
            this._dragDisableFn = null;
        }
        if (this._touchDragDisableFn) {
            this._touchDragDisableFn();
            this._touchDragDisableFn = null;
        }

        this._hideMobileControls();

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

            let newCategory;
            if (isSibling) {
                newCategory = targetFolderId || '未分类';
            } else {
                newCategory = targetFolderId || '未分类';
            }

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

    destroy() {
        if (this._unbindEventsFn) {
            this._unbindEventsFn();
            this._unbindEventsFn = null;
        }

        if (this._dragDisableFn) {
            this._dragDisableFn();
            this._dragDisableFn = null;
        }

        if (this._touchDragDisableFn) {
            this._touchDragDisableFn();
            this._touchDragDisableFn = null;
        }

        if (this._touchContextDisableFn) {
            this._touchContextDisableFn();
            this._touchContextDisableFn = null;
        }

        const controls = document.getElementById('mobilePositionControls');
        if (controls) controls.remove();

        console.log('[UIDirectory] 已销毁');
    }
};

console.log('✅ UIDirectory 已加载（集成移动端支持 + 交互修复）');