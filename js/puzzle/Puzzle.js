// 滑动拼图主控类 — 组装 State / Renderer / Drag / Storage，管理完整生命周期。
// 支持多实例独立运行，配置驱动尺寸/位置/溢出，依赖注入（theme/storage 可替换）。
import { PuzzleState } from './core/PuzzleState.js';
import { PuzzleRenderer } from './core/PuzzleRenderer.js';
import { PuzzleDrag } from './core/PuzzleDrag.js';
import { StorageAdapter } from './StorageAdapter.js';

const THUMB_W = 32;
const GAP_RADIUS = 8;

export class Puzzle {
    /**
     * @param {object} options
     * @param {number}  [options.width=480]
     * @param {number}  [options.height=180]
     * @param {number}  [options.blockSize=72]
     * @param {number}  [options.overhang=200]
     * @param {object|null} [options.position=null] — { x, y } | null = 流式模式
     * @param {string}  [options.image] — dataUrl
     * @param {string}  [options.storageKey='rv_puzzle_state']
     * @param {boolean} [options.autoSave=true]
     * @param {object}  [options.theme] — { getPuzzleBackground(): string }，默认注入 ThemeService
     * @param {object}  [options.storage] — 存储后端，默认 localStorage
     * @param {string}  [options.mountPoint] — CSS 选择器或元素，流式模式挂载点
     * @param {string}  [options.insertPosition='beforeend'] — insertAdjacentElement 位置
     * @param {object}  [options.uiStrings] — 自定义文案，默认 UI.puzzle
     */
    constructor(options = {}) {
        this._opts = options;

        // ---- 页面边界校验 ----
        this._validateBounds();

        // ---- 内部组件（仅传递已定义的值，避免 undefined 覆盖默认值）----
        this._state = new PuzzleState(this._pickDefined({
            width: options.width,
            height: options.height,
            blockSize: options.blockSize,
            overhang: options.overhang,
            position: options.position,
            image: options.image,
            storageKey: options.storageKey,
            autoSave: options.autoSave !== false,
        }));

        this._renderer = new PuzzleRenderer({
            width: this._state.getConfig().width,
            height: this._state.getConfig().height,
            blockSize: this._state.getConfig().blockSize,
            gapRadius: GAP_RADIUS,
        });

        this._drag = new PuzzleDrag({
            canvasW: this._state.getConfig().width,
            blockW: this._state.getConfig().blockSize,
            thumbW: THUMB_W,
            overhang: this._state.getConfig().overhang,
        });

        this._storage = new StorageAdapter({
            storageKey: options.storageKey || 'rv_puzzle_state',
            backend: options.storage || (typeof localStorage !== 'undefined' ? localStorage : null),
        });

        // 外部依赖注入（theme 需提供 getPuzzleBackground() 方法）
        this._themeProvider = options.theme || null;
        this._mountPoint = options.mountPoint || null;
        this._insertPos = options.insertPosition || 'beforeend';
        this._strings = options.uiStrings || null;

        // ---- 运行时状态 ----
        this._widget = null;
        this._slider = null;
        this._canvas = null;
        this._block = null;
        this._flash = null;
        this._hint = null;
        this._thumb = null;
        this._track = null;
        this._wrapper = null;
        this._rafId = null;
        this._resizeHandler = null;
        this._flashTimer = null;
        this._destroyed = false;
    }

    // ========================
    //  公开 API
    // ========================

