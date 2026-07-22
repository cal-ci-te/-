// 滑动拼图主控制器：组装 renderer + drag + 闪光动画，管理组件生命周期。
// 数据流：AppState.puzzleImage 变更 → re-render | 滑块值变更 → drag → 碰撞检测 → 闪光/文字切换
//
// 位置配置（两种模式，向后兼容）：
//   坐标模式：initPuzzle({ x: 200, y: 400 }) → position:fixed 定位于视口坐标，不依赖 HTML 结构
//   流式模式：initPuzzle('.hero-section', 'afterend') → insertAdjacentElement 插入到目标元素旁
//   默认：initPuzzle() → 挂载到 body 末尾
import { AppState } from '../../../core/app-state.js';
import { MUTATIONS } from '../../../core/state-mutations.js';
import { EventBus } from '../../../core/event-bus.js';
import { EVENTS } from '../../../core/event-constants.js';
import { ThemeService } from '../../../services/theme-service.js';
import { Utils } from '../../../utils.js';
import { UI } from '../../../utils/ui-strings.js';
import { PuzzleRenderer } from './puzzle-renderer.js';
import { PuzzleDrag } from './puzzle-drag.js';

const STORAGE_KEY = 'rv_puzzle_image';
const CANVAS_W = 480;
const CANVAS_H = 180;

/**
 * 创建拼图组件 DOM 并挂载。
 *
 * 调用方式（兼容三种签名）：
 *   initPuzzle()                           — 默认：body 末尾
 *   initPuzzle(mountPoint, position)       — 流式：选择器 + 插入位置
 *   initPuzzle({ x, y })                   — 坐标：视口固定定位
 *   initPuzzle({ mountPoint, position })   — 流式（对象形式）
 *   initPuzzle({ x, y, mountPoint })       — 坐标 + 回退流式容器
 *
 * @param {string|Object} [arg1] — 选择器字符串 或 {x,y} 坐标对象 或 {mountPoint, position, x, y} 配置对象
 * @param {string} [arg2]        — 插入位置（仅当 arg1 是选择器字符串时有效）
 */
