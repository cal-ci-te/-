// 存储抽象层 — 可插拔：默认使用 localStorage，可注入任意实现。
// 每实例持有独立 storageKey，避免多实例互相覆盖。
export class StorageAdapter {
    /**
     * @param {object} options
     * @param {string} options.storageKey - localStorage 键名
     * @param {object} [options.backend] - 自定义存储后端（需实现 getItem/setItem/removeItem）
     */
    constructor(options = {}) {
        this._key = options.storageKey || 'rv_puzzle_state';
        this._backend = options.backend || (typeof localStorage !== 'undefined' ? localStorage : null);
    }

    save(data) {
        if (!this._backend) return false;
        try {
            this._backend.setItem(this._key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.warn('[Puzzle:Storage] 保存失败:', e);
            return false;
        }
    }

    load() {
        if (!this._backend) return null;
        try {
            const raw = this._backend.getItem(this._key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn('[Puzzle:Storage] 读取失败:', e);
            return null;
        }
    }

    remove() {
        if (!this._backend) return;
        try {
            this._backend.removeItem(this._key);
        } catch (e) { /* silent */ }
    }

    /** 动态切换键名（多实例支持） */
    setKey(key) {
        this._key = key;
    }
}
