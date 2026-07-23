// 自定义 DOM 滑块控制器 — 绕过浏览器 <input type=range> thumb 的内置裁切限制。
// 每实例独立：构造函数注入配置，destroy() 完整清理所有事件监听器。
// 拖拽使用偏移量跟随模式：mousedown 记录鼠标↔滑块偏移，mousemove 保持偏移量不变。
const SLIDER_MIN = 0;
const SLIDER_MAX = 110;
const ALIGN_THRESHOLD = 5;

export class PuzzleDrag {
    /**
     * @param {object} config — { canvasW, blockW, thumbW, overhang, gapX }
     */
    constructor(config = {}) {
        this._canvasW = config.canvasW || 480;
        this._blockW = config.blockW || 72;
        this._thumbW = config.thumbW || 32;
        this._overhang = config.overhang || 0;
        this._gapX = config.gapX || 0;
        this._scale = 1;
        this._minThumbX = 0;
        this._currentValue = SLIDER_MIN;

        // DOM 引用
        this._track = null;
        this._thumb = null;
        this._onChange = null;
        this._onDragEnd = null;

        // 清理引用
        this._onMove = null;
        this._onEnd = null;
        this._rafId = null;

        // 拖拽偏移（鼠标到滑块中心的距离，保证平滑跟随）
        this._dragOffset = 0;
    }

    get sliderMin() { return SLIDER_MIN; }
    get sliderMax() { return SLIDER_MAX; }
    get sliderInit() { return SLIDER_MIN; }

    setScale(s) { this._scale = s || 1; }
    setMinThumbX(x) { this._minThumbX = x; }
    setOverhang(px) { this._overhang = px || 0; this._recalcMinThumbX(); }
    setGapX(gapX) { this._gapX = gapX; }
    setCanvasW(w) { this._canvasW = w; }
    setBlockW(w) { this._blockW = w; this._recalcMinThumbX(); }

    /** 当 blockSize 或 overhang 变化时重算滑块最小 X 位置 */
    _recalcMinThumbX() {
        this._minThumbX = -this._overhang + this._blockW / 2 - this._thumbW / 2;
    }

    /**
     * @param {HTMLElement} track
     * @param {HTMLElement} thumb
     * @param {Function} onChange — (blockX, isAligned) => void
     * @param {Function} [onDragEnd] — 拖拽结束时回调（持久化用）
     */
    init(track, thumb, onChange, onDragEnd) {
        this.destroy();

        this._track = track;
        this._thumb = thumb;
        this._onChange = onChange;
        this._onDragEnd = onDragEnd || null;
        if (!track || !thumb) return;

        this._bindDrag();
        this._syncThumbToBlockX(this._mapValueToX(SLIDER_MIN));
    }

    _mapValueToX(value) {
        const ratio = (value - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN);
        const minX = -this._overhang;
        const maxX = this._canvasW - this._blockW + this._overhang;
        return minX + ratio * (maxX - minX);
    }

    _mapXToValue(centerX) {
        const minX = -this._overhang + this._blockW / 2;
        const maxX = this._canvasW - this._blockW + this._overhang + this._blockW / 2;
        const ratio = (centerX - minX) / (maxX - minX);
        return Math.round(SLIDER_MIN + ratio * (SLIDER_MAX - SLIDER_MIN));
    }

    // 注意：_bindDrag 内部使用局部函数 blockXToThumbLeft / thumbLeftToBlockX 做双向转换，
    // _setBlockX / _syncThumbToBlockX 仅由外部（reset / 初始化恢复）调用，公式需一致。