    /** 初始化：创建 DOM → 绑定交互 → 渲染 → 监听状态 */
    init() {
        if (this._destroyed) {
            console.warn('[Puzzle] 已销毁，不能重新初始化');
            return this;
        }

        // 移动端：彻底禁用拼图功能
        if (this._isMobile()) {
            console.log('[Puzzle] 移动端，跳过拼图初始化');
            return this;
        }

        console.log('[Puzzle] 开始初始化…');

        // 从存储恢复
        if (this._state.getConfig().autoSave) {
            const saved = this._storage.load();
            if (saved) {
                console.log('[Puzzle] 从 localStorage 恢复状态, config:', JSON.stringify(saved.config));
                this._state.importState(saved);
                const cfg = this._state.getConfig();
                if (!cfg.position) {
                    this._state.setPosition(525, 450);
                }
                this._renderer.updateSize(cfg.width, cfg.height);
                this._renderer.setBlockSize(cfg.blockSize);   // 同步块大小到渲染器
                this._drag.setCanvasW(cfg.width);
                this._drag.setBlockW(cfg.blockSize);           // 同步块大小到拖拽模块
                this._drag.setOverhang(cfg.overhang);
            }
        }

        // 注册图片异步加载完成后的重绘回调
        this._renderer._onRedraw = () => {
            if (!this._destroyed && this._canvas) this._render();
        };

        this._buildDOM();
        console.log('[Puzzle] DOM 已构建 — widget:', !!this._widget, 'canvas:', !!this._canvas,
            'track:', !!this._track, 'thumb:', !!this._thumb);

        this._bindDrag();
        console.log('[Puzzle] 拖拽已绑定 — gapX:', this._renderer.gapX);

        this._bindStateListeners();
        this._render();
        console.log('[Puzzle] 首帧已渲染 — gapX:', this._renderer.gapX,
            'image:', !!this._state.getImage(), 'completed:', this._state.isCompleted());

        this._drag.setGapX(this._renderer.gapX);
        this._drag.reset();

        if (typeof window !== 'undefined') {
            window.__puzzleInstance = this;
        }

        this._state.emit('ready');

        const cfg = this._state.getConfig();
        console.log('[Puzzle] 初始化完成 —', cfg.width + '×' + cfg.height,
            cfg.position ? '坐标模式' : '流式模式');
        return this;
    }

    render() {
        this._render();
        return this;
    }

    reset() {
        this._renderer.resetGap();
        this._drag.setGapX(this._renderer.gapX);
        this._drag.reset();
        this._state.setCompleted(false);
        if (this._flash) this._flash.classList.remove('puzzle-flash-active');
        if (this._hint && this._strings) this._hint.textContent = this._strings.hint || '拖动滑块完成拼图';
        this._render();
        return this;
    }

    destroy() {
        if (this._destroyed) return this;
        this._destroyed = true;

        this._drag.destroy();
        this._renderer.destroy();
        this._state.destroy();

        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }
        if (this._flashTimer) {
            clearTimeout(this._flashTimer);
            this._flashTimer = null;
        }
        if (this._dragHandleCleanup) {
            this._dragHandleCleanup();
            this._dragHandleCleanup = null;
        }

        // 清理 DOM
        if (this._widget && this._widget.parentNode) this._widget.parentNode.removeChild(this._widget);
        if (this._slider && this._slider.parentNode) this._slider.parentNode.removeChild(this._slider);
        if (this._wrapper && this._wrapper.parentNode) this._wrapper.parentNode.removeChild(this._wrapper);

        if (typeof window !== 'undefined' && window.__puzzleInstance === this) {
            delete window.__puzzleInstance;
        }

