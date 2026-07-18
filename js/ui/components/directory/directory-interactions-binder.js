import { bindInteractions, handleNodeClick, setActiveNode } from './events.js';
import { showContextMenu } from './context-menu.js';
import { handleFolderToggle } from './folder-state.js';
import { handleVisibilityToggle } from './directory-visibility.js';
import { AppState } from '../../../core/app-state.js';

/**
 * 绑定目录树所有交互事件
 * @param {HTMLElement} container - 目录树容器
 * @param {Object} callbacks - 回调对象
 * @param {Function} callbacks.onUpdateTree - 更新树函数
 * @param {Function} callbacks.onSetActiveNode - 设置激活节点
 * @param {Function} callbacks.onVisibilityToggleSuccess - 可见性切换成功回调
 * @returns {Function} 清理函数
 */
export function bindDirectoryInteractions(container, callbacks) {
    const {
        onUpdateTree,
        onSetActiveNode,
        onVisibilityToggleSuccess,
    } = callbacks;

    let unbindEventsFn = null;
    let visibilityHandler = null;

    // 可见性切换事件
    visibilityHandler = async function(e) {
        const success = await handleVisibilityToggle(e, onVisibilityToggleSuccess);
        // 如果切换成功，刷新树（因为可见性变化会影响列表）
        if (success && onUpdateTree) {
            onUpdateTree();
        }
    };
    container.addEventListener('directory-toggle-visibility', visibilityHandler);

    // 交互事件（单击、双击、右键）
    const contextMenuHandler = (x, y, type, name, articleId, nodeLi) => {
        showContextMenu(x, y, type, name, articleId, nodeLi, () => {
            if (onUpdateTree) onUpdateTree();
        });
    };

    const handleNodeClickFn = (nodeElement, nodeData, isDouble) => {
        handleNodeClick(nodeElement, nodeData, isDouble, (nodeId) => {
            if (onSetActiveNode) onSetActiveNode(nodeId);
        });
    };

    const setActiveNodeFn = (nodeId) => {
        if (onSetActiveNode) onSetActiveNode(nodeId);
    };

    const unbind = bindInteractions(
        container,
        contextMenuHandler,
        handleNodeClickFn,
        setActiveNodeFn
    );
    unbindEventsFn = unbind;

    // 折叠状态切换（存储引用以便清理）
    const folderToggleHandler = (e) => {
        handleFolderToggle(e, container);
    };
    container.addEventListener('click', folderToggleHandler);

    // 返回清理函数
    return function unbindAll() {
        if (unbindEventsFn) {
            unbindEventsFn();
            unbindEventsFn = null;
        }
        if (visibilityHandler) {
            container.removeEventListener('directory-toggle-visibility', visibilityHandler);
            visibilityHandler = null;
        }
        container.removeEventListener('click', folderToggleHandler);
    };
}