    _bindDrag() {
        const self = this;
        let dragging = false;
        let startThumbLeft = 0;
        let startMouseX = 0;

        const getClientX = (e) => (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;

        /** 将 thumb CSS left 值反算为 blockX */
        const thumbLeftToBlockX = (leftPx) => {
            return (leftPx / (self._scale || 1)) - self._blockW / 2 + self._thumbW / 2 + self._minThumbX;
        };

        /** 将 blockX 转换为 thumb CSS left，并钳制到有效范围 */
        const blockXToThumbLeft = (bx) => {
            const minX = -self._overhang;
            const maxX = self._canvasW - self._blockW + self._overhang;
            if (maxX <= minX) return 0;
            const clamped = Math.max(minX, Math.min(bx, maxX));
            return (clamped + self._blockW / 2 - self._thumbW / 2 - self._minThumbX) * (self._scale || 1);
        };

        /** 更新滑块到新位置，并通知 onChange */
        const moveThumbTo = (newLeft) => {
            if (!self._thumb) return;
            // 根据 left 值反算 blockX，再通过 blockXToThumbLeft 做钳制
            const rawBlockX = thumbLeftToBlockX(newLeft);
            const clampedLeft = blockXToThumbLeft(rawBlockX);
            const clampedBlockX = thumbLeftToBlockX(clampedLeft);

            self._thumb.style.left = clampedLeft + 'px';
            self._currentValue = Math.round(
                SLIDER_MIN + ((clampedBlockX + self._overhang) / (self._canvasW - self._blockW + 2 * self._overhang)) * (SLIDER_MAX - SLIDER_MIN)
            );
            self._currentValue = Math.max(SLIDER_MIN, Math.min(self._currentValue, SLIDER_MAX));
            const isAligned = Math.abs(clampedBlockX - self._gapX) < ALIGN_THRESHOLD;

            try {
                if (self._onChange) self._onChange(clampedBlockX, isAligned);
            } catch (e) {
                console.warn('[PuzzleDrag] onChange 异常:', e);
            }
        };

        const onStart = (e) => {
            e.preventDefault();
            dragging = true;
            startThumbLeft = self._thumb ? parseFloat(self._thumb.style.left) || 0 : 0;
            startMouseX = getClientX(e);
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
            if (self._thumb) self._thumb.classList.add('puzzle-slider-thumb-active');
        };

        const onMove = (e) => {
            if (!dragging || !self._thumb) return;
            const dx = getClientX(e) - startMouseX;
            const newLeft = startThumbLeft + dx / (self._scale || 1);
            moveThumbTo(newLeft);
        };

        const onEnd = () => {
            if (!dragging) return;
            dragging = false;
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
            if (self._thumb) self._thumb.classList.remove('puzzle-slider-thumb-active');
            if (self._onDragEnd) {
                try { self._onDragEnd(); } catch (e) { /* silent */ }
            }
        };

        // thumb 拖拽
        if (this._thumb) {
            const thumbStart = (e) => {
                e.stopPropagation();
                onStart(e);
            };
            this._thumb.addEventListener('mousedown', thumbStart);
            this._thumb.addEventListener('touchstart', thumbStart, { passive: false });
        }

        // 点击轨道空白区域：直接跳到点击位置
        if (this._track) {
            this._track.addEventListener('mousedown', (e) => {
                if (e.target === self._thumb) return;
                e.preventDefault();
                const trackRect = self._track.getBoundingClientRect();
                const clickX = getClientX(e) - trackRect.left;
                // 鼠标在 track 中的位置 → 滑块中心应对齐此处
                const newLeft = clickX - self._thumbW / 2;
                moveThumbTo(newLeft);
                onStart(e);
            });
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);

        this._onMove = onMove;
        this._onEnd = onEnd;
    }

    _setBlockX(blockX) {
        const minX = -this._overhang;
        const maxX = this._canvasW - this._blockW + this._overhang;
        const range = maxX - minX;
        if (range <= 0) return;

        const ratio = (blockX - minX) / range;
        const value = Math.round(SLIDER_MIN + ratio * (SLIDER_MAX - SLIDER_MIN));
        const clamped = Math.max(SLIDER_MIN, Math.min(value, SLIDER_MAX));
        const clampedBlockX = minX + ((clamped - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * range;

        if (this._thumb) {
            this._thumb.style.left =
                ((clampedBlockX + this._blockW / 2 - this._thumbW / 2 - this._minThumbX) * this._scale) + 'px';
        }

        this._currentValue = clamped;
        const isAligned = Math.abs(clampedBlockX - this._gapX) < ALIGN_THRESHOLD;

        try {
            if (this._onChange) this._onChange(clampedBlockX, isAligned);
        } catch (e) {
            console.warn('[PuzzleDrag] onChange 异常:', e);
        }
    }

    _syncThumbToBlockX(blockX) {
        if (!this._thumb) return;
        this._thumb.style.left =
            ((blockX + this._blockW / 2 - this._thumbW / 2 - this._minThumbX) * this._scale) + 'px';
    }

    reset() {
        this._setBlockX(this._mapValueToX(SLIDER_MIN));
    }

    destroy() {
        if (this._onMove) {
            document.removeEventListener('mousemove', this._onMove);
            document.removeEventListener('touchmove', this._onMove);
        }
        if (this._onEnd) {
            document.removeEventListener('mouseup', this._onEnd);
            document.removeEventListener('touchend', this._onEnd);
        }
        this._track = null;
        this._thumb = null;
        this._onChange = null;
        this._onDragEnd = null;
        this._onMove = null;
        this._onEnd = null;
        this._dragOffset = 0;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }
}
