// ========== 文章列表视图状态存储（从 ArticleService 派生） ==========
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { ArticleService } from '../services/article-service.js';

export const ArticleListStore = {
    // ----- 视图状态（不存储数据副本） -----
    _currentPage: 1,
    _pageSize: 10,
    _isSearchMode: false,
    _searchKeyword: '',
    _isLoadingMore: false,
    _initialized: false,

    // ----- 初始化（订阅事件） -----
    init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('[ArticleListStore] 初始化，订阅数据变更事件');

        // 监听数据加载完成
        EventBus.on(EVENTS.ARTICLE_DATA_LOADED, () => {
            console.log('[ArticleListStore] 收到数据加载事件，刷新列表');
            this._resetPagination();
            this._notify();
        });

        // 监听数据更新（增删改）
        EventBus.on(EVENTS.ARTICLES_UPDATED, () => {
            console.log('[ArticleListStore] 收到数据更新事件，刷新列表');
            this._resetPagination();
            this._notify();
        });

        // 监听登出：重置分页并重新过滤（隐藏文章将对访客不可见）
        EventBus.on(EVENTS.AUTH_LOGGED_OUT, () => {
            console.log('[ArticleListStore] 收到登出事件，重新过滤文章列表');
            this._resetPagination();
            this._notify();
        });

        // 监听登录：重置分页并显示全部文章（含隐藏文章）
        EventBus.on(EVENTS.AUTH_LOGGED_IN, () => {
            console.log('[ArticleListStore] 收到登录事件，显示全部文章');
            this._resetPagination();
            this._notify();
        });

        // 初始加载：如果已有数据，立即通知
        if (ArticleService.getAllArticles().length > 0) {
            this._resetPagination();
            this._notify();
        }
    },

    // ----- 内部方法 -----
    _resetPagination() {
        this._currentPage = 1;
        this._isLoadingMore = false;
    },

    _getFullList() {
        const all = ArticleService.getVisibleArticles();
        if (this._isSearchMode && this._searchKeyword) {
            const kw = this._searchKeyword.toLowerCase();
            return all.filter(a =>
                (a.title && a.title.toLowerCase().includes(kw)) ||
                (a.content && a.content.toLowerCase().includes(kw))
            );
        }
        return all;
    },

    // ----- 对外接口 -----

    /** 获取当前显示的文章列表（分页后的） */
    getDisplayArticles() {
        const full = this._getFullList();
        const end = this._currentPage * this._pageSize;
        return full.slice(0, end);
    },

    /** 是否还有更多 */
    getHasMore() {
        const full = this._getFullList();
        return this._currentPage * this._pageSize < full.length;
    },

    /** 加载更多 */
    loadMore() {
        if (this._isLoadingMore || !this.getHasMore()) return;
        this._isLoadingMore = true;
        // 增加页码并通知
        this._currentPage++;
        this._isLoadingMore = false;
        this._notify();
    },

    /** 进入搜索模式 */
    setSearchMode(keyword) {
        if (!keyword || keyword.trim() === '') {
            this.exitSearchMode();
            return;
        }
        this._isSearchMode = true;
        this._searchKeyword = keyword.trim();
        this._resetPagination();
        this._notify();
    },

    /** 退出搜索模式 */
    exitSearchMode() {
        if (!this._isSearchMode) return;
        this._isSearchMode = false;
        this._searchKeyword = '';
        this._resetPagination();
        this._notify();
    },

    /** 获取搜索关键词 */
    getSearchKeyword() {
        return this._searchKeyword;
    },

    /** 是否是搜索模式 */
    getIsSearchMode() {
        return this._isSearchMode;
    },

    /** 获取当前页码 */
    getCurrentPage() {
        return this._currentPage;
    },

    /** 获取每页大小 */
    getPageSize() {
        return this._pageSize;
    },

    /** 是否正在加载 */
    getIsLoadingMore() {
        return this._isLoadingMore;
    },

    // ----- 内部通知 -----
    _notify() {
        EventBus.emit(EVENTS.ARTICLES_LIST_UPDATED);
    },

    // ----- 废弃方法（保留空实现防止调用报错） -----
    resetToFullList() {
        console.warn('[ArticleListStore] resetToFullList 已废弃，由事件驱动刷新');
        // 如果外部调用，重置分页并通知
        this._resetPagination();
        this._notify();
    },

    setSearchResults() {
        console.warn('[ArticleListStore] setSearchResults 已废弃，请使用 setSearchMode');
    },

    getSearchResults() {
        return this.getDisplayArticles();
    }
};

// 自动初始化
ArticleListStore.init();

console.log('✅ ArticleListStore 已加载（派生式，单一数据源）');