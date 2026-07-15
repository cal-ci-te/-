// ========== 管理员面板事件入口（委托器版本） ==========
import { AdminPanel } from '../index.js';
import { ActionDelegator } from '../action-delegator.js';
import { DecoShelf } from '../../../services/deco.js';
import { Utils } from '../../../utils.js';

// 导入所有处理器
import * as authHandlers from '../handlers/auth.js';
import * as avatarHandlers from '../handlers/avatar.js';
import * as bgColorHandlers from '../handlers/bg-color.js';
import * as decoEditHandlers from '../handlers/deco-edit.js';
import * as gradientHandlers from '../handlers/gradient.js';
import * as textureHandlers from '../handlers/texture.js';
import * as videoHandlers from '../handlers/video.js';
import * as watermarkHandlers from '../handlers/watermark.js';

// 构建 action → handler 映射表
const handlerMap = {
  logout: authHandlers.logout,
  'upload-avatar': avatarHandlers.uploadAvatar,
  'apply-bg-color': bgColorHandlers.applyBgColor,
  'reset-bg-color': bgColorHandlers.resetBgColor,
  'confirm-edit-pos': decoEditHandlers.confirmEditPos,
  'cancel-edit-pos': decoEditHandlers.cancelEditPos,
  'bg-mode': gradientHandlers.bgMode,
  'grad-direction': gradientHandlers.gradDirection,
  'grad-feather': gradientHandlers.gradFeather,
  'apply-gradient': gradientHandlers.applyGradient,
  'save-palette': gradientHandlers.savePalette,
  'texture-upload': textureHandlers.textureUpload,
  'apply-texture': textureHandlers.applyTexture,
  'reset-texture': textureHandlers.resetTexture,
  'texture-opacity': textureHandlers.textureOpacity,
  'video-opacity': videoHandlers.videoOpacity,
  'apply-watermark': watermarkHandlers.applyWatermark,
  'watermark-opacity': watermarkHandlers.watermarkOpacity,

};

// 注册到 AdminPanel
AdminPanel.bindEvents = function () {
  if (AdminPanel._delegator) {
    AdminPanel._delegator.destroy();
  }
  const container = document.getElementById('panelContent');
  if (!container) {
    console.warn('[AdminPanel] #panelContent 不存在，无法绑定委托器');
    return;
  }
  const delegator = ActionDelegator;
  delegator.init(container);
  delegator.registerAll(handlerMap);
  AdminPanel._delegator = delegator;
  console.log('[AdminPanel] 事件委托器已绑定，已注册', Object.keys(handlerMap).length, '个 action');
};

AdminPanel.unbindEvents = function () {
  if (AdminPanel._delegator) {
    AdminPanel._delegator.destroy();
    AdminPanel._delegator = null;
    console.log('[AdminPanel] 事件委托器已清理');
  }
};

// AdminEvents 适配（保持兼容）
export const AdminEvents = {
  bindEvents: AdminPanel.bindEvents,
  unbindEvents: AdminPanel.unbindEvents,
  rebind: function () {
    if (AdminPanel._delegator) {
      console.log('[AdminEvents] 已有委托器，跳过重新绑定');
      return;
    }
    this.unbindEvents();
    this.bindEvents();
  },
};

console.log('✅ AdminPanel 事件入口（委托器版本）已加载（上传逻辑独立）');
