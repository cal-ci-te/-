// 贴纸缩放管理器：右下角控制点拖拽改变贴纸尺寸。
// 内建 requestAnimationFrame 节流 + CSS transform 方案预留。
// 与位置管理模式互斥——两种编辑模式不能同时开启。
import { DecoShelf } from './deco.js';
import { DecoRepository } from './deco-repository.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { Utils } from '../utils.js';
import { UI } from '../utils/ui-strings.js';

// ---- 初始化：监听贴纸库变更，自动退出已删除贴纸的缩放模式 ----
EventBus.on(EVENTS.DECO_LIBRARY_CHANGED, () => {
    if (!DecoResize._activeDecoId) return;
    // 检查激活的贴纸是否仍在库中
    const item = DecoShelf.get(DecoResize._activeDecoId);
    if (!item) {
        console.log('[DecoResize] 贴纸已删除，自动退出缩放模式');
        DecoResize.exitResizeMode(false);
    }
});

export const DecoResize = {
    // ----- 配置 -----
    CONFIG: {
        useTransform: false,   // 设为 true 时启用 CSS transform 缩放（GPU 加速，不触发 Reflow）
        minSize: 40,           // 最小尺寸（px）
        maxSizeRatio: 0.8,     // 最大尺寸 = 视口 * 0.8
        throttleFPS: 60,       // 节流帧率
    },

    // ----- 内部状态 -----
    _activeDecoId: null,
    _activeElement: null,
    _handle: null,
    _snapshot: null,         // { width, height, position, transform } — 取消时回退
    _rafId: null,
    _pendingUpdate: null,
    _startX: 0,
    _startY: 0,
    _startWidth: 0,
    _startHeight: 0,
    _originalWidth: 0,
    _originalHeight: 0,
    _moveHandler: null,
    _upHandler: null,
    _handleDownHandler: null,   // 控制点 mousedown 引用（供清理）
    _handleTouchHandler: null,  // 控制点 touchstart 引用（供清理）
    _resizeControls: null,      // 底部确认/取消工具栏 DOM
    _defaultSizes: {},          // decoId → { w, h } —— 首次进入缩放模式时记录，用于「恢复默认大小」

    // ----- 生命周期 -----

    /** 进入缩放模式 */
    enterResizeMode(decoId) {
        // 移动端禁用
        if (window.innerWidth <= 768 || ('ontouchstart' in window)) {
            Utils.showToast(UI.toast.decoMobileNotSupported, true);
            return;
        }

        // 🔧 任务 4：多贴纸防冲突 —— 已有其他贴纸在缩放模式则强制退出
        if (this._activeDecoId && this._activeDecoId !== decoId) {
            const prevDecoId = this._activeDecoId;
            const prevEl = this._activeElement;
            this.exitResizeMode(false);
            // 确保上一个贴纸的样式已完全清理
            if (prevEl) {
                prevEl.classList.remove('deco-resizing');
            }
            console.log('[DecoResize] 强制退出上一个贴纸缩放:', prevDecoId);
        }

        // 🔧 任务 4：幂等 —— 同一个贴纸已处于缩放模式则跳过
        if (this._activeDecoId === decoId) {
            return;
        }

        const el = document.getElementById('deco-' + decoId);
        if (!el) {
            Utils.showToast('贴纸元素不存在', true);
            return;
        }

        const item = DecoShelf.get(decoId);
        if (!item) {
            Utils.showToast('贴纸数据不存在', true);
            return;
        }

        // 拍摄快照（用于取消回退）
        this._snapshot = this._captureSnapshot(el, item);

        this._activeDecoId = decoId;
        this._activeElement = el;

        // 记录原始尺寸（从当前 DOM 或 position 中读取）
        const currentW = parseFloat(el.style.width) || el.offsetWidth || 100;
        const currentH = parseFloat(el.style.height) || el.offsetHeight || 100;
        this._originalWidth = isNaN(currentW) ? 100 : currentW;
        this._originalHeight = isNaN(currentH) ? 100 : currentH;

        // 首次进入缩放模式时记录「默认大小」（供「恢复默认大小」使用）
        if (!this._defaultSizes[decoId]) {
            this._defaultSizes[decoId] = {
                w: this._originalWidth,
                h: this._originalHeight,
            };
        }

        // 高亮边框
        el.classList.add('deco-resizing');

        // 创建控制点
        this._createHandle(el);

        // 绑定全局拖拽
        this._bindResizeDrag(el);

        // 显示底部确认/取消工具栏
        this._showResizeControls();

        // 显示工具栏
        EventBus.emit('deco:resize-mode-started', { decoId });

        console.log('[DecoResize] 进入缩放模式，贴纸:', decoId,
            '原始尺寸:', this._originalWidth + '×' + this._originalHeight);
    },

    /** 退出缩放模式 */
    exitResizeMode(save = true) {
        if (!this._activeDecoId) return;

        // 🔧 任务 5：贴纸已被删除 → 直接清理，不尝试保存
        const el = this._activeElement || document.getElementById('deco-' + this._activeDecoId);
        if (!el || !DecoShelf.get(this._activeDecoId)) {
            console.log('[DecoResize] 贴纸已不存在，跳过保存直接清理');
            this._cleanup();
            this._activeDecoId = null;
            this._activeElement = null;
            this._snapshot = null;
            return;
        }

        const decoId = this._activeDecoId;

        if (save) {
            this._saveSize(decoId);
        } else {
            // 回退到快照
            this._restoreSnapshot(el);
        }

        // 清理
        this._cleanup();
        this._activeDecoId = null;
        this._activeElement = null;
        this._snapshot = null;

        // 隐藏底部工具栏
        this._hideResizeControls();

        EventBus.emit('deco:resize-mode-ended', { decoId });
        console.log('[DecoResize] 退出缩放模式，save:', save);
    },

    /** 恢复到首次进入缩放模式时的默认大小（非原始图片尺寸） */
    resetToOriginalSize(decoId) {
        const el = document.getElementById('deco-' + decoId);
        const item = DecoShelf.get(decoId);
        if (!el || !item) return;

        // 使用记录的默认大小；如无记录则回退到当前 DOM 尺寸
        const def = this._defaultSizes[decoId] || {
            w: parseFloat(el.style.width) || el.offsetWidth || 100,
            h: parseFloat(el.style.height) || el.offsetHeight || 100,
        };
        const w = def.w;
        const h = def.h;

        // 清理 DOM 上的 transform + _scaleX/_scaleY 残留
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        el.style.transform = '';
        el.style.transformOrigin = '';
        delete el._scaleX;
        delete el._scaleY;

        // 更新 position：同时删除 scaleX/scaleY（确保两种模式下都生效）
        const newPos = { ...(item.position || {}), width: w, height: h };
        delete newPos.scaleX;
        delete newPos.scaleY;
        DecoShelf.setPosition(decoId, newPos);
        Utils.showToast('已恢复默认大小', false);

        // 同步 _originalWidth/Height，后续拖拽基于新的基准
        this._originalWidth = w;
        this._originalHeight = h;
    },

    /** 是否处于缩放模式 */
    isActive() {
        return !!this._activeDecoId;
    },

    /** 获取当前激活的贴纸 ID */
    getActiveDecoId() {
        return this._activeDecoId;
    },

    // ----- 模式切换 -----

    /** 运行时切换缩放实现方案（direct ↔ transform） */
    setUseTransform(enabled) {
        this.CONFIG.useTransform = !!enabled;
        console.log('[DecoResize] useTransform:', this.CONFIG.useTransform);
    },

    // ----- 内部方法 -----

    /** 拍摄快照 */
    _captureSnapshot(el, item) {
        return {
            width: el.style.width || 'auto',
            height: el.style.height || 'auto',
            transform: el.style.transform || '',
            transformOrigin: el.style.transformOrigin || '',
            position: item.position ? { ...item.position } : null,
        };
    },

    /** 回退到快照 */
    _restoreSnapshot(el) {
        if (!this._snapshot) return;
        el.style.width = this._snapshot.width;
        el.style.height = this._snapshot.height;
        el.style.transform = this._snapshot.transform;
        el.style.transformOrigin = this._snapshot.transformOrigin || '';
        el.classList.remove('deco-resizing');
        delete el._scaleX;
        delete el._scaleY;
    },

    /** 创建右下角缩放控制点 */
    _createHandle(el) {
        // 移除已有控制点
        if (this._handle) {
            this._removeHandleListeners();
            this._handle.remove();
            this._handle = null;
        }

        const handle = document.createElement('div');
        handle.className = 'deco-resize-handle';
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

    /** 绑定全局拖拽缩放 */
    _bindResizeDrag(el) {
        const self = this;

        // 存储原始尺寸（每次 mousedown 重新读取，处理中途 mode 切换）
        this._startWidth = parseFloat(el.style.width) || el.offsetWidth || 100;
        this._startHeight = parseFloat(el.style.height) || el.offsetHeight || 100;

        const onDown = (e) => {
            // 仅响应控制点本身
            if (e.target !== self._handle && !self._handle.contains(e.target)) return;
            if (e.button !== undefined && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();

            self._startX = e.clientX;
            self._startY = e.clientY;
            self._startWidth = parseFloat(el.style.width) || el.offsetWidth || 100;
            self._startHeight = parseFloat(el.style.height) || el.offsetHeight || 100;

            self._moveHandler = (ev) => self._onResizeMove(ev, el);
            self._upHandler = () => self._onResizeUp(el);

            document.addEventListener('mousemove', self._moveHandler);
            document.addEventListener('mouseup', self._upHandler);
            // 移动端
            document.addEventListener('touchmove', self._moveHandler, { passive: false });
            document.addEventListener('touchend', self._upHandler);
        };

        // 🔧 任务 3：存储控制点事件监听器引用以便清理
        this._handleDownHandler = onDown;
        this._handleTouchHandler = onDown;  // touchstart 使用同一处理函数

        this._handle.addEventListener('mousedown', onDown);
        this._handle.addEventListener('touchstart', onDown, { passive: false });
    },

    // 🔧 任务 3：移除控制点上的事件监听器
    _removeHandleListeners() {
        if (!this._handle) return;
        if (this._handleDownHandler) {
            this._handle.removeEventListener('mousedown', this._handleDownHandler);
            this._handle.removeEventListener('touchstart', this._handleTouchHandler);
            this._handleDownHandler = null;
            this._handleTouchHandler = null;
        }
    },

    /** 拖拽移动处理（rAF 节流） */
    _onResizeMove(e, el) {
        const clientX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
        const clientY = (e.touches && e.touches.length) ? e.touches[0].clientY : e.clientY;

        const dx = clientX - this._startX;
        const dy = clientY - this._startY;

        let newWidth = Math.max(this.CONFIG.minSize, this._startWidth + dx);
        let newHeight = Math.max(this.CONFIG.minSize, this._startHeight + dy);

        // Shift 键保持宽高比
        if (e.shiftKey) {
            const ratio = this._startWidth / this._startHeight;
            newHeight = newWidth / ratio;
        }

        // 边界约束：贴纸不能超过视口大小，且右下角控制点不能超出可视范围
        const currentLeft = parseFloat(el.style.left) || 0;
        const currentTop = parseFloat(el.style.top) || 0;
        const HANDLE_MARGIN = 10; // 控制点溢出贴纸边缘的量
        const maxByViewportW = Math.min(window.innerWidth, window.innerWidth - currentLeft - HANDLE_MARGIN);
        const maxByViewportH = Math.min(window.innerHeight, window.innerHeight - currentTop - HANDLE_MARGIN);
        const maxW = Math.max(this.CONFIG.minSize, maxByViewportW);
        const maxH = Math.max(this.CONFIG.minSize, maxByViewportH);
        newWidth = Math.min(newWidth, maxW);
        newHeight = Math.min(newHeight, maxH);

        // 存储待更新值，由 rAF 统一应用
        this._pendingUpdate = { width: newWidth, height: newHeight };

        if (!this._rafId) {
            this._rafId = requestAnimationFrame(() => {
                if (this._pendingUpdate && this._activeDecoId) {
                    this._applySize(el, this._pendingUpdate.width, this._pendingUpdate.height);
                    this._pendingUpdate = null;
                }
                this._rafId = null;
            });
        }
    },

    /** 拖拽结束处理 */
    _onResizeUp(el) {
        // 🔧 任务 3：正确移除 document 级别监听器
        if (this._moveHandler) {
            document.removeEventListener('mousemove', this._moveHandler);
            document.removeEventListener('touchmove', this._moveHandler);
        }
        if (this._upHandler) {
            document.removeEventListener('mouseup', this._upHandler);
            document.removeEventListener('touchend', this._upHandler);
        }
        this._moveHandler = null;
        this._upHandler = null;

        // 确保最终帧已渲染
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this._pendingUpdate && this._activeDecoId) {
            this._applySize(el, this._pendingUpdate.width, this._pendingUpdate.height);
            this._pendingUpdate = null;
        }

        console.log('[DecoResize] 拖拽结束，最终尺寸:',
            el.style.width, '×', el.style.height);
    },

    /** 应用尺寸到 DOM（内部使用，两种方案统一入口） */
    _applySize(el, width, height) {
        if (this.CONFIG.useTransform) {
            // 方案 C：CSS transform scale（GPU 加速）
            const scaleX = this._originalWidth > 0 ? width / this._originalWidth : 1;
            const scaleY = this._originalHeight > 0 ? height / this._originalHeight : 1;
            el.style.width = this._originalWidth + 'px';
            el.style.height = this._originalHeight + 'px';
            el.style.transform = `scale(${scaleX}, ${scaleY})`;
            el.style.transformOrigin = 'top left';
            el._scaleX = scaleX;
            el._scaleY = scaleY;
        } else {
            // 方案 B：直接修改 width/height（默认）
            el.style.width = width + 'px';
            el.style.height = height + 'px';
            el.style.transform = '';
        }
    },

    /** 保存尺寸到数据库（含位置钳制） */
    _saveSize(decoId) {
        const el = this._activeElement || document.getElementById('deco-' + decoId);
        const item = DecoShelf.get(decoId);
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

        // 🔧 任务 1：位置钳制 —— 贴纸放大后不超出视口
        // 从 DOM 读取当前位置（贴纸使用 top/left CSS 定位）
        const currentLeft = parseFloat(el.style.left) || 0;
        const currentTop = parseFloat(el.style.top) || 0;
        const maxX = Math.max(0, window.innerWidth - width);
        const maxY = Math.max(0, window.innerHeight - height);
        const clampedLeft = Math.max(0, Math.min(currentLeft, maxX));
        const clampedTop = Math.max(0, Math.min(currentTop, maxY));

        // 同步 DOM 位置
        if (clampedLeft !== currentLeft) el.style.left = clampedLeft + 'px';
        if (clampedTop !== currentTop) el.style.top = clampedTop + 'px';

        const newPos = {
            ...(item.position || {}),
            width: width,
            height: height,
            top: clampedTop + 'px',
            left: clampedLeft + 'px',
        };
        if (this.CONFIG.useTransform) {
            newPos.scaleX = Math.round(scaleX * 100) / 100;
            newPos.scaleY = Math.round(scaleY * 100) / 100;
        } else {
            delete newPos.scaleX;
            delete newPos.scaleY;
        }

        DecoShelf.setPosition(decoId, newPos);
    },

    /** 清理缩放状态 */
    _cleanup() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._pendingUpdate = null;

        // 隐藏底部工具栏
        this._hideResizeControls();

        // 🔧 任务 3：清理控制点事件监听器
        this._removeHandleListeners();

        if (this._activeElement) {
            this._activeElement.classList.remove('deco-resizing');
            if (this._handle) {
                // 移除控制点 DOM（_removeHandleListeners 已解绑事件监听器）
                this._handle.remove();
                this._handle = null;
            }
        }

        // 🔧 任务 3：清理 document 级别监听器
        if (this._moveHandler) {
            document.removeEventListener('mousemove', this._moveHandler);
            document.removeEventListener('touchmove', this._moveHandler);
            this._moveHandler = null;
        }
        if (this._upHandler) {
            document.removeEventListener('mouseup', this._upHandler);
            document.removeEventListener('touchend', this._upHandler);
            this._upHandler = null;
        }
    },

    /** 显示底部确认/取消工具栏（参考位置编辑模式的 _showEditingControls 实现） */
    _showResizeControls() {
        // 先清理已有工具栏
        this._hideResizeControls();

        const self = this;
        const container = document.createElement('div');
        container.className = 'deco-resize-control';
        container.style.cssText =
            'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10000;';

        const btns = [
            { text: '↺ 恢复默认', cls: 'reset', action: () => {
                if (self._activeDecoId) self.resetToOriginalSize(self._activeDecoId);
            }},
            { text: '✅ 确认大小', cls: 'confirm', action: () => {
                self.exitResizeMode(true);
            }},
            { text: '❌ 取消', cls: 'cancel', action: () => {
                self.exitResizeMode(false);
            }},
        ];
        btns.forEach(b => {
            const btn = document.createElement('button');
            btn.textContent = b.text;
            btn.style.cssText =
                'background:var(--color-bg-tertiary);border:1px solid var(--color-accent);color:var(--color-text-accent);padding:6px 14px;border-radius:4px;cursor:pointer;font-family:Courier New,monospace;font-size:12px;white-space:nowrap;';
            if (b.cls === 'confirm') btn.style.background = '#2a3a1a';
            if (b.cls === 'cancel') btn.style.background = '#3a1a1a';
            btn.addEventListener('click', (e) => { e.stopPropagation(); b.action(); });
            container.appendChild(btn);
        });
        document.body.appendChild(container);
        this._resizeControls = container;
    },

    /** 隐藏底部确认/取消工具栏 */
    _hideResizeControls() {
        if (this._resizeControls) {
            this._resizeControls.remove();
            this._resizeControls = null;
        }
        // 同时清理页面上可能残留的旧工具栏（兜底）
        document.querySelectorAll('.deco-resize-control').forEach(el => el.remove());
    },
};
