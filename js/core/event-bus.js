// @ts-check

// ========== 事件总线 ==========
export const EventBus = {
  _events: {},

  // ===== 订阅事件 =====
  on: function (eventName, callback) {
    if (!this._events[eventName]) {
      this._events[eventName] = [];
    }
    this._events[eventName].push(callback);
    return this;
  },

  // ===== 取消订阅 =====
  off: function (eventName, callback) {
    if (!this._events[eventName]) return this;
    if (callback) {
      this._events[eventName] = this._events[eventName].filter(function (cb) {
        return cb !== callback;
      });
    } else {
      delete this._events[eventName];
    }
    return this;
  },

  // ===== 触发事件 =====
  emit: function (eventName, data) {
    if (!this._events[eventName]) return;
    const callbacks = this._events[eventName];
    for (let i = 0; i < callbacks.length; i++) {
      try {
        callbacks[i](data);
      } catch (e) {
        console.error('[EventBus] 事件处理错误:', eventName, e);
      }
    }
  },

  // ===== 一次性订阅 =====
  once: function (eventName, callback) {
    const self = this;
    const wrapper = function (data) {
      callback(data);
      self.off(eventName, wrapper);
    };
    this.on(eventName, wrapper);
    return this;
  },

  // ===== 清除所有事件 =====
  clear: function () {
    this._events = {};
    return this;
  },
};

console.log('✅ EventBus 已加载 (ES Module)');
