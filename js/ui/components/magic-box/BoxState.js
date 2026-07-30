// 超现实箱子状态管理 — 位置、打开计数、上次物品 ID、自定义图片。
// 持久化到 localStorage（键名 rv_box_data），变更后自动保存。
const STORAGE_KEY = 'rv_box_data';

/** 默认配置（第一次使用时的初始值） */
const DEFAULTS = {
  defaultX: null,         // number | null → null 表示用 CSS 默认（右下角）
  defaultY: null,
  count: 0,
  lastItemId: null,       // 上次弹出的物品 ID，用于防连续重复
  customImage: null,      // 自定义箱子外观 dataUrl，null = 使用默认 CSS 样式
};

export class BoxState {
  constructor() {
    this._data = { ...DEFAULTS };
    this._loaded = false;
  }

  // ---- 持久化 ----

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.warn('[MagicBox:State] 保存失败:', e);
    }
  }

  /** 从 localStorage 加载状态并合并默认值 */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // 合并：确保新增字段有默认值
        this._data = { ...DEFAULTS, ...parsed };
      } else {
        this._data = { ...DEFAULTS };
      }
    } catch (e) {
      console.warn('[MagicBox:State] 读取失败，使用默认值:', e);
      this._data = { ...DEFAULTS };
    }
    this._loaded = true;
    return this._data;
  }

  /** 导出当前状态快照 */
  exportState() {
    return { ...this._data };
  }

  // ---- 位置 ----

  getDefaultX() { return this._data.defaultX; }
  getDefaultY() { return this._data.defaultY; }

  setDefaultPosition(x, y) {
    this._data.defaultX = x;
    this._data.defaultY = y;
    this._save();
  }

  /** 清除自定义位置，恢复 CSS 默认 */
  clearPosition() {
    this._data.defaultX = null;
    this._data.defaultY = null;
    this._save();
  }

  /** 是否有用户（管理员）设定的默认位置 */
  hasCustomPosition() {
    return this._data.defaultX !== null && this._data.defaultY !== null;
  }

  // ---- 计数器 ----

  getCount() { return this._data.count; }

  incrementCount() {
    this._data.count++;
    this._save();
  }

  resetCount() {
    this._data.count = 0;
    this._save();
  }

  // ---- 物品去重 ----

  getLastItemId() { return this._data.lastItemId; }

  setLastItemId(id) {
    this._data.lastItemId = id;
    this._save();
  }

  // ---- 自定义图片 ----

  getCustomImage() { return this._data.customImage; }

  setCustomImage(dataUrl) {
    this._data.customImage = dataUrl || null;
    this._save();
  }

  clearCustomImage() {
    this._data.customImage = null;
    this._save();
  }
}
