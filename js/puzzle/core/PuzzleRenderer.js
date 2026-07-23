// 拼图 Canvas 绘制器 — 每实例独立，无共享状态。
// v2: 拼图凸起咬合形状 + 接缝线（双路径外亮内暗，任何背景下清晰可见）
const MASK_ALPHA = 0.4;

export class PuzzleRenderer {
    /**
     * @param {object} config — { width, height, gapSize, gapRadius, enableSeam }
     */
    constructor(config = {}) {
        this._canvasW = config.width || 480;
        this._canvasH = config.height || 180;
        this._gapW = config.gapSize || 72;
        this._gapH = config.gapSize || 72;
        this._gapRadius = config.gapRadius || 8;
        this._gapY = (this._canvasH - this._gapH) / 2;

        this._enableSeam = config.enableSeam !== false;

        // 实例级状态
        this._gapX = 0;
        this._cachedImg = null;
        this._onRedraw = null;
    }

    get gapX() { return this._gapX; }
    get gapY() { return this._gapY; }
    get gapW() { return this._gapW; }
    get gapH() { return this._gapH; }

    // ========================
    //  主渲染入口
    // ========================

    /**
     * 绘制完整拼图画面
     */
    render(ctx, imageSrc, bgColor) {
        const img = imageSrc || null;
        if (!this._gapX) this._resetGapX();

        if (img) {
            // ---- 图片模式 ----
            this._drawBackgroundFromImage(ctx, img);
            // 用主题背景色填充缺口 → 视觉上"挖掉"图片
            ctx.fillStyle = bgColor;
            this._drawPuzzleHole(ctx, this._gapX, this._gapY, this._gapW, this._gapH, this._gapRadius);
        } else {
            // ---- 纯色模式：遮罩 + destination-out 镂空 ----
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, this._canvasW, this._canvasH);
            this._drawMask(ctx);
        }

