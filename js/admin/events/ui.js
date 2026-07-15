// ========== UI 控制事件（已废弃，由 AdminPanel 直接绑定） ==========
export const AdminUiEvents = {
  bind: function () {
    // 事件绑定已由 AdminPanel 处理，此处留空
    console.log('[AdminUiEvents] 事件绑定已迁移至 AdminPanel');
  },

  unbind: function () {
    // 清理由 AdminPanel.unbindEvents 负责
    console.log('[AdminUiEvents] 事件清理已迁移至 AdminPanel');
  },
};

console.log('✅ AdminUiEvents 已加载 (ES Module，适配新架构)');
