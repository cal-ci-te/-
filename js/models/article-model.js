// 代理模式：Article 是 ArticleService 的只读视图。历史原因——早期代码直接使用 Article 对象，
// 重构为 ArticleService 单一数据源后保留此代理层，避免修改 20+ 处引用。
// [TODO] 后续可逐步替换所有 Article.xxx 为 ArticleService.xxx 后移除此文件。
import { ArticleService } from '../services/article-service.js';

export const Article = {
    // 属性代理
    get allArticles() {
        return ArticleService.getAllArticles();
    },
    set allArticles(value) {
        // 只读，忽略设置
    },
    get visibility() {
        const all = ArticleService.getAllArticles();
        const map = {};
        all.forEach(a => { map[a.id] = a.visible !== false; });
        return map;
    },
    get cache() {
        return ArticleService.cache;
    },

    // 方法代理
    fetchArticles: ArticleService.fetchArticles.bind(ArticleService),
    getVisibleArticles: ArticleService.getVisibleArticles.bind(ArticleService),
    getAllArticles: ArticleService.getAllArticles.bind(ArticleService),
    setVisibility: ArticleService.setVisibility.bind(ArticleService),
    onVisibilityChanged: ArticleService.onVisibilityChanged.bind(ArticleService),
    clearCache: ArticleService.clearCache.bind(ArticleService),
    getStats: ArticleService.getStats.bind(ArticleService),

    isVisible: ArticleService.isVisible.bind(ArticleService),
    getArticlesByCategory: ArticleService.getArticlesByCategory.bind(ArticleService),
    getAllCategories: ArticleService.getAllCategories.bind(ArticleService),
    buildDirectoryTree: ArticleService.buildDirectoryTree.bind(ArticleService),
};