export function initPuzzle(arg1, arg2) {
    let coords = null;
    let mountPoint = null;
    let position = 'beforeend';

    // 解析参数：兼容字符串选择器 / 坐标对象 / 配置对象三种形式
    if (typeof arg1 === 'object' && arg1 !== null) {
        if (arg1.x !== undefined || arg1.y !== undefined) {
            coords = { x: arg1.x ?? 200, y: arg1.y ?? 400 };
        }
        if (arg1.mountPoint) mountPoint = arg1.mountPoint;
        if (arg1.position) position = arg1.position;
    } else if (typeof arg1 === 'string') {
        mountPoint = arg1;
        if (arg2) position = arg2;
    }

    // 移动端（≤600px）：强制流式模式 + hero-section 下方 + 禁用溢出
    const isMobile = window.innerWidth <= 600;
    const overhang = isMobile ? 0 : 200;
    if (isMobile) {
        coords = null;
        mountPoint = '.hero-section';
        position = 'afterend';
    }

    // 确定挂载目标：坐标模式挂 body；流式按选择器；默认 body
    const target = mountPoint ? document.querySelector(mountPoint) : document.body;
    if (!target) {
        console.warn('[Puzzle] 挂载目标不存在:', mountPoint);
        return;
    }

    // 从 localStorage 恢复用户自定义图片
    const savedImage = Utils.storage.get(STORAGE_KEY);
    if (savedImage && !AppState.get('puzzleImage')) {
        AppState.commit(MUTATIONS.SET_PUZZLE_IMAGE, savedImage);
    }

    // 创建拼图 DOM
    const widget = document.createElement('div');
    widget.id = 'puzzleWidget';
    widget.className = 'puzzle-widget';
    widget.innerHTML = `
        <div class="puzzle-header">
            <span class="puzzle-title">${UI.puzzle.widgetTitle}</span>
            <button id="puzzleResetBtn" class="puzzle-reset-btn" title="重置拼图">🔄</button>
        </div>
        <div class="puzzle-canvas-wrapper">
            <canvas id="puzzleCanvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
            <div id="puzzleBlock" class="puzzle-block"></div>
            <div id="puzzleFlash" class="puzzle-flash"></div>
        </div>
        <div class="puzzle-slider-container">
            <div id="puzzleTrack" class="puzzle-track">
                <div id="puzzleThumb" class="puzzle-thumb"></div>
            </div>
            <div id="puzzleHint" class="puzzle-hint">${UI.puzzle.hint}</div>
        </div>`;

    // 坐标模式：absolute 定位，注入 body；流式模式：按 DOM 位置插入
    if (coords) {
        // 移动端/小屏：钳制坐标防止 widget 溢出视口
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = Math.min(500, vw - 16); // widget 估算宽度
        const h = 340;                      // widget 估算高度
        const x = Math.max(8, Math.min(coords.x, vw - w - 8));
        const y = Math.max(8, Math.min(coords.y, vh - h - 8));

        widget.style.position = 'absolute';
        widget.style.left = x + 'px';
        widget.style.top = y + 'px';
        widget.style.maxWidth = (vw - 16) + 'px';
        widget.style.margin = '0';
        widget.style.zIndex = '90';
        document.body.appendChild(widget);
        console.log('[Puzzle] 坐标模式 — 挂载到 (', x, ',', y, ') 视口:', vw + 'x' + vh);
    } else {
        target.insertAdjacentElement(position, widget);
    }

    const canvas = widget.querySelector('#puzzleCanvas');
    const track = widget.querySelector('#puzzleTrack');
    const thumb = widget.querySelector('#puzzleThumb');
    const hint = widget.querySelector('#puzzleHint');
    const resetBtn = widget.querySelector('#puzzleResetBtn');
    const flash = widget.querySelector('#puzzleFlash');
    const block = widget.querySelector('#puzzleBlock');

    if (!canvas || !track || !thumb) return;

    const ctx = canvas.getContext('2d');

    function scaleCanvas() {
        const wrapper = canvas.parentElement;
        const maxW = wrapper ? wrapper.clientWidth : window.innerWidth;
        if (maxW < CANVAS_W) {
            const s = maxW / CANVAS_W;
            canvas.style.width = maxW + 'px';
            canvas.style.height = (CANVAS_H * s) + 'px';
        } else {
            canvas.style.width = CANVAS_W + 'px';
            canvas.style.height = CANVAS_H + 'px';
        }
        // 同步缩放比 + 日志
        const s = (canvas.clientWidth / CANVAS_W) || 1;
        PuzzleDrag.setScale(s);
        console.log('[Puzzle] Canvas 缩放比:', s.toFixed(3), '尺寸:', canvas.clientWidth + 'x' + canvas.clientHeight, '视口:', window.innerWidth + 'x' + window.innerHeight);
    }
    scaleCanvas();
    window.addEventListener('resize', scaleCanvas);

    // ---- 核心渲染 ----
    function renderPuzzle() {
        const imageSrc = AppState.get('puzzleImage');
        const bgColor = ThemeService.getPuzzleBackground();
        const blockValue = PuzzleDrag._currentValue || 0;
        const blockX = PuzzleDrag._mapValueToX ? PuzzleDrag._mapValueToX(blockValue) : 0;
        const completed = AppState.get('puzzleCompleted');
        // Canvas CSS 可能被缩放（移动端 max-width:100%），DOM 定位需同步
        const scale = (canvas.clientWidth / CANVAS_W) || 1;

        PuzzleRenderer.render(ctx, imageSrc, bgColor);
        if (block) {
            const gapY = 54;
            block.style.left = (blockX * scale) + 'px';
            block.style.top = (gapY * scale) + 'px';

            if (imageSrc) {
                const info = PuzzleRenderer.getImageInfo();
                const gapX = PuzzleRenderer.gapX;
                if (info) {
                    block.style.backgroundImage = 'url(' + imageSrc + ')';
                    block.style.backgroundSize = (info.sw * scale) + 'px ' + (info.sh * scale) + 'px';
                    block.style.backgroundPosition = ((info.sx - gapX) * scale) + 'px ' + ((info.sy - gapY) * scale) + 'px';
                    block.style.backgroundColor = 'transparent';
                } else {
                    block.style.backgroundImage = '';
                    block.style.backgroundColor = PuzzleRenderer.lighten(bgColor, 0.15);
                }
            } else {
                block.style.backgroundImage = '';
                block.style.backgroundColor = PuzzleRenderer.lighten(bgColor, 0.15);
            }
            block.classList.toggle('puzzle-block-aligned', completed);
        }
    }

    // ---- 闪光动画 ----
    function triggerFlash() {
        if (!flash) return;
        flash.classList.remove('puzzle-flash-active');
        void flash.offsetWidth;
        flash.classList.add('puzzle-flash-active');
        setTimeout(() => flash.classList.remove('puzzle-flash-active'), 650);
    }

    // ---- 滑块回调 ----
    PuzzleDrag.init(track, thumb, (blockX, isAligned) => {
        if (!PuzzleDrag._rafId) {
            PuzzleDrag._rafId = requestAnimationFrame(() => {
                renderPuzzle();
                PuzzleDrag._rafId = null;
            });
        }

        if (isAligned && !AppState.get('puzzleCompleted')) {
            AppState.commit(MUTATIONS.SET_PUZZLE_COMPLETED, true);
            triggerFlash();
            if (hint) hint.textContent = UI.puzzle.completed;
        } else if (!isAligned && AppState.get('puzzleCompleted')) {
            AppState.commit(MUTATIONS.SET_PUZZLE_COMPLETED, false);
            if (hint) hint.textContent = UI.puzzle.hint;
        }
    });

    // ---- 重置按钮 ----
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            PuzzleRenderer.resetGap();
            PuzzleDrag.setGapX(PuzzleRenderer.gapX);
            PuzzleDrag.reset();
            AppState.commit(MUTATIONS.SET_PUZZLE_COMPLETED, false);
            if (flash) flash.classList.remove('puzzle-flash-active');
            if (hint) hint.textContent = UI.puzzle.hint;
            renderPuzzle();
        });
    }

    // 首次渲染 → 生成随机缺口位置 → 同步给拖拽控制器。
    renderPuzzle();
    PuzzleDrag.setGapX(PuzzleRenderer.gapX);
    PuzzleDrag.setOverhang(overhang); // 移动端 0

    // ---- 状态订阅 ----
    AppState.subscribe('puzzleImage', () => {
        PuzzleDrag.reset();
        renderPuzzle();
    });

    AppState.subscribe('puzzleCompleted', () => renderPuzzle());

    // ---- 主题变更 ----
    EventBus.on(EVENTS.THEME_CHANGED, () => renderPuzzle());

    // 用户上传图片时同步持久化到 localStorage
    AppState.subscribe('puzzleImage', (val) => {
        if (val) {
            Utils.storage.set(STORAGE_KEY, val);
        } else {
            Utils.storage.remove(STORAGE_KEY);
        }
    });

    if (coords) {
        console.log('[Puzzle] 坐标模式 — 挂载到视口 (', coords.x, ',', coords.y, ')');
    } else {
        console.log('[Puzzle] 流式模式 — 挂载到:', mountPoint || 'body', '位置:', position);
    }
}