        console.log('[Puzzle] 已销毁');
        return this;
    }

    // ---- 配置更新 ----
    setSize(width, height) {
        this._validateSize(width, height);
        this._state.setSize(width, height);
        this._renderer.updateSize(width, height);
        this._drag.setCanvasW(width);
        this._drag.setGapX(this._renderer.gapX);
        if (this._canvas) {
            this._canvas.width = width;
            this._canvas.height = height;
            // 同步 CSS 显示尺寸，避免 Canvas CSS 与内部分辨率宽高比不一致
            const wrapper = this._canvas.parentElement;
            const maxW = wrapper ? wrapper.clientWidth : window.innerWidth;
            if (maxW < width) {
                const s = maxW / width;
                this._canvas.style.width = maxW + 'px';
                this._canvas.style.height = (height * s) + 'px';
            } else {
                this._canvas.style.width = width + 'px';
                this._canvas.style.height = height + 'px';
            }
            this._drag.setScale((this._canvas.clientWidth / width) || 1);
        }
        this._updateTrackLayout();   // 画布宽度变化时轨道宽度同步更新
        this._render();
        return this;
    }

    setOverhang(px) {
        this._state.setOverhang(px);
        this._drag.setOverhang(px);
        this._drag.setGapX(this._renderer.gapX);
        return this;
    }

    setPosition(x, y) {
        if (x === null || y === null) {
            this._state.setPosition(null, null);
            return this;
        }
        const bounds = this._getPositionBounds();
        const cx = Math.max(bounds.minX, Math.min(x, bounds.maxX));
        const cy = Math.max(bounds.minY, Math.min(y, bounds.maxY));
        this._state.setPosition(cx, cy);
        if (this._widget) {
            this._widget.style.left = cx + 'px';
            this._widget.style.top = cy + 'px';
        }
        return this;
    }

    updateConfig(partial) {
        if (partial.width !== undefined || partial.height !== undefined) {
            this.setSize(
                partial.width ?? this._state.getConfig().width,
                partial.height ?? this._state.getConfig().height
            );
        }
        if (partial.overhang !== undefined) {
            this.setOverhang(partial.overhang);
            this._updateTrackLayout();
        }
        if (partial.blockSize !== undefined) {
            this._state.updateConfig({ blockSize: partial.blockSize });
            this._renderer.setBlockSize(partial.blockSize);
            this._drag.setBlockW(partial.blockSize);
            this._drag.setGapX(this._renderer.gapX);
            this._updateTrackLayout();
        }
        return this;
    }

    /** 更新滑块轨道 DOM 宽度（blockSize/overhang 变化后调用） */
    _updateTrackLayout() {
        if (!this._track) return;
        const config = this._state.getConfig();
        const { width, blockSize, overhang } = config;
        const THUMB_W = 32;
        const minThumbX = -overhang + blockSize / 2 - THUMB_W / 2;
        const maxThumbX = width - blockSize + overhang + blockSize / 2 + THUMB_W / 2;
        this._track.style.width = (maxThumbX - minThumbX) + 'px';
    }

    // ---- 图片 ----
    setImage(dataUrl) {
        this._state.setImage(dataUrl);
        this._drag.reset();
        this._render();
        return this;
    }

    // ---- 事件监听 ----
    on(event, cb)   { this._state.on(event, cb); return this; }
    off(event, cb)  { this._state.off(event, cb); return this; }
    once(event, cb) { this._state.once(event, cb); return this; }

    // ---- 存储 ----
    save() {
        const data = this._state.exportState();
        data.sliderValue = this._drag._currentValue;
        this._storage.save(data);
        return this;
    }

    load() {
        const data = this._storage.load();
        if (data) {
            this.importState(data);      // Puzzle 层 importState：同步 blockSize 到 renderer + drag
            this._drag.reset();          // 滑块归零
        }
        return this;
    }

    exportState() { return this._state.exportState(); }
    importState(data) {
        this._state.importState(data);
        // 同步块大小到渲染器和拖拽模块（PuzzleState.importState 仅更新 state，不通知外层）
        const cfg = this._state.getConfig();
        if (cfg.blockSize !== undefined) {
            this._renderer.setBlockSize(cfg.blockSize);
            this._drag.setBlockW(cfg.blockSize);
            this._drag.setGapX(this._renderer.gapX);
        }
        this._render();
        return this;
    }

    // ---- 状态查询 ----
    isCompleted()    { return this._state.isCompleted(); }
    getProgress()    { return this._state.getProgress(); }
    getConfig()      { return this._state.getConfig(); }
    getImage()       { return this._state.getImage(); }

    // ========================
    //  内部方法
    // ========================

    /** 过滤掉值为 undefined 的键，避免对象展开时覆盖默认值 */
    _pickDefined(obj) {
        const result = {};
        for (const key of Object.keys(obj)) {
            if (obj[key] !== undefined) result[key] = obj[key];
        }
        return result;
    }

    /** 绑定拼图整体拖拽（坐标模式下移动 widget 位置） */
    _bindWidgetDrag(handle) {
        let dragging = false, startX, startY, origLeft, origTop;

        const getClientX = (e) => (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
        const getClientY = (e) => (e.touches && e.touches.length) ? e.touches[0].clientY : e.clientY;

        const onStart = (e) => {
            // 仅响应拖拽手柄元素本身的点击，防止滑块事件冒泡干扰
            if (e.target !== handle && !handle.contains(e.target)) return;
            if (e.button !== undefined && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            dragging = true;
            startX = getClientX(e);
            startY = getClientY(e);
            // 用 CSS 属性值（包含块坐标系），禁止 getBoundingClientRect（视口坐标含 scroll 偏移）
            origLeft = parseFloat(this._widget.style.left) || 0;
            origTop  = parseFloat(this._widget.style.top)  || 0;
            handle.classList.add('puzzle-drag-handle-active');
            document.body.style.userSelect = 'none';
        };

        const onMove = (e) => {
            if (!dragging) return;
            const dx = getClientX(e) - startX;
            const dy = getClientY(e) - startY;
            if (this._widget) {
                this._widget.style.left = (origLeft + dx) + 'px';
                this._widget.style.top  = (origTop  + dy) + 'px';
                this._widget.style.transition = '';
            }
        };

        const onEnd = () => {
            if (!dragging) return;
            dragging = false;
            document.body.style.userSelect = '';
            handle.classList.remove('puzzle-drag-handle-active');
            // 用 CSS 属性值做最终钳制（与 onStart 坐标系一致）
            if (this._widget) {
                const currentLeft = parseFloat(this._widget.style.left) || 0;
                const currentTop  = parseFloat(this._widget.style.top)  || 0;
                const bounds = this._getPositionBounds();
                const cx = Math.max(bounds.minX, Math.min(currentLeft, bounds.maxX));
                const cy = Math.max(bounds.minY, Math.min(currentTop,  bounds.maxY));
                this._state.setPosition(cx, cy);
                this._widget.style.left = cx + 'px';
                this._widget.style.top  = cy + 'px';
                this.save();
            }
        };

        handle.addEventListener('mousedown', onStart);
        handle.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);

        // 保存引用以便 destroy 时清理
        this._dragHandleCleanup = () => {
            handle.removeEventListener('mousedown', onStart);
            handle.removeEventListener('touchstart', onStart);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };
    }

    _isMobile() {
        return typeof window !== 'undefined' && window.innerWidth <= 600;
    }

    /** 计算拼图可移动范围：仅横向限制（竖向自由移动） */
    _getPositionBounds() {
        if (typeof window === 'undefined') return { minX: 8, minY: -9999, maxX: 10000, maxY: 99999 };
        const config = this._state.getConfig();
        const widgetW = config.width + 20;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const minX = 8;

        return {
            minX,
            minY: -vh,        // 竖向不做实质限制，仅防止远离视口
            maxX: Math.max(minX + 100, vw - widgetW - 8),
            maxY: vh * 3,     // 竖向不做实质限制
        };
    }

    _getElementBottom(selector) {
        try {
            const el = document.querySelector(selector);
            if (!el) return null;
            return el.getBoundingClientRect().bottom + window.scrollY;
        } catch (e) { return null; }
    }

    _getElementTop(selector) {
        try {
            const el = document.querySelector(selector);
            if (!el) return null;
            return el.getBoundingClientRect().top + window.scrollY;
        } catch (e) { return null; }
    }

    _validateBounds() {
        const w = this._opts.width || 480;
        const h = this._opts.height || 180;
        if (typeof w !== 'number' || typeof h !== 'number' || isNaN(w) || isNaN(h)) {
            throw new Error('[Puzzle] width 和 height 必须是有效数字');
        }
        if (typeof window === 'undefined') return; // SSR 跳过
        if (this._isMobile()) return;                  // 移动端 init() 会等比缩小

        const maxW = window.innerWidth - 40;
        const maxH = window.innerHeight - 100;
        if (w > maxW || h > maxH) {
            throw new Error(
                `[Puzzle] 尺寸 ${w}×${h}px 超出页面可用范围（最大 ${maxW}×${maxH}px）`
            );
        }
    }

    _validateSize(width, height) {
        if (typeof width !== 'number' || typeof height !== 'number' || isNaN(width) || isNaN(height)) {
            throw new Error('[Puzzle] setSize 参数必须是有效数字');
        }
        if (typeof window === 'undefined') return;
        if (this._isMobile()) return;                  // 移动端 init() 会等比缩小
        const maxW = window.innerWidth - 40;
        const maxH = window.innerHeight - 100;
        if (width > maxW || height > maxH) {
            throw new Error(
                `[Puzzle] 尺寸 ${width}×${height}px 超出页面可用范围（最大 ${maxW}×${maxH}px）`
            );
        }
    }

    /** 获取背景色（优先注入的 theme，否则用缺省 #1a1612） */
    _getBgColor() {
        if (this._themeProvider && typeof this._themeProvider.getPuzzleBackground === 'function') {
            return this._themeProvider.getPuzzleBackground();
        }
        return '#1a1612';
    }

    /** 获取 UI 文案 */
    _str(key, fallback) {
        if (this._strings && this._strings[key]) return this._strings[key];
        return fallback || '';
    }

    /** 构建 DOM 结构 */
    _buildDOM() {
        const config = this._state.getConfig();
        const pos = config.position;
        const { width, height } = config;

        // ---- widget 容器 ----
        const widget = document.createElement('div');
        widget.id = 'puzzleWidget';
        widget.className = 'puzzle-widget';
        widget.innerHTML = `
            <div class="puzzle-header">
                <span class="puzzle-drag-handle" title="拖拽移动拼图">⠿</span>
                <span class="puzzle-title">${this._str('widgetTitle', '确认您是真人！')}</span>
                <button id="puzzleResetBtn" class="puzzle-reset-btn" title="重置拼图">🔄</button>
            </div>
            <div class="puzzle-canvas-wrapper">
                <canvas id="puzzleCanvas" width="${width}" height="${height}"></canvas>
                <div id="puzzleBlock" class="puzzle-block"></div>
                <div id="puzzleFlash" class="puzzle-flash"></div>
            </div>`;

        // ---- 滑块 ----
        const slider = document.createElement('div');
        slider.id = 'puzzleSlider';
        slider.className = 'puzzle-slider';
        slider.innerHTML = `
            <div id="puzzleTrack" class="puzzle-track">
                <div id="puzzleThumb" class="puzzle-thumb"></div>
            </div>
            <div id="puzzleHint" class="puzzle-hint">${this._str('hint', '拖动滑块完成拼图——如果你想')}</div>`;

        // ---- 插入 DOM ----
        const target = this._resolveMountPoint();

        if (!pos) {
            // 流式模式
            const wrapper = document.createElement('div');
            wrapper.className = 'puzzle-wrapper';
            wrapper.style.position = 'relative';
            wrapper.appendChild(widget);
            wrapper.appendChild(slider);
            slider.style.position = 'absolute';
            target.insertAdjacentElement(this._insertPos, wrapper);
            this._wrapper = wrapper;
        } else {
            // 坐标模式：slider 作为 widget 子元素，随拼图整体移动
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const w = Math.min(width + 20, vw - 16);
            const h = Math.min(height + 160, vh - 16);
            const bounds = this._getPositionBounds();
            const x = Math.max(bounds.minX, Math.min(pos.x, bounds.maxX));
            const y = Math.max(bounds.minY, Math.min(pos.y, bounds.maxY));

            widget.style.position = 'absolute';
            widget.style.left = x + 'px';
            widget.style.top = y + 'px';
            widget.style.maxWidth = (vw - 16) + 'px';
            widget.style.margin = '0';
            widget.style.zIndex = '90';
            // slider 嵌入 widget，随 widget 一起移动
            slider.style.position = 'absolute';
            slider.style.zIndex = '91';
            widget.appendChild(slider);
            document.body.appendChild(widget);
        }

        this._widget = widget;
        this._slider = slider;

        // 缓存 DOM 引用
        this._canvas = widget.querySelector('#puzzleCanvas');
        this._block = widget.querySelector('#puzzleBlock');
        this._flash = widget.querySelector('#puzzleFlash');
        this._track = slider.querySelector('#puzzleTrack');
        this._thumb = slider.querySelector('#puzzleThumb');
        this._hint = slider.querySelector('#puzzleHint');

        // ---- 拼图块异形裁剪 + 扩展尺寸（容纳凸起）----
        if (this._block) {
            const shape = this._renderer.getBlockShape();
            this._block.style.width  = shape.w + 'px';
            this._block.style.height = shape.h + 'px';
            this._block.style.clipPath = shape.clipPath;
            this._block.style.webkitClipPath = shape.clipPath;
        }

        // 重置按钮
        const resetBtn = widget.querySelector('#puzzleResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }

        // 拖拽手柄（仅坐标模式下可拖动整体拼图位置）
        const dragHandle = widget.querySelector('.puzzle-drag-handle');
        if (dragHandle && config.position) {
            this._bindWidgetDrag(dragHandle);
        }
    }

    _resolveMountPoint() {
        if (this._mountPoint) {
            if (typeof this._mountPoint === 'string') {
                return document.querySelector(this._mountPoint) || document.body;
            }
            return this._mountPoint;
        }
        return document.body;
    }

    /** 绑定滑块交互 */
    _bindDrag() {
        if (!this._canvas || !this._track || !this._thumb) return;

        const config = this._state.getConfig();
        const { width, blockSize, overhang } = config;

        // Canvas 缩放
        const scaleCanvas = () => {
            const wrapper = this._canvas.parentElement;
            const maxW = wrapper ? wrapper.clientWidth : window.innerWidth;
            if (maxW < width) {
                const s = maxW / width;
                this._canvas.style.width = maxW + 'px';
                this._canvas.style.height = (config.height * s) + 'px';
            } else {
                this._canvas.style.width = width + 'px';
                this._canvas.style.height = config.height + 'px';
            }
            const s = (this._canvas.clientWidth / width) || 1;
            this._drag.setScale(s);
        };
        scaleCanvas();

        // 滑块定位：slider 是 widget 子元素，定位于 canvas 正下方
        const positionSlider = () => {
            const cRect = this._canvas.getBoundingClientRect();
            const wRect = this._widget.getBoundingClientRect();
            const overhangVal = overhang;
            const minThumbX = -overhangVal + blockSize / 2 - THUMB_W / 2;
            const maxThumbX = width - blockSize + overhangVal + blockSize / 2 + THUMB_W / 2;
            const trackW = maxThumbX - minThumbX;

            // slider 相对于 widget 定位：水平对齐 canvas，垂直在 canvas 下方 12px
            this._slider.style.position = 'absolute';
            this._slider.style.left = (cRect.left - wRect.left + minThumbX) + 'px';
            this._slider.style.top = (cRect.bottom - wRect.top + 12) + 'px';
            this._slider.style.zIndex = '91';
            this._track.style.width = trackW + 'px';

            this._drag.setMinThumbX(minThumbX);
        };
        positionSlider();

        // Resize 监听
        this._resizeHandler = () => { scaleCanvas(); positionSlider(); };
        window.addEventListener('resize', this._resizeHandler);

        // 初始化 Drag（gapX 由 render 后同步，此处不预设）
        this._drag.setOverhang(overhang);
        this._drag.init(this._track, this._thumb, (blockX, isAligned) => {
            if (!this._drag._rafId) {
                this._drag._rafId = requestAnimationFrame(() => {
                    this._render(blockX);
                    this._drag._rafId = null;
                });
            }
            if (isAligned && !this._state.isCompleted()) {
                this._state.setCompleted(true);
                this._triggerFlash();
                if (this._hint && this._strings) this._hint.textContent = this._str('completed', '✨ 拼图完成！');
            } else if (!isAligned && this._state.isCompleted()) {
                this._state.setCompleted(false);
                if (this._hint && this._strings) this._hint.textContent = this._str('hint', '拖动滑块完成拼图——如果你想');
            }
        }, () => {
            // 拖拽结束时持久化滑块位置
            this.save();
        });
    }

    /** 绑定内部状态变更监听 */
    _bindStateListeners() {
        this._state.on('image:changed', () => {
            this._drag.reset();
            this._render();
            if (this._state.getConfig().autoSave) this.save();
        });

        this._state.on('config:changed', () => {
            this._render();
        });
    }

    /** 核心渲染 */
    _render(blockXOverride) {
        if (!this._canvas) return;

        const ctx = this._canvas.getContext('2d');
        const imageSrc = this._state.getImage();
        const bgColor = this._getBgColor();
        const completed = this._state.isCompleted();
        const config = this._state.getConfig();
        const gapY = this._renderer.gapY;   // 直接取自 renderer，确保与 Canvas 缺口位置一致
        // 独立 X/Y 缩放：Canvas CSS 尺寸可能因 max-width 或 setSize 未调 scaleCanvas 而偏离内部分辨率
        const scaleX = (this._canvas.clientWidth / config.width) || 1;
        const scaleY = (this._canvas.clientHeight / config.height) || 1;

        // Canvas 绘制
        this._renderer.render(ctx, imageSrc, bgColor);

        // DOM 拼图块
        if (this._block) {
            const blockX = blockXOverride !== undefined
                ? blockXOverride
                : this._drag._mapValueToX
                    ? this._drag._mapValueToX(this._drag._currentValue || 0)
                    : 0;

            // 块扩展了 tabR 以容纳凸起，位置需向负方向偏移
            const shape = this._renderer.getBlockShape();
            const tabR = shape.tabR;
            // 尺寸和位置统一使用独立 X/Y 缩放，确保 Canvas CSS≠内部尺寸时块与缺口同步
            this._block.style.width  = (shape.w * scaleX) + 'px';
            this._block.style.height = (shape.h * scaleY) + 'px';
            this._block.style.clipPath = shape.clipPath;
            this._block.style.webkitClipPath = shape.clipPath;
            this._block.style.left = ((blockX - tabR) * scaleX) + 'px';
            this._block.style.top  = ((gapY - tabR) * scaleY) + 'px';

            if (imageSrc) {
                const info = this._renderer.getImageInfo();
                const gapX = this._renderer.gapX;
                if (info) {
                    this._block.style.backgroundImage = 'url(' + imageSrc + ')';
                    this._block.style.backgroundSize = (info.sw * scaleX) + 'px ' + (info.sh * scaleY) + 'px';
                    this._block.style.backgroundPosition =
                        ((info.sx - gapX + tabR) * scaleX) + 'px ' + ((info.sy - gapY + tabR) * scaleY) + 'px';
                    this._block.style.backgroundColor = 'transparent';
                } else {
                    this._block.style.backgroundImage = '';
                    this._block.style.backgroundColor = this._renderer.lighten(bgColor, 0.15);
                }
            } else {
                this._block.style.backgroundImage = '';
                this._block.style.backgroundColor = this._renderer.lighten(bgColor, 0.15);
            }
            this._block.classList.toggle('puzzle-block-aligned', completed);
        }
    }

    _triggerFlash() {
        if (!this._flash) return;
        this._flash.classList.remove('puzzle-flash-active');
        void this._flash.offsetWidth;
        this._flash.classList.add('puzzle-flash-active');
        if (this._flashTimer) clearTimeout(this._flashTimer);
        this._flashTimer = setTimeout(() => {
            if (this._flash) this._flash.classList.remove('puzzle-flash-active');
            this._flashTimer = null;
        }, 650);
    }
}

// ========================
//  向后兼容的工厂函数
// ========================

/**
 * 兼容旧版 initPuzzle() 调用：
 *   initPuzzle({ x: 525, y: 450 })
 *   initPuzzle('.hero-section', 'afterend')
 *
 * 通过动态 import() 注入全局 AppState / ThemeService / UI 文案，
 * 保持与管理面板的图片上传、状态同步功能兼容。
 */
export async function initPuzzle(arg1, arg2) {
    const opts = {};

    if (typeof arg1 === 'object' && arg1 !== null) {
        if (arg1.x !== undefined || arg1.y !== undefined) {
            opts.position = { x: arg1.x ?? 200, y: arg1.y ?? 400 };
        }
        if (arg1.mountPoint) opts.mountPoint = arg1.mountPoint;
        if (arg1.insertPosition) opts.insertPosition = arg1.insertPosition;
    } else if (typeof arg1 === 'string') {
        opts.mountPoint = arg1;
        if (arg2) opts.insertPosition = arg2;
    }

    // 动态注入全局依赖（ES Module 兼容，失败静默降级为纯 Puzzle 实例）
    let AppState = null, MUTATIONS = null, ThemeService = null, UI = null;
    try { ({ AppState } = await import('../core/app-state.js')); } catch (e) { /* 无 AppState */ }
    try { ({ MUTATIONS } = await import('../core/state-mutations.js')); } catch (e) { /* 无 MUTATIONS */ }
    try { ({ ThemeService } = await import('../services/theme-service.js')); } catch (e) { /* 无 ThemeService */ }
    try { ({ UI } = await import('../utils/ui-strings.js')); } catch (e) { /* 无 UI */ }

    if (ThemeService) opts.theme = ThemeService;
    if (UI && UI.puzzle) opts.uiStrings = UI.puzzle;

    // 从 AppState 恢复图片
    if (AppState) {
        const savedImage = AppState.get('puzzleImage');
        if (savedImage) opts.image = savedImage;

        AppState.subscribe('puzzleImage', (val) => {
            const inst = window.__puzzleInstance;
            if (inst && inst.setImage) inst.setImage(val);
        });
    }

    const puzzle = new Puzzle(opts);

    // 双向同步 AppState ↔ Puzzle
    if (AppState && MUTATIONS) {
        puzzle.on('completed:changed', (completed) => {
            try { AppState.commit(MUTATIONS.SET_PUZZLE_COMPLETED, completed); } catch (e) { /* 忽略 */ }
        });
        puzzle.on('image:changed', (image) => {
            try { AppState.commit(MUTATIONS.SET_PUZZLE_IMAGE, image); } catch (e) { /* 忽略 */ }
        });
    }

    return puzzle.init();
}
