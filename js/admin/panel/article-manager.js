// js/admin/panel/article-manager.js
import { ArticleService } from '../../services/article-service.js';
import { EventBus } from '../../core/event-bus.js';
import { EVENTS } from '../../core/event-constants.js';
import { Utils } from '../../utils.js';
import { AppState } from '../../core/app-state.js';
import { ApiClient } from '../../services/api-client.js';
import { UI } from '../../utils/ui-strings.js';

export const AdminArticleManager = {
    currentEditId: null,

    init() {
        this.renderList();
        this.bindEvents();
        // 监听数据变化自动刷新列表
        EventBus.on(EVENTS.ARTICLE_VISIBILITY_CHANGED, () => this.renderList());
        EventBus.on(EVENTS.ARTICLE_DATA_LOADED, () => this.renderList());
        // 登录状态变化时刷新（管理员登录后可见）
        EventBus.on(EVENTS.AUTH_LOGGED_IN, () => this.renderList());
    },

    renderList() {
        const container = document.getElementById('articleManagementList');
        if (!container) return;
        // 只对管理员显示
        if (!AppState.get('isLoggedIn')) {
            container.innerHTML = `<div style="color:#7a6a58;text-align:center;padding:10px;">${UI.notification.loginRequired}</div>`;
            return;
        }
        const articles = ArticleService.getAllArticles();
        if (!articles || articles.length === 0) {
            container.innerHTML = `<div style="color:#7a6a58;text-align:center;padding:10px;">${UI.admin.articleEmpty}</div>`;
            return;
        }
        // 按分类分组
        const groups = {};
        articles.forEach(a => {
            const cat = a.category || '未分类';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(a);
        });
        let html = '';
        for (const [cat, items] of Object.entries(groups)) {
            html += `<div style="font-size:10px;color:#c4b5a0;padding:2px 8px;background:#1e1a15;border-bottom:1px solid #3a2a1a;">📁 ${Utils.escapeHtml(cat)}</div>`;
            items.forEach(a => {
                const visible = a.visible !== false;
                html += `
                    <div class="article-list-item" data-id="${a.id}" style="display:flex;align-items:center;padding:4px 8px;border-bottom:1px solid #2a231c;cursor:pointer;hover:background:#3a2a1a;">
                        <span style="flex:1;font-size:11px;color:#e8d5b5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Utils.escapeHtml(a.title)}</span>
                        <span style="font-size:9px;color:${visible ? '#3a5a2b' : '#5a3e2b'};margin-right:8px;">${visible ? '👁️' : '🚫'}</span>
                        <button class="edit-article-btn" data-id="${a.id}" style="background:none;border:none;color:#c4b5a0;cursor:pointer;font-size:12px;padding:0 4px;" title="${UI.common.edit}">✏️</button>
                        <button class="delete-article-btn" data-id="${a.id}" style="background:none;border:none;color:#c44a44;cursor:pointer;font-size:12px;padding:0 4px;" title="${UI.common.delete}">🗑️</button>
                    </div>
                `;
            });
        }
        container.innerHTML = html;
        // 事件绑定（委托方式避免重复绑定）
        container.querySelectorAll('.edit-article-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                this.loadArticleToEditor(id);
            });
        });
        container.querySelectorAll('.delete-article-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                this.deleteArticle(id);
            });
        });
        container.querySelectorAll('.article-list-item').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const id = parseInt(row.dataset.id);
                this.loadArticleToEditor(id);
            });
        });
    },

    loadArticleToEditor(id) {
        const articles = ArticleService.getAllArticles();
        const article = articles.find(a => a.id === id);
        if (!article) {
            Utils.showToast(UI.editor.articleNotFound, true);
            return;
        }
        this.currentEditId = id;
        document.getElementById('editArticleId').textContent = id;
        document.getElementById('editArticleTitle').value = article.title || '';
        document.getElementById('editArticleCategory').value = article.category || '';
        document.getElementById('editArticleContent').value = article.content || '';
        document.getElementById('editArticleVisible').checked = article.visible !== false;
        document.getElementById('articleEditor').style.display = 'block';
        document.getElementById('deleteArticleBtn').style.display = 'inline-block';
        document.getElementById('articleEditor').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    resetEditor() {
        this.currentEditId = null;
        document.getElementById('editArticleId').textContent = '';
        document.getElementById('editArticleTitle').value = '';
        document.getElementById('editArticleCategory').value = '';
        document.getElementById('editArticleContent').value = '';
        document.getElementById('editArticleVisible').checked = true;
        document.getElementById('articleEditor').style.display = 'none';
        document.getElementById('deleteArticleBtn').style.display = 'none';
    },

    async saveArticle() {
        const title = document.getElementById('editArticleTitle').value.trim();
        const category = document.getElementById('editArticleCategory').value.trim() || '未分类';
        const content = document.getElementById('editArticleContent').value;
        const visible = document.getElementById('editArticleVisible').checked;
        if (!title) {
            Utils.showToast(UI.editor.titleRequired, true);
            return;
        }
        const id = this.currentEditId;
        const payload = { title, content, category, visible };
        try {
            let result;
            if (id) {
                result = await ApiClient.put(`/api/articles/${id}`, payload);
            } else {
                result = await ApiClient.post('/api/articles', payload);
            }
            Utils.showToast(id ? UI.notification.articleSaved : UI.notification.articleCreated(title), false);
            // 强制刷新数据
            await ArticleService.fetchArticles(true);
            this.renderList();
            this.resetEditor();
            // 触发全局刷新（目录树和文章列表会重新渲染）
            EventBus.emit(EVENTS.ARTICLE_VISIBILITY_CHANGED, {});
            // 额外触发数据加载事件
            EventBus.emit(EVENTS.ARTICLE_DATA_LOADED);
        } catch (err) {
            Utils.showToast(UI.notification.articleSaveFailed + err.message, true);
        }
    },

    async deleteArticle(id) {
        if (!confirm(UI.notification.articleDeleteConfirm)) return;
        try {
            await ApiClient.delete(`/api/articles/${id}`);
            Utils.showToast(UI.notification.articleDeleted, false);
            await ArticleService.fetchArticles(true);
            this.renderList();
            if (this.currentEditId === id) this.resetEditor();
            EventBus.emit(EVENTS.ARTICLE_VISIBILITY_CHANGED, {});
            EventBus.emit(EVENTS.ARTICLE_DATA_LOADED);
        } catch (err) {
            Utils.showToast(UI.notification.articleDeleteFailed + err.message, true);
        }
    },

    bindEvents() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            if (action === 'new-article') {
                this.resetEditor();
                document.getElementById('articleEditor').style.display = 'block';
                document.getElementById('deleteArticleBtn').style.display = 'none';
                document.getElementById('editArticleId').textContent = '';
                document.getElementById('editArticleTitle').focus();
            } else if (action === 'save-article') {
                this.saveArticle();
            } else if (action === 'cancel-edit-article') {
                this.resetEditor();
            } else if (action === 'delete-article') {
                const id = parseInt(document.getElementById('editArticleId').textContent);
                if (id) this.deleteArticle(id);
            } else if (action === 'refresh-articles') {
                ArticleService.fetchArticles(true).then(() => {
                    this.renderList();
                    Utils.showToast(UI.notification.refreshSuccess, false);
                });
            }
        });
    }
};