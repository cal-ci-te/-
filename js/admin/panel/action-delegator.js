// ========== 事件委托器（基于 data-action） ==========
// 移除未使用的 DOMRefs 导入

export const ActionDelegator = {
  _container: null,
  _handlers: {},
  _boundEvents: false,

  register(action, handler) {
    if (typeof handler !== 'function') {
      console.warn(`[ActionDelegator] "${action}" 的处理器不是函数`);
      return;
    }
    if (this._handlers[action]) {
      console.warn(`[ActionDelegator] "${action}" 已被注册，将被覆盖`);
    }
    this._handlers[action] = handler;
    console.log(`[ActionDelegator] 注册 action: ${action}`);
  },

  registerAll(handlerMap) {
    for (const [action, handler] of Object.entries(handlerMap)) {
      this.register(action, handler);
    }
  },

  init(container) {
    if (!container) {
      console.error('[ActionDelegator] 容器不存在，初始化失败');
      return;
    }
    // 如果已经绑定，先销毁并清空处理器
    if (this._boundEvents) {
      this.destroy();
    }
    this._container = container;
    const eventTypes = ['click', 'change', 'input'];
    eventTypes.forEach((type) => {
      container.addEventListener(type, this._handleEvent);
    });
    this._boundEvents = true;
    console.log('[ActionDelegator] 已初始化，容器:', container.id || container.tagName);
  },

  destroy() {
    if (!this._boundEvents || !this._container) return;
    const eventTypes = ['click', 'change', 'input'];
    eventTypes.forEach((type) => {
      this._container.removeEventListener(type, this._handleEvent);
    });
    this._boundEvents = false;
    this._container = null;
    // ✅ 清空所有已注册的处理器，避免重复注册警告
    this._handlers = {};
    console.log('[ActionDelegator] 已销毁');
  },

  _handleEvent(event) {
    const target = event.target;
    if (!target) return;

    const actionElement = target.closest('[data-action]');
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    if (!action) return;

    if (event.type === 'change') {
      const tag = target.tagName.toLowerCase();
      if (!['select', 'input'].includes(tag)) return;
    }

    const handler = ActionDelegator._handlers[action];
    if (!handler) {
      console.warn(`[ActionDelegator] 未找到 action 的处理器: ${action}`);
      return;
    }

    if (actionElement.tagName === 'BUTTON' || actionElement.tagName === 'A') {
      event.preventDefault();
    }

    try {
      handler(event);
    } catch (error) {
      console.error(`[ActionDelegator] 执行处理器 "${action}" 时出错:`, error);
    }
  },
};

console.log('✅ ActionDelegator 已加载');
