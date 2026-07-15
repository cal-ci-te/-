// ========== 贴图库模块（使用 DecoRepository） ==========
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
    console.log('[DecoShelf] 加载贴图库...');
    const items = await DecoRepository.load();
    this._library = this._normalizeItems(items);
    this._renderAllDecos();
    return this._library;
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

  /**
   * 上传贴图（压缩并保存）
   */
  async upload(file, name) {
    const validTypes = ['image/png', 'image/webp', 'image/jpeg'];
    if (!validTypes.includes(file.type)) {
      Utils.showToast(UI.deco.formatNotSupported, true);
      throw new Error('格式不支持');
    }

    const compressedDataUrl = await this._compressImageToDataUrl(file,0.6);
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
    // 从仓库重新获取并标准化
    const allItems = DecoRepository.getAll();
    this._library = this._normalizeItems(allItems);
    this._renderAllDecos();
    EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
    return savedItem;
  },

// 在 deco.js 中，替换 _compressImageToDataUrl 方法
_compressImageToDataUrl(file, quality = 0.6) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // ★★★ 保持原始尺寸，不缩放 ★★★
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
                    quality  // 质量参数，默认 0.6，可调整
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
      EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
    });
    return true;
  },

  setPosition(id, pos) {
    const item = this.get(id);
    if (!item) return false;
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
      Utils.showToast(UI.deco.alreadyStyle(newStyle === 'fixed' ? '悬浮窗' : '贴纸'), false);
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
      if (item.position) {
        this._renderSingleDeco(id);
      }
      EventBus.emit(EVENTS.DECO_LIBRARY_CHANGED);
    });
    return true;
  },

  // 编辑位置相关
  startEditingPosition(id) {
    if (this._editingId && this._editingId !== id) {
      this.stopEditingPosition(false);
    }
    const item = this.get(id);
    if (!item) return;
    this._editingId = id;
    let el = document.getElementById('deco-' + id);
    if (!el) {
      const winW = window.innerWidth,
        winH = window.innerHeight;
      el = document.createElement('div');
      el.id = 'deco-' + id;
      el.style.position = item.style || 'fixed';
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
    } else {
      el.style.border = '2px solid #c47a44';
      el.style.boxShadow = '0 0 20px rgba(196,122,68,0.5)';
      el.style.cursor = 'grab';
      el.style.position = item.style || 'fixed';
      const imgSrc = item.dataUrl || item.url;
      if (imgSrc) {
        el.style.backgroundImage = 'url(' + imgSrc + ')';
      }
    }
    this._enableDragging(el);
    this._showResetButton(id);
    EventBus.emit(EVENTS.DECO_EDITING_STARTED, { id: id });
  },

  stopEditingPosition(save = true) {
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
    if (save && el) {
      const rect = el.getBoundingClientRect();
      const pos = {
        top: rect.top + 'px',
        left: rect.left + 'px',
        width: el.offsetWidth + 'px',
        height: el.offsetHeight + 'px',
      };
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
    if (!this._editingId) {
      Utils.showToast(UI.deco.noEditing, true);
      return;
    }
    this.stopEditingPosition(true);
    Utils.showToast(UI.deco.positionConfirmed, false);
  },

  cancelEditing: function () {
    if (!this._editingId) {
      Utils.showToast(UI.deco.noEditing, true);
      return;
    }
    this.stopEditingPosition(false);
    Utils.showToast(UI.deco.editCancelled, false);
  },

  // ----- 渲染方法 -----
  _renderAllDecos: function () {
    document.querySelectorAll('[id^="deco-"]').forEach(function (el) {
      if (el.id.startsWith('deco-') && !el.id.startsWith('deco-reset-btn-')) {
        if (el._longPressCleanup) {
          el._longPressCleanup();
          delete el._longPressCleanup;
        }
        el.remove();
      }
    });
    this._library.forEach((item) => {
      if (item.position) {
        this._renderSingleDeco(item.id);
      }
    });
  },

  _renderSingleDeco: function (id) {
    const item = this.get(id);
    if (!item) return;
    const existing = document.getElementById('deco-' + id);
    if (existing) {
      if (existing._longPressCleanup) {
        existing._longPressCleanup();
        delete existing._longPressCleanup;
      }
      existing.remove();
    }
    if (!item.position) return;
    const el = document.createElement('div');
    el.id = 'deco-' + id;
    const posStyle = item.style || 'fixed';
    el.style.position = posStyle;
    el.style.top = item.position.top || 'auto';
    el.style.left = item.position.left || 'auto';
    el.style.bottom = item.position.bottom || 'auto';
    el.style.right = item.position.right || 'auto';
    el.style.width = item.position.width || 'auto';
    el.style.height = item.position.height || 'auto';
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
    document.body.appendChild(el);

    // 右键菜单（PC）
    el.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      EventBus.emit('deco:context-menu', { decoId: id, x: e.clientX, y: e.clientY });
    });

    // 长按支持（移动端）
    const cleanup = initLongPress(el, (touch, targetEl) => {
      const decoId = targetEl.dataset.decoId;
      EventBus.emit('deco:context-menu', {
        decoId: decoId,
        x: touch.clientX,
        y: touch.clientY,
      });
    }, {
      getTargetData: (el) => el,
    });
    el._longPressCleanup = cleanup;
  },

  // 拖拽相关
  _enableDragging: function (el) {
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
        el.style.left = ev.clientX - offsetX + 'px';
        el.style.top = ev.clientY - offsetY + 'px';
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

  _showResetButton: function (id) {
    const existing = document.getElementById('deco-reset-btn-' + id);
    if (existing) existing.remove();
    const btn = document.createElement('div');
    btn.id = 'deco-reset-btn-' + id;
    btn.textContent = '↺ 重置位置';
    btn.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#2a231c;border:1px solid #c47a44;color:#e8d5b5;padding:6px 16px;border-radius:4px;z-index:10000;cursor:pointer;font-family:Courier New,monospace;font-size:12px;';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const el = document.getElementById('deco-' + id);
      if (el) {
        const winW = window.innerWidth,
          winH = window.innerHeight;
        el.style.top = winH / 2 - 50 + 'px';
        el.style.left = winW / 2 - 50 + 'px';
        el.style.bottom = 'auto';
        el.style.right = 'auto';
      }
    });
    document.body.appendChild(btn);
  },

  download: function (id) {
    const item = this.get(id);
    if (!item) return;
    const imgSrc = item.dataUrl || item.url;
    if (!imgSrc) {
      Utils.showToast('图片资源不存在', true);
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

console.log('✅ DecoShelf 已加载（仓库版本 + dataUrl 标准化）');
