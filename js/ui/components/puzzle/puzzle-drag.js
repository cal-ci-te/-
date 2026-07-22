// 自定义滑块：纯 DOM 实现，绕过浏览器对 <input type=range> thumb 的内置裁切限制。
// track + thumb 均为普通 div，overflow 完全受 CSS 控制。
const SLIDER_MIN = 0;
const SLIDER_MAX = 110;
const BLOCK_W = 72;
const CANVAS_W = 480;
const ALIGN_THRESHOLD = 5;

export const PuzzleDrag = {
    _track: null,
    _thumb: null,
    _onChange: null,
    _gapX: 0,
    _overhang: 0,
    _scale: 1,                   // Canvas CSS 缩放比（移动端 <1），DOM 定位时乘以此值

    /** 注入 CSS 缩放比，thumb/block 定位需与 Canvas CSS 显示尺寸一致 */
    setScale(s) { this._scale = s || 1; },

    get sliderMin() { return SLIDER_MIN; },
    get sliderMax() { return SLIDER_MAX; },
    get sliderInit() { return SLIDER_MIN; },

    /**
     * @param {HTMLElement} track    — 滑块轨道元素
     * @param {HTMLElement} thumb    — 滑块拖拽柄元素
     * @param {Function} onChange    — (blockX, isAligned) => void
     */
    init(track, thumb, onChange) {
        // 清理旧监听器（防止重复 init 导致 stale listener 叠加）
        this.destroy();

        this._track = track;
        this._thumb = thumb;
        this._onChange = onChange;
        if (!track || !thumb) return;

        this._bindDrag();
        this._syncThumbToBlockX(this._mapValueToX(SLIDER_MIN));
        console.log('[PuzzleDrag] 自定义滑块就绪 — track:', track.clientWidth + 'x' + track.clientHeight, ' thumb:', thumb.clientWidth + 'x' + thumb.clientHeight);
    },

    /** 由外部注入拼图块的溢出距离（px），滑块同步溢出相同距离 */
    setOverhang(px) {
        this._overhang = px || 0;
    },

    setGapX(gapX) { this._gapX = gapX; },

    /** 滑块值 → 拼图块 X 坐标 */
    _mapValueToX(value) {
        const ratio = (value - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN);
        const minX = -this._overhang;
        const maxX = CANVAS_W - BLOCK_W + this._overhang;
        return minX + ratio * (maxX - minX);
    },

    /** 视觉坐标（拼图块中心 X）→ 滑块值 */
    _mapXToValue(centerX) {
        const minX = -this._overhang + BLOCK_W / 2;
        const maxX = CANVAS_W - BLOCK_W + this._overhang + BLOCK_W / 2;
        const ratio = (centerX - minX) / (maxX - minX);
        return Math.round(SLIDER_MIN + ratio * (SLIDER_MAX - SLIDER_MIN));
    },

    _bindDrag() {
        const self = this;
        let dragging = false;

        const getClientX = (e) => (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;

        const onStart = (e) => {
            e.preventDefault();  // 阻止拖拽时触发文字选中
            dragging = true;
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
            if (self._thumb) self._thumb.classList.add('puzzle-slider-thumb-active');
        };

        const onMove = (e) => {
            if (!dragging || !self._track) return;
            const r = self._track.getBoundingClientRect();
            if (!r.width) return;
            const tx = getClientX(e) - r.left;
            const blockX = tx - BLOCK_W / 2;
            self._setBlockX(blockX);
        };

        const onEnd = () => {
            dragging = false;
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
            if (self._thumb) self._thumb.classList.remove('puzzle-slider-thumb-active');
        };

        this._thumb.addEventListener('mousedown', onStart);
        this._thumb.addEventListener('touchstart', onStart, { passive: false });
        this._track.addEventListener('mousedown', (e) => {
            const r = self._track.getBoundingClientRect();
            if (!r.width) return;
            const tx = e.clientX - r.left;
            const blockX = tx - BLOCK_W / 2;
            self._setBlockX(blockX);
            onStart(e);
        });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);

        this._onMove = onMove;
        this._onEnd = onEnd;
    },

    /** 由 blockX 反推滑块值，更新 thumb 位置 + 触发回调 */
    _setBlockX(blockX) {
        const minX = -this._overhang;
        const maxX = CANVAS_W - BLOCK_W + this._overhang;
        const range = maxX - minX;
        if (range <= 0) return;
        const ratio = (blockX - minX) / range;
        const value = Math.round(SLIDER_MIN + ratio * (SLIDER_MAX - SLIDER_MIN));
        const clamped = Math.max(SLIDER_MIN, Math.min(value, SLIDER_MAX));
        const clampedBlockX = minX + ((clamped - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * range;
        this._thumb.style.left = (clampedBlockX * this._scale) + 'px';
        this._currentValue = clamped;
        const isAligned = Math.abs(clampedBlockX - this._gapX) < ALIGN_THRESHOLD;
        try { if (this._onChange) this._onChange(clampedBlockX, isAligned); } catch (e) { console.warn('[PuzzleDrag] onChange 异常:', e); }
    },

    /** 初始化时按 blockX 定位 thumb（直接共用 blockX，保持溢出效果） */
    _syncThumbToBlockX(blockX) {
        if (!this._thumb) return;
        this._thumb.style.left = (blockX * this._scale) + 'px';
    },

    reset() {
        this._setBlockX(this._mapValueToX(SLIDER_MIN));
    },

    destroy() {
        if (this._onMove) { document.removeEventListener('mousemove', this._onMove); document.removeEventListener('touchmove', this._onMove); }
        if (this._onEnd)  { document.removeEventListener('mouseup', this._onEnd); document.removeEventListener('touchend', this._onEnd); }
        this._track = null;
        this._thumb = null;
        this._onChange = null;
        this._onMove = null;
        this._onEnd = null;
    },
};
