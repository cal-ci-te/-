import { UI } from '../utils/ui-strings.js';


let longPressTimer = null;
let longPressTarget = null;

/**
 * 为容器启用长按触发上下文菜单
 * @param {HTMLElement} container - 容器元素
 * @param {Function} showMenuFn - 显示菜单函数 (x, y, targetData) => void
 * @param {number} duration - 长按时间阈值（毫秒）
 */
export function enableTouchContext(container, showMenuFn, duration = 500) {
    if (!container) return () => {};

    const onTouchStart = function (e) {
        const target = e.target.closest('.tree-node-content');
        if (!target) return;
        if (e.target.closest('button') || e.target.closest('input')) return;

        longPressTarget = target;
        const touch = e.touches[0];
        longPressTimer = setTimeout(() => {
            const nodeLi = target.closest('.tree-node');
            if (!nodeLi) return;
            const isAdmin = window.__REVACHOL__.AppState?.get('isLoggedIn') || false;
            if (!isAdmin) {
                Utils.showToast(UI.toast.touchAdminRequired, true);
                return;
            }
            const type = nodeLi.dataset.type;
            const name = nodeLi.dataset.name;
            const articleId = nodeLi.dataset.articleId ? parseInt(nodeLi.dataset.articleId) : null;
            if (showMenuFn && typeof showMenuFn === 'function') {
                showMenuFn(touch.clientX, touch.clientY, type, name, articleId, nodeLi);
            }
            // 标记已触发长按，阻止后续点击
            container._longPressTriggered = true;
        }, duration);
    };

    const onTouchMove = function () {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        longPressTarget = null;
    };

    const onTouchEnd = function () {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        longPressTarget = null;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    return function disableTouchContext() {
        container.removeEventListener('touchstart', onTouchStart);
        container.removeEventListener('touchmove', onTouchMove);
        container.removeEventListener('touchend', onTouchEnd);
        clearTimeout(longPressTimer);
    };
}