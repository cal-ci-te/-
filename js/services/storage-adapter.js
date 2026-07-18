const PREFIX = 'rv_';

export const StorageAdapter = {
  /**
   * 获取存储值（自动反序列化 JSON）
   * @param {string} key - 原始键名
   * @param {*} defaultValue - 默认值
   * @returns {*}
   */
  get(key, defaultValue = null) {
    try {
      const fullKey = PREFIX + key;
      const value = localStorage.getItem(fullKey);
      if (value === null) return defaultValue;
      // 尝试解析 JSON
      try {
        return JSON.parse(value);
      } catch {
        return value; // 如果不是 JSON，原样返回
      }
    } catch (error) {
      console.warn('[StorageAdapter] 读取失败:', key, error);
      return defaultValue;
    }
  },

  /**
   * 设置存储值（自动序列化 JSON）
   * @param {string} key - 原始键名
   * @param {*} value - 要存储的值
   */
  set(key, value) {
    try {
      const fullKey = PREFIX + key;
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch (error) {
      console.warn('[StorageAdapter] 写入失败:', key, error);
    }
  },

  /**
   * 删除存储项
   * @param {string} key - 原始键名
   */
  remove(key) {
    try {
      const fullKey = PREFIX + key;
      localStorage.removeItem(fullKey);
    } catch (error) {
      console.warn('[StorageAdapter] 删除失败:', key, error);
    }
  },

  /**
   * 清空所有带前缀的存储项（谨慎使用）
   */
  clear() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('[StorageAdapter] 清空失败:', error);
    }
  },
};

