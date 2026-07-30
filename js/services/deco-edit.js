// 贴纸统一编辑管理器：移动 + 缩放合并在同一编辑模式下。
// 进入编辑模式后贴纸可拖拽移动 + 拖拽右下角控制点缩放，
// 底部工具栏提供「确认更改」「重置」「取消」三个按钮。
// 未放置的贴纸点击编辑时自动渲染到屏幕正中。
import { DecoShelf } from './deco.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { Utils } from '../utils.js';
import { UI } from '../utils/ui-strings.js';

// ---- 初始化：监听贴纸库变更，自动退出已删除贴纸的编辑模式 ----
EventBus.on(EVENTS.DECO_LIBRARY_CHANGED, () => {
    if (!DecoEdit._activeDecoId) return;
    const item = DecoShelf.get(DecoEdit._activeDecoId);
    if (!item) {
        console.log('[DecoEdit] 贴纸已删除，自动退出编辑模式');
        DecoEdit.exitEditMode(false);
    }
});

export const DecoEdit = {
    // ----- 配置 -----
    CONFIG: {
        useTransform: false,   // CSS transform 缩放方案（GPU 加速）
        minSize: 40,           // 最小尺寸（px）
        maxSizeRatio: 0.8,     // 最大尺寸 = 视口 * 0.8
    },

    // ----- 内部状态 -----
    _activeDecoId: null,
    _activeElement: null,
    _handle: null,             // 缩放控制点 DOM
    _toolbar: null,            // 底部工具栏 DOM
    _snapshot: null,           // { top, left, width, height, scaleX, scaleY, transform, transformOrigin, position }
    _wasUnplaced: false,       // 贴纸原本未放置（enterEditMode 时动态创建了 DOM）
    _rafId: null,
    _pendingResize: null,      // 缩放待更新值

    // ----- 缩放拖拽状态 -----
    _resizeStartX: 0,
    _resizeStartY: 0,
    _resizeStartWidth: 0,
    _resizeStartHeight: 0,
    _originalWidth: 0,
    _originalHeight: 0,
    _resizeMoveHandler: null,
    _resizeUpHandler: null,
    _handleDownHandler: null,
    _handleTouchHandler: null,

    // ----- 移动拖拽状态 -----
    _isDragging: false,
    _dragStartX: 0,
    _dragStartY: 0,
    _dragStartLeft: 0,
    _dragStartTop: 0,
    _decoDownHandler: null,

    // ----- 键盘事件 -----
    _escHandler: null,

    // ============================
    //  生命周期
    // ============================

    /** 进入编辑模式：快照 + 高亮 + 控制点 + 移动拖拽 + 工具栏 */
    enterEditMode(decoId) {
        // 移动端禁用
        if (window.innerWidth <= 768 || ('ontouchstart' in window)) {
            Utils.showToast(UI.toast.decoMobileNotSupported, true);
            return;
        }

        // 已有其他贴纸在编辑模式则强制退出
        if (this._activeDecoId && this._activeDecoId !== decoId) {
            this.exitEditMode(false);
            console.log('[DecoEdit] 强制退出上一个贴纸编辑:', this._activeDecoId);
        }

        // 同一贴纸已处于编辑模式则跳过（幂等）
        if (this._activeDecoId === decoId) return;

        const item = DecoShelf.get(decoId);
        if (!item) { Utils.showToast('贴纸数据不存在', true); return; }

        let el = document.getElementById('deco-' + decoId);

        if (!el) {
            // 贴纸未放置 → 动态创建元素到屏幕正中
            el = this._createDecoElement(decoId, item);
            this._wasUnplaced = true;
        } else {
            this._wasUnplaced = false;
        }

        // 拍摄快照（如果原本未放置则记录 null position 以便取消时恢复）
        this._snapshot = this._captureSnapshot(el, item);

        this._activeDecoId = decoId;
        this._activeElement = el;

        // 记录原始尺寸
        const currentW = parseFloat(el.style.width) || el.offsetWidth || 100;
        const currentH = parseFloat(el.style.height) || el.offsetHeight || 100;
        this._originalWidth = isNaN(currentW) ? 100 : currentW;
        this._originalHeight = isNaN(currentH) ? 100 : currentH;

        // 高亮边框
        el.classList.add('deco-editing');
        el.style.cursor = 'grab';

        // 创建右下角缩放控制点
        this._createHandle(el);

        // 绑定缩放拖拽（控制点）
        this._bindResizeDrag(el);

        // 绑定移动拖拽（贴纸主体）
        this._bindDecoDrag(el);

        // 显示底部工具栏
        this._showToolbar();

        // 绑定 ESC 键
        this._bindEscKey();

        EventBus.emit('deco:edit-mode-started', { decoId });
        console.log('[DecoEdit] 进入编辑模式，贴纸:', decoId, this._wasUnplaced ? '(原未放置，已创建)' : '');
    },

    /** 退出编辑模式 */
    exitEditMode(save = true) {
        if (!this._activeDecoId) return;

        const el = this._activeElement || document.getElementById('deco-' + this._activeDecoId);
        if (!el || !DecoShelf.get(this._activeDecoId)) {
            console.log('[DecoEdit] 贴纸已不存在，跳过保存直接清理');
            this._cleanup();
            return;
        }

        const decoId = this._activeDecoId;

        if (save) {
            this._saveChanges();
        } else if (this._wasUnplaced) {
            // 取消且原本未放置 → 移除元素，恢复 position=null
            el.remove();
            DecoShelf.setPosition(decoId, null);
        } else {
            // 取消 → 恢复快照样式
            this._applySnapshot(el);
        }

        this._cleanup();

        EventBus.emit('deco:edit-mode-ended', { decoId });
        console.log('[DecoEdit] 退出编辑模式，save:', save);
    },

    /** 重置到快照状态（保持编辑模式，继续调整） */
    resetToSnapshot() {
        const el = this._activeElement || document.getElementById('deco-' + this._activeDecoId);
        if (!el || !this._snapshot) return;

        this._applySnapshot(el);
        this._syncHandle(el);
        Utils.showToast(UI.decoEdit.resetToast, false);
        console.log('[DecoEdit] 已重置到快照');
    },

    /** 是否处于编辑模式 */
    isActive() {
        return !!this._activeDecoId;
    },

    /** 获取当前激活的贴纸 ID */
    getActiveDecoId() {
        return this._activeDecoId;
    },

    // ============================
    //  贴纸元素创建（未放置时）
    // ============================

    _createDecoElement(id, item) {
        const el = document.createElement('div');
        el.id = 'deco-' + id;
        el.style.position = 'fixed';
        el.style.top = (window.innerHeight / 2 - 50) + 'px';
        el.style.left = (window.innerWidth / 2 - 50) + 'px';
        el.style.width = '100px';
        el.style.height = '100px';
        const imgSrc = item.dataUrl || item.url;
        el.style.backgroundImage = imgSrc ? 'url(' + imgSrc + ')' : 'none';
        el.style.backgroundSize = 'contain';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = 'center';
        el.style.zIndex = '99';
        el.style.pointerEvents = 'auto';
        el.dataset.decoId = id;
        el.title = item.name + ' (fixed)';
        if (document.body) {
            document.body.appendChild(el);
        } else {
            document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el));
        }
        return el;
    },

    // ============================
    //  快照
    // ============================

    _captureSnapshot(el, item) {
        return {
            top: el.style.top || '',
            left: el.style.left || '',
            width: el.style.width || '',
            height: el.style.height || '',
            transform: el.style.transform || '',
            transformOrigin: el.style.transformOrigin || '',
            position: item.position ? { ...item.position } : null,
            scaleX: el._scaleX,
            scaleY: el._scaleY,
        };
    },

    _applySnapshot(el) {
        if (!this._snapshot) return;
        el.style.top = this._snapshot.top;
        el.style.left = this._snapshot.left;
        el.style.width = this._snapshot.width;
        el.style.height = this._snapshot.height;
        el.style.transform = this._snapshot.transform;
        el.style.transformOrigin = this._snapshot.transformOrigin || '';
        if (this._snapshot.scaleX !== undefined) el._scaleX = this._snapshot.scaleX;
        else delete el._scaleX;
        if (this._snapshot.scaleY !== undefined) el._scaleY = this._snapshot.scaleY;
        else delete el._scaleY;
    },

    // ============================
    //  控制点
    // ============================

    _createHandle(el) {
        this._removeHandle();
        const handle = document.createElement('div');
        handle.className = 'deco-edit-handle';
        handle.style.cssText = `
            position: absolute;
            bottom: -10px;
            right: -10px;
            width: 20px;
            height: 20px;
            cursor: nwse-resize;
            background: var(--color-accent, #c47a44);
            border: 2px solid var(--color-bg-primary, #1a1612);
            border-radius: 50%;
            z-index: 101;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        handle.innerHTML = '<span style="font-size:10px;color:var(--color-bg-primary,#1a1612);line-height:1;">◢</span>';
        el.appendChild(handle);
        this._handle = handle;
    },

    _removeHandle() {
        this._removeHandleListeners();
        if (this._handle) {
            this._handle.remove();
            this._handle = null;
        }
    },

    _syncHandle(el) {
        if (!this._handle && el) this._createHandle(el);
    },

    // ============================
    //  缩放拖拽
    // ============================

    _bindResizeDrag(el) {
        const self = this;
        this._resizeStartWidth = parseFloat(el.style.width) || el.offsetWidth || 100;
        this._resizeStartHeight = parseFloat(el.style.height) || el.offsetHeight || 100;

        const onDown = (e) => {
            if (e.target !== self._handle && !self._handle.contains(e.target)) return;
            if (e.button !== undefined && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();

            self._resizeStartX = e.clientX;
            self._resizeStartY = e.clientY;
            self._resizeStartWidth = parseFloat(el.style.width) || el.offsetWidth || 100;
            self._resizeStartHeight = parseFloat(el.style.height) || el.offsetHeight || 100;

            self._resizeMoveHandler = (ev) => self._onResizeMove(ev, el);
            self._resizeUpHandler = () => self._onResizeUp(el);

            document.addEventListener('mousemove', self._resizeMoveHandler);
            document.addEventListener('mouseup', self._resizeUpHandler);
            document.addEventListener('touchmove', self._resizeMoveHandler, { passive: false });
            document.addEventListener('touchend', self._resizeUpHandler);
        };

        this._handleDownHandler = onDown;
        this._handleTouchHandler = onDown;
        this._handle.addEventListener('mousedown', onDown);
        this._handle.addEventListener('touchstart', onDown, { passive: false });
    },

    _removeHandleListeners() {
        if (!this._handle) return;
        if (this._handleDownHandler) {
            this._handle.removeEventListener('mousedown', this._handleDownHandler);
            this._handle.removeEventListener('touchstart', this._handleTouchHandler);
            this._handleDownHandler = null;
            this._handleTouchHandler = null;
        }
    },

    _onResizeMove(e, el) {
        const clientX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
        const clientY = (e.touches && e.touches.length) ? e.touches[0].clientY : e.clientY;

        const dx = clientX - this._resizeStartX;
        const dy = clientY - this._resizeStartY;

        let newWidth = Math.max(this.CONFIG.minSize, this._resizeStartWidth + dx);
        let newHeight = Math.max(this.CONFIG.minSize, this._resizeStartHeight + dy);

        if (e.shiftKey) {
            const ratio = this._resizeStartWidth / this._resizeStartHeight;
            newHeight = newWidth / ratio;
        }

        const currentLeft = parseFloat(el.style.left) || 0;
        const currentTop = parseFloat(el.style.top) || 0;
        const HANDLE_MARGIN = 10;
        const maxW = Math.max(this.CONFIG.minSize, window.innerWidth - currentLeft - HANDLE_MARGIN);
        const maxH = Math.max(this.CONFIG.minSize, window.innerHeight - currentTop - HANDLE_MARGIN);
        newWidth = Math.min(newWidth, maxW);
        newHeight = Math.min(newHeight, maxH);

        this._pendingResize = { width: newWidth, height: newHeight };

        if (!this._rafId) {
            this._rafId = requestAnimationFrame(() => {
                if (this._pendingResize && this._activeDecoId) {
                    this._applySize(el, this._pendingResize.width, this._pendingResize.height);
                    this._pendingResize = null;
                }
                this._rafId = null;
            });
        }
    },

    _onResizeUp(el) {
        if (this._resizeMoveHandler) {
            document.removeEventListener('mousemove', this._resizeMoveHandler);
            document.removeEventListener('touchmove', this._resizeMoveHandler);
        }
        if (this._resizeUpHandler) {
            document.removeEventListener('mouseup', this._resizeUpHandler);
            document.removeEventListener('touchend', this._resizeUpHandler);
        }
        this._resizeMoveHandler = null;
        this._resizeUpHandler = null;

        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this._pendingResize && this._activeDecoId) {
            this._applySize(el, this._pendingResize.width, this._pendingResize.height);
            this._pendingResize = null;
        }
    },

    _applySize(el, width, height) {
        if (this.CONFIG.useTransform) {
            const scaleX = this._originalWidth > 0 ? width / this._originalWidth : 1;
            const scaleY = this._originalHeight > 0 ? height / this._originalHeight : 1;
            el.style.width = this._originalWidth + 'px';
            el.style.height = this._originalHeight + 'px';
            el.style.transform = `scale(${scaleX}, ${scaleY})`;
            el.style.transformOrigin = 'top left';
            el._scaleX = scaleX;
            el._scaleY = scaleY;
        } else {
            el.style.width = width + 'px';
            el.style.height = height + 'px';
            el.style.transform = '';
        }
    },

    // ============================
    //  位置拖拽
    // ============================

    _bindDecoDrag(el) {
        const self = this;

        const onDown = (e) => {
            if (e.target === self._handle || (self._handle && self._handle.contains(e.target))) return;
            if (e.button !== undefined && e.button !== 0) return;
            e.preventDefault();

            self._isDragging = true;
            self._dragStartX = e.clientX;
            self._dragStartY = e.clientY;
            self._dragStartLeft = parseFloat(el.style.left) || el.getBoundingClientRect().left;
            self._dragStartTop = parseFloat(el.style.top) || el.getBoundingClientRect().top;
            el.style.cursor = 'grabbing';

            const onMove = (ev) => {
                if (!self._isDragging) return;
                ev.preventDefault();
                const dx = ev.clientX - self._dragStartX;
                const dy = ev.clientY - self._dragStartY;
                let newLeft = self._dragStartLeft + dx;
                let newTop = self._dragStartTop + dy;

                const MARGIN = 10;
                const maxLeft = window.innerWidth - el.offsetWidth - MARGIN;
                const maxTop = window.innerHeight - el.offsetHeight - MARGIN;
                newLeft = Math.max(MARGIN, Math.min(newLeft, maxLeft));
                newTop = Math.max(MARGIN, Math.min(newTop, maxTop));

                el.style.left = newLeft + 'px';
                el.style.top = newTop + 'px';
                el.style.right = 'auto';
                el.style.bottom = 'auto';
            };

            const onUp = () => {
                self._isDragging = false;
                el.style.cursor = 'grab';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        };

        el.addEventListener('mousedown', onDown);
        el.addEventListener('touchstart', onDown, { passive: false });
        this._decoDownHandler = onDown;
    },

    _unbindDecoDrag(el) {
        if (this._decoDownHandler && el) {
            el.removeEventListener('mousedown', this._decoDownHandler);
            el.removeEventListener('touchstart', this._decoDownHandler);
            this._decoDownHandler = null;
        }
    },

    // ============================
    //  保存与清理
    // ============================

    _saveChanges() {
        const el = this._activeElement || document.getElementById('deco-' + this._activeDecoId);
        const item = DecoShelf.get(this._activeDecoId);
        if (!el || !item) return;

        let width, height, scaleX, scaleY;
        if (this.CONFIG.useTransform) {
            scaleX = parseFloat(el._scaleX || 1);
            scaleY = parseFloat(el._scaleY || 1);
            width = this._originalWidth * scaleX;
            height = this._originalHeight * scaleY;
        } else {
            width = parseFloat(el.style.width) || el.offsetWidth || this._originalWidth;
            height = parseFloat(el.style.height) || el.offsetHeight || this._originalHeight;
        }

        width = Math.round(width);
        height = Math.round(height);

        const currentLeft = parseFloat(el.style.left) || 0;
        const currentTop = parseFloat(el.style.top) || 0;

        const maxX = Math.max(0, window.innerWidth - width);
        const maxY = Math.max(0, window.innerHeight - height);
        const clampedLeft = Math.max(0, Math.min(currentLeft, maxX));
        const clampedTop = Math.max(0, Math.min(currentTop, maxY));

        if (clampedLeft !== currentLeft) el.style.left = clampedLeft + 'px';
        if (clampedTop !== currentTop) el.style.top = clampedTop + 'px';

        const newPos = {
            ...(item.position || {}),
            top: clampedTop + 'px',
            left: clampedLeft + 'px',
            width: width,
            height: height,
        };

        if (this.CONFIG.useTransform) {
            newPos.scaleX = Math.round(scaleX * 100) / 100;
            newPos.scaleY = Math.round(scaleY * 100) / 100;
        } else {
            delete newPos.scaleX;
            delete newPos.scaleY;
        }

        DecoShelf.setPosition(this._activeDecoId, newPos);
    },

    _cleanup() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._pendingResize = null;

        if (this._resizeMoveHandler) {
            document.removeEventListener('mousemove', this._resizeMoveHandler);
            document.removeEventListener('touchmove', this._resizeMoveHandler);
            this._resizeMoveHandler = null;
        }
        if (this._resizeUpHandler) {
            document.removeEventListener('mouseup', this._resizeUpHandler);
            document.removeEventListener('touchend', this._resizeUpHandler);
            this._resizeUpHandler = null;
        }

        this._removeHandle();

        if (this._activeElement) {
            this._unbindDecoDrag(this._activeElement);
            this._activeElement.classList.remove('deco-editing');
            this._activeElement.style.cursor = '';
        }

        this._hideToolbar();
        this._unbindEscKey();

        this._activeDecoId = null;
        this._activeElement = null;
        this._snapshot = null;
        this._wasUnplaced = false;
    },

    // ============================
    //  工具栏
    // ============================

    _showToolbar() {
        this._hideToolbar();

        const self = this;
        const container = document.createElement('div');
        container.className = 'deco-edit-toolbar';
        container.innerHTML = `
            <span>${UI.decoEdit.toolbarTitle}</span>
            <button id="decoEditConfirm" class="toolbar-btn primary">${UI.decoEdit.confirmBtn}</button>
            <button id="decoEditReset" class="toolbar-btn secondary">${UI.decoEdit.resetBtn}</button>
            <button id="decoEditCancel" class="toolbar-btn danger">${UI.decoEdit.cancelBtn}</button>
        `;
        document.body.appendChild(container);
        this._toolbar = container;

        container.querySelector('#decoEditConfirm').addEventListener('click', (e) => {
            e.stopPropagation();
            self._saveChanges();
            self.exitEditMode(true);
            Utils.showToast(UI.decoEdit.confirmToast, false);
        });

        container.querySelector('#decoEditReset').addEventListener('click', (e) => {
            e.stopPropagation();
            self.resetToSnapshot();
        });

        container.querySelector('#decoEditCancel').addEventListener('click', (e) => {
            e.stopPropagation();
            self.exitEditMode(false);
            Utils.showToast(UI.decoEdit.cancelToast, false);
        });
    },

    _hideToolbar() {
        if (this._toolbar) {
            this._toolbar.remove();
            this._toolbar = null;
        }
        document.querySelectorAll('.deco-edit-toolbar').forEach(el => el.remove());
        document.querySelectorAll('.deco-resize-control').forEach(el => el.remove());
    },

    // ============================
    //  ESC 键
    // ============================

    _bindEscKey() {
        this._escHandler = (e) => {
            if (e.key === 'Escape') {
                this.exitEditMode(false);
                Utils.showToast(UI.decoEdit.cancelToast, false);
            }
        };
        document.addEventListener('keydown', this._escHandler);
    },

    _unbindEscKey() {
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    },
};
