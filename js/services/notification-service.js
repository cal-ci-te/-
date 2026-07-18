// js/services/notification-service.js
import { Utils } from '../utils.js';
import { UI } from '../utils/ui-strings.js';

export const NotificationService = {
  showToast(message, isError = false) {
    Utils.showToast(message, isError);
  },

  showConfirm(message, callback, cancelCallback) {
    if (confirm(message)) {
      if (typeof callback === 'function') callback();
    } else {
      if (typeof cancelCallback === 'function') cancelCallback();
    }
  },

  messages: UI.notification,

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

