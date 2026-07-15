// ========== 文章模型（代理 ArticleService） ==========
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

console.log('✅ article-model.js 已加载 (代理 ArticleService)');
