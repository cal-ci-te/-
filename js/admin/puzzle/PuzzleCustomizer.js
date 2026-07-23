// 拼图自定义面板 — 模态浮层，控制拼图实例的所有可配置参数。
// 通过 window.__puzzleInstance 获取拼图实例，与 Puzzle 类松耦合。
// 委托 ActionDelegator 处理按钮事件（open-puzzle-customizer）。
import { AppState } from '../../core/app-state.js';
import { MUTATIONS } from '../../core/state-mutations.js';
import { Utils } from '../../utils.js';
import { UI } from '../../utils/ui-strings.js';
import { AdminAvatar } from '../avatar.js';
import { updatePuzzlePreview, getPuzzleInstance } from './PuzzleEntry.js';

const MAX_OVERHANG = 500;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 80;

export const PuzzleCustomizer = {
    _overlay: null,
    _panel: null,
    _visible: false,
    _escHandler: null,
    _prevOverflow: null,
    _scrollState: null,

    // ---- 输入缓存（实时编辑中的值，未提交前不写入实例） ----
    _draft: {},
    _snapshot: null,

    /** 打开面板 */
    open() {
        if (this._visible) return;
        this._visible = true;
        this._ensureCSS();
        this._lockScroll();

        const puzzle = getPuzzleInstance();
        const config = puzzle ? puzzle.getConfig() : { width: 480, height: 180, blockSize: 72, overhang: 200, position: null };
        this._draft = { ...config, position: config.position ? { ...config.position } : null };
        // 保存快照，用于取消时恢复
        this._snapshot = { ...this._draft, position: this._draft.position ? { ...this._draft.position } : null };

        this._buildDOM();
        this._bindEvents();
        this._syncInputs();
    },

    /** 关闭面板（不保存，恢复快照撤销所有实时预览更改） */
    close() {
        if (!this._visible) return;
        this._visible = false;
        this._restoreSnapshot();
        this._unlockScroll();
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        this._panel = null;
    },

    // ========================
    //  DOM 构建
    // ========================

    _buildDOM() {
        const d = this._draft;
        const isCoord = d.position !== null;
        const pos = d.position || { x: 200, y: 400 };
        const image = AppState.get('puzzleImage') || '';
        const maxW = window.innerWidth - 40;
        const maxH = window.innerHeight - 100;

        const overlay = document.createElement('div');
        overlay.className = 'puzzle-customizer-overlay';
        overlay.innerHTML = `
            <div class="puzzle-customizer-panel">
                <div class="puzzle-customizer-header">
                    <span class="puzzle-customizer-title">🧩 拼图自定义</span>
                    <button class="puzzle-customizer-close" id="pzCloseBtn">✕</button>
                </div>

                <!-- 尺寸 -->
                <div class="puzzle-customizer-row">
                    <span class="puzzle-customizer-label">宽度</span>
                    <input class="puzzle-customizer-input" id="pzWidth" type="number" value="${d.width}" min="${MIN_WIDTH}" max="${maxW}">
                    <span class="puzzle-customizer-unit">px</span>
                </div>
                <div class="puzzle-customizer-error" id="pzWidthError"></div>

                <div class="puzzle-customizer-row">
                    <span class="puzzle-customizer-label">高度</span>
                    <input class="puzzle-customizer-input" id="pzHeight" type="number" value="${d.height}" min="${MIN_HEIGHT}" max="${maxH}">
                    <span class="puzzle-customizer-unit">px</span>
                </div>
                <div class="puzzle-customizer-error" id="pzHeightError"></div>

                <!-- 拼图块 -->
                <div class="puzzle-customizer-row">
                    <span class="puzzle-customizer-label">块尺寸</span>
                    <input class="puzzle-customizer-input" id="pzBlockSize" type="number" value="${d.blockSize}" min="40" max="200">
                    <span class="puzzle-customizer-unit">px</span>
                </div>

                <!-- 溢出 -->
                <div class="puzzle-customizer-row">
                    <span class="puzzle-customizer-label">溢出距离</span>
                    <input class="puzzle-customizer-range" id="pzOverhang" type="range" min="0" max="${MAX_OVERHANG}" value="${d.overhang}">
                    <span class="puzzle-customizer-value" id="pzOverhangVal">${d.overhang}</span>
                </div>

                <!-- 位置模式 -->
                <div class="puzzle-customizer-mode-toggle">
                    <button class="puzzle-customizer-mode-btn ${!isCoord ? 'active' : ''}" id="pzModeFlow">流式</button>
                    <button class="puzzle-customizer-mode-btn ${isCoord ? 'active' : ''}" id="pzModeCoord">坐标</button>
                </div>

                ${isCoord ? `
                <div class="puzzle-customizer-row">
                    <span class="puzzle-customizer-label">位置 X</span>
                    <input class="puzzle-customizer-input" id="pzPosX" type="number" value="${pos.x}" min="0" max="${maxW}">
                    <span class="puzzle-customizer-unit">px</span>
                </div>
                <div class="puzzle-customizer-row">
                    <span class="puzzle-customizer-label">位置 Y</span>
                    <input class="puzzle-customizer-input" id="pzPosY" type="number" value="${pos.y}" min="0" max="${maxH}">
                    <span class="puzzle-customizer-unit">px</span>
                </div>` : `
                <div class="puzzle-customizer-row" style="display:none;" id="pzPosRow">
                    <span class="puzzle-customizer-label" style="font-size:11px; color:var(--color-text-muted);">坐标模式已禁用（流式）</span>
                </div>`}

                <!-- 图片上传 -->
                <div class="puzzle-customizer-image-section">
                    <div class="puzzle-customizer-image-label">拼图图片</div>
                    <div class="puzzle-customizer-image-actions">
                        <button class="puzzle-customizer-btn" id="pzUploadBtn">📤 上传图片</button>
                        <button class="puzzle-customizer-btn btn-reset" id="pzResetImgBtn">🔄 恢复默认</button>
                    </div>
                    ${image ? '<div style="font-size:11px;color:var(--color-text-muted);margin-top:4px;">已设置自定义图片</div>' : ''}
                </div>

                <!-- 尺寸提示 -->
                <div style="font-size:11px;color:var(--color-text-muted);margin-top:12px;padding-top:8px;border-top:1px solid var(--color-border);">
                    页面可用范围：最大 ${maxW}×${maxH}px
                </div>

                <!-- 操作按钮 -->
                <div class="puzzle-customizer-actions">
                    <button class="puzzle-customizer-btn btn-apply" id="pzApplyBtn">✅ 应用</button>
                    <button class="puzzle-customizer-btn btn-reset" id="pzResetBtn">↺ 重置</button>
                    <button class="puzzle-customizer-btn btn-cancel" id="pzCancelBtn">取消</button>
                </div>
            </div>`;

        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });

        document.body.appendChild(overlay);
        this._overlay = overlay;
        this._panel = overlay.querySelector('.puzzle-customizer-panel');
    },

    // ========================
    //  事件绑定
    // ========================

    _bindEvents() {
        this._$('pzCloseBtn')?.addEventListener('click', () => this.close());
        this._$('pzCancelBtn')?.addEventListener('click', () => this.close());

        // 尺寸实时预览
        this._$('pzWidth')?.addEventListener('input', () => { this._validateAndPreview(); });
        this._$('pzHeight')?.addEventListener('input', () => { this._validateAndPreview(); });
        this._$('pzBlockSize')?.addEventListener('input', () => { this._validateAndPreview(); });

        // 溢出滑块
        this._$('pzOverhang')?.addEventListener('input', (e) => {
            const val = e.target.value;
            const display = this._$('pzOverhangVal');
            if (display) display.textContent = val;
            this._preview();
        });

        // 位置模式切换
        const flowBtn = this._$('pzModeFlow');
        const coordBtn = this._$('pzModeCoord');
        flowBtn?.addEventListener('click', () => {
            flowBtn.classList.add('active');
            coordBtn?.classList.remove('active');
            this._draft.position = null;
            this._rebuildPositionInputs();
            this._preview();
        });
        coordBtn?.addEventListener('click', () => {
            coordBtn.classList.add('active');
            flowBtn?.classList.remove('active');
            this._draft.position = { x: 200, y: 400 };
            this._rebuildPositionInputs();
            this._preview();
        });

        // 图片上传（点击时先隐藏面板，裁剪完成后再恢复）
        this._$('pzUploadBtn')?.addEventListener('click', () => {
            const input = document.getElementById('puzzleCustomizerFileInput');
            if (input) {
                // 标记：裁剪流程中，面板暂时隐藏
                this._cropPending = true;
                this._hideForCrop();
                input.click();
            }
        });
        this._$('pzResetImgBtn')?.addEventListener('click', () => {
            AppState.commit(MUTATIONS.SET_PUZZLE_IMAGE, null);
            Utils.showToast(UI.puzzle.resetToDefault, false);
            this._updateImageHint();
        });

        // 应用
        this._$('pzApplyBtn')?.addEventListener('click', () => this._apply());

        // 重置
        this._$('pzResetBtn')?.addEventListener('click', () => this._reset());

        // ESC 关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') { this.close(); }
        };
        document.addEventListener('keydown', escHandler);
        this._escHandler = escHandler;
    },

    // ========================
    //  业务逻辑
    // ========================

    /** 同步输入值到 DOM */
    _syncInputs() {
        const d = this._draft;
        this._setVal('pzWidth', d.width);
        this._setVal('pzHeight', d.height);
        this._setVal('pzBlockSize', d.blockSize);
        this._setVal('pzOverhang', d.overhang);
        const display = this._$('pzOverhangVal');
        if (display) display.textContent = d.overhang;
        if (d.position) {
            this._setVal('pzPosX', d.position.x);
            this._setVal('pzPosY', d.position.y);
        }
    },

    /** 校验输入 + 实时预览 */
    _validateAndPreview() {
        const maxW = window.innerWidth - 40;
        const maxH = window.innerHeight - 100;

        let w = parseInt(this._$('pzWidth')?.value) || 0;
        let h = parseInt(this._$('pzHeight')?.value) || 0;
        const block = parseInt(this._$('pzBlockSize')?.value) || 72;

        // 校验
        const wOk = w >= MIN_WIDTH && w <= maxW;
        const hOk = h >= MIN_HEIGHT && h <= maxH;
        const blockOk = block >= 40 && block <= 200;

        this._toggleError('pzWidth', wOk, `宽度需在 ${MIN_WIDTH}–${maxW} 之间`);
        this._toggleError('pzHeight', hOk, `高度需在 ${MIN_HEIGHT}–${maxH} 之间`);

        if (!wOk) w = this._draft.width;
        if (!hOk) h = this._draft.height;

        // 同步到草稿
        this._draft.width = w;
        this._draft.height = h;
        this._draft.blockSize = blockOk ? block : this._draft.blockSize;
        this._draft.overhang = parseInt(this._$('pzOverhang')?.value) || 0;

        this._preview();
    },

    /** 将草稿应用到拼图实例（实时预览），每次调整后刷新拼图 */
    _preview() {
        const puzzle = getPuzzleInstance();
        if (!puzzle) return;

        const d = this._draft;
        try {
            puzzle.setSize(d.width, d.height);
            puzzle.setOverhang(d.overhang);
            if (d.position) {
                puzzle.setPosition(d.position.x, d.position.y);
            } else {
                puzzle.setPosition(null, null);
            }
            // blockSize 更新通过 updateConfig（已同步渲染器 + 拖拽模块）
            puzzle.updateConfig({ blockSize: d.blockSize });
            // 每次调整后刷新拼图：重新随机缺口位置 + 滑块归零
            puzzle.reset();

            // 更新面板预览
            updatePuzzlePreview();
        } catch (e) {
            console.warn('[PuzzleCustomizer] 预览失败:', e.message);
        }
    },

    /** 应用并关闭 */
    _apply() {
        this._validateAndPreview();
        const puzzle = getPuzzleInstance();
        if (puzzle) {
            puzzle.save();
            // 应用后刷新拼图
            puzzle.reset();
        }
        Utils.showToast('拼图配置已应用', false);
        updatePuzzlePreview();
        this.close();
    },

    /** 重置为默认值 */
    _reset() {
        const puzzle = getPuzzleInstance();
        this._draft = { width: 480, height: 180, blockSize: 72, overhang: 200, position: null };
        this._syncInputs();
        if (puzzle) {
            try {
                puzzle.setSize(480, 180);
                puzzle.setOverhang(200);
                puzzle.setPosition(null, null);
                puzzle.updateConfig({ blockSize: 72 });
                puzzle.reset();
            } catch (e) { /* 忽略 */ }
        }
        // 重置图片
        AppState.commit(MUTATIONS.SET_PUZZLE_IMAGE, null);
        this._updateImageHint();
        Utils.showToast('拼图已恢复默认配置', false);
        updatePuzzlePreview();
    },

    /** 重建位置输入行（切换流式/坐标模式时） */
    _rebuildPositionInputs() {
        const row = this._$('pzPosRow');
        if (!row) return;

        const isCoord = this._draft.position !== null;
        const pos = this._draft.position || { x: 200, y: 400 };
        const maxW = window.innerWidth - 40;
        const maxH = window.innerHeight - 100;

        if (isCoord) {
            row.style.display = '';
            row.innerHTML = `
                <span class="puzzle-customizer-label">位置 X</span>
                <input class="puzzle-customizer-input" id="pzPosX" type="number" value="${pos.x}" min="0" max="${maxW}">
                <span class="puzzle-customizer-unit">px</span>`;
            // 追加 Y 行
            const yRow = document.createElement('div');
            yRow.className = 'puzzle-customizer-row';
            yRow.id = 'pzPosYRow';
            yRow.innerHTML = `
                <span class="puzzle-customizer-label">位置 Y</span>
                <input class="puzzle-customizer-input" id="pzPosY" type="number" value="${pos.y}" min="0" max="${maxH}">
                <span class="puzzle-customizer-unit">px</span>`;
            row.parentNode.insertBefore(yRow, row.nextSibling);

            // 绑定位置输入事件
            this._$('pzPosX')?.addEventListener('input', () => {
                const x = parseInt(this._$('pzPosX')?.value) || 0;
                if (this._draft.position) this._draft.position.x = x;
                this._preview();
            });
            this._$('pzPosY')?.addEventListener('input', () => {
                const y = parseInt(this._$('pzPosY')?.value) || 0;
                if (this._draft.position) this._draft.position.y = y;
                this._preview();
            });
        } else {
            row.style.display = 'none';
            const yRow = document.getElementById('pzPosYRow');
            if (yRow) yRow.remove();
        }
    },

    /** 更新图片提示（上传/重置后） */
    _updateImageHint() {
        const section = this._panel?.querySelector('.puzzle-customizer-image-section');
        if (!section) return;
        const hint = section.querySelector('div:last-child');
        const hasImage = !!AppState.get('puzzleImage');
        if (hint && hint.style && hint.style.fontSize === '11px') {
            hint.textContent = hasImage ? '已设置自定义图片' : '';
        }
    },

    // ========================
    //  工具方法
    // ========================

    _$(id) {
        return this._panel?.querySelector('#' + id) || null;
    },

    _setVal(id, val) {
        const el = this._$(id);
        if (el) el.value = val;
    },

    _toggleError(id, ok, msg) {
        const errorEl = document.getElementById(id + 'Error');
        const inputEl = this._$(id);
        if (errorEl) errorEl.textContent = ok ? '' : msg;
        if (inputEl) inputEl.classList.toggle('input-error', !ok);
    },

    /** 隐藏面板（裁剪前），保留滚动锁定和可见标记 */
    _hideForCrop() {
        if (this._overlay) this._overlay.style.display = 'none';
    },

    /** 恢复面板（裁剪完成后） */
    _showAfterCrop() {
        this._cropPending = false;
        if (this._overlay) this._overlay.style.display = '';
        this._updateImageHint();
    },

    /** 首次打开时动态注入 CSS（避免全局污染） */
    _ensureCSS() {
        if (document.getElementById('puzzle-customizer-css')) return;
        const link = document.createElement('link');
        link.id = 'puzzle-customizer-css';
        link.rel = 'stylesheet';
        link.href = '/css/components/puzzle-customizer.css';
        document.head.appendChild(link);
    },

    /** 锁定页面滚动（双重锁定：position:fixed + 事件阻止） */
    _lockScroll() {
        this._scrollState = { x: window.scrollX, y: window.scrollY };
        // 保存原样式，使用 position:fixed 彻底锁定（防止 iOS 弹性滚动）
        this._prevOverflow = document.body.style.overflow;
        this._prevPosition = document.body.style.position;
        this._prevTop = document.body.style.top;
        this._prevWidth = document.body.style.width;
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this._scrollState.y}px`;
        document.body.style.width = '100%';
        // 阻止面板外部的触摸滚动和滚轮
        this._touchHandler = (e) => {
            if (e.target.closest('.puzzle-customizer-panel')) return;
            e.preventDefault();
        };
        this._wheelHandler = (e) => {
            if (e.target.closest('.puzzle-customizer-panel')) return;
            e.preventDefault();
        };
        document.addEventListener('touchmove', this._touchHandler, { passive: false });
        document.addEventListener('wheel', this._wheelHandler, { passive: false });
    },

    /** 恢复页面滚动 */
    _unlockScroll() {
        document.body.style.overflow = this._prevOverflow || '';
        document.body.style.position = this._prevPosition || '';
        document.body.style.top = this._prevTop || '';
        document.body.style.width = this._prevWidth || '';
        if (this._scrollState) {
            window.scrollTo(this._scrollState.x, this._scrollState.y);
            this._scrollState = null;
        }
        if (this._touchHandler) {
            document.removeEventListener('touchmove', this._touchHandler);
            this._touchHandler = null;
        }
        if (this._wheelHandler) {
            document.removeEventListener('wheel', this._wheelHandler);
            this._wheelHandler = null;
        }
        this._prevOverflow = null;
        this._prevPosition = null;
        this._prevTop = null;
        this._prevWidth = null;
    },

    /** 恢复快照到拼图实例（取消/关闭时撤销所有实时预览更改） */
    _restoreSnapshot() {
        if (!this._snapshot) return;
        const puzzle = getPuzzleInstance();
        if (!puzzle) return;
        const s = this._snapshot;
        try {
            puzzle.setSize(s.width, s.height);
            puzzle.setOverhang(s.overhang);
            if (s.position) {
                puzzle.setPosition(s.position.x, s.position.y);
            } else {
                puzzle.setPosition(null, null);
            }
            puzzle.updateConfig({ blockSize: s.blockSize });
            updatePuzzlePreview();
        } catch (e) { /* 静默 */ }
    },
};

// ========================
//  ActionDelegator handler
// ========================

/** 注册到 AdminPanel 的 action handler — 打开自定义面板 */
export function handleOpenPuzzleCustomizer() {
    PuzzleCustomizer.open();
}

// ========================
//  文件上传绑定（在 render.js 中调用）
// ========================

/** 绑定拼图图片文件上传事件，在 AdminPanel.renderContent 后调用 */
export function bindPuzzleFileUpload() {
    const input = document.getElementById('puzzleCustomizerFileInput');
    if (!input) return;

    // 防止重复绑定
    const handler = input._pzHandler;
    if (handler) input.removeEventListener('change', handler);

    const newHandler = function (event) {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) {
            // 用户取消了文件选择，恢复面板
            if (PuzzleCustomizer._cropPending) PuzzleCustomizer._showAfterCrop();
            return;
        }
        if (!file.type.startsWith('image/')) {
            Utils.showToast(UI.puzzle.invalidFormat, true);
            if (PuzzleCustomizer._cropPending) PuzzleCustomizer._showAfterCrop();
            return;
        }
        // 动态裁剪比例 = 当前拼图宽高比
        const puzzle = getPuzzleInstance();
        const config = puzzle ? puzzle.getConfig() : { width: 480, height: 180 };
        const aspectRatio = config.width / config.height;
        AdminAvatar.openCustomCrop(file, aspectRatio, config.width, (dataUrl) => {
            AppState.commit(MUTATIONS.SET_PUZZLE_IMAGE, dataUrl);
            Utils.showToast(UI.puzzle.imageUpdated, false);
            // 裁剪完成，恢复面板
            if (PuzzleCustomizer._cropPending) {
                PuzzleCustomizer._showAfterCrop();
            } else if (PuzzleCustomizer._visible) {
                PuzzleCustomizer._updateImageHint();
            }
        });
        // 如果裁剪被取消（openCustomCrop 无 cancel 回调），5 秒后兜底恢复
        setTimeout(() => {
            if (PuzzleCustomizer._cropPending) {
                PuzzleCustomizer._showAfterCrop();
            }
        }, 5000);
    };
    input._pzHandler = newHandler;
    input.addEventListener('change', newHandler);
}
