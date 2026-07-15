// ============================================================
// 自动保存管理模块
// ============================================================

export const AutoSave = {
    timer: null,
    interval: 30 * 60 * 1000, // 30 分钟
    enabled: false,
    saveFn: null,

    /**
     * 启动自动保存
     * @param {Function} saveFunction - 保存草稿的函数
     */
    start(saveFunction) {
        if (this.timer) {
            this.stop();
        }
        if (typeof saveFunction !== 'function') {
            console.warn('[AutoSave] 未提供有效的保存函数');
            return;
        }
        this.saveFn = saveFunction;
        this.enabled = true;
        this.timer = setInterval(() => {
            console.log('[AutoSave] 定时触发保存');
            if (this.saveFn) {
                this.saveFn();
            }
        }, this.interval);
        console.log(`[AutoSave] 已启动，间隔 ${this.interval / 60000} 分钟`);
    },

    /**
     * 停止自动保存
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.enabled = false;
        this.saveFn = null;
        console.log('[AutoSave] 已停止');
    }
};