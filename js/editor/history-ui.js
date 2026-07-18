// 历史记录 UI 模块（渲染、查看、恢复、删除）
import { ApiClient } from '../services/api-client.js';
import { Utils } from '../utils.js';
import { ArticleService } from '../services/article-service.js';
import { UI } from '../utils/ui-strings.js';

export const HistoryUI = {
    container: null,
    currentArticleId: null,
    drafts: [],

    init(container) {
        this.container = container;
        console.log('[HistoryUI] 初始化完成');
    },

    async load(articleId) {
        this.currentArticleId = articleId;
        if (!articleId) {
            this.renderEmpty(UI.history.empty);
            return;
        }
        try {
            console.log('[HistoryUI] 加载历史记录，文章ID:', articleId);
            const drafts = await ApiClient.get(`/api/articles/${articleId}/drafts`);
            this.drafts = drafts || [];
            console.log('[HistoryUI] 获取到草稿列表:', this.drafts.length, '条');
            if (this.drafts.length === 0) {
                this.renderEmpty(UI.history.empty);
                return;
            }
            this.renderList();
        } catch (err) {
            console.error('[HistoryUI] 加载历史失败:', err);
            this.renderEmpty(UI.history.loadError || '加载失败', true);
        }
    },

    renderEmpty(message, isError = false) {
        const color = isError ? '#c44a44' : '#7a6a58';
        this.container.innerHTML = `
            <div style="text-align:center;color:${color};padding:10px;font-size:12px;">
                ${message}
            </div>
        `;
    },

    renderList() {
        const article = ArticleService.getAllArticles().find(a => a.id === this.currentArticleId);
        const path = article ? this.getArticlePath(article) : '未知路径';

        let html = '';
        this.drafts.forEach((draft) => {
            const savedAt = new Date(draft.saved_at);
            const timeStr = savedAt.toLocaleString('zh-CN', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
            const preview = (draft.content || '').substring(0, 30) + (draft.content.length > 30 ? '…' : '');

            html += `
                <div class="history-item" data-draft-id="${draft.id}" style="border-bottom:1px solid #3a2a1a;padding:6px 0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:11px;color:#e8d5b5;font-weight:bold;">${Utils.escapeHtml(path)}</span>
                        <span style="font-size:10px;color:#7a6a58;">${timeStr}</span>
                    </div>
                    <div style="font-size:11px;color:#c4b5a0;margin:2px 0;">${Utils.escapeHtml(preview)}</div>
                    <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;">
                        <button class="history-preview-btn" data-draft-id="${draft.id}" style="background:none;border:1px solid #5a3e2b;color:#e8d5b5;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:10px;">👁️ ${UI.history.previewBtn || '查看'}</button>
                        <button class="history-restore-btn" data-draft-id="${draft.id}" style="background:#5a3e2b;border:none;color:#e8d5b5;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:10px;">↩️ ${UI.history.restoreBtn || '恢复'}</button>
                        <button class="history-delete-btn" data-draft-id="${draft.id}" style="background:none;border:none;color:#c44a44;cursor:pointer;font-size:10px;">🗑️ ${UI.history.deleteBtn || '删除'}</button>
                    </div>
                </div>
            `;
        });

        this.container.innerHTML = html;
        this.bindEvents();
    },

    bindEvents() {
        this.container.querySelectorAll('.history-preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const draftId = parseInt(btn.dataset.draftId);
                const draft = this.drafts.find(d => d.id === draftId);
                if (draft) this.previewDraft(draft);
            });
        });

        this.container.querySelectorAll('.history-restore-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const draftId = parseInt(btn.dataset.draftId);
                const draft = this.drafts.find(d => d.id === draftId);
                if (draft) this.confirmRestore(draft);
            });
        });

        this.container.querySelectorAll('.history-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const draftId = parseInt(btn.dataset.draftId);
                const draft = this.drafts.find(d => d.id === draftId);
                if (draft) this.confirmDelete(draft);
            });
        });

        this.container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('dblclick', () => {
                const draftId = parseInt(item.dataset.draftId);
                const draft = this.drafts.find(d => d.id === draftId);
                if (draft) this.confirmRestore(draft);
            });
            let longPressTimer = null;
            item.addEventListener('touchstart', () => {
                longPressTimer = setTimeout(() => {
                    const draftId = parseInt(item.dataset.draftId);
                    const draft = this.drafts.find(d => d.id === draftId);
                    if (draft) this.confirmRestore(draft);
                }, 500);
            });
            item.addEventListener('touchend', () => clearTimeout(longPressTimer));
            item.addEventListener('touchmove', () => clearTimeout(longPressTimer));
        });
    },

    previewDraft(draft) {
        console.log('[HistoryUI] 预览草稿:', draft.id);
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
        `;
        modal.innerHTML = `
            <div style="background:#2a231c;border:1px solid #5a3e2b;border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;">
                <h3 style="color:#e8c88a;margin-bottom:8px;">${UI.history.previewTitle}</h3>
                <p style="color:#c4b5a0;font-size:12px;border-bottom:1px solid #5a3e2b;padding-bottom:6px;">
                    ${UI.history.savedAtPrefix} ${new Date(draft.saved_at).toLocaleString('zh-CN')}
                </p>
                <div style="color:#e8d5b5;line-height:1.6;font-size:14px;margin-top:10px;white-space:pre-wrap;">
                    ${Utils.escapeHtml(draft.content || UI.history.emptyContent || '（空内容）')}
                </div>
                <button id="closePreviewBtn" style="margin-top:16px;background:#5a3e2b;border:none;color:#e8d5b5;padding:6px 20px;border-radius:4px;cursor:pointer;">${UI.history.previewClose}</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#closePreviewBtn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    confirmRestore(draft) {
        const timeStr = new Date(draft.saved_at).toLocaleString('zh-CN');
        if (!confirm(UI.history.restoreConfirm(timeStr))) {
            console.log('[HistoryUI] 用户取消恢复');
            return;
        }
        this.restoreDraft(draft);
    },

    async restoreDraft(draft) {
        try {
            console.log('[HistoryUI] 开始恢复草稿:', draft.id, '文章ID:', draft.article_id);
            await ApiClient.put(`/api/articles/${draft.article_id}`, {
                title: draft.title,
                content: draft.content,
                category: draft.category || '未分类'
            });
            await ArticleService.fetchArticles(true);
            Utils.showToast(UI.history.restoreSuccess, false);
            if (this.onRestore) {
                this.onRestore(draft.article_id);
            }
        } catch (err) {
            console.error('[HistoryUI] 恢复草稿失败:', err);
            Utils.showToast(UI.history.restoreFailed + err.message, true);
        }
    },

    confirmDelete(draft) {
        if (!draft.article_id || isNaN(draft.article_id)) {
            Utils.showToast(UI.history.deleteError || '草稿数据异常，无法删除', true);
            console.error('[HistoryUI] 草稿缺少有效的 article_id:', draft);
            return;
        }
        const timeStr = new Date(draft.saved_at).toLocaleString('zh-CN');
        if (!confirm(UI.history.deleteConfirm(timeStr))) {
            console.log('[HistoryUI] 用户取消删除');
            return;
        }
        this.deleteDraft(draft.id, draft.article_id);
    },

    async deleteDraft(draftId, articleId) {
        try {
            console.log('[HistoryUI] 删除草稿:', draftId, '文章ID:', articleId);
            await ApiClient.delete(`/api/articles/${articleId}/drafts/${draftId}`);
            Utils.showToast(UI.history.deleteSuccess, false);
            await this.load(articleId);
        } catch (err) {
            console.error('[HistoryUI] 删除草稿失败:', err);
            Utils.showToast(UI.history.deleteFailed + err.message, true);
        }
    },

    getArticlePath(article) {
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
    },

    onRestore: null
};