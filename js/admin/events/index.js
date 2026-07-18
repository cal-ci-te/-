import { ContextMenu } from './context-menu.js';
import { AdminPanel } from '../panel/index.js';

export const AdminEvents = {
  bindEvents: function () {
    console.log('[AdminEvents] 绑定所有事件...');

    // 1. 初始化右键菜单（独立，不受影响）
    if (ContextMenu && typeof ContextMenu.init === 'function') {
      ContextMenu.init();
    }

    // 2. 重新初始化面板事件委托器（关键！）
    if (AdminPanel && typeof AdminPanel.bindEvents === 'function') {
      AdminPanel.bindEvents();
    }

    // 3. 折叠按钮直接绑定（由 render.js 提供，确保调用）
    if (AdminPanel && typeof AdminPanel._bindToggleIconDirect === 'function') {
      AdminPanel._bindToggleIconDirect();
    }

    console.log('[AdminEvents] 所有事件绑定完成');
  },

  unbindEvents: function () {
    console.log('[AdminEvents] 解绑所有事件...');

    if (ContextMenu && typeof ContextMenu.hide === 'function') {
      ContextMenu.hide();
    }

    // UI 控制事件已迁移至 AdminPanel，由 panel/events.js 统一清理
    if (AdminPanel && typeof AdminPanel.unbindEvents === 'function') {
      AdminPanel.unbindEvents();
    }

    console.log('[AdminEvents] 所有事件已解绑');
  },

  rebind: function () {
    this.unbindEvents();
    this.bindEvents();
  },
};

