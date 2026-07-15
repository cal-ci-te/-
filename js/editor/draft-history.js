import { ApiClient } from '../services/api-client.js';
import { Utils } from '../utils.js';
import { ArticleService } from '../services/article-service.js';
import { Article } from '../models/article-model.js';

export function createDraftHistory(historyList, historyPanel, toggleHistoryBtn, getCurrentEditingId, loadArticleForEdit) {
    // loadHistory 需要传入当前文章ID，使用 getCurrentEditingId
    async function loadHistory(articleId) {
        if (!articleId) {
            historyList.innerHTML = '<div style="text-align:center;color:#7a6a58;padding:10px;">请选择文章</div>';
            return;
        }
        try {
            console.log('[DraftHistory] 加载历史记录，文章ID:', articleId);
            const drafts = await ApiClient.get(`/api/articles/${articleId}/drafts`);
            console.log('[DraftHistory] 获取到草稿列表:', drafts.length, '条');
            if (!drafts || drafts.length === 0) {
                historyList.innerHTML = '<div style="text-align:center;color:#7a6a58;padding:10px;">暂无草稿历史</div>';
                return;
            }
            // 构建路径
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
                    <div class="history-item" data-draft-id="${draft.id}" style="border-bottom:1px solid #3a2a1a;padding:6px 0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-size:11px;color:#e8d5b5;font-weight:bold;">${Utils.escapeHtml(path)}</span>
                            <span style="font-size:10px;color:#7a6a58;">${timeStr}</span>
                        </div>
                        <div style="font-size:11px;color:#c4b5a0;margin:2px 0;">${Utils.escapeHtml(preview)}</div>
                        <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;">
                            <button class="history-preview-btn" data-draft-id="${draft.id}" style="background:none;border:1px solid #5a3e2b;color:#e8d5b5;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:10px;">👁️ 查看</button>
                            <button class="history-restore-btn" data-draft-id="${draft.id}" style="background:#5a3e2b;border:none;color:#e8d5b5;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:10px;">↩️ 恢复</button>
                            <button class="history-delete-btn" data-draft-id="${draft.id}" style="background:none;border:none;color:#c44a44;cursor:pointer;font-size:10px;">🗑️ 删除</button>
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
            historyList.innerHTML = '<div style="color:#c44a44;text-align:center;padding:10px;">加载失败</div>';
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
            Utils.showToast('请先选择一篇文章', true);
            console.warn('[DraftHistory] 未选择文章，放弃保存草稿');
            return;
        }
        const titleInput = document.getElementById('articleTitleInput');
        const contentInput = document.getElementById('articleContentInput');
        const title = titleInput.value.trim();
        const content = contentInput.value;
        if (!title) {
            Utils.showToast('标题不能为空', true);
            return;
        }
        try {
            const existing = Article.allArticles.find(a => a.id === articleId);
            const category = existing?.category || '未分类';
            const payload = { title, content, category };
            console.log('[DraftHistory] 保存草稿请求:', { articleId, payload });
            const result = await ApiClient.post(`/api/articles/${articleId}/drafts`, payload);
            console.log('[DraftHistory] 草稿保存成功，服务器时间:', result.savedAt);
            Utils.showToast('草稿已保存', false);
            // 刷新历史
            await loadHistory(articleId);
        } catch (err) {
            console.error('[DraftHistory] 保存草稿失败:', err);
            Utils.showToast('草稿保存失败: ' + err.message, true);
        }
    }

    function previewDraft(draft) {
        console.log('[DraftHistory] 预览草稿:', draft.id);
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
        `;
        modal.innerHTML = `
            <div style="background:#2a231c;border:1px solid #5a3e2b;border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;">
                <h3 style="color:#e8c88a;margin-bottom:8px;">📄 草稿预览</h3>
                <p style="color:#c4b5a0;font-size:12px;border-bottom:1px solid #5a3e2b;padding-bottom:6px;">
                    保存于 ${new Date(draft.saved_at).toLocaleString('zh-CN')}
                </p>
                <div style="color:#e8d5b5;line-height:1.6;font-size:14px;margin-top:10px;white-space:pre-wrap;">
                    ${Utils.escapeHtml(draft.content || '（空内容）')}
                </div>
                <button id="closePreviewBtn" style="margin-top:16px;background:#5a3e2b;border:none;color:#e8d5b5;padding:6px 20px;border-radius:4px;cursor:pointer;">关闭</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#closePreviewBtn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    function confirmRestore(draft) {
        console.log('[DraftHistory] 恢复确认，草稿ID:', draft.id);
        if (!confirm(`确定要将文章恢复为 ${new Date(draft.saved_at).toLocaleString('zh-CN')} 的草稿版本吗？`)) {
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
            // 强制刷新数据
            await ArticleService.fetchArticles(true);
            // 重新加载编辑器
            await loadArticleForEdit(draft.article_id);
            // 刷新历史
            await loadHistory(draft.article_id);
            Utils.showToast('已恢复草稿版本', false);
            console.log('[DraftHistory] 草稿恢复成功');
        } catch (err) {
            console.error('[DraftHistory] 恢复草稿失败:', err);
            Utils.showToast('恢复失败: ' + err.message, true);
        }
    }

    function confirmDeleteDraft(draft) {
        if (!draft.article_id || isNaN(draft.article_id)) {
            Utils.showToast('草稿数据异常，无法删除', true);
            console.error('[DraftHistory] 草稿缺少有效的 article_id:', draft);
            return;
        }
        if (!confirm(`确定要删除 ${new Date(draft.saved_at).toLocaleString('zh-CN')} 的草稿吗？`)) {
            console.log('[DraftHistory] 用户取消删除');
            return;
        }
        deleteDraft(draft.id, draft.article_id);
    }

    async function deleteDraft(draftId, articleId) {
        if (!articleId || isNaN(articleId)) {
            Utils.showToast('无效的文章ID，无法删除', true);
            console.error('[DraftHistory] 无效的 articleId:', articleId);
            return;
        }
        try {
            console.log('[DraftHistory] 删除草稿:', draftId, '文章ID:', articleId);
            await ApiClient.delete(`/api/articles/${articleId}/drafts/${draftId}`);
            Utils.showToast('草稿已删除', false);
            await loadHistory(articleId);
            console.log('[DraftHistory] 草稿删除成功，历史已刷新');
        } catch (err) {
            console.error('[DraftHistory] 删除草稿失败:', err);
            Utils.showToast('删除失败: ' + err.message, true);
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
        // 切换历史面板
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