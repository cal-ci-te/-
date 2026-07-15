// js/services/notification-service.js
import { Utils } from '../utils.js';
import { UI } from '../utils/ui-strings.js';

export const NotificationService = {
  // ----- Toast 提示 -----
  showToast(message, isError = false) {
    Utils.showToast(message, isError);
  },

  // ----- 确认对话框 -----
  showConfirm(message, callback, cancelCallback) {
    if (confirm(message)) {
      if (typeof callback === 'function') callback();
    } else {
      if (typeof cancelCallback === 'function') cancelCallback();
    }
  },

  // ----- 预定义消息库（直接从 UI 导入） -----
  messages: UI.notification,

  // ----- 便捷方法 -----
  showVisibilityChanged(visible) {
    this.showToast(this.messages.visibilityChanged(visible));
  },

  showMinimized() {
    this.showToast(this.messages.minimized);
  },

  showLoginSuccess() {
    this.showToast(this.messages.loginSuccess);
  },

  showLoginFailed() {
    this.showToast(this.messages.loginFailed, true);
  },

  showLogoutSuccess() {
    this.showToast(this.messages.logoutSuccess);
  },

  showDecoUploadSuccess(name) {
    this.showToast(this.messages.decoUploadSuccess(name));
  },

  showDecoDuplicateSuccess(name) {
    this.showToast(this.messages.decoDuplicateSuccess(name));
  },

  showDecoDeleteSuccess() {
    this.showToast(this.messages.decoDeleteSuccess);
  },

  showPaletteSaved() {
    this.showToast(this.messages.paletteSaved);
  },

  showPaletteDeleted() {
    this.showToast(this.messages.paletteDeleted);
  },

  showPaletteApplied(name) {
    this.showToast(this.messages.paletteApplied(name));
  },
};

console.log('✅ NotificationService 已加载 (ES Module)');
