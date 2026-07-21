import { Utils } from '../utils.js';
import { ArticleService } from '../services/article-service.js';
import { EventBus } from '../core/event-bus.js';
import { EVENTS } from '../core/event-constants.js';
import { UI } from '../utils/ui-strings.js';

let touchDragData = null;
let touchClone = null;
let dragContainer = null;

/**
 * 启用移动端触摸拖拽
 * @param {HTMLElement} container - 目录树容器
 * @param {Function} onDrop - 放置回调 (sourceData, targetData) => void
 * @param {Function} updateTreeFn - 更新树回调
 */
export function enableTouchDrag(container, onDrop, updateTreeFn) {
    if (!container) {
        console.warn('[TouchDrag] 容器不存在');
        return () => {};
    }

    dragContainer = container;

    const onTouchStart = function (e) {
        // 忽略按钮、输入框等交互元素
        if (e.target.closest('button') || e.target.closest('input')) return;
        if (e.target.closest('.visibility-toggle') || e.target.closest('.toggle-icon')) return;

        const target = e.target.closest('.tree-node');
        if (!target) return;

        // 检查是否有管理员权限
        const isAdmin = window.__REVACHOL__.AppState?.get('isLoggedIn') || false;
        if (!isAdmin) {
            Utils.showToast(UI.toast.touchAdminRequiredDrag, true);
            return;
        }

        const touch = e.touches[0];
        if (!touch) return;

        const type = target.dataset.type;
        const id = type === 'folder' ? target.dataset.name : target.dataset.articleId;
        if (!id) return;

        touchDragData = {
            type: type,
            id: id,
            node: target,
            name: target.dataset.name || '',
            articleId: type === 'article' ? parseInt(target.dataset.articleId) : null,
            parent: target.parentNode,
            startX: touch.clientX,
            startY: touch.clientY,
        };

        // 创建拖拽视觉反馈
        touchClone = target.cloneNode(true);
        touchClone.style.cssText = `
            position: fixed;
            opacity: 0.85;
            pointer-events: none;
            z-index: 99999;
            background: #3a2a1a;
            border: 2px solid #c47a44;
            border-radius: 6px;
            padding: 6px 14px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.6);
            transform: scale(1.05);
            transition: none;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #e8d5b5;
            font-size: 13px;
        `;
        // 提取文本内容（去除多余元素）
        const titleSpan = touchClone.querySelector('.node-title');
        if (titleSpan) {
            touchClone.innerHTML = titleSpan.textContent;
        }
        touchClone.style.left = (touch.clientX - 40) + 'px';
        touchClone.style.top = (touch.clientY - 20) + 'px';
        document.body.appendChild(touchClone);

        target.classList.add('dragging');
        e.preventDefault();
        e.stopPropagation();
    };

    const onTouchMove = function (e) {
        if (!touchDragData || !touchClone) return;

        const touch = e.touches[0];
        if (!touch) return;

        // 移动拖拽克隆体
        touchClone.style.left = (touch.clientX - 40) + 'px';
        touchClone.style.top = (touch.clientY - 20) + 'px';

        // 清除高亮
        container.querySelectorAll('.drag-over, .dropzone-sibling-highlight').forEach(el => {
            el.classList.remove('drag-over', 'dropzone-sibling-highlight');
            if (el.classList.contains('dropzone-background')) {
                el.style.borderColor = '';
                el.style.background = '';
            }
            if (el.classList.contains('tree-node')) {
                el.style.outline = '';
            }
        });

        // 检测当前触摸点下方的元素
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target) {
            const node = target.closest('.tree-node, .dropzone-background');
            if (node) {
                if (node.classList.contains('tree-node')) {
                    // 检查是否在节点下半部分（平级放置）
                    const rect = node.getBoundingClientRect();
                    const y = touch.clientY;
                    const isLowerHalf = (y - rect.top) > (rect.height / 2);
                    if (isLowerHalf && node.dataset.type === 'folder') {
                        node.classList.add('dropzone-sibling-highlight');
                        node.style.outline = '2px dashed #c47a44';
                        node.style.outlineOffset = '-2px';
                    } else {
                        node.classList.add('drag-over');
                    }
                } else if (node.classList.contains('dropzone-background')) {
                    node.classList.add('drag-over');
                    node.style.borderColor = '#c47a44';
                    node.style.background = 'rgba(196, 122, 68, 0.15)';
                }
            }
        }

        e.preventDefault();
    };

    const onTouchEnd = async function (e) {
        if (!touchDragData) {
            cleanup();
            return;
        }

        const touch = e.changedTouches[0];
        if (!touch) {
            cleanup();
            touchDragData = null;
            return;
        }

        const target = document.elementFromPoint(touch.clientX, touch.clientY);

        // 清理视觉元素
        cleanup();

        if (!target) {
            touchDragData = null;
            return;
        }

        const dropTarget = target.closest('.tree-node, .dropzone-background');
        if (!dropTarget) {
            touchDragData = null;
            Utils.showToast(UI.toast.touchDragToValidTarget, true);
            return;
        }

        // 构建目标数据
        let targetFolderId = null;
        let isSibling = false;

        if (dropTarget.classList.contains('dropzone-background')) {
            isSibling = true;
        } else if (dropTarget.classList.contains('tree-node')) {
            const targetType = dropTarget.dataset.type;
            if (targetType === 'folder') {
                const rect = dropTarget.getBoundingClientRect();
                const y = touch.clientY;
                isSibling = (y - rect.top) > (rect.height / 2);
                if (isSibling) {
                    // 平级：获取该文件夹的父级
                    const cat = ArticleService.findCategoryById(dropTarget.dataset.name);
                    targetFolderId = cat?.parent || null;
                } else {
                    targetFolderId = dropTarget.dataset.name;
                }
            } else if (targetType === 'article') {
                const articleId = parseInt(dropTarget.dataset.articleId);
                const articles = ArticleService.getAllArticles() || [];
                const article = articles.find(a => a.id === articleId);
                targetFolderId = article?.category || '未分类';
                isSibling = false;
            }
        }

        if (onDrop && typeof onDrop === 'function') {
            try {
                await onDrop(touchDragData, {
                    targetFolderId: targetFolderId || null,
                    isSibling: isSibling,
                });
                if (updateTreeFn) updateTreeFn();
            } catch (err) {
                console.error('[TouchDrag] 拖拽失败:', err);
                Utils.showToast(UI.toast.touchMoveFailed(err.message), true);
            }
        } else {
            console.warn('[TouchDrag] onDrop 回调未提供');
        }

        touchDragData = null;
    };

    const onTouchCancel = function () {
        cleanup();
        touchDragData = null;
    };

    const cleanup = function () {
        if (touchClone) {
            touchClone.remove();
            touchClone = null;
        }
        container.querySelectorAll('.dragging, .drag-over, .dropzone-sibling-highlight').forEach(el => {
            el.classList.remove('dragging', 'drag-over', 'dropzone-sibling-highlight');
            if (el.classList.contains('dropzone-background')) {
                el.style.borderColor = '';
                el.style.background = '';
            }
            if (el.classList.contains('tree-node')) {
                el.style.outline = '';
            }
        });
    };

    // 绑定事件
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('touchcancel', onTouchCancel, { passive: false });

    console.log('[TouchDrag] 移动端触摸拖拽已启用');

    // 返回清理函数
    return function disableTouchDrag() {
        container.removeEventListener('touchstart', onTouchStart);
        container.removeEventListener('touchmove', onTouchMove);
        container.removeEventListener('touchend', onTouchEnd);
        container.removeEventListener('touchcancel', onTouchCancel);
        cleanup();
        console.log('[TouchDrag] 移动端触摸拖拽已禁用');
    };
}