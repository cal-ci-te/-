// ========== 文章列表状态存储 ==========
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';

// 定义列表更新事件（若不存在，补充到 event-constants.js）
// 建议在 event-constants.js 中添加：
// ARTICLES_LIST_UPDATED: 'articles:list-updated'

export const ArticleListStore = {
    // 私有状态
    _allArticles: [],
    _currentPage: 1,
    _pageSize: 3,
    _hasMore: false,
    _isLoadingMore: false,
    _isSearchMode: false,    // 标识当前是否处于搜索模式
    _searchResults: [],      // 搜索模式下的结果列表

    // ----- 初始化 / 重置 -----
    init(articles) {
        this._allArticles = articles || [];
        this._currentPage = 1;
        this._hasMore = articles.length > this._pageSize;
        this._isLoadingMore = false;
        this._isSearchMode = false;
        this._searchResults = [];
        this._notify();
    },

    // ----- Getter（供 UI 读取） -----
    getDisplayArticles() {
        if (this._isSearchMode) {
            return this._searchResults.slice(0, this._currentPage * this._pageSize);
        }
        return this._allArticles.slice(0, this._currentPage * this._pageSize);
    },

    getAllArticles() {
        return this._allArticles.slice();
    },

    getCurrentPage() {
        return this._currentPage;
    },

    getPageSize() {
        return this._pageSize;
    },

    getHasMore() {
        return this._hasMore;
    },

    getIsLoadingMore() {
        return this._isLoadingMore;
    },

    getIsSearchMode() {
        return this._isSearchMode;
    },

    getSearchResults() {
        return this._searchResults.slice();
    },

    // ----- 操作 -----
    // 重置为完整列表（退出搜索）
    resetToFullList(articles) {
        if (articles) this._allArticles = articles;
        this._currentPage = 1;
        this._hasMore = this._allArticles.length > this._pageSize;
        this._isSearchMode = false;
        this._searchResults = [];
        this._isLoadingMore = false;
        this._notify();
    },

    // 进入搜索模式，显示过滤结果
    setSearchResults(filteredArticles) {
        this._searchResults = filteredArticles;
        this._isSearchMode = true;
        this._currentPage = 1;
        this._hasMore = filteredArticles.length > this._pageSize;
        this._isLoadingMore = false;
        this._notify();
    },

    // 加载更多
    loadMore() {
        if (this._isLoadingMore || !this._hasMore) return;
        this._isLoadingMore = true;
        this._notify(); // 通知 UI 显示加载状态

        // 模拟异步加载（实际可在此发起数据请求，但目前仅更新页码）
        // 为了真实，我们可以延迟一下，但因为是纯前端分页，直接更新页码
        // 但注意：如果数据来自后端，这里应发起请求；当前为前端分页，直接增加页码即可
        // 为了让 UI 有加载动画，我们可以用 setTimeout 模拟延迟
        setTimeout(() => {
            this._currentPage++;
            const total = this._isSearchMode ? this._searchResults.length : this._allArticles.length;
            this._hasMore = this._currentPage * this._pageSize < total;
            this._isLoadingMore = false;
            this._notify();
        }, 300); // 模拟网络延迟
    },

    // 重置加载状态（用于错误处理）
    resetLoadingState() {
        this._isLoadingMore = false;
        this._notify();
    },

    // ----- 内部 -----
    _notify() {
        EventBus.emit(EVENTS.ARTICLES_LIST_UPDATED, { store: this });
    },
};

// 确保 event-constants.js 中有 ARTICLES_LIST_UPDATED
// 若没有，请添加：ARTICLES_LIST_UPDATED: 'articles:list-updated'

console.log('✅ ArticleListStore 已加载');