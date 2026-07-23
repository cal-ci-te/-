// 零依赖内部事件系统 — 每个 Puzzle 实例独立持有，不依赖全局 EventBus。
// 提供 on / off / emit / once 四个方法，逐个 try-catch 确保一个回调报错不影响其他。
export class EventEmitter {
    constructor() {
        this._events = {};
    }

    on(eventName, callback) {
        if (!this._events[eventName]) this._events[eventName] = [];
        this._events[eventName].push(callback);
        return this;
    }

    off(eventName, callback) {
        if (!this._events[eventName]) return this;
        if (callback) {
            this._events[eventName] = this._events[eventName].filter(cb => cb !== callback);
        } else {
            delete this._events[eventName];
        }
        return this;
    }

    emit(eventName, data) {
        if (!this._events[eventName]) return;
        this._events[eventName].forEach(cb => {
            try { cb(data); } catch (e) { console.error('[Puzzle:EventEmitter]', eventName, e); }
        });
    }

    once(eventName, callback) {
        const wrapper = (data) => { callback(data); this.off(eventName, wrapper); };
        this.on(eventName, wrapper);
        return this;
    }

    destroy() {
        this._events = {};
    }
}
