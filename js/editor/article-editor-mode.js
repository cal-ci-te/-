/**
 * 文章编辑模式 — 主页面内的全屏模态 WYSIWYG 文章编辑器。
 *
 * 复用策略：
 *   1. 文章渲染 → 复用 UIDetail.renderContent 的 Markdown→HTML 逻辑
 *   2. 全屏覆盖层 → 复用 StickerEditorMode._createOverlay 模式
 *   3. 贴纸展示 → 从 article.stickers 渲染贴纸（只读，Phase 4 后交互）
 *   4. ESC 退出 → 复用贴纸编辑模式的按键处理
 *
 * 入口：ArticleEditorMode.open(articleId)
 * 关闭：ArticleEditorMode.close(save)
 *
 * @module article-editor-mode
 */

import { ArticleService } from '../services/article-service.js';
import { DecoShelf } from '../services/deco.js';
import { ApiClient } from '../services/api-client.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { UI } from '../utils/ui-strings.js';
import { Utils } from '../utils.js';
import { MarkdownUtils } from '../utils/markdown-utils.js';
import { StickerRenderer } from './sticker-renderer.js';
import { StickerShape } from './sticker-shape.js';
import { ArticleEditorToolbar } from './article-editor-toolbar.js';
import { StickerEditorMode } from './sticker-editor-mode.js';
import { DraftManager } from './draft-manager.js';

