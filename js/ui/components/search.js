// ========== 搜索模块（Enter 触发，仅过滤目录树） ==========
import { Article } from '../../models/article-model.js';
import { UIArticles } from './articles.js';
import { UIDirectory } from './directory.js';
import { UIHelpers } from './helpers.js';
import { UI } from '../../utils/ui-strings.js';
import { ArticleListStore } from '../../stores/article-list-store.js';

export const UISearch = {
    searchInput: null,
    searchResults: [],
    searchCurrentIndex: -1,
    searchKeyword: '',
    directoryTreeContainer: null,

    init(searchInputEl, treeContainer) {
        console.log('[UISearch] 初始化...');
        this.searchInput = searchInputEl;
        this.directoryTreeContainer = treeContainer;
        this.bindEvents();
        console.log('[UISearch] 初始化完成');
    },

    bindEvents() {
        if (!this.searchInput) {
            console.warn('[UISearch] 搜索框元素不存在');
            return;
        }

        this.searchInput.disabled = false;
        this.searchInput.style.pointerEvents = 'auto';
        this.searchInput.style.opacity = '1';
        this.searchInput.style.zIndex = '100';

        // 移除旧监听
        this.searchInput.removeEventListener('focus', this._focusHandler);
        this.searchInput.removeEventListener('input', this._inputHandler);
        this.searchInput.removeEventListener('keydown', this._keydownHandler);

        this._focusHandler = () => {
            if (window._UISidebar && window._UISidebar.sidebarCollapsed) {
                window._UISidebar.toggleCollapse();
            }
        };

        // input 事件仅更新占位符，不触发搜索
        this._inputHandler = (e) => {
            const keyword = e.target.value.trim();
            // 如果输入为空，清空搜索（恢复目录树）
            if (keyword === '') {
                this.clearSearch();
            } else {
                // 更新占位提示
                // 不执行搜索，等待 Enter
                this.searchInput.placeholder = `搜索: ${keyword} (按 Enter 执行)`;
            }
        };

        this._keydownHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const keyword = this.searchInput.value.trim();
                if (keyword) {
                    this.performSearch(keyword);
                } else {
                    this.clearSearch();
                }
                setTimeout(() => {
                    if (this.searchInput) this.searchInput.focus();
                }, 100);
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateSearchResult(1);
                setTimeout(() => {
                    if (this.searchInput) this.searchInput.focus();
                }, 50);
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateSearchResult(-1);
                setTimeout(() => {
                    if (this.searchInput) this.searchInput.focus();
                }, 50);
            }
            if (e.key === 'Escape') {
                this.clearSearchHighlights();
                this.clearSearch();
                if (this.searchInput) this.searchInput.blur();
            }
        };

        this.searchInput.addEventListener('focus', this._focusHandler);
        this.searchInput.addEventListener('input', this._inputHandler);
        this.searchInput.addEventListener('keydown', this._keydownHandler);
        console.log('[UISearch] 事件绑定完成');
    },

    /**
     * 执行搜索（按 Enter 触发），仅过滤目录树，不影响卡片列表
     */
    performSearch(keyword) {
        if (!keyword || keyword.length < 1) {
            this.clearSearch();
            return;
        }

        this.searchKeyword = keyword;
        // 更新目录树，传入关键字进行过滤
        UIDirectory.updateTree(keyword);
        // 更新搜索框占位
        if (this.searchInput) {
            this.searchInput.placeholder = UI.common.searchResultCount(0) + ' (按 Enter 搜索)';
        }
        // 清空高亮
        this.clearSearchHighlights();
        // 可选：重置导航索引
        this.searchResults = [];
        this.searchCurrentIndex = -1;
        console.log('[UISearch] 执行搜索:', keyword);
    },

    /**
     * 清空搜索，恢复原始目录树
     */
    clearSearch() {
        this.searchKeyword = '';
        if (this.searchInput) {
            this.searchInput.placeholder = UI.common.searchPlaceholder;
        }
        // 恢复目录树（无过滤）
        UIDirectory.updateTree(null);
        this.clearSearchHighlights();
        this.searchResults = [];
        this.searchCurrentIndex = -1;
        console.log('[UISearch] 清空搜索');
    },

    navigateSearchResult(direction) {
        // 此功能在过滤模式下可能仍有用，但当前我们未存储搜索结果列表（因为过滤在目录树中直接显示）
        // 可暂不实现导航，或者重新实现为在目录树中定位到下一个高亮节点
        // 此处保留简单提示
        Utils.showToast('搜索导航功能已简化，请在目录树中点击查看', false);
    },

    clearSearchHighlights() {
        if (!this.directoryTreeContainer) return;
        const highlights = this.directoryTreeContainer.querySelectorAll('.tree-node-content.search-highlight');
        highlights.forEach(el => el.classList.remove('search-highlight'));
    },

    expandSearchResults() {
        // 在过滤模式下，所有文件夹可能已折叠，展开它们
        if (!this.searchKeyword) return;
        const allFolders = this.directoryTreeContainer.querySelectorAll('.tree-node.folder');
        allFolders.forEach(folder => {
            const childrenDiv = folder.querySelector(':scope > .children');
            if (childrenDiv) {
                childrenDiv.style.display = 'block';
                const toggleIcon = folder.querySelector('.toggle-icon[data-toggle="toggle"]');
                if (toggleIcon) toggleIcon.textContent = '▼';
            }
        });
    },
};

console.log('✅ UISearch 已加载 (ES Module)');
