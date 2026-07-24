// 拼图自定义面板
import { AppState } from '../../core/app-state.js';
import { MUTATIONS } from '../../core/state-mutations.js';
import { Utils } from '../../utils.js';
import { UI } from '../../utils/ui-strings.js';
import { AdminAvatar } from '../avatar.js';
import { updatePuzzlePreview, getPuzzleInstance } from './PuzzleEntry.js';

const MAX_OVERHANG = 500, MIN_WIDTH = 200, MIN_HEIGHT = 80;

export const PuzzleCustomizer = {
    _overlay: null, _panel: null, _visible: false,
    _escHandler: null, _prevOverflow: null, _scrollState: null,
    _draft: {}, _snapshot: null,

    open() {
        if (this._visible) return;
        this._visible = true; this._ensureCSS(); this._lockScroll();
        const puzzle = getPuzzleInstance();
        const config = puzzle ? puzzle.getConfig() : { width: 480, height: 180, blockSize: 72, overhang: 100, position: null };
        this._draft = { ...config, position: config.position ? { ...config.position } : null };
        this._snapshot = { ...this._draft, position: this._draft.position ? { ...this._draft.position } : null };
        this._originalImage = AppState.get('puzzleImage') || null;
        this._buildDOM(); this._bindEvents(); this._syncInputs();
    },

    close() {
        if (!this._visible) return;
        this._visible = false; this._unlockScroll();
        if (this._escHandler) { document.removeEventListener('keydown', this._escHandler); this._escHandler = null; }
        if (this._overlay && this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
        this._overlay = null; this._panel = null;
    },

    _buildDOM() {
        const d = this._draft, isCoord = d.position !== null, pos = d.position || { x: 200, y: 400 };
        const image = AppState.get('puzzleImage') || '', maxW = window.innerWidth - 40, maxH = window.innerHeight - 100;
        const overlay = document.createElement('div'); overlay.className = 'puzzle-customizer-overlay';
        overlay.innerHTML = `<div class="puzzle-customizer-panel">
            <div class="puzzle-customizer-header"><span class="puzzle-customizer-title">\u{1F9E9} \u62FC\u56FE\u81EA\u5B9A\u4E49</span><button class="puzzle-customizer-close" id="pzCloseBtn">\u2715</button></div>
            <div class="puzzle-customizer-row"><span class="puzzle-customizer-label">\u5BBD\u5EA6</span><input class="puzzle-customizer-input" id="pzWidth" type="number" value="${d.width}" min="${MIN_WIDTH}" max="${maxW}"><span class="puzzle-customizer-unit">px</span></div>
            <div class="puzzle-customizer-error" id="pzWidthError"></div>
            <div class="puzzle-customizer-row"><span class="puzzle-customizer-label">\u9AD8\u5EA6</span><input class="puzzle-customizer-input" id="pzHeight" type="number" value="${d.height}" min="${MIN_HEIGHT}" max="${maxH}"><span class="puzzle-customizer-unit">px</span></div>
            <div class="puzzle-customizer-error" id="pzHeightError"></div>
            <div class="puzzle-customizer-row"><span class="puzzle-customizer-label">\u5757\u5C3A\u5BF8</span><input class="puzzle-customizer-input" id="pzBlockSize" type="number" value="${d.blockSize}" min="40" max="200"><span class="puzzle-customizer-unit">px</span></div>
            <div class="puzzle-customizer-row"><span class="puzzle-customizer-label">\u6EA2\u51FA\u8DDD\u79BB</span><input class="puzzle-customizer-range" id="pzOverhang" type="range" min="0" max="${MAX_OVERHANG}" value="${d.overhang}"><span class="puzzle-customizer-value" id="pzOverhangVal">${d.overhang}</span></div>
            <div class="puzzle-customizer-mode-toggle"><button class="puzzle-customizer-mode-btn ${!isCoord?'active':''}" id="pzModeFlow">\u6D41\u5F0F</button><button class="puzzle-customizer-mode-btn ${isCoord?'active':''}" id="pzModeCoord">\u5750\u6807</button></div>
            ${isCoord ? `<div class="puzzle-customizer-row"><span class="puzzle-customizer-label">\u4F4D\u7F6E X</span><input class="puzzle-customizer-input" id="pzPosX" type="number" value="${pos.x}" min="0" max="${maxW}"><span class="puzzle-customizer-unit">px</span></div><div class="puzzle-customizer-row"><span class="puzzle-customizer-label">\u4F4D\u7F6E Y</span><input class="puzzle-customizer-input" id="pzPosY" type="number" value="${pos.y}" min="0" max="${maxH}"><span class="puzzle-customizer-unit">px</span></div>` : `<div class="puzzle-customizer-row" style="display:none" id="pzPosRow"><span class="puzzle-customizer-label" style="font-size:11px;color:var(--color-text-muted)">\u5750\u6807\u6A21\u5F0F\u5DF2\u7981\u7528</span></div>`}
            <div class="puzzle-customizer-image-section"><div class="puzzle-customizer-image-label">\u62FC\u56FE\u56FE\u7247</div><div class="puzzle-customizer-image-actions"><button class="puzzle-customizer-btn" id="pzUploadBtn">\u{1F4E4} \u4E0A\u4F20\u56FE\u7247</button><button class="puzzle-customizer-btn btn-reset" id="pzResetImgBtn">\u{1F504} \u6062\u590D\u9ED8\u8BA4</button></div>${image ? '<div style="font-size:11px;color:var(--color-text-muted);margin-top:4px">\u5DF2\u8BBE\u7F6E\u81EA\u5B9A\u4E49\u56FE\u7247</div>' : ''}</div>
            <div style="font-size:11px;color:var(--color-text-muted);margin-top:12px;padding-top:8px;border-top:1px solid var(--color-border)">\u9875\u9762\u53EF\u7528\u8303\u56F4\uFF1A\u6700\u5927 ${maxW}\u00D7${maxH}px</div>
            <div class="puzzle-customizer-actions"><button class="puzzle-customizer-btn btn-apply" id="pzApplyBtn">\u2705 \u5E94\u7528</button><button class="puzzle-customizer-btn btn-reset" id="pzResetBtn">\u21BA \u91CD\u7F6E</button><button class="puzzle-customizer-btn btn-cancel" id="pzCancelBtn">\u53D6\u6D88</button></div>
        </div>`;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });
        document.body.appendChild(overlay); this._overlay = overlay;
        this._panel = overlay.querySelector('.puzzle-customizer-panel');
    },

    _bindEvents() {
        this._$('pzCloseBtn')?.addEventListener('click', () => this.close());
        this._$('pzCancelBtn')?.addEventListener('click', () => this.close());
        this._$('pzWidth')?.addEventListener('input', () => this._validateAndPreview());
        this._$('pzHeight')?.addEventListener('input', () => this._validateAndPreview());
        this._$('pzBlockSize')?.addEventListener('input', () => this._validateAndPreview());
        this._$('pzOverhang')?.addEventListener('input', (e) => { const v = e.target.value; const d = this._$('pzOverhangVal'); if (d) d.textContent = v; this._draft.overhang = parseInt(v) || 0; });
        const fb = this._$('pzModeFlow'), cb = this._$('pzModeCoord');
        fb?.addEventListener('click', () => { fb.classList.add('active'); cb?.classList.remove('active'); this._draft.position = null; this._rebuildPositionInputs(); });
        cb?.addEventListener('click', () => { cb.classList.add('active'); fb?.classList.remove('active'); this._draft.position = { x: 200, y: 400 }; this._rebuildPositionInputs(); });

        this._$('pzUploadBtn')?.addEventListener('click', () => {
            const input = document.getElementById('puzzleCustomizerFileInput');
            if (input && this._overlay) { this._overlay.style.display = 'none'; this._expectingFile = true;
                const onFocus = () => { window.removeEventListener('focus', onFocus); if (this._expectingFile && this._overlay) { this._expectingFile = false; this._overlay.style.display = ''; } };
                window.addEventListener('focus', onFocus); input.click(); }
        });
        this._$('pzResetImgBtn')?.addEventListener('click', () => { AppState.commit(MUTATIONS.SET_PUZZLE_IMAGE, null); this._originalImage = null; try { localStorage.removeItem('puzzle_raw_image'); } catch (e) {} Utils.showToast(UI.puzzle.resetToDefault, false); this._updateImageHint(); });
        this._$('pzApplyBtn')?.addEventListener('click', () => this._apply());
        this._$('pzResetBtn')?.addEventListener('click', () => this._reset());
        const esc = (e) => { if (e.key === 'Escape') this.close(); }; document.addEventListener('keydown', esc); this._escHandler = esc;
    },

    _syncInputs() { const d = this._draft; this._setVal('pzWidth',d.width); this._setVal('pzHeight',d.height); this._setVal('pzBlockSize',d.blockSize); this._setVal('pzOverhang',d.overhang); const v=this._$('pzOverhangVal'); if(v)v.textContent=d.overhang; if(d.position){this._setVal('pzPosX',d.position.x);this._setVal('pzPosY',d.position.y);} },
    _validateAndPreview() { const mW=window.innerWidth-40,mH=window.innerHeight-100; let w=parseInt(this._$('pzWidth')?.value)||0,h=parseInt(this._$('pzHeight')?.value)||0; const b=parseInt(this._$('pzBlockSize')?.value)||72; const wOk=w>=MIN_WIDTH&&w<=mW,hOk=h>=MIN_HEIGHT&&h<=mH; this._toggleError('pzWidth',wOk,`\u5BBD\u5EA6\u9700\u5728 ${MIN_WIDTH}\u2013${mW} \u4E4B\u95F4`); this._toggleError('pzHeight',hOk,`\u9AD8\u5EA6\u9700\u5728 ${MIN_HEIGHT}\u2013${mH} \u4E4B\u95F4`); if(!wOk)w=this._draft.width; if(!hOk)h=this._draft.height; this._draft.width=w;this._draft.height=h;this._draft.blockSize=(b>=40&&b<=200)?b:this._draft.blockSize;this._draft.overhang=parseInt(this._$('pzOverhang')?.value)||0; },
    _preview() { const p=getPuzzleInstance(); if(!p)return; const d=this._draft; try{p.setSize(d.width,d.height);p.setOverhang(d.overhang);p.setPosition(d.position?d.position.x:null,d.position?d.position.y:null);p.updateConfig({blockSize:d.blockSize});p.reset();updatePuzzlePreview();}catch(e){} },

    // === 应用 ===
    _apply() {
        const img = this._originalImage;
        if (img && this._snapshot) {
            const oR = this._snapshot.width / this._snapshot.height, nR = this._draft.width / this._draft.height;
            const chg = this._draft.width !== this._snapshot.width || this._draft.height !== this._snapshot.height;
            if (chg && Math.abs(oR - nR) > 0.001) {
                if (confirm('\u62FC\u56FE\u5C3A\u5BF8\u5DF2\u6539\u53D8\uFF0C\u56FE\u7247\u6BD4\u4F8B\u4E0D\u518D\u5339\u914D\u3002\n\n\u300C\u786E\u5B9A\u300D\u91CD\u65B0\u88C1\u526A\u5F53\u524D\u56FE\u7247\n\u300C\u53D6\u6D88\u300D\u4E0D\u5E94\u7528\u6B64\u6B21\u4FEE\u6539')) {
                    if (this._overlay) this._overlay.style.display = 'none';
                    this._recropCurrentImage(); return;
                }
                this.close(); return;  // 取消 → 不应用尺寸修改
            }
        }
        this._applyAndClose();
    },

    _applyAndClose() {
        this._validateAndPreview(); const p = getPuzzleInstance();
        if (p) { this._preview(); p.save(); p.render(); }
        this._snapshot = { ...this._draft, position: this._draft.position ? { ...this._draft.position } : null };
        Utils.showToast('\u62FC\u56FE\u914D\u7F6E\u5DF2\u5E94\u7528', false); updatePuzzlePreview(); this.close();
    },

    /** 在新比例下裁剪当前图片。确认→保存；取消→_restoreSnapshot */
    _recropCurrentImage() {
        // 优先使用原始上传图片（localStorage），避免"裁剪之裁剪"的质量损失
        const rawUrl = (typeof localStorage !== 'undefined') ? localStorage.getItem('puzzle_raw_image') : null;
        const dataUrl = rawUrl || this._originalImage;
        if (!dataUrl) { this._applyAndClose(); return; }
        const draft = { ...this._draft, position: this._draft.position ? { ...this._draft.position } : null };
        const p = getPuzzleInstance();
        if (p) { p.setSize(draft.width, draft.height); p.setOverhang(draft.overhang); p.updateConfig({ blockSize: draft.blockSize }); p.reset(); }
        const cfg = p ? p.getConfig() : draft;
        const file = this._dataUrlToFile(dataUrl);
        if (!file) { this._finishRecrop(); return; }
        AdminAvatar.openCustomCrop(file, cfg.width / cfg.height, cfg.width,
            (newUrl) => { // 确认
                AppState.commit(MUTATIONS.SET_PUZZLE_IMAGE, newUrl); this._snapshot = draft;
                if (p) { p.save(); p.reset(); }
                Utils.showToast(UI.puzzle.imageUpdated, false); updatePuzzlePreview(); this._finishRecrop();
            },
            () => { this._restoreSnapshot(); updatePuzzlePreview(); this._finishRecrop(); } // 取消
        );
    },

    _finishRecrop() { this._unlockScroll(); this._visible = false;
        if (this._escHandler) { document.removeEventListener('keydown', this._escHandler); this._escHandler = null; }
        if (this._overlay?.parentNode) this._overlay.parentNode.removeChild(this._overlay);
        this._overlay = null; this._panel = null; },

    _dataUrlToFile(dataUrl) { try {
        const a = dataUrl.split(','), m = a[0].match(/:(.*?);/)?.[1] || 'image/png';
        const b = atob(a[1]), n = b.length, u = new Uint8Array(n);
        for (let i = 0; i < n; i++) u[i] = b.charCodeAt(i);
        return new File([u], 'puzzle.' + (m.split('/')[1] || 'png'), { type: m });
    } catch (e) { Utils.showToast('\u56FE\u7247\u89E3\u7801\u5931\u8D25', true); return null; } },

    _reset() { this._draft = { width: 480, height: 180, blockSize: 72, overhang: 100, position: null }; this._syncInputs();
        AppState.commit(MUTATIONS.SET_PUZZLE_IMAGE, null); this._originalImage = null; try { localStorage.removeItem('puzzle_raw_image'); } catch (e) {} this._updateImageHint(); Utils.showToast('\u62FC\u56FE\u5DF2\u6062\u590D\u9ED8\u8BA4\u914D\u7F6E',false); },

    _rebuildPositionInputs() { const row = this._$('pzPosRow'); if (!row) return; const c = this._draft.position !== null, pos = this._draft.position || { x: 200, y: 400 }, mW = window.innerWidth - 40, mH = window.innerHeight - 100;
        if (c) { row.style.display = ''; row.innerHTML = `<span class="puzzle-customizer-label">\u4F4D\u7F6E X</span><input class="puzzle-customizer-input" id="pzPosX" type="number" value="${pos.x}" min="0" max="${mW}"><span class="puzzle-customizer-unit">px</span>`;
            const yR = document.createElement('div'); yR.className = 'puzzle-customizer-row'; yR.id = 'pzPosYRow'; yR.innerHTML = `<span class="puzzle-customizer-label">\u4F4D\u7F6E Y</span><input class="puzzle-customizer-input" id="pzPosY" type="number" value="${pos.y}" min="0" max="${mH}"><span class="puzzle-customizer-unit">px</span>`; row.parentNode.insertBefore(yR, row.nextSibling);
            this._$('pzPosX')?.addEventListener('input', () => { const x = parseInt(this._$('pzPosX')?.value) || 0; if (this._draft.position) this._draft.position.x = x; });
            this._$('pzPosY')?.addEventListener('input', () => { const y = parseInt(this._$('pzPosY')?.value) || 0; if (this._draft.position) this._draft.position.y = y; });
        } else { row.style.display = 'none'; const yR = document.getElementById('pzPosYRow'); if (yR) yR.remove(); } },

    _updateImageHint() { const s = this._panel?.querySelector('.puzzle-customizer-image-section'); if (!s) return; const h = s.querySelector('div:last-child'); if (h?.style?.fontSize === '11px') h.textContent = AppState.get('puzzleImage') ? '\u5DF2\u8BBE\u7F6E\u81EA\u5B9A\u4E49\u56FE\u7247' : ''; },
    _$(id) { return this._panel?.querySelector('#' + id) || null; },
    _setVal(id, v) { const e = this._$(id); if (e) e.value = v; },
    _toggleError(id, ok, msg) { const e = document.getElementById(id + 'Error'); if (e) e.textContent = ok ? '' : msg; const i = this._$(id); if (i) i.classList.toggle('input-error', !ok); },
    _ensureCSS() { if (document.getElementById('puzzle-customizer-css')) return; const l = document.createElement('link'); l.id = 'puzzle-customizer-css'; l.rel = 'stylesheet'; l.href = '/css/components/puzzle-customizer.css'; document.head.appendChild(l); },
    _lockScroll() { this._scrollState = { x: window.scrollX, y: window.scrollY }; this._prevOverflow = document.body.style.overflow; this._prevPosition = document.body.style.position; this._prevTop = document.body.style.top; this._prevWidth = document.body.style.width; document.body.style.overflow = 'hidden'; document.body.style.position = 'fixed'; document.body.style.top = `-${this._scrollState.y}px`; document.body.style.width = '100%'; this._tH = (e) => { if (!e.target.closest('.puzzle-customizer-panel')) e.preventDefault(); }; this._wH = (e) => { if (!e.target.closest('.puzzle-customizer-panel')) e.preventDefault(); }; document.addEventListener('touchmove', this._tH, { passive: false }); document.addEventListener('wheel', this._wH, { passive: false }); },
    _unlockScroll() { document.body.style.overflow = this._prevOverflow || ''; document.body.style.position = this._prevPosition || ''; document.body.style.top = this._prevTop || ''; document.body.style.width = this._prevWidth || ''; if (this._scrollState) { window.scrollTo(this._scrollState.x, this._scrollState.y); this._scrollState = null; } if (this._tH) { document.removeEventListener('touchmove', this._tH); this._tH = null; } if (this._wH) { document.removeEventListener('wheel', this._wH); this._wH = null; } this._prevOverflow = null; this._prevPosition = null; this._prevTop = null; this._prevWidth = null; },
    _restoreSnapshot() { if (!this._snapshot) return; const p = getPuzzleInstance(); if (!p) return; const s = this._snapshot; try { p.setSize(s.width,s.height); p.setOverhang(s.overhang); p.setPosition(s.position?s.position.x:null,s.position?s.position.y:null); p.updateConfig({blockSize:s.blockSize}); updatePuzzlePreview(); } catch(e){} },
};

