// ============================================================
// 文章编辑器入口（组装各功能模块，动态注入 UI 文案）
// ============================================================
import { AppState } from '../core/app-state.js';
import { MUTATIONS } from '../core/state-mutations.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { ArticleService } from '../services/article-service.js';
import { UIDirectory } from '../ui/components/directory/index.js';
import { showContextMenu } from '../ui/components/directory/context-menu.js';
import { Utils } from '../utils.js';
import { UI } from '../utils/ui-strings.js';
import { EditorCore } from '../editor/editor-core.js';
import { HistoryUI } from '../editor/history-ui.js';
import { AutoSave } from '../editor/auto-save.js';
import { UI } from '../utils/ui-strings.js';

// ===== 1. 模拟登录 =====
AppState.commit(MUTATIONS.SET_LOGGED_IN, true);
Utils.storage.set('admin_logged_in', true);

// ===== 2. DOM 引用 =====
const sidebarEl = document.getElementById('editorSidebar');
const treeContainer = document.getElementById('directoryTreeContainer');
const toggleBtn = document.getElementById('toggleSidebarBtn');
const collapseBtn = document.getElementById('collapseSidebarBtn');
const emptyState = document.getElementById('emptyState');
const editorForm = document.getElementById('editorForm');
const titleInput = document.getElementById('articleTitleInput');
const contentInput = document.getElementById('articleContentInput');
const saveBtn1 = document.getElementById('saveArticleBtn');
const saveBtn2 = document.getElementById('saveArticleBtn2');
const cancelBtn = document.getElementById('cancelEditBtn');
const closeBtn = document.getElementById('closeEditorBtn');
const saveDraftBtn = document.getElementById('saveDraftBtn');
const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
const historyPanel = document.getElementById('historyPanel');
const historyList = document.getElementById('historyList');
const brandText = document.getElementById('brandText');
const titleLabel = document.getElementById('titleLabel');
const contentLabel = document.getElementById('contentLabel');
const directoryLabel = document.getElementById('directoryLabel');

// 新增：搜索和位置管理控件
const searchInput = document.getElementById('editorSearchInput');
const enterPosBtn = document.getElementById('editorEnterPosBtn');
const savePosBtn = document.getElementById('editorSavePosBtn');
const cancelPosBtn = document.getElementById('editorCancelPosBtn');

// ===== 3. 动态设置 UI 文案 =====
function injectUITexts() {
    document.title = UI.editor.pageTitle;
    if (brandText) brandText.textContent = UI.editor.toolbarTitle;
    if (saveDraftBtn) saveDraftBtn.textContent = '💾 ' + UI.editor.saveDraft;
    if (saveBtn1) saveBtn1.textContent = '📌 ' + UI.editor.publish;
    if (saveBtn2) saveBtn2.textContent = '📌 ' + UI.editor.publish;
    if (cancelBtn) cancelBtn.textContent = '↩ ' + UI.editor.cancel;
    if (closeBtn) closeBtn.textContent = '✕ ' + UI.editor.close;
    if (toggleHistoryBtn) toggleHistoryBtn.textContent = '📜 ' + (UI.editor.historyLabel || '历史');
    if (directoryLabel) directoryLabel.textContent = '📂 ' + (UI.editor.sidebarTitle || '目录');
    if (titleLabel) titleLabel.textContent = UI.editor.titleLabel;
    if (contentLabel) contentLabel.textContent = UI.editor.contentLabel;
    if (titleInput) titleInput.placeholder = UI.editor.titlePlaceholder;
    if (contentInput) contentInput.placeholder = UI.editor.contentPlaceholder;
    if (emptyState) emptyState.innerHTML = UI.editor.emptyState;
    // 搜索框占位（使用 UI 中定义的搜索占位）
    if (searchInput) searchInput.placeholder = UI.common.searchPlaceholder;
    console.log('[article-editor] UI 文案注入完成');
}
injectUITexts();

