// ========== 文章列表分页/搜索状态管理 ==========
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';

export const ArticleListStore = {
    _allArticles: [],
    _displayArticles: [],
    _currentPage: 1,
    _pageSize: 10,
    _hasMore: false,
    _isLoadingMore: false,
    _isSearchMode: false,
    _searchKeyword: '',

    /**
     * 初始化（首次加载数据）
     */
    init(articles) {
        this._allArticles = articles || [];
        this._currentPage = 1;
        this._isSearchMode = false;
        this._searchKeyword = '';
        this._updateDisplay();
        EventBus.emit(EVENTS.ARTICLES_LIST_UPDATED);
    },

    /**
     * 重置为完整列表（退出搜索或数据刷新时调用）
     */
    resetToFullList(articles) {
        this._allArticles = articles || [];
        this._currentPage = 1;
        this._isSearchMode = false;
        this._searchKeyword = '';
        this._updateDisplay();
        EventBus.emit(EVENTS.ARTICLES_LIST_UPDATED);
    },

    /**
     * 进入搜索模式
     * @param {string} keyword - 搜索关键词
     * @param {Array} filteredArticles - 过滤后的完整文章列表
     */
    setSearchMode(keyword, filteredArticles) {
        this._isSearchMode = true;
        this._searchKeyword = keyword;
        // 搜索模式下，把过滤结果作为“全量数据”，分页从第一页开始
        this._allArticles = filteredArticles || [];
        this._currentPage = 1;
        this._updateDisplay();
        EventBus.emit(EVENTS.ARTICLES_LIST_UPDATED);
    },

    /**
     * 退出搜索模式（恢复显示全部文章）
     */
    exitSearchMode() {
        this._isSearchMode = false;
        this._searchKeyword = '';
        // 恢复显示全部文章（需要外部传入全量数据，或使用之前缓存的全量）
        // 注意：这里假设外部会在退出搜索时调用 resetToFullList，或者我们内部保存一份全量备份
        // 为简化，此处不自动恢复，由调用方负责
    },

    /**
     * 获取当前显示的文章列表（分页后的）
     */
    getDisplayArticles() {
        return this._displayArticles;
    },

    /**
     * 加载更多（分页）
     */
    loadMore() {
        // ★★★ 搜索模式下禁止加载更多 ★★★
        if (this._isSearchMode) {
            console.log('[ArticleListStore] 搜索模式，禁止加载更多');
            return;
        }
        if (this._isLoadingMore || !this._hasMore) return;

        this._isLoadingMore = true;
        // 模拟异步加载（实际项目中可能从服务器获取，这里直接从 _allArticles 取下一段）
        setTimeout(() => {
            const start = (this._currentPage) * this._pageSize;
            const end = start + this._pageSize;
            const nextBatch = this._allArticles.slice(start, end);
            if (nextBatch.length > 0) {
                this._displayArticles = this._displayArticles.concat(nextBatch);
                this._currentPage++;
                this._hasMore = end < this._allArticles.length;
            } else {
                this._hasMore = false;
            }
            this._isLoadingMore = false;
            EventBus.emit(EVENTS.ARTICLES_LIST_UPDATED);
        }, 100);
    },

    /**
     * 获取当前页码
     */
    getCurrentPage() {
        return this._currentPage;
    },

    /**
     * 获取每页大小
     */
    getPageSize() {
        return this._pageSize;
    },

    /**
     * 是否还有更多数据
     */
    getHasMore() {
        return this._hasMore && !this._isSearchMode; // 搜索模式下始终返回 false
    },

    /**
     * 是否正在加载
     */
    getIsLoadingMore() {
        return this._isLoadingMore;
    },

    /**
     * 是否是搜索模式
     */
    getIsSearchMode() {
        return this._isSearchMode;
    },

    /**
     * 更新显示列表（根据当前页和全部数据）
     */
    _updateDisplay() {
        const end = this._currentPage * this._pageSize;
        this._displayArticles = this._allArticles.slice(0, end);
        this._hasMore = end < this._allArticles.length;
    }
};

console.log('✅ ArticleListStore 已加载（支持搜索模式阻断无限滚动）');