// ========== 文章列表模块（左右交替布局） ==========
import { Article } from '../../models/article-model.js';
import { UIHelpers } from './helpers.js';
import { UIDetail } from './detail.js';
import { Utils } from '../../utils.js';
import { EventBus } from '../../core/event-bus.js';
import { EVENTS } from '../../core/event-constants.js';
import { UI } from '../../utils/ui-strings.js';
import { ArticleListStore } from '../../stores/article-list-store.js';

export const UIArticles = {
    container: null,
    searchInput: null,
    scrollHandler: null,
    _storeUnsubscribe: null,

    init: function (container, searchInputEl) {
        console.log('[UIArticles] 初始化...');
        this.container = container;
        this.searchInput = searchInputEl;

        // 初始化 Store（首次加载数据）
        const visibleArticles = Article.getVisibleArticles() || [];
        ArticleListStore.init(visibleArticles);

        // 订阅 Store 更新事件
        this._storeUnsubscribe = EventBus.on(EVENTS.ARTICLES_LIST_UPDATED, () => {
            this.renderArticles();
        });

        // ★★★ 监听文章数据加载事件，重置 Store ★★★
        EventBus.on(EVENTS.ARTICLE_DATA_LOADED, () => {
            console.log('[UIArticles] 收到数据加载事件，重置 Store');
            const visibleArticles = Article.getVisibleArticles() || [];
            ArticleListStore.resetToFullList(visibleArticles);
            this.renderArticles();
        });

        // 初始渲染
        this.renderArticles();

        // 绑定滚动监听
        this.bindScrollListener();

        // 监听文章数据变化（来自其他操作，如可见性变更）
        EventBus.on(EVENTS.ARTICLES_UPDATED, (payload) => {
            const articles = payload.articles || [];
            // 如果当前不在搜索模式，重置 Store
            if (!ArticleListStore.getIsSearchMode()) {
                ArticleListStore.resetToFullList(articles);
            }
        });

        console.log('[UIArticles] 初始化完成');
    },

    showSkeleton: function () {
        let skeletonHtml = '';
        for (let i = 0; i < 4; i++) {
            skeletonHtml +=
                '<div class="skeleton-card"><div class="skeleton-line title"></div><div class="skeleton-line long"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>';
        }
        this.container.innerHTML = skeletonHtml;
    },

    renderArticles: function () {
        const container = this.container;
        if (!container) return;

        const articles = ArticleListStore.getDisplayArticles();

        if (!articles || articles.length === 0) {
            container.innerHTML = `<div class="empty">${UI.articles.empty}</div>`;
            return;
        }

        const cardTemplate = document.getElementById('article-card-template');
        const headerTemplate = document.getElementById('group-header-template');

        const groups = this._groupArticles(articles);
        let html = '';
        let groupIndex = 0;

        for (const category in groups) {
            if (Object.hasOwn(groups, category)) {
                const categoryArticles = groups[category];

                if (headerTemplate) {
                    const headerClone = document.importNode(headerTemplate.content, true);
                    const folderTitle = headerClone.querySelector('.folder-title');
                    const level = UIHelpers.getCategoryLevel(category);
                    const icon = level === 1 ? '📁' : level === 2 ? '📂' : '📄';
                    const nameSpan = headerClone.querySelector('.folder-name');
                    const iconSpan = headerClone.querySelector('.folder-icon');
                    if (folderTitle) folderTitle.className = 'folder-title level-' + Math.min(level, 6);
                    if (iconSpan) iconSpan.textContent = icon;
                    if (nameSpan) nameSpan.textContent = category;
                    const tempDiv = document.createElement('div');
                    tempDiv.appendChild(headerClone);
                    html += tempDiv.innerHTML;
                } else {
                    html += this._fallbackGroupHeader(category, groupIndex);
                }

                for (let i = 0; i < categoryArticles.length; i++) {
                    const article = categoryArticles[i];
                    if (cardTemplate) {
                        const cardClone = document.importNode(cardTemplate.content, true);
                        const cardDiv = cardClone.querySelector('.card');
                        if (cardDiv) {
                            cardDiv.id = UIHelpers.generateCardId(article.id);
                            cardDiv.dataset.articleId = article.id;
                            cardDiv.dataset.category = category;
                            const titleEl = cardDiv.querySelector('h3');
                            if (titleEl) titleEl.textContent = article.title || UI.articles.defaultTitle;
                            const contentEl = cardDiv.querySelector('.card-content');
                            if (contentEl) {
                                let displayContent = article.content || UI.articles.defaultContent;
                                displayContent = displayContent
                                    .replace(/^#+\s+(.+)$/gm, '<strong>$1</strong>')
                                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                                if (displayContent.length > 350)
                                    displayContent = displayContent.substring(0, 350) + '…';
                                contentEl.innerHTML = displayContent.replace(/\n/g, '<br>');
                            }
                            const metaEl = cardDiv.querySelector('.card-meta');
                            if (metaEl) {
                                metaEl.textContent = `${UI.articles.cardMetaPrefix}${article.updateTime || UI.articles.unknownTime}`;
                            }
                            const hintEl = cardDiv.querySelector('.card-click-hint');
                            if (hintEl) hintEl.textContent = UI.articles.cardHint;
                        }
                        const tempDiv2 = document.createElement('div');
                        tempDiv2.appendChild(cardClone);
                        html += tempDiv2.innerHTML;
                    } else {
                        html += this._fallbackCard(article, category);
                    }
                }
                groupIndex++;
            }
        }

        container.innerHTML = html;
        this._bindCardEvents();
    },

    _groupArticles: function (articles) {
        const groups = {};
        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            const category = article.categoryName || article.category || UI.articles.defaultCategory;
            if (!groups[category]) groups[category] = [];
            groups[category].push(article);
        }
        return groups;
    },

    _bindCardEvents: function () {
        const container = this.container;
        if (!container) return;
        container.querySelectorAll('.card').forEach(function (card) {
            card.addEventListener('click', function () {
                const articleId = parseInt(this.dataset.articleId);
                UIDetail.openDetail(articleId);
            });
        });
    },

    _fallbackGroupHeader: function (category, groupIndex) {
        const level = UIHelpers.getCategoryLevel(category);
        const levelClass = 'level-' + Math.min(level, 6);
        const icon = level === 1 ? '📁' : level === 2 ? '📂' : '📄';
        return (
            '<div class="group-header" data-group-index="' +
            groupIndex +
            '"><div class="folder-title ' +
            levelClass +
            '"><span class="folder-icon">' +
            icon +
            '</span>' +
            Utils.escapeHtml(category) +
            '</div></div>'
        );
    },

    _fallbackCard: function (article, category) {
        const cardId = UIHelpers.generateCardId(article.id);
        const title = article.title || UI.articles.defaultTitle;
        let content = article.content || UI.articles.defaultContent;
        content = content
            .replace(/^#+\s+(.+)$/gm, '<strong>$1</strong>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        const displayContent = content.length > 350 ? content.substring(0, 350) + '…' : content;
        const updateTime = article.updateTime || article.createTime || UI.articles.unknownTime;
        return (
            '<div class="card" id="' +
            cardId +
            '" data-article-id="' +
            article.id +
            '" data-category="' +
            Utils.escapeHtml(category) +
            '">' +
            '<h3>' +
            Utils.escapeHtml(title) +
            '</h3>' +
            '<div class="card-content">' +
            Utils.escapeHtml(displayContent).replace(/\n/g, '<br>') +
            '</div>' +
            '<div class="card-meta">' +
            UI.articles.cardMetaPrefix +
            updateTime +
            '</div>' +
            '<div class="card-click-hint">' +
            UI.articles.cardHint +
            '</div>' +
            '</div>'
        );
    },

    bindScrollListener: function () {
        const self = this;
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
        }
        this.scrollHandler = function () {
            // ★★★ 双重检查：搜索框有值 或 Store处于搜索模式 → 阻止加载 ★★★
            if (self.searchInput && self.searchInput.value.trim() !== '') return;
            if (ArticleListStore.getIsSearchMode()) return;

            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const distanceToBottom = documentHeight - (scrollTop + windowHeight);

            if (distanceToBottom < 300 && ArticleListStore.getHasMore() && !ArticleListStore.getIsLoadingMore()) {
                ArticleListStore.loadMore();
            }
        };
        window.addEventListener('scroll', this.scrollHandler);
    },

    // 兼容旧调用
    initInfiniteScroll: function (articles) {
        ArticleListStore.init(articles);
        // 由事件触发渲染
    },

    resetInfiniteScroll: function (articles) {
        ArticleListStore.resetToFullList(articles);
    },

    destroy: function () {
        if (this._storeUnsubscribe) {
            EventBus.off(EVENTS.ARTICLES_LIST_UPDATED, this._storeUnsubscribe);
            this._storeUnsubscribe = null;
        }
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
            this.scrollHandler = null;
        }
    }
};

console.log('✅ UIArticles 已加载（使用 ArticleListStore + 数据同步）');