// ===== 4. 侧边栏折叠 =====
function toggleSidebar(show) {
    if (show === undefined) {
        sidebarEl.classList.toggle('collapsed');
    } else if (show) {
        sidebarEl.classList.remove('collapsed');
    } else {
        sidebarEl.classList.add('collapsed');
    }
    const isCollapsed = sidebarEl.classList.contains('collapsed');
    toggleBtn.textContent = isCollapsed ? '☰' : '◀';
    toggleBtn.title = isCollapsed ? (UI.editor.expandSidebar || '展开目录') : (UI.editor.collapseSidebar || '收起目录');
}
collapseBtn.addEventListener('click', () => toggleSidebar(false));
toggleBtn.addEventListener('click', () => toggleSidebar());
toggleSidebar(true);

// ===== 5. 初始化编辑器核心 =====
EditorCore.init(titleInput, contentInput, emptyState, editorForm);
EditorCore.onHistoryRefresh = (articleId) => {
    if (articleId) {
        HistoryUI.load(articleId);
        if (!AutoSave.enabled) AutoSave.start(() => EditorCore.saveDraft());
    } else {
        HistoryUI.load(null);
        AutoSave.stop();
    }
};

// ===== 6. 初始化历史 UI =====
HistoryUI.init(historyList);
HistoryUI.onRestore = async (articleId) => {
    await EditorCore.loadArticle(articleId);
    await HistoryUI.load(articleId);
};

// ===== 7. 目录树初始化 =====
UIDirectory.init(treeContainer);
async function loadData() {
    await ArticleService.fetchArticles(true);
    UIDirectory.updateTree();
}
loadData();
EventBus.on(EVENTS.ARTICLE_VISIBILITY_CHANGED, () => UIDirectory.updateTree());
EventBus.on(EVENTS.ARTICLE_DATA_LOADED, () => UIDirectory.updateTree());

// ===== 8. 点击树节点加载文章 =====
treeContainer.addEventListener('click', (e) => {
    if (e.target.closest('.visibility-toggle')) return;
    const content = e.target.closest('.tree-node-content');
    if (!content) return;
    const nodeLi = content.closest('.tree-node');
    if (!nodeLi) return;
    if (nodeLi.dataset.type === 'article') {
        e.stopPropagation();
        const articleId = parseInt(nodeLi.dataset.articleId);
        if (articleId) {
            EditorCore.loadArticle(articleId);
            UIDirectory.setActiveNode(nodeLi.dataset.nodeId);
        }
    }
}, true);

// ===== 9. 右键菜单 =====
treeContainer.addEventListener('contextmenu', (e) => {
    const content = e.target.closest('.tree-node-content');
    if (!content) return;
    const nodeLi = content.closest('.tree-node');
    if (!nodeLi) return;
    const type = nodeLi.dataset.type;
    const name = nodeLi.dataset.name;
    const articleId = nodeLi.dataset.articleId ? parseInt(nodeLi.dataset.articleId) : null;
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(
        e.clientX, e.clientY, type, name, articleId, nodeLi,
        () => UIDirectory.updateTree()
    );
});

// ===== 10. 绑定按钮事件 =====
saveBtn1.addEventListener('click', () => EditorCore.saveArticle());
saveBtn2.addEventListener('click', () => EditorCore.saveArticle());
cancelBtn.addEventListener('click', () => EditorCore.cancelEdit());
closeBtn.addEventListener('click', () => window.close());
saveDraftBtn.addEventListener('click', () => EditorCore.saveDraft());

// ===== 11. 历史面板切换 =====
toggleHistoryBtn.addEventListener('click', () => {
    const isVisible = historyPanel.style.display !== 'none';
    historyPanel.style.display = isVisible ? 'none' : 'block';
    toggleHistoryBtn.textContent = isVisible ? '📜 ' + (UI.editor.historyLabel || '历史') : '📜 ' + (UI.editor.hideHistory || '隐藏历史');
    if (!isVisible && EditorCore.currentId) {
        HistoryUI.load(EditorCore.currentId);
    }
});

// ===== 12. 键盘快捷键 =====
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        EditorCore.saveDraft();
    }
    if (e.key === 'Escape') {
        EditorCore.cancelEdit();
    }
});

