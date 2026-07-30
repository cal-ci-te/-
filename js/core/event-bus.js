// ！模块内通信
// 发布-订阅事件总线。用于跨模块松耦合通信（如登录→UI刷新、可见性变更→目录树更新）。
// 选择自研而非使用 CustomEvent/DOM 事件：避免 DOM 依赖，保持纯数据流，便于单元测试。
export const EventBus = {
  _events: {},

  on(eventName, callback) {
    if (!this._events[eventName]) this._events[eventName] = [];
    this._events[eventName].push(callback);
    return this;
  },

  off(eventName, callback) {
    if (!this._events[eventName]) return this;
    if (callback) {
      this._events[eventName] = this._events[eventName].filter(cb => cb !== callback);
    } else {
      delete this._events[eventName];
    }
    return this;
  },

  emit(eventName, data) {
    if (!this._events[eventName]) return;
    // 逐个 try-catch：确保一个回调报错不影响其他回调执行
    this._events[eventName].forEach(cb => {
      try { cb(data); } catch (e) { console.error('[EventBus] 事件处理错误:', eventName, e); }
    });
  },

  once(eventName, callback) {
    const wrapper = (data) => { callback(data); this.off(eventName, wrapper); };
    this.on(eventName, wrapper);
    return this;
  },

  clear() { this._events = {}; return this; },
};
