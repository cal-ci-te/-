import { ApiClient } from '../services/api-client.js';
import { Utils } from '../utils.js';
import { ArticleService } from '../services/article-service.js';
import { Article } from '../models/article-model.js';
import { UI } from '../utils/ui-strings.js';

export function createDraftHistory(historyList, historyPanel, toggleHistoryBtn, getCurrentEditingId, loadArticleForEdit) {
    async function loadHistory(articleId) {
        if (!articleId) {
            historyList.innerHTML = `<div style="text-align:center;color:var(--color-text-muted);padding:10px;">${UI.draft.selectArticle}</div>`;
            return;
        }
        try {
            console.log('[DraftHistory] 加载历史记录，文章ID:', articleId);
            const drafts = await ApiClient.get(`/api/articles/${articleId}/drafts`);
            console.log('[DraftHistory] 获取到草稿列表:', drafts.length, '条');
            if (!drafts || drafts.length === 0) {
                historyList.innerHTML = `<div style="text-align:center;color:var(--color-text-muted);padding:10px;">${UI.draft.noHistory}</div>`;
                return;
            }
            const article = Article.allArticles.find(a => a.id === articleId);
            const path = article ? await getArticlePath(article) : '未知路径';
            let html = '';
            drafts.forEach((draft) => {
                const savedAt = new Date(draft.saved_at);
                const timeStr = savedAt.toLocaleString('zh-CN', { 
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                });
                const preview = (draft.content || '').substring(0, 30) + (draft.content.length > 30 ? '…' : '');
                html += `
                    <div class="history-item" data-draft-id="${draft.id}">
                        <div class="history-path">${Utils.escapeHtml(path)}</div>
                        <div class="history-time">${timeStr}</div>
                        <div class="history-preview-text">${Utils.escapeHtml(preview)}</div>
                        <div class="history-actions">
                            <button class="history-preview-btn" data-draft-id="${draft.id}">${UI.draft.previewBtn}</button>
                            <button class="history-restore-btn" data-draft-id="${draft.id}">${UI.draft.restoreBtn}</button>
                            <button class="history-delete-btn" data-draft-id="${draft.id}">${UI.draft.deleteBtn}</button>
                        </div>
                    </div>
                `;
            });
            historyList.innerHTML = html;
            bindHistoryEvents(drafts);
            // 双击/长按恢复
            historyList.querySelectorAll('.history-item').forEach(item => {
                item.addEventListener('dblclick', () => {
                    const draftId = parseInt(item.dataset.draftId);
                    const draft = drafts.find(d => d.id === draftId);
                    if (draft) confirmRestore(draft);
                });
                let longPressTimer = null;
                item.addEventListener('touchstart', (e) => {
                    longPressTimer = setTimeout(() => {
                        const draftId = parseInt(item.dataset.draftId);
                        const draft = drafts.find(d => d.id === draftId);
                        if (draft) confirmRestore(draft);
                    }, 500);
                });
                item.addEventListener('touchend', () => clearTimeout(longPressTimer));
                item.addEventListener('touchmove', () => clearTimeout(longPressTimer));
            });
        } catch (err) {
            console.error('[DraftHistory] 加载历史失败:', err);
            historyList.innerHTML = `<div style="color:var(--color-error);text-align:center;padding:10px;">${UI.draft.loadFailed}</div>`;
        }
    }

    function bindHistoryEvents(drafts) {
        historyList.querySelectorAll('.history-preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const draftId = parseInt(btn.dataset.draftId);
                const draft = drafts.find(d => d.id === draftId);
                if (draft) previewDraft(draft);
            });
        });
        historyList.querySelectorAll('.history-restore-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const draftId = parseInt(btn.dataset.draftId);
                const draft = drafts.find(d => d.id === draftId);
                if (draft) confirmRestore(draft);
            });
        });
        historyList.querySelectorAll('.history-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const draftId = parseInt(btn.dataset.draftId);
                const draft = drafts.find(d => d.id === draftId);
                if (draft) confirmDeleteDraft(draft);
            });
        });
    }

    async function saveDraft() {
        const articleId = getCurrentEditingId();
        if (!articleId) {
            Utils.showToast(UI.draft.selectArticle, true);
            console.warn('[DraftHistory] 未选择文章，放弃保存草稿');
            return;
        }
        const titleInput = document.getElementById('articleTitleInput');
        const contentInput = document.getElementById('articleContentInput');
        const title = titleInput.value.trim();
        const content = contentInput.value;
        if (!title) {
            Utils.showToast(UI.draft.titleEmpty, true);
            return;
        }
        try {
            const existing = Article.allArticles.find(a => a.id === articleId);
            const category = existing?.category || '未分类';
            const payload = { title, content, category };
            console.log('[DraftHistory] 保存草稿请求:', { articleId, payload });
            const result = await ApiClient.post(`/api/articles/${articleId}/drafts`, payload);
            console.log('[DraftHistory] 草稿保存成功，服务器时间:', result.savedAt);
            Utils.showToast(UI.draft.saveSuccess, false);
            await loadHistory(articleId);
        } catch (err) {
            console.error('[DraftHistory] 保存草稿失败:', err);
            Utils.showToast(UI.draft.saveFailed(err.message), true);
        }
    }

    function previewDraft(draft) {
        console.log('[DraftHistory] 预览草稿:', draft.id);
        const modal = document.createElement('div');
        modal.className = 'draft-preview-modal';
        modal.innerHTML = `
            <div class="draft-preview-box">
                <h3>${UI.draft.previewTitle}</h3>
                <p class="draft-preview-meta">
                    保存于 ${new Date(draft.saved_at).toLocaleString('zh-CN')}
                </p>
                <div class="draft-preview-body">
                    ${Utils.escapeHtml(draft.content || UI.draft.emptyContent)}
                </div>
                <button class="draft-preview-close">${UI.draft.previewClose}</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.draft-preview-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    function confirmRestore(draft) {
        console.log('[DraftHistory] 恢复确认，草稿ID:', draft.id);
        if (!confirm(UI.draft.restoreConfirm(new Date(draft.saved_at).toLocaleString('zh-CN')))) {
            console.log('[DraftHistory] 用户取消恢复');
            return;
        }
        restoreDraft(draft);
    }

    async function restoreDraft(draft) {
        try {
            console.log('[DraftHistory] 开始恢复草稿:', draft.id, '文章ID:', draft.article_id);
            await ApiClient.put(`/api/articles/${draft.article_id}`, {
                title: draft.title,
                content: draft.content,
                category: draft.category || '未分类'
            });
            await ArticleService.fetchArticles(true);
            await loadArticleForEdit(draft.article_id);
            await loadHistory(draft.article_id);
            Utils.showToast(UI.draft.restoreSuccess, false);
            console.log('[DraftHistory] 草稿恢复成功');
        } catch (err) {
            console.error('[DraftHistory] 恢复草稿失败:', err);
            Utils.showToast(UI.draft.restoreFailed(err.message), true);
        }
    }

    function confirmDeleteDraft(draft) {
        if (!draft.article_id || isNaN(draft.article_id)) {
            Utils.showToast(UI.draft.dataCorrupted, true);
            console.error('[DraftHistory] 草稿缺少有效的 article_id:', draft);
            return;
        }
        if (!confirm(UI.draft.deleteConfirm(new Date(draft.saved_at).toLocaleString('zh-CN')))) {
            console.log('[DraftHistory] 用户取消删除');
            return;
        }
        deleteDraft(draft.id, draft.article_id);
    }

    async function deleteDraft(draftId, articleId) {
        if (!articleId || isNaN(articleId)) {
            Utils.showToast(UI.draft.invalidArticleId, true);
            console.error('[DraftHistory] 无效的 articleId:', articleId);
            return;
        }
        try {
            console.log('[DraftHistory] 删除草稿:', draftId, '文章ID:', articleId);
            await ApiClient.delete(`/api/articles/${articleId}/drafts/${draftId}`);
            Utils.showToast(UI.draft.deleteSuccess, false);
            await loadHistory(articleId);
            console.log('[DraftHistory] 草稿删除成功，历史已刷新');
        } catch (err) {
            console.error('[DraftHistory] 删除草稿失败:', err);
            Utils.showToast(UI.draft.deleteFailed(err.message), true);
        }
    }

    async function getArticlePath(article) {
        const categories = ArticleService.getAllCategories();
        const findPath = (catId) => {
            const cat = categories.find(c => c.id === catId);
            if (!cat) return '';
            const parentPath = cat.parent ? findPath(cat.parent) : '';
            return parentPath ? parentPath + '/' + cat.name : cat.name;
        };
        const categoryName = article.category || article.categoryName || '未分类';
        const path = findPath(categoryName) || categoryName;
        return path + '/' + (article.title || '未命名');
    }

    function initHistoryUI() {
        toggleHistoryBtn.addEventListener('click', () => {
            const isVisible = historyPanel.style.display !== 'none';
            historyPanel.style.display = isVisible ? 'none' : 'block';
            toggleHistoryBtn.textContent = isVisible ? '📜 历史' : '📜 隐藏历史';
            if (!isVisible) {
                const articleId = getCurrentEditingId();
                if (articleId) loadHistory(articleId);
            }
        });
    }

    return {
        loadHistory,
        saveDraft,
        previewDraft,
        restoreDraft,
        deleteDraft,
        confirmRestore,
        confirmDeleteDraft,
        initHistoryUI
    };
}