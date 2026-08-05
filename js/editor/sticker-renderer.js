/**
 * 文章贴纸渲染器 — 在文章阅读/编辑视图中渲染贴纸。
 *
 * 职责：
 *   1. 将文章正文中的贴纸占位标记替换为实际的贴纸 DOM 元素
 *   2. 在编辑模式的覆盖层中渲染贴纸
 *   3. 清理和管理贴纸 DOM
 *
 * 贴纸在文章中的占位标记格式：<!-- sticker:{id} x={x} y={y} w={width} h={height} align={align} -->
 * 渲染后替换为 <div class="article-sticker" data-deco-id="decoId"> ... </div>
 *
 * 依赖：StickerShape（形状生成）、DecoShelf（贴纸数据）、DecoEdit（交互）
 */

import { StickerShape } from './sticker-shape.js';
import { DecoShelf } from '../services/deco.js';

export const StickerRenderer = {

  /**
   * 贴纸占位标记正则（统一数据源，所有解析/清除复用此正则）。
   * 匹配任意 <!-- sticker:{content} --> 注释块，不依赖字段顺序。
   * 捕获组 1 = 注释内容（不含 <!-- sticker: 和 -->）。
   */
  _MARKER_REGEX: /<!--\s*sticker:(.*?)-->/g,

  /**
   * 从标记注释内容中解析字段（字段顺序无关，兼容新旧格式）。
   * @param {string} raw - 注释内部文本，如 "deco_abc align=left w=120 h=120"
   * @returns {object} { decoId, x, y, w, h, align }
   */
  _parseMarkerContent: function (raw) {
    var parts = raw.trim().split(/\s+/);
    var result = {};
    if (parts.length > 0) result.decoId = parts[0];
    for (var i = 1; i < parts.length; i++) {
      var kv = parts[i].split('=');
      if (kv.length === 2) result[kv[0]] = kv[1];
    }
    return result;
  },

  /** 已创建的贴纸元素集合（用于清理） */
  _elements: [],

  /**
   * 解析文章内容中的贴纸标记，返回 { cleanContent, stickers }。
   * 贴纸标记会被移除（由渲染阶段替换为 DOM 元素）。
   *
   * @param {string} content - 文章 Markdown/HTML 内容
   * @returns {{ cleanContent: string, stickers: Array<{decoId:string, align:string, w:number, h:number}> }}
   */
  parseMarkers(content) {
    var stickers = [];
    var regex = this._MARKER_REGEX;
    regex.lastIndex = 0;

    var match;
    while ((match = regex.exec(content)) !== null) {
      var fields = this._parseMarkerContent(match[1]);
      stickers.push({
        decoId: fields.decoId,
        x: fields.x ? parseInt(fields.x) : StickerShape.DEFAULT_X,
        y: fields.y ? parseInt(fields.y) : StickerShape.DEFAULT_Y + stickers.length * StickerShape.DEFAULT_GAP,
        w: parseInt(fields.w) || StickerShape.DEFAULT_SIZE,
        h: parseInt(fields.h) || StickerShape.DEFAULT_SIZE,
        align: fields.align || 'left',
        index: match.index,
      });
    }

    // 移除所有标记
    regex.lastIndex = 0;
    var cleanContent = content.replace(regex, '');

    return { cleanContent: cleanContent, stickers: stickers };
  },

  /**
   * 生成贴纸占位标记字符串（插入文章内容中）
   *
   * @param {string} decoId - 贴纸 ID
   * @param {object} opts - { align, w, h }
   * @returns {string} 如 "<!-- sticker:deco_abc x=50 y=50 w=120 h=120 align=left -->"
   */
  createMarker(decoId, opts) {
    opts = opts || {};
    var x = opts.x !== undefined ? opts.x : StickerShape.DEFAULT_X;
    var y = opts.y !== undefined ? opts.y : StickerShape.DEFAULT_Y;
    var align = opts.align || 'left';
    var w = opts.w || opts.width || StickerShape.DEFAULT_SIZE;
    var h = opts.h || opts.height || StickerShape.DEFAULT_SIZE;
    return '<!-- sticker:' + decoId + ' x=' + x + ' y=' + y + ' w=' + w + ' h=' + h + ' align=' + align + ' -->';
  },

  /**
   * 在文章容器中根据贴纸数据渲染贴纸。贴纸以浮动元素插入到文章内容中，
   * 使用 shape-outside 实现文字绕排。
   *
   * @param {HTMLElement} container - 文章内容容器
   * @param {Array<object>} stickers - 贴纸数据列表 [{ decoId, align, w, h }]
   */
  renderInArticle(container, stickers) {
    if (!container || !stickers || !stickers.length) return;
    this.clearElements();

    var self = this;

    stickers.forEach(function (sticker) {
      var deco = DecoShelf.get(sticker.decoId);
      if (!deco) {
        console.warn('[StickerRenderer] 贴纸不存在，跳过:', sticker.decoId);
        return;
      }

      var el = self._createStickerElement(sticker, deco);

      // 插入到文章容器开头（CSS float 自动处理位置）
      if (container.firstChild) {
        container.insertBefore(el, container.firstChild);
      } else {
        container.appendChild(el);
      }

      self._elements.push(el);
    });
  },

  /**
   * 为贴纸编辑模式渲染贴纸（绝对定位，覆盖在文章内容之上）
   *
   * @param {HTMLElement} parentContainer - 覆盖层的文章容器
   * @param {Array<object>} stickerData - 完整贴纸数据（含 x, y）
   */
  renderForEditor(parentContainer, stickerData) {
    if (!parentContainer || !stickerData || !stickerData.length) return;
    this.clearElements();

    var self = this;

    stickerData.forEach(function (data) {
      var deco = DecoShelf.get(data.decoId);
      if (!deco) return;

      var el = self._createEditorStickerElement(data, deco);
      parentContainer.appendChild(el);
      self._elements.push(el);
    });
  },

  /**
   * 创建单个贴纸浮动元素（用于文章阅读视图）
   */
  _createStickerElement(sticker, deco) {
    var el = document.createElement('div');
    el.className = 'article-sticker';
    el.dataset.decoId = sticker.decoId;

    var imgSrc = deco.dataUrl || deco.url || '';
    el.style.cssText = StickerShape.buildInlineStyle(sticker, imgSrc);

    el.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });

    return el;
  },

  /**
   * 创建编辑器模式下的贴纸元素（绝对定位，可拖拽）
   */
  _createEditorStickerElement(data, deco) {
    var el = document.createElement('div');
    el.className = 'article-sticker article-sticker-editing';
    el.id = 'article-sticker-' + data.decoId;
    el.dataset.decoId = data.decoId;

    var imgSrc = deco.dataUrl || deco.url || '';
    var w = data.width || data.w || StickerShape.DEFAULT_SIZE;
    var h = data.height || data.h || StickerShape.DEFAULT_SIZE;

    el.style.cssText = [
      'position:absolute',
      'left:' + (data.x || 0) + 'px',
      'top:' + (data.y || 0) + 'px',
      'width:' + w + 'px',
      'height:' + h + 'px',
      'background-image:url(' + imgSrc + ')',
      'background-size:contain',
      'background-repeat:no-repeat',
      'background-position:center',
      'pointer-events:auto',
      'z-index:10',
      'cursor:grab',
    ].join(';');

    return el;
  },

  /**
   * 更新贴纸的浮动方向
   * @param {HTMLElement} el - 贴纸 DOM 元素
   * @param {string} align - 'left' | 'right'
   */
  toggleAlign(el, align) {
    if (!el) return;
    el.style.float = align;
  },

  /**
   * 清除所有已渲染的贴纸元素
   */
  clearElements() {
    this._elements.forEach(function (el) {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    this._elements = [];
  },

  /**
   * 从文章容器中获取当前贴纸状态（用于保存）
   * @param {HTMLElement} container
   * @returns {Array<object>}
   */
  collectStickerData(container) {
    if (!container) return [];
    var result = [];
    var els = container.querySelectorAll('.article-sticker-editing');
    els.forEach(function (el) {
      result.push({
        decoId: el.dataset.decoId,
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
        width: parseFloat(el.style.width) || StickerShape.DEFAULT_SIZE,
        height: parseFloat(el.style.height) || StickerShape.DEFAULT_SIZE,
        align: el.dataset.align || 'left',
        margin: parseInt(el.dataset.margin) || StickerShape.DEFAULT_MARGIN,
        shape: 'circle',
        vertices: 16,
      });
    });
    return result;
  },
};

export default StickerRenderer;