export const ArticleEditorMode = {

  // ---- 状态 ----

  _article: null,
  _articleId: null,
  _dirty: false,
  _saving: false,           // 防重复保存/发布锁
  _snapshot: null,        // 打开时的原始数据快照 { title, content, stickers }

  _overlay: null,
  _articleContainer: null,
  _stickerLayer: null,
  _titleEl: null,
  _contentEl: null,
  _toolbar: null,
  _draftManager: null,

  _visible: false,
  _escHandler: null,
  _inputHandler: null,
  _pasteHandler: null,

  // ---- CSS 动态注入 ----

  _cssInjected: false,

  _ensureCSS() {
    if (this._cssInjected) return;
    var link = document.getElementById('article-editor-css');
    if (!link) {
      link = document.createElement('link');
      link.id = 'article-editor-css';
      link.rel = 'stylesheet';
      link.href = '/css/editor/article-editor.css';
      document.head.appendChild(link);
    }
    this._cssInjected = true;
    console.log('[ArticleEditorMode] CSS 已注入');
  },

  // =========================================================================
  //  入口
  // =========================================================================

  /**
   * 打开文章编辑模式。
   * @param {number} articleId - 文章 ID
   */
  async open(articleId) {
    if (this._visible) {
      console.warn('[ArticleEditorMode] 编辑模式已打开');
      return;
    }

    if (window.innerWidth <= 768) {
      Utils.showToast('文章编辑功能仅支持桌面端', true);
      return;
    }

    console.log('[ArticleEditorMode] 打开编辑模式，文章 ID:', articleId);

    var articles = ArticleService.getAllArticles();
    var article = articles.find(function (a) { return a.id === articleId; });
    if (!article) {
      Utils.showToast('文章不存在', true);
      return;
    }

    this._article = article;
    this._articleId = articleId;
    this._dirty = false;

    // 确保贴纸数据已加载（从内容标记解析）
    if (!article.stickers || !article.stickers.length) {
      article.stickers = this._parseStickersFromContent(article.content || '');
    }

    // 快照：用于检测是否真的有修改（含贴纸数据）
    this._snapshot = {
      title: article.title || '',
      content: article.content || '',
      stickers: article.stickers ? JSON.parse(JSON.stringify(article.stickers)) : [],
    };

    // 加载贴纸库
    var decos = DecoShelf.getAll();
    if (!decos || !decos.length) {
      try { await DecoShelf.loadLibrary(); } catch (e) { /* 继续 */ }
    }

    this._ensureCSS();
    this._createOverlay();
    this._renderArticle(article);
    this._renderExistingStickers(article);
    this._enableEditing();
    this._createToolbar(article);
    this._createDraftManager(articleId);
    this._bindKeys();

    this._visible = true;
    document.body.style.overflow = 'hidden';

    EventBus.emit(EVENTS.STICKER_EDITOR_OPENED, { articleId: articleId });
    EventBus.emit(EVENTS.EDITOR_OPENED, { articleId: articleId });
    console.log('[ArticleEditorMode] 编辑模式已打开');
  },

  /**
   * 关闭编辑模式。
   * @param {boolean} save - 是否保存更改
   */
  close(save) {
    if (!this._visible) return;

    if (save) {
      this._saveArticle();
    }

    this._cleanup();

    EventBus.emit(EVENTS.STICKER_EDITOR_CLOSED, {
      articleId: this._articleId,
      saved: save,
    });
    EventBus.emit(EVENTS.EDITOR_CLOSED, { articleId: this._articleId, saved: save });

    this._visible = false;
    console.log('[ArticleEditorMode] 编辑模式已关闭, save:', save);
  },

  isVisible() { return this._visible; },

  // =========================================================================
  //  覆盖层 — 全屏，与贴纸编辑模式体验一致
  // =========================================================================

  _createOverlay() {
    // 全屏覆盖层 — 与 StickerEditorMode 完全一致的布局，确保贴纸坐标通用
    this._overlay = document.createElement('div');
    this._overlay.id = 'article-editor-overlay';
    this._overlay.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'z-index:9999', 'background:var(--color-bg-primary, #1a1612)',
      'overflow-y:auto', 'overflow-x:hidden',
    ].join(';');
    document.body.appendChild(this._overlay);

    // 标签栏占位条 — 外观与阅读页 .detail-topbar 一致（36px，深色背景 + 底边框）
    this._topbar = document.createElement('div');
    this._topbar.id = 'article-editor-topbar';
    this._topbar.textContent = '文章编辑';
    this._overlay.appendChild(this._topbar);

    // 文章容器 — 完全匹配阅读页 .detail-pane（padding 24px 32px）
    this._articleContainer = document.createElement('div');
    this._articleContainer.id = 'article-editor-article';
    this._articleContainer.style.cssText = [
      'padding:24px 32px', 'position:relative', 'overflow:visible',
      'box-sizing:border-box', 'min-height:100%',
    ].join(';');
    this._overlay.appendChild(this._articleContainer);

    // 贴纸层 — 相对于 articleContainer，坐标与 StickerEditorMode 一致
    this._stickerLayer = document.createElement('div');
    this._stickerLayer.id = 'article-editor-sticker-layer';
    this._stickerLayer.style.cssText = [
      'position:absolute', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'pointer-events:none', 'z-index:10',
    ].join(';');
    this._articleContainer.appendChild(this._stickerLayer);
  },

  // =========================================================================
  //  文章渲染
  // =========================================================================

  _renderArticle(article) {
    // 标题（只读展示，匹配阅读视图；编辑通过工具栏输入框）
    this._titleEl = document.createElement('h1');
    this._titleEl.id = 'article-editor-title';
    this._titleEl.style.cssText = [
      'color:var(--color-text-heading, #e8c88a)',
      'font-size:28px', 'margin:0 0 8px', 'padding-bottom:16px',
      'border-bottom:1px solid var(--color-border, #5a3e2b)',
      'font-family:var(--font-family-serif, Georgia, serif)',
      'outline:none',
    ].join(';');
    this._titleEl.textContent = article.title || '未命名文章';
    this._articleContainer.appendChild(this._titleEl);

    // 内容
    this._contentEl = document.createElement('div');
    this._contentEl.className = 'detail-body';
    this._contentEl.innerHTML = this._renderContent(article.content || '');
    this._contentEl.style.outline = 'none';
    this._articleContainer.appendChild(this._contentEl);
  },

  /**
   * 智能渲染：自动检测内容是 Markdown 还是 HTML。
   * - HTML 内容（以 < 开头）跳过 escapeHtml 直接使用
   * - Markdown 内容走完整的 Markdown→HTML 转换
   * @param {string} text
   * @returns {string} HTML
   */
  _renderContent(text) {
    if (!text) return '<p style="color:var(--color-text-muted);">（空内容）</p>';

    // 如果内容已经是 HTML（之前编辑过），直接使用
    if (this._isHtmlContent(text)) {
      return text;
    }

    // Markdown → HTML（委托给公共工具，避免两个编辑器重复实现）
    return MarkdownUtils.toHTML(text);
  },

  /**
   * 判断内容是否已经是 HTML 格式。
   * 检测特征：以 < 开头且包含 HTML 标签。
   * @param {string} text
   * @returns {boolean}
   */
  _isHtmlContent(text) {
    var trimmed = text.trim();
    return /^<(\w+)[^>]*>/.test(trimmed) && /<\/\w+>/.test(trimmed);
  },

  // =========================================================================
  //  编辑能力 — contentEditable + 状态追踪
  // =========================================================================

  _enableEditing() {
    var self = this;

    // 标题保持只读（编辑通过工具栏输入框）
    // 内容可编辑
    this._contentEl.contentEditable = 'true';
    this._contentEl.setAttribute('role', 'textbox');
    this._contentEl.setAttribute('aria-label', '文章内容');
    this._contentEl.style.cursor = 'text';

    this._contentEl.classList.add('editing');

    // 输入事件 → 标记脏状态
    this._inputHandler = function (e) {
      self._dirty = true;
    };
    this._titleEl.addEventListener('input', this._inputHandler);
    this._contentEl.addEventListener('input', this._inputHandler);

    // 粘贴事件 → 清理格式（只保留纯文本 + 基本结构）
    this._pasteHandler = function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (!text) return;

      // 将纯文本转为带换行的 HTML
      var html = Utils.escapeHtml(text)
        .replace(/\n{2,}/g, "</p><p>")
        .replace(/\n/g, '<br>');
      html = '<p>' + html + '</p>';

      // 插入到光标位置
      var sel = window.getSelection();
      if (sel.rangeCount && sel.getRangeAt(0).intersectsNode(self._contentEl)) {
        var range = sel.getRangeAt(0);
        range.deleteContents();
        var fragment = range.createContextualFragment(html);
        range.insertNode(fragment);
        range.collapse(false);
      }
      self._dirty = true;
    };
    this._contentEl.addEventListener('paste', this._pasteHandler);

    console.log('[ArticleEditorMode] 编辑能力已启用');
  },

  /**
   * 获取当前编辑后的标题。
   * @returns {string}
   */
  getTitle() {
    if (!this._titleEl) return '';
    return this._titleEl.textContent.trim();
  },

  /**
   * 设置标题（更新显示 + 标记脏状态）。
   * @param {string} val
   */
  setTitle(val) {
    if (this._titleEl) {
      this._titleEl.textContent = val || '未命名文章';
    }
    this._dirty = true;
    if (this._toolbar) {
      this._toolbar.updateInfo(val, this._article ? (this._article.category || '未分类') : '');
    }
  },

  /**
   * 获取当前编辑后的内容（HTML 格式）。
   * @returns {string}
   */
  getContentHTML() {
    if (!this._contentEl) return '';
    var html = this._contentEl.innerHTML;

    // 移除占位符段落
    html = html.replace(/<p[^>]*>\s*（空内容）\s*<\/p>/g, '');
    html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

    return html.trim();
  },

  /**
   * 构建保存用的内容：编辑器 HTML + 贴纸标记。
   * 贴纸标记以 HTML 注释形式嵌入内容末尾，确保后端持久化后仍可解析。
   * @returns {string}
   */
  _buildSaveContent() {
    var html = this.getContentHTML();

    // 先移除已有的贴纸标记（避免重复）
    html = StickerRenderer.stripMarkers(html);

    // 追加当前贴纸标记
    var stickers = this._article ? (this._article.stickers || []) : [];
    stickers.forEach(function (s) {
      html += '\n' + StickerRenderer.createMarker(s.decoId, s);
    });


    return html.trim();
  },

  /**
   * 从文章内容中解析贴纸标记（用于页面刷新后恢复贴纸数据）。
   * @param {string} content - 文章内容（可能含 HTML 注释标记）
   * @returns {Array} 贴纸数据数组
   */
  _parseStickersFromContent(content) {
    var stickers = [];
    if (!content) return stickers;
    var regex = StickerRenderer._MARKER_REGEX;
    var match;
    while ((match = regex.exec(content)) !== null) {
      var fields = StickerRenderer._parseMarkerContent(match[1]);
      stickers.push({
        decoId: fields.decoId,
        x: fields.x ? parseInt(fields.x) : StickerShape.DEFAULT_X,
        y: fields.y ? parseInt(fields.y) : StickerShape.DEFAULT_Y + stickers.length * StickerShape.DEFAULT_GAP,
        width: parseInt(fields.w) || StickerShape.DEFAULT_SIZE,
        height: parseInt(fields.h) || StickerShape.DEFAULT_SIZE,
        align: fields.align || 'left',
      });
    }
    return stickers;
  },

  /**
   * 检测是否有实际修改（对比快照）。
   * 注意：_snapshot.content 可能含贴纸标记，getContentHTML 不含，比较前需剥离。
   * @returns {boolean}
   */
  hasChanges() {
    if (!this._snapshot) return this._dirty;

    var currentTitle = this.getTitle();
    var currentContent = this.getContentHTML();
    var currentStickers = this._article ? (this._article.stickers || []) : [];

    // 剥离贴纸标记后比较内容（快照 content 可能含标记）
    var snapshotContent = StickerRenderer.stripMarkers(this._snapshot.content || '');
    var cleanContent = StickerRenderer.stripMarkers(currentContent || '');

    return currentTitle !== this._snapshot.title ||
           cleanContent !== snapshotContent ||
           JSON.stringify(currentStickers) !== JSON.stringify(this._snapshot.stickers || []);
  },

  // =========================================================================
  //  贴纸渲染与交互（拖拽 + 右键菜单，完全复用 StickerEditorMode 模式）
  // =========================================================================

  _renderExistingStickers(article) {
    if (!this._stickerLayer) return;
    var stickers = article.stickers || [];
    if (!stickers || !stickers.length) return;
    var self = this;

    stickers.forEach(function (data, index) {
      var deco = DecoShelf.get(data.decoId);
      if (!deco) return;

      var el = document.createElement('div');
      el.className = 'article-sticker-editing';
      el.id = 'editor-sticker-' + data.decoId;
      el.dataset.decoId = data.decoId;
      el.dataset.index = index;

      var imgSrc = deco.dataUrl || deco.url || '';
      var w = data.width || StickerShape.DEFAULT_SIZE;
      var h = data.height || StickerShape.DEFAULT_SIZE;
      var x = data.x || StickerShape.DEFAULT_X, y = data.y || StickerShape.DEFAULT_Y;
      if (self._articleContainer) {
        var cw = self._articleContainer.offsetWidth || 800;
        x = Math.max(0, Math.min(x, cw - w - 10));
        y = Math.max(10, y);
      }

      el.style.cssText = [
        'position:absolute', 'left:' + x + 'px', 'top:' + y + 'px',
        'width:' + w + 'px', 'height:' + h + 'px',
        'background-image:url(' + imgSrc + ')',
        'background-size:contain', 'background-repeat:no-repeat',
        'background-position:center',
        'pointer-events:auto', 'z-index:10', 'cursor:grab',
        'border:2px solid transparent', 'border-radius:4px',
      ].join(';');

      el.addEventListener('mouseenter', function () { if (el.style.cursor !== 'grabbing') el.style.borderColor = 'var(--color-accent, #c47a44)'; });
      el.addEventListener('mouseleave', function () { if (el.style.cursor !== 'grabbing') el.style.borderColor = 'transparent'; });

      self._bindEditorStickerDrag(el, data);
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); self._showEditorStickerMenu(e.clientX, e.clientY, data, el); });

      self._stickerLayer.appendChild(el);
    });
  },

  _bindEditorStickerDrag(el, stickerData) {
    var self = this, container = this._articleContainer;
    el.addEventListener('mousedown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      var sx = e.clientX, sy = e.clientY;
      var sl = parseFloat(el.style.left) || 0, st = parseFloat(el.style.top) || 0;
      el.style.cursor = 'grabbing'; el.style.zIndex = '20';
      el.style.borderColor = 'var(--color-accent, #c47a44)';
      function onMove(ev) {
        ev.preventDefault();
        var nl = sl + ev.clientX - sx, nt = st + ev.clientY - sy;
        if (container) { var cr = container.getBoundingClientRect(); nl = Math.max(0, Math.min(nl, cr.width - (el.offsetWidth || 100))); nt = Math.max(10, Math.min(nt, cr.height - (el.offsetHeight || 100))); }
        el.style.left = nl + 'px'; el.style.top = nt + 'px';
      }
      function onUp() {
        el.style.cursor = 'grab'; el.style.zIndex = '10'; el.style.borderColor = 'transparent';
        document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
        stickerData.x = parseFloat(el.style.left) || 0; stickerData.y = parseFloat(el.style.top) || 0;
        self._dirty = true;
      }
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    });
  },

  _showEditorStickerMenu(x, y, stickerData, stickerEl) {
    this._removeEditorStickerMenu();
    var self = this;
    var menu = document.createElement('div');
    menu.id = 'editor-sticker-context-menu';
    menu.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;z-index:10002;background:var(--color-bg-tertiary,#2a231c);border:1px solid var(--color-border-highlight,#c47a44);border-radius:4px;padding:4px 0;min-width:160px;box-shadow:4px 4px 0 rgba(0,0,0,0.35);font-family:Courier New,monospace;font-size:13px';

    [{ label: '🔄 切换浮动方向', action: function () { stickerData.align = stickerData.align === 'right' ? 'left' : 'right'; self._removeEditorStickerMenu(); self._dirty = true; } },
     { sep: true },
     { label: '🗑️ 删除贴纸', action: function () {
       // 1. 从数据中移除
       if (self._article && self._article.stickers) self._article.stickers = self._article.stickers.filter(function (s) { return s.decoId !== stickerData.decoId; });
       // 2. 移除事件监听器
       if (stickerEl._stickerDragDown) { stickerEl.removeEventListener('mousedown', stickerEl._stickerDragDown); delete stickerEl._stickerDragDown; }
       stickerEl.onmouseenter = null; stickerEl.onmouseleave = null; stickerEl.oncontextmenu = null;
       // 3. 从 DOM 中完全移除
       if (stickerEl.parentNode) stickerEl.parentNode.removeChild(stickerEl);
       self._removeEditorStickerMenu(); self._dirty = true;
     }}].forEach(function (item) {
      if (item.sep) { var s = document.createElement('div'); s.style.cssText = 'height:1px;background:var(--color-border);margin:4px 0'; menu.appendChild(s); }
      else {
        var b = document.createElement('button'); b.textContent = item.label;
        b.style.cssText = 'display:block;width:100%;text-align:left;padding:8px 16px;background:none;border:none;color:var(--color-text-accent);cursor:pointer;font-family:Courier New,monospace;font-size:13px';
        b.addEventListener('mouseenter', function () { b.style.background = 'var(--color-hover)'; });
        b.addEventListener('mouseleave', function () { b.style.background = 'none'; });
        b.addEventListener('click', function (ev) { ev.stopPropagation(); item.action(); });
        menu.appendChild(b);
      }
    });
    document.body.appendChild(menu);
    setTimeout(function () { document.addEventListener('click', function cm() { self._removeEditorStickerMenu(); document.removeEventListener('click', cm); }, { once: true }); }, 0);
  },

  _removeEditorStickerMenu() { var m = document.getElementById('editor-sticker-context-menu'); if (m) m.remove(); },

    // =========================================================================
  //  键盘事件
  // =========================================================================

  _bindKeys() {
    var self = this;

    this._escHandler = function (e) {
      // 跳过在 contentEditable 中的常规输入
      var target = e.target;
      var isEditing = target && (target.contentEditable === 'true' ||
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'));

      if (e.key === 'Escape') {
        e.preventDefault();
        if (self._dirty || self.hasChanges()) {
          var discard = confirm(UI.editor.unsavedConfirm || '有未保存的更改，确定要退出吗？');
          if (discard) {
            self.close(false);
          }
        } else {
          self.close(false);
        }
        return;
      }

      // Ctrl+S/Ctrl+Enter 在 contentEditable 中不触发（防止输入时误操作）
      if (isEditing && (e.ctrlKey || e.metaKey)) return;

      // Ctrl+S → 保存草稿
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        self.saveDraft();
      }

      // Ctrl+Enter → 发布
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        self.saveAndPublish();
      }
    };
    document.addEventListener('keydown', this._escHandler);
  },

  // =========================================================================
  //  保存操作
  // =========================================================================

  /**
   * 显示反馈弹窗（保存/发布成功）。
   * @param {string} title - 弹窗标题
   * @param {Array<{label:string, value:string}>} details - 详情行 [{label, value}]
   */
  _showFeedbackModal(title, details) {
    var self = this;
    // 移除已有弹窗
    var existing = document.getElementById('editor-feedback-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'editor-feedback-modal';
    overlay.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'z-index:10050', 'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,0.5)', 'backdrop-filter:blur(4px)',
    ].join(';');

    var box = document.createElement('div');
    box.style.cssText = [
      'background:var(--color-bg-tertiary, #2a231c)',
      'border:1px solid var(--color-border-highlight, #c47a44)',
      'border-radius:8px', 'padding:24px 28px', 'min-width:300px', 'max-width:420px',
      'box-shadow:var(--shadow-md, 4px 4px 0 rgba(0,0,0,0.35))',
      'font-family:Courier New,monospace', 'font-size:13px',
      'text-align:center',
    ].join(';');

    var titleEl = document.createElement('h3');
    titleEl.style.cssText = 'color:var(--color-text-heading, #e8c88a);margin:0 0 16px;font-size:16px;';
    titleEl.textContent = title;
    box.appendChild(titleEl);

    if (details && details.length) {
      details.forEach(function (row) {
        var line = document.createElement('div');
        line.style.cssText = 'margin-bottom:8px;';
        line.innerHTML =
          '<span style="color:var(--color-text-muted);">' + row.label + '：</span>' +
          '<span style="color:var(--color-text-accent);">' + Utils.escapeHtml(row.value || '') + '</span>';
        box.appendChild(line);
      });
    }

    var btn = document.createElement('button');
    btn.textContent = UI.editor.modalConfirmBtn || '确定';
    btn.style.cssText = [
      'margin-top:16px', 'padding:8px 32px',
      'background:var(--color-accent, #c47a44)',
      'color:#fff', 'border:none', 'border-radius:4px',
      'cursor:pointer', 'font-family:Courier New,monospace', 'font-size:13px',
    ].join(';');
    var closeModal = function () { if (overlay.parentNode) overlay.remove(); };
    btn.addEventListener('click', closeModal);
    box.appendChild(btn);

    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);

    // 2.5 秒后自动关闭
    setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 2500);
  },

  /**
   * 保存草稿到后端。
   */
  async saveDraft() {
    if (this._saving) { console.log('[ArticleEditorMode] 保存中，跳过重复请求'); return; }
    if (!this._articleId) {
      Utils.showToast(UI.editor.noArticleSelected, true);
      return;
    }

    var title = this.getTitle();
    if (!title) {
      Utils.showToast(UI.editor.titleRequired, true);
      return;
    }

    var content = this._buildSaveContent();
    var category = this._article ? (this._article.category || '未分类') : '未分类';

    this._saving = true;
    try {
      await ApiClient.post('/api/articles/' + this._articleId + '/drafts', {
        title: title,
        content: content,
        category: category,
      });
      Utils.showToast(UI.editor.saveSuccess, false);
      this._showFeedbackModal(UI.editor.modalDraftSavedTitle, [
        { label: UI.editor.modalDraftSavedTime, value: new Date().toLocaleString() },
        { label: UI.editor.titleLabel, value: title }
      ]);

      // 更新快照 + 刷新草稿列表
      this._snapshot = { title: title, content: content, stickers: this._article ? JSON.parse(JSON.stringify(this._article.stickers || [])) : [] };
      this._dirty = false;
      if (this._draftManager) { this._draftManager.refresh(); }
      console.log('[ArticleEditorMode] 草稿已保存');
    } catch (err) {
      console.error('[ArticleEditorMode] 草稿保存失败:', err);
      Utils.showToast(UI.editor.saveFailed + err.message, true);
    } finally {
      this._saving = false;
    }
  },

  /**
   * 发布/更新文章到后端。
   */
  async saveAndPublish() {
    if (this._saving) { console.log('[ArticleEditorMode] 发布中，跳过重复请求'); return; }
    if (!this._articleId) {
      Utils.showToast(UI.editor.noArticleSelected, true);
      return;
    }

    var title = this.getTitle();
    if (!title) {
      Utils.showToast(UI.editor.titleRequired, true);
      return;
    }

    // 获取内容 HTML + 追加贴纸标记（确保持久化）
    var content = this._buildSaveContent();
    var category = this._article ? (this._article.category || '未分类') : '未分类';

    this._saving = true;
    try {
      // 先保存草稿
      await ApiClient.put('/api/articles/' + this._articleId, {
        title: title,
        content: content,
        category: category,
      });

      // 刷新文章数据
      await ArticleService.fetchArticles(true);

      Utils.showToast(UI.editor.publishSuccess, false);
      this._showFeedbackModal(UI.editor.modalPublishSuccessTitle, [
        { label: UI.editor.modalPublishSuccessDetail, value: title },
        { label: UI.editor.categoryLabel, value: category }
      ]);

      // 更新快照
      this._snapshot = { title: title, content: content, stickers: this._article ? JSON.parse(JSON.stringify(this._article.stickers || [])) : [] };
      this._dirty = false;

      // 通知主页面
      try {
        var channel = new BroadcastChannel('revachol');
        channel.postMessage({ type: 'article_updated', payload: { articleId: this._articleId } });
        channel.close();
      } catch (e) { /* ignore */ }

      console.log('[ArticleEditorMode] 文章已发布');
    } catch (err) {
      console.error('[ArticleEditorMode] 发布失败:', err);
      Utils.showToast(UI.editor.publishFailed + err.message, true);
    } finally {
      this._saving = false;
    }
  },

  /**
   * 内部保存方法，由 close(true) 调用。
   */
  _saveArticle() {
    if (this._dirty || this.hasChanges()) {
      this.saveAndPublish().catch(function (err) {
        console.error('[ArticleEditorMode] _saveArticle 发布失败:', err);
      });
    }
    this._dirty = false;
  },

  // =========================================================================
  //  工具栏
  // =========================================================================

  _createToolbar(article) {
    var self = this;

    this._toolbar = ArticleEditorToolbar.create({
      onSaveDraft: function () { self.saveDraft(); },
      onPublish: function () { self.saveAndPublish(); },
      onStickers: function () { self._openStickers(); },
      onDiscard: function () { self.discardChanges(); },
      onTitleChange: function (val) { self.setTitle(val); },
      onExit: function () {
        if (self._dirty || self.hasChanges()) {
          var ok = confirm(UI.editor.unsavedConfirm || '有未保存的更改，确定要退出吗？');
          if (ok) self.close(false);
        } else {
          self.close(false);
        }
      },
    });

    this._toolbar.updateInfo(
      article.title || '未命名',
      article.category || article.categoryName || '未分类'
    );
  },

  /** 创建草稿管理面板 */
  _createDraftManager(articleId) {
    var self = this;
    this._draftManager = DraftManager.create(articleId, {
      onRestore: function (draft) {
        self._restoreFromDraft(draft);
      },
    });
  },

  /**
   * 从草稿恢复文章内容。
   * @param {object} draft - { id, title, content, category, saved_at }
   */
  _restoreFromDraft(draft) {
    if (!draft) return;

    // 恢复标题
    if (this._titleEl && draft.title) {
      this._titleEl.textContent = draft.title;
    }

    // 恢复内容（draft.content 可能是 HTML 或 Markdown）
    if (this._contentEl && draft.content) {
      this._contentEl.innerHTML = this._renderContent(draft.content);
    }

    // 恢复贴纸数据（从 content 标记解析，draft 不含独立 stickers 字段）
    if (this._article && draft.content) {
      this._article.stickers = this._parseStickersFromContent(draft.content);
      this._refreshStickerLayer();
    }

    // 标记脏状态
    this._dirty = true;

    // 更新快照（防止草稿恢复后 ESC 不弹确认框）
    this._snapshot = {
      title: draft.title || '',
      content: draft.content || '',
      stickers: this._article ? JSON.parse(JSON.stringify(this._article.stickers || [])) : [],
    };

    // 更新工具栏
    if (this._toolbar) {
      this._toolbar.updateInfo(
        draft.title || '未命名',
        draft.category || '未分类'
      );
    }

    console.log('[ArticleEditorMode] 已从草稿恢复:', draft.id);
  },

  /**
   * 放弃所有修改，恢复到打开编辑器时的原始状态。
   */
  discardChanges() {
    if (!this._snapshot) return;
    if (!(this._dirty || this.hasChanges())) {
      Utils.showToast('没有需要放弃的修改', false);
      return;
    }

    // 恢复标题
    if (this._titleEl) {
      this._titleEl.textContent = this._snapshot.title;
    }
    // 恢复内容
    if (this._contentEl) {
      this._contentEl.innerHTML = this._renderContent(this._snapshot.content);
    }
    // 更新快照
    this._snapshot = {
      title: this._titleEl ? this._titleEl.textContent.trim() : '',
      content: this._snapshot.content,
    };
    this._dirty = false;

    // 更新工具栏
    if (this._toolbar) {
      this._toolbar.updateInfo(
        this._snapshot.title || '未命名',
        this._article ? (this._article.category || this._article.categoryName || '未分类') : ''
      );
    }

    Utils.showToast('已恢复到编辑前的状态', false);
    console.log('[ArticleEditorMode] 已放弃修改');
  },

  /**
   * 打开贴纸编辑模式（StickerEditorMode）。
   * 先保存当前草稿，再以当前文章数据打开贴纸编辑器。
   * 贴纸保存时：更新本地数据 + 重新渲染贴纸层 + 持久化到后端。
   */
  async _openStickers() {
    if (!this._articleId) return;

    try { await this.saveDraft(); } catch (e) { /* 不阻断 */ }

    // 收集当前文章数据（贴纸从 article.stickers 读取）
    var article = {
      id: this._articleId,
      title: this.getTitle(),
      content: this._article ? (this._article.content || '') : '',
      stickers: this._article ? (this._article.stickers || []) : [],
    };

    var self = this;

    var onStickerSaved = async function (data) {
      if (data.articleId === self._articleId && data.stickers) {
        // 1. 更新本地文章对象
        if (self._article) {
          self._article.stickers = JSON.parse(JSON.stringify(data.stickers));
          // 同时更新 article.content 中的贴纸标记（保持兼容）
          var content = self._article.content || '';
          content = StickerRenderer.stripMarkers(content);
          data.stickers.forEach(function (s) {
            content += '\n' + StickerRenderer.createMarker(s.decoId, s);
          });
          self._article.content = content.trim();
        }

        // 2. 重新渲染编辑器内的贴纸层
        self._refreshStickerLayer();

        // 3. 持久化到后端
        try {
          await ApiClient.put('/api/articles/' + self._articleId, {
            title: self.getTitle(),
            content: self._article ? self._article.content : '',
            category: self._article ? (self._article.category || '未分类') : '未分类',
          });
          console.log('[ArticleEditorMode] 贴纸已同步到后端');
        } catch (err) {
          console.error('[ArticleEditorMode] 贴纸同步后端失败:', err);
        }

        self._dirty = true;
      }
      EventBus.off(EVENTS.STICKER_EDITOR_SAVED, onStickerSaved);
      EventBus.off(EVENTS.STICKER_EDITOR_CLOSED, onStickerClosed);
    };

    var onStickerClosed = function (data) {
      EventBus.off(EVENTS.STICKER_EDITOR_SAVED, onStickerSaved);
      EventBus.off(EVENTS.STICKER_EDITOR_CLOSED, onStickerClosed);
    };

    EventBus.on(EVENTS.STICKER_EDITOR_SAVED, onStickerSaved);
    EventBus.on(EVENTS.STICKER_EDITOR_CLOSED, onStickerClosed);

    StickerEditorMode.open(article, null);
  },

  /**
   * 刷新贴纸层（贴纸编辑完成后重新渲染）。
   */
  _refreshStickerLayer() {
    if (!this._stickerLayer) return;
    // 清除旧贴纸
    this._stickerLayer.innerHTML = '';
    // 重新渲染
    if (this._article) {
      this._renderExistingStickers(this._article);
    }
  },

  // =========================================================================
  //  清理
  // =========================================================================

  _cleanup() {
    // 键盘事件
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }

    // 编辑事件
    if (this._titleEl && this._inputHandler) {
      this._titleEl.removeEventListener('input', this._inputHandler);
    }
    if (this._contentEl && this._inputHandler) {
      this._contentEl.removeEventListener('input', this._inputHandler);
    }
    if (this._contentEl && this._pasteHandler) {
      this._contentEl.removeEventListener('paste', this._pasteHandler);
    }
    this._inputHandler = null;
    this._pasteHandler = null;

    // 右键菜单清理
    this._removeEditorStickerMenu();

    // DOM
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    this._articleContainer = null;
    this._stickerLayer = null;
    this._titleEl = null;
    this._contentEl = null;

    // 工具栏
    if (this._toolbar) { this._toolbar.destroy(); this._toolbar = null; }

    // 草稿管理面板
    if (this._draftManager) { this._draftManager.destroy(); this._draftManager = null; }

    // 状态
    document.body.style.overflow = '';
    this._article = null;
    this._articleId = null;
    this._dirty = false;
    this._snapshot = null;
  },
};

export default ArticleEditorMode;
