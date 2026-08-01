// BroadcastChannel 跨标签页通信辅助
// 封装原始 BroadcastChannel API，提供类型化消息收发、自动清理。
// 模式参考项目现有 Service，使用对象字面量。
export const BroadcastHelper = {
  _channel: null,
  _listeners: [],

  /** 初始化频道（幂等：重复调用仅更新监听器，不会重复创建） */
  init(channelName) {
    if (this._channel && this._channel.name === channelName) {
      // 频道名不变，仅重新挂载监听器
      this._channel.onmessage = (event) => this._dispatch(event.data);
      return;
    }
    this.close();
    try {
      this._channel = new BroadcastChannel(channelName);
      this._channel.onmessage = (event) => this._dispatch(event.data);
    } catch (_) {
      console.warn('[BroadcastHelper] BroadcastChannel API 不可用');
      this._channel = null;
    }
  },

  /** 注册消息处理器，返回取消函数 */
  on(filter, callback) {
    const entry = { filter, callback };
    this._listeners.push(entry);
    return () => {
      const idx = this._listeners.indexOf(entry);
      if (idx !== -1) this._listeners.splice(idx, 1);
    };
  },

  /** 发送类型化消息 */
  send(type, payload = {}) {
    if (!this._channel) return;
    try {
      this._channel.postMessage({ type, payload, ts: Date.now() });
    } catch (_) { /* ignore */ }
  },

  /** 分发消息到匹配的监听器 */
  _dispatch(data) {
    if (!data || !data.type) return;
    this._listeners.forEach(({ filter, callback }) => {
      try {
        if (typeof filter === 'string' && filter === data.type) callback(data);
        else if (typeof filter === 'function' && filter(data)) callback(data);
      } catch (e) {
        console.error('[BroadcastHelper] 监听器错误:', e);
      }
    });
  },

  /** 关闭频道，清理所有监听器 */
  close() {
    this._listeners = [];
    if (this._channel) {
      try { this._channel.close(); } catch (_) { /* ignore */ }
      this._channel = null;
    }
  },
};
