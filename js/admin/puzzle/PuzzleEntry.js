// 拼图自定义入口 — 替换管理面板中原有的上传/重置按钮。
// 提供"打开自定义面板"按钮 + 当前配置预览，通过 data-action 委托给 ActionDelegator。
import { AppState } from '../../core/app-state.js';
import { UI } from '../../utils/ui-strings.js';

/** 生成 PuzzleEntry 的 HTML 片段，供 AdminPanel.renderContent 内联使用 */
/** 移动端禁用拼图自定义入口（拼图为流式布局，无坐标/尺寸调整需求） */
export function renderPuzzleEntry() {
    if (window.innerWidth <= 600) return '';

    const config = _getCurrentConfig();
    const preview = config
        ? `${config.width}×${config.height}`
        : '480×180';

    return `
        <div class="admin-control-group" style="border-top: 1px solid var(--color-border); padding-top: 12px; margin-top: 12px;">
            <label>${UI.puzzle.title}</label>
            <div class="admin-button-group" style="margin:6px 0;">
                <button id="openPuzzleCustomizerBtn" data-action="open-puzzle-customizer" style="background:var(--color-success);">
                    🧩 拼图自定义
                </button>
                <span id="puzzleConfigPreview" style="
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    color: var(--color-text-muted);
                    padding: 6px 8px;
                    border: 1px solid var(--color-border);
                    border-radius: 4px;
                    background: var(--color-bg-tertiary);
                ">${preview}</span>
            </div>
            <input type="file" id="puzzleCustomizerFileInput" accept="image/*" style="display:none;">
            <div class="admin-avatar-hint">点击「拼图自定义」调整尺寸、位置、图片等参数</div>
        </div>`;
}

/** 更新配置预览文字 */
export function updatePuzzlePreview() {
    const el = document.getElementById('puzzleConfigPreview');
    if (!el) return;
    const config = _getCurrentConfig();
    el.textContent = config ? `${config.width}×${config.height}` : '480×180';
}

function _getCurrentConfig() {
    try {
        const inst = window.__puzzleInstance;
        if (inst && typeof inst.getConfig === 'function') {
            return inst.getConfig();
        }
    } catch (e) { /* 忽略 */ }
    return null;
}

/** 获取拼图实例引用 */
export function getPuzzleInstance() {
    return window.__puzzleInstance || null;
}
