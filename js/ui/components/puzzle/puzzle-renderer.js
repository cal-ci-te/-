// 拼图 Canvas 绘制器：负责在 <canvas> 上绘制背景、缺口、拼图块。
// 采用三次绘制分层策略：先画背景图/纯色 → 再画遮罩层 → 最后画拼图块（因拼图块需覆盖在遮罩上方）。
const CANVAS_W = 480;
const CANVAS_H = 180;
const GAP_W = 72;      // 缺口宽度
const GAP_H = 72;      // 缺口高度
const GAP_RADIUS = 8;  // 圆角半径
const GAP_Y = (CANVAS_H - GAP_H) / 2; // 缺口垂直居中
const MASK_ALPHA = 0.4; // 遮罩透明度

export const PuzzleRenderer = {
    /** 缓存的缺口 X 坐标，滑块对齐判定时使用 */
    _gapX: 0,

    get gapX() { return this._gapX; },

    /**
     * 绘制完整拼图画面
     * @param {CanvasRenderingContext2D} ctx
     * @param {string|null} imageSrc - 拼图背景图片 dataUrl（null 则使用纯色）
     * @param {string} bgColor - 纯色背景色（作为缺省）
     * @param {number} blockX - 拼图块当前水平位置（随滑块值变化）
     * @param {boolean} completed - 是否已对齐完成
     */
    render(ctx, imageSrc, bgColor) {
        const img = imageSrc || null;

        // 随机生成缺口位置（仅首次或重置后）
        if (!this._gapX) {
            this._gapX = 100 + Math.random() * (CANVAS_W - GAP_W - 200);
        }

        if (img) {
            // 有图片：100% 不透明覆盖，缺口处填 bgColor 显示页面背景
            this._drawBackgroundFromImage(ctx, img);
            // 缺口：绘制实心圆角矩形，露出底层页面背景色
            ctx.fillStyle = bgColor;
            this._drawRoundedRect(ctx, this._gapX, GAP_Y, GAP_W, GAP_H, GAP_RADIUS);
        } else {
            // 无图片：纯色背景 + 半透明遮罩 + 挖空缺口（保持对比度）
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
            this._drawMask(ctx);
        }
    },

    /** 重置缺口位置（刷新按钮触发） */
    resetGap() {
        this._gapX = 100 + Math.random() * (CANVAS_W - GAP_W - 200);
    },

    /** 返回当前缓存图片在 Canvas 上的绘制偏移参数（供 DOM 块对齐背景用） */
    getImageInfo() {
        if (!this._cachedImg || !this._cachedImg.complete || this._cachedImg.naturalWidth <= 0) return null;
        const scale = Math.max(CANVAS_W / this._cachedImg.naturalWidth, CANVAS_H / this._cachedImg.naturalHeight);
        const sw = this._cachedImg.naturalWidth * scale;
        const sh = this._cachedImg.naturalHeight * scale;
        return { sx: (CANVAS_W - sw) / 2, sy: (CANVAS_H - sh) / 2, sw, sh };
    },

    // ---- 内部绘制方法 ----

    _drawBackgroundFromImage(ctx, imageSrc) {
        // 使用内置缓存的 Image 对象，避免每帧创建
        if (!this._cachedImg || this._cachedImg._src !== imageSrc) {
            this._cachedImg = new Image();
            this._cachedImg._src = imageSrc;
            this._cachedImg.src = imageSrc;
        }
        if (this._cachedImg.complete && this._cachedImg.naturalWidth > 0) {
            // 等比缩放填满 Canvas
            const scale = Math.max(CANVAS_W / this._cachedImg.naturalWidth, CANVAS_H / this._cachedImg.naturalHeight);
            const sw = this._cachedImg.naturalWidth * scale;
            const sh = this._cachedImg.naturalHeight * scale;
            const sx = (CANVAS_W - sw) / 2;
            const sy = (CANVAS_H - sh) / 2;
            ctx.drawImage(this._cachedImg, sx, sy, sw, sh);
        }
    },

    _drawMask(ctx) {
        // 先画全屏半透明遮罩
        ctx.fillStyle = `rgba(0, 0, 0, ${MASK_ALPHA})`;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // 用 destination-out 模式在缺口处"挖空"
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        this._drawRoundedRect(ctx, this._gapX, GAP_Y, GAP_W, GAP_H, GAP_RADIUS);
        ctx.fill();
        ctx.restore();
    },

    _drawRoundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        this._roundedRectPath(ctx, x, y, w, h, r);
        ctx.fill();
    },

    _roundedRectPath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    },

    /** 简单颜色提亮（不使用外部库） */
    lighten(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, (num >> 16) + 255 * amount);
        const g = Math.min(255, ((num >> 8) & 0x00FF) + 255 * amount);
        const b = Math.min(255, (num & 0x0000FF) + 255 * amount);
        return `rgb(${r|0},${g|0},${b|0})`;
    },
};
