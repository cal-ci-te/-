import { DecoShelf } from '../../services/deco.js';
import { Utils } from '../../utils.js';
import { EventBus } from '../../core/event-bus.js';
import { EVENTS } from '../../core/event-constants.js';
import { UI } from '../../utils/ui-strings.js';

export const DecoShelfUI = {
  _container: null,
  _initialized: false,

  init: function (container) {
    if (!container) {
      console.error('[DecoShelfUI] 容器元素不存在，初始化失败');
      return;
    }

    if (this._initialized) {
      console.log('[DecoShelfUI] 更新容器引用');
      this._container = container;
      this._container.style.minHeight = '60px';
      this._container.style.display = 'block';
      this.render();
      return;
    }

    this._container = container;
    this._container.style.minHeight = '60px';
    this._container.style.display = 'block';
    this._initialized = true;

    EventBus.on(EVENTS.DECO_LIBRARY_CHANGED, () => {
      console.log('[DecoShelfUI] 收到贴图库变更事件，自动刷新列表');
      this.render();
    });

    console.log('[DecoShelfUI] 初始化完成');
    this.render();
  },

  render: function () {
    if (!this._container) {
      console.warn('[DecoShelfUI] 容器未初始化，无法渲染');
      return;
    }

    this._container.style.display = 'block';
    this._container.style.minHeight = '60px';

    if (typeof DecoShelf.getAll !== 'function') {
      this._container.innerHTML =
        `<div style="color:#7a6a58;text-align:center;padding:20px;">${UI.common.loading}</div>`;
      return;
    }

    const items = DecoShelf.getAll();
    console.log('[DecoShelfUI] 当前贴图库数据:', items);

    if (!items || items.length === 0) {
      this._container.innerHTML = `
                <div style="color:#7a6a58;text-align:center;padding:20px;font-family:'Courier New',monospace;font-size:12px;">
                    ${UI.admin.decoEmpty}<br>
                    <span style="font-size:10px;color:#5a4a38;">${UI.admin.decoEmptyHint}</span>
                </div>
            `;
      return;
    }

    let html = '';
    items.forEach((item) => {
      const isPlaced = !!(item.position && (item.position.top || item.position.left || item.position.bottom || item.position.right));
      const preview = item.dataUrl ? `url(${item.dataUrl})` : 'none';
      const styleLabel = item.style === 'fixed' ? UI.admin.decoStyleFixed : UI.admin.decoStyleAbsolute;
      const escapedName = Utils.escapeHtml(item.name);
      const escapedId = Utils.escapeHtml(item.id);

      html += `
                <div class="asset-item" data-id="${escapedId}" style="display:flex;align-items:center;padding:6px 8px;border-bottom:1px solid #3a2a1a;">
                    <div style="width:40px;height:40px;background-image:${preview};background-size:contain;background-repeat:no-repeat;background-position:center;margin-right:10px;flex-shrink:0;border:1px solid #5a3e2b;border-radius:4px;background-color:#1a1612;"></div>
                    <span style="flex:1;font-size:11px;color:#e8d5b5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Courier New',monospace;" title="${escapedName}">${escapedName}</span>
                    <span style="font-size:9px;color:#7a6a58;margin-right:8px;font-family:'Courier New',monospace;flex-shrink:0;">${isPlaced ? UI.admin.decoItemPlaced : UI.admin.decoItemUnplaced}</span>
                    <button class="asset-style-btn" data-id="${escapedId}" style="background:none;border:none;color:#c4b5a0;cursor:pointer;font-size:11px;padding:0 4px;" title="${UI.admin.decoStyleLabel}（当前：${styleLabel}）">🔄 ${styleLabel}</button>
                    <button class="asset-duplicate-btn" data-id="${escapedId}" style="background:none;border:none;color:#c4b5a0;cursor:pointer;font-size:14px;padding:0 4px;" title="${UI.admin.decoDuplicate}">📋</button>
                    <button class="asset-rename-btn" data-id="${escapedId}" style="background:none;border:none;color:#c4b5a0;cursor:pointer;font-size:14px;padding:0 4px;" title="${UI.admin.decoRename}">✏️</button>
                    <button class="asset-edit-pos-btn" data-id="${escapedId}" style="background:none;border:none;color:#c4b5a0;cursor:pointer;font-size:14px;padding:0 4px;" title="${UI.admin.decoEditPos}">📍</button>
                    <button class="asset-download-btn" data-id="${escapedId}" style="background:none;border:none;color:#c4b5a0;cursor:pointer;font-size:14px;padding:0 4px;" title="${UI.admin.decoDownload}">⬇️</button>
                    <button class="asset-delete-btn" data-id="${escapedId}" style="background:none;border:none;color:#c44a44;cursor:pointer;font-size:14px;padding:0 4px;" title="${UI.admin.decoDelete}">🗑️</button>
                </div>
            `;
    });

    this._container.innerHTML = html;
    console.log('[DecoShelfUI] 列表渲染完成，共', items.length, '项');
    this._bindEvents();
  },

  _bindEvents: function () {
    const container = this._container;
    if (!container) return;

    container.querySelectorAll('.asset-style-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const item = DecoShelf.get(id);
        if (!item) return;
        const newStyle = item.style === 'fixed' ? 'absolute' : 'fixed';
        DecoShelf.setStyle(id, newStyle);
        // 提示信息由 DecoShelf.setStyle 内部处理，但我们也显示一条
        Utils.showToast(UI.deco.styleSwitched(newStyle === 'fixed' ? '悬浮窗' : '贴纸'), false);
      });
    });

    container.querySelectorAll('.asset-duplicate-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const newItem = DecoShelf.duplicate(id);
        if (newItem) {
          Utils.showToast(UI.deco.duplicateSuccess(newItem.name), false);
        }
      });
    });

    container.querySelectorAll('.asset-rename-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const item = DecoShelf.get(id);
        if (!item) return;
        const newName = prompt(UI.deco.renamePrompt, item.name);
        if (newName !== null && newName.trim() !== '') {
          DecoShelf.rename(id, newName.trim());
        }
      });
    });

    container.querySelectorAll('.asset-edit-pos-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const editingId = DecoShelf.getEditingId();
        if (editingId && editingId !== id) {
          DecoShelf.stopEditingPosition(false);
        }
        DecoShelf.startEditingPosition(id);
        Utils.showToast(UI.deco.editPosToast, false);
      });
    });

    container.querySelectorAll('.asset-download-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        DecoShelf.download(id);
      });
    });

    container.querySelectorAll('.asset-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const item = DecoShelf.get(id);
        if (!item) return;
        if (confirm(UI.deco.deleteConfirm(item.name))) {
          DecoShelf.deleteFromLibrary(id);
          Utils.showToast(UI.deco.deleteSuccess(item.name), false);
        }
      });
    });
  },

  destroy: function () {
    if (!this._initialized) return;
    if (this._container) {
      const newContainer = this._container.cloneNode(false);
      this._container.parentNode.replaceChild(newContainer, this._container);
      this._container = newContainer;
    }
    EventBus.off(EVENTS.DECO_LIBRARY_CHANGED);
    this._initialized = false;
    console.log('[DecoShelfUI] 已销毁');
  },
};