// ===== 13. 搜索功能（防抖，实时过滤目录树） =====
let searchTimeout = null;
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const keyword = e.target.value.trim();
        searchTimeout = setTimeout(() => {
            // 如果关键字为空，恢复完整目录树
            UIDirectory.updateTree(keyword || null);
            // 更新占位提示（可选）
            if (keyword) {
                searchInput.placeholder = `🔍 搜索: "${keyword}"`;
            } else {
                searchInput.placeholder = UI.common.searchPlaceholder;
            }
        }, 300);
    });
    // 按 ESC 清空搜索框并恢复
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            UIDirectory.updateTree(null);
            searchInput.placeholder = UI.common.searchPlaceholder;
            searchInput.blur();
        }
    });
}

// ===== 14. 位置管理功能 =====
if (enterPosBtn && savePosBtn && cancelPosBtn) {
    function updatePositionControls(mode) {
        if (mode === 'enter') {
            enterPosBtn.classList.add('hidden');
            savePosBtn.classList.remove('hidden');
            cancelPosBtn.classList.remove('hidden');
            // 进入拖拽模式
            UIDirectory.enterPositionMode();
        } else {
            enterPosBtn.classList.remove('hidden');
            savePosBtn.classList.add('hidden');
            cancelPosBtn.classList.add('hidden');
            UIDirectory.exitPositionMode();
        }
    }

    enterPosBtn.addEventListener('click', () => {
        updatePositionControls('enter');
        Utils.showToast(UI.toast.editorPositionModeEnter, false);
    });

    savePosBtn.addEventListener('click', () => {
        updatePositionControls('exit');
        // 保存位置（实际由 UIDirectory.exitPositionMode 内部保存，此处仅提示）
        Utils.showToast(UI.toast.editorPositionModeSaved, false);
    });

    cancelPosBtn.addEventListener('click', () => {
        updatePositionControls('exit');
        Utils.showToast(UI.toast.editorPositionModeCancelled, false);
    });

    // 初始状态：隐藏保存/取消按钮
    savePosBtn.classList.add('hidden');
    cancelPosBtn.classList.add('hidden');
}

// ===== 15. 页面关闭/隐藏前自动保存草稿 =====
function autoSaveOnUnload() {
    const articleId = EditorCore.currentId;
    if (!articleId) {
        console.log('[AutoSaveOnUnload] 无正在编辑的文章，跳过');
        return;
    }
    const title = titleInput.value.trim();
    const content = contentInput.value;
    if (!title) {
        console.log('[AutoSaveOnUnload] 标题为空，跳过');
        return;
    }
    const allArticles = ArticleService.getAllArticles();
    const existing = allArticles.find(a => a.id === articleId);
    const category = existing?.category || '未分类';
    const payload = { title, content, category };
    const data = JSON.stringify(payload);
    console.log('[AutoSaveOnUnload] 准备保存草稿，文章ID:', articleId, '内容长度:', content.length);
    const url = `/api/articles/${articleId}/drafts`;
    if (navigator.sendBeacon) {
        const blob = new Blob([data], { type: 'application/json' });
        const sent = navigator.sendBeacon(url, blob);
        if (sent) {
            console.log('[AutoSaveOnUnload] sendBeacon 发送成功');
        } else {
            console.warn('[AutoSaveOnUnload] sendBeacon 失败，使用 fetch fallback');
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: data,
                keepalive: true
            }).catch(err => console.warn('[AutoSaveOnUnload] fetch fallback 失败:', err));
        }
    } else {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true
        }).catch(err => console.warn('[AutoSaveOnUnload] fetch 失败:', err));
    }
}
window.addEventListener('beforeunload', autoSaveOnUnload);
let hiddenTimeout = null;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearTimeout(hiddenTimeout);
        hiddenTimeout = setTimeout(autoSaveOnUnload, 100);
    }
});

// ===== 16. URL 参数加载 =====
const urlParams = new URLSearchParams(window.location.search);
const initialId = parseInt(urlParams.get('articleId'));
if (initialId) {
    EventBus.once(EVENTS.ARTICLE_DATA_LOADED, () => {
        EditorCore.loadArticle(initialId);
    });
}

console.log('✅ 文章编辑器已加载（固定搜索/位置管理 + 动态文案）');