        // ---- 拼图缺口接缝线（双路径：外亮内暗，任何背景均清晰可见） ----
        if (this._enableSeam) {
            this._drawPuzzleSeam(ctx, this._gapX, this._gapY, this._gapW, this._gapH, this._gapRadius);
        }
    }

    resetGap() { this._resetGapX(); }

    // ========================
    //  图片 / 遮罩
    // ========================

    getImageInfo() {
        if (!this._cachedImg || !this._cachedImg.complete || this._cachedImg.naturalWidth <= 0) return null;
        const scale = Math.max(
            this._canvasW / this._cachedImg.naturalWidth,
            this._canvasH / this._cachedImg.naturalHeight
        );
        const sw = this._cachedImg.naturalWidth * scale;
        const sh = this._cachedImg.naturalHeight * scale;
        return { sx: (this._canvasW - sw) / 2, sy: (this._canvasH - sh) / 2, sw, sh };
    }

    lighten(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, (num >> 16) + 255 * amount);
        const g = Math.min(255, ((num >> 8) & 0x00FF) + 255 * amount);
        const b = Math.min(255, (num & 0x0000FF) + 255 * amount);
        return `rgb(${r | 0},${g | 0},${b | 0})`;
    }

    // ========================
    //  内部方法
    // ========================

    _resetGapX() {
        this._gapX = 100 + Math.random() * (this._canvasW - this._gapW - 200);
        if (this._gapX < 100) this._gapX = 100;
    }

    _drawBackgroundFromImage(ctx, imageSrc) {
        if (!this._cachedImg || this._cachedImg._src !== imageSrc) {
            this._cachedImg = new Image();
            this._cachedImg._src = imageSrc;
            const self = this;
            this._cachedImg.onload = () => {
                if (self._onRedraw) self._onRedraw();
            };
            this._cachedImg.src = imageSrc;
        }
        if (this._cachedImg.complete && this._cachedImg.naturalWidth > 0) {
            const scale = Math.max(
                this._canvasW / this._cachedImg.naturalWidth,
                this._canvasH / this._cachedImg.naturalHeight
            );
            const sw = this._cachedImg.naturalWidth * scale;
            const sh = this._cachedImg.naturalHeight * scale;
            const sx = (this._canvasW - sw) / 2;
            const sy = (this._canvasH - sh) / 2;
            ctx.drawImage(this._cachedImg, sx, sy, sw, sh);
        }
    }

    _drawMask(ctx) {
        ctx.fillStyle = `rgba(0, 0, 0, ${MASK_ALPHA})`;
        ctx.fillRect(0, 0, this._canvasW, this._canvasH);

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        this._drawPuzzleHole(ctx, this._gapX, this._gapY, this._gapW, this._gapH, this._gapRadius);
        ctx.restore();
    }

    // ========================
    //  任务一：拼图凸起咬合形状
    // ========================

    /**
     * 构建拼图块形状路径（四条边各含半圆凸起/凹槽，四角圆角过渡）。
     * 凸起方向都向外：上↑ 右→ 下↓ 左← — 形成"十字星"咬合轮廓。
     *
     * 路径构建顺序：上边 → 右上角 → 右边 → 右下角 → 下边 → 左下角 → 左边 → 左上角
     */
    _puzzlePath(ctx, x, y, w, h, r) {
        const tabR = Math.min(w * 0.18, h * 0.32, 16);
        const rr = Math.min(r, w / 4, h / 4);

        // ---- 上边（左→右），凸起在 35% 位置，向上 ----
        const topTabCx = x + w * 0.35;
        ctx.moveTo(x + rr, y);
        ctx.lineTo(topTabCx - tabR, y);
        ctx.arc(topTabCx, y, tabR, Math.PI, 0, false);  // 顺时针=上半圆弧（向上凸出）
        ctx.lineTo(x + w - rr, y);
        ctx.arcTo(x + w, y, x + w, y + rr, rr);

        // ---- 右边（上→下），凸起在 65% 位置，向右 ----
        const rightTabCy = y + h * 0.65;
        ctx.lineTo(x + w, rightTabCy - tabR);
        ctx.arc(x + w, rightTabCy, tabR, -Math.PI / 2, Math.PI / 2, false);
        ctx.lineTo(x + w, y + h - rr);
        ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);

        // ---- 下边（右→左），凸起在 65% 位置，向下 ----
        const bottomTabCx = x + w * 0.65;
        ctx.lineTo(bottomTabCx + tabR, y + h);
        ctx.arc(bottomTabCx, y + h, tabR, 0, Math.PI, true);
        ctx.lineTo(x + rr, y + h);
        ctx.arcTo(x, y + h, x, y + h - rr, rr);

        // ---- 左边（下→上），凸起在 35% 位置，向左 ----
        const leftTabCy = y + h * 0.35;
        ctx.lineTo(x, leftTabCy + tabR);
        ctx.arc(x, leftTabCy, tabR, Math.PI / 2, -Math.PI / 2, true);
        ctx.lineTo(x, y + rr);
        ctx.arcTo(x, y, x + rr, y, rr);
    }

    /** 绘制填充的拼图缺口 */
    _drawPuzzleHole(ctx, x, y, w, h, r) {
        ctx.beginPath();
        this._puzzlePath(ctx, x, y, w, h, r);
        ctx.closePath();
        ctx.fill();
    }

    // ========================
    //  任务二：拼图块接缝线
    // ========================

    /**
     * 接缝线：双路径方案 — 外路径亮色描边（暗底可见）+ 内路径暗色描边（亮底可见）。
     * 两条路径各偏移 1px，配合 shadowBlur 确保在任何背景/图片上都清晰可辨。
     */
    _drawPuzzleSeam(ctx, x, y, w, h, r) {
        ctx.save();

        // 外路径（扩大 1px）：亮色描边，暗背景上形成可见光边
        ctx.beginPath();
        this._puzzlePath(ctx, x - 1, y - 1, w + 2, h + 2, r);
        ctx.closePath();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 内路径（缩小 1px）：暗色描边，亮背景上形成可见压痕
        ctx.beginPath();
        this._puzzlePath(ctx, x + 1, y + 1, w - 2, h - 2, r * 0.8);
        ctx.closePath();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    // ========================
    //  DOM 拼图块 clip-path（与 Canvas 形状完全一致）
    // ========================

    /**
     * 返回拼图块的扩展尺寸和 CSS clip-path（含凸起）。
     * DOM 块需扩大到 (w+2*tabR)×(h+2*tabR) 才能容纳四条边的凸起。
     * @returns {{ w: number, h: number, tabR: number, clipPath: string }}
     */
    getBlockShape() {
        const w = this._gapW;
        const h = this._gapH;
        const tabR = Math.min(w * 0.18, h * 0.32, 16);
        const rr = Math.min(this._gapRadius, w / 4, h / 4);

        // 扩展后的总尺寸
        const ew = w + 2 * tabR;
        const eh = h + 2 * tabR;

        // 核心矩形在扩展空间中的偏移量 = tabR
        const ox = tabR;
        const oy = tabR;

        const topCx    = ox + w * 0.35;
        const rightCy  = oy + h * 0.65;
        const bottomCx = ox + w * 0.65;
        const leftCy   = oy + h * 0.35;

        const p = [
            `M ${ox + rr} ${oy}`,
            `L ${topCx - tabR} ${oy}`,
            `A ${tabR} ${tabR} 0 0 1 ${topCx + tabR} ${oy}`,       // 上边凸起（CW=向上凸出）
            `L ${ox + w - rr} ${oy}`,
            `A ${rr} ${rr} 0 0 1 ${ox + w} ${oy + rr}`,
            `L ${ox + w} ${rightCy - tabR}`,
            `A ${tabR} ${tabR} 0 0 1 ${ox + w} ${rightCy + tabR}`,
            `L ${ox + w} ${oy + h - rr}`,
            `A ${rr} ${rr} 0 0 1 ${ox + w - rr} ${oy + h}`,
            `L ${bottomCx + tabR} ${oy + h}`,
            `A ${tabR} ${tabR} 0 0 0 ${bottomCx - tabR} ${oy + h}`,
            `L ${ox + rr} ${oy + h}`,
            `A ${rr} ${rr} 0 0 1 ${ox} ${oy + h - rr}`,
            `L ${ox} ${leftCy + tabR}`,
            `A ${tabR} ${tabR} 0 0 0 ${ox} ${leftCy - tabR}`,
            `L ${ox} ${oy + rr}`,
            `A ${rr} ${rr} 0 0 1 ${ox + rr} ${oy}`,
            `Z`,
        ].join(' ');

        return {
            w: ew,
            h: eh,
            tabR: tabR,
            clipPath: `path('${p}')`,
        };
    }

    // ========================
    //  尺寸更新 / 销毁
    // ========================

    updateSize(width, height) {
        this._canvasW = width;
        this._canvasH = height;
        this._gapY = (height - this._gapH) / 2;
        this._resetGapX();
    }

    destroy() {
        this._cachedImg = null;
        this._onRedraw = null;
    }
}
