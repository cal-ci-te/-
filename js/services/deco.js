// WebP 压缩（quality 0.6）：前端上传时即压缩为 WebP，减少存储和传输体积约 40-60%。
// 移动端禁用位置编辑（触摸拖拽冲突），仅桌面端可调整贴图位置。
import { Utils } from '../utils.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { DecoRepository } from './deco-repository.js';
import { initLongPress } from '../utils/touch-context.js';
import { UI } from '../utils/ui-strings.js';

export const DecoShelf = {
  _library: [],
  _selectedId: null,
  _editingId: null,
  _clipboardId: null,

  /**
   * 检测是否为移动端（仅用于功能禁用，不用于渲染控制）
   */
  _isMobile() {
    return window.innerWidth <= 768 || 
           ('ontouchstart' in window) || 
           navigator.maxTouchPoints > 0;
  },

  /**
   * 标准化贴图对象：确保有 dataUrl 字段
   */
  _normalizeItem(item) {
    if (!item) return item;
    if (!item.dataUrl && item.url) {
      item.dataUrl = item.url;
    }
    return item;
  },

  _normalizeItems(items) {
    if (!items) return items;
    if (Array.isArray(items)) {
      return items.map(item => this._normalizeItem(item));
    }
    return this._normalizeItem(items);
  },

  /**
   * 加载贴图库：从仓库加载
   */
  async loadLibrary() {
    const items = await DecoRepository.load();
    this._library = this._normalizeItems(items);
    this._renderAllDecos();

    if (!this._resizeHandler) {
      let resizeTimer;
      this._resizeHandler = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => this._handleResize(), 200);
      };
      window.addEventListener('resize', this._resizeHandler);
    }
    return this._library;
  },

  // 窗口 resize 时重新钳制所有已放置贴纸的位置，变化时自动保存。
  _handleResize() {
    this._library.forEach(item => {
      if (!item.position) return;
      const el = document.getElementById('deco-' + item.id);
      if (!el) return;
      const oldPos = item.position;
      const clamped = this.clampPositionToViewport(oldPos, el);
      if (clamped.top !== oldPos.top || clamped.left !== oldPos.left) {
        item.position = clamped;
        el.style.top = clamped.top;
        el.style.left = clamped.left;
        DecoRepository.save(item).then(() => {
          this._library = this._normalizeItems(DecoRepository.getAll());
        });
      }
    });
  },

  /**
   * 同步仓库数据到本地（重新加载）
   */
  async refreshFromRepo() {
    const items = await DecoRepository.load(true);
    this._library = this._normalizeItems(items);
    this._renderAllDecos();
    EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
  },

  /**
   * 获取所有贴图（同步）
   */
  getAll() {
    const items = DecoRepository.getAll();
    return this._normalizeItems(items);
  },

  get(id) {
    const item = DecoRepository.get(id);
    return this._normalizeItem(item);
  },

  _generateId() {
    return 'deco_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  },

  // 贴纸位置钳制：左右在页面范围内，上方不超标签栏，下方允许较大值。
  clampPositionToViewport(position, element) {
    if (!position || !element) return position;
    const w = element.offsetWidth || 0;
    const h = element.offsetHeight || 0;
    if (w === 0 && h === 0) return position;
    const MARGIN_H = 10;
    const TOP_MIN = 36;       // 标签栏占位高度
    const BOTTOM_MAX = 50000; // 下方允许的较大值
    const vw = window.innerWidth;

    let top = null, left = null;
    if (position.top !== undefined && position.top !== null) {
      top = parseFloat(position.top);
    }
    if (position.left !== undefined && position.left !== null) {
      left = parseFloat(position.left);
    }

    // right/bottom → left/top 统一
    if ((top === null || isNaN(top)) && position.bottom !== undefined && position.bottom !== null) {
      top = window.innerHeight - parseFloat(position.bottom) - h;
    }
    if ((left === null || isNaN(left)) && position.right !== undefined && position.right !== null) {
      left = vw - parseFloat(position.right) - w;
    }

    if (top === null || isNaN(top)) top = TOP_MIN;
    if (left === null || isNaN(left)) left = MARGIN_H;

    top = Math.max(TOP_MIN, Math.min(top, BOTTOM_MAX));
    left = Math.max(MARGIN_H, Math.min(left, vw - w - MARGIN_H));

    const clamped = { top: top + 'px', left: left + 'px' };
    if (position.width) clamped.width = position.width;
    if (position.height) clamped.height = position.height;
    return clamped;
  },

  /**
   * 上传贴图（压缩并保存）
   */
  async upload(file, name) {
    const validTypes = ['image/png', 'image/webp', 'image/jpeg'];
    if (!validTypes.includes(file.type)) {
      Utils.showToast(UI.deco.formatNotSupported, true);
      throw new Error('格式不支持');
    }

    const compressedDataUrl = await this._compressImageToDataUrl(file, 0.6);
    const id = this._generateId();
    const item = {
      id: id,
      name: name || file.name.replace(/\.[^.]+$/, ''),
      dataUrl: compressedDataUrl,
      type: 'image/webp',
      position: null,
      style: 'fixed',
      file: file,
    };

    const savedItem = await DecoRepository.save(item);
    const allItems = DecoRepository.getAll();
    this._library = this._normalizeItems(allItems);
    this._renderAllDecos();
    EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
    return savedItem;
  },

  _compressImageToDataUrl(file, quality = 0.6) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (blob) => {
              const reader2 = new FileReader();
              reader2.onload = (e2) => resolve(e2.target.result);
              reader2.onerror = reject;
              reader2.readAsDataURL(blob);
            },
            'image/webp',
            quality
          );
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  duplicate(id) {
    const original = this.get(id);
    if (!original) return null;
    const baseName = original.name.replace(/-副本\d*$/, '');
    const copies = this._library.filter(
      (item) => item.name === baseName || item.name.startsWith(baseName + '-副本')
    );
    const copyCount = copies.length;
    const newName = baseName + (copyCount > 0 ? '-副本' + copyCount : '');
    const newItem = {
      id: this._generateId(),
      name: newName,
      dataUrl: original.dataUrl || original.url,
      type: original.type,
      position: null,
      style: original.style,
    };
    DecoRepository.save(newItem).then(() => {
      this._library = this._normalizeItems(DecoRepository.getAll());
      this._renderAllDecos();
      EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
    });
    this._clipboardId = newItem.id;
    return newItem;
  },

  rename(id, newName) {
    const item = this.get(id);
    if (!item) return false;
    item.name = newName.trim() || item.name;
    DecoRepository.save(item).then(() => {
      this._library = this._normalizeItems(DecoRepository.getAll());
      EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
    });
    return true;
  },

  deleteFromLibrary(id) {
    const item = this.get(id);
    if (!item) return false;
    const el = document.getElementById('deco-' + id);
    if (el) {
      if (el._longPressCleanup) {
        el._longPressCleanup();
        delete el._longPressCleanup;
      }
      el.remove();
    }
    DecoRepository.delete(id).then(() => {
      this._library = this._normalizeItems(DecoRepository.getAll());
      EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
    });
    return true;
  },

  removeFromPage(id) {
    const item = this.get(id);
    if (!item) return false;
    const el = document.getElementById('deco-' + id);
    if (el) {
      if (el._longPressCleanup) {
        el._longPressCleanup();
        delete el._longPressCleanup;
      }
      el.remove();
    }
    item.position = null;
    DecoRepository.save(item).then(() => {
      this._library = this._normalizeItems(DecoRepository.getAll());
      this._renderAllDecos();
      EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
    });
    return true;
  },

  setPosition(id, pos) {
    const item = this.get(id);
    if (!item) return false;
    if (pos) {
      const el = document.getElementById('deco-' + id);
      const clamped = this.clampPositionToViewport(pos, el);
      if (clamped.top !== pos.top || clamped.left !== pos.left) {
        console.log('[DecoShelf] 位置已钳制:', id, '原:', pos.top, pos.left, '→', clamped.top, clamped.left);
      }
      pos = clamped;
    }
    item.position = pos;
    DecoRepository.save(item).then(() => {
      this._library = this._normalizeItems(DecoRepository.getAll());
      this._renderAllDecos();
      EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
    });
    return true;
  },

  setStyle(id, newStyle) {
    const item = this.get(id);
    if (!item) return false;
    if (item.style === newStyle) {
      Utils.showToast(UI.deco.alreadyStyle(newStyle === 'fixed' ? '贴纸' : '悬浮窗'), false);
      return true;
    }
    const el = document.getElementById('deco-' + id);
    if (el && item.position) {
      const rect = el.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      const pos = { ...item.position };
      if (item.style === 'fixed' && newStyle === 'absolute') {
        pos.top = rect.top + scrollY + 'px';
        pos.left = rect.left + scrollX + 'px';
      } else if (item.style === 'absolute' && newStyle === 'fixed') {
        pos.top = rect.top - scrollY + 'px';
        pos.left = rect.left - scrollX + 'px';
      }
      item.position = pos;
    }
    item.style = newStyle;
    DecoRepository.save(item).then(() => {
      this._library = this._normalizeItems(DecoRepository.getAll());
      // 原地更新 DOM 属性，跳过 remove+create 以避免入场动画重播
      if (el && item.position) {
        el.style.position = newStyle;
        el.style.top = item.position.top || 'auto';
        el.style.left = item.position.left || 'auto';
        el.style.bottom = 'auto';
        el.style.right = 'auto';
        el.title = item.name + ' (' + newStyle + ')';
      } else if (item.position) {
        this._renderSingleDeco(id);
      }
      EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
    });
    return true;
  },

  startEditingPosition(id) {
    // 移动端禁用贴纸位置编辑
    if (this._isMobile()) {
      Utils.showToast(UI.toast.decoMobileNotSupported, true);
      return;
    }

    if (this._editingId && this._editingId !== id) {
      this.stopEditingPosition(false);
    }
    const item = this.get(id);
    if (!item) return;
    this._editingId = id;
    const origStyle = item.style || 'fixed';
    let el = document.getElementById('deco-' + id);
    if (!el) {
      const winW = window.innerWidth,
        winH = window.innerHeight;
      el = document.createElement('div');
      el.id = 'deco-' + id;
      el.style.position = 'fixed';
      el.style.top = winH / 2 - 50 + 'px';
      el.style.left = winW / 2 - 50 + 'px';
      el.style.width = '100px';
      el.style.height = '100px';
      const imgSrc = item.dataUrl || item.url;
      el.style.backgroundImage = imgSrc ? 'url(' + imgSrc + ')' : 'none';
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
      el.style.zIndex = '100';
      el.style.cursor = 'grab';
      el.style.border = '2px solid #c47a44';
      el.style.boxShadow = '0 0 20px rgba(196,122,68,0.5)';
      el.dataset.decoId = id;
      document.body.appendChild(el);
      // 记录原始样式用于保存时坐标转换（fixed 元素视口坐标 → absolute 则转文档坐标）
      el._origStyle = origStyle;
    } else {
      el._origStyle = origStyle;
      // absolute 定位的元素需临时转为 fixed 以便拖拽在视口坐标下工作
      if (origStyle === 'absolute') {
        const rect = el.getBoundingClientRect();
        el.style.top = rect.top + 'px';
        el.style.left = rect.left + 'px';
        el.style.position = 'fixed';
      } else {
        el.style.position = origStyle;
      }
      el.style.border = '2px solid #c47a44';
      el.style.boxShadow = '0 0 20px rgba(196,122,68,0.5)';
      el.style.cursor = 'grab';
      const imgSrc = item.dataUrl || item.url;
      if (imgSrc) {
        el.style.backgroundImage = 'url(' + imgSrc + ')';
      }
    }
    this._enableDragging(el);
    this._showEditingControls(id);
    EventBus.emit(EVENTS.DECO_EDITING_STARTED, { id: id });
  },

  stopEditingPosition(save = true) {
    // 移动端禁用（但保留清理逻辑以防万一）
    if (this._isMobile()) {
      // 如果有正在编辑的贴纸，清理它
      if (this._editingId) {
        const id = this._editingId;
        const el = document.getElementById('deco-' + id);
        if (el) {
          el.style.border = 'none';
          el.style.boxShadow = 'none';
          el.style.cursor = '';
          this._disableDragging(el);
        }
        const resetBtn = document.getElementById('deco-reset-btn-' + id);
        if (resetBtn) resetBtn.remove();
        const editControls = document.querySelectorAll('.deco-edit-control');
        editControls.forEach(el => el.remove());
        this._editingId = null;
        EventBus.emit(EVENTS.DECO_EDITING_STOPPED, { id: id, saved: false });
      }
      return;
    }

    if (!this._editingId) return;
    const id = this._editingId;
    const el = document.getElementById('deco-' + id);
    if (el) {
      el.style.border = 'none';
      el.style.boxShadow = 'none';
      el.style.cursor = '';
      this._disableDragging(el);
    }
    const resetBtn = document.getElementById('deco-reset-btn-' + id);
    if (resetBtn) resetBtn.remove();
    document.querySelectorAll('.deco-edit-control').forEach(el => el.remove());
    if (save && el) {
      const rect = el.getBoundingClientRect();
      const origStyle = el._origStyle || (this.get(id) && this.get(id).style) || 'fixed';
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      const pos = {
        top: (origStyle === 'absolute' ? rect.top + scrollY : rect.top) + 'px',
        left: (origStyle === 'absolute' ? rect.left + scrollX : rect.left) + 'px',
        width: el.offsetWidth + 'px',
        height: el.offsetHeight + 'px',
      };
      delete el._origStyle;
      this.setPosition(id, pos);
      EventBus.emit(EVENTS.DECO_EDITING_STOPPED, { id: id, saved: true });
    } else {
      if (el) el.remove();
      this._renderSingleDeco(id);
      EventBus.emit(EVENTS.DECO_EDITING_STOPPED, { id: id, saved: false });
    }
    this._editingId = null;
  },

  confirmEditing: function () {
    // 移动端禁用
    if (this._isMobile()) {
      Utils.showToast(UI.toast.decoMobileNotSupported, true);
      return;
    }
    if (!this._editingId) {
      Utils.showToast(UI.deco.noEditing, true);
      return;
    }
    this.stopEditingPosition(true);
    Utils.showToast(UI.deco.positionConfirmed, false);
  },

  cancelEditing: function () {
    // 移动端禁用
    if (this._isMobile()) {
      Utils.showToast(UI.toast.decoMobileNotSupported, true);
      return;
    }
    if (!this._editingId) {
      Utils.showToast(UI.deco.noEditing, true);
      return;
    }
    this.stopEditingPosition(false);
    Utils.showToast(UI.deco.editCancelled, false);
  },

  /** 应用贴纸自定义尺寸（width/height 或 scaleX/scaleY transform） */
  _applyDecoSize: function (el, item) {
    const pos = item.position;
    if (!pos) {
      el.style.width = 'auto';
      el.style.height = 'auto';
      el.style.transform = '';
      return;
    }
    const hasCustomSize = (pos.width && pos.width !== 'auto') || (pos.height && pos.height !== 'auto');
    const hasScale = pos.scaleX !== undefined || pos.scaleY !== undefined;
    if (hasScale) {
      el.style.width = (pos.width || 100) + 'px';
      el.style.height = (pos.height || 100) + 'px';
      el.style.transform = 'scale(' + (pos.scaleX || 1) + ', ' + (pos.scaleY || 1) + ')';
      el.style.transformOrigin = 'top left';
      el._scaleX = pos.scaleX || 1;
      el._scaleY = pos.scaleY || 1;
    } else if (hasCustomSize) {
      el.style.width = (typeof pos.width === 'number' ? pos.width + 'px' : pos.width) || 'auto';
      el.style.height = (typeof pos.height === 'number' ? pos.height + 'px' : pos.height) || 'auto';
      el.style.transform = '';
    } else {
      el.style.width = 'auto';
      el.style.height = 'auto';
      el.style.transform = '';
    }
  },

  _renderAllDecos: function () {
    // 遍历贴纸，原地更新已有位置的元素，不需删除重建
    this._library.forEach((item) => {
      this._renderSingleDeco(item.id);
    });
    // 清理孤儿元素：库中已不存在或已无位置的贴纸 DOM
    const validIds = new Set(
      this._library
        .filter(function (item) { return item.position; })
        .map(function (item) { return 'deco-' + item.id; })
    );
    document.querySelectorAll('[id^="deco-"]').forEach(function (el) {
      if (el.id.startsWith('deco-reset-btn-') || el.id === 'deco-context-menu') return;
      if (!validIds.has(el.id)) {
        if (el._longPressCleanup) {
          el._longPressCleanup();
          delete el._longPressCleanup;
        }
        el.remove();
      }
    });
  },

  _renderSingleDeco: function (id) {
    const item = this.get(id);
    if (!item) return;
    const existing = document.getElementById('deco-' + id);

    if (!item.position) {
      // 无位置 → 仅保留在贴图库中，不渲染到页面
      if (existing) {
        if (existing._longPressCleanup) {
          existing._longPressCleanup();
          delete existing._longPressCleanup;
        }
        existing.remove();
      }
      return;
    }

    const posStyle = item.style || 'fixed';

    if (existing) {
      // 元素已存在 → 原地更新 CSS，保留事件绑定，避免入场动画重播
      existing.style.position = posStyle;
      existing.style.top = item.position.top || 'auto';
      existing.style.left = item.position.left || 'auto';
      existing.style.bottom = item.position.bottom || 'auto';
      existing.style.right = item.position.right || 'auto';
      // 支持自定义尺寸（贴纸缩放功能）
      this._applyDecoSize(existing, item);
      const imgSrc = item.dataUrl || item.url;
      if (imgSrc) {
        existing.style.backgroundImage = 'url(' + imgSrc + ')';
      }
      existing.title = item.name + ' (' + posStyle + ')';
      // 确保 pointer-events 和右键菜单事件（修复首次放置/刷新后右键无响应）
      existing.style.pointerEvents = 'auto';
      if (!existing._contextMenuBound) {
        existing.addEventListener('contextmenu', function (e) {
          e.preventDefault();
          e.stopPropagation();
          EventBus.emit(EVENTS.DECO_CONTEXT_MENU, { decoId: id, x: e.clientX, y: e.clientY });
        });
        existing._contextMenuBound = true;
      }
      return;
    }

    // 元素不存在 → 创建新元素（仅首次渲染时触发入场动画）
    const el = document.createElement('div');
    el.id = 'deco-' + id;
    el.style.position = posStyle;
    el.style.top = item.position.top || 'auto';
    el.style.left = item.position.left || 'auto';
    el.style.bottom = item.position.bottom || 'auto';
    el.style.right = item.position.right || 'auto';
    // 支持自定义尺寸（贴纸缩放功能）
    this._applyDecoSize(el, item);
    const imgSrc = item.dataUrl || item.url;
    if (imgSrc) {
      el.style.backgroundImage = 'url(' + imgSrc + ')';
    } else {
      el.style.backgroundImage = 'none';
    }
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
    el.style.zIndex = '99';
    el.style.pointerEvents = 'auto';
    el.dataset.decoId = id;
    el.title = item.name + ' (' + posStyle + ')';
    // 确保 DOM body 可用（模块脚本可能在 body 就绪前执行）
    if (document.body) {
      document.body.appendChild(el);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(el);
      });
    }

    // 右键菜单（PC）
    el.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      EventBus.emit(EVENTS.DECO_CONTEXT_MENU, { decoId: id, x: e.clientX, y: e.clientY });
    });

    // 长按支持（移动端）
    const cleanup = initLongPress(el, (touch, targetEl) => {
      const decoId = targetEl.dataset.decoId;
      EventBus.emit(EVENTS.DECO_CONTEXT_MENU, {
        decoId: decoId,
        x: touch.clientX,
        y: touch.clientY,
      });
    }, {
      getTargetData: (el) => el,
    });
    el._longPressCleanup = cleanup;
  },

  _enableDragging: function (el) {
    // 移动端禁用拖拽
    if (this._isMobile()) return;

    el.style.cursor = 'grab';
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      el.style.cursor = 'grabbing';
      const onMouseMove = (ev) => {
        ev.preventDefault();
        const MARGIN_H = 10;
        const TOP_MIN = 36;
        const BOTTOM_MAX = 50000;
        let newLeft = ev.clientX - offsetX;
        let newTop = ev.clientY - offsetY;
        const maxLeft = window.innerWidth - el.offsetWidth - MARGIN_H;
        newLeft = Math.max(MARGIN_H, Math.min(newLeft, maxLeft));
        newTop = Math.max(TOP_MIN, Math.min(newTop, BOTTOM_MAX));
        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      };
      const onMouseUp = () => {
        el.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
    el.addEventListener('mousedown', onMouseDown);
    el._dragHandler = onMouseDown;
  },

  _disableDragging: function (el) {
    if (el._dragHandler) {
      el.removeEventListener('mousedown', el._dragHandler);
      delete el._dragHandler;
    }
    el.style.cursor = '';
  },

  _showEditingControls: function (id) {
    if (this._isMobile()) return;

    const existing = document.querySelectorAll('.deco-edit-control');
    existing.forEach(el => el.remove());

    const container = document.createElement('div');
    container.className = 'deco-edit-control';
    container.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10000;';

    const btns = [
      { text: '↺ 重置位置', cls: 'reset', action: () => {
        const el = document.getElementById('deco-' + id);
        if (el) {
          const winW = window.innerWidth, winH = window.innerHeight;
          el.style.top = Math.max(10, winH / 2 - 50) + 'px';
          el.style.left = Math.max(10, winW / 2 - 50) + 'px';
          el.style.bottom = 'auto';
          el.style.right = 'auto';
        }
      }},
      { text: '✅ 确认位置', cls: 'confirm', action: () => { DecoShelf.confirmEditing(); }},
      { text: '❌ 取消编辑', cls: 'cancel', action: () => { DecoShelf.cancelEditing(); }},
    ];
    btns.forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.text;
      btn.style.cssText =
        'background:var(--color-bg-tertiary);border:1px solid var(--color-accent);color:var(--color-text-accent);padding:6px 14px;border-radius:4px;cursor:pointer;font-family:Courier New,monospace;font-size:12px;white-space:nowrap;';
      if (b.cls === 'confirm') btn.style.background = '#2a3a1a';
      btn.addEventListener('click', (e) => { e.stopPropagation(); b.action(); });
      container.appendChild(btn);
    });
    document.body.appendChild(container);
  },

  download: function (id) {
    const item = this.get(id);
    if (!item) return;
    const imgSrc = item.dataUrl || item.url;
    if (!imgSrc) {
      Utils.showToast(UI.toast.decoImageNotFound, true);
      return;
    }
    const a = document.createElement('a');
    a.href = imgSrc;
    a.download = item.name + '.webp';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  getEditingId: function () {
    return this._editingId;
  },

  loadPositions: function () {
    return this.loadLibrary();
  },
  savePositions: function () {
    console.log('[DecoShelf] savePositions 已弃用，数据由仓库自动保存');
  },
};

export const Deco = {
  enableEditing: function () {
    Utils.showToast(UI.deco.useLibraryEdit, true);
  },
  disableEditing: function () {
    DecoShelf.cancelEditing();
  },
  resetPosition: function (id) {
    DecoShelf.startEditingPosition(id);
  },
  confirmEditing: DecoShelf.confirmEditing.bind(DecoShelf),
  cancelEditing: DecoShelf.cancelEditing.bind(DecoShelf),
  setStyle: DecoShelf.setStyle.bind(DecoShelf),
  loadPositions: DecoShelf.loadLibrary.bind(DecoShelf),
  savePositions: function () {
    console.log('[Deco] savePositions 已弃用，数据由仓库自动保存');
  },
};

