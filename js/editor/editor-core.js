// ============================================================
// 编辑器核心控制模块
// ============================================================
import { ArticleService } from '../services/article-service.js';
import { ApiClient } from '../services/api-client.js';
import { Utils } from '../utils.js';
import { UI } from '../utils/ui-strings.js';
import { UIDirectory } from '../ui/components/directory/index.js';

export const EditorCore = {
    currentId: null,
    titleInput: null,
    contentInput: null,
    emptyState: null,
    editorForm: null,
    onHistoryRefresh: null,

    init(titleEl, contentEl, emptyEl, formEl) {
        this.titleInput = titleEl;
        this.contentInput = contentEl;
        this.emptyState = emptyEl;
        this.editorForm = formEl;
        console.log('[EditorCore] 初始化完成');
    },

    async loadArticle(id) {
        const articles = ArticleService.getAllArticles();
        const article = articles.find(a => a.id === id);
        if (!article) {
            Utils.showToast(UI.editor.articleNotFound, true);
            return;
        }
        this.currentId = id;
        this.titleInput.value = article.title || '';
        this.contentInput.value = article.content || '';
        this.emptyState.style.display = 'none';
        this.editorForm.classList.add('active');
        UIDirectory.setActiveNode('article-' + id);
        console.log('[EditorCore] 已加载文章，ID:', id);
        if (this.onHistoryRefresh) this.onHistoryRefresh(id);
    },

    async saveArticle() {
        if (!this.currentId) {
            Utils.showToast(UI.editor.noArticleSelected, true);
            return;
        }
        const title = this.titleInput.value.trim();
        const content = this.contentInput.value;
        if (!title) {
            Utils.showToast(UI.editor.titleRequired, true);
            return;
        }
        try {
            const allArticles = ArticleService.getAllArticles();
            const existing = allArticles.find(a => a.id === this.currentId);
            const category = existing?.category || '未分类';
            await ApiClient.put(`/api/articles/${this.currentId}`, { title, content, category });
            Utils.showToast(UI.editor.publishSuccess, false);
            await ArticleService.fetchArticles(true);
            UIDirectory.updateTree();
            try {
    const channel = new BroadcastChannel('revachol');
    channel.postMessage({ type: 'article_updated', payload: { articleId: this.currentId } });
    channel.close();
    console.log('[EditorCore] 发送 article_updated 消息');
} catch (e) {
    console.warn('[EditorCore] 发送 BroadcastChannel 失败:', e);
}
        } catch (err) {
            Utils.showToast(UI.editor.publishFailed + err.message, true);
        }
    },

    async saveDraft() {
        if (!this.currentId) {
            Utils.showToast(UI.editor.noArticleSelected, true);
            return;
        }
        const title = this.titleInput.value.trim();
        const content = this.contentInput.value;
        if (!title) {
            Utils.showToast(UI.editor.titleRequired, true);
            return;
        }
        try {
            const allArticles = ArticleService.getAllArticles();
            const existing = allArticles.find(a => a.id === this.currentId);
            const category = existing?.category || '未分类';
            await ApiClient.post(`/api/articles/${this.currentId}/drafts`, { title, content, category });
            Utils.showToast(UI.editor.saveSuccess, false);
            if (this.onHistoryRefresh) this.onHistoryRefresh(this.currentId);
        } catch (err) {
            Utils.showToast(UI.editor.saveFailed + err.message, true);
        }
    },

    cancelEdit() {
        this.currentId = null;
        this.titleInput.value = '';
        this.contentInput.value = '';
        this.editorForm.classList.remove('active');
        this.emptyState.style.display = 'block';
        UIDirectory.setActiveNode(null);
        if (this.onHistoryRefresh) this.onHistoryRefresh(null);
        console.log('[EditorCore] 取消编辑');
    }
};