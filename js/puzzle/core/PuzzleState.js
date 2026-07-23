// 每个 Puzzle 实例的独立状态管理 — 不依赖全局 AppState。
// 持有配置快照、图片、完成标志、进度值，变更时通过 EventEmitter 通知。
import { EventEmitter } from './EventEmitter.js';

const DEFAULTS = {
    width: 480,
    height: 180,
    blockSize: 72,
    gapSize: 72,
    overhang: 200,
    position: null,        // { x, y } | null = 流式模式
    image: null,           // dataUrl | null
    autoSave: true,
    storageKey: 'rv_puzzle_state',
};

export class PuzzleState {
    constructor(config = {}) {
        this._events = new EventEmitter();
        this._config = { ...DEFAULTS, ...config };
        this._image = this._config.image || null;
        this._completed = false;
        this._progress = 0;       // 0–1
        this._gapX = 0;           // 缺口 X 坐标（随机生成）
    }

    // ---- 事件代理 ----
    on(event, cb)   { this._events.on(event, cb); return this; }
    off(event, cb)  { this._events.off(event, cb); return this; }
    emit(event, data) { this._events.emit(event, data); }
    once(event, cb)  { this._events.once(event, cb); return this; }

    // ---- 配置读写 ----
    getConfig() {
        return { ...this._config };
    }

    updateConfig(partial) {
        Object.assign(this._config, partial);
        this.emit('config:changed', this.getConfig());
    }

    setSize(width, height) {
        this._config.width = width;
        this._config.height = height;
        this.emit('config:changed', this.getConfig());
    }

    setOverhang(px) {
        this._config.overhang = Math.max(0, Math.min(px, 500));
    }

    setPosition(x, y) {
        if (x === null) {
            this._config.position = null;
        } else {
            this._config.position = { x, y };
        }
    }

    // ---- 图片读写 ----
    getImage() {
        return this._image;
    }

    setImage(dataUrl) {
        this._image = dataUrl || null;
        this.emit('image:changed', this._image);
    }

    // ---- 缺口位置 ----
    getGapX() {
        return this._gapX;
    }

    resetGapX() {
        const w = this._config.width;
        const gapW = this._config.gapSize;
        // 缺口随机范围：避开两端各 100px
        this._gapX = 100 + Math.random() * (w - gapW - 200);
        if (this._gapX < 100) this._gapX = 100;
    }

    // ---- 完成状态 ----
    isCompleted() {
        return this._completed;
    }

    setCompleted(val) {
        const prev = this._completed;
        this._completed = !!val;
        if (this._completed !== prev) {
            this.emit('completed:changed', this._completed);
            if (this._completed) this.emit('complete');
        }
    }

    // ---- 进度 ----
    getProgress() {
        return this._progress;
    }

    setProgress(val) {
        this._progress = Math.max(0, Math.min(1, val));
        this.emit('progress', this._progress);
    }

    // ---- 序列化 ----
    exportState() {
        return {
            config: this.getConfig(),
            image: this._image,
            completed: this._completed,
        };
    }

    importState(data) {
        if (!data) return;
        if (data.config) this.updateConfig(data.config);
        if (data.image !== undefined) this.setImage(data.image);
        if (data.completed !== undefined) this.setCompleted(data.completed);
    }

    destroy() {
        this._events.destroy();
    }
}