export function handleOpenPuzzleCustomizer() { PuzzleCustomizer.open(); }

export function bindPuzzleFileUpload() {
    const input = document.getElementById('puzzleCustomizerFileInput'); if (!input) return;
    const h = input._pzHandler; if (h) input.removeEventListener('change', h);
    const nh = function (e) {
        PuzzleCustomizer._expectingFile = false; const f = e.target.files[0]; e.target.value = '';
        const show = () => { if (PuzzleCustomizer._overlay) PuzzleCustomizer._overlay.style.display = ''; };
        if (!f) { show(); return; }
        if (!f.type.startsWith('image/')) { Utils.showToast(UI.puzzle.invalidFormat, true); show(); return; }
        if (PuzzleCustomizer._overlay) PuzzleCustomizer._overlay.style.display = 'none';
        const p = getPuzzleInstance(); const c = p ? p.getConfig() : { width: 480, height: 180 };
        // 保存原始图片 dataUrl，后续比例变更重裁剪始终从原始图开始
        const reader = new FileReader();
        reader.onload = function (ev) {
            try { localStorage.setItem('puzzle_raw_image', ev.target.result); } catch (e) {}
            AdminAvatar.openCustomCrop(f, c.width / c.height, c.width,
                (url) => { AppState.commit(MUTATIONS.SET_PUZZLE_IMAGE, url); Utils.showToast(UI.puzzle.imageUpdated, false); show(); PuzzleCustomizer._updateImageHint(); },
                show);
        };
        reader.readAsDataURL(f);
    }; input._pzHandler = nh; input.addEventListener('change', nh);
}
