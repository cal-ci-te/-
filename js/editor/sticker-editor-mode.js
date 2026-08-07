/**
 * 文章内贴纸编辑模式 — 沉浸式全屏贴纸编辑器。
 *
 * 复用主页面组件：
 *   1. 文章阅读样式 → 复用 UIDetail.renderContent 的渲染逻辑
 *   2. 悬浮确认/取消 → 复用 DecoEdit 的 .deco-edit-toolbar CSS
 *   3. 右下角控制台 → 复用管理员控制台 .admin-panel CSS + 拖拽逻辑
 *   4. 贴纸库数据 → 复用 DecoShelf
 *
 * 入口：StickerEditorMode.open(articleData, cursorY)
 * 关闭：StickerEditorMode.close(save)
 */

import { DecoShelf } from '../services/deco.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { UI } from '../utils/ui-strings.js';
import { Utils } from '../utils.js';
import { MarkdownUtils } from '../utils/markdown-utils.js';
import { StickerRenderer } from './sticker-renderer.js';
import { StickerShape } from './sticker-shape.js';

export const StickerEditorMode = {

  _article: null,
  _stickerData: [],
  _snapshot: null,

  _overlay: null,
  _articleContainer: null,
  _stickerLayer: null,
  _toolbar: null,
  _consoleEl: null,

  _visible: false,
  _escHandler: null,
  _escPressCount: 0,
  _escPressTimer: null,

  // =========================================================================
  //  入口
  // =========================================================================

  async open(article, cursorY) {
    if (this._visible) return;

    // 移动端禁用
    if (window.innerWidth <= 768) {
      Utils.showToast(UI.stickerEditor.mobileWarning || '贴纸编辑功能仅支持桌面端', true);
      return;
    }

    this._article = article;

    // 加载贴纸库
    var decos = DecoShelf.getAll();
    if (!decos || !decos.length) {
      try { await DecoShelf.loadLibrary(); } catch (e) { console.warn("[StickerEditorMode] 贴纸库加载失败:", e); Utils.showToast(UI.stickerEditor.emptyLibrary || "贴纸库加载失败，请检查网络连接", true); }
    }

    // 快照
    this._snapshot = article.stickers ? JSON.parse(JSON.stringify(article.stickers)) : [];
    this._stickerData = article.stickers ? JSON.parse(JSON.stringify(article.stickers)) : [];

    // 构建 UI
    this._createOverlay();
    this._renderArticle(article, cursorY);
    this._renderExistingStickers();
    this._createToolbar();
    this._createConsole();
    this._bindKeys();

    this._visible = true;
    document.body.style.overflow = 'hidden';

    EventBus.emit(EVENTS.STICKER_EDITOR_OPENED, { articleId: article.id });
  },

  close(save) {
    if (!this._visible) return;

    if (save) {
      this._saveStickersToArticle();
    } else {
      this._stickerData = this._snapshot ? JSON.parse(JSON.stringify(this._snapshot)) : [];
    }

    this._cleanup();

    EventBus.emit(EVENTS.STICKER_EDITOR_CLOSED, {
      articleId: this._article ? this._article.id : null,
      saved: save,
      stickers: save ? this._stickerData : null,
    });

    this._visible = false;
  },

  isVisible() { return this._visible; },
  getStickerData() { return this._stickerData ? this._stickerData.slice() : []; },

  // =========================================================================
  //  覆盖层 — 全屏，与主页面 detailOverlay 体验一致
  // =========================================================================

  _createOverlay() {
    var self = this;

    // 遮罩层
    this._overlay = document.createElement('div');
    this._overlay.id = 'sticker-editor-overlay';
    this._overlay.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'z-index:9999', 'background:var(--color-bg-primary, #1a1612)',
      'overflow-y:auto', 'overflow-x:hidden',
    ].join(';');
    document.body.appendChild(this._overlay);

    // 点击空白区关闭
    this._overlay.addEventListener('click', function (e) {
      if (e.target === self._overlay) self.close(false);
    });

    // 文章容器 — 与主页面 detail-pane 阅读样式完全一致
    this._articleContainer = document.createElement('div');
    this._articleContainer.id = 'sticker-editor-article';
    this._articleContainer.style.cssText = [
      'max-width:800px', 'margin:40px auto', 'padding:40px 50px',
      'position:relative', 'overflow:visible',
      'min-height:80vh',
    ].join(';');
    this._overlay.appendChild(this._articleContainer);

    // 贴纸层
    this._stickerLayer = document.createElement('div');
    this._stickerLayer.id = 'sticker-editor-layer';
    this._stickerLayer.style.cssText = [
      'position:absolute', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'pointer-events:none', 'z-index:10',
    ].join(';');
    this._articleContainer.appendChild(this._stickerLayer);
  },

  // =========================================================================
  //  文章渲染 — 完全复用主页面 UIDetail.renderContent 逻辑
  // =========================================================================

  _renderArticle(article, cursorY) {
    // 标题
    var titleEl = document.createElement('h1');
    titleEl.style.cssText = [
      'color:var(--color-text-heading, #e8c88a)',
      'font-size:28px', 'margin:0 0 8px', 'padding-bottom:16px',
      'border-bottom:1px solid var(--color-border, #5a3e2b)',
    ].join(';');
    titleEl.textContent = article.title || '未命名文章';
    this._articleContainer.appendChild(titleEl);

    // 内容 — 与 UIDetail.renderContent 完全一致的处理
    var contentEl = document.createElement('div');
    contentEl.className = 'detail-body';
    contentEl.innerHTML = this._renderContent(article.content || '');
    this._articleContainer.appendChild(contentEl);

    // 光标高亮
    if (cursorY != null) {
      this._showCursorHighlight(cursorY);
    }
  },

  /**
   * 委托给公共 Markdown 工具（避免两个编辑器重复实现）。
   */
  _renderContent(text) {
    return MarkdownUtils.toHTML(text);
  },

  // =========================================================================
  //  光标高亮 — 在主页面文章容器 Y 位置显示脉冲标识
  // =========================================================================

  _showCursorHighlight(cursorY) {
    var highlight = document.createElement('div');
    highlight.style.cssText = [
      'position:absolute', 'left:50%', 'top:' + cursorY + 'px',
      'transform:translate(-50%, -50%)',
      'width:60px', 'height:60px', 'border-radius:50%',
      'border:3px solid var(--color-accent, #c47a44)',
      'box-shadow:0 0 30px var(--color-accent, #c47a44)',
      'z-index:5', 'pointer-events:none',
      'animation:sticker-cursor-pulse 0.8s ease-out 3',
    ].join(';');
    this._articleContainer.appendChild(highlight);

    setTimeout(function () {
      highlight.style.transition = 'opacity 0.5s';
      highlight.style.opacity = '0';
      setTimeout(function () {
        if (highlight.parentNode) highlight.parentNode.removeChild(highlight);
      }, 500);
    }, 2000);
  },

  // =========================================================================
  //  已有贴纸渲染
  // =========================================================================

  _renderExistingStickers() {
    if (!this._stickerData || !this._stickerData.length) return;

    var self = this;

    this._stickerData.forEach(function (data, index) {
      var deco = DecoShelf.get(data.decoId);
      if (!deco) return;

      var el = document.createElement('div');
      el.className = 'article-sticker-editing';
      el.id = 'sticker-el-' + data.decoId;
      el.dataset.decoId = data.decoId;
      el.dataset.index = index;

      var imgSrc = deco.dataUrl || deco.url || '';
      var w = data.width || StickerShape.DEFAULT_SIZE;
      var h = data.height || StickerShape.DEFAULT_SIZE;

      el.style.cssText = [
        'position:absolute',
        'left:' + (data.x || StickerShape.DEFAULT_X) + 'px',
        'top:' + (data.y || StickerShape.DEFAULT_Y) + 'px',
        'width:' + w + 'px',
        'height:' + h + 'px',
        'background-image:url(' + imgSrc + ')',
        'background-size:contain',
        'background-repeat:no-repeat',
        'background-position:center',
        'pointer-events:auto', 'z-index:10', 'cursor:grab',
        'border:2px solid transparent', 'border-radius:4px',
      ].join(';');

      // hover 边框高亮
      el.addEventListener('mouseenter', function () {
        if (el.style.cursor !== 'grabbing') {
        // 禁止拖拽时选中文本
        document.body.style.userSelect = 'none';

          el.style.borderColor = 'var(--color-accent, #c47a44)';
        }
      });
      el.addEventListener('mouseleave', function () {
        el.style.borderColor = 'transparent';
      });

      self._bindStickerDrag(el);
      el.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self._showContextMenu(e.clientX, e.clientY, data, el);
      });

      self._stickerLayer.appendChild(el);
    });
  },

  // =========================================================================
  //  贴纸拖拽 — 在文章容器内拖拽移动，边界钳制
  // =========================================================================

  _bindStickerDrag(el) {
    var self = this;
    var container = this._articleContainer;

    var onDown = function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      var startX = e.clientX;
      var startY = e.clientY;
      var startLeft = parseFloat(el.style.left) || 0;
      var startTop = parseFloat(el.style.top) || 0;
      el.style.cursor = 'grabbing';
      el.style.zIndex = '20';
        // 禁止拖拽时选中文本
        document.body.style.userSelect = 'none';

      el.style.borderColor = 'var(--color-accent, #c47a44)';

      var onMove = function (ev) {
        ev.preventDefault();
        var dx = ev.clientX - startX;
        var dy = ev.clientY - startY;
        var newLeft = startLeft + dx;
        var newTop = startTop + dy;

        if (container) {
          var cr = container.getBoundingClientRect();
          var ew = el.offsetWidth || 100;
          var eh = el.offsetHeight || 100;
          newLeft = Math.max(0, Math.min(newLeft, cr.width - ew));
          newTop = Math.max(0, Math.min(newTop, cr.height - eh));
        }

        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
      };

      var onUp = function () {
        el.style.cursor = 'grab';
        el.style.zIndex = '10';
        el.style.borderColor = 'transparent';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.userSelect = '';

      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    el._stickerDragDown = onDown;
    el.addEventListener('mousedown', onDown);
  },

  // =========================================================================
  //  右键菜单
  // =========================================================================

  _showContextMenu(x, y, stickerData, stickerEl) {
    this._removeContextMenu();

    var self = this;
    var menu = document.createElement('div');
    menu.id = 'sticker-context-menu';
    menu.style.cssText = [
      'position:fixed', 'left:' + x + 'px', 'top:' + y + 'px',
      'z-index:10002',
      'background:var(--color-bg-tertiary, #2a231c)',
      'border:1px solid var(--color-border-highlight, #c47a44)',
      'border-radius:4px', 'padding:4px 0', 'min-width:160px',
      'box-shadow:4px 4px 0 rgba(0,0,0,0.35)',
      'font-family:Courier New,monospace', 'font-size:13px',
    ].join(';');

    var items = [
      { label: UI.stickerEditor.ctxToggleAlign || '🔄 切换浮动方向',
        action: function () {
          stickerData.align = stickerData.align === 'right' ? 'left' : 'right';
          self._removeContextMenu();
        }},
      { type: 'sep' },
      { label: UI.stickerEditor.ctxRemove || '🗑️ 删除贴纸',
        action: function () {
          // 1. 移除 DOM 上的事件监听器
          if (stickerEl._stickerDragDown) {
            stickerEl.removeEventListener('mousedown', stickerEl._stickerDragDown);
            delete stickerEl._stickerDragDown;
          }
          stickerEl.onmouseenter = null;
          stickerEl.onmouseleave = null;
          stickerEl.oncontextmenu = null;
          // 2. 从数据中移除
          self._stickerData = self._stickerData.filter(function (s) {
            return s.decoId !== stickerData.decoId;
          });
          // 3. 从 DOM 中完全移除
          if (stickerEl.parentNode) stickerEl.parentNode.removeChild(stickerEl);
          // 4. 清理右键菜单 + 刷新控制台
          self._removeContextMenu();
          self._refreshConsoleGallery();
        }},
    ];

    items.forEach(function (item) {
      if (item.type === 'sep') {
        var sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:var(--color-border);margin:4px 0;';
        menu.appendChild(sep);
      } else {
        var btn = document.createElement('button');
        btn.textContent = item.label;
        btn.style.cssText = [
          'display:block', 'width:100%', 'text-align:left',
          'padding:8px 16px', 'background:none', 'border:none',
          'color:var(--color-text-accent)', 'cursor:pointer',
          'font-family:Courier New,monospace', 'font-size:13px',
        ].join(';');
        btn.addEventListener('mouseenter', function () {
          btn.style.background = 'var(--color-hover)';
        });
        btn.addEventListener('mouseleave', function () {
          btn.style.background = 'none';
        });
        btn.addEventListener('click', function (e) { e.stopPropagation(); item.action(); });
        menu.appendChild(btn);
      }
    });

    document.body.appendChild(menu);

    // 点击任意位置关闭
    setTimeout(function () {
      document.addEventListener('click', function closeMenu() {
        self._removeContextMenu();
        document.removeEventListener('click', closeMenu);
      }, { once: true });
    }, 0);
  },

  _removeContextMenu() {
    var m = document.getElementById('sticker-context-menu');
    if (m) m.remove();
  },

  // =========================================================================
  //  悬浮工具栏 — 完全复用 DecoEdit .deco-edit-toolbar CSS
  // =========================================================================

  _createToolbar() {
    var self = this;
    var toolbar = document.createElement('div');
    toolbar.className = 'deco-edit-toolbar'; // 复用主页面 CSS
    toolbar.id = 'sticker-edit-toolbar';
    toolbar.innerHTML = [
      '<button id="stickerEditCancel" class="toolbar-btn danger">',
        UI.stickerEditor.cancelBtn || '❌ 取消',
      '</button>',
      '<span>' + (UI.stickerEditor.toolbarTitle || '贴纸编辑') + '</span>',
      '<button id="stickerEditConfirm" class="toolbar-btn primary">',
        UI.stickerEditor.confirmBtn || '✅ 确认',
      '</button>',
    ].join('');
    document.body.appendChild(toolbar);
    this._toolbar = toolbar;

    document.getElementById('stickerEditCancel').addEventListener('click', function (e) {
      e.stopPropagation();
      self.close(false);
      Utils.showToast(UI.stickerEditor.cancelledToast || '已放弃贴纸更改', false);
    });
    document.getElementById('stickerEditConfirm').addEventListener('click', function (e) {
      e.stopPropagation();
      self.close(true);
      Utils.showToast(UI.stickerEditor.savedToast || '贴纸位置已保存', false);
    });
  },

  // =========================================================================
  //  右下角控制台 — 完全复用管理员控制台 .admin-panel CSS + 拖拽
  // =========================================================================

  _createConsole() {
    var self = this;

    // 面板容器 — 复用 .admin-panel CSS
    var panel = document.createElement('div');
    panel.className = 'admin-panel open'; // 复用主页面 CSS！
    panel.id = 'sticker-console-panel';
    panel.style.cssText = 'width:280px;z-index:10000;display:block;';

    var savedPos = this._loadConsolePos();
    panel.style.right = (savedPos.right || 20) + 'px';
    panel.style.bottom = (savedPos.bottom || 80) + 'px';

    // 标题栏 — 复用 .panel-header CSS
    var header = document.createElement('div');
    header.className = 'panel-header';
    header.style.cursor = 'grab';
    header.innerHTML = '<h4>' + (UI.stickerEditor.consoleTitle || '📚 贴纸库') + '</h4>' +
      '<span class="toggle-icon" id="stickerConsoleToggle">▶</span>';

    // 内容区 — 复用 .panel-content CSS
    var content = document.createElement('div');
    content.className = 'panel-content';
    content.id = 'sticker-console-content';
    content.style.maxHeight = '320px';
    content.style.overflowY = 'auto';

    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);
    this._consoleEl = panel;

    // 拖拽 — 与 AdminDrag 逻辑一致
    this._bindPanelDrag(panel, header);

    // 折叠/展开
    var collapsed = false;
    document.getElementById('stickerConsoleToggle').addEventListener('click', function (e) {
      e.stopPropagation();
      collapsed = !collapsed;
      if (collapsed) {
        panel.classList.add('collapsed');
        header.querySelector('.toggle-icon').textContent = '◀';
      } else {
        panel.classList.remove('collapsed');
        header.querySelector('.toggle-icon').textContent = '▶';
      }
    });

    // 填充贴纸库
    this._refreshConsoleGallery();
  },

  /**
   * 控制台拖拽 — 与 AdminDrag 逻辑一致
   */
  _bindPanelDrag(panel, header) {
    var self = this;

    header.addEventListener('mousedown', function (e) {
      if (e.target.closest('.toggle-icon')) return;
      e.preventDefault();

      var rect = panel.getBoundingClientRect();
      var offsetX = e.clientX - rect.left;
      var offsetY = e.clientY - rect.top;
      panel.style.transition = 'none';

      var onMove = function (ev) {
        var newRight = window.innerWidth - (ev.clientX - offsetX + rect.width);
        var newBottom = window.innerHeight - (ev.clientY - offsetY + rect.height);
        newRight = Math.max(0, Math.min(newRight, window.innerWidth - 50));
        newBottom = Math.max(0, Math.min(newBottom, window.innerHeight - 50));
        panel.style.right = newRight + 'px';
        panel.style.bottom = newBottom + 'px';
        panel.style.left = 'auto';
        panel.style.top = 'auto';
      };

      var onUp = function () {
        panel.style.transition = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.userSelect = '';

        self._saveConsolePos(
          parseFloat(panel.style.right) || 20,
          parseFloat(panel.style.bottom) || 80
        );
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  },

  _saveConsolePos(right, bottom) {
    try {
      localStorage.setItem('sticker_console_pos', JSON.stringify({ right: right, bottom: bottom }));
    } catch (e) { /* ignore */ }
  },

  _loadConsolePos() {
    try {
      var s = localStorage.getItem('sticker_console_pos');
      return s ? JSON.parse(s) : { right: 20, bottom: 80 };
    } catch (e) { return { right: 20, bottom: 80 }; }
  },

  /**
   * 清除贴纸层中所有贴纸元素的显式事件监听器（innerHTML 清空前调用）。
   */
  _unbindStickerElements: function () {
    if (!this._stickerLayer) return;
    var els = this._stickerLayer.querySelectorAll('.article-sticker-editing');
    els.forEach(function (el) {
      if (el._stickerDragDown) {
        el.removeEventListener('mousedown', el._stickerDragDown);
        delete el._stickerDragDown;
      }
      el.onmouseenter = null;
      el.onmouseleave = null;
      el.oncontextmenu = null;
    });
  },

  /**
   * 刷新贴纸库列表 — 缩略图 + 名称 + 已放置标记
   */
  _refreshConsoleGallery() {
    var content = document.getElementById('sticker-console-content');
    if (!content) return;

    var allDecos = DecoShelf.getAll() || [];
    var placedIds = new Set(this._stickerData.map(function (s) { return s.decoId; }));
    var self = this;

    content.innerHTML = '';

    if (!allDecos.length) {
      content.innerHTML = '<div style="padding:16px;text-align:center;color:var(--color-text-muted);font-size:12px;">' +
        (UI.stickerEditor.emptyLibrary || '贴纸库为空，请先在管理面板上传贴纸') + '</div>';
      return;
    }

    allDecos.forEach(function (deco) {
      var isPlaced = placedIds.has(deco.id);

      var item = document.createElement('div');
      item.style.cssText = [
        'display:flex', 'align-items:center', 'gap:10px',
        'padding:8px 10px', 'margin-bottom:4px',
        'border-radius:4px', 'cursor:' + (isPlaced ? 'default' : 'pointer'),
        'border:1px solid ' + (isPlaced ? 'var(--color-accent)' : 'transparent'),
        'background:' + (isPlaced ? 'var(--color-active, rgba(196,122,68,0.15))' : 'none'),
        'opacity:' + (isPlaced ? '0.7' : '1'),
      ].join(';');

      // 缩略图
      var thumb = document.createElement('div');
      thumb.style.cssText = [
        'width:40px', 'height:40px', 'border-radius:4px', 'flex-shrink:0',
        'background-image:url(' + (deco.dataUrl || deco.url || '') + ')',
        'background-size:contain', 'background-repeat:no-repeat',
        'background-position:center',
        'background-color:var(--color-bg-primary)',
      ].join(';');
      item.appendChild(thumb);

      // 名称 + 状态
      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      var name = deco.name || '未命名';
      if (name.length > 16) name = name.slice(0, 14) + '..';
      info.innerHTML = '<div style="color:var(--color-text-accent);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
        name + '</div>' +
        (isPlaced ? '<div style="color:var(--color-accent);font-size:11px;">✅ ' +
          (UI.stickerEditor.placedLabel || '已放置') + '</div>' : '');
      item.appendChild(info);

      // 点击添加
      if (!isPlaced) {
        item.addEventListener('click', function () {
          self._addSticker(deco);
        });
        item.addEventListener('mouseenter', function () {
          item.style.background = 'var(--color-hover, rgba(90,62,43,0.4))';
        });
        item.addEventListener('mouseleave', function () {
          item.style.background = 'none';
        });
      }

      content.appendChild(item);
    });
  },

  /**
   * 从贴纸库添加一张贴纸到文章
   */
  _addSticker(deco) {
    var cr = this._articleContainer.getBoundingClientRect();
    var w = StickerShape.DEFAULT_SIZE;
    var h = StickerShape.DEFAULT_SIZE;

    var suggested = StickerShape.suggestPosition(
      this._stickerData, cr.width,
      80 + this._stickerData.length * 30
    );

    var data = {
      decoId: deco.id,
      x: suggested.x,
      y: suggested.y,
      width: w,
      height: h,
      align: suggested.align,
      margin: StickerShape.DEFAULT_MARGIN,
      shape: 'circle',
      vertices: 16,
    };

    this._stickerData.push(data);

    // 渲染贴纸元素
    var el = document.createElement('div');
    el.className = 'article-sticker-editing';
    el.id = 'sticker-el-' + deco.id;
    el.dataset.decoId = deco.id;
    el.dataset.index = this._stickerData.length - 1;

    var imgSrc = deco.dataUrl || deco.url || '';
    el.style.cssText = [
      'position:absolute',
      'left:' + data.x + 'px',
      'top:' + data.y + 'px',
      'width:' + w + 'px',
      'height:' + h + 'px',
      'background-image:url(' + imgSrc + ')',
      'background-size:contain',
      'background-repeat:no-repeat',
      'background-position:center',
      'pointer-events:auto', 'z-index:10', 'cursor:grab',
      'border:2px solid transparent', 'border-radius:4px',
      'animation:sticker-appear 0.3s ease-out',
    ].join(';');

    el.addEventListener('mouseenter', function () {
      if (el.style.cursor !== 'grabbing') {
        // 禁止拖拽时选中文本
        document.body.style.userSelect = 'none';

        el.style.borderColor = 'var(--color-accent, #c47a44)';
      }
    });
    el.addEventListener('mouseleave', function () {
      el.style.borderColor = 'transparent';
    });

    this._bindStickerDrag(el);

    var self = this;
    el.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      self._showContextMenu(e.clientX, e.clientY, data, el);
    });

    this._stickerLayer.appendChild(el);

    // 刷新控制台（更新"已放置"标记）
    this._refreshConsoleGallery();
  },

  // =========================================================================
  //  键盘事件
  // =========================================================================

  _bindKeys() {
    var self = this;

    this._escHandler = function (e) {
      if (e.key === 'Escape') {
        self._removeContextMenu();
        self._removeContextMenu();
        self._escPressCount++;
        if (self._escPressCount >= 2) {
          clearTimeout(self._escPressTimer);
          self._escPressCount = 0;
          self.close(false);
          Utils.showToast(UI.stickerEditor.cancelledToast || '已放弃贴纸更改', false);
        } else {
          Utils.showToast(UI.stickerEditor.escHint || '再按一次 ESC 放弃更改', false);
          self._escPressTimer = setTimeout(function () {
            self._escPressCount = 0;
          }, 1500);
        }
      }

      // Ctrl+Enter 确认
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        self.close(true);
        Utils.showToast(UI.stickerEditor.savedToast || '贴纸位置已保存', false);
      }
    };
    document.addEventListener('keydown', this._escHandler);
  },

  // =========================================================================
  //  保存与清理
  // =========================================================================

  _saveStickersToArticle() {
    if (!this._article) return;

    // 从 DOM 收集当前贴纸的最终位置
    this._stickerData = this._collectStickerData();

    this._article.stickers = JSON.parse(JSON.stringify(this._stickerData));

    // 将贴纸标记写入文章内容
    var content = this._article.content || '';
    content = StickerRenderer.stripMarkers(content);
    this._stickerData.forEach(function (s) {
      content += '\n' + StickerRenderer.createMarker(s.decoId, s);
    });
    this._article.content = content.trim();

    EventBus.emit(EVENTS.STICKER_EDITOR_SAVED, {
      articleId: this._article.id,
      stickers: this._stickerData,
    });
  },

  _collectStickerData() {
    if (!this._stickerLayer) return [];
    var result = [];
    // 建立 decoId → _stickerData 索引（用于恢复 align 等非 DOM 属性）
    var dataMap = {};
    if (this._stickerData) {
      this._stickerData.forEach(function (d) { if (d && d.decoId) dataMap[d.decoId] = d; });
    }
    var els = this._stickerLayer.querySelectorAll('.article-sticker-editing');
    els.forEach(function (el) {
      var decoId = el.dataset.decoId;
      var orig = dataMap[decoId] || {};
      result.push({
        decoId: decoId,
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
        width: parseFloat(el.style.width) || StickerShape.DEFAULT_SIZE,
        height: parseFloat(el.style.height) || StickerShape.DEFAULT_SIZE,
        align: orig.align || 'left',
        margin: orig.margin || StickerShape.DEFAULT_MARGIN,
        shape: orig.shape || 'circle',
        vertices: orig.vertices || 16,
      });
    });
    return result;
  },

  _cleanup() {
    // 定时器
    if (this._escPressTimer) { clearTimeout(this._escPressTimer); this._escPressTimer = null; }
    this._escPressCount = 0;

    // 键盘事件
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }

    // 工具栏
    if (this._toolbar) { this._toolbar.remove(); this._toolbar = null; }

    // 控制台
    if (this._consoleEl) { this._consoleEl.remove(); this._consoleEl = null; }

    // 右键菜单
    this._removeContextMenu();

    // 贴纸元素监听器（在 DOM 移除前显式解绑）
    this._unbindStickerElements();

    // 覆盖层（含文章容器 + 贴纸层）
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    this._articleContainer = null;
    this._stickerLayer = null;

    // 恢复滚动
    document.body.style.overflow = '';

    // 重置状态
    this._article = null;
    this._stickerData = [];
    this._snapshot = null;
  },
};

export default StickerEditorMode;
